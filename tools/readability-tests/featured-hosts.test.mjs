import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../../exploded.js', import.meta.url), 'utf8');
const catalog = JSON.parse(await readFile(new URL('../../assets/exploded/manifest-white-20261011.json', import.meta.url), 'utf8'));
const flush = () => new Promise(resolve => setImmediate(resolve));

class Element {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.attributes = new Map(); this.listeners = new Map(); this.parentElement = null;
    this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
    const classes = new Set();
    this.classList = { add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)), contains: name => classes.has(name),
      toggle(name, value = !classes.has(name)) { value ? classes.add(name) : classes.delete(name); } };
  }
  set className(value) { value.split(/\s+/).filter(Boolean).forEach(name => this.classList.add(name)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatchEvent(event) { for (const listener of this.listeners.get(event.type) || []) listener(event); }
  emit(type, props = {}) {
    const event = { type, target: this, pointerType: 'mouse', preventDefault() {}, stopPropagation() {}, ...props };
    this.dispatchEvent(event); return event;
  }
  append(...children) {
    for (const child of children) {
      if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(item => item !== child);
      this.children.push(child); child.parentElement = this;
    }
  }
  replaceChildren(...children) { this.children.forEach(child => child.parentElement = null); this.children = []; this.append(...children); }
  get firstChild() { return this.children[0] || null; }
  matches(selector) { return selector.startsWith('.') ? this.classList.contains(selector.slice(1)) : this.tagName.toLowerCase() === selector; }
  querySelector(selector) {
    for (const child of this.children) { if (child.matches(selector)) return child; const found = child.querySelector(selector); if (found) return found; }
    return null;
  }
  getBoundingClientRect() { return { top: 20, bottom: 420 }; }
}

async function harness({ gated = false, streaming = false } = {}) {
  const hosts = [], requests = [], imageURLs = new Map(), resources = new Map(), pending = new Set();
  const metrics = { requests: 0, maxRequests: 0, decoded: 0, peakDecoded: 0 };
  let nextURL = 0, intersect;
  const document = new Element(), window = new Element();
  document.body = new Element('body'); document.hidden = false; document.baseURI = 'http://localhost/';
  document.currentScript = { dataset: { manifest: 'assets/exploded/manifest-white-20261011.json' } };
  document.createElement = tag => new Element(tag);
  document.querySelectorAll = () => hosts;
  const manifest = { version: 1, projects: {} };
  for (const key of ['steering', 'vineRobot', 'scanner']) {
    const config = structuredClone(catalog.projects[key]);
    if (streaming) config.streaming = true;
    manifest.projects[key] = config;
    for (const chunk of config.chunks) {
      const data = new Uint8Array(chunk.bytes);
      for (const frame of chunk.frames) {
        const header = new DataView(data.buffer, frame.offset, frame.length);
        header.setUint16(0, frame.index); header.setUint16(2, config.width); header.setUint16(4, config.height);
      }
      resources.set(new URL(chunk.url, document.baseURI).href, new Blob([data]));
    }
  }
  class PreviewURL extends URL {
    static createObjectURL(blob) { const value = `blob:preview-${++nextURL}`; imageURLs.set(value, blob); return value; }
    static revokeObjectURL(value) { imageURLs.delete(value); }
  }
  class PreviewImage extends Element {
    constructor() { super('img'); this.residentBytes = 0; }
    async decode() {
      const blob = imageURLs.get(this.src); assert(blob, 'decode requires a live object URL');
      const header = new DataView(await blob.slice(0, 6).arrayBuffer());
      this.frameIndex = header.getUint16(0); this.naturalWidth = header.getUint16(2); this.naturalHeight = header.getUint16(4);
      this.residentBytes = this.naturalWidth * this.naturalHeight * 4;
      metrics.decoded += this.residentBytes; metrics.peakDecoded = Math.max(metrics.peakDecoded, metrics.decoded);
    }
    removeAttribute(name) {
      super.removeAttribute(name);
      if (name === 'src') { metrics.decoded -= this.residentBytes; this.residentBytes = 0; }
    }
  }
  function addHost(key, featured = false, external = false) {
    const card = new Element('article'); card.dataset.project = key;
    card.className = featured ? 'featured-project case-animation-host' : 'project-card';
    if (external) card.dataset.scrollDriven = 'true';
    const media = new Element(); media.className = 'card-media';
    const poster = new Element('img'); poster.src = manifest.projects[key].poster; media.append(poster);
    const title = new Element('h3'); title.textContent = key;
    card.append(media, title); hosts.push(card); return card;
  }
  const directory = addHost('steering'), featured = addHost('steering', true), vine = addHost('vineRobot', true);
  const context = { window: null, document, location: { origin: 'http://localhost' }, innerHeight: 900,
    URL: PreviewURL, Image: PreviewImage, AbortController, DOMException, CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
    matchMedia(query) { const media = new Element(); media.matches = !query.includes('reduced-motion'); return media; },
    IntersectionObserver: class { constructor(callback) { intersect = callback; } observe() {} },
    addEventListener: window.addEventListener.bind(window),
    requestAnimationFrame() { throw new Error('These tests use direct range/scroll seeks.'); }, cancelAnimationFrame() {},
    async fetch(value, options = {}) {
      const url = String(value);
      if (url.endsWith('.json')) return { ok: true, json: async () => manifest };
      requests.push(url); metrics.requests++; metrics.maxRequests = Math.max(metrics.maxRequests, metrics.requests);
      try {
        if (gated) await new Promise((resolve, reject) => {
          const release = () => { pending.delete(release); options.signal?.removeEventListener('abort', abort); resolve(); };
          const abort = () => { pending.delete(release); reject(new DOMException('cancelled', 'AbortError')); };
          pending.add(release); options.signal?.addEventListener('abort', abort, { once: true });
          if (options.signal?.aborted) abort();
        });
        return { ok: resources.has(url), status: resources.has(url) ? 200 : 404, blob: async () => resources.get(url) };
      } finally { metrics.requests--; }
    },
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'exploded.js' }); await flush();
  const range = card => card.querySelector('input');
  const stage = card => card.querySelector('.card-explode-stage');
  return { context, document, window, hosts, directory, featured, vine, requests, metrics, imageURLs, resources,
    addHost, range, stage, intersect: (card, visible) => intersect([{ target: card, isIntersecting: visible }]),
    seek(card, value) { range(card).value = String(value); range(card).emit('input'); },
    ready() { window.emit('project-previews-ready'); },
    async settle() {
      for (let i = 0; i < 100; i++) { [...pending].forEach(release => release()); await flush(); if (!pending.size && !metrics.requests) { await flush(); return; } }
      throw new Error('Preview requests did not settle');
    },
    close() { window.emit('pagehide'); },
  };
}

