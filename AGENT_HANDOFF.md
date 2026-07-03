# Agent Handoff - Kefan Wu Portfolio

## Project

Static portfolio website for Kefan Wu.

Workspace:

```powershell
C:\Users\oc\Desktop\WEBSITE\portfolio-site
```

Live production:

```text
https://www.kefanwu.com
```

Vercel preview/project URL:

```text
https://kefanwu-portfolio.vercel.app
```

Git remote:

```text
https://github.com/kefanwu-overscope/kefanwu-portfolio.git
```

The site is a plain static site: no framework, no build step, no package install required.

## Current User Preferences

- Website language must stay English.
- Visual style should stay restrained, black, premium, engineering-focused, close to Apple / SpaceX.
- Avoid videos.
- Avoid hobby-framed personal content. If a project is hobby-adjacent, frame it as engineering, fabrication, CAD, controls, or analysis.
- Avoid flashy purple effects, decorative orbs, and loud gradients.
- Prefer real project photos and engineering assets over generic stock imagery.
- Keep the site recruiter-friendly: projects, role, technical contribution, and contact should be easy to scan.
- Use concise text, strong engineering nouns, and no marketing filler.
- Do not add a right-side scroll strip. Current scroll hint is bottom-center `SCROLL` with a thin line/dot.
- Preserve the current hero stats bar and avoid cropping its rounded corners.
- For mobile, improve readability only inside `@media (max-width: 720px)` unless the user explicitly asks for desktop changes.

## File Map

Static homepage (canonical, recruiter-facing):
- `index.html` - page structure, hero, ticker text, project cards, section order, contact links, modal shell.
- `styles.css` - visual system, responsive layout, ticker styling, liquid glass cards, section fades, project cards, modal, mobile typography.
- `script.js` - modal content wiring, galleries, filters, counters, reveal animation, hero skill hover cards.
- `project-data.js` - shared `window.projectData` (case-study content); loaded before `script.js` on index.html AND before `experience.js` on experience.html.
- `assets/` - local images, project covers, gallery media, and downloadable package.

Interactive 3D page (immersive companion; see the "3D Experience Page" section below):
- `experience.html` / `experience.css` / `experience.js` - the buildless three.js scene.
- `experience-data.js` - exports `RESUME` (used); `HERO_PROJECTS` is legacy/unused.
- `models/real/*.glb` - 5 real SolidWorks assemblies; `tools/stl2glb.py` builds them; `ATTRIBUTIONS.txt` credits the few CC0 assets.

Docs:
- `README.md` - short local preview and deploy notes.
- `PROJECT_DOCUMENTATION.md` - older project brief; useful background but verify against current files.
- `AGENT_HANDOFF.md` - this current handoff.

## Current Site Structure

1. Header/nav: Projects, Skills, Motorsport, Contribution, Contact.
2. Hero:
   - Background: `assets/hero-fsae-track.webp`.
   - Eyebrow: `Mechanical Lead / Olin Electric Motorsports / MechE @ Olin College '28`.
   - Skill ticker:
     `Arduino`, `TIG Welding`, `AutoCAD`, `Topology Study`, `SolidWorks`, `MATLAB`, `FEA`, `CFD`, `CNC Mill`, `Lathe`, `Waterjet`, `Carbon Fiber`, `Team Management`, `Vibe Coding`.
   - Hero copy:
     `Mechanical engineering student at Olin College, leading mechanical systems for Olin Electric Motorsports and building tested hardware across motorsport, robotics, and fabrication.`
   - CTA buttons: `View projects`, `FSAE program`.
   - Stats: `15 Engineering projects`, `19+ Technical skills`, `>30 Engineers led`, `Mechanical Lead / Olin Electric Motorsports`.
3. Projects section:
   - Kicker only: `Projects`.
   - Filter chips: All, Motorsport, Robotics, Product, Analysis, Fabrication.
   - Card order:
     Current actual order (15 cards): `Mk.8 steering system`, `Javelin VTOL drone`, `Agent-based CFD`, `Carbon fiber seat`, `FSAE Brake Sim`, `3D scanner`, `Smelly`, `AURA swerve drive`, `LineFollower robot`, `2-speed gearbox`, `Pool Sniper`, `Driver seat and harness`, `Guitar education kit`, `Telecaster guitar`, `FTC robot`.
   - `Javelin VTOL drone` (`data-project="javelin"`) added right after steering: high-speed tail-sitter VTOL drone (300 km/h target, differential thrust, no control surfaces). Source: `C:\Users\oc\Desktop\Javeline\` (`Javelin_Project_Overview.md` + `Javelin_pics/`). Cover `assets/cover-javelin.webp`; gallery `javelin-3q/nose/motor/rear/outdoor.webp`. Modal lead `assets/javelin-3q.webp`. `card-media--fill` (photo on gray studio bg).
     - Material accuracy: the airframe is **3D-printed PPA-CF and PC-FR** (carbon-filled nylon), with **carbon-fiber rods only as wing/tail spars** — it is NOT a full carbon-fiber layup. Tools chips read `3D printing (PPA-CF / PC-FR)` and `Carbon-rod reinforcement`; gallery caption is `Printed PPA-CF / PC-FR`. Do not relabel this as a "carbon airframe".
4. Skill matrix (`#skills`, `.skills-matrix`), placed right after Projects:
   - Heading `Skill matrix`. Six category cells (`.matrix-cell`) of skill chips:
     CAD & modeling, Simulation & analysis, CNC & machining, Fabrication & composites, Electronics & controls, Software & leadership.
   - Each chip (`.matrix-cell li`) is wired into the same `heroSkillDetails` hover-card system as the ticker (`initHeroSkillCards` includes `.matrix-cell li`); chips are keyboard-focusable. Three new entries were added for chips not in the ticker: `3d printing` (`assets/skill-3d-printing.jpg`), `esp32` (`assets/skill-esp32.jpg`) — both Unsplash, free commercial, local — and `embedded sensors` (reuses `assets/line-follower-white.webp`). Keep every matrix chip label matching a lowercase key in `heroSkillDetails`.
   - Replaced the old full-bleed `Olin Electric Motorsports` set-piece (removed because it felt redundant/abrupt). The `.set-piece` CSS/JS still exists but is unused; `assets/oem-mk7-track.jpg` is now orphaned.
