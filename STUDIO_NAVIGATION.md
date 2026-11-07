# Retained studio navigation · 2026-09-26

## Exhibit push · 2026-11-06

Opening an exhibit (click, Enter or the picker) moves the camera 30% of the way to the
exhibit over 240 ms with orientation held (`PUSH_MS`, `PUSH_FRACTION` in
`experience.js`). The panel, white curtain and project frame still start at the click,
as with `?push=off`. The push lands once the curtain reads as opaque (`COVER_OPACITY`
.98) and the room stops rendering. A ray cast stops it .3 m
short of any geometry. No push for an exhibit off screen or over 25 degrees off axis,
under reduced motion, in a hidden tab or during another camera move. Input lands it at
once. The return restores the exact pre-push pose before the room's first frame. The
push is hard to see because the curtain is near-opaque about 110 ms after the click.

The project page inside the studio frame plays no line-drawing arrival. Its URL is built
without the room's query, so QA switches such as `?callouts=classic` and `?warm=off` on
the room's URL do not reach it: the frame still shows drawn callouts and shader polling.

## Short transitions · 2026-09-30

The retained navigation now uses200ms entry/return opacity transitions and a180ms
ready-frame reveal. On return, the room is resumed and receives two paint frames
underneath the outgoing iframe before fading it away and disposing it. Browser
history and rapid re-entry cancel stale transitions; reduced motion and hidden
returns settle without waiting for paused animation frames. snapshot().phase
distinguishes entering/loading/revealing/project/returning/room for verification.
Current follow-up evidence is in ../.codex/studio-polish-20260930/.

Opening a project from the 3D room now keeps that room document, scene, renderer,
decoded models, camera and lighting in memory. The existing complete project
page occupies a full-viewport frame. Returning removes the project frame and
resumes the existing room; it does not revisit `experience.html` or run startup.

`studio-navigation.js` owns the top-level project/chapter history entries and
their canonical URLs. Only one project frame exists at a time. Changing projects
replaces it, with synchronous controller cleanup before removal. The room's
animation loop stops while covered, including after tab visibility changes.
The covered room is inert and hidden from assistive navigation; return restores
its prior accessibility state and keyboard focus.

`studio-project-bridge.js` runs only in an explicitly marked embedded project.
It delegates normal project, chapter and return links to the parent. Native
modified clicks, downloads and new-tab links retain their normal behavior.
Home and portfolio links leave the top-level studio. Messages require matching
origin, source window and protocol. Section links and scroll positions use
replacement inside the child, avoiding duplicate frame-history entries.

Browser Back/Forward and Back → new project branches follow the original room
entry. The same section link can scroll back to its heading without adding a
duplicate entry. A slow or failed project load retains an accessible return
button. A shared project URL, new-tab visit or hard reload still opens the
standalone project page; entering the room from there is a normal first load.
Keeping the room resident means its existing memory allocation remains while
one project is open, but no background room frames render.

Validation:

- 16 real project round trips retained one document time origin and one scene
  UUID; no room-model requests were added by return. Camera, light mode and 4K
  selection survived. The room frame counter stopped while the project was open.
- Three projects plus chapter hops returned to the original room. Browser
  Back/Forward through chapter history, mobile full-page layout, all three return
  links, direct legacy URLs and project reload fallback were checked.
- No browser errors, warnings or WebGL-context-limit warnings during the stress
  run. Explicit disposal prevents late model/import/retry completions mounting
  after the project closes.
- Run `node --test tools/room-tests/project-bridge.test.mjs
  tools/room-tests/studio-navigation.test.mjs
  tools/room-tests/project-controller.test.mjs
  tools/room-tests/room-suspension.test.mjs`, then
  `node tools/room-tests/verify.mjs` for the existing room contracts.

Evidence and release backup: `../.codex/retained-room-20260926/`.
No model or lighting assets are regenerated for this navigation change.
