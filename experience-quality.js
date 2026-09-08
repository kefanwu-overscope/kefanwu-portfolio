/**
 * Adaptive resolution policy only. No renderer, DOM, timers or target allocations.
 * Import from "./experience-quality.js?v=exp-adaptive-20260907".
 *
 * const quality = new AdaptiveQuality();
 * const gpu = new GpuFrameTimer(renderer.getContext()); // optional, WebGL2 only
 * // Once per accepted render (not per skipped rAF):
 * const gpuMs = gpu.poll(); // prior render, possibly unavailable; never waits
 * gpu.begin();
 * const start = performance.now();
 * try { composer.render(); } finally { gpu.end(); }
 * const cpuMs = performance.now() - start;
 * const scale = quality.sample({
 *   now: performance.now(), moving: frameClock.fps === 120,
 *   frameMs: Math.max(cpuMs, gpuMs ?? 0),
 * });
 * // Only if scale changed: update renderer/composer/GTAO together, then gpu.reset().
 * // The runtime owns base DPR, render sizes and the existing 180ms motion settle.
 *
 * frameMs is measured render work, NEVER rAF delta / observed FPS / refresh rate.
 * A continuous 400ms run above the 120fps budget lowers one step. A valid sample
 * at/below budget, an invalid sample, or a >100ms sample gap breaks the run.
 * Drops are >=700ms apart. Only becoming stationary bypasses this limit to return
 * immediately to 1. No upgrades while moving, to avoid resolution oscillation.
 * reset() returns 1 and clears history; use on startup/visibility discontinuities.
 * getStats() returns a fresh diagnostic snapshot; sample() returns only a number.
 *
 * GPU results are asynchronous; unavailable/disjoint/unsupported => null. Query
 * storage is bounded to four reusable objects. Poll once per rendered frame, not
 * in a loop. reset() discards old-resolution/old-motion samples. dispose() releases
 * queries. Recreate the helper after context restoration. No GL flush/finish calls.
 * CPU fallback measures submission cost and cannot detect otherwise-hidden GPU cost.
 * Spec: https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
 */

const SCALES = Object.freeze([1, 0.96, 0.92, 0.88]);
const BUDGET_MS = 1000 / 120;
const OVERLOAD_MS = 400;
const CHANGE_INTERVAL_MS = 700;
const MAX_SAMPLE_GAP_MS = 100;

export class AdaptiveQuality {
  constructor() {
    this.reset();
  }

  reset() {
    this.level = 0;
    this.lastNow = null;
    this.overloadSince = null;
    this.lastChangeAt = null;
    this.lastFrameMs = null;
    this.samples = 0;
    this.changes = 0;
    this.budgetMs = BUDGET_MS;
    return 1;
  }

  sample({ now, moving, frameMs, frameBudgetMs = BUDGET_MS } = {}) {
    this.budgetMs = Number.isFinite(frameBudgetMs) && frameBudgetMs > 0 ? Math.max(BUDGET_MS, frameBudgetMs) : BUDGET_MS;
    // Idle restoration must work even when no render measurement was taken.
    if (!moving) {
      if (this.level !== 0) {
        this.level = 0;
        this.lastChangeAt = Number.isFinite(now) ? now : this.lastNow;
        this.changes++;
      }
      this.overloadSince = null;
      this.lastNow = Number.isFinite(now) ? now : null;
      return 1;
    }
    if (!Number.isFinite(now) || !Number.isFinite(frameMs) || frameMs < 0) {
      this.overloadSince = null;
      this.lastNow = Number.isFinite(now) ? now : null;
      return SCALES[this.level];
    }
    if (this.lastNow !== null && now <= this.lastNow) {
      // Duplicate/out-of-order timestamps are not additional sustained work.
      this.overloadSince = null;
      return SCALES[this.level];
    }
    if (this.lastNow === null || now - this.lastNow > MAX_SAMPLE_GAP_MS) {
      this.overloadSince = null;
    }
    this.lastNow = now;
    this.lastFrameMs = frameMs;
    this.samples++;

    if (frameMs <= this.budgetMs) {
      this.overloadSince = null;
    } else {
      if (this.overloadSince === null) this.overloadSince = now;
      const sustained = now - this.overloadSince >= OVERLOAD_MS;
      const cooledDown = this.lastChangeAt === null || now - this.lastChangeAt >= CHANGE_INTERVAL_MS;
      if (sustained && cooledDown && this.level < SCALES.length - 1) {
        this.level++;
        this.lastChangeAt = now;
        this.overloadSince = null;
        this.changes++;
      }
    }
    return SCALES[this.level];
  }

