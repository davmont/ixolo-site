import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';
import { z } from 'astro/zod';

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        /** Generated from the OS repo by scripts/sync-docs.mjs: edit it there. */
        source: z.string().optional(),
      }),
    }),
  }),
  // Starlight UI strings; empty means Starlight's own en/es translations.
  i18n: defineCollection({ loader: i18nLoader(), schema: i18nSchema() }),
};
