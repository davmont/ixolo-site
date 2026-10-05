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

## Las cuatro capas

| Capa | Qué se ejecuta | Privilegio |
|---|---|---|
| 4. Programas de usuario | Shells, compiladores, editores, servicios de red, el escritorio | modo usuario |
| 3. Servidores del sistema | PM, VFS, VM, RS, DS, el planificador, servidores de ficheros, la pila de red | modo usuario |
| 2. Drivers | Disco (AHCI, NVMe, IDE), red (e1000, igc, virtio), USB, TTY… | modo usuario |
| 1. Microkernel | Interrupciones, planificación, paso de mensajes, el nivel más bajo de la gestión de memoria | modo núcleo |

Solo la capa 1 se ejecuta en modo núcleo. Drivers y servidores son procesos
con su propio espacio de direcciones, como cualquier programa, pero con
**privilegios** adicionales concedidos uno a uno: qué puertos de E/S puede
tocar un driver, qué interrupciones recibe, qué llamadas al núcleo puede hacer
y a qué otros procesos puede enviar mensajes. Un driver que falla solo puede
dañar lo que se le permitió tocar.

## El microkernel

El núcleo (en `minix/kernel/`, unas {{kernelLines}} líneas de C y ensamblador
contando el código amd64) se encarga de:

- **Interrupciones y excepciones.** Convierte una interrupción hardware en un
  mensaje para el driver que la pidió.
- **Planificación.** Elige qué proceso se ejecuta en cada CPU. Las decisiones
  de política quedan en un servidor planificador en espacio de usuario.
- **Paso de mensajes.** Los procesos usan `send`, `receive`, `sendrec` y
  `notify`. Consulta [Paso de mensajes](/es/docs/learn/message-passing/).
- **Llamadas al núcleo.** Operaciones privilegiadas que piden servidores y
  drivers mediante mensajes: copiar datos entre espacios de direcciones,
  preparar tablas de páginas, hacer E/S. Los programas normales no pueden
  usarlas.

## Los servidores del sistema

| Servidor | Función |
|---|---|
| **PM** (gestor de procesos) | `fork`, `exec`, `exit`, señales, grupos de procesos y control de trabajos, temporizadores |
| **VFS** (sistema de ficheros virtual) | Ficheros abiertos, resolución de rutas, montajes, locks; reenvía las peticiones a los servidores de ficheros |
| **VM** (memoria virtual) | Espacios de direcciones, `mmap`, `mprotect`, fallos de página, recuperación, compresión y swap |
| **RS** (reincarnation server) | Arranca cada driver y servidor, los vigila y los reinicia cuando fallan |
| **DS** (data store) | Un pequeño registro de nombres y valores con el que los componentes reiniciados recuperan su estado |
| **SCHED** | Política de planificación |
| Servidores de ficheros | MFS (el sistema de ficheros nativo), ext2/3/4, vfat, exfat, isofs, procfs, pfs (tuberías)… |
| Red | La pila TCP/IP (lwIP) también es un servidor |

Una llamada `read()` de un programa recorre: programa → VFS → el servidor MFS
de ese sistema de ficheros → el driver de disco → el hardware, y vuelta. Cada
salto es un mensaje.

## Cómo funciona la autorreparación

RS es el padre de todos los procesos del sistema. Cuando uno muere (porque ha
fallado, lo han matado o ha dejado de responder al latido periódico de RS), RS
recibe el aviso, arranca una copia nueva desde el mismo binario y publica el
nuevo endpoint a través de DS. Los componentes que hablaban con la copia
anterior lo detectan y repiten sus peticiones.

Para un driver de red esto es invisible salvo por unos pocos paquetes
perdidos, que TCP retransmite. Para un driver de disco, el servidor de
ficheros vuelve a emitir la petición. El resto del sistema no se detiene
nunca.

Pruébalo en el [laboratorio «rompe un driver»](/es/docs/learn/lab-break-a-driver/).

## El precio

Cada petición atraviesa más espacios de direcciones que en un núcleo
monolítico, así que el paso de mensajes tiene que ser rápido. En amd64,
{{name}} tiene una vía rápida para el envío y recepción en la misma CPU, y
mueve los servidores a la CPU de su cliente más activo. Eso redujo la mediana
del tiempo de ida y vuelta unas cinco veces con cuatro CPUs.

## Para saber más

- Andrew S. Tanenbaum y Albert S. Woodhull, *Operating Systems: Design and
  Implementation*, 3.ª edición (2006): el libro de texto construido en torno a
  MINIX 3.
- Jorrit N. Herder et al., *MINIX 3: A Highly Reliable, Self-Repairing
  Operating System*, ACM SIGOPS Operating Systems Review, 2006.
- Andrew S. Tanenbaum, *Lessons Learned from 30 Years of MINIX*,
  Communications of the ACM, 2016.
- Los documentos de diseño de esta web, empezando por
  [SMP en amd64](/es/docs/design/smp/).
