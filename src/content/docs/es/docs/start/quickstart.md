---
title: De cero a login en 15 minutos
description: Arranca {{name}} en QEMU sobre un host Linux y llega al login.
sidebar:
  order: 1
---

Esta guía arranca la ISO de {{name}} {{version}} en una máquina virtual QEMU.
Necesitas un host Linux con unos 2 GB de RAM libres y unos minutos. No se
instala nada en tu disco: la ISO funciona en modo live.

## 1. Instala QEMU

```sh
# Debian / Ubuntu
sudo apt install qemu-system-x86 ovmf
# Fedora
sudo dnf install qemu-system-x86 edk2-ovmf
# openSUSE
sudo zypper install qemu-x86 qemu-ovmf-x86_64
```

Con KVM el invitado funciona casi a velocidad nativa. Comprueba que puedes
usarlo:

```sh
ls -l /dev/kvm     # debe existir y tu usuario debe poder leerlo
```

## 2. Descarga la ISO

Descarga `{{iso}}` desde la [página de descargas](/es/download/) y
compruébala:

```sh
sha256sum {{iso}}
# esperado: {{sha256}}
```

## 3. Arráncala

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 \
  -cdrom {{iso}}
```

:::caution[El modelo de CPU importa]
{{name}} en amd64 necesita la característica `FSGSBASE` de la CPU: la
biblioteca de C prepara el almacenamiento local de hilos con la instrucción
`WRFSBASE`. `-cpu host` (con KVM) la pasa al invitado. Sin KVM, usa
`-cpu max`, o pídela de forma explícita con `-cpu qemu64,+fsgsbase`. Los
modelos por defecto más antiguos de QEMU (`qemu64`, `kvm64`) no la tienen, y
el núcleo entra en pánico al principio del arranque con un mensaje que pide
`-cpu host`.
:::

El menú de arranque espera 10 segundos y arranca la primera entrada,
**Regular MINIX 3**. El código aún usa el nombre de upstream en menús y
mensajes.

### Arrancar con UEFI en vez de BIOS

La ISO es híbrida: la misma imagen arranca con firmware UEFI, a través de
GRUB. Indica a QEMU una imagen de firmware OVMF. La ruta depende de tu
distribución:

| Distribución | Imagen OVMF |
|---|---|
| Debian / Ubuntu | `/usr/share/OVMF/OVMF_CODE.fd` (`OVMF_CODE_4M.fd` en versiones recientes) |
| Fedora | `/usr/share/edk2/ovmf/OVMF_CODE.fd` |
| openSUSE | `/usr/share/qemu/ovmf-x86_64.bin` |

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/qemu/ovmf-x86_64.bin \
  -cdrom {{iso}}
```

Con UEFI la consola se dibuja sobre el framebuffer del firmware en lugar del
modo texto VGA.

### Sin gráficos: consola serie

Para usar el invitado desde tu terminal, añade `-nographic`. Hay un login en
el primer puerto serie (`tty00`) además de en la pantalla, así que en tu
terminal aparece un prompt `login:` cuando el sistema termina de arrancar.
Con BIOS no verás ahí el menú de arranque ni los mensajes del núcleo; para
tenerlos también en el puerto serie, elige en el menú la entrada **serial
console** (añade `console=tty00` a la línea de órdenes del núcleo). Pulsa
`Ctrl-a x` para salir de QEMU.

## 4. Entra en el sistema

En el prompt `login:` escribe `root` y pulsa Intro. El sistema live no tiene
contraseña de root.

```text
login: root
# uname -a
```

`uname` muestra `Minix 3.4.0`: la cadena de versión aún no se ha cambiado.

## 5. Míralo regenerarse

Cada driver es un proceso normal. La tarjeta de red por defecto de QEMU es una
Intel 82540EM, así que el sistema ha arrancado el driver `e1000` para ella.
Mátalo y observa cómo el Reincarnation Server (RS) lo vuelve a levantar:

```sh
ps -ax | grep e1000      # apunta el PID
kill -9 <pid>
ps -ax | grep e1000      # un PID nuevo: RS lo ha reiniciado
```

La interfaz de red (`em0`) sobrevive al reinicio: el servidor TCP/IP se
engancha al nuevo proceso del driver y conserva su configuración. El
[laboratorio «rompe un driver»](/es/docs/learn/lab-break-a-driver/) explica
paso a paso qué ha pasado.

## Sobre el escritorio

El escritorio LXQt experimental se compila aparte del resto del sistema y solo
lo llevan las imágenes construidas con `MKDESKTOP=yes`: las instantáneas de
desarrollo de la CI no lo traen. En una imagen que lo lleve, arranca con UEFI
(ver arriba), entra y ejecuta `startlxqt`. Consulta [El escritorio](/es/docs/admin/desktop/) para
saber en qué estado está y cómo compilarlo.

## Siguientes pasos

- [Instalar en disco](/es/docs/start/install/)
- [La shell y el software](/es/docs/start/shell-packages/)
- [La arquitectura en cuatro capas](/es/docs/learn/architecture/)
