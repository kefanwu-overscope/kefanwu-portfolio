// Renderer-independent cluster construction and selection. Source vertices are
// never changed: every representation contains indices into the original streams.
export const CLUSTER_SCHEMA = 'room-clusters-v1';
export const LEAF_TRIANGLES = 128;

export function validateClusterInput(input) {
  const { position, index } = input;
  if (!(position instanceof Float32Array) || position.length % 3 || !position.length ||
      !(index instanceof Uint32Array) || index.length % 3 || !index.length) throw Error('Invalid cluster geometry');
  for (const v of position) if (!Number.isFinite(v)) throw Error('Nonfinite cluster position');
  for (const i of index) if (i >= position.length / 3) throw Error('Cluster index outside source');
  for (const a of input.attributes || []) if (!(a.array instanceof Float32Array) ||
      a.array.length !== position.length / 3 * a.itemSize) throw Error('Invalid cluster attribute');
}

// Median spatial partitioning is deliberately deterministic. Leaves partition
// the exact source triangle list (including coincident/degenerate triangles).
export async function buildClusterTree(input, simplifier, options = {}) {
  validateClusterInput(input);
  const { position, index } = input;
  const leafTriangles = options.leafTriangles || LEAF_TRIANGLES;
  const protectedGeometry = !!options.protected;
  if (simplifier) await simplifier.ready;
  const triangleCount = index.length / 3;
  const centroids = new Float32Array(triangleCount * 3);
  for (let t = 0; t < triangleCount; t++) for (let axis = 0; axis < 3; axis++)
    centroids[t * 3 + axis] = (position[index[t * 3] * 3 + axis] +
      position[index[t * 3 + 1] * 3 + axis] + position[index[t * 3 + 2] * 3 + axis]) / 3;
  const nodes = [], chunks = [];
  let offset = 0, leafCount = 0, coarseCount = 0;
  const attributeStreams = (input.attributes || []).filter(a =>
    ['normal', 'uv', 'color', 'uv1'].includes(a.name));
  const weights = attributeStreams.flatMap(a => Array(a.itemSize).fill(
    a.name === 'normal' ? 0.03 : a.name === 'color' ? 1 : 0.25));

  function simplifySubset(source, sphere) {
    if (!simplifier || protectedGeometry) return null;
    // Work in a compact local subset, then remap retained indices to the exact
    // original vertices. LockBorder fixes all group boundaries at every level.
    const local = new Map(), originals = [], indices = new Uint32Array(source.length);
    for (let j = 0; j < source.length; j++) {
      const id = source[j];
      if (!local.has(id)) { local.set(id, originals.length); originals.push(id); }
      indices[j] = local.get(id);
    }
    const positions = new Float32Array(originals.length * 3);
    const attributes = new Float32Array(originals.length * weights.length);
    const locks = new Uint8Array(originals.length);
    const low = [Infinity, Infinity, Infinity], high = [-Infinity, -Infinity, -Infinity];
    const lowAt = [], highAt = [];
    for (let j = 0; j < originals.length; j++) {
      const id = originals[j]; positions.set(position.subarray(id * 3, id * 3 + 3), j * 3);
      let component = 0;
      for (const a of attributeStreams) for (let k = 0; k < a.itemSize; k++)
        attributes[j * weights.length + component++] = a.array[id * a.itemSize + k];
      for (let axis = 0; axis < 3; axis++) {
        const value = positions[j * 3 + axis];
        if (value < low[axis]) { low[axis] = value; lowAt[axis] = j; }
        if (value > high[axis]) { high[axis] = value; highAt[axis] = j; }
      }
    }
    for (const id of [...lowAt, ...highAt]) locks[id] = 1;
    // ErrorAbsolute makes the returned error local geometry units. No vertex
    // updates or permissive seam collapses; shader attributes remain exact.
    const target = Math.min(source.length, leafTriangles * 3);
    const [reduced, error] = simplifier.simplifyWithAttributes(indices, positions, 3,
      attributes, weights.length, weights, locks, target, sphere[3] * 0.12,
      ['LockBorder', 'ErrorAbsolute']);
    if (reduced.length >= source.length * 0.92 || !reduced.length || !Number.isFinite(error)) return null;
    return { index: Uint32Array.from(reduced, i => originals[i]), error: Math.max(error, 1e-9) };
  }

  function build(triangles, parent = -1) {
    const id = nodes.length, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    const source = new Uint32Array(triangles.length * 3);
    for (let t = 0; t < triangles.length; t++) {
      const src = triangles[t] * 3;
      for (let k = 0; k < 3; k++) {
        const v = index[src + k]; source[t * 3 + k] = v;
        for (let axis = 0; axis < 3; axis++) {
          min[axis] = Math.min(min[axis], position[v * 3 + axis]);
          max[axis] = Math.max(max[axis], position[v * 3 + axis]);
        }
      }
    }
    const sphere = min.map((v, axis) => (v + max[axis]) * 0.5);
    sphere.push(Math.hypot(...max.map((v, axis) => v - sphere[axis])) + 1e-7);
    const node = { parent, left: -1, right: -1, offset: 0, count: 0, error: 0, sphere,
      sourceTriangles: triangles.length };
    nodes.push(node);
    if (triangles.length <= leafTriangles) {
      leafCount++; node.offset = offset; node.count = source.length;
      chunks.push(source); offset += source.length;
    } else {
      const span = max.map((v, axis) => v - min[axis]);
      const axis = span.indexOf(Math.max(...span));
      triangles.sort((a, b) => centroids[a * 3 + axis] - centroids[b * 3 + axis] || a - b);
      const half = Math.ceil(triangles.length / 2);
      node.left = build(triangles.slice(0, half), id);
      node.right = build(triangles.slice(half), id);
      const reduced = simplifySubset(source, sphere);
      if (reduced) {
        node.offset = offset; node.count = reduced.index.length; node.error = reduced.error;
        chunks.push(reduced.index); offset += reduced.index.length; coarseCount++;
      }
    }
    return id;
  }
  build(Array.from({ length: triangleCount }, (_, i) => i));
  const indices = new Uint32Array(offset);
  let at = 0;
  for (const chunk of chunks) { indices.set(chunk, at); at += chunk.length; }
  return { schema: CLUSTER_SCHEMA, vertexCount: position.length / 3, triangleCount,
    protected: protectedGeometry, nodes, indices, leafCount, coarseCount,
    // Include a conservative metadata allowance; this is managed data accounting,
    // not a claim about browser object, driver, or total process allocation.
    byteLength: indices.byteLength + nodes.length * 256 };
}

