---
title: "Lab: break a driver"
description: "A hands-on lab: crash the network and disk drivers of a running {{name}} system and watch it repair itself."
sidebar:
  order: 4
---

In this lab you crash device drivers on a running {{name}} system, on
purpose, and check that the system notices and repairs itself while your
programs keep working. Then you find the limits: a service that is not
restarted, and a server whose crash stops the machine.

Read [Isolation and self-repair](/en/docs/learn/reliability/) first, or keep
it open next to you. Allow about an hour.

:::note[What has and has not been checked]
Every command, file and label on this page was checked against the
{{name}} source code. The **output** shown was not captured from a running
system for this page: where it says "something like", the text comes from the
`printf` calls in the source, and the exact numbers will differ. If what you
see is different, that is worth reporting on the
[issue tracker]({{issues}}).
:::

## 0. Set up

Boot the live ISO in QEMU as in the [quickstart](/en/docs/start/quickstart/),
with BIOS (not UEFI) and the default machine type. That gives you an Intel
e1000 network card and an IDE CD drive, which are the drivers this lab uses:

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -cdrom {{iso}}
```

Log in as `root`. You will want two terminals: the console gives you four,
switch with **Alt+F1** to **Alt+F4** (or Alt+Left and Alt+Right). If your
QEMU window keeps those keys for itself, run the long commands in the
background with `&` instead.

**Optional: make RS talk.** By default the Reincarnation Server restarts
services silently. If you add `rs_verbose=1` to the kernel command line
(choose *Edit menu option* in the boot menu), RS prints a line starting with
`RS:` for each step of a restart. This is read from the boot parameters in
[`rs/main.c`]({{repo}}/blob/{{branch}}/minix/servers/rs/main.c); we have not
tried it on the live ISO.

## 1. Find the driver

Every system service has a **label** and an entry in `/proc/service`:

```sh
ls /proc/service
```

Look for `e1000_0` (the first e1000 card) and for your disk driver,
`at_wini_0` on the default QEMU machine. Read the network driver's entry:

```sh
cat /proc/service/e1000_0
```

```text
filename: e1000
endpoint: 72
pid:      46
restarts: 0
flags:    A--------
policies: reset
ASRcount: 0
```

Something like that: the numbers will differ. Write down the `endpoint`,
`pid` and `restarts` values. The `reset` policy means "restarts are visible to
users and the endpoint changes". The driver is also an ordinary process:

```sh
ps -ax | grep e1000
```

Questions to answer in your notes: what PID and parent does it have? Look for
`/etc/system.conf.d/e1000`: which kernel calls may this driver make?

## 2. Get some traffic going

Check that the network interface (`em0`, the name the e1000 driver gives it)
has an address. QEMU's built-in network hands out `10.0.2.15`:

```sh
ifconfig em0
```

If there is no `inet` line, ask for an address with DHCP:

```sh
dhcpcd em0
```

On the second console (Alt+F2, log in as root again), start a ping to QEMU's
gateway and leave it running:

```sh
ping 10.0.2.2
```

Each reply line carries an `icmp_seq` number. A gap in those numbers means
lost packets.

For a better test, keep a TCP transfer running too. On the **host**, serve a
large file:

```sh
dd if=/dev/urandom of=big.bin bs=1M count=500
python3 -m http.server 8000
```

and download it in the guest, throwing the data away:

```sh
ftp -o /dev/null http://10.0.2.2:8000/big.bin
```

## 3. Kill the network driver

Back on the first console, kill the driver with the PID you found:

```sh
kill -9 46
```

You are root, so this is allowed: PM passes the `SIGKILL` to the kernel,
which hands it to RS, the driver's signal manager. RS sees that the driver
died and starts a new copy straight away. Check:

```sh
cat /proc/service/e1000_0
ps -ax | grep e1000
```

You should see a new `pid`, a new `endpoint` and `restarts: 1`. Unless you
turned on `rs_verbose`, RS itself prints nothing.

Now look at the ping and the download. Expect a short gap in `icmp_seq`, and
a short stall in the transfer while TCP retransmits, and then both carry on.
The network stack (`lwip`) learned about the new driver from DS, the data
store, and set the card up again.

## 4. Crash it from the inside

`kill -9` stops the driver from the outside. To make it fail the way a buggy
driver does, ask RS to inject a crash. The driver then calls `panic()` itself:

```sh
minix-service fi e1000_0
```

This time the console shows the driver's last words, something like:

```text
e1000(72): panic: Crash!
syslib:panic.c: stacktrace: 0x... 0x... 0x...
```

(the format is in
[`libsys/panic.c`]({{repo}}/blob/{{branch}}/minix/lib/libsys/panic.c)).
Check `/proc/service/e1000_0` again: `restarts` has gone up.

Repeat it four or five times in a row and time how long the driver takes to
come back. RS waits longer after each failure (2, 4, 8, 16 seconds, at most
30) so that a driver that crashes on every start cannot keep the machine busy.
While it waits, the entry may be missing from `/proc/service`.

## 5. A disk driver

Now the driver under the root file system. On the live ISO the root file
system is the CD itself, read through `isofs` and the `at_wini_0` driver
(`ahci_0` on a `q35` machine). `/tmp`, `/var` and `/root` are RAM disks
served by `memory`; **do not** kill `memory`, it is a core service.

```sh
cat /proc/service/at_wini_0
kill -9 <its pid>
ls -lR /usr/share > /dev/null && echo still reading
```

The disk drivers are started with an in-memory copy of their binary
(`minix-service -c`), so RS can restart them without reading the disk they
drive. The file system's block layer sees the request fail with the old
driver, waits for the new endpoint and retries. The `ls` should finish,
perhaps after a pause.

:::caution
This case is riskier than the network one. If the system hangs, that is a
real finding: note what you did and restart the VM. It is safer still on an
installed system in a disposable disk image.
:::

## 6. When the system does not repair itself

**A service that is told to stay down.** `minix-service down` stops a service
on purpose, and RS does not restart it:

```sh
minix-service down e1000_0
ls /proc/service | grep e1000
ifconfig -a
```

The ping stops getting replies, and the rest of the system keeps working.
Bring the driver back with the same command `/usr/etc/rc` uses at boot, then
rerun `dhcpcd em0` if the address is gone:

```sh
minix-service up /service/e1000 -label e1000_0 -args instance=0 -period 5HZ
```

The same happens with services started with `minix-service run`, which uses
the recovery script `/etc/rs.single` to bring the service down instead of
restarting it.

**A core server.** Do this last: it is expected to stop the machine. Find the
PID of `vfs` with `ps -ax` and kill it:

```sh
kill -9 <pid of vfs>
```

RS starts VFS's backup copy, but VFS asks for a *stateful* restart, and
`libsys` refuses it because the crash was not controlled. Reading the source,
you should see something like:

```text
SEF(1): crash was not controlled, aborting transparent restart
core system service died: ...
```

and then the system stops. VFS holds every open file of every process; a
fresh copy would know none of them.

## Questions

1. After step 3 the driver had a new endpoint. Why can't the network stack
   keep using the old one? What would go wrong if endpoints were plain slot
   numbers? (See [Message passing](/en/docs/learn/message-passing/#endpoints).)
2. Why did TCP survive the driver crash, while a crash of `lwip` itself
   (read [`/etc/rs.lwip`]({{repo}}/blob/{{branch}}/etc/rs.lwip)) loses every
   open connection?
3. In a monolithic kernel, what would most likely happen if the network driver
   dereferenced a bad pointer? What stopped that here?
4. Why are disk drivers started with `-c`? What would happen without it, if
   the driver's binary lives on the disk it drives?
5. Why does RS wait longer after each crash? Give a failure for which
   restarting immediately and forever would be harmful.
6. Try `kill -9` on the PIDs of `pm` and of `vm`. Read `check_sig()` and
   `sig_proc()` in
   [`minix/servers/pm/signal.c`]({{repo}}/blob/{{branch}}/minix/servers/pm/signal.c):
   what does the code do in each case, and why?
7. Which recovery is *transparent* (programs do not notice) and which is only
   *visible but survivable*? Use your notes from steps 3 to 6.
8. Live update would replace a driver with a new version without restarting
   it. What extra problem does it have to solve that a restart does not?

## Further reading

- J. N. Herder et al., *Failure Resilience for Device Drivers*, DSN 2007:
  <http://www.minix3.org/docs/jorrit-herder/dsn-dccs07.pdf>
- The upstream reliability overview:
  <https://wiki.minix3.org/doku.php?id=www:documentation:reliability>
- [`minix-service(8)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/minix-service.8)
  and the RS sources in
  [`minix/servers/rs/`]({{repo}}/blob/{{branch}}/minix/servers/rs/).
