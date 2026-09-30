export const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
export function sphereFixture(segments = 32, rings = 16) {
  const positions = [], indices = [];
  for (let y = 0; y <= rings; y++) for (let x = 0; x <= segments; x++) {
    const phi = Math.PI * y / rings, theta = 2 * Math.PI * x / segments;
    positions.push(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
  }
  for (let y = 0; y < rings; y++) for (let x = 0; x < segments; x++) {
    const a = y * (segments + 1) + x, b = a + segments + 1;
    if (y) indices.push(a, b, a + 1);
    if (y < rings - 1) indices.push(b, b + 1, a + 1);
  }
  return { positions: new Float32Array(positions), indices: new Uint32Array(indices), matrix: identity, ranges: [{ start: 0, count: indices.length }] };
}
export function triangleFixture() {
  const positions = new Float32Array([-1, -1, 0, 1, -1, 0, 0, 1, 0, 1.4, -1, 0, 1.6, -1, 0, 1.5, 1, 0]);
  return { positions, indices: null, matrix: identity, ranges: [{ start: 0, count: positions.length / 3 }] };
}
export function referenceRays() {
  const rays = [
    { origin: [0, 0, 3], direction: [0, 0, -1], max: 10 },
    { origin: [0, 0, 3], direction: [0, 1, 0], max: 10 },
    { origin: [0, 0, 0], direction: [1, 0, 0], max: 10 },
    { origin: [0, 0, 3], direction: [0, 0, -1], max: 0.5 },
    { origin: [1.5, 0, 2], direction: [0, 0, -1], max: 10 },
    { origin: [0.001, -0.2, -3], direction: [0, 0, 1], max: 10 },
    { origin: [0, 1, 3], direction: [0, 0, -1], max: 10 },
  ];
  let seed = 0x1234abcd;
  const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < 256; i++) {
    const origin = [random() * 6 - 3, random() * 6 - 3, 2 + random() * 2];
    const direction = [-origin[0] + random() * 3 - 1.5, -origin[1] + random() * 3 - 1.5, -origin[2]];
    const length = Math.hypot(...direction);
    rays.push({ origin, direction: direction.map((v) => v / length), max: i % 7 ? 10 : 1 });
  }
  return rays;
}
export function mockScene(positions) {
  const mesh = { isMesh: true, visible: true, userData: {}, matrixWorld: { elements: identity },
    material: { visible: true }, geometry: { drawRange: { start: 0, count: Infinity }, morphAttributes: {}, attributes: { position: {
      count: positions.length / 3, getX: (i) => positions[i * 3], getY: (i) => positions[i * 3 + 1], getZ: (i) => positions[i * 3 + 2],
    } } } };
  return { updateMatrixWorld() {}, traverse(callback) { callback(mesh); } };
}
