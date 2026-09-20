# Interactive studio motion export

`export_studio_motion.py` executes the existing, approved Blender staging and
controllers, stopping before image rendering. It never modifies those sources,
the main site's WebP sequences, or `models/real`.

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --threads 6 --python tools/studio-export/export_studio_motion.py
```

Use `-- --projects steering` to rebuild one project. Outputs are under
`assets/studio-motion/<project>/`; provenance and numerical audits are under
`../.codex/studio-v2-20260919/exports/`.

## Optimized display packages · 2026-09-19

The current workbench uses encoding version 2 within `studio-motion-v1`.
`optimize_packages.cjs` repacks the canonical exports from Git commit
`329b8c9e8f5bffe772130a1794fde44fe04f0fe1`; it does not run Blender, decimate,
retessellate, change material definitions, or remove motion samples. The original
export contract and float32 fidelity section below describe those canonical
exports. The display quantization rules in this section describe the new files.

From the repository root, using Node 24.19.0 (the verified reproduction runtime):

```powershell
node tools/studio-export/optimize_packages.cjs
node tools/studio-export/validate_packed_packages.cjs
```

The full run regenerates all 16 packages and `assets/studio-motion/index.json`.
An optional positional project key, for example `vineRobot`, regenerates that
package only and writes `packages-partial.json`; it deliberately does not update
the catalog. Finish with a full run before publishing. Source blobs must remain
available locally in Git. Gzip selection and output are deterministic with the
verified Node/zlib runtime; another zlib version can yield different compressed
hashes despite identical decoded data.

The current runtime resolves the catalog's content-hashed manifests, which point
to content-hashed gzip bodies. Every stable `manifest.json`, `geometry.bin.gz`,
and `motion.bin.gz` remains byte-identical to release `329b8c9`. Older open pages
continue using those stable manifests when switching projects, so their original
decoder never receives the new encoding. The optimizer verifies each legacy
manifest against the pinned source and writes only the new hashed manifest.
Only hashed
URLs qualify for immutable HTTP caching. Do not publish every untracked file in
the asset directories: experiments from earlier packing passes can remain there.
The independent validator writes `package-commit-files.txt` with the exact
referenced files, and lists unreferenced generated files without deleting them.

### Codec and fidelity

- Vertices are merged only when every retained source attribute is bit-identical
  and every deformation/process track uses the same complete source trajectory.
  All triangle corners retain their original order, groups, and material slots.
  `sourceCoordinates` is omitted only for materials whose shaders do not use it;
  carbon and procedural noise coordinates remain exact float32.
- Static positions and deformation positions use affine uint16 per component,
  except every carbon surface position remains source float32. Normals use the
  same quantizer. UVs, colors, process attributes, rigid transforms, material
  tracks, visibility, camera metadata and sampling times remain exact.
  For range `[min, max]`, `scale = (max - min) / 65535`,
  `q = round((source - min) / scale)`, and
  `decoded = float32(min + q * scale)`. A constant component has scale zero.
- Index, frame-map, and element-map integers use the smallest fitting unsigned
  8/16/32-bit type. Array offsets remain four-byte aligned. Optional
  `predictor: "delta-component"` stores each integer minus the previous integer
  of the same vector component, wrapping at the component width. Optional
  `byteOrder: "planar"` stores all low bytes, then second bytes, and so on.
  Undo byte planes first, cumulative component deltas second, affine decode
  last. These preprocessing steps are lossless. The encoder picks the smallest
  gzip candidate per integer array and compresses the complete body at level 9.
- `buffers.initialMotion` contains only source sample zero, described by each
  node/material's `initialTracks`. It decodes bit-for-bit identically to full
  motion sample zero, including signed zero. The initial tracks use the full
  track's affine scale/offset, avoiding a jump when the motion buffer attaches.
- Ten carbon cloth nodes share identical geometry descriptors and the
  `exclusiveDeformationGroup: "carbon-cloth"` marker. At most one cloth is
  visible at each of the 121 source samples. Visibility selects the same nearest
  global sample for all nodes, preserving exclusivity between samples as well.
  The shell and all animated cloth positions remain exact; completed cloth
  does not accumulate thickness.

Across the 16 packages, the maximum measured scalar position errors are
`0.00003802776336669922` for static geometry and `0.000028848648071289062`
for deformation tracks, in their original scene/local coordinate units.
Maximum normal component error is `0.000015259022696056945` before runtime
normalization. Each component also satisfies the independently checked bound
`scale * 0.500001 + abs(source) * 1.2e-7 + 1e-12`, which includes float32
rounding. These are bounded display errors, not manufacturing tolerances or
claims of pixel-identical rendering. Carbon positions/coordinates, retained
UVs/colors, rigid/material/process tracks have zero error.

All gzip bodies, including both the initial and full motion streams, total
38,751,697 bytes versus 97,677,128 originally (60.33% smaller). Vine's first pose
requires 891,876 binary bytes instead of its original 21,454,370-byte complete
package; the folding seat requires 105,500 instead of 13,746,991. These figures
exclude manifests, scripts, images, and protocol overhead and are not measured
page-load timings. Full sample counts, source CAD, old WebP sequences and CFD
solution data are unchanged.

Evidence is written to `../.codex/performance-optimization-20260919/`:
`package-*.json` and `packages-summary.json` report the encoder's correspondence
checks; `packages-independent-validation.json` decodes emitted disk files using
a separate little-endian implementation, compares every source triangle and
vertex/sample, checks exact materials and initial/full-zero bytes, verifies all
16 legacy manifests and 32 legacy binary files, and records the referenced asset hashes. Browser visual
and lifecycle checks remain separate from these numerical checks.
`packages-reproduction.json` records the verified Node/zlib versions and the
all-16 replay: all 65 current catalog/hashed asset files were reproduced
byte-for-byte. The 16 stable manifests are checked separately against the
original release.

## Wire contract: studio-motion-v1

- `manifest.json` describes a model. `geometry.bin.gz` and `motion.bin.gz` are
  ordinary gzip buffers, decoded with `DecompressionStream('gzip')`.
- All coordinates are Blender Z-up. A single parent rotation of `-PI/2` about
  X converts them to Three Y-up. Object transforms are absolute world TRS;
  quaternion order is `xyzw`. Cameras and both bounds are in source coordinates.
- A descriptor has `byteOffset`, `count`, `itemSize`, and `componentType`.
  `count` means vector count, so scalar length is `count * itemSize`.
  Offsets are four-byte aligned. Components are little-endian float32 or uint32.
- Geometry contains indexed position/normal, source material groups, optional
  UV, RGBA vertex color, source coordinates, and process attributes. Material
  values and scientific vertex colors are linear RGB.
- Each track is absolute. Uniform sample times are `i / (sampleCount - 1)`.
  `valuesPerFrame` is a scalar count. `frameMap`, when present, maps a global
  sample to a unique row. `elementMap`, when present, maps each output geometry
  vertex to an element of that row. These maps use the motion buffer.
- Transform interpolation is linear position/scale and quaternion slerp.
  Deformation positions/normals and process attributes interpolate linearly;
  normals are normalized afterwards. Visibility selects the nearest sample.
  Apply progress from the saved base state; never accumulate transformations.
- `geometry.sourceCoordinates` stays fixed as cloth deforms. Carbon uses the
  original checker scale, colors, and source coordinates. For a procedural
  material with `coordinates: 'objectCoordinates'`, preserve a copy of initial
  local position as the immutable coordinate attribute. The material carries
  source rotation, axis scaling, noise settings and color-ramp metadata.
- Carbon's `attributeOpacity` and `attributeRoughness` are separate scalar
  attributes, not geometry displacement or extra laminate thickness. Its
  completed and future cloth surfaces remain hidden. Ten stages remain an
  illustration, not the actual ply count.
- Brake materials carry heat-exposure point weights and sampled warming and
  incandescence uniforms. This visual process is not a temperature simulation.
- CFD colors and particle paths come from the hash-verified existing Fluent
  export. Pressure meshes and legend are unlit vertex colors.

## Fidelity and validation

Static geometry and every stored pose/deformation sample retain float32 source
values. Identical complete vertex trajectories and repeated frames are reused
losslessly. Vine uses 49 stored samples after checking every interval midpoint;
the seat retains 121 because reducing it to 61 increased bending error.
All other sample counts follow the source sequence lengths.

Audits compare packed-track reconstruction with all source sample rows, revisit
shuffled source poses, hash source inputs/scripts, preserve the source controller
report, and record midpoint interpolation error for vine and sheet-metal seat.
Interpolation is a display approximation between stored exact samples; eight
seconds is a UI playback duration, not an engineering process time.

The browser's PBR/noise renderer is not Cycles. The export preserves source
shader parameters and mapping; visual verification in the browser is required.
Photo-based FTC/material-test geometry retains its documented reconstruction
status. The room-only FTC `room.glb` merges its initial source meshes and applies
a 0.28 decimation ratio; the inspector remains full-detail.

Run `validate_exports.py` with Python and NumPy for independent wire-format,
source-file, range, finiteness, frame mapping and reset validation.
