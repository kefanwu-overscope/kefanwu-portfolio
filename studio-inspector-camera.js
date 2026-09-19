// Source orientation is held constant; fit the complete motion envelope once.
// Vector inputs use the small Vector3 API, keeping this math testable without
// a renderer or a browser.
export function fitCameraEnvelope({ bounds, position, target, up, sourceAspect = 1.5, aspect = 1.5, fov = 38, orthoScale = 0, padding = 1.06 }) {
  const forward = target.clone().sub(position).normalize();
  const right = forward.clone().cross(up).normalize();
  const cameraUp = right.clone().cross(forward).normalize();
  let horizontal = 0;
  let vertical = 0;
  let distance = position.distanceTo(target);
  const tangentV = Math.tan(fov * Math.PI / 360);
  const tangentH = tangentV * aspect;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const delta = target.clone().set(x, y, z).sub(target);
    const projectedX = Math.abs(delta.dot(right));
    const projectedY = Math.abs(delta.dot(cameraUp));
    horizontal = Math.max(horizontal, projectedX);
    vertical = Math.max(vertical, projectedY);
    distance = Math.max(distance, -delta.dot(forward) + padding * Math.max(projectedX / tangentH, projectedY / tangentV));
  }
  return { frameWidth: Math.max(orthoScale, horizontal * 2 * padding, vertical * sourceAspect * 2 * padding), distance, forward };
}
