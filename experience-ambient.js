import * as THREE from 'three';

// Decorative time is independent of camera/refinement time. Suspension freezes
// each channel's phase, including the first frame after a long background stay.
export class AmbientClock {
  constructor(fps) { this.fps = fps; this.time = 0; this.frames = 0; this.suspend('startup'); }
  suspend(reason = 'paused') { this.active = false; this.reason = reason; this.last = null; this.next = null; }
  sample(now, enabled, reason = 'offscreen') {
    if (!enabled || !Number.isFinite(now)) { this.suspend(reason); return null; }
    this.active = true; this.reason = 'visible';
    if (this.next !== null && now + 1 < this.next) return null;
    const interval = 1000 / this.fps;
    const delta = this.last === null ? 0 : Math.min(100, Math.max(0, now - this.last));
    this.last = now;
    this.next = this.next === null ? now + interval : this.next + Math.max(1, Math.floor((now - this.next) / interval + 1e-7) + 1) * interval;
    this.time += delta; this.frames++;
    return { delta, time: this.time };
  }
  snapshot() { return { active: this.active, reason: this.reason, fps: this.fps, frames: this.frames, time: this.time }; }
}

const box = new THREE.Box3(), point = new THREE.Vector3(), world = new THREE.Vector3(), normal = new THREE.Vector3();
const clip = new THREE.Matrix4(), frustum = new THREE.Frustum();

// A bounded screen footprint, in bottom-left UV coordinates. Hierarchy, view
// frustum and display size are checked; this is deliberately not a GPU occlusion
// query. The screen's front-face test prevents updates when viewing its back.
export function ambientScreenRect(object, camera, { frontFace = false, width = 1, height = 1, minPixels = 0, padding = .006 } = {}) {
  if (!object?.isObject3D) return null;
  for (let parent = object; parent; parent = parent.parent) if (!parent.visible) return null;
  if (object.material?.visible === false || object.material?.opacity === 0) return null;
  object.updateWorldMatrix(true, true); camera.updateMatrixWorld();
  if (frontFace) {
    object.getWorldPosition(world); normal.set(0, 0, 1).transformDirection(object.matrixWorld);
    if (normal.dot(point.copy(camera.position).sub(world)) <= 0) return null;
  }
  box.setFromObject(object); if (box.isEmpty()) return null;
  clip.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(clip);
  if (!frustum.intersectsBox(box)) return null;
  let minX = 1, minY = 1, maxX = 0, maxY = 0, crossesNear = false;
  for (let i = 0; i < 8; i++) {
    point.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera);
    crossesNear ||= point.z < -1 || point.z > 1;
    minX = Math.min(minX, point.x * .5 + .5); maxX = Math.max(maxX, point.x * .5 + .5);
    minY = Math.min(minY, point.y * .5 + .5); maxY = Math.max(maxY, point.y * .5 + .5);
  }
  // A near-plane intersection can straddle the perspective division. Retain
  // a conservative full footprint instead of incorrectly freezing it.
  if (crossesNear) return [0, 0, 1, 1];
  minX = Math.max(0, minX); minY = Math.max(0, minY); maxX = Math.min(1, maxX); maxY = Math.min(1, maxY);
  if ((maxX - minX) * width < minPixels || (maxY - minY) * height < minPixels) return null;
  return [Math.max(0, minX - padding), Math.max(0, minY - padding), Math.min(1, maxX + padding), Math.min(1, maxY + padding)];
}
