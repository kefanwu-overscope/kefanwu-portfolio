import assert from 'node:assert/strict';
import test from 'node:test';
import { AdaptiveFrameClock, frameAlpha } from '../../experience-timing.js';
import { AdaptiveQuality, GpuFrameTimer } from '../../experience-quality.js';

function learn(clock, hz) {
  for (let i = 0; i < 40; i++) clock.setDisplayInterval(1000 / hz);
  return clock;
}
function renderFor(clock, { start = 0, duration = 1000, hz = 120, frameMs = 12, scale = 0.70 } = {}) {
  const end = start + duration;
  for (let now = start; now < end; now += 1000 / hz) {
    if (clock.accept(now, true)) clock.sampleWork({ now, frameMs, resolutionScale: scale });
  }
  return end;
}

test('stable 60/90/120/144/165/240 Hz inference produces native moving cadence up to the configured cap', () => {
  for (const hz of [60, 90, 120, 144, 165, 240]) {
    const clock = learn(new AdaptiveFrameClock({ movingFps: 240 }), hz);
    assert.equal(clock.snapshot().displayFps, hz);
    let frames = 0;
    for (let i = 0; i < hz * 10; i++) if (clock.accept(i * 1000 / hz, true)) frames++;
    assert.equal(frames, hz * 10);
    assert.equal(clock.fps, hz);
    assert.equal(clock.frameBudgetMs, 1000 / hz);
    assert.equal(clock.isMoving, true);
  }
  const capped = learn(new AdaptiveFrameClock(), 144);
  assert.equal(capped.baseMovingFps, 72);
  assert.equal(capped.movingFps, 120, 'the compatible default remains a 120 FPS cap');
});

test('rAF jitter and missed callbacks do not repeatedly change the inferred display rate', () => {
  const clock = learn(new AdaptiveFrameClock({ movingFps: 144 }), 120);
  for (let i = 0; i < 400; i++) {
    clock.setDisplayInterval(i % 5 === 0 ? 1000 / 60 : 1000 / 120 + (i % 3 - 1) * 0.15);
    assert.equal(clock.displayFps, 120);
  }
  clock.accept(0, true);
  for (let i = 0; i < 80; i++) clock.setDisplayInterval(1000 / 30);
  assert.equal(clock.displayFps, 120, 'expensive moving callbacks are not a monitor change');
  assert.equal(clock.cadenceDivisor, 1, 'rAF alone cannot trigger a workload fallback');
  clock.accept(200);
  assert.equal(clock.isMoving, false);
  learn(clock, 60);
  assert.equal(clock.displayFps, 60, 'a settled camera can discover a slower display');
});

test('invalid and long display intervals discard partial calibration without inventing a refresh rate', () => {
  const clock = learn(new AdaptiveFrameClock(), 60);
  clock.setDisplayInterval(1000);
  for (let i = 0; i < 24; i++) clock.setDisplayInterval(1000 / 120);
  for (const invalid of [NaN, Infinity, 0, -1, 1000]) {
    clock.setDisplayInterval(invalid);
    assert.equal(clock.displayFps, 60);
    assert.equal(clock.displayIntervals.length, 0);
  }
  for (let i = 0; i < 24; i++) clock.setDisplayInterval(1000 / 120);
  assert.equal(clock.displayFps, 60);
  for (let i = 0; i < 8; i++) clock.setDisplayInterval(1000 / 120);
  assert.equal(clock.displayFps, 120);
});

test('resolution falls before cadence and only sustained work at the applied floor can lower FPS', () => {
  const clock = learn(new AdaptiveFrameClock(), 120);
  let now = renderFor(clock, { duration: 5000, scale: 0.80, frameMs: 30 });
  assert.equal(clock.fps, 120, 'spare resolution must be tried first');
  now = renderFor(clock, { start: now, duration: 700, scale: 0.70, frameMs: 12 });
  assert.equal(clock.fps, 120, 'one short overload does not lower FPS');
  renderFor(clock, { start: now, duration: 400, scale: 0.70, frameMs: 12 });
  assert.equal(clock.fps, 60);
  assert.equal(clock.cadenceDivisor, 2);
});

