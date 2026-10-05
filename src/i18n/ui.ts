import type { Lang } from '../site.config';

/** Site chrome (header, footer, shared labels).  Page copy lives in i18n/pages/. */
export const ui = {
  en: {
    skip: 'Skip to content',
    homeLabel: '{name}, home',
    nav: { download: 'Download', docs: 'Docs', project: 'Project', community: 'Community', brand: 'Brand' },
    navLabel: 'Main',
    github: 'GitHub',
    cta: 'Download',
    langLabel: 'Language',
    tagline: 'The operating system that regenerates. Microkernel, isolated and self-healing.',
    footer: {
      system: 'System', learn: 'Learn', project: 'Project', community: 'Community',
      downloads: 'Downloads', releaseNotes: 'Release notes', requirements: 'Requirements',
      docs: 'Documentation', architecture: 'Architecture', education: 'Education track',
      mission: 'Mission and values', roadmap: 'Roadmap', brand: 'Brand and name',
      contribute: 'Contribute', source: 'Source code', coc: 'Code of conduct',
    },
    legal:
      '{name} is derived from MINIX 3 and distributed under the MINIX 3 licence (BSD-style). ' +
      'It is not affiliated with the Vrije Universiteit or the Stichting MINIX Research Foundation; ' +
      'MINIX and its mascot belong to their respective owners. Maintained by {maintainer}.',
  },
  es: {
    skip: 'Saltar al contenido',
    homeLabel: '{name}, inicio',
    nav: { download: 'Descargas', docs: 'Documentación', project: 'Proyecto', community: 'Comunidad', brand: 'Marca' },
    navLabel: 'Principal',
    github: 'GitHub',
    cta: 'Descargar',
    langLabel: 'Idioma',
    tagline: 'El sistema operativo que se regenera. Microkernel, aislado y autorreparable.',
    footer: {
      system: 'Sistema', learn: 'Aprender', project: 'Proyecto', community: 'Comunidad',
      downloads: 'Descargas', releaseNotes: 'Notas de versión', requirements: 'Requisitos',
      docs: 'Documentación', architecture: 'Arquitectura', education: 'Track educativo',
      mission: 'Misión y valores', roadmap: 'Hoja de ruta', brand: 'Marca y nombre',
      contribute: 'Contribuir', source: 'Código fuente', coc: 'Código de conducta',
    },
    legal:
      '{name} es un sistema derivado de MINIX 3 y se distribuye bajo la licencia de MINIX 3 (estilo BSD). ' +
      'No está afiliado a la Vrije Universiteit ni a la Stichting MINIX Research Foundation; ' +
      'MINIX y su mascota pertenecen a sus respectivos titulares. Mantenido por {maintainer}.',
  },
} as const;

/** Marketing pages share their slugs across languages: /en/download, /es/download. */
export type PageKey = 'home' | 'download' | 'docs' | 'project' | 'community' | 'brand';
const slugs: Record<PageKey, string> = {
  home: '', download: 'download/', docs: 'docs/', project: 'project/',
  community: 'community/', brand: 'brand/',
};

export const href = (lang: Lang, page: PageKey | string, hash = '') =>
  `/${lang}/${page in slugs ? slugs[page as PageKey] : page}${hash ? '#' + hash : ''}`;

/** Docs page link: doc(lang, 'start/quickstart'). */
export const doc = (lang: Lang, slug: string) => `/${lang}/docs/${slug}/`;
