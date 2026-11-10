---
title: "Sistemas de ficheros"
description: "MFS v4 con journaling, ext2/3/4, FAT, exFAT, ISO 9660, tmpfs y cómo montarlos."
sidebar:
  order: 2
---

Cada sistema de ficheros de {{name}} es un proceso servidor aparte. Cuando
montas un disco, el sistema arranca una instancia nueva del servidor que toca
(`mfs`, `ext2`, `vfat`...) para ese montaje, bajo el Reincarnation Server como
cualquier otro [servicio](/es/docs/admin/services/). Un fallo en el código de
FAT puede tumbar el servidor de FAT, no el núcleo.

| Tipo (`mount -t`) | Formato | Lectura | Escritura | Notas |
|---|---|---|---|---|
| `mfs` | Sistema de ficheros MINIX v1–v3 y v4 | sí | sí | Nativo. v4 es el formato por defecto. |
| `ext2` | ext2, ext3, ext4 | sí | sí | Algunas características obligan a solo lectura; ver abajo. |
| `vfat` | FAT12, FAT16, FAT32 | sí | sí | Nombres largos en UTF-8. |
| `exfat` | exFAT | sí | sí | |
| `isofs` | ISO 9660 con Rock Ridge | sí | no | CD e imágenes ISO. |
| `tmpfs` | en memoria | sí | sí | Nuevo; se monta en `/var/shm` al arrancar. |
| `procfs` | información de procesos | sí | no | Montado en `/proc`. |

## MFS versión 4

MFS es el sistema de ficheros nativo. `setup` y `mkfs.mfs` crean la versión 4
por defecto, con un journal de metadatos. La versión 4 quita los límites que la
versión 3 tenía en su formato en disco:

| | MFS v3 | MFS v4 |
|---|---|---|
| Inodo | 64 bytes | 128 bytes |
| Fichero más grande | 2 GB | más de 2 GB |
| Marcas de tiempo | 32 bits, acaban en enero de 2038 | 64 bits, sin problema de 2038 |
| Enlaces duros, IDs de grupo | 16 bits | 32 bits |
| Flags de fichero (`chflags`) | no | sí |
| Atributos extendidos, ACL | no | sí |
| Journal de metadatos | no | sí (activado por defecto) |

Los nombres de fichero siguen teniendo como máximo 60 bytes, en las dos
versiones. Los nombres más largos se truncan.

Un único servidor `mfs` lee y escribe las dos versiones. Las características
nuevas se marcan con bits en el superbloque, así que un driver futuro puede
añadir funciones sin otro cambio de formato. MINIX 3 original no lee la
versión 4: si un disco tiene que poder leerse allí, créalo con `-3`.

El diseño, campo a campo: [MFS v4](/es/docs/design/mfsv4/).

### Crear un sistema de ficheros MFS

```sh
mkfs.mfs /dev/c0d1p0              # v4 con journal (por defecto)
mkfs.mfs -B 4096 /dev/c0d1p0      # elige el tamaño de bloque en bytes
mkfs.mfs -3 /dev/c0d1p0           # v3 heredado, sin journal
```

| Opción | Significado |
|---|---|
| `-4` | MFS v4. Es el valor por defecto. |
| `-3` | MFS v3 heredado, para soportes que deba leer un MINIX antiguo. Desactiva el journal. |
| `-j` | Reserva un journal de metadatos. Activado por defecto; implica `-4`. |
| `-B tamaño` | Tamaño de bloque en bytes. `setup` usa 4096. |
| `-i inodos` | Número de inodos. |
| `-b bloques` | Tamaño del sistema de ficheros, en bloques. |

El journal ocupa 1/64 de los bloques, entre 64 y 8192 bloques. En un sistema de
ficheros demasiado pequeño para contenerlo, `mkfs.mfs` lo omite con un aviso
(o falla, si pediste `-j` de forma explícita).

### Journaling y recuperación tras un fallo

El journal cubre los **metadatos**: inodos, mapas de bits, directorios, bloques
indirectos y el superbloque. El contenido de los ficheros no pasa por el
journal, pero se escribe en disco antes de confirmar los metadatos que apuntan
a él (el mismo modo "data=ordered" de ext3 y ext4). Tras un fallo puedes perder
las últimas escrituras que no se habían sincronizado, pero la estructura del
sistema de ficheros es coherente y ningún fichero apunta a basura.

Cada cambio se escribe primero en el journal y solo pasa a su sitio definitivo
cuando la copia del journal está a salvo en disco. Al montar en
lectura-escritura un sistema de ficheros con journal que no se desmontó
limpiamente, `mfs` vuelve a aplicar las transacciones confirmadas y descarta
una incompleta al final. No hay un `fsck` largo. Si la máquina vuelve a caer
durante la recuperación, se puede repetir sin problema.

