import { buildRaytraceBVH, traceRayCPU } from "../../experience-raytrace-bvh.js";
import { createStationaryRayTracer } from "../../experience-raytrace.js";
import { identity, sphereFixture, triangleFixture, referenceRays, mockScene } from "./raytrace-fixtures.js";

export async function runRaytraceProof() {
  if (!navigator.gpu) return { status: "unsupported", reason: "navigator.gpu absent" };
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return { status: "unsupported", reason: "No adapter" };
  const device = await adapter.requestDevice();
  const errors = [];
  device.addEventListener("uncapturederror", (event) => errors.push(event.error.message));
  const code = await (await fetch(new URL("../../experience-raytrace.wgsl", import.meta.url))).text();
  const module = device.createShaderModule({ code });
  const compilation = await module.getCompilationInfo();
  if (compilation.messages.some((message) => message.type === "error")) throw new Error(compilation.messages.map((message) => message.message).join("\n"));
  const pipeline = await device.createComputePipelineAsync({ layout: "auto", compute: { module, entryPoint: "testRays" } });
  const reports = [];
  for (const [name, fixture] of [["tessellated-sphere", sphereFixture()], ["thin-double-sided-and-offscreen-triangles", triangleFixture()]]) {
    const bvh = buildRaytraceBVH([fixture]);
    const rays = referenceRays(), buffers = [];
    function upload(data, usage) {
      const buffer = device.createBuffer({ size: data.byteLength, usage: usage | GPUBufferUsage.COPY_DST });
      device.queue.writeBuffer(buffer, 0, data); buffers.push(buffer); return buffer;
    }
    const rayData = new Float32Array(rays.length * 8);
    rays.forEach((ray, i) => { rayData.set(ray.origin, i * 8); rayData[i * 8 + 3] = ray.max; rayData.set(ray.direction, i * 8 + 4); rayData[i * 8 + 7] = 0.00001; });
    const triangles = upload(bvh.triangles, GPUBufferUsage.STORAGE), nodes = upload(bvh.nodes, GPUBufferUsage.STORAGE), surfaces = upload(rayData, GPUBufferUsage.STORAGE);
    const output = device.createBuffer({ size: rays.length * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC }); buffers.push(output);
    const uniformData = new Uint32Array(104); uniformData[32] = rays.length;
    const uniform = upload(uniformData, GPUBufferUsage.UNIFORM);
    const readback = device.createBuffer({ size: rays.length * 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); buffers.push(readback);
    const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [triangles, nodes, surfaces, output, uniform].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const encoder = device.createCommandEncoder(), pass = encoder.beginComputePass();
    pass.setPipeline(pipeline); pass.setBindGroup(0, group); pass.dispatchWorkgroups(Math.ceil(rays.length / 64)); pass.end();
    encoder.copyBufferToBuffer(output, 0, readback, 0, rays.length * 16); device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const gpu = new Float32Array(readback.getMappedRange()).slice(); readback.unmap();
    let maxError = 0, hits = 0;
    const mismatches = [];
    rays.forEach((ray, i) => {
      // The uploaded float32 direction is normalized again by WGSL.
      const direction = Array.from(rayData.subarray(i * 8 + 4, i * 8 + 7));
      const length = Math.hypot(...direction);
      const cpu = traceRayCPU(bvh, Array.from(rayData.subarray(i * 8, i * 8 + 3)), direction.map((v) => v / length), ray.max);
      const error = Math.abs(gpu[i * 4] - cpu); maxError = Math.max(maxError, error);
      if (gpu[i * 4 + 1]) hits++;
      if (error > 0.0001 || !!gpu[i * 4 + 1] !== (cpu < ray.max)) mismatches.push({ ray: i, cpu, gpu: gpu[i * 4] });
    });
    reports.push({ name, rays: rays.length, triangles: bvh.triangleCount, nodes: bvh.nodeCount, maxError, hits, mismatches });
    buffers.forEach((buffer) => buffer.destroy());
  }
  const updates = [];
  const tracer = createStationaryRayTracer({ device, targetSamples: 8, maxPixels: 4096, tilePixels: 2048, onUpdate: (frame) => updates.push(frame) });
  const initialized = await tracer.initialize();
  const geometry = await tracer.setGeometry(mockScene(new Float32Array([-10, -10, -0.8, 10, -10, -0.8, 0, 10, -0.8])), { generation: 7 });
  const normalDepth = new Float32Array([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
  const capture = { width: 2, height: 2, normalDepth, inverseProjection: identity, cameraWorld: identity, generation: 7,
    aoRadius: 1, lights: [{ position: [0, 0, 1], edgeU: [0.3, 0, 0], edgeV: [0, 0.3, 0], weight: 1 }] };
  if (!initialized || !geometry || !tracer.begin(capture)) throw new Error(`Progressive initialization failed: ${JSON.stringify(tracer.stats)}`);
  while (tracer.stats.samples < 8 && tracer.stats.state === "accumulating") await tracer.step();
  const final = updates.at(-1), meanAO = final?.data.filter((_, i) => i % 4 === 0).reduce((a, b) => a + b, 0) / 4;
  const meanShadow = final?.data.filter((_, i) => i % 4 === 1).reduce((a, b) => a + b, 0) / 4;
  const progressive = { samples: tracer.stats.samples, publications: updates.map((frame) => frame.samples), meanAO, meanShadow,
    valid: final?.samples === 8 && meanAO > 0 && meanAO < 0.8 && meanShadow >= 0 && meanShadow < 0.3 };
  tracer.begin(capture);
  const oldCount = updates.length, pending = tracer.step(); tracer.invalidate("camera-test"); await pending;
  const cancellation = { publishedStaleFrame: updates.length !== oldCount, active: tracer.stats.active, discarded: tracer.stats.discardedReadbacks };
  const attentionGuide = new Float32Array(4096 * 4);
  for (let i = 0; i < attentionGuide.length; i += 4) { attentionGuide[i + 2] = attentionGuide[i + 3] = 1; }
  // GPU timing may have grown the adaptive tile after the tiny fixture. A new
  // tracer fixes 2,048 pixels so priority must produce a partial publication.
  const attentionUpdates = [];
  const attentionTracer = createStationaryRayTracer({ device, maxPixels: 4096, targetSamples: 1, tilePixels: 2048, onUpdate: (frame) => attentionUpdates.push(frame) });
  await attentionTracer.setGeometry(mockScene(new Float32Array([-10, -10, -0.8, 10, -10, -0.8, 0, 10, -0.8])), { generation: 7 });
  attentionTracer.begin({ ...capture, width: 64, height: 64, normalDepth: attentionGuide, samples: 1, attention: { x: 0.5, y: 0.95, radius: 0.15 } });
  await attentionTracer.step();
  const first = attentionUpdates[0];
  const attention = { partial: first?.partial, firstBottomCount: first?.data[3], firstTopCount: first?.data[(4095 * 4) + 3], samplesAfterFirst: attentionTracer.stats.samples };
  await attentionTracer.step(); attention.finalSamples = attentionTracer.stats.samples;
  attention.valid = attention.partial === true && attention.firstBottomCount === 0 && attention.firstTopCount === 1 && attention.samplesAfterFirst === 0 && attention.finalSamples === 1;
  attentionTracer.dispose();
  tracer.dispose(); device.destroy();
  return { status: reports.every((report) => !report.mismatches.length) && progressive.valid && !cancellation.publishedStaleFrame && attention.valid && !errors.length ? "passed" : "failed",
    backend: "actual WebGPU compute / production WGSL / worker-built world triangle BVH", reports, progressive, cancellation, attention, errors };
}
