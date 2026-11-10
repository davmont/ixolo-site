---
title: "Frequently asked questions"
description: "Short answers about {{name}}: its relation to MINIX 3 and Linux, the name, the licence, hardware, software and where to get help."
sidebar:
  order: 4
---

## What is {{name}}, compared with MINIX 3 and Linux?

{{name}} is an independent fork of MINIX 3 for 64-bit x86 PCs. It keeps
MINIX's design: a small microkernel (about {{kernelLines}} lines of code),
with drivers, file systems and the network stack running as separate user
processes. If one of them crashes, the Reincarnation Server restarts it and
the rest of the system keeps running.

| | MINIX 3 (upstream) | {{name}} | Linux |
|---|---|---|---|
| Kernel | Microkernel | Microkernel (the same design, ported to x86-64) | Monolithic, with loadable modules |
| Drivers | User processes | User processes | Inside the kernel |
| Main target | i386, ARM | amd64 | Almost everything |
| Userland | NetBSD | NetBSD, much of it updated | GNU and others |
| Development | No commits to master since 2018 | Active | Very active |

The fork adds a 64-bit kernel, SMP (up to {{maxCpus}} CPUs), UEFI boot,
NVMe, xHCI, a journaled file system, threads and much more POSIX. Linux is
far larger and runs far more hardware and software; {{name}} trades that
for a system small enough to read and robust against driver failures. See
[the architecture](/en/docs/learn/architecture/).

## Why the new name?

The fork has grown far from upstream, and a separate name avoids confusion
with the MINIX 3 project and its releases. The axolotl regrows lost limbs;
{{name}} restarts failed drivers. The mascot, an axolotl, is called Xolo.

## Is this MINIX 3.4?

No. Upstream published release candidates of 3.4.0 (the last one in 2017)
but never a final 3.4.0. {{name}} starts from upstream's last development
tree (November 2018) and has changed a great deal since. The source tree
still reports itself as `Minix 3.4.0` in `uname` and the boot menus, because
the renaming has not reached the code yet. {{name}} is not an official MINIX
release. The [history](/en/docs/learn/history/) has the details.

## What is the licence?

The MINIX 3 code is under a BSD-style licence, copyright Vrije Universiteit
Amsterdam: you may use, change and redistribute it, in source or binary form,
if you keep the copyright notice and the disclaimer. Read the
[`LICENSE`]({{repo}}/blob/{{branch}}/LICENSE) file. Imported third-party
software keeps its own licence (NetBSD code is BSD-licensed; a few components
under `external/` and the new `igc` network driver are GPL).

{{name}} is not affiliated with or endorsed by the Vrije Universiteit or
the Stichting MINIX Research Foundation.

## Does it run on real hardware, or only in virtual machines?

Most testing happens under QEMU/KVM, and that is the recommended way to try it.
Physical machines verified so far: {{hardware}}. The drivers most likely to
work on a real PC are AHCI, IDE and NVMe storage, Intel e1000 network cards,
USB mass storage and PS/2 keyboards and mice. There is no USB keyboard
support, no Wi-Fi and no Secure Boot. The full list is in the
[hardware requirements](/en/docs/start/install/#hardware-requirements).

## Why does it need FSGSBASE?

Every thread needs a pointer to its thread-local storage. On x86-64 that
pointer lives in the FS base register, and the C library sets it with the
`WRFSBASE` instruction, which needs the CPU's `FSGSBASE` feature. Setting
the register from user space saves a system call, and requiring the feature
keeps one code path instead of two. Intel CPUs from Ivy Bridge (2012) on have
it, and so do AMD Zen CPUs. In QEMU use `-cpu host` or `-cpu max`; QEMU's
older default CPU models lack it.

## Can it run Linux programs?

Not as binaries: there is no Linux compatibility layer. Programs written for
POSIX can often be compiled for {{name}} from source. The system passes
{{posixPassed}} of the {{posixTotal}} tests of the Open POSIX Test Suite. A
program that depends on Linux-only interfaces (`epoll`, `inotify`, `/proc`
files in the Linux format, and so on) needs porting.

## Are there packages?

Not yet. There is no amd64 binary package repository; `pkg_add` is in base,
but there is nothing to fetch. What you can do today is in
[The shell and software](/en/docs/start/shell-packages/#packages).

## Is there a graphical desktop?

An experimental one: a native Wayland compositor with LXQt on Qt 6, software
rendered. It needs UEFI and is built separately; it is not in the default ISO
nor tested by CI. See [The desktop](/en/docs/admin/desktop/).

## What about i386 and ARM?

{{name}} targets amd64 only. The i386 sources are still in the tree but do not
build on `{{branch}}`, and the ARM port has not been maintained since the
fork. Neither has CI or recent work.

## Isn't MINIX the operating system inside Intel CPUs?

Intel's Management Engine (ME), a separate processor in many Intel chipsets,
runs a modified version of an older MINIX 3, which the BSD licence allows.
In an [open letter to Intel](https://www.cs.vu.nl/~ast/intel/), Andrew
Tanenbaum, MINIX's author, gives his view: Intel used an older version, one
meant mainly for teaching, and all he would have asked for was to be told.
{{name}} has nothing to do with the Intel ME. It is a separate fork, started
from the public MINIX 3 sources and developed in the open.

## Where do I get help or report a bug?

Open an issue in the [issue tracker]({{issues}}). Include the {{name}}
version or commit, how you boot it (QEMU command line or hardware), and what
you see. A serial console log helps: boot with `-serial file:boot.log` and
pick the serial console entry in the boot menu. To help with the code, see
[Contributing](/en/docs/develop/contributing/).
