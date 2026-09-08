import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeBrowserWorker, transfers, threads } from './node-worker-adapter.mjs';
import { writeReport } from './report.mjs';
import { createHDRService, createHDRTexture } from '../../experience-hdr.js';
import * as THREE from './vendor/three.core.js';

const root = new URL('../../', import.meta.url);
const local = name => new URL(name, root);
const sha = data => createHash('sha256').update(data).digest('hex');
const bytes = value => Buffer.from(value.buffer, value.byteOffset, value.byteLength);
const toArrayBuffer = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const tick = () => new Promise(resolve => setImmediate(resolve));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
execFileSync(process.execPath, [fileURLToPath(local('tools/hdr/build.mjs')), '--check']);

// Only the import specifier changes. The full official loader extends the full
// official DataTextureLoader/DataUtils implementation from three.core.js.
const upstream = await readFile(local('tools/hdr/vendor/HDRLoader.js'), 'utf8');
const baselineSource = upstream.replace("from 'three'", `from '${local('tools/hdr/vendor/three.core.js').href}'`);
assert.notEqual(baselineSource, upstream);
const { HDRLoader } = await import('data:text/javascript;base64,' + Buffer.from(baselineSource).toString('base64'));
const loader = new HDRLoader().setDataType(THREE.HalfFloatType);
globalThis.Worker = NodeBrowserWorker;
const originalFetch = globalThis.fetch;

const report = {
  generatedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpus: os.cpus().length, cpu: os.cpus()[0]?.model, mainThreadId: 0 },
  scope: 'Actual standalone Worker script executed on Node worker_threads through a Web Worker API adapter. No browser, server, GPU, FPS or visual acceptance measurement.',
  baseline: 'Unmodified official three.js r185 HDRLoader.parse + full official three.core.js. Only bare import specifier rewritten for offline Node resolution.',
  cases: [], checks: [],
};

function officialFlip(data, width, height) {
  // Independent row-by-row oracle, not the worker in-place swap implementation.
  const result = new Uint16Array(data.length);
  for (let row = 0; row < height; row++) result.set(data.subarray(row * width * 4, (row + 1) * width * 4), (height - row - 1) * width * 4);
  return result;
}

function check(name, facts = {}) { report.checks.push({ name, pass: true, ...facts }); }
async function rejects(promise, code) {
  await assert.rejects(promise, error => error.code === code, `Expected ${code}`);
}

const service = createHDRService({ workers: 2 });
const files = [
  'models/baked/lightmap-off-2k.hdr', 'models/baked/lightmap-on-2k.hdr',
  'models/baked/probe-off.hdr', 'models/baked/probe-on.hdr',
  'models/baked/lightmap-off-4k.hdr', 'models/baked/lightmap-on-4k.hdr',
  'hdri/wooden_lounge_1k.hdr',
];
for (const file of files) {
  const input = await readFile(local(file));
  let start = performance.now();
  const reference = loader.parse(toArrayBuffer(input));
  const officialParseMs = performance.now() - start;
  for (const flipRows of [false, true]) {
    const source = toArrayBuffer(input);
    const promise = service.parse(source, { flipRows });
    assert.equal(source.byteLength, 0, 'parse takes input ownership immediately without cloning');
    const output = await promise;
    start = performance.now();
    const expected = flipRows ? officialFlip(reference.data, reference.width, reference.height) : reference.data;
    const oracleFlipMs = flipRows ? performance.now() - start : 0;
    assert.equal(Buffer.compare(bytes(expected), bytes(output.data)), 0, `${file}, flipRows=${flipRows}`);
    for (const key of ['width', 'height', 'type', 'header', 'gamma', 'exposure', 'colorSpace', 'minFilter', 'magFilter', 'generateMipmaps', 'flipY']) assert.equal(output[key], reference[key], key);
    assert.equal(output.rowsFlipped, flipRows);
    const texture = createHDRTexture(THREE, output);
    assert.equal(texture.image.data, output.data, 'DataTexture must wrap the same Uint16Array');
    assert.equal(texture.image.width, output.width);
    assert.equal(texture.image.height, output.height);
    for (const key of ['type', 'colorSpace', 'minFilter', 'magFilter', 'generateMipmaps', 'flipY']) assert.equal(texture[key], reference[key], key);
    assert.equal(texture.format, THREE.RGBAFormat);
    assert.equal(texture.channel, 0, 'Caller retains prepLM channel=1 responsibility');
    assert.ok(texture.version > 0);
    texture.dispose();
    report.cases.push({ file, flipRows, width: output.width, height: output.height, inputBytes: input.byteLength, outputBytes: output.data.byteLength, inputSha256: sha(input), outputSha256: sha(bytes(output.data)), officialParseMs, oracleFlipMs, timings: output.timings, byteEqual: true, metadataEqual: true, textureWrapSameArray: true });
    console.log(JSON.stringify({ file, flipRows, workerMs: output.timings.workerMs, equal: true }));
  }
}
report.sequentialStats = service.getStats();
service.dispose();
check('All seven actual HDR assets and both row orientations match official r185 byte-for-byte; main-thread DataTexture wraps transferred storage');

