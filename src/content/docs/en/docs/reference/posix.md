---
title: "POSIX compatibility"
description: "What {{name}} implements of POSIX, measured with the Open POSIX Test Suite and pjdfstest, and the known gaps."
sidebar:
  order: 3
---

{{name}} aims to run ordinary POSIX programs unchanged. "POSIX compatible"
means little without numbers, so the project measures it with two public
test suites and keeps a list of every known failure in the tree.

## The numbers

| Suite | Result | How it runs |
|---|---|---|
| [Open POSIX Test Suite](https://github.com/linux-test-project/ltp/tree/master/testcases/open_posix_testsuite) (from LTP 20250130) | **{{posixPassed}} of {{posixTotal}}** tests pass | QEMU/KVM, 2 CPUs. Run by hand, not in CI. |
| [pjdfstest](https://github.com/pjd/pjdfstest) (file-system semantics) | **{{pjdfstestPassed}} of {{pjdfstestTotal}}** scripts pass | In CI on every pull request, on 1 and 2 CPUs, on a freshly made MFS |

Both runs have **no unexpected failures**: every test that does not pass is
listed, with a reason, in a known-failure file. The test harness fails the run
if a listed test starts passing, so the lists cannot go stale quietly.

What the Open POSIX total includes: about 1,750 conformance tests, counting
the ones that do not compile (usually because the interface under test is
missing) and about 30 that reported themselves UNSUPPORTED or UNTESTED at
the baseline. A test that does not build counts as not passed. For
pjdfstest, the 8 known failures and one skipped script make up the
difference.

### How it got here

The Open POSIX suite was imported on 2026-10-22
([PR #456]({{repo}}/pull/456)). From then on, most POSIX work was measured
against it:

| Change | Passed |
|---|---|
| Import, baseline ([#456]({{repo}}/pull/456)) | 1287 |
| Real-time signals ([#461]({{repo}}/pull/461)) | 1358 |
| Named and process-shared semaphores ([#462]({{repo}}/pull/462)) | 1403 |
| Asynchronous I/O ([#463]({{repo}}/pull/463)) | 1469 |
| `SCHED_FIFO` and `SCHED_RR` ([#464]({{repo}}/pull/464)) | 1530 |
| Priority protect and inherit, CPU affinity, process-shared sync ([#472]({{repo}}/pull/472)–[#479]({{repo}}/pull/479)) | 1542 |
| `mlock` and other small interfaces ([#480]({{repo}}/pull/480)) | 1576 |
| Asynchronous thread cancellation ([#481]({{repo}}/pull/481)) | 1626 |
| tmpfs, shared memory as files ([#483]({{repo}}/pull/483)) | 1641 |
| Shared anonymous memory across `fork` ([#487]({{repo}}/pull/487)) | 1643 |
| Deferred cancellation points ([#488]({{repo}}/pull/488)) | 1645 |

pjdfstest went from 184 of 238 (2026-09-26) to 216
([#406]({{repo}}/pull/406)) and then 229 ([#408]({{repo}}/pull/408)), where it
has stayed.

## What is implemented

| Area | State |
|---|---|
| Threads | libpthread on kernel-scheduled threads (`_lwp_*` calls in PM). `fork` from a thread, `pthread_detach`, timed waits, asynchronous and deferred cancellation. Process-shared mutexes, condition variables, rwlocks and barriers. `PTHREAD_PRIO_INHERIT` and `PTHREAD_PRIO_PROTECT` mutexes. |
| Signals | `SA_SIGINFO` with `ucontext`, `sigaltstack`, `SA_RESTART`, `pthread_kill`, delivery of a process signal to any thread that does not block it. Real-time signals `SIGRTMIN` to `SIGRTMAX`, queued with values: `sigqueue`, `sigwaitinfo`, `sigtimedwait`. |
| Clocks and timers | `CLOCK_REALTIME`, `CLOCK_MONOTONIC`, process and thread CPU-time clocks, `timer_create` and the other `timer_*` calls, `clock_nanosleep`. Setting the clock no longer disturbs the monotonic clock or timed waits. |
| IPC | POSIX message queues (`mq_*`), named and process-shared semaphores (up to 256 in the system), `shm_open` as files on a tmpfs at `/var/shm`. System V shared memory and semaphores. |
| Asynchronous I/O | `aio_*` and `lio_listio` in `librt`. There is no kernel AIO: a pool of threads does the I/O with `pread` and `pwrite`. Completion signals arrive with `SI_ASYNCIO`. |
| Scheduling | `sched_*` calls, `SCHED_FIFO` and `SCHED_RR` for root, in a band below the system services. If real-time processes use more than 95% of a CPU, they are throttled so a shell can still kill a runaway. CPU affinity with `sched_setaffinity_np` and `pthread_setaffinity_np`. |
| File locks | `fcntl` record locks and `flock`. |
| Path calls | The `*at` family, `O_NOFOLLOW`, `O_DIRECTORY`; a bad path pointer returns `EFAULT`. |
| Files and I/O | `pread`/`pwrite`, `preadv`/`pwritev`, `posix_fallocate`, `O_SYNC`/`O_DSYNC`, `fdatasync` (a full `fsync`). |
| Memory | `mmap` with `PROT_*` honoured, `mprotect`, `msync`, writable `MAP_SHARED` file mappings on MFS and tmpfs, `MAP_SHARED` anonymous memory shared across `fork`. |
| Waiting | `select`, `pselect`, `poll` and `ppoll` for every process (the old limit of 25 processes at once is gone), `POLLNVAL`. `kqueue`/`kevent` with the read, write, vnode, timer and user filters. |
| Job control | Sessions, process groups, a real stopped state (`SIGSTOP`, `SIGTSTP`, `SIGCONT`), `waitid`, the terminal's foreground process group with `SIGTTIN`/`SIGTTOU`, and job control in `/bin/sh` (`fg`, `bg`, `Ctrl-Z`). |

For which server implements each call, see the
[system call reference](/en/docs/reference/syscalls/).

## Known gaps

The known-failure lists are the honest summary. Both are in the tree:
[`qemutest-posix.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-posix.xfail)
(78 entries, 12 of them marked flaky) and
[`qemutest-pjdfstest.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-pjdfstest.xfail)
(8 entries). By category:

**File systems (pjdfstest)**

- *Sub-second timestamps.* MFS stores whole seconds, so nanoseconds written
  with `utimensat` read back as 0 (`utimensat/08`). On tmpfs the test passes.
- *Long paths.* Path components and symbolic-link targets beyond MFS's limits
  do not fail with `ENAMETOOLONG` the way POSIX expects (7 scripts in `link`,
  `rename` and `symlink`).

**Open POSIX suite**

- *Clock setting.* Six `clock_settime` tests fail, plus `clock/2-1` and
  `clock_nanosleep/13-1`.
- *Memory locking.* `mlock` and `mlockall` check their arguments but do not
  pin pages, so tests that expect `EBUSY` or `EAGAIN` from locked memory
  fail.
- *Message queues and semaphores.* A few timed-send, timed-receive and unlink
  edge cases (`mq_timedsend/5-*`, `mq_timedreceive/5-1`, `sem_unlink/4-1`...).
- *Threads.* 27 tests in the `pthread_*` groups. Some do not compile,
  some cannot set themselves up, some time out. Many are condition-variable
  and timed-lock tests.
- *Timing.* The AIO, `clock/1-1`, `sigwait/6-*` and `sched_setparam/27-1`
  entries are flaky: they depend on what finishes first.
- *Others.* `killpg/1-2` and four `sched_setparam/25-*` tests do not
  compile; `timer_create/10-1` needs `_SC_CPUTIME`.

**Not measured by either suite**

- `kqueue` has no `EVFILT_SIGNAL`, `EVFILT_PROC` or `EVFILT_AIO`; they return
  `EINVAL`.
- `poll` is built on `select`, so it does not report `POLLHUP`.
- Writable `MAP_SHARED` file mappings work on MFS and tmpfs only; other file
  systems return `ENODEV`.
- System V message queues (`msgget` and the rest) are not implemented.
- Executables are not position-independent (PIE). This is not a POSIX
  requirement, but it limits address-space randomization to the stack and
  the `mmap` base.

## Running the suites yourself

Both suites run under QEMU with `releasetools/qemutest.py`. The
[testing guide](/en/docs/develop/testing/) explains the harness. In short,
from the top of the source tree, after a build:

```sh
# pjdfstest, as CI runs it
python3 releasetools/qemutest.py --iso minix_amd64.iso --smp 2 \
  --suite pjdfstest --xfail releasetools/qemutest-pjdfstest.xfail

# Open POSIX: cross-build the tests on the host, then run them
python3 releasetools/posixsuite.py --destdir obj.amd64/destdir.amd64 \
  --tooldir obj.amd64/tooldir.Linux-x86_64 --out posix.img
python3 releasetools/qemutest.py --iso minix_amd64.iso --smp 2 \
  --suite posix --drive posix.img --xfail releasetools/qemutest-posix.xfail
```

The suite's code is GPLv2 and lives in
[`external/gpl2/open_posix_testsuite`]({{repo}}/blob/{{branch}}/external/gpl2/open_posix_testsuite/README.minix).
It is never linked into anything shipped, and the release build does not
build it.
