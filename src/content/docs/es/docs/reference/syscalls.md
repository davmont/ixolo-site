---
title: "Llamadas al sistema"
description: "Qué servidor implementa cada llamada POSIX y qué llamadas al núcleo usan los servidores y drivers."
sidebar:
  order: 2
---

En un UNIX monolítico, una llamada al sistema salta al núcleo y el núcleo
hace el trabajo. En {{name}} casi todas las llamadas POSIX son mensajes. El
envoltorio de la libc rellena un mensaje y lo envía a un servidor en espacio
de usuario: PM para procesos y señales, VFS para ficheros y sockets, VM para
la memoria, y algunos más. El núcleo ofrece un conjunto mucho menor de
*llamadas al núcleo* (kernel calls), que solo pueden usar servidores y
drivers.

Esta página relaciona el primer grupo con sus servidores y enumera el
segundo. Los nombres salen de dos cabeceras de `{{branch}}`:
[`minix/include/minix/callnr.h`]({{repo}}/blob/{{branch}}/minix/include/minix/callnr.h)
(números de llamada de PM y VFS) y
[`minix/include/minix/com.h`]({{repo}}/blob/{{branch}}/minix/include/minix/com.h)
(llamadas al núcleo, VM, IPC y MIB). Para el mecanismo de mensajes en sí,
mira [paso de mensajes](/es/docs/learn/message-passing/).

## Parte 1: llamadas POSIX y sus servidores

| Servidor | Fuente | Se ocupa de |
|---|---|---|
| PM, gestor de procesos | [`minix/servers/pm`]({{repo}}/blob/{{branch}}/minix/servers/pm/table.c) | Procesos, hilos, señales, identidades, relojes y temporizadores, peticiones de planificación |
| VFS, sistema de ficheros virtual | [`minix/servers/vfs`]({{repo}}/blob/{{branch}}/minix/servers/vfs/table.c) | Ficheros, directorios, descriptores, tuberías, dispositivos, montajes, `select`, `kqueue`, sockets |
| VM, memoria virtual | [`minix/servers/vm`]({{repo}}/blob/{{branch}}/minix/servers/vm/main.c) | `brk`, `mmap` y compañía, límites del espacio de direcciones |
| IPC | [`minix/servers/ipc`]({{repo}}/blob/{{branch}}/minix/servers/ipc/main.c) | Memoria compartida y semáforos de System V, colas de mensajes y semáforos POSIX |
| MIB | [`minix/servers/mib`]({{repo}}/blob/{{branch}}/minix/servers/mib/main.c) | `sysctl` |

Una llamada suele implicar a más de un servidor. `fork` va a PM, y PM pide
luego a VM que copie el espacio de direcciones y a VFS que copie la tabla de
descriptores. Un `mmap` de un fichero va a VM, que pide el fichero a VFS.

### PM: procesos, señales y tiempo

| Grupo | Llamadas |
|---|---|
| Procesos | `fork`, `execve`, `_exit`, `wait4`/`waitpid`, `waitid`, `getpid`/`getppid`, `ptrace`, `reboot`, `getrusage` |
| Hilos | `_lwp_create`, `_lwp_exit`, `_lwp_self`, `_lwp_wait`, `_lwp_park`, `_lwp_unpark`, `_lwp_wakeup`, `_lwp_kill`, `_lwp_detach` (las usa libpthread) |
| Identidad | `setuid`/`seteuid`/`setgid`/`setegid`, `setresuid`/`setresgid`, `getresuid`/`getresgid`, `getgroups`/`setgroups`, `issetugid` |
| Sesiones y control de trabajos | `setsid`, `getsid`, `setpgid`, `getpgid`, `getpgrp` |
| Señales | `kill`, `sigaction`, `sigprocmask`, `sigpending`, `sigsuspend`, `sigaltstack`, `sigreturn`, `sigqueue`, `sigtimedwait`/`sigwaitinfo`/`sigwait` |
| Relojes y temporizadores | `clock_gettime`/`clock_settime`/`clock_getres`, `gettimeofday`, `setitimer`/`getitimer` (y `alarm`), `timer_create`/`timer_settime`/`timer_gettime`/`timer_getoverrun`/`timer_delete` |
| Planificación | `getpriority`/`setpriority` (`nice`), `sched_yield`, `sched_setscheduler`/`sched_setparam` y sus versiones `get`, `sched_setaffinity_np`/`sched_getaffinity_np`; protección y herencia de prioridad de mutex para libpthread |
| Contexto de máquina | `getcontext`/`setcontext` |

