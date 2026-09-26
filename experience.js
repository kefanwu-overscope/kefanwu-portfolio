/* ============================================================
   experience.js — 3D study experience
   Current project source poses in the original display cabinets,
   detailed workshop props, PBR room surfaces and Cycles lighting.
   Exhibits open their project pages; the desk folder opens the resume.

   Credits: green banker lamp — "Desk lamp" by Poly by Google,
   CC-BY 3.0 (via Poly Pizza). Other third-party assets CC0.
   See ATTRIBUTIONS.txt.
   ============================================================ */

import * as THREE from "three";
import { createStudioNavigation } from "./studio-navigation.js?v=retained-room-20260926";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { ModelLODLoader, modelBounds, yieldToBrowser } from "./experience-lod.js?v=room-detail-20260926";
import { AdaptiveFrameClock, frameAlpha } from "./experience-timing.js?v=room-performance-20260919";
import { batchStaticRoom } from "./experience-batching.js?v=room-performance-20260919";
import { prepareRoomShaders } from "./experience-warmup.js?v=room-performance-20260919";
import { loadRGBMLightmap, installBakedDiffuse } from "./experience-baked-material.js?v=realism-20260925";
import { ROOM_BAKE } from "./experience-baked-assets.js?v=room-detail-20260926";
import { createStudioLoader } from "./experience-loader.js?v=exp-adaptive-20260907";
import { createHDRService, createHDRTexture } from "./experience-hdr.js?v=exp-adaptive-20260907";
import { AdaptiveQuality, GpuFrameTimer } from "./experience-quality.js?v=exp-adaptive-20260907";
import { buildDetailedPrinter, buildDetailedPegboardTools, refineWorkbenchInstruments } from "./experience-workbench-details.js?v=room-detail-20260926";
import { ROOM_EXHIBITS, prepareRoomExhibit } from "./experience-exhibits.js?v=room-detail-20260926";
import { addStudioRealism } from "./experience-realism.js?v=studio-realism-20260907";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { RESUME } from "./experience-data.js";
import { RESUME_ASSET, RESUME_PAPER, resumeHTML, attachResumeReader } from "./experience-resume.js?v=resume-desk-20260926";

document.documentElement.classList.add("exp-js");

// low tier: phones / coarse pointers get a lighter pipeline
const LOW_TIER =
  window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820;

// baked lighting (Blender/Cycles, tools/bake/): swap the architecture layer
// for a lightmapped GLB; false = fully procedural fallback
const USE_BAKED = true;
// Photographic grade for the calibrated bake under the site's ACES exposure.
const BAKED_LIGHT_GAIN = 0.7;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

// A project opens on its own page. Explicit returns use a one-use snapshot;
// browser Back restores that room's history entry. Fresh visits keep the intro.
const ROOM_RETURN_KEY = "kw-studio-project-return";
function validRoomReturn(state) {
  const vector = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  return state && vector(state.position) && vector(state.target) && typeof state.lightsOn === "boolean" &&
    ["2k", "4k"].includes(state.quality) ? state : null;
}
function readRoomReturn() {
  const url = new URL(location.href);
  const explicitReturn = url.searchParams.get("return") === "project";
  const historyReturn = performance.getEntriesByType("navigation")[0]?.type === "back_forward";
  let saved = null;
  try {
    const raw = sessionStorage.getItem(ROOM_RETURN_KEY);
    sessionStorage.removeItem(ROOM_RETURN_KEY);
    saved = raw ? validRoomReturn(JSON.parse(raw)) : null;
  } catch {}
  const state = explicitReturn ? saved : historyReturn
    ? validRoomReturn(history.state?.studioRoomReturn) || saved : null;
  if (explicitReturn) url.searchParams.delete("return");
  if (explicitReturn || state) {
    try { history.replaceState(state ? {...history.state, studioRoomReturn: state} : history.state, "", url); } catch {}
  }
  return state;
}
const roomReturn = readRoomReturn();
window.addEventListener("pageshow", (event) => {
  // A cached room already retains its camera and lighting in memory.
  if (event.persisted) {
    try { sessionStorage.removeItem(ROOM_RETURN_KEY); } catch {}
  }
});

function webglSupported() {
  try {
    const c = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext("webgl2") || c.getContext("webgl"))
    );
  } catch (e) {
    return false;
  }
}

const canvas = document.getElementById("exp-canvas");
const loaderEl = document.getElementById("exp-loader");
const startupUI = createStudioLoader(loaderEl);
const revealScene = () => document.documentElement.classList.add("exp-ready");
const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

// Share one listener while hidden; downloads/worker decoding can continue.
let visibleWait = null;
function waitForVisible() {
  if (!document.hidden) return Promise.resolve();
  if (!visibleWait) visibleWait = new Promise((resolve) => {
    const resume = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", resume);
      visibleWait = null;
      resolve();
    };
    document.addEventListener("visibilitychange", resume);
  });
  return visibleWait;
}

const COL = {
  bg: 0x0b0c0e, // matches the main site's near-black
  floorTint: 0x64676d, // sealed satin concrete
  wallTint: 0xa4a7ad, // light graphite plaster
  woodTint: 0x3c332a, // ebonized cool walnut
  leather: 0x16181c, // near-black desk leather
  accent: 0x3f8cff, // site accent blue
};

/* ---------- shared texture sets ---------- */
let TEX = null;
let MAXA = 4;
// texture-sharpness sweep flag: the render loop applies max anisotropy to
// every material map on the next frame; async loaders re-arm it (Kefan:
// models/text blur when the camera pulls back)
let ANISO_DIRTY = true;
const SOURCE_READY = new WeakMap();
const ANISO_PENDING = new Set();
const textureReady = (t) => {
  const image = t?.source?.data;
  return !!(image && (image.width || image.videoWidth) > 0 && (image.height || image.videoHeight) > 0);
};
function repeatedTexture(source, x, y) {
  const copy = new THREE.Texture(); // version 0 until the shared image is usable
  const ready = () => {
    if (!textureReady(source)) return;
    copy.copy(source);
    copy.repeat.set(x, y);
    copy.anisotropy = MAXA;
    copy.needsUpdate = true;
    ANISO_DIRTY = true;
  };
  if (textureReady(source)) ready();
  else SOURCE_READY.get(source.source)?.then(ready);
  return copy;
}
function setupTextures(manager) {
  const loader = new THREE.TextureLoader(manager);
  const cache = {};
  const DEFS = {
    dark_wood: { rep: [2, 1], base: "textures/dark_wood/dark_wood", maps: ["diff_1k.jpg", "nor_gl_1k.jpg", "rough_1k.jpg"] },
    // Subdued grey open-pore veneer for cabinet back panels only. One large
    // repeat keeps the grain calm behind the exhibits instead of striping it.
    grey_wood: { rep: [1, 1], base: "textures/dark_wood/dark_wood", maps: ["diff_grey_1k.jpg", "nor_gl_1k.jpg", "rough_1k.jpg"] },
    painted_plaster_wall: { rep: [3, 2], base: "textures/painted_plaster_wall/painted_plaster_wall", maps: ["diff_1k.jpg", "nor_gl_1k.jpg", "rough_1k.jpg"] },
  };
  function loadPBR(slug) {
    if (cache[slug]) return cache[slug];
    const d = DEFS[slug];
    const mk = (suffix) => {
      let settle;
      const ready = new Promise((resolve) => { settle = resolve; });
      const t = loader.load(
        `${d.base}_${suffix}`,
        () => { ANISO_DIRTY = true; settle(); }, undefined,
        (error) => { console.warn("[experience] PBR texture unavailable", error); settle(); });
      SOURCE_READY.set(t.source, ready);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(d.rep[0], d.rep[1]);
      t.anisotropy = MAXA;
      return t;
    };
    const map = mk(d.maps[0]);
    map.colorSpace = THREE.SRGBColorSpace;
    const set = { map, normalMap: mk(d.maps[1]), roughnessMap: mk(d.maps[2]) };
    cache[slug] = set;
    return set;
  }
  TEX = { loadPBR };
}

function woodMaterial(tint = COL.woodTint, rough = 0.8, slug = "dark_wood") {
  const t = TEX.loadPBR(slug);
  return new THREE.MeshStandardMaterial({
    color: tint,
    map: t.map,
    normalMap: t.normalMap,
    roughnessMap: t.roughnessMap,
    roughness: rough,
    metalness: 0.0,
  });
}

// J2: shared brushed-satin roughness streaks — the flat single-value frame
// material made the biggest background element read as one CG-clean slab
let BRUSHED_ROUGH = null;
function brushedRoughTex() {
  if (BRUSHED_ROUGH) return BRUSHED_ROUGH;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 256;
  const x = c.getContext("2d");
  x.fillStyle = "#999999";
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1100; i++) {
    const y = Math.random() * 256;
    const x0 = Math.random() * 256;
    const len = 24 + Math.random() * 150;
    const v = 128 + Math.floor((Math.random() - 0.5) * 70);
    x.strokeStyle = `rgba(${v},${v},${v},0.16)`;
    x.beginPath(); x.moveTo(x0, y); x.lineTo(x0 + len, y + (Math.random() - 0.5) * 1.6); x.stroke();
  }
  BRUSHED_ROUGH = new THREE.CanvasTexture(c);
  BRUSHED_ROUGH.wrapS = BRUSHED_ROUGH.wrapT = THREE.RepeatWrapping;
  return BRUSHED_ROUGH;
}

// J1: micro-wear roughness for the desk slab (injected onto the BAKED desk
// material at GLB load — buildDesk itself is hidden at runtime)
let DESK_WEAR = null;
function deskWearTex() {
  if (DESK_WEAR) return DESK_WEAR;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  x.fillStyle = "#858585"; // ≈ the slab's original 0.52 roughness
  x.fillRect(0, 0, 512, 512);
  // faint circular sheen swirls (daily wipe/mouse arcs)
  for (let i = 0; i < 60; i++) {
    const cx = Math.random() * 512, cy = Math.random() * 512;
    const r = 20 + Math.random() * 90;
    const v = 133 + Math.floor((Math.random() - 0.5) * 30);
    x.strokeStyle = `rgba(${v},${v},${v},0.10)`;
    x.lineWidth = 2 + Math.random() * 5;
    x.beginPath();
    x.arc(cx, cy, r, Math.random() * 6.28, Math.random() * 6.28 + 1.5 + Math.random() * 3);
    x.stroke();
  }
  // duller patches where things sit and hands rest
  for (let i = 0; i < 14; i++) {
    const g2 = x.createRadialGradient(0, 0, 0, 0, 0, 40 + Math.random() * 60);
    const up = Math.random() > 0.5 ? 16 : -14;
    g2.addColorStop(0, `rgba(${133 + up},${133 + up},${133 + up},0.16)`);
    g2.addColorStop(1, "rgba(133,133,133,0)");
    x.save();
    x.translate(Math.random() * 512, Math.random() * 512);
    x.fillStyle = g2;
    x.fillRect(-120, -120, 240, 240);
    x.restore();
  }
  DESK_WEAR = new THREE.CanvasTexture(c);
  return DESK_WEAR;
}

function cabinetFrameMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9da3aa,
    // The map already supplies ~0.6 roughness. Multiplying it by 0.62 made
    // powder-coated framing read as polished plastic instead of satin paint.
    roughness: 1.0,
    metalness: 0.0,
    roughnessMap: brushedRoughTex(),
  });
}

function cabinetBackMaterial() {
  const mat = woodMaterial(0xb9bfc6, 0.78, "grey_wood");
  mat.normalScale.set(0.16, 0.16);
  return mat;
}
const brassMat = () =>
  new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.3, metalness: 1.0 });

/* engineering materials for the merged assembly buckets (mesh name mat_*) */
const MODELS = {};
const HOTSPOTS = [];
// pick-proxy hitboxes + marker sprites: excluded from the GTAO/Bokeh
// pre-passes (their override-material renders would ghost these as grey
// boxes / dark squares in the AO and depth buffers)
const NO_PREPASS = [];

/* display-cabinet layout: 3 bays x 3 rows (single source of truth) */
const CAB = {
  z: -1.12, // cabinet center z
  frontZ: -1.08, // exhibit center z (fully ON the shelf boards)
  bays: [-0.73, 0, 0.73],
  rows: [1.68, 1.2, 0.72], // shelf top surfaces (raised so the desk never hides the bottom row)
  bayW: 0.7,
  rowH: 0.48,
};

