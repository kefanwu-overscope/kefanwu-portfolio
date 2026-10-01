import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const [source, notesSource, frameSource] = await Promise.all([
  readFile(new URL('../../project-motion-story.js', import.meta.url), 'utf8'),
  readFile(new URL('../../project-motion-notes.js', import.meta.url), 'utf8'),
  readFile(new URL('../../exploded.js', import.meta.url), 'utf8'),
]);

class Element {
  constructor() {
    this.listeners = new Map(); this.attributes = new Map(); this.children = []; this.dataset = {};
    this.selectors = new Map(); this.properties = new Map(); this.textContent = ''; this.value = '';
    this.style = { setProperty: (key, value) => this.properties.set(key, value) };
    const classes = new Set();
    this.classList = { add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)), contains: value => classes.has(value),
      toggle(value, enabled) { if (enabled ?? !classes.has(value)) classes.add(value); else classes.delete(value); } };
  }
  addEventListener(type, listener, options = {}) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    options.signal?.addEventListener('abort', () => this.removeEventListener(type, listener));
    this.lastOptions = { ...(this.lastOptions || {}), [type]: options };
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
    return !event.defaultPrevented;
  }
  emit(type, detail, other = {}) { this.dispatchEvent({ type, detail, ...other }); }
  querySelector(selector) { return this.selectors.get(selector) || null; }
  querySelectorAll() { return []; }
  append(...children) { this.children.push(...children); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}

function setup({ reducedMotion = false, scroll = 909, width = 1280, height = 900,
  project = 'steering', storyTop = 1000, mediaHeight = 300 } = {}) {
  const window = new Element(), document = new Element(), reduced = new Element();
  document.hidden = false; window.scrollY = scroll; reduced.matches = reducedMotion;
  const story = new Element(), host = new Element(), pin = new Element(), media = new Element();
  story.dataset.motionProject = project;
  const nodes = Object.fromEntries([
    '#preview-title', '.motion-note-body', '.motion-step-count', '.motion-evidence-note',
    '.motion-step-buttons', '#motion-story-progress', '.motion-story-timeline output',
    '.motion-explore', '#preview-instructions',
  ].map(selector => [selector, new Element()]));
  for (const [selector, node] of Object.entries(nodes)) story.selectors.set(selector, node);
  story.selectors.set('.case-animation-host', host); story.selectors.set('.case-motion-pin', pin);
  host.selectors.set('.card-media', media);
  const header = new Element(); header.getBoundingClientRect = () => ({ height: 77 });
  document.selectors.set('.site-header', header);
  document.createElement = () => new Element();
  const geometry = { top: storyTop, mediaHeight, pinHeight: 540 };
  story.getBoundingClientRect = () => ({ top: geometry.top - window.scrollY });
  media.getBoundingClientRect = () => ({ height: geometry.mediaHeight });
  pin.getBoundingClientRect = () => {
    const natural = geometry.top - window.scrollY;
    const stickyTop = Number.parseFloat(story.properties.get('--story-top') || 91);
    const travel = Number.parseFloat(story.properties.get('--story-travel') || 1200);
    const top = reduced.matches || story.classList.contains('is-unpinned') ? natural : Math.min(Math.max(natural, stickyTop), natural + travel);
    return { top, bottom: top + geometry.pinHeight, height: geometry.pinHeight };
  };
  const frames = new Map(), requests = [], modes = [], scrolls = [], intersections = [], resizes = [];
  let frameID = 0, time = 0;
  window.scrollTo = options => { scrolls.push(options); window.scrollY = options.top; window.emit('scroll'); };
  host.addEventListener('case-motion-request', event => requests.push(event.detail));
  host.addEventListener('case-motion-mode', event => modes.push(event.detail));
  const context = {
    window, document, innerWidth: width, innerHeight: height,
    matchMedia: () => reduced,
    AbortController: class {
      constructor() { this.signal = new Element(); }
      abort() { this.signal.emit('abort'); }
    },
    CustomEvent: class { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } },
    requestAnimationFrame: callback => { const id = ++frameID; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; intersections.push(this); }
      observe(element) { this.element = element; }
      disconnect() { this.disconnected = true; }
    },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; resizes.push(this); }
      observe(element) { this.element = element; }
      disconnect() { this.disconnected = true; }
    },
  };
  const runnable = `${notesSource.replace(/^export /gm, '')}\n${source.replace(/^import[^\n]+\n/, '').replace(/^export /gm, '')}\n` +
    'globalThis.attach = attachMotionStory; globalThis.notes = projectMotionNotes;';
  vm.runInNewContext(runnable, context);
  const controller = context.attach(story);
  const app = { window, document, story, host, pin, nodes, frames, requests, modes, scrolls, geometry,
    controller, context, notes: context.notes[project], intersections, resizes,
    tick() { time += 17; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)); },
    drain() { for (let i = 0; frames.size && i < 120; i++) this.tick(); assert.equal(frames.size, 0, 'Easing must settle without continuous polling'); },
    scrollToProgress(progress) {
      const { start, travel } = controller.getState(); window.scrollY = start + progress * travel; window.emit('scroll');
    },
    show(progress) { host.emit('case-motion-progress', { progress }); },
    ready() { host.emit('case-motion-ready'); },
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    reduce(value) { reduced.matches = value; reduced.emit('change'); },
    visible(value) { intersections[0].callback([{ isIntersecting: value }]); },
    choose(index) { nodes['.motion-step-buttons'].children[index].emit('click'); },
  };
  app.drain(); requests.length = 0;
  return app;
}

