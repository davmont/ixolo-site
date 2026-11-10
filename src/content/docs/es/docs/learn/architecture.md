---
title: La arquitectura en cuatro capas
description: Cómo está construido {{name}} y por qué un driver que falla no tumba el sistema.
sidebar:
  order: 1
---

La mayoría de los sistemas operativos de uso diario (Linux, Windows, macOS,
los BSD) tienen un núcleo **monolítico**: el planificador, los sistemas de
ficheros, la pila de red y todos los drivers se ejecutan juntos en un único
espacio de direcciones privilegiado. Un error en cualquiera de ellos, como un
puntero descontrolado en el driver de una tarjeta de red, puede corromper el
resto y tumbar la máquina entera.

{{name}}, como MINIX 3, del que deriva, hace lo contrario. El núcleo hace lo
mínimo posible, y todo lo demás funciona como procesos normales y aislados en
modo usuario que se comunican pasándose mensajes.

:::note[Qué hay de nuevo en {{name}}]
El diseño es el de MINIX 3. Lo que {{name}} ha cambiado es la máquina sobre la
que funciona:

- **Solo x86-64.** El núcleo, los servidores y los drivers son de 64 bits. La
  compilación para i386 está rota en la rama de desarrollo y ARM no se
  mantiene.
- **SMP** con hasta {{maxCpus}} CPUs (un límite fijado al compilar), con una
  vía rápida de IPC y servidores que siguen a sus clientes de una CPU a otra
  (consulta [el precio](#el-precio) más abajo).
- Arranque **UEFI y BIOS** desde la misma ISO híbrida.
- **Un espacio de direcciones de usuario de 47 bits** (128 TB) para los
  programas normales. Los servicios del sistema siguen viviendo en el primer
  gigabyte.
:::

## Las cuatro capas

| Capa | Qué se ejecuta | Privilegio |
|---|---|---|
| 4. Programas de usuario | Shells, compiladores, editores, demonios de red, el escritorio opcional | modo usuario |
| 3. Servidores del sistema | PM, VFS, VM, RS, DS, SCHED, MIB, servidores de ficheros, la pila de red | modo usuario |
| 2. Drivers | Disco (AHCI, NVMe, IDE), red (e1000, igc y tarjetas más antiguas), almacenamiento USB, TTY, PCI, ACPI… | modo usuario |
| 1. Microkernel | Interrupciones, planificación, paso de mensajes, el nivel más bajo de la gestión de memoria | modo núcleo |

Solo la capa 1 se ejecuta en modo núcleo. Drivers y servidores son procesos
con su propio espacio de direcciones, como cualquier programa, pero con
**privilegios** adicionales concedidos uno a uno en `/etc/system.conf`: qué
puertos de E/S puede tocar un driver, qué interrupciones recibe, qué llamadas
al núcleo puede hacer y a qué otros procesos puede enviar mensajes. Un driver
que falla solo puede dañar lo que se le permitió tocar.
[Aislamiento y autorreparación](/es/docs/learn/reliability/) muestra una
entrada real.

## El microkernel

El núcleo (en `minix/kernel/`, unas {{kernelLines}} líneas de C y ensamblador
contando el código amd64) se encarga de:

- **Interrupciones y excepciones.** Convierte una interrupción hardware en una
  notificación para el driver que se registró para ella.
- **Planificación.** Elige qué proceso se ejecuta en cada CPU. Las decisiones
  de política (prioridades, en qué CPU debe vivir un servidor) quedan en el
  servidor SCHED, en espacio de usuario.
- **Paso de mensajes.** Los procesos usan `send`, `receive`, `sendrec`,
  `notify` y algunas variantes. Consulta
  [Paso de mensajes](/es/docs/learn/message-passing/).
- **Llamadas al núcleo.** Operaciones privilegiadas que piden servidores y
  drivers mediante mensajes: copiar datos entre espacios de direcciones,
  preparar tablas de páginas, hacer E/S. Los programas normales no pueden
  usarlas.

En máquinas SMP el núcleo está protegido por un único cerrojo global: solo una
CPU ejecuta código del núcleo a la vez, mientras los servidores y programas en
modo usuario funcionan en paralelo.

## El arranque: quién arranca a quién

El cargador (el derivado de NetBSD en BIOS, GRUB en UEFI) carga el núcleo y
doce **módulos de arranque**: `ds`, `rs`, `pm`, `sched`, `vfs`, `memory`
(discos RAM y `/dev/null`), `tty`, `mib`, `vm`, `pfs`, `mfs` e `init`. La
lista está en
[`minix/kernel/table.c`]({{repo}}/blob/{{branch}}/minix/kernel/table.c).
Con ellos basta para montar un pequeño disco RAM y ejecutar un script de
shell.

A partir de ahí, RS arranca todo lo demás a petición de los scripts de inicio:

1. El script del disco RAM
   ([`minix/drivers/storage/ramdisk/rc`]({{repo}}/blob/{{branch}}/minix/drivers/storage/ramdisk/rc))
   arranca `acpi`, `pci`, `input`, `pckbd`, el driver de disco que encuentre
   (`nvme`, `ahci`, `virtio_blk` o `at_wini`) y `procfs`, y monta la raíz real.
2. [`/etc/rc.minix`]({{repo}}/blob/{{branch}}/etc/rc.minix) arranca `is`
   (volcados de depuración), `random`, `readclock.drv`, `usbd` y `devmand`, y
   monta un `tmpfs` en `/var/shm`.
3. [`/usr/etc/rc`]({{repo}}/blob/{{branch}}/etc/usr/rc) arranca un driver de
   red por cada tarjeta que encuentra en el bus PCI y después `pty`, `lwip`,
   `uds`, `ipc` y `log`.

Todos ellos se arrancan con la orden `minix-service up`, que pide a RS que
cree el proceso. Por eso RS puede reiniciar cualquiera de ellos más tarde.

## Los servidores del sistema

| Servidor | Función |
|---|---|
| **PM** (gestor de procesos) | `fork`, `exec`, `exit`, señales, grupos de procesos y control de trabajos, temporizadores |
| **VFS** (sistema de ficheros virtual) | Ficheros abiertos, resolución de rutas, montajes, locks, `select`/`poll`/`kqueue`; reenvía las peticiones a los servidores de ficheros |
| **VM** (memoria virtual) | Espacios de direcciones, `mmap`, `mprotect`, fallos de página, recuperación de páginas, memoria comprimida. Existe swap en el núcleo y en VM, pero todavía no hay herramienta `swapon` |
| **RS** (reincarnation server) | Arranca cada driver y servidor, los vigila y los reinicia cuando fallan |
| **DS** (data store) | Un pequeño registro de nombres y valores; ahí encuentran los componentes el endpoint actual de los demás |
| **SCHED** | Política de planificación, afinidad de CPU, clases de tiempo real, traslado de servidores entre CPUs |
| **MIB** | El árbol de `sysctl` y la información de procesos que leen `ps` y `top` |
| **IPC** | Memoria compartida y semáforos System V, colas de mensajes y semáforos POSIX |
| Servidores de ficheros | MFS (el sistema de ficheros nativo), ext2/3/4, vfat, exfat, isofs, procfs, ptyfs, tmpfs, pfs (tuberías) |
| Red | `lwip` (la pila TCP/IP) y `uds` (sockets de dominio UNIX) también son servidores |

Una llamada `read()` de un programa recorre: programa → VFS → el servidor MFS
de ese sistema de ficheros → el driver de disco → el hardware, y vuelta. Cada
salto es un mensaje.

## Cómo funciona la autorreparación

RS es el padre de todos los procesos del sistema. Cuando uno muere (porque ha
fallado, lo han matado o ha dejado de responder al latido periódico de RS), RS
recibe el aviso y arranca una copia nueva desde el mismo binario. Cada driver
publica su nuevo endpoint en DS, y los servidores que lo usaban (VFS, la pila
de red) están suscritos a esas entradas, así que se enteran y repiten las
peticiones pendientes.

Para un driver de red, el efecto visible son unos pocos paquetes perdidos,
que TCP retransmite. Para un driver de disco, el servidor de ficheros vuelve a
emitir la petición. El resto del sistema sigue funcionando.

Esto vale para los drivers y para algunos servidores, no para todo: un fallo
en VFS, PM o VM, o en el núcleo, sigue deteniendo la máquina.
[Aislamiento y autorreparación](/es/docs/learn/reliability/) traza la línea
con precisión, y el [laboratorio «rompe un driver»](/es/docs/learn/lab-break-a-driver/)
te deja comprobarlo.

## El precio

Cada petición atraviesa más espacios de direcciones que en un núcleo
monolítico, así que el paso de mensajes tiene que ser rápido. En amd64,
{{name}} tiene dos optimizaciones:

- una **vía rápida** para `sendrec` cuando el receptor ya está esperando: el
  núcleo copia el mensaje y, si ambos están en la misma CPU, salta
  directamente al receptor sin pasar por la cola de ejecución;
- la **colocación de servidores**: SCHED cuenta desde qué CPU llegan las
  peticiones de cada servidor y lo traslada a esa CPU cuando una sola envía
  la mayoría (VFS, VM, RS y el propio SCHED no se mueven).

Medidas al integrarlas, con cuatro CPUs (`-smp 4`), las dos juntas bajaron la
mediana del tiempo de ida y vuelta de unos 78 300 a 16 100 ciclos de CPU:
4,86 veces más rápido.

## Para saber más

- Andrew S. Tanenbaum y Albert S. Woodhull, *Operating Systems: Design and
  Implementation*, 3.ª edición (2006): el libro de texto construido en torno a
  MINIX 3.
- Jorrit N. Herder et al., *MINIX 3: A Highly Reliable, Self-Repairing
  Operating System*, ACM SIGOPS Operating Systems Review, 2006.
- Andrew S. Tanenbaum, *Lessons Learned from 30 Years of MINIX*,
  Communications of the ACM, 2016.
- La descripción de los servidores y del arranque en la wiki original (en
  inglés):
  <https://wiki.minix3.org/doku.php?id=developersguide:overviewofminixservers>
- Los documentos de diseño de esta web, empezando por
  [SMP en amd64](/es/docs/design/smp/).
