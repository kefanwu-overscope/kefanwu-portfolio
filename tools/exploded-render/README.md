# Render project-card function and assembly previews

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

See `../../EXPLODED_VIEWS.md` for current motion details and verification, and
`tools/exploded-render/README.md` for reproduction. Current evidence and PNG
masters are in `../.codex/motion-refinement-20260913/`. The previous
`functional-release` backup remains a separate, verified historical release.

## Reproduce this revision

Run in `portfolio-site` with the bundled Python (Pillow) and Blender 4.5.9:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_exploded.py -- --projects steering aura carbonSeat materialTest pool lineFollower --samples 48
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_exploded.py --copy-to-site --projects steering aura carbonSeat materialTest pool lineFollower
```

Default PNG output is `../../../.codex/motion-refinement-20260913/generated/`.
Use `--output`/`--input` for other locations. Partial pose proofs (`--only`) must
not be packed as full sequences. Existing nine sequences are merged unchanged.
The release validator intentionally checks this six-new/nine-retained manifest.
Future revisions must deliberately update that baseline rather than silently
mix provenance from a full rerender into an old validation contract.

For each revised cover, use the renderer with `--cover-progress`, `--width 1800`,
`--samples 192` and an absolute `--output` pointing to the evidence `covers/`.
Progress values are vineRobot 0.75, ansysCfd 0.5, education 1, materialTest 0.
Freeze controller/renderer code before final rendering. Then run
`pack_motion_covers.py`, `validate_catalog.py` in the editorial tool directory,
and `validate_exploded.py`. Cover packing updates only the four selected cards.

`drive_cycle_motion.py` supplies Pool/LineFollower kinematics;
`aura_detailed_motion.py` uses the unchanged strict assembly path checker;
`shared_material_carbon.py` supplies source-space carbon texture coordinates.
The original expanded assembly controller remains for Education and historical
reproduction. Main source files and matching reports are included in the backup.
Offline inputs include staging GLBs, copied STL sources/Fluent fields in
`../../../.codex/functional-motion-20260913/`, plus the existing assembly cache in
`../../../.codex/exploded-revision-20260913/motion-plans/`.

## Preserved source limitations

Education is an assembly illustration with explicit rigid fit adjustments:
the neck heel is raised 0.01 scene units (2.319 mm in the source CAD), its seating
gap is 0.00002 scene units, and the original separate pickup front plate has a
0.01 scene-unit (2.319 mm) display gap at both endpoints. A common 0.035 upward
lift clears the floor. The plate and coil enter from opposite bridge faces;
neither mesh is cut. These are documented display clearances, not manufacturing
tolerances. Continuous surface checks and sampled containment are geometric
evidence, not a full contact-dynamics or servicing certificate.

The real Ansys Fluent 24.1.0 reconstruction completed 400 iterations and passed
`audit_final_solution.py`. Its final regularized wall has 47,450 triangles and
the external-flow mesh has 377,141 tetrahedra. Actual pressure and 49 numerical
paths are tied by hashes to the saved case/data. This is accepted for qualitative
animation only: minimum orthogonal quality remains about 3.187e-9, there is no
prism boundary layer or mesh-independence study, and transport uses first-order
upwind. Global residual/force stability does not establish local aerodynamic
accuracy. The pressure display uses zero-centered asinh normalization with a
750 Pa scale, cool blue negative pressure and orange/red positive pressure.
The full −10645.81 to +7817.95 Pa range is retained without clipping or changing
solved data. The legend identifies the asinh scale and marks −2k/0/+2k and both
extremes; the wall and legend use the same unlit color transfer. This display
revision reuses the existing 400-iteration solve.
The source geometry was preserved; the CFD skin seals cavities, omits propulsion
and regularizes thin surface features. Exact evidence and limitations are in
`../../../.codex/functional-motion-20260913/cfd/solution-audit.json` and
`rebuild-report.md` in the same directory. Final animation totals belong in
`../../EXPLODED_VIEWS.md`.
