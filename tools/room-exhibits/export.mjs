import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { Matrix4, Matrix3, Quaternion, Vector3 } from '../../vendor/three/0.185.0/build/three.module.js';
import { readBufferView } from '../../studio-motion-runtime.js';
import { MeshoptSimplifier as simplify } from '../lod/vendor/meshopt_simplifier.mjs';
import { Builder, readGLB, accessor, bounds } from '../lod/glb.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const OUTPUT = path.join(ROOT, 'models/room-current');
const EVIDENCE = path.resolve(ROOT, '../.codex/room-exhibits-20260925');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const INDEX = readJSON(path.join(ROOT, 'assets/studio-motion/index.json'));
const Y_UP = new Matrix4().makeRotationX(-Math.PI / 2);
const SEMANTICS = { position: 'POSITION', normal: 'NORMAL', uv: 'TEXCOORD_0', color: 'COLOR_0', sourceCoordinates: '_SOURCECOORDINATES', objectCoordinates: '_OBJECTCOORDINATES', attributeOpacity: '_ATTRIBUTEOPACITY', attributeRoughness: '_ATTRIBUTEROUGHNESS' };
// Attribute-aware simplification never changes a retained vertex or its source
// shader coordinates. Carbon and the 44-hole sheet seat remain unsimplified.
const RATIOS = { carbonSeat: 1, seat: 1, ansysCfd: 0.12, brakeSim: 0.12, education: 0.035, telecaster: 0.035, formlabs: 0.065 };
const MAX_ERROR = 0.008;
const SMALL_TRIANGLES = 32;

function buffer(file, definition) {
  const bytes = fs.readFileSync(file);
  assert.equal(sha(bytes), definition.sha256, 'Source package hash');
  const value = gunzipSync(bytes);
  assert.equal(value.byteLength, definition.byteLength);
  return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
}

function firstTrack(descriptor, motion) {
  if (!descriptor) return null;
  const array = readBufferView(motion, descriptor);
  const frame = descriptor.frameMap ? readBufferView(motion, descriptor.frameMap)[0] : 0;
  const offset = frame * descriptor.valuesPerFrame;
  if (!descriptor.elementMap) return array.slice(offset, offset + descriptor.valuesPerFrame);
  const map = readBufferView(motion, descriptor.elementMap), n = descriptor.itemSize || 1;
  const result = new Float32Array(map.length * n);
  for (let i = 0; i < map.length; i++) result.set(array.subarray(offset + map[i] * n, offset + (map[i] + 1) * n), i * n);
  return result;
}

function sourceMaterials(manifest, motion) {
  return manifest.materials.map((definition) => {
    const source = structuredClone(definition);
    for (const [name, track] of Object.entries(source.initialTracks || {})) {
      const value = Array.from(firstTrack(track, motion));
      if (['warming', 'incandescence'].includes(name)) continue; // Sample zero is cold metal.
      source[name] = value.length === 1 ? value[0] : value;
    }
    delete source.tracks; delete source.initialTracks; delete source.heat;
    return source;
  });
}

function gltfMaterial(source) {
  const base = source.baseColor || [0.35, 0.35, 0.35, 1];
  const alpha = source.opacity ?? base[3] ?? 1;
  const result = {
    name: source.name,
    pbrMetallicRoughness: { baseColorFactor: [...base.slice(0, 3), alpha], metallicFactor: source.metalness ?? 0, roughnessFactor: source.roughness ?? 0.5 },
    doubleSided: source.doubleSide === true,
    extras: { roomSourceMaterial: source },
  };
  if (alpha < 0.999 || source.transparent) result.alphaMode = 'BLEND';
  const extensions = {};
  if (source.transmission) extensions.KHR_materials_transmission = { transmissionFactor: source.transmission };
  if (source.transmission && source.ior) extensions.KHR_materials_ior = { ior: source.ior };
  if (source.clearcoat) extensions.KHR_materials_clearcoat = { clearcoatFactor: source.clearcoat, clearcoatRoughnessFactor: source.clearcoatRoughness ?? 0.3 };
  if (source.unlit) extensions.KHR_materials_unlit = {};
  if (source.emissive && source.emissiveIntensity) {
    const factor = source.emissive.slice(0, 3).map(v => v * source.emissiveIntensity), strength = Math.max(1, ...factor);
    result.emissiveFactor = factor.map(v => v / strength);
    if (strength > 1) extensions.KHR_materials_emissive_strength = { emissiveStrength: strength };
  }
  if (Object.keys(extensions).length) result.extensions = extensions;
  return result;
}

