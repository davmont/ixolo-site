---
title: Isolation and self-repair
description: How {{name}} limits what each driver can do, how the Reincarnation Server restarts failed services, and where recovery stops.
sidebar:
  order: 3
---

A microkernel alone does not make a system reliable. Moving a driver into a
user process only helps if the process is also **limited** in what it can
touch, and if something **notices and repairs** it when it fails. In
{{name}}, as in MINIX 3, the first job belongs to the kernel and
`/etc/system.conf`, and the second to the Reincarnation Server (RS).

This page explains both, and is honest about where recovery stops working.

## Least authority

Every system service runs with the smallest set of rights it needs. RS reads
those rights from `/etc/system.conf` and from the files in
`/etc/system.conf.d/` when it starts the service, and tells the kernel. This
is the real entry for the Intel network driver,
[`minix/drivers/net/e1000/e1000.conf`]({{repo}}/blob/{{branch}}/minix/drivers/net/e1000/e1000.conf),
abridged:

```text
service e1000
{
        type net;
        system
                UMAP            # 14
                IRQCTL          # 19
                DEVIO           # 21
        ;
        pci device      8086:100e;
        pci device      8086:100f;
        ...
        ipc
                SYSTEM pm rs log tty ds vm
                pci inet lwip ;
};
```

Each section is one kind of permission:

| Keyword | What it limits | Enforced by |
|---|---|---|
| `system` | Which kernel calls the service may make. The e1000 driver may translate addresses (`UMAP`), manage its interrupt (`IRQCTL`) and do port I/O (`DEVIO`), and nothing else: it cannot, for example, create processes or change page tables. | kernel |
| `ipc` | Which processes it may send messages to. The driver can talk to the network stack, but not to VFS or to a disk driver. | kernel |
| `io`, `irq` | Which I/O port ranges and interrupt lines it may use (for ISA-style devices; `at_wini` lists `1f0:8`, IRQ 14 and so on). | kernel |
| `pci device`, `pci class` | Which PCI devices it may claim. Their memory and interrupt are granted from there. | PCI driver |
| `vm` | Which special calls to the VM server it may make. | VM |
| `uid` | The user ID the service runs as. | PM, VFS |

The syntax is documented in
[`system.conf(5)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/system.conf.5).
The kernel checks the `system` and `ipc` masks on every call, so a driver
that is taken over by a bug or an attacker still cannot send a message to a
process it was not allowed to talk to.

User programs get even less: they may only use `sendrec`, so they can call a
server and wait for the answer, but cannot send unsolicited messages.

Memory is protected the same way. A driver cannot read another process's
memory unless that process creates a **grant** for that exact byte range. See
[Message passing](/en/docs/learn/message-passing/#memory-grants-and-safe-copies).

## The Reincarnation Server

RS ([`minix/servers/rs/`]({{repo}}/blob/{{branch}}/minix/servers/rs/)) is
the parent of every driver and server. The startup scripts never run a driver
directly; they call `minix-service up`, which asks RS to do it:

```sh
minix-service up /service/e1000 -label e1000_0 -args instance=0 -period 5HZ
```

`-label` names the instance, `-period 5HZ` turns on a heartbeat every five
seconds, `-c` (used for disk drivers) keeps a copy of the binary in memory so
RS can restart the driver even when the disk it lives on is unreachable, and
`-script` hands recovery to a shell script. All options are in
[`minix-service(8)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/minix-service.8).

RS then watches for two kinds of failure:

- **Crashes.** When a service dies (a segmentation fault, a `panic()`, a
  `SIGKILL`), the kernel sends the signal to RS instead of to PM. RS marks the
  service as terminated and starts recovery.
- **Hangs.** If a service has a period, RS sends it a notification every
  period. The service's library answers automatically from its message loop.
  If no answer has come after twice the period, RS kills the service and
  treats it as a crash. A driver stuck in an infinite loop therefore does not
  stay stuck.

### What RS does on a failure

The logic is in `terminate_service()` and `restart_service()` in
[`manager.c`]({{repo}}/blob/{{branch}}/minix/servers/rs/manager.c):

1. If the service was started with a recovery script, RS runs the script with
   the label, the reason (`terminated`, `no-heartbeat` or `restart`) and the
   number of restarts so far, and lets the script decide.
   [`/etc/rs.lwip`]({{repo}}/blob/{{branch}}/etc/rs.lwip), for example,
   restarts the TCP/IP stack and then every network daemon, because their
   sockets died with it.
2. Otherwise, the first time, RS restarts it at once from the same binary
   (or from the in-memory copy).
3. If the service has failed before, RS waits first: 2 seconds after the
   second failure, then 4, 8, 16, and at most 30 seconds. This **binary
   exponential backoff** stops a driver that crashes on every start from
   eating the machine. `minix-service up -b` turns it off.
4. If the service fails while it is still initialising, RS gives up and
   leaves it down. The rest of the system keeps running without it.

