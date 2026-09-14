# Current release and local preview · 2026-09-13

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

Start the preview from the parent WEBSITE directory:

```powershell
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' .codex/editorial-20260913/server.mjs
```

The server uses only 127.0.0.1. It supports the existing 3D site and PDF/assets.
No application build or dependency installation is required.

Current motion browser QA passed; see `../.codex/motion-loading-20260913/browser-local.json`.
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
