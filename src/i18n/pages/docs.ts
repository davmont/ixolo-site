// Documentation map: the hub page (/[lang]/docs/) is built from this list.
// slug = path under src/content/docs/<lang>/docs/.
type Item = [slug: string, en: string, es: string];
type Group = { id: string; en: [string, string]; es: [string, string]; items: Item[] };

export const groups: Group[] = [
  {
    id: 'start', en: ['Get started', 'For first-time visitors.'], es: ['Empezar', 'Para quien llega por primera vez.'],
    items: [
      ['start/quickstart', 'From zero to login in 15 minutes', 'De cero a login en 15 minutos'],
      ['start/install', 'Install to disk', 'Instalar en disco'],
      ['start/shell-packages', 'The shell and pkgsrc packages', 'La shell y los paquetes pkgsrc'],
    ],
  },
  {
    id: 'admin', en: ['Administer', 'Running {name} for real.'], es: ['Administrar', 'Para poner {name} en producción.'],
    items: [
      ['admin/services', 'Services and the Reincarnation Server', 'Servicios y el Reincarnation Server'],
      ['admin/filesystems', 'File systems: MFS v4, ext4, FAT, exFAT', 'Sistemas de ficheros: MFS v4, ext4, FAT, exFAT'],
      ['admin/network', 'Networking', 'Red'],
      ['admin/desktop', 'Wayland desktop (experimental)', 'Escritorio Wayland (experimental)'],
    ],
  },
  {
    id: 'learn', en: ['Learn', 'Education track for classes and self-learners.'], es: ['Aprender', 'Track educativo para clases y autodidactas.'],
    items: [
      ['learn/architecture', 'The architecture in four layers', 'La arquitectura en cuatro capas'],
      ['learn/message-passing', 'Message passing', 'Paso de mensajes'],
      ['learn/lab-break-a-driver', 'Lab: break a driver', 'Laboratorio: rompe un driver'],
      ['learn/teachers', 'Guide for teachers', 'Guía para docentes'],
    ],
  },
  {
    id: 'develop', en: ['Develop', 'Contributing to the system.'], es: ['Desarrollar', 'Para contribuir al sistema.'],
    items: [
      ['develop/building', 'Building from source', 'Compilar desde el código'],
      ['develop/drivers', 'Writing a driver', 'Escribir un driver'],
      ['develop/testing', 'Tests and continuous integration', 'Pruebas e integración continua'],
      ['develop/contributing', 'Contributing and code style', 'Contribuir y estilo de código'],
    ],
  },
  {
    id: 'reference', en: ['Reference', 'Quick lookup.'], es: ['Referencia', 'Consulta rápida.'],
    items: [
      ['reference/man', 'Manual pages', 'Páginas de manual'],
      ['reference/syscalls', 'System calls', 'Llamadas al sistema'],
      ['reference/posix', 'POSIX compatibility', 'Compatibilidad POSIX'],
      ['reference/release-notes', 'Release notes', 'Notas de versión'],
    ],
  },
];

/** Design documents, synced from the OS repository by scripts/sync-docs.mjs. */
export const designDocs: [slug: string, file: string, en: [string, string], es: [string, string]][] = [
  ['design/smp', 'SMP_NOTES.md', ['SMP on amd64', 'How the two bugs that blocked multiprocessing were fixed.'], ['SMP en amd64', 'Cómo se arreglaron los dos bugs que bloqueaban el multiprocesador.']],
  ['design/journal', 'JOURNAL_DESIGN.md', ['Journaling in MFS', 'Write-ahead log and automatic recovery at mount time.'], ['Journaling en MFS', 'Registro de escritura anticipada y recuperación automática al montar.']],
  ['design/mfsv4', 'MFSV4_DESIGN.md', ['MFS version 4', 'The new on-disk format with optional features.'], ['MFS versión 4', 'El nuevo formato con características activables.']],
  ['design/reclaim', 'RECLAIM_DESIGN.md', ['Memory reclaim', 'Reclaim, compression and disk swap in the memory manager.'], ['Recuperación de memoria', 'Reclaim, compresión y swap a disco en el gestor de memoria.']],
  ['design/xattr', 'XATTR_DESIGN.md', ['Extended attributes', 'xattrs and access control lists.'], ['Atributos extendidos', 'xattr y listas de control de acceso.']],
  ['design/uefi-boot', 'UEFI_BOOT.md', ['UEFI boot', 'The hybrid BIOS + UEFI CD image.'], ['Arranque UEFI', 'La imagen de CD híbrida BIOS + UEFI.']],
  ['design/wayland', 'WAYLAND.md', ['Wayland', 'The Wayland stack and the wlcompd compositor.'], ['Wayland', 'La pila Wayland y el compositor wlcompd.']],
];

export const hub = {
  en: {
    title: 'Documentation',
    description: 'Guides, education track, developer docs, reference and design documents for {name}.',
    eyebrow: 'Documentation',
    h1: 'Learn, administer and build.',
    search: 'Search the documentation',
    designEyebrow: 'Design documents',
    designH2: 'Every decision, in writing.',
    designP: 'Important subsystems have a design document: what problem they solve, how, and what was ruled out. Good material for class and for anyone who wants to contribute.',
    draft: 'draft',
  },
  es: {
    title: 'Documentación',
    description: 'Guías, track educativo, documentación para desarrolladores, referencia y documentos de diseño de {name}.',
    eyebrow: 'Documentación',
    h1: 'Aprende, administra y construye.',
    search: 'Buscar en la documentación',
    designEyebrow: 'Documentos de diseño',
    designH2: 'Cada decisión, por escrito.',
    designP: 'Los subsistemas importantes tienen su documento de diseño: qué problema resuelven, cómo y qué se descartó. Material ideal para clase y para quien quiera contribuir.',
    draft: 'borrador',
  },
};
