import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';

const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
async function until(check) {
  for (let i = 0; i < 200; i++) { if (check()) return; await pause(); }
  assert.fail('Timed out waiting for loader work');
}
const source = (await readFile(new URL('../../experience-lod.js', import.meta.url), 'utf8'))
  .replace(/^import .*?;\r?\n/gm, '').replace(/export /g, '');

function harness({ models = {}, holdManifest = false, holdTransfers = false, parse = null } = {}) {
  const requests = [], gates = new Map(), starts = [], ends = [], errors = [], mounts = [], notifications = [];
  const manifest = deferred();
  if (!holdManifest) manifest.resolve();
  let managerLoads = 0, transfers = 0, maxTransfers = 0;
  const manager = new THREE.LoadingManager(() => managerLoads++);
  const itemStart = manager.itemStart.bind(manager), itemEnd = manager.itemEnd.bind(manager), itemError = manager.itemError.bind(manager);
  manager.itemStart = token => { starts.push(token); itemStart(token); };
  manager.itemEnd = token => { ends.push(token); itemEnd(token); };
  manager.itemError = token => { errors.push(token); itemError(token); };
  manager.itemStart('construction');
  const context = {
    THREE, AbortController, DOMException, performance, setTimeout, clearTimeout,
    console: { warn() {} }, scheduler: { yield: () => Promise.resolve() },
    GLTFLoader: class {
      async parseAsync(bytes) {
        const url = new TextDecoder().decode(bytes);
        if (parse) await parse(url);
        const scene = new THREE.Group();
        scene.name = url;
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshStandardMaterial()));
        return { scene };
      }
    },
    async fetch(url, { signal } = {}) {
      if (url.includes('manifest')) {
        signal?.addEventListener('abort', () => manifest.resolve(), { once: true });
        await manifest.promise;
        return { ok: true, json: async () => ({ version: 1, models }) };
      }
      requests.push(url); transfers++; maxTransfers = Math.max(maxTransfers, transfers);
      const gate = deferred(); gates.set(url, gate);
      if (!holdTransfers) gate.resolve();
      // Deliberately let an already-started response arrive after cancellation.
      // The loader must still reject it before parsing or mounting anything.
      try {
        await gate.promise;
        return { ok: true, arrayBuffer: async () => new TextEncoder().encode(url).buffer };
      } finally { transfers--; }
    },
  };
  vm.runInNewContext(source + '\nglobalThis.Loader = ModelLODLoader;', context);
  const loader = new context.Loader(manager);
  loader.onBaseLoaded = record => notifications.push(record);
  const load = (url, options = {}, onError = null) => loader.load(url, gltf => {
    const parent = new THREE.Group(); parent.add(gltf.scene); mounts.push({ url, root: gltf.scene });
  }, undefined, onError, null, null, options);
  const finishConstruction = () => { loader.start(); manager.itemEnd('construction'); };
  const cleanup = async () => {
    loader.dispose(); manifest.resolve();
    for (const gate of gates.values()) gate.resolve();
    await pause();
  };
  return { loader, load, manager, requests, gates, starts, ends, errors, mounts, notifications, manifest,
    finishConstruction, cleanup, managerLoads: () => managerLoads, maxTransfers: () => maxTransfers };
}

test('deferred props neither request bytes nor hold/restart initial manager readiness', async () => {
  const h = harness();
  try {
    const essential = h.load('models/essential.glb', { direct: true });
    const prop = h.load('models/prop.glb', { deferred: true, direct: true });
    let allSettled = false;
    const all = h.loader.whenAllReady().then(records => { allSettled = true; return records; });
    h.finishConstruction();
    await essential.done;
    assert.equal(h.managerLoads(), 1);
    assert.deepEqual(h.requests, ['models/essential.glb']);
    assert.equal(h.loader.getStats().deferred.pending, 1);
    assert.equal(allSettled, false);
    assert.equal(h.loader.network.jobs.length, 0);
    assert.equal(h.loader.queue.jobs.length, 0);
    h.loader.releaseDeferred(); h.loader.releaseDeferred();
    await prop.done;
    assert.equal((await all).length, 2);
    assert.equal(h.managerLoads(), 1);
    assert.equal(h.starts.length, 2); // construction + essential, never prop
    assert.equal(h.ends.length, 2);
    assert.equal(h.requests.filter(url => url === prop.url).length, 1);
    assert.equal(h.notifications.filter(record => record === prop).length, 1);
    assert.equal(h.loader.getStats().deferred.ready, 1);
  } finally { await h.cleanup(); }
});

