import * as THREE from "three";
import { createRaytraceMaterialBridge } from "../../experience-ray-material.js";
import { createRaytraceGBufferCapture } from "../../experience-raytrace-capture.js";

export async function runRayMaterialTiltProof(canvas) {
  const width = 360, height = 240, errors = [];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(width, height); renderer.outputColorSpace = THREE.LinearSRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => errors.push({ program: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment) });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0, 0, 0);
  scene.add(new THREE.AmbientLight(0xffffff, 1));
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 20); camera.position.z = 4; camera.updateMatrixWorld();
  const foreground = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 2), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.4, 0.2, 0.1), roughness: 1, flatShading: true }));
  foreground.rotation.set(0.35, Math.PI * 0.38, 0); scene.add(foreground);
  const background = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.08, 0.08), roughness: 1 }));
  background.position.z = -4; scene.add(background);
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.FloatType });
  const read = async () => {
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    const pixels = new Float32Array(width * height * 4);
    await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height, pixels); return pixels;
  };
  const baseline = await read();
  const captureService = createRaytraceGBufferCapture(renderer, { maxPixels: 42 * 28 });
  const capture = await captureService.capture({ scene, camera, width: 42, height: 28 });
  if (!capture) throw new Error("Float capture unavailable");
  const bridge = createRaytraceMaterialBridge({ aoStrength: 0.25 }); bridge.install(scene);
  const data = new Float32Array(capture.width * capture.height * 4);
  let foregroundGuideTexels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const isForeground = capture.normalDepth[i + 3] > 0 && capture.normalDepth[i + 3] < 7;
    if (isForeground) foregroundGuideTexels++;
    data[i] = isForeground ? 0 : 1; data[i + 1] = 1;
    data[i + 2] = capture.normalDepth[i + 3]; data[i + 3] = 32;
  }
  bridge.publish({ data, normalDepth: capture.normalDepth, width: capture.width, height: capture.height, samples: 32 }, { ...capture, lightType: "none" });
  const corrected = await read();
  const isForeground = (x, y) => {
    const i = (y * width + x) * 4;
    return baseline[i] > baseline[i + 1] * 1.5 && baseline[i] > 0.001;
  };
  const ratios = [];
  let backgroundPixels = 0, maxBackgroundError = 0, effectPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (baseline[i] <= 0.001) continue;
    const ratio = corrected[i] / baseline[i];
    if (!isForeground(x, y)) { backgroundPixels++; maxBackgroundError = Math.max(maxBackgroundError, Math.abs(ratio - 1)); continue; }
    if (ratio < 0.9) effectPixels++;
    // Ignore the unavoidable silhouette coverage uncertainty of the small
    // guide. The broad interior must not reveal projected guide texel cells.
    const margin = 18;
    if (x < margin || x >= width - margin || y < margin || y >= height - margin) continue;
    if ([[-margin, 0], [margin, 0], [0, -margin], [0, margin]].every(([dx, dy]) => isForeground(x + dx, y + dy))) ratios.push(ratio);
  }
  ratios.sort((a, b) => a - b);
  const mean = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;
  const deviation = Math.sqrt(ratios.reduce((sum, ratio) => sum + (ratio - mean) ** 2, 0) / ratios.length);
  const maxExpectedError = Math.max(...ratios.map((ratio) => Math.abs(ratio - 0.75)));
  const report = { status: "pending", perspectiveTiltDegrees: 68.4, renderSize: [width, height], guideSize: [capture.width, capture.height],
    foregroundGuideTexels, interiorPixels: ratios.length, effectPixels, expectedRatio: 0.75, meanRatio: mean, standardDeviation: deviation,
    minimumRatio: ratios[0], maximumRatio: ratios.at(-1), maxExpectedError, backgroundPixels, maxBackgroundError, errors };
  report.status = errors.length === 0 && ratios.length > 200 && effectPixels > 500 && maxExpectedError < 0.0001 && deviation < 0.00002 && maxBackgroundError < 0.00002 ? "passed" : "failed";
  renderer.setRenderTarget(null); renderer.render(scene, camera);
  window.disposeRayMaterialTiltProof = () => { bridge.dispose(); captureService.dispose(); target.dispose(); foreground.geometry.dispose(); foreground.material.dispose(); background.geometry.dispose(); background.material.dispose(); renderer.dispose(); };
  return report;
}
