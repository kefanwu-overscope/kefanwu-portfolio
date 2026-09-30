import assert from "node:assert/strict";
import { buildRaytraceBVH, traceRayCPU } from "../../experience-raytrace-bvh.js";
import { snapshotRaytraceGeometry } from "../../experience-raytrace.js";
import { sphereFixture, triangleFixture, mockScene } from "./raytrace-fixtures.js";

const sphere = buildRaytraceBVH([sphereFixture()]);
assert.equal(sphere.triangleCount, 960);
assert.ok(sphere.maxDepth < 16);
assert.ok(Math.abs(traceRayCPU(sphere, [0, 0, 3], [0, 0, -1], 10) - 2) < 1e-6);
assert.ok(Math.abs(traceRayCPU(sphere, [0, 0, 0], [1, 0, 0], 10) - 1) < 1e-6);
assert.equal(traceRayCPU(sphere, [0, 0, 3], [0, 1, 0], 10), 10);
assert.equal(traceRayCPU(sphere, [0, 0, 3], [0, 0, -1], 0.5), 0.5);
const plane = buildRaytraceBVH([triangleFixture()]);
assert.equal(traceRayCPU(plane, [0, 0, 2], [0, 0, -1], 10), 2);
assert.equal(traceRayCPU(plane, [0, 0, -2], [0, 0, 1], 10), 2);
assert.equal(traceRayCPU(plane, [1.5, 0, 2], [0, 0, -1], 10), 2);
assert.throws(() => buildRaytraceBVH([triangleFixture()], { maxTriangles: 1 }), /budget/);

// Validate every interior/leaf bound against its complete triangle subtree.
const floats = new Float32Array(sphere.nodes), ints = new Uint32Array(sphere.nodes);
let visited = 0;
function validate(node) {
  visited++;
  const first = ints[node * 8 + 3], count = ints[node * 8 + 7];
  if (!count) {
    assert.ok(first + 1 < sphere.nodeCount);
    for (const child of [first, first + 1]) for (let axis = 0; axis < 3; axis++) {
      assert.ok(floats[child * 8 + axis] >= floats[node * 8 + axis] - 1e-6);
      assert.ok(floats[child * 8 + 4 + axis] <= floats[node * 8 + 4 + axis] + 1e-6);
    }
    validate(first); validate(first + 1); return;
  }
  assert.ok(count <= 8);
  for (let i = first; i < first + count; i++) for (let axis = 0; axis < 3; axis++) {
    const a = sphere.triangles[i * 12 + axis];
    for (const coordinate of [a, a + sphere.triangles[i * 12 + axis + 4], a + sphere.triangles[i * 12 + axis + 8]]) {
      assert.ok(coordinate >= floats[node * 8 + axis]); assert.ok(coordinate <= floats[node * 8 + 4 + axis]);
    }
  }
}
validate(0); assert.equal(visited, sphere.nodeCount);
const scene = mockScene(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]));
assert.equal((await snapshotRaytraceGeometry(scene)).triangles, 1);
let mesh; scene.traverse((value) => mesh = value);
mesh.material.transparent = true; assert.equal((await snapshotRaytraceGeometry(scene)).triangles, 0);
mesh.material.transparent = false; mesh.userData.dynamic = true; assert.equal((await snapshotRaytraceGeometry(scene)).triangles, 0);
mesh.userData.dynamic = false; assert.equal((await snapshotRaytraceGeometry(scene, { exclude: [mesh] })).triangles, 0);
console.log(JSON.stringify({ status: "passed", cpuCases: 15, boundNodesValidated: visited, sphereTriangles: sphere.triangleCount }));
