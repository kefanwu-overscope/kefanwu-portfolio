/* ============================================================
   experience.js — 3D desk experience
   Warm "library study" art direction: warm wood desk, green
   leather top, brass banker's lamp (warm pool of light), books,
   and a bookshelf backdrop. Loads straight into the scene
   (brief loader + auto camera move-in). Clickable project models
   + resume folder come in the next phases.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
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

function revealScene() {
  document.documentElement.classList.add("exp-ready");
}

const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

/* warm library palette */
const COL = {
  bg: 0x0c0907,
  wood: 0x3c2616,
  woodDark: 0x241509,
  leather: 0x1d3b2b,
  brass: 0xb98b35,
  brassDark: 0x6e521f,
  shade: 0x123d28,
  bulb: 0xffc278,
  paper: 0xe7dcc2,
  rug: 0x180d07,
  bookSpines: [0x6e241c, 0x3a2a16, 0x1f3a2a, 0x27314e, 0x5a4420, 0x47202a, 0x2e4636, 0x70391a],
  pages: 0xcab78c,
};

function initScene(canvas) {
  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 5, 12);

  /* ---------- camera + controls ---------- */
  const REST_POS = new THREE.Vector3(1.35, 1.02, 2.05);
  const REST_TARGET = new THREE.Vector3(0, 0.78, -0.15);
  const FLY_POS = new THREE.Vector3(2.0, 1.5, 3.1);

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
  controls.maxDistance = 4.5;
  controls.minPolarAngle = 0.4;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.target.copy(REST_TARGET);
  controls.update();

  /* ---------- HDRI (warm reflections) ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  let revealed = false;
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    revealScene();
    if (!prefersReducedMotion) startIntro();
  };
  new HDRLoader().load(
    "hdri/wooden_lounge_1k.hdr",
    (tex) => {
      scene.environment = pmrem.fromEquirectangular(tex).texture;
      scene.environmentIntensity = 0.28;
      tex.dispose();
      pmrem.dispose();
      doReveal();
    },
    undefined,
    (err) => {
      console.warn("[experience] HDRI load failed", err);
      doReveal();
    }
  );
  // safety: never hang on the loader
  setTimeout(doReveal, 4000);

  /* ---------- warm lighting ---------- */
  const hemi = new THREE.HemisphereLight(0x4a3520, 0x0a0705, 0.5);
  scene.add(hemi);

  // soft warm key from above-front
  const key = new THREE.DirectionalLight(0xffe6c2, 1.05);
  key.position.set(2.4, 4.4, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 16;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);

  // banker's-lamp warm pool
  const lampLight = new THREE.PointLight(0xffb15a, 12, 5.0, 2);
  lampLight.position.set(-0.6, 0.96, -0.16);
  scene.add(lampLight);

  /* ---------- floor / rug ---------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({ color: 0x0a0705, roughness: 0.98, metalness: 0 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.4),
    new THREE.MeshStandardMaterial({ color: COL.rug, roughness: 1.0, metalness: 0 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.002, 0.1);
  rug.receiveShadow = true;
  scene.add(rug);

  /* ---------- build scene ---------- */
  scene.add(buildBackdrop());
  const desk = buildDesk();
  scene.add(desk);
  scene.add(buildBankersLamp());
  scene.add(buildBookStack(0.62, -0.18));
  scene.add(buildOpenBook(0.02, 0.14));
  scene.add(buildPenCup(0.34, -0.04));

  // soft contact shadow under desk
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 1.8),
    new THREE.MeshBasicMaterial({
      map: makeRadialShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.85,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.012, 0.0);
  scene.add(contact);

  /* ---------- resize ---------- */
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  /* ---------- intro move-in ---------- */
  let introStart = null;
  let introPending = false;
  const INTRO_MS = 1400;
  const introLookFrom = new THREE.Vector3(0, 0.68, -0.1);

  function startIntro() {
    controls.enabled = false;
    camera.position.copy(FLY_POS);
    introPending = true;
  }

  /* ---------- render loop ---------- */
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

  window.__exp = { THREE, scene, camera, renderer, controls, lampLight, key, hemi };
  console.info(
    `[experience] warm library scene live — ${HERO_PROJECTS.length} hero objects pending`
  );
}

/* ============================================================
   builders
   ============================================================ */

const woodMat = () =>
  new THREE.MeshStandardMaterial({ color: COL.wood, roughness: 0.55, metalness: 0.04 });
const brassMat = () =>
  new THREE.MeshStandardMaterial({ color: COL.brass, roughness: 0.3, metalness: 1.0 });

