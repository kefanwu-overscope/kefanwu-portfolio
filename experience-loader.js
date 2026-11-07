/**
 * Studio startup presentation. No timers, network requests, render loop or boot control.
 *
 * import { createStudioLoader } from "./experience-loader.js?v=exp-adaptive-20260907";
 * const loader = createStudioLoader(document.getElementById("exp-loader"));
 * loader.update({ loaded, total, phase: "loading" });
 * loader.update({ phase: "loading", activity: "decoding" }); // actual HDR decode starts
 * loader.update({ phase: "loading", activity: null }); // decode settles; restore asset label
 * loader.setPhase("preparing"); // only after startup assets have settled
 * loader.update({ loaded: prepared, total: preparationTotal, phase: "preparing" });
 * loader.update({ phase: "preparing", activity: "compiling" }); // shader compilation starts
 * loader.update({ phase: "preparing", activity: "lighting" }); // post/lighting warmup starts
 * loader.setPhase("first-frame"); // scene preparation has actually finished
 * loader.complete(); // ONLY after the real scene's first frame has rendered
 * // On a fatal startup/WebGL failure: loader.fail("This browser can't run the 3D studio.");
 *
 * Counts are finite, nonnegative work-unit counts WITHIN the specified phase.
 * Omit total (or pass zero) when the amount of work is unknown; no progress is invented.
 * Startup progress is stage-weighted, not byte/download progress or elapsed time:
 * loading 0–85%, preparing 85–95%, first-frame 95–99%. Only complete() yields 100%.
 * Phase order and displayed percentages never go backwards, even if totals grow.
 * Advancing a phase asserts all previous phases are finished. Late events from an
 * earlier phase are ignored. Supply phase on asynchronous count updates.
 * Optional activity is a named stage ("decoding", "compiling", "lighting") or null.
 * It changes only the current phase's status label, never its counts or percentage.
 * Omission preserves the activity; null restores the normal phase label. Advancing a
 * phase clears it automatically. Decoding is accepted during loading/preparing;
 * compiling and lighting only during preparing; none after the first-frame gate.
 * Drive these labels from the actual awaited work, not individual worker chunks.
 * A stage with no measurable progress (named stages, the first-frame wait, or a
 * phase without counts) sets data-indeterminate so the bar shimmers instead of
 * looking frozen. The percentage itself never moves for unmeasured work.
 * complete() and fail() settle this startup; subsequent progress calls do nothing.
 * fail() may override completion if a fatal failure occurs during reveal.
 *
 * The caller owns .exp-ready / revealScene(), aria-hidden after the fade, and the
 * lighting boot. This module never hides the loader, starts the boot or uses storage.
 * Calling the factory again for the same element returns the same controller.
 * A missing element is safe. No auto-init; import and connect from experience.js.
 *
 * 2026-10-27 ("Drawn, then built"): createStudioLoader(element, { mode: "drawing" })
 * is the startup screen that draws the room. Its stage weights follow where
 * the time actually goes: loading 0–45%, preparing 45–95% (texture uploads
 * 45–50, shader compiling 50–92, lighting 92–95), first frame 95–99%. While
 * compiling it accepts counts, compiled/linked programs out of those
 * submitted: measured, so no shimmer. getProgress() returns the unrounded
 * percentage (2026-11-04: QA only; the room drawing inks parts as their
 * geometry arrives, not to this number). The default mode ("classic") keeps
 * its stage weights.
 *
 * 2026-10-28 (F29, both modes): the screen is repainted for counts at most
 * twice a second (COUNT_PAINT_MS); a stage boundary (phase or named stage)
 * paints at once, and only stage boundaries change the status line. A
 * measured named stage (compiling) shows its own line, "Compiling materials"
 * with the percentage, never "N / M": the number of programs submitted grows
 * while the compile runs, so its denominator would change on screen.
 * getProgress() is never throttled. holdCounts(predicate): while it returns
 * true (2026-10-29: the startup drawing is finished and held through the
 * compile, with no canvas frames), the compile's percentage is painted at
 * most every COUNT_HOLD_MS, so the screen commits as rarely as it can while
 * the GPU links the room's programs.
 */