5. Mechanical Lead detail section (`.featured`, now carries `id="motorsport"`):
   - Role panel and three media panels (compact 3-column layout).
   - The `Visit Olin Electric Motorsports ↗` link lives here now (`.oem-link`), preserving the OEM link.
   - Nav `Motorsport` and the hero `FSAE program` CTA both point to `#motorsport` (this section).
6. Capabilities:
   - Heading: `Contribution`.
   - Five cards in one row on desktop:
     `Team management`, `Mechanical architecture`, `Fabrication`, `Simulation and modeling`, `Controls and integration`.
7. Contact:
   - Heading: `Let's build cool stuff.`
   - Links: `kwu@olin.edu`, `kefanwu8888@gmail.com`, LinkedIn.

## DOM / Anchor / ID Reference

_Verified 2026-06-29 token-by-token against `index.html` + `script.js`. Re-verify before trusting if the files have changed since._

> ⚠️ **Footgun:** Section ids do **NOT** match their visible names. "Projects" = `id="work"` (there is no `#projects`). "Contribution" = `id="capabilities"`. Also: the kicker on `#work` literally reads "Projects" but is `id="systems-title"`. Always navigate by id, not by visible label.

### Section / landmark map (DOM order)

| Visible name | Element & class | id | Linked from |
|---|---|---|---|
| (progress bar) | `div.progress` | — | (not linked; decorative, `aria-hidden`) |
| (header) | `header.site-header` | — | (not linked) |
| (main wrapper) | `main` (no class) | `top` | brand link `KW / Kefan Wu` → `#top` |
| Hero | `section.hero` | — (h1 is `hero-title`) | (not linked) |
| Projects | `section.systems` | `work` | nav `Projects` → `#work`; hero CTA `View projects` → `#work`; scroll cue `Scroll` → `#work` |
| Skills | `section.skills-matrix.section-shell` | `skills` | nav `Skills` → `#skills` |
| Motorsport | `section.featured.section-shell` | `motorsport` | nav `Motorsport` → `#motorsport`; hero CTA `FSAE program` → `#motorsport` |
| Contribution | `section.capabilities.section-shell` | `capabilities` | nav `Contribution` → `#capabilities` |
| Contact | `section.contact` | `contact` | nav `Contact` → `#contact` |
| (footer) | `footer.site-footer` | — | (not linked) |
| Case-study modal | `div.modal` | `project-modal` | (opened by JS, not an href) |

### Nav & CTA targets

| Control (verbatim label) | href target | Resolves to section |
|---|---|---|
| `KW` / `Kefan Wu` (brand) | `#top` | `main#top` |
| `Projects` (nav) | `#work` | Projects `section#work` |
| `Skills` (nav) | `#skills` | Skills `section#skills` |
| `Motorsport` (nav) | `#motorsport` | Motorsport `section#motorsport` |
| `Contribution` (nav) | `#capabilities` | Contribution `section#capabilities` |
| `Contact` (nav) | `#contact` | Contact `section#contact` |
| `View projects` (hero CTA, `button primary`, `data-magnetic`) | `#work` | Projects `section#work` |
| `FSAE program` (hero CTA, `button secondary`, `data-magnetic`) | `#motorsport` | Motorsport `section#motorsport` |
| `Scroll` (scroll-cue, `a.scroll-cue.stage`) | `#work` | Projects `section#work` |

All in-page hash anchors resolve — **no broken `#` targets**. Nav container is `id="site-nav"`. There is also a `.nav-toggle` button (read by JS).

### Project cards

Container: `<div id="project-cards" class="project-grid" data-reveal-group>`. Each card is `<article class="project-card" data-project="…" data-category="…">` with an `<h3>` title. **15 cards total.** Open value passed to JS `openModal()` = `data-project`.

