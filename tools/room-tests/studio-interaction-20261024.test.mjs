import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';

// 2026-10-24 studio interaction batch: M3 (white project curtain), T11 (static
// markers, label docked above the exhibit) and M5 (keyboard framing orbits).
const site = new URL('../../', import.meta.url);
const read = (path) => readFile(new URL(path, site), 'utf8');
const room = await read('experience.js');
const navigationCSS = await read('studio-navigation.css');
const navigationSource = await read('studio-navigation.js');
const roomCSS = await read('experience.css');
const between = (source, from, to) => {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length);
  assert(start >= 0 && end > start, `Extract ${from.trim()}`);
  return source.slice(start, end);
};
const rule = (css, selector) => css.match(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]+)\\}`))?.[1] || '';

test('The project panel and frame are the white detail page, with no dark interstitial', () => {
  assert.doesNotMatch(navigationCSS, /#08090b/i);
  assert.match(rule(navigationCSS, '.studio-project-page'), /background:\s*#fff\s*;/);
  assert.match(rule(navigationCSS, '.studio-project-frame'), /background:\s*#fff\s*;/);
  // "Opening project…" waits 400 ms; a page that is ready sooner never shows it.
  const loading = rule(navigationCSS, '.studio-project-loading');
  assert.match(loading, /opacity:\s*0\s*;/);
  assert.match(loading, /animation:\s*studio-project-slow\s+\d+ms\s+[\w-]+\s+400ms\s+forwards/);
  assert.match(navigationCSS, /\.studio-project-page\.is-returning \.studio-project-frame/);
});

function navigationHarness({ animations = true } = {}) {
  class EventHost {
    listeners = new Map();
    addEventListener(type, listener) { (this.listeners.get(type) || this.listeners.set(type, new Set()).get(type)).add(listener); }
    removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
    dispatchEvent(event) { for (const listener of [...(this.listeners.get(event.type) || [])]) listener(event); }
  }
  const window = new EventHost(), document = new EventHost(), motion = new EventHost();
  motion.matches = false;
  const location = new URL('https://portfolio.test/experience.html');
  const animationLog = [], paints = new Map(); let id = 0;
  Object.assign(document, { title: 'Studio', hidden: false, activeElement: null });
  window.matchMedia = () => motion;
  window.requestAnimationFrame = (callback) => { paints.set(++id, callback); return id; };
  window.cancelAnimationFrame = (key) => paints.delete(key);
  window.getComputedStyle = (element) => ({ opacity: String(element.animation?.opacity ?? element.style.opacity ?? 1) });
  class Element extends EventHost {
    constructor(tag) {
      super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this.style = {}; this.inert = false;
      const classes = new Set();
      this.classList = { add: (...n) => n.forEach((c) => classes.add(c)), remove: (...n) => n.forEach((c) => classes.delete(c)), contains: (c) => classes.has(c) };
      if (animations) this.animate = (keyframes, options) => {
        const animation = { element: this, keyframes, options, opacity: keyframes[0].opacity, state: 'running', onfinish: null,
          cancel() { this.state = 'cancelled'; }, finish() { this.opacity = keyframes.at(-1).opacity; this.onfinish?.(); } };
        this.animation = animation; animationLog.push(animation); return animation;
      };
      if (tag === 'iframe') { this.contentWindow = new EventHost(); this.contentWindow.Event = class { constructor(type) { this.type = type; } }; this.contentWindow.postMessage = () => {}; }
    }
    setAttribute(k, v) { this.attributes.set(k, v); } getAttribute(k) { return this.attributes.get(k) ?? null; } removeAttribute(k) { this.attributes.delete(k); }
    append(...elements) { for (const element of elements) { element.parentElement = this; this.children.push(element); } }
    remove() { if (this.parentElement) { const list = this.parentElement.children; list.splice(list.indexOf(this), 1); this.parentElement = null; } }
    get isConnected() { return this === document.body || Boolean(this.parentElement?.isConnected); }
    focus() { document.activeElement = this; }
    querySelector(selector) {
      for (const child of this.children) {
        if ((selector === '[role="status"]' && child.getAttribute('role') === 'status') || selector === child.tagName) return child;
        const nested = child.querySelector(selector); if (nested) return nested;
      }
      return null;
    }
  }
  document.body = new Element('body');
  document.createElement = (tag) => new Element(tag);
  const canvas = new Element('canvas'); document.body.append(canvas);
  document.getElementById = (key) => key === 'exp-canvas' ? canvas : null;
  window.projectData = { steering: { title: 'Steering' } };
  const entries = [{ url: location.href, state: null }]; let cursor = 0;
  const history = {
    get state() { return entries[cursor].state; },
    pushState(state, title, url) { entries.splice(cursor + 1); entries.push({ state: JSON.parse(JSON.stringify(state)), url: String(url) }); cursor++; },
    replaceState(state, title, url) { entries[cursor] = { state: JSON.parse(JSON.stringify(state)), url: String(url) }; },
    go(delta) { cursor += delta; window.dispatchEvent({ type: 'popstate' }); },
  };
  const context = { URL, window, document, location, history, crypto: { randomUUID: () => 'room' }, setTimeout: () => 0, clearTimeout() {} };
  vm.runInNewContext(`${navigationSource.replace(/^export /gm, '')}\nglobalThis.create = createStudioNavigation;`, context);
  const navigation = context.create();
  const receive = (type) => {
    const frame = document.body.children.find((e) => e.className === 'studio-project-page')?.children.find((e) => e.tagName === 'iframe');
    window.dispatchEvent({ type: 'message', origin: location.origin, source: frame?.contentWindow, data: { protocol: 'kw-studio-project-v1', type } });
  };
  return { navigation, history, animationLog, receive,
    panel: () => document.body.children.find((e) => e.className === 'studio-project-page'),
    paint() { const callbacks = [...paints.values()]; paints.clear(); callbacks.forEach((callback) => callback()); } };
}

test('Return hides the page content at once, then lifts the white curtain over 240 ms ease-out', () => {
  const h = navigationHarness();
  h.navigation.openProject('steering'); h.receive('ready');
  for (const animation of h.animationLog) animation.finish();
  h.history.go(-1);
  const panel = h.panel();
  assert(panel.classList.contains('is-returning'), 'Only the white curtain remains while the room repaints');
  h.paint(); h.paint();
  const curtain = h.animationLog.at(-1);
  assert.equal(curtain.element, panel);
  assert.equal(curtain.options.duration, 240);
  assert.equal(curtain.options.easing, 'cubic-bezier(.33, 1, .68, 1)');
  assert.deepEqual(JSON.parse(JSON.stringify(curtain.keyframes)), [{ opacity: 1 }, { opacity: 0 }]);
  assert.equal(h.navigation.snapshot().returnMs, 240);
});

test('Forward during the curtain lift shows the same project content again', () => {
  const h = navigationHarness();
  h.navigation.openProject('steering'); h.receive('ready');
  for (const animation of h.animationLog) animation.finish();
  h.history.go(-1); h.paint(); h.paint();
  h.history.go(1);
  assert.equal(h.panel().classList.contains('is-returning'), false);
  assert.equal(h.navigation.snapshot().phase, 'entering');
});

test('Interact markers are static; hover eases their size instead of snapping it', () => {
  const markers = between(room, '    // Interact markers (T11', '    placeLabel();');
  assert.doesNotMatch(markers, /Math\.sin|position\.y\s*=|material\.opacity\s*=/);
  assert.match(markers, /MARKER_HOVER : MARKER_REST/);
  assert.match(markers, /easeOutCubic\(k\)/);
  assert.match(room, /const MARKER_REST = 0\.048, MARKER_HOVER = 0\.066, MARKER_EASE_MS = 180;/);
  assert.match(room, /const interactionMotion = [^;]*markerMotion;/, 'An easing marker keeps frames coming until it lands');
});

test('The hover label is docked above the exhibit and fades in over 120 ms, for pointer and keyboard', () => {
  assert.match(room, /const LABEL_GAP = 8, LABEL_EDGE = 8, LABEL_FADE_MS = 120;/);
  const hover = between(room, '  function setHover(root) {', '  function pickHotspot() {');
  assert.doesNotMatch(hover, /labelEl\.style|style\.(left|top)/, 'The pointer no longer positions the label');
  assert.match(hover, /showLabel\(\);/);
  const keyboard = between(room, '  function kbHighlight(order, next', '  renderer.domElement.addEventListener("keydown"');
  assert.doesNotMatch(keyboard, /style\.(left|top)/);
  assert.doesNotMatch(rule(roomCSS, '.exp-label'), /translate\(-50%/);
  assert.match(rule(roomCSS, '.exp-label--pending'), /opacity:\s*0/);
});

test('Keyboard framing orbits never write the retained room returnState', () => {
  const framing = between(room, '  /* ---------- keyboard framing (M5', '  window.__exp = {');
  assert.doesNotMatch(framing, /ROOM_RETURN_KEY|studioRoomReturn|sessionStorage|replaceState/);
  assert.match(framing, /flight\.arc = flight\.kb = true;/);
});

// Run the real framing math against a REST camera at 1440x900.
// The room's landscape and portrait rest poses (experience.js REST_POSES).
const LANDSCAPE = { aspect: 1440 / 900, fov: 42, position: [1.55, 1.58, 2.6], target: [0, 1.08, -0.1] };
const PORTRAIT = { aspect: 390 / 844, fov: 62.8, position: [1.2, 1.7, 2.2], target: [0.2, 1.0, -0.6] };
function framingHarness(pose = LANDSCAPE) {
  const geometry = between(room, '  const HOTSPOT_POINTS = ', '  function placeLabel() {');
  const framing = between(room, '  const KB_SAFE = ', '  function kbGo(');
  const shell = room.match(/const ROOM_SHELL = \{[^}]+\};/)[0];
  const camera = new THREE.PerspectiveCamera(pose.fov, pose.aspect, 0.1, 100);
  const REST_POS = new THREE.Vector3(...pose.position), REST_TARGET = new THREE.Vector3(...pose.target);
  const controls = { target: REST_TARGET.clone(), minAzimuthAngle: -Math.PI * 0.32, maxAzimuthAngle: Math.PI * 0.32,
    minDistance: 1.4, addEventListener() {} };
  const place = (pos, look) => { camera.position.copy(pos); camera.lookAt(look); controls.target.copy(look); camera.updateMatrixWorld(); };
  place(REST_POS, REST_TARGET);
  // stops: the keyboard order (kbOrder), which portrait framing groups into cabinets.
  const context = { THREE, camera, controls, REST_POS, REST_TARGET, MARKER_HOVER: 0.066, Math, Array, Infinity, Set, Map, stops: [] };
  vm.runInNewContext(`${shell}\nlet flight = null, kbDisplaced = false; const V_TMP = new THREE.Vector3();\nconst kbOrder = () => [...stops];\n${geometry}\n${framing}\n` +
    'globalThis.api = { kbGoal, kbOvershoot, hotspotPoints, set flight(v) { flight = v; }, set displaced(v) { kbDisplaced = v; } };', context);
  // An exhibit hotspot: a pivot at the exhibit's center holding its pick box and marker.
  const hotspot = (center, size) => {
    const pivot = new THREE.Group(); pivot.position.fromArray(center);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...size)); pivot.add(proxy);
    const marker = new THREE.Object3D(); marker.position.y = size[1] / 2 + 0.09; pivot.add(marker);
    pivot.userData.hotspot = { pickProxy: proxy, marker };
    pivot.updateMatrixWorld(true);
    return pivot;
  };
  return { api: context.api, camera, controls, place, REST_POS, REST_TARGET, hotspot, shell: context };
}

test('A main-cabinet stop stays put; a right-wall stop orbits the fixed target into the safe frame', () => {
  const h = framingHarness();
  const steering = h.hotspot([0, 1.36, -1.08], [0.5, 0.3, 0.4]);
  assert.equal(h.api.kbGoal(steering), null);
  const seat = h.hotspot([2.24, 1.88, -0.45], [0.34, 0.4, 0.58]);
  const goal = h.api.kbGoal(seat);
  assert(goal && !goal.rest);
  assert.deepEqual(goal.look.toArray(), h.REST_TARGET.toArray(), 'The orbit keeps the target fixed');
  const offset = new THREE.Spherical().setFromVector3(goal.pos.clone().sub(goal.look));
  assert(Math.abs(offset.theta) <= Math.PI * 0.32, 'Inside the azimuth limits');
  assert(offset.radius >= 1.4 - 1e-9, 'No closer than minDistance');
  assert(Math.abs(goal.pos.x) <= 2.35 && goal.pos.z <= 3.35 && goal.pos.z >= -1.25, 'Inside the room shell');
  assert(h.api.kbOvershoot(h.api.hotspotPoints(seat), goal.pos, goal.look, 0.1) <= 0, 'Framed inside the 10% safe frame');
});

test('Back on a stop that REST frames, a displaced camera orbits back to REST', () => {
  const h = framingHarness();
  const seat = h.hotspot([2.24, 1.88, -0.45], [0.34, 0.4, 0.58]);
  const goal = h.api.kbGoal(seat);
  h.place(goal.pos, goal.look); h.api.displaced = true;
  const steering = h.hotspot([0, 1.36, -1.08], [0.5, 0.3, 0.4]);
  const back = h.api.kbGoal(steering);
  assert(back && back.rest);
  assert.deepEqual(back.pos.toArray(), h.REST_POS.toArray());
  // A user-moved camera (not displaced by the keyboard) keeps its own view.
  h.api.displaced = false;
  assert.equal(h.api.kbGoal(steering), null);
});

test('A running keyboard orbit is judged by where it lands', () => {
  const h = framingHarness();
  const seat = h.hotspot([2.24, 1.88, -0.45], [0.34, 0.4, 0.58]);
  const goal = h.api.kbGoal(seat);
  h.api.flight = { kb: true, toPos: goal.pos, toLook: goal.look };
  assert.equal(h.api.kbGoal(seat), null, 'Already headed to a pose that frames it: keep flying');
});

test('A narrow portrait screen that cannot frame the right wall still orbits within the limits, toward the stop', () => {
  const h = framingHarness(PORTRAIT);
  const seat = h.hotspot([2.24, 1.88, -0.45], [0.34, 0.4, 0.58]);
  const goal = h.api.kbGoal(seat);
  assert(goal && !goal.rest);
  const offset = new THREE.Spherical().setFromVector3(goal.pos.clone().sub(goal.look));
  assert(Math.abs(offset.theta) <= Math.PI * 0.32 && offset.radius >= 1.4 - 1e-9);
  assert(Math.abs(goal.pos.x) <= 2.35 && goal.pos.z <= 3.35 && goal.pos.z >= -1.25);
  const n = h.api.hotspotPoints(seat);
  assert(h.api.kbOvershoot(n, goal.pos, goal.look, 0) < h.api.kbOvershoot(n, h.REST_POS, h.REST_TARGET, 0),
    'Less of the stop is off screen than at REST');
  // 2026-10-24 round 2: the workbench kit is past the azimuth limit there, so
  // orbiting alone shows none of it; the target pans toward it instead, and
  // that pose (inside the limits and the room shell) frames it.
  const kit = h.hotspot([-2.07, 0.89, -0.1], [0.24, 0.22, 0.4]);
  const toKit = h.api.kbGoal(kit);
  assert(toKit && !toKit.rest);
  const kitOffset = new THREE.Spherical().setFromVector3(toKit.pos.clone().sub(toKit.look));
  assert(Math.abs(kitOffset.theta) <= Math.PI * 0.32 && kitOffset.radius >= 1.4 - 1e-9, 'Inside the orbit limits');
  assert(Math.abs(toKit.pos.x) <= 2.35 && toKit.pos.z <= 3.35 && toKit.pos.z >= -1.25, 'Inside the room shell');
  assert(h.api.kbOvershoot(h.api.hotspotPoints(kit), toKit.pos, toKit.look, 0) <= 0, 'The kit is on screen');
});

// The room's keyboard stops: pick-box centers and sizes measured in the room (2026-10-24).
const STOPS = [
  ['carbonSeat', [-0.73, 1.83, -1.08], [0.39, 0.3, 0.4]], ['aura', [0, 1.77, -1.08], [0.38, 0.18, 0.4]],
  ['scanner', [0.73, 1.81, -1.08], [0.4, 0.25, 0.32]], ['javelin', [-0.73, 1.31, -1.08], [0.23, 0.21, 0.4]],
  ['steering', [0, 1.34, -1.08], [0.4, 0.28, 0.4]], ['brakeSim', [0.73, 1.34, -1.08], [0.27, 0.28, 0.08]],
  ['materialTest', [-0.73, 0.91, -1.08], [0.21, 0.38, 0.21]], ['ansysCfd', [0, 0.79, -1.08], [0.47, 0.14, 0.34]],
  ['vineRobot', [0.73, 0.9, -1.08], [0.38, 0.35, 0.4]], ['seat', [2.24, 1.78, -0.45], [0.34, 0.2, 0.29]],
  ['ftc', [2.24, 1.84, 0.25], [0.29, 0.32, 0.23]], ['formlabs', [2.24, 1.34, -0.45], [0.34, 0.28, 0.47]],
  ['pool', [2.24, 1.26, 0.25], [0.18, 0.12, 0.5]], ['telecaster', [2.24, 0.91, -0.45], [0.04, 0.38, 0.12]],
  ['lineFollower', [2.24, 0.77, 0.25], [0.33, 0.09, 0.4]], ['education', [-2.07, 0.8, -0.1], [0.23, 0.04, 0.38]],
  ['resume', [0.02, 0.77, 0.16], [0.27, 0.01, 0.33]], ['lamp', [-0.69, 1.03, 0.14], [0.58, 0.61, 0.28]],
];

test('Portrait keyboard framing gives every stop one pose whatever the path, and keeps the main cabinet at REST', () => {
  const h = framingHarness(PORTRAIT);
  const stops = STOPS.map(([key, center, size]) => Object.assign(h.hotspot(center, size), { key }));
  h.shell.stops = stops;
  const poses = new Map(), moves = [];
  let displaced = false, last = h.REST_POS.clone();
  const poseOf = (pos, look) => pos.toArray().concat(look.toArray()).map((v) => v.toFixed(4)).join();
  // Arrow through the stops as the room does: fly to each goal (none: stay).
  const visit = (stop) => {
    h.api.displaced = displaced;
    const goal = h.api.kbGoal(stop);
    if (goal) { h.place(goal.pos, goal.look); displaced = !goal.rest; }
    const pose = poseOf(h.camera.position, h.controls.target);
    if (poses.has(stop.key)) assert.equal(pose, poses.get(stop.key), `${stop.key}: the same pose on every pass`);
    else poses.set(stop.key, pose);
    moves.push([stop.key, h.camera.position.distanceTo(last)]); last = h.camera.position.clone();
    assert(h.api.kbOvershoot(h.api.hotspotPoints(stop), h.camera.position, h.controls.target, 0) <= 0.02, `${stop.key} is on screen`);
  };
  for (let pass = 0; pass < 2; pass++) stops.forEach(visit);
  [...stops].reverse().forEach(visit);
  const rest = poseOf(h.REST_POS, h.REST_TARGET);
  for (const [key] of STOPS.slice(0, 9)) assert.equal(poses.get(key), rest, `${key}: the main cabinet is framed from REST`);
  // Neighbours in the right-wall cabinet never swing the camera across the room.
  const wall = new Set(STOPS.slice(9, 15).map(([key]) => key));
  for (let i = 1; i < moves.length; i++) {
    if (wall.has(moves[i][0]) && wall.has(moves[i - 1][0])) assert(moves[i][1] < 1, `${moves[i - 1][0]} -> ${moves[i][0]}: ${moves[i][1].toFixed(2)} m`);
  }
});

// 2026-10-26 (approved T11 rule): run the real placeLabel against the
// landscape REST camera, with the topbar's two control groups (brand left,
// controls right) and the bottom dock as measured at 1440x900.
const HUD_1440 = { brand: [22, 16, 216, 65], right: [1092, 16, 1418, 66], dock: [457, 816, 983, 878] };
function labelHarness({ width = 1440, height = 900, hud = HUD_1440, size = [300, 51] } = {}) {
  const anchor = between(room, '  const LABEL_GAP = ', '  // Fresh label content:');
  const camera = new THREE.PerspectiveCamera(LANDSCAPE.fov, width / height, 0.1, 100);
  camera.position.fromArray(LANDSCAPE.position); camera.lookAt(new THREE.Vector3(...LANDSCAPE.target));
  camera.updateMatrixWorld();
  const el = ([left, top, right, bottom]) => ({ hidden: false, getBoundingClientRect: () => ({ left, top, right, bottom, width: right - left, height: bottom - top }) });
  const labelEl = { hidden: false, offsetWidth: size[0], offsetHeight: size[1], style: {} };
  const context = { THREE, camera, MARKER_HOVER: 0.066, Math, Array, Infinity, labelEl,
    renderer: { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) } },
    window: { innerWidth: width, innerHeight: height },
    document: {
      querySelector: (sel) => (sel === '.exp-brand' ? el(hud.brand) : sel === '.exp-topbar__right' ? el(hud.right) : null),
      getElementById: (id) => (id === 'exp-dock' ? el(hud.dock) : null),
    } };
  vm.runInNewContext(`let hovered = null;\n${anchor}\n` +
    'globalThis.api = { placeLabel, hotspotPoints, projectHotspot, set hovered(v) { hovered = v; } };', context);
  const hotspot = (center, size) => {
    const pivot = new THREE.Group(); pivot.position.fromArray(center);
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...size)); pivot.add(proxy);
    const marker = new THREE.Object3D(); marker.position.y = size[1] / 2 + 0.09; pivot.add(marker);
    pivot.userData.hotspot = { pickProxy: proxy, marker };
    pivot.updateMatrixWorld(true);
    return pivot;
  };
  // Hover a stop; returns the label's and the stop's (pick box + marker) px boxes.
  const hover = (pivot) => {
    context.api.hovered = pivot;
    context.api.placeLabel();
    const [x, y] = labelEl.style.transform.match(/-?[\d.]+(?=px)/g).map(Number);
    const n = context.api.projectHotspot(context.api.hotspotPoints(pivot), camera);
    const box = { left: (n.x0 + 1) / 2 * width, right: (n.x1 + 1) / 2 * width, top: (1 - n.y1) / 2 * height, bottom: (1 - n.y0) / 2 * height };
    return { label: { left: x, top: y, right: x + size[0], bottom: y + size[1] }, box };
  };
  // Whether a label at (x, y) stays on screen and 8 px clear of the HUD.
  const clear = (x, y) => y >= 8 && y + size[1] <= height - 8 && Object.values(hud).every(([l, t, r, b]) =>
    !(x < r + 8 && x + size[0] > l - 8 && y < b + 8 && y + size[1] > t - 8));
  return { hover, hotspot, clear, camera, width, height, size };
}

test('The hover label docks 8 px above the exhibit and its marker, centred; below only without room above; never beside it', () => {
  const h = labelHarness();
  const placed = new Map();
  for (const [key, center, size] of STOPS) {
    const { label, box } = h.hover(h.hotspot(center, size));
    assert(label.bottom <= box.top || label.top >= box.bottom, `${key}: the label is above or below its exhibit, never on it or beside it`);
    assert(label.left >= 8 && label.right <= h.width - 8, `${key}: clamped inside the viewport`);
    const centred = Math.round(Math.min(Math.max((box.left + box.right) / 2 - h.size[0] / 2, 8), h.width - 8 - h.size[0]));
    assert.equal(label.left, centred, `${key}: centred on the box, clamped only at the viewport edge`);
    const aboveY = Math.round(box.top - 8 - h.size[1]);
    if (h.clear(centred, aboveY)) {
      assert.equal(label.top, aboveY, `${key}: 8 px above the box`);
    } else {
      assert.equal(label.top, Math.round(box.bottom + 8), `${key}: no room above, so 8 px below`);
    }
    assert(h.clear(label.left, label.top), `${key}: the label clears the HUD`);
    placed.set(key, label.top < box.top ? 'above' : 'below');
  }
  // The top shelf's centre stops sit under the topbar's empty middle: still above.
  assert.equal(placed.get('aura'), 'above');
  assert.equal(placed.get('carbonSeat'), 'above');
  assert([...placed.values()].filter((p) => p === 'above').length >= 15, 'Most stops dock above at REST');
  // A stop at the very top of the screen has no room above: the label docks below it.
  const depth = new THREE.Vector3(0, 1.3, -1.08).project(h.camera).z;
  const high = h.hover(h.hotspot(new THREE.Vector3(0, 0.88, depth).unproject(h.camera).toArray(), [0.2, 0.1, 0.2]));
  assert(high.box.top < 8 + 8 + h.size[1], 'the probe stop is at the top edge');
  assert.equal(high.label.top, Math.round(high.box.bottom + 8));
  // A stop at the left screen edge: the label is clamped 8 px inside, still above.
  const edge = h.hover(h.hotspot(new THREE.Vector3(-0.96, 0, depth).unproject(h.camera).toArray(), [0.2, 0.2, 0.2]));
  assert(edge.box.left < 150, 'the probe stop is at the left edge');
  assert.equal(edge.label.left, 8);
  assert.equal(edge.label.top, Math.round(edge.box.top - 8 - h.size[1]));
});
