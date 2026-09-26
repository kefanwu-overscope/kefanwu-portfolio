import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../../studio-project-bridge.js', import.meta.url), 'utf8');
const protocol = 'kw-studio-project-v1';

class EventHost {
  listeners = new Map();
  addEventListener(type, listener, options = {}) {
    if (options.signal?.aborted) return;
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    options.signal?.addEventListener('abort', () => this.listeners.get(type)?.delete(listener), { once: true });
  }
  dispatchEvent(event) {
    for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event);
  }
}

function harness({ embedded = true, url = 'https://portfolio.test/project-3d.html?project=steering&studioFrame=1' } = {}) {
  const window = new EventHost();
  const document = new EventHost();
  const location = new URL(url);
  const messages = [], replacements = [], scrolls = [], anchors = new Map(), timers = new Map();
  let nextTimer = 0;
  window.parent = embedded ? {
    postMessage(message, origin) { messages.push({ ...JSON.parse(JSON.stringify(message)), origin }); },
  } : window;
  window.scrollY = 0;
  window.scrollTo = (options) => { window.scrollY = options.top; scrolls.push(options.top); };
  document.title = 'Project title';
  document.getElementById = (id) => anchors.get(id) || null;
  const history = {
    state: { existingState: 'preserved' },
    replaceState(state, unused, href) {
      this.state = state;
      location.href = String(href);
      replacements.push({ state, url: location.href });
    },
    pushState() { assert.fail('The frame must never create a history entry'); },
    go() { assert.fail('The frame must never traverse browser history'); },
  };
  vm.runInNewContext(source, {
    window, document, location, history, URL, AbortController,
    Event: class { constructor(type) { this.type = type; } },
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  function receive(data, overrides = {}) {
    window.dispatchEvent({ type: 'message', origin: location.origin, source: window.parent,
      data: { protocol, ...data }, ...overrides });
  }
  function click(href, attrs = {}, eventOptions = {}) {
    const link = {
      href: new URL(href, location).href,
      hasAttribute: (name) => Object.hasOwn(attrs, name),
      getAttribute: (name) => attrs[name] || null,
    };
    const event = { type: 'click', button: 0, target: { closest: () => link },
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...eventOptions };
    document.dispatchEvent(event);
    return event;
  }
  return { window, document, location, history, messages, replacements, scrolls, anchors, timers, receive, click };
}

test('Standalone pages and unrelated embeds keep native links and no bridge listeners', () => {
  for (const options of [
    { embedded: false },
    { url: 'https://portfolio.test/project-3d.html?project=steering' },
  ]) {
    const h = harness(options);
    assert.equal(h.messages.length, 0);
    assert.equal(h.window.listeners.size, 0);
    assert.equal(h.click('experience.html?return=project').defaultPrevented, false);
  }
});

test('Ready does not wait for models and strips the private frame marker', () => {
  const h = harness();
  assert.deepEqual(h.messages, [{ protocol, type: 'ready',
    url: 'https://portfolio.test/project-3d.html?project=steering', title: 'Project title', origin: h.location.origin }]);
  h.document.title = 'Rendered case title';
  h.window.dispatchEvent({ type: 'project-previews-ready' });
  assert.equal(h.messages.at(-1).type, 'title');
  assert.equal(h.messages.at(-1).title, 'Rendered case title');
});

test('Project hops and chapter clicks delegate navigation without creating child history', () => {
  const h = harness();
  h.window.scrollY = 730;
  assert(h.click('#record').defaultPrevented);
  assert.deepEqual(h.messages.at(-1), { protocol, type: 'navigate',
    url: 'https://portfolio.test/project-3d.html?project=steering#record', scrollY: 730, origin: h.location.origin });
  assert(h.click('project-3d.html?project=pool').defaultPrevented);
  assert.equal(h.messages.at(-1).url, 'https://portfolio.test/project-3d.html?project=pool');
  assert.equal(h.replacements.length, 0);
});

test('All studio returns are distinguishable from top-level site and external exits', () => {
  const h = harness();
  assert(h.click('experience.html?return=project').defaultPrevented);
  assert.equal(h.messages.at(-1).type, 'return');
  for (const href of ['index.html#work', 'case-study.html?project=pool', 'https://example.org/project']) {
    assert(h.click(href).defaultPrevented);
    assert.equal(h.messages.at(-1).type, 'leave');
    assert.equal(h.messages.at(-1).url, new URL(href, h.location).href);
  }
});

test('Modified, non-primary, prevented, download and targeted links keep browser behavior', () => {
  const h = harness();
  for (const [attrs, options] of [
    [{}, { ctrlKey: true }], [{}, { metaKey: true }], [{}, { shiftKey: true }], [{}, { altKey: true }],
    [{}, { button: 1 }], [{}, { defaultPrevented: true }], [{ download: '' }, {}],
    [{ target: '_blank' }, {}], [{ target: '_top' }, {}],
  ]) {
    const before = h.messages.length;
    h.click('project-3d.html?project=pool', attrs, options);
    assert.equal(h.messages.length, before);
  }
  assert.equal(h.click('mailto:portfolio@example.org').defaultPrevented, false);
  assert.equal(h.click('javascript:void(0)').defaultPrevented, false);
  assert(h.click('#motion', { target: '_SELF' }).defaultPrevented);
});

test('Location updates only replace the current project entry and preserve its existing state', () => {
  const h = harness();
  let anchorScrolls = 0;
  h.anchors.set('technical record', { scrollIntoView() { anchorScrolls++; } });
  h.receive({ type: 'location', url: 'https://portfolio.test/project-3d.html?project=steering#technical%20record' });
  assert.equal(anchorScrolls, 1);
  assert.equal(h.location.searchParams.get('studioFrame'), '1');
  assert.equal(h.location.hash, '#technical%20record');
  assert.deepEqual(h.history.state, { existingState: 'preserved' });
  h.receive({ type: 'location', url: 'https://portfolio.test/project-3d.html?project=steering#motion', scrollY: 1234 });
  assert.equal(h.scrolls.at(-1), 1234);
  h.receive({ type: 'location', url: 'https://portfolio.test/project-3d.html?project=steering' });
  assert.equal(h.scrolls.at(-1), 0);
});

test('Early section restoration is retried when asynchronous case markup becomes available', () => {
  const h = harness();
  let anchorScrolls = 0;
  h.receive({ type: 'location', url: 'https://portfolio.test/project-3d.html?project=steering#record' });
  h.anchors.set('record', { scrollIntoView() { anchorScrolls++; } });
  h.window.dispatchEvent({ type: 'project-previews-ready' });
  assert.equal(anchorScrolls, 1);
});

test('Foreign senders, unsafe destinations and mismatched projects cannot mutate the child route', () => {
  const h = harness();
  const update = { type: 'location', url: 'https://portfolio.test/project-3d.html?project=steering#record' };
  h.receive(update, { source: {} });
  h.receive(update, { origin: 'https://external.test' });
  h.receive(update, { data: { ...update, protocol: 'untrusted' } });
  for (const url of ['javascript:alert(1)', 'https://external.test/project-3d.html?project=steering',
    'https://portfolio.test/index.html', 'https://portfolio.test/project-3d.html?project=pool']) {
    h.receive({ type: 'location', url });
  }
  assert.equal(h.replacements.length, 0);
});

test('Scroll snapshots coalesce and disposal cancels pending work and navigation listeners', () => {
  const h = harness();
  for (const y of [1, 22, 333]) {
    h.window.scrollY = y;
    h.window.dispatchEvent({ type: 'scroll' });
  }
  assert.equal(h.timers.size, 1);
  const [id, timer] = [...h.timers][0];
  assert.equal(timer.delay, 150);
  h.timers.delete(id); timer.callback();
  assert.equal(h.messages.at(-1).type, 'scroll');
  assert.equal(h.messages.at(-1).scrollY, 333);
  h.window.dispatchEvent({ type: 'scroll' });
  let disposed = 0;
  h.window.addEventListener('studio-project-dispose', () => disposed++);
  h.receive({ type: 'dispose' }, { source: {} });
  assert.equal(disposed, 0);
  h.receive({ type: 'dispose' });
  h.receive({ type: 'dispose' });
  assert.equal(disposed, 1);
  assert.equal(h.timers.size, 0);
  const count = h.messages.length;
  h.click('experience.html?return=project');
  h.window.dispatchEvent({ type: 'project-previews-ready' });
  assert.equal(h.messages.length, count);
});
