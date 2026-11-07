# Hero line drawing ("drawn, then built")

Generates `assets/hero-drawing-20261027/hero-lines.svg`: a stroke-only pen sketch of the
homepage hero photo (`assets/hero-fsae-track-2200.webp`), in that photo's own pixel
coordinates (`viewBox="0 0 2200 1238"`), so it registers on the photo wherever the photo is
shown with the same `object-fit` / `object-position`. The homepage opening animation draws
these strokes, then develops the real photo through them; the hero still ends on the
original photo pixels.

It is a curated tracing, not an edge dump: every stroke starts from a hand-placed guide,
is snapped onto a measured edge of the photo, then smoothed and fitted with cubic Beziers.
It adds no hardware that is not in the photo, and lines stop where an edge disappears into
shadow.

Two stages:

1. **Trace** (`trace_lines.py`): every guide in `guides.json` is snapped onto the photo and
   written to the traced master `traced-lines.svg` (all traced strokes) and its record
   `traced-lines.json` (source photo hash, method, per-stroke edge strength and fit error,
   and the runs that produced it).
2. **Derive** (`inline_hero_svg.cjs`): one run writes the homepage's inline drawing in
   `index.html`, the public `assets/hero-drawing-20261027/hero-lines.svg` (the same `<svg>`,
   only `width`/`height` added to its root) and `assets/hero-drawing-20261027/provenance.json`
   (sha256, size and group counts of that file, the inline markup's sha256, the trace record
   and every derivation step). So the public file is exactly what ships inline.

## Files

