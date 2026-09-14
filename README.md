# Kefan Wu Portfolio Site

Static portfolio for **[www.kefanwu.com](https://www.kefanwu.com)** — no
framework, no build step, no package install. Auto-deploys to Vercel from the
`main` branch of `github.com/kefanwu-overscope/kefanwu-portfolio`.

## Two surfaces

- **`index.html`** — the canonical, crawlable homepage. The cinematic
  design uses the race-car photo and hero, immediately followed
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

## Current motion and loading delivery · 2026-09-13

This delivery is prepared against production `bca2175`. The homepage cache label
is `motion-loading-20260913`; preview: http://127.0.0.1:4176/#work.
The planned backup is
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-motion-loading`.
Its `release-metadata.json` and `deployment-verification.json` will record exact
commits and verified online status when publication completes.

- Vine and Education covers show their exact animation start at progress 0:
  the retracted vine and the separated guitar kit. Their animation paths remain unchanged.
- Javelin combines flight sway with four rotating propellers. Telecaster now has
  a complete 360° turntable animation, bringing the homepage to 16 animated cards.
- Frames become usable progressively. Each sequence starts with a four-frame
  chunk, followed by chunks of up to 16 frames and 256 KiB. Original individual
  frame URLs remain fallback; loading uses at most three concurrent requests.

The 16 sequences contain 2,032 static 640×427 WebP frames, rendered at 48 Cycles
samples, totaling 24,347,588 image bytes. Vine, tensile, AURA and Pool retain 145
frames each; the other twelve have 121. The two new sequences use
`assets/exploded/flight-20260913/`; fourteen retain their exact prior frame files
and metadata across `refined-20260913/` and `functional-20260913/`.
The 159 files in `assets/exploded/chunks-20260913/` concatenate the original WebP
bytes without recompression, changed dimensions, dropped frames or changed timing.
Transport metadata adds a small manifest cost; image-byte overhead is exactly zero.

Six new responsive cover files use `assets/editorial/start-20260913/`; the other
42 current variants and all 60 historical cover files are preserved. Original
CAD, galleries, content and the 3D studio remain unchanged. Reversible sliders,
wheel endpoints, reduced motion, modal reset and the 160 MiB decoded-image budget
remain supported. Existing CFD accuracy, Pool source-tooth overlap and Education
display-fit limitations still apply; see `EXPLODED_VIEWS.md`.

Current evidence and PNG masters are in `../.codex/motion-loading-20260913/`,
including `poses/`, `loader/` and `transport/`. Earlier motion and CFD evidence
remain required for the fourteen retained sequences and complete recovery.

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
