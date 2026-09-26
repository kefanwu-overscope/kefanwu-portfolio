import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Decorative workshop models in metres. These are original generic models,
// not a dimensional claim about a particular manufacturer's machine. The
// printer's .49 x .62 x .50 body and every bench placement match the old room.
// Small opaque parts are merged by material; only the actual moving assemblies
// and transparent panels stay separate. There are no downloaded model assets.
const TAU = Math.PI * 2;
const V = (p) => new THREE.Vector3(...p);
const palette = {};
function material(name, color, roughness = .57, metalness = 0) {
  if (!palette[name]) palette[name] = new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: .65 });
  return palette[name];
}
function finishes() {
  return {
    shell: material("shell", 0xaeb3ba, .49, .36),
    alu: material("alu", 0x8f98a3, .54, .78),
    steel: material("steel", 0xa4aab0, .5, .82),
    dark: material("dark", 0x282d34, .6, .22),
    black: material("black", 0x11161c, .72, .04),
    rubber: material("rubber", 0x161b20, .86),
    blue: material("blue", 0x245994, .58, .02),
    red: material("red", 0x9f3834, .65),
    brass: material("brass", 0x9f8550, .6, .63),
    white: material("white", 0xc9cdd0, .63),
    wood: material("wood", 0x75553b, .76),
    green: material("green", 0x74a387, .5),
  };
}
function mesh(parent, geometry, mat, p = [0, 0, 0], r = [0, 0, 0], name = "") {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(...p); m.rotation.set(...r); m.name = name;
  m.castShadow = !mat.transparent; m.receiveShadow = true;
  parent.add(m); return m;
}
function box(parent, size, mat, p, r, name) {
  return mesh(parent, new THREE.BoxGeometry(...size), mat, p, r, name);
}
function roundedGeometry(w, h, d, b = .002) {
  b = Math.min(b, w / 4, h / 4, d / 3);
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + b, -h / 2 + b);
  s.lineTo(w / 2 - b, -h / 2 + b); s.lineTo(w / 2 - b, h / 2 - b);
  s.lineTo(-w / 2 + b, h / 2 - b); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, steps: 1, curveSegments: 1,
    bevelEnabled: true, bevelSize: b, bevelThickness: b, bevelSegments: 1 });
  geo.translate(0, 0, -d / 2 + b); geo.clearGroups(); return geo;
}
function rounded(parent, size, mat, p, r, b = .002, name) {
  return mesh(parent, roundedGeometry(...size, b), mat, p, r, name);
}
function cylinder(parent, radius, length, mat, p, r, radius2 = radius, segments = 16, name) {
  return mesh(parent, new THREE.CylinderGeometry(radius, radius2, length, segments), mat, p, r, name);
}
function rod(parent, a, b, radius, mat, segments = 10, radius2 = radius) {
  const delta = V(b).sub(V(a));
  const o = cylinder(parent, radius, delta.length(), mat, V(a).add(V(b)).multiplyScalar(.5).toArray(), undefined, radius2, segments);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return o;
}
function tube(parent, points, radius, mat, segments = 28, radial = 6) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(V)), segments, radius, radial, false), mat);
}
function ring(parent, radius, wire, mat, p, r, segments = 24) {
  return mesh(parent, new THREE.TorusGeometry(radius, wire, 5, segments), mat, p, r);
}
function profile(parent, points, depth, mat, p, r, holes = []) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 2 });
  geo.translate(0, 0, -depth / 2); geo.clearGroups(); return mesh(parent, geo, mat, p, r);
}
function annulus(parent, outer, inner, depth, mat, p, r, sides = 24, innerSides = sides) {
  const loop = (radius, n, reverse = false) => Array.from({ length: n }, (_, i) => {
    const a = (reverse ? -i : i) * TAU / n; return [Math.cos(a) * radius, Math.sin(a) * radius];
  });
  return profile(parent, loop(outer, sides), depth, mat, p, r, [loop(inner, innerSides, true)]);
}
function screw(parent, p, radius = .003, r = [Math.PI / 2, 0, 0]) {
  const m = finishes();
  const head = cylinder(parent, radius, .0018, m.steel, p, r, radius, 10);
  const offset = new THREE.Vector3(0, .00105, 0).applyEuler(head.rotation).add(V(p));
  cylinder(parent, radius * .39, .0004, m.black, offset.toArray(), r, radius * .39, 6);
}
function assembly(parent, name, p, r) {
  const g = new THREE.Group(); g.name = name;
  if (p) g.position.set(...p); if (r) g.rotation.set(...r); parent?.add(g); return g;
}

let atlas;
const tiles = {
  printer: [0, 0, 256, 128], name: [256, 0, 256, 64], caliper: [256, 64, 128, 64],
  meter: [384, 64, 128, 64], rule: [0, 128, 64, 256], psu: [64, 128, 256, 64],
  solder: [320, 128, 192, 64], meterDial: [64, 192, 192, 192], warning: [256, 192, 128, 64],
  scale: [384, 192, 128, 192], labels: [0, 384, 512, 64],
};
function decalMaterial() {
  if (atlas) return atlas;
  if (typeof document === "undefined") {
    // Geometry/budget validation runs without a browser; no fake image assets
    // are written. Browsers always execute the actual 512 px atlas below.
    return material("validationDecal", 0x9ca9b0, .68);
  }
  const c = document.createElement("canvas"); c.width = c.height = 512;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#1a2027"; ctx.fillRect(0, 0, 512, 512);
  const label = (text, x, y, size, color = "#bfc8cf") => {
    ctx.fillStyle = color; ctx.font = `500 ${size}px Consolas, monospace`; ctx.fillText(text, x, y);
  };
  ctx.fillStyle = "#0a1219"; ctx.fillRect(4, 4, 248, 120);
  label("PRINTING", 15, 22, 13, "#79bba6"); label("66%", 22, 77, 32, "#d2dde3");
  label("NOZZLE 210 C", 117, 44, 12); label("BED     60 C", 117, 64, 12);
  label("LAYER 142/215", 117, 87, 12); label("BRACKET / PLA", 16, 110, 11);
  ctx.fillStyle = "#34434a"; ctx.fillRect(18, 87, 72, 4); ctx.fillStyle = "#65a88f"; ctx.fillRect(18, 87, 49, 4);
  label("CORE / XY", 278, 28, 23); label("ENCLOSED FDM SYSTEM", 279, 48, 11, "#8b98a2");
  ctx.fillStyle = "#a2b39d"; ctx.fillRect(260, 68, 120, 56); ctx.fillRect(388, 68, 120, 56);
  label("24.68", 267, 103, 28, "#27352e"); label("mm", 345, 116, 9, "#27352e");
  label("0.000", 395, 104, 27, "#27352e"); label("DC V", 392, 80, 9, "#27352e");
  ctx.fillStyle = "#aab2b8"; ctx.fillRect(0, 128, 64, 256);
  for (let i = 0; i < 60; i++) {
    const y = 130 + i * 4.1; ctx.fillStyle = "#38454c";
    ctx.fillRect(0, y, i % 10 === 0 ? 32 : i % 5 === 0 ? 24 : 14, 1);
    if (i % 10 === 0) label(String(i / 10), 37, y + 5, 10, "#38454c");
  }
  label("12.00 V", 79, 157, 25, "#87bfa5"); label(" 1.52 A", 79, 183, 23, "#c5b175");
  label("350 C", 336, 169, 32, "#d99376"); label("SET 350", 338, 186, 10);
  ctx.fillStyle = "#212933"; ctx.fillRect(64, 192, 192, 192);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 14 - Math.PI / 2;
    ctx.save(); ctx.translate(160, 288); ctx.rotate(a); ctx.fillStyle = "#a6b4bd"; ctx.fillRect(71, -1, 7, 2); ctx.restore();
    label(["OFF", "V", "mV", "A", "mA", "uA", "Hz", "Ω", "►|", "CAP", "°C", "V~"][i], 153 + Math.cos(a) * 86, 292 + Math.sin(a) * 84, 8);
  }
  ctx.fillStyle = "#b6a066"; ctx.beginPath(); ctx.moveTo(273, 237); ctx.lineTo(287, 211); ctx.lineTo(301, 237); ctx.closePath(); ctx.fill();
  label("!", 283, 233, 18, "#242a2e"); label("HOT", 310, 230, 16); label("BUILD PLATE", 272, 249, 9);
  ctx.fillStyle = "#aab2b8"; ctx.fillRect(384, 192, 128, 192);
  for (let i = 0; i < 24; i++) {
    const y = 195 + i * 7.7; ctx.fillStyle = "#34414b"; ctx.fillRect(394, y, i % 4 === 0 ? 42 : 23, 1);
    if (i % 4 === 0) label(String(i * 5), 452, y + 4, 11, "#34414b");
  }
  label("PRECISION / LAB", 12, 407, 14); label("CH1  CH2", 206, 407, 12); label("DC   COM   VΩ", 346, 407, 12);
  label("FINE   COARSE     OUTPUT", 16, 435, 10); label("TEMPERATURE", 285, 435, 11);
  const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  atlas = new THREE.MeshStandardMaterial({ map: texture, roughness: .64, metalness: .05, envMapIntensity: .4 });
  return atlas;
}
function decal(parent, tile, w, h, p, r) {
  const geo = new THREE.PlaneGeometry(w, h); const uv = geo.attributes.uv;
  const [x, y, width, height] = tiles[tile];
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * width) / 512, 1 - (y + (1 - uv.getY(i)) * height) / 512);
  return mesh(parent, geo, decalMaterial(), p, r);
}

