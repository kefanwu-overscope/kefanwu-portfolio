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
  bg: 0x0b0c0e, // matches the main site's near-black
  floorTint: 0x74777c, // polished concrete
  wallTint: 0x9a9da3, // light graphite plaster
  woodTint: 0x4a3527, // dark walnut furniture
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
  new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.3, metalness: 1.0 });

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
  renderer.toneMappingExposure = 1.45;
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
    scene.environmentIntensity = 0.34;
    tex.dispose();
    pmrem.dispose();
  });

  /* ---------- lighting ---------- */
  const hemi = new THREE.HemisphereLight(0x4a505a, 0x101114, 0.7);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xeef2f8, 1.35);
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
  const lampLight = new THREE.PointLight(0xffc27a, 3.6, 2.8, 2);
  lampLight.position.set(-0.62, 0.95, -0.2);
  scene.add(lampLight);

  // display spots washing the cabinet
  [-0.7, 0, 0.7].forEach((x) => {
    const spot = new THREE.SpotLight(0xe8ecf4, 3.0, 6, 0.46, 0.75, 1.6);
    spot.position.set(x, 2.55, 0.45);
    spot.target.position.set(x, 1.0, CAB.z);
    scene.add(spot);
    scene.add(spot.target);
  });

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
    { file: "aura",     key: "aura",       label: "AURA Swerve",       size: 0.29, axis: "y", bay: 1, row: 0, rotY: 0.35, rotZ: -Math.PI / 2 },
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

  const chair = buildErgoChair();
  chair.position.set(-0.25, 0, 1.05);
  chair.rotation.y = Math.PI - 0.25;
  scene.add(chair);
  MODELS.chair = chair;
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
      // hard-clamp the camera inside the room shell so no orbit/zoom
      // combination can ever peek past a wall
      const cp = camera.position;
      cp.x = Math.max(-2.35, Math.min(2.35, cp.x));
      cp.z = Math.max(-1.25, Math.min(3.35, cp.z));
      cp.y = Math.max(0.4, Math.min(3.15, cp.y));
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
  // graphite engineering office: sealed-concrete floor, dark plaster walls
  // with a steel lower band, fully enclosed (incl. front wall) so no camera
  // angle can ever see past the set
  const ft = TEX.loadPBR("painted_plaster_wall");
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshStandardMaterial({
      color: COL.floorTint,
      map: ft.map,
      normalMap: ft.normalMap,
      roughnessMap: ft.roughnessMap,
      roughness: 0.55,
      metalness: 0.05,
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
      color: 0x3a3d42,
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
  const pendantLight = new THREE.PointLight(0xe8eef8, 2.0, 4.0, 2);
  pendantLight.position.y = 2.32;
  pendant.add(pendantLight);
  pendant.position.set(0.15, 0, 0.35);
  scene.add(pendant);
}

function buildDesk() {
  // modern executive desk: walnut slab on slim steel panel legs, dark desk
  // mat, one slim drawer unit with aluminum bar pulls
  const g = new THREE.Group();
  const topY = 0.76;
  const thk = 0.045;
  const W = 1.85;
  const D = 0.9;
  const steelPanel = new THREE.MeshStandardMaterial({ color: 0x26282c, roughness: 0.42, metalness: 0.7 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.3, metalness: 1.0 });

  const top = new THREE.Mesh(new RoundedBoxGeometry(W, thk, D, 3, 0.008), woodMaterial(0x3f2e22, 0.42));
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
  [-(W / 2 - 0.09), W / 2 - 0.09].forEach((px) => {
    const panel = new THREE.Mesh(new RoundedBoxGeometry(0.035, topY - thk, D - 0.12, 2, 0.006), steelPanel);
    panel.position.set(px, (topY - thk) / 2, 0);
    panel.castShadow = true;
    panel.receiveShadow = true;
    g.add(panel);
  });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(W - 0.3, 0.06, 0.025), steelPanel);
  beam.position.set(0, 0.18, -(D / 2 - 0.1));
  g.add(beam);

  // slim under-top drawer unit (right side) with aluminum bar pulls
  const unit = new THREE.Mesh(new RoundedBoxGeometry(0.52, 0.16, D - 0.2, 2, 0.008), woodMaterial(0x33261c, 0.5));
  unit.position.set(W / 2 - 0.35, topY - thk - 0.08, 0);
  unit.castShadow = true;
  g.add(unit);
  [-0.13, 0.13].forEach((dx) => {
    const front = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.13, 0.014, 2, 0.005), woodMaterial(0x3f2e22, 0.45));
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
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1d1f23, roughness: 0.4, metalness: 0.65 });
  const alu = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.3, metalness: 1.0 });

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
  const accent = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.2, 0.006, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x14314f, emissive: 0x3f8cff, emissiveIntensity: 0.9 })
  );
  accent.position.set(0, 0.105, z + D / 2 + 0.005);
  g.add(accent);

  // thin steel dividers between bays
  [-0.365, 0.365].forEach((x) => {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.014, H - 0.15, D - 0.1), frameMat);
    div.position.set(x, (H - 0.15) / 2 + 0.1, z);
    div.castShadow = true;
    g.add(div);
  });

  // tinted glass shelves with aluminum front edge + cool light strips
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c343c,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.4,
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
      new THREE.MeshStandardMaterial({ color: 0x6a7078, emissive: 0xdfe8f4, emissiveIntensity: 0.5 })
    );
    strip.position.set(0, y + CAB.rowH - 0.055, z + D / 2 - 0.12);
    g.add(strip);
  });

  return g;
}