function lockExtrema(position, indices) {
  const locks = new Uint8Array(position.length / 3);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], low = [], high = [];
  for (const i of indices) for (let j = 0; j < 3; j++) {
    const value = position[3 * i + j];
    if (value < lo[j]) { lo[j] = value; low[j] = i; }
    if (value > hi[j]) { hi[j] = value; high[j] = i; }
  }
  for (const i of [...low, ...high]) locks[i] = 1;
  return locks;
}

function compact(streams, index) {
  const indices = Uint32Array.from(index);
  const [remap, count] = simplify.compactMesh(indices);
  const output = {};
  for (const [name, stream] of Object.entries(streams)) {
    const values = new Float32Array(count * stream.size);
    for (let i = 0; i < remap.length; i++) if (remap[i] !== 0xffffffff) values.set(stream.values.subarray(i * stream.size, (i + 1) * stream.size), remap[i] * stream.size);
    output[name] = { values, size: stream.size };
  }
  return { streams: output, indices, count };
}

function reduce(streams, index, ratio, material) {
  const part = compact(streams, index);
  let reduced = part.indices, error = 0;
  if (ratio < 1 && reduced.length > SMALL_TRIANGLES * 3) {
    const weighted = Object.entries(part.streams).filter(([name]) => ['normal', 'uv', 'color'].includes(name));
    const weights = weighted.flatMap(([name, stream]) => Array(stream.size).fill(name === 'color' ? 1 : name === 'normal' ? 0.025 : 0.2));
    const attributes = new Float32Array(part.count * weights.length);
    for (let vertex = 0; vertex < part.count; vertex++) {
      let component = 0;
      for (const [, stream] of weighted) for (let j = 0; j < stream.size; j++) attributes[vertex * weights.length + component++] = stream.values[vertex * stream.size + j];
    }
    const target = Math.max(SMALL_TRIANGLES * 3, Math.floor(reduced.length * ratio / 3) * 3);
    [reduced, error] = simplify.simplifyWithAttributes(reduced, part.streams.position.values, 3, attributes, weights.length, weights,
      lockExtrema(part.streams.position.values, reduced), target, MAX_ERROR, ['LockBorder', 'Permissive']);
  }
  const result = compact(part.streams, reduced);
  return { ...result, error, material };
}