// All shapes become one mesh per material and moving subtree. It avoids an
// individual draw call for every screw, belt tooth, vent louvre or grip rib.
function consolidate(root, keep = []) {
  const protectedSet = new Set(keep);
  const buckets = new Map(); const remove = []; const oldGeometries = new Set();
  root.updateMatrixWorld(true); const inverse = root.matrixWorld.clone().invert();
  function visit(o) {
    if (protectedSet.has(o)) return;
    if (o.isMesh && !o.material.transparent && !o.isInstancedMesh && !Array.isArray(o.material)) {
      let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      geo.clearGroups(); geo.applyMatrix4(inverse.clone().multiply(o.matrixWorld));
      if (!geo.attributes.normal) geo.computeVertexNormals();
      if (!geo.attributes.uv) geo.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      for (const key of Object.keys(geo.attributes)) if (!["position", "normal", "uv"].includes(key)) geo.deleteAttribute(key);
      if (!buckets.has(o.material)) buckets.set(o.material, []); buckets.get(o.material).push(geo);
      oldGeometries.add(o.geometry); remove.push(o);
    }
    for (const child of o.children) visit(child);
  }
  for (const child of root.children) visit(child);
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    if (!merged) throw new Error(`Cannot merge workshop geometry: ${root.name}`);
    merged.computeBoundingBox(); merged.computeBoundingSphere();
    mesh(root, merged, mat, undefined, undefined, `${root.name}_batch`);
    for (const geo of geos) geo.dispose();
  }
  for (const o of remove) o.removeFromParent();
  for (const geo of oldGeometries) geo.dispose();
  function clean(o) { for (const c of [...o.children]) { clean(c); if (c.isGroup && !c.children.length && !protectedSet.has(c)) c.removeFromParent(); } }
  clean(root); return root;
}
export function workbenchDetailStats(root) {
  root.updateMatrixWorld(true);
  let meshes = 0, triangles = 0, bytes = 0; const materials = new Set(); const geometries = new Set();
  root.traverse(o => {
    if (!o.isMesh) return; meshes++; materials.add(o.material);
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    if (!geometries.has(o.geometry)) {
      geometries.add(o.geometry); for (const a of Object.values(o.geometry.attributes)) bytes += a.array.byteLength;
      bytes += o.geometry.index?.array.byteLength ?? 0;
    }
  });
  const bounds = new THREE.Box3().setFromObject(root);
  return { meshes, triangles, geometryBytes: bytes, materials: materials.size, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
}

function makeSpool(parent, color, p, moving = false) {
  const m = finishes(); const g = assembly(parent, "filament_spool", p);
  // Axle along X. Spokes have real openings and the core remains hollow.
  const filament = material(`filament_${color}`, color, .69);
  for (const x of [-.027, .027]) {
    annulus(g, .070, .060, .003, m.white, [x, 0, 0], [0, Math.PI / 2, 0], 28);
    annulus(g, .024, .015, .003, m.white, [x, 0, 0], [0, Math.PI / 2, 0], 20);
    for (let i = 0; i < 8; i++) {
      const a = i * TAU / 8;
      rod(g, [x, Math.cos(a) * .022, Math.sin(a) * .022], [x, Math.cos(a) * .062, Math.sin(a) * .062], .0035, m.white, 6);
    }
  }
  annulus(g, .058, .023, .05, filament, [0, 0, 0], [0, Math.PI / 2, 0], 32);
  for (let i = 0; i < 15; i++) ring(g, .0581, .0004, filament, [-.023 + i * .0033, 0, 0], [0, Math.PI / 2, 0], 28);
  consolidate(g); if (moving) g.userData.animated = true; return g;
}

/** Drop-in replacement for the old printer builder; pass the room's MODELS. */
export function buildDetailedPrinter({ models = {} } = {}) {
  const m = finishes(); const g = assembly(null, "rt_detailed_printer");
  const W = .49, H = .62, D = .5;
  // Folded outer panels over an extrusion skeleton; narrow dark panel breaks
  // are actual construction seams, not a second box floating over the shell.
  rounded(g, [W, .024, D], m.dark, [0, .020, 0], undefined, .003);
  rounded(g, [.474, .020, .484], m.shell, [0, .610, 0], undefined, .003);
  rounded(g, [.012, .563, .475], m.shell, [-.239, .318, -.005], undefined, .002);
  rounded(g, [.012, .563, .475], m.shell, [.239, .318, -.005], undefined, .002);
  box(g, [.466, .560, .012], m.dark, [0, .318, -.239]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    cylinder(g, .018, .014, m.rubber, [sx * .194, .007, sz * .198], undefined, .021);
    rounded(g, [.021, .563, .023], m.dark, [sx * .221, .318, sz * .218], undefined, .0015);
    box(g, [.003, .538, .001], m.black, [sx * .221, .320, sz * .218 + .0121]);
  }
  // Separate rear inner liner leaves the complete .42 m chamber unobstructed.
  box(g, [.423, .531, .004], m.black, [0, .311, -.207]);
  for (const x of [-.215, .215]) {
    rounded(g, [.024, .476, .016], m.dark, [x, .303, -.137]);
    cylinder(g, .0038, .43, m.steel, [x, .286, -.123], undefined, .0038, 12);
    cylinder(g, .006, .416, m.alu, [x, .28, -.169], undefined, .006, 14);
    // The helical thread is one connected surface, merged with the screw.
    const helix = Array.from({ length: 201 }, (_, i) => [x + .0063 * Math.cos(i * TAU / 5), .074 + i * .002, -.169 + .0063 * Math.sin(i * TAU / 5)]);
    tube(g, helix, .0008, m.steel, 220, 4);
    cylinder(g, .010, .021, m.dark, [x, .496, -.169]);
    rounded(g, [.026, .033, .032], m.dark, [x, .067, -.169]);
    for (const y of [.084, .491]) screw(g, [x, y, -.125], .0022);
  }
  // Bed carrier arms connect the build plate to both rear Z nut blocks.
  for (const x of [-.184, .184]) {
    rounded(g, [.021, .027, .288], m.dark, [x, .101, -.012]);
    rounded(g, [.04, .033, .05], m.alu, [x, .111, -.146]);
    for (const z of [-.1, .15]) cylinder(g, .009, .008, m.black, [x, .12, z]);
  }
  rounded(g, [.394, .014, .324], m.dark, [0, .12, .025], undefined, .002);
  rounded(g, [.381, .003, .312], material("pei", 0x6c685e, .8, .28), [0, .129, .025], undefined, .001);
  rounded(g, [.069, .003, .015], m.dark, [0, .129, .185], undefined, .001);
  decal(g, "warning", .050, .023, [0, .1311, .164], [-Math.PI / 2, 0, 0]);
  for (const x of [-.17, .17]) for (const z of [-.107, .155]) screw(g, [x, .132, z], .0023, [0, 0, 0]);
  // A real open bracket profile with two through holes, seated on the plate.
  const printMat = material("printedBlue", 0x336bab, .76);
  const bracket = assembly(g, "printed_bracket", [0, .135, .083]);
  profile(bracket, [[-.052, -.027], [.052, -.027], [.052, .027], [-.052, .027]], .009, printMat,
    [0, 0, 0], [-Math.PI / 2, 0, 0], [-.035, .035].map(x => Array.from({ length: 12 }, (_, i) => [x + .005 * Math.cos(-i * TAU / 12), .012 + .005 * Math.sin(-i * TAU / 12)])));
  box(bracket, [.1, .035, .008], printMat, [0, .022, -.019]);
  for (const x of [-.027, .027]) profile(bracket, [[-.018, 0], [.018, 0], [-.018, .0345]], .005, printMat, [x, .0045, -.002], [0, Math.PI / 2, 0]);
  for (let i = 0; i < 12; i++) box(bracket, [.099, .0003, .00035], material("printLayer", 0x487dad, .82), [0, .006 + i * .0028, -.0148]);
  // Y rails, recirculating bearing trucks and X beam. Front-facing grooves
  // provide readable machining without expensive close-up normal textures.
  for (const x of [-.197, .197]) {
    rounded(g, [.017, .024, .363], m.dark, [x, .295, -.015]);
    box(g, [.009, .003, .35], m.steel, [x, .309, -.015]);
    for (const z of [-.16, -.09, -.02, .05, .12]) screw(g, [x, .3115, z], .002, [0, 0, 0]);
    rounded(g, [.033, .020, .047], m.alu, [x, .315, .035]);
    rounded(g, [.035, .007, .039], m.black, [x, .328, .035]);
    for (const z of [-.166, .158]) {
      cylinder(g, .012, .017, m.alu, [x, .328, z]);
      cylinder(g, .014, .002, m.dark, [x, .338, z]);
      screw(g, [x, .3393, z], .003, [0, 0, 0]);
    }
    for (const side of [-1, 1]) box(g, [.002, .0055, .324], m.rubber, [x + side * .012, .328, -.004]);
  }
  rounded(g, [.393, .030, .022], m.dark, [0, .304, .035]);
  box(g, [.374, .009, .004], m.steel, [0, .308, .049]);
  for (const y of [.298, .314]) box(g, [.373, .0015, .0015], m.black, [0, y, .0515]);
  for (const z of [.019, .064]) box(g, [.374, .0055, .0018], m.rubber, [0, .326, z]);
  for (let i = 0; i < 48; i++) box(g, [.0012, .0055, .0012], m.dark, [-.18 + i * .0076, .326, .0653]);
  // Carriage coordinates retain the old animation contract: position.x is
  // assigned by the room; the local y/z geometry stays fixed on its rail.
  const head = assembly(g, "printer_toolhead");
  rounded(head, [.052, .027, .018], m.alu, [0, .305, .059]);
  rounded(head, [.062, .071, .045], m.dark, [0, .258, .074], undefined, .004);
  rounded(head, [.049, .018, .030], m.black, [0, .217, .074], undefined, .003);
  cylinder(head, .009, .028, m.alu, [0, .204, .064], undefined, .009, 12);
  for (let i = 0; i < 5; i++) cylinder(head, .012, .0015, m.alu, [0, .196 + i * .004, .064], undefined, .012, 12);
  rounded(head, [.018, .012, .014], m.dark, [0, .185, .064], undefined, .001);
  cylinder(head, .005, .007, m.brass, [0, .178, .064], undefined, .0011, 6);
  // Recessed fan opening, five swept blades and attached guard, not a decal.
  annulus(head, .022, .017, .005, m.black, [0, .26, .098], undefined, 24);
  cylinder(head, .005, .003, m.alu, [0, .26, .0995], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) {
    const blade = assembly(head, "toolhead_fan_blade", [0, .26, .100], [0, 0, i * TAU / 5]);
    profile(blade, [[.003, .003], [.005, .016], [-.006, .014], [-.004, .005]], .0018, m.dark);
  }
  for (const a of [0, Math.PI / 2]) rod(head, [Math.sin(a) * -.018, .26 + Math.cos(a) * -.018, .103], [Math.sin(a) * .018, .26 + Math.cos(a) * .018, .103], .001, m.alu, 6);
  for (const x of [-.023, .023]) for (const y of [.234, .287]) screw(head, [x, y, .098], .002);
  for (const x of [-.021, .021]) {
    tube(head, [[x, .238, .076], [x * 1.15, .207, .081], [x * .6, .185, .077]], .005, m.black, 12);
    rounded(head, [.012, .005, .008], m.dark, [x * .6, .184, .077], undefined, .001);
  }
  // Curved PTFE loop and braided loom are attached to the moving head and
  // disappear through a generous top grommet throughout the existing sweep.
  tube(head, [[0, .293, .075], [.026, .382, .046], [.05, .48, -.015], [.005, .562, -.035]], .003, m.white, 34);
  tube(head, [[-.02, .293, .056], [-.052, .372, .005], [-.034, .455, -.036], [-.012, .558, -.034]], .0045, m.black, 34);
  consolidate(head); models.printerHead = head;
  rounded(g, [.312, .008, .05], m.black, [0, .575, -.033]);
  // Back circulation fan. The frame stays fixed while only hub/blades spin.
  const fan = assembly(g, "chamber_fan", [.102, .374, -.198]);
  rounded(fan, [.080, .080, .011], m.dark, [0, 0, 0], undefined, .003);
  annulus(fan, .034, .030, .009, m.black, [0, 0, .007]);
  const rotor = assembly(fan, "chamber_fan_rotor", [0, 0, .008]);
  cylinder(rotor, .011, .006, m.alu, [0, 0, 0], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const blade = assembly(rotor, "fan_blade", undefined, [0, 0, i * TAU / 7]);
    profile(blade, [[.002, .007], [.013, .027], [-.002, .031], [-.008, .017]], .002, m.alu);
  }
  consolidate(rotor); models.chamberFan = rotor;
  for (const radius of [.019, .032]) ring(fan, radius, .0009, m.dark, [0, 0, .014]);
  for (const x of [-.033, .033]) for (const y of [-.033, .033]) screw(fan, [x, y, .0075], .0023);
  // Actual side grille: contrasting recess and repeated angled louvres.
  for (const sx of [-1, 1]) {
    box(g, [.001, .055, .211], m.black, [sx * .2452, .478, -.05]);
    for (let i = 0; i < 16; i++) rounded(g, [.0035, .044, .0042], m.shell, [sx * .246, .478, -.144 + i * .0125], [.15, 0, 0], .0005);
    for (const z of [-.201, .20]) for (const y of [.062, .57]) screw(g, [sx * .2458, y, z], .0025, [0, 0, sx * -Math.PI / 2]);
    box(g, [.001, .0016, .425], m.dark, [sx * .2452, .088, -.006]);
  }
  // Dark front fascia and the same door opening as the previous silhouette.
  rounded(g, [.47, .130, .018], m.dark, [0, .549, .247], undefined, .003);
  rounded(g, [.47, .029, .018], m.dark, [0, .035, .247], undefined, .003);
  for (const x of [-.227, .227]) rounded(g, [.015, .438, .018], m.dark, [x, .267, .247], undefined, .002);
  rounded(g, [.146, .092, .005], m.black, [-.137, .551, .258], undefined, .002);
  decal(g, "printer", .133, .078, [-.137, .551, .261]);
  decal(g, "name", .170, .042, [.088, .560, .2565]);
  // Restrained light through the glass. No transmissive full-screen pass.
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9aadb6, roughness: .15, metalness: 0,
    transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: .32, clearcoat: .5, clearcoatRoughness: .17 });
  const glass = mesh(g, new THREE.PlaneGeometry(.431, .432), glassMat, [0, .267, .263]); glass.castShadow = false;
  for (const y of [.05, .484]) box(g, [.438, .005, .005], m.black, [0, y, .263]);
  for (const x of [-.2175, .2175]) box(g, [.005, .434, .005], m.black, [x, .267, .263]);
  for (const y of [.119, .414]) {
    rounded(g, [.019, .033, .011], m.dark, [-.218, y, .266]);
    cylinder(g, .004, .037, m.steel, [-.227, y, .267], undefined, .004, 12);
    screw(g, [-.211, y, .273], .0023);
  }
  for (const y of [.232, .32]) cylinder(g, .0045, .019, m.dark, [.204, y, .275], [Math.PI / 2, 0, 0]);
  rod(g, [.204, .218, .285], [.204, .334, .285], .0055, m.dark, 12);
  const status = mesh(g, new THREE.BoxGeometry(.245, .003, .0015),
    new THREE.MeshStandardMaterial({ color: 0x39675b, emissive: 0x4b937d, emissiveIntensity: .55, roughness: .7 }), [0, .035, .257]);
  models.printerStatusLed = status;
  const ledMat = new THREE.MeshStandardMaterial({ color: 0xd2dae2, emissive: 0xd1dde8, emissiveIntensity: .55, roughness: .7 });
  box(g, [.357, .005, .009], ledMat, [0, .466, .196]);
  const light = new THREE.PointLight(0xe9f2ff, .36, .74, 2); light.position.set(0, .414, .084); g.add(light);
  // Four-spool feeder keeps the familiar top profile, with real spindle ends,
  // feed shoes, hinges and latches behind a single light smoked cover.
  const feeder = assembly(g, "filament_feeder", [0, .623, -.02]);
  rounded(feeder, [.429, .048, .337], m.dark, [0, .024, 0], undefined, .005);
  const colors = [0xbfc6cb, 0x326ba6, 0x398879, 0xac7143];
  const movingSpools = [];
  for (let i = 0; i < 4; i++) {
    const x = -.1425 + i * .095;
    const sp = makeSpool(feeder, colors[i], [x, .118, -.007], i === 1);
    if (i === 1) { models.activeSpool = sp; movingSpools.push(sp); }
    rounded(feeder, [.046, .027, .025], m.black, [x, .065, .134]);
    cylinder(feeder, .007, .005, m.steel, [x, .069, .15], [Math.PI / 2, 0, 0]);
    tube(feeder, [[x, .081, .042], [x, .074, .09], [x, .070, .148]], .00075, material(`filament_${colors[i]}`, colors[i], .69), 12, 4);
    for (const dx of [-.032, .032]) rounded(feeder, [.008, .057, .017], m.dark, [x + dx, .078, -.007]);
  }
  // Shell rises from y=.070, clears the .182 spool tops, and is open at the
  // bottom. One outward surface avoids stacking multiple transparent boxes.
  const lid = mesh(feeder, new THREE.CylinderGeometry(.116, .116, .426, 24, 1, true, 0, Math.PI),
    new THREE.MeshPhysicalMaterial({ color: 0x71808a, roughness: .20, metalness: 0, transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: .25 }),
    [0, .074, 0], [0, 0, Math.PI / 2]);
  lid.castShadow = false;
  for (const x of [-.213, .213]) {
    const cap = mesh(feeder, new THREE.CircleGeometry(.116, 24, 0, Math.PI), lid.material, [x, .074, 0], [0, Math.PI / 2, 0]); cap.castShadow = false;
    rounded(feeder, [.006, .025, .226], m.dark, [x, .066, 0]);
  }
  for (const x of [-.16, .16]) {
    rounded(feeder, [.031, .017, .010], m.dark, [x, .070, .162]);
    cylinder(feeder, .005, .031, m.alu, [x, .067, -.151], [0, 0, Math.PI / 2]);
  }
  tube(g, [[.156, .678, -.171], [.219, .709, -.18], [.242, .673, -.135], [.200, .619, -.123]], .0038, m.white, 28);
  cylinder(g, .008, .012, m.black, [.2, .617, -.123]);
  const preserved = [head, rotor, status, ...movingSpools];
  consolidate(g, preserved);
  g.userData.workbenchDetails = { version: 1, features: ["folded_panels", "z_screw_threads", "bearing_trucks", "belt_path", "supported_build_plate", "open_bracket", "toolhead_fan", "hotend_fins", "nozzle", "ptfe_loom", "spoked_spools", "panel_fasteners", "door_hinges", "side_louvres"], ...workbenchDetailStats(g) };
  return g;
}

