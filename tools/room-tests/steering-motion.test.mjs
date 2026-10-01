import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { createSteeringMotion, steeringWheelRadians, steeringShaftAngles, STEERING_DURATION, STEERING_PHASES, STEERING_CARDAN_PHASE, STEERING_MOTION_BOUNDS } from '../../studio-steering-motion.js';
import { createSampledMotion } from '../../studio-motion-runtime.js';

const catalog = JSON.parse(await readFile(new URL('../../assets/studio-motion/index.json', import.meta.url), 'utf8'));
const manifestURL = new URL(`../../assets/studio-motion/${catalog.projects.steering.manifest}`, import.meta.url);
const manifest = JSON.parse(await readFile(manifestURL, 'utf8'));
const report = manifest.source.motionReport;
const near = (actual, expected, tolerance = 1e-10) => assert(Math.abs(actual - expected) <= tolerance,
  `${actual} differs from ${expected} by more than ${tolerance}`);
const nearArray = (actual, expected, tolerance) => actual.forEach((value, index) => near(value, expected[index], tolerance));
const vector = values => ({ values: [...values], fromArray(array) { this.values = Array.from(array).slice(0, values.length); return this; } });
function makeNodes(source = manifest) {
  return source.nodes.map(node => ({
    position: vector(node.transform.position), quaternion: vector(node.transform.quaternion), scale: vector(node.transform.scale),
    visible: node.visible, userData: {}, matrixUpdates: 0, geometry: { source: node.geometry },
    updateMatrix() { this.matrixUpdates++; },
  }));
}
const snapshot = nodes => nodes.map(node => [node.position.values, node.quaternion.values, node.scale.values, node.visible]);
function rotate(v, q) {
  // Independent quaternion product q * [v,0] * q^-1, used only as an oracle.
  const multiply = ([a, b, c, d], [e, f, g, h]) => [d * e + a * h + b * g - c * f,
    d * f - a * g + b * h + c * e, d * g + a * f - b * e + c * h, d * h - a * e - b * f - c * g];
  return multiply(multiply(q, [...v, 0]), [-q[0], -q[1], -q[2], q[3]]).slice(0, 3);
}
function pointAt(node, value) {
  return rotate(value, node.quaternion.values).map((value, index) => value + node.position.values[index]);
}

test('Signed 14-second cycle holds neutral, negative extreme, neutral, positive extreme and neutral', () => {
  assert.equal(STEERING_DURATION, 14);
  for (const p of [0, .04, .08, .46, .5, .54, .94, .98, 1]) assert.equal(steeringWheelRadians(p), 0);
  for (const p of [.22, .27, .32]) assert.equal(steeringWheelRadians(p), -Math.PI / 2);
  for (const p of [.68, .73, .78]) assert.equal(steeringWheelRadians(p), Math.PI / 2);
  assert(steeringWheelRadians(.15) < 0); assert(steeringWheelRadians(.61) > 0);
  for (let index = 0; index <= 1000; index++) assert(Math.abs(steeringWheelRadians(index / 1000)) <= Math.PI / 2);
  for (const phase of STEERING_PHASES) {
    const delta = 1e-7;
    near(steeringWheelRadians(phase.start - delta), steeringWheelRadians(phase.start + delta), 1e-10);
    near(steeringWheelRadians(phase.end - delta), steeringWheelRadians(phase.end + delta), 1e-10);
  }
});

