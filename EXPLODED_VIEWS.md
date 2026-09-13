# Project animation and cover refinement · 2026-09-13

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

See `EXPLODED_VIEWS.md` for current motion details and verification, and
`tools/exploded-render/README.md` for reproduction. Current evidence and PNG
masters are in `../.codex/motion-refinement-20260913/`. The previous
`functional-release` backup remains a separate, verified historical release.

## Interaction

Hover and scroll to advance or reverse; outward input at either endpoint scrolls
the page. Keyboard/touch sliders retain subpercent progress. Leaving the card,
opening a gallery or hiding/filtering it restores its cover. Carbon reports its
completed ply count. Large jumps take at least about 1.8 seconds for a full sweep.
Only the active sequence loads, three requests at a time. The cache permits at
most two sequences within 160 MiB; a 145-frame sequence estimates 151.16 MiB.
Reduced motion changes frames directly. Failed downloads leave the cover usable.

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
  by at most 2/255 in channel values. The source cover stays unchanged. All 363
  carbon and 435 tensile seeks match the previous geometric motion exactly.
- The orange tensile specimen keeps its original fabric roughness/noise/bump.
  Both ends stay clamped; the upper grip stretches and separates it into retained
  halves. This is a qualitative fracture display on the documented photo-based
  reconstruction, not a measured stress-strain or fracture-load result.
- Vine uses a translucent double-wall film at the actual outlet; hardware stays
  fixed. Javelin rotates four propellers on their measured axes. Scanner/Smelly
  retain guide-axis gantry motion, with Smelly's coupled four-start screw.
- Education retains its 23 strict assembly stages and matched original V2 STL
  layout. Its new cover shows the assembled endpoint from the same front view.
  Existing display-fit adjustments are about 2.319 mm at the neck and pickup
  front plate, plus a common floor lift; they are not manufacturing tolerances.
  No accepted stage uses the optional numerical seam extension.
- Brake heating, the connected driver-seat unfold with 44 holes and two existing
  render-only corner reliefs, FTC disassembly and Telecaster's static card retain
  their prior verified behavior. Original GLBs and galleries remain unchanged.

## CFD and matching covers

The new CFD cover directly shows the same steady pressure field and physical-time
path markers as the animation at progress 0.5. The existing real Fluent 24.1.0
solve completed 400 iterations: 377,141 tetrahedra, 47,450 wall triangles and 49
numerical paths. Pressure remains −10645.81 to +7817.95 Pa, without clipping.
The zero-centered asinh scale (750 Pa) uses blue for negative and orange/red for
positive gauge pressure. Legend and wall share one color transfer.
Very low minimum orthogonal quality (~3.187e−9), no prism boundary layer or
grid-independence study, and first-order transport limit aerodynamic accuracy.
The original lost case is not reproduced exactly. Native case/data and raw fields
remain in the previous evidence folder and are included in the new backup.

The four revised covers are rendered at 1800×1200 with 192 samples, using the
same controllers/cameras as their animations: vine progress 0.75, CFD 0.5,
Education 1, tensile 0. They ship at 480/960/1800 pixels. Camera, material/motion
provenance, master image hashes and final variant hashes are recorded in the
catalogue. This changes current cover selection while preserving old image files.

## Verification and recovery

`asset-validation.json` checks every current frame's content hash, decoded size,
mode, frame count and memory estimate, plus controller evidence and real CFD data.
`catalog-validation.json` checks all 48 current variants and all 48 historical
cover files, source provenance and preservation of original galleries/models.
Browser evidence checks current covers, new modes, reversible sliders, carbon
counting, modal reset and a narrow layout. The interaction regression covers
load cancellation, wheel boundaries, easing, memory eviction and reduced motion.
Automated browser checks do not claim physical touchscreen device testing.

Exact production verification compares responses against canonical Git blobs;
Windows archive line-ending conversion is explicitly disabled for release ZIPs.
The backup contains the exact release and previous release, full working copy,
verified Git bundle, new/old PNG masters, source CAD copies, Fluent case/data,
geometry/material/browser evidence and required earlier motion-plan caches.
Preserve unrelated untracked LOD experiments; do not blindly stage directories.
