---
title: "Notas de la versión"
description: "Qué añade {{name}} a MINIX 3, desde el fork hasta la primera versión."
sidebar:
  order: 4
---

## Sin publicar — {{name}} {{version}}

:::note
{{name}} aún no ha publicado ninguna versión. Estas notas describen la rama
`{{branch}}` en noviembre de 2026 (hasta el [PR #488]({{repo}}/pull/488)) y
serán las notas de la primera versión. Fecha de publicación: {{date}}.
:::

### Resumen

{{name}} es un fork de MINIX 3 que funciona en x86 de 64 bits. El último
código de MINIX original es de 2018 y funcionaba en x86 de 32 bits y en ARM.
El fork portó el núcleo a amd64 y después añadió soporte multiprocesador, un
sistema de memoria virtual renovado, sistemas de ficheros nuevos y
ampliados, almacenamiento NVMe y USB, una pila de red más reciente, buena
parte de las interfaces POSIX de tiempo real y de hilos, endurecimiento de
seguridad y una toolchain actual (LLVM/clang {{llvm}}). El diseño de
microkernel no cambia: drivers y servidores siguen siendo procesos de
usuario aislados, y un driver que falla se sigue reiniciando.

Lo marcado como *experimental* funciona, pero es opcional, está incompleto o
no lo cubren las pruebas automáticas.

### Plataforma y arranque

- El núcleo amd64 arranca hasta el login (mayo de 2026, en `master`).
- Una sola ISO híbrida arranca con firmware BIOS y UEFI. En UEFI usa GRUB,
  Multiboot2 y el framebuffer GOP como consola de texto. Mira el
  [diseño del arranque UEFI](/es/docs/design/uefi-boot/). Se arregló la
  generación de la imagen para GRUB 2.16, que había dejado la ISO, sin
  avisar, como solo BIOS ([#483]({{repo}}/pull/483)).
- AHCI o IDE se detectan al arrancar. El cargador BIOS lee MFS versión 4
  ([#280]({{repo}}/pull/280)). Las imágenes de disco duro arrancan con el
  APIC por defecto ([#286]({{repo}}/pull/286)).
- Interrupciones MSI-X ([#186]({{repo}}/pull/186)), entropía de RDRAND al
  arrancar ([#240]({{repo}}/pull/240)), calibración robusta del temporizador
  ([#362]({{repo}}/pull/362), [#363]({{repo}}/pull/363)), reloj de tiempo
  real con UEFI ([#354]({{repo}}/pull/354)) y arranque con más de 4 GB de
  RAM ([#484]({{repo}}/pull/484)).
- La CPU debe tener `FSGSBASE`. NX, SMEP, SMAP y PCID se usan si están.

### Multiprocesador (SMP)

- Las CPU secundarias arrancan con sus propias tablas de descriptores, bajo
  un gran cerrojo del núcleo ([#157]({{repo}}/pull/157)). Hasta {{maxCpus}}
  CPU en tiempo de compilación; probado con 1, 2, 4 y 8.
- Un camino rápido para mensajes de petición y respuesta, y colocación en la
  misma CPU de los servidores que más hablan entre sí
  ([#157]({{repo}}/pull/157)).
- Muchas correcciones de SMP: temporizadores y gestión de fallos de página
  por CPU, cerrojo de la cola de ejecución
  ([#283]({{repo}}/pull/283), [#287]({{repo}}/pull/287)–[#289]({{repo}}/pull/289)),
  expropiación de hilos que consumen CPU ([#379]({{repo}}/pull/379)),
  invalidación de TLB en procesos multihilo ([#409]({{repo}}/pull/409)).
- Afinidad de CPU ([#473]({{repo}}/pull/473)) y planificación de tiempo
  real, `SCHED_FIFO` y `SCHED_RR` ([#464]({{repo}}/pull/464)).
- Notas de diseño: [SMP](/es/docs/design/smp/).

### Memoria

- Espacio de usuario de 47 bits: los programas pueden usar hasta 128 TB de
  memoria virtual ([#449]({{repo}}/pull/449), [#450]({{repo}}/pull/450),
  [#452]({{repo}}/pull/452)).
- Recuperación de páginas limpias
  ([#290]({{repo}}/pull/290)–[#293]({{repo}}/pull/293)) y memoria anónima
  comprimida con LZ4 ([#294]({{repo}}/pull/294)–[#298]({{repo}}/pull/298)).
  Mira el [diseño de la recuperación](/es/docs/design/reclaim/).
- Matador de procesos por falta de memoria (OOM) y `RLIMIT_AS`/`RLIMIT_DATA`
  ([#311]({{repo}}/pull/311), [#320]({{repo}}/pull/320)).
- `mprotect`, NX para proyecciones no ejecutables
  ([#365]({{repo}}/pull/365)–[#367]({{repo}}/pull/367)), proyecciones
  compartidas de escritura de ficheros y `msync` ([#410]({{repo}}/pull/410)),
  memoria anónima compartida tras `fork` ([#487]({{repo}}/pull/487)).
- *Experimental:* swap en disco en el núcleo y VM
  ([#299]({{repo}}/pull/299), [#300]({{repo}}/pull/300),
  [#310]({{repo}}/pull/310)). Todavía no hay herramienta `swapon` para
  activarlo.

### Sistemas de ficheros

- MFS versión 4 es el formato por defecto: inodos anchos, ficheros de más de
  2 GB, fechas más allá de 2038 ([#246]({{repo}}/pull/246),
  [#280]({{repo}}/pull/280); [diseño](/es/docs/design/mfsv4/)).
- Journaling de metadatos en MFS
  ([#251]({{repo}}/pull/251)–[#255]({{repo}}/pull/255);
  [diseño](/es/docs/design/journal/)), atributos extendidos
  ([#256]({{repo}}/pull/256); [diseño](/es/docs/design/xattr/)), ACL
  POSIX.1e ([#258]({{repo}}/pull/258)–[#262]({{repo}}/pull/262)), atributos
  de inmutable y solo-añadir ([#249]({{repo}}/pull/249),
  [#257]({{repo}}/pull/257)).
- ext2, ext3 y ext4 con reproducción del journal, extents, 64 bits y sumas de
  comprobación ([#213]({{repo}}/pull/213),
  [#266]({{repo}}/pull/266)–[#278]({{repo}}/pull/278)).
- FAT12/16/32 en lectura y escritura ([#214]({{repo}}/pull/214),
  [#218]({{repo}}/pull/218), [#265]({{repo}}/pull/265)) y exFAT
  ([#263]({{repo}}/pull/263), [#264]({{repo}}/pull/264)).
- tmpfs, que también aloja la memoria compartida POSIX
  ([#483]({{repo}}/pull/483)).
- *Experimental:* MFS multihilo con E/S concurrente
  ([#281]({{repo}}/pull/281)). El sistema de ficheros raíz funciona con un
  solo hilo por defecto ([#282]({{repo}}/pull/282)).

### Drivers

- NVMe, incluido el arranque desde NVMe ([#183]({{repo}}/pull/183),
  [#284]({{repo}}/pull/284)).
- Controladoras USB EHCI, OHCI y xHCI, con hubs, solo para almacenamiento
  masivo ([#188]({{repo}}/pull/188),
  [#192]({{repo}}/pull/192)–[#194]({{repo}}/pull/194)).
- AHCI, e IDE con una corrección para discos de más de 2 TB
  ([#274]({{repo}}/pull/274)).
- Un dispositivo framebuffer, `/dev/fb0`, con UEFI.
- El driver de red probado es e1000. Los demás drivers de red, los de audio y
  `virtio_blk` compilan para amd64, pero no se han probado en esa
  arquitectura.

### Red

- lwIP 2.2.1 con correcciones de seguridad posteriores
  ([#313]({{repo}}/pull/313), [#314]({{repo}}/pull/314)) y de estabilidad
  ([#417]({{repo}}/pull/417), [#425]({{repo}}/pull/425)).
- Escalado de ventana TCP, SACK y marcas de tiempo
  ([#414]({{repo}}/pull/414)), opciones de multicast como en NetBSD
  ([#429]({{repo}}/pull/429)), `accept4` ([#388]({{repo}}/pull/388)).
- dhcpcd sustituye a dhclient ([#206]({{repo}}/pull/206)).

### POSIX

- Hilos en amd64 ([#179]({{repo}}/pull/179)), con muchas correcciones
  posteriores.
- Las llamadas con ruta `*at` ([#382]({{repo}}/pull/382)). Cambiaron la ABI
  de llamadas al sistema: los programas compilados antes hay que
  recompilarlos.
- Control de trabajos ([#399]({{repo}}/pull/399)–[#404]({{repo}}/pull/404)),
  `kqueue` ([#413]({{repo}}/pull/413)), colas de mensajes POSIX
  ([#405]({{repo}}/pull/405)).
- Interfaces de tiempo real: señales ([#461]({{repo}}/pull/461)), semáforos
  ([#462]({{repo}}/pull/462)), E/S asíncrona ([#463]({{repo}}/pull/463)),
  herencia y protección de prioridad ([#472]({{repo}}/pull/472),
  [#474]({{repo}}/pull/474)), sincronización entre procesos
  ([#479]({{repo}}/pull/479)), cancelación de hilos
  ([#481]({{repo}}/pull/481), [#488]({{repo}}/pull/488)).
- Open POSIX Test Suite: pasan {{posixPassed}} de {{posixTotal}} pruebas;
  pjdfstest: {{pjdfstestPassed}} de {{pjdfstestTotal}}. Detalles en la
  [página de POSIX](/es/docs/reference/posix/).

### Seguridad

- NX y pilas no ejecutables ([#317]({{repo}}/pull/317),
  [#366]({{repo}}/pull/366)); SMEP y SMAP ([#439]({{repo}}/pull/439)); el
  núcleo rechaza búferes de usuario que apuntan a memoria del núcleo
  ([#440]({{repo}}/pull/440)–[#442]({{repo}}/pull/442)); `sigreturn`
  endurecido ([#393]({{repo}}/pull/393)).
- Protección de pila y `_FORTIFY_SOURCE=2` para programas y bibliotecas de
  usuario ([#436]({{repo}}/pull/436), [#444]({{repo}}/pull/444)).
- Aleatorización de la pila y de la base de `mmap`
  ([#445]({{repo}}/pull/445)). Parcial: los ejecutables no son PIE, así que
  su código, sus datos y su heap no se mueven.
- Contraseñas con bcrypt; `setup` pide una contraseña de root
  ([#443]({{repo}}/pull/443)).
- OpenSSH {{openssh}} ([#446]({{repo}}/pull/446)), certificados raíz de
  Mozilla y `certctl` ([#447]({{repo}}/pull/447), [#448]({{repo}}/pull/448)),
  OpenSSL 3.5 LTS, Kerberos Heimdal 7.8 ([#215]({{repo}}/pull/215)).

### Toolchain y espacio de usuario

- LLVM/clang/lld {{llvm}} en el árbol ([#200]({{repo}}/pull/200),
  [#201]({{repo}}/pull/201)), desde clang 3.6. lld sustituye a GNU ld; GNU
  binutils y GCC desaparecen ([#316]({{repo}}/pull/316),
  [#318]({{repo}}/pull/318), [#323]({{repo}}/pull/323)–[#326]({{repo}}/pull/326)).
- Muchos componentes de terceros actualizados: SQLite (con WAL y seguro con
  hilos, [#418]({{repo}}/pull/418), [#421]({{repo}}/pull/421)), libuv sobre
  `kqueue` ([#427]({{repo}}/pull/427)), BIND, tmux, less, zlib, xz,
  libarchive, Lua y otros. Mira el
  [inventario de terceros](/es/docs/design/third-party/).
- Las páginas de manual van en la ISO ([#165]({{repo}}/pull/165)); nueva
  orden `free(1)` ([#225]({{repo}}/pull/225)).

### Escritorio (experimental)

- Un compositor Wayland (`wlcompd`), Qt 6 y LXQt, sobre el framebuffer UEFI
  con renderizado por software
  ([#329]({{repo}}/pull/329)–[#360]({{repo}}/pull/360)).
- Opcional: se compila fuera del árbol, necesita UEFI, no está en la ISO por
  defecto y la CI no lo prueba. Mira la
  [guía del escritorio](/es/docs/admin/desktop/).

### Pruebas

- Un arnés de pruebas en QEMU, `qemutest.py` ([#361]({{repo}}/pull/361)),
  que la CI ejecuta en cada pull request con 1 y 2 CPU.
- El Open POSIX Test Suite en el árbol ([#456]({{repo}}/pull/456)), que se
  lanza a mano. Herramientas de depuración en QEMU
  ([#407]({{repo}}/pull/407)).

### Limitaciones conocidas

- Solo amd64. i386 no compila en `{{branch}}`; ARM no se mantiene desde el
  fork.
- Probado sobre todo en QEMU/KVM. Máquinas físicas verificadas: {{hardware}}.
- El instalador, `setup`, sigue buscando los conjuntos de instalación en
  `/i386/binary/sets` y no copia nada de la ISO de amd64. Solo instala para
  arranque BIOS. En [Instalar en disco](/es/docs/start/install/) están la
  solución provisional y la alternativa de la imagen de disco.
- No hay repositorio de paquetes binarios para amd64. `pkg_add` está en el
  sistema base; `pkgin` no.
- No hay depurador (gdb ni lldb).
- Los ejecutables no son PIE; no hay RELRO.
- La actualización en caliente (live update), una función de MINIX original,
  no funciona en amd64: su prueba es un fallo conocido.
- No hay herramienta para activar el swap; no se admiten teclados ni ratones
  USB; no hay UEFI Secure Boot.
- El árbol sigue llamándose MINIX 3, versión 3.4.0 (menú de arranque,
  `uname`).

## Linaje

| Fecha | Hito |
|---|---|
| oct. 2005 | MINIX 3.1.0, la primera versión de MINIX 3 |
| feb. 2012 | MINIX 3.2.0: libc y espacio de usuario de NetBSD, clang, SMP experimental |
| feb. 2013 | MINIX 3.2.1 |
| sep. 2014 | MINIX 3.3.0: soporte de ARM; la última versión estable de MINIX original |
| may. 2017 | MINIX 3.4.0rc6, la última versión candidata de MINIX original |
| nov. 2018 | Último commit de MINIX original, `4db99f4`: la base del fork |
| mar. 2026 | Empieza el fork |
| may. 2026 | amd64 arranca hasta el login (en `master`, [#153]({{repo}}/pull/153)) |
| jun.–nov. 2026 | Desarrollo en `{{branch}}`, PR [#154]({{repo}}/pull/154) a [#488]({{repo}}/pull/488) |
| {{date}} | {{name}} {{version}} |

El árbol tiene también su propio
[`RELEASE_NOTES.md`]({{repo}}/blob/{{branch}}/RELEASE_NOTES.md). Solo cubre de
marzo a principios de junio de 2026 y no se ha actualizado desde entonces.
Estas notas lo sustituyen para todo lo posterior.

Para la historia completa, mira [historia](/es/docs/learn/history/).