function pliers(parent, name, p, size = 1, blue = false, cutter = false) {
  const m = finishes(); const g = assembly(parent, name, p); g.scale.setScalar(size);
  for (const s of [-1, 1]) {
    // Forged halves cross at a real pivot; vinyl grips follow the bent tang.
    profile(g, [[s * -.003, .030], [s * .011, .018], [s * .008, .002], [s * .023, -.060],
      [s * .017, -.079], [s * .010, -.074], [s * -.002, -.015], [s * -.011, .004]], .0065, m.steel, [0, 0, s * .0016]);
    tube(g, [[s * .002, -.014, 0], [s * .013, -.038, 0], [s * .020, -.067, 0], [s * .016, -.079, 0]], .0056, blue ? m.blue : m.rubber, 18, 8);
    if (cutter) {
      profile(g, [[s * .001, .005], [s * .015, .019], [s * .010, .039], [s * .001, .035]], .009, m.steel);
      rod(g, [s * .001, .009, .0048], [s * .001, .035, .0048], .0006, m.black, 5);
    } else {
      profile(g, [[s * .001, .012], [s * .012, .020], [s * .009, .04], [s * .003, .070], [s * .001, .071]], .007, m.steel);
      for (let i = 0; i < 6; i++) box(g, [.006, .0007, .0007], m.dark, [s * .004, .030 + i * .004, .0038]);
    }
    for (let i = 0; i < 5; i++) ring(g, .0057, .0005, blue ? m.dark : m.black,
      [s * (.016 + i * .0008), -.052 - i * .004, 0], [Math.PI / 2, 0, s * -.13], 10);
  }
  cylinder(g, .008, .009, m.alu, [0, .005, .002], [Math.PI / 2, 0, 0], .008, 16);
  screw(g, [0, .005, .0075], .004);
  tube(g, [[-.007, -.017, -.001], [0, -.027, -.001], [.007, -.017, -.001]], .0011, m.steel, 10);
  return g;
}
function screwdriver(parent, x, color, length = .14, z = 0) {
  const m = finishes(); const g = assembly(parent, "precision_driver", [x, 0, z]);
  const handle = color === "blue" ? m.blue : color === "grey" ? m.alu : m.rubber;
  cylinder(g, .0022, length * .58, m.steel, [0, length * .29, 0], undefined, .0022, 10);
  profile(g, [[-.0021, 0], [.0021, 0], [.0031, .012], [-.0031, .012]], .0008, m.steel, [0, -.006, 0]);
  cylinder(g, .0043, .008, m.alu, [0, length * .58, 0], undefined, .0043, 12);
  cylinder(g, .0070, length * .32, handle, [0, length * .76, 0], undefined, .006, 12);
  cylinder(g, .0072, .008, m.dark, [0, length * .94, 0], undefined, .0072, 16);
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    rod(g, [Math.cos(a) * .0068, length * .63, Math.sin(a) * .0068], [Math.cos(a) * .0068, length * .85, Math.sin(a) * .0068], .0011, m.black, 5);
  }
  return g;
}

