/**
 * Cooperative dispatch for auxiliary room work. Call tick() after measuring the
 * frame. This limits starts/in-flight tasks, not the duration of an unchunked
 * function or the CPU time of its asynchronous continuations. Work that mutates
 * resources after awaiting must check signal/isCurrent before committing.
 *
 * schedule(run, { key, priority, estimateMs, idleOnly }) returns a Promise:
 *   completed => { status: 'completed', value, submitMs, elapsedMs }
 *   cancelled => { status: 'cancelled', key, generation }
 * Genuine task errors reject. Reusing a key supersedes its previous generation.
 * Lower priorities run first; a priority function is read at each dispatch.
 * submitMs measures synchronous submission. elapsedMs includes awaited time and
 * must not be interpreted as CPU or GPU execution time.
 */
export class FrameBudgetScheduler {
  constructor({ movingBudgetMs = 0.6, idleBudgetMs = 3, reserveMs = 0.5,
    maxInFlight = 1, maxStartsPerTick = 2, now = () => performance.now() } = {}) {
    const positive = (value, fallback) => Number.isFinite(value) && value > 0 ? value : fallback;
    this.movingBudgetMs = positive(movingBudgetMs, 0.6);
    this.idleBudgetMs = positive(idleBudgetMs, 3);
    this.reserveMs = Number.isFinite(reserveMs) && reserveMs >= 0 ? reserveMs : 0.5;
    this.maxInFlight = Math.max(1, Math.floor(positive(maxInFlight, 1)));
    this.maxStartsPerTick = Math.max(1, Math.floor(positive(maxStartsPerTick, 2)));
    this.now = now;
    this.pending = [];
    this.active = new Set();
    this.latest = new Map();
    this.sequence = 0;
    this.disposed = false;
    this.completed = 0;
    this.cancelled = 0;
    this.failed = 0;
    this.overruns = 0;
    this.lastBudgetMs = 0;
    this.lastSubmittedMs = 0;
    this.lastMoving = false;
    this.history = [];
  }

  schedule(run, { key = null, priority = 10, estimateMs = 0.25, idleOnly = false } = {}) {
    if (typeof run !== 'function') throw new TypeError('Auxiliary task must be a function');
    if (this.disposed || this.resetting) return Promise.resolve({ status: 'cancelled', key, generation: this.sequence });
    if (key !== null) this.invalidate(key);
    const generation = ++this.sequence;
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const job = { run, key, priority, estimateMs: Number.isFinite(estimateMs) && estimateMs >= 0 ? estimateMs : 0.25,
      idleOnly: !!idleOnly, generation, controller: new AbortController(), resolve, reject, settled: false };
    if (key !== null) this.latest.set(key, job);
    this.pending.push(job);
    return promise;
  }

  isCurrent(job) {
    return !this.disposed && !job.controller.signal.aborted &&
      (job.key === null || this.latest.get(job.key) === job);
  }

  cancelJob(job) {
    if (job.controller.signal.aborted) return;
    job.controller.abort();
    if (!job.settled) {
      job.settled = true;
      this.cancelled++;
      job.resolve({ status: 'cancelled', key: job.key, generation: job.generation });
    }
    if (job.key !== null && this.latest.get(job.key) === job) this.latest.delete(job.key);
  }

  invalidate(key) {
    if (key === null || key === undefined) return false;
    const job = this.latest.get(key);
    if (!job) return false;
    this.cancelJob(job);
    this.pending = this.pending.filter(candidate => candidate !== job);
    // Running work retains its concurrency slot until it really settles.
    return true;
  }

  reset() {
    this.resetting = true;
    for (const job of [...this.pending, ...this.active]) this.cancelJob(job);
    this.pending.length = 0;
    this.latest.clear();
    this.resetting = false;
  }

