import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../../project-case-3d.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]+\n/, '')
  .replace("import('./studio-inspector.js?v=performance-20260919')", 'loadInspectorModule()');

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = new Map();
    this.textContent = ''; this.hidden = false; this.disabled = false; this.value = ''; this.style = { setProperty() {} };
    this.classList = { add: value => { this.className = `${this.className || ''} ${value}`.trim(); } };
  }
  append(...children) { for (const child of children) { this.children.push(child); child.parentElement = this; } }
  after(...children) { const siblings = this.parentElement.children; siblings.splice(siblings.indexOf(this) + 1, 0, ...children); children.forEach(child => child.parentElement = this.parentElement); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'class') this.className = String(value); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, fn, options = {}) {
    const listeners = this.listeners.get(type) || new Set(); listeners.add(fn); this.listeners.set(type, listeners);
    options.signal?.addEventListener('abort', () => listeners.delete(fn), { once: true });
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type, props = {}) {
    const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    for (const fn of [...(this.listeners.get(type) || [])]) fn(event);
    return event;
  }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return (this.className || '').split(' ').includes(selector.slice(1).split('[')[0]);
    return this.tagName === selector.toUpperCase();
  }
  querySelector(selector) { for (const child of this.children) { if (child.matches(selector)) return child; const nested = child.querySelector(selector); if (nested) return nested; } return null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  getBoundingClientRect() { return this.box || { top: 10, bottom: 410, left: 10, right: 650, width: 640, height: 400 }; }
  set innerHTML(html) {
    this.children = []; const stack = [this];
    for (const tag of html.matchAll(/<\/?[\w-]+[^>]*>/g)) {
      if (tag[0].startsWith('</')) { stack.pop(); continue; }
      const name = /^<([\w-]+)/.exec(tag[0])[1]; const node = new Element(name);
      for (const attr of tag[0].matchAll(/([\w-]+)="([^"]*)"/g)) { node.setAttribute(attr[1], attr[2]); if (attr[1] === 'value') node.value = attr[2]; }
      node.disabled = /\sdisabled[\s>]/.test(tag[0]); node.hidden = /\shidden[\s>]/.test(tag[0]);
      stack.at(-1).append(node); if (!['input', 'img', 'br'].includes(name)) stack.push(node);
    }
  }
}

async function setup({ offscreen = false, deferredImport = false } = {}) {
  const window = new Element(); const document = new Element(); document.hidden = false;
  document.body = new Element('body'); document.body.dataset = { caseMode: 'studio', project: 'steering' };
  const host = new Element(); host.className = 'case-animation-host'; host.dataset.project = 'steering';
  const viewport = new Element(); viewport.className = 'card-media';
  if (offscreen) viewport.box = { top: -800, bottom: -400, left: 10, right: 650, width: 640, height: 400 };
  host.append(viewport); document.body.append(host); document.append(document.body); viewport.append(new Element('img'));
  document.createElement = tag => new Element(tag);
  window.innerHeight = 900; window.innerWidth = 1400;
  const frames = new Map(); let frameID = 0; let clock = 0; let intersection; let importResolve;
  const raf = fn => { const id = ++frameID; frames.set(id, fn); return id; };
  const inspectors = [];
  function createStudioInspector(callbacks) {
    const state = { key: 'steering', renderedFrames: 0, active: true, motionReady: false, playing: false, direction: 1, progress: 0 };
    let selectedResolve; let disposed = false;
    const draw = () => { if (state.active && !disposed && !document.hidden) state.renderedFrames++; };
    const api = {
      callbacks, state, disposeCount: 0, retryCount: 0, signal: null,
      getState: () => state,
      async selectProject(key, { signal }) {
        api.signal = signal; callbacks.onStatus({ key, state: 'loading' });
        return new Promise(resolve => { selectedResolve = resolve; signal.addEventListener('abort', () => resolve(null), { once: true }); });
      },
      ready(motionReady = false, motionError = false) {
        state.motionReady = motionReady; callbacks.onStatus({ key: 'steering', state: 'ready', motionReady, motionError });
        raf(() => { callbacks.onProgress(state.progress); draw(); }); selectedResolve?.({ key: 'steering' });
      },
      setActive(active) { state.active = active; if (!active) api.pause(); else raf(draw); },
      setProgress(progress) { state.progress = progress; callbacks.onProgress(progress); if (state.active) raf(draw); },
      play({ direction }) { if (!state.active || !state.motionReady) return; state.playing = true; state.direction = direction; callbacks.onPlaybackChange(state); },
      pause() { state.playing = false; callbacks.onPlaybackChange(state); },
      reset() { api.pause(); api.setProgress(0); },
      setView() {},
      retryMotion() { api.retryCount++; callbacks.onStatus({ state: 'ready', motionReady: false }); },
      dispose() { api.disposeCount++; disposed = true; },
    };
    inspectors.push(api); return api;
  }
  const module = { createStudioInspector };
  const context = {
    window, document, AbortController, console,
    getStudioProject: key => key === 'steering' ? { name: 'Steering', motionLabel: 'Steering motion' } : null,
    loadInspectorModule: () => deferredImport ? new Promise(resolve => importResolve = resolve) : Promise.resolve(module),
    requestAnimationFrame: raf, cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} },
  };
  vm.runInNewContext(source, context);
  async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
  await settle();
  return {
    window, document, host, viewport, inspectors, frames, settle,
    find: id => host.querySelector(`#case-3d-${id}`),
    resolveImport: async () => { importResolve(module); await settle(); },
    intersect: visible => { intersection([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); },
    tick() { clock += 17; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(clock)); },
    drain() { for (let i = 0; frames.size && i < 10; i++) this.tick(); assert.equal(frames.size, 0, 'No unbounded controller RAF polling'); },
  };
}

