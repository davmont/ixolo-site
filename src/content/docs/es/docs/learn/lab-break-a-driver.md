---
title: "Laboratorio: rompe un driver"
description: "Práctica: tumba los drivers de red y de disco de un {{name}} en marcha y observa cómo se repara solo."
sidebar:
  order: 4
---

En este laboratorio vas a tumbar, a propósito, drivers de un sistema {{name}}
en marcha, y a comprobar que el sistema se da cuenta y se repara mientras tus
programas siguen funcionando. Después buscarás los límites: un servicio que
no se reinicia y un servidor cuya caída detiene la máquina.

Lee antes [Aislamiento y autorreparación](/es/docs/learn/reliability/), o
tenlo abierto al lado. Calcula una hora.

:::note[Qué se ha comprobado y qué no]
Todas las órdenes, ficheros y etiquetas de esta página se han comprobado con
el código fuente de {{name}}. La **salida** que se muestra no se ha capturado
de un sistema en marcha para esta página: donde pone «algo parecido a», el
texto sale de las llamadas a `printf` del código, y los números exactos serán
otros. Si ves algo distinto, merece la pena contarlo en el
[gestor de incidencias]({{issues}}).
:::

## 0. Preparación

Arranca la ISO live en QEMU como en la [guía rápida](/es/docs/start/quickstart/),
con BIOS (no UEFI) y el tipo de máquina por defecto. Así tendrás una tarjeta
de red Intel e1000 y un lector de CD IDE, que son los drivers que usa este
laboratorio:

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -cdrom {{iso}}
```

Entra como `root`. Te vendrán bien dos terminales: la consola tiene cuatro,
cambias entre ellas con **Alt+F1** a **Alt+F4** (o Alt+Izquierda y
Alt+Derecha). Si la ventana de QEMU se queda esas teclas, lanza las órdenes
largas en segundo plano con `&`.

**Opcional: haz que RS hable.** Por defecto, el Reincarnation Server reinicia
los servicios en silencio. Si añades `rs_verbose=1` a la línea de órdenes del
núcleo (elige *Edit menu option* en el menú de arranque), RS imprime una línea
que empieza por `RS:` en cada paso de un reinicio. El parámetro se lee en
[`rs/main.c`]({{repo}}/blob/{{branch}}/minix/servers/rs/main.c); no lo hemos
probado en la ISO live.

## 1. Encuentra el driver

Cada servicio del sistema tiene una **etiqueta** y una entrada en
`/proc/service`:

```sh
ls /proc/service
```

Busca `e1000_0` (la primera tarjeta e1000) y tu driver de disco, que en la
máquina QEMU por defecto es `at_wini_0`. Lee la entrada del driver de red:

```sh
cat /proc/service/e1000_0
```

```text
filename: e1000
endpoint: 72
pid:      46
restarts: 0
flags:    A--------
policies: reset
ASRcount: 0
```

Algo parecido a eso: los números serán otros. Apunta los valores de
`endpoint`, `pid` y `restarts`. La política `reset` significa «los reinicios
se notan y el endpoint cambia». El driver también es un proceso normal:

```sh
ps -ax | grep e1000
```

Preguntas para tus notas: ¿qué PID y qué padre tiene? Busca
`/etc/system.conf.d/e1000`: ¿qué llamadas al núcleo puede hacer este driver?

## 2. Pon tráfico en marcha

Comprueba que la interfaz de red (`em0`, el nombre que le da el driver e1000)
tiene dirección. La red integrada de QEMU reparte `10.0.2.15`:

```sh
ifconfig em0
```

Si no aparece una línea `inet`, pide una dirección por DHCP:

```sh
dhcpcd em0
```

En la segunda consola (Alt+F2, vuelve a entrar como root), lanza un ping a la
pasarela de QEMU y déjalo corriendo:

```sh
ping 10.0.2.2
```

Cada línea de respuesta lleva un número `icmp_seq`. Un salto en esos números
indica paquetes perdidos.

Para una prueba mejor, mantén también una transferencia TCP. En el
**anfitrión**, sirve un fichero grande:

```sh
dd if=/dev/urandom of=big.bin bs=1M count=500
python3 -m http.server 8000
```

y descárgalo en el invitado, tirando los datos:

```sh
ftp -o /dev/null http://10.0.2.2:8000/big.bin
```

## 3. Mata el driver de red

De vuelta en la primera consola, mata el driver con el PID que encontraste:

```sh
kill -9 46
```

Eres root, así que está permitido: PM pasa el `SIGKILL` al núcleo, que se lo
entrega a RS, el gestor de señales del driver. RS ve que el driver ha muerto y
arranca una copia nueva enseguida. Compruébalo:

```sh
cat /proc/service/e1000_0
ps -ax | grep e1000
```

Deberías ver un `pid` nuevo, un `endpoint` nuevo y `restarts: 1`. Salvo que
activaras `rs_verbose`, RS no imprime nada.

Mira ahora el ping y la descarga. Espera un pequeño salto en `icmp_seq` y un
breve parón en la transferencia mientras TCP retransmite; después, los dos
siguen. La pila de red (`lwip`) se enteró del driver nuevo por DS, el almacén
de datos, y volvió a configurar la tarjeta.

## 4. Túmbalo desde dentro

`kill -9` para el driver desde fuera. Para que falle como lo haría un driver
con un error, pide a RS que le inyecte una caída. El driver llama entonces él
mismo a `panic()`:

```sh
minix-service fi e1000_0
```

Esta vez la consola muestra las últimas palabras del driver, algo parecido a:

```text
e1000(72): panic: Crash!
syslib:panic.c: stacktrace: 0x... 0x... 0x...
```

(el formato está en
[`libsys/panic.c`]({{repo}}/blob/{{branch}}/minix/lib/libsys/panic.c)).
Vuelve a mirar `/proc/service/e1000_0`: `restarts` ha subido.

Repítelo cuatro o cinco veces seguidas y mide cuánto tarda el driver en
volver. RS espera más tras cada fallo (2, 4, 8, 16 segundos, como mucho 30)
para que un driver que falla en cada arranque no pueda tener ocupada la
máquina. Mientras espera, puede que la entrada no aparezca en `/proc/service`.

## 5. Un driver de disco

Ahora, el driver que hay debajo del sistema de ficheros raíz. En la ISO live
la raíz es el propio CD, leído a través de `isofs` y del driver `at_wini_0`
(`ahci_0` en una máquina `q35`). `/tmp`, `/var` y `/root` son discos RAM que
sirve `memory`; **no** mates `memory`, es un servicio esencial.

```sh
cat /proc/service/at_wini_0
kill -9 <su pid>
ls -lR /usr/share > /dev/null && echo sigo leyendo
```

Los drivers de disco se arrancan con una copia en memoria de su binario
(`minix-service -c`), así que RS puede reiniciarlos sin leer el disco que
controlan. La capa de bloques del sistema de ficheros ve fallar la petición
con el driver viejo, espera al endpoint nuevo y la repite. El `ls` debería
terminar, quizá tras una pausa.

:::caution
Este caso es más arriesgado que el de la red. Si el sistema se cuelga, es un
hallazgo real: apunta lo que hiciste y reinicia la máquina virtual. Es más
seguro todavía en un sistema instalado en una imagen de disco desechable.
:::

## 6. Cuando el sistema no se repara

**Un servicio al que se le dice que se quede parado.** `minix-service down`
para un servicio a propósito, y RS no lo reinicia:

```sh
minix-service down e1000_0
ls /proc/service | grep e1000
ifconfig -a
```

El ping deja de recibir respuestas, y el resto del sistema sigue
funcionando. Recupera el driver con la misma orden que usa `/usr/etc/rc` al
arrancar, y vuelve a lanzar `dhcpcd em0` si se ha perdido la dirección:

```sh
minix-service up /service/e1000 -label e1000_0 -args instance=0 -period 5HZ
```

Lo mismo pasa con los servicios arrancados con `minix-service run`, que usa
el script de recuperación `/etc/rs.single` para parar el servicio en lugar de
reiniciarlo.

**Un servidor esencial.** Haz esto lo último: se espera que detenga la
máquina. Busca el PID de `vfs` con `ps -ax` y mátalo:

```sh
kill -9 <pid de vfs>
```

RS arranca la copia de reserva de VFS, pero VFS pide un reinicio *con
estado*, y `libsys` lo rechaza porque la caída no fue controlada. Según el
código, deberías ver algo parecido a:

```text
SEF(1): crash was not controlled, aborting transparent restart
core system service died: ...
```

y después el sistema se detiene. VFS guarda todos los ficheros abiertos de
todos los procesos; una copia nueva no conocería ninguno.

## Preguntas

1. Tras el paso 3, el driver tenía un endpoint nuevo. ¿Por qué no puede la
   pila de red seguir usando el viejo? ¿Qué fallaría si los endpoints fueran
   simples números de ranura? (Consulta
   [Paso de mensajes](/es/docs/learn/message-passing/#endpoints).)
2. ¿Por qué TCP sobrevivió a la caída del driver, mientras que una caída de
   la propia `lwip` (lee [`/etc/rs.lwip`]({{repo}}/blob/{{branch}}/etc/rs.lwip))
   pierde todas las conexiones abiertas?
3. En un núcleo monolítico, ¿qué pasaría probablemente si el driver de red
   desreferenciara un puntero incorrecto? ¿Qué lo ha impedido aquí?
4. ¿Por qué se arrancan los drivers de disco con `-c`? ¿Qué pasaría sin esa
   opción, si el binario del driver está en el disco que controla?
5. ¿Por qué espera RS cada vez más tras cada caída? Pon un ejemplo de fallo
   en el que reiniciar al instante y para siempre sería perjudicial.
6. Prueba `kill -9` con los PID de `pm` y de `vm`. Lee `check_sig()` y
   `sig_proc()` en
   [`minix/servers/pm/signal.c`]({{repo}}/blob/{{branch}}/minix/servers/pm/signal.c):
   ¿qué hace el código en cada caso, y por qué?
7. ¿Qué recuperación es *transparente* (los programas no lo notan) y cuál es
   solo *visible pero superable*? Usa tus notas de los pasos 3 a 6.
8. La actualización en caliente sustituiría un driver por una versión nueva sin
   reiniciarlo. ¿Qué problema adicional tiene que resolver que un reinicio no
   tiene?

## Para saber más

- J. N. Herder et al., *Failure Resilience for Device Drivers*, DSN 2007:
  <http://www.minix3.org/docs/jorrit-herder/dsn-dccs07.pdf>
- La visión general de la fiabilidad de la wiki original (en inglés):
  <https://wiki.minix3.org/doku.php?id=www:documentation:reliability>
- [`minix-service(8)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/minix-service.8)
  y el código de RS en
  [`minix/servers/rs/`]({{repo}}/blob/{{branch}}/minix/servers/rs/).
