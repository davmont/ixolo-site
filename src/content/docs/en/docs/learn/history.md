---
title: "History"
description: "Forty years of MINIX, from a teaching system on floppies to the x86-64 fork that became {{name}}."
sidebar:
  order: 5
---

{{name}} is not a new operating system written from scratch. It is the
latest branch of a code base that has been taught, studied and rewritten
since 1984. Knowing that history explains a lot about the source tree: why
there are three generations of comments in some files, why the user-space
tools come from NetBSD, and why the version string still says 3.4.0.

The dates below come from the sources listed at the end of the page. Where
a date only comes from file timestamps or press coverage, the table says so.

## MINIX 1 and 2: a system for students (1984–2003)

In 1984 Andrew S. Tanenbaum, a professor at the Vrije Universiteit (VU)
in Amsterdam, began writing a UNIX-compatible system in his spare time.
AT&T's licence for UNIX Version 7 no longer allowed its source to be used
in teaching, and he wanted a system small enough for students to read
completely.

| Year | Event |
|---|---|
| 1987 | **MINIX 1** is published together with the first edition of *Operating Systems: Design and Implementation* (OSDI). It is compatible with Version 7 UNIX, runs on the IBM PC, and is sold by Prentice Hall on floppy disks with a manual. |
| by 1991 | MINIX 1.5 has been ported to the Macintosh, Amiga, Atari and SPARCstation. |
| 1991 | Linus Torvalds buys a PC to run MINIX, studies its source and posts to the `comp.os.minix` newsgroup. In August he announces there the hobby kernel that becomes Linux. Early Linux used the MINIX file system. |
| 1992 | Tanenbaum's post arguing that microkernels are the better design starts the famous microkernel-versus-monolithic debate with Torvalds on the same newsgroup. |
| 1997 | **MINIX 2**, released with the second edition of OSDI (co-written with Albert S. Woodhull), targets POSIX instead of Version 7. |
| 2000 | MINIX is relicensed under a **BSD-style licence** and can be downloaded freely. This is the licence {{name}} still uses. |

Through all this time MINIX was already a microkernel system: the file
system and memory manager ran as separate processes. The device drivers,
however, were still compiled into the kernel image.

## MINIX 3: reliability research at VU (2004–2016)

In 2004 the project changed from a teaching hobby into a funded research
project on dependable systems. A grant from the Netherlands Organisation
for Scientific Research (NWO), followed by an Academy Professorship from
the Royal Netherlands Academy of Arts and Sciences, paid for a team.
Jorrit Herder's master's work moved the drivers out of the kernel into
isolated user-mode processes, and the reincarnation server was added to
restart them when they fail. That combination, user-mode drivers plus
self-repair, is what made it "MINIX 3".

| Date | Event |
|---|---|
| Oct 2005 | MINIX 3 is announced in Tanenbaum's keynote at ACM SOSP 2005. **3.1.0**, the version described in the book, is released on 24 October. |
| 2006 | The third edition of OSDI (Tanenbaum & Woodhull) covers MINIX 3.1.0. |
| 2006–2007 | 3.1.2a (May 2006) and 3.1.3 (April 2007), which introduces VFS, splitting the old file server into a virtual file system layer and file system servers such as MFS. |
| 2008 | Tanenbaum receives a **European Research Council Advanced Grant** (no. 227874), which funds programmers, PhD students and postdocs for five years. A later ERC Proof of Concept grant (no. 297420) pays for the ARM port. |
| Jun 2009 | 3.1.4 adds **virtual memory** and the VM server. |
| 2009–2010 | 3.1.5 (Nov 2009), 3.1.6 (Feb 2010, System Event Framework), 3.1.7 (Jun 2010, **user-space scheduler**), 3.1.8 (Oct 2010, **pkgsrc and pkgin**, ext2, ACPI). |
| 2010 | Herder's PhD thesis, *Building a Dependable Operating System*. |
| **29 Feb 2012** | **3.2.0** switches to clang and the **NetBSD C library**, ELF binaries, a multithreaded VFS and the NetBSD boot loader, and adds **experimental SMP**. From here on most of the user-space tools come from NetBSD. |
| 21 Feb 2013 | **3.2.1**: shared libraries, the NetBSD `build.sh` cross-build, virtio and AHCI drivers. |
| 2014 | PhD theses by Cristiano Giuffrida (live update) and Raja Appuswamy (the Loris storage stack). |
| Sep 2014 | **3.3.0**, the first release that runs on **ARM** (BeagleBoard-xM, BeagleBone). It is also the **last stable upstream release**. |
| Jan 2016 | The tree is bumped to 3.4.0 and the first release candidate (rc1) is published. |
| Mar 2016 | Tanenbaum's article "Lessons Learned from 30 Years of MINIX" in *Communications of the ACM* states that the research funding has ended and that MINIX is becoming a community open source project. |

The research of this period (live update, fault injection, the Loris
storage stack, multicore network stacks) is listed in
[Further reading](/en/docs/reference/further-reading/).

