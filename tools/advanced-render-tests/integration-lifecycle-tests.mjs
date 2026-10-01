// Run the actual orchestration source with controllable asynchronous boundaries.
// GPU math and real renderer-state restoration have separate browser proofs.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';
import { FrameBudgetScheduler } from '../../experience-frame-budget.js';

const source = await readFile(new URL('../../experience-advanced.js', import.meta.url), 'utf8');
const threeURL = new URL('../../vendor/three/0.185.0/build/three.module.js', import.meta.url).href;
globalThis.location = { href: 'https://example.test/experience.html' };
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const checks = [];
let sequence = 0;

async function setup({ lowTier = false } = {}) {
  const env = { geometry: [], captures: [], begins: [], publications: [], disposed: [], invalidations: [],
    clusterUpdates: 0, captureCreations: 0, captureRenders: 0, resolves: [], depthDisposals: [], targetDisposals: [0, 0] };
  let tracerOptions, temporalConverged = true;
  const ray = { available: false, hasGeometry: false, state: 'uninitialized', samples: 0 };
  const bridge = { stats: { enabled: false }, install() {}, invalidate(reason) { this.stats.enabled = false; env.invalidations.push(reason); },
    publish(update, snapshot) { this.stats.enabled = true; env.publications.push({ update, snapshot }); }, dispose() { env.disposed.push('bridge'); } };
  const temporal = {
    get converged() { return temporalConverged; },
    resize() {}, invalidate() { temporalConverged = false; }, warmup: async () => {},
    begin(camera) { this.previous = camera.projectionMatrix.clone(); camera.projectionMatrix.elements[8] += .001; },
    restore(camera) { if (this.previous) { camera.projectionMatrix.copy(this.previous); this.previous = null; } },
    resolve(frame) { env.resolves.push(frame); temporalConverged = true; }, getStats: () => ({ converged: temporalConverged }),
    dispose() { env.disposed.push('temporal'); },
  };
  const tracer = {
    get stats() { return { ...ray }; },
    initialize: async () => { ray.available = true; ray.state = 'idle'; return true; },
    async setGeometry(_scene, options) {
      const request = { ...deferred(), generation: options.generation }; env.geometry.push(request);
      const success = await request.promise;
      if (success) { ray.hasGeometry = true; ray.generation = options.generation; ray.state = 'ready'; }
      return success;
    },
    begin(frame) { env.begins.push(frame); ray.state = 'accumulating'; return true; },
    step: async () => true,
    invalidate() { ray.samples = 0; if (ray.available) ray.state = 'idle'; },
    dispose() { ray.available = false; ray.state = 'disposed'; env.disposed.push('tracer'); },
  };
  let captureNumber = 0;
  globalThis.__advancedLifecycleMocks = {
    getGpuDevice: async () => null, getGpuDeviceStats: () => ({ status: 'mocked-boundary' }),
    createTemporalUpscaler: () => temporal,
    createStationaryRayTracer: options => { tracerOptions = options; return tracer; },
    createRaytraceMaterialBridge: () => bridge,
    createRaytraceGBufferCapture: () => {
      const name = ++captureNumber === 1 ? 'capture' : 'depthCapture';
      env.captureCreations++;
      return {
        async capture() { const request = deferred(); env.captures.push(request); return request.promise; },
        render() { env.captureRenders++; }, dispose() { env.disposed.push(name); }, depthTexture: {},
      };
    },
    createClusterRenderer: () => ({
      registerRoot: async () => [], update() { env.clusterUpdates++; },
      getStats: () => ({ indexUploads: 0 }), dispose() { env.disposed.push('clusters'); },
    }),
    FrameBudgetScheduler, scheduleShaderPrewarm: async () => ({ status: 'completed' }),
  };
  const stripped = source.replace(/^import .*;\r?\n/gm, '');
  const mocked = `import * as THREE from '${threeURL}';\nconst { getGpuDevice, getGpuDeviceStats, createTemporalUpscaler, createStationaryRayTracer, createRaytraceGBufferCapture, createRaytraceMaterialBridge, createClusterRenderer, FrameBudgetScheduler, scheduleShaderPrewarm } = globalThis.__advancedLifecycleMocks;\n${stripped}\n// case ${++sequence}`;
  const { createAdvancedRenderer } = await import(`data:text/javascript;base64,${Buffer.from(mocked).toString('base64')}`);
  const renderer = {}, scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  const targets = [0, 1].map(index => ({ width: 32, height: 32, texture: {}, depthTexture: null, depthBuffer: true,
    dispose() { env.targetDisposals[index]++; } }));
  const composer = { renderTarget1: targets[0], renderTarget2: targets[1], readBuffer: targets[1], pixelRatio: 1,
    setPixelRatio(value) { this.pixelRatio = value; },
    setSize(width, height) {
      for (const target of targets) {
        target.width = Math.round(width * this.pixelRatio); target.height = Math.round(height * this.pixelRatio);
      }
    },
    render() {
      if (env.throwOnRender) throw Error('Synthetic render failure');
      // Follow EffectComposer's output-buffer contract even if a future mobile
      // pass swaps buffers. The resolve must use this frame's completed target.
      this.readBuffer = this.readBuffer === targets[0] ? targets[1] : targets[0];
    } };
  const key = new THREE.DirectionalLight(), resumeSpot = new THREE.SpotLight();
  const gtao = lowTier ? null : { depthTexture: {} };
  const instance = createAdvancedRenderer({ renderer, scene, camera, composer, gtao, key, resumeSpot, lowTier });
  const depthTextures = targets.map(target => target.depthTexture);
  for (const texture of depthTextures) texture?.addEventListener('dispose', () => env.depthDisposals.push(texture));
  instance.resize(32, 32, 1);
  Object.assign(env, { instance, scene, camera, bridge, temporal, tracer, composer, targets, depthTextures,
    update: (now, options = {}) => instance.update({ now, moving: false, lightStamp: 'true:2k:1.0000', ...options }),
    tick: () => instance.schedule({ moving: false, frameMs: 0, frameBudgetMs: 1000 / 60 }),
    emit: update => tracerOptions.onUpdate(update),
    deviceLost() { ray.available = false; ray.state = 'fallback'; tracerOptions.onState({ state: 'fallback', reason: 'synthetic-device-loss' }); },
    frame: { width: 1, height: 1, normalDepth: new Float32Array([0, 0, 1, 3]),
      cameraWorld: new THREE.Matrix4().elements, inverseProjection: camera.projectionMatrixInverse.elements },
  });
  env.update(0); instance.render(); env.update(1000); env.tick(); await flush();
  return env;
}
async function readyGeometry(env) {
  assert.equal(env.geometry.length, 1); env.geometry[0].resolve(true); await flush();
  assert.equal(env.instance.getStats().geometryDirty, false);
}
async function capture(env, now = 1200) {
  env.update(now); env.tick(); await flush(); assert.equal(env.captures.length, 1);
}

