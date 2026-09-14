# Render project-card and case-page previews

## Current case-page covers and retained motion · 2026-09-13

Prepared against production `9608b5d`; revision `case-pages-20260913`.
The planned backup is `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`. Its
`release-metadata.json` and `deployment-verification.json` establish exact commit
and online status when publication completes.

All 16 homepage and case-page covers use animation progress 0 with matching
camera framing and normalized projection. The existing 2,032 frames, 159 chunks
and 24,347,588 image bytes remain untouched. Native pages reuse `exploded.js` at
a maximum 640 CSS-pixel preview width with reversible wheel input and touch/
keyboard sliders. Source CAD, motion controllers and documented limits remain.

## Reproduce initial covers

Run from `portfolio-site` using Blender 4.5.9 and the bundled Python with Pillow.
Preserve the `9608b5d` baseline records in `../.codex/case-pages-20260913/` first.

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_initial_covers.py -- --output C:/Users/oc/Desktop/WEBSITE/.codex/case-pages-20260913/covers
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_initial_covers.py
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/validate_initial_covers.py
```

The renderer defaults to all 16 projects; `--projects` selects a subset.
The packer's `--input` defaults to the evidence `covers/` directory. It writes
48 WebP variants at 480/960/1800 pixels and per-project provenance in
`assets/editorial/animation-start-20260913/`, plus
`assets/editorial/animation-covers.json`. Keep homepage and editorial fallback
cover sources synchronized with that runtime catalogue.

`render_initial_covers.py` uses the established motion renderer to compute frame 0
at 640×427, then renders a 48-sample proof and 1800×1200/192-sample master.
The scene and camera remain fixed. Pixel aspect 1:1.00078125 preserves normalized
projection despite rounded animation dimensions. Rendering sources are archived
by SHA in the evidence; a documented Smelly calibration-text exception leaves
numeric settings, groups and axes unchanged. The wrapper does not write animation
frames or edit the shared animation renderer.

`../.codex/case-pages-20260913/initial-cover-validation.json` is the current cover
acceptance record. Browser and runtime acceptance is recorded separately; do
not substitute a previous release's passing report.

## Retained animation transport

`display_motion.py` supplies the existing Javelin flight/propeller and Telecaster
turntable controllers. The remaining controllers and sequence files are unchanged.
`pack_frame_chunks.py` concatenates original compressed WebP bytes into hashed
`.bin` files with zero-based offset/length tables. Default bootstrap size is four
frames, followed by at most 16 frames / 256 KiB per chunk. Original frame URLs
remain fallback, with at most three active requests and a 160 MiB decoded budget.

No re-render or re-pack is needed for this case-page integration. For recovery or
a later deliberate frame revision, pack the complete final frames first, then:

```powershell
& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_frame_chunks.py --write-manifest --report ../.codex/motion-loading-20260913/transport/final-validation.json
```

The chunk CLI accepts at most 32 frames / 16 MiB to match the browser loader.
Without `--write-manifest` it writes a candidate manifest; `--output-root` stages
chunks elsewhere. It verifies all ranges and source hashes before publication.
Earlier full-frame rendering/packing belongs to the `9608b5d` release source and
`../../../.codex/motion-loading-20260913/` evidence.

Keep the retained refinement, functional/CFD, and assembly-cache inputs described
in `../../EXPLODED_VIEWS.md`. The earlier modeled 5,678 → 206 ms first-pose result
is a deterministic network/decode simulation, not production latency.

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
