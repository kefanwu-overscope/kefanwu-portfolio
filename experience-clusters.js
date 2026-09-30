import * as THREE from './vendor/three/0.185.0/build/three.module.js';
import { classifyCluster, selectClusterNodes, validateClusterTree } from './experience-clusters-core.js?v=advanced-render-20260930';
import { createClusterGpuCuller } from './experience-clusters-gpu.js?v=advanced-render-20260930';
import { getGpuDevice } from './experience-gpu-device.js?v=advanced-render-20260930';

const yieldTask = () => globalThis.scheduler?.yield ? scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0));
const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => v === b[i]);
const now = () => globalThis.performance?.now() || Date.now();
export const getSourceGeometry = mesh => mesh.userData?.clusterSourceGeometry || mesh.geometry;

function eligible(mesh, exclude) {
  const geometry = mesh.geometry, material = mesh.material;
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || !geometry?.attributes.position || geometry.isInstancedBufferGeometry ||
      !material || Array.isArray(material) || material.transparent || material.transmission || material.alphaTest ||
      material.displacementMap || material.wireframe || material.isShaderMaterial || material.isRawShaderMaterial ||
      Object.keys(geometry.morphAttributes).length || geometry.drawRange.start !== 0 ||
      geometry.drawRange.count !== Infinity || geometry.groups.length > 1 ||
      mesh.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender || mesh.userData.clusterSourceGeometry) return false;
  if (material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile && !material.userData?.source &&
      !material.userData?.clusterVertexPositionsPreserved &&
      !material.customProgramCacheKey().startsWith('studio-cycles-rgbm-diffuse-r185-')) return false;
  for (let object = mesh; object; object = object.parent)
    if (exclude.has(object) || object.userData.clusterExclude || object.isSkinnedMesh) return false;
  return (geometry.index?.count || geometry.attributes.position.count) >= 384 * 3;
}
function attributeCopy(attribute) {
  if (!attribute.isInterleavedBufferAttribute && !attribute.normalized)
    return attribute.array instanceof Float32Array ? attribute.array.slice() : Float32Array.from(attribute.array);
  const result = new Float32Array(attribute.count * attribute.itemSize);
  for (let i = 0; i < attribute.count; i++) for (let component = 0; component < attribute.itemSize; component++)
    result[i * attribute.itemSize + component] = attribute.getComponent(i, component);
  return result;
}
function inferKey(mesh, fallback) {
  for (let object = mesh; object; object = object.parent)
    if (object.userData.roomExhibit || object.userData.hotspot?.key)
      return object.userData.roomExhibit || object.userData.hotspot.key;
  return fallback || '';
}

