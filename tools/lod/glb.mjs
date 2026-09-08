import fs from 'node:fs';
import assert from 'node:assert/strict';

export const components = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4};
export const types = {5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
export function readGLB(file) {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67, 'GLB magic');
  assert.equal(bytes.readUInt32LE(4), 2, 'GLB version');
  assert.equal(bytes.readUInt32LE(8), bytes.length, 'GLB byte length');
  let json, bin;
  for (let offset = 12; offset < bytes.length;) {
    const length = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4);
    assert.equal(length % 4, 0, 'chunk alignment');
    assert(offset + 8 + length <= bytes.length, 'chunk range');
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === 0x4e4f534a) { assert(!json); json = JSON.parse(chunk.toString('utf8')); }
    else if (type === 0x004e4942) { assert(!bin); bin = chunk; }
    else throw new Error('Unknown GLB chunk');
    offset += 8 + length;
  }
  assert(json && bin);
  assert.equal(json.asset.version, '2.0');
  assert.equal(json.buffers.length, 1);
  assert(!json.buffers[0].uri);
  assert(bin.length >= json.buffers[0].byteLength && bin.length - json.buffers[0].byteLength <= 3);
  return {json, bin, bytes};
}

export function accessor(glb, index) {
  const a = glb.json.accessors[index], v = glb.json.bufferViews[a.bufferView];
  assert(a && v && !a.sparse && !a.extensions && !v.extensions, 'Unsupported accessor');
  assert.equal(v.buffer, 0);
  const Type = types[a.componentType], n = components[a.type];
  assert(Type && n, 'Unsupported component type');
  const size = Type.BYTES_PER_ELEMENT * n, stride = v.byteStride || size;
  const start = (v.byteOffset || 0) + (a.byteOffset || 0);
  assert(start + (a.count - 1) * stride + size <= (v.byteOffset || 0) + v.byteLength);
  assert((v.byteOffset || 0) + v.byteLength <= glb.json.buffers[0].byteLength);
  const packed = Buffer.alloc(a.count * size);
  for (let i = 0; i < a.count; ++i) glb.bin.copy(packed, i * size, start + i * stride, start + i * stride + size);
  const values = new Type(packed.buffer, packed.byteOffset, a.count * n);
  for (const value of values) assert(Number.isFinite(value), 'Nonfinite attribute');
  return {a, values, packed, size, n};
}

export const identity = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
export function multiply(a, b) {
  const m = new Array(16).fill(0);
  for (let c = 0; c < 4; ++c) for (let r = 0; r < 4; ++r)
    for (let k = 0; k < 4; ++k) m[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return m;
}
export function matrix(node) {
  if (node.matrix) return node.matrix;
  const [x,y,z,w] = node.rotation || [0,0,0,1];
  const [sx,sy,sz] = node.scale || [1,1,1], [tx,ty,tz] = node.translation || [0,0,0];
  return [(1-2*y*y-2*z*z)*sx, (2*x*y+2*w*z)*sx, (2*x*z-2*w*y)*sx, 0,
    (2*x*y-2*w*z)*sy, (1-2*x*x-2*z*z)*sy, (2*y*z+2*w*x)*sy, 0,
    (2*x*z+2*w*y)*sz, (2*y*z-2*w*x)*sz, (1-2*x*x-2*y*y)*sz, 0, tx,ty,tz,1];
}
export function transform(m, x, y, z) {
  return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]];
}
export function instances(json, allScenes = false) {
  const out = [];
  function visit(index, parent, ancestors) {
    assert(!ancestors.has(index), 'Node cycle');
    const node = json.nodes[index], m = multiply(parent, matrix(node));
    if (node.mesh !== undefined) out.push({node: index, mesh: node.mesh, matrix: m});
    const next = new Set(ancestors).add(index);
    for (const child of node.children || []) visit(child, m, next);
  }
  for (const scene of allScenes ? json.scenes : [json.scenes[json.scene || 0]])
    for (const root of scene.nodes || []) visit(root, identity(), new Set());
  return out;
}
export const emptyBounds = () => ({min: [Infinity,Infinity,Infinity], max: [-Infinity,-Infinity,-Infinity]});
export function expand(bounds, point) {
  for (let a = 0; a < 3; ++a) {
    bounds.min[a] = Math.min(bounds.min[a], point[a]);
    bounds.max[a] = Math.max(bounds.max[a], point[a]);
  }
}
export function bounds(glb) {
  const result = emptyBounds();
  for (const instance of instances(glb.json)) for (const prim of glb.json.meshes[instance.mesh].primitives) {
    const pos = accessor(glb, prim.attributes.POSITION).values;
    for (let i = 0; i < pos.length; i += 3) expand(result, transform(instance.matrix, pos[i], pos[i+1], pos[i+2]));
  }
  return result;
}
export function stats(glb) {
  let triangles = 0, vertices = 0, primitives = 0;
  for (const mesh of glb.json.meshes) for (const prim of mesh.primitives) {
    assert.equal(prim.mode ?? 4, 4, 'Only triangle lists supported');
    const position = accessor(glb, prim.attributes.POSITION), indices = accessor(glb, prim.indices);
    assert.equal(indices.n, 1);
    assert.equal(indices.values.length % 3, 0);
    for (const i of indices.values) assert(i < position.a.count, 'Index range');
    triangles += indices.values.length / 3; vertices += position.a.count; primitives++;
    for (const id of Object.values(prim.attributes)) assert.equal(accessor(glb, id).a.count, position.a.count);
  }
  return {triangles, vertices, primitives, meshes: glb.json.meshes.length, nodes: glb.json.nodes.length, bytes: glb.bytes.length};
}

