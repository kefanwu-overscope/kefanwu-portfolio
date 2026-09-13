# Kefan Wu Portfolio Site

Static portfolio for **[www.kefanwu.com](https://www.kefanwu.com)** — no
framework, no build step, no package install. Auto-deploys to Vercel from the
`main` branch of `github.com/kefanwu-overscope/kefanwu-portfolio`.

## Two surfaces

- **`index.html`** — the canonical, crawlable homepage. The current local
  redesign restores the race-car photo and cinematic hero, immediately followed
  by all 16 searchable projects, then methods/leadership, contact, and a resume
  PDF. Three full case pages are optional links in their project modals.
  `editorial.css` provides the layout; `styles.css` and `script.js` preserve
  modal behavior. The earlier homepage story script is no longer loaded.
- **`experience.html`** — an interactive 3D "studio" (three.js r0.185, buildless
  via a jsDelivr import map): a night-lit engineering room where the resume sits
  on the desk and 15 of the 16 projects are clickable exhibits. Styled by
  `experience.css`, driven by the `experience.js` module. Deep-linkable:
  `experience.html#steering` flies straight to that exhibit.

`project-data.js` is the single source of truth for case-study content, shared
by both pages.

## Local preview

The user authorized publishing the **2026-09-13 cinematic redesign** on September
13. This is the release baseline for the next project-card exploded-view work.
Open `http://127.0.0.1:4176/` for the working copy; see `LOCAL_PREVIEW.md` for
startup details. Release archives and recovery instructions are in
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-pre-publish/`.

All 16 project cards use responsive studio renders from local CAD and documented
photo reconstructions. Source audits, reproduction commands and image hashes are
in `tools/editorial-render/README.md` and `catalog-manifest.json` there. Original
project galleries and 3D models remain intact.

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
