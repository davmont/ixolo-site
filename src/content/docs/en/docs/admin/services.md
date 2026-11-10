---
title: "Services and the Reincarnation Server"
description: "How system services are started, watched and restarted, and how ordinary daemons fit in."
sidebar:
  order: 1
---

{{name}} runs two different kinds of background programs, and they are
managed by two different mechanisms. Knowing which is which saves a lot of
confusion.

| | System services | Daemons |
|---|---|---|
| Examples | `vfs`, `pm`, `mfs`, `e1000`, `ahci`, `lwip`, `tty` | `sshd`, `syslogd`, `cron`, `inetd`, `dhcpcd` |
| What they are | The operating system itself: servers and drivers in user mode | Ordinary Unix programs |
| Started by | The Reincarnation Server (RS), on request of `minix-service` | `/etc/rc` and the scripts in `/etc/rc.d` |
| Privileges from | `/etc/system.conf` and `/etc/system.conf.d/` | User ID, as on any Unix |
| Restarted on crash | Yes, by RS | No |
| Controlled with | `minix-service up/down/refresh ...` | `service sshd start`, `/etc/rc.d/sshd stop` |

## System services and RS

In a microkernel system the file systems, the network stack and every driver
are separate processes. The Reincarnation Server (RS) is the one that starts
them, gives them their privileges and watches them. If one dies, RS starts a
fresh copy. The [architecture page](/en/docs/learn/architecture/) explains why
the system is built this way; this page covers how to operate it.

