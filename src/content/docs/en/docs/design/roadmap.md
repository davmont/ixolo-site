---
title: "Roadmap: the open items"
source: "https://github.com/davmont/ixolo/blob/devel/docs/ROADMAP.md"
editUrl: "https://github.com/davmont/ixolo/blob/devel/docs/ROADMAP.md"
sidebar:
  order: 12
---

:::note[Generated from the source tree]
This page is a copy of [`docs/ROADMAP.md`](https://github.com/davmont/ixolo/blob/devel/docs/ROADMAP.md) on the `devel` branch.
Edit it there; `npm run sync-docs` refreshes this copy.
:::

This page lists work that is known to be missing, with enough detail to start
on it. Most items come from the two upstream MINIX 3 wish lists, audited
against this tree in November 2026:

- David van Moolenbroek's TODO list: <https://wiki.minix3.org/doku.php?id=wishlist:david>
- The general project list: <https://wiki.minix3.org/doku.php?id=wishlist:start>

The rest are problems found while testing the installer in November 2026.

The roadmap on the web site (<https://www.ixolo.org/en/project/>) summarises
this page. When you finish an item, move it to "Done" here and update the web
site in the same week.

---

## Kernel and core servers

**Redefine `SUSPEND` as `EDONTREPLY`.** Both mean "don't reply now"; VFS
uses `SUSPEND` (34 places in `minix/servers/vfs/`) and most other services
use `EDONTREPLY`. One name would remove a class of mix-ups. It is mostly
mechanical, but each use has to be checked, because a few paths treat the
two differently.

**Keep mounted file systems across a root remount.** Remounting `/` drops
the file systems mounted below it. This is needed before devfs and is an
improvement for procfs. The hard case is a process whose working directory is
on one of those file systems doing `cd ..` during the remount.

**Remove `_SIGN` from errno values.** The error constants still carry the
old sign trick for servers. Removing it touches every server's reply path and
`<sys/errno.h>`.

**Stop killing processes in uninterruptible calls.** A process can be
terminated while a server is half-way through a call for it (a safecopy, a
driver request). The resulting paths are poorly tested. PM should defer the
kill until the call completes, as it already does for some calls.

**Deliver debugger signals only when the process receives them.** `ptrace`
stop signals should take effect when the target actually receives them, not
when they are sent, and the target must not be able to ignore them.

**Call permission ACLs in PM and VFS.** RS already restricts which kernel
calls a service may make (`system.conf`). PM and VFS calls have no such
filter, so any service can make any POSIX call.

**Deduplicate the x86 kernel.** `minix/kernel/arch/x86_64` started as a copy
of `arch/i386`, and most of it (page tables, interrupt setup, the APIC and
ACPI code) is still the same. Move the shared code into `arch/x86`.

**Honour the MADT interrupt source overrides.** In APIC mode the kernel
programs every IRQ below 16 as ISA, edge-triggered and active-high
(`set_irq_redir_low()` in `minix/kernel/arch/x86_64/apic.c`), and it doesn't
read the ACPI MADT's interrupt source overrides. A PCI device whose
interrupt is routed below 16 is level-triggered, so it can lose interrupts
whenever its line stays asserted across the handler. On QEMU's `q35` machine
the PCI interrupts are routed to GSIs 16–23 and this doesn't arise, once
the ACPI service reads the whole routing table. On the `pc` (PIIX) machine
they are routed to IRQs 5, 9, 10 and 11, which the MADT marks level-triggered,
and the network card is on one of them.

**Single-image boot.** Put the kernel and boot modules in one file with the
parameters built in. That allows PXE boot and large RAM disks, and removes the
duplicate module lists in `boot.cfg`, GRUB's configuration and the release
scripts.

## File systems and storage

**Replace `REQ_INHIBREAD` with a read/peek flag.** It is a separate
request (`minix/servers/vfs/open.c`, `libfsdriver`) that exists only to
stop read-ahead. A flag on the read and peek requests would do the same.

**Real vector I/O.** `readv`, `writev`, `sendmsg` and `recvmsg` gather the
vector into one large buffer in libc (`minix/lib/libc/sys/vectorio.c`) and
make one call, which removes the point of using vectors. VFS and the file
system protocol need to carry the vector itself. This must also work for the
copies VFS makes on behalf of other processes.

**Subpage block sizes in libminixfs.** File systems whose blocks are
smaller than a page waste memory in the VM cache and can't be cached properly.
This is the second half of the libminixfs rework.

**Rewrite the VFS pipe code.** Pipe handling in VFS
(`minix/servers/vfs/pipe.c`) is complicated and has corner cases around
partial transfers and select. After that, PFS could grow a pipe's buffer
beyond `PIPE_BUF` when memory allows.

**devfs.** `/dev` is a directory on the root file system, filled by
`MAKEDEV` and by `devmand` for hot-plugged devices. A devfs would make device
nodes appear and disappear with their drivers. It depends on keeping mounts
across a root remount (above). It would also let non-root users get PTYs
without a separate `/dev/pts`.

**libblockdriver: accept character-driver requests.** Opening a block
device's character node (for example `/dev/c0d0` for raw access) through
libblockdriver returns `ENXIO` for `CDEV_OPEN`
(`minix/lib/libblockdriver/driver.c`). Block drivers should serve both.

**TwinFS.** Upstream had an experimental TwinFS (a file system that keeps two
copies of metadata) that was never merged. Evaluate it against MFS version 4,
which now has a metadata journal.

**More file systems.** Done: ext2/3/4, vfat, exFAT, ISO 9660, tmpfs. Not done:
XFS, ZFS, NTFS, btrfs.

**GPT: beyond four partitions.** The GPT support above maps only the first
four entries to `p0`–`p3`. Using more needs more minor numbers per disk.

**`gptmbr`: the GPT-aware MBR boot code doesn't build on amd64.** The
amd64 tree now cross-builds the i386 MBR, `biosboot`, `bootxx_minixfs3` and
`cdboot`, but `sys/arch/i386/stand/mbr/gptmbr` still fails: clang's
integrated assembler rejects its 16-bit `loopw`.

## Services and libraries

**Move the code shared by tty and pty into a library.** The console, serial
and pseudo-terminal drivers each have their own line discipline. The
complication is that the console interprets input at a different level from
a pty.

**Rework the DS publish/subscribe API.** Subscriptions use regular
expressions (`regcomp(3)`, which allocates memory). A simpler prefix match
would be lighter. One use case: RMIB wants to see MIB restarts independently
of the main code.

**Make RMIB calls asynchronous.** A MIB request to a deadlocked service
deadlocks MIB, and with it the whole system. This depends on RMIB learning
about service deaths through DS instead of from a failed `ipc_sendrec()`.

**Make RMIB more robust.** It isn't possible to bump the version of an
already-mounted RMIB subtree (such as `net.interface`), to mount a subtree by
name only (`minix.lwip`), or to stop bad name and ID combinations from
corrupting the tree.

**procfs: stop importing other services' headers, then make it optional.**
procfs compiles in the private tables of PM, VFS and others, so a change there
means recompiling procfs. Most of what it provides is now available through
the MIB service (`sysctl`), so procfs could become optional and leave the RAM
disk.

**SysV message queues.** `msgget`, `msgsnd`, `msgrcv` and `msgctl` aren't
implemented: the libc stubs are in `MISSING_SYSCALLS`. The IPC server is the
place for them, next to semaphores and shared memory.

**Document the driver libraries.** `libblockdriver`, `libchardriver`,
`libfsdriver`, `libinputdriver`, `libnetdriver` and `libsockdriver` have no
documentation beyond their source.

## Debugging

**A very basic debugger.** Printed stack traces can't be resolved for
dynamically linked programs. Even a minimal `ptrace`-based tool that loads
symbols from shared objects would help.

**Stack traces on ARM.** `kernel/trace(1)` stack traces work on x86 only.

**Debugging guide.** Write up the magic keys (the function keys that dump
process, memory and IPC state on the console) and how to read their output.

## ARM

ARM isn't a current target: the amd64 port is. These stay listed so they
aren't lost:

- Drivers grant themselves access to their memory regions; that should come
  from the system configuration.
- Use the ASID/context ID register to reduce TLB flushes.
- Single-step execution for `PT_STEP`.
- Test the MMC driver; run the BeagleBone Black eMMC in 8-bit mode.
- `system.conf` doesn't scale to several platforms.
- A GPIO example application, and a GPIO library that talks to a server.

## Userland and documentation

**K&R function definitions.** 74 remain, 63 of them in lwIP (`minix/lib/liblwip`).
Convert the rest; leave lwIP until it is updated from upstream.

**Manual pages.** Apart from `wlcompd`, `wlclient`, `fbcompd`, `wlprobe`
and `wlcoreprobe` (see "Done"), about 20 MINIX-specific programs have no
manual page. Find them by checking each `MAN=` in
`minix/commands`, `minix/usr.bin` and `minix/usr.sbin`.

**NetBSD userland.** Some NetBSD utilities are still missing from the
base system. Compare `distrib/sets/lists` with NetBSD's.

**Bluetooth.** There's no Bluetooth stack.

## Desktop (wlcompd, fbcompd)

Found while writing their manual pages (November 2026):

- **The two compositors disagree on the mouse's Y direction.** `wlcompd`
  computes `cy - dy` ("the mouse's Y grows upward"), `fbcompd` `cy + dy`, from
  the same `fbgui_read_mouse()`. One of them moves the pointer upside down.
- **Only the left button.** `fbgui_read_mouse()` reports button 1 only, so
  right and middle clicks never reach Wayland clients.
- **`wlcompd` gaps:**
  - The clipboard owner is recorded but never offered, so copy and paste
    between clients doesn't work.
  - Drag and drop is accepted and ignored.
  - Clients' maximize, minimize and fullscreen requests do nothing.
  - A panel's exclusive zone isn't applied (`layer_usable_area()` is never
    called).
  - Windows can't be moved to another desktop.
  - `/etc/rc.d/wlcompd` has no `wlcompd_flags`, so there's no way to pick a
    font at boot.
- **`fbcompd` robustness:**
  - It doesn't ignore `SIGPIPE`, so writing to a client that has just gone
    away can kill it.
  - It writes a log to the fixed path `/tmp/COMP`, which is unsafe when it
    runs as root.

## Found while testing the installer (November 2026)

**IDE is very slow under QEMU.** With `-machine pc` the disk is on the
emulated IDE controller (`at_wini`). There, writes run at about 270 KB/s and
reads at about 4.5 MB/s, so an install takes hours. AHCI (`-machine q35`)
writes at 12–15 MB/s. The cause hasn't been investigated. The ramdisk boots
`at_wini` with `ata_no_dma=1`, so PIO with an interrupt per sector is the first
suspect.

**Intermittent stall at boot under host load.** Booting with `-smp 2`
under KVM sometimes stops after the kernel's `BSP-pre-switch_to_user`
marker, before any server runs. It happened twice in November 2026, both
times while the host was busy (a parallel build, or another VM); the same ISO
boots in about 30 s on an idle host. `qemutest.py` already retries boots
(`--boot-retries`) because of a similar stall under TCG. Running the stalled
guest again with `--kernel` to sample the registers would show where it spins.

**The CD root mount can fail with "non-contiguous memory".** Once, on a
`q35` boot with four extra disks attached, AHCI refused an isofs transfer
(`AHCI0-D2: non-contiguous memory from <isofs>`) and `/dev/c0d2` couldn't be
mounted as root. The same ISO booted normally the next time. A buffer that
isofs hands the driver for one transfer isn't physically contiguous, and the
driver's DMA setup requires each vector element to be. Either the driver
should split such an element into several PRD entries, or the file system
should allocate its buffers contiguously.

**`hw.ncpu` reports 8 with `-smp 2`.** The CPU count in sysctl doesn't
match the number of CPUs started.

---

## Done

From the wish lists, done in this tree: job control, `mprotect` and VM page
protection, better out-of-memory handling in VM, `SA_RESTART`, `lchown`,
`lchmod`, `fchownat`, `fchmodat` and the other `*at` calls, files over 2 GB
in MFS (MFS version 4), USB mass storage on amd64, ext3/4, vfat, exFAT and
tmpfs.

Done in November 2026:

| Item | What changed |
|------|--------------|
| `dup2()` / `dup3()` as one system call | VFS `fcntl` commands `F_DUP2FD` and `F_DUP2FD_CLOEXEC`. The target descriptor is never free, so a concurrent `open()` can't take it. Test 174. |
| Atomic `pselect()`, `pollts()`/`ppoll()`, `paccept()` | New VFS call `VFS_SIGARM`. A signal caught between installing the mask and the call makes the call fail with `EINTR` instead of blocking (for `paccept()`, unless the signal is `SA_RESTART`). Test 175. |
| `SEM_UNDO` for SysV semaphores | The IPC server keeps the adjustments per process, shared by its threads, and applies them on exit. Test 88d. |
| GPT partition tables | libblockdriver reads the GPT when the MBR is only protective: up to four partitions, with the header and entry CRCs checked and a fallback to the backup header. |
| Manual pages for `wlcompd`, `wlclient`, `fbcompd`, `wlprobe` and `wlcoreprobe` | |

Done upstream before the fork: the socket API in VFS, setuid semantics, soft
faults versus partial success, grant generation numbers, the IPC information
calls, `ps(1)` through MIB, PTYs for non-root users (ptyfs), the clock on the
kinfo page, `wait4`, a single ISO 9660 partition on the install CD, objects
for several architectures from one tree, and BeagleBone Black eMMC.
