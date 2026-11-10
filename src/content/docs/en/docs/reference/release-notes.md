---
title: "Release notes"
description: "What {{name}} adds to MINIX 3, from the fork to the first release."
sidebar:
  order: 4
---

## Unreleased — {{name}} {{version}}

:::note
{{name}} has not had a release yet. These notes describe the `{{branch}}`
branch as of November 2026 (up to [PR #488]({{repo}}/pull/488)) and will
become the notes of the first release. Release date: {{date}}.
:::

### Summary

{{name}} is a fork of MINIX 3 that runs on 64-bit x86. The last upstream
MINIX code dates from 2018 and ran on 32-bit x86 and ARM. The fork ported the
kernel to amd64, then added multiprocessor support, a reworked virtual memory
system, new and extended file systems, NVMe and USB storage, a newer network
stack, a large part of POSIX's real-time and threads interfaces, security
hardening and a current toolchain (LLVM/clang {{llvm}}). The microkernel
design is unchanged: drivers and servers still run as isolated user
processes, and a crashed driver is still restarted.

Items marked *experimental* work but are opt-in, incomplete, or not covered
by the automated tests.

### Platform and boot

- The amd64 kernel boots to a login prompt (May 2026, on `master`).
- One hybrid ISO boots on both BIOS and UEFI firmware. Under UEFI it uses
  GRUB, Multiboot2 and the GOP framebuffer as text console. See the
  [UEFI boot design](/en/docs/design/uefi-boot/). The image build was fixed
  for GRUB 2.16, which had silently made the ISO BIOS-only
  ([#483]({{repo}}/pull/483)).
- AHCI or IDE is detected at boot. The BIOS boot loader reads MFS version 4
  ([#280]({{repo}}/pull/280)). Hard-disk images boot with the APIC by
  default ([#286]({{repo}}/pull/286)).
- MSI-X interrupts ([#186]({{repo}}/pull/186)), RDRAND entropy at boot
  ([#240]({{repo}}/pull/240)), robust timer calibration
  ([#362]({{repo}}/pull/362), [#363]({{repo}}/pull/363)), the real-time
  clock under UEFI ([#354]({{repo}}/pull/354)), and boot with more than 4 GB
  of RAM ([#484]({{repo}}/pull/484)).
- The CPU must support `FSGSBASE`. NX, SMEP, SMAP and PCID are used when
  present.

### Multiprocessor (SMP)

- Secondary CPUs come up with their own descriptor tables, under a big kernel
  lock ([#157]({{repo}}/pull/157)). Up to {{maxCpus}} CPUs at compile time;
  tested with 1, 2, 4 and 8.
- A fast path for request–reply messages, and placement of servers that talk
  a lot on the same CPU ([#157]({{repo}}/pull/157)).
- Many SMP fixes: per-CPU timers and page-fault handling, run-queue locking
  ([#283]({{repo}}/pull/283), [#287]({{repo}}/pull/287)–[#289]({{repo}}/pull/289)),
  preemption of CPU-bound threads ([#379]({{repo}}/pull/379)), TLB shootdown
  for multithreaded processes ([#409]({{repo}}/pull/409)).
- CPU affinity ([#473]({{repo}}/pull/473)) and real-time scheduling,
  `SCHED_FIFO` and `SCHED_RR` ([#464]({{repo}}/pull/464)).
- Design notes: [SMP](/en/docs/design/smp/).

### Memory

- 47-bit user address space: programs can use up to 128 TB of virtual memory
  ([#449]({{repo}}/pull/449), [#450]({{repo}}/pull/450),
  [#452]({{repo}}/pull/452)).
- Clean-page reclaim ([#290]({{repo}}/pull/290)–[#293]({{repo}}/pull/293))
  and compressed anonymous memory with LZ4
  ([#294]({{repo}}/pull/294)–[#298]({{repo}}/pull/298)). See the
  [reclaim design](/en/docs/design/reclaim/).
- Out-of-memory killer and `RLIMIT_AS`/`RLIMIT_DATA`
  ([#311]({{repo}}/pull/311), [#320]({{repo}}/pull/320)).
- `mprotect`, NX for non-executable mappings
  ([#365]({{repo}}/pull/365)–[#367]({{repo}}/pull/367)), writable shared file
  mappings and `msync` ([#410]({{repo}}/pull/410)), shared anonymous memory
  across `fork` ([#487]({{repo}}/pull/487)).
- *Experimental:* disk swap in the kernel and VM
  ([#299]({{repo}}/pull/299), [#300]({{repo}}/pull/300),
  [#310]({{repo}}/pull/310)). There is no `swapon` tool to turn it on yet.

### File systems

- MFS version 4 is the default: wide inodes, files over 2 GB, dates past 2038
  ([#246]({{repo}}/pull/246), [#280]({{repo}}/pull/280);
  [design](/en/docs/design/mfsv4/)).
- MFS metadata journaling ([#251]({{repo}}/pull/251)–[#255]({{repo}}/pull/255);
  [design](/en/docs/design/journal/)), extended attributes
  ([#256]({{repo}}/pull/256); [design](/en/docs/design/xattr/)), POSIX.1e
  ACLs ([#258]({{repo}}/pull/258)–[#262]({{repo}}/pull/262)), immutable and
  append-only flags ([#249]({{repo}}/pull/249), [#257]({{repo}}/pull/257)).
- ext2, ext3 and ext4 with journal replay, extents, 64-bit and checksums
  ([#213]({{repo}}/pull/213), [#266]({{repo}}/pull/266)–[#278]({{repo}}/pull/278)).
- FAT12/16/32 read and write ([#214]({{repo}}/pull/214),
  [#218]({{repo}}/pull/218), [#265]({{repo}}/pull/265)) and exFAT
  ([#263]({{repo}}/pull/263), [#264]({{repo}}/pull/264)).
- tmpfs, which also holds POSIX shared memory ([#483]({{repo}}/pull/483)).
- *Experimental:* multithreaded MFS with concurrent I/O
  ([#281]({{repo}}/pull/281)). The root file system runs single-threaded by
  default ([#282]({{repo}}/pull/282)).

### Drivers

- NVMe, including boot from NVMe ([#183]({{repo}}/pull/183),
  [#284]({{repo}}/pull/284)).
- USB host controllers EHCI, OHCI and xHCI, with hubs, for mass storage only
  ([#188]({{repo}}/pull/188), [#192]({{repo}}/pull/192)–[#194]({{repo}}/pull/194)).
- AHCI, and IDE with a fix for disks over 2 TB ([#274]({{repo}}/pull/274)).
- A framebuffer device, `/dev/fb0`, under UEFI.
- The e1000 network driver is the one tested. The other network, audio and
  `virtio_blk` drivers build for amd64 but have not been tested on it.

### Networking

- lwIP 2.2.1 with later security fixes ([#313]({{repo}}/pull/313),
  [#314]({{repo}}/pull/314)) and stability fixes
  ([#417]({{repo}}/pull/417), [#425]({{repo}}/pull/425)).
- TCP window scaling, SACK and timestamps ([#414]({{repo}}/pull/414)),
  multicast options as on NetBSD ([#429]({{repo}}/pull/429)), `accept4`
  ([#388]({{repo}}/pull/388)).
- dhcpcd replaces dhclient ([#206]({{repo}}/pull/206)).

### POSIX

- Threads on amd64 ([#179]({{repo}}/pull/179)), with many later fixes.
- The `*at` path calls ([#382]({{repo}}/pull/382)). This changed the system
  call ABI: programs built before it must be rebuilt.
- Job control ([#399]({{repo}}/pull/399)–[#404]({{repo}}/pull/404)),
  `kqueue` ([#413]({{repo}}/pull/413)), POSIX message queues
  ([#405]({{repo}}/pull/405)).
- Real-time interfaces: signals ([#461]({{repo}}/pull/461)), semaphores
  ([#462]({{repo}}/pull/462)), asynchronous I/O ([#463]({{repo}}/pull/463)),
  priority inheritance and protection ([#472]({{repo}}/pull/472),
  [#474]({{repo}}/pull/474)), process-shared synchronization
  ([#479]({{repo}}/pull/479)), thread cancellation
  ([#481]({{repo}}/pull/481), [#488]({{repo}}/pull/488)).
- Open POSIX Test Suite: {{posixPassed}} of {{posixTotal}} tests pass;
  pjdfstest: {{pjdfstestPassed}} of {{pjdfstestTotal}}. Details on the
  [POSIX page](/en/docs/reference/posix/).

### Security

- NX and no executable stacks ([#317]({{repo}}/pull/317),
  [#366]({{repo}}/pull/366)); SMEP and SMAP ([#439]({{repo}}/pull/439));
  the kernel rejects user buffers that point into kernel memory
  ([#440]({{repo}}/pull/440)–[#442]({{repo}}/pull/442)); hardened
  `sigreturn` ([#393]({{repo}}/pull/393)).
- Stack protector and `_FORTIFY_SOURCE=2` for user programs and libraries
  ([#436]({{repo}}/pull/436), [#444]({{repo}}/pull/444)).
- Address-space randomization of the stack and the `mmap` base
  ([#445]({{repo}}/pull/445)). Partial: executables are not PIE, so their
  code, data and heap do not move.
- bcrypt password hashing; `setup` asks for a root password
  ([#443]({{repo}}/pull/443)).
- OpenSSH {{openssh}} ([#446]({{repo}}/pull/446)), Mozilla CA certificates and
  `certctl` ([#447]({{repo}}/pull/447), [#448]({{repo}}/pull/448)), OpenSSL
  3.5 LTS, Heimdal Kerberos 7.8 ([#215]({{repo}}/pull/215)).

### Toolchain and userland

- LLVM/clang/lld {{llvm}} in the tree ([#200]({{repo}}/pull/200),
  [#201]({{repo}}/pull/201)), up from clang 3.6. lld replaces GNU ld; GNU
  binutils and GCC are gone ([#316]({{repo}}/pull/316),
  [#318]({{repo}}/pull/318), [#323]({{repo}}/pull/323)–[#326]({{repo}}/pull/326)).
- Many third-party components updated: SQLite (with WAL and thread safety,
  [#418]({{repo}}/pull/418), [#421]({{repo}}/pull/421)), libuv on `kqueue`
  ([#427]({{repo}}/pull/427)), BIND, tmux, less, zlib, xz, libarchive, Lua
  and others. See the [third-party inventory](/en/docs/design/third-party/).
- Manual pages ship on the ISO ([#165]({{repo}}/pull/165)); new `free(1)`
  ([#225]({{repo}}/pull/225)).

### Desktop (experimental)

- A Wayland compositor (`wlcompd`), Qt 6 and LXQt, on the UEFI framebuffer
  with software rendering ([#329]({{repo}}/pull/329)–[#360]({{repo}}/pull/360)).
- Opt-in: built out of tree, needs UEFI, not on the default ISO and not
  tested in CI. See the [desktop guide](/en/docs/admin/desktop/).

### Testing

- A QEMU test harness, `qemutest.py` ([#361]({{repo}}/pull/361)), run in CI on
  every pull request on 1 and 2 CPUs.
- The Open POSIX Test Suite in the tree ([#456]({{repo}}/pull/456)), run by
  hand. QEMU debugging tools ([#407]({{repo}}/pull/407)).

### Known limitations

- amd64 only. i386 does not build on `{{branch}}`; ARM has not been
  maintained since the fork.
- Tested mainly in QEMU/KVM. Physical machines verified: {{hardware}}.
- The installer, `setup`, still looks for the installation sets under
  `/i386/binary/sets` and copies nothing from the amd64 ISO. It installs for
  BIOS only. See [Install to disk](/en/docs/start/install/) for the
  workaround and the disk-image alternative.
- No binary package repository for amd64. `pkg_add` is in the base system;
  `pkgin` is not.
- No debugger (gdb or lldb).
- Executables are not PIE; no RELRO.
- Live update, an upstream feature, does not work on amd64: its test is a
  known failure.
- No tool to enable swap; USB keyboards and mice are not supported; no UEFI
  Secure Boot.
- The tree still calls itself MINIX 3, version 3.4.0 (boot menu, `uname`).

## Lineage

| Date | Event |
|---|---|
| Oct 2005 | MINIX 3.1.0, the first MINIX 3 release |
| Feb 2012 | MINIX 3.2.0: NetBSD libc and userland, clang, experimental SMP |
| Feb 2013 | MINIX 3.2.1 |
| Sep 2014 | MINIX 3.3.0: ARM support; the last stable upstream release |
| May 2017 | MINIX 3.4.0rc6, the last upstream release candidate |
| Nov 2018 | Last upstream commit, `4db99f4`: the base of the fork |
| Mar 2026 | The fork starts |
| May 2026 | amd64 boots to a login prompt (on `master`, [#153]({{repo}}/pull/153)) |
| Jun–Nov 2026 | Development on `{{branch}}`, PRs [#154]({{repo}}/pull/154) to [#488]({{repo}}/pull/488) |
| {{date}} | {{name}} {{version}} |

The tree also has its own
[`RELEASE_NOTES.md`]({{repo}}/blob/{{branch}}/RELEASE_NOTES.md). It covers
March to early June 2026 only and has not been updated since. These notes
replace it for everything after.

For the longer story, see [history](/en/docs/learn/history/).
