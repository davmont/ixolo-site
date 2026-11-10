---
title: "Wayland desktop (experimental)"
description: "The wlcompd compositor with LXQt and Qt 6: what it needs, how to get it, how to start it, and what does not work yet."
sidebar:
  order: 5
---

:::caution[Experimental]
The desktop is opt-in and built out of tree. It is not in the CI image or the
default build, and it is not covered by the automated tests. Expect rough
edges, and keep a text console or a serial console at hand.
:::

{{name}} has a small graphical desktop: the LXQt panel and a terminal, drawn
by Qt 6 on a native Wayland compositor, `wlcompd`. Everything is rendered in
software into the UEFI framebuffer. There is no X11 and no GPU driver.

## How it fits together

```text
 qterminal   lxqt-panel   lxqt-config ...      Qt 6 apps (static binaries)
      \           |           /                 Qt raster engine, no OpenGL
       \          |          /
        Wayland protocol over a Unix socket; pixels in POSIX shared memory
                  |
              wlcompd                           compositor and window manager
               /     \
        /dev/fb0      /dev/kbdmux, /dev/mouse   pixman + FreeType
           |               |
       fb driver      input server <- PS/2 keyboard and mouse (pckbd)
           |
     UEFI GOP framebuffer
```

- **`/dev/fb0`**: the `fb` driver exposes the linear framebuffer that the UEFI
  firmware's Graphics Output Protocol (GOP) set up at boot. That is why the
  desktop needs UEFI: a BIOS boot has no framebuffer for it.
- **`wlcompd`**: a Wayland compositor written for {{name}}. It is in the base
  system. It composites with pixman, draws title bars with FreeType, and
  implements `xdg-shell`, `wlr-layer-shell` (for the panel),
  `wlr-foreign-toplevel-management` (for the task bar), `ext-workspace` (four
  virtual desktops) and server-side decorations.
- **Qt 6** (6.11.1), with its raster paint engine. Clients draw into
  `wl_shm` buffers, which are POSIX shared memory files on the tmpfs at
  `/var/shm`.
- **LXQt** 2.4: `lxqt-session`, `lxqt-panel`, `qterminal`, `lxqt-config`,
  `lxqt-about`, with GLib 2.80 and D-Bus 1.16 underneath.

Every Qt and LXQt program is linked statically. A dynamically linked Qt
crashed before `main()`, in thread-local storage handling of the dynamic
linker, so the port avoids it. The design study behind all this is
[Running Wayland](/en/docs/design/wayland/).

## Requirements