  getStats() {
    return {
      scale: SCALES[this.level],
      budgetMs: this.budgetMs,
      overloadMs: OVERLOAD_MS,
      changeIntervalMs: CHANGE_INTERVAL_MS,
      lastFrameMs: this.lastFrameMs,
      overBudgetForMs: this.overloadSince === null ? 0 : this.lastNow - this.overloadSince,
      lastChangeAt: this.lastChangeAt,
      samples: this.samples,
      changes: this.changes,
    };
  }
}

const MAX_QUERIES = 4;

export class GpuFrameTimer {
  constructor(gl) {
    this.gl = gl;
    this.ext = null;
    this.active = null;
    this.pending = [];
    this.free = [];
    try {
      const methods = ["getExtension", "createQuery", "deleteQuery", "beginQuery", "endQuery", "getQuery", "getQueryParameter", "getParameter"];
      if (methods.every((name) => typeof gl?.[name] === "function")) {
        this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      }
    } catch { /* Unsupported: caller uses its CPU render measurement. */ }
  }

  get supported() { return !!this.ext; }

  begin() {
    if (!this.ext || this.active) return false;
    const gl = this.gl;
    try {
      if (gl.isContextLost?.()) { this.dispose(); return false; }
      if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) { this.reset(); return false; }
      if (this.pending.length >= MAX_QUERIES) return false;
      // Do not nest/steal a timer owned by another profiler.
      if (gl.getQuery(this.ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return false;
      const query = this.free.pop() || gl.createQuery();
      if (!query) return false;
      this.active = query;
      gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
      return true;
    } catch {
      this.dispose();
      return false;
    }
  }

  end() {
    if (!this.ext || !this.active) return false;
    try {
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.pending.push(this.active);
      this.active = null;
      return true;
    } catch {
      this.dispose();
      return false;
    }
  }

  poll() {
    if (!this.ext || this.active) return null;
    const gl = this.gl;
    try {
      if (gl.isContextLost?.()) { this.dispose(); return null; }
      if (gl.getParameter(this.ext.GPU_DISJOINT_EXT)) {
        // Disjoint invalidates all outstanding measurements, not just the oldest.
        this.reset();
        return null;
      }
      let latestMs = null;
      // At most four availability checks; unavailable results are never read.
      while (this.pending.length) {
        const query = this.pending[0];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
        const nanoseconds = gl.getQueryParameter(query, gl.QUERY_RESULT);
        this.pending.shift();
        this.free.push(query);
        if (Number.isFinite(nanoseconds) && nanoseconds >= 0) latestMs = nanoseconds / 1e6;
      }
      return latestMs;
    } catch {
      this.dispose();
      return null;
    }
  }

  reset() {
    if (this.active) {
      try { this.gl.endQuery(this.ext.TIME_ELAPSED_EXT); } catch { /* Context may be lost. */ }
      this.pending.push(this.active);
      this.active = null;
    }
    for (const query of this.pending) {
      try { this.gl.deleteQuery(query); } catch { /* Best effort after context loss. */ }
    }
    for (const query of this.free) {
      try { this.gl.deleteQuery(query); } catch { /* Best effort after context loss. */ }
    }
    this.pending.length = 0;
    this.free.length = 0;
  }

  dispose() {
    this.reset();
    this.ext = null;
  }
}
