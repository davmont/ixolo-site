---
title: "Escritorio Wayland (experimental)"
description: "El compositor wlcompd con LXQt y Qt 6: qué necesita, cómo conseguirlo, cómo arrancarlo y qué no funciona todavía."
sidebar:
  order: 5
---

:::caution[Experimental]
El escritorio es opcional y se compila fuera del árbol. No está en la imagen
de la CI ni en la compilación por defecto, y las pruebas automáticas no lo
cubren. Cuenta con algún tropiezo y ten a mano una consola de texto o una
consola serie.
:::

{{name}} tiene un escritorio gráfico pequeño: el panel de LXQt y un terminal,
dibujados por Qt 6 sobre un compositor Wayland propio, `wlcompd`. Todo se
renderiza por software en el framebuffer de UEFI. No hay X11 ni driver de GPU.

## Cómo encaja todo

```text
 qterminal   lxqt-panel   lxqt-config ...      apps Qt 6 (binarios estáticos)
      \           |           /                 motor raster de Qt, sin OpenGL
       \          |          /
        protocolo Wayland por un socket Unix; píxeles en memoria compartida POSIX
                  |
              wlcompd                           compositor y gestor de ventanas
               /     \
        /dev/fb0      /dev/kbdmux, /dev/mouse   pixman + FreeType
           |               |
       driver fb      servidor input <- teclado y ratón PS/2 (pckbd)
           |
     framebuffer GOP de UEFI
```

- **`/dev/fb0`**: el driver `fb` expone el framebuffer lineal que preparó al
  arrancar el Graphics Output Protocol (GOP) del firmware UEFI. Por eso el
  escritorio necesita UEFI: un arranque BIOS no le deja framebuffer.
- **`wlcompd`**: un compositor Wayland escrito para {{name}}. Está en el sistema
  base. Compone con pixman, dibuja las barras de título con FreeType e
  implementa `xdg-shell`, `wlr-layer-shell` (para el panel),
  `wlr-foreign-toplevel-management` (para la barra de tareas), `ext-workspace`
  (cuatro escritorios virtuales) y decoraciones del lado del servidor.
- **Qt 6** (6.11.1), con su motor de pintado raster. Los clientes dibujan en
  búferes `wl_shm`, que son ficheros de memoria compartida POSIX en el tmpfs de
  `/var/shm`.
- **LXQt** 2.4: `lxqt-session`, `lxqt-panel`, `qterminal`, `lxqt-config`,
  `lxqt-about`, con GLib 2.80 y D-Bus 1.16 por debajo.

Todos los programas de Qt y LXQt se enlazan de forma estática. Un Qt enlazado
dinámicamente fallaba antes de llegar a `main()`, en la gestión del
almacenamiento local de hilos del enlazador dinámico, así que el port lo evita.
El estudio de diseño que hay detrás es
[Wayland en MINIX](/es/docs/design/wayland/).

## Requisitos

| | Necesario |
|---|---|
| Firmware | **UEFI** con GOP. En QEMU: OVMF. |
| Memoria | {{ramDesktop}} |
| Teclado y ratón | **PS/2** (los dispositivos por defecto de QEMU). Los teclados y ratones USB no están soportados. |
| Gráficos | Cualquier tarjeta que el firmware pueda manejar con GOP. No se usa aceleración por GPU. |
| Imagen | Una compilada con el escritorio (ver abajo). |

## Conseguir una imagen con el escritorio

La ISO de la CI y la compilación por defecto no traen LXQt. Compruébalo con:

```sh
ls /usr/bin/lxqt-session
```

Para compilar una imagen con él, primero necesitas una compilación completa
del sistema, como en [compilar desde el código](/es/docs/develop/building/).
Después, `releasetools/build-desktop.sh` descarga las fuentes upstream fijadas,
las parchea, las compila de forma cruzada en orden de dependencias y las
instala en el `DESTDIR` de la compilación. `MKDESKTOP=yes` superpone el
resultado sobre la ISO:

```sh
DESTDIR=$PWD/obj.amd64/destdir.amd64 \
TOOLDIR=$PWD/obj.amd64/tooldir.Linux-x86_64 \
QT_HOST_PATH=/usr \
  sh releasetools/build-desktop.sh
MKDESKTOP=yes UEFI=yes OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG={{iso}} \
  bash releasetools/amd64_cdimage.sh
```

El host necesita `meson`, `ninja`, `cmake`, `curl`, `patch`, `pkg-config`,
`sha256sum` y un Qt del host de exactamente la misma versión (6.11.1),
indicado con `QT_HOST_PATH`. El manifiesto de fuentes viene con marcadores
`sha256 = TOFILL`, y el script se niega a compilar hasta que registres las
sumas con `sh releasetools/build-desktop.sh checksums`. Todos los detalles,
incluido cómo meter el escritorio en los conjuntos de instalación en vez de
superponerlo a la ISO, están en
[compilar el escritorio](/es/docs/design/desktop-build/).

