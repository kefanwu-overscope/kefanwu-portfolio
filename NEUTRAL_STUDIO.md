# Shared neutral studio and conforming carbon layup

Presentation revision: `neutral-20260915`. This supersedes the earlier Education-only
studio recipe and the current-asset statements in historical delivery sections.
The prior published commit is `c8afec3956948f93ea1a9d3c1620f881c448c660`.
Final verification and publication status belong in
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-15-neutral-studio/release-metadata.json`.

## Background shared by every project

All 16 responsive cover sets, homepage animations and detail animations use one
neutral studio. Four white area lights illuminate the original colored models.
The visible backdrop is fixed at sRGB **#191919** and is composited with Blender's
native antialiased object alpha after denoising. The photographic ground remains
available to non-camera rays for reflections and lighting. No image-color threshold
is used to erase dark model pixels, and no generative image edit changes the CAD.

The fixed background prevents scene scale, camera angle, colored bounce or denoising
from producing different blue pools of light behind different projects. Model
materials, original engineering assets and established motion remain unchanged
except for the requested carbon-cloth placement correction.
The WebP encoder rounds the empty background uniformly to #181818; this same
encoded neutral value is checked across every delivered frame and cover.

The progress-zero cover and animation use the same scene, motion state and camera
projection. Cover PNGs are rendered at 1800 × 1200 with 192 samples and encoded in
480, 960 and 1800-pixel WebP variants. Animation masters are natively rendered at
1280 × 854 with 48 samples. The renderer first stages the source at 640 × 427 and
then doubles both output dimensions, preserving the original projection.

## Carbon cloth placement

The finished seat shell retains its source geometry. Completed cloth placements
merge into that fixed surface rather than remaining as a stack of offset shells.
At most one moving cloth surface is visible. Its contact transition is continuous
and reversible; completed-stage boundaries and the final pose show the original
shell without added thickness. The surface uses the source carbon weave coordinates.

The ten visual stages illustrate placement. They do not represent the physical ply
count or a measured laminate thickness. The confirmed build remains **Easy Composites
EL2**, **20 main plies of 3K 200 g/m² twill**, plus **5–10 local reinforcing plies**.

## Delivery and loading

| Surface | Manifest | Dimensions | Positions |
|---|---|---|---|
| Homepage cards | `assets/exploded/manifest.json` | 640 × 427 | 2,032 |
| Case-study heroes | `assets/exploded/manifest-detail.json` | 1280 × 854 | 2,032 |
| Responsive covers | `assets/editorial/animation-covers.json` | 480 / 960 / 1800 wide | 16 sets |

Homepage WebPs are downsampled from the corresponding native masters, quality 85.
Detail WebPs use quality 88. Lossless chunk transport concatenates those exact
encoded bytes and retains individual-frame fallback URLs. The first chunk contains
at most four frames; subsequent chunks contain at most 16 SD or eight HD frames.
HD chunks also stay within 256 KiB.

The existing loader and layout are preserved. Detail animation uses a 32-frame
ready window, three workers, a 160 MiB managed decoded budget, and a separate
16 MiB compressed-blob cache. The opaque cover remains beneath the animation;
frame zero retains the sharper cover. These managed limits do not claim a cap on
total browser or GPU memory. See [DETAIL_RENDERING.md](DETAIL_RENDERING.md) for
the unchanged loader behavior.

## Reproduction and validation

- [neutral_studio.py](tools/exploded-render/neutral_studio.py) defines the shared
  lighting and native background composition.
- [render_neutral_studio.py](tools/exploded-render/render_neutral_studio.py) renders
  native animation frames and matching initial covers, preserving source evidence.
- [pack_neutral_studio.py](tools/exploded-render/pack_neutral_studio.py) writes
  separate SD, HD and cover candidates. It never integrates shared manifests.
- [validate_neutral.py](tools/exploded-render/validate_neutral.py) validates the
  delivered catalogs, frame/chunk bytes, source links, background contract and
  page fallbacks. The established exploded/catalog validators route this revision
  to it.

Use these neutral tools for current assets. Earlier generic cover, Education-only
and HD-only renderers reproduce historical lighting and are not current-studio
entry points. Exact command records, original PNGs, carbon geometry checks,
browser acceptance and deployment hashes are retained under
`../.codex/neutral-studio-20260915/` and in the release backup.

From the repository directory, use a new output/evidence folder for a new render:

```powershell
blender --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_neutral_studio.py -- --variant flat --cover --allow-carbon-motion-change --evidence ../.codex/neutral-reproduction

python -X utf8 tools/exploded-render/pack_neutral_studio.py --projects steering vineRobot javelin brakeSim aura scanner carbonSeat seat materialTest ansysCfd pool lineFollower formlabs education ftc telecaster --evidence ../.codex/neutral-reproduction --asset-revision neutral-reproduction --carbon-verification ../.codex/neutral-studio-20260915/carbon/geometry-verification.json

python -X utf8 tools/exploded-render/validate_neutral.py --report neutral-validation.json
```

Replace executable names with their installed paths when they are not on PATH.
`--only 0 --cover` is a bounded visual proof; a complete pack requires every frame.
`--resume` verifies the existing PNG hashes and executed source contract before
retaining frames. The renderer follows original provenance links when the active
catalog already uses this neutral studio. Packing defaults refuse to overwrite
active assets; choose a fresh `--asset-revision` directory for reproduction and
review the candidates before integrating them. A changed carbon controller
requires a new geometry verification report tied to that controller.

All original project documentation, 79 supplemental fields, 35 Javelin BOM rows,
94 gallery references, gallery previews and downloads remain unchanged. Historical
render assets are retained for restoration.
