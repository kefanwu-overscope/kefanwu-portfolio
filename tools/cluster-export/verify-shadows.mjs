import assert from 'node:assert/strict';
import { ShadowBudgetPolicy, createAdaptiveShadows } from '../../experience-shadow-budget.js';
const checks = [];
const check = (label, run) => { run(); checks.push(label); };
check('Overview downgrade requires a continuous settled candidate', () => {
  const p = new ShadowBudgetPolicy();
  assert.equal(p.sample({ now: 0 }).keySize, 2048);
  assert.equal(p.sample({ now: 2199 }).keySize, 2048);
  assert.equal(p.sample({ now: 2200 }).keySize, 1024);
});
check('Camera movement forbids map reallocations and restarts the candidate', () => {
  const p = new ShadowBudgetPolicy();
  p.sample({ now: 0 });
  assert.equal(p.sample({ now: 2200, moving: true }).keySize, 2048);
  assert.equal(p.sample({ now: 2400 }).keySize, 2048);
  assert.equal(p.sample({ now: 4599 }).keySize, 2048);
  assert.equal(p.sample({ now: 4600 }).keySize, 1024);
});
check('Focus upgrade respects map cooldown and distance hysteresis', () => {
  const p = new ShadowBudgetPolicy(); p.sample({ now: 0 }); p.sample({ now: 2200 });
  assert.equal(p.sample({ now: 2400, attentionKey: 'seat', attentionDistance: 3 }).keySize, 1024);
  assert.equal(p.sample({ now: 6100, attentionKey: 'seat', attentionDistance: 3.9 }).keySize, 1024);
  assert.equal(p.sample({ now: 6200, attentionKey: 'seat', attentionDistance: 3.9 }).keySize, 2048);
  assert.equal(p.sample({ now: 10300, attentionKey: 'seat', attentionDistance: 4.1 }).keySize, 2048);
});
check('Missing focus coordinates never trigger a focus-related downgrade', () => {
  const p = new ShadowBudgetPolicy();
  p.sample({ now: 0, attentionKey: 'resume' });
  assert.equal(p.sample({ now: 10000, attentionKey: 'resume' }).keySize, 2048);
});
check('Mobile and hardware texture limits bound every requested resolution', () => {
  const p = new ShadowBudgetPolicy({ lowTier: true, maxTextureSize: 512 });
  const value = p.sample({ now: 0, attentionKey: 'resume', attentionDistance: 1, spotDistance: 1 });
  assert.equal(value.keySize, 512); assert.equal(value.spotSize, 512);
});
let disposals = 0;
const light = (size, position) => ({ position, target: { position: { x: 0, y: 0, z: 0 } }, intensity: 1, castShadow: true,
  shadow: { autoUpdate: false, needsUpdate: true, radius: 7, map: { dispose() { disposals++; } }, mapPass: null,
    mapSize: { x: size, y: size, set(x, y) { this.x = x; this.y = y; } },
    camera: { near: .5, far: 20, left: -4, right: 4, top: 4, bottom: -4 } } });
const key = light(2048, { x: 2.6, y: 4.6, z: 2.4 });
const spot = light(1024, { x: 0, y: 1, z: 0 });
const renderer = { shadowMap: { enabled: true, autoUpdate: false, needsUpdate: false }, capabilities: { maxTextureSize: 8192 } };
const camera = { position: { x: 0, y: 3, z: 6 } };
const originalCoverage = JSON.stringify({ key: key.shadow.camera, spot: spot.shadow.camera, target: key.target.position });
const controller = createAdaptiveShadows({ renderer, key, resumeSpot: spot });
const draw = () => { key.shadow.needsUpdate = spot.shadow.needsUpdate = renderer.shadowMap.needsUpdate = false; };
check('Initial source shadow is drawn once, then camera-only motion reuses it', () => {
  controller.update({ camera, now: 0 }); draw();
  const result = controller.update({ camera, moving: true, now: 100 });
  assert.equal(result.needsUpdate, false); assert.equal(controller.getStats().keyRequests, 1);
});
check('Settled resolution changes dispose old targets and preserve all light coverage', () => {
  controller.update({ camera, now: 300 });
  const result = controller.update({ camera, now: 2500 });
  assert.equal(result.changed, true); assert.equal(result.keySize, 1024); assert.equal(result.spotSize, 512);
  assert.equal(disposals, 2); assert.equal(key.shadow.radius, 3.5);
  assert.equal(JSON.stringify({ key: key.shadow.camera, spot: spot.shadow.camera, target: key.target.position }), originalCoverage);
  draw();
});
check('UI/intensity changes do not invalidate cached depth', () => {
  key.intensity = .73; spot.intensity = 1.017;
  assert.equal(controller.update({ camera, now: 2600 }).needsUpdate, false);
});
check('Moving caster refreshes are throttled but final settled pose draws immediately', () => {
  controller.update({ camera, now: 2700, movingCasters: true }); assert(key.shadow.needsUpdate); draw();
  controller.update({ camera, now: 2710, movingCasters: true }); assert(!key.shadow.needsUpdate);
  controller.update({ camera, now: 2720, movingCasters: false }); assert(key.shadow.needsUpdate); draw();
});
check('Light pose and explicit geometry changes invalidate without waiting for a quality budget', () => {
  key.position.x += .1;
  assert(controller.update({ camera, now: 2800 }).needsUpdate); draw();
  assert(controller.update({ camera, now: 2801, geometryDirty: true }).needsUpdate); draw();
});
check('Inactive light defers geometry invalidation until it becomes visible', () => {
  spot.intensity = 0;
  controller.update({ camera, now: 2900, geometryDirty: { spot: true } }); assert(!spot.shadow.needsUpdate); draw();
  spot.intensity = 1; controller.update({ camera, now: 3000 }); assert(spot.shadow.needsUpdate); draw();
});
controller.dispose();
check('Disposed controller issues no further rendering work', () => assert.equal(controller.update({ camera, now: 9000, geometryDirty: true }).needsUpdate, false));
console.log(JSON.stringify({ status: 'passed', checks, stats: controller.getStats() }, null, 2));