async function main() {
{
  const env = await setup(); await readyGeometry(env); await capture(env);
  env.captures[0].resolve(env.frame); await flush(); env.emit({ samples: 24 }); env.instance.render();
  const stats = env.instance.getStats(), invalidations = env.invalidations.length;
  const object = new THREE.Mesh(new THREE.BoxGeometry(.2, .2, .2), new THREE.MeshStandardMaterial());
  object.position.set(-.3, 0, -3); env.scene.add(object); env.scene.updateMatrixWorld(true);
  assert.equal(env.update(1500, { ambientChanged: true }), true);
  env.instance.render({ dynamicObjects: [object] });
  const first = env.resolves.at(-1).rects[0];
  assert(first && first[2] > first[0]); assert.equal(env.resolves.at(-1).moving, false);
  object.position.x = .3; env.scene.updateMatrixWorld(true);
  assert.equal(env.update(1600, { ambientChanged: true }), true);
  env.instance.render({ dynamicObjects: [object] });
  const next = env.resolves.at(-1).rects[0];
  assert(next[0] <= first[0] && next[2] > first[2], 'Reactive mask spans the previous and current moving footprint');
  assert.equal(env.instance.getStats().inputScale, stats.inputScale);
  assert.equal(env.instance.getStats().revision, stats.revision);
  assert.equal(env.invalidations.length, invalidations);
  assert.equal(env.bridge.stats.enabled, true); assert.equal(env.begins.length, 1);
  assert.equal(env.update(1700), false, 'Pausing ambient work returns to the fully converged cache');
  env.instance.dispose();
  checks.push('Visible ambient motion renders at rest with current/previous reactive masks while retaining native resolution, RT capture and static history');
}
{
  const env = await setup(); await readyGeometry(env); await capture(env);
  env.instance.invalidate('project-open'); env.captures[0].resolve(env.frame); await flush();
  assert.equal(env.begins.length, 0); assert.equal(env.publications.length, 0);
  assert.equal(env.instance.getStats().capturing, false);
  env.instance.dispose(); checks.push('Project/visibility invalidation rejects an outstanding capture before ray tracing begins');
}
{
  const env = await setup(); await readyGeometry(env); await capture(env);
  env.update(1300, { moving: true }); env.captures[0].resolve(env.frame); await flush();
  assert.equal(env.begins.length, 0); assert.equal(env.publications.length, 0);
  env.instance.dispose(); checks.push('Camera movement invalidates a capture waiting for GPU readback');
}
{
  const env = await setup();
  assert.equal(env.geometry[0].generation, 0);
  env.instance.invalidate('model-upgrade', { geometry: true });
  env.geometry[0].resolve(true); await flush();
  assert.equal(env.instance.getStats().geometryDirty, true);
  env.update(1300); env.tick(); await flush();
  assert.equal(env.geometry.length, 2); assert.equal(env.geometry[1].generation, 1);
  assert.equal(env.captures.length, 0);
  env.geometry[1].resolve(true); await flush(); await capture(env, 1400);
  env.captures[0].resolve(env.frame); await flush();
  assert.equal(env.begins.length, 1); assert.equal(env.begins[0].generation, 1);
  env.instance.dispose(); checks.push('A completed obsolete BVH cannot clear the newer geometry generation or start a stale capture');
}
{
  const env = await setup(); await readyGeometry(env); await capture(env);
  env.captures[0].resolve(env.frame); await flush();
  env.emit({ samples: 1 }); assert.equal(env.bridge.stats.enabled, true);
  env.deviceLost(); assert.equal(env.bridge.stats.enabled, false);
  env.emit({ samples: 2 }); assert.equal(env.publications.length, 1);
  assert.equal(env.update(1500), true); env.instance.render();
  assert.equal(env.update(1600), false); assert.equal(env.captures.length, 1);
  assert(env.clusterUpdates > 0);
  env.instance.dispose(); checks.push('WebGPU fallback clears refinement, redraws raster once, then returns to the converged cache');
}
{
  const env = await setup(); await readyGeometry(env); await capture(env);
  env.instance.dispose(); env.captures[0].resolve(env.frame); await flush();
  env.emit({ samples: 1 }); assert.equal(env.publications.length, 0); assert.equal(env.begins.length, 0);
  assert.deepEqual(env.disposed.sort(), ['bridge', 'capture', 'clusters', 'temporal', 'tracer']);
  assert.equal(env.instance.getStats().scheduler.disposed, true);
  assert.equal(env.instance.getStats().scheduler.pending, 0);
  checks.push('Disposal reaches all owned resources and rejects late capture/publication results');
}
{
  const env = await setup({ lowTier: true });
  env.instance.render(); await flush(); env.instance.render();
  assert.equal(env.update(1300), false);
  env.instance.invalidate('project-return'); assert.equal(env.update(1400), true);
  const projection = env.camera.projectionMatrix.clone(); env.throwOnRender = true;
  assert.throws(() => env.instance.render(), /Synthetic render failure/);
  assert.deepEqual(env.camera.projectionMatrix.elements, projection.elements);
  env.instance.dispose();
  assert.deepEqual(env.disposed.sort(), ['bridge', 'capture', 'clusters', 'temporal', 'tracer']);
  assert.equal(env.depthDisposals.length, 2); assert(env.targets.every(target => target.depthTexture === null));
  checks.push('Cached room redraws after return; thrown rendering restores jitter and teardown releases the mobile depth textures');
}
{
  const env = await setup({ lowTier: true });
  assert.equal(env.captureCreations, 1, 'Mobile must not construct a second normal/depth capture');
  assert.equal(env.captureRenders, 0); assert.equal(env.captures.length, 0);
  assert(env.depthTextures.every(texture => texture?.isDepthTexture && texture.type === THREE.UnsignedIntType));
  assert.notEqual(env.depthTextures[0], env.depthTextures[1]);
  assert.deepEqual(env.targetDisposals, [1, 1], 'Adding depth invalidates each pre-existing composer target once');
  assert.equal(env.resolves.at(-1).depth, env.composer.readBuffer.depthTexture);
  const firstDepth = env.resolves.at(-1).depth;
  env.instance.render();
  assert.equal(env.resolves.at(-1).depth, env.composer.readBuffer.depthTexture);
  assert.notEqual(env.resolves.at(-1).depth, firstDepth, 'Resolve follows the actual composer output after a swap');
  assert.equal(env.captureRenders, 0, 'Depth comes from the scene render, with no additional capture render');
  env.instance.dispose();
  assert.equal(new Set(env.depthDisposals).size, 2, 'Both owned depth textures emit disposal');
  assert.deepEqual(env.targetDisposals, [1, 1], 'Teardown does not dispose the borrowed composer targets');
  assert(env.targets.every(target => target.depthTexture === null));
  checks.push('Mobile reuses both composer depth targets, follows buffer swaps, avoids a capture pass and disposes only its owned textures');
}
console.log(JSON.stringify({ status: 'passed', checks }, null, 2));
}
try { await main(); }
catch (error) {
  const shorten = value => String(value).replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g, '[orchestration module]');
  const location = shorten(error.stack || '').split('\n').find(line => line.includes('integration-lifecycle-tests.mjs'))?.trim();
  console.error(JSON.stringify({ status: 'failed', checksCompleted: checks.length, message: shorten(error.message).slice(0, 1400), location }, null, 2));
  process.exitCode = 1;
}
