import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const checks = [];
async function check(name, run) { await run(); checks.push(name); }
const read = (file) => fs.readFile(path.join(root, file), 'utf8');
const pause = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(test) {
  for (let i = 0; i < 300; i++) { if (test()) return; await pause(2); }
  assert.fail('Asynchronous test did not settle');
}
function moduleContext(source, extras = {}) {
  const context = { THREE, setTimeout, clearTimeout, performance, AbortController, DOMException,
    console: { warn() {} }, scheduler: { yield: () => pause() }, ...extras };
  vm.runInNewContext(source.replace(/^import .*?;\r?\n/gm, '').replace(/export /g, ''), context);
  return context;
}
const timing = moduleContext(`${await read('experience-timing.js')}\nglobalThis.Clock=AdaptiveFrameClock; globalThis.alpha=frameAlpha;`);
await check('Idle cadence is 30 fps on 60 Hz and 120 Hz displays', () => {
  for (const hz of [60, 120]) {
    const clock = new timing.Clock();
    let frames = 0;
    for (let i = 0; i < hz * 10; i++) if (clock.accept(i * 1000 / hz)) frames++;
    assert.equal(frames, 300);
  }
});
await check('Orbit input immediately restores display-rate frames then settles', () => {
  const clock = new timing.Clock();
  assert(clock.accept(0)); clock.noteMotion(1);
  assert(clock.accept(1000 / 120)); assert.equal(clock.snapshot().targetFps, 120);
  clock.accept(500); assert.equal(clock.snapshot().targetFps, 30);
});
await check('Easing reaches the same position at 30 Hz and 60 Hz', () => {
  const values = [30, 60].map((hz) => {
    let x = 0;
    for (let i = 0; i < hz; i++) x += (1 - x) * timing.alpha(0.08, 1000 / hz);
    return x;
  });
  assert(Math.abs(values[0] - values[1]) < 1e-12);
});

