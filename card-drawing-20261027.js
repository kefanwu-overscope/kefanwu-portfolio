/* Homepage project cards, "Drawn, then built" (an arrival per card on every load and reload).
 *
 * When a card's cover comes into view, the cover is first its engineering line drawing
 * (assets/editorial/lines-20261027/, rendered from the same camera and pose as the cover, so the
 * lines sit on the cover's own edges). The real cover then develops through the drawing and the
 * lines retire. The end state is today's card: every node this file adds is removed.
 *
 *   waiting        page-white paper over the cover, the card's whole drawing at 30 % (pencil)
 *   0 - 600 ms     lines ink in across the object, left to right, over the pencil (a soft edge
 *                  about 6 % of the card wide; it crosses the drawing's own extent from 10 % to
 *                  90 % of the wipe, paced by the ink: 10 % of the drawing's lines every 48 ms)
 *   450 - 1050 ms  the cover develops through the paper (develop ease)
 *   600 - 1150 ms  the lines retire; then the paper and the lines are removed
 *
 * Contract (cards-20261109: a fast scroll no longer loses a drawing)
 * - This file is loaded after the window load event, in idle time (index.html), so it never
 *   competes with the hero. The line images load late and at low priority, and never share the
 *   network with real content: only after the window load event (or 4 s), and only once both hero
 *   photo layers and every cover within about one screen (at most 1000 px) of the viewport have
 *   finished loading. Then every card's drawing is requested, nearest first, at most 4 at a time
 *   (4-29 KB each; all 15 are 117 KiB at 600 w, 247 KiB at 1200 w): a drawing requested only when
 *   its card came near was not there yet when a fast scroll brought the card on screen.
 * - Waiting (phase "primed"): a card whose drawing has decoded is armed while it is off screen:
 *   page-white paper over the cover with its own drawing at PENCIL. On screen that is a quiet pencil
 *   state, never a blank white box and never the cover. Real content on screen is never hidden for
 *   choreography: a card already on screen when this file starts keeps its cover, untouched
 *   ("on-screen-at-start"); a card whose loaded cover came on screen before its drawing was ready
 *   keeps the cover while it is on screen and is armed once it is off screen again, so it draws the
 *   next time it comes back. A card nearer than 15 % of a screen is armed in a frame callback (the
 *   scroll position current), only while at least ARM_PX plus 50 ms of the scroll's travel off
 *   screen; one on screen whose cover has not loaded yet (an empty frame, nothing to hide) at once.
 * - Drawing: a waiting card draws once >= 25 % of its cover is on screen and the scroll is calm:
 *   no scroll event for IDLE_MS, or slower than about one screen a second (calmLimit: the window's
 *   height in px/s, CALM_MIN to CALM_MAX; the lower median of the step speeds between scroll events
 *   over the last 150 ms, known once two steps span 40 ms). While the page moves faster it waits in
 *   pencil; when the scroll calms, the cards on screen draw in reading order, 70 ms apart. The same
 *   for wheel, trackpad, keys, the scrollbar, a same-page link's smooth scroll and a touch fling.
 * - A card that leaves the screen before its drawing completes goes back to waiting (pencil) while it
 *   is off screen, and draws again from the start the next time it is on screen and the scroll is
 *   calm (QA restarts). A card that finished stays finished for the rest of the page view. Scroll
 *   speed never settles a card.
 * - Cards wait for the hero opening (gate released at 10 s at the latest); if it is still running at
 *   3.2 s (a slow photo), a waiting card on screen shows its cover instead (160 ms).
 * - Settling to the end state (160 ms) comes only from input on that card: a mouse or pen press on it,
 *   a key while focus is inside it, a real pointer move over it (hover), focus moving into it, a tap
 *   or a sideways drag on its slider or another control (a touch there that the browser takes for a
 *   scroll, pointercancel, is not intent); or the failsafe: a card on screen enough to draw that has
 *   waited FAILSAFE_MS (calm never came). A press, key or scroll elsewhere is not intent for a card.
 *   A hidden tab, pagehide and leaving the page finish the cards drawing or waiting on screen at
 *   once. Using the project filter or search ends the feature for this page (entering cards then just
 *   fade in, script.js FLIP). A drawing or a cover that fails to load keeps today's card.
 * - Leaving for another page finishes every card that is drawing or waiting on screen; after a
 *   back/forward-cache return, drawn cards never replay, and cards not yet drawn still draw.
 *   Back/Forward without that cache (navigation type back_forward) draws nothing.
 * - Text, layout and the cover element are never touched; overlays are absolutely positioned
 *   inside .card-media with pointer-events: none (no layout shift).
 * - Kill switches: ?draw=off (every drawing sequence) and ?cards=static (this one, and the
 *   filter motion). Reduced motion and forced colors (high contrast) keep today's cards, as does
 *   data saver, and a filter or search already in use when this file starts. There is no session
 *   memory: every plain load and reload draws again. ?cards=draw also draws on Back/Forward (review
 *   only). ansysCfd (a CFD plot) has no drawing and keeps today's cover.
 * - QA: window.__cardDraw = { enabled, reason, heroWait, calmLimit, cards: { key: { phase, why,
 *   plays, restarts, armed, pencilSeen, waitedCalm, ... } } }.
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
  const MASK_IMAGE = MASK_POS === "maskPosition" ? "maskImage" : "webkitMaskImage";
  const conn = navigator.connection;
  // Data saver only. The effective type is not a gate: it reads 3g on some fast links (a cold
  // start), which kept the drawings from visitors who would have seen them.
  if (conn && conn.saveData) { QA.reason = "save-data"; return; }
  // Every load and reload draws (no session memory). A Back/Forward load without the
  // back/forward cache draws nothing: the visitor returns to covers they have already seen.
  // (A bfcache restore never reaches this line; see the header.) ?cards=draw replays.
  const replay = /[?&]cards=draw(&|$)/.test(query);
  let navType = "";
  try { navType = (performance.getEntriesByType("navigation")[0] || {}).type || ""; } catch (e) { navType = ""; }
  if (!replay && navType === "back_forward") { QA.reason = "back-forward"; return; }

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

  const WIPE_MS = 600;                        // lines ink in
  const DEV_START = 450, DEV_MS = 600;        // cover develops 450-1050 ms
  const RETIRE_START = 600, RETIRE_MS = 550;  // lines retire 600-1150 ms
  const STAGGER = 70;                         // between cards starting together (reading order)
  const SETTLE_MS = 160;                      // intent -> end state (+ a frame: < 250 ms)
  const PLAY_RATIO = 0.25;                    // share of the cover on screen that is enough to read
  const PENCIL = 0.3;                         // the waiting drawing's strength (the wipe's unshown side)
  // Calm: no scroll event for IDLE_MS, or a scroll slower than calmLimit() px/s (about one screen a
  // second). Chosen from releases/cards-fast-scroll-20261109/impl/before: reading pace (450-600 px/s)
  // stays well under it, 1000 px/s and up on a 844-900 px window is over it.
  const CALM_MIN = 700, CALM_MAX = 1000, IDLE_MS = 150;
  const FAILSAFE_MS = 6000;                   // on screen enough to draw, still waiting: cover
  const GUARD = 0.15;                         // armed at once while > 15 % of a screen away...
  // ...nearer, in a frame callback (after that frame's scroll events, so the position is current),
  // only while at least ARM_PX plus ARM_LEAD ms of the scroll's travel off screen: a scroll the
  // compositor runs ahead of the main thread then reaches the card only after the paper is up.
  const ARM_PX = 24, ARM_LEAD = 50;
  const COVER_HOLD = 4000;                    // longest wait for the cover to decode
  const HERO_CEIL = 3200;                     // longest wait for the hero opening
  const HERO_FINAL = 10000;                   // gate released even if the hero never finishes
  const LOAD_CEIL = 4000;                     // line loading opens at window load, or by then
  const NEAR_MAX = 1000;                      // the zone whose covers load first: one screen, at most this (px)
  const LOAD_PARALLEL = 4;                    // line images in flight at once
  // Wipe geometry, from the CSS mask (white-home-20261011.css): a 100deg gradient, opaque to
  // 48.8 % and clear from 51.2 % (a soft edge about 6 % of the card wide), sized 250 % x 100 % of
  // the 640:427 box; mask-position x puts the mask image's left edge at (1 - 2.5) * x box widths.
  // Below, in box widths: on the middle row the edge's centre is at the image centre; on every
  // row (the 10deg tilt included) left of M_SHOWN is fully drawn, right of M_HIDDEN not at all.
  // This file sets the same gradient inline with PENCIL instead of clear on the unshown side, so
  // the drawing waits as pencil and the wipe inks it (same geometry, same mask-position values).
  const PENCIL_MASK = `linear-gradient(100deg, #000 48.8%, rgba(0, 0, 0, ${PENCIL}) 51.2%)`;
  const M_SIZE = 2.5, M_A = 0.488, M_B = 0.512, M_ANGLE = (100 * Math.PI) / 180, BOX_H = 427 / 640;
  const M_ALONG = (M_SIZE * Math.sin(M_ANGLE) + BOX_H * Math.abs(Math.cos(M_ANGLE))) / Math.sin(M_ANGLE);
  const M_TILT = (BOX_H / 2) * Math.abs(Math.cos(M_ANGLE) / Math.sin(M_ANGLE));
  const M_SHOWN = M_SIZE / 2 + (M_A - 0.5) * M_ALONG - M_TILT;
  const M_HIDDEN = M_SIZE / 2 + (M_B - 0.5) * M_ALONG + M_TILT;
  const M_MARGIN = 0.02;
  const posAt = (edge) => (100 * edge) / (M_SIZE - 1);   // mask-position x (%) for an image-left edge at -edge
  // The wipe's mask-position keyframes for the drawing [left, right] with its ink quantiles
  // [q10, q90]: fully pencil at 0, the edge's centre on the drawing's left extent at 10 %, on q10
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
    const rec = { key, card, media, cover, qa, phase: "", lines: null, veil: null, loading: false, decoded: false,
      inGuard: false, ratio: 0, startAt: 0, played: false, anims: [], run: 0, failTimer: 0 };
    recs.push(rec);
    byMedia.set(media, rec);
    byCard.set(card, rec);
    setPhase(rec, "idle");
  }
  if (!recs.length) { QA.reason = "nothing-to-draw"; return; }

  let enabled = true;
  let firstGuard = true;      // until the first guard pass has run (see guardIO)
  const calmLimit = () => Math.min(CALM_MAX, Math.max(CALM_MIN, window.innerHeight || CALM_MIN));
  QA.enabled = true;
  QA.initAt = Math.round(now());
  QA.calmLimit = calmLimit();

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
  const readable = (rec) => rec.ratio >= PLAY_RATIO - 1e-3;
  const coverFailed = (rec) => rec.cover.complete && !rec.cover.naturalWidth;

  // ---- loading the drawings (late, low priority, decoded before use) ----
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
  const wantsLoad = (rec) => !rec.loading && loadsOpen && rec.phase === "idle";
  const inFlight = () => recs.filter((rec) => rec.loading && !rec.decoded && !rec.qa.linesFailed).length;
  // px between the card and the viewport (0: on screen); filtered-out cards last.
  function distance(rec) {
    const r = rec.media.getBoundingClientRect();
    if (!r.width || !r.height) return Infinity;
    return Math.max(0, r.top - window.innerHeight, -r.bottom);
  }
  function pump() {
    // Not before the first guard pass: a card already on screen never requests its drawing.
    if (!enabled || firstGuard) return;
    const want = recs.filter(wantsLoad);
    if (!want.length) return;
    const wait = blockers();
    if (wait.length) {
      QA.pumpWaits = (QA.pumpWaits || 0) + 1;
      wait.forEach(wakeOn);
      return;
    }
    const free = LOAD_PARALLEL - inFlight();
    if (free <= 0) return;
    want.map((rec) => [distance(rec), rec]).sort((a, b) => a[0] - b[0]).slice(0, free).forEach(([, rec]) => load(rec));
  }
  function load(rec) {
    if (rec.loading || !enabled || rec.phase !== "idle") return;
    if (coverFailed(rec)) { skip(rec, "cover-failed"); return; }
    rec.loading = true;
    const img = document.createElement("img");
    img.className = "card-draw-lines";
    img.alt = "";
    img.setAttribute("aria-hidden", "true");
    img.decoding = "async";
    img.draggable = false;
    img.width = 1200;
    img.height = 800;
    img.style[MASK_IMAGE] = PENCIL_MASK;
    if ("fetchPriority" in img) img.fetchPriority = "low";
    img.sizes = rec.cover.getAttribute("sizes") || "100vw";
    const [h600, h1200] = LINES[rec.key];
    img.srcset = `${DIR}${rec.key}-600.webp?v=${h600} 600w, ${DIR}${rec.key}.webp?v=${h1200} 1200w`;
    rec.lines = img;
    rec.qa.requestedAt = Math.round(now());
    img.decode().then(guard(() => {
      rec.decoded = true;
      rec.qa.decodedAt = Math.round(now());
      tryPrime(rec);
      pump();
    }), guard(() => {
      rec.qa.linesFailed = true;
      if (rec.phase === "idle") skip(rec, "lines-failed");
      pump();
    }));
  }
  function openLoads() {
    if (loadsOpen || !enabled) return;
    loadsOpen = true;
    QA.loadsOpenAt = Math.round(now());
    pump();
  }

  // ---- arming: paper + pencil drawing, put up where nobody sees it go up ----
  function inGuardNow(rec) {
    const r = rec.media.getBoundingClientRect();
    if (!r.width || !r.height) return true;   // filtered out (display: none): never arm
    const m = window.innerHeight * GUARD;
    return r.bottom > -m && r.top < window.innerHeight + m;
  }
  function tryPrime(rec) {
    if (!enabled || rec.phase !== "idle" || !rec.decoded) return;
    if (coverFailed(rec)) { skip(rec, "cover-failed"); return; }
    if (!rec.inGuard && !inGuardNow(rec)) { arm(rec, "far"); return; }
    scheduleArm();
  }
  let armFrame = 0;
  function scheduleArm() {
    if (armFrame || !enabled || !recs.some((rec) => rec.phase === "idle" && rec.decoded)) return;
    armFrame = requestAnimationFrame(guard(armCheck));
  }
  // In a frame callback: this frame's scroll events have run, so the scroll position is current.
  function armCheck() {
    armFrame = 0;
    if (!enabled) return;
    const H = window.innerHeight;
    const moving = now() - lastScrollAt < IDLE_MS ? Math.max(0, speed) : 0;
    const margin = ARM_PX + (moving * ARM_LEAD) / 1000;
    let onScreen = false;
    for (const rec of recs) {
      if (rec.phase !== "idle" || !rec.decoded) continue;
      if (coverFailed(rec)) { skip(rec, "cover-failed"); continue; }
      const r = rec.media.getBoundingClientRect();
      if (!r.width || !r.height) continue;            // filtered out: never arm
      const off = Math.max(r.top - H, -r.bottom);     // px off screen; <= 0: (partly) on screen
      if (off >= margin) arm(rec, Math.round(off));
      else if (off <= 0 && !rec.cover.complete) { arm(rec, "empty"); onScreen = true; }
      else if (off <= 0) rec.qa.coverSeen = true;     // its cover is on screen: armed once it is off again
    }
    if (onScreen) flush();
  }
  function arm(rec, how) {
    veil(rec);
    rec.cover.after(rec.veil, rec.lines);
    setPhase(rec, "primed");
    rec.qa.armed = how;
    if (readable(rec)) waitFailsafe(rec);
  }
  function veil(rec) {
    if (rec.veil) return rec.veil;
    const el = document.createElement("div");
    el.className = "card-draw-veil";
    el.setAttribute("aria-hidden", "true");
    rec.veil = el;
    return el;
  }

  // ---- calm ----
  // Scroll speed over the last 40-150 ms of scroll events: the lower median of the speeds between
  // consecutive events (-1 while unknown). A real flick is fast on every event; one long main-thread
  // frame is not a flick (a scroll event handled late still reads the old position and the next one
  // the caught-up position, a single fast-looking step that an average over the window would count).
  const scrolls = [];
  let speed = -1, lastScrollAt = -Infinity;
  function scrollSpeed(t) {
    while (scrolls.length && t - scrolls[0][0] > 150) scrolls.shift();
    if (scrolls.length < 2 || scrolls[scrolls.length - 1][0] - scrolls[0][0] < 40) return -1;
    const steps = [];
    for (let i = 1; i < scrolls.length; i += 1) {
      const dt = scrolls[i][0] - scrolls[i - 1][0];
      if (dt >= 1) steps.push((Math.abs(scrolls[i][1] - scrolls[i - 1][1]) / dt) * 1000);
    }
    if (!steps.length) return -1;
    steps.sort((a, b) => a - b);
    return steps[(steps.length - 1) >> 1];
  }
  // Calm: no scroll event for IDLE_MS, or a known speed under the limit. A scroll that has just
  // begun (speed unknown) is not calm until it has a speed or stops.
  function calmNow(t = now()) {
    if (t - lastScrollAt >= IDLE_MS) return true;
    return speed >= 0 && speed <= calmLimit();
  }
  let calmTimer = 0;
  // Re-checked IDLE_MS after the last scroll event, in a frame callback (that frame's scroll events
  // have run): a scroll that is still going has moved lastScrollAt on, and waits again.
  function waitForCalm() {
    if (calmTimer || !enabled) return;
    calmTimer = setTimeout(guard(() => requestAnimationFrame(guard(() => {
      calmTimer = 0;
      scheduleArm();
      flush();
    }))), Math.max(0, IDLE_MS - (now() - lastScrollAt)) + 1);
  }

  // ---- playing ----
  let lastStart = -Infinity;
  function flush() {
    if (!enabled) return;
    if (heroWaiting) {
      // Past the ceiling the hero is still running (a slow photo): no card draws alongside it, and
      // none waits for it either; cards on screen show their covers.
      if (heroLate) for (const rec of recs) if (onScreenPrimed(rec)) settle(rec, "hero-late");
      return;
    }
    const ready = recs.filter((rec) => rec.phase === "primed" && readable(rec));
    if (!ready.length) return;
    const t = now();
    if (!calmNow(t)) {
      for (const rec of ready) rec.qa.waitedCalm = true;
      waitForCalm();
      return;
    }
    // Reading order: the grid's own order (left to right, row by row).
    for (const rec of ready) {
      const at = Math.max(t, lastStart + STAGGER);
      lastStart = at;
      play(rec, at - t);
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
    stopFailsafe(rec);
    if (coverFailed(rec)) { settle(rec, "cover-failed"); return; }
    if (!rec.lines.isConnected) rec.veil.after(rec.lines);
    rec.run += 1;
    const run = rec.run;
    setPhase(rec, "playing");
    rec.played = true;
    rec.qa.plays = (rec.qa.plays || 0) + 1;
    rec.startAt = now() + delay;
    rec.qa.delay = Math.round(delay);
    const [, , left, right, q10, q90] = LINES[rec.key];
    const frames = wipeFrames(left, right, q10, q90)
      .map(({ offset, x }) => ({ offset, [MASK_POS]: `${x.toFixed(2)}% 0%` }));
    rec.anims.push(rec.lines.animate(frames, { duration: WIPE_MS, delay, easing: "linear", fill: "both" }));
    coverReady(rec).then(guard(() => develop(rec, run)));
  }

  function develop(rec, run) {
    if (rec.phase !== "playing" || rec.run !== run) return;
    const elapsed = now() - rec.startAt;
    const devDelay = Math.max(0, DEV_START - elapsed);
    rec.qa.developAt = Math.round(now() + devDelay);
    const dev = rec.veil.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: DEV_MS, delay: devDelay, easing: EASE_DEV, fill: "both" });
    const retDelay = Math.max(RETIRE_START - elapsed, devDelay + (RETIRE_START - DEV_START));
    const ret = rec.lines.animate([{ opacity: 1 }, { opacity: 0 }],
      { duration: RETIRE_MS, delay: retDelay, easing: EASE_DEV, fill: "both" });
    rec.anims.push(dev, ret);
    Promise.all([dev.finished, ret.finished])
      .then(guard(() => { if (rec.phase === "playing" && rec.run === run) finish(rec, "complete"); }), () => {});
  }

  // Off screen before its drawing completed: back to waiting (pencil), unseen, to draw again from
  // the start the next time it is on screen and the scroll is calm.
  function rewind(rec) {
    cancelAnims(rec);
    rec.run += 1;
    setPhase(rec, "primed", "rewound");
    rec.qa.restarts = (rec.qa.restarts || 0) + 1;
  }

  // The failsafe: a card on screen enough to draw that is still waiting after FAILSAFE_MS (calm
  // never came) shows its cover.
  function waitFailsafe(rec) {
    if (rec.failTimer) return;
    rec.failTimer = setTimeout(guard(() => {
      rec.failTimer = 0;
      if (rec.phase === "primed" && readable(rec) && !heroWaiting) settle(rec, "failsafe");
    }), FAILSAFE_MS);
  }
  function stopFailsafe(rec) {
    clearTimeout(rec.failTimer);
    rec.failTimer = 0;
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
    stopFailsafe(rec);
    rec.run += 1;
    cancelAnims(rec);
    if (rec.veil) rec.veil.remove();
    if (rec.lines && rec.lines.isConnected) rec.lines.remove();
    setPhase(rec, rec.played ? "done" : "skipped", why);
    unobserve(rec);
  }
  function skip(rec, why) { finish(rec, why); }

  // Settle to the end state from wherever the sequence is, in `ms`.
  function settle(rec, why, ms = SETTLE_MS) {
    if (rec.phase === "primed" && rec.ratio === 0) { finish(rec, why); return; }
    if (rec.phase !== "playing" && rec.phase !== "primed") return;
    stopFailsafe(rec);
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
  function finishAll(why) {
    for (const rec of recs) if (active(rec) || onScreenPrimed(rec)) finish(rec, why);
  }
  function disable(why) {
    if (!enabled) return;
    enabled = false;
    QA.enabled = false;
    QA.reason = why;
    QA.disabledAt = Math.round(now());
    clearTimeout(calmTimer);
    cancelAnimationFrame(armFrame);
    for (const rec of recs) {
      if (rec.phase === "playing" || onScreenPrimed(rec)) settle(rec, why);
      else if (rec.phase !== "settling") finish(rec, why);
    }
    for (const io of observers) io.disconnect();
  }

  // ---- hero opening: no card draws alongside it ----
  // A hero still waiting for its tab's first visible (html[data-hero-pen=wait]) counts as running;
  // its ceilings start when it arms.
  const heroParked = () => root.getAttribute("data-hero-pen") === "wait";
  let heroWaiting = root.classList.contains("hero-draw") || heroParked();
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
    if (enabled) { scheduleArm(); flush(); }
  }
  // Still running at the ceiling: a waiting card on screen shows its cover now (flush), and the
  // gate stays closed until the hero really ends, so nothing draws alongside it.
  function heroRunsLate() {
    if (!heroWaiting) return;
    heroLate = true;
    QA.heroLateAt = Math.round(now());
    flush();
  }
  function heroClocks() {
    heroCeil = setTimeout(guard(heroRunsLate), HERO_CEIL);
    heroFinal = setTimeout(guard(() => heroDone("timeout")), HERO_FINAL);
  }
  if (heroWaiting) {
    let parked = heroParked();
    heroMO = new MutationObserver(guard(() => {
      if (parked && !heroParked()) { parked = false; heroClocks(); }
      if (!parked && !root.classList.contains("hero-draw")) heroDone("hero");
    }));
    heroMO.observe(root, { attributes: true, attributeFilter: ["class", "data-hero-pen"] });
    if (!parked) heroClocks();
  }

  // ---- observers ----
  // The loading zone; it watches every card (a cover still loading there holds the drawings back).
  const nearPx = Math.round(Math.min(window.innerHeight || NEAR_MAX, NEAR_MAX));
  const nearIO = new IntersectionObserver(guard((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) nearMedia.add(e.target);
      else nearMedia.delete(e.target);
    }
    pump();
  }), { rootMargin: `${nearPx}px 0px ${nearPx}px 0px` });

  // Real content on screen is never hidden for choreography: a card already on screen when this
  // file starts keeps its cover, untouched. A decoded card that leaves the 15 % band is armed at
  // once; one inside it waits for armCheck.
  const guardIO = new IntersectionObserver(guard((entries) => {
    for (const e of entries) {
      const rec = byMedia.get(e.target);
      if (!rec) continue;
      rec.inGuard = e.isIntersecting;
      if (rec.phase !== "idle") continue;
      const b = e.boundingClientRect;
      if (firstGuard && e.isIntersecting && b.width > 0 && b.bottom > 0 && b.top < window.innerHeight) {
        skip(rec, "on-screen-at-start");
        continue;
      }
      if (!rec.decoded) continue;
      if (!rec.inGuard && b.width > 0) arm(rec, "far");
      else scheduleArm();
    }
    if (firstGuard) { firstGuard = false; pump(); }
  }), { rootMargin: `${GUARD * 100}% 0px ${GUARD * 100}% 0px` });

  const viewIO = new IntersectionObserver(guard((entries) => {
    let idle = false;
    for (const e of entries) {
      const rec = byMedia.get(e.target);
      if (!rec) continue;
      rec.ratio = e.isIntersecting ? e.intersectionRatio : 0;
      if (rec.phase === "playing" && rec.ratio === 0) { rewind(rec); continue; }
      if (rec.phase === "idle") {
        if (rec.ratio > 0 && firstGuard) { skip(rec, "on-screen-at-start"); continue; }
        if (rec.decoded) idle = true;
        continue;
      }
      if (rec.phase !== "primed") continue;
      if (rec.ratio > 0) rec.qa.pencilSeen = true;
      if (readable(rec)) waitFailsafe(rec); else stopFailsafe(rec);
    }
    if (idle) scheduleArm();
    flush();
  }), { threshold: [0, 0.01, PLAY_RATIO] });   // 0.01: an edge-adjacent entry (ratio 0) still gets a callback once really on screen

  const observers = [guardIO, viewIO, nearIO];
  for (const rec of recs) { guardIO.observe(rec.media); viewIO.observe(rec.media); }
  for (const media of coverOf.keys()) nearIO.observe(media);

  if (document.readyState === "complete") setTimeout(guard(openLoads), 0);
  else window.addEventListener("load", () => setTimeout(guard(openLoads), 0), { once: true });
  setTimeout(guard(openLoads), LOAD_CEIL);

  // ---- scrolling and intent ----
  const on = (target, type, fn, opts) => target.addEventListener(type, guard(fn), opts);
  // Scrolling is how cards arrive, at any speed: it never settles a card. A waiting card on screen
  // draws once the scroll is calm (flush; waitForCalm catches the stop).
  on(window, "scroll", () => {
    const t = now();
    scrolls.push([t, window.scrollY]);
    speed = scrollSpeed(t);
    lastScrollAt = t;
    if (speed > (QA.maxScrollSpeed || 0)) QA.maxScrollSpeed = Math.round(speed);
    if (enabled && recs.some((rec) => rec.phase === "primed" && readable(rec))) flush();
  }, { passive: true });
  const recOf = (target) => {
    const card = target instanceof Element ? target.closest(".project-card") : null;
    return card ? byCard.get(card) : undefined;
  };
  const live = (rec) => rec && (rec.phase === "playing" || rec.phase === "primed");
  // A mouse or pen press on the card settles it. A touch never does on its own: a touch that
  // starts a scroll is how cards arrive, and the slider (touch-action: pan-y, exploded.css) lets a
  // vertical flick that starts on it scroll the page. A touch on the card's control is intent only
  // once the browser has not taken it for a scroll (pointercancel): a sideways drag on the slider,
  // or a release (a tap).
  let touch = null;   // { id, rec, x, y } for a touch that began on a live card's control
  const TOUCH_SLIDE = 10;   // px sideways (and more than vertical) that is a slider drag, not a pan
  on(window, "pointerdown", (e) => {
    if (!enabled) return;
    const rec = recOf(e.target);
    if (!live(rec)) return;
    if (e.pointerType !== "touch") { settle(rec, "pointerdown"); return; }
    if (e.target.closest("[data-explode-control], input, select, button, a:not(.card-open)")) {
      touch = { id: e.pointerId, rec, x: e.clientX, y: e.clientY };
    }
  }, { capture: true, passive: true });
  const touchIntent = (e) => {
    const rec = touch.rec;
    touch = null;
    if (enabled && live(rec)) settle(rec, "touch-control");
  };
  on(window, "pointermove", (e) => {
    if (!touch || e.pointerId !== touch.id) return;
    const dx = Math.abs(e.clientX - touch.x), dy = Math.abs(e.clientY - touch.y);
    if (dx >= TOUCH_SLIDE && dx > dy) touchIntent(e);
  }, { capture: true, passive: true });
  on(window, "pointerup", (e) => { if (touch && e.pointerId === touch.id) touchIntent(e); }, { capture: true, passive: true });
  on(window, "pointercancel", (e) => { if (touch && e.pointerId === touch.id) touch = null; }, { capture: true, passive: true });
  // A key with focus inside the card (keys that scroll the page from elsewhere are not intent).
  on(window, "keydown", (e) => {
    if (!enabled) return;
    const rec = recOf(e.target);
    if (live(rec)) settle(rec, "keydown");
  }, { capture: true, passive: true });
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
  on(window, "click", (e) => {
    if (e.target instanceof Element && e.target.closest(".filter-bar .filter")) disable("filter");
  }, { capture: true });
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
