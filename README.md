# Kefan Wu Portfolio Site

## Shared neutral backgrounds and conforming carbon layup · 2026-09-15

The current presentation revision is `neutral-20260915`, based on published
`c8afec3956948f93ea1a9d3c1620f881c448c660`. This section supersedes historical
instructions to use the Education-only studio and retain 15 older homepage packs.
All 16 cover sets and both animation catalogs now use one neutral #191919
background, white studio lighting and native alpha composition. Actual model
colors are retained; blue background spotlights are removed.

Carbon cloth settles into the fixed source shell instead of accumulating offset
shells. Completed stages and the final pose preserve its original geometry.
The animation remains illustrative: confirmed fabrication is EL2 resin, 20 main
plies of 3K 200 g/m² twill and 5–10 local reinforcing plies.

The home catalog remains 640×427 and the detail catalog native 1280×854, with
2,032 frame positions in each. Cover variants remain 480/960/1800 pixels. Initial
cover/animation poses match. The existing streaming loader, layout and memory
budgets are unchanged. All confirmed engineering facts, 79 supplemental fields,
35 Javelin BOM rows and 94 gallery references are preserved.

Use [NEUTRAL_STUDIO.md](NEUTRAL_STUDIO.md) and the new neutral render/pack tools
for current assets. Old renderers remain historical reproduction tools. Evidence:
`../.codex/neutral-studio-20260915/`. Exact release, checked backup and online
status: `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-15-neutral-studio/release-metadata.json`.

## Current media presentation delivery · 2026-09-13

Prepared against production `a67a49ad080364590494793ce5641066dc399ffc`;
page cache revision `media-polish-20260913`. Evidence belongs in
`../.codex/media-polish-20260913/`; `acceptance.json` and `browser-local.json`
must report `status: passed` before release. Acceptance and publication remain
pending. The planned backup is
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-media-polish`;
its release metadata and deployment verification establish the final commit and online status.

The large 3D Studio portal follows all 16 projects and precedes the approach
section. The primary hero action and highlighted studio navigation remain.
“Make & integrate” now uses the steering project as its fabrication example.

The original cover stays opaque while the decoded animation stage fades in over
160 ms. Presentation waits for the frame actually drawn. The 2,032 frames, 159
chunks, matching covers, three-request limit and 160 MiB budget are unchanged.

Case pages preserve photograph aspect ratios with less white space and keep complete
CAD views and plot labels with contain-fit padding. Chapter images are unique;
the remaining gallery shows only images not already used in chapters. All 93
original references remain available through image zoom. The full Seat CAD view
reuses `assets/editorial/seat-wide.webp`, with the cropped source retained by an
Original CAD capture link. No new render or asset replacement is part of this delivery.

Static portfolio for **[www.kefanwu.com](https://www.kefanwu.com)**, served without
a framework or build step. GitHub `main` deploys to Vercel.

## Homepage, case studies and studio

- **`index.html`** introduces the work through the race-car hero, a primary
  3D Studio action, highlighted studio navigation, and a large workshop preview
  after the searchable 16-project grid and before the approach section.
- **`case-study.html?project=<key>`** opens a native page for every project.
  All 16 stories have four chapters, a gallery of remaining source images, technical
  records, and a next-project link. Homepage cards use ordinary links; they no
  longer open a project modal. Image zoom remains available in each case page.
- **`experience.html`** is the existing interactive 3D studio. Its 15 project
  exhibits remain available; the Education case links to the general studio
  because that kit has no current exhibit.

`project-data.js` preserves the shared source records and 93 gallery images.
`case-study-data.js` adds editorial structure for the 16 pages. The original
Steering, Vine and Scanner stories retain their text; navigation now covers all
16 projects in homepage order.

## Historical case-page delivery · 2026-09-13

Prepared against production `9608b5d`; revision `case-pages-20260913`.
The planned backup is `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`. Its
`release-metadata.json` and `deployment-verification.json` establish exact commit
and online status when publication completes.

All 16 covers come from animation progress 0 with matching camera framing and
normalized projection. The 48 responsive files use
`assets/editorial/animation-start-20260913/`; shared runtime selection comes from
`assets/editorial/animation-covers.json`. Previous cover files are retained.

Home and detail pages share the existing motion sequences. Detail-page previews
are capped at 640 CSS pixels and support hover/scroll progression, reverse
scrolling, and touch/keyboard sliders. All 2,032 frames, 159 chunks and 24,347,588
image bytes are retained without recompression or reduced quality. The four-frame
bootstrap, three-request limit, frame fallback and 160 MiB budget remain.

Content checks cover all 64 chapters, gallery references and cyclic navigation.
Current cover and browser acceptance belongs in `../.codex/case-pages-20260913/`;
earlier release checks do not establish acceptance for this revision.
Original CAD, CFD results, galleries and documented source limitations remain.

## Working references

- `AGENT_HANDOFF.md` — current integration notes and clearly labeled history.
- `PROJECT_DOCUMENTATION.md` — content rules, structure and QA.
- `LOCAL_PREVIEW.md` — local URLs and server command.
- `EXPLODED_VIEWS.md` — motion behavior, source limitations and preservation.
- `tools/exploded-render/README.md` — initial-cover reproduction and frame transport.
- `tools/editorial-render/README.md` — runtime cover catalogue and source renders.
- `ATTRIBUTIONS.txt` — third-party asset credits.

Pushes to `main` trigger deployment. Bump the matching `?v=` references when
changing a runtime file, and use release metadata to verify publication.
