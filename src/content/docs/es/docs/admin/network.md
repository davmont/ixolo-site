---
title: "Red"
description: "Drivers de red, DHCP y direcciones fijas, IPv6, DNS, el servidor lwIP, SSH y certificados TLS."
sidebar:
  order: 3
---

La red en {{name}} son tres tipos de proceso de usuario que se hablan por
mensajes: un **driver** por tarjeta de red, el **servidor lwIP** con la pila
TCP/IP y los sockets, y los programas que los usan. La configuración es la de
NetBSD: `/etc/rc.conf`, un fichero `/etc/ifconfig.<interfaz>` por tarjeta,
`dhcpcd`, `ifconfig` y `route`.

## Tarjetas de red

Al arrancar, `/usr/etc/rc` lee los identificadores PCI de los dispositivos
Ethernet en `/proc/pci`, los compara con las descripciones de drivers de
`/etc/system.conf.d/` y arranca una instancia de driver por tarjeta
(etiquetas `e1000_0`, `e1000_1`…). Cada driver da nombre a sus interfaces:

| Driver | Hardware | Interfaz | Estado en amd64 |
|---|---|---|---|
| `e1000` | Familia Intel PRO/1000 (82540EM, 82574L…) | `em0` | **Probado** con el `e1000` de QEMU (82540EM), que usan las pruebas de rendimiento de red y las de SSH. Los demás modelos de la lista, como el `e1000e` de QEMU, se reconocen, pero se han probado menos. |
| `igc` | Intel I225/I226 2,5 GbE | `igc0` | Driver inicial: una cola, sin offloads. No verificado en hardware. |
| `virtio_net` | Red virtio (QEMU, KVM) | `vio0` | Se compila; sin probar en amd64. |
| `rtl8139`, `rtl8169` | Realtek | `rl0`, `re0` | Se compilan; sin probar en amd64. |
| `fxp`, `3c90x`, `atl2`, `dec21140A`, `ip1000`, `lance`, `vt6105` | Tarjetas PCI antiguas | varios | Se compilan; sin probar en amd64. |
| `dp8390`, `dpeth` | Tarjetas ISA antiguas (NE2000, 3Com) | `dp0`, `dpe0` | No se detectan solas: se configuran con `netconf`, opción *Manually configure*. Sin probar en amd64. |

«Sin probar» significa exactamente eso: el driver compila para amd64, pero
nadie ha informado de que funcione. Los informes son bienvenidos en el
[gestor de incidencias]({{issues}}). No hay soporte de wifi.

En QEMU, usa una tarjeta e1000 (la de por defecto en `-machine pc`):

```sh
qemu-system-x86_64 ... -nic user,model=e1000
```

Lista las interfaces que ha encontrado el sistema:

```sh
ifconfig -l          # em0 lo0
netconf -l           # interfaces de hardware, y si están configuradas
```

## Configurar con netconf

`netconf` es la herramienta interactiva; `setup` también la ejecuta (paso 8).
Lista las interfaces y ofrece:

1. DHCP, IPv4 e IPv6
2. DHCP, solo IPv4
3. Una dirección IPv4 fija, máscara, pasarela y servidores DNS

Escribe `/etc/ifconfig.<interfaz>` (y, en la configuración fija, también
`/etc/hostname.file` y `/etc/resolv.conf`). Aplica el resultado sin
reiniciar:

```sh
service network restart
```

## Los ficheros de configuración

### /etc/ifconfig.\<interfaz\>

Al arrancar, `/etc/rc.d/network` lee un fichero por interfaz (con
`auto_ifconfig=YES`, el valor por defecto). Cada línea es o bien argumentos
para `ifconfig`, o bien una orden de shell tras `!`, donde `$int` es el
nombre de la interfaz. Esto es lo que escribe `netconf` para DHCP:

```text
up
!dhcpcd -qM $int
```

Para una dirección fija:

```text
up
inet 192.168.1.20 netmask 255.255.255.0
!route -q add default 192.168.1.1
```

Las direcciones IPv6 van en líneas `inet6` del mismo fichero. El formato es
el `ifconfig.if(5)` de NetBSD.

