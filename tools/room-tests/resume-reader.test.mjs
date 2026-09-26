import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setMaxListeners } from 'node:events';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../../', import.meta.url);
const moduleSource = await readFile(new URL('experience-resume.js', root), 'utf8');
const stylesheet = await readFile(new URL('experience.css', root), 'utf8');
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

// A deterministic layout/animation fixture, not a browser substitute. Model
// scrolling, padding, automatic image margins, and in-flight WAAPI transforms so
// interruption tests observe the displayed rectangle rather than only classes.
function harness({ width = 1280, height = 800, stableGutter = true, ...options } = {}) {
  const paper = new Element(), viewport = new Element(), image = new Element(), transcript = new Element();
  const fit = new Element(), out = new Element(), zoomIn = new Element(), pageButton = new Element(), textButton = new Element();
  const window = new Element(); window.innerWidth = width; window.innerHeight = height;
  const children = new Map([
    ['.exp-sheet__viewport', viewport], ['.exp-sheet__image', image], ['.exp-sheet__text', transcript],
    ['[data-resume-zoom="fit"]', fit], ['[data-resume-zoom="out"]', out], ['[data-resume-zoom="in"]', zoomIn],
    ['[data-resume-view="page"]', pageButton], ['[data-resume-view="text"]', textButton],
  ]);
  paper.querySelector = selector => children.get(selector) || null;
  let left = 0, top = 0, now = 0, frameId = 0;
  const frames = new Map(), animations = new Set();
  const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
  const expanded = () => paper.classes.has('is-expanded');
  const narrow = () => window.innerWidth < 640;
  const textMode = () => paper.classes.has('is-text');
  const padding = () => !expanded() || (narrow() && textMode()) ? { x: 0, top: 0, bottom: 0 }
    : narrow() ? { x: 12, top: 12, bottom: 32 } : { x: 32, top: 24, bottom: 48 };
  paper.getBoundingClientRect = () => {
    if (expanded()) return rect(0, 0, window.innerWidth, window.innerHeight);
    const w = Math.min(window.innerWidth * .92, 720, (window.innerHeight - 132) * 17 / 22), h = w * 22 / 17;
    return rect((window.innerWidth - w) / 2, (window.innerHeight - h) / 2, w, h);
  };
  viewport.getBoundingClientRect = () => {
    const paperRect = paper.getBoundingClientRect(), toolbar = expanded() ? narrow() ? 104 : 64 : 0;
    return rect(paperRect.left, paperRect.top + toolbar, paperRect.width, paperRect.height - toolbar);
  };
  // Match the expanded viewport's declared stable gutter, with an auto-gutter
  // mode to exercise the fallback in browsers without scrollbar-gutter support.
  const scrollbarWidth = () => {
    if (!expanded()) return 0;
    if (stableGutter) return 8;
    const contentHeight = textMode() ? Infinity : parseFloat(image.style.width) * 22 / 17;
    return contentHeight + padding().top + padding().bottom > viewport.clientHeight ? 8 : 0;
  };
  Object.defineProperty(viewport, 'clientWidth', { get: () => viewport.getBoundingClientRect().width - scrollbarWidth() });
  Object.defineProperty(viewport, 'clientHeight', { get: () => viewport.getBoundingClientRect().height });
  const contentWidth = () => viewport.clientWidth - padding().x * 2;
  const imageWidth = () => (image.style.width || '100%').endsWith('%')
    ? parseFloat(image.style.width || '100%') / 100 * contentWidth() : parseFloat(image.style.width);
  const textWidth = () => Math.min(contentWidth(), 40 * (parseFloat(transcript.style.fontSize) || 18));
  const textHeight = () => 2600 * ((parseFloat(transcript.style.fontSize) || 18) / 18) ** 1.6 * (720 / textWidth());
  const limits = () => ({
    x: Math.max(0, (textMode() ? textWidth() : imageWidth()) + padding().x * 2 - viewport.clientWidth),
    y: Math.max(0, (textMode() ? textHeight() : imageWidth() * 22 / 17) + padding().top + padding().bottom - viewport.clientHeight),
  });
  const clampScroll = (value, axis) => Math.max(0, Math.min(limits()[axis], value));
  Object.defineProperty(viewport, 'scrollLeft', { get: () => left = clampScroll(left, 'x'), set: value => { left = clampScroll(value, 'x'); } });
  Object.defineProperty(viewport, 'scrollTop', { get: () => top = clampScroll(top, 'y'), set: value => { top = clampScroll(value, 'y'); } });
  const contentRect = node => {
    const view = viewport.getBoundingClientRect(), w = node === image ? imageWidth() : textWidth();
    const result = rect(view.left + padding().x + Math.max(0, (contentWidth() - w) / 2) - viewport.scrollLeft,
      view.top + padding().top - viewport.scrollTop, w, node === image ? w * 22 / 17 : textHeight());
    const animation = [...animations].find(value => value.node === node && value.keyframes[0].transform);
    if (!animation) return result;
    const match = animation.keyframes[0].transform.match(/translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/);
    assert(match, 'Morph fixture recognizes the animated rectangle');
    const remaining = 1 - Math.min(1, (now - animation.start) / animation.duration);
    return rect(result.left + Number(match[1]) * remaining, result.top + Number(match[2]) * remaining,
      result.width * (1 + (Number(match[3]) - 1) * remaining), result.height * (1 + (Number(match[3]) - 1) * remaining));
  };
  image.getBoundingClientRect = () => contentRect(image);
  transcript.getBoundingClientRect = () => contentRect(transcript);
  for (const node of [paper, image, transcript]) node.animate = (keyframes, { duration }) => {
    let resolve, reject;
    const animation = { node, keyframes, duration, start: now,
      finished: new Promise((done, fail) => { resolve = done; reject = fail; }),
      cancel() { if (animations.delete(animation)) reject(new Error('Animation canceled')); },
      finish() { if (animations.delete(animation)) resolve(); },
    };
    animations.add(animation); return animation;
  };
  const context = {
    AbortController, RESUME_ASSET, resumeAccessibleHTML, window, performance: { now: () => now },
    getComputedStyle: () => ({ paddingLeft: `${padding().x}px` }),
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  vm.runInNewContext(executable, context);
  const reader = context.api.attachResumeReader(paper, options);
  return { paper, viewport, image, transcript, fit, out, zoomIn, pageButton, textButton, window, reader, frames, animations, api: context.api,
    fittedWidth: contentWidth,
    resize(width, height) { window.innerWidth = width; window.innerHeight = height; window.emit('resize'); },
    tick(delta = 16) {
      now += delta;
      for (const animation of [...animations]) if (now - animation.start >= animation.duration) animation.finish();
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now));
    },
    async flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); },
    async drain() {
      for (let i = 0; i < 80; i++) { this.tick(); await this.flush(); if (!frames.size && !animations.size) break; }
      assert.equal(frames.size, 0); assert.equal(animations.size, 0);
    },
    async open() { const pending = reader.expand(); await this.drain(); await pending; },
  };
}

