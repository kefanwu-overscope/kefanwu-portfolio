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
- `experience-data.js` - exports ONLY `RESUME`. The legacy `HERO_PROJECTS` array and the unused `ACCENT` constant were deleted 2026-07-08.
- `models/real/*.glb` - 12 real SolidWorks assemblies; `tools/stl2glb*.py` scripts build them; `ATTRIBUTIONS.txt` credits the few CC0 assets.

Docs:
- `README.md` - short local preview and deploy notes.
- `PROJECT_DOCUMENTATION.md` - older project brief; useful background but verify against current files.
- `AGENT_HANDOFF.md` - this current handoff.

## Current Site Structure

1. Header/nav (6 items): Projects, Skills, Motorsport, Capabilities, Contact, and a pill link `3D Studio` (`a.nav-experience` → `experience.html`). Note "Capabilities" was formerly labeled "Contribution" everywhere (nav link, `<h2>`, id `capabilities-title`) — it is "Capabilities" now, live text and id both.
2. Hero:
   - Background: `assets/hero-fsae-track.webp`.
   - Eyebrow: `Mechanical Lead / Olin Electric Motorsports / MechE @ Olin College '28`.
   - Skill ticker (two tracks, visible + `aria-hidden`, 14 spans each):
     `Arduino`, `TIG Welding`, `AutoCAD`, `Topology Study`, `SolidWorks`, `MATLAB`, `FEA`, `CFD`, `CNC Mill`, `Lathe`, `Waterjet`, `Carbon Fiber`, `Team Management`, `AI-Assisted Eng` (renamed from `Vibe Coding` on 2026-07-07).
   - Hero title: `h1#hero-title`, two lines "Kefan" / "Wu".
   - CTA buttons: exactly two — `View projects` (`a.button.primary` → `#work`) and `Enter the 3D Studio` (`a.button.studio` → `experience.html`). There is NO `FSAE program` CTA and NO hero `Resume (PDF)` button.
   - Stats (4 cells): `Mechanical Lead / Olin Electric Motorsports`; `14 Engineering projects` (`data-count="14"`); `19+ Technical skills` (`data-count="19"`); `>30 Engineers led` (`data-count="30"`).
   - Scroll cue `Scroll` → `#work`.
3. Projects section:
   - Kicker only: `Projects`.
   - Filter chips: All, Motorsport, Robotics, Product, Analysis, Fabrication.
   - Card order (14 project cards, NO `gearbox` — it was removed from both the main site and the 3D studio):
     `Mk.8 steering system`, `Javelin VTOL drone`, `Agent-based CFD`, `Carbon fiber seat`, `FSAE Brake Sim`, `3D scanner`, `Smelly`, `AURA swerve drive`, `LineFollower robot`, `Pool Sniper`, `Driver seat and harness`, `Guitar education kit`, `Telecaster guitar`, `FTC robot`.
   - Every card also carries a mono index line (`.project-meta`, e.g. "01 / Motorsport") and a one-line outcome subtitle (`.project-sub`).
   - PLUS a 15th grid tile that is NOT a project: `a.project-card.project-card--studio` ("Walk the studio", → `experience.html`), spans 2 columns at ≥640px, visible under every filter, guarded out of the modal handlers in `script.js`. So there are 14 real projects + 1 studio teaser tile = 15 card-shaped elements in the grid.
   - `Javelin VTOL drone` (`data-project="javelin"`) sits right after steering: high-speed tail-sitter VTOL drone (300 km/h target, differential thrust, no control surfaces). Source: `C:\Users\oc\Desktop\Javeline\` (`Javelin_Project_Overview.md` + `Javelin_pics/`). Cover `assets/cover-javelin.webp`; gallery `javelin-3q/nose/motor/rear/outdoor.webp`. Modal lead `assets/javelin-3q.webp`. `card-media--fill` (photo on gray studio bg).
     - Material accuracy: the airframe is **3D-printed PPA-CF and PC-FR** (carbon-filled nylon), with **carbon-fiber rods only as wing/tail spars** — it is NOT a full carbon-fiber layup. Tools chips read `3D printing (PPA-CF / PC-FR)` and `Carbon-rod reinforcement`; gallery caption is `Printed PPA-CF / PC-FR`. Do not relabel this as a "carbon airframe".
4. Skill matrix (`#skills`, `.skills-matrix`), placed right after Projects:
   - Heading `Skill matrix`. Six category cells (`.matrix-cell`) of skill chips:
     CAD & modeling, Simulation & analysis, CNC & machining, Fabrication & composites, Electronics & controls, Software & leadership.
   - Each chip (`.matrix-cell li`) is wired into the same `heroSkillDetails` hover-card system as the ticker (`initHeroSkillCards` includes `.matrix-cell li`); chips are keyboard-focusable. Three new entries were added for chips not in the ticker: `3d printing` (`assets/skill-3d-printing.jpg`), `esp32` (`assets/skill-esp32.jpg`) — both Unsplash, free commercial, local — and `embedded sensors` (reuses `assets/line-follower-white.webp`). Keep every matrix chip label matching a lowercase key in `heroSkillDetails`.
   - The old full-bleed `Olin Electric Motorsports` set-piece was removed (felt redundant/abrupt). `.set-piece` CSS/JS has since been fully removed too (not just unused), and the orphaned `assets/oem-mk7-track.jpg` image was deleted in the 2026-07-08 asset cleanup.
5. Mechanical Lead detail section (`.featured`, carries `id="motorsport"`):
   - Role panel and three media panels (compact 3-column layout).
   - The `Visit Olin Electric Motorsports ↗` link lives here now (`.oem-link`), preserving the OEM link.
   - Nav `Motorsport` points to `#motorsport` (this section). (There is no hero CTA to this section anymore — see hero CTAs above.)
6. Capabilities:
   - Heading: `Capabilities` (renamed from `Contribution`).
   - Five cards in one row on desktop:
     `Team management`, `Mechanical architecture`, `Fabrication`, `Simulation and modeling`, `Controls and integration` — each with a `.cap-proof` "See: …" link; some use `data-open-project` to open the matching case-study modal.
7. Contact:
   - Heading: `Let's build cool stuff.`
   - Links: `kwu@olin.edu` (mailto, button primary) · `Download resume (PDF)` (→ `assets/kefan-wu-resume.pdf`, download, button secondary) · LinkedIn (button secondary, opens new tab). The old `kefanwu8888@gmail.com` button was REMOVED from the homepage contact section. Footer still links LinkedIn only.

## DOM / Anchor / ID Reference

_Originally verified 2026-06-29 against `index.html` + `script.js`; reconciled 2026-07-08 to match the actual current DOM (14 projects, no gearbox, "Capabilities" naming, 3D Studio nav/CTA). Re-verify before trusting if the files have changed since._

> ⚠️ **Footgun:** Section ids do **NOT** match their visible names. "Projects" = `id="work"` (there is no `#projects`). "Capabilities" = `id="capabilities"` (this section was labeled "Contribution" in older docs/screenshots — the live text and id have both been "Capabilities" for a while now). Also: the kicker on `#work` literally reads "Projects" but is `id="systems-title"`. Always navigate by id, not by visible label.

### Section / landmark map (DOM order)

| Visible name | Element & class | id | Linked from |
|---|---|---|---|
| (progress bar) | `div.progress` | — | (not linked; decorative, `aria-hidden`) |
| (header) | `header.site-header` | — | (not linked) |
| (main wrapper) | `main` (no class) | `top` | brand link `KW / Kefan Wu` → `#top` |
| Hero | `section.hero` | — (h1 is `hero-title`) | (not linked) |
| Projects | `section.systems` | `work` | nav `Projects` → `#work`; hero CTA `View projects` → `#work`; scroll cue `Scroll` → `#work` |
| Skills | `section.skills-matrix.section-shell` | `skills` | nav `Skills` → `#skills` |
| Motorsport | `section.featured.section-shell` | `motorsport` | nav `Motorsport` → `#motorsport` |
| Capabilities | `section.capabilities.section-shell` | `capabilities` | nav `Capabilities` → `#capabilities` |
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
| `Capabilities` (nav) | `#capabilities` | Capabilities `section#capabilities` |
| `Contact` (nav) | `#contact` | Contact `section#contact` |
| `3D Studio` (nav pill, `a.nav-experience`) | `experience.html` | 3D studio page |
| `View projects` (hero CTA, `a.button.primary`, `data-magnetic`) | `#work` | Projects `section#work` |
| `Enter the 3D Studio` (hero CTA, `a.button.studio`, `data-magnetic`) | `experience.html` | 3D studio page |
| `Scroll` (scroll-cue, `a.scroll-cue.stage`) | `#work` | Projects `section#work` |