| # | data-project | `<h3>` visible | data-category tokens | card-media variant | Notes |
|---|---|---|---|---|---|
| 1 | `steering` | Mk.8 steering system | `motorsport analysis fabrication` | `card-media card-media--contain` | |
| 2 | `javelin` | Javelin VTOL drone | `robotics analysis fabrication` | `card-media card-media--fill` | |
| 3 | `ansysCfd` | Agent-based CFD | `analysis software` | `card-media card-media--contain` | **download icon** (`a.project-download.project-download--icon` → `assets/claude_ansys_cfd.zip`); body is `project-body project-body--inline`; only card with `software` token |
| 4 | `carbonSeat` | Carbon fiber seat | `motorsport product fabrication` | `card-media card-media--contain` | |
| 5 | `brakeSim` | FSAE Brake Sim | `motorsport analysis` | `card-media card-media--fill` | |
| 6 | `scanner` | 3D scanner | `robotics analysis` | `card-media card-media--fill` | |
| 7 | `formlabs` | Smelly | `robotics product` | `card-media card-media--contain` | (h3 "Smelly", data-project `formlabs`) |
| 8 | `aura` | AURA swerve drive | `robotics product fabrication` | `card-media card-media--contain` | scroll-scrub/exploded modal (drives `modal-scrub-*` + `modal-spec`) |
| 9 | `lineFollower` | LineFollower robot | `robotics product fabrication` | `card-media card-media--contain` | |
| 10 | `gearbox` | 2-speed gearbox | `product fabrication` | `card-media card-media--contain` | |
| 11 | `pool` | Pool Sniper | `robotics product fabrication` | `card-media card-media--contain` | |
| 12 | `seat` | Driver seat and harness | `motorsport product fabrication` | `card-media card-media--contain` | |
| 13 | `education` | Guitar education kit | `product fabrication` | `card-media card-media--contain` | |
| 14 | `telecaster` | Telecaster guitar | `fabrication product` | plain `card-media` | |
| 15 | `ftc` | FTC robot | `robotics fabrication` | plain `card-media` | |

### Filter chips

Container: `<div class="filter-bar" role="list" aria-label="Filter case studies" data-reveal>`. Buttons are `button.filter` with `data-filter`; `All` carries extra class `active` (`class="filter active"`). JS reads `button.dataset.filter` vs `card.dataset.category`.

| Chip label | data-filter | Matches data-category token(s) |
|---|---|---|
| All | `all` | special — matches every card (not a category token) |
| Motorsport | `motorsport` | `motorsport` (cards 1, 4, 5, 12) |
| Robotics | `robotics` | `robotics` (cards 2, 6, 7, 8, 9, 11, 15) |
| Product | `product` | `product` (cards 4, 7, 8, 9, 10, 11, 12, 13, 14) |
| Analysis | `analysis` | `analysis` (cards 1, 2, 3, 5, 6) |
| Fabrication | `fabrication` | `fabrication` (cards 1, 2, 4, 8, 9, 10, 11, 12, 13, 14, 15) |

**Full set of distinct category tokens (6):** `analysis`, `fabrication`, `motorsport`, `product`, `robotics`, `software`.
⚠️ `software` has **no filter chip** — it appears only on card #3 (`ansysCfd`), which is still reachable via the `Analysis` chip (it also carries `analysis`).

### Case-study modal — element id map

Root: `<div class="modal" id="project-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">`. "(JS-written)" = content populated/mutated by `script.js`.

| id | Holds | JS-written |
|---|---|---|
| `project-modal` | modal root dialog | — (read by JS, never null-checked — removing it throws) |
| `modal-image` | main gallery `<img>` (default `assets/hero-fsae-track.webp`) | yes (src swapped) |
| `modal-scrub-img` | exploded-view CAD frame `<img …hidden>` | yes (`.hidden`, `.src`) |
| `modal-scrub-bar` | scrub progress `<i>` inside `.modal-fig__track` | yes (`.style.width`) |
| `modal-spec` | spec/meta/stats chips panel `<div hidden>` | yes (`.replaceChildren()`, `.hidden`) |
| `modal-kicker` | kicker `<p class="section-kicker">` | yes |
| `modal-title` | project title `<h2>` (also `aria-labelledby` target) | yes |
| `modal-summary` | summary `<p>` | yes |
| `modal-gallery` | gallery thumbnail buttons container `<div>` | yes (builds `.gallery-item` buttons) |
| `modal-highlights` | "Engineering signal" `<ul>` | yes |
| `modal-tools-block` | wrapper `<div>` for "Tools and methods" heading + list | **no JS consumer** (structural only; only modal id not referenced by script.js) |
| `modal-tools` | tools/methods `<ul>` | yes |
| `modal-details` | case-study detail sections `<div>` | yes |

Modal structural (id-less) hooks: `.modal-backdrop[data-close-modal]`, `.modal-panel`, `.modal-close[data-close-modal]` (text "Close"), `.modal-media`, `.modal-stage`, `.modal-content`, `.modal-columns`, `.modal-fig__track`.

### JS load-bearing hooks (do NOT rename in HTML)

**ids read via getElementById:** `modal-scrub-img`, `modal-spec`, `modal-scrub-bar`.
**ids read via querySelector("#…"):** `project-modal`, `modal-image`, `modal-kicker`, `modal-title`, `modal-summary`, `modal-highlights`, `modal-tools`, `modal-details`, `modal-gallery`.

Structural class / attr selectors used by script.js (one line each):
- `.project-card` — card list; `data-category` filtered, `data-project` → modal key, `h3` → aria-label.
- `.filter` — filter buttons; reads `data-filter`.
- `.project-grid .project-card` / `[data-reveal-group]` / `[data-reveal]` — scroll-reveal grouping.
- `.project-download` — per-card download link.
- `[data-count]` — stat counters (animated count-up).
- `[data-magnetic]` — magnetic hover CTAs.
- `[data-close-modal]` — modal close (backdrop + close button).
- `.gallery-item` — modal gallery buttons (created by JS, queried back).
- `.modal-panel`, `.modal-media`, `.modal-close` — modal layout / focus targets.
- `.hero-skill-track span` — ticker labels; `.hero h1` — hero headline; `.scroll-cue` / `.scroll-cue:not(.is-gone)` — scroll cue state.
- `.matrix-cell li` — skill matrix items; `.skill-card-kicker` / `.skill-card-text` — skill card text nodes.
- `.progress`, `.site-header`, `.set-piece` — scroll-progress / header / set-piece animation targets.
- `.nav-toggle` + `.site-nav` — mobile nav toggle.

