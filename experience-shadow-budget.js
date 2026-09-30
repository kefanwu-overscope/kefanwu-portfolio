// Adaptive raster shadow maps. Light coverage is deliberately invariant: camera
// cropping would discard off-screen casters that still shadow visible receivers.
const powerOfTwo = value => 2 ** Math.floor(Math.log2(Math.max(1, value)));
const finiteDistance = value => Number.isFinite(value) && value >= 0;

export class ShadowBudgetPolicy {
  constructor({ lowTier = false, maxTextureSize = 2048, keySize = lowTier ? 1024 : 2048, spotSize = 1024 } = {}) {
    this.maxKey = Math.min(lowTier ? 1024 : 2048, powerOfTwo(maxTextureSize));
    this.minKey = Math.min(1024, this.maxKey);
    this.maxSpot = Math.min(1024, powerOfTwo(maxTextureSize));
    this.minSpot = Math.min(512, this.maxSpot);
    this.channels = {
      key: { size: Math.min(keySize, this.maxKey), candidate: null, since: 0, changedAt: -Infinity },
      spot: { size: Math.min(spotSize, this.maxSpot), candidate: null, since: 0, changedAt: -Infinity },
    };
    this.lastMotion = -Infinity; this.lastTime = null;
    this.focusNear = false; this.deskNear = false; this.changes = 0;
  }
  sample({ now, moving = false, attentionKey = '', attentionDistance, spotDistance, spotEnabled = true } = {}) {
    const result = { changed: false, keySize: this.channels.key.size, spotSize: this.channels.spot.size, focus: this.focusNear };
    if (!Number.isFinite(now) || (this.lastTime !== null && now <= this.lastTime)) return result;
    this.lastTime = now;
    if (moving) this.lastMotion = now;
    if (!attentionKey) this.focusNear = false;
    else if (finiteDistance(attentionDistance)) {
      if (attentionDistance <= 3.5) this.focusNear = true;
      else if (attentionDistance >= 4.25) this.focusNear = false;
    }
    if (finiteDistance(spotDistance)) {
      if (spotDistance <= 1.6) this.deskNear = true;
      else if (spotDistance >= 2.0) this.deskNear = false;
    }
    const unknownFocus = !!attentionKey && !finiteDistance(attentionDistance);
    const desired = {
      key: unknownFocus ? this.channels.key.size : this.focusNear ? this.maxKey : this.minKey,
      spot: !spotEnabled ? this.channels.spot.size : (this.deskNear || attentionKey === 'resume') ? this.maxSpot : this.minSpot,
    };
    for (const name of ['key', 'spot']) {
      const channel = this.channels[name], target = desired[name];
      if (moving || target === channel.size) { channel.candidate = null; continue; }
      if (channel.candidate !== target) { channel.candidate = target; channel.since = now; }
      const delay = target > channel.size ? 750 : 2200;
      if (now - this.lastMotion < 800 || now - channel.since < delay || now - channel.changedAt < 4000) continue;
      channel.size = target; channel.changedAt = now; channel.candidate = null;
      result.changed = true; this.changes++;
    }
    result.keySize = this.channels.key.size; result.spotSize = this.channels.spot.size; result.focus = this.focusNear;
    return result;
  }
}

function point(object) {
  if (!object) return null;
  object.updateWorldMatrix?.(true, false);
  const m = object.matrixWorld?.elements;
  if (m) return [m[12], m[13], m[14]];
  const p = object.position || object;
  const result = Array.isArray(p) ? p.slice(0, 3) : [p.x, p.y, p.z];
  return result.every(Number.isFinite) ? result : null;
}
function distance(a, b) { return a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : undefined; }
function lightPose(light) {
  const shadow = light.shadow, camera = shadow.camera;
  return [...(point(light) || []), ...(point(light.target) || []), light.angle, light.distance,
    shadow.focus, camera.near, camera.far, camera.left, camera.right, camera.top, camera.bottom].join(',');
}

