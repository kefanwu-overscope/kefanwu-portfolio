import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';
import { projectMotionLabels } from '../../project-motion-labels.js';
import { projectMotionNotes } from '../../project-motion-notes.js';
import { applyPhotoFinish, applyPhotoPart, photoFinishes } from '../../studio-photo-materials.js';
import { readBufferView, createSampledMotion } from '../../studio-motion-runtime.js';

const index = JSON.parse(await readFile(new URL('../../assets/studio-motion/index.json', import.meta.url), 'utf8'));
const manifests = Object.fromEntries(await Promise.all(Object.entries(index.projects).map(async ([key, value]) => [
  key, JSON.parse(await readFile(new URL(`../../assets/studio-motion/${value.manifest}`, import.meta.url), 'utf8')),
])));

test('Every concise reading retains its source step and resolves an exact component target', () => {
  assert.deepEqual(Object.keys(projectMotionLabels).sort(), Object.keys(projectMotionNotes).sort());
  let total = 0;
  for (const [key, labels] of Object.entries(projectMotionLabels)) {
    assert.equal(labels.length, projectMotionNotes[key].steps.length, `${key}: step count`);
    for (const [i, label] of labels.entries()) {
      assert(!Object.hasOwn(label, 'at'), `${key}/${i}: timing remains owned by the motion notes`);
      assert(label.title.trim().split(/\s+/).length <= 4, `${key}/${i}: concise title`);
      assert(label.body.trim().split(/\s+/).length <= 14, `${key}/${i}: concise detail`);
      assert.equal(Object.keys(label.target).length, 1);
      assert(manifests[key].nodes.some(node => label.target.name ? node.name === label.target.name : node.group === label.target.group),
        `${key}/${i}: target must exist in the currently indexed source manifest`);
      total++;
    }
  }
  assert.equal(total, 72);
});

test('Every photo finish matches an indexed source material rather than a broad inferred category', () => {
  for (const [key, finishes] of Object.entries(photoFinishes)) {
    assert(manifests[key], `Unknown photo project: ${key}`);
    for (const name of Object.keys(finishes)) assert(manifests[key].materials.some(material => material.name === name), `${key}: ${name}`);
  }
});

test('Photographed black tensile fabric replaces orange while retaining its source noise and opacity', () => {
  const source = manifests.materialTest.materials.find(material => material.name === 'Visible warm orange tensile fabric');
  const before = JSON.stringify(source);
  const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().fromArray(source.baseColor), roughness: source.roughness });
  const finished = applyPhotoFinish('materialTest', material, source);
  assert.equal(material.color.getHexString(), '252628');
  assert.equal(material.roughness, .65);
  assert.equal(material.metalness, 0);
  assert.equal(material.opacity, 1, 'Fabric stays opaque; the clear LDPE specimen is a separate material');
  assert.equal(material.transmission, 0);
  assert.notEqual(finished, source);
  assert.equal(finished.procedural, source.procedural, 'Current source noise has no color ramp to rewrite');
  assert.equal(finished.procedural.ramp, null);
  assert.equal(JSON.stringify(source), before, 'The source manifest and its ramp remain immutable');
  material.dispose();
});

test('An existing grain ramp is recolored in linear space without mutating its stop positions', () => {
  const original = manifests.materialTest.materials.find(material => material.name === 'Visible warm orange tensile fabric');
  const source = { ...original, procedural: { ...original.procedural, ramp: [
    { position: .1, color: [.9, .3, .1, 1] }, { position: .8, color: [1, .5, .2, 1] },
  ] } };
  const before = JSON.stringify(source), material = new THREE.MeshPhysicalMaterial();
  const finished = applyPhotoFinish('materialTest', material, source);
  assert.notEqual(finished.procedural, source.procedural);
  assert.deepEqual(finished.procedural.ramp.map(stop => stop.color.slice(0, 3)),
    ['#202123', '#303133'].map(color => new THREE.Color(color).toArray()));
  assert.deepEqual(finished.procedural.ramp.map(stop => stop.position), [.1, .8]);
  assert.equal(JSON.stringify(source), before);
  material.dispose();
});

test('Scientific pressure colors and thermal tracks remain outside the photo palette', () => {
  for (const key of ['ansysCfd', 'brakeSim']) {
    assert.equal(photoFinishes[key], undefined);
    for (const source of manifests[key].materials) {
      const before = JSON.stringify(source);
      const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().fromArray(source.baseColor),
        roughness: source.roughness, metalness: source.metalness });
      const color = material.color.toArray();
      assert.equal(applyPhotoFinish(key, material, source), source);
      assert.deepEqual(material.color.toArray(), color);
      assert.equal(JSON.stringify(source), before);
      material.dispose();
    }
  }
});

