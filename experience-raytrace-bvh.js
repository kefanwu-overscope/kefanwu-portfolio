// Plain data BVH builder, shared by the module worker and deterministic tests.
// Nodes are 32 bytes: min.xyz / firstChildOrTriangle, max.xyz / triangleCount.
// Interior children are allocated in pairs, so right = left + 1.
export function buildRaytraceBVH(meshes, { maxTriangles = 1200000, leafSize = 8 } = {}) {
  const estimate = meshes.reduce((sum, mesh) => sum + mesh.ranges.reduce((n, r) => n + Math.floor(r.count / 3), 0), 0);
  if (!estimate || estimate > maxTriangles) throw new Error(estimate ? "raytrace geometry budget exceeded" : "no raytrace geometry");
  let triangles = new Float32Array(estimate * 12);
  let count = 0;
  for (const mesh of meshes) {
    const p = mesh.positions, index = mesh.indices, m = mesh.matrix;
    for (const range of mesh.ranges) for (let i = range.start, end = i + range.count; i + 2 < end; i += 3) {
      const vertices = [];
      for (let k = 0; k < 3; k++) {
        const v = (index ? index[i + k] : i + k) * 3;
        const x = p[v], y = p[v + 1], z = p[v + 2];
        vertices.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
      }
      if (!vertices.every(Number.isFinite)) continue;
      const a = vertices, e1 = [a[3] - a[0], a[4] - a[1], a[5] - a[2]], e2 = [a[6] - a[0], a[7] - a[1], a[8] - a[2]];
      const cross = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cross[0] ** 2 + cross[1] ** 2 + cross[2] ** 2 < 1e-24) continue;
      const t = count++ * 12;
      triangles.set(a.slice(0, 3), t); triangles.set(e1, t + 4); triangles.set(e2, t + 8);
    }
    // Permit the worker to reclaim transferred geometry before BVH construction.
    mesh.positions = mesh.indices = null;
  }
  if (!count) throw new Error("no nondegenerate raytrace triangles");
  if (count < estimate) triangles = triangles.slice(0, count * 12);
  const order = Uint32Array.from({ length: count }, (_, i) => i);
  const centers = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) for (let axis = 0; axis < 3; axis++) centers[i * 3 + axis] = triangles[i * 12 + axis] + (triangles[i * 12 + 4 + axis] + triangles[i * 12 + 8 + axis]) / 3;
  const capacity = Math.max(1, 2 ** (Math.ceil(Math.log2(Math.max(1, count / leafSize))) + 1) - 1);
  const nodes = new ArrayBuffer(capacity * 32), floats = new Float32Array(nodes), ints = new Uint32Array(nodes);
  let used = 1, maxDepth = 0;
  const swap = (a, b) => { const t = order[a]; order[a] = order[b]; order[b] = t; };
  // Balanced median partition keeps traversal below 32 stack entries even for
  // coincident centroids, thin walls and highly unequal CAD tessellation.
  function median(begin, end, target, axis) {
    while (end - begin > 1) {
      const pivot = centers[order[(begin + end) >>> 1] * 3 + axis];
      let i = begin, j = end - 1;
      while (i <= j) {
        while (centers[order[i] * 3 + axis] < pivot) i++;
        while (centers[order[j] * 3 + axis] > pivot) j--;
        if (i <= j) { swap(i, j); i++; j--; }
      }
      if (target <= j) end = j + 1;
      else if (target >= i) begin = i;
      else return;
    }
  }
  function build(node, start, length, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    const clo = [Infinity, Infinity, Infinity], chi = [-Infinity, -Infinity, -Infinity];
    for (let j = start; j < start + length; j++) {
      const id = order[j], t = id * 12;
      for (let axis = 0; axis < 3; axis++) {
        const a = triangles[t + axis], b = a + triangles[t + 4 + axis], c = a + triangles[t + 8 + axis], center = centers[id * 3 + axis];
        lo[axis] = Math.min(lo[axis], a, b, c); hi[axis] = Math.max(hi[axis], a, b, c);
        clo[axis] = Math.min(clo[axis], center); chi[axis] = Math.max(chi[axis], center);
      }
    }
    // Bounds expand by a small scale-relative amount to tolerate float32 edges.
    for (let axis = 0; axis < 3; axis++) {
      const epsilon = Math.max(1e-6, Math.max(Math.abs(lo[axis]), Math.abs(hi[axis])) * 2e-7);
      floats[node * 8 + axis] = lo[axis] - epsilon;
      floats[node * 8 + 4 + axis] = hi[axis] + epsilon;
    }
    if (length <= leafSize) { ints[node * 8 + 3] = start; ints[node * 8 + 7] = length; return; }
    let axis = 0;
    if (chi[1] - clo[1] > chi[axis] - clo[axis]) axis = 1;
    if (chi[2] - clo[2] > chi[axis] - clo[axis]) axis = 2;
    const mid = start + (length >>> 1);
    median(start, start + length, mid, axis);
    const left = used; used += 2; ints[node * 8 + 3] = left;
    build(left, start, mid - start, depth + 1);
    build(left + 1, mid, start + length - mid, depth + 1);
  }
  build(0, 0, count, 0);
  const ordered = new Float32Array(count * 12);
  for (let i = 0; i < count; i++) ordered.set(triangles.subarray(order[i] * 12, order[i] * 12 + 12), i * 12);
  return { triangles: ordered, nodes: nodes.slice(0, used * 32), triangleCount: count, nodeCount: used, maxDepth };
}

// Double-precision reference for actual GPU traversal comparisons, not runtime.
export function traceRayCPU(bvh, origin, direction, maxDistance = Infinity, minDistance = 0.00001) {
  const triangles = bvh.triangles;
  let nearest = maxDistance;
  for (let t = 0; t < triangles.length; t += 12) {
    const a = triangles.subarray(t, t + 3), e1 = triangles.subarray(t + 4, t + 7), e2 = triangles.subarray(t + 8, t + 11);
    const p = [direction[1] * e2[2] - direction[2] * e2[1], direction[2] * e2[0] - direction[0] * e2[2], direction[0] * e2[1] - direction[1] * e2[0]];
    const det = e1[0] * p[0] + e1[1] * p[1] + e1[2] * p[2];
    if (Math.abs(det) < 1e-12) continue;
    const s = origin.map((v, i) => v - a[i]), inv = 1 / det;
    const u = (s[0] * p[0] + s[1] * p[1] + s[2] * p[2]) * inv;
    if (u < 0 || u > 1) continue;
    const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]];
    const v = (direction[0] * q[0] + direction[1] * q[1] + direction[2] * q[2]) * inv;
    if (v < 0 || u + v > 1) continue;
    const d = (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]) * inv;
    if (d > minDistance && d < nearest) nearest = d;
  }
  return nearest;
}
