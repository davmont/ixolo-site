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
  /** Public domain, without protocol.  Also set in repo Settings → Pages. */
  domain: 'www.ixolo.org' as string | null,
  maintainer: 'David Montero',

  repo: 'https://github.com/davmont/ixolo',
  repoBranch: 'devel',
  issues: 'https://github.com/davmont/ixolo/issues',
  ci: 'https://github.com/davmont/ixolo/actions/workflows/ci.yml',

  /** Community channels (Comunidad page). */
  discussions: 'https://github.com/davmont/ixolo/discussions',
  /** Private reports under the code of conduct (Contributor Covenant 2.1). */
  conductEmail: 'conduct@ixolo.org',

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
    /** What CI tests every change with (qemutest.py's default, 1024 MB).
     *  The devel snapshot of 2026-11-15 (2696e69599) boots to a login in
     *  128 MB; at 256 MB the quick suite does not pass (tests 72 and 79
     *  hang, 74 is killed), though its 128 MB test ramdisk takes half. */
    ram: '1 GB' as string | null,
    ramDesktop: null as string | null,
    /** setup needs 3 MB + the sets + a 128 MB root: 1 046 MB on the devel
     *  snapshot of 2026-11-11 (3d1d1d0af1, without on-target clang).  2 GB
     *  leaves room for the release's larger sets and matches the OS README. */
    disk: '2 GB' as string | null,
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

/**
 * Pre-release mode: until `release.version` is set the site shows no release
 * details (version, date, ISO, checksum) and offers the CI snapshots and the
 * build from source instead.  Setting the version switches it off.
 */
export const released = site.release.version != null;

export type Lang = 'en' | 'es';
export const languages: Record<Lang, string> = { en: 'English', es: 'Español' };
export const defaultLang: Lang = 'en';
