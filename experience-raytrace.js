// Stationary hybrid renderer: WebGL owns materials; portable WebGPU compute
// traces actual world triangles. No optional ray-query/RT-core API is assumed.
import { cachedComputePipeline } from "./experience-gpu-device.js?v=advanced-render-20260930";
const yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0));
const now = () => globalThis.performance?.now() || Date.now();
const opaque = (material) => material && material.visible !== false && !material.transparent &&
  (material.opacity ?? 1) >= 0.98 && !material.transmission && !material.alphaTest && !material.alphaMap && !material.wireframe;

export function raytraceMeshEligible(object, excluded = new Set()) {
  if (!object.isMesh || object.isSkinnedMesh || raytraceSourceGeometry(object)?.morphAttributes?.position?.length) return false;
  for (let node = object; node; node = node.parent) {
    if (!node.visible || excluded.has(node) || node.userData?.raytraceExcluded || node.userData?.dynamic) return false;
  }
  return !!raytraceSourceGeometry(object)?.attributes?.position;
}

export const raytraceSourceGeometry = (object) => object.userData?.clusterSourceGeometry || object.geometry?.userData?.clusterSourceGeometry || object.geometry;

function materialRanges(mesh) {
  const geometry = raytraceSourceGeometry(mesh), total = geometry.index?.count ?? geometry.attributes.position.count;
  const start = Math.max(0, geometry.drawRange.start), end = Math.min(total, start + geometry.drawRange.count);
  const groups = Array.isArray(mesh.material) ? geometry.groups : [{ start: 0, count: total, materialIndex: 0 }];
  return groups.filter((group) => opaque(Array.isArray(mesh.material) ? mesh.material[group.materialIndex] : mesh.material)).map((group) => {
    const first = Math.max(start, group.start), last = Math.min(end, group.start + group.count);
    return { start: first, count: Math.max(0, last - first - (last - first) % 3) };
  }).filter((range) => range.count > 0);
}

function multiplyMatrices(a, b) {
  const result = new Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    result[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
  }
  return result;
}

export async function snapshotRaytraceGeometry(scene, { exclude = [], maxTriangles = 1200000, isCancelled = () => false } = {}) {
  const excluded = new Set(exclude.filter(Boolean)), candidates = [], meshes = [], transfer = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => { if (raytraceMeshEligible(object, excluded)) candidates.push(object); });
  let triangles = 0, bytes = 0, lastYield = now();
  for (const object of candidates) {
    if (isCancelled()) throw new Error("cancelled");
    const ranges = materialRanges(object), instances = object.isInstancedMesh ? object.count : 1;
    if (!ranges.length || !instances) continue;
    triangles += ranges.reduce((sum, range) => sum + range.count / 3, 0) * instances;
    if (triangles > maxTriangles) throw new Error("raytrace geometry budget exceeded");
    const sourceGeometry = raytraceSourceGeometry(object), attribute = sourceGeometry.attributes.position;
    const positions = new Float32Array(attribute.count * 3);
    for (let start = 0; start < attribute.count; start += 32768) {
      const end = Math.min(attribute.count, start + 32768);
      for (let i = start; i < end; i++) {
        positions[i * 3] = attribute.getX(i); positions[i * 3 + 1] = attribute.getY(i); positions[i * 3 + 2] = attribute.getZ(i);
      }
      if (now() - lastYield > 5) { await yieldTask(); lastYield = now(); if (isCancelled()) throw new Error("cancelled"); }
    }
    const indices = sourceGeometry.index ? new Uint32Array(sourceGeometry.index.array) : null;
    transfer.push(positions.buffer); if (indices) transfer.push(indices.buffer);
    bytes += positions.byteLength + (indices?.byteLength || 0);
    if (bytes > 96 * 1024 * 1024) throw new Error("raytrace snapshot memory budget exceeded");
    for (let instance = 0; instance < instances; instance++) {
      const matrix = object.isInstancedMesh ? multiplyMatrices(object.matrixWorld.elements, object.instanceMatrix.array.subarray(instance * 16, instance * 16 + 16)) : Array.from(object.matrixWorld.elements);
      meshes.push({ positions, indices, matrix, ranges });
    }
  }
  return { meshes, transfer, triangles, bytes };
}

