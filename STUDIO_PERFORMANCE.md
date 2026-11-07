# 3D performance release · 2026-09-19

This release preserves the restored room from `329b8c9` and the sixteen project
workbenches. Main-site case studies, WebP sequences, project facts, source CAD,
and material/motion definitions remain unchanged.

## Startup screen and intro · 2026-11-06

Supersedes the startup and intro statements below where they differ.

- The default startup screen is a line drawing of the room
  (`experience-loader-drawing.js`), inked on #0b0c0e paper as each part's geometry
  arrives. At the assets boundary (all base models loaded, before the shader compile)
  it is finished and held, with no canvas frames and the room's render loop parked,
  until the room is prepared. Then its veil lifts over 900 ms into the intro. Under
  reduced motion it is a still drawing that crossfades out.
- It stays the default because of the gate's stall check. Mid-compile long tasks over
  100 ms at 1440, 16 cold runs, runs with any and ms per run: drawing 5/16 and 50.9,
  classic card 10/16 and 139.6, HEAD e42a05b4 13/16 and 197.7. At 390, 8 runs: 1/8 and
  44.2, 5/8 and 196.9, 3/8 and 78.9. Single machine, headless Chrome.
- It shows the classic card instead when: `?loader=classic`, `?draw=off` or no WebGL 2
  (decided before first paint); it is not live within 4 s of the head script; its module
  arrives after the assets boundary; a shader fails to link; or the context is lost.
  `?loader=drawing` is a no-op. The room itself is unaffected by any of these.
- `?loader=classic`, `?draw=off` and `?intro=legacy` are per-URL QA switches, not a
  rollback: they apply only to the URL that carries them, and the studio link on the
  homepage does not keep them. `?warm=off` applies to live detail stages; the room keeps
  its own shader polling path and is unaffected.
- Known limit: under reduced motion on networks slower than about 4 s to the assets
  boundary, the screen is dark paper and the title strip for 4 s, then the classic card.
- The intro is one 5.1 s curve (`INTRO_EYE`, `INTRO_YAW`, `INTRO_PITCH`; light beats in
  `BOOT_BEATS`). `?intro=legacy` keeps the 2026-10-24 two-stop sweep.
- Studio chrome: warm white on neutral dark (`experience.css` `:root`), no #3f8cff or
  glow, text at least 11 px. Room materials are unchanged; the rug LED is still blue.

## Loading

The project renderer first loads geometry and a small, exact initial-pose
buffer. Rotation, zoom, reset and standard camera views are available before
full motion finishes. Animation controls become available after the motion
stream is decoded; failure retains the rotatable model and offers a retry.
The first-pose attributes are bit-identical to full motion sample zero.

The sixteen selected-project packages total **38,751,697 gzip bytes**, down
from **97,677,128 bytes** (60.33%). These are the sum of all packages, not a
single-page download. Vine's first-pose bodies total 891,876 bytes; the seat's
total 105,500 bytes. Scripts, manifests, posters and project photos are additional.

All 3,483,935 source triangles remain. Reindexing requires identical retained
attributes and complete deformation trajectories. Display positions/normals
use bounded uint16 quantization; carbon positions and procedural coordinates,
scientific colors, materials, rigid/process tracks and sample times retain
their original precision. See `tools/studio-export/README.md` for the codec,
independent validator and deterministic reproduction commands.

Content-hashed manifests and binary filenames receive immutable browser caching.
The catalog is revalidated. Original stable manifests/binaries remain available
to clients running the previous renderer. Three.js 0.185.0 is vendored unchanged
under `vendor/three/0.185.0`, including its MIT license and SHA-256 inventory.
Update cache rules after regeneration using
`node tools/studio-export/write_cache_headers.cjs`.

## Rendering

Room network work has three bounded slots; parsing/preparation remains serialized
and yields between tasks. High-detail upgrades wait until the opening camera
settles. Static opaque meshes are batched conservatively by material and space,
excluding interactive, animated, reflected and fallback-only objects. Static
desk shadows are reused, moving shadows update less frequently, and ambient
idle rendering targets 30 Hz while camera movement remains responsive. A
Skip intro control and pointer takeover let visitors leave the camera sequence
(since 2026-11-06 the one-curve intro; `?intro=legacy` keeps the older path)
without waiting through it.

Shader warmup now uses the real composer render target, actual override
materials and the output pass's screen color/tone settings. Warming screen
variants for offscreen draws had left substantial first-frame compilation.

Workbench batching combines only compatible opaque parts with identical motion
and transforms. Steering keeps its original selectable components. Carbon's
mutually exclusive cloth nodes share one mutable geometry. Interpolation uses
precomputed element offsets, skips static transforms, and coalesces input seeks
to display frames. Progress UI writes are bounded and unchanged text is not
rewritten. Stationary workbenches keep sleeping.

## Validation and measured scope

Evidence is saved outside the deployable site in
`../.codex/performance-optimization-20260919/`.

- Independent package validation checks every triangle and 330,955,755 original
  motion scalar values, exact materials/process tracks, bit-level first-pose
  attachment and carbon exclusivity. All referenced generated assets reproduce
  deterministically with the documented Node/zlib version.
- Runtime checks cover source poses, camera bounds, real builder batching,
  shared cloth buffers, streaming decode, cache eviction, cancellation/retry,
  context loss and reset during deferred loading.
- Room checks cover bounded queues, material/state restoration after failed
  warmup, reflected-transform exclusion, intro takeover and return history.
- Browser acceptance checks all 16 models at forward/reverse/random positions,
  independent camera controls, rapid replacement, bounded cache and inactive
  sleep. Desktop screenshots and 390 px layout checks supplement numeric tests.

Desktop measurements use 1280×720 CSS pixels with device pixel ratio 1.25 on one
machine. The earlier live-room idle sample used 14.56 CPU seconds in 30.98 seconds
(47.0% of a logical core); the optimized settled local sample used 3.90 seconds
in 28.41 seconds (13.7%). Vine playback used 4.47 CPU seconds in 8.26 seconds before,
versus 1.21 in 8.09 seconds after; layout count fell 1321→267. Settled CPU comparisons
are independent of network download duration, but remain single-machine samples.

The corrected room warmup showed a local reveal at 1918 ms, with 249 ms from prepared
to reveal, versus 3925 ms / 2957 ms in the first optimization attempt. The original
online room measured about 5.49 s in one cache-disabled load; that online timing
is not a same-network benchmark against localhost. Publication verification and
controlled network observations are recorded separately in the release evidence.

CPU samples are not GPU FPS, and renderer submission timing is not a full GPU
frame measurement. No universal frame-rate or mobile thermal claim is made.
