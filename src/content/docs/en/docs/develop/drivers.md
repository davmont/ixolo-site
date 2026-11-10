---
title: "Writing a driver"
description: "A user-space device driver from scratch: driver libraries, privileges, interrupts, PCI, DMA and surviving a restart."
sidebar:
  order: 2
---

A driver in {{name}} is an ordinary process. It is started by the
reincarnation server (RS), it gets only the privileges listed in its
configuration entry, and it talks to the rest of the system by messages. If it
crashes, RS starts a new copy. This page shows how to write one, using the
example driver in the tree and real drivers as references.

Read [The architecture in four layers](/en/docs/learn/architecture/) first if
the words *endpoint*, *RS* or *grant* are new to you.

## Pick a driver library

You almost never handle raw messages yourself. A library for each driver
class runs the main loop, decodes the requests from VFS or the network stack
and calls the functions you register in a table:

| Library | Header | For | Examples on `{{branch}}` |
|---|---|---|---|
| `libchardriver` | `<minix/chardriver.h>` | Character devices: byte streams, `ioctl`, `select` | `examples/hello`, `system/random`, `video/fb`, `tty/pty`, `printer` |
| `libblockdriver` | `<minix/blockdriver.h>`, `<minix/blockdriver_mt.h>` | Disks and partitions; `_mt` adds worker threads | `storage/ahci`, `storage/nvme`, `storage/at_wini`, `storage/virtio_blk`, `usb/usb_storage` |
| `libnetdriver` | `<minix/netdriver.h>` | Network interfaces, used by the `lwip` server | `net/e1000`, `net/igc`, `net/rtl8139`, `net/virtio_net` |
| `libinputdriver` | `<minix/inputdriver.h>` | Keyboards and mice, feeding the `input` server | `hid/pckbd` |
| `libaudiodriver` | `<minix/audio_fw.h>` | Sound cards (built on `libchardriver`) | `audio/es1370`, `audio/sb16` |

All paths are under
[`minix/drivers/`]({{repo}}/blob/{{branch}}/minix/drivers/), the libraries
under [`minix/lib/`]({{repo}}/blob/{{branch}}/minix/lib/). Every driver also
links `libsys`, which has the kernel calls (`sys_*`), the System Event
Framework (`sef_*`) and the PCI and data store clients.

The table of a character driver shows the shape of all of them:

```c
struct chardriver {
  int (*cdr_open)(devminor_t minor, int access, endpoint_t user_endpt);
  int (*cdr_close)(devminor_t minor);
  ssize_t (*cdr_read)(devminor_t minor, u64_t position, endpoint_t endpt,
        cp_grant_id_t grant, size_t size, int flags, cdev_id_t id);
  ssize_t (*cdr_write)(...);
  int (*cdr_ioctl)(...);
  ...
  void (*cdr_intr)(unsigned int mask);    /* an interrupt arrived */
  void (*cdr_alarm)(clock_t stamp);       /* a timer expired */
  void (*cdr_other)(message *m_ptr, int ipc_status);
};
```

Leave out what you do not need: the library answers those requests with an
error.

## The example: `hello`

[`minix/drivers/examples/hello/`]({{repo}}/blob/{{branch}}/minix/drivers/examples/hello/)
is a complete character driver of about 150 lines. Reading `/dev/hello`
returns "Hello, World!". It is built for amd64 and installed on every image
as `/service/hello`, with its configuration in `/etc/system.conf.d/hello`
and its device node `/dev/hello`. It has four files.

### `hello.c`: the driver

`main()` starts the System Event Framework (SEF) and then hands control to the
library:

```c
int main(void)
{
    sef_local_startup();
    chardriver_task(&hello_tab);
    return OK;
}
```

`sef_local_startup()` registers what to run at each kind of start, then calls
`sef_startup()`, which does the handshake with RS:

```c
static void sef_local_startup()
{
    sef_setcb_init_fresh(sef_cb_init);
    sef_setcb_init_lu(sef_cb_init);
    sef_setcb_init_restart(sef_cb_init);
    sef_setcb_lu_state_save(sef_cb_lu_state_save);
    sef_startup();
}
```

