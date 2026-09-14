# Project animations, starting covers and progressive loading · 2026-09-13

## Current native-page integration · 2026-09-13

Prepared against production `9608b5d`; revision `case-pages-20260913`.
The planned backup is `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`. Its
`release-metadata.json` and `deployment-verification.json` establish exact commit
and online status when publication completes.

The homepage and all 16 native case pages share the existing animation loader.
Case pages add 64 chapters, source records, downloads and image zoom; homepage
project cards navigate directly instead of opening a project modal. Detail
previews are capped at 640 CSS pixels. The homepage also has prominent 3D Studio
actions and a workshop preview between hero and work.

All 16 covers now derive from progress 0 with the delivered camera and normalized
projection. Forty-eight responsive files use
`assets/editorial/animation-start-20260913/`, selected through
`assets/editorial/animation-covers.json`. Old cover files remain available.

The 2,032 static 640×427 WebP frames, 159 lossless chunks and 24,347,588 image bytes
are unchanged from `9608b5d`. No frames, animation timing, encoding quality, source
models, CFD fields or original gallery images are replaced by this integration.
Four long sequences have 145 frames; twelve have 121. Original sequences remain
in `functional-20260913/`, `refined-20260913/` and `flight-20260913/`.

## Interaction

Hover and scroll over a homepage card or the case-page preview to advance or
reverse; outward input at either endpoint scrolls the page. Touch and keyboard
sliders retain subpercent progress. Case-page previews stay within 640 CSS pixels
so the 640×427 frames are not enlarged. Leaving the preview or opening an image
lightbox restores the initial cover; hidden/filtered cards also reset. Carbon
reports its completed ply count. Full-sweep easing remains unchanged.
Only the active sequence loads, with at most three requests in flight. The first
four-frame chunk allows a usable pose before the complete sequence arrives;
available frames draw progressively while remaining chunks load. A requested
pose is prioritized, and individual WebP requests provide fallback when chunk
transport fails. Chunk offsets are zero-based ranges into unchanged frame URLs.
The cache permits at most two sequences within 160 MiB; a 145-frame sequence
estimates 151.16 MiB. Reduced motion changes frames directly. Failed downloads
leave the cover usable.

The 159 chunk requests replace 2,032 individual image requests, a 92.18% reduction,
with exactly the same 24,347,588 compressed image bytes. A deterministic loader
model using 100 ms RTT, 10 Mbps and 2 ms decoding gives a median first usable pose
of 206 ms versus 5,678 ms for the previous loader. This is a simulated comparison
from `../.codex/motion-loading-20260913/loader/benchmark-final-assets.json`;
actual network and device timing must be measured separately.

## Geometry, materials and source interpretation

- Steering follows neutral → −90° → neutral. All 121 rendered poses plus each
  integer angle (210 unique combined poses) introduce no new contact pairs;
  maximum source upper-yoke penetration remains 0.00630016 scene units. The source
  lacks explicit joint cross pins and rack teeth; this is a kinematic illustration.
- Pool retracts along its source +Y axis by 0.14 scene units (about 23.17 mm).
  Retraction occupies 64% of the cycle, hold 8%, release 12%, and rest 16%.
  The fixed 250 mm support remains stationary; continuous path analysis places
  its first new solid obstruction at 0.148417 scene units. The displayed stroke
  retains about 1.39 mm clearance. The original simplified rack/pinion tooth
  overlap varies from 0.0017343 to at most 0.00228265 scene units during meshing;
  this limitation is explicit, not presented as a perfect tooth contact model.
  All 145 sampled poses add no new contacting component pairs. Meshes and axis
  spacing are unchanged. Cycle timing is illustrative, not measured launch speed.
- LineFollower uses its real wheel centers and X axle. The complete chassis yaws
  ±10°, both wheels complete two nominal turns, and differential rotation follows
  the yaw. Translation is suppressed to keep the model on the card; this does
  not claim a measured path or controller response. All 121 sampled poses add
  no new contacts. All three mechanisms pass reverse/random seeking without drift.
- AURA retains all 37 source components and 106,314 triangles. Eleven extraction
  stages pass 1,100 path samples and 66,476 continuous triangle tests with no new
  interference or floor crossing; 435 seeks have zero drift. Wheel/axle/fork and
  embedded fasteners retain their source grouping where independent extraction
  fails strict checks. Thirty-five source contact/intersection pairs are recorded.
