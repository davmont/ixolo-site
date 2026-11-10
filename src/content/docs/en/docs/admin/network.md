---
title: "Networking"
description: "Network drivers, DHCP and static addresses, IPv6, DNS, the lwIP server, SSH and TLS certificates."
sidebar:
  order: 3
---

Networking in {{name}} is three kinds of user process talking by messages:
a **driver** per network card, the **lwIP server** with the TCP/IP stack and
the sockets, and the programs that use them. Configuration is NetBSD's:
`/etc/rc.conf`, one `/etc/ifconfig.<interface>` file per card, `dhcpcd`,
`ifconfig` and `route`.

## Network cards

At boot, `/usr/etc/rc` reads the PCI IDs of the Ethernet devices in
`/proc/pci`, matches them against the driver descriptions in
`/etc/system.conf.d/`, and starts one driver instance per card (labels
`e1000_0`, `e1000_1`…). Each driver names its interfaces:

| Driver | Hardware | Interface | Status on amd64 |
|---|---|---|---|
| `e1000` | Intel PRO/1000 family (82540EM, 82574L…) | `em0` | **Tested** with QEMU's `e1000` (82540EM), used by the network benchmarks and the SSH tests. Other listed models, such as QEMU's `e1000e`, are matched but less exercised. |
| `igc` | Intel I225/I226 2.5 GbE | `igc0` | Initial driver: one queue, no offloads. Not verified on hardware. |
| `virtio_net` | virtio network (QEMU, KVM) | `vio0` | Built; untested on amd64. |
| `rtl8139`, `rtl8169` | Realtek | `rl0`, `re0` | Built; untested on amd64. |
| `fxp`, `3c90x`, `atl2`, `dec21140A`, `ip1000`, `lance`, `vt6105` | Older PCI cards | various | Built; untested on amd64. |
| `dp8390`, `dpeth` | Old ISA cards (NE2000, 3Com) | `dp0`, `dpe0` | Not detected automatically: set up with `netconf`, option *Manually configure*. Untested on amd64. |

"Untested" means exactly that: the driver compiles for amd64, but nobody has
reported it working. Reports are welcome in the [issue tracker]({{issues}}).
There is no Wi-Fi support.

In QEMU, use an e1000 card (the default on `-machine pc`):

```sh
qemu-system-x86_64 ... -nic user,model=e1000
```

List the interfaces the system found:

```sh
ifconfig -l          # em0 lo0
netconf -l           # hardware interfaces, and whether they are configured
```

## Configure with netconf

`netconf` is the interactive tool, also run by `setup` (step 8). It lists the
interfaces and offers:

1. DHCP, IPv4 and IPv6
2. DHCP, IPv4 only
3. A static IPv4 address, netmask, gateway and DNS servers

It writes `/etc/ifconfig.<interface>` (and, for a static setup,
`/etc/hostname.file` and `/etc/resolv.conf`). Apply the result without
rebooting:

```sh
service network restart
```

## The configuration files

### /etc/ifconfig.\<interface\>

At boot, `/etc/rc.d/network` reads one file per interface (with
`auto_ifconfig=YES`, the default). Each line is either arguments for
`ifconfig`, or a shell command after `!`, where `$int` is the interface name.
This is what `netconf` writes for DHCP:

```text
up
!dhcpcd -qM $int
```

For a static address:

```text
up
inet 192.168.1.20 netmask 255.255.255.0
!route -q add default 192.168.1.1
```

IPv6 addresses go on `inet6` lines in the same file. The format is NetBSD's
`ifconfig.if(5)`.

### /etc/rc.conf

Defaults are in `/etc/defaults/rc.conf`; put your changes in `/etc/rc.conf`.
The variables that matter for networking:

| Variable | Default | Meaning |
|---|---|---|
| `auto_ifconfig` | `YES` | Configure every interface that has an `/etc/ifconfig.*` file. |
| `net_interfaces` | `""` | The interfaces to configure, if `auto_ifconfig=NO`. |
| `dhcpcd` | `NO` | Run `dhcpcd` as a daemon for all interfaces. Not needed when the interface file starts it, as `netconf` does. |
| `dhcpcd_flags` | `-qM` | Flags for that daemon. |
| `ip6mode` | `host` | `host`, `autohost` (accept router advertisements) or `router` (forward IPv6). |
| `hostname` | `""` | Host name; `/etc/hostname.file` is also read at boot. |
| `defaultroute`, `defaultroute6` | `""` | A default gateway, as an alternative to a `route` line in the interface file. |
| `sshd` | `NO` | Start the SSH server. |
| `certctl_init` | `YES` | Fill `/etc/openssl/certs` on the first boot that finds it empty. |
| `inetd` | `YES` | The Internet super-server (`/etc/inetd.conf`). |
| `named` | `NO` | The BIND DNS server. |

### DNS

The resolver reads `/etc/resolv.conf`. With DHCP, `dhcpcd` fills it through
`resolvconf`. For a static setup, write it yourself (or let `netconf` do it):

```text
nameserver 192.168.1.1
nameserver 9.9.9.9
```

`/etc/hosts` works as usual. `dig`, `host` and `nslookup` (from BIND
9.20.24) are in base for testing.

## dhcpcd

