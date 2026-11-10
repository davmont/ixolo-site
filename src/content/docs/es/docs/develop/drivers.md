---
title: "Escribir un driver"
description: "Un driver en espacio de usuario desde cero: bibliotecas de drivers, privilegios, interrupciones, PCI, DMA y cómo sobrevivir a un reinicio."
sidebar:
  order: 2
---

Un driver en {{name}} es un proceso normal. Lo arranca el servidor de
reencarnación (RS), recibe solo los privilegios que figuran en su entrada de
configuración y se comunica con el resto del sistema mediante mensajes. Si se
cae, RS arranca una copia nueva. Esta página explica cómo escribir uno, con el
driver de ejemplo del árbol y drivers reales como referencia.

Si los términos *endpoint*, *RS* o *grant* te resultan nuevos, lee antes
[La arquitectura en cuatro capas](/es/docs/learn/architecture/).

## Elige una biblioteca de drivers

Casi nunca tendrás que tratar mensajes en bruto. Cada clase de driver tiene una
biblioteca que ejecuta el bucle principal, decodifica las peticiones de VFS o
de la pila de red y llama a las funciones que registras en una tabla:

| Biblioteca | Cabecera | Para | Ejemplos en `{{branch}}` |
|---|---|---|---|
| `libchardriver` | `<minix/chardriver.h>` | Dispositivos de caracteres: flujos de bytes, `ioctl`, `select` | `examples/hello`, `system/random`, `video/fb`, `tty/pty`, `printer` |
| `libblockdriver` | `<minix/blockdriver.h>`, `<minix/blockdriver_mt.h>` | Discos y particiones; `_mt` añade hilos de trabajo | `storage/ahci`, `storage/nvme`, `storage/at_wini`, `storage/virtio_blk`, `usb/usb_storage` |
| `libnetdriver` | `<minix/netdriver.h>` | Interfaces de red, que usa el servidor `lwip` | `net/e1000`, `net/igc`, `net/rtl8139`, `net/virtio_net` |
| `libinputdriver` | `<minix/inputdriver.h>` | Teclados y ratones, que alimentan el servidor `input` | `hid/pckbd` |
| `libaudiodriver` | `<minix/audio_fw.h>` | Tarjetas de sonido (sobre `libchardriver`) | `audio/es1370`, `audio/sb16` |

Todas las rutas están bajo
[`minix/drivers/`]({{repo}}/blob/{{branch}}/minix/drivers/), y las bibliotecas
bajo [`minix/lib/`]({{repo}}/blob/{{branch}}/minix/lib/). Todo driver enlaza
además `libsys`, que contiene las llamadas al núcleo (`sys_*`), el System Event
Framework (`sef_*`) y los clientes de PCI y del almacén de datos.

La tabla de un driver de caracteres muestra la forma de todas:

```c
struct chardriver {
  int (*cdr_open)(devminor_t minor, int access, endpoint_t user_endpt);
  int (*cdr_close)(devminor_t minor);
  ssize_t (*cdr_read)(devminor_t minor, u64_t position, endpoint_t endpt,
        cp_grant_id_t grant, size_t size, int flags, cdev_id_t id);
  ssize_t (*cdr_write)(...);
  int (*cdr_ioctl)(...);
  ...
  void (*cdr_intr)(unsigned int mask);    /* ha llegado una interrupción */
  void (*cdr_alarm)(clock_t stamp);       /* ha vencido un temporizador */
  void (*cdr_other)(message *m_ptr, int ipc_status);
};
```

Deja fuera lo que no necesites: la biblioteca responde a esas peticiones con un
error.

## El ejemplo: `hello`

[`minix/drivers/examples/hello/`]({{repo}}/blob/{{branch}}/minix/drivers/examples/hello/)
es un driver de caracteres completo de unas 150 líneas. Al leer `/dev/hello`
devuelve "Hello, World!". Se compila para amd64 y se instala en todas las
imágenes como `/service/hello`, con su configuración en
`/etc/system.conf.d/hello` y su nodo de dispositivo `/dev/hello`. Tiene cuatro
ficheros.

