# Agent Handoff

## Project

Static portfolio rebuild for `www.kefanwu.com`.

Workspace folder:

```powershell
C:\Users\oc\Desktop\WEBSITE\portfolio-site
```

The deployable site is self-contained inside this folder. The root `WEBSITE`
folder contains raw source photos and older exported assets, but the current
site references only files under `portfolio-site`.

## File Map

- `index.html` - page structure, project cards, modal shell, nav, contact links.
- `styles.css` - Apple/SpaceX-inspired visual system, responsive layout, modal, project cards, animation styling.
- `script.js` - project data, modal case-study content, galleries, filters, reveal animation, canvas background.
- `assets/` - optimized local images used by the site.
- `README.md` - local preview and deploy instructions.

## Local Preview

```powershell
cd C:\Users\oc\Desktop\WEBSITE\portfolio-site
python -m http.server 4173
```

If Python is not on PATH:

```powershell
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4173
```

Open:

```text
http://localhost:4173
```

## Current Design Direction

- Clean, dark, high-contrast mechanical engineering portfolio.
- Apple Liquid Glass-inspired interaction layer for buttons, filters, modal controls, gallery controls, and project cards.
- Recruiter-first: projects appear within the first one to two scrolls.
- First four project cards must remain the FSAE split:
  - Mk.8 steering system
  - Driver seat and harness
  - Carbon fiber seat support
  - Brake temperature simulation
- Personal hobby sections are intentionally removed.
- Video assets and video UI are intentionally removed from the deployable site.
- Telecaster is framed as CNC/fabrication, not personal interest content.
- Current team role should remain `Mechanical Lead`.
- Hero stats currently use broad recruiter-facing signals: `14` engineering projects, `18+` technical skills, `>30` engineers led, and `Mechanical Lead / Olin Electric Motorsports`.
- Hero skill ticker should remain full-viewport and animate left-to-right above the `Kefan Wu` title.
- Hero scroll cue is a wider semi-transparent right-side vertical rail with a downward moving chevron. It starts below the hero skill ticker, not at the top edge of the viewport.
- Project cards should stay simple and image-first; the dedicated `assets/cover-*.webp` files are cleaned card covers derived from real project imagery.
- Current card-cover updates:
  - `cover-carbon-fiber-seat.webp` uses `Updated/Carbon Fiber Seat/b631a803db5b0636e18efab7e194549c.jpg`.
  - `cover-ftc-robot.webp` uses `445ad524c3aaaae6c6cf24331973ea4.jpg`.
  - `cover-perfume-dispenser.webp` uses `Updated/Formlanbs Hackathon, Smelly/0e82cce5adb5f6d76151b1d34cf38f61.jpg`.
  - `cover-telecaster.webp` uses the finished guitar photo from `Updated/Telecaster`.
  - The Olin Electric Motorsports set-piece still uses `hero-oem.webp`; its improved appearance comes from CSS object-position and reduced zoom, not a screenshot with baked-in text.

## Current Site Behavior

- Project cards are filterable by category.
- Each card opens a rounded case-study modal.
- Each modal includes:
  - summary
  - image gallery
  - engineering signal list
  - tools and methods list
  - detailed case-study sections
- Gallery thumbnails update the large modal image.
- No project gallery uses video.
- Canvas background and scroll reveal animations are active unless reduced motion is preferred.

## Source Pages Used For Content

- `https://www.kefanwu.com/3d-scanner`
- `https://www.kefanwu.com/formlabs-hackathon-2026`
- `https://www.kefanwu.com/fsae-2026`
- `https://www.kefanwu.com/fsae2024_2025`
- `https://www.kefanwu.com/poolsniper`
- `https://www.kefanwu.com/gearbox`
- `https://www.kefanwu.com/wankelengine`
- `https://www.kefanwu.com/educationkit`
- `https://www.kefanwu.com/telecaster`
- `https://www.kefanwu.com/ftc`
- `https://www.kefanwu.com/noisereduction`

## Last Verification

Completed after the latest project-detail expansion:

- `node --check script.js` passed.
- All `assets/...` references in `index.html`, `styles.css`, and `script.js` resolved.
- Local server at `http://localhost:4173` returned HTTP 200.
- Headless Chrome check passed:
  - 14 project cards.
  - First four cards are the FSAE split.
  - Personal habit terms are absent.
  - Scanner modal has 4 detail sections and 7 gallery items.
  - Brake modal has 4 detail sections.
  - Gallery thumbnail clicks update the modal hero image.
  - No console errors.

## Useful Edit Notes

- Most content changes should happen in the `projectData` object in `script.js`.
- To add a project image:
  1. Add the optimized image to `assets/`.
  2. Reference it in the relevant project's `gallery` array.
  3. Run the asset-reference check before handoff.
- To replace a card cover, update both the hard-coded card image in `index.html` and the matching `image` field in `script.js`.
- Preserve the Liquid Glass hover or focus animation on all button-like controls and project cards.
- Avoid creating large empty homepage sections; keep detailed content inside modals.
- Keep generated verification screenshots and temporary contact sheets out of the final project folder.
