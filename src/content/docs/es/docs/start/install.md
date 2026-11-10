---
title: "Instalar en disco"
description: "Instala {{name}} en un disco virtual o físico con el script setup, y qué hacer tras el primer arranque."
sidebar:
  order: 2
---

La ISO live funciona desde un medio de solo lectura: los cambios se pierden al
apagar. Para conservar un sistema, instálalo en un disco con `setup`, el
instalador heredado de MINIX 3, o construye una imagen de disco desde el
código fuente. Esta página cubre las dos vías y los primeros pasos en el
sistema instalado.

:::caution[Lee esto antes de empezar]
- **`setup` instala solo para arranque BIOS.** Escribe una tabla de
  particiones MBR y un bloque de arranque BIOS. Todavía no hay instalación en
  disco para UEFI (ver [BIOS y UEFI](#bios-y-uefi-arranque-desde-disco)).
- **`setup` tiene un fallo conocido en amd64.** En {{branch}} sigue buscando
  los conjuntos de instalación en `/i386/binary/sets`, pero la ISO de amd64
  los guarda en `/amd64/binary/sets`. Tal cual viene, crea los sistemas de
  ficheros y después no copia nada. La solución del [paso 2](#2-ejecuta-setup)
  no se ha verificado de principio a fin; mientras no se corrija, la
  [imagen de disco construida desde el código](#alternativa-construir-una-imagen-de-disco)
  es la vía probada para tener un sistema en disco.
- Instalar en un disco físico borra la partición que elijas. Haz copia de
  seguridad antes.
:::

## Requisitos de hardware

| | Mínimo | Notas |
|---|---|---|
| CPU | x86-64 con `FSGSBASE` | Intel desde Ivy Bridge (2012); AMD Zen y posteriores. En Linux: `grep -o fsgsbase /proc/cpuinfo`. Se aprovechan NX, SMEP, SMAP y PCID si existen. Hasta {{maxCpus}} CPU. |
| RAM | {{ram}} | El escritorio necesita más: {{ramDesktop}}. Se admite RAM por encima de 4 GB. |
| Disco | {{disk}} | Una partición primaria MBR; `setup` comprueba el tamaño que necesita. |
| Controladora de disco | AHCI (SATA), IDE, NVMe | El ramdisk de arranque elige AHCI o IDE sondeando el PCI. NVMe necesita el modo APIC, que es el de por defecto. `virtio_blk` se compila, pero no se ha probado en amd64. |
| Tarjeta de red | Familia Intel e1000 | La más probada. Las demás, en [Red](/es/docs/admin/network/). |
| USB | Solo almacenamiento masivo | Controladoras EHCI, OHCI y xHCI, también detrás de hubs. No hay teclado ni ratón USB: usa PS/2 (o el emulado en una VM). |
| Firmware | BIOS para un disco instalado; BIOS o UEFI para la ISO | Sin Secure Boot. |

Máquinas físicas verificadas hasta ahora: {{hardware}}. Casi todas las
pruebas se hacen en QEMU/KVM.

## Instalar en QEMU

Crea un disco virtual y arranca la ISO con él conectado. La máquina por
defecto de QEMU (`pc`) pone ambos en la controladora IDE, lo que simplifica
los nombres de dispositivo: el disco es `c0d0` y el CD, `c0d2`.

```sh
qemu-img create -f qcow2 {{slug}}.qcow2 8G
qemu-system-x86_64 -enable-kvm -cpu host -m 2G \
  -drive file={{slug}}.qcow2,format=qcow2,if=ide \
  -cdrom {{iso}} -boot d
```

Entra como `root` (el sistema live no tiene contraseña) y sigue.

### 1. Qué va a hacer setup

`setup` es un script de shell (`/bin/setup`, código en
[`minix/commands/setup/setup.sh`]({{repo}}/blob/{{branch}}/minix/commands/setup/setup.sh)).
Usa una partición primaria del disco y la divide en tres subparticiones:

| Subpartición | Punto de montaje | Tamaño | Sistema de ficheros |
|---|---|---|---|
| `s0` | `/` | 128 MB | MFS |
| `s1` | `/home` | el que elijas (por defecto, el 20 % de lo que queda) | MFS |
| `s2` | `/usr` | el resto | MFS |

Para `c0d0p0` (primera partición primaria del primer disco) la raíz es
`/dev/c0d0p0s0`. `mkfs.mfs` crea ahora por defecto **MFS versión 4 con
journal de metadatos**, así que un fallo no deja el sistema de ficheros
necesitado de una reparación larga. Consulta
[Sistemas de ficheros](/es/docs/admin/filesystems/).

### 2. Ejecuta setup

Por el fallo de rutas de arriba, ejecuta una copia corregida del script. En el
sistema live `/tmp` es escribible:

```sh
sed 's,/i386/binary/sets,/amd64/binary/sets,g' /bin/setup > /tmp/setup
sh /tmp/setup
```

Pulsa Intro para aceptar la respuesta por defecto. Los pasos son:

1. **Teclado.** Un mapa de `/usr/lib/keymaps` (por defecto `us-std`; para
   un teclado español, `spanish`). Se copia a `/etc/keymap` en el sistema
   nuevo.
2. **Distribución.** Siempre la completa; no hay nada que elegir.
3. **Partición.** Pulsa Intro para el modo automático: `autopart` muestra los
   discos y te deja elegir o crear una partición. Escribe `expert` para usar
   tú mismo el editor `part`. A partir de aquí no hay vuelta atrás.
4. **Reinstalación.** Solo si la partición ya tiene una instalación: *R*
   conserva `/home` y reescribe el resto; *F* lo borra todo.
5. **Tamaño de `/home`** en MB. `0` significa sin `/home` separado.
6. **Tamaño de bloque**, de 1 a 64 kB (por defecto 4 kB). Deja el valor por
   defecto.
7. **Copia de ficheros.** Se desempaquetan los conjuntos en los sistemas de
   ficheros nuevos, se crean los nodos de dispositivo, se instala el bloque
   de arranque BIOS y se genera `/boot.cfg`.
8. **Red.** `setup` ejecuta `netconf -p /mnt` para configurar una interfaz;
   ver [Red](/es/docs/admin/network/). Puedes saltarlo y ejecutar `netconf`
   más tarde.
9. **Contraseña de root.** Se escribe dos veces; no puede estar vacía ni
   empezar o acabar con espacios. Se guarda como hash bcrypt (`$2a$10$…`) en
   `/etc/master.passwd`. Los medios live siguen entrando sin contraseña; el
   sistema instalado, no.

Es normal un mensaje final sobre que se omite `pkgin`: la ISO no lleva
repositorio de paquetes (ver [La shell y el software](/es/docs/start/shell-packages/)).

### 3. Primer arranque

Apaga y vuelve a arrancar la VM sin la ISO:

```sh
poweroff
```

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G \
  -drive file={{slug}}.qcow2,format=qcow2,if=ide
```

El menú de arranque sale de `/boot.cfg`, que `update_bootcfg` construye a
partir de `/etc/boot.cfg.default`. Tiene entradas para el núcleo instalado,
para el modo monousuario y una opción *Edit menu option* para cambiar la línea
de órdenes del núcleo. Entra como `root` con la contraseña del paso 9.

## Alternativa: construir una imagen de disco

Si compilas {{name}} desde el código fuente
([Compilar](/es/docs/develop/building/)), `releasetools/amd64_hdimage.sh`
escribe una imagen de disco BIOS arrancable sin pasar por `setup`:

```sh
OBJ=obj.amd64 bash releasetools/amd64_hdimage.sh     # -> minix_amd64.img
qemu-system-x86_64 -enable-kvm -cpu host -m 2G \
  -drive file=minix_amd64.img,format=raw
```

La imagen ocupa unos 2 GB: 128 MB de raíz, 1,75 GB de `/usr` y 128 MB de
`/home`. A diferencia de `setup`, los pone en tres particiones primarias: `/`
en `/dev/c0d0p0`, `/usr` en `c0d0p1` y `/home` en `c0d0p2`. Lleva más conjuntos que la ISO: `minix-comp` (cabeceras,
bibliotecas y, salvo que compilaras con `MKLLVMCMDS=no`, el clang nativo),
`minix-games` y los tests. Su menú tiene además una entrada *legacy PIC mode*
para máquinas que no se llevan bien con el APIC. En esta imagen root no
tiene contraseña: pon una con `passwd` nada más entrar.

## BIOS y UEFI: arranque desde disco

| Vía | Estado |
|---|---|
| ISO, BIOS | Funciona. |
| ISO, UEFI (GRUB) | Funciona, en `-machine pc` (IDE) y `-machine q35` (AHCI). |
| Disco instalado con `setup`, BIOS | MBR, el bloque de arranque `bootxx_minixfs3` y el monitor de arranque de MINIX, como en la imagen de disco. No verificado de principio a fin en amd64 (ver el fallo de `setup` arriba). |
| Imagen de disco de `amd64_hdimage.sh`, BIOS | Funciona; es como se ha usado el sistema con una raíz MFS escribible. No la cubre la CI. |
| Imagen GPT de `amd64_gptimage.sh`, UEFI | **Aún no es usable.** GRUB, el núcleo y el montaje de la raíz funcionan, pero [`docs/UEFI_BOOT.md`]({{repo}}/blob/{{branch}}/docs/UEFI_BOOT.md) documenta un bloqueo al final de `/etc/rc`, antes del login, en esta imagen. |
| Secure Boot | No soportado. |

El núcleo lee tablas de particiones MBR, no GPT: la imagen GPT funciona
gracias a un MBR híbrido. Las notas de diseño están en
[Arranque UEFI](/es/docs/design/uefi-boot/).

## Después del primer arranque

### Nombre de la máquina

El nombre se guarda en `/etc/hostname.file` (por defecto `minix`) y se
aplica al arrancar:

```sh
echo mibox > /etc/hostname.file
hostname mibox
```

### Zona horaria

`/etc/profile` fija `TZ=GMT0` y después lee `/etc/rc.timezone` si existe.
Pon ahí tu zona, con un nombre de `/usr/share/zoneinfo`:

```sh
echo 'export TZ=Europe/Madrid' > /etc/rc.timezone
```

Se aplica a las nuevas shells de login.

### Usuarios

Trabaja con un usuario normal y reserva `root` para administrar. Las
herramientas de usuarios de NetBSD están en el sistema base:

```sh
useradd -m -G wheel alicia    # -m crea /home/alicia
passwd alicia
```

Los miembros de `wheel` pueden hacerse root con `su`. Las contraseñas nuevas
se guardan por defecto con bcrypt (`/etc/passwd.conf`).

### Red

Si te saltaste el paso 8, ejecuta ahora `netconf` y elige DHCP o una
dirección fija. Escribe `/etc/ifconfig.<interfaz>`; aplícalo con:

```sh
service network restart
```

Detalles, direcciones fijas e IPv6: [Red](/es/docs/admin/network/).

### Servidor SSH

OpenSSH {{openssh}} está en el sistema base, pero desactivado. Actívalo en
`/etc/rc.conf` y arráncalo; las claves de máquina se generan en el primer
arranque del servicio:

```sh
echo sshd=YES >> /etc/rc.conf
service sshd start
```

`root` solo puede entrar por SSH con clave, como en OpenSSH estándar. Entra
con tu usuario y usa `su`.

### Servicios y sistemas de ficheros

Los demonios son scripts rc.d de NetBSD que se configuran en `/etc/rc.conf`;
los servidores y drivers del sistema los gestiona RS. Consulta
[Servicios](/es/docs/admin/services/) y
[Sistemas de ficheros](/es/docs/admin/filesystems/).

## Para saber más

- Guía de instalación de MINIX 3 upstream, para conocer la historia de
  `setup` (escrita para i386 y versiones antiguas):
  <https://wiki.minix3.org/doku.php?id=usersguide:doinginstallation>
- Notas de postinstalación de upstream:
  <https://wiki.minix3.org/doku.php?id=usersguide:postinstallation>
