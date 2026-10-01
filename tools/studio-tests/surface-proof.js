import { createStudioInspector } from '../../studio-inspector.js';

const result = document.querySelector('#result');
const output = document.querySelector('#report');
const checks = [];
const statusEvents = [];
const viewers = ['integrated', 'default'].map(id => {
  const canvas = document.querySelector(`#${id}`);
  const inspector = createStudioInspector({ canvas, ...(id === 'integrated' ? { transparentBackground: true } : {}),
    onStatus: event => statusEvents.push({ id, state: event.state, motionReady: event.motionReady }),
  });
  return { id, canvas, inspector };
});
const check = (condition, message) => { if (!condition) throw new Error(message); };

function captureFreshFrame({ id, canvas, inspector }) {
  return new Promise((resolve, reject) => {
    // resize() invalidates even when dimensions are unchanged. Its render RAF
    // is registered before this reader, so readPixels runs after the fresh
    // draw but before presentation discards preserveDrawingBuffer:false data.
    inspector.resize();
    requestAnimationFrame(() => {
      try {
        const gl = canvas.getContext('webgl2');
        check(gl, `${id}: missing WebGL2 context`);
        const attributes = gl.getContextAttributes();
        const width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        check(gl.getError() === gl.NO_ERROR, `${id}: pixel read failed`);
        let zeroAlphaPixels = 0, solidAlphaPixels = 0, coloredSolidPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i + 3] === 0) zeroAlphaPixels++;
          if (pixels[i + 3] === 255) {
            solidAlphaPixels++;
            if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 60) coloredSolidPixels++;
          }
        }
        const cornerPixels = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]]
          .map(([x, y]) => Array.from(pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)));
        const state = inspector.getState();
        resolve({ id, width, height, alphaContext: attributes.alpha, preserveDrawingBuffer: attributes.preserveDrawingBuffer,
          zeroAlphaPixels, solidAlphaPixels, coloredSolidPixels, cornerPixels, progress: state.progress,
          camera: state.camera, motionPose: state.motionPose, motionDuration: state.motionDuration,
          triangles: state.triangles, drawCalls: state.drawCalls, renderedFrames: state.renderedFrames });
      } catch (error) { reject(error); }
    });
  });
}

async function run() {
  try {
    for (const viewer of viewers) {
      const loaded = await viewer.inspector.selectProject('steering');
      check(loaded, `${viewer.id}: source model did not load`);
      await loaded.whenMotionReady;
      check(viewer.inspector.getState().motionReady, `${viewer.id}: motion is unavailable`);
    }
    for (const progress of [0, .27, .73, 1]) {
      viewers.forEach(viewer => viewer.inspector.setProgress(progress));
      const [integrated, solid] = await Promise.all(viewers.map(captureFreshFrame));
      checks.push({ progress, integrated, default: solid });
      // Three r185 always allocates alpha-enabled WebGL contexts. Its alpha
      // option chooses the clear behavior; actual opaque output is checked
      // below for EVERY pixel, rather than inferred from context metadata.
      check(integrated.alphaContext === true && solid.alphaContext === true, 'WebGL buffers lack their expected alpha channel');
      check(!integrated.preserveDrawingBuffer && !solid.preserveDrawingBuffer, 'Proof must use production buffer behavior');
      check(integrated.zeroAlphaPixels > integrated.width * integrated.height * .25, 'Integrated surface has an opaque empty region');
      check(integrated.solidAlphaPixels > 1000 && integrated.coloredSolidPixels > 1000, 'Integrated model pixels were not drawn');
      check(integrated.cornerPixels.every(pixel => pixel.every(channel => channel === 0)), 'Integrated corner pixels must be transparent RGBA zero');
      check(solid.zeroAlphaPixels === 0 && solid.solidAlphaPixels === solid.width * solid.height, 'Default inspector lost its solid background');
      check(solid.cornerPixels.every(pixel => pixel[3] === 255), 'Default corners must remain opaque');
      check(integrated.triangles > 0 && integrated.triangles === solid.triangles, 'Surfaces drew different source geometry');
      check(JSON.stringify(integrated.camera) === JSON.stringify(solid.camera), 'Transparency changed the model camera');
      check(integrated.progress === progress && solid.progress === progress, 'Capture did not follow the applied pose');
      const degrees = integrated.motionPose.wheelRadians * 180 / Math.PI;
      const expectedDegrees = progress === .27 ? -90 : progress === .73 ? 90 : 0;
      check(Math.abs(degrees - expectedDegrees) < 1e-8, 'Displayed steering input does not match the signed motion phase');
      check(integrated.motionDuration === 14 && solid.motionDuration === 14, 'Steering duration must retain the extended 14-second cycle');
    }
    result.dataset.state = 'passed';
    result.textContent = 'Passed: actual alpha-zero background pixels, visible source geometry, unchanged camera, and default solid background at four poses.';
  } catch (error) {
    result.dataset.state = 'failed';
    result.textContent = `Failed: ${error.message}`;
  }
  window.surfaceProof = { status: result.dataset.state, message: result.textContent, checks, statusEvents };
  output.textContent = JSON.stringify(window.surfaceProof, null, 2);
}

window.addEventListener('pagehide', () => viewers.forEach(viewer => viewer.inspector.dispose()), { once: true });
void run();