// Actual two-worker overlap, followed by two 4K tasks; avoid retaining outputs.
const pool = createHDRService({ workers: 2 });
const largeInputs = await Promise.all(files.slice(4, 6).map(file => readFile(local(file))));
const smallInput = await readFile(local(files[0]));
const samples = [];
const sampling = setInterval(() => samples.push(pool.getStats()), 2);
await Promise.all([0, 1].map(() => pool.parse(toArrayBuffer(smallInput)).then(() => undefined)));
await Promise.all(largeInputs.map(data => pool.parse(toArrayBuffer(data), { flipRows: true }).then(() => undefined)));
await Promise.all([pool.parse(toArrayBuffer(largeInputs[0])), pool.parse(toArrayBuffer(smallInput))].map(promise => promise.then(() => undefined)));
clearInterval(sampling);
assert.equal(pool.getStats().peakDecoding, 2);
assert.equal(pool.getStats().peakLargeDecoding, 1);
assert.ok(samples.every(sample => sample.largeDecoding === 0 || sample.decoding === 1));
assert.ok(samples.some(sample => sample.largeDecoding === 1));
assert.ok(samples.every(sample => sample.workingBytes <= sample.limits.maxWorkingBytes));
report.concurrencyStats = pool.getStats();
check('Two real workers overlap for 2K; 4K/4K and mixed 4K/2K decoding are exclusive', { samples: samples.length, peakDecoding: 2, peakLargeDecoding: 1, measuredWorkerThreadIds: [...threads] });
pool.dispose();

// Controlled file-backed fetch exercises the exact service.load transport without
// a server. Network behavior/MIME/CSP remains a browser integration responsibility.
const probeBytes = await readFile(local(files[2]));
const probeRef = loader.parse(toArrayBuffer(probeBytes));
globalThis.fetch = async () => new Response(probeBytes, { status: 200, headers: { 'content-length': String(probeBytes.length) } });
const loading = createHDRService({ workers: 1 });
const loaded = await loading.load('models/baked/probe-off.hdr', { flipY: true });
assert.equal(Buffer.compare(bytes(loaded.data), bytes(officialFlip(probeRef.data, probeRef.width, probeRef.height))), 0);
assert.equal(loaded.source, 'models/baked/probe-off.hdr');
assert.equal(loading.getStats().downloadedBytes, probeBytes.length);
check('load streaming fetch path, source URL and flipY alias match the reference');
await rejects(loading.parse(toArrayBuffer(probeBytes), { flipRows: true, flipY: false }), 'HDR_INVALID_OPTIONS');
await rejects(loading.parse(toArrayBuffer(probeBytes), { signal: {} }), 'HDR_INVALID_OPTIONS');
globalThis.fetch = async () => new Response('missing', { status: 404 });
await rejects(loading.load('/missing.hdr'), 'HDR_HTTP_ERROR');
globalThis.fetch = async () => { throw new Error('Injected fetch failure'); };
await rejects(loading.load('/network.hdr'), 'HDR_FETCH_ERROR');
globalThis.fetch = async () => new Response(new Uint8Array(1), { headers: { 'content-length': String(40 * 1024 * 1024) } });
await rejects(loading.load('/oversized.hdr'), 'HDR_INPUT_LIMIT');
loading.dispose();
check('HTTP/network failures, invalid options and declared oversized input reject');

