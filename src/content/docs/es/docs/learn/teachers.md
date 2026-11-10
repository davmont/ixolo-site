---
title: "Guía para docentes"
description: "Cómo usar {{name}} en un curso de sistemas operativos: dónde está cada tema en el código, el libro de texto, ideas de prácticas y logística."
sidebar:
  order: 6
---

MINIX se escribió para enseñar, y {{name}} mantiene ese objetivo
funcionando en los PC de 64 bits actuales. Esta página es para quien da
clase de sistemas operativos y quiere usarlo en un curso: qué aporta, dónde
está cada tema en el código, qué relación hay entre el libro clásico y el
código actual, y qué conviene preparar antes de la primera práctica.

## Por qué usarlo en un curso

- **Es lo bastante pequeño para leerlo.** El núcleo tiene unas
  {{kernelLines}} líneas de C y ensamblador, código amd64 incluido. Un
  estudiante puede seguir una llamada al sistema desde la biblioteca C
  hasta el núcleo y de vuelta en una tarde.
- **La estructura es la lección.** La gestión de procesos, la memoria, los
  sistemas de ficheros y los drivers son programas separados, en
  directorios separados, que se comunican con mensajes. Las fronteras que
  un núcleo monolítico difumina aquí son explícitas.
- **Los errores no son fatales.** Un driver con fallos escrito por un
  estudiante tumba un proceso en modo usuario, no la máquina. El servidor
  de reencarnación lo reinicia, y eso también se puede estudiar.
- **Es un sistema real y actual.** Arranca en x86-64 con QEMU o KVM,
  admite multiprocesador (hasta {{maxCpus}} CPU al compilar), se compila
  con LLVM {{llvm}} y supera {{posixPassed}} de {{posixTotal}} pruebas de
  la Open POSIX Test Suite. Los estudiantes trabajan con los mismos
  conceptos que encontrarán en Linux o en los BSD.
- **Tiene licencia BSD**, así que puedes publicar versiones modificadas,
  esqueletos de prácticas y soluciones sin problemas de licencia.

## Dónde está cada tema

Las rutas son relativas a la raíz del [árbol de código]({{repo}}/tree/{{branch}})
en la rama `{{branch}}`.

| Tema | Dónde mirar |
|---|---|
| Arranque e inicio del núcleo | `minix/kernel/arch/x86_64/head.S`, `pre_init.c`, luego `minix/kernel/main.c`; el arranque UEFI con GRUB se describe en [Arranque UEFI](/es/docs/design/uefi-boot/) |
| Procesos y tabla de procesos | `minix/kernel/proc.h`, `minix/kernel/proc.c`; la vista de nivel de usuario en `minix/servers/pm/` (`forkexit.c`, `exec.c`, `signal.c`) |
| Paso de mensajes (IPC) | `minix/kernel/proc.c` (`do_ipc`, `mini_send`, `mini_receive`), formatos de mensaje en `minix/include/minix/ipc.h`, números de llamada en `minix/include/minix/ipcconst.h` |
| Llamadas al núcleo | la tabla de despacho en `minix/kernel/system.c`, un manejador por llamada en `minix/kernel/system/do_*.c`, números en `minix/include/minix/com.h`, funciones de biblioteca en `minix/lib/libsys/sys_*.c` |
| Interrupciones y reloj | `minix/kernel/interrupt.c`, `minix/kernel/clock.c`, `minix/kernel/arch/x86_64/apic.c` e `i8259.c` |
| Planificación | el mecanismo en `minix/kernel/proc.c` (colas de listos, `pick_proc`); la política en el servidor SCHED, `minix/servers/sched/schedule.c` |
| Multiprocesador | `minix/kernel/smp.c`, `minix/kernel/arch/x86_64/arch_smp.c`; ver [Diseño SMP](/es/docs/design/smp/) |
| Gestión de memoria | el servidor VM, `minix/servers/vm/` (`region.c`, `pagefaults.c`, `mmap.c`, `pagetable.c`); recuperación y swap en [Recuperación de memoria](/es/docs/design/reclaim/) |
| Compartir memoria de forma segura entre procesos | grants: `minix/include/minix/safecopies.h`, `minix/lib/libsys/safecopies.c`, `minix/kernel/system/do_safecopy.c` |
| Sistemas de ficheros | la capa VFS en `minix/servers/vfs/` (hilos de trabajo en `worker.c`); el sistema de ficheros nativo en `minix/fs/mfs/`; los demás (ext2, vfat, exfat, isofs, tmpfs, procfs) a su lado en `minix/fs/` |
| Drivers | ejemplo: `minix/drivers/examples/hello/`; bibliotecas: `minix/lib/libchardriver/`, `minix/lib/libblockdriver/`; drivers reales en `minix/drivers/storage/` (ahci, nvme, at_wini), `minix/drivers/tty/` |
| Fiabilidad y recuperación | el servidor de reencarnación `minix/servers/rs/`, el System Event Framework `minix/lib/libsys/sef*.c`, el almacén de datos `minix/servers/ds/` |
| Privilegios | la política de cada servicio en `etc/system.conf` y `/etc/system.conf.d/`; la interpreta `minix/commands/minix-service/` |
| Red | la pila basada en lwIP en `minix/net/lwip/`, los sockets de dominio UNIX en `minix/net/uds/` |
| Pruebas | `minix/tests/` (se instala en `/usr/tests/minix-posix`) |

