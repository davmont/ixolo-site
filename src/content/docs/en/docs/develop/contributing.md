---
title: "Contributing and code style"
description: "How to send a change to {{name}}: branches, pull requests, commit messages, code style, ABI rules, licences and third-party code."
sidebar:
  order: 4
---

{{name}} is developed in the open at [{{repo}}]({{repo}}). Changes arrive as
pull requests against `{{branch}}`, each one tested by the CI before it is
merged. This page describes how the project actually works today, as seen in
its history, so that your change fits in.

## Before you start

Talk first about anything large: a new subsystem, an ABI change, a new
third-party package, a change of policy. Use {{issues}}. A short description
of the problem and the plan saves you from writing code in a direction the
project will not take.

For small fixes, just send the pull request.

## Fork, branch, pull request

1. Fork the repository on GitHub and clone your fork.
2. Branch from `{{branch}}`. Branch names in the history follow the kind of
   change: `fix/vfs-sticky-mountpoint`, `feat/tmpfs`, `test/aio-error-flaky`.
3. Build and test locally ([Building from source](/en/docs/develop/building/),
   [Tests and continuous integration](/en/docs/develop/testing/)). At least
   the `quick` suite; `pjdfstest` if you touched a file system or VFS; the Open
   POSIX Test Suite if you touched libc, PM, VFS, VM, signals or threads (it
   is not in the CI).
4. Open the pull request **against `{{branch}}`**. GitHub may offer `master`
   as the base: change it.
5. The CI must pass: the build and the eight test jobs, on 1 and 2 CPUs. A
   test that starts passing (XPASS) also fails the run, so remove it from the
   known-failure list in the same pull request.

One pull request does one thing. A fix found on the way goes in its own
commit, or in its own pull request if it is unrelated.

### Add a test

A fix comes with a test that fails before it and passes after, when that is
possible. In-tree tests live in
[`minix/tests/`]({{repo}}/blob/{{branch}}/minix/tests/) as `testNNN.c`. A new
one is wired in four places, as `test168` was:

- `minix/tests/Makefile` (build it),
- `minix/tests/run` (run it),
- `distrib/sets/lists/minix-tests/mi` (ship it),
- `QUICK_TESTS` in `releasetools/qemutest.py`, if it is fast and needs no
  network (so the CI runs it).

## Commit messages

The history has a consistent style. Read a few commits with `git log` before
writing yours.

**Subject line**: the subsystems touched, a colon, then what is now true or
what was wrong, in plain words. No trailing full stop.

```
vm: MAP_SHARED anonymous memory is shared across fork
pm, libc: _lwp_detach(2), so that pthread_detach(3) detaches
vfs: rmdir(2) or rename(2) of a mount point under a sticky root panicked
kernel/amd64: boot with RAM above 4 GB (nested pagefault in kmain)
qemutest-posix.xfail: aio_error/2-1 is flaky
```

The prefix is the directory or component (`kernel`, `kernel/amd64`, `vm`,
`pm`, `vfs`, `libc`, `libpthread`, `mfs`, `releasetools`, `build`...),
several separated by commas when a change crosses them.

**Body**, wrapped at about 72 columns:

- **What was broken**, as the user or the program saw it.
- **Why**: the cause, in enough detail that a reviewer can check the fix
  against it.
- **What changed**, including anything done on the way.
- **ABI**, in its own paragraph, if message layouts or call numbers changed.
- **How it was validated**: which suites, on how many CPUs, with what result,
  and which new test covers it. For example:

```
New test166 covers these.

Validated:
- Quick suite: 139 passed, 0 failed except test166 on smp1 and smp2.
- POSIX smp2: 1614 passed.  The only failures were the 12 XPASSes now
  removed from the xfail list.
```

Write for someone reading the log in two years. "Fix bug" or "update" tells
them nothing.

## Code style

There is no separate style guide in the tree. The rules are:

- **Follow the style of the file you are editing.** Code from NetBSD uses
  NetBSD's KNF (Kernel Normal Form: tabs, function names at the start of the
  line, a comment block before each function). The MINIX servers and drivers
  have their own older layout. Do not reformat code you are not changing: it
  hides the real diff.
