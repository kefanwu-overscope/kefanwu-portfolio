# Refined source surfaces — 2026-09-30

Production changes are confined to `studio-inspector-materials.js` and
`studio-photo-materials.js`. Photographs and original source geometry, colors,
animation tracks, camera and model placement remain unchanged.

## Source bump restoration

The previous noise shader only evaluated a material when it had a color ramp.
Eight exported plastic/fabric materials have `ramp: null`, so their exported
`bumpStrength` and `bumpDistance` previously had no visible effect. These values
now drive a surface-gradient normal perturbation. The five source wood/guard
ramps keep their original linear endpoint colors, coordinate mapping and scale.

Each source octave uses its exported detail, gain and lacunarity and fades when
its cells become smaller than a pixel. Height gradients are evaluated after
filtering. The slope cap is 0.14 (about eight degrees); the normal is a lighting
normal only and never changes the silhouette or stored source normal. Object
scale is applied to the bump height so shrinking an exhibit does not enlarge
its finish. Roughness varies by at most ±0.02 around its existing value.

The browser's existing value-noise approximation is retained; this is not a
claim of bit-identical Cycles Noise Texture output or measured surface finish.

## Photo-supported finishes

Reviewed `scanner-live-7.webp`, `cover-telecaster.webp`, `javelin-nose.webp`,
`education-kit.webp` and `linkedin-u-joint.webp`, together with the earlier
[photo material review](photo-material-review.md).

- Vine/scanner blue prints and Vine cream structure receive subdued neutral
  micro-normal/roughness detail. Their confirmed base colors stay unchanged.
- Satin steel in Vine, scanner, steering and Smelly receives a finer, shallower
  finish. No scratches, dents, new hardware or directional machining claims are
  introduced.
- Telecaster ivory paint retains its gloss and gets only minute micro-detail.
  The red guard keeps its existing pattern and colors; its source bump is
  reduced to one fifth beneath the smooth clear finish visible in the photo.
- Smelly amber resin receives a small clearcoat response. Transmission,
  opacity and amber color stay unchanged.
- Source bump restoration covers Javelin, tensile fabric, pool, line follower,
  Smelly white prints, Education navy prints, and both guitars' source wood.

All added neutral microfinishes use ordinary local `position`, so old room GLBs
need no new attributes for those materials. Their isotropic statistical grain
has the same density after the room exporter rotates/centers a model, although
the individual noise realization can differ. Finishes are idempotent when the
exporter and the live loader both apply them.

## Steering wheel face weave

The actual photograph shows fine diagonal carbon weave on the broad wheel
plate. The corresponding source carbon material is assigned only to
`mat_printed_part_10`. Inspection of its decoded immutable coordinates finds
1,567 broad-face vertices near source planes 1.680 and 1.722, 288 hub vertices on
an intermediate plane, and 1,667 edge vertices. The shader uses those planes and
the geometric source normal to keep the hub, bores and cut edges plain. It does
not invent a separate hand-grip region unsupported by the material slots.

The new `steering-weave` procedural tag uses `coordinateSpace: object`, which
the inspector already preserves as `objectCoordinates`. Its two-over-two
pattern uses source scale 120, a mean-preserving multiplier on the existing
dark color, small roughness variation, and a maximum normal slope of 0.035.
Pixel-footprint filtering makes unresolved weave converge toward the original
plain finish instead of broad noisy bands.

The steering room exhibit must be exported once with this photo finish applied
before geometry conversion, so the existing exporter preserves the original
`objectCoordinates` before Y-up rotation and floor centering. Do not use the old
steering GLB's transformed `position` as a substitute for the wheel mask.

## Cost, exclusions and verification

No bitmap texture, Blender output, geometry download or postprocess is added by
these two modules. A generic Blender microtexture was considered and rejected:
flattening the existing coherent 3D source noise into a 2D map would add UV or
projection requirements without recovering more source evidence. Existing
source parameters can be shaded directly with a small local normal operation.

The carbon-seat shader and its source weave/alpha/roughness attributes remain
independent and unchanged. Thermal tracks and solved-pressure colors receive
none of the new finishes. The `studio-source-v1` cache-key prefix remains the
room ray bridge's vertex-preservation contract; a fragment revision in the key
invalidates old programs without disabling ray shadow/AO compatibility.

Automated checks: `node --test tools/room-tests/refined-materials.test.mjs
tools/room-tests/photo-annotations.test.mjs` (18 passed), plus
`node tools/advanced-render-tests/ray-material-tests.mjs` (passed). These verify
source immutability, restored bump-only materials, filtering/source mapping,
room attribute requirements, decoded wheel mask, scientific/carbon exclusions,
idempotent finishes and ray-hook composition. Root-session GPU review and
regenerated static frames/covers are separate integration checks.
