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
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { HERO_PROJECTS, RESUME } from "./experience-data.js";

document.documentElement.classList.add("exp-js");

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
  bg: 0x0c0907,
  floorTint: 0x6b4f33,
  wallTint: 0x5a4636,
  woodTint: 0x8a6038,
  leather: 0x1d3427,
  brass: 0xb98b35,
};

/* ---------- shared texture sets ---------- */
let TEX = null;
let MAXA = 4;
function setupTextures(manager) {
  const loader = new THREE.TextureLoader(manager);
  const cache = {};
  const DEFS = {
    dark_wood: { rep: [2, 1], base: "textures/dark_wood/dark_wood", maps: ["diff_1k.jpg", "nor_gl_1k.jpg", "rough_1k.jpg"] },
    laminate_floor_02: { rep: [6, 6], base: "textures/laminate_floor_02/laminate_floor_02", maps: ["diff_1k.jpg", "nor_gl_1k.jpg", "rough_1k.jpg"] },
    painted_plaster_wall: { rep: [3, 2], base: "textures/painted_plaster_wall/painted_plaster_wall", maps: ["diff_1k.jpg", "nor_gl_1k.jpg", "rough_1k.jpg"] },
    carpet008: { rep: [1, 1], base: "textures/carpet008/Carpet008_1K-JPG", maps: ["Color.jpg", "NormalGL.jpg", "Roughness.jpg"] },
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
  new THREE.MeshStandardMaterial({ color: COL.brass, roughness: 0.28, metalness: 1.0 });

/* engineering materials for the merged assembly buckets (mesh name mat_*) */
const ASSEMBLY_MATS = {
  steel: () => new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 1.0, roughness: 0.45 }),
  brass: () => new THREE.MeshStandardMaterial({ color: 0xb98b35, metalness: 1.0, roughness: 0.3 }),
  dark: () => new THREE.MeshStandardMaterial({ color: 0x1a1c20, metalness: 0.55, roughness: 0.45 }),
  printed: () => new THREE.MeshStandardMaterial({ color: 0x2c3038, metalness: 0.12, roughness: 0.58 }),
  aero: () => new THREE.MeshStandardMaterial({ color: 0xd8dadc, metalness: 0.05, roughness: 0.42 }),
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
};