## The long pause (2016–2025)

| Date | Event |
|---|---|
| 2016–2017 | Six release candidates of 3.4.0 appear: rc1 and rc2 in January 2016, rc3 in December 2016, rc4 in January 2017, rc5 in March 2017 and **rc6 on 9 May 2017**. These dates come from the ISO file timestamps on the download server; there are no git tags for them. **3.4.0 final was never released.** |
| late 2017 | Press reports reveal that a modified MINIX runs inside the Intel Management Engine (ME 11) on many PCs. Tanenbaum replied with an open letter: the BSD licence let Intel use it without telling him, and he would have liked to be told. |
| 14 Nov 2018 | **Last commit** on upstream `master`. |

The upstream repository has not been archived, but nothing has been merged
since 2018. The website and wiki still list 3.3.0 as the current release.
Its PC images are 32-bit only, and building the old tree with a
modern host compiler is hard.

## The 2026 fork, and {{name}}

In March 2026 David Montero ({{maintainer}}) forked the upstream repository
as `davmont/minix` on GitHub. The aim was to bring the system to 64-bit PCs
without giving up what makes it worth studying: the small kernel, the
isolated drivers and the self-repair.

| Date (2026) | Milestone |
|---|---|
| March | The fork starts with toolchain and code-health fixes and a resync of build tools with NetBSD 10. |
| late May | The **amd64 (x86-64) port boots to a login prompt**. This first port is merged into `master`. All later work happens on the `devel` branch. |
| 1–2 June | A hybrid **BIOS + UEFI** boot CD built with GRUB, and **SMP**: the other CPUs are started and scheduled (PR #157), with an IPC fast path for `sendrec`. |
| June | NVMe and USB mass-storage drivers, MSI-X interrupts, POSIX threads on amd64, and the switch to an in-tree **LLVM/clang {{llvm}}** with lld instead of GNU binutils. |
| 24–27 June | **MFS version 4** (PR #246): wider inodes, files over 2 GB, dates past 2038. Then metadata **journaling** (PRs #251–#255), extended attributes and POSIX ACLs. MFS v4 becomes the default (PR #280). |
| July | Virtual-memory work: clean-page **reclaim**, **compressed** anonymous memory and the kernel side of **swap**. lwIP is upgraded to 2.2.1. |
| 13–14 July | **wlcompd**, a Wayland compositor written for the system, and Qt 6 rendering into it. The LXQt desktop experiments run from July to September. |
| late September | A QEMU test harness runs the test suites in CI on every pull request. |
| October | POSIX work: job control, `kqueue`, message queues, POSIX file-system tests. Hardening: stack protector, `_FORTIFY_SOURCE`, SMEP/SMAP, partial ASLR, OpenSSH {{openssh}}. A 47-bit (128 TB) user address space. Real-time scheduling classes. |
| November | `tmpfs`, shared memory across `fork`, thread cancellation. The Open POSIX Test Suite reaches {{posixPassed}} of {{posixTotal}} tests passing. |
| late 2026 | The project takes the name **{{name}}**. |

Some items that upstream's roadmap still lists as future work, such as a
multicore kernel, now exist on `devel`. Some of
what upstream had does not carry over: i386 no longer builds, the ARM port
has not been touched since the fork, and the live-update feature has not
been made to work on amd64.

:::note[The name in the source tree]
The rename is happening on this website first. The source tree still says
"MINIX 3" in the boot menu, in `uname` and in the version number (3.4.0).
{{name}} is an independent derivative of MINIX 3. It is not affiliated
with or endorsed by the MINIX project or the Vrije Universiteit.
:::

To see what {{name}} looks like today, start with the
[architecture overview](/en/docs/learn/architecture/) and the
[release notes](/en/docs/reference/release-notes/).

## Sources

- A. S. Tanenbaum, "Lessons Learned from 30 Years of MINIX",
  *Communications of the ACM* 59(3), March 2016.
  DOI [10.1145/2795228](https://doi.org/10.1145/2795228). The main source
  for 1984–2016, including Linux's origins and the funding history.
- MINIX 3 wiki, release pages:
  [previous releases](https://wiki.minix3.org/doku.php?id=releases:previous),
  [3.2.0](https://wiki.minix3.org/doku.php?id=releases:3.2.0:start),
  [3.2.1](https://wiki.minix3.org/doku.php?id=releases:3.2.1:start),
  [3.3.0](https://wiki.minix3.org/doku.php?id=releases:3.3.0).
- MINIX 3 wiki, [read more](https://wiki.minix3.org/doku.php?id=www:documentation:read-more):
  background on the editions of the book.
- A. S. Tanenbaum, [An Open Letter to Intel](https://www.cs.vu.nl/~ast/intel/).
- The upstream git history: <https://github.com/Stichting-MINIX-Research-Foundation/minix>.
- The fork's history: the merge commits and pull requests on
  [{{branch}}]({{repo}}/commits/{{branch}}) in {{repo}}.