The init callback receives the start type (`SEF_INIT_FRESH`,
`SEF_INIT_RESTART` or `SEF_INIT_LU`). It sets the driver up and then tells
VFS that the driver is ready with `chardriver_announce()`. The block and
network libraries have their own announce calls (`blockdriver_announce()`;
`libnetdriver` does it for you).

A read copies the data to the caller through a **grant**: the caller does not
pass a pointer, it passes a grant ID that allows the driver to write to one
buffer and nothing else:

```c
if ((ret = sys_safecopyto(endpt, grant, 0, (vir_bytes) ptr, size)) != OK)
    return ret;
return size;
```

### `hello.conf`: the privileges

```
service hello
{
        system
                IRQCTL          # 19
                DEVIO           # 21
        ;
        ipc
                SYSTEM pm rs tty ds vm vfs
                pci inet lwip amddev
                ;
    uid 0;
};
```

(`hello` touches no hardware, so `IRQCTL` and `DEVIO` are only there to show
the syntax.) The format is described in `system.conf(5)`
([source]({{repo}}/blob/{{branch}}/minix/commands/minix-service/system.conf.5)).
The keys you will use most:

| Key | Grants | Default |
|---|---|---|
| `system` | Kernel calls by name: `IRQCTL` for interrupts, `DEVIO` for I/O ports, `UMAP`/`VUMAP` for address translation, `PHYSCOPY`... | `BASIC` |
| `ipc` | Which processes it may send messages to; `SYSTEM` is the kernel | `ALL_SYS` |
| `io` | I/O port ranges, `base[:length]` | none |
| `irq` | Interrupt lines | none |
| `pci device` | PCI devices it may claim, `vendor:device` | none |
| `pci class` | PCI classes it may claim, `class/subclass/interface` | none |
| `uid` | User ID it runs as | 12 (`service`) |

A real PCI driver needs fewer lines than you might expect, because claiming a
PCI device also grants its I/O ports, memory ranges and interrupt line (see
below). This is the e1000 network driver's entry:

```
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
        ...
        ipc
                SYSTEM pm rs log tty ds vm
                pci inet lwip ;
};
```

Grant the minimum. Every entry is a promise about what the driver can damage
if it goes wrong.

### `Makefile`: building and installing

```make
PROG=	hello
SRCS=	hello.c

FILES=${PROG}.conf
FILESNAME=${PROG}
FILESDIR= /etc/system.conf.d

DPADD+=	${LIBCHARDRIVER} ${LIBSYS}
LDADD+=	-lchardriver -lsys

.include <minix.service.mk>
```

`minix.service.mk` builds a system service and installs it in `/service`.
The `FILES` lines install the configuration as `/etc/system.conf.d/hello`,
where `minix-service` looks for a per-service file before the global
`/etc/system.conf`.

## Adding your own driver to the build

1. Copy `examples/hello` to a directory under the right class, for example
   `minix/drivers/system/mydrv/`, and rename the files and the `service`
   entry.
2. Add the directory to the `SUBDIR` list of the parent `Makefile`.
3. Add the installed files to the set lists, or the release build stops with
   a set list mismatch. For `hello` they are, in
   `distrib/sets/lists/minix-base/mi`:

   ```
   ./etc/system.conf.d/hello                               minix-base
   ./service/hello                                         minix-base
   ```

   and in `distrib/sets/lists/minix-debug/mi`:

   ```
   ./usr/libdata/debug/service/hello.debug                 minix-debug     debug
   ```

4. For a new character or block device, reserve a major number in
   [`minix/include/minix/dmap.h`]({{repo}}/blob/{{branch}}/minix/include/minix/dmap.h)
   (`hello` has `HELLO_MAJOR 17`) and teach
   [`MAKEDEV`]({{repo}}/blob/{{branch}}/minix/commands/MAKEDEV/MAKEDEV.sh)
   to create the node:

   ```sh
   hello)
       # Hello driver
       makedev ${dev} c 17 0 ${uname} ${gname} 644
       ;;
   ```

   and add the name to its `STD_DEVICES` list, so that images get the node.
   While developing you can also create it by hand: `mknod /dev/mydrv c 17 0`.
5. Rebuild and make a new image, as in
   [Building from source](/en/docs/develop/building/). For a quick compile
   check: `obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64 -C minix/drivers/system/mydrv dependall`.

## Starting and stopping it

The service manager is `minix-service` (in `/sbin`; the name `service` belongs
to the NetBSD rc.d tool). In a running system, as root:

