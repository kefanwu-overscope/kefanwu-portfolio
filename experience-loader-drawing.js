import * as THREE from "three";

/**
 * The default startup screen again since 2026-11-03 (F32/RS1: finished at the
 * assets boundary and held through the compile with the room's loop parked, it
 * passes the F29 gate; experience.html?loader=classic or ?draw=off keep the
 * classic card). It was opt-in on 2026-10-28 while it still drew frames during
 * the compile.
 *
 * "Drawn, then built" (2026-10-27), studio startup (#5): while the room's
 * materials, lightmaps and shaders get ready, the startup screen shows the
 * room itself as a line drawing, at the exact pose the room will be revealed
 * at (the intro's first frame, the rest pose under reduced motion, or a saved
 * return pose). Warm-white silhouettes and folds on the startup screen's dark
 * paper, inked part by part as each part's geometry REALLY arrives in the
 * scene. When the lit room's first frame is ready it develops through the
 * drawing: the paper veil lifts and the lines retire as the light arrives,
 * straight into the intro.
 *
 * Technique (the line pass behind the detail pages' drawings, rebuilt for a
 * perspective room on dark paper): a cheap prepass stores view normals and a part number per
 * pixel (with depth); a resolve pass finds outlines (part changes, inverse-
 * depth breaks) and folds (normal turns) once per prepass; a composite pass
 * inks them by part. The prepass draws its own scene of proxies that share
 * the room's geometry (never the room's materials, lights or state). Its four
 * small programs link in parallel from the room's construction, well before
 * the room's compile; a drawing still linking when the compile is about to
 * start gives way to today's screen (it would read its links mid-compile).
 * Every buffer it uploads is one the room's first frame would upload anyway,
 * uploaded as the models arrive; from the compile to the room's first frame
 * it uploads nothing. The static furniture the room merges into batches keeps
 * its source proxies (registered just before the merge: same place, same
 * lines); those source buffers are freed when the drawing ends.
 *
 * - Ink follows arrival, the real progress of this screen (2026-11-04, NF-S1):
 *   a part is released as soon as its geometry is in the scene and in the
 *   prepass. It used to wait for the startup percentage, which counts finished
 *   files: at 40 ms/20 Mbps the geometry already in the scene waited 2.8 s on
 *   dark paper (9 s from navigation at 100 ms/8 Mbps). So nothing is ever drawn
 *   before it is there, and nothing that is there waits. The first parts on the
 *   paper (the room built at 'live') and parts arriving together catch up over
 *   CATCH_UP_MS; the last of an arrival draws itself in over INK_MS (stroke
 *   ease), sweeping across its own screen box. The percentage stays the title
 *   block's number.
 * - Drawn, then held (2026-10-29, F32/RS1): at the room's assets boundary
 *   (capture(), before the static batching, the texture uploads and the
 *   shader compile) the drawing is finished in one task: its last prepass,
 *   the frame on screen copied to a cover canvas, the complete drawing
 *   composited under it. The cover then wipes away left to right over
 *   COVER_MS on the compositor (two counter-moving transforms), so what was
 *   still to ink draws itself in without a single canvas or main-thread
 *   frame. From then until the room is prepared the drawing does no work at
 *   all: no canvas commit, no GL call, no upload, and the room's render loop
 *   parks (experience.js tick). (Measured on 2026-10-28/29: any canvas frame
 *   during the compile, even one every 250 ms, added main-thread stalls; the
 *   compile is most of the wait.) A resize during the
 *   hold redraws the complete drawing once. A compile shorter than the wipe
 *   (the GPU's program cache on a return visit) finds the cover still wiping
 *   at the develop: it completes its stroke within the veil's first RUSH_MS,
 *   while the develop ease has barely lifted the paper, so the last lines
 *   still draw themselves instead of popping in.
 * - Develop (the reveal): the paper veil lifts over DEVELOP_MS with the shared
 *   develop ease; the lines hold, then retire over RETIRE_MS from RETIRE_AT_MS
 *   (the first cabinet strikes at 350 ms). The prepass follows the live
 *   camera, so the lines stay on their edges as the intro starts to move; it
 *   is redrawn only when the view moved by a visible amount, and no longer
 *   once the retiring lines are nearly gone (LINES_FOLLOW_MIN).
 * - Intent (pointerdown, wheel, keydown, a hidden tab): while loading, every
 *   available part finishes inking within RUSH_MS and the later develop takes
 *   RUSH_MS; while developing, the room and the title block are clear within
 *   RUSH_MS (at once if the tab is hidden).
 * - Reduced motion: no inking. The complete drawing appears once every base
 *   model is loaded (at the assets boundary; a 400 ms opacity fade on the
 *   compositor) and is kept as a still copy on the startup screen itself (a
 *   2D canvas behind the title block), so the room's canvas renders exactly
 *   as today; the screen's own reduced-motion crossfade (100 ms to 1000 ms,
 *   experience.js) then carries the drawing away.
 * - Fallback: any failure (programs that do not link or link too late, an
 *   exception, a lost context, the page's own start deadline) sets
 *   data-draw="off" on the startup screen, which then shows today's classic
 *   startup card (experience.css); the room itself is unaffected. A still
 *   copy made under reduced motion goes with it.
 * - Teardown: the drawing's GPU targets go at once; the proxies, their
 *   materials and the batched-away source buffers only it kept are freed in
 *   idle slices of at most IDLE_SLICE_MS, never in one pass at the settle.
 */

const PAPER = [11, 12, 14].map((v) => v / 255);      // the startup screen's #0b0c0e (the room's own near-black)
const INK = [236, 233, 226].map((v) => v / 255);     // warm white
const EDGE_ALPHA = 0.86, FOLD_ALPHA = 0.42;          // silhouettes, secondary lines
const FOLD_COS = Math.cos(THREE.MathUtils.degToRad(32));
const DEPTH_TOL = 0.035;      // relative inverse-depth bend that reads as an edge
const INK_MS = 900;           // the last of an arrival draws itself in
const CATCH_UP_MS = 400;      // the first parts on the paper, and parts arriving together
const SWEEP = 0.6;            // share of a part's ink time spent travelling across it
const RUSH_MS = 220;          // intent finishes what remains within this (under 250 ms at frame granularity)
const DEVELOP_MS = 900;       // the veil lifts, cubic-bezier(.65,0,.35,1)
const RETIRE_AT_MS = 330, RETIRE_MS = 570;   // the lines retire as the light arrives
const LINES_FOLLOW_MIN = 0.12; // below this the retiring lines stop following the camera
const RM_IN_MS = 400, RM_DELAY_MS = 100, RM_FADE_MS = 900;
const GROUPS = ["shell", "furniture", "exhibit"];
const PREPASS_GAP_MS = 120;   // geometry arriving in bursts re-draws at most this often
const COMPOSITE_GAP_MS = 31;  // inking frames while loading (about 30 a second)
// The cover's wipe at the assets boundary, left to right. It leaves the stroke
// ease's slow start out: half the drawing is across in about 250 ms, so the
// lines read straight away, and the rest settles in.
const COVER_MS = 900;
const COVER_EASE_CSS = "cubic-bezier(0.2, 0, 0.2, 1)";
const VIEW_TOLERANCE_PX = 0.35; // a view that moved less than this keeps its prepass
const IDLE_SLICE_MS = 8;
const MAX_PARTS = 255, MAX_PIXELS = 4.6e6, MAX_RATIO = 2;

function cubicBezier(x1, y1, x2, y2) {
  const at = (a, b, t) => 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  return (x) => {
    if (!(x > 0)) return 0;
    if (x >= 1) return 1;
    let low = 0, high = 1, t = x;
    for (let i = 0; i < 24; i++) {
      const value = at(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value < x) low = t; else high = t;
      t = (low + high) / 2;
    }
    return at(y1, y2, t);
  };
}
export const developEase = cubicBezier(0.65, 0, 0.35, 1);
export const strokeEase = cubicBezier(0.45, 0, 0.2, 1);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
// The shader reads the stroke ease from 33 samples (no solver loop on the GPU).
const STROKE_TABLE = Array.from({ length: 9 }, (unused, row) => new THREE.Vector4(
  ...[0, 1, 2, 3].map((column) => strokeEase(Math.min(32, row * 4 + column) / 32))));