function buildErgoChair() {
  // ergonomic task chair: 5-star caster base, gas lift, contoured seat,
  // mesh back with lumbar, armrests, headrest
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0x8f959d, roughness: 0.35, metalness: 0.9 });
  const blackPl = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.55, metalness: 0.2 });
  const mesh = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.92, metalness: 0.02 });

  // 5-star base + casters
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.024, 0.3, 2, 0.008), alu);
    arm.position.set(Math.sin(a) * 0.14, 0.05, Math.cos(a) * 0.14);
    arm.rotation.y = a;
    arm.castShadow = true;
    g.add(arm);
    const fork = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.03), blackPl);
    fork.position.set(Math.sin(a) * 0.27, 0.035, Math.cos(a) * 0.27);
    g.add(fork);
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.02, 14), blackPl);
    caster.rotation.z = Math.PI / 2;
    caster.rotation.y = a;
    caster.position.set(Math.sin(a) * 0.27, 0.026, Math.cos(a) * 0.27);
    caster.castShadow = true;
    g.add(caster);
  }
  // gas lift
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.3, 16), alu);
  lift.position.y = 0.2;
  g.add(lift);
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.12, 16), blackPl);
  boot.position.y = 0.14;
  g.add(boot);

  // seat
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.075, 0.44, 3, 0.025), mesh);
  seat.position.y = 0.42;
  seat.castShadow = true;
  seat.receiveShadow = true;
  g.add(seat);

  // back frame + mesh back + lumbar
  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.3, 0.03, 2, 0.01), blackPl);
  spine.position.set(0, 0.52, -0.25);
  spine.rotation.x = 0.18;
  g.add(spine);
  const backRest = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.56, 0.05, 3, 0.02), mesh);
  backRest.position.set(0, 0.78, -0.27);
  backRest.rotation.x = 0.12;
  backRest.castShadow = true;
  g.add(backRest);
  const lumbar = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.12, 0.03, 2, 0.012), blackPl);
  lumbar.position.set(0, 0.6, -0.245);
  lumbar.rotation.x = 0.12;
  g.add(lumbar);
  // headrest
  const hrPost = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.02), blackPl);
  hrPost.position.set(0, 1.09, -0.31);
  hrPost.rotation.x = 0.12;
  g.add(hrPost);
  const headrest = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.12, 0.05, 2, 0.02), mesh);
  headrest.position.set(0, 1.17, -0.32);
  headrest.rotation.x = 0.2;
  headrest.castShadow = true;
  g.add(headrest);

  // armrests
  [-0.26, 0.26].forEach((x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.16, 0.05), blackPl);
    post.position.set(x, 0.51, -0.02);
    g.add(post);
    const pad = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.02, 0.22, 2, 0.008), blackPl);
    pad.position.set(x, 0.6, 0.0);
    pad.castShadow = true;
    g.add(pad);
  });

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

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
  const frameMat = woodMaterial(0x261c14, 0.6);
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
  const backP = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.018), woodMaterial(0x17120d, 0.9));
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
  // electronics workbench, left wall: pegboard with real MechE tools,
  // H2S printing on the left, instruments clustered right, and the middle
  // of the bench deliberately left CLEAR for a future project
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.45, metalness: 0.8 });
  const darkPlastic = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, metalness: 0.2 });
  const toolSteel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.4 });
  const TOP_Y = 0.78;

  // bench: butcher-block top on steel legs + lower shelf
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.95, 0.055, 0.64, 2, 0.01), woodMaterial(0x6e4e2c, 0.5));
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
    [-0.62, 0.05, 0x3f9e4f],
    [-0.44, -0.1, 0x8a8f96],
    [-0.26, 0.08, 0x17181c],
    [0.42, -0.05, 0xd06018],
  ].forEach(([sx, sz, col]) => {
    const sp = makeSpool(col);
    sp.position.set(sx, 0.247, sz);
    g.add(sp);
  });
  const spTop = makeSpool(0x2255cc);
  spTop.position.set(-0.62, 0.312, 0.05); // stacked on the green one
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
    new THREE.MeshStandardMaterial({ color: 0xc23c2e, roughness: 0.45 }));
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
    new THREE.MeshStandardMaterial({ color: 0xc23c2e, roughness: 0.5 }));
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
  const hHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.2, 10), woodMaterial(0x8a6236, 0.55));
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

  // flush cutters (red handles)
  const cutL = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.006, 0.075, 10),
    new THREE.MeshStandardMaterial({ color: 0xc23c2e, roughness: 0.5 }));
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
    new THREE.MeshStandardMaterial({ color: 0xd8a018, roughness: 0.5 }));
  tape.add(tBody);
  const tClip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.036), toolSteel);
  tClip.position.set(-0.032, 0, 0);
  tape.add(tClip);
  tape.position.set(0.68, TOP_Y + 0.52, bz + 0.018);
  g.add(tape);

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
  [[-0.06, 0xcc3333], [-0.03, 0x111111], [0.0, 0xcc3333], [0.03, 0x111111]].forEach(([jx, col]) => {
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
  [[-0.06, 0xcc3333], [-0.036, 0x2255cc], [-0.012, 0x2a9944], [0.012, 0xe8b830], [0.036, 0x222222], [0.06, 0xd06018]].forEach(([dx, col], i) => {
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
  meter.position.set(0.24, TOP_Y, 0.16);
  meter.rotation.y = 0.5;
  g.add(meter);

  // articulated task lamp — segments computed so every joint CONNECTS
  const lamp = new THREE.Group();
  const lampMetal = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.4, metalness: 0.6 });
  function segment(p0, p1, r) {
    const dir = new THREE.Vector3().subVectors(p1, p0);
    const len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), lampMetal);
    mesh.position.copy(p0).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return mesh;
  }
  const P0 = new THREE.Vector3(0, 0.02, 0);
  const P1 = new THREE.Vector3(-0.1, 0.24, 0);
  const P2 = new THREE.Vector3(-0.26, 0.3, 0.03);
  const lBase = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 20), darkPlastic);
  lBase.position.y = 0.01;
  lamp.add(lBase);
  lamp.add(segment(P0, P1, 0.007));
  lamp.add(segment(P1, P2, 0.006));
  [P0, P1].forEach((pt) => {
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 12), lampMetal);
    joint.position.copy(pt);
    lamp.add(joint);
  });
  const lHead = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.048, 0.07, 18, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.4, metalness: 0.6, side: THREE.DoubleSide })
  );
  lHead.position.copy(P2);
  lHead.rotation.z = 2.35;
  lamp.add(lHead);
  const lBulb = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xffe8c2, emissiveIntensity: 1.1 }));
  lBulb.position.set(P2.x - 0.022, P2.y - 0.022, P2.z);
  lamp.add(lBulb);
  const lLight = new THREE.PointLight(0xffe8c8, 1.7, 2.4, 2);
  lLight.position.set(P2.x - 0.03, P2.y - 0.03, P2.z);
  lamp.add(lLight);
  lamp.position.set(0.9, TOP_Y, -0.2);
  lamp.rotation.y = -0.5;
  g.add(lamp);

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.position.set(-2.22, 0, -0.25);
  g.rotation.y = Math.PI / 2;
  return g;
}

