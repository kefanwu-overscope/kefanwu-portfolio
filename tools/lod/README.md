# Local GLB LOD assets

Publication note: generated QA reports/images and the optional `../.codex/perf-polish-20260907/assets-before` baseline are local verification artifacts, not runtime dependencies. Full polish/visual replay requires that baseline; the dated release backup preserves it. A fresh clone can serve the committed manifest and fingerprinted assets without these files. Regenerating the full historical comparison requires restoring the accompanying verification workspace backup first.

Generated 2026-09-07 for the currently loaded portfolio experience. This tool produces assets only. Runtime LOD selection, normalization, near-model loading and frustum handling belong to the experience integration.

## Current local polish and fingerprint contract

The completed conservative pass is documented in **`polish-summary.md`**. All 17 manifest entries now reference **content-fingerprinted `low` and `high` GLBs** (`name.<first 12 SHA256 hex>.glb`). Original URL keys, `version: 1`, `sourceTriangles`, `sourceBytes`, and `sourceBounds` retain their original meaning. `lowTriangles/lowBytes` describe the referenced low; the optional `highTriangles/highBytes` describe the referenced high. No source GLB or old, unversioned low GLB was overwritten or deleted.

- 14 high assets were optimized; 3 high assets (tire and helmets) are byte-identical fingerprint copies after rejecting simplification. Effective high totals: **1,843,389 -> 1,842,781 triangles**, **39,160,992 -> 30,767,308 raw bytes** (21.43% fewer bytes). Most benefit is from compact repacking and uint16 indices, not decimation.
- All 17 old low meshes were retained byte-for-byte. Larger reductions failed geometry/normal QA; passing reductions saved less than 1% of a file. Low totals remain **653,231 triangles / 11,255,960 bytes**. Their new fingerprint copies enable immutable caching without changing their geometry.
- `high` can therefore also be a verified identity copy. Runtime should always request the manifest paths; keep `sourceBounds` as the common normalization reference. No new compression codec or decoder was added. Raw file savings are not measurements of Brotli transfer savings, GPU memory, or frame rate. CDN/cache headers and browser QA belong to the main agent.

The initial 31 low/tool files were copied to `../.codex/perf-polish-20260907/assets-before` (relative to the site root), with matching SHA256 inventory. The copy remains intact.

### Reproduce the conservative pass locally

```powershell
node tools/lod/polish.mjs
& 'C:\Users\oc\.cache\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup --python tools/lod/compare_geometry.py
node tools/lod/select-polish.mjs
& 'C:\Users\oc\.cache\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup --python tools/lod/compare_geometry.py -- --selection
& 'C:\Users\oc\.cache\blender\blender-4.5.9-windows-x64\blender.exe' --background --factory-startup --python tools/lod/render_comparison.py
node tools/lod/accept-polish.mjs
node tools/lod/validate.mjs
```

The first steps stage candidates under `tools/lod/`; only `accept-polish.mjs` installs fingerprint files and atomically updates the manifest after complete geometry and visual evidence. It refuses mismatched SHA256s, incomplete/failed checks, changed originals, or an immutable filename collision. The selector restores failed primitives and retains entire levels without at least 1% raw-byte benefit. LineFollower high explicitly retains original connectivity after a bottom-view shading discrepancy. Original nodes/transforms, materials, UV/normal tuples and exact source world bounds remain protected.

Final simplifier caps are **1e-5 high / 1e-4 low** relative to each primitive, with normal weights **1 / 0.1**, UV/color weight 1, `LockBorder`, extrema/20-degree feature/non-manifold locks, and a 64-triangle small-part floor. Retained recomputed normals are limited to 0.25 degrees high / 0.5 low, with incident-triangle locking retries. These are search constraints; independent QA is authoritative.

`geometry-final.json` covers all 34 before/after level pairs. Per-primitive bidirectional samples include every referenced vertex, every face centroid, and all three edge midpoints; exact unchanged triangles are proven directly to avoid ambiguous nearest hits on overlapping CAD surfaces. Final maximum sampled distance is **1.372843e-5 of the primitive's world extent** against a high cap of **2e-5**; the low cap is **2e-4**. Maximum sampled interpolated-normal difference is **0.335135 degrees** against 0.5 degrees high / 2 degrees low. This is finite sampling, not continuous Hausdorff certification.

