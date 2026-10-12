# White portfolio presentation — 2026-10-11

Based on `f83d3641f5ba8cae1fe7859ab89e5a3d2f087849`. After reviewing the local white preview, the user explicitly authorized publication on October 11 and requested a more natural hero fade, less empty track to the car's right, and less gradient over the body. The release uses GitHub `main` and Vercel automatic deployment. Exact commit, deployed byte verification and recoverable release backup are recorded under `../.codex/white-release-20261011/`.

The homepage keeps the original real race-car photograph as a continuous hero background. Directional white fades, large black typography, white sections, thin rules and restrained controls replace the dark presentation. The car and driver remain visible on narrow screens. All sixteen project links, content, filtering/search and animation interactions remain.

The final hero gently eases through several white-opacity stops, clears the horizontal fade by51% width and keeps the lower car outside the stronger bottom fade. Wide screens crop the photographic field14% beyond the right edge, moving the full car farther right and reducing unused track. Phones retain the whole car with a smoother top/bottom mask. Narrow desktop actions stack within the readable text area.

Main-site and 3D case studies load the same white presentation and cover catalog. The model stays integrated into the full page; source motion, small component notes, dynamic leaders, complete engineering records and retained-room navigation are preserved. The room itself and its existing project materials remain unchanged.

## Real-model rendering

The current Three.js inspector is the authority for project geometry, sampled motion, photo-supported finishes and camera framing. Older Blender scripts predate the September photo-finish corrections and October brake geometry. This revision regenerates through the current inspector so static and live presentations agree.

The inspector adds a backward-compatible `backgroundColor` option. Room callers retain the original dark default. White case viewers and the local exporter explicitly use an opaque `0xffffff` background inside the transmission pass. Clear acrylic refracts the white surface; no pixels are selected, whitened or replaced. Neutral lights, source materials and the environment are unchanged. Numerical PBR settings remain visual approximations, with the photo evidence and known optical limits listed in [material review](tools/white-studio/material-review.md).

Fresh paths:

- `assets/editorial/white-20261011/`: 48 responsive covers and the shared cover catalog.
- `assets/exploded/white-20261011/`: 2,032 SD and 2,032 HD frames, 385 chunks, provenance and unchanged anchors/masks.
- `assets/exploded/manifest-white-20261011.json` and `manifest-detail-white-20261011.json`.

Original immutable assets remain intact. Unique SD/HD image bytes are 68,909,890, up 0.166% from the previous presentation; this is a style revision, not a new loading-speed claim. Frame/chunk fallback transport is retained. Native backgrounds are exactly white; all animation corners encode at RGB255. Five large covers have one corner channel at253 from lossy WebP, within the recorded3-level encoding tolerance.

## Validation

- All4,064 frames,385 chunks and48 covers: dimensions, file hashes, chunk slices, source/camera/initial pose and white corners passed.
- All2,032 annotation points and72 masks exactly match the existing data; scientific pressure legend and colors remain unchanged.
- All4,599 original/source/catalog/immutable files in the preservation snapshot remain byte-identical.
- 74 controller, annotation, motion, material and bridge regressions passed.
- 21 shared reading/content groups passed:16 projects,64 chapters,131 verbatim archived paragraphs,100 gallery references and native/retained links.
- Browser: main homepage at320/390/600/768/1024/1440 widths, phone menu, filters, search and empty state;64 main/studio detail route/viewport combinations at1280×800 and390×844 without overflow, missing covers or browser errors.
- Actual white SD card motion, HD brake motion with component leader, phone live Smelly model with explicit reduced-motion stages, and original stress figure with complete legend/units were inspected.
- Actual room → white Carbon seat detail → room preserved scene UUID, document time origin, camera/target, light mode and quality; zero additional room-model requests on return. Room frame count stayed fixed while covered.

Browser screenshots/reports, render proof, preservation snapshot and asset verification are under `../.codex/white-studio-20261011/`. Final local backup instructions are in that folder's `local-backup-reviewed/RESTORE.md`; preserve every predecessor archive in the chain.

Release evidence and the final release overlay are under `../.codex/white-release-20261011/`. New dated cover/frame paths receive immutable caching; original assets and every restoration dependency remain intact.

## Local preview

Run `node tools/white-studio/serve.mjs`, then open `http://127.0.0.1:4196/`. The server binds only to loopback; export writes are restricted to the dated local evidence folder. Rendering/packing reproduction is in [the tooling README](tools/white-studio/README.md). The preview is not a deployment.