test('direct current assets finish while the legacy manifest is still pending', async () => {
  const h = harness({ holdManifest: true });
  try {
    const legacy = h.load('models/legacy.glb');
    const current = h.load('models/room-current/current.glb.gz', { direct: true });
    h.finishConstruction();
    await current.done;
    assert.equal(current.baseStatus, 'ready');
    assert.deepEqual(h.requests, [current.url]);
    assert.equal(legacy.baseStatus, 'queued');
    h.manifest.resolve(); await legacy.done;
    assert.equal(legacy.baseStatus, 'ready');
    assert.equal(h.managerLoads(), 1);
  } finally { await h.cleanup(); }
});

test('late instance preparation is awaited before placement and the notification follows bounds', async () => {
  const h = harness(), prepared = deferred();
  try {
    let raw, entered = false;
    const record = h.load('models/prop.glb', { deferred: true, direct: true });
    h.loader.beforeMount = async (scene, pending) => {
      raw = scene; entered = true;
      assert.equal(pending, record);
      assert.equal(scene.parent, null);
      await prepared.promise;
      scene.userData.prepared = true;
    };
    h.loader.onBaseLoaded = mounted => {
      assert.equal(mounted, record);
      assert(mounted.holder.parent);
      assert(mounted.bounds instanceof THREE.Box3);
      assert.equal(mounted.baseStatus, 'ready');
      assert.equal(mounted.holder.children[0], raw);
      assert.equal(raw.userData.prepared, true);
      h.notifications.push(mounted);
    };
    h.finishConstruction(); h.loader.releaseDeferred();
    await until(() => entered);
    assert.equal(h.mounts.length, 0);
    prepared.resolve(); await record.done;
    assert.equal(h.mounts.length, 1);
    assert.equal(h.notifications.length, 1);
  } finally { prepared.resolve(); await h.cleanup(); }
});

test('disposal settles unreleased props immediately and never starts them later', async () => {
  const h = harness();
  try {
    const record = h.load('models/prop.glb', { deferred: true });
    h.finishConstruction();
    const all = h.loader.whenAllReady();
    h.loader.dispose(); h.loader.dispose(); h.loader.releaseDeferred();
    assert.equal((await record.done).baseStatus, 'cancelled');
    assert.equal((await all).length, 1);
    assert.equal(h.loader.getStats().deferred.cancelled, 1);
    assert.equal(h.requests.length, 0);
    assert.equal(h.mounts.length, 0);
    assert.equal(h.notifications.length, 0);
    assert.equal(h.managerLoads(), 1);
    assert.equal(h.starts.length, h.ends.length);
  } finally { await h.cleanup(); }
});

test('disposal stops queued transfers and ignores late active responses without holding allReady', async () => {
  const h = harness({ holdTransfers: true });
  try {
    const records = Array.from({ length: 6 }, (_, i) => h.load(`models/prop${i}.glb`, { deferred: true, direct: true }));
    h.finishConstruction(); h.loader.releaseDeferred();
    await until(() => h.requests.length === 3);
    const all = h.loader.whenAllReady();
    h.loader.dispose();
    assert.equal((await all).length, 6);
    assert(records.every(record => record.baseStatus === 'cancelled'));
    for (const gate of h.gates.values()) gate.resolve();
    await until(() => h.loader.network.active === 0);
    assert.equal(h.requests.length, 3);
    assert.equal(h.mounts.length, 0);
    assert.equal(h.notifications.length, 0);
    assert(h.maxTransfers() <= 3);
    assert.equal(h.managerLoads(), 1);
  } finally { await h.cleanup(); }
});

