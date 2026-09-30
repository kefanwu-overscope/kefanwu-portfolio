import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';
import { MeshoptSimplifier } from '../lod/vendor/meshopt_simplifier.mjs';
import { accessor } from '../lod/glb.mjs';
import { buildClusterTree, validateClusterTree, classifyCluster, selectClusterNodes } from '../../experience-clusters-core.js';
import { createClusterRenderer } from '../../experience-clusters.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = (label, callback) => { callback(); report.checks.push(label); };
const report = { status: 'running', checks: [], sources: [], fixtures: {} };
const sha = b => createHash('sha256').update(b).digest('hex');
function parseGLB(bytes) {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
    if (type === 0x004e4942) bin = chunk;
    offset += length + 8;
  }
  return { json, bin, bytes };
}
function triangleBag(indices) {
  const result = new Map();
  for (let i = 0; i < indices.length; i += 3) {
    const key = `${indices[i]},${indices[i + 1]},${indices[i + 2]}`;
    result.set(key, (result.get(key) || 0) + 1);
  }
  return result;
}
function verifyCoverage(input, tree) {
  assert(validateClusterTree(tree, input.position.length / 3, input.index.length / 3));
  const finest = selectClusterNodes(tree, new Uint32Array(tree.nodes.length).fill(1));
  const full = new Uint32Array(input.index.length); let offset = 0;
  for (const id of finest) {
    const n = tree.nodes[id]; assert(n.sourceTriangles <= 128);
    full.set(tree.indices.subarray(n.offset, n.offset + n.count), offset); offset += n.count;
    for (const index of tree.indices.subarray(n.offset, n.offset + n.count)) {
      const p = input.position.subarray(index * 3, index * 3 + 3);
      assert(Math.hypot(...p.map((v, axis) => v - n.sphere[axis])) <= n.sphere[3] + 1e-6);
    }
  }
  assert.deepEqual(triangleBag(full), triangleBag(input.index), 'Every source triangle appears exactly once, with winding intact');
  for (let pass = 0; pass < 12; pass++) {
    const choices = Uint32Array.from(tree.nodes, (_, i) => (i * 13 + pass * 19) % 3 === 0 ? 2 : 1);
    const selected = selectClusterNodes(tree, choices);
    assert.equal(selected.reduce((sum, id) => sum + tree.nodes[id].sourceTriangles, 0), tree.triangleCount, 'Mixed LOD cut covers every source region');
    assert(selected.reduce((sum, id) => sum + tree.nodes[id].count, 0) <= input.index.length);
  }
}
function grid(resolution = 32) {
  const position = [], index = [], uv = [];
  for (let y = 0; y <= resolution; y++) for (let x = 0; x <= resolution; x++) {
    position.push(x / resolution, y / resolution, 0.02 * Math.sin(x / resolution * Math.PI) * Math.sin(y / resolution * Math.PI));
    uv.push(x / resolution, y / resolution);
  }
  for (let y = 0; y < resolution; y++) for (let x = 0; x < resolution; x++) {
    const a = y * (resolution + 1) + x, b = a + resolution + 1;
    index.push(a, a + 1, b, b, a + 1, b + 1);
  }
  return { position: Float32Array.from(position), index: Uint32Array.from(index),
    attributes: [{ name: 'uv', itemSize: 2, array: Float32Array.from(uv) }] };
}
const input = grid(48), tree = await buildClusterTree(input, MeshoptSimplifier);
check('Spatial leaves cover source triangles and arbitrary hierarchy cuts cover all regions', () => verifyCoverage(input, tree));
check('Real coarse representations reduce triangle count', () => assert(tree.coarseCount > 0 && tree.nodes[0].count < input.index.length * 0.7));
check('Every simplified group preserves its exact source boundary edges', () => {
  function edges(indices) {
    const counts = new Map();
    for (let i = 0; i < indices.length; i += 3) for (let k = 0; k < 3; k++) {
      const a = indices[i + k], b = indices[i + (k + 1) % 3];
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count === 1).map(([key]) => key));
  }
  function visit(id) {
    const n = tree.nodes[id];
    if (n.left < 0) return [...tree.indices.subarray(n.offset, n.offset + n.count)];
    const source = visit(n.left).concat(visit(n.right));
    if (n.count) assert.deepEqual(edges(tree.indices.subarray(n.offset, n.offset + n.count)), edges(source));
    return source;
  }
  visit(0);
});
const protectedTree = await buildClusterTree(input, MeshoptSimplifier, { protected: true });
check('Protected geometry is never simplified', () => { assert.equal(protectedTree.coarseCount, 0); verifyCoverage(input, protectedTree); });
check('Malformed cache topology is rejected', () => {
  assert(!validateClusterTree({ ...tree, nodes: [{ ...tree.nodes[0], left: 0 }, ...tree.nodes.slice(1)] }, tree.vertexCount, tree.triangleCount));
});

