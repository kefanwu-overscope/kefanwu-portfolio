// Signed steering is evaluated from the source bind pose, never by mirroring
// pixels or reversing the old one-sided sample sequence. Coordinates remain
// in the manifest's Blender Z-up space; the inspector owns world orientation.
export const STEERING_DURATION = 14;
// The supplied forks are not an exactly phased manufacturing assembly. This
// nominal phase was checked against their unchanged triangles: no new contact
// pairs or deeper upper-yoke overlap in 433 poses. Existing internal fits still
// vary slightly. This is not a measured trunnion phase; the source omits the
// cross pins and internal rack teeth.
export const STEERING_CARDAN_PHASE = 49.6 * Math.PI / 180;
// Continuous vertex extrema of the current packed steering geometry across
// the full signed angular ranges, rounded outward. Its original manifest only
// frames the negative stroke; both initial and full controllers use this box.
export const STEERING_MOTION_BOUNDS = Object.freeze({
  min: Object.freeze([-1.50001, -1.38759, .03499]),
  max: Object.freeze([1.4875, 1.44277, 3.04392]),
});
export const STEERING_PHASES = Object.freeze([
  { start: 0, end: .08, from: 0, to: 0 },
  { start: .08, end: .22, from: 0, to: -90 },
  { start: .22, end: .32, from: -90, to: -90 },
  { start: .32, end: .46, from: -90, to: 0 },
  { start: .46, end: .54, from: 0, to: 0 },
  { start: .54, end: .68, from: 0, to: 90 },
  { start: .68, end: .78, from: 90, to: 90 },
  { start: .78, end: .94, from: 90, to: 0 },
  { start: .94, end: 1, from: 0, to: 0 },
].map(Object.freeze));

const ROTATING_GROUPS = ['wheel_and_upper_shaft', 'middle_shaft_and_yokes', 'lower_shaft_and_yoke'];
const RACK_GROUP = 'rack_and_tie_rod_ends';
const clamp = value => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));
const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cardan = (angle, bend) => Math.atan2(Math.sin(angle), bend * Math.cos(angle));

export function steeringShaftAngles(wheel, bends) {
  if (wheel === 0) return [0, 0, 0];
  const rawMiddle = cardan(wheel + STEERING_CARDAN_PHASE, bends[0]) - cardan(STEERING_CARDAN_PHASE, bends[0]);
  const middle = Math.atan2(Math.sin(rawMiddle), Math.cos(rawMiddle));
  return [wheel, middle, cardan(middle, bends[1])];
}

export function steeringWheelRadians(value) {
  const progress = clamp(value);
  const phase = STEERING_PHASES.find(item => progress <= item.end) || STEERING_PHASES.at(-1);
  const t = clamp((progress - phase.start) / (phase.end - phase.start));
  const ease = t * t * (3 - 2 * t);
  return (phase.from + (phase.to - phase.from) * ease) * Math.PI / 180;
}

function rotate(point, quaternion) {
  const [x, y, z] = point, [qx, qy, qz, qw] = quaternion;
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  return [x + qw * tx + qy * tz - qz * ty,
    y + qw * ty + qz * tx - qx * tz, z + qw * tz + qx * ty - qy * tx];
}

function multiply(left, right) {
  const [x, y, z, w] = left, [a, b, c, d] = right;
  return [x * d + w * a + y * c - z * b, y * d + w * b + z * a - x * c,
    z * d + w * c + x * b - y * a, w * d - x * a - y * b - z * c];
}

