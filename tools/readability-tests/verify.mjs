import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Run with Node; no browser, network, packages, or writable baseline is needed.
// DOM assertions exercise generated content and interactions, not CSS layout.
const repo = fileURLToPath(new URL('../../', import.meta.url));
const baseline = process.env.READABILITY_BASELINE || '5fa2eb783066dd809ed85a0d79c4605ba1632152';
const files = ['project-data.js', 'case-study-data.js', 'case-study-supplements.js', 'case-study-media.js'];
const read = (name) => readFile(new URL(`../../${name}`, import.meta.url), 'utf8');
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const oldSources = Object.fromEntries(files.map(name => [name, git('cat-file', 'blob', `${baseline}:${name}`)]));
const sources = Object.fromEntries(await Promise.all(files.map(async name => [name, await read(name)])));
const renderer = await read('case-study.js');
const bridge = await read('studio-project-bridge.js');
const pages = Object.fromEntries(await Promise.all(['case-study.html', 'project-3d.html'].map(async name => [name, await read(name)])));
const coverPath = renderer.match(/fetch\('(assets\/editorial\/[^']+\.json)(?:\?[^']*)?'/)?.[1];
assert(coverPath, 'Renderer supplies an existing same-origin cover catalog');
const coverCatalog = JSON.parse(await read(coverPath));
const plain = (value) => JSON.parse(JSON.stringify(value));
const normalize = (value) => String(value).replace(/\s+/g, ' ').trim();
const decode = (value) => String(value).replace(/&(?:amp|lt|gt|quot|#39|#\d+|#x[\da-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
  if (named[entity]) return named[entity];
  return String.fromCodePoint(entity.startsWith('&#x') ? parseInt(entity.slice(3), 16) : parseInt(entity.slice(2), 10));
});
function data(source) {
  const context = vm.createContext({ window: {} });
  for (const name of files) vm.runInContext(source[name], context, { filename: name });
  return plain(context.window);
}
const original = data(oldSources);
// Owner-approved content edits since the baseline (2026-10-22): first-screen My role / Result / Status
// summaries, card-matching project names, AURA title, Mk.7 seat role, Vine design-pressure wording and
// lineFollower attribution. Edits never touch chapter archives and only replace existing baseline fields.
const approvedEdits = JSON.parse(await read('tools/readability-tests/approved-edits-20261022.json'));
for (const { path, value } of approvedEdits.edits) {
  assert(!path.includes('chapters'), `Approved edits never touch chapter archives: ${path.join('.')}`);
  const parent = path.slice(0, -1).reduce((node, key) => node?.[key], original);
  // A new caseStudyData.<key>.recordNote is the one approved addition.
  assert(parent && (Object.hasOwn(parent, path.at(-1)) || (path.length === 3 && path[0] === 'caseStudyData' && path[2] === 'recordNote')), `Approved edit path exists in the baseline: ${path.join('.')}`);
  parent[path.at(-1)] = plain(value);
}
// Archive corrections replace single baseline chapter sentences that contradict a 2026-10-22 owner fact
// (Mk.7 seat authorship and unconfirmed material/process; lineFollower as an individual project).
// Each names the exact baseline sentence it replaces and a reason; every other archive sentence stays verbatim.
for (const { path, from, value, reason } of approvedEdits.archiveCorrections || []) {
  assert(path.length === 6 && path[0] === 'caseStudyData' && path[2] === 'chapters' && path[4] === 'paragraphs'
    && Number.isInteger(path[3]) && Number.isInteger(path[5]), `Archive correction targets one chapter paragraph: ${path.join('.')}`);
  assert(typeof reason === 'string' && reason.includes('Owner fact'), `Archive correction cites an owner fact: ${path.join('.')}`);
  const paragraphs = path.slice(0, 5).reduce((node, key) => node?.[key], original);
  assert(Array.isArray(paragraphs) && paragraphs[path[5]] === from, `Archive correction replaces the exact baseline sentence: ${path.join('.')}`);
  assert(typeof value === 'string' && value.trim() && value !== from, `Archive correction supplies replacement text: ${path.join('.')}`);
  paragraphs[path[5]] = value;
}
const current = data(sources);
const keys = Object.keys(original.caseStudyData);
const homepageOrder = [...(await read('index.html')).matchAll(/<article class="project-card"[^>]*data-project="([^"]+)"/g)].map(match => match[1]);
let checks = 0;
async function check(name, run) {
  try { await run(); checks++; console.log(`ok ${checks} - ${name}`); }
  catch (error) { error.message = `${name}: ${error.message}`; throw error; }
}

class EventHost {
  listeners = new Map();
  addEventListener(type, fn, options = {}) {
    if (options.signal?.aborted) return;
    const item = { fn, capture: options === true || !!options.capture, once: !!options.once };
    const list = this.listeners.get(type) || []; list.push(item); this.listeners.set(type, list);
    options.signal?.addEventListener('abort', () => this.removeEventListener(type, fn), { once: true });
  }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item.fn !== fn)); }
  fire(event, capture) {
    for (const item of [...(this.listeners.get(event.type) || [])]) {
      if (capture !== undefined && item.capture !== capture) continue;
      item.fn.call(this, event);
      if (item.once) this.removeEventListener(event.type, item.fn);
    }
  }
  dispatchEvent(event) { event.target ||= this; this.fire(event); return !event.defaultPrevented; }
}
class Element extends EventHost {
  constructor(tag = 'div', owner = null) {
    super(); this.tagName = tag.toUpperCase(); this.ownerDocument = owner;
    this.childNodes = []; this.attributes = {}; this.dataset = {}; this.style = { setProperty() {}, removeProperty() {} };
    this.classList = {
      contains: value => this.className.split(/\s+/).includes(value),
      add: (...values) => this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...values])].join(' '),
      remove: (...values) => this.className = this.className.split(/\s+/).filter(value => !values.includes(value)).join(' '),
      toggle: (value, force) => { const add = force ?? !this.classList.contains(value); this.classList[add ? 'add' : 'remove'](value); return add; },
    };
  }
  get children() { return this.childNodes.filter(child => child instanceof Element); }
  get parentNode() { return this.parentElement; }
  get id() { return this.attributes.id || ''; }
  set id(value) { this.setAttribute('id', value); }
  get className() { return this.attributes.class || ''; }
  set className(value) { this.attributes.class = value; }
  get open() { return this.hasAttribute('open'); }
  set open(value) { value ? this.setAttribute('open', '') : this.removeAttribute('open'); }
  get isConnected() { return !!this.ownerDocument?.contains(this); }
  get textContent() { return this.childNodes.map(node => typeof node === 'string' ? node : node.textContent).join(''); }
  set textContent(value) { this.childNodes = [String(value)]; }
  get href() { return new URL(this.getAttribute('href') || '', this.ownerDocument.baseURI).href; }
  set href(value) { this.setAttribute('href', value); }
  get hash() { return new URL(this.href).hash; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  hasAttribute(name) { return Object.hasOwn(this.attributes, name); }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...children) { for (const child of children) { this.childNodes.push(child); if (child instanceof Element) { child.parentElement = this; child.ownerDocument ||= this.ownerDocument; } } }
  replaceChildren(...children) { this.childNodes = []; this.append(...children); }
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    return selector.split(',').some(part => {
      const pieces = part.trim().split(/\s+(?![^\[]*\])/);
      const simple = pieces.pop();
      if (!this.matchesSimple(simple)) return false;
      let parent = this.parentElement;
      while (pieces.length) {
        const previous = pieces.pop();
        if (previous === '>') { if (!parent?.matchesSimple(pieces.pop())) return false; parent = parent.parentElement; continue; }
        while (parent && !parent.matchesSimple(previous)) parent = parent.parentElement;
        if (!parent) return false;
        parent = parent.parentElement;
      }
      return true;
    });
  }
  matchesSimple(selector) {
    if (!selector) return false;
    const exclusions = [...selector.matchAll(/:not\(([^)]+)\)/g)].map(match => match[1]);
    if (exclusions.some(excluded => this.matchesSimple(excluded))) return false;
    selector = selector.replace(/:not\([^)]+\)/g, '');
    const structural = selector.replace(/\[[^\]]+\]/g, '');
    const tag = /^[\w-]+/.exec(structural)?.[0];
    if (tag && this.tagName !== tag.toUpperCase()) return false;
    for (const [, id] of structural.matchAll(/#([\w-]+)/g)) if (this.id !== id) return false;
    for (const [, cls] of structural.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(cls)) return false;
    for (const [, attr, operator, value] of selector.matchAll(/\[([\w-]+)(?:([*^$]?=)["']?([^\]"']*)["']?)?\]/g)) {
      const actual = this.getAttribute(attr); if (actual === null) return false;
      if (operator === '=' && actual !== value || operator === '^=' && !actual.startsWith(value) || operator === '$=' && !actual.endsWith(value) || operator === '*=' && !actual.includes(value)) return false;
    }
    return true;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  set innerHTML(html) {
    this.rawHTML = html; this.childNodes = []; const stack = [this];
    for (const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[\w-]+(?:\s[^<>]*?)?\s*\/?\s*>|[^<]+/g)) {
      const token = match[0];
      if (token.startsWith('<!')) continue;
      if (!token.startsWith('<')) { stack.at(-1).append(decode(token)); continue; }
      const tag = /^<\/?([\w-]+)/.exec(token)[1].toLowerCase();
      if (token.startsWith('</')) { while (stack.length > 1 && stack.pop().tagName !== tag.toUpperCase()) {} continue; }
      const node = new Element(tag, this.ownerDocument);
      const attrs = token.slice(tag.length + 1, token.length - 1);
      for (const attr of attrs.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) node.setAttribute(attr[1], decode(attr[2] ?? attr[3] ?? attr[4] ?? ''));
      stack.at(-1).append(node);
      if (!['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'].includes(tag) && !token.endsWith('/>')) stack.push(node);
    }
  }
  get innerHTML() { return this.rawHTML || ''; }
  getBoundingClientRect() { return this.box || { top: 100, bottom: 800, left: 0, right: 900, width: 900, height: 700 }; }
  scrollIntoView(options) { this.scrolls ||= []; this.scrolls.push(options); }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; }
  close() { this.open = false; this.dispatchEvent({ type: 'close' }); }
}

