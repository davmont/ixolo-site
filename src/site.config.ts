/**
 * Single source of truth for every value that is not final yet.
 *
 * Anything set to `null` is a placeholder: pages render it as a visible
 * [KEY] chip (see lib/ph.ts) and
 * `npm run placeholders` lists it.  Fill a value here and it changes
 * everywhere: marketing pages, docs (via {{key}} in Markdown) and the footer.
 */

export const site = {
  /** Product name.  The rebrand is still in progress: change it here only. */
  name: 'Ixolo',
  /** Lower-case wordmark used by the logo and file names. */
  slug: 'ixolo',
  /** Public domain, without protocol.  null until it is bought. */
  domain: null as string | null,
  maintainer: 'David Montero',

  repo: 'https://github.com/davmont/minix',
  repoBranch: 'devel',
  issues: 'https://github.com/davmont/minix/issues',
  ci: 'https://github.com/davmont/minix/actions/workflows/ci.yml',

  /** Community channels (Comunidad page). */
  chat: null as string | null,
  mailingList: null as string | null,

  release: {
    /** e.g. '1.0'.  First official release: with desktop. */
    version: null as string | null,
    /** ISO date, e.g. '2027-01-15'. */
    date: null as string | null,
    /** Hybrid UEFI + BIOS ISO. {version} is substituted. */
    isoName: 'ixolo-{version}-amd64.iso',
    isoUrl: null as string | null,
    isoSize: null as string | null,
    sha256: null as string | null,
    signatureUrl: null as string | null,
    releaseNotesUrl: null as string | null,
  },

  requirements: {
    ram: null as string | null,
    ramDesktop: null as string | null,
    disk: null as string | null,
    /** Physical machines verified to boot and run the release. */
    hardware: null as string | null,
  },

  /**
   * Facts quoted on the pages, with how they were measured, so they can be
   * re-checked before each release.
   */
  facts: {
    /** Non-blank, non-comment lines of minix/kernel incl. arch/x86_64,
     *  excluding i386/earm (.c .h .S).  15 476 on devel 326a1d6f08,
     *  2026-11-10.  Rounded down on purpose: the pages say "about". */
    kernelLines: '15\u202F000', // narrow no-break space: valid in EN and ES
    /** pjdfstest: 229 passed, 0 unexpected failures, of 238 scripts
     *  (PR #408, 2026-10-05; unchanged through PR #488). */
    pjdfstestPassed: '229',
    pjdfstestTotal: '238',
    /** Open POSIX Test Suite (LTP 20250130), KVM, 2 CPUs: 1645 passed,
     *  0 unexpected failures (PR #488, 2026-11-10).  Run by hand, not in CI. */
    posixPassed: '1645',
    posixTotal: '1757',
    /** In-tree LLVM/clang/lld 22.1.7 (external/apache2/llvm/Makefile.inc). */
    llvm: '22',
    /** CONFIG_MAX_CPUS in minix/kernel/Makefile.  Tested on 1, 2, 4, 8. */
    maxCpus: '32',
    /** OpenSSH version shipped in base (PR #446). */
    openssh: '10.6',
  },
} as const;

export type Lang = 'en' | 'es';
export const languages: Record<Lang, string> = { en: 'English', es: 'Español' };
export const defaultLang: Lang = 'en';