:::caution[Reenlaza después del PR #488]
El [PR #488]({{repo}}/pull/488) cambió cómo se conectan libc y libpthread
(puntos de cancelación). Los programas del escritorio son estáticos, así que
los enlazados con una libc anterior hay que **reenlazarlos** con la nueva, o
recompilarlos. `releasetools/devtools/relink_desktop.sh` reenlaza los diez
programas del escritorio a partir de un árbol de compilación del escritorio ya
existente. Un escritorio compilado desde cero después del PR #488 no se ve
afectado.
:::

## Arrancarlo

Arranca con UEFI. En QEMU, con los ficheros de código y de variables de OVMF
(las rutas dependen de tu distribución):

```sh
cp /usr/share/OVMF/OVMF_VARS_4M.fd mis_vars.fd
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -vga std \
  -drive if=pflash,unit=0,format=raw,readonly=on,file=/usr/share/OVMF/OVMF_CODE_4M.fd \
  -drive if=pflash,unit=1,format=raw,file=mis_vars.fd \
  -cdrom {{iso}}
```

Entra en la consola y ejecuta:

```sh
startlxqt
```

`startlxqt` lo hace todo: arranca el driver `fb`, arranca `wlcompd` y espera a
su socket, arranca un bus de sesión D-Bus y ejecuta `lxqt-session`, que levanta
el panel. Guarda sus sockets y registros en `$XDG_RUNTIME_DIR`, por defecto
`/tmp/runtime-<uid>`, con modo 0700.

Las ventanas llevan una barra de título que dibuja el compositor, con un botón
de cerrar a la derecha y un asa de redimensionado en la esquina inferior
derecha. Abre un terminal desde el menú del panel.

Para arrancar el compositor al iniciar el sistema, pon `wlcompd=YES` en
`/etc/rc.conf`. Eso solo arranca `wlcompd`, no la sesión de LXQt. Se queda con
el framebuffer y el teclado, así que el framebuffer pasa a ser la consola
principal; la consola serie sigue funcionando. No actives `fbcompd` a la vez.

## Qué funciona y qué no

Funciona:

- El panel, anclado arriba: menú, lanzador rápido, barra de tareas, el
  paginador con cuatro escritorios virtuales, "mostrar escritorio" y un reloj
  mundial.
- `qterminal`, con un shell sobre un pseudoterminal.
- Mover, redimensionar y cerrar ventanas; menús y ventanas emergentes.
- Las fuentes DejaVu que trae el sistema base.

`lxqt-config` y `lxqt-about` también se compilan, pero se han probado menos.

No funciona, o no está:

- **Copiar y pegar entre programas.** El compositor anota quién tiene el
  portapapeles, pero todavía no pasa los datos a los demás programas.
- **Plugins del panel** fuera del conjunto integrado. Un binario estático no
  puede cargar plugins en tiempo de ejecución, así que solo existen los que van
  compilados dentro del panel. Los de CPU, red, volumen, sensores, distribución
  de teclado y bandeja del sistema necesitan bibliotecas que {{name}} no tiene.
- **Atajos de teclado globales** (`lxqt-globalkeys`): Wayland no deja que un
  cliente capture las teclas de otros, y `wlcompd` no tiene ningún protocolo
  para ello.
- **Programas X11**: no hay servidor X ni XWayland.
- **OpenGL**, aceleración por hardware, reproducción de vídeo.
- **Teclados y ratones USB**, y distribuciones de teclado distintas de la de
  EE. UU.
- Un gestor de ficheros, un navegador web y otras aplicaciones: solo se
  compilan los componentes de arriba.

## Informar de fallos del escritorio

Reúne esto antes de informar:

- `$XDG_RUNTIME_DIR/wlcompd.log` y `$XDG_RUNTIME_DIR/lxqt-session.log` (por
  defecto en `/tmp/runtime-0` si trabajas como root);
- cómo compilaste la imagen: el commit de `{{branch}}` y si superpusiste el
  escritorio con `MKDESKTOP=yes` o lo metiste en los conjuntos;
- la línea de órdenes de QEMU o el hardware, y el firmware;
- qué hiciste, qué esperabas y qué pasó. Una captura de pantalla ayuda.

Después, infórmalo en {{issues}}. Si se cae un servicio del sistema (por
ejemplo `fb` o el servidor de entrada), dilo: esos fallos son de {{name}}, no de
LXQt.

## Para saber más

- [Wayland en MINIX: viabilidad y hoja de ruta](/es/docs/design/wayland/)
- [Compilar el escritorio en una imagen](/es/docs/design/desktop-build/)
- En el árbol de código: `external/qt6/README.md`, `external/lxqt/README.md`,
  `external/kf6/README.md`