| file | role |
| --- | --- |
| `author_guides.py` | The curated stroke list (what is drawn, in what order, with which snapping options). Builds guides from measured edge chains and probed points; writes `guides.json`. |
| `guides.json` | Generated guides (sparse polylines / ellipses) plus the source photo's SHA256. Committed so the SVG can be rebuilt without re-authoring. |
| `chains.py` | Authoring aid: colour-gradient Canny edges linked into labelled chains (`--overlay` draws a labelled crop, `--guide` prints a merged guide). Cached in the system temp folder; detecting them needs OpenCV and scikit-image, reading the cache does not. |
| `trace_lines.py` | Snaps guides onto the photo (normal profiles + dynamic programming), fits smoothing splines / Beziers / ellipses, writes `traced-lines.svg` and `traced-lines.json`. `--only ID,...` traces only those guides (each with a given draw order `o`) and splices them into the existing master, leaving every other stroke's bytes as they were. `--debug DIR` writes overlays (needs OpenCV). |
| `np_cv2.py` | NumPy/SciPy stand-ins for the three OpenCV calls that prepare the tracing channels (`bilateralFilter`, `cvtColor` BGR to Lab, `GaussianBlur`), used when OpenCV is not installed. Re-tracing the 27 guides of 2026-10-27 with it reproduces 21 strokes byte for byte and the other 6 within 0.2 source px (one rounding step). |
| `traced-lines.svg`, `traced-lines.json` | The traced master and its record (not served by the site's pages; the homepage reads the derived copy). |
| `inline_hero_svg.cjs` | Derives the homepage drawing (see below) and writes `index.html`'s `.hero-draw-lines`, the public SVG and `provenance.json` in one run. `--check` fails if any of the three is out of date or a wheel-centre mark is more than 0.5 source px off its rim-ellipse centre; `--print` prints the inline markup. |
| `render_evidence.cjs` | Renders evidence in real Chrome (Playwright): lines alone, lines over the photo, zoomed registration crops, the live homepage at 390x844 and 1440x900, and draw-in frames. Serves this repo from a throwaway local server; changes nothing. |
| `assemble_webp.py` | Turns the frames into animated WebPs. |

`tools/hero-tests/` checks the derived drawing in real Chrome: the precomputed geometry
against Chrome's own measurements, and the three outputs against each other.

## Derivation (inline_hero_svg.cjs)

- The two grass/track-edge strokes (data-o 0.952 / 0.976) are left out: over the white page
  they read as a horizon line, not as an edge of the car.
- A `guide` group is added first: two CAD-style wheel-centre marks (36 source px crosses) on
  the centres of the traced rim ellipses (data-o 0.272 / 0.344). They are construction marks
  derived from the tracing itself and add no hardware; the page retires them as the photo
  starts to develop.
- Ground (tyre-contact) strokes are weighted `data-w` .5 on the homepage (traced at .4).
- The TSAL lamp outline (data-o 0.410) carries `data-min-vw="768"`: it is not drawn on windows
  narrower than 768 px, where it is only a few pixels tall.
- Geometry is precomputed so the page never measures SVG geometry at runtime: every path gets
  `data-len` (total length, source px, 0.1 px) and `data-pts` (21 points at 0, 5, ... 100 % of
  its length, source px rounded to 1 px); the root gets `data-car` (tight bounding box
  x0 y0 x1 y1 of the silhouette and structure strokes). Checked against Chrome's
  `getTotalLength` / `getPointAtLength` / `getBBox` (lengths within 0.05 px, points within
  0.71 px = the rounding, box within 0.05 px).
- Group ids become `data-group`, and the root gets `preserveAspectRatio="none"`
  `focusable="false"` `aria-hidden="true"` (the script sets a viewBox that reproduces the
  photo's `object-fit: cover` at its live `object-position`).

## Strokes added 2026-10-29

Three more real, high-contrast edges, read off zoomed crops of the 2200 px source photo by
the release verifier (guides in source px) and snapped with `trace_lines.py --only
plate-219,fw-far-crown,tsal-lamp` (OpenCV was not installed: `np_cv2.py` prepared the
channels). Each has a given draw order that slots it between the existing strokes without
renumbering them; the 27 strokes of 2026-10-27 keep their bytes.

| id | edge | group | data-w | data-o |
| --- | --- | --- | --- | --- |
| `plate-219` | the white 219 side number plate on the black side pod, including its lower-left edge where the near front tyre occludes it (guide M1410.3 707.0 L1496.2 684.2 L1500.3 748.3 L1454.2 762.5 L1416.3 751.7 Z, corners kept) | detail | .5 | 0.62 |
| `fw-far-crown` | the crown of the far-side front tyre, dark against the grey asphalt above the nose stripe (guide M1124 667 C1134 655 1147 649 1160 648.5 C1168 648.5 1175 650 1180 653) | structure (wheel ink) | .8 | 0.36 |
| `tsal-lamp` | the orange TSAL lamp lens in its black housing on the main hoop (guide: rounded rect x 1448-1484, y 454-469, r 7) | detail | .45 | 0.41 |

Not added, because they are not reliably visible in the photo: the lower body contour
(black body on black shadow; only separable after a strong gamma lift) and the front
wishbones (2-3 px specular glints).

## Rebuild

Python 3.11 with numpy, scipy and pillow (opencv-python-headless and scikit-image for the
chain detection and the debug overlays); Node with Playwright (set `PLAYWRIGHT_MODULE` to its
folder if it is not resolvable as `playwright`).

```sh
cd tools/hero-drawing
python author_guides.py              # only when the stroke list changes -> guides.json
python trace_lines.py                # all guides -> traced-lines.svg + traced-lines.json
python trace_lines.py --only ID,ID   # or: trace only added guides (with "o") into the master
python trace_lines.py --debug <dir> --out <dir>/traced-lines.svg   # experiments + overlays
node inline_hero_svg.cjs             # after any change: index.html + public SVG + provenance
node inline_hero_svg.cjs --check     # all three current, marks on their rim centres
node render_evidence.cjs --out <dir> # evidence renders (default: the public SVG)
python assemble_webp.py <dir>        # draw-<set>.webp from the frames
```

`trace_lines.py` refuses to run if the source photo's SHA256 differs from the one recorded in
`guides.json`: a new hero photo needs new guides.

## SVG contract (for the animator)

- Root: `fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"`;
  no widths, colours, text, fonts or raster. The derived drawing's root also carries
  `data-car`.
- Groups (`data-group` in the derived drawing, `id` in the traced master): `guide`
  (wheel-centre marks, derived drawing only), `silhouette` (car body + driver contour),
  `structure` (wheels, far front tyre crown, roll hoop, brace, rear frame and suspension),
  `detail` (visor, stripe edge, number plate, TSAL lamp), `ground` (shadow contact edges; the
  grass line only in the traced master). Each `<g>` and each `<path>` carries `data-w`
  (relative weight) for setting real widths per breakpoint.
- Every `<path>` has `pathLength="1"` (so `stroke-dasharray: 1 1` + `stroke-dashoffset: 1 -> 0`
  draws it) and `data-o` (0..1 start order). `vector-effect="non-scaling-stroke"` keeps
  widths in screen pixels at any scale. Derived paths also carry `data-len` and `data-pts`
  (and `data-min-vw` where a stroke is for wider windows only).
- Order (`data-o` windows): body 0-0.2, wheels 0.2-0.38, frame and suspension 0.38-0.6,
  driver 0.6-0.74, details 0.74-0.88, ground 0.88-1. Within a window: front of the car (left)
  to back. Added strokes take a given order inside these windows.