There is NO `FSAE program` CTA anymore — the hero has exactly two CTAs (`View projects`, `Enter the 3D Studio`). All in-page hash anchors resolve — **no broken `#` targets**. Nav container is `id="site-nav"`. There is also a `.nav-toggle` button (read by JS).

### Project cards

Container: `<div id="project-cards" class="project-grid" data-reveal-group>`. Each card is `<article class="project-card" data-project="…" data-category="…">` with an `<h3>` title, a mono `.project-meta` index line, and a `.project-sub` outcome subtitle. **14 project cards total** (there is also a non-project 15th grid tile — see below). Open value passed to JS `openModal()` = `data-project`. There is NO `gearbox` project anywhere — it was removed from both the main site and the 3D studio.

| # | data-project | `<h3>` visible | data-category tokens | card-media variant | Notes |
|---|---|---|---|---|---|
| 1 | `steering` | Mk.8 steering system | `motorsport analysis fabrication` | `card-media card-media--contain` | |
| 2 | `javelin` | Javelin VTOL drone | `robotics analysis fabrication` | `card-media card-media--fill` | |
| 3 | `ansysCfd` | Agent-based CFD | `analysis software` | `card-media card-media--contain` | **download icon** (`a.project-download.project-download--icon` → `assets/claude_ansys_cfd.zip`); title sits inside `.title-row`; only card with `software` token |
| 4 | `carbonSeat` | Carbon fiber seat | `motorsport product fabrication` | `card-media card-media--contain` | |
| 5 | `brakeSim` | FSAE Brake Sim | `motorsport analysis` | `card-media card-media--fill` | |
| 6 | `scanner` | 3D scanner | `robotics analysis` | `card-media card-media--fill` | |
| 7 | `formlabs` | Smelly | `robotics product` | `card-media card-media--contain` | (h3 "Smelly", data-project `formlabs`) |
| 8 | `aura` | AURA swerve drive | `robotics product fabrication` | `card-media card-media--contain` | scroll-scrub/exploded modal (drives `modal-scrub-*` + `modal-spec`); 60-frame image sequence `assets/aura_explode/frame_001..060.webp` |
| 9 | `lineFollower` | LineFollower robot | `robotics product fabrication` | `card-media card-media--contain` | |
| 10 | `pool` | Pool Sniper | `robotics product fabrication` | `card-media card-media--contain` | |
| 11 | `seat` | Driver seat and harness | `motorsport product fabrication` | `card-media card-media--contain` | |
| 12 | `education` | Guitar education kit | `product fabrication` | `card-media card-media--contain` | |
| 13 | `telecaster` | Telecaster guitar | `fabrication product` | plain `card-media` | |
| 14 | `ftc` | FTC robot | `robotics fabrication` | plain `card-media` | |

Plus a 15th grid tile that is NOT a project: `a.project-card.project-card--studio` ("Walk the studio" → `experience.html`), spans 2 columns at ≥640px, visible under every filter, guarded out of the modal-open handlers in `script.js`.

### Filter chips

Container: `<div class="filter-bar" role="list" aria-label="Filter case studies" data-reveal>`. Buttons are `button.filter` with `data-filter`; `All` carries extra class `active` (`class="filter active"`). JS reads `button.dataset.filter` vs `card.dataset.category`.

| Chip label | data-filter | Matches data-category token(s) |
|---|---|---|
| All | `all` | special — matches every card (not a category token) |
| Motorsport | `motorsport` | `motorsport` (cards 1, 4, 5, 11) |
| Robotics | `robotics` | `robotics` (cards 2, 6, 7, 8, 9, 10, 14) |
| Product | `product` | `product` (cards 4, 7, 8, 9, 10, 11, 12, 13) |
| Analysis | `analysis` | `analysis` (cards 1, 2, 3, 5, 6) |
| Fabrication | `fabrication` | `fabrication` (cards 1, 2, 4, 8, 9, 10, 11, 12, 13, 14) |

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
- `.progress`, `.site-header` — scroll-progress / header animation targets. (`.set-piece` was fully removed from CSS and JS — do not look for it anymore.)
- `.nav-toggle` + `.site-nav` — mobile nav toggle.

### Hero / stats anchors

- **Ticker:** strip `div.hero-skill-strip.stage`; track class `hero-skill-track` (no id) — **two** tracks (visible + `aria-hidden` duplicate), each with **14** `<span>` labels: Arduino, TIG Welding, AutoCAD, Topology Study, SolidWorks, MATLAB, FEA, CFD, CNC Mill, Lathe, Waterjet, Carbon Fiber, Team Management, AI-Assisted Eng (renamed from Vibe Coding).
- **Eyebrow:** `p.eyebrow.stage` — "Mechanical Lead / Olin Electric Motorsports / MechE @ Olin College '28".
- **Headline:** `<h1 id="hero-title">`; inner `span.line > span.stage` ×2 → "Kefan", "Wu".
- **Stats bar** (`div.hero-stats.stage`), in order:

| Strong content | data-count | Label (verbatim) |
|---|---|---|
| `Mechanical Lead` (`strong.stat-word`) | (none) | Olin Electric Motorsports |
| `14` | `data-count="14"` | Engineering projects |
| `19`+ (trailing `+` outside span) | `data-count="19"` | Technical skills |
| `>30` (leading `>` before span) | `data-count="30"` | Engineers led |

### Contact & downloadable assets

- Contact section: `<section id="contact" class="contact" aria-labelledby="contact-title">`; kicker `p.section-kicker` "05 / Contact"; `<h2 id="contact-title">Let's build cool stuff.</h2>`; sub-copy "Seeking a Summer 2027 mechanical engineering internship — vehicle systems, robotics, or manufacturing. Email me and I'll reply within a day."
- Contact links (`div.contact-actions`): `mailto:kwu@olin.edu` ("kwu@olin.edu", `button primary`) · `assets/kefan-wu-resume.pdf` ("Download resume (PDF)", `button secondary`, `download`) · `https://www.linkedin.com/in/kefan-wu-olin/` ("LinkedIn", `button secondary`, `target="_blank"`). The old `mailto:kefanwu8888@gmail.com` button was REMOVED from the homepage contact section.
- Footer also links `https://www.linkedin.com/in/kefan-wu-olin/` ("LinkedIn").
- **Download asset:** `href="assets/claude_ansys_cfd.zip"` (`a.project-download.project-download--icon`, `download`, `aria-label="Download claude_ansys_cfd package"`) — lives on project card #3 `data-project="ansysCfd"` (`<h3>Agent-based CFD</h3>`). Plus the Contact resume PDF (`assets/kefan-wu-resume.pdf`, download) — the only two `download` links on the page.
- External: OEM `https://olinelectricmotorsports.com/` ("Visit Olin Electric Motorsports ↗", `target="_blank"`) in the Motorsport section.

### Leftover id anchors (not detailed above)

| id | Element | Role |
|---|---|---|
| `site-nav` | nav | header nav container (JS `.site-nav` toggle target) |
| `systems-title` | `p.section-kicker` | kicker text "Projects" inside `#work` (NOT the section id) |
| `skills-title` | `h2` | "Skill matrix" |
| `capabilities-title` | `h2` | "Capabilities" heading inside `#capabilities` (this section was previously labeled "Contribution" — that name is gone from the live site) |

Asset/version refs — see "Current cache versions" below for the authoritative, up-to-date strings; page title is "Kefan Wu | Mechanical Engineering Portfolio".

## Recent Important Changes

### 2026-07-10 (latest) the résumé IS the model's texture — one skin, zero switches
- After the motion-ghost fixes Kefan still saw the résumé "switch layout and
  font size" mid-pickup. Root cause: the desk sheet's printed texture was a
  dense Arial mini-layout while the DOM sheet is Inter with looser leading —
  the cross-fade itself WAS the switch. Per Kefan's own suggestion ("把简历
  当建模贴图"), the DOM-derived snapshot is now the sheet's ONE PERMANENT
  texture: desk prop, pickup flight, and held pose all show the exact same
  document. There is no texture swap at any point of the interaction, and the
  earlier blur-in mitigation stays removed (plain 220ms opacity dissolve over
  a glyph-identical layer).
