// Gate browser animation callbacks; requestAnimationFrame remains the vsync
// source. Display cadence describes presentation, never measured render cost.
const DISPLAY_WINDOW = 32;
const DISPLAY_RATES = [30, 40, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 180, 200, 240, 280, 300, 360, 480, 500];
const WORK_GAP_MS = 100;
const FPS_OVERLOAD_MS = 900;
const FPS_RECOVERY_MS = 4000;
const FPS_CHANGE_INTERVAL_MS = 3000;

export class AdaptiveFrameClock {
  constructor({ idleFps = 30, movingFps = 120, settleMs = 180 } = {}) {
    this.idleFps = idleFps;
    this.movingFps = movingFps;
    this.settleMs = settleMs;
    this.reset();
  }
  reset() {
    this.fps = this.idleFps;
    this.isMoving = false;
    this.displayFps = null;
    this.displayIntervals = [];
    this.displaySamples = 0;
    this.cadenceDivisor = 1;
    this.lastCadenceChangeAt = null;
    this.cadenceChanges = 0;
    this.motionUntil = -Infinity;
    this.nextFrameAt = null;
    this.lastFrameAt = null;
    this.lastTickAt = null;
    this.clearWorkHistory();
  }
  // Even above the configured cap, keep one render per whole display refreshes:
  // e.g. 360 Hz with a 240 FPS cap uses every second refresh, giving 180 FPS.
  get baseCadenceDivisor() { return Math.max(1, Math.ceil((this.displayFps || this.movingFps) / this.movingFps)); }
  get baseMovingFps() { return (this.displayFps || this.movingFps) / this.baseCadenceDivisor; }
  get effectiveMovingFps() {
    return (this.displayFps || this.movingFps) / Math.max(this.baseCadenceDivisor, this.cadenceDivisor);
  }
  get frameBudgetMs() { return 1000 / this.effectiveMovingFps; }

  clearWorkHistory() {
    this.lastWorkAt = null;
    this.overloadSince = null;
    this.recoverySince = null;
  }
  updateTarget() {
    const fps = this.isMoving ? this.effectiveMovingFps : this.idleFps;
    if (fps === this.fps) return;
    this.fps = fps;
    this.nextFrameAt = this.lastFrameAt === null ? null : this.lastFrameAt + 1000 / fps;
  }

