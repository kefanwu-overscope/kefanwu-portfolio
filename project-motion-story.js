import { layoutAnnotation, maskRegions } from './project-annotation-layout.js?v=dtb-20261027';
import { renderPressureLegend } from './project-pressure-legend.js';
import { projectMotionLabels } from './project-motion-labels.js?v=dtb-20261027';
import { projectMotionNotes } from './project-motion-notes.js?v=seat-truth-20261022';

// Drawn callouts (2026-10-28): per-phase hardware occupancy of the published
// detail frames (assets/detail-callouts-20261028/provenance.json), by content tag.
const OCCUPANCY = { steering: '2685ec27b1', vineRobot: 'e04fa96249', javelin: 'd7952fe832', brakeSim: '9b6b82c455', aura: '79ac4f779d',
  scanner: 'fa6aace024', seat: '0e1b157fc6', materialTest: '83a08788e4', ansysCfd: 'a96c9743f2', pool: '1986d008d3', lineFollower: '1e62cf803e',
  formlabs: '87d1485484', education: '9dcda4fbaf', ftc: '5f999702c3', telecaster: 'a2128bc07e', carbonSeat: 'd8b74d7d1a' };
// A leader draws from its note to its part on the stroke ease and its dot lands;
// one leaving its stage retracts into the note's side. 210 ms in all, so any
// further input meets a settled callout within 250 ms.
// The published frame anchors with every point re-baked for the corrected label
// targets (project-motion-labels.js); ?callouts=classic keeps today's file.
const DRAWN_ANCHORS = 'assets/detail-callouts-20261028/anchors.36cd6c30cd.json';
const STROKE = 'cubic-bezier(.45,0,.2,1)', DRAW_MS = 200, DOT_DELAY = 130, DOT_MS = 80, RETRACT_MS = 120, ARRIVAL_WAIT_MS = 7000, TRACK_BELOW = .25;
const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
// Timers are optional so the story also runs in hosts without them (tests).
const later = (callback, ms) => typeof setTimeout === 'function' ? setTimeout(callback, ms) : 0;
const stopTimer = id => { if (id && typeof clearTimeout === 'function') clearTimeout(id); };
export function progressFromScroll(scroll, start, distance) { return clamp((scroll - start) / Math.max(1, distance)); }
export function noteAt(steps, progress) {
  let index = 0;
  for (let i = 1; i < steps.length; i++) if (progress + .00001 >= steps[i].at) index = i;
  return index;
}
// About half a viewport of scroll per annotated stage, bounded for short phones
// and tall desktops, so a four-stage story is not as long as a seven-stage one.
export function storyTravel(stages, width, height) {
  return Math.round(Math.max(1, stages) * Math.max(380, Math.min(560, height * (width <= 700 ? .5 : .55))));
}
// Whole-timeline footprint from the baked per-phase occupancy masks (32 x 24
// cells over the landscape source frame), so one magnification suits every pose.
export function maskFootprint(masks, columns = 32, rows = 24) {
  let x0 = columns, x1 = -1, y0 = rows, y1 = -1;
  for (const mask of masks || []) mask.forEach((bits, row) => {
    for (let col = 0; bits && col < columns; col++) if ((bits >>> col) & 1) {
      x0 = Math.min(x0, col); x1 = Math.max(x1, col); y0 = Math.min(y0, row); y1 = Math.max(y1, row);
    }
  });
  return x1 < 0 ? null : { x0: x0 / columns, x1: (x1 + 1) / columns, y0: y0 / rows, y1: (y1 + 1) / rows };
}
// Portrait stages enlarge that footprint to most of their width. The result maps
// a point p of the contained frame (stage pixels) to offset + scale * p. The
// scale is capped where the 1280px detail frames would visibly soften, and
// leaves `reserve` pixels above the footprint whenever centring cannot, so a
// note still fits beside the enlarged model on short stages.
export function portraitFit({ footprint, width, height, aspect = 1.5, pixelRatio = 1, fill = .87, maxScale = 1.5, sourcePixels = 1280, maxUpsample = 1.4, reserve = 0 }) {
  if (!footprint || !(width > 0) || !(height > 0)) return null;
  const frameHeight = Math.min(width / aspect, height), frameWidth = frameHeight * aspect;
  const left = (width - frameWidth) / 2, top = (height - frameHeight) / 2;
  const boxWidth = (footprint.x1 - footprint.x0) * frameWidth, boxHeight = (footprint.y1 - footprint.y0) * frameHeight;
  const scale = Math.min(maxScale, sourcePixels * maxUpsample / (frameWidth * pixelRatio), fill * width / boxWidth, (height - Math.max(24, reserve)) / boxHeight);
  if (!(scale > 1.02)) return null;
  const free = height - scale * boxHeight, boxTop = free / 2 >= reserve ? free / 2 : Math.min(reserve, free);
  const centerX = left + (footprint.x0 + footprint.x1) / 2 * frameWidth, centerY = top + (footprint.y0 + footprint.y1) / 2 * frameHeight;
  const round = value => Math.round(value * 100) / 100;
  return { scale: Math.round(scale * 1e4) / 1e4, x: round(width / 2 - scale * centerX), y: round(boxTop + scale * boxHeight / 2 - scale * centerY) };
}
// Phones keep only the project name in the story heading. The slash and mode
// label share one wrapper so the stylesheet can drop them without parsing text.
function wrapHeadingMode(eyebrow) {
  const slash = eyebrow?.querySelector?.('span[aria-hidden]');
  if (!slash || slash.closest('.motion-heading-mode')) return;
  const mode = document.createElement('span'); mode.className = 'motion-heading-mode';
  slash.before(mode);
  while (mode.nextSibling) mode.append(mode.nextSibling);
}

