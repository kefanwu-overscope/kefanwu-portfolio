// "Drawn, then built": a stage's first arrival, from the line layers registered
// on its cover (assets/detail-drawing-20261027, one layer per story step). Every
// project has them, on both detail pages; the 3D page's model and steering's
// case-study model wait behind the drawing and swap in when it ends. This file
// is not on the path to the stage or its cover: case-study.js holds the print,
// asks for it only when it will run, and hands over what is left of the print's
// on-screen budget.
//
// Held: the cover waits as an 18% grey print (inline, so the frame loader's
// poster rules cannot override it) while every layer decodes, in the smallest
// width that covers the stage. Pencil: the whole drawing at 35% over the same
// print (a grey copy of the cover under the paper; the cover itself is whole
// again beneath it). As soon as 15% of the stage is in view each story step inks
// to full (stroke ease); then the cover develops through the paper, its colour
// arriving as the grey copy fades with it (develop ease, opacity only), and once
// the paper is 70% gone the steps' lines retire in story order, so a dense hatch
// never lightens to paper before the hardware is under it. A one-step drawing
// inks top to bottom (two counter-moving transforms, compositor only). 1.95 s in
// all; the end state is the untouched cover. Story progress or a click, tap or
// key on the stage finish what remains within 250 ms; a hidden tab or reduced
// motion finishes it at once. The print never keeps the decoded cover dimmed on
// screen beyond its budget: a drawing not started by then gives the cover back
// ('late'), as does any error, and a cover that has not decoded when the model is
// ready, or within COVER_CAP of the page's start, never holds the stage: its print
// is given up ('cover late'). The settled drawing is hidden in one step and taken
// apart one node per idle slice. Below 768 px the same sequence runs on a shorter
// clock (1.6 s), since the model on a phone waits behind it.
//
// Every sheet has one Animation from pencil to retired: two animations of one
// property on one element never reach the compositor, and these must not stop when
// the main thread is busy with the model behind them. Sheets are decoded and resized
// in a worker: createImageBitmap on an <img> does both on the main thread (at 390
// with CPU x4, one task of 72-98 ms per sheet, traced 2026-11-04).
const FRAME_DRAWINGS = { steering: ['f2d5be168b', 6], vineRobot: ['8fd5ac9d15', 7], brakeSim: ['e8fa6f12c9', 1], scanner: ['48418729f7', 4], javelin: ['6036787324', 5],
  materialTest: ['82efd4a7cd', 5], aura: ['6c1e3e121c', 6], carbonSeat: ['122c1ef380', 1], seat: ['fa1519437f', 1], ansysCfd: ['2cf8fb66af', 2],
  pool: ['064fc7d99e', 5], lineFollower: ['8f886e0df1', 6], formlabs: ['c33039fed1', 4], telecaster: ['36fcebd99a', 5], education: ['f5cf9a51be', 6],
  ftc: ['068383db8a', 4] };

// The worker that decodes and resizes sheets. No request of its own: its source is
// here, and its bitmaps come back without a copy.
const PAINTER = `onmessage=async({data:{id,url,size,cache}})=>{try{const response=await fetch(url,cache?{cache}:{});if(!response.ok)throw new Error(response.status);const bitmap=await createImageBitmap(await response.blob(),size);postMessage({id,bitmap},[bitmap]);}catch(error){postMessage({id,error:String(error)});}};`;
function startPainter() {
  const none = { paint: () => Promise.reject(new Error('No worker')), close() {} };
  if (typeof Worker !== 'function' || typeof Blob !== 'function') return none;
  let worker, source;
  try {
    source = URL.createObjectURL(new Blob([PAINTER], { type: 'text/javascript' }));
    worker = new Worker(source);
  } catch { return none; }
  const waiting = new Map();
  let next = 0, broken = false;
  const fail = () => { broken = true; for (const { reject } of waiting.values()) reject(new Error('Worker failed')); waiting.clear(); };
  worker.onerror = fail;
  worker.onmessage = ({ data: { id, bitmap, error } }) => {
    const job = waiting.get(id);
    waiting.delete(id);
    if (bitmap) job?.resolve(bitmap); else job?.reject(new Error(error));
  };
  return {
    paint: (url, size, cache) => (broken ? none.paint() : new Promise((resolve, reject) => {
      waiting.set(++next, { resolve, reject });
      worker.postMessage({ id: next, url, size, cache });
    })),
    close() { worker.terminate(); URL.revokeObjectURL(source); },
  };
}