test('Javelin shell correction preserves the source and leaves silver motor hardware untouched', () => {
  const shell = manifests.javelin.materials.find(material => material.name === 'aero.001');
  const material = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().fromArray(shell.baseColor), roughness: shell.roughness });
  const before = JSON.stringify(shell);
  applyPhotoFinish('javelin', material, shell);
  assert.equal(material.color.getHexString(), '171819');
  assert.equal(material.roughness, .43);
  assert.equal(JSON.stringify(shell), before);
  const silver = manifests.javelin.materials.find(source => source.name === 'motor_silver.001');
  const motor = new THREE.MeshPhysicalMaterial({ color: new THREE.Color().fromArray(silver.baseColor), roughness: silver.roughness });
  const motorColor = motor.color.toArray();
  assert.equal(applyPhotoFinish('javelin', motor, silver), silver, 'A shell finish must not spill onto silver motor accents');
  assert.deepEqual(motor.color.toArray(), motorColor);
  assert.equal(motor.roughness, silver.roughness);
  material.dispose(); motor.dispose();
});

test('Only the scanner PSU receives a separate metal clone from its shared blue material', () => {
  const source = manifests.scanner.materials.find(material => material.name === 'Royal blue printed components');
  assert(manifests.scanner.nodes.some(node => node.name === 'mat_printed_part_4'));
  const before = JSON.stringify(source), blue = new THREE.MeshPhysicalMaterial();
  blue.userData.source = applyPhotoFinish('scanner', blue, source);
  blue.userData.motionUniforms = { sentinel: { value: 1 } };
  const metal = applyPhotoPart('scanner', 'mat_printed_part_4', blue);
  assert.notEqual(metal, blue);
  assert.notEqual(metal.uuid, blue.uuid);
  assert.equal(metal.color.getHexString(), '777b7e');
  assert.equal(metal.metalness, .85); assert.equal(metal.roughness, .38);
  assert.equal(blue.color.getHexString(), '0b2389');
  assert.equal(blue.userData.motionUniforms.sentinel.value, 1);
  assert.deepEqual(metal.userData.motionUniforms, {});
  assert.equal(applyPhotoPart('scanner', 'mat_printed_part_3', blue), blue);
  assert.equal(applyPhotoPart('vineRobot', 'mat_printed_part_4', blue), blue);
  assert.equal(JSON.stringify(source), before);
  blue.dispose(); metal.dispose();
});

