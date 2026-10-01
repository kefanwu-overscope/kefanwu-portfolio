import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';

const source = (await readFile(new URL('../../studio-inspector.js', import.meta.url), 'utf8'))
  .replace(/^import[^\n]+\n/gm, '')
  .replace('import.meta.url', 'moduleURL')
  .replace('export function createStudioInspector', 'function createStudioInspector');

function setup(options, runtime = {}) {
  const canvas = new EventTarget();
  canvas.getBoundingClientRect = () => ({ width: 1000, height: 660 });
  const document = new EventTarget(); document.hidden = false;
  const media = new EventTarget(); media.matches = false;
  const frames = new Map(), renders = [], renderers = [];
  let frameID = 0;
  class Renderer {
    constructor(settings) {
      this.settings = settings; this.debug = {}; this.info = { memory: {}, render: {} };
      renderers.push(this);
    }
    setClearColor(color, alpha) { this.clearColor = color; this.clearAlpha = alpha; }
    setPixelRatio() {}
    setSize() {}
    render(scene, camera) { renders.push({ scene, camera, clearAlpha: this.clearAlpha }); }
    dispose() { this.disposed = true; }
  }
  class Controls extends EventTarget {
    constructor(camera) { super(); this.object = camera; this.target = new THREE.Vector3(); }
    update() { return false; }
    dispose() {}
  }
  const context = {
    THREE: { ...THREE, WebGLRenderer: Renderer, PMREMGenerator: class {
      fromScene() { return { texture: new THREE.Texture(), dispose() {} }; }
      dispose() {}
    } },
    OrbitControls: Controls,
    RoomEnvironment: class { dispose() {} },
    createProjectResourceCache: () => ({ stats: () => ({}), dispose() {} }),
    moduleURL: new URL('../../studio-inspector.js', import.meta.url).href,
    URL, AbortController, console, performance,
    document, window: { innerWidth: 1400, devicePixelRatio: 1, matchMedia: () => media },
    requestAnimationFrame: callback => { frames.set(++frameID, callback); return frameID; },
    cancelAnimationFrame: id => frames.delete(id),
    ResizeObserver: class { observe() {} disconnect() {} },
    ...runtime,
  };
  vm.runInNewContext(source, context);
  const inspector = context.createStudioInspector({ canvas, ...options });
  return {
    inspector, canvas, renderer: renderers[0], renders, buildResource: context.buildResource,
    draw() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(17)); },
  };
}

test('Integrated surfaces clear to alpha zero and leave the source lighting and camera intact', () => {
  const app = setup({ transparentBackground: true });
  app.draw();
  const { scene, camera, clearAlpha } = app.renders.at(-1);
  assert.equal(app.renderer.settings.alpha, true, 'Canvas must expose an alpha channel to the page');
  assert.equal(clearAlpha, 0, 'Empty canvas pixels must not cover the page');
  assert.equal(scene.background, null, 'A Three color background would force opaque pixels despite clear alpha');
  assert.ok(scene.environment?.isTexture, 'Transparent surface still uses the source lighting environment');
  assert.equal(scene.environmentIntensity, .65);
  assert.equal(scene.children.filter(child => child.isLight).length, 3);
  assert.equal(app.renderer.toneMapping, THREE.ACESFilmicToneMapping);
  assert.equal(app.renderer.toneMappingExposure, 1.05);
  assert.deepEqual(camera.position.toArray(), [3, 2, 3]);
  app.inspector.dispose();
});

test('Existing inspector consumers retain the solid neutral surface by default', () => {
  const app = setup();
  app.draw();
  const { scene, clearAlpha } = app.renders.at(-1);
  assert.equal(app.renderer.settings.alpha, false);
  assert.equal(clearAlpha, 1);
  assert.equal(scene.background.getHex(), 0x191919);
  app.inspector.dispose();
});

test('Context restoration reapplies the chosen clear alpha before the next render', () => {
  for (const transparentBackground of [true, false]) {
    const app = setup({ transparentBackground });
    app.draw();
    const lost = new Event('webglcontextlost', { cancelable: true });
    app.canvas.dispatchEvent(lost);
    assert.equal(lost.defaultPrevented, true);
    app.renderer.setClearColor(0, .5);
    app.canvas.dispatchEvent(new Event('webglcontextrestored'));
    app.draw();
    assert.equal(app.renders.at(-1).clearAlpha, transparentBackground ? 0 : 1);
    assert.equal(app.renderer.clearColor, 0x191919);
    assert.equal(app.renders.at(-1).scene.background === null, transparentBackground);
    app.inspector.dispose();
  }
});

test('Initial and full mechanism resources frame the same complete signed motion envelope', async () => {
  const envelope = { min: [-2, -3, -.5], max: [4, 7, 8] };
  const app = setup(undefined, { createSampledMotion: () => ({ bounds: envelope, seek() {}, buffers: new Set(), duration: 14 }) });
  const manifest = { schema: 'studio-motion-v1', coordinates: 'blender-z-up', nodes: [], materials: [],
    bounds: { motion: { min: [-1, -1, -1], max: [1, 1, 1] } } };
  const entry = app.buildResource('steering', manifest, new ArrayBuffer(0), new ArrayBuffer(0), {
    initial: true, loadMotion: async () => new ArrayBuffer(0),
  });
  const firstBounds = entry.bounds.clone();
  const expected = new THREE.Box3();
  for (const x of [envelope.min[0], envelope.max[0]]) {
    for (const y of [envelope.min[1], envelope.max[1]]) for (const z of [envelope.min[2], envelope.max[2]]) {
      expected.expandByPoint(new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    }
  }
  assert.ok(firstBounds.equals(expected), 'Initial geometry must include positive and negative travel before camera fitting');
  await entry.ensureMotion();
  assert.ok(entry.bounds.equals(firstBounds), 'Completing motion download must not change the initial camera envelope');
  entry.dispose(); app.inspector.dispose();
});

test('Main case pages expose the live controller without preloading its Three dependency tree', async () => {
  const html = await readFile(new URL('../../case-study.html', import.meta.url), 'utf8');
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /<script type="module" src="project-case-3d\.js/);
  assert.doesNotMatch(html, /<link[^>]+rel="(?:modulepreload|preload)"[^>]+(?:three|studio-inspector|studio-motion)/);
  assert.doesNotMatch(html, /<body[^>]+data-case-mode="studio"/);
});