test('fallback targets exact display divisors with a useful 30 FPS moving floor', () => {
  for (const [hz, next] of [[60, 30], [90, 45], [120, 60], [144, 72], [165, 82.5], [240, 120]]) {
    const clock = learn(new AdaptiveFrameClock({ movingFps: 240 }), hz);
    renderFor(clock, { hz, duration: 1100, frameMs: 1000 / hz * 1.5 });
    assert.equal(clock.fps, next);
    assert.equal(clock.isMoving, true);
    assert.equal(clock.frameBudgetMs, 1000 / next);
    let frames = 0;
    for (let i = 0; i < hz * 5; i++) if (clock.accept(1200 + i * 1000 / hz, true)) frames++;
    assert(Math.abs(frames - next * 5) <= 1, `uniform divisor cadence at ${hz} Hz`);
  }
  const slow = learn(new AdaptiveFrameClock(), 60);
  renderFor(slow, { hz: 60, duration: 20000, frameMs: 100 });
  assert.equal(slow.fps, 30);
  assert.equal(slow.cadenceChanges, 1);
});

test('steady workload between the fast and slow budgets does not oscillate', () => {
  const clock = learn(new AdaptiveFrameClock(), 120);
  renderFor(clock, { duration: 30000, frameMs: 11 });
  assert.equal(clock.fps, 60);
  assert.equal(clock.cadenceChanges, 1);
  assert.equal(clock.isMoving, true);
});

test('refresh rates above the cap keep integer divisors through fallback and recovery', () => {
  for (const [hz, expected] of [[280, 140], [360, 180], [480, 240]]) {
    const clock = learn(new AdaptiveFrameClock({ movingFps: 240 }), hz);
    assert.equal(clock.baseMovingFps, expected);
    assert.equal(clock.baseCadenceDivisor, 2);
    let frames = 0;
    for (let i = 0; i < hz * 2; i++) if (clock.accept(i * 1000 / hz, true)) frames++;
    assert.equal(frames, expected * 2);
    let now = renderFor(clock, { start: 2100, hz, duration: 1100, frameMs: 1000 / expected * 1.5 });
    assert.equal(clock.effectiveMovingFps, hz / 3);
    assert.equal(clock.cadenceDivisor, 3);
    now = renderFor(clock, { start: now, hz, duration: 4500, frameMs: 1 });
    assert.equal(clock.effectiveMovingFps, expected);
    assert.equal(clock.cadenceDivisor, 2);
    renderFor(clock, { start: now, hz, duration: 10000, frameMs: 1 });
    assert.equal(clock.effectiveMovingFps, expected, 'headroom cannot exceed the uniform base cadence');
    assert.equal(clock.cadenceChanges, 2);
  }
});

test('monitor changes recompute the cap divisor without inventing a workload fallback', () => {
  const clock = learn(new AdaptiveFrameClock({ movingFps: 240 }), 360);
  assert.equal(clock.cadenceDivisor, 2);
  learn(clock, 165);
  assert.equal(clock.baseCadenceDivisor, 1);
  assert.equal(clock.effectiveMovingFps, 165);
  assert.equal(clock.cadenceChanges, 0);
  renderFor(clock, { hz: 165, duration: 1100, frameMs: 10 });
  assert.equal(clock.effectiveMovingFps, 82.5);
  clock.accept(1500);
  learn(clock, 360);
  assert.equal(clock.baseCadenceDivisor, 2);
  assert.equal(clock.cadenceDivisor, 3, 'only the measured extra fallback is retained');
  assert.equal(clock.effectiveMovingFps, 120);
});

test('recovery requires sustained headroom against the faster cadence, not the current one', () => {
  const clock = learn(new AdaptiveFrameClock(), 120);
  let now = renderFor(clock, { duration: 1100, frameMs: 12 });
  assert.equal(clock.fps, 60);
  now = renderFor(clock, { start: now, duration: 5000, frameMs: 10 });
  assert.equal(clock.fps, 60, '10 ms fits 60 FPS but cannot justify 120 FPS');
  now = renderFor(clock, { start: now, duration: 3000, frameMs: 4 });
  assert.equal(clock.fps, 60);
  renderFor(clock, { start: now, duration: 1200, frameMs: 4 });
  assert.equal(clock.fps, 120);
  assert.equal(clock.cadenceChanges, 2);
});