const loaderSource = await read('experience-lod.js');
function loaderHarness({ count = 6, failLow = false, badLow = false, manifestFail = false, stalled = false } = {}) {
  let activeDownloads = 0, maxDownloads = 0, activeParses = 0, maxParses = 0, aborted = 0, mounts = 0;
  const requests = [], parsed = [], pending = new Set(), failures = [];
  const models = {};
  for (let i = 0; i < count; i++) models[`models/${i}.glb`] = {
    low: `models/lod/${i}.glb`, high: `models/optimized/${i}.glb`,
    sourceBounds: { min: [-0.1, -0.1, -0.1], max: [0.1, 0.1, 0.1] },
  };
  class GLTFLoader {
    async parseAsync(data) {
      activeParses++; maxParses = Math.max(maxParses, activeParses);
      const name = new TextDecoder().decode(data);
      try {
        await pause(3);
        parsed.push(name);
        if (badLow && name.includes('/lod/')) throw Error('Bad GLB');
        const scene = new THREE.Group();
        scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshStandardMaterial()));
        return { scene };
      } finally { activeParses--; }
    }
  }
  const fetch = async (url, { signal } = {}) => {
    if (url.includes('manifest')) return { ok: !manifestFail, status: 503, json: async () => ({ version: 1, models }) };
    requests.push(url); activeDownloads++; maxDownloads = Math.max(maxDownloads, activeDownloads);
    try {
      await new Promise((resolve, reject) => {
        const timer = stalled ? null : setTimeout(resolve, 8);
        signal.addEventListener('abort', () => { clearTimeout(timer); aborted++; reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
      });
      return { ok: !(failLow && url.includes('/lod/')), status: 404,
        arrayBuffer: async () => new TextEncoder().encode(url).buffer };
    } finally { activeDownloads--; }
  };
  const context = moduleContext(`${loaderSource}\nglobalThis.Loader=ModelLODLoader; globalThis.Queue=AssetQueue;`, { GLTFLoader, fetch });
  const manager = { itemStart: (x) => pending.add(x), itemEnd: (x) => pending.delete(x), itemError: (x) => failures.push(x) };
  const loader = new context.Loader(manager, { requestTimeoutMs: stalled ? 25 : 3000 });
  const register = (n = count) => { for (let i = 0; i < n; i++) loader.load(`models/${i}.glb`, () => mounts++, undefined, () => {}); };
  return { loader, register, pending, requests, parsed, failures, Queue: context.Queue,
    stats: () => ({ activeDownloads, maxDownloads, activeParses, maxParses, aborted, mounts }) };
}
await check('Three downloads overlap before construction completes; parses wait for start', async () => {
  const h = loaderHarness(); h.register();
  await until(() => h.requests.length === 6);
  assert.equal(h.stats().maxDownloads, 3); assert.equal(h.stats().maxParses, 0);
  h.loader.start(); await until(() => h.pending.size === 0);
  assert.equal(h.stats().maxParses, 1); assert.equal(h.stats().mounts, 6);
  assert.equal(h.loader.getStats().network.concurrency, 3);
});
await check('Missing low models retain original exhibits through high fallback', async () => {
  const h = loaderHarness({ count: 2, failLow: true }); h.register(); h.loader.start();
  await until(() => h.pending.size === 0);
  assert.equal(h.stats().mounts, 2); assert(h.requests.some((url) => url.includes('/optimized/')));
  assert.equal(h.failures.length, 0);
});
await check('Invalid derivative geometry is parsed from the high fallback once', async () => {
  const h = loaderHarness({ count: 1, badLow: true }); h.register(); h.loader.start();
  await until(() => h.pending.size === 0);
  assert.equal(h.stats().mounts, 1); assert.equal(h.parsed.length, 2);
  assert.equal(h.loader.records[0].currentLevel, 'high');
});
await check('Missing manifest preserves original model URLs and bounded downloads', async () => {
  const h = loaderHarness({ manifestFail: true }); h.register(); h.loader.start();
  await until(() => h.pending.size === 0);
  assert.equal(h.stats().mounts, 6); assert(h.requests.every((url) => !url.includes('/lod/')));
  assert(h.stats().maxDownloads <= 3);
});
await check('Stalled network bodies abort and release readiness tokens', async () => {
  const h = loaderHarness({ count: 1, stalled: true }); h.register(); h.loader.start();
  await until(() => h.pending.size === 0);
  assert(h.stats().aborted >= 1); assert.equal(h.stats().mounts, 0);
});
await check('Leaving during download cancels pending jobs and prevents late mounting', async () => {
  const h = loaderHarness(); h.register(); h.loader.start();
  await until(() => h.requests.length >= 3); h.loader.dispose();
  await until(() => h.pending.size === 0);
  assert.equal(h.stats().mounts, 0); assert.equal(h.stats().activeDownloads, 0);
  assert.equal(h.loader.getStats().disposed, true);
});
await check('Leaving during parse never mounts its late result', async () => {
  const h = loaderHarness({ count: 1 }); h.register(); h.loader.start();
  await until(() => h.stats().activeParses > 0); h.loader.dispose();
  await until(() => h.pending.size === 0); assert.equal(h.stats().mounts, 0);
});
await check('High LOD waits for explicit idle permission and swaps only in update', async () => {
  const h = loaderHarness({ count: 1 }); h.register(); h.loader.start();
  await until(() => h.pending.size === 0);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 20); camera.position.z = 1;
  h.loader.enabled = true; h.loader.update(camera, null, 0); await pause(20);
  assert.equal(h.requests.length, 1);
  h.loader.allowUpgrades = true; h.loader.update(camera, null, 1000);
  await until(() => h.loader.records[0].highLoaded);
  assert.equal(h.loader.records[0].currentLevel, 'low');
  assert.equal(h.loader.records[0].high.visible, false);
  assert.equal(h.loader.update(camera, null, 1100), true);
  assert.equal(h.loader.records[0].currentLevel, 'high');
});
await check('Cancelled and ineligible queued work never executes', async () => {
  const h = loaderHarness({ count: 0 }); const q = new h.Queue(); let ran = 0;
  const skipped = q.add(() => ran++, 1, () => false);
  q.start(); await skipped; assert.equal(ran, 0);
  const delayed = new h.Queue(); const cancelled = delayed.add(() => ran++).catch((e) => e.name);
  delayed.cancel(); delayed.start(); assert.equal(await cancelled, 'AbortError');
  await assert.rejects(delayed.add(() => ran++), { name: 'AbortError' }); assert.equal(ran, 0);
});

