---
title: Building from source
description: Cross-build {{name}} for amd64 on a Linux host and make a bootable ISO or disk image.
sidebar:
  order: 1
---

{{name}} is cross-built on a Linux host with NetBSD's `build.sh`. One
command builds a cross toolchain (LLVM/clang {{llvm}} and `ld.lld`, from the
tree), then the whole system: kernel, servers, drivers, libraries and
userland. A second command packs the result into a bootable image.

The steps below are the ones the CI runs on every pull request
([`ci.yml`]({{repo}}/blob/{{branch}}/.github/workflows/ci.yml)). Where this
page and `ci.yml` disagree, `ci.yml` is right.

## Host requirements

- **Linux on x86-64.** The CI uses Ubuntu 24.04 and installs only this:

  ```sh
  sudo apt install build-essential clang zlib1g-dev python3 git
  ```

- **GRUB EFI tools, for a hybrid BIOS + UEFI ISO.** Without them the image
  script quietly makes a BIOS-only ISO (see `UEFI=` below). No `mtools` or
  `mkfs.vfat` is needed: the EFI partition is built with the tree's own
  `nbmakefs`.

  ```sh
  # Debian / Ubuntu
  sudo apt install grub-efi-amd64-bin grub-efi-ia32-bin
  # openSUSE
  sudo zypper install grub2 grub2-x86_64-efi grub2-i386-efi
  ```

- **Network access** during the first build: GNU texinfo is kept out of the
  repository for licensing reasons, and the build downloads it
  (`gnu/dist/fetch.sh`, from minix3.org with ftp.gnu.org as fallback).
- **Disk.** The object directory of a full build takes about 8 GB, plus about
  1.3 GB for the source and its git history. Plan for at least 10 GB.
- **Time.** On the CI's hosted runner (4 jobs) the cross toolchain takes about
  2 hours and the release about 2 h 15 min more. A workstation with more cores
  is faster. The toolchain is built once: later builds reuse it.

## Get the source

```sh
git clone {{repo}}.git
cd minix
git checkout {{branch}}
```

Development happens on `{{branch}}`. That is the branch to build and to send
pull requests against.

## Build

The CI builds in two steps, so that the slow toolchain can be cached
separately. You can do the same, or run only the second command, which builds
the tools first if they are missing.

```sh
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no tools
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no release
```

| Option | Meaning |
|---|---|
| `-m amd64` | Target machine. amd64 is the only one that builds on `{{branch}}` (see below). |
| `-U` | Unprivileged build: no root needed; file ownership is recorded in a metalog. |
| `-u` | Update: do not clean first; reuse the toolchain and the objects. |
| `-j N` | Parallel jobs. |
| `-O obj.amd64` | Object directory: everything built goes here and the source tree stays clean. The image scripts default to `../obj.amd64`, so pass the same path to them as `OBJ=`. |
| `-V MKLLVMCMDS=no` | Leave out the on-target clang, which costs hours of build time. The host cross compiler is not affected. Drop this option if you want a compiler inside the system: it goes into the `minix-comp` set. |
| `tools` | Build only the cross toolchain into `obj.amd64/tooldir.Linux-x86_64`. |
| `release` | Build the toolchain if needed, the system and the installation sets. |

:::note[i386 and ARM]
The tree still contains the i386 and ARM (`evbearm`) code inherited from
MINIX 3, but **i386 does not build on `{{branch}}`**: the 64-bit port grew
some IPC messages past the fixed 56-byte i386 size, and the compile-time size
checks fail. ARM has not been touched since the fork and is not tested. Only
amd64 is supported.
:::

### Kernel tuned for newer CPUs (optional)

By default the kernel is compiled for the baseline x86-64 instruction set. You
can opt in to `x86-64-v2` (POPCNT, SSE4.2, CMPXCHG16B: CPUs from about 2008
onward):

```sh
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no \
  -V KERNEL_MARCH=x86-64-v2 release
```

It only affects the kernel
([`Makefile.inc`]({{repo}}/blob/{{branch}}/minix/kernel/arch/x86_64/Makefile.inc)).
Higher levels (v3, v4) are refused on purpose: they need AVX, which the kernel
does not use.

## Make the ISO

This is the CI's command, except for `UEFI=`:

```sh
OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG=minix_amd64.iso \
  bash releasetools/amd64_cdimage.sh
```

- `CREATE_IMAGE_ONLY=1` uses what `build.sh` already built. Without it
  (the default is `0`) the script runs `build.sh ... release` itself first.
- `UEFI=auto` (the default) makes a hybrid BIOS + UEFI ISO when
  `grub-mkimage` and the GRUB EFI modules are on the host, and a BIOS-only
  ISO otherwise. `UEFI=yes` forces the hybrid image and fails if GRUB is
  missing. `UEFI=no` forces BIOS only. **The CI uses `UEFI=no`**: its runner
  has no GRUB EFI packages and its tests boot with BIOS.
- The ISO carries the `minix-base`, `minix-man` and `minix-tests` sets, so
  every image has the test suites in `/usr/tests`.