### `hello.c`: el driver

`main()` arranca el System Event Framework (SEF) y después cede el control a la
biblioteca:

```c
int main(void)
{
    sef_local_startup();
    chardriver_task(&hello_tab);
    return OK;
}
```

`sef_local_startup()` registra qué ejecutar en cada tipo de arranque y luego
llama a `sef_startup()`, que hace el saludo inicial con RS:

```c
static void sef_local_startup()
{
    sef_setcb_init_fresh(sef_cb_init);
    sef_setcb_init_lu(sef_cb_init);
    sef_setcb_init_restart(sef_cb_init);
    sef_setcb_lu_state_save(sef_cb_lu_state_save);
    sef_startup();
}
```

La función de inicio recibe el tipo de arranque (`SEF_INIT_FRESH`,
`SEF_INIT_RESTART` o `SEF_INIT_LU`). Prepara el driver y avisa a VFS de que
está listo con `chardriver_announce()`. Las bibliotecas de bloques y de red
tienen sus propias llamadas (`blockdriver_announce()`; `libnetdriver` lo hace
por ti).

Una lectura copia los datos al llamante a través de un **grant**: el llamante
no pasa un puntero, sino el identificador de un grant que permite al driver
escribir en un único búfer y en nada más:

```c
if ((ret = sys_safecopyto(endpt, grant, 0, (vir_bytes) ptr, size)) != OK)
    return ret;
return size;
```

### `hello.conf`: los privilegios

```
service hello
{
        system
                IRQCTL          # 19
                DEVIO           # 21
        ;
        ipc
                SYSTEM pm rs tty ds vm vfs
                pci inet lwip amddev
                ;
    uid 0;
};
```

(`hello` no toca hardware, así que `IRQCTL` y `DEVIO` solo están para mostrar la
sintaxis.) El formato se describe en `system.conf(5)`
([fuente]({{repo}}/blob/{{branch}}/minix/commands/minix-service/system.conf.5)).
Las claves que más usarás:

| Clave | Concede | Por defecto |
|---|---|---|
| `system` | Llamadas al núcleo por nombre: `IRQCTL` para interrupciones, `DEVIO` para puertos de E/S, `UMAP`/`VUMAP` para traducir direcciones, `PHYSCOPY`... | `BASIC` |
| `ipc` | A qué procesos puede enviar mensajes; `SYSTEM` es el núcleo | `ALL_SYS` |
| `io` | Rangos de puertos de E/S, `base[:longitud]` | ninguno |
| `irq` | Líneas de interrupción | ninguna |
| `pci device` | Dispositivos PCI que puede reclamar, `fabricante:dispositivo` | ninguno |
| `pci class` | Clases PCI que puede reclamar, `clase/subclase/interfaz` | ninguna |
| `uid` | Usuario con el que se ejecuta | 12 (`service`) |

Un driver PCI real necesita menos líneas de lo que parece, porque al reclamar
un dispositivo PCI recibe también sus puertos de E/S, sus rangos de memoria y
su línea de interrupción (ver más abajo). Esta es la entrada del driver de red
e1000:

```
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
        ...
        ipc
                SYSTEM pm rs log tty ds vm
                pci inet lwip ;
};
```

Concede lo mínimo. Cada línea es una promesa sobre lo que el driver puede
estropear si falla.

### `Makefile`: compilar e instalar

```make
PROG=	hello
SRCS=	hello.c

FILES=${PROG}.conf
FILESNAME=${PROG}
FILESDIR= /etc/system.conf.d

DPADD+=	${LIBCHARDRIVER} ${LIBSYS}
LDADD+=	-lchardriver -lsys

.include <minix.service.mk>
```

`minix.service.mk` compila un servicio del sistema y lo instala en `/service`.
Las líneas `FILES` instalan la configuración como `/etc/system.conf.d/hello`,
donde `minix-service` busca un fichero propio del servicio antes de recurrir al
`/etc/system.conf` global.

## Añadir tu driver a la compilación