const threeURL = pathToFileURL(path.join(root, 'vendor/three/0.185.0/build/three.module.js')).href;
const utilsSource = (await read('vendor/three/0.185.0/examples/jsm/utils/BufferGeometryUtils.js')).replace("from 'three'", `from '${threeURL}'`);
const utils = await import(`data:text/javascript;base64,${Buffer.from(utilsSource).toString('base64')}`);
const batching = moduleContext(`${await read('experience-batching.js')}\nglobalThis.batch=batchStaticRoom;`, { mergeGeometries: utils.mergeGeometries });
function meshGroup(material = new THREE.MeshStandardMaterial(), name = '') {
  const group = new THREE.Group(); group.name = name;
  for (let i = 0; i < 4; i++) { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), material); mesh.position.set(i * 0.08, 0.2, 0.2); group.add(mesh); }
  return group;
}
function vertices(scene) {
  scene.updateMatrixWorld(true); const points = [];
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    for (let i = 0; i < g.attributes.position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(g.attributes.position, i).applyMatrix4(o.matrixWorld);
      points.push(p.toArray().map((n) => n.toFixed(5)).join(','));
    }
  });
  return points.sort();
}
await check('Static batching preserves every transformed vertex and shared material', async () => {
  const scene = new THREE.Scene(), group = meshGroup(); scene.add(group);
  group.rotation.y = 0.3; group.scale.set(1, 0.8, 1.2);
  const material = group.children[0].material, geometry = group.children[0].geometry;
  const before = vertices(scene), originalPositions = Array.from(geometry.attributes.position.array);
  const stats = await batching.batch(scene);
  assert.equal(stats.removedDraws, 3); assert.equal(stats.triangles, 48);
  assert.deepEqual(vertices(scene), before);
  assert.equal(scene.children.find((o) => o.name === 'static-room-batch').material, material);
  assert.deepEqual(Array.from(geometry.attributes.position.array), originalPositions);
});
await check('Animated, transparent, emissive, fallback, hidden and hotspot trees remain intact', async () => {
  const scene = new THREE.Scene();
  const groups = [meshGroup(), meshGroup(new THREE.MeshStandardMaterial({ transparent: true })),
    meshGroup(new THREE.MeshStandardMaterial({ emissive: 0x123456 })), meshGroup(undefined, 'bk_room'), meshGroup(), meshGroup()];
  groups[4].visible = false; groups[5].userData.hotspot = {};
  scene.add(...groups); const stats = await batching.batch(scene, { exclude: [groups[0]] });
  assert.equal(stats.removedDraws, 0); assert(groups.every((g) => g.children.length === 4));
});
await check('Batches retain shadow flags and keep distant geometry independently culled', async () => {
  const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
  const first = meshGroup(material), second = meshGroup(material), third = meshGroup(material);
  second.position.x = 5; third.position.z = 5;
  first.children.forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
  scene.add(first, second, third);
  const stats = await batching.batch(scene);
  assert.equal(stats.batches, 3);
  const meshes = scene.children.filter((o) => o.isMesh);
  assert.equal(meshes.filter((m) => m.castShadow && m.receiveShadow).length, 1);
  assert(meshes.every((m) => m.geometry.boundingSphere.radius < 1));
});
await check('Reflected geometry keeps its original front-face winding', async () => {
  const scene = new THREE.Scene(), group = meshGroup();
  group.scale.x = -1; scene.add(group);
  const before = vertices(scene), meshes = [...group.children];
  assert.equal((await batching.batch(scene)).batches, 0);
  assert.deepEqual(group.children, meshes); assert.deepEqual(vertices(scene), before);
});

