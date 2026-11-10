---
title: Aislamiento y autorreparación
description: Cómo limita {{name}} lo que puede hacer cada driver, cómo reinicia el Reincarnation Server los servicios que fallan y dónde deja de funcionar la recuperación.
sidebar:
  order: 3
---

Un microkernel, por sí solo, no hace fiable un sistema. Sacar un driver a un
proceso de usuario solo sirve si ese proceso además está **limitado** en lo
que puede tocar, y si algo **se da cuenta y lo repara** cuando falla. En
{{name}}, como en MINIX 3, lo primero es tarea del núcleo y de
`/etc/system.conf`, y lo segundo del Reincarnation Server (RS).

Esta página explica las dos cosas y es sincera sobre dónde deja de funcionar
la recuperación.

## Mínimo privilegio

Cada servicio del sistema funciona con el conjunto de derechos más pequeño
que necesita. RS lee esos derechos de `/etc/system.conf` y de los ficheros de
`/etc/system.conf.d/` al arrancar el servicio, y se los comunica al núcleo.
Esta es la entrada real del driver de red de Intel,
[`minix/drivers/net/e1000/e1000.conf`]({{repo}}/blob/{{branch}}/minix/drivers/net/e1000/e1000.conf),
resumida:

```text
service e1000
{
        type net;
        system
                UMAP            # 14
                IRQCTL          # 19
                DEVIO           # 21
        ;
        pci device      8086:100e;
        pci device      8086:100f;
        ...
        ipc
                SYSTEM pm rs log tty ds vm
                pci inet lwip ;
};
```

Cada sección es un tipo de permiso:

| Palabra clave | Qué limita | Quién lo hace cumplir |
|---|---|---|
| `system` | Qué llamadas al núcleo puede hacer el servicio. El driver e1000 puede traducir direcciones (`UMAP`), gestionar su interrupción (`IRQCTL`) y hacer E/S por puertos (`DEVIO`), y nada más: no puede, por ejemplo, crear procesos ni cambiar tablas de páginas. | núcleo |
| `ipc` | A qué procesos puede enviar mensajes. El driver puede hablar con la pila de red, pero no con VFS ni con un driver de disco. | núcleo |
| `io`, `irq` | Qué rangos de puertos de E/S y qué líneas de interrupción puede usar (para dispositivos tipo ISA; `at_wini` declara `1f0:8`, la IRQ 14, etc.). | núcleo |
| `pci device`, `pci class` | Qué dispositivos PCI puede reclamar. Su memoria y su interrupción se conceden a partir de ahí. | driver PCI |
| `vm` | Qué llamadas especiales al servidor VM puede hacer. | VM |
| `uid` | El usuario con el que se ejecuta el servicio. | PM, VFS |

