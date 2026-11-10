---
title: "Tests and continuous integration"
description: "The test suites, how to run them with qemutest.py or by hand, the known-failure lists, the CI pipeline and how to debug a hang."
sidebar:
  order: 3
---

Every change to {{name}} is tested by booting the real image in QEMU and
running test suites inside it. One script,
[`releasetools/qemutest.py`]({{repo}}/blob/{{branch}}/releasetools/qemutest.py),
does it on your machine and in the CI. You need only `python3` and
`qemu-system-x86_64` on the host; KVM is used when `/dev/kvm` is usable, and
TCG (`-cpu max`) otherwise.

## The suites

| Suite | What it runs | Size | In CI |
|---|---|---|---|
| `boot` | Boots to `login:`, logs in, exits | 1 check | yes, before every other suite |
| `quick` | The `minix/tests` programs that are fast and need no network | about 150 tests | yes |
| `full` | Every test the `run` script knows about | hours | no |
| `pjdfstest` | POSIX file-system conformance ([pjdfstest](https://github.com/pjd/pjdfstest)) | {{pjdfstestTotal}} scripts | yes |
| `posix` | The Open POSIX Test Suite from LTP 20250130 | {{posixTotal}} tests | no, run by hand |
| `kyua` | NetBSD's ATF tests under kyua | needs the `tests` set | no |

The latest recorded results, with KVM: **quick** passes everything except
its known failures, on 1 and 2 CPUs; **pjdfstest** {{pjdfstestPassed}} of
{{pjdfstestTotal}} scripts pass with no unexpected failure; the **Open POSIX
Test Suite** passes {{posixPassed}} of {{posixTotal}} on 2 CPUs with no
unexpected failure.

## Running a suite

Build an ISO first (see [Building from source](/en/docs/develop/building/)),
then:

```sh
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite boot
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite quick \
  --xfail releasetools/qemutest.xfail
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite pjdfstest \
  --xfail releasetools/qemutest-pjdfstest.xfail --smp 2
```

How it works: the ISO starts a getty on the first serial port, so the serial
line is a root shell. The script logs in there, copies the tests onto a fresh
128 MB MFS RAM disk (the CD root is read-only and `/tmp` is tiny), and runs
the tests one at a time, each under its own timeout, reading TAP output. A
test that hangs is interrupted, its VM is thrown away, a new one is booted,
and the run continues with the next test.

| Option | Meaning | Default |
|---|---|---|
| `--suite` | `boot`, `quick`, `full`, `kyua`, `pjdfstest` or `posix` | `boot` |
| `--tests "1 2 sh1"` | Run only these tests (for `posix`, also directory prefixes) | the whole suite |
| `--shard K/N` | Run every Nth test starting at the Kth, so N runs in parallel cover the suite | off |
| `--smp N` | Guest CPUs. 2 exercises the SMP paths | 1 |
| `--mem MB` | Guest RAM | 1024 |
| `--xfail FILE` | Known-failure list; may be repeated, the lists are merged | none |
| `--test-timeout S` | Seconds per test | 600 with KVM, 1200 with TCG |
| `--boot-timeout S` | Seconds to reach `login:` | 300 with KVM, 600 with TCG |
| `--max-reboots N` | Give up after this many hung tests | 10 |
| `--no-kvm` | Force TCG | |
| `--drive IMG` | Raw disk attached as the second IDE disk (`/dev/c0d1`); the `posix` suite needs it | |
| `--kernel ELF` | The unstripped kernel (`obj.amd64/minix/kernel/kernel`): when a test hangs, save the process dumps; when one fails, save the kernel messages it caused | |
| `--log-dir DIR` | Where the logs go | `qemutest-logs` |

The log directory gets `serial.log` (the whole console transcript),
`results.tap`, and with `--kernel` a `fail-TEST.txt` or `hang-TEST-N.txt` per
problem. The exit code is 0 when everything passed, 1 when a test failed or
hung, 2 when the image did not boot or log in, 3 when the host could not keep
a guest running, 4 for bad usage.

## Known-failure lists

A test that is known to fail is listed, so that the run still passes and a
*new* failure stands out. The format is one test per line, with `#` comments:

```
42:120      # ptrace: attach subtests 9 and 19 fail (T5); ...
75 flaky    # getrusage: ru_utime rounds to 0 under HZ=60 tick accounting (T2)
mfs         # expected mkfs.mfs image sha1 predates the MFS4 default (test debt)
```

`name:seconds` bounds a known hang so it does not cost the full timeout.
`flaky` accepts either result. A listed test that **passes** is reported as
XPASS and fails the run: remove it from the list in the same change that fixes
it. That keeps the lists honest.

| File | For | Contents |
|---|---|---|
| [`qemutest.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest.xfail) | `quick` | 11 entries: ptrace (42), 64-bit `strtoll` and arithmetic (45, 53, 66), ptyfs (77), two outdated tests (`mfs`, `isofs`), and flaky ones |
| [`qemutest-tcg.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-tcg.xfail) | `quick` under TCG | Timer-driven and slow tests that pass on KVM but stall on a slow emulated host; merged with the first list |
| [`qemutest-pjdfstest.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-pjdfstest.xfail) | `pjdfstest` | 8 scripts: MFS keeps whole-second timestamps, and long paths do not fail with `ENAMETOOLONG` as POSIX expects |
| [`qemutest-posix.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-posix.xfail) | `posix` | 78 entries, 12 of them flaky timing tests; each says how it failed |

## The Open POSIX Test Suite

The suite is LTP's `open_posix_testsuite` (release 20250130), kept in
[`external/gpl2/open_posix_testsuite`]({{repo}}/blob/{{branch}}/external/gpl2/open_posix_testsuite/README.minix).
It is GPLv2, so it is never linked into anything shipped and the release build
does not build it. It is cross-compiled on the host and handed to the guest on
a second disk:

```sh
python3 releasetools/posixsuite.py \
  --destdir obj.amd64/destdir.amd64 \
  --tooldir obj.amd64/tooldir.Linux-x86_64 --out posix.img
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite posix \
  --drive posix.img --smp 2 --xfail releasetools/qemutest-posix.xfail
```

A test that does not compile is a result, not a build error: usually the
interface it tests is missing. Such tests count as `nobuild`, and the compiler
errors go to `posix.img.log`. Use `--tests interfaces/mmap` to run one area.
Current score: {{posixPassed}} of {{posixTotal}}. It is not in the CI, so run
it yourself when you change libc, PM, VFS, VM, signals or threads.

## Running the tests by hand

Inside a running system the tests are in `/usr/tests/minix-posix`, driven by
the `run` script (`./run -l` lists the tests, `./run -t '1 2 3'` runs some,
`-T` prints TAP). On the live CD, copy them to a RAM disk first, exactly as
`qemutest.py` does:

```sh
ramdisk 131072 /dev/ram4
mkfs.mfs /dev/ram4
mount /dev/ram4 /mnt
(cd /usr/tests/minix-posix && pax -rw . /mnt)
cd /mnt
./run -t '1 2 3 sh1'
```

pjdfstest lives in `/usr/tests/pjdfstest`; its scripts are run one by one with
`sh`, from the `tests` directory of a copy on a writable file system.

The `kyua` suite needs `/usr/bin/kyua` and `/usr/tests/Kyuafile`, which come
with the NetBSD-style `tests` set. That set is on the hard-disk image
(`amd64_hdimage.sh`) but not on the default ISO. There, run
`cd /usr/tests && kyua test`. No kyua results are published yet.

## Continuous integration

[`.github/workflows/ci.yml`]({{repo}}/blob/{{branch}}/.github/workflows/ci.yml)
runs on every push to `devel` and `master`, on every pull request, and on
manual request. A manual run can choose TCG instead of KVM.

**Build job** (Ubuntu 24.04, 4 jobs): restores the cross toolchain from the
cache (keyed by the hash of `build.sh`, `tools/`, `share/mk/`, LLVM and make),
builds it if missing (about 2 hours), builds the release with
`MKLLVMCMDS=no` (about 2 h 15 min), cuts a BIOS ISO with `UEFI=no`, and
uploads two artifacts kept for 7 days: `minix_amd64.iso` and `kernel-elf`, the
unstripped kernel.

**Test jobs**: eight in parallel, each on a fresh runner with KVM. Each boots
the ISO first, so a boot regression shows up everywhere within minutes, then
runs its shard:

| Job | Suite | CPUs |
|---|---|---|
| quick 1/4 … 4/4 | `quick`, four shards | 1 |
| pjdfstest 1/2, 2/2 | `pjdfstest`, two shards | 1 |
| quick 1/1 smp2 | `quick` | 2 |
| pjdfstest 1/1 smp2 | `pjdfstest` | 2 |

A shard takes about ten minutes under KVM (40 to 70 minutes under TCG). Every
job uploads its `qemutest-logs` as an artifact, also when it fails. The SMP
jobs are where the kernel's locking, IPIs and per-CPU timers get exercised on
every pull request.

To reproduce a CI failure, download the ISO and the kernel from the run and
run the same shard locally with the same `--xfail` files and `--kernel`.

## Developer tools

[`releasetools/devtools/`]({{repo}}/blob/{{branch}}/releasetools/devtools/README.md)
has helpers built on `qemutest.py`, for when a test is not enough:

| Tool | Use |
|---|---|
| `runcmd.py ISO LOGDIR CMD` | Boot, log in, stage the tests, run one shell command, print its output |
| `hold.py ISO LOGDIR SMP CMD` | Like `runcmd`, then keep the guest up: commands written to `LOGDIR/cmd` run in it |
| `bootonly.py ISO LOGDIR [SECS]` | Boot without logging in and keep QEMU up, for a console that never reaches login |
| `kmsg.py QMPSOCK KERNEL` | Dump the kernel message ring of a running guest |
| `keys.py QMPSOCK KEY ...` | Send keystrokes, for example `f1` or `shift+f3` for the IS dumps |
| `qmpcmd.py QMPSOCK CMD` | Run one QMP or HMP command |
| `bootloop.py` | Boot repeatedly to catch rare boot hangs |
| `stress.py --iso ISO --minutes N --log-dir D` | Long fork/exec/IPC stress run with hang detection |
| `powercut.py ISO LOGDIR HOW TAG` | Write data, cut the power, check what reached the disk image |
| `netbench.py ISO` | TCP throughput between two guests over a link with added latency |
| `deskcheck.py`, `guidrv.py` | Desktop smoke test and GUI driver (UEFI, `MKDESKTOP` image) |
| `relink_desktop.sh` | Relink the static desktop programs after a libc ABI change |

Stop guests by PID, never with `pkill -f`: it also matches the shell running
the command.

## Debugging

There is **no debugger** in {{name}} yet: no gdb or lldb in the tree. The
tools you have:

- **The serial console.** The second boot menu entry, *serial console,
  verbose*, boots with `console=tty00 verbose=3`: all kernel and boot messages
  go to the serial port, with more detail. In QEMU add `-serial stdio`
  (or `-serial file:boot.log`).
- **IS dumps.** The information server prints system tables when you press a
  function key on the console. The output goes to the kernel message log.

  | Key | Dump |
  |---|---|
  | <kbd>F1</kbd> | Kernel process table |
  | <kbd>F4</kbd> | Process privileges |
  | <kbd>F6</kbd> | IRQ hooks and policies |
  | <kbd>F8</kbd> | VM status and process maps |
  | <kbd>Shift</kbd>+<kbd>F1</kbd> | PM process table |
  | <kbd>Shift</kbd>+<kbd>F3</kbd> | VFS process table: what each process is blocked on |
  | <kbd>Shift</kbd>+<kbd>F4</kbd> | Device to driver mapping |
  | <kbd>Shift</kbd>+<kbd>F6</kbd> | RS table of services |
  | <kbd>Shift</kbd>+<kbd>F9</kbd> | Processes with stack traces |

  In QEMU, send the keys with `sendkey f1` in the monitor or with
  `devtools/keys.py`. `qemutest.py --kernel` does this automatically when a
  test hangs.
- **Symbols.** Keep the unstripped kernel from the build. To turn an address
  from a panic or a stall into a function:
  `nm -n obj.amd64/minix/kernel/kernel | awk '$1 <= "ADDR"' | tail -1`
  (with `ADDR` in the same 16-digit hex form `nm` prints).
- **System call tracing.** `trace(1)` prints the calls a program makes. It
  is built on `ptrace`, which still has known failures (test 42).
- **printf.** Servers and drivers print to the console with `printf`. Crude,
  and often the fastest way.

## Further reading

- Upstream MINIX 3 test suite notes:
  <https://wiki.minix3.org/doku.php?id=developersguide:testsuite>