test('Retained-frame disposal stops playback and releases the inspector exactly once', async () => {
  const app = await setup();
  const viewer = app.inspectors[0];
  viewer.ready(true); app.drain();
  app.find('play').emit('click');
  assert.equal(viewer.state.playing, true);
  app.window.emit('studio-project-dispose');
  assert.equal(viewer.signal.aborted, true);
  assert.equal(viewer.state.active, false);
  assert.equal(viewer.state.playing, false);
  assert.equal(viewer.disposeCount, 1);
  app.window.emit('studio-project-dispose');
  app.window.emit('pagehide', { persisted: false });
  app.window.emit('pageshow', { persisted: true });
  app.find('play').emit('click');
  app.document.hidden = false; app.document.emit('visibilitychange');
  await app.settle(); app.drain();
  assert.equal(viewer.disposeCount, 1);
  assert.equal(viewer.state.active, false);
  assert.equal(viewer.state.playing, false);
  assert.equal(app.inspectors.length, 1);
});

test('Disposing an unfinished model rejects late completions and cannot remount on ready', async () => {
  const app = await setup();
  const viewer = app.inspectors[0];
  app.window.emit('studio-project-dispose');
  assert.equal(viewer.signal.aborted, true);
  assert.equal(viewer.disposeCount, 1);
  viewer.ready(true);
  app.window.emit('project-previews-ready');
  app.window.emit('pageshow', { persisted: true });
  await app.settle(); app.drain();
  assert.equal(app.inspectors.length, 1);
  assert.equal(app.viewport.dataset.status, 'loading');
  assert.equal(app.find('play').disabled, true);
});

test('Disposal during dynamic inspector import prevents any later WebGL instance', async () => {
  const app = await setup({ deferredImport: true });
  app.window.emit('studio-project-dispose');
  await app.resolveImport(); app.drain();
  assert.equal(app.inspectors.length, 0);
});

test('Disposal cancels an independent animation retry and ignores its late callback', async () => {
  const app = await setup();
  const viewer = app.inspectors[0];
  viewer.ready(false, true); app.drain();
  app.find('retry-motion').emit('click');
  assert.equal(viewer.retryCount, 1);
  app.window.emit('studio-project-dispose');
  viewer.ready(true);
  await app.settle(); app.drain();
  assert.equal(viewer.disposeCount, 1);
  assert.equal(viewer.state.active, false);
  assert.equal(app.find('play').disabled, true);
});