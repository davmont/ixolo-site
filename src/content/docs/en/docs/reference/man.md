---
title: "Manual pages"
description: "The manual pages that ship with {{name}}, what each section holds, and the pages specific to it."
sidebar:
  order: 1
---

{{name}} ships its manual pages on the system itself. Type `man` at the shell.
There is no HTML copy on this site yet. This page tells you what is installed,
where the pages that matter for {{name}} live, and where to look when a page
is missing.

## Reading pages on the system

The pages come in the `minix-man` installation set and live under `/usr/man`.
The ISO has carried that set since June 2026
([PR #165]({{repo}}/pull/165)). Before then `man` found nothing on the live
CD. `setup` extracts every set on the CD, so an installed system has the
pages too (with the workaround for its
[amd64 path bug](/en/docs/start/install/)).

```sh
man ls                 # a page, from the first section that has it
man 8 minix-service    # a page from a given section
man -k filesystem      # search names and descriptions (same as apropos)
whatis tmpfs           # one-line description
```

`man -k`, `apropos` and `whatis` read the database `/usr/man/whatis.db`,
which the build generates. If you add pages by hand, rebuild it with
`makewhatis /usr/man`. Pages are formatted by `mandoc`; the rules are in
[`/etc/man.conf`]({{repo}}/blob/{{branch}}/etc/man.conf).

## The sections

| Section | Holds | Pages in `minix-man` |
|---|---|---|
| 1 | User commands: `ls`, `sh`, `ssh`, `free` | about 410 |
| 2 | System calls | 86 |
| 3 | Library functions, including libc, curses and OpenSSL | about 3,300 |
| 4 | Devices and drivers | 18 |
| 5 | File formats: `fstab`, `rc.conf`, `system.conf`, `boot.cfg` | 66 |
| 6 | Games | 25 |
| 7 | Miscellany: `hier`, `man`, `pkgsrc` | 31 |
| 8 | System administration: `setup`, `minix-service`, `ifconfig` | about 160 |
| 9 | Kernel interfaces | 6 |

The counts come from the set list
[`distrib/sets/lists/minix-man/mi`]({{repo}}/blob/{{branch}}/distrib/sets/lists/minix-man/mi)
on `{{branch}}`. Most of section 3 is OpenSSL's API.

:::caution[Sections 2 and 3 have gaps]
Section 2 mostly holds MINIX's own older pages (`open`, `read`, `fork`,
`select`, `svrctl`...). Many NetBSD pages for calls that {{name}} does
implement are not installed: there is no `kqueue(2)`, `mmap(2)`, `poll(2)`
or `stat(2)`, and no pages for `pthread_create(3)`, `sem_open(3)`,
`mq_open(3)` or `aio_read(3)`. For those, use NetBSD's online pages (below)
and the [system call reference](/en/docs/reference/syscalls/).
:::

## Pages specific to {{name}}

Most commands and libraries come from NetBSD and keep NetBSD's pages. The
pages below describe parts that are MINIX's own, or new in {{name}}. Each one
links to its source in the tree.

### Services and boot

| Page | What it covers |
|---|---|
| [`minix-service(8)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/minix-service.8) | Start, stop, restart, refresh and update system services (servers and drivers) through the reincarnation server (RS). |
| [`system.conf(5)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/system.conf.5) | `/etc/system.conf`: what each service may do (IPC targets, kernel calls, I/O ports, IRQs). |
| [`service(8)`]({{repo}}/blob/{{branch}}/usr.sbin/service/service.8) | Not the same thing: NetBSD's tool to run `/etc/rc.d` scripts. |
| [`boot.cfg(5)`]({{repo}}/blob/{{branch}}/minix/man/man5/boot.cfg.5) | The boot menu file read by the BIOS boot loader. |
| [`update_bootcfg(8)`]({{repo}}/blob/{{branch}}/minix/commands/update_bootcfg/update_bootcfg.8) | Regenerate the boot menu configuration. |
| [`sysenv(1)`]({{repo}}/blob/{{branch}}/minix/commands/sysenv/sysenv.1) | Read the boot parameters the kernel was started with. |
| [`svrctl(1)`]({{repo}}/blob/{{branch}}/minix/commands/svrctl/svrctl.1), [`svrctl(2)`]({{repo}}/blob/{{branch}}/minix/man/man2/svrctl.2) | Special control calls to PM and VFS. |

The [services guide](/en/docs/admin/services/) shows these in use.

### Installation, disks and file systems

| Page | What it covers |
|---|---|
| [`setup(8)`]({{repo}}/blob/{{branch}}/minix/commands/setup/setup.8) | The installer. The page is old: it still talks about Pentiums, 16 MB of RAM and IDE-only disks. The [install guide](/en/docs/start/install/) is current. |
| [`mkfs.mfs(1)`]({{repo}}/blob/{{branch}}/minix/usr.sbin/mkfs.mfs/v3/mkfs.mfs.1) | Create an MFS file system. MFS version 4 with a journal is the default; `-3` makes the old version 3. |
| [`fsck.mfs(1)`]({{repo}}/blob/{{branch}}/minix/commands/fsck.mfs/fsck.mfs.1) | Check and repair MFS. |
| [`tmpfs(8)`]({{repo}}/blob/{{branch}}/minix/fs/tmpfs/tmpfs.8) | The in-memory file system: `mount -t tmpfs`, the `size=` and `nr_inodes=` options, and its use for POSIX shared memory on `/var/shm`. New in {{name}}. |
| [`part(8)`]({{repo}}/blob/{{branch}}/minix/commands/part/part.8), [`autopart(8)`]({{repo}}/blob/{{branch}}/minix/commands/autopart/autopart.8) | Partition editors used by `setup`. |
| [`btrace(8)`]({{repo}}/blob/{{branch}}/minix/usr.sbin/btrace/btrace.8) | Block-level I/O tracing. |
| [`fbdctl(8)`]({{repo}}/blob/{{branch}}/minix/usr.sbin/fbdctl/fbdctl.8) | Rules for the faulty block device, a driver that injects disk errors for testing. |

See also the [file systems guide](/en/docs/admin/filesystems/).

### Network and security

| Page | What it covers |
|---|---|
| [`netconf(8)`]({{repo}}/blob/{{branch}}/minix/commands/netconf/netconf.8) | Configure the network interactively; writes `/etc/ifconfig.<if>`. |
| [`unix(8)`]({{repo}}/blob/{{branch}}/minix/net/uds/unix.8) | The UNIX domain socket service (UDS). |
| [`certctl(8)`]({{repo}}/blob/{{branch}}/usr.sbin/certctl/certctl.8) | Manage the TLS trust anchors in `/etc/openssl/certs`. Imported from NetBSD-current. |

### Inspecting the system

| Page | What it covers |
|---|---|
| [`free(1)`]({{repo}}/blob/{{branch}}/minix/usr.bin/free/free.1) | Free and used physical memory. New in {{name}}. |
| [`lspci(1)`]({{repo}}/blob/{{branch}}/minix/commands/lspci/lspci.1) | List PCI devices. |
| [`trace(1)`]({{repo}}/blob/{{branch}}/minix/usr.bin/trace/trace.1) | Print a process's system calls and signals. It uses `ptrace(2)`, which still has known failures on amd64 (test 42). |
| [`hier(7)`]({{repo}}/blob/{{branch}}/minix/man/man7/hier.7) | The file system layout. |

## NetBSD's pages as a reference

Most of the userland and libc come from NetBSD, at different versions: some
parts were resynced to NetBSD 10, others come from NetBSD-current, and a few
are older. When a page is missing here, NetBSD's online manual is the next
best source:

- <https://man.netbsd.org/> (for example
  <https://man.netbsd.org/kqueue.2>)

Treat those pages as a guide, not a contract. The kernel, the servers and
much of the system call layer are MINIX's own, so behaviour can differ. Two
examples: `kqueue(2)` here supports the read, write, vnode, timer and user
filters but not the signal, process and AIO filters; and `mlock(2)` checks
its arguments but does not pin pages. When in doubt, the
[system call reference](/en/docs/reference/syscalls/) and the
[POSIX page](/en/docs/reference/posix/) say what {{name}} does, and the
source is the final word.

:::note[No web version yet]
A browsable HTML copy of these pages, generated from the tree, is not
available on this site. Until it is, read them with `man` on the system or
open the source files linked above.
:::