1. Copia `examples/hello` a un directorio de la clase adecuada, por ejemplo
   `minix/drivers/system/mydrv/`, y cambia el nombre de los ficheros y de la
   entrada `service`.
2. Añade el directorio a la lista `SUBDIR` del `Makefile` padre.
3. Añade los ficheros instalados a las listas de conjuntos; si no, la
   compilación de la release se detiene porque las listas no cuadran. Para
   `hello` son, en `distrib/sets/lists/minix-base/mi`:

   ```
   ./etc/system.conf.d/hello                               minix-base
   ./service/hello                                         minix-base
   ```

   y en `distrib/sets/lists/minix-debug/mi`:

   ```
   ./usr/libdata/debug/service/hello.debug                 minix-debug     debug
   ```

4. Para un dispositivo nuevo de caracteres o de bloques, reserva un número
   mayor en
   [`minix/include/minix/dmap.h`]({{repo}}/blob/{{branch}}/minix/include/minix/dmap.h)
   (`hello` tiene `HELLO_MAJOR 17`) y enseña a
   [`MAKEDEV`]({{repo}}/blob/{{branch}}/minix/commands/MAKEDEV/MAKEDEV.sh)
   a crear el nodo:

   ```sh
   hello)
       # Hello driver
       makedev ${dev} c 17 0 ${uname} ${gname} 644
       ;;
   ```

   y añade el nombre a su lista `STD_DEVICES` para que las imágenes lleven el
   nodo. Mientras desarrollas también puedes crearlo a mano:
   `mknod /dev/mydrv c 17 0`.
5. Recompila y genera una imagen nueva, como en
   [Compilar desde el código](/es/docs/develop/building/). Para comprobar
   rápido que compila:
   `obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64 -C minix/drivers/system/mydrv dependall`.

## Arrancarlo y pararlo

El gestor de servicios es `minix-service` (en `/sbin`; el nombre `service` es
de la herramienta rc.d de NetBSD). En un sistema en marcha, como root:

```sh
minix-service up /service/hello -dev /dev/hello
cat /dev/hello
minix-service down hello
```

`up` recibe la ruta absoluta del binario. `-dev` asocia el driver a un nodo de
dispositivo: VFS le envía las peticiones del número mayor de ese nodo. La
etiqueta es, por defecto, el nombre del programa. Otras opciones útiles:
`-args "..."` pasa argumentos, `-label` pone otra etiqueta, `-config` apunta a
otro fichero de configuración y `-period 5HZ` hace que RS compruebe el driver
cada cinco segundos y lo reinicie si deja de responder. Consulta
`minix-service(8)`.

Un driver que deba arrancar con el sistema se añade a los scripts rc: mira en
`etc/rc.minix` y `etc/usr/rc` cómo se arrancan los existentes. La página
[Servicios](/es/docs/admin/services/) cubre el lado del administrador.

## Hablar con el hardware

### Dispositivos PCI

El servidor `pci` es el dueño del bus PCI. Un driver encuentra su dispositivo
con el cliente PCI de `libsys` y lo reclama con `pci_reserve()`. Esta es la
forma de la detección de e1000
([`e1000.c`]({{repo}}/blob/{{branch}}/minix/drivers/net/e1000/e1000.c)):

```c
pci_init();
r = pci_first_dev(&devind, &vid, &did);   /* solo los que permite system.conf */
...                                       /* pci_next_dev() para el resto */
pci_reserve(devind);
irq = pci_attr_r8(devind, PCI_ILR);
pci_get_bar(devind, PCI_BAR, &base, &size, &ioflag);
regs = vm_map_phys(SELF, (void *)(uintptr_t)base, size);
cr = pci_attr_r16(devind, PCI_CR);
pci_attr_w16(devind, PCI_CR, cr | PCI_CR_MAST_EN);   /* bus master, para DMA */
```