async function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // Never supersample beyond the viewport's native display pixels or the
  // current screen bounds. Keep the existing quality caps and 10 MP desktop
  // budget; on very large displays the budget can render below native size.
  const pixelRatioFor = (w, h) => {
    const nativeDpr = window.devicePixelRatio || 1;
    const screenScale = Math.min(1,
      (window.screen.width || w) / Math.max(1, w),
      (window.screen.height || h) / Math.max(1, h));
    const nativeLimit = nativeDpr * screenScale;
    const qualityLimit = LOW_TIER ? 1.5 : 2.2;
    const budget = LOW_TIER ? Infinity : Math.sqrt(10e6 / Math.max(1, w * h));
    return Math.min(nativeLimit, qualityLimit, budget);
  };
  renderer.setPixelRatio(pixelRatioFor(window.innerWidth, window.innerHeight));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // A composer frame has several scene passes. Each light owns its cached
  // shadow; only geometry/caster motion invalidates it in tick().
  renderer.shadowMap.autoUpdate = false;
  renderer.transmissionResolutionScale = 0.75;
  renderer.info.autoReset = false;
  MAXA = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 7, 18);

  // rest pose: pulled back + raised so the full cabinet, desk and a hint of
  // both side walls read at once (invites orbiting)
  const REST_POS = new THREE.Vector3(1.55, 1.58, 2.6);
  const REST_TARGET = new THREE.Vector3(0, 1.08, -0.1);
  const FLY_POS = new THREE.Vector3(2.1, 1.8, 2.9);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.copy(REST_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.4;
  controls.maxDistance = 3.2;
  controls.minPolarAngle = 0.46;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  // limited orbit (Kefan reverted the 360° experiment on 2026-07-12: "太乱了")
  // — the stage is the cabinet/desk/workbench arc; the front wall is plain
  controls.minAzimuthAngle = -Math.PI * 0.32;
  controls.maxAzimuthAngle = Math.PI * 0.32;
  controls.target.copy(REST_TARGET);
  controls.update();

  /* ---------- post: subtle bloom (AAA finish, restrained) ---------- */
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    samples: 4,
    type: THREE.HalfFloatType,
  });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  // ambient occlusion: contact darkening in corners/seams (desktop only)
  let gtao = null;
  if (!LOW_TIER) { // baked lightmaps already carry AO
    gtao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
    gtao.output = GTAOPass.OUTPUT.Default;
    // contact-scale AO only — the default 0.25 m radius at full blend crushes
    // the enclosed cabinet interiors (and their exhibits) to black
    gtao.updateGtaoMaterial({ radius: 0.1 });
    gtao.blendIntensity = 0.42;
    composer.addPass(gtao);
  }
  // depth of field, opened up only while an exhibit is focused
  let bokeh = null;
  if (!LOW_TIER) {
    bokeh = new BokehPass(scene, camera, { focus: 2.2, aperture: 0.0, maxblur: 0.018 });
    composer.addPass(bokeh);
  }
  // hide pick-proxies + marker sprites while GTAO/Bokeh re-render the scene
  // with override materials (otherwise they ghost into the AO/depth buffers)
  const hideForPrepass = (pass) => {
    if (!pass) return;
    const orig = pass.render.bind(pass);
    pass.render = (...args) => {
      const shown = [];
      for (const o of NO_PREPASS) if (o.visible) { o.visible = false; shown.push(o); }
      orig(...args);
      for (const o of shown) o.visible = true;
    };
  };
  hideForPrepass(gtao);
  hideForPrepass(bokeh);
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.035, // subtle optical bloom on emitters, not a haze over pale furniture
    0.35,
    2.2 // scene-linear threshold: a brightly lit white slab is not a lamp
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- loading manager ---------- */
  const manager = new THREE.LoadingManager();
  // Hold one item until every construction stage and queued base model has
  // registered. An early image completing cannot declare the room ready.
  manager.itemStart("scene-bootstrap");
  let markAssetsReady;
  const assetsReady = new Promise((resolve) => { markAssetsReady = resolve; });
  const readiness = { construction: false, assets: false, prepared: false, firstFrame: false, revealed: false, failures: [], timings: { started: performance.now() } };
  let batchingStats = null;
  manager.onError = (url) => { readiness.failures.push(url); };
  let deepLinkKey = "";
  try { deepLinkKey = decodeURIComponent(location.hash.slice(1)); } catch (error) {
    console.warn("[experience] malformed deep link", error);
  }
  const loader = new ModelLODLoader(manager, { targetKey: deepLinkKey });
  loader.onLevelLoaded = () => { ANISO_DIRTY = true; };
  const barEl = loaderEl ? loaderEl.querySelector(".exp-loader__bar i") : null;
  const txtEl = loaderEl ? loaderEl.querySelector(".exp-loader__text") : null;
  manager.onProgress = (url, loaded, total) => {
    startupUI.update({ loaded, total, phase: "loading" });
  };
  let revealed = false, revealPending = false;
  // one-shot: set when a flow (deep link) skips the normal drag-hint timing;
  // checked once in closePanel() so the hint still surfaces exactly once
  let pendingDragHintOnClose = false;
  const doReveal = () => {
    if (revealed || document.hidden || renderer.getContext().isContextLost()) return;
    revealed = true;
    readiness.revealed = true;
    readiness.timings.revealed = performance.now();
    loader.enabled = true;
    startupUI.complete();
    if (loaderEl) {
      const hideStatus = () => {
        loaderEl.setAttribute("aria-hidden", "true");
        loaderEl.removeEventListener("transitionend", onFadeEnd);
        clearTimeout(fadeFallback);
      };
      const onFadeEnd = (event) => {
        if (event.target === loaderEl && event.propertyName === "opacity") hideStatus();
      };
      loaderEl.addEventListener("transitionend", onFadeEnd);
      // Reduced motion may have no transitionend; this affects accessibility
      // only, after the real first-frame readiness gate has already passed.
      const fadeFallback = setTimeout(hideStatus, prefersReducedMotion ? 0 : 1000);
    }
    revealScene();
    // Asset registration precedes GPU preparation. Enable interaction only
    // after a completed frame, so startup cannot overwrite a user's selection.
    const dock = document.getElementById("exp-dock");
    if (dock) dock.hidden = false;
    const lightToggle = document.getElementById("exp-light-toggle");
    if (lightToggle) lightToggle.disabled = false;
    updateLightingUI();
    if (roomReturn) {
      camera.position.fromArray(roomReturn.position);
      controls.target.fromArray(roomReturn.target);
      controls.enabled = true;
      controls.update();
      requestedLightsOn = roomReturn.lightsOn;
      lightQuality = roomReturn.quality;
      void syncLighting();
      cameraIntro.phase = "restored";
      return;
    }
    // Every entry gets the same guided camera sweep. A deep link keeps its
    // destination and opens that exhibit when the sweep finishes.
    const dlKey = deepLinkKey;
    const dlPivot = dlKey && HOTSPOTS.find((h) => h.userData.hotspot.key === dlKey);
    if (dlPivot) {
      camera.position.copy(REST_POS);
      camera.lookAt(REST_TARGET);
      controls.target.copy(REST_TARGET);
      pendingDragHintOnClose = true; // show the hint after the linked project closes
      if (!prefersReducedMotion) {
        runBootIntro();
        startIntro(() => focusHotspot(dlPivot));
      } else {
        focusHotspot(dlPivot);
      }
      return;
    }
    if (!prefersReducedMotion) {
      // Lighting and the complete camera sweep both repeat on every visit.
      runBootIntro();
      startIntro(); // the drag hint fires from startIntro()'s final flight leg, once the camera actually lands
    } else {
      // no flight to wait for under reduced motion — show it immediately
      showDragHint();
    }
  };
  manager.onLoad = () => { readiness.assets = true; markAssetsReady(); };

  setupTextures(manager);

  if (!USE_BAKED) new HDRLoader(manager).load("hdri/wooden_lounge_1k.hdr", (tex) => {
    // legacy HDRI environment — replaced by the baked in-room probe
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 0.22; // keep the HDRI's warm-wood cast subtle
    tex.dispose();
    pmrem.dispose();
  });

  /* ---------- lighting ---------- */
  const hemi = new THREE.HemisphereLight(0x4e5766, 0x14161a, 0.95);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xeef2f8, 1.35);
  key.position.set(2.6, 4.6, 2.4);
  key.castShadow = true;
  key.shadow.autoUpdate = false;
  key.shadow.needsUpdate = true;
  // 2048 (was 4096): the PCF radius-7 blur already softens edges and the
  // room's own shadows are baked — quarter the shadow buffer for free (S3)
  key.shadow.mapSize.set(LOW_TIER ? 1024 : 2048, LOW_TIER ? 1024 : 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 7;
  scene.add(key);

  // soft cool fill from the front-left balances the warm key (cinematic 2-point)
  const fill = new THREE.DirectionalLight(0xa8bfdd, 0.3);
  fill.position.set(-3, 2.2, 3);
  scene.add(fill);

  // layer 2 = the pendant fixture: its own point light hangs centimeters from
  // the shade interior, and physical decay would blow the reflector out to
  // pure white. The fixture sees only these room lights; the point light
  // (layer 0) lights everything else.
  camera.layers.enable(2);
  hemi.layers.enable(2);
  key.layers.enable(2);
  fill.layers.enable(2);

  // (desk lamp is decorative furniture only — it emits no light)

  // display spots washing the cabinet
  // gentle front spots for modeling/speculars only — the actual case light
  // comes from the shelf strips below
  [-0.7, 0, 0.7].forEach((x) => {
    const spot = new THREE.SpotLight(0xe8ecf4, 0.9, 6, 0.56, 1.0, 1.6);
    spot.position.set(x, 2.55, 0.45);
    spot.target.position.set(x, 1.0, CAB.z);
    scene.add(spot);
    scene.add(spot.target);
  });
  CAB2.bays.forEach((z) => {
    const spot = new THREE.SpotLight(0xe8ecf4, 0.85, 6, 0.56, 1.0, 1.6);
    spot.position.set(0.9, 2.55, z + 0.3);
    spot.target.position.set(2.3, 1.0, z);
    scene.add(spot);
    scene.add(spot.target);
  });
  // real strip lights: one RectAreaLight per shelf row, sitting exactly at
  // each row's LED strip and washing DOWN into the bay — the light visibly
  // originates from the strips, not from the case center
  RectAreaLightUniformsLib.init();
  const stripLight = (w, intensity) => {
    const l = new THREE.RectAreaLight(0xdfe8f4, intensity, w, 0.05);
    return l;
  };
  // LOW_TIER: one taller-reach strip per cabinet instead of one per row
  const mainRows = LOW_TIER ? [CAB.rows[1]] : CAB.rows;
  const sideRows = LOW_TIER ? [CAB2.rows[1]] : CAB2.rows;
  const caseStrips = { main: [], side: [] }; // kept for the boot choreography
  mainRows.forEach((y) => {
    const l = stripLight(2.2, LOW_TIER ? 19 : 13.5); // brighter x2: exhibits read too dim (Kefan, twice)
    l.position.set(0, y + 0.42, CAB.z + 0.34);
    scene.add(l);
    l.lookAt(0, y + 0.06, CAB.z); // ~45° down-back: lights faces AND backs
    caseStrips.main.push(l);
  });
  sideRows.forEach((y) => {
    const l = stripLight(1.4, LOW_TIER ? 18 : 12.7);
    l.position.set(CAB2.x - 0.34, y + 0.42, CAB2.z);
    scene.add(l);
    l.lookAt(CAB2.x, y + 0.06, CAB2.z);
    caseStrips.side.push(l);
  });

  /* staged light-up on reveal: ambient -> LED strips -> spots -> lamps */
  function runLightIntro() {
    const jobs = [];
    const stage = (obj, prop, delay, dur, from = 0) => {
      const target = obj[prop];
      obj[prop] = from;
      jobs.push({ obj, prop, from, target, delay, dur });
    };
    [hemi, key, fill].forEach((l) => stage(l, "intensity", 0, 600, l.intensity * 0.25));
    const seen = new Set();
    scene.traverse((o) => {
      if (o.isSpotLight) stage(o, "intensity", 450, 350);
      else if (o.isPointLight) stage(o, "intensity", 700, 300);
      else if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0.4 && !seen.has(o.material)) {
        seen.add(o.material);
        stage(o.material, "emissiveIntensity", 250, 350);
      }
    });
    // the pendant's bulb + liner glow are DERIVED from its point light (I1) —
    // ramp them on the point-light clock or the bulb reads lit while its
    // light is still out (their night emissives sit under the 0.4 gate above)
    if (MODELS.pendantBulb && !seen.has(MODELS.pendantBulb.material)) stage(MODELS.pendantBulb.material, "emissiveIntensity", 700, 300);
    if (MODELS.pendantShadeInner && !seen.has(MODELS.pendantShadeInner.material)) stage(MODELS.pendantShadeInner.material, "emissiveIntensity", 700, 300);
    const t0 = performance.now();
    const tick = (now) => {
      let live = false;
      for (const j of jobs) {
        const k = Math.min(1, Math.max(0, (now - t0 - j.delay) / j.dur));
        if (k < 1) live = true;
        j.obj[j.prop] = j.from + (j.target - j.from) * easeInOutCubic(k);
      }
      if (live) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* every-visit cold boot: the room powers on in a staged sequence.
     Rug LEDs trace on, each cabinet's strips strike alive as the camera
     passes it, and the desk lamp "clicks" last — landing the warm pool on
     the resume and implicitly teaching the light switch. Timings follow the
     intro flight legs (1700 + 1900 + 1500 ms). */
  let bootRaf = 0;
  let bootRestore = null;
  const bootStatus = { plays: 0, startedAt: null, completedAt: null, cancelled: false };
  function cancelBoot() {
    if (!bootTakeover) return;
    bootTakeover = false;
    bootStatus.cancelled = true;
    bootStatus.completedAt = performance.now();
    if (bootRaf) cancelAnimationFrame(bootRaf);
    if (bootRestore) bootRestore();
    bootRestore = null;
  }
  function runBootIntro() {
    if (bootTakeover) return; // re-entry would capture mid-boot values as targets
    bootTakeover = true;
    bootStatus.plays++;
    bootStatus.startedAt = performance.now();
    bootStatus.completedAt = null;
    bootStatus.cancelled = false;
    const easeOut = (k) => 1 - Math.pow(1 - k, 3);
    const lin = (k) => k;
    // gather the players
    const caseSpots = [];
    const stripMats = { main: [], side: [] };
    const wp = new THREE.Vector3();
    scene.traverse((o) => {
      if (o.isSpotLight && o.distance === 6) {
        caseSpots.push({ l: o, target: o.position.x < 0.85 ? 0.9 : 0.85 });
      } else if (o.isMesh && o.material && o.material.emissive && o.material.emissive.getHexString() === "bcd7ff") {
        o.getWorldPosition(wp);
        (wp.x > 1.5 ? stripMats.side : stripMats.main).push(o.material);
      }
    });
    const exposure0 = renderer.toneMappingExposure;
    const bloom0 = bloom.strength;
    const night = { key: key.intensity, hemi: hemi.intensity, fill: fill.intensity, env: scene.environmentIntensity };
    // black out, then boot
    renderer.toneMappingExposure = 0.12;
    key.intensity = 0; hemi.intensity = 0; fill.intensity = 0;
    scene.environmentIntensity = 0.06;
    caseSpots.forEach((s) => { s.l.intensity = 0; });
    caseStrips.main.concat(caseStrips.side).forEach((l) => { l.userData.bootTarget = l.intensity; l.intensity = 0; });
    stripMats.main.concat(stripMats.side).forEach((m) => { m.emissiveIntensity = 0; });
    blueLines.forEach((m) => { m.emissiveIntensity = 0; });
    lampLeds.forEach((m) => { m.emissiveIntensity = 0; });
    benchGlow.intensity = 0; resumeSpot.intensity = 0; moonSpot.intensity = 0;
    // the practicals added by the realism batch join the blackout too — they
    // were sitting at full night level through the whole "powered-off" room
    benchBarSpot.intensity = 0;
    MODELS.pendantLight.intensity = 0;
    if (MODELS.pendantBulb) MODELS.pendantBulb.material.emissiveIntensity = 0;
    if (MODELS.pendantShadeInner) MODELS.pendantShadeInner.material.emissiveIntensity = 0;
    if (MODELS.tigGlow) MODELS.tigGlow.intensity = 0;
    bakedMats.forEach((m) => { m.lightMapIntensity = 0.15; });
    // if the user grabs the light switch mid-boot, snap the pieces that
    // applyLightState doesn't own to their steady-state values
    bootRestore = () => {
      renderer.toneMappingExposure = exposure0;
      bloom.strength = bloom0;
      caseSpots.forEach((s) => { s.l.intensity = s.target; });
      caseStrips.main.concat(caseStrips.side).forEach((l) => { l.intensity = l.userData.bootTarget; });
      stripMats.main.concat(stripMats.side).forEach((m) => { m.emissiveIntensity = 1.15; });
      bakedMats.forEach((m) => { m.lightMapIntensity = BAKED_LIGHT_GAIN; });
      // snap every blacked-out practical to its canonical night value so
      // cancelBoot is safe from ANY call site — today toggleRoomLights calls
      // applyLightState(true) right after and re-owns most of these, but
      // that adjacency is a convention, not a guarantee (and the TIG glow
      // isn't state-driven at all)
      benchBarSpot.intensity = 0.95 * 1.6;
      MODELS.pendantLight.intensity = 0.3;
      if (MODELS.pendantBulb) MODELS.pendantBulb.material.emissiveIntensity = 0.15 + 0.85 * (0.3 / 2.6);
      if (MODELS.pendantShadeInner) MODELS.pendantShadeInner.material.emissiveIntensity = 0.06 + 0.6 * (0.3 / 2.6);
      if (MODELS.tigGlow) MODELS.tigGlow.intensity = 0.8;
    };
    // fluorescent-strike intensity curve: two dips, then settle
    const STRIKE = [0, 1.5, 0.25, 1.15, 1];
    const strike = (k) => {
      const x = k * (STRIKE.length - 1), i = Math.min(STRIKE.length - 2, x | 0);
      return STRIKE[i] + (STRIKE[i + 1] - STRIKE[i]) * (x - i);
    };
    const segs = [];
    const seg = (delay, dur, fn, ez) => segs.push({ delay, dur, fn, ez: ez || easeInOutCubic });
    // iris adaptation: exposure opens like an eye adjusting to a dark room
    seg(0, 1500, (k) => { renderer.toneMappingExposure = 0.12 + (exposure0 - 0.12) * k; }, easeOut);
    // the baked light pools warm up as if coming from the fixtures
    seg(200, 2400, (k) => { bakedMats.forEach((m) => { m.lightMapIntensity = 0.15 + (BAKED_LIGHT_GAIN - 0.15) * k; }); });
    seg(300, 1200, (k) => {
      key.intensity = night.key * k; hemi.intensity = night.hemi * k; fill.intensity = night.fill * k;
      scene.environmentIntensity = 0.06 + (night.env - 0.06) * k;
    });
    // rug LED inlay traces on line by line
    blueLines.forEach((m, i) => seg(250 + i * 130, 480, (k) => { m.emissiveIntensity = 1.1 * k; }, easeOut));
    // cabinet strips strike row by row as the camera passes each cabinet:
    // right cabinet during flight leg 1, main cabinet during leg 2
    const strikeRow = (light, mats, delay) => seg(delay, 300, (k) => {
      const s = strike(k);
      if (light) light.intensity = light.userData.bootTarget * s;
      mats.forEach((m) => { m.emissiveIntensity = 1.15 * s; });
    }, lin);
    const nSide = Math.max(stripMats.side.length, caseStrips.side.length);
    for (let i = 0; i < nSide; i++) {
      strikeRow(i < caseStrips.side.length ? caseStrips.side[i] : null,
        i < stripMats.side.length ? [stripMats.side[i]] : [], 850 + i * 170);
    }
    const nMain = Math.max(stripMats.main.length, caseStrips.main.length);
    for (let i = 0; i < nMain; i++) {
      strikeRow(i < caseStrips.main.length ? caseStrips.main[i] : null,
        i < stripMats.main.length ? [stripMats.main[i]] : [], 2250 + i * 170);
    }
    // gentle case spots once both cabinets are alive
    seg(3350, 550, (k) => caseSpots.forEach((s) => { s.l.intensity = s.target * k; }));
    // the TIG amp readout's warm pool strikes with the right-side leg,
    // the pendant wakes with the main cabinet, the bench bar joins the lamp
    seg(1300, 500, (k) => { if (MODELS.tigGlow) MODELS.tigGlow.intensity = 0.8 * k; });
    seg(2600, 600, (k) => {
      MODELS.pendantLight.intensity = 0.3 * k;
      if (MODELS.pendantBulb) MODELS.pendantBulb.material.emissiveIntensity = (0.15 + 0.85 * (0.3 / 2.6)) * k;
      if (MODELS.pendantShadeInner) MODELS.pendantShadeInner.material.emissiveIntensity = (0.06 + 0.6 * (0.3 / 2.6)) * k;
    });
    seg(5080, 320, (k) => { benchBarSpot.intensity = 0.95 * 1.6 * k; }, easeOut);
    // the moon reveals itself as the camera settles toward the rest pose
    seg(3600, 900, (k) => { moonSpot.intensity = MOON_NIGHT * k; });
    // final beat at flight landing: the lamp clicks on — snappy, not eased —
    // and the warm pool blooms up on the resume
    seg(5050, 90, (k) => lampLeds.forEach((m) => { m.emissiveIntensity = 2.4 * k; }), lin);
    seg(5080, 320, (k) => { benchGlow.intensity = 0.95 * k; }, easeOut);
    // overshoot slightly then settle on applyLightState's night value (1.5)
    seg(5100, 420, (k) => {
      resumeSpot.intensity = 1.5 * (k < 0.6 ? (k / 0.6) * 1.18 : 1.18 - 0.18 * ((k - 0.6) / 0.4));
    }, lin);
    seg(5100, 500, (k) => { bloom.strength = bloom0 + 0.08 * Math.sin(Math.PI * k); }, lin);

    const t0 = performance.now();
    const TOTAL = 5700;
    const bt = (now) => {
      if (!bootTakeover) return;
      const el = now - t0;
      for (const s of segs) {
        const k = Math.min(1, Math.max(0, (el - s.delay) / s.dur));
        s.fn(s.ez(k));
      }
      if (el < TOTAL) {
        bootRaf = requestAnimationFrame(bt);
      } else {
        bootTakeover = false;
        bootStatus.completedAt = now;
        bootRestore = null;
        applyLightState(false); // land exactly on the canonical night state
      }
    };
    bootRaf = requestAnimationFrame(bt);
  }

  /* ---------- room + rug ---------- */
  // tag every room-shell mesh for the bake pipeline ("bk_" names let the
  // exporter select them and P2 hide them when the baked GLB is active)
  buildRoom({ add: (o) => { o.traverse((m) => { if (m.isMesh && !m.name) m.name = "bk_room"; }); scene.add(o); } });

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.5),
    new THREE.MeshBasicMaterial({
      map: makeRadialShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.75,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.02, 0.1);
  scene.add(contact);

  function buildFallbackRug() {
    // low-pile graphite rug anchoring the desk + chair vignette, with a thin
    // muted-blue inner border line (matte, no emissive); a speckled noise
    // map doubles as bump so the pile reads plush instead of painted
    const rugCanvas = document.createElement("canvas");
    rugCanvas.width = rugCanvas.height = 256;
    const rugCtx = rugCanvas.getContext("2d");
    rugCtx.fillStyle = "#171a21";
    rugCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) {
      const a = Math.random();
      rugCtx.fillStyle = `rgba(${14 + a * 30 | 0}, ${16 + a * 32 | 0}, ${22 + a * 40 | 0}, 0.6)`;
      rugCtx.fillRect(Math.random() * 256, Math.random() * 256, 1.7, 1.7);
    }
    const rugMap = new THREE.CanvasTexture(rugCanvas);
    rugMap.colorSpace = THREE.SRGBColorSpace;
    rugMap.wrapS = rugMap.wrapT = THREE.RepeatWrapping;
    rugMap.repeat.set(3, 2.2);
    rugMap.anisotropy = MAXA;
    const rugBump = new THREE.CanvasTexture(rugCanvas);
    rugBump.wrapS = rugBump.wrapT = THREE.RepeatWrapping;
    rugBump.repeat.set(3, 2.2);
    const rug = new THREE.Mesh(
      new RoundedBoxGeometry(2.3, 0.012, 1.7, 2, 0.006),
      new THREE.MeshStandardMaterial({
        color: 0xd9dde4, // tints the dark speckle map back to graphite
        map: rugMap,
        bumpMap: rugBump,
        bumpScale: 0.6,
        roughness: 0.97,
        metalness: 0,
      })
    );
    rug.name = "bk_room";
    rug.position.set(0, 0.006, 0.5);
    rug.receiveShadow = true;
    scene.add(rug);
    const rugLine = new THREE.MeshStandardMaterial({ color: 0x2b4d80, roughness: 0.9, metalness: 0 });
    const rugIn = { w: 2.12, d: 1.52 };
    [
      [rugIn.w, 0.02, 0, 0.5 - rugIn.d / 2 + 0.01],
      [rugIn.w, 0.02, 0, 0.5 + rugIn.d / 2 - 0.01],
      [0.02, rugIn.d, -rugIn.w / 2 + 0.01, 0.5],
      [0.02, rugIn.d, rugIn.w / 2 - 0.01, 0.5],
    ].forEach(([w, d, x, z]) => {
      const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.002, d), rugLine);
      line.name = "bk_room";
      line.position.set(x, 0.0125, z);
      scene.add(line);
    });
  }
  if (!USE_BAKED) buildFallbackRug();
  await yieldToBrowser();

  /* ---------- loaders ---------- */
  const artLoader = new THREE.TextureLoader(manager);

  /* ---------- desk (procedural, PBR) + desk props ---------- */
  const DESK_TOP = 0.76;
  function buildFallbackDesk() {
    const deskGroup = buildDesk();
    deskGroup.name = "bk_desk";
    scene.add(deskGroup);
  }
  if (!USE_BAKED) buildFallbackDesk();

  // modern LED desk lamp (procedural), warm pool on the resume
  const deskLamp = buildModernDeskLamp();
  deskLamp.name = "lampSwitch"; // real-time + clickable: toggles the room lights
  // far left + forward so it no longer blocks the cabinet's bottom-left bay
  // (LineFollower) from the rest camera
  deskLamp.position.set(-0.8, DESK_TOP, 0.12);
  // aim the cantilever arm straight down the desk at the résumé, so the head
  // reaches out over the paper (it used to point off across the room)
  deskLamp.rotation.y = -0.05;
  scene.add(deskLamp);
  MODELS.deskLamp = deskLamp;
  // pseudo-hotspot: interact marker + hover label + click = room light switch
  {
    deskLamp.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(deskLamp);
    const center = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    // generous invisible hitbox (child of the lamp, like every exhibit) —
    // the thin stem/head alone made clicks miss half the time, and it
    // extends up so clicking the floating marker also toggles
    const hit = new THREE.Mesh(
      new THREE.BoxGeometry(size.x + 0.1, size.y + 0.18, size.z + 0.1),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    deskLamp.add(hit);
    hit.position.copy(deskLamp.worldToLocal(center.clone().add(new THREE.Vector3(0, 0.05, 0))));
    const marker = makeInteractMarker();
    deskLamp.add(marker);
    const mLocal = deskLamp.worldToLocal(new THREE.Vector3(center.x, bb.max.y + 0.07, center.z));
    marker.position.copy(mLocal);
    NO_PREPASS.push(hit, marker);
    deskLamp.userData.hotspot = {
      key: null, action: "lamp", label: "Room lights", baseScale: 1,
      center, marker, pickProxy: hit, markerY: mLocal.y, phase: Math.random() * Math.PI * 2,
    };
    HOTSPOTS.push(deskLamp);
  }

  await yieldToBrowser();

  // resume: the hero object on the desk — front and center, in the light
  placeRoot(buildResumePaper(artLoader), scene, {
    name: "resumePaper", action: "resume", label: "Résumé",
    // sits ON the cutting-mat overlay (mat top 0.7668; the old baked pad the
    // paper used to ride is hidden at GLB load)
    pos: [0.02, RESUME_PAPER.bottom, 0.16], rotY: 0.12,
  });

  await yieldToBrowser();

  /* ---------- display cabinet + exhibits (3 x 3) ---------- */
  scene.add(buildDisplayCabinet());

  // Every exhibit uses the current project viewer's initial geometry and
  // materials. Only static, source-derived display meshes load in the room.
  const mainExhibits = [
    { key: "carbonSeat", size: .30, axis: "y", bay: 0, row: 0 },
    { key: "aura", size: .29, axis: "y", bay: 1, row: 0 },
    { key: "scanner", size: .40, axis: "x", bay: 2, row: 0 },
    { key: "javelin", size: .44, axis: "x", bay: 0, row: 1 },
    { key: "steering", size: .32, axis: "y", bay: 1, row: 1 },
    { key: "brakeSim", size: .28, axis: "y", bay: 2, row: 1 },
    { key: "materialTest", size: .38, axis: "y", bay: 0, row: 2 },
    { key: "ansysCfd", size: .47, axis: "x", bay: 1, row: 2 },
    { key: "vineRobot", size: .36, axis: "y", bay: 2, row: 2 },
  ];
  for (const item of mainExhibits) {
    loadCurrentExhibit(loader, scene, item.key, {
      targetSize: item.size, axis: item.axis, fit: [.60, .40, .40],
      markerCap: CAB.rows[item.row] + (item.row === 0 ? .36 : .44),
      pos: [CAB.bays[item.bay], CAB.rows[item.row], CAB.frontZ],
      rotY: ROOM_EXHIBITS[item.key].frontYaw,
    });
  }
  await yieldToBrowser();

  // Preserve the six established side-cabinet positions.
  scene.add(buildSideCabinet());
  const sideExhibits = [
    { key: "seat", size: .34, axis: "y", bay: 0, row: 0 },
    { key: "ftc", size: .32, axis: "y", bay: 1, row: 0 },
    { key: "formlabs", size: .30, axis: "y", bay: 0, row: 1 },
    { key: "pool", size: .50, axis: "z", bay: 1, row: 1, yaw: -.08 },
    { key: "telecaster", size: .38, axis: "y", bay: 0, row: 2 },
    { key: "lineFollower", size: .40, axis: "z", bay: 1, row: 2, yaw: -.25 },
  ];
  for (const item of sideExhibits) {
    loadCurrentExhibit(loader, scene, item.key, {
      targetSize: item.size, axis: item.axis, fit: [.34, .40, .58],
      markerCap: CAB2.rows[item.row] + (item.row === 0 ? .36 : .44),
      pos: [CAB2.frontX, CAB2.rows[item.row], CAB2.bays[item.bay]],
      rotY: item.yaw ?? -Math.PI / 2 + .35 + ROOM_EXHIBITS[item.key].frontYaw,
    });
    await yieldToBrowser();
  }
  scene.add(await buildWorkbench());
  // The kit's parts occupy the existing clear assembly area on the bench.
  loadCurrentExhibit(loader, scene, "education", {
    targetSize: .38, axis: "z", fit: [.24, .22, .40],
    pos: [-2.07, .781, -.10], markerCap: .98,
    rotationOrder: "YXZ", rotX: -Math.PI / 2, rotY: Math.PI / 2,
  });
  await yieldToBrowser();
  const studioRealism = addStudioRealism(scene, { cabinet: CAB, sideCabinet: CAB2 });
  await yieldToBrowser();

  // rolling tool chest beside the workbench
  function buildFallbackChest() {
    const chest = buildToolChest();
    chest.name = "bk_chest";
    chest.position.set(-2.22, 0, 1.06);
    chest.rotation.y = Math.PI / 2;
    scene.add(chest);
    MODELS.chest = chest;
  }
  if (!USE_BAKED) buildFallbackChest();

  /* ---------- realism set-dressing (approved 2026-07-12) ----------
     All real-time (no bk_ tags): renders over the baked room, no re-bake. */
  // B1: TIG welding cart + argon cylinder in the corner pocket between the
  // two display cabinets (echoes the TIG Welding skill)
  const weldCart = buildWeldingCart();
  weldCart.position.set(1.62, 0, -1.14);
  weldCart.rotation.y = 0.35;
  scene.add(weldCart);
  // wall-mounted FSAE Hoosier slick above the cart, flush to the back wall
  const hoosier = buildHoosierTire(loader);
  hoosier.position.set(1.62, 1.72, -1.405); // tire back (half-width 0.108) flush with the wainscot face (-1.515)
  scene.add(hoosier);
  // wall helmets on the back-wall pocket left of the main cabinet (Kefan's
  // STLs): welding helmet + white GT3 racing helmet, each on a steel peg
  // white GT3 takes the open middle of the pocket (visible from every
  // allowed camera angle); the dark weld helmet sits nearer the cabinet —
  // the cabinet flank occludes that slot from right-of-center views and the
  // dark shell on the white wall still reads from the remaining angles
  // helmets STACKED (Kefan): white GT3 racing helmet on TOP, welding helmet
  // BELOW it, same x. GT3 peg tip sits in the shell's REAR half — at z 0.005
  // it poked out below the chin bar (the GT3 runs much deeper than the weld).
  const gt3Helmet = buildWallHelmet(loader, "models/helmet-gt3.glb", -0.195, 0.12,
    new THREE.Vector3(0, 0.01, -0.055)); // tip up inside the shell so it doesn't poke below the chin
  gt3Helmet.position.set(-1.84, 1.94, -1.32); // depth 0.36 -> back near the wall (-1.515)
  scene.add(gt3Helmet);
  const weldHelmet = buildWallHelmet(loader, "models/helmet-weld.glb", -0.155, 0.12,
    new THREE.Vector3(0, -0.045, 0.005));
  weldHelmet.position.set(-1.84, 1.46, -1.36); // 0.48 below the GT3 (heights 0.36 + 0.32 -> 0.34 min gap)
  scene.add(weldHelmet);
  await yieldToBrowser();
  // E2: small fire extinguisher on the floor AGAINST the back wall, left of
  // the helmet stack (Kefan: 靠墙放)
  const fireExt = buildFireExtinguisher();
  fireExt.position.set(-1.66, 0, -1.4); // body r 0.052 -> back 0.052 clear of wall face -1.515
  fireExt.rotation.y = 0.25;
  scene.add(fireExt);
  // K1: a SECOND extinguisher lives at the hot-work corner — the only one in
  // the room sat 3.2 m from the welder, which no real shop would pass
  const fireExt2 = buildFireExtinguisher();
  fireExt2.position.set(2.14, 0, -1.2); // behind the cart, against the right corner
  fireExt2.rotation.y = -0.6;
  scene.add(fireExt2);
  // (K2 weld screen REMOVED 2026-07-14 per Kefan — do not re-add)
  // K3: hazard-striped hot-work border on the floor in front of the cart
  scene.add(buildHotWorkMark());
  // J5: weld stains + caster scuffs — the concrete looked poured yesterday
  scene.add(buildFloorStains());
  // K5: rolling lab stool at the electronics bench (the room's only seat was
  // the desk chair, 3 m from the soldering station)
  const stool = buildLabStool();
  stool.position.set(-1.82, 0, -0.72);
  scene.add(stool);
  // K6: scrap bin beside the tool chest — swarf and offcuts have to go somewhere
  const scrapBin = buildScrapBin();
  scrapBin.position.set(-2.14, 0, 1.62);
  scrapBin.rotation.y = 0.2;
  scene.add(scrapBin);
  // J1: the plain black desk pad becomes a gridded self-healing cutting mat
  // (REAL-TIME overlay — the pad itself is baked into the desk GLB)
  scene.add(buildCuttingMatOverlay());
  // (K7 desk tools REMOVED 2026-07-14 per Kefan — do not re-add)
  scene.add(buildFloorJoints()); // C2: saw-cut control joints in the slab
  scene.add(buildBenchMat());    // C4: ESD mat + ground lead at the bench
  // C5: lived-in chest top — the chest itself is baked, props ride on top
  const chestProps = buildChestTopProps();
  chestProps.position.set(-2.22, 0.791, 1.06);
  chestProps.rotation.y = Math.PI / 2;
  scene.add(chestProps);
  // (removed per Kefan 2026-07-12: the desk-lamp power cord across the desk)
  // (removed: the race-car schematic blueprint panel above the main cabinet)

  await yieldToBrowser();

  /* ---------- baked lighting (Blender/Cycles pipeline, tools/bake/) ----------
     The architecture layer (bk_* tagged) is swapped for a pre-baked GLB with
     a 2nd-UV lightmap; cabinets/workbench/exhibits stay real-time and get a
     matching baked 360 environment probe. Two light states are baked — the
     desk lamp is the room's light switch. Set USE_BAKED=false to fall back
     to the fully procedural room. */
  let lightsOn = false; // applied state; changes only after its own resources are ready
  let requestedLightsOn = false;
  let lightQuality = "2k", appliedQuality = "2k";
  let lightingBusy = false, lightFadeActive = false, gradePending = false;
  let lightTransition = Promise.resolve();
  let bakeActive = USE_BAKED, bakedRoot = null, fallbackBuilt = !USE_BAKED;
  const lightQueue = loader.queue; // GLB parse and HDR decode/upload share one slot
  const hdrLoader = new HDRLoader();
  const hdrService = createHDRService({ workers: 2 });
  let hdrFallback = false;
  async function decodeLighting(url, flip) {
    if (hdrFallback) return null;
    try { return await hdrService.load(url, { flipRows: flip }); }
    catch (error) {
      if (hdrFallback || error.code === "HDR_WORKER_UNAVAILABLE" || error.code === "HDR_WORKER_ERROR") {
        if (!hdrFallback) console.warn("[experience] HDR worker unavailable; using the queued decoder", error);
        hdrFallback = true;
        hdrService.dispose();
        return null;
      }
      throw error;
    }
  }
  async function loadHDRFallback(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HDR HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      // Used only if Web Workers cannot run. Keep the original r185 parser,
      // with an abortable fetch so a stalled fallback cannot hold the queue.
      return createHDRTexture(THREE, hdrLoader.parse(buffer));
    } finally { clearTimeout(timeout); }
  }
  const lightRequests = new Map();
  const lightFailures = new Map();
  const qualityControl = document.getElementById("exp-light-quality");
  const qualityStatus = document.getElementById("exp-quality-status");
  let bakedMats = [];
  const LM = { on2k: null, off2k: null, on4k: null, off4k: null, probeOn: null, probeOff: null, deskOn: null, deskOff: null };
  // night-mode practicals: warm pool over the workbench (its lamp + printer
  // read as the only bench light) and the desk lamp's own LEDs glow warm
  const benchGlow = new THREE.PointLight(0xe8ecf2, 0, 1.7, 2);
  benchGlow.position.set(-2.3, 1.25, -1.1);
  scene.add(benchGlow);
  // I2: the LED bar lamp over the instrument cluster now CASTS its light —
  // it was the brightest shape on that wall at night while the bench under
  // it stayed dark. Cool-white to match the fixture's own emissive.
  // S15: 0.72 rad (was 0.55) — at night the workbench wall fell to near-black
  // outside the old tight cone; wider + brighter pool keeps the mood but the
  // printer/pegboard silhouettes now read when orbiting left
  const benchBarSpot = new THREE.SpotLight(0xdfe8f5, 0, 2.2, 0.72, 0.6, 1.6);
  benchBarSpot.position.set(-2.4, 1.3, -1.15);
  benchBarSpot.target.position.set(-2.3, 0.79, -0.55);
  scene.add(benchBarSpot);
  scene.add(benchBarSpot.target);
  // museum follow-spot: fades in on the focused exhibit while its panel is
  // open (real-time layer only — the baked room ignores it)
  const focusSpot = new THREE.SpotLight(0xf2f5fa, 0, 3.5, 0.5, 1.0, 1.7);
  scene.add(focusSpot);
  scene.add(focusSpot.target);
  // the desk lamp's actual light. Kefan 2026-07-09: this spot used to hang in
  // mid-air in FRONT of the desk (0.3, 1.8, 0.9), so the lamp read as pure
  // decoration and the resume was barely lit. It now originates at the lamp's
  // LED head and rakes down onto the paper — the lamp is the desk's light.
  // (This is the ONE task-lamp light in the room; the bench lamp stays dark.)
  // angle/penumbra tuned by render: 0.40 keeps the pool ON the paper instead
  // of washing the whole desk top (the desk is baked-bright already)
  const resumeSpot = new THREE.SpotLight(0xffdcae, 0, 2.4, 0.4, 0.45, 1.6);
  deskLamp.updateMatrixWorld(true);
  resumeSpot.position
    .copy(deskLamp.localToWorld(deskLamp.userData.headLocal.clone()))
    .add(new THREE.Vector3(0, -0.008, 0));
  resumeSpot.target.position.set(0.02, 0.769, 0.16); // follows the lowered paper
  if (!LOW_TIER) {
    // shadows sell the source: the paper, tray and pen throw away from the lamp
    resumeSpot.castShadow = true;
    resumeSpot.shadow.autoUpdate = false;
    resumeSpot.shadow.needsUpdate = true;
    resumeSpot.shadow.mapSize.set(1024, 1024);
    resumeSpot.shadow.camera.near = 0.05;
    resumeSpot.shadow.camera.far = 2.4;
    resumeSpot.shadow.bias = -0.0009;
    resumeSpot.shadow.normalBias = 0.02;
  }
  scene.add(resumeSpot);
  scene.add(resumeSpot.target);

  /* ---- L5 wow pass: moonlight gobo + visible resume beam + dust ---- */
  // cold moonlight through an unseen window: a canvas-drawn window-frame
  // gobo projected across the rug and the desk's front edge (night only)
  const MOON_NIGHT = 11;
  const moonSpot = new THREE.SpotLight(0xbfd4ff, 0, 0, 0.38, 0.4, 1.1);
  moonSpot.map = (() => {
    const s = 256, c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillRect(0, 0, s, s);
    try { x.filter = "blur(7px)"; } catch (e) {}
    x.fillStyle = "#fff";
    const mg = 62, gap = 12, w = (s - 2 * mg - gap) / 2;
    [[mg, mg], [mg + w + gap, mg], [mg, mg + w + gap], [mg + w + gap, mg + w + gap]]
      .forEach(([px, py]) => x.fillRect(px, py, w, w));
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  moonSpot.position.set(-1.5, 3.3, 2.9);
  moonSpot.target.position.set(0.85, 0, 0.7);
  // (r185 gates lights by CAMERA layers only, and the camera has layer 1 on —
  // so this spot lights the baked floor/rug with no layer setup needed)
  scene.add(moonSpot);
  scene.add(moonSpot.target);

  // set while the first-visit boot choreography owns the light levels
  let bootTakeover = false;
  // bumped by every applyLightState call; stale step closures bail on mismatch
  let lightGen = 0;
  // crossfade uniforms shared by every baked material: lightMap blends
  // toward lightMapB by lmMix, so the lamp toggle FADES between light states
  const lmMix = { value: 0 };
  const lmB = { value: null };
  const deskLmA = { value: null }, deskLmB = { value: null };
  const blueLines = []; // rug LED inlay materials (baked GLB), glow at night
  const lampLeds = [];
  if (MODELS.deskLamp) MODELS.deskLamp.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0 && o.material.emissiveIntensity < 0.3) {
      lampLeds.push(o.material);
    }
  });
  // S8: while a case study is open at night, key/hemi lift so the focused
  // exhibit reads instead of silhouetting; closePanel eases them back
  let focusBoost = false;
  function applyLightState(animate) {
    // generation counter: a newer call (toggle or instant set) invalidates
    // any still-running step closure — without this, two quick lamp clicks
    // let the FIRST fade finish last and commit the wrong grade
    if (lightFadeActive) { gradePending = true; return lightTransition; }
    const gen = ++lightGen;
    const lm = LM[(lightsOn ? "on" : "off") + appliedQuality];
    const deskLm = LM[lightsOn ? "deskOn" : "deskOff"];
    const lmCurrent = bakedMats.length ? bakedMats[0].lightMap : null;
    const fadeLm = !!(lm && lmCurrent && lm !== lmCurrent && animate && !prefersReducedMotion);
    if (deskLm) {
      deskLmB.value = deskLm;
      if (!fadeLm) deskLmA.value = deskLm;
    }
    if (lm && !fadeLm) {
      bakedMats.forEach((m) => { m.lightMap = lm; });
      lmB.value = lm; // both samplers refer to live cached textures
      lmMix.value = 0;
    } else if (fadeLm) {
      lmB.value = lm;
      lmMix.value = 0;
    }
    const probe = lightsOn ? LM.probeOn : LM.probeOff;
    // instant paths swap the environment now; the animated fade swaps it at
    // its MIDPOINT instead — an instant reflection/ambient jump at the very
    // start of the fade was one of the toggle's visible "steps"
    if (probe && (!animate || prefersReducedMotion)) scene.environment = probe;
    // real-time lights serve the exhibits; dim them with the room
    let want = lightsOn
      ? { key: 1.15, hemi: 0.75, fill: 0.25, env: 0.5, bench: 0, resume: 0, moon: 0, pendant: 2.6 } // day grade: strips + bake carry the room
      // night: the desk lamp (resume) is the dominant practical, the pendant
      // recedes to a whisper so the lamp's pool owns the desk
      // resume 1.5, NOT higher: sampled at 2.8 the pool washed out the sheet's
      // upper half (DOM-parity texture has more white than the old Arial mini);
      // at 1.5 every section reads while the pool still owns the mat (Kefan)
      : { key: 0.22, hemi: 0.16, fill: 0.05, env: 0.35, bench: 0.95, resume: 1.5, moon: MOON_NIGHT, pendant: 0.3 };
    // S8 reading light: every applyLightState caller (including the late 4k
    // lightmap upgrades) respects the boost, so nothing can stomp it mid-read
    if (focusBoost && !lightsOn) want = { ...want, key: 0.55, hemi: 0.32 };
    if (bootTakeover) return; // the boot choreography owns the levels; it lands on these values
    blueLines.forEach((m) => {
      m.emissive = m.emissive || new THREE.Color(0x2b4d80);
      m.emissive.setHex(0x3f8cff);
    });
    // the LED strips and the rug inlay used to SNAP to their new values while
    // everything else eased — the pops at fade start read as jank. They ride
    // the same eased step now.
    const wantLed = lightsOn ? 0.05 : 2.4;
    const wantBlue = lightsOn ? 0.12 : 1.1; // LED inlay glows at night
    const from = {
      key: key.intensity, hemi: hemi.intensity, fill: fill.intensity,
      env: scene.environmentIntensity, bench: benchGlow.intensity,
      resume: resumeSpot.intensity, moon: moonSpot.intensity,
      pendant: MODELS.pendantLight.intensity,
      led: lampLeds.length ? lampLeds[0].emissiveIntensity : wantLed,
      blue: blueLines.length ? blueLines[0].emissiveIntensity : wantBlue,
    };
    if (prefersReducedMotion || !animate) {
      key.intensity = want.key; hemi.intensity = want.hemi; fill.intensity = want.fill;
      scene.environmentIntensity = want.env; benchGlow.intensity = want.bench;
      resumeSpot.intensity = want.resume;
      moonSpot.intensity = want.moon;
      MODELS.pendantLight.intensity = want.pendant;
      benchBarSpot.intensity = want.bench * 1.6; // I2 ramp; S15 raised 1.2→1.6
      // I1: the bulb's visible glow follows its actual light output
      if (MODELS.pendantBulb) MODELS.pendantBulb.material.emissiveIntensity = 0.15 + 0.85 * (want.pendant / 2.6);
      if (MODELS.pendantShadeInner) MODELS.pendantShadeInner.material.emissiveIntensity = 0.06 + 0.6 * (want.pendant / 2.6);
      lampLeds.forEach((m) => { m.emissiveIntensity = wantLed; });
      blueLines.forEach((m) => { m.emissiveIntensity = wantBlue; });
      return;
    }
    lightFadeActive = true;
    let finishTransition;
    lightTransition = new Promise((resolve) => { finishTransition = resolve; });
    const t0 = performance.now();
    const DUR = fadeLm ? 800 : 450; // lightmap crossfade reads best a bit slower
    let probeSwapped = !probe;
    (function step(now) {
      if (gen !== lightGen) return; // superseded by a newer light-state call
      const k = Math.min(1, (now - t0) / DUR);
      const e = easeInOutCubic(k);
      key.intensity = from.key + (want.key - from.key) * e;
      hemi.intensity = from.hemi + (want.hemi - from.hemi) * e;
      fill.intensity = from.fill + (want.fill - from.fill) * e;
      scene.environmentIntensity = from.env + (want.env - from.env) * e;
      benchGlow.intensity = from.bench + (want.bench - from.bench) * e;
      resumeSpot.intensity = from.resume + (want.resume - from.resume) * e;
      moonSpot.intensity = from.moon + (want.moon - from.moon) * e;
      MODELS.pendantLight.intensity = from.pendant + (want.pendant - from.pendant) * e;
      benchBarSpot.intensity = (from.bench + (want.bench - from.bench) * e) * 1.6; // I2; S15
      if (MODELS.pendantBulb) { // I1
        MODELS.pendantBulb.material.emissiveIntensity = 0.15 + 0.85 * (MODELS.pendantLight.intensity / 2.6);
      }
      if (MODELS.pendantShadeInner) {
        MODELS.pendantShadeInner.material.emissiveIntensity = 0.06 + 0.6 * (MODELS.pendantLight.intensity / 2.6);
      }
      lampLeds.forEach((m) => { m.emissiveIntensity = from.led + (wantLed - from.led) * e; });
      blueLines.forEach((m) => { m.emissiveIntensity = from.blue + (wantBlue - from.blue) * e; });
      // swap the environment probe mid-fade, hidden inside the moving grade
      if (!probeSwapped && k >= 0.5) { probeSwapped = true; scene.environment = probe; }
      if (fadeLm) lmMix.value = e;
      if (k < 1) requestAnimationFrame(step);
      else {
        if (fadeLm) {
          bakedMats.forEach((m) => { m.lightMap = lm; });
          lmB.value = lm;
          deskLmA.value = deskLmB.value = deskLm;
          lmMix.value = 0;
        }
        lightFadeActive = false;
        finishTransition();
        if (gradePending && !lightingBusy) {
          gradePending = false;
          applyLightState(true);
        }
      }
    })(t0);
    return lightTransition;
  }
  function getLightResource(key, initial = false) {
    if (LM[key]) return Promise.resolve(LM[key]);
    if (lightRequests.has(key)) return lightRequests.get(key);
    const failure = lightFailures.get(key);
    if (failure && (failure.attempts >= 3 || performance.now() < failure.retryAt)) {
      return Promise.reject(new Error("Lighting resource unavailable; please try again later"));
    }
    const isProbe = key.startsWith("probe");
    const url = ROOM_BAKE[key];
    // HDR probes use the bounded worker; compact lightmaps decode off-thread
    // as straight-alpha ImageBitmaps. GPU upload still shares the paced queue.
    const decoded = isProbe ? decodeLighting(url, false).then(async pixels =>
      pixels ? createHDRTexture(THREE, pixels) : loadHDRFallback(url)) :
      loadRGBMLightmap(url, { range: ROOM_BAKE.range });
    const promise = decoded.then((texture) => lightQueue.add(async () => {
      if (document.hidden) await waitForVisible();
      await yieldToBrowser();
      if (document.hidden) await waitForVisible();
      if (isProbe) {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const generator = new THREE.PMREMGenerator(renderer);
        try {
          // Keep the render target alive for the life of the cached probe.
          const target = generator.fromEquirectangular(texture);
          probeTargets.push(target);
          LM[key] = target.texture;
        } finally { generator.dispose(); texture.dispose(); }
      } else {
        try {
          renderer.initTexture(texture);
          LM[key] = texture;
        } catch (error) { texture.dispose(); throw error; }
      }
      return LM[key];
    }, initial ? -90 : -20)).catch((error) => {
      const attempts = (lightFailures.get(key)?.attempts || 0) + 1;
      lightFailures.set(key, { attempts, retryAt: performance.now() + 10000 });
      console.warn(`[experience] lighting resource failed: ${url}`, error);
      throw error;
    }).finally(() => lightRequests.delete(key));
    lightRequests.set(key, promise);
    return promise;
  }
  const probeTargets = [];
  function activateBakedRoom() {
    if (!bakeActive || !bakedRoot || !LM.off2k || !LM.probeOff || !LM.deskOff) return;
    scene.children.forEach((o) => {
      if (o === bakedRoot) return;
      let tagged = false;
      o.traverse((m) => { if (m.name.startsWith("bk_")) tagged = true; });
      if (tagged) o.visible = false;
    });
    bakedRoot.visible = true;
    applyLightState(false);
  }
  function restoreProceduralRoom(error) {
    bakeActive = false;
    if (bakedRoot) bakedRoot.visible = false;
    bakedMats = [];
    blueLines.length = 0;
    scene.children.forEach((o) => {
      if (o === bakedRoot) return;
      let tagged = false;
      o.traverse((m) => { if (m.name.startsWith("bk_")) tagged = true; });
      if (tagged) o.visible = true;
    });
    if (!fallbackBuilt) {
      fallbackBuilt = true;
      buildFallbackRug(); buildFallbackDesk(); buildFallbackChest();
    }
    applyLightState(false);
    readiness.failures.push("baked-room-fallback");
    console.warn("[experience] using procedural room fallback", error);
  }
  function updateLightingUI(message = "") {
    if (qualityControl) {
      qualityControl.value = lightQuality;
      qualityControl.setAttribute("aria-busy", String(lightingBusy));
    }
    if (qualityStatus) qualityStatus.textContent = message || (lightingBusy ? "Loading lighting" : "");
    const lightToggle = document.getElementById("exp-light-toggle");
    if (lightToggle) {
      lightToggle.setAttribute("aria-pressed", String(requestedLightsOn));
      lightToggle.setAttribute("aria-busy", String(lightingBusy));
      lightToggle.setAttribute("aria-label", requestedLightsOn ? "Turn room lights off" : "Turn room lights on");
      lightToggle.querySelector("[data-light-label]").textContent = lightingBusy ? "Loading" : "Lights";
    }
    deskLamp.userData.hotspot.label = lightingBusy ? "Loading room lights" : "Room lights";
  }
  async function syncLighting() {
    if (lightingBusy) return;
    lightingBusy = true;
    updateLightingUI();
    try {
      await initialLightingReady;
      while (lightsOn !== requestedLightsOn || appliedQuality !== lightQuality) {
        const day = requestedLightsOn, quality = lightQuality;
        if (bakeActive) {
          // First daylight use always prepares the matching 2K map + probe.
          await Promise.all([getLightResource(day ? "on2k" : "off2k"), getLightResource(day ? "probeOn" : "probeOff"), getLightResource(day ? "deskOn" : "deskOff")]);
          if (day !== requestedLightsOn || quality !== lightQuality) continue;
          if (quality === "4k") await getLightResource(day ? "on4k" : "off4k");
          if (day !== requestedLightsOn || quality !== lightQuality) continue;
        }
        await lightTransition; // serialize crossfades, including focus-light ramps
        if (day !== requestedLightsOn || quality !== lightQuality) continue;
        cancelBoot();
        lightsOn = day;
        appliedQuality = quality;
        await applyLightState(true);
      }
    } catch (error) {
      requestedLightsOn = lightsOn;
      lightQuality = appliedQuality;
      updateLightingUI("Lighting unavailable. Try again shortly.");
      console.warn("[experience] keeping current lighting", error);
    } finally {
      lightingBusy = false;
      if (gradePending) { gradePending = false; applyLightState(true); }
      updateLightingUI(qualityStatus?.textContent.startsWith("Lighting unavailable") ? qualityStatus.textContent : "");
    }
  }
  function toggleRoomLights() {
    if (!readiness.revealed) return;
    requestedLightsOn = !requestedLightsOn;
    sndClick();
    void syncLighting();
  }
  qualityControl?.addEventListener("change", () => {
    if (!readiness.revealed) { updateLightingUI(); return; }
    lightQuality = qualityControl.value === "4k" ? "4k" : "2k";
    void syncLighting();
  });
  document.getElementById("exp-light-toggle")?.addEventListener("click", toggleRoomLights);
  let initialLightingReady = Promise.resolve();
  if (USE_BAKED) {
    applyLightState(false);
    manager.itemStart("initial-lighting");
    initialLightingReady = Promise.allSettled([
      getLightResource("off2k", true), getLightResource("probeOff", true), getLightResource("deskOff", true),
    ]).then((results) => {
      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
      activateBakedRoom(); applyLightState(false);
    })
      .catch(restoreProceduralRoom)
      .finally(() => manager.itemEnd("initial-lighting"));
    // Keep imported PBR/specular response. The verified material hook replaces
    // diffuse with the Cycles result; camera layers do not isolate lights.
    camera.layers.enable(1);
    loader.load(ROOM_BAKE.geometry, (gltf) => {
      const pt = TEX.loadPBR("painted_plaster_wall");
      const fMap = repeatedTexture(pt.map, 8, 8);
      const fNor = repeatedTexture(pt.normalMap, 8, 8);
      const fRgh = repeatedTexture(pt.roughnessMap, 8, 8);
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material.clone();
        o.material = m;
        m.lightMapIntensity = BAKED_LIGHT_GAIN;
        m.envMapIntensity = 0.5;
        // Blender rewrites baseColor on texture-stripped materials, so match
        // the two big textured surfaces by GEOMETRY instead: the floor is the
        // 16x16 plane, the walls are the only >3m-tall slabs
        // node transforms are inconsistent in the export (walls/floor are Y-up
        // with baked-in transforms, the pendant/desk nodes keep Blender's Z-up
        // plus a rotation), so every geometry test here must run in WORLD space
        o.geometry.computeBoundingBox();
        const wbb = o.geometry.boundingBox.clone();
        o.updateWorldMatrix(true, false);
        wbb.applyMatrix4(o.matrixWorld);
        const s = wbb.getSize(new THREE.Vector3());
        const role = o.userData.surfaceRole || o.parent?.userData.surfaceRole;
        const isDesk = role === "desk" || (s.x > 1.7 && s.x < 2.0 && s.y < 0.06 && s.z > 0.8 && s.z < 1.0);
        if (role === "floor" || (s.x > 10 && s.z > 10 && s.y < 0.5)) {
          m.map = fMap; m.normalMap = fNor; m.roughnessMap = fRgh;
          m.color.setHex(COL.floorTint);
        } else if (role === "wall" || (s.y > 3 && Math.max(s.x, s.z) > 4)) {
          m.map = pt.map; m.normalMap = pt.normalMap; m.roughnessMap = pt.roughnessMap;
          m.color.setHex(COL.wallTint);
        } else if (isDesk) {
          // J1: the desk slab — micro-wear so the largest close-range surface
          // stops reading injection-molded (map base ≈ its old 0.52 roughness)
          m.roughnessMap = deskWearTex();
          m.roughness = 1.0;
        } else {
          // H4 rebuilt the pendant (bell shade, canopy, live bulb) as a
          // real-time group — hide the old cone frozen into the bake, or the
          // two fixtures overlap at the same hang point
          const c = wbb.getCenter(new THREE.Vector3());
          if (c.y > 2.1 && Math.abs(c.x - 0.15) < 0.3 && Math.abs(c.z - 0.35) < 0.3 && Math.max(s.x, s.z) < 0.5) {
            o.visible = false;
            return;
          }
          // the old baked desk pad (0.44 x 0.5, 1 mm proud of the slab): the
          // real-time cutting mat replaces it — the mat used to float 6 mm
          // above it and the pad peeked out underneath at grazing angles
          if (s.y < 0.01 && s.x > 0.35 && s.x < 0.55 && s.z > 0.4 && s.z < 0.6 &&
              Math.abs(c.x - 0.02) < 0.1 && Math.abs(c.y - 0.763) < 0.02 && Math.abs(c.z - 0.16) < 0.1) {
            o.visible = false;
            return;
          }
        }
        // the rug's blue LED inlay lines glow for real at night
        if (m.color && m.color.getHexString() === "2b4d80") blueLines.push(m);
        installBakedDiffuse(m, { secondMap: lmB, blend: lmMix, range: ROOM_BAKE.range,
          detail: isDesk ? { firstMap: deskLmA, secondMap: deskLmB, bounds: ROOM_BAKE.deskBounds } : null });
        o.layers.set(1);
        o.castShadow = false;
        o.receiveShadow = false;
        bakedMats.push(m);
      });
      bakedRoot = gltf.scene;
      bakedRoot.visible = false;
      scene.add(bakedRoot);
      activateBakedRoom();
      ANISO_DIRTY = true;
    }, undefined, restoreProceduralRoom);
  }

  // real ergonomic mesh task chair (CC BY 4.0 — see ATTRIBUTIONS.txt);
  // replaces the old procedural buildErgoChair() stand-in
  loadModel(loader, scene, "models/ergonomic_mesh_office_chair/ergonomic_mesh_office_chair.glb", {
    // the GLB's intrinsic front is +x, so 1.34 rad turns it to face the desk
    name: "chair", targetSize: 0.95, axis: "y", pos: [-0.25, 0, 1.05], rotY: 1.34,
  });

  /* ---------- resize ---------- */
  const adaptiveQuality = new AdaptiveQuality();
  const gpuTimer = new GpuFrameTimer(renderer.getContext());
  let resolutionScale = 1, pendingResolutionScale = 1;
  let displayDpr = window.devicePixelRatio;
  let displayWidth = window.screen.width, displayHeight = window.screen.height;
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const a = w / h;
    camera.aspect = a;
    // S13: portrait phones — a fixed 42° vertical fov collapses horizontal
    // fov to ~20° and hides 9 of the 16 exhibits at the rest pose; widen
    // vertically as the aspect drops, and let the user pinch farther out
    camera.fov = a < 1 ? Math.min(64, 42 / Math.pow(a, 0.42)) : 42;
    controls.maxDistance = a < 1 ? 4.0 : 3.2;
    camera.updateProjectionMatrix();
    displayDpr = window.devicePixelRatio;
    displayWidth = window.screen.width; displayHeight = window.screen.height;
    renderer.setPixelRatio(pixelRatioFor(w, h) * resolutionScale);
    renderer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);
  onResize(); // S13: apply the portrait fov on a phone's very first frame too

  /* ---------- camera flight system ---------- */
  let flight = null;
  const cameraIntro = { plays: 0, phase: "idle", completedLegs: 0 };
  // per-frame animation state (G-batch): tick delta + printer toolpath run
  let tickLast = null;
  let scopeLastDraw = 0;
  const headRun = { x: 0, dir: 1, dwell: 0, limit: 0.04 };
  function startFlight(toPos, toLook, ms, onDone, introLeg = false) {
    if (!introLeg && cameraIntro.phase === "playing") takeOverIntro();
    flight = {
      fromPos: camera.position.clone(),
      toPos: toPos.clone(),
      fromLook: controls.target.clone(),
      toLook: toLook.clone(),
      ms,
      start: null,
      onDone,
    };
    controls.enabled = false;
  }
  function startIntro(onDone = showDragHint) {
    camera.position.copy(FLY_POS);
    controls.target.set(0, 0.75, -0.1);
    cameraIntro.plays++;
    cameraIntro.phase = "playing";
    cameraIntro.completedLegs = 0;
    document.getElementById("exp-skip-intro").hidden = false;
    // Preserve the original first-visit path and timing, with no visit flag.
    const legs = [
      [new THREE.Vector3(0.7, 1.5, 1.9), new THREE.Vector3(2.3, 1.2, CAB2.z), 1700],
      [new THREE.Vector3(0.6, 1.45, 1.6), new THREE.Vector3(0, 1.2, -1.1), 1900],
      [REST_POS, REST_TARGET, 1500],
    ];
    const playLeg = (index) => {
      const [position, target, duration] = legs[index];
      startFlight(position, target, duration, () => {
        cameraIntro.completedLegs = index + 1;
        if (index + 1 < legs.length) playLeg(index + 1);
        else {
          cameraIntro.phase = "complete";
          document.getElementById("exp-skip-intro").hidden = true;
          onDone();
        }
      }, true);
    };
    playLeg(0);
  }
  function takeOverIntro(resetView = false) {
    if (cameraIntro.phase !== "playing") return;
    cameraIntro.phase = "interrupted";
    flight = null;
    // Preserve the current direction on pointer takeover; the explicit Skip
    // button lands at the original resting composition.
    if (resetView) {
      camera.position.copy(REST_POS);
      controls.target.copy(REST_TARGET);
    } else {
      const distance = camera.position.distanceTo(controls.target);
      camera.getWorldDirection(controls.target).multiplyScalar(distance).add(camera.position);
    }
    cancelBoot();
    applyLightState(false);
    controls.enabled = true;
    controls.update();
    document.getElementById("exp-skip-intro").hidden = true;
    showDragHint();
  }
  renderer.domElement.addEventListener("pointerdown", () => takeOverIntro(), { capture: true });
  renderer.domElement.addEventListener("wheel", () => takeOverIntro(), { capture: true, passive: true });
  renderer.domElement.addEventListener("keydown", () => takeOverIntro(), { capture: true });
  document.getElementById("exp-skip-intro").addEventListener("click", () => {
    takeOverIntro(true);
    renderer.domElement.focus();
  });

  const frameClock = new AdaptiveFrameClock({ idleFps: prefersReducedMotion ? 1 : 30 });
  const shadowClock = new AdaptiveFrameClock({ idleFps: 12, movingFps: 12, settleMs: 0 });
  const renderStats = { frames: 0, shadowFrames: 0, deskShadowFrames: 0, calls: 0, triangles: 0, cpuMs: 0 };
  let lastCameraMotion = performance.now(), lastLODUpdate = -Infinity;
  let shadowsDirty = true;
  const lastCameraPosition = camera.position.clone();
  const lastCameraQuaternion = camera.quaternion.clone();
  const baseDamping = controls.dampingFactor;
  let rafStamp = null, refreshBudget = 1000 / 60;
  const rafDeltas = [];
  let rafSamples = 0;
  controls.addEventListener("start", () => frameClock.noteMotion(performance.now()));
  controls.addEventListener("change", () => frameClock.noteMotion(performance.now()));
  let projectPageOpen = false;
  let running = !document.hidden;
  const studioNavigation = createStudioNavigation({ onActiveChange(open) {
    projectPageOpen = open;
    running = !document.hidden && !open;
    frameClock.reset(); shadowClock.reset(); tickLast = null; rafStamp = null;
    renderer.setAnimationLoop(running ? tick : null);
    if (!open) { try { sessionStorage.removeItem(ROOM_RETURN_KEY); } catch {} }
  } });
  window.addEventListener("pagehide", (event) => {
    running = false;
    if (!event.persisted) {
      loader.dispose();
      hdrService.dispose();
      renderer.setAnimationLoop(null);
      gpuTimer.dispose();
    }
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      running = !document.hidden && !projectPageOpen; frameClock.reset(); tickLast = null;
      renderer.setAnimationLoop(running ? tick : null);
    }
  });
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden && !projectPageOpen;
    frameClock.reset();
    shadowClock.reset();
    pendingResolutionScale = adaptiveQuality.reset();
    gpuTimer.reset();
    rafStamp = null;
    rafDeltas.length = 0;
    tickLast = null;
    renderer.setAnimationLoop(running ? tick : null);
  });

  // named + exposed (see window.__exp.pump) so QA can hand-step frames with
  // synthetic timestamps in a backgrounded tab, where rAF never fires
  const tick = (t, forced) => {
    // Estimate the display's available cadence from raw (ungated) callbacks.
    // A 60 Hz display must not lose resolution chasing unattainable 120 Hz.
    if (!forced) {
      const delta = rafStamp === null ? 0 : t - rafStamp;
      rafStamp = t;
      if (delta >= 3 && delta <= 40) {
        rafDeltas.push(delta);
        if (rafDeltas.length > 90) rafDeltas.shift();
        if (++rafSamples % 30 === 0 && rafDeltas.length >= 12 && frameClock.fps === frameClock.idleFps) {
          const sorted = [...rafDeltas].sort((a, b) => a - b);
          refreshBudget = Math.max(1000 / 120, sorted[Math.floor(sorted.length * 0.15)]);
        }
      }
    }
    if (!readiness.assets || !readiness.construction || !readiness.prepared) return;
    if (!running && !forced) return;
    const cameraMoved = lastCameraPosition.distanceToSquared(camera.position) > 1e-10 ||
      1 - Math.abs(lastCameraQuaternion.dot(camera.quaternion)) > 1e-10;
    const interactionMotion = !!flight || cameraMoved || !!paperMotion || lightFadeActive || bootTakeover;
    if (cameraMoved || flight) lastCameraMotion = t;
    if (!forced && !frameClock.accept(t, interactionMotion)) return;
    const dtms = tickLast === null ? 1000 / 60 : Math.min(100, Math.max(0, t - tickLast));
    tickLast = t;
    controls.dampingFactor = frameAlpha(baseDamping, dtms);
    const scale = frameClock.fps === frameClock.idleFps ? 1 : pendingResolutionScale;
    if (scale !== resolutionScale) {
      resolutionScale = scale;
      onResize(); // resize before drawing, never blank an already-drawn frame
      gpuTimer.reset();
    }
    // A monitor/DPI change need not dispatch a resize event.
    if (window.devicePixelRatio !== displayDpr || window.screen.width !== displayWidth || window.screen.height !== displayHeight) onResize();

    if (ANISO_DIRTY) {
      ANISO_DIRTY = false;
      scene.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          if (!m) continue;
          for (const slot of ["map", "emissiveMap", "roughnessMap", "metalnessMap", "normalMap", "aoMap"]) {
            const texture = m[slot];
            if (texture && texture.anisotropy < MAXA) ANISO_PENDING.add(texture);
          }
        }
      });
    }
    for (const texture of ANISO_PENDING) {
      if (!textureReady(texture)) continue; // retain until source resolves, no empty upload
      if (texture.anisotropy < MAXA) {
        texture.anisotropy = MAXA;
        texture.needsUpdate = true;
      }
      ANISO_PENDING.delete(texture);
    }

    if (flight) {
      if (flight.start === null) flight.start = t;
      const p = Math.min((t - flight.start) / flight.ms, 1);
      const e = easeInOutCubic(p);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
      const look = flight.fromLook.clone().lerp(flight.toLook, e);
      camera.lookAt(look);
      if (p >= 1) {
        const done = flight.onDone;
        controls.target.copy(flight.toLook);
        flight = null;
        // focusHotspot marks the interaction busy before either overlay opens;
        // keep OrbitControls disabled through the résumé pickup choreography.
        if (!panelOpen) {
          controls.enabled = true;
          controls.update();
        }
        if (done) done();
      }
    } else {
      // OrbitControls.update() ignores `enabled` and force-applies its
      // min/max-distance + azimuth clamps — after a fly-in (camera ~1.0 from
      // the exhibit, minDistance 1.4) that reads as a sudden zoom jump. Only
      // update while the user actually has control.
      if (controls.enabled) controls.update();
      // hard-clamp the camera inside the room shell so no orbit/zoom
      // combination can ever peek past a wall
      const cp = camera.position;
      const bx = cp.x, by = cp.y, bz = cp.z;
      cp.x = Math.max(-2.35, Math.min(2.35, cp.x));
      cp.z = Math.max(-1.25, Math.min(3.35, cp.z));
      cp.y = Math.max(0.4, Math.min(3.15, cp.y));
      // OrbitControls.update() baked its lookAt from the PRE-clamp position;
      // when the wall clamp actually moved the camera (e.g. zoomed out toward
      // a side wall) the frame would render mis-aimed, so re-aim at the target.
      if (controls.enabled && (cp.x !== bx || cp.y !== by || cp.z !== bz)) camera.lookAt(controls.target);
    }


    // résumé pickup: fly the REAL sheet between its desk pose and the
    // camera-facing held pose. Runs on the same clock as the render (no
    // compositor/CSS divergence), with a slight arc so it reads as a hand
    // lifting the paper rather than a linear glide.
    if (paperMotion && activePaperPivot) {
      const pm = paperMotion;
      const pv = activePaperPivot;
      if (pm.t0 === null) pm.t0 = t;
      const k = Math.min(Math.max((t - pm.t0 - (pm.delay || 0)) / pm.dur, 0), 1);
      const e = easeInOutCubic(k);
      const face = paperHold && paperHold.face;
      if (pm.mode === "lift") {
        // the held target tracks the still-moving camera and converges
        paperHoldTargetWorld(paperHold, PM_POS, PM_QUAT);
        pv.position.lerpVectors(pm.fromPos, PM_POS, e);
        pv.quaternion.slerpQuaternions(pm.fromQuat, PM_QUAT, e);
        // arc rides the EASED value: sin(pi*k) had max vertical speed exactly
        // at k=1 (~310px/s of drop right at the DOM swap — measured 19px of
        // slide during the fade, the main ghosting source); sin(pi*e) has
        // zero end-slope, so the bow dies out with the rest of the motion
        pv.position.y += Math.sin(Math.PI * e) * 0.045;
        // Brighten the page to its held level WHILE IT IS STILL ON THE DESK
        // (during the pre-lift delay, camera diving in), then hold it CONSTANT
        // for the whole travel. Ramping during the flight made a glow sweep
        // across the moving sheet (amplified by bloom) — the "flash" Kefan saw.
        // The lamp pool DIMS in step (light handoff): otherwise pool+emissive
        // stack past the bloom threshold and the sheet flares at click.
        if (face) {
          const warmup = pm.delay ? Math.min(1, (t - pm.t0) / pm.delay) : 1;
          face.material.emissiveIntensity = paperGlowTarget() * warmup;
          if (paperSpotRest !== null) {
            resumeSpot.intensity = paperSpotRest + (SPOT_DIM - paperSpotRest) * warmup;
          }
          if (paperMoonRest !== null) {
            moonSpot.intensity = paperMoonRest * (1 - warmup);
          }
        }
        if (!pm.domShown && k >= PAPER_DOM_FADE_AT) {
          pm.domShown = true;
          showPaperDom(pm.gen);
        }
        if (k >= 1) paperMotion = null;
      } else {
        pv.position.lerpVectors(pm.fromPos, pm.toPos, e);
        pv.quaternion.slerpQuaternions(pm.fromQuat, pm.toQuat, e);
        pv.position.y += Math.sin(Math.PI * e) * 0.03; // zero end-slope: eases ONTO the desk
        // hold the glow CONSTANT through the travel, then let it hand off to
        // the lamp pool over the LAST stretch of the descent — by then the
        // sheet is back inside the (already restored) pool and nearly still,
        // so total luminance stays level instead of stepping at touchdown
        if (face) {
          const handoff = e < 0.82 ? 1 : 1 - (e - 0.82) / 0.18;
          face.material.emissiveIntensity = pm.fromGlow * handoff;
        }
        if (paperSpotRest !== null) {
          resumeSpot.intensity = SPOT_DIM + (paperSpotRest - SPOT_DIM) * e;
        }
        if (paperMoonRest !== null) {
          moonSpot.intensity = paperMoonRest * e; // moon rises back with the return
        }
        if (k >= 1) {
          // land EXACTLY on the remembered desk pose (and undo the full-bleed
          // aspect stretch — the desk prop is a true 3:4 sheet)
          pv.position.copy(pm.toPos);
          pv.quaternion.copy(pm.toQuat);
          pv.scale.setScalar((pv.userData.hotspot && pv.userData.hotspot.baseScale) || 1);
          if (face) face.material.emissiveIntensity = 0;
          if (paperSpotRest !== null) {
            resumeSpot.intensity = paperSpotRest;
            paperSpotRest = null;
          }
          if (paperMoonRest !== null) {
            moonSpot.intensity = paperMoonRest;
            paperMoonRest = null;
          }
          paperMotion = null;
          paperHold = null;
          activePaperPivot = null;
          paperReturning = false;
        }
      }
    }

    // Printer: the head runs a real TOOLPATH rhythm — constant-velocity
    // passes, a short dwell at each turnaround, pass length slightly
    // randomized. (The old pure sine read as a metronome, not a machine.)
    if (!prefersReducedMotion && MODELS.printerHead) {
      const hs = headRun;
      if (hs.dwell > 0) {
        hs.dwell -= dtms;
      } else {
        hs.x += hs.dir * 0.00024 * dtms; // ~0.24 m/s traverse
        if (hs.dir > 0 ? hs.x >= hs.limit : hs.x <= -hs.limit) {
          hs.x = hs.dir > 0 ? hs.limit : -hs.limit;
          hs.dir *= -1;
          hs.dwell = 120 + Math.random() * 180;             // line-end hitch
          hs.limit = 0.025 + Math.random() * 0.019;         // next pass length
        }
      }
      MODELS.printerHead.position.x = hs.x;
    }
    if (!prefersReducedMotion) {
      // G2: chamber circulation fan spins while the job runs
      if (MODELS.chamberFan) MODELS.chamberFan.rotation.z -= dtms * 0.0085;
      // G4: the blue feeder spool supplies the blue print (slow payout)
      if (MODELS.activeSpool) MODELS.activeSpool.rotation.x += dtms * 0.00028;
      // G5: status LED breathes like a real activity indicator
      if (MODELS.printerStatusLed) {
        MODELS.printerStatusLed.material.emissiveIntensity = 0.55 + 0.18 * Math.sin(t * 0.0016);
      }
      // G1: the scope trace crawls (cheap 128x80 canvas redraw ~11 fps)
      if (MODELS.scope && t - scopeLastDraw > 90) {
        scopeLastDraw = t;
        MODELS.scope.draw(t * 0.0045);
        MODELS.scope.tex.needsUpdate = true;
      }
      // G6: near-subliminal moonlight drift — "there is a real sky out there"
      moonSpot.target.position.x = 0.85 + 0.05 * Math.sin(t * 0.00008);
      moonSpot.target.position.z = 0.7 + 0.04 * Math.sin(t * 0.000063 + 1.7);
    }

    // focused exhibit slowly turns on its pedestal; DoF opens up
    // Scientific flow retains its reference orientation.
    if (panelOpen && focusedPivot && !prefersReducedMotion && focusedPivot.userData.hotspot.key !== "ansysCfd") {
      focusedPivot.rotation.y += 0.0035 * dtms / (1000 / 60);
    }
    // museum follow-spot eases onto the focused exhibit
    const spotWant = panelOpen && focusedPivot ? 1.6 : 0;
    focusSpot.intensity += (spotWant - focusSpot.intensity) * frameAlpha(0.06, dtms);
    if (focusedPivot) {
      const fc = focusedPivot.userData.hotspot.center;
      focusSpot.position.set(fc.x * 0.7, fc.y + 1.1, fc.z * 0.7 + 0.35);
      focusSpot.target.position.copy(fc);
    }
    if (bokeh) {
      // Reading-DoF opens ONLY once the sheet has fully settled: while the
      // bright sheet is MOVING, the bokeh gather bleeds it into the blurred
      // background as a trailing halo — reads as ghosting.
      const paperSettled = panelOpen && activePaperPivot && paperHold && !paperMotion;
      const want = panelOpen && focusedPivot ? 0.0018 : paperSettled ? 0.0012 : 0.0;
      const u = bokeh.uniforms;
      u.aperture.value += (want - u.aperture.value) * frameAlpha(0.08, dtms);
      // S5-adjacent (S3): the pass re-renders the whole scene for a blur of
      // ZERO on every idle frame — switch it off once the ease lands
      bokeh.enabled = want > 0 || u.aperture.value > 2e-5;
      if (panelOpen && focusedPivot) {
        u.focus.value = camera.position.distanceTo(focusedPivot.userData.hotspot.center);
      } else if (activePaperPivot && paperHold) {
        // pin focus to the sheet whenever it exists, so any residual
        // easing-out aperture can never defocus the paper itself
        u.focus.value = camera.position.distanceTo(paperHold.face.getWorldPosition(PM_V1));
      }
    }

    // Genshin-style interact markers: bob + pulse, hidden while busy
    const busy = panelOpen || !!flight || paperReturning;
    for (const h of HOTSPOTS) {
      // eased hover scale (an instant 6% pop read as a flash on click)
      const target = h === hovered && !busy ? h.userData.hotspot.baseScale * 1.06 : h.userData.hotspot.baseScale;
      if (Math.abs(h.scale.x - target) > 0.0004) {
        h.scale.setScalar(h.scale.x + (target - h.scale.x) * frameAlpha(0.16, dtms));
        shadowsDirty = true;
      }
      const m = h.userData.hotspot.marker;
      if (!m) continue;
      m.visible = !busy;
      if (!busy && !prefersReducedMotion) {
        const ph = h.userData.hotspot.phase;
        m.position.y = h.userData.hotspot.markerY + Math.sin(t * 0.0024 + ph) * 0.016;
        // higher floor than the old additive marker: normal blending needs
        // more opacity to stay legible, especially on white exhibits
        m.material.opacity = 0.72 + 0.24 * (0.5 + 0.5 * Math.sin(t * 0.003 + ph));
        const s = h === hovered ? 0.066 : 0.048;
        m.scale.setScalar(s);
      }
    }

    // sub-2% 1/f flicker on the warm practicals so the still room doesn't
    // read as a screenshot (applied around the render, then unwound)
    let flk = 0;
    // the sheet's light must be rock steady through the whole pickup cycle —
    // the pool flicker crossing the moving page read as "light flicker"
    const spotSteady = !!(paperMotion || activePaperPivot);
    if (!prefersReducedMotion) {
      flk = 1 + 0.013 * Math.sin(t * 0.00071) + 0.009 * Math.sin(t * 0.00173) + 0.006 * Math.sin(t * 0.00347);
      if (!spotSteady) resumeSpot.intensity *= flk;
      benchGlow.intensity *= flk;
      benchBarSpot.intensity *= flk;
      lampLeds.forEach((m) => { m.emissiveIntensity *= flk; });
    }

    // High detail is background work after the intro and a settled camera.
    // Project selection navigates away, so it must not start an obsolete GLB.
    loader.allowUpgrades = revealed && !flight && !bootTakeover && !panelOpen && t - lastCameraMotion > 900;
    let lodChanged = false;
    if (forced || t - lastLODUpdate >= 180) {
      lastLODUpdate = t;
      lodChanged = loader.update(camera, null, t);
    }
    const movingCasters = !prefersReducedMotion && !!MODELS.printerHead;
    const movingPaper = !!paperMotion || !!focusedPivot;
    const shadowDue = shadowClock.accept(t);
    const refreshAll = shadowsDirty || lodChanged || !!forced;
    key.shadow.needsUpdate ||= refreshAll || ((movingCasters || movingPaper) && shadowDue);
    resumeSpot.shadow.needsUpdate ||= refreshAll || movingPaper;
    renderer.shadowMap.needsUpdate = key.shadow.needsUpdate || resumeSpot.shadow.needsUpdate;
    if (key.shadow.needsUpdate) renderStats.shadowFrames++;
    if (resumeSpot.castShadow && resumeSpot.shadow.needsUpdate) renderStats.deskShadowFrames++;
    shadowsDirty = false;
    const gpuMs = gpuTimer.poll();
    gpuTimer.begin();
    const renderStart = performance.now();
    renderer.info.reset();
    try { composer.render(); } finally { gpuTimer.end(); }
    renderStats.frames++;
    renderStats.calls = renderer.info.render.calls;
    renderStats.triangles = renderer.info.render.triangles;
    renderStats.cpuMs = performance.now() - renderStart;
    pendingResolutionScale = adaptiveQuality.sample({
      now: performance.now(), moving: frameClock.fps === 120,
      frameMs: Math.max(performance.now() - renderStart, gpuMs ?? 0),
      frameBudgetMs: refreshBudget,
    });
    lastCameraPosition.copy(camera.position);
    lastCameraQuaternion.copy(camera.quaternion);
    if (!readiness.revealed && !revealPending && !renderer.getContext().isContextLost()) {
      readiness.firstFrame = true;
      revealPending = true;
      // The completed frame must reach a paint opportunity before the overlay leaves.
      requestAnimationFrame(() => {
        revealPending = false;
        if (!document.hidden && !renderer.getContext().isContextLost()) doReveal();
      });
    }

    if (flk) {
      if (!spotSteady) resumeSpot.intensity /= flk;
      benchGlow.intensity /= flk;
      benchBarSpot.intensity /= flk;
      lampLeds.forEach((m) => { m.emissiveIntensity /= flk; });
    }
  };
  renderer.setAnimationLoop(tick);

  /* ---------- interaction ---------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let panelOpen = false;
  let paperReturning = false;
  let focusedPivot = null;
  let downXY = null;
  const panelEl = document.getElementById("exp-panel");
  const paperEl = document.getElementById("exp-paper");
  const backdropEl = document.getElementById("exp-backdrop");
  const labelEl = document.getElementById("exp-label");
  const lightboxEl = document.getElementById("exp-lightbox");
  let panelGeneration = 0, panelReturnFocus = null;
  const panelTimers = new Set();
  for (const dialog of [panelEl, paperEl, lightboxEl]) {
    if (dialog) { dialog.inert = true; dialog.tabIndex = -1; }
  }
  function invalidatePanelWork() {
    panelGeneration++;
    for (const timer of panelTimers) clearTimeout(timer);
    panelTimers.clear();
    if (panelEl) { panelEl.style.opacity = ""; panelEl.style.transition = ""; }
    return panelGeneration;
  }
  function schedulePanelWork(callback, delay, generation = panelGeneration) {
    const timer = setTimeout(() => {
      panelTimers.delete(timer);
      if (generation === panelGeneration) callback();
    }, delay);
    panelTimers.add(timer);
  }
  /* ---- résumé pickup: the REAL 3D sheet flies to a camera-facing pose ----
     The camera approach and the lift overlap (one continuous reach-and-pick-
     up); the DOM sheet cross-fades in only once the paper has settled at the
     exact same on-screen rect, so nothing visibly "changes" mid-motion. */
  const PAPER_LIFT_DELAY_MS = 430; // lift starts while the camera still moves
  const PAPER_LIFT_MS = 900;       // desk -> held-in-front-of-camera flight
  const PAPER_RETURN_MS = 820;     // held -> desk (runs with the camera return)
  const PAPER_SWAP_MS = 240;       // DOM sheet opacity cross-fade (CSS: 220ms)
  // 0.93, measured (frame-stepped via __exp.pump): on-screen sheet slide
  // between the fade-start frame and full settle was 40.3px at the original
  // 0.78 (double-exposed the two text layers — Kefan's "ghosting" report),
  // 19.1px at 0.93 while the arc term still rode raw k, and 0.1px at 0.93
  // with the arc riding the eased value. Keep the arc on `e` (see the
  // paperMotion block) or this number regresses.
  const PAPER_DOM_FADE_AT = 0.93;  // lift progress at which the DOM fades in
  let activePaperPivot = null;
  let paperAnimGen = 0;
  let paperMotion = null; // in-flight lift/return tween, driven by the render loop
  let paperHold = null;   // projection of the DOM sheet rect into camera space
  // The lamp pool and the sheet's emissive HAND OFF to each other: stacking
  // them (pool 1.5 + emissive 0.7) crossed the bloom threshold and flashed
  // the sheet right at click; and a full pool flickering/cutting across the
  // rising sheet read as light flicker. The pool dims to this floor while
  // the page "wakes", and takes back over during the return.
  const SPOT_DIM = 0.35;
  let paperSpotRest = null; // resumeSpot level to restore after the cycle
  // The moon gobo (window-frame pattern, intensity 11 at night) sweeps the
  // rug AND the air in front of the desk — exactly the corridor the sheet
  // lifts through. Its bright squares painted a moving wash across the page
  // (the flicker/ghost wash in Kefan's screenshot), so it yields during the
  // pickup cycle and rises back with the return.
  let paperMoonRest = null;
  const PM_POS = new THREE.Vector3();
  const PM_QUAT = new THREE.Quaternion();
  const PM_V1 = new THREE.Vector3();

  /* ---------- custom cursor: ring + dot over the canvas (fine pointers) ---------- */
  const FINE_POINTER = window.matchMedia("(pointer: fine)").matches;
  let setCursorHover = (on) => {
    renderer.domElement.style.cursor = on ? "pointer" : "";
  };
  if (FINE_POINTER) {
    renderer.domElement.style.cursor = "none";
    const ring = document.createElement("div");
    ring.className = "exp-cursor exp-cursor--ring";
    const dot = document.createElement("div");
    dot.className = "exp-cursor exp-cursor--dot";
    document.body.append(ring, dot);
    let cx = -100, cy = -100, rx = -100, ry = -100;
    let ringScale = 1, wantScale = 1, down = false, hot = false, shown = false;
    const applyState = () => {
      wantScale = down ? 0.82 : hot ? 1.55 : 1;
      ring.classList.toggle("is-hot", hot);
      dot.classList.toggle("is-hot", hot);
    };
    const show = (v) => {
      if (shown === v) return;
      shown = v;
      ring.classList.toggle("is-on", v);
      dot.classList.toggle("is-on", v);
    };
    window.addEventListener("pointermove", (ev) => {
      cx = ev.clientX; cy = ev.clientY;
      show(ev.target === renderer.domElement);
      dot.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      if (prefersReducedMotion) {
        rx = cx; ry = cy;
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${wantScale})`;
      }
    }, { passive: true });
    window.addEventListener("pointerdown", () => { down = true; applyState(); });
    window.addEventListener("pointerup", () => { down = false; applyState(); });
    window.addEventListener("blur", () => show(false));
    document.documentElement.addEventListener("pointerleave", () => show(false));
    if (!prefersReducedMotion) {
      const tick = () => {
        rx += (cx - rx) * 0.3;
        ry += (cy - ry) * 0.3;
        ringScale += (wantScale - ringScale) * 0.22;
        ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${ringScale})`;
        requestAnimationFrame(tick);
      };
      tick();
    }
    setCursorHover = (on) => { hot = on; applyState(); };
  }

  /* ---------- one-time hint: the scene can be dragged to look around ---------- */
  const dragHintEl = document.getElementById("exp-draghint");
  // per page-load only (no localStorage): every visit gets the invitation
  // until the visitor actually drags — a refresh brings it back
  let dragHintDone = false;
  if (dragHintEl && !FINE_POINTER) {
    const t = dragHintEl.querySelector(".exp-draghint__text");
    if (t) t.textContent = "Swipe to look around";
  }
  function showDragHint() {
    if (dragHintDone || !dragHintEl || panelOpen) return;
    dragHintEl.hidden = false;
    requestAnimationFrame(() => dragHintEl.classList.add("is-on"));
    setTimeout(dismissDragHint, 5000); // auto-dismiss after 5s (or sooner on first drag)
  }
  function dismissDragHint() {
    if (dragHintDone) return;
    dragHintDone = true;
    if (!dragHintEl) return;
    dragHintEl.classList.remove("is-on");
    setTimeout(() => { if (dragHintEl) dragHintEl.hidden = true; }, 620);
    setTimeout(showClickHint, 1000); // teach the second verb: click an exhibit
  }
  // one-time follow-up hint: exhibits are clickable
  const clickHintEl = document.getElementById("exp-clickhint");
  let clickHintDone = false;
  if (!FINE_POINTER) { // S14: touch users get touch verbs
    const ct = clickHintEl && clickHintEl.querySelector(".exp-draghint__text");
    if (ct) ct.textContent = "Tap an exhibit to open its case study";
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive 3D studio. Swipe to look around, tap an exhibit to open its case study."
    );
  }
  function showClickHint() {
    if (clickHintDone || !clickHintEl || panelOpen) return;
    clickHintEl.hidden = false;
    requestAnimationFrame(() => clickHintEl.classList.add("is-on"));
    setTimeout(dismissClickHint, 2500); // brief nudge, then get out of the way
  }
  function dismissClickHint() {
    if (clickHintDone) return;
    clickHintDone = true;
    if (!clickHintEl) return;
    clickHintEl.classList.remove("is-on");
    setTimeout(() => { if (clickHintEl) clickHintEl.hidden = true; }, 620);
    setTimeout(showLampHint, 1200); // S9: third beat — teach the light switch
  }
  // S9: one-time (localStorage) tip that the desk lamp toggles the room
  // lights — day mode was effectively hidden content behind a hover-only
  // label on a decorative-looking lamp
  let lampHintDone = false;
  try { lampHintDone = localStorage.getItem("kw_lamphint") === "1"; } catch (e) {}
  let lampHintEl = null;
  function showLampHint() {
    if (lampHintDone || panelOpen) return;
    lampHintDone = true;
    try { localStorage.setItem("kw_lamphint", "1"); } catch (e) {}
    lampHintEl = document.createElement("div");
    lampHintEl.className = "exp-draghint exp-draghint--click";
    lampHintEl.setAttribute("aria-hidden", "true");
    lampHintEl.innerHTML = '<span class="exp-draghint__text">Tip — the desk lamp switches the room lights</span>';
    document.body.appendChild(lampHintEl);
    requestAnimationFrame(() => lampHintEl.classList.add("is-on"));
    setTimeout(dismissLampHint, 4000);
  }
  function dismissLampHint() {
    if (!lampHintEl) return;
    const el = lampHintEl;
    lampHintEl = null;
    el.classList.remove("is-on");
    setTimeout(() => el.remove(), 620);
  }
  // dismiss the moment the user actually drags to orbit the scene
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (dragHintDone || !downXY || !ev.buttons || panelOpen || flight) return;
    if (Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1]) > 8) dismissDragHint();
  }, { passive: true });

  function setHover(root) {
    if (hovered === root) return;
    frameClock.noteMotion(performance.now());
    hovered = root; // scale eases toward its target in the render loop (no pop)
    if (hovered) {
      setCursorHover(true);
      sndTick();
      if (labelEl) {
        const hs = hovered.userData.hotspot;
        if (hs.action === "skills") {
          // the skill wall reveals the full matrix in a wide hover card
          labelEl.classList.add("exp-label--wide");
          labelEl.innerHTML =
            `<b>${hs.label}</b>` +
            RESUME.skills
              .map((s) => `<span class="exp-label__row"><em>${s.group}</em>${s.items.join(" · ")}</span>`)
              .join("");
        } else {
          labelEl.classList.remove("exp-label--wide");
          const sub = hs.action === "resume"
            ? "Click to read"
            : hs.action === "lamp"
              ? "Click to toggle the lights"
              : (window.projectData && window.projectData[hs.key] && window.projectData[hs.key].kicker) || "";
          labelEl.innerHTML = `<b>${hs.label}</b>` + (sub ? `<span>${sub}</span>` : "");
        }
        labelEl.hidden = false;
      }
    } else {
      setCursorHover(false);
      if (labelEl) labelEl.hidden = true;
    }
  }
  function updatePointer(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    if (labelEl && !labelEl.hidden) {
      labelEl.style.left = ev.clientX + "px";
      labelEl.style.top = ev.clientY - 14 + "px";
    }
  }
  function pickHotspot() {
    raycaster.setFromCamera(pointer, camera);
    // Stable pick proxies avoid traversing both cached LOD geometry trees.
    const picks = HOTSPOTS.flatMap((h) => {
      const hs = h.userData.hotspot;
      return [hs.pickProxy, hs.marker].filter((o) => o?.visible);
    });
    const hits = raycaster.intersectObjects(picks, false);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.hotspot) o = o.parent;
    return o || null;
  }
  // Coalesce high-polling mice into one layout read and pick per animation frame.
  let hoverFrame = 0, pendingPointer = null;
  function clearPointerHover() {
    if (hoverFrame) cancelAnimationFrame(hoverFrame);
    hoverFrame = 0;
    pendingPointer = null;
    setHover(null);
  }
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (panelOpen || paperReturning || flight || ev.buttons) {
      clearPointerHover();
      return;
    }
    pendingPointer = { clientX: ev.clientX, clientY: ev.clientY };
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      const point = pendingPointer;
      pendingPointer = null;
      if (!point || panelOpen || paperReturning || flight) return;
      updatePointer(point);
      setHover(pickHotspot());
      // A newly opened label also needs the current pointer position.
      if (labelEl && !labelEl.hidden) {
        labelEl.style.left = point.clientX + "px";
        labelEl.style.top = point.clientY - 14 + "px";
      }
    });
  }, { passive: true });
  // the hover card would otherwise stay stuck when the pointer exits the
  // canvas (topbar, panel, window edge) without another canvas pointermove
  renderer.domElement.addEventListener("pointerleave", clearPointerHover);
  renderer.domElement.addEventListener("pointercancel", clearPointerHover);
  window.addEventListener("blur", clearPointerHover);
  renderer.domElement.addEventListener("pointerdown", (ev) => { downXY = [ev.clientX, ev.clientY]; });
  renderer.domElement.addEventListener("pointerup", (ev) => {
    if (!downXY) return;
    const moved = Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1]);
    downXY = null;
    if (moved > 6 || panelOpen || paperReturning || flight) {
      if (moved > 6 && !panelOpen && !paperReturning && !flight) dismissDragHint();
      return;
    }
    updatePointer(ev);
    const root = pickHotspot();
    if (!root) return;
    // the desk lamp is the room's light switch
    if (root.userData.hotspot.action === "lamp") { toggleRoomLights(); return; }
    focusHotspot(root);
  });

  function focusHotspot(root) {
    if (!readiness.revealed || paperReturning) return;
    takeOverIntro();
    const hs = root.userData.hotspot;
    if (hs.key && window.projectData?.[hs.key]) {
      const returnState = {
        position: camera.position.toArray(), target: controls.target.toArray(),
        lightsOn: requestedLightsOn, quality: lightQuality,
      };
      try {
        sessionStorage.setItem(ROOM_RETURN_KEY, JSON.stringify(returnState));
      } catch {}
      try { history.replaceState({...history.state, studioRoomReturn: returnState}, ""); } catch {}
      dismissDragHint();
      dismissClickHint();
      clearPointerHover();
      const exhibitSelect = document.getElementById("exp-project-select");
      if (exhibitSelect) exhibitSelect.value = "";
      studioNavigation.openProject(hs.key);
      return;
    }
    const html =
      hs.action === "resume"
        ? resumeHTML(RESUME)
        : hs.key && window.projectData && window.projectData[hs.key]
          ? projectHTML(window.projectData[hs.key])
          : null;
    if (!html) return; // hover-only hotspots (skill wall) keep their card
    if (!panelOpen) panelReturnFocus = document.activeElement;
    const generation = invalidatePanelWork();
    setHover(null);

    const c = hs.center;
    // approach from the room center, whatever wall the exhibit is on
    const dir = new THREE.Vector3(-c.x, 0, 0.35 - c.z);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    const focusPos = c.clone().addScaledVector(dir, 1.0);
    focusPos.y = Math.max(c.y + 0.06, 0.98);
    if (hs.action === "resume") focusPos.set(c.x + 0.28, c.y + 0.5, c.z + 0.75);
    // land the exhibit at the center of the viewport strip LEFT of the panel,
    // whatever the screen width: offset the look target so the model's NDC x
    // equals -(panel width fraction). d=1.0 matches the focusPos distance.
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const panelFrac = hs.action === "resume" ? 0 :
      Math.min((panelEl?.getBoundingClientRect().width || 700) / window.innerWidth, 0.55);
    const lookOff = panelFrac * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const focusLook = c.clone().addScaledVector(right, lookOff);

    panelOpen = true;
    setOverlayInert(true);
    // S8: at night the focused exhibit was a black silhouette next to its
    // panel — ease the room up while reading (rides the same 850ms fly-in)
    if (hs.action !== "resume" && !lightsOn && !focusBoost) {
      focusBoost = true;
      applyLightState(true);
    }
    focusedPivot = hs.key ? root : null;
    currentProjectKey = hs.key || null;
    const exhibitSelect = document.getElementById("exp-project-select");
    if (exhibitSelect) exhibitSelect.value = currentProjectKey || "";
    sndClick();
    sndWhoosh();
    // Lay out the heavy DOM résumé and raster proxy during the camera move,
    // before either becomes visible, so the pickup animation stays compositor-only.
    if (hs.action === "resume") preparePaperContent(html, root);
    if (prefersReducedMotion) {
      camera.position.copy(focusPos);
      controls.target.copy(focusLook);
      controls.enabled = false;
      camera.lookAt(focusLook);
      if (hs.action === "resume") openPaperInstant();
      else openPanel(html);
    } else {
      if (hs.action === "resume") {
        // One continuous reach-and-pick-up: the camera dips toward the desk
        // and, mid-approach, the physical sheet starts rising to meet it.
        // Sequenced on RENDER-LOOP time (not wall-clock timers), so a busy
        // main thread can never desync the two motions.
        startFlight(focusPos, focusLook, 850);
        beginPaperLift(PAPER_LIFT_DELAY_MS);
      } else {
        startFlight(focusPos, focusLook, 850);
        schedulePanelWork(() => openPanel(html, generation), 680, generation);
      }
    }
  }

  // fixed tour order for prev/next navigation (matches cabinet layout)
  const PROJECT_ORDER = ["carbonSeat", "aura", "scanner", "javelin", "steering", "brakeSim",
    "materialTest", "ansysCfd", "vineRobot", "seat", "ftc", "formlabs", "pool", "telecaster",
    "lineFollower", "education"];
  let currentProjectKey = null;
  // set for the duration of a stepProject() → openPanel() call so openPanel
  // knows to cross-fade the content swap instead of hard-cutting it (the
  // very first panel open must keep its untouched CSS slide-in)
  let isStepTransition = false;
  function stepProject(dir) {
    if (!currentProjectKey) return;
    const n = PROJECT_ORDER.length;
    let idx = PROJECT_ORDER.indexOf(currentProjectKey);
    for (let step = 1; step <= n; step++) {
      const key = PROJECT_ORDER[(idx + dir * step + n * step) % n];
      const pivot = HOTSPOTS.find((h) => h.userData.hotspot.key === key);
      if (pivot) {
        if (focusedPivot) focusedPivot.rotation.y = 0;
        recenterPivot(focusedPivot);
        focusedPivot = null;
        isStepTransition = true;
        focusHotspot(pivot);
        return;
      }
    }
  }
  function openPanel(html, generation = panelGeneration) {
    if (!panelEl || generation !== panelGeneration || !readiness.revealed) return;
    if (!panelOpen) panelReturnFocus = document.activeElement;
    panelOpen = true;
    setOverlayInert(true);
    dismissClickHint();
    const applyPanelContent = () => {
      if (generation !== panelGeneration || !panelOpen) return;
      panelEl.innerHTML = html;
      // prev / next tour bar (projects only — the resume sheet has no nav)
      if (currentProjectKey) {
        const idx = PROJECT_ORDER.indexOf(currentProjectKey);
        const nav = document.createElement("div");
        nav.className = "exp-panel__navbar";
        nav.innerHTML =
          `<button type="button" data-nav="-1" aria-label="Previous project">&larr; Prev</button>` +
          `<span>${String(idx + 1).padStart(2, "0")} / ${PROJECT_ORDER.length}</span>` +
          `<button type="button" data-nav="1" aria-label="Next project">Next &rarr;</button>`;
        nav.querySelectorAll("[data-nav]").forEach((b) =>
          b.addEventListener("click", () => { sndClick(); stepProject(+b.dataset.nav); }));
        panelEl.appendChild(nav);
      }
      panelEl.scrollTop = 0;
      panelEl.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closePanel));
      document.documentElement.classList.add("exp-panel-open");
      setDialogInteractive(panelEl, true);
      setHover(null);
      // keyboard users land on the close button, not lost in the canvas
      focusDialog(panelEl, panelEl.querySelector(".exp-panel__close"));
    };
    if (isStepTransition) {
      // Prev/Next: fade the outgoing content out, swap, then fade in —
      // only this path; the first-open slide-in stays untouched below
      isStepTransition = false;
      panelEl.style.transition = "opacity 150ms";
      panelEl.style.opacity = "0";
      schedulePanelWork(() => {
        applyPanelContent();
        panelEl.style.transition = "opacity 200ms";
        panelEl.style.opacity = "1";
        schedulePanelWork(() => {
          panelEl.style.opacity = "";
          panelEl.style.transition = "";
        }, 200, generation);
      }, 150, generation);
      return;
    }
    applyPanelContent();
  }
  let resumeReader = null, closingReader = false;
  function preparePaperContent(html, pivot) {
    if (!paperEl) return;
    setDialogInteractive(paperEl, false); // pre-painted for the lift, still inaccessible
    const rootClass = document.documentElement.classList;
    rootClass.remove("exp-paper-active", "exp-paper-open");

    resumeReader?.dispose();
    if (!paperEl.querySelector('.exp-sheet__viewport')) paperEl.innerHTML = html;
    paperEl.scrollTop = 0;
    resumeReader = attachResumeReader(paperEl, { reducedMotion: prefersReducedMotion });
    closingReader = false;
    paperEl.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closePanel));
    activePaperPivot = pivot;
    // remember the sheet's resting pose once — every pickup returns EXACTLY
    // here, so repeated open/close cycles can never drift the paper
    if (pivot && !pivot.userData.deskPose) {
      pivot.userData.deskPose = { pos: pivot.position.clone(), quat: pivot.quaternion.clone() };
    }
    // pre-paint the (transparent) sheet during the camera approach so its
    // later fade-in is compositor-only; visibility:hidden would skip painting
    paperEl.style.visibility = "visible";
  }

  // The desk and reader share a lossless rendering of the actual PDF.
  // No viewport-dependent DOM rasterization or scroll-sensitive print cache.
  if (paperEl && !paperEl.innerHTML.trim()) paperEl.innerHTML = resumeHTML(RESUME);

  // Project the DOM sheet's on-screen rect into camera space: at what
  // distance/offset must the physical sheet float so its printed face lands
  // pixel-aligned with the DOM sheet (width + top edge match, centered X)?
  function computePaperHold(pivot) {
    if (!paperEl || !pivot) return null;
    const root = pivot.userData.hotspot && pivot.userData.hotspot.pickupObject;
    const face = root && root.userData.resumeFace;
    if (!face) return null;
    pivot.updateWorldMatrix(true, true);
    camera.updateMatrixWorld(true);
    const rect = paperEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // The pivot can still carry the 6% hover scale-up at click time (users
    // hover to click!) while the render loop eases it back to baseScale
    // during the flight. Measure as if it had already settled — otherwise
    // the held distance is ~6% too far and the sheet lands smaller than the
    // DOM, popping at the swap (Kefan's "end-of-pickup flash").
    const hoverK = pivot.scale.x / ((pivot.userData.hotspot && pivot.userData.hotspot.baseScale) || 1) || 1;
    // The canonical Letter page and the reader use the same fixed aspect.
    const baseScale = (pivot.userData.hotspot && pivot.userData.hotspot.baseScale) || 1;
    pivot.scale.z = baseScale * hoverK;
    pivot.updateWorldMatrix(true, true);
    // Measure the printed edges directly through the rotated hierarchy,
    // excluding the temporary hover scale from the final held dimensions.
    const worldW = face.localToWorld(new THREE.Vector3(-RESUME_PAPER.width / 2, 0, 0))
      .distanceTo(face.localToWorld(new THREE.Vector3(RESUME_PAPER.width / 2, 0, 0))) / hoverK;
    const worldH = face.localToWorld(new THREE.Vector3(0, -RESUME_PAPER.height / 2, 0))
      .distanceTo(face.localToWorld(new THREE.Vector3(0, RESUME_PAPER.height / 2, 0))) / hoverK;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const W = window.innerWidth, H = window.innerHeight;
    // fit the sheet inside the DOM rect on BOTH axes (short viewports are
    // height-limited); larger distance = smaller on screen
    const distW = worldW * H / (2 * tanV * rect.width);
    const distH = worldH * H / (2 * tanV * rect.height);
    const dist = Math.max(camera.near + 0.12, distW, distH);
    const ppw = H / (2 * dist * tanV); // px per world unit at that distance
    // top-align with the DOM sheet: both layouts lead with the same name
    // block, so anchoring the top edge keeps the headline visually pinned
    const cxPx = rect.left + rect.width / 2;
    const cyPx = rect.top + (worldH * ppw) / 2;
    const ndcX = (cxPx / W) * 2 - 1;
    const ndcY = 1 - (cyPx / H) * 2;
    const localFacePos = new THREE.Vector3(
      ndcX * dist * tanV * camera.aspect,
      ndcY * dist * tanV,
      -dist
    );
    // constant hierarchy offsets pivot->face (valid whatever placeRoot did)
    const qPivot = pivot.getWorldQuaternion(new THREE.Quaternion());
    const qFace = face.getWorldQuaternion(new THREE.Quaternion());
    const qOffInv = qPivot.clone().invert().multiply(qFace).invert();
    // extract the face's pivot-local offset with the CURRENT scale (that is
    // what the measured world positions carry), but store the SETTLED scale
    // for reconstruction at the held pose, where the hover ease has decayed
    const pScaleNow = pivot.getWorldScale(new THREE.Vector3()).x || 1;
    const faceInPivot = face.getWorldPosition(new THREE.Vector3())
      .sub(pivot.getWorldPosition(new THREE.Vector3()))
      .applyQuaternion(qPivot.clone().invert())
      .divideScalar(pScaleNow);
    return { face, dist, localFacePos, qOffInv, faceInPivot, pScale: pScaleNow / hoverK };
  }

  // World-space pivot pose that puts the printed face at the held position,
  // upright and square to the CURRENT camera (recomputed per frame while the
  // camera is still flying, so the lift converges on the final framing).
  function paperHoldTargetWorld(hold, outPos, outQuat) {
    camera.updateMatrixWorld(true);
    const facePos = hold.localFacePos.clone().applyMatrix4(camera.matrixWorld);
    const camQ = camera.getWorldQuaternion(new THREE.Quaternion());
    // face plane local +Z (its normal) -> at the viewer; local +Y (texture
    // top) -> screen up: in camera space that is the identity orientation
    outQuat.copy(camQ).multiply(hold.qOffInv);
    const off = hold.faceInPivot.clone().multiplyScalar(hold.pScale).applyQuaternion(outQuat);
    outPos.copy(facePos).sub(off);
  }

  function paperGlowTarget() {
    // Calibrated by sampling the rendered sheet against the DOM sheet's
    // #fafbfd: night 0.7 -> ~239 sRGB (vs 250 DOM — imperceptible across the
    // 220ms cross-fade) while keeping body text crisp; 1.0 matched the white
    // exactly but UnrealBloom washed out the small type. Day still needs 0.5:
    // the held sheet faces the camera, AWAY from the key light (~167 sRGB
    // unassisted; +143 sRGB per emissive unit, sampled).
    return lightsOn ? 0.5 : 0.7;
  }

  // Cross-fade the interactive DOM sheet in over the settled 3D paper.
  function showPaperDom(gen) {
    if (!paperEl || gen !== paperAnimGen || !panelOpen) return;
    const rootClass = document.documentElement.classList;
    rootClass.add("exp-paper-active", "exp-paper-open");
    setDialogInteractive(paperEl, true);
    focusDialog(paperEl, paperEl.querySelector(".exp-sheet__close"));
    const finishSwap = () => {
      if (gen !== paperAnimGen || !panelOpen) return;
      // fully covered by the opaque DOM sheet now — stop rendering it
      if (activePaperPivot) activePaperPivot.visible = false;
    };
    if (prefersReducedMotion) finishSwap();
    else setTimeout(finishSwap, PAPER_SWAP_MS);
  }

  // Lift the REAL sheet off the desk: world-space flight from the desk pose
  // to the camera-facing held pose. Runs in the render loop (same clock as
  // the scene), overlapping the tail of the camera approach.
  function beginPaperLift(delayMs) {
    const pivot = activePaperPivot;
    if (!pivot || !panelOpen) return;
    const gen = ++paperAnimGen;
    // settle the hover scale-up NOW (reads as press feedback) so the sheet's
    // real size matches the hold math for the whole flight
    pivot.scale.setScalar((pivot.userData.hotspot && pivot.userData.hotspot.baseScale) || 1);
    // remember the lamp-pool + moon levels to restore after the cycle
    if (paperSpotRest === null) paperSpotRest = resumeSpot.intensity;
    if (paperMoonRest === null) paperMoonRest = moonSpot.intensity;
    // camera-independent: derived from the DOM rect + lens only, so it can
    // be computed at click time and the loop starts the lift after `delay`
    paperHold = computePaperHold(pivot);
    if (!paperHold) { showPaperDom(gen); return; } // degraded fallback
    // The original PDF texture stays attached throughout the complete flight.
    paperMotion = {
      mode: "lift", gen, t0: null, dur: PAPER_LIFT_MS, delay: delayMs || 0,
      fromPos: pivot.position.clone(), fromQuat: pivot.quaternion.clone(),
      domShown: false,
    };
  }

  function openPaperInstant() {
    // reduced motion: no flight, no lift — sheet appears, paper hides
    const gen = ++paperAnimGen;
    if (activePaperPivot) activePaperPivot.visible = false;
    showPaperDom(gen);
  }
  function recenterPivot(pivot) {
    // ease the showcase turntable spin back to its resting orientation
    if (!pivot) return;
    const tau = Math.PI * 2;
    let delta = pivot.rotation.y % tau;
    if (delta > Math.PI) delta -= tau;
    if (delta < -Math.PI) delta += tau;
    if (Math.abs(delta) < 0.001 || prefersReducedMotion) {
      pivot.rotation.y = 0;
      return;
    }
    const from = pivot.rotation.y;
    const t0 = performance.now();
    const dur = 600;
    const step = (now) => {
      if (panelOpen) return; // aborted by a re-open — the spin takes over
      const k = Math.min(1, (now - t0) / dur);
      pivot.rotation.y = from - delta * easeInOutCubic(k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function setOverlayInert(on) {
    // dialog containment: while the case-study panel / resume sheet is open,
    // the topbar and canvas leave the tab order so focus can't walk out from
    // under the modal into the scene behind the backdrop
    const topbar = document.querySelector(".exp-topbar");
    if (topbar) topbar.inert = on;
    const dock = document.getElementById("exp-dock");
    if (dock) dock.inert = on;
    renderer.domElement.inert = on;
    renderer.domElement.tabIndex = on ? -1 : 0;
  }
  function setDialogInteractive(dialog, on) {
    if (!dialog) return;
    dialog.inert = !on;
    if (on) dialog.setAttribute("aria-modal", "true");
  }
  function dialogTabStops(dialog) {
    return Array.from(dialog.querySelectorAll("button, a[href], input, select, textarea, [tabindex]"))
      .filter((node) => node.tabIndex >= 0 && !node.disabled && !node.closest("[inert]") &&
        node.getClientRects().length > 0 && getComputedStyle(node).visibility !== "hidden");
  }
  function focusDialog(dialog, preferred = null) {
    if (!dialog || dialog.inert) return;
    (preferred || dialogTabStops(dialog)[0] || dialog).focus({ preventScroll: true });
  }
  function restoreFocus(target, fallback = renderer.domElement) {
    const usable = target?.isConnected && target.tabIndex >= 0 && !target.disabled &&
      !target.closest("[inert]") && target.getClientRects().length > 0;
    (usable ? target : fallback)?.focus({ preventScroll: true });
  }
  function activeDialog() {
    const classes = document.documentElement.classList;
    if (classes.contains("exp-lightbox-open") && lightboxEl && !lightboxEl.inert) return lightboxEl;
    if (classes.contains("exp-paper-open") && paperEl && !paperEl.inert) return paperEl;
    if (classes.contains("exp-panel-open") && panelEl && !panelEl.inert) return panelEl;
    return null;
  }
  function closePanel() {
    if (!panelOpen || closingReader) return;
    // Restore the full printed page before the existing paper/DOM handoff.
    // Zooming out is a short, explicit reader motion, never a changed desk skin.
    if (activePaperPivot && resumeReader?.isZoomed() && document.documentElement.classList.contains("exp-paper-open")) {
      const reader = resumeReader;
      closingReader = true;
      reader.resetForClose().then(() => {
        closingReader = false;
        if (reader === resumeReader && panelOpen) closePanel();
      });
      return;
    }
    invalidatePanelWork();
    isStepTransition = false;
    closeLightbox(false);
    const rootClass = document.documentElement.classList;
    const closingPaperPivot = activePaperPivot;
    const closeGen = ++paperAnimGen;
    panelOpen = false;
    setDialogInteractive(panelEl, false);
    setDialogInteractive(paperEl, false);
    const exhibitSelect = document.getElementById("exp-project-select");
    if (exhibitSelect) exhibitSelect.value = "";
    setOverlayInert(false);
    if (focusBoost) { // S8: hand the night grade back
      focusBoost = false;
      if (!lightsOn) applyLightState(true);
    }
    recenterPivot(focusedPivot);
    focusedPivot = null;
    sndWhoosh(0.4);
    rootClass.remove("exp-panel-open");
    restoreFocus(panelReturnFocus);
    panelReturnFocus = null;

    const returnToRoom = () => {
      if (pendingDragHintOnClose) { pendingDragHintOnClose = false; showDragHint(); }
      if (prefersReducedMotion) {
        camera.position.copy(REST_POS);
        controls.target.copy(REST_TARGET);
        controls.enabled = true;
        controls.update();
      } else {
        startFlight(REST_POS, REST_TARGET, 750);
      }
    };

    if (closingPaperPivot) {
      // Kill the reading-DoF instantly, under the overlay fade: the eased-out
      // aperture kept a ~0.4s tail with focus STUCK at the held distance, so
      // the whole return flight rendered defocused (the "put-down" ghosting).
      if (bokeh) bokeh.uniforms.aperture.value = 0;
      const pivot = closingPaperPivot;
      const desk = pivot.userData.deskPose;
      const root = pivot.userData.hotspot && pivot.userData.hotspot.pickupObject;
      const face = root && root.userData.resumeFace;
      const domOpen = rootClass.contains("exp-paper-open");

      if (prefersReducedMotion || !desk) {
        paperMotion = null;
        paperHold = null;
        if (desk) { pivot.position.copy(desk.pos); pivot.quaternion.copy(desk.quat); }
        pivot.scale.setScalar((pivot.userData.hotspot && pivot.userData.hotspot.baseScale) || 1);
        if (face) face.material.emissiveIntensity = 0;
        if (paperSpotRest !== null) { resumeSpot.intensity = paperSpotRest; paperSpotRest = null; }
        if (paperMoonRest !== null) { moonSpot.intensity = paperMoonRest; paperMoonRest = null; }
        pivot.visible = true;
        rootClass.remove("exp-paper-active", "exp-paper-open");
        if (paperEl) paperEl.style.visibility = "";
        activePaperPivot = null;
        paperReturning = false;
        returnToRoom();
        return;
      }

      paperReturning = true;
      const startReturn = () => {
        if (closeGen !== paperAnimGen) return;
        if (paperEl) paperEl.style.visibility = "";
        // scale the flight time to how far the sheet actually is from the
        // desk, so an early Esc doesn't crawl back in slow motion
        const away = pivot.position.distanceTo(desk.pos);
        const dur = THREE.MathUtils.clamp(PAPER_RETURN_MS * (away / 0.7), 280, PAPER_RETURN_MS);
        paperMotion = {
          mode: "return", gen: closeGen, t0: null, dur,
          fromPos: pivot.position.clone(), fromQuat: pivot.quaternion.clone(),
          toPos: desk.pos.clone(), toQuat: desk.quat.clone(),
          fromGlow: face ? face.material.emissiveIntensity : 0,
        };
        returnToRoom(); // the sheet lands while the camera pulls away
      };

      if (domOpen && !paperMotion) {
        // Re-align the held sheet to the CURRENT camera/viewport (guards a
        // resize while reading), reveal it under the fading DOM, then fly it
        // back. Backdrop and DOM fade together, masking the handoff.
        const hold = computePaperHold(pivot);
        if (hold) {
          paperHold = hold;
          paperHoldTargetWorld(hold, PM_POS, PM_QUAT);
          pivot.position.copy(PM_POS);
          pivot.quaternion.copy(PM_QUAT);
          if (face) face.material.emissiveIntensity = paperGlowTarget();
        }
        pivot.visible = true;
        rootClass.remove("exp-paper-active", "exp-paper-open");
        setTimeout(startReturn, PAPER_SWAP_MS * 0.75);
      } else {
        // closed mid-lift: turn around from wherever the sheet is right now
        paperMotion = null;
        rootClass.remove("exp-paper-active", "exp-paper-open");
        startReturn();
      }
      return;
    }

    rootClass.remove("exp-paper-active", "exp-paper-open");
    if (paperEl) paperEl.style.visibility = "";
    activePaperPivot = null;
    paperReturning = false;
    returnToRoom();
  }
  // Real buttons share pointer/keyboard activation and retain their return focus.
  let lbShots = [], lbIdx = 0, lbReturnFocus = null;
  function closeLightbox(returnFocus = true) {
    if (!document.documentElement.classList.contains("exp-lightbox-open")) return;
    document.documentElement.classList.remove("exp-lightbox-open");
    setDialogInteractive(lightboxEl, false);
    setDialogInteractive(panelEl, panelOpen && !activePaperPivot);
    if (returnFocus) restoreFocus(lbReturnFocus, panelEl?.querySelector(".exp-panel__close"));
    lbReturnFocus = null;
  }
  function renderLightbox(focusAction = "close") {
    const s = lbShots[lbIdx];
    if (!s) return;
    lightboxEl.innerHTML =
      `<button type="button" class="exp-lightbox__btn exp-lightbox__close" data-lb="close" aria-label="Close">&times;</button>` +
      (lbShots.length > 1
        ? `<button type="button" class="exp-lightbox__btn exp-lightbox__prev" data-lb="-1" aria-label="Previous image">&lsaquo;</button>` +
          `<button type="button" class="exp-lightbox__btn exp-lightbox__next" data-lb="1" aria-label="Next image">&rsaquo;</button>`
        : "") +
      `<img src="${escapeMarkup(s.src)}" alt="${escapeMarkup(s.alt || "")}" decoding="async" /><p aria-live="polite" aria-atomic="true">${escapeMarkup(s.cap)}${lbShots.length > 1 ? `<span class="exp-lightbox__count">${lbIdx + 1} / ${lbShots.length}</span>` : ""}</p>`;
    focusDialog(lightboxEl, lightboxEl.querySelector(`[data-lb="${focusAction}"]`));
  }
  function stepLightbox(d) {
    if (!lbShots.length) return;
    const action = lightboxEl.contains(document.activeElement) ? document.activeElement.dataset.lb : "close";
    lbIdx = (lbIdx + d + lbShots.length) % lbShots.length;
    renderLightbox(["close", "-1", "1"].includes(action) ? action : "close");
    sndTick();
  }
  if (panelEl && lightboxEl) {
    panelEl.addEventListener("click", (ev) => {
      const button = ev.target.closest("[data-exp-gallery]");
      if (!button || panelEl.inert || !panelOpen) return;
      const all = Array.from(panelEl.querySelectorAll("[data-exp-gallery]"));
      lbShots = all.map((item) => {
        const im = item.querySelector("img");
        return { src: im.dataset.fullSrc || im.src, alt: im.alt,
          cap: item.closest("figure")?.querySelector("figcaption")?.textContent || "" };
      });
      lbIdx = Math.max(0, all.indexOf(button));
      lbReturnFocus = button;
      setDialogInteractive(panelEl, false);
      setDialogInteractive(lightboxEl, true);
      document.documentElement.classList.add("exp-lightbox-open");
      renderLightbox();
      sndClick();
    });
    lightboxEl.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-lb]");
      if (!b) return closeLightbox();
      if (b.dataset.lb === "close") return closeLightbox();
      stepLightbox(+b.dataset.lb);
    });
  }

  if (backdropEl) backdropEl.addEventListener("click", closePanel);
  function handleOverlayKeydown(e) {
    if (e.defaultPrevented || e.isComposing) return;
    const dialog = activeDialog();
    if (e.key === "Tab") {
      if (!dialog) { if (panelOpen) e.preventDefault(); return; }
      const stops = dialogTabStops(dialog);
      const first = stops[0], last = stops[stops.length - 1];
      if (!stops.length) { e.preventDefault(); focusDialog(dialog); return; }
      const current = document.activeElement;
      if (!stops.includes(current) || (e.shiftKey ? current === first : current === last)) {
        e.preventDefault();
        focusDialog(dialog, e.shiftKey ? last : first);
      }
      return;
    }
    if (e.key === "Escape") {
      if (dialog === lightboxEl && lightboxEl) { e.preventDefault(); closeLightbox(); }
      else if (panelOpen) { e.preventDefault(); closePanel(); }
      else if (panelTimers.size) { e.preventDefault(); invalidatePanelWork(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey ||
      e.target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
    const direction = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!direction) return;
    if (dialog === lightboxEl && lightboxEl) {
      e.preventDefault(); e.stopPropagation();
      stepLightbox(direction);
    } else if (panelOpen && currentProjectKey && !activePaperPivot) {
      e.preventDefault();
      sndClick(); stepProject(direction);
    }
  }
  // One dispatcher gives the topmost dialog exclusive arrow/Escape ownership.
  window.addEventListener("keydown", handleOverlayKeydown, true);
  document.addEventListener("focusin", (e) => {
    const dialog = activeDialog();
    if (dialog && !dialog.contains(e.target)) focusDialog(dialog);
  });

  /* ---------- keyboard navigation layer (additive; mirrors the pointer flow) ----------
     Cycle order: the 16 project pivots (PROJECT_ORDER), then résumé, then the
     lamp switch. Rebuilt fresh on every keypress (not snapshotted once) —
     the real-CAD exhibits attach to HOTSPOTS asynchronously as their GLTFs
     finish loading, so a one-time snapshot at init would miss most of them.
     Arrow keys move a highlight through the EXISTING hover path (setHover);
     Enter/Space activates exactly what pointerup does. */
  let kbIndex = -1;
  function kbOrder() {
    const order = [];
    PROJECT_ORDER.forEach((key) => {
      const pivot = HOTSPOTS.find((h) => h.userData.hotspot.key === key);
      if (pivot) order.push(pivot);
    });
    const resumePivot = HOTSPOTS.find((h) => h.userData.hotspot.action === "resume");
    if (resumePivot) order.push(resumePivot);
    const lampPivot = HOTSPOTS.find((h) => h.userData.hotspot.action === "lamp");
    if (lampPivot) order.push(lampPivot);
    return order;
  }
  function kbBusy() {
    return !!flight || panelOpen || paperReturning || document.documentElement.classList.contains("exp-lightbox-open");
  }
  function kbHighlight(order, next) {
    kbIndex = ((next % order.length) + order.length) % order.length;
    const root = order[kbIndex];
    setHover(root);
    // keyboard has no cursor: dock the label at the exhibit's projected screen
    // position (it used to render at the stale pointer coords — 0,0 offscreen)
    if (labelEl && !labelEl.hidden) {
      const v = new THREE.Vector3();
      new THREE.Box3().setFromObject(root).getCenter(v).project(camera);
      const r = renderer.domElement.getBoundingClientRect();
      labelEl.style.left = r.left + ((v.x + 1) / 2) * r.width + "px";
      labelEl.style.top = r.top + ((1 - v.y) / 2) * r.height - 18 + "px";
    }
  }
  renderer.domElement.addEventListener("keydown", (e) => {
    if (kbBusy()) return;
    const order = kbOrder();
    if (!order.length) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      kbHighlight(order, kbIndex + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      kbHighlight(order, kbIndex - 1);
    } else if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      if (kbIndex < 0 || kbIndex >= order.length) return;
      e.preventDefault();
      const root = order[kbIndex];
      if (root.userData.hotspot.action === "lamp") { toggleRoomLights(); return; }
      focusHotspot(root);
    }
  });
  // losing keyboard focus on the stage clears the keyboard highlight, same
  // path the pointer uses when it leaves the canvas
  renderer.domElement.addEventListener("blur", () => setHover(null));

  window.__exp = {
    THREE, scene, camera, renderer, controls, composer, bloom, key, hemi,
    models: MODELS, hotspots: HOTSPOTS, openPanel, showDragHint, runBootIntro,
    pump: (t) => tick(t, true), lod: loader, getLODStats: () => loader.getStats(), readiness,
    getFrameStats: () => frameClock.snapshot(),
    getNavigationStats: () => studioNavigation.snapshot(),
    getRenderStats: () => ({ ...renderStats, batching: batchingStats }),
    getBootStats: () => ({ ...bootStatus, active: bootTakeover }),
    getCameraIntroStats: () => ({ ...cameraIntro }),
    getRealismStats: () => ({ ...studioRealism.stats }),
    getHDRStats: () => ({ ...hdrService.getStats(), fallback: hdrFallback }),
    getQualityStats: () => ({ ...adaptiveQuality.getStats(), appliedScale: resolutionScale, gpuTiming: gpuTimer.supported, displayBudgetMs: refreshBudget }),
    getLightingStats: () => ({
      lightsOn, requestedLightsOn, quality: lightQuality, appliedQuality,
      loading: lightingBusy, transitioning: lightFadeActive, blend: lmMix.value,
      baked: bakeActive, pending: [...lightRequests.keys()],
      cached: Object.keys(LM).filter((key) => !!LM[key]),
    }),
  };
  readiness.construction = true;
  readiness.timings.construction = performance.now();
  loader.start();
  manager.itemEnd("scene-bootstrap");
  await assetsReady;
  if (loader.disposed) return;
  readiness.timings.assets = performance.now();
  batchingStats = await batchStaticRoom(scene, {
    exclude: [MODELS.printerHead, MODELS.chamberFan, MODELS.activeSpool, ...HOTSPOTS],
    yieldTask: yieldToBrowser,
  });
  // Populate after proxies register; doReveal enables the dock after GPU preparation.
  const dock = document.getElementById("exp-dock");
  const exhibitSelect = document.getElementById("exp-project-select");
  if (dock && exhibitSelect) {
    for (const key of PROJECT_ORDER) {
      const pivot = HOTSPOTS.find((h) => h.userData.hotspot.key === key);
      if (!pivot || !window.projectData?.[key]) continue;
      const option = document.createElement("option");
      option.value = key;
      option.textContent = window.projectData[key].title;
      exhibitSelect.appendChild(option);
    }
    exhibitSelect.addEventListener("change", () => {
      const pivot = HOTSPOTS.find((h) => h.userData.hotspot.key === exhibitSelect.value);
      if (!readiness.revealed || !pivot || panelOpen || paperReturning) return;
      dismissDragHint();
      focusHotspot(pivot);
    });
    document.getElementById("exp-reset-view")?.addEventListener("click", () => {
      if (!readiness.revealed || panelOpen || paperReturning) return;
      invalidatePanelWork(); // a pending deep link must not override Reset view
      dismissDragHint();
      clearPointerHover();
      if (prefersReducedMotion) {
        flight = null;
        camera.position.copy(REST_POS);
        controls.target.copy(REST_TARGET);
        controls.enabled = true;
        controls.update();
      } else startFlight(REST_POS, REST_TARGET, 700);
      renderer.domElement.focus();
    });
  }
  updateLightingUI();
  startupUI.setPhase("preparing");
  // Upload ready textures in small batches rather than concentrating all of
  // their allocation into the first visible frame. Network/CPU work has ended.
  const textures = new Set();
  scene.traverse((object) => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      for (const value of Object.values(material)) if (value?.isTexture && textureReady(value)) textures.add(value);
    }
  });
  let prepared = 0;
  for (const texture of textures) {
    if (document.hidden) await waitForVisible();
    renderer.initTexture(texture);
    prepared++;
    startupUI.update({ phase: "preparing", loaded: prepared, total: textures.size + 1 });
    if (prepared % 4 === 0) await yieldToBrowser();
  }
  if (document.hidden) await waitForVisible();
  await prepareRoomShaders(renderer, scene, camera, composer, { gtao, bokeh });
  startupUI.update({ phase: "preparing", loaded: textures.size + 1, total: textures.size + 1 });
  await yieldToBrowser();
  startupUI.setPhase("first-frame");
  readiness.prepared = true;
  readiness.timings.prepared = performance.now();
  console.info(`[experience] base assets prepared — ${HOTSPOTS.length} hotspots; awaiting first frame`);
}