// Raw shaders: the program key never depends on the room's lights, shadows or
// output, so the linked program stays valid whatever the room does next.
const PREPASS_VERTEX = /* glsl */ `precision highp float;
precision highp int;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform float partId;
in vec3 position;
in vec3 normal;
#ifdef USE_INSTANCING
in mat4 instanceMatrix;
#endif
out vec3 vNormal;
out vec3 vView;
flat out float vPart;
void main() {
  vPart = partId;
  vec4 local = vec4(position, 1.0);
  vec3 objectNormal = normal;
#ifdef USE_INSTANCING
  local = instanceMatrix * local;
  mat3 im = mat3(instanceMatrix);
  objectNormal = im * (objectNormal / vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2])));
#endif
  vec4 view = modelViewMatrix * local;
  vNormal = normalMatrix * objectNormal;
  vView = view.xyz;
  gl_Position = projectionMatrix * view;
}`;

const PREPASS_FRAGMENT = /* glsl */ `precision highp float;
in vec3 vNormal;
in vec3 vView;
flat in float vPart;
out highp vec4 drawingSurface;
void main() {
  vec3 normal = vNormal;
  if (dot(normal, normal) < 1e-10) normal = cross(dFdx(vView), dFdy(vView));
  normal = normalize(normal) * (gl_FrontFacing ? 1.0 : -1.0);
  drawingSurface = vec4(normal * 0.5 + 0.5, vPart / 255.0);
}`;

const QUAD_VERTEX = /* glsl */ `precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Taps at one and two pixels along both axes find the nearest outline or fold
// on either side; its distance sets the line's coverage for an even width.
// Depth is compared as inverse view distance, which is linear across a plane
// in screen space, so floors and walls at grazing angles stay clean. An
// outline belongs to the nearer surface (the occluder owns its silhouette).
const RESOLVE_FRAGMENT = /* glsl */ `precision highp float;
precision highp int;
uniform sampler2D surface;
uniform highp sampler2D depth;
uniform vec2 texel;
uniform float pixelRatio;
uniform float near;
uniform float far;
uniform float foldCos;
uniform float depthTol;
in vec2 vUv;
out vec4 outColor;

float partOf(vec4 s) { return floor(s.a * 255.0 + 0.5); }
float wAt(vec2 uv) { return (far - texture(depth, uv).r * (far - near)) / (near * far); }

bool outline(float pId, float pW, float qId, float qW, float rId, float rW) {
  if (qId != rId) return true;
  if (qId == 0.0) return false;
  float jump = abs(rW - qW);
  if (pId != qId) return jump > 2.0 * depthTol * qW;
  return abs(rW + pW - 2.0 * qW) > depthTol * qW && jump >= abs(qW - pW);
}

void main() {
  vec2 axes[2] = vec2[2](vec2(texel.x, 0.0), vec2(0.0, texel.y));
  vec4 c = texture(surface, vUv);
  float cId = partOf(c), cW = wAt(vUv);
  float edge = 9.0, crease = 9.0, edgeOwner = 0.0, foldOwner = 0.0;
  for (int axis = 0; axis < 2; axis++) {
    for (int side = 0; side < 2; side++) {
      vec2 offset = axes[axis] * (side == 0 ? 1.0 : -1.0);
      vec4 a = texture(surface, vUv + offset), b = texture(surface, vUv + 2.0 * offset), o = texture(surface, vUv - offset);
      float aId = partOf(a), bId = partOf(b), oId = partOf(o);
      float aW = wAt(vUv + offset), bW = wAt(vUv + 2.0 * offset), oW = wAt(vUv - offset);
      if (edge > 0.5 && outline(oId, oW, cId, cW, aId, aW)) { edge = 0.5; edgeOwner = cW >= aW ? cId : aId; }
      else if (edge > 1.5 && outline(cId, cW, aId, aW, bId, bW)) { edge = 1.5; edgeOwner = aW >= bW ? aId : bId; }
      if (crease > 0.5 && cId > 0.0 && cId == aId && dot(c.rgb * 2.0 - 1.0, a.rgb * 2.0 - 1.0) < foldCos) { crease = 0.5; foldOwner = cId; }
      else if (crease > 1.5 && aId > 0.0 && aId == bId && dot(a.rgb * 2.0 - 1.0, b.rgb * 2.0 - 1.0) < foldCos) { crease = 1.5; foldOwner = aId; }
    }
  }
  float edgeCover = clamp(0.75 * pixelRatio + 0.5 - edge, 0.0, 1.0);
  float foldCover = clamp(0.375 * pixelRatio + 0.5 - crease, 0.0, 1.0);
  float owner = edgeCover * 0.86 >= foldCover * 0.42 ? edgeOwner : foldOwner;
  outColor = vec4(edgeCover, foldCover, owner / 255.0, 1.0);
}`;

// parts row 0: (time fraction of its ink, sweep axis, -, -); row 1: its screen
// box in uv. A part's lines sweep on across that box with the stroke ease.
// The output is premultiplied: paper (veil) under warm-white lines.
const COMPOSITE_FRAGMENT = /* glsl */ `precision highp float;
precision highp int;
uniform sampler2D lines;
uniform highp sampler2D parts;
uniform vec4 strokeTable[9];
uniform float sweep;
uniform vec3 paper;
uniform vec3 ink;
uniform float edgeAlpha;
uniform float foldAlpha;
uniform float veil;
uniform float linesAlpha;
in vec2 vUv;
out vec4 outColor;

float stroke(float x) {
  float f = clamp(x, 0.0, 1.0) * 32.0;
  int i = min(int(f), 31);
  float a = strokeTable[i / 4][i % 4], b = strokeTable[(i + 1) / 4][(i + 1) % 4];
  return mix(a, b, f - float(i));
}