`visual-comparison.json` and `visual-comparison/*.png` cover **17 models x 2 levels x 8 views at 768 x 768**. The neutral opaque inspection render interpolates original normals (including split hard edges), or THREE-equivalent indexed Float32 normals where missing; it uses fixed diffuse/specular lights. All 272 comparisons have zero changed silhouette pixels. Maximum common-pixel normal difference is **0.383692 degrees** (cap 1 degree); maximum linear shade difference **0.001506** (cap 0.01); worst per-view shade RMSE **1.218806e-5** (cap 0.002). Screenshots also show a 25x difference panel. Identical-byte pairs reuse a rendered reference, with their identity verified by SHA256. No website texture/PBR/transmission/shadow/transition or arbitrary-view visual guarantee is implied.

Comparison scripts reuse results for unchanged input/output hashes; archive their JSON outputs before changing the QA algorithms. `check-reproducibility.mjs` replays the baseline generator and verifies manifest byte identity, all 34 referenced assets, all 17 originals/old lows, and all 31 backup files. Results are in `reproducibility.json`. `validate.mjs` now checks high/low filename fingerprints as well as all **51** source/high/low GLBs: zero Khronos errors/warnings.

## Baseline low generator

Requires Node.js **22+** with `JSON.rawJSON` support; tested with Node 24.19.0. All conversion/validation dependencies are pinned and included here. No npm install, network access, static-site package manifest, build step or runtime decoder is required.

From `portfolio-site`:

```powershell
node tools/lod/generate.mjs
node tools/lod/validate.mjs
```

Node executable used on this machine:

```text
C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe
```

The baseline generator resolves paths relative to its own file, so any working directory works. It writes fingerprinted low GLBs and the manifest under `models/lod/`, and the generation report under `tools/lod/`. Existing verified high entries are preserved. Old plain-name lows are left intact. Validation writes `tools/lod/gltf-validation.json`. `--only=<substring>` generates a selected fingerprinted GLB without updating the full manifest or reports. Original files are read only. No commit, push or deployment is performed.

## Runtime contract

Use **`models/lod/manifest.json`**, with the stable `version: 1` / `models` map. Each key is the original site-relative GLB path, without query strings. Each entry contains:

```json
{
  "low": "models/lod/real/steering.c4ee760b9776.glb",
  "sourceTriangles": 158758,
  "lowTriangles": 55560,
  "sourceBytes": 2852580,
  "lowBytes": 663456,
  "high": "models/optimized/real/steering.ad3b599bdd8d.glb",
  "highTriangles": 158658,
  "highBytes": 1898812,
  "sourceBounds": {
    "min": [10.153120040893555, 162.484375, 239.34323120117188],
    "max": [467.31494140625, 590.6893920898438, 692.44873046875]
  }
}
```

The example contains measured steering values. `sourceBounds` is the tight AABB of the source default scene's actual POSITION vertices, after every ancestor/node matrix or TRS transform, in the original GLB world coordinate system **before** the website's exhibit placement/normalization. It is not a union of transformed local bounding-box corners. Use this same source reference for both LOD levels. Mesh-local and world extremum vertices are locked; every generated low GLB has identical measured default-scene world bounds (maximum coordinate delta: **0**).

Mesh names, node names (including `mat_steel`, `mat_carbon`, etc.), hierarchy, transform matrices/TRS values, scene references, material definitions, primitive/material assignments, texture/sampler metadata, and embedded images are preserved. There is no recentering, scaling, axis conversion or mesh merging. Original negative zero values in JSON matrices are also retained.

All 13 `models/real/` sources carry POSITION only: no embedded material objects, UVs or normals. Their `mat_*` mesh/node names are the material contract. Run the existing engineering material, normal and carbon UV setup for the low model too. The generator preserves missing streams as missing; it does not invent UVs or bake website-generated materials.

## Baseline low method and reproducibility

