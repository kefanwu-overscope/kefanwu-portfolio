import { createStudioUI } from './studio-ui.js?v=studio-20260919';
import { getStudioProject } from './studio-catalog.js?v=studio-20260919';

let inspector = null;
let inspectorPromise = null;
let selectedKey = '';
let mode = 'inspect';
let selection = 0;
let request = null;
let quality = 'auto';
let playing = false;
let direction = 1;

const ui = createStudioUI({
  onSelect: (key) => selectProject(key),
  onRoom: () => showRoom(),
  onProgress: (progress) => { inspector?.pause(); inspector?.setProgress(progress); },
  onTogglePlay: () => {
    if (playing) inspector?.pause();
    else { direction = 1; inspector?.play({direction}); }
  },
  onReverse: () => {
    if (playing && direction === -1) inspector?.pause();
    else { direction = -1; inspector?.play({direction}); }
  },
  onReset: () => inspector?.reset({camera: true}),
  onView: (view) => inspector?.setView(view),
  onRetry: () => selectProject(selectedKey, {history: false}),
  onQuality: (value) => {
    quality = value;
    inspector?.setQuality(value);
  },
});

const annotation = document.createElement('div');
annotation.className = 'studio-model-annotation';
annotation.hidden = true;
annotation.setAttribute('role', 'status');
ui.viewport.append(annotation);
const pressureLegend = document.createElement('div');
pressureLegend.className = 'studio-pressure-legend';
pressureLegend.hidden = true;
ui.viewport.append(pressureLegend);
const steeringParts = {
  fixed_frame: ['Bearing supports', 'The fixed supports locate the shafts while the steering column turns.'],
  wheel_and_upper_shaft: ['Wheel & upper shaft', 'The steering input turns the upper column, within the illustrated 90° limit.'],
  middle_shaft_and_yokes: ['Universal joints & middle shaft', 'The joints pass rotation through the angled steering column. Their phasing is part of the kinematic design.'],
  lower_shaft_and_yoke: ['Lower shaft', 'The lower column carries rotation into the rack-and-pinion input.'],
  rack_and_tie_rod_ends: ['Rack & tie-rod ends', 'Pinion rotation becomes linear rack travel. The confirmed NARRco rate is 4.0 in per revolution.'],
};

function updatePressureLegend(manifest) {
  const report = manifest?.source?.motionReport;
  const scale = report?.pressureColorNormalization;
  if (selectedKey !== 'ansysCfd' || !scale?.linearRgbAnchors || !report.pressureRangePa) return;
  const srgb = (value) => Math.round(255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055));
  // Match the solved surface's linear-RGB transfer, then encode for CSS.
  const gradient = Array.from({length: 65}, (_, i) => {
    const position = i / 64;
    const end = Math.min(scale.positions.length - 1, Math.max(1, scale.positions.findIndex((value) => value >= position)));
    const start = end - 1;
    const mix = (position - scale.positions[start]) / (scale.positions[end] - scale.positions[start]);
    const color = scale.linearRgbAnchors[start].slice(0,3).map((value, channel) => value + mix * (scale.linearRgbAnchors[end][channel] - value));
    return `rgb(${color.map(srgb).join(',')}) ${position*100}%`;
  });
  pressureLegend.replaceChildren();
  const heading = document.createElement('p'); heading.textContent = 'Gauge pressure · Pa';
  const bar = document.createElement('div'); bar.className = 'studio-pressure-legend__bar'; bar.style.background = `linear-gradient(90deg,${gradient.join(',')})`;
  const labels = document.createElement('div'); labels.className = 'studio-pressure-legend__ticks';
  const [minimum, maximum] = report.pressureRangePa;
  for (const value of scale.legendTicksPa) {
    const normalized = value < 0 ? .5 - .5 * Math.asinh(-value / scale.scalePa) / Math.asinh(-minimum / scale.scalePa) : .5 + .5 * Math.asinh(value / scale.scalePa) / Math.asinh(maximum / scale.scalePa);
    const label = document.createElement('span'); label.style.left = `${normalized * 100}%`; label.textContent = Math.round(value).toLocaleString('en-US'); labels.append(label);
  }
  const note = document.createElement('small'); note.textContent = 'Nonlinear scale · Steady solved field';
  pressureLegend.append(heading, bar, labels, note);
  pressureLegend.hidden = false;
}

