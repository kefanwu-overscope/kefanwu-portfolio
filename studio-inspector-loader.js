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

  function cancel() {
    generation += 1;
    pending?.abort();
    pending = null;
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
    const controller = new AbortController();
    pending = controller;
    const externalAbort = () => controller.abort();
    signal?.addEventListener('abort', externalAbort, { once: true });
    let resource;
    try {
      resource = await load(key, controller.signal);
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
  const response = await fetcher(url, { signal });
  if (!response.ok) throw new Error(`Model asset unavailable (${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (signal?.aborted) throw abortError();
  // CDNs may already apply Content-Encoding. Inspect the bytes to avoid
  // decompressing a transparently decoded response a second time.
  const head = new Uint8Array(buffer, 0, Math.min(2, buffer.byteLength));
  if (head[0] !== 0x1f || head[1] !== 0x8b) return buffer;
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot decode the interactive model. Please use the case study preview.');
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'), { signal });
  const decoded = await new Response(stream).arrayBuffer();
  if (signal?.aborted) throw abortError();
  return decoded;
}
