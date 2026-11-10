---
title: "The shell and software"
description: "Everyday use: the shell and job control, the NetBSD userland, what ships in base, and the state of packages."
sidebar:
  order: 3
---

{{name}} feels like a small BSD system. The shell, the commands and most
libraries come from NetBSD; the kernel, servers and drivers underneath are
MINIX's. This page covers what you get after logging in, and what you can and
cannot install today.

## The shell

`/bin/sh` is NetBSD's `sh` (an Almquist shell). It is the login shell of
`root` and the default for new users.

It has **job control** since PR #404, once the kernel and process manager
gained sessions, process groups and terminal foreground groups. Interactive
shells put each pipeline in its own process group, so the usual keys and
commands work:

```sh
sleep 100          # press Ctrl-Z
jobs               # [1] + Stopped  sleep 100
bg %1              # let it run in the background
fg                 # bring it back; Ctrl-C ends it
```

Two more shells are in base and listed in `/etc/shells`:

| Shell | Path | Notes |
|---|---|---|
| sh | `/bin/sh` | Default. POSIX shell with job control and command-line editing (`set -o emacs` or `set -o vi`). |
| ksh | `/bin/ksh` | NetBSD's public-domain Korn shell. |
| csh | `/bin/csh` | The BSD C shell. |

Change a user's shell with `chsh` (or `usermod -s /bin/ksh alice`). There is
no bash or zsh in base.

## The userland

The commands are NetBSD's. Most arrived with upstream MINIX's resync with
NetBSD in 2015; several have since been updated from NetBSD 10 or NetBSD-current.
NetBSD's manual pages describe them closely. Manual pages ship on the ISO and
in the installed system: `man ls`, `apropos socket`.

A few things are MINIX's own and have no NetBSD equivalent:

| Command | What it does |
|---|---|
| `minix-service` | Start, stop, restart and update system services (servers and drivers) through RS. See [Services](/en/docs/admin/services/). |
| `setup`, `netconf` | The installer and the network configuration tool. |
| `mined` | A small full-screen editor from classic MINIX. |
| `free` | Total, used and free physical memory, and the buffer cache. |

`service` (without `minix-`) is NetBSD's, and runs the rc.d scripts:
`service sshd start`.

## What ships in base

Everything below is built from the source tree and installed with the system
(the `minix-base` set). Versions are from
[`docs/THIRD_PARTY.md`]({{repo}}/blob/{{branch}}/docs/THIRD_PARTY.md) and the
vendored sources.

| Area | Software |
|---|---|
| Editors and terminal | `vi` (nvi), `ed`, `mined`, `less` 668, `tmux` 3.6a |
| Network | OpenSSH {{openssh}}, dhcpcd 10.3.1, BIND 9.20.24 tools (`dig`, `host`, `nslookup`; `named` off by default), `ftp` (with HTTPS), `telnet`, `tcpdump` 4.99.6 |
| Security | OpenSSL 3.5.7 LTS, Mozilla CA certificates with `certctl`, Heimdal 7.8 (Kerberos) |
| Data and scripting | `sqlite3` 3.53.3, Lua 5.4.8, `awk`, `sed`, `make` (BSD make) |
| Archives | `tar`, `pax`, `cpio`, `gzip`, `bzip2` 1.0.8, `xz` 5.8.3, `unzip`, libarchive 3.8.8 |
| Libraries | zlib 1.3.1, expat 2.8.2, libevent 2.1.13, `libpthread`; libuv 1.52.1 as a static library in `minix-comp` |
| Time | tz 2026a |

Not in base: Perl, Python, git, curl, a debugger (no gdb or lldb), and X11
(removed from the tree).

### The compiler

The toolchain is LLVM/clang {{llvm}} with `ld.lld`; GCC and GNU binutils are
gone. Whether you have a compiler inside the system depends on how it was
installed:

- The **ISO** and a system installed from it with `setup` have **no
  compiler**: the ISO carries the `minix-base`, `minix-man` and `minix-tests`
  sets, not `minix-comp`.
- A **disk image** built from source with `releasetools/amd64_hdimage.sh`
  includes `minix-comp`: headers, libraries and, if the build did not use
  `-V MKLLVMCMDS=no`, the native `clang`/`cc`. Building that native compiler
  adds hours to the build, which is why the CI skips it.

## Packages

Upstream MINIX 3 distributed binary packages built from its fork of pkgsrc,
installed with `pkgin`. **{{name}} has no amd64 package repository yet.** The
upstream packages are for i386 and an older ABI; they do not run here.

What exists today:

- `pkg_add`, `pkg_info`, `pkg_delete` and `pkg_create` (NetBSD's
  `pkg_install`) are in base. They install, list and remove binary package
  files you already have, but there is no repository to fetch them from.
- `pkgin` itself is not in base. The helper scripts `pkgin_cd`, `pkgin_all`
  and `pkgin_sets` are inherited from upstream and expect a package
  collection that does not exist for amd64.
- `/usr/Makefile` still points at upstream's pkgsrc repository on
  `git.minix3.org`. It is upstream's and does not apply to {{name}}.

So, to get software that is not in base today:

1. **Add it to the source tree** and build it with the system, the way
   everything in base is built (NetBSD-style reachover Makefiles). See
   [Building from source](/en/docs/develop/building/) and
   [Contributing](/en/docs/develop/contributing/).
2. **Compile it inside the system** with the native clang, on an image that
   has it (see above). Simple programs with a plain `Makefile` or `configure`
   script are the best candidates; anything that needs Linux interfaces will
   need porting.

A pkgsrc port for amd64, with a binary repository, is on the roadmap. It does
not exist yet, and there is no date for it.

## Further reading

- NetBSD manual pages: <https://man.netbsd.org/>
- Upstream MINIX 3 package guide (i386 and old releases only):
  <https://wiki.minix3.org/doku.php?id=usersguide:installingbinarypackages>
