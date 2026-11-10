---
title: Compilar desde el código
description: Compila {{name}} para amd64 de forma cruzada en un host Linux y genera una ISO o una imagen de disco arrancable.
sidebar:
  order: 1
---

{{name}} se compila de forma cruzada en un host Linux con el `build.sh` de
NetBSD. Una orden construye la toolchain cruzada (LLVM/clang {{llvm}} y
`ld.lld`, desde el propio árbol) y después todo el sistema: núcleo,
servidores, drivers, bibliotecas y espacio de usuario. Una segunda orden
empaqueta el resultado en una imagen arrancable.

Los pasos de esta página son los que ejecuta la CI en cada pull request
([`ci.yml`]({{repo}}/blob/{{branch}}/.github/workflows/ci.yml)). Si esta
página y `ci.yml` no coinciden, manda `ci.yml`.

## Requisitos del host

- **Linux en x86-64.** La CI usa Ubuntu 24.04 e instala solo esto:

  ```sh
  sudo apt install build-essential clang zlib1g-dev python3 git
  ```

- **Herramientas EFI de GRUB, para una ISO híbrida BIOS + UEFI.** Sin ellas,
  el script de imagen genera sin avisar una ISO solo BIOS (consulta `UEFI=`
  más abajo). No hacen falta `mtools` ni `mkfs.vfat`: la partición EFI se
  construye con el `nbmakefs` del propio árbol.

  ```sh
  # Debian / Ubuntu
  sudo apt install grub-efi-amd64-bin grub-efi-ia32-bin
  # openSUSE
  sudo zypper install grub2 grub2-x86_64-efi grub2-i386-efi
  ```

- **Acceso a la red** en la primera compilación: GNU texinfo no está en el
  repositorio por motivos de licencia y la compilación lo descarga
  (`gnu/dist/fetch.sh`, de minix3.org y, si falla, de ftp.gnu.org).
- **Disco.** El directorio de objetos de una compilación completa ocupa unos
  8 GB, más 1,3 GB del código y su historial de git. Cuenta con 10 GB como
  mínimo.
- **Tiempo.** En el runner de la CI (4 trabajos en paralelo) la toolchain
  cruzada tarda unas 2 horas y el sistema unas 2 h 15 min más. Una estación de
  trabajo con más núcleos va más rápido. La toolchain se construye una vez: las
  compilaciones siguientes la reutilizan.

## Obtén el código

```sh
git clone {{repo}}.git
cd minix
git checkout {{branch}}
```

El desarrollo se hace en `{{branch}}`: es la rama que hay que compilar y contra
la que se envían los pull requests.

## Compila

La CI compila en dos pasos para poder guardar en caché la toolchain, que es lo
lento. Puedes hacer lo mismo o lanzar solo la segunda orden, que construye
antes las herramientas si faltan.

```sh
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no tools
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no release
```

| Opción | Significado |
|---|---|
| `-m amd64` | Máquina destino. amd64 es la única que compila en `{{branch}}` (ver más abajo). |
| `-U` | Compilación sin privilegios: no hace falta root; los propietarios de los ficheros se anotan en un metalog. |
| `-u` | Actualizar: no limpia antes; reutiliza la toolchain y los objetos. |
| `-j N` | Trabajos en paralelo. |
| `-O obj.amd64` | Directorio de objetos: todo lo compilado va aquí y el árbol de código queda limpio. Los scripts de imagen usan `../obj.amd64` por defecto, así que pásales la misma ruta en `OBJ=`. |
| `-V MKLLVMCMDS=no` | Omite el clang nativo del sistema, que cuesta horas de compilación. No afecta al compilador cruzado del host. Quita esta opción si quieres un compilador dentro del sistema: va en el conjunto `minix-comp`. |
| `tools` | Construye solo la toolchain cruzada en `obj.amd64/tooldir.Linux-x86_64`. |
| `release` | Construye la toolchain si hace falta, el sistema y los conjuntos de instalación. |