function buildDesk() {
  const g = new THREE.Group();
  const topY = 0.76;
  const topThk = 0.05;
  const W = 2.1;
  const D = 1.0;

  // wood frame top
  const top = new THREE.Mesh(new THREE.BoxGeometry(W, topThk, D), woodMat());
  top.position.set(0, topY - topThk / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // green leather inlay
  const inlay = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.22, 0.012, D - 0.18),
    new THREE.MeshStandardMaterial({ color: COL.leather, roughness: 0.62, metalness: 0.02 })
  );
  inlay.position.set(0, topY + 0.001, 0);
  inlay.receiveShadow = true;
  g.add(inlay);

  // brass edge trim around inlay
  const trimMat = brassMat();
  const trimT = 0.012;
  const inW = W - 0.2;
  const inD = D - 0.16;
  [
    [0, inD / 2, inW, trimT],
    [0, -inD / 2, inW, trimT],
  ].forEach(([x, z, w]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.006, trimT), trimMat);
    bar.position.set(x, topY + 0.004, z);
    g.add(bar);
  });
  [
    [inW / 2, 0, inD],
    [-inW / 2, 0, inD],
  ].forEach(([x, z, d]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(trimT, 0.006, d), trimMat);
    bar.position.set(x, topY + 0.004, z);
    g.add(bar);
  });

  // solid side panels + back (substantial library desk)
  const panelMat = new THREE.MeshStandardMaterial({
    color: COL.woodDark,
    roughness: 0.6,
    metalness: 0.03,
  });
  const sideGeo = new THREE.BoxGeometry(0.05, topY - topThk, D - 0.08);
  [-(W / 2 - 0.12), W / 2 - 0.12].forEach((x) => {
    const s = new THREE.Mesh(sideGeo, panelMat);
    s.position.set(x, (topY - topThk) / 2, 0);
    s.castShadow = true;
    s.receiveShadow = true;
    g.add(s);
  });
  const modesty = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.3, topY - topThk - 0.16, 0.04),
    panelMat
  );
  modesty.position.set(0, (topY - topThk) / 2 + 0.04, -(D / 2 - 0.08));
  modesty.castShadow = true;
  g.add(modesty);

  // a drawer face with a brass knob, on the right pedestal
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.02), woodMat());
  drawer.position.set(W / 2 - 0.34, topY - 0.16, D / 2 - 0.06);
  g.add(drawer);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 16), brassMat());
  knob.position.set(W / 2 - 0.34, topY - 0.16, D / 2 - 0.04);
  g.add(knob);

  return g;
}

function buildBankersLamp() {
  const g = new THREE.Group();
  const baseX = -0.6;
  const baseZ = -0.16;
  const deskTop = 0.76;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.02, 32),
    brassMat()
  );
  base.position.set(baseX, deskTop + 0.01, baseZ);
  base.castShadow = true;
  g.add(base);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 0.2, 16),
    brassMat()
  );
  stem.position.set(baseX, deskTop + 0.11, baseZ);
  g.add(stem);

  // green glass shade (half-cylinder), glows warm from inside
  const shadeMat = new THREE.MeshStandardMaterial({
    color: COL.shade,
    roughness: 0.35,
    metalness: 0.1,
    emissive: new THREE.Color(0x123d22),
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.26, 24, 1, true, 0, Math.PI),
    shadeMat
  );
  shade.rotation.z = Math.PI / 2;
  shade.rotation.y = Math.PI / 2;
  shade.position.set(baseX, deskTop + 0.22, baseZ);
  shade.castShadow = true;
  g.add(shade);

  // warm bulb glow under the shade
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 16),
    new THREE.MeshBasicMaterial({ color: COL.bulb })
  );
  bulb.position.set(baseX, deskTop + 0.2, baseZ);
  g.add(bulb);

  return g;
}

function buildBookStack(x, z) {
  const g = new THREE.Group();
  const deskTop = 0.76;
  let y = deskTop;
  const n = 4;
  for (let i = 0; i < n; i++) {
    const w = 0.26 - i * 0.012 + (Math.random() - 0.5) * 0.02;
    const d = 0.19 - i * 0.01;
    const h = 0.03 + Math.random() * 0.018;
    const col = COL.bookSpines[Math.floor(Math.random() * COL.bookSpines.length)];
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0.02 })
    );
    const rot = (Math.random() - 0.5) * 0.18;
    book.position.set(x + (Math.random() - 0.5) * 0.03, y + h / 2, z);
    book.rotation.y = rot;
    book.castShadow = true;
    book.receiveShadow = true;
    g.add(book);

    // cream page block, slightly inset
    const pages = new THREE.Mesh(
      new THREE.BoxGeometry(w - 0.016, h - 0.008, d - 0.016),
      new THREE.MeshStandardMaterial({ color: COL.pages, roughness: 0.9 })
    );
    pages.position.copy(book.position);
    pages.rotation.y = rot;
    g.add(pages);
    y += h;
  }
  return g;
}