const MODELS = {};
const HOTSPOTS = [];

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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  MAXA = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 6, 16);

  const REST_POS = new THREE.Vector3(1.45, 1.35, 2.25);
  const REST_TARGET = new THREE.Vector3(0, 0.95, -0.3);
  const FLY_POS = new THREE.Vector3(2.3, 1.85, 3.2);

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
  controls.maxDistance = 4.4;
  controls.minPolarAngle = 0.42;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  controls.minAzimuthAngle = -Math.PI * 0.36;
  controls.maxAzimuthAngle = Math.PI * 0.36;
  controls.target.copy(REST_TARGET);
  controls.update();

  /* ---------- post: subtle bloom (AAA finish, restrained) ---------- */
  const rt = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    samples: 4,
    type: THREE.HalfFloatType,
  });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.1, // strength — whisper quiet
    0.35, // radius
    0.95 // threshold — only true emitters bloom (screens/paper stay crisp)
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- loading manager ---------- */
  const manager = new THREE.LoadingManager();
  let revealed = false;
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    revealScene();
    if (!prefersReducedMotion) startIntro();
  };
  manager.onLoad = doReveal;
  setTimeout(doReveal, 10000); // safety

  setupTextures(manager);

  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader(manager).load("hdri/wooden_lounge_1k.hdr", (tex) => {
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 0.32;
    tex.dispose();
    pmrem.dispose();
  });

  /* ---------- lighting ---------- */
  const hemi = new THREE.HemisphereLight(0x4a3520, 0x0a0705, 0.42);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe6c2, 1.0);
  key.position.set(2.6, 4.6, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
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
  const fill = new THREE.DirectionalLight(0xa8bfdd, 0.18);
  fill.position.set(-3, 2.2, 3);
  scene.add(fill);

  // banker's-lamp warm pool
  const lampLight = new THREE.PointLight(0xffb15a, 4.2, 3.0, 2);
  lampLight.position.set(-0.62, 0.95, -0.2);
  scene.add(lampLight);

  // display spots washing the cabinet
  [-0.7, 0, 0.7].forEach((x) => {
    const spot = new THREE.SpotLight(0xffd9a8, 3.2, 6, 0.46, 0.75, 1.6);
    spot.position.set(x, 2.55, 0.45);
    spot.target.position.set(x, 1.0, CAB.z);
    scene.add(spot);
    scene.add(spot.target);
  });

  /* ---------- room + rug ---------- */
  buildRoom(scene);

  const ct = TEX.loadPBR("carpet008");
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 2.1),
    new THREE.MeshStandardMaterial({
      color: 0x7a4a30,
      map: ct.map,
      normalMap: ct.normalMap,
      roughnessMap: ct.roughnessMap,
      roughness: 1.0,
      metalness: 0,
    })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0.35);
  rug.receiveShadow = true;
  scene.add(rug);

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

  /* ---------- loaders ---------- */
  const loader = new GLTFLoader(manager);
  const artLoader = new THREE.TextureLoader(manager);

  /* ---------- desk (procedural, PBR) + desk props ---------- */
  const DESK_TOP = 0.76;
  scene.add(buildDesk());

  loadModel(loader, scene, "models/pp/banker_lamp_green.glb", {
    name: "lamp", targetSize: 0.4, axis: "y", pos: [-0.58, DESK_TOP, -0.14], rotY: 0.3,
  });
  loadModel(loader, scene, "models/book_encyclopedia_set_01/book_encyclopedia_set_01.gltf", {
    name: "books", targetSize: 0.26, axis: "x", pos: [0.52, DESK_TOP, -0.08], rotY: -0.2,
  });
  // resume: the hero object on the desk — front and center, in the light
  placeRoot(buildResumePaper(), scene, {
    name: "resumePaper", action: "resume", label: "Résumé",
    // desk top 0.76 + leather inlay 0.012 — sit ON the leather, not inside it
    pos: [0.02, DESK_TOP + 0.013, 0.16], rotY: 0.12,
  });
  scene.add(buildMug(0.45, 0.05, DESK_TOP));

  /* ---------- display cabinet + exhibits (3 x 3) ---------- */
  scene.add(buildDisplayCabinet());

  // real SolidWorks assemblies (merged per-part STLs, material buckets)
  // hero row (middle, eye level): javelin / steering / brake
  const ASSEMBLIES = [
    { file: "seat",     key: "carbonSeat", label: "Carbon fiber seat", size: 0.3,  axis: "y", bay: 0, row: 0, rotY: 0.4 },
    { file: "aura",     key: "aura",       label: "AURA Swerve",       size: 0.34, axis: "y", bay: 1, row: 0, rotY: 0.35, rotZ: -Math.PI / 2 },
    { file: "scanner",  key: "scanner",    label: "3D scanner",        size: 0.38, axis: "x", bay: 2, row: 0, rotY: 0.35 },
    { file: "javelin",  key: "javelin",    label: "Javelin VTOL",      size: 0.44, axis: "x", bay: 0, row: 1, rotY: 0.6,
      matTweak: { aero: { color: 0x2e3136, roughness: 0.5 }, printed: { color: 0x1f2126 } } },
    { file: "steering", key: "steering",   label: "Mk.8 Steering",     size: 0.32, axis: "y", bay: 1, row: 1, rotY: 0.5 },
  ];
  ASSEMBLIES.forEach((a) =>
    loadAssembly(loader, scene, `models/real/${a.file}.glb`, {
      name: "ex_" + a.key, projectKey: a.key, label: a.label,
      targetSize: a.size, axis: a.axis, matTweak: a.matTweak,
      markerCap: CAB.rows[a.row] + (a.row === 0 ? 0.36 : 0.44), // top row: stay under the cabinet's top frame
      pos: [CAB.bays[a.bay], CAB.rows[a.row], CAB.frontZ], rotY: a.rotY, rotZ: a.rotZ,
    })
  );

  // procedural exhibits for projects without CAD exports
  placeRoot(buildBrakeRotor(), scene, {
    markerCap: CAB.rows[1] + 0.44, name: "ex_brakeSim", projectKey: "brakeSim", label: "FSAE Brake Sim",
    targetSize: 0.26, axis: "x", pos: [CAB.bays[2], CAB.rows[1], CAB.frontZ], rotX: -Math.PI / 2, rotY: 0.15,
  });
  placeRoot(buildLineFollower(), scene, {
    markerCap: CAB.rows[2] + 0.44, name: "ex_lineFollower", projectKey: "lineFollower", label: "LineFollower robot",
    targetSize: 0.3, axis: "x", pos: [CAB.bays[0], CAB.rows[2], CAB.frontZ], rotY: 0.45,
  });
  placeRoot(buildCfdDisplay(artLoader), scene, {
    markerCap: CAB.rows[2] + 0.44, name: "ex_ansysCfd", projectKey: "ansysCfd", label: "Agent-based CFD",
    targetSize: 0.34, axis: "x", pos: [CAB.bays[1], CAB.rows[2], CAB.frontZ], rotY: 0.25,
  });
  placeRoot(buildEducationKit(), scene, {
    markerCap: CAB.rows[2] + 0.44, name: "ex_education", projectKey: "education", label: "Guitar education kit",
    targetSize: 0.4, axis: "x", pos: [CAB.bays[2], CAB.rows[2], CAB.frontZ], rotY: 0.3,
  });

  /* ---------- side dressing ---------- */
  // right wall: filled bookshelf; left wall: the electronics workbench
  // (bench + Bambu H2S mid-print + PSU + soldering station + drivers +
  // multimeter + task lamp)
  scene.add(buildRealBookshelf(2.38, -Math.PI / 2, 67890));
  scene.add(buildWorkbench());

  loadModel(loader, scene, "models/pp/armchair.glb", {
    name: "chair", targetSize: 0.95, axis: "y", pos: [-0.2, 0, 1.05], rotY: Math.PI,
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    composer.setSize(w, h);
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
    startFlight(REST_POS, REST_TARGET, 1500);
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
    }

    // Bambu printer: printhead sweeps while "printing"
    if (!prefersReducedMotion && MODELS.printerHead) {
      const hx = Math.sin(t * 0.0032) * 0.16;
      MODELS.printerHead.position.x = hx;
      MODELS.printerHeadLed.position.x = hx;
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
  let downXY = null;
  const panelEl = document.getElementById("exp-panel");
  const backdropEl = document.getElementById("exp-backdrop");
  const labelEl = document.getElementById("exp-label");

  function setHover(root) {
    if (hovered === root) return;
    if (hovered) hovered.scale.setScalar(hovered.userData.hotspot.baseScale);
    hovered = root;
    if (hovered) {
      hovered.scale.setScalar(hovered.userData.hotspot.baseScale * 1.06);
      renderer.domElement.style.cursor = "pointer";
      if (labelEl) { labelEl.textContent = hovered.userData.hotspot.label; labelEl.hidden = false; }
    } else {
      renderer.domElement.style.cursor = "";
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
    setHover(null);
    const hs = root.userData.hotspot;
    const html =
      hs.action === "resume"
        ? resumeHTML(RESUME)
        : hs.key && window.projectData && window.projectData[hs.key]
          ? projectHTML(window.projectData[hs.key])
          : null;
    if (!html) return;

    const c = hs.center;
    const focusPos = new THREE.Vector3(c.x * 0.55, Math.max(c.y + 0.06, 0.98), c.z + 1.0);
    if (hs.action === "resume") focusPos.set(c.x + 0.28, c.y + 0.5, c.z + 0.75);
    const focusLook = c.clone();
    focusLook.x += 0.2;

    panelOpen = true;
    if (prefersReducedMotion) {
      camera.position.copy(focusPos);
      controls.target.copy(focusLook);
      controls.enabled = false;
      camera.lookAt(focusLook);
      openPanel(html);
    } else {
      startFlight(focusPos, focusLook, 850);
      setTimeout(() => openPanel(html), 550);
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
  function closePanel() {
    if (!panelOpen) return;
    panelOpen = false;
    document.documentElement.classList.remove("exp-panel-open");
    if (prefersReducedMotion) {
      camera.position.copy(REST_POS);
      controls.target.copy(REST_TARGET);
      controls.enabled = true;
      controls.update();
    } else {
      startFlight(REST_POS, REST_TARGET, 750);
    }
  }
  if (backdropEl) backdropEl.addEventListener("click", closePanel);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && panelOpen) closePanel(); });

  window.__exp = { THREE, scene, camera, renderer, controls, composer, bloom, lampLight, key, hemi, models: MODELS, hotspots: HOTSPOTS, openPanel };
  console.info(`[experience] real-assembly scene — ${HERO_PROJECTS.length} projects`);
}

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
  const ft = TEX.loadPBR("laminate_floor_02");
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({
      color: COL.floorTint,
      map: ft.map,
      normalMap: ft.normalMap,
      roughnessMap: ft.roughnessMap,
      roughness: 0.9,
      metalness: 0,
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
  const front = 2.0;
  const depth = front - back;

  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(2 * sideX, WALL_H), wallMat());
  backWall.position.set(0, WALL_H / 2, back);
  backWall.receiveShadow = true;
  scene.add(backWall);

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
      color: 0x3a2c20,
      map: wt.map,
      normalMap: wt.normalMap,
      roughness: 1.0,
      metalness: 0,
    })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_H, (front + back) / 2);
  scene.add(ceiling);

  // wainscot + rail
  const wainH = 0.95;
  const addWain = (w, x, z, rotY) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, wainH, 0.04), woodMaterial());
    panel.position.set(x, wainH / 2, z);
    panel.rotation.y = rotY;
    panel.receiveShadow = true;
    panel.castShadow = true;
    scene.add(panel);
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.05, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x5a3d1f, roughness: 0.6, metalness: 0.05 })
    );
    rail.position.set(x, wainH + 0.02, z);
    rail.rotation.y = rotY;
    scene.add(rail);
  };
  addWain(2 * sideX, 0, back + 0.03, 0);
  addWain(depth, -sideX + 0.03, (front + back) / 2, Math.PI / 2);
  addWain(depth, sideX - 0.03, (front + back) / 2, -Math.PI / 2);

  // crown molding + baseboards along the three walls
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x4a331c, roughness: 0.62, metalness: 0.04 });
  const addTrim = (w, x, z, rotY, y, h, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    scene.add(m);
  };
  // crown
  addTrim(2 * sideX, 0, back + 0.045, 0, WALL_H - 0.045, 0.09, 0.09);
  addTrim(depth, -sideX + 0.045, (front + back) / 2, Math.PI / 2, WALL_H - 0.045, 0.09, 0.09);
  addTrim(depth, sideX - 0.045, (front + back) / 2, -Math.PI / 2, WALL_H - 0.045, 0.09, 0.09);
  // baseboard
  addTrim(2 * sideX, 0, back + 0.028, 0, 0.05, 0.1, 0.055);
  addTrim(depth, -sideX + 0.028, (front + back) / 2, Math.PI / 2, 0.05, 0.1, 0.055);
  addTrim(depth, sideX - 0.028, (front + back) / 2, -Math.PI / 2, 0.05, 0.1, 0.055);

  // pendant lamp hanging over the desk
  const pendant = new THREE.Group();
  const cord = new THREE.Mesh(
    new THREE.CylinderGeometry(0.004, 0.004, WALL_H - 2.42, 8),
    new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.7 })
  );
  cord.position.y = 2.42 + (WALL_H - 2.42) / 2;
  pendant.add(cord);
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.17, 0.15, 28, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x1e3a2c,
      roughness: 0.35,
      metalness: 0.6,
      side: THREE.DoubleSide,
    })
  );
  shade.position.y = 2.42;
  shade.castShadow = true;
  pendant.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffd9a0, emissiveIntensity: 1.0 })
  );
  bulb.position.y = 2.37;
  pendant.add(bulb);
  const pendantLight = new THREE.PointLight(0xffd9a0, 2.2, 4.0, 2);
  pendantLight.position.y = 2.32;
  pendant.add(pendantLight);
  pendant.position.set(0.15, 0, 0.35);
  scene.add(pendant);
}