| | Needed |
|---|---|
| Firmware | **UEFI** with GOP. In QEMU: OVMF. |
| Memory | {{ramDesktop}} |
| Keyboard and mouse | **PS/2** (QEMU's default devices). USB keyboards and mice are not supported. |
| Graphics | Any card the firmware can drive with GOP. No GPU acceleration is used. |
| Image | One built with the desktop (see below). |

## Getting an image with the desktop

The CI ISO and a default build do not contain LXQt. Check for it with:

```sh
ls /usr/bin/lxqt-session
```

To build an image with it, you need a full build of the system first, as in
[building from source](/en/docs/develop/building/). Then
`releasetools/build-desktop.sh` fetches the pinned upstream sources, patches
them, cross-compiles them in dependency order and installs them into the build's
`DESTDIR`. `MKDESKTOP=yes` lays the result over the ISO:

```sh
DESTDIR=$PWD/obj.amd64/destdir.amd64 \
TOOLDIR=$PWD/obj.amd64/tooldir.Linux-x86_64 \
QT_HOST_PATH=/usr \
  sh releasetools/build-desktop.sh
MKDESKTOP=yes UEFI=yes OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG={{iso}} \
  bash releasetools/amd64_cdimage.sh
```

The host needs `meson`, `ninja`, `cmake`, `curl`, `patch`, `pkg-config`,
`sha256sum` and a host Qt of exactly the same version (6.11.1), pointed to by
`QT_HOST_PATH`. The manifest of sources ships with `sha256 = TOFILL`
placeholders, and the script refuses to build until you record the checksums
with `sh releasetools/build-desktop.sh checksums`. All the details, including
how to put the desktop in the installation sets instead of overlaying the ISO,
are in [building the desktop](/en/docs/design/desktop-build/).

:::caution[Relink after PR #488]
[PR #488]({{repo}}/pull/488) changed how libc and libpthread connect
(cancellation points). The desktop programs are static, so ones linked
against an older libc must be **relinked** against the new one, or rebuilt.
`releasetools/devtools/relink_desktop.sh` relinks the ten desktop programs
from an existing desktop build tree. A desktop built from scratch after PR #488
is not affected.
:::

## Starting it

Boot under UEFI. In QEMU, with OVMF's code and variable files (the paths
depend on your distribution):

```sh
cp /usr/share/OVMF/OVMF_VARS_4M.fd my_vars.fd
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -vga std \
  -drive if=pflash,unit=0,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd \
  -drive if=pflash,unit=1,format=raw,file=my_vars.fd \
  -cdrom {{iso}}
```

Log in on the console and run:

```sh
startlxqt
```

`startlxqt` does everything: it starts the `fb` driver, starts `wlcompd` and
waits for its socket, starts a D-Bus session bus, and runs `lxqt-session`,
which brings up the panel. It keeps its sockets and logs in
`$XDG_RUNTIME_DIR`, by default `/tmp/runtime-<uid>`, mode 0700.

Windows get a title bar drawn by the compositor, with a close box on the right
and a resize grip in the bottom-right corner. Open a terminal from the panel's
menu.

To start the compositor at boot instead, set `wlcompd=YES` in `/etc/rc.conf`.
That only starts `wlcompd`, not the LXQt session. It takes over the
framebuffer and the keyboard, so the framebuffer becomes the main console;
the serial console keeps working. Do not enable `fbcompd` at the same time.

## What works and what does not

Works:

- The panel, docked at the top: menu, quick launch, task bar, the pager with
  four virtual desktops, "show desktop" and a world clock.
- `qterminal`, with a shell on a pseudo-terminal.
- Moving, resizing and closing windows; menus and pop-ups.
- The DejaVu fonts shipped in the base system.

`lxqt-config` and `lxqt-about` are built too, but have had less testing.

Does not work, or is not there:

- **Copy and paste between programs.** The compositor records the clipboard
  owner but does not pass the data on to other programs yet.
- **Panel plugins** outside the built-in set. A static binary cannot load
  plugins at run time, so only plugins compiled into the panel exist. The CPU,
  network, volume, sensors, keyboard-layout and system-tray plugins need
  libraries {{name}} does not have.
- **Global keyboard shortcuts** (`lxqt-globalkeys`): Wayland gives a client no
  way to grab other clients' keys, and `wlcompd` has no protocol for it.
- **X11 programs**: there is no X server and no XWayland.
- **OpenGL**, hardware acceleration, video playback.
- **USB keyboards and mice**, and keyboard layouts other than US.
- A file manager, a web browser and other applications: only the components
  listed above are built.

## Reporting desktop bugs

Collect these before you report:

- `$XDG_RUNTIME_DIR/wlcompd.log` and `$XDG_RUNTIME_DIR/lxqt-session.log`
  (by default in `/tmp/runtime-0` when you run as root);
- how you built the image: the `{{branch}}` commit, and whether it was
  overlaid with `MKDESKTOP=yes` or put in the sets;
- the QEMU command line or the hardware, and the firmware;
- what you did, what you expected and what happened. A screenshot helps.

Then report it at {{issues}}. If it is a crash of a system service (for
example `fb` or the input server), say so: those are bugs in {{name}}, not in
LXQt.

## Further reading

- [Running Wayland: feasibility and roadmap](/en/docs/design/wayland/)
- [Building the desktop into an image](/en/docs/design/desktop-build/)
- In the source tree: `external/qt6/README.md`, `external/lxqt/README.md`,
  `external/kf6/README.md`
