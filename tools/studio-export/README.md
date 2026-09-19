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
