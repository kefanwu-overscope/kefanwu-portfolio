import { createStudioInspector } from '../../studio-inspector.js';

const keys = ['steering', 'vineRobot', 'javelin', 'scanner', 'brakeSim', 'aura', 'carbonSeat', 'seat', 'materialTest', 'ansysCfd', 'pool', 'lineFollower', 'formlabs', 'telecaster', 'education', 'ftc'];
const canvas = document.querySelector('#canvas');
const status = document.querySelector('#status');
const output = document.querySelector('#report');
const result = document.querySelector('#result');
const picker = document.querySelector('#project');
const slider = document.querySelector('#progress');
for (const key of keys) picker.add(new Option(key, key));
const reports = [];
const statuses = [];
const inspector = createStudioInspector({ canvas,
  manifestUrl: (key) => `../../assets/studio-motion/${key}/manifest.json`,
  onStatus(value) { status.textContent = `${value.key || ''}: ${value.message || value.state}`; statuses.push({ key: value.key, state: value.state, milliseconds: value.loadMilliseconds }); },
  onProgress(value) { slider.value = value; },
  onPlaybackChange({ playing }) { document.querySelector('#play').textContent = playing ? 'Pause' : 'Play'; },
  onPartSelect(value) { status.textContent = `${value.key}: ${value.group || value.name}`; },
});
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const painted = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const check = (condition, message) => { if (!condition) throw new Error(message); };
const cameraKey = () => inspector.getState().camera;
const cameraEqual = (a, b) => ['position', 'target', 'up'].every((key) => a[key].every((value, index) => Math.abs(value - b[key][index]) < 1e-8)) && a.zoom === b.zoom;
function report() { output.textContent = JSON.stringify({ status: result.dataset.state || 'manual', projects: reports, statuses }, null, 2); }
async function load(key) { picker.value = key; const loaded = await inspector.selectProject(key); await painted(); check(loaded && inspector.getState().state === 'ready', `${key} failed to load`); return loaded; }

document.querySelector('#load').onclick = () => load(picker.value).catch((error) => { result.textContent = error.message; });
slider.oninput = () => { inspector.pause(); inspector.setProgress(Number(slider.value)); };
document.querySelector('#play').onclick = () => inspector.getState().playing ? inspector.pause() : inspector.play({ direction: 1 });
document.querySelector('#reverse').onclick = () => inspector.play({ direction: -1 });
document.querySelector('#reset').onclick = () => inspector.reset();
document.querySelector('#view').onclick = () => inspector.setView('side');
document.querySelector('#compact').onclick = () => { document.body.classList.toggle('compact'); inspector.resize(); };
document.querySelector('#context').onclick = () => {
  const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
  if (extension) { extension.loseContext(); setTimeout(() => extension.restoreContext(), 600); }
};

async function run() {
  document.querySelector('#run').disabled = true;
  reports.length = 0; statuses.length = 0;
  result.textContent = 'Running actual WebGL assets…'; result.dataset.state = 'running';
  try {
    for (const key of keys) {
      result.textContent = `Checking ${key} (${reports.length + 1}/${keys.length})…`;
      const started = performance.now();
      await load(key);
      const view = cameraKey();
      for (const p of [0, 0.17, 0.5, 1, 0.731, 0.17, 0]) {
        inspector.setProgress(p); await painted();
        check(inspector.getState().progress === p, `${key}: progress mismatch`);
        check(cameraEqual(cameraKey(), view), `${key}: seeking moved the camera`);
      }
      inspector.setProgress(0.4); inspector.setView('side'); await painted();
      check(inspector.getState().progress === 0.4, `${key}: camera view changed motion`);
      inspector.reset(); await painted();
      check(inspector.getState().progress === 0, `${key}: reset failed`);
      const state = inspector.getState();
      check(state.drawCalls > 0 && state.triangles > 0, `${key}: empty draw`);
      check(state.cache.entries <= 2, `${key}: resource cache exceeded two projects`);
      reports.push({ key, status: 'passed', milliseconds: Math.round(performance.now() - started), cache: state.cache,
        gpuObjects: state.objects, drawCalls: state.drawCalls, triangles: state.triangles, meanRenderMilliseconds: state.renderMilliseconds });
      reports[reports.length - 1].sourceShaders = state.sourceShaders;
      report();
    }
    // A superseded, uncached download must never install over the latest key.
    const requests = [inspector.selectProject('steering'), inspector.selectProject('vineRobot'), inspector.selectProject('education')];
    await Promise.all(requests); await painted();
    check(inspector.getState().key === 'education' && inspector.getState().state === 'ready', 'Rapid switch installed a stale project');
    inspector.setProgress(0.4); inspector.play({ direction: 1 }); await wait(120); inspector.pause();
    check(inspector.getState().progress > 0.4, 'Forward playback failed');
    const forward = inspector.getState().progress;
    inspector.play({ direction: -1 }); await wait(120); inspector.pause();
    check(inspector.getState().progress < forward, 'Reverse playback failed');
    inspector.setActive(false);
    const sleepingFrames = inspector.getState().renderedFrames;
    await wait(120);
    check(inspector.getState().renderedFrames === sleepingFrames, 'Inactive renderer kept drawing');
    inspector.setActive(true); inspector.reset(); await painted();
    result.textContent = 'Passed: 16 assets, forward/reverse/random seek, independent camera, rapid switching, bounded cache, and inactive sleep.';
    result.dataset.state = 'passed';
  } catch (error) {
    result.textContent = `FAILED: ${error.message}`; result.dataset.state = 'failed';
    reports.push({ status: 'failed', message: error.message });
  } finally { document.querySelector('#run').disabled = false; report(); }
}
document.querySelector('#run').onclick = run;
window.addEventListener('pagehide', () => inspector.setActive(false));
window.addEventListener('pageshow', () => inspector.setActive(true));
if (new URL(location.href).searchParams.get('run') === '1') run();
else load('steering').catch((error) => { result.textContent = error.message; });
