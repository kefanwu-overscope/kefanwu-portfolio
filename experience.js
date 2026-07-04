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
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { GTAOPass } from "three/addons/postprocessing/GTAOPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { Reflector } from "three/addons/objects/Reflector.js";
import { RESUME } from "./experience-data.js";

document.documentElement.classList.add("exp-js");

// low tier: phones / coarse pointers get a lighter pipeline
const LOW_TIER =
  window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 820;

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

function woodMaterial(tint = COL.woodTint, rough = 0.8) {
  const t = TEX.loadPBR("dark_wood");
  return new THREE.MeshStandardMaterial({
    color: tint,
    map: t.map,
    normalMap: t.normalMap,
    roughnessMap: t.roughnessMap,
    roughness: rough,
    metalness: 0.0,
  });
}
const brassMat = () =>
  new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.3, metalness: 1.0 });

/* engineering materials for the merged assembly buckets (mesh name mat_*) */
const ASSEMBLY_MATS = {
  // fully-metallic mats live off the env map — boost per-material intensity
  // so the CAD exhibits stay readable at the scene's low global env level
  steel: () => new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1.0, roughness: 0.45, envMapIntensity: 1.8 }),
  brass: () => new THREE.MeshStandardMaterial({ color: 0x9d9789, metalness: 1.0, roughness: 0.35, envMapIntensity: 1.6 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.55, roughness: 0.45, envMapIntensity: 1.4 }),
  printed: () => new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.12, roughness: 0.58, envMapIntensity: 1.2 }),
  aero: () => new THREE.MeshStandardMaterial({ color: 0xd8dadc, metalness: 0.05, roughness: 0.42, envMapIntensity: 1.2 }),
  carbon: () =>
    new THREE.MeshPhysicalMaterial({
      map: makeCarbonTwillTexture(),
      color: 0xbfc2c6, // tint over the dark weave map
      metalness: 0.25,
      roughness: 0.62, // matte prepreg finish
      clearcoat: 0.12,
      clearcoatRoughness: 0.5,
    }),
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

  const REST_POS = new THREE.Vector3(1.45, 1.35, 2.25);
  const REST_TARGET = new THREE.Vector3(0, 0.95, -0.3);
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
  if (!LOW_TIER) {
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
    bokeh = new BokehPass(scene, camera, { focus: 2.2, aperture: 0.0, maxblur: 0.008 });
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
    0.12, // strength — a whisper halo on true emitters only
    0.45, // radius
    0.92 // threshold — strips/cove only; task-lamp discs must NOT halo
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
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    revealScene();
    if (!prefersReducedMotion) {
      runLightIntro();
      startIntro();
    }
  };
  manager.onLoad = doReveal;
  setTimeout(doReveal, 10000); // safety

  setupTextures(manager);

  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader(manager).load("hdri/wooden_lounge_1k.hdr", (tex) => {
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
  [-0.7, 0, 0.7].forEach((x) => {
    const spot = new THREE.SpotLight(0xe8ecf4, 3.4, 6, 0.46, 0.75, 1.6);
    spot.position.set(x, 2.55, 0.45);
    spot.target.position.set(x, 1.0, CAB.z);
    scene.add(spot);
    scene.add(spot.target);
  });
  // right-wall cabinet gets its own pair of spots
  [-0.75, -0.05].forEach((z) => {
    const spot = new THREE.SpotLight(0xe8ecf4, 3.0, 6, 0.46, 0.75, 1.6);
    spot.position.set(0.9, 2.55, z + 0.3);
    spot.target.position.set(2.3, 1.0, z);
    scene.add(spot);
    scene.add(spot.target);
  });
  // shadowless in-case fills so the exhibits read against the dark backs
  // (the shelf strips are emissive decals only — they cast no real light)
  const caseFillA = new THREE.PointLight(0xdfe8f4, 1.3, 3.2, 1.8);
  caseFillA.position.set(0, 1.55, -0.55);
  scene.add(caseFillA);
  const caseFillB = new THREE.PointLight(0xdfe8f4, 1.1, 2.8, 1.8);
  caseFillB.position.set(1.85, 1.45, -0.4);
  scene.add(caseFillB);

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

  /* ---------- room + rug ---------- */
  buildRoom(scene);

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
    line.position.set(x, 0.0125, z);
    scene.add(line);
  });

  /* ---------- loaders ---------- */
  const loader = new GLTFLoader(manager);
  const artLoader = new THREE.TextureLoader(manager);

  /* ---------- desk (procedural, PBR) + desk props ---------- */
  const DESK_TOP = 0.76;
  scene.add(buildDesk());

  // modern LED desk lamp (procedural), warm pool on the resume
  const deskLamp = buildModernDeskLamp();
  deskLamp.position.set(-0.62, DESK_TOP, -0.16);
  deskLamp.rotation.y = 0.5;
  scene.add(deskLamp);
  MODELS.deskLamp = deskLamp;

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
      matTweak: { printed: { color: 0x9299a1, metalness: 0.4, roughness: 0.45 } } }, // aluminum/grey structure
    { file: "scanner",  key: "scanner",    label: "3D scanner",        size: 0.38, axis: "x", bay: 2, row: 0, rotY: 0.35,
      matTweak: { printed: { color: 0x2a55c8 }, wood: { color: 0xb08a4e, roughness: 0.7 } } }, // blue brackets, plywood base
    { file: "javelin",  key: "javelin",    label: "Javelin VTOL",      size: 0.44, axis: "x", bay: 0, row: 1, rotY: 0.6,
      matTweak: { aero: { color: 0x3a3e44, roughness: 0.5 }, printed: { color: 0x26292e }, dark: { color: 0x24272c } } },
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
    matTweak: { rubber: { color: 0xd9691e, roughness: 0.6 } }, // orange wheels
  });
  placeRoot(buildCfdDisplay(artLoader), scene, {
    fit: [0.6, 0.4, 0.4], markerCap: CAB.rows[2] + 0.44, name: "ex_ansysCfd", projectKey: "ansysCfd", label: "Agent-based CFD",
    targetSize: 0.34, axis: "x", pos: [CAB.bays[1], CAB.rows[2], CAB.frontZ], rotY: 0.25,
  });
  loadAssembly(loader, scene, "models/real/education.glb", {
    // exploded parts layout, rotated 90deg CCW so the guitar lies horizontal
    fit: [0.62, 0.46, 0.4], markerCap: CAB.rows[2] + 0.44, name: "ex_education", projectKey: "education", label: "Guitar education kit",
    targetSize: 0.56, axis: "x", pos: [CAB.bays[2], CAB.rows[2], CAB.frontZ], rotZ: Math.PI / 2, rotY: 0.12,
    matTweak: { printed: { color: 0x2f5fbf, metalness: 0.1, roughness: 0.5 }, wood: { color: 0xc9a86a } }, // blue body, maple neck
  });

  /* ---------- side dressing ---------- */
  // right wall: filled bookshelf; left wall: the electronics workbench
  // (bench + Bambu H2S mid-print + PSU + soldering station + drivers +
  // multimeter + task lamp)
  scene.add(buildSideCabinet());

  // five more projects in the right-wall cabinet (14 on display total).
  // `build` = procedural group; `file` = real CAD GLB via loadAssembly.
  const SIDE_EXHIBITS = [
    { build: buildDriverSeat,  key: "seat",      label: "Driver seat",       size: 0.3,  bay: 0, row: 0 },
    { build: buildFtcBot,      key: "ftc",       label: "FTC robot",         size: 0.28, bay: 1, row: 0 },
    { file: "smelly",          key: "formlabs",  label: "Smelly",            size: 0.3,  axis: "y", bay: 0, row: 1, rotY: -Math.PI / 2 + 0.2,
      matTweak: { printed: { color: 0x9aa0a8, metalness: 0.5, roughness: 0.45 }, steel: { color: 0xaeb4bc } } }, // light aluminum
    // the launcher's long axis is raw +y — lay it down along the shelf
    // native X = floor-normal, Y = length, Z = width; rotate so the opaque
    // floor plate faces down and the length runs along the shelf (z)
    { file: "pool",            key: "pool",      label: "Pool Sniper",       size: 0.5, axis: "z", bay: 1, row: 1, rotZ: Math.PI / 2, rotY: -Math.PI / 2,
      matTweak: { printed: { color: 0x2a55c8 } } }, // blue printed structure, clear side windows
    { file: "telecaster",      key: "telecaster", label: "Telecaster",       size: 0.42, axis: "y", bay: 0, row: 2, rotY: -Math.PI / 2 + 0.2,
      matTweak: { printed: { color: 0xeef0f2, metalness: 0.0, roughness: 0.45 }, wood: { color: 0xc9a86a } } }, // white body, maple neck
  ];
  SIDE_EXHIBITS.forEach((s) => {
    const opts = {
      name: "ex_" + s.key, projectKey: s.key, label: s.label,
      targetSize: s.size, axis: s.axis || "x",
      fit: [0.34, 0.4, 0.58], // x depth into cabinet, z along the wall
      markerCap: CAB2.rows[s.row] + (s.row === 0 ? 0.36 : 0.44),
      pos: [CAB2.frontX, CAB2.rows[s.row], CAB2.bays[s.bay]],
      rotY: s.rotY !== undefined ? s.rotY : -Math.PI / 2 + 0.25,
      rotZ: s.rotZ, rotX: s.rotX, matTweak: s.matTweak,
    };
    if (s.file) loadAssembly(loader, scene, `models/real/${s.file}.glb`, opts);
    else placeRoot(s.build(), scene, opts);
  });
  scene.add(buildWorkbench());

  // rolling tool chest beside the workbench
  const chest = buildToolChest();
  chest.position.set(-2.22, 0, 0.95);
  chest.rotation.y = Math.PI / 2;
  scene.add(chest);
  MODELS.chest = chest;

  // technical schematic panel above the main cabinet
  const blueprint = buildBlueprintPanel();
  blueprint.position.set(0, 2.72, -1.5);
  scene.add(blueprint);

  // real ergonomic mesh task chair (CC BY 4.0 — see ATTRIBUTIONS.txt);
  // replaces the old procedural buildErgoChair() stand-in
  loadModel(loader, scene, "models/ergonomic_mesh_office_chair/ergonomic_mesh_office_chair.glb", {
    // the GLB's intrinsic front is +x, so 1.34 rad turns it to face the desk
    name: "chair", targetSize: 0.95, axis: "y", pos: [-0.25, 0, 1.05], rotY: 1.34,
  });
  // leafy plant tucked in the corner pocket between cabinet and bookshelf
  loadModel(loader, scene, "models/potted_plant_01/potted_plant_01.gltf", {
    name: "plant", targetSize: 1.05, axis: "y", pos: [1.75, 0, -1.18], rotY: 0.6,
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
      startFlight(REST_POS, REST_TARGET, 1500);
      return;
    }
    try { localStorage.setItem("kw_intro_seen", "1"); } catch (e) {}
    // guided sweep: right cabinet -> main cabinet -> resting pose
    startFlight(new THREE.Vector3(0.7, 1.5, 1.9), new THREE.Vector3(2.3, 1.2, -0.4), 1700, () => {
      startFlight(new THREE.Vector3(0.6, 1.45, 1.6), new THREE.Vector3(0, 1.2, -1.1), 1900, () => {
        startFlight(REST_POS, REST_TARGET, 1500);
      });
    });
  }

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  renderer.setAnimationLoop((t) => {
    if (!running) return;

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
        if (!document.documentElement.classList.contains("exp-panel-open")) {
          controls.enabled = true;
          controls.update();
        }
        if (done) done();
      }
    } else {
      controls.update();
      // hard-clamp the camera inside the room shell so no orbit/zoom
      // combination can ever peek past a wall
      const cp = camera.position;
      cp.x = Math.max(-2.35, Math.min(2.35, cp.x));
      cp.z = Math.max(-1.25, Math.min(3.35, cp.z));
      cp.y = Math.max(0.4, Math.min(3.15, cp.y));
    }

    // Bambu printer: print head sweeps across the bed while "printing"
    if (!prefersReducedMotion && MODELS.printerHead) {
      MODELS.printerHead.position.x = Math.sin(t * 0.0032) * 0.13;
    }

    // focused exhibit slowly turns on its pedestal; DoF opens up
    if (panelOpen && focusedPivot && !prefersReducedMotion) {
      focusedPivot.rotation.y += 0.0035;
    }
    if (bokeh) {
      const want = panelOpen && focusedPivot ? 0.00022 : 0.0;
      const u = bokeh.uniforms;
      u.aperture.value += (want - u.aperture.value) * 0.08;
      if (panelOpen && focusedPivot) {
        u.focus.value = camera.position.distanceTo(focusedPivot.userData.hotspot.center);
      }
    }

    // Genshin-style interact markers: bob + pulse, hidden while busy
    const busy = panelOpen || !!flight;
    for (const h of HOTSPOTS) {
      const m = h.userData.hotspot.marker;
      if (!m) continue;
      m.visible = !busy;
      if (!busy && !prefersReducedMotion) {
        const ph = h.userData.hotspot.phase;
        m.position.y = h.userData.hotspot.markerY + Math.sin(t * 0.0024 + ph) * 0.016;
        m.material.opacity = 0.26 + 0.2 * (0.5 + 0.5 * Math.sin(t * 0.003 + ph));
        const s = h === hovered ? 0.06 : 0.042;
        m.scale.setScalar(s);
      }
    }

    composer.render();
  });

  /* ---------- interaction ---------- */
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hovered = null;
  let panelOpen = false;
  let focusedPivot = null;
  let downXY = null;
  const panelEl = document.getElementById("exp-panel");
  const paperEl = document.getElementById("exp-paper");
  const backdropEl = document.getElementById("exp-backdrop");
  const labelEl = document.getElementById("exp-label");

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

  function setHover(root) {
    if (hovered === root) return;
    if (hovered) hovered.scale.setScalar(hovered.userData.hotspot.baseScale);
    hovered = root;
    if (hovered) {
      hovered.scale.setScalar(hovered.userData.hotspot.baseScale * 1.06);
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
    if (panelOpen || flight) return;
    setHover(pickHotspot());
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
    if (moved > 6 || panelOpen || flight) return;
    updatePointer(ev);
    const root = pickHotspot();
    if (root) focusHotspot(root);
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
    // bias the look right of the object so it sits left of the panel
    const right = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    const focusLook = c.clone().addScaledVector(right, 0.2);

    panelOpen = true;
    focusedPivot = hs.key ? root : null;
    sndClick();
    sndWhoosh();
    const open = hs.action === "resume" ? openPaper : openPanel;
    if (prefersReducedMotion) {
      camera.position.copy(focusPos);
      controls.target.copy(focusLook);
      controls.enabled = false;
      camera.lookAt(focusLook);
      open(html);
    } else {
      startFlight(focusPos, focusLook, 850);
      setTimeout(() => open(html), 500);
    }
  }

  function openPanel(html) {
    if (!panelEl) return;
    panelOpen = true;
    panelEl.innerHTML = html;
    panelEl.scrollTop = 0;
    panelEl.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closePanel));
    document.documentElement.classList.add("exp-panel-open");
    setHover(null);
  }
  function openPaper(html) {
    if (!paperEl) return;
    panelOpen = true;
    paperEl.innerHTML = html;
    paperEl.scrollTop = 0;
    paperEl.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", closePanel));
    document.documentElement.classList.add("exp-paper-open");
    setHover(null);
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
    panelOpen = false;
    recenterPivot(focusedPivot);
    focusedPivot = null;
    sndWhoosh(0.4);
    document.documentElement.classList.remove("exp-panel-open");
    document.documentElement.classList.remove("exp-paper-open");
    if (prefersReducedMotion) {
      camera.position.copy(REST_POS);
      controls.target.copy(REST_TARGET);
      controls.enabled = true;
      controls.update();
    } else {
      startFlight(REST_POS, REST_TARGET, 750);
    }
  }
  // gallery lightbox: click a panel shot to enlarge it
  const lightboxEl = document.getElementById("exp-lightbox");
  function closeLightbox() {
    document.documentElement.classList.remove("exp-lightbox-open");
  }
  if (panelEl && lightboxEl) {
    panelEl.addEventListener("click", (ev) => {
      const img = ev.target.closest(".exp-panel__shot img");
      if (!img) return;
      const cap = img.closest("figure")?.querySelector("figcaption")?.textContent || "";
      lightboxEl.innerHTML = `<img src="${img.src}" alt="" /><p>${cap}</p>`;
      document.documentElement.classList.add("exp-lightbox-open");
      sndClick();
    });
    lightboxEl.addEventListener("click", closeLightbox);
  }

  if (backdropEl) backdropEl.addEventListener("click", closePanel);
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.documentElement.classList.contains("exp-lightbox-open")) return closeLightbox();
    if (panelOpen) closePanel();
  });

  window.__exp = { THREE, scene, camera, renderer, controls, composer, bloom, key, hemi, models: MODELS, hotspots: HOTSPOTS, openPanel };
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
  const paint = () => { btn.textContent = sndMuted ? "\uD83D\uDD07" : "\uD83D\uDD0A"; btn.setAttribute("aria-label", sndMuted ? "Enable sound" : "Mute sound"); };
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
    const markerY = Math.min(bb.max.y + 0.09, capY) - center.y;
    const marker = makeInteractMarker();
    marker.position.set(0, markerY, 0);
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

  // polished gloss strip set into the floor in front of the display wall —
  // catches the vitrine light (true planar reflection on desktop tiers,
  // a glossy dark panel on LOW_TIER)
  const stripW = 2.6;
  const stripD = 0.36;
  let gloss;
  if (!LOW_TIER) {
    gloss = new Reflector(new THREE.PlaneGeometry(stripW, stripD), {
      clipBias: 0.003,
      textureWidth: 1024,
      textureHeight: 512,
      color: 0x2a2e34,
    });
  } else {
    gloss = new THREE.Mesh(
      new THREE.PlaneGeometry(stripW, stripD),
      new THREE.MeshStandardMaterial({ color: 0x191c21, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.2 })
    );
  }
  gloss.rotation.x = -Math.PI / 2;
  gloss.position.set(0, 0.003, -0.65);
  scene.add(gloss);
  const revealMat = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.4, metalness: 0.85 });
  [
    [stripW + 0.05, 0.022, 0, -0.65 - stripD / 2 - 0.011],
    [stripW + 0.05, 0.022, 0, -0.65 + stripD / 2 + 0.011],
    [0.022, stripD, -stripW / 2 - 0.011, -0.65],
    [0.022, stripD, stripW / 2 + 0.011, -0.65],
  ].forEach(([w, d, x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, d), revealMat);
    m.position.set(x, 0.004, z);
    scene.add(m);
  });

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
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.45, metalness: 0.85 });

  const top = new THREE.Mesh(
    new RoundedBoxGeometry(W, thk, D, 3, 0.008),
    new THREE.MeshStandardMaterial({ color: 0xc9ced6, roughness: 0.48, metalness: 0.06 })
  );
  top.position.set(0, topY - thk / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // dark desk mat under the work area
  const mat = new THREE.Mesh(
    new RoundedBoxGeometry(1.05, 0.006, 0.52, 2, 0.006),
    new THREE.MeshStandardMaterial({ color: 0x141519, roughness: 0.72, metalness: 0.05 })
  );
  mat.position.set(0, topY + 0.003, 0.08);
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
  // modern display wall: slim black-steel frame, tinted glass shelves with
  // aluminum edges, matte back panel, cool light strips + blue accent
  const g = new THREE.Group();
  const W = 2.36;
  const H = 2.2;
  const D = 0.54;
  const z = CAB.z;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.45, metalness: 0.5, envMapIntensity: 0.5 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.45, metalness: 0.85 });

  // matte back panel
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.02), new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.7, metalness: 0.2 }));
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
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x31404f,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.3,
    envMapIntensity: 1.3,
    clearcoat: 0.5,
    clearcoatRoughness: 0.08,
  });
  CAB.rows.forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(W - 0.09, 0.014, D - 0.08), glassMat);
    board.position.set(0, y - 0.007, z);
    board.receiveShadow = true;
    g.add(board);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(W - 0.09, 0.016, 0.014), alu);
    edge.position.set(0, y - 0.007, z + D / 2 - 0.045);
    g.add(edge);
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
  // minimal modern desk lamp: puck base, slim angled stem, flat LED head
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.38, metalness: 0.7 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.016, 24), body);
  base.position.y = 0.008;
  g.add(base);
  function segment(p0, p1, r) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 12), body);
    mesh.position.copy(p0).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }
  const P0 = new THREE.Vector3(0, 0.016, 0);
  const P1 = new THREE.Vector3(0.05, 0.34, 0);
  const P2 = new THREE.Vector3(0.2, 0.36, 0.02);
  g.add(segment(P0, P1, 0.008));
  g.add(segment(P1, P2, 0.007));
  [P1].forEach((pt) => {
    const j = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 12), body);
    j.position.copy(pt);
    g.add(j);
  });
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.018, 22), body);
  head.position.copy(P2).add(new THREE.Vector3(0.02, -0.004, 0));
  head.rotation.z = 0.14;
  g.add(head);
  const led = new THREE.Mesh(
    new THREE.CylinderGeometry(0.038, 0.038, 0.004, 22),
    new THREE.MeshStandardMaterial({ color: 0xe8ebf0, emissive: 0xdfe6f0, emissiveIntensity: 0.05 })
  );
  led.position.copy(head.position).add(new THREE.Vector3(0, -0.011, 0));
  led.rotation.z = 0.14;
  g.add(led);
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
  // Genshin-style prompt: soft glow + diamond outline + white core (site blue)
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const glow = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  glow.addColorStop(0, "rgba(150, 195, 255, 0.85)");
  glow.addColorStop(0.35, "rgba(110, 165, 255, 0.28)");
  glow.addColorStop(1, "rgba(100, 160, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = "rgba(190, 216, 255, 0.95)";
  ctx.lineWidth = 4;
  ctx.strokeRect(-19, -19, 38, 38);
  ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.9,
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
  const silver = new THREE.MeshStandardMaterial({ color: 0xb4b7bc, roughness: 0.42, metalness: 0.35 });
  const darkFace = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.45, metalness: 0.4 });
  const trim = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.5, metalness: 0.4 });
  const W = 0.49, H = 0.6, D = 0.5;

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
  const chamberW = W - 0.1, doorH = H * 0.66;
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
  const printZ = D / 2 - 0.19;
  const printMat = new THREE.MeshStandardMaterial({ color: 0x2f7fff, roughness: 0.5, metalness: 0.05, emissive: 0x2f7fff, emissiveIntensity: 0.55 });
  // a small car mid-print on the bed (the top rows still "growing")
  const carBody = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.03, 0.055, 2, 0.007), printMat);
  carBody.position.set(0, 0.138, printZ);
  g.add(carBody);
  const carCabin = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.018, 0.045, 2, 0.006), printMat);
  carCabin.position.set(-0.008, 0.157, printZ);
  g.add(carCabin);
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.35, metalness: 0.9 });
  // top X-gantry rail
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(chamberW - 0.04, 0.012, 0.018), railMat);
  crossbar.position.set(0, 0.34, printZ - 0.01);
  g.add(crossbar);
  // moving print head: carriage on the rail + Z-post + nozzle reaching down
  // to the print surface, with a hot-end glow at the tip (sweeps in X)
  const headGroup = new THREE.Group();
  const carriage = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.05, 2, 0.008), railMat);
  carriage.position.set(0, 0.335, printZ - 0.004);
  headGroup.add(carriage);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.4, metalness: 0.3 }));
  post.position.set(0, 0.265, printZ);
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
  g.add(headGroup);
  MODELS.printerHead = headGroup;
  const chamberLed = new THREE.Mesh(
    new THREE.BoxGeometry(chamberW - 0.04, 0.006, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xf2f6fc, emissive: 0xeef4ff, emissiveIntensity: 2.2 })
  );
  chamberLed.position.set(0, doorH - 0.02, D / 2 - 0.05);
  g.add(chamberLed);
  const inner = new THREE.PointLight(0xeaf2ff, 0.95, 1.25, 2);
  inner.position.set(0, doorH - 0.06, D / 2 - 0.16);
  g.add(inner);
  const inner2 = new THREE.PointLight(0xfff0e0, 0.5, 0.55, 2); // warm fill near the hot-end
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

  // top control band: touchscreen (left) + "Bambu H2S" wordmark
  const ui = document.createElement("canvas");
  ui.width = 96; ui.height = 64;
  const uctx = ui.getContext("2d");
  uctx.fillStyle = "#0c0f12"; uctx.fillRect(0, 0, 96, 64);
  uctx.fillStyle = "#8ce04a"; uctx.fillRect(8, 8, 34, 22);
  uctx.fillStyle = "#2a2f36"; uctx.fillRect(8, 40, 80, 8);
  uctx.fillStyle = "#8ce04a"; uctx.fillRect(8, 40, 52, 8);
  uctx.fillStyle = "#c9ced6"; uctx.font = "600 11px Arial"; uctx.fillText("66%", 66, 24);
  const uiTex = new THREE.CanvasTexture(ui);
  uiTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.05),
    new THREE.MeshBasicMaterial({ map: uiTex, color: 0x969696 }));
  screen.position.set(-W / 2 + 0.075, H - 0.065, frontZ + 0.009);
  g.add(screen);
  const wm = document.createElement("canvas");
  wm.width = 128; wm.height = 24;
  const wctx = wm.getContext("2d");
  wctx.fillStyle = "#1a1c20"; wctx.fillRect(0, 0, 128, 24);
  wctx.fillStyle = "#8a9099"; wctx.font = "600 13px Arial";
  wctx.fillText("Bambu  H2S", 30, 17);
  const wmTex = new THREE.CanvasTexture(wm);
  wmTex.colorSpace = THREE.SRGBColorSpace;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.0225), new THREE.MeshBasicMaterial({ map: wmTex, color: 0x9a9a9a }));
  mark.position.set(0.04, H - 0.06, frontZ + 0.009);
  g.add(mark);

  // Bambu Lab logo on the right side shell (two bars + wordmark)
  const lg = document.createElement("canvas");
  lg.width = 128; lg.height = 128;
  const lctx = lg.getContext("2d");
  lctx.fillStyle = "#b4b7bc"; lctx.fillRect(0, 0, 128, 128);
  lctx.fillStyle = "#17181c";
  lctx.fillRect(50, 22, 12, 40);
  lctx.fillRect(68, 30, 12, 32);
  lctx.font = "600 13px Arial"; lctx.textAlign = "center";
  lctx.fillText("Bambu Lab", 64, 88);
  const lgTex = new THREE.CanvasTexture(lg);
  lgTex.colorSpace = THREE.SRGBColorSpace;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: lgTex, color: 0x9a9a9a }));
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

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/* right-wall display cabinet layout (2 bays x 3 rows) */
const CAB2 = {
  x: 2.42, // cabinet center x (against the right wall)
  frontX: 2.4, // exhibit center x (centered on the glass boards)
  bays: [-0.75, -0.05], // z centers
  rows: [1.68, 1.2, 0.72],
  rowH: 0.48,
};