PM no decide la planificación. Pasa estas peticiones al servidor SCHED, que
fija prioridades y CPU a través del núcleo.

### VFS: ficheros, descriptores y sockets

| Grupo | Llamadas |
|---|---|
| Llamadas con ruta | `openat`, `fstatat`, `mkdirat`, `mknodat`, `unlinkat`, `linkat`, `renameat`, `symlinkat`, `readlinkat`, `fchmodat`, `fchownat`, `faccessat`, `utimensat`. Las clásicas `open`, `stat`, `mkdir`, `unlink`... son estas mismas con `AT_FDCWD`. |
| E/S | `read`, `write`, `pread`, `pwrite`, `lseek`, `ioctl`, `getdents` |
| Descriptores | `close`, `fcntl` (también `dup` y `dup2`), `pipe2`, `umask`, `flock`, bloqueos de registros mediante `fcntl` |
| Estado del fichero | `fstat`, `fchmod`, `fchown`, `truncate`/`ftruncate`, `posix_fallocate`, `fsync` (también `fdatasync`), `sync`, `chflags`/`fchflags`, la familia `extattr_*` (y las ACL construidas sobre ella) |
| Directorios y montajes | `chdir`, `fchdir`, `chroot`, `statvfs1`/`fstatvfs1`, `getvfsstat`; el montaje va por las funciones propias de MINIX `minix_mount`/`minix_umount`, que usan `mount(1)` y `umount(1)` |
| Espera | `select` (y `pselect`), `kqueue1`, `kevent`. La libc construye `poll` sobre `select`, y también `nanosleep`. |
| Sockets | `socket`, `socketpair`, `bind`, `connect`, `listen`, `accept` (y `accept4`/`paccept`), `sendto`, `sendmsg`, `recvfrom`, `recvmsg`, `setsockopt`, `getsockopt`, `getsockname`, `getpeername`, `shutdown` |

VFS pasa las operaciones de fichero al servidor del sistema de ficheros que
lo contiene (MFS, ext2, vfat, tmpfs...) y las de dispositivo al driver. Los
sockets los reenvía a un driver de sockets: `lwip` atiende `PF_INET`,
`PF_INET6`, `PF_ROUTE` y `PF_LINK`; `uds` atiende `PF_UNIX`.

La memoria compartida POSIX (`shm_open`, `shm_unlink`) son ficheros normales
en un tmpfs montado en `/var/shm`, así que pasa por VFS como cualquier
fichero.

### VM: memoria

| Llamada | Notas |
|---|---|
| `brk`/`sbrk` | El heap clásico |
| `mmap`, `munmap` | Proyecciones anónimas y de ficheros. Las proyecciones `MAP_SHARED` de escritura funcionan en MFS y tmpfs; otros sistemas de ficheros devuelven `ENODEV`. |
| `mprotect`, `msync` | Nuevas en {{name}} |
| `getrlimit`/`setrlimit` | VM aplica `RLIMIT_AS` y `RLIMIT_DATA`. Los demás límites los responde la propia libc, con valores fijos. |

`mlock`, `munlock`, `mlockall` y `munlockall` existen en la libc. Comprueban
argumentos y permisos, pero no fijan páginas en memoria.

### Servidor IPC: IPC de System V y POSIX

| Grupo | Llamadas |
|---|---|
| Memoria compartida System V | `shmget`, `shmat`, `shmdt`, `shmctl` |
| Semáforos System V | `semget`, `semctl`, `semop` |
| Colas de mensajes POSIX | `mq_open`, `mq_close`, `mq_unlink`, `mq_send`/`mq_timedsend`, `mq_receive`/`mq_timedreceive`, `mq_getattr`/`mq_setattr`, `mq_notify` |
| Semáforos POSIX | `sem_open`, `sem_close`, `sem_unlink`, y `sem_init` con `pshared` (los semáforos locales al proceso se quedan en libpthread) |
| Objetos pthread compartidos entre procesos | Colas de espera de mutex, variables de condición, rwlocks y barreras `PTHREAD_PROCESS_SHARED` |

