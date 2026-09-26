import { RESUME_ASSET } from './experience-resume-assets.js';
import { resumeAccessibleHTML } from './experience-resume-content.js';
export { RESUME_ASSET };
export const RESUME_PAPER = Object.freeze({ width: .234, height: .234 * 22 / 17, thickness: .00025, bottom: .76695 });

export function resumeHTML() {
  const pdf = `${RESUME_ASSET.source}?v=${RESUME_ASSET.sourceSha256.slice(0, 12)}`;
  return `<div class="exp-sheet__toolbar" aria-label="Résumé controls">
    <a href="${pdf}" target="_blank" rel="noopener" class="exp-sheet__pdf" aria-label="Open résumé PDF in a new tab"><span class="exp-sheet__open-label">Open </span>PDF ↗</a>
    <a href="${pdf}" download="Kefan-Wu-Resume.pdf" class="exp-sheet__download" aria-label="Download résumé PDF" title="Download PDF">↓</a>
    <div class="exp-sheet__views" role="group" aria-label="Résumé view">
      <button type="button" data-resume-view="page" aria-pressed="true">Page</button>
      <button type="button" data-resume-view="text" aria-pressed="false">Text</button>
    </div>
    <div class="exp-sheet__zoom" role="group" aria-label="Résumé zoom">
      <button type="button" data-resume-zoom="out" aria-label="Zoom out résumé">−</button>
      <button type="button" data-resume-zoom="fit" aria-label="Fit résumé to window width" title="Fit width">Width</button>
      <button type="button" data-resume-zoom="in" aria-label="Zoom in résumé">+</button>
    </div>
    <button type="button" class="exp-sheet__close" data-close aria-label="Close résumé">×</button>
  </div>
  <div class="exp-sheet__viewport" tabindex="0" role="region" aria-label="Résumé page; scroll to read">
    <img class="exp-sheet__image" src="${RESUME_ASSET.preview}" width="${RESUME_ASSET.width}" height="${RESUME_ASSET.height}" alt="" draggable="false" decoding="async" crossorigin="anonymous">
    <div class="exp-sheet__text">${resumeAccessibleHTML()}</div>
  </div>`;
}

