# White studio material reference review — 2026-10-11

Scope: presentation of the existing sixteen project models on white. Source
geometry, motion, engineering records and scientific figures remain unchanged.
The current motion index and material overrides take precedence over older
rendering audits. Photographs establish visible material families and color,
not calibrated reflectance, measured roughness or manufacturing responsibility.

Reviewed the sixteen manifests referenced by `assets/studio-motion/index.json`,
`studio-photo-materials.js`, `studio-inspector-materials.js`, the September photo
and surface reviews, and the actual gallery references listed below. Paths are
relative to the repository root. CAD/scientific evidence is identified explicitly.

| Project key | Reference photographs or identified source | Appearance to preserve; evidence limits |
| --- | --- | --- |
| steering | `assets/linkedin-u-joint.webp` | Dark carbon wheel face and silver column/joints. Keep existing source-plane weave on broad faces only; hub, bores and cut edges stay plain. Do not invent a separate grip-material region. |
| vineRobot | `assets/vine-body-3partition.webp`, `assets/vine-body-stick.webp`, `assets/vine-robot-built.webp` | Deep-blue prints, cream layered lid, translucent vessel and dark membrane. Reinforced blue outlet and first-build cream outlet are different revisions. Partial membrane transparency is an existing explanatory approximation; photographed fabric is opaque black. |
| javelin | `assets/javelin-3q.webp`, `assets/javelin-nose.webp`, `assets/javelin-motor.webp` | Dark satin printed shell, black props, black/silver motors and silver pitot. Printed carbon-filled polymer does not imply woven laminate over the airframe. Exact hidden-part finishes and per-part polymer assignment remain unresolved; existing propellers are display reconstructions. |
| scanner | `assets/scanner-live-7.webp` | Deep-blue prints, silver guides, black motors, pale plywood and metallic ventilated PSU. Preserve the part-specific metallic correction on `mat_printed_part_4`; other blue brackets remain blue. |
| brakeSim | `assets/brake-dr-20261005/slide32-image1.png` (DR/CAD), `assets/brake-figures-20261005/stress-von-mises.png` (FEA) | Gray ASTM A48 Class 40 cast iron and the existing qualitative warming track. No close physical rotor photo establishes exact finish. Use the current October brake package, not geometry described in September audits. FEA and warming colors are not physical paint. |
| aura | `assets/aura-motor.png`, `assets/aura-swerve-mount.jpeg`, `assets/aura-swerve.jpeg` | Existing gray structure, black tire/cans and silver hardware/end plates. Cut plate photo does not calibrate final paint. Existing motor boundary assignments are approximations. |
| carbonSeat | `assets/carbon-seat-weave-close.webp`, `assets/carbon-seat-trimmed-shell.webp` | Dark carbon/epoxy weave and resin sheen. Warm reflected light is not bronze pigment; temporary white tape is not laminate. Preserve source coordinates, shared cloth/shell material and flush layup. Exact local gloss and weave direction are not calibrated. |
| seat | `assets/fsae-mk7-cockpit.webp`, `assets/fsae-mk7-shop.webp`; `assets/seat-cad.webp` (CAD) | Existing neutral satin sheet-metal finish. Installed seat is largely occluded; photos do not establish alloy or brushing. Generic material name `steel` is a display bucket, while conversion documentation identifies aluminum. Do not transfer FEA or CAD colors. |
| materialTest | `assets/material-instron-frame.webp`, `assets/material-specimen-md.webp`, `assets/material-specimen-td.webp`, `assets/material-specimen-45.webp` | Charcoal coated fabric, off-white single-column Instron, gray base, black bellows and silver grips. `assets/material-specimen-ldpe.webp` depicts a separate clear sample. Keep current reconstruction; legacy `models/real/materialTest.glb` depicts a different two-column MTS machine. The source material named orange is intentionally overridden to charcoal. |
| ansysCfd | `assets/cover-ansys-cfd.webp`, `assets/ansys-cfd-streamlines.webp` (scientific figures); current indexed solved-motion package | Preserve solved-pressure colors, numerical paths, ranges and legend normalization. These are scientific visualization, not physical pigment. New lighting/background is not a new CFD result. Keep gallery figures unchanged. |
| pool | `assets/pool-sniper-build.webp` (physical plate), `assets/pool-sniper.webp` and `assets/pool-sniper-exploded.webp` (CAD) | Existing blue rack/brackets, clear windows, gray housing and metal parts are CAD-supported. Physical plate photo does not verify the entire assembly finish. Cyan CAD selection highlights are not material colors. |
| lineFollower | `assets/line-follower-wiring.webp`, `assets/line-follower-built.webp` | Orange tires, dark chassis, teal Arduino, green driver boards, black components and separate silver hardware. Photos show different battery/chassis revisions; retain supplied pose and material separation. |
| formlabs | `assets/cover-perfume-dispenser.webp`, `assets/formlabs-smelly-actuator.webp` | White structure, clear acrylic base/side sheets, translucent amber compartment, silver shafts and black motors. Preserve transparency; do not make acrylic white plastic to improve visibility. |
| education | `assets/education-kit.webp`; `assets/education-kit-experiment.webp` (exploded CAD) | Navy printed body, dark fretboard and chrome hardware. White guard is CAD-supported, not confirmed installed in the physical photo. Copper cavity shielding/wiring are visible in the photo but absent from source geometry; do not invent them. Fretboard species is unconfirmed. |
| telecaster | `assets/cover-telecaster.webp`, `assets/telecaster-body.webp` | Ivory opaque finish over confirmed walnut, red patterned guard, dark fretboard and chrome hardware. Preserve smooth finish and reduced guard bump; no exposed body wood grain. Warm reflections do not establish gold plating; exact finish chemistry and fingerboard species are unknown. |
| ftc | `assets/cover-ftc-robot.webp`, `assets/ftc-mechanism.webp` | Silver channels/slide, black links/rollers, red panels/tape and blue support. Existing model is a photo-based display reconstruction; unseen details and exact reflectance remain approximate. |

