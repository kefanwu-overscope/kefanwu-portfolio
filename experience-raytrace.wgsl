// Portable WebGPU compute ray tracing. This does not request hardware RT cores.
struct Triangle { a: vec4f, edge1: vec4f, edge2: vec4f }
struct Node { lower: vec3f, first: u32, upper: vec3f, count: u32 }
struct AreaLight { position: vec4f, edgeU: vec4f, edgeV: vec4f, direction: vec4f }
struct Params {
  inverseProjection: mat4x4f,
  cameraWorld: mat4x4f,
  image: vec4u, // width, height, sample, tile start
  options: vec4f, // AO radius, origin bias, light count, tile pixels
  lights: array<AreaLight, 4>,
}
@group(0) @binding(0) var<storage, read> triangles: array<Triangle>;
@group(0) @binding(1) var<storage, read> nodes: array<Node>;
@group(0) @binding(2) var<storage, read> surfaces: array<vec4f>;
@group(0) @binding(3) var<storage, read_write> accumulation: array<vec4f>;
@group(0) @binding(4) var<uniform> params: Params;

fn boundsDistance(origin: vec3f, direction: vec3f, node: Node, limit: f32) -> f32 {
  var near = 0.0;
  var far = limit;
  for (var axis = 0u; axis < 3u; axis++) {
    if (abs(direction[axis]) < 1e-12) {
      if (origin[axis] < node.lower[axis] || origin[axis] > node.upper[axis]) { return -1.0; }
    } else {
      let a = (node.lower[axis] - origin[axis]) / direction[axis];
      let b = (node.upper[axis] - origin[axis]) / direction[axis];
      near = max(near, min(a, b));
      far = min(far, max(a, b));
      if (near > far) { return -1.0; }
    }
  }
  return near;
}

fn triangleDistance(origin: vec3f, direction: vec3f, tri: Triangle, minDistance: f32, limit: f32) -> f32 {
  let p = cross(direction, tri.edge2.xyz);
  let det = dot(tri.edge1.xyz, p);
  // Both windings occlude, including zero-thickness wall and shelf planes.
  if (abs(det) < 1e-12) { return limit; }
  let inv = 1.0 / det;
  let s = origin - tri.a.xyz;
  let u = dot(s, p) * inv;
  if (u < 0.0 || u > 1.0) { return limit; }
  let q = cross(s, tri.edge1.xyz);
  let v = dot(direction, q) * inv;
  if (v < 0.0 || u + v > 1.0) { return limit; }
  let t = dot(tri.edge2.xyz, q) * inv;
  return select(limit, t, t > minDistance && t < limit);
}

fn trace(origin: vec3f, direction: vec3f, limit: f32, minDistance: f32, anyHit: bool) -> f32 {
  var stack: array<u32, 64>;
  var size = 1u;
  stack[0] = 0u;
  var nearest = limit;
  loop {
    if (size == 0u) { break; }
    size--;
    let node = nodes[stack[size]];
    if (boundsDistance(origin, direction, node, nearest) < 0.0) { continue; }
    if (node.count > 0u) {
      for (var i = 0u; i < node.count; i++) {
        nearest = triangleDistance(origin, direction, triangles[node.first + i], minDistance, nearest);
        if (anyHit && nearest < limit) { return nearest; }
      }
    } else {
      let left = boundsDistance(origin, direction, nodes[node.first], nearest);
      let right = boundsDistance(origin, direction, nodes[node.first + 1u], nearest);
      if (left >= 0.0 && right >= 0.0) {
        // The worker's balanced BVH depth is checked before upload (< 60).
        stack[size] = select(node.first, node.first + 1u, left < right);
        stack[size + 1u] = select(node.first + 1u, node.first, left < right);
        size += 2u;
      } else if (left >= 0.0) { stack[size] = node.first; size++; }
      else if (right >= 0.0) { stack[size] = node.first + 1u; size++; }
    }
  }
  return nearest;
}