/* ============================================================
   UI sounds — tiny WebAudio synth, muted by default, toggle in the HUD
   ============================================================ */
let sndMuted = true;
try { sndMuted = localStorage.getItem("kw_snd") !== "on"; } catch (e) {}
let _actx = null;
function actx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  if (_actx.state === "suspended") _actx.resume();
  return _actx;
}
function tone(freq, dur, gain, type = "sine", sweepTo) {
  if (sndMuted) return;
  try {
    const ctx = actx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur + 0.02);
  } catch (e) {}
}
let _lastTick = 0;
function sndTick() {
  const now = performance.now();
  if (now - _lastTick < 90) return;
  _lastTick = now;
  tone(1250, 0.05, 0.015, "sine");
}
function sndClick() { tone(620, 0.09, 0.03, "triangle", 380); }
function sndWhoosh(mul = 1) { tone(240, 0.32, 0.018 * mul, "sine", 90); }
function initSoundToggle() {
  const btn = document.getElementById("exp-sound");
  if (!btn) return;
  // markup owns the two inline SVGs (.snd-off / .snd-on); CSS toggles which
  // one shows off the .is-on class — this only ever flips the class + label
  const paint = () => {
    btn.setAttribute("aria-label", sndMuted ? "Enable sound" : "Mute sound");
    btn.setAttribute("aria-pressed", String(!sndMuted));
    btn.classList.toggle("is-on", !sndMuted);
  };
  paint();
  btn.addEventListener("click", () => {
    sndMuted = !sndMuted;
    try { localStorage.setItem("kw_snd", sndMuted ? "off" : "on"); } catch (e) {}
    if (!sndMuted) sndClick();
    paint();
  });
}
initSoundToggle();