[La visión general de la arquitectura](/es/docs/learn/architecture/) y
[Paso de mensajes](/es/docs/learn/message-passing/) son buenas lecturas
previas antes de que los estudiantes abran el código.

## Leer el libro de texto junto a {{name}}

El acompañante habitual es Tanenbaum y Woodhull, *Operating Systems:
Design and Implementation*, 3.ª edición (Prentice Hall, 2006; en español,
*Sistemas operativos: diseño e implementación*). Explica MINIX 3.1.0 e
incluye buena parte de su código. Sus conceptos siguen siendo la mejor
entrada a este código. Muchos detalles ya no, porque MINIX siguió
evolucionando diez años después del libro y {{name}} ha evolucionado otra
vez desde entonces.

| En el libro (MINIX 3.1.0) | En {{name}} hoy |
|---|---|
| Microkernel, drivers y servidores como procesos de usuario, RS reinicia los drivers que fallan | **Igual.** Sigue siendo el núcleo del diseño. |
| `send`, `receive`, `sendrec`, `notify` con mensajes de tamaño fijo | Las mismas primitivas, más envíos no bloqueantes y asíncronos. Los mensajes son structs con tipo. En amd64 la carga útil pasa de 56 a un máximo de 96 bytes. |
| Copias entre procesos con `sys_vircopy` y direcciones físicas | **Grants**: un proceso indica exactamente qué bytes puede leer o escribir otro, y el núcleo comprueba cada copia. |
| Planificación dentro del núcleo, 16 colas de prioridad | El núcleo mantiene las colas, pero un servidor SCHED en espacio de usuario fija prioridades y quantums (desde la 3.1.7). {{name}} añade SMP, afinidad de CPU y clases de tiempo real. |
| Memoria gestionada por PM con segmentos, sin paginación | Un **servidor VM** aparte con paginación (desde la 3.1.4). {{name}} usa tablas de páginas amd64 de 4 niveles, NX, un espacio de usuario de 47 bits, recuperación y memoria comprimida. |
| Un único servidor de ficheros, de un solo hilo | **VFS** más servidores de sistemas de ficheros separados; VFS es multihilo. MFS ha ganado inodos versión 4 y journaling. |
| Intel de 16 y 32 bits, protección por segmentos, monitor de arranque propio de MINIX | **Solo x86-64**, protección por paginación, arranque por BIOS o UEFI (con GRUB en UEFI). |
| Compilador ACK, binarios a.out, órdenes propias de MINIX | **LLVM/clang {{llvm}}** y lld, binarios ELF, bibliotecas compartidas, biblioteca C y herramientas de usuario de NetBSD (desde la 3.2.0). |
| Una CPU | Hasta {{maxCpus}} CPU. El núcleo funciona bajo un gran cerrojo (big kernel lock). |

Una forma práctica de usar el libro: manda leer los capítulos de conceptos
(procesos, E/S, memoria, sistemas de ficheros) tal cual, y sustituye los
recorridos por el código por los ficheros actuales de la tabla anterior.
Los estudiantes encontrarán código que el libro no menciona; es un buen
punto de debate sobre cómo evolucionan los sistemas reales.

