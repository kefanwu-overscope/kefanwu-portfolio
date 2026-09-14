# Kefan Wu Portfolio Site

Static portfolio for **[www.kefanwu.com](https://www.kefanwu.com)**, served without
a framework or build step. GitHub `main` deploys to Vercel.

## Homepage, case studies and studio

- **`index.html`** introduces the work through the race-car hero, a primary
  3D Studio action, highlighted studio navigation, and a large workshop preview
  between the hero and the searchable 16-project grid.
- **`case-study.html?project=<key>`** opens a native page for every project.
  All 16 stories have four chapters, the original image archive, technical
  records, and a next-project link. Homepage cards use ordinary links; they no
  longer open a project modal. Image zoom remains available in each case page.
- **`experience.html`** is the existing interactive 3D studio. Its 15 project
  exhibits remain available; the Education case links to the general studio
  because that kit has no current exhibit.

`project-data.js` preserves the shared source records and 93 gallery images.
`case-study-data.js` adds editorial structure for the 16 pages. The original
Steering, Vine and Scanner stories retain their text; navigation now covers all
16 projects in homepage order.

## Current case-page delivery · 2026-09-13

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
