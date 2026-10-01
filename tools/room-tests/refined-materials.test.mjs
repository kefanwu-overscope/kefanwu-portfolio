import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';
import { applyPhotoFinish, photoFinishes } from '../../studio-photo-materials.js';
import { readBufferView } from '../../studio-motion-runtime.js';

const moduleURL = new URL('../../vendor/three/0.185.0/build/three.module.js', import.meta.url).href;
const code = (await readFile(new URL('../../studio-inspector-materials.js', import.meta.url), 'utf8'))
  .replace("from 'three'", `from '${moduleURL}'`);
const { installSourceMaterial } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const index = JSON.parse(await readFile(new URL('../../assets/studio-motion/index.json', import.meta.url), 'utf8'));
const manifests = Object.fromEntries(await Promise.all(Object.entries(index.projects).map(async ([key, entry]) => [key,
  JSON.parse(await readFile(new URL(`../../assets/studio-motion/${entry.manifest}`, import.meta.url), 'utf8')),
])));

function compile(key, input) {
  const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().fromArray(input.baseColor),
    roughness: input.roughness, metalness: input.metalness, opacity: input.opacity ?? 1,
    transmission: input.transmission ?? 0, transparent: input.transparent ?? false });
  const source = applyPhotoFinish(key, material, input);
  material.userData.motionUniforms = {};
  installSourceMaterial(material, source);
  const shader = { vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader, uniforms: {} };
  material.onBeforeCompile(shader);
  return { source, material, shader };
}

test('Every exported bump-only material now contributes height without changing its base color or alpha', () => {
  let count = 0;
  for (const [key, manifest] of Object.entries(manifests)) for (const source of manifest.materials) {
    if (source.procedural?.type !== 'noise' || source.procedural.ramp) continue;
    const before = JSON.stringify(source), { shader, material } = compile(key, source);
    assert.equal(shader.uniforms.studioNoiseBump.value, source.procedural.bumpStrength * source.procedural.bumpDistance);
    assert(shader.uniforms.studioNoiseBump.value > 0);
    assert(shader.fragmentShader.includes('normal = normalize(normal - studioSlope)'));
    assert(!shader.fragmentShader.includes('diffuseColor.rgb = mix(studioNoiseA'));
    assert(!shader.fragmentShader.includes('diffuseColor.a *='));
    assert.equal(shader.uniforms.studioNoiseScale.value, source.procedural.scale);
    assert.equal(JSON.stringify(source), before);
    material.dispose(); count++;
  }
  assert.equal(count, 8);
});

test('Noise uses immutable mapped coordinates and filters all three source octaves before normal differentiation', () => {
  const source = manifests.telecaster.materials.find(value => value.name === 'fretboard');
  const { shader, material } = compile('telecaster', source);
  assert.deepEqual(shader.uniforms.studioMappingScale.value.toArray(), source.procedural.mappingScale);
  assert.deepEqual(shader.uniforms.studioNoiseA.value.toArray(), source.procedural.ramp[0].color.slice(0, 3));
  assert.deepEqual(shader.uniforms.studioNoiseB.value.toArray(), source.procedural.ramp[1].color.slice(0, 3));
  for (const frequency of ['1.00000000', '2.00000000', '4.00000000']) {
    assert(shader.fragmentShader.includes(`studioFilteredNoise(studioCoord * ${frequency}, studioFootprint * ${frequency})`));
  }
  assert(shader.vertexShader.includes('vStudio_surfaceScale = length(modelViewMatrix[0].xyz)'));
  assert(shader.fragmentShader.includes('0.14 / max(length(studioSlope)'));
  assert.equal((shader.fragmentShader.match(/float studioGrain =/g) || []).length, 1);
  material.dispose();
});

test('New neutral photo finishes work on old room geometry without missing custom attributes', () => {
  let count = 0;
  for (const [key, finishes] of Object.entries(photoFinishes)) for (const [name, finish] of Object.entries(finishes)) {
    const input = manifests[key].materials.find(value => value.name === name);
    if (!finish.surface || input.procedural) continue;
    const { material, shader } = compile(key, input);
    assert(shader.vertexShader.includes('vStudio_surfaceCoordinates = position;'));
    assert(!shader.vertexShader.includes('attribute vec3 surfaceCoordinates'));
    assert(!shader.vertexShader.includes('attribute vec3 sourceCoordinates'));
    assert(!shader.vertexShader.includes('attribute vec3 objectCoordinates'));
    assert(!shader.fragmentShader.includes('diffuseColor.rgb = mix(studioNoiseA'));
    material.dispose(); count++;
  }
  assert.equal(count, 8);
});