// Build a fresh BIN: no old accessors, bufferViews, or unreferenced high-poly data survive.
export class Builder {
  constructor(source) {
    this.json = structuredClone(source.json);
    this.json.accessors = []; this.json.bufferViews = []; this.parts = []; this.length = 0;
  }
  view(bytes, target) {
    const pad = (4 - this.length % 4) % 4;
    if (pad) { this.parts.push(Buffer.alloc(pad)); this.length += pad; }
    const view = {buffer: 0, byteOffset: this.length, byteLength: bytes.length};
    if (target) view.target = target;
    this.json.bufferViews.push(view); this.parts.push(Buffer.from(bytes)); this.length += bytes.length;
    return this.json.bufferViews.length - 1;
  }
  addAccessor(template, values, target) {
    const a = structuredClone(template);
    delete a.byteOffset; delete a.min; delete a.max;
    a.bufferView = this.view(Buffer.from(values.buffer, values.byteOffset, values.byteLength), target);
    a.count = values.length / components[a.type];
    const count = components[a.type];
    if (template.min || template.max) {
      a.min = Array(count).fill(Infinity); a.max = Array(count).fill(-Infinity);
      for (let i = 0; i < values.length; i++) {
        a.min[i % count] = Math.min(a.min[i % count], values[i]);
        a.max[i % count] = Math.max(a.max[i % count], values[i]);
      }
    }
    this.json.accessors.push(a);
    return this.json.accessors.length - 1;
  }
  binary() {
    this.json.buffers = [{byteLength: this.length}];
    const rawJson = Buffer.from(JSON.stringify(this.json, (_key, value) =>
      typeof value === 'number' && Object.is(value, -0) ? JSON.rawJSON('-0') : value));
    const json = Buffer.concat([rawJson, Buffer.alloc((4 - rawJson.length % 4) % 4, 32)]);
    const bin = Buffer.concat([...this.parts, Buffer.alloc((4 - this.length % 4) % 4)]);
    const header = Buffer.alloc(12), jhead = Buffer.alloc(8), bhead = Buffer.alloc(8);
    header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8);
    jhead.writeUInt32LE(json.length); jhead.writeUInt32LE(0x4e4f534a, 4);
    bhead.writeUInt32LE(bin.length); bhead.writeUInt32LE(0x004e4942, 4);
    return Buffer.concat([header, jhead, json, bhead, bin]);
  }
}
