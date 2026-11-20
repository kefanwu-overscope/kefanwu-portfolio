# Hero pen: the homepage car's traced strokes

Authoring pipeline for the homepage hero drawing of PEN_SPEC (R3): the race car drawn by one
pen, silhouette first, then form, detail, lettering, shading and a last press. This folder
makes the **art**: named strokes on the photo's real edges, ordered and tagged by class. The
engine's build (a separate step) reads `out/strokes.json` and writes the inline data block
(integer cubic deltas at 0.5 src px with corner markers) and the per-class schedules.

Nothing here changes the photo. `assets/hero-fsae-track-2200.webp` is read only.

## Run

Python with numpy, scipy and Pillow (no OpenCV, no scikit-image needed):

```
python features.py                 # writes inputs/features.json from the authored table
python build_art.py                # traces, orders, gates; writes out/strokes.json, out/provenance.json
python build_art.py --out DIR      # the same into another folder (review builds)
python build_art.py --hatch body   # comparison only: adds the lower-body hatch (fails the critic's rule)
python build_art.py --ship-held --out DIR   # comparison only: also draws the held rear-bay candidates (fails the rear-bay gate)
python build_art.py --crown form|drop --out DIR     # comparison only: far-front-crown at FORM weight, or not drawn (the default, since revision 5, is DETAIL)
python review.py --outdir DIR [--cls D|T|P] [--scale 2] [--accents]   # strokes over the photo per region, coloured by tier (revision 5: no P5 accents unless --accents)
python clock_estimate.py           # ESTIMATE of the spec clock over the art (the engine owns the real one)
```

The bilateral channel preparation (via `tools/hero-drawing/np_cv2.py`) is cached outside the
repo, keyed by the photo's SHA256: `%TEMP%/hero-pen-cache`, or `HERO_PEN_CACHE`.

## Files

| file | role |
| --- | --- |
| `features.py` -> `inputs/features.json` | Every traced stroke as data: neutral id, inventory members (or an authored guide) in drawing direction, phase, tier, kind, area, classes, snap mode and radius, provenance kind, pinned direction. Also the list of features left out and why. |
| `inputs/inventory-guides.json` | The art stage's guide polylines (about 4 px accurate), copied from `releases/.../art/inventory.json` with its SHA256. Guides are never strokes: they are snapped. |
| `inputs/glyph-order.json` | Waypoints, in pen order, for every numeral and letter stroke; which of its ends are free (`free`: `s`, `e`; a junction end is not free); glyph regions (box, ink, clip). |
| `inputs/car-mask.json` | The car and its cast shadow as one polygon (gate: a stroke whose midpoint lies more than 10 src px outside is rejected). |
| `inputs/dark-mask-origin-880-380.png` | Dark mask (Y < 14 after a 5 px median), origin 880,380; hatching lies inside it. |
| `common.py` | Paths, cache, polyline helpers; imports `tools/hero-drawing/trace_lines.py` (unmodified) for snapping and fitting. |
| `trace.py` | Snapping of open guides, straight-line fits, ellipse fits, and the independent registration measurement. |
| `member_edge.py` | Revision 6: registration of a straight member on its own edge (the luminance step of the member's polarity across the line, nearest or strongest within +-4 src px, every 1 src px), with occluded spans left out and reported apart; `fit_edge_line` refits a straight line to that edge. The generic measure (`trace.registration`) takes the nearest edge of anything, which clutter can satisfy. |
| `glyphs.py` | Otsu threshold, Zhang-Suen thinning (NumPy), spur pruning, waypoint-routed skeleton paths, free ends moved to the ink end minus half the stroke width, medial-axis check. |
| `build_art.py` | The pipeline and the gates. |
| `review.py`, `look.py`, `look_guides.py` | Review renders and authoring crops (rulers in src px). |
| `review_page.cjs` | The art painted on the real homepage layout (a test copy of the committed `index.html`, `?draw=off`) in headless Chrome (one context per case at its real device scale factor) at 1440 DPR 2, 1440 DPR 1, 1280 DPR 1, 768 DPR 2 and 390 DPR 3: alone on white and over the photo, at section 7 weights, no animation; for class D also the plate and lettering crop at the page weights and with every glyph stroke at a flat 2.0 CSS px (the lettering gate). `node review_page.cjs <baseUrl> out/strokes.json <outDir> [playwright]`. Revision 5: the P5 accents are left out, as the engine's build drops them (`HERO_PEN_ACCENTS=1` draws them). Serve the committed tree with `node test/serve.cjs <port> -`. |
| `clock_estimate.py` | A port of the R2 pilot's solver of PEN_SPEC section 5, run over the art. An estimate, not the engine. |
| `engine/`, `test/` | The engine, its build (reads `out/strokes.json`) and its tests; see the header of `engine/build.cjs`. |

## `out/strokes.json`

```
{
  "format": "hero-pen strokes v1",
  "photo": "assets/hero-fsae-track-2200.webp", "photo_size": [2200, 1238], "photo_sha256": "...",
  "units": "source px of the photo (y down)",
  "car_box": [932, 430.7, 1758.5, 927.6],        // today's develop box (PEN_SPEC 8)
  "seed": 20261107, "cw_src_px": 827.0,
  "hatch_set": "tyre",                           // "body" only in the comparison build
  "classes": {"D": ">= 1280 px", "T": "768-1279 px", "P": "< 768 px"},
  "counts": {"D": {"total": .., "by_phase": {"0": .., ...}, "by_kind": {...}}, "T": {...}, "P": {...}},
  "order_note": "Global drawing order (one pen). ...",
  "ordered": true,                               // the art ordered (and flipped) the strokes: keep this order
  "carMask": [[[x, y], ...]],                    // inputs/car-mask.json, for the engine's own car-mask gate
  "cut_order": {"1": "box hatch", "2": "rear-box", "3": "lettering", "4": "P5 accents", "5": "body hatch and tyre flicks"},
  "revision": "2026-11-10 revision 7 (...)",
  "strokes": [ STROKE, ... ]                     // ONE global drawing order; each class draws its subsequence
}
```

Each `STROKE`, in drawing order:

| field | type | meaning |
| --- | --- | --- |
| `i` | int | Index in the global order (also the mulberry32 jitter index: `20261107 + i`). |
| `id` | string | Neutral name. No id asserts a function (deny-list: wishbone, toe, tsal, spoke, rotor, upright, hub, damper, pushrod, lamp, brake, suspension, harness). |
| `phase` | 0-5 | P0 lay-in, P1 silhouette, P2 form, P3 detail, P4 shade, P5 last press. Never decreases along the order. |
| `area` | string | The cluster the hand is in. P1: `g1-nose` ... `g7-front-tyre` (gestures; since revision 1 the helmet, `g3-helmet`, is drawn after the front tyre; `g8-crown` is gone since revision 3, `far-front-crown` is P2 `nose-top`). P2: `nose-top`, `cockpit`, `side-plate`, `front-wheel`, `rear-wheel` (since revision 3 it ends with `shadow-ground-rear`, straight after `rw-rim-fit`), `hoop`, `box`, `rear-bay` (revision 3: `lower-rail-top`, `rear-tube-level`), `helmet`, `driver`. P3: `side-plate`, `lettering`, `nose-rear` (the nose-top 219 since revision 2), `rear-frame` (empty since revision 2). P4: empty since revision 3 (areas kept for a hatch patch, when one ships: `hatch-front-tyre`, `hatch-body`, `hatch-box`, `hatch-rear-tyre`; `shadow-nose`, `shadow-rear` no longer used). P5: `accent`. A change of `area` is where PEN_SPEC puts a beat. |
| `tier` | `g c y a n f d h` | PEN_SPEC section 7: guide, contour, tyre, accent, numeral, form, detail, shade. |
| `kind` | string | `guide` (P0), `contour` (P1), `form`, `detail`, `glyph` (letters and numerals), `shade` (P4 shadow edges: open, tier `h`; none since revision 3), `hatch` (flicks; none ship), `accent` (P5). `shadow-ground-rear` is kind `form`, tier `d`, with `convention: "shadow edge"` since revision 3. |
| `classes` | string | Subset of `"DTP"`. |
| `mask` | int | The same as bits: P = 1, T = 2, D = 4 (PEN_SPEC 11). |
| `prov` | string | `traced`, `fitted` (the rim ellipses), `derived` (accents: sub-ranges of traced strokes), `convention` (ghost loops, nose gesture, every hatch mark). The shadow strokes are `traced` (measured on the cast-shadow edge) and listed in provenance as drawing convention. |
| `members` | [string] | Inventory feature ids the stroke draws (for the feature deny-list and provenance); neutral ids where the inventory's working label names a function (`amber-lens`, `lens-housing`, `rear-tube-level` for the inventory's `arm-upper`; see provenance `inventory_aliases`). |
| `len` | float | Length in src px. |
| `closed` | bool | A closed loop (plates, lens, helmet before its overrun, box). |
| `pinned` | string or null | `as-authored` or `ccw`: the direction is fixed. null: the order chose the direction (see `flipped`). |
| `joined` | 0-3 | Bit 1: the start lies within 3 src px of another stroke's path in a shared class (no landing taper). Bit 2: the same for the end. Revision 6: the bit is also set on a blunt free end (`blunt`): the engine draws a flagged end at full width and runs it on 1 src px (its `OVERLAP`), so the art has cut that 1 src px off already. |
| `pts` | [[x, y]] | The stroke as a polyline in drawing direction, about 1 src px apart, 0.1 px precision. |
| `segs` | [[[x, y] x 4]] | The same stroke as cubic Beziers (p0, p1, p2, p3 in src px, 0.01 px), in drawing direction; the fit is within 0.5 src px of the traced line. The engine converts these to integer deltas at 0.5 src px. |
| `corners` | [int] | Indices k into `segs`: a corner (pen stop without lift, PEN_SPEC 6) lies at the start of `segs[k]`. Since revision 2 glyph strokes can have corners too (the nose-top 2, 1 and 9). |
| `burst` | string | Timing group: the word (`olin`, `college`, `of`, `engineering`, `plate-219`, `top-219`) or the hatch patch. PEN_SPEC 4: 30 ms between letters of a word, 25 ms between flicks of a patch. |
| `patch` | string | Hatch patch id (hatch only). |
| `gesture` | int | P1 gesture number 1-8 (PEN_SPEC 3.2). |
| `glyph` | object | `{word, letter, ch, stroke}`; `ch` is `i-dot` for an i-dot (each word's dots come after the word). |
| `glyph_check`, `skeleton_check` | object | Medial-axis distances (max, p95, median, src px) of skeleton-traced strokes; `glyph_check.ends`: free ends, half width, the gap to the ink end minus half width before and after the end fit (src px). |
| `meet` | object | Ends moved to meet another drawn line: `{s|e: {to, line, moved}}` (`moved` in src px, + extended, - trimmed). |
| `registration` | object | `{n, within1, within2, median, noedge}` of the independent edge check (below). |
| `fit_in_black`, `ellipse`, `arc_deg` | | Rim arcs: the fitted ellipse `[cx, cy, rx, ry, deg]` and the arc's parametric range. |
| `derived_from`, `derived_range` | | Accents: the source stroke and the arc-length fraction re-traced. |
| `straight`, `straight_dev_max` | | Fitted as one straight line; max deviation (src px) of the snapped edge points from it. |
| `cut` | 1-5 | The PEN_SPEC 5.4 cut-order step that removes this stroke when a class runs over its last-ink limit (absent: never cut): 1 box hatch, 2 rear-box, 3 lettering, 4 P5 accents, 5 body hatch and tyre flicks. |
| `note`, `feature`, `mode`, `chan`, `flipped`, `split_weak` | | Authoring record. |
| `resnap` | object | Revision 2, `nose-loop` and `nose-gesture`: the far-span re-snap record (span, offsets, method). |
| `trimmed_start_px`, `extended_start_to_y` | number | Revision 2: `front-tyre` lost its first 25 src px; `brace` runs along its own line up to y 469. |
| `smoothed` | object | Revision 3, `nose-loop` and `nose-gesture`: the far-span smoothing record (band, deviations, plate-corner step width, curvature lobes and inflections). |
| `letter_clearance` | object | Revision 3, `fw-rim-fit` and `rw-rim-fit`: distance to the sidewall lettering before and after the inward shift, the shift, the contacts left in the 8 src px end zones. |
| `after`, `convention` | string | Revision 3: `shadow-ground-rear` follows `rw-rim-fit` directly (`after`); `convention` names a traced line that is drawing convention (`shadow edge`). |
| `clear_ends` | object | Revision 4, `far-front-crown`: its ends trimmed to stop `gap` src px from `to` (`nose-loop`): `{to, gap, before, trimmed, after, len_before, len_after}`. |
| `rim_cut` | bool | Revision 4, `rw-rim-fit`: the fit arc ends where its edge support ends (`provenance.revision_4.rims`). |
| `trim_at` | [object] | Revision 5: an end that overshot another drawn line, trimmed back to the crossing (a T): `[{to, max, len_before, crossings, trimmed_start or trimmed_end, start_at or end_at, len_after}]` (`box-top-right` at the helmet, `stripe-upper-rear` at `nose-loop`, `pale-panel` at `brace-inner`). |
| `end_trim` | object | Revision 5, `nose-loop`: it ends `dy` src px below the start of `of` (`nose-underside`): `{of, of_start, dy, y_cut, end_before, end_after, len_before, len_after, trimmed}`. |
| `open_gap` | object | Revision 5, `amber-lens`: the closed traced loop drawn open, with a gap of `frac` of its length centred at `centre` (the loop point nearest `at`): `{frac, at, centre, loop_len, gap_arc, gap_chord, len_after}`. |
| `blunt` | object | Revision 6: free ends drawn blunt (full width, no taper), `{s|e: {end_measured, pre_trim_src_px, end_in_art}}`: the measured end, the 1 src px cut off in the art, and the end as written (the engine's run-on puts the drawn end back on `end_measured`). `rear-tube-level` (e), `lower-rail-top` (e), `bar-below-brace` (s, e). The matching `joined` bit is set. |
| `occluded` | [object] | Revision 6: spans where the member's edge is hidden behind something in the photo and the line is drawn through: `[{y: [y0, y1]} or {x: [x0, x1]}, by}]` (`diag-tube`: the red block, y 491-503; `bar-below-brace`: the brace's end, x 1602-1612). Left out of the own-edge score and reported apart (provenance `revision_6`). |
| `line` | object | Revision 6, `bar-below-brace`: the straight line it lies on, `{slope, icept, x}` (y = slope x + icept, src px). |
| `leg_edge` | object | Revision 6, `hoop-leg-arch`: its first member, the pink sleeve's right edge (`from`, `to`, per-row measurements `rows`, `polarity` for `member_edge.py`). |
| `rb_min_len` | number | Revision 6, `bar-below-brace`: the rear-bay member length rule applied to it (40 src px by the main loop's round 6 decision; 55 for the others). |
| `top_edge` | object | Revision 7, `hoop-column`: the column's top edge it starts with, `{pts, polarity}` (the main loop's measured points, src px, and the polarity for `member_edge.py`: bright above, dark below, for the drawn leftward direction). |
| `rim_low_end` | object | Revision 7, `rw-rim-seen`: its free end cut back to the arc's lowest point, `{free_end, end_before, len_before, to_tyre_before, to_tyre_start_before, cut_src_px, lowest_point, end_after, len_after, to_tyre_after, to_tyre_start_after}` (src px; `free_end` is in the arc's order before the drawing order flips it). |

