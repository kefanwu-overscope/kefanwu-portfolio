# Homepage presentation

## Drafting hero: the car drafted while the photo emerges · 2026-11-22

The owner said on 2026-11-20 (voice) that the one-pen hero drawing (0e561624) is too long and
too simple, that about 2.5 s is good, and that it should feel like someone hand-drafting an
engineering drawing with the photo slowly emerging behind it; on 2026-11-21, to use the denser
set with every line on a real edge of the photo, and then "still denser" (from mechanical detail
and from body decals and marks); on 2026-11-22, that the denser motion at three sizes is fine;
and, after whole-page films at 1440, 768 and 390 px, that the new hero can go live. Commit: this
entry's own commit (parent 5b20926f). These rules supersede the drawing described in the
2026-11-10 "Hero pen" section below (one pen, 87 / 44 / 36 strokes, GUIDE / SHADE / INK, its
order and timing with last ink about 4.2 / 3.0 / 2.9 s, the develop after the last ink, the
165-175 ms settle figures measured on that engine, the settled-hero comparison with 85467bca) and
the words "the hero pen (2026-11-10, unchanged)" in the 2026-11-21 section. The rest of that
section still holds: the card gate (`HERO_CEIL` 7.5 s, `HERO_FINAL` 12.5 s), the 12 s CSS
backstops, the late-engine rule, `?v=pen-20261110` on `white-home-20261011.css`, the
`.gitattributes` `-text` rule and the `out/build/` ignore. The 2026-11-21 monograph rules, the R1
refresh rules and the 2026-11-09 card rules stay. The owner approved
publishing the hero as the films showed it; every individual choice here is an agent decision
they can change (details and the list of decisions: `AGENT_HANDOFF.md`, 2026-11-22). Films:
`../releases/hero-drafting-20261120/prod/integrate2/owner/`.

- `index.html` changes only inside its inline hero-pen block (the data block and the minified
  engine); the rest of the page, the photo, masks, feather, halo and hero text are as at
  5b20926f (hero text 0 px from 5b20926f at six widths). No `?v=` change, no new asset.
- Classes by page width: D >= 1280 px, T 768-1279, P < 768. Strokes D 195 (145 car, 54 of them
  detail; 50 drafting conventions), T 125 (83, 36; 42), P 116 (79, 35; 37).
- Three pens and three detail lanes on one clock: pen A inks the car, pen B lays out and
  dimensions it (pencil construction, wheel squares and compasses, chain centre lines, datum,
  dimension and extension lines with arrowheads, ground ticks) and inks the wheels it laid in
  (rims, tread edges, ribs), pen C letters (the pencil lettering at D, the "219"s) and draws the
  cockpit and lamp block; lanes X, Y and Z draw mechanical detail and decals and marks. One stroke at a time per lane, so up to 6 at once (at most 3 on pens A-C).
  Canvases PENCIL / DRAFT / INK, bottom to top.
- Every car line lies on a real edge of the published hero photo (tyres traced, rims fitted),
  with these recorded exceptions: the drafting marks are conventions in provenance (construction
  lines, wheel compass arcs and squares, ground ticks, datum, dimensions, arrowheads, chain
  lines); the rear tyre's top follows a tread-against-asphalt texture boundary with no luminance
  edge (a main-loop ruling); the side "219" follows the printed numerals' centrelines; a straight
  line may bridge up to about 10 src px of dark gap that shows no edge. The photo's pixels are
  never changed. Not drawn: tyre lettering, shading hatches on the car (the ground line carries
  short drafting ticks), the people's names on the body.
- Timing (pen ms from the first stroke): car complete D 1263 (pens A-C 1208), T 1416, P 1486;
  last ink D 1518, T 1611, P 1655. The photo develops from 300 ms (once decoded) to 2500 ms;
  each canvas leaves on its own window of the develop; at 2517 ms the canvases, veil and data
  block are removed and `<html>` is class `js`. Photo density at the last ink about 0.16 / 0.31 /
  0.34 (D / T / P).
- Lettering "Olin College of Engineering" in pencil only at D; T and P letter nothing. Every class
  draws the side "219"; only D draws the nose-top "219". The fit rule dropped 10 detail lines at T and 19 at P
  from each class's own set; their nose top keeps one logo (the SAE mark).
- Start: the first frame after first contentful paint and load + 140 ms (unchanged). Under half
  the car on screen at that moment: 300 ms quick reveal, no lines.
- Ends early in 160 ms, with no more ink: pointer down, touch, wheel, key (at any point, also after
  the last ink), a class change on resize or rotation, a lost canvas context; in 300 ms when the
  ink canvas is scrolled under half on screen while ink is still to come. A wall limit (last ink +
  1 s) and the 11 s ceiling end a stalled run. Scroll by itself does not end it. Measured 169-181 ms
  from the input to done (headless Chrome, one Windows machine).
- Does not play: Back/Forward and bfcache restores, `#` link arrivals other than `#top` (a reload
  drops the fragment and plays), reduced motion, forced colors, `?draw=off`, `?hero=photo`. A
  hidden or prerendered tab draws when first shown. A late engine (past 2.4 s on the veil's
  failsafe clock) leaves the reveal to the CSS failsafe (2.8-3.3 s) and draws nothing.
