# Shared photo-finish frame pipeline

Run `node tools/photo-fidelity/serve.mjs`, open
`http://127.0.0.1:4193/__qa/export.html`, and click Render. Keep that tab visible.
The actual inspector renders all existing frame positions, 480/960/1800px
covers, 640×427 homepage frames and 1280×854 detail frames. Source photos are
never edited. No production page imports this local exporter.

The bounded local POST route writes only WebP/JSON under
`../.codex/photo-fidelity-20260930/exports/`. Start with a complete export.
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
