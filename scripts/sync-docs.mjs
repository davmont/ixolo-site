#!/usr/bin/env node
// Pull the design documents from the OS repository into the docs.
//
//   npm run sync-docs                 # from GitHub, branch devel
//   MINIX_SRC=../minix npm run sync-docs   # from a local checkout instead
//
// The files land in src/content/docs/en/docs/design/ with a "generated"
// banner; edit them in the OS repository, not here.  Spanish pages fall back
// to the English text until a translation exists.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const REPO = 'davmont/minix';
const BRANCH = process.env.MINIX_BRANCH ?? 'devel';
const LOCAL = process.env.MINIX_SRC;

// slug -> [path in the OS repo, sidebar order]
const DOCS = {
  smp: ['minix/kernel/arch/x86_64/SMP_NOTES.md', 1],
  journal: ['minix/fs/mfs/JOURNAL_DESIGN.md', 2],
  mfsv4: ['minix/fs/mfs/MFSV4_DESIGN.md', 3],
  reclaim: ['minix/servers/vm/RECLAIM_DESIGN.md', 4],
  xattr: ['minix/fs/mfs/XATTR_DESIGN.md', 5],
  'uefi-boot': ['docs/UEFI_BOOT.md', 6],
  wayland: ['docs/WAYLAND.md', 7],
};

const blob = (p) => `https://github.com/${REPO}/blob/${BRANCH}/${p}`;

async function fetchDoc(path) {
  if (LOCAL) return readFile(join(LOCAL, path), 'utf8');
  const url = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

/** Relative links in the source point into the repo: make them absolute. */
function rewriteLinks(md, path) {
  const dir = path.split('/').slice(0, -1).join('/');
  return md.replace(/\]\((?!https?:|#|mailto:)([^)\s]+)\)/g, (_, rel) => {
    const parts = (dir ? dir + '/' + rel : rel).split('/');
    const out = [];
    for (const p of parts) p === '..' ? out.pop() : p !== '.' && out.push(p);
    return `](${blob(out.join('/'))})`;
  });
}

const outDir = 'src/content/docs/en/docs/design';
await mkdir(outDir, { recursive: true });

for (const [slug, [path, order]] of Object.entries(DOCS)) {
  let md = await fetchDoc(path);
  // The first H1 becomes the page title.
  const h1 = md.match(/^#\s+(.+)$/m);
  const title = (h1 ? h1[1] : slug).replace(/[`*]/g, '').trim();
  if (h1) md = md.replace(h1[0], '').replace(/^\s+/, '');
  md = rewriteLinks(md, path);
  const front = [
    '---',
    `title: ${JSON.stringify(title)}`,
    `source: ${JSON.stringify(blob(path))}`,
    'editUrl: ' + JSON.stringify(blob(path)),
    'sidebar:',
    `  order: ${order}`,
    '---',
    '',
    `:::note[Generated from the source tree]`,
    `This page is a copy of [\`${path}\`](${blob(path)}) on the \`${BRANCH}\` branch.`,
    'Edit it there; `npm run sync-docs` refreshes this copy.',
    ':::',
    '',
    '',
  ].join('\n');
  await writeFile(join(outDir, `${slug}.md`), front + md);
  console.log(`design/${slug}.md  <-  ${path}`);
}