export function frameArrival({ key, host, media, poster, holdLeft: budget, reducedMotion }) {
  const [tag, steps] = FRAME_DRAWINGS[key];
  const PENCIL = .35, GHOST = .18, GREY = 'grayscale(1)', COLOUR = 'grayscale(0)', LINES_IN = 240, RUSH = 200, STAGED = .001, DRIFT = .0002;
  const [INK, SPREAD, DEVELOP, RETIRE, RETIRE_SPREAD] = innerWidth < 768 ? [380, 400, 520, 450, 80] : [420, 530, 600, 550, 114];
  const DEVELOP_AT = SPREAD + INK, RETIRE_AT = DEVELOP_AT + Math.round(DEVELOP * .56);
  const GIVE_BACK = 150, TRIGGER = .15, TAP_SLOP = 10, COVER_CAP = 3000;
  const STROKE = 'cubic-bezier(.45,0,.2,1)', DEVELOP_EASE = 'cubic-bezier(.65,0,.35,1)';
  const TOTAL = RETIRE_AT + RETIRE_SPREAD + RETIRE; // 1950 ms (1601 ms below 768 px): the last lines retire
  const slots = Array.from({ length: steps }, (unused, index) => steps > 1 ? index * SPREAD / (steps - 1) : 0);
  const sweep = steps === 1;
  const base = `assets/detail-drawing-20261027/${key}.${tag}/`;
  const events = new AbortController();
  const on = (node, type, listener) => node.addEventListener(type, listener, { signal: events.signal });
  let phase = 'held', reason = '', triggeredAt = null, coverAt = null, readyAt = null, startedAt = null, settledAt = null, rushed = false, layerWidth = null;
  let animations = [], clock = null;
  // The hold budget runs only while some of the stage is on screen with its
  // cover decoded: below the fold the print costs nothing.
  let onScreen = false, holdLeft = budget, holdFrom = null, holdTimer = 0;
  const drawing = document.createElement('div');
  drawing.className = 'case-drawing';
  drawing.setAttribute('aria-hidden', 'true');
  drawing.style.cssText = 'position:absolute;inset:0;z-index:3;pointer-events:none';
  // Once the layers are ready the 18% print moves onto white paper at 82%
  // over a grey copy of the cover (the cover itself is then left alone, at
  // full strength under it); the develop fades the copy out with the paper,
  // so the colour arrives through an opacity crossfade on the compositor
  // (the same pixels as a grayscale(1 -> 0) filter on the cover). Every sheet of
  // the drawing is a canvas holding a decoded bitmap: an <img> painting after the
  // fonts have settled the layout would read as a later, larger contentful paint
  // than the cover's own. Until the drawing starts each canvas waits at STAGED, which
  // no 8-bit pixel can show but which is not nothing: a canvas uploads in the first
  // commit that can draw it, so the sheets upload a few per frame as they arrive
  // rather than in one long commit when the drawing appears (about 100 ms at CPU x4).
  const print = document.createElement('canvas');
  print.style.cssText = `position:absolute;inset:0;width:100%;height:100%;filter:grayscale(1);opacity:${STAGED}`;
  const paper = document.createElement('div');
  paper.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0';
  const layer = (index) => {
    const sheet = document.createElement('canvas');
    sheet.dataset.step = String(index);
    // Framing (object-fit, portrait magnification) follows the cover: project-motion-story.css.
    sheet.style.cssText = `position:absolute;inset:0;width:100%;height:100%;opacity:${STAGED}`;
    return sheet;
  };
  const layers = slots.map((unused, index) => layer(index));
  // A one-step drawing inks top to bottom: a full-ink copy is uncovered by a
  // frame sliding down while its track slides up by the same amount.
  let wipe = null, wipeFrame = null, wipeTrack = null;
  if (sweep) {
    wipe = layer(0);
    wipe.style.opacity = '1';
    wipeTrack = document.createElement('div');
    wipeTrack.style.cssText = 'position:absolute;inset:0;transform:translateY(100%)';
    wipeFrame = document.createElement('div');
    wipeFrame.style.cssText = 'position:absolute;inset:0;overflow:hidden;transform:translateY(-100%)';
    wipeTrack.append(wipe);
    wipeFrame.append(wipeTrack);
  }
  const images = wipe ? [...layers, wipe] : layers;
  drawing.append(print, paper, ...layers, ...(wipeFrame ? [wipeFrame] : []));
  media.append(drawing);
  const alive = () => phase !== 'off' && phase !== 'settled';
  const painter = startPainter();
  let coverTimer = 0, showFrame = 0;
  const shown = [];

  // One sheet's whole sequence: it waits at pencil for its slot, inks to full (stroke
  // ease), holds while the cover develops, and retires in story order once the cover
  // is 70% developed (develop ease). A one-step drawing's sheet finishes its fade to
  // pencil under its full-ink copy (which inks by its reveal), reaches full strength
  // behind it and retires with it.
  function sheetFrames(index, fadedMs = LINES_IN) {
    const at = (ms) => Math.min(1, ms / TOTAL);
    if (sweep) {
      const faded = Math.min(1, fadedMs / LINES_IN);
      return [{ offset: 0, opacity: PENCIL * faded, easing: 'linear' }, ...(faded < 1 ? [{ offset: at(LINES_IN - fadedMs), opacity: PENCIL, easing: 'linear' }] : []),
        { offset: at(RETIRE_AT - 40), opacity: PENCIL, easing: 'linear' },
        { offset: at(RETIRE_AT), opacity: 1, easing: DEVELOP_EASE }, { offset: 1, opacity: 0 }];
    }
    const slot = slots[index], retireAt = RETIRE_AT + RETIRE_SPREAD * slot / SPREAD;
    return [...(slot > 0 ? [{ offset: 0, opacity: PENCIL, easing: 'linear' }] : []),
      { offset: at(slot), opacity: PENCIL, easing: STROKE }, { offset: at(slot + INK), opacity: 1, easing: 'linear' },
      { offset: at(retireAt), opacity: 1, easing: DEVELOP_EASE }, { offset: at(retireAt + RETIRE), opacity: 0, easing: 'linear' },
      ...(retireAt + RETIRE < TOTAL ? [{ offset: 1, opacity: 0 }] : [])];
  }

  function stop() {
    events.abort();
    visibility.disconnect();
    clearTimeout(holdTimer); holdTimer = 0; holdFrom = null;
    clearTimeout(coverTimer);
    painter.close();
    delete media.dataset.arrivalLayers;
  }
  // Retired: hidden in one step (its last frame was already the plain
  // cover), then taken apart one node per idle slice.
  function retire() {
    drawing.style.opacity = '0';
    for (const animation of animations) animation.cancel();
    animations = [];
    poster.style.removeProperty('opacity');
    poster.style.removeProperty('filter');
    requestAnimationFrame(() => poster.style.removeProperty('transition'));
    // A live model waiting behind the drawing (the same pose as the cover) swaps
    // in now the drawing is out of sight, in a commit of its own rather than the
    // one that ends the arrival, and not behind the idle slices below.
    requestAnimationFrame(() => setTimeout(() => host.dispatchEvent(new CustomEvent('case-arrival-end'))));
    const queue = [...images, wipeTrack, wipeFrame, print, paper, drawing].filter(Boolean);
    const idle = typeof requestIdleCallback === 'function' ? (task) => requestIdleCallback(task, { timeout: 500 }) : (task) => setTimeout(task, 16);
    const next = () => {
      queue.shift()?.remove();
      if (queue.length) idle(next);
    };
    idle(next);
  }
  // Settled: the drawing is gone and the cover is today's, in one frame.
  function finish() {
    if (!alive()) return;
    settledAt = performance.now();
    phase = 'settled';
    stop();
    delete media.dataset.arrival;
    retire();
  }
  function giveBack(why, ms = GIVE_BACK) {
    if (!alive()) return;
    reason = why;
    const held = phase === 'held';
    phase = 'off';
    stop();
    const end = () => { delete media.dataset.arrival; retire(); };
    if (!ms || reducedMotion?.matches) { end(); return; }
    if (held) {
      // The cover is still its print: bring it back to full strength.
      const from = Number(getComputedStyle(poster).opacity);
      end();
      if (from < 1) poster.animate([{ opacity: from, filter: GREY }, { opacity: 1, filter: COLOUR }], { duration: ms, easing: 'ease-out' });
      return;
    }
    // The drawing is over the cover: lift it off as it stands.
    for (const animation of animations) animation.pause();
    const options = { duration: ms, easing: 'ease-out', fill: 'forwards' };
    const lift = drawing.animate([{ opacity: getComputedStyle(drawing).opacity }, { opacity: 0 }], options);
    animations.push(lift);
    lift.finished.then(end, end);
  }
  function compress() {
    const remaining = Math.max(0, TOTAL - (Number(clock?.currentTime) || 0));
    const rate = Math.max(1, remaining / RUSH);
    for (const animation of animations) animation.updatePlaybackRate(rate);
  }
  function start() {
    if (phase !== 'pencil') return;
    phase = 'drawing';
    startedAt = performance.now();
    holdClock();
    // The sheets' fade to pencil ends here: each takes its one animation of the
    // whole sequence.
    const fadedMs = Number(animations[0]?.currentTime) || 0;
    for (const animation of animations) animation.cancel();
    animations = [];
    layers.forEach((image, index) => { animations.push(image.animate(sheetFrames(index, fadedMs), { duration: TOTAL, fill: 'both' })); });
    if (wipe) {
      const reveal = { duration: DEVELOP_AT, easing: STROKE, fill: 'both' };
      animations.push(wipeFrame.animate([{ transform: 'translateY(-100%)' }, { transform: 'translateY(0)' }], reveal));
      animations.push(wipeTrack.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], reveal));
      animations.push(wipe.animate([{ opacity: 1 }, { opacity: 0 }], { duration: RETIRE + RETIRE_SPREAD, delay: RETIRE_AT, easing: DEVELOP_EASE, fill: 'forwards' }));
    }
    // The cover develops through the paper with its colour. The paper moves through
    // the whole sequence, before and after the develop by amounts no 8-bit pixel can
    // show: Chrome's tab capture (the CDP screencast too) locks onto the region an
    // animation damages and drops 250 ms of frames when it changes, and the paper is
    // the whole stage where the sheets are only their contain fit.
    animations.push(paper.animate([{ offset: 0, opacity: 1 - GHOST + DRIFT, easing: 'linear' }, { offset: DEVELOP_AT / TOTAL, opacity: 1 - GHOST, easing: DEVELOP_EASE },
      { offset: (DEVELOP_AT + DEVELOP) / TOTAL, opacity: DRIFT, easing: 'linear' }, { offset: 1, opacity: 0 }], { duration: TOTAL, fill: 'both' }));
    animations.push(print.animate([{ opacity: 1 }, { opacity: 0 }], { duration: DEVELOP, delay: DEVELOP_AT, easing: DEVELOP_EASE, fill: 'both' }));
    // The clock spans the whole sequence; it never changes a pixel.
    clock = drawing.animate([{ opacity: 1 }, { opacity: 1 }], { duration: TOTAL, fill: 'forwards' });
    animations.push(clock);
    clock.finished.then(finish, () => {});
    if (rushed) compress();
  }
  function trigger() {
    if (triggeredAt !== null || !alive()) return;
    triggeredAt = performance.now();
    if (phase === 'pencil') start();
  }
  // Scrolling the page toward the stage is not an interruption. Before the
  // drawing exists, an interruption gives today's cover back at once.
  function rush() {
    if (rushed || !alive()) return;
    if (phase === 'held') { giveBack('interrupted'); return; }
    rushed = true;
    if (phase === 'drawing') compress(); else trigger();
  }
  function holdClock() {
    const now = performance.now();
    if (holdFrom !== null) { holdLeft -= now - holdFrom; holdFrom = null; }
    clearTimeout(holdTimer); holdTimer = 0;
    if ((phase !== 'held' && phase !== 'pencil') || coverAt === null || !onScreen || document.hidden) return;
    holdFrom = now;
    holdTimer = setTimeout(() => { holdTimer = 0; holdFrom = null; holdLeft = 0; giveBack('late'); }, Math.max(0, holdLeft));
  }

  // The drawn frame's width in device pixels (contain fit, portrait magnification
  // included); the smallest published width that covers it.
  function frameWidth() {
    const box = media.getBoundingClientRect();
    // Portrait screens may magnify the frame up to 1.5x (project-motion-story.js portraitFit).
    const magnified = innerWidth / innerHeight <= .8 ? 1.5 : 1;
    return Math.min(box.width, box.height * 1.5) * magnified * (window.devicePixelRatio || 1);
  }
  const chooseWidth = () => frameWidth() <= 990 ? 900 : 1800;
  // Decoded and resized at the stage's own resolution: in the worker, or here if
  // the worker cannot.
  async function fill(sheet, url, aspect, cache) {
    // Covers and layers are 3:2: an even height keeps that exact, so the contain fit lands on the cover's.
    const resizeHeight = Math.max(2, 2 * Math.ceil(Math.min(1800, frameWidth()) / aspect / 2));
    const size = { resizeWidth: Math.round(resizeHeight * aspect), resizeHeight, resizeQuality: 'high' };
    const bitmap = await painter.paint(url, size, cache).catch(async () => {
      const source = new Image();
      source.decoding = 'async';
      source.fetchPriority = 'high';
      source.src = url;
      await source.decode();
      return createImageBitmap(source, size);
    });
    return new Promise((resolve) => {
      shown.push([sheet, bitmap, resolve]);
      showFrame ||= requestAnimationFrame(showSheets);
    });
  }
  // Two per frame: each uploads in the commit after it is set (see STAGED).
  function showSheets() {
    showFrame = 0;
    for (const [sheet, bitmap, resolve] of shown.splice(0, 2)) {
      if (alive()) {
        // The canvas keeps its own intrinsic size, which sets its contain fit.
        sheet.width = bitmap.width;
        sheet.height = bitmap.height;
        sheet.getContext('bitmaprenderer').transferFromImageBitmap(bitmap);
      } else bitmap.close();
      resolve();
    }
    if (shown.length) showFrame = requestAnimationFrame(showSheets);
  }
  function requestLayers() {
    if (layerWidth !== null || !alive()) return null;
    layerWidth = chooseWidth();
    return Promise.all(images.map((sheet) => {
      const url = new URL(`${base}${sheet.dataset.step}-${layerWidth}.webp`, document.baseURI).href;
      delete sheet.dataset.step;
      return fill(sheet, url, 3 / 2);
    })).then(() => {
      // The model that waits behind the drawing may start, with or without a cover.
      if (alive()) media.dataset.arrivalLayers = 'in';
    });
  }
  const coverLoaded = poster.complete ? Promise.resolve() : new Promise((resolve) => {
    poster.addEventListener('load', resolve, { once: true });
    poster.addEventListener('error', resolve, { once: true });
  });
  // The small line layers (14-23 KB) are requested after layout, ahead of the model
  // that waits behind them. The cover has been on its way since the page's head; a
  // connection too slow to carry both never gets here (case-study.js STAGE_LATE).
  const layersRequested = new Promise((resolve) => requestAnimationFrame(() => resolve(requestLayers())));
  coverLoaded.then(() => { if (alive()) { coverAt = performance.now(); holdClock(); } });
  // The grey copy is the cover's own selected image, from the HTTP cache.
  const printReady = coverLoaded.then(() => {
    if (!alive()) return null;
    if (!poster.naturalWidth) throw new Error('The cover did not load.');
    return fill(print, poster.currentSrc, poster.naturalWidth / poster.naturalHeight, 'force-cache');
  });
  Promise.all([coverLoaded, layersRequested, printReady]).then(() => {
    if (phase !== 'held') return;
    painter.close();
    readyAt = performance.now();
    phase = 'pencil';
    // One frame: the print moves from the cover to the grey copy under the
    // paper, the cover returns to itself, lines start.
    media.dataset.arrival = 'drawn';
    poster.style.removeProperty('opacity');
    poster.style.removeProperty('filter');
    print.style.opacity = '1';
    paper.style.opacity = String(1 - GHOST);
    for (const image of layers) animations.push(image.animate([{ opacity: 0 }, { opacity: PENCIL }], { duration: LINES_IN, easing: 'linear', fill: 'forwards' }));
    if (triggeredAt !== null) start(); else holdClock();
  }, () => giveBack('drawing unavailable'));

  const visibility = new IntersectionObserver((entries) => {
    // The last entry of a batch is the stage's state now.
    const entry = entries[entries.length - 1];
    const ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
    onScreen = ratio > 0;
    if (ratio >= TRIGGER - .001) trigger();
    holdClock();
  }, { threshold: [0, TRIGGER] });
  visibility.observe(media);
  // A cover that has not decoded never holds the stage: the model, when it is
  // ready, or the wall clock takes the print back, with nothing on screen to fade.
  on(host, 'case-model-ready', () => { if (phase === 'held') { if (coverAt === null) giveBack('cover late', 0); else giveBack('late'); } });
  coverTimer = setTimeout(() => { if (coverAt === null) giveBack('cover late', 0); }, Math.max(0, COVER_CAP - performance.now()));
  on(host, 'case-motion-request', (event) => { if (Number(event.detail?.progress) > .01) rush(); });
  // Exploring freely wants the model that waits behind the drawing.
  on(host, 'case-motion-mode', (event) => { if (event.detail?.free) rush(); });
  // A mouse press counts at once; a touch or pen contact only as a tap.
  let tap = null;
  on(media, 'pointerdown', (event) => {
    if (!event.pointerType || event.pointerType === 'mouse') { rush(); return; }
    tap = event.isPrimary ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null;
  });
  on(media, 'pointermove', (event) => { if (tap?.id === event.pointerId && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_SLOP) tap = null; });
  on(media, 'pointercancel', () => { tap = null; });
  on(media, 'pointerup', (event) => {
    if (tap?.id !== event.pointerId) return;
    const moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_SLOP;
    tap = null;
    if (!moved) rush();
  });
  on(host, 'keydown', rush);
  // A hidden tab or reduced motion ends the arrival now, without motion.
  on(document, 'visibilitychange', () => { if (!document.hidden) { holdClock(); return; } if (phase === 'drawing') finish(); else giveBack('interrupted', 0); });
  if (reducedMotion?.addEventListener) on(reducedMotion, 'change', () => { if (!reducedMotion.matches) return; if (phase === 'drawing') finish(); else giveBack('reduced motion', 0); });
  // A card morph is this page's arrival (page-transitions-20261027.js): the held print gives the cover back.
  on(window, 'kw-vt-morph', () => { if (phase === 'held') giveBack('morph'); else rush(); });
  // QA handle.
  window.__caseArrival = { getState: () => ({ key, mode: 'frames', phase, reason, steps, slots: [...slots], sweep, layerWidth, triggeredAt, coverAt, readyAt, startedAt, settledAt, rushed,
    holdLeft: Math.round(holdFrom === null ? holdLeft : holdLeft - (performance.now() - holdFrom)),
    ms: phase === 'settled' ? TOTAL : clock ? Number(clock.currentTime) || 0 : 0, durationMs: TOTAL }) };
}
