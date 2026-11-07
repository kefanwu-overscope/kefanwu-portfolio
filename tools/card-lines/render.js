import * as THREE from 'three';
import { createStudioInspector } from '/__lines/inspector/studio-inspector.js';

/**
 * One project per page load: render.html?key=<project>.
 *
 * 1. The pinned inspector loads the project exactly as the white-studio cover
 *    exporter did (900x600 canvas at selection, source camera reset, progress 0;
 *    AURA with its dated derivative framing) and the 1800x1200 cover frame is
 *    captured the same way (PNG, plus WebP q.94 like the published file).
 * 2. With that same camera and pose, two geometry passes at OUT_W*ss wide
 *    write a G-buffer: view normal + part id + 24-bit view depth. The Python
 *    step (lines.py) turns it into the line drawing. No pixel of the cover is
 *    read to make the lines; the cover is only used to check registration.
 */
const params = new URLSearchParams(location.search);
const key = params.get('key');
const OUT_W = 1200, OUT_H = 800;
const SS = Number(params.get('ss') || 4);
const hide = (params.get('hide') || '').split('|').filter(Boolean).map((source) => new RegExp(source));
// Clear parts (acrylic, glass): the main layer leaves them out so the parts the
// cover shows through them are drawn; a second layer holds only the clear parts.
const glass = (params.get('glass') || '').split('|').filter(Boolean).map((source) => new RegExp(source));
const status = document.querySelector('#status');
const canvas = document.querySelector('canvas');
const output = document.createElement('canvas');
const context2d = output.getContext('2d', { alpha: false });
const say = (text) => { status.textContent = text; };
const post = async (name, body) => {
  const response = await fetch(`/__lines/out/${key}/${name}`, { method: 'POST', body });
  if (!response.ok) throw new Error(`write failed ${name}`);
};
const blob = (type, quality) => new Promise((resolve) => output.toBlob(resolve, type, quality));

let last = null;
const inspector = createStudioInspector({ canvas, transparentBackground: false, backgroundColor: 0xffffff, quality: 'high',
  derivativeFrames: key === 'aura', afterRender: (frame) => { last = frame; } });

// tools/white-studio/export.js capture(), unchanged geometry and timing.
async function capture(width, height) {
  canvas.style.width = `${width / Math.min(devicePixelRatio || 1, 2)}px`;
  canvas.style.height = `${height / Math.min(devicePixelRatio || 1, 2)}px`;
  output.width = width; output.height = height; inspector.resize();
  await new Promise((resolve, reject) => requestAnimationFrame(() => {
    try { context2d.fillStyle = '#ffffff'; context2d.fillRect(0, 0, width, height); context2d.drawImage(canvas, 0, 0, width, height); resolve(); } catch (error) { reject(error); }
  }));
  return { png: await blob('image/png'), webp: await blob('image/webp', width > 1280 ? .94 : .87) };
}

const VERTEX = `precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
in vec3 position;
in vec3 normal;
#ifdef USE_OPACITY
in float attributeOpacity;
out float vOpacity;
#endif
out vec3 vNormal;
out float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalMatrix * normal;
  vDepth = -mv.z;
#ifdef USE_OPACITY
  vOpacity = attributeOpacity;
#endif
  gl_Position = projectionMatrix * mv;
}`;
// pass 0: view normal (rgb) + depth byte 2; pass 1: part id (rg) + depth bytes 0-1.
const FRAGMENT = `precision highp float;
uniform float partId;
uniform vec2 depthRange;
uniform float pass;
in vec3 vNormal;
in float vDepth;
#ifdef USE_OPACITY
in float vOpacity;
#endif
out vec4 outColor;
void main() {
#ifdef USE_OPACITY
  if (vOpacity < 0.5) discard;
#endif
  float t = floor(clamp((vDepth - depthRange.x) / (depthRange.y - depthRange.x), 0.0, 1.0) * 16777215.0);
  float b0 = floor(t / 65536.0);
  float rest = t - b0 * 65536.0;
  float b1 = floor(rest / 256.0);
  float b2 = rest - b1 * 256.0;
  if (pass < 0.5) {
    vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
    outColor = vec4(n * 0.5 + 0.5, b2 / 255.0);
  } else {
    outColor = vec4(floor(partId / 256.0) / 255.0, mod(partId, 256.0) / 255.0, b0 / 255.0, b1 / 255.0);
  }
}`;

function materialsOf(object) { return Array.isArray(object.material) ? object.material : [object.material]; }