void main() {
  vec4 l = texture(lines, vUv);
  int id = int(floor(l.b * 255.0 + 0.5));
  vec4 part = texelFetch(parts, ivec2(id, 0), 0);
  vec4 box = texelFetch(parts, ivec2(id, 1), 0);
  float u = part.y < 0.5
    ? (vUv.x - box.x) / max(box.z - box.x, 1e-4)
    : (box.w - vUv.y) / max(box.w - box.y, 1e-4);
  float inked = stroke(part.x * (1.0 + sweep) - sweep * clamp(u, 0.0, 1.0));
  float a = max(l.r * edgeAlpha, l.g * foldAlpha) * inked * linesAlpha;
  outColor = vec4(paper * veil * (1.0 - a) + ink * a, veil + a - veil * a);
}`;

/**
 * Host contract (experience.js): create after the room is constructed, call
 * frame(now) from the render loop until the room is prepared, overlay(now,
 * camera) after every lit frame, develop(now) at the reveal and invalidate()
 * when geometry is added or swapped. Never awaited by the room.
 */
export function createLoaderDrawing({
  renderer, scene, camera, loaderEl, pose, progress, shell,
  exclude = [], reducedMotion = () => false,
}) {
  // The room keeps adding pick proxies and markers as exhibits arrive.
  let excluded = new Set(exclude);
  const events = new AbortController();
  const listen = (node, type, listener, options = {}) => node.addEventListener(type, listener, { ...options, signal: events.signal });
  const drawCamera = new THREE.PerspectiveCamera();
  const size = new THREE.Vector2(), clearColor = new THREE.Color();
  const lookAt = new THREE.Vector3(), corner = new THREE.Vector3();
  const hiddenMaterial = new THREE.MeshBasicMaterial({ visible: false });
  let phase = "preparing", reason = "", live = false;
  let gpu = null, programs = "idle";
  const variants = new Map();     // variant key -> { material, ready }
  const parts = new Map();        // part key -> part
  // Room mesh -> its proxy in the drawing's own scene (shared geometry).
  const meshes = new Map();
  const drawScene = new THREE.Scene();
  drawScene.matrixWorldAutoUpdate = false;
  let ordered = [], nextId = 1, epoch = 0, collectedEpoch = -1, lastCollect = -Infinity;
  let rushAt = null, developAt = null, developRush = null;
  let lastPrepass = -Infinity, prepassDirty = true, resolveDirty = true, compositeDirty = true;
  let lastVeil = -1, lastLines = -1, sourcesCaptured = false;
  let uploadsOpen = true, lastCompositeAt = -Infinity;
  // Drawn, then held: from the assets boundary until the room is prepared.
  let held = false, heldSize = null, failureWatch = null;
  const drawnGeometries = new Set();
  const stats = { createdAt: performance.now(), programsAt: null, liveAt: null, firstInkAt: null, inkedAt: null, developAt: null, settledAt: null,
    groupInkedAt: { shell: null, furniture: null, exhibit: null },
    prepasses: 0, developPrepasses: 0, resolves: 0, composites: 0, prepassMs: 0, prepassMaxMs: 0, frameMaxMs: 0,
    released: 0, caughtUp: 0, rushed: false, slowFrames: [], meshes: 0, waitingVariants: 0, heldForUpload: 0, uploadsClosedAt: null,
    // QA for the hold: when it started, what the finish task cost, the cover
    // wipe (start, length; null when nothing was left to ink), frames the
    // hold skipped and GL work done during it (resize redraws only).
    heldAt: null, finishMs: null, coverAt: null, coverMs: null, coverEndedAt: null, coverLeftAtDevelop: null, heldFrames: 0, heldRedraws: 0, compositesBeforeHold: null,
    disposedGeometries: 0, teardownSlices: 0, teardownMaxSliceMs: 0, teardownDoneAt: null, pixels: 0 };

  const setDraw = (value) => { if (loaderEl && loaderEl.dataset.draw !== value) loaderEl.dataset.draw = value; };
  const deadlinePassed = () => loaderEl?.dataset.draw === "off";

  const savedInfo = {};
  function preserve(run) {
    const target = renderer.getRenderTarget();
    const face = renderer.getActiveCubeFace?.() ?? 0, level = renderer.getActiveMipmapLevel?.() ?? 0;
    const autoClear = renderer.autoClear, alpha = renderer.getClearAlpha();
    const shadows = renderer.shadowMap.needsUpdate;
    const info = Object.assign(savedInfo, renderer.info.render);
    renderer.getClearColor(clearColor);
    // Never consume (or run) the room's pending shadow-map update.
    renderer.shadowMap.needsUpdate = false;
    try { return run(); } finally {
      renderer.setRenderTarget(target, face, level);
      renderer.autoClear = autoClear;
      renderer.setClearColor(clearColor, alpha);
      renderer.shadowMap.needsUpdate = shadows;
      Object.assign(renderer.info.render, info);
    }
  }

  /* ---------------- programs ---------------- */
  const variantKey = (mesh) => (mesh.isInstancedMesh ? "1" : "0");
  function makePrepassMaterial(key) {
    return new THREE.RawShaderMaterial({
      name: "StudioDrawingPrepass", glslVersion: THREE.GLSL3, vertexShader: PREPASS_VERTEX, fragmentShader: PREPASS_FRAGMENT,
      defines: key === "1" ? { USE_INSTANCING: "" } : {},
      uniforms: { partId: { value: 0 } },
      side: THREE.DoubleSide, toneMapped: false,
    });
  }
  // A variant's program is submitted against a render target (the prepass's
  // own output parameters) and polled; meshes that need it wait until linked.
  function requestVariant(key) {
    if (variants.has(key)) return variants.get(key);
    const entry = { key, material: makePrepassMaterial(key), ready: false, failed: false };
    variants.set(key, entry);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(9), 3));
    geometry.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(9), 3));
    const dummy = key === "1" ? new THREE.InstancedMesh(geometry, entry.material, 1) : new THREE.Mesh(geometry, entry.material);
    const warm = new THREE.Scene();
    warm.add(dummy);
    preserve(() => {
      renderer.setRenderTarget(gpu.warmTarget);
      renderer.compile(warm, drawCamera);
    });
    entry.program = renderer.properties.get(entry.material).currentProgram;
    geometry.dispose();
    pollPrograms();
    return entry;
  }
  let pollTimer = 0;
  function pollPrograms() {
    if (pollTimer || !gpu) return;
    const parallel = renderer.extensions.has("KHR_parallel_shader_compile");
    pollTimer = setTimeout(function check() {
      pollTimer = 0;
      if (!gpu) return;
      if (renderer.getContext().isContextLost()) { fail("context-lost"); return; }
      let pending = false, linked = false;
      const check1 = (entry) => {
        if (entry.ready || entry.failed) return;
        const program = entry.program;
        if (!program) { entry.failed = true; return; }
        if (parallel && !program.isReady()) { pending = true; return; }
        // Without the parallel-compile extension the first use links on this
        // thread: one small program per task, never all four at once.
        if (!parallel && linked) { pending = true; return; }
        linked = true;
        // First use reads the link on this renderer's own error hook; a
        // drawing that cannot link must never become the room's error.
        const debug = renderer.debug, handler = debug.onShaderError, checkErrors = debug.checkShaderErrors;
        let broken = false;
        debug.onShaderError = () => { broken = true; };
        debug.checkShaderErrors = true;
        try { program.getUniforms(); } catch { broken = true; } finally { debug.onShaderError = handler; debug.checkShaderErrors = checkErrors; }
        entry.failed = broken;
        entry.ready = !broken;
        // Meshes that waited for this program join the next prepass.
        if (entry.ready && entry.key) prepassDirty = true;
      };
      for (const entry of variants.values()) check1(entry);
      check1(gpu.resolveEntry);
      check1(gpu.compositeEntry);
      if (gpu.resolveEntry.failed || gpu.compositeEntry.failed || variants.get("0")?.failed) { fail("shader"); return; }
      if (pending) { pollTimer = setTimeout(check, parallel ? 16 : 32); return; }
      if (programs !== "ready" && gpu.resolveEntry.ready && gpu.compositeEntry.ready) {
        programs = "ready";
        stats.programsAt = performance.now();
      }
    }, parallel ? 0 : 32);
  }

  function prepare() {
    programs = "linking";
    const quad = new THREE.PlaneGeometry(2, 2);
    const strokeTable = STROKE_TABLE;
    const resolveMaterial = new THREE.RawShaderMaterial({
      name: "StudioDrawingResolve", glslVersion: THREE.GLSL3, vertexShader: QUAD_VERTEX, fragmentShader: RESOLVE_FRAGMENT,
      uniforms: { surface: { value: null }, depth: { value: null }, texel: { value: new THREE.Vector2() }, pixelRatio: { value: 1 },
        near: { value: 0.1 }, far: { value: 100 }, foldCos: { value: FOLD_COS }, depthTol: { value: DEPTH_TOL } },
      depthTest: false, depthWrite: false, toneMapped: false,
    });
    const partData = new Float32Array(256 * 2 * 4);
    const partTexture = new THREE.DataTexture(partData, 256, 2, THREE.RGBAFormat, THREE.FloatType);
    partTexture.minFilter = partTexture.magFilter = THREE.NearestFilter;
    partTexture.generateMipmaps = false;
    partTexture.needsUpdate = true;
    const compositeMaterial = new THREE.RawShaderMaterial({
      name: "StudioDrawingComposite", glslVersion: THREE.GLSL3, vertexShader: QUAD_VERTEX, fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: { lines: { value: null }, parts: { value: partTexture }, strokeTable: { value: strokeTable }, sweep: { value: SWEEP },
        paper: { value: new THREE.Vector3(...PAPER) }, ink: { value: new THREE.Vector3(...INK) },
        edgeAlpha: { value: EDGE_ALPHA }, foldAlpha: { value: FOLD_ALPHA }, veil: { value: 1 }, linesAlpha: { value: 1 } },
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    });
    const resolveMesh = new THREE.Mesh(quad, resolveMaterial), compositeMesh = new THREE.Mesh(quad, compositeMaterial);
    resolveMesh.frustumCulled = compositeMesh.frustumCulled = false;
    const resolveScene = new THREE.Scene(), compositeScene = new THREE.Scene();
    resolveScene.add(resolveMesh);
    compositeScene.add(compositeMesh);
    gpu = { quad, resolveMaterial, compositeMaterial, resolveScene, compositeScene, partData, partTexture,
      quadCamera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), prepassTarget: null, linesTarget: null,
      warmTarget: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true }), resolveEntry: null, compositeEntry: null };
    preserve(() => {
      renderer.setRenderTarget(gpu.warmTarget);
      renderer.compile(resolveScene, gpu.quadCamera);
      renderer.setRenderTarget(null);
      renderer.compile(compositeScene, gpu.quadCamera);
    });
    gpu.resolveEntry = { ready: false, failed: false, program: renderer.properties.get(resolveMaterial).currentProgram };
    gpu.compositeEntry = { ready: false, failed: false, program: renderer.properties.get(compositeMaterial).currentProgram };
    // Both variants (plain and instanced meshes) start linking now, long before
    // the room's own compile: nothing of the drawing links (or reads a link)
    // while the room compiles.
    requestVariant("0");
    requestVariant("1");
    pollPrograms();
  }

  /* ---------------- parts ---------------- */
  const topOf = (object) => { let o = object; while (o.parent && o.parent !== scene) o = o.parent; return o; };
  function hotspotOf(object) {
    for (let o = object; o && o !== scene; o = o.parent) if (o.userData?.hotspot) return o;
    return null;
  }
  const boxOf = (object) => new THREE.Box3().setFromObject(object);
  function part(key, group, box) {
    let entry = parts.get(key);
    if (!entry) {
      const id = nextId <= MAX_PARTS ? nextId++ : MAX_PARTS;
      entry = { key, group, id, box: box && !box.isEmpty() ? box : null, rect: [0, 0, 1, 1], axis: 0, area: 0, visible: true,
        order: 0, drawn: false, releasedAt: null, inkMs: INK_MS, s: 0 };
      parts.set(key, entry);
    } else if (!entry.box && box && !box.isEmpty()) entry.box = box;
    return entry;
  }
  // Shell: the floor, walls, ceiling and their bands (and anything flat on the
  // floor or at the ceiling); exhibits: everything under a project or résumé
  // hotspot; furniture: the rest, one part per top-level object.
  function partForObject(object, root, top) {
    const hot = hotspotOf(object);
    if (hot) {
      const action = hot.userData.hotspot.action;
      return part(`hot:${hot.uuid}`, action === "lamp" ? "furniture" : "exhibit", boxOf(hot));
    }
    if (root || object.name.startsWith("bk_")) {
      const box = boxOf(object), s = box.getSize(corner);
      return part(`arch:${object.uuid}`, s.y > 2 || Math.max(s.x, s.z) > 2 ? "shell" : "furniture", box);
    }
    const key = `top:${top.uuid}`;
    if (parts.has(key)) return parts.get(key);
    const box = boxOf(top);
    const flat = !box.isEmpty() && (box.max.y < 0.06 || box.min.y > 3.2);
    return part(key, flat ? "shell" : "furniture", box);
  }

  function drawableMaterial(material) {
    return !!material && material.visible !== false && material.colorWrite !== false &&
      !(material.transparent && (material.opacity < 0.5 || material.depthWrite === false));
  }
  function drawableMesh(mesh) {
    if (excluded.has(mesh) || mesh.isSkinnedMesh || mesh.isBatchedMesh) return false;
    const geometry = mesh.geometry;
    if (!geometry?.attributes?.position || geometry.morphAttributes?.position?.length) return false;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return materials.some(drawableMaterial);
  }

  // What the reveal will show: the baked architecture as soon as its model is
  // in (even before its lightmaps make it visible), never the procedural
  // stand-in it replaces; the procedural room only if the bake failed. The
  // room's merged static batches are skipped: their source meshes, detached
  // by the merge, keep their proxies.
  function collect() {
    excluded = new Set(exclude);
    scene.updateMatrixWorld();
    const { root, procedural } = shell();
    const list = [];
    const isUnder = (object, ancestor) => { for (let o = object; o; o = o.parent) if (o === ancestor) return true; return false; };
    const visit = (object, forced, top) => {
      if (excluded.has(object)) return;
      if (!object.visible && !forced) return;
      if (object.isSprite || object.isPoints || object.isLine || object.isLight) return;
      if (!procedural && object.name.startsWith("bk_")) return;
      // Merged static batches: their sources were registered just before the
      // merge (capture). A drawing that missed that draws the batches instead.
      if (object.name === "static-room-batch" && sourcesCaptured) return;
      if (object.isMesh && object.layers.test(camera.layers) && drawableMesh(object)) {
        list.push([object, root && (forced || isUnder(object, root)) ? root : null, top]);
      }
      for (const child of object.children) visit(child, false, top);
    };
    for (const child of scene.children) {
      if (child === root && procedural) continue;
      visit(child, child === root, child);
    }
    const seen = new Set();
    let changed = false;
    for (const [mesh, inRoot, top] of list) {
      seen.add(mesh);
      if (meshes.has(mesh)) continue;
      changed = true;
      const variant = requestVariant(variantKey(mesh));
      const material = variant.material.clone();
      const owner = partForObject(mesh, inRoot, top);
      material.uniforms.partId.value = owner.id;
      // Group materials the drawing skips (glass in a mixed mesh) draw nothing.
      const drawn = Array.isArray(mesh.material)
        ? mesh.material.map((m) => (drawableMaterial(m) ? material : hiddenMaterial))
        : material;
      const proxy = mesh.isInstancedMesh ? new THREE.InstancedMesh(mesh.geometry, drawn, mesh.count) : new THREE.Mesh(mesh.geometry, drawn);
      if (mesh.isInstancedMesh) { proxy.instanceMatrix = mesh.instanceMatrix; proxy.count = mesh.count; }
      proxy.frustumCulled = mesh.frustumCulled && !mesh.isInstancedMesh;
      proxy.matrixAutoUpdate = false;
      proxy.matrixWorldAutoUpdate = false;
      proxy.matrixWorld.copy(mesh.matrixWorld);
      drawScene.add(proxy);
      meshes.set(mesh, { proxy, own: material, variant, part: owner });
    }
    for (const [mesh, entry] of meshes) {
      // Merged into a batch: the source is detached but drawn where it was.
      if (seen.has(mesh) || !mesh.parent) continue;
      drawScene.remove(entry.proxy);
      entry.own.dispose();
      meshes.delete(mesh);
      changed = true;
    }
    stats.meshes = meshes.size;
    // Nothing new to draw (the batching, a lightmap swap): no new prepass.
    if (!changed) return;
    order();
    prepassDirty = true;
  }

  // Screen boxes, visibility and the drawing order, from the reveal pose.
  // The view the order was measured for (re-measured on a resize or a new pose).
  const orderedView = new Float64Array(19).fill(NaN);
  const orderStale = () => orderedView[0] !== size.x || orderedView[1] !== size.y || orderedView[2] !== drawCamera.fov ||
    drawCamera.matrixWorld.elements.some((value, index) => orderedView[3 + index] !== value);
  function order() {
    orderedView[0] = size.x; orderedView[1] = size.y; orderedView[2] = drawCamera.fov;
    orderedView.set(drawCamera.matrixWorld.elements, 3);
    const width = Math.max(1, size.x), height = Math.max(1, size.y);
    for (const entry of parts.values()) {
      entry.visible = false;
      if (!entry.box) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, front = false;
      for (let i = 0; i < 8; i++) {
        corner.set(i & 1 ? entry.box.max.x : entry.box.min.x, i & 2 ? entry.box.max.y : entry.box.min.y, i & 4 ? entry.box.max.z : entry.box.min.z);
        corner.applyMatrix4(drawCamera.matrixWorldInverse);
        if (corner.z > -drawCamera.near) { corner.z = -drawCamera.near; } else front = true;
        corner.applyMatrix4(drawCamera.projectionMatrix);
        minX = Math.min(minX, corner.x); maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y); maxY = Math.max(maxY, corner.y);
      }
      const x0 = Math.max(-1, minX), x1 = Math.min(1, maxX), y0 = Math.max(-1, minY), y1 = Math.min(1, maxY);
      if (!front || x1 <= x0 || y1 <= y0) continue;
      entry.visible = true;
      entry.rect = [x0 * 0.5 + 0.5, y0 * 0.5 + 0.5, x1 * 0.5 + 0.5, y1 * 0.5 + 0.5];
      const w = (x1 - x0) * width, h = (y1 - y0) * height;
      entry.area = w * h;
      entry.axis = w >= h ? 0 : 1;
      entry.centerX = (x0 + x1) / 2;
      entry.top = y1;
    }
    ordered = [];
    for (const group of GROUPS) {
      const members = [...parts.values()].filter((entry) => entry.group === group);
      const shown = members.filter((entry) => entry.visible);
      // Within one arrival: masses first (shell, furniture); exhibits right to
      // left, the way the intro then turns, each column top down.
      if (group === "exhibit") shown.sort((a, b) => b.centerX - a.centerX || b.top - a.top);
      else shown.sort((a, b) => b.area - a.area);
      ordered.push(...shown, ...members.filter((entry) => !entry.visible));
    }
    ordered.forEach((entry, index) => { entry.order = index; });
    writeBoxes();
  }

  function writeBoxes() {
    if (!gpu) return;
    const data = gpu.partData;
    for (const entry of parts.values()) {
      const at = (256 + entry.id) * 4;
      data[at] = entry.rect[0]; data[at + 1] = entry.rect[1]; data[at + 2] = entry.rect[2]; data[at + 3] = entry.rect[3];
      data[entry.id * 4 + 1] = entry.axis;
    }
    // Part 0 (nothing drawn) is always "inked": its lines belong to nobody.
    data[0] = 1;
    gpu.partTexture.needsUpdate = true;
  }

  /* ---------------- inking ---------------- */
  function release(now) {
    const reduced = reducedMotion();
    if (rushAt !== null || reduced) {
      for (const entry of ordered) if (entry.releasedAt === null) {
        entry.releasedAt = reduced ? -Infinity : now;
        entry.inkMs = RUSH_MS;
        stats.released++;
      }
      return;
    }
    // Every part whose lines are in the prepass starts now. The last of an
    // arrival draws in over INK_MS and any that arrived with it catch up over
    // CATCH_UP_MS; so does everything in the first arrival, so that the paper
    // shows lines straight away and not after the stroke ease's slow start.
    let last = null;
    for (const entry of ordered) {
      if (entry.releasedAt !== null) continue;
      // Parts outside the view cost no time.
      if (!entry.visible) { entry.releasedAt = now; entry.inkMs = 0; stats.released++; continue; }
      if (!entry.drawn) continue;
      if (last) { last.inkMs = CATCH_UP_MS; stats.caughtUp++; }
      last = entry;
      entry.releasedAt = now;
      entry.inkMs = INK_MS;
      stats.released++;
    }
    if (last && stats.firstInkAt === null) {
      last.inkMs = CATCH_UP_MS;
      stats.caughtUp++;
      stats.firstInkAt = now;
    }
  }

  // Writes each part's ink time fraction; returns true while any is moving.
  const groupDone = { shell: 0, furniture: 0, exhibit: 0 };
  function inkState(now) {
    const data = gpu.partData;
    let moving = false, changed = false, done = ordered.length > 0;
    // Per group: visible parts fully inked (> 0), or not yet (-1).
    for (const group of GROUPS) groupDone[group] = 0;
    // Reduced motion (even switched on mid-way) shows every started part whole.
    const reduced = reducedMotion();
    for (const entry of parts.values()) {
      let s = entry.releasedAt === null ? 0 : entry.inkMs <= 0 || reduced ? 1 : clamp01((now - entry.releasedAt) / entry.inkMs);
      if (rushAt !== null && entry.releasedAt !== null) s = Math.max(s, clamp01((now - rushAt) / RUSH_MS));
      if (s < 1) done = false;
      if (entry.visible && groupDone[entry.group] >= 0) groupDone[entry.group] = s < 1 ? -1 : 1;
      if (s > 0 && s < 1) moving = true;
      if (data[entry.id * 4] !== s) { data[entry.id * 4] = s; changed = true; }
      entry.s = s;
    }
    if (changed) gpu.partTexture.needsUpdate = true;
    if (done && stats.inkedAt === null && ordered.length) stats.inkedAt = now;
    // QA: when each group's visible parts were all fully inked.
    for (const group of GROUPS) if (groupDone[group] > 0 && stats.groupInkedAt[group] === null) stats.groupInkedAt[group] = now;
    return moving || changed;
  }

  /* ---------------- passes ---------------- */
  function targetSize() {
    renderer.getDrawingBufferSize(size);
    let width = size.x, height = size.y;
    const ratio = renderer.getPixelRatio();
    let scale = ratio > MAX_RATIO ? MAX_RATIO / ratio : 1;
    if (width * height * scale * scale > MAX_PIXELS) scale = Math.sqrt(MAX_PIXELS / (width * height));
    return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), ratio * scale];
  }
  function ensureTargets() {
    const [width, height, ratio] = targetSize();
    if (!gpu.prepassTarget) {
      gpu.prepassTarget = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthTexture: new THREE.DepthTexture(width, height) });
      gpu.linesTarget = new THREE.WebGLRenderTarget(width, height, { type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false });
      prepassDirty = true;
    } else if (gpu.prepassTarget.width !== width || gpu.prepassTarget.height !== height) {
      gpu.prepassTarget.setSize(width, height);
      gpu.linesTarget.setSize(width, height);
      prepassDirty = true;
    }
    gpu.ratio = ratio;
    stats.pixels = width * height;
  }

  function placeDrawCamera() {
    const p = pose();
    drawCamera.fov = camera.fov; drawCamera.aspect = camera.aspect;
    drawCamera.near = camera.near; drawCamera.far = camera.far;
    drawCamera.layers.mask = camera.layers.mask;
    drawCamera.position.copy(p.position);
    drawCamera.lookAt(lookAt.copy(p.look));
    drawCamera.updateProjectionMatrix();
    drawCamera.updateMatrixWorld(true);
  }
  // The view a prepass was drawn for: size, projection and pose, compared in
  // place every frame (no per-frame strings or arrays). New geometry marks the
  // prepass dirty in collect() only when the set of drawn meshes changed: the
  // room's own invalidations (a lightmap swap, the batching) never redraw it,
  // least of all while the room compiles. A pose that moved the picture by
  // less than VIEW_TOLERANCE_PX keeps the prepass it has (the turn of the
  // view, and the eye's travel seen at NEAREST_M, in drawing-buffer pixels).
  const drawnView = new Float64Array(35).fill(NaN);
  const BASIS = [0, 1, 2, 4, 5, 6, 8, 9, 10], NEAREST_M = 0.5;
  function viewChanged(view) {
    if (drawnView[0] !== size.x || drawnView[1] !== size.y) return true;
    const p = view.projectionMatrix.elements, w = view.matrixWorld.elements;
    for (let i = 0; i < 16; i++) if (!(Math.abs(drawnView[3 + i] - p[i]) <= 1e-6)) return true;
    const focal = 0.5 * size.y * Math.abs(p[5]);
    let turn = 0;
    for (const i of BASIS) turn = Math.max(turn, Math.abs(drawnView[19 + i] - w[i]));
    const travel = Math.hypot(drawnView[31] - w[12], drawnView[32] - w[13], drawnView[33] - w[14]);
    return !(focal * Math.max(turn, travel / NEAREST_M) <= VIEW_TOLERANCE_PX);
  }
  function keepView(view) {
    drawnView[0] = size.x; drawnView[1] = size.y;
    drawnView.set(view.projectionMatrix.elements, 3);
    drawnView.set(view.matrixWorld.elements, 19);
  }

  // Buffers upload as the models arrive; the assets boundary's last prepass
  // uploads the last arrivals. From then until the room's first lit frame
  // (which uploads everything itself) the drawing uploads nothing: a mesh it
  // has not drawn by then (a resize redraw during the hold) waits for the
  // develop.
  function renderPrepass(view) {
    const started = performance.now();
    let waiting = 0, held = 0;
    for (const [mesh, entry] of meshes) {
      // Moving parts (none before the reveal) are drawn where they are now.
      if (mesh.parent) entry.proxy.matrixWorld.copy(mesh.matrixWorld);
      const known = uploadsOpen || drawnGeometries.has(mesh.geometry);
      entry.proxy.visible = entry.variant.ready && known;
      // Arrival: this part's lines are in the picture from this prepass on.
      if (entry.proxy.visible) entry.part.drawn = true;
      if (!entry.variant.ready) waiting++;
      else if (!known) held++;
    }
    stats.waitingVariants = waiting;
    stats.heldForUpload = held;
    preserve(() => {
      renderer.setRenderTarget(gpu.prepassTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.autoClear = true;
      renderer.render(drawScene, view);
    });
    if (uploadsOpen) for (const [mesh, entry] of meshes) if (entry.proxy.visible) drawnGeometries.add(mesh.geometry);
    const ms = performance.now() - started;
    stats.prepasses++;
    if (phase === "developing") stats.developPrepasses++;
    stats.prepassMs = ms;
    stats.prepassMaxMs = Math.max(stats.prepassMaxMs, ms);
    resolveDirty = true;
  }

  function renderResolve(view) {
    const uniforms = gpu.resolveMaterial.uniforms;
    uniforms.surface.value = gpu.prepassTarget.texture;
    uniforms.depth.value = gpu.prepassTarget.depthTexture;
    uniforms.texel.value.set(1 / gpu.prepassTarget.width, 1 / gpu.prepassTarget.height);
    uniforms.pixelRatio.value = gpu.ratio;
    uniforms.near.value = view.near;
    uniforms.far.value = view.far;
    preserve(() => {
      renderer.setRenderTarget(gpu.linesTarget);
      renderer.autoClear = false;
      renderer.render(gpu.resolveScene, gpu.quadCamera);
    });
    stats.resolves++;
    compositeDirty = true;
  }

  function renderComposite(veil, linesAlpha) {
    const uniforms = gpu.compositeMaterial.uniforms;
    uniforms.lines.value = gpu.linesTarget.texture;
    uniforms.veil.value = veil;
    uniforms.linesAlpha.value = linesAlpha;
    preserve(() => {
      renderer.setRenderTarget(null);
      renderer.autoClear = false;
      renderer.render(gpu.compositeScene, gpu.quadCamera);
    });
    stats.composites++;
    lastVeil = veil; lastLines = linesAlpha;
  }

  function refresh(now, view, force = false) {
    ensureTargets();
    if (viewChanged(view)) prepassDirty = true;
    if (prepassDirty && (force || now - lastPrepass >= PREPASS_GAP_MS)) {
      keepView(view);
      lastPrepass = now;
      prepassDirty = false;
      renderPrepass(view);
    }
    if (resolveDirty) { resolveDirty = false; renderResolve(view); }
  }

  /* ---------------- loading ---------------- */
  // Called from the render loop until the room is prepared.
  function frame(now = performance.now()) {
    if (phase === "off" || phase === "settled" || phase === "developing") return;
    // Drawn, then held: nothing until the room is prepared, except the one
    // redraw a resize needs (the canvas was cleared). The context-loss event
    // and the startup screen's failure state still end it.
    if (held) {
      if (loaderEl?.dataset.state === "failed") { fail("startup-failed"); return; }
      stats.heldFrames++;
      renderer.getDrawingBufferSize(size);
      if (size.x !== heldSize.x || size.y !== heldSize.y) redrawHeld(now);
      return;
    }
    try {
      if (renderer.getContext().isContextLost()) { fail("context-lost"); return; }
      if (loaderEl?.dataset.state === "failed") { fail("startup-failed"); return; }
      // Not on screen in time (the page's own deadline): today's screen stays.
      if (!live && deadlinePassed()) { fail("deadline"); return; }
      if (programs === "idle") prepare();
      if (programs !== "ready") return;
      const started = performance.now();
      placeDrawCamera();
      renderer.getDrawingBufferSize(size);
      if (collectedEpoch !== epoch && (now - lastCollect >= PREPASS_GAP_MS || collectedEpoch < 0)) {
        collectedEpoch = epoch; lastCollect = now;
        collect();
      } else {
        // A resize or a new reveal pose re-measures the parts' screen boxes.
        if (orderStale()) order();
      }
      const reduced = reducedMotion();
      // Reduced motion shows one complete drawing: it appears at the assets
      // boundary, when every base model is in (capture()).
      if (!live && (reduced || !ordered.some((entry) => entry.visible))) return;
      if (!live) phase = "drawing";
      // New lines (geometry, a resize: the canvas was cleared) show at once,
      // and a part starts inking on the frame its lines reach the prepass.
      const resolved = stats.resolves;
      refresh(now, drawCamera, !live);
      const redrawn = stats.resolves !== resolved;
      release(now);
      const moving = inkState(now);
      // Inking redraws at most ~30 times a second.
      const changed = moving || compositeDirty || lastLines !== 1 || lastVeil !== 1;
      if (!live || redrawn || (changed && now - lastCompositeAt >= COMPOSITE_GAP_MS)) {
        compositeDirty = false;
        lastCompositeAt = now;
        // The first composite is bare paper (nothing inked yet): it replaces
        // the opaque startup paper unseen.
        renderComposite(1, live ? 1 : 0);
        // Reduced motion switched on mid-way: the still drawing lives on the
        // startup screen.
        if (reduced) copyToSheet(); else dropSheet();
        if (!live) goLive(now);
      }
      const spent = performance.now() - started;
      stats.frameMaxMs = Math.max(stats.frameMaxMs, spent);
      // QA: the slowest loading frames, with the passes they ran.
      if (spent > 8 && stats.slowFrames.length < 24) stats.slowFrames.push([Math.round(started), +spent.toFixed(1), stats.prepasses, stats.resolves, stats.composites]);
    } catch (error) {
      console.warn("[experience] startup drawing unavailable; keeping the startup screen", error);
      fail("error");
    }
  }

  /* ---------------- reveal ---------------- */
  // After every lit frame: until the reveal the drawing still covers the room;
  // during the develop the room comes through it.
  function overlay(now = performance.now(), view = camera) {
    if (!live || (phase !== "drawing" && phase !== "developing")) return;
    // The room's first lit frame ends the hold.
    held = false;
    // A still copy on the startup screen covers the room: nothing to draw.
    if (sheet) return;
    // The room's own frames have uploaded its geometry: nothing is held now.
    if (!uploadsOpen) { uploadsOpen = true; prepassDirty = true; }
    try {
      if (renderer.getContext().isContextLost()) { settle("context-lost"); return; }
      let veil = 1, linesAlpha = 1;
      if (phase === "developing") {
        const t = developTime(now);
        if (reducedMotion()) {
          veil = linesAlpha = 1 - clamp01((t - RM_DELAY_MS) / RM_FADE_MS);
        } else {
          veil = 1 - developEase(t / DEVELOP_MS);
          linesAlpha = 1 - developEase((t - RETIRE_AT_MS) / RETIRE_MS);
        }
        if (veil <= 0 && linesAlpha <= 0) { settle("developed"); return; }
        release(now);
        inkState(now);
        renderer.getDrawingBufferSize(size);
        // The lines follow the live camera while they can still be seen; a
        // view that has not moved by a visible amount keeps its prepass.
        if (linesAlpha > LINES_FOLLOW_MIN) refresh(now, view, true);
      } else {
        // Prepared, before the reveal: the complete drawing (finished at the
        // assets boundary) over the room's first lit frames.
        release(now);
        inkState(now);
        renderer.getDrawingBufferSize(size);
        refresh(now, drawCamera, false);
      }
      renderComposite(veil, linesAlpha);
    } catch (error) {
      console.warn("[experience] startup drawing overlay failed; showing the room", error);
      settle("error");
    }
  }

  function developTime(now) {
    if (developAt === null) return 0;
    const end = reducedMotion() ? RM_DELAY_MS + RM_FADE_MS : Math.max(DEVELOP_MS, RETIRE_AT_MS + RETIRE_MS);
    if (!developRush) return now - developAt;
    return Math.min(end, developRush.t + (now - developRush.at) * (end - developRush.t) / RUSH_MS);
  }

  function develop(now = performance.now()) {
    if (phase === "off" || phase === "settled") return;
    if (!live) { settle("not-live"); return; }
    held = false;
    // A cover still wiping (a compile that took less than COVER_MS, e.g. from
    // the GPU's program cache) must not hide the room: it finishes its stroke
    // in the veil's first moments and goes.
    hurryCover(now);
    // Reduced motion: the screen's crossfade carries the still copy away; the
    // copy goes once the screen is hidden.
    if (sheet) {
      stats.developAt = now;
      settle("reduced-motion");
      setTimeout(dropSheet, 1300);
      return;
    }
    phase = "developing";
    developAt = now;
    stats.developAt = now;
    // Anything not yet inked finishes within the first RUSH_MS of the veil.
    if (rushAt === null) rushAt = now;
    // An intent while loading asked for the end state: the develop then takes
    // RUSH_MS, not DEVELOP_MS, and so does the title block.
    else if (stats.rushed) { developRush = { at: now, t: 0 }; hurryStrip(); }
    if (document.hidden) settle("hidden");
  }

  // Reduced motion: a still copy of the composite on the startup screen (made
  // in the same task as the composite, while the WebGL buffer holds it).
  let sheet = null;
  function copyToSheet() {
    if (!loaderEl) return;
    const source = renderer.domElement;
    if (!sheet) {
      sheet = document.createElement("canvas");
      sheet.className = "exp-loader__sheet";
      sheet.setAttribute("aria-hidden", "true");
      loaderEl.prepend(sheet);
    }
    if (sheet.width !== source.width || sheet.height !== source.height) { sheet.width = source.width; sheet.height = source.height; }
    sheet.getContext("2d")?.drawImage(source, 0, 0);
    stats.sheetCopies = (stats.sheetCopies || 0) + 1;
  }
  function dropSheet() {
    if (!sheet) return;
    sheet.remove();
    sheet = null;
  }

  function goLive(now) {
    live = true;
    stats.liveAt = now;
    setDraw("live");
  }

  /* ---------------- drawn, then held ---------------- */
  // The cover: the frame on screen at the assets boundary, copied (in the
  // task that drew it) to a 2D canvas over the complete drawing, then wiped
  // away left to right by two counter-moving transforms (the frame moves
  // right, the copy inside it moves left: the copy stays put while its left
  // edge travels). Compositor-only; the copy is made before the room's
  // static batching, texture uploads and compile.
  let cover = null, coverWipe = [], coverGroups = [];
  function makeCover() {
    if (!loaderEl || typeof HTMLElement.prototype.animate !== "function") return false;
    const source = renderer.domElement;
    const copy = document.createElement("canvas");
    copy.width = source.width;
    copy.height = source.height;
    const context = copy.getContext("2d", { alpha: false });
    if (!context) return false;
    context.drawImage(source, 0, 0);
    const frameEl = document.createElement("div");
    frameEl.className = "exp-loader__cover";
    frameEl.setAttribute("aria-hidden", "true");
    frameEl.append(copy);
    loaderEl.prepend(frameEl);
    cover = frameEl;
    return true;
  }
  function wipeCover(now) {
    const timing = { duration: COVER_MS, easing: COVER_EASE_CSS, fill: "forwards" };
    coverWipe = [
      cover.animate([{ transform: "translateX(0)" }, { transform: "translateX(100%)" }], timing),
      cover.firstChild.animate([{ transform: "translateX(0)" }, { transform: "translateX(-100%)" }], timing),
    ];
    stats.coverAt = now;
    stats.coverMs = COVER_MS;
  }
  // Intent (or a hidden tab): the end state at once.
  function finishCover() {
    for (const animation of coverWipe) { try { animation.finish(); } catch {} }
  }
  function dropCover() {
    for (const animation of coverWipe) { try { animation.cancel(); } catch {} }
    coverWipe = [];
    if (cover) stats.coverEndedAt = performance.now();
    cover?.remove();
    cover = null;
  }
  // The develop found the cover still wiping: what is left of the wipe runs
  // within RUSH_MS (both transforms sped up in one task, so the copy stays
  // put), on the compositor; the cover goes when it ends. A settle or failure
  // before that drops it anyway.
  function hurryCover(now) {
    if (!cover) return;
    const wipe = coverWipe;
    const left = COVER_MS - (Number(wipe[0]?.currentTime) || 0);
    if (!wipe.length || left <= 0) { dropCover(); return; }
    try {
      if (left > RUSH_MS) for (const animation of wipe) animation.updatePlaybackRate(left / RUSH_MS);
      Promise.all(wipe.map((animation) => animation.finished)).then(dropCover, () => {});
    } catch { dropCover(); return; }
    // QA: the wipe's real end, and how much of it the develop found left.
    const end = now + Math.min(left, RUSH_MS);
    for (const group of coverGroups) stats.groupInkedAt[group] = end;
    stats.inkedAt = end;
    stats.coverLeftAtDevelop = Math.round(left);
  }

  // The assets boundary: the last prepass (the last arrivals, and the static
  // meshes the room is about to merge), the frame on screen kept as the cover,
  // the complete drawing composited under it, and the upload window closed.
  // Under reduced motion the complete drawing becomes the still copy and
  // fades in (opacity, on the compositor) over bare paper.
  function finish() {
    const started = performance.now(), now = started;
    placeDrawCamera();
    renderer.getDrawingBufferSize(size);
    collectedEpoch = epoch;
    lastCollect = now;
    collect();
    sourcesCaptured = true;
    if (orderStale()) order();
    if (!ordered.some((entry) => entry.visible)) { fail("empty"); return; }
    if (!live && deadlinePassed()) { fail("deadline"); return; }
    phase = "drawing";
    prepassDirty = true;
    refresh(now, drawCamera, true);
    uploadsOpen = false;
    stats.uploadsClosedAt = performance.now();
    release(now);
    inkState(now);
    const reduced = reducedMotion();
    const pending = GROUPS.filter((group) => stats.groupInkedAt[group] === null &&
      ordered.some((entry) => entry.visible && entry.group === group));
    const unfinished = !live || ordered.some((entry) => entry.visible && entry.s < 1);
    // Whatever is on screen now (bare paper if the drawing was not live yet).
    if (!reduced && unfinished) {
      renderComposite(1, live ? 1 : 0);
      makeCover();
    }
    for (const entry of parts.values()) if (entry.releasedAt === null || entry.s < 1) {
      if (entry.releasedAt === null) stats.released++;
      entry.releasedAt = -Infinity;
      entry.inkMs = 0;
    }
    inkState(now);
    renderComposite(1, 1);
    if (reduced) {
      const fresh = !sheet;
      copyToSheet();
      if (fresh && sheet?.animate) {
        // Bare paper under the still copy while it fades in.
        renderComposite(1, 0);
        sheet.animate([{ opacity: 0 }, { opacity: 1 }], { duration: RM_IN_MS, easing: "linear" });
      }
    } else if (cover) {
      wipeCover(now);
      // QA: the groups the wipe completes are inked when it ends.
      coverGroups = pending;
      for (const group of pending) stats.groupInkedAt[group] = now + COVER_MS;
      stats.inkedAt = now + COVER_MS;
    }
    if (!live) goLive(now);
    renderer.getDrawingBufferSize(size);
    heldSize = size.clone();
    held = true;
    // With the room's loop parked nothing polls the startup screen: a startup
    // failure during the hold reaches the drawing here.
    if (loaderEl && !failureWatch) {
      failureWatch = new MutationObserver(() => { if (loaderEl.dataset.state === "failed") fail("startup-failed"); });
      failureWatch.observe(loaderEl, { attributes: true, attributeFilter: ["data-state"] });
    }
    stats.heldAt = now;
    stats.compositesBeforeHold = stats.composites;
    stats.finishMs = +(performance.now() - started).toFixed(1);
  }

  // A resize during the hold cleared the canvas: the complete drawing again.
  function redrawHeld(now) {
    try {
      if (renderer.getContext().isContextLost()) { fail("context-lost"); return; }
      placeDrawCamera();
      if (orderStale()) order();
      refresh(now, drawCamera, true);
      renderComposite(1, 1);
      if (sheet) { copyToSheet(); renderComposite(1, 0); }
      // The cover was cut for the old size: its end state at once.
      finishCover();
      heldSize.copy(size);
      stats.heldRedraws++;
    } catch (error) {
      console.warn("[experience] startup drawing unavailable; keeping the startup screen", error);
      fail("error");
    }
  }

  // The title block normally leaves with the startup screen's own opacity fade
  // (600 ms). An intent fades its card out within RUSH_MS on top of that; the
  // override is dropped once the screen itself is hidden, so a later failure
  // page still shows its card.
  let stripHurry = null;
  function hurryStrip() {
    if (stripHurry || reducedMotion()) return;
    const card = loaderEl?.querySelector(".exp-loader__inner");
    if (!card?.animate) return;
    stripHurry = card.animate([{ opacity: getComputedStyle(card).opacity }, { opacity: 0 }], { duration: RUSH_MS, easing: "linear", fill: "forwards" });
    setTimeout(() => stripHurry?.cancel(), 1200);
  }

  /* ---------------- intent ---------------- */
  function intent() {
    const now = performance.now();
    if (phase === "developing") {
      if (!developRush) developRush = { at: now, t: developTime(now) };
      finishCover();
      hurryStrip();
      return;
    }
    if (phase === "off" || phase === "settled") return;
    if (rushAt === null) { rushAt = now; stats.rushed = true; }
    finishCover();
  }
  // A lost context stops the room's loop: the startup screen turns opaque again.
  listen(renderer.domElement, "webglcontextlost", () => fail("context-lost"));
  // The room's loop is parked during the hold: a resize (which cleared the
  // canvas) asks for its own frame.
  listen(window, "resize", () => { if (held) requestAnimationFrame(() => frame(performance.now())); });
  listen(window, "pointerdown", intent, { capture: true, passive: true });
  listen(window, "wheel", intent, { capture: true, passive: true });
  listen(window, "keydown", intent, { capture: true });
  listen(document, "visibilitychange", () => {
    if (!document.hidden) return;
    if (phase === "developing") settle("hidden");
    else intent();
  });

  /* ---------------- teardown ---------------- */
  // The drawing's own targets go at once. Its ~400 proxy materials and the
  // batched-away source buffers only it still held are freed in idle slices
  // of at most IDLE_SLICE_MS (F30): one pass at the settle was a long task
  // in the intro's first second on phones.
  function release_() {
    events.abort();
    clearTimeout(pollTimer);
    failureWatch?.disconnect();
    if (!gpu) return;
    gpu.prepassTarget?.depthTexture?.dispose();
    gpu.prepassTarget?.dispose();
    gpu.linesTarget?.dispose();
    gpu.warmTarget.dispose();
    gpu.quad.dispose();
    gpu.resolveMaterial.dispose();
    gpu.compositeMaterial.dispose();
    gpu.partTexture.dispose();
    gpu = null;
    const sources = [...meshes.keys()];
    const materials = [...[...meshes.values()].map((entry) => entry.own), ...[...variants.values()].map((entry) => entry.material), hiddenMaterial];
    drawScene.clear();
    meshes.clear();
    variants.clear();
    const tasks = [() => { for (const geometry of releaseDetached(sources)) tasks.push(() => geometry.dispose()); }];
    for (const material of materials) tasks.push(() => material.dispose());
    disposeInSlices(tasks);
  }
  function whenIdle(run) {
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(() => run(null), 50);
  }
  function disposeInSlices(tasks) {
    let next = 0;
    const slice = (deadline) => {
      const started = performance.now();
      const budget = Math.min(IDLE_SLICE_MS, Math.max(1, deadline ? deadline.timeRemaining() : IDLE_SLICE_MS));
      try {
        do tasks[next++](); while (next < tasks.length && performance.now() - started < budget);
      } catch (error) { console.warn("[experience] startup drawing teardown", error); }
      const ms = performance.now() - started;
      stats.teardownSlices++;
      stats.teardownMaxSliceMs = Math.max(stats.teardownMaxSliceMs, +ms.toFixed(2));
      if (next < tasks.length) whenIdle(slice); else stats.teardownDoneAt = performance.now();
    };
    if (tasks.length) whenIdle(slice);
  }

  function settle(why = "settled") {
    if (phase === "settled" || phase === "off") return;
    phase = "settled";
    reason = why;
    held = false;
    stats.settledAt = performance.now();
    dropCover();
    release_();
  }

  function fail(why = "fallback") {
    if (phase === "settled" || phase === "off") return;
    const wasDeveloping = phase === "developing";
    phase = "off";
    reason = why;
    held = false;
    // A still copy made under reduced motion goes with the drawing (F37), and
    // so does the cover.
    dropSheet();
    dropCover();
    release_();
    // During the develop the room is already there; before it, today's
    // classic startup card returns over whatever the canvas holds.
    if (!wasDeveloping) setDraw("off");
  }

  // The batched-away source meshes are gone from the room for good: once the
  // drawing is done with them, free the buffers only it had uploaded (a slice
  // of its own; each dispose is a few buffer deletions).
  function releaseDetached(sources) {
    const inUse = new Set();
    scene.traverse((object) => { if (object.geometry) inUse.add(object.geometry); });
    const freed = new Set();
    for (const mesh of sources) {
      if (mesh.parent || inUse.has(mesh.geometry) || freed.has(mesh.geometry)) continue;
      freed.add(mesh.geometry);
    }
    stats.disposedGeometries += freed.size;
    return freed;
  }

  const api = {
    get active() { return live && !sheet && (phase === "drawing" || phase === "developing"); },
    get reducedSheet() { return !!sheet; },
    get live() { return live; },
    get phase() { return phase; },
    // From the assets boundary until the room's first lit frame.
    get held() { return held && live; },
    frame,
    overlay,
    develop,
    settle: (why) => settle(why),
    fail,
    invalidate() { epoch++; },
    // The assets boundary (experience.js, before the static batching, the
    // texture uploads and the compile): the drawing is finished here and held
    // until the room is prepared (finish()). The static meshes the room is
    // about to merge are registered now (their buffers are already uploaded).
    // A drawing whose programs are not linked by now is too late: today's
    // screen stays.
    capture() {
      if (phase === "off" || phase === "settled" || held) return;
      try {
        if (renderer.getContext().isContextLost()) { fail("context-lost"); return; }
        const linked = programs === "ready" && [...variants.values()].every((entry) => entry.ready);
        if (!linked) { fail("late"); return; }
        finish();
      } catch (error) {
        console.warn("[experience] startup drawing unavailable; keeping the startup screen", error);
        fail("error");
      }
    },
    getState() {
      const now = performance.now();
      const shown = ordered.filter((entry) => entry.visible);
      const ink = shown.length ? shown.reduce((sum, entry) => sum + entry.s, 0) / shown.length : 0;
      let veil = 1, lines = live ? 1 : 0;
      if (phase === "developing") {
        const t = developTime(now);
        veil = reducedMotion() ? 1 - clamp01((t - RM_DELAY_MS) / RM_FADE_MS) : 1 - developEase(t / DEVELOP_MS);
        lines = reducedMotion() ? veil : 1 - developEase((t - RETIRE_AT_MS) / RETIRE_MS);
      } else if (phase === "settled" || phase === "off") { veil = 0; lines = 0; }
      const groups = Object.fromEntries(GROUPS.map((group) => {
        const members = shown.filter((entry) => entry.group === group);
        return [group, { parts: members.length, released: members.filter((entry) => entry.releasedAt !== null).length,
          ink: members.length ? +(members.reduce((sum, entry) => sum + entry.s, 0) / members.length).toFixed(3) : 0 }];
      }));
      return { phase, reason, live, programs, progress: +(Number(progress()) || 0).toFixed(2), ink: +ink.toFixed(3), veil: +veil.toFixed(3), lines: +lines.toFixed(3),
        parts: parts.size, visibleParts: shown.length, groups, rush: rushAt !== null, reducedMotion: reducedMotion(), held, cover: !!cover, ...stats };
    },
  };
  return api;
}
