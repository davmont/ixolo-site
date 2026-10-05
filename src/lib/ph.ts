import { site } from '../site.config.ts';

/**
 * Placeholder tokens.  Each maps to a value from site.config.ts or to null
 * when the value is not decided yet.  Used three ways:
 *   - fmt('Download {name} {version}')  in page copy (returns HTML)
 *   - {{version}}                        in docs Markdown (remark plugin)
 *   - html('version') / text('version')  in components
 */
const r = site.release;
const rq = site.requirements;

const iso = r.version ? r.isoName.replace('{version}', r.version) : null;

export const tokens: Record<string, string | null> = {
  name: site.name,
  slug: site.slug,
  domain: site.domain,
  maintainer: site.maintainer,
  repo: site.repo,
  branch: site.repoBranch,
  issues: site.issues,
  chat: site.chat,
  mailingList: site.mailingList,
  version: r.version,
  date: r.date,
  iso,
  isoUrl: r.isoUrl,
  isoSize: r.isoSize,
  sha256: r.sha256,
  signatureUrl: r.signatureUrl,
  releaseNotesUrl: r.releaseNotesUrl,
  ram: rq.ram,
  ramDesktop: rq.ramDesktop,
  disk: rq.disk,
  hardware: rq.hardware,
  armStatus: site.arch.arm.status,
  armBoards: site.arch.arm.boards,
  kernelLines: site.facts.kernelLines,
  pjdfstest: site.facts.pjdfstest,
  llvm: site.facts.llvm,
  maxCpus: site.facts.maxCpus,
};

/** Placeholder label shown while a token has no value: version -> VERSION. */
export const label = (k: string) =>
  k === 'iso'
    ? r.isoName.replace('{version}', '[VERSION]')
    : '[' + k.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase() + ']';

/** Plain-text value or placeholder label (for code blocks, attributes). */
export const text = (k: string): string => {
  if (!(k in tokens)) throw new Error(`unknown placeholder token "${k}"`);
  return tokens[k] ?? label(k);
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML for one token: the value, or a highlighted placeholder chip. */
export const html = (k: string): string => {
  if (!(k in tokens)) throw new Error(`unknown placeholder token "${k}"`);
  const v = tokens[k];
  return v != null
    ? esc(v)
    : `<span class="ph" title="Placeholder: set it in src/site.config.ts">${esc(label(k))}</span>`;
};

/**
 * Format page copy: {token} becomes its value (or a chip).  The copy is our
 * own trusted strings and may contain inline HTML such as <code>.
 */
export const fmt = (s: string): string =>
  s.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (m, k) => (k in tokens ? html(k) : m));

/** Same, plain text (for <title>, aria-label, code). */
export const fmtText = (s: string): string =>
  s.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (m, k) => (k in tokens ? text(k) : m));

/** Tokens still unset, for scripts/placeholders.ts. */
export const missing = () =>
  Object.entries(tokens).filter(([, v]) => v == null).map(([k]) => k);
