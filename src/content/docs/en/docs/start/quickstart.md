---
title: From zero to login in 15 minutes
description: Boot {{name}} in QEMU on a Linux host and reach the login prompt.
sidebar:
  order: 1
---

This guide boots the {{name}} {{version}} ISO in a QEMU virtual machine. You
need a Linux host with about 2 GB of free RAM and a few minutes. Nothing is
installed on your disk: the ISO runs live.

## 1. Install QEMU

```sh
# Debian / Ubuntu
sudo apt install qemu-system-x86 ovmf
# Fedora
sudo dnf install qemu-system-x86 edk2-ovmf
# openSUSE
sudo zypper install qemu-x86 qemu-ovmf-x86_64
```

KVM makes the guest run at close to native speed. Check that you can use it:

```sh
ls -l /dev/kvm     # must exist and be readable by your user
```

## 2. Download the ISO

Get `{{iso}}` from the [download page](/en/download/) and check it:

```sh
sha256sum {{iso}}
# expected: {{sha256}}
```

## 3. Boot it

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 \
  -cdrom {{iso}}
```

:::caution[The CPU model matters]
{{name}} on amd64 needs the `FSGSBASE` CPU feature: the C library sets up
thread-local storage with the `WRFSBASE` instruction. `-cpu host` (with KVM)
passes it through. Without KVM, use `-cpu max`, or name it explicitly with
`-cpu qemu64,+fsgsbase`. QEMU's older default models (`qemu64`, `kvm64`) lack
it, and the kernel panics early in boot with a message asking for `-cpu host`.
:::

The boot menu waits 10 seconds and then starts the first entry,
**Regular MINIX 3**. The tree still uses the upstream name in its menus and
messages.

### Boot with UEFI instead of BIOS

The ISO is hybrid: the same image boots on UEFI firmware, through GRUB. Point
QEMU at an OVMF firmware image. The path depends on your distribution:

| Distribution | OVMF image |
|---|---|
| Debian / Ubuntu | `/usr/share/OVMF/OVMF_CODE.fd` (`OVMF_CODE_4M.fd` on newer releases) |
| Fedora | `/usr/share/edk2/ovmf/OVMF_CODE.fd` |
| openSUSE | `/usr/share/qemu/ovmf-x86_64.bin` |

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/qemu/ovmf-x86_64.bin \
  -cdrom {{iso}}
```

Under UEFI the console is drawn on the firmware's framebuffer instead of VGA
text mode.

### No graphics: serial console

To use the guest from your terminal, add `-nographic`. A login runs on the
first serial port (`tty00`) as well as on the screen, so a `login:` prompt
appears in your terminal once the system is up. Under BIOS you will not see the
boot menu or the kernel messages there; to get them on the serial port too,
pick the **serial console** entry in the menu (it adds `console=tty00` to the
kernel command line). Press `Ctrl-a x` to quit QEMU.

## 4. Log in

At the `login:` prompt type `root` and press Enter. The live system has no
root password.

```text
login: root
# uname -a
```

`uname` reports `Minix 3.4.0`: the version string has not been changed yet.

## 5. See it heal

Every driver is an ordinary process. QEMU's default network card is an Intel
82540EM, so the system started the `e1000` driver for it. Kill it and watch
the Reincarnation Server (RS) bring it back:

```sh
ps -ax | grep e1000      # note the PID
kill -9 <pid>
ps -ax | grep e1000      # a new PID: RS restarted it
```

The network interface (`em0`) survives the restart: the TCP/IP server
reattaches to the new driver process and keeps its configuration. The
[break-a-driver lab](/en/docs/learn/lab-break-a-driver/) explains what
happened, step by step.

## About the desktop

The experimental LXQt desktop is built separately from the rest of the
system, and only images built with `MKDESKTOP=yes` carry it: the development
snapshots from CI do not. On an image that has it, boot with UEFI (see above),
log in and run `startlxqt`. See
[The desktop](/en/docs/admin/desktop/) for its state and how to build it.

## Next steps

- [Install to disk](/en/docs/start/install/)
- [The shell and software](/en/docs/start/shell-packages/)
- [The architecture in four layers](/en/docs/learn/architecture/)