export function createAdaptiveShadows({ renderer, key, resumeSpot, lowTier = false } = {}) {
  if (!renderer?.shadowMap || !key?.shadow) throw Error('Adaptive shadows need the renderer and directional shadow light');
  const policy = new ShadowBudgetPolicy({ lowTier, maxTextureSize: renderer.capabilities?.maxTextureSize || 2048,
    keySize: key.shadow.mapSize.x, spotSize: resumeSpot?.shadow.mapSize.x || 1024 });
  const lights = [
    { name: 'key', light: key }, { name: 'spot', light: resumeSpot },
  ].filter(record => record.light?.shadow).map(record => ({ ...record, dirty: true, wasMoving: false,
    pose: null, lastRequest: -Infinity, outstanding: false, baselineSize: record.light.shadow.mapSize.x,
    baselineRadius: record.light.shadow.radius, requests: 0 }));
  let disposed = false;
  const stats = { updates: 0, mapChanges: 0, cachedFrames: 0, keyRequests: 0, spotRequests: 0,
    keySize: key.shadow.mapSize.x, spotSize: resumeSpot?.shadow.mapSize.x || 0,
    coverage: 'unchanged-source-light-frusta', mode: 'adaptive-raster', lastReason: 'initial' };
  renderer.shadowMap.autoUpdate = false;
  for (const record of lights) record.light.shadow.autoUpdate = false;

  function resize(record, size) {
    const shadow = record.light.shadow;
    if (!record.light.castShadow || (shadow.mapSize.x === size && shadow.mapSize.y === size)) return false;
    // Three recreates a target on the next requested shadow draw. Dispose both
    // maps if a VSM target is present; PCF normally has only shadow.map.
    shadow.map?.dispose(); shadow.map = null;
    shadow.mapPass?.dispose(); shadow.mapPass = null;
    shadow.mapSize.set(size, size);
    // Keep the filter's approximate world-space softness across texel sizes.
    shadow.radius = record.baselineRadius * size / record.baselineSize;
    record.dirty = true; stats.mapChanges++; return true;
  }
  return {
    update({ camera, moving = false, attentionKey = '', attentionPosition = null,
      geometryDirty = false, movingCasters = false, movingPaper = false,
      now = globalThis.performance?.now() || Date.now() } = {}) {
      if (disposed) return { changed: false, needsUpdate: false, ...stats };
      const cameraPoint = point(camera), attentionPoint = point(attentionPosition);
      const budget = policy.sample({ now, moving, attentionKey, attentionDistance: distance(cameraPoint, attentionPoint),
        spotDistance: distance(cameraPoint, point(resumeSpot?.target)), spotEnabled: !!resumeSpot?.castShadow });
      let changed = false, needsUpdate = false;
      for (const record of lights) {
        const { light, name } = record, shadow = light.shadow;
        // Candidates advance while settled, but inactive maps are not allocated.
        const active = light.castShadow && renderer.shadowMap.enabled && (light.intensity ?? 1) > 0;
        if (active && !moving) changed = resize(record, name === 'key' ? budget.keySize : budget.spotSize) || changed;
        const pose = lightPose(light);
        if (record.pose !== pose) { record.pose = pose; record.dirty = true; stats.lastReason = 'light-pose'; }
        if (geometryDirty === true || geometryDirty?.[name]) { record.dirty = true; stats.lastReason = 'source-geometry'; }
        if (shadow.needsUpdate && !record.outstanding) record.dirty = true;
        if (!shadow.needsUpdate) record.outstanding = false;
        const casterMoving = name === 'key' ? movingCasters || movingPaper : movingPaper;
        if (record.wasMoving && !casterMoving) { record.dirty = true; stats.lastReason = 'final-caster-pose'; }
        record.wasMoving = casterMoving;
        const fps = name === 'spot' ? 30 : budget.focus ? 24 : 12;
        const motionDue = casterMoving && now - record.lastRequest >= 1000 / fps;
        if (active && (record.dirty || motionDue)) {
          shadow.needsUpdate = true; needsUpdate = true; record.dirty = false;
          if (!record.outstanding) {
            record.lastRequest = now; record.requests++; record.outstanding = true;
            stats[name === 'key' ? 'keyRequests' : 'spotRequests']++;
          }
        } else if (!active) {
          // Retain invalidation while a light is off; turning it on cannot expose
          // an obsolete depth map, and intensity flicker alone never rebuilds it.
          record.dirty ||= !!shadow.needsUpdate; shadow.needsUpdate = false; record.outstanding = false;
        }
        needsUpdate ||= active && shadow.needsUpdate;
      }
      renderer.shadowMap.needsUpdate ||= needsUpdate;
      stats.updates++; if (!needsUpdate) stats.cachedFrames++;
      stats.keySize = key.shadow.mapSize.x;
      stats.spotSize = resumeSpot?.castShadow ? resumeSpot.shadow.mapSize.x : 0;
      return { changed, needsUpdate, keySize: stats.keySize, spotSize: stats.spotSize, focus: budget.focus };
    },
    invalidate({ key = true, spot = true } = {}) {
      for (const record of lights) if ((record.name === 'key' && key) || (record.name === 'spot' && spot)) record.dirty = true;
    },
    getStats() { return { ...stats }; },
    dispose() { disposed = true; },
  };
}
