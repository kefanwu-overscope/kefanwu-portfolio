# Current release and local preview · 2026-09-13

## Current media presentation delivery · 2026-09-13

Prepared against production `a67a49ad080364590494793ce5641066dc399ffc`;
page cache revision `media-polish-20260913`. Evidence belongs in
`../.codex/media-polish-20260913/`; `acceptance.json` and `browser-local.json`
must report `status: passed` before release. Acceptance and publication remain
pending. The planned backup is
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-media-polish`;
its release metadata and deployment verification establish the final commit and online status.

Open `http://127.0.0.1:4176/#work` and check that all 16 projects appear before
the large studio portal, followed by approach. Keep the hero/nav studio links and
the steering example in “Make & integrate.” Use the existing server command below.

Check homepage and case-page animation startup at normal and reduced motion:
the original poster stays opaque until the drawn frame is ready, underneath the
160 ms stage fade. Check reset, reverse scroll and touch/keyboard sliders; the
640 CSS-pixel preview limit and existing asset quality remain.

Check `case-study.html?project=seat` for the full CAD view and Original CAD capture link;
use `?project=materialTest` for complete plot labels and `?project=telecaster`
for photographs. Chapter images should not repeat in the remaining gallery; a repeated chapter
source becomes text-only.
Every original source image must remain reachable through zoom. Inspect desktop
and phone layouts for clipping and unnecessary white space. No render is needed.

## Preserved case-page preview setup · 2026-09-13

Prepared against production `9608b5d`; revision `case-pages-20260913`.
The planned backup is `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`. Its
`release-metadata.json` and `deployment-verification.json` establish exact commit
and online status when publication completes.

Open `http://127.0.0.1:4176/#work` for the 16 linked project cards, or
`http://127.0.0.1:4176/case-study.html?project=scanner` for the reference layout.
Every project key has the same native page structure with four chapters, source
images, zoom and technical records. The homepage uses a primary 3D action,
highlighted navigation and a large workshop preview after the project grid.

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

Preserved case-page content and cover checks are in `../.codex/case-pages-20260913/`.
This round uses `../.codex/media-polish-20260913/acceptance.json` and
`browser-local.json`; earlier browser captures are historical.
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
