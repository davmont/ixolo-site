---
title: "Para saber más"
description: "Libros, artículos, tesis y documentos sobre MINIX 3 y {{name}}, seleccionados para quien quiera profundizar."
sidebar:
  order: 5
---

{{name}} hereda de MINIX 3 algo más que código: unos quince años de
investigación publicada en la Vrije Universiteit (VU) de Ámsterdam
explican por qué el sistema está construido así. Esta página es una
selección, no una lista completa. La
[página de publicaciones](https://wiki.minix3.org/doku.php?id=publications)
de upstream recoge unas 65 entradas.

:::note[Los artículos de upstream describen el MINIX de upstream]
Los artículos de esta página describen MINIX 3 en x86 de 32 bits (y
después ARM), a menudo un prototipo de investigación más que una versión
publicada. Las ideas valen para {{name}}; las mediciones, los fragmentos de
código y algunas funciones no. En concreto, la actualización en caliente
no está disponible en el port amd64 de {{name}}.
:::

## Libros

- **Andrew S. Tanenbaum y Albert S. Woodhull, *Operating Systems: Design
  and Implementation*, 3.ª edición.** Prentice Hall, 2006. El libro de
  texto de MINIX 3.1.0, con buena parte del código impreso y explicado.
  Los conceptos siguen coincidiendo con {{name}}; muchos detalles han
  cambiado. La [Guía para docentes](/es/docs/learn/teachers/) tiene una
  tabla con lo que ha cambiado. Upstream publica un
  [listado indexado del código del libro](http://www.minix3.org/documentation/AppendixB.html).
- **Andrew S. Tanenbaum y Herbert Bos, *Modern Operating Systems*,
  5.ª edición.** Pearson, 2022. El manual general de sistemas operativos
  del mismo grupo. No trata de MINIX, pero cubre microkernels, memoria
  virtual, sistemas de ficheros y multiprocesadores con el mismo enfoque.

## Artículos de visión general

Buenos puntos de partida: cortos y legibles sin formación investigadora.

- Herder, Bos, Gras, Homburg y Tanenbaum, **«MINIX 3: A Highly Reliable,
  Self-Repairing Operating System»**. *ACM SIGOPS Operating Systems Review*
  40, julio de 2006, pp. 80–89.
  [PDF](http://www.minix3.org/docs/jorrit-herder/osr-jul06.pdf).
  El diseño de MINIX 3 en un solo artículo: drivers en modo usuario,
  mínimo privilegio, el servidor de reencarnación.
- Herder, Bos, Gras, Homburg y Tanenbaum, **«Modular System Programming
  in MINIX 3»**. USENIX *;login:* 31(2), abril de 2006, pp. 19–28.
  [PDF](http://www.minix3.org/docs/login-2006.pdf).
- Tanenbaum, Herder y Bos, **«Can We Make Operating Systems Reliable and
  Secure?»** *IEEE Computer* 39(5), mayo de 2006, pp. 44–51. Los argumentos
  a favor de los microkernels y el aislamiento, comparados con otros
  enfoques.
- Tanenbaum et al., **«MINIX 3: Status Report and Current Research»**.
  USENIX *;login:* 35(3), junio de 2010, pp. 7–13.
  [PDF](http://www.minix3.org/docs/login-2010.pdf). Una foto de las líneas
  de investigación a mitad del proyecto del ERC.
- Andrew S. Tanenbaum, **«Lessons Learned from 30 Years of MINIX»**.
  *Communications of the ACM* 59(3), marzo de 2016.
  DOI [10.1145/2795228](https://doi.org/10.1145/2795228). La historia de
  MINIX y de Linux, y lo que aprendió el proyecto. Ver también
  [Historia](/es/docs/learn/history/).

## Artículos de investigación

### Aislamiento y recuperación

Son la base de [la arquitectura](/es/docs/learn/architecture/) y de la
[práctica de romper un driver](/es/docs/learn/lab-break-a-driver/).

- Herder, Bos, Gras, Homburg y Tanenbaum, **«Reorganizing UNIX for
  Reliability»**. ACSAC 2006, pp. 81–94.
  [PDF](http://www.minix3.org/docs/jorrit-herder/acsac06.pdf).
- Herder, Bos, Gras, Homburg y Tanenbaum, **«Failure Resilience for
  Device Drivers»**. DSN 2007, Edimburgo, pp. 41–50.
  [PDF](http://www.minix3.org/docs/jorrit-herder/dsn-dccs07.pdf).
  Cómo detecta el servidor de reencarnación los drivers que fallan y cómo
  los reinicia.
- Herder, Bos, Gras, Homburg y Tanenbaum, **«Countering IPC Threats in
  Multiserver Operating Systems»**. PRDC 2008, pp. 112–121.
  [PDF](http://www.minix3.org/docs/jorrit-herder/prdc08.pdf).
  Cómo un servidor defectuoso o malicioso puede abusar del IPC, y cómo
  limitarlo.
- Herder, Bos, Gras, Homburg y Tanenbaum, **«Fault Isolation for Device
  Drivers»**. DSN 2009, pp. 33–42.
  [PDF](http://www.minix3.org/docs/jorrit-herder/dsn-dccs09.pdf).
- Herder, van Moolenbroek, Appuswamy, Wu, Gras y Tanenbaum, **«Dealing
  with Driver Failures in the Storage Stack»**. LADC 2009, pp. 119–126
  (premio al mejor artículo).
  [PDF](http://www.minix3.org/docs/jorrit-herder/ladc09.pdf).
  Recuperarse de la caída de un driver de disco sin perder datos.

### Actualización en caliente

Investigación de upstream; no disponible en el port amd64 de {{name}}.

- Giuffrida, Kuijsten y Tanenbaum, **«Safe and Automatic Live Update for
  Operating Systems»**. ASPLOS 2013, pp. 279–292.
  [PDF](http://www.minix3.org/docs/conf/asplos-2013.pdf).
- Giuffrida, Iorgulescu, Kuijsten y Tanenbaum, **«Back to the Future:
  Fault-tolerant Live Update with Time-traveling State Transfer»**.
  LISA 2013, pp. 89–104 (premio al mejor artículo de estudiante).
  [PDF](http://www.minix3.org/docs/conf/lisa-2013.pdf).
- Giuffrida, Kuijsten y Tanenbaum, **«Enhanced Operating System Security
  Through Efficient and Fine-grained Address Space Randomization»**.
  USENIX Security 2012, pp. 40–55. Aleatorización en caliente de los
  componentes del sistema.

### Almacenamiento, red y multinúcleo

- Appuswamy, van Moolenbroek y Tanenbaum, **«Loris – A Dependable,
  Modular File-Based Storage Stack»**. PRDC 2010, pp. 165–174.
  [PDF](http://www.minix3.org/docs/loris/PRDC2010.pdf).
- Hruby, Vogt, Bos y Tanenbaum, **«Keep Net Working – On a Dependable
  and Fast Networking Stack»**. DSN 2012.
  [PDF](http://www.minix3.org/theses/dsn2012.pdf).
  Una pila de red dividida en componentes aislados sobre núcleos
  dedicados.
- Hruby, Bos y Tanenbaum, **«When Slower Is Faster: On Heterogeneous
  Multicores for Reliable Systems»**. USENIX ATC 2013, pp. 255–266.
  [PDF](http://www.minix3.org/docs/conf/atc-2013.pdf).

El trabajo propio de {{name}} en SMP y sistemas de ficheros no sigue estos
prototipos de investigación; consulta los documentos de diseño más abajo.

## Tesis

- Jorrit N. Herder, **«Building a Dependable Operating System»**, tesis
  doctoral, VU Ámsterdam, 2010.
  [PDF](http://www.minix3.org/theses/herder_phd_thesis.pdf).
  La descripción más completa del diseño de fiabilidad de MINIX 3.
- Cristiano Giuffrida, **«Safe and Automatic Live Update»**, tesis
  doctoral, VU Ámsterdam, 2014.
  [PDF](http://www.minix3.org/theses/Cristiano_Giuffrida_PhD_thesis.pdf).
- Raja Appuswamy, **«Building a File-Based Storage Stack: Modularity and
  Flexibility in Loris»**, tesis doctoral, VU Ámsterdam, 2014.
  [PDF](http://www.minix3.org/theses/Raja_Appuswamy_PhD_thesis.pdf).
- Balázs Gerofi, **«Design and Implementation of the MINIX Virtual File
  System»**, trabajo de máster, VU Ámsterdam, 2006.
  [PDF](http://www.minix3.org/theses/gerofi-minix-vfs.pdf).
  El origen de VFS.
- Björn Patrick Swift, **«User Mode Scheduling in MINIX 3»**, informe de
  proyecto, 2010. [PDF](http://www.minix3.org/docs/scheduling/report.pdf).
  El origen del servidor SCHED.

## Recursos de MINIX 3 en upstream

Upstream ya no tiene desarrollo activo, pero su material sigue en línea.

| Recurso | Dirección |
|---|---|
| Web | <https://www.minix3.org/> |
| Wiki (guías de usuario y de desarrollo, para i386 y ARM) | <https://wiki.minix3.org/> |
| Lista de publicaciones | <https://wiki.minix3.org/doku.php?id=publications> |
| Páginas de manual | <https://man.minix3.org/> |
| Grupo de Google | <https://groups.google.com/g/minix3> |
| Repositorio de código | <https://github.com/Stichting-MINIX-Research-Foundation/minix> |

Páginas de la wiki que siguen siendo útiles como contexto: la
[guía de desarrollo](https://wiki.minix3.org/doku.php?id=developersguide:start)
(paso de mensajes, grants de memoria, SEF, la API del núcleo) y las
[notas de versiones anteriores](https://wiki.minix3.org/doku.php?id=releases:previous).
Las órdenes, rutas y detalles de hardware que aparecen allí describen i386
y ARM, no {{name}}.

## Documentos de diseño de {{name}}

Estos documentos están en el árbol de código y se copian a esta web
(en inglés). Describen el trabajo hecho en el fork.

| Documento | Tema |
|---|---|
| [SMP](/es/docs/design/smp/) | Arranque de las demás CPU, estado por CPU, el big kernel lock |
| [Arranque UEFI](/es/docs/design/uefi-boot/) | El CD híbrido BIOS + UEFI y la imagen de disco GPT |
| [MFS versión 4](/es/docs/design/mfsv4/) | El nuevo formato de inodo en disco |
| [Journaling de MFS](/es/docs/design/journal/) | Registro de escritura anticipada (WAL) de metadatos |
| [Atributos extendidos de MFS](/es/docs/design/xattr/) | Atributos extendidos guardados por MFS |
| [Recuperación de memoria en VM](/es/docs/design/reclaim/) | Recuperación de páginas, memoria comprimida y swap |
| [Wayland](/es/docs/design/wayland/) | Estudio de viabilidad de un escritorio Wayland |

Algunos se escribieron con el trabajo en curso, y sus líneas de estado
pueden ir por detrás del código. Las pull requests de {{repo}} son el
registro de lo que realmente se integró.
