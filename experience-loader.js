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
 * loader.setPhase("first-frame"); // scene preparation has actually finished
 * loader.complete(); // ONLY after the real scene's first frame has rendered
 * // On a fatal startup/WebGL failure: loader.fail("WebGL unavailable. View the classic site.");
 *
 * Counts are finite, nonnegative work-unit counts WITHIN the specified phase.
 * Omit total (or pass zero) when the amount of work is unknown; no progress is invented.
 * Startup progress is stage-weighted, not byte/download progress or elapsed time:
 * loading 0–85%, preparing 85–95%, first-frame 95–99%. Only complete() yields 100%.
 * Phase order and displayed percentages never go backwards, even if totals grow.
 * Advancing a phase asserts all previous phases are finished. Late events from an
 * earlier phase are ignored. Supply phase on asynchronous count updates.
 * Optional activity is "decoding" or null. It changes only the current phase's
 * status label, never its counts or percentage. Omission preserves the activity;
 * null restores the normal phase label. Advancing a phase clears it automatically.
 * Decoding is accepted during loading/preparing, never after the first-frame gate.
 * Drive this label from actual decode lifecycle events, not individual worker chunks.
 * complete() and fail() settle this startup; subsequent progress calls do nothing.
 * fail() may override completion if a fatal failure occurs during reveal.
 *
 * The caller owns .exp-ready / revealScene(), aria-hidden after the fade, and the
 * lighting boot. This module never hides the loader, starts the boot or uses storage.
 * Calling the factory again for the same element returns the same controller.
 * A missing element is safe. No auto-init; import and connect from experience.js.
 */

const PHASES = [
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
    text: "Waiting for the first frame", active: "Rendering",
    detail: "The studio opens after its first frame", unit: "render steps complete",
  },
];

const controllers = new WeakMap();
const noop = () => {};
const emptyController = Object.freeze({ update: noop, setPhase: noop, complete: noop, fail: noop });

export function createStudioLoader(element) {
  if (!element?.querySelector) return emptyController;
  if (controllers.has(element)) return controllers.get(element);

  const bar = element.querySelector(".exp-loader__bar");
  const fill = element.querySelector(".exp-loader__bar i");
  const status = element.querySelector(".exp-loader__text");
  const value = element.querySelector("[data-loader-value]");
  const unit = element.querySelector("[data-loader-unit]");
  const detail = element.querySelector("[data-loader-detail]");
  const steps = Array.from(element.querySelectorAll("[data-loader-stage]"));
  let phaseIndex = 0;
  let progress = 0;
  let hasProgress = false;
  let terminal = "";
  let counts = null;
  let activity = null;

  const setText = (node, text) => {
    if (node && node.textContent !== text) node.textContent = text;
  };
  const setAttribute = (node, name, text) => {
    if (node && node.getAttribute(name) !== text) node.setAttribute(name, text);
  };
  const phaseText = () => activity === "decoding" ? "Decoding studio lighting" : PHASES[phaseIndex].text;

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
    setText(detail, finished ? "First frame rendered" : counts
      ? `${counts.loaded.toLocaleString("en-US")} / ${counts.total.toLocaleString("en-US")} ${phase.unit}`
      : activity === "decoding" ? "Decoding the lighting environment" : phase.detail);
    setAttribute(element, "data-state", terminal || (counts ? "loading" : "waiting"));
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
      setText(step.querySelector("[data-loader-step-state]"), done ? "Ready" : active ? (activity === "decoding" ? "Decoding" : phase.active) : "Waiting");
    }
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
      progress = Math.max(progress, PHASES[phaseIndex].start);
      statusChanged = true;
    }
    if ((input.activity === null || input.activity === "decoding") && phaseIndex < 2 && input.activity !== activity) {
      activity = input.activity;
      statusChanged = true;
    }
    if (statusChanged) renderPhase();
    if ("loaded" in input || "total" in input) {
      const { loaded, total } = input;
      if (Number.isFinite(loaded) && loaded >= 0 && Number.isFinite(total) && total > 0) {
        const phase = PHASES[phaseIndex];
        counts = { loaded, total };
        hasProgress = true;
        const fraction = Math.min(1, loaded / total);
        progress = Math.max(progress, Math.floor(phase.start + fraction * (phase.end - phase.start)));
      } else {
        counts = null;
      }
    }
    renderProgress();
  }

  function setPhase(phase) {
    update({ phase });
  }

  function complete() {
    if (terminal) return;
    terminal = "ready";
    progress = 100;
    hasProgress = true;
    phaseIndex = PHASES.length - 1;
    activity = null;
    renderPhase();
    renderProgress();
  }

  function fail(message) {
    if (terminal === "failed") return;
    terminal = "failed";
    activity = null;
    const text = typeof message === "string" && message.trim()
      ? message.trim()
      : "The 3D studio could not start. View the classic site.";
    setAttribute(element, "data-state", "failed");
    element.removeAttribute("data-activity");
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

  const controller = Object.freeze({ update, setPhase, complete, fail });
  controllers.set(element, controller);
  return controller;
}