/* ============================================================
   desk (pedestal desk, PBR wood + leather + brass)
   ============================================================ */
function buildDesk() {
  const g = new THREE.Group();
  const topY = 0.76;
  const thk = 0.05;
  const W = 1.85;
  const D = 0.9;

  const top = new THREE.Mesh(new RoundedBoxGeometry(W, thk, D, 3, 0.014), woodMaterial(COL.woodTint, 0.62));
  top.position.set(0, topY - thk / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const inlay = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.24, 0.012, D - 0.2),
    new THREE.MeshStandardMaterial({ color: COL.leather, roughness: 0.66, metalness: 0.02 })
  );
  inlay.position.set(0, topY + 0.002, 0);
  inlay.receiveShadow = true;
  g.add(inlay);

  const trim = brassMat();
  const inW = W - 0.22;
  const inD = D - 0.18;
  [[0, inD / 2], [0, -inD / 2]].forEach(([x, z]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(inW, 0.006, 0.012), trim);
    bar.position.set(x, topY + 0.006, z);
    g.add(bar);
  });
  [[inW / 2, 0], [-inW / 2, 0]].forEach(([x, z]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, inD), trim);
    bar.position.set(x, topY + 0.006, z);
    g.add(bar);
  });

  const pedW = 0.46;
  const pedH = topY - thk;
  const pedD = D - 0.06;
  [-(W / 2 - pedW / 2 - 0.04), W / 2 - pedW / 2 - 0.04].forEach((px) => {
    const body = new THREE.Mesh(new RoundedBoxGeometry(pedW, pedH, pedD, 3, 0.012), woodMaterial(0x6e4a28, 0.7));
    body.position.set(px, pedH / 2, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const faceZ = pedD / 2 + 0.006;
    const n = 3;
    const margin = 0.045;
    const gap = 0.02;
    const dh = (pedH - 2 * margin - (n - 1) * gap) / n;
    for (let i = 0; i < n; i++) {
      const cy = margin + dh / 2 + i * (dh + gap);
      const front = new THREE.Mesh(new RoundedBoxGeometry(pedW - 0.09, dh, 0.024, 2, 0.007), woodMaterial(0x8a6038, 0.6));
      front.position.set(px, cy, faceZ);
      front.castShadow = true;
      g.add(front);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 10), brassMat());
      handle.rotation.z = Math.PI / 2;
      handle.position.set(px, cy, faceZ + 0.02);
      g.add(handle);
    }
  });

  const modesty = new THREE.Mesh(
    new RoundedBoxGeometry(W - 2 * pedW - 0.16, pedH - 0.2, 0.035, 2, 0.008),
    woodMaterial(0x6e4a28, 0.7)
  );
  modesty.position.set(0, pedH / 2 + 0.06, -(D / 2 - 0.07));
  modesty.castShadow = true;
  g.add(modesty);

  return g;
}

/* ============================================================
   display cabinet (wide, 3 bays x 3 rows, lit shelves)
   ============================================================ */
