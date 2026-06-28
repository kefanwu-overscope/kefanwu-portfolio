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

- `index.html` - page structure, hero, ticker text, project cards, section order, contact links, modal shell.
- `styles.css` - visual system, responsive layout, ticker styling, liquid glass cards, section fades, project cards, modal, mobile typography.
- `script.js` - project case-study data, modal content, galleries, filters, counters, reveal animation, hero skill hover cards.
- `assets/` - local images, project covers, gallery media, and downloadable package.
- `README.md` - short local preview and deploy notes.
- `PROJECT_DOCUMENTATION.md` - older project brief; useful background but verify against current files.
- `AGENT_HANDOFF.md` - this current handoff.

## Current Site Structure

1. Header/nav: Projects, Motorsport, About, Capabilities, Contact.
2. Hero:
   - Background: `assets/hero-fsae-track.webp`.
   - Eyebrow: `Mechanical Lead / Olin Electric Motorsports / MechE @ Olin College '28`.
   - Skill ticker:
     `Arduino`, `TIG Welding`, `AutoCAD`, `Topology Study`, `SolidWorks`, `MATLAB`, `FEA`, `CFD`, `CNC Mill`, `Lathe`, `Waterjet`, `Carbon Fiber`, `Team Management`, `Vibe Coding`.
   - Hero copy:
     `Mechanical engineering student at Olin College, leading mechanical systems for Olin Electric Motorsports and building tested hardware across motorsport, robotics, and fabrication.`
   - CTA buttons: `View projects`, `FSAE program`.
   - Stats: `14 Engineering projects`, `19+ Technical skills`, `>30 Engineers led`, `Mechanical Lead / Olin Electric Motorsports`.
3. Projects section:
   - Kicker only: `Projects`.
   - Filter chips: All, Motorsport, Robotics, Product, Analysis, Fabrication.
   - Card order:
     `Mk.8 steering system`, `Agent-based CFD`, `Carbon fiber seat`, `Brake temperature simulation`, `Line-following robot scanner`, `Formlabs scent dispenser`, `AURA autonomous luggage robot`, `Line follower robot`, `Automated transmission gearbox`, `Pool Sniper`, `Driver seat and harness`, `Engineering education kit`, `Wankel engine housing`, `Telecaster build`, `FTC robot`, `Noise reduction algorithm`.
4. Olin Electric Motorsports set-piece:
   - Background: `assets/oem-mk7-track.jpg`.
   - Title: `Olin Electric Motorsports`.
   - Subtitle: `Formula SAE Electric. Mk.7 validated on track - Mk.8 in development.`
   - Link: `Visit OEM site ↗` to `https://olinelectricmotorsports.com/`.
5. Mechanical Lead detail section:
   - Role panel and three media panels.
6. Capabilities:
   - Heading: `Contribution`.
   - Five cards in one row on desktop:
     `Team management`, `Mechanical architecture`, `Fabrication`, `Simulation and modeling`, `Controls and integration`.
7. Contact:
   - Heading: `Let's build cool stuff.`
   - Links: `kwu@olin.edu`, `kefanwu8888@gmail.com`, LinkedIn.

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
- Projects card order: Mk.8 steering system; Agent-based CFD; Carbon fiber seat; Brake temperature simulation; Line-following robot scanner; Formlabs scent dispenser; AURA autonomous luggage robot; Line follower robot; Automated transmission gearbox; Pool Sniper; Driver seat and harness; Engineering education kit; Wankel engine housing; Telecaster build; FTC robot; Noise reduction algorithm.
- Olin Electric Motorsports section uses assets/oem-mk7-track.jpg and links to https://olinelectricmotorsports.com/.
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
```
