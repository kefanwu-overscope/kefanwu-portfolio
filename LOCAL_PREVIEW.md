# Cinematic portfolio release and local preview · 2026-09-13

Local preview: **http://127.0.0.1:4176/**

The user authorized publishing this redesign on September 13, superseding its
earlier local-only status. The previous production baseline is `e5ea5c6`.
The complete pre-release working copy, including untracked assets and modeling
experiments, is backed up at
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-pre-publish/`.
The backup's release metadata records the exact new commit and deployment checks.

The next requested change is a scroll-controlled exploded view for every project
card. That work follows this release and will be documented separately.

The homepage keeps the black, graphite, silver, and restrained blue visual style.
The user's latest direction restores the original track photograph of Kefan in
the race car, oversized typography, and a brief cinematic entrance. The complete
16-project grid follows the hero immediately, with four desktop columns, search,
and category filters. No flagship story or engineering walkthrough precedes it.
Methods, leadership, the 3D studio, and contact follow the projects. The original
outlined skills ticker is restored above the Mechanical Engineering / Olin ’28
line. Small homepage typography is larger, and the extra project-section intro
sentence has been removed. Current leadership copy states
that Kefan leads 30 mechanical engineers, also reflected in the 3D resume data.
All 16 cards open their existing modal galleries. The three deeper cases are
optional links inside the corresponding project modals.

Optional full case pages:

- `case-study.html?project=steering`
- `case-study.html?project=vineRobot`
- `case-study.html?project=scanner`

All three preserve the full original image archive and detailed engineering
record. All 16 homepage projects now have studio-rendered covers. Existing local
CAD is reused, with material splits checked against build photos and original
CAD views. FTC and the single-column tensile tester are photo-based display
reconstructions, documented in render provenance. Card badges were removed at
the user's request. Javelin retains its original CAD
airframe with photo-informed replacement propellers. The CFD cover presents the
unchanged original solver image on a modeled display; no new result is implied.

`tools/editorial-render/catalog-manifest.json` records all sources and hashes.
The 480px variants total 146.2 KiB; 960px variants total 352.6 KiB. The browser
selects an appropriate resolution and loads cards lazily. Full 1800px masters
remain available without downloading GLBs or running WebGL on the homepage.
Material values are photo/CAD interpretations, not calibrated measurements;
Pool's finished-machine colors are supported by CAD rather than a full-build photo.

Start the preview from the parent WEBSITE directory:

```powershell
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .codex/editorial-20260913/server.mjs
```

The server uses only 127.0.0.1. It supports the existing 3D site and PDF/assets.
No application build or dependency installation is required.

Latest typography/layout screenshots live in `../.codex/readability-20260913/`.
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
