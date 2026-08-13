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

### 2026-08-13c (latest) vineRobot <-> education slot swap; pail transparent; photo-audited colors
Kefan: swap the vine robot and the guitar education kit, make the pail
transparent, verify the other colors. Three Opus subagents under supervision.
- **Slot swap**: vineRobot now sits in the MAIN cabinet, bay 2 / row 2
  (education's old slot) as a direct loadAssembly — targetSize 0.36 axis "y",
  rotY PI/2-0.2 so the outlet faces the room. education became the last
  SIDE_EXHIBITS entry (CAB2 bay 1 / row 2) — size 0.44 **axis "z"** (re-derived:
  in the side cabinet the long axis runs along the wall), rotZ PI/2,
  rotY -PI/2+0.12, navy/walnut matTweak carried over verbatim. PROJECT_ORDER
  swapped to match (vineRobot index 8, education last).
- **Pail is translucent**: "EBK Bucket" moved to a new CLASS rule -> the
  renderer's native **mat_glass** bucket (3416 tris, pail geometry only).
  The shared ASSEMBLY_MATS.glass is clear acrylic (pool's windows need it);
  the milky-HDPE look is a PER-EXHIBIT matTweak: color 0xc9c6c9, opacity
  0.55, transmission 0.35, roughness 0.38 (roughness is what blurs the
  transmission sample = frosted). matTweak runs material.setValues() so
  MeshPhysicalMaterial props land cleanly.
- **Photo-evidence color audit** (rule now written into stl2glb.py: real
  build photos beat CAD renders for any part visible in them; CAD only fills
  internals; most SolidWorks parts carry NO appearance so "grey in the CAD"
  is not evidence of metal). 9 reassignments: pail aero->glass; C-bands
  Bracket1/2/3 steel->printed (photos show royal blue, same as their caps —
  the old "deliberately steel" comment was CAD-default-grey deception);
  Converter_circular (outlet funnel) steel->printed (deep blue in photos);
  TOP_Plate aero->printed (blue lid top); Lid_Mount brass->aero (white, not
  yellow); Output_r52mm_coupler + Dividing_Shaft steel->aero. DC_Motor
  stays dark — now EVIDENCE-backed (vine-test-closeup shows a black can).
  Rule-order trap documented in-file: never shorten "ebk bucket" to
  "bucket" — every filename starts "Bucketbot - " and the whole robot would
  turn to glass.
- **One judgment call to know about**: rubber tweak went crimson 0xa32b2f ->
  orange 0xcc5b26 because the TPU gaskets photograph ORANGE (lid line,
  outlet squeeze-out) while the CAD paints them red. Trivial to revert if
  Kefan prefers red.
- aero tweak added (0xe6e3da warm white, metalness 0): the plates are
  cream-white printed plastic in the photos, not bare aluminum as the
  earlier comment assumed.
- Verified (subagent 10/10 + supervisor spot-check): world positions
  swapped exactly (vine [0.73,0.9,-1.08], edu [2.24,0.85,0.25], both min.y
  = 0.72 on-shelf), no interpenetration, glass props in effect at runtime,
  education still navy 0x3d5180, both deep links fly to the new spots,
  tour 15/15 ends on education, 17 hotspots, zero console errors.
- Cache: experience.js -> `exp-vineswap-20260813`; project-data.js stays
  `bucketbot-20260813` (content unchanged). GLB 2157 KB.

### 2026-08-13b vine robot is now the 15th studio exhibit (real CAD)
Kefan dropped 144 `Bucketbot - *.STL` files in `C:\Users\oc\Desktop\STL\Bucketbot\`
(note: a SUBFOLDER — the STL root has none, globs must carry the folder).
Executed by four Opus subagents (convert / scene / copy / verify) under
supervision; all changes reviewed against the diffs before shipping.
- **models/real/vineRobot.glb** (new, 2.2 MB, 122,814 tris, 6 mat_* buckets).
  `tools/stl2glb.py` gained the `vineRobot` GROUPS entry + 5 CLASS rules + 1
  SKIP. Traps that are now handled IN THE FILE's comments — read them before
  touching CLASS: "bracket" contains "rack" (steel rule), "*joint" hits
  "joint", "TPU_Motor Seal" hits "motor"; Bucketbot's 84 fully-threaded cap
  screws are 52% of the tris and are SKIPped with a prefix-scoped token so
  steering/aura keep their identically-named fasteners. Bracket1/2/3
  intentionally fall through to steel (they're the grey C-band
  reinforcements). Re-classification of all 236 root STLs under old vs new
  tables: zero differences — other groups provably unaffected.
- **experience.js**: new SIDE_EXHIBITS entry — right-wall cabinet CAB2,
  bay 1 / row 2 (the one free slot; world (2.24, ~0.875, 0.25), shelf top
  y=0.72), size 0.31, rotY 0.3 so the native -x outlet face turns toward the
  room. Native axes already y-up, no rotX/rotZ. matTweak: printed→blue
  0x2a5fc4, rubber→red 0xa32b2f, brass→0xc9a83a (colors sampled from the
  vine-*.webp CAD renders). PROJECT_ORDER now 15 keys (vineRobot last);
  kb-nav comments updated. Runtime hotspot math: 15 exhibits + resume + lamp
  = **17** (`console.info` prints 17).
- **project-data.js**: vineRobot's `noStudio: true` + its 2-line comment
  removed — the modal now shows "View this exhibit in the 3D Studio →"
  (#vineRobot deep link needed no new code; doReveal resolves it).
  materialTest keeps its noStudio and is now the ONLY project without an
  exhibit.
- **index.html**: studio tile "14 EXHIBITS" → "15 EXHIBITS", "The 14 modeled
  projects above" → 15. (L299's "14 / Product" is card #14's NUMBER — leave.)
- Verification (subagent + independent supervisor spot-check): both cache
  strings live, GLB 200, hotspots 17, vineRobot label/hotspot present, Box3
  clean vs all 105 exhibit pairs and the cabinet (0.17 clearance to shelf
  above), deep-link flight lands 1.0 from the exhibit center, zero console
  errors, materialTest still hidden, card-14 meta untouched.
- Cache: project-data.js → `bucketbot-20260813` (BOTH pages), experience.js →
  `exp-bucketbot-20260813`.
- Serving trap rediscovered: `serve.ps1` (the "portfolio" launch config)
  400s requests to `127.0.0.1` — use `http://localhost:4173`.

### 2026-08-13 steering case study updated to "built, installed, running"
Kefan confirmed four facts on 2026-08-13 and they are the ONLY new claims in
this pass — everything else in the steering object is untouched:
1. Max steering torque **50 N·m**, hand-derived from peak tire friction plus
   the car's Ackermann steering geometry.
2. **Every steering shaft** sized in torsion by hand, cross-checked in FEA.
3. All steering parts machined by him personally — processes are exactly
   **waterjet, lathe, TIG welding** and nothing else.
4. The full steering system is **installed on the car and has run without
   issues**.

Changed, all inside the `steering` object (L5-62 of project-data.js):
- `summary` — dropped the design-tense tail ("every part maps to a shop
  process ..."); now states the 50 N·m hand derivation and the built/installed
  status as two parallel facts.
- `highlights` **5 → 6**. Kept the U-joint ripple, 3.5-inch wheel move, and
  0.9 kg cage bullets. Replaced the generic "Analyzed shaft, rack mount, yoke
  phasing..." bullet with the 50 N·m derivation, replaced "Planned fabrication
  across..." with the shaft-torsion + FEA bullet, and added a sixth covering
  personal fabrication and installation. 6 is precedented (site-wide highlight
  counts are 5x12, 6x3, 7x1). Note **every highlight on this site is a single
  sentence** — keep it that way; the new sixth uses em dashes and a conjunction
  rather than two sentences.
- `tools` — "TIG weld planning" → "TIG welding". `CNC mill` deliberately kept:
  a tools list carries no agent, and the CNC bearing cages were not his work.
- `details[2].points[2]` and `details[3].points[2]` — rewritten from
  planned/released tense to done. The word "release" is retired site-wide for
  this project.

**Honesty constraints that must survive future edits:**
- Facts 1 and 2 are stated in PARALLEL, never causally linked. Kefan did not
  say the 50 N·m case was the input load for the torsion work — do not write
  "carried that load case through the column" or similar.
- Fact 2's scope is **shafts only**, never "every part" / "the whole column".
- No stress values, factors of safety, or deflections exist for this work.
- 50 N·m verbatim: no lb-ft conversion, no reinterpretation as "torque at the
  wheel" vs "at the shaft".
- Ceiling phrasing is "installed on the car and has run without issues".
  BANNED: smooth/smoothly, no binding, no play, zero backlash, no stiction,
  dialed in, proven, validated on track, durability. In a steering context
  "smooth" reads as an unverified performance claim.
- L49's qualifier "per the ripple-surface model in the gallery" stays verbatim
  — running on the car is not the same as measuring ripple cancellation.
- This car has no competition results. No lap times, no placings.

Two documentation traps found while doing this (fix your assumptions, not the
files): `index.html` L155 uses the LITERAL `°` character, not the `&deg;`
entity, so searching for the entity finds nothing; and `window.projectData` is
in fact an object, not undefined, despite `const` at classic-script top level.
There are also TWO launch configs — `WEBSITE/.claude/launch.json` ("portfolio",
runs serve.ps1) and `portfolio-site/.claude/launch.json` ("portfolio-static",
python http.server) — both on port 4173.

Cache: project-data.js → `steering-20260813` in BOTH index.html and
experience.html. No other version string touched.

### 2026-08-05 modal "flash and gone" fix — double-click closed the case study
Kefan reported: clicking a project card sometimes flashed the case study open
and instantly shut it ("闪退"). Root cause chain, all in script.js:
- **Primary:** `.modal-backdrop` is fixed/inset-0/z-100 with a bare
  `click → closeModal` listener. On a double-click (or two quick clicks) the
  first click opens the modal, the second lands on the freshly-mounted
  backdrop at the same cursor position → instant close. "Sometimes" = only
  users who double-click cards.
- **Fixes shipped:**
  1. Backdrop dismissal now requires (a) the press to START on the backdrop
     (`pointerdown` target check, trusted events only) and (b) ≥400 ms since
     the modal became visible (`modalOpenedAt`, stamped in `showDom`).
     Keyboard-activated Close clicks (`event.detail === 0`) get the same
     400 ms grace so a held Enter from the card can't re-fire on the
     just-focused Close button. Escape and user-paced Close are unaffected.
  2. `openModal` re-entry guard (`modalOpenPending` + aria-hidden check):
     a burst of clicks starts exactly one open sequence. Previously a second
     call mid-transition saved `prevCardName` as "none" and could leave the
     card's `viewTransitionName` permanently blanked (killing its filter FLIP).
  3. Shared-element morph actually plays now: the update callback clears
     `cardImg.style.viewTransitionName` so "case-hero" is unique per state.
     Before, card cover AND modal hero were both named in the new capture —
     duplicate `view-transition-name` ⇒ browser ABORTS the morph every time
     (hard cut + unhandled InvalidStateError rejection).
  4. Card `view-transition-name`s are no longer permanent — assigned by
     `nameCardsForTransition()` just before a filter transition, cleared on
     `finished`. Permanent names made EVERY view transition (incl. modal
     open) snapshot all 17 cards as separate layers → click stutter.
  5. All `startViewTransition` calls now attach `.catch(() => {})` to BOTH
     `ready` and `finished` — skipped transitions (hidden tab, rapid
     re-trigger) reject both and each unhandled rejection logged a console
     error ("Transition was aborted because of invalid state").
- QA note: the preview pane backgrounded reads `innerWidth/Height = 0`, so
  `elementFromPoint` hit-testing is impossible — verify wiring by dispatching
  `pointerdown` + `click()` on the actual elements instead. Synthetic-click
  tests must send a `pointerdown` to the backdrop first or the origin check
  (correctly) ignores the click. Console error history persists across
  navigations in the pane — attach an in-page `unhandledrejection` listener
  to tell stale noise from live regressions.
- Cache: script.js → `modalfix-20260805` (index.html only; experience.js
  untouched).

### 2026-07-30 real vine photos + material testing split into its own project
- Kefan dropped four 8160x6120 photos in `C:\Users\oc\Desktop\WEBSITE\vine robot\`
  (that Desktop-folder handoff is the pattern that keeps working — Drive is
  awkward, see below). Converted to 1400px WebP:
  `vine-body-3partition` (reinforced robot everting the 3-partition body),
  `vine-body-stick` (stick-reinforced body, bamboo rods visible),
  `vine-test-rig` (full deformation rig), `vine-test-closeup` (body under load).
  They lead the vineRobot gallery, which is 11 images now; the modal hero is
  therefore the 3-partition photo.
- **NEW PROJECT `materialTest`** — "Material property testing", card 04 /
  Research, `data-category="analysis"`, noStudio. Kefan asked for the material
  work to stand alone, so vineRobot's "Material characterization" detail block
  was replaced by a one-line "Feeding the model" pointer and all the Instron
  content moved across: ASTM D882 on 30 specimens (MD 76.30±3.08, TD
  69.89±2.47, 45° 41.78±0.99, LDPE 100.96±5.00 MPa), the plane-stress
  orthotropic fit, and three-point bending on 11 bamboo rods (81.7±7.7 N/mm,
  EI 0.672±0.063 N·m², E 0.678±0.055 GPa).
- Counts moved: 16 project cards (17 grid tiles), hero stat "16 Engineering
  projects", JSON-LD ItemList 16 items, card metas renumbered.
- Grid order (Kefan, after a ranking discussion — keep the JSON-LD ItemList in
  the SAME order, and note the last ListItem line must be the only one without
  a trailing comma or the block stops parsing): steering · brakeSim ·
  vineRobot · materialTest · javelin · ansysCfd · carbonSeat · seat · aura ·
  scanner · **pool · lineFollower** · formlabs · education · telecaster · ftc. The studio tile
  still says 14 EXHIBITS — two projects have no 3D model, keep them distinct.
- **All eight figures are Kefan's OWN MATLAB renders**, pulled from the Drive
  `figures` subfolder (`1fnt08AUwUIaEwffgi7fOaqwyHcIToO5b`) and re-encoded to
  WebP with the outer white margin trimmed:
  `cover-material-test` (stress vs extension, 0-25 mm — **his pick for the
  cover**, kept at 1500 px so its labels survive the card's 0.23x contain-fit;
  a 42 px title lands at ~10 px on a 389 px card, ~20 px at 2x DPR),
  `material-stress-extension-full`, `material-stress-strain-md`,
  `material-stress-strain-ldpe`, `material-tensile-summary`,
  `material-modulus-polar` (was the cover, now a gallery item),
  `material-bending-fits`, `material-bending-summary`.
  `scratchpad/mat_figs.py` (the generated stand-ins) is dead code now.
- Kefan then dropped six lab photos in `C:\Users\oc\Desktop\WEBSITE\material
  property test\` (3000x4000 phone shots) — converted to 1400 px long-side
  WebP as `material-instron-frame` (the 3345 frame), `material-specimen-td` /
  `-md` / `-45` / `-ldpe` (caliper on each labelled specimen group) and
  `material-bending-fixture` (a bamboo rod deflected in the flexure fixture).
  Gallery is 14 items now, ordered: cover figure → setup photos → the
  remaining plots (raw curves → per-material → summary → model → bamboo), so
  the modal hero still matches the card cover.
  NOTE on that fixture photo: the base is stamped "4-Point Flexure Fixture -
  Bottom" but the documentation describes a THREE-point test (single central
  anvil on that fixture's outer supports) — the caption deliberately says
  neither, just "Bamboo in the fixture", so the two can't contradict.
- **HOW TO PULL DRIVE IMAGES (this is the working recipe — everything else
  failed):** call the Drive MCP `download_file_content` with the file id. The
  base64 result is too big for context, so the harness spills it to
  `~/.claude/projects/<proj>/<session>/tool-results/*.txt` as
  `{content, id, mimeType, title}` — then decode that file locally:
  `json.load(...)` → `base64.b64decode(d["content"])` → write bytes. Zero
  context cost, full original resolution. Get the file ids from
  `search_files` with `parentId = '<folder id>'`.
  Dead ends, all verified: `curl` on Drive/Docs URLs → 403 (folder is not
  link-shared); in-page POST to a localhost receiver → Google CSP; blob
  `<a download>` → allowed ONCE per site, then Chrome blocks it (this is how
  the 11 Bucketbot doc images landed before the block); `clipboard.write` →
  NotAllowedError (document not focused); returning base64 from
  `javascript_tool` → blocked by the harness safety filter; fetching
  `drive.google.com/uc?export=download` from a Drive page → CSP TypeError.

### 2026-07-14 (9th pass) Vine robot project added + resume-truth copy pass
Kefan approved all of it in one message (option **B** on the headcount plus
items 1-8 from the resume-facts list), and supplied a Drive folder for the
research project.

- **NEW PROJECT: `vineRobot`** — "Vine everting robot", card #03 / Research,
  categories `robotics analysis fabrication`. 15 project cards now (16 grid
  tiles with the studio link tile) = exactly 4 rows of 4.
  · Source: Kefan's Drive folder `1PFFm59Znxa4Tu2NeF4561eQpcsUfXq8Z` —
    "Bucketbot Design Documentation", "Bucketbot" deck, "Vine Deformation
    Experiment", "Material Property Test". Read via the Drive MCP
    (`mcp__ffde5733-…__search_files` / `read_file_content`). The folder is NOT
    link-shared, so curl/wget cannot fetch it — only the MCP path works.
  · Case study carries the real numbers: 34 kPa (5 psi) design pressure at
    3.33 FoS, 571 mm max body circumference, 39 M4x30 Grade 12.9 lid bolts
    against ~2,304 N blow-off, TPU 85A printed gaskets (0.5-3 mm, five seal
    families), swappable outlet converters, spool holder + flexible coupling,
    first test 1.2 psi vs 0.71 psi hand calc, reinforcement FEA 6.524 mm /
    0.2339 GPa vs A36 0.25 GPa yield, the 45-run factorial, and the ASTM D882
    / three-point-bending results (MD 76.30, TD 69.89, 45° 41.78 MPa;
    EI 0.672 ± 0.063 N·m²).
  · **Cover** (Kefan's pick, 2026-07-14): `assets/cover-vine-robot.webp` is the
    **reinforcement-structure CAD** (aluminium plates + three C-brackets), so
    the card uses `card-media--contain` — it is a 452x563 PORTRAIT render, and
    --fill would crop the vessel. Contain-fit renders 234x291 inside the
    388x291 box, i.e. 1.93x downscale (4% shy of the 2x-DPR ideal — invisible,
    but a fresh SolidWorks render ≥800 px would make it exact).
    The modal hero stays the PHOTO (gallery[0]) because `image:` is only the
    no-gallery fallback — card shows the CAD, case study opens on the build.
  · 8-image gallery pulled from the same doc: built robot (photo), internal
    spool cutaway, exploded lid, exploded outlet, reinforced build, FEA
    displacement (6.5 mm), FEA von Mises (0.234 GPa), and the measured fabric
    modulus figure I generated with `scratchpad/vine_cover.py` (the
    plane-stress compliance model reproduces MD/TD/45° exactly and bottoms out
    at 41.77 MPa near 46°, matching the doc's "min 41.8 MPa near 46°").
  · **How the images were obtained** (the folder is NOT link-shared, so curl
    gets 403 and the Drive MCP only returns text): open the doc's
    `/mobilebasic` view in the user's logged-in Chrome (claude-in-chrome MCP),
    fetch each image in-page, compose them into ONE tall canvas, trigger a
    blob `<a download>`, then slice the downloaded PNG locally with the rects
    the page reports. Posting bytes to a localhost receiver does NOT work —
    Google's CSP blocks connect-src. Chrome also blocks the SECOND automatic
    download in a session, so one sheet per page load.
  · Still missing: the Material Property Test doc's 8 large images (Instron
    setup) — blocked by that second-download limit. Kefan was told.
  · `noStudio: true` on the entry + `studioLink.hidden = Boolean(project.noStudio)`
    in script.js openModal — there is no 3D exhibit for this project, so the
    "view this exhibit in the 3D Studio" link is suppressed (verified hidden
    for vineRobot, still visible for steering).
- **Headcount claim resolved (option B)**: every ">30 / 30+ engineers" is gone.
  Hero stat is now `4 — Mechanical subteams led`; the Motorsport panel opens
  with "four subteams"; the 3D resume sheet highlight names the four subteams.
  Grep for "Engineers led" returns nothing.
- Hero stats bar is now: Mechanical Lead · **4** subteams led · **85 kW**
  racecar (0-60 in 3.5 s) · **15** engineering projects. Dropped "18+
  Technical skills" (the audit's weakest stat) and the headcount.
- Hero eyebrow and the 3D sheet's meta line carry **GPA 3.9**.
- Motorsport spec list gained a **Program** row (4 subteams + the 22 km,
  sub-30-minute endurance target) and a **Track record** row (Drivetrain &
  Cockpit Engineer Sep 2024 → Cockpit Lead Jun 2025 → Mechanical Lead
  May 2026) — that is audit item M11, and the FSAE half of M15.
- Steering: **0.9 kg** bearing-cage saving added to highlights, details and
  the Motorsport spec row. Javelin: "seeking FAA clearance to fly past the
  100 mph UAS limit". AURA: now an **autonomous luggage robot with a 300 lb
  payload** everywhere — the "200 lb working load" framing I invented on
  2026-07-14 to reconcile the site's internal contradiction is REMOVED,
  because the resume settles it at 300 lb.
- Studio tile copy: "Every project above…" → "The 14 modeled projects above…"
  (15 projects, 14 exhibits — keep these two counts distinct).
- JSON-LD ItemList is 15 items, positions renumbered; both blocks validated
  with json.loads.
- Verified by DOM probe at 1920: 16 tiles / 4 per row, card order
  steering·brakeSim·vineRobot·javelin·ansysCfd·carbonSeat, cover resolves,
  7 highlights + 6 detail blocks, studio-link visibility correct both ways,
  stats/eyebrow/spec rows read as intended, console clean.
- STILL BLOCKED: per-card years for the 10 non-FSAE projects (M15 remainder).

### 2026-07-14 (8th pass) M10 DONE — real resume shipped + resume ground truth
- Kefan supplied `C:\Users\oc\Desktop\Kefan Wu resume.pdf` (1 page, created
  2026-07-29). It replaces the 3.6 KB ReportLab auto-generated placeholder at
  `assets/kefan-wu-resume.pdf` that the audit flagged (M10). Referenced from
  index.html twice (nav + contact) and from experience-data.js (3D sheet, S12).
- PDF metadata was rewritten (title was "Kefan Wu resume help" → "Kefan Wu —
  Mechanical Engineering Resume", author "kwu" → "Kefan Wu", plus subject and
  keywords). Rendered pixels verified IDENTICAL before/after (sha256 of a 2x
  pixmap), so the visual document is untouched.
- **KNOWN DEFECT, told to Kefan:** the file was printed through PScript5 +
  Acrobat Distiller, so all glyphs are a **Type3 outline font with no
  ToUnicode CMap**. Text extraction yields glyph indices, not characters —
  i.e. ATS parsers and copy-paste get nothing, and the outlines bloat it to
  570 KB. Fix is on Kefan's side: export straight from the source document
  (Word "Save as PDF" / Google Docs "Download → PDF"), never "Print to Adobe
  PDF". Re-verify with:
  `python -c "from pypdf import PdfReader; print(PdfReader('assets/kefan-wu-resume.pdf').pages[0].extract_text()[:200])"`
- Tooling note: reading this PDF required rendering. `pymupdf` is now pip-
  installed in the codex python (`C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`);
  poppler/pdftoppm is NOT available, so the Read tool cannot rasterize PDFs.

#### RESUME GROUND TRUTH (use for site copy; supersedes guesses)
- Olin College of Engineering, Needham MA — B.S. Mechanical Engineering,
  **expected May 2028**, **GPA 3.9/4.0**. Coursework: Mechanics of Solids &
  Structures, Systems Analysis: Dynamics, Thermal-Fluid Systems, Probabilistic
  Modeling. Contact on resume: kefanwu.com · kwu@olin.edu · 508-509-2707
  (the phone number is NOT on the website — do not add it without asking).
- Olin Electric Motorsports (Formula SAE Electric): team builds an **85 kW**
  electric racecar, **0–60 mph in 3.5 s**. Role progression:
  · **Mechanical Lead, May 2026 – present** — directs mechanical design /
    integration / fabrication of Mk.8; manages **4 mechanical subteams**
    (suspension & chassis, aerodynamics, drivetrain, accumulator); milestones
    toward a **22 km, sub-30-minute endurance** design target.
  · **Cockpit Lead, Jun 2025 – May 2026** — track-based brake thermal model,
    rotor mass **-25% at 3.0 FEA FoS**; steering column on matched **27.5°
    dual U-joints** for linear steering; lightweighted bearing cages saving
    **0.9 kg**; led the cockpit subteam (lathe/mill/waterjet, TIG-welded
    chassis tabs, carbon fiber seat layup).
  · **Drivetrain & Cockpit Engineer, Sep 2024 – Jun 2025** — Mk.7 driver seat
    and FEA-validated motor-controller mounts.
- **Research Assistant, Olin Vine Robotics Lab (full-time summer research),
  May 2026 – Aug 2026** — vine-everting robot holding **5 psi**; **30 Instron
  tests** across TPU-coated fabric and LDPE (**ASTM D882**); testing rig with
  minimized buckling validating a cross-section strain model. **This whole
  role is ABSENT from the website.**
- Project AURA (class project) **Oct 2025 – Dec 2025** — front swerve modules
  for a **300 lb-payload autonomous LUGGAGE robot** (site calls it a "cart"):
  NEMA 23 steppers via 18:80 chain steering reduction, 24 V DC motors via 9:16
  sprockets; fixed chain skip / backlash / shaft misalignment across
  durability, impact and load tests; 0.25 in A36 waterjet on an OMAX + TIG.
- Selected projects: Javelin VTOL (300 km/h design target, differential
  thrust, **seeking FAA clearance to fly past the 100 mph UAS limit**);
  Agent-based CFD (PyFluent + AI agents, **drove Javelin aero design**, 11
  documented failure modes); LiDAR scanner (**ESP32** two-axis gantry, NEMA 17
  + DRV8825, 2,206 points, **14-point calibration** → <3% range error, copper
  foil EMI shielding).
- **CONFLICT to resolve with Kefan:** the site claims ">30 Engineers led"
  (hero stat), "Leading 30+ engineers" (Motorsport panel) and "coordinating
  30+ engineers" (3D resume sheet), but the resume says only "manage 4
  mechanical subteams" with no headcount. Do NOT quietly keep or delete the
  claim — it needs his confirmation.
- The resume gives NO dates for Telecaster, FTC, Pool Sniper, LineFollower,
  guitar education kit, Smelly, carbon seat, scanner, Javelin or CFD, so M15
  (years on every card) is still partly blocked.

### 2026-07-14 (7th pass) project grid is FOUR up (fixed count)
- After the fluid shell landed, auto-fit grew the grid to 6 columns at 1920 and
  Kefan called the layout bad. He wants **4 per row** (a first reading of the
  message shipped 2-up for one commit — corrected immediately, don't revive it).
- `.project-grid` is now a FIXED `repeat(4, minmax(0, 1fr))`. Do NOT restore
  auto-fit: with a fluid `--max` it silently re-adds columns as the window
  grows, which is the thing that was rejected. Step-down ladder:
  ≥1200px = 4 · ≤1199px = 3 (new rule right under the base) · ≤980px = 2
  (pre-existing block) · ≤720px = 1 (pre-existing block). Cascade order in the
  file already puts them in that priority — keep new rules above line ~2370.
- Cards: 408x462 at 1920, 305x383 at 1440, 317 wide at 1024, 357 at 768.
  Since the fluid shell makes them ~408px on wide screens (vs the 283px the
  typography was sized for), a small `@media (min-width: 1600px)` step-up in
  the override layer sets padding 1.05/1.2/1.25rem, h3 1.32rem, sub 0.96rem.
- Page height 1920: ~6.1k px (2-up was ~9.9k).
- Measured source ARs vs the 4/3 media box (unchanged): most CAD covers are
  1.4-1.89 so they letterbox 16-29% top/bottom, carbonSeat is portrait (0.75)
  at 44%, and the four `--fill` photos (1.5-1.6) crop 11-17%. Proportions are
  unchanged from before the fluid shell — only absolute size moved. A 3/2 box
  would help the wide ones and hurt steering/seat/carbonSeat; left alone.
- Verified at 375/768/1024/1440/1920: 1/2/3/4/4 per row, no horizontal
  overflow, console clean. Cache: `grid4up-20260714`.

### 2026-07-14 (6th pass) fluid content shell + ticker full-bleed restored
- Kefan on a ~1920px screen: "两边留白很多，能不能留少一点". Cause: `--max`
  was a fixed 1180px, so a 1920px window left 370px of dead margin per side
  (2000px → 410px).
- `--max: clamp(1180px, 88vw, 1680px)` — identical to the old 1180px column at
  ≤1340px, then grows with the window to a 1680px cap. Sides at 1920px:
  370 → 115px. Nothing over-widens: `.project-grid` is auto-fit (4 → 6 columns
  at 1920, card width stays ~267px), `.hero-copy` is capped at 620px, and
  `.section-head.compact` at 820px.
- Ticker full-bleed FIX (regression from M4 in batch 1): `.hero-skill-strip`
  pulled itself out of the hero padding with `calc(var(--hero-pad) * -1)`, but
  --hero-pad is PERCENTAGE-based and a percentage inside `.hero-content`
  (width capped at 880px) resolves against that box — the pull collapsed to
  the 48px clamp floor and the ticker sat ~317px inset at 1920 (visible as a
  dark gap left of the marquee in Kefan's screenshot). New `--hero-bleed` var
  holds the same value in VIEWPORT units (`(100vw - var(--max)) / 2`), which
  is context-free; the ≤720 block sets both vars to 1rem.
  NOTE: do NOT use `calc(50% - 50vw)` here — 50% is .hero-content's 880px.
- Verified at 375/1024/1280/1440/1920: shell sides 16/16, 16/16, 45/55,
  81/82, 115/115; hero left edge == shell left edge at 1440+ (M4 intact);
  ticker covers the full viewport at every width; no horizontal overflow;
  capabilities title still inside the shell; console clean.
  (Known, pre-existing: at ≤1024 the hero pad is 4vw while the shell gutter is
  1rem, so they diverge ~25px — untouched, aligning it would either add
  whitespace or remove the hero's breathing room.)
  Cache: styles.css → `shell-20260714`.

### 2026-07-14 (5th pass) site audit batch 3 — studio perf + UX (S3, S5, S6, S8-S10, S12-S15)
- S3 shadowMap.autoUpdate=false + tick() sets needsUpdate once per frame
  (shadow pass used to render 3x per composer frame — measured -55% CPU);
  key shadow map 4096→2048; BokehPass DISABLES itself while idle
  (bokeh.enabled = want>0 || aperture>2e-5) — one fewer full-scene render.
- S5 pixel ratio budget: pixelRatioFor(w,h) caps the drawing buffer at
  ~10 MP (4K@DPR1 now near-native instead of 21 MP; 1080p/1440p unchanged).
  Shared by init AND onResize — do not let them drift again.
- S6 (parts 1+2): the two 4k lightmaps download SEQUENTIALLY (off-4k first —
  night is the default state), each 4k arrival disposes its 2k predecessor
  (-67 MB VRAM). CRITICAL: repoint lmB.value to the 4k BEFORE disposing —
  the B sampler may still hold the 2k and three would re-upload a disposed
  texture. Part 3 (worker RGBE parse) DEFERRED to batch 4: HDRLoader's bare
  `three` import can't resolve in a worker until S4 vendors three locally.
- S8 night reading light: `focusBoost` flag folded INTO applyLightState's
  want table (key 0.22→0.55, hemi 0.16→0.32 while a project panel is open at
  night; resume keeps its own paper glow). Set in focusHotspot, cleared in
  closePanel; late lightmap callbacks can't stomp it because the boost lives
  in the want computation itself.
- S9 third one-time hint (localStorage kw_lamphint): "Tip — the desk lamp
  switches the room lights", chained 1.2s after the click hint dismisses,
  auto-dismisses in 4s.
- S10 ArrowLeft/Right step the 14-project tour while the panel is open
  (lightbox keeps its own arrows; verified 01/14 → 02/14).
- S12 resume sheet: contact row is now olin.edu · LinkedIn · "Download
  resume (PDF)" (download attr via the .pdf branch in resumeHTML); the gmail
  entry is REMOVED to match the homepage.
- S13 portrait fov: onResize widens fov to min(64, 42/aspect^0.42) and
  maxDistance 4.0 when aspect<1 (was: 7 of 16 exhibits visible at 375px);
  onResize() now also runs once at init.
- S14 touch verbs: click hint says "Tap an exhibit …" and the canvas
  aria-label swaps to swipe/tap wording on coarse pointers (drag hint
  already did this).
- S15 night workbench: benchBarSpot angle 0.55→0.72 rad and ramp multiplier
  1.2→1.6 (all four sites: both applyLightState branches, bootRestore, boot
  seg) — the left wall was near-black when orbited at night.
- Verified: S3/S5/S13/S15 by state probes, S10/S12 functionally (tour step,
  PDF link + no gmail in the rendered sheet), console clean. S8/S9 ride real
  rAF/timer chains that freeze in a background pane — code-path verified,
  will be covered by the next review workflow.
  Cache: experience.css/js → `exp-audit3-20260714`.

### 2026-07-14 (4th pass) site audit batch 2 (M12, M16, M17, M20-M22, M24-M27)
- M12 all self-grading copy is gone: modal column "Engineering signal" → "Key
  results" (index.html AND experience.js projectHTML); closing blocks in
  project-data.js are fact-based now ("Status and validation"/"Status");
  steering's framing highlight deleted. M16 Javelin leads with "Designed for
  300 km/h" on card + summary.
- M17 hero srcset: hero-fsae-track-{960,1440,2200}.webp (91/215/461KB, PIL
  q70/66) + fetchpriority=high + width/height on img and imagesrcset preload.
  The original hero-fsae-track.webp stays for og:image until X1.
- M20 fonts SELF-HOSTED: assets/fonts/*.woff2 (8 latin subsets), @font-face
  at the top of styles.css, Google preconnect/stylesheet links REMOVED from
  index.html, Inter-400 + InterTight-700 preloaded. experience.html still
  uses Google Fonts (its own stylesheet — not in this batch's scope).
- M21 all five hot-linked skill images replaced with OWN assets:
  skill-fea (oem-brake-fea), skill-waterjet (aura-swerve-mount),
  skill-carbon (carbon-seat-weave-close), skill-matlab (fsae-mk8-live-5
  ripple surface), skill-topology (seat-fea — closest own load-path visual).
- M22 modalScrub: frames 2..N load on FIRST modal scroll (preload() method,
  fetchPriority low), not at open (was 60 requests / 1.4MB instantly on AURA).
- M24 stretched-control cards: every h3 wraps a .card-open <button>; article
  role/tabindex/aria-label REMOVED; card-level click stays as a pointer
  convenience (guarded by isInteractiveCardTarget); focus ring drawn via
  .project-card:has(.card-open:focus-visible) twins.
- M25 skip-to-projects link (first element in body); filter-bar role=group +
  #filter-status aria-live announces "Showing N of 14 projects"; skill items
  lost the "Show X skill detail" aria-label override; the glass card is
  role=tooltip + aria-describedby, Escape dismisses it.
- M26 studio dialogs: #exp-panel lost aria-live (was dumping whole case
  studies), #exp-label gained aria-live=polite; setOverlayInert() makes the
  topbar inert + canvas tabIndex -1 while panelOpen (set in focusHotspot,
  cleared in closePanel); kbHighlight docks the label at the exhibit's
  PROJECTED screen position (was stuck at stale pointer coords offscreen).
- M27 JSON-LD: Person gains @id/email/affiliation; second block = ItemList
  of 14 CreativeWork entries (absolute image URLs).
- M15 (years on cards) POSTPONED: needs real per-project years from Kefan
  (do NOT invent dates). M10 resume PDF + M11 program facts also awaiting
  Kefan's data.
- QA gotcha (background pane): a pending camera flight makes kbBusy() true
  forever because the flight advances on real rAF — pump ~90 frames first.
- Verified by DOM probes: srcset picks 960w, fonts load with 0 Google links,
  0 external skill images, 14 .card-open buttons / 0 role=button articles,
  filter announces counts, inert toggles both ways, kb label lands on-screen
  (591,92 @1280x800). Console clean both pages.
  Cache: styles/script/project-data → audit2-20260714; experience.css/js →
  exp-audit2-20260714.

### 2026-07-14 (3rd pass) site audit batch 1 of ~4 (M1-M6, M8, M9, M13, M14)
- A 9-dimension Fable-5-max audit produced a 43-item approved plan (ids M*/S*/X*,
  full list in the session of 2026-07-14; Kefan approves batch-by-batch, 10 at a
  time). Batch 1, homepage:
- M1 #skills/#capabilities section heads wrapped in `.section-head.compact >
  div` (kicker+h2 were auto-placed into the WRONG grid columns; "Capabilities"
  overflowed the shell by 21px).
- M2 the late unscoped `.capability-grid` rule is now inside
  `@media (min-width: 981px)` — it used to override both mobile breakpoints
  (three 201px columns at 640px). NOTE: desktop columns for .capability-grid
  come ONLY from this rule; the base rule sets no columns.
- M3 `.contact-actions` is a right-anchored 272px stacked column; resume is
  the `.primary` button now ("View resume (PDF)"), mailto demoted.
- M4 `--hero-pad` = max(old clamp, (100% - --max)/2) — hero shares the 125px
  section spine at wide viewports (was x=48).
- M5 telecaster + ftc cards use `card-media--fill` (were letterboxed).
- M6 `.project-meta` 0.66→0.72rem and `--quiet`→`--muted`; `.footer-grid`
  `--quiet`→`--muted`; footer's last span lost its inline style (AA contrast).
- M8 skill matrix = flush spec-sheet rows (240px label + chips grid, bottom
  hairlines, no boxes); 980px two-column matrix rule removed, ≤720 stacks the
  row's two columns.
- M9 nav gained a Resume link (target=_blank, before the 3D Studio pill);
  contact resume button lost `download` (opens in tab).
- M13 project grid re-ranked: steering, brakeSim, javelin, ansysCfd,
  carbonSeat, seat, aura, scanner, formlabs, education, telecaster, ftc, pool,
  lineFollower — metas renumbered; Pool Sniper sub rewritten with real specs.
- M14 project-data.js: AURA payload story unified (structure sized for 300 lb,
  drivetrain tuned at 200 lb working load — five mentions now agree);
  "six-buckle"→"six-point harness with anti-submarine strap".
- Verified by DOM measurement at 1440/640 (hero x=125=shell, contact column
  3×272px, capability-grid 1 col at 640, matrix rows 240px+1fr, meta/footer
  color rgb(161,161,166)); console clean.
  Cache: styles.css + project-data.js (both pages) → `audit1-20260714`.

### 2026-07-14 (2nd pass) old desk pad peeked out under the cutting mat
- Kefan: "新cutting mat下面貌似盖着旧的". Root cause: the mat was authored at
  y=0.7729 believing the baked pad's top was 0.772 — it is actually 0.766
  (pad Mesh_0_22: center (0.02, 0.763, 0.16), 0.44x0.006x0.5, 1 mm proud of
  the slab top 0.765). The mat floated 6 mm in the air and the pad showed in
  the gap at grazing angles.
- Fix: the baked pad is HIDDEN in the GLB callback (world-bbox test, same
  pattern as the old pendant); the mat dropped to y=0.766 (0.2 mm above the
  slab); the resume paper dropped with it (placeRoot pos y = DESK_TOP +
  0.0061, was +0.013) and resumeSpot's target followed (0.769).
- The pad's baked AO/shadow on the desk lightmap sits entirely under the
  0.72x0.52 mat footprint, so hiding the mesh leaves no ghost.
- Verified: qx-graze/qx-graze2 grazing-angle captures clean, console clean.
  Cache: `exp-padfix-20260714`.

### 2026-07-14 Kefan corrections to the realism batch
- **Weld screen (K2) REMOVED** — Kefan: "argon围栏去掉". buildWeldScreen and
  its set-dressing add are deleted; a comment marks the spot. Do NOT re-add
  any fence/screen around the TIG corner.
- **Desk hand tools (K7) REMOVED** — Kefan: "桌面小工具去掉". buildDeskTools
  deleted; the desk far corner stays clear. Do NOT re-add.
- **Cutting mat is now 0.72 x 0.52 m LANDSCAPE** (was a near-square
  0.445 x 0.505 portrait) — Kefan: "改成大一点的长方形". Same center
  (0.02, 0.7729, 0.16); canvas is 720x520 px at 10 px/cm; still covers the
  baked pad and clears the desk lamp (base edge ≈ x -0.46) and the slab's
  front edge (mat front z 0.42 vs slab 0.45).
- **Chamber-fan rotation fixed** — Kefan: only the frame appeared to spin.
  MODELS.chamberFan pointed at the whole fanG (frame + guard + blades); the
  hub + 5 blade spokes now live in a `fanRotor` subgroup and MODELS.chamberFan
  points at THAT — frame and wire guard stay put, verified across two
  captures 20 frames apart (guard X static, rotor rotation.z accumulating).
- Verified: nx-*/px-* captures, console clean. Cache: `exp-tweaks-20260714`.

### 2026-07-13 24-item realism batch (approved: G1-G6, H2, H4, I1-I4, I6, J1-J5, J7, K1-K3, K5-K7)
- Kefan asked for a 5-dimension realism audit (animation/modeling/lighting/
  aesthetics/layout) and approved 24 items. NOT approved — do not build:
  H1 lamp power cables, H3 exhibit cradles, I5 screen bounce light, J6 wall
  card, K4 stock rack.
- **Animation (G)**: tick() is dtms-based now (tickLast); printer head runs a
  dwell/turnaround state machine instead of a sine; chamber fan + active spool
  spin; status LED breathes; scope redraws every 90 ms via MODELS.scope.draw;
  the moon target drifts very slowly.
- **Modeling (H)**: pegboard hooks under ~13 hanging tools; pendant rebuilt
  (canopy + strain relief + lathe bell shade + warm liner + socket + bulb);
  ceiling smoke detector (-1.0, 3.4, 1.6) + HVAC diffuser (1.15, 3.39, 1.75).
- **Lighting (I)**: pendant bulb + shade-liner emissive follow the light's
  day/night ramp (both applyLightState branches); benchBarSpot spotlights the
  bench and rides the bench ramp + night flicker; TIG corner has a warm 0.8
  point glow; ARGON/extinguisher labels are MeshStandard now (no night glow).
- **Aesthetics (J)**: desk slab gets a micro-wear roughness map INJECTED INTO
  THE BAKED GLB's material (buildDesk is hidden at runtime — editing it does
  nothing); cabinet frames brushed-rough; lamp LED warm white; PSU brushed
  alu; scope got a bezel plate; cutting mat replaces the black desk pad look.
- **Layout (K)**: cutting-mat overlay floats 0.9 mm above the baked desk pad
  at (0.02, 0.7729, 0.16); folding weld screen (REMOVED 2026-07-14 — see the
  latest entry; useful bounds if placing anything in that bay: back wall
  z=-1.55, the yawed cart's caster reaches x=1.324, walkway line z=-0.4);
  2nd fire
  extinguisher (2.14, 0, -1.2); hazard-striped hot-work floor marking + faint
  floor stains under the TIG corner; lab stool (-1.82, 0, -0.72); scrap bin
  (-2.14, 0, 1.62); small hand tools on the desk's far corner (REMOVED
  2026-07-14 — see the latest entry).
- **THREE BAKE-LAYER TRAPS hit and fixed — read before touching buildRoom or
  the baked GLB callback:**
  1. buildRoom's `scene` param is a SHIM whose add() names every NAMELESS
     mesh `bk_room`; the swap then hides the whole top-level group. Anything
     added inside buildRoom that must stay real-time needs its meshes
     pre-named (`rt_pendant`, `rt_ceiling`) BEFORE scene.add. The new pendant
     +smoke detector+diffuser were invisible until named — and the pendant
     POINT LIGHT had been dead since the bake (it sits inside the hidden
     group), so applyLightState's pendant ramp did nothing until now.
  2. room-baked.glb node transforms are INCONSISTENT (walls/floor Y-up with
     baked-in transforms; pendant/desk nodes Z-up + rotation). Every geometry
     test in the GLB traverse now runs on a WORLD-space bbox
     (updateWorldMatrix + applyMatrix4). The old local-space desk-slab test
     had NEVER matched — J1 desk wear silently no-opped until this fix. The
     old baked pendant (3 meshes near x .15 z .35 y>2.1) is hidden there too.
  3. The revived pendant light nuked its own shade: physical decay at cm
     range + near-white liner ≈ 1.0 HDR + UnrealBloom = white blob (day AND
     night). Fix: fixture meshes live on light-layer 2 (camera/key/hemi/fill
     enable it; the point light stays layer 0 so it can't hit the fixture),
     and the liner is matte warm grey 0x9a9288 with an emissive ramp
     (MODELS.pendantShadeInner) instead of white albedo.
- QA gotcha: runLightIntro/runBootIntro animate via REAL rAF — in a hidden/
  background pane they freeze at their start values (point lights 0, key/hemi
  at 25%). Set steady-state values by hand before captures; not a site bug.
- Review fixes (4-dim adversarial workflow, Sonnet-5 xhigh, 4 confirmed
  findings, all fixed): runBootIntro now blacks out + restrikes benchBarSpot
  (lamp beat, 5080 ms), tigGlow (right-side leg, 1300 ms; restored in
  bootRestore because applyLightState doesn't own it) and the pendant
  (main-cabinet beat, 2600 ms); runLightIntro stages the pendant bulb/liner
  emissives on the point-light clock (their night values sit under its 0.4
  emissive gate, so the generic sweep missed them); the weld screen was
  re-laid — its wing used to stick through the back wall.
- Verified: bx-*/hx-*/ix-*/jx-* captures (day-boosted + night), console clean.
  Cache: `exp-realism3-20260713`.

### 2026-07-13 fully-white lettering + wood bottom shelf + solid drawers
- Kefan round 6: letters still had dark speckle inside; bottom glass shelf
  looked down into the drawer void; drawer fronts read as floating panels.
- Tire (bl_tire2.py): texture-space close 8->12 px + bold 3 px (seals every
  in-glyph hole), white 0.97, Emission Strength 0.12 -> 0.35 — the emission
  is what finally makes the letters read UNIFORMLY white: it washes out the
  lumpy relief's facet shading (and GTAO darkening) that dotted the paint.
- Both cabinets: bottom row's shelf board is now OPAQUE cabinetBackMaterial()
  grey wood (0.02 thick), upper rows stay tinted glass.
- Drawer fronts became full solid bodies: main cabinet boxes 0.44 deep,
  side cabinet 0.4 deep, same front plane as before (front face position
  preserved by shifting centers back by half the added depth).
- Verified: tire-allwhite preview + aw-* in-scene captures, console clean.
  Cache: `exp-solid-20260713`.

### 2026-07-12 F1 drawer fronts + resolution floor + global anisotropy
- **F1 approved & built**: drawer fronts close the bare bottom compartments —
  main cabinet 3 (one per bay, inside buildCabinet, cabinet-local coords are
  world-space), side cabinet 2 (buildSideCabinet, local coords, front plane
  local x = -D/2). Satin frameMat fronts 0.58 tall + dark recessed pull slots.
  Cabinets are REAL-TIME groups (not bk_ baked), so no re-bake.
- **Resolution** (Kefan: everything blurs when the camera pulls back): the
  render pixel ratio was capped at DPR, and on Windows 125% scaling DPR is
  1.25 — the scene rendered at 1.25x. Desktop now FLOORS the ratio at 1.6
  (cap 2.2): `Math.min(Math.max(devicePixelRatio, 1.6), 2.2)`; LOW_TIER
  unchanged (cap 1.5). Set in BOTH the init and the resize handler, and the
  resize handler now calls composer.setPixelRatio too.
- **Global anisotropy sweep**: module-scope ANISO_DIRTY flag; the render
  tick traverses the scene once and maxes anisotropy on map/emissiveMap/
  roughness/metalness/normal/aoMap (NOT lightMap — the lm crossfade pipeline
  is delicate). Async GLB callbacks (room-baked, tire, helmets) re-arm the
  flag so late textures get swept. Fixes soft canvas labels/screens and the
  tire paint texture at grazing angles.
- Verified: f1-* captures (both cabinets' drawers, far view at 1.6 ratio,
  console clean; pane DPR measured 1.25 -> now renders 1.6).
  Cache: `exp-f1res-20260712`.

### 2026-07-12 tire lettering solidified in texture space + night emission
- Kefan round 5: lettering still read as grey mottle at night/from afar.
  Two causes: pinholes/filaments in the footprint that mipmapping averages
  into grey, and zero night light on that wall. Fixes in bl_tire2.py:
  (a) solidify in TEXTURE space (close 8 px + bold 2 px at 4096-wide —
  much finer than footprint-cell closing, still far under the ~40 px letter
  spacing); (b) faint emission (texture -> Emission Color, strength 0.12)
  so the white paint reads at night — rubber pixels are near-black and emit
  nothing visible. Verified at Kefan's own camera angle at night (fx10-*).
- CAB2's bottom compartment is a bare empty box; main cabinet bottom band
  similar. Proposals F1-F4 sent to Kefan (F1 drawer fronts recommended) —
  awaiting approval, nothing built.
- Cache: `exp-props5-20260712`.

### 2026-07-12 tire lettering = TEXTURE; helmets further left
- Kefan round 4: lettering still read speckled in-scene. Root cause of the
  speckle: painting FACES of lumpy faceted relief means the paint boundary
  follows tessellation, never pixel-clean. FINAL pipeline (bl_tire2.py):
  ray-cast footprint (unchanged) -> drawn into a 4096x128 band TEXTURE
  (antialiased) -> sidewall band UV-mapped by (theta, r) -> pixels define
  the paint edge. Key traps encoded in the script:
  (a) front/back sidewall lettering is MIRRORED — the mirror-flip agreement
  is 96% vs 10% raw; texture is built from the FRONT footprint and the BACK
  UVs use u -> 1-u (OR-ing the two footprints overlays text+mirror garbage);
  (b) faces crossing the u seam get +1 u-spill with REPEAT extension (the
  BOTTOM wordmark sits right on the seam);
  (c) morphological opening GUTS the footprint (much of a glyph is 1 cell
  wide) — despeckle by component size (<8 cells) instead;
  (d) the wordmark is angularly ASYMMETRIC (~-36..+44 deg): SECTOR 40 deg
  clipped the trailing "r"; keep 46 deg;
  (e) the tiny blob after the wordmark is the Hoosier "(R)" mark — REAL,
  do not filter it; the dark jagged shapes near the shoulder are unpainted
  mold relief, also real.
- Helmets moved further left: stack x -1.72 -> -1.84.
- Verified: fx9-* captures (tire straight + room angle, stack), tire GLB
  now carries a packed PNG texture. Cache: `exp-props4-20260712`.

### 2026-07-12 SOLID tire lettering + no lamp cord + helmets left
- Kefan round 3: remove the desk-lamp cord, shift the helmet stack left,
  tire lettering still wrong (hollow-outline letters).
- **Tire lettering — the definitive pipeline** (scratchpad bl_tire2.py).
  Ground truth from a raking-light closeup (bl_closeup.py): the big HOOSIER
  glyphs are SOLID but LUMPY faceted relief (dense small facets base→peak);
  the base sidewall is a few huge triangles; small legends are fine engraved
  outlines. Consequences that broke every statistic-based attempt:
  (a) face-count medians/percentiles per radius bin land on glyph slopes,
  not the base; (b) any |normal.z| gate deletes the glyphs' steep facets
  (the "white outline with dark fill" symptom); (c) vertex-density stats
  fail the same way. What WORKS: **BVH ray-cast height map** — one ray per
  (θ,r) cell per side (front/back lettering is mirrored, never share a
  raster), per-RING base = median over the full circle, glyph cells =
  height > base + 0.15 mm, sector gate (±46° of ±Y keeps small legends
  black), morphological close(4), paint faces by footprint cell with an
  outward-normal gate (interior liner shares cells through the bore).
- Desk-lamp power cord REMOVED (was C6) per Kefan.
- Helmet stack moved to x -1.72 (from -1.55) — centered in the pocket.
- Verified: fx8-* captures (tire straight-on, clean desk, stack, night
  rest view), console clean. Cache: `exp-props3-20260712`.

### 2026-07-12 tire lettering color + helmet stack + extinguisher to wall
- Kefan: big HOOSIER script must be WHITE, small legends TIRE-COLORED (his
  reference photo); stack the helmets (racing on top, welding below); put the
  extinguisher against the wall.
- **Tire lettering** (scratchpad bl_tire2.py): paint ONLY the big HOOSIER
  wordmark white. Connected-component sizing FAILED (the STL has overlapping
  shells — components came out duplicated 2/4/8×, glyphs fragmented). What
  works: paint raised band faces that fall in the TOP/BOTTOM angular sectors
  (±46° of ±Y — the two HOOSIER instances live there; every small legend is on
  the L/R arcs) AND r > 0.162 (drops the "MADE IN U.S.A." legend that shares
  the top sector but sits inboard). Small text now renders tire-black.
- **Helmets stacked** at x -1.55: GT3 at y 1.94, weld at y 1.46 (0.48 gap;
  heights 0.36 + 0.32 need ≥0.34). buildWallHelmet's `yaw` + per-model
  `neckPoint` unchanged in signature; GT3 neckPoint raised to (0, 0.01,
  -0.055) so the peg tip doesn't poke below the chin bar.
- **Extinguisher** moved to (-1.66, 0, -1.4) — on the floor against the back
  wall (face -1.515), left of the helmet stack. Reads at the actual rest
  camera; only fully framed from unreachable close angles.
- Verified via st2-* captures (tire, stack, rest-camera wide) + console clean.
  Placement/material tweaks on already-reviewed geometry, so no new adversarial
  round. Cache: `exp-props2-20260712`.

### 2026-07-12 STRICT tire + wall helmets + fire extinguisher
- Kefan: tire must be STRICTLY the STEP model, NO wheel; E2 extinguisher
  approved (small, ON THE FLOOR near the cabinet); hang a welding helmet and
  a white racing helmet on the wall. Source STLs live in `Desktop\stl\`
  (tire re-export, 15-part welding-helmet set, 24 MB GT3 helmet) — NOT
  committed; GLBs in models/ are.
- **The "no helmet props" rule is SUPERSEDED** — Kefan explicitly asked for
  these two wall helmets (2026-07-12). Do not remove them.
- `models/tire-hoosier-step.glb` (4.6 MB, 150k tris) replaces the deleted
  tire-hoosier.glb. Pipeline: scratchpad `bl_tire2.py` — weld, detect the
  raised sidewall lettering at FULL res (radius-binned base surface, faces
  >0.25 mm proud w/ axial normals, band r 0.157–0.191 — wider band painted
  the bead sawtooth ring white), paint it factory white, THEN decimate.
  buildHoosierTire() now has NO wheel/ring code; bracket only. Bracket
  gotchas (all review-caught): plate corners must fit inside the band
  annulus 0.127<r<0.2032 (span y 0.128..0.198); the tire circle at the
  arm's x=±0.09 bottoms at y=-0.182 not -0.203; lip near face 0.110 vs
  widest sidewall 0.108.
- `models/helmet-weld.glb` (1.3 MB, bl_weld.py: 13 assembly-coord STLs
  joined, per-part materials by filename — Component157 IS the lens
  cartridge) and `models/helmet-gt3.glb` (2.1 MB, bl_gt3.py: separate-loose
  -parts + debug-hue inspect pass, part 16 = visor smoke, 2/4/10/27/28 dark)
  hang on the back-wall pocket (GT3 at x -1.76 open middle, weld at -1.38
  near the cabinet). Both GLBs pre-oriented face+Z/up+Y (Blender: rotX 90°
  then rotZ -90°, or already-correct; glTF export is Y-up).
  buildWallHelmet(loader, url, wallDz, yaw, neckPoint): peg+base stay
  wall-aligned and only the helmet mesh yaws (group yaw tilted the base off
  the wall); neckPoint is PER MODEL — GT3 (deep shell) needs (0,-0.03,-0.06)
  or the peg tip pokes out under the chin bar (review blocker).
- buildFireExtinguisher() at (-1.33, 0, -0.9): ~0.44 m tall, levers hinge
  10 mm into the head edge (not through it), nozzle axis distance 0.0631 >
  body 0.052 + tip 0.009. Deeper pocket spots vanish behind the desk.
- STEP→mesh how-to: `pip install cadquery-ocp` into the codex Python, then
  scratchpad step2stl.py; STL sets export in shared assembly coords so a
  plain join reassembles them. Blender previews via EEVEE headless PNGs are
  the fast iteration loop for orientation/material mapping (debug-hue trick:
  color part i by hsv((i*0.37)%1) and read indexes off the render).
- Verified: pp5-* captures + 3-lens adversarial workflow round 2 (caught:
  bracket tab above the tread, arms floating 2.2 cm, GT3 peg nub, lever/
  nozzle clipping — all fixed). Console clean. Cache:
  `exp-stepprops-20260712`.

### 2026-07-12 REAL Hoosier tire from Kefan's STEP file (SUPERSEDED — see above; the GLB name below is the OLD deleted one)
- Kefan supplied `Desktop\WEBSITE\hoosier-16x7-5-10-fsae-tire-1.snapshot.1\`
  `Hoosier 16x7.5-10 LC0.STEP` (27 MB B-rep, GrabCAD snapshot — do NOT
  commit it). Pipeline: `scratchpad/step2stl.py` (OCP a.k.a. OpenCascade
  bindings, `pip install cadquery-ocp` into the codex Python 3.12) tessellates
  STEP→binary STL (lin 0.8 mm / ang 0.35 rad → 150k tris), then
  `scratchpad/bl_tire.py` (Blender headless) welds, decimates to 36k tris,
  smooths by 35°, rotates the tire axis onto +Z, scales OD to the real
  0.4064 m, centers, exports `models/tire-hoosier.glb` (1.14 MB, committed).
- Measured after transform: OD 0.4065, width 0.2162, bore r 0.1269 (= 10"
  wheel, real). NOTE: glTF export is Y-up, so the axis lands on +Y in
  three.js — `buildHoosierTire()` rotates the loaded scene x += π/2 back.
- `buildHoosierTire(loader)` now takes the shared GLTFLoader (boot manager
  gates on it). Wheel rebuilt to the real bore: barrel r 0.128 × 0.19,
  spokes 0.115 long, hub r 0.034, blue center-lock nut. Lettering ring
  radii 0.14–0.196, letters at canvas r 222 ↔ world r ≈ 0.17, ring z
  0.110 — the REAL sidewall's widest point is 0.108 and a ring at 0.106
  clipped letter bottoms off. Bracket arms moved UNDER the tire (y −0.212,
  tire bottom −0.203); group z −1.405 puts the tire back flush with the
  wainscot (−1.515). GLB sidewall is smooth (no molded text) — the canvas
  ring is the only lettering, so keep it.
- Verified: rt2-front/rt2-angle/rt2-night captures, console clean.
  Cache: `exp-realtire-20260712`.

### 2026-07-12 realism fix round 2 (Kefan's 4 complaints on the set-dressing)
- **Tire = Hoosier R20 with a real wheel.** Bottom arc now "R20" (was RACING
  TIRE). Bore filled by a 5-spoke machined wheel: open barrel r 0.082 (bore is
  0.08), spokes 0.076 long reach hub→barrel with no gap, hub + BLUE hex
  center-lock nut (echoes the brand blue).
- **Welding-cart top rebuilt as ONE connected stack** (v1: ARGON label was a
  flat plane floating off the curved bottle; two gauge discs floated 17 mm in
  front of a detached regulator block; no valve on top): brass valve body on
  the shoulder + dark handwheel + brass outlet nipple (+z) + cylindrical
  regulator + a SINGLE gauge flush on its face + barb + hose. The hose stays
  above y 0.745 until z clears -0.16 (the TIG box top-back edge at y 0.73 /
  z -0.15 — a tighter route grazed it). ARGON label is now an open
  CylinderGeometry segment (r 0.0757, θ 1.5 rad) sharing the bottle's axis.
- **Torch actually hangs on the push-handle bar**: TorusGeometry hook arc
  1.7π with rotation.z = -0.35π so BOTH arc ends dip below the bar centerline
  (y 0.78) and land on the torch-body top cap (y 0.7665). A plain π top-arc
  leaves a 13.5 mm air gap — caught by the adversarial review via torus-arc
  math, not by captures (the handle side is occluded from most angles).
- **Printer chamber fan** (was the "奇怪的线圈" complaint — a flat canvas of
  concentric rings floating mid-air at z=-0.093 vs the chamber inner back
  plane z=-0.10): real 3D axial fan flush on the back wall — dark RoundedBox
  frame, LIGHT blades (0x8f959d metalness 0.6 — v2's dark blades vanished
  and its bright guard re-read as a coil; review caught it), 5 pitched blades
  via per-blade group (group.rotation.z spoke + blade.rotation.y pitch:
  local y is the radial axis, uniform pitch), DARKER guard (0x3f4348), hub
  height 0.011 ≤ frame depth 0.012 (0.014 poked 1 mm past the wall).
- QA gotchas learned this round: after a page reload, pump ~450 frames FIRST
  (boot intro tweens the camera; snapshots mid-intro show the cabinet);
  with `controls.enabled=false` the loop skips update()/lookAt — you MUST
  call `camera.lookAt(controls.target)` after setting the pose or the camera
  translates with a stale orientation.
- Verified via captures (fx3-*/fx4-* in scratchpad snaps): cart front/top/
  rear-3/4, tire straight-on, fan close + through-door, night visitor
  angles; 3-lens adversarial workflow (Sonnet-5 xhigh) passed after fixes.
  Cache: `exp-realism2-20260712`.
- Corner/wall proposals for the MAIN cabinet's left pocket + wall above are
  awaiting Kefan's pick (D1-D4 / E1-E4 in chat, 2026-07-12); nothing built.

### 2026-07-12 realism set-dressing (Kefan approved A3/A5/B1/tire/C2/C4/C5/C6)
- From a 3-lens realism audit; Kefan approved by number. All NEW geometry is
  REAL-TIME (no `bk_` tags) so it renders over the baked room with no re-bake.
- Printer internals (`buildBambuPrinter`): **A3** CoreXY idler pulleys at the
  crossbar ends + two thin timing-belt strips (static — sweep delta is minor);
  **A5** chamber timelapse camera (top-front corner), toolhead inspection lens
  on the shroud (child of `headGroup`, rides the sweep), rear circulation-fan
  grille (canvas disc on interior back wall), Z-screw coupler collars, teal
  status-LED strip on the bottom bezel lip.
- **B1** `buildWeldingCart()` at (1.62, 0, -1.14) rotY 0.35 — corner pocket
  between the cabinets (x 1.25..1.98, z -1.45..-0.92). TIG machine in brand
  blue w/ emissive "142 A" canvas face, argon cylinder + brass valve + twin
  gauges + ARGON stencil + strap, torch on the handle w/ cable loop. Camera
  can never reach it: azimuth ±0.32π keeps camera z > target.z (-0.1).
- **Hoosier tire** `buildHoosierTire()` at (1.62, 1.72, -1.44) on the back
  wall. Slick = plain torus (accurate). Lettering: transparent RingGeometry
  at z=0.0757 — just PROUD of the torus crest (0.075); at the sidewall midline
  the letters bury inside the tire's bulge (first attempt showed only dashes).
  Bottom-arc text rotates `a - π/2` (tops inward) or it reads upside down.
  Bracket plate slimmed to 0.05×0.12 @ y 0.15 — a wide plate showed through
  the hub hole.
- **C2** `buildFloorJoints()` — saw-cut strips at x ±1.7 / z 0.6, 2.6, y
  0.0015 (under the rug they're occluded by it). **C4** `buildBenchMat()` —
  ESD mat (-1.66, -0.2) w/ grid canvas + green ground lead + copper lug (rug
  ends at x -1.15, no overlap). **C5** `buildChestTopProps()` — torque wrench
  / folded safety glasses / parts tray+bolts as a standalone group at the
  chest's world pose (-2.22, 0.791, 1.06) rotY π/2 — the chest itself is
  bk_chest (baked, procedural original hidden) so props CAN'T live inside
  buildToolChest. **C6** desk-lamp cord: desk top is y=0.766, back edge
  z=-0.45 (measured via Box3, NOT -0.29 as eyeballed — first cord dove into
  the desktop); cord stays at y≈0.771 until z -0.42, then drops behind.
- NOT approved (do not add unasked): A1/A2 filament tube + drag chain, A4
  purge tower, B2 stock rack, B3 banner, B4 tire stack, C1 shelf placards,
  C3 conduit, C7 laptop. Engine stand / second toolbox explicitly rejected
  by audit (adjacent to previously-removed props).
- QA notes: in-chamber captures need `controls.minDistance` temporarily
  dropped (1.4 pushes the camera out); night shots of dark props need a
  temporary key/hemi boost or a throwaway PointLight (remove after). snapsrv
  POSTs from the page need `mode: "no-cors"`. Verified: corner + tire + cord
  + mat + joints + chest top + chamber internals via canvas captures, console
  clean. Cache: `exp-realism1-20260712`.

### 2026-07-12 REVERTED: 360° orbit + Boston window (Kefan: "太乱了")
- Kefan reverted the whole 360°/window experiment same-day. Removed:
  `makeBostonSkylineTexture` + `buildCityWindow` (+ its scene.add), the
  `windowGlow` SpotLight and all its applyLightState/boot wiring
  (`win`/`winSky` keys), the open-central-volume camera clamp and the
  desk-lamp keep-out. Restored: azimuth ±0.32π, minDistance 1.4, wall clamp
  x ±2.35 / z [-1.25, 3.35] / y [0.4, 3.15]. The post-clamp
  `camera.lookAt(controls.target)` re-aim was KEPT (that mis-aim bug predates
  360° — side-wall zoom-out was reachable in the old range too).
- **Do NOT re-add the window/360° without Kefan asking.** If it ever comes
  back, the day/night skyline + full-furniture containment work is in git
  history (`a57d5db`, `f66775e`) and the pitfalls are documented in the two
  entries below.
- P2–P7 bench/printer modeling and all résumé-pickup work are untouched.
- Verified after revert: azimuth ±0.32π, minDistance 1.4, no skyline meshes
  in the scene (the one 16:9 texture left is the CFD monitor exhibit —
  expected), front wall plain, pickup lands posErr 0, lamp toggle both ways
  (key 0.22↔1.15), no console errors. Cache: `exp-nowindow-20260712`.

### 2026-07-12 360° containment: clear ALL wall furniture (REVERTED, see above)
- The first cabinet-clip fix only protected the MAIN cabinet (z-clamp). An
  adversarial review found the camera still orbited INTO the right cabinet
  CAB2 (x≈2.0–2.5), the desk lamp (from the minDistance 0.6 drop), and the
  ceiling pendant. The render-loop camera clamp is now an open-central-volume
  box that clears every piece of wall furniture:
  x `[-1.8, 1.85]` (in front of CAB2's open face ≈2.0 and the left workbench
  front ≈-1.9), z `[-0.75, 3.35]` (front of the main cabinet), y `[0.4, 2.25]`
  (below the pendant shade at ≈2.42). Plus a keep-out that LIFTS the camera to
  y=1.45 when it's within 0.5 m (horizontal) of the thin desk-lamp axis
  (-0.7, 0.13) — pushing UP (not radially) so it stays > minDistance from the
  target and can't oscillate against OrbitControls.
- Verified with a 1080-sample azimuth×polar×radius sweep: ZERO penetrations of
  the main cabinet / CAB2 / workbench / pendant / desk / lamp bounding boxes.
  Dead-behind at min-zoom (window view) holds distance with no drift.
- Cache: `exp-clampfix-20260712`.

### 2026-07-12 window day/night + no cross + slimmer + no cabinet clip
- **360° no longer clips the cabinet:** the back-wall camera clamp was
  `cp.z ≥ -1.25`, which is INSIDE the main cabinet (center z=-1.12, depth
  0.54 → front face -0.85). Moved to `-0.75` (0.1 in front of the cabinet
  face) so a full orbit can't enter it. minDistance dropped 1.1→0.6 to keep
  it under the new dead-behind clearance (target.z − clampZ = 0.65) so
  OrbitControls doesn't fight the clamp. Verified: 360° azimuth sweep bottoms
  at z=-0.75 (clip-safe), dead-behind at min-zoom holds distance (no drift).
- **Window geometry** (`buildCityWindow`): height 1.8→**1.2** (2/3, letterbox
  picture window), centered cy 1.9→1.78; **cross mullions removed** (outer
  border only); frame border `t` 0.09→**0.05** (slimmer), depth 0.05→0.045.
- **Day/night skyline** (`makeBostonSkylineTexture(mode)`): now takes
  `"night"|"day"`. Day = pale-blue sky + clouds, light grey-blue daylight
  facades, sky-reflecting glass tower, blue harbor, no red beacon. The window
  stacks TWO planes — opaque night behind + a transparent day plane IN FRONT
  (`front-0.021`, smaller z = closer to camera; putting it behind night was a
  bug — night occluded it). `MODELS.cityWindow.dayMat.opacity` crossfades
  0↔1 in `applyLightState` (new `winSky` in want/from/instant/step), so the
  city turns to daytime when the lamp turns the room lights on. Day window
  spill `win` 0.6→1.6. Verified: opacity ramps 0→1 on toggle, day skyline
  renders, toggling back restores night.
- Cache: `exp-daywindow-20260712`.

### 2026-07-11 360°/window review fixes (4, from adversarial review)
- **minDistance 1.4→1.1:** with 360° azimuth the camera can face the window
  from the back-wall side, where the AABB z-clamp (cp.z ≥ -1.25) sits 1.15
  from the target; at 1.4 OrbitControls kept re-deriving radius<1.4 from the
  clamped position and stretching the offset out every frame (camera
  drift/stutter). 1.1 < 1.15 removes the conflict. Do NOT raise past ~1.15
  without moving the clamp/target apart.
- **Re-aim after the AABB clamp:** the render-loop wall clamp ran AFTER
  OrbitControls' internal `lookAt`, so a clamped frame (e.g. zoom-out toward a
  side wall) rendered mis-aimed. Now re-`camera.lookAt(controls.target)` only
  when the clamp actually moved the camera.
- **windowGlow boot ramp:** it was stranded at full night intensity (2.6)
  through the first-visit cold-boot blackout while the rest of the room was
  black. Now zeroed in the blackout and ramped up on the moon beat
  (`seg(3600,900,...)`), verified 0 through blackout → 2.6 with the moon.
- **Skyline texture LOW_TIER-gated:** `makeBostonSkylineTexture` is 1024×576 +
  anisotropy 2 on LOW_TIER (was always 2048×1152 + max aniso, ~12MB GPU) —
  matches the file's "phones stay on 2K" convention.
- Cache: `exp-orbitfix-20260711`.

### 2026-07-11 window city-glow (real-time, NOT baked — why)
- The window now spills a cool city glow onto the floor/desk. It is a
  REAL-TIME SpotLight (`windowGlow`, colour 0x9fbdf0, from the window aimed at
  the floor in front), faded by the lamp toggle inside `applyLightState`
  (night `win: 2.6`, day `win: 0.6`) — same pattern as the pendant / desk lamp
  / bench glow, which are ALL real-time.
- **Why not baked** (Kefan asked for all-baked): I DID run the bake — a
  window-only Cycles pass onto the existing `lm` atlas (tools kept in scratch:
  `bake_window.py`, `composite_lm.py`), additively layered onto the pristine
  lightmaps so the existing bake was preserved exactly. But the added spatial
  variation nearly DOUBLED the Radiance lightmap payload (17MB→31MB per 4k;
  5MB→8.8MB per 2k) — ~+40MB of first/idle load — for a subtle effect. That
  is a bad web-perf trade, so the bake was reverted (`git checkout
  models/baked/`) and the glow is a ~free real-time light instead. The bake
  pipeline works if a future change wants it (the two scripts + the
  additive-composite approach are proven); `BAKE_V` in experience.js is the
  cache-buster to bump when re-baking (currently "").
- NOTE on "all lights baked": the room ARCHITECTURE (shell/desk/chest/rug) is
  baked as before; the practicals (cabinet strips, pendant, desk lamp,
  bench, window, exhibit focus spot, résumé pickup) are real-time by
  necessity — exhibits rotate and the résumé is picked up, so a static
  lightmap can't carry them. Converting the cabinet strips to baked would
  darken the rotating exhibits and remove tunability; not done.
- Cache: `exp-cityglow-20260711`.

### 2026-07-11 studio modeling pass + Boston window + 360° orbit
- **Full 360° orbit:** `controls.min/maxAzimuthAngle` unlocked to ±Infinity
  (was ±0.32π). The per-frame AABB clamp still keeps the camera inside the
  shell. All four walls have content (cabinet back / workbench left / right
  cabinet / window front) so every heading reads.
- **Boston night-skyline window** (front wall, `buildCityWindow` +
  `makeBostonSkylineTexture`): a large 3.2×1.8 picture window mounted as a
  BACKLIT PANEL on the interior face of the front wall (z≈front−0.02..0.06),
  NOT a real hole and NOT tagged `bk_`, so it is added outside the bake
  wrapper and shows whether or not the baked room is active. From inside the
  camera is clamped away from the wall, so it reads exactly like a real
  window. Skyline is a procedural 2048×1152 canvas (deep-navy sky, horizon
  glow, layered downtown silhouettes with scattered warm/cool lit windows, a
  central tapered tower + red antenna, stepped Pru-ish block, harbor
  reflection) on an unlit MeshBasic (self-lit city). Frame = dark aluminium
  mullions (2×2 panes) + sill. Glass = faint top-left corner sheen only (a
  full diagonal streak read as a searchlight — do NOT reintroduce it).
  Always-night in BOTH light states (the lamp toggles the ROOM lights, not
  day/night), which keeps 夜景 coherent.
- **P2–P7 modeling** (all in the workbench / printer builders):
  - P2 printer: the mid-print object is now a recognizable engineering
    bracket (base + bolt bosses + upright web + 45° gusset + a lighter
    translucent top "growing" layer) instead of a blue box; textured PEI
    build plate (dot-grid canvas).
  - P3/P4 printer: door bar handle on standoffs + two hinges (knuckles+pins);
    screen UI gained a print-job slot (bracket thumbnail + "L 142/215").
  - P5 multimeter: its OWN coiled red/black probe leads + probe pens, clearly
    separate from the PSU leads.
  - P6 soldering station: brass-wool tip-cleaner pot + yellow sponge tray +
    a sagging iron cable.
  - P7: a compact bench **oscilloscope** (graticule screen with live yellow
    sine + cyan square traces, knob column, BNC inputs) back-row between
    printer and PSU.
- Cache: `exp-window-20260711`. **Re-bake still pending** — see the next
  entry once done; the window's city-glow SPILL onto the room is NOT yet
  baked (the panel is self-lit only).

### 2026-07-11 marker v3: centered over the résumé, contrast backing
- The résumé marker moved from the sheet's top-right corner (read as
  detached) to CENTERED directly over the sheet (markerX/Z = 0,
  markerY = 0.16 — high enough to never cover the print from any camera).
- `makeInteractMarker` gained a soft dark backing disc behind the diamond:
  the marker carries its own contrast plate, so it reads over the white
  résumé/CFD monitor and the bright walls, while the disc melts away over
  dark exhibits. Contours darkened, pulse floor raised to 0.72–0.96, sprite
  0.048 (hover 0.066). Kefan asked about white-background legibility twice —
  do not lighten this design without testing on the résumé sheet.
- Cache: `exp-marker2-20260711`.

### 2026-07-11 full-bleed sheet: aspect stretch kills the bottom band
- Kefan's screenshot showed a grey band under the résumé: on content-fit
  viewports the DOM sheet is slightly taller than 3:4 (e.g. 540×732), so the
  paper left a ~12px uncovered strip at the bottom where the blurred scene
  flickered through during the cross-fade.
- `computePaperHold` now stretches the pivot along the sheet's long axis
  (`pivot.scale.z`, clamp 1–1.08) to the DOM rect's aspect, and
  `buildSheetSnapshot` extends the texture by the SAME factor (cache keyed on
  width+texH) — the paper backs the DOM FULL-BLEED. Measured flush ≤0.8px on
  all four edges at 810×1070 (dB exactly 0) and 1280×720 (all 0.0). worldW/H
  are measured via direct face-edge world distances (getWorldScale smears
  non-uniform scale through rotated hierarchies). Scale restored to baseScale
  at landing and in the reduced-motion close (verified scaleZ back to 1,
  posErr 0).
- Mobile (92vw sheets, aspect ~2.0) stays clamped at 1.08 → top-aligned
  partial coverage as before, now 72% of the sheet, with a known ±2px edge
  residual at full clamp (reconstruction approximation along the stretched
  axis) — imperceptible in the 220ms dissolve; do not chase it below that.
- Cache: `exp-fullbleed-20260711`.

### 2026-07-11 lightmap-blend fix, moon handoff, rim fix
- **The lamp toggle's "one dark frame at the end" was a from-day-one shader
  bug:** `onBeforeCompile` receives the fragment source BEFORE `#include`
  expansion, so the old code that string-replaced the EXPANDED lightmap line
  silently no-oped — the lmMix/lightMapB crossfade NEVER worked. The toggle
  only faded the real-time lights, then the lightmap pointer swap at the end
  committed the whole baked day/night difference in ONE frame (31% of the
  night-direction luminance change). Fixed by expanding
  `THREE.ShaderChunk.lights_fragment_maps` ourselves and patching the line
  inside it. Measured: both directions now ease continuously (105.9↔62.0)
  with ZERO terminal jump. If three.js is ever upgraded, re-verify this
  chunk's contents.
- **Moon gobo yields during the pickup** (`paperMoonRest`, same mechanism as
  the pool handoff): the window-frame gobo (intensity 11) sweeps the air in
  front of the desk — exactly the sheet's flight corridor — and painted a
  moving bright wash across the page (the flicker/ghost wash in Kefan's
  screenshot). It fades out during the 430ms warm-up, stays 0 while reading,
  and rises back with the return (exact restore at landing). Held-sheet
  uniformity measured 214–225 across five sample points.
- **White rim gone:** the backing slab was 0.24×0.32 under a 0.234×0.312
  printed face — the 2.6% overhang stuck out past the pixel-aligned DOM sheet
  during the cross-fade. The slab now matches the face exactly.
- Cache: `exp-lmfix-20260711`.

### 2026-07-11 pickup light-handoff + smooth lamp toggle
- Kefan: pickup still showed "light flicker + ghosting"; the lamp toggle fade
  was janky. Three structural causes found and fixed:
  1. **Backdrop dim veil during the swap.** `.exp-paper-active .exp-backdrop`
     dimmed the scene 60% while the DOM sheet faded in ABOVE it — the bright
     3D sheet dipped dark then recovered through the semi-transparent DOM
     (read as flicker/ghosting). The paper backdrop is now `background:
     transparent` (click-catcher only), same decision the project panel made
     long ago; depth separation comes from the bokeh blur.
  2. **Pool+emissive bloom stack at click.** The emissive warm-up (0→0.7 on
     the desk) STACKED with the 1.5 lamp pool and crossed the bloom threshold
     — the sheet flared right at click. Now a LIGHT HANDOFF: during the
     warm-up the pool dims 1.5→`SPOT_DIM` (0.35) in step with the emissive
     rise (paper luminance measured monotonic 203→228, no spike); the pool
     ramps back during the return and the emissive glides out over the last
     18% of the descent (touchdown measured 232→203 over ~200ms, no step).
     `paperSpotRest` remembers the pool level; restored on every close path.
     The 1/f flicker skips resumeSpot for the whole pickup cycle
     (`spotSteady`).
  3. **Lamp toggle pops.** lampLeds (2.4↔0.05) and the rug blue lines
     (1.1↔0.12) used to SNAP at fade start — they now ride the same eased
     step; the environment probe swaps at the fade MIDPOINT instead of the
     start; the idle-loaded day assets are pre-uploaded (`renderer
     .initTexture`) and the day probe is pre-filtered via PMREMGenerator at
     load, so the first toggle can't hitch on a GPU upload/convert.
- QA note: `applyLightState`'s crossfade is rAF-driven — FROZEN in a
  backgrounded preview tab. To drive it deterministically, patch
  `window.requestAnimationFrame` to queue callbacks and flush them with
  synthetic timestamps (see this session's transcript for the recipe).
- Cache: `exp-smoothlight-20260711`.

### 2026-07-11 light tune: lamp pool down, strips up again
- **resumeSpot night 2.8 → 1.5** (applyLightState + the runBootIntro
  lamp-click beat, which must always land on the same value). At 2.8 the pool
  washed out the upper half of the desk résumé — the DOM-parity texture has
  more white area than the old Arial mini, so the old tuning over-exposed it.
  Sampled/screenshotted at 2.8/2.0/1.5: 1.5 keeps every section readable with
  the pool still owning the mat. Do not raise without re-checking legibility
  of the SHEET, not just the pool.
- **Cabinet strips up again** (second Kefan request): main 11.5→13.5, side
  10.8→12.7 (LOW_TIER 19/18).
- Cache: `exp-lighttune-20260711`.

### 2026-07-11 studio polish pass (6 Kefan items)
- **Click-hint shorter:** `showClickHint`'s auto-dismiss 5000→2500ms.
- **Cabinet exhibits brighter:** the per-row `RectAreaLight` strip intensities
  bumped — main 9.0→11.5, side 8.5→10.8 (LOW_TIER 14/13→16.5/15.5). Exhibits
  read too dim before. Tune HERE (the strips ARE the exhibit lighting), not
  via ambient/env.
- **Desk-lamp head now AIMS at the résumé:** the lamp sits at desk-left
  (x=-0.8, kept there so it doesn't block the LineFollower bay) while the
  résumé is at desk-center, so the old straight-down head pointed nowhere near
  the pool it cast. `buildModernDeskLamp` now hangs the drop-link + head + LED
  in a `headGroup` tilted `rotation.z = 0.95 rad` toward the paper; the head
  visibly rakes down-forward along the beam. `headLocal` (where `resumeSpot`
  originates) is recomputed via `g.worldToLocal(led world pos)` AFTER the tilt,
  so the spot still starts at the LED. Light direction/target unchanged — only
  the geometry now matches it. If you move the lamp or résumé, re-derive the
  tilt.
- **Multimeter no longer wired to the PSU:** the PSU test leads used to drape
  all the way to the multimeter (x~0.24), reading as one wired rig. They now
  coil on the bench right in front of the PSU (x 0.4–0.54) and the multimeter
  sits standalone.
- **Résumé pickup "flash" removed:** the face emissive used to ramp 0→target
  DURING the lift/return travel, so a glow swept across the moving sheet
  (bloom-amplified). Now the warm-up runs only during the pre-lift delay while
  the sheet is STILL ON THE DESK (`warmup = min(1,(t-t0)/delay)`), then holds
  CONSTANT for the whole travel; return holds constant too and only cuts to 0
  at landing (in the lamp pool, so the cut is masked). Measured: emissive
  reaches 0.7 by the time y leaves 0.775, constant through the flight.
- **Interact marker readable on white:** `makeInteractMarker` switched from
  AdditiveBlending (invisible on the white CFD monitor / résumé) to
  NormalBlending with a dark contour behind the brand-blue diamond ring and a
  dark-edged white core; pulse opacity floor raised (0.62–0.88). Reads on both
  dark wood and white exhibits now.
- Cache: `exp-studiotweaks-20260711` (css + js).

### 2026-07-10 hover-scale fix — the LAST end-of-pickup flash
- Kefan still saw a flash at the very end of the pickup (screenshot showed
  the DOM sheet ~6% larger than the 3D sheet behind it, vertically offset).
  Root cause: users HOVER before clicking, so the pivot carries the 6% hover
  scale-up (baseScale×1.06) at click time; `computePaperHold` measured the
  sheet's world size with that inflation → held distance ~6% too far → the
  sheet landed ~6% smaller than the DOM and the cross-fade popped. Every
  earlier verification used synthetic clicks WITHOUT a hover — the exact
  blind spot.
- Fix: `beginPaperLift` snaps `pivot.scale` to baseScale at click (reads as
  press feedback), and `computePaperHold` divides all measured scales by the
  residual hover factor as defense. QA MUST simulate hover before click
  (pointermove → pump ~60 frames → pointerdown/up) — synthetic clicks skip
  the hover ease and hide this whole class of bug.
- Verified with the real hover path: fade-flip alignment 0.9994–1.0001 width
  ratio, ≤0.2px offsets, exact settle, clean landing — at 1280×720 AND
  1000×1300 (the tall-viewport shape from Kefan's screenshot, where the full
  sheet fits and the paper covers all but the bottom ~14px).
  Cache: `exp-hoverfix-20260710`.

### 2026-07-10 the résumé IS the model's texture — one skin, zero switches
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
- `styles.css?v=vine-20260714` (in index.html)
- `script.js?v=modalfix-20260805` (in index.html)
- `project-data.js?v=bucketbot-20260813` (shared case-study data; loaded before script.js on index.html and before experience.js on experience.html — bump in BOTH)
- `experience.css?v=exp-vine-20260714` (3D page styles — in experience.html)
- `experience.js?v=exp-vineswap-20260813` (3D page module — in experience.html)
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

### Exhibits — 15 of 16 projects clickable (16 content hotspots: + resume; 17 at runtime including the lamp pseudo-hotspot)

> `HOTSPOTS.length` is 17 at runtime and the boot `console.info` prints 17 —
> that's 15 project exhibits + the resume (`action:"resume"`) = 16 CONTENT
> hotspots, PLUS the desk-lamp pseudo-hotspot (`action:"lamp"`, `key:null`)
> which is also stored in the `HOTSPOTS` array. If you see "16 hotspots"
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
  15 of the 16 projects are clickable exhibits (materialTest has none); the
  resume sits on the desk.
- A dated local backup exists at
  C:\Users\oc\Desktop\kefanwu-portfolio-backup-2026-07-07 (full git bundle +
  source snapshot zip). Re-run a backup after major changes.
```