// Registration is asynchronous and leaves original geometry visible until the
// complete validated hierarchy is resident. One worker/build at a time; adding
// clusters adds no material draw calls and no second vertex buffer set.
export function createClusterRenderer({ device = null, getDevice = getGpuDevice,
  maxBytes = 24 * 1024 * 1024, maxMeshTriangles = 180000, gpu = true } = {}) {
  const records = [], known = new WeakSet(), jobs = [];
  let disposed = false, worker = null, workerFailed = false, active = false, sequence = 0, revision = 0;
  let culler = null, gpuPending = false, lastGpu = null, lastDispatch = -Infinity;
  let nodeData = new Float32Array(0), classification = new Uint32Array(0);
  let attentionKey = '', pixelError = 1.0, enabled = true;
  const viewProjection = new THREE.Matrix4(), frustum = new THREE.Frustum(), cameraPosition = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3(), point = new THREE.Vector3();
  const frame = new Float32Array(52), workerRequests = new Map();
  const stats = { status: 'idle', mode: 'cpu', meshes: 0, nodes: 0, leaves: 0, coarseRepresentations: 0,
    sourceTriangles: 0, selectedTriangles: 0, selectedClusters: 0, culledLeaves: 0, bytes: 0,
    queued: 0, cacheHits: 0, builds: 0, buildMs: 0, skipped: 0, failures: 0,
    gpuAccepted: 0, cpuFrames: 0, indexUploads: 0, lastError: null };

  async function initializeGpu() {
    if (!gpu || culler || gpuPending || disposed) return;
    gpuPending = true;
    try {
      const sharedDevice = device || await getDevice();
      if (!sharedDevice || disposed) return;
      const result = await createClusterGpuCuller(sharedDevice);
      if (disposed) { result?.dispose(); return; }
      culler = result; stats.status = 'ready';
      sharedDevice.lost.then(() => {
        if (culler === result) { result.dispose(); culler = null; lastGpu = null; stats.mode = 'cpu'; stats.status = 'gpu-lost-cpu-fallback'; }
      });
    } catch (error) { stats.lastError = error.message; stats.mode = 'cpu'; }
    finally { gpuPending = false; }
  }
  function getWorker() {
    if (worker) return worker;
    if (workerFailed || !globalThis.Worker) throw Error('Cluster worker unavailable');
    worker = new Worker(new URL('./experience-clusters-worker.js?v=advanced-render-20260930', import.meta.url), { type: 'module', name: 'geometry-clusters' });
    worker.onmessage = event => {
      const { id, error } = event.data, request = workerRequests.get(id);
      if (!request) return;
      workerRequests.delete(id); clearTimeout(request.timer);
      error ? request.reject(Error(error)) : request.resolve(event.data);
    };
    worker.onerror = error => {
      workerFailed = true;
      for (const request of workerRequests.values()) { clearTimeout(request.timer); request.reject(Error(error.message || 'Cluster worker failed')); }
      workerRequests.clear(); worker?.terminate(); worker = null;
    };
    return worker;
  }
  function buildInWorker(input, options) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const target = getWorker();
      const timer = setTimeout(() => {
        workerRequests.delete(id); workerFailed = true; worker?.terminate(); worker = null;
        reject(Error('Cluster build timed out; original geometry retained'));
      }, 45000);
      workerRequests.set(id, { resolve, reject, timer });
      target.postMessage({ id, input, options }, [input.position.buffer, input.index.buffer,
        ...input.attributes.map(a => a.array.buffer)]);
    });
  }
  function install(mesh, source, tree, key) {
    const geometry = new THREE.BufferGeometry();
    // Attribute object identity is intentional, including all custom attributes.
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    geometry.boundingBox = source.boundingBox?.clone() || null;
    geometry.boundingSphere = source.boundingSphere?.clone() || null;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingSphere) geometry.computeBoundingSphere();
    const fullIndex = source.index || new THREE.BufferAttribute(Uint32Array.from({ length: source.attributes.position.count }, (_, i) => i), 1);
    const index = new THREE.BufferAttribute(new Uint32Array(tree.triangleCount * 3), 1).setUsage(THREE.DynamicDrawUsage);
    index.array.set(fullIndex.array); geometry.setIndex(index);
    geometry.setDrawRange(0, fullIndex.count);
    const original = { beforeShadow: mesh.onBeforeShadow, afterShadow: mesh.onAfterShadow, raycast: mesh.raycast };
    let scopeScene = mesh;
    while (scopeScene.parent) scopeScene = scopeScene.parent;
    const record = { mesh, source, geometry, fullIndex, index, tree, key, original, scopeScene: scopeScene.isScene ? scopeScene : null,
      matrix: null, world: new Float32Array(tree.nodes.length * 8), selected: null,
      selectedSet: new Set(), sourceVersions: Object.entries(source.attributes).map(([name, a]) => [name, a, a.version, a.data?.version]),
      sourceIndex: source.index, sourceIndexVersion: source.index?.version,
      disabled: false, bytes: tree.byteLength + index.array.byteLength + tree.nodes.length * 32 + (source.index ? 0 : fullIndex.array.byteLength) };
    mesh.userData.clusterSourceGeometry = source;
    mesh.geometry = geometry;
    mesh.onBeforeShadow = function(...args) {
      geometry.setIndex(fullIndex); geometry.setDrawRange(0, fullIndex.count);
      original.beforeShadow.apply(this, args);
    };
    mesh.onAfterShadow = function(...args) {
      try { original.afterShadow.apply(this, args); }
      finally { geometry.setIndex(index); geometry.setDrawRange(0, record.selectedCount ?? fullIndex.count); }
    };
    mesh.raycast = function(...args) {
      const current = this.geometry; this.geometry = source;
      try { return original.raycast.apply(this, args); } finally { this.geometry = current; }
    };
    records.push(record); revision++;
    stats.meshes++; stats.nodes += tree.nodes.length; stats.leaves += tree.leafCount;
    stats.coarseRepresentations += tree.coarseCount; stats.sourceTriangles += tree.triangleCount;
    stats.bytes += record.bytes; stats.status = 'ready';
    void initializeGpu();
  }
  async function drain() {
    if (active || disposed) return;
    active = true;
    try {
      while (jobs.length && !disposed) {
        jobs.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
        const job = jobs.shift(); stats.queued = jobs.length;
        const { mesh } = job, source = mesh.geometry;
        try {
          const triangleCount = (source.index?.count || source.attributes.position.count) / 3;
          // Reserve a conservative hierarchy + compact draw index estimate.
          const estimate = triangleCount * 3 * 4 * 6 + Math.ceil(triangleCount / 64) * 288;
          if (triangleCount > maxMeshTriangles || stats.bytes + estimate > maxBytes) { stats.skipped++; job.resolve(false); continue; }
          await yieldTask();
          if (disposed || mesh.geometry !== source) { job.resolve(false); continue; }
          const key = inferKey(mesh, job.key);
          const attributes = Object.entries(source.attributes).filter(([name]) => name !== 'position').map(([name, attribute]) =>
            ({ name, itemSize: attribute.itemSize, array: attributeCopy(attribute) }));
          const input = { position: attributeCopy(source.attributes.position),
            index: source.index ? Uint32Array.from(source.index.array) : Uint32Array.from({ length: source.attributes.position.count }, (_, i) => i), attributes };
          const options = { protected: job.protected || ['carbonSeat', 'seat'].includes(key) ||
            mesh.material.userData?.source?.procedural?.type === 'carbon' };
          const result = await buildInWorker(input, options);
          if (disposed || mesh.geometry !== source || !mesh.parent) { job.resolve(false); continue; }
          if (!validateClusterTree(result.tree, source.attributes.position.count, triangleCount)) throw Error('Invalid cached cluster hierarchy');
          const bytes = result.tree.byteLength + triangleCount * (source.index ? 12 : 24) + result.tree.nodes.length * 32;
          if (stats.bytes + bytes > maxBytes) { stats.skipped++; job.resolve(false); continue; }
          install(mesh, source, result.tree, key);
          stats.builds++; stats.cacheHits += Number(result.cacheHit); stats.buildMs += result.buildMs;
          job.resolve(true);
        } catch (error) { stats.failures++; stats.lastError = error.message; job.resolve(false); }
      }
    } finally { active = false; }
  }
  function restore(record) {
    const { mesh, original, source, geometry } = record;
    if (mesh.geometry === geometry) mesh.geometry = source;
    mesh.onBeforeShadow = original.beforeShadow; mesh.onAfterShadow = original.afterShadow; mesh.raycast = original.raycast;
    delete mesh.userData.clusterSourceGeometry;
    // Do not dispose borrowed vertex attributes or the original index.
    for (const name of Object.keys(geometry.attributes)) geometry.deleteAttribute(name);
    geometry.setIndex(record.index); geometry.dispose(); record.disabled = true;
  }
  function setFull(record) {
    if (record.disabled || record.selected === null) return;
    record.index.array.set(record.fullIndex.array); record.index.needsUpdate = true;
    record.geometry.setDrawRange(0, record.fullIndex.count); record.selectedCount = record.fullIndex.count;
    record.selected = null; record.selectedSet.clear(); stats.indexUploads++;
  }
  function removeRecord(index) {
    const record = records[index];
    if (!record.disabled) restore(record);
    stats.meshes--; stats.nodes -= record.tree.nodes.length; stats.leaves -= record.tree.leafCount;
    stats.coarseRepresentations -= record.tree.coarseCount; stats.sourceTriangles -= record.tree.triangleCount;
    stats.bytes -= record.bytes; records.splice(index, 1); revision++;
  }
  function packFrame(camera, options) {
    camera.updateWorldMatrix(true, false);
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection);
    frustum.planes.forEach((plane, i) => frame.set([plane.normal.x, plane.normal.y, plane.normal.z, plane.constant], i * 4));
    frame.set(viewProjection.elements, 24);
    camera.getWorldPosition(cameraPosition); camera.getWorldDirection(cameraDirection);
    frame.set([cameraPosition.x, cameraPosition.y, cameraPosition.z,
      (options.viewportHeight || globalThis.innerHeight || 720) * Math.abs(camera.projectionMatrix.elements[5]) * 0.5], 40);
    frame.set([cameraDirection.x, cameraDirection.y, cameraDirection.z, Math.max(0.001, camera.near)], 44);
    frame.set([options.gaze?.x || 0, options.gaze?.y || 0, pixelError, stats.nodes], 48);
  }
  return {
    async registerRoot(root, options = {}) {
      if (disposed || !root) return [];
      const exclude = new Set(options.exclude || []), pending = [];
      root.traverse(mesh => {
        if (known.has(mesh) || !eligible(mesh, exclude)) return;
        known.add(mesh);
        pending.push(new Promise(resolve => jobs.push({ mesh, key: options.key, protected: !!options.protected,
          priority: options.priority ?? 10, sequence: ++sequence, resolve })));
      });
      stats.queued = jobs.length; void drain();
      return Promise.all(pending);
    },
    update(camera, options = {}) {
      if (disposed || !camera || !records.length) return;
      // Loader upgrades may detach a complete root. Release its extra data rather
      // than retaining old hierarchy generations for the rest of the session.
      for (let i = records.length - 1; i >= 0; i--) if (records[i].scopeScene) {
        let top = records[i].mesh; while (top.parent) top = top.parent;
        if (top !== records[i].scopeScene) removeRecord(i);
      }
      enabled = options.enabled ?? enabled;
      pixelError = Math.max(0.25, Math.min(4, options.pixelError ?? pixelError));
      const nextAttention = options.attentionKey || '';
      if (attentionKey !== nextAttention) { attentionKey = nextAttention; revision++; }
      if (!enabled || !camera.isPerspectiveCamera) {
        for (const record of records) setFull(record);
        stats.mode = 'full-source'; stats.selectedTriangles = stats.sourceTriangles; return;
      }
      packFrame(camera, options);
      if (nodeData.length !== stats.nodes * 8) { nodeData = new Float32Array(stats.nodes * 8); classification = new Uint32Array(stats.nodes); }
      let at = 0;
      for (const record of records) {
        const { mesh, tree } = record;
        record.offset = at / 8;
        if (!record.disabled && (mesh.geometry !== record.geometry || record.source.index !== record.sourceIndex ||
            record.source.index?.version !== record.sourceIndexVersion || record.sourceVersions.some(([name, attribute, version, dataVersion]) =>
            record.source.attributes[name] !== attribute || attribute.version !== version || attribute.data?.version !== dataVersion))) {
          restore(record); revision++;
        }
        mesh.updateWorldMatrix(true, false);
        const matrix = mesh.matrixWorld.elements;
        if (!same(record.matrix, matrix)) {
          record.matrix = matrix.slice(); revision++;
          // Frobenius norm bounds the singular value under arbitrary parent shear.
          // For ordinary TRS, max column length is tighter and still conservative.
          const columns = [[matrix[0], matrix[1], matrix[2]], [matrix[4], matrix[5], matrix[6]], [matrix[8], matrix[9], matrix[10]]];
          const lengths = columns.map(c => Math.hypot(...c));
          const sheared = columns.some((c, i) => columns.some((d, j) => j > i && Math.abs(c[0] * d[0] + c[1] * d[1] + c[2] * d[2]) > 1e-6 * lengths[i] * lengths[j]));
          const scale = sheared ? Math.hypot(...lengths) : Math.max(...lengths);
          for (let n = 0; n < tree.nodes.length; n++) {
            const node = tree.nodes[n]; point.fromArray(node.sphere).applyMatrix4(mesh.matrixWorld);
            record.world.set([point.x, point.y, point.z, node.sphere[3] * scale, node.error * scale,
              1, node.count > 0 ? 1 : 0, 0], n * 8);
          }
        }
        for (let n = 0; n < tree.nodes.length; n++) {
          record.world[n * 8 + 5] = attentionKey && record.key === attentionKey ? 0.5 : 1;
          record.world[n * 8 + 7] = record.selectedSet.has(n) ? 1 : 0;
        }
        nodeData.set(record.world, at); at += record.world.length;
      }
      const current = lastGpu && lastGpu.revision === revision && same(lastGpu.frame, frame);
      if (current) { classification.set(lastGpu.result); stats.gpuAccepted++; stats.mode = 'webgpu-classify-cpu-submit'; }
      else {
        for (let n = 0; n < stats.nodes; n++) classification[n] = classifyCluster(nodeData, n * 8, frame);
        stats.cpuFrames++; stats.mode = 'cpu-current-frame';
      }
      stats.selectedTriangles = stats.selectedClusters = stats.culledLeaves = 0;
      for (const record of records) {
        if (record.disabled) { stats.selectedTriangles += record.tree.triangleCount; continue; }
        const selected = selectClusterNodes(record.tree, classification, record.offset);
        let count = 0;
        for (const id of selected) count += record.tree.nodes[id].count;
        if (!same(record.selected, selected)) {
          let cursor = 0;
          for (const id of selected) {
            const node = record.tree.nodes[id]; record.index.array.set(record.tree.indices.subarray(node.offset, node.offset + node.count), cursor); cursor += node.count;
          }
          record.index.clearUpdateRanges(); if (count) record.index.addUpdateRange(0, count);
          record.index.needsUpdate = true; record.geometry.setDrawRange(0, count);
          record.selected = selected; record.selectedSet = new Set(selected); record.selectedCount = count; stats.indexUploads++;
        }
        stats.selectedTriangles += count / 3; stats.selectedClusters += selected.length;
        for (let id = 0; id < record.tree.nodes.length; id++)
          if (record.tree.nodes[id].left < 0 && classification[record.offset + id] === 0) stats.culledLeaves++;
      }
      if (culler && !culler.busy && now() - lastDispatch >= 90) {
        const request = { revision, frame: frame.slice() }; lastDispatch = now();
        culler.classify(nodeData, request.frame).then(result => {
          if (!disposed && result) lastGpu = { ...request, result };
        }).catch(error => {
          stats.lastError = error.message; culler?.dispose(); culler = null; lastGpu = null; stats.mode = 'cpu';
        });
      }
    },
    getSourceGeometry,
    unregisterRoot(root) {
      for (let i = records.length - 1; i >= 0; i--) {
        let object = records[i].mesh; while (object && object !== root) object = object.parent;
        if (object === root) removeRecord(i);
      }
    },
    getStats() { return { ...stats, pending: active || jobs.length > 0, gpu: culler ? { ...culler.stats } : null,
      budgetBytes: maxBytes, drawSubmission: 'WebGL per-material compact indices', occlusion: false }; },
    dispose() {
      if (disposed) return;
      disposed = true; worker?.terminate(); worker = null; culler?.dispose(); culler = null;
      for (const request of workerRequests.values()) { clearTimeout(request.timer); request.reject(Error('Cluster renderer disposed')); }
      workerRequests.clear(); for (const job of jobs.splice(0)) job.resolve(false);
      for (const record of records) if (!record.disabled) restore(record);
      records.length = 0; lastGpu = null; nodeData = new Float32Array(0); classification = new Uint32Array(0);
      stats.meshes = stats.nodes = stats.leaves = stats.coarseRepresentations = stats.bytes = stats.queued = 0;
      stats.sourceTriangles = stats.selectedTriangles = stats.selectedClusters = stats.culledLeaves = 0;
      stats.status = 'disposed';
    },
  };
}
