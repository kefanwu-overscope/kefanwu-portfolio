# Game-style studio performance · 2026-10-09

This revision builds on `997c31f` in the existing room. It changes loading and
render budgets, not source geometry, materials, project copy, covers or motion
packages. Browser rAF remains the presentation/vsync source; there is no separate
timer-driven renderer or claim of controlling the monitor's hardware vsync.

## Initial room and later detail

All sixteen source-derived exhibits, the room, initial 2K lighting, résumé and
controls remain in the first-frame gate. The tire, two helmets and office chair
start only after the actual first room frame is painted. They retain their
existing low/high source models and the three-transfer/one-preparation queues.
The complete room's download size is essentially unchanged; this moves optional
detail out of the first-visible path. A visitor may see these four props arrive
after the room opens.

Current hashed exhibit/room URLs now bypass the unrelated legacy LOD manifest.
Legacy decoration still uses that manifest and its original-model fallbacks.
Deferred records do not re-open initial LoadingManager progress. `record.done`
and `whenAllReady()` settle on ready, failed or cancelled; disposal prevents late
mounting. `readiness.detailsSettled/detailFailures/timings.details` separately
describe optional base completion. All project options are available at reveal.

Late geometry invalidates shadows, temporal history and ray geometry. Cluster/
BVH refinement waits for base streaming to settle rather than repeatedly building
incomplete scenes. Optional shader prewarm never gates model attachment: an
overloaded or lost GPU cannot strand the loader queue. Idle auxiliary work uses
the actual idle cadence budget, not the faster moving-frame budget.

## Frame cadence, resolution and geometry

- Raw, ungated visible rAF intervals feed a bounded refresh estimator; they are
  never treated as GPU execution time. A moving workload cannot relabel its
  dropped callbacks as a lower known monitor refresh rate.
- Motion follows native refresh up to a 240 FPS policy cap. Above that cap,
  whole display divisors keep uniform cadence. This is a target, not guaranteed
  achieved FPS. Idle instruments retain their 30/10 Hz clocks; reduced motion
  retains the existing pause behavior and 1 Hz eligibility checks.
- Measured CPU submission / asynchronous GPU samples first lower resolution
  through 1/.96/.92/.88/.80/.70. The existing temporal renderer applies its .8
  moving factor, so actual input can reach .56 of native width and height.
  Native output dimensions remain unchanged. Stationary quality restores the
  existing native/supersampled path.
- Only sustained overload at the applied minimum scale lowers moving cadence
  through refresh divisors, e.g.165→82.5→55 FPS. Recovery requires sustained
  headroom against the next faster budget. Cooldowns prevent rapid oscillation.
- `isMoving` is independent of numerical FPS: moving30 and idle30 must not be
  confused. GPU queries reset on motion/resolution/viewport transitions.
- Existing cluster LOD uses a wider moving pixel-error allowance under resolution
  pressure (1.4→2.0), returns to .65 at rest, and retains attention priority,
  protected source geometry and conservative culling. No CAD was resimplified.

## Measurements and validation

Evidence is outside the public site at `../.codex/game-performance-20261009/`.
The local comparison serves baseline Git blobs and current files from the same
gzip-enabled server, with HTTP cache disabled, 10Mbps download / 40ms configured
latency, 1280×720 CSS viewport and DPR1.25. OS/GPU caches remain warm. The first
baseline run warmed the server's Git/blob compression cache and is excluded.

| Accepted single-run sample | Baseline | Candidate |
|---|---:|---:|
| First room reveal from navigation | 14.585s | 11.602s |
| Subresource transfer before reveal | 16.802MB | 13.134MB |
| All base detail settled | Same initial gate | 14.675s |

The room is visible about20% sooner with about22% fewer bytes before reveal in
this controlled sample. These are not claims for every network/device, and the
full room has not become22% smaller. Three candidate samples were consistent
near11.60s; raw samples are retained, including the excluded baseline warm-up.

A12-second orbit under4× CPU emulation reached the .70 logical/.56 actual input
floor and shifted target165→82.5→55 FPS. This demonstrates feedback behavior;
the achieved render count is separately recorded and is not the target FPS.
Stopping restored logical1/native-quality output. Actual project return retained
the same scene/document and requested zero additional room models.

Targeted tests cover refresh inference/divisors, overload/recovery, bounded GPU
queries, asynchronous/cancelled staged loading, actual renderer orchestration,
mobile depth lifecycle, room suspension, retained navigation and instrument
motion. Final browser, release, backup and online verification records in the
evidence folder establish the shipped state.

Primary references: [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)
and [Three.js asynchronous compilation](https://threejs.org/docs/pages/WebGLRenderer.html).
