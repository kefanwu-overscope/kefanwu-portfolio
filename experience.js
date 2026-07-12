/* ============================================================
   experience.js — 3D study experience
   Real SolidWorks assemblies (per-part STLs merged into GLBs with
   material buckets), a custom wide display cabinet (3 per row),
   PBR-textured desk/room, Genshin-style interact markers, and a
   subtle bloom post pass. Click an exhibit -> camera flies in and
   the case-study panel opens; the desk folder opens the resume.

   Credits: green banker lamp — "Desk lamp" by Poly by Google,
   CC-BY 3.0 (via Poly Pizza). Other third-party assets CC0.
   See ATTRIBUTIONS.txt.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { RESUME } from "./experience-data.js";

document.documentElement.classList.add("exp-js");

// low tier: phones / coarse pointers get a lighter pipeline
const LOW_TIER =
  window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820;

// baked lighting (Blender/Cycles, tools/bake/): swap the architecture layer
// for a lightmapped GLB; false = fully procedural fallback
const USE_BAKED = true;

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

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
const revealScene = () => document.documentElement.classList.add("exp-ready");
const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

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
      const t = loader.load(`${d.base}_${suffix}`);
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

function cabinetFrameMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x9da3aa,
    roughness: 0.6,
    metalness: 0.0,
  });
}

function cabinetBackMaterial() {
  const mat = woodMaterial(0xb9bfc6, 0.78, "grey_wood");
  mat.normalScale.set(0.3, 0.3);
  return mat;
}
const brassMat = () =>
  new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.3, metalness: 1.0 });

/* engineering materials for the merged assembly buckets (mesh name mat_*) */
const ASSEMBLY_MATS = {
  // fully-metallic mats live off the env map — boost per-material intensity
  // so the CAD exhibits stay readable at the scene's low global env level
  steel: () => new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1.0, roughness: 0.45, envMapIntensity: 1.8 }),
  brass: () => new THREE.MeshStandardMaterial({ color: 0x9d9789, metalness: 1.0, roughness: 0.35, envMapIntensity: 1.6 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.15, roughness: 0.5, envMapIntensity: 1.4 }),
  printed: () => new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.12, roughness: 0.58, envMapIntensity: 1.2 }),
  aero: () => new THREE.MeshStandardMaterial({ color: 0xd8dadc, metalness: 0.05, roughness: 0.42, envMapIntensity: 1.2 }),
  carbon: () => {
    // self-lit through the twill map: the weave stays readable inside the
    // dim bay without flattening into grey plastic
    const twill = makeCarbonTwillTexture();
    return new THREE.MeshPhysicalMaterial({
      map: twill,
      color: 0xd8dce2,
      emissiveMap: twill,
      emissive: 0xaab4c4,
      emissiveIntensity: 1.1,
      metalness: 0.3,
      roughness: 0.5,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
      envMapIntensity: 2.6,
    });
  },
  rubber: () => new THREE.MeshStandardMaterial({ color: 0x0d0e10, metalness: 0.0, roughness: 0.95 }),
  // guitar bodies/necks + pool cue — the one warm note, kept restrained
  wood: () => new THREE.MeshStandardMaterial({ color: 0x9a774a, metalness: 0.0, roughness: 0.5, envMapIntensity: 1.0 }),
  // circuit boards (Arduino, driver/sensor PCBs)
  pcb: () => new THREE.MeshStandardMaterial({ color: 0x1e5f3c, metalness: 0.2, roughness: 0.5, envMapIntensity: 1.0 }),
  // clear acrylic windows (pool sniper housing)
  glass: () => new THREE.MeshPhysicalMaterial({ color: 0xcfd6dc, roughness: 0.06, metalness: 0, transparent: true, opacity: 0.22, transmission: 0.6, side: THREE.DoubleSide }),
};

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

