# Current release and local preview · 2026-09-13

## Case-page preview · 2026-09-13

Prepared against production `9608b5d`; revision `case-pages-20260913`.
The planned backup is `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`. Its
`release-metadata.json` and `deployment-verification.json` establish exact commit
and online status when publication completes.

Open `http://127.0.0.1:4176/#work` for the 16 linked project cards, or
`http://127.0.0.1:4176/case-study.html?project=scanner` for the reference layout.
Every project key has the same native page structure with four chapters, source
images, zoom and technical records. The homepage uses a primary 3D action,
highlighted navigation and a large workshop preview before the project grid.

Detail previews share the existing animation at a maximum 640 CSS-pixel width;
check hover/scroll, reversal, endpoint page scrolling and touch/keyboard sliders.
Covers come from progress 0 through `assets/editorial/animation-covers.json`.
The 2,032 frames, 159 chunks and 24,347,588 bytes retain their original quality.

Start the preview from the parent WEBSITE directory:

```powershell
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .codex/editorial-20260913/server.mjs
```

The server uses only 127.0.0.1. It supports the existing 3D site and PDF/assets.
No application build or dependency installation is required.

Current content checks are in `../.codex/case-pages-20260913/content/`.
New cover and browser acceptance belongs in `../.codex/case-pages-20260913/`;
prior motion-loading browser captures are historical.
Earlier typography/layout screenshots live in `../.codex/readability-20260913/`.
Angle/skills/team screenshots live in `../.codex/cover-refinement-20260913/`.
Catalogue validation and earlier screenshots live in `../.codex/rendered-covers-20260913/`.
The cinematic layout checks remain in `../.codex/cinematic-20260913/`.
The previous CAD-led concept is documented in `../.codex/editorial-20260913/`;
those earlier screenshots no longer represent the homepage.
The main page has no new WebGL or model download. The restored skills ticker uses
the existing CSS marquee and visibility observer, without a JavaScript frame loop.
The 2.4-second photo entrance runs on each load and ends at a static frame.
Motion respects reduced-motion preferences; hidden/offscreen work pauses.
The studio retains its original rendering and startup behavior.
