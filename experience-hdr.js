/**
 * Bounded, buildless HDR decoding service. No three.js imports or manager counts.
 * load()/parse() resolve to pixel data; createHDRTexture(THREE, result) stays on
 * the main thread. See tools/hdr/README.md for ownership, limits and integration.
 */
const MIB = 1024 * 1024;
const PROTOCOL = 'portfolio-hdr-r185-v1';
const DEFAULT_WORKER_URL = new URL('./experience-hdr-worker.js?v=hdr-r185-v1', import.meta.url);

function hdrError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.name = 'HDRServiceError';
  error.code = code;
  return error;
}

// BEGIN SHARED HEADER GUARD
// This bounded header guard is also embedded in the standalone worker.
function inspectHeader(buffer, maxPixels, maxInputBytes) {
  if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.byteLength > maxInputBytes) throw new Error('HDR input exceeds the byte limit or is empty');
  const text = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16384)));
  const match = /^\s*-Y\s+(\d+)\s+\+X\s+(\d+)[ \t]*\r?\n/m.exec(text);
  if (!/^#\?\S+/.test(text) || !match) throw new Error('Missing RGBE header/dimensions within 16 KiB');
  const prefix = text.slice(0, match.index);
  if (!/^\s*FORMAT=32-bit_rle_rgbe\s*$/m.test(prefix)) throw new Error('Only Radiance RGBE HDR is supported');
  const width = Number(match[2]), height = Number(match[1]);
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || width < 1 || height < 1 || width > 16384 || height > 16384 || pixels > maxPixels) throw new Error('HDR dimensions exceed the configured pixel limit');
  return { width, height, pixels, headerBytes: match.index + match[0].length };
}
// END SHARED HEADER GUARD

/**
 * @param {object} [options]
 * @param {number} [options.workers=2] Clamped to 1..2.
 * @param {URL|string} [options.workerURL] Same-origin standalone worker URL.
 * @returns {{load: Function, parse: Function, getStats: Function, dispose: Function}}
 */
