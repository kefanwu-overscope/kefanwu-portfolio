# Portfolio Website Project Documentation

## Project Overview

This project is a static rebuild of `www.kefanwu.com` for Kefan Wu, a Mechanical Engineering student at Olin College and current Mechanical Lead at Olin Electric Motorsports.

The site is designed as a recruiter-facing engineering portfolio. It presents technical projects, leadership growth, hands-on fabrication work, and systems-level mechanical engineering experience in a polished visual style inspired by Apple and SpaceX.

## Primary Goals

- Present Kefan as a serious mechanical engineering candidate for internships, co-ops, and early-career engineering roles.
- Put the strongest technical work near the top of the page, especially Formula SAE systems.
- Show progression from Cockpit Lead to Mechanical Lead at Olin Electric Motorsports.
- Emphasize practical engineering skills: CAD, FEA, MATLAB, fabrication, testing, integration, and technical leadership.
- Keep the site fully in English.
- Avoid non-career personal content and avoid deployable video content.

## Audience

The primary audience is technical recruiters, hiring managers, engineering leads, and interviewers who want to quickly understand:

- What systems Kefan has designed or built.
- What tools and methods he can use.
- Whether he has hands-on manufacturing experience.
- Whether he can lead other engineers and own cross-functional work.
- Which projects are worth discussing in an interview.

## Content Sources

The current version of the site was informed by:

- Existing content from `www.kefanwu.com`.
- Kefan Wu's LinkedIn profile.
- Local project assets in the `WEBSITE` workspace.
- Google Drive project and resume documents, including Formula SAE, 3D scanner, Formlabs hackathon, and Project AURA material.

## Positioning

The site positions Kefan around three strengths:

1. Vehicle systems engineering through Olin Electric Motorsports.
2. Prototyping and motion hardware through robotics, product, and hackathon projects.
3. Data-backed engineering through simulation, testing, modeling, and analysis projects.

The homepage metrics are intentionally broad portfolio signals:

- Number of engineering projects shown.
- Number of technical skills represented across the portfolio.
- Team leadership experience, currently framed as leading a team of more than 30 engineers.
- Current Mechanical Lead role at Olin Electric Motorsports.

Project-specific numbers are kept inside the relevant case studies instead of being used as headline resume metrics.

## Design Direction

The visual direction is dark, high-contrast, quiet, and precise:

- Large editorial hero area with real engineering imagery.
- Minimal copy with strong technical nouns.
- Compact recruiter-friendly project cards.
- Thin borders, restrained surfaces, and small-radius UI.
- Liquid Glass-inspired controls and cards: translucent functional layers, soft edge highlights, backdrop blur, and hover or focus sheen animation.
- Project details inside focused modal case studies.
- No marketing-style hero cards or decorative gradient blobs.

The intended feel is closer to a professional engineering product page than a personal blog.

## Site Structure

- `index.html` contains the page structure, navigation, project grid, leadership sections, and modal shell.
- `styles.css` contains the full visual system, responsive layout, modal styling, filters, and motion states.
- `script.js` contains project data, modal rendering, gallery behavior, filtering, navigation interactions, counters, and canvas background.
- `assets/` contains optimized image assets used by the deployable site.
- `README.md` contains local preview and deployment instructions.
- `AGENT_HANDOFF.md` contains implementation notes for future agents.

## Key Sections

### Hero

The hero communicates the current role, engineering focus, and broad portfolio signals. It should stay concise and should not become a full biography.

The top skill ticker should run full-viewport from left to right above the `Kefan Wu` title. The scroll cue is a slim vertical bar on the right side of the hero, not a centered mouse indicator.

### Selected Work

The selected work grid is the primary hiring surface. The first four cards should remain Formula SAE-focused:

- Mk.8 steering system.
- Driver seat and harness.
- Carbon fiber seat support.
- Brake temperature simulation.

### Flagship Program

This section explains Olin Electric Motorsports as the main leadership and systems-engineering context.