  // Feed raw, visible rAF intervals, including callbacks skipped by accept().
  // The fastest quartile rejects occasional missed refreshes. A moving workload
  // may prove a faster display, but cannot relabel missed frames as a slower one.
  setDisplayInterval(intervalMs) {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000 / 600 || intervalMs > 40) {
      this.displayIntervals.length = 0;
      this.displaySamples = 0;
      return this.baseMovingFps;
    }
    this.displayIntervals[this.displaySamples % DISPLAY_WINDOW] = intervalMs;
    this.displaySamples++;
    if (this.displayIntervals.length < DISPLAY_WINDOW || this.displaySamples % 8 !== 0) return this.baseMovingFps;
    const ordered = this.displayIntervals.slice().sort((a, b) => a - b);
    const observed = 1000 / ordered[Math.floor(DISPLAY_WINDOW / 4)];
    const nearest = DISPLAY_RATES.reduce((best, rate) =>
      Math.abs(rate - observed) < Math.abs(best - observed) ? rate : best);
    const displayFps = Math.abs(nearest - observed) / nearest <= 0.08 ? nearest : Math.round(observed);
    if (displayFps === this.displayFps || (this.isMoving && this.displayFps !== null && displayFps < this.displayFps)) return this.baseMovingFps;
    const fallbackSteps = this.cadenceDivisor - this.baseCadenceDivisor;
    this.displayFps = displayFps;
    // Preserve only learned workload reductions across monitor changes; the
    // divisor needed for the configured cap is recalculated for the new display.
    this.cadenceDivisor = Math.min(this.baseCadenceDivisor + fallbackSteps,
      Math.max(this.baseCadenceDivisor, Math.floor(displayFps / Math.min(30, this.movingFps))));
    this.clearWorkHistory();
    this.updateTarget();
    return this.baseMovingFps;
  }

  // Call only after actual rendered work. resolutionScale is the APPLIED scale,
  // not the next pending scale, so lowering resolution always gets a fair trial.
  sampleWork({ now, frameMs, resolutionScale, minimumScale = 0.70 } = {}) {
    if (!this.isMoving || !Number.isFinite(now) || !Number.isFinite(frameMs) || frameMs < 0 ||
        !Number.isFinite(resolutionScale) || resolutionScale <= 0 ||
        !Number.isFinite(minimumScale) || minimumScale <= 0 || minimumScale > 1) {
      this.clearWorkHistory();
      return this.effectiveMovingFps;
    }
    if (this.lastWorkAt !== null && now <= this.lastWorkAt) {
      this.overloadSince = this.recoverySince = null;
      return this.effectiveMovingFps;
    }
    if (this.lastWorkAt === null || now - this.lastWorkAt > WORK_GAP_MS) {
      this.overloadSince = this.recoverySince = null;
    }
    this.lastWorkAt = now;
    const refresh = this.displayFps || this.movingFps;
    const floorFps = Math.min(30, this.baseMovingFps);
    const nextDivisor = Math.max(this.cadenceDivisor + 1, Math.floor(refresh / this.effectiveMovingFps) + 1);
    const canLower = refresh / nextDivisor >= floorFps;
    const overloaded = resolutionScale <= minimumScale + 1e-6 && frameMs > this.frameBudgetMs * 1.08;
    this.overloadSince = overloaded && canLower ? (this.overloadSince ?? now) : null;
    const fasterFps = refresh / Math.max(this.baseCadenceDivisor, this.cadenceDivisor - 1);
    const hasHeadroom = this.cadenceDivisor > this.baseCadenceDivisor && frameMs < (1000 / fasterFps) * 0.70;
    this.recoverySince = hasHeadroom ? (this.recoverySince ?? now) : null;
    const cooledDown = this.lastCadenceChangeAt === null || now - this.lastCadenceChangeAt >= FPS_CHANGE_INTERVAL_MS;
    let divisor = this.cadenceDivisor;
    if (cooledDown && this.overloadSince !== null && now - this.overloadSince >= FPS_OVERLOAD_MS) divisor = nextDivisor;
    else if (cooledDown && this.recoverySince !== null && now - this.recoverySince >= FPS_RECOVERY_MS) divisor--;
    if (divisor !== this.cadenceDivisor) {
      this.cadenceDivisor = divisor;
      this.lastCadenceChangeAt = now;
      this.cadenceChanges++;
      this.clearWorkHistory();
      this.updateTarget();
    }
    return this.effectiveMovingFps;
  }
  noteMotion(t) {
    if (Number.isFinite(t)) this.motionUntil = Math.max(this.motionUntil, t + this.settleMs);
  }
  accept(t, moving = false) {
    if (!Number.isFinite(t)) {
      this.nextFrameAt = this.lastFrameAt = this.lastTickAt = null;
      this.clearWorkHistory();
      return false;
    }
    if (this.lastTickAt !== null && t === this.lastTickAt) return false;
    if (this.lastTickAt !== null && (t < this.lastTickAt || t - this.lastTickAt > 250)) {
      this.nextFrameAt = this.lastFrameAt = null;
      if (t < this.lastTickAt) this.motionUntil = -Infinity;
      this.displayIntervals.length = 0;
      this.displaySamples = 0;
      this.clearWorkHistory();
    }
    this.lastTickAt = t;
    if (moving) this.noteMotion(t);
    const wasMoving = this.isMoving;
    this.isMoving = moving || t < this.motionUntil;
    if (this.isMoving !== wasMoving) {
      this.clearWorkHistory();
      this.displayIntervals.length = 0;
      this.displaySamples = 0;
    }
    this.updateTarget();
    // Input gets the next browser callback even when moving and idle both happen
    // to target 30 FPS. Motion state must never be inferred from an FPS number.
    if (this.isMoving && !wasMoving) this.nextFrameAt = null;
    const interval = 1000 / this.fps;
    // Timestamp precision may be 1 ms. Retain the deadline phase so accepting
    // a rounded boundary never accumulates drift beyond the target rate.
    if (this.nextFrameAt !== null && t + 1 < this.nextFrameAt) return false;
    if (this.nextFrameAt === null) this.nextFrameAt = t + interval;
    else this.nextFrameAt += Math.max(1,
      Math.floor((t - this.nextFrameAt) / interval + 1e-7) + 1) * interval;
    this.lastFrameAt = t;
    return true;
  }
  snapshot() {
    return { targetFps: this.fps, idleFps: this.idleFps, movingFps: this.movingFps,
      baseMovingFps: this.baseMovingFps, effectiveMovingFps: this.effectiveMovingFps,
      displayFps: this.displayFps, isMoving: this.isMoving, cadenceDivisor: this.cadenceDivisor,
      baseCadenceDivisor: this.baseCadenceDivisor,
      frameBudgetMs: this.frameBudgetMs, cadenceChanges: this.cadenceChanges,
      lastCadenceChangeAt: this.lastCadenceChangeAt, settleMs: this.settleMs };
  }
}

// Preserve the original 60 Hz easing speed when the frame rate changes.
export const frameAlpha = (alphaAt60Hz, elapsedMs) =>
  1 - Math.pow(1 - alphaAt60Hz, Math.max(0, elapsedMs) / (1000 / 60));