export function attachMotionStory(story) {
  const baseNotes = projectMotionNotes[story.dataset.motionProject];
  const labels = projectMotionLabels[story.dataset.motionProject];
  const notes = baseNotes && { ...baseNotes, steps: baseNotes.steps.map((step, index) => ({ ...step, ...labels?.[index] })) };
  const host = story.querySelector('.case-animation-host');
  if (!notes || !host || story.dataset.storyMounted) return null;
  story.dataset.storyMounted = 'true';
  const pin = story.querySelector('.case-motion-pin'), media = host.querySelector('.card-media');
  const title = story.querySelector('#preview-title'), body = story.querySelector('.motion-note-body');
  const count = story.querySelector('.motion-step-count'), note = story.querySelector('.motion-evidence-note');
  const buttons = story.querySelector('.motion-step-buttons'), range = story.querySelector('#motion-story-progress');
  const output = story.querySelector('.motion-story-timeline output'), mode = story.querySelector('.motion-explore');
  const instructions = story.querySelector('#preview-instructions');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const listen = (target, type, fn, options = {}) => target.addEventListener(type, fn, { ...options, signal: events.signal });
  let raf = 0, previousTime = 0, target = 0, eased = 0, shown = 0, start = 0, travel = 1;
  let inView = false, intersecting = false, disposed = false, suspended = false, lightbox = false, free = false, pinned = true, activeNote = -1;
  let pendingMeasure = false, sent = -1, annotationRequested = false, noteAnimation = null;
  const annotation = story.querySelector('.motion-notes');
  const leader = story.querySelector('.motion-leader-line');
  const endpoint = story.querySelector('.motion-leader-target');
  const halo = story.querySelector('.motion-leader-halo'), leaderGroup = story.querySelector('.motion-leader-live');
  let lastAnchor = null, frameAnchors = null, placement = null, placementSize = '', entrancePending = false;
  let occupancyKey = '', occupied = [], footprint = null, fit = null, labelFitKey = '';
  let lineAnimation = null, dotAnimation = null, haloAnimation = null, freeEvents = null;
  // ?callouts=classic restores the previous leader rendering and placement;
  // ?draw=off (and reduced motion) keep drawn callouts but show them at once.
  const query = typeof location === 'object' && location && typeof URLSearchParams === 'function' ? new URLSearchParams(location.search) : null;
  const drawn = query?.get('callouts') !== 'classic', drawOff = query?.get('draw') === 'off';
  story.dataset.callouts = drawn ? 'drawn' : 'classic';
  let fine = null, pendingFine = null, leaderState = 'off', ghost = null, ghostTimer = 0, arrivalWatch = null, arrivalTimer = 0, waitExpired = false, layoutInput = null;
  wrapHeadingMode(story.querySelector('.motion-story-heading .eyebrow'));
  // Portrait screens (at most 4:5) magnify the whole-timeline footprint. Frames
  // and the live poster take a CSS transform; the live canvas receives the same
  // transform as a camera crop, so the source pose and camera never change.
  function updateFit() {
    const surface = media.getBoundingClientRect();
    fit = !free && innerWidth / innerHeight <= .8 ? portraitFit({ footprint, width: surface.width, height: surface.height,
      aspect: frameAnchors?.aspect, pixelRatio: window.devicePixelRatio || 1, reserve: 170 }) : null;
    story.dataset.portraitFit = String(!!fit);
    if (fit) story.style.setProperty('--motion-fit', `translate(${fit.x}px,${fit.y}px) scale(${fit.scale})`);
    const canvas = host.querySelector('#case-3d-canvas');
    const crop = fit ? `${fit.scale} ${(fit.x / surface.width).toFixed(5)} ${(fit.y / surface.height).toFixed(5)}` : '';
    if (canvas && (canvas.dataset.viewCrop || '') !== crop) {
      if (crop) canvas.dataset.viewCrop = crop; else delete canvas.dataset.viewCrop;
      canvas.dispatchEvent(new CustomEvent('studio-view-crop'));
    }
  }
  function dropGhost() {
    stopTimer(ghostTimer); ghostTimer = 0;
    ghost?.remove?.(); ghost = null;
  }
  // Settles every entrance at its end state; a retracting leader is dropped
  // unless the caller is the next stage's own reveal.
  function cancelEntrance(keepGhost = false) {
    noteAnimation?.cancel(); lineAnimation?.cancel(); dotAnimation?.cancel(); haloAnimation?.cancel();
    noteAnimation = lineAnimation = dotAnimation = haloAnimation = null;
    if (!keepGhost) dropGhost();
    story.dataset.labelPending = 'false';
  }
  // Drawn callouts: the note is readable at once; its leader and dot are the
  // only things drawn. A leader waits for a still-running arrival (the stage's
  // data-arrival mark) so it never lands on a model that is still inking.
  const drawing = () => drawn && !drawOff && !reduced.matches && active() && !free;
  const arrivalRunning = () => !!media?.dataset?.arrival;
  function setLeader(state) { leaderState = state; story.dataset.leader = state; }
  function stopArrivalWait() { arrivalWatch?.disconnect(); arrivalWatch = null; stopTimer(arrivalTimer); arrivalTimer = 0; }
  function drawLeader() {
    lineAnimation?.cancel(); haloAnimation?.cancel(); dotAnimation?.cancel();
    const frames = [{ strokeDasharray: '1 2', strokeDashoffset: 1 }, { strokeDasharray: '1 2', strokeDashoffset: 0 }];
    lineAnimation = leader?.animate?.(frames, { duration: DRAW_MS, easing: STROKE }) || null;
    haloAnimation = halo?.animate?.(frames, { duration: DRAW_MS, easing: STROKE }) || null;
    dotAnimation = endpoint?.animate?.([{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: DOT_MS, delay: DOT_DELAY, fill: 'backwards', easing: 'ease-out' }) || null;
  }
  // The leader leaving its stage retracts from the part into the note's side.
  // A retract that would cross the next leader is skipped, not drawn over it.
  function retractLeader() {
    dropGhost();
    const drawingNow = lineAnimation && lineAnimation.playState === 'running';
    // Without Web Animations the leader simply leaves with its stage.
    if (!drawing() || drawingNow || !leaderGroup?.cloneNode || !placement?.elbow || typeof leader?.animate !== 'function') return;
    ghost = leaderGroup.cloneNode(true);
    ghost.setAttribute('class', 'motion-leader-ghost');
    ghost.geometry = [placement.start, placement.elbow, placement.tip];
    leaderGroup.after(ghost);
    const frames = [{ strokeDasharray: '1 2', strokeDashoffset: 0 }, { strokeDasharray: '1 2', strokeDashoffset: 1 }];
    ghost.querySelectorAll('path').forEach(path => path.animate?.(frames, { duration: RETRACT_MS, easing: STROKE, fill: 'forwards' }));
    ghost.querySelector('circle')?.animate?.([{ opacity: 1 }, { opacity: 0 }], { duration: RETRACT_MS / 2, easing: 'ease-in', fill: 'forwards' });
    ghostTimer = later(dropGhost, RETRACT_MS + 40);
  }
  const crosses = (a, b, c, d) => {
    const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0;
  };
  function syncLeader() {
    if (!drawn) return;
    const want = story.dataset.notesVisible === 'true' && story.dataset.anchorVisible === 'true' && story.dataset.labelPending !== 'true' && !free && !!placement;
    if (!want) { stopArrivalWait(); if (leaderState !== 'off') setLeader('off'); return; }
    if (ghost?.geometry && placement.elbow) {
      const [a, b, c] = ghost.geometry, next = [placement.start, placement.elbow, placement.tip];
      if ([[a, b], [b, c]].some(([p, q]) => crosses(p, q, next[0], next[1]) || crosses(p, q, next[1], next[2]))) dropGhost();
    }
    if (leaderState === 'in') return;
    // The gate holds whether or not the stage is on screen yet, so a leader
    // placed before the stage scrolls in cannot sit over the model as it inks.
    if (drawOff || reduced.matches || !arrivalRunning() || waitExpired) {
      stopArrivalWait(); setLeader('in'); if (drawing()) drawLeader(); return;
    }
    if (leaderState === 'wait') return;
    setLeader('wait');
    if (typeof MutationObserver === 'function') {
      arrivalWatch = new MutationObserver(() => { if (leaderState === 'wait' && !arrivalRunning()) syncLeader(); });
      arrivalWatch.observe(media, { attributes: true, attributeFilter: ['data-arrival'] });
    }
    // A mark that never clears still gives the leader its place.
    arrivalTimer = later(() => { arrivalTimer = 0; waitExpired = true; if (leaderState === 'wait') syncLeader(); }, ARRIVAL_WAIT_MS);
  }
  // The right edge of the note's words (step count, title, body) plus its padding.
  function inkWidth() {
    if (typeof document?.createRange !== 'function' || !annotation?.getBoundingClientRect) return 0;
    const box = annotation.getBoundingClientRect(), range = document.createRange();
    let right = 0;
    for (const node of [count, title, body]) {
      if (!node?.firstChild) continue;
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) right = Math.max(right, rect.right);
    }
    const padding = Number.parseFloat(typeof getComputedStyle === 'function' ? getComputedStyle(annotation).paddingRight : '') || 12;
    return right > box.left ? Math.ceil(right - box.left + padding) : 0;
  }
  // A suspended story (hidden tab, open image viewer, off screen, page hidden)
  // stops waiting for the arrival; it is weighed afresh when the story resumes.
  function suspendLeader() { if (leaderState === 'wait') { stopArrivalWait(); setLeader('off'); } }
  function revealAnnotation() {
    if (!entrancePending || story.dataset.anchorVisible !== 'true') return;
    entrancePending = false; cancelEntrance(drawn);
    if (drawn) return;
    if (reduced.matches || !active() || free || story.dataset.notesVisible !== 'true') return;
    dotAnimation = endpoint?.animate?.([{ opacity:0, transform:'scale(.55)' },{ opacity:1, transform:'scale(1)' }], { duration:210,easing:'ease-out' });
    lineAnimation = leader.animate?.([{ strokeDasharray:'1',strokeDashoffset:-1 },{ strokeDasharray:'1',strokeDashoffset:0 }], { duration:300,easing:'cubic-bezier(.2,.65,.25,1)' });
    noteAnimation = annotation?.animate?.([{ opacity:0,translate:'0 5px' },{ opacity:1,translate:'0 0' }], { duration:240,delay:110,fill:'backwards',easing:'cubic-bezier(.2,.65,.25,1)' });
  }
  function placeAnchor(point) {
    lastAnchor = point;
    if (!point || !leader) { story.dataset.anchorVisible = 'false'; cancelEntrance(); syncLeader(); return; }
    // A note that is fading out keeps its place: a stage change at the story
    // exit must not move it while it is still visible on a slow phone. It is
    // placed afresh, still hidden, when the notes return.
    if (story.dataset.notesVisible !== 'true') { placement = null; story.dataset.labelPending = 'true'; syncLeader(); return; }
    const box = pin.getBoundingClientRect(), surface = media.getBoundingClientRect();
    // The original camera uses the same contain fit as the frame renderer. A
    // portrait fit magnifies the frame (CSS) or crops the live camera by the
    // same transform, so the frame box and its masks move with it.
    const imageAspect = frameAnchors?.aspect || 640 / 427;
    const fittedHeight = Math.min(surface.width / imageAspect, surface.height), scale = fit?.scale || 1;
    const imageBox = { x: surface.left - box.left + (fit?.x || 0) + scale * (surface.width-fittedHeight*imageAspect)/2,
      y: surface.top - box.top + (fit?.y || 0) + scale * (surface.height-fittedHeight)/2, width:scale*fittedHeight*imageAspect,height:scale*fittedHeight };
    // Live points are already projected through the (cropped) camera.
    const x = host.dataset.motionLive === 'true' ? surface.left - box.left + point.x * surface.width : imageBox.x + point.x * imageBox.width;
    const y = host.dataset.motionLive === 'true' ? surface.top - box.top + point.y * surface.height : imageBox.y + point.y * imageBox.height;
    let labelBox = annotation?.getBoundingClientRect?.();
    const naturalWidth = box.width <= 700 ? Math.min(240, box.width * .62) : 240;
    // These per-phase masks include moving components throughout the phase.
    const nextOccupancyKey = `${activeNote}:${[imageBox.x,imageBox.y,imageBox.width,imageBox.height].map(value=>value.toFixed(2)).join(':')}`;
    if (nextOccupancyKey !== occupancyKey) {
      occupancyKey = nextOccupancyKey; occupied = drawn ? [] : maskRegions(frameAnchors?.masks?.[activeNote], imageBox);
    }
    const regions = occupied;
    // Drawn callouts weigh the rendered hardware of this phase (or the coarse
    // masks until it arrives) and the part's whole path through the phase.
    const occupancy = !drawn ? null : fine?.phases?.[activeNote] ? { mask: fine.phases[activeNote], columns: fine.columns, rows: fine.rows, box: imageBox }
      : frameAnchors?.masks?.[activeNote] ? { mask: frameAnchors.masks[activeNote], columns: 32, rows: 24, box: imageBox } : null;
    let trajectory = [];
    const step = notes.steps[activeNote], next = notes.steps[activeNote + 1], points = frameAnchors?.points;
    if (drawn && points?.length > 1 && !step?.framePoint) {
      const last = points.length - 1, from = Math.ceil((step?.at || 0) * last), to = next ? Math.max(from, Math.ceil(next.at * last) - 1) : last;
      for (let i = 0; i < 6; i++) {
        const p = points[Math.round(from + (to - from) * i / 5)];
        if (p) trajectory.push({ x: imageBox.x + p.x * imageBox.width, y: imageBox.y + p.y * imageBox.height });
      }
    }
    const gutter = drawn ? Number.parseFloat(typeof getComputedStyle === 'function' ? getComputedStyle(story).getPropertyValue('--gutter') : '') || (box.width <= 700 ? 22 : 56) : 0;
    const cap = .24 * Math.hypot(box.width, box.height);
    const shared = drawn ? { mode: 'drawn', occupancy, trajectory, gutter, cap } : {};
    // Keep notes clear of the heading and of the full stage and timeline controls.
    const controls = story.querySelector('.motion-story-footer')?.getBoundingClientRect?.();
    const bottomReserve = Math.max(80, controls?.height ? box.bottom - controls.top + 4 : 0);
    const reserved = [{x:0,y:0,width:box.width,height:62},{x:0,y:box.height-bottomReserve,width:box.width,height:bottomReserve}];
    const legend = story.querySelector('#case-3d-legend');
    if (legend && !legend.hidden) { const r=legend.getBoundingClientRect(); reserved.push({x:r.left-box.left,y:r.top-box.top,width:r.width,height:r.height}); }
    // When the free band beside a wide model is narrower than the note, try a
    // narrower note (estimated taller) once per stage and stage size, so the
    // note never re-measures itself into an oscillation.
    const fitKey = `${occupancyKey}:${box.width}:${box.height}`;
    if (annotation && labelBox?.width && fitKey !== labelFitKey) {
      labelFitKey = fitKey;
      // Drawn notes are measured from their natural width each stage.
      if (drawn && story.style.getPropertyValue?.('--label-w')) { story.style.removeProperty?.('--label-w'); labelBox = annotation.getBoundingClientRect(); }
      const text = Math.max(1, labelBox.height - 20), estimate = width => width === labelBox.width ? labelBox.height : Math.ceil(20 + text * labelBox.width / width * 1.08);
      let chosen = null;
      for (const width of [naturalWidth, 216, 200, 184].filter(width => width <= naturalWidth)) {
        // Drawn: a narrower note is only searched for a layout that could beat the best so far.
        const bound = drawn && chosen ? chosen.cost - (naturalWidth - width) * 1.5 : Infinity;
        const trial = layoutAnnotation({anchor:{x,y},width:box.width,height:box.height,labelWidth:width,labelHeight:estimate(width),regions,reserved,reset:true,...shared,...(drawn ? { bound } : {})});
        // Drawn: a narrower, taller note must earn its place by a better layout.
        const cost = drawn ? trial.score + (naturalWidth - width) * 1.5 : trial.overlap + trial.reservedOverlap * 50;
        if (!chosen || cost < chosen.cost) chosen = { width, cost };
        if (!drawn && chosen.cost < 1) break;
      }
      let narrow = chosen.width < naturalWidth ? `${chosen.width}px` : '';
      if (drawn) {
        // The note shrinks to its words (same line breaks), so the leader
        // leaves from the text rather than from empty note background.
        if (narrow) story.style.setProperty('--label-w', narrow);
        const tight = inkWidth();
        if (tight && tight < (Number.parseFloat(narrow) || labelBox.width) - 2) narrow = `${tight}px`;
      }
      if ((story.style.getPropertyValue?.('--label-w') || '') !== narrow) {
        if (narrow) story.style.setProperty('--label-w', narrow); else story.style.removeProperty?.('--label-w');
        labelBox = annotation.getBoundingClientRect();
      }
    }
    const labelWidth = labelBox?.width || naturalWidth, labelHeight = labelBox?.height || 96;
    const sizeKey = `${box.width}:${box.height}:${labelWidth}:${labelHeight}`;
    const reset = !placement || placementSize !== sizeKey;
    if (reset) layoutInput = drawn ? { anchor:{x,y}, width:box.width, height:box.height, labelWidth, labelHeight, reserved, trajectory, gutter, cap,
      occupancy: occupancy && { columns: occupancy.columns, rows: occupancy.rows, box: occupancy.box, fine: occupancy.mask === fine?.phases?.[activeNote] } } : null;
    placement = layoutAnnotation({anchor:{x,y},width:box.width,height:box.height,labelWidth,labelHeight,regions,reserved,previous:placement,reset,...shared});
    placementSize = sizeKey;
    story.style.setProperty('--label-x', `${placement.x}px`); story.style.setProperty('--label-y', `${placement.y}px`);
    leader.setAttribute('d', placement.path); halo?.setAttribute('d', placement.path);
    endpoint?.setAttribute('cx',x.toFixed(1)); endpoint?.setAttribute('cy',y.toFixed(1));
    story.dataset.leaderLength = placement.length.toFixed(1);
    story.dataset.labelOverlap = (placement.overlap || 0).toFixed(1);
    if (drawn) { story.dataset.leaderCap = cap.toFixed(1); story.dataset.leaderRun = Number.isFinite(placement.run) ? placement.run.toFixed(1) : ''; }
    story.dataset.anchorVisible = String(x >= 0 && x <= box.width && y > 30 && y < box.height - 40);
    if (story.dataset.anchorVisible !== 'true') cancelEntrance();
    else revealAnnotation();
    syncLeader();
  }
  if (leader) {
    fetch(drawn ? DRAWN_ANCHORS : 'assets/exploded/scanner-color-20261024/anchors.json', { signal: events.signal }).then(response => {
      if (!response.ok) throw new Error('Annotation coordinates unavailable');
      return response.json();
    }).then(data => { if (disposed) return; frameAnchors = data[story.dataset.motionProject]; placement = null; occupancyKey = '';
      footprint = maskFootprint(frameAnchors?.masks); updateFit();
      if (host.dataset.motionLive !== 'true' && frameAnchors?.legend) {
        const legend = document.createElement('div'); legend.id = 'case-3d-legend'; legend.className = 'case-3d-legend';
        host.append(legend); renderPressureLegend(legend, frameAnchors.legend);
      }
      paint(shown); if (host.dataset.motionLive === 'true') placeAnchor(lastAnchor);
      // The finer hardware grid follows the anchors at low priority; a note
      // already on screen keeps its place until its next stage or resize.
      const tag = drawn && OCCUPANCY[story.dataset.motionProject];
      if (!tag) return;
      fetch(`assets/detail-callouts-20261028/${story.dataset.motionProject}.${tag}.json`, { signal: events.signal, priority: 'low' })
        .then(response => response.ok ? response.json() : null)
        .then(data => {
          if (disposed || !data?.phases) return;
          if (story.dataset.notesVisible === 'true' && placement) pendingFine = data; else { fine = data; occupancyKey = ''; }
        }).catch(() => {});
    }).catch(() => {});
  }
  // Any press or key on the stage settles a callout still drawing.
  if (drawn) {
    listen(pin, 'pointerdown', () => { if (lineAnimation || ghost) cancelEntrance(); }, { passive: true });
    listen(story, 'keydown', () => { if (lineAnimation || ghost) cancelEntrance(); });
  }
  // QA handle: the callout mode and the last placement's measures.
  if (drawn) window.__caseCallouts = { getState: () => ({ mode: story.dataset.callouts, leader: leaderState, step: activeNote, fine: !!fine,
    placement: placement && { x: placement.x, y: placement.y, width: placement.width, height: placement.height, side: placement.side, length: placement.length,
      longest: placement.longest, run: placement.run, start: placement.start, elbow: placement.elbow, tip: placement.tip },
    input: layoutInput, ghost: !!ghost, drawing: !!lineAnimation && lineAnimation.playState === 'running' }) };

  const active = () => !disposed && !suspended && !document.hidden && !lightbox && inView;
  const label = index => `${String(index + 1).padStart(2, '0')} / ${String(notes.steps.length).padStart(2, '0')}`;
  function paint(progress) {
    shown = clamp(progress);
    const index = noteAt(notes.steps, shown), step = notes.steps[index];
    if (activeNote !== index) {
      // The leader of the stage being left retracts while the next one draws.
      if (drawn && leaderState === 'in') retractLeader();
      if (drawn) { stopArrivalWait(); if (leaderState !== 'off') setLeader('off'); }
      if (pendingFine) { fine = pendingFine; pendingFine = null; occupancyKey = ''; }
      activeNote = index; title.textContent = step.title; body.textContent = step.body; count.textContent = label(index);
      story.dataset.noteSide = step.side || (index % 2 ? 'left' : 'right');
      cancelEntrance(drawn); placement = null; entrancePending = true;
      story.dataset.labelPending = 'true';
      [...buttons.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    const percent = Math.round(shown * 100);
    output.value = `${percent}%`; output.textContent = `${percent}%`;
    range.setAttribute('aria-valuetext', `${percent} percent — ${step.title}`);
    story.dataset.shownProgress = shown.toFixed(4);
    const notesVisible = annotationRequested || reduced.matches || !pinned || (shown > .018 && shown < .995);
    const appearing = notesVisible && story.dataset.notesVisible !== 'true';
    if (appearing) entrancePending = true;
    // Notes leaving at either end of the story take their leader back with them.
    if (drawn && !notesVisible && leaderState === 'in') { retractLeader(); setLeader('off'); }
    story.dataset.notesVisible = String(notesVisible);
    annotation?.setAttribute('aria-hidden', String(!notesVisible || free));
    story.dataset.loading = String(Math.abs(target - shown) > .04 && !free);
    // A static unified part may name one documented feature per stage.
    if (frameAnchors && host.dataset.motionLive !== 'true') placeAnchor(step.framePoint || frameAnchors.points[Math.round(shown * (frameAnchors.points.length - 1))]);
    // Live notes were not placed while hidden; place them from the last projection.
    else if (appearing && host.dataset.motionLive === 'true') placeAnchor(lastAnchor);
    if (!notesVisible || free) cancelEntrance(drawn && !free);
    syncLeader();
  }
  function reflectTarget() {
    range.value = String(Math.round(target * 1000));
    range.style.setProperty('--motion-progress', `${target * 100}%`);
    story.dataset.scrollProgress = target.toFixed(4);
  }
  function emit(progress, immediate = false) {
    if (!active()) return;
    if (!immediate && Math.abs(progress - sent) < .00005) return;
    sent = progress;
    host.dispatchEvent(new CustomEvent('case-motion-request', { detail: { progress, immediate } }));
  }
  function schedule() { if (!raf && active() && !free) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (!active() || free) { previousTime = 0; return; }
    if (pendingMeasure) { pendingMeasure = false; measure(); }
    const elapsed = previousTime ? Math.min(64, now - previousTime) : 16;
    previousTime = now;
    eased = reduced.matches ? target : eased + (target - eased) * (1 - Math.exp(-elapsed / 95));
    if (Math.abs(target - eased) < .0005) eased = target;
    emit(eased);
    if (Math.abs(eased - target) > .00005) schedule();
    else previousTime = 0;
  }
  function readScroll() {
    // Re-entering from below, the observer can fire while the pin is still under
    // the sticky header, where measure() counts it as hidden, and never fire
    // again. Recheck on scroll so the story resumes instead of holding its cover.
    if (intersecting && !inView && !disposed) {
      measure({ sync: false });
      if (inView) { sent = -1; emit(eased, true); }
    }
    if (reduced.matches || !pinned || free) return;
    target = progressFromScroll(window.scrollY, start, travel); reflectTarget(); schedule();
  }
  function measure({ sync = true } = {}) {
    const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 77;
    const top = headerHeight;
    story.style.setProperty('--story-top', `${top}px`);
    travel = storyTravel(notes.steps.length, innerWidth, innerHeight);
    const pinHeight = pin.getBoundingClientRect().height;
    pinned = innerHeight >= 600 && !(innerWidth < 350 && innerHeight < 760);
    story.classList.toggle('is-unpinned', !pinned);
    story.style.setProperty('--story-travel', `${travel}px`);
    story.style.minHeight = reduced.matches || !pinned ? '' : `${pinHeight + travel}px`;
    start = story.getBoundingClientRect().top + window.scrollY - top;
    const box = pin.getBoundingClientRect();
    // The story keeps tracking a quarter viewport below the fold, so a jump
    // back to the top never leaves a later stage waiting there to rewind.
    inView = box.bottom > top && box.top < innerHeight * (1 + TRACK_BELOW);
    updateFit();
    if (!free) instructions.textContent = reduced.matches
      ? 'Choose a numbered stage or use the slider to inspect each pose. Automatic scroll animation is off for reduced motion.'
      : !pinned ? 'Choose a numbered stage or use the slider to explore the model and its notes.'
        : 'Scroll down to explore; scroll back to reverse. The notes follow the model. Choose a numbered stage or use the slider at any time.';
    if (!sync) return;
    if (reduced.matches || !pinned) { eased = target; reflectTarget(); emit(target, true); }
    else readScroll();
    paint(shown); placeAnchor(lastAnchor);
  }
  function choose(progress) {
    if (free) setFree(false);
    // Fonts and asynchronous case content can move the section without
    // resizing the pinned viewport. Seek from its current document position.
    measure({ sync: false });
    annotationRequested = true;
    story.dataset.userSeeking = 'true';
    target = clamp(progress); reflectTarget();
    // A stage that is already displayed (stage 01 on the cover) sends no new
    // pose, so reveal its requested note now.
    if (noteAt(notes.steps, target) === activeNote) paint(shown);
    if (reduced.matches || !pinned) { eased = target; emit(target, true); }
    else {
      // Device-pixel rounding must not land just before a named phase boundary.
      window.scrollTo({ top: Math.max(0, Math.ceil(start + target * travel) + 1), behavior: 'instant' });
      schedule();
    }
  }
  function setFree(value) {
    const returning = free && !value, returnProgress = shown;
    cancelEntrance(); placement = null; free = !!value; story.classList.toggle('is-free', free);
    // The free-mode gesture hint retires after the first real drag, pinch or
    // zoom. These passive listeners exist only while exploring freely, so the
    // story never listens to wheel input during native scrolling.
    story.classList.remove('is-free-moved'); freeEvents?.abort(); freeEvents = null;
    if (free) {
      freeEvents = new AbortController();
      const options = { passive: true, signal: freeEvents.signal };
      let dragStart = null;
      const moved = () => { story.classList.add('is-free-moved'); freeEvents?.abort(); freeEvents = null; };
      host.addEventListener('pointerdown', event => { dragStart = { x: event.clientX, y: event.clientY }; }, options);
      host.addEventListener('pointermove', event => { if (dragStart && Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 6) moved(); }, options);
      window.addEventListener('pointerup', () => { dragStart = null; }, options);
      host.addEventListener('wheel', moved, options);
    }
    if (mode) { mode.setAttribute('aria-pressed', String(free)); mode.textContent = free ? 'Back to the story ↓' : 'Explore freely'; }
    host.dispatchEvent(new CustomEvent('case-motion-mode', { detail: { free } }));
    instructions.textContent = free
      ? 'Drag to rotate. Scroll or pinch over the model to zoom. Use the controls to play or seek; return to the scroll guide to continue the annotated sequence.'
      : reduced.matches ? 'Choose a numbered stage or use the slider to inspect each pose. Automatic scroll animation is off for reduced motion.'
        : 'Scroll down to explore; scroll back to reverse. The notes follow the model. Choose a numbered stage or use the slider at any time.';
    sent = -1; measure(); paint(shown);
    // Exploration starts from the visible pose: the live camera fits it with a
    // margin, and returning to the story restores the source view.
    if (free) host.querySelector('#case-3d-canvas')?.dispatchEvent(new CustomEvent('studio-view-fit', { detail: { margin: 1.15 } }));
    if (returning) choose(returnProgress);
    if (!free) schedule();
  }
  notes.steps.forEach((step, index) => {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = String(index + 1).padStart(2, '0');
    button.setAttribute('aria-label', `Stage ${index + 1}: ${step.title}`); button.setAttribute('aria-pressed', 'false');
    listen(button, 'click', () => {
      const frames = Number(host.dataset.motionFrames);
      const position = frames > 1 ? Math.ceil(step.at * (frames - 1)) / (frames - 1) : step.at;
      choose(position);
    }); buttons.append(button);
  });
  note.textContent = notes.note || '';
  paint(0);
  story.classList.add('is-enhanced');
  listen(range, 'input', () => choose(Number(range.value) / 1000));
  if (mode) listen(mode, 'click', () => setFree(!free));
  listen(host, 'case-motion-anchor', event => placeAnchor(event.detail?.point));
  listen(host, 'case-motion-progress', event => { paint(event.detail?.progress); if (free) { target = shown; reflectTarget(); } });
  listen(host, 'case-motion-ready', () => { sent = -1; measure(); if (active() && !free) emit(eased, true); schedule(); });
  listen(window, 'scroll', readScroll, { passive: true });
  listen(window, 'resize', () => {
    if (pendingFine) { fine = pendingFine; pendingFine = null; occupancyKey = ''; }
    pendingMeasure = true; measure();
  }, { passive: true });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; previousTime = 0; cancelEntrance(); suspendLeader(); }
    else { sent = -1; measure(); if (active() && !free) emit(eased, true); schedule(); }
  });
  listen(window, 'case-lightbox-state', event => {
    lightbox = Boolean(event.detail?.open);
    if (lightbox) { cancelEntrance(); suspendLeader(); }
    if (!lightbox) { sent = -1; measure(); emit(eased, true); schedule(); }
  });
  listen(reduced, 'change', () => { cancelEntrance(); sent = -1; setFree(false); measure(); });
  const visibility = new IntersectionObserver(entries => {
    const returning = !intersecting, latest = entries[entries.length - 1]; // a batch's last entry is the state now
    inView = intersecting = latest.isIntersecting;
    if (inView) {
      sent = -1; measure();
      // Re-entering from below (after a jump past the tracking margin), the
      // story takes its scroll position's stage at once instead of rewinding.
      if (returning && !free && (latest.boundingClientRect?.top ?? 0) > innerHeight * .5) eased = target;
      emit(eased, true); schedule();
    }
    else { cancelAnimationFrame(raf); raf = 0; previousTime = 0; cancelEntrance(); suspendLeader(); }
  }, { rootMargin: `0px 0px ${TRACK_BELOW * 100}% 0px` });
  visibility.observe(pin);
  const resize = new ResizeObserver(() => { if (!disposed) measure(); });
  resize.observe(pin);
  if (annotation) resize.observe(annotation);
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(raf); visibility.disconnect(); resize.disconnect(); events.abort(); freeEvents?.abort();
    cancelEntrance();
    stopArrivalWait();
  }
  listen(window, 'studio-project-dispose', dispose);
  listen(window, 'pagehide', event => {
    suspended = true; cancelAnimationFrame(raf); raf = 0; previousTime = 0; cancelEntrance(); suspendLeader();
    if (!event.persisted) dispose();
  });
  listen(window, 'pageshow', event => { if (event.persisted && !disposed) { suspended = false; sent = -1; measure(); emit(eased, true); schedule(); } });
  setFree(false); measure();
  return { dispose, getState: () => ({ target, shown, free, start, travel, inView, suspended, disposed }) };
}

function mount() { document.querySelectorAll('.case-motion-story').forEach(attachMotionStory); }
window.addEventListener('project-previews-ready', mount);
mount();

// The phone chapter nav scrolls sideways under edge fades. case-study.js
// centres the current section's link; a keyboard-focused link is centred the
// same way, so no part of it sits clipped or faded at either edge.
document.addEventListener('focusin', event => {
  const link = event.target.closest?.('.chapter-nav a'), nav = link?.closest('.chapter-nav-inner');
  if (!nav || !link.matches(':focus-visible') || nav.scrollWidth - nav.clientWidth <= 1) return;
  const navBox = nav.getBoundingClientRect(), linkBox = link.getBoundingClientRect();
  const left = nav.scrollLeft + linkBox.left - navBox.left - (navBox.width - linkBox.width) / 2;
  nav.scrollTo({ left: Math.max(0, Math.min(nav.scrollWidth - nav.clientWidth, left)), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
