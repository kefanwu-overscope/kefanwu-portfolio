# Spatial cluster LOD and GPU classification

`experience-clusters.js` is an optional geometry layer over the existing Three
r185 WebGL renderer. It builds actual spatial triangle clusters from source
geometry, then chooses a nonoverlapping cut through their binary hierarchy.
This is a bounded cluster LOD implementation inspired by Nanite's published
design. It is not Epic's Nanite, a mesh-shader renderer, or a virtual geometry
page streamer.

## Runtime contract

```js
const clusters = createClusterRenderer({ getDevice: getGpuDevice });
void clusters.registerRoot(scene, { exclude: animatedObjects });
// Register newly mounted source roots separately; duplicate meshes are ignored.
void clusters.registerRoot(exhibit, { key: projectKey, priority: 0 });
clusters.update(camera, { viewportHeight: drawingBufferHeight,
  attentionKey: focusedProject, pixelError: 1, gaze: { x: 0, y: 0 } });
```

`getStats()` distinguishes CPU current-frame selection from accepted WebGPU
classification and exposes real dispatch/readback counters. `dispose()` stops
the worker and restores source geometry. `getSourceGeometry(mesh)` (also
`mesh.userData.clusterSourceGeometry`) gives ray tracing/export the immutable
full triangle source. Raycasting and shadow draws use that full source.

The current contract accepts opaque, single-material, nondeforming meshes of at
least 384 triangles. Callers explicitly exclude moving procedural parts with
changing vertex streams. Rigid parent transforms are tracked every update.
Skinned/morph meshes, alpha-test/transmission/transparent surfaces, displacement,
custom ShaderMaterials, and meshes with custom render callbacks stay original.
Known carbon and sheet-seat project keys never simplify. Carbon source material
also retains its existing transparent rendering path.

## Data and selection

- A module worker partitions source triangle centroids into spatial leaves of at
  most 128 triangles. Each source triangle belongs to exactly one leaf, retaining
  winding. Coarse parent groups use meshoptimizer 1.2.0, `LockBorder` and
  `ErrorAbsolute`. Group boundaries and source vertex positions are fixed;
  normal/UV/color error participates in simplification. Retained indices still
  refer to the original complete vertex streams, including custom attributes.
- The GPU computes sphere/frustum classification and projected geometric error
  per hierarchy node. Screen location, focused project and a 12% retention band
  influence the error threshold. Original leaves remain available at every cut.
- WebGPU output is asynchronously mapped. It is accepted only for the same
  camera/viewport/error budget and transform generation. While the camera or
  objects move, the CPU classifies the current frame, avoiding stale visibility
  holes. Both paths keep a 1.5-pixel frustum guard for the temporal renderer's
  later camera jitter. Device loss and API failure retain that CPU path.
- Selected cluster indices are concatenated into one reusable index buffer per
  original material mesh. Draw counts therefore do not multiply by cluster
  count. Shadow callbacks swap in all original indices and restore the main
  selection afterward. Vertex attributes, materials and Mesh identity remain.
- Source copying/builds are serialized and yielded; originals remain displayed
  until construction finishes. Additional resident cluster/index data has a
  24 MiB default managed-data budget (including a conservative metadata allowance)
  and each source is limited to 180,000 triangles. These
  limits are not total process/GPU memory claims. The source vertex buffers and
  original assets remain resident for fidelity, shadows and fallback.
- The worker's SHA-256 key includes schema, build options, source indices and
  every attribute stream. IndexedDB retains up to 48 MiB of accounted data/160 hierarchies with
  least-recently-used eviction. Storage denial simply rebuilds in the worker.
  The schema is `room-clusters-v1`; change it when the construction algorithm or
  stored representation changes. No additional model payload is downloaded.

Unknown custom vertex hooks stay original. A verified hook that preserves source
vertex positions can explicitly set
`material.userData.clusterVertexPositionsPreserved = true`; the current ray
lighting hook may use this marker. Detached model roots release cluster data
automatically; `unregisterRoot(root)` permits explicit removal.

WebGL cannot draw indirectly from a WebGPU buffer. This implementation has
asynchronous GPU classification plus CPU hierarchy traversal/index compaction
and normal WebGL submissions. It does not claim GPU indirect drawing,
depth-pyramid occlusion, per-cluster network streaming, or full VRAM residency
management. Model/texture streaming is handled by the room's separate loader.

## Verification

Run `node tools/cluster-export/verify.mjs`. It checks all 16 current model hashes,
exact triangle/winding coverage of eligible source primitives, arbitrary mixed
LOD cut coverage, fixed group boundaries, protected geometry, projected-error
attention, material/custom-attribute preservation, source shadow indices, rigid
transform invalidation and teardown. `--fixtures-only` runs the small regression
fixture set; `--output=path.json` saves a machine-readable report.

Open `tools/cluster-export/proof.html` in a WebGPU-capable secure browser. The
page compares 1,024 actual GPU results against CPU classification and exercises
the real module worker, IndexedDB reuse, Three WebGL shadow/index swaps, camera
draw reduction, GPU result consumption and stale-transform fallback. Read
`window.__clusterProof`; only `status: passed` establishes that browser proof.

## Adaptive raster shadows

`experience-shadow-budget.js` owns a separate, conservative shadow policy. It
keeps the original light position/target and complete source shadow frustum,
including off-screen casters. This is adaptive raster shadow mapping, without
virtual pages or camera-tight cropping. Desktop directional maps settle between
1024 and 2048; the desk spotlight settles between 512 and 1024. Low-tier existing
spotlight disablement is respected, and hardware texture limits cap sizes.

Call `createAdaptiveShadows({ renderer, key, resumeSpot, lowTier })`, then
`update({ camera, moving, attentionKey, attentionPosition, geometryDirty,
movingCasters, movingPaper, now })` once before rendering. Camera-only motion
reuses existing depth. Resolution changes wait for 800 ms of camera stability,
a 750 ms upgrade or 2200 ms downgrade candidate, and 4000 ms between map changes.
Candidate distance thresholds also have hysteresis. Changing maps disposes the
old targets and scales PCF radius to retain approximate world-space softness.

Geometry and light-pose changes invalidate depth immediately. Routine UI and
light-intensity changes do not. Dynamic directional casters refresh at 12 Hz in
overview and 24 Hz under close attention; moving paper's desk shadow refreshes
at up to 30 Hz. A final settled caster pose refreshes immediately. An inactive
light retains pending geometry invalidation until it becomes visible again.
Pass actual geometry changes, not a generic UI/render `forced` flag.

`node tools/cluster-export/verify-shadows.mjs` covers the policy and lifecycle.
The browser proof additionally verifies real target resizing, cached camera
motion, and unchanged full light-frustum bounds.

## Primary references

- [Karis, Stubbe and Wihlidal, Nanite deep dive (SIGGRAPH 2021)](https://advances.realtimerendering.com/s2021/index.html):
  published cluster hierarchy, streaming, culling and rasterization design.
- [meshoptimizer source and documentation](https://github.com/zeux/meshoptimizer):
  simplification error, attribute constraints and boundary locking. The existing
  vendored 1.2.0 module/provenance/license live in `tools/lod/vendor/`.
- [WebGPU specification](https://www.w3.org/TR/webgpu/): compute, storage buffers
  and asynchronous buffer mapping. GPU buffers belong to their WebGPU device;
  the current WebGL material renderer is a separate API.
- [Three r185 WebGLBindingStates source](https://github.com/mrdoob/three.js/blob/r185/src/renderers/webgl/WebGLBindingStates.js):
  `setup()` uploads the currently selected index before drawing, including the
  index changed in `onBeforeShadow`.