- For a new file, KNF as described in NetBSD's
  [`style`](https://github.com/NetBSD/src/blob/trunk/share/misc/style) guide
  is a safe default.
- Prefer `strlcpy`/`strlcat` to `strcpy`/`strcat`, and `snprintf` to
  `sprintf`.
- For a security fix, name the relevant CWE in the commit message.
- Keep `__minix` guards in code imported from elsewhere: they mark what had to
  change for {{name}}.

## ABI rules

Servers, drivers and libc talk through fixed-size messages, defined in
[`minix/include/minix/ipc.h`]({{repo}}/blob/{{branch}}/minix/include/minix/ipc.h).
Each message type is followed by an assertion that checks its size at
compile time:

```c
_ASSERT_MSG_SIZE(mess_lc_vfs_pathat);
```

On amd64 the payload may be at most 96 bytes. (On i386 it had to be exactly
56, which is why i386 no longer builds.) If your new field does not fit, the
build fails: that is the point.

When you change a message layout or a call number:

- **Every program must be rebuilt.** That includes the statically linked
  desktop programs, which `releasetools/devtools/relink_desktop.sh` relinks.
- **Never reuse a call number.** When the `*at()` system calls replaced the
  old path calls, the old numbers were left empty, so a binary built before
  the change gets `ENOSYS` instead of misreading a message.
- **Addresses go in 64-bit fields.** User space now reaches 128 TB; a user
  address in an `int` field breaks above 2 GB.
- **Say so in the commit message**, in an "ABI." paragraph that lists the
  messages and calls changed and the programs reviewed.

## Licences

- The base system is under the BSD-style MINIX licence
  ([`LICENSE`]({{repo}}/blob/{{branch}}/LICENSE)), and code from NetBSD under
  its BSD licences. New code you write for the base system should be under the
  same terms.
- Third-party code lives under `external/`, grouped by licence
  (`external/bsd`, `external/mit`, `external/apache2`, `external/mpl`,
  `external/lgpl2`, ...), so the licence of every file is clear from its path.
- **GPL code is kept to a minimum.** Today there are three cases. The
  `igc` network driver
  ([`minix/drivers/net/igc`]({{repo}}/blob/{{branch}}/minix/drivers/net/igc/)),
  based on Linux's, is GPL-2.0 and is built and shipped in the base system
  (`/service/igc`). The Open POSIX Test Suite in
  `external/gpl2/open_posix_testsuite` is used for testing only and is never
  built by the release. GNU texinfo 4.8 is not in the repository at all: the
  build downloads it (`gnu/dist/fetch.sh`) and ships `info`, `makeinfo` and
  `install-info` in the `minix-comp` set. `external/gpl3` contains no code.
  Some imported code offers the GPL as one of two licences (ACPICA, in the
  ACPI driver, for example). If a change seems to need more GPL code, raise it
  first.
- The desktop's upstream projects (Qt, LXQt, GLib and others) are fetched and
  built out of tree, under their own licences, and are not in the default
  image.

## Third-party software

Upstream code is vendored NetBSD-style: the upstream sources in
`<package>/dist/`, with BSD make files next to them. There is no ports tree.
[`docs/THIRD_PARTY.md`]({{repo}}/blob/{{branch}}/docs/THIRD_PARTY.md) has the
inventory and the upgrade procedure. In short, per package and in one commit
each:

1. Fetch the upstream release and check its published checksum.
2. Find out whether `dist/` is pristine or patched for NetBSD or {{name}}.
3. Replace a pristine `dist/` wholesale. Merge a patched one three-way
   against the pristine old version. Never drop a `__minix` guard without
   checking that upstream made it unnecessary.
4. Reconcile the `SRCS` lists and configuration headers with the new layout.
5. Bump the shared library's minor version when upstream adds public APIs.
6. Build the package, then a full release, and test the result inside the
   system.

## Documentation

- **This site** is a separate repository,
  [davmont/ixolo-site](https://github.com/davmont/ixolo-site). Fixes to these
  pages go there.
- **Design documents live in the OS repository**, next to the code they
  describe (for example `minix/fs/mfs/JOURNAL_DESIGN.md` or
  `docs/UEFI_BOOT.md`), and are copied to this site's
  [design section](/en/docs/design/smp/) by a script. Change them in the OS
  repository, in the same pull request as the code, and never on the site:
  the copy is overwritten.
- **Man pages** live next to their programs in the OS tree.

## Further reading

- Upstream MINIX 3 coding style and commit message guides (written for MINIX
  3.3/3.4; the practice above takes precedence):
  <https://wiki.minix3.org/doku.php?id=developersguide:codingstyle>,
  <https://wiki.minix3.org/doku.php?id=developersguide:commitmessages>