test('Both directions rotate about the three source shaft centerlines and keep fixed parts unchanged', () => {
  const nodes = makeNodes(), motion = createSteeringMotion({ manifest, nodes }), original = snapshot(nodes);
  const groups = ['wheel_and_upper_shaft', 'middle_shaft_and_yokes', 'lower_shaft_and_yoke'];
  for (const progress of [.12, .22, .4, .6, .7, .88]) {
    motion.seek(progress);
    for (let axisIndex = 0; axisIndex < groups.length; axisIndex++) {
      const axis = report.shaftAxes[axisIndex], node = nodes[manifest.nodes.findIndex(node => node.group === groups[axisIndex])];
      for (const distance of [-1, 0, 1]) {
        const point = axis.point.map((value, index) => value + distance * axis.direction[index]);
        nearArray(pointAt(node, point), point, 1e-12);
      }
      near(Math.hypot(...node.quaternion.values), 1, 1e-12);
    }
    for (let index = 0; index < nodes.length; index++) if (manifest.nodes[index].group === 'fixed_frame') {
      assert.deepEqual(snapshot(nodes)[index], original[index]); assert.equal(nodes[index].matrixUpdates, 0);
    }
  }
});

test('Rack and tie-rod ends move together along their source guide in genuinely opposite directions', () => {
  const nodes = makeNodes(), motion = createSteeringMotion({ manifest, nodes });
  let ratio;
  for (const [progress, sign] of [[.27, -1], [.73, 1], [.5, 0], [1, 0]]) {
    motion.seek(progress);
    const expected = motion.pose.rack;
    assert.equal(Math.sign(expected), sign); assert(Math.abs(expected) <= .1);
    if (progress === .27) { near(expected, -.1); ratio = expected / motion.pose.lowerRadians; }
    else if (progress === .73) near(expected / motion.pose.lowerRadians, ratio);
    for (let index = 0; index < nodes.length; index++) if (manifest.nodes[index].group === 'rack_and_tie_rod_ends') {
      nearArray(nodes[index].position.values, [expected, 0, 0]);
      assert.deepEqual(nodes[index].quaternion.values, manifest.nodes[index].transform.quaternion);
    }
  }
});

test('Both Cardan relations preserve their configured phase and remain continuous through the bilateral range', () => {
  const bend = Math.cos(27.5 * Math.PI / 180), neutral = Math.atan2(Math.sin(STEERING_CARDAN_PHASE), bend * Math.cos(STEERING_CARDAN_PHASE));
  let previous;
  for (let degree = -90; degree <= 90; degree += .25) {
    const wheel = degree * Math.PI / 180, [input, middle, lower] = steeringShaftAngles(wheel, [bend, bend]);
    near(input, wheel);
    // Cross-multiplied constraints avoid tan's singularities at 90 degrees.
    near(Math.sin(middle + neutral) * bend * Math.cos(wheel + STEERING_CARDAN_PHASE),
      Math.cos(middle + neutral) * Math.sin(wheel + STEERING_CARDAN_PHASE));
    near(Math.sin(lower) * bend * Math.cos(middle), Math.cos(lower) * Math.sin(middle));
    if (previous) { assert(middle > previous[0]); assert(lower > previous[1]); assert(lower - previous[1] < .01); }
    previous = [middle, lower];
  }
  assert.deepEqual(steeringShaftAngles(0, [bend, bend]), [0, 0, 0]);
});

test('Forward, reverse and arbitrary seek order never drifts; all neutral dwells exactly restore source binds', () => {
  const nodes = makeNodes(), motion = createSteeringMotion({ manifest, nodes });
  const original = snapshot(nodes), source = JSON.stringify(manifest), geometries = nodes.map(node => node.geometry);
  const progress = Array.from({ length: 121 }, (_, index) => index / 120);
  const poses = progress.map(value => { motion.seek(value); return snapshot(nodes); });
  for (const index of [...progress.keys()].reverse()) {
    motion.seek(progress[index]); assert.deepEqual(snapshot(nodes), poses[index]);
  }
  let seed = 913;
  for (let count = 0; count < 200; count++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const index = seed % progress.length;
    motion.seek(progress[index]); assert.deepEqual(snapshot(nodes), poses[index]);
  }
  for (const value of [0, .04, .5, .96, 1]) { motion.seek(value); assert.deepEqual(snapshot(nodes), original); }
  assert.equal(JSON.stringify(manifest), source);
  nodes.forEach((node, index) => assert.equal(node.geometry, geometries[index]));
});