Since revision 5 the records `resnap`, `smoothed`, `letter_clearance` (with `shift_runs`), `clear_ends`, `rim_cut`, `after`,
`convention`, `trimmed_start_px` and `extended_start_to_y` listed above are written into `strokes.json` too (before, only
`provenance.json` held them). The engine's build ignores them.

## `out/provenance.json`

SHA256 of the photo, every input and tool, the imported `trace_lines.py` / `np_cv2.py` and
`strokes.json`; seed; counts per class; the statement of what is traced, fitted, derived and
convention; the authored guides; rim fits; hatch patch counts; the registration summary; the
features left out and why; every gate result, including each stroke the gates rejected.

## Gates (build_art.py; revision 1 additions marked R1, revision 2 R2, revision 3 R3, revision 4 R4, revision 5 R5, revision 6 R6, revision 7 R7)

Rejecting gates (the stroke is dropped and recorded under `gates.rejected`):

- **Length:** any non-hatch, non-glyph stroke under 40 src px.
- **Car mask:** a stroke whose arc-length midpoint lies more than 10 src px outside `inputs/car-mask.json`.
- **Registration:** a traced line stroke must have at least 80 % of its 2-px samples within 2 src px of a measured edge (valley or ridge for tubes). The measure is independent of the snap: along each sample's normal (+-4 src px) it takes the nearest local maximum of the photo's edge response above an absolute floor (edge 4.0, valley/ridge 2.0, about the 10th percentile of responses on known edges). A failing stroke keeps its longest well-registered run (>= 40 src px, >= 90 % within 2 px) or is rejected. P1 silhouette strokes are never trimmed. PEN_SPEC 16.2's stricter numbers (95 % within 1 px, median <= 0.5) are reported per stroke, not enforced.

Failing gates (the build exits non-zero):

