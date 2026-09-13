# Functional animation release and local preview · 2026-09-13

Local preview: **http://127.0.0.1:4176/**

The user authorized publishing this functional animation release on September
13. The previous production version is the cinematic release `b59c0e8`, whose
59 checked online files matched that commit. The current cache label is
`functional-release-20260913`.

This release includes 15 scroll-controlled animations; Telecaster remains a
static card. It contains 1,863 WebPs: 121 frames per animation, with 145 each
for vine and tensile test. All 48 approved cover files remain unchanged.
`EXPLODED_VIEWS.md` records final asset totals, packing and verification evidence.

Hover an animated card and scroll to advance/reverse its function, or use the
native keyboard/touch slider. Slower wheel progression and bounded interpolation
keep intermediate poses visible. Outward scrolls at either endpoint continue
moving the page. Only the active sequence loads; decoded images share a 160 MiB
budget, with at most two cached sequences. Original clicks/galleries remain
available, and reduced motion/offscreen behavior is preserved.

The modes now show steering linkage, vine eversion, four rotating propellers,
scanner/Smelly gantry travel, tensile deformation and rupture, brake heating,
seat unfolding and ten carbon plies. AURA/FTC retain checked extraction paths;
Pool and LineFollower each expose six meaningful component groups. Education
uses 23 strictly checked stages to assemble into its matched original V2 CAD
layout, with explicit 2.319 mm neck-height and pickup-front display clearances.
That is a rigid-fit assembly illustration, not a manufacturing tolerance claim.
The seat retains the previous two render-only corner reliefs and all 44 holes.
Original covers, source meshes and galleries remain preserved.

CFD uses a real Fluent 24.1.0 reconstruction, completed for 400 iterations and
accepted by `audit_final_solution.py` for qualitative animation. The final mesh
has 377,141 tetrahedra and 47,450 wall triangles, with actual wall pressure and
49 exported numerical paths. Very low orthogonal quality, no prism boundary
layer/grid-independence study and first-order transport limit aerodynamic
accuracy. See `../.codex/functional-motion-20260913/cfd/solution-audit.json` and
`rebuild-report.md` there; this does not reproduce the missing original case.
This release changes only the pressure display, using zero-centered asinh
normalization with a 750 Pa scale, cool blue negative pressure and orange/red
positive pressure. It retains the complete −10645.81 to +7817.95 Pa range without
clipping or modifying solved data; the 400-iteration solve is reused. The legend
identifies the asinh scale and marks −2k/0/+2k and both extremes.

The release recovery entry is
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-functional-release/RESTORE.md`.
The adjacent `release-metadata.json` identifies the exact release commit;
`deployment-verification.json` records the actual production verification result.
The earlier `functional-motion`, `motion-revision` and `pre-publish` backups
remain historical snapshots.

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