### Hero / stats anchors

- **Ticker:** strip `div.hero-skill-strip.stage`; track class `hero-skill-track` (no id) — **two** tracks (visible + `aria-hidden` duplicate), each with **14** `<span>` labels: Arduino, TIG Welding, AutoCAD, Topology Study, SolidWorks, MATLAB, FEA, CFD, CNC Mill, Lathe, Waterjet, Carbon Fiber, Team Management, Vibe Coding.
- **Eyebrow:** `p.eyebrow.stage` — "Mechanical Lead / Olin Electric Motorsports / MechE @ Olin College '28".
- **Headline:** `<h1 id="hero-title">`; inner `span.line > span.stage` ×2 → "Kefan", "Wu".
- **Stats bar** (`div.hero-stats.stage`), in order:

| Strong content | data-count | Label (verbatim) |
|---|---|---|
| `Mechanical Lead` (`strong.stat-word`) | (none) | Olin Electric Motorsports |
| `15` | `data-count="15"` | Engineering projects |
| `19`+ (trailing `+` outside span) | `data-count="19"` | Technical skills |
| `>30` (leading `>` before span) | `data-count="30"` | Engineers led |

### Contact & downloadable assets

- Contact section: `<section id="contact" class="contact" aria-labelledby="contact-title">`; kicker `p.section-kicker` "Contact"; `<h2 id="contact-title">Let's build cool stuff.</h2>`; sub-copy "Open to mechanical engineering internships and project conversations."
- Contact links (`div.contact-actions`): `mailto:kwu@olin.edu` ("kwu@olin.edu", `button primary`) · `mailto:kefanwu8888@gmail.com` ("kefanwu8888@gmail.com", `button secondary`) · `https://www.linkedin.com/in/kefan-wu-olin/` ("LinkedIn", `button secondary`, `target="_blank"`).
- Footer also links `https://www.linkedin.com/in/kefan-wu-olin/` ("LinkedIn").
- **Download asset:** `href="assets/claude_ansys_cfd.zip"` (`a.project-download.project-download--icon`, `download`, `aria-label="Download claude_ansys_cfd package"`) — lives on project card #3 `data-project="ansysCfd"` (`<h3>Agent-based CFD</h3>`). Only `.zip`/download on the page.
- External: OEM `https://olinelectricmotorsports.com/` ("Visit Olin Electric Motorsports ↗", `target="_blank"`) in the Motorsport section.

### Leftover id anchors (not detailed above)

| id | Element | Role |
|---|---|---|
| `site-nav` | nav | header nav container (JS `.site-nav` toggle target) |
| `systems-title` | `p.section-kicker` | kicker text "Projects" inside `#work` (NOT the section id) |
| `skills-title` | `h2` | "Skill matrix" |
| `capabilities-title` | `h2` | "Contribution" heading inside `#capabilities` |

Asset/version refs (verbatim): CSS `styles.css?v=skill-matrix-20260619`; JS `script.js?v=javelin-mat-20260620`; page title "Kefan Wu | Mechanical Engineering Portfolio".

## Recent Important Changes

- `ESP32` was removed from the hero skill ticker only. Do not remove ESP32 from project/tool descriptions unless requested.
- Added hero ticker skills:
  - `TIG Welding`, image `assets/skill-tig-welding.jpg`.
  - `Team Management`, image `assets/skill-team-management.jpg`.
  - `Vibe Coding`, image `assets/skill-vibe-coding.jpg` (Unsplash, free commercial license, downloaded locally). Hover-card key is `vibe coding` in `heroSkillDetails`. Skills stat bumped to `19+`.
- Replaced four hover-card skill images (in `heroSkillDetails`):
  - `CFD` -> own render `assets/ansys-cfd-pressure.webp`.
  - `SolidWorks` -> own render `assets/gearbox-render.webp` (was `seat-cad.webp`).
  - `CNC Mill` -> `assets/skill-cnc-mill.jpg` (Unsplash, free commercial, local).
  - `Lathe` -> `assets/skill-lathe.jpg` (Unsplash, free commercial, local).
  - These replaced external Wikimedia hotlinks; prefer local assets / Unsplash (no attribution) over CC BY-SA hotlinks.
- `Agent-ready CFD workflow` was renamed to `Agent-based CFD`.
- `Carbon fiber seat support` was renamed to `Carbon fiber seat`.
- `Driver seat and harness` was moved after `Pool Sniper`.
- Mobile typography was improved under `@media (max-width: 720px)` only.
- CFD project includes a prominent `Download package` CTA for `assets/claude_ansys_cfd.zip`.
- CFD gallery currently uses three post images:
  - `assets/ansys-cfd-wall-shear.webp`
  - `assets/ansys-cfd-agent-orchestration.webp`
  - `assets/ansys-cfd-smooth-cp-validation.webp`
- Olin Electric Motorsports background uses the local image copied from the OEM site: `assets/oem-mk7-track.jpg`.