- [meshoptimizer 1.2.0](https://github.com/zeux/meshoptimizer/blob/v1.2/js/README.md): `simplifyWithAttributes`, normal weight 0.1 and UV/color weight 0.25, error cap 0.01 relative to each primitive. This metric includes attribute error and is **not** a measured Hausdorff distance, pixel error or visual-quality guarantee.
- Target 35% per primitive; tire body target 32% so its protected detail region can stay substantially intact while the whole model remains below 40%. Individual primitives smaller than 64 triangles stay intact.
- `LockBorder`, local/world extremum vertex locks, default seam/topology restrictions. No `Permissive`, `Prune`, sloppy simplification, position smoothing, vertex updates, quantization or Draco/Meshopt compression.
- `compactMesh` remaps **all** retained attribute streams. Each output vertex's complete attribute tuple is an exact byte-for-byte source tuple. Connectivity and interpolation between retained samples change during decimation.
- The BIN chunk is rebuilt from the compacted, referenced data. No complete high model, unused high-poly vertex stream, spare accessor/view or hidden duplicate mesh is appended. Output indices use uint16 where possible.
- Embedded tire PNG bytes remain unchanged. The generator intentionally retains original UV streams even where the source material currently does not sample them.
- Sources with animation, skinning, morph targets, unsupported geometry extensions, external image URIs or unsupported accessor layouts are rejected instead of silently dropping their data. This is a tool for this checked-in static asset set, not a general glTF optimizer.

Vendored sources, versions, retrieval URLs and SHA-256 values are in `vendor/provenance.json`; licenses accompany each dependency. `meshopt_simplifier.js` is copied verbatim with an `.mjs` filename; glTF Validator's `index.js` is copied verbatim with a `.cjs` filename. This keeps module loading explicit without adding a site `package.json`.

## Results

Seventeen GLBs: 13 active engineering models, chair, tire and two helmets. Excluded: unused `models/real/education.glb` and baked room (7,452 triangles, lightmap UVs). The smallest included model, `driverseat.glb`, still drops from 171,316 to 39,844 bytes, so it has material savings without forcing tiny objects into LOD.

| Set | Source triangles | Low triangles | Source bytes | Low bytes |
| --- | ---: | ---: | ---: | ---: |
| All 17 | 1,843,389 | 653,231 | 39,160,992 | 11,255,960 |
| Chair | 181,494 | 64,898 | 5,629,600 | 1,795,540 |
| Tire | 150,000 | 58,756 | 5,535,744 | 2,214,496 |

Total triangle reduction **64.56%**, raw file reduction **71.26%** (37.35 to 10.73 MiB). Each low asset retains approximately 35–39.2% of its source triangles. These are offline geometry/file statistics, not measured network bytes, GPU memory, frame rate or loading-time improvements.

## Baseline validation and current visual coverage

`validation.json` records source/low hashes, measured stats and world bounds, full preservation checks, primitive reduction/error metrics and per-model risks. `polish-validation.json` adds final high/low hashes, stats, fingerprint paths and rollback decisions. `gltf-validation.json` records independent [Khronos glTF Validator](https://github.com/KhronosGroup/glTF-Validator) 2.0.0-dev.3.10 results for all 51 source/low/high GLBs: **zero errors and zero warnings**.

The chair retains 46 informational unused-UV notices and three pre-existing empty-node notices; the tire retains one informational unused-UV notice. These are the same notices as in the source assets, not retained hidden high geometry. Explicit checks verify every low vertex is index-referenced, every accessor/view is referenced, every mesh belongs to a scene, and the BIN has only referenced payload plus alignment padding. All source file hashes were also compared to the original `.diagnostics/3d-load-20260907/asset-audit.json`: unchanged.

Offline normal/shading/silhouette comparisons were performed in the conservative pass described above. No browser was used. The runtime agent should inspect LOD transitions and scene materials, especially chair mesh/cushions, tire lettering/bead, brake rotor rim/holes, thin scanner trusses, guitar strings/hardware, and the transparent vine-robot shell. Carbon seat retains its original connectivity because of its documented non-manifold center seam. Near views should use `entry.high` (or the original URL if absent); switching distances still need scene-level visual verification.

## Files

- `models/lod/manifest.json` and 17 GLBs mirroring original paths beneath `models/lod/`.
- `tools/lod/generate.mjs`: fixed active-model list, simplification, compact repack, manifest/report generation.
- `tools/lod/glb.mjs`: strict static-GLB read/repack, world transforms, geometry statistics.
- `tools/lod/verify.mjs`: source/low preservation and hidden-data checks.
- `tools/lod/validate.mjs`: repeat preservation/hash/stat checks and independent Khronos validation.
- `tools/lod/validation.json`, `gltf-validation.json`: measured evidence.
- `tools/lod/vendor/`: pinned offline tools, provenance and licenses.