function buildDisplayCabinet() {
  const g = new THREE.Group();
  const W = 2.36;
  const H = 2.2;
  const D = 0.54;
  const z = CAB.z;
  const frameMat = woodMaterial(0x5e3f22, 0.62);
  const backMat = woodMaterial(0x3a2614, 0.8);

  // back panel
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.025), backMat);
  back.position.set(0, H / 2, z - D / 2 + 0.0125);
  back.receiveShadow = true;
  g.add(back);

  // outer frame: sides, top, base plinth
  [-W / 2 + 0.03, W / 2 - 0.03].forEach((x) => {
    const side = new THREE.Mesh(new RoundedBoxGeometry(0.06, H, D, 2, 0.01), frameMat);
    side.position.set(x, H / 2, z);
    side.castShadow = true;
    side.receiveShadow = true;
    g.add(side);
  });
  const top = new THREE.Mesh(new RoundedBoxGeometry(W + 0.06, 0.07, D + 0.05, 2, 0.012), frameMat);
  top.position.set(0, H - 0.035, z);
  top.castShadow = true;
  g.add(top);
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(W + 0.04, 0.14, D + 0.04, 2, 0.01), frameMat);
  plinth.position.set(0, 0.07, z);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  // interior dividers between bays
  [-0.365, 0.365].forEach((x) => {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.03, H - 0.2, D - 0.08), frameMat);
    div.position.set(x, (H - 0.2) / 2 + 0.12, z);
    div.castShadow = true;
    g.add(div);
  });

  // shelf boards at each row top-surface + brass rail + warm glow strip
  const shelfMat = woodMaterial(0x6e4a28, 0.55);
  CAB.rows.forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.035, D - 0.06), shelfMat);
    board.position.set(0, y - 0.0175, z);
    board.castShadow = true;
    board.receiveShadow = true;
    g.add(board);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, W - 0.14, 10), brassMat());
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, y + 0.004, z + D / 2 - 0.045);
    g.add(rail);
    // warm light strip under the shelf above (display-case glow)
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.16, 0.008, 0.014),
      new THREE.MeshStandardMaterial({
        color: 0x9a7040,
        emissive: 0xffc98a,
        emissiveIntensity: 0.55,
      })
    );
    strip.position.set(0, y + CAB.rowH - 0.055, z + D / 2 - 0.12);
    g.add(strip);
  });

  return g;
}

/* ============================================================
   props + exhibit builders
   ============================================================ */
function buildMug(x, z, topY) {
  // glazed ceramic mug: open body, visible inner wall, handle fused to the
  // side (the old torus floated apart from the body)
  const g = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x2b4a3a,
    roughness: 0.32,
    metalness: 0.0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
    side: THREE.DoubleSide,
  });
  const R = 0.036, H = 0.088;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.92, H, 28, 1, true), mat);
  wall.position.set(x, topY + H / 2, z);
  wall.castShadow = true;
  g.add(wall);
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.92, R * 0.92, 0.006, 28), mat);
  bottom.position.set(x, topY + 0.003, z);
  g.add(bottom);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.0022, 8, 28), mat);
  rim.rotation.x = Math.PI / 2;
  rim.position.set(x, topY + H, z);
  g.add(rim);
  const coffee = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.88, R * 0.88, 0.004, 28),
    new THREE.MeshStandardMaterial({ color: 0x170d07, roughness: 0.25 })
  );
  coffee.position.set(x, topY + H - 0.016, z);
  g.add(coffee);
  // handle: vertical ring half-sunk into the wall so it reads as one piece
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 12, 28), mat);
  handle.position.set(x + R + 0.008, topY + H / 2, z);
  handle.castShadow = true;
  g.add(handle);
  return g;
}

function makeInteractMarker() {
  // Genshin-style prompt: soft gold glow + diamond outline + white core
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const glow = ctx.createRadialGradient(s / 2, s / 2, 4, s / 2, s / 2, s / 2);
  glow.addColorStop(0, "rgba(255, 214, 140, 0.85)");
  glow.addColorStop(0.35, "rgba(255, 196, 110, 0.28)");
  glow.addColorStop(1, "rgba(255, 190, 100, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, s, s);
  ctx.save();
  ctx.translate(s / 2, s / 2);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = "rgba(255, 226, 170, 0.95)";
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
      // twill: tow direction alternates on the diagonal
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
   tiling texture can wrap the surface (scale = tiles per meter) */
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

/* seeded RNG so both bookcases look different but stable across loads */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildRealBookshelf(x, rotY, seed) {
  const g = new THREE.Group();
  const rnd = mulberry32(seed);
  const W = 1.7, H = 2.14, D = 0.3;
  const frameMat = woodMaterial(0x5e3f22, 0.66);
  const shelfYs = [0.14, 0.52, 0.9, 1.28, 1.66];
  const gapH = 0.38;

  // carcass: sides, top, back, plinth
  [-W / 2 + 0.025, W / 2 - 0.025].forEach((sx) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, H, D), frameMat);
    side.position.set(sx, H / 2, 0);
    side.castShadow = true; side.receiveShadow = true;
    g.add(side);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.06, D + 0.04), frameMat);
  top.position.set(0, H - 0.03, 0);
  top.castShadow = true;
  g.add(top);
  const backP = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.018), woodMaterial(0x3a2614, 0.85));
  backP.position.set(0, H / 2, -D / 2 + 0.009);
  backP.receiveShadow = true;
  g.add(backP);
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W, 0.14, D), frameMat);
  plinth.position.set(0, 0.07, 0);
  plinth.castShadow = true; plinth.receiveShadow = true;
  g.add(plinth);
  shelfYs.forEach((y) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.03, D - 0.03), frameMat);
    b.position.set(0, y - 0.015, 0);
    b.castShadow = true; b.receiveShadow = true;
    g.add(b);
  });

  // books: varied spines, occasional lean/gap/horizontal pile, merged
  const PALETTE = [0x6e2a22, 0x3a2c1a, 0x24402e, 0x2a3350, 0x5a4626, 0x50262e, 0x315046, 0x6e4020, 0x223244, 0x584838, 0x743d28, 0x2e2e38];
  const geos = [];
  const tint = new THREE.Color();
  function pushBook(geo, colHex, shade) {
    tint.setHex(colHex).multiplyScalar(shade);
    const n = geo.attributes.position.count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { cols[i * 3] = tint.r; cols[i * 3 + 1] = tint.g; cols[i * 3 + 2] = tint.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
    geos.push(geo);
  }
  shelfYs.forEach((shelfY) => {
    let bx = -W / 2 + 0.09;
    const endX = W / 2 - 0.09;
    while (bx < endX) {
      const r = rnd();
      if (r < 0.06) { bx += 0.03 + rnd() * 0.05; continue; } // gap
      if (r < 0.16 && endX - bx > 0.2) {
        // small horizontal pile
        let py = shelfY;
        const n = 2 + Math.floor(rnd() * 2);
        for (let i = 0; i < n; i++) {
          const bw = 0.16 + rnd() * 0.05, bh = 0.03 + rnd() * 0.012, bd = 0.2 + rnd() * 0.04;
          const geo = new THREE.BoxGeometry(bh, bw, bd); // spine up
          geo.rotateZ(Math.PI / 2);
          geo.translate(bx + bw / 2, py + bh / 2, (rnd() - 0.5) * 0.02);
          pushBook(geo, PALETTE[(rnd() * PALETTE.length) | 0], 0.85 + rnd() * 0.3);
          py += bh;
        }
        bx += 0.24;
        continue;
      }
      const bw = 0.022 + rnd() * 0.03;
      const bh = 0.22 + rnd() * (gapH - 0.26);
      const bd = 0.19 + rnd() * 0.05;
      const lean = rnd() < 0.08 ? (rnd() - 0.5) * 0.22 : 0;
      const geo = new THREE.BoxGeometry(bw, bh, bd);
      if (lean) geo.rotateZ(lean);
      geo.translate(bx + bw / 2, shelfY + bh / 2 + Math.abs(lean) * 0.02, (rnd() - 0.5) * 0.015);
      pushBook(geo, PALETTE[(rnd() * PALETTE.length) | 0], 0.8 + rnd() * 0.4);
      bx += bw + 0.0035;
    }
  });
  const books = new THREE.Mesh(
    mergeGeometries(geos, false),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 })
  );
  books.castShadow = true;
  books.receiveShadow = true;
  g.add(books);

  g.position.set(x, 0, -0.35);
  g.rotation.y = rotY;
  return g;
}

