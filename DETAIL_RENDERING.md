# Detail animation rendering

## Shared neutral backgrounds and conforming carbon layup · 2026-09-15

The current presentation revision is `neutral-20260915`, based on published
`c8afec3956948f93ea1a9d3c1620f881c448c660`. This section supersedes historical
instructions to use the Education-only studio and retain 15 older homepage packs.
All 16 cover sets and both animation catalogs now use one neutral #191919
background, white studio lighting and native alpha composition. Actual model
colors are retained; blue background spotlights are removed.

Carbon cloth settles into the fixed source shell instead of accumulating offset
shells. Completed stages and the final pose preserve its original geometry.
The animation remains illustrative: confirmed fabrication is EL2 resin, 20 main
plies of 3K 200 g/m² twill and 5–10 local reinforcing plies.

The home catalog remains 640×427 and the detail catalog native 1280×854, with
2,032 frame positions in each. Cover variants remain 480/960/1800 pixels. Initial
cover/animation poses match. The existing streaming loader, layout and memory
budgets are unchanged. All confirmed engineering facts, 79 supplemental fields,
35 Javelin BOM rows and 94 gallery references are preserved.

Use [NEUTRAL_STUDIO.md](NEUTRAL_STUDIO.md) and the new neutral render/pack tools
for current assets. Old renderers remain historical reproduction tools. Evidence:
`../.codex/neutral-studio-20260915/`. Exact release, checked backup and online
status: `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-15-neutral-studio/release-metadata.json`.

Delivery notes for `detail-resolution-20260914`. Native asset and loader validation have passed. The exact release commit, backup checks and publication status are recorded in `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-detail-resolution/release-metadata.json`.

## Two animation catalogs

| Surface | Manifest | Frame dimensions | Loading policy |
|---|---|---|---|
| Homepage project cards | `assets/exploded/manifest.json` | 640 × 427 | Existing on-demand, full-sequence cache. |
| Standalone case-study hero | `assets/exploded/manifest-detail.json` | Native 1280 × 854 | Explicit `streaming: true`; a moving decoded-frame window. |

The delivery preserves the same 16 project keys, animation modes and **2,032 frame positions** in each catalog. The detail images are newly rendered at 1280 × 854 from the source scenes, not enlarged homepage WebPs. The other 15 homepage sequences keep their existing assets. Education receives a new matching studio sequence: its homepage frames are downsampled from the new native detail masters, with a freshly rendered matching progress-zero cover.

Both surfaces use [exploded.js](exploded.js). The case page selects its catalog through the existing script attribute:

```html
<script defer src="exploded.js?v=detail-resolution-20260914"
  data-manifest="assets/exploded/manifest-detail.json?v=detail-resolution-20260914"></script>
```

Homepage routing remains on the standard manifest. A missing or malformed manifest leaves the cover available. The shared loader handles either arrival order: the manifest may finish before or after the asynchronous `.case-animation-host` is created.

## Preserve framing before increasing resolution

The established scene setup first computes the camera, staging and motion at **640 × 427**, using the approved source configuration. Only at the actual render call does the detail wrapper set the output to **1280 × 854**, an exact 2× increase on both axes. This retains the same aspect ratio and camera projection; increasing the resolution earlier in the staging process is not an equivalent reproduction path.

The wrappers compare camera state and camera view-frame projection before and after the resolution change. The generic batch also checks the original motion report and progress-zero scene digest against the approved cover. Source geometry, materials, mechanism poses and camera framing remain the basis for the new renders. Sampling stays at 48 samples; the generic batch's `--gpu-oidn` option keeps OpenImageDenoise and changes its execution device, not its algorithm.

The detail packer encodes native masters as WebP at quality 88 / method 6. Its `.bin` chunks concatenate the exact encoded WebP bytes: the initial chunk contains at most four frames, subsequent chunks at most eight, with a 256 KiB byte ceiling. Decoding uses `Blob.slice` with the recorded offsets and lengths. Chunk packing adds no second image encoding or quality loss. Individual WebP URLs remain available for transport fallback.

## HD memory and interaction contract

Only a boolean `streaming: true` enables the HD branch. Ordinary configurations retain the existing full-sequence memory guard. Activation is lazy; the loader does not automatically request all 16 projects.

