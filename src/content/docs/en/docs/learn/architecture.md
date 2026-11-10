---
title: The architecture in four layers
description: How {{name}} is put together, and why a crashing driver does not take the system down.
sidebar:
  order: 1
---

Most operating systems people use every day (Linux, Windows, macOS, the BSDs)
have a **monolithic** kernel: the scheduler, the file systems, the network
stack and every device driver run together in one privileged address space.
A bug in any of them, such as a stray pointer in a network card driver, can
corrupt the rest and bring the whole machine down.

{{name}}, like the MINIX 3 it is derived from, takes the opposite approach.
The kernel does as little as possible, and everything else runs as ordinary,
isolated user-mode processes that talk to each other by passing messages.

:::note[What is new in {{name}}]
The design is MINIX 3's. What {{name}} changed is the machine it runs on:

- **x86-64 only.** The kernel, servers and drivers are 64-bit. The i386 build
  is broken on the development branch and ARM is unmaintained.
- **SMP** on up to {{maxCpus}} CPUs (a compile-time limit), with a fast IPC
  path and servers that follow their clients from CPU to CPU (see
  [the price](#the-price) below).
- **UEFI and BIOS** boot from the same hybrid ISO.
- **A 47-bit user address space** (128 TB) for ordinary programs. System
  services still live in the first gigabyte.
:::

## The four layers

| Layer | What runs there | Privilege |
|---|---|---|
| 4. User programs | Shells, compilers, editors, network daemons, the optional desktop | user mode |
| 3. System servers | PM, VFS, VM, RS, DS, SCHED, MIB, file system servers, the network stack | user mode |
| 2. Device drivers | Disk (AHCI, NVMe, IDE), network (e1000, igc and older cards), USB storage, TTY, PCI, ACPI… | user mode |
| 1. Microkernel | Interrupts, scheduling, message passing, the lowest level of memory management | kernel mode |

Only layer 1 runs in kernel mode. Drivers and servers are processes with their
own address space, like any program, but with extra **privileges** granted one
by one in `/etc/system.conf`: which I/O ports a driver may touch, which
interrupts it may receive, which kernel calls it may make and which other
processes it may send messages to. A driver that goes wrong can only damage
what it was allowed to touch. [Isolation and self-repair](/en/docs/learn/reliability/)
shows a real entry.

## The microkernel

The kernel (in `minix/kernel/`, about {{kernelLines}} lines of C and assembly
including the amd64 code) is responsible for:

- **Interrupts and exceptions.** It turns a hardware interrupt into a
  notification message to the driver that registered for it.
- **Scheduling.** It picks which process runs on each CPU. Policy decisions
  (priorities, which CPU a server should live on) are left to the SCHED server
  in user space.
- **Message passing.** Processes call `send`, `receive`, `sendrec`, `notify`
  and a few variants. See [Message passing](/en/docs/learn/message-passing/).
- **Kernel calls.** Privileged operations that servers and drivers request
  by message: copy data between address spaces, set up page tables, perform
  I/O. Ordinary programs cannot make them.

On SMP machines the kernel is protected by one big kernel lock: only one CPU
runs kernel code at a time, while user-mode servers and programs run in
parallel.

## Booting: who starts whom

The boot loader (the NetBSD-derived loader for BIOS, GRUB for UEFI) loads the
kernel and twelve **boot modules**: `ds`, `rs`, `pm`, `sched`, `vfs`, `memory`
(RAM disks and `/dev/null`), `tty`, `mib`, `vm`, `pfs`, `mfs` and `init`. The
list is in
[`minix/kernel/table.c`]({{repo}}/blob/{{branch}}/minix/kernel/table.c).
These are enough to mount a small RAM disk and run a shell script.

From then on, RS starts everything else on request of the startup scripts:

1. The RAM disk script
   ([`minix/drivers/storage/ramdisk/rc`]({{repo}}/blob/{{branch}}/minix/drivers/storage/ramdisk/rc))
   starts `acpi`, `pci`, `input`, `pckbd`, the disk driver it finds (`nvme`,
   `ahci`, `virtio_blk` or `at_wini`) and `procfs`, then mounts the real root.
2. [`/etc/rc.minix`]({{repo}}/blob/{{branch}}/etc/rc.minix) starts `is`
   (debug dumps), `random`, `readclock.drv`, `usbd` and `devmand`, and mounts a
   `tmpfs` on `/var/shm`.
3. [`/usr/etc/rc`]({{repo}}/blob/{{branch}}/etc/usr/rc) starts one network
   driver per network card it finds on the PCI bus, then `pty`, `lwip`, `uds`,
   `ipc` and `log`.

Every one of these is started with the `minix-service up` command, which asks
RS to create the process. That is why RS can restart any of them later.

## The system servers

| Server | Role |
|---|---|
| **PM** (process manager) | `fork`, `exec`, `exit`, signals, process groups and job control, timers |
| **VFS** (virtual file system) | Open files, path lookup, mounts, locks, `select`/`poll`/`kqueue`; forwards requests to the file system servers |
| **VM** (virtual memory) | Address spaces, `mmap`, `mprotect`, page faults, page reclaim, compressed memory. Kernel-side swap exists, but there is no `swapon` tool yet |
| **RS** (reincarnation server) | Starts every driver and server, watches them, restarts them when they fail |
| **DS** (data store) | A small name and value registry; components find each other's current endpoint there |
| **SCHED** | Scheduling policy, CPU affinity, real-time classes, moving servers between CPUs |
| **MIB** | The `sysctl` tree and the process information that `ps` and `top` read |
| **IPC** | System V shared memory and semaphores, POSIX message queues and semaphores |
| File system servers | MFS (the native file system), ext2/3/4, vfat, exfat, isofs, procfs, ptyfs, tmpfs, pfs (pipes) |
| Network | `lwip` (the TCP/IP stack) and `uds` (UNIX domain sockets) are servers too |

A `read()` call from a program goes: program → VFS → the MFS server for that
file system → the disk driver → the hardware, and back, every hop a message.

## How self-repair works

RS is the parent of every system process. When one dies (because it crashed,
was killed, or stopped answering RS's periodic heartbeat), RS is told and
starts a fresh copy from the same binary. Each driver publishes its new
endpoint through DS, and the servers that used it (VFS, the network stack)
are subscribed to those entries, so they notice and redo their pending
requests.

For a network driver the visible effect is a few lost packets, which TCP
retransmits. For a disk driver, the file system server reissues the request.
The rest of the system keeps running.

This works for drivers and for some servers. It does not work for everything:
a crash in VFS, PM or VM, or in the kernel, still stops the machine.
[Isolation and self-repair](/en/docs/learn/reliability/) draws the line
precisely, and the [break-a-driver lab](/en/docs/learn/lab-break-a-driver/)
lets you try it.

## The price

Every request crosses more address spaces than in a monolithic kernel, so
message passing has to be fast. On amd64 {{name}} has two optimisations:

- a **fast path** for `sendrec` when the receiver is already waiting: the
  kernel copies the message and, if both run on the same CPU, switches
  straight to the receiver without going through the run queue;
- **server colocation**: SCHED counts which CPU each server's requests come
  from, and moves the server to that CPU when one CPU sends most of them
  (VFS, VM, RS and SCHED itself stay where they are).

Measured when they were merged, on four CPUs (`-smp 4`), the two together cut
the median round-trip time from about 78 300 to 16 100 CPU cycles, 4.86 times
faster.

## Read more

- Andrew S. Tanenbaum and Albert S. Woodhull, *Operating Systems: Design and
  Implementation*, 3rd edition (2006): the textbook built around MINIX 3.
- Jorrit N. Herder et al., *MINIX 3: A Highly Reliable, Self-Repairing
  Operating System*, ACM SIGOPS Operating Systems Review, 2006.
- Andrew S. Tanenbaum, *Lessons Learned from 30 Years of MINIX*,
  Communications of the ACM, 2016.
- The upstream overview of the servers and the boot sequence:
  <https://wiki.minix3.org/doku.php?id=developersguide:overviewofminixservers>
- The design documents in this site, starting with
  [SMP on amd64](/en/docs/design/smp/).
