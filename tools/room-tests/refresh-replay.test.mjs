import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// refresh-20261107, "every refresh plays": the drawings replay on every load and reload, never on
// Back/Forward. These run the inline scripts for real in a small fake page; the browser checks are in
// tools/hero-tests/refresh-replay.test.cjs.
const text = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const index = text('index.html');
const inline = (html, test) => {
  const found = [...html.matchAll(/<script(?: id="[^"]+")?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter(test);
  assert.equal(found.length, 1);
  return found[0];
};
const guard = inline(index, (code) => code.includes('data-hero-pen') && code.includes('hero=draw'));

// A page with just enough of the DOM for the inline guard.
function page({ nav = 'navigate', search = '', hash = '', visibility = 'visible', prerendering = false, reduce = false, forced = false, hold = '', masks = true } = {}) {
  const classes = new Set(['js']), attrs = new Map(), timers = [], win = new Map(), doc = new Map();
  const add = (map) => (type, fn) => { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); };
  const remove = (map) => (type, fn) => map.get(type)?.delete(fn);
  const documentElement = {
    classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c) },
    getAttribute: (n) => (attrs.has(n) ? attrs.get(n) : null), setAttribute: (n, v) => attrs.set(n, String(v)), removeAttribute: (n) => attrs.delete(n),
  };
  const document = { documentElement, visibilityState: visibility, prerendering, addEventListener: add(doc), removeEventListener: remove(doc) };
  const context = {
    document, location: { search, hash },
    performance: { getEntriesByType: (type) => (type === 'navigation' ? [{ type: nav }] : []) },
    matchMedia: (q) => ({ matches: (q.includes('reduced-motion') && reduce) || (q.includes('forced-colors') && forced) }),
    CSS: { supports: () => masks },
    setTimeout: (fn, ms) => { timers.push({ fn, ms, at: 'set' }); return timers.length; },
    addEventListener: add(win), removeEventListener: remove(win),
  };
  context.window = context;
  context.__vtBoot = { on: true, hold };
  // No storage at all: the guard must not need it (any use throws).
  Object.defineProperty(context, 'sessionStorage', { get() { throw new Error('sessionStorage was used'); } });
  Object.defineProperty(context, 'localStorage', { get() { throw new Error('localStorage was used'); } });
  vm.runInNewContext(guard, context);
  const fire = (map, type) => { for (const fn of [...(map.get(type) || [])]) fn({ type }); };
  return {
    armed: () => classes.has('hero-draw'), pen: () => attrs.get('data-hero-pen') ?? null, timers,
    show() { document.visibilityState = 'visible'; document.prerendering = false; fire(doc, 'visibilitychange'); },
    activate() { document.prerendering = false; document.visibilityState = 'visible'; fire(doc, 'prerenderingchange'); },
    hide() { document.visibilityState = 'hidden'; fire(doc, 'visibilitychange'); },
    input(type = 'pointerdown') { fire(win, type); },
    engine() { context.__heroDraw = { state: 'boot' }; },
  };
}

test('The hero guard arms on every plain load and every reload, with no session memory', () => {
  for (const nav of ['navigate', 'reload', 'reload', 'prerender']) {
    const p = page({ nav });
    assert.equal(p.armed(), true, nav);
    assert.equal(p.pen(), 'now');
    assert.deepEqual(p.timers.map((t) => t.ms), [4000], 'the guard timer starts with the class');
  }
  assert.doesNotMatch(guard, /sessionStorage|localStorage|kw-hero-drawn/);
  assert.doesNotMatch(text('hero-drawing-20261027.js'), /sessionStorage|kw-hero-drawn/, 'the engine has no session key either');
});

