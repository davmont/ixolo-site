// Path prefix the site is served under.  '' on its own domain; '/ixolo-site'
// on davmont.github.io/ixolo-site/ until the domain exists.  Set by the
// BASE_PATH environment variable at build time (see the deploy workflow).
export const base = (process.env.BASE_PATH ?? '').replace(/\/+$/, '');

/** Prefix a root-relative path ('/en/download/') with the base. */
export const url = (p) => (p.startsWith('/') && !p.startsWith('//') ? base + p : p);