### /etc/rc.conf

Los valores por defecto están en `/etc/defaults/rc.conf`; pon tus cambios en
`/etc/rc.conf`. Las variables que importan para la red:

| Variable | Por defecto | Significado |
|---|---|---|
| `auto_ifconfig` | `YES` | Configura todas las interfaces que tengan un fichero `/etc/ifconfig.*`. |
| `net_interfaces` | `""` | Las interfaces que configurar, si `auto_ifconfig=NO`. |
| `dhcpcd` | `NO` | Ejecuta `dhcpcd` como demonio para todas las interfaces. No hace falta si lo arranca el fichero de la interfaz, como hace `netconf`. |
| `dhcpcd_flags` | `-qM` | Opciones de ese demonio. |
| `ip6mode` | `host` | `host`, `autohost` (acepta anuncios de router) o `router` (reenvía IPv6). |
| `hostname` | `""` | Nombre de la máquina; también se lee `/etc/hostname.file` al arrancar. |
| `defaultroute`, `defaultroute6` | `""` | Una pasarela por defecto, como alternativa a la línea `route` en el fichero de la interfaz. |
| `sshd` | `NO` | Arranca el servidor SSH. |
| `certctl_init` | `YES` | Rellena `/etc/openssl/certs` en el primer arranque que lo encuentre vacío. |
| `inetd` | `YES` | El superservidor de Internet (`/etc/inetd.conf`). |
| `named` | `NO` | El servidor DNS BIND. |

### DNS

El resolvedor lee `/etc/resolv.conf`. Con DHCP, `dhcpcd` lo rellena a través
de `resolvconf`. Con una configuración fija, escríbelo tú (o deja que lo haga
`netconf`):

```text
nameserver 192.168.1.1
nameserver 9.9.9.9
```

`/etc/hosts` funciona como siempre. Para hacer pruebas tienes `dig`, `host`
y `nslookup` (de BIND 9.20.24) en el sistema base.

## dhcpcd

El cliente DHCP es dhcpcd 10.3.1 (el `dhclient` de ISC se eliminó). Gestiona
las concesiones IPv4 y, si no se limita con `-4`, la solicitud de router y
DHCPv6 en IPv6. Sus hooks de `/libexec/dhcpcd-hooks` actualizan
`resolv.conf` y el nombre de la máquina. La configuración está en
`/etc/dhcpcd.conf`; ver `dhcpcd.conf(5)`.

## IPv6

La pila se compila con IPv6, incluido el reensamblado de fragmentos y el
reenvío. `ping6`, `traceroute6`, `ndp` y `rtadvd` están en el sistema base.
Para obtener una dirección automáticamente, elige «DHCP (IPv4 + IPv6)» en
`netconf`; para una fija, añade una línea `inet6` al fichero de la interfaz:

```text
inet6 2001:db8::20 prefixlen 64
```

## El servidor lwIP

