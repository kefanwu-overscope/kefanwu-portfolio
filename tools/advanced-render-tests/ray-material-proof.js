import * as THREE from "three";
import { createRaytraceMaterialBridge } from "../../experience-ray-material.js";
import { createRaytraceGBufferCapture } from "../../experience-raytrace-capture.js";
import { installBakedDiffuse } from "../../experience-baked-material.js";
import { installSourceMaterial } from "../../studio-inspector-materials.js";

export async function runRayMaterialProof(canvas) {
  const width = 192, height = 96, errors = [];
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  renderer.setSize(width, height); renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => errors.push({ program: gl.getProgramInfoLog(program), vertex: gl.getShaderInfoLog(vertex), fragment: gl.getShaderInfoLog(fragment) });
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0.02, 0.02, 0.02);
  const camera = new THREE.OrthographicCamera(-1.8, 1.8, 0.9, -0.9, 0.1, 10); camera.position.z = 4; camera.updateMatrixWorld();
  const ambient = new THREE.AmbientLight(0xffffff, 0.3); scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 1.5); directional.position.set(1, 2, 3); directional.castShadow = true; directional.shadow.mapSize.set(128, 128); scene.add(directional);
  const spot = new THREE.SpotLight(0xffffff, 10, 10, 0.7, 0.2, 2); spot.position.set(-1, 1, 3); spot.castShadow = true; spot.shadow.mapSize.set(128, 128); scene.add(spot); scene.add(spot.target);
  const lightmap = new THREE.DataTexture(new Uint8Array([128, 128, 128, 128]), 1, 1, THREE.RGBAFormat); lightmap.channel = 1; lightmap.colorSpace = THREE.NoColorSpace; lightmap.needsUpdate = true;
  const ordinary = new THREE.MeshStandardMaterial({ color: 0x686868, roughness: 1, flatShading: true }); ordinary.name = "ordinary";
  const baked = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1, lightMap: lightmap, lightMapIntensity: 0.7 }); baked.name = "baked";
  installBakedDiffuse(baked, { secondMap: { value: lightmap }, blend: { value: 0 }, range: 4 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }); carbon.name = "source-carbon"; carbon.userData.motionUniforms = {};
  installSourceMaterial(carbon, { procedural: { type: "carbon", scale: 90, color1: [0.03, 0.035, 0.04], color2: [0.05, 0.055, 0.06], bumpStrength: 0.1, bumpDistance: 0.0001 } });
  const meshes = [];
  [ordinary, baked, carbon].forEach((material, index) => {
    const geometry = new THREE.PlaneGeometry(0.86, 1.2, 1, 1);
    geometry.setAttribute("uv1", geometry.attributes.uv.clone());
    geometry.setAttribute("sourceCoordinates", geometry.attributes.position.clone());
    geometry.setAttribute("attributeOpacity", new THREE.Float32BufferAttribute(new Float32Array(4).fill(1), 1));
    geometry.setAttribute("attributeRoughness", new THREE.Float32BufferAttribute(new Float32Array(4).fill(0.6), 1));
    const mesh = new THREE.Mesh(geometry, material); mesh.position.x = index - 1; mesh.receiveShadow = true; scene.add(mesh); meshes.push(mesh);
  });
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType });
  const read = async () => {
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    const data = new Uint8Array(width * height * 4); await renderer.readRenderTargetPixelsAsync(target, 0, 0, width, height, data); return data;
  };
  const baseline = await read();
  const captureService = createRaytraceGBufferCapture(renderer, { maxPixels: width * height });
  const capture = await captureService.capture({ scene, camera, width, height });
  if (!capture) throw new Error("Float normal/depth capture unavailable");
  const bridge = createRaytraceMaterialBridge(); bridge.install(scene);
  const data = new Float32Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = data[i + 1] = 1; data[i + 2] = capture.normalDepth[i + 3]; data[i + 3] = 32; }
  const snapshot = { ...capture, lightType: "directional", lightIndex: 0 };
  const publish = (values = data, guide = capture.normalDepth, sampleSnapshot = snapshot) => bridge.publish({ width, height, data: values, normalDepth: guide, samples: 32 }, sampleSnapshot);
  publish(); const neutral = await read();
  const difference = (a, b) => { let max = 0, changed = 0; for (let i = 0; i < a.length; i++) { const delta = Math.abs(a[i] - b[i]); max = Math.max(max, delta); if (delta) changed++; } return { max, changed }; };
  const center = (pixels, index) => {
    const x = Math.round(((index - 1) / 3.6 + 0.5) * width), y = height / 2;
    const offset = (y * width + x) * 4; return Array.from(pixels.slice(offset, offset + 3));
  };
  const dark = data.slice(); for (let i = 0; i < dark.length; i += 4) dark[i + 1] = 0;
  publish(dark); const directionalBlocked = await read();
  publish(dark, capture.normalDepth, { ...snapshot, lightType: "spot" }); const spotBlocked = await read();
  const wrongDepth = capture.normalDepth.slice(); for (let i = 3; i < wrongDepth.length; i += 4) if (wrongDepth[i]) wrongDepth[i] += 10;
  publish(dark, wrongDepth); const depthRejected = await read();
  const ao = data.slice(); for (let i = 0; i < ao.length; i += 4) ao[i] = 0;
  publish(ao); const aoResult = await read();
  bridge.invalidate("test"); const invalidated = await read();
  const neutralDifference = difference(baseline, neutral), rejectionDifference = difference(baseline, depthRejected), invalidatedDifference = difference(baseline, invalidated);
  const sum = (values) => values.reduce((a, b) => a + b, 0);
  const result = {
    status: "pending", neutralDifference, rejectionDifference, invalidatedDifference,
    ordinary: { flatShading: true, baseline: center(baseline, 0), directionalBlocked: center(directionalBlocked, 0), spotBlocked: center(spotBlocked, 0) },
    baked: { baseline: center(baseline, 1), ao: center(aoResult, 1) },
    sourceCarbon: { baseline: center(baseline, 2), neutral: center(neutral, 2), sourceShaderCompiled: !!carbon.userData.sourceShaderCompiled },
    vertexPreservation: [ordinary, baked, carbon].map((material) => ({ name: material.name, preserved: material.userData.clusterVertexPositionsPreserved === true })),
    bridge: bridge.stats, errors,
  };
  result.status = !errors.length && !result.bridge.failures.length && neutralDifference.max === 0 && rejectionDifference.max === 0 && invalidatedDifference.max === 0 &&
    sum(result.ordinary.directionalBlocked) < sum(result.ordinary.baseline) && sum(result.ordinary.spotBlocked) < sum(result.ordinary.baseline) &&
    sum(result.baked.ao) < sum(result.baked.baseline) && result.sourceCarbon.sourceShaderCompiled ? "passed" : "failed";
  publish(); renderer.setRenderTarget(null); renderer.render(scene, camera);
  window.disposeRayMaterialProof = () => { bridge.dispose(); captureService.dispose(); target.dispose(); lightmap.dispose(); meshes.forEach((mesh) => { mesh.geometry.dispose(); mesh.material.dispose(); }); renderer.dispose(); };
  return result;
}
