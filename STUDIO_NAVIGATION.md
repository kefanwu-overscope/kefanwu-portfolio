# Retained studio navigation · 2026-09-26

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
