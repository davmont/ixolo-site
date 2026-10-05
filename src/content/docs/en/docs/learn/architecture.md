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

## The four layers

| Layer | What runs there | Privilege |
|---|---|---|
| 4. User programs | Shells, compilers, editors, network services, the desktop | user mode |
| 3. System servers | PM, VFS, VM, RS, DS, the scheduler, file system servers, the network stack | user mode |
| 2. Device drivers | Disk (AHCI, NVMe, IDE), network (e1000, igc, virtio), USB, TTY… | user mode |
| 1. Microkernel | Interrupts, scheduling, message passing, the lowest level of memory management | kernel mode |

Only layer 1 runs in kernel mode. Drivers and servers are processes with their
own address space, like any program, but with extra **privileges** granted one
by one: which I/O ports a driver may touch, which interrupts it may receive,
which kernel calls it may make and which other processes it may send messages
to. A driver that goes wrong can only damage what it was allowed to touch.

## The microkernel

The kernel (in `minix/kernel/`, about {{kernelLines}} lines of C and assembly
including the amd64 code) is responsible for:

- **Interrupts and exceptions.** It turns a hardware interrupt into a message
  to the driver that asked for it.
- **Scheduling.** It picks which process runs on each CPU. Policy decisions
  are left to a user-space scheduler server.
- **Message passing.** Processes call `send`, `receive`, `sendrec` and
  `notify`. See [Message passing](/en/docs/learn/message-passing/).
- **Kernel calls.** Privileged operations that servers and drivers request
  by message: copy data between address spaces, set up page tables, perform
  I/O. Ordinary programs cannot make them.

## The system servers

| Server | Role |
|---|---|
| **PM** (process manager) | `fork`, `exec`, `exit`, signals, process groups and job control, timers |
| **VFS** (virtual file system) | Open files, path lookup, mounts, locks; forwards requests to the file system servers |
| **VM** (virtual memory) | Address spaces, `mmap`, `mprotect`, page faults, reclaim, compression and swap |
| **RS** (reincarnation server) | Starts every driver and server, watches them, restarts them when they fail |
| **DS** (data store) | A small name and value registry that lets restarted components find their state |
| **SCHED** | Scheduling policy |
| File system servers | MFS (the native file system), ext2/3/4, vfat, exfat, isofs, procfs, pfs (pipes)… |
| Network | The TCP/IP stack (lwIP) runs as a server too |

A `read()` call from a program goes: program → VFS → the MFS server for that
file system → the disk driver → the hardware, and back, every hop a message.

## How self-repair works

RS is the parent of every system process. When one dies (because it crashed,
was killed, or stopped answering RS's periodic heartbeat), RS is told,
starts a fresh copy from the same binary, and publishes the new endpoint
through DS. The components that talked to the old copy notice and redo their
requests.

For a network driver this is invisible except for a few lost packets, which
TCP retransmits. For a disk driver, the file system server reissues the
request. The rest of the system never stops.

Try it yourself in the [break-a-driver lab](/en/docs/learn/lab-break-a-driver/).

## The price

Every request crosses more address spaces than in a monolithic kernel, so
message passing has to be fast. On amd64 {{name}} has a fast path for
same-CPU send-and-receive, and it moves servers to the CPU of their busiest
client. That cut the median round-trip time about fivefold on four CPUs.

## Read more

- Andrew S. Tanenbaum and Albert S. Woodhull, *Operating Systems: Design and
  Implementation*, 3rd edition (2006): the textbook built around MINIX 3.
- Jorrit N. Herder et al., *MINIX 3: A Highly Reliable, Self-Repairing
  Operating System*, ACM SIGOPS Operating Systems Review, 2006.
- Andrew S. Tanenbaum, *Lessons Learned from 30 Years of MINIX*,
  Communications of the ACM, 2016.
- The design documents in this site, starting with
  [SMP on amd64](/en/docs/design/smp/).