- Photo slow or failing: the develop waits for the decode (a late decode develops over max(900,
  2200 - lateness) ms; a failed request counts as decoded). `DECODE_CAP` 4500 ms: still not
  decoded, it develops anyway and hands the reveal back to the CSS (measured done about 5.4 s after
  t0). A photo that never decodes also means no window `load`, so the card drawings never start
  (as before).
- The settled hero equals 5b20926f's within 2 colour levels (0 pixels over 2 levels at 1440, 768
  and 390).
- Cards: unchanged; their gate opens at the last ink (now about 1.5-1.7 s after t0) or when the
  hero photo box is under half on screen.
- Known, kept: at T and P the last dimension lines, arrows and ground ticks draw onto an already
  readable photo for about the last 0.2 s; several pens visibly work at once at D; a few marks
  appear alone early (wheel-centre squares, the datum's start, the SAE logo on the bare nose top at
  T and P).
- Rebuild: `node tools/hero-pen/engine/build.cjs --page <dir> --base <a committed index.html>`;
  `--check index.html` exits 0 when the block is a fresh build. The old one-pen build needs `--r3`
  and can no longer reproduce 0e561624's page byte for byte (it inlines the drafting engine).
- Not verified on real phones, tablets or touch screens, Safari, Firefox, screen readers, slow or
  throttled networks, CPU throttling, real-time window drags, rotation or devicePixelRatio changes
  while drawing (headless Chrome on one Windows machine, device emulation).

## Site refresh batch 1: the homepage as a monograph · 2026-11-21

The owner asked on 2026-11-20: "继续优化我的网站，你可以大改美工，项目的描述可以适当加入细节，你可以到我的google drive找到大多数项目文件"
(keep improving the site; the visual design may change a lot; project descriptions may gain
detail from his Google Drive). Commit 5b20926f. These rules supersede, in the sections below:
the hero bottom row (`.hero-baseline` with the role line, "FROM THE WORKSHOP TO THE TRACK." and
the "Explore the work" cue), the CTA order (studio button filled, projects as a 14px text link),
the filled studio button in the nav, the mono uppercase kickers ("01 / SELECTED WORK"), the
section and cover notes, the separate "Showing n of 16" line, the card meta line above the
title, the circled CFD download icon, the leadership track photo, the studio "EXPLORE IN 3D"
chip, `data-reveal` on leadership, method and contact, `PENCIL` 0.3 (2026-11-09) and the
`?v=pen-20261110` / `?v=dtb-20261027` labels on `card-drawing-20261027.js` / `script.js`. The
photo, masks, feather, the hero pen (2026-11-10, unchanged), the wordmark, the skills strip box,
the card media boxes and every card drawing rule other than `PENCIL` stay. The owner has not
seen this; every choice is an agent decision he can change (details and the list of decisions:
`AGENT_HANDOFF.md`, 2026-11-21). The agent-written plan (B1 acceptance 2) asked for an owner
look at the halo stills before the push; the main loop pushed under the owner's standing push
authorization after the design verifier judged the end state by the owner's stated criteria (soft
natural gradient, no erased or masked look, car and driver clear, some real track kept, suspension
not cropped). He has not seen the stills yet; this is an agent decision he can change. Stills:
`../releases/site-refresh-20261120/impl/r2/verify-design-r1/halo/`.

- Sheets: `site-tokens-20261120.css` (colour and type tokens; Inter text, Inter Tight 600
  display, IBM Plex Mono only for case and section numbers and evidence tags) and
  `home-20261120.css`, after `white-home-20261011.css`; both `?v=refresh-20261120`.
- Running head: opaque white, 1px #d9dde1 hairline, 72px (60px at 720 and below), no blur.
  "KW" plus "Kefan Wu"; Projects, Approach, Contact, Resume ↗, then "3D Studio ↗" as a text link
  after a hairline divider. The current section has a 1px ink underline; no link is current
  over the hero, Leadership or the studio teaser.
