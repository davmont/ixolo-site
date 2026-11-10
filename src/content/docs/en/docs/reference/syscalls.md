---
title: "System calls"
description: "Which server implements each POSIX call, and the kernel calls that servers and drivers use."
sidebar:
  order: 2
---

On a monolithic UNIX a system call traps into the kernel, which does the work.
On {{name}} most POSIX calls are messages. The libc wrapper fills in a message
and sends it to a user-space server: PM for processes and signals, VFS for
files and sockets, VM for memory, and a few others. The kernel itself offers
a much smaller set of *kernel calls*, which only servers and drivers may use.

This page maps the first set to servers and lists the second. The names come
from two headers on `{{branch}}`:
[`minix/include/minix/callnr.h`]({{repo}}/blob/{{branch}}/minix/include/minix/callnr.h)
(PM and VFS call numbers) and
[`minix/include/minix/com.h`]({{repo}}/blob/{{branch}}/minix/include/minix/com.h)
(kernel, VM, IPC and MIB calls). For the message mechanism itself, see
[message passing](/en/docs/learn/message-passing/).

## Part 1: POSIX calls and their servers

| Server | Source | Handles |
|---|---|---|
| PM, process manager | [`minix/servers/pm`]({{repo}}/blob/{{branch}}/minix/servers/pm/table.c) | Processes, threads, signals, identities, clocks and timers, scheduling requests |
| VFS, virtual file system | [`minix/servers/vfs`]({{repo}}/blob/{{branch}}/minix/servers/vfs/table.c) | Files, directories, descriptors, pipes, devices, mounts, `select`, `kqueue`, sockets |
| VM, virtual memory | [`minix/servers/vm`]({{repo}}/blob/{{branch}}/minix/servers/vm/main.c) | `brk`, `mmap` and friends, address-space limits |
| IPC | [`minix/servers/ipc`]({{repo}}/blob/{{branch}}/minix/servers/ipc/main.c) | System V shared memory and semaphores, POSIX message queues and semaphores |
| MIB | [`minix/servers/mib`]({{repo}}/blob/{{branch}}/minix/servers/mib/main.c) | `sysctl` |

A call often involves more than one server. `fork` goes to PM, and PM then
asks VM to copy the address space and VFS to copy the descriptor table.
`mmap` of a file goes to VM, which asks VFS for the file.

### PM: processes, signals and time

| Group | Calls |
|---|---|
| Processes | `fork`, `execve`, `_exit`, `wait4`/`waitpid`, `waitid`, `getpid`/`getppid`, `ptrace`, `reboot`, `getrusage` |
| Threads | `_lwp_create`, `_lwp_exit`, `_lwp_self`, `_lwp_wait`, `_lwp_park`, `_lwp_unpark`, `_lwp_wakeup`, `_lwp_kill`, `_lwp_detach` (used by libpthread) |
| Identity | `setuid`/`seteuid`/`setgid`/`setegid`, `setresuid`/`setresgid`, `getresuid`/`getresgid`, `getgroups`/`setgroups`, `issetugid` |
| Sessions and job control | `setsid`, `getsid`, `setpgid`, `getpgid`, `getpgrp` |
| Signals | `kill`, `sigaction`, `sigprocmask`, `sigpending`, `sigsuspend`, `sigaltstack`, `sigreturn`, `sigqueue`, `sigtimedwait`/`sigwaitinfo`/`sigwait` |
| Clocks and timers | `clock_gettime`/`clock_settime`/`clock_getres`, `gettimeofday`, `setitimer`/`getitimer` (and `alarm`), `timer_create`/`timer_settime`/`timer_gettime`/`timer_getoverrun`/`timer_delete` |
| Scheduling | `getpriority`/`setpriority` (`nice`), `sched_yield`, `sched_setscheduler`/`sched_setparam` and the `get` versions, `sched_setaffinity_np`/`sched_getaffinity_np`; mutex priority protect and inherit for libpthread |
| Machine context | `getcontext`/`setcontext` |

PM does not decide scheduling itself. It passes these requests to the SCHED
server, which sets priorities and CPUs through the kernel.

### VFS: files, descriptors and sockets