La pila TCP/IP es [lwIP](https://savannah.nongnu.org/projects/lwip/) 2.2.1,
con correcciones de seguridad posteriores de upstream, y funciona como un
proceso normal, `/service/lwip`. Implementa la API de sockets BSD para TCP,
UDP, IP en crudo, sockets de enrutamiento y BPF (`/dev/bpf`, que usa
`tcpdump`). Los sockets locales (de dominio Unix) son otro servidor, `uds`.

{{name}} le ha añadido:

- **Escalado de ventana**, **SACK** y **marcas de tiempo** en TCP (RFC 7323,
  RFC 2018), una ventana de recepción de 128 KB y búferes de envío mayores.
  En un enlace con 20 ms de ida y vuelta, el caudal entre dos VM pasó de 0,67
  a 2,51 MB/s.
- `SO_REUSEPORT`, que reparte las conexiones entrantes entre varios sockets
  a la escucha (lo necesita el `named` multihilo de BIND).
- Las opciones de socket de multicast de NetBSD, el estado del enlace en
  `ifconfig`, y `accept4`/`paccept`.

### Qué supone un reinicio

Si lwIP falla, RS lo reinicia como a cualquier otro servicio, con el script
de recuperación `/etc/rs.lwip`. Un lwIP nuevo no tiene nada del estado
anterior, así que:

- desaparecen todos los sockets abiertos: las conexiones TCP establecidas se
  cortan y los programas tienen que volver a conectar;
- el script para y vuelve a arrancar los demonios de red conocidos
  (`dhcpcd`, `inetd`, `sshd`, `syslogd`, `named`, `network`…) para que
  reabran sus sockets y las interfaces se configuren de nuevo.

Un **driver de red** que falla sale más barato: RS lo reinicia, lwIP engancha
el nuevo proceso a la misma interfaz, y la configuración y los sockets
sobreviven. Como mucho se pierden algunos paquetes y TCP los reenvía.
Pruébalo en el [laboratorio «rompe un driver»](/es/docs/learn/lab-break-a-driver/).

## Herramientas

| Herramienta | Uso |
|---|---|
| `ifconfig` | Direcciones, flags y estado del enlace de las interfaces |
| `route` | La tabla de rutas: `route show`, `route add default <pasarela>` |
| `netstat` | Sockets y estadísticas: `netstat -an`, `netstat -rn` |
| `ping`, `ping6` | Alcanzabilidad |
| `traceroute`, `traceroute6` | El camino hasta una máquina |
| `arp`, `ndp` | Cachés de vecinos (IPv4, IPv6) |
| `tcpdump` | Captura de paquetes (4.99.6) |
| `ftp` | Descargas por FTP, HTTP y HTTPS: `ftp https://example.org/fichero` |
| `telnet` | Probar un puerto TCP |

## SSH

OpenSSH {{openssh}} está en el sistema base: `ssh`, `scp`, `sftp`,
`ssh-keygen`, `ssh-agent` y el servidor `sshd`. Se compila sin PAM y sin
llaves de seguridad FIDO. El cliente funciona sin más:

```sh
ssh alicia@servidor.example.org
```

El servidor viene desactivado. Actívalo y arráncalo; el primer arranque crea
las claves de máquina ECDSA, Ed25519 y RSA:

```sh
echo sshd=YES >> /etc/rc.conf
service sshd start
```

La configuración está en `/etc/ssh/sshd_config`. Como en OpenSSH estándar,
`root` solo puede entrar con clave (`PermitRootLogin prohibit-password`). Los
usuarios necesitan una contraseña puesta con `passwd` o una clave en
`~/.ssh/authorized_keys`.

Para llegar al servidor SSH del invitado desde el host de QEMU, redirige un
puerto:

```sh
qemu-system-x86_64 ... -nic user,model=e1000,hostfwd=tcp::2222-:22
ssh -p 2222 alicia@localhost      # en el host
```

La ISO live tiene `/etc` en solo lectura, así que usa el servidor en un
sistema instalado.

## Certificados TLS

Los programas que usan OpenSSL (3.5.7) verifican los servidores contra los
anclajes de confianza de `/etc/openssl/certs`. Salen de la lista de CA de
Mozilla, instalada en `/usr/share/certs/mozilla`, y `certctl` construye el
directorio a partir de ella:

```sh
certctl list          # certificados de confianza
certctl rehash        # reconstruye /etc/openssl/certs tras un cambio
```

En un sistema instalado, `certctl_init=YES` construye el directorio en el
primer arranque. La ISO live lo lleva ya hecho. Para confiar en una CA local,
pon su certificado en un directorio propio, añade una línea `path` con ese
directorio a `/etc/openssl/certs.conf` y ejecuta `certctl rehash`.
`certctl untrust` retira la confianza a un certificado. Consulta
`certctl(8)`.

## Para saber más

- Páginas de manual de NetBSD: [ifconfig.if(5)](https://man.netbsd.org/ifconfig.if.5),
  [rc.conf(5)](https://man.netbsd.org/rc.conf.5),
  [dhcpcd(8)](https://man.netbsd.org/dhcpcd.8),
  [certctl(8)](https://man.netbsd.org/certctl.8)
- Guía de red de MINIX 3 upstream (pila y versiones antiguas):
  <https://wiki.minix3.org/doku.php?id=usersguide:networkconfiguration>
