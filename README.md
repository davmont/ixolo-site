# Ixolo website and documentation

The public site for Ixolo, the MINIX 3 derived OS developed in
[davmont/minix](https://github.com/davmont/minix) (branch `devel`). It is
built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build), and outputs a static site that any
web server can host.

```sh
npm install
npm run dev          # http://localhost:4321, live reload
npm run build        # static site in dist/
npm run preview      # serve dist/ (needed to test the docs search)
npm run placeholders # list every value still to decide
npm run sync-docs    # refresh the design documents from devel
```

## Where things are

| Path | What |
|---|---|
| `src/site.config.ts` | **Every value not final yet**: name, version, date, ISO name, checksum, requirements, channels, domain. `null` shows as a yellow `[KEY]` chip. Also the **measured facts** quoted on the pages (kernel size, test scores, LLVM and OpenSSH versions, max CPUs), each with how and when it was measured: re-check them before a release. |
| `src/i18n/ui.ts` | Header and footer strings, EN and ES. |
| `src/i18n/pages/*.ts` | Copy of each page, EN and ES side by side. `{token}` inserts a value from `site.config.ts`. |
| `src/pages/[lang]/*.astro` | Page layouts: home, download, docs hub, project, community, brand. |
| `src/content/docs/{en,es}/docs/` | Documentation (Markdown). `{{token}}` inserts a value from `site.config.ts`, in prose and in code blocks. |
| `src/content/docs/en/docs/design/` | **Generated** by `npm run sync-docs` from the OS repo. Edit them there. |
| `src/styles/global.css` | Brand tokens (colours, type) and shared styles. |
| `design/` | The original mockup the site follows. |

## Languages

Each page exists at `/en/…` and `/es/…`. The root URL `/` sends the visitor to
the language they used last, or else the first supported language in their
browser settings, or else English. The EN · ES switch in the header (and the
language menu in the docs) changes it, and the choice is remembered. This is
done in the browser, so it works on any host.

A docs page with no Spanish version yet shows the English text with a notice.

## Placeholders and the rebrand

The product name, version and every release detail come from
`src/site.config.ts`, so the rebrand and the first release mostly mean
editing that file. `npm run placeholders` lists what is still unset, plus the
few literal `[PLACEHOLDER]` strings in the copy (such as news dates).

## Deploying

`npm run build` produces `dist/`, a plain static site with no server code.

- **GitHub Pages (free), at www.ixolo.org.** `.github/workflows/deploy.yml`
  builds and publishes on every push to `main`. In the repo: Settings → Pages
  → Source: GitHub Actions; Custom domain: `www.ixolo.org`; then tick Enforce
  HTTPS once the certificate is issued. DNS at the registrar:

  | Type | Name | Value |
  |---|---|---|
  | A | `@` | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
  | AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
  | CNAME | `www` | `davmont.github.io` |

  A name with a CNAME can have no other records, so the registrar refuses it
  while `www` has A records. Giving `www` the same four A records instead
  works too, and is the current setup. Either way `ixolo.org` redirects to
  `www.ixolo.org`. Verify the domain under
  your account (Settings → Pages → Add a domain) so no one else can claim it.
- **Plesk VPS.** Create the domain in Plesk and copy `dist/` into its
  `httpdocs`, for example with
  `rsync -av --delete dist/ user@vps:/var/www/vhosts/<domain>/httpdocs/`,
  or use Plesk's Git extension to pull the repo and run `npm ci && npm run build`.
  Enable Let's Encrypt in Plesk for HTTPS.

`domain` in `src/site.config.ts` is used for canonical URLs, `hreflang` links
and the sitemap.

**Release ISOs** (about 1.5 GB) should be attached to GitHub Releases on the OS
repo (2 GB per file limit, free bandwidth), not served from the website host.