- First screen: eyebrow "Mechanical engineering / Olin ’28" (Inter 500 15px); the name; directly
  under it "Leading 30 mechanical engineers" (600 24/32) and "Mechanical Lead · Olin Electric
  Motorsports" (500 16/24); then the tagline (19/28). Actions: "See the 16 projects ↓" filled,
  "Enter the 3D Studio ↗" 48px outline, "Resume (PDF) ↗" text link (its own row from 721px; on
  the buttons' row on tall tablets). No bottom row and no second scroll cue.
- Everything after the name sits in `.hero-lede`, whose height per layout band equals
  0e561624's tagline and CTA rows, so the name does not move. The imprint takes four lines at
  721-1100px, at 1101-1279px of 4:3 or taller and at aspect 27/20 or less from 1280px; tall tablets end the first screen 60px
  under the CTAs. The white halo now spans imprint and tagline and keeps off the car's nose
  (`hero-halo-20261024.cjs` passes 496/496 sizes); in forced colours from 721px the copy paints
  above the name with no halo.
- Skills strip: same box and motion; Inter 500 14px, sentence case.
- Openers: "01 Projects" (aside: the live "Showing n of 16 projects"), "02 Leadership" (aside
  "30 engineers. One race car."), unnumbered "3D Studio" (aside "The interactive portfolio"),
  "03 How I work", "04 Let’s build something". Titles at 72/72 (44/44 on phones). No note between
  a heading and its content.
- Filters: text tabs with counts (All 16, Motorsport 4, Robotics 8, Product 9, Analysis 6,
  Fabrication 12; written in the HTML, pinned to the tags by `home-catalogue.test.mjs`), 1px ink
  underline on the active tab, search on a 1px rule; phones scroll the tabs with a right-edge
  fade. The FLIP stays; a leaving card keeps its rows while it fades, also mid-glide.
- Cards: 3 / 2 / 1 columns, media boxes unchanged. Hairline, hanging case number 01-16, title
  (Inter Tight 600 24/32), two-line meta (context, role), result; rows aligned by subgrid. Only
  real results are inked: 0.9 kg, 23%, 19%, 2,206-point, 300 lb, 33.6%. Javelin has an
  "In progress" tag; ansysCfd's download is the text link "Workflow (.zip)" in its meta.
  LineFollower is "Olin PIE · Two-person team". Nothing beside a title.
- Card waiting state: `PENCIL` 0.45 (was 0.3). Everything else from 2026-11-09 stays.
- Leadership: `assets/fsae-mk7-shop.webp` (Mk.7 in the paddock, native size) beside
  "Engineer the system. Enable the team.", the paragraph, the figures 30 and 4 ("Mechanical
  engineers", "Subteams"), the role path 2024 Engineer, 2025 Cockpit Lead, 2026 Mechanical Lead,
  and the Olin Electric Motorsports link.
- Studio teaser: the image and one outline "Enter the 3D Studio ↗".
- How I work: the three photos over the three method columns (4:3), captions 15px with mono
  evidence tags; "Own the whole loop." at 72/72.
- Contact: "What’s next starts here.", the existing Summer 2027 sentence, then hairline rows for
  Email, Resume (filled button), LinkedIn and 3D Studio. Footer: one row, "© 2026 Kefan Wu ·
  Olin College of Engineering · Needham, MA" and "Back to top ↑".
- 404: the same running head, "404 · Page not found", "This page took a wrong turn.", and three
  numbered exits (Projects, Resume (PDF), Contact); status 404.
- Known, kept: in ordinary laptop windows such as 1366x657 and 1536x695 the Resume (PDF) link is
  below the fold, and at about 1366x625 both hero buttons are cut by the fold (0e561624 showed all
  three actions there); on phones the photo sits between the name and the imprint (160-187px apart); some link arrows wrap
  alone onto their own line.
- Agent decisions to note: the CTA swap (projects button filled, studio outline) goes against the
  plan's default for owner question 1. The leadership photo `assets/fsae-mk7-shop.webp` is one
  354,772 B file with no srcset, up to about 290 KB more than 0e561624 on phones (lazy-loaded);
  to be fixed in the next batch.
- Not verified on real phones, Safari, Firefox, screen readers or throttled networks (headless
  Chrome on one Windows machine).

## Hero pen: the car drawn by one hand · 2026-11-10

The drawing described here (one pen, its strokes, order, timing and develop) was superseded on
2026-11-22 by the drafting hero (the section at the top). Its card gate, CSS backstops, late-engine
rule, cache label and git rules still hold.

The owner asked on 2026-11-06: "保留，确保每次刷新网站线稿动画也能加载，线稿要有出现的顺序，要像是有人画出来的一样，
封面在车的线稿可以更细节" (lines should appear in an order, as if a person draws them, and the
hero car's line drawing can be more detailed). Commit 0e561624. These rules supersede the hero
drawing items in the 2026-11-06 section below (the inline SVG, ink by 1.2 s, the develop at
1.05-2.05 s, the per-line retire, about 2.2 s in all, the 9.5 s CSS backstops) and the cards'
`HERO_CEIL` 3200 / `HERO_FINAL` 10000. The R1 refresh rules and the 2026-11-09 card rules stay.
The owner has not seen this; every choice here (duration, order, what is drawn, lettering only
at 1280 px and up, the kept defaults, the polish, the card gate, the fix-r2 rhythm and phone
rear tyre) is an agent decision he can change. Details: `AGENT_HANDOFF.md`, 2026-11-10. Films for review:
`../releases/hero-pen-20261110/films/` (before and after, 1440 and 390; the after films show
the final tree).

- One pen draws the car in `index.html` (inline data block plus inline engine, three canvases
  GUIDE / SHADE / INK in `.hero-draw-lines`; `hero-drawing-20261027.js` is no longer loaded).
  Every stroke starts after the previous one ends; same strokes and timing on every load.
- Every line lies on a real edge of the hero photo (`tools/hero-pen/out/strokes.json`, with
  provenance): traced, or recorded as a fit (the rims) or a convention (the three faint lay-in
  marks). The photo's pixels are never changed. Not drawn: hoop stalk, sponsor marks,
  Hoosier lettering, people's names, hatching, nose shadow, ground shadow under the nose,
  wheel crosshairs.
- Classes by page width: D >= 1280 px (87 strokes), T 768-1279 (44), P < 768 (36). Lettering
  "Olin College of Engineering" only at D. The rear-bay tubes are drawn at D and T; P draws
  only `rear-tube-level`, which ties the phone's rear tyre to a real frame tube.
- Order, from the first ink: 3 faint construction marks (0-316 ms; the long hop from the rear
  rim to the nose lifts 86 ms); 9 silhouette strokes at hand speed (346-1585 ms: nose, nose
  underside, rail, hoop arch, hoop column, brace, rear tyre, front tyre, helmet); form and detail
  (stripes, plates, rims, hoop structure, driver); then the side "219", and at D the lettering
  word by word and the nose-top "219" last. Pauses between these phases: 30, 78 and 50 ms.
- Timing: last ink / photo starts developing / photo in, ms from the first ink: D 4197 / 4297 /
  5297, T 2978 / 3078 / 4078, P 2919 / 3019 / 4019. The develop runs 1000 ms (the old develop
  model); the lines leave by layer. Then all drawing nodes go and `<html>` is class `js`. A
  window resize keeps the lines' fading opacity, and a device-pixel-ratio change lays the
  canvases out again at the new resolution.
- The pen starts on the first frame after first contentful paint and load + 140 ms, at most
  FCP + 300 ms. Under half the car on screen at that moment: quick photo reveal, no lines.
- Settles in about 165-175 ms (measured 163.9-174.5 ms) with no more ink: pointer down, touch,
  wheel, key (including a scrollbar press and scrolling keys), a class change on resize or
  rotation, the drawing under 50 % on screen, a lost canvas context. Scroll by itself does not settle it. A wall limit
  (last ink + 1 s) and an 11 s ceiling end a stalled run.
- Does not play: Back/Forward and bfcache restores, `#` link arrivals other than `#top`
  (a reload drops the fragment and plays), reduced motion, forced colors, `?draw=off`,
  `?hero=photo`. A hidden or prerendered tab draws when first shown. If the engine starts more
  than 2.4 s into the veil's failsafe clock (a slow load, for example Slow 3G), the CSS failsafe
  reveals the photo at 2.8-3.3 s and nothing is drawn. CSS backstops: veil and lines hidden at
  12 s if the engine dies mid-run (the veil's 12 s from its first style, the lines' 12 s from
  when they are shown; the engine's own 11 s ceiling starts at `begin()`).
- The settled hero equals 85467bca's within 2 colour levels (0 at 1440 and 1280; 1 level on
  5 device px at 768; 2 levels on 7 device px at 390).
- Cards wait for the hero until the earliest of: the last ink (`html.hero-draw-inked`), the hero
  ending, the hero photo box less than half on screen, or 12.5 s (`HERO_FINAL`). A card on
  screen may therefore draw while the photo develops. From 7.5 s (`HERO_CEIL`) a waiting card
  on screen shows its cover until the gate opens.
- Cache label `?v=pen-20261110` on `white-home-20261011.css` and `card-drawing-20261027.js`.
- `.gitattributes` keeps `tools/hero-pen/**` byte for byte (`-text`), because provenance records
  the files' exact bytes; `.gitignore` ignores `/tools/hero-pen/out/build/`.
- Not verified on real phones, Safari, Firefox, real slow networks, screen readers or a real
  move between monitors with different scaling (headless Chrome on one Windows machine, CDP
  throttling and emulation).

## Card drawings survive a fast scroll · 2026-11-09

The owner wrote on 2026-11-09: "现在还有一个问题就是，呃，如果我在手机或者电脑上下滑的太快，我的项目的线稿就不会显示出来，请修复一下。"
(scrolling down too fast on a phone or computer loses the project line drawings). These rules
supersede the card items in the 2026-11-06 and 2026-11-07 sections below (fast scroll settles a
card, loading only within about one screen, a card seen or near before decoding keeps its cover,
any press or key settles every card). The pencil state, the calm rule, the rewind and every
number here are agent decisions (main loop design, implementer and fixer), not the owner's; the
owner can change them. Details: `AGENT_HANDOFF.md`, 2026-11-09.

- A card that has not drawn yet waits in pencil: page-white paper over its cover with its own
  line drawing at 30 %. A waiting card is never a blank white box and never its cover.
- A waiting card draws (the same ink, develop and retire sequence, about 1.15 s) once at least
  25 % of it is on screen and the scroll is calm: no scroll event for 150 ms, or slower than one
  window height per second, clamped to 700-1000 px/s. Readable cards draw in grid order, 70 ms
  apart. Reading pace (measured at or below about 580 px/s) draws as before.
- Scroll speed never settles a card. A card that leaves the screen mid-draw goes back to pencil
  and draws again from the start when it is next readable and calm. A finished card stays
  finished for the page view. This holds for wheel, trackpad, keys, scrollbar drag, the `#work`
  smooth scroll and phone flings.
- What settles a card to its cover (about 160 ms): a mouse or pen press on that card, a real
  pointer move over it (hover), focus or a key inside it, a touch on its control that ends as a
  tap or a sideways slider drag (a touch the browser turns into a scroll does not count), the
  filter or search, a cover that fails to load, or a 6 s failsafe for a readable card that
  never gets a calm moment. Reduced motion, forced colors, data saver and a `back_forward` load
  show no drawing at all, and a line image that fails to load keeps that card's cover. A press
  or key elsewhere on the page does not.
- A card under 25 % on screen at rest stays in faint pencil. Cards on screen when the script
  starts keep their covers, and a card whose loaded cover was already seen keeps it until it has
  been off screen.
- All 15 line drawings load on every visit, nearest first, at most 4 at once, after the hero
  photos and the near covers. ansysCfd still has no drawing.
- Detail pages follow the same rule: the arrival waits in pencil until the stage is at least
  15 % on screen and the scroll is calm, rewinds to pencil if it leaves mid-draw, and is still
  rushed (about 200 ms) when the pinned story needs the stage.
- Unchanged from R1: every load and refresh plays, Back/Forward does not, the cards wait for
  the hero, no layout shift (CLS 0), text and cover elements untouched, hover frame-scrubbing
  after a card settles or draws.
- Not verified on real phones, real trackpads or mouse wheels, Safari, Firefox or real slow
  networks (headless Chrome on one Windows machine, CDP-synthesized input and throttling).
- A final independent review and regression sweep on the final tree passed
  (`../releases/cards-fast-scroll-20261109/verify-final-review/`, `verify-final-sweep/`): no
  correctness defect in the diff against 9af034df; hero-tests 33/33 and room-tests 243/243 with
  0 skipped; 60 loads with 0 errors, 0 failed requests and 0 overflow; homepage 15/15 cards drawn
  at all 6 widths with 0 blank frames; detail arrivals 48/48 settled.

## Every refresh plays · 2026-11-07

The owner asked on 2026-11-06: "我指的是每次刷新网站线稿动画都能重新加载" (every refresh must
replay the line drawing). These rules supersede the "once per tab session" and "repeat
visits in the tab" items in the 2026-11-06 section below; the drawings' look and timing are
unchanged. The scroll and Back/Forward rules, the saveData-only card gate and the reload
handling of `#` links are agent decisions (spec `../releases/hand-drawn-20261106/design/PEN_SPEC.md`
and the R1 fixers), not the owner's; the owner can change them. Details: `AGENT_HANDOFF.md`,
2026-11-07.

- Every load and every refresh plays the hero drawing and the card drawings. No
  sessionStorage key gates them any more (`kw-hero-drawn` and `kw-cards-drawn` are gone).
- A refresh lands at the top (`script#kw-scroll` sets `history.scrollRestoration='manual'`).
  A refresh of a `#` URL other than `#top` drops the fragment from the address bar
  (`replaceState`, query and history state kept) and lands at the top with the hero.
- Back/Forward does not replay: no hero and no card drawing on a `back_forward` load, and
  a bfcache restore keeps the settled hero and drawn cards, though cards not yet reached still
  draw once when first scrolled into view (as at HEAD 27af3682).
  Back restores the place the visitor left,
  including same-page Back/Forward after a `#` link click. Without the Navigation API (older
  Safari and Firefox) the page does this with URL keys, `click` and `popstate`; the manual mode
  stays, so a refresh still lands at the top (fix-r3, an agent decision).
- Arriving by a link on `/#contact`, `/#work` or `/#project-<key>` still lands on the target
  with no hero. An arrival held by a view transition (`__vtBoot.hold`: the wordmark or a home
  link from a detail page) lands at the top and plays the hero (fix-r3, an agent decision).
- A hidden or prerendered tab keeps the photo and starts the drawing on its first visible
  moment (`data-hero-pen=wait`, then `late`); the 4 s timer and CSS failsafes count from there.
- Scroll no longer ends the hero. Pointer, touch, wheel or key still settle it in about 160 ms.
- Cards: data saver is the only network gate (no `effectiveType` 3g test). Reduced motion and
  forced colors keep the covers. While the hero waits for a visible tab, the cards wait too.
- Not verified on real phones, Safari, Firefox or real slow networks (headless Chrome 156 on
  one Windows machine, emulated networks).

## Drawn, then built · 2026-11-06

Built under the owner's 2026-10-27 approval of the design ("I trust ur design, improve
both the main website and 3d website"); these rules supersede the matching items below.
The 50% morph threshold and the slow-connection line below are the release agent's
judgement under that approval; the owner has not reviewed them and can change them.

- Hero opening (`hero-drawing-20261027.js`, inline guard and SVG in `index.html`,
  rules in `white-home-20261011.css`): on the first visit per tab session the car
  is drawn by 1.2 s (28 traced strokes plus 2 wheel-centre marks, registered to the
  photo's live object-fit and object-position; the TSAL lamp outline only from
  768px). The photo develops through a page-white veil over 1.05–2.05 s. By about
  2.2 s every added node and class is gone, so the settled hero is the 10-26 hero.
  The clock starts just after first contentful paint is reported (held at most
  1.5 s). Trace only edges really visible in the photo; do not add hardware.
- Hero exits: pointer, wheel, scroll or key settles it in about 160 ms. No drawing
  under reduced motion, forced colors, a hidden tab, a `#` deep link, repeat visits
  in the tab or no CSS masks. Under 50% of the car on screen (phone landscape) the
  photo gets a 300ms reveal with no lines. CSS failsafes: veil gone by 3.3 s if the
  script never starts; lines and veil hidden at 9.5 s if it dies mid-sequence.
- Hero photo: its pixels, opacity, filter and fetch priority never change, and it
  stays the LCP. The drawing's veil is a separate element above it. The slow-load
  veil below stays off while the drawing owns the reveal (`html.hero-draw-own`) and
  takes the reveal back only if the photo has not decoded by the end of the decode
  hold or by a settle. Visits without the drawing use it as before.
- Project cards (`card-drawing-20261027.js`, loaded after window load): the first
  time a card arrives, its cover is a registered line drawing from
  `assets/editorial/lines-20261027/`. Lines wipe in over 0–600ms, the cover develops
  through white over 450–1050ms, lines retire over 600–1150ms, and all overlays are
  then removed. Once per card per tab session; cards entering together start 70ms
  apart. ansysCfd has no drawing and keeps its cover.
- Cards are never blanked for choreography: a card already on screen when the script
  starts keeps its cover, and so does a card that comes close before its drawing has
  decoded. Line images load only after both hero photo layers and every cover within
  about one screen (1000px at most) have finished. Data saver and connections reporting
  3g or slower keep today's cards, as do reduced motion and forced colors. No card draws
  alongside a slow hero. Hover, focus, click, key or a fast scroll settles a card in
  about 160ms; reading-pace scrolling does not.
- Filters still apply on click, now with FLIP motion (`script.js`): staying cards glide
  320ms, leaving cards fade 160ms, entering cards fade in, and a jump over .8 screens
  fades in place. Using a filter or search ends the card drawings for that page.
- Leaving through a card: the page crossfades (old out 0–160ms, new in 80–240ms). The
  cover morphs into the detail stage (400ms) only when at least 50% of the stage lands
  on screen in a landscape window, so at common desktop sizes the forward path is a
  crossfade. Back restores the scroll position and morphs the stage into its card.
  Hard cut on a connection reporting 3g or slower, or a downlink under .7 Mbps.
- Per-URL QA switches, for viewing one page without the motion: `?draw=off`,
  `?hero=photo`, `?cards=static` (also turns off filter FLIP), `?vt=off`, `?prefetch=off`.
  `?hero=draw` and `?cards=draw` replay, for review. They apply only to the URL that
  carries them: no link on the page keeps them, and a visitor without them gets the full
  release. They are not a rollback; the live-site rollback is in `AGENT_HANDOFF.md`,
  2026-11-06. `?draw=off` does not mark the hero as drawn, so going from such a URL to
  plain `index.html` plays the full drawing; that is expected.
- End state: homepage vs HEAD e42a05b4 differs by at most 2 levels at 8 sizes, the same
  ceiling as HEAD vs HEAD (single machine, headless Chrome, DPR 1). Real phones, Safari
  and Firefox are not verified. Details and limits: `AGENT_HANDOFF.md`, 2026-11-06.

## Aesthetic batch 1 · 2026-10-26

Owner-approved; these rules supersede the matching items below.

- Hero copy: `.hero-copy` is `width: fit-content` (max 38ch; 24ch at
  721–1279px; 22ch at 721–767px; 16px type at 721–739px). Optional line turns:
  `.hero-copy-turn` after "Race-car systems." (shown at 721–1279px) and
  `.hero-copy-split` after "Designed, built," (shown at 721–819px), so the
  longest line stays clear of the car's nose.
- Hero halo: `.hero-copy::before` is a white backdrop shaped by gradient masks
  with an exact reach on each side (`--halo-*` variables), plus an elliptical
  layer that rounds off the right side. It has no blur, so no straight edge or
  corner shows. The right fade is short (30px) beside the nose at 721–900px and
  on near-square windows. Opacity is .88 on phones and .72 from 721px. The h1
  paints above it. `tools/hero-tests/hero-halo-20261024.cjs` checks that no
  dark car pixel is lifted and that glyph contrast holds.
- `.hero-content` has `animation: none`; the name paints where it settles.
  The slow-load veil is unchanged. Short windows at 721–1279px (≤880px tall)
  tighten the hero rhythm.
- Hero actions: at ≤499px the studio button spans the column and the two text
  links share the row under it. From 500px the single row is kept.
- Card motion: leaving a playing card cuts straight to the frame-0 cover (no
  cross-fade ghost). Wheel scrubbing follows with a critically damped spring
  (omega 15, speed cap 1/0.6s): about 0.45s to settle after a flick, about 0.8s
  for a full sweep, and undecoded frames are never skipped. Range and detail
  seeks stay exact.
- Skill card: it first appears at its chip with a 160ms fade and 4px rise.
  Text and image swap together after the image decodes. The 14 images preload
  on the first fine-pointer entry or keyboard focus. An open card still follows
  to the next chip over 500ms.
- Filters apply on click (no 150ms delay).
- Scanner card: cover `assets/editorial/scanner-color-20261024/`; homepage
  frames come from `assets/exploded/manifest-white-20261024.json` and case
  pages from `manifest-detail-white-20261024.json`.

## Design-audit fixes · 2026-10-22

Owner-approved audit changes; these rules supersede older entries below.

- Hero: four new dated masks in `assets/hero-fsae-context-20261022/`, all
  continuous regions with no per-part outline: `context-mask.svg` above 1140px
  wide (σL60/σB50); `context-mask-band.png`, a hull-shaped halo, at 721–1140px
  (background layer .9, no filter); `context-mask-soft.svg` for tall tablets
  (721–1100px wide, ≥900px tall; σL100/σB90); `context-mask-compact.svg` at
  ≤720px (σL100/σB30). Both protected regions keep alpha 255 and photo pixels
  are unchanged. Elsewhere the background layer is .82 opacity / .97
  saturation. A page-white veil over `.hero-media` lifts over 450ms on slow
  first loads only (skipped for cached loads and reduced motion, 4s failsafe);
  the photo element itself is never hidden (first visits also have the
  drawing's veil, see 2026-11-06).
- Hero actions gain "Resume (PDF) ↗". From 721px up the two text links sit on
  a second row under the button; on near-square windows (≥1101px, aspect
  ≤5/4) the résumé link takes a third row, so every link stays on the white
  side of the fade. Short windows (≤760px tall, or ≥1101px and ≤880px tall)
  tighten the hero rhythm. The hero-role strong line is 18px (16px on phones,
  14px at ≤370px); phone hero padding-top is 76px. No availability line in the
  hero (owner, 2026-10-22); the #contact line stays.
- Cards: meta is "Context · Role" in 12px (11px at 1280–1439px and ≤370px),
  one line at ≥1280px and stacked below. javelin, brakeSim, carbonSeat,
  ansysCfd, lineFollower and education read "Individual project"; AURA reads
  "Mechanical Engineer". Titles are weight 600. Subtitles state only verified
  results (brakeSim "Design review: 23% less rotor mass, 19% less inertia.";
  seat "Designed and fabricated the Mk.7 driver seat."). Every card has
  `id="project-<key>"` with scroll-margin-top 104px (88px at ≤720px) so case
  pages can return to it; `#project-directory` uses the same offset. Covers
  gain a 1200w step (`assets/editorial/white-20261022/`). The download icon
  has a 44px hit box.
- AURA's cover and animation frames are reframed:
  `assets/editorial/aura-reframe-20261022/` (cover srcset and the case-page
  cover catalog) and `assets/exploded/aura-reframe-20261022/` (SD/HD frames,
  anchors). The homepage loads `assets/exploded/manifest-white-20261022.json`
  and case pages `manifest-detail-white-20261022.json`.
- A card scrubs on wheel only after the pointer has really moved onto it (or
  rested on it 350ms when the browser reports no movement); a card scrolling
  under a still cursor never holds the page, and at either end the rest of the
  gesture goes back to the page. Wheel travel is 380px per full scrub. Card
  label/hint are 11px; the slider focus ring is 2px #245cab.
- The grid section note names the real control: "Hover over a project and
  scroll to see it move." on fine pointers, "Drag a project’s slider to see it
  move." on touch (same `(hover: none), (pointer: coarse)` query as
  exploded.css); both read two lines. Section heads share one layout (title
  left, note right; stacked at ≤1100px); display heads track at -.035em, the
  contact head at -.01em so no glyph pairs touch.
- The "Showing N of 16" count shows only while a filter or search is active
  (it stays in the live region).
- The leadership block moved from How I work to right after the project grid.
  Page order: Work → Leadership → Studio → How I work → Contact.
- Nav CTA reads "Enter the 3D Studio ↗" in Inter 13px; on tablets and coarse
  pointers it and the nav links are 44px tall. On wide screens the header
  aligns with the 1440px content edges. The skill card is square with no shadow
  or blur; the skill strip is one tab stop with arrow keys.
- No text in white-home CSS is below 11px; muted grey is #60666d. At ≤370px,
  mono labels keep 11px and trim letter-spacing instead; labels that still
  cannot fit break only at a "·" separator (nowrap phrase groups, `&nbsp;·`).
  Card subtitles keep number-unit pairs together ("300&nbsp;km/h").
- How I work: each column pins its link to the bottom so the three share a
  baseline. Footer links are 44px tall.
- Studio teaser: `assets/studio-teaser-20261022/studio-{800,1600}.webp`, a night
  capture from the live renderer (HUD hidden). The old `assets/studio-teaser.webp`
  stays published but unused by the homepage.
- How I work photos and the Mk.7 photo gain 800w/1200w variants in
  `assets/method-20261022/`. The U-joint photo is only 800w and is unchanged.
- Social preview: `assets/og/home-20261022.jpg` (1200×630 crop of the published
  hero photo, no retouching). 404.html is rebuilt in the white theme (headline
  Inter Tight 600, -0.03em).

## Preserve fine hardware from the original photo · 2026-10-13

The user's rear-suspension feedback supersedes the per-component silhouette
mask. That earlier SVG approximated narrow links, allowing real pixels outside
the traced shapes to fall into the faded background. Overall framing checks
did not catch this pixel-level detail loss.

The active foreground now reveals two overlapping continuous original-photo
zones covering the complete car and driver/cage context. It does not trace
parts or cut holes between them. The protected source regions stay fully opaque;
all original links, hardware, gaps and contact shadows there retain the original
photograph. Soft transitions occur outside these broad regions. No sharpening,
generated parts or raster photo edits are used. Source/crop/scale and the current
racetrack background settings remain unchanged.

The new immutable directory is `assets/hero-fsae-context-20261013/`; source hashes
and method are in provenance.json. The old immutable SVG remains stored but is
not used by the homepage. Never restore its per-part tracing or edit either
published mask in place. Pixel checks,3× detail comparison, layouts and exact
release/restore records: `../.codex/hero-detail-preservation-20261013/`.

## Clearer track / gentler white transition · 2026-10-13

The latest request makes track context stronger while keeping the whole real
car/person. Background opacity .78 and saturation .94 retain more natural
road/grass color. A broad seven-stop fade keeps the scene clear near the car
and eases into white across a longer distance. No subject crop, scale, camera
position, mask path or source pixels change. Complete subject bounds were checked
at320/430/768/1024/1280/1920px. Evidence/release/restore:
`../.codex/hero-track-natural-20261013/`.

## Retained racetrack context · 2026-10-13

Latest user feedback keeps more of the real track. Background opacity is now
.52 with saturation .78 and a broader soft radial reveal, retaining readable
asphalt texture and a little grass around the car. It still fades into white
near the name/page edges. Subject colors, source photograph, immutable mask,
responsive placement and all interactions are unchanged. Exact verification
and restoration evidence: `../.codex/hero-track-context-20261013/`.

## Real race-car hero composition · 2026-10-13

The user clarified the abrupt cover means the homepage race-car photo and
approved preserving the clear subject while fading background context. The
hero now layers two copies of the same existing responsive photograph. An
alpha-only SVG reveals the real car/driver with its original color and contrast;
the background alone receives a gentle radial fade and reduced saturation.
The subject keeps the helmet, roll hoop, suspension gaps, tires and original
contact shadow. No image-generation or invented vehicle geometry is used.

Both images share absolute sizing, source/srcset/sizes and object-position.
The SVG mask uses the same cover scale and position through one responsive
CSS variable. The foreground is decorative/aria-hidden; the original image
supplies alt text and high-priority loading. Equal URLs share browser caching.
Mask support enables the new composition; unsupported browsers retain a
single-photo fallback. The scene has no runtime JS or new animation loop.

Phone composition preserves the full vehicle and driver in a shallow transparent
field, positioned close to the name. Its background fades to white without
a photographic band. Tablet framing keeps the car clear of the text/buttons.
The original16-project gallery, fine range controls,14 skills, case data and
3D return stay unchanged.

Source hashes/method: `assets/hero-fsae-20261013/provenance.json`. The three
original hero WebPs are byte-identical to47757cec. Only the small vector mask
is a new visual asset; its dated directory receives immutable caching. Use a
fresh version path for future mask edits after publication. Audit screenshots,
responsive measurements, exact deployment and restoration chain:
`../.codex/hero-fusion-20261013/`.

## Current presentation: original16-project gallery

The user's later feedback supersedes the featured-three presentation below.
The homepage again opens directly into the original16-project grid with its
original metadata/summary sizes. No extra featured section or featured script
is loaded. The original Vine framing is restored. Title-side decorative arrows
are removed; full-card links, downloads, search and filtering remain usable.
Gallery range controls retain native keyboard/scroll/touch semantics with a
2px neutral track,8px thumb and44px transparent input target. Focus is visible
inside the media boundary. Cover pixels, model poses, scientific figures and
case data are unchanged. Hero refinements, top skills and real process photos
from the previous update remain. Verification/release/backup evidence is in
`../.codex/gallery-refinement-20261012/`.

## Previous featured presentation (superseded)

The user approved all three recommendations from the October 12 aesthetic
review, including publication. This continues the white portfolio at6d7bd303.

- Hero auxiliary text uses a clearer, consistent scale and spacing. The real
  race-car photograph, white fade, large name and top skills cards are retained.
- Steering, Vine Robot and LiDAR Scanner receive a larger featured presentation
  before the complete16-project directory. `featured-work-20261012.js` reads
  existing directory media/body nodes; it has no second content catalog. Keep
  it before `exploded.js` so it clones only original covers and content.
- The Approach section adds three photographs from the existing project galleries.
  The images keep their full aspect ratios, original pixels and colors.

## Sources of the newly displayed material

| Existing asset | Existing source | New caption |
| --- | --- | --- |
| `assets/linkedin-u-joint.webp` | `project-data.js`: steering.gallery[0]; case-study-data.js: fabricated hardware | Machined steering hardware |
| `assets/vine-body-3partition.webp` | `project-data.js`: vineRobot.gallery[0] | Vine robot on the test bench |
| `assets/material-bending-fixture.webp` | `project-data.js`: materialTest.gallery[6] | Bamboo bending test |

The first photo shows finished hardware installed in the chassis, not machining
in progress. The Vine caption identifies the physical prototype without
assigning it a pressure value or reinforcement revision. The bending photo
shows a physical test without adding a numerical result. These are existing
public photos, not newly published private documents. No project outcomes,
roles, scientific figures or engineering records have been rewritten.

## Motion and maintenance

Featured hosts use `.featured-project.case-animation-host`, outside directory
filtering. The directory remains16 entries. The existing offline preview loader
now registers by host element so two presentations of one project have their
own controls. It retains one manifest, original asset URLs, interaction-only
loading, three concurrent requests and the160MiB decoded-memory limit.

Every model field uses the complete640:427 source aspect ratio with `contain`.
Vine uses the same1.12 scale and5.2% horizontal shift on poster and frames.
Conservative projected part masks from every animation pose leave its transformed
geometry inside x23.7–76.2% and y12.7–87.3%. Those source masks are at
`assets/exploded/white-20261011/anchors.json`; preserve the full motion envelope
when changing scale. Do not apply an independent cover zoom. Current models,
materials, cover/start poses, immutable frames and live detail motion are unchanged.

Main and3D details continue to use the same case-study data and renderer. The
complete engineering archive and retained-room return are preserved. Regression
tests: `node --test tools/readability-tests/featured-hosts.test.mjs` and
`node tools/readability-tests/verify.mjs`. Browser and exact release/online/backup
evidence is recorded outside the public repository in `../.codex/aesthetic-20261012/`.
