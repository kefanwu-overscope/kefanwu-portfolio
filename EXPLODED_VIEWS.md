# Functional project animations · 2026-09-13

Local preview: http://127.0.0.1:4176/#work

The authorized functional animation release supersedes cinematic release
`b59c0e8`. Fifteen cards animate; Telecaster guitar is static. The exact release
commit and online verification are recorded in the release backup below.

## Interaction

Hover a card and scroll forward to advance, backward to reverse. Outward wheel
input at either endpoint continues scrolling the page. Moving away restores the
original cover. Native sliders support keyboard and touch; project clicks still
open the original galleries. Carbon displays the number of completed plies.

The revised controller preserves subpercent slider values, eases wheel movement,
and limits large jumps so a full sweep takes at least about 1.8 seconds. It handles
focus scrolling a previously offscreen card into view, cancels old loading work,
and resets immediately for modals, filtering and hidden cards. Reduced-motion
users receive direct frame changes. Download failures preserve the static cover.

## Project motion and source interpretation

- **Mk.8 steering:** the wheel drives three fitted shaft axes, two phased universal
  joints and rack translation. The cycle uses neutral → −32° → neutral, avoiding
  added interference in the source yokes. The source lacks explicit cross pins
  and rack teeth; the linkage is an illustrated mechanism, not a tolerance model.
- **Vine robot:** a semitransparent double-wall film tube everts from the actual
  side outlet. The vessel and hardware remain fixed.
- **Javelin:** four propellers rotate about their measured hub axes; motor bases,
  nuts, wings and fuselage stay fixed. Source mating contacts are retained.
- **LiDAR / Smelly:** gantries and carriages follow the fitted guide axes. Smelly's
  four-start leadscrew also turns in step with carriage travel.
- **Material testing:** the upper fixture pulls the specimen against the fixed
  lower grip. It necks and splits into two retained halves, with both ends still
  clamped. The tester retains its documented photographic reconstruction; this
  demonstration is not a newly calibrated constitutive material simulation.
- **CFD:** actual Ansys Fluent 400-iteration rebuilt cruise results
  provide the surface pressure field and numerical paths. Markers move along
  exported paths using physical travel time. The pressure field is steady. The
  enhanced color scale centers on zero gauge pressure: negative pressure is blue,
  positive pressure orange/red. Full-range asinh normalization (750 Pa scale)
  makes common high-pressure regions visible without clipping or changing data.
  The nonlinear legend marks both extrema, −2,000, zero and +2,000 Pa.
  lost original case is not reproduced exactly; the new airframe-only case uses
  documented geometry cleanup and has no rotor wake, prism boundary layers or
  mesh-convergence study. See `../.codex/functional-motion-20260913/cfd/rebuild-report.md`
  for accepted data, numerical checks and limitations. The original CFD cover
  and gallery remain unchanged.
- **Pool / LineFollower:** each has six sequential extraction groups. Pool adds
  side supports, metal bracket and cross-shafts; LineFollower separates tires,
  USB/power hardware, header groups and front sensors.
- **Education guitar:** 23 stages assemble the kit into the source V2 CAD layout.
  The neck turns upright; pickups, bridge, guard and controls enter through clear
  paths. The pickup's two original independent pieces enter from opposite sides
  of the bridge. A fixed front view makes the completed teaching guitar readable.
  Explicit display-fit adjustments are approximately 2.319 mm of neck seating
  height and pickup front-plate clearance, plus a common floor lift. They are not
  manufacturing tolerances. Original meshes and materials are preserved.
- **Brake / driver seat / carbon:** intact metal heats from silver to red; the
  driver seat unfolds into a continuous sheet retaining all 44 holes; exactly ten
  cloth plies are laid one at a time. Heat colors and ply spacing are illustrative.
  The earlier two render-only corner reliefs remain documented; source GLBs are
  unchanged. AURA and FTC retain their checked sequential assembly previews.

## Assets and loading

1,863 static WebP frames, 23,684,170 bytes,
640×427, 48 Cycles samples. Asset revision: `functional-20260913`.
The controller, stylesheet and manifest cache revision is `functional-release-20260913`.
Every frame URL carries a content hash. The new subdirectory keeps previously
opened manifests from mixing old and new sequences.

| Project key | Mode | Frames |
| --- | --- | ---: |
| steering | steering | 121 |
| vineRobot | extension | 145 |
| javelin | propellers | 121 |
| brakeSim | heat | 121 |
| aura | assembly | 121 |
| scanner | gantry | 121 |
| carbonSeat | layup | 121 |
| seat | unfold | 121 |
| materialTest | tensile | 145 |
| ansysCfd | flow | 121 |
| pool | assembly | 121 |
| lineFollower | assembly | 121 |
| formlabs | gantry | 121 |
| education | assembling | 121 |
| ftc | reconstruction | 121 |

Only the manifest loads initially. Interaction fetches three frames at a time.
At most two sequences are retained, with a further 160 MiB decoded-pixel budget;
two full-length sequences exceed that budget and cause eviction. The largest
145-frame sequence estimates 151.16 MiB of decoded pixels. The homepage adds no
WebGL runtime or video stream. Original responsive covers, modal galleries,
project content and 3D studio models remain intact.

## Verification and recovery

All delivered frames decode and match their recorded dimensions and SHA-256.
All 48 approved cover files retain their original hashes. Mechanisms and process
motions were checked for new interference, source contacts and exact seeking.
Pool and LineFollower each pass six checked stages; Education passes all 23,
including continuous rotation-clearance proofs. Its checker did not enable the
optional seam extension. Assembly reverse/random seek checks show zero drift.

Browser checks cover actual sequence loading, mode labels, keyboard progress,
carbon counting, the static Telecaster, modal reset, search and narrow layout.
The controller regression suite covers wheel boundaries, reversal, easing,
loading races, memory eviction, reduced motion and touch-release state. Physical
touchscreen gestures are not claimed as an automated device test.

Source tools: `tools/exploded-render/README.md`. Evidence, PNG masters, CAD input
copies and CFD case/data: `../.codex/functional-motion-20260913/`.

Final recovery location:
`C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-functional-release/RESTORE.md`.
That file and `release-metadata.json` establish snapshot completion; online checks
are in `deployment-verification.json`. The exact release, previous production,
full working copy, Git history, current motion/CFD evidence and required earlier
motion-plan cache are retained. The previous `functional-motion`, `motion-revision`,
`exploded-local` and `pre-publish` backups remain
separate. Do not blindly stage unrelated pre-existing LOD experiments.
