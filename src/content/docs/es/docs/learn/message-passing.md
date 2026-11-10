---
title: Paso de mensajes
description: Cómo se comunican los procesos de {{name}} entre sí y con el núcleo, en amd64.
sidebar:
  order: 2
---

En {{name}} casi cualquier operación interesante es una conversación entre
procesos. Un programa pide a VFS que lea un fichero, VFS se lo pide a un
servidor de ficheros, el servidor de ficheros a un driver de disco, y el
driver pide al núcleo que haga E/S por puertos. Cada uno de esos pasos es un
**mensaje**. Esta página explica qué es un mensaje en amd64, qué primitivas lo
mueven y cómo viajan los datos grandes sin romper el aislamiento.

Las definiciones están en
[`minix/include/minix/ipc.h`]({{repo}}/blob/{{branch}}/minix/include/minix/ipc.h),
[`ipcconst.h`]({{repo}}/blob/{{branch}}/minix/include/minix/ipcconst.h) y
[`endpoint.h`]({{repo}}/blob/{{branch}}/minix/include/minix/endpoint.h); la
parte del núcleo, en
[`minix/kernel/proc.c`]({{repo}}/blob/{{branch}}/minix/kernel/proc.c).

## Endpoints

A los procesos se les dirige por **endpoint**, no por PID. Un endpoint junta
dos números en un `int`:

- la **ranura** en la tabla de procesos del núcleo (negativa para las cinco
  tareas del núcleo, de 0 a 255 para los procesos);
- un número de **generación**, desplazado 15 bits a la izquierda, que sube
  cada vez que se reutiliza la ranura.

Si un driver falla y RS arranca una copia nueva, el proceso nuevo puede
ocupar la misma ranura, pero tendrá otra generación y, por tanto, otro
endpoint. Un mensaje dirigido al endpoint del driver muerto falla con
`EDEADSRCDST` en lugar de llegar al proceso equivocado. Esto es lo que hace
seguro reiniciar servicios.

Los servidores esenciales tienen endpoints fijos con generación 0, definidos
en [`minix/include/minix/com.h`]({{repo}}/blob/{{branch}}/minix/include/minix/com.h):
`PM_PROC_NR` es 0, `VFS_PROC_NR` 1, `RS_PROC_NR` 2, y así hasta `init`, que es
11. Todo lo demás se busca por nombre en DS.

## Cómo es un mensaje en amd64

Un mensaje es una estructura de tamaño fijo:

| Campo | Tamaño | Contenido |
|---|---|---|
| `m_source` | 4 bytes | Endpoint del emisor, lo rellena el núcleo; el emisor no puede falsificarlo |
| `m_type` | 4 bytes | Código de petición o estado de la respuesta |
| carga útil | 96 bytes | Una unión de formatos con tipo |

En total, **104 bytes**. La cabecera lo comprueba al compilar
(`sizeof(message) == 104` en amd64). En i386 y ARM un mensaje ocupa 64 bytes,
con 56 de carga útil; amd64 necesita más sitio porque los punteros, `long` y
`size_t` ocupan 8 bytes.

La carga útil es una unión de formatos con nombre, uno por tipo de petición,
como `m_ds_req`, `m_lsys_krn_sys_exec` o `m_notify`. Cada uno se comprueba
con `_ASSERT_MSG_SIZE()`, que en amd64 solo exige que quepa en 96 bytes (en
i386 tiene que medir exactamente 56). Algunos formatos de amd64 ya no caben en
56 bytes, y esa es una de las razones por las que la compilación para i386
está rota en la rama de desarrollo.

El tamaño fijo importa: el núcleo nunca reserva memoria para un mensaje, y un
mensaje siempre se copia de una vez. Lo que no cabe en 96 bytes viaja con una
concesión de memoria (más abajo).

## Las primitivas

| Llamada | ¿Bloquea? | Qué hace |
|---|---|---|
| `ipc_send(dst, &m)` | sí | Espera hasta que `dst` recibe el mensaje |
| `ipc_receive(src, &m, &status)` | sí | Espera un mensaje de `src`, o de `ANY` |
| `ipc_sendrec(dst, &m)` | sí | Envía y espera la respuesta en el mismo búfer. La forma habitual de hacer una petición |
| `ipc_sendnb(dst, &m)` | no | Envía solo si `dst` ya está esperando; si no, falla con `ENOTREADY` |
| `ipc_notify(dst)` | no | Activa un bit de «tienes novedades» para `dst`; sin carga útil |
| `ipc_senda(tabla, n)` | no | Entrega al núcleo una tabla de mensajes para que los reparta cuando cada receptor esté listo |

