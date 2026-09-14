# Render project-card function and assembly previews

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
display-fit limitations still apply; see `../../EXPLODED_VIEWS.md`.

Current evidence and PNG masters are in `../../../.codex/motion-loading-20260913/`,
including `poses/`, `loader/` and `transport/`. Earlier motion and CFD evidence
remain required for the fourteen retained sequences and complete recovery.

## Reproduce this revision

Run in `portfolio-site` using Blender 4.5.9 and the bundled Python with Pillow.
Render only the two changed sequences, then the two exact-start covers:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_exploded.py -- --projects javelin telecaster --samples 48
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_exploded.py -- --projects vineRobot education --cover-progress 0 --width 1800 --samples 192 --output C:/Users/oc/Desktop/WEBSITE/.codex/motion-loading-20260913/covers
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_exploded.py --copy-to-site --projects javelin telecaster
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_motion_covers.py
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_frame_chunks.py --write-manifest --report ../.codex/motion-loading-20260913/transport/final-validation.json
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/validate_exploded.py
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/editorial-render/validate_catalog.py
```

Default PNG output is `../../../.codex/motion-loading-20260913/generated/`.
`--output`/`--input` select other locations. Partial pose proofs (`--only`) must
not be packed as full sequences. Preserve the baseline animation manifest and
catalogue in the evidence folder before packing: validators deliberately require
the other fourteen sequences and 42 current cover variants to remain unchanged.
`pack_motion_covers.py` only changes Vine and Education, both at progress 0.
Freeze the renderer/controller sources before final rendering and retain their
source inventories, pose checks and PNG provenance in the recovery backup.

`display_motion.py` supplies Javelin flight/propeller and Telecaster turntable
controllers. `pack_frame_chunks.py` copies existing compressed WebP bytes into
headerless `.bin` files with content-hash URLs and zero-based offset/length tables.
The default first chunk has four frames; remaining chunks have at most 16 frames
and 256 KiB. The CLI rejects limits above the loader's 32-frame / 16 MiB ceiling.
`--projects` limits packing; omission handles every current project. Normal runs
write a candidate manifest; `--output-root` stages files elsewhere, while
`--write-manifest` updates the live source manifest only after verification.
Keep original `frames` URLs as fallback. Original encoding, resolution, sequence
length and timing are preserved. Browser requests remain capped at three, and
progressive decoding stays within the existing 160 MiB budget.

Current source/frame/cover validation and byte-range reconstruction have passed.
Loader regressions and the deterministic benchmark are in
`../../../.codex/motion-loading-20260913/loader/`; the benchmark models 100 ms RTT,
10 Mbps and 2 ms decoding and reports median first usable pose 5,678 → 206 ms.
These are simulated timings, with production verification recorded separately.

`drive_cycle_motion.py`, `aura_detailed_motion.py`, `shared_material_carbon.py`
and the existing Education assembly controller retain their prior behavior.
Offline inputs include staging GLBs, copied STL sources and Fluent fields in
`../../../.codex/functional-motion-20260913/`, retained refinement evidence in
`../../../.codex/motion-refinement-20260913/`, and assembly caches in
`../../../.codex/exploded-revision-20260913/motion-plans/`.

## Preserved source limitations

Pool retains its documented source rack/pinion tooth overlap; its display motion
is not a claim of exact tooth contact. Source mesh/axis geometry and the earlier
stroke-clearance evidence remain unchanged; see `../../EXPLODED_VIEWS.md`.

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