function geometry(manifest, geometryBuffer, motion, materials) {
  const parts = [], report = [], hidden = [];
  const quaternion = new Quaternion(), position = new Vector3(), scale = new Vector3(), normalMatrix = new Matrix3(), vector = new Vector3();
  for (let nodeIndex = 0; nodeIndex < manifest.nodes.length; nodeIndex++) {
    const node = manifest.nodes[nodeIndex], tracks = node.initialTracks || {};
    const visible = tracks.visible ? firstTrack(tracks.visible, motion)[0] >= 0.5 : node.visible !== false;
    const legend = manifest.project === 'ansysCfd' && (['Pressure legend label', 'Actual pressure range color scale'].includes(node.name) || node.name.startsWith('Pressure tick '));
    if (!visible || legend) { hidden.push({ name: node.name, reason: legend ? 'Same source-camera labels hidden by inspector' : 'Hidden at source sample zero' }); continue; }
    const assigned = (node.materialIndices || [0]).map(index => materials[index]);
    const procedural = assigned.some(m => m.procedural);
    const streams = {};
    for (const [name, semantic] of Object.entries(SEMANTICS)) {
      if (!node.geometry[name] || (name === 'sourceCoordinates' && !procedural)) continue;
      streams[name] = { values: Float32Array.from(readBufferView(geometryBuffer, node.geometry[name])), size: node.geometry[name].itemSize || 1 };
    }
    if (assigned.some(m => m.procedural?.coordinateSpace === 'object') && !streams.objectCoordinates) streams.objectCoordinates = { values: streams.position.values.slice(), size: 3 };
    for (const [track, attribute] of [['deformationPosition', 'position'], ['deformationNormal', 'normal'], ['attributeOpacity', 'attributeOpacity'], ['attributeRoughness', 'attributeRoughness']]) {
      if (tracks[track]) streams[attribute] = { values: Float32Array.from(firstTrack(tracks[track], motion)), size: tracks[track].itemSize || 1 };
    }
    if (assigned.some(m => m.procedural?.type === 'carbon')) {
      const count = streams.position.values.length / 3;
      streams.attributeOpacity ||= { values: new Float32Array(count).fill(1), size: 1 };
      streams.attributeRoughness ||= { values: new Float32Array(count).fill(assigned[0].roughness), size: 1 };
    }
    const transform = node.transform || {};
    position.fromArray(firstTrack(tracks.position, motion) || transform.position || [0, 0, 0]);
    quaternion.fromArray(firstTrack(tracks.quaternion, motion) || transform.quaternion || [0, 0, 0, 1]);
    scale.fromArray(firstTrack(tracks.scale, motion) || transform.scale || [1, 1, 1]);
    if (Math.abs(scale.x * scale.y * scale.z) < 1e-15) { hidden.push({ name: node.name, reason: 'Zero-scale source particle at sample zero' }); continue; }
    const matrix = new Matrix4().multiplyMatrices(Y_UP, new Matrix4().compose(position, quaternion, scale));
    normalMatrix.getNormalMatrix(matrix);
    for (let offset = 0; offset < streams.position.values.length; offset += 3) vector.fromArray(streams.position.values, offset).applyMatrix4(matrix).toArray(streams.position.values, offset);
    if (streams.normal) for (let offset = 0; offset < streams.normal.values.length; offset += 3) vector.fromArray(streams.normal.values, offset).applyNormalMatrix(normalMatrix).toArray(streams.normal.values, offset);
    const indices = node.geometry.index ? Uint32Array.from(readBufferView(geometryBuffer, node.geometry.index)) : Uint32Array.from({ length: streams.position.values.length / 3 }, (_, i) => i);
    if (matrix.determinant() < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
    const groups = node.geometry.groups?.length ? node.geometry.groups : [{ start: 0, count: indices.length, materialIndex: 0 }];
    for (const group of groups) {
      const material = (node.materialIndices || [0])[group.materialIndex];
      assert.notEqual(material, undefined);
      const sourceIndex = indices.slice(group.start, group.start + group.count);
      const part = reduce(streams, sourceIndex, RATIOS[manifest.project] ?? 0.1, material);
      part.sourceNode = node.name;
      parts.push(part);
      report.push({ name: node.name, material: materials[material].name, sourceTriangles: sourceIndex.length / 3, triangles: part.indices.length / 3, appearanceError: part.error });
    }
  }
  return { parts, report, hidden };
}

function mergeParts(parts, materials) {
  const buckets = new Map();
  for (const part of parts) {
    // Transparent/transmissive components keep source object separation so the
    // room's camera can sort vessel walls and internal components correctly.
    const source = materials[part.material];
    const id = JSON.stringify([part.material, Object.entries(part.streams).map(([key, stream]) => [key, stream.size]), source.transmission || source.opacity < 0.999 ? part.sourceNode : 'opaque']);
    if (!buckets.has(id)) buckets.set(id, []);
    buckets.get(id).push(part);
  }
  return [...buckets.values()].map(pieces => {
    const count = pieces.reduce((sum, piece) => sum + piece.count, 0);
    const streams = {};
    for (const [name, stream] of Object.entries(pieces[0].streams)) {
      const values = new Float32Array(count * stream.size); let offset = 0;
      for (const piece of pieces) { values.set(piece.streams[name].values, offset); offset += piece.streams[name].values.length; }
      streams[name] = { values, size: stream.size };
    }
    const indices = new (count < 65536 ? Uint16Array : Uint32Array)(pieces.reduce((sum, piece) => sum + piece.indices.length, 0));
    let offset = 0, vertex = 0;
    for (const piece of pieces) { for (const index of piece.indices) indices[offset++] = index + vertex; vertex += piece.count; }
    return { streams, indices, count, material: pieces[0].material, sourceNodes: pieces.map(piece => piece.sourceNode) };
  });
}

function makeGLB(key, parts, materials, source) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const part of parts) for (let i = 0; i < part.streams.position.values.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3], part.streams.position.values[i]); hi[i % 3] = Math.max(hi[i % 3], part.streams.position.values[i]);
  }
  const shift = [-(lo[0] + hi[0]) / 2, -lo[1], -(lo[2] + hi[2]) / 2];
  for (const part of parts) for (let i = 0; i < part.streams.position.values.length; i++) part.streams.position.values[i] += shift[i % 3];
  const gltfMaterials = materials.map(gltfMaterial);
  const json = { asset: { version: '2.0', generator: 'room-exhibits/export.mjs: current studio source sample zero' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], materials: gltfMaterials, accessors: [], bufferViews: [], buffers: [], extensionsUsed: [...new Set(gltfMaterials.flatMap(m => Object.keys(m.extensions || {})))], extras: { project: key, source, sample: 0, coordinates: 'y-up', sourceTranslationAfterYUp: shift } };
  const builder = new Builder({ json });
  for (const [number, part] of parts.entries()) {
    const primitive = { attributes: {}, material: part.material, mode: 4 };
    for (const [name, stream] of Object.entries(part.streams)) primitive.attributes[SEMANTICS[name]] = builder.addAccessor({ componentType: 5126, type: ['SCALAR', 'SCALAR', 'VEC2', 'VEC3', 'VEC4'][stream.size], ...(name === 'position' ? { min: [] } : {}) }, stream.values, 34962);
    primitive.indices = builder.addAccessor({ componentType: part.indices.BYTES_PER_ELEMENT === 2 ? 5123 : 5125, type: 'SCALAR' }, part.indices, 34963);
    builder.json.meshes.push({ name: materials[part.material].name, primitives: [primitive] });
    builder.json.nodes.push({ name: materials[part.material].name, mesh: number, extras: { sourceNodes: part.sourceNodes } });
    builder.json.scenes[0].nodes.push(number);
  }
  return { bytes: builder.binary(), shift, sourceBoundsYUp: { min: lo, max: hi } };
}