/** Replace the old tool construction block, from steel rule through strippers. */
export function buildDetailedPegboardTools({ topY = .78, boardZ = -.283 } = {}) {
  if (![topY, boardZ].every(Number.isFinite)) throw new TypeError("Pegboard coordinates must be finite.");
  const m = finishes(); const g = assembly(null, "rt_detailed_pegboard_tools");
  const tool = (name, x, y, z = .015, rz = 0) => assembly(g, name, [x, topY + y, boardZ + z], [0, 0, rz]);
  const ruler = tool("etched_steel_rule", -.82, .58, .003);
  profile(ruler, [[-.016, -.16], [.016, -.16], [.016, .15], [.01, .16], [-.01, .16], [-.016, .15]], .002, m.steel,
    undefined, undefined, [Array.from({ length: 12 }, (_, i) => [.004 * Math.cos(-i * TAU / 12), .146 + .004 * Math.sin(-i * TAU / 12)])]);
  decal(ruler, "rule", .030, .286, [0, -.005, .0012]);
  const caliper = tool("digital_caliper", -.68, .58, .012, .06);
  box(caliper, [.014, .24, .004], m.steel);
  box(caliper, [.002, .238, .0008], m.black, [.003, 0, .0023]);
  // Thin pointed measuring faces; the fixed jaw and moving jaw remain open.
  const jawShape = [[-.007, -.005], [-.046, -.005], [-.048, -.013], [-.034, -.022], [-.029, -.010], [.007, -.010], [.007, .004], [-.007, .004]];
  profile(caliper, jawShape, .005, m.steel, [0, .106, .0005]);
  profile(caliper, jawShape.map(([x,y]) => [x, -y]), .005, m.steel, [0, .045, .001]);
  profile(caliper, [[.006, .001], [.025, .011], [.026, .021], [.017, .008], [.006, .006]], .005, m.steel, [0, .1, 0]);
  profile(caliper, [[.006, -.001], [.025, -.011], [.026, -.021], [.017, -.008], [.006, -.006]], .005, m.steel, [0, .047, 0]);
  rounded(caliper, [.046, .042, .012], m.dark, [-.008, .023, .005], undefined, .002);
  decal(caliper, "caliper", .032, .015, [-.008, .028, .0112]);
  for (const x of [-.019, -.007, .005]) cylinder(caliper, .0028, .002, x === -.019 ? m.red : m.blue, [x, .011, .0117], [Math.PI / 2, 0, 0], .0028, 10);
  cylinder(caliper, .005, .009, m.steel, [.018, .014, .003], [0, 0, Math.PI / 2]);
  cylinder(caliper, .0035, .008, m.dark, [.010, .049, .001]);
  box(caliper, [.0025, .027, .002], m.steel, [0, -.132, 0]);
  for (let i = 0; i < 38; i++) box(caliper, [i % 5 ? .004 : .009, .0005, .0004], m.dark, [-.002, -.11 + i * .0056, .0023]);

  const drill = tool("cordless_drill", -.50, .63, .035);
  cylinder(drill, .030, .107, m.blue, [.005, 0, 0], [0, 0, Math.PI / 2], .026, 20);
  cylinder(drill, .0305, .010, m.black, [.062, 0, 0], [0, 0, Math.PI / 2], .0305, 20);
  cylinder(drill, .022, .028, m.alu, [-.062, 0, 0], [0, 0, Math.PI / 2], .028, 20);
  cylinder(drill, .0215, .028, m.black, [-.089, 0, 0], [0, 0, Math.PI / 2], .019, 20);
  cylinder(drill, .011, .019, m.steel, [-.111, 0, 0], [0, 0, Math.PI / 2], .017, 16);
  rod(drill, [-.119, 0, 0], [-.151, 0, 0], .0026, m.steel, 6);
  for (let i = 0; i < 18; i++) {
    const a = i * TAU / 18;
    rod(drill, [-.101, Math.cos(a) * .021, Math.sin(a) * .021], [-.077, Math.cos(a) * .021, Math.sin(a) * .021], .00085, m.dark, 5);
  }
  profile(drill, [[-.005, -.020], [.030, -.017], [.041, -.139], [.010, -.146], [-.005, -.119], [.004, -.052]], .040, m.blue);
  profile(drill, [[.012, -.05], [.028, -.043], [.036, -.129], [.016, -.136], [.009, -.118]], .041, m.rubber);
  rounded(drill, [.067, .036, .059], m.black, [.025, -.157, .004], undefined, .004);
  rounded(drill, [.060, .009, .055], m.blue, [.025, -.172, .004]);
  rounded(drill, [.013, .023, .025], m.black, [-.009, -.043, .001]);
  box(drill, [.009, .006, .048], m.dark, [.002, -.024, 0]);
  for (let i = 0; i < 5; i++) box(drill, [.011, .0025, .001], m.black, [.042, -.010 + i * .0045, .025]);
  for (const [x,y] of [[.053,.01],[.011,-.060],[.024,-.119]]) screw(drill, [x,y,.0212], .0022);
  rounded(drill, [.025, .014, .001], m.alu, [.010, .009, .029]);
  box(drill, [.014, .003, .0013], m.black, [.010, .009, .0298]);

  const rotary = tool("rotary_tool", -.18, .56, .019, .06);
  cylinder(rotary, .014, .102, m.alu, [0, -.004, 0], undefined, .018, 18);
  cylinder(rotary, .008, .034, m.dark, [0, .064, 0], undefined, .014, 16);
  cylinder(rotary, .0045, .016, m.steel, [0, .089, 0], undefined, .008, 12);
  cylinder(rotary, .0018, .029, m.steel, [0, .11, 0], undefined, .0018, 8);
  cylinder(rotary, .004, .010, m.dark, [0, .125, 0], undefined, .004, 12);
  cylinder(rotary, .0175, .040, m.rubber, [0, -.040, 0], undefined, .017, 16);
  for (let i = 0; i < 6; i++) ring(rotary, .0175, .0008, m.black, [0,-.054+i*.006,0], [Math.PI/2,0,0], 18);
  rounded(rotary, [.007, .020, .005], m.blue, [0, .008, .0155]);
  for (const s of [-1,1]) for (let i=0;i<4;i++) box(rotary,[.0025,.014,.0015],m.black,[s*(.005+i*.002),.032,.011]);

  const torque = tool("micrometer_torque_wrench", .18, .60, .023, .5);
  cylinder(torque,.0068,.254,m.steel,[0,.013,0],undefined,.007,14);
  profile(torque,[[-.007,.128],[-.017,.147],[-.020,.171],[-.012,.188],[.013,.187],[.019,.173],[.015,.15],[.007,.128]],.013,m.steel);
  annulus(torque,.015,.010,.014,m.alu,[0,.172,.002],undefined,22);
  cylinder(torque,.009,.004,m.dark,[0,.172,.011],[Math.PI/2,0,0]);
  rounded(torque,[.008,.008,.009],m.steel,[0,.172,.016],undefined,.001);
  rod(torque,[.002,.154,.008],[.010,.151,.009],.0023,m.black,8);
  cylinder(torque,.012,.087,m.rubber,[0,-.135,0],undefined,.011,18);
  cylinder(torque,.0123,.014,m.blue,[0,-.089,0],undefined,.0123,18);
  cylinder(torque,.012,.008,m.alu,[0,-.180,0],undefined,.012,18);
  decal(torque,"scale",.012,.059,[0,-.045,.0071]);
  for(let i=0;i<11;i++) ring(torque,.0115,.0007,m.dark,[0,-.097-i*.007,0],[Math.PI/2,0,0],18);
  for(let i=0;i<16;i++){const a=i*TAU/16;rod(torque,[.0117*Math.cos(a),-.16,.0117*Math.sin(a)],[.0117*Math.cos(a+.25),-.102,.0117*Math.sin(a+.25)],.00065,m.dark,5);}

  const wrench = tool("combination_wrench", .55, .60, .012, -.1);
  profile(wrench,[[-.012,-.072],[-.008,-.052],[-.007,.069],[-.015,.083],[.015,.083],[.007,.069],[.008,-.052],[.012,-.072]],.006,m.steel);
  annulus(wrench,.019,.0105,.008,m.steel,[0,.090,0],undefined,24,12);
  profile(wrench,[[-.012,-.061],[-.023,-.079],[-.018,-.103],[-.009,-.11],[-.008,-.084],[.009,-.081],[.015,-.105],[.023,-.097],[.022,-.076],[.012,-.06]],.009,m.steel);
  rounded(wrench,[.008,.099,.0008],m.alu,[0,.006,.0034],undefined,.0002);
  pliers(g,"long_nose_pliers",[.7725,topY+.61,boardZ+.017],1,false);
  pliers(g,"flush_cutters",[.90,topY+.59,boardZ+.016],.83,true,true);

  const hammer = tool("ball_peen_hammer", .02, .56, .02, -.06);
  cylinder(hammer,.008,.204,m.wood,[0,-.005,0],undefined,.012,12);
  cylinder(hammer,.015,.021,m.dark,[0,.093,0],undefined,.014,12);
  rounded(hammer,[.034,.030,.029],m.dark,[0,.11,0],undefined,.003);
  cylinder(hammer,.016,.027,m.steel,[-.028,.11,0],[0,0,Math.PI/2],.014,16);
  cylinder(hammer,.017,.003,m.steel,[-.043,.11,0],[0,0,Math.PI/2],.017,16);
  const ball=mesh(hammer,new THREE.SphereGeometry(.014,16,10),m.steel,[.034,.11,0]);ball.scale.x=1.14;
  rounded(hammer,[.011,.008,.011],m.wood,[0,.128,0]);
  for(const x of [-.003,.003]) box(hammer,[.001,.005,.009],m.steel,[x,.132,0]);

  const adjustable = tool("adjustable_wrench",.35,.60,.014,-.12);
  profile(adjustable,[[-.010,-.075],[-.013,-.06],[-.008,.054],[-.021,.066],[-.028,.09],[-.024,.113],[-.012,.119],[-.010,.092],[.020,.088],[.029,.107],[.034,.095],[.031,.071],[.011,.049],[.012,-.066],[.006,-.077]],.010,m.steel);
  profile(adjustable,[[.0,.068],[.017,.070],[.024,.090],[.014,.093],[.008,.080],[.0,.080]],.011,m.steel);
  cylinder(adjustable,.008,.015,m.dark,[-.006,.067,.007],[0,0,Math.PI/2],.008,16);
  for(let i=0;i<7;i++) ring(adjustable,.008,.0006,m.steel,[-.012+i*.002,.067,.007],[0,Math.PI/2,0],12);
  rounded(adjustable,[.013,.086,.0105],m.rubber,[0,-.028,0],undefined,.002);
  annulus(adjustable,.006,.003,.011,m.steel,[0,-.065,0],undefined,14);

  const tape = tool("tape_measure",.68,.52,.022);
  rounded(tape,[.055,.054,.033],m.rubber,[0,0,0],undefined,.006);
  cylinder(tape,.022,.034,m.blue,[.001,.001,0],[Math.PI/2,0,0],.022,24);
  cylinder(tape,.014,.001,m.dark,[.001,.001,.018],[Math.PI/2,0,0],.014,20);
  rounded(tape,[.016,.007,.014],m.dark,[.009,.028,.002]);
  profile(tape,[[-.028,.012],[-.034,.01],[-.035,-.022],[-.029,-.025],[-.026,-.018],[-.030,-.018],[-.030,.005],[-.025,.006]],.007,m.steel);
  box(tape,[.021,.006,.022],m.brass,[.015,-.026,0]);
  box(tape,[.003,.01,.024],m.steel,[.026,-.023,0]);
  screw(tape,[.001,.001,.019],.0023);

  const level = tool("torpedo_level",-.55,.83,.017);
  profile(level,[[-.11,-.012],[-.105,-.017],[.105,-.017],[.11,-.012],[.11,.012],[.098,.017],[-.098,.017],[-.11,.012]],.018,m.alu,
    undefined,undefined,[
      [[-.076,-.01],[-.025,-.01],[-.025,.01],[-.076,.01]], [[.025,-.01],[.076,-.01],[.076,.01],[.025,.01]]
    ]);
  for(const x of [-.05,.05]) {
    cylinder(level,.006,.035,m.green,[x,0,.001],[0,0,Math.PI/2],.006,12);
    for(const dx of [-.004,.004]) ring(level,.006,.00065,m.black,[x+dx,0,.001],[0,Math.PI/2,0],12);
    cylinder(level,.0038,.005,m.white,[x,0,.001],[0,0,Math.PI/2],.0038,10);
  }
  for(const x of [-.105,.105]) rounded(level,[.010,.032,.02],m.rubber,[x,0,0]);
  for(const y of [-.016,.016]) box(level,[.204,.002,.02],m.dark,[0,y,0]);

  // One holder for the upper L-key set. Bent, hexagonal stock and rounded
  // elbows replace the old disconnected perpendicular rectangular sticks.
  const keys=tool("hex_key_rack",-.23,.84,.013);
  rounded(keys,[.185,.019,.014],m.dark,[0,0,-.006]);
  for(let i=0;i<6;i++) {
    const x=-.075+i*.030,r=.0036-i*.00038,len=.088-i*.009;
    rod(keys,[x,-.009,0],[x,-len,0],r,m.steel,6);
    tube(keys,[[x,-len,0],[x+.001,-len-.005,0],[x+.007,-len-.007,0],[x+.025-i*.002,-len-.007,0]],r,m.steel,10,6);
  }
  const square=tool("machinist_square",-.06,.79,.014);
  box(square,[.016,.13,.004],m.steel);
  rounded(square,[.092,.021,.015],m.dark,[.038,-.056,.003]);
  for(const x of [.003,.066]) screw(square,[x,-.056,.0113],.0021);
  for(let i=0;i<17;i++)box(square,[i%5?.005:.009,.0005,.0005],m.dark,[-.002,-.035+i*.005,.0022]);

  const strippers=pliers(g,"wire_strippers",[.90,topY+.80,boardZ+.017],.79,true,true);
  // Graduated notches on the flat cutting section make the function legible.
  for(let i=0;i<4;i++) annulus(strippers,.0023+i*.0002,.0014+i*.00015,.0006,m.black,[0,.014+i*.0048,.005],undefined,10);
  // Socket rail uses six-sided through bores rather than silver cylinders.
  const sockets=tool("socket_rail",.57,.84,.016);
  rounded(sockets,[.26,.017,.010],m.dark,[0,0,-.002]);
  for(let i=0;i<6;i++) {
    const x=-.105+i*.041, radius=.009+i*.0013;
    annulus(sockets,radius,radius*.66,.022,m.steel,[x,.012,.011],undefined,20,6);
    ring(sockets,radius-.0005,.0008,m.alu,[x,.012,.0215],undefined,20);
    box(sockets,[.009,.022,.007],m.black,[x,-.007,.003]);
  }
  // Two spare precision screwdrivers in the original clear upper-right band.
  const hungDrivers=tool("hung_precision_drivers",.725,.90,.016);
  screwdriver(hungDrivers,-.014,"blue",.11); screwdriver(hungDrivers,.014,"black",.10);
  hungDrivers.rotation.z=Math.PI;

  // Purpose-shaped hanger cradles replace hooks that stopped short of tools.
  for(const [x,y] of [[-.50,.607],[-.18,.588],[.18,.658],[.55,.69],[.7725,.625],[.90,.609],[-.55,.818],[.35,.67],[.90,.82]]) {
    for(const dx of [-.014,.014]) tube(g,[[x+dx,topY+y,boardZ-.003],[x+dx,topY+y,boardZ+.029],[x+dx,topY+y+.009,boardZ+.033]],.0025,m.alu,9);
  }
  for(const [x,y] of [[-.82,.726],[-.68,.69],[.02,.67],[.68,.548],[-.29,.84],[-.17,.84],[.45,.84],[.69,.84]])
    rod(g,[x,topY+y,boardZ-.002],[x,topY+y+.002,boardZ+.020],.0028,m.alu,8);
  consolidate(g);
  g.userData.workbenchDetails={version:1,features:["drill_chuck_flutes","battery_seams","open_caliper_jaws","etched_rule","ratchet_reverser","open_wrench_jaws","plier_pivots","spring_handles","hollow_sockets","bent_hex_keys","level_vial_bubbles"],...workbenchDetailStats(g)};
  return g;
}

