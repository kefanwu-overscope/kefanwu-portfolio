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

`experience-resume.js` provides fitted view, up to 3× zoom, drag/scroll panning,
keyboard +/−/0 and native PDF open/download controls. Closing a magnified page
first eases back to the full page over 180 ms, then uses the original physical
paper return. Reduced motion fits immediately. Zooming or resizing never changes
the permanent 3D texture, and reopening always starts at the complete page.

Run `node --test tools/room-tests/resume-reader.test.mjs` for source integrity,
geometry, zoom/pan and disposal checks. Browser QA belongs in
`../.codex/resume-desk-20260926/`, including the original PDF render, exact held
projection measurements, desktop/mobile images and close/resize checks.
