# Shared photo-finish frame pipeline

Run `node tools/photo-fidelity/serve.mjs`, open
`http://127.0.0.1:4194/__qa/export.html`, and click Render. Keep that tab visible.
The actual inspector renders all existing frame positions, 480/960/1800px
covers, 640×427 homepage frames and 1280×854 detail frames. Source photos are
never edited. No production page imports this local exporter.

The bounded local POST route writes only WebP/JSON under
`../.codex/refined-annotations-20260930/exports/`. Start with a complete export.
`?only=vineRobot,scanner` updates selected projects; `?hd=1` refreshes HD frames.

Run `python tools/photo-fidelity/pack.py` after completion. It checks dimensions,
background corners and annotation availability before writing versioned assets.
It concatenates original WebP bytes in bounded chunks: four bootstrap frames,
up to sixteen thereafter. Verify all hashes, chunk slices and browser layouts
before release. Change the dated output URL for future revisions once published
with immutable caching.

For the scanner room exhibit, run
`node tools/room-exhibits/export.mjs --only=scanner` and apply its generated
catalog entry. The PSU is separated before material merging, preserving source
vertices and the existing LOD quality.

Photo evidence: `../studio-tests/photo-material-review.md`.


The refined release restores exported surface bump, adds a source-plane wheel
weave and caches one bounded directional self-shadow map. `quality-proof.html`
checks applied poses and shadow-map reuse; `performance.html` compares steady
motion against465eb59e. `layout.html` checks all288 route/viewport/stage
combinations. Reduced-motion emulation may be used to check terminal layout
states efficiently; the actual entrance sequence is verified separately with
normal motion. Always reset emulation before returning the user's browser.

Annotation masks union projected source-part boxes across each phase at32×24.
They are generated offline, so production scrolling performs no GPU readback.
Rigid parts keep only compact bounds/anchors. Phase layout is chosen once and
only the arrow follows the moving component until the next note or resize.