:::note[i386 y ARM]
El árbol todavía contiene el código i386 y ARM (`evbearm`) heredado de
MINIX 3, pero **i386 no compila en `{{branch}}`**: el port de 64 bits hizo
crecer algunos mensajes IPC por encima del tamaño fijo de 56 bytes de i386, y
las comprobaciones de tamaño en tiempo de compilación fallan. ARM no se ha
tocado desde la bifurcación y no se prueba. Solo amd64 está soportado.
:::

### Núcleo optimizado para CPU más nuevas (opcional)

Por defecto el núcleo se compila para el juego de instrucciones x86-64 base.
Puedes activar `x86-64-v2` (POPCNT, SSE4.2, CMPXCHG16B: CPU de 2008 en
adelante, más o menos):

```sh
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no \
  -V KERNEL_MARCH=x86-64-v2 release
```

Solo afecta al núcleo
([`Makefile.inc`]({{repo}}/blob/{{branch}}/minix/kernel/arch/x86_64/Makefile.inc)).
Los niveles superiores (v3, v4) se rechazan a propósito: necesitan AVX, que el
núcleo no usa.

## Genera la ISO

Es la orden de la CI, salvo `UEFI=`:

```sh
OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG=minix_amd64.iso \
  bash releasetools/amd64_cdimage.sh
```

- `CREATE_IMAGE_ONLY=1` usa lo que `build.sh` ya compiló. Sin él (el valor
  por defecto es `0`) el script lanza antes `build.sh ... release` por su
  cuenta.
- `UEFI=auto` (por defecto) genera una ISO híbrida BIOS + UEFI si en el host
  están `grub-mkimage` y los módulos EFI de GRUB, y una ISO solo BIOS si no.
  `UEFI=yes` fuerza la imagen híbrida y falla si falta GRUB. `UEFI=no` fuerza
  solo BIOS. **La CI usa `UEFI=no`**: su runner no tiene los paquetes EFI de
  GRUB y sus pruebas arrancan con BIOS.
- La ISO lleva los conjuntos `minix-base`, `minix-man` y `minix-tests`, así que
  toda imagen trae las baterías de pruebas en `/usr/tests`.

Arráncala como en la [guía rápida](/es/docs/start/quickstart/):

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -cdrom minix_amd64.iso
```

Cómo se monta la imagen híbrida (El Torito, GRUB, Multiboot2) se explica en el
documento de diseño [Arranque UEFI](/es/docs/design/uefi-boot/).

### Otras imágenes

Todas aceptan los mismos `OBJ=` y `CREATE_IMAGE_ONLY=1`:

| Script | Resultado | Qué es |
|---|---|---|
| `releasetools/amd64_cdimage.sh` | `minix_amd64.iso` | El CD live y de instalación. Es el camino probado. |
| `releasetools/amd64_hdimage.sh` | `minix_amd64.img` | Una imagen de disco BIOS de unos 2 GB con particiones raíz, `/home` y `/usr`. Además de los conjuntos del CD lleva `minix-comp`, `minix-games` y el conjunto `tests` completo al estilo NetBSD. Arranca en modo APIC por defecto. |
| `releasetools/amd64_gptimage.sh` | `minix_amd64_gpt.img` | Una imagen de disco GPT para UEFI (por ejemplo, un pendrive): una partición EFI FAT con GRUB y el núcleo, y una raíz MFS. La cadena de arranque funciona; el último estado registrado (junio de 2026, en el documento de diseño de UEFI) es que el arranque se queda parado al final de `/etc/rc`, antes del login. Experimental. |
| `releasetools/amd64_usbimage.sh` | `minix_amd64_usb.img` | Una imagen BIOS pequeña que arranca con la raíz en un disco RAM. |

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 1G -hda minix_amd64.img
```

## Recompilar tras un cambio

`build.sh` con `-u` es incremental: después de editar unos ficheros, lanza otra
vez la misma orden `release` y solo se recompila lo que ha cambiado. Luego
vuelve a generar la imagen.