export function createStationaryRayTracer({ onUpdate = () => {}, onState = () => {}, device = null, deviceProvider = null,
  maxPixels = 98304, maxTriangles = 1200000, targetSamples = 32, tilePixels = 16384 } = {}) {
  let gpu = device, ownsDevice = false, deviceLost = false, initialization = null, pipeline = null, geometry = null, geometryReady = false, worker = null;
  let disposed = false, serial = 0, geometryBuild = 0, active = null, busy = false, buildResolve = null;
  let surfaceBuffer = null, accumulationBuffer = null, readBuffer = null, uniformBuffer = null, pixelCapacity = 0;
  const stats = { backend: "webgpu-compute-bvh", state: "uninitialized", available: false, reason: null,
    triangles: 0, nodes: 0, buildMs: 0, geometryBytes: 0, surfaceBytes: 0, dispatches: 0, readbacks: 0,
    discardedReadbacks: 0, samples: 0, targetSamples, pixels: 0, tilePixels, gpuRoundTripMs: 0, generation: null, resets: 0 };
  function state(value, reason = null) { stats.state = value; stats.reason = reason; onState({ ...stats }); }
  function destroyBuffers() {
    for (const buffer of [surfaceBuffer, accumulationBuffer, readBuffer, uniformBuffer]) buffer?.destroy();
    surfaceBuffer = accumulationBuffer = readBuffer = uniformBuffer = null; pixelCapacity = 0;
  }
  function invalidate(reason = "changed") {
    serial++; active = null; stats.samples = 0; stats.resets++; stats.reason = reason;
    if (stats.available && stats.state !== "building") state("idle", reason);
  }
  async function initialize() {
    if (initialization) return initialization;
    initialization = (async () => {
      try {
        if (disposed) return false;
        if (!gpu) {
          if (deviceProvider) gpu = await deviceProvider();
          else {
            if (!globalThis.navigator?.gpu) { state("unsupported", "WebGPU unavailable"); return false; }
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
            if (!adapter) { state("unsupported", "No WebGPU adapter"); return false; }
            gpu = await adapter.requestDevice(); ownsDevice = true;
          }
        }
        if (!gpu || disposed) {
          if (ownsDevice) gpu?.destroy();
          if (!disposed) state("unsupported", "No WebGPU device");
          return false;
        }
        gpu.lost.then((info) => {
          if (disposed) return;
          deviceLost = true; geometryReady = false; geometryBuild++;
          worker?.terminate(); worker = null; buildResolve?.(null); buildResolve = null;
          invalidate("device-lost"); stats.available = false; state("fallback", info.message || "WebGPU device lost");
        });
        const response = await fetch(new URL("./experience-raytrace.wgsl?v=advanced-render-20260930", import.meta.url));
        if (!response.ok) throw new Error(`Raytrace shader HTTP ${response.status}`);
        const module = gpu.createShaderModule({ label: "Stationary triangle ray tracing", code: await response.text() });
        const compilation = await module.getCompilationInfo();
        const errors = compilation.messages.filter((message) => message.type === "error");
        if (errors.length) throw new Error(errors.map((error) => `${error.lineNum}: ${error.message}`).join("; "));
        pipeline = await cachedComputePipeline(gpu, "stationary-raytrace-bvh-v1", { label: "Room AO and area shadows", layout: "auto", compute: { module, entryPoint: "main" } });
        if (disposed || deviceLost) return false;
        stats.available = true; state("idle"); return true;
      } catch (error) { stats.available = false; state("fallback", error.message); return false; }
    })();
    return initialization;
  }
  const createStorage = (label, data, extraUsage = 0) => {
    const size = data.byteLength;
    if (size > gpu.limits.maxStorageBufferBindingSize || size > gpu.limits.maxBufferSize) throw new Error(`${label} exceeds WebGPU limits`);
    const buffer = gpu.createBuffer({ label, size: Math.max(4, size), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | extraUsage });
    gpu.queue.writeBuffer(buffer, 0, data); return buffer;
  };
  async function setGeometry(scene, { exclude = [], generation = 0 } = {}) {
    const build = ++geometryBuild;
    geometryReady = false;
    invalidate("geometry");
    worker?.terminate(); worker = null; buildResolve?.(null); buildResolve = null;
    if (!await initialize() || disposed || build !== geometryBuild) return false;
    state("building");
    const started = now();
    try {
      const snapshot = await snapshotRaytraceGeometry(scene, { exclude, maxTriangles, isCancelled: () => disposed || build !== geometryBuild });
      if (disposed || build !== geometryBuild) return false;
      worker = new Worker(new URL("./experience-raytrace-worker.js?v=advanced-render-20260930", import.meta.url), { type: "module", name: "stationary-raytrace-bvh" });
      const result = await new Promise((resolve, reject) => {
        buildResolve = resolve;
        worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data);
        worker.onerror = (event) => reject(new Error(event.message || "Raytrace worker failed"));
        worker.postMessage({ id: build, meshes: snapshot.meshes, options: { maxTriangles } }, snapshot.transfer);
      });
      if (!result || disposed || deviceLost || build !== geometryBuild) return false;
      worker.terminate(); worker = null; buildResolve = null;
      if (result.maxDepth > 59) throw new Error("Raytrace BVH exceeds traversal depth budget");
      const triangles = createStorage("Raytrace triangles", result.triangles);
      let nodes;
      try { nodes = createStorage("Raytrace BVH", result.nodes); } catch (error) { triangles.destroy(); throw error; }
      geometry?.triangles.destroy(); geometry?.nodes.destroy();
      geometry = { triangles, nodes, generation }; geometryReady = true;
      Object.assign(stats, { triangles: result.triangleCount, nodes: result.nodeCount, buildMs: now() - started,
        geometryBytes: result.triangles.byteLength + result.nodes.byteLength, generation });
      state("ready"); return true;
    } catch (error) {
      if (build !== geometryBuild || disposed) return false;
      worker?.terminate(); worker = null; buildResolve = null;
      state("fallback", error.message); return false;
    }
  }
  function begin({ width, height, normalDepth, inverseProjection, cameraWorld, lights = [], aoRadius = 0.12, bias = 0.0007,
    generation = geometry?.generation, samples = targetSamples, attention = null } = {}) {
    invalidate("capture");
    if (!stats.available || !geometryReady || !geometry || disposed || busy || generation !== geometry.generation) return false;
    const pixels = width * height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || pixels < 1 || pixels > maxPixels || normalDepth?.length !== pixels * 4 || inverseProjection?.length !== 16 || cameraWorld?.length !== 16) return false;
    try {
      if (pixelCapacity !== pixels) {
        destroyBuffers(); pixelCapacity = pixels;
        surfaceBuffer = createStorage("Raytrace normal and linear depth", normalDepth);
        accumulationBuffer = gpu.createBuffer({ label: "Progressive AO and shadow sums", size: pixels * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST });
        readBuffer = gpu.createBuffer({ label: "Bounded raytrace readback", size: pixels * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        uniformBuffer = gpu.createBuffer({ label: "Raytrace camera and light parameters", size: 416, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
      } else gpu.queue.writeBuffer(surfaceBuffer, 0, normalDepth);
      const uniforms = new ArrayBuffer(416), floats = new Float32Array(uniforms), ints = new Uint32Array(uniforms);
      floats.set(inverseProjection, 0); floats.set(cameraWorld, 16);
      ints[32] = width; ints[33] = height;
      floats[36] = Math.max(0.005, aoRadius); floats[37] = Math.max(0.0001, bias);
      const selectedLights = lights.filter((light) => (light.position?.length === 3 || light.type === "directional" && light.direction?.length === 3) && (light.weight ?? 1) > 0).slice(0, 4);
      const weight = selectedLights.reduce((sum, light) => sum + (light.weight ?? 1), 0);
      floats[38] = selectedLights.length;
      selectedLights.forEach((light, index) => {
        const offset = 40 + index * 16;
        floats.set(light.position || [0, 0, 0], offset); floats[offset + 3] = (light.weight ?? 1) / weight;
        floats.set(light.edgeU || [0.03, 0, 0], offset + 4); floats.set(light.edgeV || [0, 0, 0.03], offset + 8);
        floats.set(light.direction || [0, -1, 0], offset + 12); floats[offset + 15] = light.coneCos ?? -1;
        if (light.type === "directional") {
          floats[offset + 7] = 1; floats[offset + 11] = Math.tan(Math.max(0, Math.min(0.25, light.angularRadius ?? 0.025)));
          floats[offset + 15] = -1;
        }
      });
      const bindGroup = gpu.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [geometry.triangles, geometry.nodes, surfaceBuffer, accumulationBuffer, uniformBuffer].map((buffer, binding) => ({ binding, resource: { buffer } })) });
      active = { token: serial, width, height, pixels, normalDepth, uniforms, floats, ints, bindGroup, sample: 0,
        tile: 0, tileSize: Math.max(2048, Math.min(32768, stats.tilePixels)), sweepMaxMs: 0, tileOrder: null,
        attention: attention && Number.isFinite(attention.y) ? { x: Math.max(0, Math.min(1, attention.x ?? 0.5)), y: Math.max(0, Math.min(1, attention.y)), radius: Math.max(0.01, attention.radius ?? 0.2) } : null,
        generation, target: Math.max(1, Math.min(64, samples)) };
      Object.assign(stats, { pixels, samples: 0, targetSamples: active.target, surfaceBytes: pixels * 48, generation });
      state("accumulating"); return true;
    } catch (error) { state("fallback", error.message); return false; }
  }
  async function step() {
    const frame = active;
    if (busy || !frame || disposed || !stats.available || frame.sample >= frame.target) return false;
    busy = true;
    const started = now();
    try {
      const tileCount = Math.ceil(frame.pixels / frame.tileSize);
      // Alternating center-out strips prioritize the subject, then cover every
      // pixel once before advancing the sample index; no pixel is starved.
      const center = Math.floor((tileCount - 1) / 2);
      if (frame.tile === 0 && frame.attention) {
        const score = (tile) => {
          const start = tile * frame.tileSize, end = Math.min(frame.pixels, start + frame.tileSize) - 1;
          const lowY = Math.floor(start / frame.width) / frame.height, highY = (Math.floor(end / frame.width) + 1) / frame.height;
          const dy = Math.max(lowY - frame.attention.y, frame.attention.y - highY, 0);
          const sameRow = Math.floor(start / frame.width) === Math.floor(end / frame.width);
          const dx = sameRow ? Math.max((start % frame.width) / frame.width - frame.attention.x, frame.attention.x - ((end % frame.width) + 1) / frame.width, 0) : 0;
          const distance = Math.hypot(dx, dy);
          return (distance > frame.attention.radius ? 2 : 0) + distance + Math.abs((lowY + highY) / 2 - frame.attention.y) * 0.01;
        };
        frame.tileOrder = Array.from({ length: tileCount }, (_, index) => index).sort((a, b) => score(a) - score(b));
      }
      const tileIndex = frame.tileOrder ? frame.tileOrder[frame.tile] : frame.tile === 0 ? center : frame.tile % 2 ? center + (frame.tile + 1) / 2 : center - frame.tile / 2;
      const offset = tileIndex * frame.tileSize;
      const count = Math.min(frame.tileSize, frame.pixels - offset);
      frame.ints[34] = frame.sample; frame.ints[35] = offset; frame.floats[39] = count;
      gpu.queue.writeBuffer(uniformBuffer, 0, frame.uniforms);
      const encoder = gpu.createCommandEncoder({ label: "Bounded stationary raytrace tile" });
      if (frame.sample === 0 && frame.tile === 0) encoder.clearBuffer(accumulationBuffer);
      const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, frame.bindGroup);
      pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end();
      const completedSweep = frame.tile + 1 === tileCount;
      const completedSamples = frame.sample + 1;
      // One early ROI publication makes attention priority visible. Unvisited
      // pixels retain count zero and are rejected by the material lookup.
      const partial = !!frame.attention && frame.sample === 0 && frame.tile === 0 && !completedSweep;
      const publish = partial || completedSweep && ([1, 2, 4, 8, 16, 32, 64].includes(completedSamples) || completedSamples === frame.target);
      if (publish) encoder.copyBufferToBuffer(accumulationBuffer, 0, readBuffer, 0, frame.pixels * 16);
      gpu.queue.submit([encoder.finish()]); stats.dispatches++;
      if (publish) {
        await readBuffer.mapAsync(GPUMapMode.READ);
        if (frame.token !== serial || disposed) { readBuffer.unmap(); stats.discardedReadbacks++; return false; }
        const data = new Float32Array(readBuffer.getMappedRange()).slice(); readBuffer.unmap();
        for (let i = 0; i < data.length; i += 4) {
          const pixelSamples = data[i + 3];
          data[i] = pixelSamples > 0 ? data[i] / pixelSamples : 1;
          data[i + 1] = pixelSamples > 0 ? data[i + 1] / pixelSamples : 1;
        }
        stats.readbacks++;
        onUpdate({ data, width: frame.width, height: frame.height, normalDepth: frame.normalDepth, samples: completedSamples, partial, generation: frame.generation });
      } else await gpu.queue.onSubmittedWorkDone();
      if (frame.token !== serial || disposed) return false;
      stats.gpuRoundTripMs = now() - started;
      frame.sweepMaxMs = Math.max(frame.sweepMaxMs, stats.gpuRoundTripMs);
      frame.tile++;
      if (completedSweep) {
        frame.sample++; frame.tile = 0; stats.samples = frame.sample;
        // Adapt only at sweep boundaries so changing tile sizes cannot skip or
        // double-count pixels. This is queue round-trip, not GPU timer data.
        if (frame.sweepMaxMs > 12) frame.tileSize = Math.max(2048, Math.floor(frame.tileSize / 2));
        else if (frame.sweepMaxMs < 3) frame.tileSize = Math.min(32768, frame.tileSize * 2);
        frame.sweepMaxMs = 0;
        stats.tilePixels = frame.tileSize;
        if (frame.sample >= frame.target) state("converged");
      }
      return true;
    } catch (error) { if (!disposed) { invalidate("compute-error"); state("fallback", error.message); } return false; }
    finally { busy = false; }
  }
  function dispose() {
    disposed = true; invalidate("disposed"); geometryBuild++; worker?.terminate(); buildResolve?.(null);
    destroyBuffers(); geometry?.triangles.destroy(); geometry?.nodes.destroy(); geometry = null;
    if (ownsDevice) gpu?.destroy(); stats.available = false; stats.state = "disposed";
  }
  return { initialize, setGeometry, begin, step, invalidate, dispose, get stats() { return { ...stats, busy, hasGeometry: geometryReady && !!geometry, active: !!active }; } };
}