### Capabilities

This section maps projects to reusable engineering skills: CAD, simulation, fabrication, testing, controls, and technical communication.

### About

The about section should remain career-focused. It should reinforce engineering identity, current role, Olin College context, and technical growth.

### Contact

The contact section should keep actions simple: email, LinkedIn, and resume or portfolio links.

## Content Rules

- Keep all public-facing site copy in English.
- Prioritize engineering evidence over personality copy.
- Do not add non-career personal sections.
- Do not add deployable video assets or video UI.
- Keep detailed project metrics inside project case studies.
- Keep homepage stats broad and recruiter-readable.
- Keep Formula SAE leadership current as `Mechanical Lead`.
- Preserve the promotion narrative from `Cockpit Lead` to `Mechanical Lead`.
- Frame fabrication-heavy projects as engineering work, not personal-interest content.
- Keep project-card covers simple, image-first, and technically legible.
- Preserve Liquid Glass hover or focus animation for primary buttons, filters, modal controls, gallery controls, and project cards.

## Local Preview

Run the static server from the project folder:

```powershell
cd C:\Users\oc\Desktop\WEBSITE\portfolio-site
python -m http.server 4173
```

If Python is not on PATH, use the bundled runtime:

```powershell
& 'C:\Users\oc\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m http.server 4173
```

Then open:

```text
http://localhost:4173
```

## Deployment

This is a static site. Deploy the contents of `portfolio-site` to a static host such as:

- Vercel
- Netlify
- Cloudflare Pages
- GitHub Pages
- Squarespace custom code or static file hosting, if supported by the chosen plan

After deployment, point `kefanwu.com` to the deployed site according to the hosting provider's DNS instructions.

## QA Checklist

Before deployment, verify:

- The local server returns HTTP 200.
- `script.js` passes syntax check.
- All referenced `assets/...` files exist.
- There are no deployable movie files in `assets/`.
- The homepage text is English.
- Project cards open the correct modal.
- Modal image galleries work.
- Filters work for each category.
- Mobile layout has no horizontal overflow.
- The first four project cards remain the Formula SAE split.
- Contact links are correct.

## Maintenance Notes

> Note: case-study content now lives in **`project-data.js`** (the shared
> `projectData` object), NOT in `script.js`. It is loaded by both `index.html`
> (before `script.js`) and `experience.html` (before `experience.js`). The site
> also has a second surface — the interactive 3D studio at `experience.html`,
> where all 14 projects are clickable exhibits. See `AGENT_HANDOFF.md` for the
> full current reference (file map, IDs, cache versions, 3D internals).

Most content updates should happen in `project-data.js` inside the `projectData` object.

To add or revise a project:

1. Add optimized images to `assets/`.
2. Add or update the matching project card in `index.html`.
3. Add or update the case-study data in `project-data.js` (bump its cache string).
4. Re-run the QA checklist.

To revise homepage positioning:

1. Update hero copy in `index.html`.
2. Keep stats broad and role-oriented.
3. Avoid replacing career signals with project-specific details.
4. Check desktop and mobile layouts after editing.

To revise a project cover:

1. Use a real project image or a cleaned crop derived from a real project image.
2. Keep the cover horizontal, uncluttered, and readable at card size.
3. Prefer a dedicated `assets/cover-*.webp` file when the source image needs a simpler crop.
4. Update both the project card in `index.html` and the matching `image` field in `script.js`.
5. For full-bleed section backgrounds, use source photos without baked-in page text and control composition with CSS crop and scale.

## Current Portfolio Emphasis

The site currently emphasizes:

- Formula SAE mechanical systems and leadership.
- Steering, braking, cockpit, seat, and vehicle integration work.
- Robotics and scanning systems.
- CAD/CAM, FEA, MATLAB, testing, and fabrication.
- Hands-on manufacturing using CNC, waterjet, lathe, TIG, additive manufacturing, and laser cutting.
- Engineering communication through concise case studies.
