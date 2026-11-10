---
title: "Páginas de manual"
description: "Las páginas de manual que incluye {{name}}, qué contiene cada sección y las páginas propias del sistema."
sidebar:
  order: 1
---

{{name}} trae sus páginas de manual en el propio sistema: escribe `man` en la
shell. Esta web todavía no tiene una copia en HTML. Esta página explica qué
hay instalado, dónde están las páginas que importan en {{name}} y dónde mirar
cuando falta una.

## Leer las páginas en el sistema

Las páginas vienen en el conjunto de instalación `minix-man` y se instalan en
`/usr/man`. La ISO incluye ese conjunto desde junio de 2026
([PR #165]({{repo}}/pull/165)); antes, `man` no encontraba nada en el live
CD. `setup` extrae todos los conjuntos del CD, así que un sistema instalado
también tiene las páginas (aplicando la solución a su
[fallo de rutas en amd64](/es/docs/start/install/)).

```sh
man ls                 # una página, de la primera sección que la tenga
man 8 minix-service    # una página de una sección concreta
man -k filesystem      # busca en nombres y descripciones (igual que apropos)
whatis tmpfs           # descripción de una línea
```

`man -k`, `apropos` y `whatis` leen la base de datos `/usr/man/whatis.db`,
que genera la compilación. Si añades páginas a mano, regenérala con
`makewhatis /usr/man`. El formateo lo hace `mandoc`; las reglas están en
[`/etc/man.conf`]({{repo}}/blob/{{branch}}/etc/man.conf).

## Las secciones

| Sección | Contiene | Páginas en `minix-man` |
|---|---|---|
| 1 | Órdenes de usuario: `ls`, `sh`, `ssh`, `free` | unas 410 |
| 2 | Llamadas al sistema | 86 |
| 3 | Funciones de biblioteca: libc, curses, OpenSSL | unas 3300 |
| 4 | Dispositivos y drivers | 18 |
| 5 | Formatos de fichero: `fstab`, `rc.conf`, `system.conf`, `boot.cfg` | 66 |
| 6 | Juegos | 25 |
| 7 | Miscelánea: `hier`, `man`, `pkgsrc` | 31 |
| 8 | Administración del sistema: `setup`, `minix-service`, `ifconfig` | unas 160 |
| 9 | Interfaces del núcleo | 6 |

Las cifras salen de la lista del conjunto,
[`distrib/sets/lists/minix-man/mi`]({{repo}}/blob/{{branch}}/distrib/sets/lists/minix-man/mi),
en `{{branch}}`. Casi toda la sección 3 es la API de OpenSSL.

:::caution[Las secciones 2 y 3 tienen huecos]
La sección 2 contiene sobre todo las páginas antiguas de MINIX (`open`,
`read`, `fork`, `select`, `svrctl`...). Muchas páginas de NetBSD de llamadas
que {{name}} sí implementa no se instalan: no hay `kqueue(2)`, `mmap(2)`,
`poll(2)` ni `stat(2)`, ni páginas de `pthread_create(3)`, `sem_open(3)`,
`mq_open(3)` o `aio_read(3)`. Para esas, usa las páginas de NetBSD en línea
(más abajo) y la [referencia de llamadas al sistema](/es/docs/reference/syscalls/).
:::

## Páginas propias de {{name}}

La mayoría de órdenes y bibliotecas vienen de NetBSD y conservan sus páginas.
Las de abajo describen partes propias de MINIX o nuevas en {{name}}. Cada una
enlaza a su fuente en el árbol.

### Servicios y arranque

| Página | Qué cubre |
|---|---|
| [`minix-service(8)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/minix-service.8) | Arrancar, parar, reiniciar, refrescar y actualizar servicios del sistema (servidores y drivers) a través del servidor de reencarnación (RS). |
| [`system.conf(5)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/system.conf.5) | `/etc/system.conf`: qué puede hacer cada servicio (destinos IPC, llamadas al núcleo, puertos de E/S, IRQ). |
| [`service(8)`]({{repo}}/blob/{{branch}}/usr.sbin/service/service.8) | Otra cosa: la herramienta de NetBSD para ejecutar los scripts de `/etc/rc.d`. |
| [`boot.cfg(5)`]({{repo}}/blob/{{branch}}/minix/man/man5/boot.cfg.5) | El fichero del menú de arranque que lee el cargador BIOS. |
| [`update_bootcfg(8)`]({{repo}}/blob/{{branch}}/minix/commands/update_bootcfg/update_bootcfg.8) | Regenera la configuración del menú de arranque. |
| [`sysenv(1)`]({{repo}}/blob/{{branch}}/minix/commands/sysenv/sysenv.1) | Lee los parámetros con los que arrancó el núcleo. |
| [`svrctl(1)`]({{repo}}/blob/{{branch}}/minix/commands/svrctl/svrctl.1), [`svrctl(2)`]({{repo}}/blob/{{branch}}/minix/man/man2/svrctl.2) | Llamadas de control especiales a PM y VFS. |

La [guía de servicios](/es/docs/admin/services/) las muestra en uso.

### Instalación, discos y sistemas de ficheros

| Página | Qué cubre |
|---|---|
| [`setup(8)`]({{repo}}/blob/{{branch}}/minix/commands/setup/setup.8) | El instalador. La página es antigua: aún habla de Pentium, 16 MB de RAM y discos solo IDE. La [guía de instalación](/es/docs/start/install/) está al día. |
| [`mkfs.mfs(1)`]({{repo}}/blob/{{branch}}/minix/usr.sbin/mkfs.mfs/v3/mkfs.mfs.1) | Crea un sistema de ficheros MFS. Por defecto, MFS versión 4 con journal; `-3` crea la versión 3 antigua. |
| [`fsck.mfs(1)`]({{repo}}/blob/{{branch}}/minix/commands/fsck.mfs/fsck.mfs.1) | Comprueba y repara MFS. |
| [`tmpfs(8)`]({{repo}}/blob/{{branch}}/minix/fs/tmpfs/tmpfs.8) | El sistema de ficheros en memoria: `mount -t tmpfs`, las opciones `size=` y `nr_inodes=`, y su uso para la memoria compartida POSIX en `/var/shm`. Nuevo en {{name}}. |
| [`part(8)`]({{repo}}/blob/{{branch}}/minix/commands/part/part.8), [`autopart(8)`]({{repo}}/blob/{{branch}}/minix/commands/autopart/autopart.8) | Los editores de particiones que usa `setup`. |
| [`btrace(8)`]({{repo}}/blob/{{branch}}/minix/usr.sbin/btrace/btrace.8) | Traza de E/S a nivel de bloque. |
| [`fbdctl(8)`]({{repo}}/blob/{{branch}}/minix/usr.sbin/fbdctl/fbdctl.8) | Reglas del *faulty block device*, un driver que inyecta errores de disco para pruebas. |

Mira también la [guía de sistemas de ficheros](/es/docs/admin/filesystems/).

### Red y seguridad

| Página | Qué cubre |
|---|---|
| [`netconf(8)`]({{repo}}/blob/{{branch}}/minix/commands/netconf/netconf.8) | Configura la red de forma interactiva; escribe `/etc/ifconfig.<if>`. |
| [`unix(8)`]({{repo}}/blob/{{branch}}/minix/net/uds/unix.8) | El servicio de sockets de dominio UNIX (UDS). |
| [`certctl(8)`]({{repo}}/blob/{{branch}}/usr.sbin/certctl/certctl.8) | Gestiona los certificados raíz de TLS en `/etc/openssl/certs`. Importado de NetBSD-current. |

### Inspeccionar el sistema

| Página | Qué cubre |
|---|---|
| [`free(1)`]({{repo}}/blob/{{branch}}/minix/usr.bin/free/free.1) | Memoria física libre y usada. Nuevo en {{name}}. |
| [`lspci(1)`]({{repo}}/blob/{{branch}}/minix/commands/lspci/lspci.1) | Lista los dispositivos PCI. |
| [`trace(1)`]({{repo}}/blob/{{branch}}/minix/usr.bin/trace/trace.1) | Muestra las llamadas al sistema y señales de un proceso. Usa `ptrace(2)`, que aún tiene fallos conocidos en amd64 (test 42). |
| [`hier(7)`]({{repo}}/blob/{{branch}}/minix/man/man7/hier.7) | La estructura del sistema de ficheros. |

## Las páginas de NetBSD como referencia

Casi todo el espacio de usuario y la libc vienen de NetBSD, en versiones
distintas: unas partes se resincronizaron con NetBSD 10, otras vienen de
NetBSD-current y algunas son más antiguas. Cuando aquí falta una página, el
manual en línea de NetBSD es la siguiente mejor fuente:

- <https://man.netbsd.org/> (por ejemplo,
  <https://man.netbsd.org/kqueue.2>)

Tómalas como guía, no como contrato. El núcleo, los servidores y buena parte
de la capa de llamadas al sistema son propios de MINIX, así que el
comportamiento puede variar. Dos ejemplos: aquí `kqueue(2)` admite los
filtros de lectura, escritura, vnode, temporizador y usuario, pero no los de
señales, procesos y AIO; y `mlock(2)` comprueba sus argumentos pero no fija
páginas en memoria. Ante la duda, la
[referencia de llamadas al sistema](/es/docs/reference/syscalls/) y la
[página de POSIX](/es/docs/reference/posix/) dicen lo que hace {{name}}, y el
código fuente tiene la última palabra.

:::note[Aún no hay versión web]
Esta web todavía no tiene una copia navegable en HTML de estas páginas,
generada desde el árbol. Mientras tanto, léelas con `man` en el sistema o
abre los ficheros fuente enlazados arriba.
:::