function buildWorkbench() {
  // electronics workbench along the left wall: pegboard, Bambu H2S mid-print,
  // programmable PSU, soldering station, screwdriver set, multimeter, task lamp
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.45, metalness: 0.8 });
  const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.2 });
  const TOP_Y = 0.78;

  // bench: butcher-block top on steel legs + lower shelf
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.95, 0.055, 0.64, 2, 0.01), woodMaterial(0x8a6236, 0.5));
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
  // spare filament spools on the lower shelf
  [[-0.55, 0x3f9e4f], [-0.38, 0x8a8f96]].forEach(([lx, col]) => {
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 24), new THREE.MeshStandardMaterial({ color: col, roughness: 0.6 }));
    sp.rotation.x = Math.PI / 2;
    sp.position.set(lx, 0.29, 0.02);
    sp.castShadow = true;
    g.add(sp);
  });

  // pegboard against the wall with a dot-grid texture
  const pb = document.createElement("canvas");
  pb.width = 256; pb.height = 128;
  const pctx = pb.getContext("2d");
  pctx.fillStyle = "#6e5133"; pctx.fillRect(0, 0, 256, 128);
  pctx.fillStyle = "#3f2d18";
  for (let py = 8; py < 128; py += 16)
    for (let px = 8; px < 256; px += 16) { pctx.beginPath(); pctx.arc(px, py, 2.6, 0, 7); pctx.fill(); }
  const pbTex = new THREE.CanvasTexture(pb);
  pbTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.95, 0.02),
    new THREE.MeshStandardMaterial({ map: pbTex, roughness: 0.85 })
  );
  board.position.set(0, TOP_Y + 0.62, -0.3);
  board.receiveShadow = true;
  g.add(board);
  // a couple of wrenches hanging on the pegboard
  const toolMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.4 });
  [[-0.45, -0.06], [-0.3, 0.12]].forEach(([wx, tilt]) => {
    const wr = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.008), toolMat);
    wr.position.set(wx, TOP_Y + 0.6, -0.285);
    wr.rotation.z = tilt;
    g.add(wr);
    const jaw = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.008, 12), toolMat);
    jaw.rotation.x = Math.PI / 2;
    jaw.position.set(wx - Math.sin(tilt) * 0.09, TOP_Y + 0.69, -0.285);
    g.add(jaw);
  });

  // the H2S, mid-print, angled slightly toward the room
  const printer = buildBambuPrinter();
  printer.scale.setScalar(0.82);
  printer.position.set(-0.52, TOP_Y, 0.02);
  printer.rotation.y = 0.12;
  g.add(printer);
  MODELS.printer = printer;

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
  [[-0.06, 0xcc3333], [-0.03, 0x111111], [0.0, 0xcc3333], [0.03, 0x111111]].forEach(([jx, col]) => {
    const jack = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 10),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }));
    jack.rotation.x = Math.PI / 2;
    jack.position.set(jx, 0.026, 0.088);
    psu.add(jack);
  });
  psu.position.set(0.24, TOP_Y, -0.14);
  psu.rotation.y = -0.08;
  g.add(psu);

  // soldering station + iron in its stand
  const solder = new THREE.Group();
  const sBody = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.075, 0.11, 2, 0.007), darkPlastic);
  sBody.position.y = 0.0375;
  solder.add(sBody);
  const sd = document.createElement("canvas");
  sd.width = 64; sd.height = 32;
  const sctx = sd.getContext("2d");
  sctx.fillStyle = "#080505"; sctx.fillRect(0, 0, 64, 32);
  sctx.fillStyle = "#ff5a3c"; sctx.font = "700 18px Consolas, monospace"; sctx.fillText("350°", 6, 23);
  const sdTex = new THREE.CanvasTexture(sd);
  sdTex.colorSpace = THREE.SRGBColorSpace;
  const sScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), new THREE.MeshBasicMaterial({ map: sdTex, color: 0x9a9a9a }));
  sScreen.position.set(-0.02, 0.05, 0.0565);
  solder.add(sScreen);
  const sKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.014, 16), steel);
  sKnob.rotation.x = Math.PI / 2;
  sKnob.position.set(0.035, 0.045, 0.057);
  solder.add(sKnob);
  // iron stand (cone holder) + iron
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.028, 0.06, 14, 1, true), steel);
  stand.rotation.z = 1.15;
  stand.position.set(0.1, 0.045, 0.02);
  solder.add(stand);
  const ironHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.09, 12),
    new THREE.MeshStandardMaterial({ color: 0x27408a, roughness: 0.5 }));
  ironHandle.rotation.z = 1.15;
  ironHandle.position.set(0.135, 0.062, 0.02);
  solder.add(ironHandle);
  const ironTip = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.004, 0.05, 8), toolMat);
  ironTip.rotation.z = 1.15;
  ironTip.position.set(0.07, 0.032, 0.02);
  solder.add(ironTip);
  solder.position.set(0.6, TOP_Y, -0.1);
  solder.rotation.y = 0.15;
  g.add(solder);

  // screwdriver set in a wooden stand
  const drivers = new THREE.Group();
  const block = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.032, 0.055, 2, 0.006), woodMaterial(0x9a713d, 0.55));
  block.position.y = 0.045;
  drivers.add(block);
  [[-0.06, 0xcc3333], [-0.036, 0x2255cc], [-0.012, 0x2a9944], [0.012, 0xe8b830], [0.036, 0x222222], [0.06, 0xd06018]].forEach(([dx, col], i) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.075, 8), toolMat);
    shaft.position.set(dx, 0.02, 0);
    drivers.add(shaft);
    const hdl = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0065, 0.045, 10),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.42 }));
    hdl.position.set(dx, 0.085 + (i % 2) * 0.004, 0);
    drivers.add(hdl);
  });
  drivers.position.set(0.42, TOP_Y, 0.16);
  drivers.rotation.y = -0.2;
  g.add(drivers);

  // multimeter lying on the bench
  const meter = new THREE.Group();
  const mBody = new THREE.Mesh(new RoundedBoxGeometry(0.082, 0.02, 0.15, 2, 0.007),
    new THREE.MeshStandardMaterial({ color: 0xd8a018, roughness: 0.55 }));
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
  meter.position.set(0.06, TOP_Y, 0.18);
  meter.rotation.y = 0.55;
  g.add(meter);

  // articulated task lamp lighting the bench
  const lamp = new THREE.Group();
  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 20), darkPlastic);
  lBase.position.y = 0.01;
  lamp.add(lBase);
  const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.24, 10), steel);
  arm1.rotation.z = 0.5;
  arm1.position.set(-0.055, 0.12, 0);
  lamp.add(arm1);
  const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 10), steel);
  arm2.rotation.z = -0.9;
  arm2.position.set(-0.19, 0.26, 0);
  lamp.add(arm2);
  const lHead = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.05, 0.07, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide }));
  lHead.rotation.z = 2.2;
  lHead.position.set(-0.27, 0.315, 0);
  lamp.add(lHead);
  const lBulb = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff2d8, emissive: 0xffe2b0, emissiveIntensity: 1.2 }));
  lBulb.position.set(-0.295, 0.295, 0);
  lamp.add(lBulb);
  const lLight = new THREE.PointLight(0xffe2b8, 1.8, 2.4, 2);
  lLight.position.set(-0.3, 0.28, 0);
  lamp.add(lLight);
  lamp.position.set(0.86, TOP_Y, -0.16);
  g.add(lamp);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // along the left wall, front facing the room
  g.position.set(-2.22, 0, -0.25);
  g.rotation.y = Math.PI / 2;
  return g;
}

