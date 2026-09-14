# Portfolio Website Project Documentation

## Current case-page delivery · 2026-09-13

Prepared against production `9608b5d`; revision `case-pages-20260913`.
The planned backup is `C:/Users/oc/Desktop/kefanwu-portfolio-backup-2026-09-13-case-pages`. Its
`release-metadata.json` and `deployment-verification.json` establish exact commit
and online status when publication completes.

All 16 project cards link to native case pages, with 16 editorial stories and 64
chapters. Each page retains the source gallery, image zoom, technical records and
cyclic next-project navigation. The homepage project modal is removed.

The first hero action and highlighted navigation lead to the 3D Studio. A large
workshop preview sits between the hero and project grid. Detail pages share the
existing reversible image animation, constrained to a 640-pixel-wide preview.
All 16 covers use progress 0 with matching camera/projection; 48 responsive files
are selected through `assets/editorial/animation-covers.json`.

Source project records, 93 gallery images, CAD and the existing 2,032 animation
frames remain unchanged. Quality, transport and physical interpretation limits
are documented in `EXPLODED_VIEWS.md`. Content checks passed; cover and browser
acceptance is recorded separately in `../.codex/case-pages-20260913/`.

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
- Project details inside native case pages with chapters, source records and image zoom.
- No marketing-style hero cards or decorative gradient blobs.

The intended feel is closer to a professional engineering product page than a personal blog.

## Site Structure

- `index.html` contains homepage navigation, studio entry, the linked project grid and leadership sections.
- `editorial.css` and `styles.css` provide the homepage layout, responsive styling, filters and motion states.
- `script.js` handles homepage interactions; source records remain in `project-data.js`.
- `case-study-data.js` contains the 16 editorial stories; `case-study.html`, `case-study.js` and `case-study.css` render the pages, chapters, downloads and gallery lightbox.
- `exploded.js` and `exploded.css` supply the shared reversible animation preview.
- `assets/editorial/animation-covers.json` selects matching initial-pose covers.
- `assets/` contains optimized image assets used by the deployable site.
- `README.md` contains local preview and deployment instructions.
- `AGENT_HANDOFF.md` contains implementation notes for future agents.

## Key Sections

### Hero

The hero communicates the current role, engineering focus, and broad portfolio signals. It should stay concise and should not become a full biography.

The top skill ticker should run full-viewport from left to right above the `Kefan Wu` title. The scroll cue is a slim vertical bar on the right side of the hero, not a centered mouse indicator.

### Selected Work

The selected work grid links to all 16 native case pages. Preserve homepage order
in case numbering and next-project navigation: Steering, Vine, Javelin, Scanner,
Brake Sim, AURA, Carbon Seat, Driver Seat, Material Testing, CFD, Pool Sniper,
LineFollower, Smelly, Telecaster, Education, and FTC.

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
- Preserve clear hover and focus states for primary actions, filters, case navigation, gallery controls, and project links.

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
- All 16 project cards open the correct native case page, including keyboard and modified-click navigation.
- Case-page chapters, source records, downloads and image-zoom galleries work.
- Initial covers match the animation's progress-zero pose, camera and projection.
- Detail previews stay within 640 CSS pixels and support forward/reverse wheel, touch and keyboard input.
- Filters work for each category.
- Mobile layout has no horizontal overflow.
- Case numbers and next links follow all 16 projects in homepage order.
- The hero action, highlighted navigation and workshop preview open the 3D Studio.
- Contact links are correct.

## Maintenance Notes

> Source facts and galleries live in **`project-data.js`**. Editorial structure
> lives in **`case-study-data.js`**. Native pages combine both without replacing
> the original records. The studio still has 15 project exhibits; Education
> routes to the general studio. See `AGENT_HANDOFF.md` for integration details.

Most content updates should happen in `project-data.js` inside the `projectData` object.

To add or revise a project:

1. Add optimized images to `assets/`.
2. Add or update the matching project card in `index.html`.
3. Update source facts in `project-data.js` only when the source record changes.
4. Update the matching `case-study-data.js` story, valid gallery indexes, numbering and cyclic next links; bump changed runtime cache strings.
5. Re-run the QA checklist.

To revise homepage positioning:

1. Update hero copy in `index.html`.
2. Keep stats broad and role-oriented.
3. Avoid replacing career signals with project-specific details.
4. Check desktop and mobile layouts after editing.

To revise a project cover:

1. Render animation progress 0 through `tools/exploded-render/render_initial_covers.py`.
2. Preserve the delivered frame's scene, camera and normalized projection.
3. Pack responsive variants and the runtime catalogue with `pack_initial_covers.py`.
4. Keep homepage and case-page fallback sources synchronized with the catalogue, then run `validate_initial_covers.py`. Original gallery images remain unchanged.
5. For full-bleed section backgrounds, use source photos without baked-in page text and control composition with CSS crop and scale.

## Current Portfolio Emphasis

The site currently emphasizes:

- Formula SAE mechanical systems and leadership.
- Steering, braking, cockpit, seat, and vehicle integration work.
- Robotics and scanning systems.
- CAD/CAM, FEA, MATLAB, testing, and fabrication.
- Hands-on manufacturing using CNC, waterjet, lathe, TIG, additive manufacturing, and laser cutting.
- Engineering communication through concise case studies.