function near(actual, expected, message = '') { assert(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} vs ${expected}`); }
function pagePoint(h, x, y) {
  const rect = h.image.getBoundingClientRect(); return { x: (x - rect.left) / rect.width, y: (y - rect.top) / rect.height };
}
function canonical(h) {
  assert.equal(h.reader.getState().phase, 'landing'); assert.equal(h.reader.isExpanded(), false);
  assert.equal(h.image.style.width, '100%'); assert.equal(h.reader.getState().mode, 'page');
  assert.equal(h.viewport.scrollLeft, 0); assert.equal(h.viewport.scrollTop, 0);
  for (const name of ['is-expanded', 'is-text', 'is-morphing', 'is-zoomed']) assert.equal(h.paper.classes.has(name), false);
}

test('Desktop expansion reaches the full window with a scrollable page fitted to width', async () => {
  const expandedViewportCSS = stylesheet.match(/\.exp-sheet\.is-expanded \.exp-sheet__viewport\s*\{([^}]+)\}/)?.[1];
  assert.match(expandedViewportCSS, /scrollbar-gutter:\s*stable\s*;/, 'The real stylesheet matches the fixture gutter');
  assert.match(expandedViewportCSS, /overflow:\s*auto\s*;/);
  assert(!/\.exp-sheet\.is-morphing \.exp-sheet__viewport\s*\{[^}]*overflow:\s*visible/.test(stylesheet),
    'Expansion must retain its scroll gutter throughout the morph');
  const h = harness(), landing = h.image.getBoundingClientRect();
  canonical(h); h.zoomIn.emit('click'); assert.equal(h.reader.getState().zoom, 1);
  let resolved = false;
  const opening = h.reader.expand(); opening.then(() => { resolved = true; });
  assert.equal(h.reader.isExpanded(), true); assert.equal(h.reader.isReading(), false);
  near(h.image.getBoundingClientRect().width, landing.width, 'Morph begins at the held page');
  h.tick(180); await h.flush(); assert.equal(resolved, false);
  await h.drain(); await opening;
  assert.equal(h.reader.isReading(), true); assert.equal(h.reader.getState().mode, 'page');
  assert.equal(h.paper.getBoundingClientRect().width, 1280);
  near(h.image.getBoundingClientRect().width, h.fittedWidth());
  assert(h.image.getBoundingClientRect().width > landing.width * 2);
  h.viewport.scrollTop = 500; assert.equal(h.viewport.scrollTop, 500);
  assert.equal(h.fit.textContent, 'Width'); h.reader.dispose();
});

test('Rapid zoom requests accumulate beyond 300% and smoothly retain the center document point', async () => {
  const h = harness(); await h.open(); h.viewport.scrollTop = 240;
  const view = h.viewport.getBoundingClientRect(), x = view.left + view.width / 2, y = view.top + view.height / 2;
  const anchor = pagePoint(h, x, y);
  for (let i = 0; i < 6; i++) h.zoomIn.emit('click');
  const target = 1.25 ** 6;
  near(h.reader.getState().targetZoom, target); assert.equal(h.reader.getState().zoom, 1);
  h.tick(95); assert(h.reader.getState().zoom > 1 && h.reader.getState().zoom < target);
  await h.drain(); near(h.reader.getState().zoom, target); assert.equal(h.zoomIn.disabled, false);
  near(pagePoint(h, x, y).x, anchor.x); near(pagePoint(h, x, y).y, anchor.y);
  h.reader.dispose();
});

test('Keyboard and pointer-anchored Ctrl-wheel zoom preserve ordinary scrolling and browser modifiers', async () => {
  const h = harness(); await h.open(); h.viewport.scrollTop = 180;
  const x = 320, y = 340, anchor = pagePoint(h, x, y);
  assert.equal(h.viewport.emit('wheel', { deltaY: -200, ctrlKey: false }).defaultPrevented, false);
  assert.equal(h.viewport.emit('wheel', { deltaY: -200, ctrlKey: true, clientX: x, clientY: y }).defaultPrevented, true);
  await h.drain(); near(h.reader.getState().zoom, Math.exp(.4));
  near(pagePoint(h, x, y).x, anchor.x); near(pagePoint(h, x, y).y, anchor.y);
  const zoom = h.reader.getState().zoom;
  assert.equal(h.paper.emit('keydown', { key: '+', ctrlKey: true }).defaultPrevented, false);
  assert.equal(h.reader.getState().targetZoom, zoom);
  assert.equal(h.paper.emit('keydown', { key: '+' }).defaultPrevented, true);
  await h.drain(); near(h.reader.getState().zoom, zoom * 1.25);
  h.paper.emit('keydown', { key: '0' }); await h.drain(); assert.equal(h.reader.getState().zoom, 1);
  for (let i = 0; i < 20; i++) h.out.emit('click');
  await h.drain(); assert.equal(h.reader.getState().zoom, .25); assert.equal(h.out.disabled, true);
  h.fit.emit('click'); await h.drain(); assert.equal(h.fit.textContent, 'Width'); h.reader.dispose();
});

test('Page panning captures one pointer and Text view preserves native text gestures', async () => {
  const h = harness();
  h.viewport.emit('pointerdown', { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
  assert.equal(h.viewport.capture.size, 0, 'The landing paper ignores gestures');
  await h.open(); h.viewport.scrollTop = 100;
  h.viewport.emit('pointerdown', { pointerId: 2, button: 0, clientX: 100, clientY: 100 });
  h.viewport.emit('pointermove', { pointerId: 3, clientX: 20, clientY: 20 });
  assert.equal(h.viewport.scrollTop, 100);
  h.viewport.emit('pointermove', { pointerId: 2, clientX: 70, clientY: 60 });
  assert.equal(h.viewport.scrollTop, 140); assert.equal(h.viewport.capture.has(2), true);
  h.viewport.emit('pointercancel', { pointerId: 2 });
  assert.equal(h.viewport.classes.has('is-dragging'), false); assert.equal(h.viewport.capture.size, 0);
  h.textButton.emit('click'); await h.drain();
  assert.equal(h.viewport.emit('pointerdown', { pointerId: 4, button: 0, clientX: 100, clientY: 100 }).defaultPrevented, false);
  assert.equal(h.viewport.capture.size, 0); h.reader.dispose();
});

test('Narrow windows open readable Text and allow returning to the original Page', async () => {
  for (const stableGutter of [true, false]) {
    const h = harness({ width: 390, height: 640, stableGutter }); await h.open();
    assert.equal(h.reader.getState().mode, 'text'); assert.equal(h.transcript.style.fontSize, '18px');
    assert.equal(h.textButton.attributes['aria-pressed'], 'true'); assert.equal(h.pageButton.attributes['aria-pressed'], 'false');
    h.zoomIn.emit('click'); await h.drain(); assert.equal(h.transcript.style.fontSize, '22.5px');
    h.pageButton.emit('click'); await h.drain();
    assert.equal(h.reader.getState().mode, 'page'); assert.equal(h.reader.getState().zoom, 1);
    near(h.image.getBoundingClientRect().width, h.fittedWidth(), `Fit width with stable gutter ${stableGutter}`);
    assert.equal(h.viewport.scrollTop, 0); h.reader.dispose();
  }
});

test('Default width closes through the canonical rectangle even without manual zoom', async () => {
  const h = harness(); await h.open(); h.viewport.scrollTop = 300;
  const from = h.image.getBoundingClientRect(); let resolved = false;
  const pending = h.reader.resetForClose(); pending.then(() => { resolved = true; });
  assert.equal(h.reader.resetForClose(), pending); assert.equal(h.reader.getState().phase, 'closing');
  near(h.image.getBoundingClientRect().width, from.width); near(h.image.getBoundingClientRect().top, from.top);
  h.tick(150); await h.flush(); assert.equal(resolved, false);
  h.zoomIn.emit('click'); assert.equal(h.reader.getState().targetZoom, 1);
  await h.drain(); await pending; canonical(h);
  assert.equal(h.reader.isReading(), false); h.reader.dispose();
});

test('Closing midway through expansion reverses from the displayed image and never reopens', async () => {
  const h = harness(), opening = h.reader.expand(); h.tick(112);
  const from = h.image.getBoundingClientRect(), pending = h.reader.resetForClose();
  near(h.image.getBoundingClientRect().width, from.width); near(h.image.getBoundingClientRect().left, from.left);
  await h.drain(); await Promise.all([opening, pending]); canonical(h);
  h.tick(500); await h.flush(); canonical(h); h.reader.dispose();
});

test('Closing cancels zoom and pointer capture; text also returns to the same original image', async () => {
  const h = harness(); await h.open(); h.zoomIn.emit('click'); h.tick(64);
  h.viewport.emit('pointerdown', { pointerId: 8, button: 0, clientX: 100, clientY: 100 });
  const pending = h.reader.resetForClose();
  assert.equal(h.frames.size, 0); assert.equal(h.viewport.capture.size, 0);
  await h.drain(); await pending; canonical(h); h.reader.dispose();
  const mobile = harness({ width: 390, height: 640 }); await mobile.open(); mobile.viewport.scrollTop = 1600;
  const mobileClose = mobile.reader.resetForClose(); await mobile.drain(); await mobileClose;
  canonical(mobile); mobile.reader.dispose();
});

test('Resize during close resolves its promise and restores fresh canonical geometry', async () => {
  const h = harness(); await h.open(); const pending = h.reader.resetForClose(); h.tick(70);
  h.resize(390, 640); await pending; await h.drain(); canonical(h);
  near(h.image.getBoundingClientRect().width, h.paper.getBoundingClientRect().width);
  assert.equal(h.animations.size, 0); h.reader.dispose();
});

test('Resize during opening completes once and chooses readable Text for the new narrow window', async () => {
  const h = harness(), opening = h.reader.expand(); h.tick(80); h.resize(390, 640);
  await h.drain(); await opening;
  assert.equal(h.reader.isReading(), true); assert.equal(h.reader.getState().mode, 'text');
  assert.equal(h.paper.classes.has('is-morphing'), false); h.reader.dispose();
});

test('Resize during zoom settles its target and preserves the visible document fraction', async () => {
  const h = harness(); await h.open(); h.viewport.scrollTop = 200;
  h.zoomIn.emit('click'); h.zoomIn.emit('click'); h.tick(80);
  const zoom = h.reader.getState().zoom, fraction = h.viewport.scrollTop / parseFloat(h.image.style.width);
  h.resize(1100, 800); await h.drain();
  near(h.viewport.scrollTop / parseFloat(h.image.style.width), fraction);
  near(h.reader.getState().targetZoom, zoom, 'Canceled zoom has no abandoned future target');
  h.zoomIn.emit('click'); await h.drain(); near(h.reader.getState().zoom, zoom * 1.25); h.reader.dispose();
});

test('Reduced motion opens, zooms, and closes without scheduling animations', async () => {
  const h = harness({ reducedMotion: true }); await h.reader.expand();
  assert.equal(h.reader.isReading(), true); h.zoomIn.emit('click'); assert.equal(h.reader.getState().zoom, 1.25);
  h.viewport.scrollTop = 100; await h.reader.resetForClose(); canonical(h);
  assert.equal(h.frames.size, 0); assert.equal(h.animations.size, 0); h.reader.dispose();
});

test('Disposal during opening, zoom, or close cancels work and detaches all input listeners', async t => {
  for (const stage of ['opening', 'zoom', 'closing']) await t.test(stage, async () => {
    const h = harness(); let pending;
    if (stage === 'opening') pending = h.reader.expand();
    else {
      await h.open(); h.zoomIn.emit('click');
      if (stage === 'closing') pending = h.reader.resetForClose();
    }
    h.tick(30); h.reader.dispose(); await h.drain(); await pending; canonical(h);
    assert.equal(h.frames.size, 0); assert.equal(h.animations.size, 0);
    h.paper.emit('keydown', { key: '+' }); h.fit.emit('click'); h.zoomIn.emit('click'); h.textButton.emit('click');
    h.viewport.emit('wheel', { deltaY: -10, ctrlKey: true }); h.window.emit('resize');
    canonical(h);
    for (const element of [h.paper, h.viewport, h.fit, h.out, h.zoomIn, h.pageButton, h.textButton, h.window]) {
      assert.equal([...element.listeners.values()].reduce((total, handlers) => total + handlers.size, 0), 0);
    }
    h.reader.dispose();
  });
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