Upstream mantiene un [listado indexado del código del libro](http://www.minix3.org/documentation/AppendixB.html)
para la 3.1.0, útil para comparar versiones antiguas y nuevas de un mismo
fichero.

## Ideas de prácticas

De momento solo la primera práctica tiene página en esta web. Las demás
son ideas con referencias; compruébalas con el árbol actual antes de
dárselas a los estudiantes.

1. **Romper un driver.** Mata o haz fallar un driver y observa cómo se
   recupera el sistema. Ver [Práctica: romper un driver](/es/docs/learn/lab-break-a-driver/).
2. **Driver «hello».** Estudiar `minix/drivers/examples/hello/`, un driver
   de caracteres mínimo que el sistema base instala como `/service/hello`,
   con su política en `/etc/system.conf.d/hello`. Los estudiantes lo
   arrancan con `minix-service`, leen de él y luego lo amplían (un
   contador, un buffer circular, un segundo dispositivo menor). La
   [guía de programación de drivers](https://wiki.minix3.org/doku.php?id=developersguide:driverprogramming)
   de upstream describe el mismo driver para i386.
3. **Añadir una llamada al núcleo.** Definir un número en
   `minix/include/minix/com.h`, escribir un manejador en
   `minix/kernel/system/`, registrarlo en `minix/kernel/system.c`, añadir
   la función a `libsys`, añadir su nombre a la tabla de
   `minix/commands/minix-service/parse.c` y permitirla a un servicio en su
   entrada de `system.conf`. Enseña el modelo de privilegios tanto como el
   núcleo. La página
   [new kernel call](https://wiki.minix3.org/doku.php?id=developersguide:newkernelcall)
   de upstream da la versión i386.
4. **Cambiar la política de planificación.** La política es un servidor en
   espacio de usuario, así que los estudiantes pueden reescribir
   `minix/servers/sched/schedule.c` (planificación por lotería o de reparto
   justo son ejercicios clásicos) sin tocar el núcleo. Un error en su
   planificador es mucho más fácil de depurar que uno en código del
   núcleo.
5. **Ejecutar y ampliar la batería de pruebas.** Como root,
   `cd /usr/tests/minix-posix` y `./run` (o `./run -t 1` para una sola
   prueba, `./run -l` para listarlas). Los estudiantes escriben una prueba
   nueva para una llamada al sistema, o para el código que cambiaron en una
   práctica anterior. Ver [Pruebas](/es/docs/develop/testing/).

## Logística del curso

- **Usa QEMU.** Cada máquina de estudiante necesita `qemu-system-x86_64`.
  Con KVM (anfitriones Linux con virtualización por hardware) el sistema
  arranca en segundos. Sin KVM, QEMU emula la CPU: funciona, pero las
  pruebas tardan varias veces más.
- **El modelo de CPU importa.** El núcleo necesita las instrucciones
  FSGSBASE. Con KVM pasa `-cpu host`; sin KVM usa `-cpu max`. El modelo de
  CPU por defecto de QEMU no arranca. Una orden mínima:

  ```sh
  qemu-system-x86_64 -enable-kvm -cpu host -m 1024 -smp 2 \
      -cdrom minix_amd64.iso
  ```

- **No hagas que los estudiantes compilen la cadena de herramientas.** Una
  compilación cruzada completa desde cero compila primero LLVM: en las
  máquinas de CI de 4 núcleos la cadena de herramientas tarda unas dos
  horas y el sistema otras dos. Compílalo una vez en un servidor del
  laboratorio y reparte la ISO, o remite a los estudiantes a la ISO que el
  CI genera en cada commit (en la [pestaña Actions]({{repo}}/actions); hace
  falta una cuenta de GitHub, y los artefactos se borran a los 7 días). Ver
  [Compilar](/es/docs/develop/building/).
- **Después, recompila solo lo que cambia.** Tras la primera compilación
  completa, quien modifica un servidor o un driver solo recompila esa parte
  y genera una imagen nueva.
- **Depuración.** No hay gdb ni lldb en el sistema. Los estudiantes depuran
  con `printf`, el log del núcleo, la consola serie y el monitor de QEMU.
  Planifica las prácticas teniéndolo en cuenta.
- **No todo lo de upstream funciona.** La actualización en caliente no está
  disponible en amd64, i386 no compila y no hay repositorio de paquetes
  binarios. Evita ejercicios que dependan de eso.

## Más material

- **Lista de cursos de upstream:** [universidades que han usado MINIX 3](https://wiki.minix3.org/doku.php?id=courses).
  Muchas de esas páginas son antiguas y algunos enlaces están rotos, pero
  las ideas de ejercicios siguen valiendo.
- **Ideas de proyectos para estudiantes:** [proyectos de estudiantes de upstream](https://wiki.minix3.org/doku.php?id=studentprojects:start),
  pensados para los estudiantes del grupo de investigación.
- **Artículos asequibles para estudiantes:**
  - Herder et al., «MINIX 3: A Highly Reliable, Self-Repairing Operating
    System», *ACM SIGOPS Operating Systems Review*, julio de 2006:
    [PDF](http://www.minix3.org/docs/jorrit-herder/osr-jul06.pdf).
  - Tanenbaum et al., «MINIX 3: Status Report and Current Research»,
    USENIX *;login:*, junio de 2010: [PDF](http://www.minix3.org/docs/login-2010.pdf).
  - Tanenbaum, «Lessons Learned from 30 Years of MINIX», *CACM*, marzo de
    2016, DOI [10.1145/2795228](https://doi.org/10.1145/2795228).
- **Vídeo:** la [charla de Tanenbaum sobre MINIX 3 en FOSDEM](https://www.youtube.com/watch?v=bx3KuE7UjGA) (en inglés).
- **Historia:** [De MINIX a {{name}}](/es/docs/learn/history/) da a los
  estudiantes el contexto.
- **Más artículos y tesis:** [Para saber más](/es/docs/reference/further-reading/).

## Comparte tu material

Si usas {{name}} en un curso, nos gustaría saberlo: qué funcionó, qué
falló y qué prácticas preparaste. Abre una issue en [{{issues}}]({{issues}}).
También son bienvenidos enunciados de prácticas, transparencias y
correcciones a esta página, con una licencia que permita reutilizarlos.
