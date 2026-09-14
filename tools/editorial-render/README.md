# Real CAD editorial stills

## Current matching initial covers · 2026-09-13

Prepared against production `9608b5d`; revision `case-pages-20260913`.
The planned backup is `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`. Its
`release-metadata.json` and `deployment-verification.json` establish exact commit
and online status when publication completes.

Every homepage card and native case page uses animation progress 0 with the
delivered camera framing and normalized projection. The 48 responsive variants
are in `assets/editorial/animation-start-20260913/`; per-project provenance sits
beside them. `assets/editorial/animation-covers.json` is the shared runtime
catalogue. Static homepage and editorial fallback sources must match its records.

The cover wrapper preserves scene geometry, materials, lighting, ground and
camera. It stages the delivered 640×427 frame, renders a 48-sample proof, then an
1800×1200/192-sample master. Pixel aspect 1:1.00078125 preserves projection while
converting the rounded animation aspect to the cover raster. This applies to all
16 covers, including the initial CFD markers, retracted Vine and separated
Education kit. Existing animation bytes, gallery originals and older cover files
are preserved.

Run from `portfolio-site`:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_initial_covers.py -- --output C:/Users/oc/Desktop/WEBSITE/.codex/case-pages-20260913/covers
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_initial_covers.py
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/validate_initial_covers.py
```

The renderer defaults to all 16 projects. `--projects` narrows rendering; the
packer supports `--input` for a different master directory. Current evidence is
`../../../.codex/case-pages-20260913/`, with cover acceptance recorded in
`initial-cover-validation.json`. New cover and browser acceptance must be read
from current completed reports. See `../exploded-render/README.md` for source
archiving, projection details and retained frame transport.

The older source-render records below are historical. Do not use their previous
view settings or packing commands to overwrite the current initial-pose covers.

## Historical source catalogue — 2026-09-13

`catalog.json` defines the 13 additional covers. Mechanical and robotics material
audits are in `material-audit-mechanical.json` and `material-audit-robotics.json`.
`sources/` contains material-split offline GLBs made by `mechanical_sources.py`
and `robotics_sources.py`. These are full-detail rendering inputs, not new
browser downloads. Included STL triangle coordinates are retained; the builders
document omitted threaded fasteners and internal motor detail. Source/renderer
hashes, material palettes and per-image settings are in `catalog-manifest.json`.

The FTC and single-column tensile machine are photo-based display reconstructions,
with `build()` scripts, BLEND/GLB masters and `provenance.json` in `ftc/` and
`material-test/`. Visible homepage badges were removed at the user's request;
provenance records remain here. Javelin combines the original
CAD airframe with four photo-informed two-blade propellers. The CFD monitor is
presentation furniture carrying the unchanged original Cp image. Source photos,
engineering records and `models/real` are preserved.

Materials are photo/CAD interpretations rather than calibrated measurements.
The Pool Sniper palette is supported by CAD views; a full physical assembly photo
is not available. Red pearloid and carbon weave are procedural finish approximations.
Guitar wood grain follows the neck; glossy reflections were checked against the
finished white-body/red-guard photograph, not the unfinished wood blank.

From the repository root, after preparing the sources:

```powershell
& '<blender.exe>' --background --factory-startup --python-exit-code 1 --python tools/editorial-render/render_catalog.py -- --projects javelin brakeSim aura carbonSeat seat materialTest ansysCfd pool lineFollower formlabs telecaster education ftc
& '<python-with-Pillow>' tools/editorial-render/pack_catalog.py
& '<python-with-Pillow>' tools/editorial-render/apply_covers.py
& '<python-with-Pillow>' tools/editorial-render/build_proof.py
& '<python-with-Pillow>' tools/editorial-render/validate_catalog.py
```

Add `--draft` for 720×480 / 24-sample proofs. Final images use 1800×1200 / 192
samples. `--angle N` selects a configured view; `--save-blend` keeps a scene.
Use `--python-exit-code 1` so a failed script cannot be mistaken for a finished
render. Complete rendering before packing. Encoding supplies 480, 960 and 1800px
WebP variants with a fixed 3:2 frame and preserves the original three full-size
approved images byte-for-byte. After the Javelin, rotor and driver-seat camera
revision, sixteen 480px variants total 149,702 bytes; 960px variants total 361,024
bytes. No raster retouching is performed.

Visual and browser verification: `../.codex/rendered-covers-20260913/` relative
to the repository root. The following section documents the original three
renders and their separate reproduction pipeline.

## Original steering, vine robot and scanner renders

Original three-cover proof: `/tools/editorial-render/index.html`.

These stills are rendered directly from `models/real/{steering,vineRobot,scanner}.glb` using Blender 4.5.9 Cycles / OPTIX (RTX 5080). There are no AI-generated components and no geometry simplification, reconstruction, or exploded-part offsets. Shared scene normalization scales and translates every source vertex equally. Shading smooths shallow existing edges. Blender's importer removes coincident duplicate faces: exactly 220 in steering and 45 in scanner, independently checked against raw GLB triangle indices; Vine has no duplicates. Every unique source surface remains. The source SHA256, original/imported triangle counts, camera direction, dimensions, and asset byte counts are recorded in `manifest.json`.

## Historical original homepage files

- `assets/editorial/steering-wide.webp` — 1800 × 1200, desktop hero / steering story.
- `assets/editorial/steering-portrait.webp` — 1200 × 1500, separately framed mobile image.
- `assets/editorial/vineRobot-wide.webp` — 1800 × 1200, vessel outlet and reinforcing structure.
- `assets/editorial/scanner-wide.webp` — 1800 × 1200, front gantry and sensor carriage.

The wide framing is centered with 9% vertical breathing room. Use it as a separate right-hand hero image. Its horizontal blank space also permits a square container with `object-fit: cover` without cutting off hardware. On narrow phones use the portrait steering image with its own 4:5 aspect ratio, rather than cropping the wide image to portrait. The intended desktop hero ratio is approximately 40% text / 60% image.

Blue/white polymer and wood assignments follow the photo-audited material overrides in `experience.js` and `tools/stl2glb.py`. The steering wheel is the existing isolated plate in `mat_printed`; a region selector changes its faces to dark carbon appearance, supported by the original `cover-steering-system-cad.webp`. It does not create new geometry. The source models merge many parts into material buckets: materials remain broad classes and these images should be presented as CAD renders, not photographs of a physical build. Actual build photos remain the evidence for installed hardware and testing.

## Reproduce

Blender executable on this workstation:
`C:\Users\oc\.cache\blender\blender-4.5.9-windows-x64\blender.exe`

Run from the repository root:

```powershell
& '<blender.exe>' --background --factory-startup --python tools/editorial-render/render.py -- --model steering --view wide --angle 0
& '<blender.exe>' --background --factory-startup --python tools/editorial-render/render.py -- --model steering --view portrait --angle 0
& '<blender.exe>' --background --factory-startup --python tools/editorial-render/render.py -- --model vineRobot --view wide --angle 0
& '<blender.exe>' --background --factory-startup --python tools/editorial-render/render.py -- --model scanner --view wide --angle 0
& '<python-with-Pillow>' tools/editorial-render/pack.py
```

Add `--draft` for a 32-sample low-resolution proof. Final output uses 192 samples and denoising. `pack.py` only encodes PNG to WebP at the original resolution, without compositing or retouching.

`renders/` contains full-resolution PNG masters and per-image provenance. `drafts/` contains earlier angle/exposure proofs, which are not the approved deliverables. No browser, screenshot capture, or upload endpoint is required to regenerate the assets.