test('same-project featured and directory hosts register independently without fetching frames', async () => {
  const h = await harness();
  assert(h.range(h.directory)); assert(h.range(h.featured)); assert.notEqual(h.range(h.directory), h.range(h.featured));
  assert.equal(h.requests.length, 0);
  assert.equal(h.range(h.directory).getAttribute('aria-label'), h.range(h.featured).getAttribute('aria-label'));
  assert.equal(h.directory.querySelector('img').src, h.featured.querySelector('img').src);
  const ui = h.featured.querySelector('.card-explode-ui'); h.ready(); h.ready();
  assert.equal(h.featured.querySelector('.card-explode-ui'), ui);
  assert.equal(h.featured.querySelector('.card-media').children.length, 3);
  const late = h.addHost('scanner', true); h.ready(); assert(h.range(late)); assert.equal(h.requests.length, 0);
  h.close();
});

test('reset and observer target the exact host, and switching duplicates keeps original frames and memory bound', async () => {
  const h = await harness(); h.seek(h.featured, 25); await h.settle();
  assert.equal(h.stage(h.featured).firstChild.frameIndex, 30);
  h.context.cardExplosions.reset(h.directory, true); h.intersect(h.directory, false);
  assert.equal(h.range(h.featured).value, '25'); assert(h.featured.classList.contains('is-explode-playing'));
  h.seek(h.directory, 75); await h.settle();
  assert.equal(h.range(h.featured).value, '0'); assert(!h.featured.classList.contains('is-explode-playing'));
  assert.equal(h.stage(h.directory).firstChild.frameIndex, 90);
  h.seek(h.vine, 100); await h.settle(); assert.equal(h.stage(h.vine).firstChild.frameIndex, 144);
  assert(h.requests.every(url => h.resources.has(url)), 'host identities never leak into asset URLs');
  assert(h.metrics.peakDecoded <= 160 * 1024 * 1024); assert(h.metrics.maxRequests <= 3);
  h.close(); await h.settle(); assert.equal(h.imageURLs.size, 0); assert.equal(h.metrics.decoded, 0);
});

test('rapid same-project handoff cancels the previous loader without corrupting the new host', async () => {
  const h = await harness({ gated: true });
  h.seek(h.featured, 20); assert.equal(h.metrics.requests, 3);
  h.seek(h.directory, 80); await h.settle();
  assert.equal(h.stage(h.directory).firstChild.frameIndex, 96);
  assert.equal(h.range(h.featured).value, '0'); assert(!h.featured.classList.contains('is-explode-playing'));
  assert(h.metrics.maxRequests <= 3); assert(h.metrics.peakDecoded <= 160 * 1024 * 1024);
  h.close(); await h.settle(); assert.equal(h.imageURLs.size, 0);
});

test('streaming duplicates and late scroll-driven case hosts retain independent ownership and public events', async () => {
  const h = await harness({ streaming: true });
  h.seek(h.featured, 30); await h.settle(); assert.equal(h.stage(h.featured).firstChild.frameIndex, 36);
  h.seek(h.directory, 85); await h.settle(); assert.equal(h.stage(h.directory).firstChild.frameIndex, 102);
  const external = h.addHost('scanner', true, true); h.ready();
  assert.equal(external.dataset.motionEngine, 'frames'); assert.equal(external.dataset.motionFrames, '121');
  assert.equal(external.querySelector('.card-explode-ui').hidden, true);
  const events = []; external.addEventListener('case-motion-progress', event => events.push(event.detail.progress));
  external.emit('case-motion-request', { detail: { progress: .5 } }); await h.settle();
  assert.equal(h.stage(external).firstChild.frameIndex, 60); assert.equal(events.at(-1), .5);
  h.context.cardExplosions.reset(external, true); assert.equal(external.dataset.motionProgress, '0'); assert.equal(events.at(-1), 0);
  assert(h.metrics.maxRequests <= 3); assert(h.metrics.peakDecoded <= 160 * 1024 * 1024);
  h.close(); await h.settle(); assert.equal(h.imageURLs.size, 0);
});
