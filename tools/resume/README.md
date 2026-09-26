# Desk résumé source

The desk, pickup and fitted reader share a lossless render of the current
one-page `assets/kefan-wu-resume.pdf`. The PDF itself is unchanged. The source
hash is in `assets/resume/manifest.json`; `experience-resume-assets.js` contains
the same generated asset record.

Run `python tools/resume/render-preview.py` with Poppler, Pillow and pypdf
available. It renders the complete 612×792-point Letter page at 2040×2640,
verifies a lossless WebP pixel roundtrip, and writes a content-hashed preview.
Update `experience-resume-content.js` against the actual rendered page whenever
the PDF changes; it is the complete, non-interactive accessible text equivalent.
Do not infer new dates, rewrite targets as measured results, or silently edit
the downloadable document while updating this visual surface.

The current preview is 201,524 bytes. It uses about 20.5 MiB of RGBA pixels,
roughly 27.4 MiB with mipmaps; this is a fidelity tradeoff, not a GPU-memory
reduction. One texture and one reader image are retained, and the old repeated
character-range layout/rasterization is removed. Add an immutable Vercel cache
rule for a new hashed preview URL when regenerating it.

`RESUME_PAPER` centralizes dimensions: width .234 m, Letter aspect 17:22,
thickness .00025 m and bottom .76695 m (above the .7668 m cutting mat).
The pick proxy keeps a minimum .008 m depth. Held-pose calculations use these
dimensions; CSS uses the same 17:22 aspect. The original lighting/flight
choreography remains; the paper continues receiving live light/shadows.

`experience-resume.js` opens a full-window reader after the physical pickup
handoff. Desktop defaults to the original page fitted to the available width;
screens below 640 px default to the same résumé's selectable text at 18 px.
Page/Text controls are available everywhere. The fixed Letter rectangle is used
only during the brief 3D handoff, not as the reading viewport.

Page zoom has no fixed upper magnification limit. Buttons, +/−/0 and Ctrl-wheel
animate over 190 ms, accumulate rapid input and retain the document point under
the pointer or viewport center. Text mode reflows and scales its real text.
Normal scrolling and drag panning use the full reader. A stable scrollbar
gutter and settled width measurements avoid horizontal overflow at default fit.

The reader expands over 360 ms after the physical sheet is hidden. Closing
restores the canonical page over 300 ms before the original paper return.
Closing during opening, zooming or resizing cancels the old animation; delayed
expansion cannot reopen a closing reader. Reduced motion skips these effects.
The room does not render while the full reader is stationary. The same image,
texture, original PDF and transcript are retained; no additional asset loads.

Run `node --test tools/room-tests/resume-reader.test.mjs` for source integrity,
geometry, zoom/pan and disposal checks. Browser QA belongs in
`../.codex/resume-desk-20260926/` for source fidelity, and
`../.codex/resume-full-20260926/` for full-window behavior, mobile typography,
interrupted transitions and scene/texture preservation.