Boot it as in the [quickstart](/en/docs/start/quickstart/):

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -cdrom minix_amd64.iso
```

How the hybrid image is put together (El Torito, GRUB, Multiboot2) is in the
design document [UEFI boot](/en/docs/design/uefi-boot/).

### Other images

All of them take the same `OBJ=` and `CREATE_IMAGE_ONLY=1`:

| Script | Output | What it is |
|---|---|---|
| `releasetools/amd64_cdimage.sh` | `minix_amd64.iso` | The live and installation CD. The tested path. |
| `releasetools/amd64_hdimage.sh` | `minix_amd64.img` | A BIOS hard-disk image of about 2 GB with root, `/home` and `/usr` partitions. Besides the CD's sets it carries `minix-comp`, `minix-games` and the full NetBSD-style `tests` set. Boots in APIC mode by default. |
| `releasetools/amd64_gptimage.sh` | `minix_amd64_gpt.img` | A GPT disk image for UEFI (for example a USB stick): a FAT EFI partition with GRUB and the kernel, and an MFS root. The boot chain works; the last recorded state (June 2026, in the UEFI design document) is that startup stalls at the end of `/etc/rc`, before the login prompt. Experimental. |
| `releasetools/amd64_usbimage.sh` | `minix_amd64_usb.img` | A small BIOS image that boots with its root on a RAM disk. |

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 1G -hda minix_amd64.img
```

## Rebuilding after a change

`build.sh` with `-u` is incremental: after editing a few files, run the same
`release` command again and only what changed is rebuilt. Then cut the image
again.

For a faster compile check of one directory, use the make wrapper that
`build.sh` leaves in the tool directory. It sets the same environment as the
full build:

```sh
obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64 -C minix/servers/vm dependall
obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64 -C minix/servers/vm install
```

Run `dependall` and `install` as two separate commands: combined in one
invocation, the install step can be skipped. `install` updates the
destination directory (`obj.amd64/destdir.amd64`) but not the set tarballs the
image scripts unpack, so to get the change onto an image, run `release` (or
`build.sh ... sets`) again.

## Building inside {{name}}

The supported path is the cross-build from Linux. A build without
`MKLLVMCMDS=no` puts clang in the `minix-comp` set, and that native compiler
has been used inside the system to compile and link programs. A full rebuild
of the system from inside {{name}} has not been tested on amd64.

## The desktop (optional)

The LXQt/Qt 6 desktop is not part of a normal build. It is a set of upstream
projects (GLib, D-Bus, Qt 6, parts of KDE Frameworks, LXQt) built out of tree,
from sources pinned with checksums in `releasetools/desktop-sources.manifest`,
and installed into the destination directory. See
[`releasetools/DESKTOP.md`]({{repo}}/blob/{{branch}}/releasetools/DESKTOP.md).

Extra host packages: `meson`, `ninja`, `cmake`, `curl`, `patch`,
`pkg-config`, `sha256sum`, and **a host Qt of exactly the same version as the
target** (6.11.1), whose `moc`, `rcc` and `uic` the cross build runs.

```sh
DESTDIR=$PWD/obj.amd64/destdir.amd64 \
TOOLDIR=$PWD/obj.amd64/tooldir.Linux-x86_64 \
QT_HOST_PATH=/usr \
  sh releasetools/build-desktop.sh

OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 MKDESKTOP=yes UEFI=yes \
  IMG=minix_amd64.iso bash releasetools/amd64_cdimage.sh
```

`MKDESKTOP=yes` overlays the desktop onto the ISO. Use `UEFI=yes`: the desktop
draws on the UEFI framebuffer and does not work when booted with BIOS. The
desktop is experimental and is not built or tested by the CI. To use it, see
[The desktop](/en/docs/admin/desktop/).

## Run the tests

```sh
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite quick \
  --xfail releasetools/qemutest.xfail
```

See [Tests and continuous integration](/en/docs/develop/testing/).

## Common problems

- **The kernel panics early in QEMU with "MINIX amd64 requires FSGSBASE".**
  The guest CPU lacks `FSGSBASE`, which the amd64 kernel requires. Use `-cpu host` with KVM, or
  `-cpu max` without it. Older models such as `qemu64` and `kvm64` lack it.
- **The ISO does not boot with UEFI firmware.** It was built BIOS-only:
  `UEFI=auto` did not find the GRUB EFI tools. Install them and build with
  `UEFI=yes`, which fails loudly instead.
- **"Minix source code doesn't appear to have been built."** The image
  script was run with `CREATE_IMAGE_ONLY=1` and an `OBJ=` that holds no
  release. Check that `OBJ` is the directory you gave `build.sh -O`.
- **Odd failures after upgrading the host compiler.** The cached toolchain in
  `obj.amd64/tooldir.Linux-x86_64` was built by the old one. Rebuild it once
  without `-u`.
- **`-m i386` fails with message size assertions.** Expected: i386 does not
  build on `{{branch}}`.
