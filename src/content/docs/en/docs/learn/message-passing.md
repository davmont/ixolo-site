---
title: Message passing
description: How processes in {{name}} talk to each other and to the kernel, on amd64.
sidebar:
  order: 2
---

In {{name}} almost every interesting operation is a conversation between
processes. A program asks VFS to read a file, VFS asks a file system server,
the file system server asks a disk driver, and the driver asks the kernel to
do port I/O. Each of those steps is a **message**. This page explains what a
message is on amd64, the primitives that move it, and how bulk data travels
without breaking isolation.

The definitions live in
[`minix/include/minix/ipc.h`]({{repo}}/blob/{{branch}}/minix/include/minix/ipc.h),
[`ipcconst.h`]({{repo}}/blob/{{branch}}/minix/include/minix/ipcconst.h) and
[`endpoint.h`]({{repo}}/blob/{{branch}}/minix/include/minix/endpoint.h); the
kernel side is in [`minix/kernel/proc.c`]({{repo}}/blob/{{branch}}/minix/kernel/proc.c).

## Endpoints

Processes are addressed by **endpoint**, not by PID. An endpoint packs two
numbers into one `int`:

- the **slot** in the kernel's process table (negative for the five kernel
  tasks, 0 to 255 for processes);
- a **generation** number, shifted left by 15 bits, which goes up every time
  the slot is reused.

If a driver crashes and RS starts a new copy, the new process may get the same
slot, but it gets a different generation, so a different endpoint. A message
addressed to the dead driver's endpoint fails with `EDEADSRCDST` instead of
reaching the wrong process. This is what makes restarting services safe.

The core servers have fixed endpoints with generation 0, defined in
[`minix/include/minix/com.h`]({{repo}}/blob/{{branch}}/minix/include/minix/com.h):
`PM_PROC_NR` is 0, `VFS_PROC_NR` 1, `RS_PROC_NR` 2, and so on up to `init`
at 11. Everything else is looked up by name in DS.

## What a message looks like on amd64

A message is a fixed-size structure:

| Field | Size | Contents |
|---|---|---|
| `m_source` | 4 bytes | Sender's endpoint, filled in by the kernel; the sender cannot fake it |
| `m_type` | 4 bytes | Request code or reply status |
| payload | 96 bytes | A union of typed layouts |

That is **104 bytes** in total. The header asserts it at compile time
(`sizeof(message) == 104` on amd64). On i386 and ARM a message is 64 bytes
with a 56-byte payload; amd64 needs more room because pointers, `long` and
`size_t` are 8 bytes.

The payload is a union of named layouts, one per kind of request, such as
`m_ds_req`, `m_lsys_krn_sys_exec` or `m_notify`. Each one is checked with
`_ASSERT_MSG_SIZE()`, which on amd64 only requires the layout to fit in 96
bytes (on i386 it must be exactly 56). Some amd64 layouts no longer fit in 56
bytes, which is one reason the i386 build is broken on the development branch.

Fixed size matters: the kernel never allocates memory for a message, and a
message can always be copied in one go. Anything larger than 96 bytes goes
through a memory grant (below).

## The primitives

| Call | Blocks? | What it does |
|---|---|---|
| `ipc_send(dst, &m)` | yes | Waits until `dst` receives the message |
| `ipc_receive(src, &m, &status)` | yes | Waits for a message from `src`, or from `ANY` |
| `ipc_sendrec(dst, &m)` | yes | Sends, then waits for the reply in the same buffer. The usual way to make a request |
| `ipc_sendnb(dst, &m)` | no | Sends only if `dst` is already waiting; otherwise fails with `ENOTREADY` |
| `ipc_notify(dst)` | no | Sets a "you have news" bit for `dst`; no payload |
| `ipc_senda(table, n)` | no | Hands the kernel a table of messages to deliver when each receiver is ready |

