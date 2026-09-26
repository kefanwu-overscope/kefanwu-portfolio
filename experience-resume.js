import { RESUME_ASSET } from './experience-resume-assets.js';
import { resumeAccessibleHTML } from './experience-resume-content.js';

export { RESUME_ASSET };
export const RESUME_PAPER = Object.freeze({ width: .234, height: .234 * 22 / 17, thickness: .00025, bottom: .76695 });

export function resumeHTML() {
  const pdf = `${RESUME_ASSET.source}?v=${RESUME_ASSET.sourceSha256.slice(0, 12)}`;
  return `<div class="exp-sheet__toolbar" aria-label="Résumé controls">
    <a href="${pdf}" target="_blank" rel="noopener" class="exp-sheet__pdf" aria-label="Open résumé PDF in a new tab"><span class="exp-sheet__open-label">Open </span>PDF ↗</a>
    <a href="${pdf}" download="Kefan-Wu-Resume.pdf" class="exp-sheet__download" aria-label="Download résumé PDF" title="Download PDF">↓</a>
    <div class="exp-sheet__zoom" role="group" aria-label="Résumé zoom">
      <button type="button" data-resume-zoom="out" aria-label="Zoom out résumé" disabled>−</button>
      <button type="button" data-resume-zoom="fit" aria-label="Fit résumé to page" title="Fit page">Fit</button>
      <button type="button" data-resume-zoom="in" aria-label="Zoom in résumé">+</button>
    </div>
    <button type="button" class="exp-sheet__close" data-close aria-label="Close résumé">×</button>
  </div>
  <div class="exp-sheet__viewport" tabindex="0" role="region" aria-label="Résumé page; use zoom controls to read">
    <img class="exp-sheet__image" src="${RESUME_ASSET.preview}" width="${RESUME_ASSET.width}" height="${RESUME_ASSET.height}" alt="" draggable="false" decoding="async" crossorigin="anonymous">
  </div>
  <p class="exp-sheet__help">Zoom to read · Drag to pan</p>
  <div class="exp-sheet__accessible">${resumeAccessibleHTML()}</div>`;
}

// Zoom and pan only affect the reader. The permanent 3D print never changes
// with scroll position, viewport size, font loading, or reader magnification.
export function attachResumeReader(paper, { reducedMotion = false } = {}) {
  const viewport = paper.querySelector('.exp-sheet__viewport');
  const image = paper.querySelector('.exp-sheet__image');
  const fit = paper.querySelector('[data-resume-zoom="fit"]');
  const out = paper.querySelector('[data-resume-zoom="out"]');
  const zoomIn = paper.querySelector('[data-resume-zoom="in"]');
  const events = new AbortController();
  let zoom = 1, drag = null, resetPromise = null, resetFrame = 0, finishReset = null;
  const listen = (node, type, handler, options = {}) => node.addEventListener(type, handler, { ...options, signal: events.signal });
  function paint() {
    image.style.width = `${zoom * 100}%`;
    paper.classList.toggle('is-zoomed', zoom > 1.001);
    fit.textContent = zoom <= 1.001 ? 'Fit' : `${Math.round(zoom * 100)}%`;
    fit.setAttribute('aria-label', zoom <= 1.001 ? 'Résumé fits page' : `${Math.round(zoom * 100)} percent; fit résumé to page`);
    out.disabled = zoom <= 1.001; zoomIn.disabled = zoom >= 3;
  }
  function setZoom(value) {
    if (resetPromise) return;
    const next = Math.max(1, Math.min(3, value));
    const x = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom;
    const y = (viewport.scrollTop + viewport.clientHeight / 2) / zoom;
    zoom = next; paint();
    viewport.scrollLeft = zoom === 1 ? 0 : x * zoom - viewport.clientWidth / 2;
    viewport.scrollTop = zoom === 1 ? 0 : y * zoom - viewport.clientHeight / 2;
  }
  listen(out, 'click', () => setZoom(zoom - .5));
  listen(zoomIn, 'click', () => setZoom(zoom + .5));
  listen(fit, 'click', () => setZoom(1));
  listen(paper, 'keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault(); setZoom(event.key === '0' ? 1 : zoom + (event.key === '-' ? -.5 : .5));
    }
  });
  listen(viewport, 'wheel', event => {
    if (!event.ctrlKey) return;
    event.preventDefault(); setZoom(zoom + (event.deltaY < 0 ? .25 : -.25));
  }, { passive: false });
  listen(viewport, 'pointerdown', event => {
    if (zoom <= 1 || event.button !== 0 || resetPromise) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId); viewport.classList.add('is-dragging');
    viewport.focus({ preventScroll: true }); event.preventDefault();
  });
  listen(viewport, 'pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    viewport.scrollLeft = drag.left - (event.clientX - drag.x);
    viewport.scrollTop = drag.top - (event.clientY - drag.y);
  });
  const release = () => {
    const id = drag?.id; drag = null; viewport.classList.remove('is-dragging');
    if (id !== undefined && viewport.hasPointerCapture?.(id)) viewport.releasePointerCapture(id);
  };
  listen(viewport, 'pointerup', release); listen(viewport, 'pointercancel', release); listen(viewport, 'lostpointercapture', release);
  paint(); viewport.scrollTo(0, 0);
  return {
    isZoomed: () => zoom > 1.001,
    resetForClose() {
      if (resetPromise) return resetPromise;
      if (zoom <= 1.001 || reducedMotion) { zoom = 1; paint(); viewport.scrollTo(0, 0); return Promise.resolve(); }
      const initial = { zoom, x: viewport.scrollLeft, y: viewport.scrollTop }, start = performance.now();
      resetPromise = new Promise(resolve => { finishReset = resolve; });
      paper.classList.add('is-resetting'); release();
      const step = now => {
        const t = Math.min(1, (now - start) / 180), eased = 1 - (1 - t) ** 3;
        zoom = initial.zoom + (1 - initial.zoom) * eased; paint();
        viewport.scrollLeft = initial.x * (1 - eased); viewport.scrollTop = initial.y * (1 - eased);
        if (t < 1) resetFrame = requestAnimationFrame(step);
        else { resetFrame = 0; paper.classList.remove('is-resetting'); finishReset(); }
      };
      resetFrame = requestAnimationFrame(step); return resetPromise;
    },
    dispose() { events.abort(); cancelAnimationFrame(resetFrame); paper.classList.remove('is-resetting'); finishReset?.(); release(); },
  };
}
