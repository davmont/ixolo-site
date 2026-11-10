---
title: "Servicios y el Reincarnation Server"
description: "Cómo se arrancan, vigilan y reinician los servicios del sistema, y dónde encajan los demonios normales."
sidebar:
  order: 1
---

{{name}} ejecuta dos tipos distintos de programas en segundo plano, y cada uno
se gestiona con un mecanismo diferente. Saber cuál es cuál ahorra muchas
confusiones.

| | Servicios del sistema | Demonios |
|---|---|---|
| Ejemplos | `vfs`, `pm`, `mfs`, `e1000`, `ahci`, `lwip`, `tty` | `sshd`, `syslogd`, `cron`, `inetd`, `dhcpcd` |
| Qué son | El propio sistema operativo: servidores y drivers en modo usuario | Programas Unix normales |
| Los arranca | El Reincarnation Server (RS), a petición de `minix-service` | `/etc/rc` y los scripts de `/etc/rc.d` |
| Privilegios | `/etc/system.conf` y `/etc/system.conf.d/` | El ID de usuario, como en cualquier Unix |
| Se reinician si fallan | Sí, los reinicia RS | No |
| Se controlan con | `minix-service up/down/refresh ...` | `service sshd start`, `/etc/rc.d/sshd stop` |

## Los servicios del sistema y RS

En un sistema de microkernel, los sistemas de ficheros, la pila de red y cada
driver son procesos separados. El Reincarnation Server (RS) es quien los
arranca, les da sus privilegios y los vigila. Si uno muere, RS arranca una
copia nueva. La [página de arquitectura](/es/docs/learn/architecture/) explica
por qué el sistema está hecho así; esta página explica cómo manejarlo.

Los primeros servicios (`rs`, `vm`, `pm`, `sched`, `vfs`, `ds`, `tty`,
`memory`, `mib`, `pfs`, el sistema de ficheros del ramdisk de arranque e
`init`) van en la imagen de arranque. Todos los demás los arrancan después los
scripts de arranque con `minix-service`.

### La orden minix-service

