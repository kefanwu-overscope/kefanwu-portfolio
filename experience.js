/* ============================================================
   experience.js — 3D desk experience (warm library study)
   Textured wood + plaster room, fixed banker's lamp / pen cup /
   pedestal drawers, and more props. Loads straight into the
   scene (loader fades, gentle camera move-in). Clickable project
   models + resume folder come next.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
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

/* warm library palette */
const COL = {
  bg: 0x0c0907,
  brass: 0xb98b35,
  brassDark: 0x7a5a22,
  leather: 0x21402f,
  shadeGreen: 0x0f5132,
  shadeCream: 0xf3e6c4,
  bulb: 0xffd9a0,
  paper: 0xe7dcc2,
  rug: 0x241008,
  bookSpines: [0x6e241c, 0x3a2a16, 0x1f3a2a, 0x27314e, 0x5a4420, 0x47202a, 0x2e4636, 0x70391a],
  pages: 0xcab78c,
  woodTint: 0x8a6038,
  floorTint: 0x6b4f33,
  wallTint: 0x5a4636,
};

/* texture loading (set up inside initScene) */
let TEX = null; // { loadPBR(slug, rx, ry) }

function setupTextures(manager, maxAniso) {
  const loader = new THREE.TextureLoader(manager);
  const cache = {};
  // one shared texture set per slug (avoids re-uploading the same maps)
  const DEFAULT_REPEAT = {
    dark_wood: [2, 1],
    laminate_floor_02: [6, 6],
    painted_plaster_wall: [3, 2],
  };
  function loadPBR(slug) {
    if (cache[slug]) return cache[slug];
    const [rx, ry] = DEFAULT_REPEAT[slug] || [1, 1];
    const mk = (m) => {
      const t = loader.load(`textures/${slug}/${slug}_${m}_1k.jpg`);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = maxAniso;
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

function woodMaterial(rx, ry, tint = COL.woodTint) {
  // rx/ry kept for call-site compatibility; repeat is fixed per slug (shared texture)
  const t = TEX.loadPBR("dark_wood");
  return new THREE.MeshStandardMaterial({
    color: tint,
    map: t.map,
    normalMap: t.normalMap,
    roughnessMap: t.roughnessMap,
    roughness: 0.85,
    metalness: 0.0,
  });
}

const brassMat = () =>
  new THREE.MeshStandardMaterial({ color: COL.brass, roughness: 0.3, metalness: 1.0 });

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
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.bg);
  scene.fog = new THREE.Fog(COL.bg, 6, 16);

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
  controls.maxDistance = 4.2;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = Math.PI / 2 - 0.04;
  // keep the camera on the open (front) side of the room
  controls.minAzimuthAngle = -Math.PI * 0.42;
  controls.maxAzimuthAngle = Math.PI * 0.78;
  controls.target.copy(REST_TARGET);
  controls.update();

  /* ---------- loading manager (reveal when everything is ready) ---------- */
  const manager = new THREE.LoadingManager();
  let revealed = false;
  const doReveal = () => {
    if (revealed) return;
    revealed = true;
    revealScene();
    if (!prefersReducedMotion) startIntro();
  };
  manager.onLoad = doReveal;
  setTimeout(doReveal, 5000); // safety

  setupTextures(manager, maxAniso);

  /* ---------- HDRI (warm reflections) ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  new HDRLoader(manager).load("hdri/wooden_lounge_1k.hdr", (tex) => {
    scene.environment = pmrem.fromEquirectangular(tex).texture;
    scene.environmentIntensity = 0.28;
    tex.dispose();
    pmrem.dispose();
  });

  /* ---------- warm lighting ---------- */
  const hemi = new THREE.HemisphereLight(0x4a3520, 0x0a0705, 0.5);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe6c2, 1.05);
  key.position.set(2.4, 4.4, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 18;
  key.shadow.camera.left = -3.5;
  key.shadow.camera.right = 3.5;
  key.shadow.camera.top = 3.5;
  key.shadow.camera.bottom = -3.5;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);

  // banker's-lamp warm pool (no shadow — point-light shadows are 6x passes)
  const lampLight = new THREE.PointLight(0xffb15a, 12, 5.0, 2);
  lampLight.position.set(-0.6, 0.95, -0.12);
  scene.add(lampLight);

  /* ---------- room ---------- */
  scene.add(buildRoom());
  scene.add(buildBookshelf());

  /* ---------- rug + contact shadow ---------- */
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.4),
    new THREE.MeshStandardMaterial({ color: COL.rug, roughness: 1.0, metalness: 0 })
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.004, 0.15);
  rug.receiveShadow = true;
  scene.add(rug);

  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 1.8),
    new THREE.MeshBasicMaterial({
      map: makeRadialShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.014, 0.0);
  scene.add(contact);

  /* ---------- desk + props ---------- */
  scene.add(buildDesk());
  const lamp = buildBankersLamp();
  scene.add(lamp);
  scene.add(buildBookStack(0.66, -0.2));
  scene.add(buildOpenBook(0.05, 0.16));
  const penGroup = buildPenCup(0.36, -0.05);
  scene.add(penGroup);
  scene.add(buildMug(-0.2, 0.2));
  scene.add(buildPaperStack(-0.05, -0.05));

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
  const introLookFrom = new THREE.Vector3(0, 0.7, -0.1);
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

  window.__exp = { THREE, scene, camera, renderer, controls, lampLight, key, hemi, lamp, penGroup };
  console.info(
    `[experience] warm library scene live — ${HERO_PROJECTS.length} hero objects pending`
  );
}