test('Back/Forward and deep links keep the photo; ?hero=draw replays them', () => {
  for (const options of [{ nav: 'back_forward' }, { hash: '#work' }, { hash: '#contact' }, { hash: '#project-scanner' }, { nav: 'back_forward', hold: 'parsed' }]) {
    assert.equal(page(options).armed(), false, JSON.stringify(options));
    assert.equal(page(options).pen(), null);
    assert.equal(page({ ...options, search: '?hero=draw' }).armed(), true, `?hero=draw ${JSON.stringify(options)}`);
  }
  assert.equal(page({ hash: '#top' }).armed(), true, '#top is the top of the page');
  // fix-r1: a reload of a #link URL is a refresh like any other (script#kw-scroll drops the fragment
  // and lands at the top; the guard also arms if the fragment is still there).
  for (const hash of ['#work', '#contact', '#approach', '#project-steering']) {
    assert.equal(page({ nav: 'reload', hash }).armed(), true, `reload ${hash}`);
    assert.equal(page({ nav: 'reload', hash }).pen(), 'now');
  }
  for (const options of [{ search: '?draw=off' }, { search: '?hero=photo' }, { reduce: true }, { forced: true }, { masks: false }, { search: '?hero=draw&draw=off' }]) {
    assert.equal(page(options).armed(), false, JSON.stringify(options));
  }
});

