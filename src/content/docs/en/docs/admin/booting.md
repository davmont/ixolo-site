---
title: "Booting and shutting down"
description: "The boot menus, how to change boot options for one boot or for good, the kernel parameters, single-user mode, and how to stop or restart {{name}} cleanly."
sidebar:
  order: 2
---

From power-on to the `login:` prompt, a boot goes through four stages:

1. **The firmware** starts a boot loader. With BIOS it is the boot monitor
   inherited from MINIX 3 (a NetBSD-derived loader); with UEFI it is GRUB.
2. **The boot loader** shows a menu, loads the kernel and the twelve boot
   modules, and passes the kernel a command line of `name=value` parameters.
3. **The kernel** starts the boot modules. A script on the boot RAM disk
   starts the disk driver and mounts the real root file system.
4. **`/etc/rc`** runs `/etc/rc.minix` and the scripts in `/etc/rc.d`, and
   `init` starts `getty` on the terminals.

This page is about the parts you can change: the menu, the parameters and the
way the system stops. The order in which the servers and drivers start is
explained in [Booting: who starts whom](/en/docs/learn/architecture/#booting-who-starts-whom).

## The boot menus

The menu you see depends on what you boot from.

### The ISO with BIOS

The menu comes from the `boot.cfg` written by
[`releasetools/amd64_cdimage.sh`]({{repo}}/blob/{{branch}}/releasetools/amd64_cdimage.sh):

| # | Entry | Kernel parameters |
|---|---|---|
| 1 | **Regular Ixolo** | `bootcd=1 cdproberoot=1 no_apic=0 acpi=1` |
| 2 | **Ixolo (serial console, verbose)** | the same, plus `console=tty00 verbose=3` |
| 3 | **Edit menu option** | see [below](#for-one-boot-edit-menu-option) |
| 4 | **Drop to boot prompt** | see [the boot prompt](#the-boot-prompt) |

It waits 10 seconds and then boots entry 1. While it counts down, press
Enter to boot the default at once, Space to stop the countdown, or the
number of an entry. Any other key also stops the countdown and leaves you at
an `Option: [1]:` prompt.

### The ISO with UEFI

Under UEFI firmware the release ISO starts GRUB instead, with a menu from
[`releasetools/grub.cfg`]({{repo}}/blob/{{branch}}/releasetools/grub.cfg)
that mirrors the BIOS one:

| Entry | Kernel parameters |
|---|---|
| **Regular Ixolo (UEFI)** | `bootcd=1 cdproberoot=1 no_apic=0 acpi=1` |
| **Ixolo (UEFI, serial console)** | the same, plus `console=tty00` |
| **Ixolo (UEFI, serial console, verbose)** | the same, plus `console=tty00 verbose=3` |

GRUB waits 10 seconds and boots the first entry. To change the parameters,
select an entry and press `e`: the parameters are the quoted string after
`load_minix`. How to start a UEFI boot in QEMU is in
[Boot with UEFI instead of BIOS](/en/docs/start/quickstart/#boot-with-uefi-instead-of-bios).

### An installed disk

A disk installed with `setup` boots with the BIOS boot monitor, which reads
`/boot.cfg`. You do not edit that file: `update_bootcfg` writes it from the
template
[`/etc/boot.cfg.default`]({{repo}}/blob/{{branch}}/etc/boot.cfg.default),
and `setup` runs it at the end of the installation. The entries are:

| # | Entry | Boots |
|---|---|---|
| 1 | **Start Ixolo** | the kernel in `/boot/minix_default` |
| 2 | **Start latest Ixolo** | the kernel in `/boot/minix_latest` |
| 3 | **Start latest Ixolo in single user mode** | the same, with `bootopts=-s` (see [single-user mode](#single-user-mode)) |
| 4 | **Edit menu option** | |
| 5 | **Drop to boot prompt** | |

The menu waits 5 seconds and boots entry 2. `/boot/minix_default` holds the
kernel and boot modules installed by `setup`; `/boot/minix_latest` is a
symbolic link that `setup` points at `minix_default`, so on a fresh install
entries 1 and 2 boot the same files. If `/boot/minix` holds other kernel
directories, `update_bootcfg` adds a **Start Ixolo (*name*)** entry for each.

Every entry gets `rootdevname=` set to the root device (for example
`c0d0p0s0`), followed by the values of `ahci`, `acpi`, `no_apic` and `nobeep`
that the running system was booted with, if they were set. For a fresh
install those are the values of the ISO entry you installed from, so the
installed system normally boots with `no_apic=0 acpi=1` too.

### The disk image

The BIOS disk image built by
[`releasetools/amd64_hdimage.sh`]({{repo}}/blob/{{branch}}/releasetools/amd64_hdimage.sh)
(see [Install to disk](/en/docs/start/install/#alternative-build-a-disk-image))
has its own fixed `/boot.cfg`. All its entries use `rootdevname=c0d0p0` and
`ata_no_dma=1`:

| # | Entry | Notes |
|---|---|---|
| 1 | **Start Ixolo** | `no_apic=0 acpi=1` |
| 2 | **Start latest Ixolo** | the same, from `/boot/minix_latest` |
| 3 | **Start latest Ixolo in single user mode** | adds `bootopts=-s` |
| 4 | **Start Ixolo ALIX** | console on the first serial port (`console=tty00 consdev=com0`) |
| 5 | **Start Ixolo (legacy PIC mode)** | no `no_apic`, so the kernel uses the 8259 PIC |
| 6 | **Edit menu option** | |
| 7 | **Drop to boot prompt** | |
| 8 | **Start Ixolo (*version*)** | the kernel in `/boot/minix/`*version* |

It waits 5 seconds and boots entry 2.

## Changing the boot options

### For one boot: Edit menu option

In the BIOS menu (ISO, installed disk or disk image):

1. Type the number of **Edit menu option** (3 on the ISO). The countdown
   stops and the prompt becomes `Option (edit): [1]:`.
2. Type the number of the entry you want to change. Its command line appears
   after `>`, ready to edit.
3. Change it and press Enter. The edited line runs at once.

On the ISO the line is just the `multiboot` command with the kernel and its
parameters. On an installed disk it is two commands separated by `;`: a
`load_mods` that loads the boot modules, then the `multiboot` line. Keep
both. The line can be up to 255 characters long.

The change is not saved anywhere: the next boot uses the menu as it was.

### The boot prompt

**Drop to boot prompt** leaves the menu for a `>` prompt where you type boot
loader commands yourself. `help` lists them. The useful ones:

| Command | What it does |
|---|---|
| `help` or `?` | List the commands. |
| `ls [path]` | List a directory on the boot partition, for example `ls /boot/minix_default`. |
| `load_mods <pattern>` | Load the boot modules matching a pattern, for example `/boot/minix_default/mod*`. |
| `load <path>` | Load one boot module. |
| `multiboot <kernel> [params]` | Boot the kernel with these parameters. |
| `consdev <device>` | Move the boot loader's own console: `com0` is the first serial port, `pc` the screen and keyboard. |
| `menu` | Go back to the menu. |
| `quit` | Restart the machine. |

To boot an installed disk by hand, type the two halves of a menu entry as two
commands. A line at this prompt can be at most 79 characters long:

```text
> load_mods /boot/minix_default/mod*
> multiboot /boot/minix_default/kernel rootdevname=c0d0p0s0 no_apic=1
```

On the ISO the boot modules are already loaded, so the `multiboot` line is
enough:

```text
> multiboot /boot/minix_default/kernel bootcd=1 cdproberoot=1 no_apic=0
```

### Permanently: update_bootcfg

To change the menu of an installed system for good, edit the template and
rebuild `/boot.cfg`:

```sh
vi /etc/boot.cfg.default
update_bootcfg
```

To add entries without touching the default ones, put them in
`/etc/boot.cfg.local` instead, in the same format. `update_bootcfg` appends
them after the others; a `default=` line there counts from the first local
entry. In the templates, `$rootdevname` is replaced by the root device and
`$args` by the inherited parameters described above. Changes made directly to
`/boot.cfg` are lost the next time `update_bootcfg` runs. The full reference
is `man update_bootcfg`.

:::caution
`update_bootcfg` copies `ahci`, `acpi`, `no_apic` and `nobeep` from the
running system into every entry. If you booted once with `no_apic=1` and run
`update_bootcfg` in that session, every entry keeps `no_apic=1` from then on.
:::

## Boot parameters

These are the parameters you are most likely to need. Add them to the
kernel line with **Edit menu option**, at the boot prompt or in GRUB. Once
the system is up, `sysenv` prints the ones it was booted with, and
`sysenv <name>` prints one.

| Parameter | What it does | When absent |
|---|---|---|
| `no_apic` | `0` uses the APIC, which is needed for more than one CPU and for NVMe disks. `1` uses the old 8259 PIC and a single CPU. | `1` (PIC). The shipped menus set `0`, except the legacy PIC entry. |
| `no_smp` | `1` uses only the first CPU, while keeping the APIC. | `0` |
| `acpi` | The menus set `acpi=1`. On amd64 the ACPI driver is started whether it is set or not. | |
| `console` | `tty00` makes the first serial port the system console (`tty01` the second, and so on). | The screen |
| `verbose` | Kernel messages at boot, from `0` (quiet) to `3` (maximum). From `2` on, the boot scripts also print `RDRC:` and `RCMINIX:` progress lines. `3` prints a line for every entry into the kernel: it floods the console and makes the boot crawl, and is only for kernel debugging. | `0` |
| `rs_verbose` | `1` makes the Reincarnation Server report what it does, for example each step of a service restart. | `0` |
| `bootcd` | Marks a boot from the live CD: `/etc/rc.minix` then runs `/etc/rc.cd` to set up RAM disks. Set by the ISO entries. | |
| `cdproberoot` | Look for the root file system on the CD drives (`cdprobe`) instead of using `rootdevname`. Set by the ISO entries. | |
| `rootdevname` | The device holding the root file system, without `/dev/`, for example `c0d0p0s0`. | The boot stops with `rootdevname not set`, unless `cdproberoot` is set. |
| `ahci` | `yes` or `no`: use, or do not use, the AHCI driver for the boot disk, instead of probing the PCI bus. | Probed |
| `nvme` | `yes` or `no`, the same for an NVMe controller. | Probed |
| `ata_no_dma` | `1` makes the IDE driver (`at_wini`) work without DMA. The disk image sets it. | `0` |
| `hirestime` | `0` stops programs from reading the time off the processor's time stamp counter between clock ticks. | On, when the counter runs at a constant rate or under a hypervisor |
| `nobeep` | `1` silences the console bell. | `0` |

## Single-user mode

In single-user mode `/etc/rc.minix` stops after checking and mounting the
file systems in `/etc/fstab`, before the network and any daemon are started,
and gives you a root shell on the console with this message:

```text
Single user. Press ^D to resume multiuser startup.
```

It is for repairs that need the system quiet, with nothing else running:
for example, undoing a change in `/etc/rc.conf` that stops the boot. Press
Ctrl-D and the boot carries on as normal.

:::caution[The menu entry does not work yet]
The **single user mode** entries pass `bootopts=-s`, but `/etc/rc.minix`
reads a parameter called `bootopt`, without the final `s`, so in the current
source those entries boot normally. Until the fix
([#506]({{repo}}/pull/506)) is in your system, use **Edit menu option** and
add `bootopt=-s` to the kernel line; that has been tested on the live ISO.
:::

## Serial console

Running {{name}} without a screen, with the console on a serial port, is
covered in [No graphics: serial console](/en/docs/start/quickstart/#no-graphics-serial-console).
In short: `console=tty00` moves the console to the first serial port, and the
ISO's serial console entries add it for you.

## Shutting down and rebooting

Always stop the system with one of these commands, as `root`:

| Command | What it does |
|---|---|
| `shutdown -p now` | Run the shutdown scripts, then switch the machine off. |
| `shutdown -h now` | Run the shutdown scripts, then halt without switching off. |
| `shutdown -r now` | Run the shutdown scripts, then restart. |
| `poweroff` | Switch off at once, without the shutdown scripts. |
| `halt` | Halt at once, without the shutdown scripts. |
| `reboot` | Restart at once, without the shutdown scripts. |

Instead of `now`, `shutdown` takes `+`*minutes* or a time such as `23:30`,
and an optional message that it sends to logged-in users. In the last five
minutes before the time, new logins are refused. See `man shutdown`.

What happens:

1. **Only with `shutdown`:** it runs `/etc/rc.shutdown`, which calls the
   scripts in `/etc/rc.d` that have the `shutdown` keyword with `stop`, in
   reverse order. Among them are `inetd`, `ftpd`, the network interfaces, the
   desktop compositors, and `minixrc`, which stops `devmand` and `usbd` and
   tells the Reincarnation Server that the system is going down, so it does
   not restart anything. Then `shutdown` runs `halt` or `reboot`.
2. `halt`, `reboot` or `poweroff` flushes the disk buffers, sends `SIGTERM`
   to every process, waits five seconds and flushes them again.
3. The process manager (PM) kills what is left, and the virtual file system
   server (VFS) flushes and unmounts every file system.
4. The kernel prints `Ixolo has halted and will now power off.`,
   `Ixolo has halted. It is safe to turn off your computer.` or
   `Ixolo will now reset.`, and does it. To switch off it tries ACPI first.

Daemons without the `shutdown` keyword, such as `sshd` or `syslogd`, are not
stopped by a script; they get the `SIGTERM` of step 2.

If the power goes or the machine is reset without any of this, file systems
are left unclean. MFS version 4 replays its journal at the next mount; file
systems without a journal are mounted read-only until you repair them. See
[Journaling and crash recovery](/en/docs/admin/filesystems/#journaling-and-crash-recovery).

### Ctrl-Alt-Del

On the text console, Ctrl-Alt-Del (or Ctrl-Alt-Insert) asks `init` to run
`shutdown -r now`, a clean restart. Pressing it a third time resets the
machine at once, without flushing the disks.

## Other operating systems on the same disk

Dual boot has not been tested. What the installer does: on a disk with no
valid partition table, the partition editor writes the boot code
`/usr/mdec/mbr`, which starts the active partition, and makes the new
partition active. On a disk that already has one, it keeps the existing boot
code and does not change which partition is active. `setup` itself only
writes a boot block at the start of the {{name}} partition, so another boot
manager would have to start that partition.

## Further reading

- [Troubleshooting](/en/docs/start/troubleshooting/): a boot that stops, a
  kernel panic, unclean file systems.
- [Install to disk](/en/docs/start/install/), including
  [BIOS and UEFI disk boot](/en/docs/start/install/#bios-and-uefi-disk-boot).
- [UEFI boot](/en/docs/design/uefi-boot/): how the hybrid ISO and GRUB work.
- `man update_bootcfg`, `man shutdown`, `man reboot`, `man sysenv`.
