---
title: "La shell y el software"
description: "El uso diario: la shell y el control de trabajos, el userland de NetBSD, qué trae el sistema base y en qué punto están los paquetes."
sidebar:
  order: 3
---

{{name}} se siente como un sistema BSD pequeño. La shell, las órdenes y la
mayoría de las bibliotecas vienen de NetBSD; el núcleo, los servidores y los
drivers que hay debajo son de MINIX. Esta página cuenta qué tienes al entrar
y qué puedes instalar hoy y qué no.

## La shell

`/bin/sh` es el `sh` de NetBSD (una shell Almquist). Es la shell de login de
`root` y la de por defecto para usuarios nuevos.

Tiene **control de trabajos** desde el PR #404, cuando el núcleo y el gestor
de procesos incorporaron sesiones, grupos de procesos y grupo en primer plano
del terminal. Las shells interactivas ponen cada tubería en su propio grupo
de procesos, así que las teclas y órdenes habituales funcionan:

```sh
sleep 100          # pulsa Ctrl-Z
jobs               # [1] + Stopped  sleep 100
bg %1              # que siga en segundo plano
fg                 # tráelo de vuelta; Ctrl-C lo termina
```

Hay dos shells más en el sistema base, listadas en `/etc/shells`:

| Shell | Ruta | Notas |
|---|---|---|
| sh | `/bin/sh` | Por defecto. Shell POSIX con control de trabajos y edición de la línea de órdenes (`set -o emacs` o `set -o vi`). |
| ksh | `/bin/ksh` | La Korn shell de dominio público de NetBSD. |
| csh | `/bin/csh` | La C shell de BSD. |

Cambia la shell de un usuario con `chsh` (o `usermod -s /bin/ksh alicia`).
No hay bash ni zsh en el sistema base.

## El userland

Las órdenes son las de NetBSD. La mayoría llegaron con la resincronización
de MINIX upstream con NetBSD en 2015; varias se han actualizado después desde
NetBSD 10 o NetBSD-current. Las páginas de manual de NetBSD las describen con
bastante fidelidad. Las páginas de manual van en la ISO y en el sistema
instalado: `man ls`, `apropos socket`.

Unas pocas cosas son propias de MINIX y no tienen equivalente en NetBSD:

| Orden | Qué hace |
|---|---|
| `minix-service` | Arranca, para, reinicia y actualiza servicios del sistema (servidores y drivers) a través de RS. Ver [Servicios](/es/docs/admin/services/). |
| `setup`, `netconf` | El instalador y la herramienta de configuración de red. |
| `mined` | Un pequeño editor a pantalla completa del MINIX clásico. |
| `free` | Memoria física total, usada y libre, y la caché de buffers. |

`service` (sin `minix-`) es el de NetBSD y ejecuta los scripts rc.d:
`service sshd start`.

## Qué trae el sistema base

Todo lo siguiente se compila desde el árbol de código y se instala con el
sistema (el conjunto `minix-base`). Las versiones salen de
[`docs/THIRD_PARTY.md`]({{repo}}/blob/{{branch}}/docs/THIRD_PARTY.md) y del
código incluido.

| Área | Software |
|---|---|
| Editores y terminal | `vi` (nvi), `ed`, `mined`, `less` 668, `tmux` 3.6a |
| Red | OpenSSH {{openssh}}, dhcpcd 10.3.1, herramientas de BIND 9.20.24 (`dig`, `host`, `nslookup`; `named` desactivado por defecto), `ftp` (con HTTPS), `telnet`, `tcpdump` 4.99.6 |
| Seguridad | OpenSSL 3.5.7 LTS, certificados de CA de Mozilla con `certctl`, Heimdal 7.8 (Kerberos) |
| Datos y scripting | `sqlite3` 3.53.3, Lua 5.4.8, `awk`, `sed`, `make` (BSD make) |
| Archivado | `tar`, `pax`, `cpio`, `gzip`, `bzip2` 1.0.8, `xz` 5.8.3, `unzip`, libarchive 3.8.8 |
| Bibliotecas | zlib 1.3.1, expat 2.8.2, libevent 2.1.13, `libpthread`; libuv 1.52.1 como biblioteca estática en `minix-comp` |
| Hora | tz 2026a |

No están en el sistema base: Perl, Python, git, curl, un depurador (ni gdb
ni lldb) ni X11 (eliminado del árbol).

### El compilador

La cadena de herramientas es LLVM/clang {{llvm}} con `ld.lld`; GCC y GNU
binutils ya no están. Que tengas compilador dentro del sistema depende de
cómo lo instalaras:

- La **ISO**, y un sistema instalado desde ella con `setup`, **no tienen
  compilador**: la ISO lleva los conjuntos `minix-base`, `minix-man` y
  `minix-tests`, no `minix-comp`.
- Una **imagen de disco** construida desde el código con
  `releasetools/amd64_hdimage.sh` incluye `minix-comp`: cabeceras,
  bibliotecas y, si la compilación no usó `-V MKLLVMCMDS=no`, el
  `clang`/`cc` nativo. Compilar ese compilador nativo añade horas al build;
  por eso la CI se lo salta.

## Paquetes

MINIX 3 upstream distribuía paquetes binarios construidos desde su fork de
pkgsrc, que se instalaban con `pkgin`. **{{name}} aún no tiene repositorio de
paquetes para amd64.** Los paquetes de upstream son para i386 y una ABI
antigua; aquí no funcionan.

Lo que hay hoy:

- `pkg_add`, `pkg_info`, `pkg_delete` y `pkg_create` (el `pkg_install` de
  NetBSD) están en el sistema base. Instalan, listan y quitan ficheros de
  paquete binario que ya tengas, pero no hay repositorio del que bajarlos.
- `pkgin` no está en el sistema base. Los scripts auxiliares `pkgin_cd`,
  `pkgin_all` y `pkgin_sets` vienen de upstream y esperan una colección de
  paquetes que no existe para amd64.
- `/usr/Makefile` sigue apuntando al repositorio pkgsrc de upstream en
  `git.minix3.org`. Es de upstream y no sirve para {{name}}.

Así que, para tener software que no está en el sistema base:

1. **Añádelo al árbol de código** y compílalo con el sistema, como todo lo
   del sistema base (Makefiles reachover al estilo de NetBSD). Ver
   [Compilar desde el código](/es/docs/develop/building/) y
   [Contribuir](/es/docs/develop/contributing/).
2. **Compílalo dentro del sistema** con el clang nativo, en una imagen que lo
   tenga (ver arriba). Los mejores candidatos son programas sencillos con un
   `Makefile` normal o un script `configure`; lo que necesite interfaces de
   Linux habrá que portarlo.

Un port de pkgsrc para amd64, con repositorio binario, está en la hoja de
ruta. Todavía no existe y no tiene fecha.

## Para saber más

- Páginas de manual de NetBSD: <https://man.netbsd.org/>
- Guía de paquetes de MINIX 3 upstream (solo i386 y versiones antiguas):
  <https://wiki.minix3.org/doku.php?id=usersguide:installingbinarypackages>