/* ============================================================
   room
   ============================================================ */

function buildRoom() {
  const g = new THREE.Group();

  // wood-plank floor
  const ft = TEX.loadPBR("laminate_floor_02", 6, 6);
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
  g.add(floor);

  const wt = TEX.loadPBR("painted_plaster_wall", 3, 2);
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
  const back = -1.78;
  const sideX = 2.7;
  const front = 1.9;

  // back wall
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(2 * sideX, WALL_H), wallMat());
  backWall.position.set(0, WALL_H / 2, back);
  backWall.receiveShadow = true;
  g.add(backWall);

  // side walls
  const depth = front - back;
  [-sideX, sideX].forEach((x) => {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(depth, WALL_H), wallMat());
    w.position.set(x, WALL_H / 2, (front + back) / 2);
    w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
    w.receiveShadow = true;
    g.add(w);
  });

  // wood wainscot (lower paneling) on the three walls
  const wainH = 0.95;
  const railY = wainH + 0.02;
  const panelMat = woodMaterial(3, 1);
  const railMat = woodMaterial(3, 0.3, 0x7a5026);

  const addWainscot = (w, x, z, rotY) => {
    const panel = new THREE.Mesh(new RoundedBoxGeometry(w, wainH, 0.04, 2, 0.01), panelMat);
    panel.position.set(x, wainH / 2, z);
    panel.rotation.y = rotY;
    panel.receiveShadow = true;
    panel.castShadow = true;
    g.add(panel);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.07), railMat);
    rail.position.set(x, railY, z);
    rail.rotation.y = rotY;
    rail.castShadow = true;
    g.add(rail);
  };
  addWainscot(2 * sideX, 0, back + 0.03, 0);
  addWainscot(depth, -sideX + 0.03, (front + back) / 2, Math.PI / 2);
  addWainscot(depth, sideX - 0.03, (front + back) / 2, -Math.PI / 2);

  // framed pictures on side walls
  g.add(makeFrame(-sideX + 0.06, 1.9, -0.5, Math.PI / 2, 0x6e241c));
  g.add(makeFrame(-sideX + 0.06, 1.9, 0.5, Math.PI / 2, 0x27314e));
  g.add(makeFrame(sideX - 0.06, 1.95, 0.2, -Math.PI / 2, 0x2e4636));

  return g;
}