function assertScrollBoundary(app, requested) {
  const { start, travel, target } = app.controller.getState();
  const offset = app.scrolls.at(-1).top - (start + requested * travel);
  assert(offset >= 0 && offset <= 2, `Seek must land at the requested boundary or within two later CSS pixels; got ${offset}`);
  assert(target >= requested && target <= requested + 2 / travel);
}

test('Native scroll eases requested progress while annotations wait for the displayed pose', () => {
  const h = setup();
  assert.equal(h.window.lastOptions.scroll.passive, true);
  assert.equal(h.window.listeners.has('wheel'), false);
  assert.equal(h.host.listeners.has('wheel'), false);
  h.scrollToProgress(.78); h.tick();
  assert(h.requests[0].progress > 0 && h.requests[0].progress < .78);
  assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[0].title);
  assert.equal(h.nodes['.motion-story-timeline output'].value, '0%');
  assert.equal(h.nodes['#motion-story-progress'].value, '780');
  h.show(.5);
  assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[2].title);
  assert.equal(h.nodes['.motion-story-timeline output'].value, '50%');
  assert.match(h.nodes['#motion-story-progress'].getAttribute('aria-valuetext'), /^50 percent/);
  h.drain();
  assert.equal(h.requests.at(-1).progress, .78);
  assert.equal(h.controller.getState().shown, .5);
});

test('Stage buttons and the slider seek by normal document position without claiming an unloaded pose', () => {
  const h = setup();
  h.choose(2);
  assertScrollBoundary(h, .5);
  assert.equal(h.scrolls.at(-1).behavior, 'instant');
  assert.equal(h.controller.getState().shown, 0);
  h.nodes['#motion-story-progress'].value = '910'; h.nodes['#motion-story-progress'].emit('input'); h.drain();
  assertScrollBoundary(h, .91);
  assert.equal(h.requests.at(-1).progress, h.controller.getState().target);
  assert.equal(h.controller.getState().shown, 0);
  h.show(.91);
  assert.equal(h.nodes['.motion-step-buttons'].children[3].getAttribute('aria-pressed'), 'true');
});

test('A late engine-ready event replays the current seek even after the scroll easing has settled', () => {
  const h = setup();
  h.scrollToProgress(.83); h.drain();
  const count = h.requests.length;
  h.ready(); h.drain();
  assert(h.requests.length > count);
  assert.equal(h.requests[count].progress, .83); assert.equal(h.requests[count].immediate, true);
  assert.equal(h.controller.getState().shown, 0);
});

test('Reverse scrolling settles at the new target and selects notes from actual reverse playback', () => {
  const h = setup();
  h.scrollToProgress(.9); h.drain(); h.show(.9);
  h.requests.length = 0; h.scrollToProgress(.1); h.tick();
  assert(h.requests[0].progress < .9 && h.requests[0].progress > .1);
  assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[3].title);
  h.show(.21);
  assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[0].title);
  h.drain(); assert(Math.abs(h.requests.at(-1).progress - .1) < 1e-12);
});

