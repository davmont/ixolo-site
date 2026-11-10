---
title: "Guide for teachers"
description: "Using {{name}} in an operating systems course: how the source maps to the syllabus, the textbook, lab ideas and logistics."
sidebar:
  order: 6
---

MINIX was written to be taught, and {{name}} keeps that goal while running
on today's 64-bit PCs. This page is for people who teach operating systems
and want to use it in a course: what it offers, where each topic lives in
the source, how the classic textbook relates to the current code, and what
to prepare before the first lab.

## Why use it in a course

- **It is small enough to read.** The kernel is about {{kernelLines}} lines
  of C and assembly, amd64 code included. A student can follow a system call
  from the C library to the kernel and back in an afternoon.
- **The structure is the lesson.** Process management, memory, file systems
  and drivers are separate programs in separate directories, talking by
  messages. The boundaries that a monolithic kernel blurs are explicit here.
- **Mistakes are survivable.** A buggy driver written by a student crashes a
  user-mode process, not the machine. The reincarnation server restarts it,
  which is itself something to study.
- **It is a real, current system.** It boots on x86-64 under QEMU or KVM,
  supports multiprocessors (up to {{maxCpus}} CPUs at build time), compiles with LLVM {{llvm}}, and passes
  {{posixPassed}} of {{posixTotal}} tests of the Open POSIX Test Suite.
  Students work with the same concepts they meet in Linux or the BSDs.
- **It is BSD-licensed**, so you can publish modified versions, lab
  skeletons and solutions without licence questions.

## Where each topic lives

All paths are relative to the root of the [source tree]({{repo}}/tree/{{branch}})
on the `{{branch}}` branch.

| Topic | Where to look |
|---|---|
| Boot and kernel start-up | `minix/kernel/arch/x86_64/head.S`, `pre_init.c`, then `minix/kernel/main.c`; UEFI boot via GRUB is described in [UEFI boot](/en/docs/design/uefi-boot/) |
| Processes and the process table | `minix/kernel/proc.h`, `minix/kernel/proc.c`; user-level view in `minix/servers/pm/` (`forkexit.c`, `exec.c`, `signal.c`) |
| Message passing (IPC) | `minix/kernel/proc.c` (`do_ipc`, `mini_send`, `mini_receive`), message layouts in `minix/include/minix/ipc.h`, call numbers in `minix/include/minix/ipcconst.h` |
| Kernel calls | the dispatch table in `minix/kernel/system.c`, one handler per call in `minix/kernel/system/do_*.c`, numbers in `minix/include/minix/com.h`, library stubs in `minix/lib/libsys/sys_*.c` |
| Interrupts and the clock | `minix/kernel/interrupt.c`, `minix/kernel/clock.c`, `minix/kernel/arch/x86_64/apic.c` and `i8259.c` |
| Scheduling | mechanism in `minix/kernel/proc.c` (run queues, `pick_proc`); policy in the SCHED server, `minix/servers/sched/schedule.c` |
| Multiprocessors | `minix/kernel/smp.c`, `minix/kernel/arch/x86_64/arch_smp.c`; see [SMP design](/en/docs/design/smp/) |
| Memory management | the VM server, `minix/servers/vm/` (`region.c`, `pagefaults.c`, `mmap.c`, `pagetable.c`); reclaim and swap in [VM reclaim](/en/docs/design/reclaim/) |
| Sharing memory safely between processes | grants: `minix/include/minix/safecopies.h`, `minix/lib/libsys/safecopies.c`, `minix/kernel/system/do_safecopy.c` |
| File systems | the VFS layer in `minix/servers/vfs/` (worker threads in `worker.c`); the native file system in `minix/fs/mfs/`; others (ext2, vfat, exfat, isofs, tmpfs, procfs) next to it in `minix/fs/` |
| Device drivers | example: `minix/drivers/examples/hello/`; libraries: `minix/lib/libchardriver/`, `minix/lib/libblockdriver/`; real drivers in `minix/drivers/storage/` (ahci, nvme, at_wini), `minix/drivers/tty/` |
| Reliability and recovery | the reincarnation server `minix/servers/rs/`, the System Event Framework `minix/lib/libsys/sef*.c`, the data store `minix/servers/ds/` |
| Privileges | per-service policy in `etc/system.conf` and `/etc/system.conf.d/`; parsed by `minix/commands/minix-service/` |
| Networking | the lwIP-based stack in `minix/net/lwip/`, UNIX domain sockets in `minix/net/uds/` |
| Tests | `minix/tests/` (installed as `/usr/tests/minix-posix`) |