```sh
minix-service up /service/hello -dev /dev/hello
cat /dev/hello
minix-service down hello
```

`up` takes the absolute path of the binary. `-dev` ties the driver to a
device node: VFS sends requests for that node's major number to it. The label
defaults to the program name. Other useful options: `-args "..."` passes
arguments, `-label` sets another label, `-config` points to another
configuration file, and `-period 5HZ` makes RS ping the driver every five
seconds and restart it if it stops answering. See `minix-service(8)`.

A driver that should start at boot is listed in the rc scripts: look at
`etc/rc.minix` and `etc/usr/rc` for how the existing ones are started. The
[Services](/en/docs/admin/services/) page covers the administrator's side.

## Talking to hardware

### PCI devices

The `pci` server owns the PCI bus. A driver finds its device through
`libsys`'s PCI client and claims it with `pci_reserve()`. This is the shape
of e1000's probe
([`e1000.c`]({{repo}}/blob/{{branch}}/minix/drivers/net/e1000/e1000.c)):

```c
pci_init();
r = pci_first_dev(&devind, &vid, &did);   /* only devices system.conf allows */
...                                       /* pci_next_dev() for the rest */
pci_reserve(devind);
irq = pci_attr_r8(devind, PCI_ILR);
pci_get_bar(devind, PCI_BAR, &base, &size, &ioflag);
regs = vm_map_phys(SELF, (void *)(uintptr_t)base, size);
cr = pci_attr_r16(devind, PCI_CR);
pci_attr_w16(devind, PCI_CR, cr | PCI_CR_MAST_EN);   /* bus mastering, for DMA */
```

`pci_first_dev()` and `pci_next_dev()` only return devices that match the
`pci device` or `pci class` lines of the driver's entry. `pci_reserve()` asks
the PCI server to add the device's I/O BARs, memory BARs and interrupt line to
the driver's privileges, so they need not be listed in `system.conf`.
`vm_map_phys()` maps a memory BAR into the driver's address space. Read and
write configuration space with `pci_attr_r8/r16/r32` and `pci_attr_w8/w16/w32`.

### I/O ports

Ports are not touched with `in`/`out` instructions: the driver asks the kernel
with `sys_inb()`, `sys_inw()`, `sys_inl()`, `sys_outb()`, `sys_outw()` and
`sys_outl()` (and the vector forms `sys_vinb()`, `sys_voutb()`... for many
ports at once). This needs `DEVIO` in `system`, and the ports either in an
`io` line or granted by `pci_reserve()`.

```c
u32_t v;
if ((r = sys_inb(base + REG_STATUS, &v)) != OK) ...
sys_outb(base + REG_CMD, CMD_RESET);
```

### Interrupts

The kernel turns an interrupt into a notification message to the driver; the
library calls your `cdr_intr`, `bdr_intr` or `ndr_intr` function with a
bitmask. You set up a line with a *hook*:

```c
e->irq_hook = e->irq;   /* in: the bit to set in the mask */
if ((r = sys_irqsetpolicy(e->irq, 0, &e->irq_hook)) != OK)
    panic("sys_irqsetpolicy failed: %d", r);
if ((r = sys_irqenable(&e->irq_hook)) != OK)
    panic("sys_irqenable failed: %d", r);
```

On input, the hook ID is the bit number you will see in the mask. On return,
it holds the kernel's hook index, which you pass to `sys_irqenable()`,
`sys_irqdisable()` and `sys_irqrmpolicy()`. With policy `0` the line stays
masked after each interrupt until you call `sys_irqenable()` again, as e1000
does at the start of its handler. With `IRQ_REENABLE` the kernel re-enables it
for you. You need `IRQCTL` in `system`.

### MSI-X