test('Steering weave stays source-local, opaque and restricted to its existing carbon material', () => {
  const input = manifests.steering.materials.find(value => value.name.startsWith('Dark carbon steering wheel'));
  const original = JSON.stringify(input), { source, shader, material } = compile('steering', input);
  assert.equal(source.procedural.type, 'steering-weave');
  assert.equal(source.procedural.coordinateSpace, 'object');
  assert(shader.vertexShader.includes('attribute vec3 objectCoordinates'));
  assert(!shader.vertexShader.includes('attribute vec3 sourceCoordinates'));
  assert(shader.fragmentShader.includes('dFdx(vStudio_objectCoordinates)'));
  assert(shader.fragmentShader.includes('studioWheelDistance'));
  assert(!shader.fragmentShader.includes('diffuseColor.a *='));
  assert.equal(material.transparent, false);
  assert.equal(material.opacity, input.opacity);
  assert.deepEqual(material.color.toArray(), input.baseColor.slice(0, 3));
  assert.equal(JSON.stringify(input), original);
  const assigned = manifests.steering.nodes.filter(node => (node.geometry.groups || []).some(group =>
    manifests.steering.materials[node.materialIndices[group.materialIndex]] === input));
  assert.deepEqual(assigned.map(node => node.name), ['mat_printed_part_10']);
  material.dispose();
});

test('Wheel face mask identifies the actual broad planes and excludes hub and cut-edge source triangles', async () => {
  const manifest = manifests.steering;
  const compressed = await readFile(new URL(`../../assets/studio-motion/steering/${manifest.buffers.geometry.url}`, import.meta.url));
  const raw = gunzipSync(compressed), buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  const wheel = manifest.nodes.find(node => node.name === 'mat_printed_part_10');
  const positions = readBufferView(buffer, wheel.geometry.position), normals = readBufferView(buffer, wheel.geometry.normal);
  const finish = photoFinishes.steering['Dark carbon steering wheel - supported by original CAD cover'].weave;
  let faces = 0, hub = 0, edges = 0;
  for (let i = 0; i < positions.length; i += 3) {
    const facing = Math.abs(normals[i + 1] * finish.faceNormal[1] + normals[i + 2] * finish.faceNormal[2]);
    const plane = positions[i + 1] * finish.faceNormal[1] + positions[i + 2] * finish.faceNormal[2];
    const distance = Math.min(...finish.facePlanes.map(value => Math.abs(plane - value)));
    if (facing > .999 && distance < .0015) faces++;
    else if (facing > .999) hub++;
    else edges++;
  }
  assert.equal(faces, 1567);
  assert.equal(hub, 288);
  assert.equal(edges, 1667);
});

test('Carbon-seat source weave, roughness attributes and layup opacity retain their independent shader', () => {
  const input = manifests.carbonSeat.materials.find(source => source.procedural?.type === 'carbon');
  const { shader, material } = compile('carbonSeat', input);
  assert(shader.fragmentShader.includes('diffuseColor.a *= clamp(vStudio_attributeOpacity'));
  assert(shader.fragmentShader.includes('roughnessFactor = clamp(vStudio_attributeRoughness'));
  assert(shader.fragmentShader.includes('studioChecker(vStudio_sourceCoordinates * studioCarbonScale)'));
  assert(!shader.fragmentShader.includes('studioNoise'));
  assert(!shader.fragmentShader.includes('studioWheel'));
  assert.equal(shader.uniforms.studioCarbonBump.value, input.procedural.bumpStrength * input.procedural.bumpDistance);
  material.dispose();
});

test('Thermal animation and solved-pressure colors receive no new surface finish', () => {
  for (const key of ['brakeSim', 'ansysCfd']) for (const input of manifests[key].materials) {
    const { shader, source, material } = compile(key, input);
    assert.equal(source, input);
    assert(!shader.fragmentShader.includes('studioNoise'));
    assert(!shader.fragmentShader.includes('studioWheel'));
    if (input.heat) {
      assert.equal(shader.uniforms.studioWarming, material.userData.motionUniforms.warming);
      assert.equal(shader.uniforms.studioIncandescence, material.userData.motionUniforms.incandescence);
    }
    material.dispose();
  }
});

test('Photo finish application is idempotent for the runtime and room exporter', () => {
  for (const [key, finishes] of Object.entries(photoFinishes)) for (const name of Object.keys(finishes)) {
    const input = manifests[key].materials.find(source => source.name === name), { source, material } = compile(key, input);
    const snapshot = JSON.stringify(source), color = material.color.toArray(), roughness = material.roughness;
    const again = applyPhotoFinish(key, material, source);
    assert.equal(JSON.stringify(again), snapshot);
    assert.deepEqual(material.color.toArray(), color);
    assert.equal(material.roughness, roughness);
    material.dispose();
  }
});