// fix-r3 (agent decision): a forward arrival through a held view transition (window.__vtBoot.hold is
// 'parsed' after the wordmark or a home link from a detail page whose stage is on screen) lands at the
// top with no morph: it plays like any other load. A held deep link (#project-<key>) still keeps the photo.
test('A held view-transition arrival plays; a held deep link and a held Back/Forward keep the photo', () => {
  for (const hold of ['parsed', 'stage']) {
    const p = page({ hold });
    assert.equal(p.armed(), true, `hold ${hold}`);
    assert.equal(p.pen(), 'now');
    assert.deepEqual(p.timers.map((t) => t.ms), [4000]);
  }
  assert.equal(page({ nav: 'reload', hold: 'parsed' }).armed(), true, 'a reload with a stale hold plays too');
  assert.equal(page({ hold: 'parsed', hash: '#project-steering' }).armed(), false, '"Back to projects" (a held #link) keeps the photo');
  assert.equal(page({ hold: 'parsed', nav: 'back_forward' }).armed(), false, 'a held Back keeps the photo');
  assert.equal(page({ hold: 'parsed', search: '?hero=photo' }).armed(), false, '?hero=photo still wins');
  assert.doesNotMatch(guard, /__vtBoot|\.hold/, 'the guard no longer reads the view-transition hold');
  assert.doesNotMatch(text('hero-drawing-20261027.js').replace(/\/\*[\s\S]*?\*\//g, ''), /__vtBoot|\.hold\b/, 'nor does the engine (outside its comments)');
});

test('A tab hidden or prerendered at parse waits, and arms on its first visible with fresh clocks', () => {
  const p = page({ visibility: 'hidden' });
  assert.equal(p.armed(), false, 'the photo stays untouched while hidden');
  assert.equal(p.pen(), 'wait');
  assert.equal(p.timers.length, 0, 'no timer runs while hidden');
  p.show();
  assert.equal(p.armed(), true);
  assert.equal(p.pen(), 'late');
  assert.deepEqual(p.timers.map((t) => t.ms), [4000], 'the 4 s timer starts on the first visible');
  p.hide(); p.show();
  assert.equal(p.armed(), false, 'hidden again before the engine started: dropped, and never re-armed');
  const r = page({ visibility: 'hidden', prerendering: true });
  assert.equal(r.pen(), 'wait');
  r.activate();
  assert.equal(r.armed(), true, 'a prerendered page arms on activation');
  const q = page({ visibility: 'hidden' });
  q.engine(); q.show();
  assert.equal(q.armed(), true, 'the engine may already be waiting: the guard still arms first');
});

test('Intent before the engine has started drops the drawing; after, the engine owns it', () => {
  for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown', 'pagehide']) {
    const p = page();
    p.input(type);
    assert.equal(p.armed(), false, type);
    assert.equal(p.pen(), null);
  }
  const p = page();
  p.input('scroll');
  assert.equal(p.armed(), true, 'a scroll event is not intent (a restored position fires one)');
  const q = page();
  q.engine(); q.input('pointerdown');
  assert.equal(q.armed(), true, 'the engine settles it itself');
  q.timers[0].fn();
  assert.equal(q.armed(), true, 'the 4 s timer leaves a running engine alone');
  const r = page();
  r.timers[0].fn();
  assert.equal(r.armed(), false, 'no engine after 4 s: dropped');
});

test('The hero engine no longer reads a scroll as intent, and waits for a hidden tab', () => {
  const engine = text('hero-drawing-20261027.js');
  assert.doesNotMatch(engine, /on\(window, "scroll"/);
  assert.doesNotMatch(engine, /scrollY > 4/);
  for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown']) assert.match(engine, new RegExp(`on\\(window, "${type}", intent\\("${type}"\\)`));
  assert.match(engine, /root\.getAttribute\("data-hero-pen"\) === "wait"/);
  assert.match(engine, /state: "wait-visible"/);
  assert.match(engine, /heroDrawing\(true\)/, 'the sequence runs from the first visible');
  assert.match(engine, /performance\.now\(\) - armedAt/, 'a late arm counts its clocks from the arm');
  assert.match(engine, /root\.removeAttribute\("data-hero-pen"\)/, 'the end state leaves nothing on <html>');
});

// ---- scroll restoration ----
const homeScroll = inline(index, (code) => code.includes('scrollRestoration'));
function scrollPage({ nav = 'navigate', key = 'k1', stored = {}, y = 0, pathname = '/', hash = '', search = '', code = homeScroll, api = true, storage = true } = {}) {
  const store = new Map(Object.entries(stored)), win = new Map(), navEvents = new Map(), scrolls = [], intoView = [], replaced = [], timers = [];
  const navigation = { currentEntry: key ? { key } : null, addEventListener: (type, fn) => { if (!navEvents.has(type)) navEvents.set(type, []); navEvents.get(type).push(fn); } };
  const context = {
    history: { scrollRestoration: 'auto', state: { s: 1 }, replaceState: (state, unused, url) => { replaced.push([state, url]); context.location.hash = ''; } },
    location: { pathname, hash, search },
    performance: { getEntriesByType: () => [{ type: nav }] }, scrollY: y,
    document: { getElementById: (id) => ({ scrollIntoView: (o) => intoView.push([id, { ...o }]) }) },
    scrollTo: (o) => { scrolls.push({ ...o }); context.scrollY = o.top; },
    addEventListener: (type, fn) => { if (!win.has(type)) win.set(type, []); win.get(type).push(fn); },
    decodeURIComponent, URLSearchParams, setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  };
  const session ={ getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  Object.defineProperty(context, 'sessionStorage', { get() { if (!storage) throw new Error('SecurityError'); return session; } });
  if (api) context.navigation = navigation;
  context.window = context;
  vm.runInNewContext(code, context);
  return { context, store, scrolls, intoView, navigation, replaced, timers, listeners: () => win.size + navEvents.size, types: () => [...win.keys(), ...navEvents.keys()], handlers: (type) => win.get(type) || [],
    fire: (type) => (win.get(type) || []).forEach((fn) => fn({ type })),
    nav: (type, event = {}) => (navEvents.get(type) || []).forEach((fn) => fn(event)) };
}

test('Every homepage load lands at the top; Back/Forward restores the saved position', () => {
  const placement = index.indexOf('<script id="kw-scroll">');
  assert(placement > index.indexOf('w.__vtBoot='), 'after the shared bootstrap, never before it');
  assert(placement < index.indexOf('data-hero-pen'), 'before the hero guard');
  const reload = scrollPage({ nav: 'reload', stored: { 'kw-vt-y:k1': '1500' } });
  assert.equal(reload.context.history.scrollRestoration, 'manual');
  reload.fire('DOMContentLoaded');
  assert.deepEqual(reload.scrolls, [], 'a reload is not restored');
  const back = scrollPage({ nav: 'back_forward', stored: { 'kw-vt-y:k1': '1500' } });
  back.fire('DOMContentLoaded');
  assert.deepEqual(back.scrolls, [{ top: 1500, behavior: 'instant' }], 'instant, past the page\'s smooth scrolling');
  const top = scrollPage({ nav: 'back_forward', stored: { 'kw-vt-y:k1': '0' } });
  top.fire('DOMContentLoaded');
  assert.deepEqual(top.scrolls, []);
  const leave = scrollPage();
  leave.context.scrollY = 812.4;
  leave.fire('pagehide');
  assert.equal(leave.store.get('kw-vt-y:k1'), '812', 'saved under page-transitions-20261027.js\'s key');
  leave.navigation.currentEntry = { key: 'k2' };
  leave.context.scrollY = 3000;
  leave.fire('pagehide');
  assert.equal(leave.store.get('kw-vt-y:k2'), '3000', 'the entry current at pagehide (after a same-page #link)');
  assert.match(text('page-transitions-20261027.js'), /const SCROLL = "kw-vt-y:";/, 'the key page-transitions saves at pageswap');
});

test('Same-page #links keep the browser\'s Back/Forward position, and a homepage #link URL reloads at the top', () => {
  // The manual mode is copied to the entries a #link makes, so the page does the browser's part.
  const p = scrollPage({ y: 300 });
  p.nav('navigate');                                   // clicking "#contact" leaves entry k1 at 300
  assert.equal(p.store.get('kw-vt-y:k1'), '300');
  p.navigation.currentEntry = { key: 'k2' }; p.context.scrollY = 6277;
  p.nav('navigate');                                   // Back leaves k2 at 6277
  p.navigation.currentEntry = { key: 'k1' };
  p.nav('currententrychange', { navigationType: 'traverse' });
  assert.deepEqual(p.scrolls.at(-1), { top: 300, behavior: 'instant' }, 'Back returns to where the #link was clicked');
  p.nav('navigate');
  p.navigation.currentEntry = { key: 'k2' };
  p.nav('currententrychange', { navigationType: 'traverse' });
  assert.deepEqual(p.scrolls.at(-1), { top: 6277, behavior: 'instant' }, 'Forward returns to the target');
  const count = p.scrolls.length;
  p.nav('currententrychange', { navigationType: 'push' });
  assert.equal(p.scrolls.length, count, 'a #link click itself scrolls natively');
  // fix-r1: a reload of a homepage #link URL ("Back to projects" is index.html#project-<key>; the hero
  // and the nav go to #work, #approach, #contact) drops the fragment and lands at the top.
  for (const [hash, pathname, search] of [['#contact', '/', ''], ['#work', '/index.html', ''], ['#project-steering', '/index.html', '?hero=draw']]) {
    const reload = scrollPage({ nav: 'reload', hash, pathname, search, stored: { 'kw-vt-y:k1': '6100' } });
    assert.deepEqual(reload.replaced, [[{ s: 1 }, pathname + search]], `${hash}: the fragment is dropped, the state and query kept`);
    reload.fire('DOMContentLoaded');
    assert.deepEqual([reload.scrolls, reload.intoView], [[], []], `${hash}: not restored, not scrolled to its target`);
    assert.equal(reload.context.history.scrollRestoration, 'manual');
  }
  for (const nav of ['navigate', 'back_forward']) {
    const p = scrollPage({ nav, hash: '#work' });
    assert.deepEqual(p.replaced, [], `${nav}: a #link arrival keeps its fragment`);
  }
  const top = scrollPage({ nav: 'reload', hash: '#top', stored: { 'kw-vt-y:k1': '900' } });
  top.fire('DOMContentLoaded');
  assert.deepEqual([top.scrolls, top.intoView], [[], []], '#top reloads at the top (and the hero plays)');
  assert.deepEqual(top.replaced, []);
});

// fix-r3 (agent decision): without the Navigation API (older Safari and Firefox) there is no navigate or
// currententrychange event. The manual mode stays (so a reload lands at the top); positions are keyed by URL
// ("kw-y:" + path, query and fragment), saved by a same-page #link click (capturing, before the jump) and by
// popstate for the entry it leaves, and put back by popstate for the entry it returns to. Handing the mode
// back to the browser after the load was measured and rejected: Chrome reads the mode for a reload before the
// new document's scripts run, so every reload restored (fix-r3/fallback-wt-autoflip-rejected.json).
const link = (href, base) => { const u = new URL(href, base); return { origin: u.origin, pathname: u.pathname, search: u.search, hash: u.hash }; };
function apiless(options) {
  const p = scrollPage({ ...options, api: false });
  const { context } = p;
  context.location.origin = 'https://www.kefanwu.com';
  const url = () => `https://www.kefanwu.com${context.location.pathname}${context.location.search}${context.location.hash}`;
  const handlers = (type) => p.handlers(type);
  return { ...p, url,
    click(href, closest = true) {   // a click on (something inside) <a href>, then the browser's own fragment jump
      const a = link(href, url());
      for (const fn of handlers('click')) fn({ type: 'click', target: { closest: (sel) => (closest && sel === 'a[href]' ? a : null) } });
      if (closest && a.origin === context.location.origin && a.pathname === context.location.pathname && a.search === context.location.search && a.hash) {
        context.location.hash = a.hash; context.scrollY = options.targets?.[a.hash] ?? 5000;
        for (const fn of handlers('hashchange')) fn({ type: 'hashchange' });
      }
    },
    traverse(hash) {                // a same-page Back/Forward: the manual mode leaves scrollY where it was
      context.location.hash = hash;
      for (const fn of handlers('popstate')) fn({ type: 'popstate' });
      for (const fn of handlers('hashchange')) fn({ type: 'hashchange' });
    },
  };
}

test('Without the Navigation API: every load still lands at the top; same-page Back/Forward is put back from URL keys', () => {
  for (const [name, pathname, search, hash] of [['index.html', '/', '', '#contact'], ['index.html', '/index.html', '', '#work'], ['case-study.html', '/case-study.html', '?project=steering', '#brief'], ['project-3d.html', '/project-3d.html', '?project=scanner', '#motion']]) {
    const code = inline(text(name), (c) => c.includes('scrollRestoration'));
    const at = (h) => `kw-y:${pathname}${search}${h}`;
    // A reload from deep in the page: manual, nothing put back, the #link reload rule unchanged.
    const reload = apiless({ code, nav: 'reload', pathname, search, stored: { [at('')]: '4000' } });
    assert.equal(reload.context.history.scrollRestoration, 'manual', `${pathname}: a reload is not restored`);
    reload.fire('DOMContentLoaded'); reload.fire('load');
    assert.deepEqual([reload.scrolls, reload.timers, reload.replaced], [[], [], []], `${pathname}: nothing put back, nothing handed back`);
    const deep = apiless({ code, nav: 'reload', pathname, search, hash, stored: { [at(hash)]: '6000', [at('')]: '6000' } });
    assert.deepEqual(deep.replaced, [[{ s: 1 }, pathname + search]], `${pathname}${hash}: the fragment is dropped`);
    deep.fire('DOMContentLoaded');
    assert.deepEqual([deep.scrolls, deep.intoView], [[], []], `${pathname}${hash}: lands at the top`);
    // Same page: at 300, click the #link (jump to 5000), Back, Forward.
    const p = apiless({ code, pathname, search, y: 300, targets: { [hash]: 5000 } });
    assert.equal(p.context.history.scrollRestoration, 'manual');
    p.click(hash);
    assert.equal(p.store.get(at('')), '300', `${pathname}: the click saves where it was clicked`);
    p.traverse('');
    assert.deepEqual(p.scrolls.at(-1), { top: 300, behavior: 'instant' }, `${pathname}: Back returns to where the link was clicked`);
    assert.equal(p.store.get(at(hash)), '5000', `${pathname}: and saved the target's position`);
    p.traverse(hash);
    assert.deepEqual(p.scrolls.at(-1), { top: 5000, behavior: 'instant' }, `${pathname}: Forward returns to the target`);
    p.context.scrollY = 5600;                           // read on at the target, then Back again
    p.traverse('');
    assert.deepEqual(p.scrolls.at(-1), { top: 300, behavior: 'instant' });
    p.traverse(hash);
    assert.deepEqual(p.scrolls.at(-1), { top: 5600, behavior: 'instant' }, `${pathname}: Forward returns to where the target was left`);
    // Other clicks save nothing: another page, another query, a link without a fragment, not a link.
    const q = apiless({ code, pathname, search, y: 700 });
    for (const href of [`/case-study.html?project=aura${hash}`, `${pathname}?project=other${hash}`, `${pathname}${search}`, 'https://example.com/#x']) q.click(href);
    q.click(hash, false);
    assert.deepEqual([...q.store.keys()], [], `${pathname}: only same-page #links save`);
    q.fire('pagehide');
    assert.deepEqual([...q.store.entries()], [[at(''), '700']], `${pathname}: pagehide saves under the URL key`);
    assert.deepEqual(q.types().sort(), ['click', 'hashchange', 'pagehide', 'popstate'], `${pathname}: four listeners, no load timer`);
  }
  // Cross-document Back/Forward without the back/forward cache: the homepage is put back from its URL key,
  // a detail page lands at the top (as with the Navigation API).
  const home = apiless({ nav: 'back_forward', stored: { 'kw-y:/': '1500' } });
  home.fire('DOMContentLoaded');
  assert.deepEqual(home.scrolls, [{ top: 1500, behavior: 'instant' }], 'the homepage keeps its place');
  const homeHash = apiless({ nav: 'back_forward', hash: '#contact', stored: { 'kw-y:/#contact': '6300', 'kw-y:/': '1500' } });
  homeHash.fire('DOMContentLoaded');
  assert.deepEqual(homeHash.scrolls, [{ top: 6300, behavior: 'instant' }], 'an entry with a fragment keeps its own place');
  for (const name of ['case-study.html', 'project-3d.html']) {
    const code = inline(text(name), (c) => c.includes('scrollRestoration'));
    const back = apiless({ code, pathname: `/${name}`, search: '?project=steering', nav: 'back_forward', stored: { 'kw-y:/case-study.html?project=steering': '2400', 'kw-y:/project-3d.html?project=steering': '2400' } });
    back.fire('DOMContentLoaded');
    assert.deepEqual(back.scrolls, [], `${name}: Back without the back/forward cache lands at the top`);
  }
  // With the Navigation API nothing changed: no click or popstate listener, entry keys.
  const api = scrollPage({ y: 300 });
  assert.deepEqual(api.types().sort(), ['currententrychange', 'navigate', 'pagehide']);
});

test('With sessionStorage blocked the snippet stays out of the way (browser scroll restoration, as at HEAD)', () => {
  for (const [nav, api] of [['navigate', true], ['reload', true], ['back_forward', true], ['reload', false]]) {
    const p = scrollPage({ nav, api, hash: nav === 'reload' ? '#work' : '', storage: false });
    assert.equal(p.context.history.scrollRestoration, 'auto', nav);
    assert.equal(p.listeners(), 0, `${nav}: no listeners`);
    assert.deepEqual(p.replaced, []);
  }
});

test('Both detail pages land at the top on every load, Back/Forward included', () => {
  for (const name of ['case-study.html', 'project-3d.html']) {
    const html = text(name);
    const code = inline(html, (c) => c.includes('scrollRestoration'));
    assert.equal(code, homeScroll, `${name}: the same snippet as the homepage`);
    const back = scrollPage({ code, pathname: `/${name}`, nav: 'back_forward', stored: { 'kw-vt-y:k1': '2400' } });
    assert.equal(back.context.history.scrollRestoration, 'manual', name);
    back.fire('DOMContentLoaded');
    assert.deepEqual(back.scrolls, [], `${name}: Back without the back/forward cache lands at the top`);
    // fix-r2: a reload of a chapter #link URL ('Read case study' is #brief; the reading buttons and the
    // chapter nav add others) is a refresh like any other: the fragment is dropped and it lands at the top,
    // so the arrival is not given back as 'interrupted' by a restored story position.
    for (const hash of ['#brief', '#motion', '#verification', '#constraint']) {
      const search = `?project=${name === 'case-study.html' ? 'steering' : 'scanner'}`;
      const reload = scrollPage({ code, pathname: `/${name}`, search, nav: 'reload', hash, stored: { 'kw-vt-y:k1': '5000' } });
      assert.deepEqual(reload.replaced, [[{ s: 1 }, `/${name}${search}`]], `${name}${hash}: the chapter fragment is dropped, the state and query kept`);
      reload.fire('DOMContentLoaded');
      assert.deepEqual([reload.scrolls, reload.intoView], [[], []], `${name}${hash}: not restored, not scrolled to the chapter`);
      assert.equal(reload.context.history.scrollRestoration, 'manual');
    }
    for (const nav of ['navigate', 'back_forward']) {
      const p = scrollPage({ code, pathname: `/${name}`, search: '?project=steering', nav, hash: '#brief', stored: { 'kw-vt-y:k1': '5000' } });
      assert.deepEqual(p.replaced, [], `${name} ${nav}: a chapter #link arrival keeps its fragment`);
      p.fire('DOMContentLoaded');
      assert.deepEqual(p.scrolls, [], `${name} ${nav}: no saved position is put back`);
    }
    // A legacy project-3d.html#<key> URL names its project in the fragment (case-study.js reads it): kept.
    const legacy = scrollPage({ code, pathname: `/${name}`, nav: 'reload', hash: '#scanner', stored: { 'kw-vt-y:k1': '5000' } });
    assert.deepEqual(legacy.replaced, [], `${name}: a legacy #<key> URL keeps its fragment`);
    legacy.fire('DOMContentLoaded');
    assert.deepEqual([legacy.scrolls, legacy.intoView], [[], []], `${name}: and its reload lands at the top`);
    assert(html.indexOf('<script id="kw-scroll">') > html.indexOf('w.__vtBoot='), `${name}: after the shared bootstrap`);
    assert(html.indexOf('<script id="kw-scroll">') < html.indexOf('<link rel="stylesheet"'), `${name}: in the head, before the style sheets`);
  }
});

// ---- cards ----
test('The cards draw on every load and reload: no session list, Back/Forward stays quiet, data saver only', () => {
  const cards = text('card-drawing-20261027.js');
  assert.doesNotMatch(cards, /sessionStorage|kw-cards-drawn|drawn-this-session/);
  assert.doesNotMatch(cards, /effectiveType/, 'no effective-type gate');
  assert.match(cards, /if \(conn && conn\.saveData\) \{ QA\.reason = "save-data"; return; \}/);
  assert.match(cards, /if \(!replay && navType === "back_forward"\) \{ QA\.reason = "back-forward"; return; \}/);
  assert.match(cards, /forced-colors: active[\s\S]*?QA\.reason = "forced-colors"/, 'forced colors stay off');
  assert.match(cards, /reduce\.matches\) \{ QA\.reason = "reduced-motion"/, 'reduced motion stays off');
  assert.match(cards, /const heroParked = \(\) => root\.getAttribute\("data-hero-pen"\) === "wait";/, 'a hero waiting for its tab counts as running');
});

// ---- detail pages ----
test('Detail arrivals: the page\'s clock starts at its first byte, forced colors and data saver keep the cover', () => {
  const renderer = text('case-study.js');
  assert.match(renderer, /const PRINT_HOLD = 3000, STAGE_LATE = 8000, COVER_CAP = 8000;/);
  assert.match(renderer, /responseStart/);
  assert.match(renderer, /sinceResponse\(\) <= STAGE_LATE/);
  assert.match(renderer, /COVER_CAP - sinceResponse\(\)/);
  assert.match(renderer, /!saveData && !forcedColors && !reducedMotion\?\.matches/);
  assert.doesNotMatch(renderer, /effectiveType/);
  // The clock, run: a first byte at 1100 ms and a script at 1300 ms is 200 ms of this page's time.
  const block = /const responseStart = [^\n]*\n\s*const sinceResponse = [^\n]*/.exec(renderer)[0];
  const since = Function('performance', `${block}; return sinceResponse();`);
  assert.equal(since({ now: () => 1300, getEntriesByType: () => [{ responseStart: 1100 }] }), 200);
  assert.equal(since({ now: () => 1300 }), 1300, 'no navigation timing: counted from navigation start, as before');
  const arrival = text('project-motion-arrival.js');
  assert.match(arrival, /COVER_CAP = 8000/);
  assert.match(arrival, /COVER_CAP - \(performance\.now\(\) - responseStart\)/);
});

test('The arrival\'s hold clock runs only while held; a hidden tab neither loses nor stalls its drawing', () => {
  const arrival = text('project-motion-arrival.js');
  const start = arrival.indexOf('function holdClock()');
  const body = arrival.slice(start, arrival.indexOf('\n  }\n', start) + 4);
  const run = (phase) => {
    const timers = [];
    Function('phase', 'document', 'setTimeout', 'clearTimeout', 'giveBack', `let holdFrom = null, holdLeft = 3000, holdTimer = 0, coverAt = 5, onScreen = true; ${body}; holdClock(); return holdTimer;`)(
      phase, { hidden: false }, (fn, ms) => { timers.push(ms); return timers.length; }, () => {}, () => {});
    return timers;
  };
  assert.deepEqual(run('held'), [3000]);
  assert.deepEqual(run('pencil'), [], 'a pencil drawing under the trigger waits to be scrolled to');
  assert.match(arrival, /const nextFrame = \(callback\) => \(document\.hidden \? setTimeout\(callback, 0\) : requestAnimationFrame\(callback\)\);/);
  assert.match(arrival, /const layersRequested = new Promise\(\(resolve\) => nextFrame\(/, 'sheets are requested in a hidden tab too');
  assert.match(arrival, /if \(phase !== 'held' \|\| document\.hidden\) return;\s*if \(coverAt === null\) giveBack\('cover late', 0\);\s*else if \(!openedHidden\) giveBack\('late'\);/, 'a model ready behind a hidden tab does not take the stage');
  assert.match(arrival, /const openedHidden = document\.hidden \|\| .*'visibility-state'/, 'nor one in a page opened hidden: its ready event lands just after the tab is shown');
});

// ---- studio ----
test('The studio loader drawing has 20 s to start before the classic card takes over', () => {
  const html = text('experience.html');
  const code = inline(html, (c) => c.includes('data-loader') && c.includes('setTimeout'));
  const run = (live) => {
    const timers = [], attrs = new Map();
    const loader = { getAttribute: (n) => attrs.get(n) ?? null, setAttribute: (n, v) => attrs.set(n, v) };
    if (live) attrs.set('data-draw', 'live');
    vm.runInNewContext(code, {
      URLSearchParams, location: { search: '' }, window: { WebGL2RenderingContext: function () {} },
      document: { documentElement: { setAttribute() {}, classList: { contains: () => false } }, getElementById: () => loader },
      setTimeout: (fn, ms) => timers.push({ fn, ms }),
    });
    assert.deepEqual(timers.map((t) => t.ms), [20000]);
    timers[0].fn();
    return attrs.get('data-draw');
  };
  assert.equal(run(false), 'off', 'not live by 20 s: the classic card');
  assert.equal(run(true), 'live', 'a live drawing is left alone');
});
