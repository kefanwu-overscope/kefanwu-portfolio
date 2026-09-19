# Interactive studio acceptance

Open `/tools/studio-tests/index.html?run=1` on the local preview server. This page imports
the production workbench module and shows results in `#report`, with overall
state in `#result[data-state]`. It does not run from the portfolio or attach a
debug controller to `window`.

The browser suite loads all 16 real geometry/motion packages, seeks forward,
backward and in arbitrary order, checks that camera and mechanism controls are
independent, exercises rapid project replacement and playback in both
directions, checks the two-entry resource bound, and verifies that inactive
rendering sleeps. Its controls also allow manual portrait layout and WebGL
context restoration checks. Visual appearance, source framing and material
quality still require screenshots; passing the automated checks does not
establish those properties or a frame-rate target.

The independent Node suite at
`../../../.codex/studio-runtime-20260919/test-runtime.mjs` verifies every
project's visible poses against the source binary endpoints and across reverse
and repeated random seeks, plus disposal, load races, bounded caching,
decompression and HTTP failure behavior. It also projects each complete motion
envelope through the source-oriented camera at portrait and landscape aspect
ratios to guard against clipped exploded components. It writes `runtime-results.json` next
to that test script.

## Host contract

`createStudioInspector({ canvas, onStatus, onProgress, onPlaybackChange,
onPartSelect, manifestUrl, quality })` creates the lazy workbench renderer.

- `selectProject(key, { signal })` returns the selected key, manifest and
  progress; an aborted or failed selection resolves to `null`. Failure details
  arrive through `onStatus`.
- `setProgress(p)`, `play({ direction: 1 | -1 })`, `pause()` and
  `reset({ camera: true })` control absolute source poses.
- `setView('source' | 'front' | 'side' | 'top' | 'iso')` changes only the camera.
- `setActive(false)` pauses playback and drawing, retaining state and the
  bounded resource cache. The host must suspend its room renderer while the
  workbench is active.
- `setQuality('auto' | 'low' | 'high')`, `resize()`, `getState()` and `dispose()`
  manage presentation and lifecycle. `getState()` provides current camera,
  frame counters and managed cache statistics for the host and these tests.
  CPU render timings reset when a selected project becomes ready; they are not
  GPU frame times. `sourceShaders` reports which source-material hooks compiled.

`onStatus` receives `{ state, key, message }`, with `manifest` and load duration
on `ready`. Status values include `loading`, `ready`, `error`, `context-lost`
and `idle`. `onProgress` receives a number. `onPlaybackChange` receives
`{ playing, direction }`. A click on a source component calls `onPartSelect`
with `{ key, name, group }`; the host translates source groups to visitor-facing
labels. No numerical CFD probe is inferred from the exported surface colors.

The resource cache keeps at most two projects, with a 100 MiB mobile / 192 MiB
desktop managed-array budget. One larger current project is allowed while all
other resources are evicted. These figures include source/motion buffers,
mutable attribute copies and estimated GPU attribute storage; they do not
represent total browser memory. Requests and gzip decoding are cancelled when
superseded. GPU resources are disposed on eviction and teardown.

Source linear colors, rigid poses, deformations, visibility, carbon source
coordinates and heat tracks are preserved. WebGL's PBR lighting and procedural
noise are an interactive rendering of the source material, not a claim of
pixel identity with Cycles. Carbon uses the exported checker scale/colors and
per-vertex cloth opacity/roughness. CFD remains unlit with the exported surface
colors. The checker uses analytic pixel-footprint filtering and the source bump
strength/distance without changing its spatial scale. Its original 3D label/scale/tick meshes are hidden in favor of the host's
fixed readable source legend.