function makeFrame(x, y, z, rotY, art) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.66, 0.03),
    new THREE.MeshStandardMaterial({ color: COL.brassDark, roughness: 0.4, metalness: 0.7 })
  );
  const canvasArt = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.58),
    new THREE.MeshStandardMaterial({ color: art, roughness: 0.7, metalness: 0 })
  );
  canvasArt.position.z = 0.018;
  g.add(frame, canvasArt);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return g;
}

function buildBookshelf() {
  const g = new THREE.Group();
  const wallZ = -1.62;
  const shelfMat = woodMaterial(2, 0.4, 0x6b4a26);
  const unitW = 3.6;
  const shelfYs = [0.98, 1.45, 1.92, 2.39];

  shelfYs.forEach((y) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(unitW, 0.045, 0.3), shelfMat);
    board.position.set(0, y, wallZ);
    board.castShadow = true;
    board.receiveShadow = true;
    g.add(board);
  });
  [-unitW / 2, unitW / 2].forEach((x) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.62, 0.3), shelfMat);
    side.position.set(x, 1.68, wallZ);
    side.castShadow = true;
    g.add(side);
  });
  // back panel
  const backPanel = new THREE.Mesh(
    new THREE.BoxGeometry(unitW, 1.62, 0.02),
    woodMaterial(2, 1, 0x3a2614)
  );
  backPanel.position.set(0, 1.68, wallZ - 0.14);
  g.add(backPanel);

  // all shelf books merged into ONE geometry (vertex colors) for performance
  const bookGeos = [];
  for (let s = 0; s < shelfYs.length - 1; s++) {
    const shelfY = shelfYs[s];
    let x = -unitW / 2 + 0.14;
    while (x < unitW / 2 - 0.14) {
      const w = 0.04 + Math.random() * 0.035;
      const h = 0.3 + Math.random() * 0.12;
      const depth = 0.2 + Math.random() * 0.04;
      const col = new THREE.Color(
        COL.bookSpines[Math.floor(Math.random() * COL.bookSpines.length)]
      );
      const geo = new THREE.BoxGeometry(w, h, depth);
      const lean = Math.random() < 0.1 ? (Math.random() - 0.5) * 0.16 : 0;
      geo.rotateZ(lean);
      geo.translate(x + w / 2, shelfY + 0.022 + h / 2, wallZ);
      const n = geo.attributes.position.count;
      const colors = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      bookGeos.push(geo);
      x += w + 0.004;
    }
  }
  const booksMesh = new THREE.Mesh(
    mergeGeometries(bookGeos, false),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 })
  );
  booksMesh.castShadow = true;
  booksMesh.receiveShadow = true;
  g.add(booksMesh);
  return g;
}

/* ============================================================
   desk (pedestal desk with real drawers)
   ============================================================ */

const DESK_TOP = 0.76;

function buildDesk() {
  const g = new THREE.Group();
  const topThk = 0.05;
  const W = 2.1;
  const D = 1.0;

  // wood top (rounded edges)
  const top = new THREE.Mesh(new RoundedBoxGeometry(W, topThk, D, 3, 0.012), woodMaterial(1, 1));
  top.position.set(0, DESK_TOP - topThk / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  // green leather inlay
  const inlay = new THREE.Mesh(
    new THREE.BoxGeometry(W - 0.22, 0.012, D - 0.18),
    new THREE.MeshStandardMaterial({ color: COL.leather, roughness: 0.6, metalness: 0.02 })
  );
  inlay.position.set(0, DESK_TOP + 0.002, 0);
  inlay.receiveShadow = true;
  g.add(inlay);

  // brass trim around the inlay
  const trim = brassMat();
  const inW = W - 0.2;
  const inD = D - 0.16;
  const t = 0.012;
  [[0, inD / 2], [0, -inD / 2]].forEach(([x, z]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(inW, 0.006, t), trim);
    bar.position.set(x, DESK_TOP + 0.006, z);
    g.add(bar);
  });
  [[inW / 2, 0], [-inW / 2, 0]].forEach(([x, z]) => {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(t, 0.006, inD), trim);
    bar.position.set(x, DESK_TOP + 0.006, z);
    g.add(bar);
  });

  // two pedestals with drawers
  const pedW = 0.5;
  const pedH = DESK_TOP - topThk;
  const pedD = D - 0.06;
  [-(W / 2 - pedW / 2 - 0.05), W / 2 - pedW / 2 - 0.05].forEach((px) => {
    g.add(buildPedestal(px, pedW, pedH, pedD));
  });

  // back modesty panel
  const modesty = new THREE.Mesh(
    new RoundedBoxGeometry(W - 2 * pedW - 0.2, pedH - 0.18, 0.04, 2, 0.008),
    woodMaterial(2, 1)
  );
  modesty.position.set(0, pedH / 2 + 0.04, -(D / 2 - 0.06));
  modesty.castShadow = true;
  modesty.receiveShadow = true;
  g.add(modesty);

  return g;
}