// Only the brief 3D handoff has a Letter rectangle. Reading uses the entire
// window; the permanent print never depends on scrolling or magnification.
export function attachResumeReader(paper, { reducedMotion = false } = {}) {
  const viewport = paper.querySelector('.exp-sheet__viewport'), image = paper.querySelector('.exp-sheet__image');
  const text = paper.querySelector('.exp-sheet__text'), fit = paper.querySelector('[data-resume-zoom="fit"]');
  const out = paper.querySelector('[data-resume-zoom="out"]'), pageButton = paper.querySelector('[data-resume-view="page"]'), textButton = paper.querySelector('[data-resume-view="text"]');
  const events = new AbortController(), animations = new Set();
  let phase = 'landing', mode = 'page', zoom = 1, targetZoom = 1, drag = null;
  let zoomFrame = 0, generation = 0, disposed = false, closePromise = null, resolveClose = null;
  const listen = (node, type, fn, options = {}) => node.addEventListener(type, fn, { ...options, signal: events.signal });
  const pad = () => parseFloat(getComputedStyle(viewport).paddingLeft) || 0;
  const fittedWidth = () => Math.max(1, viewport.clientWidth - 2 * pad());
  function release() {
    const id = drag?.id; drag = null; viewport.classList.remove('is-dragging');
    if (id !== undefined && viewport.hasPointerCapture?.(id)) viewport.releasePointerCapture(id);
  }
  function stopEffects() {
    cancelAnimationFrame(zoomFrame); zoomFrame = 0;
    for (const animation of animations) animation.cancel();
    animations.clear(); release();
  }
  function animate(node, keyframes, duration) {
    if (reducedMotion || !node.animate) return Promise.resolve();
    const animation = node.animate(keyframes, { duration, easing: 'cubic-bezier(.22,.75,.18,1)' });
    animations.add(animation);
    return animation.finished.catch(() => {}).finally(() => animations.delete(animation));
  }
  function morph(from, duration, fade = false) {
    const to = image.getBoundingClientRect(), scale = from.width / Math.max(1, to.width);
    return animate(image, [
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${scale})`, opacity: fade ? .15 : 1 },
      { transform: 'none', opacity: 1 },
    ], duration);
  }
  function paint() {
    image.style.width = phase === 'landing' || phase === 'closing' ? '100%' : `${fittedWidth() * zoom}px`;
    text.style.fontSize = `${18 * zoom}px`;
    fit.textContent = Math.abs(zoom - 1) < .001 ? (mode === 'page' ? 'Width' : '100%') : `${Math.round(zoom * 100)}%`;
    out.disabled = targetZoom <= .25;
    paper.classList.toggle('is-zoomed', Math.abs(zoom - 1) > .001);
    pageButton.setAttribute('aria-pressed', String(mode === 'page'));
    textButton.setAttribute('aria-pressed', String(mode === 'text'));
  }
  function canonical() {
    paper.classList.remove('is-expanded', 'is-text', 'is-morphing', 'is-zoomed');
    mode = 'page'; zoom = targetZoom = 1; phase = 'landing';
    paint(); viewport.scrollTo(0, 0);
  }
  function setMode(next) {
    if (phase !== 'reading' || next === mode) return;
    stopEffects(); mode = next; zoom = targetZoom = 1;
    paper.classList.toggle('is-text', mode === 'text'); paint(); paint(); viewport.scrollTo(0, 0);
    void animate(mode === 'page' ? image : text, [{ opacity: .3 }, { opacity: 1 }], 140);
  }
  function setZoom(value, clientX, clientY) {
    if (phase !== 'reading' || !Number.isFinite(value)) return;
    // No fixed upper magnification ceiling and no small paper-sized viewport.
    targetZoom = Math.max(.25, value);
    cancelAnimationFrame(zoomFrame); release();
    const content = mode === 'page' ? image : text;
    const rect = content.getBoundingClientRect(), view = viewport.getBoundingClientRect();
    const x = clientX ?? view.left + view.width / 2, y = clientY ?? view.top + view.height / 2;
    const anchorX = (x - rect.left) / Math.max(1, rect.width), anchorY = (y - rect.top) / Math.max(1, rect.height);
    const from = zoom, to = targetZoom, start = performance.now();
    const step = now => {
      if (disposed || phase !== 'reading') return;
      const t = reducedMotion ? 1 : Math.min(1, (now - start) / 190);
      zoom = from + (to - from) * (1 - (1 - t) ** 3); paint();
      const next = content.getBoundingClientRect();
      viewport.scrollLeft += next.left + anchorX * next.width - x;
      viewport.scrollTop += next.top + anchorY * next.height - y;
      zoomFrame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    if (reducedMotion) step(start); else zoomFrame = requestAnimationFrame(step);
  }
  listen(out, 'click', () => setZoom(targetZoom / 1.25));
  listen(paper.querySelector('[data-resume-zoom="in"]'), 'click', () => setZoom(targetZoom * 1.25));
  listen(fit, 'click', () => setZoom(1));
  listen(pageButton, 'click', () => setMode('page')); listen(textButton, 'click', () => setMode('text'));
  listen(paper, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault(); setZoom(event.key === '0' ? 1 : targetZoom * (event.key === '-' ? .8 : 1.25));
    }
  });
  listen(viewport, 'wheel', event => {
    if (!event.ctrlKey || phase !== 'reading') return;
    event.preventDefault(); setZoom(targetZoom * Math.exp(-event.deltaY * .002), event.clientX, event.clientY);
  }, { passive: false });
  listen(viewport, 'pointerdown', event => {
    if (mode !== 'page' || phase !== 'reading' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging');
    viewport.focus({ preventScroll: true }); event.preventDefault();
  });
  listen(viewport, 'pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    viewport.scrollLeft = drag.left - event.clientX + drag.x; viewport.scrollTop = drag.top - event.clientY + drag.y;
  });
  listen(viewport, 'pointerup', release); listen(viewport, 'pointercancel', release); listen(viewport, 'lostpointercapture', release);
  function finishClose() { canonical(); resolveClose?.(); resolveClose = null; }
  listen(window, 'resize', () => {
    const oldWidth = parseFloat(image.style.width) || fittedWidth(), y = viewport.scrollTop / oldWidth, x = viewport.scrollLeft / oldWidth;
    generation++; stopEffects();
    if (phase === 'closing') { finishClose(); return; }
    const wasOpening = phase === 'opening';
    if (wasOpening) { phase = 'reading'; paper.classList.remove('is-morphing'); }
    targetZoom = zoom;
    paint();
    if (wasOpening && window.innerWidth < 640) setMode('text');
    if (phase === 'reading' && mode === 'page') { viewport.scrollTop = y * fittedWidth() * zoom; viewport.scrollLeft = x * fittedWidth() * zoom; }
  });
  canonical();
  return {
    isReading: () => phase === 'reading',
    isExpanded: () => phase !== 'landing',
    isZoomed: () => zoom > 1.001,
    getState: () => ({ phase, mode, zoom, targetZoom }),
    async expand() {
      if (disposed || phase !== 'landing' || closePromise) return;
      const token = ++generation, from = image.getBoundingClientRect();
      phase = 'opening'; paper.classList.add('is-expanded', 'is-morphing'); paint(); viewport.scrollTo(0, 0);
      void animate(paper, [{ backgroundColor: 'transparent' }, { backgroundColor: '#11151b' }], 320);
      await morph(from, 360);
      if (disposed || token !== generation) return;
      phase = 'reading'; paper.classList.remove('is-morphing'); paint();
      if (window.innerWidth < 640) setMode('text');
    },
    resetForClose() {
      if (closePromise) return closePromise;
      closePromise = new Promise(resolve => { resolveClose = resolve; });
      const token = ++generation, wasText = mode === 'text';
      const view = viewport.getBoundingClientRect(), width = fittedWidth();
      const from = wasText ? { left: view.left + pad(), top: view.top + pad(), width, height: width * 22 / 17 } : image.getBoundingClientRect();
      stopEffects(); canonical(); phase = 'closing'; paper.classList.add('is-morphing');
      morph(from, 300, wasText).then(() => { if (!disposed && token === generation) finishClose(); });
      return closePromise;
    },
    dispose() { disposed = true; generation++; events.abort(); stopEffects(); canonical(); resolveClose?.(); },
  };
}