function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_TIER ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
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
    gtao.blendIntensity = 0.7;
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
    0.09, // strength — a whisper halo on true emitters only
    0.4, // radius
    0.96 // threshold — near-clipping emitters only; no wash off white surfaces
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- loading manager ---------- */
  const manager = new THREE.LoadingManager();
  const barEl = loaderEl ? loaderEl.querySelector(".exp-loader__bar i") : null;
  const txtEl = loaderEl ? loaderEl.querySelector(".exp-loader__text") : null;
  manager.onProgress = (url, loaded, total) => {
    if (!barEl || !total) return;
    const pct = Math.round((loaded / total) * 100);
    barEl.style.animation = "none";
    barEl.style.width = pct + "%";
    if (txtEl) txtEl.textContent = "Loading " + pct + "%";
  };
  let revealed = false;
  // one-shot: set when a flow (deep link) skips the normal drag-hint timing;
  // checked once in closePanel() so the hint still surfaces exactly once
  let pendingDragHintOnClose = false;
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    revealScene();
    // deep link: experience.html#<projectKey> flies straight to that exhibit
    // (the homepage case-study panels link here) — visitors with a specific
    // destination skip the cinematic intro and keep it for a later visit
    const dlKey = decodeURIComponent((location.hash || "").slice(1));
    const dlPivot = dlKey && HOTSPOTS.find((h) => h.userData.hotspot.key === dlKey);
    if (dlPivot) {
      camera.position.copy(REST_POS);
      camera.lookAt(REST_TARGET);
      controls.target.copy(REST_TARGET);
      try { localStorage.setItem("kw_intro_seen", "1"); } catch (e) {}
      pendingDragHintOnClose = true; // panel opens immediately; show the hint once they close it
      if (!prefersReducedMotion) {
        runLightIntro();
        setTimeout(() => focusHotspot(dlPivot), 650);
      } else {
        focusHotspot(dlPivot);
      }
      return;
    }
    if (!prefersReducedMotion) {
      let seenBefore = false;
      try { seenBefore = localStorage.getItem("kw_intro_seen") === "1"; } catch (e) {}
      // first visit: cold-boot choreography synced to the guided flight;
      // returning visitors keep the quick staged ramp
      if (seenBefore) runLightIntro();
      else runBootIntro();
      startIntro(); // the drag hint fires from startIntro()'s final flight leg, once the camera actually lands
    } else {
      // no flight to wait for under reduced motion — show it immediately
      showDragHint();
    }
  };
  manager.onLoad = doReveal;
  setTimeout(doReveal, 10000); // safety

  setupTextures(manager);

  const pmrem = new THREE.PMREMGenerator(renderer);
  if (!USE_BAKED) new HDRLoader(manager).load("hdri/wooden_lounge_1k.hdr", (tex) => {
    // legacy HDRI environment — replaced by the baked in-room probe
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
  key.shadow.mapSize.set(LOW_TIER ? 1024 : 4096, LOW_TIER ? 1024 : 4096);
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
    const l = stripLight(2.2, LOW_TIER ? 16.5 : 11.5); // brighter: exhibits read too dim (Kefan)
    l.position.set(0, y + 0.42, CAB.z + 0.34);
    scene.add(l);
    l.lookAt(0, y + 0.06, CAB.z); // ~45° down-back: lights faces AND backs
    caseStrips.main.push(l);
  });
  sideRows.forEach((y) => {
    const l = stripLight(1.4, LOW_TIER ? 15.5 : 10.8);
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

  /* first-visit cold boot: the room powers on in sync with the guided flight.
     Rug LEDs trace on, each cabinet's strips strike alive as the camera
     passes it, and the desk lamp "clicks" last — landing the warm pool on
     the resume and implicitly teaching the light switch. Timings follow the
     intro flight legs (1700 + 1900 + 1500 ms). */
  let bootRaf = 0;
  let bootRestore = null;
  function cancelBoot() {
    if (!bootTakeover) return;
    bootTakeover = false;
    if (bootRaf) cancelAnimationFrame(bootRaf);
    if (bootRestore) bootRestore();
    bootRestore = null;
  }
  function runBootIntro() {
    if (bootTakeover) return; // re-entry would capture mid-boot values as targets
    bootTakeover = true;
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
    bakedMats.forEach((m) => { m.lightMapIntensity = 0.15; });
    // if the user grabs the light switch mid-boot, snap the pieces that
    // applyLightState doesn't own to their steady-state values
    bootRestore = () => {
      renderer.toneMappingExposure = exposure0;
      bloom.strength = bloom0;
      caseSpots.forEach((s) => { s.l.intensity = s.target; });
      caseStrips.main.concat(caseStrips.side).forEach((l) => { l.intensity = l.userData.bootTarget; });
      stripMats.main.concat(stripMats.side).forEach((m) => { m.emissiveIntensity = 1.15; });
      bakedMats.forEach((m) => { m.lightMapIntensity = 0.6; });
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
    seg(200, 2400, (k) => { bakedMats.forEach((m) => { m.lightMapIntensity = 0.15 + 0.45 * k; }); });
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
    // the moon reveals itself as the camera settles toward the rest pose
    seg(3600, 900, (k) => { moonSpot.intensity = MOON_NIGHT * k; });
    // final beat at flight landing: the lamp clicks on — snappy, not eased —
    // and the warm pool blooms up on the resume
    seg(5050, 90, (k) => lampLeds.forEach((m) => { m.emissiveIntensity = 2.4 * k; }), lin);
    seg(5080, 320, (k) => { benchGlow.intensity = 0.95 * k; }, easeOut);
    // overshoot slightly then settle on applyLightState's night value (2.8)
    seg(5100, 420, (k) => {
      resumeSpot.intensity = 2.8 * (k < 0.6 ? (k / 0.6) * 1.18 : 1.18 - 0.18 * ((k - 0.6) / 0.4));
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

  /* ---------- loaders ---------- */
  const loader = new GLTFLoader(manager);
  const artLoader = new THREE.TextureLoader(manager);

  /* ---------- desk (procedural, PBR) + desk props ---------- */
  const DESK_TOP = 0.76;
  const deskGroup = buildDesk();
  deskGroup.name = "bk_desk";
  scene.add(deskGroup);

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
      center, marker, markerY: mLocal.y, phase: Math.random() * Math.PI * 2,
    };
    HOTSPOTS.push(deskLamp);
  }

  // resume: the hero object on the desk — front and center, in the light
  placeRoot(buildResumePaper(), scene, {
    name: "resumePaper", action: "resume", label: "Résumé",
    // desk top 0.76 + leather inlay 0.012 — sit ON the leather, not inside it
    pos: [0.02, DESK_TOP + 0.013, 0.16], rotY: 0.12,
  });

  /* ---------- display cabinet + exhibits (3 x 3) ---------- */
  scene.add(buildDisplayCabinet());

  // real SolidWorks assemblies (merged per-part STLs, material buckets)
  // hero row (middle, eye level): javelin / steering / brake
  const ASSEMBLIES = [
    { file: "seat",     key: "carbonSeat", label: "Carbon fiber seat", size: 0.3,  axis: "y", bay: 0, row: 0, rotY: 0.4 },
    { file: "aura",     key: "aura",       label: "AURA Swerve",       size: 0.29, axis: "y", bay: 1, row: 0, rotY: 0.35, rotZ: -Math.PI / 2,
      matTweak: { printed: { color: 0x9299a1, metalness: 0.05, roughness: 0.45 } } }, // aluminum/grey structure
    { file: "scanner",  key: "scanner",    label: "3D scanner",        size: 0.38, axis: "x", bay: 2, row: 0, rotY: 0.35,
      matTweak: { printed: { color: 0x2a55c8 }, wood: { color: 0xdfd2b0, roughness: 0.7 } } }, // blue brackets, near-white plywood base (photo); truss + EMG cover ride the light-grey aero bucket
    { file: "javelin",  key: "javelin",    label: "Javelin VTOL",      size: 0.44, axis: "x", bay: 0, row: 1, rotY: 0.6,
      matTweak: { aero: { color: 0x3a3e44, roughness: 0.4, envMapIntensity: 1.6 }, printed: { color: 0x26292e }, dark: { color: 0x24272c } } },
    { file: "steering", key: "steering",   label: "Mk.8 Steering",     size: 0.32, axis: "y", bay: 1, row: 1, rotY: 0.5 },
  ];
  ASSEMBLIES.forEach((a) =>
    loadAssembly(loader, scene, `models/real/${a.file}.glb`, {
      name: "ex_" + a.key, projectKey: a.key, label: a.label,
      targetSize: a.size, axis: a.axis, matTweak: a.matTweak, fit: [0.6, 0.4, 0.4],
      markerCap: CAB.rows[a.row] + (a.row === 0 ? 0.36 : 0.44), // top row: stay under the cabinet's top frame
      pos: [CAB.bays[a.bay], CAB.rows[a.row], CAB.frontZ], rotY: a.rotY, rotZ: a.rotZ,
    })
  );

  // real CAD exhibits (merged per-part STLs) + one procedural CFD monitor
  loadAssembly(loader, scene, "models/real/brakeSim.glb", {
    fit: [0.6, 0.4, 0.4], markerCap: CAB.rows[1] + 0.44, name: "ex_brakeSim", projectKey: "brakeSim", label: "FSAE Brake Sim",
    targetSize: 0.26, axis: "y", pos: [CAB.bays[2], CAB.rows[1], CAB.frontZ], rotY: Math.PI / 2 + 0.25,
    matTweak: { steel: { color: 0xbcc2c9, roughness: 0.4, metalness: 1.0 } }, // bright silver rotor
  });
  loadAssembly(loader, scene, "models/real/lineFollower.glb", {
    fit: [0.6, 0.4, 0.4], markerCap: CAB.rows[2] + 0.44, name: "ex_lineFollower", projectKey: "lineFollower", label: "LineFollower robot",
    targetSize: 0.34, axis: "z", pos: [CAB.bays[0], CAB.rows[2], CAB.frontZ], rotY: 0.45,
    // photo-matched: bright orange tires, Arduino-teal main PCB, silver
    // motors + silver/white battery wrap (both live in the "dark" bucket)
    matTweak: { rubber: { color: 0xe8883a, roughness: 0.6 }, pcb: { color: 0x146e80 },
      dark: { color: 0x9a9ea3, metalness: 0.6, roughness: 0.45 } },
  });
  placeRoot(buildCfdDisplay(artLoader), scene, {
    fit: [0.6, 0.4, 0.4], markerCap: CAB.rows[2] + 0.44, name: "ex_ansysCfd", projectKey: "ansysCfd", label: "Agent-based CFD",
    targetSize: 0.34, axis: "x", pos: [CAB.bays[1], CAB.rows[2], CAB.frontZ], rotY: 0.25,
  });
  loadAssembly(loader, scene, "models/real/education.glb", {
    // exploded parts layout, rotated 90deg CCW so the guitar lies horizontal
    fit: [0.62, 0.46, 0.4], markerCap: CAB.rows[2] + 0.44, name: "ex_education", projectKey: "education", label: "Guitar education kit",
    targetSize: 0.44, axis: "x", pos: [CAB.bays[2], CAB.rows[2], CAB.frontZ], rotZ: Math.PI / 2, rotY: 0.12,
    // photo-matched, lightened per feedback: medium navy body and a lighter
    // walnut neck/fingerboard; chrome panel/bridge via the steel bucket
    matTweak: { printed: { color: 0x3d5180, metalness: 0.05, roughness: 0.55 }, wood: { color: 0x7d6144, roughness: 0.6 } },
  });

  /* ---------- side dressing ---------- */
  // right wall: filled bookshelf; left wall: the electronics workbench
  // (bench + Bambu H2S mid-print + PSU + soldering station + drivers +
  // multimeter + task lamp)
  scene.add(buildSideCabinet());

  // five more projects in the right-wall cabinet (14 on display total).
  // `build` = procedural group; `file` = real CAD GLB via loadAssembly.
  const SIDE_EXHIBITS = [
    // real CAD (7-CP06-P00-SEAT.STL -> driverseat.glb): bent-sheet aluminum
    // seat. Native axes: x=width, z=back height, y=face normal. Stand it up
    // (z->up) with rotX, then face the room with rotY.
    { file: "driverseat",      key: "seat",      label: "Driver seat",       size: 0.34, axis: "y", bay: 0, row: 0, rotX: Math.PI / 2, rotY: -Math.PI / 2 + 0.4, rotZ: Math.PI / 2,
      matTweak: { steel: { color: 0xccd2da, metalness: 0.85, roughness: 0.35 } } }, // light brushed aluminum, reclined bucket facing the room
    { build: buildFtcBot,      key: "ftc",       label: "FTC robot",         size: 0.28, bay: 1, row: 0 },
    { file: "smelly",          key: "formlabs",  label: "Smelly",            size: 0.3,  axis: "y", bay: 0, row: 1, rotY: -Math.PI / 2 + 0.2,
      // photo-matched: the printed frame/gantry is white FDM plastic, not
      // aluminum; rods/lead screws stay bright steel
      matTweak: { printed: { color: 0xe7e5e0, metalness: 0.0, roughness: 0.5 }, steel: { color: 0xaeb4bc } } },
    // the launcher's long axis is raw +y — lay it down along the shelf
    // native X = floor-normal, Y = length, Z = width; rotate so the opaque
    // floor plate faces down and the length runs along the shelf (z)
    { file: "pool",            key: "pool",      label: "Pool Sniper",       size: 0.5, axis: "z", bay: 1, row: 1, rotZ: Math.PI / 2, rotY: -Math.PI / 2,
      // CAD-matched buckets (pool.glb re-exported with split buckets):
      // printed = the blue parts only (rack, pinion, cue cradle, brackets);
      // aero = dark-grey housings/plates/floor; steel = bright hardware;
      // the cue itself is a silver metallic rod
      matTweak: { printed: { color: 0x2a5fc4, metalness: 0.05, roughness: 0.5 },
        aero: { color: 0x84827e, metalness: 0.5, roughness: 0.5 },
        wood: { color: 0xaeb0b3, metalness: 0.8, roughness: 0.4 } } },
    { file: "telecaster",      key: "telecaster", label: "Telecaster",       size: 0.42, axis: "y", bay: 0, row: 2, rotY: -Math.PI / 2 + 0.2,
      matTweak: { printed: { color: 0xe9e6da, metalness: 0.0, roughness: 0.45 }, wood: { color: 0xa97c4c, roughness: 0.55 } } }, // warm white body, honey-maple neck (photos)
  ];
  SIDE_EXHIBITS.forEach((s) => {
    const opts = {
      name: "ex_" + s.key, projectKey: s.key, label: s.label,
      targetSize: s.size, axis: s.axis || "x",
      fit: [0.34, 0.4, 0.58], // x depth into cabinet, z along the wall
      markerCap: CAB2.rows[s.row] + (s.row === 0 ? 0.36 : 0.44),
      pos: [CAB2.frontX, CAB2.rows[s.row], CAB2.bays[s.bay]],
      rotY: s.rotY !== undefined ? s.rotY : -Math.PI / 2 + 0.25,
      rotZ: s.rotZ, rotX: s.rotX, matTweak: s.matTweak, extraParts: s.extraParts,
    };
    if (s.file) loadAssembly(loader, scene, `models/real/${s.file}.glb`, opts);
    else placeRoot(s.build(), scene, opts);
  });
  scene.add(buildWorkbench());

  // rolling tool chest beside the workbench
  const chest = buildToolChest();
  chest.name = "bk_chest";
  chest.position.set(-2.22, 0, 1.06); // clear of the workbench front edge (was 0.95 -> back clipped the bench)
  chest.rotation.y = Math.PI / 2;
  scene.add(chest);
  MODELS.chest = chest;

  // (removed: the race-car schematic blueprint panel above the main cabinet)

  /* ---------- baked lighting (Blender/Cycles pipeline, tools/bake/) ----------
     The architecture layer (bk_* tagged) is swapped for a pre-baked GLB with
     a 2nd-UV lightmap; cabinets/workbench/exhibits stay real-time and get a
     matching baked 360 environment probe. Two light states are baked — the
     desk lamp is the room's light switch. Set USE_BAKED=false to fall back
     to the fully procedural room. */
  let lightsOn = false; // night mode is the default — the lamp switches day on
  let bakedMats = [];
  const LM = { on2k: null, off2k: null, on4k: null, off4k: null, probeOn: null, probeOff: null };
  // night-mode practicals: warm pool over the workbench (its lamp + printer
  // read as the only bench light) and the desk lamp's own LEDs glow warm
  const benchGlow = new THREE.PointLight(0xe8ecf2, 0, 1.7, 2);
  benchGlow.position.set(-2.3, 1.25, -1.1);
  scene.add(benchGlow);
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
  resumeSpot.target.position.set(0.02, 0.775, 0.16);
  if (!LOW_TIER) {
    // shadows sell the source: the paper, tray and pen throw away from the lamp
    resumeSpot.castShadow = true;
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
  const blueLines = []; // rug LED inlay materials (baked GLB), glow at night
  const lampLeds = [];
  if (MODELS.deskLamp) MODELS.deskLamp.traverse((o) => {
    if (o.isMesh && o.material && o.material.emissive && o.material.emissiveIntensity > 0 && o.material.emissiveIntensity < 0.3) {
      lampLeds.push(o.material);
    }
  });
  function flipRows(tex) {
    // .hdr loads bottom-up vs glTF's top-down UV convention — flip in place
    const { data, width, height } = tex.image;
    const stride = width * 4;
    const tmp = new data.constructor(stride);
    for (let y = 0; y < height >> 1; y++) {
      const a = y * stride, b = (height - 1 - y) * stride;
      tmp.set(data.subarray(a, a + stride));
      data.copyWithin(a, b, b + stride);
      data.set(tmp, b);
    }
    tex.needsUpdate = true;
    return tex;
  }
  function prepLM(tex) {
    flipRows(tex);
    tex.channel = 1;
    tex.colorSpace = THREE.LinearSRGBColorSpace;
    return tex;
  }
  function applyLightState(animate) {
    // generation counter: a newer call (toggle or instant set) invalidates
    // any still-running step closure — without this, two quick lamp clicks
    // let the FIRST fade finish last and commit the wrong grade
    const gen = ++lightGen;
    const lm = lightsOn ? (LM.on4k || LM.on2k) : (LM.off4k || LM.off2k);
    const lmCurrent = bakedMats.length ? bakedMats[0].lightMap : null;
    const fadeLm = !!(lm && lmCurrent && lm !== lmCurrent && animate && !prefersReducedMotion);
    if (lm && !fadeLm) {
      bakedMats.forEach((m) => { m.lightMap = lm; });
      if (!lmB.value) lmB.value = lm; // keep the B sampler bound
      lmMix.value = 0;
    } else if (fadeLm) {
      lmB.value = lm;
      lmMix.value = 0;
    }
    const probe = lightsOn ? (LM.probeOn || LM.probeOff) : (LM.probeOff || LM.probeOn);
    if (probe) scene.environment = probe;
    // real-time lights serve the exhibits; dim them with the room
    const want = lightsOn
      ? { key: 1.15, hemi: 0.75, fill: 0.25, env: 0.5, bench: 0, resume: 0, moon: 0, pendant: 2.6 } // day grade: strips + bake carry the room
      // night: the desk lamp (resume) is the dominant practical, the pendant
      // recedes to a whisper so the lamp's pool owns the desk
      : { key: 0.22, hemi: 0.16, fill: 0.05, env: 0.35, bench: 0.95, resume: 2.8, moon: MOON_NIGHT, pendant: 0.3 };
    if (bootTakeover) return; // the boot choreography owns the levels; it lands on these values
    lampLeds.forEach((m) => { m.emissiveIntensity = lightsOn ? 0.05 : 2.4; });
    blueLines.forEach((m) => {
      m.emissive = m.emissive || new THREE.Color(0x2b4d80);
      m.emissive.setHex(0x3f8cff);
      m.emissiveIntensity = lightsOn ? 0.12 : 1.1; // LED inlay glows at night
    });
    const from = { key: key.intensity, hemi: hemi.intensity, fill: fill.intensity, env: scene.environmentIntensity, bench: benchGlow.intensity, resume: resumeSpot.intensity, moon: moonSpot.intensity, pendant: MODELS.pendantLight.intensity };
    if (prefersReducedMotion || !animate) {
      key.intensity = want.key; hemi.intensity = want.hemi; fill.intensity = want.fill;
      scene.environmentIntensity = want.env; benchGlow.intensity = want.bench;
      resumeSpot.intensity = want.resume;
      moonSpot.intensity = want.moon;
      MODELS.pendantLight.intensity = want.pendant;
      return;
    }
    const t0 = performance.now();
    const DUR = fadeLm ? 800 : 450; // lightmap crossfade reads best a bit slower
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
      if (fadeLm) lmMix.value = e;
      if (k < 1) requestAnimationFrame(step);
      else if (fadeLm) {
        bakedMats.forEach((m) => { m.lightMap = lm; });
        lmMix.value = 0;
      }
    })(t0);
  }
  function toggleRoomLights() {
    lightsOn = !lightsOn;
    sndClick();
    cancelBoot(); // hand over cleanly if the boot choreography is mid-flight
    applyLightState(true);
  }
  if (USE_BAKED) {
    // hide the procedural originals
    scene.children.forEach((o) => {
      let tagged = false;
      o.traverse((m) => { if ((m.name || "").indexOf("bk_") === 0) tagged = true; });
      if (tagged) o.visible = false;
    });
    applyLightState(false); // real-time lights to night values immediately
    const hdrl = new HDRLoader(manager);
    hdrl.load("models/baked/lightmap-off-2k.hdr", (t) => { LM.off2k = prepLM(t); applyLightState(false); });
    hdrl.load("models/baked/probe-off.hdr", (t) => {
      t.mapping = THREE.EquirectangularReflectionMapping;
      LM.probeOff = t;
      scene.environment = t;
      applyLightState(false);
    });
    // baked surfaces keep their imported PBR materials (roughness/metalness
    // survive the Blender round trip) so they still show speculars and probe
    // reflections — but live on light-layer 1 so the real-time lights can't
    // double-light what the lightmap already carries
    camera.layers.enable(1);
    loader.load("models/baked/room-baked.glb", (gltf) => {
      const pt = TEX.loadPBR("painted_plaster_wall");
      const fMap = pt.map.clone(); fMap.repeat.set(8, 8); fMap.needsUpdate = true;
      const fNor = pt.normalMap.clone(); fNor.repeat.set(8, 8); fNor.needsUpdate = true;
      const fRgh = pt.roughnessMap.clone(); fRgh.repeat.set(8, 8); fRgh.needsUpdate = true;
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const m = o.material;
        m.lightMapIntensity = 0.6;
        m.envMapIntensity = 0.5;
        // Blender rewrites baseColor on texture-stripped materials, so match
        // the two big textured surfaces by GEOMETRY instead: the floor is the
        // 16x16 plane, the walls are the only >3m-tall slabs
        o.geometry.computeBoundingBox();
        const s = o.geometry.boundingBox.getSize(new THREE.Vector3());
        if (s.x > 10 && s.z > 10 && s.y < 0.5) {
          m.map = fMap; m.normalMap = fNor; m.roughnessMap = fRgh;
          m.color.setHex(COL.floorTint);
        } else if (s.y > 3 && Math.max(s.x, s.z) > 4) {
          m.map = pt.map; m.normalMap = pt.normalMap; m.roughnessMap = pt.roughnessMap;
          m.color.setHex(COL.wallTint);
        }
        // the rug's blue LED inlay lines glow for real at night
        if (m.color && m.color.getHexString() === "2b4d80") blueLines.push(m);
        m.onBeforeCompile = (sh) => {
          sh.uniforms.lightMapB = lmB;
          sh.uniforms.lmMix = lmMix;
          sh.fragmentShader = sh.fragmentShader
            .replace("#include <common>", "#include <common>\nuniform sampler2D lightMapB;\nuniform float lmMix;")
            .replace(
              "vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );",
              "vec4 lightMapTexel = mix( texture2D( lightMap, vLightMapUv ), texture2D( lightMapB, vLightMapUv ), lmMix );"
            );
        };
        m.needsUpdate = true;
        o.layers.set(1);
        o.castShadow = false;
        o.receiveShadow = false;
        bakedMats.push(m);
      });
      scene.add(gltf.scene);
      applyLightState(false);
    });
    // idle upgrades: 4K lightmap, then the lights-off set
    const later = new HDRLoader(); // NOT on the manager — don't block the loader UI
    setTimeout(() => {
      later.load("models/baked/lightmap-on-2k.hdr", (t) => { LM.on2k = prepLM(t); });
      later.load("models/baked/probe-on.hdr", (t) => { t.mapping = THREE.EquirectangularReflectionMapping; LM.probeOn = t; });
      if (!LOW_TIER) { // phones stay on 2K — don't pull 15MB+ maps over mobile data
        later.load("models/baked/lightmap-off-4k.hdr", (t) => { LM.off4k = prepLM(t); if (!lightsOn) applyLightState(false); });
        later.load("models/baked/lightmap-on-4k.hdr", (t) => { LM.on4k = prepLM(t); if (lightsOn) applyLightState(false); });
      }
    }, 4000);
  }

  // real ergonomic mesh task chair (CC BY 4.0 — see ATTRIBUTIONS.txt);
  // replaces the old procedural buildErgoChair() stand-in
  loadModel(loader, scene, "models/ergonomic_mesh_office_chair/ergonomic_mesh_office_chair.glb", {
    // the GLB's intrinsic front is +x, so 1.34 rad turns it to face the desk
    name: "chair", targetSize: 0.95, axis: "y", pos: [-0.25, 0, 1.05], rotY: 1.34,
  });

  /* ---------- resize ---------- */
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, LOW_TIER ? 1.5 : 2));
    renderer.setSize(w, h);
    composer.setSize(w, h);
    if (gtao) gtao.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  /* ---------- camera flight system ---------- */
  let flight = null;
  function startFlight(toPos, toLook, ms, onDone) {
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
  function startIntro() {
    camera.position.copy(FLY_POS);
    controls.target.set(0, 0.75, -0.1);
    let seen = false;
    try { seen = localStorage.getItem("kw_intro_seen") === "1"; } catch (e) {}
    if (seen) {
      startFlight(REST_POS, REST_TARGET, 1500, showDragHint);
      return;
    }
    try { localStorage.setItem("kw_intro_seen", "1"); } catch (e) {}
    // guided sweep: right cabinet -> main cabinet -> resting pose
    startFlight(new THREE.Vector3(0.7, 1.5, 1.9), new THREE.Vector3(2.3, 1.2, CAB2.z), 1700, () => {
      startFlight(new THREE.Vector3(0.6, 1.45, 1.6), new THREE.Vector3(0, 1.2, -1.1), 1900, () => {
        startFlight(REST_POS, REST_TARGET, 1500, showDragHint);
      });
    });
  }

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  // named + exposed (see window.__exp.pump) so QA can hand-step frames with
  // synthetic timestamps in a backgrounded tab, where rAF never fires
  const tick = (t, forced) => {
    if (!running && !forced) return;

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
      cp.x = Math.max(-2.35, Math.min(2.35, cp.x));
      cp.z = Math.max(-1.25, Math.min(3.35, cp.z));
      cp.y = Math.max(0.4, Math.min(3.15, cp.y));
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
        if (face) {
          const warmup = pm.delay ? Math.min(1, (t - pm.t0) / pm.delay) : 1;
          face.material.emissiveIntensity = paperGlowTarget() * warmup;
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
        // hold the glow CONSTANT through the return travel (no fade sweep on
        // the moving sheet); it drops to the desk baseline only at landing,
        // where the lamp pool already lights the paper so the cut is masked
        if (face) face.material.emissiveIntensity = pm.fromGlow;
        if (k >= 1) {
          // land EXACTLY on the remembered desk pose
          pv.position.copy(pm.toPos);
          pv.quaternion.copy(pm.toQuat);
          if (face) face.material.emissiveIntensity = 0;
          paperMotion = null;
          paperHold = null;
          activePaperPivot = null;
          paperReturning = false;
        }
      }
    }

    // Bambu printer: print head sweeps across the bed while "printing"
    if (!prefersReducedMotion && MODELS.printerHead) {
      MODELS.printerHead.position.x = Math.sin(t * 0.0032) * 0.13;
    }

    // focused exhibit slowly turns on its pedestal; DoF opens up
    // (CFD is a flat monitor — turntabling it reads badly, so leave it still)
    if (panelOpen && focusedPivot && !prefersReducedMotion && focusedPivot.userData.hotspot.key !== "ansysCfd") {
      focusedPivot.rotation.y += 0.0035;
    }
    // museum follow-spot eases onto the focused exhibit
    const spotWant = panelOpen && focusedPivot ? 1.6 : 0;
    focusSpot.intensity += (spotWant - focusSpot.intensity) * 0.06;
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
      u.aperture.value += (want - u.aperture.value) * 0.08;
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
        h.scale.setScalar(h.scale.x + (target - h.scale.x) * 0.16);
      }
      const m = h.userData.hotspot.marker;
      if (!m) continue;
      m.visible = !busy;
      if (!busy && !prefersReducedMotion) {
        const ph = h.userData.hotspot.phase;
        m.position.y = h.userData.hotspot.markerY + Math.sin(t * 0.0024 + ph) * 0.016;
        // higher floor than the old additive marker: normal blending needs
        // more opacity to stay legible, especially on white exhibits
        m.material.opacity = 0.62 + 0.26 * (0.5 + 0.5 * Math.sin(t * 0.003 + ph));
        const s = h === hovered ? 0.06 : 0.042;
        m.scale.setScalar(s);
      }
    }

    // sub-2% 1/f flicker on the warm practicals so the still room doesn't
    // read as a screenshot (applied around the render, then unwound)
    let flk = 0;
    if (!prefersReducedMotion) {
      flk = 1 + 0.013 * Math.sin(t * 0.00071) + 0.009 * Math.sin(t * 0.00173) + 0.006 * Math.sin(t * 0.00347);
      resumeSpot.intensity *= flk;
      benchGlow.intensity *= flk;
      lampLeds.forEach((m) => { m.emissiveIntensity *= flk; });
    }

    composer.render();

    if (flk) {
      resumeSpot.intensity /= flk;
      benchGlow.intensity /= flk;
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
  }
  // dismiss the moment the user actually drags to orbit the scene
  renderer.domElement.addEventListener("pointermove", (ev) => {
    if (dragHintDone || !downXY || !ev.buttons || panelOpen || flight) return;
    if (Math.hypot(ev.clientX - downXY[0], ev.clientY - downXY[1]) > 8) dismissDragHint();
  }, { passive: true });

  function setHover(root) {
    if (hovered === root) return;
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
    const hits = raycaster.intersectObjects(HOTSPOTS, true);
    if (!hits.length) return null;
    let o = hits[0].object;
    while (o && !o.userData.hotspot) o = o.parent;
    return o || null;
  }
  renderer.domElement.addEventListener("pointermove", (ev) => {
    updatePointer(ev);
    if (panelOpen || paperReturning || flight) return;
    setHover(pickHotspot()); // the lamp is a pseudo-hotspot -> label + cursor for free
  });
  // the hover card would otherwise stay stuck when the pointer exits the
  // canvas (topbar, panel, window edge) without another canvas pointermove
  renderer.domElement.addEventListener("pointerleave", () => setHover(null));
  renderer.domElement.addEventListener("pointercancel", () => setHover(null));
  window.addEventListener("blur", () => setHover(null));
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
    const hs = root.userData.hotspot;
    const html =
      hs.action === "resume"
        ? resumeHTML(RESUME)
        : hs.key && window.projectData && window.projectData[hs.key]
          ? projectHTML(window.projectData[hs.key])
          : null;
    if (!html) return; // hover-only hotspots (skill wall) keep their card
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
      Math.min(Math.min(window.innerWidth * 0.94, 900) / window.innerWidth, 0.55);
    const lookOff = panelFrac * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
    const focusLook = c.clone().addScaledVector(right, lookOff);

    panelOpen = true;
    focusedPivot = hs.key ? root : null;
    currentProjectKey = hs.key || null;
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
        setTimeout(() => openPanel(html), 680);
      }
    }
  }

  // fixed tour order for prev/next navigation (matches cabinet layout)
  const PROJECT_ORDER = ["carbonSeat", "aura", "scanner", "javelin", "steering", "brakeSim",
    "lineFollower", "ansysCfd", "education", "seat", "ftc", "formlabs", "pool", "telecaster"];
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
        panelOpen = false;
        if (focusedPivot) focusedPivot.rotation.y = 0;
        recenterPivot(focusedPivot);
        focusedPivot = null;
        isStepTransition = true;
        focusHotspot(pivot);
        return;
      }
    }
  }
  function openPanel(html) {
    if (!panelEl) return;
    panelOpen = true;
    dismissClickHint();
    const applyPanelContent = () => {
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
      setHover(null);
      // keyboard users land on the close button, not lost in the canvas
      const closeBtn = panelEl.querySelector(".exp-panel__close");
      if (closeBtn) closeBtn.focus();
    };
    if (isStepTransition) {
      // Prev/Next: fade the outgoing content out, swap, then fade in —
      // only this path; the first-open slide-in stays untouched below
      isStepTransition = false;
      panelEl.style.transition = "opacity 150ms";
      panelEl.style.opacity = "0";
      setTimeout(() => {
        applyPanelContent();
        panelEl.style.transition = "opacity 200ms";
        panelEl.style.opacity = "1";
        setTimeout(() => {
          panelEl.style.opacity = "";
          panelEl.style.transition = "";
        }, 200);
      }, 150);
      return;
    }
    applyPanelContent();
  }
  function preparePaperContent(html, pivot) {
    if (!paperEl) return;
    const rootClass = document.documentElement.classList;
    rootClass.remove("exp-paper-active", "exp-paper-open");

    paperEl.innerHTML = html;
    paperEl.scrollTop = 0;
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

  /* ---- DOM-parity sheet snapshot ----
     The desk sheet's printed texture is a dense Arial mini-layout that looks
     right as a room prop, but it is NOT what the DOM résumé looks like — a
     cross-fade between the two visibly switches typography and font size
     (Kefan's second ghosting report). For the pickup flight the face instead
     wears a snapshot rasterized FROM the laid-out DOM sheet itself: every
     rendered text line is drawn at its measured client rect with its computed
     font (the Google webfonts are document-loaded, so canvas 2D can use
     them), making the held 3D sheet and the DOM that fades in over it
     glyph-identical. Geometry is MEASURED from the live layout, never
     re-implemented, so future resumeHTML/CSS edits stay in sync for free. */
  let sheetSnap = null; // { width, tex } — rebuilt when the sheet width changes
  function buildSheetSnapshot() {
    if (!paperEl) return null;
    const rect = paperEl.getBoundingClientRect();
    const W = Math.round(rect.width);
    if (!W || !rect.height) return null;
    if (sheetSnap && sheetSnap.width === W) return sheetSnap.tex;
    const texW = 1024;
    const texH = Math.round(texW * (0.312 / 0.234)); // exact printed-face aspect
    const scale = texW / rect.width;
    const c = document.createElement("canvas");
    c.width = texW;
    c.height = texH;
    const ctx = c.getContext("2d");
    // same surface as .exp-sheet: the gradient spans the FULL sheet height;
    // the texture just crops at the face's 3:4 extent — exactly the region
    // of the DOM sheet the physical paper covers (width + top aligned)
    const bg = ctx.createLinearGradient(0, 0, 0, rect.height * scale);
    bg.addColorStop(0, "#fafbfd");
    bg.addColorStop(1, "#eef0f4");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, texW, texH);
    const X = (v) => (v - rect.left) * scale;
    const Y = (v) => (v - rect.top) * scale;

    // painted boxes: the blue rule + the list bullets (::before pseudos)
    paperEl.querySelectorAll(".exp-sheet__rule").forEach((el) => {
      const r = el.getBoundingClientRect();
      ctx.fillStyle = getComputedStyle(el).backgroundColor;
      ctx.fillRect(X(r.left), Y(r.top), r.width * scale, Math.max(1, r.height * scale));
    });
    paperEl.querySelectorAll(".exp-sheet__list li").forEach((el) => {
      const ps = getComputedStyle(el, "::before");
      const w = parseFloat(ps.width), h = parseFloat(ps.height);
      if (!w || !h || ps.backgroundColor === "rgba(0, 0, 0, 0)") return;
      const r = el.getBoundingClientRect();
      ctx.fillStyle = ps.backgroundColor;
      ctx.fillRect(
        X(r.left + (parseFloat(ps.left) || 0)),
        Y(r.top + (parseFloat(ps.top) || 0)),
        w * scale, h * scale
      );
    });

    // text: split every text node into its rendered line fragments (grouped
    // by each character's line-box top) and draw each at its measured rect
    const range = document.createRange();
    const walker = document.createTreeWalker(paperEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.data.trim() && n.parentElement && !n.parentElement.closest(".exp-sheet__close")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    let node;
    while ((node = walker.nextNode())) {
      const cs = getComputedStyle(node.parentElement);
      const fontPx = parseFloat(cs.fontSize) * scale;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${fontPx}px ${cs.fontFamily}`;
      const lsRaw = parseFloat(cs.letterSpacing);
      const lsPx = Number.isFinite(lsRaw) ? lsRaw * scale : 0;
      let manualLS = false;
      if ("letterSpacing" in ctx) {
        ctx.letterSpacing = `${lsPx}px`;
      } else {
        // Safari <16.4 / Firefox <116: no canvas tracking — draw those runs
        // char-by-char below so the mono section labels keep their spacing
        manualLS = lsPx !== 0;
      }
      ctx.fillStyle = cs.color;
      const met = ctx.measureText("Mg");
      // legacy engines without fontBoundingBox*: approximate from the actual
      // ink extents of "Mg" before falling back to a generic ratio
      const asc = met.fontBoundingBoxAscent ||
        (met.actualBoundingBoxAscent && met.actualBoundingBoxAscent * 1.06) || fontPx * 0.8;
      const desc = met.fontBoundingBoxDescent ||
        (met.actualBoundingBoxDescent && met.actualBoundingBoxDescent * 1.1) || fontPx * 0.22;
      const underline = (cs.textDecorationLine || "").includes("underline");
      const upper = cs.textTransform === "uppercase";
      const s = node.data;
      const drawFrag = (a, b) => {
        while (a < b && /\s/.test(s[a])) a++;   // collapsed at wrap points —
        while (b > a && /\s/.test(s[b - 1])) b--; // must not shift the glyphs
        if (a >= b) return;
        range.setStart(node, a);
        range.setEnd(node, b);
        const fr = range.getBoundingClientRect();
        if (!fr.width) return;
        // center the glyph box inside the measured line box, like CSS leading
        const baseline = Y(fr.top) + (fr.height * scale - (asc + desc)) / 2 + asc;
        const text = upper ? s.slice(a, b).toUpperCase() : s.slice(a, b);
        if (manualLS) {
          let x = X(fr.left);
          for (const ch of text) {
            ctx.fillText(ch, x, baseline);
            x += ctx.measureText(ch).width + lsPx;
          }
        } else {
          ctx.fillText(text, X(fr.left), baseline);
        }
        if (underline) {
          const off = parseFloat(cs.textUnderlineOffset) || 0;
          ctx.fillRect(X(fr.left), baseline + Math.max(1.5, off * scale), fr.width * scale, Math.max(1, fontPx / 15));
        }
      };
      let runStart = -1, runTop = 0;
      for (let i = 0; i < s.length; i++) {
        range.setStart(node, i);
        range.setEnd(node, i + 1);
        const rr = range.getClientRects()[0];
        if (!rr || !rr.width) continue; // collapsed whitespace
        if (runStart < 0) { runStart = i; runTop = rr.top; }
        else if (Math.abs(rr.top - runTop) > 1.5) { // wrapped to a new line
          drawFrag(runStart, i);
          runStart = i;
          runTop = rr.top;
        }
      }
      if (runStart >= 0) drawFrag(runStart, s.length);
    }

    if (sheetSnap && sheetSnap.tex) sheetSnap.tex.dispose();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = MAXA;
    sheetSnap = { width: W, tex };
    return tex;
  }

  // The snapshot is the sheet's ONE permanent texture — desk, flight and
  // held all show the exact same document, so there is no content switch at
  // any point of the interaction (Kefan's request: the résumé IS the
  // model's skin). buildResumePaper()'s Arial canvas only bridges the few
  // hundred ms until the webfonts are ready and this first snapshot lands.
  function applySheetTexture() {
    const pivot = HOTSPOTS.find((h) => h.userData.hotspot.action === "resume");
    const root = pivot && pivot.userData.hotspot.pickupObject;
    const face = root && root.userData.resumeFace;
    if (!face) return;
    const snap = buildSheetSnapshot();
    if (snap && face.material.map !== snap) {
      face.material.map = snap;
      face.material.emissiveMap = snap;
      renderer.initTexture(snap); // upload now, never during an interaction
    }
  }
  // seed the hidden DOM sheet at startup so the snapshot can be rasterized
  // before the visitor's first interaction (visibility:hidden still lays out)
  if (paperEl && !paperEl.innerHTML.trim()) paperEl.innerHTML = resumeHTML(RESUME);
  if (document.fonts && document.fonts.ready) {
    // (re)build once the real webfonts are in — a snapshot taken against
    // fallback-font layout must not survive the reflow
    document.fonts.ready.then(() => {
      if (sheetSnap) sheetSnap.width = -1;
      applySheetTexture();
    });
  } else {
    applySheetTexture();
  }

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
    const ws = face.getWorldScale(PM_V1).divideScalar(hoverK);
    const worldW = 0.234 * Math.abs(ws.x);
    const worldH = 0.312 * Math.abs(ws.y);
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
    const finishSwap = () => {
      if (gen !== paperAnimGen || !panelOpen) return;
      // fully covered by the opaque DOM sheet now — stop rendering it
      if (activePaperPivot) activePaperPivot.visible = false;
      const closeBtn = paperEl.querySelector(".exp-sheet__close");
      if (closeBtn) closeBtn.focus();
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
    // camera-independent: derived from the DOM rect + lens only, so it can
    // be computed at click time and the loop starts the lift after `delay`
    paperHold = computePaperHold(pivot);
    if (!paperHold) { showPaperDom(gen); return; } // degraded fallback
    // the sheet permanently wears the DOM-parity snapshot (applySheetTexture)
    // — this only refreshes it if the viewport width changed since it was
    // built (width-cached: O(1) no-op on the common path)
    applySheetTexture();
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
  function closePanel() {
    if (!panelOpen) return;
    const rootClass = document.documentElement.classList;
    const closingPaperPivot = activePaperPivot;
    const closeGen = ++paperAnimGen;
    panelOpen = false;
    recenterPivot(focusedPivot);
    focusedPivot = null;
    sndWhoosh(0.4);
    rootClass.remove("exp-panel-open");

    const returnToRoom = () => {
      if (pendingDragHintOnClose) { pendingDragHintOnClose = false; showDragHint(); }
      renderer.domElement.focus(); // return focus to the stage once the overlay is gone
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
        if (face) face.material.emissiveIntensity = 0;
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
        // a resize while reading reflows the DOM sheet — refresh the parity
        // snapshot too (width-cached: free when nothing changed)
        applySheetTexture();
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
  // gallery lightbox: click a panel shot to enlarge; browse with arrows
  const lightboxEl = document.getElementById("exp-lightbox");
  let lbShots = [], lbIdx = 0;
  function closeLightbox() {
    document.documentElement.classList.remove("exp-lightbox-open");
  }
  function renderLightbox() {
    const s = lbShots[lbIdx];
    if (!s) return;
    lightboxEl.innerHTML =
      `<button type="button" class="exp-lightbox__btn exp-lightbox__close" data-lb="close" aria-label="Close">&times;</button>` +
      (lbShots.length > 1
        ? `<button type="button" class="exp-lightbox__btn exp-lightbox__prev" data-lb="-1" aria-label="Previous image">&lsaquo;</button>` +
          `<button type="button" class="exp-lightbox__btn exp-lightbox__next" data-lb="1" aria-label="Next image">&rsaquo;</button>`
        : "") +
      `<img src="${s.src}" alt="" /><p>${s.cap}${lbShots.length > 1 ? `<span class="exp-lightbox__count">${lbIdx + 1} / ${lbShots.length}</span>` : ""}</p>`;
  }
  function stepLightbox(d) {
    lbIdx = (lbIdx + d + lbShots.length) % lbShots.length;
    renderLightbox();
    sndTick();
  }
  if (panelEl && lightboxEl) {
    panelEl.addEventListener("click", (ev) => {
      const img = ev.target.closest(".exp-panel__shot img");
      if (!img) return;
      const all = Array.from(panelEl.querySelectorAll(".exp-panel__shot img"));
      lbShots = all.map((im) => ({ src: im.src, cap: im.closest("figure")?.querySelector("figcaption")?.textContent || "" }));
      lbIdx = Math.max(0, all.indexOf(img));
      renderLightbox();
      document.documentElement.classList.add("exp-lightbox-open");
      sndClick();
    });
    lightboxEl.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-lb]");
      if (!b) return closeLightbox();
      if (b.dataset.lb === "close") return closeLightbox();
      stepLightbox(+b.dataset.lb);
    });
    window.addEventListener("keydown", (e) => {
      if (!document.documentElement.classList.contains("exp-lightbox-open")) return;
      if (e.key === "ArrowLeft") stepLightbox(-1);
      if (e.key === "ArrowRight") stepLightbox(1);
    });
  }

  if (backdropEl) backdropEl.addEventListener("click", closePanel);
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.documentElement.classList.contains("exp-lightbox-open")) return closeLightbox();
    if (panelOpen) closePanel();
  });

  /* ---------- keyboard navigation layer (additive; mirrors the pointer flow) ----------
     Cycle order: the 14 project pivots (PROJECT_ORDER), then résumé, then the
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
    setHover(order[kbIndex]);
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

  window.__exp = { THREE, scene, camera, renderer, controls, composer, bloom, key, hemi, models: MODELS, hotspots: HOTSPOTS, openPanel, showDragHint, runBootIntro, pump: (t) => tick(t, true) };
  console.info(`[experience] engineering office ready — ${HOTSPOTS.length} hotspots`);
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
  if (opts.rotX) root.rotation.x = opts.rotX;
  if (opts.rotY) root.rotation.y = opts.rotY;
  if (opts.rotZ) root.rotation.z = opts.rotZ;
  root.updateWorldMatrix(true, true);

  let box = new THREE.Box3().setFromObject(root);
  if (opts.targetSize) {
    const size = box.getSize(new THREE.Vector3());
    const dim = opts.axis === "x" ? size.x : opts.axis === "z" ? size.z : size.y;
    if (dim > 0) {
      root.scale.multiplyScalar(opts.targetSize / dim);
      root.updateWorldMatrix(true, true);
      box = new THREE.Box3().setFromObject(root);
    }
  }
  // optional shelf-bay budget: uniformly shrink anything that exceeds it
  if (opts.fit) {
    const size = box.getSize(new THREE.Vector3());
    const k = Math.min(1, opts.fit[0] / size.x, opts.fit[1] / size.y, opts.fit[2] / size.z);
    if (k < 1) {
      root.scale.multiplyScalar(k);
      root.updateWorldMatrix(true, true);
      box = new THREE.Box3().setFromObject(root);
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
    const bb = new THREE.Box3().setFromObject(root);
    const center = bb.getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(center);
    scene.add(pivot);
    pivot.add(root);
    root.position.sub(center);

    // invisible hitbox so thin/flat exhibits are clickable anywhere in
    // their volume (raycaster tests geometry, not material visibility)
    const hbSize = bb.getSize(new THREE.Vector3());
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
      // the resume sheet is flat on the desk — a centered marker floats
      // directly over the printed text, so push it to the paper's
      // top-right corner and keep it low, just above the desk surface
      markerX = 0.12;
      markerZ = 0.10;
      markerY = 0.05;
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
  if (onPlaced) onPlaced(root, new THREE.Box3().setFromObject(root));
}

function loadModel(loader, scene, url, opts, onPlaced) {
  loader.load(
    url,
    (gltf) => placeRoot(gltf.scene, scene, opts, onPlaced),
    undefined,
    (err) => console.warn(`[experience] failed to load ${url}`, err)
  );
}

// merged SolidWorks assembly: assign engineering materials by bucket name
function loadAssembly(loader, scene, url, opts, onPlaced) {
  loader.load(
    url,
    (gltf) => {
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const name = (o.name || "").toLowerCase();
        let matKey = "printed";
        for (const k of Object.keys(ASSEMBLY_MATS)) {
          if (name.includes(`mat_${k}`)) { matKey = k; break; }
        }
        o.material = ASSEMBLY_MATS[matKey]();
        // per-project material overrides (e.g. Javelin's dark PPA-CF shell)
        if (opts.matTweak && opts.matTweak[matKey]) o.material.setValues(opts.matTweak[matKey]);
        // STL-derived meshes have no UVs; box-project some so the carbon
        // weave map can tile across the surface
        if (matKey === "carbon") boxProjectUVs(o.geometry, 0.08); // geometry is in mm; ~12mm weave tile
        o.castShadow = true;
        o.receiveShadow = true;
      });
      // procedural add-ons in the model's native (mm) space, so they scale
      // and orient with the assembly (e.g. the Telecaster's red pickguard,
      // which isn't a separate solid in the exported STL)
      if (opts.extraParts) opts.extraParts(gltf.scene);
      placeRoot(gltf.scene, scene, opts, onPlaced);
    },
    undefined,
    (err) => console.warn(`[experience] failed to load ${url}`, err)
  );
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
  const fMap = ft.map.clone(); fMap.repeat.set(8, 8); fMap.needsUpdate = true;
  const fNor = ft.normalMap.clone(); fNor.repeat.set(8, 8); fNor.needsUpdate = true;
  const fRgh = ft.roughnessMap.clone(); fRgh.repeat.set(8, 8); fRgh.needsUpdate = true;
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

  // modern black pendant over the desk (neutral light)
  const pendant = new THREE.Group();
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, WALL_H - 2.42, 8),
    new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.7 })
  );
  cord.position.y = 2.42 + (WALL_H - 2.42) / 2;
  pendant.add(cord);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.17, 0.15, 28, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide })
  );
  shade.position.y = 2.42;
  shade.castShadow = true;
  pendant.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0xe8eef8, emissiveIntensity: 1.0 })
  );
  bulb.position.y = 2.37;
  pendant.add(bulb);
  const pendantLight = new THREE.PointLight(0xe8eef8, 2.6, 4.2, 2); // carries the desk now the lamps emit no light
  pendantLight.position.y = 2.32;
  pendant.add(pendantLight);
  MODELS.pendantLight = pendantLight; // exposed so applyLightState (initScene scope) can drive it
  pendant.position.set(0.15, 0, 0.35);
  scene.add(pendant);
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
  CAB.rows.forEach((y) => {
    // rounded edges: a sharp 90° glass corner breaks into dashed specular
    // fireflies under the follow-spot at fly-in distance
    const board = new THREE.Mesh(new RoundedBoxGeometry(W - 0.09, 0.014, D - 0.08, 2, 0.004), glassMat);
    board.position.set(0, y - 0.007, z);
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
    new THREE.MeshStandardMaterial({ color: 0xe8ebf0, emissive: 0xdfe6f0, emissiveIntensity: 0.05 })
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
  const glow = ctx.createRadialGradient(cx, cx, 3, cx, cx, cx);
  glow.addColorStop(0, "rgba(63, 140, 255, 0.60)");
  glow.addColorStop(0.4, "rgba(63, 140, 255, 0.24)");
  glow.addColorStop(1, "rgba(63, 140, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  ctx.save();
  ctx.translate(cx, cx);
  ctx.rotate(Math.PI / 4);
  // dark contour first — gives the ring an edge on WHITE backgrounds
  ctx.strokeStyle = "rgba(6, 20, 44, 0.55)";
  ctx.lineWidth = 8.5;
  ctx.strokeRect(-19, -19, 38, 38);
  // saturated brand-blue ring
  ctx.strokeStyle = "#3f8cff";
  ctx.lineWidth = 5;
  ctx.strokeRect(-19, -19, 38, 38);
  // white core with a thin dark edge (reads on white, glows on dark)
  ctx.fillStyle = "rgba(8, 22, 46, 0.6)";
  ctx.fillRect(-10, -10, 20, 20);
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
let _carbonTex = null;
function makeCarbonTwillTexture() {
  if (_carbonTex) return _carbonTex;
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const cell = s / 8;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const horizontal = ((x + y) >> 1) % 2 === 0;
      const g = ctx.createLinearGradient(
        x * cell, y * cell,
        horizontal ? x * cell : (x + 1) * cell,
        horizontal ? (y + 1) * cell : y * cell
      );
      g.addColorStop(0, "#17181b");
      g.addColorStop(0.5, horizontal ? "#33363c" : "#26282d");
      g.addColorStop(1, "#101114");
      ctx.fillStyle = g;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = MAXA;
  _carbonTex = tex;
  return tex;
}

/* STL meshes carry no UVs — box-project by dominant face normal so a
   tiling texture can wrap the surface (scale = tiles per unit) */
function boxProjectUVs(geo, scale) {
  const pos = geo.attributes.position;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (nx >= ny && nx >= nz) { u = pos.getY(i); v = pos.getZ(i); }
    else if (ny >= nx && ny >= nz) { u = pos.getX(i); v = pos.getZ(i); }
    else { u = pos.getX(i); v = pos.getY(i); }
    uv[i * 2] = u * scale;
    uv[i * 2 + 1] = v * scale;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

function buildWorkbench() {
  // electronics workbench, left wall: pegboard with real MechE tools,
  // H2S printing on the left, instruments clustered right, and the middle
  // of the bench deliberately left CLEAR for a future project
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.45, metalness: 0.8 });
  const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.2 });
  const toolSteel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.4 });
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

  // pegboard with dot-grid
  const pb = document.createElement("canvas");
  pb.width = 256; pb.height = 128;
  const pctx = pb.getContext("2d");
  pctx.fillStyle = "#4a4d52"; pctx.fillRect(0, 0, 256, 128);
  pctx.fillStyle = "#26282c";
  for (let py = 8; py < 128; py += 16)
    for (let px = 8; px < 256; px += 16) { pctx.beginPath(); pctx.arc(px, py, 2.6, 0, 7); pctx.fill(); }
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

  // steel rule with etched ticks
  const rc = document.createElement("canvas");
  rc.width = 32; rc.height = 256;
  const rctx = rc.getContext("2d");
  rctx.fillStyle = "#b9bdc4"; rctx.fillRect(0, 0, 32, 256);
  rctx.fillStyle = "#3a3d42";
  for (let i = 0; i < 256; i += 8) rctx.fillRect(0, i, i % 32 === 0 ? 16 : 9, 1.6);
  const rTex = new THREE.CanvasTexture(rc);
  rTex.colorSpace = THREE.SRGBColorSpace;
  const rule = new THREE.Mesh(
    new THREE.BoxGeometry(0.032, 0.32, 0.002),
    new THREE.MeshStandardMaterial({ map: rTex, metalness: 0.85, roughness: 0.3 })
  );
  rule.position.set(-0.82, TOP_Y + 0.58, bz);
  g.add(rule);

  // cordless drill (body, grip, trigger, chuck, battery)
  const drill = new THREE.Group();
  const dBodyMat = new THREE.MeshStandardMaterial({ color: 0x1c4f9e, roughness: 0.45, metalness: 0.1 });
  const dBody = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.033, 0.15, 16), dBodyMat);
  dBody.rotation.z = Math.PI / 2;
  drill.add(dBody);
  const chuckBase = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.035, 16), darkPlastic);
  chuckBase.rotation.z = Math.PI / 2;
  chuckBase.position.x = -0.09;
  drill.add(chuckBase);
  const chuck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.03, 12), toolSteel);
  chuck.rotation.z = Math.PI / 2;
  chuck.position.x = -0.12;
  drill.add(chuck);
  const grip = new THREE.Mesh(new RoundedBoxGeometry(0.035, 0.13, 0.045, 2, 0.01), dBodyMat);
  grip.position.set(0.02, -0.085, 0);
  grip.rotation.z = 0.16;
  drill.add(grip);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.025, 0.02), darkPlastic);
  trigger.position.set(-0.012, -0.045, 0);
  drill.add(trigger);
  const battery = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.04, 0.055, 2, 0.008), darkPlastic);
  battery.position.set(0.035, -0.16, 0);
  drill.add(battery);
  drill.position.set(-0.5, TOP_Y + 0.62, bz + 0.03);
  g.add(drill);

  // Dremel rotary tool (slim taper body, grip rings, silver collet)
  const dremel = new THREE.Group();
  const dmBody = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.13, 14),
    new THREE.MeshStandardMaterial({ color: 0x74777d, roughness: 0.4, metalness: 0.3 }));
  dremel.add(dmBody);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0022, 8, 20), darkPlastic);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.02 - i * 0.014;
    dremel.add(ring);
  }
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, 0.035, 12), toolSteel);
  nose.position.y = 0.08;
  dremel.add(nose);
  const bit = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.028, 8), toolSteel);
  bit.position.y = 0.108;
  dremel.add(bit);
  dremel.position.set(-0.18, TOP_Y + 0.56, bz + 0.014);
  dremel.rotation.z = 0.06;
  g.add(dremel);

  // torque wrench (long shaft, ratchet head, knurled handle + red band)
  const torque = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.3, 12), toolSteel);
  torque.add(shaft);
  const headBox = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.045, 0.016, 2, 0.005), toolSteel);
  headBox.position.y = 0.165;
  torque.add(headBox);
  const ratchet = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 14), toolSteel);
  ratchet.rotation.x = Math.PI / 2;
  ratchet.position.y = 0.185;
  torque.add(ratchet);
  const tHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 14), darkPlastic);
  tHandle.position.y = -0.14;
  torque.add(tHandle);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.02, 14),
    new THREE.MeshStandardMaterial({ color: 0x2b66d9, roughness: 0.45 }));
  band.position.y = -0.1;
  torque.add(band);
  const scaleWin = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.004),
    new THREE.MeshStandardMaterial({ color: 0xd8dce2, roughness: 0.3 }));
  scaleWin.position.set(0, -0.05, 0.006);
  torque.add(scaleWin);
  torque.position.set(0.18, TOP_Y + 0.6, bz + 0.012);
  torque.rotation.z = 0.5;
  g.add(torque);

  // combination wrench + pliers round out the board
  const wr = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.17, 0.007), toolSteel);
  wr.position.set(0.55, TOP_Y + 0.6, bz);
  wr.rotation.z = -0.1;
  g.add(wr);
  const wrRing = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.006, 8, 18), toolSteel);
  wrRing.position.set(0.563, TOP_Y + 0.69, bz);
  g.add(wrRing);
  const wrJaw = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.007, 12), toolSteel);
  wrJaw.rotation.x = Math.PI / 2;
  wrJaw.position.set(0.536, TOP_Y + 0.515, bz);
  g.add(wrJaw);
  const plierHandleL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.09, 10),
    new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5 }));
  plierHandleL.position.set(0.76, TOP_Y + 0.56, bz);
  plierHandleL.rotation.z = 0.16;
  g.add(plierHandleL);
  const plierHandleR = plierHandleL.clone();
  plierHandleR.position.x = 0.785;
  plierHandleR.rotation.z = -0.16;
  g.add(plierHandleR);
  const plierHead = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.05, 10), toolSteel);
  plierHead.position.set(0.7725, TOP_Y + 0.635, bz);
  g.add(plierHead);

  // digital caliper (beam + fixed/sliding jaws + LCD)
  const caliper = new THREE.Group();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.24, 0.004), toolSteel);
  caliper.add(beam);
  const jawF = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.005), toolSteel);
  jawF.position.set(-0.018, 0.11, 0);
  caliper.add(jawF);
  const slider = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.055, 0.012, 2, 0.004), darkPlastic);
  slider.position.set(-0.008, 0.045, 0);
  caliper.add(slider);
  const lcd = new THREE.Mesh(new THREE.PlaneGeometry(0.028, 0.014),
    new THREE.MeshStandardMaterial({ color: 0x9fae9a, roughness: 0.3 }));
  lcd.position.set(-0.008, 0.05, 0.0065);
  caliper.add(lcd);
  const jawS = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.005), toolSteel);
  jawS.position.set(-0.02, 0.075, 0);
  caliper.add(jawS);
  caliper.position.set(-0.68, TOP_Y + 0.58, bz + 0.008);
  caliper.rotation.z = 0.06;
  g.add(caliper);

  // hex key set: 5 L-keys in a row, descending sizes
  for (let i = 0; i < 5; i++) {
    const r = 0.004 - i * 0.0005;
    const lenL = 0.09 - i * 0.012;
    const long = new THREE.Mesh(new THREE.CylinderGeometry(r, r, lenL, 6), toolSteel);
    long.position.set(-0.33 + i * 0.024, TOP_Y + 0.56 - (0.09 - lenL) / 2, bz);
    g.add(long);
    const short = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 6), toolSteel);
    short.rotation.z = Math.PI / 2;
    short.position.set(-0.33 + i * 0.024 + 0.013, TOP_Y + 0.56 + lenL / 2, bz);
    g.add(short);
  }

  // ball-peen hammer
  const hammer = new THREE.Group();
  const hHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.2, 10), woodMaterial(0x4a4038, 0.55));
  hammer.add(hHandle);
  const hHead = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 12), toolSteel);
  hHead.rotation.z = Math.PI / 2;
  hHead.position.y = 0.1;
  hammer.add(hHead);
  const hBall = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 10), toolSteel);
  hBall.position.set(0.045, 0.1, 0);
  hammer.add(hBall);
  hammer.position.set(0.02, TOP_Y + 0.56, bz + 0.01);
  hammer.rotation.z = -0.06;
  g.add(hammer);

  // flush cutters (equipment-blue handles)
  const cutL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.075, 10),
    new THREE.MeshStandardMaterial({ color: 0x2b66d9, roughness: 0.5 }));
  cutL.position.set(0.895, TOP_Y + 0.55, bz);
  cutL.rotation.z = 0.14;
  g.add(cutL);
  const cutR = cutL.clone();
  cutR.position.x = 0.915;
  cutR.rotation.z = -0.14;
  g.add(cutR);
  const cutHead = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.035, 8), toolSteel);
  cutHead.position.set(0.905, TOP_Y + 0.605, bz);
  g.add(cutHead);

  // tape measure
  const tape = new THREE.Group();
  const tBody = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.055, 0.032, 2, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x2b66d9, roughness: 0.5 }));
  tape.add(tBody);
  const tClip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.036), toolSteel);
  tClip.position.set(-0.032, 0, 0);
  tape.add(tClip);
  tape.position.set(0.68, TOP_Y + 0.52, bz + 0.018);
  g.add(tape);

  // torpedo level (graphite body, two blue vials) — upper band, left
  const level = new THREE.Group();
  const lvBody = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.034, 0.018, 2, 0.006), darkPlastic);
  level.add(lvBody);
  [-0.05, 0.05].forEach((vx) => {
    const vial = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.014, 0.02),
      new THREE.MeshPhysicalMaterial({ color: 0x2b66d9, roughness: 0.2, transparent: true, opacity: 0.85 }));
    vial.position.set(vx, 0.002, 0.001);
    level.add(vial);
  });
  level.position.set(-0.55, TOP_Y + 0.83, bz + 0.012);
  g.add(level);

  // hex key set — five L-keys hung in descending sizes
  for (let i = 0; i < 5; i++) {
    const hk = new THREE.Group();
    const len = 0.085 - i * 0.011;
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.006 - i * 0.0006, len, 0.005), toolSteel);
    leg.position.y = -len / 2;
    hk.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.03 - i * 0.003, 0.006 - i * 0.0006, 0.005), toolSteel);
    foot.position.set(0.012, -len - 0.001, 0);
    hk.add(foot);
    hk.position.set(-0.32 + i * 0.036, TOP_Y + 0.85, bz + 0.01);
    g.add(hk);
  }

  // machinist square (L of steel, clear of the torque wrench head)
  const sqV = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.13, 0.005), toolSteel);
  sqV.position.set(-0.06, TOP_Y + 0.79, bz + 0.01);
  g.add(sqV);
  const sqH = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, 0.005), toolSteel);
  sqH.position.set(-0.022, TOP_Y + 0.734, bz + 0.01);
  g.add(sqH);

  // adjustable wrench fills the mid gap between torque and combo wrench
  const aw = new THREE.Group();
  const awShaft = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.15, 0.008), toolSteel);
  aw.add(awShaft);
  const awJawF = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.01), toolSteel);
  awJawF.position.set(0.008, 0.088, 0);
  aw.add(awJawF);
  const awJawM = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.016, 0.01), toolSteel);
  awJawM.position.set(-0.002, 0.062, 0);
  aw.add(awJawM);
  const awGrip = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.06, 0.012, 2, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5 }));
  awGrip.position.y = -0.05;
  aw.add(awGrip);
  aw.position.set(0.35, TOP_Y + 0.6, bz + 0.01);
  aw.rotation.z = -0.12;
  g.add(aw);

  // wire strippers (blue handles, steel head) — upper band, right
  const stp = new THREE.Group();
  [-1, 1].forEach((s) => {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.08, 10),
      new THREE.MeshStandardMaterial({ color: 0x2b66d9, roughness: 0.5 }));
    h.position.set(s * 0.011, -0.02, 0);
    h.rotation.z = s * 0.18;
    stp.add(h);
  });
  const stpHead = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.007), toolSteel);
  stpHead.position.y = 0.04;
  stp.add(stpHead);
  stp.position.set(0.9, TOP_Y + 0.8, bz + 0.01);
  g.add(stp);

  /* ---- bench top: printer LEFT, clear middle, instruments RIGHT ---- */
  const printer = buildBambuPrinter();
  printer.scale.setScalar(0.8);
  printer.position.set(-0.62, TOP_Y, 0.02);
  printer.rotation.y = 0.1;
  g.add(printer);
  MODELS.printer = printer;

  // (middle of the bench intentionally left clear for a future project)

  // programmable bench PSU with a live readout
  const psu = new THREE.Group();
  const psuBody = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.105, 0.17, 2, 0.008), darkPlastic);
  psuBody.position.y = 0.0525;
  psu.add(psuBody);
  const dc = document.createElement("canvas");
  dc.width = 128; dc.height = 48;
  const dctx = dc.getContext("2d");
  dctx.fillStyle = "#050807"; dctx.fillRect(0, 0, 128, 48);
  dctx.fillStyle = "#42e88a"; dctx.font = "700 20px Consolas, monospace";
  dctx.fillText("12.00 V", 10, 21);
  dctx.fillStyle = "#e8c542"; dctx.fillText(" 1.52 A", 10, 43);
  const dcTex = new THREE.CanvasTexture(dc);
  dcTex.colorSpace = THREE.SRGBColorSpace;
  const psuScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.042),
    new THREE.MeshBasicMaterial({ map: dcTex, color: 0x9a9a9a })
  );
  psuScreen.position.set(-0.03, 0.066, 0.0865);
  psu.add(psuScreen);
  [[0.055, 0.07], [0.085, 0.07]].forEach(([kx, ky]) => {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 16), steel);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx, ky, 0.088);
    psu.add(knob);
  });
  [[-0.06, 0x2b66d9], [-0.03, 0x111111], [0.0, 0x2b66d9], [0.03, 0x111111]].forEach(([jx, col]) => {
    const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 10),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }));
    jack.rotation.x = Math.PI / 2;
    jack.position.set(jx, 0.026, 0.088);
    psu.add(jack);
  });
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

  /* ---- spare J-hooks filling the pegboard's empty lower band ---- */
  const hookMat = new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.4, metalness: 0.85 });
  const mkHook = (hx, hy) => {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8), hookMat);
    stem.rotation.x = Math.PI / 2 - 0.25; // slight upward tilt
    stem.position.set(hx, hy, bz + 0.006);
    g.add(stem);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8), hookMat);
    tip.position.set(hx, hy + 0.016, bz + 0.028);
    g.add(tip);
  };
  [-0.66, -0.5, -0.34, -0.18, 0.02, 0.22, 0.42, 0.62].forEach((hx) => mkHook(hx, 1.06));
  psu.rotation.y = -0.06;
  g.add(psu);

  // soldering station + iron
  const solder = new THREE.Group();
  const sBody = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.075, 0.11, 2, 0.007), darkPlastic);
  sBody.position.y = 0.0375;
  solder.add(sBody);
  const sd = document.createElement("canvas");
  sd.width = 64; sd.height = 32;
  const sctx = sd.getContext("2d");
  sctx.fillStyle = "#080505"; sctx.fillRect(0, 0, 64, 32);
  sctx.fillStyle = "#ff5a3c"; sctx.font = "700 18px Consolas, monospace"; sctx.fillText("350", 8, 23);
  sctx.fillText("C", 46, 23);
  const sdTex = new THREE.CanvasTexture(sd);
  sdTex.colorSpace = THREE.SRGBColorSpace;
  const sScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), new THREE.MeshBasicMaterial({ map: sdTex, color: 0x9a9a9a }));
  sScreen.position.set(-0.02, 0.05, 0.0565);
  solder.add(sScreen);
  const sKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.014, 16), steel);
  sKnob.rotation.x = Math.PI / 2;
  sKnob.position.set(0.035, 0.045, 0.057);
  solder.add(sKnob);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.028, 0.06, 14, 1, true), steel);
  stand.rotation.z = 1.15;
  stand.position.set(0.1, 0.045, 0.02);
  solder.add(stand);
  const ironHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: 0x27408a, roughness: 0.5 }));
  ironHandle.rotation.z = 1.15;
  ironHandle.position.set(0.135, 0.062, 0.02);
  solder.add(ironHandle);
  const ironTip = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.004, 0.05, 8), toolSteel);
  ironTip.rotation.z = 1.15;
  ironTip.position.set(0.07, 0.032, 0.02);
  solder.add(ironTip);
  solder.position.set(0.72, TOP_Y, -0.08);
  solder.rotation.y = 0.18;
  g.add(solder);

  // screwdriver set
  const drivers = new THREE.Group();
  const block = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.032, 0.055, 2, 0.006), woodMaterial(0x4a3527, 0.5));
  block.position.y = 0.045;
  drivers.add(block);
  [[-0.06, 0x2b66d9], [-0.036, 0x17181c], [-0.012, 0x2b66d9], [0.012, 0x8a8f96], [0.036, 0x17181c], [0.06, 0x2b66d9]].forEach(([dx, col], i) => {
    const shaft2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.075, 8), toolSteel);
    shaft2.position.set(dx, 0.02, 0);
    drivers.add(shaft2);
    const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0065, 0.045, 10),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.42 }));
    hdl.position.set(dx, 0.085 + (i % 2) * 0.004, 0);
    drivers.add(hdl);
  });
  drivers.position.set(0.52, TOP_Y, 0.17);
  drivers.rotation.y = -0.22;
  g.add(drivers);

  // multimeter
  const meter = new THREE.Group();
  const mBody = new THREE.Mesh(new RoundedBoxGeometry(0.082, 0.02, 0.15, 2, 0.007),
    new THREE.MeshStandardMaterial({ color: 0x27408a, roughness: 0.55 }));
  mBody.position.y = 0.01;
  meter.add(mBody);
  const mScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x9fae9a, roughness: 0.3, emissive: 0x2a2f28, emissiveIntensity: 0.4 }));
  mScreen.rotation.x = -Math.PI / 2;
  mScreen.position.set(0, 0.0205, -0.045);
  meter.add(mScreen);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.008, 20), darkPlastic);
  dial.position.set(0, 0.022, 0.02);
  meter.add(dial);
  const dialMark = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, 0.018),
    new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.4 }));
  dialMark.position.set(0, 0.026, 0.014);
  meter.add(dialMark);
  meter.position.set(0.24, TOP_Y, 0.16);
  meter.rotation.y = 0.5;
  g.add(meter);

  // LED bar bench lamp (clean single-stem design)
  const benchLamp = buildLedBarLamp();
  benchLamp.position.set(0.9, TOP_Y, -0.18);
  benchLamp.rotation.y = -0.6;
  g.add(benchLamp);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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

function buildBambuPrinter() {
  // Bambu Lab H2S per reference: light-silver side shells, dark front with a
  // large tinted door, top control band with screen + wordmark, side logo,
  // and an AMS 2 unit on top with four visible spools under a smoked cover
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xb9b9bb, roughness: 0.44, metalness: 0.3 });
  const darkFace = new THREE.MeshStandardMaterial({ color: 0x202227, roughness: 0.45, metalness: 0.4 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.5, metalness: 0.4 });
  const W = 0.49, H = 0.62, D = 0.5;

  // hollow shell (light silver): back + two sides + top + bottom, with the
  // FRONT left open so the door glass actually reveals the lit chamber
  // (a solid box here would block the view no matter how clear the door is)
  const wall = 0.014, cy = H / 2 + 0.008;
  [
    [W, H, wall, 0, cy, -D / 2 + wall / 2],       // back
    [wall, H, D, -W / 2 + wall / 2, cy, 0],       // left
    [wall, H, D, W / 2 - wall / 2, cy, 0],        // right
    [W, wall, D, 0, H + 0.008 - wall / 2, 0],     // top
    [W, wall, D, 0, 0.008 + wall / 2, 0],         // bottom
  ].forEach(([w, h, d, x, y, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), silver);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.018, 12), trim);
    foot.position.set(sx * (W / 2 - 0.05), 0.009, sz * (D / 2 - 0.05));
    g.add(foot);
  });

  // dark front face — a BEZEL only (open where the glass door is, so the lit
  // chamber shows through). Solid top band carries the screen + wordmark.
  const frontZ = D / 2 + 0.006;
  const chamberW = W - 0.05, doorH = H * 0.7; // wide, tall tinted door per the H2S reference
  const doorY0 = 0.05, doorY1 = doorY0 + doorH;          // door opening in Y
  const faceY0 = 0.018, faceY1 = H - 0.002, faceHW = (W - 0.02) / 2;
  const bezel = [
    [W - 0.02, faceY1 - doorY1, 0, (doorY1 + faceY1) / 2],   // top band (screen)
    [W - 0.02, doorY0 - faceY0, 0, (faceY0 + doorY0) / 2],   // bottom lip
    [faceHW - chamberW / 2, doorH, -(faceHW + chamberW / 2) / 2, (doorY0 + doorY1) / 2], // left rail
    [faceHW - chamberW / 2, doorH,  (faceHW + chamberW / 2) / 2, (doorY0 + doorY1) / 2], // right rail
  ];
  bezel.forEach(([w, h, x, y]) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.014, 2, 0.006), darkFace);
    m.position.set(x, y, D / 2);
    g.add(m);
  });

  // printing chamber behind the glass
  const chamber = new THREE.Mesh(
    new THREE.BoxGeometry(chamberW, doorH, 0.34),
    new THREE.MeshStandardMaterial({ color: 0x1b1e24, roughness: 0.85, side: THREE.BackSide })
  );
  chamber.position.set(0, doorH / 2 + 0.05, D / 2 - 0.18);
  g.add(chamber);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(chamberW - 0.05, 0.006, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x44484e, roughness: 0.5, metalness: 0.5 })
  );
  plate.position.set(0, 0.12, D / 2 - 0.19);
  g.add(plate);
  // heated bed carrier under the build plate
  const bed = new THREE.Mesh(new THREE.BoxGeometry(chamberW - 0.03, 0.01, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.6, metalness: 0.4 }));
  bed.position.set(0, 0.111, D / 2 - 0.19);
  g.add(bed);
  const printZ = D / 2 - 0.19;
  const printMat = new THREE.MeshStandardMaterial({ color: 0x2f7fff, roughness: 0.5, metalness: 0.05, emissive: 0x2f7fff, emissiveIntensity: 0.35 });
  // a small car mid-print on the bed (the top rows still "growing")
  const carBody = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.03, 0.055, 2, 0.007), printMat);
  carBody.position.set(0, 0.138, printZ);
  g.add(carBody);
  const carCabin = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.018, 0.045, 2, 0.006), printMat);
  carCabin.position.set(-0.008, 0.157, printZ);
  g.add(carCabin);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.35, metalness: 0.9 });
  // X-gantry rail, lowered closer to the bed so the head isn't on a long drop
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(chamberW - 0.04, 0.012, 0.018), railMat);
  crossbar.position.set(0, 0.285, printZ - 0.01);
  g.add(crossbar);
  // moving print head: carriage on the rail + short Z-post + nozzle to the bed,
  // with a hot-end glow at the tip (sweeps in X)
  const headGroup = new THREE.Group();
  const carriage = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.05, 2, 0.008), railMat);
  carriage.position.set(0, 0.28, printZ - 0.004);
  headGroup.add(carriage);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.4, metalness: 0.3 }));
  post.position.set(0, 0.245, printZ);
  headGroup.add(post);
  const nozzleBlock = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.05, 0.045, 2, 0.009),
    new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.4, metalness: 0.4 }));
  nozzleBlock.position.set(0, 0.205, printZ);
  headGroup.add(nozzleBlock);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.009, 0.022, 10), railMat);
  nozzle.position.set(0, 0.176, printZ);
  headGroup.add(nozzle);
  const headLed = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0xff4422, emissiveIntensity: 1.8 }));
  headLed.position.set(0, 0.167, printZ);
  headGroup.add(headLed);
  // toolhead fan shroud (the chunky Bambu hot-end cover) with a fan face
  const shroud = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.058, 0.022, 2, 0.006),
    new THREE.MeshStandardMaterial({ color: 0x202226, roughness: 0.42, metalness: 0.35 }));
  shroud.position.set(0, 0.206, printZ + 0.03);
  headGroup.add(shroud);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.016, 16),
    new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.5, metalness: 0.2 }));
  fan.position.set(0, 0.209, printZ + 0.042);
  headGroup.add(fan);
  g.add(headGroup);
  MODELS.printerHead = headGroup;
  // CoreXY gantry ends (Y-rails + carriages) and rear Z lead screws — makes
  // the lit chamber read as a real machine through the door
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.4, metalness: 0.5 });
  const screwMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.35, metalness: 0.95 });
  [-1, 1].forEach((s) => {
    const yrail = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.014, 0.26), gantryMat);
    yrail.position.set(s * (chamberW / 2 - 0.02), 0.292, printZ - 0.02);
    g.add(yrail);
    const yc = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.022, 0.034, 2, 0.004), gantryMat);
    yc.position.set(s * (chamberW / 2 - 0.02), 0.286, printZ - 0.01);
    g.add(yc);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.23, 10), screwMat);
    screw.position.set(s * (chamberW / 2 - 0.035), 0.225, -0.06);
    g.add(screw);
  });
  // restrained chamber light: below the bloom threshold, short throw so the
  // glow stays INSIDE the enclosure instead of haloing the bench
  const chamberLed = new THREE.Mesh(
    new THREE.BoxGeometry(chamberW - 0.04, 0.006, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xf2f6fc, emissive: 0xeef4ff, emissiveIntensity: 0.75 })
  );
  chamberLed.position.set(0, doorH - 0.02, D / 2 - 0.05);
  g.add(chamberLed);
  const inner = new THREE.PointLight(0xeaf2ff, 0.38, 0.8, 2);
  inner.position.set(0, doorH - 0.06, D / 2 - 0.16);
  g.add(inner);
  const inner2 = new THREE.PointLight(0xfff0e0, 0.28, 0.5, 2); // warm fill near the hot-end
  inner2.position.set(0, 0.24, printZ);
  g.add(inner2);

  // tinted door — unlit basic material so the bright bench can't wash it out
  // with specular; you see cleanly through to the lit chamber
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(chamberW, doorH),
    new THREE.MeshBasicMaterial({
      color: 0x1c2530, transparent: true, opacity: 0.26,
      side: THREE.DoubleSide, depthWrite: false,
    })
  );
  glass.position.set(0, doorH / 2 + 0.05, frontZ + 0.004);
  g.add(glass);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.09, 0.01), trim);
  handle.position.set(chamberW / 2 - 0.012, doorH / 2 + 0.06, frontZ + 0.01);
  g.add(handle);

  // top control band: large touchscreen (left, circular gauge + menu) and the
  // "Bambu Lab H2S" wordmark (right), matching the H2S reference photo
  const ui = document.createElement("canvas");
  ui.width = 176; ui.height = 124;
  const uctx = ui.getContext("2d");
  uctx.fillStyle = "#0a0d10"; uctx.fillRect(0, 0, 176, 124);
  // circular print-progress gauge (left)
  const gx = 44, gy = 66, gr = 34;
  uctx.lineWidth = 7; uctx.strokeStyle = "#233040";
  uctx.beginPath(); uctx.arc(gx, gy, gr, 0, Math.PI * 2); uctx.stroke();
  uctx.strokeStyle = "#22c39c";
  uctx.beginPath(); uctx.arc(gx, gy, gr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 1.32); uctx.stroke();
  uctx.fillStyle = "#e8ecf2"; uctx.textAlign = "center"; uctx.font = "700 20px Arial";
  uctx.fillText("66%", gx, gy + 7);
  // menu rows (right)
  uctx.textAlign = "left";
  for (let r = 0; r < 4; r++) {
    uctx.fillStyle = r === 0 ? "#16283a" : "#131922";
    uctx.fillRect(96, 16 + r * 26, 68, 20);
    uctx.fillStyle = r === 0 ? "#22c39c" : "#586675";
    uctx.beginPath(); uctx.arc(106, 26 + r * 26, 4, 0, Math.PI * 2); uctx.fill();
    uctx.fillStyle = "#9aa4b0"; uctx.fillRect(116, 24 + r * 26, 42, 4);
  }
  // status strip (temps)
  uctx.fillStyle = "#22c39c"; uctx.font = "600 11px Arial";
  uctx.fillText("210°  60°", 10, 16);
  const uiTex = new THREE.CanvasTexture(ui);
  uiTex.colorSpace = THREE.SRGBColorSpace;
  const scFrame = new THREE.Mesh(new RoundedBoxGeometry(0.126, 0.094, 0.006, 2, 0.004),
    new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.5 }));
  scFrame.position.set(-W / 2 + 0.088, H - 0.082, frontZ + 0.004);
  g.add(scFrame);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.115, 0.082),
    new THREE.MeshBasicMaterial({ map: uiTex, color: 0xcaccd0 }));
  screen.position.set(-W / 2 + 0.088, H - 0.082, frontZ + 0.009);
  g.add(screen);
  const wm = document.createElement("canvas");
  wm.width = 200; wm.height = 40;
  const wctx = wm.getContext("2d");
  wctx.textAlign = "right";
  wctx.fillStyle = "#a9afb8"; wctx.font = "600 12px Arial"; wctx.fillText("Bambu Lab", 132, 26);
  wctx.fillStyle = "#e8ebf0"; wctx.font = "700 26px Arial"; wctx.fillText("H2S", 190, 30);
  const wmTex = new THREE.CanvasTexture(wm);
  wmTex.colorSpace = THREE.SRGBColorSpace;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.03), new THREE.MeshBasicMaterial({ map: wmTex, transparent: true }));
  mark.position.set(W / 2 - 0.105, H - 0.062, frontZ + 0.009);
  g.add(mark);

  // Bambu Lab logo on the right side shell (two bars + wordmark)
  const lg = document.createElement("canvas");
  lg.width = 128; lg.height = 128;
  const lctx = lg.getContext("2d");
  // transparent bg so only the dark mark shows on the silver side panel;
  // the Bambu Lab mark = two vertical bars linked by a diagonal top cut
  lctx.fillStyle = "#2b2d31";
  lctx.fillRect(73, 26, 13, 58);   // right (tall) bar
  lctx.fillRect(49, 42, 13, 42);   // left (short) bar
  lctx.beginPath();                // diagonal linking the two bar tops
  lctx.moveTo(49, 42); lctx.lineTo(86, 26); lctx.lineTo(86, 37); lctx.lineTo(62, 48); lctx.closePath(); lctx.fill();
  lctx.fillStyle = "#34363b"; lctx.font = "600 13px Arial"; lctx.textAlign = "center";
  lctx.fillText("Bambu Lab", 67, 104);
  const lgTex = new THREE.CanvasTexture(lg);
  lgTex.colorSpace = THREE.SRGBColorSpace;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), new THREE.MeshBasicMaterial({ map: lgTex, transparent: true }));
  logo.position.set(W / 2 + 0.002, H * 0.5 + 0.05, -0.02);
  logo.rotation.y = Math.PI / 2;
  g.add(logo);

  /* ---- AMS 2 on top: dark tray + four spools under a smoked cover ---- */
  const ams = new THREE.Group();
  const amsW = W - 0.06, amsD = D - 0.16, amsH = 0.05;
  const tray = new THREE.Mesh(new RoundedBoxGeometry(amsW, amsH, amsD, 2, 0.01), trim);
  tray.position.y = amsH / 2;
  ams.add(tray);
  // 4 feed slots on the tray front
  for (let i = 0; i < 4; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.008),
      new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.5 }));
    slot.position.set(-amsW / 2 + 0.08 + i * 0.095, 0.03, amsD / 2 - 0.002);
    ams.add(slot);
  }
  // spools row — same 1.6x scale as the spare spools on the bench shelf
  [0xe8eaee, 0x2b66d9, 0x2fa98c, 0xd97b2b].forEach((col, i) => {
    const sp = makeMiniSpool(col);
    sp.scale.setScalar(1.6);
    sp.rotation.z = Math.PI / 2;
    sp.position.set(-amsW / 2 + 0.075 + i * 0.095, amsH + 0.055, 0);
    ams.add(sp);
  });
  // smoked half-cylinder cover along the width (sized to clear the spools)
  const cover = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, amsW, 26, 1, true, 0, Math.PI),
    new THREE.MeshPhysicalMaterial({
      color: 0x101114, roughness: 0.12, metalness: 0,
      transparent: true, opacity: 0.42, side: THREE.DoubleSide,
    })
  );
  cover.rotation.z = Math.PI / 2;
  cover.position.set(0, amsH + 0.045, 0);
  ams.add(cover);
  // cover end caps
  [-amsW / 2, amsW / 2].forEach((ex) => {
    const cap = new THREE.Mesh(new THREE.CircleGeometry(0.085, 26, 0, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.45, metalness: 0.3, side: THREE.DoubleSide }));
    cap.position.set(ex, amsH + 0.045, 0);
    cap.rotation.y = Math.PI / 2;
    ams.add(cap);
  });
  ams.position.set(0, H + 0.016, -0.02);
  g.add(ams);
  // PTFE feed tube: AMS lid down into the body top (the spools must connect)
  const tubePts = [
    new THREE.Vector3(0.16, H + 0.07, -0.12),
    new THREE.Vector3(0.225, H + 0.1, -0.1),
    new THREE.Vector3(0.235, H + 0.03, -0.05),
    new THREE.Vector3(0.2, H + 0.005, -0.02),
  ];
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tubePts), 24, 0.0045, 8),
    new THREE.MeshStandardMaterial({ color: 0xdfe2e6, roughness: 0.5, metalness: 0.05 })
  );
  g.add(tube);
  // thin door frame around the glass + a side vent slot
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.5, metalness: 0.35 });
  [
    [chamberW + 0.016, 0.008, 0, doorY1 + 0.004],
    [chamberW + 0.016, 0.008, 0, doorY0 - 0.004],
    [0.008, doorH + 0.016, -chamberW / 2 - 0.004, (doorY0 + doorY1) / 2],
    [0.008, doorH + 0.016, chamberW / 2 + 0.004, (doorY0 + doorY1) / 2],
  ].forEach(([w, h, x, y]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), doorFrameMat);
    bar.position.set(x, y, frontZ + 0.006);
    g.add(bar);
  });
  const vent = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.7, metalness: 0.2 }));
  vent.position.set(W / 2 + 0.001, H - 0.12, -0.08);
  g.add(vent);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a4b5c, roughness: 0.16, metalness: 0, transparent: true, opacity: 0.3,
    envMapIntensity: 0.7, clearcoat: 0.15, clearcoatRoughness: 0.28,
  });
  CAB2.rows.forEach((y) => {
    const board = new THREE.Mesh(new RoundedBoxGeometry(D - 0.08, 0.014, W - 0.08, 2, 0.004), glassMat);
    board.position.set(0, y - 0.007, 0);
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

function steelToolMat() {
  return new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.4 });
}

function buildFtcBot() {
  // FTC robot: chassis, four mecanum wheels, vertical lift, claw, hub
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.5, metalness: 0.4 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.35, metalness: 0.9 });
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.02, 0.16, 2, 0.005), alu);
  chassis.position.y = 0.045;
  g.add(chassis);
  // mecanum wheels: small hub + rollers ON the rim at 45deg (the rollers are
  // the tread — no solid tyre cylinder to poke through them), mounted flush
  // outside the chassis so nothing clips
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.55, metalness: 0.5 });
  const rollerMat = new THREE.MeshStandardMaterial({ color: 0x53565c, roughness: 0.55, metalness: 0.3 });
  const wheelUp = new THREE.Vector3(0, 1, 0);
  function mecanumWheel(hand) {
    const wheel = new THREE.Group();
    const hubR = 0.015, hubW = 0.02, ringR = 0.028;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(hubR, hubR, hubW, 18), hubMat); // axis = local y
    wheel.add(hub);
    [-1, 1].forEach((s) => {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(hubR * 1.2, hubR * 1.2, 0.002, 18), hubMat);
      disc.position.y = (s * hubW) / 2;
      wheel.add(disc);
    });
    const N = 10;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const roller = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.015, 4, 8), rollerMat);
      roller.position.set(ringR * Math.cos(a), 0, ringR * Math.sin(a));
      // long axis = tangent blended 45deg toward the wheel axis (mecanum);
      // `hand` mirrors the tilt on the left vs right wheels
      const dir = new THREE.Vector3(-hand * Math.sin(a), 1, hand * Math.cos(a)).normalize();
      roller.quaternion.setFromUnitVectors(wheelUp, dir);
      wheel.add(roller);
    }
    return wheel;
  }
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const w = mecanumWheel(sx);
    w.rotation.z = Math.PI / 2;                 // spin axis -> world x
    w.position.set(sx * 0.112, 0.034, sz * 0.07); // flush just outside the chassis side
    g.add(w);
  });
  // vertical lift + claw
  [[-0.03], [0.03]].forEach(([x]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.22, 0.012), alu);
    rail.position.set(x, 0.16, -0.05);
    g.add(rail);
  });
  const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.02), dark);
  carriage.position.set(0, 0.2, -0.04);
  g.add(carriage);
  // claw fingers are red on the real robot (competition photos)
  const red = new THREE.MeshStandardMaterial({ color: 0xc5342c, roughness: 0.5, metalness: 0.1 });
  [[-0.02, 0.25], [0.02, -0.25]].forEach(([x, rot]) => {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.03), red);
    finger.position.set(x, 0.185, -0.015);
    finger.rotation.z = rot;
    g.add(finger);
  });
  // REV control hub is black on the real robot (was stylized blue)
  const hub = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.02, 0.05, 2, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x212226, roughness: 0.5 }));
  hub.position.set(0.04, 0.065, 0.03);
  g.add(hub);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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

function buildResumePaper() {
  // A4-ish sheet lying flat on the desk. The Arial canvas drawn here is only
  // a BOOT PLACEHOLDER: once the webfonts are ready, applySheetTexture()
  // permanently replaces it with the DOM-parity snapshot (the sheet then
  // shows the exact same document as the interactive résumé, everywhere).
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  // 4x supersampled so the text stays crisp at fly-in distance; drawing
  // coordinates below stay in the original 256x340 space via ctx.scale
  c.width = 1024;
  c.height = 1360;
  const ctx = c.getContext("2d");
  ctx.scale(4, 4);
  const bg = ctx.createLinearGradient(0, 0, 0, 340);
  bg.addColorStop(0, "#fafbfd");
  bg.addColorStop(1, "#eef0f4");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 340);
  ctx.textBaseline = "alphabetic";

  const wrap = (text, maxWidth, maxLines = Infinity) => {
    const words = String(text || "").split(/\s+/);
    const lines = [];
    let line = "";
    for (let i = 0; i < words.length; i++) {
      const trial = line ? `${line} ${words[i]}` : words[i];
      if (line && ctx.measureText(trial).width > maxWidth) {
        lines.push(line);
        line = words[i];
        if (lines.length === maxLines - 1) {
          const rest = [line, ...words.slice(i + 1)].join(" ");
          let clipped = rest;
          while (clipped && ctx.measureText(`${clipped}…`).width > maxWidth) clipped = clipped.slice(0, -1);
          lines.push(`${clipped.trim()}…`);
          return lines;
        }
      } else {
        line = trial;
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
    return lines;
  };
  const textBlock = (text, x, y, maxWidth, lineHeight, maxLines = Infinity) => {
    const lines = wrap(text, maxWidth, maxLines);
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
    return y + lines.length * lineHeight;
  };
  const sectionLabel = (label, y) => {
    ctx.fillStyle = "#6b7077";
    ctx.font = "700 5.3px 'Courier New', monospace";
    ctx.fillText(label.toUpperCase(), 20, y);
  };

  ctx.fillStyle = "#0f1114";
  ctx.font = "800 15px Arial, sans-serif";
  ctx.fillText(RESUME.name, 20, 30);
  ctx.fillStyle = "#565b63";
  ctx.font = "500 6.8px Arial, sans-serif";
  let y = textBlock(`${RESUME.role} — ${RESUME.meta}`, 20, 43, 216, 8.2, 2);
  y += 1.5;
  ctx.fillStyle = "#3f8cff";
  ctx.fillRect(20, y, 216, 1.5);

  ctx.fillStyle = "#1d1f24";
  ctx.font = "400 6.8px Arial, sans-serif";
  y = textBlock(RESUME.summary, 20, y + 10, 216, 9, 5) + 5;

  sectionLabel("Highlights", y);
  y += 10;
  ctx.font = "400 6.5px Arial, sans-serif";
  (RESUME.highlights || []).forEach((item) => {
    const lines = wrap(item, 207, 2);
    ctx.fillStyle = "#3f8cff";
    ctx.fillRect(20, y - 4.4, 2.5, 2.5);
    ctx.fillStyle = "#1d1f24";
    lines.forEach((line, i) => ctx.fillText(line, 27, y + i * 8));
    y += lines.length * 8 + 3;
  });

  sectionLabel("Skills", y + 2);
  y += 13;
  (RESUME.skills || []).forEach((skill) => {
    ctx.fillStyle = "#1d1f24";
    ctx.font = "700 5.3px Arial, sans-serif";
    ctx.fillText(skill.group, 20, y);
    ctx.fillStyle = "#565b63";
    ctx.font = "400 5.3px Arial, sans-serif";
    const items = wrap((skill.items || []).join(" · "), 130, 1)[0] || "";
    ctx.fillText(items, 106, y);
    y += 10;
  });

  sectionLabel("Contact", y + 3);
  ctx.fillStyle = "#1d5cc4";
  ctx.font = "400 5.3px Arial, sans-serif";
  textBlock((RESUME.contact || []).map((item) => item.label).join(" · "), 20, y + 14, 216, 7, 2);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAXA; // the sheet lies flat — grazing view needs aniso

  // larger sheet so the resume reads as the hero object on the desk
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.004, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xe4e6ea, roughness: 0.96 })
  );
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  g.add(sheet);
  // The emissiveMap is wired at build time with intensity 0 (zero visual
  // contribution on the desk) so the pickup can brighten the sheet at night
  // by ramping a uniform — no shader recompile, no mid-animation hitch.
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.234, 0.312),
    new THREE.MeshStandardMaterial({
      map: tex, color: 0xf1f3f6, roughness: 0.96,
      emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0,
    })
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0025;
  g.add(face);
  // the pickup animation needs the printed face: its world pose defines the
  // sheet's on-screen rect, and its emissiveIntensity is the night glow ramp
  g.userData.resumeFace = face;
  return g;
}

function buildCfdDisplay(texLoader) {
  // small monitor on a stand showing the real Ansys pressure field render
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.4, metalness: 0.5 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.012, 24), dark);
  base.position.y = 0.006;
  g.add(base);
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.07, 0.016), dark);
  neck.position.y = 0.045;
  g.add(neck);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.17, 0.014, 2, 0.005), dark);
  bezel.position.y = 0.16;
  bezel.rotation.x = -0.06;
  g.add(bezel);
  const tex = texLoader.load("assets/ansys-cfd-pressure.webp");
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAXA; // screen is viewed at an angle — aniso keeps it sharp
  // the source render is 16:9-ish (1800x1013) but the panel is 1.58:1 —
  // crop the texture horizontally instead of squashing it
  const crop = (0.245 / 0.155) / (1800 / 1013);
  tex.repeat.set(crop, 1);
  tex.offset.set((1 - crop) / 2, 0);
  // unlit screen, dimmed below the bloom threshold so it reads as an LCD,
  // not a light fixture
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.245, 0.155),
    new THREE.MeshBasicMaterial({ map: tex, color: 0x9d9d9d })
  );
  screen.position.set(0, 0.16, 0.0078);
  screen.rotation.x = -0.06;
  g.add(screen);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
      (it) => `
      <figure class="exp-panel__shot">
        <img src="${it.src}" alt="${it.alt || ""}" loading="lazy" />
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
      ? `<div class="exp-panel__media"><img src="${img}" alt="" loading="lazy"></div>`
      : "";
  return `
    <button class="exp-panel__close" data-close aria-label="Close">&times;</button>
    <p class="exp-panel__kicker">${p.kicker || ""}</p>
    <h2 class="exp-panel__title">${p.title || ""}</h2>
    <p class="exp-panel__summary">${p.summary || ""}</p>
    ${lead}
    ${hi ? `<h3 class="exp-panel__h3">Engineering signal</h3><ul class="exp-panel__list">${hi}</ul>` : ""}
    ${tools ? `<h3 class="exp-panel__h3">Tools and methods</h3><div class="exp-panel__chips">${tools}</div>` : ""}
    ${details}
  `;
}

function resumeHTML(r) {
  const hi = (r.highlights || []).map((h) => `<li>${h}</li>`).join("");
  const skills = (r.skills || [])
    .map((s) => `<div class="exp-sheet__skill"><b>${s.group}</b><span>${s.items.join(" · ")}</span></div>`)
    .join("");
  const contact = (r.contact || [])
    .map((c) => `<a href="${c.href}"${c.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${c.label}</a>`)
    .join('<span class="exp-sheet__dot">·</span>');
  return `
    <button class="exp-sheet__close" data-close aria-label="Close">&times;</button>
    <h2 class="exp-sheet__name">${r.name}</h2>
    <p class="exp-sheet__role">${r.role} — ${r.meta}</p>
    <hr class="exp-sheet__rule" />
    <p class="exp-sheet__summary">${r.summary}</p>
    <h3 class="exp-sheet__h3">Highlights</h3>
    <ul class="exp-sheet__list">${hi}</ul>
    <h3 class="exp-sheet__h3">Skills</h3>
    <div class="exp-sheet__skills">${skills}</div>
    <h3 class="exp-sheet__h3">Contact</h3>
    <p class="exp-sheet__contact">${contact}</p>
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
    if (txt) txt.textContent = "WebGL unavailable — use “View classic site”";
    const bar = loaderEl.querySelector(".exp-loader__bar");
    if (bar) bar.style.display = "none";
  }
} else {
  initScene(canvas);
}
