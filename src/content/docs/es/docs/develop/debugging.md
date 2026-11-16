---
title: Depuración
description: Averigua por qué falla el núcleo, un servidor o un programa, con los mensajes del núcleo, los volcados de las teclas de función, trace(1), las trazas de un pánico y gdb conectado a QEMU.
sidebar:
  order: 4
---

Dentro de {{name}} no hay depurador: ni gdb ni lldb. Se depura desde fuera,
con los mensajes que escribe el sistema, volcados de sus tablas internas,
una traza de las llamadas al sistema de un programa y, para el núcleo y los
servidores, gdb en el anfitrión conectado a QEMU. Todo lo de esta página se
comprobó con una instantánea de `{{branch}}` de noviembre de 2026, en QEMU
con KVM y una CPU.

Las rutas de abajo suponen que compilaste con `-O obj.amd64`, como en
[Compilar desde el código](/es/docs/develop/building/).

## Mensajes del núcleo

Lo que escribe el núcleo, y lo que escriben los servidores y drivers con
`printf`, va a la consola y al búfer de mensajes del núcleo. El driver `log`
pasa ese búfer a `syslogd`, que lo escribe en `/var/log/messages` con la
etiqueta `kernel:`:

```sh
tail -20 /var/log/messages
```

Los mensajes del principio del arranque, antes de que arranque `syslogd`, y
los de un pánico solo llegan a la consola. Para conservarlos, usa la consola
serie y guárdala en el anfitrión: arranca la entrada de **consola serie**
(consulta [Consola serie](/es/docs/admin/booting/#consola-serie)) y añade
`-serial file:boot.log` a QEMU. Para un sistema que se cuelga antes de poder
registrar nada, `releasetools/devtools/kmsg.py` lee el búfer de la memoria
de la máquina virtual por QMP (consulta las
[herramientas de desarrollo](/es/docs/design/devtools/)).

## Volcados con las teclas de función

El servidor de información (IS) escribe las tablas del sistema cuando
pulsas una tecla de función en el teclado de la consola. Las escribe en los
mensajes del núcleo, así que léelas en `/var/log/messages` o en la consola
serie. En QEMU, envía la tecla desde el monitor (`sendkey f1`,
`sendkey shift-f3`) o por QMP con `releasetools/devtools/keys.py`.

| Tecla | Volcado |
|---|---|
| <kbd>F1</kbd> | Tabla de procesos del núcleo |
| <kbd>F3</kbd> | Imagen del sistema |
| <kbd>F4</kbd> | Privilegios de los procesos |
| <kbd>F5</kbd> | Parámetros del monitor de arranque |
| <kbd>F6</kbd> | Ganchos y políticas de IRQ |
| <kbd>F7</kbd> | Mensajes del núcleo |
| <kbd>F8</kbd> | Estado de VM y mapas de los procesos |
| <kbd>F10</kbd> | Parámetros del núcleo |
| <kbd>Mayús</kbd>+<kbd>F1</kbd> | Tabla de procesos de PM |
| <kbd>Mayús</kbd>+<kbd>F2</kbd> | Señales |
| <kbd>Mayús</kbd>+<kbd>F3</kbd> | Tabla de procesos de VFS: en qué está bloqueado cada proceso |
| <kbd>Mayús</kbd>+<kbd>F4</kbd> | Correspondencia entre dispositivos y drivers |
| <kbd>Mayús</kbd>+<kbd>F5</kbd> | Esta lista de teclas |
| <kbd>Mayús</kbd>+<kbd>F6</kbd> | Tabla de servicios de RS |
| <kbd>Mayús</kbd>+<kbd>F8</kbd> | Contenido del almacén de datos (DS) |
| <kbd>Mayús</kbd>+<kbd>F9</kbd> | Procesos con sus trazas de pila |

La tabla está en
[`minix/servers/is/dmp.c`]({{repo}}/blob/{{branch}}/minix/servers/is/dmp.c).
Un volcado largo se detiene a las 22 líneas con `--more--`; pulsa la misma
tecla otra vez para ver la página siguiente. Después de la última, la
siguiente pulsación vuelve a empezar desde arriba. Una página de
<kbd>F1</kbd> se ve así:

```text
kernel:  8       0          8 vm           2   500    274      0  --R---- ANY
kernel:  9       0          9 pfs          5   500      1      0  --R---- ANY
kernel: 11       0         11 init        47   200      0      0  --R---- pm
kernel: 13       2      65549 acpi         7   200      0      0  --R---- ANY
kernel: --more--
```

:::caution[Las trazas de Mayús+F9 son erróneas en amd64]
Para un proceso que entró en el núcleo con `SYSCALL`, que son casi todos, el
núcleo busca el puntero de marco en una posición fija de la pila de usuario.
En amd64 encuentra allí bytes de instrucciones, así que todos los procesos
muestran la misma traza sin sentido (`0x38001078 0xc3850fc0850b89 (v_rbp … ?)`).
Para ver dónde está un servidor, usa gdb, más abajo.
:::

## Trazar un programa: trace(1)

`trace` ejecuta una orden, o se engancha a un proceso en marcha con
`-p pid`, y escribe cada llamada al sistema con sus argumentos y su
resultado:

```text
# trace ls /etc/motd
Tracing ls (pid 650)
openat(AT_FDCWD, "/dev/urandom", O_RDONLY|O_CLOEXEC) = 3
…
readlinkat(AT_FDCWD, "/etc/malloc.conf", &0x7feffffc9c20, 1024) = -1 [ENOENT]
…
fstatat(AT_FDCWD, "/etc/motd", {st_mode=S_IFREG|0755, st_size=329, ..}, 0) = 0
write(1, "/etc/motd\n", 10) = /etc/motd
10
exit(0)
Process exited normally with code 0
```

`-f` sigue a los hijos creados con `fork`, `-t` añade la hora, `-o fichero`
escribe la traza en un fichero y `-v` muestra más campos de cada estructura.
Se basa en `ptrace`, que aún tiene fallos conocidos (el test 42). Consulta
`man trace`.

## Pánicos

Cuando el núcleo encuentra una incoherencia se detiene con un pánico y
escribe las direcciones de retorno de su pila. Uno real, de la consola
serie:

```text
kernel panic: nested pagefault
kernel on CPU 0: 0xffffffff8026744b 0xffffffff80253bdb 0xffffffff8024b628 0xffffffff802623b8 …
System has panicked, press any key to reboot
```

Un servidor o driver que entra en pánico escribe su nombre y su endpoint, el
mensaje y una traza de pila, y termina; RS lo reinicia si puede:

```text
pm(0): panic: <mensaje>
syslib:panic.c: stacktrace: 0x… 0x…
```

Convierte las direcciones en funciones con el binario sin recortar de la
compilación: `obj.amd64/minix/kernel/kernel` para el núcleo y, para los
demás, el binario del directorio de objetos del servidor o driver, como
`obj.amd64/minix/servers/pm/pm`. Todos conservan sus símbolos.

```sh
gdb -batch obj.amd64/minix/kernel/kernel \
    -ex 'info symbol 0xffffffff8026744b' -ex 'info symbol 0xffffffff80253bdb'
```

```text
panic + 171 in section .text
exception_handler + 1419 in section .text
```

La primera dirección está en el propio `panic`; la causa está en las
siguientes. Cada dirección es el punto al que vuelve una llamada, justo
después de ella. Con un núcleo compilado con información de depuración
(siguiente sección), `info line *0x…` da además la línea del código.

## gdb conectado a QEMU

QEMU tiene un stub de gdb: gdb en el anfitrión puede detener la máquina
virtual, leer y cambiar su memoria y sus registros, y poner puntos de
ruptura en el núcleo y en los servidores. Detenerla detiene la máquina
entera.

Arranca QEMU como siempre y añade `-s`, que abre el stub en el puerto TCP
1234. Añade también `-S` para que la CPU espere parada en la primera
instrucción hasta que gdb la deje continuar. Después, desde el árbol de
código:

```sh
gdb obj.amd64/minix/kernel/kernel
(gdb) target remote :1234
(gdb) break do_fork
(gdb) continue
```

Ejecuta cualquier orden en la máquina virtual y gdb se detiene en la llamada
al núcleo que crea el proceso nuevo:

```text
Breakpoint 1, 0xffffffff80267571 in do_fork ()
(gdb) bt
#0  0xffffffff80267571 in do_fork ()
#1  0xffffffff802656e6 in kernel_call ()
#2  0xffffffff8024b47a in kernel_call_entry_common ()
```

`continue` la deja seguir, <kbd>Ctrl</kbd>+<kbd>C</kbd> en gdb la detiene y
`detach` la deja funcionando.

### Depurar con el código fuente

La compilación no incluye información de depuración, así que gdb solo ve
nombres de funciones. Compila el núcleo otra vez con ella, desde la raíz del
árbol de código:

```sh
M=obj.amd64/tooldir.Linux-x86_64/bin/nbmake-amd64
$M -C minix/kernel cleandir
$M -C minix/kernel DBG="-O2 -g" dependall
```

`-g` no cambia el código generado: el del núcleo nuevo es idéntico byte a
byte al del anterior, así que puedes cargarlo en gdb con la imagen que ya
compilaste y arrancaste. Ahora gdb muestra las líneas del código, los
argumentos y las estructuras:

```text
Breakpoint 1, do_fork (caller=0xffffffff8027e380 <proc+12064>, m_ptr=0xffffffff80437f58)
    at /…/minix/kernel/system/do_fork.c:39
39	  if(!isokendpt(m_ptr->m_lsys_krn_sys_fork.endpt, &p_proc))
(gdb) bt
#0  do_fork (caller=…, m_ptr=…) at /…/minix/kernel/system/do_fork.c:39
#1  0xffffffff802656e6 in kernel_call_dispatch (caller=…, msg=…) at /…/minix/kernel/system.c:118
#2  kernel_call (m_user=0x35fffa80, caller=…) at /…/minix/kernel/system.c:162
(gdb) p caller->p_name
$1 = "vm", '\000' <repeats 13 times>
```

Quien llama es VM, no PM: PM atiende el `fork`, y VM, que copia el espacio
de direcciones, hace la llamada al núcleo. Esto sustituye el núcleo del
directorio de objetos; para volver al de antes, ejecuta las mismas dos
órdenes sin `DBG=`.

### Puntos de ruptura antes de activar la paginación

Con `-S`, el núcleo aún no está cargado y sus direcciones no están mapeadas,
así que no se puede escribir un punto de ruptura normal:

```text
(gdb) break cstart
Warning:
Cannot insert breakpoint 1.
Cannot access memory at address 0xffffffff80261774
```

Usa un punto de ruptura hardware, que no necesita escribir en memoria:

```text
(gdb) hbreak cstart
(gdb) continue
Breakpoint 1, cstart () at /…/minix/kernel/main.c:530
```

### Puntos de ruptura en un servidor

Todos los servidores, drivers y programas están enlazados en la misma
dirección, `0x400000`, cada uno en su espacio de direcciones, así que la
misma dirección significa algo distinto en cada proceso. Usa un punto de
ruptura hardware con una condición sobre el registro `CR3`, que apunta a
las tablas de páginas del proceso en ejecución. El núcleo guarda el valor de
cada proceso en su tabla de procesos. Con el núcleo compilado con `-g`, esto
detiene a PM en su `do_fork`:

```text
(gdb) set $i = 0
(gdb) while $i < sizeof(proc)/sizeof(proc[0])
 >if $_streq(proc[$i].p_name, "pm")
  >set $pmcr3 = proc[$i].p_seg.p_cr3
  >end
 >set $i = $i + 1
 >end
(gdb) add-symbol-file obj.amd64/minix/servers/pm/pm
(gdb) hbreak *0x408530 if (unsigned long)$cr3 == $pmcr3
(gdb) continue
Breakpoint 2, 0x0000000000408530 in do_fork ()
(gdb) bt
#0  0x0000000000408530 in do_fork ()
#1  0x0000000000407d37 in main ()
#2  0x000000000040799d in ___start ()
```

Saca la dirección de `nm obj.amd64/minix/servers/pm/pm`: el nombre
`do_fork` también existe en el núcleo, y gdb elegiría el del núcleo. Sin la
condición, el punto de ruptura salta en cualquier proceso que ejecute código
en esa dirección.

## printf

Un `printf` en un servidor o driver va a los mensajes del núcleo, como todo
lo demás. Recompila solo ese programa y genera una imagen nueva (consulta
[Compilar desde el código](/es/docs/develop/building/)). Es tosco, y a
menudo la forma más rápida de ver qué hace un trozo de código.

## Más información

- [Pruebas e integración continua](/es/docs/develop/testing/): lo que
  recoge `qemutest.py` cuando una prueba se cuelga.
- [Herramientas de desarrollo](/es/docs/design/devtools/): scripts que
  arrancan una máquina virtual, envían teclas y leen los mensajes del
  núcleo.
- La [documentación del stub de gdb](https://www.qemu.org/docs/master/system/gdb.html)
  de QEMU.