When the new copy is up, RS publishes its endpoint in DS, the data store.
Servers that depend on drivers have subscribed to those entries: VFS watches
`drv.blk.*` and `drv.chr.*`, the network stack watches `drv.net.*`. DS tells
them the driver has a new endpoint, and they resend whatever was in flight.

DS can also hold small amounts of state (numbers, strings, memory blobs) under
a name, so a restarted component can pick up where the old one left off.
Upstream's guide is at
<https://wiki.minix3.org/doku.php?id=developersguide:datastore>.

## SEF: the service side of the contract

Every server and driver is linked with `libsys`, and its main loop receives
messages through the **System Event Framework** (SEF,
[`minix/lib/libsys/sef*.c`]({{repo}}/blob/{{branch}}/minix/lib/libsys/)).
SEF intercepts the messages that come from RS before the service sees them,
and calls back into the service when needed:

| Callback | When it runs | Typical choice |
|---|---|---|
| `sef_setcb_init_fresh` | First start | Probe the hardware, publish the label |
| `sef_setcb_init_restart` | Start after a crash | Drivers use the default: behave like a fresh start under a new endpoint. VFS, PM, DS, MFS and other servers ask for a *stateful* restart (below) |
| `sef_setcb_init_lu` | Start as the new version in a live update | Research feature, see below |
| `sef_setcb_ping_reply` | Heartbeat from RS | Default: answer at once |
| `sef_setcb_signal_handler` | A signal such as `SIGTERM` arrives as a message | Clean up and exit |

A driver that only needs a fresh start writes almost nothing: register an
init function, call `sef_startup()`, and loop on `sef_receive()`.

## What recovers, and what does not

| Component fails | What happens | Transparent to programs? |
|---|---|---|
| Network driver (e1000, igc…) | Restarted with a new endpoint; the stack re-initialises the card | Mostly. A few packets are lost and TCP retransmits them |
| Disk driver under a file system | Restarted (from the in-memory copy); the file system's block layer retries the request | Yes, by design. Requests are retried a limited number of times |
| Character drivers such as `random`, `pty` or `log` | Restarted | Depends on the driver: open devices may return errors |
| Network stack (`lwip`) | `/etc/rs.lwip` restarts it and the network daemons | No. Every open socket is lost |
| A file system server (MFS, isofs, pfs…) | It asks for a stateful restart, which only succeeds after a *controlled* crash | No |
| VFS, PM, VM, RS, `tty`, `memory`, the kernel | Stateful restart refused, or not attempted | No: the system stops |

The reason for the last two rows: a server like VFS holds the state of every
open file in every process. A fresh copy would know nothing about them.
Upstream research built a way to copy the old instance's memory into the new
one, but it only trusts that memory when the crash was *controlled*, that is,
triggered on purpose at a known point (for example with
`minix-service fi <label>`). After a real crash, `libsys` refuses with a
message like `crash was not controlled, aborting transparent restart`, and RS
then stops, because it cannot run the system without a core server. Recovering
core servers from arbitrary crashes needs the checkpointing instrumentation
of the research builds, which {{name}} does not build.

:::caution[Live update]
MINIX 3 can also replace a running service with a new version without
stopping it, transferring its state automatically (`minix-service update`).
This is upstream research work (Giuffrida's thesis, below). Upstream it was
experimental and only on i386, and it needs a special LLVM instrumentation
build. On {{name}}'s amd64 development branch the upstream test that covers
restart policies and live update, `testrelpol`, is a **known failure**. Do
not rely on live update.
:::

## Further reading

- J. N. Herder, H. Bos, B. Gras, P. Homburg, A. S. Tanenbaum, *Failure
  Resilience for Device Drivers*, DSN 2007:
  <http://www.minix3.org/docs/jorrit-herder/dsn-dccs07.pdf>
- J. N. Herder et al., *Fault Isolation for Device Drivers*, DSN 2009:
  <http://www.minix3.org/docs/jorrit-herder/dsn-dccs09.pdf>
- J. N. Herder, D. C. van Moolenbroek et al., *Dealing with Driver Failures
  in the Storage Stack*, LADC 2009:
  <http://www.minix3.org/docs/jorrit-herder/ladc09.pdf>
- J. N. Herder, *Building a Dependable Operating System: Fault Tolerance in
  MINIX 3*, PhD thesis, Vrije Universiteit Amsterdam, 2010:
  <http://www.minix3.org/theses/herder_phd_thesis.pdf>
- C. Giuffrida, *Safe and Automatic Live Update*, PhD thesis, Vrije
  Universiteit Amsterdam, 2014:
  <http://www.minix3.org/theses/Cristiano_Giuffrida_PhD_thesis.pdf>
- Upstream wiki: the reliability overview
  (<https://wiki.minix3.org/doku.php?id=www:documentation:reliability>), SEF
  (<https://wiki.minix3.org/doku.php?id=developersguide:sef>) and live update
  (<https://wiki.minix3.org/doku.php?id=developersguide:liveupdate>).

Try it: the [break-a-driver lab](/en/docs/learn/lab-break-a-driver/).
