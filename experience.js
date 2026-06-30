/* ============================================================
   experience.js — 3D desk experience
   Phase 1: live WebGL scene (renderer, camera, constrained
   OrbitControls, floor, placeholder object, render loop).
   Lighting here is temporary; Phase 2 replaces it with HDRI IBL
   and a procedural desk. Models/hotspots come in later phases.
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
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

if (!canvas || !webglSupported()) {
  // No WebGL: leave the accessible intro/fallback exactly as-is.
  document.documentElement.classList.add("exp-no-webgl");
  console.warn("[experience] WebGL unavailable — static fallback in use");
} else {
  initScene(canvas);
}

function initScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0c);

  const camera = new THREE.PerspectiveCamera(
    42,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(2.6, 1.9, 3.4);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 1.8;
  controls.maxDistance = 6.5;
  controls.minPolarAngle = 0.18;
  controls.maxPolarAngle = Math.PI / 2 - 0.04; // never dip under the floor
  controls.target.set(0, 0.45, 0);
  controls.update();

  // --- temporary lighting (Phase 2 replaces with HDRI IBL) ---
  const hemi = new THREE.HemisphereLight(0xbfcad6, 0x070708, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(3.5, 5.5, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 22;
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 6;
  scene.add(key);

  // --- floor ---
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({
      color: 0x0c0d10,
      roughness: 0.92,
      metalness: 0.0,
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- placeholder hero object (Phase 2+ replaces with desk + models) ---
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.85, 0.85),
    new THREE.MeshStandardMaterial({
      color: 0x6e7277,
      roughness: 0.38,
      metalness: 0.65,
    })
  );
  placeholder.position.set(0, 0.45, 0);
  placeholder.castShadow = true;
  placeholder.receiveShadow = true;
  scene.add(placeholder);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(placeholder.geometry),
    new THREE.LineBasicMaterial({ color: ACCENT })
  );
  placeholder.add(edges);

  // --- resize ---
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  // --- pause render loop when tab/canvas not visible (perf) ---
  let running = true;
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
  });

  // --- render loop ---
  renderer.setAnimationLoop(() => {
    if (!running) return;
    if (!prefersReducedMotion) placeholder.rotation.y += 0.005;
    controls.update();
    renderer.render(scene, camera);
  });

  // Expose for debugging / verification.
  window.__exp = { THREE, scene, camera, renderer, controls };
  console.info(
    `[experience] phase1 scene live — ${HERO_PROJECTS.length} hero objects pending`
  );
}
