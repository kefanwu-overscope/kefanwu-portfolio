import { layoutAnnotation, maskRegions } from './project-annotation-layout.js';
import { renderPressureLegend } from './project-pressure-legend.js';
import { projectMotionLabels } from './project-motion-labels.js';
import { projectMotionNotes } from './project-motion-notes.js?v=page-integrated-20260930';

const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
export function progressFromScroll(scroll, start, distance) { return clamp((scroll - start) / Math.max(1, distance)); }
export function noteAt(steps, progress) {
  let index = 0;
  for (let i = 1; i < steps.length; i++) if (progress + .00001 >= steps[i].at) index = i;
  return index;
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
  let inView = false, disposed = false, suspended = false, lightbox = false, free = false, pinned = true, activeNote = -1;
  let pendingMeasure = false, sent = -1, annotationRequested = false, noteAnimation = null;
  const annotation = story.querySelector('.motion-notes');
  const leader = story.querySelector('.motion-leader-line');
  const endpoint = story.querySelector('.motion-leader-target');
  let lastAnchor = null, frameAnchors = null, placement = null, placementSize = '', entrancePending = false;
  let occupancyKey = '', occupied = [];
  let lineAnimation = null, dotAnimation = null;
  function cancelEntrance() {
    noteAnimation?.cancel(); lineAnimation?.cancel(); dotAnimation?.cancel();
    noteAnimation = lineAnimation = dotAnimation = null;
    story.dataset.labelPending = 'false';
  }
  function revealAnnotation() {
    if (!entrancePending || story.dataset.anchorVisible !== 'true') return;
    entrancePending = false; cancelEntrance();
    if (reduced.matches || !active() || free || story.dataset.notesVisible !== 'true') return;
    dotAnimation = endpoint?.animate?.([{ opacity:0, transform:'scale(.55)' },{ opacity:1, transform:'scale(1)' }], { duration:210,easing:'ease-out' });
    lineAnimation = leader.animate?.([{ strokeDasharray:'1',strokeDashoffset:-1 },{ strokeDasharray:'1',strokeDashoffset:0 }], { duration:300,easing:'cubic-bezier(.2,.65,.25,1)' });
    noteAnimation = annotation?.animate?.([{ opacity:0,translate:'0 5px' },{ opacity:1,translate:'0 0' }], { duration:240,delay:110,fill:'backwards',easing:'cubic-bezier(.2,.65,.25,1)' });
  }
  function placeAnchor(point) {
    lastAnchor = point;
    if (!point || !leader) { story.dataset.anchorVisible = 'false'; cancelEntrance(); return; }
    const box = pin.getBoundingClientRect(), surface = media.getBoundingClientRect();
    let width = surface.width, height = surface.height, left = surface.left - box.left, top = surface.top - box.top;
    if (host.dataset.motionLive !== 'true') {
      const aspect = frameAnchors?.aspect || 1.5;
      const scale = Math.min(width / aspect, height);
      left += (width - scale * aspect) / 2; top += (height - scale) / 2;
      width = scale * aspect; height = scale;
    }
    const x = left + point.x * width, y = top + point.y * height;
    const labelBox = annotation?.getBoundingClientRect?.();
    const labelWidth = labelBox?.width || (box.width <= 700 ? 164 : 184), labelHeight = labelBox?.height || 80;
    // The original camera uses the same contain fit as the frame renderer.
    // These per-phase masks include moving components throughout the phase.
    const imageAspect = frameAnchors?.aspect || 640 / 427;
    const fittedHeight = Math.min(surface.width / imageAspect, surface.height);
    const imageBox = { x: surface.left - box.left + (surface.width-fittedHeight*imageAspect)/2,
      y: surface.top - box.top + (surface.height-fittedHeight)/2, width:fittedHeight*imageAspect,height:fittedHeight };
    const nextOccupancyKey = `${activeNote}:${[imageBox.x,imageBox.y,imageBox.width,imageBox.height].map(value=>value.toFixed(2)).join(':')}`;
    if (nextOccupancyKey !== occupancyKey) {
      occupancyKey = nextOccupancyKey; occupied = maskRegions(frameAnchors?.masks?.[activeNote], imageBox);
    }
    const regions = occupied;
    const reserved = [{x:0,y:0,width:box.width,height:62},{x:0,y:box.height-80,width:box.width,height:80}];
    const legend = story.querySelector('#case-3d-legend');
    if (legend && !legend.hidden) { const r=legend.getBoundingClientRect(); reserved.push({x:r.left-box.left,y:r.top-box.top,width:r.width,height:r.height}); }
    const sizeKey = `${box.width}:${box.height}:${labelWidth}:${labelHeight}`;
    const reset = !placement || placementSize !== sizeKey;
    placement = layoutAnnotation({anchor:{x,y},width:box.width,height:box.height,labelWidth,labelHeight,regions,reserved,previous:placement,reset});
    placementSize = sizeKey;
    story.style.setProperty('--label-x', `${placement.x}px`); story.style.setProperty('--label-y', `${placement.y}px`);
    leader.setAttribute('d', placement.path);
    endpoint?.setAttribute('cx',x.toFixed(1)); endpoint?.setAttribute('cy',y.toFixed(1));
    story.dataset.leaderLength = placement.length.toFixed(1);
    story.dataset.labelOverlap = placement.overlap.toFixed(1);
    story.dataset.anchorVisible = String(x >= 0 && x <= box.width && y > 30 && y < box.height - 40);
    if (story.dataset.anchorVisible !== 'true') cancelEntrance();
    else revealAnnotation();
  }
  if (leader) {
    fetch('assets/exploded/refined-20260930/anchors.json', { signal: events.signal }).then(response => {
      if (!response.ok) throw new Error('Annotation coordinates unavailable');
      return response.json();
    }).then(data => { if (disposed) return; frameAnchors = data[story.dataset.motionProject]; placement = null; occupancyKey = '';
      if (host.dataset.motionLive !== 'true' && frameAnchors?.legend) {
        const legend = document.createElement('div'); legend.id = 'case-3d-legend'; legend.className = 'case-3d-legend';
        host.append(legend); renderPressureLegend(legend, frameAnchors.legend);
      }
      paint(shown); if (host.dataset.motionLive === 'true') placeAnchor(lastAnchor);
    }).catch(() => {});
  }

  const active = () => !disposed && !suspended && !document.hidden && !lightbox && inView;
  const label = index => `${String(index + 1).padStart(2, '0')} / ${String(notes.steps.length).padStart(2, '0')}`;
  function paint(progress) {
    shown = clamp(progress);
    const index = noteAt(notes.steps, shown), step = notes.steps[index];
    if (activeNote !== index) {
      activeNote = index; title.textContent = step.title; body.textContent = step.body; count.textContent = label(index);
      story.dataset.noteSide = step.side || (index % 2 ? 'left' : 'right');
      cancelEntrance(); placement = null; entrancePending = true;
      story.dataset.labelPending = 'true';
      [...buttons.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    const percent = Math.round(shown * 100);
    output.value = `${percent}%`; output.textContent = `${percent}%`;
    range.setAttribute('aria-valuetext', `${percent} percent — ${step.title}`);
    story.dataset.shownProgress = shown.toFixed(4);
    const notesVisible = annotationRequested || reduced.matches || !pinned || (shown > .018 && shown < .995);
    if (notesVisible && story.dataset.notesVisible !== 'true') entrancePending = true;
    story.dataset.notesVisible = String(notesVisible);
    annotation?.setAttribute('aria-hidden', String(!notesVisible || free));
    story.dataset.loading = String(Math.abs(target - shown) > .04 && !free);
    if (frameAnchors && host.dataset.motionLive !== 'true') placeAnchor(frameAnchors.points[Math.round(shown * (frameAnchors.points.length - 1))]);
    if (!notesVisible || free) cancelEntrance();
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
    if (reduced.matches || !pinned || free) return;
    target = progressFromScroll(window.scrollY, start, travel); reflectTarget(); schedule();
  }
  function measure({ sync = true } = {}) {
    const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 77;
    const top = headerHeight;
    story.style.setProperty('--story-top', `${top}px`);
    // Four model-heights mirrors the reference's natural scroll distance.
    travel = Math.max(1000, media.getBoundingClientRect().height * (story.dataset.motionProject === 'steering' ? 6 : 4));
    const pinHeight = pin.getBoundingClientRect().height;
    pinned = innerHeight >= 600 && !(innerWidth < 350 && innerHeight < 760);
    story.classList.toggle('is-unpinned', !pinned);
    story.style.setProperty('--story-travel', `${travel}px`);
    story.style.minHeight = reduced.matches || !pinned ? '' : `${pinHeight + travel}px`;
    start = story.getBoundingClientRect().top + window.scrollY - top;
    const box = pin.getBoundingClientRect();
    inView = box.bottom > top && box.top < innerHeight;
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
    if (mode) { mode.setAttribute('aria-pressed', String(free)); mode.textContent = free ? 'Back to the story ↓' : 'Explore freely ↗'; }
    host.dispatchEvent(new CustomEvent('case-motion-mode', { detail: { free } }));
    instructions.textContent = free
      ? 'Drag to rotate. Scroll or pinch over the model to zoom. Use the controls to play or seek; return to the scroll guide to continue the annotated sequence.'
      : reduced.matches ? 'Choose a numbered stage or use the slider to inspect each pose. Automatic scroll animation is off for reduced motion.'
        : 'Scroll down to explore; scroll back to reverse. The notes follow the model. Choose a numbered stage or use the slider at any time.';
    sent = -1; measure(); paint(shown);
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
  listen(window, 'resize', () => { pendingMeasure = true; measure(); }, { passive: true });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; previousTime = 0; cancelEntrance(); }
    else { sent = -1; measure(); if (active() && !free) emit(eased, true); schedule(); }
  });
  listen(window, 'case-lightbox-state', event => {
    lightbox = Boolean(event.detail?.open);
    if (lightbox) cancelEntrance();
    if (!lightbox) { sent = -1; measure(); emit(eased, true); schedule(); }
  });
  listen(reduced, 'change', () => { cancelEntrance(); sent = -1; setFree(false); measure(); });
  const visibility = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) { sent = -1; measure(); emit(eased, true); schedule(); }
    else { cancelAnimationFrame(raf); raf = 0; previousTime = 0; cancelEntrance(); }
  });
  visibility.observe(pin);
  const resize = new ResizeObserver(() => { if (!disposed) measure(); });
  resize.observe(pin);
  if (annotation) resize.observe(annotation);
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(raf); visibility.disconnect(); resize.disconnect(); events.abort();
    cancelEntrance();
  }
  listen(window, 'studio-project-dispose', dispose);
  listen(window, 'pagehide', event => {
    suspended = true; cancelAnimationFrame(raf); raf = 0; previousTime = 0; cancelEntrance();
    if (!event.persisted) dispose();
  });
  listen(window, 'pageshow', event => { if (event.persisted && !disposed) { suspended = false; sent = -1; measure(); emit(eased, true); schedule(); } });
  setFree(false); measure();
  return { dispose, getState: () => ({ target, shown, free, start, travel, inView, suspended, disposed }) };
}

function mount() { document.querySelectorAll('.case-motion-story').forEach(attachMotionStory); }
window.addEventListener('project-previews-ready', mount);
mount();