test('invalid, duplicate, backward and gapped measurements break sustained overload', () => {
  for (const kind of ['invalid', 'duplicate', 'backward', 'gap']) {
    const clock = learn(new AdaptiveFrameClock(), 120);
    clock.accept(0, true);
    for (let now = 0; now <= 800; now += 50) clock.sampleWork({ now, frameMs: 12, resolutionScale: 0.70 });
    const next = kind === 'gap' ? 1100 : 850;
    if (kind !== 'gap') clock.sampleWork({ now: kind === 'backward' ? 700 : kind === 'duplicate' ? 800 : 825,
      frameMs: kind === 'invalid' ? NaN : 12, resolutionScale: 0.70 });
    for (let now = next; now <= next + 800; now += 50) clock.sampleWork({ now, frameMs: 12, resolutionScale: 0.70 });
    assert.equal(clock.effectiveMovingFps, 120, kind);
    clock.sampleWork({ now: next + 900, frameMs: 12, resolutionScale: 0.70 });
    assert.equal(clock.effectiveMovingFps, 60, kind);
  }
});

test('moving 30 FPS keeps motion identity and the next input callback responds immediately', () => {
  const clock = learn(new AdaptiveFrameClock(), 60);
  renderFor(clock, { duration: 1100, hz: 60, frameMs: 25 });
  assert.equal(clock.fps, 30);
  assert.equal(clock.isMoving, true);
  clock.accept(1400);
  assert.equal(clock.isMoving, false);
  assert.equal(clock.fps, 30);
  clock.noteMotion(1401);
  assert.equal(clock.accept(1402), true, 'input bypasses the old idle deadline');
  assert.equal(clock.isMoving, true);
  assert.equal(clock.fps, 30);
  assert.equal(clock.cadenceChanges, 1, 'brief rests do not erase learned overload');
});

test('reset after pause clears cadence and work history without a catch-up burst', () => {
  const clock = learn(new AdaptiveFrameClock(), 60);
  renderFor(clock, { duration: 1100, hz: 60, frameMs: 25 });
  clock.reset();
  assert.equal(clock.displayFps, null);
  assert.equal(clock.cadenceDivisor, 1);
  assert.equal(clock.isMoving, false);
  assert.equal(clock.accept(100000), true);
  assert.equal(clock.accept(100000), false);
  assert.equal(clock.accept(100001), false);
  clock.noteMotion(100002);
  assert.equal(clock.accept(100003), true);
  assert.equal(clock.fps, 120);
  assert.equal(clock.accept(NaN), false);
  assert.equal(clock.accept(3, true), true);
  assert.equal(clock.accept(2, true), true, 'a new timestamp origin rephases the gate');
});

test('motion arriving after a long idle callback gap is not lost', () => {
  const clock = new AdaptiveFrameClock({ idleFps: 1 });
  clock.accept(0);
  clock.noteMotion(1001);
  assert.equal(clock.accept(1002), true);
  assert.equal(clock.isMoving, true);
});

test('resolution reaches the bounded 0.70 floor and stationary frames immediately restore full detail', () => {
  const quality = new AdaptiveQuality();
  const changes = [];
  let lastScale = 1;
  for (let now = 0; now <= 6000; now += 20) {
    const scale = quality.sample({ now, moving: true, frameMs: 25, frameBudgetMs: 1000 / 60 });
    assert(scale >= 0.70 && scale <= lastScale);
    if (scale !== lastScale) changes.push(now);
    lastScale = scale;
  }
  assert.equal(lastScale, 0.70);
  assert.equal(quality.minimumScale, 0.70);
  assert.equal(quality.getStats().atMinimumScale, true);
  assert.equal(changes.length, 5);
  for (let i = 1; i < changes.length; i++) assert(changes[i] - changes[i - 1] >= 700);
  for (let now = 6020; now <= 10000; now += 20) assert.equal(quality.sample({ now, moving: true, frameMs: 1 }), 0.70);
  assert.equal(quality.sample({ now: 10001, moving: false }), 1);
  assert.equal(quality.getStats().atMinimumScale, false);
  assert.equal(quality.reset(), 1);
  assert.equal(quality.getStats().samples, 0);
});

