---
title: "File systems"
description: "MFS v4 with journaling, ext2/3/4, FAT, exFAT, ISO 9660, tmpfs, and how to mount them."
sidebar:
  order: 2
---

Each file system in {{name}} is a separate server process. When you mount a
disk, the system starts a new instance of the matching server (`mfs`, `ext2`,
`vfat`...) for that mount, under the Reincarnation Server like any other
[service](/en/docs/admin/services/). A bug in the FAT code can crash the FAT
server, not the kernel.

| Type (`mount -t`) | Format | Read | Write | Notes |
|---|---|---|---|---|
| `mfs` | MINIX file system v1–v3 and v4 | yes | yes | Native. v4 is the default. |
| `ext2` | ext2, ext3, ext4 | yes | yes | Some features force read-only; see below. |
| `vfat` | FAT12, FAT16, FAT32 | yes | yes | Long names in UTF-8. |
| `exfat` | exFAT | yes | yes | |
| `isofs` | ISO 9660 with Rock Ridge | yes | no | CDs and ISO images. |
| `tmpfs` | in memory | yes | yes | New; mounted on `/var/shm` at boot. |
| `procfs` | process information | yes | no | Mounted on `/proc`. |

## MFS version 4

MFS is the native file system. `setup` and `mkfs.mfs` create version 4 by
default, with a metadata journal. Version 4 lifts the limits that version 3
had in its on-disk format:

| | MFS v3 | MFS v4 |
|---|---|---|
| Inode | 64 bytes | 128 bytes |
| Largest file | 2 GB | larger than 2 GB |
| Timestamps | 32-bit, end in January 2038 | 64-bit, no 2038 problem |
| Hard links, group IDs | 16-bit | 32-bit |
| File flags (`chflags`) | no | yes |
| Extended attributes, ACLs | no | yes |
| Metadata journal | no | yes (on by default) |

File names are still at most 60 bytes long, in both versions. Longer names are
truncated.

A single `mfs` server reads and writes both versions. New features are marked
with feature bits in the superblock, so a future driver can add features
without another format change. Upstream MINIX 3 cannot read version 4: if a
disk must be readable there, make it with `-3`.

The design, field by field: [MFS v4](/en/docs/design/mfsv4/).

### Making an MFS file system

```sh
mkfs.mfs /dev/c0d1p0              # v4 with a journal (the default)
mkfs.mfs -B 4096 /dev/c0d1p0      # choose the block size in bytes
mkfs.mfs -3 /dev/c0d1p0           # legacy v3, no journal
```

| Option | Meaning |
|---|---|
| `-4` | MFS v4. The default. |
| `-3` | Legacy MFS v3, for media that an older MINIX must read. Turns the journal off. |
| `-j` | Reserve a metadata journal. On by default; implies `-4`. |
| `-B blocksize` | Block size in bytes. `setup` uses 4096. |
| `-i inodes` | Number of inodes. |
| `-b blocks` | File system size, in blocks. |

The journal takes 1/64 of the blocks, between 64 and 8192 blocks. On a file
system too small to hold it, `mkfs.mfs` leaves the journal out with a warning
(or fails, if you asked for `-j` explicitly).

### Journaling and crash recovery

The journal covers **metadata**: inodes, bitmaps, directories, indirect blocks
and the superblock. File contents are not journaled, but they are written to
disk before the metadata that points to them is committed (the same
"data=ordered" mode as ext3 and ext4). After a crash you may lose the last
writes that had not been synced, but the file system structure is consistent
and no file points to garbage.

Each change is written to the journal first and to its real place only after
the journal copy is safely on disk. When a journaled file system that was not
unmounted cleanly is mounted read-write, `mfs` replays the committed
transactions and discards an incomplete one at the end. There is no long
`fsck` scan. Replay is safe to repeat if the machine crashes again during
recovery.

Without a journal (v3, or a v4 too small for one), an unclean file system is
mounted **read-only** with a warning, `MFS: WARNING: FS ... unclean, mounting
readonly`, until you check it:

