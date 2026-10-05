import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { fmtText } from './lib/ph';

/** {{token}} placeholders in docs frontmatter (title, description). */
const sub = (s: string) => fmtText(s.replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9]*)\s*\}\}/g, '{$1}'));

export const onRequest = defineRouteMiddleware((context) => {
  const route = context.locals.starlightRoute;
  const data = route.entry.data;
  data.title = sub(data.title);
  if (data.description) data.description = sub(data.description);
  for (const h of route.head) {
    if (h.tag === 'title' && h.content) h.content = sub(h.content);
    if (h.tag === 'meta' && typeof h.attrs?.content === 'string') h.attrs.content = sub(h.attrs.content);
  }
});
