// Homepage catalogue pins (site refresh batch 1, refresh-20261120; plan B2):
// card order, hanging case numbers 01-16, the inked-figure allowlist (real measured, built,
// calculated or design-review results only; targets stay in body weight), Javelin's status tag,
// the filter counts, and the first-screen and catalogue apparatus that replaced the old notes.
// Run: node --test tools/room-tests/home-catalogue.test.mjs (no browser).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const ORDER = ['steering', 'vineRobot', 'brakeSim', 'scanner', 'javelin', 'materialTest', 'aura', 'carbonSeat', 'seat', 'ansysCfd', 'pool', 'lineFollower', 'formlabs', 'telecaster', 'education', 'ftc'];
// Each inked figure is checked against the project's verification basis (case-study-data.js):
// steering 0.9 kg bearing-cage mass (built revision), brakeSim -23 % mass and -19 % inertia (design
// review), scanner 2,206 readings (measured scan), aura 300 lb carried (measured), lineFollower
// 428 g -> 284 g, -33.6 % (measured).
const ALLOW = { steering: ['0.9 kg'], brakeSim: ['23%', '19%'], scanner: ['2,206-point'], aura: ['300 lb'], lineFollower: ['33.6%'] };
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const cards = [...html.matchAll(/<article class="project-card"[^>]*data-category="([^"]+)"[^>]*data-project="([^"]+)">([\s\S]*?)<\/article>/g)]
  .map(([, cat, key, body]) => ({ key, cat: cat.split(/\s+/), body }));

test('16 cards in the project order, each with its hanging case number', () => {
  assert.deepEqual(cards.map((c) => c.key), ORDER);
  cards.forEach((c, i) => {
    const no = c.body.match(/<span class="card-no" aria-hidden="true">(\d+)<\/span>/);
    assert.ok(no, `${c.key} has a case number`);
    assert.equal(no[1], String(i + 1).padStart(2, '0'), `${c.key} is ${i + 1}`);
    // number outside .project-body, so the search (script.js reads .project-body) never matches it
    assert.ok(c.body.indexOf('class="card-no"') < c.body.indexOf('class="project-body"'), `${c.key}: number before the body`);
  });
});

