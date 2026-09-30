import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../../vendor/three/0.185.0/build/three.module.js";
const threeURL = new URL("../../vendor/three/0.185.0/build/three.module.js", import.meta.url).href;
async function load(relative) {
  const text = (await readFile(new URL(relative, import.meta.url), "utf8")).replace(/from ["']three["']/g, `from '${threeURL}'`);
  return import(`data:text/javascript;base64,${Buffer.from(text).toString("base64")}`);
}
const { createRaytraceMaterialBridge } = await load("../../experience-ray-material.js");
const { installBakedDiffuse } = await load("../../experience-baked-material.js");
const { installSourceMaterial } = await load("../../studio-inspector-materials.js");
const bridge = createRaytraceMaterialBridge();
const ordinary = new THREE.MeshStandardMaterial(), baked = new THREE.MeshStandardMaterial(), carbon = new THREE.MeshStandardMaterial();
installBakedDiffuse(baked, { secondMap: { value: null }, blend: { value: 0 } });
carbon.userData.motionUniforms = {};
installSourceMaterial(carbon, { procedural: { type: "carbon", scale: 50, color1: [0.02, 0.03, 0.04], color2: [0.04, 0.05, 0.06] } });
const originals = [ordinary, baked, carbon].map((material) => ({ hook: material.onBeforeCompile, key: material.customProgramCacheKey }));
for (const [index, material] of [ordinary, baked, carbon].entries()) {
  bridge.install(material); bridge.install(material);
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader, null);
  assert.ok(shader.vertexShader.includes("studioRTWorld = instanceMatrix * studioRTWorld"));
  assert.ok(shader.fragmentShader.includes("studioRTShadow(getShadow( directionalShadowMap"));
  assert.ok(shader.fragmentShader.includes("studioRTShadow(getShadow( spotShadowMap"));
  assert.ok(shader.fragmentShader.includes("getPointShadow( pointShadowMap"));
  assert.ok(!shader.fragmentShader.includes("outgoingLight *= studioRT"));
  assert.equal(shader.uniforms.studioRTEnabled, bridge.uniforms.studioRTEnabled);
  assert.equal(material.userData.clusterVertexPositionsPreserved, true);
  if (index === 1) assert.ok(shader.fragmentShader.indexOf("reflectedLight.indirectDiffuse *= mix(1.0, studioRTSample.r") > shader.fragmentShader.indexOf("RE_IndirectDiffuse(studioBakedRadiance"));
  if (index === 2) assert.ok(shader.fragmentShader.includes("float studioChecker(vec3 p)"));
}
assert.equal(bridge.stats.materials, 3);
bridge.dispose();
[ordinary, baked, carbon].forEach((material, i) => { assert.equal(material.onBeforeCompile, originals[i].hook); assert.equal(material.customProgramCacheKey, originals[i].key); });
console.log(JSON.stringify({ status: "passed", chainedMaterials: 3, hookAndCacheRestoration: true, bakedAOOrdering: true, instanceWorldPosition: true }));
