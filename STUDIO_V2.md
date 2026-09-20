# Interactive engineering studio v2

## Current project pages · 2026-09-20

`project-3d.html?project=<key>` now uses the main site's complete case-study
layout, content renderer and stylesheet. The original `#<key>` URLs normalize
to this query form so native chapter anchors work. All sixteen pages include
the full chapters, gallery/lightbox, documented facts, engineering record,
downloads and Javelin BOM. Ordinary `case-study.html` output is unchanged.

The live model occupies the case page's existing preview position.
`project-case-3d.js` embeds the optimized `studio-inspector.js` with rotation,
zoom, forward/reverse playback, reset and camera views. It suspends rendering
offscreen, while hidden, and during the shared image lightbox. The page does
not load the main site's pre-rendered WebP sequence player or the former
sidebar UI. Keep those older modules available for already-open clients.

Room appearance and return behavior are unchanged. Return links use the
literal `experience.html?return=project` protocol; that value is not a project
key. This section supersedes the historical sidebar/page layout below.

2026-09-19 · Interactive studio release. Baseline: `69ee72c`.
Exact publication status is recorded separately in the release backup's
`release-metadata.json` and `deployment-verification.json`.

## Room rollback, retaining the project workbench

The room, first-entry camera tour, lighting, exhibit placement, résumé sheet,
header and dock are restored to the preceding `69ee72c` version. The homepage
studio invitation is also restored. The new project workbench remains at
`project-3d.html#<key>`, with the same 16 source animations and shared records.
Project clicks in the original room now open that page; its Studio button returns
to the original room. One-use return state preserves the room camera and lighting
when browser storage is available. Existing `experience.html#<key>` links redirect
directly to the workbench without downloading the room. Case-study 3D links use
the new explicit workbench address.

The original implementation notes below describe the retained workbench and its
source assets. The v2 room shell/labels are no longer used by `experience.html`.

## Visit and operate

Open `experience.html` to browse the original 15-exhibit room. Open
`project-3d.html#steering` for a project workbench and its 16-project cover
directory. Search and categories follow the main portfolio order. Education is
available through the workbench directory and its case-study link.

Drag the model to orbit; scroll or pinch over the model to zoom. The separate
timeline accepts dragging, native range-keyboard input and wheel scrubbing only
within the timeline. Play, pause, reverse, reset and source/front/side/top/isometric
views remain available. Camera changes do not change motion progress. Steering
components can be selected for short explanations of the transmission path.

The workbench starts paused at the source pose. The room uses its original
first-entry camera behavior. Desktop details occupy a separate sidebar;
mobile keeps the model and controls above collapsible project details. Full case
studies, the Javelin BOM, technical records and the resume remain ordinary links.
Returning to the studio restores room browsing without a forced camera tour.

## Modules and assets

- `experience-v2.js` owns project routing, cancellation and workbench activation.
  `experience-entry.js` preserves old project links or imports the restored room.
  Workbench and room now use separate documents; the room bridge is inactive.
- `studio-ui.js` / `studio-ui.css` provide navigation, controls, loading/retry
  states and responsive details. The source cover remains until the first real
  WebGL paint; a failed model leaves project information and case links usable.
- `studio-catalog.js` derives titles, responsibility/scope, results/targets,
  selected facts and media from the existing four shared data files. It preserves
  their labels and full gallery indexes: 79 supplemental fields, 94 image
  references and the 35-row Javelin BOM remain in the shared case-study records.
  CAD and plots retain complete-image presentation, including the full Seat CAD.
- `studio-inspector.js`, its camera/loader/material modules and
  `studio-motion-runtime.js` load and sample the selected project. Poses come from
  absolute source samples; reversing and seeking do not accumulate transforms.
- `tools/studio-export/export_studio_motion.py` exports the approved Blender
  motion controllers into `assets/studio-motion/<key>/manifest.json` and compressed
  geometry/motion buffers. Export audits retain source hashes and pose checks.

The stage uses neutral white light and `#191919`, retaining component colors.
Only the active view renders. Superseded requests and decoding are cancelled;
evicted GPU resources are disposed. The cache holds at most two projects, with
100 MiB mobile / 192 MiB desktop managed-array budgets. One oversized current
project may remain after other entries are evicted. These accounting limits are
not total browser or GPU memory limits. The standalone workbench uses automatic
quality; the restored room retains its original 2K/4K lighting selector.

## Source motion coverage

All 16 projects use exported source geometry and motion, rather than the main
site's fixed-camera WebP frames. The main site's existing frame sequences remain
unchanged.

| Key | Workbench motion |
| --- | --- |
| `steering` | Steering wheel, shafts, U-joints and rack linkage; source 90° limit |
| `vineRobot` | Translucent tube eversion from the pressure vessel |
| `javelin` | Four propellers and the source flight/display motion |
| `scanner` | Scanning gantry travel |
| `brakeSim` | Illustrative metal heating cycle |
| `aura` | Source assembly/disassembly sequence |
| `carbonSeat` | One cloth surface at a time seating into the fixed shell |
| `seat` | Mk.7 sheet-metal seat folding/unfolding |
| `materialTest` | Illustrative tensile loading and fracture sequence |
| `ansysCfd` | Existing solved pressure surface and particles along numerical paths |
| `pool` | Rack/cue pullback and release |
| `lineFollower` | Wheel rotation and steering motion |
| `formlabs` | Smelly gantry motion |
| `telecaster` | Controllable display rotation |
| `education` | Source guitar-kit assembly from separated parts |
| `ftc` | Existing reconstructed source robot's assembly/disassembly sequence |

## Interpretation and rendering limits

Sampled motion and interpolation do not establish measured engineering timing,
manufacturing tolerances or new simulation results. WebGL PBR lighting and
procedural noise approximate the source materials; they are not pixel-identical
to Blender Cycles. Source linear colors, material coordinates, rigid/deforming
poses, visibility and heat tracks are retained. Carbon uses source weave scale,
colors and bump parameters with pixel-footprint filtering.

Carbon's ten visual stages illustrate placement, not the physical ply count.
The confirmed build uses EL2 epoxy, 20 main plies of 3K 200 g/m² twill and 5–10
local reinforcing plies. Completed cloth merges into the unchanged source shell;
there is no accumulated thickness. Cloth clearance and placement remain process
illustrations, not a laminate or cure simulation.

CFD reuses the existing Fluent solution and exported numerical paths; this change
does not rerun Ansys. Pressure stays steady while markers move. The fixed readable
legend preserves the source nonlinear pressure scale and full range. The existing
mesh/model limitations and qualitative-use boundary remain; the colored surface
does not provide a new numerical probe or validated aerodynamic prediction.

## Verification record

`../.codex/studio-v2-20260919/browser-runtime.json` reports all 16 browser package
checks passed, including compiled source material hooks. The browser harness
also exercises replacement, camera/motion independence, both playback directions,
bounded caching and sleeping when inactive.

`../.codex/studio-runtime-20260919/runtime-results.json` reports **39 checks passed**
across all 16 packages: source endpoints, repeated/reverse/random seeks,
portrait/landscape motion-envelope framing, cancellation, eviction, disposal,
retry, malformed ranges and gzip delivery handling. Run the browser harness at
`tools/studio-tests/index.html?run=1`; see its README for the runtime contract.

Recorded local load durations and CPU render timings are diagnostic samples,
not a controlled production before/after comparison, GPU frame times or an FPS
guarantee. Visual/browser acceptance and production byte verification are separate
release checks; these local reports do not establish a successful deployment.