`/sbin/minix-service` envía peticiones a RS. En MINIX original se llamaba
`service`; en {{name}} el nombre `service` es la orden de NetBSD que ejecuta
los scripts de rc.d (ver [más abajo](#demonios-rcd-y-rcconf)).

| Orden | Qué hace RS |
|---|---|
| `minix-service up /service/<binario> [opciones]` | Arranca un servicio nuevo y lo reinicia si muere. La ruta debe ser absoluta. |
| `minix-service run /service/<binario> [opciones]` | Lo arranca, pero no lo reinicia cuando termina. Para programas de vida corta que necesitan privilegios de servicio. |
| `minix-service down <etiqueta>` | Para el servicio y no lo reinicia. Los servicios críticos se niegan. |
| `minix-service refresh <etiqueta>` | Mata el servicio y arranca una copia nueva. |
| `minix-service restart <etiqueta>` | Reinicia un servicio que ya ha terminado. Solo vale desde un script de recuperación. |
| `minix-service edit <binario> -label <etiqueta> [opciones]` | Cambia la configuración de un servicio en marcha, también los de la imagen de arranque. |
| `minix-service clone <etiqueta>` | Guarda una copia de reserva del servicio, que se usa para reiniciarlo. |
| `minix-service update <binario> [opciones]` | Actualización en caliente: sustituye un servicio en marcha por un binario nuevo. Ver [actualización en caliente](#actualización-en-caliente). |
| `minix-service shutdown` | Avisa a RS de que el sistema se apaga, para que no reinicie nada. |

Las opciones de `up` (y de `run`, `edit` y `update`):

| Opción | Significado |
|---|---|
| `-label <nombre>` | Nombre que identifica al servicio. Por defecto, el nombre del programa. |
| `-args "<args>"` | Argumentos de línea de órdenes para el servicio. |
| `-dev <especial>` | Fichero de dispositivo que atiende el driver, por ejemplo `-dev /dev/random`. |
| `-period <ticks>` | Periodo del latido. Añade `HZ` para expresarlo en segundos: `-period 5HZ`. |
| `-script <ruta>` | Script de recuperación que se ejecuta en lugar de un reinicio simple. |
| `-config <ruta>` | Lee los privilegios de este fichero en vez de `/etc/system.conf`. |
| `-c` | Guarda una copia del binario en memoria y reinicia desde ella, no desde disco. Necesario para el driver de disco. |
| `-n` | Vuelve enseguida, sin esperar a que el servicio termine de inicializarse. |
| `-b` | Reinicia sin el retardo creciente (ver [política de reinicio](#cómo-vigila-rs-un-servicio)). |
| `-p` | Mantiene una réplica en segundo plano y reinicia desde ella. |

Ejemplos, sacados de los scripts de arranque:

```sh
minix-service up /service/random -dev /dev/random -period 3HZ
minix-service up /service/is -period 5HZ
minix-service down usbd
```

Los binarios de los servicios están en `/service`. La referencia completa está
en `man minix-service` y `man system.conf`.

### /etc/system.conf: mínimo privilegio

Cada servicio recibe solo los privilegios que aparecen en su entrada `service`.
Los servicios de arranque están en `/etc/system.conf`; cada driver instala su
propio fichero en `/etc/system.conf.d/`, con el nombre del programa. Esta es la
entrada del driver de red de Intel, `/etc/system.conf.d/e1000`:

```text
service e1000
{
	type net;
	descr "Intel PRO/1000 Gigabit";
	system
		UMAP            # 14
		IRQCTL          # 19
		DEVIO           # 21
	;
	pci device      8086:100e;
	pci device      8086:100f;
	# ... más IDs de dispositivo ...
	ipc
		SYSTEM pm rs log tty ds vm
		pci inet lwip ;
};
```

El driver puede hacer tres llamadas al núcleo, hablar solo con los procesos de
la lista y tocar solo los dispositivos PCI con esos IDs. No puede abrir
ficheros, tocar otros dispositivos ni mandar mensajes al driver de disco.

| Clave | Significado | Por defecto |
|---|---|---|
| `uid` | ID de usuario con el que se ejecuta. | `service` (uid 12) |
| `ipc` | Procesos a los que puede enviar mensajes: `ALL`, `ALL_SYS` (sin procesos de usuario), `NONE` o una lista de nombres de programa. `SYSTEM` es el núcleo y `USER`, los procesos de usuario. | `ALL_SYS` |
| `system` | Llamadas al núcleo permitidas: `ALL`, `BASIC`, `NONE` o una lista. | `BASIC` |
| `vm` | Llamadas a VM permitidas, con las mismas formas que `system`. | `BASIC` |
| `io` | Rangos de puertos de E/S, `base:longitud`. | `NONE` |
| `irq` | Líneas de interrupción. | `NONE` |
| `pci device` | IDs PCI `fabricante:dispositivo` que puede reclamar, opcionalmente con `/subfabricante:subdispositivo`. | ninguno |
| `pci class` | Clases PCI que puede reclamar, `clase/subclase/progif`. | ninguna |
| `sigmgr` | Qué servicio gestiona sus señales (normalmente `rs`). | ver `<minix/priv.h>` |
| `scheduler` | `KERNEL` o la etiqueta de un planificador (normalmente `sched`). | ver `<minix/priv.h>` |
| `priority`, `quantum` | Cola de planificación y rodaja de tiempo en ms. | ver `<minix/priv.h>` |
| `control` | Otros servicios que pueden pedir a RS que actúe sobre este. | ninguno |
| `type`, `descr` | Tipo de servicio (`net` para drivers de red) y una descripción. | ninguno |

`/etc/rc.minix` aplica `/etc/system.conf` a los servicios de arranque durante
el inicio (`minix-service edit`), así que los cambios en sus entradas se notan
en el siguiente arranque. Para un driver que arrancas tú, edita su fichero en
`/etc/system.conf.d/` y vuelve a arrancarlo.

## Cómo vigila RS un servicio

RS se entera de un fallo de tres maneras:

- **El proceso muere.** Un cuelgue, un `panic` o una señal fatal (`kill -9`
  incluida) terminan el proceso, y RS recibe el aviso.
- **Falta el latido.** A un servicio arrancado con `-period` RS le manda un
  ping en cada periodo. Si no ha contestado tras dos periodos, RS lo mata y lo
  trata como caído. Los drivers de red se arrancan con `-period 5HZ`, y
  `random` con `3HZ`.
- **Tiempo de arranque agotado.** Un servicio tiene 10 segundos para terminar
  de inicializarse.

Qué pasa después:

1. La primera salida inesperada se reinicia al momento.
2. Las salidas repetidas se reinician tras un retardo que se dobla cada vez (2,
   4, 8, 16 s), hasta 30 s. `-b` quita el retardo; un servicio que se reinicia
   desde una copia en memoria (`-c`) espera como mucho un segundo.
3. Si el servicio tiene un script de recuperación (`-script`), RS lo ejecuta en
   su lugar, con la etiqueta, el motivo (`terminated`, `no-heartbeat` o
   `restart`) y el número de reinicios como argumentos. El script decide qué
   hacer.
4. Si muere un servicio *crítico* (marcado así en la imagen de arranque), el
   sistema no puede seguir y entra en pánico.

La pila de red es un buen ejemplo de script de recuperación. `lwip` se ejecuta
con `-script /etc/rs.lwip`. Ese script vuelve a levantar `lwip` y después
reinicia todos los demonios de red de `/etc/rc.d` (`dhcpcd`, `sshd`, `inetd`,
`syslogd`...), porque sus sockets murieron con la pila anterior.
`/etc/rs.single` es lo contrario: simplemente da de baja el servicio; es el que
usa `minix-service run`.

Para ver un reinicio en directo, sigue el
[laboratorio de romper un driver](/es/docs/learn/lab-break-a-driver/).

## Qué se está ejecutando y qué ha registrado RS

```sh
ls /proc/service                 # un fichero por etiqueta de servicio
cat /proc/service/e1000_0        # programa, endpoint, pid, reinicios, flags
ps -ax                           # los servicios aparecen como procesos normales
```

`/proc/service/<etiqueta>` tiene una línea `restarts:`: un valor distinto de
cero significa que el servicio ha caído y se ha sustituido desde el arranque.

RS y los demás servicios escriben sus mensajes en la consola. El driver `log`
los guarda también en `/dev/klog`, que `syslogd` (activo por defecto) copia en
`/var/log/messages`:

```sh
grep RS: /var/log/messages
```

Para más detalle, añade `rs_verbose=1` a los parámetros de arranque. En la
consola, el servidor de información `is` vuelca tablas internas con las teclas
de función: F1 la tabla de procesos del núcleo, F4 los privilegios, F7 los
mensajes del núcleo y Mayús+F6 la tabla de RS.

## Demonios: rc.d y rc.conf

Todo lo que no es un servicio del sistema operativo se arranca al estilo
NetBSD. `init` ejecuta `/etc/rc`, que ejecuta los scripts de `/etc/rc.d` en el
orden que `rcorder` deduce de sus líneas `REQUIRE` y `PROVIDE`. El primer
script, `minixrc`, ejecuta `/etc/rc.minix`. Ese script arranca los primeros
servicios del sistema, comprueba y monta los sistemas de ficheros de
`/etc/fstab` y arranca `usbd` y `devmand`. Después `/usr/etc/rc` arranca los
drivers de red, `lwip`, `pty`, `uds` y `log`.

Qué demonios se ejecutan se decide en `/etc/rc.conf`. Los valores por defecto
están en `/etc/defaults/rc.conf` (el de NetBSD) y en
`/etc/defaults/minix.rc.conf`. No edites los valores por defecto;
sobrescríbelos en `/etc/rc.conf`:

```sh
# /etc/rc.conf
sshd=YES
dhcpcd=YES
```

Algunos valores por defecto que conviene conocer:

| Variable | Por defecto | Efecto |
|---|---|---|
| `syslogd` | `YES` | Registro del sistema en `/var/log/messages`. |
| `cron` | `YES` | Tareas periódicas. |
| `inetd` | `YES` | Superservidor de Internet. |
| `certctl_init` | `YES` | Rellena `/etc/openssl/certs` en el primer arranque. |
| `sshd` | `NO` | Servidor OpenSSH. Ver [seguridad](/es/docs/admin/security/). |
| `dhcpcd` | `NO` | Cliente DHCP como demonio. `netconf` también puede arrancarlo por interfaz. |
| `named` | `NO` | Servidor DNS BIND. |
| `wlcompd`, `fbcompd` | `NO` | Compositores gráficos. Ver [escritorio](/es/docs/admin/desktop/). |

Arranca, para y consulta los demonios a mano con `service` o con el propio
script:

```sh
service sshd start
service sshd status
/etc/rc.d/sshd restart
service sshd onestart     # ejecutarlo una vez aunque sshd=NO
service -e                # lista los scripts activados
```

Un demonio que se cae se queda caído: RS no vigila los demonios.

## Actualización en caliente

`minix-service update` pide a RS que sustituya un servicio en marcha por un
binario nuevo conservando su estado, sin reiniciar el sistema. Viene de MINIX 3
original, donde era una función de investigación: experimental, documentada
como "en una fase temprana de desarrollo" y solo en i386. Las actualizaciones
con estado necesitan además una compilación instrumentada especial
(`MKMAGIC`), que no se ha probado en amd64.

En {{name}} **no está soportada**. La prueba de actualización en caliente de
upstream, `testrelpol`, es un fallo conocido en amd64. La orden sigue ahí, pero
no te fíes de ella en un sistema que te importe. El reinicio (`refresh`) sí
funciona, y es lo que hace RS tras un fallo.

## Para saber más

- `man minix-service`, `man system.conf`, `man rc.conf`, `man service`
- [La arquitectura en cuatro capas](/es/docs/learn/architecture/)
- Contexto en upstream (no específico de {{name}}):
  [fiabilidad](https://wiki.minix3.org/doku.php?id=www:documentation:reliability),
  [actualización en caliente](https://wiki.minix3.org/doku.php?id=developersguide:liveupdate)
