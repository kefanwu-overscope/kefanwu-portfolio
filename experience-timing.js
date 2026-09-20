// A display-cadence gate, not an extra timer: the browser remains responsible
// for vsync. Camera motion gets 120 FPS; ambient motion gets 30 FPS.
export class AdaptiveFrameClock {
  constructor({ idleFps = 30, movingFps = 120, settleMs = 180 } = {}) {
    this.idleFps = idleFps;
    this.movingFps = movingFps;
    this.settleMs = settleMs;
    this.reset();
  }
  reset() {
    this.fps = this.idleFps;
    this.motionUntil = -Infinity;
    this.nextFrameAt = null;
    this.lastFrameAt = null;
  }
  noteMotion(t) { this.motionUntil = Math.max(this.motionUntil, t + this.settleMs); }
  accept(t, moving = false) {
    if (moving) this.noteMotion(t);
    const fps = t < this.motionUntil ? this.movingFps : this.idleFps;
    const interval = 1000 / fps;
    if (fps !== this.fps) {
      this.fps = fps;
      this.nextFrameAt = this.lastFrameAt === null ? null : this.lastFrameAt + interval;
    }
    // Timestamp precision may be 1 ms. Retain the deadline phase so accepting
    // a rounded boundary never accumulates drift beyond the target rate.
    if (this.nextFrameAt !== null && t + 1 < this.nextFrameAt) return false;
    if (this.nextFrameAt === null) this.nextFrameAt = t + interval;
    else this.nextFrameAt += Math.max(1,
      Math.floor((t - this.nextFrameAt) / interval + 1e-7) + 1) * interval;
    this.lastFrameAt = t;
    return true;
  }
  snapshot() { return { targetFps: this.fps, idleFps: this.idleFps, movingFps: this.movingFps, settleMs: this.settleMs }; }
}

// Preserve the original 60 Hz easing speed when the frame rate changes.
export const frameAlpha = (alphaAt60Hz, elapsedMs) =>
  1 - Math.pow(1 - alphaAt60Hz, Math.max(0, elapsedMs) / (1000 / 60));