## Rendering checks

Preserve `studio-photo-materials.js` corrections, restored source bump and the
independent carbon/thermal/scientific shaders. The current shared inspector is
the material authority for covers, frames and live models. Older neutral Blender
renderers do not automatically include later photo finishes or the current brake.

The former dark-background Smelly cover made the clear sheets look pale opaque
gray and the amber compartment pale yellow compared with its photograph. Vine's
vessel also looked milkier than its photograph. Their current source materials
already include transmission: Smelly acrylic 1.0, amber 0.38, Vine vessel 0.60.
Check the white background inside the renderer's transmission pass before
changing those material colors. Compositing white outside a transparent WebGL
canvas is not sufficient evidence of equivalent refraction.

White proof review must inspect Smelly/Vine transmission; Telecaster, Smelly and
Instron white-surface edge definition; carbon weave/reflections at start and layup
stages; and CFD wall/streamline/particle visibility with its unchanged scale.
Keep dark materials dark and use existing lighting/shadows for pale-object
separation. Do not recolor scientific plots or claim measured PBR accuracy.

## White proof observations

Inspected the October 11 white exporter proofs in
`../.codex/white-studio-20261011/exports/proof/`: 960-pixel covers for Smelly,
Vine, Telecaster and CFD; 1280-pixel mid-motion frames for Smelly, Vine,
Telecaster, steering, carbon and CFD; and the final carbon frame. Compared those
with the actual reference photographs above. The exporter renders an opaque white
background inside the transmission pass with unchanged lights and environment.

- Existing material families remain consistent with the references. No new
  base-color or part-assignment correction is supported by this comparison.
- Smelly acrylic and amber remain pale, simplified optical approximations;
  the photograph's room reflections are not reproduced by the neutral studio.
  The white proof does not establish a new material regression. Vine retains its
  translucent vessel and explicitly illustrative dark membrane.
- White Smelly structures and the Telecaster rear-body silhouette have light
  contrast but remain traceable at the inspected sizes. Do not darken their
  actual white finishes merely to simulate the photographic surroundings.
- Carbon remains dark with fine surface pattern and resin reflections; no
  metallic or bronze recoloring is introduced. Steering metal and dark plate
  remain distinct.
- CFD cyan paths remain visible on white; pale particles are less prominent
  than on dark. Wall colors remain distinct. This is a presentation limitation,
  not grounds to change the pressure field or color normalization.
- The full export's `materialTest/cover-960.webp`, `detail/72.webp` and
  `detail/144.webp` retain the photographed Instron material families: off-white
  column, dark bellows, gray base, silver grips and charcoal fabric. The specimen
  is visibly dark before and after fracture; both separated halves are visible.
  The machine and sample remain distinguishable on white.

No additional material edits are required by this representative comparison.
This review covers the listed stills, not all animation frames or browser
interaction states. All forty referenced asset/model paths were checked to exist.
