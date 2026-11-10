---
title: "Contribuir y estilo de código"
description: "Cómo enviar un cambio a {{name}}: ramas, pull requests, mensajes de commit, estilo de código, reglas de ABI, licencias y código de terceros."
sidebar:
  order: 4
---

{{name}} se desarrolla en abierto en [{{repo}}]({{repo}}). Los cambios llegan
como pull requests contra `{{branch}}` y la CI prueba cada uno antes de
fusionarlo. Esta página describe cómo funciona el proyecto hoy, tal como se ve
en su historial, para que tu cambio encaje.

## Antes de empezar

Habla primero de cualquier cosa grande: un subsistema nuevo, un cambio de ABI,
un paquete de terceros nuevo, un cambio de política. Usa {{issues}}. Una
descripción breve del problema y del plan te ahorra escribir código en una
dirección que el proyecto no va a tomar.

Para arreglos pequeños, envía directamente el pull request.

## Fork, rama, pull request

1. Haz un fork del repositorio en GitHub y clónalo.
2. Crea una rama a partir de `{{branch}}`. En el historial, los nombres de rama
   siguen el tipo de cambio: `fix/vfs-sticky-mountpoint`, `feat/tmpfs`,
   `test/aio-error-flaky`.
3. Compila y prueba en local ([Compilar desde el código](/es/docs/develop/building/),
   [Pruebas e integración continua](/es/docs/develop/testing/)). Como mínimo la
   batería `quick`; `pjdfstest` si has tocado un sistema de ficheros o VFS; la
   Open POSIX Test Suite si has tocado libc, PM, VFS, VM, señales o hilos (no
   está en la CI).
4. Abre el pull request **contra `{{branch}}`**. GitHub puede proponerte
   `master` como base: cámbiala.
5. La CI tiene que pasar: la compilación y los ocho trabajos de prueba, con 1
   y 2 CPU. Una prueba que empieza a pasar (XPASS) también hace fallar la
   ejecución, así que quítala de la lista de fallos conocidos en el mismo pull
   request.

Un pull request hace una sola cosa. Un arreglo encontrado por el camino va en
su propio commit, o en su propio pull request si no tiene relación.

### Añade una prueba

Un arreglo trae una prueba que falla antes y pasa después, siempre que se
pueda. Las pruebas del árbol están en
[`minix/tests/`]({{repo}}/blob/{{branch}}/minix/tests/) como `testNNN.c`. Una
nueva se conecta en cuatro sitios, como se hizo con `test168`:

- `minix/tests/Makefile` (compilarla),
- `minix/tests/run` (ejecutarla),
- `distrib/sets/lists/minix-tests/mi` (distribuirla),
- `QUICK_TESTS` en `releasetools/qemutest.py`, si es rápida y no necesita red
  (para que la ejecute la CI).

## Mensajes de commit

El historial tiene un estilo coherente. Lee unos cuantos commits con `git log`
antes de escribir el tuyo. Los mensajes se escriben en inglés.

**Línea de asunto**: los subsistemas que toca, dos puntos y lo que ahora es
cierto o lo que estaba mal, en palabras llanas. Sin punto final.

```
vm: MAP_SHARED anonymous memory is shared across fork
pm, libc: _lwp_detach(2), so that pthread_detach(3) detaches
vfs: rmdir(2) or rename(2) of a mount point under a sticky root panicked
kernel/amd64: boot with RAM above 4 GB (nested pagefault in kmain)
qemutest-posix.xfail: aio_error/2-1 is flaky
```

El prefijo es el directorio o el componente (`kernel`, `kernel/amd64`, `vm`,
`pm`, `vfs`, `libc`, `libpthread`, `mfs`, `releasetools`, `build`...), varios
separados por comas cuando el cambio cruza de uno a otro.

**Cuerpo**, con líneas de unas 72 columnas:

- **Qué estaba roto**, tal como lo veía el usuario o el programa.
- **Por qué**: la causa, con detalle suficiente para que quien revise pueda
  contrastar el arreglo con ella.
- **Qué cambia**, incluido lo que se arregló de paso.
- **ABI**, en un párrafo aparte, si cambian formatos de mensaje o números de
  llamada.
- **Cómo se validó**: qué baterías, con cuántas CPU, con qué resultado y qué
  prueba nueva lo cubre. Por ejemplo:

```
New test166 covers these.

Validated:
- Quick suite: 139 passed, 0 failed except test166 on smp1 and smp2.
- POSIX smp2: 1614 passed.  The only failures were the 12 XPASSes now
  removed from the xfail list.
```

Escribe para alguien que lea el registro dentro de dos años. "Fix bug" o
"update" no le dicen nada.

## Estilo de código

No hay una guía de estilo aparte en el árbol. Las reglas son:

- **Sigue el estilo del fichero que editas.** El código de NetBSD usa la KNF
  (Kernel Normal Form) de NetBSD: tabuladores, el nombre de la función al
  principio de la línea, un bloque de comentario antes de cada función. Los
  servidores y drivers de MINIX tienen su propia disposición, más antigua. No
  reformatees código que no cambias: esconde el diff real.