function buildSideCabinet() {
  // second display cabinet on the right wall — same modern language as the
  // main one: slim steel frame, tinted glass shelves, cool light strips
  const g = new THREE.Group();
  const W = 1.6; // along z
  const H = 2.2;
  const D = 0.5;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.45, metalness: 0.5, envMapIntensity: 0.5 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.45, metalness: 0.85 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.02, H, W),
    new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.7, metalness: 0.2 }));
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
    color: 0x31404f, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.3,
    envMapIntensity: 1.3, clearcoat: 0.5, clearcoatRoughness: 0.08,
  });
  CAB2.rows.forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(D - 0.08, 0.014, W - 0.08), glassMat);
    board.position.set(0, y - 0.007, 0);
    board.receiveShadow = true;
    g.add(board);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.016, W - 0.08), alu);
    edge.position.set(-D / 2 + 0.04, y - 0.007, 0);
    g.add(edge);
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.008, W - 0.14),
      new THREE.MeshStandardMaterial({ color: 0x6a7078, emissive: 0xbcd7ff, emissiveIntensity: 1.15 })
    );
    strip.position.set(-D / 2 + 0.1, y + CAB2.rowH - 0.055, 0);
    g.add(strip);
  });

  g.position.set(CAB2.x, 0, -0.4);
  return g;
}

