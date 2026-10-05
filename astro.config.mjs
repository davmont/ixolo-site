// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import { unified } from '@astrojs/markdown-remark';
import remarkPlaceholders from './src/lib/remark-placeholders.mjs';
import { site } from './src/site.config.ts';
import { base } from './src/lib/base.mjs';

// Docs sidebar: one group per section of the Documentation page.
const group = (label, es, dir) => ({
  label, translations: { es }, items: [{ autogenerate: { directory: `docs/${dir}` } }],
});

export default defineConfig({
  // Absolute URLs (hreflang, sitemap).  GitHub Pages until the domain exists.
  site: site.domain ? `https://${site.domain}` : 'https://davmont.github.io',
  base: base || '/',
  trailingSlash: 'ignore',
  // Starlight's asides and our {{placeholder}} plugin need the remark pipeline.
  markdown: { processor: unified({ remarkPlugins: [remarkPlaceholders] }) },
  integrations: [
    starlight({
      title: site.name,
      logo: { src: './src/assets/logo.svg', alt: site.name, replacesTitle: false },
      favicon: '/favicon.svg',
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        es: { label: 'Español', lang: 'es' },
      },
      social: [{ icon: 'github', label: 'GitHub', href: site.repo }],
      editLink: { baseUrl: 'https://github.com/davmont/ixolo-site/edit/main/' },
      customCss: ['./src/styles/starlight.css'],
      routeMiddleware: './src/routeData.ts',
      components: {
        SocialIcons: './src/components/starlight/SocialIcons.astro',
        Head: './src/components/starlight/Head.astro',
      },
      sidebar: [
        group('Get started', 'Empezar', 'start'),
        group('Administer', 'Administrar', 'admin'),
        group('Learn', 'Aprender', 'learn'),
        group('Develop', 'Desarrollar', 'develop'),
        group('Reference', 'Referencia', 'reference'),
        group('Design documents', 'Documentos de diseño', 'design'),
      ],
    }),
  ],
});
