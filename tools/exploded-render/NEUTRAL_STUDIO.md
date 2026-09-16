# Shared neutral studio

`render_neutral_studio.py` renders all sixteen original scenes through one studio
helper. It preserves the established 640 × 427 staging before switching to the
native 1280 × 854 raster. Each frame retains 48 samples, OpenImageDenoise, and the
source motion controller. Carbon uses its separately verified flush layup revision.

`neutral_studio.py` replaces the four colored lights with a common white recipe
and neutral world illumination. The approved `flat` variant composites the native
antialiased object alpha over a fixed neutral color inside Blender, after
denoising. The hidden photographic floor still participates in reflection and
shadow rays. This prevents camera angle, colored materials, or denoising from
changing the empty background. Native PNG backgrounds are exactly RGB 25/25/25;
lossy WebP conversion produces the shared neutral RGB 24/24/24 background. The
experimental `contact` proof variant is not the approved delivery recipe.

The progress-zero cover is rendered from the identical scene at 1800 × 1200,
192 samples and pixel aspect 1:1.00078125. Its normalized camera frame differs
from the native sequence by less than 2e-6. The helper checks that source meshes,
materials, poses and camera do not change while applying the studio.

From the repository, with the bundled Blender and Python available:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_neutral_studio.py -- --variant flat --cover --allow-carbon-motion-change --evidence C:/Users/oc/Desktop/WEBSITE/.codex/neutral-studio-20260915

& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_neutral_studio.py --projects steering vineRobot javelin brakeSim aura scanner carbonSeat seat materialTest ansysCfd pool lineFollower formlabs education ftc telecaster --evidence C:/Users/oc/Desktop/WEBSITE/.codex/neutral-studio-20260915
```

Use `--projects` to render a subset and `--only 0 --cover` for a small verification
run. `--output` selects native PNG storage. `--pack --python-executable <python>`
packs each complete project as soon as its render finishes. A file named
`PAUSE_GPU` in the evidence directory pauses the batch between projects; remove
that file to continue after another renderer has released the GPU.

The packer creates quality-88 HD frames and quality-85 SD frames from the same
PNG masters. SD uses a 640 × 427 Lanczos downsample. Each tier begins with a
four-frame chunk; subsequent chunks contain at most eight HD or sixteen SD
frames, with a 256 KiB ceiling. Chunks contain the exact encoded WebP bytes.
Only HD candidates carry `streaming: true`. Responsive covers use widths
480/960/1800 and qualities 87/87/91.

All shared manifests remain untouched. Default candidates are written under
`assets/` in the evidence directory as `candidate-home.json`,
`candidate-detail.json` and `candidate-covers.json`; per-project records under
`assets/candidates/` also include the matching editorial catalog fields. New
public files use `assets/exploded/neutral-20260915/{sd,hd}/` and
`assets/editorial/neutral-20260915/`. Original assets are retained.

After integration, the renderer follows preserved provenance links back to the
original motion and camera references, so its checks still work when the public
manifests already select the neutral release. For a new verification render,
choose a fresh evidence/output directory. To encode an already integrated
release again, also choose a fresh `--asset-revision` directory; the packer
refuses to overwrite an active release. Supply the final Carbon
`geometry-verification.json` through `--carbon-verification` when it is outside
the default evidence directory.

`--resume` verifies existing PNG hashes, camera, wrapper/helper hashes, the
pipeline snapshot, source geometry/material digest, motion report and original
provenance hashes before retaining frames. It rejects changed inputs. Executed
Python source snapshots are retained under `source-archive/`; per-frame and
per-project records keep the corresponding hashes and preservation evidence.
