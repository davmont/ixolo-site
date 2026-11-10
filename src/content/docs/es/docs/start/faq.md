---
title: "Preguntas frecuentes"
description: "Respuestas breves sobre {{name}}: su relación con MINIX 3 y Linux, el nombre, la licencia, el hardware, el software y dónde pedir ayuda."
sidebar:
  order: 4
---

## ¿Qué es {{name}}, comparado con MINIX 3 y Linux?

{{name}} es un fork independiente de MINIX 3 para PC x86 de 64 bits. Conserva
el diseño de MINIX: un microkernel pequeño (unas {{kernelLines}} líneas de
código), con los drivers, los sistemas de ficheros y la pila de red como
procesos de usuario separados. Si uno falla, el Reincarnation Server lo
reinicia y el resto del sistema sigue funcionando.

| | MINIX 3 (upstream) | {{name}} | Linux |
|---|---|---|---|
| Núcleo | Microkernel | Microkernel (el mismo diseño, portado a x86-64) | Monolítico, con módulos cargables |
| Drivers | Procesos de usuario | Procesos de usuario | Dentro del núcleo |
| Plataforma principal | i386, ARM | amd64 | Casi todas |
| Userland | NetBSD | NetBSD, en buena parte actualizado | GNU y otros |
| Desarrollo | Sin commits en master desde 2018 | Activo | Muy activo |

El fork añade un núcleo de 64 bits, SMP (hasta {{maxCpus}} CPU), arranque
UEFI, NVMe, xHCI, un sistema de ficheros con journal, hilos y mucho más
POSIX. Linux es muchísimo más grande y funciona con mucho más hardware y
software; {{name}} cambia eso por un sistema lo bastante pequeño para leerlo
y resistente a los fallos de los drivers. Consulta
[la arquitectura](/es/docs/learn/architecture/).

## ¿Por qué el nombre nuevo?

El fork se ha alejado mucho de upstream, y un nombre propio evita
confusiones con el proyecto MINIX 3 y sus versiones. El ajolote regenera las
extremidades que pierde; {{name}} reinicia los drivers que fallan. La
mascota, un ajolote, se llama Xolo.

## ¿Esto es MINIX 3.4?

No. Upstream publicó candidatas de la versión 3.4.0 (la última en 2017),
pero nunca una 3.4.0 definitiva. {{name}} parte del último árbol de
desarrollo de upstream (noviembre de 2018) y ha cambiado mucho desde
entonces. El código todavía se presenta como `Minix 3.4.0` en `uname` y en
los menús de arranque, porque el cambio de nombre aún no ha llegado al
código. {{name}} no es una versión oficial de MINIX. La
[historia](/es/docs/learn/history/) tiene los detalles.

## ¿Qué licencia tiene?

El código de MINIX 3 tiene una licencia de estilo BSD, con copyright de la
Vrije Universiteit Amsterdam: puedes usarlo, modificarlo y redistribuirlo,
como código o como binario, si conservas el aviso de copyright y la
exención de responsabilidad. Lee el fichero
[`LICENSE`]({{repo}}/blob/{{branch}}/LICENSE). El software de terceros
incluido mantiene su propia licencia (el código de NetBSD es BSD; algunos
componentes de `external/` y el nuevo driver de red `igc` son GPL).

{{name}} no está afiliado a la Vrije Universiteit ni a la Stichting MINIX
Research Foundation, ni cuenta con su respaldo.

## ¿Funciona en hardware real o solo en máquinas virtuales?

Casi todas las pruebas se hacen en QEMU/KVM, y es la forma recomendada de
probarlo. Máquinas físicas verificadas hasta ahora: {{hardware}}. Los
drivers con más probabilidades de funcionar en un PC real son los de
almacenamiento AHCI, IDE y NVMe, las tarjetas de red Intel e1000, el
almacenamiento masivo USB y los teclados y ratones PS/2. No hay soporte de
teclado USB, ni wifi, ni Secure Boot. La lista completa está en los
[requisitos de hardware](/es/docs/start/install/#requisitos-de-hardware).

## ¿Por qué necesita FSGSBASE?

Cada hilo necesita un puntero a su almacenamiento local. En x86-64 ese
puntero vive en el registro base de FS, y la biblioteca de C lo fija con la
instrucción `WRFSBASE`, que necesita la característica `FSGSBASE` de la CPU.
Fijar el registro desde el espacio de usuario ahorra una llamada al sistema,
y exigir la característica deja un solo camino de código en vez de dos. Las
CPU Intel desde Ivy Bridge (2012) la tienen, y también las AMD Zen. En QEMU
usa `-cpu host` o `-cpu max`; los modelos de CPU por defecto más antiguos de
QEMU no la tienen.

## ¿Puede ejecutar programas de Linux?

Como binarios, no: no hay capa de compatibilidad con Linux. Los programas
escritos para POSIX a menudo se pueden compilar para {{name}} desde el
código. El sistema pasa {{posixPassed}} de las {{posixTotal}} pruebas de la
Open POSIX Test Suite. Un programa que dependa de interfaces exclusivas de
Linux (`epoll`, `inotify`, ficheros de `/proc` en formato Linux, etc.)
necesita un port.

## ¿Hay paquetes?

Todavía no. No hay repositorio de paquetes binarios para amd64; `pkg_add`
está en el sistema base, pero no hay nada que descargar. Lo que puedes hacer
hoy está en [La shell y el software](/es/docs/start/shell-packages/#paquetes).

## ¿Hay escritorio gráfico?

Uno experimental: un compositor Wayland nativo con LXQt sobre Qt 6, con
renderizado por software. Necesita UEFI y se compila aparte; no está en la
ISO por defecto ni lo prueba la CI. Consulta
[El escritorio](/es/docs/admin/desktop/).

## ¿Y i386 y ARM?

{{name}} solo apunta a amd64. El código de i386 sigue en el árbol, pero no
compila en `{{branch}}`, y el port de ARM no se mantiene desde el fork.
Ninguno de los dos tiene CI ni trabajo reciente.

## ¿No es MINIX el sistema que va dentro de las CPU de Intel?

El Management Engine (ME) de Intel, un procesador aparte presente en muchos
chipsets de Intel, ejecuta una versión modificada de un MINIX 3 antiguo, algo
que la licencia BSD permite. En una
[carta abierta a Intel](https://www.cs.vu.nl/~ast/intel/), Andrew Tanenbaum,
autor de MINIX, da su punto de vista: Intel usó una versión antigua, pensada
sobre todo para la enseñanza, y lo único que habría pedido es que se lo
dijeran. {{name}} no tiene nada que ver con el Intel ME. Es un fork aparte,
que parte del código público de MINIX 3 y se desarrolla en abierto.

## ¿Dónde pido ayuda o informo de un fallo?

Abre una incidencia en el [gestor de incidencias]({{issues}}). Indica la
versión o el commit de {{name}}, cómo lo arrancas (línea de órdenes de QEMU o
hardware) y qué ves. Un registro de la consola serie ayuda: arranca con
`-serial file:boot.log` y elige en el menú la entrada de consola serie. Para
ayudar con el código, consulta [Contribuir](/es/docs/develop/contributing/).