export function validateClusterTree(tree, vertexCount, sourceTriangles) {
  if (tree?.schema !== CLUSTER_SCHEMA || tree.vertexCount !== vertexCount || tree.triangleCount !== sourceTriangles ||
      !Array.isArray(tree.nodes) || !tree.nodes.length || !(tree.indices instanceof Uint32Array)) return false;
  if (tree.nodes[0].parent !== -1 || tree.nodes.length > sourceTriangles * 2) return false;
  let triangles = 0;
  for (let id = 0; id < tree.nodes.length; id++) {
    const n = tree.nodes[id];
    if (!n || !Number.isInteger(n.offset) || !Number.isInteger(n.count) || n.offset < 0 || n.count < 0 ||
        n.count % 3 || n.offset + n.count > tree.indices.length || !Number.isFinite(n.error) || n.error < 0 ||
        n.sphere.length !== 4 || !n.sphere.every(Number.isFinite) || n.sphere[3] < 0) return false;
    if (id && (!Number.isInteger(n.parent) || n.parent < 0 || n.parent >= id ||
        (tree.nodes[n.parent].left !== id && tree.nodes[n.parent].right !== id))) return false;
    if (n.left < 0) { if (!n.count || n.right !== -1) return false; triangles += n.count / 3; }
    else if (n.left <= id || n.right <= id || n.left === n.right || n.left >= tree.nodes.length || n.right >= tree.nodes.length ||
        tree.nodes[n.left].parent !== id || tree.nodes[n.right].parent !== id) return false;
    if (n.sourceTriangles !== (n.left < 0 ? n.count / 3 :
      tree.nodes[n.left].sourceTriangles + tree.nodes[n.right].sourceTriangles)) return false;
  }
  for (const i of tree.indices) if (i >= vertexCount) return false;
  return triangles === sourceTriangles && tree.nodes[0].sourceTriangles === sourceTriangles;
}

// Packed culling uniforms: six normalized planes, viewProjection, camera.xyz/
// projectionScale, viewForward.xyz/near, gaze.xy/pixelError/nodeCount.
export function classifyCluster(nodes, base, frame) {
  const x = nodes[base], y = nodes[base + 1], z = nodes[base + 2], radius = nodes[base + 3];
  const cx = x - frame[40], cy = y - frame[41], cz = z - frame[42];
  const depth = cx * frame[44] + cy * frame[45] + cz * frame[46];
  // TAA jitters the raster camera after this unjittered selection. Retain a
  // 1.5-pixel guard, including the lower-resolution motion input's pixel footprint.
  const guard = 0.001 + Math.max(0, depth + radius) / Math.max(1, frame[43]) * 1.5;
  for (let p = 0; p < 24; p += 4)
    if (frame[p] * x + frame[p + 1] * y + frame[p + 2] * z + frame[p + 3] < -radius - guard) return 0;
  if (nodes[base + 6] < 0.5) return 1;
  const errorPixels = nodes[base + 4] * frame[43] / Math.max(frame[47], depth - radius);
  const clipX = frame[24] * x + frame[28] * y + frame[32] * z + frame[36];
  const clipY = frame[25] * x + frame[29] * y + frame[33] * z + frame[37];
  const clipW = frame[27] * x + frame[31] * y + frame[35] * z + frame[39];
  const radial = Math.hypot(clipX / Math.max(0.0001, clipW) - frame[48], clipY / Math.max(0.0001, clipW) - frame[49]);
  const t = Math.max(0, Math.min(1, (radial - 0.15) / 0.85));
  const attention = 0.62 + 0.98 * t * t * (3 - 2 * t);
  const threshold = frame[50] * attention * nodes[base + 5] * (nodes[base + 7] > 0 ? 1.12 : 0.9);
  return errorPixels <= threshold ? 2 : 1;
}

export function selectClusterNodes(tree, classifications, offset = 0) {
  const selected = [], stack = [0];
  while (stack.length) {
    const id = stack.pop(), node = tree.nodes[id], classification = classifications[offset + id];
    if (classification === 0) continue;
    if (node.left < 0 || (classification === 2 && node.count)) selected.push(id);
    else stack.push(node.right, node.left);
  }
  return selected;
}
