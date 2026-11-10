---
title: "Historia"
description: "Cuarenta años de MINIX, desde un sistema docente en disquetes hasta el fork x86-64 que se convirtió en {{name}}."
sidebar:
  order: 5
---

{{name}} no es un sistema operativo nuevo escrito desde cero. Es la rama más
reciente de un código que se enseña, se estudia y se reescribe desde 1984.
Conocer esa historia explica muchas cosas del árbol de código: por qué
algunos ficheros tienen comentarios de tres épocas distintas, por qué las
herramientas de usuario vienen de NetBSD y por qué la versión sigue diciendo
3.4.0.

Las fechas de esta página salen de las fuentes enumeradas al final. Cuando
una fecha solo procede de marcas de tiempo de ficheros o de la prensa, la
tabla lo indica.

## MINIX 1 y 2: un sistema para estudiantes (1984–2003)

En 1984 Andrew S. Tanenbaum, profesor de la Vrije Universiteit (VU) de
Ámsterdam, empezó a escribir en su tiempo libre un sistema compatible con
UNIX. La licencia de AT&T para UNIX Version 7 ya no permitía usar su código
en clase, y él quería un sistema lo bastante pequeño para que un estudiante
pudiera leerlo entero.

| Año | Hecho |
|---|---|
| 1987 | Se publica **MINIX 1** junto con la primera edición de *Operating Systems: Design and Implementation* (OSDI). Es compatible con UNIX Version 7, funciona en el IBM PC y Prentice Hall lo vende en disquetes con un manual. |
| hacia 1991 | MINIX 1.5 ya está portado a Macintosh, Amiga, Atari y SPARCstation. |
| 1991 | Linus Torvalds se compra un PC para usar MINIX, estudia su código y escribe en el grupo de noticias `comp.os.minix`. En agosto anuncia allí el núcleo, hecho por afición, que acabará siendo Linux. Las primeras versiones de Linux usaban el sistema de ficheros de MINIX. |
| 1992 | Un mensaje de Tanenbaum defendiendo que los microkernels son mejor diseño desata en ese mismo grupo el famoso debate microkernel contra monolítico con Torvalds. |
| 1997 | **MINIX 2**, publicado con la segunda edición de OSDI (escrita con Albert S. Woodhull), apunta a POSIX en lugar de a Version 7. |
| 2000 | MINIX pasa a una **licencia de estilo BSD** y se puede descargar libremente. Es la licencia que sigue usando {{name}}. |

Durante toda esa época MINIX ya era un sistema de microkernel: el sistema
de ficheros y el gestor de memoria se ejecutaban como procesos aparte. Los
drivers, en cambio, seguían compilados dentro de la imagen del núcleo.

## MINIX 3: investigación en fiabilidad en la VU (2004–2016)

En 2004 el proyecto dejó de ser una afición docente y pasó a ser un
proyecto de investigación financiado sobre sistemas fiables. Una
subvención de la Organización Neerlandesa para la Investigación Científica
(NWO), seguida de una cátedra de la Real Academia Neerlandesa de Artes y
Ciencias, pagó un equipo. El trabajo de máster de Jorrit Herder sacó los
drivers del núcleo a procesos aislados en modo usuario, y se añadió el
servidor de reencarnación para reiniciarlos cuando fallan. Esa combinación,
drivers en modo usuario más autorreparación, es lo que convirtió el
sistema en «MINIX 3».