/* ============================================================
   model loading + normalization
   ============================================================ */
function placeRoot(root, scene, opts, onPlaced) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      if (opts.tint && o.material) {
        o.material = o.material.clone();
        o.material.color = new THREE.Color(opts.tint);
      }
    }
  });
  if (opts.rotationOrder) root.rotation.order = opts.rotationOrder;
  if (opts.rotX) root.rotation.x = opts.rotX;
  if (opts.rotY) root.rotation.y = opts.rotY;
  if (opts.rotZ) root.rotation.z = opts.rotZ;
  root.updateWorldMatrix(true, true);

  let box = modelBounds(root);
  if (opts.targetSize) {
    const size = box.getSize(new THREE.Vector3());
    const dim = opts.axis === "x" ? size.x : opts.axis === "z" ? size.z : size.y;
    if (dim > 0) {
      root.scale.multiplyScalar(opts.targetSize / dim);
      root.updateWorldMatrix(true, true);
      box = modelBounds(root);
    }
  }
  // optional shelf-bay budget: uniformly shrink anything that exceeds it
  if (opts.fit) {
    const size = box.getSize(new THREE.Vector3());
    const k = Math.min(1, opts.fit[0] / size.x, opts.fit[1] / size.y, opts.fit[2] / size.z);
    if (k < 1) {
      root.scale.multiplyScalar(k);
      root.updateWorldMatrix(true, true);
      box = modelBounds(root);
    }
  }
  const c = box.getCenter(new THREE.Vector3());
  const pos = opts.pos || [0, 0, 0];
  root.position.x += pos[0] - c.x;
  root.position.z += pos[2] - c.z;
  root.position.y += pos[1] - box.min.y;
  root.updateWorldMatrix(true, true);

  scene.add(root);
  MODELS[opts.name] = root;

  if (opts.projectKey || opts.action) {
    const bb = modelBounds(root);
    const center = bb.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(center);
    scene.add(pivot);
    pivot.add(root);
    root.position.sub(center);

    // invisible hitbox so thin/flat exhibits are clickable anywhere in
    // their volume (raycaster tests geometry, not material visibility)
    const hbSize = bb.getSize(new THREE.Vector3());
    if (opts.action === "resume") hbSize.y = Math.max(hbSize.y, .008);
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(hbSize.x, hbSize.y, hbSize.z),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
    );
    pivot.add(hitbox);

    // Genshin-style interact marker floating above the object
    // (capped so it never pokes through the shelf above)
    const capY = opts.markerCap !== undefined ? opts.markerCap : Infinity;
    const marker = makeInteractMarker();
    let markerY, markerX = 0, markerZ = 0;
    if (opts.action === "resume") {
      // centered DIRECTLY over the sheet (Kefan: the corner placement read
      // as detached), floating high enough that it never covers the print
      markerX = 0;
      markerZ = 0;
      markerY = 0.16;
    } else {
      markerY = Math.min(bb.max.y + 0.09, capY) - center.y;
    }
    marker.position.set(markerX, markerY, markerZ);
    pivot.add(marker);
    NO_PREPASS.push(hitbox, marker);

    pivot.userData.hotspot = {
      key: opts.projectKey || null,
      action: opts.action || null,
      label: opts.label || "",
      baseScale: 1,
      center: center.clone(),
      pickProxy: hitbox,
      marker,
      markerY,
      pickupObject: opts.action === "resume" ? root : null,
      phase: Math.random() * Math.PI * 2,
    };
    HOTSPOTS.push(pivot);
    MODELS[opts.name] = pivot;
    if (onPlaced) onPlaced(pivot, new THREE.Box3().setFromObject(pivot));
    return;
  }
  if (onPlaced) onPlaced(root, modelBounds(root));
}