test('Reduced motion uses explicit stages without scrolling or intermediate requests', () => {
  const h = setup({ reducedMotion: true });
  h.choose(2);
  assert.equal(h.scrolls.length, 0); assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].progress, .5); assert.equal(h.requests[0].immediate, true);
  assert.equal(h.controller.getState().shown, 0); assert.equal(h.story.style.minHeight, '');
  h.show(.5); h.scrollToProgress(.9); h.drain();
  assert.equal(h.controller.getState().target, .5);
  assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[2].title);
});

test('Reduced-motion changes settle an in-flight guide and keep explicit seeking available', () => {
  const h = setup();
  h.scrollToProgress(.78); h.tick(); h.reduce(true); h.drain();
  // Removing the tall sticky section can put it above the current viewport.
  // Its explicit request resumes when the now-static preview is visible again.
  h.window.scrollY = 909; h.visible(true); h.drain();
  assert.equal(h.requests.at(-1).progress, .78);
  assert.equal(h.requests.at(-1).immediate, true);
  assert.equal(h.story.style.minHeight, '');
  h.choose(1); assert.equal(h.requests.at(-1).progress, .22);
});

test('Hidden and offscreen guides stop work and replay their position on return', () => {
  const h = setup();
  h.scrollToProgress(.5); h.tick(); h.hidden(true);
  assert.equal(h.frames.size, 0);
  const count = h.requests.length;
  h.scrollToProgress(.75); h.ready(); h.drain();
  assert.equal(h.requests.length, count);
  h.hidden(false); h.drain(); assert.equal(h.requests.at(-1).progress, .75);
  h.visible(false); const before = h.requests.length;
  h.scrollToProgress(.3); h.drain(); assert.equal(h.requests.length, before);
  h.visible(true); h.drain(); assert.equal(h.requests.at(-1).progress, .3);
});

test('Lightbox close replays the same target after the visible frame was reset to its cover', () => {
  const h = setup();
  h.scrollToProgress(.78); h.drain(); h.show(.78);
  h.window.emit('case-lightbox-state', { open: true });
  h.show(0); const count = h.requests.length;
  h.ready(); h.drain(); assert.equal(h.requests.length, count);
  h.window.emit('case-lightbox-state', { open: false }); h.drain();
  assert.equal(h.requests.at(-1).progress, .78); assert.equal(h.requests.at(-1).immediate, true);
  assert.equal(h.controller.getState().shown, 0);
  h.show(.78); assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[3].title);
});

test('Free exploration follows displayed progress and resumes the document-driven guide explicitly', () => {
  const h = setup();
  h.scrollToProgress(.22); h.drain();
  h.nodes['.motion-explore'].emit('click');
  assert.equal(h.controller.getState().free, true); assert.equal(h.modes.at(-1).free, true);
  const count = h.requests.length;
  h.scrollToProgress(.5); h.drain(); assert.equal(h.requests.length, count);
  h.show(.78);
  assert.equal(h.controller.getState().target, .78);
  assert.equal(h.nodes['#motion-story-progress'].value, '780');
  h.nodes['.motion-explore'].emit('click'); h.drain();
  assert.equal(h.controller.getState().free, false); assert.equal(h.modes.at(-1).free, false);
  assertScrollBoundary(h, .78);
  assert.equal(h.requests.at(-1).progress, h.controller.getState().target);
});

test('A named phase seek cannot round to a scroll position just before its fractional boundary', () => {
  const h = setup({ project: 'materialTest', storyTop: 1000.35, mediaHeight: 293.625 });
  const nativeScrollTo = h.window.scrollTo;
  h.window.scrollTo = options => nativeScrollTo({ ...options, top: Math.round(options.top) });
  h.choose(3); h.drain();
  assert.equal(h.notes.steps[3].at, .74);
  assertScrollBoundary(h, .74);
  const shown = h.requests.at(-1).progress;
  assert(shown >= .74);
  h.show(shown);
  assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[3].title);
  assert.equal(h.nodes['.motion-step-buttons'].children[3].getAttribute('aria-pressed'), 'true');
});

test('Offline stage buttons choose a decoded-frame position at or after the named phase', () => {
  for (const reducedMotion of [false, true]) {
    const h = setup({ project: 'materialTest', reducedMotion, storyTop: 1000.35, mediaHeight: 293.625 });
    h.host.dataset.motionFrames = '145';
    h.choose(3); h.drain();
    const frame = Math.ceil(.74 * 144), position = frame / 144;
    if (!reducedMotion) assertScrollBoundary(h, position);
    else { assert.equal(h.scrolls.length, 0); assert.equal(h.requests.at(-1).progress, position); }
    const decoded = Math.round(h.requests.at(-1).progress * 144) / 144;
    assert.equal(decoded, position); assert(decoded >= .74);
    h.show(decoded);
    assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[3].title);
  }
});

