# Robotics / guitar cover material audit — 2026-09-13

Scope: six project sources and their physical/CAD reference images. All six
`catalog-drafts/*-wide-angle0.png` images were opened with `view_image`. No browser
or GPU render was used. `models/real`, website code and `catalog.json` are unchanged
by this task. The main agent owns the next renders and their visual approval.

Use `material-audit-robotics.json` → `projects[key].catalogPatch` to update a
catalogue entry. For compatibility, palettes are also in
`generatedSources[key].materials`. New sources are under `sources/`; they contain
embedded PBR materials and nodes named `mat_<bucket>`. `preserveMaterials=true`
works, but does not supply procedural wood grain or red pearloid flakes. These
larger, full-detail GLBs are offline rendering inputs, not website downloads.

| Project | Evidence / decision |
| --- | --- |
| AURA | Gray **painted A36 steel**, black tire/cans and silver hardware. Existing draft broadly acceptable. New source separates two gray motor mounts and silver motor-end regions without replacing the trimmed single-module geometry. Motor casting boundaries remain approximate. |
| LineFollower | Orange tires, dark printed chassis, teal Arduino FR4, green driver boards, black components and silver USB. New source fixes the all-teal board and separates dielectric battery wrapping from metal motor cans. Photos show multiple battery/chassis revisions; the supplied CAD pose is preserved. |
| Pool | **No base-color correction needed from available evidence.** Blue rack/brackets, clear windows, gray housing and silver cue match the original CAD. The one fabrication photo proves a bare metal plate, not every finished-machine material. `pool-sniper-release.webp` contains a cyan **selection highlight**, which is not a material color. Keep the existing source and label colors as CAD interpretation. |
| Formlabs | White printed structure is correct, but the base and tall side sheets are visibly transparent in real photographs. The compartment box is amber/translucent. New source fixes these large areas and retains supplied gantry geometry. |
| Education | Physical kit supports a dark blue **printed body**, dark brown fingerboard and chrome hardware. The misleading `Finger_Board` file is a thin **pickguard**, white in the exploded CAD. A neck pickup also accidentally hit the old `neck → wood` regex. Both errors are corrected; the white guard lacks separate physical-photo confirmation. |
| Telecaster | Finished guitar is white/ivory paint over walnut/maple, red pearloid guard, dark fingerboard, metal controls/neck pickup and black bridge pickup. Raw-wood and glue-up photos were inspected: visible walnut grain belongs to fabrication, not the finished white exterior. New source separates those regions plus the actual individual fret components. |

Colors and optical values are plausible render inputs, not calibrated material
measurements. Do not darken correct base colors to compensate for softbox
highlights; adjust specular response/roughness as appropriate. No carbon-fiber
finish is supported for these six projects. Wood grain must follow the neck's
long axis after normalization; the current renderer's fixed X grain direction
should not be copied blindly.

`robotics_sources.py` uses numpy only and makes no pose edits or simplifications.
Binary GLB readback verifies every included input face and exact source bounds.
The script omits common threaded fasteners and modeled motor internals according
to its explicit skip list, while retaining visible parts. All five new GLBs
passed a CPU-only Blender 4.5.9 import with materials. Blender sanitized one
pre-existing duplicate triangle in Education and four in LineFollower; these
duplicates are retained in the lossless source exports, not newly introduced.

The five GLBs are final for this side task. Updated visual certification belongs
to the main agent's new draft/final render pass; the earlier screenshots are
not evidence that the corrected sources have already been visually approved.