function buildBambuPrinter() {
  // Bambu Lab H2S-style enclosed CoreXY printer, mid-print on a small car
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.42, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.55, metalness: 0.3 });
  const W = 0.62, H = 0.63, D = 0.6;

  // enclosure shell (open front), rounded corners
  const shell = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 3, 0.03), shellMat);
  shell.position.y = H / 2 + 0.02;
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);
  // feet
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.02, 12), darkMat);
    foot.position.set(sx * (W / 2 - 0.06), 0.01, sz * (D / 2 - 0.06));
    g.add(foot);
  });

  // interior cavity (dark) + glass front door
  const cavity = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.09, H - 0.14, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x08090b, roughness: 0.85 })
  );
  cavity.position.set(0, H / 2 + 0.03, D / 2 - 0.1);
  g.add(cavity);
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.12, H - 0.18),
    new THREE.MeshPhysicalMaterial({
      color: 0x2c343a,
      roughness: 0.08,
      metalness: 0,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    })
  );
  glass.position.set(0, H / 2 + 0.03, D / 2 + 0.011);
  g.add(glass);
  const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.016, 0.012), shellMat);
  doorFrame.position.set(0, H - 0.055, D / 2 + 0.008);
  g.add(doorFrame);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.012), darkMat);
  handle.position.set(0, 0.16, D / 2 + 0.016);
  g.add(handle);

  // build plate + half-printed car body + printhead gantry (inside, glimpsed
  // through the glass)
  const plate = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.008, D - 0.28), darkMat);
  plate.position.set(0, 0.16, D / 2 - 0.24);
  g.add(plate);
  const printMat = new THREE.MeshStandardMaterial({ color: 0x3f8cff, roughness: 0.55, metalness: 0.05 });
  const carBody = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.035, 0.06, 2, 0.008), printMat);
  carBody.position.set(0, 0.185, D / 2 - 0.24);
  g.add(carBody);
  const carCabin = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.024, 0.05, 2, 0.006), printMat);
  carCabin.position.set(-0.01, 0.213, D / 2 - 0.24);
  g.add(carCabin);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W - 0.16, 0.014, 0.02), darkMat);
  rail.position.set(0, 0.36, D / 2 - 0.26);
  g.add(rail);
  const head = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.07, 0.045, 2, 0.008), shellMat);
  head.position.set(0.05, 0.325, D / 2 - 0.25);
  g.add(head);
  const headLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.006, 0.004),
    new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff3344, emissiveIntensity: 1.2 })
  );
  headLed.position.set(0.05, 0.3, D / 2 - 0.227);
  g.add(headLed);
  MODELS.printerHead = head;
  MODELS.printerHeadLed = headLed;

  // interior work light
  const inner = new THREE.PointLight(0xdfe8ff, 0.9, 0.9, 2);
  inner.position.set(0, H - 0.14, D / 2 - 0.2);
  g.add(inner);

  // front touchscreen (Bambu UI: dark, green progress bar)
  const ui = document.createElement("canvas");
  ui.width = 128; ui.height = 64;
  const uctx = ui.getContext("2d");
  uctx.fillStyle = "#0c0f12"; uctx.fillRect(0, 0, 128, 64);
  uctx.fillStyle = "#8ce04a"; uctx.font = "700 15px Arial"; uctx.fillText("BAMBU", 10, 22);
  uctx.fillStyle = "#2a2f36"; uctx.fillRect(10, 36, 108, 9);
  uctx.fillStyle = "#8ce04a"; uctx.fillRect(10, 36, 71, 9);
  uctx.fillStyle = "#c9ced6"; uctx.font = "600 11px Arial"; uctx.fillText("66%  car_v3.gcode", 10, 58);
  const uiTex = new THREE.CanvasTexture(ui);
  uiTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.11, 0.055),
    new THREE.MeshBasicMaterial({ map: uiTex, color: 0x8f8f8f })
  );
  screen.position.set(W / 2 - 0.1, 0.1, D / 2 + 0.012);
  g.add(screen);

  // side-mounted filament spool (green)
  const spoolMat = new THREE.MeshStandardMaterial({ color: 0xdadde2, roughness: 0.5, metalness: 0.1 });
  const spool = new THREE.Group();
  [-0.026, 0.026].forEach((dy) => {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 28), spoolMat);
    flange.rotation.z = Math.PI / 2;
    flange.position.x = dy;
    spool.add(flange);
  });
  const filament = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.062, 0.046, 28),
    new THREE.MeshStandardMaterial({ color: 0x3f9e4f, roughness: 0.6 })
  );
  filament.rotation.z = Math.PI / 2;
  spool.add(filament);
  spool.position.set(-W / 2 - 0.035, H * 0.62, -0.05);
  g.add(spool);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildResumePaper() {
  // A4-ish sheet lying flat on the desk with a printed resume header
  const g = new THREE.Group();
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 340;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#f2ecdd";
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
    new THREE.MeshStandardMaterial({ color: 0xd6cfbc, roughness: 0.96 })
  );
  sheet.castShadow = true;
  sheet.receiveShadow = true;
  g.add(sheet);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.234, 0.312),
    new THREE.MeshStandardMaterial({ map: tex, color: 0xdcd5c2, roughness: 0.96 })
  );
  face.rotation.x = -Math.PI / 2;
  face.position.y = 0.0025;
  g.add(face);
  return g;
}