```sh
umount /dev/c0d1p0
fsck_mfs -a /dev/c0d1p0           # repair automatically
fsck_mfs -r /dev/c0d1p0           # ask before each repair
```

`fsck_mfs` understands version 4, including the journal area and the blocks
used by extended attributes. At boot, `/etc/rc.minix` runs `fsck -p` on the
file systems in `/etc/fstab` other than `/` before it mounts them.

The design: [MFS journaling](/en/docs/design/journal/).

### Extended attributes and ACLs

MFS v4 stores extended attributes in one extra block per file, through the
BSD `extattr_get_file(2)` family of calls, in the `user` and `system`
namespaces. `system` is for root only. All the attributes of a file must fit
in that block; a write that would overflow it fails with `ENOSPC`. There is no
`getextattr`/`setextattr` command in the base system yet, so attributes are
set from programs.

POSIX.1e access control lists build on them. Use `getfacl` and `setfacl`:

```sh
setfacl -m u:alice:rw report.txt      # give alice read/write
setfacl -d -m g:staff:rx shared/      # default ACL, inherited by new files
getfacl report.txt
setfacl -b report.txt                 # remove the extended entries
```

The ACL is enforced on every access, default ACLs are inherited by new files
and directories, and `chmod` keeps the ACL mask in step. The ext2 server reads
and writes the ACLs of ext4 volumes in the same way.

Design: [extended attributes](/en/docs/design/xattr/).

### File flags

MFS v4 supports the BSD immutable and append-only flags through `chflags(2)`.
An immutable file cannot be written, truncated, renamed, linked, deleted or
have its owner, mode, times or attributes changed. An append-only file can
only grow at its end. Only root can set or clear the system (`SF_*`) flags;
the owner can set the user (`UF_*`) flags. On a v3 file system `chflags`
returns `EOPNOTSUPP`. There is no `chflags(1)` command in the base system yet.

## Mounting

```text
mount [-a] [-r] [-e] [-t type] [-o options] special name
```

- `-t type` is the server name from the table at the top. Without it, `mount`
  detects MFS (v1 to v3), ext2 and ISO 9660, and falls back to `mfs`.
- `-r` mounts read-only. `-o` passes options to the server.
- `mount` with no arguments lists what is mounted. `umount` unmounts.

Disks are named `/dev/c0d0` (controller 0, disk 0), with primary partitions
`p0`–`p3` and subpartitions `s0`–`s3`. A default installation has `/` on
`/dev/c0d0p0s0`, `/home` on `...s1` and `/usr` on `...s2`.

```sh
mount /dev/c0d1p0 /mnt                       # MFS or ext2: detected
mount -t ext2 /dev/c0d1p1 /mnt/linux
mount -t vfat /dev/usb_disk0p0 /mnt/usb
mount -t exfat /dev/usb_disk0p0 /mnt/usb
mount -t tmpfs -o size=64m none /mnt/scratch
mount -r -t isofs /dev/c0d2 /mnt/cdrom      # the CD drive's name varies
umount /mnt/usb
```

A USB stick appears when it is plugged in: the console prints
`New USB disk at /dev/usb_disk0.` and its partitions get the same `p0`–`p3`
suffixes.

### /etc/fstab

`mount -a` mounts every entry in `/etc/fstab` except `/` and those marked
`noauto`. The format is the usual BSD one: device, mount point, type,
options, dump frequency and fsck pass. This is what `setup` writes:

```text
/dev/c0d0p0s0	/		mfs	rw			0	1
/dev/c0d0p0s2	/usr		mfs	rw			0	2
/dev/c0d0p0s1	/home	mfs	rw			0	2
none		/sys		devman	rw,rslabel=devman	0	0
none		/dev/pts	ptyfs	rw,rslabel=ptyfs	0	0
```

