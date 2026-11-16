---
title: "Ixolo and MINIX: what is called what, and why"
source: "https://github.com/davmont/ixolo/blob/devel/docs/NAMING.md"
editUrl: "https://github.com/davmont/ixolo/blob/devel/docs/NAMING.md"
sidebar:
  order: 11
---

:::note[Generated from the source tree]
This page is a copy of [`docs/NAMING.md`](https://github.com/davmont/ixolo/blob/devel/docs/NAMING.md) on the `devel` branch.
Edit it there; `npm run sync-docs` refreshes this copy.
:::

**Ixolo** is the name of this operating system. **MINIX 3** is the name of
its kernel and of the OS interface that software sees. The relationship is
the same as macOS and Darwin: you install, boot and use Ixolo; underneath,
`uname -s` still answers `Minix`, and nothing that was built for MINIX needs
to know the difference.

This page explains why the project was renamed, what the rename changed,
what it deliberately did not change, and the rules for keeping it that way.

---

## Why rename

There are four reasons.

**MINIX 3 is no longer developed.** The last stable release was MINIX
3.3.0, in September 2014. MINIX 3.4.0 never got past release candidates and
was never tagged. The last commit to upstream `master` (`4db99f4`) is dated
14 November 2018, and it is the commit this tree forked from. Nobody is
making new MINIX 3 releases, so "MINIX 3" would describe a system that hasn't
changed in years, not this one. Ixolo continues the work under its own name
rather than speaking for a project that has stopped.

**The name MINIX is not ours to use.** This project has no rights to the
"MINIX" name, and the name has carried trademark claims by third parties
over the years. Shipping a different, independently maintained system as
"MINIX" would suggest a connection to its owners that doesn't exist, and
leave the project open to a trademark dispute. A separate name avoids both. Saying
"based on MINIX 3", as the boot banner and this documentation do, describes
where the code comes from. It doesn't put the name on our product.

**It has become a different system.** This tree started in March 2026 as
a fork of upstream MINIX 3 (base `4db99f4`, November 2018). Since then:

- **A different platform.** The headline target is x86-64 (amd64), with SMP up to 32
  CPUs, UEFI boot, SMEP/SMAP/NX, ASLR, 47-bit user address spaces and RAM above
  4 GB. Upstream MINIX 3 is a 32-bit i386/ARM system.
- **A different purpose.** Ixolo is a graphical desktop system: a Wayland
  compositor (`wlcompd`), Qt 6 and the LXQt desktop, D-Bus and GLib. Upstream
  is a text-console teaching and research OS.
- **A different toolchain and userland.** It builds with LLVM/clang and LLD
  only (GNU binutils and GCC are gone), its libc uses jemalloc, and the VM, VFS,
  MFS, libc and libpthread have hundreds of behavioural changes (MAP_SHARED,
  mprotect, mlock, tmpfs, POSIX shared memory, thread cancellation, …).
**It has a different maintainer.** This is not a release of the Stichting
MINIX Research Foundation, and they don't review or endorse it. With the name
"MINIX 3" on the boot screen, someone could easily think otherwise and report
Ixolo's bugs, or credit its changes, to the wrong project.

A separate name makes all of that clear. Keeping MINIX as the kernel's name
keeps the lineage clear, and keeps the credit with the people who built it.

---

## What the rename changed

Only text that a *person* reads:

| Where | Now says |
|-------|----------|
| Kernel boot banner | `Ixolo 0.1.0 (MINIX 3.4.0 kernel)`, then `Based on MINIX 3` and the Vrije Universiteit copyright |
| Shutdown / halt messages | `Ixolo will now be shut down …`, `Ixolo has halted …` |
| Boot menus (boot.cfg, GRUB, CD banner) | `Start Ixolo`, `Welcome to the Ixolo installation CD` |
| `setup` installer | `Welcome to the Ixolo setup script`, … |
| `/etc/motd` | Ixolo welcome text |
| `uname -v`, `sysctl kern.version` | `Ixolo 0.1.0 (Minix 3.4.0 GENERIC)` |
| `/etc/os-release` (new) | `NAME="Ixolo"`, `ID=ixolo`, `ID_LIKE=minix` |
| `/etc/release` first line | `Ixolo 0.1.0 (MINIX 3.4.0)/amd64` |
| Wayland output manufacturer (`wlcompd`) | `Ixolo` |
| GitHub repository | `davmont/ixolo` (was `davmont/minix`; GitHub redirects the old URL) |

## What it deliberately did not change

These are names that *software* reads. Changing them would break things
and gain nothing:

| Identifier | Value | Who depends on it |
|------------|-------|-------------------|
| `uname -s`, `kern.ostype` (`OS_NAME`) | `Minix` | `build.sh` host detection, every autoconf `config.guess`, Qt/CMake platform checks (`CMAKE_SYSTEM_NAME STREQUAL "Minix"`), pkgsrc |
| `uname -r` (`OS_RELEASE`) | `3.4.0` | package paths (`/packages/3.4.0/…`), `sys/conf/osrelease.sh` |
| Compiler macros | `__minix`, `__minix__` | ~440 files of `#ifdef __minix` in libc, ports and third-party code |
| Target triple | `x86_64-elf64-minix` | the cross toolchain, `external/qt6/minix-toolchain.cmake`, `external/glib/minix-cross.ini` |
| Source layout | `minix/`, `etc/rc.minix`, `minix-*` set lists | the build system; also keeps merges from upstream MINIX and NetBSD tractable |
| CD/ISO volume label | `MINIX` | `cdprobe` finds the boot CD by it |
| MBR partition type `0x81` | `MINIX` | `fdisk`, `part`, `autopart`, `setup` |
| File system | MFS (MINIX file system) | on-disk format |
| `pkg_install` `OPSYS_NAME` | `Minix` | binary package compatibility |
| Image file names | `minix_amd64.iso`, `minix_amd64_gpt.img` | CI, `qemutest.py`, the release scripts |
| Copyright and licence notices | Vrije Universiteit, BSD-3-Clause | the licence requires them |

## How software should detect Ixolo

- To ask **"is this the MINIX platform?"** (system calls, `ioctl`s, headers,
  build flags): use `__minix` at compile time and `uname -s` = `Minix` at
  run time, exactly as before. That is true for Ixolo and for upstream MINIX.
- To ask **"is this Ixolo specifically?"**: read `/etc/os-release` and check
  `ID=ixolo`. Generic code that understands `ID_LIKE` will treat Ixolo as
  `minix` automatically.
- In C, `<minix/config.h>` defines `DISTRO_NAME`, `DISTRO_ID` and
  `DISTRO_RELEASE`.

---

## Versions

Ixolo has its own version, `DISTRO_RELEASE`, starting at **0.1.0**. The
MINIX version, `OS_RELEASE` = **3.4.0**, stays as the version of the
kernel and OS interface. It changes only when that interface changes in a way
packages care about. Both appear in `uname -v` and `/etc/os-release`.

**Why 3.4.0, when MINIX 3.4.0 was never released?** The number identifies
a code base, not a finished release. Upstream `master` called itself 3.4.0
throughout the 3.4 development cycle. Every 3.4.0 release candidate, and the
commit Ixolo forked from, report `uname -r` = `3.4.0`. So "MINIX 3.4.0" is
the accurate name of the MINIX line Ixolo is built on, even though upstream
never declared it stable. The alternatives are worse: 3.3.0, the last stable
release, would misdescribe the code, and 3.5.0 or 4.0 would invent MINIX
releases that never happened. Since upstream will not bump it again, changing
`OS_RELEASE` is now Ixolo's decision. Change it only if the kernel or OS
interface changes in a way that breaks existing binaries or packages.

**0.x means "not yet usable".** Ixolo stays on 0.x while it is still being
brought up. **1.0** is the first release that is usable: something a person
can download, install and use as their system without building it from source
or working around known breakage. After that the numbers follow the usual
rule: major for incompatible changes, minor for features, patch for fixes.

Ixolo does **not** continue the MINIX numbering (3.5, 4.0, …). That would
present it as the next MINIX release, which is exactly what the rename avoids,
and it would be confused with `OS_RELEASE`, which package paths depend on.

## Where the name lives

There is one source of truth: `minix/include/minix/config.h`.

```c
#define DISTRO_NAME "Ixolo"
#define DISTRO_ID "ixolo"
#define DISTRO_RELEASE "0.1.0"

#define OS_NAME "Minix"        /* never changes: see above */
#define OS_RELEASE "3.4.0"
```

The kernel banner, `uname -v`, `wlcompd`'s `wl_output`, and the generated
`/etc/os-release` and `/etc/release` (`etc/Makefile`) all derive from it.
Text in shell scripts and boot menus says "Ixolo" literally.

> **Build note:** the kernel and servers compile against the *installed* copy
> of that header in `$DESTDIR/usr/include/minix/config.h`. After editing
> `config.h`, run `nbmake-<arch> includes` in `minix/include` or do a full
> build, or the change won't be picked up.

---

## Rules for contributors

1. **Name the system Ixolo and the kernel MINIX.** In user-facing text
   (messages, menus, man pages, documentation about using the system), say
   *Ixolo*. When you mean the kernel, the OS interface or the porting target
   ("Qt on MINIX", "MINIX's input server", "the MINIX VM server"), say
   *MINIX*. Both are correct in their place.
2. **Never rename an identifier from the table above.** If one seems to need
   changing, open an issue first.
3. **No tree-wide search-and-replace.** Change strings by hand, one category
   per commit, and boot-test the result. Keep files named `minix*` and the
   `minix/` directory where they are.
4. **Keep the credit.** Leave the Vrije Universiteit copyright, the
   "Based on MINIX 3" line and the licence notices intact.

Documents written before the rename (`docs/WAYLAND.md`, `docs/UEFI_BOOT.md`,
`docs/UPDATING`, the `external/*/README.md` porting notes, …) say "MINIX"
when they mean the platform. That is consistent with rule 1, so they don't
need rewriting.