function steelToolMat() {
  return new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.4 });
}

function buildDriverSeat() {
  // aluminum FSAE driver seat: bent-sheet pan + reclined back, side flanges
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0xb0b4ba, metalness: 0.9, roughness: 0.38, side: THREE.DoubleSide });
  const pan = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.012, 0.2, 2, 0.005), alu);
  pan.position.set(0, 0.05, 0.04);
  pan.rotation.x = -0.12;
  g.add(pan);
  const backr = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.3, 0.012, 2, 0.005), alu);
  backr.position.set(0, 0.19, -0.07);
  backr.rotation.x = 0.32;
  g.add(backr);
  [[-0.095], [0.095]].forEach(([x]) => {
    const flange = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.12, 0.16), alu);
    flange.position.set(x, 0.1, -0.02);
    flange.rotation.x = 0.25;
    g.add(flange);
  });
  // mounting rails
  [[-0.06], [0.06]].forEach(([x]) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.2), new THREE.MeshStandardMaterial({ color: 0x2c2f34, metalness: 0.8, roughness: 0.5 }));
    rail.position.set(x, 0.012, 0.03);
    g.add(rail);
  });
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildFtcBot() {
  // FTC robot: chassis, four mecanum wheels, vertical lift, claw, hub
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.5, metalness: 0.4 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.35, metalness: 0.9 });
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.02, 0.16, 2, 0.005), alu);
  chassis.position.y = 0.045;
  g.add(chassis);
  // mecanum wheels: cylinder + angled rollers
  [[-0.085, -0.07], [0.085, -0.07], [-0.085, 0.07], [0.085, 0.07]].forEach(([x, z]) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 16),
      new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.7 }));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.032, z);
    g.add(wheel);
    for (let r = 0; r < 5; r++) {
      const a = (r / 5) * Math.PI * 2;
      const roller = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.014, 3, 8),
        new THREE.MeshStandardMaterial({ color: 0x53565c, roughness: 0.6 }));
      roller.position.set(x + (x > 0 ? 0.011 : -0.011), 0.032 + Math.sin(a) * 0.026, z + Math.cos(a) * 0.026);
      roller.rotation.x = a + 0.8;
      g.add(roller);
    }
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
  [[-0.02, 0.25], [0.02, -0.25]].forEach(([x, rot]) => {
    const finger = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.05, 0.03), dark);
    finger.position.set(x, 0.185, -0.015);
    finger.rotation.z = rot;
    g.add(finger);
  });
  const hub = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.02, 0.05, 2, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x27408a, roughness: 0.45 }));
  hub.position.set(0.04, 0.065, 0.03);
  g.add(hub);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildToolChest() {
  // rolling tool chest: graphite body, five drawers with aluminum pulls
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0x212429, roughness: 0.42, metalness: 0.55 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.45, metalness: 0.85 });
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

