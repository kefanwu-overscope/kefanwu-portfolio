/* Homepage hero opening, "Drawn, then built" (first visit per tab session only).
 *
 * The race car is first a precise line drawing, registered to the hero photo exactly as the
 * browser lays the photo out (object-fit: cover at its live object-position). Then the real
 * photo develops through a page-white veil like a print in the tray: the whole frame gains
 * density together, with only a slight lead for the car that is gone by 80 % of the way, and
 * each line retires once the photo has developed past it. The end state is today's hero:
 * every class, node and style this file adds is removed.
 *
 *   0 - 1.2 s      strokes draw in, in data-o order, 220-600 ms each (scaled by sqrt(length)):
 *                  two faint wheel-centre marks and the nose first, then body, wheels, frame,
 *                  driver, details and the tyre-contact lines (28 traced strokes + 2 marks;
 *                  the TSAL lamp outline only on windows at least 768 px wide)
 *   1.05 - 2.05 s  the photo develops, once both photo layers have decoded (the drawing holds
 *                  up to 3 s for them). The two construction marks retire over its first
 *                  300 ms; every traced line once the photo is half developed at its far end
 *   ~2.2 s         lines retired; veil, drawing and classes removed
 *
 * Stroke geometry (lengths, 21 points per stroke, the car's bounding box) is precomputed by
 * tools/hero-drawing/inline_hero_svg.cjs into data-len / data-pts / data-car, so nothing here
 * measures SVG geometry (getTotalLength, getPointAtLength and getBBox are only a fallback).
 *
 * Contract
 * - The inline guard in index.html <head> decides before first paint (html.hero-draw) and sets
 *   sessionStorage "kw-hero-drawn". Kill switches: ?draw=off (all drawing sequences) and
 *   ?hero=photo (this one). Reduced motion, a hidden tab, a deep link (#hash) and browsers
 *   without CSS masks get today's hero. ?hero=draw replays the sequence (review only).
 * - Text is never touched. The photos keep their fetch priority and decoding; their opacity and
 *   filter are never changed (only the veil above them is painted), so the photo stays the LCP.
 * - The drawing stays out of the page's paint until the first contentful paint has been reported
 *   (at most 1.5 s): frames before it never reach the screen, and with an empty GPU shader cache
 *   the stroke paths' first raster takes about 100-150 ms, which would otherwise delay the first
 *   paint, or the masked photo layer's paint on phones.
 * - Any intent (pointerdown, touchstart, wheel, scroll, keydown) settles to the end state in
 *   about 160 ms. A hidden tab, pagehide, leaving the page or reduced motion switching on finish
 *   at once. Ceiling: at 9 s (a stalled photo) the lines fade out over 400 ms and it ends.
 * - A script that arrives after the CSS failsafe has started (2.4 s on its clock) leaves the
 *   reveal to the CSS and only cleans up (intent fast-forwards that fade). Intent before this
 *   file has started (no window.__heroDraw yet) is handled by the inline guard, which drops
 *   html.hero-draw at once; from then on this file owns intent.
 * - CSS failsafes (white-home-20261011.css): the veil fades out by 3.3 s and is then hidden if
 *   this file never takes over (the inline guard also drops html.hero-draw at 4 s when this
 *   file has not started), and the veil and lines hide at 9.5 s if it dies mid-sequence.
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const hero = document.querySelector(".white-home .cinematic-hero");
  const media = hero && hero.querySelector(".hero-media");
  const veil = media && media.querySelector(".hero-draw-veil");
  const wrap = hero && hero.querySelector(".hero-draw-lines");

  // Removes everything this feature added (with the line break that follows each node in the
  // markup), so the settled DOM is today's DOM. Safe to call more than once.
  const drop = (node) => {
    if (!node || !node.isConnected) return;
    const next = node.nextSibling;
    if (next && next.nodeType === 3 && !next.data.trim()) next.remove();
    node.remove();
  };
  const teardown = () => {
    root.classList.remove("hero-draw", "hero-draw-js", "hero-draw-own");
    drop(wrap);
    drop(veil);
  };
  // A page restored from the back/forward cache shows the settled hero, never a frozen frame
  // of the sequence (pagehide already finishes it; this catches anything left).
  window.addEventListener("pageshow", (event) => { if (event.persisted) teardown(); });

  // Repeat visit, kill switch, reduced motion, deep link...: the guard did not opt in.
  if (!root.classList.contains("hero-draw")) { teardown(); return; }

  const SESSION_KEY = "kw-hero-drawn";
  const SRC_W = 2200, SRC_H = 1238;          // hero-lines.svg coordinates = source photo pixels
  const DRAW_END = 1200;                      // every stroke is drawn by 1.2 s
  const DEV_START = 1050, DEV_END = 2050;     // photo development window (ms)
  const DEV_MIN = 900;                        // shortest development after a late decode
  const DECODE_HOLD = 3000;                   // develop anyway after 3 s
  const RETIRE_MS = 550;                      // each line retires over 550 ms
  const GUIDE_RETIRE_MS = 300;                // the construction marks: over 300 ms from devStart
  const SETTLE_MS = 160;                      // user intent -> end state (+ a frame: < 250 ms)
  const LATE_MS = 2400;                       // the CSS failsafe starts fading at 2.8 s
  const FAILSAFE_DELAY = 2800, FAILSAFE_FAST = 3; // late script + intent: that 500 ms fade at 3x
  const CEILING_MS = 9000;                    // stalled photo: the lines fade out (400 ms) and the
  const CEILING_FADE_MS = 400;                // sequence ends, before the 9.5 s CSS backstop
  const FCP_HOLD = 1500;                      // the drawing waits this long for the first paint report
  const MIN_VISIBLE = 0.5;                    // share of the car drawing that must be on screen
  const QUICK_MS = 300;                       // otherwise: a short reveal of the photo, no drawing
  // Development: photo weight m(u) = D(p) * (1 - B(p) * (1 - fall(u))) at radius fraction u of
  // an ellipse centred on the car, p = development progress. D is the density of the whole frame;
  // B, a radial lead of at most 25 % that is gone by 80 %, keeps the car slightly ahead without
  // a visible edge; the whole car sits inside the solid core from the first developed frame.
  const ELLIPSE = 1.6;                        // development ellipse rx / ry
  const INNER = 0.3;                          // solid core: inside 30 % of the radius
  const BIAS = 0.25, BIAS_FROM = 0.3, BIAS_TO = 0.8;   // B(p) = .25 (1 - smoothstep(.3, .8, p))
  const RADIUS_POW = 0.8;                     // radius growth k = kStart + (kEnd - kStart) e^0.8
  const RETIRE_ALPHA = 0.5;                   // a line retires once the photo is 50 % developed at its far end
  const INK = "#111316", CREASE = "#505b66", GUIDE = "#c3c8ce";
  const LINE_FLOOR = 0.6, GUIDE_FLOOR = 0.75; // thinnest stroke (px); the marks stay visible at 390

  const bg = media && media.querySelector(".hero-photo-background");
  const svg = wrap && wrap.querySelector("svg");
  const photos = media ? [...media.querySelectorAll("img")] : [];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const state = (window.__heroDraw = { state: "boot", bootAt: Math.round(performance.now()) });

  let finished = false, raf = 0, ceiling = 0, ro = null;
  let settle = () => finish();               // replaced once the sequence is running: settle(ms)
  const listeners = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); listeners.push([target, type, fn, opts]); };

  function finish() {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(raf);
    clearTimeout(ceiling);
    if (ro) ro.disconnect();
    for (const [target, type, fn, opts] of listeners) target.removeEventListener(type, fn, opts);
    teardown();
    state.state = "done";
    state.doneAt = Math.round(performance.now());
  }

  if (!bg || !svg || !veil || reduce.matches || document.hidden) { finish(); return; }
  try { sessionStorage.setItem(SESSION_KEY, "1"); } catch (e) { /* the guard already set it */ }

  // Intent is honoured from the start: before the drawing runs it simply finishes.
  const intent = (reason) => () => { if (!state.settledBy) state.settledBy = reason; settle(); };
  on(window, "pointerdown", intent("pointerdown"), { capture: true, passive: true });
  on(window, "touchstart", intent("touchstart"), { capture: true, passive: true });
  on(window, "wheel", intent("wheel"), { capture: true, passive: true });
  on(window, "keydown", intent("keydown"), { capture: true, passive: true });
  on(window, "scroll", intent("scroll"), { passive: true });
  on(document, "visibilitychange", () => { if (document.hidden) finish(); });
  on(window, "pagehide", finish);
  // Leaving for another page (link or script, Navigation API): finish now, so the frame a
  // back/forward-cache restore first shows is the settled hero, not a frozen drawing frame.
  if (window.navigation && navigation.addEventListener) {
    on(navigation, "navigate", (event) => { if (!event.destination || !event.destination.sameDocument) finish(); });
  }
  if (reduce.addEventListener) on(reduce, "change", () => { if (reduce.matches) finish(); });
  ceiling = setTimeout(() => {                // even on a stalled photo
    if (!state.settledBy) state.settledBy = "ceiling";
    settle(CEILING_FADE_MS);
    ceiling = setTimeout(finish, CEILING_FADE_MS + 60);
  }, CEILING_MS);

  // Nothing that reads style or layout runs inside the parser's task. The first animation frame
  // computes style anyway: there the script checks how long the CSS failsafe has been running.
  // If it is about to fade the veil (a very late script), the CSS keeps the reveal and the
  // script only cleans up afterwards; intent then fast-forwards that fade (about 170 ms) and a
  // hidden tab, pagehide or navigation still finish at once. Otherwise the script takes the veil
  // over and builds the drawing in its own small task after that frame.
  raf = requestAnimationFrame(() => {
    if (finished) return;
    try {
      const failsafe = veil.getAnimations ? veil.getAnimations().find((a) => a.animationName === "hero-draw-failsafe") : null;
      const elapsed = failsafe ? Number(failsafe.currentTime) || 0 : performance.now();
      if (elapsed > LATE_MS) {
        state.state = "late";
        state.failsafeAt = Math.round(elapsed);
        settle = () => {
          if (finished) return;
          if (document.hidden || !failsafe) { finish(); return; }
          try {
            if (Number(failsafe.currentTime) < FAILSAFE_DELAY) failsafe.currentTime = FAILSAFE_DELAY;
            failsafe.playbackRate = FAILSAFE_FAST;
          } catch (err) { finish(); return; }
          clearTimeout(ceiling);
          ceiling = setTimeout(finish, Math.ceil(500 / FAILSAFE_FAST) + 20);
        };
        clearTimeout(ceiling);
        ceiling = setTimeout(finish, Math.max(0, FAILSAFE_DELAY + 700 - elapsed));
        return;
      }
      root.classList.add("hero-draw-js", "hero-draw-own");
      state.state = "pending";
      setTimeout(() => {
        if (finished) return;
        try {
          const s0 = performance.now();
          if (getComputedStyle(media).display === "none" || window.scrollY > 4) { finish(); return; }
          start();
          state.initMs = +(performance.now() - s0).toFixed(1);
        } catch (err) {
          finish();
        }
      }, 0);
    } catch (err) {
      finish();
    }
  });

  function start() {
    // The timeline starts at the first frame after the first contentful paint has been reported:
    // a cold first frame can reach the screen a few hundred ms after its rAF, and frames before
    // it are never shown. The drawing stays hidden until then (see frame()). If the report takes
    // longer than FCP_HOLD the drawing starts anyway, and a later report re-anchors the timeline.
    let t0 = -1, fcp = -1, holdUntil = -1;
    try {
      const po = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) if (entry.name === "first-contentful-paint") fcp = entry.startTime;
        if (fcp >= 0) po.disconnect();
      });
      po.observe({ type: "paint", buffered: true });
      if (PerformanceObserver.supportedEntryTypes.includes("paint")) holdUntil = performance.now() + FCP_HOLD;
    } catch (e) { /* no paint timing: no hold, the first rAF anchors the timeline */ }

    // ---- strokes (source px). Lengths and the 21 points per stroke that the development needs
    // come precomputed (data-len, data-pts). Without them (an older inline copy) the lengths are
    // measured here, on the rendered drawing, and the points sampled in idle time (~5 ms, kept out
    // of the first frames). ----
    if (!svg.hasAttribute("data-car") || svg.querySelector("path:not([data-len])")) wrap.hidden = false;
    const nums = (value) => (value ? value.trim().split(/\s+/).map(Number) : []);
    const paths = [];
    let precomputed = true;
    for (const el of svg.querySelectorAll("path")) {
      // Strokes for wider windows only (the TSAL lamp: a few pixels tall on a phone).
      const minVw = parseFloat(el.getAttribute("data-min-vw")) || 0;
      if (minVw && !window.matchMedia(`(min-width: ${minVw}px)`).matches) { el.style.display = "none"; continue; }
      const group = el.parentNode.getAttribute("data-group") || "";
      const o = parseFloat(el.getAttribute("data-o")) || 0;
      const w = parseFloat(el.getAttribute("data-w")) || 0.5;
      const flat = nums(el.getAttribute("data-pts"));
      let L = parseFloat(el.getAttribute("data-len"));
      let pts = null;
      if (L > 0 && flat.length === 42 && flat.every(Number.isFinite)) {
        pts = [];
        for (let i = 0; i < 42; i += 2) pts.push([flat[i], flat[i + 1]]);
      } else {
        precomputed = false;
        L = el.getTotalLength();
      }
      const wheel = group === "structure" && o >= 0.19 && o < 0.375;   // tyres and rims (0.2-0.36)
      const helmet = group === "silhouette" && Math.abs(o - 0.6) < 0.001;
      const guide = group === "guide";            // wheel-centre construction marks
      let color = CREASE, weight = w;
      if (group === "silhouette" || wheel) color = INK;
      if (guide || (group === "ground" && o > 0.89)) color = GUIDE;   // marks, tyre-contact lines
      if (wheel) weight *= 1.15;
      if (helmet) weight *= 1.2;
      el.style.color = color;
      paths.push({ el, o, weight, floor: guide ? GUIDE_FLOOR : LINE_FLOOR, L, pts, guide, car: group === "silhouette" || group === "structure",
        len: 0, far: 0, start: 0, dur: 0, retireAt: -1, retireMs: guide ? GUIDE_RETIRE_MS : RETIRE_MS, alpha: -1, offset: "" });
    }
    state.precomputed = precomputed;
    // Development centre: centre of the silhouette + structure strokes (source px).
    let [minX, minY, maxX, maxY] = nums(svg.getAttribute("data-car"));
    if (![minX, minY, maxX, maxY].every(Number.isFinite) || !(maxX > minX && maxY > minY)) {
      minX = minY = Infinity; maxX = maxY = -Infinity;
      for (const g of svg.querySelectorAll('[data-group="silhouette"], [data-group="structure"]')) {
        const b = g.getBBox();
        minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
      }
    }
    const carSrc = [(minX + maxX) / 2, (minY + maxY) / 2];
    let sampled = precomputed;
    const sample = () => {
      if (sampled) return;
      sampled = true;
      state.sampledAt = Math.round(performance.now());
      for (const p of paths) {
        if (p.pts) continue;
        p.pts = [];
        for (let i = 0; i <= 20; i += 1) {
          const q = p.el.getPointAtLength((p.L * i) / 20);
          p.pts.push([q.x, q.y]);
        }
      }
      if (geo) layout(true);
    };

    // ---- registration: the drawing follows the photo as the browser lays it out ----
    let geo = null;
    const parsePos = (value, free) => {
      const v = String(value).trim();
      if (v.endsWith("%")) return (free * parseFloat(v)) / 100;
      if (v.endsWith("px")) return parseFloat(v);
      if (v === "left" || v === "top") return 0;
      if (v === "right" || v === "bottom") return free;
      return free / 2;
    };
    function layout(samplesOnly) {
      const hr = hero.getBoundingClientRect(), br = bg.getBoundingClientRect();
      const W = br.width, H = br.height;
      if (!W || !H) return false;
      // object-fit: cover with the file the browser picked (natural size once it has loaded).
      const nW = bg.naturalWidth || SRC_W, nH = bg.naturalHeight || SRC_H;
      const s = Math.max(W / nW, H / nH);
      const iw = nW * s, ih = nH * s;
      const pos = getComputedStyle(bg).objectPosition.split(/\s+/);
      const ox = parsePos(pos[0], W - iw), oy = parsePos(pos[1] || "50%", H - ih);
      const kx = iw / SRC_W, ky = ih / SRC_H;   // source px -> box px
      const cx = ox + carSrc[0] * kx, cy = oy + carSrc[1] * ky;
      const dist = (x, y) => Math.hypot((x - cx) / ELLIPSE, y - cy);
      if (!samplesOnly) {
        wrap.style.left = `${br.left - hr.left}px`;
        wrap.style.top = `${br.top - hr.top}px`;
        wrap.style.width = `${W}px`;
        wrap.style.height = `${H}px`;
        svg.setAttribute("viewBox", `${(-ox / kx).toFixed(3)} ${(-oy / ky).toFixed(3)} ${(W / kx).toFixed(3)} ${(H / ky).toFixed(3)}`);
        // data-w 1 = 1.4 px at 390 to 2.1 px at 1440 (screen px; strokes are non-scaling).
        const w1 = Math.min(2.1, Math.max(1.4, 1.4 + ((root.clientWidth - 390) * 0.7) / 1050));
        // Durations from on-screen length (the cover scale is uniform: kx = ky within 0.05 %).
        let maxLen = 0;
        for (const p of paths) {
          p.el.style.strokeWidth = `${Math.max(p.floor, w1 * p.weight).toFixed(3)}px`;
          p.len = (p.L * (kx + ky)) / 2;
          maxLen = Math.max(maxLen, p.len);
        }
        for (const p of paths) {
          p.dur = 220 + 380 * Math.sqrt(p.len / (maxLen || 1));   // 220-600 ms
          p.start = p.o * (DRAW_END - p.dur);
        }
        // Share of the car's bounding box inside the first screen.
        const x0 = br.left + ox + minX * kx, x1 = br.left + ox + maxX * kx;
        const y0 = br.top + oy + minY * ky, y1 = br.top + oy + maxY * ky;
        const vw = Math.max(0, Math.min(x1, root.clientWidth) - Math.max(x0, 0));
        const vh = Math.max(0, Math.min(y1, window.innerHeight) - Math.max(y0, 0));
        const corner = Math.max(dist(0, 0), dist(W, 0), dist(0, H), dist(W, H));
        // The ellipse ends past the farthest corner, with that corner inside the solid core.
        geo = { W, H, cx, cy, kx, ky, ox, oy, kStart: 0, kEnd: corner / INNER + 2,
          visible: (vw * vh) / Math.max(1, (x1 - x0) * (y1 - y0)) };
        state.geo = geo;
      }
      if (sampled) {
        // Each stroke's farthest point from the car centre (ellipse metric): it retires once the
        // photo has developed past it. The ellipse starts with the whole car inside its solid
        // core, so the car develops evenly from the first frame (no porthole around it).
        let carFar = 0;
        for (const p of paths) {
          let far = 0;
          for (const [px, py] of p.pts) far = Math.max(far, dist(ox + px * kx, oy + py * ky));
          p.far = far;
          if (p.car) carFar = Math.max(carFar, far);
        }
        geo.carFar = carFar;
        geo.kStart = carFar / INNER;
        geo.kEnd = Math.max(geo.kStart, geo.kEnd);
      }
      return true;
    }
    if (!layout()) { finish(); return; }
    // A drawing mostly below the fold (phone landscape, very short windows) would only hold the
    // photo back: reveal the photo quickly instead.
    const quick = geo.visible < MIN_VISIBLE;
    if (quick) state.quick = +geo.visible.toFixed(2);
    ro = new ResizeObserver(() => { if (!finished) layout(); });
    ro.observe(bg);
    // Fallback only: the point samples are needed from the development on (>= 1.05 s).
    if (!sampled) {
      if (window.requestIdleCallback) requestIdleCallback(() => { if (!finished) sample(); }, { timeout: 700 });
      else setTimeout(() => { if (!finished) sample(); }, 300);
    }

    // ---- development: photo weight m(u) = D * (1 - B * (1 - fall(u))), u = radius fraction ----
    // Over the white hero, a white veil of alpha 1 - m gives exactly the pixels of masking the
    // photo with m, without ever repainting the photos or their context masks.
    const fall = (u) => {
      if (u <= INNER) return 1;
      if (u >= 1) return 0;
      const x = (u - INNER) / (1 - INNER);
      return 1 - x * x * (3 - 2 * x);
    };
    const smoothstep = (a, b, x) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    const leadOf = (p) => BIAS * (1 - smoothstep(BIAS_FROM, BIAS_TO, p));
    const photoWeight = (u, D, B) => D * (1 - B * (1 - fall(u)));
    const STOP_U = Array.from({ length: 12 }, (_, i) => INNER + ((1 - INNER) * i) / 11);
    let lastMask = "";
    const setMask = (k, D, B) => {
      const ry = Math.max(1, k), rx = ry * ELLIPSE;
      const alpha = (u) => (1 - photoWeight(u, D, B)).toFixed(3);
      let value;
      if (B < 5e-4 || D <= 0) value = `rgb(255 255 255 / ${alpha(0)})`;   // even density: one flat colour
      else {
        const stops = STOP_U.map((u) => `rgb(255 255 255 / ${alpha(u)}) ${(u * 100).toFixed(2)}%`).join(", ");
        value = `radial-gradient(${rx.toFixed(1)}px ${ry.toFixed(1)}px at ${geo.cx.toFixed(1)}px ${geo.cy.toFixed(1)}px, rgb(255 255 255 / ${alpha(0)}) 0%, ${stops})`;
      }
      if (value !== lastMask) { veil.style.background = value; lastMask = value; }
    };
    const setLine = (p, offset, alpha) => {
      if (offset !== p.offset) { p.el.style.strokeDashoffset = offset; p.offset = offset; }
      if (alpha !== p.alpha) { p.el.style.opacity = alpha; p.alpha = alpha; }
    };

    // ---- easing ----
    const bezier = (x1, y1, x2, y2) => (x) => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
      const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
      let t = x;
      for (let i = 0; i < 8; i += 1) {
        const fx = ((ax * t + bx) * t + cx) * t - x;
        const d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(fx) < 1e-5 || !d) break;
        t = Math.min(1, Math.max(0, t - fx / d));
      }
      return ((ay * t + by) * t + cy) * t;
    };
    const developEase = bezier(0.65, 0, 0.35, 1);
    const strokeEase = bezier(0.45, 0, 0.2, 1);

    // ---- decode gate: hold the drawing until the photo can paint (max 3 s) ----
    // decode() is asked for only after the files have loaded and had a frame to paint: asking
    // earlier made Chrome hold the masked subject layer's first paint for a full-size decode.
    let decodedAt = -1;
    const loaded = (img) => (img.complete ? Promise.resolve() : new Promise((resolve) => {
      img.addEventListener("load", resolve, { once: true });
      img.addEventListener("error", resolve, { once: true });
    }));
    const afterFrame = () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    Promise.all(photos.map(loaded))
      .then(() => { if (!finished) layout(); })   // natural size of the chosen file is known now
      .then(afterFrame)
      .then(() => Promise.all(photos.map((img) => (img.decode ? img.decode().catch(() => {}) : null))))
      .then(() => { if (decodedAt < 0) decodedAt = performance.now(); })
      .catch(() => { if (decodedAt < 0) decodedAt = performance.now(); });
    let devStart = -1, devDur = DEV_END - DEV_START;

    // ---- settle on user intent: develop fully and retire every line in 160 ms ----
    // An automatic settle (quick reveal, ceiling fade) can only be shortened: intent during it
    // restarts from what is on screen with the 160 ms settle when that ends sooner.
    let settleAt = -1, settleMs = SETTLE_MS, settleK = 0, settleD = 0, settleB = 0, lastK = 0, lastD = 0, lastB = 0;
    settle = (ms) => {
      if (finished) return;
      if (document.hidden) { finish(); return; }
      const now = performance.now(), want = ms || SETTLE_MS;
      if (settleAt >= 0 && settleAt + settleMs - now <= want) return;
      settleAt = now;
      settleMs = want;
      state.settleAt = Math.round(settleAt);
      settleK = lastK;
      settleD = lastD;
      settleB = lastB;
      // Photo not decoded yet: script.js's slow-load veil takes the reveal back right away.
      if (decodedAt < 0) root.classList.remove("hero-draw-own");
      for (const p of paths) p.alpha0 = Math.max(0, +p.alpha || 0);
    };

    function step(now) {
      if (t0 < 0) { t0 = now; state.t0 = Math.round(t0); }
      if (fcp > t0 + 32 && devStart < 0 && settleAt < 0) { t0 = fcp; state.t0 = Math.round(t0); state.fcpAnchored = true; }
      const t = now - t0;
      if (quick && settleAt < 0) { state.settledBy = state.settledBy || "quick"; settle(QUICK_MS); }

      if (settleAt >= 0) {
        const p = Math.min(1, (now - settleAt) / settleMs);
        const e = 1 - (1 - p) * (1 - p);
        lastK = settleK + (geo.kEnd - settleK) * e;
        lastD = settleD + (1 - settleD) * e;
        lastB = settleB * (1 - e);
        setMask(lastK, lastD, lastB);
        for (const s of paths) setLine(s, s.offset, (s.alpha0 * (1 - e)).toFixed(3));
        if (p >= 1) finish();
        return;
      }

      // Development starts at >= 1.05 s once the photo has decoded, or after the 3 s hold.
      if (devStart < 0 && t >= DEV_START && (decodedAt >= 0 || t >= DECODE_HOLD)) {
        sample();   // fallback only: the points are normally precomputed
        devStart = t;
        // Still not decoded after the hold: develop anyway, hand the reveal back to script.js's
        // slow-load veil, and keep the lines until the photo really arrives.
        if (decodedAt < 0) root.classList.remove("hero-draw-own");
        devDur = Math.max(DEV_MIN, DEV_END - devStart);
        state.devStart = Math.round(devStart);
        state.decodedAt = decodedAt < 0 ? -1 : Math.round(decodedAt - t0);
        // The construction marks are not edges of the photo: they leave as it starts to develop.
        for (const s of paths) if (s.guide && s.retireAt < 0) s.retireAt = Math.max(t, s.start);
      }
      const dev = devStart < 0 ? 0 : Math.min(1, (t - devStart) / devDur);
      lastD = devStart < 0 ? 0 : developEase(dev);
      lastB = devStart < 0 ? BIAS : leadOf(dev);
      lastK = devStart < 0 ? geo.kStart : geo.kStart + (geo.kEnd - geo.kStart) * Math.pow(developEase(dev), RADIUS_POW);
      setMask(lastK, lastD, lastB);

      let allRetired = true;
      for (const s of paths) {
        const drawP = strokeEase(Math.min(1, Math.max(0, (t - s.start) / s.dur)));
        if (s.retireAt < 0 && devStart >= 0 && decodedAt >= 0 && t >= s.start + s.dur
          && photoWeight(s.far / Math.max(1, lastK), lastD, lastB) >= RETIRE_ALPHA) s.retireAt = t;
        const r = s.retireAt < 0 ? 0 : Math.min(1, (t - s.retireAt) / s.retireMs);
        if (r < 1) allRetired = false;
        setLine(s, (1 - drawP).toFixed(4), (t < s.start ? 0 : 1 - developEase(r)).toFixed(3));
      }
      if (dev >= 1 && allRetired) finish();
    }

    function frame(now) {
      if (finished) return;
      raf = requestAnimationFrame(frame);
      // The lines join the page only after the first paint. A settle or a quick reveal never
      // shows them, so it neither waits for that paint nor unhides them.
      if (settleAt < 0 && !quick) {
        if (fcp < 0 && now < holdUntil) return;
        if (wrap.hidden) { wrap.hidden = false; state.linesAt = Math.round(now); }
      }
      try { step(now); } catch (err) { finish(); }
    }

    setMask(0, 0, 0);
    state.state = "drawing";
    state.carSrc = carSrc;
    raf = requestAnimationFrame(frame);
  }
})();
