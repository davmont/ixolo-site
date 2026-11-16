---
title: Debugging
description: Find out why the kernel, a server or a program misbehaves, with the kernel messages, the function-key dumps, trace(1), panic stack traces and gdb attached to QEMU.
sidebar:
  order: 4
---

There is no debugger inside {{name}}: no gdb or lldb. You debug from
outside, with the messages the system prints, dumps of its internal tables,
a trace of a program's system calls and, for the kernel and the servers,
gdb on the host attached to QEMU. Everything on this page was checked on a
`{{branch}}` snapshot of November 2026, in QEMU with KVM and one CPU.

The paths below assume you built with `-O obj.amd64`, as in
[Building from source](/en/docs/develop/building/).

## Kernel messages

What the kernel prints, and what servers and drivers print with `printf`,
goes to the console and to the kernel's message buffer. The `log` driver
passes that buffer to `syslogd`, which writes it to `/var/log/messages` with
the tag `kernel:`:

```sh
tail -20 /var/log/messages
```

The messages from the start of the boot, before `syslogd` runs, and those
of a panic only reach the console. To keep them, use the serial console and
save it on the host: boot the **serial console** entry
(see [Serial console](/en/docs/admin/booting/#serial-console)) and add
`-serial file:boot.log` to QEMU. For a guest that hangs before it can log
anything, `releasetools/devtools/kmsg.py` reads the buffer out of the
guest's memory through QMP (see the [developer tools](/en/docs/design/devtools/)).

## Function-key dumps

The information server (IS) prints the system's tables when you press a
function key on the console keyboard. It writes them to the kernel messages,
so read them in `/var/log/messages` or on the serial console. In QEMU, send
the key from the monitor (`sendkey f1`, `sendkey shift-f3`) or over QMP with
`releasetools/devtools/keys.py`.

| Key | Dump |
|---|---|
| <kbd>F1</kbd> | Kernel process table |
| <kbd>F3</kbd> | System image |
| <kbd>F4</kbd> | Process privileges |
| <kbd>F5</kbd> | Boot monitor parameters |
| <kbd>F6</kbd> | IRQ hooks and policies |
| <kbd>F7</kbd> | Kernel messages |
| <kbd>F8</kbd> | VM status and process maps |
| <kbd>F10</kbd> | Kernel parameters |
| <kbd>Shift</kbd>+<kbd>F1</kbd> | PM process table |
| <kbd>Shift</kbd>+<kbd>F2</kbd> | Signals |
| <kbd>Shift</kbd>+<kbd>F3</kbd> | VFS process table: what each process is blocked on |
| <kbd>Shift</kbd>+<kbd>F4</kbd> | Device to driver mapping |
| <kbd>Shift</kbd>+<kbd>F5</kbd> | This list of keys |
| <kbd>Shift</kbd>+<kbd>F6</kbd> | RS table of services |
| <kbd>Shift</kbd>+<kbd>F8</kbd> | Data store contents |
| <kbd>Shift</kbd>+<kbd>F9</kbd> | Processes with stack traces |

The table is in
[`minix/servers/is/dmp.c`]({{repo}}/blob/{{branch}}/minix/servers/is/dmp.c).
A long dump stops after 22 lines with `--more--`; press the same key again
for the next page. After the last page, the next press starts again from
the top. A page of <kbd>F1</kbd> looks like this:

```text
kernel:  8       0          8 vm           2   500    274      0  --R---- ANY
kernel:  9       0          9 pfs          5   500      1      0  --R---- ANY
kernel: 11       0         11 init        47   200      0      0  --R---- pm
kernel: 13       2      65549 acpi         7   200      0      0  --R---- ANY
kernel: --more--
```

:::caution[Shift+F9 stack traces are wrong on amd64]
For a process that entered the kernel with `SYSCALL`, which is nearly all of
them, the kernel looks for the frame pointer at a fixed place on the user
stack. On amd64 it finds instruction bytes instead, so every process shows
the same meaningless trace (`0x38001078 0xc3850fc0850b89 (v_rbp … ?)`). Use
gdb, below, to see where a server is.
:::

## Tracing a program: trace(1)

`trace` runs a command, or attaches to a running process with `-p pid`, and
prints every system call with its arguments and result:

```text
# trace ls /etc/motd
Tracing ls (pid 650)
openat(AT_FDCWD, "/dev/urandom", O_RDONLY|O_CLOEXEC) = 3
…
readlinkat(AT_FDCWD, "/etc/malloc.conf", &0x7feffffc9c20, 1024) = -1 [ENOENT]
…
fstatat(AT_FDCWD, "/etc/motd", {st_mode=S_IFREG|0755, st_size=329, ..}, 0) = 0
write(1, "/etc/motd\n", 10) = /etc/motd
10
exit(0)
Process exited normally with code 0
```

`-f` follows forked children, `-t` adds timestamps, `-o file` writes the
trace to a file and `-v` prints more of each structure. It is built on
`ptrace`, which still has known failures (test 42). See `man trace`.

## Panics

When the kernel finds an inconsistency it stops with a panic and prints the
return addresses on its stack. A real one, from the serial console:

```text
kernel panic: nested pagefault
kernel on CPU 0: 0xffffffff8026744b 0xffffffff80253bdb 0xffffffff8024b628 0xffffffff802623b8 …
System has panicked, press any key to reboot
```

A server or driver that panics prints its name and endpoint, the message
and a stack trace, then exits, and RS restarts it if it can:

```text
pm(0): panic: <message>
syslib:panic.c: stacktrace: 0x… 0x…
```

Turn the addresses into functions with the unstripped binary from the
build: `obj.amd64/minix/kernel/kernel` for the kernel, and the binary in
the server's or driver's object directory for the others, such as
`obj.amd64/minix/servers/pm/pm`. All of them keep their symbols.

```sh
gdb -batch obj.amd64/minix/kernel/kernel \
    -ex 'info symbol 0xffffffff8026744b' -ex 'info symbol 0xffffffff80253bdb'
```

```text
panic + 171 in section .text
exception_handler + 1419 in section .text
```

The first address is in `panic` itself; the cause is in the next ones. Each
address is where a call returns to, just after the call. With a kernel built
with debugging information (next section), `info line *0x…` gives the source
line as well.

## gdb attached to QEMU

QEMU has a gdb stub: gdb on the host can stop the virtual machine, read and
change its memory and registers, and set breakpoints in the kernel and in
the servers. Stopping stops the whole machine.

Start QEMU as usual and add `-s`, which opens the stub on TCP port 1234. Add
`-S` as well to keep the CPU stopped at the first instruction until gdb
continues it. Then, from the source tree:

```sh
gdb obj.amd64/minix/kernel/kernel
(gdb) target remote :1234
(gdb) break do_fork
(gdb) continue
```

Run any command in the guest and gdb stops in the kernel call that creates
the new process:

```text
Breakpoint 1, 0xffffffff80267571 in do_fork ()
(gdb) bt
#0  0xffffffff80267571 in do_fork ()
#1  0xffffffff802656e6 in kernel_call ()
#2  0xffffffff8024b47a in kernel_call_entry_common ()
```

`continue` lets it run again, <kbd>Ctrl</kbd>+<kbd>C</kbd> in gdb stops it,
and `detach` leaves it running.

### Source-level debugging

The build compiles without debugging information, so gdb sees only function
names. Build the kernel again with it, from the top of the source tree:

```sh
M=obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64
$M -C minix/kernel cleandir
$M -C minix/kernel DBG="-O2 -g" dependall
```

`-g` does not change the generated code: the new kernel's code is byte for
byte the same as the old one's, so you can load it in gdb against the image
you already built and booted. Now gdb shows source lines, arguments and
structures:

```text
Breakpoint 1, do_fork (caller=0xffffffff8027e380 <proc+12064>, m_ptr=0xffffffff80437f58)
    at /…/minix/kernel/system/do_fork.c:39
39	  if(!isokendpt(m_ptr->m_lsys_krn_sys_fork.endpt, &p_proc))
(gdb) bt
#0  do_fork (caller=…, m_ptr=…) at /…/minix/kernel/system/do_fork.c:39
#1  0xffffffff802656e6 in kernel_call_dispatch (caller=…, msg=…) at /…/minix/kernel/system.c:118
#2  kernel_call (m_user=0x35fffa80, caller=…) at /…/minix/kernel/system.c:162
(gdb) p caller->p_name
$1 = "vm", '\000' <repeats 13 times>
```

The caller is VM, not PM: PM handles `fork`, and VM, which copies the
address space, makes the kernel call. This replaces the kernel in the object
directory; to go back, run the same two commands without `DBG=`.

### Breakpoints before paging is on

With `-S`, the kernel is not loaded yet and its addresses are not mapped, so
an ordinary breakpoint cannot be written:

```text
(gdb) break cstart
Warning:
Cannot insert breakpoint 1.
Cannot access memory at address 0xffffffff80261774
```

Use a hardware breakpoint, which needs no memory write:

```text
(gdb) hbreak cstart
(gdb) continue
Breakpoint 1, cstart () at /…/minix/kernel/main.c:530
```

### Breakpoints in a server

Every server, driver and program is linked at the same address,
`0x400000`, each in its own address space, so the same address means
something different in each process. Use a hardware breakpoint with a
condition on the `CR3` register, which points to the page tables of the
process that is running. The kernel keeps each process's value in its
process table. With the kernel built with `-g`, this stops PM in its
`do_fork`:

```text
(gdb) set $i = 0
(gdb) while $i < sizeof(proc)/sizeof(proc[0])
 >if $_streq(proc[$i].p_name, "pm")
  >set $pmcr3 = proc[$i].p_seg.p_cr3
  >end
 >set $i = $i + 1
 >end
(gdb) add-symbol-file obj.amd64/minix/servers/pm/pm
(gdb) hbreak *0x408530 if (unsigned long)$cr3 == $pmcr3
(gdb) continue
Breakpoint 2, 0x0000000000408530 in do_fork ()
(gdb) bt
#0  0x0000000000408530 in do_fork ()
#1  0x0000000000407d37 in main ()
#2  0x000000000040799d in ___start ()
```

Take the address from `nm obj.amd64/minix/servers/pm/pm`: the name
`do_fork` also exists in the kernel, so gdb would pick the kernel's. Without
the condition, the breakpoint fires in whichever process runs code at that
address.

## printf

A `printf` in a server or driver goes to the kernel messages, like the rest.
Rebuild only that program and make a new image
(see [Building from source](/en/docs/develop/building/)). It is crude, and
often the fastest way to see what a piece of code does.

## Further reading

- [Tests and continuous integration](/en/docs/develop/testing/): what
  `qemutest.py` collects when a test hangs.
- [Developer tools](/en/docs/design/devtools/): scripts that boot a guest,
  send keys and read the kernel messages.
- QEMU's [gdb stub documentation](https://www.qemu.org/docs/master/system/gdb.html).
