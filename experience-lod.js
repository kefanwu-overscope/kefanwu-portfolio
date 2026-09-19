import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// A real task boundary lets input/paint run between procedural and GLB stages.
export const yieldToBrowser = () => globalThis.scheduler?.yield
  ? globalThis.scheduler.yield()
  : new Promise((resolve) => setTimeout(resolve, 0));

export class AssetQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.active = 0;
    this.jobs = [];
    this.started = false;
    this.sequence = 0;
  }
  start() { this.started = true; this.drain(); }
  add(run, priority = 10, eligible = () => true) {
    return new Promise((resolve, reject) => {
      this.jobs.push({ run, priority, eligible, resolve, reject, sequence: this.sequence++ });
      this.drain();
    });
  }
  drain() {
    if (!this.started) return;
    this.jobs.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
    while (this.active < this.concurrency && this.jobs.length) {
      const job = this.jobs.shift();
      if (!job.eligible()) { job.resolve(null); continue; }
      this.active++;
      // Keep the slot through parse, preparation, placement and the yield.
      Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(async () => {
        await yieldToBrowser();
        this.active--;
        this.drain();
      });
    }
  }
}

const validBounds = (b) => b && [b.min, b.max].every((v) =>
  Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) &&
  b.min.every((v, i) => v <= b.max[i]) && b.min.some((v, i) => v < b.max[i]);

export function modelBounds(root) {
  const b = root.userData.lodSourceBounds;
  return b ? b.clone().applyMatrix4(root.matrixWorld) : new THREE.Box3().setFromObject(root);
}

function prepareGeometry(root) {
  const seen = new Set();
  let triangles = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = true;
    o.castShadow = o.receiveShadow = true;
    const g = o.geometry;
    if (!seen.has(g)) {
      // Recompute from the loaded geometry rather than trusting export hints.
      g.computeBoundingBox();
      g.computeBoundingSphere();
      seen.add(g);
    }
    triangles += (g.index?.count ?? g.attributes.position?.count ?? 0) / 3;
  });
  return triangles;
}