Use `none` as the device for file systems with no disk behind them, such as
`tmpfs`. Of the options, `mount -a` itself acts on `ro` and `noauto`; the rest
of the string goes to the server.

## ext2, ext3 and ext4

The `ext2` server reads and writes Linux ext2, ext3 and ext4 volumes,
including extents, 64-bit block numbers, `metadata_csum` checksums, htree
directories, files over 2 GB, extended attributes and ACLs. It processes the
orphan list on mount.

What it does not do:

- **It does not journal its own writes.** A cleanly unmounted ext3/ext4 volume
  mounts read-write, but the system writes it like ext2. Unmount it before
  you pull the disk.
- **Replay is partial.** If an ext3 volume was not unmounted cleanly, the
  server replays the journal on a read-write mount. It only understands the
  classic ext3 journal format (no journal checksums, no 64-bit journal). For
  anything else it mounts read-only.
- **Some ext4 features are not supported.** A volume with an unsupported
  "incompatible" feature (for example `meta_bg`, inline data or encryption)
  is refused. One with an unsupported "read-only compatible" feature, or
  flagged with errors, is mounted read-only. The server prints the reason.

`newfs_ext2fs` and `fsck_ext2fs` (from NetBSD) are in the base system.

## FAT and exFAT

`vfat` reads and writes FAT12, FAT16 and FAT32, with long file names in UTF-8,
sector sizes other than 512 bytes, and programs can be run and mapped from it.
`exfat` reads and writes exFAT, the format of most large USB sticks and SD
cards. `newfs_msdos` creates FAT file systems; there is no `mkfs` or `fsck`
for exFAT in the base system.

FAT has no Unix owners or permissions, so do not expect `chmod` or `chown` to
stick.

## ISO 9660

`isofs` reads CDs and ISO images, with Rock Ridge names and symbolic links.
Programs on it can be run directly, paged in on demand.

## tmpfs

`tmpfs` keeps a file system in memory. It is new in {{name}}
([PR #483]({{repo}}/pull/483)). Files can be mapped with `mmap`, including
writable shared mappings, and executed. At boot, `/etc/rc.minix` mounts one on
`/var/shm`, where `shm_open(3)` keeps POSIX shared memory objects, unless
`/etc/fstab` already mounts something there.

| Option | Meaning | Default |
|---|---|---|
| `size=N[k\|m\|g]` | Most file data it holds; then `ENOSPC`. | half of physical memory |
| `nr_inodes=N` | Most files and directories. | one per page of `size` |
| `mode=octal` | Permissions of the root directory. | `1777` |
| `uid=N`, `gid=N` | Owner of the root directory. | `0` |

Its contents are lost on unmount. It does not support file flags or extended
attributes, and its pages are never swapped out.

## procfs

`procfs` is mounted on `/proc` at boot. Besides the usual per-process
directories it has `/proc/service/<label>` for each system service (see
[services](/en/docs/admin/services/#what-is-running-and-what-rs-logged)),
`/proc/pci` and `/proc/cpuinfo`.

## Swap

:::caution[No way to turn swap on yet]
The VM server supports swapping anonymous memory to a disk partition, and the
`swapctl(2)` system call exists. But there is **no `swapctl(8)`, `swapon` or
`/etc/fstab` support** to configure it: no swap tool ships in the base system.
In practice, {{name}} runs without disk swap.
:::

What VM does on its own, with no configuration: it drops clean pages of files
when memory runs low and compresses cold anonymous memory in RAM. When both run
out, an out-of-memory killer picks a process to end. Design:
[page reclaim, compression and swap](/en/docs/design/reclaim/).

## Further reading

- `man mount`, `man mkfs.mfs`, `man fsck.mfs`, `man tmpfs`, `man setfacl`
- Design documents: [MFS v4](/en/docs/design/mfsv4/),
  [journal](/en/docs/design/journal/), [extended attributes](/en/docs/design/xattr/),
  [reclaim and swap](/en/docs/design/reclaim/)