const CLASSIC = [
  {
    id: "loading", start: 0, end: 85,
    text: "Loading studio resources", active: "Loading",
    detail: "Waiting for scene resources", unit: "resources processed",
  },
  {
    id: "preparing", start: 85, end: 95,
    text: "Preparing the scene", active: "Preparing",
    detail: "Preparing materials and lighting", unit: "preparation steps complete",
  },
  {
    id: "first-frame", start: 95, end: 99,
    text: "Drawing first frame", active: "Drawing",
    detail: "The studio opens after its first frame", unit: "render steps complete",
  },
];
const DRAWING_BANDS = { loading: { start: 0, end: 45 }, preparing: { start: 45, end: 95 }, "first-frame": { start: 95, end: 99 } };
const MODES = {
  classic: { phases: CLASSIC, within: null },
  drawing: {
    phases: CLASSIC.map((phase) => ({ ...phase, ...DRAWING_BANDS[phase.id] })),
    // Shares of the preparing phase, by the stage running in it.
    within: { none: [0, 0.1], decoding: [0, 0.1], compiling: [0.1, 0.94], lighting: [0.94, 1] },
  },
};

// Named stages inside a phase. None reports partial progress of its own.
const ACTIVITIES = {
  decoding: { phases: [0, 1], text: "Decoding studio lighting", step: "Decoding", detail: "Decoding the lighting environment" },
  compiling: { phases: [1], text: "Compiling materials", step: "Compiling", detail: "Compiling materials for this GPU", unit: "shaders compiled" },
  lighting: { phases: [1], text: "Preparing lighting", step: "Lighting", detail: "Preparing lighting and post-processing" },
};
const FAILED_TEXT = "This browser can't run the 3D studio.";
// Count-only repaints at most twice a second (the status line changes only at
// stage boundaries, which paint at once).
const COUNT_PAINT_MS = 500;
const COUNT_HOLD_MS = 2000;

const controllers = new WeakMap();
const noop = () => {};
const emptyController = Object.freeze({ update: noop, setPhase: noop, complete: noop, fail: noop, getProgress: () => 0, mode: "classic",
  holdCounts: noop });