export class ModelLODLoader {
  constructor(manager, { manifestURL = "models/lod/manifest.json?v=exp-adaptive-20260907", targetKey = "", requestTimeoutMs = 45000 } = {}) {
    this.manager = manager;
    this.raw = new GLTFLoader();
    this.requestTimeoutMs = requestTimeoutMs;
    this.queue = new AssetQueue(1);
    this.records = [];
    this.targetKey = targetKey;
    this.enabled = false;
    this.frustum = new THREE.Frustum();
    this.viewProjection = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.viewCenter = new THREE.Vector3();
    this.camera = null;
    this.manifestStatus = "loading";
    this.manifest = (async () => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 8000);
      try {
        const response = await fetch(manifestURL, { signal: abort.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.version !== 1 || !data.models) throw new Error("Invalid LOD manifest");
        this.manifestStatus = "ready";
        return data.models;
      } catch (error) {
        this.manifestStatus = "fallback";
        console.warn("[experience] LOD manifest unavailable; using queued original models", error);
        return {};
      } finally { clearTimeout(timer); }
    })();
  }
  start() { this.queue.start(); }
  async loadGLB(url, onProgress) {
    // Abort the actual transfer (including the body), so a stalled asset cannot
    // permanently occupy the single preparation slot. Existing fallback paths
    // handle the rejection and late network data can never mount a model.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), this.requestTimeoutMs);
    let data;
    try {
      const response = await fetch(url, { signal: abort.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      data = await response.arrayBuffer();
      if (onProgress) onProgress({ loaded: data.byteLength, total: data.byteLength, lengthComputable: true });
    } catch (error) {
      if (abort.signal.aborted) throw new Error(`Model request timed out: ${url}`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
    return this.raw.parseAsync(data, THREE.LoaderUtils.extractUrlBase(url));
  }
  load(url, onLoad, onProgress, onError, prepare = null, key = null) {
    const token = `base-model:${this.records.length}:${url}`;
    this.manager.itemStart(token); // includes jobs still waiting for the queue
    const record = {
      key, url, currentLevel: "pending", highLoaded: false, loading: "base",
      visible: false, projectedFraction: 0, distance: null, lowTriangles: null,
      highTriangles: null, attempts: 0, nextRetryAt: 0, wantedHigh: false,
      baseStatus: "queued", error: null, holder: null, low: null, high: null,
    };
    this.records.push(record);
    const priority = url.includes("room-baked") ? -100 : key === this.targetKey ? -50 : 10;
    this.queue.add(async () => {
      const models = await this.manifest;
      const entry = models[url];
      record.entry = entry && typeof entry.low === "string" && entry.low.startsWith("models/lod/") && validBounds(entry.sourceBounds) ? entry : null;
      record.highURL = record.entry?.high?.startsWith("models/optimized/") ? record.entry.high : url;
      record.baseStatus = "loading";
      let gltf;
      if (record.entry) {
        try { gltf = await this.loadGLB(record.entry.low, onProgress); }
        catch (error) {
          // A missing/broken derivative must never leave an exhibit empty.
          console.warn(`[experience] low model failed; falling back to ${url}`, error);
          record.error = "Low model unavailable; using original";
        }
      }
      const isLow = !!gltf;
      if (!gltf) gltf = await this.loadHigh(record, onProgress);
      await yieldToBrowser();
      if (prepare) prepare(gltf.scene);
      const triangles = prepareGeometry(gltf.scene);
      const holder = new THREE.Group();
      holder.name = `lod:${url}`;
      holder.add(gltf.scene);
      if (record.entry) {
        holder.userData.lodSourceBounds = new THREE.Box3(
          new THREE.Vector3().fromArray(record.entry.sourceBounds.min),
          new THREE.Vector3().fromArray(record.entry.sourceBounds.max));
      }
      record.holder = holder;
      record.currentLevel = isLow ? "low" : "high";
      record.highLoaded = !isLow;
      if (isLow) { record.low = gltf.scene; record.lowTriangles = triangles; }
      else { record.high = gltf.scene; record.highTriangles = triangles; }
      record.prepare = prepare;
      onLoad({ ...gltf, scene: holder }); // only once: stable pivot / proxies / animation
      holder.updateWorldMatrix(true, true);
      // LOD bounds exclude hover markers and click proxies, and follow parent animation.
      record.bounds = holder.userData.lodSourceBounds?.clone() ||
        new THREE.Box3().setFromObject(holder).applyMatrix4(holder.matrixWorld.clone().invert());
      record.baseStatus = "ready";
      record.loading = null;
    }, priority).catch((error) => {
      record.baseStatus = "failed";
      record.loading = null;
      record.error = String(error.message || error);
      this.manager.itemError(token);
      console.warn(`[experience] failed to load ${url}`, error);
      if (onError) onError(error);
    }).finally(() => this.manager.itemEnd(token));
    return record;
  }
  measure(record) {
    if (!record.holder || !this.camera) return false;
    record.holder.updateWorldMatrix(true, false);
    record.bounds.getBoundingSphere(this.sphere).applyMatrix4(record.holder.matrixWorld);
    record.visible = this.frustum.intersectsSphere(this.sphere);
    record.distance = this.camera.position.distanceTo(this.sphere.center);
    this.viewCenter.copy(this.sphere.center).applyMatrix4(this.camera.matrixWorldInverse);
    record.projectedFraction = this.sphere.radius /
      (Math.max(this.camera.near, -this.viewCenter.z) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov * 0.5)));
    return record.visible;
  }
  async loadHigh(record, onProgress) {
    if (record.highURL && record.highURL !== record.url) {
      try { return await this.loadGLB(record.highURL, onProgress); }
      catch (error) {
        console.warn(`[experience] optimized high model unavailable; using original: ${record.url}`, error);
        record.highURL = record.url;
      }
    }
    return this.loadGLB(record.url, onProgress);
  }
  update(camera, selectedKey = null, now = performance.now()) {
    let changed = false;
    this.camera = camera;
    camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.viewProjection);
    for (const record of this.records) {
      if (record.baseStatus !== "ready") continue;
      this.measure(record);
      const selected = !!record.key && record.key === selectedKey;
      // Diameter / viewport height: enter at 24%, leave below 17%.
      // Distance cap stops a large distant furnishing requesting full detail.
      const near = record.projectedFraction >= (record.wantedHigh ? 0.17 : 0.24) &&
        record.distance <= (record.wantedHigh ? 2.8 : 2.2);
      record.wantedHigh = selected || (record.visible && near);
      if (!this.enabled || !record.low) continue;
      if (record.high) {
        const high = record.wantedHigh;
        if (record.currentLevel !== (high ? "high" : "low")) changed = true;
        // Only level children change visibility. The offscreen object remains
        // a shadow caster; Three's mesh frustum test runs separately per pass.
        record.low.visible = !high;
        record.high.visible = high;
        record.currentLevel = high ? "high" : "low";
      } else if (record.wantedHigh && !record.loading && record.attempts < 3 && now >= record.nextRetryAt) {
        record.loading = "high-queued";
        this.queue.add(async () => {
          record.loading = "high";
          record.attempts++;
          const gltf = await this.loadHigh(record);
          await yieldToBrowser();
          if (record.prepare) record.prepare(gltf.scene);
          record.highTriangles = prepareGeometry(gltf.scene);
          record.high = gltf.scene;
          record.high.visible = false;
          record.holder.add(record.high);
          record.highLoaded = true;
          record.error = null;
          record.nextRetryAt = 0;
          this.onLevelLoaded?.();
          // Commit the level only from update(), never a network/render callback.
        }, selected ? 0 : 20, () => record.wantedHigh && (selected || this.measure(record)))
          .catch((error) => {
            record.error = String(error.message || error);
            record.nextRetryAt = performance.now() + 5000 * 2 ** (record.attempts - 1);
            console.warn(`[experience] high model failed (${record.attempts}/3); retaining low: ${record.url}`, error);
          }).finally(() => { record.loading = null; });
      }
    }
    return changed;
  }
  getStats() {
    return {
      manifest: this.manifestStatus, enabled: this.enabled,
      queue: { active: this.queue.active, pending: this.queue.jobs.length, concurrency: this.queue.concurrency },
      thresholds: { enterFraction: 0.24, exitFraction: 0.17, enterDistance: 2.2, exitDistance: 2.8, maxHighAttempts: 3 },
      models: this.records.map((r) => ({
        key: r.key, url: r.url, lowURL: r.entry?.low || null, highURL: r.highURL || r.url,
        currentLevel: r.currentLevel, highLoaded: r.highLoaded, loading: r.loading,
        visible: r.visible, distance: r.distance, projectedFraction: r.projectedFraction,
        lowTriangles: r.lowTriangles, highTriangles: r.highTriangles,
        sourceTriangles: r.entry?.sourceTriangles ?? null,
        currentTriangles: r.currentLevel === "low" ? r.lowTriangles : r.highTriangles,
        baseStatus: r.baseStatus, highAttempts: r.attempts, error: r.error,
      })),
    };
  }
}
