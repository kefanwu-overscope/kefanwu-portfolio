# Engineering stories and adaptive studio rendering · 2026-09-30

This revision starts from `6059b1b`. The room retains its accepted layout, source
project models, Cycles RGBM diffuse maps, probes and real résumé. No model or
lighting-map download was added. New code improves reconstruction, contact
lighting, geometry selection and when work is performed.

## Project narratives

All 16 main-site and studio case studies use the same engineering sequence:
objective, constraints, design choices and tradeoffs, implementation, verification,
and the next iteration. Each includes a brief and a criterion/method/finding table.
There are 58 evidence rows. Targets, calculated values, measured outcomes and
future proposals are identified separately. The 64 chapter bindings, 94 original
gallery images, 35 Javelin BOM rows, downloads and original technical records stay
available. No new physical test result is implied by this editorial revision.

The review and exact source excerpts are in
`../.codex/engineering-copy-20260930/content-review.md` and `source-grounding.json`.
Pending confirmations concern Mk.7 seat fabrication/composite validation, the
reinforced vine vessel and Smelly test outcomes, and Javelin/Pool/FTC test updates.
Until confirmed, those pages use the existing evidence and qualify its limits.

## Rendering implementation

| Request | Implemented behavior | Boundary |
|---|---|---|
| Static ray tracing | WebGPU compute traces actual world triangles through a worker-built BVH. Progressive finite-radius AO and primary-light soft visibility update PBR material terms. | Compute ray traversal, not a hardware RT-core API or full path-traced GI/reflections. |
| Temporal upscale in motion | Halton-jittered HDR reconstruction, camera reprojection, depth rejection, YCoCg neighborhood clipping and current/previous reactive object rectangles. | Custom TAAU, not the AMD FSR distribution; independent motion is reactively rejected rather than assigned skeletal motion vectors. |
| Full quality at rest | Motion uses approximately 80% linear input resolution, further reduced under sustained measured overload. On settling, input returns to native pixels with up to1.2× spatial supersampling and16 temporal samples. | Desktop10MP / narrow-device3MP caps remain; mobile uses8 history samples and raster lighting. |
| Adaptive shadows | Hysteretic1024/2048 directional and512/1024 desk maps; only settled allocations, stable light coverage, cached depth and bounded caster updates. | Adaptive maps, not virtual shadow pages. Off-screen casters are retained. |
| Cluster geometry | Spatial128-triangle leaves, locked-boundary meshoptimizer parent levels, projected-error LOD, current-view frustum culling, WebGPU classification and GPU/CPU agreement checks. | WebGL submits compact indices. There is no WebGPU indirect drawing or depth-pyramid occlusion. Stale GPU visibility is rejected; motion uses a conservative current-frame CPU fallback. |
| Attention | Selected/hovered project gets tighter geometric error, priority model/compile jobs and early RT strips around its screen position. | Every RT pixel still uses its actual unbiased sample count. |
| Cached frame | After refinement converges, canvas pixels are reused for DOM-only changes. Decorative motion pauses while the view is settled. | Camera, lights, geometry, actual3D highlighting and viewport changes invalidate the affected rendering state. |
| Compilation and caching | Async WebGL shader warmup, shared optional GPU device and compute pipeline cache, content-hashed48MiB IndexedDB cluster cache. | Pipeline objects are cached in memory; persistent native shader binaries remain browser/driver-managed. |
| Streaming and scheduling | Three concurrent base transfers, one parse/preparation job, live attention priorities, deferred high-detail upgrades; measured moving/idle budgets and bounded auxiliary starts. | Cooperative scheduling cannot preempt a long synchronous function. Async elapsed time is not labeled GPU time. |

Existing onBeforeCompile/source materials preclude a drop-in migration to
WebGPURenderer. The hybrid retains their verified appearance. The RT bridge
replaces only the chosen light's raster visibility and applies modest AO to
indirect diffuse after baked-light evaluation; it does not darken the complete
finished image. Plane-aware bilateral reconstruction avoids low-resolution
depth bands on sloping surfaces. Unsampled or unrelated surfaces keep raster
lighting. Transparent/transmissive/alpha-tested and explicitly animated surfaces
retain their original path; the auxiliary ray scene does not approximate their
transmission or deformation.

## Budgets and recovery

Default desktop capture is at most65,536 pixels,24 samples, and bounded adaptive
compute tiles. Full geometry has a1.2M-triangle and96MiB snapshot ceiling; an
over-budget scene falls back intact instead of silently omitting architecture.
The measured room snapshot has736,272 triangles and about43.7MB of resident
triangle/BVH buffers. These are component measurements, not total VRAM usage.
Two RGBA16F temporal histories cost16 bytes per output pixel (109.2MB for the
3840×1778 desktop test window). Cluster data adds at most24MiB desktop/8MiB mobile
and borrows original vertex streams. Protected seat/carbon geometry is retained.

No WebGPU, a failed/lost device, denied IndexedDB, failed worker, invalid/stale
result or exceeded budget keeps the raster/current-geometry fallback. A WebGL
context restoration invalidates histories and shadows and resumes only when
the room is visible. Project details and the expanded résumé suspend the room;
returning keeps the original scene and downloads.

## Verification and reproduction

Serve the repository over localhost/HTTPS. Actual GPU proofs are
`tools/advanced-render-tests/{raytrace,ray-material,ray-material-tilt,temporal}-proof.html`
and `tools/cluster-export/proof.html`; each prints its result visibly. The ray
proof compares526 rays with an independent CPU reference. The tilted-plane proof
checks constant AO across68.4° geometry and checks background rejection. The
temporal proof checks actual float pixels, moving foreground/disocclusion,
resize, camera restoration and texture disposal. Cluster proof compares1,024
GPU results and exercises real worker/cache/shadow index swaps and target sizes.

CPU suites live under `tools/room-tests`, `tools/advanced-render-tests` and
`tools/cluster-export`. Browser evidence, desktop/narrow layouts, retained
navigation, performance samples and release integrity records are saved in
`../.codex/engineering-render-20260930/`. Local foreground performance measurements
are machine/window-specific, not guarantees for other hardware. Exact published
commit and byte verification are established by that folder's release records.

Foreground Chrome comparison on the same machine and scripted 8-second orbit,
with a 3840×1778 output buffer: baseline 80.6 rendered frames/s, candidate 118.0.
Median CPU render submission was 4.0→3.9 ms; p95 was 6.3→5.3 ms. Moving input
used 0.8× linear resolution. This is a local measurement, not a hardware promise.
New rendering modules total approximately132KB of uncompressed source; workers
and the existing meshoptimizer module are requested after scene readiness.
After 24 ray samples and 16 temporal samples converged, an 8.0-second DOM-updating
idle test recorded zero additional 3D draws. Real compute-device destruction
removed the RT correction and retained raster/CPU rendering; an actual WebGL
loss/restoration resumed the room with fresh histories and shadows.

## Primary references

- [Three WebGPURenderer material compatibility](https://threejs.org/manual/pages/webgpurenderer)
- [WebGPU specification and limits](https://gpuweb.github.io/gpuweb/)
- [AMD temporal reconstruction inputs and validation principles](https://gpuopen.com/manuals/fidelityfx_sdk2/techniques/super-resolution-temporal/)
- [Nanite SIGGRAPH2021 cluster/hierarchy design](https://advances.realtimerendering.com/s2021/Karis_Nanite_SIGGRAPH_Advances_2021_final.pdf)
- [Three WebGLRenderer async compilation/readback](https://threejs.org/docs/pages/WebGLRenderer.html)
