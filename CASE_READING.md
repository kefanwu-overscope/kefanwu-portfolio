# Shared case-study readability · 2026-10-09

This revision builds on 5fa2eb78 and applies the same reading structure to
`case-study.html` and `project-3d.html`. It does not change project models,
motion, annotation coordinates, room rendering, scientific image bytes or
engineering outcomes.

## Reading hierarchy

The existing 16-project editorial data remains the shared source. All 64 chapter
titles now name their technical subject without forced line breaks. Each chapter
has two short paragraphs, led by its supported decision/result and followed by
reasoning or qualification. Visible chapter copy falls from 4,091 to 3,191 words
(22.0%); all 131 original paragraphs remain verbatim in `detailParagraphs`.

Each chapter's “Full engineering detail” link opens its corresponding full account
inside the existing engineering record. Original project notes, supplements,
requirements/evidence rows, 35 Javelin BOM items, downloads and all 100 gallery
references remain available. Galleries retain their original indexes and image
zoom behavior. New text adds no research, personal responsibility or test result.

Native hash links, reloads and retained-studio history reopen the requested
disclosure before scrolling. The studio bridge dispatches `case-reveal-anchor`
because its `replaceState` navigation does not emit native `hashchange`; this also
applies before restoring a numeric scroll offset. Origin/source checks and the
parent-owned history protocol remain unchanged.

## Typography, images and navigation

- Chapter body is 18px on desktop and 17px below 1000px, with 1.7 line spacing.
  Chapter headings are approximately 36–42px on desktop/tablet and 30px on mobile.
  Summary text is 16px. Original small model labels remain governed by the
  unchanged motion stylesheet.
- Hero links offer “Read case study”, “View results” and “Explore model” before
  the summary. The existing chapter navigation stays after the motion section,
  avoiding a second sticky bar covering the full-page model.
- Photos and CAD retain paired columns on large screens. Plots and documents
  use a wider, stacked chapter; very wide diagrams/formulas use a compact
  equation treatment. Below 1000px, reading pairs become a single column.
  Original pictures, scientific legends, units and full-image containment remain.
- Below 900px, each evidence row stacks criterion, method and finding vertically.
  One semantic table supplies both layouts; visible mobile cell labels are
  hidden from assistive reading to avoid duplicate announcements. Column/row
  headers and explicit roles remain in the DOM. Print restores table layout
  and dark text on white.

## Verification and handoff

`node tools/readability-tests/verify.mjs` compares the baseline and candidate,
renders all 16 projects in both modes, verifies exact 64/131 narrative archives,
engineering/source/gallery/BOM preservation, image-zoom focus and native/retained
disclosure navigation. The existing motion, project controller, bridge and studio
navigation suites supplement it. Browser checks cover 1280/390px layouts across
all 16 cases, focused image/model interactions and retained-room navigation.

Evidence, final deployment verification and reversible delta backup are stored
outside the deployable site at `../.codex/case-reading-20261009/`. Release records
establish the exact published commit. Preserve the entire base/overlay chain.