Para comprobar más rápido que compila un solo directorio, usa el envoltorio de
make que `build.sh` deja en el directorio de herramientas. Prepara el mismo
entorno que la compilación completa:

```sh
obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64 -C minix/servers/vm dependall
obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64 -C minix/servers/vm install
```

Lanza `dependall` e `install` como dos órdenes separadas: juntos en una sola
invocación, el paso de instalación puede saltarse. `install` actualiza el
directorio de destino (`obj.amd64/destdir.amd64`), pero no los tarballs de los
conjuntos que desempaquetan los scripts de imagen; para llevar el cambio a una
imagen, lanza otra vez `release` (o `build.sh ... sets`).

## Compilar dentro de {{name}}

El camino soportado es la compilación cruzada desde Linux. Una compilación sin
`MKLLVMCMDS=no` mete clang en el conjunto `minix-comp`, y ese compilador nativo
se ha usado dentro del sistema para compilar y enlazar programas. Recompilar el
sistema entero desde dentro de {{name}} no se ha probado en amd64.

## El escritorio (opcional)

El escritorio LXQt/Qt 6 no forma parte de una compilación normal. Es un
conjunto de proyectos externos (GLib, D-Bus, Qt 6, partes de KDE Frameworks,
LXQt) que se compilan fuera del árbol, a partir de fuentes fijadas con sus
sumas de comprobación en `releasetools/desktop-sources.manifest`, y se instalan
en el directorio de destino. Consulta
[`releasetools/DESKTOP.md`]({{repo}}/blob/{{branch}}/releasetools/DESKTOP.md).

Paquetes extra en el host: `meson`, `ninja`, `cmake`, `curl`, `patch`,
`pkg-config`, `sha256sum` y **un Qt en el host exactamente de la misma versión
que el del sistema** (6.11.1), cuyos `moc`, `rcc` y `uic` ejecuta la
compilación cruzada.

```sh
DESTDIR=$PWD/obj.amd64/destdir.amd64 \
TOOLDIR=$PWD/obj.amd64/tooldir.Linux-x86_64 \
QT_HOST_PATH=/usr \
  sh releasetools/build-desktop.sh

OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 MKDESKTOP=yes UEFI=yes \
  IMG=minix_amd64.iso bash releasetools/amd64_cdimage.sh
```

`MKDESKTOP=yes` superpone el escritorio a la ISO. Usa `UEFI=yes`: el escritorio
dibuja en el framebuffer de UEFI y no funciona si arrancas con BIOS. El
escritorio es experimental y la CI no lo compila ni lo prueba. Para usarlo,
consulta [El escritorio](/es/docs/admin/desktop/).

## Ejecuta las pruebas

```sh
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite quick \
  --xfail releasetools/qemutest.xfail
```

Consulta [Pruebas e integración continua](/es/docs/develop/testing/).

## Problemas habituales

- **El núcleo entra en pánico al arrancar en QEMU con «MINIX amd64 requires
  FSGSBASE».** La CPU del invitado no tiene `FSGSBASE`, que el núcleo amd64
  exige. Usa `-cpu host` con KVM o
  `-cpu max` sin él. Los modelos antiguos como `qemu64` y `kvm64` no lo tienen.
- **La ISO no arranca con firmware UEFI.** Se generó solo para BIOS:
  `UEFI=auto` no encontró las herramientas EFI de GRUB. Instálalas y genera la
  imagen con `UEFI=yes`, que falla con un error en vez de seguir.
- **"Minix source code doesn't appear to have been built."** Has lanzado el
  script de imagen con `CREATE_IMAGE_ONLY=1` y un `OBJ=` que no contiene una
  compilación. Comprueba que `OBJ` es el directorio que pasaste a
  `build.sh -O`.
- **Fallos extraños tras actualizar el compilador del host.** La toolchain
  guardada en `obj.amd64/tooldir.Linux-x86_64` la construyó el compilador
  anterior. Recompílala una vez sin `-u`.
- **`-m i386` falla con aserciones de tamaño de mensaje.** Es lo esperado: i386
  no compila en `{{branch}}`.
