import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

const source = await readFile(new URL('../../experience.js', import.meta.url), 'utf8');
const start = source.indexOf('  let projectPageOpen = false;');
const end = source.indexOf('  // named + exposed', start);
assert(start >= 0 && end > start, 'Extract the actual room navigation/visibility lifecycle');
const lifecycle = source.slice(start, end);

class EventHost {
  listeners = new Map();
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  emit(type, details = {}) {
    for (const listener of this.listeners.get(type) || []) listener(details);
  }
}

function harness() {
  const window = new EventHost(), document = new EventHost();
  document.hidden = false;
  const tick = () => {};
  let loop = tick, changeProject;
  const released = [];
  const context = {
    window, document, tick,
    createStudioNavigation({ onActiveChange }) { changeProject = onActiveChange; return {}; },
    renderer: { setAnimationLoop(callback) { loop = callback; } },
    frameClock: { reset() {} }, shadowClock: { reset() {} },
    adaptiveQuality: { reset: () => 1 },
    loader: { dispose() { released.push('models'); } },
    hdrService: { dispose() { released.push('lighting'); } },
    gpuTimer: { reset() {}, dispose() { released.push('gpu-timer'); } },
    sessionStorage: { removeItem() {} }, ROOM_RETURN_KEY: 'room-return',
    tickLast: 42, rafStamp: 99, rafDeltas: [16, 17], pendingResolutionScale: 0.9,
  };
  vm.runInNewContext(`${lifecycle}\nglobalThis.state = () => ({ running, projectPageOpen });`, context);
  return { window, document, tick, released, state: context.state, loop: () => loop,
    project: open => changeProject(open),
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); } };
}

test('The room stays suspended behind a project when the tab hides and becomes visible', () => {
  const h = harness();
  h.project(true);
  assert.equal(h.loop(), null);
  h.hidden(true); assert.equal(h.loop(), null);
  h.hidden(false); assert.equal(h.loop(), null);
  assert.equal(h.state().projectPageOpen, true);
  assert.equal(h.state().running, false);
  assert.deepEqual(h.released, []);
});

test('A project return while hidden reinstalls the room loop when the tab becomes visible', () => {
  const h = harness();
  h.project(true); h.hidden(true);
  h.project(false);
  assert.equal(h.loop(), null);
  assert.equal(h.state().projectPageOpen, false);
  assert.equal(h.state().running, false);
  h.hidden(false);
  assert.equal(h.loop(), h.tick);
  assert.equal(h.state().running, true);
  assert.deepEqual(h.released, []);
});

test('BFCache restoration retains the open-project flag and restarts only an exposed room', () => {
  const h = harness();
  h.project(true);
  h.window.emit('pagehide', { persisted: true });
  h.window.emit('pageshow', { persisted: true });
  assert.equal(h.state().projectPageOpen, true);
  assert.equal(h.state().running, false);
  assert.equal(h.loop(), null);
  h.project(false);
  h.window.emit('pagehide', { persisted: true });
  assert.equal(h.state().running, false);
  h.window.emit('pageshow', { persisted: true });
  assert.equal(h.state().projectPageOpen, false);
  assert.equal(h.state().running, true);
  assert.equal(h.loop(), h.tick);
  assert.deepEqual(h.released, []);
});
