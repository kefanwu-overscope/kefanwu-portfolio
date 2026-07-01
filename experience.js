/* ============================================================
   experience.js — 3D desk experience (warm library study)
   Real CC0/CC-BY models (Poly Haven photoreal + Poly Pizza) loaded
   via GLTFLoader, unified under one warm HDRI. Procedural room
   shell (floor + walls + wainscot). Loads straight into the scene
   with a brief loader + gentle camera move-in.
   Clickable project models + resume folder come next.

   Model credits: green banker lamp — "Desk lamp" by Poly by Google,
   CC-BY 3.0 (via Poly Pizza). All other models CC0. See ATTRIBUTIONS.txt.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { HERO_PROJECTS, ACCENT, RESUME } from "./experience-data.js";

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
  rug: 0x3a1c12,
};

let TEX = null;
let MAXA = 4;
function setupTextures(manager) {
  const loader = new THREE.TextureLoader(manager);
  const cache = {};
  const REP = {
    dark_wood: [2, 1],
    laminate_floor_02: [6, 6],
    painted_plaster_wall: [3, 2],
  };
  function loadPBR(slug) {
    if (cache[slug]) return cache[slug];
    const [rx, ry] = REP[slug] || [1, 1];
    const mk = (m) => {
      const t = loader.load(`textures/${slug}/${slug}_${m}_1k.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = MAXA;
      return t;
    };
    const map = mk("diff");
    map.colorSpace = THREE.SRGBColorSpace;
    const set = { map, normalMap: mk("nor_gl"), roughnessMap: mk("rough") };
    cache[slug] = set;
    return set;
  }
  TEX = { loadPBR };
}

const MODELS = {}; // named refs for live tuning
const HOTSPOTS = []; // clickable root objects (projects + folder)

function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  MAXA = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 6, 16);

  const REST_POS = new THREE.Vector3(1.55, 1.15, 2.15);
  const REST_TARGET = new THREE.Vector3(0, 0.72, -0.2);
  const FLY_POS = new THREE.Vector3(2.3, 1.7, 3.2);

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
  controls.minDistance = 1.5;
  controls.maxDistance = 3.7;
  controls.minPolarAngle = 0.5;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  // front-only arc (<180°): camera stays on the +Z side so the room's open
  // back (behind the viewer) is never visible.
  controls.minAzimuthAngle = -Math.PI * 0.36;
  controls.maxAzimuthAngle = Math.PI * 0.36;
  controls.target.copy(REST_TARGET);
  controls.update();

  const manager = new THREE.LoadingManager();
  let revealed = false;
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    revealScene();
    if (!prefersReducedMotion) startIntro();
  };
  manager.onLoad = doReveal;
  setTimeout(doReveal, 8000); // safety

  setupTextures(manager);

  // HDRI warm environment
  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader(manager).load("hdri/wooden_lounge_1k.hdr", (tex) => {
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 0.5;
    tex.dispose();
    pmrem.dispose();
  });

  // lighting
  const hemi = new THREE.HemisphereLight(0x4a3520, 0x0a0705, 0.45);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe6c2, 1.4);
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
  key.shadow.radius = 5;
  scene.add(key);

  const lampLight = new THREE.PointLight(0xffb15a, 6, 3.2, 2);
  lampLight.position.set(-0.62, 0.95, -0.2);
  scene.add(lampLight);

  // two warm display spots washing the cabinet shelves (no shadows, cheap)
  [-0.5, 0.5].forEach((x) => {
    const spot = new THREE.SpotLight(0xffd9a8, 6, 6, 0.5, 0.7, 1.6);
    spot.position.set(x, 2.4, 0.5);
    spot.target.position.set(x * 0.6, 0.95, -1.05);
    scene.add(spot);
    scene.add(spot.target);
  });

  // ---- procedural room shell ----
  buildRoom(scene);

  // contact shadow under the desk
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 1.5),
    new THREE.MeshBasicMaterial({
      map: makeRadialShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.02, -0.1);
  scene.add(contact);

  // ---- real models ----
  const loader = new GLTFLoader(manager);
  const stlLoader = new STLLoader(manager);
  const artLoader = new THREE.TextureLoader(manager);

  // WOOD desk (Quaternius); desktop props chain onto its measured top surface
  loadModel(
    loader, scene, "models/pp/desk_wood.glb",
    { name: "desk", targetSize: 0.78, axis: "y", pos: [0, 0, 0.05], rotY: 0, tint: 0x6e4a2a },
    (root, box) => {
      const top = box.max.y;
      lampLight.position.set(-0.58, top + 0.22, -0.14);
      loadModel(loader, scene, "models/pp/banker_lamp_green.glb",
        { name: "lamp", targetSize: 0.4, axis: "y", pos: [-0.58, top, -0.14], rotY: 0.3 });
      loadModel(loader, scene, "models/book_encyclopedia_set_01/book_encyclopedia_set_01.gltf",
        { name: "books", targetSize: 0.26, axis: "x", pos: [0.55, top, -0.1], rotY: -0.2 });
      loadModel(loader, scene, "models/pp/books_small.glb",
        { name: "booksSmall", targetSize: 0.2, axis: "x", pos: [0.32, top, 0.12], rotY: 0.5 });
      loadModel(loader, scene, "models/pp/globe.glb",
        { name: "globe", targetSize: 0.18, axis: "y", pos: [0.7, top, 0.08], rotY: 0 });
      // resume folder (clickable) on the desk, in the lamp's pool of light
      loadModel(loader, scene, "models/proj/folder.glb",
        { name: "folder", action: "resume", label: "Résumé", targetSize: 0.22, axis: "x", pos: [-0.15, top, 0.16], rotY: 0.25 });
    }
  );

  // DISPLAY CABINET (photoreal shelf) — front-center; holds the project exhibits.
  loadModel(loader, scene, "models/wooden_bookshelf_worn/wooden_bookshelf_worn.gltf",
    { name: "cabinet", pos: [0, 0, -1.12], rotY: 0 });

  // ---- project exhibits on the cabinet shelves (clickable) ----
  // shelf surfaces at y ~ 0.40 / 0.66 / 0.96 / 1.28; interior x in [-0.6,0.6], front z ~ -0.98
  const EXHIBITS = [
    { file: "steering", key: "steering",   label: "Mk.8 Steering",   size: 0.22, axis: "x", pos: [-0.34, 1.28, -0.98], rotX: -Math.PI / 2, rotY: -0.35 },
    { file: "drone",    key: "javelin",    label: "Javelin VTOL",    size: 0.30, axis: "x", pos: [ 0.34, 1.28, -0.98], rotY: 0.4 },
    { file: "robot",    key: "aura",       label: "AURA Swerve",     size: 0.22, axis: "y", pos: [-0.34, 0.96, -0.98], rotY: 0.3 },
    { file: "scanner",  key: "scanner",    label: "3D scanner",      size: 0.26, axis: "y", pos: [ 0.34, 0.66, -0.98], rotY: -0.3 },
  ];
  EXHIBITS.forEach((x) =>
    loadModel(loader, scene, `models/proj/${x.file}.glb`, {
      name: "ex_" + x.key, projectKey: x.key, label: x.label,
      targetSize: x.size, axis: x.axis, pos: x.pos, rotX: x.rotX, rotY: x.rotY,
    })
  );

  // carbon seat: REAL geometry from SolidWorks (CF_Seat_Mold.STL). SW exports
  // are typically Z-up, so rotate -90° about X to stand it upright.
  loadSTL(stlLoader, scene, "models/real/seat.stl", {
    name: "ex_carbonSeat", projectKey: "carbonSeat", label: "Carbon fiber seat",
    targetSize: 0.24, axis: "y", pos: [-0.34, 0.66, -0.98], rotX: -Math.PI / 2, rotY: 0.3,
    material: { color: 0x17181c, metalness: 0.25, roughness: 0.42 },
  });

  // brake sim: procedural vented rotor with a baked thermal gradient (per Kefan)
  placeRoot(buildBrakeRotor(), scene, {
    name: "ex_brakeSim", projectKey: "brakeSim", label: "FSAE Brake Sim",
    targetSize: 0.22, axis: "x", pos: [0.0, 0.40, -0.98], rotX: -Math.PI / 2, rotY: 0.15,
  });

  // gearbox: procedural meshing-gear cluster (replaces CFD as the high-value pick)
  placeRoot(buildGearbox(), scene, {
    name: "ex_gearbox", projectKey: "gearbox", label: "2-speed gearbox",
    targetSize: 0.28, axis: "x", pos: [0.34, 0.96, -0.98], rotX: -Math.PI / 2, rotY: -0.3,
  });

  // engraved brass plaques under each exhibit (museum display style)
  [
    ["MK.8 STEERING", -0.34, 1.28],
    ["JAVELIN VTOL", 0.34, 1.28],
    ["AURA SWERVE", -0.34, 0.96],
    ["2-SPEED GEARBOX", 0.34, 0.96],
    ["CARBON SEAT", -0.34, 0.66],
    ["3D SCANNER", 0.34, 0.66],
    ["BRAKE SIM", 0, 0.4],
  ].forEach(([text, x, y]) => scene.add(makePlaque(text, x, y, -0.86)));

  // side bookcases (decor) against the two side walls, facing inward
  loadModel(loader, scene, "models/pp/bookcase.glb",
    { name: "shelfL", targetSize: 2.0, axis: "y", pos: [-2.32, 0, -0.55], rotY: -Math.PI / 2 });
  loadModel(loader, scene, "models/pp/bookcase.glb",
    { name: "shelfR", targetSize: 2.0, axis: "y", pos: [2.32, 0, -0.55], rotY: Math.PI / 2 });

  // rug under the desk
  loadModel(loader, scene, "models/pp/rug.glb",
    { name: "rug", targetSize: 2.6, axis: "x", pos: [0, 0.01, 0.2], rotY: 0, tint: COL.rug });

  // reading chair, angled at the desk
  loadModel(loader, scene, "models/pp/armchair.glb",
    { name: "chair", targetSize: 0.95, axis: "y", pos: [-0.15, 0, 0.95], rotY: Math.PI });

  // photoreal potted plant, floor corner
  loadModel(loader, scene, "models/potted_plant_04/potted_plant_04.gltf",
    { name: "plant", targetSize: 0.95, axis: "y", pos: [1.85, 0, 0.2], rotY: 0 });

  // framed project renders as wall art on the two side walls
  const ART = [
    { img: "assets/cover-steering-system.webp", x: -2.56, y: 1.75, z: -0.3, rotY: Math.PI / 2 },
    { img: "assets/javelin-3q.webp",            x: -2.56, y: 1.75, z: 0.7,  rotY: Math.PI / 2 },
    { img: "assets/cover-carbon-fiber-seat.webp", x: 2.56, y: 1.75, z: -0.3, rotY: -Math.PI / 2 },
    { img: "assets/gearbox-render.webp",        x: 2.56, y: 1.75, z: 0.7,  rotY: -Math.PI / 2 },
  ];
  ART.forEach((a) => scene.add(makeFramedArt(artLoader, a)));

  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  // camera flight system (intro fly-in + focus-on-click share it)
  let flight = null; // { fromPos, toPos, fromLook, toLook, ms, start, onDone }
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
    controls.target.set(0, 0.7, -0.1);
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
        // while a panel is open we hold the focused framing
        if (!document.documentElement.classList.contains("exp-panel-open")) {
          controls.enabled = true;
          controls.update();
        }
        if (done) done();
      }
    } else {
      controls.update();
    }

    // museum-turntable idle spin on project exhibits (paused on hover)
    if (!prefersReducedMotion) {
      for (const h of HOTSPOTS) {
        if (h.userData.hotspot.key && h !== hovered) h.rotation.y += 0.0035;
      }
    }

    renderer.render(scene, camera);
  });

  // ---- interaction: hover + click hotspots, HTML panels ----
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
      hovered.scale.setScalar(hovered.userData.hotspot.baseScale * 1.12);
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
    if (moved > 6 || panelOpen || flight) return; // treat as orbit drag / busy
    updatePointer(ev);
    const root = pickHotspot();
    if (root) focusHotspot(root);
  });

  // fly the camera in close on the clicked object, then slide the panel out
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
    const focusPos = new THREE.Vector3(c.x * 0.55, Math.max(c.y + 0.06, 0.98), c.z + 0.95);
    if (hs.action === "resume") focusPos.set(c.x + 0.28, c.y + 0.5, c.z + 0.75);
    // look slightly right of the object so it sits left of the slide-in panel
    const focusLook = c.clone();
    focusLook.x += 0.2;

    panelOpen = true; // block hover/clicks during the approach
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
    // return to the resting overview
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

  window.__exp = { THREE, scene, camera, renderer, controls, lampLight, key, hemi, models: MODELS, hotspots: HOTSPOTS, openPanel };
  console.info(`[experience] study scene live — ${HOTSPOTS.length} clickable hotspots`);
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

  // register clickable hotspot (project exhibit or resume folder), wrapped in
  // a pivot at its geometric center so idle spin / hover scale stay centered
  if (opts.projectKey || opts.action) {
    const c = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    const pivot = new THREE.Group();
    pivot.position.copy(c);
    scene.add(pivot);
    pivot.add(root);
    root.position.sub(c);
    pivot.userData.hotspot = {
      key: opts.projectKey || null,
      action: opts.action || null,
      label: opts.label || "",
      baseScale: 1,
      center: c.clone(),
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

// Load a raw STL (e.g. a SolidWorks export) and give it a material.
function loadSTL(stlLoader, scene, url, opts, onPlaced) {
  stlLoader.load(
    url,
    (geom) => {
      geom.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial(
        opts.material || { color: 0x1b1d22, metalness: 0.35, roughness: 0.45 }
      );
      const root = new THREE.Group();
      root.add(new THREE.Mesh(geom, mat));
      placeRoot(root, scene, opts, onPlaced);
    },
    undefined,
    (err) => console.warn(`[experience] failed to load ${url}`, err)
  );
}

/* ============================================================
   procedural room shell
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
  const wd = TEX.loadPBR("dark_wood");
  const woodMat = () =>
    new THREE.MeshStandardMaterial({
      color: COL.woodTint,
      map: wd.map,
      normalMap: wd.normalMap,
      roughnessMap: wd.roughnessMap,
      roughness: 0.82,
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

  // ceiling so low orbit angles don't reveal a void
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

  // wood wainscot + chair rail on the three walls
  const wainH = 0.95;
  const addWain = (w, x, z, rotY) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, wainH, 0.04), woodMat());
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
}

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

function makeFramedArt(texLoader, a) {
  const g = new THREE.Group();
  const w = 0.58, h = 0.44, d = 0.03;
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color: 0x2a1c0e, roughness: 0.5, metalness: 0.25 })
  );
  const tex = texLoader.load(a.img);
  tex.colorSpace = THREE.SRGBColorSpace;
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.07, h - 0.07),
    new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      roughness: 0.85,
      metalness: 0,
    })
  );
  art.position.z = d / 2 + 0.003;
  g.add(frame, art);
  g.position.set(a.x, a.y, a.z);
  g.rotation.y = a.rotY;
  return g;
}

function makePlaque(text, x, y, z) {
  // engraved-brass label texture
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, "#c9a24b");
  grad.addColorStop(0.5, "#a8843a");
  grad.addColorStop(1, "#8a6a2c");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = "rgba(60,42,12,0.85)";
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, 250, 58);
  ctx.fillStyle = "#2e2005";
  ctx.font = "700 26px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 34, 236);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const plaque = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.035, 0.006),
    new THREE.MeshStandardMaterial({ map: tex, metalness: 0.7, roughness: 0.35 })
  );
  plaque.position.set(x, y + 0.022, z);
  plaque.rotation.x = -0.42; // leaned back like a museum label
  plaque.castShadow = true;
  return plaque;
}

function makeThermalTexture() {
  // radial gradient: cool hub -> glowing orange/yellow friction band -> red edge,
  // with dark radial vent slots, evoking a brake thermal (CFD/FEA) result.
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
  // vent slots
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
    emissiveIntensity: 0.85,
    metalness: 0.55,
    roughness: 0.5,
  });
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.016, 60), rotorMat);
  g.add(rotor);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.9, roughness: 0.35 });
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 28), hubMat);
  g.add(hub);
  // 5 lug bolts
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.034, 8), hubMat);
    bolt.position.set(Math.cos(a) * 0.022, 0, Math.sin(a) * 0.022);
    g.add(bolt);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function buildGearbox() {
  const g = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.95, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0.9, roughness: 0.4 });

  function gear(rBody, nTeeth, thick, mat) {
    const gg = new THREE.Group();
    gg.add(new THREE.Mesh(new THREE.CylinderGeometry(rBody, rBody, thick, Math.max(28, nTeeth * 2)), mat));
    const toothLen = rBody * 0.22;
    const toothGeo = new THREE.BoxGeometry(toothLen, thick, (2 * Math.PI * rBody) / nTeeth * 0.55);
    for (let i = 0; i < nTeeth; i++) {
      const a = (i / nTeeth) * Math.PI * 2;
      const t = new THREE.Mesh(toothGeo, mat);
      t.position.set(Math.cos(a) * (rBody + toothLen / 2 - 0.001), 0, Math.sin(a) * (rBody + toothLen / 2 - 0.001));
      t.rotation.y = -a;
      gg.add(t);
    }
    // hub bore ring
    gg.add(new THREE.Mesh(new THREE.CylinderGeometry(rBody * 0.28, rBody * 0.28, thick + 0.004, 20), dark));
    return gg;
  }

  const big = gear(0.09, 20, 0.026, steel);
  big.position.set(-0.03, 0, 0);
  g.add(big);
  const small = gear(0.055, 12, 0.026, steel);
  small.position.set(0.03 + 0.09 + 0.055 - 0.012, 0, 0.02);
  g.add(small);

  // shafts
  [[-0.03, 0], [small.position.x, 0.02]].forEach(([x, z]) => {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 16), dark);
    shaft.position.set(x, 0, z);
    g.add(shaft);
  });

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