function buildLineFollower() {
  // compact line-follower: chassis plate, Arduino Mega with headers, two
  // micro gearmotors with hubbed wheels, front caster, 8-sensor IR bar,
  // battery with strap, brass standoffs
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.9, roughness: 0.35 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc9a24b, metalness: 0.9, roughness: 0.35 });
  const blackPl = new THREE.MeshStandardMaterial({ color: 0x121317, roughness: 0.5, metalness: 0.15 });

  // chassis plate (matte black acrylic)
  const deck = new THREE.Mesh(
    new RoundedBoxGeometry(0.21, 0.006, 0.13, 2, 0.003),
    new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.35, metalness: 0.1 })
  );
  deck.position.y = 0.032;
  g.add(deck);

  // Arduino Mega: blue PCB, black header rows, silver USB, gold pads
  const pcb = new THREE.Mesh(new THREE.BoxGeometry(0.096, 0.004, 0.05),
    new THREE.MeshStandardMaterial({ color: 0x1a4f8a, roughness: 0.4, metalness: 0.2 }));
  pcb.position.set(-0.03, 0.04, 0);
  g.add(pcb);
  [-0.02, 0.02].forEach((dz) => {
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.007, 0.006), blackPl);
    header.position.set(-0.03, 0.045, dz);
    g.add(header);
  });
  const usb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008, 0.012), silver);
  usb.position.set(-0.072, 0.046, -0.012);
  g.add(usb);
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.003, 0.014), blackPl);
  chip.position.set(-0.02, 0.043, 0);
  g.add(chip);

  // brass standoffs
  [[-0.07, -0.022], [-0.07, 0.022], [0.01, -0.022], [0.01, 0.022]].forEach(([sx, sz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.008, 8), gold);
    post.position.set(sx, 0.037, sz);
    g.add(post);
  });

  // battery + strap
  const batt = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.018, 0.032, 2, 0.004), blackPl);
  batt.position.set(0.055, 0.045, 0.02);
  g.add(batt);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.02, 0.008),
    new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.7 }));
  strap.position.set(0.055, 0.045, 0.02);
  g.add(strap);

  // micro gearmotors (silver body + gold gearbox) + hubbed wheels
  [-0.0755, 0.0755].forEach((z) => {
    const side = Math.sign(z);
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.024, 12), silver);
    motor.rotation.x = Math.PI / 2;
    motor.position.set(-0.055, 0.026, z - side * 0.035);
    g.add(motor);
    const gearbox = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.012), gold);
    gearbox.position.set(-0.055, 0.026, z - side * 0.018);
    g.add(gearbox);
    // tire + hub + spokes
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.0245, 0.0075, 12, 26),
      new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.92 }));
    tire.position.set(-0.055, 0.03, z);
    g.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.009, 18),
      new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.35, metalness: 0.3 }));
    hub.rotation.x = Math.PI / 2;
    hub.position.set(-0.055, 0.03, z);
    g.add(hub);
    for (let s = 0; s < 5; s++) {
      const a = (s / 5) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.001, 0.014), blackPl);
      spoke.position.set(-0.055 + Math.cos(a) * 0.009, 0.03 + Math.sin(a) * 0.009, z + side * 0.005);
      spoke.rotation.z = a;
      g.add(spoke);
    }
  });

  // front caster (bracket + ball)
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.012, 0.016), silver);
  bracket.position.set(0.085, 0.024, 0);
  g.add(bracket);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0xd8dadc, metalness: 0.85, roughness: 0.25 }));
  ball.position.set(0.085, 0.012, 0);
  g.add(ball);

  // 8-sensor IR bar on standoffs ahead of the chassis
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.105), blackPl);
  bar.position.set(0.1, 0.03, 0);
  g.add(bar);
  [[-0.012, 0.012]].forEach(() => {});
  for (let i = 0; i < 8; i++) {
    const zz = -0.044 + i * 0.0126;
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.004, 8),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0x2a2c33 : 0xd8e2ea, roughness: 0.4 }));
    emitter.position.set(0.1, 0.026, zz);
    g.add(emitter);
  }
  [[0.094, -0.048], [0.094, 0.048]].forEach(([sx, sz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.01, 8), gold);
    post.position.set(sx, 0.032, sz);
    g.add(post);
  });

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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