function resetInstrument(group, name, preserve = []) {
  if (!group?.isGroup) throw new TypeError(`Missing workbench group: ${name}`);
  const retained = new Set(preserve);
  const geometries = new Set();
  for (const child of [...group.children]) {
    if (retained.has(child)) continue;
    child.traverse(o => { if (o.geometry) geometries.add(o.geometry); }); child.removeFromParent();
  }
  for (const geometry of geometries) geometry.dispose();
  // Materials can be shared with other room props, so their lifetime remains
  // the room's responsibility. Never dispose shared steel/plastic here.
  group.name = name;
}
function knob(parent, x, y, z, r = .010) {
  const m = finishes();
  cylinder(parent,r,.012,m.dark,[x,y,z],[Math.PI/2,0,0],r,20);
  cylinder(parent,r*.82,.001,m.alu,[x,y,z+.0065],[Math.PI/2,0,0],r*.82,20);
  for(let i=0;i<16;i++) {
    const a=i*TAU/16;
    rod(parent,[x+Math.cos(a)*r,y+Math.sin(a)*r,z-.004],[x+Math.cos(a)*r,y+Math.sin(a)*r,z+.004],.0006,m.black,4);
  }
  box(parent,[.0013,r*.4,.0005],m.white,[x,y+r*.43,z+.0072]);
}
function benchCase(parent,w,h,d,frontColor) {
  const m=finishes();
  rounded(parent,[w,h-.006,d],m.dark,[0,h/2+.003,0],undefined,.003);
  rounded(parent,[w-.010,h-.01,.003],frontColor,[0,h/2+.003,d/2+.0015],undefined,.001);
  for(const x of [-w/2+.016,w/2-.016])for(const z of [-d/2+.015,d/2-.015])cylinder(parent,.0075,.006,m.rubber,[x,.003,z],undefined,.0085,12);
  for(const x of [-w/2+.009,w/2-.009])for(const y of [.012,h-.008])screw(parent,[x,y,d/2+.0034],.0021);
  for(const x of [-w/2-.0001,w/2+.0001])for(let i=0;i<10;i++)box(parent,[.0006,.034,.0025],m.black,[x,h*.57,-d*.30+i*d*.054]);
  for(const s of [-1,1])box(parent,[w-.009,.001,.001],m.black,[0,h-.006,s*d/2]);
}

