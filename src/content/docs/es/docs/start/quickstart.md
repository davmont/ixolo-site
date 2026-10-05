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
{{name}} en amd64 necesita la característica `FSGSBASE` de la CPU para el
almacenamiento local de hilos. `-cpu host` (con KVM) la pasa al invitado. Sin
KVM usa `-cpu max`. Los modelos antiguos como `-cpu kvm64` o `qemu64` no la
tienen, y el núcleo se detiene al principio del arranque sin dar mensaje.
:::

### Arrancar con UEFI en vez de BIOS

La ISO es híbrida: la misma imagen arranca con firmware UEFI. Indica a QEMU una
imagen OVMF (la ruta depende de tu distribución):

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 \
  -drive if=pflash,format=raw,readonly=on,file=/usr/share/qemu/ovmf-x86_64.bin \
  -cdrom {{iso}}
```

### Prueba el escritorio (experimental)

El escritorio Wayland necesita el framebuffer de UEFI: arranca con OVMF como
arriba y, después de entrar, ejecuta:

```sh
startlxqt
```

### Sin gráficos: consola serie

Para usar el invitado desde tu terminal, añade `-nographic`. La ISO abre un
login en el primer puerto serie además de en la pantalla.

## 4. Entra en el sistema

En el prompt `login:` escribe `root` y pulsa Intro. El sistema live no tiene
contraseña de root.

```text
login: root
# uname -a
```

## 5. Míralo regenerarse

Cada driver es un proceso normal. Mata el driver de red y observa cómo el
Reincarnation Server lo vuelve a levantar:

```sh
ps -ax | grep e1000      # la tarjeta de red por defecto de QEMU
kill -9 <pid>
ps -ax | grep e1000      # PID nuevo: se ha reiniciado
```

El [laboratorio «rompe un driver»](/es/docs/learn/lab-break-a-driver/) explica
paso a paso qué ha pasado.

## Siguientes pasos

- [Instalar en disco](/es/docs/start/install/)
- [La shell y los paquetes pkgsrc](/es/docs/start/shell-packages/)
- [La arquitectura en cuatro capas](/es/docs/learn/architecture/)
