import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../../studio-navigation.js', import.meta.url), 'utf8');
const protocol = 'kw-studio-project-v1';
const plain = value => JSON.parse(JSON.stringify(value));

class EventHost {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
  }
}

function harness() {
  const window = new EventHost();
  const document = { title: 'Original studio', activeElement: null };
  const location = new URL('https://portfolio.test/experience.html');
  const assigned = [], active = [], disposal = [], frames = [], timers = new Map();
  let nextTimer = 0;
  location.assign = href => assigned.push(href);
  class Element extends EventHost {
    constructor(tag) {
      super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this.inert = false;
      const classes = new Set();
      this.classList = { add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name) };
      if (tag === 'iframe') {
        this.contentWindow = new EventHost();
        this.contentWindow.Event = class { constructor(type) { this.type = type; } };
        this.messages = [];
        this.contentWindow.postMessage = (message, origin) => this.messages.push({ ...plain(message), origin });
        this.contentWindow.addEventListener('studio-project-dispose', () => disposal.push({ frame: this, connected: this.isConnected }));
        frames.push(this);
      }
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    removeAttribute(name) { this.attributes.delete(name); }
    append(...elements) { for (const element of elements) { element.parentElement = this; this.children.push(element); } }
    remove() {
      if (this.parentElement) {
        const siblings = this.parentElement.children;
        siblings.splice(siblings.indexOf(this), 1); this.parentElement = null;
      }
    }
    get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
    focus() { document.activeElement = this; }
    querySelector(selector) {
      for (const child of this.children) {
        if (selector === '[role="status"]' && child.getAttribute('role') === 'status') return child;
        const nested = child.querySelector(selector); if (nested) return nested;
      }
      return null;
    }
  }
  document.body = new Element('body');
  document.createElement = tag => new Element(tag);
  const canvas = new Element('canvas'), hud = new Element('header');
  hud.inert = true; hud.setAttribute('aria-hidden', 'false');
  document.body.append(canvas, hud); document.activeElement = canvas;
  document.getElementById = id => id === 'exp-canvas' ? canvas : null;
  window.projectData = { steering: { title: 'Steering' }, pool: { title: 'Pool robot' }, ftc: { title: 'FTC robotics' } };
  const entries = [
    { url: 'https://portfolio.test/index.html', state: null },
    { url: location.href, state: { existing: 'preserved' } },
  ];
  let cursor = 1;
  const traversals = [];
  const history = {
    get state() { return entries[cursor].state; },
    get length() { return entries.length; },
    pushState(state, title, url) {
      entries.splice(cursor + 1); entries.push({ state: plain(state), url: String(url) });
      cursor++; location.href = String(url);
    },
    replaceState(state, title, url) {
      entries[cursor] = { state: plain(state), url: String(url) }; location.href = String(url);
    },
    go(delta) {
      traversals.push(delta);
      const next = cursor + delta; if (next < 0 || next >= entries.length) return;
      cursor = next; location.href = entries[cursor].url;
      window.dispatchEvent({ type: 'popstate', state: this.state });
    },
  };
  const context = { URL, window, document, location, history, crypto: { randomUUID: () => 'room-session' },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  vm.runInNewContext(`${source.replace(/^export /gm, '')}\nglobalThis.createNavigation = createStudioNavigation;`, context);
  const navigation = context.createNavigation({ onActiveChange: value => active.push(value) });
  const currentFrame = () => frames.filter(frame => frame.isConnected).at(-1) || null;
  function receive(type, detail = {}, overrides = {}) {
    window.dispatchEvent({ type: 'message', origin: location.origin, source: currentFrame()?.contentWindow,
      data: { protocol, type, ...detail }, ...overrides });
  }
  return { window, document, location, history, navigation, entries, traversals, assigned, active, disposal, frames,
    timers, canvas, hud, receive, currentFrame, cursor: () => cursor,
    panel: () => document.body.children.find(element => element.className === 'studio-project-page') };
}

const url = (project, hash = '') => `https://portfolio.test/project-3d.html?project=${project}${hash}`;

test('Initialization preserves the current room entry and refuses unknown projects', () => {
  const h = harness();
  assert.equal(h.entries.length, 2);
  assert.equal(h.history.state.existing, 'preserved');
  assert.equal(h.history.state.studioNavigation.kind, 'room');
  assert.equal(h.navigation.openProject('missing'), false);
  assert.equal(h.currentFrame(), null);
  assert.equal(h.entries.length, 2);
});

test('Project, chapter and next-project entries traverse back to the original room', () => {
  const h = harness();
  assert(h.navigation.openProject('steering'));
  const first = h.currentFrame();
  h.receive('ready');
  h.receive('navigate', { url: url('steering', '#motion'), scrollY: 650 });
  assert.equal(h.currentFrame(), first);
  assert.equal(first.messages.at(-1).url, url('steering', '#motion'));
  h.receive('navigate', { url: url('pool'), scrollY: 880 });
  const second = h.currentFrame();
  assert.notEqual(second, first);
  h.receive('ready');
  h.receive('navigate', { url: url('pool', '#record'), scrollY: 920 });
  assert.equal(h.history.state.studioNavigation.index, 4);
  h.receive('return', { scrollY: 1200 });
  assert.equal(h.traversals.at(-1), -4);
  assert.equal(h.cursor(), 1);
  assert.equal(h.location.pathname, '/experience.html');
  assert.equal(h.navigation.snapshot().open, false);
});

test('Back then branch discards stale forward entries and uses the remaining index', () => {
  const h = harness();
  h.navigation.openProject('steering'); h.receive('ready');
  h.receive('navigate', { url: url('steering', '#motion'), scrollY: 10 });
  h.receive('navigate', { url: url('pool'), scrollY: 30 }); h.receive('ready');
  h.history.go(-1);
  const restored = h.currentFrame(); h.receive('ready');
  assert.equal(restored.messages.at(-1).url, url('steering', '#motion'));
  h.receive('navigate', { url: url('ftc'), scrollY: 40 }); h.receive('ready');
  assert.equal(h.history.state.studioNavigation.index, 3);
  assert.equal(h.entries.some(entry => entry.url === url('pool')), false);
  h.receive('return');
  assert.equal(h.traversals.at(-1), -3);
  assert.equal(h.cursor(), 1);
  h.history.go(1); h.receive('ready');
  assert.equal(h.navigation.snapshot().key, 'steering');
});

test('Frame readiness applies the latest route even when hashes change during loading', () => {
  const h = harness();
  h.navigation.openProject('steering');
  const frame = h.currentFrame();
  h.receive('navigate', { url: url('steering', '#record'), scrollY: 0 });
  assert.equal(frame.messages.length, 0);
  h.receive('ready', { url: url('steering') });
  assert.equal(frame.messages.at(-1).url, url('steering', '#record'));
  assert.equal(h.document.activeElement, frame);
});

test('Repeated chapter activation scrolls again without duplicating browser history', () => {
  const h = harness();
  h.navigation.openProject('steering'); h.receive('ready');
  h.receive('navigate', { url: url('steering', '#motion'), scrollY: 650 });
  h.receive('scroll', { scrollY: 2500 });
  const frame = h.currentFrame(), count = h.entries.length, messages = frame.messages.length;
  h.receive('navigate', { url: url('steering', '#motion'), scrollY: 2500 });
  assert.equal(h.entries.length, count);
  assert.equal(frame.messages.length, messages + 1);
  assert.equal(frame.messages.at(-1).url, url('steering', '#motion'));
  assert.equal(frame.messages.at(-1).scrollY, undefined);
});

test('Explicit return captures the newest scroll position for Forward restoration', () => {
  const h = harness();
  h.navigation.openProject('steering'); h.receive('ready');
  h.receive('scroll', { scrollY: 650 });
  h.receive('return', { scrollY: 987 });
  h.history.go(1); h.receive('ready');
  assert.equal(h.currentFrame().messages.at(-1).scrollY, 987);
});

test('Removed frames receive synchronous cleanup before becoming disconnected', () => {
  const h = harness();
  h.navigation.openProject('steering'); h.receive('ready');
  const frame = h.currentFrame();
  h.receive('navigate', { url: url('pool'), scrollY: 0 });
  assert.equal(h.disposal.length, 1);
  assert.equal(h.disposal[0].frame, frame);
  assert.equal(h.disposal[0].connected, true);
  assert.equal(frame.isConnected, false);
  h.receive('return');
  assert.equal(h.disposal.length, 2);
  assert(h.disposal.every(event => event.connected));
});

test('Room accessibility state and focus are restored after project return', () => {
  const h = harness();
  h.navigation.openProject('steering');
  assert.equal(h.canvas.inert, true);
  assert.equal(h.canvas.getAttribute('aria-hidden'), 'true');
  assert.equal(h.hud.inert, true);
  assert.equal(h.document.activeElement.tagName, 'button');
  h.receive('ready'); h.receive('title', { title: 'Project title' }); h.receive('return');
  assert.equal(h.canvas.inert, false);
  assert.equal(h.canvas.getAttribute('aria-hidden'), null);
  assert.equal(h.hud.inert, true);
  assert.equal(h.hud.getAttribute('aria-hidden'), 'false');
  assert.equal(h.document.activeElement, h.canvas);
  assert.equal(h.document.title, 'Original studio');
  assert.deepEqual(h.active, [true, false]);
});

test('A failed frame keeps a keyboard-accessible return button and can recover on ready', () => {
  const h = harness();
  h.navigation.openProject('steering');
  const timer = [...h.timers.values()][0];
  assert.equal(timer.delay, 15000); timer.callback();
  assert(h.panel().classList.contains('has-error'));
  assert.match(h.panel().querySelector('[role="status"]').textContent, /return to the studio/);
  assert.equal(h.document.activeElement.tagName, 'button');
  h.receive('ready');
  assert.equal(h.panel().classList.contains('has-error'), false);
  assert(h.panel().classList.contains('is-ready'));
  h.receive('return');
  assert.equal(h.currentFrame(), null);
});

test('Origin, source, protocol and stale-frame checks guard history and navigation', () => {
  const h = harness();
  h.navigation.openProject('steering'); h.receive('ready');
  const old = h.currentFrame();
  h.receive('navigate', { url: url('pool') }); h.receive('ready');
  const before = h.entries.length;
  for (const overrides of [
    { origin: 'https://external.test' }, { source: {} }, { source: old.contentWindow },
    { data: { protocol: 'untrusted', type: 'navigate', url: url('ftc') } },
  ]) h.receive('navigate', { url: url('ftc') }, overrides);
  assert.equal(h.entries.length, before);
  assert.equal(h.navigation.snapshot().key, 'pool');
  for (const unsafe of ['javascript:alert(1)', 'data:text/html,unsafe']) h.receive('leave', { url: unsafe });
  assert.equal(h.assigned.length, 0);
  h.receive('leave', { url: 'https://example.org/project' });
  assert.deepEqual(h.assigned, ['https://example.org/project']);
});

test('Dispose releases the open frame and prevents later child messages from acting', () => {
  const h = harness();
  h.navigation.openProject('steering'); h.receive('ready');
  const child = h.currentFrame().contentWindow;
  h.navigation.dispose();
  assert.equal(h.currentFrame(), null);
  assert.equal(h.canvas.inert, false);
  h.receive('leave', { url: 'https://example.org' }, { source: child });
  assert.equal(h.assigned.length, 0);
  assert.equal(h.timers.size, 0);
});