function updateURL(key, replace = false) {
  const url = new URL(location.href);
  url.hash = key;
  if (url.href !== location.href) window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
}

function getInspector() {
  if (!inspectorPromise) {
    inspectorPromise = import('./studio-inspector.js?v=studio-20260919').then(({createStudioInspector}) => {
      inspector = createStudioInspector({
        canvas: ui.canvas,
        quality,
        onStatus: (status) => {
          if (mode !== 'inspect' || (status.key && status.key !== selectedKey)) return;
          if (status.state === 'ready') {
            const generation = selection;
            // Keep the source poster through the first real WebGL paint.
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (generation !== selection || mode !== 'inspect') return;
              ui.setStatus('ready', status.message);
              updatePressureLegend(status.manifest);
            }));
          } else if (status.state === 'error') {
            ui.setStatus('error', 'The model could not load. Retry, or explore the photos and full case study.');
          } else ui.setStatus(status.state === 'context-lost' ? 'error' : status.state, status.message);
        },
        onProgress: (progress) => { if (mode === 'inspect') ui.setProgress(progress); },
        onPlaybackChange: (state) => {
          playing = state.playing;
          direction = state.direction;
          ui.setPlaying(playing, direction);
        },
        onPartSelect: ({key, group}) => {
          if (key !== selectedKey || key !== 'steering' || !steeringParts[group]) return;
          const [title, description] = steeringParts[group];
          const heading = document.createElement('strong'); heading.textContent = title;
          const text = document.createElement('p'); text.textContent = description;
          annotation.replaceChildren(heading, text);
          annotation.hidden = false;
        },
      });
      return inspector;
    }).catch((error) => { inspectorPromise = null; throw error; });
  }
  return inspectorPromise;
}

async function selectProject(key, {history = true} = {}) {
  if (!getStudioProject(key)) return showRoom({history});
  const generation = ++selection;
  request?.abort();
  request = new AbortController();
  const signal = request.signal;
  mode = 'inspect';
  selectedKey = key;
  annotation.hidden = true;
  pressureLegend.hidden = true;
  inspector?.pause();
  ui.setMode(mode);
  ui.setProject(key);
  document.title = `${getStudioProject(key).name} — Kefan Wu 3D Studio`;
  if (history) updateURL(key);
  try {
    const viewer = await getInspector();
    if (generation !== selection || signal.aborted) return;
    viewer.setActive(true);
    await viewer.selectProject(key, {signal});
    if (generation !== selection || signal.aborted) return;
    viewer.resize();
  } catch (error) {
    if (generation !== selection || signal.aborted || error.name === 'AbortError') return;
    console.error('[studio] Project unavailable', key, error);
    ui.setStatus('error', 'This interactive model could not load. Retry, or explore the photos and full case study.');
  }
}

function showRoom({replace = false} = {}) {
  ++selection;
  request?.abort();
  inspector?.setActive(false);
  const url = 'experience.html?return=project';
  if (replace) location.replace(url);
  else location.assign(url);
}

function route() {
  let key = '';
  try { key = decodeURIComponent(location.hash.slice(1)); } catch {}
  if (getStudioProject(key)) void selectProject(key, {history: false});
  else showRoom({replace: true});
}
window.addEventListener('popstate', route);
window.addEventListener('hashchange', () => {
  const key = location.hash.slice(1);
  if ((mode === 'inspect' && key === selectedKey) || (mode === 'room' && !key)) return;
  route();
});
window.addEventListener('pagehide', () => inspector?.setActive(false));
window.addEventListener('pageshow', (event) => {
  // Leaving during fetch or the first-paint handoff invalidates that selection.
  // A cached document needs a fresh selection before its poster can disappear.
  if (event.persisted && request?.signal.aborted && ui.viewport.dataset.status !== 'ready') {
    void selectProject(selectedKey, {history: false});
  } else if (mode === 'inspect') inspector?.setActive(true);
});
route();
