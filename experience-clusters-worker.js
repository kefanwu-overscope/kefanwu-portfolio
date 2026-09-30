import { buildClusterTree, CLUSTER_SCHEMA, validateClusterTree } from './experience-clusters-core.js?v=advanced-render-20260930';
import { MeshoptSimplifier } from './tools/lod/vendor/meshopt_simplifier.mjs?v=1.2.0';

const CACHE_LIMIT = 48 * 1024 * 1024;
let databasePromise;
function database() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return databasePromise ||= new Promise(resolve => {
    const request = indexedDB.open('studio-clusters', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('trees');
      request.result.createObjectStore('metadata', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}
const resultOf = request => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
async function fingerprint(input, options) {
  const parts = [new TextEncoder().encode(JSON.stringify({ schema: CLUSTER_SCHEMA, options,
    attributes: (input.attributes || []).map(a => [a.name, a.itemSize]) })),
  input.position, input.index, ...(input.attributes || []).map(a => a.array)];
  const hashes = [];
  for (const part of parts) hashes.push(new Uint8Array(await crypto.subtle.digest('SHA-256', part)));
  const joined = new Uint8Array(hashes.length * 32);
  hashes.forEach((hash, i) => joined.set(hash, i * 32));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', joined))].map(v => v.toString(16).padStart(2, '0')).join('');
}
async function cached(key) {
  try {
    const db = await database(); if (!db) return null;
    const tree = await resultOf(db.transaction('trees').objectStore('trees').get(key));
    if (tree) {
      tree.byteLength = tree.indices.byteLength + tree.nodes.length * 256;
      db.transaction('metadata', 'readwrite').objectStore('metadata').put({ key, bytes: tree.byteLength, used: Date.now() });
    }
    return tree;
  } catch { return null; }
}
async function save(key, tree) {
  if (tree.byteLength > CACHE_LIMIT / 2) return;
  try {
    const db = await database(); if (!db) return;
    const metadata = await resultOf(db.transaction('metadata').objectStore('metadata').getAll());
    const tx = db.transaction(['trees', 'metadata'], 'readwrite');
    let bytes = tree.byteLength + metadata.filter(m => m.key !== key).reduce((sum, m) => sum + m.bytes, 0);
    let count = metadata.length;
    for (const entry of metadata.sort((a, b) => a.used - b.used)) {
      if (bytes <= CACHE_LIMIT && count < 160) break;
      if (entry.key === key) continue;
      tx.objectStore('trees').delete(entry.key); tx.objectStore('metadata').delete(entry.key);
      bytes -= entry.bytes; count--;
    }
    tx.objectStore('trees').put(tree, key);
    tx.objectStore('metadata').put({ key, bytes: tree.byteLength, used: Date.now() });
    await new Promise(resolve => { tx.oncomplete = tx.onerror = tx.onabort = resolve; });
  } catch { /* Storage denial/quota is an uncached worker build, never missing geometry. */ }
}
let work = Promise.resolve();
self.onmessage = event => {
  const { id, input, options = {} } = event.data;
  work = work.then(async () => {
    const start = performance.now();
    try {
      const key = await fingerprint(input, options);
      let tree = await cached(key), cacheHit = !!tree;
      if (!validateClusterTree(tree, input.position.length / 3, input.index.length / 3)) {
        tree = await buildClusterTree(input, MeshoptSimplifier, options); cacheHit = false;
        await save(key, tree);
      }
      tree.byteLength = tree.indices.byteLength + tree.nodes.length * 256;
      self.postMessage({ id, tree, key, cacheHit, buildMs: performance.now() - start }, [tree.indices.buffer]);
    } catch (error) { self.postMessage({ id, error: error.message || String(error) }); }
  });
};
