/* ============================================================
   experience.js — 3D desk experience
   Phase 2: HDRI image-based lighting + procedural desk/monitor +
   soft contact shadow, "Enter the desk" wired (cover fade +
   camera fly-in). Project models / clickable hotspots come next.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
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
const enterBtn = document.getElementById("enter-btn");

if (!canvas || !webglSupported()) {
  document.documentElement.classList.add("exp-no-webgl");
  console.warn("[experience] WebGL unavailable — static fallback in use");
} else {
  initScene(canvas);
}

const easeInOutCubic = (x) =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

function initScene(canvas) {
  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0c);

  /* ---------- camera + controls ---------- */
  const REST_POS = new THREE.Vector3(1.7, 1.18, 2.2);
  const REST_TARGET = new THREE.Vector3(0, 0.72, 0);
  const FLY_POS = new THREE.Vector3(3.4, 2.7, 4.7);

  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.copy(REST_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.7;
  controls.maxDistance = 5.5;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = Math.PI / 2 - 0.06; // never dip under the desk
  controls.target.copy(REST_TARGET);
  controls.update();

  /* ---------- HDRI image-based lighting ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  new RGBELoader().load(
    "hdri/studio_small_03_1k.hdr",
    (tex) => {
      const env = pmrem.fromEquirectangular(tex).texture;
      scene.environment = env;
      scene.environmentIntensity = 0.2; // moody, dialed down
      tex.dispose();
      pmrem.dispose();
    },
    undefined,
    (err) => console.warn("[experience] HDRI load failed", err)
  );

  // One key light for a crisp highlight + grounded shadow.
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3.2, 5.2, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 5;
  scene.add(key);

  /* ---------- floor ---------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardMaterial({
      color: 0x070709,
      roughness: 0.97,
      metalness: 0.0,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  /* ---------- procedural desk ---------- */
  const desk = buildDesk();
  scene.add(desk);

  /* ---------- soft contact shadow under the desk ---------- */
  const contact = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.9),
    new THREE.MeshBasicMaterial({
      map: makeRadialShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
    })
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.013, 0.02);
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

  /* ---------- enter / camera fly-in ---------- */
  let introStart = null;
  const INTRO_MS = 1700;
  const introTargetFrom = new THREE.Vector3(0, 0.55, 0);

  function enterScene() {
    if (document.documentElement.classList.contains("exp-entered")) return;
    document.documentElement.classList.add("exp-entered");
    if (prefersReducedMotion) {
      camera.position.copy(REST_POS);
      controls.target.copy(REST_TARGET);
      controls.enabled = true;
      controls.update();
    } else {
      controls.enabled = false;
      camera.position.copy(FLY_POS);
      introStart = null; // set on first frame using the loop clock
      introPending = true;
    }
  }
  let introPending = false;

  if (enterBtn) {
    enterBtn.removeAttribute("aria-disabled");
    enterBtn.addEventListener("click", enterScene);
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
      const look = introTargetFrom.clone().lerp(REST_TARGET, e);
      camera.lookAt(look);
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

  window.__exp = { THREE, scene, camera, renderer, controls, enterScene };
  console.info(
    `[experience] phase2 desk live — ${HERO_PROJECTS.length} hero objects pending`
  );
}

/* ============================================================
   builders
   ============================================================ */

function buildDesk() {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({
    color: 0x101114,
    roughness: 0.86,
    metalness: 0.04,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0x2a2c31,
    roughness: 0.4,
    metalness: 0.85,
  });

  // desk top — surface at y = 0.74
  const topThk = 0.06;
  const topW = 2.1;
  const topD = 1.0;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(topW, topThk, topD),
    woodMat
  );
  top.position.set(0, 0.74 - topThk / 2, 0);
  top.castShadow = true;
  top.receiveShadow = true;
  group.add(top);

  // four legs
  const legH = 0.74 - topThk;
  const legGeo = new THREE.BoxGeometry(0.05, legH, 0.05);
  const lx = topW / 2 - 0.09;
  const lz = topD / 2 - 0.09;
  [
    [lx, lz],
    [-lx, lz],
    [lx, -lz],
    [-lx, -lz],
  ].forEach(([x, z]) => {
    const leg = new THREE.Mesh(legGeo, metalMat);
    leg.position.set(x, legH / 2, z);
    leg.castShadow = true;
    leg.receiveShadow = true;
    group.add(leg);
  });

  // monitor at the back
  group.add(buildMonitor());

  return group;
}

function buildMonitor() {
  const group = new THREE.Group();
  const deskTop = 0.74;

  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x0c0c0e,
    roughness: 0.45,
    metalness: 0.3,
  });
  const standMat = new THREE.MeshStandardMaterial({
    color: 0x202227,
    roughness: 0.35,
    metalness: 0.9,
  });

  // stand base + neck
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.15, 0.018, 32),
    standMat
  );
  base.position.set(0, deskTop + 0.009, -0.28);
  base.castShadow = true;
  base.receiveShadow = true;
  group.add(base);

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.2, 0.03),
    standMat
  );
  neck.position.set(0, deskTop + 0.12, -0.29);
  neck.castShadow = true;
  group.add(neck);

  // screen bezel
  const screenW = 0.78;
  const screenH = 0.46;
  const bezel = new THREE.Mesh(
    new THREE.BoxGeometry(screenW, screenH, 0.022),
    bezelMat
  );
  bezel.position.set(0, deskTop + 0.36, -0.28);
  bezel.rotation.x = -0.07;
  bezel.castShadow = true;
  group.add(bezel);

  // emissive screen face (decorative glow; becomes the CFD project later)
  const screenFace = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW - 0.04, screenH - 0.04),
    new THREE.MeshBasicMaterial({ color: 0x0e1b30 })
  );
  screenFace.position.set(0, deskTop + 0.36, -0.2685);
  screenFace.rotation.x = -0.07;
  group.add(screenFace);

  // faint accent line on the screen
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW - 0.18, 0.006),
    new THREE.MeshBasicMaterial({ color: ACCENT })
  );
  line.position.set(0, deskTop + 0.30, -0.268);
  line.rotation.x = -0.07;
  group.add(line);

  return group;
}

function makeRadialShadowTexture() {
  const s = 256;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, "rgba(0,0,0,0.6)");
  g.addColorStop(0.6, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
