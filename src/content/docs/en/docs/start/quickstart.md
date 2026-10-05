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
{{name}} on amd64 needs the `FSGSBASE` CPU feature for thread-local storage.
`-cpu host` (with KVM) passes it through. Without KVM use `-cpu max`.
Older models such as `-cpu kvm64` or `qemu64` lack it, and the kernel stops
early in boot without a message.
:::

### Boot with UEFI instead of BIOS

The ISO is hybrid: the same image boots on UEFI firmware. Point QEMU at an
OVMF image (the path depends on your distribution):

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/qemu/ovmf-x86_64.bin \
  -cdrom {{iso}}
```

### Try the desktop (experimental)

The Wayland desktop needs the UEFI framebuffer, so boot with OVMF as above
and, once logged in, run:

```sh
startlxqt
```

### No graphics: serial console

To run the guest in your terminal, add `-nographic`. The ISO starts a login on
the first serial port as well as on the screen.

## 4. Log in

At the `login:` prompt type `root` and press Enter. The live system has no
root password.

```text
login: root
# uname -a
```

## 5. See it heal

Every driver is an ordinary process. Kill the network driver and watch the
Reincarnation Server bring it back:

```sh
ps -ax | grep e1000      # QEMU's default network card
kill -9 <pid>
ps -ax | grep e1000      # new PID: it was restarted
```

The [break-a-driver lab](/en/docs/learn/lab-break-a-driver/) explains what
happened, step by step.

## Next steps

- [Install to disk](/en/docs/start/install/)
- [The shell and pkgsrc packages](/en/docs/start/shell-packages/)
- [The architecture in four layers](/en/docs/learn/architecture/)