function loadModel(loader, scene, url, opts, onPlaced) {
  loader.load(
    url,
    (gltf) => placeRoot(gltf.scene, scene, opts, onPlaced),
    undefined,
    (err) => console.warn(`[experience] failed to load ${url}`, err)
  );
}

// Source materials are retained, including carbon weave and scientific colors.
function loadCurrentExhibit(loader, scene, key, opts) {
  const exhibit = ROOM_EXHIBITS[key];
  loader.load(exhibit.url, (gltf) => {
    placeRoot(gltf.scene, scene, {
      ...opts, name: "ex_" + key, projectKey: key,
      label: window.projectData?.[key]?.title || key,
    });
    ANISO_DIRTY = true;
  }, undefined, undefined, (root) => prepareRoomExhibit(root, key), key);
}

/* ============================================================
   room
   ============================================================ */
function buildRoom(scene) {
  // graphite engineering office: sealed-concrete floor, dark plaster walls
  // with a steel lower band, fully enclosed (incl. front wall) so no camera
  // angle can ever see past the set
  const ft = TEX.loadPBR("painted_plaster_wall");
  // the shared wall set stretched over 16x16 m is featureless mush up close —
  // clone the maps for the floor only, at a much tighter repeat
  const fMap = repeatedTexture(ft.map, 8, 8);
  const fNor = repeatedTexture(ft.normalMap, 8, 8);
  const fRgh = repeatedTexture(ft.roughnessMap, 8, 8);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({
      color: COL.floorTint,
      map: fMap,
      normalMap: fNor,
      roughnessMap: fRgh,
      roughness: 0.42,
      metalness: 0.0,
      envMapIntensity: 0.9,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wt = TEX.loadPBR("painted_plaster_wall");
  const wallMat = () =>
    new THREE.MeshStandardMaterial({
      color: COL.wallTint,
      map: wt.map,
      normalMap: wt.normalMap,
      roughnessMap: wt.roughnessMap,
      roughness: 1.0,
      metalness: 0,
    });

  const WALL_H = 3.4;
  const back = -1.55;
  const sideX = 2.6;
  const front = 3.6;
  const depth = front - back;

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(2 * sideX, WALL_H), wallMat());
  backWall.position.set(0, WALL_H / 2, back);
  backWall.receiveShadow = true;
  scene.add(backWall);

  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(2 * sideX, WALL_H), wallMat());
  frontWall.position.set(0, WALL_H / 2, front);
  frontWall.rotation.y = Math.PI;
  frontWall.receiveShadow = true;
  scene.add(frontWall);

  [-sideX, sideX].forEach((x) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(depth, WALL_H), wallMat());
    w.position.set(x, WALL_H / 2, (front + back) / 2);
    w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    w.receiveShadow = true;
    scene.add(w);
  });

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * sideX, depth),
    new THREE.MeshStandardMaterial({
      color: 0x4a4e55,
      map: wt.map,
      normalMap: wt.normalMap,
      roughness: 1.0,
      metalness: 0,
    })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_H, (front + back) / 2);
  scene.add(ceiling);

  // lower band: dark steel panels + aluminum reveal line
  const bandH = 0.95;
  const bandMat = () => new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.48, metalness: 0.72 });
  const railMat = () => new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.35, metalness: 1.0 });
  const addBand = (w, x, z, rotY) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, bandH, 0.035), bandMat());
    panel.position.set(x, bandH / 2, z);
    panel.rotation.y = rotY;
    panel.receiveShadow = true;
    panel.castShadow = true;
    scene.add(panel);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, 0.05), railMat());
    rail.position.set(x, bandH + 0.011, z);
    rail.rotation.y = rotY;
    scene.add(rail);
  };
  addBand(2 * sideX, 0, back + 0.028, 0);
  addBand(2 * sideX, 0, front - 0.028, Math.PI);
  addBand(depth, -sideX + 0.028, (front + back) / 2, Math.PI / 2);
  addBand(depth, sideX - 0.028, (front + back) / 2, -Math.PI / 2);

  // slim graphite crown + baseboards on all four walls
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5, metalness: 0.4 });
  const addTrim = (w, x, z, rotY, y, h, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    scene.add(m);
  };
  [
    [2 * sideX, 0, back + 0.04, 0],
    [2 * sideX, 0, front - 0.04, Math.PI],
    [depth, -sideX + 0.04, (front + back) / 2, Math.PI / 2],
    [depth, sideX - 0.04, (front + back) / 2, -Math.PI / 2],
  ].forEach(([w, x, z, rY]) => {
    addTrim(w, x, z, rY, WALL_H - 0.04, 0.08, 0.08);
    addTrim(w, x, z, rY, 0.045, 0.09, 0.05);
  });

  // ceiling cove LED strips along the wall tops
  const coveMat = new THREE.MeshStandardMaterial({ color: 0x6a7078, emissive: 0xc4d9f6, emissiveIntensity: 1.2 });
  const addCove = (w, x, z, rotY) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.018, 0.018), coveMat);
    m.position.set(x, WALL_H - 0.14, z);
    m.rotation.y = rotY;
    scene.add(m);
  };
  addCove(2 * sideX - 0.3, 0, back + 0.09, 0);
  addCove(depth - 0.3, -sideX + 0.09, (front + back) / 2, Math.PI / 2);
  addCove(depth - 0.3, sideX - 0.09, (front + back) / 2, -Math.PI / 2);

  // (removed: the polished floor reflector strip in front of the display wall)

  // modern black pendant over the desk (neutral light). H4: canopy + strain
  // relief at the slab, a lathe bell shade instead of a bare cone, a warm
  // inner reflector and a socket collar — the old cone read low-poly up close
  const pendant = new THREE.Group();
  const pendMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide });
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.058, 0.022, 20), pendMat);
  canopy.position.y = WALL_H - 0.011;
  pendant.add(canopy);
  const relief = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.034, 10), pendMat);
  relief.position.y = WALL_H - 0.038;
  pendant.add(relief);
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, WALL_H - 2.42, 8),
    new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.7 })
  );
  cord.position.y = 2.42 + (WALL_H - 2.42) / 2;
  pendant.add(cord);
  const shadePts = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12;
    shadePts.push(new THREE.Vector2(0.05 + 0.12 * Math.pow(1 - k, 1.45), k * 0.15));
  }
  shadePts.unshift(new THREE.Vector2(0.165, 0.007)); // rolled lip
  const shade = new THREE.Mesh(new THREE.LatheGeometry(shadePts, 30), pendMat);
  shade.position.y = 2.345;
  shade.castShadow = true;
  pendant.add(shade);
  // matte warm liner, NOT white: a near-white bowl sat at ~1.0 HDR under env +
  // room light and the bloom pass smeared the whole shade into a blob — the
  // "lit" read comes from the emissive ramp (applyLightState), not albedo
  const reflector = new THREE.Mesh(
    new THREE.LatheGeometry(shadePts.map((p) => new THREE.Vector2(Math.max(0.03, p.x - 0.006), p.y)), 30),
    new THREE.MeshStandardMaterial({ color: 0x9a9288, roughness: 0.8, side: THREE.BackSide, envMapIntensity: 0.2, emissive: 0xffd9a0, emissiveIntensity: 0.12 })
  );
  reflector.position.y = 2.346;
  pendant.add(reflector);
  MODELS.pendantShadeInner = reflector; // glows with the light, like the bulb
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.032, 12),
    new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.5, metalness: 0.4 }));
  socket.position.y = 2.4;
  pendant.add(socket);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xe8eef8, emissiveIntensity: 1.0 })
  );
  bulb.position.y = 2.37;
  pendant.add(bulb);
  MODELS.pendantBulb = bulb; // I1: emissive follows the light's own ramp
  const pendantLight = new THREE.PointLight(0xe8eef8, 2.6, 4.2, 2); // carries the desk now the lamps emit no light
  pendantLight.position.y = 2.32;
  pendant.add(pendantLight);
  MODELS.pendantLight = pendantLight; // exposed so applyLightState (initScene scope) can drive it
  pendant.position.set(0.15, 0, 0.35);
  // pre-name: the bake shim tags every NAMELESS mesh bk_room and the swap then
  // hides the whole group — this fixture (and the point light inside it) must
  // stay real-time, so claim the names first. Layer 2 keeps the fixture out of
  // reach of its own point light (see the light rig).
  pendant.traverse((m) => { if (m.isMesh) { m.name = "rt_pendant"; m.layers.set(2); } });
  scene.add(pendant);

  // H4: the ceiling slab was a bare void — smoke detector + a small square
  // HVAC diffuser (REAL-TIME meshes: added straight to the scene, no bk_ tag,
  // so the baked ceiling lightmap is untouched)
  const ceilWhite = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.6 });
  const smoke = new THREE.Group();
  const smBase = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.018, 20), ceilWhite);
  smBase.position.y = -0.009;
  smoke.add(smBase);
  const smDome = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.05, 0.016, 20), ceilWhite);
  smDome.position.y = -0.025;
  smoke.add(smDome);
  const smLed = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x1a3326, emissive: 0x35d17a, emissiveIntensity: 1.3 }));
  smLed.position.set(0.028, -0.031, 0);
  smoke.add(smLed);
  smoke.position.set(-1.0, WALL_H, 1.6);
  smoke.traverse((m) => { if (m.isMesh) m.name = "rt_ceiling"; }); // same: dodge the bk_ shim
  scene.add(smoke);
  const diffuser = new THREE.Group();
  const dfFrame = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.02, 0.42, 2, 0.005), ceilWhite);
  diffuser.add(dfFrame);
  [0.32, 0.22, 0.12].forEach((s, i) => {
    const ring = new THREE.Mesh(new RoundedBoxGeometry(s, 0.014, s, 2, 0.004), ceilWhite);
    ring.position.y = -0.006 - i * 0.006; // stepped concentric cones
    diffuser.add(ring);
  });
  diffuser.position.set(1.15, WALL_H - 0.01, 1.75);
  diffuser.traverse((m) => { if (m.isMesh) m.name = "rt_ceiling"; });
  scene.add(diffuser);
}