## Cover Images, Modal Media, and Tooling

### Project-card cover treatment (all cards are a uniform 4:3 box)
- `.card-media` is `aspect-ratio: 4 / 3`; every card box is identically sized. Fix "image too big / wrong proportion" complaints at the box + `object-fit` level, NOT by resizing the source image.
- Default `.card-media img` is `object-fit: contain` on a dark tile (`#0e1014`) — shows a render/photo whole on a dark background.
- `.card-media--fill` → `object-fit: cover` (image fills the box, edges cropped). Use for full-bleed photos (e.g. Javelin).
- `.card-media--contain` → white tile + `object-fit: contain`. Use for CAD renders on a white/transparent background.
- Covers were cleaned with `rembg` (background removal) where needed; see tooling below.

### AURA modal scroll-scrub (exploded view) — NOT a video
- The `AURA swerve drive` case study has a scroll-scrubbed exploded-view animation INSIDE the modal (not on the card cover). As the user scrolls the open modal, the swerve assembly animates assembled → exploded.
- It is an image sequence (deliberately not a `<video>`, per the no-video rule): 60 frames at `assets/aura_explode/frame_001.webp` … `frame_060.webp`.
- Driven by the `modalScrub` controller in `script.js` (config `scrub: { base: "assets/aura_explode/frame_", count: 60 }`), rendering into `#modal-scrub-img` with a scroll-progress line `#modal-scrub-bar`. Has a `prefers-reduced-motion` fallback (static fully-exploded frame).
- That modal's left column is a composed instrument panel: CAD stage on top, figure caption + progress line, then a spec panel (role/process, stat tiles, tool chips). On desktop the right-hand tools block is hidden for this modal (`.modal--scrub`); tools live in the left spec panel instead.
- To rebuild frames: export an MP4 from SolidWorks, extract frames with imageio-ffmpeg, crop to a FIXED union 4:3 box (so the part doesn't jump between frames), save as webp.

### Asset tooling (local, on this machine)
- `rembg` lives in an isolated venv: `C:\Users\oc\rembg_venv` (model `isnet-general-use`, cached under `~/.u2net`). Use it to white-out / remove backgrounds.
- `ffmpeg` is available via the `imageio-ffmpeg` Python package (MP4 → frame extraction).
- `Pillow (PIL)` for cropping / webp conversion (covers are ~1400×933 webp at ~q82).
- Windows gotchas: Python cannot write to `/tmp` — write temp files under `C:/Users/oc/AppData/Local/Temp/...`. In `python -c` strings use forward slashes / `os.path.join`, not escaped backslashes. Pasted screenshots land in `C:\Users\oc\AppData\Local\Packages\MicrosoftWindows.Client.Core_cw5n1h2txyewy\TempState\ScreenClip\`.

### Current cache versions (bump the matching one whenever you edit that file)
- `styles.css?v=polish-20260701`
- `script.js?v=polish-20260701`
- `project-data.js?v=proj-shared-20260630` (shared case-study data; loaded before script.js on index.html and before experience.js on experience.html)
- `experience.css?v=exp-bcd-20260703` (3D page styles — in experience.html)
- `experience.js?v=exp-bcd-20260703` (3D page module — in experience.html)
- Convention for the 3D page: bump both to a new `exp-<label>-<YYYYMMDD>` string in `experience.html` on every change, then `curl` the live URL to confirm the new string is served.

### 2026-07-01 polish pass (approved by Kefan, groups A-D)
- Reveal/stagger system is now ACTIVE (was dead CSS): `[data-reveal]` and project cards start hidden and rise in with `--i` stagger; `.is-settled` restores fast hover transitions. Hero `.stage` elements animate via `stage-rise` keyed off `--stage`.
- Stat counters count up on first view (JS in script.js). Filters: per-card `view-transition-name` (FLIP in Chrome) + `.is-filtering` fade fallback. Modal content staggers in (`modal-item-in`). `[data-parallax]` img (Motorsport) now has a real parallax in `updateScrollEffects`.
- Projects section header is now kicker "Selected work" + `<h2 id="systems-title">Projects</h2>` (was a giant `<p>` kicker). `.skills-matrix` got its own vertical padding. Uppercase micro-labels gained letter-spacing (0.04-0.14em). Nav has scrollspy `.is-current`. `--text-h3` token normalized to 1.18rem.
- `.set-piece` CSS/JS fully REMOVED (was dead since the OEM set-piece was cut). Project-card backdrop blur reduced 26->14px for scroll perf.

## Editing Guidance

- Prefer small scoped patches. Do not rewrite the whole site unless asked.
- Use `apply_patch` for manual edits.
- Keep cache query strings in `index.html` updated after CSS/JS changes:
  - `styles.css?v=...`
  - `script.js?v=...`
- Project cards exist in both `index.html` and `script.js`:
  - `index.html` controls visible card order and cover content.
  - `script.js` controls modal/case-study content through `projectData`.
- Hero skill hover cards are in `script.js` under `heroSkillDetails`.
- Section transition/fade issues are mainly in `styles.css` around `.hero::after`, `.systems`, `.systems::after`, `.set-piece`, and `.set-piece-sticky`.
- Mobile readability changes should stay inside the `@media (max-width: 720px)` block.
- Clean temporary QA files before finishing: `_qa-*.png`, `_qa-*.log`, etc.

## Verification Commands

Syntax check:

```powershell
cd C:\Users\oc\Desktop\WEBSITE\portfolio-site
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check script.js
```

Local preview:

```powershell
cd C:\Users\oc\Desktop\WEBSITE\portfolio-site
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4173 --bind 127.0.0.1
```

Check local:

```powershell
Invoke-WebRequest http://localhost:4173 -UseBasicParsing
```

Recommended browser QA:

- Desktop: 1440x900.
- Mobile: 390x844.
- Confirm no horizontal overflow:

```js
document.documentElement.scrollWidth <= window.innerWidth
```

After final edits:

```powershell
git status --short
git add .
git commit -m "Update portfolio"
git push origin main
```

Vercel auto-deploys from `main`. After push, confirm:

```powershell
Invoke-WebRequest https://www.kefanwu.com -UseBasicParsing
```

## 3D Experience Page (experience.html) — as of 2026-07-03

An interactive WebGL "hardcore engineering office" companion to the static
site, reached from the homepage nav link **`3D Desk`**
(`<a href="experience.html" class="nav-experience">` in `index.html`). The
static homepage stays the canonical, recruiter-facing surface (the 3D page
sets `<link rel="canonical" href="https://www.kefanwu.com/">`); this page is
the "wow" layer. It is buildless: `three@0.185.0` via a jsDelivr importmap,
no bundler, no install.

### Files

| File | Role |
|---|---|
| `experience.html` | shell: topbar (KW brand, sound toggle, "All projects", "View classic site"), loader, overlay containers (`#exp-label`, `#exp-backdrop`, `#exp-panel`, `#exp-paper`, `#exp-lightbox`), `#exp-canvas`, importmap. |
| `experience.css` | all overlay styling. Palette tokens MIRROR the site (`--bg #0b0c0e`, `--ink #f5f5f7`, `--blue #3f8cff`). Key blocks: `.exp-panel` (project side panel), `.exp-sheet` (picked-up resume), `.exp-lightbox`, `.exp-label` (hover info card), `.exp-sound`. |
| `experience.js` | ~2600-line ES module: the whole scene. Sole data import is `RESUME` from `experience-data.js`; case-study content comes from `window.projectData` (set by `project-data.js`, loaded classic-script BEFORE the module). |
| `experience-data.js` | exports `RESUME` (used) and `HERO_PROJECTS` (LEGACY — no longer imported after the 2026-07-03 cleanup; safe to ignore or delete). |
| `tools/stl2glb.py` | offline STL→GLB merge pipeline (trimesh) for the real CAD exhibits. |
| `models/real/*.glb` | 5 real merged assemblies (aura, javelin, scanner, seat, steering). |
| `models/potted_plant_01/`, `hdri/`, `textures/` | the only third-party assets (Poly Haven CC0; see `ATTRIBUTIONS.txt`). Everything else is procedural. |

### Scene

Graphite engineering office, FULLY enclosed (4 walls + ceiling + front
wall). The camera is OrbitControls-limited (azimuth ±0.32π, distance
1.4–3.2, polar clamped) AND additionally hard-clamped to the room's
interior AABB every frame in the render loop — no orbit/zoom combination
can see past a wall. All furniture is procedural: sit-stand desk (telescopic
columns, T-feet, keypad), two display cabinets (slim steel + tinted glass),
electronics workbench (Bambu H2S built to the reference photo w/ top AMS 2
spool bay, programmable PSU, soldering station, screwdriver set, multimeter,
pegboard of MechE tools — rule/drill/Dremel/torque wrench/caliper/hex keys/
hammer/cutters/tape/level/hex keys/square/adjustable wrench/strippers, LED
bar lamp), rolling 5-drawer tool chest, real ergonomic mesh task chair
(models/ergonomic_mesh_office_chair, CC BY 4.0 — see ATTRIBUTIONS.txt;
intrinsic front is +x, rotY 1.34 faces the desk), blueprint wall panel,
ceiling cove LED strips, graphite rug (noise map + bump for plush),
potted plant.

### Exhibits — all 15 projects clickable (18 hotspots: + resume, skill paper, desk lamp)

Two cabinets. Every exhibit is placed by `placeRoot(root, scene, opts)`,
which: normalizes scale to `targetSize` along `axis`, recenters on its
geometric center, wraps it in a pivot, adds an invisible hitbox mesh + a
blue "Genshin-style" interact marker sprite (bobs/pulses, capped below the
shelf lip via `markerCap`), and — critically — applies an optional
`fit: [x,y,z]` bay budget that UNIFORMLY shrinks anything exceeding its
shelf cell (this is the anti-clipping mechanism; every exhibit passes a
`fit`).

- **Main back-wall cabinet** (3 bays × 3 rows, layout const `CAB`):
  - REAL GLBs (`models/real/…`, loaded via `loadAssembly`): `carbonSeat`
    (seat.glb), `aura` (aura.glb, lower drivetrain half, rotated so wheels
    sit down), `scanner` (scanner.glb), `javelin` (javelin.glb, dark shell
    tweak), `steering` (steering.glb).
  - Procedural (`build…` in experience.js): `brakeSim` (buildBrakeRotor,
    thermal-gradient disc), `lineFollower` (buildLineFollower),
    `ansysCfd` (buildCfdDisplay — a monitor showing the CFD result),
    `education` (buildEducationKit — guitar education kit).
- **Right-wall cabinet** (2 bays × 3 rows, layout const `CAB2`), ALL
  procedural: `gearbox` (buildGearboxV2), `seat` (buildDriverSeat — the
  DRIVER seat/harness project, distinct from `carbonSeat`), `formlabs`
  (buildSmelly — the "Smelly" perfume mixer), `ftc` (buildFtcBot), `pool`
  (buildPoolSniper), `telecaster` (buildTelecasterV2).
- **Resume** = a paper sheet on the desk (`buildResumePaper`, `action:
  "resume"`), the 16th hotspot.
- **Skill paper** = `buildSkillPaper()` second printed sheet on the desk
  beside the resume (`action: "skills"`). Hover-only: shows a wide hover
  card (`.exp-label--wide`) listing `RESUME.skills`; clicking is a no-op
  (focusHotspot returns early on null html WITHOUT clearing the hover, so
  a tap on touch devices leaves the card visible).
- **Desk lamp** = click-to-toggle hotspot (`action: "lamp"`, no marker,
  invisible hit pad in the lamp group). `toggleDeskLamp()` switches
  `lampLight` + the `lampLed`-named emissive disc; hover label wording
  tracks the on/off state.
- Also note: `buildDeskMonitor()` (decorative CAD-viewport monitor on the
  desk), a `Reflector` gloss strip set into the floor in front of the main
  cabinet (LOW_TIER gets a static glossy plane), and `runLightIntro()` —
  staged light-up on reveal (ambient → strips → spots → lamps), skipped
  under prefers-reduced-motion.

> Exhibit `key` matches a `window.projectData` key so the panel content is
> the SAME data as the homepage modal. Note the two seat keys: `carbonSeat`
> (real CF seat, main cabinet) vs `seat` (procedural driver seat, right
> cabinet) are different projects — don't conflate them.

### Interactions

- **Click a project exhibit** → camera flies in (generic "approach from
  room center", so it frames left-, back-, and right-wall exhibits alike)
  and a wide right-side panel (`#exp-panel`, `projectHTML`) slides in with
  the FULL case study: summary, all highlights, tool chips, every detail
  section, and the gallery. The focused exhibit slowly turntables while the
  panel is open, and depth-of-field eases open (background blurs).
- **Click a gallery image** → `#exp-lightbox` full-screen viewer w/ caption.
- **Click the resume** → the camera dips to the desk and a paper sheet
  (`#exp-paper` / `.exp-sheet`, `resumeHTML` from `RESUME`) RISES up to the
  viewer like picking the page up (dark ink on paper, blue rule). This is
  intentionally NOT the side panel.
- **Close**: Esc or backdrop (Esc closes the lightbox first if open, else
  the panel/sheet), then the camera flies back to rest.
- **First visit**: a guided camera sweep (right cabinet → main cabinet →
  rest), remembered in `localStorage.kw_intro_seen`; return visits get the
  short fly-in. `prefers-reduced-motion` skips motion.
- **Hover**: exhibit scales up 6% and an info card (`#exp-label`) shows the
  title + kicker (pulled from `projectData[key].kicker`).
- **Sound**: optional WebAudio synth (hover tick / click / flight whoosh),
  MUTED BY DEFAULT, toggled by the HUD speaker button, persisted in
  `localStorage.kw_snd`.

### Rendering

EffectComposer (MSAA ×4 render target) chain:
`RenderPass → GTAOPass → BokehPass → UnrealBloomPass → OutputPass`.
ACES tone mapping, exposure ~1.45, key light 4096² shadows, GTAO for
contact darkening, restrained bloom (screens/paper read as lit, not
light fixtures), Bokeh DoF that only opens while an exhibit is focused.
Loader shows REAL progress via `LoadingManager.onProgress`.

**Quality tiers** — `LOW_TIER` = coarse pointer OR viewport < 820px:
skips GTAO + Bokeh, 1024² shadows, DPR ≤ 1.5 (keeps phones smooth).

### Editing experience.js (important workflow)

`experience.js` is large and was built up through **anchored Python-splice
scripts** (write a `.py` in scratch that does `src.replace(old, new)` with
`assert old in src`, or `splice(startAnchor, endAnchor, replacement)` with
an `assert s < e` ORDER check, then rewrite the file with
`newline="\n"`). Small edits can also use the Edit tool. Whichever you use:

- ALWAYS verify anchor ORDER for splice-style edits. Two past regressions
  came from a start/end anchor spanning too far and swallowing unrelated
  functions (e.g. `makeInteractMarker`/`makeCarbonTwillTexture`/
  `boxProjectUVs` were deleted by a monitor-removal splice). After any
  structural edit, grep that each top-level `function name(` appears
  exactly once.
- Serve over http (the http.server command above) — it's an ES module, so
  `file://` won't load it. Verify in the browser: `window.__exp` exposes
  `{ scene, camera, renderer, controls, composer, models, hotspots, THREE }`
  for scripted checks (used heavily during QA — e.g. read
  `hotspots.length`, click-simulate via projected bbox centers, inspect
  `composer.passes`).

### Gotchas

- STL-derived GLBs carry NO UVs; `boxProjectUVs` generates them (used for
  the carbon-seat carbon-twill material). New real assemblies needing a
  tiling texture must do the same.
- An exhibit's bounding box INCLUDES its interact-marker sprite — measure
  the model before the marker is added if you need true part dimensions.
- To re-add a real CAD exhibit: export per-part STLs from SolidWorks to
  `C:\Users\oc\Desktop\STL`, bucket filenames so `tools/stl2glb.py`'s
  regexes tag them (mesh names `mat_steel/brass/dark/printed/aero/carbon/
  rubber`), run it to emit `models/real/<name>.glb`, then reference it in
  the `ASSEMBLIES` array. This is the pending "A" task for the six
  right-cabinet exhibits (currently procedural approximations).

## Direct Prompt For A New Agent

Use this prompt to hand off the project:

```text
You are taking over Kefan Wu's static portfolio website.

Work directory:
C:\Users\oc\Desktop\WEBSITE\portfolio-site

Live site:
https://www.kefanwu.com

GitHub/Vercel:
- Git remote: https://github.com/kefanwu-overscope/kefanwu-portfolio.git
- Branch: main
- Vercel auto-deploys after git push to main.

User preferences:
- Website must remain English.
- Style must remain black, restrained, premium, Apple/SpaceX-inspired, engineering-focused.
- No video.
- Do not add personal hobby sections or hobby framing.
- Use real project images where possible.
- Avoid purple/flamboyant effects, decorative orbs, and overdesigned marketing layouts.
- Keep recruiter readability high.
- Use concise engineering language.
- Preserve desktop layout unless explicitly asked.
- For mobile readability, change only rules inside @media (max-width: 720px) unless asked otherwise.

Important files:
- index.html: page structure, hero ticker labels, project card order, visible card copy.
- styles.css: all visual styling, responsive CSS, transitions, scroll cue, skill glass cards.
- script.js: projectData modal content, heroSkillDetails hover cards, filters, reveal/counter interactions.
- assets/: local images and downloadable ZIP assets.

Current key content:
- Hero ticker skills: Arduino, TIG Welding, AutoCAD, Topology Study, SolidWorks, MATLAB, FEA, CFD, CNC Mill, Lathe, Waterjet, Carbon Fiber, Team Management, Vibe Coding.
- ESP32 was intentionally removed only from the hero ticker, but may still appear in project/tool descriptions.
- Hero copy: "Mechanical engineering student at Olin College, leading mechanical systems for Olin Electric Motorsports and building tested hardware across motorsport, robotics, and fabrication."
- Projects card order (15 cards, current): Mk.8 steering system; Javelin VTOL drone; Agent-based CFD; Carbon fiber seat; FSAE Brake Sim; 3D scanner; Smelly; AURA swerve drive; LineFollower robot; 2-speed gearbox; Pool Sniper; Driver seat and harness; Guitar education kit; Telecaster guitar; FTC robot. (Wankel engine housing and Noise reduction algorithm were removed; cards now show image + name only.)
- After Projects comes a Skill matrix section (#skills); the old full-bleed OEM "set-piece" was removed. The Olin Electric Motorsports link now lives in the Mechanical Lead detail section (.featured, id="motorsport") as .oem-link → https://olinelectricmotorsports.com/. assets/oem-mk7-track.jpg is now orphaned.
- AURA swerve drive has a scroll-scrubbed exploded-view image sequence INSIDE its modal (assets/aura_explode/frame_001..060.webp, modalScrub controller) — not a video, not on the cover.
- Card cover treatment is uniform 4:3: default object-fit contain on dark tile, .card-media--fill = cover, .card-media--contain = white tile. Fix proportion complaints via these classes, not by resizing images.
- Capabilities heading is "Contribution"; cards are Team management, Mechanical architecture, Fabrication, Simulation and modeling, Controls and integration.
- Contact heading is "Let's build cool stuff."

Workflow:
1. Inspect current files before editing. Do not rely on older docs without checking current code.
2. Make small scoped edits with apply_patch.
3. Update CSS/JS cache query strings in index.html when changing styles.css or script.js.
4. Run:
   & 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check script.js
5. Preview with:
   & 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4173 --bind 127.0.0.1
6. Check http://localhost:4173 returns 200.
7. Browser-check desktop 1440x900 and mobile 390x844, especially no horizontal overflow.
8. Clean _qa-* temporary files.
9. Commit and push to main only after verification.
10. Confirm https://www.kefanwu.com returns 200 after Vercel deploy.

Be careful:
- Project cards are duplicated conceptually between index.html visible cards and script.js modal data.
- Section transition bugs have previously appeared around Hero -> Projects and Projects -> Motorsport; inspect visually if touching .hero, .systems, or .set-piece.
- Hero stats bar rounded corners were previously clipped; preserve overflow/spacing around it.
- Do not reintroduce the old right-side scroll strip.

There is also a SECOND surface: the interactive 3D page (experience.html /
experience.css / experience.js / experience-data.js), reached from the nav
link "3D Desk". It is a buildless three.js scene. The static homepage stays
canonical and recruiter-facing; the 3D page is the immersive extra. See the
dedicated "3D Experience Page" section above for its full architecture,
exhibit map (all 15 projects are clickable; 5 are real CAD GLBs, 10 are
procedural), interaction model (project side panel; resume rises as a paper
sheet; lightbox; guided intro; optional sound), render pipeline
(GTAO + Bokeh + bloom, LOW_TIER for mobile), and the anchored-Python-splice
editing workflow with its anchor-ORDER footgun. When editing it: bump BOTH
experience.css and experience.js cache strings in experience.html to a new
exp-<label>-<date>, verify window.__exp in the browser + no console errors,
then push and curl the live experience.html for the new cache string.
```