function frameFor(camera) {
  camera.updateMatrixWorld(true);
  const frame = new Float32Array(52), vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(vp);
  frustum.planes.forEach((p, i) => frame.set([p.normal.x, p.normal.y, p.normal.z, p.constant], i * 4));
  frame.set(vp.elements, 24); frame.set([...camera.position, 720 * camera.projectionMatrix.elements[5] / 2], 40);
  const forward = camera.getWorldDirection(new THREE.Vector3()); frame.set([...forward, camera.near], 44);
  frame.set([0, 0, 1, 1], 48); return frame;
}
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
const frame = frameFor(camera);
check('Frustum classifier rejects only fully outside bounds', () => {
  assert.equal(classifyCluster(new Float32Array([0, 0, -3, .2, 0, 1, 1, 0]), 0, frame), 2);
  assert.equal(classifyCluster(new Float32Array([0, 0, 3, .2, 0, 1, 1, 0]), 0, frame), 0);
  assert.notEqual(classifyCluster(new Float32Array([0, 0, 0, 1, 0, 1, 1, 0]), 0, frame), 0);
});
check('Temporal camera jitter retains subpixel geometry at the unjittered frustum edge', () => {
  const edge = 3 * Math.tan(Math.PI / 6);
  assert.notEqual(classifyCluster(new Float32Array([edge + .002, 0, -3, .00001, 0, 1, 1, 0]), 0, frame), 0);
  assert.equal(classifyCluster(new Float32Array([edge + .03, 0, -3, .00001, 0, 1, 1, 0]), 0, frame), 0);
});
check('Projected geometric error and focus budget refine independently', () => {
  const nodes = new Float32Array([0, 0, -3, .2, .003, 1, 1, 0]);
  assert.equal(classifyCluster(nodes, 0, frame), 1);
  nodes[4] = .0015; assert.equal(classifyCluster(nodes, 0, frame), 2);
  nodes[5] = .5; assert.equal(classifyCluster(nodes, 0, frame), 1);
});

