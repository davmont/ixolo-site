---
title: "Arranque y apagado"
description: "Los menús de arranque, cómo cambiar las opciones de arranque para una vez o para siempre, los parámetros del núcleo, el modo monousuario y cómo parar o reiniciar {{name}} limpiamente."
sidebar:
  order: 2
---

Desde que se enciende la máquina hasta el prompt `login:`, el arranque pasa
por cuatro etapas:

1. **El firmware** arranca un cargador. Con BIOS es el monitor de arranque
   heredado de MINIX 3 (un cargador derivado de NetBSD); con UEFI es GRUB.
2. **El cargador** muestra un menú, carga el núcleo y los doce módulos de
   arranque, y pasa al núcleo una línea de parámetros `nombre=valor`.
3. **El núcleo** arranca los módulos. Un script del ramdisk de arranque
   arranca el driver de disco y monta el sistema de ficheros raíz de verdad.
4. **`/etc/rc`** ejecuta `/etc/rc.minix` y los scripts de `/etc/rc.d`, e
   `init` arranca `getty` en los terminales.

Esta página trata de lo que puedes cambiar: el menú, los parámetros y la
forma de parar el sistema. El orden en que arrancan los servidores y los
drivers se explica en
[El arranque: quién arranca a quién](/es/docs/learn/architecture/#el-arranque-quién-arranca-a-quién).

## Los menús de arranque

El menú que ves depende de desde dónde arrancas.

### La ISO con BIOS

El menú sale del `boot.cfg` que escribe
[`releasetools/amd64_cdimage.sh`]({{repo}}/blob/{{branch}}/releasetools/amd64_cdimage.sh):

| N.º | Entrada | Parámetros del núcleo |
|---|---|---|
| 1 | **Regular Ixolo** | `bootcd=1 cdproberoot=1 no_apic=0 acpi=1` |
| 2 | **Ixolo (serial console, verbose)** | los mismos, más `console=tty00 verbose=3` |
| 3 | **Edit menu option** | ver [más abajo](#para-un-arranque-edit-menu-option) |
| 4 | **Drop to boot prompt** | ver [el prompt de arranque](#el-prompt-de-arranque) |

Espera 10 segundos y arranca la entrada 1. Durante la cuenta atrás, pulsa
Intro para arrancar ya la entrada por defecto, Espacio para parar la cuenta
o el número de una entrada. Cualquier otra tecla también para la cuenta y te
deja en un prompt `Option: [1]:`.

### La ISO con UEFI

Con firmware UEFI, la ISO de la versión publicada arranca GRUB, con un menú
sacado de
[`releasetools/grub.cfg`]({{repo}}/blob/{{branch}}/releasetools/grub.cfg)
que imita al de BIOS:

| Entrada | Parámetros del núcleo |
|---|---|
| **Regular Ixolo (UEFI)** | `bootcd=1 cdproberoot=1 no_apic=0 acpi=1` |
| **Ixolo (UEFI, serial console)** | los mismos, más `console=tty00` |
| **Ixolo (UEFI, serial console, verbose)** | los mismos, más `console=tty00 verbose=3` |

GRUB espera 10 segundos y arranca la primera entrada. Para cambiar los
parámetros, selecciona una entrada y pulsa `e`: los parámetros son la cadena
entre comillas que sigue a `load_minix`. Cómo arrancar con UEFI en QEMU se
explica en
[Arrancar con UEFI en vez de BIOS](/es/docs/start/quickstart/#arrancar-con-uefi-en-vez-de-bios).

### Un disco instalado

Un disco instalado con `setup` arranca con el monitor de arranque de BIOS,
que lee `/boot.cfg`. Ese fichero no se edita: lo escribe `update_bootcfg` a
partir de la plantilla
[`/etc/boot.cfg.default`]({{repo}}/blob/{{branch}}/etc/boot.cfg.default),
y `setup` lo ejecuta al final de la instalación. Las entradas son:

| N.º | Entrada | Arranca |
|---|---|---|
| 1 | **Start Ixolo** | el núcleo de `/boot/minix_default` |
| 2 | **Start latest Ixolo** | el núcleo de `/boot/minix_latest` |
| 3 | **Start latest Ixolo in single user mode** | lo mismo, con `bootopts=-s` (ver [modo monousuario](#modo-monousuario)) |
| 4 | **Edit menu option** | |
| 5 | **Drop to boot prompt** | |

El menú espera 5 segundos y arranca la entrada 2. `/boot/minix_default`
contiene el núcleo y los módulos que instaló `setup`; `/boot/minix_latest` es
un enlace simbólico que `setup` apunta a `minix_default`, así que en una
instalación nueva las entradas 1 y 2 arrancan los mismos ficheros. Si en
`/boot/minix` hay otros directorios con núcleos, `update_bootcfg` añade una
entrada **Start Ixolo (*nombre*)** por cada uno.

Todas las entradas llevan `rootdevname=` con el dispositivo raíz (por
ejemplo `c0d0p0s0`), seguido de los valores de `ahci`, `acpi`, `no_apic` y
`nobeep` con los que arrancó el sistema en marcha, si estaban puestos. En
una instalación nueva son los de la entrada de la ISO desde la que
instalaste, así que el sistema instalado arranca normalmente también con
`no_apic=0 acpi=1`.

### La imagen de disco

La imagen de disco para BIOS que construye
[`releasetools/amd64_hdimage.sh`]({{repo}}/blob/{{branch}}/releasetools/amd64_hdimage.sh)
(ver [Instalar en disco](/es/docs/start/install/#alternativa-construir-una-imagen-de-disco))
tiene su propio `/boot.cfg` fijo. Todas sus entradas llevan
`rootdevname=c0d0p0` y `ata_no_dma=1`:

| N.º | Entrada | Notas |
|---|---|---|
| 1 | **Start Ixolo** | `no_apic=0 acpi=1` |
| 2 | **Start latest Ixolo** | lo mismo, desde `/boot/minix_latest` |
| 3 | **Start latest Ixolo in single user mode** | añade `bootopts=-s` |
| 4 | **Start Ixolo ALIX** | consola en el primer puerto serie (`console=tty00 consdev=com0`) |
| 5 | **Start Ixolo (legacy PIC mode)** | sin `no_apic`, así que el núcleo usa el PIC 8259 |
| 6 | **Edit menu option** | |
| 7 | **Drop to boot prompt** | |
| 8 | **Start Ixolo (*versión*)** | el núcleo de `/boot/minix/`*versión* |

Espera 5 segundos y arranca la entrada 2.

## Cambiar las opciones de arranque

### Para un arranque: Edit menu option

En el menú de BIOS (ISO, disco instalado o imagen de disco):

1. Escribe el número de **Edit menu option** (el 3 en la ISO). La cuenta
   atrás se para y el prompt pasa a ser `Option (edit): [1]:`.
2. Escribe el número de la entrada que quieres cambiar. Su línea de órdenes
   aparece tras `>`, lista para editar.
3. Cámbiala y pulsa Intro. La línea editada se ejecuta en el acto.

En la ISO la línea es solo la orden `multiboot` con el núcleo y sus
parámetros. En un disco instalado son dos órdenes separadas por `;`: un
`load_mods` que carga los módulos de arranque y después la línea
`multiboot`. Conserva las dos. La línea puede tener hasta 255 caracteres.

El cambio no se guarda en ningún sitio: el siguiente arranque usa el menú tal
como estaba.

### El prompt de arranque

**Drop to boot prompt** sale del menú a un prompt `>` donde escribes tú las
órdenes del cargador. `help` las enumera. Las útiles:

| Orden | Qué hace |
|---|---|
| `help` o `?` | Enumera las órdenes. |
| `ls [ruta]` | Lista un directorio de la partición de arranque, por ejemplo `ls /boot/minix_default`. |
| `load_mods <patrón>` | Carga los módulos de arranque que encajan con un patrón, por ejemplo `/boot/minix_default/mod*`. |
| `load <ruta>` | Carga un módulo de arranque. |
| `multiboot <núcleo> [parámetros]` | Arranca el núcleo con esos parámetros. |
| `consdev <dispositivo>` | Mueve la consola del propio cargador: `com0` es el primer puerto serie, `pc` la pantalla y el teclado. |
| `menu` | Vuelve al menú. |
| `quit` | Reinicia la máquina. |

Para arrancar a mano un disco instalado, escribe las dos mitades de una
entrada del menú como dos órdenes. En este prompt una línea puede tener como
mucho 79 caracteres:

```text
> load_mods /boot/minix_default/mod*
> multiboot /boot/minix_default/kernel rootdevname=c0d0p0s0 no_apic=1
```

En la ISO los módulos de arranque ya están cargados, así que basta con la
línea `multiboot`:

```text
> multiboot /boot/minix_default/kernel bootcd=1 cdproberoot=1 no_apic=0
```

### Para siempre: update_bootcfg

Para cambiar el menú de un sistema instalado de forma permanente, edita la
plantilla y regenera `/boot.cfg`:

```sh
vi /etc/boot.cfg.default
update_bootcfg
```

Para añadir entradas sin tocar las de serie, ponlas en `/etc/boot.cfg.local`,
con el mismo formato. `update_bootcfg` las añade detrás de las demás; una
línea `default=` en ese fichero cuenta desde la primera entrada local. En las
plantillas, `$rootdevname` se sustituye por el dispositivo raíz y `$args` por
los parámetros heredados que se describen arriba. Lo que cambies
directamente en `/boot.cfg` se pierde la próxima vez que se ejecute
`update_bootcfg`. La referencia completa está en `man update_bootcfg`.

:::caution
`update_bootcfg` copia `ahci`, `acpi`, `no_apic` y `nobeep` del sistema en
marcha a todas las entradas. Si arrancaste una vez con `no_apic=1` y ejecutas
`update_bootcfg` en esa sesión, todas las entradas se quedan con `no_apic=1`
a partir de entonces.
:::

## Parámetros de arranque

Estos son los parámetros que es más probable que necesites. Añádelos a la
línea del núcleo con **Edit menu option**, en el prompt de arranque o en
GRUB. Con el sistema en marcha, `sysenv` muestra los parámetros con los que
arrancó, y `sysenv <nombre>` muestra uno.

| Parámetro | Qué hace | Si no está |
|---|---|---|
| `no_apic` | `0` usa el APIC, necesario para usar más de una CPU y para los discos NVMe. `1` usa el antiguo PIC 8259 y una sola CPU. | `1` (PIC). Los menús de serie ponen `0`, salvo la entrada legacy PIC. |
| `no_smp` | `1` usa solo la primera CPU, sin dejar el APIC. | `0` |
| `acpi` | Los menús ponen `acpi=1`. En amd64 el driver de ACPI se arranca esté puesto o no. | |
| `console` | `tty00` hace del primer puerto serie la consola del sistema (`tty01` el segundo, y así). | La pantalla |
| `verbose` | Mensajes del núcleo al arrancar, de `0` (silencio) a `3` (máximo). A partir de `2`, los scripts de arranque también escriben líneas de progreso `RDRC:` y `RCMINIX:`. `3` escribe una línea cada vez que se entra en el núcleo: inunda la consola, hace que el arranque vaya a paso de tortuga y solo sirve para depurar el núcleo. | `0` |
| `rs_verbose` | `1` hace que el Reincarnation Server cuente lo que hace, por ejemplo cada paso del reinicio de un servicio. | `0` |
| `bootcd` | Indica un arranque desde el CD live: `/etc/rc.minix` ejecuta entonces `/etc/rc.cd` para preparar ramdisks. Lo ponen las entradas de la ISO. | |
| `cdproberoot` | Busca el sistema de ficheros raíz en las unidades de CD (`cdprobe`) en vez de usar `rootdevname`. Lo ponen las entradas de la ISO. | |
| `rootdevname` | El dispositivo con el sistema de ficheros raíz, sin `/dev/`, por ejemplo `c0d0p0s0`. | El arranque se para con `rootdevname not set`, salvo que esté `cdproberoot`. |
| `ahci` | `yes` o `no`: usar, o no, el driver AHCI para el disco de arranque, en vez de sondear el bus PCI. | Se sondea |
| `nvme` | `yes` o `no`, lo mismo para una controladora NVMe. | Se sondea |
| `ata_no_dma` | `1` hace que el driver IDE (`at_wini`) trabaje sin DMA. La imagen de disco lo pone. | `0` |
| `hirestime` | `0` impide que los programas lean la hora del contador de ciclos del procesador (TSC) entre ticks del reloj. | Activado, si el contador va a ritmo constante o bajo un hipervisor |
| `nobeep` | `1` silencia el pitido de la consola. | `0` |

## Modo monousuario

En modo monousuario, `/etc/rc.minix` se detiene después de comprobar y montar
los sistemas de ficheros de `/etc/fstab`, antes de arrancar la red y ningún
demonio, y te da una shell de root en la consola con este mensaje:

```text
Single user. Press ^D to resume multiuser startup.
```

Sirve para reparaciones que piden el sistema en calma, sin nada más en
marcha: por ejemplo, deshacer un cambio en `/etc/rc.conf` que impide
arrancar. Pulsa Ctrl-D y el arranque sigue con normalidad.

:::caution[La entrada del menú aún no funciona]
Las entradas **single user mode** pasan `bootopts=-s`, pero `/etc/rc.minix`
lee un parámetro llamado `bootopt`, sin la `s` final, así que con el código
actual esas entradas arrancan con normalidad. Hasta que tu sistema tenga la
corrección ([#506]({{repo}}/pull/506)), usa **Edit menu option** y añade
`bootopt=-s` a la línea del núcleo; está probado en la ISO live.
:::

## Consola serie

Cómo usar {{name}} sin pantalla, con la consola en un puerto serie, se
explica en [Sin gráficos: consola serie](/es/docs/start/quickstart/#sin-gráficos-consola-serie).
En resumen: `console=tty00` lleva la consola al primer puerto serie, y las
entradas de consola serie de la ISO lo añaden por ti.

## Apagar y reiniciar

Para el sistema siempre con una de estas órdenes, como `root`:

| Orden | Qué hace |
|---|---|
| `shutdown -p now` | Ejecuta los scripts de apagado y después apaga la máquina. |
| `shutdown -h now` | Ejecuta los scripts de apagado y después detiene el sistema sin apagar. |
| `shutdown -r now` | Ejecuta los scripts de apagado y después reinicia. |
| `poweroff` | Apaga en el acto, sin los scripts de apagado. |
| `halt` | Detiene el sistema en el acto, sin los scripts de apagado. |
| `reboot` | Reinicia en el acto, sin los scripts de apagado. |

En lugar de `now`, `shutdown` acepta `+`*minutos* o una hora como `23:30`, y
un mensaje opcional que envía a los usuarios conectados. En los últimos cinco
minutos antes de la hora no se admiten nuevas entradas. Ver `man shutdown`.

Qué ocurre:

1. **Solo con `shutdown`:** ejecuta `/etc/rc.shutdown`, que llama con `stop`,
   en orden inverso, a los scripts de `/etc/rc.d` que tienen la palabra clave
   `shutdown`. Entre ellos están `inetd`, `ftpd`, las interfaces de red, los
   compositores del escritorio y `minixrc`, que para `devmand` y `usbd` y
   avisa al Reincarnation Server de que el sistema se apaga, para que no
   reinicie nada. Después `shutdown` ejecuta `halt` o `reboot`.
2. `halt`, `reboot` o `poweroff` vacía los búferes de disco, envía `SIGTERM`
   a todos los procesos, espera cinco segundos y los vuelve a vaciar.
3. El gestor de procesos (PM) mata lo que queda, y el servidor del sistema de
   ficheros virtual (VFS) vacía y desmonta todos los sistemas de ficheros.
4. El núcleo escribe `Ixolo has halted and will now power off.`,
   `Ixolo has halted. It is safe to turn off your computer.` o
   `Ixolo will now reset.`, y lo hace. Para apagar prueba primero con ACPI.

Los demonios sin la palabra clave `shutdown`, como `sshd` o `syslogd`, no los
para ningún script; reciben el `SIGTERM` del paso 2.

Si se va la luz o la máquina se reinicia sin nada de esto, los sistemas de
ficheros quedan sucios. MFS versión 4 reproduce su journal en el siguiente
montaje; los sistemas de ficheros sin journal se montan de solo lectura
hasta que los reparas. Ver
[Journaling y recuperación tras un fallo](/es/docs/admin/filesystems/#journaling-y-recuperación-tras-un-fallo).

### Ctrl-Alt-Supr

En la consola de texto, Ctrl-Alt-Supr (o Ctrl-Alt-Insert) pide a `init` que
ejecute `shutdown -r now`, un reinicio limpio. Si lo pulsas una tercera vez,
la máquina se reinicia en el acto, sin vaciar los discos.

## Otros sistemas operativos en el mismo disco

El arranque dual no se ha probado. Lo que hace el instalador: en un disco sin
tabla de particiones válida, el editor de particiones escribe el código de
arranque `/usr/mdec/mbr`, que arranca la partición activa, y marca como
activa la partición nueva. En un disco que ya tiene una, conserva el código
de arranque que hay y no cambia cuál es la partición activa. `setup` solo
escribe un bloque de arranque al principio de la partición de {{name}}, así
que sería otro gestor de arranque el que tendría que arrancar esa partición.

## Para saber más

- [Solución de problemas](/es/docs/start/troubleshooting/): un arranque que se
  detiene, un pánico del núcleo, sistemas de ficheros sucios.
- [Instalar en disco](/es/docs/start/install/), incluido
  [BIOS y UEFI: arranque desde disco](/es/docs/start/install/#bios-y-uefi-arranque-desde-disco).
- [Arranque UEFI](/es/docs/design/uefi-boot/): cómo funcionan la ISO híbrida y
  GRUB.
- `man update_bootcfg`, `man shutdown`, `man reboot`, `man sysenv`.