- Deny-listed words in ids and (R1) in member ids; deny-listed inventory features (names, logos, Hoosier, glints, rear clutter, the stalk, not-seen parts).
- Every stroke has a provenance kind.
- Glyphs: every sample within 1 src px of the medial axis; at most 2 strokes per letter; i-dots on a measured bright peak; (R1) every free end within 1 src px of the ink end minus half the stroke width.
- (R1) Helmet: no `visor-lower`; `visor-brow` starts within 2 src px of the helmet outline.
- (R1) Driver: D and T at most 4 named strokes, P at most 2; no closed driver stroke. (R5: D and T draw 3, P draws 1; see below.)
- (R1) P1 order: the helmet after the hoop arch, column and brace.
- (R1) Rear frame: every open stroke's ends within 4 src px of another drawn line of its class (a closed one within 4 src px along its outline); at most 2 strokes with half or more of their length within 25 deg of horizontal; D and T at most 4 strokes, P at most 3; tubes straight with the snapped edge within 1 src px of the line.
- (R1, R3) Shadows: open (never closed); no nose shadow in any class (R3); `shadow-ground-rear` in P2 `rear-wheel`, FORM or DETAIL tier, straight after `rw-rim-fit`, at most 60 % of the old 192.3 src px loop (R3); P4 empty (R3).
- (R2) Far nose silhouette: per src px column of x 1205-1295 where the far stripe exists (from x 1207), the drawn `nose-loop` lies within 2 src px of the critic's boundary (the first row from the asphalt where b-r, Gaussian sigma 1, exceeds 12, interpolated), and is nearer that boundary than the decal top below it (the largest luminance step 2-15 src px under the boundary). Also measured, not enforced, on `nose-gesture`.
- (R2) Hoop: `hoop-leg-arch` exists in every class as one stroke with its corners within 2.5 src px of (1418.5, 484) and (1427, 484); `hoop-leg` and `hoop-arch` are not drawn.
- (R2) Dropped: `stripe-far-band`, `pale-strip-upper`, `pale-strip-lower`, `rear-box`, `beam-strut`, `beam-lower-post`, `pink-sleeve`, `shadow-ground-front-short` are not drawn; `top-plate` and `far-front-crown` are not drawn at P; `lens-housing-a` does not reach past x 1478 (it is replaced by `lens-housing-top`).
- (R2) Nose-top 219: exactly the numerals 2, 1, 9 (the glyph gates apply to them); since R5 at class D only.
- (R3, replaces R2's rear-bay rule) Rear bay (area `rear-bay`): each member straight (snapped edge within 1 src px of the line), at least 55 src px, at least 0.90 of its samples within 2 src px of a measured edge, and at least one end within 6 src px of a drawn line of its class or of the rear tyre; at most 2 near-horizontal members; no two within 8 deg of parallel; none at P. The target counts (D 3-5, T 2-3) are reported (`rear_bay.<cls>.meets_target`), not enforced. Features with `hold` are traced, measured with the same rule and set aside (`rear_bay.held`).
- (R3) Coaming tube: `rail`'s top line and `rail-lower` within 1 src px of at least 95 % of the measured top / bottom edge columns and within 1.5 of all; both straight within 0.5 src px; their spacing 4-5.5 src px over x 1372-1524 (`gates.tube`).
- (R3) Glyph coverage: every ridge pixel of every numeral and letter (distance-transform ridge of the touched letter components, 1x, clipped to the plate polygons) within 2.5 src px of its group's strokes, except inside the front tyre's silhouette (+2 src px: the side-plate 2's base) (`gates.glyph_cover`).
- (R3) Far silhouette smoothing: `nose-loop` within 2.0 src px of the b-r boundary (x 1207-1300), of the traced line at the plate corner and elsewhere; the plate-corner step spread over at least 24 src px (width of excess slope over the nose edge's own slope, 0.05 threshold); inflections between x 1190 and 1305 at least 20 src px apart.
- (R3) Rim fits: each `*-rim-fit` at least 1 src px from the sidewall letter pixels outside its 8 src px end zones (the junctions with the seen arcs; what is left there is reported).
- (R3) `far-front-crown` is P2, D and T only (R5: DETAIL tier; it was FORM; R6: D only); `fw-lit-arm` is never drawn.
- (R4, replaces R2's one-stroke hoop) Hoop: `hoop-leg-arch` (P1, every class) is the arch alone (R6: it now starts with the pink sleeve's right edge, from the column's top into the arch's right end), ending within 3 src px of (1427.8, 483.9) and within 1 src px of `leg-block`'s drawn top line, with nothing left of x 1426; `leg-block` (P2 FORM, every class) has its corner within 2.5 src px of (1417.9, 484.1) and its top line runs at least 5 src px past the leg's foot on both sides (`gates.hoop`).
- (R4) Jog: no non-glyph stroke has two opposite turns of 60 deg or more less than 12 src px apart (turn = heading change between the chords 4 src px behind and ahead of a sample at 0.5 src px; turns are local extremes of |turn| >= 60). Glyph strokes are measured and reported (`gates.jog_glyphs`), not enforced; none has a jog today.
- (R4) Rims: no `*-rim-seen` / `*-rim-fit` sample within 4.5 src px of its tyre's drawn outline (`gates.rim_tyre`); `far-front-crown`'s ends at least 2 src px from `nose-loop` (`gates.clear_ends`).
- (R4, changes R3's rear-bay extras) Rear bay: a member is connected by its own end (within 6 src px of a drawn line or the rear tyre) or by a T (another drawn line's end within 6 src px of it; reported as `tees`); at most 3 near-horizontal members, each connected; two members within 8 deg of parallel only when at least 20 src px apart over their common x span.
- (R5) Cross gate (`gates.cross`): no two non-glyph line strokes of a class (tiers c, y, f, d) cross to form a '+' or an 'X' unless the photo shows a real crossing there (`REAL_CROSSINGS`, empty). A cross: chord angle (+-3 src px) >= 25 deg, each of the four arms runs on >= 3 src px past the crossing, and each arm's point 5 src px out lies >= 1.5 src px from the other line. A line that runs on along the other (the top plate's corners on the stripe edge they share, the side plate's lower edge along the front tyre) is a shared-edge junction; those and the T's are reported (`overlaps_or_tees`).
- (R5) Rear bay: `post-below-beam` is not drawn (held); D draws 3-5 members. `bar-below-brace`'s right end lies within 1.5 src px of x 1631.5, where the bar's top edge ends (measured; `gates.bar_end`).
- (R5) Driver: `torso-edge` and `sleeve-band` are not drawn as strokes of their own; `sleeve-torso` (D, T) is one stroke with no corner (`gates.driver_r5`: its largest heading turn over 4 src px chords near the old join); class P draws `collar` only.
- (R5) `pale-panel` ends within 1 src px of `brace-inner` (a T).
- (R5) `amber-lens` is open, its gap 10-15 % of the traced loop's length.
- (R5) `nose-loop` ends 8-12 src px below `nose-underside`'s start.
- (R5) `far-front-crown`: at least 1 CSS px of white between its ink and `nose-loop`'s at both ends at 1440, 1280 (D) and 768 (T), untapered, at the page's CSS px per src px and the spec weights (`gates.crown_gap`).
- (R5) Rim fits: every rise or fall of 0.5 src px or more in the lettering shift spans at least 12 src px (`gates.rim_blend`: `[rise|fall, from, to, length, height, max slope]`); farther than 8 src px from a junction with its seen arc the final fit lies at least 1 src px from the letters (`gates.rim_letters_by_band`, the R3 rule's old coverage); every seen/fit joint turns at most 1 deg (`gates.rim_junctions`).
- (R6) `diag-tube` (D, T, P): one straight line with its ends within 0.3 src px of (1448.3, 474.0) and (1478.0, 533.0); on its own edge (`member_edge.py`, polarity tube-dark / grass-bright, nearest and strongest pick) at least 0.90 of the visible samples within 2 src px (the red block's span, y 491-503, reported apart).
- (R6) `bar-below-brace` (D, T): every point within 0.1 src px of y = -0.2263 x + 1036.16; at least 40 src px; generic registration and own-edge (nearest pick, the brace's span x 1602-1612 left out) at least 0.90 within 2 src px; the brace's end within 1 src px of it. Its right end, as drawn (art end + the blunt run-on), stays within 1.5 src px of x 1631.5 (R5 `bar_end`). Rear-bay rule: length 40 for it (`rb_min_len`), 55 for the others.
- (R6) `top-plate` and `far-front-crown` are class D only.
- (R6) `amber-lens` within 0.75 src px of the unsmoothed R - B = 25 iso-line everywhere.
- (R6) `sleeve-torso`: generic registration at least 0.90 within 2 src px after its 10 src px trim.
- (R6) `hoop-leg-arch` starts within 0.6 src px of (1512.64, 495.60), its leg part (first 22 src px) at least 0.90 within 2 src px of the sleeve's right edge (own polarity), the brace's start within 3 src px of it, no jog.
- (R6) No line (non-glyph, non-hatch) under 40 src px (no short-stroke exception is used).
- (R7, polish round 2026-11-10; the main loop's decisions, agent decisions, not the owner's; `gates.r7`, records `gates.r7_records`) `shadow-ground-rear` is drawn at D, T and P. `rw-rim-seen` ends at its lowest point (within 0.1 src px of the arc's largest y near that end), stays at least 40 src px, and leaves at least 1.5 src px of white between its ink and the rear tyre's at 1440 DPR 1 and 2 (analytic: centre distance to the tyre's ink, its 1 src px run-on included, minus both half widths at the page weights and half a device px of antialiasing per side; 1280, 768 and 390 are reported). `hoop-column` starts within 0.6 src px of `hoop-leg-arch`'s start, has exactly one corner, no jog, and its top-edge part is at least 0.90 within 2 src px of its own edge (`member_edge.py`, nearest). `lens-housing-top` starts at x >= 1448.5, is at least 40 src px and at least 0.90 within 2 src px (generic). The rear-bay candidates measured for a fourth member are recorded (`rear_bay_a3`; none passes, none is added).
- Hatch (R1): box and body patches 0 or at least 5 flicks, class D only, each starting within 6 src px of a drawn line, gaps at most 1.5 x the 10 src px pitch, lengths 25-60; tyre flicks 0 or 4-6, gaps 8.5-11.5 src px, lengths 25-40, starting within 6 src px of the drawn tyre silhouette and at least 30 deg off its tangent, inside the dark mask, never at P.

## Method notes

- Snapping is `trace_lines.snap` (normal profiles, dynamic programming, sub-pixel peaks) with tighter defaults than the 2026-10-27 drawing (`lam 0.7, tol 0.45, prior 0.05`), chosen by the registration measure. A free end is snapped on a guide extended 6 px and cut back, so the smoothing spline does not shorten it.
- Lines stop where an edge disappears: a stroke splits where the absolute edge response stays under half the registration floor (0.3 for the silhouette) for more than 6 src px; leftovers under 12 px are dropped.
- Members join with ink across gaps of 6 src px or less (tangent joins are blended over +-12 px; `corner` joins keep a pen stop); larger gaps lift.
- The rim ellipses are prior-regularised least-squares fits; the arc whose snapped edge is measured is `*-rim-seen` (FORM), the rest `*-rim-fit` (DETAIL, `fit_in_black`). Both are `fitted`.
- Lettering and numerals: Otsu threshold of the ink channel (white letters: min of R, G, B; black numerals: 255 - max), Zhang-Suen at 4x, waypoint-routed skeleton paths, Bezier fit within 0.3 src px. The last e of "College" uses a local threshold 40 levels higher, which separates its bar from its opening. The lap belts (`strap-lap`) use the same method on a redness channel.
- Hatching is drawing convention: "/" flicks at 62 deg that start where their family line crosses a drawn stroke and run into the dark mask (`Hatch.flicks`, `Hatch.tyre_flicks`). Revision 1 ships none: the box takes only 2 flicks at the 10 px pitch, the tyres at most 2 (rear) and 0 (front) from their drawn silhouettes, the panels read as glass and the body hatch cannot start on a drawn line. See `hatch_decision` in `out/provenance.json`.
- Nodes (R1): `meet` in features.py moves a stroke's end along its own end tangent to the nearest crossing with another stroke (its polyline, padded, or its fitted straight line), in the fixed order `MEET_ORDER`; corners are kept and the registration gate measures the result.
- Far nose silhouette (R2): `build_art.resnap_far_span` moves the span x 1204-1306 of `nose-loop` and `nose-gesture` along the outward normal onto a chroma boundary: on b-r (Gaussian sigma 1), from the asphalt side past the first value over 12, to a third of the way from the asphalt level to the stripe peak (sub-sample); offsets median 5, Gaussian 3, ramped in over 3 src px at the plate corner (x 1204, where the real edge steps up 4 src px) and 8 src px at the right end. The generic registration measure counts this span less well than the luminance edges (the chroma edge's gradient, about 3 per src px after the channel preparation, is under its 4.0 floor); the far-silhouette gate measures it.
- Glyph parts (R2): a glyph stroke may be `parts` (glyph-order.json): skeleton routes or straight `line` parts joined by corners, so an acute corner (the nose-top 2's bottom-left, the 1's apex, the 9's stem junction) is one pen stop instead of a retraced thinning spur. `dot_centre: "ink"` puts an i-dot on the intensity-weighted centre of its ink (the 'i' of Olin).
- Rim lip (R2): `rim_arcs(..., lip=...)` refits the front rim ellipse with the lit top lip (the brightest row per column in x 1446-1470, y 799-809) weighted 4x beside the snapped edge samples.
- Feature options (R2): `trim_start` (cut the first N src px after the direction is fixed), `extend_start_to_y` (extend a straight stroke along its own line), `piece_drop` (drop a weak-run piece re-traced by another feature), `piece_xmax`.
- Half-pixel convention (noted in revision 2, not changed): the traced lines sample the photo with `map_coordinates`, so a pixel i is centred on coordinate i; the glyphs and the canvas draw a pixel i over [i, i+1). The traced lines therefore sit about 0.5 src px up and left of where the canvas shows their edge (about 0.35 CSS px at 1440); the glyphs do not.
- Glyph ends (R1): `glyphs.fit_ends` extends (straight along the end tangent) or trims each free end to the ink end minus half the stroke width (median distance transform along the stroke), measured along the end tangent on the Otsu letter mask.
- Coaming tube (R3): `build_art.tube_edges` measures the tube per src px column (luminance, Gaussian 0.7): the bottom edge by the truth critic's measure (the last row >= 90 with near-black 3-5 rows below, half that level going down), the top edge where the area above is darker than the tube (half level between the tube's peak and the darkest of the 5 rows above; columns where the suit above is brighter are not measured); robust straight fits. A feature member `{"tube_edge": "top"|"bottom"}` is that fitted line (x 1372 to the column).
- Far silhouette smoothing (R3, drawing convention): `build_art.smooth_far_silhouette` replaces x 1151-1344 of `nose-loop`'s far edge by the curve of least bending (squared second differences per src px column; `scipy.optimize.lsq_linear`, bounded) within 1.6 src px of the b-r boundary, 2.0 of the traced line at the plate corner and 1.0 elsewhere, pinned at both ends; the nose gesture takes the same curve. Beziers within 0.15 src px.
- Rim fits off the lettering (R3): `build_art.letter_clearance` moves each `*-rim-fit` inward along the ellipse normal where it is closer than 1 src px to a letter pixel (luminance over 70 in a 4x crop, inside the tyre silhouette's ellipse fit by 2 src px, outside the rim ellipse); the shift is widened, smoothed, never below the need, and zero over 8 src px at each end.
- Glyph parts (R3): a part with `"smooth": true` joins the previous part without a corner (the side-plate 1's lead-in on its flag tip).
- Held features (R3): `hold: "<why>"` in features.py traces, measures and gates a feature but leaves it out of strokes.json (`--ship-held` draws them in a comparison build).
- Hoop (R4): the P1 contour is the arch, authored from its right end over the top and down the leg's left edge to the leg's foot, then run on (`meet` e, 1.98 src px) to `leg-block`. `leg-block` is two straight members joined at a corner: the block's top line (edge snap r 1.5 on a guide from (1437, 486.8) to (1417.9, 484.1): the lit top face left of the leg, the lower side of a faint light line across the leg's foot) and the block's outer edge (inventory `left-leg-shroud-outer`).
- Rim cut (R4): `rim_cut` walks the fit arc from its junction with the seen arc and ends it at the last supported sample before the first stretch of more than 6 src px with no measured edge within 2 src px (registration measure at 1 src px); every rim arc is then cut back to 4.5 src px from its tyre's drawn outline. A cut fit has no letter-clearance end zone at its free end.
- Ends clear of a line (R4): `clear_ends: {from, gap}` in features.py trims both ends of a stroke until each lies at least `gap` src px from the `from` stroke (after the meets).
- Rear bay (R4): `bar-below-brace` is the dark bar's top edge under the brace (edge snap r 2, straight; R6: a set straight line on the beam's top edge, drawn left to right); the brace's end and the post's top run on to it (`meet`). `rear-tube-level`, `lower-rail-top` and the bar are pinned so their free ends are their ends (lift-off taper).
- Free-end direction (R4): a stroke with one free end is pinned to end there, so the engine's lift-off taper (to 0.15) fades it instead of a landing (critic A3). R6: the rear bay's free ends are blunt instead (see Blunt ends).
- Trims (R5): `trim_at: [{to, max}]` in features.py: where the stroke crosses the drawn line `to` within `max` src px of one of its ends, that end is cut at the crossing (`build_art.trim_at`, after the meets). `end_below: {of, dy}`: the stroke ends where, walking back from its end, it first rises to `dy` src px below the start of `of` (`build_art.trim_end_below`, re-fitted within 0.15 src px so the smoothed far span is unchanged). `open_gap: {frac, at}`: a closed traced loop is drawn open, with a gap of `frac` of its length centred on the loop point nearest `at`.
- Lettering offset blend (R5): `letter_clearance` takes the upper envelope of the inward shift under a raised-cosine taper of half-width `BLEND_W` = 24 src px (`taper_envelope`; at 12 the peak slope stayed 0.21 src px per src px, now about 0.1, 0.27 in revision 4), so every rise or fall of 0.5 src px or more spans at least `BLEND` = 12 src px, and ramps it in at a junction with the seen arc by smoothstep over `END_ZONE` = 13 src px (8 src px straight before; zero slope at the joint).
- Rim joints (R5): `match_junctions` turns the Bezier handles of a rim's seen arc and fit arc onto the fitted ellipse's own tangent where they meet (lengths kept), so the joint has no kink (the front rim's top joint turned 7.4 deg, its bottom joint 6.5 deg, the rear 3.4 deg; `gates.rim_junctions`, `turn_after` 0).
- Arm (R5): `sleeve-torso` is the members `sleeve-band` (reversed) and `torso-edge` (reversed: its guide runs up from (1402, 680)) assembled into one stroke: their 1.6 src px gap is joined with ink and blended over +-12 src px, so the old V-notch and the 17 deg kink are gone. R6: its first 10 src px (the right-end downturn) are cut (`trim_start`).
- Set lines (R6): a member `G([[x0, y0], [x1, y1]], nosnap=True, straight=True)` is drawn exactly as given, not snapped: `diag-tube` and `bar-below-brace` (the main loop's coordinates from the truth critic's per-row / per-column edge fits; this build refits each with `member_edge.fit_edge_line` and records how close they agree in provenance `revision_6`), and the first member of `hoop-leg-arch`. These replace R4's edge-snapped bar and the inventory-guide diag-tube, which the generic measure passed although they followed the wrong edges.
- Iso-line member (R6): `{"iso": {level, centre, sigma, step_deg, smooth, rmax}}` is the closed `level` iso-line of R - B (Gaussian `sigma`) found on rays from `centre` every `step_deg` and smoothed over `smooth` samples (`build_art.iso_member`): `amber-lens`, on the amber's own colour boundary instead of the luminance snap that ran on the bezel below it.
- Blunt ends (R6): `blunt: ["s"|"e"]` on a pinned feature (`build_art.apply_blunt`, after the meets and trims): that end loses `BLUNT_PRE` = 1 src px and gets its `joined` bit, so the engine draws it at full width (no lift-off taper) and its 1 src px run-on lands on the measured end. It supersedes R4's free-end lift-off for the three rear-bay ends.
- Hoop leg (R6): `hoop-leg-arch` starts at the column's top on the pink sleeve's right edge (a set straight line through per-row edge measurements) and is joined with ink, blended over +-12 src px, into the arch's right end; the arch is unchanged from there (R4). The sleeve's left edge was measured and not used (no line on it joins a drawn member; provenance `revision_6.pink_sleeve`).
- Class T (R6): `top-plate` and `far-front-crown` are D only.
- Corner at an intersection (R7): `corner_x: true` on a straight member that follows a member that is not straight (a set polyline) joins them at the point where the straight member's line meets the previous member's last 3 src px chord (`build_art.assemble`): one corner (one pen stop) at the true corner instead of a short link and a second stop. `hoop-column`: the column's measured top edge (from the leg's end) into its left edge at about (1494.1, 497.6).
- Rim low end (R7): `build_art.rim_low_end` cuts the seen arc's free end (the end that is not its junction with the fit arc) back to the arc's lowest point within 15 src px of that end (`RIM_LOW_END`: the rear rim only), before the lettering clearance and the junction match. The cut part is a true edge; the curl up toward the tyre's start read as a hook (both round 6 critics).
- Rear-bay fourth member (R7, the feel critic's A3): every candidate was measured (`releases/hero-pen-20261110/polish/tools/baycand.py`, records `REAR_BAY_CANDIDATES_R7` in build_art.py and provenance `revision_7.rear_bay_a3`); none passes the existing gates, so none is drawn.

## The engine and its build (`engine/`, `test/`)

Node: `C:/Users/oc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe`; no npm packages.

```
node engine/build.cjs [--in out/strokes.json] [--out out/build] [--gate fail|warn|drop] [--order input|build]
                      [--page <dir> [--base <rev|file>] [--site <label>]] [--check <index.html>] [--no-cuts] [--no-ending]
                      [--no-near-wheels] [--accents] [--quiet]
node engine/pilot-to-strokes.cjs <pilot pen-data.json> <strokes.json>     # the R2 pilot in this shape
node --test test/engine.test.cjs                                          # unit tests
node test/serve.cjs <port> <overlayDir>                                   # git HEAD tree + overlay (test pages)
node test/pen-checks.cjs --url <page> --w 1440 --h 900 --dpr 1 [--mobile] [--cpu 4] [--loads 10] [--input 3] [--back 1] [--resize 1] [--fold 1] [--nav 1] [--vloads 5] [--shots] --out <dir> --tag <name>
node test/bgtab-check.cjs <page> [forwardAfterMs] [out.json]              # background tab, raw CDP
```

**What the build reads from `out/strokes.json`.** Per stroke: `id`, `phase`, `area`, `tier`, `kind`, `classes`
(or `mask`), `prov`, `members`, `pinned`, `burst` (or `group`/`patch`/`word`), `joined`, `cut`, `pts`, `segs`,
`corners` (into `segs` when `segs` is given, else into `pts`), optional `word` and `letter` for glyphs (otherwise
taken from the id `<word>-<NN>-<char>[-2|-3|-dot]`, e.g. `olin-03-i-dot`; numerals are tier `n`). Top level: `car_box`, `seed`, `ordered` (or an
`order_note` saying "drawing order": the list is kept as the drawing order; otherwise the build orders as PEN_SPEC
4), `carMask`, optional `areaOrder`. Everything else is ignored.

**Build steps.** (1) Gates: under 40 src px (non-hatch, non-glyph); denied id words and `fw-lit-arm`; denied
members; provenance; car-mask midpoint over 10 src px outside; a hatch flick (not a tyre arc) starting over 6 src px
from a drawn line; more than 2 ground streaks. (1b) The ending (revision 2, below; `--no-ending` turns it off). (2) Encode: `segs` quantised to 0.5 src px when the decoded path
stays within 0.5 src px of `pts` (two-sided), else a Schneider fit at the first tolerance that does; `|` at corners.
(3) Solve one schedule per class (`engine/solve.cjs`) with the engine's own motion: PEN_SPEC 5 plus the critic's
fixes (speed ramps from hand time over the first 300 ms of P2 with a 0.18 cw/frame cap there for strokes of 0.4 cw
or more; a beat whenever the next start is over 0.12 cw from the pen or the area/patch changes; every 16.67 ms
window at most 4 ends, 6 in P4, 0.40 cw of ink and all ink within 0.25 cw of the window's first inked point; whole
ms with beats kept; no TEMPO). (4) Check every class exactly; over the last-ink limit, apply `cut` steps (D, T: 1-5;
P: 1, 2, 3, 5) — the P5 accents are dropped at every class (revision 1). (5) Write
`hero-pen-block.html` (data block + minified engine), `data.txt`, `engine.min.js`, `build.json` (index with
per-class start and duration, checks, gates, sizes, hashes). `--page` builds a test page from the R1 index.html
(`git show <base>:index.html`, `--base <rev|file>`, default HEAD, 9af034df or later; never the working tree); `--check`
fails unless a page holds exactly this block and the page invariants of revision 6 hold.

**Data block** (PEN_SPEC 11): `HP1 2200 1238 <car box> <seed>`, one line per stroke in drawing order
`<tier><phase><mask><flags> x0 y0 dx1 dy1 dx2 dy2 dx3 dy3 [|] ...` (0.5 src px, relative to the segment start;
`flags`: 1 start joined, 2 end joined, 4 ghost pairing: the k-th flagged GUIDE line of a class retires 150 ms after
the k-th flagged non-guide line, its rim, has ended),
then `T P|T|D gap dur ...` (whole ms; gap from the previous end, pauses included). Hash = FNV-1a 32 of the class's
lines joined by `\n`, `\n`, and its schedule line.

**Runtime** (`engine/engine.js`, inlined minified after the data block; the region between `//@core-start` and
`//@core-end` is evaluated by the build, so the solver uses the page's motion): three canvases GUIDE/SHADE/INK, one
pen, pen clock min(dt, 50 ms), only new tapered segments per frame, minimum jerk per submovement on the two-thirds
power-law arc, corner stops, PEN_SPEC 7 weights and colours with the device-pixel floor and `destination-over`, the
develop and per-layer exit, t0 rule (FCP + load 140 ms / FCP + 300 ms, car half on screen), input settles in 160 ms
without fast-forward, scroll is not intent (IntersectionObserver settle), wall limit, 11 s ceiling, resize replay,
`contextlost`, wait for first visible, bfcache teardown, no sessionStorage. `window.__heroDraw` exposes `state cls n
t0 fcp loadAt linesAt penT lastInk devStart decodedAt doneAt settledBy skipped quick schedule hash frame` and the
test hooks `len ph tier gr geo at(i, tau)` (`gr[i]`: for a ghost guide, the pen time its rim line ends, else -1).

**Revision 1** (critics of the R3 films; constants in `engine/solve.cjs` `K`, checks in `checkClass` and
`test/pen-checks.cjs`):

- P0 lay-in in 250 ms: 70 ms per guide (more only if a guide's length needs it at 0.25 cw per frame), 20 ms lifts,
  60 ms to the first contour (A[0] 0.15 -> 0.25; PAUSE[1] 100 -> 30, plus the 30 ms beat). The GUIDE tier floors at
  1 device px in `#a9b1ba` without the mix toward white (mixed, it rendered at level 201-215 at DPR 1).
- Numerals (tier `n`): at least 4 frames (67 ms) each, 30 ms lift between the digits of one number.
- Lettering: at most one letter (or i-dot) ends in any 16.67 ms window (solved 19 ms apart, checked >= 16.67 ms);
  the first word gets 34 ms per letter, shared by its strokes by length; an i-dot starts >= 17 ms after its word.
- Class P: non-hatch strokes of 0.05 cw or more last >= 2 frames in P3 and in the P2 `driver` area
  (`K.P_FLOOR_SCOPE = 'named'`). The literal rule on every P stroke (`'all'`) puts P's last ink at 3991 ms, over 3.5 s.
- The P5 accents are dropped at every class.
- The time-lapse never runs slower than `K.S_MIN` = 16 in P2-P4: a phase with few strokes is no longer stretched to
  fill its budget (P4 ran at S 5-8 against 19-35 in P2 and P3).
- Start rule 3 tests the on-screen share `G.share` (the old code tested `G.vis`, which was never set, so the quick
  reveal never fired). `pen-checks --fold 1` loads once scrolled past the car before t0 and once in a short viewport.
- `build.json` `classes.<c>.glyphs` reports the numerals, letter-end gaps, letters ending per frame, i-dot gaps and
  the lettering span; `classes.<c>.p0Ms` the lay-in length.

**Revision 2** (critics of the revision 1 films; constants in `engine/solve.cjs` `K`, the reorder in `build.cjs` `ending()`):

- Ghost rim loops: `ghost-front-rim` and `ghost-rear-rim` retire over 150 ms once `fw-rim-fit` / `rw-rim-fit` have
  inked (`GHOSTS` in build.cjs, flag bit 4). engine.js redraws the GUIDE canvas each frame of the retire with the
  loop mixed toward white over the opaque veil, then without it. The nose gesture stays until the develop, as before.
  Both loops are convention strokes; no traced line changes. `build.json` `ghosts` gives each loop's rim end, retire
  end and the develop start per class.
- Ending: the payoff is the last ink (lettering at D, the side 219 at T and P), then the develop (devStart = last ink
  - 150 ms, unchanged). The build moves every P3 line into P2: nose lines into `nose-top` (after its first stroke,
  where they add the least pen travel; today `stripe-far-band`), rear-frame tubes right after `box` (`rear-box`,
  `beam-strut`, `beam-lower-post`), any other P3 line to the end of P2. P4 follows P2 as one left-to-right sweep (areas
  by their leftmost point, every shadow edge drawn left to right: `shadow-ground-front`, then `shadow-ground-rear`),
  then any kept P5 accent, then P3 (numerals, lettering). The phases run P0 P1 P2 P4 (P5) P3 (`K.PHASE_RANK`); the
  solver walks runs of one phase in data order, each with its phase's constants. `build.json` `ending` lists what moved
  and what was flipped; `classes.<c>` gives `phaseSequence`, `lastStroke`, `devStart`, `otherInkAfterDevStart`.
- SHADE edges (tier h, not hatch): peak advance <= 0.12 cw per frame, >= 6 frames from 0.3 cw, else >= 4 frames.
  `shadow-ground-front` at D: 325 src px in 102 ms (was 47 ms); the 180 src px T version was not put at D.
- Lettering: each letter (an i-dot is its own unit) lasts clamp(34 ms x sqrt(path / 25 src px), 25, 50) ms, shared by
  its strokes by length, at least one frame for a glyph stroke of 15 src px or more (`lx`, set by the build, not
  scaled by S); a 40 ms lift before a new word, 70 ms at the line break (a word that starts left of the previous word;
  `wl`). The revision 1 first-word floor is gone. `classes.D.glyphs.letters` and `wordLifts` report it.
- P1: strokes under 0.10 cw take 4 frames (67 ms): `hoop-leg`, `far-front-crown`.
- Accents: `--accents` keeps `acc-front-tyre-lower-right` and `acc-rear-tyre-lower` at D and T, drawn after the shadows
  and before P3 (>= 4 frames each); a class over its limit drops them before any cut-order step. Off by default: with
  them D's last ink is 4465 ms (> 4400) and the build drops them at D, and the critic's condition was to skip them then.
- (Superseded in revision 3: devStart = last ink - 150 ms, the 25-50 ms letter clamp and the 40/70 ms word lifts.)
- The minifier inlines numeric SCREAMING_CASE constants declared alone on a line and writes `true`/`false` as
  `!0`/`!1`. The engine was trimmed (no early returns in `ease`, the develop without its `d0 < 0` branches, the settle
  reason passed to `settle`, a local boot time) so the ghost code fits under 6 KB br3.

**Revision 3** (critics of the revision 2 films and the main loop's decisions of 2026-11-07; constants in
`engine/solve.cjs` `K`, the develop in `engine/engine.js`):

- The finished drawing is seen whole: in every class the develop starts `DEV_GAP` = 100 ms AFTER last ink (engine.js
  `want = last + DEV_GAP`; solve.cjs `res.devStart = lastInk + K.DEV_GAP`). It was last ink - 150 ms, which put the
  last numerals under the develop. `build.json` `classes.<c>` gives `devStart`, `photoInMs` (devStart + 1000 ms of
  develop, from t0), `inkAfterDevStart` (always empty now) and `target` (D: last ink <= 4100 ms, photo in <= 5200 ms;
  T 4000; P 3500).
- An empty phase is no phase: the solver walks runs of phases that have strokes, so a class without P4 has no P4
  pause, beat or gap and P2 flows into P3 (`classes.<c>.phaseJoins`: [from, to, ms] at each phase change). The art's
  revision 3 drops P4 at D and T (critic items A2, A3); until it lands, `releases/.../r3/engine/rev3-inputs/
  strokes-noP4.json` (the art without its P4 lines) stands in for it in the tests.
- P2 FORM and DETAIL lines (tier f or d, not glyphs) of 0.15 cw (124 src px) or more last >= 2 frames, and no two of
  them end within 2 frames (33.3 ms) of each other: the later one is drawn longer (solved >= 34.5 ms apart, checked
  > 33.33). `classes.<c>.p2Long`.
- A numeral that starts a new number after another number's last digit waits >= 40 ms (`NUM_WORD_LIFT`; at T the
  side 219 -> nose-top 219 lift was the 17 ms beat). Digits of one number keep 30 ms.
- Lettering (E3, applied because D ran over 4.1 s): each letter clamp(25 ms x sqrt(path / 25 src px), 20, 40) ms,
  word lift 30 ms, line lift 50 ms; still >= 1 frame for a glyph stroke of 15 src px or more and one letter end per
  frame. D lettering 1100 -> 844 ms. The critic's clamp and lifts alone gave 1016 ms; the scale 34 -> 25 is this
  build's addition to reach <= 850.
- `test/pen-checks.cjs` (E6): the determinism samples are taken where no stroke moves: the finished drawing in the
  100 ms hold after last ink (`devPixelDiff`, `finalSampled`), and the longest lift between two P3 strokes
  (`liftPixelDiff`; at D the College -> of line break). New verdicts: `devAfterLastInkOk` (runtime devStart >= last
  ink + 100 ms of pen time), `p2LongOk`.
- Not changed: the order of the payoff (lettering, then the nose-top 219 last at D); the 50 ms P3 phase pause after P2.

**Revision 4** (critics of the revision 3 films and the main loop's decisions of 2026-11-07; motion in
`engine/engine.js` `decodeLine`/`flat`/`posAt`, constants in `engine/solve.cjs` `K`, checks in `checkClass`
(`classes.<c>.rev4`) and `test/pen-checks.cjs` (`rev4Ok`)):

- Numerals (tier `n`): each submovement runs on plain arc length (no two-thirds warp) with the stroke's time shared
  by length, and is flattened: smoothstep speed ramps over its first and last 20 % of time, a plateau between (peak
  1.25 x mean speed instead of minimum jerk's 1.875 x), at rest at its ends, so corners still stop. Checked: peak
  advance <= 35 % of the stroke's length in any 16.67 ms window and >= 3 frames each advancing >= 5 % of it, at every
  frame phase (`NUM_ADV`, `NUM_GROW`). D and T keep 67 ms per numeral (peak 31 %); class P gets 100 ms
  (`NUM_DUR_P`), more if a submovement would get under 2 frames (side 9: 111 ms, bowl 78 ms, tail 34 ms). Lettering
  keeps the revision 3 letter clamp (20-40 ms per letter): the 35 % cap is not applied to letters.
- E1: a closed loop (non-glyph line, ends within max(3, 5 % of length) src px) of 60 src px or more lasts >= 2 frames
  (`amber-lens` 5 -> 34 ms at D and T, 1 -> 34 ms at P; `top-plate`, `side-plate` already did).
- E2: class P, phase P2: every non-hatch stroke of 50 src px or more lasts >= 1 frame.
- E3: a stroke that continues another (join flags end -> start, ends within 3 src px; `continues()`) keeps the tip's
  mean speed across the join: the faster of the two is slowed to the slower one's ms per src px (`fw-rim-seen` 4 ->
  11 ms with `fw-rim-fit` 34 ms at D; `rw-rim-seen` 4 -> 8 ms with `rw-rim-fit` 17 ms). At P, E2 raises the seen
  strokes to 17 ms, so the fits are slowed to match (56 and 36 ms).
- E5: in P2 at most 2 stroke ends inside one area per 16.67 ms window (solved >= 18 ms after the end two before it in
  that area; the global cap of 4 ends per window stays). Because the window caps no longer hold P2's speed near 39,
  the P2 budget at D and T is 830 ms (was 760 / 700), which keeps S at 37 / 34 (revision 3: 39 / 40).
- The build decodes the solver's geometry with each stroke's own tier (it used `d` for all, harmless until the
  numeral motion differed).
- `test/pen-checks.cjs` (E6): the pixel determinism verdicts compare both alpha images dilated by 1 device px (3 x 3
  max, as the critic proposed), then count pixels over 32 levels apart; the exact numbers stay on
  record (`frac`, `devPixelDiffExactOk`, `liftPixelDiffExactOk`). The renderer is not changed for it. Result on the
  revision 4 page: the dilation barely changes the numbers (lift samples 0.13-1.0 % of inked pixels either way, the
  0.5 % bar still fails on most runs), so the differences are not 1 px shifts of an edge. The tolerance stays the
  spec owner's decision.
- The engine is 6.2 KB br3 (the main loop allows 6.5 KB for this round).

**Revision 5** (critics of the revision 4 films and the main loop's round 5 decisions of 2026-11-09; constants in
`engine/solve.cjs` `K` (revision 5 line), checks in `checkClass` (`classes.<c>.rev5`) and `test/pen-checks.cjs`
(`rev5Ok`, `vclockOk`); the overlap and the lettering scale in `engine/build.cjs`). `engine/engine.js` is unchanged
(6227 B br3, the same as revision 4).

- P2 floor: every P2 stroke lasts >= 1 frame at every class (`P2_MS`; revision 4 had it at class P only). With the
  floors the P2 time-lapse is floor-bound (S solves to its 400 cap, as P3 already was): at D the P2 tip speeds are
  2.7-8.6 src px/ms (median 4.1; revision 4: 2.7-18.3, median 7.2), no stroke over the critic's 11 src px/ms. On the
  art's revision 5 (`out/strokes.json` sha256 6b770fd7...): D last ink 4151 ms, photo in 5251 ms (revision 4: 3902 /
  5002), P2 1572-2684 ms (revision 4: 1595-2435); T last ink 2995; P 2781. No lettering cut was needed (scale 1).
- P2 lift: when the next P2 stroke starts more than `P2_LIFT_D` = 50 src px from the pen, the lift is >= `P2_LIFT` =
  17 ms (`phaseTimes1`). `classes.<c>.rev5.lifts` lists them ([from, to, src px, ms]).
- P1 without a metronome (`p1Spread`): each P1 stroke's time is proportional to len^0.6 x (1 + 0.3 x turning), the
  turning in radians measured on points 6 src px apart (`turning`), normalised to the P1 stroke time the old rule gave
  (whole ms, largest remainder; lifts unchanged), never under the stroke's floor: its peak-advance floor (0.12 cw per
  frame, the seen-speed rule) and `P1_FLOOR_MS` = 4 frames. **Spec deviation:** PEN_SPEC row 2 asks for >= 5 frames per
  P1 stroke; with 5 frames the floors already use the whole P1 total and nothing can be redistributed, so the floor is
  4 frames (the value revision 2 already gave strokes under 0.10 cw). Result at D on the art's revision 5: nose-loop
  199, nose-underside 132, rail 77, hoop-leg-arch 67, hoop-column 67, brace 73, rear-tyre 102, front-tyre 105, helmet
  117 ms (revision 4: 218, 132, 83, 83, 84, 83, 94, 95, 86). Most strokes sit on their peak-advance floor, which is
  itself proportional to length; only the tyres and the helmet take time above it. P1 runs 310-1474 ms (nose-loop is
  38 src px shorter in the art's revision 5).
- Joins: a join-flagged end of a line (tiers c y f d a, not a glyph) runs on `OVERLAP` = 1 src px along its own end
  tangent (`overlapJoins`, before encoding; `build.json` `overlap`), so the two round caps overlap. The engine already
  drew no taper on a flagged end (`taper()`: `st.f & 1 ? 1`, `st.f & 2 ? 1`), so nothing changed there. The notch the
  critic saw on the front rim is not a taper: at the bottom joint `fw-rim-fit` ends heading -125 deg and `fw-rim-seen`
  starts heading -116 deg (a 9 deg kink), at the top `fw-rim-seen` ends at -56 deg and `fw-rim-fit` starts at -43 deg
  (13 deg on the art's revision 5, 17 before), and the tier changes there from FORM (0.62) to DETAIL (0.42); the overlap
  does not remove a kink, the art has to.
- Targets: D last ink <= 4200 ms and photo in <= 5300 ms (`TARGET`, `DONE`). Over the target, the build shortens every
  letter alike in 1 % steps (`LETTER_SCALE`, down to `LETTER_SCALE_MIN` 0.7; a glyph stroke of 15 src px or more keeps
  >= 1 frame; never P1), `build.json` `letterScale`.
- An empty phase is no phase (revision 3), so a class without P4 has none.
- Determinism (E6), `test/pen-checks.cjs`: the verdict `vclockOk` comes from a virtual frame clock pass (`--vloads`,
  default 5 loads): `requestAnimationFrame` is wrapped so every real frame's timestamp advances exactly 1000/60 ms (the
  engine's pen clock reads only these timestamps after t0), so every load cuts the strokes into the same frame chunks
  and every sample lands on the same pen time; the three layers are hashed (FNV-1a over alpha) at every sample (about
  17 per load) and must be identical. **Why the wall-clock samples differed by 0.1-3.5 %:** the engine draws each
  frame's new part of a stroke as its own anti-aliased path with round caps, so a stroke drawn in other frame chunks
  overlaps its own anti-aliased edges at other places (and the batching by 0.05 px width steps restarts a path at other
  points). The same strokes at the same pen time therefore differ at the edges of thin lines, where most pixels are
  partial. `--vstep2 15` shows it: a virtual pass with 15 ms frames, compared with the 16.67 ms pass where no stroke
  moves (the lift and the finished drawing), differs by 1.5-1.8 % of inked pixels at 1440 and 1.0-1.3 % at 390 DPR 3, while two passes
  with the same step differ by 0. The wall-clock numbers stay on record (`devPixelDiff`, `liftPixelDiff`) without a
  verdict.
- `releases/.../r3/engine/rev5-film/film.cjs` (a copy of `film-r4/film.cjs`): the webp source frames are captured at
  device px at DPR > 1 (`--webp-scale css` restores CSS px); CSS-scale capture aliased thin lines into a comb at 390 DPR 3.
- `far-front-crown` at tier d: it draws DETAIL (`#505b66`, destination-over) on INK. With the revision 4 art's
  `--crown detail` option (end gaps 2.0-2.2 src px centre to centre, both ends join-flagged) the gaps were not visible
  at any class (alpha between the lines >= 150 of 255 at 1440 DPR 1 and 2, 1280, 768 DPR 2): half the CONTOUR width plus
  half the DETAIL width exceeds the gap. The art's revision 5 draws it with 4.8 src px gaps and no join flags (tapered
  ends): on the revision 5 page the alpha between crown end and nose-loop falls to 0-20 of 255 at 1440 DPR 1 and 2, 1280
  and 768 DPR 2, so the gaps show; destination-over does not cover them (`releases/.../r3/engine/rev5-crown/`).

**Revision 6** (critics of the revision 5 films and the main loop's round 6 decisions of 2026-11-09; the reorder and the
page in `engine/build.cjs` (`nearWheels`, `p2Hops`, `page`, `guardRules`, `pageInvariants`), checks in
`test/pen-checks.cjs` (`navOk`, `failed`, `pass`)). `engine/engine.js` and `engine/solve.cjs` are unchanged (engine
6227 B br3, as in revisions 4 and 5).

- P2 order: the rear-bay tubes are drawn next to the wheels they connect (`NEXT_TO_WHEEL`, after `ending()`):
  `lower-rail-top` right after the front wheel's last P2 stroke (it starts at the front tyre, as authored), then the rear
  wheel, `shadow-ground-rear`, then `rear-tube-level` and `bar-below-brace`, then `brace-inner`, `column-right`, ...,
  `pale-panel`, `visor-brow`, `sleeve-torso`, `collar`, `neck`. Orientation stays as authored; the step is idempotent
  (an art order that already does this moves nothing). `build.json` `nearWheels` gives what moved and each class's P2
  hops before and after. On the art (`out/strokes.json` sha256 896648e6...), class D, the span `fw-rib-2` .. `neck`:
  largest hop 0.370 cw (`fw-rib-2` -> `rw-rim-seen`) -> 0.201 cw (`pale-panel` -> `visor-brow`); pen travel over the span
  2.09 -> 1.51 cw (the feel critic's 1.59 -> 1.10 measured a different span). Class P is unchanged (it draws none of the
  three tubes); its largest P2 hop stays `rw-rim-fit` -> `column-right`, 0.37 cw, with its 17-18 ms lift.
- Kept: the P1 floor of 4 frames (spec deviation from PEN_SPEC row 2's 5 frames, as in revision 5); the develop at last
  ink + 100 ms in every class; no P4 when it is empty; P2 >= 1 frame, lines of 0.15 cw or more >= 2 frames and >= 34.5 ms
  between their ends; the 17 ms P2 lift over 50 src px; the P5 accents dropped.
- Timing (D target last ink <= 4200 ms, photo in <= 5300 ms): the art: D 4151 / 5251 ms (the reorder does not change D's
  last ink; P2 1572-2684 ms), T 2995, P 2781. With the art's two pending refits stood in (`diag-tube` extended to 66.0 src
  px, `bar-below-brace` trimmed to 52 src px; `releases/.../r3/engine/rev6-tools/refit-standin.cjs`, timing only, the art
  owns the geometry): D 4134 / 5234 ms, T 2978, P 2781. No lettering cut (scale 1).
- `--page` works on the R1 index.html (HEAD 9af034df, `?v=refresh-20261107`): the R1 guard is kept as it is (no session
  key; back_forward and a #link other than #top excluded except on a reload, where script#kw-scroll drops the fragment;
  held view-transition arrivals play; a hidden or prerendered tab arms on its first visible; until the engine exists,
  intent or pagehide drops the drawing, 4 s without it drops it); script#kw-scroll stays and the old scroll snippet is no
  longer injected; the inline SVG becomes the three canvases; the deferred `hero-drawing-20261027.js?v=...` tag becomes the
  data block and the inline engine; the guard's comment names the inline pen. The build refuses a pre-R1 page
  (`kw-hero-drawn`) and a guard missing any of the R1 rules (`guardRules`). `--base <rev|file>` picks the base (default
  HEAD). `--check` also verifies `pageInvariants` (block once, one guard with every R1 rule, kw-scroll, no session key, no
  hero script, no SVG, the canvases, data before engine).
- `test/pen-checks.cjs`: the wall-clock pixel-repeat verdicts (`devPixelDiffOk`, `liftPixelDiffOk` and the Exact forms)
  are gone; the samples stay on record; `vclockOk` is the determinism verdict. `--nav 1` checks the R1 arrival rules on
  the page (`navOk`): `#contact` does not draw, its reload drops the fragment and draws at the top, `#top` draws, the
  wordmark from `case-study.html?project=steering` is a held arrival (`__vtBoot.hold` "parsed") and draws.
  `verdict.failed` lists any failed verdict that counts and `verdict.pass` is true when none did.
- Not the engine's: the card drawings wait for the hero's `heroDone` (the critics' E5); that belongs to the index.html
  integration step.
- Results on the revision 6 page (`releases/.../r3/engine/rev6-site/index.html`, built from 9af034df's index.html, served
  on 4822 from tree 9af034df; one Windows machine, headless Chrome, other headless work running, so timings are noisy):
  `verdict.pass` true at 1440x900 DPR 1 CPU x1 and x4, 390x844 DPR 3 x4, 1024x768 DPR 2 and 768x1024 DPR 2 (10 or 5
  loads each, all drew, one hash per class, vclockOk on 5 virtual-clock loads, 0 pixels outside, Back 0 replays with and
  without bfcache, input done in 161-170 ms). 390 x1 passed everything but `navOk` under the first rule, which also
  required `__vtBoot.hold` "parsed" for the wordmark: at 390 the wordmark arrival is not held (hold ""), and it drew; the
  rule now requires the draw only and `navHeld` records whether a held arrival was seen (1440: yes; 390: no, so the held
  path is checked at 1440 only). The background-tab check armed on first visible (`late`) and finished.

**Revision 7** (polish round of 2026-11-10: the main loop's decisions on the round 6 critics' optional polish; every
choice is an agent decision, not the owner's, who has not seen any R3 output; constants in `engine/solve.cjs` `K`,
`hopLift`, checks in `checkClass` (`classes.<c>.rev7.hops`: [phase, from, to, hop cw, lift ms, needed ms]) and
`test/engine.test.cjs` (rev7 tests). `engine/engine.js` and `engine/build.cjs` are unchanged (engine 6227 B br3)):

- E1: inside P2, a hop of more than `P2_HOP_L` = 0.25 cw lifts >= max(`P2_LIFT` 17, `P2_HOP_MS` 90 x hop / cw) ms,
  rounded up to whole ms (`hopLift`: the schedule's whole-ms step floors a gap, so an unrounded 25.7 ms lift became 25
  ms, under the rule; a first build of this round had that). Not the P1 -> P2 join (its 98 ms beat stays). On the art's
  revision 7 only class P has such hops: `fw-tread-edge` -> `rw-rim-seen` (0.286 cw, 26 ms) and `shadow-ground-rear` ->
  `column-right` (0.395 cw, 36 ms; with the art's A1 the old `rw-rim-fit` -> `column-right` hop starts at the shadow's
  end). `shadow-ground-rear` itself at P: 17 ms after `rw-rim-fit`, 1 frame (17 ms) long.
- E2: inside P1, a hop of `P1_HOP_L` = 0.195 cw or more lifts >= `P1_HOP_MS` = 45 ms (was the 30 ms beat). The critic's
  "hops of 0.20-0.26 cw" are the five into `hoop-leg-arch`, the brace (`brace-centre` at P), `rear-tyre`, `front-tyre`
  and `helmet`; the one into `rear-tyre` is 0.1998 cw on the art's end points (0.199 on the solver's geometry, run-ons
  included; D, T) and the one into `brace-centre` 0.197 (0.198; P), so the threshold is 0.195: exactly those five at
  every class (the next shorter P1 hop is 0.115 cw). Not the P0 -> P1 join (60 ms).
- Paid for by `LINE_LIFT` 50 -> 30 ms (the lift before 'of', now a word lift) and `PAUSE[3]` 50 -> 33 ms (the P2 -> P3
  join 67 -> 50 ms with the 17 ms beat).
- Results on the art's revision 7 (`out/strokes.json`, built onto 85467bca's index.html in
  `releases/hero-pen-20261110/polish/site/`): D 87 strokes, last ink 4181 ms, photo in 5281 ms (revision 6: 4134 /
  5234); T 44, 2962 ms (2895); P 35, 2880 ms (2764; 2878 with the first build's floored E1 lifts). P1 310-1549 ms
  (was 310-1474). Joins 60 / 98 / 50 ms at every class. No lettering cut (scale 1), 0 frame violations, 0 locality
  windows over 0.25 cw. Data block 2906 B br3 (2887), engine 6227 B br3 (unchanged; over PEN_SPEC 5.5's 6 KB, within
  the main loop's 6.5 KB allowance since revision 4: `build.json` `budgets.engineOk` is false), page +4827 B br3 over
  85467bca's index.html.
- Pen checks on that page (`test/pen-checks.cjs`, served by `test/serve.cjs` on 4871 from tree 85467bca; one Windows
  machine, headless Chrome): `verdict.pass` true at 1440x900 DPR 1 x1 (10 loads, input 3, back, resize, fold, nav,
  vloads 5) and x4, 390x844 DPR 3 x1 (the same set) and x4, 768x1024 DPR 2 x1 (5 loads): every load drew, one hash per
  class (D f7411680, T d3a2fb08, P fbcd413f, the build's), vclockOk, 0 pixels outside, 0 errors, input settles in
  165-172 ms, Back 0 replays with and without bfcache. One x4 load at 390 had a 56.8 ms rAF gap in P0-P1 (9 of 10 under
  50 ms, PEN_SPEC 16.2's bar). The background-tab check armed on first visible (`late`) and finished. Records:
  `releases/hero-pen-20261110/polish/checks/` (the first build's run, P a264d241: `polish/superseded-floor-lift/`).
- Film (virtual clock, `polish/film/`, a copy of `r3/film-r6/`'s harness) at 1440x900 DPR 2 (D) and 390x844 DPR 3 (P):
  the hero at 7 s equals 85467bca's page within 2 levels (D 0, P at most 2 on 4-7 device px). Full-page captures at 390
  differ below the hero (the cards' 2 px progress tracks, up to 35 levels) between repeated loads of the SAME page
  too (`film/out-repeat/compare.txt`), so that is load-to-load noise of the card section, not the hero.

## Integration into the site (pen-20261110, 2026-11-10)

The integration step put the pen on the site, on top of HEAD 85467bca. Every choice here is an agent decision (the
main loop's or this step's), not the owner's, who has not seen any R3 output.

- `index.html` is the output of `node engine/build.cjs --out <dir> --page <dir> --base <85467bca's index.html> --site
  pen-20261110`, copied as is. `--site <label>` is the shipped form of `--page`: no test STYLE (its rules are now in
  `white-home-20261011.css`), and the `?v=` of `white-home-20261011.css` and `card-drawing-20261027.js` set to the
  label. `node engine/build.cjs --check index.html` passes (block identical, page invariants true). The R1 guard,
  `script#kw-scroll` and the shared head bootstrap are not touched. `build.cjs` reads `engine.js` and the `--check` page
  with CRLF folded to LF, so a Windows checkout (core.autocrlf) builds the same block.
- `engine.js` additions: `window.__heroDraw.arm` (the guard's `data-hero-pen`: `now`, or `late` for a tab first shown
  later) and `armedAt` (when a late arm happened, 0 otherwise), as `hero-drawing-20261027.js` exposed them; and
  `html.hero-draw-inked` with `__heroDraw.inkedAt` once the pen is up for good (last ink laid, the rest skipped, or
  settling). Teardown removes the class with the others. Nothing else in the engine changed; the data block is
  byte-identical to the polish build and the class hashes are unchanged (D f7411680, T d3a2fb08, P fbcd413f).
- `white-home-20261011.css`: the backstops at 9.5 s are now 12 s; `.hero-draw-lines canvas` replaces the svg and path
  rules; the veil failsafe (2.8-3.3 s) and the 3.3 s lines backstop without `hero-draw-js` stay.
- `card-drawing-20261027.js`: the card gate opens at the earliest of `html.hero-draw-inked`, the hero ending
  (`html.hero-draw` gone), less than half of the hero's photo box on screen (`.hero-media`, measured against its height
  or the window's, whichever is smaller), and `HERO_FINAL` 12500 ms (was 10000); `HERO_CEIL` 7500 ms (was 3200).
  `__cardDraw.heroDoneBy` says which: `hero-inked`, `hero`, `hero-offscreen` or `timeout`.
- Sizes (brotli q3): engine 11856 B, 6312 B br3 (6227 before the additions; over PEN_SPEC 5.5's 6 KB, within the main
  loop's 6.5 KB allowance); data block 2906 B br3; `index.html` 70354 B, 22525 B br3 (+4815 B over 85467bca); the
  homepage no longer requests `hero-drawing-20261027.js` (11147 B br3).
- Tests: `tools/hero-tests/hero-pen.test.cjs` replaces `hero-drawing.test.cjs` (block parses, counts, sequential and
  hash-equal schedules, provenance hashes, PEN_SPEC 5.5 limits, and each class in Chrome with the generator's hash and
  schedule). `hero-first-paint.test.cjs` bounds `devStart` to [lastInk - 170, lastInk + 1850];
  `refresh-replay.test.cjs` waits 7.5 s (was 5 s) after showing a background tab, and allows the pen's `linesAt` (a
  frame timestamp) to precede `armedAt` by up to one frame (it checks the arm came after the 3 s hidden period);
  `tools/room-tests/refresh-replay.test.mjs` reads the pen engine instead of `hero-drawing-20261027.js` and pins the
  card gate.
- What ships in git from this folder: the sources (`*.py`, `review_page.cjs`), `inputs/`, `out/strokes.json`,
  `out/provenance.json`, `engine/`, `test/`, this README. What stays local: `out/build/` (the default build output),
  the bilateral-channel cache (`%TEMP%/hero-pen-cache`), `__pycache__/`, and every review render, film and check record
  (under `releases/`, outside the repo).

## Fix r1: a late engine leaves the reveal to the CSS (2026-11-10)

A review found a regression against 85467bca, and this step fixed it. Every choice here is an agent decision, not the
owner's.

- The problem: the inline engine still runs only after the three parser-blocking scripts before it (`script.js`,
  `skills-card-20261012.js`, `exploded.js`). On a slow load it can start after the CSS failsafe has begun to reveal the
  photo (a 500 ms fade from 2.8 s on the veil's own clock). `begin()` then added `html.hero-draw-js`, which replaces
  the veil's animation list, so a photo already shown snapped back to white and the pen drew for another 4-7 s.
  PEN_SPEC 9 ("inline removes the late-script path") assumed an inline engine never runs late.
- The fix (`engine.js`, `begin()`): before it takes the veil over, the engine reads the veil's `hero-draw-failsafe`
  animation (`getAnimations()`). Past `LATE` (2400 ms) on that clock it takes `hero-drawing-20261027.js`'s late path:
  no ink, no `hero-draw-js` or `hero-draw-own`, `__heroDraw.state` `late` with `failsafeAt`, `html.hero-draw-inked` at
  once (no ink will come, so the cards may go). It finishes at 3500 ms on that clock. Intent plays the rest of the fade
  at 3x (`F_DELAY` 2800, `F_FAST` 3) and finishes 187 ms later. A hidden tab, pagehide or leaving still finish at
  once. Without `getAnimations` the clock is the time since the arm, as in the old file. The threshold is the old
  file's `LATE_MS`. An engine that starts at 2.4-2.8 s on that clock (before any fade) also leaves the reveal to the
  CSS, as 85467bca did. The pre-fix tree drew there.
- Not done: moving the data block and the engine above `script.js` (that would only shrink the window, and it needs a
  `build.cjs` placement change and an order check against `script.js`). Under Chrome's Slow 3G preset the engine still
  starts about 2.9 s after the arm, so the hero takes the late path there (CSS reveal, no drawing), as at 85467bca.
- Rebuilt with the same command as the integration (`--page --base <85467bca's index.html> --site pen-20261110`);
  `--check index.html` passes. The data block and the class hashes are unchanged (D f7411680, T d3a2fb08,
  P fbcd413f). The engine is 12262 B, 6460 B br3 (+148 over 6312), within the 6.5 KB allowance and over PEN_SPEC
  5.5's 6 KB. `index.html` is 70760 B, 22681 B br3.
- `white-home-20261011.css`: a comment only (the late engine leaves the failsafe's reveal alone).
- Tests: `tools/room-tests/refresh-replay.test.mjs` pins the late path (constants, the read before the takeover, the
  late branch never touching the veil, the lines or the reveal classes, and the inline copy).
  `tools/hero-tests/hero-pen.test.cjs` runs it in Chrome with `script.js` held back 3850, 3200 and 3000 ms (the last
  with a wheel): the late path is taken, no line is shown, the veil is never opaque again after the photo began to
  show, and it ends on today's DOM.

## Fix r2: line endings, two engine fixes, the phone's rear tyre, the lay-in's rhythm (2026-11-10)

The main loop's decisions on the readiness check and the verifiers' non-blocking notes. Every choice here is an agent
decision, not the owner's, who has not seen any R3 output.

- Line endings: `out/provenance.json` records the SHA256 of each file's bytes as they lie on disk, and 11 files here
  are CRLF on disk: the JSON written with `Path.write_text` (CRLF on Windows: `common.py`'s `dump_json` for
  `out/strokes.json` and `out/provenance.json`, `features.py` for `inputs/features.json`) and sources saved with CRLF
  (`build_art.py`, `trace.py`, `member_edge.py`, `review.py`, `review_page.cjs`, `inputs/glyph-order.json`,
  `inputs/inventory-guides.json`, this README). With `core.autocrlf=true`, `git add` would have stored them as LF and
  9 of the 20 recorded hashes would not have held for the committed files. The site's `.gitattributes` now
  has `tools/hero-pen/** -text`, so this folder is committed and checked out byte for byte. `.gitignore` has
  `/tools/hero-pen/out/build/` (the default build output; the shipped block is in `index.html`).
- Engine, resize (`engine.js` `place()`): it set `el.style.cssText`, which wiped the opacity `setOp()` had set, so a
  resize during the develop or an input settle painted GUIDE and INK at full strength until the next frame. It now
  sets left, top, width and height one by one. Repro at 1440 (12 width steps of 4 px every 30 ms during the develop;
  5 during a settle after a key press): 14 and 8 full-strength repaints before, 0 after
  (`releases/hero-pen-20261110/fix-r2/repro/`).
- Engine, screen scaling (`engine.js` `onFrame`): a devicePixelRatio change without a CSS size change (a window moved to
  a screen with another scaling) did not lay the canvases out again (the ResizeObserver sees CSS sizes only), so the
  lines stayed blurry until done. Each frame after t0 now compares `devicePixelRatio` (capped at 3) with the layout's
  and, if it changed, lays out and replays the ink up to the pen clock. A `(resolution: Ndppx)` media-query listener was
  tried first: under Chrome's emulation (`Emulation.setDeviceMetricsOverride`, scale factor only) the query's value
  changed but no change event fired, so the per-frame read was kept. It needs no listener; it ends with the rAF loop.
  Repro: 1440 DPR 1 -> 2 kept a 594 x 339 INK backing store before, 1188 x 678 after (2 -> 1 and 390 the same way).
- Art (`features.py`, `build_art.py`): class P also draws `rear-tube-level`, the one D/T rear-bay member that touches the
  rear tyre (0.69 src px), at its D/T pen position (after `shadow-ground-rear`). Same stroke and geometry, no new
  tracing. Before, the phone's rear tyre floated free: its nearest drawn line outside the rear wheel was `brace-centre`,
  59.2 src px (18.6 CSS px at 390) away. `bar-below-brace` is not added: it would fail the rear-bay connection rule at P
  (P's `brace-centre` ends 9.1 src px from it, more than 6). `lower-rail-top` is not added: it ends 73 src px from the
  rear tyre. The rear-bay gate allows exactly `rear-tube-level` at P (`FIX_R2_P_BAY`); provenance `fix_r2` and
  `gates.fix_r2_records` record the measures. P: 36 strokes (was 35).
- Clock (`solve.cjs`): inside P0 a hop of more than 0.5 cw lifts at least max(20, 90 x hop / cw) ms, rounded up
  (`P0_HOP_L`, `P0_HOP_MS`; the rear rim to the nose, 0.955 cw, lifts 86 ms, was 20). The three lay-in marks share the
  old 210 ms by length^0.35 x (1 + u1), u1 the stroke's seeded jitter as everywhere else (`p0Spread`, floors kept): 75,
  61 and 74 ms (were 70, 70, 70). Paid for by beats, never the P1 seen hand (its durations and lifts are unchanged):
  `PAUSE[1]` 30 -> 0 (the P0 -> P1 join 60 -> 30 ms, the beat alone) and `PAUSE[2]` 80 -> 60 (the P1 -> P2 join 98 -> 78
  ms). D last ink 4197 ms (photo in 5297), T 2978, P 2919; no lettering cut (scale 1).
- `white-home-20261011.css`: a comment only. The veil's 12 s backstop keeps the start of the veil's first style (Chrome
  keeps the same animation and changes its delay; measured with the engine starting at 1.83 s), the lines' starts when
  they are shown, and the engine's 11 s ceiling counts from the engine's start.
- Sizes (brotli q3): engine 12313 B, 6458 B br3; data block 7690 B, 2907 B br3; `index.html` 70817 B, 22681 B br3.
