---
title: "Security"
description: "The security model, the hardening on amd64, what is still missing, and how to report a vulnerability."
sidebar:
  order: 4
---

This page describes what protects a {{name}} system today, on amd64, and
what does not exist yet. It is meant to help you judge where the system fits,
not to sell it. {{name}} is a young fork with a single maintainer and no
outside security audit.

## The model: isolation and least privilege

The main security property comes from the design. Drivers, file systems, the
network stack and the other servers are separate user-mode processes, not
code inside the kernel. Each one runs with only the privileges listed for it in
`/etc/system.conf` or `/etc/system.conf.d/<name>`:

- which **kernel calls** it may make (`system`);
- which **processes** it may send messages to (`ipc`);
- which **I/O ports**, **IRQ lines** and **PCI devices** it may use (`io`,
  `irq`, `pci device`);
- the **user ID** it runs as (most drivers: the unprivileged `service` user).

A service cannot read another process's memory directly. It can only copy
memory that the owner has explicitly granted to it (memory grants, checked by
the kernel). A bug in the FAT server or the network card driver is therefore
contained: the faulty process can be killed and restarted by the Reincarnation
Server without taking the kernel down, and it never had the rights to touch
unrelated hardware or files. The [services page](/en/docs/admin/services/)
explains the configuration keys.

Limits of this model, today:

- Drivers that do DMA program the device directly, and no IOMMU (VT-d or
  AMD-Vi) restricts where the device writes. A compromised driver of a
  bus-mastering device can reach any physical memory.
- Many core servers (`vfs`, `pm`, `vm`, `rs`) run as root with wide
  privileges, as they must.
- Ordinary user programs are protected from each other by the usual Unix
  permissions, and nothing more: there is no mandatory access control or
  sandboxing framework.

## Kernel and memory protection

| Feature | Status | Notes |
|---|---|---|
| NX (no-execute) | on | Memory mapped without `PROT_EXEC`, including stacks, is not executable. `mprotect` is honoured. |
| SMEP and SMAP | on when the CPU has them | The kernel can neither execute nor, by accident, read or write user pages. Not required: older CPUs boot without them. |
| User pointer checks | on | The kernel refuses a system call buffer that points into kernel memory ([PR #440]({{repo}}/pull/440)). |
| Write protection on all CPUs | on | `CR0.WP` is set on every processor, not only the first. |
| Hardened system call entry | on | User flags such as the trap flag no longer leak into the kernel on `SYSCALL`. |
| 47-bit user address space | on | User processes get 128 TB of virtual address space. Services started by RS stay below 1 GB. |

## Hardening of user programs

| Feature | Status | Scope |
|---|---|---|
| Stack protector (`-fstack-protector`) | on | User programs and libraries. The guard value comes from the kernel's random source and differs between processes. |
| `_FORTIFY_SOURCE=2` | on | User programs and libraries; libc itself opts out. Overflows that the compiler can detect end in `SIGABRT`. |
| ASLR | partial | The stack and the `mmap` base (shared libraries, `malloc` arenas) are randomized at each `exec`. |
| PIE executables | **no** | Executables are linked at a fixed address. |
| RELRO | **no** | |

Two consequences you should know about:

- **ASLR is partial.** Because executables are not position-independent,
  their code, data and `brk` heap are at the same address in every run. Only
  the stack and the `mmap` area move. Exploits that rely on code from the main
  program are not hindered.
- **The kernel and the system services are not built with the stack protector
  or FORTIFY.** Those options only cover user programs and the libraries they
  link. Services started by RS also keep a fixed memory layout, which live
  update expects.

## Accounts and passwords

- The installation media log `root` in **without a password**. That is fine
  for a live CD, not for a network-facing machine.
- `setup` asks for a root password for the installed system (step 9) and
  refuses an empty one.
- New passwords are hashed with **bcrypt** (`localcipher = blowfish,10` in
  `/etc/passwd.conf`). Older hashes keep working.

After installing, create an ordinary user and use `su` for root work:

```sh
useradd -m -G wheel alice
passwd alice
```

## Remote access: OpenSSH

OpenSSH {{openssh}} is in the base system (`ssh`, `sshd`, `scp`, `sftp`), built
without PAM and without FIDO2 security-key support. The server is off by
default. To enable it, add this to `/etc/rc.conf`:

```sh
sshd=YES
```

Then start it, or reboot:

```sh
service sshd start
```

On the first start, `/etc/rc.d/sshd` generates the ECDSA, Ed25519 and RSA host
keys in `/etc/ssh`. The stock `sshd_config` is used: `root` may log in with a
key but not with a password. Check the host key fingerprints from the console
before you trust them from a client:

```sh
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

Network setup is covered in [networking](/en/docs/admin/network/).

## TLS: OpenSSL and CA certificates

The system ships **OpenSSL 3.5.7**, the 3.5 long-term support branch, and the
Mozilla set of CA certificates. `certctl` builds the trust store in
`/etc/openssl/certs`, where OpenSSL looks for it:

- On an installed system, the rc.d script `certctl_init` (on by default) runs
  `certctl rehash` on the first boot.
- The live CD has the trust store built into the image.
- After adding or removing a certificate, run `certctl rehash`. `certctl list`
  shows the trusted certificates and `certctl untrust <file>` distrusts one.

With the store in place, `ftp https://...` and `openssl s_client` verify
servers.

## What is not there yet

So that there are no surprises:

- **PIE executables** and full ASLR. Planned.
- **RELRO**.
- **Stack protector and FORTIFY for the kernel and system services.**
- **UEFI Secure Boot.** The ISO boots under UEFI, but it is not signed.
- **IOMMU** protection against DMA from devices.
- **Live update** of services as a security-patch mechanism: it is
  experimental and not supported on amd64.
- **No binary package repository**, so no automatic security updates. You
  update by rebuilding from source.

## Reporting a vulnerability

Please report security problems **privately**, not in a public discussion,
issue or pull request.

- Use GitHub's private vulnerability reporting on the repository: the
  **Security** tab of [{{repo}}]({{repo}}), then **Report a vulnerability**. The
  report is visible only to the maintainer, {{maintainer}}.
- Include the affected commit or ISO, the steps to reproduce, and what an
  attacker gains. A small test program helps a lot.

:::note
The repository has no `SECURITY.md` file yet, and private reporting may not
be switched on when you read this. If the **Report a vulnerability** button is
missing, contact {{maintainer}} through GitHub and ask for a private channel
before sending any details.
:::
