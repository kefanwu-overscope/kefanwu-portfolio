import { projectMotionNotes } from './project-motion-notes.js?v=motion-story-20260930';

const clamp = value => Math.max(0, Math.min(1, Number(value) || 0));
export function progressFromScroll(scroll, start, distance) { return clamp((scroll - start) / Math.max(1, distance)); }
export function noteAt(steps, progress) {
  let index = 0;
  for (let i = 1; i < steps.length; i++) if (progress + .00001 >= steps[i].at) index = i;
  return index;
}

export function attachMotionStory(story) {
  const notes = projectMotionNotes[story.dataset.motionProject];
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
  let pendingMeasure = false, sent = -1;
  const active = () => !disposed && !suspended && !document.hidden && !lightbox && inView;
  const label = index => `${String(index + 1).padStart(2, '0')} / ${String(notes.steps.length).padStart(2, '0')}`;
  function paint(progress) {
    shown = clamp(progress);
    const index = noteAt(notes.steps, shown), step = notes.steps[index];
    if (activeNote !== index) {
      activeNote = index; title.textContent = step.title; body.textContent = step.body; count.textContent = label(index);
      [...buttons.children].forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    }
    const percent = Math.round(shown * 100);
    output.value = `${percent}%`; output.textContent = `${percent}%`;
    range.setAttribute('aria-valuetext', `${percent} percent — ${step.title}`);
    story.dataset.shownProgress = shown.toFixed(4);
    story.dataset.loading = String(Math.abs(target - shown) > .04 && !free);
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
  function measure() {
    const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 77;
    const top = headerHeight + (innerWidth <= 700 ? 8 : 14);
    story.style.setProperty('--story-top', `${top}px`);
    // Four model-heights mirrors the reference's natural scroll distance.
    travel = Math.max(850, media.getBoundingClientRect().height * 4);
    const pinHeight = pin.getBoundingClientRect().height;
    const compactPressureView = document.body?.dataset.caseMode === 'studio' &&
      story.dataset.motionProject === 'ansysCfd' && innerWidth <= 700 && innerHeight < 760;
    pinned = innerHeight >= 600 && !(innerWidth < 350 && innerHeight < 760) && !compactPressureView;
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
    if (reduced.matches || !pinned) { eased = target; reflectTarget(); emit(target, true); }
    else readScroll();
  }
  function choose(progress) {
    if (free) setFree(false);
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
    free = !!value; story.classList.toggle('is-free', free);
    if (mode) { mode.setAttribute('aria-pressed', String(free)); mode.textContent = free ? 'Back to scroll guide ↓' : 'Rotate the model ↗'; }
    host.dispatchEvent(new CustomEvent('case-motion-mode', { detail: { free } }));
    instructions.textContent = free
      ? 'Drag to rotate. Scroll or pinch over the model to zoom. Use the controls to play or seek; return to the scroll guide to continue the annotated sequence.'
      : reduced.matches ? 'Choose a numbered stage or use the slider to inspect each pose. Automatic scroll animation is off for reduced motion.'
        : 'Scroll down to explore; scroll back to reverse. The notes follow the model. Choose a numbered stage or use the slider at any time.';
    sent = -1; measure();
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
  listen(host, 'case-motion-progress', event => { paint(event.detail?.progress); if (free) { target = shown; reflectTarget(); } });
  listen(host, 'case-motion-ready', () => { sent = -1; measure(); if (active() && !free) emit(eased, true); schedule(); });
  listen(window, 'scroll', readScroll, { passive: true });
  listen(window, 'resize', () => { pendingMeasure = true; measure(); }, { passive: true });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; previousTime = 0; }
    else { sent = -1; measure(); if (active() && !free) emit(eased, true); schedule(); }
  });
  listen(window, 'case-lightbox-state', event => {
    lightbox = Boolean(event.detail?.open);
    if (!lightbox) { sent = -1; measure(); emit(eased, true); schedule(); }
  });
  listen(reduced, 'change', () => { sent = -1; setFree(false); measure(); });
  const visibility = new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting;
    if (inView) { sent = -1; measure(); emit(eased, true); schedule(); }
    else { cancelAnimationFrame(raf); raf = 0; previousTime = 0; }
  });
  visibility.observe(pin);
  const resize = new ResizeObserver(() => { if (!disposed) measure(); });
  resize.observe(pin);
  function dispose() {
    if (disposed) return;
    disposed = true; cancelAnimationFrame(raf); visibility.disconnect(); resize.disconnect(); events.abort();
  }
  listen(window, 'studio-project-dispose', dispose);
  listen(window, 'pagehide', event => {
    suspended = true; cancelAnimationFrame(raf); raf = 0; previousTime = 0;
    if (!event.persisted) dispose();
  });
  listen(window, 'pageshow', event => { if (event.persisted && !disposed) { suspended = false; sent = -1; measure(); emit(eased, true); schedule(); } });
  setFree(false); measure();
  return { dispose, getState: () => ({ target, shown, free, start, travel, inView, suspended, disposed }) };
}

function mount() { document.querySelectorAll('.case-motion-story').forEach(attachMotionStory); }
window.addEventListener('project-previews-ready', mount);
mount();
