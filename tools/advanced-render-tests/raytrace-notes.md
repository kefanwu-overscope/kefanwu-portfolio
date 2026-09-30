# Stationary compute ray tracing

`experience-raytrace.wgsl` traverses a triangle BVH in a WebGPU compute shader.
It is portable compute ray tracing, without a hardware RT-core/ray-query claim.
The WebGL material pipeline keeps its baked diffuse, maps and custom shaders.
Root integration owns when to capture, how to apply AO/shadow visibility, and
when camera, geometry, light, viewport or navigation changes invalidate a view.

## Integration

Create `createStationaryRayTracer({deviceProvider, onUpdate, onState})`, call
`initialize()`, then `setGeometry(scene, {exclude, generation})` after loading
and batching. Geometry export includes source triangles outside the view; it
recognizes `object.userData.clusterSourceGeometry` and the corresponding
geometry user-data property before a cluster system reduces visible indices.
Export rejects transparent, transmissive, alpha-tested, alpha-map, wireframe,
skinned, morphing, explicitly dynamic and explicitly excluded surfaces. It
honors ancestor visibility and material groups. Moving printer parts and UI
proxies must be supplied in `exclude`; a changed stationary exhibit needs a new
geometry generation. Do not use a view-dependent visibility mask as source
scene visibility during a geometry snapshot.

`createRaytraceGBufferCapture(renderer).capture({scene,camera,width,height,exclude})`
returns float RGBA world normal / positive view depth, camera matrices and bounded
dimensions. It renders a temporary geometry-only material pass, restores every
material/geometry/visibility/renderer state in `finally`, and uses Three's async
readback. `render()` provides the same target without a CPU readback. The target,
normal-depth texture and depth texture are exposed for other passes. Geometric
normals are used; texture normal maps and displacement are not evaluated.

Call `begin({...capture, generation, lights, samples:32})` once the camera rests,
then at most one `step()` per idle update. `step()` guards overlapping submissions.
`invalidate(reason)` suppresses in-flight result publication immediately. Guard
the asynchronous capture itself against scene/camera generation changes before
calling `begin()`. Do not start a new capture while an old step is busy.

Lights may be a finite rectangle with `position`, `edgeU` and `edgeV` half-edge
vectors, optionally `direction` (outward) and `coneCos`; or
`{type:'directional', direction:[towardLightX,towardLightY,towardLightZ], angularRadius}`.
The latter samples an angular disk and traces to a 100-meter limit. Up to four
lights are sampled by normalized `weight`. A single primary light is appropriate
when replacing its corresponding raster shadow factor.

Each publication contains `data` RGBA: mean finite-radius AO visibility, mean
direct-light visibility, original linear view depth, accumulated sample count.
`normalDepth` preserves the capture guide for depth/normal edge rejection.
AO uses contact-distance falloff within the configured radius. Shadow visibility
uses true geometry visibility; source lighting incidence remains in the PBR
material. Blend AO conservatively into indirect diffuse to avoid applying the
room's baked occlusion twice. Use depth and normals when upsampling.

## Bounds and fallback

- 98,304 capture pixels, 32 default / 64 maximum samples.
- 2,048–32,768 pixels per submission, center-out coverage, adaptive only between
  complete sample sweeps. The default starts at 16,384 pixels.
- Publish after 1, 2, 4, 8, 16, 32 and 64 completed samples, plus the final sample.
- An attention target sorts dispatch strips by ROI coverage and adds at most one
  early first-sweep publication. Its unsampled pixels carry sample count zero and
  fall back to raster; every published pixel uses its actual sample count.
- One async readback staging buffer and no concurrent GPU submissions per tracer.
- 1.2 million source triangles, 96 MiB serialized source geometry ceiling.
- Balanced worker BVH, eight triangles per leaf; depth checked before GPU upload.
- Actual adapter storage-buffer limits checked before upload. No partial room
  geometry is silently accepted when a budget is exceeded.
- No WebGPU/adapter, unavailable float capture, failed shader/worker, budget failure
  and lost device leave the root WebGL path available. The root must respond to
  `fallback` by removing the RT correction.

`gpuRoundTripMs` includes queue completion/readback scheduling and is not a GPU
timestamp measurement. Geometry buffer accounting excludes temporary worker
build allocations and the existing WebGL scene.

## Verification

Run `node tools/advanced-render-tests/raytrace-tests.mjs` for CPU intersection,
complete BVH-bound, source-filter and budget checks.

Serve and open `tools/advanced-render-tests/raytrace-proof.html`; inspect
`window.raytraceProof`. It compiles and dispatches the production WGSL against
526 deterministic sphere/triangle rays and an independent double-precision CPU
reference. Fixtures include parallel rays, back faces, finite distance, a thin
plane and an off-screen triangle. It also builds the real module-worker BVH,
accumulates progressive AO/area shadows, and invalidates during a GPU readback.
It also verifies an attention target publishes its top strip before the bottom
strip, leaves unvisited sample counts at zero, and completes the full sweep.
An unsupported result is a capability result, not a passed GPU proof.

`ray-material-proof.html` independently renders and reads actual WebGL pixels for
ordinary PBR, Cycles RGBM diffuse and source carbon hooks. Neutral RT visibility,
depth rejection and invalidation must match the baseline exactly. Selected
directional/spot shadow visibility and baked indirect AO must affect their
intended terms. `node tools/advanced-render-tests/ray-material-tests.mjs` checks
the source-hook/cache chaining and restore behavior without a browser.

`ray-material-tilt-proof.html` catches projected capture-grid bands: a steep
perspective plane receives uniform AO from a much smaller guide. Float pixel
ratios must remain constant across the plane and the background must not darken.
Upsampling intersects each guide tap's snapshot ray with the fragment's geometric
plane before comparing depth, and normalizes the accepted tap weights. The tap
weight sum never scales AO/shadow strength. This retains depth/normal edge
rejection without introducing grazing-surface confidence stripes.

Primary references checked September 30, 2026:

- [WebGPU specification and device limits](https://gpuweb.github.io/gpuweb/)
- [Three.js WebGLRenderer asynchronous readback](https://threejs.org/docs/pages/WebGLRenderer.html)
- [Chrome's WebGPU overview and browser implementation notes](https://developer.chrome.com/docs/web-platform/webgpu/overview)

Browser support is detected with a real adapter/device request. A browser name
alone does not establish availability on a specific operating system, GPU or
managed browser installation.
