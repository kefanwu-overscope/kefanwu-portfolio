import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { createTemporalUpscaler, temporalJitter } from '../../experience-temporal.js?v=advanced-render-20260930';

const resultElement = document.getElementById('result');
const report = window.__temporalProof = { status: 'running', startedAt: new Date().toISOString(), checks: [], shaderErrors: [] };
const W = 192, H = 192, lowW = 96, lowH = 96;
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('proof'), antialias: false, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.debug.checkShaderErrors = true;
renderer.debug.onShaderError = (gl, program, vertex, fragment) => report.shaderErrors.push({
  program: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment)
});
const readTarget = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, format: THREE.RGBAFormat,
  depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
const copyMaterial = new THREE.ShaderMaterial({
  uniforms: { color: { value: null }, depth: { value: null }, useDepth: { value: 0 } }, depthTest: false, depthWrite: false, toneMapped: false,
  vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
  fragmentShader: 'varying vec2 vUv;uniform sampler2D color,depth;uniform float useDepth;void main(){vec4 c=texture2D(color,vUv);gl_FragColor=vec4(c.rgb,mix(c.a,texture2D(depth,vUv).r,useDepth));}'
});
const copy = new FullScreenQuad(copyMaterial);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 30); camera.position.set(0, 0, 4); camera.updateMatrixWorld();
const resources = [readTarget, copyMaterial];
const histories = [];
function check(name, details, okay = true) {
  report.checks.push({ name, status: okay ? 'passed' : 'failed', ...details });
  if (!okay) throw new Error(name);
}
function target(w, h) {
  const value = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
  value.depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
  value.depthTexture.minFilter = value.depthTexture.magFilter = THREE.NearestFilter;
  resources.push(value); return value;
}
const low = target(lowW, lowH), full = target(W, H);
function upscaler() { const value = createTemporalUpscaler(renderer, { samples: 16 }); value.resize(W, H); histories.push(value); return value; }
async function pixels(texture, depth = null) {
  copyMaterial.uniforms.color.value = texture;
  copyMaterial.uniforms.depth.value = depth || texture;
  copyMaterial.uniforms.useDepth.value = depth ? 1 : 0;
  renderer.setRenderTarget(readTarget); copy.render(renderer);
  const data = new Float32Array(W * H * 4);
  await renderer.readRenderTargetPixelsAsync(readTarget, 0, 0, W, H, data);
  renderer.setRenderTarget(null);
  if (!data.every(Number.isFinite)) throw new Error('Non-finite GPU reference or history pixel');
  return data;
}
function shader(fragment) {
  const material = new THREE.ShaderMaterial({ vertexShader: 'varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: `varying vec2 uv0;void main(){${fragment}}`, toneMapped: false });
  resources.push(material); return material;
}
function plane(scene, width, height, material, z = 0) {
  const geometry = new THREE.PlaneGeometry(width, height); resources.push(geometry);
  const mesh = new THREE.Mesh(geometry, material); mesh.position.z = z; scene.add(mesh); return mesh;
}
async function reference(scene) {
  renderer.setRenderTarget(full); renderer.render(scene, camera);
  return pixels(full.texture, full.depthTexture);
}
function frame(temporal, scene, { moving = false, rects = [], reactive = false } = {}) {
  const projection = camera.projectionMatrix.clone(), inverse = camera.projectionMatrixInverse.clone();
  temporal.begin(camera, lowW, lowH);
  try {
    renderer.setRenderTarget(low); renderer.render(scene, camera);
    temporal.resolve({ color: low.texture, depth: low.depthTexture, camera, moving, rects, reactive });
  } finally { temporal.restore(camera); }
  if (!camera.projectionMatrix.equals(projection) || !camera.projectionMatrixInverse.equals(inverse)) throw new Error('Camera projection was not restored');
}
function error(a, b, include = () => true) {
  let sum = 0, count = 0, peak = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = 4 * (y * W + x); if (!include(x, y, i)) continue;
    for (let c = 0; c < 3; c++) { const difference = Math.abs(a[i + c] - b[i + c]); sum += difference; peak = Math.max(peak, difference); count++; }
  }
  return { mae: count ? sum / count : null, peak, pixels: count / 3 };
}
function bounds(mesh) {
  const box = new THREE.Box3().setFromObject(mesh), p = new THREE.Vector3();
  const rect = [1, 1, 0, 0];
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    rect[0] = Math.min(rect[0], p.x * 0.5 + 0.5); rect[1] = Math.min(rect[1], p.y * 0.5 + 0.5);
    rect[2] = Math.max(rect[2], p.x * 0.5 + 0.5); rect[3] = Math.max(rect[3], p.y * 0.5 + 0.5);
  }
  return rect;
}
try {
  check('Float framebuffer readback available', { webgl2: renderer.capabilities.isWebGL2 }, renderer.extensions.has('EXT_color_buffer_float'));
  const temporal = upscaler();
  const previousTarget = renderer.getRenderTarget();
  await temporal.warmup();
  check('Production temporal and output shader compile', { errors: report.shaderErrors.length, targetRestored: renderer.getRenderTarget() === previousTarget }, !report.shaderErrors.length && renderer.getRenderTarget() === previousTarget);

  const stationary = new THREE.Scene();
  plane(stationary, 8, 8, shader('float s=sin(uv0.x*145.+uv0.y*38.);vec3 c=vec3(.35+.12*s,.4+.08*s,.45+.05*s);float e=step(.5,uv0.x*.72+uv0.y*.28);gl_FragColor=vec4(c+e*.15,1.);'));
  const ref = await reference(stationary);
  const captures = new Map();
  for (let i = 0; i < 32; i++) {
    frame(temporal, stationary);
    if ([0, 1, 15, 16, 23, 31].includes(i)) captures.set(i, await pixels(temporal.texture));
  }
  const interior = (x, y) => x > 6 && x < W - 7 && y > 6 && y < H - 7;
  const first = error(captures.get(0), ref, interior), final = error(captures.get(31), ref, interior);
  const earlyVariation = error(captures.get(0), captures.get(1), interior), lateVariation = error(captures.get(15), captures.get(31), interior);
  check('Stationary 2× reconstruction remains bounded against full-resolution reference', { first, final, stats: temporal.getStats() }, temporal.converged && final.mae < 0.025 && final.mae <= first.mae * 1.25 + 0.0003);
  check('Repeated jitter cycle converges instead of drifting', { earlyVariation, lateVariation }, lateVariation.mae <= earlyVariation.mae * 0.9 + 0.0001);
  check('All history/reference RGBA values finite', { readbackPixels: W * H * 8 }, true);

  const occlusion = new THREE.Scene();
  plane(occlusion, 8, 8, shader('gl_FragColor=vec4(.15+uv0.x*.3,.2+uv0.y*.25,.38,1.);'));
  const blocker = plane(occlusion, 1.15, 2.3, shader('gl_FragColor=vec4(.75,.13,.08,1.);'), 1.1); blocker.position.x = -0.35;
  const disocclusion = upscaler();
  for (let i = 0; i < 16; i++) frame(disocclusion, occlusion);
  const before = await reference(occlusion);
  camera.position.x = 0.65; camera.updateMatrixWorld();
  const after = await reference(occlusion);
  frame(disocclusion, occlusion, { moving: true });
  const moved = await pixels(disocclusion.texture);
  const revealed = (x, y, i) => interior(x, y) && after[i + 3] - before[i + 3] > 0.002;
  const revealedError = error(moved, after, revealed), movedError = error(moved, after, interior);
  check('Camera translation and disocclusion reject old foreground', { revealedError, movedError }, revealedError.pixels > 100 && revealedError.mae < 0.035 && movedError.mae < 0.035);
  camera.position.x = 0; camera.updateMatrixWorld();

  const dynamic = new THREE.Scene();
  plane(dynamic, 8, 8, shader('gl_FragColor=vec4(.25,.28,.31,1.);'));
  const movingPlane = plane(dynamic, 1.8, 1.8, shader('float s=.03*sin(uv0.x*50.+uv0.y*8.);gl_FragColor=vec4(vec3(.45+s),1.);'), 1);
  const reactiveImages = [];
  for (const useReactive of [false, true]) {
    movingPlane.position.x = 0; const history = upscaler();
    for (let i = 0; i < 16; i++) frame(history, dynamic);
    const oldRect = bounds(movingPlane); movingPlane.position.x = 0.045; const newRect = bounds(movingPlane);
    const union = [Math.min(oldRect[0], newRect[0]), Math.min(oldRect[1], newRect[1]), Math.max(oldRect[2], newRect[2]), Math.max(oldRect[3], newRect[3])];
    frame(history, dynamic, { moving: true, rects: useReactive ? [union] : [] });
    reactiveImages.push(await pixels(history.texture));
  }
  const dynamicRef = await reference(dynamic);
  const overlapInterior = (x, y) => x > 65 && x < 127 && y > 65 && y < 127;
  const unmaskedError = error(reactiveImages[0], dynamicRef, overlapInterior), maskedError = error(reactiveImages[1], dynamicRef, overlapInterior);
  check('Reactive moving foreground follows current pixels more closely', { unmaskedError, maskedError }, maskedError.mae < 0.02 && maskedError.mae < unmaskedError.mae * 0.9);

  temporal.resize(80, 48); const resized = temporal.getStats();
  check('Resize invalidates history and reports two RGBA16F targets', resized, resized.samples === 0 && resized.width === 80 && resized.height === 48 && resized.historyBytes === 80 * 48 * 16);
  const originalProjection = camera.projectionMatrix.clone();
  temporal.begin(camera, 80, 48); let rejected = false;
  try { temporal.begin(camera, 80, 48); } catch { rejected = true; }
  temporal.restore(camera);
  check('Nested begin rejected; explicit restore recovers camera', { rejected }, rejected && camera.projectionMatrix.equals(originalProjection));
  check('Jitter stays inside a pixel and repeats after 16 positions', { first: temporalJitter(0), repeated: temporalJitter(16) },
    Array.from({ length: 16 }, (_, i) => temporalJitter(i)).flat().every(v => Math.abs(v) <= 0.5) && JSON.stringify(temporalJitter(0)) === JSON.stringify(temporalJitter(16)));
  check('No shader errors after every scenario', { count: report.shaderErrors.length }, report.shaderErrors.length === 0);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack || String(error);
} finally {
  report.memoryBeforeDispose = { ...renderer.info.memory };
  histories.forEach(history => history.dispose()); resources.forEach(resource => resource.dispose()); copy.dispose();
  report.memoryAfterDispose = { ...renderer.info.memory };
  report.completedAt = new Date().toISOString();
  resultElement.textContent = JSON.stringify(report, null, 2);
  resultElement.className = report.status;
  window.dispatchEvent(new CustomEvent('temporal-proof-complete', { detail: report }));
}
