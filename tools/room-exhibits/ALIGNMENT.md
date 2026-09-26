# Room exhibit alignment audit

Authority: the current MAIN covers and `studio-packed-20260919` workbench
packages, each at animation sample zero. The room keeps its own physical scale,
placement and lighting. Export source hashes are in `report.json`.

| Project | Previous room presentation | Current room asset |
| --- | --- | --- |
| Steering | Legacy CAD with shared room material buckets | Current neutral steering assembly and per-part source materials |
| Vine robot | Legacy vessel with room-specific milky-wall overrides | Current transmissive HDPE vessel, source outlet and initial polymer film |
| Javelin | Legacy airframe and global dark bucket overrides | Current airframe, motor/propeller details and source material assignments |
| Scanner | Legacy bucket grouping with room-specific blue/wood overrides | Current blue mounts, pale plywood base, truss and source steel parts |
| Brake | Legacy rotor under a room steel override | Current cold sample-zero rotor/material, with the source holes preserved |
| AURA | Legacy assembly with CAD-axis correction and gray bucket override | Current assembled source pose, drive geometry and per-part materials |
| Carbon seat | Legacy seat plus room box-projected weave | Current fixed shell with exact float32 source weave coordinates; future cloth hidden |
| Driver seat | Original CAD with several legacy axis rotations | Current folded initial pose, source perforations and metallic material |
| Material testing | Older tensile-machine CAD and broad color buckets | Current machine, silver grips, orange specimen, bellows and controls |
| CFD | Procedural monitor showing a picture | Actual current pressure display mesh and solver paths, source initial pose |
| Pool Sniper | Legacy CAD with room bucket color changes | Current extended cue, frame, rack, glass and source material assignments |
| Line follower | Legacy CAD and generalized room buckets | Current orange wheels, circuit boards, hardware and source chassis |
| Smelly | Legacy CAD with broad white/steel overrides | Current white frame, clear acrylic, amber reservoir and steel mechanisms |
| Telecaster | Legacy room material buckets | Current white painted finish, red guard, chrome and neck/fretboard source grain |
| Education | No room exhibit | Current separated guitar kit at the MAIN cover's initial assembly pose |
| FTC | Different procedural room robot | Current photo-based robot reconstruction with red panels, lift and mecanum wheels |

Material definitions and procedural coordinates come from the source packages.
The painted Telecaster appearance is consistent with MAIN; its walnut substrate
is a project fact, not an instruction to replace the visible white finish.
The CFD display uses simplified geometry with retained source vertex colors;
it does not change or replace the saved Fluent solution. Source camera text and
one zero-scale particle are absent just as they are visually absent from the
current orbitable workbench at progress zero.

Validation: `node tools/room-exhibits/validate.mjs` passes all 16 assets. Visual
MAIN/room proof was reviewed from
`../.codex/room-detail-20260926/source-alignment.png`; all 16 rendered without
browser errors and all procedural material programs compiled. Differences in
Cycles versus WebGL lighting and the existing workbench's noise approximation
remain visible, particularly in the guitar wood. Geometry identity and source
material assignments agree.
