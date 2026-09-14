# Project animations, starting covers and progressive loading · 2026-09-13

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
display-fit limitations still apply; see `EXPLODED_VIEWS.md`.

Current evidence and PNG masters are in `../.codex/motion-loading-20260913/`,
including `poses/`, `loader/` and `transport/`. Earlier motion and CFD evidence
remain required for the fourteen retained sequences and complete recovery.

## Interaction

Hover and scroll to advance or reverse; outward input at either endpoint scrolls
the page. Keyboard/touch sliders retain subpercent progress. Leaving the card,
opening a gallery or hiding/filtering it restores its cover. Carbon reports its
completed ply count. Large jumps take at least about 1.8 seconds for a full sweep.
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
  by at most 2/255 in channel values. The source cover stays unchanged. All 363
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

The retained CFD cover directly shows the same steady pressure field and physical-time
path markers as the animation at progress 0.5. The existing real Fluent 24.1.0
solve completed 400 iterations: 377,141 tetrahedra, 47,450 wall triangles and 49
numerical paths. Pressure remains −10645.81 to +7817.95 Pa, without clipping.
The zero-centered asinh scale (750 Pa) uses blue for negative and orange/red for
positive gauge pressure. Legend and wall share one color transfer.
Very low minimum orthogonal quality (~3.187e−9), no prism boundary layer or
grid-independence study, and first-order transport limit aerodynamic accuracy.
The original lost case is not reproduced exactly. Native case/data and raw fields
remain in the previous evidence folder and are included in the new backup.

The two newly revised covers are rendered at 1800×1200 with 192 samples, using
their unchanged animation controllers and cameras at progress 0: Vine is retracted
and Education is separated. They ship at 480/960/1800 pixels in
`assets/editorial/start-20260913/`. The retained CFD cover stays at progress 0.5,
and the retained tensile cover at 0. Camera, motion/material provenance, original
first-frame hashes, master hashes and final variant hashes are recorded in the
catalogue. All 42 other current variants and all 60 historical files are preserved.

## Verification and recovery

`../.codex/motion-loading-20260913/asset-validation.json` checks all current frames,
chunks, dimensions, hashes, modes and source/controller evidence, including exact
preservation of the fourteen retained sequences against `bca2175`.
`catalog-validation.json` checks all 48 current variants, the six newly selected
files, all 60 historical files, and original model/gallery preservation.
`transport/final-validation.json` verifies complete, nonoverlapping byte ranges
and source-equal SHA-256 hashes for every chunk slice. Loader regressions cover
progressive readiness, fallback, cancellation, range validation, wheel endpoints,
reduced motion and the memory budget. Asset, cover and local browser checks have
passed; `../.codex/motion-loading-20260913/browser-local.json` records browser QA.
Automated browser checks do not establish physical touchscreen testing.

The planned backup is
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-motion-loading`.
Recovery must include exact current and previous Git releases, the working copy,
Git bundle, new and retained PNG masters, original CAD, Fluent case/data, current
pose/transport/loader/browser evidence and required earlier motion-plan caches.
Use its release metadata and deployment verification to establish completion and
online status. Production checks compare responses with canonical Git blobs;
release archives must disable Windows line-ending conversion. Preserve unrelated
untracked LOD experiments; do not blindly stage directories.
