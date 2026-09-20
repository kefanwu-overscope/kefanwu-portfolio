#!/usr/bin/env node
'use strict';

// Reproducible display packaging. The committed original exports remain the
// source of truth: this does not retessellate or simplify any source triangle.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '../..');
const ASSETS = path.join(ROOT, 'assets/studio-motion');
const EVIDENCE = path.resolve(ROOT, '../.codex/performance-optimization-20260919');
const SOURCE = '329b8c9e8f5bffe772130a1794fde44fe04f0fe1';
const TYPES = { float32: Float32Array, uint32: Uint32Array, uint16: Uint16Array, uint8: Uint8Array };
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const copy = (value) => JSON.parse(JSON.stringify(value));
const bytes = (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const saveJSON = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

function original(relative) {
  return cp.execFileSync('git', ['cat-file', 'blob', `${SOURCE}:${relative}`], { cwd: ROOT, maxBuffer: 100 * 1024 * 1024 });
}

function view(buffer, descriptor) {
  const Type = TYPES[descriptor.componentType || 'float32'];
  assert(Type, 'known component type');
  const size = descriptor.count * (descriptor.itemSize || 1);
  // Node Buffers may start at an unaligned slab offset; copies below are
  // intentional and are restricted to this offline exporter.
  const raw = buffer.subarray(descriptor.byteOffset, descriptor.byteOffset + size * Type.BYTES_PER_ELEMENT);
  assert.equal(raw.length, size * Type.BYTES_PER_ELEMENT);
  let array;
  if (descriptor.byteOrder === 'planar') {
    const interleaved = new Uint8Array(raw.length);
    for (let i = 0; i < size; i++) for (let plane = 0; plane < Type.BYTES_PER_ELEMENT; plane++) interleaved[i * Type.BYTES_PER_ELEMENT + plane] = raw[plane * size + i];
    array = new Type(interleaved.buffer);
  } else array = new Type(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  if (descriptor.predictor === 'delta-component') {
    const itemSize = descriptor.itemSize || 1;
    for (let i = itemSize; i < array.length; i++) array[i] += array[i - itemSize];
  }
  if (!descriptor.decode) return array;
  const out = new Float32Array(array.length);
  const itemSize = descriptor.itemSize || 1;
  for (let i = 0; i < out.length; i++) out[i] = descriptor.decode.offset[i % itemSize] + array[i] * descriptor.decode.scale[i % itemSize];
  return out;
}

class PackedBuffer {
  constructor() { this.chunks = []; this.length = 0; this.cache = new Map(); }
  add(array, itemSize = 1, decode = null) {
    const componentType = Object.keys(TYPES).find((key) => array instanceof TYPES[key]);
    assert(componentType);
    let raw = bytes(array);
    const identity = `${componentType}:${itemSize}:${JSON.stringify(decode)}:${hash(raw)}`;
    if (this.cache.has(identity)) return copy(this.cache.get(identity));
    const pad = (4 - this.length % 4) % 4;
    if (pad) { this.chunks.push(Buffer.alloc(pad)); this.length += pad; }
    const descriptor = { byteOffset: this.length, count: array.length / itemSize, itemSize, componentType };
    if (decode) descriptor.decode = decode;
    // Integer deltas and byte-plane shuffling are reversible preprocessing
    // for gzip. Choose per-array, so uncorrelated data does not grow.
    if (componentType !== 'float32' && raw.length >= 256) {
      const delta = new array.constructor(array.length);
      for (let i = 0; i < array.length; i++) delta[i] = array[i] - (i >= itemSize ? array[i - itemSize] : 0);
      const candidates = [
        { raw },
        { raw: bytes(delta), predictor: 'delta-component' },
      ];
      if (array.BYTES_PER_ELEMENT > 1) for (const item of candidates.slice()) {
        const planar = Buffer.alloc(raw.length);
        for (let i = 0; i < array.length; i++) for (let plane = 0; plane < array.BYTES_PER_ELEMENT; plane++) planar[plane * array.length + i] = item.raw[i * array.BYTES_PER_ELEMENT + plane];
        candidates.push({ ...item, raw: planar, byteOrder: 'planar' });
      }
      let best = candidates[0], bestSize = Infinity;
      for (const candidate of candidates) {
        const size = zlib.gzipSync(candidate.raw, { level: 6 }).length;
        if (size < bestSize) { best = candidate; bestSize = size; }
      }
      raw = best.raw;
      if (best.predictor) descriptor.predictor = best.predictor;
      if (best.byteOrder) descriptor.byteOrder = best.byteOrder;
    }
    this.chunks.push(Buffer.from(raw)); this.length += raw.length;
    this.cache.set(identity, copy(descriptor));
    return descriptor;
  }
  finish(directory, name) {
    const raw = Buffer.concat(this.chunks);
    const compressed = zlib.gzipSync(raw, { level: 9, mtime: 0 });
    const sha256 = hash(compressed);
    const filename = `${name}.${sha256.slice(0, 16)}.bin.gz`;
    fs.writeFileSync(path.join(directory, filename), compressed);
    return { info: { url: filename, compression: 'gzip', byteLength: raw.length, compressedBytes: compressed.length, sha256 }, raw };
  }
}

function smallestInteger(array) {
  let max = 0;
  for (const value of array) { assert(Number.isInteger(value) && value >= 0); max = Math.max(max, value); }
  const Type = max <= 255 ? Uint8Array : max <= 65535 ? Uint16Array : Uint32Array;
  return Type.from(array);
}

function quantize(array, itemSize) {
  const min = Array(itemSize).fill(Infinity), max = Array(itemSize).fill(-Infinity);
  for (let i = 0; i < array.length; i++) {
    assert(Number.isFinite(array[i]), 'finite source attribute');
    const c = i % itemSize;
    min[c] = Math.min(min[c], array[i]); max[c] = Math.max(max[c], array[i]);
  }
  if (!array.length) return { array, decode: null, error: 0 };
  const scale = max.map((v, i) => (v - min[i]) / 65535);
  const out = new Uint16Array(array.length);
  let error = 0;
  for (let i = 0; i < array.length; i++) {
    const c = i % itemSize;
    out[i] = scale[c] ? Math.round((array[i] - min[c]) / scale[c]) : 0;
    const decoded = Math.fround(min[c] + out[i] * scale[c]);
    error = Math.max(error, Math.abs(decoded - array[i]));
    // Float32 materialization adds at most one float ulp to the half-step.
    assert(Math.abs(decoded - array[i]) <= scale[c] * 0.500001 + Math.abs(array[i]) * 1.2e-7 + 1e-12);
  }
  return { array: out, decode: { offset: min, scale }, error };
}

function selectElements(array, itemSize, chosen) {
  const out = new array.constructor(chosen.length * itemSize);
  for (let i = 0; i < chosen.length; i++) for (let c = 0; c < itemSize; c++) out[i * itemSize + c] = array[chosen[i] * itemSize + c];
  return out;
}

function bitColumns(array) {
  return array instanceof Float32Array ? new Uint32Array(array.buffer, array.byteOffset, array.length) : array;
}

function reindex(attributes, sourceTracks, motionBuffer) {
  const count = attributes.position.array.length / 3;
  const columns = Object.values(attributes).map(({ array, itemSize }) => ({ array: bitColumns(array), itemSize }));
  for (const [name, track] of Object.entries(sourceTracks || {})) {
    if (!name.startsWith('deformation') && !name.startsWith('attribute')) continue;
    // Equality of a compact trajectory index proves equality at every stored
    // sample, not just equality in the first pose. Unmapped dynamic vertices
    // conservatively retain their identities.
    const array = track.elementMap ? view(motionBuffer, track.elementMap) : Uint32Array.from({ length: count }, (_, i) => i);
    assert.equal(array.length, count);
    columns.push({ array, itemSize: 1 });
  }
  const seen = new Map(), chosen = [], remap = new Uint32Array(count);
  for (let vertex = 0; vertex < count; vertex++) {
    let identity = '';
    for (const { array, itemSize } of columns) for (let c = 0; c < itemSize; c++) identity += array[vertex * itemSize + c].toString(36) + ',';
    let index = seen.get(identity);
    if (index === undefined) { index = chosen.length; chosen.push(vertex); seen.set(identity, index); }
    remap[vertex] = index;
  }
  return { chosen, remap, originalCount: count };
}

function optimizeProject(key) {
  const relative = `assets/studio-motion/${key}`;
  const sourceManifestBytes = original(`${relative}/manifest.json`);
  // Older open pages request this stable URL when switching projects. Their
  // decoder understands only the canonical float32 package, so leave its
  // manifest and stable binary URLs pinned to the original release.
  assert.deepEqual(fs.readFileSync(path.join(ASSETS, key, 'manifest.json')), sourceManifestBytes, 'legacy manifest must remain byte-identical to source');
  const source = JSON.parse(sourceManifestBytes);
  const input = Object.fromEntries(Object.entries(source.buffers).map(([name, info]) => [name, zlib.gunzipSync(original(`${relative}/${info.url}`))]));
  const manifest = copy(source);
  const geometry = new PackedBuffer(), motion = new PackedBuffer(), initial = new PackedBuffer();
  const reindexCache = new Map();
  const trackCache = new Map();
  const metrics = {
    project: key, sourceManifestSha256: hash(sourceManifestBytes), nodes: source.nodes.length, samples: source.sampleCount,
    sourceCompressedBytes: Object.values(source.buffers).reduce((n, b) => n + b.compressedBytes, 0),
    sourceDecodedBytes: Object.values(source.buffers).reduce((n, b) => n + b.byteLength, 0),
    sourceVertices: 0, optimizedVertices: 0, triangles: 0, droppedSourceCoordinateVertices: 0,
    errors: {}, sourceTrianglesPreserved: true, materialDefinitionsPreserved: true,
    sampleValuesChecked: 0, initialSampleValuesChecked: 0,
  };
  const nodeMappings = [];

  function addTrack(track, name, chosen, carbon) {
    const identity = `${JSON.stringify(track)}:${chosen ? hash(bytes(Uint32Array.from(chosen))) : ''}:${carbon}:${name}`;
    if (trackCache.has(identity)) return copy(trackCache.get(identity));
    let array = view(input.motion, track);
    const itemSize = track.itemSize || 1;
    let stride = track.valuesPerFrame;
    let mapping = track.elementMap ? view(input.motion, track.elementMap) : null;
    if (chosen && mapping) mapping = selectElements(mapping, 1, chosen);
    if (chosen && !mapping && stride !== itemSize) {
      const rows = array.length / stride;
      const selected = new Float32Array(rows * chosen.length * itemSize);
      for (let row = 0; row < rows; row++) selected.set(selectElements(array.subarray(row * stride, (row + 1) * stride), itemSize, chosen), row * chosen.length * itemSize);
      array = selected; stride = chosen.length * itemSize;
    }
    const compactFrames = track.frameMap ? view(input.motion, track.frameMap) : Uint32Array.from({ length: source.sampleCount }, (_, i) => i);
    const quantized = (name === 'deformationNormal' || (name === 'deformationPosition' && !carbon)) ? quantize(array, itemSize) : { array, decode: null, error: 0 };
    const result = motion.add(quantized.array, itemSize, quantized.decode);
    result.valuesPerFrame = stride;
    if (mapping) result.elementMap = motion.add(smallestInteger(mapping));
    result.frameMap = motion.add(smallestInteger(compactFrames));
    const first = quantized.array.subarray(compactFrames[0] * stride, (compactFrames[0] + 1) * stride);
    const initialTrack = initial.add(first, itemSize, quantized.decode);
    initialTrack.valuesPerFrame = stride;
    if (mapping) initialTrack.elementMap = initial.add(smallestInteger(mapping));
    metrics.errors[`motion.${name}`] = Math.max(metrics.errors[`motion.${name}`] || 0, quantized.error);
    const pair = { full: result, initial: initialTrack };
    trackCache.set(identity, copy(pair));
    return pair;
  }

  for (let index = 0; index < source.nodes.length; index++) {
    const node = source.nodes[index], target = manifest.nodes[index];
    const materials = (node.materialIndices || [0]).map((i) => source.materials[i]);
    const useCoordinates = materials.some((m) => ['carbon', 'noise'].includes(m.procedural?.type));
    const carbon = materials.some((m) => m.procedural?.type === 'carbon');
    const identity = JSON.stringify([node.geometry, node.tracks, useCoordinates, carbon]);
    let packed = reindexCache.get(identity);
    if (!packed) {
      const attributes = {};
      for (const [name, descriptor] of Object.entries(node.geometry)) {
        if (name === 'groups' || name === 'index' || (name === 'sourceCoordinates' && !useCoordinates)) continue;
        attributes[name] = { array: view(input.geometry, descriptor), itemSize: descriptor.itemSize || 1 };
      }
      const mapping = reindex(attributes, node.tracks, input.motion);
      const targetGeometry = { groups: copy(node.geometry.groups || []) };
      for (const [name, { array, itemSize }] of Object.entries(attributes)) {
        const selected = selectElements(array, itemSize, mapping.chosen);
        const quantized = (name === 'normal' || (name === 'position' && !carbon)) ? quantize(selected, itemSize) : { array: selected, decode: null, error: 0 };
        targetGeometry[name] = geometry.add(quantized.array, itemSize, quantized.decode);
        metrics.errors[`geometry.${name}`] = Math.max(metrics.errors[`geometry.${name}`] || 0, quantized.error);
      }
      const sourceIndices = view(input.geometry, node.geometry.index);
      targetGeometry.index = geometry.add(smallestInteger(Uint32Array.from(sourceIndices, (v) => mapping.remap[v])));
      packed = { geometry: targetGeometry, mapping };
      reindexCache.set(identity, packed);
    }
    target.geometry = copy(packed.geometry);
    target.tracks = {}; target.initialTracks = {};
    for (const [name, track] of Object.entries(node.tracks || {})) {
      const dynamic = name.startsWith('deformation') || name.startsWith('attribute');
      const pair = addTrack(track, name, dynamic ? packed.mapping.chosen : null, carbon);
      target.tracks[name] = pair.full; target.initialTracks[name] = pair.initial;
    }
    metrics.sourceVertices += packed.mapping.originalCount;
    metrics.optimizedVertices += packed.mapping.chosen.length;
    metrics.triangles += node.geometry.index.count / 3;
    if (!useCoordinates && node.geometry.sourceCoordinates) metrics.droppedSourceCoordinateVertices += packed.mapping.originalCount;
    nodeMappings.push(packed.mapping);
  }
  for (let i = 0; i < source.materials.length; i++) {
    const target = manifest.materials[i]; target.tracks = {}; target.initialTracks = {};
    for (const [name, track] of Object.entries(source.materials[i].tracks || {})) {
      const pair = addTrack(track, name, null, false);
      target.tracks[name] = pair.full; target.initialTracks[name] = pair.initial;
    }
  }

  if (key === 'carbonSeat') {
    const indices = source.nodes.map((node, i) => node.tracks?.deformationPosition ? i : -1).filter((i) => i >= 0);
    assert.equal(indices.length, 10);
    const geometryKey = JSON.stringify(manifest.nodes[indices[0]].geometry);
    for (const i of indices) {
      assert.equal(JSON.stringify(manifest.nodes[i].geometry), geometryKey, 'shared cloth geometry descriptors');
      for (const name of ['deformationPosition', 'deformationNormal', 'attributeOpacity', 'attributeRoughness', 'visible']) assert(manifest.nodes[i].tracks[name]);
    }
    for (let frame = 0; frame < source.sampleCount; frame++) {
      let visible = 0;
      for (const i of indices) {
        const track = source.nodes[i].tracks.visible;
        const values = view(input.motion, track), map = view(input.motion, track.frameMap);
        if (values[map[frame]] >= 0.5) visible++;
      }
      assert(visible <= 1, 'exclusive cloth visibility at every source sample');
    }
    for (const i of indices) manifest.nodes[i].exclusiveDeformationGroup = 'carbon-cloth';
    metrics.exclusiveDeformationGroup = { name: 'carbon-cloth', nodes: indices.length, maximumVisible: 1, checkedSamples: source.sampleCount };
  }

  const directory = path.join(ASSETS, key);
  const output = {
    geometry: geometry.finish(directory, 'geometry'), motion: motion.finish(directory, 'motion'),
    initialMotion: initial.finish(directory, 'initial-motion'),
  };
  manifest.buffers = Object.fromEntries(Object.entries(output).map(([name, value]) => [name, value.info]));
  manifest.encoding = {
    version: 2, sourceCommit: SOURCE, sourceManifestSha256: hash(sourceManifestBytes),
    topology: 'all-source-triangles', reindexing: 'exact-live-attributes-and-complete-trajectory-identity',
    quantization: 'uint16-per-component-affine', carbonSurfacePositions: 'source-float32',
    integerStorage: 'adaptive-raw-or-component-delta-and-little-endian-byte-planes',
    initialPose: 'byte-identical-decoded-full-sample-zero',
  };

  // Verify emitted bytes, not intermediate encoder arrays. Expand the old and
  // new index streams and every stored motion sample to prove correspondence.
  const sampledTrackCache = new WeakMap();
  function sample(buffer, descriptor, sampleIndex) {
    let cache = sampledTrackCache.get(buffer);
    if (!cache) { cache = new Map(); sampledTrackCache.set(buffer, cache); }
    const key = JSON.stringify(descriptor);
    let track = cache.get(key);
    if (!track) {
      track = { values: view(buffer, descriptor), frames: descriptor.frameMap ? view(buffer, descriptor.frameMap) : null, mapping: descriptor.elementMap ? view(buffer, descriptor.elementMap) : null };
      cache.set(key, track);
    }
    const { values, frames, mapping } = track;
    const frame = frames ? frames[sampleIndex] : sampleIndex;
    const row = values.subarray(frame * descriptor.valuesPerFrame, (frame + 1) * descriptor.valuesPerFrame);
    return mapping ? selectElements(row, descriptor.itemSize, mapping) : row;
  }
  function errorBetween(a, b, mapping = null, itemSize = 1) {
    assert.equal(b.length, mapping ? mapping.length * itemSize : a.length);
    let error = 0;
    for (let i = 0; i < b.length; i++) {
      const old = mapping ? a[mapping[Math.floor(i / itemSize)] * itemSize + i % itemSize] : a[i];
      assert(Number.isFinite(b[i])); error = Math.max(error, Math.abs(old - b[i]));
    }
    return error;
  }
  for (let i = 0; i < source.nodes.length; i++) {
    const before = source.nodes[i], after = manifest.nodes[i], { chosen, remap } = nodeMappings[i];
    assert.deepEqual(after.materialIndices, before.materialIndices);
    assert.deepEqual(after.geometry.groups, before.geometry.groups);
    assert.deepEqual(after.transform, before.transform);
    assert.equal(after.visible, before.visible);
    const oldIndices = view(input.geometry, before.geometry.index), newIndices = view(output.geometry.raw, after.geometry.index);
    assert.equal(newIndices.length, oldIndices.length);
    for (let c = 0; c < oldIndices.length; c++) assert.equal(newIndices[c], remap[oldIndices[c]]);
    for (const [name, descriptor] of Object.entries(after.geometry)) {
      if (name === 'index' || name === 'groups') continue;
      const old = view(input.geometry, before.geometry[name]), next = view(output.geometry.raw, descriptor);
      const error = errorBetween(old, next, chosen, descriptor.itemSize);
      assert(error <= (metrics.errors[`geometry.${name}`] || 0) + 1e-12);
    }
    for (const [name, descriptor] of Object.entries(after.tracks)) {
      const dynamic = name.startsWith('deformation') || name.startsWith('attribute');
      for (let frame = 0; frame < source.sampleCount; frame++) {
        const old = sample(input.motion, before.tracks[name], frame), next = sample(output.motion.raw, descriptor, frame);
        const error = errorBetween(old, next, dynamic ? chosen : null, descriptor.itemSize);
        assert(error <= (metrics.errors[`motion.${name}`] || 0) + 1e-12);
        metrics.sampleValuesChecked += next.length;
      }
      const first = sample(input.motion, before.tracks[name], 0), next = sample(output.initialMotion.raw, after.initialTracks[name], 0);
      assert(errorBetween(first, next, dynamic ? chosen : null, descriptor.itemSize) <= (metrics.errors[`motion.${name}`] || 0) + 1e-12);
      assert.deepEqual(bytes(sample(output.motion.raw, descriptor, 0)), bytes(next), 'initial and full pose zero match bit-for-bit');
      metrics.initialSampleValuesChecked += next.length;
    }
  }
  for (let i = 0; i < source.materials.length; i++) {
    const before = copy(source.materials[i]), after = copy(manifest.materials[i]);
    delete before.tracks; delete after.tracks; delete after.initialTracks;
    assert.deepEqual(after, before);
    for (const [name, descriptor] of Object.entries(manifest.materials[i].tracks)) {
      for (let frame = 0; frame < source.sampleCount; frame++) {
        const previous = sample(input.motion, source.materials[i].tracks[name], frame);
        const next = sample(output.motion.raw, descriptor, frame);
        assert.equal(errorBetween(previous, next), 0); metrics.sampleValuesChecked += next.length;
      }
      assert.equal(errorBetween(sample(input.motion, source.materials[i].tracks[name], 0), sample(output.initialMotion.raw, manifest.materials[i].initialTracks[name], 0)), 0);
      assert.deepEqual(bytes(sample(output.motion.raw, descriptor, 0)), bytes(sample(output.initialMotion.raw, manifest.materials[i].initialTracks[name], 0)), 'initial and full material sample zero match bit-for-bit');
    }
  }
  for (const [name, result] of Object.entries(output)) {
    const compressed = fs.readFileSync(path.join(directory, result.info.url));
    assert.equal(hash(compressed), result.info.sha256);
    assert.deepEqual(zlib.gunzipSync(compressed), result.raw);
    metrics[`${name}CompressedBytes`] = result.info.compressedBytes;
    metrics[`${name}DecodedBytes`] = result.info.byteLength;
  }
  const manifestBytes = Buffer.from(JSON.stringify(manifest) + '\n');
  const manifestSha256 = hash(manifestBytes);
  const filename = `manifest.${manifestSha256.slice(0, 16)}.json`;
  fs.writeFileSync(path.join(directory, filename), manifestBytes);
  metrics.manifestSha256 = manifestSha256;
  metrics.manifestBytes = manifestBytes.length;
  metrics.compressedBytes = Object.values(manifest.buffers).reduce((n, b) => n + b.compressedBytes, 0);
  metrics.firstPoseCompressedBytes = manifest.buffers.geometry.compressedBytes + manifest.buffers.initialMotion.compressedBytes;
  metrics.decodedBytes = Object.values(manifest.buffers).reduce((n, b) => n + b.byteLength, 0);
  metrics.reductionPercent = (1 - metrics.compressedBytes / metrics.sourceCompressedBytes) * 100;
  metrics.firstPoseReductionPercent = (1 - metrics.firstPoseCompressedBytes / metrics.sourceCompressedBytes) * 100;
  metrics.status = 'passed';
  console.log(`${key}: ${metrics.sourceCompressedBytes} -> ${metrics.compressedBytes} bytes (${metrics.reductionPercent.toFixed(1)}% smaller); first pose ${metrics.firstPoseCompressedBytes}; vertices ${metrics.sourceVertices} -> ${metrics.optimizedVertices}`);
  return { metrics, index: { manifest: `${key}/${filename}`, sha256: manifestSha256 } };
}

function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  const sourceIndex = JSON.parse(original('assets/studio-motion/index.json'));
  const requested = process.argv.slice(2).filter((x) => !x.startsWith('--'));
  const keys = requested.length ? requested : Object.keys(sourceIndex.projects);
  for (const key of keys) assert(Object.hasOwn(sourceIndex.projects, key), `known project ${key}`);
  const rows = [];
  const index = { schema: 'studio-motion-index-v1', release: 'studio-packed-20260919', projects: {} };
  for (const key of keys) {
    const result = optimizeProject(key);
    rows.push(result.metrics); index.projects[key] = result.index;
    saveJSON(path.join(EVIDENCE, `package-${key}.json`), result.metrics);
  }
  if (!requested.length) saveJSON(path.join(ASSETS, 'index.json'), index);
  const summary = {
    status: 'passed', sourceCommit: SOURCE, codec: 'uint16-per-component-affine',
    methodology: 'All source triangles, exact material definitions and exact rigid/material tracks; exact complete-trajectory vertex reindexing; bounded 16-bit positions/normals. Carbon positions and shader coordinates remain Float32; initial tracks decode identically to full sample zero. No decimation, no removed motion samples.',
    visualLimit: 'Numerical correspondence bounds silhouette displacement; browser image comparison remains a separate acceptance check.',
    projects: rows,
    sourceCompressedBytes: rows.reduce((n, r) => n + r.sourceCompressedBytes, 0),
    compressedBytes: rows.reduce((n, r) => n + r.compressedBytes, 0),
    sourceDecodedBytes: rows.reduce((n, r) => n + r.sourceDecodedBytes, 0),
    decodedBytes: rows.reduce((n, r) => n + r.decodedBytes, 0),
    sampleValuesChecked: rows.reduce((n, r) => n + r.sampleValuesChecked, 0),
  };
  saveJSON(path.join(EVIDENCE, requested.length ? 'packages-partial.json' : 'packages-summary.json'), summary);
}

if (require.main === module) main();
module.exports = { view, quantize, reindex, smallestInteger };
