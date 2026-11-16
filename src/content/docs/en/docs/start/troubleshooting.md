---
title: Troubleshooting
description: What to do when {{name}} does not boot, install, reach the network or start the desktop, and what to send with a bug report.
sidebar:
  order: 4
---

Each section starts from what you see and points to the cause. Most of these
problems come from the machine or the virtual machine settings, not from a
bug. If none of them fits, [report it](#reporting-a-problem).

## The kernel panics right after the boot menu

```text
MINIX amd64 requires FSGSBASE (CPUID leaf 7 EBX bit 0).
Use '-cpu host' or '-cpu qemu64,+fsgsbase' in QEMU.
```

The CPU, or the CPU model the virtual machine shows, lacks the `FSGSBASE`
feature. The C library needs it to set up thread-local storage, so the kernel
stops at once instead of letting the first program crash.

- **QEMU with KVM:** add `-cpu host`.
- **QEMU without KVM:** use `-cpu max`, or `-cpu qemu64,+fsgsbase`.
- **A physical PC:** Intel processors since Ivy Bridge (2012) and AMD Zen
  and newer have it. On Linux, `grep -o fsgsbase /proc/cpuinfo` tells you.

The [FAQ](/en/docs/start/faq/#why-does-it-need-fsgsbase) explains why there
is no fallback.

## It stops during boot, before the login prompt

Boot again and watch the messages: the last one names the step that hung.
In a virtual machine without a screen, use the serial console (see
[No graphics: serial console](/en/docs/start/quickstart/#no-graphics-serial-console)).

- **The interrupt controller.** The boot entries use the APIC
  (`no_apic=0`). Some machines get along better with the old 8259 PIC: the
  disk image's menu has a **legacy PIC mode** entry. On the ISO, choose
  **Edit menu option**, then the entry's number: its command line appears
  after `>`, ready to edit, and Enter boots it. Change `no_apic=0` to
  `no_apic=1`. The change lasts for that boot only.
- **Too much output.** The ISO's **Ixolo (serial console, verbose)** entry
  sets `verbose=3`, which makes the kernel print a line for every entry into
  it. That is for kernel debugging: the boot slows to a crawl and may seem to
  hang. To read the normal boot messages on the serial port, edit that entry
  as above and remove `verbose=3`.
- **UEFI.** The development snapshot boots with BIOS only; the release ISO
  boots with both. Secure Boot is not supported: turn it off in the firmware.
  The GPT disk image for UEFI is [not usable yet](/en/docs/start/install/#bios-and-uefi-disk-boot):
  it stops at the very end of `/etc/rc`.

## The installation is very slow, or fails

- **Hours to copy the files.** QEMU's default machine (`pc`) puts the disk
  on the IDE controller, which {{name}} drives at about 270 KB/s. Use
  `-machine q35` (AHCI, 12–15 MB/s). The commands in
  [Install to disk](/en/docs/start/install/#install-in-qemu) already do.
- **`setup` copies nothing, runs out of memory, or stops after the copy.**
  Those are the failures of ISOs built before the installer fixes of
  November 2026. Use a recent ISO.
- **"The selected partition (… MB) is too small."** `setup` works out the
  space it needs from the installation sets and says how much in the next
  line. Give it a bigger partition or disk.

## It says a file system is "unclean, mounting readonly"

```text
MFS: WARNING: FS 0x... unclean, mounting readonly
```

The machine stopped without unmounting a file system that has no journal
(MFS version 3, or a version 4 too small to hold one). It is mounted
read-only so nothing makes it worse. Repair it with `fsck_mfs` and mount it
again; see [Journaling and crash recovery](/en/docs/admin/filesystems/#journaling-and-crash-recovery).
File systems made by `setup` have a journal and replay it at mount instead.

## The keyboard or the mouse does nothing

{{name}} has no USB keyboard or mouse driver: use PS/2 devices. Virtual
machines emulate PS/2 by default. On a physical PC, use a PS/2 keyboard.
Many firmwares have a "USB legacy support" option that presents a USB
keyboard as a PS/2 one; we have not tested whether {{name}} works with it.

## There is no network

Check what the system sees:

```sh
ifconfig -l      # e.g. em0 lo0
netconf -l       # hardware interfaces, and whether they are configured
```

- **No interface but `lo0`:** there is no driver for the card. In QEMU use
  an Intel e1000, the best tested one: `-nic user,model=e1000`. On `q35`
  QEMU's default card is the `e1000e`, which the driver matches but which is
  less exercised. The supported cards are listed in
  [Networking](/en/docs/admin/network/#network-cards).
- **An interface, but no address:** configure it with `netconf`, which can
  set up DHCP (`dhcpcd`) or a static address.

## A driver or service keeps restarting

The Reincarnation Server restarts a failed service and waits longer after
each failure. See which services exist and how often each has restarted:

```sh
ls /proc/service
cat /proc/service/e1000_0
```

Adding `rs_verbose=1` to the kernel options (with **Edit menu option**)
should make RS print a line starting with `RS:` for each step of a restart. [Services and the Reincarnation Server](/en/docs/admin/services/)
explains the restart policy, and
[Break a driver](/en/docs/learn/lab-break-a-driver/) shows what a healthy
recovery looks like.

## The desktop does not start

`startlxqt` needs an image built with the desktop, UEFI with a GOP
framebuffer, and PS/2 input; the development snapshots do not include it.
The [desktop page](/en/docs/admin/desktop/) lists the requirements, and its
logs are in `$XDG_RUNTIME_DIR` (`/tmp/runtime-0` for root):
`wlcompd.log` and `lxqt-session.log`.

## Reporting a problem

Open an issue in [GitHub Issues]({{issues}}) with:

- what you ran: the ISO's date or the `{{branch}}` commit you built
  (`uname -v` prints the release, and `/etc/os-release` names it);
- the machine: the QEMU command line, or the PC model, its firmware and
  whether it booted with BIOS or UEFI;
- the last messages before the problem. In QEMU, `-serial file:boot.log`
  saves what the system writes to the serial port; choose the serial
  console entry (without `verbose=3`, see above) to include the boot
  messages;
- what you expected and what happened.

Reports from physical machines are especially welcome, whether it boots or
not. For a security problem, follow [Reporting a vulnerability](/en/docs/admin/security/#reporting-a-vulnerability)
instead.
