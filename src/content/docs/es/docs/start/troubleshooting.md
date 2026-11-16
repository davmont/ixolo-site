---
title: Solución de problemas
description: Qué hacer cuando {{name}} no arranca, no se instala, no tiene red o no abre el escritorio, y qué enviar con un informe de error.
sidebar:
  order: 4
---

Cada sección parte de lo que ves y lleva a la causa. Casi todos estos
problemas vienen de la máquina o de la configuración de la máquina virtual,
no de un error. Si ninguno encaja, [infórmanos](#informar-de-un-problema).

## El núcleo entra en pánico justo después del menú de arranque

```text
MINIX amd64 requires FSGSBASE (CPUID leaf 7 EBX bit 0).
Use '-cpu host' or '-cpu qemu64,+fsgsbase' in QEMU.
```

Al procesador, o al modelo de procesador que muestra la máquina virtual, le
falta la característica `FSGSBASE`. La biblioteca de C la necesita para
preparar el almacenamiento local de cada hilo, así que el núcleo se detiene
en el acto en lugar de dejar que el primer programa falle.

- **QEMU con KVM:** añade `-cpu host`.
- **QEMU sin KVM:** usa `-cpu max` o `-cpu qemu64,+fsgsbase`.
- **Un PC físico:** la tienen los procesadores Intel desde Ivy Bridge (2012)
  y los AMD Zen y posteriores. En Linux, `grep -o fsgsbase /proc/cpuinfo`
  te lo dice.

Las [preguntas frecuentes](/es/docs/start/faq/#por-qué-necesita-fsgsbase)
explican por qué no hay alternativa.

## Se detiene durante el arranque, antes del login

Arranca de nuevo y fíjate en los mensajes: el último indica el paso que se
quedó colgado. En una máquina virtual sin pantalla, usa la consola serie
(consulta [Sin gráficos: consola serie](/es/docs/start/quickstart/#sin-gráficos-consola-serie)).

- **El controlador de interrupciones.** Las entradas de arranque usan el
  APIC (`no_apic=0`). Algunas máquinas se llevan mejor con el antiguo PIC
  8259: el menú de la imagen de disco tiene una entrada **legacy PIC mode**.
  En la ISO, elige **Edit menu option** y después el número de la entrada:
  su línea de órdenes aparece tras `>`, lista para editar, e Intro la
  arranca. Cambia `no_apic=0` por `no_apic=1`. El cambio dura solo ese
  arranque; las demás opciones están en
  [Arranque y apagado](/es/docs/admin/booting/).
- **Demasiada salida.** La entrada **Ixolo (serial console, verbose)** de la
  ISO pone `verbose=3`, con lo que el núcleo escribe una línea cada vez que
  se entra en él. Sirve para depurar el núcleo: el arranque se vuelve
  lentísimo y puede parecer colgado. Para leer los mensajes normales por el
  puerto serie, edita esa entrada como arriba y quita `verbose=3`.
- **UEFI.** La instantánea de desarrollo arranca solo con BIOS; la ISO de la
  versión publicada, con los dos. Secure Boot no está soportado: desactívalo
  en el firmware. La imagen de disco GPT para UEFI
  [aún no se puede usar](/es/docs/start/install/#bios-y-uefi-arranque-desde-disco):
  se detiene al final de `/etc/rc`.

## La instalación es muy lenta o falla

- **Horas para copiar los ficheros.** La máquina por defecto de QEMU (`pc`)
  pone el disco en la controladora IDE, que {{name}} maneja a unos 270 KB/s.
  Usa `-machine q35` (AHCI, de 12 a 15 MB/s). Las órdenes de
  [Instalar en disco](/es/docs/start/install/#instalar-en-qemu) ya lo hacen.
- **`setup` no copia nada, se queda sin memoria o se detiene tras la
  copia.** Son los fallos de las ISO generadas antes de los arreglos del
  instalador de noviembre de 2026. Usa una ISO reciente.
- **"The selected partition (… MB) is too small."** `setup` calcula el
  espacio que necesita a partir de los conjuntos de instalación y dice
  cuánto en la línea siguiente. Dale una partición o un disco mayor.

## Dice que un sistema de ficheros está "unclean, mounting readonly"

```text
MFS: WARNING: FS 0x... unclean, mounting readonly
```

La máquina se paró sin desmontar un sistema de ficheros sin journal (MFS
versión 3, o una versión 4 demasiado pequeña para tenerlo). Se monta en solo
lectura para que nada lo empeore. Repáralo con `fsck_mfs` y vuelve a
montarlo; consulta
[Journaling y recuperación tras un fallo](/es/docs/admin/filesystems/#journaling-y-recuperación-tras-un-fallo).
Los sistemas de ficheros que crea `setup` tienen journal y lo reproducen al
montarse.

## El teclado o el ratón no hacen nada

{{name}} no tiene driver de teclado ni de ratón USB: usa dispositivos PS/2.
Las máquinas virtuales emulan PS/2 por defecto. En un PC físico, usa un
teclado PS/2. Muchos firmwares tienen una opción "USB legacy support" que
presenta un teclado USB como uno PS/2; no hemos probado si {{name}}
funciona con ella.

## No hay red

Comprueba qué ve el sistema:

```sh
ifconfig -l      # p. ej. em0 lo0
netconf -l       # interfaces de hardware, y si están configuradas
```

- **Ninguna interfaz salvo `lo0`:** no hay driver para la tarjeta. En QEMU
  usa una Intel e1000, la más probada: `-nic user,model=e1000`. En `q35` la
  tarjeta por defecto de QEMU es la `e1000e`, que el driver reconoce pero que
  está menos probada. Las tarjetas soportadas están en
  [Red](/es/docs/admin/network/#tarjetas-de-red).
- **Hay interfaz, pero sin dirección:** configúrala con `netconf`, que
  prepara DHCP (`dhcpcd`) o una dirección estática.

## Un driver o un servicio se reinicia una y otra vez

El Reincarnation Server reinicia un servicio que falla y espera más tras
cada fallo. Mira qué servicios hay y cuántas veces se ha reiniciado cada uno:

```sh
ls /proc/service
cat /proc/service/e1000_0
```

Añadir `rs_verbose=1` a las opciones del núcleo (con **Edit menu option**)
debería hacer que RS escriba una línea que empieza por `RS:` en cada paso de
un reinicio. [Servicios y el Reincarnation Server](/es/docs/admin/services/)
explica la política de reinicio, y
[Rompe un driver](/es/docs/learn/lab-break-a-driver/) muestra cómo es una
recuperación sana.

## El escritorio no arranca

`startlxqt` necesita una imagen generada con el escritorio, UEFI con un
framebuffer GOP y entrada PS/2; las instantáneas de desarrollo no lo
incluyen. La [página del escritorio](/es/docs/admin/desktop/) recoge los
requisitos, y sus registros están en `$XDG_RUNTIME_DIR` (`/tmp/runtime-0`
para root): `wlcompd.log` y `lxqt-session.log`.

## Informar de un problema

Abre una incidencia en [GitHub Issues]({{issues}}) con:

- qué usaste: la fecha de la ISO o el commit de `{{branch}}` que compilaste
  (`uname -v` muestra la versión y `/etc/os-release` la nombra);
- la máquina: la línea de órdenes de QEMU, o el modelo del PC, su firmware
  y si arrancó con BIOS o UEFI;
- los últimos mensajes antes del problema. En QEMU, `-serial file:boot.log`
  guarda lo que el sistema escribe en el puerto serie; elige la entrada de
  consola serie (sin `verbose=3`, ver arriba) para incluir los mensajes de
  arranque;
- qué esperabas y qué pasó.

Los informes desde máquinas físicas son especialmente bienvenidos, arranque
o no. Para un problema de seguridad, sigue
[Informar de una vulnerabilidad](/es/docs/admin/security/#informar-de-una-vulnerabilidad).
