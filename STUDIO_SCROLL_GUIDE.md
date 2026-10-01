# Annotated project motion and studio polish · 2026-09-30

## Integrated page presentation · follow-up to63d4121

The compact two-column model panel has been replaced with a full-width model
scene occupying the available page height. It has no viewport background, border
or card chrome. The case page uses #181818, matching the existing offline frame
background pixels; live surfaces use a genuinely transparent WebGL clear. Other
inspector consumers retain their original solid background by default.

Annotations appear in280ms and alternate across the page; the model shifts
slightly to make room. On phones the large model stays above its floating notes.
Reduced motion cancels both CSS and active Web Animations. Progress still comes
from the rendered pose rather than the requested seek. This revision has72 notes
across16 projects, including seven readings for bilateral steering.

The main-site steering page now uses the same live controller as its studio
counterpart. Both follow a14-second neutral→−90°→neutral→+90°→neutral sequence
with dwell periods. The steering scroll distance is six model-heights; other
mechanisms retain four. Other main-site projects retain their existing frame
packs and avoid loading Three.js. No source mesh, image or motion binary changes.

Signed motion is computed from immutable source binds in studio-steering-motion.js.
Its nominal Cardan phase is clearance-qualified against the supplied forks, not
a measured trunnion calibration. The source omits cross pins/internal rack teeth
and includes existing internal fit overlaps.433-pose checks found no new contact
pairs; upper-yoke penetration stayed at the neutral baseline, lower yokes stayed
clear. Existing shaft/bearing and concealed rack/housing depth variation is
recorded in ../.codex/steering-bilateral-20260930/. Do not call the entire assembly
zero-penetration or manufacturing validated. One common illustrative rack ratio
is used in both directions, within the original travel envelope.

An analytic envelope covering125,469 decoded source vertices is available to the
initial and full controllers before camera fitting. Browser GPU tests check
transparent RGBA-zero background pixels, default opaque behavior, unchanged
source camera between surface modes, exact±90° extremes and neutral restoration.
Current implementation/evidence and release backup are in
../.codex/page-integration-20260930/. Older sections below document the first guide.

Built from release `2e2096f`. The motion guide follows the observed interaction
of [Rowan Jansens’ Lamp page](https://rjansens.com/projects/Lamp/lamp.html): native
page scrolling holds a model in view and scrubs forward/backward through its
motion. Our controller, layout and notes are independent implementations; no
reference video, model, images, scripts or project text are shipped.

## Shared detail pages

Both case-study.html and project-3d.html use project-motion-story.js/css and the
16-project, 69-step project-motion-notes.js catalog. The original mechanism
animations and their confirmed engineering context remain intact. The main site
uses its existing 1280px offline frame packs; the studio uses its existing live
model. Native scrolling is passive, with a short 95ms response and approximately
four model-heights of travel. A visible progress slider and numbered stages
provide direct access. The studio’s “Rotate the model” switch enables its original
orbit, zoom and play controls; returning restores the guided source view.

Annotations follow applied model poses / decoded frames, not pending requested
progress. Late loads, reverse seeks, repeated cached poses, lightbox close,
cover fallback and WebGL restoration replay the correct state. Pixel rounding
cannot leave a named stage just before its threshold; offline steps round up to
the corresponding available frame. The homepage hover previews keep their prior
behavior. All images use contain within the guide, so narrow/tall models are not
cropped by a wider display area.

Reduced motion and very short windows use explicit stages instead of a long
pinned section. The studio CFD view also uses this readable inline mode on short
phones so the pressure legend, model and notes can all be reached naturally.
The full source gallery, 64 chapters, engineering evidence and 35-line Javelin BOM
remain available below the guide.

## Room transitions, highlights and continuous instruments

Opening and returning fade over 200ms, with a 180ms reveal when the child page is
ready. Entry starts the request immediately. Return paints the retained room
beneath the outgoing page before releasing its iframe. Reduced motion skips the
fade; rapid Back/Forward, stale callbacks and backgrounded returns settle safely.
The original room, camera, light choice and model resources remain resident.

Daylight now uses key .86, hemisphere .54, fill .16, environment .32, cabinet
factor .72, pendant 1.9 and desk baked-diffuse gain .5. Exposure remains 1.3;
source colors/textures and the accepted night values are unchanged. This grades
the existing bake without downloading new lightmaps or replacing materials.

Printer motion runs on a 30Hz active clock and the scope on a 10Hz clock, separate
from camera movement. Visible instruments keep moving after the camera settles.
Hidden/off-screen/reduced-motion/project/resume states pause their phase; return
resumes without advancing through hidden wall time. Visibility uses screen size,
frustum and scope front face, not a GPU occlusion query.

Live instruments require bounded raster redraws. Their current/previous reactive
footprints prevent temporal smearing while stationary RT can converge without a
camera-resolution or geometry-generation reset. Zero-draw caching applies when
those instruments are paused or out of view, not while visible motion continues.

## Validation and records

Run the room tests, motion-story.test.mjs, project-controller.test.mjs and
ambient-lighting-tests.mjs. The orchestration lifecycle suite checks that active
ambient motion preserves RT state and stationary resolution. Browser checks
cover actual transition opacity, guide scrubbing, free view, mobile, reduced
motion, project return, pressure legend and live instrument counters.

The local caption fixture checks all 69 note layouts at 390×640 and 1280×720
(138 measurements); it does not claim to test all model motions. Original
16 manifest hashes and all 48 referenced binary hashes were checked unchanged.
Evidence, screenshots and the verified backup chain are under
`../.codex/studio-polish-20260930/`; release records identify the exact final
commit and its online verification.