On amd64 a driver can use message-signalled interrupts (MSI and MSI-X, added
in PR #186). The kernel picks a free vector and gives back the address and
data the device must write:

```c
int sys_irqsetpolicy_msi(int policy, int *hook_id,
        u32_t *msi_addr, u32_t *msi_data);
```

The driver programs them into its MSI-X table entry and sets the MSI-X enable
bit in the capability itself. After that, delivery is identical to a legacy
line: the same notification, the same `sys_irqenable()`. The NVMe driver is
the in-tree user
([`nvme.c`]({{repo}}/blob/{{branch}}/minix/drivers/storage/nvme/nvme.c),
`nvme_setup_msix()` and `nvme_msix_program()`):

```c
r = sys_irqsetpolicy_msi(IRQ_REENABLE, &hook_id, &msi_addr, &msi_data);
entry = nvme_msix_table + nvme_msix_toff;            /* table entry 0 */
*(volatile u32_t *)(entry + MSIX_VEC_ADDR_LO) = msi_addr;
*(volatile u32_t *)(entry + MSIX_VEC_ADDR_HI) = 0;
*(volatile u32_t *)(entry + MSIX_VEC_DATA) = msi_data;
*(volatile u32_t *)(entry + MSIX_VEC_CTRL) = 0;      /* unmask */
```

The call returns `ENOSYS` when the kernel runs without the APIC, so keep a
fallback: NVMe falls back to polling. Vectors come from a small pool (32), so
use one per device where you can.

### DMA and physical memory

A device that does DMA needs memory that is physically contiguous and whose
physical address you know:

```c
void *alloc_contig(size_t len, int flags, phys_bytes *phys);
int free_contig(void *addr, size_t len);
```

`flags` can ask for 4 KB or 64 KB alignment (`AC_ALIGN4K`, `AC_ALIGN64K`) or
memory below 16 MB or 1 MB (`AC_LOWER16M`, `AC_LOWER1M`) for old devices. The
pointer is for the driver, the physical address is for the device. e1000
allocates its descriptor rings and buffers this way at init.

## Surviving a restart

When a driver crashes, panics, is killed or stops answering its heartbeat, RS
starts a new copy from the same binary, with the same privileges. The new
process does not inherit anything from the old one. Design for that:

- **Make init idempotent.** The new copy finds the hardware in whatever state
  the old one left it. Reset the device in init; do not assume it is fresh.
- **Know which start this is.** The init callback receives
  `SEF_INIT_RESTART` after a crash. If you register no restart callback, SEF's
  default answers RS with `ERESTART` and the driver is started again as if
  fresh, which is a reasonable choice for many drivers.
- **Keep what must survive outside the process.** The data store server (DS)
  holds small named values. `hello` saves its open counter with
  `ds_publish_u32("open_counter", open_counter, DSF_OVERWRITE)` and reads it
  back with `ds_retrieve_u32()`. A driver that wants state across a crash has
  to publish it as it goes, because it gets no chance to save anything when
  it dies.
- **Announce again.** Calling `chardriver_announce()` or
  `blockdriver_announce()` from init tells VFS the driver's new endpoint, so
  requests reach the new copy.
- **Handle `SIGTERM`.** Register `sef_setcb_signal_handler()` to stop the
  device cleanly on shutdown, as `ahci.c` does.

:::caution[Live update]
`hello` also registers live-update callbacks (`SEF_INIT_LU`,
`sef_setcb_lu_state_save`). Live update (replacing a running driver without
losing its state) is an upstream MINIX feature that was experimental and
i386-only there. It does not work on amd64 today: the in-tree live-update test
is a known failure. Do not rely on it.
:::

### Test it by killing it

```sh
minix-service up /service/hello -dev /dev/hello
cat /dev/hello
minix-service refresh hello     # RS kills it and starts a new copy
cat /dev/hello                  # still answers
```

On the console, `hello` prints "Hey, I've just been restarted!" from its
restart path. Press <kbd>Shift</kbd>+<kbd>F6</kbd> on the console to see RS's
table of services. For a crash that RS did not ask for, kill the process or
add a deliberate `panic()` on some request. The
[lab: break a driver](/en/docs/learn/lab-break-a-driver/) does this step by
step.

:::note
The `hello` driver is built and shipped on every image, but no automated test
exercises it. If something on this page does not match what you see on a
current build, the source in the tree is right.
:::

## Further reading

- Upstream MINIX 3 developer guide, driver programming:
  <https://wiki.minix3.org/doku.php?id=developersguide:driverprogramming>
- Block and network driver protocols:
  <https://wiki.minix3.org/doku.php?id=developersguide:blockprotocol>,
  <https://wiki.minix3.org/doku.php?id=developersguide:datalinkprotocol>

These describe MINIX 3.3/3.4 on i386; the libraries are the same, the
platform details are not.