| Group | Calls |
|---|---|
| Path calls | `openat`, `fstatat`, `mkdirat`, `mknodat`, `unlinkat`, `linkat`, `renameat`, `symlinkat`, `readlinkat`, `fchmodat`, `fchownat`, `faccessat`, `utimensat`. The classic `open`, `stat`, `mkdir`, `unlink`... are these calls with `AT_FDCWD`. |
| I/O | `read`, `write`, `pread`, `pwrite`, `lseek`, `ioctl`, `getdents` |
| Descriptors | `close`, `fcntl` (also `dup` and `dup2`), `pipe2`, `umask`, `flock`, record locks through `fcntl` |
| File state | `fstat`, `fchmod`, `fchown`, `truncate`/`ftruncate`, `posix_fallocate`, `fsync` (also `fdatasync`), `sync`, `chflags`/`fchflags`, the `extattr_*` family (and ACLs built on it) |
| Directories and mounts | `chdir`, `fchdir`, `chroot`, `statvfs1`/`fstatvfs1`, `getvfsstat`; mounting through MINIX's own `minix_mount`/`minix_umount`, which `mount(1)` and `umount(1)` use |
| Waiting | `select` (and `pselect`), `kqueue1`, `kevent`. libc builds `poll` on top of `select`, and `nanosleep` too. |
| Sockets | `socket`, `socketpair`, `bind`, `connect`, `listen`, `accept` (and `accept4`/`paccept`), `sendto`, `sendmsg`, `recvfrom`, `recvmsg`, `setsockopt`, `getsockopt`, `getsockname`, `getpeername`, `shutdown` |

VFS passes file operations to the file system server that owns the file (MFS,
ext2, vfat, tmpfs...) and device operations to the driver. For sockets, VFS
forwards to a socket driver: `lwip` serves `PF_INET`, `PF_INET6`, `PF_ROUTE`
and `PF_LINK`; `uds` serves `PF_UNIX`.

POSIX shared memory (`shm_open`, `shm_unlink`) is plain files on a tmpfs
mounted on `/var/shm`, so it goes through VFS like any file.

### VM: memory

| Call | Notes |
|---|---|
| `brk`/`sbrk` | The classic heap |
| `mmap`, `munmap` | Anonymous and file mappings. Writable `MAP_SHARED` file mappings work on MFS and tmpfs; other file systems return `ENODEV`. |
| `mprotect`, `msync` | New in {{name}} |
| `getrlimit`/`setrlimit` | VM enforces `RLIMIT_AS` and `RLIMIT_DATA`. libc answers the other limits itself, with fixed values. |

`mlock`, `munlock`, `mlockall` and `munlockall` exist in libc. They check
their arguments and permissions but do not pin pages.

### IPC server: System V and POSIX IPC

| Group | Calls |
|---|---|
| System V shared memory | `shmget`, `shmat`, `shmdt`, `shmctl` |
| System V semaphores | `semget`, `semctl`, `semop` |
| POSIX message queues | `mq_open`, `mq_close`, `mq_unlink`, `mq_send`/`mq_timedsend`, `mq_receive`/`mq_timedreceive`, `mq_getattr`/`mq_setattr`, `mq_notify` |
| POSIX semaphores | `sem_open`, `sem_close`, `sem_unlink`, and `sem_init` with `pshared` set (process-local semaphores stay in libpthread) |
| Process-shared pthread objects | Wait queues behind `PTHREAD_PROCESS_SHARED` mutexes, condition variables, rwlocks and barriers |

System V message queues (`msgget`, `msgsnd`, `msgrcv`, `msgctl`) are not
implemented.

### MIB and the rest

- **MIB** answers `sysctl`. libc builds other calls on it; `uname`, for
  example, reads its fields with `sysctl`.
- **POSIX AIO** (`aio_read`, `aio_write`, `aio_fsync`, `aio_error`,
  `aio_return`, `aio_cancel`, `aio_suspend`, `lio_listio`) lives in `librt`
  and has no server of its own. A pool of threads performs each request with
  `pread` or `pwrite`.
- **`clock_nanosleep`** is built in libc on `nanosleep`.

### New since the fork

Upstream MINIX 3 (last commit November 2018) has none of these as server
calls. They were added on the way to {{name}}:

| Area | Calls |
|---|---|
| Threads (amd64) | `_lwp_*` in PM, so libpthread runs real kernel-scheduled threads |
| Path calls | The `*at` family. The old `VFS_OPEN`, `VFS_STAT`... numbers were removed, which broke the ABI. |
| Files | `pread`/`pwrite`, `flock`, `posix_fallocate`, `chflags`, `extattr_*` |
| Event notification | `kqueue1`/`kevent` |
| Process control | `waitid`, `setpgid`/`getpgid` with real job control, `setresuid`/`setresgid` |
| Signals | `sigaltstack`, real-time signals, `sigqueue`, `sigtimedwait` |
| Timers and scheduling | `timer_*`, CPU-time clocks, `sched_*` with `SCHED_FIFO`/`SCHED_RR`, CPU affinity |
| Memory | `mprotect`, `msync`, `RLIMIT_AS`/`RLIMIT_DATA` |
| IPC | POSIX message queues, named and process-shared semaphores, process-shared pthread objects |
| Library | POSIX AIO in a new `librt` |

VFS also has a `swapctl` call for disk swap, but libc has no `swapctl()`
wrapper yet and there is no `swapon` tool.

## Part 2: kernel calls

