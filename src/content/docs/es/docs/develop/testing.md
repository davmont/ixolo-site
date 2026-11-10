---
title: "Pruebas e integración continua"
description: "Las baterías de pruebas, cómo lanzarlas con qemutest.py o a mano, las listas de fallos conocidos, la CI y cómo depurar un cuelgue."
sidebar:
  order: 3
---

Todo cambio en {{name}} se prueba arrancando la imagen real en QEMU y
ejecutando baterías de pruebas dentro. Un único script,
[`releasetools/qemutest.py`]({{repo}}/blob/{{branch}}/releasetools/qemutest.py),
lo hace en tu máquina y en la CI. En el host solo necesitas `python3` y
`qemu-system-x86_64`; usa KVM si `/dev/kvm` está disponible y TCG
(`-cpu max`) si no.

## Las baterías

| Batería | Qué ejecuta | Tamaño | En la CI |
|---|---|---|---|
| `boot` | Arranca hasta `login:`, entra y sale | 1 comprobación | sí, antes de cualquier otra |
| `quick` | Los programas de `minix/tests` que son rápidos y no necesitan red | unas 150 pruebas | sí |
| `full` | Todas las pruebas que conoce el script `run` | horas | no |
| `pjdfstest` | Conformidad POSIX del sistema de ficheros ([pjdfstest](https://github.com/pjd/pjdfstest)) | {{pjdfstestTotal}} scripts | sí |
| `posix` | La Open POSIX Test Suite de LTP 20250130 | {{posixTotal}} pruebas | no, se lanza a mano |
| `kyua` | Las pruebas ATF de NetBSD con kyua | necesita el conjunto `tests` | no |

Últimos resultados registrados, con KVM: **quick** lo pasa todo salvo sus
fallos conocidos, con 1 y 2 CPU; **pjdfstest** pasa {{pjdfstestPassed}} de
{{pjdfstestTotal}} scripts sin fallos inesperados; la **Open POSIX Test Suite**
pasa {{posixPassed}} de {{posixTotal}} con 2 CPU sin fallos inesperados.

## Lanzar una batería

Genera antes una ISO (consulta
[Compilar desde el código](/es/docs/develop/building/)) y después:

```sh
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite boot
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite quick \
  --xfail releasetools/qemutest.xfail
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite pjdfstest \
  --xfail releasetools/qemutest-pjdfstest.xfail --smp 2
```

Cómo funciona: la ISO arranca un getty en el primer puerto serie, así que la
línea serie es una shell de root. El script entra por ahí, copia las pruebas a
un disco RAM MFS nuevo de 128 MB (la raíz del CD es de solo lectura y `/tmp` es
diminuto) y ejecuta las pruebas de una en una, cada una con su propio límite de
tiempo, leyendo su salida TAP. Si una prueba se cuelga, la interrumpe, tira su
máquina virtual, arranca otra y sigue con la siguiente prueba.

| Opción | Significado | Por defecto |
|---|---|---|
| `--suite` | `boot`, `quick`, `full`, `kyua`, `pjdfstest` o `posix` | `boot` |
| `--tests "1 2 sh1"` | Ejecuta solo estas pruebas (en `posix`, también prefijos de directorio) | toda la batería |
| `--shard K/N` | Ejecuta una de cada N pruebas empezando por la K, para que N ejecuciones en paralelo cubran la batería | desactivado |
| `--smp N` | CPU del invitado. Con 2 se ejercitan los caminos SMP | 1 |
| `--mem MB` | RAM del invitado | 1024 |
| `--xfail FICHERO` | Lista de fallos conocidos; se puede repetir y las listas se combinan | ninguna |
| `--test-timeout S` | Segundos por prueba | 600 con KVM, 1200 con TCG |
| `--boot-timeout S` | Segundos para llegar a `login:` | 300 con KVM, 600 con TCG |
| `--max-reboots N` | Se rinde tras este número de pruebas colgadas | 10 |
| `--no-kvm` | Fuerza TCG | |
| `--drive IMG` | Disco en bruto conectado como segundo disco IDE (`/dev/c0d1`); la batería `posix` lo necesita | |
| `--kernel ELF` | El núcleo sin recortar (`obj.amd64/minix/kernel/kernel`): si una prueba se cuelga, guarda los volcados de procesos; si falla, guarda los mensajes del núcleo que provocó | |
| `--log-dir DIR` | Dónde van los registros | `qemutest-logs` |

El directorio de registros recibe `serial.log` (la transcripción completa de la
consola), `results.tap` y, con `--kernel`, un `fail-PRUEBA.txt` o
`hang-PRUEBA-N.txt` por problema. El código de salida es 0 si todo pasó, 1 si
alguna prueba falló o se colgó, 2 si la imagen no arrancó o no pudo entrar, 3
si el host no pudo mantener un invitado en marcha y 4 por uso incorrecto.

## Listas de fallos conocidos

Una prueba que se sabe que falla se apunta en una lista, para que la ejecución
siga pasando y un fallo *nuevo* destaque. El formato es una prueba por línea,
con comentarios tras `#`:

```
42:120      # ptrace: attach subtests 9 and 19 fail (T5); ...
75 flaky    # getrusage: ru_utime rounds to 0 under HZ=60 tick accounting (T2)
mfs         # expected mkfs.mfs image sha1 predates the MFS4 default (test debt)
```

`nombre:segundos` acota un cuelgue conocido para que no consuma el límite
completo. `flaky` acepta cualquier resultado. Una prueba de la lista que
**pasa** se informa como XPASS y hace fallar la ejecución: quítala de la lista
en el mismo cambio que la arregla. Así las listas no mienten.

| Fichero | Para | Contenido |
|---|---|---|
| [`qemutest.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest.xfail) | `quick` | 11 entradas: ptrace (42), `strtoll` y aritmética de 64 bits (45, 53, 66), ptyfs (77), dos pruebas desfasadas (`mfs`, `isofs`) y otras inestables |
| [`qemutest-tcg.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-tcg.xfail) | `quick` con TCG | Pruebas de temporizadores y pruebas lentas que pasan con KVM pero se atascan en un host emulado lento; se combina con la anterior |
| [`qemutest-pjdfstest.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-pjdfstest.xfail) | `pjdfstest` | 8 scripts: MFS guarda las marcas de tiempo en segundos enteros, y las rutas largas no fallan con `ENAMETOOLONG` como espera POSIX |
| [`qemutest-posix.xfail`]({{repo}}/blob/{{branch}}/releasetools/qemutest-posix.xfail) | `posix` | 78 entradas, 12 de ellas pruebas de tiempos inestables; cada una dice cómo falló |

## La Open POSIX Test Suite

Es la `open_posix_testsuite` de LTP (versión 20250130), guardada en
[`external/gpl2/open_posix_testsuite`]({{repo}}/blob/{{branch}}/external/gpl2/open_posix_testsuite/README.minix).
Es GPLv2, así que nunca se enlaza con nada que se distribuya y la compilación
de la release no la construye. Se compila de forma cruzada en el host y se
entrega al invitado en un segundo disco:

```sh
python3 releasetools/posixsuite.py \
  --destdir obj.amd64/destdir.amd64 \
  --tooldir obj.amd64/tooldir.Linux-x86_64 --out posix.img
python3 releasetools/qemutest.py --iso minix_amd64.iso --suite posix \
  --drive posix.img --smp 2 --xfail releasetools/qemutest-posix.xfail
```

Una prueba que no compila es un resultado, no un error de compilación: lo
normal es que falte la interfaz que prueba. Esas pruebas cuentan como
`nobuild` y los errores del compilador van a `posix.img.log`. Usa
`--tests interfaces/mmap` para ejecutar un área concreta. Resultado actual:
{{posixPassed}} de {{posixTotal}}. No está en la CI, así que lánzala tú cuando
cambies libc, PM, VFS, VM, señales o hilos.

## Ejecutar las pruebas a mano

Dentro de un sistema en marcha, las pruebas están en `/usr/tests/minix-posix` y
las dirige el script `run` (`./run -l` las lista, `./run -t '1 2 3'` ejecuta
algunas, `-T` produce TAP). En el CD live, cópialas antes a un disco RAM, igual
que hace `qemutest.py`:

```sh
ramdisk 131072 /dev/ram4
mkfs.mfs /dev/ram4
mount /dev/ram4 /mnt
(cd /usr/tests/minix-posix && pax -rw . /mnt)
cd /mnt
./run -t '1 2 3 sh1'
```

pjdfstest está en `/usr/tests/pjdfstest`; sus scripts se ejecutan uno a uno con
`sh`, desde el directorio `tests` de una copia en un sistema de ficheros
escribible.

La batería `kyua` necesita `/usr/bin/kyua` y `/usr/tests/Kyuafile`, que vienen
con el conjunto `tests` al estilo NetBSD. Ese conjunto está en la imagen de
disco (`amd64_hdimage.sh`) pero no en la ISO por defecto. Allí, lanza
`cd /usr/tests && kyua test`. Todavía no hay resultados de kyua publicados.

## Integración continua

[`.github/workflows/ci.yml`]({{repo}}/blob/{{branch}}/.github/workflows/ci.yml)
se ejecuta en cada push a `devel` y `master`, en cada pull request y a
petición manual. Una ejecución manual puede elegir TCG en lugar de KVM.

**Trabajo de compilación** (Ubuntu 24.04, 4 trabajos en paralelo): recupera la
toolchain cruzada de la caché (con clave según el hash de `build.sh`,
`tools/`, `share/mk/`, LLVM y make), la construye si falta (unas 2 horas),
compila la release con `MKLLVMCMDS=no` (unas 2 h 15 min), genera una ISO BIOS
con `UEFI=no` y sube dos artefactos que se guardan 7 días: `minix_amd64.iso` y
`kernel-elf`, el núcleo sin recortar.

**Trabajos de prueba**: ocho en paralelo, cada uno en un runner limpio con KVM.
Todos arrancan primero la ISO, así que una regresión de arranque aparece en
todos en pocos minutos, y luego ejecutan su parte:

| Trabajo | Batería | CPU |
|---|---|---|
| quick 1/4 … 4/4 | `quick`, en cuatro partes | 1 |
| pjdfstest 1/2, 2/2 | `pjdfstest`, en dos partes | 1 |
| quick 1/1 smp2 | `quick` | 2 |
| pjdfstest 1/1 smp2 | `pjdfstest` | 2 |

Cada parte tarda unos diez minutos con KVM (de 40 a 70 minutos con TCG). Todos
los trabajos suben su `qemutest-logs` como artefacto, también cuando fallan.
Los trabajos SMP son los que ejercitan en cada pull request los cerrojos del
núcleo, las IPI y los temporizadores por CPU.

Para reproducir un fallo de la CI, descarga la ISO y el núcleo de esa ejecución
y lanza la misma parte en local con los mismos ficheros `--xfail` y `--kernel`.

## Herramientas de desarrollo

[`releasetools/devtools/`]({{repo}}/blob/{{branch}}/releasetools/devtools/README.md)
tiene utilidades basadas en `qemutest.py` para cuando una prueba no basta:

| Herramienta | Uso |
|---|---|
| `runcmd.py ISO LOGDIR CMD` | Arranca, entra, prepara las pruebas, ejecuta una orden y muestra su salida |
| `hold.py ISO LOGDIR SMP CMD` | Como `runcmd`, y después mantiene el invitado en marcha: las órdenes que escribas en `LOGDIR/cmd` se ejecutan dentro |
| `bootonly.py ISO LOGDIR [SECS]` | Arranca sin entrar y mantiene QEMU en marcha, para una consola que nunca llega al login |
| `kmsg.py QMPSOCK KERNEL` | Vuelca el anillo de mensajes del núcleo de un invitado en marcha |
| `keys.py QMPSOCK KEY ...` | Envía pulsaciones, por ejemplo `f1` o `shift+f3` para los volcados de IS |
| `qmpcmd.py QMPSOCK CMD` | Ejecuta una orden QMP o HMP |
| `bootloop.py` | Arranca una y otra vez para cazar cuelgues de arranque raros |
| `stress.py --iso ISO --minutes N --log-dir D` | Prueba de estrés larga de fork/exec/IPC con detección de cuelgues |
| `powercut.py ISO LOGDIR HOW TAG` | Escribe datos, corta la corriente y comprueba qué llegó a la imagen de disco |
| `netbench.py ISO` | Rendimiento TCP entre dos invitados por un enlace con latencia añadida |
| `deskcheck.py`, `guidrv.py` | Prueba básica del escritorio y manejo de la interfaz gráfica (UEFI, imagen `MKDESKTOP`) |
| `relink_desktop.sh` | Vuelve a enlazar los programas estáticos del escritorio tras un cambio de ABI de libc |

Detén los invitados por su PID, nunca con `pkill -f`: también coincide con la shell
que ejecuta la orden.

## Depuración

{{name}} **todavía no tiene depurador**: no hay gdb ni lldb en el árbol. Lo que
tienes:

- **La consola serie.** La segunda entrada del menú de arranque, *serial
  console, verbose*, arranca con `console=tty00 verbose=3`: todos los mensajes
  del núcleo y del arranque van al puerto serie, con más detalle. En QEMU añade
  `-serial stdio` (o `-serial file:boot.log`).
- **Volcados de IS.** El servidor de información imprime tablas del sistema
  cuando pulsas una tecla de función en la consola. La salida va al registro
  de mensajes del núcleo.

  | Tecla | Volcado |
  |---|---|
  | <kbd>F1</kbd> | Tabla de procesos del núcleo |
  | <kbd>F4</kbd> | Privilegios de los procesos |
  | <kbd>F6</kbd> | Hooks y políticas de IRQ |
  | <kbd>F8</kbd> | Estado de VM y mapas de los procesos |
  | <kbd>Mayús</kbd>+<kbd>F1</kbd> | Tabla de procesos de PM |
  | <kbd>Mayús</kbd>+<kbd>F3</kbd> | Tabla de procesos de VFS: en qué está bloqueado cada proceso |
  | <kbd>Mayús</kbd>+<kbd>F4</kbd> | Correspondencia entre dispositivos y drivers |
  | <kbd>Mayús</kbd>+<kbd>F6</kbd> | Tabla de servicios de RS |
  | <kbd>Mayús</kbd>+<kbd>F9</kbd> | Procesos con sus trazas de pila |

  En QEMU, envía las teclas con `sendkey f1` en el monitor o con
  `devtools/keys.py`. `qemutest.py --kernel` lo hace solo cuando una prueba se
  cuelga.
- **Símbolos.** Guarda el núcleo sin recortar de la compilación. Para convertir
  una dirección de un pánico o de un cuelgue en una función:
  `nm -n obj.amd64/minix/kernel/kernel | awk '$1 <= "ADDR"' | tail -1`
  (con `ADDR` en la misma forma hexadecimal de 16 dígitos que imprime `nm`).
- **Traza de llamadas al sistema.** `trace(1)` muestra las llamadas que hace un
  programa. Se basa en `ptrace`, que aún tiene fallos conocidos (prueba 42).
- **printf.** Servidores y drivers escriben en la consola con `printf`. Es
  rudimentario y muchas veces lo más rápido.

## Para saber más

- Notas sobre la batería de pruebas de MINIX 3:
  <https://wiki.minix3.org/doku.php?id=developersguide:testsuite>
