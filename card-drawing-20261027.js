/* Homepage project cards, "Drawn, then built" (one-time arrival per card).
 *
 * The first time a card's cover comes into view, the cover is first its engineering line drawing
 * (assets/editorial/lines-20261027/, rendered from the same camera and pose as the cover, so
 * the lines sit on the cover's own edges). The real cover then develops through the drawing and
 * the lines retire. The end state is today's card: every node this file adds is removed.
 *
 *   0 - 600 ms     lines wipe in across the object, left to right (a soft edge about 6 % of the
 *                  card wide; it crosses the drawing's own extent from 10 % to 90 % of the wipe,
 *                  paced by the ink: 10 % of the drawing's lines appear every 48 ms)
 *   450 - 1050 ms  the cover develops through a page-white veil (develop ease)
 *   600 - 1150 ms  the lines retire; then the veil and the lines are removed
 *
 * Contract
 * - This file is loaded after the window load event, in idle time (index.html), so it never
 *   competes with the hero. The line image loads late and at low priority, and never shares the
 *   network with real content: only after the window load event (or 4 s), only for cards within
 *   about one screen (at most 1000 px) of the viewport, and only once both hero photo layers and
 *   every cover in that zone have finished loading. A card is armed ("primed": white veil, lines
 *   masked out) only while it is still more than 15 % of a screen away from the viewport. Real
 *   content on screen is never hidden for choreography: a card already on screen when this file
 *   starts keeps its cover, untouched ("on-screen-at-start"), and a card that comes close before
 *   its drawing has decoded keeps today's cover too. A card that is already inside that 15 % band
 *   but off screen when this file starts (the row just under the fold of a tall window, or a first
 *   row right under the hero of a wide one) still draws: it is armed only after the hero opening
 *   has ended, while the page is at rest (nothing has scrolled it, and no touch, key or button
 *   press, for 300 ms), at a frame boundary where the scroll position is current, and while it is
 *   still at least 24 px off screen. Once such a card has been on screen it keeps its cover
 *   ("seen-before-drawing"). Covers keep their own loading (lazy, async);
 *   they are never held back, and a cover that is not decoded yet holds the drawing (at most
 *   4 s) instead of revealing an empty frame. Data saver and slow connections (effective type 3g
 *   or slower: round trips of 270 ms and more) keep today's cards.
 * - A primed card plays once >= 25 % of its cover is on screen, or after 200 ms partly on screen.
 *   Cards entering together start 70 ms apart. A card that leaves the screen mid-sequence ends.
 * - Cards further down draw once the hero opening has ended (gate released at 10 s at the
 *   latest); if it is still running at 3.2 s (a slow photo), a primed card on screen shows its
 *   cover instead (160 ms): no card draws alongside the hero or waits white for it.
 * - Leaving for another page finishes every card that is drawing or waiting on screen; after a
 *   back/forward-cache return, drawn cards never replay, and cards not yet seen still draw once.
 * - Text, layout and the cover element are never touched; overlays are absolutely positioned
 *   inside .card-media with pointer-events: none (no layout shift).
 * - Intent settles to the end state in 160 ms: mouse/pen pointerdown anywhere, any keydown, a
 *   real pointer move over a drawing card (hover), focus inside it, a touch on its slider, or a
 *   fast scroll (over max(2400 px/s, 2.6 screens/s): moving on, not reading) while cards are
 *   drawing on screen. Reading-pace scrolling is how cards arrive, so it (or a touch that starts
 *   it) is not intent; nor is the smooth scroll of a same-page link ("View all 16 projects") or
 *   a hash change: until that scroll ends (scrollend, or 150 ms without a scroll event; 1.5 s at
 *   most) the fast-scroll rule is off, so cards at the destination play as on arrival.
 *   A hidden tab, pagehide and leaving the page finish at once. Using the project filter or
 *   search ends the feature for this page (entering cards then just fade in, script.js FLIP).
 * - Kill switches: ?draw=off (every drawing sequence) and ?cards=static (this one, and the
 *   filter motion). Reduced motion and forced colors (high contrast) keep today's cards, as does
 *   a filter or search already in use when this file starts. ?cards=draw replays cards already drawn
 *   in this tab session (each card otherwise draws once per tab session, sessionStorage
 *   "kw-cards-drawn"). ansysCfd (a CFD plot) has no drawing and keeps today's cover.
 * - QA: window.__cardDraw = { enabled, reason, heroWait, cards: { key: { phase, ... } } }; a card
 *   armed at rest has nearStart and armedAtRest (its distance off screen, px).
 */
