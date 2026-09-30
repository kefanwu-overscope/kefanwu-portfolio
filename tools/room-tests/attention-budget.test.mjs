import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';
import { FrameBudgetScheduler, scheduleShaderPrewarm } from '../../experience-frame-budget.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
async function until(check) {
  for (let i = 0; i < 200; i++) { if (check()) return; await pause(); }
  assert.fail('Timed out waiting for asynchronous work');
}
const loaderSource = (await readFile(new URL('../../experience-lod.js', import.meta.url), 'utf8'))
  .replace(/^import .*?;\r?\n/gm, '').replace(/export /g, '');
function loaderHarness(count = 4) {
  const requests = [], parsed = [], mounts = [], ended = [], failures = [], gates = new Map();
  const models = Object.fromEntries(Array.from({ length: count }, (_, i) => [`models/${i}.glb`, {
    low: `models/lod/${i}.glb`, high: `models/optimized/${i}.glb`,
    sourceBounds: { min: [-0.1, -0.1, -0.1], max: [0.1, 0.1, 0.1] }
  }]));
  let active = 0, maxActive = 0;
  const context = { THREE, AbortController, DOMException, performance, setTimeout, clearTimeout,
    console: { warn() {} }, scheduler: { yield: () => Promise.resolve() },
    GLTFLoader: class { async parseAsync(bytes) {
      parsed.push(new TextDecoder().decode(bytes));
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial()));
      return { scene };
    } },
    async fetch(url, { signal } = {}) {
      if (url.includes('manifest')) return { ok: true, json: async () => ({ version: 1, models }) };
      requests.push(url); active++; maxActive = Math.max(maxActive, active);
      const gate = deferred(); gates.set(url, gate);
      signal?.addEventListener('abort', () => gate.reject(new DOMException('Aborted', 'AbortError')), { once: true });
      try { await gate.promise; return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer }; }
      finally { active--; }
    }
  };
  vm.runInNewContext(loaderSource + '\nglobalThis.Loader=ModelLODLoader; globalThis.Queue=AssetQueue;', context);
  const loader = new context.Loader({ itemStart() {}, itemEnd: value => ended.push(value), itemError: value => failures.push(value) });
  for (let i = 0; i < count; i++) loader.load(`models/${i}.glb`, () => mounts.push(i), undefined, () => {}, null, `p${i}`);
  const release = url => { assert(gates.has(url), `request exists: ${url}`); gates.get(url).resolve(); };
  const ready = async () => {
    while (requests.filter(url => url.includes('/lod/')).length < count) {
      for (const [url, gate] of gates) if (url.includes('/lod/')) gate.resolve();
      await pause();
    }
    for (const [url, gate] of gates) if (url.includes('/lod/')) gate.resolve();
    loader.start(); await until(() => ended.length === count);
  };
  return { loader, requests, parsed, mounts, ended, failures, release, ready,
    maxActive: () => maxActive, Queue: context.Queue };
}

test('attention reprioritizes waiting base transfers and preparation without exceeding three transfers', async () => {
  const h = loaderHarness(6);
  try {
    await until(() => h.requests.length === 3);
    assert.equal(h.loader.setAttention('p5'), true);
    h.release('models/lod/0.glb');
    await until(() => h.requests.length === 4);
    assert.equal(h.requests[3], 'models/lod/5.glb');
    await h.ready();
    assert.equal(h.parsed[0], 'models/lod/5.glb');
    assert.equal(h.mounts.length, 6);
    assert.equal(new Set(h.mounts).size, 6);
    assert.equal(h.failures.length, 0);
    assert(h.maxActive() <= 3);
  } finally { h.loader.dispose(); }
});

test('a slow background download cannot block preparation of a downloaded attended root', async () => {
  const h = loaderHarness(2);
  try {
    await until(() => h.requests.length === 2);
    h.loader.setAttention('p1'); h.loader.start();
    h.release('models/lod/1.glb');
    await until(() => h.mounts.length === 1);
    assert.deepEqual(h.mounts, [1]);
    h.release('models/lod/0.glb'); await until(() => h.ended.length === 2);
    assert.deepEqual(h.mounts, [1, 0]);
  } finally { h.loader.dispose(); }
});