test('Rigid batching updates one shared object once and rejects batches across moving axes', () => {
  const nodes = makeNodes(), indices = manifest.nodes.flatMap((node, index) => node.group === 'middle_shaft_and_yokes' ? [index] : []);
  for (const index of indices.slice(1)) nodes[index] = nodes[indices[0]];
  const motion = createSteeringMotion({ manifest, nodes });
  motion.seek(.7);
  assert.equal(nodes[indices[0]].matrixUpdates, 1);
  const wheelIndex = manifest.nodes.findIndex(node => node.group === 'wheel_and_upper_shaft');
  nodes[wheelIndex] = nodes[indices[0]];
  assert.throws(() => createSteeringMotion({ manifest, nodes }), /batched across different axes/);
});

test('General source binds are pre-multiplied around the source axis and recover exactly', () => {
  const source = structuredClone(manifest), index = source.nodes.findIndex(node => node.group === 'wheel_and_upper_shaft');
  source.nodes[index].transform = { position: [.2, -.4, .7], quaternion: [0, 0, Math.sin(.2), Math.cos(.2)], scale: [1, 2, 3] };
  const nodes = makeNodes(source), motion = createSteeringMotion({ manifest: source, nodes }), original = snapshot(nodes);
  motion.seek(.27);
  const axis = report.shaftAxes[0], length = Math.hypot(...axis.direction), angle = -Math.PI / 2;
  const q = [...axis.direction.map(value => value / length * Math.sin(angle / 2)), Math.cos(angle / 2)];
  const expected = rotate(original[index][0].map((value, component) => value - axis.point[component]), q)
    .map((value, component) => value + axis.point[component]);
  nearArray(nodes[index].position.values, expected);
  assert.deepEqual(nodes[index].scale.values, [1, 2, 3]);
  motion.seek(1); assert.deepEqual(snapshot(nodes), original);
});

test('Invalid input clamps to neutral and a changed source inventory fails explicitly', () => {
  for (const value of [-1, 2, NaN, Infinity, undefined]) assert.equal(steeringWheelRadians(value), 0);
  const source = structuredClone(manifest); source.nodes.splice(source.nodes.findIndex(node => node.group === 'wheel_and_upper_shaft'), 1);
  assert.throws(() => createSteeringMotion({ manifest: source, nodes: makeNodes(source) }), /inventory changed/);
});

test('First-pose bootstrap retains the original sampled decoder and exact source neutral', async () => {
  const bytes = gunzipSync(await readFile(new URL(manifest.buffers.initialMotion.url, manifestURL)));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const nodes = makeNodes(), original = snapshot(nodes);
  const initial = createSampledMotion({ manifest, buffer, nodes, materials: [], initial: true });
  initial.seek(0); assert.deepEqual(snapshot(nodes), original);
  assert.deepEqual(initial.bounds, STEERING_MOTION_BOUNDS);
  const full = createSampledMotion({ manifest, buffer, nodes, materials: [] });
  full.seek(0); assert.deepEqual(snapshot(nodes), original);
  assert.deepEqual(full.bounds, initial.bounds); assert.equal(full.duration, 14);
  full.seek(.73); assert.equal(full.pose.wheelRadians, Math.PI / 2);
});

test('Other project controllers keep the original absolute sample interpolation and duration', () => {
  const values = new Float32Array([0, 0, 0, 1, 2, 3]);
  const source = { project: 'scanner', sampleCount: 2, duration: 8, nodes: [{ tracks: {
    position: { count: 2, itemSize: 3, componentType: 'float32' },
  } }] };
  const node = { position: vector([0,0,0]), userData: {}, updateMatrix() {} };
  const motion = createSampledMotion({ manifest: source, buffer: values.buffer, nodes: [node], materials: [] });
  motion.seek(.5); nearArray(node.position.values, [.5, 1, 1.5]); assert.equal(motion.duration, 8);
  assert.equal(motion.bounds, undefined);
});