Sin journal (v3, o una v4 demasiado pequeña para tenerlo), un sistema de
ficheros sucio se monta en **solo lectura** con un aviso, `MFS: WARNING: FS
... unclean, mounting readonly`, hasta que lo compruebes:

```sh
umount /dev/c0d1p0
fsck_mfs -a /dev/c0d1p0           # reparar automáticamente
fsck_mfs -r /dev/c0d1p0           # preguntar antes de cada reparación
```

`fsck_mfs` entiende la versión 4, incluidos el área del journal y los bloques
de los atributos extendidos. Al arrancar, `/etc/rc.minix` ejecuta `fsck -p`
sobre los sistemas de ficheros de `/etc/fstab` distintos de `/` antes de
montarlos.

El diseño: [journaling de MFS](/es/docs/design/journal/).

### Atributos extendidos y ACL

MFS v4 guarda los atributos extendidos en un bloque extra por fichero, a través
de la familia de llamadas BSD `extattr_get_file(2)`, en los espacios de nombres
`user` y `system`. `system` es solo para root. Todos los atributos de un
fichero deben caber en ese bloque; una escritura que lo desborde falla con
`ENOSPC`. Todavía no hay órdenes `getextattr`/`setextattr` en el sistema base,
así que los atributos se fijan desde programas.

Las listas de control de acceso POSIX.1e se apoyan en ellos. Usa `getfacl` y
`setfacl`:

```sh
setfacl -m u:alice:rw informe.txt     # da a alice lectura/escritura
setfacl -d -m g:staff:rx compartido/  # ACL por defecto, la heredan los ficheros nuevos
getfacl informe.txt
setfacl -b informe.txt                # quita las entradas extendidas
```

La ACL se aplica en cada acceso, los ficheros y directorios nuevos heredan las
ACL por defecto, y `chmod` mantiene sincronizada la máscara de la ACL. El
servidor ext2 lee y escribe las ACL de los volúmenes ext4 de la misma forma.

Diseño: [atributos extendidos](/es/docs/design/xattr/).

### Flags de fichero

MFS v4 admite los flags BSD de inmutable y de solo-añadir mediante
`chflags(2)`. Un fichero inmutable no se puede escribir, truncar, renombrar,
enlazar ni borrar, ni cambiar su propietario, modo, fechas o atributos. Un
fichero de solo-añadir solo puede crecer por el final. Solo root puede poner o
quitar los flags de sistema (`SF_*`); el propietario puede poner los de usuario
(`UF_*`). En un sistema de ficheros v3, `chflags` devuelve `EOPNOTSUPP`.
Todavía no hay orden `chflags(1)` en el sistema base.

## Montar

```text
mount [-a] [-r] [-e] [-t tipo] [-o opciones] especial nombre
```

- `-t tipo` es el nombre del servidor de la tabla de arriba. Sin él, `mount`
  detecta MFS (v1 a v3), ext2 e ISO 9660, y si no, usa `mfs`.
- `-r` monta en solo lectura. `-o` pasa opciones al servidor.
- `mount` sin argumentos lista lo que está montado. `umount` desmonta.

Los discos se llaman `/dev/c0d0` (controladora 0, disco 0), con particiones
primarias `p0`–`p3` y subparticiones `s0`–`s3`. Una instalación por defecto
tiene `/` en `/dev/c0d0p0s0`, `/home` en `...s1` y `/usr` en `...s2`.

```sh
mount /dev/c0d1p0 /mnt                       # MFS o ext2: se detecta
mount -t ext2 /dev/c0d1p1 /mnt/linux
mount -t vfat /dev/usb_disk0p0 /mnt/usb
mount -t exfat /dev/usb_disk0p0 /mnt/usb
mount -t tmpfs -o size=64m none /mnt/scratch
mount -r -t isofs /dev/c0d2 /mnt/cdrom       # el nombre del lector de CD varía
umount /mnt/usb
```

Una memoria USB aparece al conectarla: la consola muestra
`New USB disk at /dev/usb_disk0.` y sus particiones llevan los mismos sufijos
`p0`–`p3`.

### /etc/fstab

`mount -a` monta todas las entradas de `/etc/fstab` salvo `/` y las marcadas
`noauto`. El formato es el BSD de siempre: dispositivo, punto de montaje,
tipo, opciones, frecuencia de volcado y pasada de fsck. Esto es lo que escribe
`setup`:

```text
/dev/c0d0p0s0	/		mfs	rw			0	1
/dev/c0d0p0s2	/usr		mfs	rw			0	2
/dev/c0d0p0s1	/home	mfs	rw			0	2
none		/sys		devman	rw,rslabel=devman	0	0
none		/dev/pts	ptyfs	rw,rslabel=ptyfs	0	0
```

Usa `none` como dispositivo para los sistemas de ficheros sin disco detrás,
como `tmpfs`. De las opciones, `mount -a` solo interpreta `ro` y `noauto`; el
resto de la cadena se pasa al servidor.