function buildDesk() {
  // modern sit-stand desk: light lacquered slab on a silver lifting frame,
  // dark desk mat, one slim drawer unit with aluminum bar pulls
  const g = new THREE.Group();
  const topY = 0.76;
  const thk = 0.045;
  const W = 1.85;
  const D = 0.9;
  // silver sit-stand frame under a matte-black slab (Jarvis/Fully language)
  const steelPanel = new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.35, metalness: 0.9 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.65, metalness: 0.55 });

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(W, thk, D, 3, 0.008),
    // slightly deeper grey so the slab stops being the brightest plane in frame
    new THREE.MeshStandardMaterial({ color: 0xbfc4cc, roughness: 0.52, metalness: 0.06 })
  );
  top.position.set(0, topY - thk / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // dark desk mat — sized as a frame around the resume (~1.5x the sheet),
  // not a giant slab that swallows it
  const mat = new THREE.Mesh(
    new RoundedBoxGeometry(0.44, 0.006, 0.5, 2, 0.006),
    new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.72, metalness: 0.05 })
  );
  mat.position.set(0.02, topY + 0.003, 0.16);
  mat.receiveShadow = true;
  g.add(mat);

  // slim panel legs + low back beam
  // sit-stand lifting columns: telescopic two-stage + T-feet
  [-(W / 2 - 0.16), W / 2 - 0.16].forEach((px) => {
    const upper = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.4, 0.06, 2, 0.008), steelPanel);
    upper.position.set(px, topY - thk - 0.2, 0);
    upper.castShadow = true;
    g.add(upper);
    const lowerCol = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.34, 0.075, 2, 0.008), steelPanel);
    lowerCol.position.set(px, 0.19, 0);
    lowerCol.castShadow = true;
    g.add(lowerCol);
    const footBar = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.025, 0.66, 2, 0.01), steelPanel);
    footBar.position.set(px, 0.02, 0);
    footBar.castShadow = true;
    footBar.receiveShadow = true;
    g.add(footBar);
  });
  // lift keypad on the front edge
  const keypad = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.018, 0.045, 2, 0.005), steelPanel);
  keypad.position.set(-0.55, topY - thk - 0.012, D / 2 - 0.02);
  g.add(keypad);

  // slim under-top drawer unit (right side) with aluminum bar pulls
  const unit = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.16, D - 0.2, 2, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.48, metalness: 0.5 }));
  unit.position.set(W / 2 - 0.35, topY - thk - 0.08, 0);
  unit.castShadow = true;
  g.add(unit);
  [-0.13, 0.13].forEach((dx) => {
    const front = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.13, 0.014, 2, 0.005),
      new THREE.MeshStandardMaterial({ color: 0x1f2126, roughness: 0.5, metalness: 0.4 }));
    front.position.set(W / 2 - 0.35 + dx, topY - thk - 0.08, (D - 0.2) / 2 + 0.008);
    g.add(front);
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.008, 0.008), alu);
    pull.position.set(W / 2 - 0.35 + dx, topY - thk - 0.035, (D - 0.2) / 2 + 0.02);
    g.add(pull);
  });

  return g;
}

function buildDisplayCabinet() {
  // Modern display wall: satin-grey structure with a subdued grey open-pore
  // veneer back. Tinted glass shelves and cool light strips stay untouched.
  const g = new THREE.Group();
  const W = 2.36;
  const H = 2.2;
  const D = 0.54;
  const z = CAB.z;
  const frameMat = cabinetFrameMaterial();

  // Wood remains only on the back panel, a step deeper than the satin frame.
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), cabinetBackMaterial());
  back.position.set(0, H / 2, z - D / 2 + 0.01);
  back.receiveShadow = true;
  g.add(back);

  // slim frame: sides, top, plinth
  [-W / 2 + 0.02, W / 2 - 0.02].forEach((x) => {
    const side = new THREE.Mesh(new RoundedBoxGeometry(0.04, H, D, 2, 0.008), frameMat);
    side.position.set(x, H / 2, z);
    side.castShadow = true;
    side.receiveShadow = true;
    g.add(side);
  });
  const top = new THREE.Mesh(new RoundedBoxGeometry(W + 0.02, 0.05, D + 0.02, 2, 0.008), frameMat);
  top.position.set(0, H - 0.025, z);
  top.castShadow = true;
  g.add(top);
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(W + 0.01, 0.1, D, 2, 0.008), frameMat);
  plinth.position.set(0, 0.05, z);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  // thin steel dividers between bays
  [-0.365, 0.365].forEach((x) => {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.014, H - 0.15, D - 0.1), frameMat);
    div.position.set(x, (H - 0.15) / 2 + 0.1, z);
    div.castShadow = true;
    g.add(div);
  });

  // F1 (Kefan approved): drawer fronts close the bare bottom compartment —
  // museum flat-file look, one deep drawer per bay with a recessed pull slot
  const pullMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.55, metalness: 0.4 });
  [[-0.756, 0.74], [0, 0.7], [0.756, 0.74]].forEach(([x, w]) => {
    // full solid drawer BODY (Kefan: not just a front panel) — the box runs
    // most of the cabinet depth behind the same front plane
    const front = new THREE.Mesh(new RoundedBoxGeometry(w, 0.58, 0.44, 2, 0.005), frameMat);
    front.position.set(x, 0.405, z + D / 2 - 0.012 - 0.22);
    front.castShadow = true;
    front.receiveShadow = true;
    g.add(front);
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.02, 0.008), pullMat);
    pull.position.set(x, 0.64, z + D / 2 - 0.014);
    g.add(pull);
  });

  // tinted glass shelves with aluminum front edge + cool light strips
  // roughness/clearcoatRoughness kept off the mirror end and env gain modest:
  // near-mirror glass sparkles into subpixel fireflies under the follow-spot
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a4b5c,
    roughness: 0.16,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    envMapIntensity: 0.7,
    clearcoat: 0.15,
    clearcoatRoughness: 0.28,
  });
  CAB.rows.forEach((y, ri) => {
    // rounded edges: a sharp 90° glass corner breaks into dashed specular
    // fireflies under the follow-spot at fly-in distance.
    // BOTTOM row is opaque grey wood (Kefan) — glass there looked down into
    // the drawer void
    const bottomRow = ri === CAB.rows.length - 1;
    const board = new THREE.Mesh(
      new RoundedBoxGeometry(W - 0.09, bottomRow ? 0.02 : 0.014, D - 0.08, 2, 0.004),
      bottomRow ? cabinetBackMaterial() : glassMat);
    board.position.set(0, y - (bottomRow ? 0.01 : 0.007), z);
    board.receiveShadow = true;
    g.add(board);
    // (no aluminum front-edge bar: a subpixel-thin bar in front of the LED
    // strip aliases into a dashed sparkle line at fly-in distance)
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.16, 0.008, 0.014),
      new THREE.MeshStandardMaterial({ color: 0x6a7078, emissive: 0xbcd7ff, emissiveIntensity: 1.15 })
    );
    strip.position.set(0, y + CAB.rowH - 0.055, z + D / 2 - 0.12);
    g.add(strip);
  });

  return g;
}