const warmup = moduleContext(`${await read('experience-warmup.js')}\nglobalThis.prepare=prepareRoomShaders;`);
function shaderHarness({ fail = false } = {}) {
  const scene = new THREE.Scene(), group = meshGroup(); scene.add(group);
  const original = group.children[0].material;
  const exempt = new THREE.MeshBasicMaterial(); exempt.allowOverride = false;
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), original, 2); scene.add(instanced);
  const exemptMesh = new THREE.Mesh(new THREE.BoxGeometry(), exempt); scene.add(exemptMesh);
  const normal = new THREE.MeshNormalMaterial(), depth = new THREE.MeshDepthMaterial();
  const fullscreen = new THREE.ShaderMaterial(), outputMaterial = new THREE.RawShaderMaterial();
  const initialTarget = { name: 'original' }, readBuffer = { name: 'linear', texture: {} };
  let target = initialTarget;
  const compiled = [];
  const renderer = { outputColorSpace: THREE.SRGBColorSpace, toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1.3, getRenderTarget: () => target, setRenderTarget: (value) => target = value,
    compileAsync(object) {
      const materials = [], instancing = [];
      object.traverse((o) => { if (o.material) { materials.push(o.material); instancing.push(!!o.isInstancedMesh); } });
      compiled.push({ target, materials, instancing });
      if (fail && materials.includes(normal)) throw Error('Shader failed');
      return Promise.resolve();
    } };
  const output = { isOutputPass: true, material: outputMaterial, renderToScreen: false,
    render(facade) {
      assert.equal(facade.outputColorSpace, THREE.SRGBColorSpace);
      assert.equal(facade.toneMapping, THREE.ACESFilmicToneMapping);
      assert.equal(this.renderToScreen, true);
      facade.setRenderTarget(null); facade.render(new THREE.Mesh(new THREE.PlaneGeometry(), outputMaterial));
    } };
  const gtao = { normalMaterial: normal, gtaoMaterial: fullscreen }, bokeh = { _materialDepth: depth };
  const composer = { readBuffer, writeBuffer: {}, passes: [gtao, bokeh, output] };
  return { scene, group, original, exempt, instanced, initialTarget, compiled, renderer, composer, gtao, bokeh, output };
}
await check('Shader warmup matches linear, override, instanced and screen-output passes without drawing', async () => {
  const h = shaderHarness();
  await warmup.prepare(h.renderer, h.scene, new THREE.PerspectiveCamera(), h.composer, h);
  assert.equal(h.compiled.length, 5);
  assert(h.compiled.slice(0, 4).every((x) => x.target === h.composer.readBuffer));
  assert.equal(h.compiled[4].target, null);
  assert(h.compiled[1].materials.includes(h.gtao.normalMaterial));
  assert(h.compiled[2].materials.includes(h.bokeh._materialDepth));
  assert(h.compiled[1].materials.includes(h.exempt));
  assert(h.compiled[1].instancing.includes(true));
  assert(h.group.children.every((o) => o.material === h.original));
  assert.equal(h.instanced.material, h.original);
  assert.equal(h.renderer.getRenderTarget(), h.initialTarget); assert.equal(h.output.renderToScreen, false);
});
await check('Shader warmup restores materials and target after preparation failure', async () => {
  const h = shaderHarness({ fail: true });
  await assert.rejects(() => warmup.prepare(h.renderer, h.scene, new THREE.PerspectiveCamera(), h.composer, h), /Shader failed/);
  assert(h.group.children.every((o) => o.material === h.original));
  assert.equal(h.instanced.material, h.original); assert.equal(h.renderer.getRenderTarget(), h.initialTarget);
});

const roomSource = await read('experience.js');
await check('Sound toggle retains mute default, persistence and accessible state', () => {
  const block = roomSource.slice(roomSource.indexOf('let sndMuted = true;'), roomSource.indexOf('\n/* =', roomSource.indexOf('let sndMuted = true;')));
  const attrs = {}, events = {}, saved = new Map();
  const button = { setAttribute: (k, v) => attrs[k] = v, classList: { toggle() {} }, addEventListener: (k, v) => events[k] = v };
  vm.runInNewContext(block, { document: { getElementById: () => button }, window: {}, performance,
    localStorage: { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) } });
  assert.equal(attrs['aria-pressed'], 'false'); events.click();
  assert.equal(attrs['aria-pressed'], 'true'); assert.equal(saved.get('kw_snd'), 'on');
  events.click(); assert.equal(attrs['aria-label'], 'Enable sound'); assert.equal(saved.get('kw_snd'), 'off');
});
await check('All 15 room project options preserve workbench navigation and return-state handoff', () => {
  const match = roomSource.match(/const PROJECT_ORDER\s*=\s*\[([^\]]+)\]/);
  assert(match); const order = vm.runInNewContext(`[${match[1]}]`); assert.equal(order.length, 15);
  const start = roomSource.indexOf('  function focusHotspot(root) {');
  const end = roomSource.indexOf('    const html =', start);
  const block = `${roomSource.slice(start, end)}\n}`;
  for (const key of order) {
    let assigned, saved;
    const state = { position: [1, 2, 3], target: [0, 1, 0], lightsOn: true, quality: '4k' };
    const context = { readiness: { revealed: true }, paperReturning: false, takeOverIntro() {},
      camera: { position: { toArray: () => state.position } }, controls: { target: { toArray: () => state.target } },
      requestedLightsOn: true, lightQuality: '4k', window: { projectData: { [key]: {} } }, ROOM_RETURN_KEY: 'return',
      sessionStorage: { setItem: (_k, value) => saved = JSON.parse(value) }, history: { state: {}, replaceState() {} },
      dismissDragHint() {}, dismissClickHint() {}, clearPointerHover() {}, document: { getElementById: () => null },
      location: { assign: (url) => assigned = url } };
    vm.runInNewContext(block, context); context.focusHotspot({ userData: { hotspot: { key } } });
    assert.equal(assigned, `project-3d.html#${key}`); assert.deepEqual(saved, state);
  }
});

console.log(JSON.stringify({ status: 'passed', checks: checks.length, names: checks }, null, 2));