La sintaxis está documentada en
[`system.conf(5)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/system.conf.5).
El núcleo comprueba las máscaras `system` e `ipc` en cada llamada, así que un
driver que cae en manos de un error o de un atacante sigue sin poder enviar
un mensaje a un proceso con el que no tenía permiso para hablar.

Los programas de usuario tienen todavía menos: solo pueden usar `sendrec`, es
decir, pueden llamar a un servidor y esperar la respuesta, pero no enviar
mensajes por su cuenta.

La memoria se protege igual. Un driver no puede leer la memoria de otro
proceso salvo que ese proceso cree una **concesión** (*grant*) para ese rango
exacto de bytes. Consulta
[Paso de mensajes](/es/docs/learn/message-passing/#concesiones-de-memoria-y-copias-seguras).

## El Reincarnation Server

RS ([`minix/servers/rs/`]({{repo}}/blob/{{branch}}/minix/servers/rs/)) es el
padre de todos los drivers y servidores. Los scripts de arranque nunca
ejecutan un driver directamente; llaman a `minix-service up`, que se lo pide a
RS:

```sh
minix-service up /service/e1000 -label e1000_0 -args instance=0 -period 5HZ
```

`-label` da nombre a la instancia; `-period 5HZ` activa un latido cada cinco
segundos; `-c` (que usan los drivers de disco) guarda una copia del binario
en memoria para que RS pueda reiniciar el driver aunque no se pueda leer el
disco en el que está; y `-script` delega la recuperación en un script de
shell. Todas las opciones están en
[`minix-service(8)`]({{repo}}/blob/{{branch}}/minix/commands/minix-service/minix-service.8).

RS vigila dos tipos de fallo:

- **Caídas.** Cuando un servicio muere (un fallo de segmentación, un
  `panic()`, un `SIGKILL`), el núcleo entrega la señal a RS en lugar de a PM.
  RS marca el servicio como terminado y empieza la recuperación.
- **Bloqueos.** Si el servicio tiene un periodo, RS le envía una notificación
  en cada periodo. La biblioteca del servicio responde automáticamente desde
  su bucle de mensajes. Si pasado el doble del periodo no ha llegado
  respuesta, RS mata el servicio y lo trata como una caída. Así, un driver
  atrapado en un bucle infinito no se queda atrapado.

### Qué hace RS cuando algo falla

La lógica está en `terminate_service()` y `restart_service()`, en
[`manager.c`]({{repo}}/blob/{{branch}}/minix/servers/rs/manager.c):

1. Si el servicio se arrancó con un script de recuperación, RS ejecuta el
   script pasándole la etiqueta, el motivo (`terminated`, `no-heartbeat` o
   `restart`) y el número de reinicios hasta ahora, y deja que decida él.
   [`/etc/rs.lwip`]({{repo}}/blob/{{branch}}/etc/rs.lwip), por ejemplo,
   reinicia la pila TCP/IP y después todos los demonios de red, porque sus
   sockets murieron con ella.
2. Si no, la primera vez RS lo reinicia en el acto desde el mismo binario (o
   desde la copia en memoria).
3. Si el servicio ya había fallado antes, RS espera primero: 2 segundos tras
   el segundo fallo, luego 4, 8, 16, y como mucho 30. Esta **espera
   exponencial binaria** impide que un driver que falla en cada arranque se
   coma la máquina. `minix-service up -b` la desactiva.
4. Si el servicio falla mientras todavía se está inicializando, RS se rinde y
   lo deja parado. El resto del sistema sigue funcionando sin él.

Cuando la copia nueva está en marcha, RS publica su endpoint en DS, el
almacén de datos. Los servidores que dependen de drivers están suscritos a
esas entradas: VFS vigila `drv.blk.*` y `drv.chr.*`, la pila de red vigila
`drv.net.*`. DS les avisa de que el driver tiene un endpoint nuevo y ellos
reenvían lo que estuviera en curso.

DS también puede guardar pequeñas cantidades de estado (números, cadenas,
bloques de memoria) bajo un nombre, para que un componente reiniciado retome
el trabajo donde lo dejó el anterior. La guía original está en
<https://wiki.minix3.org/doku.php?id=developersguide:datastore> (en inglés).

## SEF: la parte del contrato que toca al servicio

Todos los servidores y drivers se enlazan con `libsys`, y su bucle principal
recibe los mensajes a través del **System Event Framework** (SEF,
[`minix/lib/libsys/sef*.c`]({{repo}}/blob/{{branch}}/minix/lib/libsys/)).
SEF intercepta los mensajes que llegan de RS antes de que los vea el
servicio, y llama a funciones del servicio cuando hace falta:

| Callback | Cuándo se ejecuta | Elección habitual |
|---|---|---|
| `sef_setcb_init_fresh` | Primer arranque | Detectar el hardware, publicar la etiqueta |
| `sef_setcb_init_restart` | Arranque tras una caída | Los drivers usan el valor por defecto: comportarse como un arranque nuevo con otro endpoint. VFS, PM, DS, MFS y otros servidores piden un reinicio *con estado* (ver más abajo) |
| `sef_setcb_init_lu` | Arranque como versión nueva en una actualización en caliente | Función de investigación, ver más abajo |
| `sef_setcb_ping_reply` | Latido de RS | Por defecto: responder en el acto |
| `sef_setcb_signal_handler` | Llega una señal como `SIGTERM` en forma de mensaje | Limpiar y salir |

Un driver al que le basta con un arranque nuevo apenas escribe nada: registra
una función de inicio, llama a `sef_startup()` y repite `sef_receive()` en un
bucle.

## Qué se recupera y qué no

| Falla… | Qué pasa | ¿Transparente para los programas? |
|---|---|---|
| Driver de red (e1000, igc…) | Se reinicia con un endpoint nuevo; la pila vuelve a inicializar la tarjeta | Casi. Se pierden unos pocos paquetes y TCP los retransmite |
| Driver de disco bajo un sistema de ficheros | Se reinicia (desde la copia en memoria); la capa de bloques del sistema de ficheros repite la petición | Sí, por diseño. Las peticiones se reintentan un número limitado de veces |
| Drivers de caracteres como `random`, `pty` o `log` | Se reinician | Depende del driver: los dispositivos abiertos pueden devolver errores |
| La pila de red (`lwip`) | `/etc/rs.lwip` la reinicia junto con los demonios de red | No. Se pierden todos los sockets abiertos |
| Un servidor de ficheros (MFS, isofs, pfs…) | Pide un reinicio con estado, que solo funciona tras una caída *controlada* | No |
| VFS, PM, VM, RS, `tty`, `memory`, el núcleo | El reinicio con estado se rechaza o ni se intenta | No: el sistema se detiene |

El motivo de las dos últimas filas: un servidor como VFS guarda el estado de
todos los ficheros abiertos de todos los procesos, y una copia nueva no
sabría nada de ellos. La investigación original creó una forma de copiar la
memoria de la instancia vieja en la nueva, pero solo se fía de esa memoria si
la caída fue *controlada*, es decir, provocada a propósito en un punto
conocido (por ejemplo con `minix-service fi <etiqueta>`). Tras una caída real,
`libsys` se niega con un mensaje como `crash was not controlled, aborting
transparent restart`, y entonces RS se detiene, porque no puede mantener el
sistema sin un servidor esencial. Recuperar los servidores esenciales de
caídas arbitrarias exige la instrumentación de *checkpointing* de las
versiones de investigación, que {{name}} no compila.

:::caution[Actualización en caliente]
MINIX 3 también puede sustituir un servicio en marcha por una versión nueva
sin pararlo, transfiriendo su estado automáticamente (`minix-service
update`). Es trabajo de investigación del proyecto original (la tesis de
Giuffrida, más abajo). Allí era experimental y solo para i386, y necesita una
compilación especial con instrumentación LLVM. En la rama de desarrollo amd64
de {{name}}, la prueba original que cubre las políticas de reinicio y la
actualización en caliente, `testrelpol`, es un **fallo conocido**. No cuentes con
la actualización en caliente.
:::

## Para saber más

- J. N. Herder, H. Bos, B. Gras, P. Homburg, A. S. Tanenbaum, *Failure
  Resilience for Device Drivers*, DSN 2007:
  <http://www.minix3.org/docs/jorrit-herder/dsn-dccs07.pdf>
- J. N. Herder et al., *Fault Isolation for Device Drivers*, DSN 2009:
  <http://www.minix3.org/docs/jorrit-herder/dsn-dccs09.pdf>
- J. N. Herder, D. C. van Moolenbroek et al., *Dealing with Driver Failures
  in the Storage Stack*, LADC 2009:
  <http://www.minix3.org/docs/jorrit-herder/ladc09.pdf>
- J. N. Herder, *Building a Dependable Operating System: Fault Tolerance in
  MINIX 3*, tesis doctoral, Vrije Universiteit Amsterdam, 2010:
  <http://www.minix3.org/theses/herder_phd_thesis.pdf>
- C. Giuffrida, *Safe and Automatic Live Update*, tesis doctoral, Vrije
  Universiteit Amsterdam, 2014:
  <http://www.minix3.org/theses/Cristiano_Giuffrida_PhD_thesis.pdf>
- Wiki original (en inglés): la visión general de la fiabilidad
  (<https://wiki.minix3.org/doku.php?id=www:documentation:reliability>), SEF
  (<https://wiki.minix3.org/doku.php?id=developersguide:sef>) y la
  actualización en caliente
  (<https://wiki.minix3.org/doku.php?id=developersguide:liveupdate>).

Pruébalo: el [laboratorio «rompe un driver»](/es/docs/learn/lab-break-a-driver/).