| Fecha | Hecho |
|---|---|
| oct. 2005 | MINIX 3 se presenta en la conferencia inaugural de Tanenbaum en ACM SOSP 2005. La **3.1.0**, la versión que describe el libro, sale el 24 de octubre. |
| 2006 | La tercera edición de OSDI (Tanenbaum y Woodhull) cubre MINIX 3.1.0. |
| 2006–2007 | 3.1.2a (mayo de 2006) y 3.1.3 (abril de 2007), que introduce VFS: el antiguo servidor de ficheros se divide en una capa de sistema de ficheros virtual y servidores de sistemas de ficheros como MFS. |
| 2008 | Tanenbaum recibe una **Advanced Grant del Consejo Europeo de Investigación** (n.º 227874), que financia programadores, doctorandos y posdocs durante cinco años. Una ayuda posterior del ERC, de prueba de concepto (n.º 297420), paga el port a ARM. |
| jun. 2009 | La 3.1.4 añade **memoria virtual** y el servidor VM. |
| 2009–2010 | 3.1.5 (nov. 2009), 3.1.6 (feb. 2010, System Event Framework), 3.1.7 (jun. 2010, **planificador en espacio de usuario**), 3.1.8 (oct. 2010, **pkgsrc y pkgin**, ext2, ACPI). |
| 2010 | Tesis doctoral de Herder, *Building a Dependable Operating System*. |
| **29 feb. 2012** | La **3.2.0** pasa a clang y a la **biblioteca C de NetBSD**, binarios ELF, un VFS multihilo y el cargador de arranque de NetBSD, y añade **SMP experimental**. Desde entonces la mayoría de las herramientas de usuario vienen de NetBSD. |
| 21 feb. 2013 | **3.2.1**: bibliotecas compartidas, la compilación cruzada con `build.sh` de NetBSD, drivers virtio y AHCI. |
| 2014 | Tesis doctorales de Cristiano Giuffrida (actualización en caliente) y Raja Appuswamy (la pila de almacenamiento Loris). |
| sep. 2014 | **3.3.0**, la primera versión que funciona en **ARM** (BeagleBoard-xM, BeagleBone). Es también la **última versión estable de upstream**. |
| ene. 2016 | El árbol sube a 3.4.0 y se publica la primera release candidate (rc1). |
| mar. 2016 | El artículo de Tanenbaum «Lessons Learned from 30 Years of MINIX» en *Communications of the ACM* dice que la financiación ha terminado y que MINIX pasa a ser un proyecto de código abierto llevado por la comunidad. |

La investigación de esa etapa (actualización en caliente, inyección de
fallos, la pila de almacenamiento Loris, pilas de red multinúcleo) está
recogida en [Para saber más](/es/docs/reference/further-reading/).

## La larga pausa (2016–2025)

| Fecha | Hecho |
|---|---|
| 2016–2017 | Salen seis release candidates de la 3.4.0: rc1 y rc2 en enero de 2016, rc3 en diciembre de 2016, rc4 en enero de 2017, rc5 en marzo de 2017 y **rc6 el 9 de mayo de 2017**. Estas fechas salen de las marcas de tiempo de las ISO en el servidor de descargas; no hay etiquetas git para ellas. **La 3.4.0 definitiva nunca se publicó.** |
| finales de 2017 | La prensa revela que una versión modificada de MINIX se ejecuta dentro del Intel Management Engine (ME 11) de muchos PC. Tanenbaum respondió con una carta abierta: la licencia BSD permitía a Intel usarlo sin avisarle, y le habría gustado que le avisaran. |
| 14 nov. 2018 | **Último commit** en la rama `master` de upstream. |

El repositorio de upstream no está archivado, pero no se ha integrado nada
desde 2018. La web y la wiki siguen anunciando la 3.3.0 como versión
actual. Sus imágenes para PC son solo de 32 bits, y compilar el árbol
antiguo con un compilador moderno en el anfitrión es complicado.

## El fork de 2026, y {{name}}

En marzo de 2026 David Montero ({{maintainer}}) hizo un fork del
repositorio de upstream en GitHub, `davmont/minix`. El objetivo era llevar
el sistema a los PC de 64 bits sin renunciar a lo que lo hace interesante
para estudiar: el núcleo pequeño, los drivers aislados y la
autorreparación.