[The architecture overview](/en/docs/learn/architecture/) and
[Message passing](/en/docs/learn/message-passing/) are good first readings
for students before they open the code.

## Reading the textbook alongside {{name}}

The standard companion is Tanenbaum and Woodhull, *Operating Systems:
Design and Implementation*, 3rd edition (Prentice Hall, 2006). It explains
MINIX 3.1.0 and prints much of its source. The concepts in it are still
the right way into this code. Many details are not, because MINIX moved on
for ten years after the book and {{name}} has moved on again since.

| In the book (MINIX 3.1.0) | In {{name}} today |
|---|---|
| Microkernel, drivers and servers as user processes, RS restarts failed drivers | **Unchanged.** This is still the core of the design. |
| `send`, `receive`, `sendrec`, `notify` with fixed-size messages | Same primitives, plus non-blocking and asynchronous sends. Messages are typed structs. On amd64 the payload grew from 56 to up to 96 bytes. |
| Copying between processes with `sys_vircopy` and physical addresses | **Grants**: a process names exactly which bytes another may read or write, and the kernel checks every copy. |
| Scheduling inside the kernel, 16 priority queues | The kernel keeps the run queues, but a user-space SCHED server sets priorities and quanta (since 3.1.7). {{name}} adds SMP, CPU affinity and real-time classes. |
| Memory managed by PM with segments, no paging | A separate **VM server** with paging (since 3.1.4). {{name}} uses 4-level amd64 page tables, NX, a 47-bit user address space, reclaim and compressed memory. |
| A single file server, single-threaded | **VFS** plus separate file system servers; VFS is multithreaded. MFS gained version 4 inodes and journaling. |
| 16- and 32-bit Intel, segment-based protection, MINIX's own boot monitor | **x86-64 only**, paging-based protection, boots from BIOS or UEFI (through GRUB on UEFI). |
| ACK compiler, a.out binaries, MINIX's own commands | **LLVM/clang {{llvm}}** and lld, ELF binaries, shared libraries, NetBSD C library and user-space tools (since 3.2.0). |
| One CPU | Up to {{maxCpus}} CPUs. The kernel runs under a big kernel lock. |

A practical way to use the book: assign the concept chapters (processes,
I/O, memory, file systems) as written, and replace the source-walkthrough
parts with the current files from the table above. Expect students to
find code that the book does not mention; that is a good discussion point
about how real systems evolve.