function makeSpool(filColor) {
  // realistic filament spool: translucent flanges, hollow hub, wound filament
  const g = new THREE.Group();
  const flangeMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8dce2,
    roughness: 0.25,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  [-0.028, 0.028].forEach((dy) => {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.004, 32), flangeMat);
    flange.position.y = dy;
    g.add(flange);
  });
  const hub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.024, 0.024, 0.055, 20, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xcfd3d9, roughness: 0.4, side: THREE.DoubleSide })
  );
  g.add(hub);
  // wound filament: stack of tori reads as coiled strands
  const filMat = new THREE.MeshStandardMaterial({ color: filColor, roughness: 0.55 });
  for (let i = 0; i < 5; i++) {
    const layer = new THREE.Mesh(new THREE.TorusGeometry(0.036 + i * 0.006, 0.005, 8, 36), filMat);
    layer.rotation.x = Math.PI / 2;
    layer.position.y = (i % 2 === 0 ? -1 : 1) * 0.011;
    g.add(layer);
    const layer2 = new THREE.Mesh(new THREE.TorusGeometry(0.036 + i * 0.006, 0.005, 8, 36), filMat);
    layer2.rotation.x = Math.PI / 2;
    layer2.position.y = (i % 2 === 0 ? 1 : -1) * 0.011;
    g.add(layer2);
  }
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.044, 28), filMat);
  g.add(core);
  return g;
}

