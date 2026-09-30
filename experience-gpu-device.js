// A shared optional compute device. The tested WebGL material pipeline remains
// available when WebGPU, an adapter, a required limit, or the device is lost.
let pending = null, current = null;
const listeners = new Set(), pipelines = new WeakMap();
const state = { status: 'idle', reason: null, generation: 0, pipelines: 0, cacheHits: 0 };
export function getGpuDeviceStats() { return { ...state, limits: current ? {
  maxStorageBufferBindingSize: current.limits.maxStorageBufferBindingSize,
  maxBufferSize: current.limits.maxBufferSize,
  maxComputeWorkgroupsPerDimension: current.limits.maxComputeWorkgroupsPerDimension,
} : null }; }
export function onGpuDeviceLost(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export async function getGpuDevice({ disabled = false } = {}) {
  if (disabled) return null;
  if (current) return current;
  if (pending) return pending;
  if (!globalThis.navigator?.gpu) { state.status = 'unavailable'; state.reason = 'WebGPU is not exposed'; return null; }
  state.status = 'initializing';
  pending = (async () => {
    try {
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
      if (!adapter) throw new Error('No WebGPU adapter');
      const device = await adapter.requestDevice({ label: 'Portfolio compute' });
      current = device; state.status = 'ready'; state.reason = null; state.generation++;
      device.lost.then(info => {
        if (current !== device) return;
        current = null; pending = null; state.status = 'lost'; state.reason = info.message || info.reason;
        for (const listener of listeners) listener(info);
      });
      return device;
    } catch (error) { state.status = 'unavailable'; state.reason = String(error.message || error); return null; }
  })();
  return pending;
}

export async function cachedComputePipeline(device, key, descriptor) {
  if (!pipelines.has(device)) pipelines.set(device, new Map());
  const cache = pipelines.get(device);
  if (cache.has(key)) { state.cacheHits++; return cache.get(key); }
  const result = device.createComputePipelineAsync(descriptor);
  cache.set(key, result); state.pipelines++;
  try { return await result; } catch (error) { cache.delete(key); throw error; }
}