test('native cadence budgets avoid needless 60 Hz reductions and support rates through 240 Hz', () => {
  for (const hz of [60, 90, 120, 144, 165, 240]) {
    const quality = new AdaptiveQuality();
    for (let now = 0; now <= 1000; now += 10) {
      assert.equal(quality.sample({ now, moving: true, frameMs: 1000 / hz * 0.9, frameBudgetMs: 1000 / hz }), 1);
    }
    assert.equal(quality.getStats().budgetMs, 1000 / hz);
  }
  const quality = new AdaptiveQuality();
  for (let now = 0; now <= 420; now += 10) quality.sample({ now, moving: true, frameMs: 7.5, frameBudgetMs: 1000 / 144 });
  assert.equal(quality.getStats().scale, 0.96);
  const fast = new AdaptiveQuality();
  for (let now = 0; now <= 420; now += 10) fast.sample({ now, moving: true, frameMs: 5, frameBudgetMs: 1000 / 240 });
  assert.equal(fast.getStats().scale, 0.96);
});

test('a cadence change or interrupted measurement starts a fresh resolution-overload window', () => {
  const quality = new AdaptiveQuality();
  for (let now = 0; now <= 300; now += 50) quality.sample({ now, moving: true, frameMs: 25 });
  for (let now = 350; now <= 700; now += 50) assert.equal(quality.sample({ now, moving: true, frameMs: 25, frameBudgetMs: 1000 / 60 }), 1);
  assert.equal(quality.sample({ now: 750, moving: true, frameMs: 25, frameBudgetMs: 1000 / 60 }), 0.96);
  quality.sample({ now: 760, moving: true, frameMs: NaN });
  for (let now = 1000; now <= 1300; now += 50) assert.equal(quality.sample({ now, moving: true, frameMs: 25 }), 0.96);
});

test('elapsed-time easing preserves speed across native and fallback refresh rates', () => {
  const end = [];
  for (const hz of [30, 45, 60, 72, 90, 120, 144, 165, 240]) {
    let value = 0;
    for (let i = 0; i < hz; i++) value += (1 - value) * frameAlpha(0.08, 1000 / hz);
    end.push(value);
  }
  for (const value of end) assert(Math.abs(value - end[0]) < 1e-12);
});

test('GPU timing remains asynchronous with at most four outstanding queries and no blocking result reads', () => {
  const ext = { TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 };
  let created = 0, available = false, disjoint = false, resultReads = 0;
  const deleted = [];
  const gl = {
    CURRENT_QUERY: 3, QUERY_RESULT_AVAILABLE: 4, QUERY_RESULT: 5,
    getExtension: () => ext, createQuery: () => ({ id: ++created }), deleteQuery: q => deleted.push(q.id),
    beginQuery() {}, endQuery() {}, getQuery: () => null,
    getParameter: () => disjoint,
    getQueryParameter(query, parameter) {
      if (parameter === this.QUERY_RESULT_AVAILABLE) return available;
      assert(available, 'must never synchronously wait for an unavailable result');
      resultReads++; return 7e6;
    },
  };
  const timer = new GpuFrameTimer(gl);
  for (let i = 0; i < 20; i++) { timer.begin(); timer.end(); assert.equal(timer.poll(), null); }
  assert.equal(created, 4);
  assert.equal(resultReads, 0);
  available = true;
  assert.equal(timer.poll(), 7);
  assert.equal(resultReads, 4);
  timer.begin(); timer.end(); assert.equal(created, 4, 'query objects are reused');
  disjoint = true; assert.equal(timer.poll(), null);
  assert.equal(deleted.length, 4);
  timer.dispose();
  assert.equal(timer.supported, false);
});