There is no buffering in the kernel. `send` is a **rendezvous**: the message
is copied directly from sender to receiver when both are ready. Kernel calls
(`sys_*` functions in libsys) use the same message format through a separate
trap, `_do_kernel_call()`.

User programs may use only `sendrec`. Servers and drivers may use the others,
limited by the `ipc` list in their `system.conf` entry: a send to a process
not on the list fails with `ECALLDENIED`.

## Notifications and interrupts

`notify` carries no data, never blocks, and never queues more than one
pending notification per sender. When the receiver next calls `receive`, it
gets a message with `m_type` set to `NOTIFY_MESSAGE`, the sender's endpoint
and a timestamp.

Interrupts arrive the same way. A driver registers for an IRQ with the
`sys_irqsetpolicy()` kernel call. When the interrupt fires, the kernel's
handler only records it and sends a notification from the special `HARDWARE`
endpoint; the payload says which of the driver's interrupts are pending.
Depending on the policy the driver chose, the kernel re-enables the line at
once, or the driver does it with `sys_irqenable()` after it has dealt with the
device. No driver code ever runs in kernel mode.

RS uses notifications for heartbeats, and the clock task for alarms.

## Avoiding deadlock

Blocking calls can deadlock: A sends to B while B sends to A. The kernel
checks for cycles of blocked senders and receivers before it blocks a process,
and fails the call with `ELOCKED` instead of hanging.

The system is also built so cycles do not arise. Requests flow one way (user
program → server → driver → kernel) and replies flow back. A server that must
send to a process that might not be waiting uses `senda` or `notify`, which
never block: RS and PM use asynchronous sends for exactly this reason.

## Memory grants and safe copies

96 bytes is not enough for a `read()` of 64 KB. Bulk data moves with
**grants**: a process creates an entry in its own grant table that says "this
endpoint may read (or write) these bytes of my memory", and passes the grant
ID in a message. The receiver then asks the kernel to copy:

```c
/* granter */
cp_grant_id_t gid = cpf_grant_direct(DS_PROC_NR, (vir_bytes)buf, len, CPF_READ);
/* ... send gid in a message ... */
cpf_revoke(gid);

/* grantee */
sys_safecopyfrom(granter_ep, gid, offset, (vir_bytes)local, len);
```

The kernel checks the grant on every copy: right grantee, right direction,
within bounds, and not revoked. The declarations are in
[`safecopies.h`]({{repo}}/blob/{{branch}}/minix/include/minix/safecopies.h)
and [`syslib.h`]({{repo}}/blob/{{branch}}/minix/include/minix/syslib.h).

There are three kinds of grant:

| Kind | Function | Meaning |
|---|---|---|
| Direct | `cpf_grant_direct(to, addr, len, access)` | "`to` may access this range of **my** memory" |
| Indirect | `cpf_grant_indirect(to, from, gid)` | "`to` may use the grant `from` gave me". Lets a middle layer pass access along without copying, as the faulty-block-device driver `fbd` does |
| Magic | `cpf_grant_magic(to, from, addr, len, access)` | "`to` may access **another process's** memory". Only VFS and MIB may create these (hard-coded in the kernel); VFS uses them to give a file system or driver direct access to a user program's buffer |

`sys_safecopyto()` copies the other way, `sys_vsafecopy()` does several copies
in one call, and `CPF_TRY` makes a copy fail fast on unmapped memory instead
of waiting for VM. A driver therefore never sees an address in another
process; it only gets the bytes it was granted.

## A real example: the data store

Here is a complete round trip from
[`minix/lib/libsys/ds.c`]({{repo}}/blob/{{branch}}/minix/lib/libsys/ds.c),
the client library for DS. It grants DS read access to the key name, makes the
request, and revokes the grant:

```c
static int do_invoke_ds(message *m, int type, const char *ds_name)
{
	...
	/* Grant for key. */
	g_key = cpf_grant_direct(DS_PROC_NR, (vir_bytes) ds_name,
		len_key, access);
	if(!GRANT_VALID(g_key))
		return ENOMEM;

	m->m_ds_req.key_grant = g_key;     /* the grant travels in the message */
	m->m_ds_req.key_len = len_key;

	r = _taskcall(DS_PROC_NR, type, m); /* sets m_type, calls ipc_sendrec() */

	cpf_revoke(g_key);
	return r;
}
```

On the other side, DS
([`minix/servers/ds/main.c`]({{repo}}/blob/{{branch}}/minix/servers/ds/main.c))
is a plain receive, dispatch, reply loop, the shape of almost every server:

```c
while (TRUE) {
	get_work(&m);          /* sef_receive(ANY, &m): SEF handles RS's messages */
	switch (callnr) {
	case DS_PUBLISH:  result = do_publish(&m);  break;
	case DS_RETRIEVE: result = do_retrieve(&m); break;
	...
	default:          result = EINVAL;
	}
	if (result != EDONTREPLY) {
		m.m_type = result;       /* the status goes back in m_type */
		reply(who_e, &m);        /* ipc_send() to the caller */
	}
}
```

And in [`store.c`]({{repo}}/blob/{{branch}}/minix/servers/ds/store.c), DS
fetches the key with the grant it received:

```c
r = sys_safecopyfrom(m_ptr->m_source,
	(cp_grant_id_t) m_ptr->m_ds_req.key_grant, 0,
	(vir_bytes) key_name, m_ptr->m_ds_req.key_len);
```

The client is blocked in `sendrec` the whole time, so the server can reply
with a plain `send`: the client is guaranteed to be waiting. A server that
returns `EDONTREPLY` keeps the request and answers later, which is how VFS and
RS handle long operations.

## The SMP fast path and server colocation

Message passing is on the critical path of everything, so {{name}} adds two
optimisations on amd64.

**Fast path.** When a process calls `sendrec` and the receiver is already
blocked in `receive` waiting for it (or for `ANY`), `do_ipc()` tries
`fastpath_sendrec()` before the general code. It skips the generic dispatch,
copies the message straight into the receiver's delivery buffer and, if both
are on the same CPU, switches directly to the receiver without putting it on
the run queue. If anything unusual is going on (tracing, a pending TLB flush,
an IPC filter, a permission problem), it falls back to the normal path, which
remains the reference implementation. The toggle is `CONFIG_IPC_FASTPATH` in
[`minix/kernel/kernel.h`]({{repo}}/blob/{{branch}}/minix/kernel/kernel.h).

**Colocation.** The kernel counts, for each process, which CPU its messages
come from. Every five seconds the SCHED server
([`schedule.c`]({{repo}}/blob/{{branch}}/minix/servers/sched/schedule.c))
reads those counts and, when at least 70% of the messages a process received
in the last interval came from one CPU, moves it to that CPU, so the fast path
can switch directly. In practice the processes that receive many messages are
servers and drivers. It never moves VFS, VM, RS or SCHED itself, waits 10
seconds after boot, needs at least 100 messages, respects CPU affinity, and
backs off exponentially if the same process keeps moving.

Measured when the two were merged, with four CPUs, the median round trip fell
from about 78 300 to 16 100 CPU cycles (4.86×). The kernel still runs under a
single big lock, so kernel work on different CPUs is serialised; finer locking
is future work. See [SMP on amd64](/en/docs/design/smp/).

## Further reading

- Upstream developer guide, message passing:
  <https://wiki.minix3.org/doku.php?id=developersguide:messagepassing>
- Upstream developer guide, memory grants:
  <https://wiki.minix3.org/doku.php?id=developersguide:memorygrants>
- Upstream developer guide, kernel API:
  <https://wiki.minix3.org/doku.php?id=developersguide:kernelapi>
- Next: [Isolation and self-repair](/en/docs/learn/reliability/).