function buildErgoChair() {
  // ergonomic task chair v3 — axis-aligned boxes only; every part overlaps
  // its neighbor so nothing can float
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.35, metalness: 0.9 });
  const blackPl = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.55, metalness: 0.2 });
  const mesh = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.92, metalness: 0.02 });

  // 5-star base: arms from the hub outward, casters under the tips
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.05, 18), blackPl);
  hub.position.y = 0.075;
  g.add(hub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.022, 0.3, 2, 0.008), alu);
    arm.position.set(Math.sin(a) * 0.135, 0.06, Math.cos(a) * 0.135);
    arm.rotation.y = a;
    arm.castShadow = true;
    g.add(arm);
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.018, 14), blackPl);
    caster.rotation.z = Math.PI / 2;
    caster.rotation.y = a;
    caster.position.set(Math.sin(a) * 0.265, 0.026, Math.cos(a) * 0.265);
    caster.castShadow = true;
    g.add(caster);
  }
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.024, 0.26, 16), alu);
  lift.position.y = 0.2;
  g.add(lift);
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 16), blackPl);
  boot.position.y = 0.15;
  g.add(boot);

  // seat over a plate that swallows the lift top
  const SEAT_Y = 0.43;
  const seatPlate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.22), blackPl);
  seatPlate.position.y = SEAT_Y - 0.05;
  g.add(seatPlate);
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.47, 0.08, 0.45, 3, 0.025), mesh);
  seat.position.y = SEAT_Y;
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  // back uprights: rise straight from INSIDE the seat rear (overlap by 6cm)
  [-0.14, 0.14].forEach((x) => {
    const upright = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.5, 0.035, 2, 0.01), blackPl);
    upright.position.set(x, SEAT_Y + 0.19, -0.205);
    upright.castShadow = true;
    g.add(upright);
  });
  // backrest panel bolted onto the uprights (overlaps them)
  const backRest = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.58, 0.055, 3, 0.02), mesh);
  backRest.position.set(0, SEAT_Y + 0.42, -0.225);
  backRest.castShadow = true;
  g.add(backRest);
  const lumbar = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.13, 0.03, 2, 0.012), blackPl);
  lumbar.position.set(0, SEAT_Y + 0.2, -0.195);
  g.add(lumbar);

  // armrests: solid slabs growing out of the seat sides, pads on top
  [-1, 1].forEach((s) => {
    const slab = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.24, 0.2, 2, 0.008), blackPl);
    slab.position.set(s * 0.225, SEAT_Y + 0.1, 0.0);
    slab.castShadow = true;
    g.add(slab);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.065, 0.02, 0.24, 2, 0.008), blackPl);
    pad.position.set(s * 0.225, SEAT_Y + 0.23, 0.0);
    pad.castShadow = true;
    g.add(pad);
  });

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildModernDeskLamp() {
  // modern cantilever task lamp (Dyson-Lightcycle-like): round base, a
  // column rising from the base EDGE, a horizontal arm swinging over the
  // desk with a counterweight tail, and a slim head hanging off a drop-link
  // with the LED strip embedded on its underside. Group origin (0,0,0) sits
  // on the desk top, same pivot convention as the previous build.
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.38, metalness: 0.7 });
  function segment(p0, p1, r, segs = 12) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), segs), body);
    mesh.position.copy(p0).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }

  // round base
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 28), body);
  base.position.y = 0.006;
  g.add(base);

  // vertical column, rising from the base EDGE (not the center). Tall enough
  // that the head clears the desk clutter and rakes DOWN onto the paper —
  // the arm carries the room's only desk light (see resumeSpot in initScene).
  const colX = -0.032;
  const colBottom = new THREE.Vector3(colX, 0.012, 0);
  const colTop = new THREE.Vector3(colX, 0.012 + 0.4, 0);
  g.add(segment(colBottom, colTop, 0.008));

  // small joint sphere where the arm pivots at the column top
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 14), body);
  joint.position.copy(colTop);
  g.add(joint);

  // horizontal cantilever arm through the joint: a short counterweight tail
  // behind, a long reach out over the desk in front
  const armBack = colTop.clone().add(new THREE.Vector3(-0.07, 0, 0));
  const armFront = colTop.clone().add(new THREE.Vector3(0.34, 0, 0.015));
  g.add(segment(armBack, armFront, 0.007));

  // counterweight puck on the back end of the arm
  const weight = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 14), body);
  weight.position.copy(armBack);
  g.add(weight);

  // Head assembly hangs off the arm's front and TILTS toward the résumé, so
  // the lamp visibly aims where its light actually lands. The paper sits well
  // to the +x side of the lamp (lamp at desk-left, résumé at desk-center), so
  // a straight-down head looked wrong — head pointing down while the pool fell
  // off to the right (Kefan). This tilt rotates the head's underside to face
  // the beam direction (LED origin -> résumé), computed from the fixed layout.
  const HEAD_TILT = 0.95; // rad about +z: aims the LED underside at the paper
  const headGroup = new THREE.Group();
  headGroup.position.copy(armFront);
  headGroup.rotation.z = HEAD_TILT;

  // drop-link (short neck) from the arm joint down into the head
  headGroup.add(segment(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.02, 0), 0.005, 8));

  // slim lamp head (horizontal tube), perpendicular to the arm
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 20), body);
  head.position.set(0, -0.02, 0);
  head.rotation.x = Math.PI / 2;
  headGroup.add(head);

  // LED strip embedded on the head's underside (same look the light-state
  // code keys off: emissive material, intensity in the dim "off" range)
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.006, 0.11),
    // J4: warm-white to MATCH the amber pool it casts (resumeSpot 0xffdcae) —
    // a cool-white strip producing warm light was a physical contradiction
    new THREE.MeshStandardMaterial({ color: 0xe8ebf0, emissive: 0xffe6c2, emissiveIntensity: 0.05 })
  );
  led.position.set(0, -0.032, 0);
  headGroup.add(led);
  g.add(headGroup);

  // where initScene hangs the real task light (the LED's position in g-space,
  // after the head tilt — g is this subtree's root so worldToLocal is g-local)
  g.updateMatrixWorld(true);
  g.userData.headLocal = g.worldToLocal(led.getWorldPosition(new THREE.Vector3()));

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildLedBarLamp() {
  // bench light: puck base, single straight stem, horizontal LED bar
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.38, metalness: 0.7 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.016, 22), body);
  base.position.y = 0.008;
  g.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.34, 12), body);
  stem.position.set(0, 0.185, 0);
  g.add(stem);
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.022, 0.04, 2, 0.008), body);
  bar.position.set(-0.1, 0.36, 0.04);
  bar.rotation.y = 0.1;
  g.add(bar);
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.004, 0.026),
    new THREE.MeshStandardMaterial({ color: 0xe8ebf0, emissive: 0xdfe6f0, emissiveIntensity: 0.06 })
  );
  led.position.set(-0.1, 0.347, 0.04);
  led.rotation.y = 0.1;
  g.add(led);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function makeInteractMarker() {
  // Genshin-style prompt: soft blue glow + diamond ring + white core.
  // Built to read on BOTH dark exhibits AND white ones (CFD monitor, résumé):
  // additive blending vanished against white, so this uses NORMAL blending
  // with a dark contour behind the blue ring and a dark edge on the core —
  // contrast that survives a white background while still glowing on dark.
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const cx = s / 2;
  // soft dark backing disc: the marker carries its OWN contrast plate, so
  // it stays legible over the white résumé sheet / CFD monitor while the
  // disc melts away over dark exhibits (Kefan asked twice — keep this)
  const back = ctx.createRadialGradient(cx, cx, 2, cx, cx, 46);
  back.addColorStop(0, "rgba(9, 18, 36, 0.55)");
  back.addColorStop(0.55, "rgba(9, 18, 36, 0.34)");
  back.addColorStop(1, "rgba(9, 18, 36, 0)");
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, s, s);
  const glow = ctx.createRadialGradient(cx, cx, 3, cx, cx, cx);
  glow.addColorStop(0, "rgba(63, 140, 255, 0.55)");
  glow.addColorStop(0.4, "rgba(63, 140, 255, 0.22)");
  glow.addColorStop(1, "rgba(63, 140, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  ctx.save();
  ctx.translate(cx, cx);
  ctx.rotate(Math.PI / 4);
  // dark contour first — gives the ring an edge on WHITE backgrounds
  ctx.strokeStyle = "rgba(4, 12, 28, 0.9)";
  ctx.lineWidth = 9;
  ctx.strokeRect(-19, -19, 38, 38);
  // saturated brand-blue ring
  ctx.strokeStyle = "#3f8cff";
  ctx.lineWidth = 5;
  ctx.strokeRect(-19, -19, 38, 38);
  // white core with a thin dark edge (reads on white, glows on dark)
  ctx.fillStyle = "rgba(6, 16, 34, 0.85)";
  ctx.fillRect(-10.5, -10.5, 21, 21);
  ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      opacity: 0.95,
    })
  );
  sprite.scale.setScalar(0.042);
  sprite.renderOrder = 5;
  return sprite;
}

/* 2x2 twill carbon-fiber weave tile (cached) */
async function buildWorkbench() {
  // electronics workbench, left wall: pegboard with real MechE tools,
  // Printer on the left, instruments to the right, and the guitar kit
  // in the existing clear central assembly area.
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.45, metalness: 0.8 });
  const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.2 });
  // I3: roughness 0.4 + metalness 0.9 on small high-curvature tools clipped
  // the key light's specular past the bloom threshold — a phantom white orb
  // on the hammer head / tape clip. Satin tool steel reads truer anyway.
  const toolSteel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.56 });
  const TOP_Y = 0.78;

  // bench: butcher-block top on steel legs + lower shelf
  // light phenolic lab worktop — brightens the whole left wall
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.95, 0.055, 0.64, 2, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xd3d6da, roughness: 0.5, metalness: 0.08 }));
  top.position.set(0, TOP_Y - 0.0275, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);
  [[-0.9, -0.24], [0.9, -0.24], [-0.9, 0.24], [0.9, 0.24]].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, TOP_Y - 0.055, 0.05), steel);
    leg.position.set(lx, (TOP_Y - 0.055) / 2, lz);
    leg.castShadow = true;
    g.add(leg);
  });
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.03, 0.5), steel);
  lower.position.set(0, 0.2, 0);
  lower.receiveShadow = true;
  g.add(lower);
  // spare spools on the lower shelf — all lying flat, one stacked pair
  [
    [-0.62, 0.05, 0x2b66d9],
    [-0.44, -0.1, 0x3f9e4f],
    [-0.26, 0.08, 0xe8eaee],
    [0.42, -0.05, 0x8a8f96],
  ].forEach(([sx, sz, col]) => {
    const sp = makeMiniSpool(col);
    sp.scale.setScalar(1.6);
    sp.position.set(sx, 0.243, sz);
    g.add(sp);
  });
  const spTop = makeMiniSpool(0xd97b2b);
  spTop.scale.setScalar(1.6);
  spTop.position.set(-0.62, 0.302, 0.05); // stacked on the green one
  g.add(spTop);

  // Small perforations on 25 mm centers; the old enlarged dots looked like
  // painted circles. A narrow rim catches light without a separate mesh per hole.
  const pb = document.createElement("canvas");
  pb.width = 1024; pb.height = 512;
  const pctx = pb.getContext("2d");
  pctx.fillStyle = "#4a4d52"; pctx.fillRect(0, 0, pb.width, pb.height);
  const holePitch = pb.width * .025 / 1.9;
  for (let py = holePitch; py < pb.height - holePitch / 2; py += holePitch) {
    for (let px = holePitch; px < pb.width - holePitch / 2; px += holePitch) {
      pctx.fillStyle = "#64676a"; pctx.beginPath(); pctx.arc(px, py + .45, 1.65, 0, Math.PI * 2); pctx.fill();
      pctx.fillStyle = "#24272a"; pctx.beginPath(); pctx.arc(px, py, 1.35, 0, Math.PI * 2); pctx.fill();
    }
  }
  const pbTex = new THREE.CanvasTexture(pb);
  pbTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.95, 0.02),
    new THREE.MeshStandardMaterial({ map: pbTex, roughness: 0.8, metalness: 0.15 })
  );
  board.position.set(0, TOP_Y + 0.62, -0.3);
  board.receiveShadow = true;
  g.add(board);

  /* ---- pegboard tools (hung at boardZ) ---- */
  const bz = -0.283;

  g.add(buildDetailedPegboardTools({ topY: TOP_Y, boardZ: bz }));

  /* ---- bench top: printer LEFT, clear middle, instruments RIGHT ---- */
  await yieldToBrowser();
  const printer = buildDetailedPrinter({ models: MODELS });
  await yieldToBrowser();
  printer.scale.setScalar(0.8);
  printer.position.set(-0.62, TOP_Y, 0.02);
  printer.rotation.y = 0.1;
  g.add(printer);
  MODELS.printer = printer;

  // The guitar education exhibit is placed in the middle after construction.

  // programmable bench PSU with a live readout
  const psu = new THREE.Group();
  psu.position.set(0.42, TOP_Y, -0.16);

  /* ---- cables + wall power strip (a bench without wires reads as a prop) ---- */
  const cable = (pts, r, col) =>
    new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))), 28, r, 8),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, metalness: 0.05 })
    );
  // wall power strip above the bench back edge
  const strip = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.05, 0.028, 2, 0.006),
    new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.3 }));
  strip.position.set(-0.06, 0.98, -0.302);
  g.add(strip);
  for (let i = 0; i < 4; i++) {
    const sock = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 12),
      new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.6 }));
    sock.rotation.x = Math.PI / 2;
    sock.position.set(-0.165 + i * 0.073, 0.98, -0.286);
    g.add(sock);
  }
  // printer mains lead: printer rear -> sag -> strip
  g.add(cable([[-0.5, 0.84, -0.18], [-0.38, 0.86, -0.27], [-0.22, 0.9, -0.295], [-0.14, 0.965, -0.293]], 0.0045, 0x17181c));
  // PSU test leads: front jacks draped and loosely COILED on the bench right
  // in front of the PSU — deliberately NOT reaching the multimeter (x~0.24),
  // which read as if the two instruments were wired together (Kefan)
  g.add(cable([[0.375, 0.845, -0.085], [0.4, 0.81, 0.0], [0.47, 0.786, 0.06], [0.52, 0.786, 0.02], [0.5, 0.784, -0.03]], 0.003, 0xb3342e));
  g.add(cable([[0.4, 0.845, -0.085], [0.44, 0.81, -0.01], [0.5, 0.786, 0.04], [0.54, 0.786, 0.09], [0.5, 0.784, 0.11]], 0.003, 0x141519));
  // PSU mains into the strip
  g.add(cable([[0.36, 0.82, -0.24], [0.22, 0.88, -0.29], [0.05, 0.958, -0.293]], 0.0042, 0x17181c));

  psu.rotation.y = -0.06;
  g.add(psu);

  await yieldToBrowser();
  // soldering station + iron
  const solder = new THREE.Group();
  solder.position.set(0.72, TOP_Y, -0.08);
  solder.rotation.y = 0.18;
  g.add(solder);

  // screwdriver set
  const drivers = new THREE.Group();
  drivers.position.set(0.52, TOP_Y, 0.17);
  drivers.rotation.y = -0.22;
  g.add(drivers);

  // multimeter
  const meter = new THREE.Group();
  meter.position.set(0.24, TOP_Y, 0.16);
  meter.rotation.y = 0.5;
  g.add(meter);

  await yieldToBrowser();
  // compact bench oscilloscope (back row, between printer and PSU): dark
  // body, graticule screen with two live traces, knob column, BNC inputs
  const scope = new THREE.Group();
  const scBody = new THREE.Mesh(new RoundedBoxGeometry(0.175, 0.115, 0.085, 2, 0.008), darkPlastic);
  scBody.position.y = 0.0575;
  scope.add(scBody);
  const scCanvas = document.createElement("canvas");
  scCanvas.width = 128; scCanvas.height = 80;
  // G1: the trace is a live capture — drawScope(phase) is re-run by the
  // render loop (~10 fps) so both channels crawl like a running scope
  const drawScope = (phase) => {
    const oc = scCanvas.getContext("2d");
    oc.fillStyle = "#060a0d"; oc.fillRect(0, 0, 128, 80);
    oc.strokeStyle = "#14283a"; oc.lineWidth = 1;
    for (let x = 0; x <= 128; x += 16) { oc.beginPath(); oc.moveTo(x, 0); oc.lineTo(x, 80); oc.stroke(); }
    for (let y = 0; y <= 80; y += 16) { oc.beginPath(); oc.moveTo(0, y); oc.lineTo(128, y); oc.stroke(); }
    // CH1: yellow sine
    oc.strokeStyle = "#e8c33c"; oc.lineWidth = 2; oc.beginPath();
    for (let x = 0; x <= 128; x++) { const y = 28 - Math.sin(x * 0.16 + phase) * 12; x === 0 ? oc.moveTo(x, y) : oc.lineTo(x, y); }
    oc.stroke();
    // CH2: cyan square wave
    oc.strokeStyle = "#3fc9e0"; oc.lineWidth = 2; oc.beginPath();
    const sq = Math.floor(phase / 0.16);
    for (let x = 0; x <= 128; x++) { const y = (((x + sq) >> 4) & 1) ? 62 : 48; x === 0 ? oc.moveTo(x, y) : oc.lineTo(x, y); }
    oc.stroke();
    oc.fillStyle = "#9aa4b0"; oc.font = "600 8px Arial";
    oc.fillText("CH1 2V", 4, 10); oc.fillText("500us", 96, 10);
  };
  drawScope(0);
  const scTex = new THREE.CanvasTexture(scCanvas);
  scTex.colorSpace = THREE.SRGBColorSpace;
  MODELS.scope = { draw: drawScope, tex: scTex };
  // J3: brushed-alu fascia plate behind the screen breaks up the molded box
  const scBezel = new THREE.Mesh(new RoundedBoxGeometry(0.118, 0.08, 0.004, 2, 0.003),
    new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.32, metalness: 0.7, roughnessMap: brushedRoughTex() }));
  scBezel.position.set(-0.028, 0.062, 0.0412);
  scope.add(scBezel);
  const scScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.062),
    new THREE.MeshStandardMaterial({ map: scTex, color: 0x8f9298, emissive: 0xffffff, emissiveMap: scTex, emissiveIntensity: 0.55 }));
  scScreen.position.set(-0.028, 0.062, 0.0435);
  scope.add(scScreen);
  // knob column on the right of the screen
  [[0.062, 0.088, 0.011], [0.062, 0.06, 0.011], [0.048, 0.031, 0.006], [0.074, 0.031, 0.006]].forEach(([kx, ky, kr]) => {
    const kn = new THREE.Mesh(new THREE.CylinderGeometry(kr, kr, 0.012, 14), steel);
    kn.rotation.x = Math.PI / 2;
    kn.position.set(kx, ky, 0.045);
    scope.add(kn);
  });
  // BNC inputs under the screen
  [-0.05, -0.015].forEach((bx) => {
    const bnc = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.012, 10), toolSteel);
    bnc.rotation.x = Math.PI / 2;
    bnc.position.set(bx, 0.018, 0.045);
    scope.add(bnc);
  });
  scope.position.set(0.08, TOP_Y, -0.16);
  scope.rotation.y = 0.05;
  g.add(scope);

  // LED bar bench lamp (clean single-stem design)
  const benchLamp = buildLedBarLamp();
  benchLamp.position.set(0.9, TOP_Y, -0.18);
  benchLamp.rotation.y = -0.6;
  g.add(benchLamp);

  refineWorkbenchInstruments({ psu, solder, drivers, meter, scope, benchLamp });

  g.traverse((o) => { if (o.isMesh) { o.castShadow = !o.material?.transparent; o.receiveShadow = true; } });
  g.position.set(-2.22, 0, -0.25);
  g.rotation.y = Math.PI / 2;
  return g;
}

function makeMiniSpool(col) {
  const g = new THREE.Group();
  const fl = new THREE.MeshPhysicalMaterial({ color: 0xd8dce2, roughness: 0.3, transparent: true, opacity: 0.5 });
  [-0.017, 0.017].forEach((dy) => {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.003, 22), fl);
    f.position.y = dy;
    g.add(f);
  });
  const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.028, 22),
    new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 }));
  g.add(fil);
  return g;
}

/* right-wall display cabinet layout (2 bays x 3 rows) */
const CAB2 = {
  x: 2.26, // cabinet center x (back panel at 2.50, clear of the 2.52 wainscot face)
  frontX: 2.24, // exhibit center x (centered on the glass boards)
  z: -0.1, // cabinet center z (shifted +0.3 off the back corner for breathing room)
  bays: [-0.45, 0.25], // z centers (cabinet center z ± 0.35)
  rows: [1.68, 1.2, 0.72],
  rowH: 0.48,
};

function buildSideCabinet() {
  // Second display cabinet on the right wall — the same quiet satin-grey
  // structure, subdued veneer back, tinted glass shelves, and cool strips.
  const g = new THREE.Group();
  const W = 1.6; // along z
  const H = 2.2;
  const D = 0.5;
  const frameMat = cabinetFrameMaterial();

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.02, H, W),
    cabinetBackMaterial());
  back.position.set(D / 2 - 0.01, H / 2, 0);
  back.receiveShadow = true;
  g.add(back);
  [-W / 2 + 0.02, W / 2 - 0.02].forEach((z) => {
    const side = new THREE.Mesh(new RoundedBoxGeometry(D, H, 0.04, 2, 0.008), frameMat);
    side.position.set(0, H / 2, z);
    side.castShadow = true;
    side.receiveShadow = true;
    g.add(side);
  });
  const top = new THREE.Mesh(new RoundedBoxGeometry(D + 0.02, 0.05, W + 0.02, 2, 0.008), frameMat);
  top.position.set(0, H - 0.025, 0);
  top.castShadow = true;
  g.add(top);
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(D, 0.1, W + 0.01, 2, 0.008), frameMat);
  plinth.position.set(0, 0.05, 0);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);
  // middle divider between the two bays (bays sit at local z ±0.35, so the
  // divider belongs at local z 0 — anything else slices through bay 0)
  const div = new THREE.Mesh(new THREE.BoxGeometry(D - 0.1, H - 0.15, 0.014), frameMat);
  div.position.set(0, (H - 0.15) / 2 + 0.1, 0);
  div.castShadow = true;
  g.add(div);

  // F1 (Kefan approved): drawer fronts on the bottom compartment, one per bay
  const pullMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.55, metalness: 0.4 });
  [-0.393, 0.393].forEach((zc) => {
    // full solid drawer body behind the same front plane (see buildCabinet)
    const front = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.58, 0.75, 2, 0.005), frameMat);
    front.position.set(-D / 2 + 0.012 + 0.2, 0.405, zc);
    front.castShadow = true;
    front.receiveShadow = true;
    g.add(front);
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.02, 0.16), pullMat);
    pull.position.set(-D / 2 + 0.014, 0.64, zc);
    g.add(pull);
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a4b5c, roughness: 0.16, metalness: 0, transparent: true, opacity: 0.3,
    envMapIntensity: 0.7, clearcoat: 0.15, clearcoatRoughness: 0.28,
  });
  CAB2.rows.forEach((y, ri) => {
    // bottom row opaque grey wood (Kefan) — see buildCabinet
    const bottomRow = ri === CAB2.rows.length - 1;
    const board = new THREE.Mesh(
      new RoundedBoxGeometry(D - 0.08, bottomRow ? 0.02 : 0.014, W - 0.08, 2, 0.004),
      bottomRow ? cabinetBackMaterial() : glassMat);
    board.position.set(0, y - (bottomRow ? 0.01 : 0.007), 0);
    board.receiveShadow = true;
    g.add(board);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.008, W - 0.14),
      new THREE.MeshStandardMaterial({ color: 0x6a7078, emissive: 0xbcd7ff, emissiveIntensity: 1.15 })
    );
    strip.position.set(-D / 2 + 0.1, y + CAB2.rowH - 0.055, 0);
    g.add(strip);
  });

  g.position.set(CAB2.x, 0, CAB2.z);
  return g;
}

function buildToolChest() {
  // rolling tool chest: graphite body, five drawers with aluminum pulls
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x212429, roughness: 0.42, metalness: 0.55 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.65, metalness: 0.55 });
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.72, 0.42, 2, 0.014), body);
  shell.position.y = 0.42;
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);
  const topMat = new THREE.Mesh(new RoundedBoxGeometry(0.53, 0.012, 0.4, 2, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.8 }));
  topMat.position.y = 0.785;
  g.add(topMat);
  for (let i = 0; i < 5; i++) {
    const h = i < 2 ? 0.085 : 0.12;
    const y = 0.72 - 0.06 - [0, 0.1, 0.245, 0.385, 0.525][i];
    const front = new THREE.Mesh(new RoundedBoxGeometry(0.5, h, 0.014, 2, 0.005), body);
    front.position.set(0, y + 0.08, 0.215);
    g.add(front);
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.012, 0.012), alu);
    pull.position.set(0, y + 0.08 + h / 2 - 0.02, 0.228);
    g.add(pull);
  }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.024, 14),
      new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.6 }));
    caster.rotation.z = Math.PI / 2;
    caster.position.set(sx * 0.21, 0.032, sz * 0.14);
    caster.castShadow = true;
    g.add(caster);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* ============================================================
   realism set-dressing (2026-07-12 approved: B1 welding cart,
   wall Hoosier tire, C2 floor joints, C4 ESD mat, C5 chest-top)
   All REAL-TIME standalone groups (no bk_ tags) so they render
   over the baked room without needing a re-bake.
   ============================================================ */