const streaming = createHDRService({ maxInputBytes: 64 });
globalThis.fetch = async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(32)); controller.enqueue(new Uint8Array(48)); controller.close(); } }));
await rejects(streaming.load('/streamed.hdr'), 'HDR_INPUT_LIMIT');
assert.equal(streaming.getStats().retainedInputBytes, 0);
streaming.dispose();
check('Streaming input limit works without Content-Length and releases retained bytes');

const hungFetch = createHDRService({ fetchTimeoutMs: 30 });
let fetchAborted = false;
globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => { fetchAborted = true; reject(new Error('aborted')); }, { once: true }));
await rejects(hungFetch.load('/hung.hdr'), 'HDR_TIMEOUT');
assert.ok(fetchAborted);
hungFetch.dispose();
check('Fetch timeout aborts network and settles the request');
globalThis.fetch = originalFetch;

const failures = createHDRService();
await rejects(failures.parse(new TextEncoder().encode('not HDR').buffer), 'HDR_INVALID_INPUT');
await rejects(failures.parse(toArrayBuffer(probeBytes.subarray(0, probeBytes.length - 30))), 'HDR_DECODE_ERROR');
const headerOnly = new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 99999 +X 99999\n').buffer;
await rejects(failures.parse(headerOnly), 'HDR_INVALID_INPUT');
const recovered = await failures.parse(toArrayBuffer(probeBytes));
assert.equal(Buffer.compare(bytes(recovered.data), bytes(probeRef.data)), 0);
const flat = Buffer.concat([
  Buffer.from('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 3 +X 2\n'),
  Buffer.from([0, 0, 0, 0, 1, 2, 3, 127, 255, 128, 0, 128, 0, 1, 128, 129, 255, 128, 1, 255, 10, 20, 30, 128]),
]);
const flatReference = loader.parse(toArrayBuffer(flat));
for (const flipRows of [false, true]) {
  const flatResult = await failures.parse(toArrayBuffer(flat), { flipRows });
  assert.equal(Buffer.compare(bytes(flatResult.data), bytes(flipRows ? officialFlip(flatReference.data, 2, 3) : flatReference.data)), 0);
}
failures.dispose();
check('Malformed header, truncated payload and oversized dimensions reject; later valid task recovers');
check('Flat RGBE, odd-height row flipping, zero exponent and half-float clamping match official bytes');

const lowMemory = createHDRService({ maxWorkingBytes: 1024 });
await rejects(lowMemory.parse(toArrayBuffer(probeBytes)), 'HDR_MEMORY_LIMIT');
assert.equal(lowMemory.getStats().inFlight, 0);
lowMemory.dispose();
check('Decode-memory budget rejects without a stuck queue');

for (const [mode, code] of [['constructor-error', 'HDR_WORKER_UNAVAILABLE'], ['script-error', 'HDR_WORKER_ERROR'], ['message-error', 'HDR_WORKER_ERROR'], ['wrong-protocol', 'HDR_PROTOCOL_ERROR'], ['silent-start', 'HDR_TIMEOUT'], ['silent-decode', 'HDR_TIMEOUT']]) {
  NodeBrowserWorker.mode = mode;
  const broken = createHDRService({ workers: 1, workerTimeoutMs: 150 });
  await rejects(broken.parse(toArrayBuffer(probeBytes)), code);
  assert.equal(broken.getStats().inFlight, 0);
  assert.equal(broken.getStats().retainedInputBytes, 0);
  assert.equal(broken.getStats().workingBytes, 0);
  broken.dispose();
  check(`${mode} settles with ${code} and releases input/decode reservations`);
}
NodeBrowserWorker.mode = 'normal';
globalThis.Worker = undefined;
const unavailable = createHDRService();
const untouched = toArrayBuffer(probeBytes);
await rejects(unavailable.parse(untouched), 'HDR_WORKER_UNAVAILABLE');
assert.equal(untouched.byteLength, probeBytes.length);
unavailable.dispose();
globalThis.Worker = NodeBrowserWorker;
check('Unavailable Worker rejects immediately without detaching caller input');