test('attention requests only its visible high root, honors idle permission, and swaps in update', async () => {
  const h = loaderHarness(4);
  try {
    await h.ready();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20); camera.position.z = 5;
    h.loader.enabled = true; h.loader.setAttention('p2');
    h.loader.update(camera, null, 1); await pause();
    assert.equal(h.requests.length, 4);
    h.loader.allowUpgrades = true; h.loader.update(camera, null, 2);
    await until(() => h.requests.length === 5);
    assert.equal(h.requests[4], 'models/optimized/2.glb');
    h.release('models/optimized/2.glb'); await until(() => h.loader.records[2].highLoaded);
    assert.equal(h.loader.records[2].currentLevel, 'low');
    h.loader.update(camera, null, 3);
    assert.equal(h.loader.records[2].currentLevel, 'high');
    assert.equal(h.requests.length, 5);
  } finally { h.loader.dispose(); }
});

test('selected root is admitted before earlier near roots in the same update', async () => {
  const h = loaderHarness(4);
  try {
    await h.ready();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20); camera.position.z = 1;
    h.loader.enabled = h.loader.allowUpgrades = true;
    h.loader.update(camera, 'p3', 1);
    await until(() => h.requests.length === 5);
    assert.equal(h.requests[4], 'models/optimized/3.glb');
    assert.equal(h.loader.getStats().selectedKey, 'p3');
  } finally { h.loader.dispose(); }
});

test('attention changes discard obsolete queued upgrades without spending a retry', async () => {
  const h = loaderHarness(2);
  try {
    await h.ready();
    const gate = deferred(); const block = h.loader.queue.add(() => gate.promise, -1000);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20); camera.position.z = 5;
    h.loader.enabled = h.loader.allowUpgrades = true;
    h.loader.setAttention('p0'); h.loader.update(camera, null, 1);
    h.loader.setAttention('p1'); h.loader.update(camera, null, 2);
    gate.resolve(); await block;
    await until(() => h.requests.length === 3);
    assert.equal(h.requests[2], 'models/optimized/1.glb');
    h.release('models/optimized/1.glb');
    await until(() => h.loader.records.every(record => !record.loading));
    assert.equal(h.loader.records[0].attempts, 0);
    assert(!h.requests.includes('models/optimized/0.glb'));
  } finally { h.loader.dispose(); }
});

test('queue priority and eligibility callback failures do not strand other jobs', async () => {
  const h = loaderHarness(0);
  try {
    const q = new h.Queue(1), ran = [];
    const failed = q.add(() => ran.push('bad'), 0, () => { throw Error('eligibility'); });
    const rejection = assert.rejects(failed, /eligibility/);
    const valid = q.add(() => ran.push('good'), () => { throw Error('rank'); });
    q.start(); await Promise.all([valid, rejection]); assert.deepEqual(ran, ['good']);
  } finally { h.loader.dispose(); }
});

test('moving/idle budgets, live priorities, and dispatch caps govern auxiliary starts', async () => {
  let clock = 0, high = false;
  const scheduler = new FrameBudgetScheduler({ now: () => clock, maxInFlight: 3, maxStartsPerTick: 2 });
  const ran = [];
  const run = key => () => { ran.push(key); clock += 0.2; return key; };
  const a = scheduler.schedule(run('a'), { priority: 10 });
  const b = scheduler.schedule(run('b'), { priority: () => high ? -5 : 20 });
  const c = scheduler.schedule(run('idle'), { priority: -10, idleOnly: true });
  high = true;
  assert.equal(scheduler.tick({ moving: true, frameMs: 2, frameBudgetMs: 8.33 }), 2);
  assert.deepEqual(ran, ['b', 'a']);
  await Promise.all([a, b]); await pause();
  assert.equal(scheduler.tick({ moving: false, frameMs: 2 }), 1);
  assert.equal((await c).value, 'idle');
  assert.equal(scheduler.getStats().lastSubmittedMs, 0.20000000000000007);
});

test('no spare time or invalid timing prevents dispatch; larger tasks wait for idle', async () => {
  const scheduler = new FrameBudgetScheduler(); let ran = 0;
  const pending = scheduler.schedule(() => ran++, { estimateMs: 1 });
  assert.equal(scheduler.tick({ moving: false, frameMs: 10, frameBudgetMs: 8.33 }), 0);
  assert.equal(scheduler.tick({ moving: false, frameMs: NaN }), 0);
  assert.equal(scheduler.tick({ moving: true, frameMs: 0 }), 0);
  assert.equal(ran, 0);
  assert.equal(scheduler.tick({ moving: false, frameMs: 0 }), 1);
  await pending; assert.equal(ran, 1);
});