function buildPedestal(px, pedW, pedH, pedD) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(pedW, pedH, pedD, 3, 0.01),
    woodMaterial(1, 1.4)
  );
  body.position.set(px, pedH / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // 3 inset drawer fronts on the front face (+z)
  const faceZ = pedD / 2 + 0.006;
  const n = 3;
  const margin = 0.04;
  const gap = 0.018;
  const dh = (pedH - 2 * margin - (n - 1) * gap) / n;
  const dw = pedW - 2 * margin;
  for (let i = 0; i < n; i++) {
    const cy = margin + dh / 2 + i * (dh + gap);
    const front = new THREE.Mesh(
      new RoundedBoxGeometry(dw, dh, 0.025, 2, 0.006),
      woodMaterial(1, 1, 0x8a6038)
    );
    front.position.set(px, cy, faceZ);
    front.castShadow = true;
    g.add(front);
    // brass knob
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 18, 18), brassMat());
    knob.position.set(px, cy, faceZ + 0.022);
    g.add(knob);
  }
  return g;
}

/* ============================================================
   props
   ============================================================ */

function buildBankersLamp() {
  const g = new THREE.Group();
  const x = -0.6;
  const z = -0.16;

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.095, 0.022, 32),
    brassMat()
  );
  base.position.set(x, DESK_TOP + 0.011, z);
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);

  // column up to the shade
  const colH = 0.2;
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.014, colH, 18),
    brassMat()
  );
  column.position.set(x, DESK_TOP + 0.022 + colH / 2, z);
  column.castShadow = true;
  g.add(column);

  const shadeY = DESK_TOP + 0.022 + colH; // top of column
  const shadeR = 0.085;
  const shadeLen = 0.28;

  // green outer shell (half tube, opening down)
  const outer = new THREE.Mesh(
    new THREE.CylinderGeometry(shadeR, shadeR, shadeLen, 28, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({
      color: COL.shadeGreen,
      roughness: 0.4,
      metalness: 0.15,
      side: THREE.FrontSide,
    })
  );
  outer.rotation.z = Math.PI / 2; // tube axis -> X
  outer.position.set(x, shadeY, z);
  outer.castShadow = true;
  g.add(outer);

  // cream inner liner (visible from below), faintly glowing
  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(shadeR - 0.004, shadeR - 0.004, shadeLen - 0.01, 28, 1, true, 0, Math.PI),
    new THREE.MeshStandardMaterial({
      color: COL.shadeCream,
      roughness: 0.6,
      metalness: 0,
      emissive: new THREE.Color(0xffd9a0),
      emissiveIntensity: 0.35,
      side: THREE.BackSide,
    })
  );
  inner.rotation.z = Math.PI / 2;
  inner.position.set(x, shadeY, z);
  g.add(inner);

  // warm bulb under the shade
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.028, 16, 16),
    new THREE.MeshBasicMaterial({ color: COL.bulb })
  );
  bulb.position.set(x, shadeY - 0.02, z);
  g.add(bulb);

  return g;
}