The DHCP client is dhcpcd 10.3.1 (ISC's `dhclient` was removed). It handles
IPv4 leases, and IPv6 router solicitation and DHCPv6 when not limited with
`-4`. Its hooks in `/libexec/dhcpcd-hooks` update `resolv.conf` and the host
name. Configuration is in `/etc/dhcpcd.conf`; see `dhcpcd.conf(5)`.

## IPv6

The stack is built with IPv6, including fragment reassembly and forwarding.
`ping6`, `traceroute6`, `ndp` and `rtadvd` are in base. To get an address
automatically, choose "DHCP (IPv4 + IPv6)" in `netconf`; for a static one,
add an `inet6` line to the interface file:

```text
inet6 2001:db8::20 prefixlen 64
```

## The lwIP server

The TCP/IP stack is [lwIP](https://savannah.nongnu.org/projects/lwip/)
2.2.1, with later upstream security fixes, running as an ordinary process,
`/service/lwip`. It implements the BSD socket API for TCP, UDP, raw IP,
routing sockets and BPF (`/dev/bpf`, used by `tcpdump`). Local
(Unix-domain) sockets are a separate server, `uds`.

{{name}} has added to it:

- TCP **window scaling**, **SACK** and **timestamps** (RFC 7323, RFC 2018),
  a 128 KB receive window and larger send buffers. On a link with 20 ms of
  round-trip time, throughput between two VMs went from 0.67 to 2.51 MB/s.
- `SO_REUSEPORT`, which spreads incoming connections across several
  listening sockets (BIND's multi-threaded `named` needs it).
- NetBSD's multicast socket options, link state in `ifconfig`, and
  `accept4`/`paccept`.

### What a restart means

If lwIP crashes, RS restarts it like any other service, using the recovery
script `/etc/rs.lwip`. A new lwIP has none of the old state, so:

- every open socket is gone: established TCP connections break, and programs
  must reconnect;
- the script stops and restarts the known network daemons (`dhcpcd`,
  `inetd`, `sshd`, `syslogd`, `named`, `network`…) so that they reopen
  their sockets and the interfaces are configured again.

A crashed **network driver** is cheaper: RS restarts it, lwIP reattaches the
new process to the same interface, and the configuration and the sockets
survive. At most some packets are lost and TCP resends them. Try it in the
[break-a-driver lab](/en/docs/learn/lab-break-a-driver/).

## Tools

| Tool | Use |
|---|---|
| `ifconfig` | Addresses, flags and link state of the interfaces |
| `route` | The routing table: `route show`, `route add default <gw>` |
| `netstat` | Sockets and statistics: `netstat -an`, `netstat -rn` |
| `ping`, `ping6` | Reachability |
| `traceroute`, `traceroute6` | The path to a host |
| `arp`, `ndp` | Neighbour caches (IPv4, IPv6) |
| `tcpdump` | Packet capture (4.99.6) |
| `ftp` | Downloads over FTP, HTTP and HTTPS: `ftp https://example.org/file` |
| `telnet` | Test a TCP port |

## SSH

OpenSSH {{openssh}} is in base: `ssh`, `scp`, `sftp`, `ssh-keygen`,
`ssh-agent` and the server `sshd`. It is built without PAM and without FIDO
security keys. The client works out of the box:

```sh
ssh alice@server.example.org
```

The server is off by default. Enable it and start it; the first start
creates the ECDSA, Ed25519 and RSA host keys:

```sh
echo sshd=YES >> /etc/rc.conf
service sshd start
```

The configuration is `/etc/ssh/sshd_config`. As in stock OpenSSH, `root` may
log in only with a key (`PermitRootLogin prohibit-password`). Users need a
password set with `passwd`, or a key in `~/.ssh/authorized_keys`.

To reach the guest's SSH server from a QEMU host, forward a port:

```sh
qemu-system-x86_64 ... -nic user,model=e1000,hostfwd=tcp::2222-:22
ssh -p 2222 alice@localhost      # on the host
```

The live ISO has a read-only `/etc`, so run the server on an installed
system.

## TLS certificates

Programs that use OpenSSL (3.5.7) verify servers against the trust anchors in
`/etc/openssl/certs`. They come from Mozilla's CA list, installed in
`/usr/share/certs/mozilla`, and `certctl` builds the directory from them:

```sh
certctl list          # trusted certificates
certctl rehash        # rebuild /etc/openssl/certs after a change
```

On an installed system, `certctl_init=YES` builds the directory on the first
boot. The live ISO carries it prebuilt. To trust a local CA, put its
certificate in a directory of its own, add a `path` line for that directory to
`/etc/openssl/certs.conf` and run `certctl rehash`. `certctl untrust`
distrusts a certificate. See `certctl(8)`.

## Further reading

- NetBSD manual pages: [ifconfig.if(5)](https://man.netbsd.org/ifconfig.if.5),
  [rc.conf(5)](https://man.netbsd.org/rc.conf.5),
  [dhcpcd(8)](https://man.netbsd.org/dhcpcd.8),
  [certctl(8)](https://man.netbsd.org/certctl.8)
- Upstream MINIX 3 network guide (older stack and releases):
  <https://wiki.minix3.org/doku.php?id=usersguide:networkconfiguration>
