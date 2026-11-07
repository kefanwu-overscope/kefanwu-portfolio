# Card line drawings — 2026-10-27

Line drawings for the homepage project cards ("Drawn, then built"). Each drawing
registers pixel for pixel on the card's frame-0 cover. Output goes to
`assets/editorial/lines-20261027/`:

- `<key>.webp` (1200x800) and `<key>-600.webp` (600x400): dark lines on a
  transparent background, the same 3:2 frame as the cover.
- `lines.json`: `{key: {src, w, h, cover, srcset, sha256, src600}}`. The
  `srcset` uses the same `?v=<sha256[:12]>` convention as the cover srcsets.
- `provenance.json`: method, renderer commit, defaults, per-project overrides,
  and the cover check.

Fifteen projects are traced. `ansysCfd` is skipped because its cover is a
scientific CFD plot. All 16 covers are renders, so no project needed the
photo fallback, and no project used edge extraction from the cover image.

## Pipeline

Run from the repository root. Node and Python are the Codex-managed runtimes
listed in `WEBSITE/CLAUDE.md`. Python needs numpy, scipy and Pillow, for
example Blender's bundled Python.

1. `node tools/card-lines/run.cjs [key,key]`
   - Snapshots the inspector modules from a pinned commit (`snapshot.cjs`,
     using `git show`), so edits to the working tree cannot change the render.
   - Serves the repository on 127.0.0.1:4641 (`CARD_LINES_PORT`).
   - Opens `render.html?key=` in headless Chrome. Each project loads exactly as
     `tools/white-studio/export.js` loads a cover: a 900x600 selection canvas,
     source camera reset, progress 0. AURA keeps its `aura-reframe-20261022`
     framing.
   - The page re-captures the 1800x1200 cover frame (PNG, plus WebP q.94 like
     the exporter). Then two geometry passes at 4800x3200 store view normals,
     part ids and 24-bit view depth.
   - Everything is written to
     `WEBSITE/releases/drawn-then-built-20261027/card-lines/work/`
     (`CARD_LINES_EVIDENCE`). Paths inside `.codex` are refused.
2. `python tools/card-lines/lines.py [key,key]`
   - Classifies the lines between neighbouring G-buffer pixels:
     - outline: model against background
     - depth step: second differences on both sides exceed `step_px`, with
       opposite signs, so a fold is never mistaken for a step
     - seam: two parts meeting with no depth step
     - fold: same part, normals at least `crease_deg` apart
   - Draws outlines and steps in #111316 and seams and folds in #505b66. Each
     line is centred on its boundary at `line_px` output pixels; below 1200 w
     it uses `line_px_small`, in that file's own pixels. Then it box-averages
     down to each width.
   - Removes short components (`min_px`), which take out mesh noise.
   - Writes the WebP files, `lines.json` and `provenance.json`, plus
     `registration.json` in the evidence folder.
3. `python tools/card-lines/views.py`: evidence views for each project, and
   16-up contact sheets of the lines alone and over the covers.

`settings.json` holds the overrides for each project:

- `quiet`: a part's own depth steps are drawn as thin folds. Used for knurled
  tyres, lead-screw threads and knurled collars.
- `alpha_levels`: coverage is stored in this many steps (32 by default, which
  is near-lossless). brakeSim and lineFollower use 16 to stay under 30 KB.
- `plain` and `hide` are available but not used.

## Registration

The harness's own frame-0 render is byte-identical to the published 1800 w
cover for 13 projects.

vineRobot and carbonSeat are the exceptions: their transmission and carbon
weave shading differs by at most 11 levels from the published cover. Their
phase-correlation shift is zero, so the geometry and camera are the same.

The lines never read a cover pixel. The cover is only used to check them.

## Clear parts

A `glass` layer option is available (`settings.json` `"glass": [patterns]`):

- It drew the parts seen through clear panels, such as the pool rack and pinion
  and the Smelly acrylic.
- It was rejected. The cover's transmission pass refracts and softens those
  parts, so their lines missed the cover by several pixels.
- Clear parts are therefore drawn as solid panels, and their own edges register.

## Integration notes

- Lay the line image in the same `.card-media` box as the cover, with the
  same `sizes`.
- It must use the cover's computed `object-fit` and `object-position`:
  - Once exploded.js arms a card (`.has-explode`), the poster computes
    `object-fit: cover` inside the 640/427 box.
  - Before that, the white-home rule gives `contain`.
  - The two differ by 0.075% scale, which is at most 0.16 CSS px on a
    418 px card.
- The 600 w file uses its own lighter line widths (1.25 / 1.0 / 0.6 px).
  Through srcset:
  - A DPR-1 card of 300–460 CSS px gets 0.6–1.0 device px outlines.
  - The 1200 w file on a DPR-2 card of 418 CSS px gets about 1.05 device px.

## Wipe pacing (2026-10-29)

`card-drawing-20261027.js` keeps four numbers per drawing in its `LINES`
table, after the two file hashes: `left`, `right`, `q10`, `q90`, as shares of
the card width. `python tools/card-lines/wipe_ink.py` prints them from the
published files:

- `left` / `right`: the drawing's horizontal extent (alpha > 12 in either
  the 600 w or the 1200 w file). The wipe's soft edge reaches `left` at 10 %
  and `right` at 90 % of the wipe.
- `q10` / `q90`: where 10 % and 90 % of the ink lies along the wipe. A line
  pixel at card position (x, y) is half revealed once the edge's centre on the
  middle row passes `x + tan(10deg) * (y - 427/640/2)` (the mask is a 100deg
  gradient). Ink = pixels darker than 40/255 when the 1200 w drawing is
  composited on white. The edge passes `q10` at 18 % and `q90` at 82 % of the
  wipe, linear in between, so the lines appear at an even pace (10 % of the
  ink per 48 ms of the 600 ms wipe).

A stroke ease over the extent was tried first: most drawings keep their lines
near the middle of their extent, so 10 -> 90 % of the ink appeared within
77-237 ms. With the ink quantiles it takes 383-386 ms for every drawing in
the model, and 368-394 ms in the frozen-pose browser measurement of all 15
drawings at 1440 x 900 @1 and 390 x 844 @3 (evidence in
`WEBSITE/releases/drawn-then-built-20261027/verify/fix-home-r1/cards/`).
