import { buildRaytraceBVH } from "./experience-raytrace-bvh.js?v=advanced-render-20260930";
self.onmessage = ({ data }) => {
  try {
    const result = buildRaytraceBVH(data.meshes, data.options);
    self.postMessage({ id: data.id, ...result }, [result.triangles.buffer, result.nodes]);
  } catch (error) { self.postMessage({ id: data.id, error: error.message }); }
};
