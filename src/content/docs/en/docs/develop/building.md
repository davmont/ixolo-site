---
title: Building from source
description: Cross-build {{name}} for amd64 on a Linux host and make a bootable ISO.
sidebar:
  order: 1
---

{{name}} is cross-built on a Linux host with NetBSD's `build.sh`. One
command builds a cross toolchain (LLVM/clang {{llvm}} and `ld.lld`), then the
whole system: kernel, servers, drivers, libraries and userland. A second
command packs the result into a hybrid UEFI/BIOS ISO.

These are the same steps the CI runs on every pull request
([`ci.yml`]({{repo}}/blob/{{branch}}/.github/workflows/ci.yml)).

## Host requirements

- Linux on x86-64. Debian/Ubuntu package names:

  ```sh
  sudo apt install build-essential clang zlib1g-dev python3 git
  ```

- About 10 GB of free disk for the source tree and the object directory.
- Time: the first build compiles LLVM for the cross toolchain and can take a
  few hours. Later builds reuse it (`-u`) and only rebuild what changed.

## Get the source

```sh
git clone {{repo}}.git
cd minix
git checkout {{branch}}
```

Development happens on `{{branch}}`. That is the branch to build and to send
pull requests against.

## Build

```sh
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no release
```

| Option | Meaning |
|---|---|
| `-m amd64` | Target machine. `i386` and `evbearm` also exist; keep their object directories separate. |
| `-U` | Unprivileged build: no root needed, file ownership recorded in a metalog. |
| `-u` | Update: do not clean first; reuse the toolchain and objects. |
| `-O obj.amd64` | Object directory: everything built goes here, the source tree stays clean. |
| `-V MKLLVMCMDS=no` | Skip the on-target clang (hours of build time). Leave it out to get a native compiler inside the system. |
| `release` | Build the toolchain, the system and the installation sets. |

## Make the ISO

```sh
OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG={{iso}} \
  bash releasetools/amd64_cdimage.sh
```

The image boots on BIOS and UEFI. Test it as in the
[quickstart](/en/docs/start/quickstart/):

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -cdrom {{iso}}
```

## The desktop (optional)

The LXQt/Qt 6 desktop is built out of tree, from pinned upstream sources, and
laid over the ISO. It needs `meson`, `ninja`, `cmake`, `curl`, `patch`,
`pkg-config` and a host Qt of the same version as the target. See
[`releasetools/DESKTOP.md`]({{repo}}/blob/{{branch}}/releasetools/DESKTOP.md).

```sh
sh releasetools/build-desktop.sh
MKDESKTOP=yes OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG={{iso}} \
  bash releasetools/amd64_cdimage.sh
```

## Run the test suites

```sh
python3 releasetools/qemutest.py --iso {{iso}} --suite quick \
  --xfail releasetools/qemutest.xfail
```

See [Tests and continuous integration](/en/docs/develop/testing/).

## Common problems

- **The kernel stops early in QEMU without a message.** The guest CPU lacks
  `FSGSBASE`. Use `-cpu host` with KVM or `-cpu max` without it.
- **Odd failures after upgrading the host compiler or kernel.** The cached
  toolchain in `obj.amd64/tooldir.*` was built by the old host. Rebuild it once
  without `-u`.
- **Mixing architectures.** Never point an i386 build at an amd64 object
  directory, or the other way round.
