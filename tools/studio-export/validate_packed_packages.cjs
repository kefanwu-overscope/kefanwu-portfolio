#!/usr/bin/env node
'use strict';

// Independent on-disk/source comparison. Do not import the encoder's decoder:
// this implementation reads explicit little-endian components with DataView.
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
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const readJSON = (file) => JSON.parse(fs.readFileSync(file));
const clone = (value) => JSON.parse(JSON.stringify(value));
const raw = (array) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const original = (file) => cp.execFileSync('git', ['cat-file', 'blob', `${SOURCE}:${file}`], { cwd: ROOT, maxBuffer: 100 * 1024 * 1024 });
const decoders = new WeakMap();

function decode(buffer, descriptor) {
  let cache = decoders.get(buffer);
  if (!cache) decoders.set(buffer, cache = new Map());
  const key = JSON.stringify(descriptor);
  if (cache.has(key)) return cache.get(key);
  const types = { float32: [Float32Array, 'getFloat32'], uint32: [Uint32Array, 'getUint32'], uint16: [Uint16Array, 'getUint16'], uint8: [Uint8Array, 'getUint8'] };
  const [Type, getter] = types[descriptor.componentType || 'float32'];
  const length = descriptor.count * descriptor.itemSize, width = Type.BYTES_PER_ELEMENT;
  assert.equal(descriptor.byteOffset % 4, 0);
  assert(descriptor.byteOffset >= 0 && descriptor.byteOffset + length * width <= buffer.length);
  let data = buffer.subarray(descriptor.byteOffset, descriptor.byteOffset + length * width);
  if (descriptor.byteOrder) {
    assert.equal(descriptor.byteOrder, 'planar');
    const interleaved = Buffer.alloc(data.length);
    for (let i = 0; i < length; i++) for (let byte = 0; byte < width; byte++) interleaved[i * width + byte] = data[byte * length + i];
    data = interleaved;
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let array = new Type(length);
  for (let i = 0; i < length; i++) array[i] = view[getter](i * width, true);
  if (descriptor.predictor) {
    assert.notEqual(Type, Float32Array);
    assert.equal(descriptor.predictor, 'delta-component');
    const modulus = 2 ** (width * 8);
    for (let i = descriptor.itemSize; i < length; i++) array[i] = (array[i] + array[i - descriptor.itemSize]) % modulus;
  }
  if (descriptor.decode) {
    const quantized = array;
    array = new Float32Array(length);
    for (let i = 0; i < length; i++) array[i] = descriptor.decode.offset[i % descriptor.itemSize] + quantized[i] * descriptor.decode.scale[i % descriptor.itemSize];
  }
  cache.set(key, array);
  return array;
}

function trackSample(buffer, descriptor, frame) {
  const values = decode(buffer, descriptor);
  const row = descriptor.frameMap ? decode(buffer, descriptor.frameMap)[frame] : frame;
  const offset = row * descriptor.valuesPerFrame;
  assert(offset + descriptor.valuesPerFrame <= values.length);
  return { values, offset, elements: descriptor.elementMap ? decode(buffer, descriptor.elementMap) : null };
}

function checkValue(before, after, descriptor, component, errors, name) {
  assert(Number.isFinite(before) && Number.isFinite(after), name);
  if (!descriptor.decode) assert(Object.is(before, after), `${name}: exact source value`);
  const difference = Math.abs(after - before);
  const bound = descriptor.decode ? descriptor.decode.scale[component] * 0.500001 + Math.abs(before) * 1.2e-7 + 1e-12 : 0;
  assert(difference <= bound, `${name}: error ${difference} exceeds ${bound}`);
  errors[name] = Math.max(errors[name] || 0, difference);
}

const index = readJSON(path.join(ASSETS, 'index.json'));
const sourceIndex = JSON.parse(original('assets/studio-motion/index.json'));
assert.deepEqual(Object.keys(index.projects), Object.keys(sourceIndex.projects));
assert.equal(Object.keys(index.projects).length, 16);
const references = ['assets/studio-motion/index.json'];
const legacyManifestHashes = [];
const rows = [];
for (const [key, entry] of Object.entries(index.projects)) {
  const relative = `assets/studio-motion/${key}`;
  const file = path.join(ASSETS, entry.manifest);
  const manifestBytes = fs.readFileSync(file), after = JSON.parse(manifestBytes);
  assert.equal(sha(manifestBytes), entry.sha256);
  assert.equal(path.basename(file), `manifest.${entry.sha256.slice(0, 16)}.json`);
  references.push(`assets/studio-motion/${entry.manifest}`);
  const sourceManifest = original(`${relative}/manifest.json`), before = JSON.parse(sourceManifest);
  assert.deepEqual(fs.readFileSync(path.join(ROOT, relative, 'manifest.json')), sourceManifest, 'legacy manifest retained exactly for older open pages');
  legacyManifestHashes.push({ file: `${relative}/manifest.json`, sha256: sha(sourceManifest) });
  assert.equal(after.encoding.sourceCommit, SOURCE);
  assert.equal(after.encoding.sourceManifestSha256, sha(sourceManifest));
  const oldBuffers = {}, buffers = {};
  for (const [name, info] of Object.entries(before.buffers)) {
    const old = original(`${relative}/${info.url}`);
    assert.deepEqual(fs.readFileSync(path.join(ROOT, relative, info.url)), old, 'legacy buffer retained exactly');
    oldBuffers[name] = zlib.gunzipSync(old);
  }
  for (const [name, info] of Object.entries(after.buffers)) {
    const bytes = fs.readFileSync(path.join(ROOT, relative, info.url));
    assert.equal(bytes.length, info.compressedBytes);
    assert.equal(sha(bytes), info.sha256);
    assert.equal(info.url, `${name === 'initialMotion' ? 'initial-motion' : name}.${info.sha256.slice(0, 16)}.bin.gz`);
    buffers[name] = zlib.gunzipSync(bytes);
    assert.equal(buffers[name].length, info.byteLength);
    references.push(`${relative}/${info.url}`);
  }
  const topBefore = clone(before), topAfter = clone(after);
  for (const name of ['buffers', 'nodes', 'materials', 'encoding']) { delete topBefore[name]; delete topAfter[name]; }
  assert.deepEqual(topAfter, topBefore, 'source camera, bounds, sampling, and metadata');
  assert.equal(after.nodes.length, before.nodes.length);
  assert.equal(after.materials.length, before.materials.length);
  const row = { project: key, triangles: 0, geometryValuesChecked: 0, motionValuesChecked: 0, initialPoseByteChecks: 0, errors: {} };

  function checkTracks(oldOwner, owner, mapping = null) {
    assert.deepEqual(Object.keys(owner.tracks), Object.keys(oldOwner.tracks || {}));
    assert.deepEqual(Object.keys(owner.initialTracks), Object.keys(owner.tracks));
    for (const [name, descriptor] of Object.entries(owner.tracks)) {
      const oldDescriptor = oldOwner.tracks[name];
      assert.equal(descriptor.itemSize, oldDescriptor.itemSize);
      const size = descriptor.itemSize;
      const dynamic = /^(deformation|attribute)/.test(name);
      const elements = dynamic ? mapping.length : oldDescriptor.valuesPerFrame / size;
      for (let frame = 0; frame < before.sampleCount; frame++) {
        const a = trackSample(oldBuffers.motion, oldDescriptor, frame), b = trackSample(buffers.motion, descriptor, frame);
        for (let element = 0; element < elements; element++) {
          const nextElement = dynamic ? mapping[element] : element;
          const ia = a.offset + (a.elements ? a.elements[element] : element) * size;
          const ib = b.offset + (b.elements ? b.elements[nextElement] : nextElement) * size;
          for (let c = 0; c < size; c++) checkValue(a.values[ia + c], b.values[ib + c], descriptor, c, row.errors, `motion.${name}`);
          row.motionValuesChecked += size;
        }
      }
      const a = trackSample(buffers.motion, descriptor, 0), b = trackSample(buffers.initialMotion, owner.initialTracks[name], 0);
      assert.equal(owner.initialTracks[name].valuesPerFrame, descriptor.valuesPerFrame);
      assert.deepEqual(raw(a.values.subarray(a.offset, a.offset + descriptor.valuesPerFrame)), raw(b.values.subarray(b.offset, b.offset + descriptor.valuesPerFrame)), 'initial/full zero are bit-identical');
      if (a.elements) assert.deepEqual(a.elements, b.elements);
      else assert.equal(b.elements, null);
      row.initialPoseByteChecks += descriptor.valuesPerFrame * a.values.BYTES_PER_ELEMENT;
    }
  }

  for (let i = 0; i < before.nodes.length; i++) {
    const oldNode = before.nodes[i], node = after.nodes[i];
    const oldMetadata = clone(oldNode), metadata = clone(node);
    for (const name of ['geometry', 'tracks', 'initialTracks', 'exclusiveDeformationGroup']) { delete oldMetadata[name]; delete metadata[name]; }
    assert.deepEqual(metadata, oldMetadata);
    assert.deepEqual(node.geometry.groups, oldNode.geometry.groups);
    const oldIndices = decode(oldBuffers.geometry, oldNode.geometry.index), indices = decode(buffers.geometry, node.geometry.index);
    assert.equal(indices.length, oldIndices.length);
    const mapping = new Int32Array(oldNode.geometry.position.count).fill(-1);
    for (let corner = 0; corner < indices.length; corner++) {
      assert(indices[corner] < node.geometry.position.count);
      if (mapping[oldIndices[corner]] < 0) mapping[oldIndices[corner]] = indices[corner];
      else assert.equal(mapping[oldIndices[corner]], indices[corner], 'triangle corner correspondence');
    }
    assert(mapping.every((vertex) => vertex >= 0), 'all original vertices represented by source triangles');
    row.triangles += indices.length / 3;
    for (const [name, descriptor] of Object.entries(oldNode.geometry)) {
      if (name === 'index' || name === 'groups') continue;
      const next = node.geometry[name];
      if (!next) {
        assert.equal(name, 'sourceCoordinates');
        assert(!oldNode.materialIndices.some((material) => ['carbon', 'noise'].includes(before.materials[material].procedural?.type)));
        continue;
      }
      assert.equal(next.itemSize, descriptor.itemSize);
      const a = decode(oldBuffers.geometry, descriptor), b = decode(buffers.geometry, next);
      for (let vertex = 0; vertex < mapping.length; vertex++) for (let c = 0; c < descriptor.itemSize; c++) {
        checkValue(a[vertex * descriptor.itemSize + c], b[mapping[vertex] * descriptor.itemSize + c], next, c, row.errors, `geometry.${name}`);
        row.geometryValuesChecked++;
      }
    }
    checkTracks(oldNode, node, mapping);
  }
  for (let i = 0; i < before.materials.length; i++) {
    const a = clone(before.materials[i]), b = clone(after.materials[i]);
    for (const name of ['tracks', 'initialTracks']) { delete a[name]; delete b[name]; }
    assert.deepEqual(b, a, 'exact material definitions');
    checkTracks(before.materials[i], after.materials[i]);
  }
  if (key === 'carbonSeat') {
    const cloth = after.nodes.filter((node) => node.exclusiveDeformationGroup === 'carbon-cloth');
    assert.equal(cloth.length, 10);
    for (const node of cloth) assert.deepEqual(node.geometry, cloth[0].geometry);
    let maximumVisible = 0;
    for (let frame = 0; frame < after.sampleCount; frame++) {
      const visible = cloth.filter((node) => { const sample = trackSample(buffers.motion, node.tracks.visible, frame); return sample.values[sample.offset] >= 0.5; }).length;
      assert(visible <= 1); maximumVisible = Math.max(maximumVisible, visible);
    }
    assert.equal(row.errors['geometry.position'], 0);
    assert.equal(row.errors['motion.deformationPosition'], 0);
    assert.equal(row.errors['geometry.sourceCoordinates'], 0);
    row.carbon = { sharedClothNodes: cloth.length, maximumVisible, sourcePositionAndCoordinatesBitExact: true, visibilitySamplesChecked: after.sampleCount };
  }
  rows.push(row);
  console.log(`${key}: ${row.triangles} source triangles; ${row.motionValuesChecked} original motion values; initial/full zero bit-identical`);
}
fs.mkdirSync(EVIDENCE, { recursive: true });
const referenced = new Set(references);
const unreferencedGenerated = [];
for (const key of Object.keys(index.projects)) for (const name of fs.readdirSync(path.join(ASSETS, key))) {
  const file = `assets/studio-motion/${key}/${name}`;
  if (/\.[a-f0-9]{16}\.(bin\.gz|json)$/.test(name) && !referenced.has(file)) unreferencedGenerated.push(file);
}
const fileHashes = references.map((file) => ({ file, sha256: sha(fs.readFileSync(path.join(ROOT, file))) }));
const report = { status: 'passed', sourceCommit: SOURCE, projectCount: rows.length, projects: rows, referencedAssetCount: references.length, referencedAssets: fileHashes, unreferencedGeneratedAssets: unreferencedGenerated, legacyManifestsVerified: legacyManifestHashes, legacyBuffersVerified: rows.length * 2 };
fs.writeFileSync(path.join(EVIDENCE, 'packages-independent-validation.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(EVIDENCE, 'package-commit-files.txt'), [...references, 'tools/studio-export/optimize_packages.cjs', 'tools/studio-export/validate_packed_packages.cjs', 'tools/studio-export/README.md'].sort().join('\n') + '\n');
console.log(`PASS: ${rows.length} packages; ${references.length} referenced assets; ${unreferencedGenerated.length} stale generated files left untouched.`);