`pci_first_dev()` y `pci_next_dev()` solo devuelven los dispositivos que
coinciden con las líneas `pci device` o `pci class` de la entrada del driver.
`pci_reserve()` pide al servidor PCI que añada a los privilegios del driver los
BAR de E/S, los BAR de memoria y la línea de interrupción del dispositivo, así
que no hace falta ponerlos en `system.conf`. `vm_map_phys()` proyecta un BAR de
memoria en el espacio de direcciones del driver. El espacio de configuración se
lee y se escribe con `pci_attr_r8/r16/r32` y `pci_attr_w8/w16/w32`.

### Puertos de E/S

Los puertos no se tocan con instrucciones `in`/`out`: el driver se lo pide al
núcleo con `sys_inb()`, `sys_inw()`, `sys_inl()`, `sys_outb()`, `sys_outw()` y
`sys_outl()` (y las formas vectoriales `sys_vinb()`, `sys_voutb()`... para
muchos puertos a la vez). Hace falta `DEVIO` en `system`, y los puertos en una
línea `io` o concedidos por `pci_reserve()`.

```c
u32_t v;
if ((r = sys_inb(base + REG_STATUS, &v)) != OK) ...
sys_outb(base + REG_CMD, CMD_RESET);
```

### Interrupciones

El núcleo convierte una interrupción en un mensaje de notificación al driver;
la biblioteca llama a tu función `cdr_intr`, `bdr_intr` o `ndr_intr` con una
máscara de bits. Una línea se prepara con un *hook*:

```c
e->irq_hook = e->irq;   /* entrada: el bit que se activará en la máscara */
if ((r = sys_irqsetpolicy(e->irq, 0, &e->irq_hook)) != OK)
    panic("sys_irqsetpolicy failed: %d", r);
if ((r = sys_irqenable(&e->irq_hook)) != OK)
    panic("sys_irqenable failed: %d", r);
```

A la entrada, el identificador del hook es el número de bit que verás en la
máscara. A la vuelta contiene el índice del hook en el núcleo, que pasarás a
`sys_irqenable()`, `sys_irqdisable()` y `sys_irqrmpolicy()`. Con la política
`0`, la línea queda enmascarada tras cada interrupción hasta que vuelvas a
llamar a `sys_irqenable()`, como hace e1000 al principio de su manejador. Con
`IRQ_REENABLE`, el núcleo la vuelve a activar por ti. Necesitas `IRQCTL` en
`system`.

### MSI-X