- `buildSheetSnapshot()` (experience.js, above computePaperHold): rasterizes
  the laid-out DOM sheet into a 1024×1365 CanvasTexture — bg gradient,
  `.exp-sheet__rule`, `li::before` bullets, then every text node split into
  per-LINE fragments (per-character `Range.getClientRects` top-grouping,
  whitespace trimmed at wrap points) drawn at its measured client rect with
  its computed font. The Google webfonts are document-loaded so canvas 2D
  uses the real Inter/Inter Tight/IBM Plex Mono. Geometry is MEASURED from
  the live layout — resumeHTML/CSS edits stay in sync for free. Legacy-engine
  fallbacks (from the adversarial review): manual per-char tracking when
  `ctx.letterSpacing` is missing (Safari <16.4 / Firefox <116), and
  `actualBoundingBox*`-based ascent/descent when `fontBoundingBox*` is.
- `applySheetTexture()` wiring: paperEl's DOM is seeded at startup (hidden
  layout), and on `document.fonts.ready` the snapshot is built, pre-uploaded
  (`renderer.initTexture`) and assigned to `face.material.map`+`emissiveMap`
  permanently. `buildResumePaper()`'s Arial canvas is ONLY a boot placeholder
  for the few hundred ms before fonts land. beginPaperLift/closePanel call
  `applySheetTexture()` again purely as a width-refresh (snapshot cached by
  sheet width, old texture disposed on rebuild — O(1) no-op normally), which
  also covers resize-while-reading.
- Note the desk prop consequence: the sheet shows the DOM layout top-cropped
  to the paper's 3:4 coverage (bigger type, possibly cut above the contact
  line on tall viewports) instead of the old full-page Arial mini. This is
  intentional — do not "fix" it back, it is what makes the pickup seamless.
- Verified (Chromium, `__exp.pump`): texture identity constant across the
  whole cycle (rest→click→lift→held→Esc→landing, same uuid), desk close-up
  render reads correctly, landing posErr 0, no console errors, mobile 390×844
  rebuilds the snapshot at its own width. Cache: `exp-papertex-20260710`.

