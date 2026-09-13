/* On-demand, offline-rendered project previews. No video or WebGL runtime. */
(() => {
  "use strict";

  const projectCards = [...document.querySelectorAll(".editorial .project-card[data-project]")];
  if (!projectCards.length) return;
  const script = document.currentScript;
  const manifestURL = new URL(script?.dataset.manifest || "assets/exploded/manifest.json?v=motion-refinement-20260913", document.baseURI);
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const states = new Map();
  const cache = new Map();
  const LOAD_CONCURRENCY = 3;
  const CACHE_LIMIT = 2;
  const DECODED_MEMORY_LIMIT = 160 * 1024 * 1024;
  const WHEEL_DISTANCE = 960;
  const MODES = {
    assembly: { label: "Assembly view", hint: "Scroll to separate", progress: "separated" },
    reconstruction: { label: "Assembly view", hint: "Scroll to separate", progress: "separated" },
    visualization: { label: "Display layers", hint: "Scroll to separate", progress: "separated" },
    heat: { label: "Brake heating", hint: "Scroll to heat", progress: "heating",
      description: "Scroll forward to heat the metal to red; reverse to cool it." },
    unfold: { label: "Sheet metal unfold", hint: "Scroll to unfold", progress: "unfolded",
      description: "Scroll forward to unfold the seat panels; reverse to fold them." },
    layup: { label: "Carbon layup · 10 plies", hint: "Scroll to lay up", progress: "laid up",
      description: "Ten carbon cloth layers are placed one at a time. Reverse to remove them." },
    steering: { label: "Steering linkage", hint: "Scroll to steer", progress: "through steering cycle",
      description: "Turn the steering wheel and follow the universal joints and rack." },
    extension: { label: "Vine extension", hint: "Scroll to extend", progress: "extended" },
    propellers: { label: "Propeller rotation", hint: "Scroll to spin", progress: "through rotation" },
    gantry: { label: "Gantry motion", hint: "Scroll to move", progress: "through travel" },
    tensile: { label: "Tensile test", hint: "Scroll to pull", progress: "through tensile test",
      description: "The grips stretch the specimen until it breaks. Reverse to restore it." },
    flow: { label: "Pressure & flow", hint: "Scroll through flow", progress: "through flow" },
    assembling: { label: "Guitar assembly", hint: "Scroll to assemble", progress: "assembled" },
    retract_release: { label: "Retract & release", hint: "Scroll to launch", progress: "through launch cycle",
      description: "Retract the cue and rack, hold, then release forward. Reverse to rewind." },
    drive_sway: { label: "Wheel drive & steering", hint: "Scroll to drive", progress: "through drive cycle",
      description: "The wheels roll as the robot steers left and right." },
  };
  const clamp = (value) => Math.max(0, Math.min(1, value));
  let active = null;
  let animationFrame = 0;
  let lastTime = 0;

  const allowed = (state) => state.visible && !state.card.classList.contains("is-hidden")
    && !document.hidden && !document.body.classList.contains("modal-open") && !state.failed;

  function stopAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastTime = 0;
  }

  function placedPlies(state, progress) {
    const last = state.config.frames.length - 1;
    return Math.floor(Math.round(progress * last) / last * 10 + 0.000001);
  }

  function reflectProgress(state) {
    const percent = Math.round(state.target * 100);
    state.range.value = String(Math.round(state.target * 1000) / 10);
    const action = MODES[state.config.mode];
    state.range.setAttribute("aria-valuetext", state.config.mode === "layup"
      ? `${percent}% laid up, ${placedPlies(state, state.target)} of 10 plies placed`
      : `${percent}% ${action.progress}`);
    state.card.style.setProperty("--explode-progress", `${percent}%`);
    if (state.config.mode === "layup") {
      state.badge.textContent = `Carbon layup · ${placedPlies(state, state.progress)}/10`;
    }
  }

  function draw(state) {
    const entry = cache.get(state.key);
    if (!entry || entry.status !== "ready" || !allowed(state)) return;
    const index = Math.round(state.progress * (entry.frames.length - 1));
    if (index !== state.index || !state.stage.firstChild) {
      state.stage.replaceChildren(entry.frames[index].image);
      state.index = index;
    }
    state.card.classList.toggle("is-explode-playing", state.progress > 0.001);
    if (state.config.mode === "layup") {
      state.badge.textContent = `Carbon layup · ${placedPlies(state, state.progress)}/10`;
    }
  }

  function animate(now) {
    animationFrame = 0;
    if (!active || !allowed(active)) {
      resetAll();
      return;
    }
    const state = active;
    const elapsed = lastTime ? Math.min(64, now - lastTime) : 16;
    lastTime = now;
    const change = (state.target - state.progress) * (1 - Math.exp(-elapsed / 100));
    // Bound large wheel jumps so intermediate mechanism poses remain visible.
    const maximumStep = elapsed / 1800;
    state.progress += Math.max(-maximumStep, Math.min(maximumStep, change));
    if (Math.abs(state.target - state.progress) < 0.001) state.progress = state.target;
    draw(state);
    if (state.progress !== state.target) animationFrame = requestAnimationFrame(animate);
    else lastTime = 0;
  }

  function setProgress(state, progress, direct = false) {
    state.target = clamp(progress);
    reflectProgress(state);
    if (cache.get(state.key)?.status !== "ready") return;
    if (direct || reducedMotion.matches) {
      stopAnimation();
      state.progress = state.target;
      draw(state);
    } else if (!animationFrame) {
      animationFrame = requestAnimationFrame(animate);
    }
  }

  function resetState(state, immediate = false) {
    if (!state) return;
    if (active === state) {
      stopAnimation();
      active = null;
    }
    if (immediate) {
      state.poster.style.transition = "none";
      state.stage.style.transition = "none";
    }
    state.target = 0;
    state.progress = 0;
    state.owner = null;
    state.dragging = false;
    state.card.classList.remove("is-explode-playing", "is-explode-active");
    reflectProgress(state);
    const entry = cache.get(state.key);
    if (entry?.status === "loading") {
      entry.cancelled = true;
      entry.controller.abort();
    }
  }

  function resetAll() {
    stopAnimation();
    states.forEach((state) => resetState(state));
  }

  function release(entry, reset = true) {
    entry.cancelled = true;
    entry.controller.abort();
    const state = states.get(entry.key);
    if (state && cache.get(entry.key) === entry) {
      if (reset) resetState(state, true);
      state.stage.replaceChildren();
      state.index = -1;
      state.card.classList.remove("is-explode-ready", "is-explode-loading");
      state.range.removeAttribute("aria-busy");
    }
    entry.frames.forEach((frame) => {
      if (!frame) return;
      frame.image.removeAttribute("src");
      URL.revokeObjectURL(frame.url);
    });
    entry.frames.length = 0;
    if (cache.get(entry.key) === entry) cache.delete(entry.key);
  }

  function touchCache(entry) {
    cache.delete(entry.key);
    cache.set(entry.key, entry);
  }

  async function loadFrames(state) {
    let entry = cache.get(state.key);
    if (entry?.status === "ready") {
      touchCache(entry);
      return entry;
    }
    if (entry && !entry.controller.signal.aborted) return entry.promise;
    if (entry) {
      await entry.promise;
      if (active !== state || !allowed(state)) return null;
    }
    if (active !== state || !allowed(state)) return null;

    // Only the active project can download. Ready projects remain in a two-item LRU.
    for (const other of [...cache.values()]) {
      if (other.status === "loading") {
        other.cancelled = true;
        other.controller.abort();
        await other.promise;
      }
    }
    if (active !== state || !allowed(state)) return null;
    const decodedBytes = state.config.width * state.config.height * 4 * state.config.frames.length;
    const retainedBytes = () => [...cache.values()].reduce((sum, item) => sum + item.decodedBytes, 0);
    while (cache.size && (cache.size >= CACHE_LIMIT || retainedBytes() + decodedBytes > DECODED_MEMORY_LIMIT)) {
      release(cache.values().next().value);
    }
    entry = { key: state.key, decodedBytes, status: "loading", controller: new AbortController(), frames: [], promise: null, cancelled: false };
    cache.set(state.key, entry);
    state.card.classList.add("is-explode-loading");
    state.range.setAttribute("aria-busy", "true");
    const { signal } = entry.controller;
    let nextIndex = 0;

    async function worker() {
      try {
        while (!signal.aborted) {
          const index = nextIndex++;
          if (index >= state.config.frames.length) return;
          const response = await fetch(state.config.frames[index], { signal, cache: "force-cache" });
          if (!response.ok) throw new Error(`Preview frame HTTP ${response.status}`);
          const blob = await response.blob();
          if (signal.aborted) throw new DOMException("Preview cancelled", "AbortError");
          const url = URL.createObjectURL(blob);
          const image = new Image();
          image.className = "card-explode-frame";
          image.alt = "";
          image.width = state.config.width;
          image.height = state.config.height;
          image.draggable = false;
          image.decoding = "async";
          entry.frames[index] = { image, url };
          image.src = url;
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error("Empty preview frame");
          if (signal.aborted) throw new DOMException("Preview cancelled", "AbortError");
        }
      } catch (error) {
        entry.controller.abort();
        throw error;
      }
    }

    entry.promise = Promise.allSettled(Array.from({ length: Math.min(LOAD_CONCURRENCY, state.config.frames.length) }, worker))
      .then((results) => {
        const failure = !entry.cancelled && results.find((result) => result.status === "rejected" && result.reason?.name !== "AbortError");
        if (signal.aborted || failure || active !== state || !allowed(state)) {
          release(entry, false);
          if (failure) {
            resetState(state, true);
            state.failed = true;
            state.card.classList.remove("has-explode");
            state.ui.hidden = true;
          }
          return null;
        }
        entry.status = "ready";
        state.card.classList.remove("is-explode-loading");
        state.card.classList.add("is-explode-ready");
        state.range.removeAttribute("aria-busy");
        state.progress = state.target;
        draw(state);
        return entry;
      });
    return entry.promise;
  }

  function requestFrames(state) {
    if (state.loadJob) return;
    // One job per card also covers the interval spent awaiting another card's
    // cancellation. Focus + input during that interval must not start two loads.
    state.loadJob = loadFrames(state).catch(() => {
      const entry = cache.get(state.key);
      if (entry) release(entry);
      state.failed = true;
      state.card.classList.remove("has-explode");
      state.ui.hidden = true;
    }).finally(() => {
      state.loadJob = null;
      // A pointer can leave and re-enter before its aborted request has settled.
      if (active === state && allowed(state) && !cache.has(state.key)) requestFrames(state);
    });
  }

  function activate(state, owner) {
    // Native keyboard focus can scroll a card into view before its observer runs.
    const rect = state.card.getBoundingClientRect();
    state.visible = rect.bottom > 0 && rect.top < innerHeight;
    if (!allowed(state)) return;
    if (active !== state) {
      if (active) resetState(active);
      active = state;
    }
    state.owner = owner;
    state.poster.style.removeProperty("transition");
    state.stage.style.removeProperty("transition");
    state.card.classList.add("is-explode-active");
    requestFrames(state);
  }

  // A .card-open pseudo-element may stretch across the card. It is intentionally
  // allowed here; actual sliders, downloads and other independent controls are not.
  function isIndependentControl(target) {
    return Boolean(target.closest("[data-explode-control], a, input, select, textarea, button:not(.card-open)"));
  }

  function onWheel(state, event) {
    if (!finePointer.matches || !allowed(state) || event.ctrlKey || event.metaKey
      || !event.cancelable || isIndependentControl(event.target)
      || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (active !== state) activate(state, "wheel");
    if (cache.get(state.key)?.status !== "ready") return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? state.media.clientHeight : 1;
    const next = clamp(state.target + event.deltaY * unit / WHEEL_DISTANCE);
    if (next === state.target) return;
    event.preventDefault();
    state.owner = "wheel";
    setProgress(state, next);
  }

  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      const state = states.get(target.dataset.project);
      if (!state) return;
      state.visible = isIntersecting;
      if (!isIntersecting) resetState(state);
      else if (document.activeElement === state.range) {
        activate(state, "control");
        setProgress(state, Number(state.range.value) / 100, true);
      }
    });
  }, { threshold: 0 });

  function frameURL(value) {
    if (typeof value !== "string") throw new Error("Invalid preview URL");
    const url = new URL(value, value.startsWith("assets/") ? document.baseURI : manifestURL);
    if (url.origin !== location.origin || !url.pathname.endsWith(".webp")) throw new Error("Invalid preview asset");
    return url.href;
  }

  function normalizeConfig(config) {
    if (!config || config.enabled === false || !Array.isArray(config.frames) || config.frames.length < 2 || config.frames.length > 181
      || !Number.isFinite(config.width) || !Number.isFinite(config.height)
      || config.width <= 0 || config.height <= 0 || config.width > 1920 || config.height > 1280
      || config.width * config.height * 4 * config.frames.length > DECODED_MEMORY_LIMIT) return null;
    const mode = Object.hasOwn(MODES, config.mode) ? config.mode : "assembly";
    return { mode, width: config.width, height: config.height, frames: config.frames.map(frameURL) };
  }

  function setupCard(card, config) {
    const media = card.querySelector(".card-media");
    const poster = media?.querySelector("img");
    if (!media || !poster) return;
    const key = card.dataset.project;
    const title = card.querySelector("h3")?.textContent.trim() || key;
    const { label, hint, description } = MODES[config.mode];
    const stage = document.createElement("div");
    stage.className = "card-explode-stage";
    stage.setAttribute("aria-hidden", "true");
    const ui = document.createElement("div");
    ui.className = "card-explode-ui";
    const badge = document.createElement("span");
    badge.className = "card-explode-label";
    badge.textContent = label;
    badge.setAttribute("aria-hidden", "true");
    const controls = document.createElement("div");
    controls.className = "card-explode-controls";
    controls.dataset.explodeControl = "";
    controls.dataset.hint = hint;
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.step = "0.1";
    range.value = "0";
    range.setAttribute("aria-label", `${title}: ${label.toLowerCase()} progress`);
    if (description) range.setAttribute("aria-description", description);
    controls.append(range);
    ui.append(badge, controls);
    media.append(stage, ui);
    poster.classList.add("card-explode-poster");
    card.classList.add("has-explode");
    card.dataset.explodeMode = config.mode;
    const rect = card.getBoundingClientRect();
    const state = { key, config, card, media, poster, stage, ui, range, badge, target: 0, progress: 0, index: -1,
      visible: rect.bottom > 0 && rect.top < innerHeight, owner: null, pointerInside: false, dragging: false, failed: false, loadJob: null };
    states.set(key, state);
    reflectProgress(state);
    visibilityObserver.observe(card);

    card.addEventListener("pointerenter", (event) => {
      if (!finePointer.matches || event.pointerType === "touch") return;
      state.pointerInside = true;
      activate(state, "wheel");
    });
    card.addEventListener("pointerleave", (event) => {
      // Touch release ends implicit pointer capture and emits pointerleave. That
      // must not erase the slider's value or abort the preview it just requested.
      if (event.pointerType === "touch") return;
      state.pointerInside = false;
      if (!state.dragging) resetState(state);
    });
    card.addEventListener("pointercancel", () => {
      state.pointerInside = false;
      resetState(state);
    });
    card.addEventListener("wheel", (event) => onWheel(state, event), { passive: false });
    controls.addEventListener("click", (event) => event.stopPropagation());
    controls.addEventListener("keydown", (event) => event.stopPropagation());
    range.addEventListener("focus", () => activate(state, "control"));
    range.addEventListener("input", () => {
      activate(state, "control");
      setProgress(state, Number(range.value) / 100, true);
    });
    range.addEventListener("pointerdown", () => {
      activate(state, "control");
      state.dragging = true;
    });
    range.addEventListener("blur", () => {
      if (!state.pointerInside) resetState(state);
    });
  }

  addEventListener("pointerup", (event) => {
    if (!active?.dragging) return;
    const state = active;
    state.dragging = false;
    if (event.pointerType !== "touch" && finePointer.matches && !state.pointerInside) resetState(state);
  });
  addEventListener("blur", resetAll);
  addEventListener("pagehide", () => {
    resetAll();
    for (const entry of [...cache.values()]) release(entry);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) resetAll(); });
  finePointer.addEventListener("change", resetAll);
  reducedMotion.addEventListener("change", resetAll);

  window.cardExplosions = {
    reset(card, immediate = false) { resetState(states.get(card?.dataset.project), immediate); },
    resetAll(immediate = false) {
      states.forEach((state) => resetState(state, immediate));
    },
  };

  fetch(manifestURL, { cache: "no-cache" })
    .then((response) => { if (!response.ok) throw new Error("Preview manifest unavailable"); return response.json(); })
    .then((manifest) => {
      if (manifest.version !== 1 || !manifest.projects) return;
      projectCards.forEach((card) => {
        try {
          const config = normalizeConfig(manifest.projects[card.dataset.project]);
          if (config) setupCard(card, config);
        } catch { /* An invalid project keeps its original working cover. */ }
      });
    })
    .catch(() => { /* The original portfolio remains fully usable offline or on failure. */ });
})();
