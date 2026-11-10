---
title: "Install to disk"
description: "Install {{name}} on a virtual or physical disk with the setup script, and what to do after the first boot."
sidebar:
  order: 2
---

The live ISO runs from read-only media: changes vanish at shutdown. To keep a
system, install it on a disk with `setup`, the installer inherited from MINIX 3,
or build a ready-made disk image from source. This page covers both, then the
first steps on the installed system.

:::caution[Read this before you start]
- **`setup` installs for BIOS boot only.** It writes an MBR partition table
  and a BIOS boot block. There is no UEFI disk install yet (see
  [BIOS and UEFI](#bios-and-uefi-disk-boot)).
- **`setup` on amd64 has a known bug.** On {{branch}} it still looks for the
  installation sets under `/i386/binary/sets`, but the amd64 ISO keeps them
  under `/amd64/binary/sets`. As shipped, it creates the file systems and then
  copies nothing. The workaround in [step 2](#2-run-setup) has not been
  verified end to end; until this is fixed, the
  [disk image built from source](#alternative-build-a-disk-image) is the
  tested way to get a system on disk.
- Installing to a physical disk erases the partition you choose. Back up first.
:::

## Hardware requirements

| | Minimum | Notes |
|---|---|---|
| CPU | x86-64 with `FSGSBASE` | Intel since Ivy Bridge (2012); AMD Zen and newer. On Linux: `grep -o fsgsbase /proc/cpuinfo`. NX, SMEP, SMAP and PCID are used when present. Up to {{maxCpus}} CPUs. |
| RAM | {{ram}} | The desktop needs more: {{ramDesktop}}. RAM above 4 GB is supported. |
| Disk | {{disk}} | One MBR primary partition; `setup` checks the size it needs. |
| Storage controller | AHCI (SATA), IDE, NVMe | The boot ramdisk picks AHCI or IDE by probing PCI. NVMe needs APIC mode, the default. `virtio_blk` is built but untested on amd64. |
| Network card | Intel e1000 family | Best tested. See [Networking](/en/docs/admin/network/) for the others. |
| USB | Mass storage only | EHCI, OHCI and xHCI controllers, also behind hubs. No USB keyboard or mouse: use PS/2 (or the emulated one in a VM). |
| Firmware | BIOS for an installed disk; BIOS or UEFI for the ISO | No Secure Boot. |

Physical machines verified so far: {{hardware}}. Most testing happens under
QEMU/KVM.

## Install in QEMU

Create a virtual disk and boot the ISO with it attached. The default QEMU
machine (`pc`) puts both on the IDE controller, which keeps device names
simple: the disk is `c0d0`, the CD `c0d2`.

```sh
qemu-img create -f qcow2 {{slug}}.qcow2 8G
qemu-system-x86_64 -enable-kvm -cpu host -m 2G \
  -drive file={{slug}}.qcow2,format=qcow2,if=ide \
  -cdrom {{iso}} -boot d
```

Log in as `root` (no password on the live system) and continue below.

### 1. Know what setup will do

`setup` is a shell script (`/bin/setup`, source in
[`minix/commands/setup/setup.sh`]({{repo}}/blob/{{branch}}/minix/commands/setup/setup.sh)).
It uses one primary partition of the disk and splits it into three
subpartitions:

| Subpartition | Mount point | Size | File system |
|---|---|---|---|
| `s0` | `/` | 128 MB | MFS |
| `s1` | `/home` | you choose (default: 20% of what is left) | MFS |
| `s2` | `/usr` | the rest | MFS |

For `c0d0p0` (first primary partition of the first disk) the root is
`/dev/c0d0p0s0`. `mkfs.mfs` now creates **MFS version 4 with a metadata
journal** by default, so a crash does not leave the file system needing a
long repair. See [File systems](/en/docs/admin/filesystems/).

### 2. Run setup

Because of the path bug above, run a corrected copy of the script. `/tmp` is
writable on the live system:

```sh
sed 's,/i386/binary/sets,/amd64/binary/sets,g' /bin/setup > /tmp/setup
sh /tmp/setup
```

Press Enter to accept a default answer. The steps are:

1. **Keyboard.** A keymap from `/usr/lib/keymaps` (default `us-std`). It is
   copied to `/etc/keymap` on the new system.
2. **Distribution.** Always the full one; nothing to choose.
3. **Partition.** Press Enter for automatic mode: `autopart` shows the disks
   and lets you pick or create a partition. Type `expert` to use the `part`
   editor yourself. After this step there is no going back.
4. **Reinstall choice.** Only if the partition already holds an installation:
   *R* keeps `/home` and rewrites the rest, *F* wipes everything.
5. **Size of `/home`** in MB. `0` means no separate `/home`.
6. **Block size**, 1 to 64 kB (default 4 kB). Keep the default.
7. **Copy files.** The sets are unpacked onto the new file systems, device
   nodes are made, the BIOS boot block is installed and `/boot.cfg` is
   generated.
8. **Network.** `setup` runs `netconf -p /mnt` to configure an interface; see
   [Networking](/en/docs/admin/network/). You can skip it and run `netconf`
   later.
9. **Root password.** Typed twice, never empty, without leading or trailing
   spaces. It is stored as a bcrypt hash (`$2a$10$…`) in
   `/etc/master.passwd`. The live media keep logging in without a password;
   the installed system does not.

A message about skipping `pkgin` at the end is expected: there is no package
repository on the ISO (see [The shell and software](/en/docs/start/shell-packages/)).

### 3. First boot

Power off, then start the VM again without the ISO:

```sh
poweroff
```

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G \
  -drive file={{slug}}.qcow2,format=qcow2,if=ide
```

The boot menu comes from `/boot.cfg`, which `update_bootcfg` builds from
`/etc/boot.cfg.default`. It has entries for the installed kernel, for single
user mode, and an *Edit menu option* to change the kernel command line. Log in
as `root` with the password you set in step 9.

## Alternative: build a disk image

If you build {{name}} from source ([Building](/en/docs/develop/building/)),
`releasetools/amd64_hdimage.sh` writes a bootable BIOS disk image without
running `setup`:

```sh
OBJ=obj.amd64 bash releasetools/amd64_hdimage.sh     # -> minix_amd64.img
qemu-system-x86_64 -enable-kvm -cpu host -m 2G \
  -drive file=minix_amd64.img,format=raw
```

The image is about 2 GB: a 128 MB root, 1.75 GB `/usr` and 128 MB `/home`.
Unlike `setup`, it puts them on three primary partitions: `/` on
`/dev/c0d0p0`, `/usr` on `c0d0p1` and `/home` on `c0d0p2`. It
carries more sets than the ISO: `minix-comp` (headers, libraries and, unless
you built with `MKLLVMCMDS=no`, the native clang), `minix-games` and the
tests. Its menu also has a *legacy PIC mode* entry for machines that do not
get along with the APIC. Root has no password on this image: set one with
`passwd` straight away.

## BIOS and UEFI disk boot

| Path | Status |
|---|---|
| ISO, BIOS | Works. |
| ISO, UEFI (GRUB) | Works, on `-machine pc` (IDE) and `-machine q35` (AHCI). |
| Disk installed by `setup`, BIOS | MBR, the `bootxx_minixfs3` boot block and the MINIX boot monitor, as on the disk image. Not verified end to end on amd64 (see the `setup` bug above). |
| Disk image from `amd64_hdimage.sh`, BIOS | Works; this is how the system has been run from a writable MFS root. Not covered by CI. |
| GPT disk image from `amd64_gptimage.sh`, UEFI | **Not usable yet.** GRUB, the kernel and the root mount work, but [`docs/UEFI_BOOT.md`]({{repo}}/blob/{{branch}}/docs/UEFI_BOOT.md) records a stall at the very end of `/etc/rc`, before the login prompt, on this image. |
| Secure Boot | Not supported. |

The kernel reads MBR partition tables, not GPT: the GPT image works through a
hybrid MBR. The design notes are in [UEFI boot](/en/docs/design/uefi-boot/).

## After the first boot

### Hostname

The name is kept in `/etc/hostname.file` (default `minix`) and set at boot:

```sh
echo mybox > /etc/hostname.file
hostname mybox
```

### Time zone

`/etc/profile` sets `TZ=GMT0` and then reads `/etc/rc.timezone` if it
exists. Put your zone there, using a name from `/usr/share/zoneinfo`:

```sh
echo 'export TZ=Europe/Madrid' > /etc/rc.timezone
```

It applies to new login shells.

### Users

Work as an ordinary user and keep `root` for administration. The NetBSD user
tools are in base:

```sh
useradd -m -G wheel alice    # -m creates /home/alice
passwd alice
```

Members of `wheel` can become root with `su`. New passwords are hashed with
bcrypt by default (`/etc/passwd.conf`).

### Network

If you skipped step 8, run `netconf` now and choose DHCP or a static address.
It writes `/etc/ifconfig.<interface>`; apply it with:

```sh
service network restart
```

Details, static addresses and IPv6: [Networking](/en/docs/admin/network/).

### SSH server

OpenSSH {{openssh}} is in base but off by default. Enable it in
`/etc/rc.conf` and start it; the host keys are generated on the first start:

```sh
echo sshd=YES >> /etc/rc.conf
service sshd start
```

`root` can only log in over SSH with a key, as in stock OpenSSH. Log in as
your user and use `su`.

### Services and file systems

Daemons are NetBSD rc.d scripts configured in `/etc/rc.conf`; system servers
and drivers are managed by RS. See [Services](/en/docs/admin/services/) and
[File systems](/en/docs/admin/filesystems/).

## Further reading

- Upstream MINIX 3 installation guide, for the history of `setup` (written for
  i386 and older releases):
  <https://wiki.minix3.org/doku.php?id=usersguide:doinginstallation>
- Upstream post-installation notes:
  <https://wiki.minix3.org/doku.php?id=usersguide:postinstallation>