- Carbon copies the complete original cover material graph. The shell and all
  ten plies share a single material and source-space coordinates; the weave does
  not slide or rescale during deformation. Same-point render comparisons differ
  by at most 2/255 in channel values. The original cover file is preserved. All 363
  carbon and 435 tensile seeks match the previous geometric motion exactly.
- The orange tensile specimen keeps its original fabric roughness/noise/bump.
  Both ends stay clamped; the upper grip stretches and separates it into retained
  halves. This is a qualitative fracture display on the documented photo-based
  reconstruction, not a measured stress-strain or fracture-load result.
- Vine uses a translucent double-wall film at the actual outlet; hardware stays
  fixed. Its cover now matches the exact retracted starting pose. Scanner/Smelly
  retain guide-axis gantry motion, with Smelly's coupled four-start screw.
- Javelin combines whole-airframe flight sway with all four propellers rotating
  around their measured axes. Telecaster completes a rigid 360° turntable cycle.
  `display_motion.py` preserves source mesh and material data; pose evidence in
  `../.codex/motion-loading-20260913/poses/` checks source preservation and
  forward, reverse and random seeking. These are display motions.
- Education retains its 23 strict assembly stages and matched original V2 STL
  layout. Its cover now shows the separated starting pose at progress 0 from
  the same animation camera; the assembled endpoint remains available by scrubbing.
  Existing display-fit adjustments are about 2.319 mm at the neck and pickup
  front plate, plus a common floor lift; they are not manufacturing tolerances.
  No accepted stage uses the optional numerical seam extension.
- Brake heating, the connected driver-seat unfold with 44 holes and two existing
  render-only corner reliefs, and FTC disassembly retain their prior verified
  behavior. Original GLBs and galleries remain unchanged.

## CFD and matching covers

The current CFD cover shows the steady pressure field and physical-time path
markers at animation progress 0, matching the initial camera frame. The existing real Fluent 24.1.0
solve completed 400 iterations: 377,141 tetrahedra, 47,450 wall triangles and 49
numerical paths. Pressure remains −10645.81 to +7817.95 Pa, without clipping.
The zero-centered asinh scale (750 Pa) uses blue for negative and orange/red for
positive gauge pressure. Legend and wall share one color transfer.
Very low minimum orthogonal quality (~3.187e−9), no prism boundary layer or
grid-independence study, and first-order transport limit aerodynamic accuracy.
The original lost case is not reproduced exactly. Native case/data and raw fields
remain in the previous evidence folder and must accompany the recovery backup.

The initial-cover wrapper stages the scene at the delivered 640×427 resolution,
renders a 48-sample proof, then produces an 1800×1200 master at 192 samples with
the same geometry, materials, lighting, ground and camera. Pixel aspect
1:1.00078125 compensates for the rounded animation aspect ratio so normalized
projection remains matched. Responsive widths are 480, 960 and 1800 pixels.

All 16 covers, including CFD, use progress 0. Vine is retracted and Education is
separated. `assets/editorial/animation-covers.json` supplies both page types;
static fallbacks should match its records. Per-project provenance accompanies
the new files, and all 66 prior cover images remain preserved.

## Verification and recovery

Current evidence is in `../.codex/case-pages-20260913/`.
`content/editorial-validation.json` checks all 16 stories, 64 chapters, valid
gallery references, source preservation, the CFD download and next-project cycle.
`initial-cover-validation.json` records frame-zero scene/camera/projection checks,
new variants and preservation against `9608b5d`. Runtime and browser reports
cover native navigation, previews, fallback, original-image zoom and responsive
layouts. Cover and browser acceptance must be read from the completed current
reports; earlier release tests do not establish this revision's acceptance.

Retained motion evidence remains in `../.codex/motion-loading-20260913/`,
`../.codex/motion-refinement-20260913/` and the earlier functional/CFD folders.
The transport records verify every slice against original WebP bytes, with no
image-byte overhead. The quoted loader benchmark is the prior deterministic
simulation; it is not a new production timing measurement.

The planned backup is
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`.
Recovery requires current/previous Git releases, working-copy source and bundle,
new/old cover masters, animation PNG masters, source CAD, Fluent case/data and
the required earlier controller caches. Release metadata and deployment checks
establish publication. Compare production files with canonical Git blobs and
disable archive line-ending conversion. Preserve unrelated LOD experiments.
