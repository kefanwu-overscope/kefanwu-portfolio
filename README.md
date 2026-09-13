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

## Authorized functional animation release · 2026-09-13

The user authorized publishing this functional animation release on September
13. The previous production version is the cinematic release `b59c0e8`.
Open `http://127.0.0.1:4176/` for the working copy; see `LOCAL_PREVIEW.md` for
startup details. The cache label is `functional-release-20260913`.

This release includes 15 reversible project animations; Telecaster stays static. Steering, vine
eversion, propellers, gantries, tensile rupture, heat, unfolding and ten carbon
plies show function; Pool/LineFollower gain six extraction stages each, and
Education genuinely assembles its source kit into the matched V2 CAD layout.
Its 23 strict stages use documented small rigid-fit display clearances.

The delivery has 1,863 frames: 121 per animation, except 145 for vine and tensile
test. Slower scroll interpolation, keyboard/touch sliders and a 160 MiB decoded
image budget support smooth reversible use without homepage WebGL or video.
The real Fluent reconstruction completed 400 iterations and
passed its solution audit for qualitative animation. Very low mesh quality,
no prism boundary layer and first-order transport limit aerodynamic accuracy;
see `../.codex/functional-motion-20260913/cfd/rebuild-report.md`.
CFD pressure colors use zero-centered asinh normalization with a 750 Pa scale:
negative pressure is cool blue and positive pressure is orange/red. The complete
−10645.81 to +7817.95 Pa range and solved data remain unchanged, without clipping
or a new solve. The legend identifies the asinh scale, −2k/0/+2k and both extremes.
All 48 approved cover files remain unchanged. `EXPLODED_VIEWS.md` records final
frame bytes, packing and validation evidence for all fifteen sequences.

Release recovery entry:
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-functional-release/RESTORE.md`.
The adjacent `release-metadata.json` identifies the exact release commit;
`deployment-verification.json` records the actual production verification result.
The earlier `functional-motion` and `pre-publish` backups remain historical snapshots.

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