| Fecha (2026) | Hito |
|---|---|
| marzo | El fork arranca con arreglos de la cadena de compilación y de calidad del código, y con una resincronización de las herramientas de compilación con NetBSD 10. |
| finales de mayo | El **port a amd64 (x86-64) llega al prompt de login**. Este primer port se integra en `master`. Todo el trabajo posterior se hace en la rama `devel`. |
| 1–2 de junio | Un CD de arranque híbrido **BIOS + UEFI** construido con GRUB, y **SMP**: se arrancan y planifican los demás procesadores (PR #157), con una vía rápida de IPC para `sendrec`. |
| junio | Drivers NVMe y de almacenamiento USB, interrupciones MSI-X, hilos POSIX en amd64 y el paso a **LLVM/clang {{llvm}}** dentro del árbol, con lld en lugar de las binutils de GNU. |
| 24–27 de junio | **MFS versión 4** (PR #246): inodos más anchos, ficheros de más de 2 GB, fechas posteriores a 2038. Después, **journaling** de metadatos (PR #251–#255), atributos extendidos y ACL POSIX. MFS v4 pasa a ser el formato por defecto (PR #280). |
| julio | Trabajo en la memoria virtual: **recuperación** de páginas limpias, memoria anónima **comprimida** y la parte del núcleo del **swap**. lwIP sube a la 2.2.1. |
| 13–14 de julio | **wlcompd**, un compositor Wayland escrito para el sistema, y Qt 6 dibujando sobre él. Los experimentos con el escritorio LXQt siguen de julio a septiembre. |
| finales de septiembre | Un arnés de pruebas sobre QEMU ejecuta las baterías de tests en CI en cada pull request. |
| octubre | Trabajo de POSIX: control de trabajos, `kqueue`, colas de mensajes, pruebas POSIX de sistema de ficheros. Endurecimiento: stack protector, `_FORTIFY_SOURCE`, SMEP/SMAP, ASLR parcial, OpenSSH {{openssh}}. Un espacio de direcciones de usuario de 47 bits (128 TB). Clases de planificación de tiempo real. |
| noviembre | `tmpfs`, memoria compartida a través de `fork`, cancelación de hilos. La Open POSIX Test Suite llega a {{posixPassed}} de {{posixTotal}} pruebas superadas. |
| finales de 2026 | El proyecto adopta el nombre **{{name}}**. |

Algunas cosas que la hoja de ruta de upstream aún da como trabajo futuro,
como un núcleo multiprocesador, ya existen en `devel`. Otras cosas de
upstream no se han conservado: i386 ya no compila, el port a ARM no se ha
tocado desde el fork y la actualización en caliente no funciona en amd64.

:::note[El nombre en el árbol de código]
El cambio de nombre empieza por esta web. El árbol de código sigue diciendo
«MINIX 3» en el menú de arranque, en `uname` y en el número de versión
(3.4.0). {{name}} es un derivado independiente de MINIX 3. No está afiliado
al proyecto MINIX ni a la Vrije Universiteit, ni cuenta con su respaldo.
:::

Para ver cómo es {{name}} hoy, empieza por la
[visión general de la arquitectura](/es/docs/learn/architecture/) y las
[notas de versión](/es/docs/reference/release-notes/).

## Fuentes

- A. S. Tanenbaum, «Lessons Learned from 30 Years of MINIX»,
  *Communications of the ACM* 59(3), marzo de 2016.
  DOI [10.1145/2795228](https://doi.org/10.1145/2795228). La fuente
  principal para 1984–2016, incluidos los orígenes de Linux y la historia
  de la financiación.
- Wiki de MINIX 3, páginas de versiones:
  [versiones anteriores](https://wiki.minix3.org/doku.php?id=releases:previous),
  [3.2.0](https://wiki.minix3.org/doku.php?id=releases:3.2.0:start),
  [3.2.1](https://wiki.minix3.org/doku.php?id=releases:3.2.1:start),
  [3.3.0](https://wiki.minix3.org/doku.php?id=releases:3.3.0).
- Wiki de MINIX 3, [read more](https://wiki.minix3.org/doku.php?id=www:documentation:read-more):
  contexto sobre las ediciones del libro.
- A. S. Tanenbaum, [An Open Letter to Intel](https://www.cs.vu.nl/~ast/intel/).
- El historial git de upstream: <https://github.com/Stichting-MINIX-Research-Foundation/minix>.
- El historial del fork: los commits de merge y las pull requests de
  [{{branch}}]({{repo}}/commits/{{branch}}) en {{repo}}.