function buildWeldingCart() {
  // TIG welding cart: two-deck steel cart, brand-blue TIG machine on top,
  // argon cylinder standing on the rear deck with a retaining strap,
  // regulator gauges, and a torch hooked on the push handle.
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.7 });
  const darkPl = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.55, metalness: 0.2 });

  // decks + posts + casters
  [[0.14, 0.56], [0.5, 0.34]].forEach(([y, len], i) => {
    const deck = new THREE.Mesh(new RoundedBoxGeometry(len, 0.018, 0.38, 2, 0.005), steel);
    deck.position.set(i === 1 ? 0.11 : 0, y, 0);
    g.add(deck);
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.5, 0.016), steel);
    post.position.set(sx * 0.26, 0.31, sz * 0.17);
    g.add(post);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12), darkPl);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * 0.24, 0.028, sz * 0.15);
    g.add(wheel);
  });
  // push handle (rear, cylinder side)
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.34, 10), steel);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(-0.3, 0.78, 0);
  g.add(handle);
  [-1, 1].forEach((s) => {
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 10), steel);
    up.position.set(-0.3, 0.64, s * 0.16);
    g.add(up);
  });

  // TIG machine on the top deck: brand-blue box + dark front panel with
  // a live amp readout, dial and rocker (canvas, same technique as the PSU)
  const tig = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.22, 0.3, 2, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x2a55c8, roughness: 0.45, metalness: 0.25 }));
  tig.position.set(0.11, 0.62, 0);
  g.add(tig);
  const tigFaceCanvas = document.createElement("canvas");
  tigFaceCanvas.width = 128; tigFaceCanvas.height = 96;
  {
    const t = tigFaceCanvas.getContext("2d");
    t.fillStyle = "#101216"; t.fillRect(0, 0, 128, 96);
    t.fillStyle = "#0a0c10"; t.fillRect(12, 12, 62, 30);
    t.fillStyle = "#ff8438"; t.font = "700 20px Consolas, monospace";
    t.fillText("142", 18, 34); t.font = "700 11px Consolas, monospace"; t.fillText("A", 60, 34);
    t.fillStyle = "#2c2f35"; t.beginPath(); t.arc(98, 28, 14, 0, Math.PI * 2); t.fill();
    t.fillStyle = "#c8ccd2"; t.fillRect(96, 16, 4, 12);
    t.fillStyle = "#22c39c"; t.beginPath(); t.arc(20, 66, 4, 0, Math.PI * 2); t.fill();
    t.fillStyle = "#9aa4b0"; t.font = "600 9px Arial"; t.fillText("TIG  AC/DC", 34, 70);
    t.fillStyle = "#2c2f35"; t.fillRect(12, 78, 104, 8);
  }
  const tigTex = new THREE.CanvasTexture(tigFaceCanvas);
  tigTex.colorSpace = THREE.SRGBColorSpace;
  const tigFace = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.17),
    new THREE.MeshStandardMaterial({ map: tigTex, emissive: 0xffffff, emissiveMap: tigTex, emissiveIntensity: 0.25, roughness: 0.6 }));
  tigFace.position.set(0.11, 0.63, 0.152);
  g.add(tigFace);
  // I4 + J7: the amp readout casts a contained warm pool — it was the only
  // bright pixel in the darkest corner, floating in black; this also gives
  // the cool-graded room its second warm anchor (the desk lamp is the first)
  const tigGlow = new THREE.PointLight(0xffb066, 0.8, 0.9, 2);
  tigGlow.position.set(0.11, 0.62, 0.22);
  g.add(tigGlow);
  MODELS.tigGlow = tigGlow; // runBootIntro darkens + restrikes it with the room
  const tigHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.2, 8), darkPl);
  tigHandle.rotation.z = Math.PI / 2;
  tigHandle.position.set(0.11, 0.75, 0);
  g.add(tigHandle);

  // argon cylinder on the rear deck: tall body, tapered shoulder, valve,
  // twin regulator gauges, stencil label, retaining strap to the posts
  const cylMat = new THREE.MeshStandardMaterial({ color: 0x3d4450, roughness: 0.35, metalness: 0.6 });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.92, 20), cylMat);
  cyl.position.set(-0.16, 0.15 + 0.46, -0.02);
  g.add(cyl);
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.075, 0.1, 20), cylMat);
  shoulder.position.set(-0.16, 1.12, -0.02);
  g.add(shoulder);
  // top hardware as ONE connected stack (v1 had a detached regulator block
  // with two gauge discs floating 17 mm in front of it — Kefan flagged it):
  // valve body + handwheel on the shoulder, outlet nipple toward the room,
  // regulator on the nipple, a single gauge ON the regulator, barb + hose
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d3e, roughness: 0.35, metalness: 0.85 });
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.055, 12), brass);
  valve.position.set(-0.16, 1.195, -0.02);
  g.add(valve);
  const handwheel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 16),
    new THREE.MeshStandardMaterial({ color: 0x33363c, roughness: 0.5, metalness: 0.4 }));
  handwheel.position.set(-0.16, 1.228, -0.02);
  g.add(handwheel);
  const knobCap = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.008, 8), brass);
  knobCap.position.set(-0.16, 1.237, -0.02);
  g.add(knobCap);
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.032, 10), brass);
  outlet.rotation.x = Math.PI / 2;
  outlet.position.set(-0.16, 1.2, -0.002);
  g.add(outlet);
  const regBody = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.036, 14),
    new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.35, metalness: 0.85 }));
  regBody.rotation.x = Math.PI / 2;
  regBody.position.set(-0.16, 1.2, 0.028);
  g.add(regBody);
  const gaugeCanvas = document.createElement("canvas");
  gaugeCanvas.width = gaugeCanvas.height = 64;
  {
    const gc = gaugeCanvas.getContext("2d");
    gc.fillStyle = "#f2f3f5"; gc.beginPath(); gc.arc(32, 32, 30, 0, Math.PI * 2); gc.fill();
    gc.strokeStyle = "#2c2f35"; gc.lineWidth = 3;
    for (let a = -0.75 * Math.PI; a <= 0.25 * Math.PI; a += Math.PI / 6) {
      gc.beginPath();
      gc.moveTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22);
      gc.lineTo(32 + Math.cos(a) * 27, 32 + Math.sin(a) * 27);
      gc.stroke();
    }
    gc.strokeStyle = "#c03a30"; gc.lineWidth = 3;
    gc.beginPath(); gc.moveTo(32, 32); gc.lineTo(15, 20); gc.stroke();
  }
  const gaugeTex = new THREE.CanvasTexture(gaugeCanvas);
  gaugeTex.colorSpace = THREE.SRGBColorSpace;
  // ONE gauge, mounted flush on the regulator face (real flowmeter regs are
  // fine with one dial; the second floating disc was the complaint)
  const gaugeRim = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 16),
    new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.4, metalness: 0.6 }));
  gaugeRim.rotation.x = Math.PI / 2;
  gaugeRim.position.set(-0.16, 1.2, 0.05);
  g.add(gaugeRim);
  const gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(0.017, 16),
    new THREE.MeshStandardMaterial({ map: gaugeTex, roughness: 0.5 }));
  gaugeFace.position.set(-0.16, 1.2, 0.0575);
  g.add(gaugeFace);
  // hose barb under the regulator + argon hose down and over to the machine
  const barb = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8), brass);
  barb.position.set(-0.16, 1.178, 0.028);
  g.add(barb);
  const gasHose = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.16, 1.168, 0.028),
      new THREE.Vector3(-0.205, 1.0, 0.095),
      new THREE.Vector3(-0.13, 0.78, 0.15),
      new THREE.Vector3(0.0, 0.76, 0.08),
      new THREE.Vector3(0.10, 0.76, -0.05),
      new THREE.Vector3(0.115, 0.745, -0.185), // stay above the box top until well past its back edge
      new THREE.Vector3(0.11, 0.66, -0.17),
    ]), 40, 0.0045, 8),
    darkPl
  );
  g.add(gasHose);
  // stencil label band on the cylinder
  const argonCanvas = document.createElement("canvas");
  argonCanvas.width = 128; argonCanvas.height = 64;
  {
    const ac = argonCanvas.getContext("2d");
    ac.clearRect(0, 0, 128, 64);
    ac.fillStyle = "rgba(226,230,236,0.92)";
    ac.font = "700 26px Arial"; ac.textAlign = "center";
    ac.fillText("ARGON", 64, 40);
  }
  const argonTex = new THREE.CanvasTexture(argonCanvas);
  argonTex.colorSpace = THREE.SRGBColorSpace;
  // curved label segment sharing the cylinder's axis — a flat plane on a
  // curved bottle floats off the surface from every side angle
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0757, 0.0757, 0.06, 24, 1, true, -0.75, 1.5),
    // I6: LIT material — MeshBasic ignored the room lighting and the stencil
    // glowed like a sticker in the dark
    new THREE.MeshStandardMaterial({ map: argonTex, transparent: true, roughness: 0.8 }));
  label.position.set(-0.16, 0.86, -0.02);
  g.add(label);
  // retaining strap from the cylinder to the handle uprights
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.079, 0.006, 6, 20, Math.PI * 1.35), darkPl);
  strap.rotation.x = Math.PI / 2;
  strap.rotation.z = Math.PI * 0.82;
  strap.position.set(-0.16, 0.82, -0.02);
  g.add(strap);

  // TIG torch HANGING on the handle bar (v1 floated it 0.23 m below the bar —
  // only the orange cup was visible, mid-air): hook over the bar, body
  // hanging straight down, ceramic cup + tungsten pointing at the floor
  // 1.7π arc rotated so BOTH ends dip below the bar and land on the torch
  // body's top cap (a plain π top-arc left a 13.5 mm air gap to the torch)
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 6, 18, Math.PI * 1.7), darkPl);
  hook.rotation.z = -Math.PI * 0.35;
  hook.position.set(-0.3, 0.78, 0.09);
  g.add(hook);
  const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.075, 10), darkPl);
  torchBody.position.set(-0.3, 0.729, 0.09);
  g.add(torchBody);
  const torchCup = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0068, 0.028, 8),
    new THREE.MeshStandardMaterial({ color: 0xd88a5a, roughness: 0.6 }));
  torchCup.position.set(-0.3, 0.678, 0.09);
  g.add(torchCup);
  const tungsten = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.014, 6),
    new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.8 }));
  tungsten.position.set(-0.3, 0.66, 0.09);
  g.add(tungsten);
  // torch lead: out of the back cap, sagging down and over to the front panel
  const torchCable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.3, 0.762, 0.09),
      new THREE.Vector3(-0.27, 0.66, 0.14),
      new THREE.Vector3(-0.13, 0.5, 0.21),
      new THREE.Vector3(0.0, 0.42, 0.22),
      new THREE.Vector3(0.08, 0.5, 0.21),
      new THREE.Vector3(0.10, 0.545, 0.155),
    ]), 36, 0.004, 8),
    darkPl
  );
  g.add(torchCable);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildHoosierTire(loader) {
  // STRICT per Kefan: the REAL Hoosier 16x7.5-10 LC0 STL as-is — NO wheel,
  // NO decal ring. Molded sidewall lettering ships in the mesh; the raised
  // script is factory-painted white in the GLB (tools: scratchpad
  // bl_tire2.py — detection binned per radius on the full-res mesh).
  // Real scale: OD 0.4064 m, width 0.216 m, bore r 0.127.
  const g = new THREE.Group();
  loader.load("models/tire-hoosier-step.glb", (gltf) => {
    const tire = gltf.scene;
    tire.rotation.x = Math.PI / 2; // GLB is Y-up; this group wants the axis on +Z
    tire.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.add(tire);
    ANISO_DIRTY = true; // sweep the paint texture (sharp lettering at grazing angles)
  });
  // steel wall bracket: slim plate hidden behind the tire band + two cradle
  // arms UNDER the tire with lips in front of the sidewall
  const brMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.45, metalness: 0.75 });
  // plate corners must stay INSIDE the band annulus (bore 0.127 < r < OD
  // 0.2032): span y 0.128..0.198 -> corner radii 0.130 and 0.200
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.07, 0.012), brMat);
  plate.position.set(0, 0.163, -0.103);
  g.add(plate);
  [-1, 1].forEach((sd) => {
    // the tire's circle at x = ±0.09 bottoms out at y = -sqrt(0.2032² - 0.09²)
    // = -0.182 (NOT -0.203, that's only at x = 0 — v1 floated 2.2 cm low)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.016, 0.24), brMat);
    arm.position.set(sd * 0.09, -0.19, 0.0); // top face -0.182 meets the tread
    g.add(arm);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.05, 0.016), brMat);
    lip.position.set(sd * 0.09, -0.157, 0.118); // near face 0.110, just past the widest sidewall (0.108)
    g.add(lip);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildWallHelmet(loader, url, wallDz, yaw, neckPoint) {
  // wall-hung helmet (Kefan's STLs -> GLB, tools: scratchpad bl_weld.py /
  // bl_gt3.py). GLBs are pre-oriented: face +Z, up +Y.
  // The peg + base plate stay WALL-ALIGNED (only the helmet mesh yaws —
  // rotating the whole group tilted the base plate off the wall plane).
  // neckPoint = peg tip in helmet-local space, tuned PER MODEL: a shared tip
  // poked out below the GT3's chin bar (review blocker).
  const g = new THREE.Group();
  const pegMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.4, metalness: 0.8 });
  const a = new THREE.Vector3(0, -0.14, wallDz + 0.008); // wall end
  const b = neckPoint.clone();                            // inside the shell
  const dir = b.clone().sub(a);
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, dir.length(), 10), pegMat);
  peg.position.copy(a).addScaledVector(dir, 0.5);
  peg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  g.add(peg);
  const pegBase = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.012, 12), pegMat);
  pegBase.rotation.x = Math.PI / 2;
  pegBase.position.set(0, -0.14, wallDz + 0.006);
  g.add(pegBase);
  loader.load(url, (gltf) => {
    const h = gltf.scene;
    h.rotation.set(-0.08, yaw, 0); // resting on the peg, nose a touch up
    h.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    g.add(h);
    ANISO_DIRTY = true;
  });
  return g;
}

function buildFireExtinguisher() {
  // small 5 lb ABC extinguisher on the floor (E2, Kefan: keep it small, on
  // the ground near the cabinet) — body, dome, valve + levers, hose, gauge
  const g = new THREE.Group();
  const red = new THREE.MeshStandardMaterial({ color: 0x9e1f1a, roughness: 0.35, metalness: 0.15 });
  const darkHw = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.30, 20), red);
  body.position.y = 0.17;
  g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.052, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = 0.32;
  g.add(dome);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.054, 0.056, 0.02, 20), darkHw);
  base.position.y = 0.01;
  g.add(base);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.035, 10),
    new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.35, metalness: 0.85 }));
  neck.position.y = 0.385;
  g.add(neck);
  // valve head + carry/squeeze levers
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.028, 0.03, 2, 0.006), darkHw);
  head.position.y = 0.41;
  g.add(head);
  // levers hinge at the head's left edge — only ~10 mm inserts into the head
  // (v1 ran them straight through the whole head box)
  [[0.020, 0.06], [0.0, -0.02]].forEach(([dy, tilt]) => {
    const lever = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.022), darkHw);
    lever.position.set(-0.0525, 0.412 + dy, 0);
    lever.rotation.z = tilt;
    g.add(lever);
  });
  // pressure gauge on the neck front
  const gaugeRim = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.008, 12), darkHw);
  gaugeRim.rotation.x = Math.PI / 2;
  gaugeRim.position.set(0, 0.397, 0.016);
  g.add(gaugeRim);
  const gaugeFace = new THREE.Mesh(new THREE.CircleGeometry(0.008, 12),
    new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.4 }));
  gaugeFace.position.set(0, 0.397, 0.0205);
  g.add(gaugeFace);
  // hose from the valve, clipped down the side
  const hose = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.022, 0.41, 0),
      new THREE.Vector3(0.062, 0.37, 0.01),
      new THREE.Vector3(0.064, 0.24, 0.015),
      new THREE.Vector3(0.062, 0.12, 0.012),
    ]), 24, 0.0055, 8),
    darkHw
  );
  g.add(hose);
  // axis distance 0.0631 > body r 0.052 + tip r 0.009 — clear of the body
  const nozzleTip = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.006, 0.03, 10), darkHw);
  nozzleTip.position.set(0.062, 0.098, 0.012);
  g.add(nozzleTip);
  // instruction label band
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 64; labelCanvas.height = 64;
  {
    const lc = labelCanvas.getContext("2d");
    lc.fillStyle = "#f2f3f5"; lc.fillRect(0, 0, 64, 64);
    lc.fillStyle = "#c03a30"; lc.fillRect(0, 0, 64, 18);
    lc.fillStyle = "#ffffff"; lc.font = "700 11px Arial"; lc.textAlign = "center";
    lc.fillText("FIRE", 32, 13);
    lc.fillStyle = "#3a3e45";
    for (let i = 0; i < 4; i++) lc.fillRect(8, 26 + i * 9, 48, 3);
  }
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0525, 0.0525, 0.09, 20, 1, true, -0.55, 1.1),
    // I6: lit material — the Basic label glowed at night
    new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.75 }));
  label.position.y = 0.20;
  g.add(label);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildHotWorkMark() {
  // K3: hazard-striped border marking the welding footprint on the concrete
  const c = document.createElement("canvas");
  c.width = 512; c.height = 400;
  const x = c.getContext("2d");
  x.clearRect(0, 0, 512, 400);
  const BW = 26; // border thickness in px
  x.save();
  x.beginPath();
  x.rect(0, 0, 512, 400);
  x.rect(BW, BW, 512 - 2 * BW, 400 - 2 * BW);
  x.clip("evenodd");
  x.fillStyle = "rgba(225,228,233,0.85)";
  x.fillRect(0, 0, 512, 400);
  x.strokeStyle = "rgba(24,25,28,0.9)";
  x.lineWidth = 14;
  for (let d = -400; d < 912; d += 34) {
    x.beginPath(); x.moveTo(d, 0); x.lineTo(d + 400, 400); x.stroke();
  }
  x.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.9),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(1.64, 0.0028, -0.98);
  m.receiveShadow = true;
  return m;
}

function buildFloorStains() {
  // J5: weld-corner grime — dark stains + caster scuff arcs on the concrete
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  x.clearRect(0, 0, 512, 512);
  const blob = (bx, by, r, a) => {
    const g2 = x.createRadialGradient(bx, by, 0, bx, by, r);
    g2.addColorStop(0, `rgba(16,17,19,${a})`);
    g2.addColorStop(1, "rgba(16,17,19,0)");
    x.fillStyle = g2;
    x.fillRect(bx - r, by - r, r * 2, r * 2);
  };
  blob(180, 300, 120, 0.42);
  blob(330, 180, 90, 0.3);
  blob(390, 360, 70, 0.35);
  blob(120, 140, 55, 0.22);
  x.strokeStyle = "rgba(22,23,26,0.4)";
  for (let i = 0; i < 9; i++) {
    x.lineWidth = 3 + Math.random() * 4;
    const cx = 80 + Math.random() * 360, cy = 80 + Math.random() * 360;
    const r = 40 + Math.random() * 120;
    const a0 = Math.random() * 6.28;
    x.beginPath(); x.arc(cx, cy, r, a0, a0 + 0.5 + Math.random()); x.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.2),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.98, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(1.62, 0.0021, -0.95);
  m.receiveShadow = true;
  return m;
}

function buildLabStool() {
  // K5: rolling lab stool for the electronics bench
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.6, metalness: 0.2 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.35, metalness: 0.85 });
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.145, 0.05, 22), dark);
  seat.position.y = 0.56;
  g.add(seat);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 12), steel);
  post.position.y = 0.38;
  g.add(post);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.008, 8, 24), steel);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.24;
  g.add(ring);
  [0, 1, 2, 3, 4].forEach((i) => {
    const a = (i / 5) * Math.PI * 2;
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.024, 0.036, 2, 0.008), dark);
    leg.position.set(Math.cos(a) * 0.12, 0.1, Math.sin(a) * 0.12);
    leg.rotation.y = -a;
    g.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), dark);
    wheel.position.set(Math.cos(a) * 0.22, 0.032, Math.sin(a) * 0.22);
    g.add(wheel);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildScrapBin() {
  // K6: perforated sheet-steel scrap bin with a few tube offcuts
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d");
  x.fillStyle = "#2c2f34";
  x.fillRect(0, 0, 128, 128);
  x.fillStyle = "#17181c";
  for (let py = 8; py < 128; py += 14)
    for (let px = ((py / 14) % 2) * 7 + 6; px < 128; px += 14) {
      x.beginPath(); x.arc(px, py, 2.6, 0, 7); x.fill();
    }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const perf = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide });
  const W = 0.28, H = 0.34, D = 0.28, TH = 0.006;
  [[W, H, TH, 0, H / 2, -D / 2], [W, H, TH, 0, H / 2, D / 2],
   [TH, H, D, -W / 2, H / 2, 0], [TH, H, D, W / 2, H / 2, 0],
   [W, TH, D, 0, TH / 2, 0]].forEach(([w, h, d, px, py, pz]) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), perf);
    p.position.set(px, py, pz);
    g.add(p);
  });
  const rim = new THREE.Mesh(new THREE.BoxGeometry(W + 0.014, 0.014, D + 0.014),
    new THREE.MeshStandardMaterial({ color: 0x3a3e45, roughness: 0.4, metalness: 0.7 }));
  rim.position.y = H;
  g.add(rim);
  // offcuts leaning inside
  const stockMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.45, metalness: 0.85 });
  [[0.05, -0.03, 0.28, 0.24], [-0.04, 0.05, 0.34, -0.3], [0.0, 0.06, 0.3, 0.5]].forEach(([px, pz, len, tilt], i) => {
    const r = 0.012 - i * 0.002;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), stockMat);
    bar.position.set(px, H - 0.06 + len / 6, pz);
    bar.rotation.z = tilt;
    bar.rotation.x = tilt * 0.6;
    g.add(bar);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildCuttingMatOverlay() {
  // J1: gridded self-healing cutting mat over the baked black desk pad.
  // 0.72 x 0.52 m LANDSCAPE (Kefan 2026-07-14: bigger, clearly rectangular —
  // the first cut was a near-square 0.445 x 0.505); still fully covers the
  // baked pad and stays 3 cm inside the desk slab's front edge
  const W = 720, H = 520; // canvas px, 10 px = 1 cm
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d");
  x.fillStyle = "#16181d";
  x.fillRect(0, 0, W, H);
  const cm = 10;
  x.strokeStyle = "rgba(96,130,168,0.28)";
  x.lineWidth = 1;
  for (let gx = 3 * cm; gx <= W - 3 * cm + 0.1; gx += cm) {
    x.beginPath(); x.moveTo(gx, 3 * cm); x.lineTo(gx, H - 3 * cm); x.stroke();
  }
  for (let gy = 3 * cm; gy <= H - 3 * cm + 0.1; gy += cm) {
    x.beginPath(); x.moveTo(3 * cm, gy); x.lineTo(W - 3 * cm, gy); x.stroke();
  }
  x.strokeStyle = "rgba(150,182,214,0.5)";
  x.lineWidth = 1.6;
  for (let gx = 3 * cm; gx <= W - 3 * cm + 0.1; gx += 5 * cm) {
    x.beginPath(); x.moveTo(gx, 3 * cm); x.lineTo(gx, H - 3 * cm); x.stroke();
  }
  for (let gy = 3 * cm; gy <= H - 3 * cm + 0.1; gy += 5 * cm) {
    x.beginPath(); x.moveTo(3 * cm, gy); x.lineTo(W - 3 * cm, gy); x.stroke();
  }
  // border + corner diagonals + quiet branding
  x.strokeStyle = "rgba(150,182,214,0.6)";
  x.lineWidth = 2;
  x.strokeRect(2 * cm, 2 * cm, W - 4 * cm, H - 4 * cm);
  x.beginPath(); x.moveTo(3 * cm, 8 * cm); x.lineTo(8 * cm, 3 * cm); x.stroke();
  x.beginPath(); x.moveTo(W - 3 * cm, H - 8 * cm); x.lineTo(W - 8 * cm, H - 3 * cm); x.stroke();
  x.fillStyle = "rgba(150,182,214,0.55)";
  x.font = "600 13px Arial";
  x.fillText("SELF-HEALING CUTTING MAT", 2 * cm + 10, H - 2 * cm - 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.0016, 0.52, 1, 0.0006),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.88, metalness: 0.02 }));
  // 0.2 mm above the desk slab's top face (0.765) — the baked pad this used
  // to ride on is hidden in the GLB callback now
  m.position.set(0.02, 0.766, 0.16);
  m.receiveShadow = true;
  return m;
}

function buildFloorJoints() {
  // saw-cut control joints in the concrete slab: a 16 m pour with zero joints
  // reads as one continuous mush — real slabs are cut every ~3 m. Thin dark
  // strips just above the baked floor (occluded by the rug where they pass
  // under it).
  const g = new THREE.Group();
  const jointMat = new THREE.MeshStandardMaterial({ color: 0x3f4248, roughness: 1, metalness: 0 });
  const strip = (w, d, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.0012, d), jointMat);
    m.position.set(x, 0.0015, z);
    g.add(m);
  };
  [-1.7, 1.7].forEach((x) => strip(0.014, 5.05, x, 1.02)); // run the room depth
  [0.6, 2.6].forEach((z) => strip(5.15, 0.014, 0, z));     // run the room width
  return g;
}

function buildBenchMat() {
  // ESD anti-fatigue mat in front of the electronics bench + a ground lead
  // clipped to the bench frame — the detail that backs up the "electronics
  // workbench" claim the scene already makes.
  const g = new THREE.Group();
  const matCanvas = document.createElement("canvas");
  matCanvas.width = matCanvas.height = 128;
  {
    const m = matCanvas.getContext("2d");
    m.fillStyle = "#1a1c20"; m.fillRect(0, 0, 128, 128);
    m.strokeStyle = "#23262b"; m.lineWidth = 2;
    for (let i = 0; i <= 128; i += 16) {
      m.beginPath(); m.moveTo(i, 0); m.lineTo(i, 128); m.stroke();
      m.beginPath(); m.moveTo(0, i); m.lineTo(128, i); m.stroke();
    }
  }
  const matTex = new THREE.CanvasTexture(matCanvas);
  matTex.colorSpace = THREE.SRGBColorSpace;
  matTex.wrapS = matTex.wrapT = THREE.RepeatWrapping;
  matTex.repeat.set(2, 4);
  const mat = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.008, 1.25, 2, 0.004),
    new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.92, metalness: 0 }));
  mat.position.set(-1.66, 0.005, -0.2);
  mat.receiveShadow = true;
  g.add(mat);
  // ground lead: mat corner lug -> bench frame
  const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10),
    new THREE.MeshStandardMaterial({ color: 0xb0793a, roughness: 0.4, metalness: 0.8 }));
  lug.position.set(-1.88, 0.012, 0.32);
  g.add(lug);
  const lead = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(-1.88, 0.012, 0.32),
      new THREE.Vector3(-1.98, 0.02, 0.38),
      new THREE.Vector3(-2.08, 0.09, 0.4),
      new THREE.Vector3(-2.14, 0.16, 0.38),
    ]), 20, 0.0022, 8),
    new THREE.MeshStandardMaterial({ color: 0x2c5c33, roughness: 0.6, metalness: 0.05 })
  );
  g.add(lead);
  return g;
}

function buildChestTopProps() {
  // lived-in top for the rolling tool chest. The chest itself is part of the
  // BAKED layer (bk_chest) — its procedural original is hidden — so these
  // props are a standalone REAL-TIME group placed at the chest's world pose.
  const g = new THREE.Group();
  const toolSteel = new THREE.MeshStandardMaterial({ color: 0xb9bec6, roughness: 0.3, metalness: 0.9 });
  const darkPl = new THREE.MeshStandardMaterial({ color: 0x17191d, roughness: 0.55, metalness: 0.2 });
  // torque wrench laid diagonally: shaft + knurled grip + square-drive head
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.3, 10), toolSteel);
  shaft.rotation.z = Math.PI / 2;
  shaft.rotation.y = 0.45;
  shaft.position.set(0.02, 0.012, 0.03);
  g.add(shaft);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.09, 10), darkPl);
  grip.rotation.z = Math.PI / 2;
  grip.rotation.y = 0.45;
  grip.position.set(-0.085, 0.012, 0.081);
  g.add(grip);
  const drive = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.02, 0.024), toolSteel);
  drive.position.set(0.155, 0.012, -0.035);
  g.add(drive);
  // safety glasses, folded: smoked lens band + two folded temples
  const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x2a3038, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.55 });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.028, 18, 1, true, -0.6, 1.2), lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.rotation.z = Math.PI / 2;
  lens.position.set(-0.14, 0.02, -0.1);
  g.add(lens);
  [-1, 1].forEach((s) => {
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.004, 0.006), darkPl);
    temple.position.set(-0.14 + s * 0.012, 0.012, -0.1 + s * 0.014);
    temple.rotation.y = s * 0.25;
    g.add(temple);
  });
  // small parts tray with a few bolts
  const tray = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.018, 0.09, 2, 0.005), darkPl);
  tray.position.set(0.16, 0.012, 0.13);
  g.add(tray);
  [[-0.03, 0.01, 0.35], [0.005, -0.015, -0.4], [0.035, 0.02, 1.1]].forEach(([dx, dz, rot]) => {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 6), toolSteel);
    bolt.rotation.z = Math.PI / 2;
    bolt.rotation.y = rot;
    bolt.position.set(0.16 + dx, 0.026, 0.13 + dz);
    g.add(bolt);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildBlueprintPanel() {
  // wide technical schematic panel (Mk.8 line drawing) above the cabinet
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 300;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#14161a"; ctx.fillRect(0, 0, 1024, 300);
  ctx.strokeStyle = "#1f242c"; ctx.lineWidth = 1;
  for (let x = 0; x <= 1024; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 300); ctx.stroke(); }
  for (let y = 0; y <= 300; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1024, y); ctx.stroke(); }
  ctx.strokeStyle = "#8fb8e8"; ctx.lineWidth = 2;
  // side-profile race car schematic
  ctx.beginPath();
  ctx.moveTo(180, 190);
  ctx.lineTo(300, 185); ctx.lineTo(360, 150); ctx.lineTo(470, 140);
  ctx.lineTo(520, 110); ctx.lineTo(610, 108); ctx.lineTo(650, 140);
  ctx.lineTo(760, 150); ctx.lineTo(800, 185); ctx.lineTo(840, 190);
  ctx.stroke();
  [[300, 200, 38], [740, 200, 38]].forEach(([cx, cy, r]) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.55, 0, 7); ctx.stroke();
  });
  // rear wing + dimension lines
  ctx.strokeRect(806, 96, 70, 10);
  ctx.strokeStyle = "#3f8cff"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(180, 250); ctx.lineTo(840, 250); ctx.stroke();
  [180, 840].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 242); ctx.lineTo(x, 258); ctx.stroke(); });
  ctx.fillStyle = "#8fb8e8"; ctx.font = "600 20px Consolas, monospace";
  ctx.fillText("OEM MK.8 — WB 1550", 440, 244);
  ctx.fillStyle = "#53565c"; ctx.font = "600 16px Consolas, monospace";
  ctx.fillText("KW/ENG-024  REV C", 850, 285);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAXA;
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.66, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.4, metalness: 0.6 }));
  g.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 0.6),
    new THREE.MeshBasicMaterial({ map: tex, color: 0xa8b0ba }));
  face.position.z = 0.017;
  g.add(face);
  return g;
}

function buildResumePaper(loader) {
  const g = new THREE.Group();
  const { width, height, thickness } = RESUME_PAPER;
  const texture = loader.load(RESUME_ASSET.preview, () => { ANISO_DIRTY = true; });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = MAXA;
  const sheet = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, height),
    new THREE.MeshStandardMaterial({ color: 0xf3f0e9, roughness: .98 }));
  sheet.castShadow = true; sheet.receiveShadow = true; g.add(sheet);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
    new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: .98,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0 }));
  face.rotation.x = -Math.PI / 2;
  face.position.y = thickness / 2 + .00002;
  g.add(face); g.userData.resumeFace = face;
  return g;
}

function makeRadialShadowTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.55)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.2)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================
   panel HTML builders
   ============================================================ */
function escapeMarkup(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function projectHTML(p) {
  const hi = (p.highlights || []).map((h) => `<li>${h}</li>`).join("");
  const tools = (p.tools || []).map((t) => `<span class="exp-chip">${t}</span>`).join("");
  const img = (p.gallery && p.gallery[0] && p.gallery[0].src) || p.image || "";
  const details = (p.details || [])
    .map(
      (d) => `
      <div class="exp-panel__detail">
        <h3 class="exp-panel__h3">${d.title}</h3>
        <ul class="exp-panel__list">${(d.points || []).map((pt) => `<li>${pt}</li>`).join("")}</ul>
      </div>`
    )
    .join("");
  const gallery = (p.gallery || [])
    .map(
      (it, index) => `
      <figure class="exp-panel__shot">
        <button type="button" class="exp-panel__shot-button" data-exp-gallery aria-label="Enlarge image ${index + 1}">
          <img src="${escapeMarkup(it.thumbnail || it.src)}" data-full-src="${escapeMarkup(it.src)}" alt="${escapeMarkup(it.alt || "")}" loading="lazy" decoding="async" />
        </button>
        ${it.caption ? `<figcaption>${it.caption}</figcaption>` : ""}
      </figure>`
    )
    .join("");
  // lead with the image grid so visitors see the project's photos first
  // (mirrors the homepage project description); fall back to a single hero
  // image only when a project has no gallery.
  const lead = gallery
    ? `<div class="exp-panel__gallery">${gallery}</div>`
    : img
      ? `<div class="exp-panel__media"><img src="${img}" alt="" loading="lazy" decoding="async"></div>`
      : "";
  return `
    <button class="exp-panel__close" data-close aria-label="Close">&times;</button>
    <p class="exp-panel__kicker">${p.kicker || ""}</p>
    <h2 class="exp-panel__title">${p.title || ""}</h2>
    <p class="exp-panel__summary">${p.summary || ""}</p>
    ${lead}
    ${hi ? `<h3 class="exp-panel__h3">Key results</h3><ul class="exp-panel__list">${hi}</ul>` : ""}
    ${tools ? `<h3 class="exp-panel__h3">Tools and methods</h3><div class="exp-panel__chips">${tools}</div>` : ""}
    ${details}
  `;
}

/* ============================================================
   bootstrap
   ============================================================ */
if (!canvas || !webglSupported()) {
  document.documentElement.classList.add("exp-no-webgl");
  console.warn("[experience] WebGL unavailable — static fallback in use");
  if (loaderEl) {
    const txt = loaderEl.querySelector(".exp-loader__text");
    startupUI.fail("WebGL unavailable — use View classic site");
    const bar = loaderEl.querySelector(".exp-loader__bar");
    if (bar) bar.style.display = "none";
  }
} else {
  initScene(canvas).catch((error) => {
    console.error("[experience] initialization failed", error);
    document.documentElement.classList.add("exp-no-webgl");
    const text = loaderEl?.querySelector(".exp-loader__text");
    startupUI.fail("Studio unavailable — use View classic site");
  });
}