/**
 * Call after all six existing instrument groups are built and placed. Their
 * transforms stay unchanged; scope's existing live texture and draw callback
 * survive. The lamp keeps its original silhouette with hardware refinements.
 */
export function refineWorkbenchInstruments({ psu, solder, drivers, meter, scope, benchLamp } = {}) {
  const m = finishes(); const report = {};
  if (psu) {
    resetInstrument(psu,"rt_detailed_psu");
    benchCase(psu,.21,.105,.17,m.shell);
    rounded(psu,[.122,.055,.004],m.black,[-.03,.064,.090],undefined,.002);
    decal(psu,"psu",.110,.045,[-.03,.064,.0922]);
    knob(psu,.054,.071,.091,.010);knob(psu,.083,.071,.091,.008);
    for(const [x,col] of [[-.06,m.red],[-.03,m.black],[0,m.blue],[.03,m.black]]) {
      cylinder(psu,.006,.010,col,[x,.026,.092],[Math.PI/2,0,0],.006,14);
      annulus(psu,.0045,.0022,.004,m.steel,[x,.026,.099],undefined,14);
    }
    rounded(psu,[.020,.010,.004],m.dark,[.074,.030,.090]);
    cylinder(psu,.0015,.001,m.green,[.091,.030,.093],[Math.PI/2,0,0],.0015,8);
    decal(psu,"labels",.176,.012,[0,.098,.0871]);
    // Strain-relieved plugs connect exactly where the room's existing leads
    // start. Keeping these positions avoids a floating cable at the fascia.
    for(const [x,col] of [[-.049,m.red],[-.023,m.black]]) {
      tube(psu,[[x,.061,.085],[x,.049,.106],[x+.005,.028,.108]],.0033,col,14);
      cylinder(psu,.005,.018,col,[x,.053,.090],[Math.PI/2,0,0],.005,12);
    }
    consolidate(psu);report.psu=workbenchDetailStats(psu);
  }
  if (scope) {
    // Live trace is the only textured plane with an emissive map in the old
    // scope. Hold the actual mesh, preserving MODELS.scope.tex identity.
    const liveScreen=scope.children.find(o=>o.isMesh&&o.material?.emissiveMap);
    resetInstrument(scope,"rt_detailed_scope",liveScreen?[liveScreen]:[]);
    benchCase(scope,.175,.115,.085,m.alu);
    rounded(scope,[.113,.076,.003],m.black,[-.028,.062,.046],undefined,.002);
    if(liveScreen)liveScreen.position.z=.0477;
    knob(scope,.061,.09,.049,.010);knob(scope,.061,.063,.049,.009);
    for(const x of [.048,.073])for(const y of [.028,.040])rounded(scope,[.012,.007,.005],m.dark,[x,y,.047]);
    for(const x of [-.052,-.016]) {
      annulus(scope,.0065,.0035,.010,m.steel,[x,.017,.049],undefined,18);
      annulus(scope,.0033,.0015,.002,m.white,[x,.017,.055],undefined,14);
      for(const s of [-1,1])box(scope,[.0018,.0025,.002],m.steel,[x+s*.0065,.017,.053]);
    }
    decal(scope,"labels",.14,.009,[0,.107,.046]);
    // Carry handle and pivot discs project from the side, not through screen.
    for(const x of [-.090,.090]) {
      cylinder(scope,.009,.007,m.dark,[x,.071,0],[0,0,Math.PI/2]);
      rod(scope,[x,.071,0],[x,.125,-.012],.004,m.dark,10);
    }
    rod(scope,[-.090,.125,-.012],[.090,.125,-.012],.004,m.dark,12);
    consolidate(scope,liveScreen?[liveScreen]:[]);report.scope=workbenchDetailStats(scope);
  }
  if (solder) {
    resetInstrument(solder,"rt_detailed_solder_station");
    benchCase(solder,.13,.075,.11,m.dark);
    rounded(solder,[.057,.031,.003],m.black,[-.023,.048,.058]);
    decal(solder,"solder",.051,.026,[-.023,.048,.060]);
    knob(solder,.036,.046,.061,.010);
    annulus(solder,.007,.004,.008,m.steel,[.048,.018,.059],undefined,16);
    decal(solder,"labels",.112,.009,[0,.069,.058]);
    // Independent iron holder: weighted base, inclined open helical cradle,
    // inner heat shield, steel ferrule and cartridge actually sit together.
    rounded(solder,[.091,.008,.073],m.dark,[.107,.004,.010],undefined,.004);
    const cradle=assembly(solder,"iron_cradle",[.101,.040,.008],[0,0,-1.02]);
    annulus(cradle,.018,.011,.044,m.dark,[0,0,0],[-Math.PI/2,0,0],20);
    const spring=Array.from({length:100},(_,i)=>[.016*Math.cos(i*TAU/12),-.022+i*.0008,.016*Math.sin(i*TAU/12)]);
    tube(cradle,spring,.0016,m.steel,108,6);
    // Iron axis follows the same incline: nose down-left, cable exits right.
    const iron=assembly(solder,"solder_iron",[.126,.058,.008],[0,0,-1.02]);
    cylinder(iron,.005,.032,m.steel,[0,-.021,0],undefined,.004,12);
    cylinder(iron,.001,.030,m.steel,[0,-.049,0],undefined,.004,10);
    cylinder(iron,.007,.064,m.blue,[0,.025,0],undefined,.008,16);
    for(let i=0;i<5;i++)ring(iron,.008,.0007,m.black,[0,.002+i*.006,0],[Math.PI/2,0,0],16);
    cylinder(iron,.005,.012,m.black,[0,.063,0],undefined,.005,12);
    tube(solder,[[.187,.096,.008],[.213,.033,.055],[.163,.007,.095],[.081,.007,.085],[.050,.018,.065]],.0023,m.black,34);
    // Brass wool has interlocking loops in an open cup; the sponge rests in a
    // separate shallow tray so the station no longer wears both on its case.
    annulus(solder,.018,.014,.017,m.dark,[-.04,.084,-.026],[-Math.PI/2,0,0],20);
    for(let i=0;i<10;i++) {
      const a=i*2.4;
      ring(solder,.005+i%3*.001,.0007,m.brass,[-.04+Math.sin(a)*.007,.091+(i%3)*.001,-.026+Math.cos(a)*.006],[1.0+i*.36,a,.2],12);
    }
    rounded(solder,[.045,.006,.038],m.dark,[-.036,.079,.025]);
    rounded(solder,[.036,.005,.028],material("sponge",0xb5a15b,.98),[-.036,.084,.025],undefined,.001);
    for(let i=0;i<14;i++) {
      const x=-.05+(i*7%13)*.0023,z=.014+(i*5%11)*.0019;
      cylinder(solder,.0008,.0003,m.dark,[x,.0867,z],undefined,.0008,6);
    }
    consolidate(solder);report.solder=workbenchDetailStats(solder);
  }
  if (drivers) {
    resetInstrument(drivers,"rt_detailed_screwdriver_rack");
    // Two rails and side cheeks make a real rack with a clearance slot; the
    // shafts no longer end below the tabletop through a floating solid block.
    for(const z of [-.019,.019]) rounded(drivers,[.17,.014,.009],m.wood,[0,.029,z]);
    for(const x of [-.08,.08])rounded(drivers,[.010,.037,.046],m.wood,[x,.020,0]);
    rounded(drivers,[.17,.005,.045],m.dark,[0,.003,0]);
    profile(drivers,[[-.085,-.0225],[.085,-.0225],[.085,.0225],[-.085,.0225]],.006,m.wood,[0,.033,0],[-Math.PI/2,0,0],
      Array.from({length:6},(_,i)=>Array.from({length:12},(_,j)=>[-.060+i*.024+.0038*Math.cos(-j*TAU/12),.0038*Math.sin(-j*TAU/12)])));
    for(let i=0;i<6;i++) {
      const dx=-.060+i*.024;
      const driver=screwdriver(drivers,dx,i%3===0?"blue":i%3===1?"black":"grey",.096+(i%2)*.014);
      driver.position.y=.0115;
      annulus(drivers,.0044,.0028,.001,m.black,[dx,.0365,0],[-Math.PI/2,0,0],12);
    }
    consolidate(drivers);report.drivers=workbenchDetailStats(drivers);
  }
  if (meter) {
    resetInstrument(meter,"rt_detailed_multimeter");
    rounded(meter,[.082,.022,.150],m.blue,[0,.012,0],undefined,.006);
    rounded(meter,[.069,.004,.133],m.dark,[0,.024,0],undefined,.001);
    rounded(meter,[.060,.002,.034],m.black,[0,.0267,-.044],undefined,.0005);
    decal(meter,"meter",.054,.029,[0,.0278,-.044],[-Math.PI/2,0,0]);
    decal(meter,"meterDial",.065,.066,[0,.0262,.018],[-Math.PI/2,0,0]);
    cylinder(meter,.017,.006,m.black,[0,.030,.018],undefined,.017,20);
    rounded(meter,[.008,.006,.032],m.dark,[0,.035,.018],[0,.5,0],.001);
    box(meter,[.002,.001,.008],m.white,[-.006,.0385,.007],[0,.5,0]);
    for(const x of [-.020,0,.020])rounded(meter,[.011,.004,.006],x===0?m.blue:m.alu,[x,.028,-.016]);
    for(const x of [-.024,0,.024]) {
      annulus(meter,.0055,.003,.002,x===-.024?m.red:m.black,[x,.027,.060],[-Math.PI/2,0,0],14);
      cylinder(meter,.0025,.001,m.steel,[x,.0273,.060],undefined,.0025,12);
    }
    for(const s of [-1,1]) {
      const col=s>0?m.red:m.black;
      cylinder(meter,.004,.008,col,[s*.024,.031,.06],undefined,.004,12);
      tube(meter,[[s*.024,.033,.061],[s*.046,.007,.104],[s*.094,.005,.092],[s*.102,.005,.025],[s*.078,.008,-.010]],.0018,col,32);
      const probe=assembly(meter,"meter_probe",[s*.078,.008,-.035],[Math.PI/2,0,s*.18]);
      cylinder(probe,.0035,.055,col,[0,0,0],undefined,.0045,12);
      cylinder(probe,.007,.002,col,[0,-.018,0],undefined,.007,14);
      cylinder(probe,.002,.023,m.black,[0,-.038,0],undefined,.0035,10);
      cylinder(probe,.0007,.016,m.steel,[0,-.055,0],undefined,.0015,8);
      for(let i=0;i<4;i++)ring(probe,.0045,.0005,m.dark,[0,-.01+i*.006,0],[Math.PI/2,0,0],12);
    }
    for(const x of [-.035,.035])for(const z of [-.063,.063])screw(meter,[x,.024,z],.0018,[0,0,0]);
    consolidate(meter);report.meter=workbenchDetailStats(meter);
  }
  if (benchLamp) {
    benchLamp.name="rt_detailed_bench_lamp";
    ring(benchLamp,.053,.0012,m.black,[0,.015,0],[-Math.PI/2,0,0],28);
    cylinder(benchLamp,.013,.022,m.dark,[0,.025,0],undefined,.013,16);
    for(const x of [-.033,.033])screw(benchLamp,[x,.016,0],.002,[0,0,0]);
    cylinder(benchLamp,.0065,.001,m.blue,[.018,.0165,.024],undefined,.0065,16);
    cylinder(benchLamp,.012,.026,m.alu,[0,.343,.023],[Math.PI/2,0,0],.012,16);
    screw(benchLamp,[0,.343,.037],.004);
    tube(benchLamp,[[0,.042,-.007],[0,.027,-.029],[.008,.005,-.063],[.046,.005,-.065]],.0017,m.black,20);
    consolidate(benchLamp);report.benchLamp=workbenchDetailStats(benchLamp);
  }
  return report;
}