async function render(key, { studio = false, hash = '', embedded = false, legacy = false } = {}) {
  const page = studio ? 'project-3d.html' : 'case-study.html';
  const location = new URL(`https://portfolio.test/${page}${legacy ? '' : `?project=${key}${embedded ? '&studioFrame=1' : ''}`}${legacy ? `#${key}` : hash}`);
  const document = new Element('document'); document.ownerDocument = document; document.baseURI = location.href;
  document.innerHTML = pages[page]; document.body = document.querySelector('body');
  document.getElementById = id => document.querySelectorAll('[id]').find(node => node.id === id) || null;
  document.createElement = tag => new Element(tag, document);
  const window = new EventHost(); const messages = [], frames = new Map(), timers = new Map(), historyChanges = [];
  window.scrollY = 0; window.innerHeight = 900; window.innerWidth = 1280; window.location = location;
  window.scrollTo = options => { window.scrollY = options.top; };
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.parent = embedded ? { postMessage(message, origin) { messages.push({ ...plain(message), origin }); } } : window;
  const history = {
    state: { retained: 'state' },
    replaceState(state, unused, url) { this.state = state; location.href = String(url); historyChanges.push(['replace', location.href]); },
    pushState() { assert.fail('Case rendering/opening records must not create a history entry'); },
  };
  let handle = 0;
  const context = vm.createContext({ window, document, location, history, console, URL, URLSearchParams, AbortController,
    innerHeight: 900, innerWidth: 1280, HTMLElement: Element, HTMLImageElement: Element,
    Event: class { constructor(type) { this.type = type; } },
    CustomEvent: class { constructor(type, options = {}) { this.type = type; Object.assign(this, options); } },
    Image: class extends Element { constructor() { super('img', document); } },
    requestAnimationFrame(fn) { const id = ++handle; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
    setTimeout(fn, delay) { const id = ++handle; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    fetch: async url => { assert.equal(url.split('?')[0], coverPath); return { ok: true, json: async () => coverCatalog }; },
  });
  Object.assign(window, { requestAnimationFrame: context.requestAnimationFrame, cancelAnimationFrame: context.cancelAnimationFrame });
  for (const file of files) vm.runInContext(sources[file], context, { filename: file });
  if (embedded) vm.runInContext(bridge, context, { filename: 'studio-project-bridge.js' });
  await vm.runInContext(renderer, context, { filename: 'case-study.js' });
  function flush() { for (let i = 0; frames.size && i < 10; i++) { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(0)); } assert.equal(frames.size, 0, 'No continuous renderer loop'); }
  flush();
  function click(node, options = {}) {
    assert(node, 'Click target exists');
    const event = { type: 'click', target: node, button: 0, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...options };
    const path = []; for (let p = node; p; p = p.parentElement) path.push(p);
    [...path].reverse().forEach(p => p.fire(event, true)); path.forEach(p => p.fire(event, false));
    flush(); return event;
  }
  return { document, window, location, history, historyChanges, messages, context, flush, click,
    root: document.getElementById('case-main'),
    hash(value) { location.hash = value; window.dispatchEvent({ type: 'hashchange' }); flush(); },
    receive(url) { window.dispatchEvent({ type: 'message', origin: location.origin, source: window.parent,
      data: { protocol: 'kw-studio-project-v1', type: 'location', url } }); flush(); },
  };
}
function content(node) { assert(node, 'Required content node exists'); return normalize(node.textContent); }
function containsText(node, text, label = text) { assert(content(node).includes(normalize(text)), `Missing ${label}`); }
function galleryFor(key) { return [...(current.projectData[key].gallery || []), ...(current.caseStudySupplements[key]?.gallery || [])]; }

await check('16 projects / 64 chapter archives preserve the exact baseline paragraphs and all other data', () => {
  assert.equal(keys.length, 16); let chapterCount = 0; let paragraphCount = 0;
  assert.deepEqual(Object.keys(current.caseStudyData), keys);
  assert.equal(homepageOrder.length, 16);
  assert.deepEqual([...homepageOrder].sort(), [...keys].sort());
  for (const key of keys) {
    const before = original.caseStudyData[key]; const after = plain(current.caseStudyData[key]);
    const position = homepageOrder.indexOf(key);
    assert.equal(after.number, String(position + 1).padStart(2, '0'), `${key}: case number follows homepage`);
    assert.equal(after.next, homepageOrder[(position + 1) % homepageOrder.length], `${key}: next route follows homepage`);
    assert.deepEqual(after.summary.map(([label]) => label), ['My role', 'Result', 'Status'], `${key}: first-screen summary labels`);
    after.number = before.number; after.next = before.next;
    assert.equal(after.chapters.length, before.chapters.length, key);
    for (const [index, chapter] of after.chapters.entries()) {
      chapterCount++; const old = before.chapters[index];
      paragraphCount += old.paragraphs.length;
      assert.deepEqual(chapter.detailParagraphs, old.paragraphs, `${key}/${old.id}: verbatim engineering archive`);
      assert(chapter.paragraphs.length >= 1 && chapter.paragraphs.length <= 2, `${key}/${old.id}: one or two compact paragraphs`);
      assert(chapter.paragraphs.every(text => typeof text === 'string' && text.trim()), `${key}/${old.id}: no empty reading copy`);
      assert(chapter.paragraphs.join(' ').length < old.paragraphs.join(' ').length, `${key}/${old.id}: first reading is shorter`);
      chapter.title = old.title; chapter.paragraphs = old.paragraphs; delete chapter.detailParagraphs;
    }
    assert.deepEqual(after, before, `${key}: identities, labels, summaries, engineering checks, notes, images, covers, downloads and next route`);
  }
  assert.equal(chapterCount, 64);
  assert.equal(paragraphCount, 131);
  for (const name of ['projectData', 'caseStudySupplements', 'caseStudyMedia']) assert.deepEqual(current[name], original[name], `${name} preserved in full`);
});

await check('Original cover catalog and tracked model / scientific-image / animation assets are untouched', async () => {
  assert.deepEqual(JSON.parse(await read('assets/editorial/animation-covers.json')), JSON.parse(git('cat-file', 'blob', `${baseline}:assets/editorial/animation-covers.json`)));
  const changed = git('diff', '--no-ext-diff', '--name-only', '-z', baseline, '--', 'models', 'assets').split('\0').filter(Boolean);
  const presentationAssets = name => name.startsWith('assets/exploded/white-20261011/') ||
    name.startsWith('assets/editorial/white-20261011/') ||
    ['assets/hero-fsae-20261013/subject-mask.svg', 'assets/hero-fsae-20261013/provenance.json'].includes(name) ||
    ['assets/hero-fsae-context-20261013/context-mask.svg', 'assets/hero-fsae-context-20261013/provenance.json'].includes(name) ||
    ['assets/exploded/manifest-white-20261011.json', 'assets/exploded/manifest-detail-white-20261011.json'].includes(name) ||
    // 2026-10-22: corrected public résumé, its desk preview, and new dated presentation variants.
    ['assets/kefan-wu-resume.pdf', 'assets/resume/manifest.json', 'assets/resume/resume.bcce93bcc67b1ae9.webp'].includes(name) ||
    ['assets/exploded/manifest-white-20261022.json', 'assets/exploded/manifest-detail-white-20261022.json'].includes(name) ||
    ['assets/editorial/white-20261022/', 'assets/method-20261022/', 'assets/og/', 'assets/hero-fsae-context-20261022/',
      'assets/studio-teaser-20261022/', 'models/baked/lowtier-20261022/',
      'assets/exploded/aura-reframe-20261022/', 'assets/editorial/aura-reframe-20261022/'].some(prefix => name.startsWith(prefix));
  assert.deepEqual(changed.filter(name => !presentationAssets(name)), [], 'Original source geometry, scientific figures and immutable assets remain unchanged');
});

const rendered = new Map();
for (const key of keys) {
  await check(`${key}: both modes render compact chapters and complete original evidence`, async () => {
    const main = await render(key); const studio = await render(key, { studio: true }); rendered.set(key, { main, studio });
    const editorial = current.caseStudyData[key], project = original.projectData[key], supplement = original.caseStudySupplements[key] || {};
    for (const h of [main, studio]) {
      const ids = h.root.querySelectorAll('[id]').map(node => node.id);
      assert.equal(new Set(ids).size, ids.length, 'No duplicate content IDs');
      for (const chapter of editorial.chapters) {
        const section = h.document.getElementById(chapter.id);
        assert.equal(content(section.querySelector('h2')), normalize(chapter.title));
        const copy = section.querySelector('.chapter-copy');
        const paragraphs = copy.querySelectorAll('p').filter(node => !node.classList.contains('eyebrow'));
        assert.deepEqual(paragraphs.map(content), chapter.paragraphs.map(normalize), `${key}/${chapter.id}: compact paragraphs`);
        assert(paragraphs[0].classList.contains('chapter-lead'), `${key}/${chapter.id}: conclusion lead`);
        const record = h.document.getElementById(`record-chapter-${chapter.id}`);
        assert.equal(record.tagName, 'DETAILS'); assert.equal(record.open, false);
        assert(h.document.getElementById('record').contains(record));
        assert.deepEqual(record.querySelectorAll('p').map(content), chapter.detailParagraphs.map(normalize), `${key}/${chapter.id}: complete reading depth`);
        assert(section.querySelector(`a[href="#record-chapter-${chapter.id}"]`), `${key}/${chapter.id}: reachable full record`);
      }
      for (const [, text] of editorial.summary) containsText(h.root.querySelector('.case-summary'), text);
      containsText(h.document.getElementById('brief'), editorial.engineering.goal);
      editorial.engineering.constraints.forEach(text => containsText(h.document.getElementById('brief'), text));
      const table = h.root.querySelector('.verification-table'); assert.equal(table.tagName, 'TABLE');
      const rows = table.querySelectorAll('tbody tr'); assert.equal(rows.length, editorial.engineering.checks.length);
      for (const [index, row] of rows.entries()) {
        const cells = row.children; assert.equal(cells.length, 3); assert.equal(cells[0].getAttribute('scope'), 'row');
        const [criterion, method, finding, basis] = editorial.engineering.checks[index];
        containsText(cells[0], criterion); containsText(cells[1], method); containsText(cells[2], finding); containsText(cells[2], basis);
        assert(cells[1].getAttribute('data-label') || cells[1].querySelector('.verification-cell-label'), 'Mobile method label');
        assert(cells[2].getAttribute('data-label') || cells[2].querySelector('.verification-cell-label'), 'Mobile finding label');
      }
      containsText(h.document.getElementById('verification'), editorial.engineering.iteration);
      const record = h.document.getElementById('record');
      containsText(record, project.summary); (project.highlights || []).forEach(text => containsText(record, text));
      for (const detail of project.details || []) { containsText(record, detail.title); detail.points.forEach(text => containsText(record, text)); }
      (project.tools || []).forEach(text => containsText(record, text));
      for (const section of supplement.sections || []) { const node = h.document.getElementById(section.id); containsText(node, section.title); for (const item of section.items) { containsText(node, item.label); containsText(node, item.value); } }
      for (const [label, value] of [...(project.spec?.meta || []), ...(project.spec?.stats || [])]) { containsText(record, label); containsText(record, value); }
      for (const download of [...(project.downloads || []), ...(editorial.downloads || [])]) { const link = record.querySelectorAll('a').find(a => a.getAttribute('href') === download.href); assert(link?.hasAttribute('download')); containsText(link, download.label); }
      for (const source of project.sources || []) { const link = record.querySelectorAll('a').find(a => a.getAttribute('href') === source.href); assert(link); containsText(link, source.label); }
      if (supplement.bom) {
        const rows = h.root.querySelectorAll('.bom-table tbody tr'); assert.equal(rows.length, supplement.bom.rows.length);
        supplement.bom.rows.forEach((row, index) => [row.component, row.note, row.quantity, row.status].filter(value => value !== undefined).forEach(value => containsText(rows[index], value)));
      }
      for (const link of h.root.querySelectorAll('a[href^="#"]')) assert(h.document.getElementById(decodeURIComponent(link.hash.slice(1))), `Broken anchor ${link.hash}`);
      const hero = h.root.querySelector('.case-hero'); for (const hash of ['#brief', '#verification', '#motion']) assert(hero.querySelector(`a[href="${hash}"]`), `Early ${hash} shortcut`);
      assert(h.root.innerHTML.indexOf('class="case-reading-actions"') < h.root.innerHTML.indexOf('id="motion"'), 'Reading shortcuts precede pinned model');
      const next = h.root.querySelector('.next-link'); assert.equal(new URL(next.href).searchParams.get('project'), editorial.next);
    }
    for (const selector of ['.case-summary', '#brief', '.chapter', '#verification', '#evidence', '#record', '#bom']) assert.deepEqual(main.root.querySelectorAll(selector).map(content), studio.root.querySelectorAll(selector).map(content), `${key}: identical ${selector} in both modes`);
  });
}

await check('Scientific figures receive wide chapters; photo / CAD pairs and the original formula stay distinct', () => {
  let wideCount = 0, pairedCount = 0;
  for (const key of keys) for (const h of Object.values(rendered.get(key))) {
    const gallery = galleryFor(key); const supplement = current.caseStudySupplements[key] || {};
    for (const chapter of current.caseStudyData[key].chapters) {
      const section = h.document.getElementById(chapter.id); const figure = section.querySelector('.chapter-figure');
      if (!figure) continue; // Previously used source images remain deduplicated.
      const replacement = supplement.chapterImages?.[chapter.id];
      const expectedIndex = replacement ? gallery.findIndex(image => image.src === replacement.src) : chapter.image;
      const button = figure.querySelector('[data-image]'); assert.equal(Number(button.dataset.image), expectedIndex);
      const image = gallery[expectedIndex]; const metadata = supplement.media?.[image.src] || current.caseStudyMedia[image.src] || {};
      const displayed = figure.querySelector('img');
      assert.equal(displayed.getAttribute('src'), metadata.src || image.thumbnail || image.src, 'Uses the same existing image');
      assert.equal(displayed.getAttribute('alt'), metadata.alt || image.alt, 'Preserves source description');
      containsText(figure, replacement?.evidence || chapter.evidence); containsText(figure, replacement?.note || chapter.note);
      if (metadata.kind === 'plot' || metadata.kind === 'document') { wideCount++; assert(section.classList.contains('chapter-wide'), `${key}/${chapter.id}: readable scientific/document figure`); }
      if (metadata.kind === 'photo' || metadata.kind === 'cad') { pairedCount++; assert(!section.classList.contains('chapter-wide') && !section.classList.contains('chapter-equation'), `${key}/${chapter.id}: original paired presentation`); }
    }
  }
  assert(wideCount > 0 && pairedCount > 0);
  for (const h of Object.values(rendered.get('brakeSim'))) assert(h.document.getElementById('decisions').classList.contains('chapter-equation'), 'Wide, short thermal equation uses compact figure treatment');
});

await check('All original gallery items remain accessible through lightbox navigation in both modes', () => {
  let references = 0;
  for (const key of keys) {
    const gallery = galleryFor(key); references += gallery.length;
    for (const h of Object.values(rendered.get(key))) {
      const button = h.root.querySelector('[data-image]'); assert(button, key);
      h.click(button); const start = Number(button.dataset.image);
      for (let offset = 0; offset < gallery.length; offset++) {
        const index = (start + offset) % gallery.length; const image = gallery[index];
        assert.equal(h.document.getElementById('lightbox-original').getAttribute('href'), image.src);
        assert.equal(content(h.document.getElementById('lightbox-title')), normalize(image.caption || image.alt));
        h.click(h.document.getElementById('lightbox-next'));
      }
      h.click(h.document.getElementById('lightbox-close'));
      assert.equal(h.document.activeElement, button, 'Gallery close restores the opener focus');
    }
  }
  assert.equal(references, 100);
});

await check('Archive links, initial deep links, hash changes, and retained-studio restoration open their records', async () => {
  for (const key of keys) for (const studio of [false, true]) {
    const h = rendered.get(key)[studio ? 'studio' : 'main'];
    for (const chapter of current.caseStudyData[key].chapters) {
      const hash = `#record-chapter-${chapter.id}`; const target = h.document.getElementById(hash.slice(1));
      const event = h.click(h.document.getElementById(chapter.id).querySelector(`a[href="${hash}"]`));
      assert(target.open, `${key}/${chapter.id}: click opens archive`);
      assert.equal(event.defaultPrevented, false, 'Standalone anchor retains native browser navigation');
      target.open = false; h.hash(hash); assert(target.open, 'Hash change opens archive'); target.open = false;
    }
    assert.equal(h.historyChanges.length, 0, 'Opening records does not rewrite standalone history');
    const firstHash = `#record-chapter-${current.caseStudyData[key].chapters[0].id}`;
    const initial = await render(key, { studio, hash: firstHash });
    assert(initial.document.getElementById(firstHash.slice(1)).open, `${key}: initial archive hash opens`);
  }
  const h = await render('steering', { studio: true, embedded: true });
  const chapter = current.caseStudyData.steering.chapters[0]; const hash = `#record-chapter-${chapter.id}`;
  const target = h.document.getElementById(hash.slice(1));
  const event = h.click(h.document.getElementById(chapter.id).querySelector(`a[href="${hash}"]`));
  assert(event.defaultPrevented, 'Retained frame bridge owns navigation');
  assert.equal(h.messages.at(-1).type, 'navigate'); assert(h.messages.at(-1).url.endsWith(hash));
  h.receive(h.messages.at(-1).url);
  assert(target.open, 'Delegated studio navigation opens target when parent applies the location');
  target.open = false;
  h.receive(`https://portfolio.test/project-3d.html?project=steering${hash}`);
  assert(target.open, 'Parent-driven Back/Forward restoration opens archived detail');
  assert.equal(h.history.state.retained, 'state');
  const legacy = await render('steering', { studio: true, legacy: true });
  assert.equal(legacy.location.searchParams.get('project'), 'steering'); assert.equal(legacy.location.hash, '');
});

console.log(`Passed ${checks} readability groups: 16 projects, 64 verbatim chapter archives, both page modes, 100 gallery references, and native / retained navigation. CSS geometry requires the separate browser checks.`);