- Para un fichero nuevo, la KNF que describe la guía
  [`style`](https://github.com/NetBSD/src/blob/trunk/share/misc/style) de
  NetBSD es una opción segura.
- Prefiere `strlcpy`/`strlcat` a `strcpy`/`strcat`, y `snprintf` a `sprintf`.
- En un arreglo de seguridad, cita el CWE correspondiente en el mensaje de
  commit.
- Conserva los guardas `__minix` en el código importado de fuera: marcan lo que
  hubo que cambiar para {{name}}.

## Reglas de ABI

Servidores, drivers y libc se comunican con mensajes de tamaño fijo, definidos
en
[`minix/include/minix/ipc.h`]({{repo}}/blob/{{branch}}/minix/include/minix/ipc.h).
Tras cada tipo de mensaje hay una aserción que comprueba su tamaño al
compilar:

```c
_ASSERT_MSG_SIZE(mess_lc_vfs_pathat);
```

En amd64 la carga útil puede ocupar como máximo 96 bytes. (En i386 tenía que
ocupar exactamente 56, y por eso i386 ya no compila.) Si tu campo nuevo no
cabe, la compilación falla: para eso está.

Cuando cambias el formato de un mensaje o un número de llamada:

- **Hay que recompilar todos los programas.** También los programas del
  escritorio enlazados estáticamente, que se vuelven a enlazar con
  `releasetools/devtools/relink_desktop.sh`.
- **Nunca reutilices un número de llamada.** Cuando las llamadas `*at()`
  sustituyeron a las antiguas llamadas con ruta, los números viejos quedaron
  vacíos, de modo que un binario compilado antes del cambio recibe `ENOSYS` en
  vez de malinterpretar un mensaje.
- **Las direcciones van en campos de 64 bits.** El espacio de usuario llega
  ahora a 128 TB; una dirección de usuario en un campo `int` se rompe por
  encima de 2 GB.
- **Dilo en el mensaje de commit**, en un párrafo "ABI." que enumere los
  mensajes y las llamadas que cambian y los programas revisados.

## Licencias

- El sistema base está bajo la licencia de MINIX, de estilo BSD
  ([`LICENSE`]({{repo}}/blob/{{branch}}/LICENSE)), y el código de NetBSD bajo
  sus licencias BSD. El código nuevo que escribas para el sistema base debería
  ir con las mismas condiciones.
- El código de terceros está bajo `external/`, agrupado por licencia
  (`external/bsd`, `external/mit`, `external/apache2`, `external/mpl`,
  `external/lgpl2`, ...), así que la licencia de cada fichero se deduce de su
  ruta.
- **El código GPL se mantiene al mínimo.** Hoy hay tres casos. El driver de
  red `igc`
  ([`minix/drivers/net/igc`]({{repo}}/blob/{{branch}}/minix/drivers/net/igc/)),
  basado en el de Linux, es GPL-2.0 y se compila y distribuye en el sistema
  base (`/service/igc`). La Open POSIX Test Suite, en `external/gpl2/open_posix_testsuite`,
  solo se usa para probar y la compilación de la release nunca la construye.
  GNU texinfo 4.8 no está en el repositorio: la compilación lo descarga
  (`gnu/dist/fetch.sh`) y distribuye `info`, `makeinfo` e `install-info` en el
  conjunto `minix-comp`. `external/gpl3` no contiene código. Algún código
  importado ofrece la GPL como una de dos licencias (ACPICA, en el driver de
  ACPI, por ejemplo). Si un cambio parece necesitar más código GPL, plantéalo
  antes.
- Los proyectos externos del escritorio (Qt, LXQt, GLib y otros) se descargan
  y compilan fuera del árbol, con sus propias licencias, y no están en la
  imagen por defecto.

## Software de terceros

El código externo se incorpora al estilo de NetBSD: las fuentes originales en
`<paquete>/dist/`, con makefiles BSD al lado. No hay árbol de ports.
[`docs/THIRD_PARTY.md`]({{repo}}/blob/{{branch}}/docs/THIRD_PARTY.md) tiene el
inventario y el procedimiento de actualización. En resumen, paquete a paquete y
con un commit para cada uno:

1. Descarga la versión original y comprueba su suma de comprobación publicada.
2. Averigua si `dist/` está intacto o parcheado para NetBSD o para {{name}}.
3. Sustituye entero un `dist/` intacto. Fusiona a tres bandas uno parcheado,
   tomando como base la versión antigua intacta. No elimines nunca un guarda
   `__minix` sin comprobar que la versión nueva lo hace innecesario.
4. Ajusta las listas `SRCS` y las cabeceras de configuración a la nueva
   estructura.
5. Sube la versión menor de la biblioteca compartida cuando la versión nueva
   añade API públicas.
6. Compila el paquete, después una release completa, y prueba el resultado
   dentro del sistema.

## Documentación

- **Este sitio** es un repositorio aparte,
  [davmont/ixolo-site](https://github.com/davmont/ixolo-site). Las correcciones
  de estas páginas van allí.
- **Los documentos de diseño están en el repositorio del sistema**, junto al
  código que describen (por ejemplo `minix/fs/mfs/JOURNAL_DESIGN.md` o
  `docs/UEFI_BOOT.md`), y un script los copia a la
  [sección de diseño](/es/docs/design/smp/) de este sitio. Cámbialos en el
  repositorio del sistema, en el mismo pull request que el código, y nunca en
  el sitio: la copia se sobrescribe.
- **Las páginas de manual** están junto a sus programas en el árbol del
  sistema.

## Para saber más

- Guías de estilo de código y de mensajes de commit de MINIX 3 (escritas para
  MINIX 3.3/3.4; la práctica descrita arriba tiene prioridad):
  <https://wiki.minix3.org/doku.php?id=developersguide:codingstyle>,
  <https://wiki.minix3.org/doku.php?id=developersguide:commitmessages>