async function geometryPass({ renderer, scene, camera, nodes }, layer = 'main') {
  const width = OUT_W * SS, height = OUT_H * SS;
  const objects = [...new Set(nodes)];
  const records = [], swaps = [];
  camera.updateMatrixWorld(true);
  const box = new THREE.Box3(), corner = new THREE.Vector3();
  let zMin = Infinity, zMax = -Infinity;
  objects.forEach((object, index) => {
    const materials = materialsOf(object);
    const opacity = Math.max(...materials.map((m) => (m.transparent ? m.opacity : 1)));
    const carbon = materials.some((m) => m.userData.source?.procedural?.type === 'carbon');
    let shown = object.visible, parent = object.parent;
    while (shown && parent) { shown = parent.visible; parent = parent.parent; }
    const clear = glass.some((test) => test.test(object.name));
    const hidden = !!object.userData.presentationHidden || materials.every((m) => m.visible === false) || opacity < .02 || hide.some((test) => test.test(object.name))
      || (layer === 'main' ? clear : !clear);
    const included = shown && !hidden;
    records.push({ id: index + 1, name: object.name, group: object.userData.group || null, visible: shown, included,
      hiddenBy: !shown ? 'invisible' : hidden ? (hide.some((test) => test.test(object.name)) ? 'hide-param' : opacity < .02 ? 'opacity'
        : (layer === 'main' ? clear : !clear) ? `layer-${layer}` : 'presentation') : null, clear,
      vertices: object.geometry.attributes.position.count, carbonOpacity: carbon && !!object.geometry.attributes.attributeOpacity,
      materials: materials.map((m) => ({ name: m.name, type: m.type, transparent: m.transparent, opacity: +m.opacity.toFixed(4), transmission: +(m.transmission || 0).toFixed(4),
        side: m.side, unlit: !!m.userData.source?.unlit, procedural: m.userData.source?.procedural?.type || null })) });
    if (!included) { swaps.push({ object, visible: object.visible, material: object.material }); object.visible = false; return; }
    if (!object.frustumCulled || object.geometry.boundingBox === null) object.geometry.computeBoundingBox();
    box.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const depth = -corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse).z;
      zMin = Math.min(zMin, depth); zMax = Math.max(zMax, depth);
    }
    const side = materials[0].side;
    const defines = object.userData && carbon && object.geometry.attributes.attributeOpacity ? { USE_OPACITY: '' } : {};
    const material = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERTEX, fragmentShader: FRAGMENT, defines, side,
      uniforms: { partId: { value: index + 1 }, depthRange: { value: new THREE.Vector2() }, pass: { value: 0 } } });
    swaps.push({ object, visible: object.visible, material: object.material, line: material });
  });
  const pad = (zMax - zMin) * .02 + 1e-6;
  const range = [zMin - pad, zMax + pad];
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat, minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: true, samples: 0 });
  const background = scene.background, clearAlpha = renderer.getClearAlpha(), clearColor = renderer.getClearColor(new THREE.Color());
  const shadowsPending = renderer.shadowMap?.needsUpdate;
  const buffers = [];
  try {
    if (renderer.shadowMap) renderer.shadowMap.needsUpdate = false;
    scene.background = null;
    for (const swap of swaps) if (swap.line) swap.object.material = swap.line;
    renderer.setClearColor(0x000000, 0);
    for (const pass of [0, 1]) {
      for (const swap of swaps) if (swap.line) { swap.line.uniforms.pass.value = pass; swap.line.uniforms.depthRange.value.set(range[0], range[1]); }
      renderer.setRenderTarget(target);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      const pixels = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      buffers.push(pixels);
    }
  } finally {
    for (const swap of swaps) { swap.object.material = swap.material; swap.object.visible = swap.visible; swap.line?.dispose(); }
    renderer.setRenderTarget(null);
    renderer.setClearColor(clearColor, clearAlpha);
    scene.background = background;
    if (renderer.shadowMap) renderer.shadowMap.needsUpdate = shadowsPending;
    target.dispose();
  }
  const projection = camera.projectionMatrix.elements;
  return { buffers, meta: { width, height, ss: SS, depthRange: range, flipY: true,
    // World units per G-buffer pixel (orthographic: constant).
    unitsPerPixel: camera.isOrthographicCamera ? (camera.right - camera.left) / camera.zoom / width : null,
    camera: { type: camera.type, left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom, zoom: camera.zoom,
      position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: [...projection] },
    objects: records } };
}

async function run() {
  if (!key) throw new Error('render.html?key=<project>');
  const started = performance.now();
  say(`Loading ${key}`);
  const loaded = await inspector.selectProject(key);
  if (!loaded) throw new Error(`Model missing ${key}`);
  await loaded.whenMotionReady;
  if (!inspector.getState().motionReady) throw new Error(`Motion missing ${key}`);
  inspector.reset({ camera: true });
  inspector.setProgress(0);
  const cover = await capture(1800, 1200);
  if (!last) throw new Error('No finished frame reached the line pass');
  const state = inspector.getState();
  await post('beauty-1800.png', cover.png);
  await post('beauty-1800.webp', cover.webp);
  say(`Line G-buffer ${key}`);
  const { buffers, meta } = await geometryPass(last);
  await post('gbuffer-normal.rgba', buffers[0]);
  await post('gbuffer-id.rgba', buffers[1]);
  let clearLayer = null;
  if (glass.length) {
    const layer = await geometryPass(last, 'glass');
    await post('gbuffer-glass-normal.rgba', layer.buffers[0]);
    await post('gbuffer-glass-id.rgba', layer.buffers[1]);
    clearLayer = layer.meta;
  }
  const result = { key, ...meta, inspectorCamera: state.camera, progress: state.progress, derivativeFrames: key === 'aura',
    hide: hide.map(String), glass: glass.map(String), glassLayer: clearLayer, userAgent: navigator.userAgent, devicePixelRatio, elapsedMilliseconds: performance.now() - started };
  await post('meta.json', JSON.stringify(result, null, 1));
  say(`Done ${key}`);
  return { key, objects: meta.objects.length, included: meta.objects.filter((o) => o.included).length };
}

window.__lines = run().then((value) => ({ ok: true, value }), (error) => { say(`Failed: ${error.stack}`); return { ok: false, error: String(error.stack || error) }; })
  .finally(() => inspector.dispose());
