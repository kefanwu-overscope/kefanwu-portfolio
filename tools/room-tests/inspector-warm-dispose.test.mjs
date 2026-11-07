// An inspector disposed during its warm pass (a page back from the bfcache in its
// first second, the retained room closing a project, Retry) must not throw, or the
// caller's reload never runs and the stage stays on "Loading interactive model..."
// for good. Runs the real studio-inspector.js source against stand-ins for three.js
// and the DOM, recording the order in which GPU resources are released.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const SOURCE_PATH = process.env.INSPECTOR_SOURCE
  ? new URL(`file:///${process.env.INSPECTOR_SOURCE.replace(/\\/g, '/').replace(/^\/+/, '')}`)
  : new URL('../../studio-inspector.js', import.meta.url);

// Any read, call or construction gives another stand-in, and it reads as 0 in arithmetic.
function anything() {
  const stub = new Proxy(function stand() {}, {
    get(_, name) { return name === Symbol.toPrimitive ? () => 0 : name === 'then' ? undefined : stub; },
    set() { return true; },
    apply() { return stub; },
    construct() { return stub; },
  });
  return stub;
}

function harness({ extension = true } = {}) {
  const log = [];
  const programs = [];
  const uncaught = [];
  const onUnhandled = (error) => uncaught.push(error);
  process.on('unhandledRejection', onUnhandled);
  const any = anything();
  let pmremPasses = 0;
  const three = new Proxy({
    WebGLRenderer: class {
      constructor() {
        const known = {
          extensions: { has: (name) => extension && name === 'KHR_parallel_shader_compile' },
          info: { programs, memory: {}, render: {} },
          getContext: () => ({ isContextLost: () => false }),
          compile() {},
          dispose() { log.push('renderer'); },
        };
        return new Proxy(known, { get: (target, name) => (name in target ? target[name] : any), set: () => true });
      }
    },
    PMREMGenerator: class {
      fromScene() {
        const pass = ++pmremPasses;
        log.push(`pass ${pass} built`);
        return { texture: any, dispose: () => log.push(`pass ${pass} target`) };
      }
      dispose() { log.push('generator'); }
    },
  }, { get: (target, name) => target[name] ?? any });
  const source = readFileSync(SOURCE_PATH, 'utf8')
    .replace(/^import .*$/gm, '')
    .replace(/import\.meta\.url/g, '"http://stand.in/"')
    .replace(/^export function /gm, 'function ');
  const stand = { ...Object.fromEntries(['OrbitControls', 'createProjectResourceCache', 'fetchProjectBuffer', 'abortError', 'clampProgress', 'readBufferView', 'createSampledMotion', 'applyPhotoFinish', 'applyPhotoPart', 'installSourceMaterial', 'fitCameraEnvelope', 'window', 'document', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'].map((name) => [name, any])) };
  stand.RoomEnvironment = class { dispose() { log.push('room'); } };
  const names = Object.keys(stand);
  const createStudioInspector = new Function('THREE', ...names, `${source}\nreturn createStudioInspector;`)(three, ...names.map((name) => stand[name]));
  return {
    log,
    programs,
    uncaught,
    passes: () => pmremPasses,
    inspector: (options = {}) => createStudioInspector({ canvas: any, warmPrograms: true, ...options }),
    close: () => process.off('unhandledRejection', onUnhandled),
  };
}

const pause = (ms = 40) => new Promise((resolve) => setTimeout(resolve, ms));

test('Disposing during the warm pass does not throw, and the pass goes before the renderer', async () => {
  const h = harness();
  try {
    h.programs.push({ isReady: () => false, getUniforms() {} }); // a link still running
    const inspector = h.inspector();
    await pause(30);
    assert.equal(h.passes(), 1, 'Only the dry pass has run: there is no environment target yet');
    assert.doesNotThrow(() => inspector.dispose());
    assert.deepEqual(h.log, ['pass 1 built', 'pass 1 target', 'generator', 'room', 'renderer'], 'The renderer still knows the textures the pass allocated when they are released');
    await pause(40);
    assert.equal(h.passes(), 1, 'A disposed inspector builds no environment');
    assert.equal(h.log.filter((entry) => entry === 'pass 1 target').length, 1, 'The pass is released once, not again when its wait ends');
    assert.deepEqual(h.uncaught, []);
    assert.doesNotThrow(() => inspector.dispose(), 'A second dispose stays a no-op');
  } finally { h.close(); }
});

test('Disposing in the same task that created the inspector does not throw', async () => {
  const h = harness();
  try {
    h.programs.push({ isReady: () => false, getUniforms() {} });
    assert.doesNotThrow(() => h.inspector().dispose());
    await pause();
    assert.deepEqual(h.uncaught, []);
    assert.equal(h.log.at(-1), 'renderer');
  } finally { h.close(); }
});

test('A finished warm pass leaves one environment, released before the renderer', async () => {
  const h = harness();
  try {
    const program = { ready: false, isReady() { return this.ready; }, getUniforms() {} };
    h.programs.push(program);
    const inspector = h.inspector();
    await pause(30);
    program.ready = true;
    await pause();
    assert.deepEqual(h.log, ['pass 1 built', 'pass 2 built', 'room', 'generator', 'pass 1 target', 'generator', 'room'], 'The real pass runs while the dry pass still holds its programs');
    h.log.length = 0;
    inspector.dispose();
    assert.deepEqual(h.log, ['pass 2 target', 'renderer']);
    assert.deepEqual(h.uncaught, []);
  } finally { h.close(); }
});

test('Without warmPrograms, or without the extension, the environment is built at once', async () => {
  for (const options of [{ warm: false, extension: true }, { warm: true, extension: false }]) {
    const h = harness({ extension: options.extension });
    try {
      const inspector = h.inspector({ warmPrograms: options.warm });
      assert.deepEqual(h.log, ['pass 1 built', 'room', 'generator'], JSON.stringify(options));
      h.log.length = 0;
      inspector.dispose();
      assert.deepEqual(h.log, ['pass 1 target', 'renderer'], JSON.stringify(options));
      await pause(5);
      assert.deepEqual(h.uncaught, []);
    } finally { h.close(); }
  }
});
