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
import { HERO_PROJECTS, ACCENT } from "./experience-data.js";

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
    }
  );

  // DISPLAY CABINET (empty photoreal shelf) — front-center; holds the project
  // exhibits (added in the next phase).
  loadModel(loader, scene, "models/wooden_bookshelf_worn/wooden_bookshelf_worn.gltf",
    { name: "cabinet", pos: [0, 0, -1.12], rotY: 0 });

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

  // intro move-in
  let introStart = null;
  let introPending = false;
  const INTRO_MS = 1500;
  const introLookFrom = new THREE.Vector3(0, 0.7, -0.1);
  function startIntro() {
    controls.enabled = false;
    camera.position.copy(FLY_POS);
    introPending = true;
  }

  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  renderer.setAnimationLoop((t) => {
    if (!running) return;
    if (introPending) {
      introStart = t;
      introPending = false;
    }
    if (introStart !== null) {
      const p = Math.min((t - introStart) / INTRO_MS, 1);
      const e = easeInOutCubic(p);
      camera.position.lerpVectors(FLY_POS, REST_POS, e);
      camera.lookAt(introLookFrom.clone().lerp(REST_TARGET, e));
      if (p >= 1) {
        introStart = null;
        controls.target.copy(REST_TARGET);
        controls.enabled = true;
        controls.update();
      }
    } else {
      controls.update();
    }
    renderer.render(scene, camera);
  });

  window.__exp = { THREE, scene, camera, renderer, controls, lampLight, key, hemi, models: MODELS };
  console.info(`[experience] study scene loading — ${HERO_PROJECTS.length} hero objects pending`);
}

/* ============================================================
   model loading + normalization
   ============================================================ */
function loadModel(loader, scene, url, opts, onPlaced) {
  loader.load(
    url,
    (gltf) => {
      const root = gltf.scene;
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
      if (onPlaced) onPlaced(root, new THREE.Box3().setFromObject(root));
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