export function createHDRService(options = {}) {
  const integer = (name, fallback) => {
    const value = options[name] ?? fallback;
    if (!Number.isSafeInteger(value) || value < 1) throw new TypeError(`${name} must be a positive integer`);
    return value;
  };
  const workerLimit = Math.min(2, integer('workers', 2));
  const limits = {
    maxQueued: integer('maxQueued', 16),
    maxInputBytes: integer('maxInputBytes', 32 * MIB),
    maxRetainedInputBytes: integer('maxRetainedInputBytes', 64 * MIB),
    maxPixels: Math.min(4096 * 4096, integer('maxPixels', 4096 * 4096)),
    maxWorkingBytes: integer('maxWorkingBytes', 256 * MIB),
    timeoutMs: integer('timeoutMs', 120000),
    fetchTimeoutMs: integer('fetchTimeoutMs', 60000),
    workerTimeoutMs: integer('workerTimeoutMs', 30000),
  };
  const slots = Array.from({ length: workerLimit }, (_, index) => ({ index, worker: null, ready: false, job: null }));
  const queued = [], waiting = [], decoding = new Set(), jobs = new Set();
  let disposed = false, nextId = 0, retainedInputBytes = 0, workingBytes = 0, pumpScheduled = false;
  const totals = {
    submitted: 0, completed: 0, failed: 0, aborted: 0, timedOut: 0,
    workersStarted: 0, workerFailures: 0, peakDecoding: 0, peakLargeDecoding: 0,
    peakWorkingBytes: 0, peakRetainedInputBytes: 0,
    inputTransferBytes: 0, outputTransferBytes: 0, downloadedBytes: 0,
    workerMs: 0, parseMs: 0, flipMs: 0, lastError: null,
  };

  function schedule() {
    if (pumpScheduled || disposed) return;
    pumpScheduled = true;
    queueMicrotask(() => { pumpScheduled = false; pump(); });
  }

  function retire(slot) {
    if (!slot?.worker) return;
    slot.worker.onmessage = slot.worker.onerror = slot.worker.onmessageerror = null;
    slot.worker.terminate();
    slot.worker = null;
    slot.ready = false;
  }

  function releaseInput(job) {
    retainedInputBytes -= job.retainedBytes || 0;
    job.retainedBytes = 0;
    job.buffer = null;
  }

  function finish(job, error, result) {
    if (job.done) return;
    job.done = true;
    clearTimeout(job.timer);
    clearTimeout(job.phaseTimer);
    job.signal?.removeEventListener('abort', job.abortListener);
    job.controller.abort();
    if (decoding.delete(job)) {
      workingBytes -= job.estimatedBytes;
      if (error) retire(job.slot); // Abort/timeout also stops synchronous parsing.
    }
    for (const list of [queued, waiting]) {
      const index = list.indexOf(job);
      if (index >= 0) list.splice(index, 1);
    }
    releaseInput(job);
    if (job.slot) job.slot.job = null;
    jobs.delete(job);
    if (error) {
      totals.failed++;
      if (error.code === 'HDR_ABORTED') totals.aborted++;
      if (error.code === 'HDR_TIMEOUT') totals.timedOut++;
      totals.lastError = { code: error.code, message: error.message, id: job.id };
      job.reject(error);
    } else {
      totals.completed++;
      totals.outputTransferBytes += result.data.byteLength;
      for (const key of ['workerMs', 'parseMs', 'flipMs']) totals[key] += result.timings[key];
      result.timings = {
        ...result.timings, workerIndex: job.slot.index,
        queueMs: job.prepareStart - job.start, fetchMs: job.fetchMs,
        headerMs: job.headerMs, decodeWaitMs: job.decodeStart - job.preparedAt,
        roundTripMs: performance.now() - job.decodeStart,
        totalMs: performance.now() - job.start, estimatedWorkingBytes: job.estimatedBytes,
      };
      result.source = job.url ?? null;
      job.resolve(result);
    }
    schedule();
  }

  function phaseTimeout(job, ms, phase) {
    clearTimeout(job.phaseTimer);
    job.phaseTimer = setTimeout(() => finish(job, hdrError('HDR_TIMEOUT', `HDR ${phase} exceeded ${ms} ms`)), ms);
  }

  function send(slot) {
    const job = slot.job;
    if (!job || job.done || !decoding.has(job) || !slot.ready) return;
    try {
      const bytes = job.buffer.byteLength;
      slot.worker.postMessage({ protocol: PROTOCOL, kind: 'decode', id: job.id, buffer: job.buffer, flipRows: job.flipRows, limits: { maxPixels: limits.maxPixels, maxInputBytes: limits.maxInputBytes } }, [job.buffer]);
      totals.inputTransferBytes += bytes;
      releaseInput(job);
    } catch (cause) {
      finish(job, hdrError('HDR_TRANSFER_ERROR', 'Could not transfer HDR input to worker', cause));
    }
  }

  function startDecode(job) {
    job.decodeStart = performance.now();
    decoding.add(job);
    workingBytes += job.estimatedBytes;
    totals.peakWorkingBytes = Math.max(totals.peakWorkingBytes, workingBytes);
    totals.peakDecoding = Math.max(totals.peakDecoding, decoding.size);
    totals.peakLargeDecoding = Math.max(totals.peakLargeDecoding, [...decoding].filter(item => item.large).length);
    phaseTimeout(job, limits.workerTimeoutMs, 'worker startup/decode');
    const slot = job.slot;
    if (!slot.worker) {
      try {
        // Classic worker, local URL, no importmap and no blob/CSP dependency.
        const worker = new Worker(options.workerURL ?? DEFAULT_WORKER_URL, { name: `hdr-decode-${slot.index}`, type: 'classic' });
        slot.worker = worker;
        totals.workersStarted++;
        worker.onmessage = ({ data: message }) => {
          if (slot.worker !== worker) return;
          const current = slot.job;
          if (message?.protocol !== PROTOCOL) {
            if (current) finish(current, hdrError('HDR_PROTOCOL_ERROR', 'Unexpected HDR worker protocol'));
            else retire(slot);
            return;
          }
          if (message.kind === 'ready' && !slot.ready) {
            slot.ready = true;
            send(slot);
            return;
          }
          if (!current || current.done) return;
          if (message.id !== current.id) {
            finish(current, hdrError('HDR_PROTOCOL_ERROR', 'Unexpected HDR worker response ID'));
          } else if (message.kind === 'error') {
            finish(current, hdrError('HDR_DECODE_ERROR', message.error?.message || 'HDR decode failed'));
          } else if (message.kind === 'result') {
            const result = message.result;
            if (!(result?.data instanceof Uint16Array) || result.width !== current.info.width || result.height !== current.info.height || result.data.byteLength !== current.info.pixels * 8 || result.type !== 1016 || !result.timings) {
              finish(current, hdrError('HDR_PROTOCOL_ERROR', 'Invalid HDR worker pixel result'));
            } else finish(current, null, result);
          } else finish(current, hdrError('HDR_PROTOCOL_ERROR', 'Unexpected HDR worker message'));
        };
        const workerFailure = event => {
          event.preventDefault?.();
          if (slot.worker !== worker) return;
          totals.workerFailures++;
          if (slot.job) finish(slot.job, hdrError('HDR_WORKER_ERROR', event.message || 'HDR worker script/message failed'));
          retire(slot);
        };
        worker.onerror = workerFailure;
        worker.onmessageerror = workerFailure;
      } catch (cause) {
        totals.workerFailures++;
        finish(job, hdrError('HDR_WORKER_UNAVAILABLE', 'HDR worker could not start', cause));
      }
    } else send(slot);
  }

  async function fetchBuffer(job) {
    if (typeof fetch !== 'function') throw hdrError('HDR_FETCH_UNAVAILABLE', 'Fetch is unavailable');
    const start = performance.now();
    phaseTimeout(job, limits.fetchTimeoutMs, 'fetch');
    const response = await fetch(job.url, { signal: job.controller.signal, credentials: 'same-origin' });
    if (!response.ok) throw hdrError('HDR_HTTP_ERROR', `HDR request failed: HTTP ${response.status} (${job.url})`);
    const declaredBytes = Number(response.headers.get('content-length'));
    if (declaredBytes > limits.maxInputBytes) throw hdrError('HDR_INPUT_LIMIT', 'HDR response exceeds maxInputBytes');
    // Reading bounded chunks also covers missing/wrong Content-Length. The one
    // compressed-input concatenation is on main; decoded pixels are never copied.
    if (!response.body?.getReader) throw hdrError('HDR_FETCH_UNAVAILABLE', 'A streaming fetch body is required for bounded HDR downloads');
    const reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (job.done) throw hdrError('HDR_ABORTED', 'HDR download ended after cancellation');
        if (done) break;
        length += value.byteLength;
        if (length > limits.maxInputBytes || retainedInputBytes + value.byteLength > limits.maxRetainedInputBytes) throw hdrError('HDR_INPUT_LIMIT', 'HDR download exceeds the retained-input budget');
        job.retainedBytes += value.byteLength;
        retainedInputBytes += value.byteLength;
        totals.peakRetainedInputBytes = Math.max(totals.peakRetainedInputBytes, retainedInputBytes);
        totals.downloadedBytes += value.byteLength;
        chunks.push(value);
      }
    } catch (error) {
      // Do not await cancel: a broken source must not hold the job open.
      reader.cancel().catch(() => {});
      throw error;
    } finally { reader.releaseLock(); }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    job.fetchMs = performance.now() - start;
    clearTimeout(job.phaseTimer);
    return bytes.buffer;
  }

  async function prepare(job) {
    try {
      if (job.url !== undefined) job.buffer = await fetchBuffer(job);
      if (job.done) { job.buffer = null; return; }
      const start = performance.now();
      job.info = inspectHeader(job.buffer, limits.maxPixels, limits.maxInputBytes);
      job.headerMs = performance.now() - start;
      // Official parser: RGBE scratch 4 B/pixel, output 8 B/pixel. Reserve
      // additional compressed input and row scratch conservatively.
      job.estimatedBytes = 2 * job.buffer.byteLength + 12 * job.info.pixels + job.info.width * 16 + 65536;
      if (job.estimatedBytes > limits.maxWorkingBytes) throw hdrError('HDR_MEMORY_LIMIT', 'HDR decode exceeds maxWorkingBytes');
      job.large = Math.max(job.info.width, job.info.height) >= 4096 || job.info.pixels > 2048 * 2048;
      job.preparedAt = performance.now();
      waiting.push(job);
      schedule();
    } catch (cause) {
      if (!job.done) finish(job, cause.code?.startsWith('HDR_') ? cause : hdrError(job.url !== undefined && !job.buffer ? 'HDR_FETCH_ERROR' : 'HDR_INVALID_INPUT', cause.message || 'HDR preparation failed', cause));
    }
  }

  function pump() {
    if (disposed) return;
    for (const slot of slots) {
      if (!slot.job && queued.length) {
        const job = queued.shift();
        slot.job = job;
        job.slot = slot;
        job.prepareStart = performance.now();
        void prepare(job);
      }
    }
    while (waiting.length) {
      const job = waiting[0];
      // Preserve ready order: a waiting large map cannot be starved by probes.
      if (decoding.size && (job.large || [...decoding].some(item => item.large))) break;
      if (workingBytes + job.estimatedBytes > limits.maxWorkingBytes) break;
      waiting.shift();
      startDecode(job);
    }
  }

  function enqueue(url, buffer, config = {}) {
    try {
      if (!config || typeof config !== 'object' || (config.signal && (typeof config.signal.aborted !== 'boolean' || typeof config.signal.addEventListener !== 'function' || typeof config.signal.removeEventListener !== 'function'))) throw hdrError('HDR_INVALID_OPTIONS', 'Expected options with an optional AbortSignal');
      if (disposed) throw hdrError('HDR_DISPOSED', 'HDR service is disposed');
      if (typeof Worker !== 'function') throw hdrError('HDR_WORKER_UNAVAILABLE', 'Web Workers are unavailable; use the caller fallback');
      if (jobs.size >= limits.maxQueued + workerLimit) throw hdrError('HDR_QUEUE_FULL', 'HDR queue is full');
      if (config.signal?.aborted) throw hdrError('HDR_ABORTED', 'HDR request was aborted');
      // flipY is an alias for the physical row flip at this API boundary.
      // Result.flipY remains the official GPU upload flag (true).
      if (config.flipRows !== undefined && typeof config.flipRows !== 'boolean' || config.flipY !== undefined && typeof config.flipY !== 'boolean') throw hdrError('HDR_INVALID_OPTIONS', 'flipRows/flipY must be boolean');
      if (config.flipRows !== undefined && config.flipY !== undefined && config.flipRows !== config.flipY) throw hdrError('HDR_INVALID_OPTIONS', 'flipRows and its flipY alias conflict');
      let ownedBuffer = null;
      if (url === undefined) {
        if (!(buffer instanceof ArrayBuffer) || !buffer.byteLength || buffer.resizable || buffer.byteLength > limits.maxInputBytes || retainedInputBytes + buffer.byteLength > limits.maxRetainedInputBytes) throw hdrError('HDR_INPUT_LIMIT', 'parse requires a nonempty fixed ArrayBuffer within the input budget');
        // Immediate ownership transfer prevents queued caller mutations; no copy.
        ownedBuffer = structuredClone(buffer, { transfer: [buffer] });
      }
      return new Promise((resolve, reject) => {
        const job = {
          id: ++nextId, start: performance.now(), url, buffer: ownedBuffer,
          flipRows: config.flipRows ?? config.flipY ?? false, signal: config.signal,
          controller: new AbortController(), retainedBytes: ownedBuffer?.byteLength || 0,
          resolve, reject, done: false, fetchMs: 0, slot: null,
        };
        retainedInputBytes += job.retainedBytes;
        totals.peakRetainedInputBytes = Math.max(totals.peakRetainedInputBytes, retainedInputBytes);
        jobs.add(job);
        totals.submitted++;
        job.abortListener = () => finish(job, hdrError('HDR_ABORTED', 'HDR request was aborted'));
        job.signal?.addEventListener('abort', job.abortListener, { once: true });
        job.timer = setTimeout(() => finish(job, hdrError('HDR_TIMEOUT', `HDR request exceeded ${limits.timeoutMs} ms including queue wait`)), limits.timeoutMs);
        queued.push(job);
        schedule();
      });
    } catch (cause) {
      return Promise.reject(cause.code?.startsWith('HDR_') ? cause : hdrError('HDR_INVALID_INPUT', cause.message || 'Invalid HDR request', cause));
    }
  }

  return {
    load(url, config) {
      if (!(typeof url === 'string' || url instanceof URL) || !String(url)) return Promise.reject(hdrError('HDR_INVALID_INPUT', 'load requires a URL'));
      return enqueue(String(url), undefined, config);
    },
    parse(buffer, config) { return enqueue(undefined, buffer, config); },
    getStats() {
      return {
        ...totals, lastError: totals.lastError && { ...totals.lastError },
        disposed, workerLimit, workersAlive: slots.filter(slot => slot.worker).length,
        inFlight: jobs.size, queued: queued.length, preparing: slots.filter(slot => slot.job && !waiting.includes(slot.job) && !decoding.has(slot.job)).length,
        waitingDecode: waiting.length, decoding: decoding.size,
        largeDecoding: [...decoding].filter(job => job.large).length,
        retainedInputBytes, workingBytes, limits: { ...limits },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const job of [...jobs]) finish(job, hdrError('HDR_DISPOSED', 'HDR service was disposed'));
      for (const slot of slots) retire(slot);
    },
  };
}

/** Main-thread adapter: wraps transferred storage directly, with no pixel copy. */
export function createHDRTexture(THREE, result) {
  if (!(result?.data instanceof Uint16Array) || result.data.length !== result.width * result.height * 4 || result.type !== THREE.HalfFloatType) throw hdrError('HDR_INVALID_INPUT', 'Expected r185 RGBA half-float HDR pixels');
  const texture = new THREE.DataTexture(result.data, result.width, result.height, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.flipY = true; // Exact HDRLoader.parse/load default, even after prepLM.
  texture.needsUpdate = true;
  return texture;
}