Servers and drivers talk to the kernel through the SYSTEM task with kernel
calls. Their numbers start at `KERNEL_CALL` (`0x600`) in `com.h`. Drivers
call them through the `sys_*` wrappers in
[`minix/lib/libsys`]({{repo}}/blob/{{branch}}/minix/lib/libsys). The kernel
dispatches them in
[`minix/kernel/system.c`]({{repo}}/blob/{{branch}}/minix/kernel/system.c),
one handler per file in
[`minix/kernel/system/`]({{repo}}/blob/{{branch}}/minix/kernel/system).

Each process may only use the calls its privilege structure allows. For a
service, that list comes from its entry in `/etc/system.conf`
(see `system.conf(5)`). Every system process gets a basic set:
`SYS_EXIT`, `SYS_SAFECOPYFROM`, `SYS_SAFECOPYTO`, `SYS_VSAFECOPY`,
`SYS_GETINFO`, `SYS_TIMES`, `SYS_SETALARM`, `SYS_SETGRANT`, `SYS_DIAGCTL`,
`SYS_STATECTL` and `SYS_SAFEMEMSET`.

| Group | Kernel calls | Typical caller |
|---|---|---|
| Process management | `SYS_FORK`, `SYS_EXEC`, `SYS_CLEAR`, `SYS_EXIT`, `SYS_PRIVCTL`, `SYS_TRACE`, `SYS_RUNCTL`, `SYS_GETMCONTEXT`, `SYS_SETMCONTEXT`, `SYS_UPDATE`, `SYS_STATECTL` | PM, RS (privileges, live update) |
| Signals | `SYS_KILL`, `SYS_GETKSIG`, `SYS_ENDKSIG`, `SYS_SIGSEND`, `SYS_SIGRETURN` | PM, and servers that raise signals |
| Copying between address spaces | `SYS_SAFECOPYFROM`, `SYS_SAFECOPYTO`, `SYS_VSAFECOPY`, `SYS_SETGRANT`, `SYS_SAFEMEMSET` | Every server and driver |
| Memory (privileged) | `SYS_VIRCOPY`, `SYS_PHYSCOPY`, `SYS_MEMSET`, `SYS_UMAP`, `SYS_UMAP_REMOTE`, `SYS_VUMAP`, `SYS_VMCTL` | VM; drivers use `SYS_VUMAP` for DMA |
| I/O and interrupts | `SYS_IRQCTL`, `SYS_DEVIO`, `SYS_VDEVIO`, `SYS_SDEVIO`, `SYS_IOPENABLE`, `SYS_READBIOS` | Device drivers |
| Time | `SYS_TIMES`, `SYS_SETALARM`, `SYS_STIME`, `SYS_SETTIME`, `SYS_VTIMER` | PM, drivers |
| Scheduling | `SYS_SCHEDULE`, `SYS_SCHEDCTL` | SCHED |
| Information and debugging | `SYS_GETINFO`, `SYS_DIAGCTL`, `SYS_SPROF`, `SYS_ABORT` | Many; `SYS_ABORT` shuts the system down |
| ARM only | `SYS_PADCONF` | Not used on amd64 |

**Safe copies are the rule.** A process cannot name another process's memory
directly. It creates a *grant* in its own grant table, and the other side
copies through it with `SYS_SAFECOPYFROM` or `SYS_SAFECOPYTO`. The
unprotected `SYS_VIRCOPY` and `SYS_PHYSCOPY` are for VM and a few
privileged services.

**x86-only calls.** `SYS_DEVIO`, `SYS_VDEVIO`, `SYS_SDEVIO`, `SYS_IOPENABLE`
and `SYS_READBIOS` exist only on i386 and amd64, because they deal with x86
I/O ports and the BIOS area. On amd64 their handlers live in
[`minix/kernel/arch/x86_64/`]({{repo}}/blob/{{branch}}/minix/kernel/arch/x86_64).

### What changed on amd64 and SMP

The set of kernel calls is the same as upstream MINIX 3: the fork added no
new `SYS_*` numbers. It extended some of them instead:

- `SYS_IRQCTL` has a new `IRQ_SETPOLICY_MSI` request, which allocates an MSI
  or MSI-X vector. The NVMe driver uses MSI-X.
- `SYS_GETINFO` has a new `GET_IPCTRAFFIC` request, which reads and clears a
  per-process histogram of which CPUs its messages come from. SCHED uses it
  to place servers that talk a lot on the same CPU.
- `SYS_VMCTL` carries 64-bit page-table roots and addresses, for 4-level
  page tables and the 47-bit user address space.
- On SMP, `SYS_SCHEDULE` takes the CPU to run a process on, which is how
  SCHED applies CPU affinity. `SYS_GETINFO` with `GET_CPUINFO` and
  `GET_CPUTICKS` reports per-CPU data. There is no kernel call just for SMP.

The [SMP design notes](/en/docs/design/smp/) describe the kernel side.

:::note[An older reference]
The upstream wiki has a kernel API page,
<https://wiki.minix3.org/doku.php?id=developersguide:kernelapi>. It describes
MINIX 3 as of the 2010s: useful background, but check names and fields against
`com.h` on `{{branch}}`.
:::