fn hash(value: u32) -> u32 {
  var x = value;
  x = (x ^ (x >> 16u)) * 0x7feb352du;
  x = (x ^ (x >> 15u)) * 0x846ca68bu;
  return x ^ (x >> 16u);
}
fn random(seed: u32) -> f32 { return f32(hash(seed) >> 8u) * (1.0 / 16777216.0); }
fn hemisphere(normal: vec3f, u: f32, v: f32) -> vec3f {
  let helper = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(normal.y) > 0.95);
  let tangent = normalize(cross(helper, normal));
  let bitangent = cross(normal, tangent);
  let r = sqrt(u);
  let phi = 6.28318530718 * v;
  return normalize(tangent * (r * cos(phi)) + bitangent * (r * sin(phi)) + normal * sqrt(max(0.0, 1.0 - u)));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let pixel = params.image.w + id.x;
  if (id.x >= u32(params.options.w) || pixel >= params.image.x * params.image.y) { return; }
  let surface = surfaces[pixel];
  if (surface.w <= 0.0 || dot(surface.xyz, surface.xyz) < 0.1) {
    accumulation[pixel] = vec4f(f32(params.image.z + 1u), f32(params.image.z + 1u), 0.0, f32(params.image.z + 1u));
    return;
  }
  let xy = vec2f(f32(pixel % params.image.x) + 0.5, f32(pixel / params.image.x) + 0.5);
  let ndc = xy / vec2f(params.image.xy) * 2.0 - 1.0;
  let rayH = params.inverseProjection * vec4f(ndc, 1.0, 1.0);
  let viewRay = rayH.xyz / rayH.w;
  let viewPosition = viewRay * (surface.w / -viewRay.z);
  let worldPosition = (params.cameraWorld * vec4f(viewPosition, 1.0)).xyz;
  let normal = normalize(surface.xyz);
  let origin = worldPosition + normal * params.options.y;
  let seed = hash(pixel + 1u) ^ hash(params.image.z + 4389u);
  let direction = hemisphere(normal, random(seed), random(seed ^ 0xa511e9b3u));
  let hit = trace(origin, direction, params.options.x, params.options.y * 0.1, false);
  // Finite-radius ray-traced AO with a continuous contact-distance falloff.
  let ao = clamp(hit / params.options.x, 0.0, 1.0);
  var shadow = 1.0;
  let lightCount = u32(params.options.z);
  if (lightCount > 0u) {
    let selection = random(seed ^ 0x63d83595u);
    var lightIndex = lightCount - 1u;
    var cumulative = 0.0;
    for (var i = 0u; i < lightCount; i++) {
      cumulative += params.lights[i].position.w;
      if (selection < cumulative) { lightIndex = i; break; }
    }
    let light = params.lights[lightIndex];
    let position = light.position.xyz + light.edgeU.xyz * (random(seed ^ 0x9e3779b9u) * 2.0 - 1.0) + light.edgeV.xyz * (random(seed ^ 0x85157af5u) * 2.0 - 1.0);
    let delta = position - origin;
    var distance = length(delta);
    var towardLight = delta / max(distance, 1e-6);
    if (light.edgeU.w > 0.5) {
      let towardCenter = normalize(light.direction.xyz);
      let helper = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(towardCenter.y) > 0.95);
      let tangent = normalize(cross(helper, towardCenter));
      let bitangent = cross(towardCenter, tangent);
      let radius = sqrt(random(seed ^ 0x9e3779b9u)) * light.edgeV.w;
      let angle = 6.28318530718 * random(seed ^ 0x85157af5u);
      towardLight = normalize(towardCenter + tangent * (radius * cos(angle)) + bitangent * (radius * sin(angle)));
      distance = 100.0;
    }
    let incidence = max(0.0, dot(normal, towardLight));
    let inCone = light.direction.w < -0.5 || dot(-towardLight, light.direction.xyz) > light.direction.w;
    if (incidence > 0.0 && inCone && distance > params.options.y * 2.0) {
      let blocked = trace(origin, towardLight, distance - params.options.y, params.options.y * 0.1, true) < distance - params.options.y;
      shadow = select(1.0, 0.0, blocked);
    }
  }
  let previous = select(accumulation[pixel], vec4f(0.0), params.image.z == 0u);
  accumulation[pixel] = vec4f(previous.x + ao, previous.y + shadow, surface.w, f32(params.image.z + 1u));
}

// Harness uses the exact production traversal on explicit origins/directions.
@compute @workgroup_size(64)
fn testRays(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= params.image.x) { return; }
  let origin = surfaces[id.x * 2u];
  let direction = surfaces[id.x * 2u + 1u];
  let hit = trace(origin.xyz, normalize(direction.xyz), origin.w, direction.w, false);
  accumulation[id.x] = vec4f(hit, select(0.0, 1.0, hit < origin.w), 0.0, 1.0);
}
