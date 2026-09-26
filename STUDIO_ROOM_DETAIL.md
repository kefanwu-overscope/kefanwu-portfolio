# Studio exhibit and workshop revision · 2026-09-26

The room now presents all 16 projects using the current main-site animation
sources at progress zero. Its established cabinet layout, navigation, project
pages and return buttons remain in use. Guitar Education Kit occupies the
existing clear workbench area, with the separated parts laid flat for assembly.

## Models and furnishings

- Replace the older CAD/material-bucket exhibits with current source geometry,
  initial visibility, colors and procedural material coordinates. FTC uses the
  same documented reconstruction as the main site. Material testing includes
  the current grips and orange specimen; Vine includes the initial polymer film.
- CFD is now the actual pressure-colored aircraft and flow paths instead of a
  monitor displaying an old picture. The saved simulation and scientific data
  are unchanged. Pressure labels remain in the full project viewer.
- Carbon keeps its exact shell geometry and source weave mapping, with future
  animation layers hidden. The driver seat retains the current folded geometry.
- Pool Sniper and LineFollower are aligned along their shelves to avoid shrinking
  their long dimension into cabinet depth. Telecaster retains the main site's
  visible painted finish; no engineering facts or wood specification changed.
- Rebuild the decorative printer with folded panels, rails, trucks, threaded
  screws, belts, supported build plate, toolhead fan, heat sink, nozzle, cable
  paths, open spoked filament reels, hinges, vents and fasteners. Its head moves
  within the printed bracket's width. It is an original generic decorative model.
- Refine the drill, caliper, wrenches, ratchet, pliers, cutters, sockets, hex keys
  and level; add proper jaws, pivots, recesses, markings and supporting hangers.
  PSU, soldering station, screwdriver rack, multimeter, oscilloscope and lamp
  receive matching construction details. Pegboard holes now have a natural scale.

The complete project-by-project comparison is in
[tools/room-exhibits/ALIGNMENT.md](tools/room-exhibits/ALIGNMENT.md).
Main covers, full animation packages, case-study text, photographs, confirmed
specifications and Javelin BOM remain unchanged.

## Baking and loading

The actual final furnishings were exported and rebaked in Blender 4.5.9 LTS /
Cycles / RTX 5080 OptiX: two native 4096² maps, 256 samples, six diffuse bounces,
512×256 probes and separate 512² desktop maps. The original room geometry and
UV atlas remain byte-identical. RGBM16 encoding, straight alpha, scene-linear
downsampling and the calibrated irradiance/π shader contract are preserved.
Default loading stays at 2K; 4K is requested only when selected.

The 16 room assets total **6,144,960 gzip bytes / 368,352 triangles**, with
source-attribute-aware display simplification. Carbon and the perforated seat
are unsimplified. The room never downloads their full animation streams.
Gzip decoding occurs inside the existing single preparation queue, alongside
three bounded network transfers. Old assets remain available for older clients.

Decorative geometry is merged by material and moving assembly. The standalone
new builders contain 91 meshes and 78,238 triangles before room batching, using
one 512² canvas label atlas and the existing live scope texture. They add no
external texture/model downloads.

The default lighting/geometry package is **3,237,693 bytes**, 1.60% smaller than
the preceding release. Controlled local browser measurements at 1280×720,
HTTP cache disabled, with warm OS/GPU caches:

| Measurement | Previous 9b6a54d | Updated room |
| --- | ---: | ---: |
| Startup resource bytes | 21,983,362 | 21,439,141 |
| Local reveal, median of three | 0.931 s | 1.205 s |
| Reveal at 10 Mbps / 40 ms, one run each | 18.702 s | 18.544 s |

The extra construction/decode work adds about 0.27 s on the fast local test;
the reduced transfer keeps the constrained-network result similar. These are
single-workstation observations, not first-visit or all-device guarantees.

## Validation and reproduction

Passed: all 16 source/asset audits and rendered cover/model comparisons; 23
room queue, cancellation, shader, batching and return checks; prop geometry,
contact and motion-envelope checks; 12 bake provenance/geometry checks; all
encoded PNG integrity/quantization checks. Browser review covered day/night,
2K/4K, both cabinets, the workbench and mobile project/return controls.

Reproduce using `tools/room-exhibits/README.md`, `tools/room-props/README.md`
and `tools/bake/DETAIL_20260926.md`. Private source scenes, screenshots and
measurements are in `../.codex/room-detail-20260926/`; static source exports are
in `../.codex/room-exhibits-20260925/`. Only content-hashed runtime assets are
published, with immutable cache headers. Release backup and online verification
records live in the current evidence directory's `release/` folder.
