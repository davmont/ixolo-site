---
title: "Compatibilidad POSIX"
description: "Qué implementa {{name}} de POSIX, medido con el Open POSIX Test Suite y pjdfstest, y los huecos conocidos."
sidebar:
  order: 3
---

{{name}} quiere ejecutar programas POSIX normales sin cambios. "Compatible
con POSIX" dice poco sin cifras, así que el proyecto lo mide con dos baterías
de pruebas públicas y mantiene en el árbol una lista de cada fallo conocido.

## Las cifras

| Batería | Resultado | Cómo se ejecuta |
|---|---|---|
| [Open POSIX Test Suite](https://github.com/linux-test-project/ltp/tree/master/testcases/open_posix_testsuite) (de LTP 20250130) | Pasan **{{posixPassed}} de {{posixTotal}}** pruebas | QEMU/KVM, 2 CPU. Se lanza a mano, no en la CI. |
| [pjdfstest](https://github.com/pjd/pjdfstest) (semántica de sistemas de ficheros) | Pasan **{{pjdfstestPassed}} de {{pjdfstestTotal}}** scripts | En la CI, en cada pull request, con 1 y 2 CPU, sobre un MFS recién creado |

Ninguna de las dos tiene **fallos inesperados**: cada prueba que no pasa
está en un fichero de fallos conocidos, con su motivo. El arnés de pruebas da
la ejecución por fallida si una prueba de la lista empieza a pasar, así que
las listas no pueden quedarse viejas sin que nadie se entere.

Qué incluye el total del Open POSIX: unas 1750 pruebas de conformidad,
contando las que no compilan (normalmente porque falta la interfaz que
prueban) y unas 30 que se declaraban UNSUPPORTED o UNTESTED en la medición
inicial. Una prueba que no compila cuenta como no superada. En pjdfstest, la
diferencia son los 8 fallos conocidos y un script que se omite.

### Cómo se llegó aquí

El Open POSIX Test Suite se importó el 22 de octubre de 2026
([PR #456]({{repo}}/pull/456)). Desde entonces, casi todo el trabajo de POSIX
se ha medido con él:

| Cambio | Pasan |
|---|---|
| Importación, punto de partida ([#456]({{repo}}/pull/456)) | 1287 |
| Señales de tiempo real ([#461]({{repo}}/pull/461)) | 1358 |
| Semáforos con nombre y compartidos ([#462]({{repo}}/pull/462)) | 1403 |
| E/S asíncrona ([#463]({{repo}}/pull/463)) | 1469 |
| `SCHED_FIFO` y `SCHED_RR` ([#464]({{repo}}/pull/464)) | 1530 |
| Protección y herencia de prioridad, afinidad de CPU, sincronización entre procesos ([#472]({{repo}}/pull/472)–[#479]({{repo}}/pull/479)) | 1542 |
| `mlock` y otras interfaces pequeñas ([#480]({{repo}}/pull/480)) | 1576 |
| Cancelación asíncrona de hilos ([#481]({{repo}}/pull/481)) | 1626 |
| tmpfs, memoria compartida como ficheros ([#483]({{repo}}/pull/483)) | 1641 |
| Memoria anónima compartida tras `fork` ([#487]({{repo}}/pull/487)) | 1643 |
| Puntos de cancelación diferida ([#488]({{repo}}/pull/488)) | 1645 |

pjdfstest pasó de 184 de 238 (26 de septiembre de 2026) a 216
([#406]({{repo}}/pull/406)) y luego a 229 ([#408]({{repo}}/pull/408)), donde
se ha mantenido.

## Qué está implementado

| Área | Estado |
|---|---|
| Hilos | libpthread sobre hilos planificados por el núcleo (llamadas `_lwp_*` en PM). `fork` desde un hilo, `pthread_detach`, esperas con plazo, cancelación asíncrona y diferida. Mutex, variables de condición, rwlocks y barreras compartidos entre procesos. Mutex `PTHREAD_PRIO_INHERIT` y `PTHREAD_PRIO_PROTECT`. |
| Señales | `SA_SIGINFO` con `ucontext`, `sigaltstack`, `SA_RESTART`, `pthread_kill`, entrega de una señal de proceso a cualquier hilo que no la bloquee. Señales de tiempo real de `SIGRTMIN` a `SIGRTMAX`, encoladas con valor: `sigqueue`, `sigwaitinfo`, `sigtimedwait`. |
| Relojes y temporizadores | `CLOCK_REALTIME`, `CLOCK_MONOTONIC`, relojes de tiempo de CPU de proceso y de hilo, `timer_create` y las demás `timer_*`, `clock_nanosleep`. Cambiar la hora ya no altera el reloj monótono ni las esperas con plazo. |
| IPC | Colas de mensajes POSIX (`mq_*`), semáforos con nombre y compartidos entre procesos (hasta 256 en el sistema), `shm_open` como ficheros en un tmpfs en `/var/shm`. Memoria compartida y semáforos de System V. |
| E/S asíncrona | `aio_*` y `lio_listio` en `librt`. No hay AIO en el núcleo: un grupo de hilos hace la E/S con `pread` y `pwrite`. Las señales de fin llegan con `SI_ASYNCIO`. |
| Planificación | Llamadas `sched_*`, `SCHED_FIFO` y `SCHED_RR` para root, en una franja por debajo de los servicios del sistema. Si los procesos de tiempo real pasan del 95 % de una CPU, se les frena para que una shell aún pueda matar a uno desbocado. Afinidad de CPU con `sched_setaffinity_np` y `pthread_setaffinity_np`. |
| Bloqueos de ficheros | Bloqueos de registros con `fcntl`, y `flock`. |
| Llamadas con ruta | La familia `*at`, `O_NOFOLLOW`, `O_DIRECTORY`; un puntero de ruta no válido devuelve `EFAULT`. |
| Ficheros y E/S | `pread`/`pwrite`, `preadv`/`pwritev`, `posix_fallocate`, `O_SYNC`/`O_DSYNC`, `fdatasync` (un `fsync` completo). |
| Memoria | `mmap` respetando `PROT_*`, `mprotect`, `msync`, proyecciones `MAP_SHARED` de escritura de ficheros en MFS y tmpfs, memoria anónima `MAP_SHARED` compartida tras `fork`. |
| Espera | `select`, `pselect`, `poll` y `ppoll` para todos los procesos (ya no existe el antiguo límite de 25 procesos a la vez), `POLLNVAL`. `kqueue`/`kevent` con los filtros de lectura, escritura, vnode, temporizador y usuario. |
| Control de trabajos | Sesiones, grupos de procesos, un estado de parada real (`SIGSTOP`, `SIGTSTP`, `SIGCONT`), `waitid`, el grupo de primer plano del terminal con `SIGTTIN`/`SIGTTOU`, y control de trabajos en `/bin/sh` (`fg`, `bg`, `Ctrl-Z`). |

Para saber qué servidor implementa cada llamada, mira la
[referencia de llamadas al sistema](/es/docs/reference/syscalls/).

## Huecos conocidos

Las listas de fallos conocidos son el resumen honesto. Las dos están en el
árbol:
[`qemutest-posix.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-posix.xfail)
(78 entradas, 12 de ellas marcadas como inestables) y
[`qemutest-pjdfstest.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-pjdfstest.xfail)
(8 entradas). Por categorías:

**Sistemas de ficheros (pjdfstest)**

- *Marcas de tiempo por debajo del segundo.* MFS guarda segundos enteros, así
  que los nanosegundos escritos con `utimensat` se leen como 0
  (`utimensat/08`). En tmpfs la prueba pasa.
- *Rutas largas.* Los componentes de ruta y los destinos de enlaces
  simbólicos que superan los límites de MFS no fallan con `ENAMETOOLONG` como
  espera POSIX (7 scripts de `link`, `rename` y `symlink`).

**Open POSIX Test Suite**

- *Cambio de hora.* Fallan seis pruebas de `clock_settime`, además de
  `clock/2-1` y `clock_nanosleep/13-1`.
- *Bloqueo de memoria.* `mlock` y `mlockall` comprueban sus argumentos pero
  no fijan páginas, así que fallan las pruebas que esperan `EBUSY` o `EAGAIN`
  de la memoria bloqueada.
- *Colas de mensajes y semáforos.* Algunos casos límite de envío y recepción
  con plazo y de borrado (`mq_timedsend/5-*`, `mq_timedreceive/5-1`,
  `sem_unlink/4-1`...).
- *Hilos.* 27 pruebas de los grupos `pthread_*`. Unas no compilan, otras no
  consiguen prepararse y otras agotan el tiempo. Muchas son de variables de
  condición y de bloqueos con plazo.
- *Tiempos.* Las entradas de AIO, `clock/1-1`, `sigwait/6-*` y
  `sched_setparam/27-1` son inestables: dependen de qué termina antes.
- *Otras.* `killpg/1-2` y cuatro pruebas `sched_setparam/25-*` no compilan;
  `timer_create/10-1` necesita `_SC_CPUTIME`.

**Lo que no mide ninguna de las dos**

- `kqueue` no tiene `EVFILT_SIGNAL`, `EVFILT_PROC` ni `EVFILT_AIO`; devuelven
  `EINVAL`.
- `poll` está construido sobre `select`, así que no informa de `POLLHUP`.
- Las proyecciones `MAP_SHARED` de escritura de ficheros solo funcionan en MFS
  y tmpfs; los demás sistemas de ficheros devuelven `ENODEV`.
- Las colas de mensajes de System V (`msgget` y el resto) no están
  implementadas.
- Los ejecutables no son independientes de la posición (PIE). POSIX no lo
  exige, pero limita la aleatorización del espacio de direcciones a la pila y
  a la base de `mmap`.

## Ejecutar las pruebas tú mismo

Las dos baterías se ejecutan en QEMU con `releasetools/qemutest.py`. La
[guía de pruebas](/es/docs/develop/testing/) explica el arnés. En resumen,
desde la raíz del código y después de compilar:

```sh
# pjdfstest, como lo ejecuta la CI
python3 releasetools/qemutest.py --iso minix_amd64.iso --smp 2 \
  --suite pjdfstest --xfail releasetools/qemutest-pjdfstest.xfail

# Open POSIX: compila las pruebas en el host y luego ejecútalas
python3 releasetools/posixsuite.py --destdir obj.amd64/destdir.amd64 \
  --tooldir obj.amd64/tooldir.Linux-x86_64 --out posix.img
python3 releasetools/qemutest.py --iso minix_amd64.iso --smp 2 \
  --suite posix --drive posix.img --xfail releasetools/qemutest-posix.xfail
```

El código de la batería es GPLv2 y está en
[`external/gpl2/open_posix_testsuite`]({{repo}}/blob/{{branch}}/external/gpl2/open_posix_testsuite/README.minix).
Nunca se enlaza con nada de lo que se distribuye, y la compilación de la
release no la construye.
