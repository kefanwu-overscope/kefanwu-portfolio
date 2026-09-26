import { getStudioProject } from './studio-catalog.js?v=studio-20260919';

const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const steeringParts = {
  fixed_frame: ['Bearing supports', 'The fixed supports locate the shafts while the steering column turns.'],
  wheel_and_upper_shaft: ['Wheel & upper shaft', 'The steering input turns the upper column, within the illustrated 90° limit.'],
  middle_shaft_and_yokes: ['Universal joints & middle shaft', 'The joints pass rotation through the angled steering column. Their phasing is part of the kinematic design.'],
  lower_shaft_and_yoke: ['Lower shaft', 'The lower column carries rotation into the rack-and-pinion input.'],
  rack_and_tie_rod_ends: ['Rack & tie-rod ends', 'Pinion rotation becomes linear rack travel. The confirmed NARRco rate is 4.0 in per revolution.'],
};

let mounted = false;

function mount() {
  if (mounted || document.body.dataset.caseMode !== 'studio') return;
  const key = document.body.dataset.project;
  const project = getStudioProject(key);
  const host = document.querySelector('.case-animation-host[data-project]');
  const viewport = host?.querySelector('.card-media');
  if (!project || !viewport || host.dataset.project !== key) return;
  mounted = true;
  window.removeEventListener('project-previews-ready', mount);

  const events = new AbortController();
  const listen = (node, type, listener, options = {}) => node.addEventListener(type, listener, { ...options, signal: events.signal });
  const poster = viewport.querySelector('img');
  const canvas = document.createElement('canvas');
  canvas.id = 'case-3d-canvas';
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', `${project.name}. Drag to rotate; scroll or pinch to zoom. Use the controls below to explore ${project.motionLabel.toLowerCase()}.`);
  canvas.setAttribute('aria-describedby', 'preview-instructions');
  const annotation = document.createElement('div');
  annotation.id = 'case-3d-annotation';
  annotation.className = 'case-3d-annotation';
  annotation.hidden = true;
  annotation.setAttribute('role', 'status');
  const statusBox = document.createElement('div');
  statusBox.className = 'case-3d-status';
  statusBox.innerHTML = '<span id="case-3d-status" role="status" aria-live="polite">Loading interactive model…</span><button type="button" id="case-3d-retry" hidden>Retry model</button>';
  viewport.classList.add('case-3d-viewport');
  viewport.append(canvas, annotation, statusBox);

  const controls = document.createElement('div');
  controls.className = 'case-3d-controls';
  controls.setAttribute('aria-label', 'Model controls');
  controls.innerHTML = `
    <div class="case-3d-buttons">
      <button type="button" id="case-3d-play" aria-pressed="false" disabled>Play</button>
      <button type="button" id="case-3d-reverse" aria-pressed="false" disabled>Reverse</button>
      <button type="button" id="case-3d-reset" disabled>Reset</button>
      <label class="case-3d-view"><span class="sr-only">Standard model view</span><select id="case-3d-view" disabled><option value="source">Original view</option><option value="front">Front view</option><option value="side">Side view</option><option value="top">Top view</option><option value="iso">Isometric view</option></select></label>
    </div>
    <div class="case-3d-timeline">
      <div class="case-3d-timeline-labels"><label for="case-3d-progress"></label><output id="case-3d-value" for="case-3d-progress">0%</output></div>
      <input type="range" id="case-3d-progress" min="0" max="1000" step="1" value="0" aria-valuetext="0 percent" disabled>
      <p class="case-3d-hint" id="case-3d-hint" role="status">Preparing model…</p>
      <button type="button" id="case-3d-retry-motion" hidden>Retry animation</button>
    </div>`;
  const legend = document.createElement('div');
  legend.id = 'case-3d-legend';
  legend.className = 'case-3d-legend';
  legend.hidden = true;
  viewport.after(controls, legend);

  const find = (id) => host.querySelector(`#case-3d-${id}`);
  const play = find('play');
  const reverse = find('reverse');
  const reset = find('reset');
  const view = find('view');
  const range = find('progress');
  const value = find('value');
  const hint = find('hint');
  const statusText = find('status');
  const retry = find('retry');
  const retryMotion = find('retry-motion');
  const timeline = controls.querySelector('.case-3d-timeline');
  timeline.querySelector('label').textContent = project.motionLabel;

  let inspector = null;
  let request = null;
  let generation = 0;
  let disposed = false;
  let suspended = false;
  let lightboxOpen = false;
  let inViewport = false;
  let modelLoaded = false;
  let modelDrawn = false;
  let modelState = 'loading';
  let motionReady = false;
  let motionError = false;
  let motionRetryInFlight = false;
  let playing = false;
  let direction = 1;
  let progress = 0;
  let progressFrame = 0;
  let revealFrame = 0;
  let minimumDrawnFrames = 0;
  let lastProgressPaint = -Infinity;
  let paintedStep = -1;
  let paintedPercent = -1;
  let legendManifest = null;

  function setText(node, text) {
    if (node.textContent !== text) node.textContent = text;
  }

  function setPlaying(nextPlaying, nextDirection = direction) {
    playing = Boolean(nextPlaying);
    direction = nextDirection;
    play.setAttribute('aria-pressed', String(playing && direction !== -1));
    reverse.setAttribute('aria-pressed', String(playing && direction === -1));
    setText(play, playing ? 'Pause' : 'Play');
    setText(reverse, playing && direction === -1 ? 'Pause reverse' : 'Reverse');
  }

  function paintProgress(time) {
    progressFrame = 0;
    if (disposed || suspended || document.hidden) return;
    // Only the control UI is capped; the source mechanism keeps its own cadence.
    if (playing && time - lastProgressPaint < 1000 / 30 && progress !== 0 && progress !== 1) {
      progressFrame = requestAnimationFrame(paintProgress);
      return;
    }
    lastProgressPaint = time;
    const step = Math.round(progress * 1000);
    const percent = Math.round(progress * 100);
    if (step !== paintedStep) {
      if (range.value !== String(step)) range.value = String(step);
      range.style.setProperty('--progress', `${step / 10}%`);
      paintedStep = step;
    }
    if (percent !== paintedPercent) {
      setText(value, `${percent}%`);
      range.setAttribute('aria-valuetext', `${percent} percent`);
      paintedPercent = percent;
    }
  }

  function setProgress(next) {
    progress = clamp(next);
    if (!progressFrame && !disposed && !suspended && !document.hidden) progressFrame = requestAnimationFrame(paintProgress);
  }

  function canRender() {
    return !disposed && !suspended && !document.hidden && !lightboxOpen && inViewport;
  }

  function updateControls() {
    const ready = modelState === 'ready' && modelLoaded;
    const availableMotion = ready && motionReady;
    play.disabled = reverse.disabled = range.disabled = !availableMotion;
    reset.disabled = view.disabled = !ready;
    viewport.dataset.motionReady = String(availableMotion);
    timeline.dataset.ready = String(availableMotion);
    retry.hidden = modelState !== 'error' && modelState !== 'context-lost';
    retryMotion.hidden = !ready || !motionError;
    setText(hint, availableMotion ? 'Drag or scroll here to move forward and back' :
      ready && motionError ? 'Animation unavailable. You can still rotate the model.' :
        ready ? 'Loading animation… You can rotate the model.' :
          modelState === 'error' ? 'The project images and full story are available below.' : 'Preparing model…');
    if (!availableMotion) setPlaying(false);
  }

  function showCover(state, message) {
    modelDrawn = false;
    viewport.dataset.status = state;
    viewport.setAttribute('aria-busy', String(state === 'loading'));
    poster?.setAttribute('aria-hidden', 'false');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.tabIndex = -1;
    statusBox.hidden = false;
    setText(statusText, message);
  }

  function cancelReveal() {
    cancelAnimationFrame(revealFrame);
    revealFrame = 0;
  }

  function revealWhenDrawn(attempts = 3) {
    if (revealFrame || modelDrawn || !modelLoaded || modelState !== 'ready' || !canRender()) return;
    const ticket = generation;
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      if (ticket !== generation || modelDrawn || modelState !== 'ready' || !canRender()) return;
      const state = inspector?.getState();
      if (state?.key === key && state.renderedFrames >= minimumDrawnFrames) {
        // Never uncover an empty WebGL buffer just because a fetch completed.
        modelDrawn = true;
        viewport.dataset.status = 'ready';
        viewport.setAttribute('aria-busy', 'false');
        poster?.setAttribute('aria-hidden', 'true');
        canvas.setAttribute('aria-hidden', 'false');
        canvas.tabIndex = 0;
        statusBox.hidden = true;
        setText(statusText, 'Ready to explore');
      } else if (attempts > 1) revealWhenDrawn(attempts - 1);
    });
  }

  function updatePressureLegend(manifest) {
    if (legendManifest === manifest) return;
    legendManifest = manifest;
    const report = manifest?.source?.motionReport;
    const scale = report?.pressureColorNormalization;
    if (key !== 'ansysCfd' || !scale?.linearRgbAnchors || !report.pressureRangePa) return;
    const srgb = (channel) => Math.round(255 * (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055));
    // Preserve the solved field's linear-RGB transfer and nonlinear ticks.
    const gradient = Array.from({ length: 65 }, (_, i) => {
      const position = i / 64;
      const end = Math.min(scale.positions.length - 1, Math.max(1, scale.positions.findIndex((entry) => entry >= position)));
      const start = end - 1;
      const mix = (position - scale.positions[start]) / (scale.positions[end] - scale.positions[start]);
      const color = scale.linearRgbAnchors[start].slice(0, 3).map((channel, j) => channel + mix * (scale.linearRgbAnchors[end][j] - channel));
      return `rgb(${color.map(srgb).join(',')}) ${position * 100}%`;
    });
    const heading = document.createElement('p');
    heading.textContent = 'Gauge pressure · Pa';
    const bar = document.createElement('div');
    bar.className = 'case-3d-legend-bar';
    bar.style.background = `linear-gradient(90deg,${gradient.join(',')})`;
    const labels = document.createElement('div');
    labels.className = 'case-3d-legend-ticks';
    const [minimum, maximum] = report.pressureRangePa;
    for (const pressure of scale.legendTicksPa) {
      const normalized = pressure < 0 ? .5 - .5 * Math.asinh(-pressure / scale.scalePa) / Math.asinh(-minimum / scale.scalePa) : .5 + .5 * Math.asinh(pressure / scale.scalePa) / Math.asinh(maximum / scale.scalePa);
      const label = document.createElement('span');
      label.style.left = `${normalized * 100}%`;
      label.textContent = Math.round(pressure).toLocaleString('en-US');
      labels.append(label);
    }
    const note = document.createElement('small');
    note.textContent = 'Nonlinear scale · Steady solved field';
    legend.replaceChildren(heading, bar, labels, note);
    legend.hidden = false;
  }

  function receiveStatus(status) {
    if (status.key && status.key !== key) return;
    modelState = status.state;
    if (status.state === 'ready') {
      if (!modelLoaded || !modelDrawn) {
        if (!modelLoaded || !minimumDrawnFrames) minimumDrawnFrames = (inspector?.getState().renderedFrames || 0) + 1;
        modelLoaded = true;
      }
      motionReady = status.motionReady === true;
      motionError = status.motionError === true;
      if (motionReady || motionError) motionRetryInFlight = false;
      updatePressureLegend(status.manifest);
      revealWhenDrawn();
    } else {
      cancelReveal();
      motionReady = false;
      motionError = false;
      minimumDrawnFrames = 0;
      if (status.state !== 'context-lost') modelLoaded = false;
      const message = status.state === 'context-lost' ? 'The 3D view was interrupted. Restoring the model…' :
        status.state === 'error' ? 'The interactive model could not load. Retry, or explore the project below.' : 'Loading interactive model…';
      showCover(status.state, message);
    }
    updateControls();
  }

  function syncActivity() {
    inspector?.setActive(canRender());
    if (canRender()) {
      setProgress(progress);
      revealWhenDrawn();
    } else cancelReveal();
  }

  function measureVisibility() {
    const box = viewport.getBoundingClientRect();
    inViewport = box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth;
  }

  async function loadModel() {
    const ticket = ++generation;
    request?.abort();
    inspector?.dispose();
    inspector = null;
    cancelReveal();
    request = new AbortController();
    const signal = request.signal;
    modelLoaded = false;
    motionRetryInFlight = false;
    minimumDrawnFrames = 0;
    annotation.hidden = true;
    legend.hidden = true;
    legendManifest = null;
    view.value = 'source';
    setProgress(0);
    receiveStatus({ state: 'loading' });
    const current = () => ticket === generation && !disposed && !suspended;
    try {
      const { createStudioInspector } = await import('./studio-inspector.js?v=performance-20260919');
      if (!current() || signal.aborted) return;
      inspector = createStudioInspector({
        canvas,
        onStatus: (status) => { if (current()) receiveStatus(status); },
        onProgress: (next) => {
          if (!current()) return;
          setProgress(next);
          revealWhenDrawn();
        },
        onPlaybackChange: (state) => { if (current()) setPlaying(state.playing, state.direction); },
        onPartSelect: ({ key: selectedKey, group }) => {
          if (!current() || selectedKey !== key || key !== 'steering' || !steeringParts[group]) return;
          const [title, description] = steeringParts[group];
          const heading = document.createElement('strong');
          heading.textContent = title;
          const text = document.createElement('p');
          text.textContent = description;
          annotation.replaceChildren(heading, text);
          annotation.hidden = false;
        },
      });
      syncActivity();
      await inspector.selectProject(key, { signal });
      if (current() && !signal.aborted) revealWhenDrawn();
    } catch (error) {
      if (!current() || signal.aborted || error.name === 'AbortError') return;
      console.error('[case-3d] Project unavailable', key, error);
      inspector?.setActive(false);
      receiveStatus({ state: 'error' });
    }
  }

  function seek(next) {
    if (!motionReady) return;
    inspector?.pause();
    setProgress(next);
    inspector?.setProgress(progress);
  }

  function togglePlay() {
    if (!motionReady) return;
    if (playing) inspector?.pause();
    else inspector?.play({ direction: 1 });
  }

  function retryAnimation() {
    if (!inspector || motionReady || motionRetryInFlight) return;
    // The runtime's retry API owns its own fetch rather than the initial
    // selection signal. Track it so a later pagehide can cancel it by disposal.
    motionRetryInFlight = true;
    void inspector.retryMotion();
  }

  listen(play, 'click', togglePlay);
  listen(reverse, 'click', () => {
    if (!motionReady) return;
    if (playing && direction === -1) inspector?.pause();
    else inspector?.play({ direction: -1 });
  });
  listen(reset, 'click', () => {
    inspector?.reset({ camera: true });
    view.value = 'source';
    annotation.hidden = true;
    setProgress(0);
  });
  listen(view, 'change', () => inspector?.setView(view.value));
  listen(retry, 'click', () => { void loadModel(); });
  listen(retryMotion, 'click', retryAnimation);
  listen(range, 'input', () => seek(Number(range.value) / 1000));
  // Arrow, Home and End keys use the range input's native accessible behavior.
  listen(range, 'keydown', (event) => {
    if (event.key !== ' ' || !motionReady) return;
    event.preventDefault();
    togglePlay();
  });
  listen(timeline, 'wheel', (event) => {
    if (!motionReady || event.ctrlKey || event.target.closest('button')) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
    const next = clamp(progress + delta * .0007);
    if (next === progress) return;
    event.preventDefault();
    seek(next);
  }, { passive: false });
  listen(document, 'visibilitychange', syncActivity);
  listen(window, 'case-lightbox-state', (event) => {
    lightboxOpen = Boolean(event.detail?.open);
    syncActivity();
  });

  const observer = new IntersectionObserver((entries) => {
    inViewport = entries[0].isIntersecting && entries[0].intersectionRatio > 0;
    syncActivity();
  });
  observer.observe(viewport);

  function suspendProject(persisted) {
    if (disposed) return;
    suspended = true;
    request?.abort();
    inspector?.setActive(false);
    setPlaying(false);
    cancelReveal();
    cancelAnimationFrame(progressFrame);
    progressFrame = 0;
    if (persisted && motionRetryInFlight) {
      // A retry does not share request.signal. Disposing an unfinished retry
      // avoids a hidden completion whose ready event the cached page misses.
      generation += 1;
      inspector?.dispose();
      inspector = null;
      modelLoaded = false;
      motionRetryInFlight = false;
      receiveStatus({ state: 'loading' });
    }
    if (!persisted) {
      disposed = true;
      generation += 1;
      observer.disconnect();
      events.abort();
      inspector?.dispose();
      inspector = null;
    }
  }
  listen(window, 'pagehide', (event) => suspendProject(event.persisted));
  listen(window, 'studio-project-dispose', () => suspendProject(false));
  listen(window, 'pageshow', (event) => {
    if (!event.persisted || disposed) return;
    suspended = false;
    measureVisibility();
    if (!inspector || !modelLoaded) {
      void loadModel();
    } else {
      syncActivity();
      // The visible pose and camera survive BFCache; cancelled progressive
      // animation loading gets a new task only after the page comes back.
      if (!motionReady && !motionError) retryAnimation();
    }
  });

  measureVisibility();
  void loadModel();
}

window.addEventListener('project-previews-ready', mount);
mount();