Upstream keeps an [indexed listing of the book's source](http://www.minix3.org/documentation/AppendixB.html)
for 3.1.0, useful to compare old and new versions of the same file.

## Lab ideas

Only the first lab has a page on this site so far. The others are ideas
with pointers; check them on the current tree before giving them to
students.

1. **Break a driver.** Kill or crash a driver and watch the system recover.
   See [Lab: break a driver](/en/docs/learn/lab-break-a-driver/).
2. **Hello driver.** Study `minix/drivers/examples/hello/`, a minimal
   character driver that the base system installs as `/service/hello` with
   its policy in `/etc/system.conf.d/hello`. Students start it with
   `minix-service`, read from it, then extend it (a counter, a ring buffer,
   a second minor device). Upstream's
   [driver programming guide](https://wiki.minix3.org/doku.php?id=developersguide:driverprogramming)
   describes the same driver for i386.
3. **Add a kernel call.** Define a number in `minix/include/minix/com.h`,
   write a handler in `minix/kernel/system/`, register it in
   `minix/kernel/system.c`, add a stub to `libsys`, add its name to the
   table in `minix/commands/minix-service/parse.c` and allow it for one
   service in its `system.conf` entry. This teaches the privilege model as
   much as the kernel. Upstream's
   [new kernel call](https://wiki.minix3.org/doku.php?id=developersguide:newkernelcall)
   page gives the i386 version.
4. **Change the scheduling policy.** The policy is a user-space server, so
   students can rewrite `minix/servers/sched/schedule.c` (lottery or
   fair-share scheduling are classic assignments) without touching the
   kernel. A bug in their scheduler is much easier to debug than one in
   kernel code.
5. **Run and extend the test suite.** As root, `cd /usr/tests/minix-posix`
   and `./run` (or `./run -t 1` for one test, `./run -l` to list them).
   Students write a new test for a system call, or for the code they
   changed in an earlier lab. See [Testing](/en/docs/develop/testing/).

## Course logistics

- **Use QEMU.** Every student machine needs `qemu-system-x86_64`. With KVM
  (Linux hosts with hardware virtualisation) the system boots in seconds.
  Without KVM, QEMU emulates the CPU: it works, but expect test runs to be
  several times slower.
- **The CPU model matters.** The kernel needs the FSGSBASE instructions.
  Under KVM pass `-cpu host`; without KVM use `-cpu max`. The default QEMU
  CPU model does not boot. A minimal command:

  ```sh
  qemu-system-x86_64 -enable-kvm -cpu host -m 1024 -smp 2 \
      -cdrom minix_amd64.iso
  ```

- **Don't make students build the toolchain.** A full cross build from a
  clean checkout compiles LLVM first: on the 4-core CI runners the
  toolchain alone takes about two hours and the system another two. Build
  once on a lab server and hand out the ISO, or point students at the ISO
  that CI produces for every commit (in the
  [Actions tab]({{repo}}/actions); you need a GitHub account, and
  artifacts are deleted after 7 days). See
  [Building](/en/docs/develop/building/).
- **Then rebuild only what changed.** After the first full build, students
  who modify one server or driver only rebuild that part and a new image.
- **Debugging.** There is no gdb or lldb in the system. Students debug with
  `printf`, the kernel log, the serial console and the QEMU monitor. Plan
  labs with that in mind.
- **Not every upstream feature works.** Live update is not available on
  amd64, i386 does not build, and there is no binary package repository.
  Avoid assignments that depend on those.

## More material

- **Upstream course list:** [universities that have used MINIX 3](https://wiki.minix3.org/doku.php?id=courses).
  Many course pages there are old and some links are dead, but the
  assignment ideas still apply.
- **Student project ideas:** [upstream student projects](https://wiki.minix3.org/doku.php?id=studentprojects:start),
  written for the research group's students.
- **Readable papers for students:**
  - Herder et al., "MINIX 3: A Highly Reliable, Self-Repairing Operating
    System", *ACM SIGOPS Operating Systems Review*, July 2006:
    [PDF](http://www.minix3.org/docs/jorrit-herder/osr-jul06.pdf).
  - Tanenbaum et al., "MINIX 3: Status Report and Current Research",
    USENIX *;login:*, June 2010: [PDF](http://www.minix3.org/docs/login-2010.pdf).
  - Tanenbaum, "Lessons Learned from 30 Years of MINIX", *CACM*, March 2016,
    DOI [10.1145/2795228](https://doi.org/10.1145/2795228).
- **Video:** Tanenbaum's [FOSDEM talk on MINIX 3](https://www.youtube.com/watch?v=bx3KuE7UjGA).
- **History:** [From MINIX to {{name}}](/en/docs/learn/history/) gives
  students the background.
- **More papers and theses:** [Further reading](/en/docs/reference/further-reading/).

## Share your material

If you use {{name}} in a course, we would like to hear about it: what
worked, what broke, and which labs you built. Open an issue at
[{{issues}}]({{issues}}). Lab handouts, slides and fixes to this page are
welcome too, under a licence that lets others reuse them.