  tick({ moving = false, frameMs = 0, frameBudgetMs = 1000 / 60 } = {}) {
    if (this.disposed) return 0;
    this.lastMoving = !!moving;
    // Invalid telemetry provides no permission to consume more frame time.
    if (!Number.isFinite(frameMs) || frameMs < 0 || !Number.isFinite(frameBudgetMs) || frameBudgetMs <= 0) {
      this.lastBudgetMs = this.lastSubmittedMs = 0;
      return 0;
    }
    const limit = moving ? this.movingBudgetMs : this.idleBudgetMs;
    const budget = Math.max(0, Math.min(limit, frameBudgetMs - frameMs - this.reserveMs));
    this.lastBudgetMs = budget;
    this.lastSubmittedMs = 0;
    if (!budget || this.active.size >= this.maxInFlight) return 0;
    for (const job of this.pending) {
      try { job.rank = typeof job.priority === 'function' ? job.priority() : job.priority; }
      catch { job.rank = 10; }
      if (!Number.isFinite(job.rank)) job.rank = 10;
    }
    this.pending.sort((a, b) => a.rank - b.rank || a.generation - b.generation);
    const tickStarted = this.now();
    let reservedMs = 0, starts = 0;
    while (this.active.size < this.maxInFlight && starts < this.maxStartsPerTick) {
      const available = budget - Math.max(reservedMs, Math.max(0, this.now() - tickStarted));
      if (available <= 0) break;
      const index = this.pending.findIndex(job => (!moving || !job.idleOnly) && job.estimateMs <= available);
      if (index < 0) break;
      const [job] = this.pending.splice(index, 1);
      if (!this.isCurrent(job)) { this.cancelJob(job); continue; }
      this.active.add(job);
      const started = this.now();
      let output;
      try {
        output = job.run({ signal: job.controller.signal, generation: job.generation, isCurrent: () => this.isCurrent(job) });
      } catch (error) {
        output = Promise.reject(error);
      }
      const submitMs = Math.max(0, this.now() - started);
      this.lastSubmittedMs += submitMs;
      reservedMs += Math.max(job.estimateMs, submitMs);
      if (submitMs > available) this.overruns++;
      starts++;
      Promise.resolve(output).then(value => {
        if (!this.isCurrent(job)) { this.cancelJob(job); return; }
        job.settled = true;
        this.completed++;
        job.resolve({ status: 'completed', value, submitMs, elapsedMs: Math.max(0, this.now() - started) });
      }, error => {
        if (!this.isCurrent(job)) { this.cancelJob(job); return; }
        job.settled = true;
        this.failed++;
        job.reject(error);
      }).finally(() => {
        this.history.push({ key: job.key, generation: job.generation, submitMs,
          elapsedMs: Math.max(0, this.now() - started), cancelled: job.controller.signal.aborted });
        if (this.history.length > 32) this.history.shift();
        this.active.delete(job);
        if (job.key !== null && this.latest.get(job.key) === job) this.latest.delete(job.key);
      });
    }
    return starts;
  }

  getStats() {
    return { pending: this.pending.length, active: this.active.size, maxInFlight: this.maxInFlight,
      maxStartsPerTick: this.maxStartsPerTick, movingBudgetMs: this.movingBudgetMs, idleBudgetMs: this.idleBudgetMs,
      lastMoving: this.lastMoving, lastBudgetMs: this.lastBudgetMs, lastSubmittedMs: this.lastSubmittedMs,
      completed: this.completed, cancelled: this.cancelled, failed: this.failed, overruns: this.overruns,
      disposed: this.disposed, history: this.history.map(sample => ({ ...sample })) };
  }

  dispose() { this.disposed = true; this.reset(); }
}

/**
 * Precompile one loaded root against the live room's lights/environment and the
 * actual render target. Does not render, mutate materials, fetch high LODs, or
 * force completion with GL flush/finish. compileAsync cannot be preempted once
 * submitted; generation cancellation discards its completion, retaining the
 * scheduler slot until Three's promise settles.
 */
export function scheduleShaderPrewarm(scheduler, { renderer, root, camera, scene = root,
  renderTarget, key = 'shader-prewarm', priority = 20, estimateMs = 0.5, idleOnly = true } = {}) {
  return scheduler.schedule(({ signal, isCurrent }) => {
    if (signal.aborted || !isCurrent()) return { prepared: false, reason: 'cancelled' };
    if (!renderer?.compileAsync) return { prepared: false, reason: 'unsupported' };
    if (!root || !camera || !scene) throw new TypeError('Shader prewarm requires root, camera, and scene');
    if (renderer.getContext?.().isContextLost?.()) return { prepared: false, reason: 'context-lost' };
    const previousTarget = renderer.getRenderTarget();
    const previousFace = renderer.getActiveCubeFace?.() ?? 0;
    const previousLevel = renderer.getActiveMipmapLevel?.() ?? 0;
    let compiled;
    try {
      if (renderTarget !== undefined) renderer.setRenderTarget(renderTarget);
      // Three performs synchronous material submission before its promise polls
      // compile completion. Restore target state before any awaited continuation.
      compiled = renderer.compileAsync(root, camera, scene);
    } finally {
      renderer.setRenderTarget(previousTarget, previousFace, previousLevel);
    }
    return Promise.resolve(compiled).then(() => ({ prepared: isCurrent() && !signal.aborted }));
  }, { key, priority, estimateMs, idleOnly });
}