### 2026-07-10 pickup ghosting fix — three compounding causes
- Kefan approved the 3D pickup but reported ghosting (虚影) during lift AND
  return. Three verified causes, all fixed (cache `exp-noghost-20260710`):
  1. **Arc term had max speed at the endpoints.** The lift bow was
     `sin(pi*k)*0.045` — its derivative peaks exactly at k=1, so the sheet was
     still dropping ~310px/s when the DOM cross-fade started (measured 19.1px
     of on-screen slide during the fade → double-exposed text). Both arcs now
     ride the EASED value (`sin(pi*e)`), which has zero end-slope. Measured
     slide after the fix: **0.1px**. Also gives a soft landing on the desk.
  2. **Reading-DoF opened during the motion.** Bokeh gather-bleed smears the
     bright moving sheet into the blurred room. Now gated on
     `paperSettled = ... && !paperMotion` — aperture stays 0 through the whole
     lift and only eases in once the sheet is still.
  3. **Stale-focus defocus on close (the worst one).** After closePanel,
     `want=0` eased the aperture out at 8%/frame (~0.4s tail) while the focus
     uniform stayed STUCK at the held distance (~0.47m, empty air) — the whole
     return flight rendered defocused. closePanel now hard-zeros
     `bokeh.uniforms.aperture.value` under the overlay fade, and the focus
     stays pinned to the sheet whenever `activePaperPivot && paperHold` exists.
  - `PAPER_DOM_FADE_AT` raised 0.78 → 0.93 (at 0.78, ~40px of path-slide
    remained during the fade even before the arc term).
  4. **Cross-fade double-text (residual, found by adversarial review).** The
     canvas texture (Arial, own wrap) and the DOM sheet (Inter, CSS reflow)
     typeset the same copy with different line breaks — a plain dissolve
     briefly showed two legible text layers. First mitigated with a
     `blur(6px)` fade-in; SUPERSEDED the same day by the DOM-parity snapshot
     (see the newest entry above), which solved the mismatch properly — the
     blur was removed again.
  - Verified by frame-stepped measurement (`__exp.pump`): fade-start slide
    0.1px, aperture 0 at every sampled lift/return frame, landing tail
    velocity 0, exact desk pose restore, clean classes; race stress tests
    (Esc in the 430ms delay window / mid-lift / during the DOM fade, double
    click, click during return, interrupted-return resume) all land posErr 0.
    A 3-lens adversarial review workflow (Sonnet, xhigh) confirmed the
    diagnosis, independently re-found the arc bug, verdicted the patch
    regression-free, and ruled out reflector/shadow/GTAO/MSAA/flicker/bloom
    as residual sources (bloom stays untouched: the moving sheet sits below
    the 0.96 linear threshold mid-flight, and gating bloom globally would
    pop every other emitter's halo).

### 2026-07-10 résumé pickup rebuilt as a TRUE 3D lift (proxy deleted)
- Kefan reported the proxy-based pickup still felt janky and the résumé still
  visibly "changed" on pickup/return. Root cause was structural: ANY
  screen-space DOM proxy diverges from the WebGL render (raw sRGB canvas vs
  ACES-tone-mapped warm-lit sheet; CSS-compositor clock vs rAF clock; CSS
  `perspective(900px)` vs the real camera projection). So the whole
  `#exp-paper-proxy` channel was DELETED (HTML canvas element, `.exp-sheet-proxy`
  CSS, projection JS) and replaced with an in-engine pickup:
  - `beginPaperLift()` flies the REAL paper pivot in world space from its desk
    pose to a camera-facing "held" pose. `computePaperHold()` back-projects the
    DOM sheet's `getBoundingClientRect()` into camera space (distance chosen to
    fit the rect on BOTH axes; width + top edge anchored, X centered), so the
    printed 3D face lands pixel-aligned with the DOM sheet — verified exact to
    0.1px at 1280×720 and 390×844. The held target is recomputed per frame
    while the camera is still flying, so the two motions overlap (lift starts
    430ms into the 850ms approach) and converge — one continuous
    reach-and-pick-up, sequenced entirely on RENDER-LOOP time (no wall-clock
    timers for motion; a busy main thread can't desync it).
  - The face material carries `emissiveMap` from build time (intensity 0 = no
    change on the desk; ramping it is a uniform write, NO shader recompile).
    Held glow calibrated by pixel sampling vs the DOM's #fafbfd: night 0.7
    (~239 sRGB; 1.0 matched white exactly but bloom washed the small type),
    day 0.5 (the held sheet faces AWAY from the key light).
  - DOM sheet (`.exp-sheet`) fades in at lift-progress 0.78 over 220ms with the
    backdrop, covering the identical rect; the pivot is hidden only after the
    fade. `.exp-sheet` width gained a `calc(86vh * 0.75)` term so short
    viewports keep the physical 3:4 aspect (else the DOM was 14% wider at the
    swap). The sheet is pre-painted during the approach (inline
    `visibility:visible` + `will-change:opacity`).
  - Close reverses it: DOM+backdrop fade out revealing the sheet (re-aligned to
    the CURRENT camera/viewport first — resize-safe), then it flies back to a
    `userData.deskPose` captured once (return lands with posErr/quatErr = 0)
    while the camera pulls away. Esc mid-lift turns the sheet around from
    wherever it is (return duration scales with distance). Bokeh now focuses on
    the held sheet (aperture 0.0012) so the room falls off behind it.
  - QA affordance: the render loop is a named `tick(t, forced)` and
    `__exp.pump(t)` hand-steps frames with synthetic timestamps — the ONLY way
    to drive/verify the scene in a backgrounded preview tab where rAF never
    fires. Verified: open/close cycles, Esc mid-lift, project-panel regression,
    day/night sampling, mobile 390×844 (no overflow), desktop 1280×720.
  - Cache: `exp-pickup3d-20260710`.

### 2026-07-10 smooth, identity-stable résumé pickup (SUPERSEDED same day — proxy deleted, see above)
- Kefan reported two regressions in the projected pickup: the animation was
  visibly janky, and the résumé appeared to change while being picked up or
  returned. Root causes: the full scrollable DOM résumé (many text nodes,
  shadows, overflow, and perspective) was being transformed, while the 3D
  paper still used a simplified placeholder-like canvas.
- `#exp-paper-proxy` is now a dedicated 768×1020 canvas and the ONLY moving
  layer. `buildResumePaper()` draws the real `RESUME` content once and stores
  that same source canvas on the 3D paper group; the overlay proxy copies it,
  so the physical paper and moving paper are pixel-identical.
- The heavy interactive DOM résumé is laid out invisibly during the 850ms
  camera approach. The proxy then lifts for 500ms using compositor-only
  transform/opacity, and the DOM cross-fades in over 160ms only after movement
  stops. Close reverses the handoff before the proxy returns to the desk.
- The proxy preserves the physical 256:340 paper aspect on mobile instead of
  stretching to the tall scroll viewport. Desktop 1440×900 and mobile 390×844
  were verified with no overflow, console errors, or project-panel regression.
  Cache: `exp-resumeproxy-20260710`.

### 2026-07-09 résumé now lifts from the physical desk sheet
- The résumé overlay no longer enters from the bottom of the viewport. On
  activation, the camera first finishes its desk approach; `openPaper()` then
  projects the four corners of the real 3D sheet through the current camera and
  writes its screen position, scale, in-plane angle, and perspective tilt into
  CSS custom properties. The DOM sheet starts exactly there and lifts to the
  centered reading position over 560ms.
- The 3D résumé pivot (including its interact marker) is hidden only after the
  DOM sheet takes over. Close reverses the transform, restores the physical
  sheet at the desk, and only then flies the camera back to the room. Resize is
  safe because the pickup pose is projected again immediately before closing.
- Reduced-motion still opens/closes effectively instantly. Pointer and keyboard
  input are gated during the return-to-desk beat. Cache:
  `exp-resumepickup-20260709`.

### 2026-07-09 quieter grey display cabinets
- Per Kefan: the grey wood across both cabinets was visually too busy. The
  selected direction is **solid satin-grey frames + slightly deeper,
  low-contrast grey-wood backs**, with the existing tinted-glass shelves and
  blue/cool LED strips left exactly as they were.
- Cabinet sides, tops, plinths, and dividers now use a texture-free satin-grey
  `MeshStandardMaterial` (`0x9da3aa`, roughness 0.60). Wood is limited to the
  two back panels (`0xb9bfc6`, roughness 0.78).
- `dark_wood_diff_grey_1k.jpg` keeps the same neutral mean but has 42% of the
  former contrast. `grey_wood` repeat is `[1,1]` (was `[2,1]`) and cabinet-back
  normal scale is 0.30, so the grain stays legible up close without competing
  with the exhibits or shelf lighting.
- Cache: `exp-quietwood-20260709`.

### 2026-07-09 the desk lamp now REALLY lights the résumé
- ⚠️ **This reverses the old "task lamps emit no light" rule for the DESK
  lamp.** Kefan asked for it explicitly (in the dark room the lamp's light
  was invisible and never touched the paper). Do NOT "fix" it back. The
  BENCH lamp still emits no light.
- Root cause of the old look: `resumeSpot` sat at `(0.3, 1.8, 0.9)` — in
  mid-air in FRONT of the desk, nowhere near the lamp — and the cantilever
  arm barely reached over the desk.
- Now: `buildModernDeskLamp` has a taller column (0.24→0.40) and longer arm
  (0.21→0.34) and exposes `g.userData.headLocal` (the LED's local position).
  `deskLamp.rotation.y` 0.9→-0.05 aims the arm straight down the desk at the
  paper. In initScene, `resumeSpot` is placed at
  `deskLamp.localToWorld(headLocal)` (world ≈ -0.49, 1.13, 0.15), targets the
  résumé, and `castShadow` on desktop (`!LOW_TIER`, 1024², bias -0.0009).
- Tuned by rendered frames (values are load-bearing, don't drift):
  angle **0.40**, penumbra **0.45**, decay 1.6, distance 2.4; night
  intensity **2.8** (3.5+ blows out the résumé body copy); pendant night
  0.7→**0.3**; lamp LED emissive night 1.5→**2.4**. `runBootIntro`'s
  lamp-click beat was updated from the stale 1.6 to land on 2.8.
- Useful fact learned while debugging: kill every real-time light and the
  **desk stays bright but the résumé paper goes dark** — the desk top's
  brightness is the pre-baked OFF lightmap, the paper is real-time-only.
  So the lamp can never make a strong *pool on the desk* without a re-bake;
  it CAN own the paper, which is what matters. Don't chase desk contrast by
  raising the spot — narrow the cone instead.
- Grey cabinet wood lightened: `dark_wood_diff_grey_1k.jpg` regenerated at
  ~150 mean luminance (was ~94), neutral (R−B≈2), grain range 111..184
  preserved; back-panel tint 0x9aa0a6→0xb9bfc6. Cache:
  `exp-desklamp-20260709`.

### 2026-07-09 cabinets → grey open-pore wood
- Per Kefan: both display cabinets went from near-black steel to GREY wood
  (Mercedes-interior open-pore look). New texture
  `textures/dark_wood/dark_wood_diff_grey_1k.jpg` = the Poly Haven dark_wood
  diffuse desaturated/lifted/cooled offline via PIL (recipe in the commit);
  it shares the original's normal/roughness maps. `setupTextures` has a
  `grey_wood` slug; `woodMaterial(tint, rough, slug)` gained the optional
  slug param. Cabinet frames use tint 0xd9dde2 rough 0.62, back panels
  0x9aa0a6 / 0.72. The tinted-glass shelves + LED strips are untouched
  (Kefan explicitly likes them — do not restyle). An earlier warm-walnut
  tint was tried and rejected mid-flight in favor of grey. Cache:
  `exp-greywood-20260709`.
- Later the same day, the grain was quieted and limited to the back panels;
  see the latest `exp-quietwood-20260709` entry above.

### 2026-07-09 (later) two-surface aesthetic pass (Kefan-approved item list)
31 approved items from a 6-lens review of both pages. Highlights:
- **Homepage tokens:** border alphas → --line-subtle/--line/--line-mid/
  --line-strong/--line-bright; shadows → --shadow-sm/md/lg; near-blacks →
  --ink-dark/--bg-recessed. `.project-sub` clamp 2→3 lines (+ellipsis) — the
  2-line clamp had been silently cutting the outcome metric on 13/14 cards.
  Only the nav pill keeps the studio-pulse animation. h1 tracking -0.015em;
  .hero-copy text-wrap:balance; --mx/--my now drive a card-hover spotlight.
- **Fixed bugs:** index.html favicon href pointed at assets/favicon.svg
  (the file lives at the ROOT — href="favicon.svg"); AutoCAD skill-hover
  image (CORS-broken paintingvalley hotlink) → local steering CAD render;
  stepProject left the outgoing exhibit stuck mid-spin (rotation now resets
  synchronously); GTAO was accidentally disabled globally by the USE_BAKED
  gate (now `if (!LOW_TIER)`).
- **3D night grade:** benchGlow recolored 0xffd9a8→0xe8ecf2 (cool LED, so
  moon/resume/strips read as 3 zones); pendant joined applyLightState
  (day 2.6 / night 0.7); carbon bucket clearcoat 0.7 + envMapIntensity 2.6,
  javelin aero tweak envMapIntensity 1.6 (dark exhibits readable at night);
  `dark` bucket metalness 0.55→0.15 (painted, not raw metal), aura printed
  →0.05, driverseat steel →0.85; Bokeh aperture target 0.00022→0.0018,
  maxblur 0.008→0.018 (DoF actually visible now); resume marker offset to
  the sheet's corner.
- **Desk lamp REBUILT** (buildModernDeskLamp): cantilever task lamp — round
  base, edge column, joint sphere, arm + counterweight, slim LED head. Same
  pivot/hitbox/lampLeds registration; still emits no light.
- **Interaction:** drag hint now waits for the intro to land; deep links set
  kw_intro_seen + show hints after panel close; Prev/Next cross-fades panel
  content (150/200ms) and resets the outgoing turntable; panel opens at
  680ms of the 850ms flight.
- **KEYBOARD LAYER (new):** #exp-canvas is focusable (tabindex=0,
  role=application); Arrow keys cycle PROJECT_ORDER + resume + lamp via the
  existing setHover path (kbOrder() rebuilds per-keypress because GLB
  hotspots attach asynchronously — do NOT snapshot it once); Enter/Space
  activates; panel got role=dialog aria-modal, focus moves to its close
  button and returns to the canvas on close. Keys are ignored while
  flight/panel/lightbox is active (so they no-op during the intro).
- **Sound toggle:** two inline SVGs (.snd-off/.snd-on) swapped by the
  .is-on class — initSoundToggle never touches innerHTML now; no emoji.
- **Overlay parity:** panel kicker muted+0.08em (was blue+0.2em); branded
  square bullets on panel lists; reduced-motion covers .exp-sheet/backdrop/
  lightbox; brand mark + return-link mirror the homepage; experience.html
  got favicon.svg + og:image=studio-hover.webp (1280×800).
- Cache: styles/script `aesthetics-20260709`; experience
  `exp-aesthetics-20260709`. NOT approved/deferred: B5-B7, C5/C6/C8/C10,
  D1/D7/D9, E3/E5/E6/E7, and the OG-card/ticker-pause/--quiet backlog.

### 2026-07-09 studio tile: frame loop → single-still Ken Burns (final)
- Kefan reported the tile STILL flickered after the cross-fade rebuild. Root
  cause: mid-blend, two ~50%-opacity frames cover only ~75% of the tile, so
  the backdrop pulses through on every change; adjacent frames also ghost.
  Discrete frames are structurally flicker-prone — **do not reintroduce frame
  sequences on this tile** (two attempts, both flickered; the CSS comment at
  `.studio-orbit` says the same).
- Now: ONE still (`assets/studio-hover.webp` = the old middle orbit frame)
  with a 26s ease-in-out alternate Ken Burns drift (`@keyframes studio-pan`,
  scale 1.07→1.16 + lateral drift), transform-only/GPU. Layer fades in on
  `:hover`/`:focus-visible`; drift runs via `animation-play-state` (paused by
  default, resumes where it stopped). script.js `initStudioOrbit()` only
  lazy-injects the `<img>` on first hover/focus intent — insert on `onload`,
  NOT `img.decode()` (decode() can hang for detached images in backgrounded
  tabs). The 9 other orbit frames were deleted (~420KB); the re-capture
  recipe below still works if a new still is ever needed.
- Cache strings: styles.css + script.js → `kenburns-20260709`.
- Verification caveat learned here: the preview pane is a BACKGROUND tab —
  Chromium freezes CSS-animation clocks when `document.hidden` (getAnimations
  currentTime stays 0), so CSS animation playback cannot be observed there
  (JS timers still run). Verify bindings/rules instead, or check live.

### 2026-07-08 (later) studio banner REMOVED; orbit rebuilt flicker-free
- Kefan: the banner's in-view frame loop flickered / read as low-FPS →
  the whole pre-Contact "One more thing" `.studio-banner` section was
  REMOVED (HTML + its CSS block + the @media-print reference). The studio
  funnel keeps its other entry points (hero CTA, nav pill, deep links,
  modal cross-links, grid tile).
- The orbit animation on the "Walk the studio" tile was REBUILT: the old
  `background-image` URL swap repainted the tile every step (the flicker
  source). `initStudioOrbit()` now injects a `.studio-orbit` layer of 10
  stacked `<img>` frames and cross-fades opacity (compositor-only):
  420ms/frame + 360ms linear dissolve = smooth slow pan. The layer carries
  its own copy of the tile's darkening gradient (`.studio-orbit::after`)
  and sits under `.project-body` (z-index 1); the layer itself fades in/out
  via CSS on `:hover`/`:focus-visible`. Same gating (desktop + fine pointer
  + motion; static teaser otherwise). Frame assets and the re-capture
  recipe below are unchanged.
- Cache strings: styles.css + script.js → `orbitfix-20260708`.

### 2026-07-08 homepage polish + studio-orbit teaser (approved by Kefan)
A design/a11y/copy/SEO polish pass across the homepage. All LIVE.
- **Type/layout:** raised the fluid-type ceilings (`--text-display` 7.5→9rem,
  `--text-h2` 3.75→4.4rem — ramps unchanged, so headings grow on ≥1240px
  screens without shrinking anywhere); added `--pad-section` /
  `--pad-section-lg` rhythm tokens; `.dark-panel h3` → `--text-title`; dropped
  the dead 3.2rem modal-h2 rule; `text-wrap: balance` on headings.
- **Motion:** `:active` press feedback (scale on chips/links, brightness on
  buttons — buttons use filter to avoid the JS magnetic transform); keyboard
  `.project-card:focus-visible` lift; capped reveal stagger; card image-zoom
  800→500ms; magnetic pull scales with button size; non-Chrome modal grows
  from the clicked card (transform-origin); `will-change` on the card tilt;
  scroll-cue waits for >80px.
- **A11y:** 44px touch targets (mobile `.filter`, `.cap-proof`); filter
  `aria-pressed`; `#motorsport` now `aria-labelledby` its heading; gallery
  images always get an alt; eyebrow wraps only at the slashes.
- **Copy:** hero value-prop subhead restored (`.hero-copy`, "…race-car
  systems, robots, and machined hardware — from load cases to finished parts.")
  — NOTE this re-adds a line trimmed on 2026-07-07, per Kefan's explicit
  request. Rewrote seat / carbonSeat / lineFollower highlights to lead with
  outcomes; removed a placeholder ("updated photos…") bullet.
- **Premium/SEO:** `::selection`, dark scrollbar, `@media print`; SVG favicon
  (`favicon.svg`, KW monogram); Person JSON-LD; footer signature line; new
  `robots.txt`, `sitemap.xml`, on-brand `404.html`.
- **Studio-orbit teaser (the "wow" bit):** the "Walk the studio" tile and the
  pre-Contact studio banner now gently pan a 10-frame orbit of the REAL 3D
  scene instead of a flat photo. Frames live in `assets/studio_orbit/frame_00
  ..09.webp` (1280×800 night renders, captured from experience.html via
  `composer.render()` + `canvas.toDataURL` POSTed to a throwaway local receiver
  — see below). `initStudioOrbit()` in script.js swaps ONLY the image layer of
  each element's existing background (the darkening gradient stays on top, so
  text legibility is untouched), ping-pong loop, lazy-loaded on first
  activation. Tile→hover/focus, banner→scroll-into-view. Desktop + fine-pointer
  + motion only; mobile and reduced-motion keep the static `studio-teaser.webp`.
  To RE-CAPTURE frames: run a tiny POST receiver (a scratch `snapsrv.py` that
  b64-decodes POST bodies into `assets/studio_orbit/`), load experience.html in
  the preview, wait for `window.__exp`, then loop azimuth (rest ≈0.61, radius
  ≈3.81, target (0,0.75,-0.1)) setting `camera.position`+`lookAt`,
  `composer.render()`, `toDataURL('image/webp')`, and `fetch(..., {mode:'no-cors'})`
  each frame. (There is still no committed snapsrv.py — it's a throwaway.)
- Cache strings after this pass: see "Current cache versions" (styles.css
  `polish-20260708`, script.js `studio-20260708`, project-data.js
  `polish-20260708`). NOT applied (Kefan deferred): external-hotlink skill
  images (#2), `--quiet` contrast (#3), ticker pause control (#4), card-hover
  tool chips (#9), designed OG share card (#11). heads-up: the AutoCAD
  skill-hover image (paintingvalley.com hotlink) is now CORS-blocked/broken
  live — part of #2.

### 2026-07-08 doc-truth + cleanup pass
- `AGENT_HANDOFF.md` reconciled to the actual current state: 14 projects (no
  `gearbox` — it was removed earlier and this doc had not caught up), the
  "Current Site Structure" and "DOM / Anchor / ID Reference" sections were
  heavily rewritten (the old 2026-06-29 DOM table was stale and
  self-contradictory against the newer 2026-07-07 changelog entry below it).
- 33 orphaned asset files pruned from `assets/`: the entire `gearbox-*`,
  `wankel-*`, and `noise-*` families; `oem-mk7-track.jpg` / `oem-track.webp` /
  `hero-oem.webp`; `skill-bambu` / `skill-form4` / `skill-matlab` /
  `skill-solidworks.webp`; plus `cover-aluminum-seat-trim.webp`,
  `cover-ansys-cfd-fit.webp`, `cover-noise-reduction.webp`,
  `education-kit-white.webp`, `fsae-mk7-build.webp`,
  `linkedin-cockpit-seat.webp`, `ansys-cfd-cp-top.webp`,
  `ansys-cfd-pressure-top.webp`, `scanner-gantry.webp`.
- Dead code removed: `experience.js` `buildSkillPaper()` (the desk skill-matrix
  paper it built was already removed; the function itself was unused); and in
  `experience-data.js` the unused `HERO_PROJECTS` array and `ACCENT` constant.
- `experience.css` / `experience.js` cache strings bumped to
  `exp-cleanup-20260708` (from `exp-deeplink-20260707`).

### 2026-07-07 homepage refresh + 3D-studio conversion funnel (approved by Kefan)
The homepage got a full pass to sell outcomes and funnel visitors into the 3D
studio. Everything below is LIVE.

- **3D-studio entry points (was ONE nav link, now six):**
  - Hero has a co-primary CTA `Enter the 3D Studio` (`.button.studio` — blue
    outline + pulsing live-dot). Hero now has exactly two CTAs: `View projects`
    and `Enter the 3D Studio` (the `Resume (PDF)` hero button was removed
    2026-07-07 per Kefan; the resume download still lives in Contact).
  - Nav `.nav-experience` restyled as the only pill in the header (mono, blue
    border, pulse dot).
  - **Deep links:** `experience.html#<projectKey>` flies straight to that
    exhibit and opens its case study, skipping the cinematic intro. Handled in
    `experience.js` `doReveal()` — reads `location.hash`, finds the pivot in
    `HOTSPOTS` by `userData.hotspot.key`, calls `focusHotspot()`. The 14 keys
    match `data-project` attrs, `projectData` keys, and `PROJECT_ORDER`.
  - Every case-study modal has `#modal-studio-link` ("View this exhibit in the
    3D Studio") — `openModal()` sets its href to `experience.html#<key>`.
  - 15th grid tile `.project-card--studio` ("Walk the studio", `studio-teaser.webp`
    background, spans 2 columns at ≥640px, visible under every filter) — it's an
    `<a>`, not a modal card (script.js guards it out of the modal handlers).
  - Full-width `.studio-banner` before Contact. (REMOVED 2026-07-08 per Kefan
    — its frame loop flickered; see the newest changelog entry.)
- **Content:** outcome-driven hero copy (later trimmed to just the title cluster);
  every project card gained a mono index line (`.project-meta`, "01 / Motorsport")
  + one-line outcome subtitle (`.project-sub`); stats bar fixed to 14 projects /
  19+ skills / >30 engineers led; steering summary rewritten with numbers;
  `Vibe coding` renamed everywhere to **AI-assisted engineering** (hero ticker,
  skill matrix cell, `heroSkillDetails` key is now `ai-assisted eng`); Contact
  asks for a Summer 2027 internship; Capabilities cards gained `See: …` proof
  links (`data-open-project` opens the matching modal).
- **New assets:** `assets/studio-teaser.webp` (in-engine night render of the
  studio, reused by the tile + banner) and `assets/kefan-wu-resume.pdf`
  (generated from the RESUME data via reportlab; Kefan may replace with his own
  file at the same path). `.gitattributes` added to mark binaries.
- **Visual coherence:** brand blue deployed (progress bar, active filter, stats
  numerals, global `:focus-visible` ring); project cards are solid surfaces
  (glass/sheen reserved for floating chrome); fluid type scale + `--text-title`;
  `.card-media--contain` kept PURE WHITE so CAD renders blend (any tint/img
  filter shows a grey letterbox edge — do NOT re-add one); Projects section
  background is solid `#000` (blueprint grid lines removed).
- **Motion:** card→modal shared-element morph (View Transitions, `case-hero`);
  `scrollbar-gutter: stable` kills the modal-open jump; damped scrub frame glide;
  hero counters wait for their reveal (tabular-nums); magnetic buttons eased;
  progress bar is compositor-only (`transform: scaleX`). All new motion is gated
  behind `@media (prefers-reduced-motion: no-preference)`.
- **Hero layout (2026-07-07):** `.hero` uses `align-content: space-between` so
  the eyebrow + ticker pin to the top and the stats bar sinks to the floor;
  `.hero h1` has `margin-top: clamp(2.5rem,15vh,11rem)` so the title sits near
  the vertical middle; stats cells a touch taller; hero image `object-position:
  50% 70%` rides the car up on wide/short viewports so the stats bar never
  covers it (no effect on standard/tall viewports).

### 2026-07-06 3D-studio fixes (see also the L5 section below)
- Carbon seat (`models/real/seat.glb`) seam spikes fixed: the CF_Seat STL has
  19 non-manifold center-seam edges, so ANY position-smoothing (Loop subdiv,
  Taubin) explodes there. Re-exported with `tools/stl2glb_carbonseat.py` using
  `trimesh.graph.smooth_shade` (vertex-normal smoothing only, geometry
  untouched). The faceted look was flat shading, never a topology problem.
- Desk-lamp light switch made reliable: generous invisible hitbox (child of the
  lamp) + the interact marker parented to the lamp; `applyLightState` carries a
  `lightGen` counter so rapid double-toggles can't strand the wrong grade.
- The resume volumetric beam cone + dust motes were REMOVED (read as artificial);
  the warm resume spot stays. The potted plant was removed. Right cabinet shifted
  +0.3 along the wall (`CAB2.z`). Shelf-edge aluminum bars removed (they aliased
  into a dashed sparkle line under the follow-spot). Desk papers + CFD screen
  supersampled/anisotropic.

### Older changes

- `ESP32` was removed from the hero skill ticker only. Do not remove ESP32 from project/tool descriptions unless requested.
- Added hero ticker skills:
  - `TIG Welding`, image `assets/skill-tig-welding.jpg`.
  - `Team Management`, image `assets/skill-team-management.jpg`.
  - `Vibe Coding`, image `assets/skill-vibe-coding.jpg` (Unsplash, free commercial license, downloaded locally). Hover-card key was `vibe coding` in `heroSkillDetails` at the time. Skills stat bumped to `19+`. (This ticker entry was later renamed to `AI-Assisted Eng` on 2026-07-07 — see below; the `heroSkillDetails` key is now `ai-assisted eng`, and there is no `vibe coding` key anymore.)
- Replaced four hover-card skill images (in `heroSkillDetails`):
  - `CFD` -> own render `assets/ansys-cfd-pressure.webp`.
  - `SolidWorks` -> own render, at the time `assets/gearbox-render.webp` (was `seat-cad.webp`). That image has since been deleted along with the rest of the `gearbox-*` asset family (2026-07-08 orphan cleanup, after the gearbox project itself was removed); the `solidworks` key in `heroSkillDetails` now points at `assets/cover-steering-system-cad.webp`.
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
- ~~Olin Electric Motorsports background uses the local image copied from the OEM site: `assets/oem-mk7-track.jpg`.~~ Stale: that set-piece was removed (see 2026-07-01 entry below) and `assets/oem-mk7-track.jpg` was deleted as an orphaned asset in the 2026-07-08 cleanup pass. There is no OEM background image on the page anymore.

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
- `styles.css?v=aesthetics-20260709` (in index.html)
- `script.js?v=aesthetics-20260709` (in index.html)
- `project-data.js?v=polish-20260708` (shared case-study data; loaded before script.js on index.html and before experience.js on experience.html — bump in BOTH)
- `experience.css?v=exp-papertex-20260710` (3D page styles — in experience.html)
- `experience.js?v=exp-papertex-20260710` (3D page module — in experience.html)
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
- Section transition/fade issues are mainly in `styles.css` around `.hero::after`, `.systems`, and `.systems::after`. (`.set-piece` / `.set-piece-sticky` no longer exist — fully removed 2026-07-01.)
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
site, reached from the homepage nav link **`3D Studio`**
(`<a href="experience.html" class="nav-experience">` in `index.html`) and the
hero CTA **`Enter the 3D Studio`**. The
static homepage stays the canonical, recruiter-facing surface (the 3D page
sets `<link rel="canonical" href="https://www.kefanwu.com/">`); this page is
the "wow" layer. It is buildless: `three@0.185.0` via a jsDelivr importmap,
no bundler, no install.

### Files

| File | Role |
|---|---|
| `experience.html` | shell: topbar (KW brand, sound toggle, "All projects", "View classic site"), loader, overlay containers (`#exp-label`, `#exp-backdrop`, `#exp-panel`, `#exp-paper`, `#exp-lightbox`), `#exp-canvas`, importmap. (`#exp-paper-proxy` was deleted 2026-07-10 — the pickup is now animated on the real 3D sheet.) |
| `experience.css` | all overlay styling. Palette tokens MIRROR the site (`--bg #0b0c0e`, `--ink #f5f5f7`, `--blue #3f8cff`). Key blocks: `.exp-panel` (project side panel), `.exp-sheet` (interactive résumé that cross-fades in over the held 3D sheet), `.exp-lightbox`, `.exp-label` (hover info card), `.exp-sound`. (`.exp-sheet-proxy` was deleted 2026-07-10.) |
| `experience.js` | ~3500-line ES module: the whole scene. Sole data import is `RESUME` from `experience-data.js`; case-study content comes from `window.projectData` (set by `project-data.js`, loaded classic-script BEFORE the module). |
| `experience-data.js` | exports ONLY `RESUME`. The legacy `HERO_PROJECTS` array and the unused `ACCENT` constant (no longer imported after the 2026-07-03 cleanup) were DELETED on 2026-07-08. |
| `tools/stl2glb.py` / `stl2glb_new.py` / `stl2glb_carbonseat.py` / `stl2glb_seat.py` | offline STL→GLB merge pipelines (trimesh) for the real CAD exhibits. |
| `models/real/*.glb` | 12 real merged assemblies: aura, brakeSim, driverseat, education, javelin, lineFollower, pool, scanner, seat, smelly, steering, telecaster. (The original `stl2glb.py` batch produced 5 of these — aura, javelin, scanner, seat, steering — the other 7 were added later by the other `stl2glb_*.py` scripts.) |
| `hdri/`, `textures/` | the only third-party assets (Poly Haven CC0; see `ATTRIBUTIONS.txt`). Everything else is procedural. |

### Scene

Graphite engineering office, FULLY enclosed (4 walls + ceiling + front
wall). The camera is OrbitControls-limited (azimuth ±0.32π, distance
1.4–3.2, polar clamped) AND additionally hard-clamped to the room's
interior AABB every frame in the render loop — no orbit/zoom combination
can see past a wall. All furniture is procedural: sit-stand desk (telescopic
columns, T-feet, keypad), two display cabinets (satin-grey frames + subdued
grey open-pore wood backs + tinted glass),
electronics workbench (Bambu H2S built to the reference photo w/ top AMS 2
spool bay, programmable PSU, soldering station, screwdriver set, multimeter,
pegboard of MechE tools — rule/drill/Dremel/torque wrench/caliper/hex keys/
hammer/cutters/tape/level/hex keys/square/adjustable wrench/strippers, LED
bar lamp), rolling 5-drawer tool chest, real ergonomic mesh task chair
(models/ergonomic_mesh_office_chair, CC BY 4.0 — see ATTRIBUTIONS.txt;
intrinsic front is +x, rotY 1.34 faces the desk), blueprint wall panel,
ceiling cove LED strips, graphite rug (noise map + bump for plush).
(The right cabinet's bottom compartment — below the lowest shelf — is
currently empty; a helmet + motor prop set was tried there and removed.
The potted plant was removed 2026-07-06 per owner request.)

### Exhibits — all 14 projects clickable (15 content hotspots: + resume; 16 at runtime including the lamp pseudo-hotspot)

> `HOTSPOTS.length` is 16 at runtime and the boot `console.info` prints 16 —
> that's 14 project exhibits + the resume (`action:"resume"`) = 15 CONTENT
> hotspots, PLUS the desk-lamp pseudo-hotspot (`action:"lamp"`, `key:null`)
> which is also stored in the `HOTSPOTS` array. If you see "15 hotspots"
> in older notes it means the 15 content ones, not the raw array length.

> Gearbox was removed (main site + 3D). Right cabinet now holds 5 exhibits
> with the bottom-right slot deliberately empty.

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
    (seat.glb), `aura` (aura.glb — a HAND-TRIMMED SINGLE swerve module;
    the full Drive_System STL has both modules and renders as a pair, so
    aura is commented out of stl2glb.py — do NOT regenerate it), `scanner`
    (scanner.glb, blue printed brackets + plywood base), `javelin`
    (javelin.glb, dark shell), `steering` (steering.glb), `brakeSim`
    (brakeSim.glb, silver rotor), `lineFollower` (lineFollower.glb, orange
    wheels), `education` (education.glb — EXPLODED guitar kit, laid
    horizontal via rotZ=π/2 + axis "x", blue body / maple neck).
  - Procedural: `ansysCfd` (buildCfdDisplay — a monitor showing the CFD
    result) is the only remaining procedural main-cabinet exhibit.
- **Right-wall cabinet** (2 bays × 3 rows, layout const `CAB2`):
  - REAL GLBs: `formlabs` (smelly.glb, perfume mixer), `pool` (pool.glb,
    cue launcher), `telecaster` (telecaster.glb, stands vertical).
  - Procedural: `seat` (buildDriverSeat — the DRIVER seat/harness project,
    distinct from `carbonSeat`), `ftc` (buildFtcBot).
  - `SIDE_EXHIBITS` entries carry either `build` (procedural) or `file`
    (loads `models/real/<file>.glb` via loadAssembly).

> The 6 new real GLBs were made by `tools/stl2glb_new.py` from per-part
> SolidWorks STL exports in subfolders of `C:\Users\oc\Desktop\STL`
> (Brake, Guitar Education, Line_Follower, Pool Sniper, Smelly, Telecaster).
> Same `mat_<bucket>` scheme as `stl2glb.py`, plus two new buckets — `wood`
> (guitar bodies/necks, pool cue) and `pcb` (Arduino/driver boards) — with
> matching `ASSEMBLY_MATS` entries. Decimation is GENTLE (90k–160k tris,
> 1.4–2.8 MB each) — the first aggressive pass (≤50k) produced visible
> triangle faceting and was redone; don't lower the budgets in
> stl2glb_new.py without checking curved parts (brake rotor!) up close.
> The old procedural builders (buildBrakeRotor, buildLineFollower,
> buildEducationKit, buildPoolSniper, buildSmelly, buildTelecasterV2,
> makeThermalTexture) were removed. Pool Sniper's raw long axis is +y;
> it is laid flat with rotX=-π/2 (axis "z").
- **Resume** = a paper sheet on the desk (`buildResumePaper`, `action:
  "resume"`).
- The desk skill-matrix paper was REMOVED (was a distracting second sheet).
  `buildSkillPaper()` was later deleted entirely (2026-07-08 cleanup pass);
  there is no `action: "skills"` branch in the code anymore.
- **Bambu printer** (buildBambuPrinter, on the left bench): the shell is a
  HOLLOW box (back+sides+top+bottom panels — NOT a solid RoundedBox, which
  would occlude the interior), a dark bezel frames the door opening, and the
  door is an unlit MeshBasicMaterial tint (a lit MeshPhysical glass washes
  out with specular from the bright bench). Inside: a lit chamber, a glowing
  blue part mid-print, and `MODELS.printerHead` (a Group: gantry carriage +
  Z-post + nozzle + red hot-end) that the render loop sweeps in X. If you
  re-solid the shell or drop the bezel, the door goes opaque again.
- **Desk + bench lamps** emit NO light — both are decorative furniture only
  (the `lampLight`/`lLight` PointLights and the desk-lamp click-to-toggle
  were removed as "unnatural"; LED discs kept at a dim ~0.05 off-look). The
  pendant (2.6) now carries the desk, so the resume stays readable. Don't
  re-add task-lamp point lights.

> Exhibit colors are corrected to the CAD/reference images via per-exhibit
> `matTweak` in the ASSEMBLIES / SIDE_EXHIBITS / education entries: aura,
> scanner, pool → blue printed (`0x2a55c8`); smelly → light aluminum;
> telecaster → butterscotch wood (`0xd0a038`); education body split into its
> own `printed` bucket (blue `0x2f5fbf`) with the neck kept maple `0xc9a86a`
> (stl2glb_new.py education rules). To recolor a bucket, tweak here — do NOT
> change the shared ASSEMBLY_MATS base colors.
- Also note: a `Reflector` gloss strip set into the floor in front of the
  main cabinet (LOW_TIER gets a static glossy plane), and `runLightIntro()`
  — staged light-up on reveal (ambient → strips → spots → lamps), skipped
  under prefers-reduced-motion. (The desk monitor was removed — it blocked
  sightlines; don't re-add set dressing on the desk's right half.)

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
- **Click the resume** → the camera dips to the desk while the REAL 3D sheet
  lifts off it in world space (motions overlap) and settles facing the camera,
  pixel-aligned with where the DOM résumé will sit. The interactive DOM résumé
  (`#exp-paper` / `.exp-sheet`, `resumeHTML` from `RESUME`) then cross-fades in
  over it. Closing reverses the handoff and flies the sheet back to its desk
  pose while the camera pulls away. This is intentionally NOT the side panel.
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
  `{ THREE, scene, camera, renderer, controls, composer, bloom, key, hemi,
  models, hotspots, openPanel, showDragHint, runBootIntro }`
  for scripted checks (used heavily during QA — e.g. read
  `hotspots.length` (16 at runtime — see the Exhibits section above),
  click-simulate via projected bbox centers, inspect `composer.passes`,
  or call `openPanel(...)` / `runBootIntro()` directly).

### Baked lighting (2026-07-05, tools/bake/)
- The architecture layer (room shell, rug, desk, tool chest — tagged `bk_*`
  in experience.js) is PRE-BAKED via Blender Cycles: `USE_BAKED=true` hides
  the procedural originals and loads `models/baked/room-baked.glb` with HDR
  lightmaps (`lightMap`, uv1/channel=1, rows flipped, intensity 0.6).
  Cabinets, workbench and all exhibits stay real-time; `probe-*.hdr` (baked
  in-room 360) replaces the Poly Haven HDRI so reflections match. GTAO is
  disabled when baked. 2K maps block the loader; 4K stream in idle (desktop
  only). TWO light states exist — the DESK LAMP is a pseudo-hotspot
  (action:"lamp") that toggles bright workshop vs. night mode (baked
  lamp-pool + real-time benchGlow + lamp LEDs). Pipeline: run
  tools/bake/export_static.js in the browser -> `blender --background
  --python tools/bake/bake.py -- bake-layer.glb outdir on|off 4096`
  (portable Blender in C:\Users\oc\.cache\blender\, OPTIX GPU). Re-bake after
  ANY architecture/layout change; exhibits/cabinets don't need it.

### L5 wow pass (2026-07-06, experience.js)
- MOONLIGHT GOBO: `moonSpot` (cold blue, canvas-drawn 2x2 window-frame map,
  `MOON_NIGHT=11`) projects across the rug; `layers.enable(1)` so it reaches
  the baked floor. Night-only via applyLightState `want.moon`.
- (REMOVED 2026-07-06 per owner: the visible resume beam cone + dust motes
  read as artificial. LESSON that still applies to ANY future custom
  shader: clamp every GLSL `pow()` base with `max(x, 1e-4)` — `pow(0, y)`
  is NaN on ANGLE/D3D and ONE NaN pixel turns the whole frame white
  through UnrealBloom's mip chain.)
- 1/f FLICKER: sub-2% multiplier on resumeSpot/benchGlow/lampLeds applied
  before `composer.render()` and unwound right after.
- COLD BOOT (`runBootIntro`): first visit only (localStorage kw_intro_seen
  read in doReveal BEFORE startIntro sets it) — near-black open, exposure
  iris 0.12->1.3, rug LED trace, per-row strip strikes timed to the flight
  legs (side 850ms+, main 2250ms+), moon at 3.6s, lamp click + resume-pool
  bloom at 5.1s, lands on `applyLightState(false)` at 5.7s. `bootTakeover`
  makes applyLightState a no-op meanwhile; `cancelBoot()` (called by the
  lamp toggle) snaps non-applyLightState-owned values via `bootRestore`.
  Returning visitors keep the old `runLightIntro` ramp. QA: `__exp.runBootIntro()`.
- LAMP SWITCH UX (2026-07-06): the lamp pseudo-hotspot has a generous
  invisible hitbox + its marker is a CHILD of the lamp (both raycastable),
  because the bare stem/head made clicks miss. applyLightState carries a
  `lightGen` generation counter so rapid double-toggles can't let a stale
  800ms crossfade step commit the wrong grade.

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

Paste the block below to hand the project to another agent.

```text
You are taking over maintenance and development of Kefan Wu's engineering
portfolio website. Kefan is a Mechanical Engineering student (Olin College '28)
and Mechanical Lead at Olin Electric Motorsports (Formula SAE).

WORKSPACE & DEPLOY
- Local project: C:\Users\oc\Desktop\WEBSITE\portfolio-site
- Live: https://www.kefanwu.com  (Vercel auto-deploys on push to `main`)
- GitHub: https://github.com/kefanwu-overscope/kefanwu-portfolio.git  (branch: main)
- Vercel: https://kefanwu-portfolio.vercel.app
- Plain static site: NO framework, NO build step, NO npm install.

TWO SURFACES
- index.html  (canonical, recruiter-facing homepage)  + styles.css + script.js
- experience.html  (interactive 3D "studio", three.js r0.185, buildless via a
  jsDelivr import map)  + experience.css + experience.js
- project-data.js  = shared case-study data, loaded by BOTH pages (bump its
  cache string in BOTH when edited)
- experience-data.js = RESUME text + curated hero exhibits for the 3D page

STANDING RULES (do these automatically, without being reminded)
1. Communicate WITH THE USER IN CHINESE. ALL site-visible content stays ENGLISH.
2. After every VERIFIED change, commit AND push to `main` — do not ask first.
   End each commit message with a Co-Authored-By trailer (this repo has used
   "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"; use your own model
   identity).
3. Cache-busting: every file you edit carries a `?v=<label>-YYYYMMDD>` query
   string in the HTML — bump it. For the 3D page bump BOTH experience.css and
   experience.js in experience.html. project-data.js is referenced by both
   pages. After deploy, `curl` the live URL to confirm the new string is served.
4. If you spawn subagents, use Sonnet 5 at xhigh reasoning effort.
5. Design language: restrained premium black / blue (#3f8cff) / white
   engineering aesthetic (Apple/SpaceX). NO purple, NO videos, NO hobby framing
   (frame hobby-adjacent work as engineering / CAD / fabrication / analysis).
   Prefer real project assets. Keep recruiter readability high. Preserve desktop
   layout unless asked; for mobile-only tweaks stay inside @media (max-width:720px).

ENVIRONMENT (Windows 11, this machine)
- Bash tool = Git Bash (POSIX sh). PowerShell 5.1 also available. Mind CRLF and
  use forward slashes in scripts.
- There is NO node and NO python on PATH. For scripting/tooling use Blender's
  bundled Python:
  C:\Users\oc\.cache\blender\blender-4.5.9-windows-x64\4.5\python\bin\python.exe
  (has trimesh, scipy, rtree, pillow, reportlab installed).
- Headless Blender for lightmap baking:
  C:\Users\oc\.cache\blender\blender-4.5.9-windows-x64\blender.exe (OPTIX GPU).
  Bake pipeline lives in tools/bake/.
- SolidWorks STL exports: C:\Users\oc\Desktop\STL. STL->GLB scripts in tools/.

VERIFICATION
- Use the preview tools (start the "portfolio" launch config -> http://localhost:4173/).
  Prefer preview_inspect + preview_eval (read computed styles / bounding boxes)
  over preview_screenshot, which renders tiny and TIMES OUT on the WebGL 3D page.
- Plain screenshots of the WebGL canvas are unreliable (the composer-rendered
  canvas often reads back blank/backgrounded). There is currently NO
  `snapsrv.py` or other capture-receiver script in this repo — do not assume
  one exists. Prefer `preview_eval` / `preview_inspect` and `window.__exp` for
  QA (read `hotspots.length`, `camera.position`, `composer.passes`, etc.) over
  screenshotting the 3D canvas. Always confirm `window.__exp` exists and there
  are no console errors after editing experience.js.
- Check desktop AND mobile; verify no horizontal overflow.

READ FIRST (in the repo)
- AGENT_HANDOFF.md — THE working reference: file map, DOM/ID map, current
  cache-version strings, recent changes, full 3D-studio internals, and the bake
  + tooling pipelines. Read it before touching anything.
- README.md, PROJECT_DOCUMENTATION.md, ATTRIBUTIONS.txt.
Do not trust older docs over the actual current code — inspect files before editing.

CURRENT STATE (2026-07-07; verify with `git log` / the live site)
- Homepage was refreshed with a 3D-studio conversion funnel: hero CTA "Enter the
  3D Studio", nav pill, deep links (experience.html#<projectKey> flies to that
  exhibit), per-modal cross-links, a "Walk the studio" grid tile spanning two
  columns, and a pre-Contact banner. Cards gained outcome subtitles; a resume
  PDF (assets/kefan-wu-resume.pdf) was generated from site data — Kefan may
  replace it with his own file at the same path. "Vibe coding" was renamed to
  "AI-assisted engineering". Hero title is vertically centered; Projects section
  background is solid black.
- 3D studio: an L5 lighting "wow" pass (cold-boot intro, moonlight gobo), a
  reliable desk-lamp light switch, and a carbon-seat seam fix landed recently.
  All 14 projects are clickable exhibits; the resume sits on the desk.
- A dated local backup exists at
  C:\Users\oc\Desktop\kefanwu-portfolio-backup-2026-07-07 (full git bundle +
  source snapshot zip). Re-run a backup after major changes.
```