function buildOpenBook(x, z) {
  const g = new THREE.Group();
  const deskTop = 0.76;
  const coverMat = new THREE.MeshStandardMaterial({
    color: 0x47202a,
    roughness: 0.7,
    metalness: 0.02,
  });
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.014, 0.24), coverMat);
  cover.position.set(x, deskTop + 0.007, z);
  cover.castShadow = true;
  g.add(cover);
  const pageMat = new THREE.MeshStandardMaterial({ color: COL.paper, roughness: 0.92 });
  [-0.083, 0.083].forEach((dx) => {
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.158, 0.006, 0.22), pageMat);
    page.position.set(x + dx, deskTop + 0.016, z);
    page.rotation.z = dx < 0 ? 0.02 : -0.02;
    g.add(page);
  });
  return g;
}

function buildPenCup(x, z) {
  const g = new THREE.Group();
  const deskTop = 0.76;
  const cup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.03, 0.09, 20, 1, true),
    new THREE.MeshStandardMaterial({
      color: COL.brassDark,
      roughness: 0.4,
      metalness: 0.9,
      side: THREE.DoubleSide,
    })
  );
  cup.position.set(x, deskTop + 0.045, z);
  cup.castShadow = true;
  g.add(cup);
  // a couple of pens
  [[0.012, 0.05, 0xb98b35], [-0.01, 0.0, 0x2e4636], [0.0, -0.012, 0x47202a]].forEach(
    ([dx, dz, c], i) => {
      const pen = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.004, 0.16, 8),
        new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.3 })
      );
      pen.position.set(x + dx, deskTop + 0.1, z + dz);
      pen.rotation.set((Math.random() - 0.5) * 0.2, 0, (dx) * 3 + (i - 1) * 0.12);
      g.add(pen);
    }
  );
  return g;
}

function buildBackdrop() {
  const g = new THREE.Group();
  const wallZ = -1.55;

  // wood-paneled back wall
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 5),
    new THREE.MeshStandardMaterial({ color: COL.woodDark, roughness: 0.8, metalness: 0.03 })
  );
  wall.position.set(0, 2.2, wallZ - 0.12);
  wall.receiveShadow = true;
  g.add(wall);

  // bookshelf unit centered behind the desk
  const shelfMat = new THREE.MeshStandardMaterial({
    color: 0x2c1b0e,
    roughness: 0.7,
    metalness: 0.03,
  });
  const unitW = 3.4;
  const shelfX0 = -unitW / 2;
  const shelfYs = [0.95, 1.42, 1.89, 2.36];

  // vertical sides + shelves
  shelfYs.forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(unitW, 0.04, 0.28), shelfMat);
    board.position.set(0, y, wallZ);
    board.castShadow = true;
    board.receiveShadow = true;
    g.add(board);
  });
  [-unitW / 2, unitW / 2].forEach((x) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.7, 0.28), shelfMat);
    side.position.set(x, 1.62, wallZ);
    side.castShadow = true;
    g.add(side);
  });

  // rows of books on each shelf (except the very top)
  for (let s = 0; s < shelfYs.length - 1; s++) {
    const shelfY = shelfYs[s];
    let x = shelfX0 + 0.12;
    while (x < unitW / 2 - 0.12) {
      const w = 0.04 + Math.random() * 0.035;
      const h = 0.3 + Math.random() * 0.12;
      const col = COL.bookSpines[Math.floor(Math.random() * COL.bookSpines.length)];
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, 0.2 + Math.random() * 0.04),
        new THREE.MeshStandardMaterial({ color: col, roughness: 0.78, metalness: 0.02 })
      );
      const lean = Math.random() < 0.12 ? (Math.random() - 0.5) * 0.18 : 0;
      book.position.set(x + w / 2, shelfY + 0.02 + h / 2, wallZ);
      book.rotation.z = lean;
      book.castShadow = true;
      book.receiveShadow = true;
      g.add(book);
      x += w + 0.004;
    }
  }

  return g;
}

function makeRadialShadowTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.6)");
  grad.addColorStop(0.6, "rgba(0,0,0,0.22)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ============================================================
   bootstrap — runs after every const/function above is defined
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
