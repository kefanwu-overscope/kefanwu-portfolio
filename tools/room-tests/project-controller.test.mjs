import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { projectMotionLabels } from '../../project-motion-labels.js';
import { projectMotionNotes } from '../../project-motion-notes.js';

const source = (await readFile(new URL('../../project-case-3d.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]+\n/gm, '')
  .replace(/import\('\.\/studio-inspector\.js[^']*'\)/, 'loadInspectorModule()');

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
  dispatchEvent(event) {
    for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event);
    return !event.defaultPrevented;
  }
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

async function setup({ offscreen = false, deferredImport = false, scrollDriven = false, deferredPose = false,
  caseMode = 'studio', motionLive = true, project = 'steering' } = {}) {
  const window = new Element(); const document = new Element(); document.hidden = false;
  document.body = new Element('body'); document.body.dataset = { project };
  if (caseMode) document.body.dataset.caseMode = caseMode;
  const host = new Element(); host.className = 'case-animation-host'; host.dataset.project = project;
  if (motionLive) host.dataset.motionLive = 'true';
  if (scrollDriven) host.dataset.scrollDriven = 'true';
  const viewport = new Element(); viewport.className = 'card-media';
  if (offscreen) viewport.box = { top: -800, bottom: -400, left: 10, right: 650, width: 640, height: 400 };
  host.append(viewport); document.body.append(host); document.append(document.body); viewport.append(new Element('img'));
  document.createElement = tag => new Element(tag);
  window.innerHeight = 900; window.innerWidth = 1400;
  const frames = new Map(); let frameID = 0; let clock = 0; let intersection; let importResolve;
  const raf = fn => { const id = ++frameID; frames.set(id, fn); return id; };
  const inspectors = [], imports = [];
  function createStudioInspector(callbacks) {
    const state = { key: 'steering', renderedFrames: 0, active: true, motionReady: false, playing: false, direction: 1, progress: 0 };
    let selectedResolve; let disposed = false, pendingPose = null;
    const draw = () => {
      if (!state.active || disposed || document.hidden) return;
      if (pendingPose !== null) { callbacks.onProgress(pendingPose); pendingPose = null; }
      state.renderedFrames++;
      callbacks.onFrame?.({ progress: state.progress });
    };
    const api = {
      callbacks, state, disposeCount: 0, retryCount: 0, signal: null,
      anchorQueries: [],
      projectAnchor(target) { api.anchorQueries.push(target); return target ? { x: .4, y: .6, name: target.name || target.group } : null; },
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
      setProgress(progress) {
        state.progress = progress;
        if (deferredPose) pendingPose = progress; else callbacks.onProgress(progress);
        if (state.active) raf(draw);
      },
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
    window, document, AbortController, console, projectMotionLabels, projectMotionNotes,
    CustomEvent: class { constructor(type, { detail } = {}) { this.type = type; this.detail = detail; } },
    getStudioProject: key => key === project ? { name: project, motionLabel: 'Project motion' } : null,
    loadInspectorModule: () => { imports.push('inspector'); return deferredImport ? new Promise(resolve => importResolve = resolve) : Promise.resolve(module); },
    requestAnimationFrame: raf, cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class { constructor(fn) { intersection = fn; } observe() {} disconnect() {} },
  };
  vm.runInNewContext(source, context);
  async function settle() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
  await settle();
  return {
    window, document, host, viewport, inspectors, imports, frames, settle,
    find: id => host.querySelector(`#case-3d-${id}`),
    resolveImport: async () => { importResolve(module); await settle(); },
    intersect: visible => { intersection([{ isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); },
    tick() { clock += 17; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(clock)); },
    drain() { for (let i = 0; frames.size && i < 10; i++) this.tick(); assert.equal(frames.size, 0, 'No unbounded controller RAF polling'); },
  };
}

test('Main steering mounts the live transparent surface without changing its navigation mode', async () => {
  const app = await setup({ caseMode: null, scrollDriven: true });
  assert.equal(app.inspectors.length, 1);
  assert.equal(app.inspectors[0].callbacks.transparentBackground, true);
  assert.equal(app.document.body.dataset.caseMode, undefined);
  assert.equal(app.viewport.dataset.status, 'loading');
  app.inspectors[0].ready(true);
  assert.equal(app.viewport.dataset.status, 'loading', 'Ready data cannot uncover an undrawn model');
  app.drain();
  assert.equal(app.viewport.dataset.status, 'ready');
  assert.equal(app.find('canvas').getAttribute('aria-hidden'), 'false');
  assert.equal(app.find('canvas').tabIndex, -1, 'Guided surface stays out of free-rotation keyboard navigation');
});

test('Pages without an explicit live-motion flag never import or mount the WebGL inspector', async () => {
  for (const caseMode of [null, 'studio']) {
    const app = await setup({ caseMode, motionLive: false, project: 'vineRobot' });
    app.window.emit('project-previews-ready');
    await app.settle();
    assert.equal(app.imports.length, 0);
    assert.equal(app.inspectors.length, 0);
    assert.equal(app.find('canvas'), null);
    assert.equal(app.document.body.dataset.caseMode, caseMode || undefined);
  }
});

test('Rendered frames publish the exact active component anchor without preempting the visible pose', async () => {
  const app = await setup({ scrollDriven: true, deferredPose: true });
  const viewer = app.inspectors[0], anchors = [];
  app.host.addEventListener('case-motion-anchor', event => anchors.push(event.detail.point));
  viewer.ready(true); app.drain();
  assert.deepEqual(viewer.anchorQueries.at(-1), projectMotionLabels.steering[0].target);
  const before = anchors.length;
  viewer.setProgress(.68);
  assert.equal(anchors.length, before, 'A requested pose cannot publish a projected anchor before rendering');
  app.drain();
  assert.deepEqual(viewer.anchorQueries.at(-1), projectMotionLabels.steering[5].target);
  assert.equal(anchors.at(-1).name, projectMotionLabels.steering[5].target.group);
  app.window.emit('studio-project-dispose');
  const disposedCount = anchors.length;
  viewer.callbacks.onFrame({ progress: .1 });
  assert.equal(anchors.length, disposedCount, 'A retired inspector cannot publish late frame anchors');
});

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

test('A guided seek publishes progress only when the inspector applies its pose', async () => {
  const app = await setup({ scrollDriven: true, deferredPose: true });
  const viewer = app.inspectors[0], shown = [];
  viewer.ready(true); await app.settle(); app.drain();
  app.host.addEventListener('case-motion-progress', event => shown.push(event.detail.progress));
  app.host.emit('case-motion-request', { detail: { progress: .65 } });
  assert.equal(viewer.state.progress, .65);
  assert.deepEqual(shown, [], 'Requested progress must not advance notes before the actual pose callback');
  app.tick();
  assert.deepEqual(shown, [.65]);
  assert.equal(app.host.dataset.motionProgress, '0.65');
});

test('The latest guided request is retained while animation data loads and replayed when ready', async () => {
  const app = await setup({ scrollDriven: true, deferredPose: true });
  const viewer = app.inspectors[0], shown = [];
  viewer.ready(false); await app.settle(); app.drain();
  app.host.addEventListener('case-motion-progress', event => shown.push(event.detail.progress));
  app.host.emit('case-motion-request', { detail: { progress: .3 } });
  app.host.emit('case-motion-request', { detail: { progress: .78 } });
  assert.equal(viewer.state.progress, 0); assert.deepEqual(shown, []);
  viewer.ready(true);
  assert.equal(viewer.state.progress, .78); assert.deepEqual(shown, []);
  app.drain();
  assert.equal(shown.at(-1), .78);
  assert.equal(app.host.dataset.motionReady, 'true');
});

test('Guided native scroll does not consume wheel events and free exploration ignores scroll requests', async () => {
  const app = await setup({ scrollDriven: true, deferredPose: true });
  const viewer = app.inspectors[0];
  viewer.ready(true); await app.settle(); app.drain();
  const timeline = app.host.querySelector('.case-3d-timeline');
  assert.equal(timeline.emit('wheel', { deltaY: 100, deltaMode: 0 }).defaultPrevented, false);
  app.host.emit('case-motion-mode', { detail: { free: true } });
  app.host.emit('case-motion-request', { detail: { progress: .7 } });
  assert.equal(viewer.state.progress, 0);
  app.host.emit('case-motion-mode', { detail: { free: false } });
  app.host.emit('case-motion-request', { detail: { progress: .7 } });
  assert.equal(viewer.state.progress, .7);
});

test('Context loss reports the initial cover pose and recovery republishes the retained drawn pose', async () => {
  const app = await setup({ scrollDriven: true, deferredPose: true });
  const viewer = app.inspectors[0], shown = [];
  viewer.ready(true); await app.settle(); app.drain();
  app.host.emit('case-motion-request', { detail: { progress: .78 } }); app.drain();
  app.host.addEventListener('case-motion-progress', event => shown.push(event.detail.progress));
  viewer.callbacks.onStatus({ key: 'steering', state: 'context-lost' });
  assert.equal(app.viewport.dataset.status, 'context-lost');
  assert.deepEqual(shown, [0]); assert.equal(app.host.dataset.motionProgress, '0');
  // The real inspector can skip an unchanged seek. Its restored render still
  // needs to republish the retained pose when the cover is removed.
  viewer.setProgress = next => assert.equal(next, .78);
  viewer.callbacks.onStatus({ key: 'steering', state: 'ready', motionReady: true });
  assert.deepEqual(shown, [0]);
  viewer.state.renderedFrames += 1;
  app.drain();
  assert.equal(app.viewport.dataset.status, 'ready');
  assert.equal(app.host.dataset.motionProgress, '0.78');
  assert.deepEqual(shown, [0, .78]); assert.equal(app.inspectors.length, 1);
});
