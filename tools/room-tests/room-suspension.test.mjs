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
  const window = new EventHost(), document = new EventHost(), canvas = new EventHost();
  document.hidden = false;
  const tick = () => {};
  let loop = tick, changeProject, contextLost = false, shadowInvalidations = 0;
  const released = [], invalidations = [], timers = [], ambientSuspensions = [], refreshes = [];
  const reducedMotionQuery = new EventHost();
  const gl = { isContextLost: () => contextLost };
  const context = {
    window, document, tick, reducedMotionQuery, prefersReducedMotion: false,
    suspendAmbient(reason) { ambientSuspensions.push(reason); }, ambientVisibilityAt: 42,
    createStudioNavigation({ onActiveChange }) { changeProject = onActiveChange; return {}; },
    renderer: { domElement: canvas, getContext: () => gl, shadowMap: { needsUpdate: false },
      setAnimationLoop(callback) { loop = callback; } },
    frameClock: { reset() {} }, shadowClock: { reset() {} },
    adaptiveQuality: { reset: () => 1 },
    loader: { dispose() { released.push('models'); } },
    hdrService: { dispose() { released.push('lighting'); } },
    gpuTimer: { reset() {}, dispose() { released.push('gpu-timer'); } },
    GpuFrameTimer: class {
      constructor(value) { assert.equal(value, gl); timers.push(this); }
      reset() {}
      dispose() { released.push('restored-gpu-timer'); }
    },
    advanced: { invalidate(reason, options = {}) { invalidations.push({ reason, geometry: !!options.geometry }); },
      refresh(reason) { refreshes.push(reason); },
      dispose() { released.push('advanced-render'); } },
    adaptiveShadows: { invalidate() { shadowInvalidations++; }, dispose() { released.push('adaptive-shadows'); } },
    sessionStorage: { removeItem() {} }, ROOM_RETURN_KEY: 'room-return',
    tickLast: 42, rafStamp: 99, rafDeltas: [16, 17], pendingResolutionScale: 0.9,
  };
  vm.runInNewContext(`${lifecycle}\nglobalThis.state = () => ({ running, projectPageOpen });`, context);
  return { window, document, tick, released, invalidations, timers, context, ambientSuspensions, refreshes, reducedMotionQuery, state: context.state, loop: () => loop,
    shadowInvalidations: () => shadowInvalidations,
    project: open => changeProject(open),
    hidden(value) { document.hidden = value; document.emit('visibilitychange'); },
    loseContext() {
      contextLost = true; let prevented = false;
      canvas.emit('webglcontextlost', { preventDefault() { prevented = true; } });
      assert(prevented, 'Context loss must permit the browser to restore WebGL');
    },
    restoreContext() { contextLost = false; canvas.emit('webglcontextrestored'); },
  };
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
  assert.equal(h.ambientSuspensions[0], 'project');
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
  assert.equal(h.ambientSuspensions.at(-1), 'resuming');
  assert.equal(h.context.ambientVisibilityAt, -Infinity);
});

test('Changing reduced-motion preference freezes decorative phase and resets its cadence without invalidating ray geometry', () => {
  const h = harness();
  h.reducedMotionQuery.emit('change', { matches: true });
  assert.equal(h.context.prefersReducedMotion, true); assert.equal(h.context.frameClock.idleFps, 1);
  assert.equal(h.ambientSuspensions.at(-1), 'reduced-motion');
  assert.deepEqual(h.refreshes, ['motion-preference']); assert.deepEqual(h.invalidations, []);
  h.reducedMotionQuery.emit('change', { matches: false });
  assert.equal(h.context.prefersReducedMotion, false); assert.equal(h.context.frameClock.idleFps, 30);
  assert.equal(h.ambientSuspensions.at(-1), 'resuming'); assert.equal(h.context.tickLast, null);
  assert.equal(h.context.ambientVisibilityAt, -Infinity);
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

test('Restoring a converged idle room invalidates histories, geometry, shadows and GPU timing before resuming', () => {
  const h = harness();
  h.loseContext();
  assert.equal(h.loop(), null); assert.equal(h.state().running, false);
  assert.deepEqual(h.released, ['gpu-timer']);
  assert.deepEqual(h.invalidations.at(-1), { reason: 'webgl-context-lost', geometry: false });
  h.restoreContext();
  assert.equal(h.loop(), h.tick); assert.equal(h.state().running, true);
  assert.deepEqual(h.invalidations.at(-1), { reason: 'webgl-context-restored', geometry: true });
  assert.equal(h.shadowInvalidations(), 1); assert.equal(h.context.renderer.shadowMap.needsUpdate, true);
  assert.equal(h.timers.length, 1); assert.equal(h.context.gpuTimer, h.timers[0]);
  assert.equal(h.context.tickLast, null);
});

test('A restored context stays suspended behind a project until the room is exposed', () => {
  const h = harness(); h.project(true); h.loseContext(); h.restoreContext();
  assert.equal(h.state().projectPageOpen, true); assert.equal(h.state().running, false);
  assert.equal(h.loop(), null); assert.equal(h.shadowInvalidations(), 1);
  h.project(false); assert.equal(h.loop(), h.tick); assert.equal(h.state().running, true);
});

test('A context restored while hidden cannot resume until both tab visibility and project state permit it', () => {
  const h = harness(); h.project(true); h.hidden(true); h.loseContext(); h.restoreContext();
  assert.equal(h.loop(), null); assert.equal(h.state().running, false);
  h.project(false); assert.equal(h.loop(), null); assert.equal(h.state().running, false);
  h.hidden(false); assert.equal(h.loop(), h.tick); assert.equal(h.state().running, true);
});

test('The actual render eligibility gates reject even a forced QA frame during WebGL context loss', () => {
  const gateStart = source.indexOf('  const tick = (t, forced) => {', end);
  const gateEnd = source.indexOf('    const cameraMoved', gateStart);
  assert(gateStart >= 0 && gateEnd > gateStart);
  let lost = true;
  const context = { readiness: { assets: true, construction: true, prepared: true }, running: true,
    renderer: { getContext: () => ({ isContextLost: () => lost }) } };
  vm.runInNewContext(`${source.slice(gateStart, gateEnd)}return 'eligible';};globalThis.forced = () => tick(0, true);`, context);
  assert.equal(context.forced(), undefined);
  lost = false; assert.equal(context.forced(), 'eligible');
});