## ext2, ext3 y ext4

El servidor `ext2` lee y escribe volúmenes Linux ext2, ext3 y ext4, con
extents, números de bloque de 64 bits, sumas `metadata_csum`, directorios
htree, ficheros de más de 2 GB, atributos extendidos y ACL. Procesa la lista
de huérfanos al montar.

Lo que no hace:

- **No pasa sus propias escrituras por el journal.** Un volumen ext3/ext4
  desmontado limpiamente se monta en lectura-escritura, pero el sistema lo
  escribe como si fuera ext2. Desmóntalo antes de sacar el disco.
- **La recuperación es parcial.** Si un volumen ext3 no se desmontó
  limpiamente, el servidor aplica el journal al montarlo en lectura-escritura.
  Solo entiende el formato clásico de journal de ext3 (sin sumas de control del
  journal ni journal de 64 bits). Con cualquier otro, monta en solo lectura.
- **Algunas características de ext4 no están soportadas.** Un volumen con una
  característica "incompatible" no soportada (por ejemplo `meta_bg`, datos en
  línea o cifrado) se rechaza. Uno con una característica "compatible en solo
  lectura" no soportada, o marcado con errores, se monta en solo lectura. El
  servidor muestra el motivo.

`newfs_ext2fs` y `fsck_ext2fs` (de NetBSD) están en el sistema base.

## FAT y exFAT

`vfat` lee y escribe FAT12, FAT16 y FAT32, con nombres largos en UTF-8, tamaños
de sector distintos de 512 bytes, y permite ejecutar y mapear programas desde
él. `exfat` lee y escribe exFAT, el formato de la mayoría de memorias USB y
tarjetas SD grandes. `newfs_msdos` crea sistemas FAT; no hay `mkfs` ni `fsck`
para exFAT en el sistema base.

FAT no tiene propietarios ni permisos Unix, así que no esperes que `chmod` o
`chown` se mantengan.

## ISO 9660

`isofs` lee CD e imágenes ISO, con nombres y enlaces simbólicos Rock Ridge.
Los programas que contiene se pueden ejecutar directamente, cargando las
páginas bajo demanda.

## tmpfs

`tmpfs` mantiene un sistema de ficheros en memoria. Es nuevo en {{name}}
([PR #483]({{repo}}/pull/483)). Sus ficheros se pueden mapear con `mmap`,
incluso con mapeos compartidos escribibles, y ejecutar. Al arrancar,
`/etc/rc.minix` monta uno en `/var/shm`, donde `shm_open(3)` guarda los objetos
de memoria compartida POSIX, salvo que `/etc/fstab` ya monte algo ahí.

| Opción | Significado | Por defecto |
|---|---|---|
| `size=N[k\|m\|g]` | Máximo de datos de fichero; después, `ENOSPC`. | la mitad de la memoria física |
| `nr_inodes=N` | Máximo de ficheros y directorios. | uno por página de `size` |
| `mode=octal` | Permisos del directorio raíz. | `1777` |
| `uid=N`, `gid=N` | Propietario del directorio raíz. | `0` |

Su contenido se pierde al desmontarlo. No admite flags de fichero ni atributos
extendidos, y sus páginas nunca van a swap.

## procfs

`procfs` se monta en `/proc` al arrancar. Además de los directorios habituales
por proceso, tiene `/proc/service/<etiqueta>` para cada servicio del sistema
(ver [servicios](/es/docs/admin/services/#qué-se-está-ejecutando-y-qué-ha-registrado-rs)),
`/proc/pci` y `/proc/cpuinfo`.

## Swap

:::caution[Todavía no se puede activar el swap]
El servidor VM sabe enviar memoria anónima a una partición de disco, y la
llamada al sistema `swapctl(2)` existe. Pero **no hay `swapctl(8)`, `swapon`
ni soporte en `/etc/fstab`** para configurarlo: el sistema base no trae ninguna
herramienta de swap. En la práctica, {{name}} funciona sin swap en disco.
:::

Lo que VM hace por su cuenta, sin configurar nada: cuando falta memoria libera
páginas limpias de ficheros y comprime en RAM la memoria anónima que lleva
tiempo sin usarse. Cuando ni eso basta, un *OOM killer* elige un proceso y lo
termina. Diseño:
[recuperación de páginas, compresión y swap](/es/docs/design/reclaim/).

## Para saber más

- `man mount`, `man mkfs.mfs`, `man fsck.mfs`, `man tmpfs`, `man setfacl`
- Documentos de diseño: [MFS v4](/es/docs/design/mfsv4/),
  [journal](/es/docs/design/journal/), [atributos extendidos](/es/docs/design/xattr/),
  [recuperación y swap](/es/docs/design/reclaim/)
