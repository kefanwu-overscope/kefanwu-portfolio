# Current room exhibits

`node tools/room-exhibits/export.mjs` reads the content-hashed catalog in
`assets/studio-motion/index.json`, verifies each manifest/geometry/initial-motion
SHA-256, and exports all 16 projects at source sample zero. It never opens the
full animation buffers and never edits their source packages or MAIN images.

The output has Blender Z-up converted once to Three Y-up, with the horizontal
bounding-box center at the origin and the bottom at Y=0. Initial absolute rigid
transforms, deformation, process attributes, visibility and material tracks are
applied before export. The camera-facing labels omitted by the CFD workbench
are likewise omitted; real pressure colors, paths and initial particles remain.
Education retains its separated starting assembly. FTC retains the current
photo-based reconstruction, rather than claiming original CAD provenance.

The simplifier is the repository's vendored meshoptimizer 1.2.0. It retains
source vertex/normal/color/UV/procedural values, permits attribute-aware seam
collapses, locks borders and each part's extrema, and bounds its appearance
error at 0.008. Tiny material regions stay present. This is display geometry,
not engineering tolerancing. Carbon and the perforated sheet seat are not
simplified. Source-space carbon/wood coordinates remain float32; the room uses
the same procedural shader as `studio-inspector-materials.js`.

Only `models/room-current/index.json` and its referenced `.glb.gz` files belong
to the runtime package. The hash in each name is the SHA-256 of the actual gzip
bytes. The room's bounded loader expands gzip before its usual GLTFLoader parse.
The total initial transfer is 6,144,960 bytes for 368,352 triangles (16 projects),
with no animation download. Raw GLBs and visual evidence live outside the site
in `../.codex/room-exhibits-20260925/`.

`experience-exhibits.js` contains the generated URL/bounds/frontYaw catalog and
`prepareRoomExhibit(root,key)`. The latter restores GLB custom attribute names,
source shaders, depth-write rules and unlit CFD handling. Runtime integration
must not apply the legacy material buckets or the old CAD-axis rotations.
`frontYaw` makes the horizontal view agree with the MAIN source camera; a side
cabinet can add its existing -PI/2 facing direction.

After regeneration and validation, run `node tools/room-exhibits/write-cache-headers.mjs`
to add verified immutable cache rules. Legacy asset rules remain available to
already-open clients. Pool and LineFollower use shelf-length placement overrides
in the room; Education is laid flat on the central workbench area.

`report.json` records source hashes, hidden nodes, each primitive's before/after
triangles and simplifier error. `proof.html` compares every MAIN cover with its
static export under the current workbench's lighting and source camera. This
checks visual identity; it does not claim identical lighting between Cycles and
WebGL. Telecaster correctly retains the white painted body/red guard shown by
MAIN and the current workbench; the confirmed walnut substrate in the project
text does not require inventing a visible unpainted finish.
