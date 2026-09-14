/* On-demand, offline-rendered project previews. No video or WebGL runtime. */
(() => {
  "use strict";

  const hostSelector = ".editorial .project-card[data-project], .case-animation-host[data-project]";
  const script = document.currentScript;
  const manifestURL = new URL(script?.dataset.manifest || "assets/exploded/manifest.json?v=confirmed-build-20260914", document.baseURI);
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const states = new Map();
  const cache = new Map();
  const loadingEntries = new Set();
  const LOAD_CONCURRENCY = 3;
  const CACHE_LIMIT = 2;
  const DECODED_MEMORY_LIMIT = 160 * 1024 * 1024;
  const STREAM_READY_LIMIT = 32;
  const STREAM_BLOB_MEMORY_LIMIT = 16 * 1024 * 1024;
  let streamingDecodedBytes = 0;
  let cacheClock = 0;
  const WHEEL_DISTANCE = 960;
  const MODES = {
    assembly: { label: "Assembly view", hint: "Scroll to separate", progress: "separated" },
    reconstruction: { label: "Assembly view", hint: "Scroll to separate", progress: "separated" },
    visualization: { label: "Display layers", hint: "Scroll to separate", progress: "separated" },
    heat: { label: "Brake heating", hint: "Scroll to heat", progress: "heating",
      description: "Scroll forward to heat the metal to red; reverse to cool it." },
    unfold: { label: "Sheet metal unfold", hint: "Scroll to unfold", progress: "unfolded",
      description: "Scroll forward to unfold the seat panels; reverse to fold them." },
    layup: { label: "Carbon layup", hint: "Scroll to lay up", progress: "laid up",
      description: "An illustration of cloth placement. Reverse to rewind the layup." },
    steering: { label: "Steering linkage", hint: "Scroll to steer", progress: "through steering cycle",
      description: "Turn the steering wheel and follow the universal joints and rack." },
    extension: { label: "Vine extension", hint: "Scroll to extend", progress: "extended" },
    propellers: { label: "Propeller rotation", hint: "Scroll to spin", progress: "through rotation" },
    flight: { label: "Javelin flight", hint: "Scroll to fly", progress: "through flight",
      description: "Follow the aircraft in flight with all four propellers turning. Reverse to rewind." },
    turntable: { label: "360° view", hint: "Scroll to rotate", progress: "through rotation",
      description: "Rotate the guitar through a full 360 degrees. Reverse to turn it back." },
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
  let previewProjects = null;

  const allowed = (state) => state.visible && !state.card.classList.contains("is-hidden")
    && !document.hidden && !document.body.classList.contains("modal-open")
    && !document.body.classList.contains("lightbox-open") && !state.failed;

  function stopAnimation() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    lastTime = 0;
  }

  function reflectProgress(state) {
    const percent = Math.round(state.target * 100);
    state.range.value = String(Math.round(state.target * 1000) / 10);
    const action = MODES[state.config.mode];
    state.range.setAttribute("aria-valuetext", `${percent}% ${action.progress}`);
    state.card.style.setProperty("--explode-progress", `${percent}%`);
    if (state.config.mode === "layup") {
      state.badge.textContent = `Carbon layup · ${Math.round(state.progress * 100)}%`;
    }
  }

  function draw(state) {
    const entry = cache.get(state.key);
    if (!entry || entry.cancelled || !allowed(state)) return;
    const index = Math.round(state.progress * (entry.frames.length - 1));
    // Never substitute a nearby pose: a seek can leave holes while chunks arrive.
    if (!entry.frames[index]?.ready) return;
    if (index !== state.index || state.stage.firstChild !== entry.frames[index].image) {
      state.stage.replaceChildren(entry.frames[index].image);
      state.index = index;
    }
    if (entry.streaming) entry.frames[index].used = ++cacheClock;
    state.card.classList.add("is-explode-ready");
    state.card.classList.remove("is-explode-loading");
    state.range.removeAttribute("aria-busy");
    // Tiny wheel/range changes can still round to frame zero. Keep the sharper
    // matching cover until a decoded frame actually shows a different pose.
    state.card.classList.toggle("is-explode-playing", index > 0);
    if (state.config.mode === "layup") {
      state.badge.textContent = `Carbon layup · ${Math.round(state.progress * 100)}%`;
    }
    if (entry.streaming) entry.wake();
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
    let next = state.progress + Math.max(-maximumStep, Math.min(maximumStep, change));
    if (Math.abs(state.target - next) < 0.001) next = state.target;
    const index = Math.round(next * (state.config.frames.length - 1));
    const currentIndex = Math.round(state.progress * (state.config.frames.length - 1));
    const direction = Math.sign(index - currentIndex);
    let needed = direction ? currentIndex + direction : index;
    const frames = cache.get(state.key)?.frames;
    while (needed !== index && frames?.[needed]?.ready) needed += direction;
    if (!frames?.[needed]?.ready) {
      // Resume from this pose when it is decoded instead of skipping over it or
      // spending animation frames polling the network.
      state.waitingIndex = needed;
      lastTime = 0;
      if (state.config.streaming) requestFrames(state);
      return;
    }
    state.waitingIndex = null;
    state.progress = next;
    draw(state);
    if (state.progress !== state.target) animationFrame = requestAnimationFrame(animate);
    else lastTime = 0;
  }

  function setProgress(state, progress, direct = false) {
    state.target = clamp(progress);
    state.waitingIndex = null;
    reflectProgress(state);
    if (direct || reducedMotion.matches) {
      stopAnimation();
      state.progress = state.target;
      if (!cache.get(state.key)?.frames[Math.round(state.progress * (state.config.frames.length - 1))]?.ready) {
        state.card.classList.add("is-explode-loading");
        state.range.setAttribute("aria-busy", "true");
      }
      draw(state);
    } else if (!animationFrame) {
      animationFrame = requestAnimationFrame(animate);
    }
    if (state.config.streaming) requestFrames(state);
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
    state.waitingIndex = null;
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
      if (entry.streaming) discardStreamingFrame(entry, frame);
      else {
        frame.image.removeAttribute("src");
        URL.revokeObjectURL(frame.url);
      }
    });
    if (entry.streaming) entry.blobs.clear();
    entry.frames.length = 0;
    if (cache.get(entry.key) === entry) cache.delete(entry.key);
  }

  function touchCache(entry) {
    cache.delete(entry.key);
    cache.set(entry.key, entry);
  }

  // HD sequences keep compressed chunks separately and decode a moving window.
  // The ordinary 640px path below still reserves and retains its entire sequence.
  function streamingPins(entry) {
    const state = states.get(entry.key);
    if (!state || active !== state) return new Set();
    const last = state.config.frames.length - 1;
    return new Set([state.index, state.waitingIndex,
      Math.round(state.progress * last), Math.round(state.target * last)]);
  }

  function discardStreamingFrame(entry, frame) {
    frame.discarded = true;
    if (!frame.revoked) {
      frame.image.removeAttribute("src");
      URL.revokeObjectURL(frame.url);
      frame.revoked = true;
    }
    if (entry.frames[frame.index] === frame) entry.frames[frame.index] = undefined;
    // Removing src does not synchronously cancel a native decode. Its reservation
    // survives eviction/pagehide until that promise actually settles.
    if (!frame.decoding && frame.reserved) {
      frame.reserved = false;
      entry.decodedBytes -= entry.frameBytes;
      streamingDecodedBytes -= entry.frameBytes;
    }
  }

  function streamingVictim(entries) {
    let victim = null;
    for (const entry of entries) {
      if (!entry.streaming) continue;
      const pins = streamingPins(entry);
      for (const frame of entry.frames) {
        if (!frame?.ready || frame.decoding || pins.has(frame.index)) continue;
        if (!victim || frame.used < victim.frame.used) victim = { entry, frame };
      }
    }
    return victim;
  }

  function reserveStreamingFrame(entry) {
    const usedBytes = () => streamingDecodedBytes + [...cache.values()]
      .reduce((sum, item) => sum + (item.streaming ? 0 : item.decodedBytes), 0);
    while (usedBytes() + entry.frameBytes > DECODED_MEMORY_LIMIT) {
      const inactive = [...cache.values()].find((item) => item !== entry && active?.key !== item.key);
      if (inactive) { release(inactive); continue; }
      const victim = streamingVictim(cache.values());
      if (!victim) return false;
      discardStreamingFrame(victim.entry, victim.frame);
    }
    entry.decodedBytes += entry.frameBytes;
    streamingDecodedBytes += entry.frameBytes;
    return true;
  }

  function trimStreamingFrames(entry) {
    const readyCount = () => [...cache.values()].reduce((sum, item) => sum
      + (item.streaming ? item.frames.filter((frame) => frame?.ready).length : 0), 0);
    while (readyCount() > entry.readyLimit) {
      const victim = streamingVictim(cache.values());
      if (!victim) return;
      discardStreamingFrame(victim.entry, victim.frame);
    }
  }

  function retainStreamingBlob(entry, key, blob) {
    if (blob.size > STREAM_BLOB_MEMORY_LIMIT) return;
    entry.blobs.set(key, { blob, used: ++cacheClock });
    let total = 0;
    const blobs = [];
    for (const owner of cache.values()) {
      if (!owner.streaming) continue;
      for (const [blobKey, record] of owner.blobs) {
        total += record.blob.size;
        blobs.push({ owner, blobKey, record });
      }
    }
    blobs.sort((a, b) => a.record.used - b.record.used);
    while (total > STREAM_BLOB_MEMORY_LIMIT && blobs.length) {
      const oldest = blobs.shift();
      oldest.owner.blobs.delete(oldest.blobKey);
      total -= oldest.record.blob.size;
    }
  }

  async function loadStreamingFrames(state) {
    let entry = cache.get(state.key);
    if (entry && !entry.controller.signal.aborted && !entry.cancelled) {
      touchCache(entry);
      entry.wake();
      draw(state);
      return entry.promise;
    }
    if (entry) await entry.promise;
    if (active !== state || !allowed(state)) return null;
    for (const other of [...loadingEntries]) {
      other.cancelled = true;
      other.controller.abort();
      await other.promise;
    }
    if (active !== state || !allowed(state)) return null;
    while (cache.size >= CACHE_LIMIT) release(cache.values().next().value);

    const frameBytes = state.config.width * state.config.height * 4;
    entry = { key: state.key, streaming: true, frameBytes, decodedBytes: 0,
      readyLimit: Math.min(STREAM_READY_LIMIT, state.config.frames.length,
        Math.floor(DECODED_MEMORY_LIMIT / frameBytes) - LOAD_CONCURRENCY),
      status: "ready", controller: new AbortController(), frames: Array(state.config.frames.length),
      promise: Promise.resolve(null), cancelled: false, running: false,
      pending: new Set(), blobs: new Map(), blobJobs: new Map(), failedChunks: new Set(), wake: null };
    cache.set(state.key, entry);
    const { signal } = entry.controller;
    const chunkByFrame = new Map();
    (state.config.chunks || []).forEach((chunk, chunkIndex) => {
      chunk.frames.forEach((frame) => chunkByFrame.set(frame.index, { ...frame, chunk, chunkIndex }));
    });
    const alive = () => !signal.aborted && !entry.cancelled && cache.get(state.key) === entry
      && active === state && allowed(state);
    const aborted = () => new DOMException("Preview cancelled", "AbortError");

    function wantedFrames() {
      const last = state.config.frames.length - 1;
      const current = Math.round(state.progress * last);
      const center = state.waitingIndex ?? current;
      const wanted = new Set();
      const add = (index) => {
        if (Number.isInteger(index) && index >= 0 && index <= last && wanted.size < entry.readyLimit) wanted.add(index);
      };
      add(center); add(current); add(Math.round(state.target * last)); add(state.index);
      const direction = state.target < state.progress ? -1 : 1;
      for (let distance = 1; wanted.size < entry.readyLimit && distance <= last; distance++) {
        add(center + direction * distance); add(center - direction * distance);
      }
      return [...wanted];
    }

    async function fetchBlob(url) {
      const response = await fetch(url, { signal, cache: "force-cache" });
      if (!response.ok) throw new Error(`Preview asset HTTP ${response.status}`);
      const blob = await response.blob();
      if (!alive()) throw aborted();
      return blob;
    }

    async function cachedBlob(key, url, bytes) {
      const retained = entry.blobs.get(key);
      if (retained) { retained.used = ++cacheClock; return retained.blob; }
      if (entry.blobJobs.has(key)) return entry.blobJobs.get(key);
      const job = fetchBlob(url).then((blob) => {
        if (bytes !== undefined && blob.size !== bytes) throw new Error("Incomplete preview chunk");
        retainStreamingBlob(entry, key, blob);
        return blob;
      }).finally(() => entry.blobJobs.delete(key));
      entry.blobJobs.set(key, job);
      return job;
    }

    async function frameBlob(index, individual = false) {
      const record = chunkByFrame.get(index);
      if (record && !individual && !entry.failedChunks.has(record.chunkIndex)) {
        try {
          const blob = await cachedBlob(`chunk:${record.chunkIndex}`, record.chunk.url, record.chunk.bytes);
          return { blob: blob.slice(record.offset, record.offset + record.length, "image/webp"), chunkIndex: record.chunkIndex };
        } catch (error) {
          if (!alive()) throw error;
          entry.failedChunks.add(record.chunkIndex);
        }
      }
      return { blob: await cachedBlob(`frame:${index}`, state.config.frames[index]), chunkIndex: null };
    }

    async function decodeFrame(index, blob) {
      if (!alive()) throw aborted();
      if (!reserveStreamingFrame(entry)) return false;
      const image = new Image();
      const frame = { index, image, url: null, ready: false, decoding: true, reserved: true,
        discarded: false, revoked: false, used: ++cacheClock };
      entry.frames[index] = frame;
      try {
        frame.url = URL.createObjectURL(blob);
        image.className = "card-explode-frame";
        image.alt = "";
        image.width = state.config.width; image.height = state.config.height;
        image.draggable = false; image.decoding = "async";
        image.src = frame.url;
        await image.decode();
        if (image.naturalWidth !== state.config.width || image.naturalHeight !== state.config.height) throw new Error("Invalid preview dimensions");
        if (!alive() || frame.discarded) throw aborted();
        frame.decoding = false;
        frame.ready = true;
        trimStreamingFrames(entry);
        draw(state);
        if (state.progress !== state.target && !animationFrame
          && (state.waitingIndex === null || entry.frames[state.waitingIndex]?.ready)) {
          animationFrame = requestAnimationFrame(animate);
        }
        return true;
      } catch (error) {
        frame.decoding = false;
        discardStreamingFrame(entry, frame);
        throw error;
      }
    }

    async function worker() {
      try {
        while (alive()) {
          // Select one frame per turn, including after each native decode. A
          // fetched chunk never obliges us to decode all of its other frames.
          const index = wantedFrames().find((value) => !entry.frames[value]?.ready && !entry.pending.has(value));
          if (index === undefined) return;
          entry.pending.add(index);
          try {
            const source = await frameBlob(index);
            if (!alive()) throw aborted();
            if (!wantedFrames().includes(index)) continue;
            try {
              if (!await decodeFrame(index, source.blob)) return;
            } catch (error) {
              if (!alive() || source.chunkIndex === null) throw error;
              entry.failedChunks.add(source.chunkIndex);
              entry.blobs.delete(`chunk:${source.chunkIndex}`);
              const fallback = await frameBlob(index, true);
              if (!wantedFrames().includes(index)) continue;
              if (!await decodeFrame(index, fallback.blob)) return;
            }
          } finally { entry.pending.delete(index); }
        }
      } catch (error) {
        entry.controller.abort();
        throw error;
      }
    }

    entry.wake = () => {
      if (!alive() || entry.running || !wantedFrames().some((index) => !entry.frames[index]?.ready)) return;
      entry.running = true;
      entry.status = "loading";
      const current = Math.round(state.progress * (state.config.frames.length - 1));
      if (!entry.frames[current]?.ready) {
        state.card.classList.add("is-explode-loading");
        state.range.setAttribute("aria-busy", "true");
      }
      loadingEntries.add(entry);
      entry.promise = Promise.allSettled(Array.from({ length: LOAD_CONCURRENCY }, worker)).then((results) => {
        const failure = !entry.cancelled && results.find((result) => result.status === "rejected" && result.reason?.name !== "AbortError");
        if (!alive() || failure) {
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
        return entry;
      }).finally(() => {
        loadingEntries.delete(entry);
        entry.running = false;
        if (alive()) draw(state);
      });
    };
    entry.wake();
    return entry.promise;
  }

  async function loadFrames(state) {
    if (state.config.streaming) return loadStreamingFrames(state);
    let entry = cache.get(state.key);
    if (entry?.status === "ready") {
      touchCache(entry);
      draw(state);
      return entry;
    }
    if (entry && !entry.controller.signal.aborted) return entry.promise;
    if (entry) {
      await entry.promise;
      if (active !== state || !allowed(state)) return null;
    }
    if (active !== state || !allowed(state)) return null;

    // Only the active project can download. Ready projects remain in a two-item LRU.
    // Keep in-flight jobs separate from the cache: pagehide can release cached
    // images before aborts settle, including during a BFCache restoration.
    for (const other of [...loadingEntries]) {
      other.cancelled = true;
      other.controller.abort();
      await other.promise;
    }
    if (active !== state || !allowed(state)) return null;
    const decodedBytes = state.config.width * state.config.height * 4 * state.config.frames.length;
    const retainedBytes = () => [...cache.values()].reduce((sum, item) => sum + item.decodedBytes, 0);
    while (cache.size && (cache.size >= CACHE_LIMIT || retainedBytes() + decodedBytes > DECODED_MEMORY_LIMIT)) {
      release(cache.values().next().value);
    }
    entry = { key: state.key, decodedBytes, status: "loading", controller: new AbortController(),
      frames: Array(state.config.frames.length), promise: null, cancelled: false };
    cache.set(state.key, entry);
    state.card.classList.add("is-explode-loading");
    state.range.setAttribute("aria-busy", "true");
    const { signal } = entry.controller;
    // Each task owns disjoint frame indexes. Failed chunks fall back to their
    // original WebPs; neither transport changes the image bytes or dimensions.
    const tasks = state.config.chunks
      ? state.config.chunks.map((chunk) => ({ ...chunk, chunk: true }))
      : state.config.frames.map((url, index) => ({ url, frames: [{ index }] }));

    function nearest(items, score) {
      let best = 0;
      for (let i = 1; i < items.length; i++) if (score(items[i]) < score(items[best])) best = i;
      return items.splice(best, 1)[0];
    }

    function distance(frame) {
      const index = state.waitingIndex ?? Math.round(state.progress * (state.config.frames.length - 1));
      return Math.abs(frame.index - index);
    }

    async function fetchBlob(url) {
      const response = await fetch(url, { signal, cache: "force-cache" });
      if (!response.ok) throw new Error(`Preview asset HTTP ${response.status}`);
      const blob = await response.blob();
      if (signal.aborted) throw new DOMException("Preview cancelled", "AbortError");
      return blob;
    }

    async function decodeFrame(index, blob) {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.className = "card-explode-frame";
      image.alt = "";
      image.width = state.config.width;
      image.height = state.config.height;
      image.draggable = false;
      image.decoding = "async";
      const frame = { image, url, ready: false };
      entry.frames[index] = frame;
      image.src = url;
      try {
        await image.decode();
        if (image.naturalWidth !== state.config.width || image.naturalHeight !== state.config.height) throw new Error("Invalid preview dimensions");
        if (signal.aborted) throw new DOMException("Preview cancelled", "AbortError");
        frame.ready = true;
        if (active === state && allowed(state)) {
          draw(state);
          if (state.progress !== state.target && !animationFrame
            && (state.waitingIndex === null || entry.frames[state.waitingIndex]?.ready)) {
            animationFrame = requestAnimationFrame(animate);
          }
        }
      } catch (error) {
        image.removeAttribute("src");
        URL.revokeObjectURL(url);
        if (entry.frames[index] === frame) entry.frames[index] = undefined;
        throw error;
      }
    }

    async function worker() {
      try {
        while (!signal.aborted && tasks.length) {
          // Re-evaluate after every completed task: slider seeks and reversals
          // take priority over filling the rest of the sequence in order.
          const task = nearest(tasks, (item) => Math.min(...item.frames.map(distance)));
          if (!task.chunk) {
            await decodeFrame(task.frames[0].index, await fetchBlob(task.url));
            continue;
          }
          try {
            const blob = await fetchBlob(task.url);
            if (blob.size !== task.bytes) throw new Error("Incomplete preview chunk");
            const remaining = [...task.frames];
            while (remaining.length) {
              const frame = nearest(remaining, distance);
              await decodeFrame(frame.index, blob.slice(frame.offset, frame.offset + frame.length, "image/webp"));
            }
          } catch (error) {
            if (signal.aborted) throw error;
            // A stale CDN response or unsupported chunk transport must not
            // disable a preview whose original individual frames still work.
            tasks.push(...task.frames.filter(({ index }) => !entry.frames[index]?.ready)
              .map(({ index }) => ({ url: state.config.frames[index], frames: [{ index }] })));
          }
        }
      } catch (error) {
        entry.controller.abort();
        throw error;
      }
    }

    loadingEntries.add(entry);
    entry.promise = Promise.allSettled(Array.from({ length: Math.min(LOAD_CONCURRENCY, tasks.length) }, worker))
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
        draw(state);
        return entry;
      }).finally(() => loadingEntries.delete(entry));
    return entry.promise;
  }

  function requestFrames(state) {
    const entry = cache.get(state.key);
    if (entry?.streaming && !entry.cancelled && !entry.controller.signal.aborted) entry.wake();
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
    return Boolean(target.closest("[data-explode-control], a:not(.card-open), input, select, textarea, button:not(.card-open)"));
  }

  function onWheel(state, event) {
    if (!finePointer.matches || !allowed(state) || event.ctrlKey || event.metaKey
      || !event.cancelable || isIndependentControl(event.target)
      || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    if (active !== state) activate(state, "wheel");
    if (!cache.get(state.key)?.frames[Math.round(state.progress * (state.config.frames.length - 1))]?.ready) return;
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

  function assetURL(value, extension) {
    if (typeof value !== "string") throw new Error("Invalid preview URL");
    const url = new URL(value, value.startsWith("assets/") ? document.baseURI : manifestURL);
    if (url.origin !== location.origin || !url.pathname.endsWith(extension)) throw new Error("Invalid preview asset");
    return url.href;
  }

  function normalizeChunks(chunks, frameCount) {
    if (!Array.isArray(chunks) || !chunks.length || chunks.length > frameCount) return null;
    const indexes = new Set();
    try {
      const normalized = chunks.map((chunk) => {
        if (!Number.isSafeInteger(chunk.bytes) || chunk.bytes <= 0 || chunk.bytes > 16 * 1024 * 1024
          || !Array.isArray(chunk.frames) || !chunk.frames.length || chunk.frames.length > 32) throw new Error("Invalid preview chunk");
        let end = 0;
        const frames = chunk.frames.map(({ index, offset, length }) => {
          if (!Number.isSafeInteger(index) || index < 0 || index >= frameCount || indexes.has(index)
            || offset !== end || !Number.isSafeInteger(length) || length <= 0) throw new Error("Invalid preview chunk frame");
          indexes.add(index);
          end += length;
          return { index, offset, length };
        });
        if (end !== chunk.bytes) throw new Error("Invalid preview chunk length");
        return { url: assetURL(chunk.url, ".bin"), bytes: chunk.bytes, frames };
      });
      return indexes.size === frameCount ? normalized : null;
    } catch { return null; }
  }

  function normalizeConfig(config) {
    if (!config || config.enabled === false || !Array.isArray(config.frames) || config.frames.length < 2 || config.frames.length > 181
      || !Number.isFinite(config.width) || !Number.isFinite(config.height)
      || config.width <= 0 || config.height <= 0 || config.width > 1920 || config.height > 1280
      || !Number.isSafeInteger(config.width) || !Number.isSafeInteger(config.height)
      || (config.streaming !== true && config.width * config.height * 4 * config.frames.length > DECODED_MEMORY_LIMIT)) return null;
    const mode = Object.hasOwn(MODES, config.mode) ? config.mode : "assembly";
    return { mode, width: config.width, height: config.height, streaming: config.streaming === true,
      frames: config.frames.map((url) => assetURL(url, ".webp")), chunks: normalizeChunks(config.chunks, config.frames.length) };
  }

  function setupCard(card, config) {
    const media = card.querySelector(".card-media");
    const poster = media?.querySelector("img");
    if (!media || !poster) return;
    const key = card.dataset.project;
    const title = card.dataset.previewTitle || card.querySelector("h3")?.textContent.trim() || key;
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
    if (card.dataset.previewInstructions) range.setAttribute("aria-describedby", card.dataset.previewInstructions);
    if (description) range.setAttribute("aria-description", description);
    controls.append(range);
    ui.append(badge, controls);
    media.append(stage, ui);
    poster.classList.add("card-explode-poster");
    card.classList.add("has-explode");
    card.dataset.explodeMode = config.mode;
    const rect = card.getBoundingClientRect();
    const state = { key, config, card, media, poster, stage, ui, range, badge, target: 0, progress: 0, index: -1,
      visible: rect.bottom > 0 && rect.top < innerHeight, owner: null, pointerInside: false, dragging: false,
      failed: false, loadJob: null, waitingIndex: null };
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

  function setupAvailableHosts() {
    if (!previewProjects) return;
    document.querySelectorAll(hostSelector).forEach((card) => {
      if (states.has(card.dataset.project)) return;
      try {
        const config = normalizeConfig(previewProjects[card.dataset.project]);
        if (config) setupCard(card, config);
      } catch { /* An invalid project keeps its original working cover. */ }
    });
  }

  // Case pages render after the responsive-cover catalog arrives. Either order
  // (host first or manifest first) joins this same lazy-loading engine.
  addEventListener("project-previews-ready", setupAvailableHosts);
  fetch(manifestURL, { cache: "no-cache" })
    .then((response) => { if (!response.ok) throw new Error("Preview manifest unavailable"); return response.json(); })
    .then((manifest) => {
      if (manifest.version !== 1 || !manifest.projects) return;
      previewProjects = manifest.projects;
      setupAvailableHosts();
    })
    .catch(() => { /* The original portfolio remains fully usable offline or on failure. */ });
})();