function buildPenCup(x, z) {
  const g = new THREE.Group();
  const cupH = 0.1;
  const cupR = 0.04;
  const mat = new THREE.MeshStandardMaterial({
    color: COL.brassDark,
    roughness: 0.4,
    metalness: 0.85,
  });
  // wall
  const wall = new THREE.Mesh(
    new THREE.CylinderGeometry(cupR, cupR - 0.004, cupH, 24, 1, true),
    mat
  );
  wall.position.set(x, DESK_TOP + cupH / 2, z);
  wall.castShadow = true;
  wall.receiveShadow = true;
  g.add(wall);
  // bottom
  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(cupR - 0.004, cupR - 0.004, 0.01, 24), mat);
  bottom.position.set(x, DESK_TOP + 0.006, z);
  g.add(bottom);

  // pens seated inside, tips up
  const penDefs = [
    [0.012, 0.008, 0xb98b35, 0.05],
    [-0.013, -0.006, 0x2e4636, -0.04],
    [0.004, -0.014, 0x47202a, 0.02],
  ];
  penDefs.forEach(([dx, dz, c, tilt]) => {
    const penH = 0.17;
    const pen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.005, 0.004, penH, 10),
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.3 })
    );
    // bottom rests near cup bottom; lean within the cup
    pen.position.set(x + dx, DESK_TOP + penH / 2 - 0.01, z + dz);
    pen.rotation.set(tilt, 0, dx * 1.6);
    pen.castShadow = true;
    g.add(pen);
  });
  return g;
}

function buildMug(x, z) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x244033, roughness: 0.5, metalness: 0.05 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.085, 24), mat);
  body.position.set(x, DESK_TOP + 0.043, z);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const coffee = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.005, 24),
    new THREE.MeshStandardMaterial({ color: 0x140b06, roughness: 0.4 })
  );
  coffee.position.set(x, DESK_TOP + 0.082, z);
  g.add(coffee);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.007, 12, 24), mat);
  handle.position.set(x + 0.045, DESK_TOP + 0.045, z);
  handle.rotation.y = Math.PI / 2;
  g.add(handle);
  return g;
}

function buildPaperStack(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.004, 0.28),
      new THREE.MeshStandardMaterial({ color: COL.paper, roughness: 0.95 })
    );
    sheet.position.set(x + (Math.random() - 0.5) * 0.01, DESK_TOP + 0.004 + i * 0.004, z + (Math.random() - 0.5) * 0.01);
    sheet.rotation.y = (Math.random() - 0.5) * 0.1;
    sheet.castShadow = true;
    sheet.receiveShadow = true;
    g.add(sheet);
  }
  return g;
}

function buildBookStack(x, z) {
  const g = new THREE.Group();
  let y = DESK_TOP;
  for (let i = 0; i < 4; i++) {
    const w = 0.26 - i * 0.012;
    const d = 0.19 - i * 0.01;
    const h = 0.03 + Math.random() * 0.016;
    const col = COL.bookSpines[Math.floor(Math.random() * COL.bookSpines.length)];
    const rot = (Math.random() - 0.5) * 0.16;
    const book = new THREE.Mesh(
      new RoundedBoxGeometry(w, h, d, 2, 0.004),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.7, metalness: 0.02 })
    );
    book.position.set(x + (Math.random() - 0.5) * 0.02, y + h / 2, z);
    book.rotation.y = rot;
    book.castShadow = true;
    book.receiveShadow = true;
    g.add(book);
    y += h;
  }
  return g;
}

function buildOpenBook(x, z) {
  const g = new THREE.Group();
  const cover = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.014, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x47202a, roughness: 0.7, metalness: 0.02 })
  );
  cover.position.set(x, DESK_TOP + 0.007, z);
  cover.castShadow = true;
  cover.receiveShadow = true;
  g.add(cover);
  const pageMat = new THREE.MeshStandardMaterial({ color: COL.paper, roughness: 0.92 });
  [-0.083, 0.083].forEach((dx) => {
    const page = new THREE.Mesh(new THREE.BoxGeometry(0.158, 0.006, 0.22), pageMat);
    page.position.set(x + dx, DESK_TOP + 0.016, z);
    page.rotation.z = dx < 0 ? 0.02 : -0.02;
    page.receiveShadow = true;
    g.add(page);
  });
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
   bootstrap — after all definitions
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