The first services (`rs`, `vm`, `pm`, `sched`, `vfs`, `ds`, `tty`, `memory`,
`mib`, `pfs`, the boot ramdisk's file system and `init`) are in the boot image.
All the others are started later from the boot scripts with `minix-service`.

### The minix-service command

`/sbin/minix-service` sends requests to RS. Upstream MINIX called it
`service`; on {{name}} the name `service` belongs to the NetBSD command that
runs rc.d scripts (see [below](#daemons-rcd-and-rcconf)).

| Command | What RS does |
|---|---|
| `minix-service up /service/<binary> [options]` | Start a new service and restart it if it dies. The path must be absolute. |
| `minix-service run /service/<binary> [options]` | Start it, but do not restart it when it exits. For short-lived programs that need service privileges. |
| `minix-service down <label>` | Stop the service and do not restart it. Core services refuse. |
| `minix-service refresh <label>` | Kill the service and start a fresh copy. |
| `minix-service restart <label>` | Restart a service that has already terminated. Only valid from a recovery script. |
| `minix-service edit <binary> -label <label> [options]` | Change the settings of a running service, including those in the boot image. |
| `minix-service clone <label>` | Keep a spare copy of the service, used to restart it. |
| `minix-service update <binary> [options]` | Live update: replace a running service with a new binary. See [live update](#live-update). |
| `minix-service shutdown` | Tell RS the system is going down, so it restarts nothing. |

The options of `up` (and `run`, `edit`, `update`):

| Option | Meaning |
|---|---|
| `-label <name>` | Name that identifies the service. Default: the program name. |
| `-args "<args>"` | Command-line arguments for the service. |
| `-dev <special>` | Device file the driver serves, for example `-dev /dev/random`. |
| `-period <ticks>` | Heartbeat period. Append `HZ` for seconds: `-period 5HZ`. |
| `-script <path>` | Recovery script to run instead of a plain restart. |
| `-config <path>` | Read the privileges from this file instead of `/etc/system.conf`. |
| `-c` | Keep a copy of the binary in memory and restart from it, not from disk. Needed for the disk driver. |
| `-n` | Return at once; do not wait for the service to finish initializing. |
| `-b` | Restart without the growing delay (see [restart policy](#how-rs-watches-a-service)). |
| `-p` | Keep a replica in the background and restart from it. |

Examples, taken from the boot scripts:

```sh
minix-service up /service/random -dev /dev/random -period 3HZ
minix-service up /service/is -period 5HZ
minix-service down usbd
```

Service binaries live in `/service`. The full reference is
`man minix-service` and `man system.conf`.

### /etc/system.conf: least privilege

Every service gets only the privileges listed for it in a `service` entry.
The boot services are in `/etc/system.conf`; each driver installs its own file
in `/etc/system.conf.d/`, named after the program. This is the entry for the
Intel network driver, `/etc/system.conf.d/e1000`:

```text
service e1000
{
	type net;
	descr "Intel PRO/1000 Gigabit";
	system
		UMAP            # 14
		IRQCTL          # 19
		DEVIO           # 21
	;
	pci device      8086:100e;
	pci device      8086:100f;
	# ... more device IDs ...
	ipc
		SYSTEM pm rs log tty ds vm
		pci inet lwip ;
};
```

The driver may make three kernel calls, talk to the listed processes only, and
touch only the PCI devices with those IDs. It cannot open files, touch other
devices or send messages to the disk driver.

| Key | Meaning | Default |
|---|---|---|
| `uid` | User ID the service runs as. | `service` (uid 12) |
| `ipc` | Processes it may send messages to: `ALL`, `ALL_SYS` (no user processes), `NONE`, or a list of program names. `SYSTEM` means the kernel, `USER` means user processes. | `ALL_SYS` |
| `system` | Kernel calls it may make: `ALL`, `BASIC`, `NONE`, or a list. | `BASIC` |
| `vm` | VM calls it may make, same forms as `system`. | `BASIC` |
| `io` | I/O port ranges, `base:length`. | `NONE` |
| `irq` | Interrupt lines. | `NONE` |
| `pci device` | PCI `vendor:device` IDs it may claim, optionally with `/subvendor:subdevice`. | none |
| `pci class` | PCI classes it may claim, `class/subclass/progif`. | none |
| `sigmgr` | Which service handles its signals (usually `rs`). | see `<minix/priv.h>` |
| `scheduler` | `KERNEL` or the label of a scheduler (usually `sched`). | see `<minix/priv.h>` |
| `priority`, `quantum` | Scheduling queue and time slice in ms. | see `<minix/priv.h>` |
| `control` | Other services allowed to ask RS to act on this one. | none |
| `type`, `descr` | Service type (`net` for network drivers) and a description. | none |

`/etc/rc.minix` applies `/etc/system.conf` to the boot services at startup
(`minix-service edit`), so changes to their entries take effect on the next
boot. For a driver you start yourself, edit its file in `/etc/system.conf.d/`
and start it again.

## How RS watches a service

RS learns about a failure in three ways:

- **The process dies.** A crash, a panic or a fatal signal (`kill -9` included)
  ends the process, and RS is told.
- **No heartbeat.** A service started with `-period` gets a ping from RS every
  period. If it has not answered after two periods, RS kills it and treats it as
  crashed. Network drivers are started with `-period 5HZ`, `random` with `3HZ`.
- **Startup timeout.** A service has 10 seconds to finish initializing.

What happens next:

1. The first unexpected exit is restarted at once.
2. Repeated exits are restarted after a delay that doubles each time (2, 4, 8,
   16 s), up to 30 s. `-b` turns the delay off; a service restarted from an
   in-memory copy (`-c`) waits at most one second.
3. If the service has a recovery script (`-script`), RS runs it instead, with
   the label, the reason (`terminated`, `no-heartbeat` or `restart`) and the
   restart count as arguments. The script decides what to do.
4. If a *core* service dies (one marked critical in the boot image), the
   system cannot continue and panics.

The network stack is a good example of a recovery script. `lwip` runs with
`-script /etc/rs.lwip`. That script brings `lwip` back up and then restarts
every network daemon in `/etc/rc.d` (`dhcpcd`, `sshd`, `inetd`, `syslogd`...),
because their sockets died with the old stack. `/etc/rs.single` is the
opposite: it just brings the service down; `minix-service run` uses it.

To watch a restart happen, follow the
[break-a-driver lab](/en/docs/learn/lab-break-a-driver/).

## What is running, and what RS logged

```sh
ls /proc/service                 # one file per service label
cat /proc/service/e1000_0        # program, endpoint, pid, restart count, flags
ps -ax                           # services show up as ordinary processes
```

`/proc/service/<label>` has a `restarts:` line: a non-zero value means the
service has crashed and been replaced since boot.

RS and the other services print their messages to the console. The `log`
driver also keeps them in `/dev/klog`, which `syslogd` (on by default) copies
to `/var/log/messages`:

```sh
grep RS: /var/log/messages
```

For more detail, add `rs_verbose=1` to the boot parameters. On the console,
the information server `is` dumps internal tables on function keys: F1 the
kernel process table, F4 the privileges, F7 the kernel messages and Shift+F6
the RS table.

## Daemons: rc.d and rc.conf

Everything that is not an operating-system service is started the NetBSD way.
`init` runs `/etc/rc`, which runs the scripts in `/etc/rc.d` in the order that
`rcorder` works out from their `REQUIRE` and `PROVIDE` lines. The first script,
`minixrc`, runs `/etc/rc.minix`. That script starts the early system services,
checks and mounts the file systems in `/etc/fstab` and starts `usbd` and
`devmand`. `/usr/etc/rc` then starts the network drivers, `lwip`, `pty`, `uds`
and `log`.

Which daemons run is set in `/etc/rc.conf`. Defaults are in
`/etc/defaults/rc.conf` (NetBSD's) and `/etc/defaults/minix.rc.conf`. Do not
edit the defaults; override them in `/etc/rc.conf`:

```sh
# /etc/rc.conf
sshd=YES
dhcpcd=YES
```

Some defaults worth knowing:

| Variable | Default | Effect |
|---|---|---|
| `syslogd` | `YES` | System log to `/var/log/messages`. |
| `cron` | `YES` | Periodic jobs. |
| `inetd` | `YES` | Internet super-server. |
| `certctl_init` | `YES` | Fills `/etc/openssl/certs` on first boot. |
| `sshd` | `NO` | OpenSSH server. See [security](/en/docs/admin/security/). |
| `dhcpcd` | `NO` | DHCP client as a daemon. `netconf` can also start it per interface. |
| `named` | `NO` | BIND DNS server. |
| `wlcompd`, `fbcompd` | `NO` | Graphical compositors. See [desktop](/en/docs/admin/desktop/). |

Start, stop and query daemons by hand with `service` or the script itself:

```sh
service sshd start
service sshd status
/etc/rc.d/sshd restart
service sshd onestart     # run once even though sshd=NO
service -e                # list the enabled scripts
```

A daemon that crashes stays down: RS does not watch daemons.

## Live update

`minix-service update` asks RS to replace a running service with a new binary
while keeping its state, without a reboot. It comes from upstream MINIX 3,
where it was a research feature: experimental, documented as "in an early stage
of development", and only on i386. Stateful updates also need a specially
instrumented build (`MKMAGIC`), which has not been tested on amd64.

On {{name}} it is **not supported**. The upstream live-update test,
`testrelpol`, is a known failure on amd64. The command is still there, but do
not rely on it on a system you care about. Restart (`refresh`) works, and is
what RS does after a crash.

## Further reading

- `man minix-service`, `man system.conf`, `man rc.conf`, `man service`
- [The architecture in four layers](/en/docs/learn/architecture/)
- Upstream background (not specific to {{name}}):
  [reliability](https://wiki.minix3.org/doku.php?id=www:documentation:reliability),
  [live update](https://wiki.minix3.org/doku.php?id=developersguide:liveupdate)