const inspectorSource = (await readFile(new URL('../../studio-inspector.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const builderSource = inspectorSource.slice(0, inspectorSource.indexOf('/**\n * Independent project workbench'))
  .replace(/^import[^\n]+\n/gm, '').replaceAll('import.meta.url', 'moduleURL');
const projectionSource = inspectorSource.slice(inspectorSource.indexOf('  function projectAnchor(selector)'),
  inspectorSource.indexOf('\n  return {\n    projectAnchor,'));
const context = { THREE, URL, moduleURL: new URL('../../studio-inspector.js', import.meta.url).href,
  readBufferView, createSampledMotion, applyPhotoFinish, applyPhotoPart, installSourceMaterial() {}, AbortController };
vm.runInNewContext(`${builderSource}\n` +
  `globalThis.project = (resource, camera, selector) => { ${projectionSource}; return projectAnchor(selector); };`, context);

test('Exact source anchors survive rigid batching and follow source transforms without geometry changes', () => {
  const values = new Float32Array([-2, 0, 0, -1, 0, 0, -2, 0, 1, 1, 0, 0, 2, 0, 0, 2, 0, 1]);
  const material = { name: 'steel', baseColor: [.4, .4, .4, 1], metalness: 1, roughness: .4 };
  const node = (name, byteOffset) => ({ name, group: 'pair', geometry: { position: { byteOffset, count: 3, itemSize: 3, componentType: 'float32' } },
    materialIndices: [0], transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true, tracks: {} });
  const manifest = { project: 'fixture', schema: 'studio-motion-v1', coordinates: 'blender-z-up', sampleCount: 1, duration: 1,
    nodes: [node('left part', 0), node('right part', 36)], materials: [material] };
  const resource = context.buildResource('fixture', manifest, values.buffer, new ArrayBuffer(0));
  assert.equal(resource.root.children.length, 1, 'Fixture must exercise the merged draw mesh');
  for (const anchor of resource.anchors) {
    assert.equal(anchor.point.length, 3);
    assert.equal(anchor.positions, undefined, 'Rigid anchors must not retain retired vertex buffers');
    assert(anchor.point.every(Number.isFinite));
  }
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 20);
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  const left = context.project(resource, camera, { name: 'left part' });
  const right = context.project(resource, camera, { name: 'right part' });
  assert(left.x < .5 && right.x > .5, 'The second part must not inherit the merged mesh center');
  assert.equal(right.name, 'right part');
  resource.root.position.x = 1;
  const moved = context.project(resource, camera, { name: 'right part' });
  assert(Math.abs(moved.x - right.x - .125) < 1e-10);
  assert.equal(context.project(resource, camera, { name: 'missing part' }), null);
  assert.deepEqual(Array.from(values), [-2, 0, 0, -1, 0, 0, -2, 0, 1, 1, 0, 0, 2, 0, 0, 2, 0, 1]);
  resource.dispose();
});

test('Deforming anchors retain the live position attribute and follow sampled geometry', () => {
  const values = new Float32Array([-1, 0, 0, 0, 0, 0, -1, 0, 1]);
  const motion = new Float32Array([...values, ...Array.from(values, (value, index) => value + (index % 3 === 0 ? 2 : 0))]);
  const manifest = { project: 'fixture', schema: 'studio-motion-v1', coordinates: 'blender-z-up', sampleCount: 2, duration: 1,
    materials: [{ name: 'fabric', baseColor: [.1, .1, .1, 1] }], nodes: [{ name: 'strip', group: 'strip', materialIndices: [0],
      geometry: { position: { byteOffset: 0, count: 3, itemSize: 3, componentType: 'float32' } },
      tracks: { deformationPosition: { byteOffset: 0, count: 18, itemSize: 1, valuesPerFrame: 9, componentType: 'float32' } } }] };
  const resource = context.buildResource('fixture', manifest, values.buffer, motion.buffer);
  const anchor = resource.anchors[0];
  assert.equal(anchor.positions, resource.nodes[0].geometry.attributes.position);
  assert.equal(anchor.point, undefined);
  assert.notEqual(anchor.positions.array, values, 'Deformation must not overwrite source positions');
  const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 20);
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  const before = context.project(resource, camera, { name: 'strip' });
  resource.motion.seek(.5);
  const midpoint = context.project(resource, camera, { name: 'strip' });
  assert(Math.abs(midpoint.x - before.x - .125) < 1e-10);
  resource.motion.seek(1);
  assert(Math.abs(context.project(resource, camera, { name: 'strip' }).x - before.x - .25) < 1e-10);
  assert.deepEqual(Array.from(values), [-1, 0, 0, 0, 0, 0, -1, 0, 1]);
  resource.dispose();
});

test('Rigid batching preserves the scanner PSU clone while merging matching blue brackets', () => {
  const values = new Float32Array([-2, 0, 0, -1, 0, 0, -2, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 2, 0, 0, 3, 0, 0, 2, 0, 1]);
  const material = manifests.scanner.materials.find(source => source.name === 'Royal blue printed components');
  const nodes = ['mat_printed_part_0', 'mat_printed_part_4', 'mat_printed_part_1'].map((name, index) => ({ name, group: 'fixed_frame',
    materialIndices: [0], visible: true, tracks: {}, transform: { position: [0, 0, 0], quaternion: [0, 0, 0, 1], scale: [1, 1, 1] },
    geometry: { position: { byteOffset: index * 36, count: 3, itemSize: 3, componentType: 'float32' } } }));
  const manifest = { project: 'scanner', schema: 'studio-motion-v1', coordinates: 'blender-z-up', sampleCount: 1, duration: 1,
    materials: [material], nodes };
  const resource = context.buildResource('scanner', manifest, values.buffer, new ArrayBuffer(0));
  assert.equal(resource.root.children.length, 2, 'The metal PSU cannot batch with blue print brackets');
  assert.equal(resource.nodes[0], resource.nodes[2], 'Matching source brackets should still batch');
  assert.notEqual(resource.nodes[0], resource.nodes[1]);
  assert.equal(resource.nodes[0].material.color.getHexString(), '0b2389');
  assert.equal(resource.nodes[1].material.color.getHexString(), '777b7e');
  assert.notEqual(resource.nodes[0].material.uuid, resource.nodes[1].material.uuid);
  let disposed = 0;
  resource.nodes[1].material.addEventListener('dispose', () => disposed++);
  resource.dispose();
  assert.equal(disposed, 1, 'The private material must be released with the resource');
});
