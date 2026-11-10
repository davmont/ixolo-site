---
title: "Further reading"
description: "Books, papers, theses and documents about MINIX 3 and {{name}}, chosen for people who want to go deeper."
sidebar:
  order: 5
---

{{name}} inherits more than code from MINIX 3: about fifteen years of
published research at the Vrije Universiteit (VU) Amsterdam explain why
the system is built the way it is. This page is a curated selection, not a
complete list. The upstream
[publications page](https://wiki.minix3.org/doku.php?id=publications)
lists about 65 entries.

:::note[Upstream papers describe upstream MINIX]
The papers below describe MINIX 3 on 32-bit x86 (and later ARM), often a
research prototype rather than a release. The ideas apply to {{name}};
the measurements, code excerpts and some features do not. In particular,
live update is not available on {{name}}'s amd64 port.
:::

## Books

- **Andrew S. Tanenbaum and Albert S. Woodhull, *Operating Systems: Design
  and Implementation*, 3rd edition.** Prentice Hall, 2006. The textbook
  for MINIX 3.1.0, with much of the source printed and explained. The
  concepts still match {{name}}; many details have changed. The
  [Guide for teachers](/en/docs/learn/teachers/) has a table of what
  changed. Upstream publishes an
  [indexed listing of the book's source](http://www.minix3.org/documentation/AppendixB.html).
- **Andrew S. Tanenbaum and Herbert Bos, *Modern Operating Systems*,
  5th edition.** Pearson, 2022. The general operating systems textbook
  from the same group. It is not about MINIX, but it covers microkernels,
  virtual memory, file systems and multiprocessors in the same spirit.

## Overview articles

Good starting points, short and readable without a research background.

- Herder, Bos, Gras, Homburg and Tanenbaum, **"MINIX 3: A Highly Reliable,
  Self-Repairing Operating System"**. *ACM SIGOPS Operating Systems Review*
  40, July 2006, pp. 80–89.
  [PDF](http://www.minix3.org/docs/jorrit-herder/osr-jul06.pdf).
  The design of MINIX 3 in one paper: user-mode drivers, least authority,
  the reincarnation server.
- Herder, Bos, Gras, Homburg and Tanenbaum, **"Modular System Programming
  in MINIX 3"**. USENIX *;login:* 31(2), April 2006, pp. 19–28.
  [PDF](http://www.minix3.org/docs/login-2006.pdf).
- Tanenbaum, Herder and Bos, **"Can We Make Operating Systems Reliable and
  Secure?"** *IEEE Computer* 39(5), May 2006, pp. 44–51. The argument for
  microkernels and isolation, compared with other approaches.
- Tanenbaum et al., **"MINIX 3: Status Report and Current Research"**.
  USENIX *;login:* 35(3), June 2010, pp. 7–13.
  [PDF](http://www.minix3.org/docs/login-2010.pdf). A snapshot of the
  research directions halfway through the ERC project.
- Andrew S. Tanenbaum, **"Lessons Learned from 30 Years of MINIX"**.
  *Communications of the ACM* 59(3), March 2016.
  DOI [10.1145/2795228](https://doi.org/10.1145/2795228). The history of
  MINIX and Linux, and what the project learned. See also
  [History](/en/docs/learn/history/).

## Research papers

### Isolation and recovery

These are the background for [the architecture](/en/docs/learn/architecture/)
and the [break-a-driver lab](/en/docs/learn/lab-break-a-driver/).

- Herder, Bos, Gras, Homburg and Tanenbaum, **"Reorganizing UNIX for
  Reliability"**. ACSAC 2006, pp. 81–94.
  [PDF](http://www.minix3.org/docs/jorrit-herder/acsac06.pdf).
- Herder, Bos, Gras, Homburg and Tanenbaum, **"Failure Resilience for
  Device Drivers"**. DSN 2007, Edinburgh, pp. 41–50.
  [PDF](http://www.minix3.org/docs/jorrit-herder/dsn-dccs07.pdf).
  How the reincarnation server detects failed drivers and restarts them.
- Herder, Bos, Gras, Homburg and Tanenbaum, **"Countering IPC Threats in
  Multiserver Operating Systems"**. PRDC 2008, pp. 112–121.
  [PDF](http://www.minix3.org/docs/jorrit-herder/prdc08.pdf).
  How a faulty or malicious server can misuse IPC, and how to restrict it.
- Herder, Bos, Gras, Homburg and Tanenbaum, **"Fault Isolation for Device
  Drivers"**. DSN 2009, pp. 33–42.
  [PDF](http://www.minix3.org/docs/jorrit-herder/dsn-dccs09.pdf).
- Herder, van Moolenbroek, Appuswamy, Wu, Gras and Tanenbaum, **"Dealing
  with Driver Failures in the Storage Stack"**. LADC 2009, pp. 119–126
  (Best Paper Award).
  [PDF](http://www.minix3.org/docs/jorrit-herder/ladc09.pdf).
  Recovering from disk driver crashes without losing data.

### Live update

Upstream research; not available on {{name}}'s amd64 port.

- Giuffrida, Kuijsten and Tanenbaum, **"Safe and Automatic Live Update for
  Operating Systems"**. ASPLOS 2013, pp. 279–292.
  [PDF](http://www.minix3.org/docs/conf/asplos-2013.pdf).
- Giuffrida, Iorgulescu, Kuijsten and Tanenbaum, **"Back to the Future:
  Fault-tolerant Live Update with Time-traveling State Transfer"**.
  LISA 2013, pp. 89–104 (Best Student Paper Award).
  [PDF](http://www.minix3.org/docs/conf/lisa-2013.pdf).
- Giuffrida, Kuijsten and Tanenbaum, **"Enhanced Operating System Security
  Through Efficient and Fine-grained Address Space Randomization"**.
  USENIX Security 2012, pp. 40–55. Live rerandomization of OS components.

### Storage, networking and multicore

- Appuswamy, van Moolenbroek and Tanenbaum, **"Loris – A Dependable,
  Modular File-Based Storage Stack"**. PRDC 2010, pp. 165–174.
  [PDF](http://www.minix3.org/docs/loris/PRDC2010.pdf).
- Hruby, Vogt, Bos and Tanenbaum, **"Keep Net Working – On a Dependable
  and Fast Networking Stack"**. DSN 2012.
  [PDF](http://www.minix3.org/theses/dsn2012.pdf).
  A network stack split into isolated components on dedicated cores.
- Hruby, Bos and Tanenbaum, **"When Slower Is Faster: On Heterogeneous
  Multicores for Reliable Systems"**. USENIX ATC 2013, pp. 255–266.
  [PDF](http://www.minix3.org/docs/conf/atc-2013.pdf).

{{name}}'s own SMP and file system work does not follow these research
prototypes; see the design documents below.

## Theses

- Jorrit N. Herder, **"Building a Dependable Operating System"**, PhD thesis, VU Amsterdam, 2010.
  [PDF](http://www.minix3.org/theses/herder_phd_thesis.pdf).
  The most complete description of the MINIX 3 reliability design.
- Cristiano Giuffrida, **"Safe and Automatic Live Update"**, PhD thesis,
  VU Amsterdam, 2014.
  [PDF](http://www.minix3.org/theses/Cristiano_Giuffrida_PhD_thesis.pdf).
- Raja Appuswamy, **"Building a File-Based Storage Stack: Modularity and
  Flexibility in Loris"**, PhD thesis, VU Amsterdam, 2014.
  [PDF](http://www.minix3.org/theses/Raja_Appuswamy_PhD_thesis.pdf).
- Balázs Gerofi, **"Design and Implementation of the MINIX Virtual File
  System"**, master's thesis, VU Amsterdam, 2006.
  [PDF](http://www.minix3.org/theses/gerofi-minix-vfs.pdf).
  The origin of VFS.
- Björn Patrick Swift, **"User Mode Scheduling in MINIX 3"**, project
  report, 2010. [PDF](http://www.minix3.org/docs/scheduling/report.pdf).
  The origin of the SCHED server.

## Upstream MINIX 3 resources

Upstream is no longer actively developed, but its material is still
online.

| Resource | Address |
|---|---|
| Website | <https://www.minix3.org/> |
| Wiki (user and developer guides, for i386 and ARM) | <https://wiki.minix3.org/> |
| Publications list | <https://wiki.minix3.org/doku.php?id=publications> |
| Manual pages | <https://man.minix3.org/> |
| Google Group | <https://groups.google.com/g/minix3> |
| Source repository | <https://github.com/Stichting-MINIX-Research-Foundation/minix> |

Wiki pages that are still useful as background: the
[developer guide](https://wiki.minix3.org/doku.php?id=developersguide:start)
(message passing, memory grants, SEF, the kernel API) and the
[release notes of past versions](https://wiki.minix3.org/doku.php?id=releases:previous).
Commands, paths and hardware details there describe i386 and ARM, not
{{name}}.

## {{name}} design documents

These documents live in the source tree and are copied to this site. They
describe the work done in the fork.

| Document | Subject |
|---|---|
| [SMP](/en/docs/design/smp/) | Starting the other CPUs, per-CPU state, the big kernel lock |
| [UEFI boot](/en/docs/design/uefi-boot/) | The hybrid BIOS + UEFI CD and the GPT disk image |
| [MFS version 4](/en/docs/design/mfsv4/) | The new on-disk inode format |
| [MFS journaling](/en/docs/design/journal/) | Metadata write-ahead logging |
| [MFS extended attributes](/en/docs/design/xattr/) | Extended attributes stored by MFS |
| [VM reclaim](/en/docs/design/reclaim/) | Page reclaim, compressed memory and swap |
| [Wayland](/en/docs/design/wayland/) | Feasibility study for a Wayland desktop |

Some of these were written while the work was in progress, and their
status lines can lag behind the code. The pull requests in {{repo}} are
the record of what was actually merged.