export function createSteeringMotion({ manifest, nodes }) {
  const report = manifest.source?.motionReport;
  if (manifest.project !== 'steering' || manifest.coordinates !== 'blender-z-up' ||
      report?.shaftAxes?.length !== 3 || !report.groups) throw new Error('Steering source axes are unavailable.');
  const axes = report.shaftAxes.map(({ point, direction }) => {
    if (!vector(point) || !vector(direction) || Math.hypot(...direction) < 1e-8) {
      throw new Error('Steering source axis is invalid.');
    }
    const length = Math.hypot(...direction);
    return { point, direction: direction.map(value => value / length) };
  });
  // Retain the source controller's stored-axis dot products, including its
  // float32 rounding, so the clearance verifier and browser use one relation.
  const directions = report.shaftAxes.map(axis => axis.direction);
  const bends = [dot(directions[0], directions[1]), dot(directions[1], directions[2])];
  if (bends.some(value => value <= 0)) throw new Error('Steering source bend is unsupported.');
  const rackAmplitude = Math.max(...(report.rackRange || []).map(Math.abs));
  if (!Number.isFinite(rackAmplitude) || rackAmplitude <= 0) throw new Error('Steering source rack stroke is unavailable.');
  // One fixed illustrative conversion in both directions. Bound it by the
  // already used source travel; the unequal output shaft excursions must not
  // silently extend the rack beyond that range or use two different ratios.
  const lowerLimit = Math.max(...[-Math.PI / 2, Math.PI / 2].map(wheel => Math.abs(steeringShaftAngles(wheel, bends)[2])));
  const membership = new Map();
  for (const group of [...ROTATING_GROUPS, RACK_GROUP]) {
    if (!report.groups[group]?.length) throw new Error(`Steering group is unavailable: ${group}`);
    for (const name of report.groups[group]) {
      if (membership.has(name)) throw new Error('Steering source has conflicting component groups.');
      membership.set(name, group);
    }
  }
  const seen = new Map(), bindings = [];
  for (let index = 0; index < manifest.nodes.length; index++) {
    const source = manifest.nodes[index], object = nodes[index], group = membership.get(source.name);
    if (!group) continue;
    if (!object) throw new Error(`Steering component is unavailable: ${source.name}`);
    membership.delete(source.name);
    if (seen.has(object)) {
      if (seen.get(object) !== group) throw new Error('Steering components were batched across different axes.');
      continue;
    }
    seen.set(object, group);
    const transform = source.transform || {};
    bindings.push({ object, group, position: [...(transform.position || [0, 0, 0])],
      quaternion: [...(transform.quaternion || [0, 0, 0, 1])], scale: [...(transform.scale || [1, 1, 1])] });
    object.frustumCulled = false;
  }
  if (membership.size) throw new Error('Steering source component inventory changed.');
  let lastProgress = null, pose = null;

  function seek(value) {
    const progress = clamp(value);
    if (progress === lastProgress) return progress;
    lastProgress = progress;
    const wheel = steeringWheelRadians(progress);
    const [, middle, lower] = steeringShaftAngles(wheel, bends);
    const rack = rackAmplitude * lower / lowerLimit;
    pose = { progress, wheelRadians: wheel, middleRadians: middle, lowerRadians: lower, rack };
    const rotations = [wheel, middle, lower].map((angle, index) => {
      const sine = Math.sin(angle / 2);
      return [...axes[index].direction.map(value => value * sine), Math.cos(angle / 2)];
    });
    for (const binding of bindings) {
      const { object, group, position, quaternion, scale } = binding;
      if (object.userData?.presentationHidden) continue;
      if (wheel === 0) {
        // All three neutral dwells and both endpoints restore exact binds.
        object.position.fromArray(position); object.quaternion.fromArray(quaternion);
      } else if (group === RACK_GROUP) {
        object.position.fromArray([position[0] + rack, position[1], position[2]]);
        object.quaternion.fromArray(quaternion);
      } else {
        const index = ROTATING_GROUPS.indexOf(group), axis = axes[index], rotation = rotations[index];
        const shifted = position.map((value, component) => value - axis.point[component]);
        object.position.fromArray(rotate(shifted, rotation).map((value, component) => value + axis.point[component]));
        object.quaternion.fromArray(multiply(rotation, quaternion));
      }
      object.scale.fromArray(scale);
      object.updateMatrix();
    }
    return progress;
  }

  return { seek, buffers: new Set(), duration: STEERING_DURATION, bounds: STEERING_MOTION_BOUNDS, get pose() { return pose; } };
}