function buildEducationKit() {
  // guitar-teaching kit: felt-lined case with divided compartments, a mini
  // strung guitar, detached fretted neck, and labeled small parts
  const g = new THREE.Group();
  const caseMat = woodMaterial(0x8a6844, 0.55);
  const feltMat = new THREE.MeshStandardMaterial({ color: 0x28323e, roughness: 0.98 });
  const metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, metalness: 0.9, roughness: 0.3 });
  const W = 0.4, D = 0.28, wall = 0.012, hWall = 0.042;

  // case shell + felt floor
  const bottom = new THREE.Mesh(new RoundedBoxGeometry(W, 0.014, D, 2, 0.004), caseMat);
  bottom.position.y = 0.007;
  g.add(bottom);
  const felt = new THREE.Mesh(new THREE.BoxGeometry(W - 0.03, 0.003, D - 0.03), feltMat);
  felt.position.y = 0.0155;
  g.add(felt);
  [[0, D / 2 - wall / 2], [0, -(D / 2 - wall / 2)]].forEach(([x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(W, hWall, wall), caseMat);
    m.position.set(x, hWall / 2 + 0.007, z);
    g.add(m);
  });
  [[W / 2 - wall / 2, 0], [-(W / 2 - wall / 2), 0]].forEach(([x, z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(wall, hWall, D - 2 * wall), caseMat);
    m.position.set(x, hWall / 2 + 0.007, z);
    g.add(m);
  });
  // interior dividers: guitar bay | neck bay | parts bays
  const div1 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.03, D - 2 * wall), caseMat);
  div1.position.set(0.015, 0.022, 0);
  g.add(div1);
  const div2 = new THREE.Mesh(new THREE.BoxGeometry(W / 2 - 0.03, 0.03, 0.008), caseMat);
  div2.position.set(0.105, 0.022, 0.0);
  g.add(div2);

  // mini strung guitar in the left bay
  const guitar = new THREE.Group();
  const body = new THREE.Shape();
  body.moveTo(0, -0.07);
  body.bezierCurveTo(0.042, -0.07, 0.05, -0.038, 0.046, -0.008);
  body.bezierCurveTo(0.043, 0.016, 0.032, 0.024, 0.03, 0.042);
  body.bezierCurveTo(0.027, 0.064, 0.014, 0.074, 0, 0.074);
  body.bezierCurveTo(-0.014, 0.074, -0.027, 0.064, -0.03, 0.042);
  body.bezierCurveTo(-0.032, 0.024, -0.043, 0.016, -0.046, -0.008);
  body.bezierCurveTo(-0.05, -0.038, -0.042, -0.07, 0, -0.07);
  const bodyMesh = new THREE.Mesh(
    new THREE.ExtrudeGeometry(body, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2 }),
    new THREE.MeshPhysicalMaterial({ color: 0xc98f3f, roughness: 0.3, metalness: 0.04, clearcoat: 0.75, clearcoatRoughness: 0.15 })
  );
  bodyMesh.rotation.x = -Math.PI / 2;
  guitar.add(bodyMesh);
  const pick = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.4 }));
  pick.position.set(0, 0.024, 0.006);
  guitar.add(pick);
  const gBridge = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.005, 0.008), metal);
  gBridge.position.set(0, 0.024, 0.045);
  guitar.add(gBridge);
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.00045, 0.00045, 0.115, 4), metal);
    s.rotation.x = Math.PI / 2;
    s.position.set(-0.0075 + i * 0.005, 0.0255, -0.012);
    guitar.add(s);
  }
  guitar.position.set(-0.1, 0.017, 0.0);
  guitar.rotation.y = 0.12;
  g.add(guitar);

  // detached neck with fret wires (top-right bay)
  const neckG = new THREE.Group();
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.026),
    new THREE.MeshStandardMaterial({ color: 0xa8763c, roughness: 0.55 }));
  neckG.add(neck);
  const fb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.003, 0.024),
    new THREE.MeshStandardMaterial({ color: 0x3a2614, roughness: 0.6 }));
  fb.position.y = 0.0065;
  neckG.add(fb);
  for (let i = 0; i < 9; i++) {
    const fret = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0015, 0.024), metal);
    fret.position.set(-0.07 + i * 0.016 + i * i * 0.0004, 0.008, 0);
    neckG.add(fret);
  }
  neckG.position.set(0.105, 0.02, -0.075);
  neckG.rotation.y = -0.06;
  g.add(neckG);

  // parts bays: string packets, winder, mini screwdriver, tuner pegs
  [[0.05, 0.06, 0xd8b25a], [0.075, 0.075, 0xc9c9cf]].forEach(([px, pz, col]) => {
    const packet = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.002, 0.034),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.7 }));
    packet.position.set(px, 0.018, pz);
    packet.rotation.y = 0.3 + px;
    g.add(packet);
  });
  const winder = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0x3f9e4f, roughness: 0.55 }));
  winder.rotation.x = -Math.PI / 2;
  winder.position.set(0.16, 0.02, 0.06);
  g.add(winder);
  const sdShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.05, 8), metal);
  sdShaft.rotation.z = Math.PI / 2;
  sdShaft.rotation.y = 0.4;
  sdShaft.position.set(0.13, 0.019, 0.028);
  g.add(sdShaft);
  const sdHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.005, 0.026, 10),
    new THREE.MeshStandardMaterial({ color: 0xcc3333, roughness: 0.45 }));
  sdHandle.rotation.z = Math.PI / 2;
  sdHandle.rotation.y = 0.4;
  sdHandle.position.set(0.164, 0.019, 0.013);
  g.add(sdHandle);
  for (let i = 0; i < 3; i++) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.016, 8), metal);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(0.045 + i * 0.014, 0.018, -0.06);
    g.add(peg);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.5 }));
    head.position.set(0.045 + i * 0.014, 0.018, -0.069);
    g.add(head);
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function makeThermalTexture() {
  const s = 512;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, "#3a3a40");
  g.addColorStop(0.34, "#2c2c30");
  g.addColorStop(0.5, "#7a1500");
  g.addColorStop(0.66, "#ff5a00");
  g.addColorStop(0.82, "#ffc23a");
  g.addColorStop(0.93, "#ff6a12");
  g.addColorStop(1.0, "#7a1500");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  ctx.strokeStyle = "rgba(10,6,4,0.9)";
  ctx.lineWidth = 10;
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(s / 2 + Math.cos(a) * s * 0.3, s / 2 + Math.sin(a) * s * 0.3);
    ctx.lineTo(s / 2 + Math.cos(a) * s * 0.46, s / 2 + Math.sin(a) * s * 0.46);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBrakeRotor() {
  const g = new THREE.Group();
  const tex = makeThermalTexture();
  const rotorMat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.45,
    metalness: 0.55,
    roughness: 0.5,
  });
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.016, 60), rotorMat);
  g.add(rotor);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.9, roughness: 0.35 });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 28), hubMat);
  g.add(hub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.034, 8), hubMat);
    bolt.position.set(Math.cos(a) * 0.022, 0, Math.sin(a) * 0.022);
    g.add(bolt);
  }
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
  const hi = (p.highlights || []).slice(0, 5).map((h) => `<li>${h}</li>`).join("");
  const tools = (p.tools || []).map((t) => `<span class="exp-chip">${t}</span>`).join("");
  const img = (p.gallery && p.gallery[0] && p.gallery[0].src) || p.image || "";
  return `
    <button class="exp-panel__close" data-close aria-label="Close">&times;</button>
    ${img ? `<div class="exp-panel__media"><img src="${img}" alt="" loading="lazy"></div>` : ""}
    <p class="exp-panel__kicker">${p.kicker || ""}</p>
    <h2 class="exp-panel__title">${p.title || ""}</h2>
    <p class="exp-panel__summary">${p.summary || ""}</p>
    ${hi ? `<h3 class="exp-panel__h3">Engineering signal</h3><ul class="exp-panel__list">${hi}</ul>` : ""}
    ${tools ? `<h3 class="exp-panel__h3">Tools &amp; methods</h3><div class="exp-panel__chips">${tools}</div>` : ""}
    <a class="exp-panel__more" href="index.html#work">Full case study on the classic site &rarr;</a>
  `;
}

function resumeHTML(r) {
  const hi = (r.highlights || []).map((h) => `<li>${h}</li>`).join("");
  const skills = (r.skills || [])
    .map((s) => `<div class="exp-skill"><span class="exp-skill__g">${s.group}</span><span class="exp-skill__i">${s.items.join(" · ")}</span></div>`)
    .join("");
  const contact = (r.contact || [])
    .map((c) => `<a href="${c.href}"${c.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}>${c.label}</a>`)
    .join("");
  return `
    <button class="exp-panel__close" data-close aria-label="Close">&times;</button>
    <p class="exp-panel__kicker">Résumé</p>
    <h2 class="exp-panel__title">${r.name}</h2>
    <p class="exp-panel__role">${r.role}<br /><span>${r.meta}</span></p>
    <p class="exp-panel__summary">${r.summary}</p>
    <ul class="exp-panel__list">${hi}</ul>
    <h3 class="exp-panel__h3">Skills</h3>
    <div class="exp-skills">${skills}</div>
    <h3 class="exp-panel__h3">Contact</h3>
    <div class="exp-panel__contact">${contact}</div>
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