export function createStudioLoader(element, { mode = "classic" } = {}) {
  if (!element?.querySelector) return emptyController;
  if (controllers.has(element)) return controllers.get(element);
  const { phases: PHASES, within } = MODES[mode] || MODES.classic;

  const bar = element.querySelector(".exp-loader__bar");
  const fill = element.querySelector(".exp-loader__bar i");
  const status = element.querySelector(".exp-loader__text");
  const value = element.querySelector("[data-loader-value]");
  const unit = element.querySelector("[data-loader-unit]");
  const detail = element.querySelector("[data-loader-detail]");
  const steps = Array.from(element.querySelectorAll("[data-loader-stage]"));
  let phaseIndex = 0;
  let progress = 0;
  let exact = 0;
  let hasProgress = false;
  let terminal = "";
  let counts = null;
  let activity = null;
  let lastCountPaint = -Infinity;
  let countTimer = 0;

  const setText = (node, text) => {
    if (node && node.textContent !== text) node.textContent = text;
  };
  const setAttribute = (node, name, text) => {
    if (node && node.getAttribute(name) !== text) node.setAttribute(name, text);
  };
  const phaseText = () => ACTIVITIES[activity]?.text || PHASES[phaseIndex].text;
  // Counts given during a named stage measure that stage (drawing mode only).
  const measuredStage = () => !!(within && activity && ACTIVITIES[activity]?.unit && counts);
  // Unmeasured work shimmers; the stored percentage stays where real counts left it.
  const renderIndeterminate = () => {
    const unmeasured = !terminal && ((!!activity && !measuredStage()) || !counts);
    if (unmeasured) setAttribute(element, "data-indeterminate", "");
    else element.removeAttribute("data-indeterminate");
  };

  function renderProgress() {
    const phase = PHASES[phaseIndex];
    const finished = terminal === "ready";
    if (fill) {
      const transform = `scaleX(${progress / 100})`;
      if (fill.style.transform !== transform) fill.style.transform = transform;
    }
    setText(value, hasProgress ? String(progress).padStart(2, "0") : "—");
    if (unit) unit.hidden = !hasProgress;
    if (hasProgress) setAttribute(bar, "aria-valuenow", String(progress));
    else bar?.removeAttribute("aria-valuenow");
    setAttribute(bar, "aria-valuetext", finished
      ? "100% startup progress. First frame rendered."
      : `${hasProgress ? `${progress}% startup progress` : "Progress not yet available"}. ${phaseText()}.`);
    // A measured named stage shows its own line: its total grows as work is
    // submitted, so "N / M" would show a changing denominator.
    setText(detail, finished ? "First frame rendered" : counts && !measuredStage()
      ? `${counts.loaded.toLocaleString("en-US")} / ${counts.total.toLocaleString("en-US")} ${phase.unit}`
      : ACTIVITIES[activity]?.detail || phase.detail);
    setAttribute(element, "data-state", terminal || (counts ? "loading" : "waiting"));
    renderIndeterminate();
  }

  function renderPhase() {
    const phase = PHASES[phaseIndex];
    setAttribute(element, "data-phase", phase.id);
    if (activity) setAttribute(element, "data-activity", activity);
    else element.removeAttribute("data-activity");
    // Only actual phase/activity changes announce. Counts and percentages do not.
    setText(status, terminal === "ready" ? "Studio ready" : phaseText());
    for (const step of steps) {
      const index = PHASES.findIndex((item) => item.id === step.dataset.loaderStage);
      const done = terminal === "ready" || index < phaseIndex;
      const active = !terminal && index === phaseIndex;
      step.classList.toggle("is-active", active);
      step.classList.toggle("is-done", done);
      if (active) setAttribute(step, "aria-current", "step");
      else step.removeAttribute("aria-current");
      setText(step.querySelector("[data-loader-step-state]"), done ? "Ready" : active ? (ACTIVITIES[activity]?.step || phase.active) : "Waiting");
    }
  }

  // What the screen would show for the counts (a measured stage shows only
  // its percentage), so unchanged counts never repaint.
  const shown = () => `${progress}|${!counts ? "-" : measuredStage() ? "m" : `${counts.loaded}/${counts.total}`}`;
  // Paint now (a stage boundary, the end) or within COUNT_PAINT_MS (counts).
  function paintProgress() {
    clearTimeout(countTimer);
    countTimer = 0;
    lastCountPaint = performance.now();
    renderProgress();
  }
  // holdCounts(predicate): while it returns true, a measured stage's counts
  // are painted at most every COUNT_HOLD_MS (the startup drawing holds still
  // through the compile; the screen commits as rarely as it can).
  let countHold = () => false;
  function scheduleProgress() {
    const held = measuredStage() && countHold();
    const wait = (held ? COUNT_HOLD_MS : COUNT_PAINT_MS) - (performance.now() - lastCountPaint);
    if (wait <= 0) { paintProgress(); return; }
    if (!countTimer) countTimer = setTimeout(() => { countTimer = 0; if (!terminal) paintProgress(); }, wait);
  }

  function update(input = {}) {
    if (terminal || !input || typeof input !== "object") return;
    const nextIndex = input.phase === undefined
      ? phaseIndex
      : PHASES.findIndex((item) => item.id === input.phase);
    // Reject unknown and out-of-order phases, including their stale counts.
    if (nextIndex < phaseIndex) return;
    let statusChanged = false;
    if (nextIndex !== phaseIndex) {
      phaseIndex = nextIndex;
      counts = null;
      activity = null;
      hasProgress = true;
      exact = Math.max(exact, PHASES[phaseIndex].start);
      progress = Math.max(progress, PHASES[phaseIndex].start);
      statusChanged = true;
    }
    const nextActivity = input.activity === null ? null : ACTIVITIES[input.activity] ? input.activity : undefined;
    if (nextActivity !== undefined && (nextActivity === null || ACTIVITIES[nextActivity].phases.includes(phaseIndex)) &&
      nextActivity !== activity) {
      activity = nextActivity;
      statusChanged = true;
      // Drawing mode: a later stage starts where its share starts, and the
      // previous stage's counts no longer describe it.
      if (within && PHASES[phaseIndex].id === "preparing" && activity) {
        const phase = PHASES[phaseIndex], share = within[activity] || within.none;
        exact = Math.max(exact, phase.start + share[0] * (phase.end - phase.start));
        progress = Math.max(progress, Math.floor(exact));
        if (!("loaded" in input)) counts = null;
      }
    }
    if (statusChanged) renderPhase();
    const before = shown();
    if ("loaded" in input || "total" in input) {
      const { loaded, total } = input;
      if (Number.isFinite(loaded) && loaded >= 0 && Number.isFinite(total) && total > 0) {
        const phase = PHASES[phaseIndex];
        counts = { loaded, total };
        hasProgress = true;
        let fraction = Math.min(1, loaded / total);
        if (within && phase.id === "preparing") {
          const share = within[activity || "none"] || within.none;
          fraction = share[0] + fraction * (share[1] - share[0]);
        }
        exact = Math.max(exact, phase.start + fraction * (phase.end - phase.start));
        progress = Math.max(progress, Math.floor(exact));
      } else {
        counts = null;
      }
    }
    if (statusChanged) paintProgress();
    else if (shown() !== before) scheduleProgress();
  }

  function setPhase(phase) {
    update({ phase });
  }

  function complete() {
    if (terminal) return;
    terminal = "ready";
    progress = 100;
    exact = 100;
    hasProgress = true;
    phaseIndex = PHASES.length - 1;
    activity = null;
    renderPhase();
    paintProgress();
  }

  function fail(message) {
    if (terminal === "failed") return;
    terminal = "failed";
    activity = null;
    clearTimeout(countTimer);
    countTimer = 0;
    const text = typeof message === "string" && message.trim() ? message.trim() : FAILED_TEXT;
    setAttribute(element, "data-state", "failed");
    element.removeAttribute("data-activity");
    element.removeAttribute("data-indeterminate");
    element.removeAttribute("aria-hidden");
    setText(status, text);
    bar?.removeAttribute("aria-valuenow");
    setAttribute(bar, "aria-valuetext", "Studio unavailable");
    for (const step of steps) {
      step.classList.remove("is-active");
      step.removeAttribute("aria-current");
    }
  }

  // Limit aria-live to phase/error text, including when used with older markup.
  element.removeAttribute("aria-live");
  setAttribute(element, "role", "region");
  setAttribute(element, "aria-label", "Studio startup");
  setAttribute(status, "role", "status");
  setAttribute(status, "aria-live", "polite");
  setAttribute(status, "aria-atomic", "true");
  setAttribute(bar, "role", "progressbar");
  setAttribute(bar, "aria-valuemin", "0");
  setAttribute(bar, "aria-valuemax", "100");
  if (bar && !bar.hasAttribute("aria-labelledby")) setAttribute(bar, "aria-label", "Startup progress");
  if (fill) fill.style.width = "100%";
  renderPhase();
  renderProgress();

  const controller = Object.freeze({ update, setPhase, complete, fail, getProgress: () => exact, mode,
    holdCounts: (predicate) => { countHold = typeof predicate === "function" ? predicate : () => false; } });
  controllers.set(element, controller);
  return controller;
}