El núcleo no guarda mensajes en búferes. `send` es una **cita** (*rendezvous*):
el mensaje se copia directamente del emisor al receptor cuando los dos están
listos. Las llamadas al núcleo (las funciones `sys_*` de libsys) usan el mismo
formato de mensaje a través de una trampa aparte, `_do_kernel_call()`.

Los programas de usuario solo pueden usar `sendrec`. Los servidores y drivers
pueden usar las demás, con el límite de la lista `ipc` de su entrada en
`system.conf`: un envío a un proceso que no está en la lista falla con
`ECALLDENIED`.

## Notificaciones e interrupciones

`notify` no lleva datos, nunca bloquea y nunca acumula más de una notificación
pendiente por emisor. Cuando el receptor vuelve a llamar a `receive`, recibe
un mensaje con `m_type` igual a `NOTIFY_MESSAGE`, el endpoint del emisor y una
marca de tiempo.

Las interrupciones llegan igual. Un driver se registra para una IRQ con la
llamada al núcleo `sys_irqsetpolicy()`. Cuando salta la interrupción, el
manejador del núcleo solo la anota y envía una notificación desde el endpoint
especial `HARDWARE`; la carga útil dice cuáles de las interrupciones del
driver están pendientes. Según la política que eligió el driver, el núcleo
vuelve a habilitar la línea en el acto, o lo hace el driver con
`sys_irqenable()` cuando ha atendido el dispositivo. Ningún código de driver
se ejecuta nunca en modo núcleo.

RS usa notificaciones para los latidos, y la tarea del reloj para las alarmas.

## Cómo se evitan los interbloqueos

Las llamadas que bloquean pueden interbloquearse: A envía a B mientras B
envía a A. Antes de bloquear un proceso, el núcleo busca ciclos de emisores y
receptores bloqueados y, si encuentra uno, hace fallar la llamada con
`ELOCKED` en lugar de quedarse colgado.

Además, el sistema está construido para que no aparezcan ciclos. Las
peticiones fluyen en un sentido (programa → servidor → driver → núcleo) y las
respuestas vuelven. Un servidor que tiene que enviar algo a un proceso que
quizá no esté esperando usa `senda` o `notify`, que nunca bloquean: RS y PM
usan envíos asíncronos justo por eso.

## Concesiones de memoria y copias seguras

96 bytes no dan para un `read()` de 64 KB. Los datos grandes se mueven con
**concesiones** (*grants*): un proceso crea una entrada en su propia tabla de
concesiones que dice «este endpoint puede leer (o escribir) estos bytes de mi
memoria», y pasa el identificador de la concesión en un mensaje. El receptor
pide entonces al núcleo que copie:

```c
/* quien concede */
cp_grant_id_t gid = cpf_grant_direct(DS_PROC_NR, (vir_bytes)buf, len, CPF_READ);
/* ... envía gid en un mensaje ... */
cpf_revoke(gid);

/* quien recibe la concesión */
sys_safecopyfrom(granter_ep, gid, offset, (vir_bytes)local, len);
```

El núcleo comprueba la concesión en cada copia: destinatario correcto,
sentido correcto, dentro de los límites y sin revocar. Las declaraciones están
en [`safecopies.h`]({{repo}}/blob/{{branch}}/minix/include/minix/safecopies.h)
y [`syslib.h`]({{repo}}/blob/{{branch}}/minix/include/minix/syslib.h).

Hay tres tipos de concesión:

| Tipo | Función | Significado |
|---|---|---|
| Directa | `cpf_grant_direct(to, addr, len, access)` | «`to` puede acceder a este rango de **mi** memoria» |
| Indirecta | `cpf_grant_indirect(to, from, gid)` | «`to` puede usar la concesión que me dio `from`». Permite a una capa intermedia pasar el acceso sin copiar, como hace `fbd`, el driver de disco con fallos inyectados |
| Mágica | `cpf_grant_magic(to, from, addr, len, access)` | «`to` puede acceder a la memoria **de otro proceso**». Solo VFS y MIB pueden crearlas (está fijado en el núcleo); VFS las usa para dar a un servidor de ficheros o a un driver acceso directo al búfer de un programa |

`sys_safecopyto()` copia en el otro sentido, `sys_vsafecopy()` hace varias
copias en una llamada, y `CPF_TRY` hace que una copia falle enseguida si la
memoria no está asignada, en lugar de esperar a VM. Así, un driver nunca ve
una dirección de otro proceso: solo recibe los bytes que se le concedieron.

## Un ejemplo real: el almacén de datos

Este es un viaje completo de ida y vuelta sacado de
[`minix/lib/libsys/ds.c`]({{repo}}/blob/{{branch}}/minix/lib/libsys/ds.c),
la biblioteca cliente de DS. Concede a DS permiso de lectura sobre el nombre
de la clave, hace la petición y revoca la concesión:

```c
static int do_invoke_ds(message *m, int type, const char *ds_name)
{
	...
	/* Grant for key. */
	g_key = cpf_grant_direct(DS_PROC_NR, (vir_bytes) ds_name,
		len_key, access);
	if(!GRANT_VALID(g_key))
		return ENOMEM;

	m->m_ds_req.key_grant = g_key;     /* la concesión viaja en el mensaje */
	m->m_ds_req.key_len = len_key;

	r = _taskcall(DS_PROC_NR, type, m); /* pone m_type y llama a ipc_sendrec() */

	cpf_revoke(g_key);
	return r;
}
```

Al otro lado, DS
([`minix/servers/ds/main.c`]({{repo}}/blob/{{branch}}/minix/servers/ds/main.c))
es un bucle simple de recibir, despachar y responder, la forma de casi todos
los servidores:

```c
while (TRUE) {
	get_work(&m);          /* sef_receive(ANY, &m): SEF atiende los mensajes de RS */
	switch (callnr) {
	case DS_PUBLISH:  result = do_publish(&m);  break;
	case DS_RETRIEVE: result = do_retrieve(&m); break;
	...
	default:          result = EINVAL;
	}
	if (result != EDONTREPLY) {
		m.m_type = result;       /* el estado vuelve en m_type */
		reply(who_e, &m);        /* ipc_send() al cliente */
	}
}
```

Y en [`store.c`]({{repo}}/blob/{{branch}}/minix/servers/ds/store.c), DS
recoge la clave con la concesión que ha recibido:

```c
r = sys_safecopyfrom(m_ptr->m_source,
	(cp_grant_id_t) m_ptr->m_ds_req.key_grant, 0,
	(vir_bytes) key_name, m_ptr->m_ds_req.key_len);
```

El cliente está bloqueado en `sendrec` todo el tiempo, así que el servidor
puede responder con un `send` normal: tiene garantizado que el cliente está
esperando. Un servidor que devuelve `EDONTREPLY` se queda con la petición y
responde más tarde; así atienden VFS y RS las operaciones largas.

## La vía rápida SMP y la colocación de servidores

El paso de mensajes está en el camino crítico de todo, así que {{name}}
añade dos optimizaciones en amd64.

**Vía rápida.** Cuando un proceso llama a `sendrec` y el receptor ya está
bloqueado en `receive` esperándolo (o esperando a `ANY`), `do_ipc()` prueba
`fastpath_sendrec()` antes que el código general. Se salta el despacho
genérico, copia el mensaje directamente en el búfer de entrega del receptor
y, si los dos están en la misma CPU, salta directamente al receptor sin
meterlo en la cola de ejecución. Si pasa algo fuera de lo normal (trazado,
un vaciado de TLB pendiente, un filtro de IPC, un problema de permisos),
vuelve a la vía normal, que sigue siendo la implementación de referencia. El
interruptor es `CONFIG_IPC_FASTPATH`, en
[`minix/kernel/kernel.h`]({{repo}}/blob/{{branch}}/minix/kernel/kernel.h).

**Colocación.** El núcleo cuenta, para cada proceso, desde qué CPU le llegan
los mensajes. Cada cinco segundos, el servidor SCHED
([`schedule.c`]({{repo}}/blob/{{branch}}/minix/servers/sched/schedule.c))
lee esas cuentas y, cuando al menos el 70 % de los mensajes que recibió un
proceso en el último intervalo vinieron de una sola CPU, lo traslada a ella
para que la vía rápida pueda saltar directamente. En la práctica, los
procesos que reciben muchos mensajes son servidores y drivers. Nunca mueve
VFS, VM, RS ni al propio SCHED, espera 10 segundos tras el arranque, necesita
al menos 100 mensajes, respeta la afinidad de CPU y espera cada vez más si el
mismo proceso no para de moverse.

Medidas al integrarlas, con cuatro CPUs, la mediana del tiempo de ida y
vuelta bajó de unos 78 300 a 16 100 ciclos de CPU (4,86 veces). El núcleo
sigue funcionando bajo un único cerrojo global, así que el trabajo del núcleo
en CPUs distintas se serializa; un bloqueo más fino queda para el futuro.
Consulta [SMP en amd64](/es/docs/design/smp/).

## Para saber más

- Guía de desarrollo original, paso de mensajes (en inglés):
  <https://wiki.minix3.org/doku.php?id=developersguide:messagepassing>
- Guía de desarrollo original, concesiones de memoria (en inglés):
  <https://wiki.minix3.org/doku.php?id=developersguide:memorygrants>
- Guía de desarrollo original, API del núcleo (en inglés):
  <https://wiki.minix3.org/doku.php?id=developersguide:kernelapi>
- Siguiente: [Aislamiento y autorreparación](/es/docs/learn/reliability/).