function buildBambuPrinter() {
  // Bambu Lab H2S: tall charcoal enclosure, full-height tinted front door
  // with a visible printing chamber, angled touchscreen, top glass, vents
  const g = new THREE.Group();
  const shellMat = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.38, metalness: 0.42 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x17181c, roughness: 0.45, metalness: 0.5 });
  const W = 0.5, H = 0.62, D = 0.5;

  // body with rounded vertical edges
  const shell = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.035), shellMat);
  shell.position.y = H / 2 + 0.012;
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.024, 12), trimMat);
    foot.position.set(sx * (W / 2 - 0.06), 0.012, sz * (D / 2 - 0.06));
    g.add(foot);
  });

  // printing chamber: dark recessed box visible through the door glass
  const chamberW = W - 0.11, chamberH = H - 0.2, frontZ = D / 2;
  const chamber = new THREE.Mesh(
    new THREE.BoxGeometry(chamberW, chamberH, 0.36),
    new THREE.MeshStandardMaterial({ color: 0x0a0b0d, roughness: 0.9, side: THREE.BackSide })
  );
  chamber.position.set(0, H / 2 + 0.045, frontZ - 0.19);
  g.add(chamber);

  // build plate (textured PEI gold-ish) + half-printed blue car
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(chamberW - 0.06, 0.006, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x6a5a30, roughness: 0.5, metalness: 0.55 })
  );
  plate.position.set(0, 0.145, frontZ - 0.2);
  g.add(plate);
  const printMat = new THREE.MeshStandardMaterial({ color: 0x3f8cff, roughness: 0.5, metalness: 0.05 });
  const carBody = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.032, 0.06, 2, 0.008), printMat);
  carBody.position.set(0, 0.165, frontZ - 0.2);
  g.add(carBody);
  const carCabin = new THREE.Mesh(new RoundedBoxGeometry(0.065, 0.022, 0.05, 2, 0.006), printMat);
  carCabin.position.set(-0.01, 0.19, frontZ - 0.2);
  g.add(carCabin);

  // CoreXY gantry: two rails + crossbar + white toolhead
  const railMat = new THREE.MeshStandardMaterial({ color: 0x9ba1a9, roughness: 0.35, metalness: 0.9 });
  [-1, 1].forEach((s) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.3), railMat);
    side.position.set(s * (chamberW / 2 - 0.02), 0.42, frontZ - 0.2);
    g.add(side);
  });
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(chamberW - 0.05, 0.014, 0.02), railMat);
  crossbar.position.set(0, 0.42, frontZ - 0.22);
  g.add(crossbar);
  const head = new THREE.Mesh(
    new RoundedBoxGeometry(0.055, 0.075, 0.05, 2, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xe8eaee, roughness: 0.35, metalness: 0.1 })
  );
  head.position.set(0.05, 0.385, frontZ - 0.21);
  g.add(head);
  const headLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.022, 0.005, 0.004),
    new THREE.MeshStandardMaterial({ color: 0xff3344, emissive: 0xff3344, emissiveIntensity: 1.2 })
  );
  headLed.position.set(0.05, 0.36, frontZ - 0.187);
  g.add(headLed);
  MODELS.printerHead = head;
  MODELS.printerHeadLed = headLed;

  // chamber LED strip + interior light
  const chamberLed = new THREE.Mesh(
    new THREE.BoxGeometry(chamberW - 0.06, 0.006, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xdfe8f4, emissive: 0xe8f0fa, emissiveIntensity: 1.1 })
  );
  chamberLed.position.set(0, H - 0.115, frontZ - 0.06);
  g.add(chamberLed);
  const inner = new THREE.PointLight(0xe8f0fa, 1.1, 0.9, 2);
  inner.position.set(0, H - 0.16, frontZ - 0.18);
  g.add(inner);

  // full-height tinted glass door + slim frame + hinge + handle
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(chamberW, chamberH),
    new THREE.MeshPhysicalMaterial({
      color: 0x30363c,
      roughness: 0.06,
      metalness: 0,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    })
  );
  glass.position.set(0, H / 2 + 0.045, frontZ + 0.004);
  g.add(glass);
  const dFrame = new THREE.Mesh(new THREE.BoxGeometry(chamberW + 0.02, 0.012, 0.008), trimMat);
  dFrame.position.set(0, H / 2 + 0.045 + chamberH / 2, frontZ + 0.004);
  g.add(dFrame);
  const dFrameB = dFrame.clone();
  dFrameB.position.y = H / 2 + 0.045 - chamberH / 2;
  g.add(dFrameB);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.11, 0.012), trimMat);
  handle.position.set(chamberW / 2 - 0.015, H / 2 + 0.05, frontZ + 0.012);
  g.add(handle);

  // wordmark top-left of the door
  const wm = document.createElement("canvas");
  wm.width = 128; wm.height = 24;
  const wctx = wm.getContext("2d");
  wctx.fillStyle = "#2b2d31"; wctx.fillRect(0, 0, 128, 24);
  wctx.fillStyle = "#c9ced6"; wctx.font = "700 13px Arial";
  wctx.fillText("BAMBU LAB  H2S", 6, 17);
  const wmTex = new THREE.CanvasTexture(wm);
  wmTex.colorSpace = THREE.SRGBColorSpace;
  const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.024), new THREE.MeshBasicMaterial({ map: wmTex, color: 0x9a9a9a }));
  mark.position.set(-W / 2 + 0.1, H - 0.05, frontZ + 0.002);
  g.add(mark);

  // angled touchscreen, bottom-right
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
  const screenHolder = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.07, 0.012, 2, 0.004), trimMat);
  screenHolder.position.set(W / 2 - 0.1, 0.1, frontZ + 0.012);
  screenHolder.rotation.x = -0.28;
  g.add(screenHolder);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.108, 0.056), new THREE.MeshBasicMaterial({ map: uiTex, color: 0x8f8f8f }));
  screen.position.set(W / 2 - 0.1, 0.102, frontZ + 0.02);
  screen.rotation.x = -0.28;
  g.add(screen);

  // top: inset dark glass lid
  const lid = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.12, 0.008, D - 0.14),
    new THREE.MeshPhysicalMaterial({ color: 0x24282d, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.75 })
  );
  lid.position.set(0, H + 0.008, 0);
  g.add(lid);

  // side vents (slats)
  for (let i = 0; i < 5; i++) {
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.05, 0.14), trimMat);
    vent.position.set(-W / 2 - 0.001, 0.2 + i * 0.02, -0.08);
    g.add(vent);
  }

  // side-mounted spool
  const spool = makeSpool(0x3f9e4f);
  spool.rotation.z = Math.PI / 2;
  spool.position.set(-W / 2 - 0.045, H * 0.62, -0.05);
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