// Exercise integration with the actual THREE classes, replacing only worker
// transport; browser proof separately exercises real worker/cache and WebGPU.
class TestWorker {
  postMessage({ id, input, options }) {
    buildClusterTree(input, MeshoptSimplifier, options).then(tree => this.onmessage?.({ data: { id, tree, cacheHit: false, buildMs: 0 } }));
  }
  terminate() {}
}
globalThis.Worker = TestWorker;
const scene = new THREE.Scene(), geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.BufferAttribute(input.position, 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(input.attributes[0].array, 2));
geometry.setAttribute('sourceCoordinates', new THREE.BufferAttribute(input.position.slice(), 3));
geometry.setIndex(new THREE.BufferAttribute(input.index, 1));
const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()); scene.add(mesh); mesh.position.set(-.5, -.5, -3); mesh.castShadow = true;
const controller = createClusterRenderer({ gpu: false }); await controller.registerRoot(scene);
controller.update(camera, { viewportHeight: 720 });
check('Custom attribute objects, material and source geometry are retained', () => {
  assert.equal(mesh.userData.clusterSourceGeometry, geometry);
  assert.equal(mesh.geometry.attributes.sourceCoordinates, geometry.attributes.sourceCoordinates);
  assert.notEqual(mesh.geometry, geometry); assert.equal(controller.getStats().meshes, 1);
});
check('Shadow callbacks restore complete source index and camera selection', () => {
  const compact = mesh.geometry.index, drawCount = mesh.geometry.drawRange.count;
  mesh.onBeforeShadow(); assert.equal(mesh.geometry.index, geometry.index); assert.equal(mesh.geometry.drawRange.count, geometry.index.count);
  mesh.onAfterShadow(); assert.equal(mesh.geometry.index, compact); assert.equal(mesh.geometry.drawRange.count, drawCount);
});
mesh.position.x = 100; controller.update(camera, { viewportHeight: 720 });
check('Rigid transform changes cull current geometry without stale GPU dependence', () => assert.equal(mesh.geometry.drawRange.count, 0));
mesh.position.x = -.5; controller.update(camera, { viewportHeight: 720 });
check('Moved geometry becomes immediately visible again', () => assert(mesh.geometry.drawRange.count > 0));
controller.update(camera, { enabled: false });
check('Disabled clusters restore all original triangles', () => assert.equal(mesh.geometry.drawRange.count, geometry.index.count));
controller.dispose();
check('Disposal restores source geometry and shadow callbacks', () => {
  assert.equal(mesh.geometry, geometry); assert(!mesh.userData.clusterSourceGeometry);
  assert.equal(mesh.onBeforeShadow, THREE.Object3D.prototype.onBeforeShadow);
  assert.equal(controller.getStats().bytes, 0); assert.equal(controller.getStats().nodes, 0);
});
report.fixtures = { triangles: tree.triangleCount, leaves: tree.leafCount, coarseRepresentations: tree.coarseCount, coarsestTriangles: tree.nodes[0].count / 3 };

if (!process.argv.includes('--fixtures-only')) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'models/room-current/index.json')));
  for (const [key, project] of Object.entries(manifest.projects)) {
    const compressed = fs.readFileSync(path.join(ROOT, project.url));
    assert.equal(sha(compressed), project.sha256);
    const glb = parseGLB(gunzipSync(compressed));
    let meshes = 0, leaves = 0, coarse = 0, sourceTriangles = 0, coarsestTriangles = 0;
    for (const definition of glb.json.meshes) for (const primitive of definition.primitives) {
      const material = glb.json.materials[primitive.material];
      if (material.alphaMode === 'BLEND' || material.extensions?.KHR_materials_transmission) continue;
      const index = Uint32Array.from(accessor(glb, primitive.indices).values);
      if (index.length < 384 * 3) continue;
      const position = Float32Array.from(accessor(glb, primitive.attributes.POSITION).values);
      const attributes = Object.entries(primitive.attributes).filter(([name]) => name !== 'POSITION').map(([name, id]) => {
        const stream = accessor(glb, id);
        return { name: ({ NORMAL: 'normal', TEXCOORD_0: 'uv', COLOR_0: 'color' })[name] || name,
          itemSize: stream.n, array: Float32Array.from(stream.values) };
      });
      const source = { position, index, attributes };
      const tree = await buildClusterTree(source, MeshoptSimplifier, { protected: ['carbonSeat', 'seat'].includes(key) });
      verifyCoverage(source, tree); meshes++; leaves += tree.leafCount; coarse += tree.coarseCount;
      sourceTriangles += index.length / 3;
      coarsestTriangles += selectClusterNodes(tree, new Uint32Array(tree.nodes.length).fill(2))
        .reduce((sum, id) => sum + tree.nodes[id].count / 3, 0);
    }
    report.sources.push({ key, sha256: project.sha256, meshes, leaves, coarse, sourceTriangles, coarsestTriangles });
    console.log(JSON.stringify(report.sources.at(-1)));
  }
  report.checks.push('All 16 current source hashes verified; eligible opaque primitive leaves preserve exact triangle coverage');
}
report.status = 'passed';
const outputArg = process.argv.find(a => a.startsWith('--output='));
if (outputArg) fs.writeFileSync(outputArg.slice(9), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
