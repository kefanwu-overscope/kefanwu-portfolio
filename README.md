# Kefan Wu Portfolio Site

Static portfolio for **[www.kefanwu.com](https://www.kefanwu.com)** — no
framework, no build step, no package install. Auto-deploys to Vercel from the
`main` branch of `github.com/kefanwu-overscope/kefanwu-portfolio`.

## Two surfaces

- **`index.html`** — the canonical, crawlable homepage: hero, project grid (14
  case studies in a modal), skill matrix, motorsport feature, capabilities,
  contact, and a resume PDF. Styled by `styles.css`, driven by `script.js`.
- **`experience.html`** — an interactive 3D "studio" (three.js r0.185, buildless
  via a jsDelivr import map): a night-lit engineering room where the resume sits
  on the desk and all 14 projects are clickable exhibits. Styled by
  `experience.css`, driven by the `experience.js` module. Deep-linkable:
  `experience.html#steering` flies straight to that exhibit.

`project-data.js` is the single source of truth for case-study content, shared
by both pages.

## Local preview

The site is plain static files — serve the folder with any static server and
open `index.html`. There is no Python on PATH on this machine; use a bundled
interpreter or the editor's live-preview. During development it is served on
`http://localhost:4173/`.

## Docs

- **`AGENT_HANDOFF.md`** — the working reference: file map, DOM/ID map, current
  cache-version strings, recent changes, the 3D-studio internals, and the
  bake/tooling pipelines. Read this first.
- **`PROJECT_DOCUMENTATION.md`** — the original project brief, content strategy,
  positioning, and QA checklist.
- **`ATTRIBUTIONS.txt`** — third-party asset credits.

## Deploy

Push to `main` → Vercel builds and serves the static folder at
`www.kefanwu.com`. Every code change bumps a `?v=<label>-<date>` cache string on
the edited file (see the cache-versions list in `AGENT_HANDOFF.md`).