await simplify.ready;
fs.mkdirSync(OUTPUT, { recursive: true });
fs.mkdirSync(EVIDENCE, { recursive: true });
const summary = { schema: 'room-exhibits-v1', sourceRelease: INDEX.release, sourceIndexSha256: sha(fs.readFileSync(path.join(ROOT, 'assets/studio-motion/index.json'))), sample: 0, simplification: { maximumAppearanceError: MAX_ERROR, keepSourceVertices: true, lockBordersAndExtrema: true, seamPolicy: 'Permissive attribute-aware collapses retain source normal/color samples', normalWeight: 0.025, colorWeight: 1, minimumPrimitiveTriangles: SMALL_TRIANGLES, defaultTargetRatio: 0.1, ratios: RATIOS }, projects: {} };
const filter = process.argv.find(a => a.startsWith('--only='))?.slice(7);
for (const [key, entry] of Object.entries(INDEX.projects)) {
  if (filter && key !== filter) continue;
  const manifestPath = path.join(ROOT, 'assets/studio-motion', entry.manifest), manifestBytes = fs.readFileSync(manifestPath);
  assert.equal(sha(manifestBytes), entry.sha256);
  const manifest = JSON.parse(manifestBytes), directory = path.dirname(manifestPath);
  const geometryBuffer = buffer(path.join(directory, manifest.buffers.geometry.url), manifest.buffers.geometry);
  const motion = buffer(path.join(directory, manifest.buffers.initialMotion.url), manifest.buffers.initialMotion);
  const materials = sourceMaterials(manifest, motion);
  const generated = geometry(manifest, geometryBuffer, motion, materials);
  const parts = mergeParts(generated.parts, materials);
  const source = { manifest: `assets/studio-motion/${entry.manifest}`, manifestSha256: entry.sha256, geometrySha256: manifest.buffers.geometry.sha256, initialMotionSha256: manifest.buffers.initialMotion.sha256 };
  const output = makeGLB(key, parts, materials, source);
  const compressed = gzipSync(output.bytes, { level: 9 }), hash = sha(compressed), filename = `${key}.${hash.slice(0, 16)}.glb.gz`, destination = path.join(OUTPUT, filename);
  if (fs.existsSync(destination)) assert.equal(sha(fs.readFileSync(destination)), hash); else fs.writeFileSync(destination, compressed, { flag: 'wx' });
  assert(gunzipSync(fs.readFileSync(destination)).equals(output.bytes), 'Disk transport round trip');
  const rawPath = path.join(EVIDENCE, `${key}.glb`);
  fs.writeFileSync(rawPath, output.bytes);
  const check = readGLB(rawPath), bb = bounds(check);
  assert(Math.abs(bb.min[1]) < 1e-6 && Math.abs(bb.min[0] + bb.max[0]) < 1e-6 && Math.abs(bb.min[2] + bb.max[2]) < 1e-6, 'Floor centered Y-up export');
  let triangles = 0;
  for (const mesh of check.json.meshes) for (const primitive of mesh.primitives) {
    const vertex = accessor(check, primitive.attributes.POSITION);
    const indices = accessor(check, primitive.indices).values;
    assert(indices.every(index => index < vertex.a.count));
    triangles += indices.length / 3;
    for (const id of Object.values(primitive.attributes)) accessor(check, id);
  }
  assert.equal(triangles, generated.report.reduce((sum, item) => sum + item.triangles, 0));
  const frontYaw = -Math.atan2(manifest.camera.position[0] - manifest.camera.target[0], -(manifest.camera.position[1] - manifest.camera.target[1]));
  const project = { url: `models/room-current/${filename}`, sha256: hash, bytes: compressed.length, glbBytes: output.bytes.length, glbSha256: sha(output.bytes), compression: 'gzip', triangles, sourceVisibleTriangles: generated.report.reduce((sum, item) => sum + item.sourceTriangles, 0), meshes: parts.length, materialNames: materials.map(m => m.name), bounds: bb, frontYaw, sourceTranslationAfterYUp: output.shift, source, hidden: generated.hidden, sourceCamera: manifest.camera, primitives: generated.report };
  summary.projects[key] = project;
  console.log(JSON.stringify({ key, bytes: project.bytes, glbBytes: project.glbBytes, triangles, sourceTriangles: project.sourceVisibleTriangles, meshes: parts.length }));
}
const filename = filter ? `report-${filter}.json` : 'report.json';
fs.writeFileSync(path.join(HERE, filename), JSON.stringify(summary, null, 2) + '\n');
if (!filter) {
  const manifest = { schema: summary.schema, sourceRelease: summary.sourceRelease, sourceIndexSha256: summary.sourceIndexSha256, sample: 0, projects: Object.fromEntries(Object.entries(summary.projects).map(([key, project]) => [key, { url: project.url, sha256: project.sha256, bytes: project.bytes, glbBytes: project.glbBytes, compression: 'gzip', triangles: project.triangles, bounds: project.bounds, frontYaw: project.frontYaw, source: project.source }])) };
  fs.writeFileSync(path.join(OUTPUT, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
  const catalog = Object.fromEntries(Object.entries(manifest.projects).map(([key, project]) => [key, { url: project.url, bytes: project.bytes, triangles: project.triangles, bounds: project.bounds, frontYaw: project.frontYaw }]));
  const helperPath = path.join(ROOT, 'experience-exhibits.js');
  const helper = fs.readFileSync(helperPath, 'utf8');
  fs.writeFileSync(helperPath, helper.replace(/\/\/ GENERATED CATALOG START[\s\S]*?\/\/ GENERATED CATALOG END/, `// GENERATED CATALOG START\nexport const ROOM_EXHIBITS = Object.freeze(${JSON.stringify(catalog, null, 2)});\n// GENERATED CATALOG END`));
  console.log(JSON.stringify({ totalBytes: Object.values(summary.projects).reduce((sum, project) => sum + project.bytes, 0), totalGlbBytes: Object.values(summary.projects).reduce((sum, project) => sum + project.glbBytes, 0), totalTriangles: Object.values(summary.projects).reduce((sum, project) => sum + project.triangles, 0) }));
}