test('disposal during async beforeMount prevents mounting and balances initial tokens once', async () => {
  const h = harness(), prepared = deferred();
  try {
    let entered = false;
    const record = h.load('models/essential.glb', { direct: true, beforeMount: async () => {
      entered = true; await prepared.promise;
    } });
    h.finishConstruction(); await until(() => entered);
    h.loader.dispose();
    assert.equal((await record.done).baseStatus, 'cancelled');
    assert.equal(h.starts.length, h.ends.length);
    prepared.resolve(); await until(() => h.loader.queue.active === 0);
    assert.equal(h.mounts.length, 0);
    assert.equal(h.notifications.length, 0);
    assert.equal(h.managerLoads(), 1);
    assert.equal(h.starts.length, h.ends.length);
  } finally { prepared.resolve(); await h.cleanup(); }
});

test('deferred legacy props retain low and optimized fallback without changing initial progress', async () => {
  const h = harness({ models: { 'models/prop.glb': {
    low: 'models/lod/prop.glb', high: 'models/optimized/prop.glb',
    sourceBounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  } }, parse: async url => { if (url !== 'models/prop.glb') throw Error('Invalid derivative'); } });
  try {
    const record = h.load('models/prop.glb', { deferred: true });
    h.finishConstruction(); h.loader.releaseDeferred();
    await record.done;
    assert.equal(record.baseStatus, 'ready');
    assert.deepEqual(h.requests, ['models/lod/prop.glb', 'models/optimized/prop.glb', 'models/prop.glb']);
    assert.equal(h.mounts.length, 1);
    assert.equal(h.managerLoads(), 1);
    assert.equal(h.errors.length, 0);
  } finally { await h.cleanup(); }
});

test('failed deferred preparation settles, reports failure once, and does not reopen initial manager', async () => {
  const h = harness(); let failures = 0;
  try {
    const record = h.load('models/prop.glb', { deferred: true, direct: true,
      beforeMount: () => { throw Error('Preparation failed'); } }, () => failures++);
    h.finishConstruction(); h.loader.releaseDeferred();
    await h.loader.whenAllReady();
    assert.equal(record.baseStatus, 'failed');
    assert.equal(failures, 1);
    assert.equal(h.mounts.length, 0);
    assert.equal(h.notifications.length, 0);
    assert.equal(h.errors.length, 0);
    assert.equal(h.managerLoads(), 1);
    assert.equal(h.loader.getStats().deferred.failed, 1);
  } finally { await h.cleanup(); }
});

test('allReady snapshots registered bases; later deferred registrations are admitted after release', async () => {
  const h = harness({ holdTransfers: true });
  try {
    const first = h.load('models/first.glb', { deferred: true, direct: true });
    const firstBatch = h.loader.whenAllReady();
    h.finishConstruction(); h.loader.releaseDeferred();
    const second = h.load('models/second.glb', { deferred: true, direct: true });
    await until(() => h.requests.length === 2);
    h.gates.get(first.url).resolve();
    assert.equal((await firstBatch).length, 1);
    assert.equal(first.baseStatus, 'ready');
    assert.equal(second.baseStatus, 'loading');
    h.gates.get(second.url).resolve();
    assert.equal((await h.loader.whenAllReady()).length, 2);
    assert.equal(h.managerLoads(), 1);
  } finally { await h.cleanup(); }
});

test('instance notification rejection cannot fail a successfully mounted base', async () => {
  const h = harness();
  try {
    h.loader.onBaseLoaded = async () => { throw Error('Optional refinement failed'); };
    const record = h.load('models/essential.glb', { direct: true });
    h.finishConstruction(); await record.done;
    assert.equal(record.baseStatus, 'ready');
    assert.equal(h.mounts.length, 1);
    assert.equal(h.errors.length, 0);
    assert.equal(h.managerLoads(), 1);
  } finally { await h.cleanup(); }
});