(() => {
  "use strict";

  const root = document.documentElement;
  const grid = document.getElementById("project-cards");
  const query = location.search;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const QA = (window.__cardDraw = { enabled: false, reason: "", heroWait: false, cards: {} });
  const now = () => performance.now();

  if (!grid) { QA.reason = "no-grid"; return; }
  if (/[?&](draw=off|cards=static)(&|$)/.test(query)) { QA.reason = "kill-switch"; return; }
  if (reduce.matches) { QA.reason = "reduced-motion"; return; }
  if (window.matchMedia("(forced-colors: active)").matches) { QA.reason = "forced-colors"; return; }
  // Loaded after the load event: a filter or search used before that already ended the feature.
  const activeFilter = document.querySelector(".filter-bar .filter.active");
  const search = document.getElementById("project-search");
  if ((activeFilter && activeFilter.dataset.filter !== "all") || (search && search.value.trim())) { QA.reason = "filter"; return; }
  const supports = (prop, value) => Boolean(window.CSS && CSS.supports && CSS.supports(prop, value));
  const MASK_POS = supports("mask-image", "linear-gradient(#000,#000)") && supports("mask-position", "0% 0%")
    ? "maskPosition"
    : supports("-webkit-mask-image", "linear-gradient(#000,#000)") && supports("-webkit-mask-position", "0% 0%")
      ? "webkitMaskPosition" : "";
  if (!MASK_POS || !window.IntersectionObserver || !Element.prototype.animate) { QA.reason = "unsupported"; return; }
  const conn = navigator.connection;
  if (conn && conn.saveData) { QA.reason = "save-data"; return; }
  if (conn && /^(slow-2g|2g|3g)$/.test(conn.effectiveType || "")) { QA.reason = "slow-connection"; return; }

  // Line drawings by card-lines (tools/card-lines): [600 w hash, 1200 w hash, left, right, q10, q90].
  // Hashes are sha256[:12] from assets/editorial/lines-20261027/lines.json; left/right are the
  // drawing's horizontal extent as a share of the card width (alpha > 12 in either file), so the
  // wipe spends its time crossing the object instead of the empty margins; q10/q90 are where 10 %
  // and 90 % of its ink lies along the wipe (tools/card-lines/wipe_ink.py prints all four values).
  // Regenerating a drawing means a new dated folder and new values here.
  const DIR = "assets/editorial/lines-20261027/";
  const LINES = {
    steering: ["a37ac4e7d10c", "1b7fbe5b1b77", 0.298, 0.702, 0.383, 0.626],
    vineRobot: ["d189d8871eb5", "a25b835fdcd0", 0.332, 0.668, 0.369, 0.619],
    brakeSim: ["c2db83750a22", "9c8324c308a2", 0.223, 0.777, 0.292, 0.7],
    scanner: ["3321b1109767", "2ed1a61b35b8", 0.228, 0.772, 0.296, 0.704],
    javelin: ["0b28f45f849d", "c9e824e05a24", 0.323, 0.677, 0.357, 0.636],
    materialTest: ["c795fc816ef7", "162f0a0419bd", 0.36, 0.64, 0.452, 0.56],
    aura: ["19d8c1d6b56e", "d075460189ed", 0.387, 0.613, 0.42, 0.6],
    carbonSeat: ["fcbf6bdd12cd", "06852f3e1e86", 0.332, 0.668, 0.376, 0.626],
    seat: ["ceaaf3ab2376", "415565adf8bd", 0.302, 0.698, 0.375, 0.632],
    pool: ["bb6df18c0ed7", "265b6c3ab57c", 0.24, 0.76, 0.357, 0.693],
    lineFollower: ["9a02cf6cca95", "3c8c82bdaf04", 0.132, 0.868, 0.371, 0.786],
    formlabs: ["6c3b232ab44b", "9b08a092188e", 0.182, 0.818, 0.331, 0.701],
    telecaster: ["fd91fc8e7252", "17e6850641a0", 0.413, 0.587, 0.458, 0.564],
    education: ["26015985abd9", "aceb274fa393", 0.3, 0.727, 0.397, 0.711],
    ftc: ["ed25ebf97b0c", "d0043003b22a", 0.348, 0.652, 0.419, 0.596],
  };

  const WIPE_MS = 600;                        // lines wipe in
  const DEV_START = 450, DEV_MS = 600;        // cover develops 450-1050 ms
  const RETIRE_START = 600, RETIRE_MS = 550;  // lines retire 600-1150 ms
  const STAGGER = 70;                         // between cards entering together
  const SETTLE_MS = 160;                      // intent -> end state (+ a frame: < 250 ms)
  const PLAY_RATIO = 0.25;                    // share of the cover on screen that starts it
  const DWELL_MS = 200;                       // ...or this long partly on screen
  const GUARD = 0.15;                         // arm only while > 15 % of a screen away
  // ...except a card already in that band (but off screen) at the start: armed when the page is at
  // rest, i.e. nothing has scrolled it and no touch, key or button press for REST_MS, and only
  // while it is at least REST_PX off screen. Checked in a frame callback, after that frame's
  // scroll events: a scroll the compositor began meanwhile has then been reported, so the only
  // scroll the veil can race is one starting within the next frame or two, which from rest moves
  // a few px in that time, less than REST_PX (and a cover's top edge is page white anyway).
  const REST_MS = 300, REST_PX = 24;
  const COVER_HOLD = 4000;                    // longest wait for the cover to decode
  const HERO_CEIL = 3200;                     // longest wait for the hero opening
  const HERO_FINAL = 10000;                   // gate released even if the hero never finishes
  const LOAD_CEIL = 4000;                     // line loading opens at window load, or by then
  const NEAR_MAX = 1000;                      // the loading zone: one screen, at most this (px)
  const FAST_MIN = 2400, FAST_SCREENS = 2.6;  // a scroll faster than this (px/s) is intent
  const FAST_WINDOW = 120;                    // ...if the last scroll event is this recent (ms)
  const ANCHOR_IDLE = 150, ANCHOR_CAP = 1500; // a same-page link's scroll: ends after 150 ms quiet
  // Wipe geometry, from the CSS mask (white-home-20261011.css): a 100deg gradient, opaque to
  // 48.8 % and clear from 51.2 % (a soft edge about 6 % of the card wide), sized 250 % x 100 % of
  // the 640:427 box; mask-position x puts the mask image's left edge at (1 - 2.5) * x box widths.
  // Below, in box widths: on the middle row the edge's centre is at the image centre; on every
  // row (the 10deg tilt included) left of M_SHOWN is fully drawn, right of M_HIDDEN not at all.
  const M_SIZE = 2.5, M_A = 0.488, M_B = 0.512, M_ANGLE = (100 * Math.PI) / 180, BOX_H = 427 / 640;
  const M_ALONG = (M_SIZE * Math.sin(M_ANGLE) + BOX_H * Math.abs(Math.cos(M_ANGLE))) / Math.sin(M_ANGLE);
  const M_TILT = (BOX_H / 2) * Math.abs(Math.cos(M_ANGLE) / Math.sin(M_ANGLE));
  const M_SHOWN = M_SIZE / 2 + (M_A - 0.5) * M_ALONG - M_TILT;
  const M_HIDDEN = M_SIZE / 2 + (M_B - 0.5) * M_ALONG + M_TILT;
  const M_MARGIN = 0.02;
  const posAt = (edge) => (100 * edge) / (M_SIZE - 1);   // mask-position x (%) for an image-left edge at -edge
  // The wipe's mask-position keyframes for the drawing [left, right] with its ink quantiles
  // [q10, q90]: fully hidden at 0, the edge's centre on the drawing's left extent at 10 %, on q10
  // at 18 %, on q90 at 82 % and on its right extent at 90 % of the wipe, complete at 100 %. Linear
  // in between, so the ink appears at an even pace (10 % of it per 8 % of the wipe): a stroke ease
  // over the extent made most drawings, whose lines sit near their middle, flash in within about
  // 150 ms. The soft-edge and tilt margins are crossed in the first and last 10 %, where nothing of
  // the drawing is.
  const wipeFrames = (left, right, q10, q90) => {
    const a = Math.min(Math.max(q10, left), right), b = Math.min(Math.max(q90, a), right);
    return [
      { offset: 0, x: Math.min(100, posAt(M_HIDDEN - left + M_MARGIN)) },
      { offset: 0.1, x: posAt(M_SIZE / 2 - left) },
      { offset: 0.18, x: posAt(M_SIZE / 2 - a) },
      { offset: 0.82, x: posAt(M_SIZE / 2 - b) },
      { offset: 0.9, x: posAt(M_SIZE / 2 - right) },
      { offset: 1, x: Math.max(0, posAt(M_SHOWN - right - M_MARGIN)) },
    ];
  };
  const EASE_DEV = "cubic-bezier(.65,0,.35,1)";
  const EASE_SETTLE = "cubic-bezier(.33,1,.68,1)";

  const SESSION_KEY = "kw-cards-drawn";
  const replay = /[?&]cards=draw(&|$)/.test(query);
  let drawn = new Set();
  try {
    if (!replay) drawn = new Set((sessionStorage.getItem(SESSION_KEY) || "").split(",").filter(Boolean));
  } catch (e) { /* storage blocked: cards may draw again on a later load */ }
  const remember = (key) => {
    drawn.add(key);
    try { sessionStorage.setItem(SESSION_KEY, [...drawn].join(",")); } catch (e) { /* ignore */ }
  };

  // ---- records ----
  const recs = [];
  const byMedia = new Map();
  const byCard = new Map();
  const coverOf = new Map();   // every card's media -> its cover (cards without a drawing too)
  for (const card of grid.querySelectorAll(".project-card[data-project]")) {
    const key = card.dataset.project;
    const media = card.querySelector(".card-media");
    const cover = media && media.querySelector("img");
    if (cover) coverOf.set(media, cover);
    const qa = (QA.cards[key] = { phase: "static" });
    if (!LINES[key] || !cover) { qa.why = "no-drawing"; continue; }
    if (drawn.has(key)) { qa.why = "drawn-this-session"; continue; }
    const rec = { key, card, media, cover, qa, phase: "", lines: null, veil: null, loading: false, decoded: false,
      near: false, inGuard: false, nearStart: false, restWait: false, ratio: 0, dwell: 0, dwellDone: false,
      startAt: 0, played: false, anims: [] };
    recs.push(rec);
    byMedia.set(media, rec);
    byCard.set(card, rec);
    setPhase(rec, "idle");
  }
  if (!recs.length) { QA.reason = "nothing-to-draw"; return; }

  let enabled = true;
  let firstGuard = true;      // until the first guard pass has run (see guardIO)
  QA.enabled = true;
  QA.initAt = Math.round(now());

  function setPhase(rec, phase, why) {
    rec.phase = phase;
    rec.qa.phase = phase;
    rec.qa[`${phase}At`] = Math.round(now());
    if (why) rec.qa.why = why;
  }

  // Every callback runs guarded: any error removes every overlay (today's cards) and stops.
  function guard(fn) {
    return (...args) => {
      try { return fn(...args); } catch (err) { abortAll(err); }
      return undefined;
    };
  }
  function abortAll(err) {
    QA.error = String(err && err.message || err);
    enabled = false;
    QA.enabled = false;
    for (const rec of recs) { try { finish(rec, "error"); } catch (e) { /* keep going */ } }
  }

  const active = (rec) => rec.phase === "playing" || rec.phase === "settling";
  const onScreenPrimed = (rec) => rec.phase === "primed" && rec.ratio > 0;

  // ---- loading the drawing (late, low priority, decoded before use) ----
  // A drawing is requested only when nothing real is still loading nearby: both hero photo
  // layers and every cover in the loading zone are complete (loaded or failed). Otherwise the
  // pump waits for those images and tries again, so a line image never shares bandwidth with a
  // photo or cover the visitor is about to see.
  const heroPhotos = [...document.querySelectorAll(".hero-media img")];
  const nearMedia = new Set();
  let loadsOpen = false;
  const wakers = new WeakSet();   // images the pump already listens to
  function blockers() {
    const list = heroPhotos.filter((img) => !img.complete);
    for (const media of nearMedia) {
      const img = coverOf.get(media);
      if (img && !img.complete) list.push(img);
    }
    return list;
  }
  // Each blocking image wakes the pump once it finishes; the pump then re-checks the blockers of
  // that moment (a cover that has left the zone in the meantime no longer holds anything back).
  function wakeOn(img) {
    if (wakers.has(img)) return;
    wakers.add(img);
    const again = guard(() => { wakers.delete(img); pump(); });
    img.addEventListener("load", again, { once: true });
    img.addEventListener("error", again, { once: true });
  }
  const wantsLoad = (rec) => !rec.loading && loadsOpen && rec.near && rec.phase === "idle";
  function pump() {
    // Not before the first guard pass: a card already on screen never requests its drawing.
    if (!enabled || firstGuard || !recs.some(wantsLoad)) return;
    const wait = blockers();
    for (const rec of recs) if (wantsLoad(rec) && !rec.cover.complete && !wait.includes(rec.cover)) wait.push(rec.cover);
    if (wait.length) {
      QA.pumpWaits = (QA.pumpWaits || 0) + 1;
      wait.forEach(wakeOn);
      return;
    }
    for (const rec of recs) if (wantsLoad(rec)) load(rec);
  }
  function load(rec) {
    if (rec.loading || !enabled || (rec.phase !== "idle" && rec.phase !== "primed")) return;
    if (!rec.cover.naturalWidth) { finish(rec, "cover-failed"); return; }
    rec.loading = true;
    const img = document.createElement("img");
    img.className = "card-draw-lines";
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.decoding = "async";
    img.draggable = false;
    img.width = 1200;
    img.height = 800;
    if ("fetchPriority" in img) img.fetchPriority = "low";
    img.sizes = rec.cover.getAttribute("sizes") || "100vw";
    const [h600, h1200] = LINES[rec.key];
    img.srcset = `${DIR}${rec.key}-600.webp?v=${h600} 600w, ${DIR}${rec.key}.webp?v=${h1200} 1200w`;
    rec.lines = img;
    rec.qa.requestedAt = Math.round(now());
    img.decode().then(guard(() => {
      if (rec.phase !== "idle") return;
      rec.decoded = true;
      rec.qa.decodedAt = Math.round(now());
      tryPrime(rec);
    }), guard(() => {
      rec.qa.linesFailed = true;
      if (rec.phase === "idle") skip(rec, "lines-failed");
    }));
  }
  function openLoads() {
    if (loadsOpen || !enabled) return;
    loadsOpen = true;
    QA.loadsOpenAt = Math.round(now());
    pump();
  }

  // ---- arming: white veil + masked lines, only well away from the viewport ----
  function inGuardNow(rec) {
    const r = rec.media.getBoundingClientRect();
    if (!r.width || !r.height) return true;   // filtered out (display: none): never arm
    const m = window.innerHeight * GUARD;
    return r.bottom > -m && r.top < window.innerHeight + m;
  }
  function tryPrime(rec) {
    if (!enabled || rec.phase !== "idle" || !rec.decoded) return;
    if (rec.inGuard || inGuardNow(rec)) {
      if (rec.nearStart) waitForRest(rec);
      else skip(rec, "near-viewport-before-drawing");
      return;
    }
    arm(rec);
  }
  function arm(rec) {
    veil(rec);
    rec.cover.after(rec.veil, rec.lines);
    setPhase(rec, "primed");
  }

  // A card that was in the guard band but off screen when this file started (see REST_MS): it
  // waits, idle and showing its cover, for the hero opening to end and the page to be at rest.
  let lastInputAt = -Infinity;   // touch, key or button press (scrolls: lastScrollAt)
  let restTimer = 0;
  const restLeft = () => REST_MS - (now() - Math.max(lastScrollAt, lastInputAt));
  function waitForRest(rec) {
    rec.restWait = true;
    rec.qa.restWait = true;
    scheduleRest();
  }
  function scheduleRest() {
    if (restTimer || heroWaiting || !enabled || !recs.some((r) => r.restWait && r.phase === "idle")) return;
    restTimer = setTimeout(guard(() => requestAnimationFrame(guard(restCheck))), Math.max(0, restLeft()));
  }
  // In a frame callback: this frame's scroll events have run, so the scroll position is current.
  function restCheck() {
    restTimer = 0;
    if (!enabled || heroWaiting) return;
    if (restLeft() > 0) { scheduleRest(); return; }
    const H = window.innerHeight;
    for (const rec of recs) {
      if (!rec.restWait || rec.phase !== "idle") continue;
      rec.restWait = false;
      rec.qa.restWait = false;
      const r = rec.media.getBoundingClientRect();
      if (!r.width || !r.height) { skip(rec, "near-viewport-before-drawing"); continue; }
      const off = Math.max(r.top - H, -r.bottom);   // px off screen; <= 0: (partly) on screen
      if (rec.ratio > 0 || off <= 0) { skip(rec, "seen-before-drawing"); continue; }
      if (off < REST_PX) { skip(rec, "near-viewport-before-drawing"); continue; }
      rec.qa.armedAtRest = Math.round(off);
      arm(rec);
    }
  }
  function veil(rec) {
    const el = document.createElement("div");
    el.className = "card-draw-veil";
    el.setAttribute("aria-hidden", "true");
    rec.veil = el;
    return el;
  }

  // ---- playing ----
  // Scroll speed over the last 40-150 ms of scroll events: the lower median of the speeds between
  // consecutive events. A real flick is fast on every event; one long main-thread frame is not a
  // flick (a scroll event handled late still reads the old position and the next one the caught-up
  // position, a single fast-looking step that an average over the window would count).
  const scrolls = [];
  let speed = 0, lastScrollAt = -Infinity;
  function scrollSpeed(t) {
    while (scrolls.length && t - scrolls[0][0] > 150) scrolls.shift();
    if (scrolls.length < 2 || scrolls[scrolls.length - 1][0] - scrolls[0][0] < 40) return 0;
    const steps = [];
    for (let i = 1; i < scrolls.length; i += 1) {
      const dt = scrolls[i][0] - scrolls[i - 1][0];
      if (dt >= 1) steps.push((Math.abs(scrolls[i][1] - scrolls[i - 1][1]) / dt) * 1000);
    }
    if (!steps.length) return 0;
    steps.sort((a, b) => a - b);
    return steps[(steps.length - 1) >> 1];
  }
  const fastLimit = () => Math.max(FAST_MIN, FAST_SCREENS * window.innerHeight);
  // A same-page link or hash change scrolls smoothly to its target: not "moving on".
  let anchoring = false, anchorIdle = 0, anchorCap = 0;
  function anchorStart() {
    anchoring = true;
    lastInputAt = now();
    QA.anchorScrolls = (QA.anchorScrolls || 0) + 1;
    clearTimeout(anchorIdle);
    clearTimeout(anchorCap);
    anchorIdle = setTimeout(guard(anchorEnd), ANCHOR_IDLE * 2);   // no scroll at all (already there)
    anchorCap = setTimeout(guard(anchorEnd), ANCHOR_CAP);
  }
  function anchorEnd() {
    if (!anchoring) return;
    anchoring = false;
    clearTimeout(anchorIdle);
    clearTimeout(anchorCap);
    scrolls.length = 0;
    speed = 0;
    flush();
  }
  function fastNow() { return !anchoring && speed > fastLimit() && now() - lastScrollAt < FAST_WINDOW; }
  let lastStart = -Infinity;
  function flush() {
    if (!enabled) return;
    if (heroWaiting) {
      // Past the ceiling the hero is still running (a slow photo): no card draws alongside it, and
      // none waits white for it either; cards on screen show their covers.
      if (heroLate) for (const rec of recs) if (rec.phase === "primed" && rec.ratio > 0) settle(rec, "hero-late");
      return;
    }
    const fast = fastNow();
    for (const rec of recs) {
      if (rec.phase === "primed" && rec.decoded && (rec.ratio >= PLAY_RATIO - 1e-3 || rec.dwellDone)) {
        if (fast) { settle(rec, "fast-scroll"); continue; }
        const t = now();
        const at = Math.max(t, lastStart + STAGGER);
        lastStart = at;
        play(rec, at - t);
      }
    }
  }

  function coverReady(rec) {
    const img = rec.cover;
    return new Promise((resolve) => {
      let done = false;
      const ok = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
      const timer = setTimeout(ok, COVER_HOLD);
      const dec = () => { if (img.decode) img.decode().then(ok, ok); else ok(); };
      if (img.complete) dec();
      else {
        img.addEventListener("load", dec, { once: true });
        img.addEventListener("error", ok, { once: true });
      }
    });
  }

  function play(rec, delay) {
    clearTimeout(rec.dwell);
    rec.dwell = 0;
    if (!rec.lines.isConnected) rec.veil.after(rec.lines);
    setPhase(rec, "playing");
    rec.played = true;
    rec.startAt = now() + delay;
    rec.qa.delay = Math.round(delay);
    const [, , left, right, q10, q90] = LINES[rec.key];
    const frames = wipeFrames(left, right, q10, q90)
      .map(({ offset, x }) => ({ offset, [MASK_POS]: `${x.toFixed(2)}% 0%` }));
    rec.anims.push(rec.lines.animate(frames, { duration: WIPE_MS, delay, easing: "linear", fill: "both" }));
    coverReady(rec).then(guard(() => develop(rec, true)));
  }

  function develop(rec, withLines) {
    if (rec.phase !== "playing") return;
    const elapsed = now() - rec.startAt;
    const devDelay = Math.max(0, DEV_START - elapsed);
    rec.qa.developAt = Math.round(now() + devDelay);
    const dev = rec.veil.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: DEV_MS, delay: devDelay, easing: EASE_DEV, fill: "both" });
    rec.anims.push(dev);
    const ends = [dev.finished];
    if (withLines) {
      const retDelay = Math.max(RETIRE_START - elapsed, devDelay + (RETIRE_START - DEV_START));
      const ret = rec.lines.animate([{ opacity: 1 }, { opacity: 0 }],
        { duration: RETIRE_MS, delay: retDelay, easing: EASE_DEV, fill: "both" });
      rec.anims.push(ret);
      ends.push(ret.finished);
    }
    Promise.all(ends).then(guard(() => { if (rec.phase === "playing") finish(rec, "complete"); }), () => {});
  }

  // ---- ending ----
  function cancelAnims(rec) {
    for (const a of rec.anims) { try { a.cancel(); } catch (e) { /* ignore */ } }
    rec.anims.length = 0;
  }
  // The loading zone keeps watching (a skipped card's cover may still be loading near the viewport).
  function unobserve(rec) {
    guardIO.unobserve(rec.media);
    viewIO.unobserve(rec.media);
  }
  function finish(rec, why) {
    if (rec.phase === "done" || rec.phase === "skipped" || rec.phase === "static") return;
    clearTimeout(rec.dwell);
    rec.dwell = 0;
    cancelAnims(rec);
    if (rec.veil) rec.veil.remove();
    if (rec.lines && rec.lines.isConnected) rec.lines.remove();
    setPhase(rec, rec.played ? "done" : "skipped", why);
    if (rec.played) remember(rec.key);
    unobserve(rec);
  }
  function skip(rec, why) { finish(rec, why); }

  // Settle to the end state from wherever the sequence is, in `ms`.
  function settle(rec, why, ms = SETTLE_MS) {
    if (rec.phase === "primed" && rec.ratio === 0) { finish(rec, why); return; }
    if (rec.phase !== "playing" && rec.phase !== "primed") return;
    const veilAlpha = Number(getComputedStyle(rec.veil).opacity);
    const linesOn = rec.lines && rec.lines.isConnected;
    const lineStyle = linesOn ? getComputedStyle(rec.lines) : null;
    const lineAlpha = lineStyle ? Number(lineStyle.opacity) : 0;
    const maskAt = lineStyle ? lineStyle[MASK_POS] : "";
    cancelAnims(rec);
    if (lineStyle) rec.lines.style[MASK_POS] = maskAt;
    setPhase(rec, "settling", why);
    rec.qa.settledBy = why;
    const opt = { duration: ms, easing: EASE_SETTLE, fill: "forwards" };
    const ends = [rec.veil.animate([{ opacity: veilAlpha }, { opacity: 0 }], opt)];
    if (lineStyle) ends.push(rec.lines.animate([{ opacity: lineAlpha }, { opacity: 0 }], opt));
    rec.anims.push(...ends);
    const done = guard(() => finish(rec, why));
    Promise.all(ends.map((a) => a.finished)).then(done, () => {});
    setTimeout(done, ms + 120);   // even if a finished promise never settles
  }
  function settleAll(why) {
    for (const rec of recs) if (rec.phase === "playing" || onScreenPrimed(rec)) settle(rec, why);
  }
  function finishAll(why) {
    for (const rec of recs) if (active(rec) || onScreenPrimed(rec)) finish(rec, why);
  }
  function disable(why) {
    if (!enabled) return;
    enabled = false;
    QA.enabled = false;
    QA.reason = why;
    QA.disabledAt = Math.round(now());
    for (const rec of recs) {
      if (rec.phase === "playing" || onScreenPrimed(rec)) settle(rec, why);
      else if (rec.phase !== "settling") finish(rec, why);
    }
    for (const io of observers) io.disconnect();
  }

  // ---- hero opening: no card draws alongside it ----
  let heroWaiting = root.classList.contains("hero-draw");
  let heroMO = null, heroCeil = 0, heroFinal = 0, heroLate = false;
  QA.heroWait = heroWaiting;
  function heroDone(why) {
    if (!heroWaiting) return;
    heroWaiting = false;
    if (heroMO) heroMO.disconnect();
    clearTimeout(heroCeil);
    clearTimeout(heroFinal);
    QA.heroDoneAt = Math.round(now());
    QA.heroDoneBy = why;
    if (enabled) { flush(); scheduleRest(); }
  }
  // Still running at the ceiling: a primed card on screen shows its cover now (flush), and the
  // gate stays closed until the hero really ends, so nothing draws alongside it.
  function heroRunsLate() {
    if (!heroWaiting) return;
    heroLate = true;
    QA.heroLateAt = Math.round(now());
    flush();
  }
  if (heroWaiting) {
    heroMO = new MutationObserver(guard(() => { if (!root.classList.contains("hero-draw")) heroDone("hero"); }));
    heroMO.observe(root, { attributes: true, attributeFilter: ["class"] });
    heroCeil = setTimeout(guard(heroRunsLate), HERO_CEIL);
    heroFinal = setTimeout(guard(() => heroDone("timeout")), HERO_FINAL);
  }

  // ---- observers ----
  // The loading zone; it watches every card (a cover still loading there holds the drawings back).
  const nearPx = Math.round(Math.min(window.innerHeight || NEAR_MAX, NEAR_MAX));
  const nearIO = new IntersectionObserver(guard((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) nearMedia.add(e.target);
      else nearMedia.delete(e.target);
      const rec = byMedia.get(e.target);
      if (!rec) continue;
      rec.near = e.isIntersecting;
      if (rec.near && rec.phase === "idle" && rec.decoded) tryPrime(rec);
    }
    pump();
  }), { rootMargin: `${nearPx}px 0px ${nearPx}px 0px` });

  // Real content on screen is never hidden for choreography: a card already on screen when this
  // file starts keeps its cover, untouched. One in the guard band but off screen at that moment
  // stays idle (nearStart) and is armed later only at rest (waitForRest); one that comes into the
  // band later, before its drawing has decoded, keeps its cover.
  const guardIO = new IntersectionObserver(guard((entries) => {
    for (const e of entries) {
      const rec = byMedia.get(e.target);
      if (!rec) continue;
      rec.inGuard = e.isIntersecting;
      if (!e.isIntersecting) {
        // Scrolled well away from a start just off screen: an ordinary card from now on.
        rec.nearStart = false;
        if (rec.restWait) { rec.restWait = false; rec.qa.restWait = false; tryPrime(rec); }
        continue;
      }
      if (rec.phase !== "idle") continue;
      const b = e.boundingClientRect;
      const onScreen = b.width > 0 && b.bottom > 0 && b.top < window.innerHeight;
      if (firstGuard && !onScreen) { rec.nearStart = true; rec.qa.nearStart = true; continue; }
      skip(rec, firstGuard ? "on-screen-at-start" : "near-viewport-before-drawing");
    }
    if (firstGuard) { firstGuard = false; pump(); }
  }), { rootMargin: `${GUARD * 100}% 0px ${GUARD * 100}% 0px` });

  const viewIO = new IntersectionObserver(guard((entries) => {
    for (const e of entries) {
      const rec = byMedia.get(e.target);
      if (!rec) continue;
      rec.ratio = e.isIntersecting ? e.intersectionRatio : 0;
      if (active(rec) && rec.ratio === 0) { finish(rec, "offscreen"); continue; }
      // Seen with its cover before it was armed (a card that started just off screen): keeps it.
      if (rec.phase === "idle" && rec.ratio > 0) { skip(rec, firstGuard ? "on-screen-at-start" : "seen-before-drawing"); continue; }
      if (rec.phase !== "primed") continue;
      if (rec.ratio === 0) {
        clearTimeout(rec.dwell);
        rec.dwell = 0;
        rec.dwellDone = false;
      } else if (rec.ratio < PLAY_RATIO - 1e-3 && !rec.dwell && !rec.dwellDone) {
        rec.dwell = setTimeout(guard(() => {
          rec.dwell = 0;
          if (rec.phase === "primed" && rec.ratio > 0) { rec.dwellDone = true; flush(); }
        }), DWELL_MS);
      }
    }
    flush();
  }), { threshold: [0, 0.01, PLAY_RATIO] });   // 0.01: an edge-adjacent entry (ratio 0) still gets a callback once really on screen

  const observers = [guardIO, viewIO, nearIO];
  for (const rec of recs) { guardIO.observe(rec.media); viewIO.observe(rec.media); }
  for (const media of coverOf.keys()) nearIO.observe(media);

  if (document.readyState === "complete") setTimeout(guard(openLoads), 0);
  else window.addEventListener("load", () => setTimeout(guard(openLoads), 0), { once: true });
  setTimeout(guard(openLoads), LOAD_CEIL);

  // ---- intent ----
  const on = (target, type, fn, opts) => target.addEventListener(type, guard(fn), opts);
  // A fast scroll is moving on, not reading: cards drawing (or waiting white) on screen settle,
  // and none starts meanwhile.
  on(window, "scroll", () => {
    const t = now();
    scrolls.push([t, window.scrollY]);
    speed = scrollSpeed(t);
    lastScrollAt = t;
    if (speed > (QA.maxScrollSpeed || 0)) QA.maxScrollSpeed = Math.round(speed);
    if (anchoring) {   // a same-page link's smooth scroll: it ends 150 ms after its last event
      clearTimeout(anchorIdle);
      anchorIdle = setTimeout(guard(anchorEnd), ANCHOR_IDLE);
      return;
    }
    if (!enabled || speed <= fastLimit()) return;
    for (const rec of recs) {
      if ((rec.phase === "playing" && rec.ratio > 0) || onScreenPrimed(rec)) {
        QA.fastScroll = (QA.fastScroll || 0) + 1;
        settle(rec, "fast-scroll");
      }
    }
  }, { passive: true });
  const recOf = (target) => {
    const card = target instanceof Element ? target.closest(".project-card") : null;
    return card ? byCard.get(card) : undefined;
  };
  const live = (rec) => rec && (rec.phase === "playing" || onScreenPrimed(rec)
    || (rec.phase === "primed" && rec.ratio === 0));
  on(window, "pointerdown", (e) => {
    lastInputAt = now();   // a touch may start a scroll: no card is armed at rest meanwhile
    if (!enabled) return;
    if (e.pointerType !== "touch") { settleAll("pointerdown"); return; }
    // A touch that starts a scroll is how cards arrive; a touch on a card's own control is intent.
    const rec = recOf(e.target);
    if (live(rec) && e.target.closest("[data-explode-control], input, select, button, a:not(.card-open)")) settle(rec, "touch-control");
  }, { capture: true, passive: true });
  on(window, "keydown", () => { lastInputAt = now(); if (enabled) settleAll("keydown"); }, { capture: true, passive: true });
  // Hover: a real pointer move over the card (a card scrolling under a still cursor is not one).
  let lastScreen = null;
  on(window, "pointermove", (e) => {
    if (e.pointerType === "touch") return;
    const moved = Boolean(e.movementX || e.movementY)
      || (lastScreen !== null && (e.screenX !== lastScreen[0] || e.screenY !== lastScreen[1]));
    lastScreen = [e.screenX, e.screenY];
    if (!moved || !enabled) return;
    const rec = recOf(e.target);
    if (rec && (rec.phase === "playing" || onScreenPrimed(rec))) settle(rec, "hover");
  }, { capture: true, passive: true });
  on(document, "focusin", (e) => {
    const rec = recOf(e.target);
    if (live(rec)) settle(rec, "focus");
  });
  // The filter and search re-flow the grid (script.js FLIP): no drawing from then on.
  // A same-page link (#work, "View all 16 projects") scrolls smoothly to its target: that scroll
  // is not a fast scroll (see anchorStart).
  on(window, "click", (e) => {
    if (!(e.target instanceof Element)) return;
    if (e.target.closest(".filter-bar .filter")) { disable("filter"); return; }
    const link = e.target.closest("a[href]");
    if (link && link.hash && link.origin === location.origin && link.pathname === location.pathname
      && link.search === location.search) anchorStart();
  }, { capture: true });
  on(window, "hashchange", () => { if (!anchoring) anchorStart(); });
  if ("onscrollend" in window) on(window, "scrollend", () => { if (anchoring) anchorEnd(); });
  on(window, "input", (e) => {
    if (e.target instanceof Element && e.target.id === "project-search") disable("filter");
  }, { capture: true });
  on(document, "visibilitychange", () => { if (document.hidden) finishAll("hidden"); });
  on(window, "pagehide", () => finishAll("pagehide"));
  // Leaving for another page: finish now, so a back/forward-cache restore shows today's cards.
  if (window.navigation && navigation.addEventListener) {
    on(navigation, "navigate", (e) => { if (!e.destination || !e.destination.sameDocument) finishAll("navigate"); });
  }
  on(window, "pageshow", (e) => { if (e.persisted) finishAll("pageshow"); });
  if (reduce.addEventListener) {
    on(reduce, "change", () => {
      if (!reduce.matches) return;
      for (const rec of recs) finish(rec, "reduced-motion");
      disable("reduced-motion");
    });
  }
})();
