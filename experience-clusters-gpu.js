// The WebGL draw renderer cannot consume a WebGPU indirect buffer. This compute
// pass classifies cluster bounds and projected error; CPU submission compacts
// the resulting hierarchy cut into each existing material's index buffer.
import { cachedComputePipeline } from './experience-gpu-device.js?v=advanced-render-20260930';
export const CLUSTER_CULL_WGSL = /* wgsl */`
struct Node { sphere: vec4<f32>, lod: vec4<f32> }
struct Frame {
  planes: array<vec4<f32>, 6>,
  viewProjection: mat4x4<f32>,
  camera: vec4<f32>,
  forward: vec4<f32>,
  attention: vec4<f32>
}
@group(0) @binding(0) var<storage, read> nodes: array<Node>;
@group(0) @binding(1) var<uniform> frame: Frame;
@group(0) @binding(2) var<storage, read_write> output: array<u32>;
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) invocation: vec3<u32>) {
  let id = invocation.x;
  if (id >= u32(frame.attention.w)) { return; }
  let node = nodes[id];
  let depth = dot(node.sphere.xyz - frame.camera.xyz, frame.forward.xyz);
  let guard = 0.001 + max(0.0, depth + node.sphere.w) / max(1.0, frame.camera.w) * 1.5;
  for (var p = 0u; p < 6u; p++) {
    if (dot(frame.planes[p].xyz, node.sphere.xyz) + frame.planes[p].w < -node.sphere.w - guard) {
      output[id] = 0u; return;
    }
  }
  if (node.lod.z < 0.5) { output[id] = 1u; return; }
  let errorPixels = node.lod.x * frame.camera.w / max(frame.forward.w, depth - node.sphere.w);
  let clip = frame.viewProjection * vec4<f32>(node.sphere.xyz, 1.0);
  let radial = length(clip.xy / max(0.0001, clip.w) - frame.attention.xy);
  let attention = mix(0.62, 1.6, smoothstep(0.15, 1.0, radial));
  let hysteresis = select(0.9, 1.12, node.lod.w > 0.0);
  let threshold = frame.attention.z * attention * node.lod.y * hysteresis;
  output[id] = select(1u, 2u, errorPixels <= threshold);
}`;

export async function createClusterGpuCuller(device) {
  if (!device) return null;
  const shader = device.createShaderModule({ label: 'cluster-frustum-and-error', code: CLUSTER_CULL_WGSL });
  const info = await shader.getCompilationInfo();
  const errors = info.messages.filter(m => m.type === 'error');
  if (errors.length) throw Error(errors.map(m => m.message).join('; '));
  const pipeline = await cachedComputePipeline(device, 'cluster-frustum-and-error-v2', { label: 'cluster-frustum-and-error', layout: 'auto',
    compute: { module: shader, entryPoint: 'main' } });
  let capacity = 0, nodes, frame, output, readback, bindGroup, busy = false, disposed = false;
  const stats = { dispatches: 0, readbacks: 0, classified: 0, readbackMs: 0 };
  function buffers(count) {
    if (count <= capacity) return;
    for (const buffer of [nodes, frame, output, readback]) buffer?.destroy();
    capacity = Math.max(64, 2 ** Math.ceil(Math.log2(count)));
    nodes = device.createBuffer({ label: 'cluster-spheres', size: capacity * 32, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    frame = device.createBuffer({ label: 'cluster-frame', size: 208, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    output = device.createBuffer({ label: 'cluster-classifications', size: capacity * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    readback = device.createBuffer({ label: 'cluster-async-readback', size: capacity * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    bindGroup = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [
      { binding: 0, resource: { buffer: nodes } }, { binding: 1, resource: { buffer: frame } },
      { binding: 2, resource: { buffer: output } } ] });
  }
  return {
    stats,
    get busy() { return busy; },
    async classify(nodeData, frameData) {
      if (busy || disposed || !nodeData.length) return null;
      busy = true; const started = performance.now();
      try {
        const count = nodeData.length / 8; buffers(count);
        device.queue.writeBuffer(nodes, 0, nodeData); device.queue.writeBuffer(frame, 0, frameData);
        const encoder = device.createCommandEncoder({ label: 'cluster-classify' });
        const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
        pass.dispatchWorkgroups(Math.ceil(count / 64)); pass.end();
        encoder.copyBufferToBuffer(output, 0, readback, 0, count * 4);
        device.queue.submit([encoder.finish()]); stats.dispatches++; stats.classified += count;
        await readback.mapAsync(GPUMapMode.READ, 0, count * 4);
        const result = new Uint32Array(readback.getMappedRange(0, count * 4).slice(0));
        readback.unmap(); stats.readbacks++; stats.readbackMs = performance.now() - started;
        return result;
      } finally {
        busy = false;
        if (disposed) for (const buffer of [nodes, frame, output, readback]) buffer?.destroy();
      }
    },
    dispose() {
      disposed = true;
      if (!busy) for (const buffer of [nodes, frame, output, readback]) buffer?.destroy();
    },
  };
}
