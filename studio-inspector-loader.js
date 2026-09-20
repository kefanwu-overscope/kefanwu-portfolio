// A bounded, latest-request-wins cache. Independent of WebGL so cancellation,
// stale completion, and disposal behavior can be verified without a GPU.
export function abortError() {
  return new DOMException('The project request was superseded.', 'AbortError');
}

export function createProjectResourceCache({ load, dispose, maxEntries = 2, maxBytes = 160 * 1024 * 1024 }) {
  const entries = new Map();
  let pending = null;
  let generation = 0;
  let closed = false;
  let activeKey = null;

  function remove(key) {
    const resource = entries.get(key);
    if (!resource) return;
    entries.delete(key);
    dispose(resource);
  }

  function bytes() {
    let total = 0;
    for (const item of entries.values()) total += item.byteLength || 0;
    return total;
  }

  function trim() {
    for (const key of entries.keys()) {
      if (entries.size <= maxEntries && bytes() <= maxBytes) break;
      if (key !== activeKey) remove(key);
    }
  }

  function reserve(incomingBytes = 0, incomingEntries = 1) {
    for (const key of [...entries.keys()]) {
      if (entries.size + incomingEntries <= maxEntries && bytes() + incomingBytes <= maxBytes) break;
      if (key !== activeKey) remove(key);
    }
  }

  function cancel() {
    generation += 1;
    pending?.abort();
    pending = null;
    for (const entry of entries.values()) entry.cancelMotion?.();
  }

  async function select(key, { signal } = {}) {
    if (closed || signal?.aborted) throw abortError();
    cancel();
    const ticket = generation;
    if (entries.has(key)) {
      const resource = entries.get(key);
      entries.delete(key);
      entries.set(key, resource);
      activeKey = key;
      return resource;
    }
    // The host has already detached the old view. Make room before allocating
    // the incoming package, instead of retaining three complete projects.
    activeKey = null;
    reserve();
    const controller = new AbortController();
    pending = controller;
    const externalAbort = () => controller.abort();
    signal?.addEventListener('abort', externalAbort, { once: true });
    let resource;
    try {
      resource = await load(key, controller.signal, reserve);
      if (closed || ticket !== generation || controller.signal.aborted) {
        dispose(resource);
        throw abortError();
      }
      activeKey = key;
      entries.set(key, resource);
      trim();
      return resource;
    } catch (error) {
      // A failed member of a parallel asset load must also stop its siblings.
      controller.abort();
      throw error;
    } finally {
      signal?.removeEventListener('abort', externalAbort);
      if (pending === controller) pending = null;
    }
  }

  return {
    select,
    cancel,
    trim,
    reserve,
    // The selected resource remains alive while switching; the view detaches it
    // before calling select, so pruning never disposes an object still in scene.
    stats: () => ({ entries: entries.size, byteLength: bytes(), activeKey, pending: !!pending }),
    dispose() {
      if (closed) return;
      closed = true;
      cancel();
      for (const key of [...entries.keys()]) remove(key);
      activeKey = null;
    },
  };
}

export async function fetchProjectBuffer(url, { signal, fetcher = fetch } = {}) {
  if (signal?.aborted) throw abortError();
  const response = await fetcher(url, { signal });
  if (!response.ok) throw new Error(`Model asset unavailable (${response.status}).`);
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks = [];
  let prefixBytes = 0, ended = false, streamController;
  const stop = () => { reader.cancel(signal?.reason).catch(() => {}); streamController?.error(abortError()); };
  signal?.addEventListener('abort', stop, { once: true });
  try {
    // Only peek at the gzip signature. Inflation consumes network chunks as
    // they arrive; no complete compressed ArrayBuffer or Blob is allocated.
    while (prefixBytes < 2 && !ended) {
      const next = await reader.read();
      ended = next.done;
      if (next.value?.length) { chunks.push(next.value); prefixBytes += next.value.length; }
      if (signal?.aborted) throw abortError();
    }
    const first = chunks[0]?.[0];
    const second = chunks[0]?.length > 1 ? chunks[0][1] : chunks[1]?.[0];
    let stream = new ReadableStream({
      start(controller) { streamController = controller; },
      async pull(controller) {
        try {
          if (signal?.aborted) throw abortError();
          if (chunks.length) { controller.enqueue(chunks.shift()); return; }
          if (ended) { controller.close(); return; }
          const next = await reader.read();
          if (signal?.aborted) throw abortError();
          if (next.done) { ended = true; controller.close(); }
          else controller.enqueue(next.value);
        } catch (error) { controller.error(error); }
      },
      cancel(reason) { return reader.cancel(reason); },
    });
    // CDNs may already apply Content-Encoding; inspect bytes to avoid a
    // second decompression of an automatically expanded response.
    if (first === 0x1f && second === 0x8b) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decode the interactive model. Please use the case study preview.');
      stream = stream.pipeThrough(new DecompressionStream('gzip'), { signal });
    }
    const decoded = await new Response(stream).arrayBuffer();
    if (signal?.aborted) throw abortError();
    return decoded;
  } catch (error) {
    await reader.cancel(error).catch(() => {});
    throw error;
  } finally { signal?.removeEventListener('abort', stop); }
}