NodeBrowserWorker.mode = 'delay-decode';
const bounded = createHDRService({ workers: 1, maxQueued: 1 });
const abort = new AbortController();
const active = bounded.parse(toArrayBuffer(probeBytes), { signal: abort.signal });
const activeRejected = rejects(active, 'HDR_ABORTED');
const pending = bounded.parse(toArrayBuffer(probeBytes));
const pendingRejected = rejects(pending, 'HDR_DISPOSED');
await rejects(bounded.parse(toArrayBuffer(probeBytes)), 'HDR_QUEUE_FULL');
await delay(50);
abort.abort();
await activeRejected;
bounded.dispose();
await pendingRejected;
await rejects(bounded.load('/after-dispose.hdr'), 'HDR_DISPOSED');
assert.equal(bounded.getStats().inFlight, 0);
assert.equal(bounded.getStats().retainedInputBytes, 0);
assert.equal(bounded.getStats().workersAlive, 0);
check('Queue backpressure, abort, dispose and post-dispose calls settle and release resources');
NodeBrowserWorker.mode = 'normal';

NodeBrowserWorker.mode = 'delay-decode';
const queuedTimeout = createHDRService({ workers: 1, maxQueued: 2, timeoutMs: 65 });
const cancellable = new AbortController();
const timedActive = rejects(queuedTimeout.parse(toArrayBuffer(probeBytes)), 'HDR_TIMEOUT');
const timedQueued = rejects(queuedTimeout.parse(toArrayBuffer(probeBytes)), 'HDR_TIMEOUT');
const abortedQueued = rejects(queuedTimeout.parse(toArrayBuffer(probeBytes), { signal: cancellable.signal }), 'HDR_ABORTED');
cancellable.abort();
await Promise.all([timedActive, timedQueued, abortedQueued]);
assert.equal(queuedTimeout.getStats().inFlight, 0);
queuedTimeout.dispose();
NodeBrowserWorker.mode = 'normal';
check('End-to-end deadline also covers queued jobs; queued abort settles immediately');

await tick();
assert.ok(transfers.some(item => item.direction === 'worker-to-main'));
assert.ok(transfers.every(item => item.detachedBytes === 0));
assert.ok(transfers.filter(item => item.direction === 'worker-to-main').every(item => item.isMainThread === false && item.threadId > 0));
report.transfers = {
  count: transfers.length, allSenderBuffersDetached: true,
  mainToWorkerBytes: transfers.filter(item => item.direction === 'main-to-worker').reduce((sum, item) => sum + item.bytes, 0),
  workerToMainBytes: transfers.filter(item => item.direction === 'worker-to-main').reduce((sum, item) => sum + item.bytes, 0),
  events: transfers,
};
check('Both directions use real transfer lists; every sender buffer detaches; decoding runs on non-main threads');
report.artifacts = {};
for (const file of ['experience-hdr.js', 'experience-hdr-worker.js', 'tools/hdr/vendor/provenance.json']) {
  const data = await readFile(local(file));
  report.artifacts[file] = { bytes: data.length, sha256: sha(data) };
}
report.pass = report.cases.every(item => item.byteEqual && item.metadataEqual) && report.checks.every(item => item.pass);
await writeFile(local('tools/hdr/validation.json'), JSON.stringify(report, null, 2) + '\n');
await writeReport();
console.log(JSON.stringify({ pass: report.pass, byteComparisonCases: report.cases.length, checks: report.checks.length, report: 'tools/hdr/validation.json' }));