test('Inked figures are only the allowlisted real results; no target is inked', () => {
  const seen = {};
  for (const c of cards) {
    for (const [, f] of c.body.matchAll(/<b class="fig[^"]*">([^<]+)<\/b>/g)) (seen[c.key] = seen[c.key] || []).push(f);
  }
  assert.deepEqual(seen, ALLOW);
  for (const c of cards) {
    const figs = [...c.body.matchAll(/<b class="fig[^"]*">([^<]+)<\/b>/g)].map((m) => m[1]).join(' ');
    for (const bad of ['300 km', '200 lb', '15 s', '18 s']) assert.ok(!figs.includes(bad), `${c.key}: "${bad}" is not inked`);
    // every inked value appears in that card's own result line
    const sub = strip(c.body.match(/<p class="project-sub">([\s\S]*?)<\/p>/)[1]);
    for (const f of (ALLOW[c.key] || [])) assert.ok(sub.includes(f), `${c.key}: "${f}" is in its result line`);
  }
});

test('Javelin carries its In progress tag; the CFD workflow download is a text link in the meta line', () => {
  const jav = cards.find((c) => c.key === 'javelin').body;
  assert.match(jav, /<p class="project-status"><span class="kw-tag">In progress<\/span><\/p>/);
  assert.match(strip(jav.match(/<p class="project-sub">([\s\S]*?)<\/p>/)[1]), /300 km\/h target/, 'the target stays in the body text');
  const cfd = cards.find((c) => c.key === 'ansysCfd').body;
  assert.match(cfd, /<p class="project-meta">[\s\S]*?<a class="project-download-text" href="assets\/claude_ansys_cfd\.zip" download>Workflow \(\.zip\)<\/a><\/span><\/p>/);
  assert.doesNotMatch(cfd, /project-download--icon|title-row/);
});

test('Filter tabs show the number of cards carrying each tag', () => {
  const tally = {};
  for (const c of cards) for (const t of c.cat) tally[t] = (tally[t] || 0) + 1;
  const tabs = [...html.matchAll(/data-filter="(\w+)" aria-pressed="(?:true|false)">(\w+)<span class="filter-count"><span class="sr-only">, <\/span>(\d+)<span class="sr-only"> projects<\/span><\/span><\/button>/g)];
  assert.equal(tabs.length, 6);
  for (const [, f, , n] of tabs) assert.equal(+n, f === 'all' ? cards.length : tally[f], `${f} count`);
});

test('Section openers, no notes under headings, and the leadership spread after the grid', () => {
  for (const [num, label] of [['01', 'Projects'], ['02', 'Leadership'], ['03', 'How I work'], ['04', 'Let’s build something']]) {
    assert.match(html, new RegExp(`<p class="kw-opener"><span class="kw-num">${num}</span><span class="kw-label">${label}</span>`), `${num} ${label}`);
  }
  assert.doesNotMatch(html, /class="section-note|class="cover-note|class="studio-entry-note|data-reveal/);
  const grid = html.indexOf('id="project-cards"'), lead = html.indexOf('<section id="leadership"'), studio = html.indexOf('<section id="studio"');
  assert.ok(grid > 0 && lead > grid && studio > lead, 'leadership is its own section between the grid and the studio teaser');
  assert.ok(html.indexOf('class="leadership"', grid) > html.indexOf('</section>', grid), 'never inside the grid section');
  assert.match(html, /<img src="assets\/fsae-mk7-shop\.webp" alt="[^"]+" width="1467" height="1100"/, 'the already-public Mk.7 photo, not the hero car or the team photo');
  assert.equal((html.match(/Summer 2027/g) || []).length, 1, 'no new availability text');
});

test('First screen: imprint under the name, projects first, no bottom row', () => {
  const hero = html.slice(html.indexOf('<section class="hero cinematic-hero"'), html.indexOf('<section id="work"'));
  assert.ok(hero.indexOf('id="hero-title"') < hero.indexOf('class="hero-imprint"'), 'imprint after the name');
  assert.match(hero, /<strong>Leading 30<br class="imprint-turn"> mechanical engineers<\/strong><span><span class="nowrap">Mechanical Lead<\/span>&nbsp;· <span class="nowrap">Olin Electric Motorsports<\/span><\/span>/);
  assert.match(hero, /<a class="button primary hero-projects" href="#project-directory">See the 16 projects/);
  assert.match(hero, /<a class="button secondary studio-secondary" href="experience\.html">Enter the 3D Studio/);
  assert.doesNotMatch(hero, /hero-baseline|hero-scroll|hero-location|FROM THE WORKSHOP|Explore the work/);
  assert.doesNotMatch(html, /↗|class="kw-arrow[ "]|M3\.5 8\.5 8\.5 3\.5/, 'no north-east arrow mark, glyph or drawn (owner, 2026-11-25)');
  // the skills strip keeps every hover-card key (skills-card-20261012.js matches the lower-cased text)
  const keys = ['arduino', 'tig welding', 'autocad', 'topology study', 'solidworks', 'matlab', 'fea', 'cfd', 'cnc mill', 'lathe', 'waterjet', 'carbon fiber', 'team management', 'ai-assisted eng'];
  const track = hero.match(/<div class="hero-skill-track">([\s\S]*?)<\/div>/)[1];
  assert.deepEqual([...track.matchAll(/<span>([^<]+)<\/span>/g)].map((m) => m[1].toLowerCase()), keys);
});

test('Cache labels: the files this release changes are requested with refresh-20261120', () => {
  for (const ref of ['site-tokens-20261120.css?v=refresh-20261120', 'home-20261120.css?v=refresh-20261120', 'script.js?v=refresh-20261120', 'card-drawing-20261027.js?v=refresh-20261120']) {
    assert.ok(html.includes(ref), ref);
  }
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1].split('?')[0]);
  assert.deepEqual(links.slice(-3), ['white-home-20261011.css', 'site-tokens-20261120.css', 'home-20261120.css'], 'the overlays load after the white homepage sheet');
  const cardDrawing = readFileSync(new URL('../../card-drawing-20261027.js', import.meta.url), 'utf8');
  assert.match(cardDrawing, /const PENCIL = 0\.45;/, 'B4: the waiting pencil drawing at 45 %');
});

test('No north-east arrow marks anywhere on the site (owner, 2026-11-25)', () => {
  const read = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');
  const NE = /[↖-↙⇖-⇙⬈-⬋]|&#8599;|&#x2197;|&nearr;|\2197|\u2197|class="kw-arrow[ "]|M3\.5 8\.5 8\.5 3\.5/i;
  for (const f of ['index.html', '404.html', 'case-study.html', 'project-3d.html', 'experience.html', 'case-study.js', 'project-case-3d.js',
    'project-motion-story.js', 'project-motion-arrival.js', 'script.js', 'experience.js', 'experience-resume.js', 'studio-navigation.js',
    'case-study-data.js', 'case-study-supplements.js', 'project-data.js', 'experience-data.js', 'site-tokens-20261120.css', 'home-20261120.css',
    'case-study.css', 'white-case-20261011.css', 'experience.css']) {
    assert.doesNotMatch(read(f), NE, f);
  }
  assert.doesNotMatch(read('case-study.js'), /next-arrow/, 'the next-case link has no arrow');
  // the same-tab studio invitation keeps its plain right arrow (case-study.css draws it)
  assert.match(read('case-study.js'), /3D Studio <span aria-hidden="true">→<\/span><\/a>/);
  // the new-tab hints stay for screen readers
  for (const f of ['case-study.html', 'project-3d.html']) assert.match(read(f), /Resume<span class="sr-only"> \(PDF, opens in a new tab\)<\/span>/, f);
  assert.match(read('experience-resume.js'), /aria-label="Open résumé PDF in a new tab"/);
});