Las colas de mensajes de System V (`msgget`, `msgsnd`, `msgrcv`, `msgctl`)
no están implementadas.

### MIB y el resto

- **MIB** responde a `sysctl`. La libc construye otras llamadas encima;
  `uname`, por ejemplo, lee sus campos con `sysctl`.
- **AIO de POSIX** (`aio_read`, `aio_write`, `aio_fsync`, `aio_error`,
  `aio_return`, `aio_cancel`, `aio_suspend`, `lio_listio`) vive en `librt` y
  no tiene servidor propio. Un grupo de hilos atiende cada petición con
  `pread` o `pwrite`.
- **`clock_nanosleep`** está construida en la libc sobre `nanosleep`.

### Novedades desde el fork

MINIX 3 original (último commit, noviembre de 2018) no tiene ninguna de estas
como llamada a un servidor. Se añadieron en el camino hacia {{name}}:

| Área | Llamadas |
|---|---|
| Hilos (amd64) | `_lwp_*` en PM, para que libpthread use hilos reales planificados por el núcleo |
| Llamadas con ruta | La familia `*at`. Se quitaron los números antiguos `VFS_OPEN`, `VFS_STAT`..., lo que rompió la ABI. |
| Ficheros | `pread`/`pwrite`, `flock`, `posix_fallocate`, `chflags`, `extattr_*` |
| Notificación de eventos | `kqueue1`/`kevent` |
| Control de procesos | `waitid`, `setpgid`/`getpgid` con control de trabajos real, `setresuid`/`setresgid` |
| Señales | `sigaltstack`, señales de tiempo real, `sigqueue`, `sigtimedwait` |
| Temporizadores y planificación | `timer_*`, relojes de tiempo de CPU, `sched_*` con `SCHED_FIFO`/`SCHED_RR`, afinidad de CPU |
| Memoria | `mprotect`, `msync`, `RLIMIT_AS`/`RLIMIT_DATA` |
| IPC | Colas de mensajes POSIX, semáforos con nombre y compartidos entre procesos, objetos pthread compartidos |
| Biblioteca | AIO de POSIX en una `librt` nueva |

VFS también tiene una llamada `swapctl` para el swap en disco, pero la libc
aún no tiene el envoltorio `swapctl()` y no existe la herramienta `swapon`.

## Parte 2: llamadas al núcleo

Los servidores y drivers hablan con el núcleo a través de la tarea SYSTEM,
con llamadas al núcleo. Sus números empiezan en `KERNEL_CALL` (`0x600`) en
`com.h`. Los drivers las usan mediante los envoltorios `sys_*` de
[`minix/lib/libsys`]({{repo}}/blob/{{branch}}/minix/lib/libsys). El núcleo
las despacha en
[`minix/kernel/system.c`]({{repo}}/blob/{{branch}}/minix/kernel/system.c),
con un manejador por fichero en
[`minix/kernel/system/`]({{repo}}/blob/{{branch}}/minix/kernel/system).

Cada proceso solo puede usar las llamadas que permite su estructura de
privilegios. Para un servicio, esa lista sale de su entrada en
`/etc/system.conf` (mira `system.conf(5)`). Todo proceso de sistema recibe
un conjunto básico: `SYS_EXIT`, `SYS_SAFECOPYFROM`, `SYS_SAFECOPYTO`,
`SYS_VSAFECOPY`, `SYS_GETINFO`, `SYS_TIMES`, `SYS_SETALARM`, `SYS_SETGRANT`,
`SYS_DIAGCTL`, `SYS_STATECTL` y `SYS_SAFEMEMSET`.

