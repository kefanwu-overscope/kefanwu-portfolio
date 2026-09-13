# Current release and local preview · 2026-09-13

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