test('superseding an active generation cancels its result but retains the real concurrency slot', async () => {
  let clock = 0; const scheduler = new FrameBudgetScheduler({ now: () => clock });
  const gate = deferred(); let context;
  const first = scheduler.schedule(ctx => { context = ctx; clock += 0.3; return gate.promise; }, { key: 'shader' });
  scheduler.tick(); clock = 50;
  const second = scheduler.schedule(() => 'new', { key: 'shader' });
  assert.equal((await first).status, 'cancelled'); assert(context.signal.aborted); assert.equal(context.isCurrent(), false);
  assert.equal(scheduler.tick(), 0); assert.equal(scheduler.getStats().active, 1);
  gate.resolve('stale'); await until(() => scheduler.getStats().active === 0);
  assert.equal(scheduler.tick(), 1); assert.equal((await second).value, 'new');
  const stats = scheduler.getStats(); assert.equal(stats.cancelled, 1); assert.equal(stats.completed, 1);
  assert.equal(stats.history[0].submitMs, 0.3); assert.equal(stats.history[0].elapsedMs, 50);
});

test('synchronous overrun is measured and stops further starts rather than claiming preemption', async () => {
  let clock = 0; const scheduler = new FrameBudgetScheduler({ now: () => clock, maxInFlight: 2 });
  const expensive = scheduler.schedule(() => { clock += 7; });
  const next = scheduler.schedule(() => 'next');
  assert.equal(scheduler.tick(), 1);
  assert.equal((await expensive).submitMs, 7); assert.equal(scheduler.getStats().overruns, 1);
  await pause(); scheduler.tick(); assert.equal((await next).value, 'next');
});

test('task failures reject, release slots, and disposal cancels queued and running work', async () => {
  const scheduler = new FrameBudgetScheduler();
  const failed = scheduler.schedule(() => { throw Error('prepare failed'); });
  const rejection = assert.rejects(failed, /prepare failed/); scheduler.tick(); await rejection;
  await until(() => scheduler.getStats().active === 0);
  const gate = deferred();
  const active = scheduler.schedule(() => gate.promise); scheduler.tick();
  const pending = scheduler.schedule(() => assert.fail('disposed task ran'));
  scheduler.dispose(); assert.equal((await active).status, 'cancelled'); assert.equal((await pending).status, 'cancelled');
  assert.equal(scheduler.tick(), 0); gate.resolve(); await pause();
  assert.equal(scheduler.getStats().failed, 1);
});

test('shader prewarm restores render target immediately and waits for real compilation', async () => {
  const scheduler = new FrameBudgetScheduler();
  const gate = deferred(), root = {}, scene = {}, camera = {}, original = {}, linear = {};
  let current = original, face = 3, level = 2, calls = 0;
  const renderer = {
    getRenderTarget: () => current, getActiveCubeFace: () => face, getActiveMipmapLevel: () => level,
    setRenderTarget: (target, cube = 0, mip = 0) => { current = target; face = cube; level = mip; },
    compileAsync: (object, view, targetScene) => {
      calls++; assert.equal(object, root); assert.equal(view, camera); assert.equal(targetScene, scene);
      assert.equal(current, linear); return gate.promise;
    }
  };
  const job = scheduleShaderPrewarm(scheduler, { renderer, root, camera, scene, renderTarget: linear });
  assert.equal(scheduler.tick({ moving: true }), 0);
  assert.equal(scheduler.tick(), 1);
  assert.equal(current, original); assert.equal(face, 3); assert.equal(level, 2);
  assert.equal(calls, 1); assert.equal(scheduler.getStats().active, 1);
  gate.resolve(); assert.equal((await job).value.prepared, true);
});

test('shader compile failure restores target and unsupported compilation is reported honestly', async () => {
  const scheduler = new FrameBudgetScheduler(); const original = {}; let current = original;
  const renderer = { getRenderTarget: () => current, setRenderTarget: target => { current = target; },
    compileAsync: () => { throw Error('shader failure'); } };
  const failed = scheduleShaderPrewarm(scheduler, { renderer, root: {}, scene: {}, camera: {}, renderTarget: {} });
  const rejection = assert.rejects(failed, /shader failure/); scheduler.tick(); await rejection;
  assert.equal(current, original); await until(() => scheduler.getStats().active === 0);
  const unsupported = scheduleShaderPrewarm(scheduler, { renderer: {} }); scheduler.tick();
  assert.deepEqual((await unsupported).value, { prepared: false, reason: 'unsupported' });
});
