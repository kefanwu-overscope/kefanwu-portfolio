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

## Motion and cover refinement · 2026-09-13

This release supersedes production `ce30134`. The exact new commit and actual
online status are recorded in `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-motion-refinement/release-metadata.json` and
`deployment-verification.json`. Preview: http://127.0.0.1:4176/#work.
The homepage cache label is `motion-refinement-20260913`.

- Vine, CFD and Education covers now come directly from their animation scenes:
  an extended translucent vine, the solved pressure/flow field, and the assembled
  teaching guitar. The tensile cover and animated specimen share orange #F27A2A.
- Steering now reaches 90° from neutral, coupling both universal joints and rack.
  Pool retracts its front cylinder, rack and latches, holds, then releases quickly;
  pinion and drive sprockets rotate in step. LineFollower rolls both tires/hubs
  and sways left/right by 10°, with corresponding differential wheel rotation.
- AURA expands in eleven checked stages, with individually removed top fasteners
  and separate cover/bearing rings. Its camera follows the expanding stack.
  Carbon's ten plies share the original cover shader and fixed source coordinates.

Fifteen animations contain 1,911 static 640×427 WebP frames (23,864,252 bytes),
48 Cycles samples each. Vine, tensile, AURA and Pool have 145 frames; others 121.
Six revised sequences use `assets/exploded/refined-20260913/`; the remaining nine
retain their previously verified `functional-20260913/` assets. Telecaster is static.
Four covers use twelve new responsive images; the other 36 current variants
and all 48 historical cover files remain unchanged. Original CAD, galleries,
project content and the 3D studio are preserved.

Sliders, smooth reversible wheel input, endpoint page scrolling, reduced motion,
modal reset and the 160 MiB decoded-image budget remain supported. The CFD uses
the existing audited 400-iteration Fluent solve and the full-range, zero-centered
asinh pressure colors; no new solve or altered pressure data is introduced.
It remains a qualitative reconstruction with the limitations documented in
`../.codex/functional-motion-20260913/cfd/rebuild-report.md`.

See `EXPLODED_VIEWS.md` for current motion details and verification, and
`tools/exploded-render/README.md` for reproduction. Current evidence and PNG
masters are in `../.codex/motion-refinement-20260913/`. The previous
`functional-release` backup remains a separate, verified historical release.

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
