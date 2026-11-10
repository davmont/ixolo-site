---
title: "Seguridad"
description: "El modelo de seguridad, el endurecimiento en amd64, lo que falta todavía y cómo informar de una vulnerabilidad."
sidebar:
  order: 4
---

Esta página describe qué protege hoy a un sistema {{name}} en amd64 y qué no
existe todavía. Su objetivo es ayudarte a juzgar dónde encaja el sistema, no
venderlo. {{name}} es un fork joven, con un único mantenedor y sin auditoría de
seguridad externa.

## El modelo: aislamiento y mínimo privilegio

La principal propiedad de seguridad viene del diseño. Los drivers, los sistemas
de ficheros, la pila de red y los demás servidores son procesos separados en
modo usuario, no código dentro del núcleo. Cada uno se ejecuta solo con los
privilegios que tiene asignados en `/etc/system.conf` o en
`/etc/system.conf.d/<nombre>`:

- qué **llamadas al núcleo** puede hacer (`system`);
- a qué **procesos** puede enviar mensajes (`ipc`);
- qué **puertos de E/S**, **líneas de IRQ** y **dispositivos PCI** puede usar
  (`io`, `irq`, `pci device`);
- con qué **ID de usuario** se ejecuta (la mayoría de los drivers, con el
  usuario sin privilegios `service`).

Un servicio no puede leer directamente la memoria de otro proceso. Solo puede
copiar la memoria que su dueño le ha concedido de forma explícita (concesiones
de memoria, que comprueba el núcleo). Un fallo en el servidor de FAT o en el
driver de la tarjeta de red queda, por tanto, contenido: el Reincarnation
Server puede matar y reiniciar el proceso defectuoso sin tumbar el núcleo, y
ese proceso nunca tuvo permiso para tocar hardware o ficheros ajenos. La
[página de servicios](/es/docs/admin/services/) explica las claves de
configuración.

Límites actuales de este modelo:

- Los drivers que hacen DMA programan el dispositivo directamente, y ninguna
  IOMMU (VT-d o AMD-Vi) limita dónde escribe el dispositivo. Un driver
  comprometido de un dispositivo con *bus mastering* puede llegar a toda la
  memoria física.
- Varios servidores centrales (`vfs`, `pm`, `vm`, `rs`) se ejecutan como root
  y con privilegios amplios, como tiene que ser.
- Los programas de usuario normales se protegen entre sí con los permisos Unix
  de siempre, y nada más: no hay control de acceso obligatorio ni un sistema de
  *sandboxing*.

## Protección del núcleo y de la memoria