En amd64 un driver puede usar interrupciones por mensaje (MSI y MSI-X,
añadidas en el PR #186). El núcleo elige un vector libre y devuelve la
dirección y el dato que el dispositivo debe escribir:

```c
int sys_irqsetpolicy_msi(int policy, int *hook_id,
        u32_t *msi_addr, u32_t *msi_data);
```

El driver los programa en su entrada de la tabla MSI-X y activa él mismo el bit
de habilitación MSI-X de la capacidad. A partir de ahí la entrega es idéntica a
la de una línea clásica: la misma notificación, el mismo `sys_irqenable()`. El
driver NVMe es quien lo usa en el árbol
([`nvme.c`]({{repo}}/blob/{{branch}}/minix/drivers/storage/nvme/nvme.c),
`nvme_setup_msix()` y `nvme_msix_program()`):

```c
r = sys_irqsetpolicy_msi(IRQ_REENABLE, &hook_id, &msi_addr, &msi_data);
entry = nvme_msix_table + nvme_msix_toff;            /* entrada 0 de la tabla */
*(volatile u32_t *)(entry + MSIX_VEC_ADDR_LO) = msi_addr;
*(volatile u32_t *)(entry + MSIX_VEC_ADDR_HI) = 0;
*(volatile u32_t *)(entry + MSIX_VEC_DATA) = msi_data;
*(volatile u32_t *)(entry + MSIX_VEC_CTRL) = 0;      /* desenmascarar */
```

La llamada devuelve `ENOSYS` cuando el núcleo funciona sin APIC, así que ten
una alternativa: NVMe pasa a sondeo. Los vectores salen de una reserva pequeña
(32), así que usa uno por dispositivo cuando puedas.

### DMA y memoria física

Un dispositivo que hace DMA necesita memoria físicamente contigua cuya
dirección física conozcas:

```c
void *alloc_contig(size_t len, int flags, phys_bytes *phys);
int free_contig(void *addr, size_t len);
```

`flags` puede pedir alineación de 4 KB o 64 KB (`AC_ALIGN4K`, `AC_ALIGN64K`) o
memoria por debajo de 16 MB o 1 MB (`AC_LOWER16M`, `AC_LOWER1M`) para
dispositivos antiguos. El puntero es para el driver; la dirección física, para
el dispositivo. e1000 reserva así sus anillos de descriptores y sus búferes al
iniciarse.

## Sobrevivir a un reinicio

Cuando un driver se cae, entra en pánico, lo matan o deja de responder a su
latido, RS arranca una copia nueva desde el mismo binario y con los mismos
privilegios. El proceso nuevo no hereda nada del anterior. Diséñalo pensando en
eso:

- **Haz que el inicio sea idempotente.** La copia nueva encuentra el hardware
  en el estado en que lo dejó la anterior. Reinicia el dispositivo al iniciar;
  no supongas que está recién encendido.
- **Distingue el tipo de arranque.** Tras una caída, la función de inicio
  recibe `SEF_INIT_RESTART`. Si no registras ninguna función para el reinicio,
  la que trae SEF por defecto responde a RS con `ERESTART` y el driver se
  arranca de nuevo como si fuera la primera vez, lo que para muchos drivers es
  razonable.
- **Guarda fuera del proceso lo que deba sobrevivir.** El servidor de almacén
  de datos (DS) guarda valores pequeños con nombre. `hello` guarda su contador
  de aperturas con `ds_publish_u32("open_counter", open_counter, DSF_OVERWRITE)`
  y lo recupera con `ds_retrieve_u32()`. Un driver que quiera conservar estado
  tras una caída tiene que publicarlo sobre la marcha, porque al morir no tiene
  ocasión de guardar nada.
- **Vuelve a anunciarte.** Llamar a `chardriver_announce()` o
  `blockdriver_announce()` desde el inicio comunica a VFS el endpoint nuevo del
  driver, para que las peticiones lleguen a la copia nueva.
- **Atiende `SIGTERM`.** Registra `sef_setcb_signal_handler()` para parar el
  dispositivo limpiamente al apagar, como hace `ahci.c`.

:::caution[Actualización en caliente]
`hello` también registra funciones para la actualización en caliente
(`SEF_INIT_LU`, `sef_setcb_lu_state_save`). La actualización en caliente
(sustituir un driver en marcha sin perder su estado) es una función de MINIX
que allí era experimental y solo para i386. Hoy no funciona en amd64: la prueba
de actualización en caliente del árbol es un fallo conocido. No cuentes con
ella.
:::

### Pruébalo matándolo

```sh
minix-service up /service/hello -dev /dev/hello
cat /dev/hello
minix-service refresh hello     # RS lo mata y arranca una copia nueva
cat /dev/hello                  # sigue respondiendo
```

En la consola, `hello` escribe "Hey, I've just been restarted!" desde su camino
de reinicio. Pulsa <kbd>Mayús</kbd>+<kbd>F6</kbd> en la consola para ver la
tabla de servicios de RS. Para una caída que RS no haya pedido, mata el proceso
o añade un `panic()` deliberado en alguna petición. El
[laboratorio: rompe un driver](/es/docs/learn/lab-break-a-driver/) lo hace paso
a paso.

:::note
El driver `hello` se compila y va en todas las imágenes, pero ninguna prueba
automática lo ejercita. Si algo de esta página no coincide con lo que ves en
una compilación actual, manda el código del árbol.
:::

## Para saber más

- Guía de desarrollo de MINIX 3, programación de drivers:
  <https://wiki.minix3.org/doku.php?id=developersguide:driverprogramming>
- Protocolos de drivers de bloques y de red:
  <https://wiki.minix3.org/doku.php?id=developersguide:blockprotocol>,
  <https://wiki.minix3.org/doku.php?id=developersguide:datalinkprotocol>

Describen MINIX 3.3/3.4 en i386: las bibliotecas son las mismas, los detalles
de la plataforma no.
