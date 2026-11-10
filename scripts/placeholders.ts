// Lists every value still to decide: unset tokens in src/site.config.ts and
// literal [PLACEHOLDER] text in page copy and docs.   npm run placeholders
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { missing, label } from '../src/lib/ph.ts';

console.log('Unset in src/site.config.ts:');
for (const k of missing()) console.log(`  ${label(k).padEnd(28)} (${k})`);

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) => {
    const p = join(d, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|astro|md|mdx)$/.test(p) ? [p] : [];
  });

console.log('\nLiteral placeholders in the copy:');
const re = /\[([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ _]{2,})\]/g;
for (const f of walk('src')) {
  if (f.includes('lib/ph.ts') || f.endsWith('site.config.ts')) continue;
  // In Markdown, [TEXT](url) is a link and code shows literal text: skip both.
  const md = f.endsWith('.md') || f.endsWith('.mdx');
  let fence = false;
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (md && /^\s*(```|~~~)/.test(line)) fence = !fence;
    if (md && fence) return;
    const prose = md ? line.replace(/`[^`]*`/g, '') : line;
    for (const m of prose.matchAll(re)) {
      if (md && prose[m.index! + m[0].length] === '(') continue;
      console.log(`  ${f}:${i + 1}  ${m[0]}`);
    }
  });
}