function buildSkillPaper() {
  // second printed sheet on the desk: the skill matrix (hover shows the
  // live card built from RESUME.skills)
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 340;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f4f5f7";
  ctx.fillRect(0, 0, 256, 340);
  ctx.fillStyle = "#1a1a1c";
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText("SKILL MATRIX", 22, 42);
  ctx.strokeStyle = "#3f8cff";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(22, 58); ctx.lineTo(234, 58); ctx.stroke();
  RESUME.skills.forEach((s, i) => {
    const y = 92 + i * 42;
    ctx.fillStyle = "#3f8cff";
    ctx.fillRect(22, y - 11, 4, 14);
    ctx.fillStyle = "#232327";
    ctx.font = "700 13px Arial, sans-serif";
    ctx.fillText(s.group, 34, y);
    ctx.fillStyle = "#77777c";
    ctx.font = "500 10px Arial, sans-serif";
    ctx.fillText(s.items.join(" · "), 34, y + 15);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.21, 0.004, 0.28),
    new THREE.MeshStandardMaterial({ color: 0xe4e6ea, roughness: 0.96 })
  );
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  g.add(sheet);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.205, 0.273),
    new THREE.MeshStandardMaterial({ map: tex, color: 0xf1f3f6, roughness: 0.96 })
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0025;
  g.add(face);
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
  // A4-ish sheet lying flat on the desk with a printed resume header
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 340;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f4f5f7";
  ctx.fillRect(0, 0, 256, 340);
  ctx.fillStyle = "#1a1a1c";
  ctx.font = "700 30px Arial, sans-serif";
  ctx.fillText("KEFAN WU", 22, 46);
  ctx.font = "500 13px Arial, sans-serif";
  ctx.fillStyle = "#5a5a5e";
  ctx.fillText("Mechanical Lead — Olin Electric", 22, 70);
  ctx.fillText("Motorsports · MechE @ Olin '28", 22, 88);
  ctx.strokeStyle = "#3f8cff";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(22, 104); ctx.lineTo(234, 104); ctx.stroke();
  ctx.fillStyle = "#8d8d92";
  for (let y = 128; y < 320; y += 16) {
    const w = 150 + ((y * 37) % 62);
    ctx.fillRect(22, y, w, 4.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  // larger sheet so the resume reads as the hero object on the desk
  const sheet = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.004, 0.32),
    new THREE.MeshStandardMaterial({ color: 0xe4e6ea, roughness: 0.96 })
  );
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  g.add(sheet);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.234, 0.312),
    new THREE.MeshStandardMaterial({ map: tex, color: 0xf1f3f6, roughness: 0.96 })
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0025;
  g.add(face);
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
  return `
    <button class="exp-panel__close" data-close aria-label="Close">&times;</button>
    ${img ? `<div class="exp-panel__media"><img src="${img}" alt="" loading="lazy"></div>` : ""}
    <p class="exp-panel__kicker">${p.kicker || ""}</p>
    <h2 class="exp-panel__title">${p.title || ""}</h2>
    <p class="exp-panel__summary">${p.summary || ""}</p>
    ${hi ? `<h3 class="exp-panel__h3">Engineering signal</h3><ul class="exp-panel__list">${hi}</ul>` : ""}
    ${tools ? `<h3 class="exp-panel__h3">Tools and methods</h3><div class="exp-panel__chips">${tools}</div>` : ""}
    ${details}
    ${gallery ? `<h3 class="exp-panel__h3">Gallery</h3><div class="exp-panel__gallery">${gallery}</div>` : ""}
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
