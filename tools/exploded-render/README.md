# Render project-card function and assembly previews

The user authorized the functional animation release of 2026-09-13, with cache
label `functional-release-20260913`. The previous production version is `b59c0e8`. Offline
Blender renders become static WebP frames. The homepage adds no WebGL or video.
The original covers, galleries and source models remain preserved.

## Delivered modes and frames

Fifteen of the sixteen cards receive animation. Telecaster stays a static card
with its original cover and gallery. The delivery contains 1,863 frames at 640×427 and
48 Cycles samples: 121 per animation, except 145 each for vine and tensile test.
All 48 approved cover files remain unchanged. Final byte totals, packing and
`validate_exploded.py` evidence for all fifteen sequences, including CFD's 121
frames, are recorded in `../../EXPLODED_VIEWS.md`. The CFD solve is accepted
for qualitative visualization.

| Key | Mode | Function shown | Frames |
| --- | --- | --- | ---: |
| steering | steering | Wheel, coupled shafts/universal-joint yokes and rack | 121 |
| vineRobot | extension | Thin film everts from the actual side outlet | 145 |
| javelin | propellers | Four coaxial propeller rotations | 121 |
| brakeSim | heat | Intact metal warms to red | 121 |
| aura | assembly | Sequential source-component extraction | 121 |
| scanner | gantry | Vertical gantry and horizontal carriage travel | 121 |
| carbonSeat | layup | Ten successive carbon cloth plies | 121 |
| seat | unfold | Continuous sheet-metal unfolding | 121 |
| materialTest | tensile | Grips stretch the specimen through rupture | 145 |
| ansysCfd | flow | Rebuilt Fluent wall pressure and numerical flow paths | 121 |
| pool | assembly | Two supports, a bracket and three axial shafts | 121 |
| lineFollower | assembly | Two outer wheels, connectors, headers and sensors | 121 |
| formlabs | gantry | Smelly gantry, carriage and coupled lead screws | 121 |
| education | assembling | Separated kit assembles into its CAD guitar layout | 121 |
| ftc | reconstruction | Sequential reconstruction-component extraction | 121 |

The browser uses slower wheel progression, bounded interpolation and reversible
sliders. It fetches only the active sequence, with three concurrent requests;
the decoded RGBA estimate has a 160 MiB global budget and at most two cached
sequences. At these frame counts the budget normally retains one full sequence.
Endpoint scroll passes to the page; keyboard/touch, reduced motion, offscreen
pausing and original modal/gallery interactions remain supported.

## Controllers and evidence

- `mechanism_motion.py`: source-axis steering and gantry kinematics, computed
  from saved matrices for arbitrary seeks. Missing internal rack teeth/cross
  pins and demonstration travel limits are documented in each report.
- `functional_processes.py`: propeller rotation, added translucent everted film
  and qualitative tensile deformation/fracture. Timing, pressure, fracture load
  and material response are not measured simulation outputs.
- `assembly_motion.py` and `translation_collision.py`: cached coherent groups,
  continuous triangle SAT and swept AABB tests, with bidirectional closed-solid
  containment and floor checks. Original fixed contacts can remain within a group.
- `expanded_assembly.py`: six verified extraction stages each for Pool and
  LineFollower, and the 23-stage Education assembly. Education helper files fit
  matching original `exploded`/`V2` STL triangle correspondences to rigid poses;
  existing meshes and materials are transformed, never replaced.
- `material_processes.py`: intact brake heating and ten sequential cloth plies.
- `seat_unfold.py`: sheet panels/bends and two documented render-only corner
  reliefs, preserving all 44 holes and the unchanged original GLB.
- `cfd_flow.py`: accepts hashed Fluent wall-pressure/pathline exports only. Its
  schema fixtures are tests, not physical solver results, and it has no synthetic
  flow fallback. A steady pressure field is not presented as transient pressure.
- `render_exploded.py`: integrates controllers, checks framing across 121 poses
  and records per-project motion provenance. `pack_exploded.py` encodes WebPs,
  hashes frame URLs and supports partial packs. `validate_exploded.py` checks the
  fifteen keys, modes, counts, dimensions, hashes, memory budget and original covers.

Pool and LineFollower each passed 600 positive sampled poses and continuous
triangle checks. Education passed 2,100 positive translation poses and 99,368
continuous triangle tests, plus a continuous separation bound for its isolated
neck rotation. All three passed 363 forward/reverse/random seek poses with zero
matrix drift. No accepted Education stage needed the optional initial numerical
seam extension. Independent bridge checks are recorded in
`../../../.codex/functional-motion-20260913/education-bridge-final-validation.json`.

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

## Reproduce

From the `portfolio-site` root on the current workstation, with the accepted
Fluent export and its provenance present:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_exploded.py -- --projects steering vineRobot javelin brakeSim aura scanner carbonSeat seat materialTest ansysCfd pool lineFollower formlabs education ftc --samples 48
```

Once every required sequence, including CFD, is complete:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/4.5/python/bin/python.exe' tools/exploded-render/pack_exploded.py --copy-to-site
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/4.5/python/bin/python.exe' tools/exploded-render/validate_exploded.py
```

PNG masters default to `../../../.codex/functional-motion-20260913/generated`
relative to this directory. Use `--output` / `--input` for another location.
`--only 0 30 60 90 120` makes a five-pose proof for a 121-frame sequence; a partial
render must not be packed as complete. WebP quality is 85/method 6, without raster
retouching. Original staging inputs/provenance remain in `../editorial-render/`.

The release recovery entry is
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-functional-release/RESTORE.md`.
The adjacent `release-metadata.json` identifies the exact release commit;
`deployment-verification.json` records the actual production verification result.
The earlier functional-motion, motion-revision and pre-publish backups remain
historical snapshots. See `../../EXPLODED_VIEWS.md` for final asset totals.

Git retains these controller/renderer/packer sources and the current website
assets. Offline recovery also requires the staging GLBs in `../editorial-render/`,
the copied external CAD inputs and Fluent exports in the functional-motion
evidence archive, and `../../../.codex/exploded-revision-20260913/motion-plans/`
for the existing assembly controller's cached plans. The release backup keeps
these inputs and caches; they are not additional website assets.
