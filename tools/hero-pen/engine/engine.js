/* Hero pen engine: the homepage car drawn by one hand (PEN_SPEC sections 6-10).
 * Readable source. engine/build.cjs inlines a comment-stripped, minified copy into the page after the data block
 * <script type="text/plain" id="hero-pen-data">, and evaluates the region between the core markers so the
 * schedules are solved and checked with exactly the motion the page runs.
 * One pen on one clock: a stroke starts only after the previous one ended (the schedule's gaps are never
 * negative). Each frame advances the pen clock by min(dt, 50 ms) and draws only that frame's new tapered
 * segments onto three stacked 2D canvases: GUIDE, SHADE, INK. No randomness at run time, no sessionStorage.
 */
(() => {
  "use strict";
  //@core-start
  const M = Math;
  const ang = (ax, ay, bx, by) => M.abs(M.atan2(ax * by - ay * bx, ax * bx + ay * by));
  // One stroke line "<tier><phase><mask><flags> x0 y0 dx1 dy1 dx2 dy2 dx3 dy3 [|] ..." (0.5 src px units) ->
  // flattened path (src px; segments <= 1.5 px and <= 8 deg), arc length s, curvature-warped arc U and the
  // submovements split at the corner markers, each with its share of the stroke's time.
  const decodeLine = (line) => {
    const k = line.split(" "), x = [], y = [], cut = [0];
    let X = +k[1], Y = +k[2], i = 3;
    x.push(X / 2);
    y.push(Y / 2);
    while (i < k.length) {
      if (k[i] === "|") { cut.push(x.length - 1); i++; continue; }
      const a = X + +k[i], b = Y + +k[i + 1], e = X + +k[i + 2], f = Y + +k[i + 3], g = X + +k[i + 4], h = Y + +k[i + 5];
      const m = M.max(1, M.ceil((M.hypot(a - X, b - Y) + M.hypot(e - a, f - b) + M.hypot(g - e, h - f)) / 2.6),
        M.ceil((ang(a - X, b - Y, e - a, f - b) + ang(e - a, f - b, g - e, h - f)) / 0.13));
      for (let j = 1; j <= m; j++) {
        const t = j / m, u = 1 - t, A = u * u * u, B = 3 * u * u * t, C = 3 * u * t * t, E = t * t * t;
        x.push((A * X + B * a + C * e + E * g) / 2);
        y.push((A * Y + B * b + C * f + E * h) / 2);
      }
      X = g;
      Y = h;
      i += 6;
    }
    const n = x.length, s = [0], U = [0], q = [0], subs = [], nm = k[0][0] === "n";
    for (let j = 1; j < n; j++) s[j] = s[j - 1] + M.hypot(x[j] - x[j - 1], y[j] - y[j - 1]);
    for (let j = 1; j < n - 1; j++) q[j] = ang(x[j] - x[j - 1], y[j] - y[j - 1], x[j + 1] - x[j], y[j + 1] - y[j]) / M.max(1e-6, (s[j + 1] - s[j - 1]) / 2);
    q[n - 1] = 0;
    // two-thirds power law with a knee: U_i = sum |seg| (1 + 52 kappa)^(1/3), kappa smoothed [1 2 1]/4
    // revision 4: a numeral (tier n) runs on plain arc length (no warp) and its submovements share the time by length,
    // so the tip keeps one speed through a digit and no frame takes more than 35 % of it (see posAt)
    for (let j = 1; j < n; j++) U[j] = U[j - 1] + (s[j] - s[j - 1]) * (nm ? 1 : M.cbrt(1 + 13 * (q[j - 1] + 2 * q[j] + (q[j + 1] || 0))));
    cut.push(n - 1);
    let tot = 0;
    for (let j = 0; j < cut.length - 1; j++) {
      if (cut[j + 1] <= cut[j]) continue;
      const w = nm ? M.max(s[cut[j + 1]] - s[cut[j]], 0.01) : 30 + 6.8 * M.pow(M.max(s[cut[j + 1]] - s[cut[j]], 0.01), 0.65);
      subs.push([cut[j], cut[j + 1], tot, w]);
      tot += w;
    }
    for (const r of subs) { r[2] /= tot; r[3] = r[2] + r[3] / tot; }
    return { t: k[0][0], p: +k[0][1], m: +k[0][2], f: +k[0][3], x, y, s, U, n, sub: subs, L: s[n - 1] };
  };
  // revision 4: a numeral's submovement is flattened: smoothstep speed ramps over its first and last 20 % with a
  // plateau between (peak speed 1.25 x mean instead of minimum jerk's 1.875), still at rest at its ends
  const ramp = (x) => x * x * x * (1 - x / 2) * 0.2;
  const flat = (v) => (v < 0.2 ? ramp(v * 5) : v > 0.8 ? 0.8 - ramp((1 - v) * 5) : v - 0.1) / 0.8;
  // Pen position (float point index) at stroke-local time fraction tau: minimum jerk per submovement on U.
  const posAt = (st, tau) => {
    if (tau <= 0) return 0;
    if (tau >= 1) return st.n - 1;
    let r = st.sub[0];
    for (const b of st.sub) if (tau <= b[3]) { r = b; break; }
    const v = M.min(1, (tau - r[2]) / (r[3] - r[2] || 1)), U = st.U, T = U[r[0]] + (st.t === "n" ? flat(v) : v * v * v * (10 - 15 * v + 6 * v * v)) * (U[r[1]] - U[r[0]]);
    let lo = r[0], hi = r[1];
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (U[m] <= T) lo = m; else hi = m; }
    const d = U[hi] - U[lo];
    return lo + (d > 0 ? M.min(1, (T - U[lo]) / d) : 0);
  };
  // [x, y, arc] in src px at float index f
  const ptAt = (st, f) => {
    const i = M.max(0, M.min(st.n - 2, M.floor(f))), u = f - i;
    return [st.x[i] + (st.x[i + 1] - st.x[i]) * u, st.y[i] + (st.y[i + 1] - st.y[i]) * u, st.s[i] + (st.s[i + 1] - st.s[i]) * u];
  };
  // The chosen class's stroke lines and schedule from the block; hash = FNV-1a of those lines and the schedule line.
  const pick = (txt, c) => {
    const bit = c === "D" ? 4 : c === "T" ? 2 : 1, L = txt.trim().split("\n"), out = [];
    let sc = "", h = 2166136261;
    for (let i = 1; i < L.length; i++) {
      const l = L[i];
      if (l[0] === "T") { if (l[2] === c) sc = l; } else if (+l[2] & bit) out.push(l);
    }
    const z = out.join("\n") + "\n" + sc;
    for (let i = 0; i < z.length; i++) h = M.imul(h ^ z.charCodeAt(i), 16777619) >>> 0;
    return { h: L[0].split(" ").map(Number), L: out, T: sc.split(" ").slice(2).map(Number), hash: h.toString(16) };
  };
  //@core-end

  const W = window, Dc = document, R = Dc.documentElement, P = performance;
  const dataEl = Dc.getElementById("hero-pen-data");
  const hero = Dc.querySelector(".white-home .cinematic-hero");
  const media = hero && hero.querySelector(".hero-media");
  const veil = media && media.querySelector(".hero-draw-veil");
  const wrap = hero && hero.querySelector(".hero-draw-lines");
  const bg = media && media.querySelector(".hero-photo-background");
  const photos = media ? [...media.querySelectorAll("img")] : [];
  const cv = wrap ? [...wrap.querySelectorAll("canvas")] : [];      // GUIDE, SHADE, INK, bottom to top
  const drop = (n) => {
    if (!n || !n.isConnected) return;
    const s = n.nextSibling;
    if (s && s.nodeType === 3 && !s.data.trim()) s.remove();
    n.remove();
  };
  // End state: no drawing nodes, the class list as before the guard, no data-hero-pen attribute.
  const teardown = () => {
    R.classList.remove("hero-draw", "hero-draw-js", "hero-draw-own", "hero-draw-inked");
    R.removeAttribute("data-hero-pen");
    for (const c of cv) c.width = c.height = 0;
    drop(wrap);
    drop(veil);
    drop(dataEl);
  };
  addEventListener("pageshow", (e) => { if (e.persisted) teardown(); });   // a bfcache restore never replays
  const armed = () => R.classList.contains("hero-draw");
  if ((!armed() && R.getAttribute("data-hero-pen") !== "wait") || !dataEl || !veil || !wrap || !bg || cv.length < 3) { teardown(); return; }

  // revision 3: the develop starts DEV_GAP after last ink (the finished drawing is seen whole)
  const DEV_MS = 1000, DEV_GAP = 100, DEV_MIN = 900, HOLD = 1800, G_EXIT = 300, SETTLE = 160, GH_MS = 150;
  const FCP_HOLD = 1500, LOAD_WAIT = 140, LOAD_CAP = 300, STEP = 50, WALL = 1000, CEIL = 11000, CEIL_FADE = 400, QUICK = 300;
  const ELL = 1.6, INNER = 0.3, BIAS = 0.25, RPOW = 0.8;
  // the CSS failsafe (white-home-20261011.css): a 500 ms fade from 2.8 s on the veil's clock; past LATE the engine
  // leaves the reveal to it and finishes at F_END on that clock, 200 ms after the fade (fix-r1; hero-drawing-20261027.js's
  // LATE_MS, FAILSAFE_DELAY and FAILSAFE_FAST). F_RUSH: the rest of the fade at 3x (at most 167 ms) + 20 ms.
  const LATE = 2400, F_DELAY = 2800, F_END = 3500, F_FAST = 3, F_RUSH = 187;
  // tier: [width factor, colour, canvas (0 GUIDE, 1 SHADE, 2 INK), destination-over, no white mix at the floor]
  // GUIDE floors at 1 device px in #a9b1ba unmixed (revision 1: mixed, the guides were level 201-215 at DPR 1)
  const TIER = { g: [0.36, 0xa9b1ba, 0, 0, 1], c: [0.95, 0x111316, 2], y: [1.05, 0x111316, 2], a: [1, 0x111316, 2], n: [0.8, 0x111316, 2],
    f: [0.62, 0x2a3036, 2, 1], d: [0.42, 0x505b66, 2, 1], h: [0.3, 0x7b848d, 1] };
  const H = (W.__heroDraw = { state: "pending" }), boot = P.now();

  let done = 0, raf = 0, ceilTimer = 0, ro = null, io = null, inked = 0;
  // The pen is up for good (last ink laid, the rest skipped, or settling): html.hero-draw-inked tells the
  // project cards (card-drawing-20261027.js) that no more ink will be drawn; the photo may still develop.
  const penUp = () => { if (!inked) { inked = 1; H.inkedAt = M.round(P.now()); R.classList.add("hero-draw-inked"); } };
  const ls = [];
  const on = (t, e, f, o) => { t.addEventListener(e, f, o); ls.push([t, e, f, o]); };
  const finish = () => {
    if (done) return;
    done = 1;
    cancelAnimationFrame(raf);
    clearTimeout(ceilTimer);
    if (ro) ro.disconnect();
    if (io) io.disconnect();
    for (const l of ls) l[0].removeEventListener(l[1], l[2], l[3]);
    teardown();
    H.state = "done";
    H.doneAt = P.now();
  };
  let settle = finish;
  const fail = (e) => { H.error = String(e); finish(); };
  // Intent: no more ink, settle in 160 ms, never fast-forward. Scroll and mouse movement are not intent.
  for (const e of ["pointerdown", "touchstart", "wheel", "keydown"]) on(W, e, () => settle(SETTLE, e), { capture: true, passive: true });
  let go = () => 0;
  on(Dc, "visibilitychange", () => { if (!Dc.hidden) go(); else if (H.state !== "wait-visible") finish(); });
  on(W, "pagehide", finish);
  if (W.navigation) on(navigation, "navigate", (e) => { if (!e.destination || !e.destination.sameDocument) finish(); });
  const rm = matchMedia("(prefers-reduced-motion: reduce)");
  on(rm, "change", () => { if (rm.matches) finish(); });

  const ss = (a, b, v) => { const t = M.min(1, M.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  // developEase = cubic-bezier(.65, 0, .35, 1)
  // v in [0, 1]; 0 and 1 are fixed points of the Newton step
  const ease = (v) => {
    let t = v;
    for (let i = 0; i < 8; i++) {
      const fx = ((1.9 * t - 2.85) * t + 1.95) * t - v, d = (5.7 * t - 5.7) * t + 1.95;
      if (M.abs(fx) < 1e-5) break;
      t = M.min(1, M.max(0, t - fx / d));
    }
    return t * t * (3 - 2 * t);
  };

  let klass = "", S = [], last = 0, G = null, dpr = 1, lim = 0, lw = 0, lh = 0;
  const ctx = [], box = [];
  const pickCls = () => { const w = R.clientWidth; return w >= 1280 ? "D" : w >= 768 ? "T" : "P"; };
  const prepare = () => {
    klass = pickCls();
    const d = pick(dataEl.textContent, klass);
    if (d.T.length !== 2 * d.L.length || !d.L.length) throw "data";
    let t = 0;
    S = d.L.map((l, i) => {
      const s = decodeLine(l);
      t += d.T[2 * i];
      s.start = t;
      s.dur = d.T[2 * i + 1];
      t += s.dur;
      s.end = t;
      s.upto = 0;
      return s;
    });
    last = t;
    lim = S.length;
    // ghost rim loops (flag bit 4): the k-th flagged guide (tier g) retires GH_MS after the k-th flagged line, its
    // rim's last stroke, has ended (s.r: that line)
    const gq = [];
    for (const s of S) if (s.f & 4) s.t === "g" ? gq.push(s) : (gq.shift().r = s);
    H.car = d.h.slice(3, 7);
    Object.assign(H, { cls: klass, n: S.length, lastInk: last, schedule: S.map((s) => [s.start, s.dur]), hash: d.hash, len: S.map((s) => M.round(s.L)), ph: S.map((s) => s.p), tier: S.map((s) => s.t), gr: S.map((s) => (s.r ? s.r.end : -1)) });
    return layout();
  };

  // Registration to the photo exactly as the browser lays it out (object-fit: cover, object-position).
  // computed object-position is always a length or a percentage
  const pos = (v, free) => (v.slice(-1) === "%" ? (free * parseFloat(v)) / 100 : parseFloat(v) || 0);
  // fix-r2: one property at a time, so a canvas keeps the opacity setOp() gave it (cssText wiped it: a resize during
  // the develop or the settle painted the lines at full strength again until the next frame)
  const place = (el, l, t, w, h) => { const s = el.style; s.left = l + "px"; s.top = t + "px"; s.width = w + "px"; s.height = h + "px"; };
  const layout = () => {
    const hr = hero.getBoundingClientRect(), br = bg.getBoundingClientRect(), w = br.width, h = br.height;
    if (!w || !h) return 0;
    const nw = bg.naturalWidth || 2200, nh = bg.naturalHeight || 1238, sc = M.max(w / nw, h / nh), iw = nw * sc, ih = nh * sc;
    const op = getComputedStyle(bg).objectPosition.split(" "), ox = pos(op[0], w - iw), oy = pos(op[1] || "50%", h - ih);
    const kx = iw / 2200, ky = ih / 1238, [x0, y0, x1, y1] = H.car;
    const cx = ox + ((x0 + x1) / 2) * kx, cy = oy + ((y0 + y1) / 2) * ky, dist = (x, y) => M.hypot((x - cx) / ELL, y - cy);
    const vx0 = br.left + ox + x0 * kx, vx1 = br.left + ox + x1 * kx, vy0 = br.top + oy + y0 * ky, vy1 = br.top + oy + y1 * ky;
    const share = (M.max(0, M.min(vx1, R.clientWidth) - M.max(vx0, 0)) * M.max(0, M.min(vy1, innerHeight) - M.max(vy0, 0))) / M.max(1, (vx1 - vx0) * (vy1 - vy0));
    let far = 0;
    for (const s of S) if (s.p === 1) for (let i = 0; i < s.n; i += 4) far = M.max(far, dist(ox + s.x[i] * kx, oy + s.y[i] * ky));
    const k0 = far / INNER;
    G = { kx, ky, ox, oy, cx, cy, k0, k1: M.max(k0, M.max(dist(0, 0), dist(w, 0), dist(0, h), dist(w, h)) / INNER + 2), share, car: (x1 - x0) * kx,
      w1: M.min(2.1, M.max(1.4, 1.4 + ((R.clientWidth - 390) * 0.7) / 1050)) };
    lw = w;
    lh = h;
    place(wrap, br.left - hr.left, br.top - hr.top, w, h);
    dpr = M.min(3, W.devicePixelRatio || 1);
    // each canvas: the bounding box of its own strokes + 6 src px, cut to the photo box; backing store x dpr
    for (let c = 0; c < 3; c++) {
      let a = 1e9, b = 1e9, e = -1e9, f = -1e9;
      for (const s of S) if (TIER[s.t][2] === c) for (let i = 0; i < s.n; i++) { a = M.min(a, s.x[i]); e = M.max(e, s.x[i]); b = M.min(b, s.y[i]); f = M.max(f, s.y[i]); }
      const el = cv[c];
      box[c] = null;
      ctx[c] = null;
      if (a > e) { el.width = el.height = 0; continue; }
      const L = M.max(0, M.floor(ox + (a - 6) * kx)), T = M.max(0, M.floor(oy + (b - 6) * ky)), Rt = M.min(w, M.ceil(ox + (e + 6) * kx)), B = M.min(h, M.ceil(oy + (f + 6) * ky));
      box[c] = [L, T];
      place(el, L, T, Rt - L, B - T);
      el.width = M.round((Rt - L) * dpr);
      el.height = M.round((B - T) * dpr);
      const x = el.getContext("2d");
      x.setTransform(dpr, 0, 0, dpr, -L * dpr, -T * dpr);
      x.lineCap = x.lineJoin = "round";
      ctx[c] = x;
    }
    H.geo = [G, box, dpr];
    return 1;
  };

  // ---- drawing (section 7) ----
  const cc = {};
  // device-pixel floor: below 1 device px draw 1 device px, the colour mixed toward white by 1 - wd
  const col = (rgb, wd) => {
    const m = wd >= 1 ? 0 : M.round((1 - wd) * 32) / 32, key = rgb + "_" + m;
    if (!cc[key]) cc[key] = "rgb(" + [16, 8, 0].map((b) => { const v = (rgb >> b) & 255; return M.round(v + (255 - v) * m); }).join(",") + ")";
    return cc[key];
  };
  const taper = (st, p, Lc) => {
    const k = G.car / 582, t = st.t;
    if (t === "a") return 0.95 + 0.45 * ss(0, 1, M.min(p, Lc - p) / (10 * k));
    if (t === "g") { const z = M.min(0.2 * Lc, 14 * k); return 0.35 + 0.65 * ss(0, 1, M.min(p, Lc - p) / z); }
    if (t === "h") return M.min(0.85 + 0.15 * ss(0, M.min(0.1 * Lc, 2 * k), p), p > 0.55 * Lc ? 0.12 + 0.88 * ss(0, 0.45 * Lc, Lc - p) : 1);
    return M.min(st.f & 1 ? 1 : 0.5 + 0.5 * ss(0, M.min(0.15 * Lc, 9 * k), p), st.f & 2 ? 1 : 0.15 + 0.85 * ss(0, M.min(0.25 * Lc, 18 * k), Lc - p));
  };
  // Draw stroke st from float index A to B, batching segments of equal width and colour into one path.
  // A retiring ghost (st.fd 0 -> 1) is redrawn mixed toward white over the opaque veil; at 1 it is gone.
  const drawRange = (st, A, B) => {
    const T = TIER[st.t], c = ctx[T[2]];
    if (B <= A || !c || st.fd >= 1) return;
    const kx = G.kx, ky = G.ky, sc = (kx + ky) / 2, Lc = st.L * sc, pts = [ptAt(st, A)];
    for (let i = M.floor(A) + 1; i < B; i++) pts.push([st.x[i], st.y[i], st.s[i]]);
    pts.push(ptAt(st, B));
    c.globalCompositeOperation = T[3] ? "destination-over" : "source-over";
    let cw = -1, cs = "";
    for (let j = 1; j < pts.length; j++) {
      const p = pts[j - 1], q = pts[j], w = T[0] * G.w1 * taper(st, ((p[2] + q[2]) / 2) * sc, Lc), wd = w * dpr;
      const lw2 = M.round((wd < 1 ? 1 / dpr : w) * 20) / 20, s = col(T[1], T[4] ? 1 - (st.fd || 0) : wd);
      if (lw2 !== cw || s !== cs) {
        if (cw > 0) c.stroke();
        c.beginPath();
        c.lineWidth = cw = lw2;
        c.strokeStyle = cs = s;
        c.moveTo(G.ox + p[0] * kx, G.oy + p[1] * ky);
      }
      c.lineTo(G.ox + q[0] * kx, G.oy + q[1] * ky);
    }
    if (cw > 0) c.stroke();
  };
  // after layout(), which resized (and so cleared) the canvases: replay all ink up to pen time t
  const replay = (t) => {
    for (let i = 0; i < lim; i++) {
      const s = S[i];
      s.upto = M.min(s.cap >= 0 ? s.cap : 1e9, s.start < t ? posAt(s, (t - s.start) / s.dur) : 0);
      drawRange(s, 0, s.upto);
    }
  };

  // ---- develop (today's model, hero-drawing-20261027.js:90-98, 358-385) and the exit by layer ----
  const fall = (u) => (u <= INNER ? 1 : u >= 1 ? 0 : 1 - ss(INNER, 1, u));
  const STOPS = [];
  for (let i = 0; i < 12; i++) STOPS.push(INNER + ((1 - INNER) * i) / 11);
  let mask = "";
  const setMask = (k, D, B) => {
    const a = (u) => "rgb(255 255 255 / " + (1 - D * (1 - B * (1 - fall(u)))).toFixed(3) + ")";
    const ry = M.max(1, k), v = B < 5e-4 || D <= 0 ? a(0)
      : "radial-gradient(" + (ry * ELL).toFixed(1) + "px " + ry.toFixed(1) + "px at " + G.cx.toFixed(1) + "px " + G.cy.toFixed(1) + "px, " + a(0) + " 0%, " + STOPS.map((u) => a(u) + " " + (u * 100).toFixed(2) + "%").join(", ") + ")";
    if (v !== mask) veil.style.background = mask = v;
  };
  const setOp = (c, v) => { const s = v >= 0.999 ? "" : v.toFixed(3); if (cv[c].style.opacity !== s) cv[c].style.opacity = s; };
  let K = 0, Dn = 0, Bi = 0, devDur = DEV_MS;
  const develop = (t, d0) => {
    const dev = d0 < 0 ? 0 : M.min(1, M.max(0, (t - d0) / devDur)), p = ease(dev);
    Dn = p;
    Bi = BIAS * (1 - ss(0.3, 0.8, dev));
    K = G.k0 + (G.k1 - G.k0) * M.pow(Dn, RPOW);
    setMask(K, Dn, Bi);
    setOp(0, 1 - ease(M.min(1, (dev * devDur) / G_EXIT)));
    setOp(1, 1 - ss(0.1, 0.4, p));
    setOp(2, 1 - ss(0.4, 0.95, p));
    return dev;
  };

  // ---- the live sequence ----
  let fcpAt = -1, loadT = -1, c1At = -1, tStart = -1, prev = 0, clock = 0, cur = 0, devAt = -1, decAt = -1, sAt = -1, sMs = SETTLE;
  let sK = 0, sD = 0, sB = 0;
  const op0 = [];
  try {
    const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === "first-contentful-paint") fcpAt = e.startTime; if (fcpAt >= 0) po.disconnect(); });
    po.observe({ type: "paint", buffered: true });
  } catch (e) { fcpAt = 0; }
  const nav = P.getEntriesByType("navigation")[0];
  if (nav && nav.loadEventEnd > 0) loadT = nav.loadEventEnd;
  else on(W, "load", () => { loadT = P.now(); });

  // ms: the fade; w: why (the first reason is kept in H.settledBy)
  settle = (ms, w) => {
    if (done) return;
    if (!H.settledBy) H.settledBy = w;
    if (Dc.hidden || tStart < 0) return finish();
    penUp();
    const tNow = P.now(), want = ms || SETTLE;
    if (sAt >= 0 && sAt + sMs - tNow <= want) return;
    sAt = tNow;
    sMs = want;
    H.state = "settling";
    sK = K;
    sD = Dn;
    sB = Bi;
    for (let c = 0; c < 3; c++) op0[c] = cv[c].style.opacity === "" ? 1 : +cv[c].style.opacity;
    if (decAt < 0) R.classList.remove("hero-draw-own");
  };

  const onFrame = (tNow) => {
    if (done) return;
    raf = requestAnimationFrame(onFrame);
    try {
      if (tStart < 0) {
        // t0: FCP reported (or 1.5 s), and load + 140 ms (or 300 ms after that), and the car at least half on screen
        const c1 = fcpAt >= 0 || tNow >= boot + FCP_HOLD;
        if (c1 && c1At < 0) c1At = tNow;
        if (!c1 || !((loadT >= 0 && tNow >= loadT + LOAD_WAIT) || tNow >= c1At + LOAD_CAP)) return;
        tStart = prev = tNow;
        H.t0 = tNow;
        H.fcp = fcpAt;
        H.loadAt = loadT;
        layout();
        // start rule 3: the car box under half on screen gives a 300 ms quick reveal, no lines
        if (G.share < 0.5) { H.quick = +G.share.toFixed(3); return settle(QUICK, "quick"); }
        wrap.hidden = false;
        H.linesAt = tNow;
        H.state = "drawing";
        if (W.IntersectionObserver) {
          let first = 1;
          io = new IntersectionObserver((es) => {
            for (const e of es) if (!first && e.intersectionRatio < 0.5 && devAt < 0) settle(300, "offscreen");
            first = 0;
          }, { threshold: [0.5] });
          io.observe(cv[2]);
        }
      }
      // fix-r2: a devicePixelRatio change without a CSS size change (the window moved to a screen with another scaling)
      // lays the canvases out again and replays the ink. The ResizeObserver sees CSS sizes only, and a (resolution)
      // media query's change event did not fire for Chrome's emulated scale change, so the ratio is read every frame
      // (the loop, and so the check, ends with the sequence).
      if (M.min(3, W.devicePixelRatio || 1) !== dpr && layout()) replay(clock);
      if (sAt >= 0) {
        const p = M.min(1, (tNow - sAt) / sMs), e = 1 - (1 - p) * (1 - p);
        K = sK + (G.k1 - sK) * e;
        Dn = sD + (1 - sD) * e;
        Bi = sB * (1 - e);
        setMask(K, Dn, Bi);
        for (let c = 0; c < 3; c++) setOp(c, op0[c] * (1 - e));
        if (p >= 1) finish();
        return;
      }
      clock += M.min(tNow - prev, STEP);
      prev = tNow;
      // wall limit: never fast-forward; what is left is skipped and the photo develops now
      if (cur < lim && tNow - tStart > last + WALL) {
        const part = S[cur].upto > 0 ? 1 : 0;
        H.skipped = lim - cur - part;
        S[cur].cap = S[cur].upto;
        lim = cur + part;
        cur = lim;
        if (devAt < 0) { devAt = clock; devDur = DEV_MIN; H.devStart = devAt; H.state = "developing"; }
      }
      const drawnFrom = cur;
      while (cur < lim && S[cur].start < clock) {
        const s = S[cur], f = posAt(s, (clock - s.start) / s.dur);
        drawRange(s, s.upto, f);
        s.upto = f;
        if (clock >= s.end) cur++;
        else break;
      }
      if (cur >= lim) penUp();
      // revision 2: each ghost loop retires over GH_MS once its rim's last stroke has inked (no double rim line)
      let rg = 0;
      for (const s of S) if (s.r) { const v = M.min(1, M.max(0, (clock - s.r.end) / GH_MS)); if (v !== (s.fd || 0)) { s.fd = v; rg = 1; } }
      if (rg && ctx[0]) { ctx[0].clearRect(0, 0, 1e5, 1e5); for (const s of S) if (s.t === "g") drawRange(s, 0, s.upto); }
      H.frame = { penT: +clock.toFixed(2), from: drawnFrom, to: cur, partial: cur < lim && S[cur].start < clock };
      H.penT = M.round(clock);
      if (devAt < 0) {
        const want = last + DEV_GAP;
        if (clock >= want && (decAt >= 0 || clock >= last + HOLD)) {
          devAt = clock;
          devDur = clock > want + 1 ? M.max(DEV_MIN, DEV_MS - (clock - want)) : DEV_MS;
          if (decAt < 0) R.classList.remove("hero-draw-own");
          H.devStart = devAt;
          H.decodedAt = decAt < 0 ? -1 : decAt - tStart;
          H.state = "developing";
        }
      }
      if (develop(clock, devAt) >= 1 && devAt >= 0) finish();
    } catch (err) {
      fail(err);
    }
  };

  // Test hook (costs nothing unless called): pen point [x, y, arc] in src px of stroke i at tau. With H.geo
  // ([layout, canvas offsets in CSS px, dpr]) and H.tier a test maps any stroke to device pixels of its canvas.
  H.at = (i, tau) => ptAt(S[i], posAt(S[i], tau));

  // arm: the guard's data-hero-pen ("now", or "late" for a tab first shown later); armedAt: when a late arm
  // happened (0 for "now"), as hero-drawing-20261027.js exposed them
  const begin = () => {
    H.state = "pending";
    H.arm = R.getAttribute("data-hero-pen") || "";
    H.armedAt = H.arm === "late" ? M.round(P.now()) : 0;
    // A late engine (fix-r1). This inline script still runs only after the parser-blocking scripts before it
    // (script.js, skills-card-20261012.js, exploded.js), so on a slow load it can start when the CSS failsafe is
    // about to reveal the photo, or already has (the fade runs 2.8-3.3 s on the veil's own clock). Taking the veil
    // over then would cover a photo already shown with white again. Past LATE on that clock the CSS keeps the reveal
    // and the engine only cleans up after it, as hero-drawing-20261027.js did: no ink, no hero-draw-js or -own;
    // intent plays the rest of that fade at 3x; a hidden tab, pagehide or leaving still finish at once. Without
    // getAnimations the clock is the time since the arm (navigation start for "now").
    const fs = veil.getAnimations && veil.getAnimations().find((a) => a.animationName === "hero-draw-failsafe"), el = fs ? +fs.currentTime : P.now() - H.armedAt;
    if (el > LATE) {
      H.state = "late";
      H.failsafeAt = M.round(el);
      penUp();
      settle = (ms, w) => {
        if (H.settledBy) return;
        H.settledBy = w;
        try {
          if (fs.currentTime < F_DELAY) fs.currentTime = F_DELAY;
          fs.playbackRate = F_FAST;
        } catch (e) { return finish(); }
        clearTimeout(ceilTimer);
        ceilTimer = setTimeout(finish, F_RUSH);
      };
      ceilTimer = setTimeout(finish, M.max(0, F_END - el));
      return;
    }
    R.classList.add("hero-draw-js", "hero-draw-own");
    setTimeout(() => {
      if (done) return;
      try {
        if (getComputedStyle(media).display === "none" || !prepare()) return finish();
        setMask(0, 0, 0);
        for (const c of cv) on(c, "contextlost", () => settle(SETTLE, "contextlost"));
        ro = new ResizeObserver(() => {
          if (done || !G) return;
          if (pickCls() !== klass) return settle(SETTLE, "class-change");
          const r = bg.getBoundingClientRect();
          if (r.width === lw && r.height === lh) return;
          layout();
          if (tStart >= 0) replay(clock);
        });
        ro.observe(bg);
        // decode gate: both photo layers decoded (decode() waits for the load; a failed decode still counts)
        Promise.all(photos.map((i) => i.decode().catch(() => 0))).then(() => { decAt = P.now(); });
        ceilTimer = setTimeout(() => { settle(CEIL_FADE, "ceiling"); ceilTimer = setTimeout(finish, CEIL_FADE + 60); }, CEIL);
        raf = requestAnimationFrame(onFrame);
      } catch (err) {
        fail(err);
      }
    }, 0);
  };

  // A tab hidden or prerendered at parse: the guard set data-hero-pen="wait"; begin on the first visible.
  if (!armed()) {
    H.state = "wait-visible";
    go = () => {
      if (armed() && !Dc.hidden && !Dc.prerendering) { go = () => 0; begin(); }
    };
    on(Dc, "prerenderingchange", () => go());
    return;
  }
  raf = requestAnimationFrame(() => { if (!done) begin(); });
})();