| Función | Estado | Notas |
|---|---|---|
| NX (no ejecución) | activa | La memoria mapeada sin `PROT_EXEC`, pilas incluidas, no es ejecutable. `mprotect` se respeta. |
| SMEP y SMAP | activas si la CPU las tiene | El núcleo no puede ejecutar páginas de usuario ni leerlas o escribirlas por accidente. No son obligatorias: las CPU antiguas arrancan sin ellas. |
| Comprobación de punteros de usuario | activa | El núcleo rechaza un búfer de llamada al sistema que apunte a memoria del núcleo ([PR #440]({{repo}}/pull/440)). |
| Protección de escritura en todas las CPU | activa | `CR0.WP` se activa en todos los procesadores, no solo en el primero. |
| Entrada a llamadas al sistema endurecida | activa | Los flags del usuario, como el de traza, ya no se cuelan en el núcleo con `SYSCALL`. |
| Espacio de direcciones de usuario de 47 bits | activo | Los procesos de usuario disponen de 128 TB de espacio virtual. Los servicios que arranca RS se quedan por debajo de 1 GB. |

## Endurecimiento de los programas de usuario

| Función | Estado | Alcance |
|---|---|---|
| Protector de pila (`-fstack-protector`) | activo | Programas y bibliotecas de usuario. El valor de guarda sale de la fuente aleatoria del núcleo y cambia de un proceso a otro. |
| `_FORTIFY_SOURCE=2` | activo | Programas y bibliotecas de usuario; la propia libc queda fuera. Los desbordamientos que el compilador puede detectar terminan en `SIGABRT`. |
| ASLR | parcial | La pila y la base de `mmap` (bibliotecas compartidas, zonas de `malloc`) se aleatorizan en cada `exec`. |
| Ejecutables PIE | **no** | Los ejecutables se enlazan en una dirección fija. |
| RELRO | **no** | |

Dos consecuencias que conviene conocer:

- **El ASLR es parcial.** Como los ejecutables no son independientes de la
  posición, su código, sus datos y su montículo `brk` están en la misma
  dirección en cada ejecución. Solo se mueven la pila y la zona de `mmap`. Los
  exploits que se apoyan en código del programa principal no se ven frenados.
- **El núcleo y los servicios del sistema no se compilan con protector de pila
  ni FORTIFY.** Esas opciones solo cubren los programas de usuario y las
  bibliotecas que enlazan. Los servicios que arranca RS mantienen además una
  disposición de memoria fija, que es la que espera la actualización en
  caliente.

## Cuentas y contraseñas

- Los soportes de instalación entran como `root` **sin contraseña**. Vale para
  un CD live, no para una máquina expuesta a la red.
- `setup` pide una contraseña de root para el sistema instalado (paso 9) y no
  acepta una vacía.
- Las contraseñas nuevas se cifran con **bcrypt** (`localcipher = blowfish,10`
  en `/etc/passwd.conf`). Los hashes antiguos siguen funcionando.

Después de instalar, crea un usuario normal y usa `su` para las tareas de root:

```sh
useradd -m -G wheel alice
passwd alice
```

## Acceso remoto: OpenSSH

OpenSSH {{openssh}} está en el sistema base (`ssh`, `sshd`, `scp`, `sftp`),
compilado sin PAM y sin soporte para llaves de seguridad FIDO2. El servidor
viene desactivado. Para activarlo, añade esto a `/etc/rc.conf`:

```sh
sshd=YES
```

Después arráncalo, o reinicia:

```sh
service sshd start
```

En el primer arranque, `/etc/rc.d/sshd` genera las claves de host ECDSA,
Ed25519 y RSA en `/etc/ssh`. Se usa el `sshd_config` de serie: `root` puede
entrar con una clave, pero no con contraseña. Comprueba las huellas de las
claves de host desde la consola antes de fiarte de ellas en un cliente:

```sh
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

La configuración de red está en [red](/es/docs/admin/network/).

## TLS: OpenSSL y certificados de CA

El sistema trae **OpenSSL 3.5.7**, de la rama 3.5 de soporte extendido (LTS), y
el conjunto de certificados de CA de Mozilla. `certctl` construye el almacén de
confianza en `/etc/openssl/certs`, que es donde lo busca OpenSSL:

- En un sistema instalado, el script de rc.d `certctl_init` (activado por
  defecto) ejecuta `certctl rehash` en el primer arranque.
- El CD live trae el almacén ya construido en la imagen.
- Después de añadir o quitar un certificado, ejecuta `certctl rehash`.
  `certctl list` muestra los certificados de confianza y
  `certctl untrust <fichero>` retira la confianza en uno.

Con el almacén en su sitio, `ftp https://...` y `openssl s_client` verifican
los servidores.

## Lo que todavía no hay

Para que no haya sorpresas:

- **Ejecutables PIE** y ASLR completo. Está previsto.
- **RELRO**.
- **Protector de pila y FORTIFY para el núcleo y los servicios del sistema.**
- **Secure Boot de UEFI.** La ISO arranca con UEFI, pero no está firmada.
- Protección con **IOMMU** frente al DMA de los dispositivos.
- **Actualización en caliente** de servicios como forma de aplicar parches de
  seguridad: es experimental y no está soportada en amd64.
- **No hay repositorio de paquetes binarios**, así que no hay actualizaciones
  de seguridad automáticas. Se actualiza recompilando desde el código.

## Informar de una vulnerabilidad

Informa de los problemas de seguridad **en privado**, no en una discusión,
issue o pull request públicos.

- Usa el aviso privado de vulnerabilidades de GitHub en el repositorio: la
  pestaña **Security** de [{{repo}}]({{repo}}) y después
  **Report a vulnerability**. El informe solo lo ve el mantenedor,
  {{maintainer}}.
- Indica el commit o la ISO afectados, los pasos para reproducirlo y qué gana
  un atacante. Un pequeño programa de prueba ayuda mucho.

:::note
El repositorio todavía no tiene un fichero `SECURITY.md`, y puede que el aviso
privado no esté activado cuando leas esto. Si no ves el botón
**Report a vulnerability**, contacta con {{maintainer}} a través de GitHub y
pide un canal privado antes de enviar ningún detalle.
:::