- The HD cache keeps at most **32 ready frames globally** across its retained sequence entries, plus up to three pending frame jobs. It prioritizes the exact needed pose and a neighborhood on both sides. Larger accepted dimensions automatically reduce the window to stay within budget.
- The **160 MiB managed decoded budget** includes ready HD images, pending native decodes and ordinary cached sequence reservations. Reservation happens before setting the image source. Canceling or revoking a pending image does not release its reservation until the native decode promise settles.
- At most **three workers / network requests** run across the active loader. A fetched chunk is shared between workers, and every completed decode selects the next frame using current intent. Fetching a chunk does not oblige the loader to decode all its other frames.
- Retained compressed chunk and individual-frame Blob records have a separate **16 MiB global LRU cap**. Evicted decoded frames can be recreated from retained compressed data; a compressed chunk is fetched again if that cache also evicted it.
- The actual displayed frame, current pose, target and missing intermediate pose are protected from active-frame eviction. A cold seek keeps the previous decoded pose until the requested exact frame is available. Reversals reuse nearby decoded frames; missing intermediate frames pause and wake the loader without a polling animation loop.

A 1280 × 854 RGBA frame reserves 4,372,480 bytes, about 4.170 MiB. The tested 32-ready-plus-three-pending HD peak is **145.947 MiB**. A deliberately mixed 640/HD cache transition reaches **159.500 MiB**, still below the global limit. The 16 MiB Blob budget is separate; these counters do not claim that total browser-process memory, GPU copies, posters or in-flight response buffers fit inside 160 MiB.

## Paint, reset and lifecycle protections

The poster remains opaque behind the animation. Only the stage uses the existing 160 ms opacity transition, so the start does not expose a dark background between two simultaneously fading images. The stage is revealed only when the actual decoded frame index is greater than zero. A tiny input that still rounds to frame zero keeps the sharper matching cover.

Frame eviction and re-entry compare the Image node as well as its index. This prevents an inactive stage from reusing an old revoked image when the same frame index is decoded again. URL disposal always updates the frame's actual cache owner.

Reset, offscreen state, document visibility, touch release, keyboard input, reduced motion and image-lightbox exclusions retain the shared interaction rules. Pagehide clears cached images, while in-flight entries remain tracked until aborts and native decodes settle. A BFCache restoration or immediate activation of another project therefore cannot start three extra requests over the old three. Failed chunks fall back to their individual frames; failure of both transports restores the static-cover experience.

## Education studio reproduction

Education uses a dedicated staging helper and renderer:

- [education_studio.py](tools/exploded-render/education_studio.py): aligns the existing four-light recipe to the education camera and replaces the distant flat background with a curved Graphite sweep.
- [render_education_studio.py](tools/exploded-render/render_education_studio.py): preserves the original source motion and 640 × 427 framing, renders native 1280 × 854 frames, and optionally renders the matching progress-zero cover at 1800 × 1200 / 192 samples.
- [pack_education_studio.py](tools/exploded-render/pack_education_studio.py): creates new education homepage frames, chunks and responsive cover candidates. It does not overwrite shared manifests.

The approved `aligned-sweep` change preserves the source camera, 26 source mesh components, 557,206 source faces, component materials and complete 23-stage assembly path. The four lights retain their colors, energies and sizes; their transforms and the photographic staging plane change. Scene checks record zero source-pose matrix error and zero HD camera-projection error. Education's home pack uses an initial four-frame chunk and subsequent chunks of at most 16 frames; the unified detail pack uses the HD chunk policy above.

The verified commands from the repository directory are:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_education_studio.py -- --output C:/Users/oc/Desktop/WEBSITE/.codex/detail-resolution-20260914/generated --evidence C:/Users/oc/Desktop/WEBSITE/.codex/detail-resolution-20260914/education --cover

& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_education_studio.py --input C:/Users/oc/Desktop/WEBSITE/.codex/detail-resolution-20260914/generated --evidence C:/Users/oc/Desktop/WEBSITE/.codex/detail-resolution-20260914/education
```

For a cover-only run, use `--cover-only` on the dedicated renderer and a separate output directory; otherwise its one-frame provenance would replace the full animation record. The historical generic `render_initial_covers.py` entry has not been rerouted for Education and would recreate its old background. Use the dedicated entry above for this revision.

The packer emits `candidate-home.json` and `candidate-cover.json` under the education evidence directory. Native education PNGs are supplied to the unified detail packer separately. Exact commands, preservation checks and integration artifacts are recorded in [education/delivery.md](../.codex/detail-resolution-20260914/education/delivery.md).

## Other 15 projects: native batch reproduction

The persistent [render_detail.py](tools/exploded-render/render_detail.py) and [pack_detail.py](tools/exploded-render/pack_detail.py) preserve executed-script copies by SHA and write candidates separately from the public manifest. Real CLI verification covered a native p0 render, unchanged PNG retention on resume, custom paths and byte-identical Telecaster re-encoding/chunk packing.

From the repository directory:

```powershell
& 'C:/Users/oc/.cache/blender/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python tools/exploded-render/render_detail.py -- --projects steering vineRobot javelin brakeSim aura scanner carbonSeat seat materialTest ansysCfd pool lineFollower formlabs ftc telecaster --threads 0 --gpu-oidn --resume --pack --python-executable 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'

& 'C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' -X utf8 tools/exploded-render/pack_detail.py --projects steering vineRobot javelin brakeSim aura scanner carbonSeat seat materialTest ansysCfd pool lineFollower formlabs education ftc telecaster
```

Both tools accept `--evidence`; rendering accepts `--output` and packing accepts `--input`. Defaults resolve from the checkout to `../.codex/detail-resolution-20260914` and its `generated` subdirectory. `--asset-base` selects a new directory beneath `assets/exploded/`; `--pack` forwards the selected paths. Reproduction details and actual CPU/GPU denoising ranges are recorded in [assets/final-delivery.md](../.codex/detail-resolution-20260914/assets/final-delivery.md).

The delivered HD payload is **68,729,666 image bytes in 349 chunks**. Current homepage payload is **24,365,690 image bytes in 159 chunks**, including the revised Education sequence. Chunks contain exactly the original encoded WebP bytes; retaining individual fallback WebPs duplicates those payloads on disk.

The generic renderer deliberately excludes `education`; use its dedicated renderer first, then include the resulting native masters in unified HD packing. Root owns integration of the complete 16-project detail candidate, Education's homepage/cover candidates, runtime cache revision and final browser/asset validation.

## Validate a checkout

[validate_detail.py](tools/exploded-render/validate_detail.py) needs Python 3.10+ and Node.js, with no private baseline, PNG masters or Blender dependency. It checks both manifests, every frame/chunk/hash, responsive covers, camera provenance, Education's shared source-PNG records, page fallbacks and cache URLs. Binary hashes remain exact; only parsed JSON provenance permits recorded LF/CRLF-equivalent hashes for Git checkout portability, explicitly listed in the report.

```powershell
python -X utf8 tools/exploded-render/validate_detail.py --report detail-validation.json
```

Pass `--node <node-executable>` if Node is not on PATH. The existing `validate_exploded.py` and `tools/editorial-render/validate_catalog.py` commands dispatch to this validator for the current revision and retain their historical behavior for older revisions. Offline source-preservation checks remain separately archived in the release evidence.

## Verification evidence

[loader/verification.json](../.codex/detail-resolution-20260914/loader/verification.json) records **58 passing scenarios** against loader SHA-256 `1941f96169c2bd5643637c147130eef1c6d5cc869add259f63d826b79ff77829`: 14 HD cases, 14 retained progressive cases, four paint-transition cases, three host cases, 18 retained interaction cases and five case-renderer/lightbox cases. This includes 280 deterministic random actions across 1280 and 1024 fixtures.

The HD tests cover distant and reversed seeks, cold-frame display pinning, compressed-cache reuse and eviction, malformed metadata, chunk/individual failures, native-decode cancellation, BFCache restoration, correct cache ownership and same-index redecoding. They sample managed reservations at each image-URL allocation and event, and finish with zero live URLs and zero reserved bytes. The maximum accepted 1920 × 1280 test automatically reduces the ready window to 14 frames and stays within 160 MiB.

These are deterministic runtime and memory-accounting fixtures; their RTT, bandwidth and seek timings are modeled. They are not production timing measurements or a substitute for final native-WebP, browser and deployment checks. The [loader implementation notes](../.codex/detail-resolution-20260914/loader/implementation.md) describe the tested boundaries and baseline whole-sequence comparison. Education has separate scene-preservation and packing evidence in its delivery package.