test('BFCache suspension preserves the guide and restoration resends the current pose request', () => {
  const h = setup();
  h.scrollToProgress(.5); h.drain(); h.show(.5);
  h.window.emit('pagehide', undefined, { persisted: true });
  const count = h.requests.length;
  h.scrollToProgress(.78); h.ready(); h.drain();
  assert.equal(h.controller.getState().suspended, true); assert.equal(h.requests.length, count);
  h.window.emit('pageshow', undefined, { persisted: true }); h.drain();
  assert.equal(h.controller.getState().suspended, false);
  assert.equal(h.requests.at(-1).progress, .78);
  assert.equal(h.controller.getState().shown, .5);
});

test('Disposal cancels observers, listeners and frames so late engine events cannot mutate the guide', () => {
  const h = setup();
  h.scrollToProgress(.78); h.tick();
  h.window.emit('studio-project-dispose');
  const count = h.requests.length, shown = h.controller.getState().shown;
  h.show(.78); h.ready(); h.window.emit('pageshow', undefined, { persisted: true });
  h.scrollToProgress(.2); h.drain();
  assert.equal(h.controller.getState().disposed, true);
  assert.equal(h.controller.getState().shown, shown); assert.equal(h.requests.length, count);
  assert.equal(h.intersections[0].disconnected, true); assert.equal(h.resizes[0].disconnected, true);
  assert.equal(h.context.attach(h.story), null);
});

test('Viewport changes remeasure scroll distance without advancing displayed annotations', () => {
  const h = setup();
  h.scrollToProgress(.5); h.drain(); h.show(.5);
  h.geometry.mediaHeight = 200; h.context.innerWidth = 390; h.window.emit('resize'); h.drain();
  assert.equal(h.controller.getState().travel, 850);
  assert.equal(h.story.properties.get('--story-top'), '85px');
  assert.equal(h.controller.getState().shown, .5);
  assert.equal(h.nodes['#preview-title'].textContent, h.notes.steps[2].title);
});

test('Short viewports use explicit stages without a tall sticky scroll section', () => {
  const h = setup({ width: 844, height: 390 });
  assert.equal(h.story.classList.contains('is-unpinned'), true);
  assert.equal(h.story.style.minHeight, '');
  h.choose(2);
  assert.equal(h.scrolls.length, 0);
  assert.equal(h.requests.at(-1).progress, .5); assert.equal(h.requests.at(-1).immediate, true);
});

test('The actual image renderer republishes an identical cached pose after resetting to its cover', () => {
  const draw = frameSource.slice(frameSource.indexOf('  function draw(state)'), frameSource.indexOf('  function animate(now)'));
  const reset = frameSource.slice(frameSource.indexOf('  function resetState(state'), frameSource.indexOf('  function resetAll()'));
  assert(draw.includes('state.stage.replaceChildren')); assert(reset.includes('state.progress = 0'));
  const stage = new Element(), card = new Element(), range = new Element(), poster = new Element();
  stage.replaceChildren = image => { stage.firstChild = image; };
  range.removeAttribute = name => range.attributes.delete(name);
  const images = Array.from({ length: 101 }, () => ({ ready: true, image: {} }));
  const state = { key: 'steering', config: { mode: 'steering' }, external: true, card, range, stage, poster,
    progress: .78, target: .78, index: -1, owner: 'scroll' };
  const shown = [];
  card.addEventListener('case-motion-progress', event => shown.push(event.detail.progress));
  const context = { cache: new Map([['steering', { frames: images, status: 'ready' }]]), allowed: () => true,
    active: state, stopAnimation() {}, reflectProgress() {},
    CustomEvent: class { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } },
  };
  vm.runInNewContext(`${draw}\n${reset}\nglobalThis.draw = draw; globalThis.reset = resetState;`, context);
  context.draw(state); context.reset(state);
  assert.deepEqual(shown, [.78, 0]);
  state.progress = .78; state.target = .78; context.draw(state);
  assert.equal(stage.firstChild, images[78].image);
  assert.equal(card.classList.contains('is-explode-playing'), true);
  assert.deepEqual(shown, [.78, 0, .78], 'Restoring the same cached pose must restore its actual-progress annotation too');
});
