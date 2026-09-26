import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setMaxListeners } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const moduleSource = await readFile(new URL('experience-resume.js', root), 'utf8');
const loadStandalone = async (path) => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(path, root))).toString('base64')}`);
const { RESUME_ASSET } = await loadStandalone('experience-resume-assets.js');
const { resumeAccessibleHTML } = await loadStandalone('experience-resume-content.js');
const executable = moduleSource
  .replace(/^import[^\n]+\n/gm, '')
  .replace(/^export \{[^}]+\};\r?\n/gm, '')
  .replace(/^export /gm, '') + '\nglobalThis.api = { attachResumeReader, resumeHTML, RESUME_PAPER };';

class Element {
  listeners = new Map(); attributes = {}; style = {}; disabled = false; textContent = '';
  classes = new Set(); capture = new Set(); focused = false;
  classList = {
    add: (...values) => values.forEach(value => this.classes.add(value)),
    remove: (...values) => values.forEach(value => this.classes.delete(value)),
    contains: value => this.classes.has(value),
    toggle: (value, force) => {
      const present = force ?? !this.classes.has(value);
      if (present) this.classes.add(value); else this.classes.delete(value);
      return present;
    },
  };
  addEventListener(type, callback, options = {}) {
    const listeners = this.listeners.get(type) || new Set();
    listeners.add(callback); this.listeners.set(type, listeners);
    if (options.signal) {
      setMaxListeners(30, options.signal);
      options.signal.addEventListener('abort', () => listeners.delete(callback), { once: true });
    }
  }
  emit(type, details = {}) {
    const event = { target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...details };
    for (const callback of [...(this.listeners.get(type) || [])]) callback(event);
    if (type === 'pointerup' || type === 'pointercancel') this.capture.delete(details.pointerId);
    return event;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  setPointerCapture(id) { this.capture.add(id); }
  hasPointerCapture(id) { return this.capture.has(id); }
  releasePointerCapture(id) { this.capture.delete(id); }
  focus() { this.focused = true; }
  scrollTo(x, y) { this.scrollLeft = x; this.scrollTop = y; }
}

function harness(options = {}) {
  const paper = new Element(), viewport = new Element(), image = new Element();
  const fit = new Element(), out = new Element(), zoomIn = new Element();
  const children = new Map([
    ['.exp-sheet__viewport', viewport], ['.exp-sheet__image', image],
    ['[data-resume-zoom="fit"]', fit], ['[data-resume-zoom="out"]', out], ['[data-resume-zoom="in"]', zoomIn],
  ]);
  paper.querySelector = selector => children.get(selector) || null;
  viewport.clientWidth = 400; viewport.clientHeight = 400 * 22 / 17;
  let left = 0, top = 0, now = 0, frameId = 0;
  const frames = new Map();
  for (const [property, dimension, read, write] of [
    ['scrollLeft', 'clientWidth', () => left, value => { left = value; }],
    ['scrollTop', 'clientHeight', () => top, value => { top = value; }],
  ]) Object.defineProperty(viewport, property, {
    get: read,
    set(value) { write(Math.max(0, Math.min(viewport[dimension] * (parseFloat(image.style.width || 100) / 100 - 1), value))); },
  });
  const context = {
    AbortController, RESUME_ASSET, resumeAccessibleHTML, performance: { now: () => now },
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  vm.runInNewContext(executable, context);
  const reader = context.api.attachResumeReader(paper, options);
  return { paper, viewport, image, fit, out, zoomIn, reader, frames, api: context.api,
    tick(delta = 16) { now += delta; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now)); },
    drain() { for (let i = 0; frames.size && i < 30; i++) this.tick(); assert.equal(frames.size, 0); },
  };
}

test('Zoom preserves the page position at the viewport center and clamps to readable limits', () => {
  const h = harness();
  assert.equal(h.image.style.width, '100%'); assert.equal(h.out.disabled, true);
  h.zoomIn.emit('click');
  assert.equal(h.image.style.width, '150%');
  assert.equal(h.viewport.scrollLeft, 100);
  assert(Math.abs(h.viewport.scrollTop - h.viewport.clientHeight / 4) < 1e-9);
  assert.equal(h.reader.isZoomed(), true);
  for (let i = 0; i < 8; i++) h.zoomIn.emit('click');
  assert.equal(h.image.style.width, '300%'); assert.equal(h.zoomIn.disabled, true);
  h.fit.emit('click');
  assert.equal(h.image.style.width, '100%'); assert.equal(h.viewport.scrollLeft, 0); assert.equal(h.viewport.scrollTop, 0);
  for (let i = 0; i < 3; i++) h.out.emit('click');
  assert.equal(h.image.style.width, '100%'); assert.equal(h.out.disabled, true);
  h.reader.dispose();
});

test('Keyboard zoom and Ctrl-wheel zoom coexist with ordinary scrolling', () => {
  const h = harness();
  assert.equal(h.paper.emit('keydown', { key: '+' }).defaultPrevented, true);
  assert.equal(h.image.style.width, '150%');
  assert.equal(h.viewport.emit('wheel', { deltaY: -20, ctrlKey: false }).defaultPrevented, false);
  assert.equal(h.image.style.width, '150%');
  assert.equal(h.viewport.emit('wheel', { deltaY: -20, ctrlKey: true }).defaultPrevented, true);
  assert.equal(h.image.style.width, '175%');
  h.paper.emit('keydown', { key: '0' });
  assert.equal(h.image.style.width, '100%');
  h.reader.dispose();
});

test('Pointer panning follows only the captured pointer and releases on cancellation', () => {
  const h = harness();
  h.viewport.emit('pointerdown', { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
  assert.equal(h.viewport.capture.size, 0, 'A fitted page does not capture pointer gestures');
  h.zoomIn.emit('click'); h.zoomIn.emit('click');
  const x = h.viewport.scrollLeft, y = h.viewport.scrollTop;
  h.viewport.emit('pointerdown', { pointerId: 2, button: 0, clientX: 100, clientY: 100 });
  h.viewport.emit('pointermove', { pointerId: 3, clientX: 20, clientY: 20 });
  assert.equal(h.viewport.scrollLeft, x);
  h.viewport.emit('pointermove', { pointerId: 2, clientX: 70, clientY: 60 });
  assert.equal(h.viewport.scrollLeft, x + 30); assert.equal(h.viewport.scrollTop, y + 40);
  h.viewport.emit('pointercancel', { pointerId: 2 });
  assert.equal(h.viewport.classes.has('is-dragging'), false);
  h.viewport.emit('pointermove', { pointerId: 2, clientX: 0, clientY: 0 });
  assert.equal(h.viewport.scrollLeft, x + 30);
  h.reader.dispose();
});

test('Closing a zoomed and panned reader restores the full page before resolving', async () => {
  const h = harness();
  h.zoomIn.emit('click'); h.zoomIn.emit('click');
  h.viewport.scrollLeft = 230; h.viewport.scrollTop = 280;
  let resolved = false;
  const pending = h.reader.resetForClose(); pending.then(() => { resolved = true; });
  assert.equal(h.reader.resetForClose(), pending, 'Repeated close requests share one reset');
  h.tick(90); await Promise.resolve();
  assert.equal(resolved, false); assert(h.reader.isZoomed());
  const width = h.image.style.width; h.zoomIn.emit('click'); assert.equal(h.image.style.width, width);
  h.drain(); await pending;
  assert.equal(h.reader.isZoomed(), false); assert.equal(h.image.style.width, '100%');
  assert.equal(h.viewport.scrollLeft, 0); assert.equal(h.viewport.scrollTop, 0);
  assert.equal(h.paper.classes.has('is-resetting'), false); assert.equal(h.frames.size, 0);
  h.reader.dispose();
});

test('Reduced motion restores the entire page without scheduling animation', async () => {
  const h = harness({ reducedMotion: true });
  h.zoomIn.emit('click'); h.viewport.scrollTop = 100;
  await h.reader.resetForClose();
  assert.equal(h.image.style.width, '100%'); assert.equal(h.frames.size, 0);
  assert.equal(h.viewport.scrollLeft, 0); assert.equal(h.viewport.scrollTop, 0);
  h.reader.dispose();
});

test('Disposing during reset cancels pending work and detaches all input listeners', async () => {
  const h = harness(); h.zoomIn.emit('click');
  const pending = h.reader.resetForClose(); h.tick(30); h.reader.dispose();
  await pending;
  assert.equal(h.frames.size, 0);
  const width = h.image.style.width;
  h.paper.emit('keydown', { key: '0' }); h.fit.emit('click'); h.zoomIn.emit('click');
  h.viewport.emit('wheel', { deltaY: -10, ctrlKey: true });
  assert.equal(h.image.style.width, width);
  for (const element of [h.paper, h.viewport, h.fit, h.out, h.zoomIn]) {
    assert.equal([...element.listeners.values()].reduce((total, handlers) => total + handlers.size, 0), 0);
  }
  h.reader.dispose();
});

test('Canonical image and public PDF match their recorded provenance and Letter geometry', async () => {
  const pdf = await readFile(new URL(RESUME_ASSET.source, root));
  const preview = await readFile(new URL(RESUME_ASSET.preview, root));
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(pdf), RESUME_ASSET.sourceSha256);
  assert.equal(hash(preview), RESUME_ASSET.sha256); assert.equal(preview.length, RESUME_ASSET.bytes);
  assert.equal(preview.toString('ascii', 0, 4), 'RIFF'); assert.equal(preview.toString('ascii', 8, 12), 'WEBP');
  assert.equal(preview.toString('ascii', 12, 16), 'VP8L', 'Preview uses lossless WebP encoding');
  assert.equal(RESUME_ASSET.width / RESUME_ASSET.height, 17 / 22);
  const h = harness();
  assert(Math.abs(h.api.RESUME_PAPER.width / h.api.RESUME_PAPER.height - 17 / 22) < 1e-12);
  assert(h.api.RESUME_PAPER.bottom > .7668, 'Paper rests above the cutting mat');
  assert(h.api.RESUME_PAPER.thickness < .001, 'Paper does not return to the old thick slab');
  h.reader.dispose();
});

test('Reader keeps native PDF actions and the complete non-interactive accessible transcript', () => {
  const h = harness(), html = h.api.resumeHTML(), accessible = resumeAccessibleHTML();
  assert(html.includes(`src="${RESUME_ASSET.preview}"`));
  assert(html.includes(`href="${RESUME_ASSET.source}?v=${RESUME_ASSET.sourceSha256.slice(0, 12)}"`));
  assert(html.includes('target="_blank" rel="noopener"')); assert(html.includes('download="Kefan-Wu-Resume.pdf"'));
  assert.equal((accessible.match(/<h3>/g) || []).length, 4);
  assert.equal((accessible.match(/<li>/g) || []).length, 16);
  assert(!/<(?:a|button|input|select|textarea|iframe)\b/i.test(accessible));
  assert(accessible.includes('200 lb target, 300 lb tested.'));
  assert(accessible.includes('300 km/h design target'));
  assert(accessible.includes('22 km, sub-30-minute endurance design target'));
  h.reader.dispose();
});
