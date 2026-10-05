---
title: Compilar desde el código
description: Compila {{name}} para amd64 de forma cruzada en un host Linux y genera una ISO arrancable.
sidebar:
  order: 1
---

{{name}} se compila de forma cruzada en un host Linux con el `build.sh` de
NetBSD. Una orden construye la toolchain cruzada (LLVM/clang {{llvm}} y
`ld.lld`) y después todo el sistema: núcleo, servidores, drivers, bibliotecas
y espacio de usuario. Una segunda orden empaqueta el resultado en una ISO
híbrida UEFI/BIOS.

Son los mismos pasos que ejecuta la CI en cada pull request
([`ci.yml`]({{repo}}/blob/{{branch}}/.github/workflows/ci.yml)).

## Requisitos del host

- Linux en x86-64. Nombres de paquetes en Debian/Ubuntu:

  ```sh
  sudo apt install build-essential clang zlib1g-dev python3 git
  ```

- Unos 10 GB libres de disco para el código y el directorio de objetos.
- Tiempo: la primera compilación construye LLVM para la toolchain cruzada y
  puede tardar unas horas. Las siguientes la reutilizan (`-u`) y solo
  recompilan lo que cambia.

## Obtén el código

```sh
git clone {{repo}}.git
cd minix
git checkout {{branch}}
```

El desarrollo se hace en `{{branch}}`: es la rama que hay que compilar y contra
la que se envían los pull requests.

## Compila

```sh
sh build.sh -m amd64 -U -u -j$(nproc) -O obj.amd64 -V MKLLVMCMDS=no release
```

| Opción | Significado |
|---|---|
| `-m amd64` | Máquina destino. También existen `i386` y `evbearm`; usa directorios de objetos distintos para cada una. |
| `-U` | Compilación sin privilegios: no hace falta root; los propietarios de los ficheros se anotan en un metalog. |
| `-u` | Actualizar: no limpia antes; reutiliza la toolchain y los objetos. |
| `-O obj.amd64` | Directorio de objetos: todo lo compilado va aquí y el árbol de código queda limpio. |
| `-V MKLLVMCMDS=no` | Omite el clang nativo del sistema (horas de compilación). Quítalo si quieres un compilador dentro del sistema. |
| `release` | Construye la toolchain, el sistema y los conjuntos de instalación. |

## Genera la ISO

```sh
OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG={{iso}} \
  bash releasetools/amd64_cdimage.sh
```

La imagen arranca en BIOS y UEFI. Pruébala como en la
[guía rápida](/es/docs/start/quickstart/):

```sh
qemu-system-x86_64 -enable-kvm -cpu host -m 2G -smp 2 -cdrom {{iso}}
```

## El escritorio (opcional)

El escritorio LXQt/Qt 6 se compila fuera del árbol, a partir de fuentes
originales con versiones fijadas, y se superpone a la ISO. Necesita `meson`,
`ninja`, `cmake`, `curl`, `patch`, `pkg-config` y un Qt en el host de la misma
versión que el del sistema. Consulta
[`releasetools/DESKTOP.md`]({{repo}}/blob/{{branch}}/releasetools/DESKTOP.md).

```sh
sh releasetools/build-desktop.sh
MKDESKTOP=yes OBJ=obj.amd64 CREATE_IMAGE_ONLY=1 IMG={{iso}} \
  bash releasetools/amd64_cdimage.sh
```

## Ejecuta las pruebas

```sh
python3 releasetools/qemutest.py --iso {{iso}} --suite quick \
  --xfail releasetools/qemutest.xfail
```

Consulta [Pruebas e integración continua](/es/docs/develop/testing/).

## Problemas habituales

- **El núcleo se detiene pronto en QEMU sin dar mensaje.** La CPU del invitado
  no tiene `FSGSBASE`. Usa `-cpu host` con KVM o `-cpu max` sin él.
- **Fallos extraños tras actualizar el compilador o el núcleo del host.** La
  toolchain guardada en `obj.amd64/tooldir.*` la construyó el host anterior.
  Recompílala una vez sin `-u`.
- **Mezclar arquitecturas.** No uses nunca un directorio de objetos amd64 para
  una compilación i386, ni al revés.