| Grupo | Llamadas al núcleo | Quién las usa |
|---|---|---|
| Gestión de procesos | `SYS_FORK`, `SYS_EXEC`, `SYS_CLEAR`, `SYS_EXIT`, `SYS_PRIVCTL`, `SYS_TRACE`, `SYS_RUNCTL`, `SYS_GETMCONTEXT`, `SYS_SETMCONTEXT`, `SYS_UPDATE`, `SYS_STATECTL` | PM, RS (privilegios, actualización en caliente) |
| Señales | `SYS_KILL`, `SYS_GETKSIG`, `SYS_ENDKSIG`, `SYS_SIGSEND`, `SYS_SIGRETURN` | PM, y los servidores que generan señales |
| Copia entre espacios de direcciones | `SYS_SAFECOPYFROM`, `SYS_SAFECOPYTO`, `SYS_VSAFECOPY`, `SYS_SETGRANT`, `SYS_SAFEMEMSET` | Todos los servidores y drivers |
| Memoria (privilegiadas) | `SYS_VIRCOPY`, `SYS_PHYSCOPY`, `SYS_MEMSET`, `SYS_UMAP`, `SYS_UMAP_REMOTE`, `SYS_VUMAP`, `SYS_VMCTL` | VM; los drivers usan `SYS_VUMAP` para DMA |
| E/S e interrupciones | `SYS_IRQCTL`, `SYS_DEVIO`, `SYS_VDEVIO`, `SYS_SDEVIO`, `SYS_IOPENABLE`, `SYS_READBIOS` | Drivers de dispositivo |
| Tiempo | `SYS_TIMES`, `SYS_SETALARM`, `SYS_STIME`, `SYS_SETTIME`, `SYS_VTIMER` | PM, drivers |
| Planificación | `SYS_SCHEDULE`, `SYS_SCHEDCTL` | SCHED |
| Información y depuración | `SYS_GETINFO`, `SYS_DIAGCTL`, `SYS_SPROF`, `SYS_ABORT` | Muchos; `SYS_ABORT` apaga el sistema |
| Solo ARM | `SYS_PADCONF` | No se usa en amd64 |

**Las copias seguras son la norma.** Un proceso no puede nombrar
directamente la memoria de otro. Crea un *grant* en su propia tabla de
grants, y el otro lado copia a través de él con `SYS_SAFECOPYFROM` o
`SYS_SAFECOPYTO`. Las llamadas sin esa protección, `SYS_VIRCOPY` y
`SYS_PHYSCOPY`, son para VM y unos pocos servicios privilegiados.

**Llamadas solo de x86.** `SYS_DEVIO`, `SYS_VDEVIO`, `SYS_SDEVIO`,
`SYS_IOPENABLE` y `SYS_READBIOS` existen solo en i386 y amd64, porque
trabajan con los puertos de E/S de x86 y la zona de la BIOS. En amd64 sus
manejadores están en
[`minix/kernel/arch/x86_64/`]({{repo}}/blob/{{branch}}/minix/kernel/arch/x86_64).

### Qué cambió con amd64 y SMP

El conjunto de llamadas al núcleo es el mismo que en MINIX 3 original: el
fork no añadió ningún número `SYS_*` nuevo. En su lugar, amplió algunas:

- `SYS_IRQCTL` tiene una petición nueva, `IRQ_SETPOLICY_MSI`, que reserva un
  vector MSI o MSI-X. El driver NVMe usa MSI-X.
- `SYS_GETINFO` tiene una petición nueva, `GET_IPCTRAFFIC`, que lee y pone a
  cero un histograma por proceso de las CPU de las que le llegan mensajes.
  SCHED lo usa para colocar en la misma CPU los servidores que más hablan
  entre sí.
- `SYS_VMCTL` lleva raíces de tablas de páginas y direcciones de 64 bits,
  para las tablas de páginas de 4 niveles y el espacio de usuario de 47 bits.
- En SMP, `SYS_SCHEDULE` recibe la CPU en la que debe ejecutarse un proceso:
  así aplica SCHED la afinidad de CPU. `SYS_GETINFO` con `GET_CPUINFO` y
  `GET_CPUTICKS` informa de datos por CPU. No hay ninguna llamada al núcleo
  exclusiva de SMP.

Las [notas de diseño de SMP](/es/docs/design/smp/) describen el lado del
núcleo.

:::note[Una referencia más antigua]
La wiki original tiene una página de la API del núcleo,
<https://wiki.minix3.org/doku.php?id=developersguide:kernelapi>. Describe
MINIX 3 tal como era en la década de 2010: sirve de contexto, pero comprueba
nombres y campos con `com.h` en `{{branch}}`.
:::
