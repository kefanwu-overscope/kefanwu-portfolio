import * as THREE from "three";

// Independent, unbaked construction details. Dimensions are metres and match
// buildDisplayCabinet / buildSideCabinet / buildDesk, including room-baked.glb.
// CAB.frontZ and CAB2.frontX locate EXHIBITS, not the cabinet front faces.
const MAIN = { z: -1.12, bays: [-0.73, 0, 0.73], rows: [1.68, 1.2, 0.72] };
const SIDE = { x: 2.26, z: -0.1, bays: [-0.45, 0.25], rows: [1.68, 1.2, 0.72] };

function checkedLayout(defaults, supplied, bayCount) {
  const layout = { ...defaults, ...supplied };
  const values = [layout.z, ...(layout.x === undefined ? [] : [layout.x])];
  if (!Array.isArray(layout.bays) || layout.bays.length !== bayCount ||
      !Array.isArray(layout.rows) || layout.rows.length !== 3 ||
      ![...values, ...layout.bays, ...layout.rows].every(Number.isFinite) ||
      layout.bays.some((x, i) => i > 0 && x <= layout.bays[i - 1]) ||
      layout.rows.some((y, i) => y < 0.7 || y > 2.05 || (i > 0 && y >= layout.rows[i - 1]))) {
    throw new RangeError("Studio realism requires the current ordered cabinet layout.");
  }
  return layout;
}

// A single bevel segment gives actual edge normals without a new addon,
// texture, or dense rounded-box tessellation. Dimensions include the bevel.
function beveledBox(w, h, d, bevel) {
  const b = Math.min(bevel, w / 4, h / 4, d / 4);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + b, -h / 2 + b);
  shape.lineTo(w / 2 - b, -h / 2 + b);
  shape.lineTo(w / 2 - b, h / 2 - b);
  shape.lineTo(-w / 2 + b, h / 2 - b);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: d - 2 * b, steps: 1, curveSegments: 1,
    bevelEnabled: true, bevelSegments: 1, bevelThickness: b, bevelSize: b,
  });
  geometry.translate(0, 0, -d / 2 + b);
  // One opaque material per draw; ExtrudeGeometry's cap/side groups are unused.
  geometry.clearGroups();
  return geometry;
}

function shelfBracket() {
  const shape = new THREE.Shape();
  // Local x points INTO a bay; y=0 is the shelf underside. A 3 mm isolator
  // fills the space above the folded steel arm. The leg sits on the divider.
  shape.moveTo(0, -0.034);
  shape.lineTo(0.003, -0.034);
  shape.lineTo(0.003, -0.007);
  shape.lineTo(0.028, -0.007);
  shape.lineTo(0.028, -0.003);
  shape.lineTo(0, -0.003);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.046, steps: 1, curveSegments: 1, bevelEnabled: false,
  });
  geometry.translate(0, 0, -0.023);
  geometry.clearGroups();
  return geometry;
}

/**
 * Call once after buildWorkbench(), before startup preparation/compileAsync:
 * const studioRealism = addStudioRealism(scene, { cabinet: CAB, sideCabinet: CAB2 });
 * Keep the handle for inspection or teardown. No update() or external assets.
 * The returned group is attached directly to scene; do not put it in bk_*.
 */
export function addStudioRealism(scene, { cabinet, sideCabinet } = {}) {
  if (!scene?.isScene) throw new TypeError("addStudioRealism expects a THREE.Scene.");
  const main = checkedLayout(MAIN, cabinet, 3);
  const side = checkedLayout(SIDE, sideCabinet, 2);
  const group = new THREE.Group();
  group.name = "rt_studio_realism";
  const finish = new THREE.MeshStandardMaterial({ color: 0x858c94, roughness: 0.68, metalness: 0.24, envMapIntensity: 0.7 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8c929a, roughness: 0.62, metalness: 0.55, envMapIntensity: 0.65 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x25282d, roughness: 0.86, metalness: 0, envMapIntensity: 0.45 });
  const screw = new THREE.MeshStandardMaterial({ color: 0x747b83, roughness: 0.58, metalness: 0.65, envMapIntensity: 0.6 });
  const batches = [];
  const batch = (name, geometry, material) => {
    const entry = { name, geometry, material, matrices: [] };
    batches.push(entry);
    return entry;
  };
  const brackets = batch("shelf_brackets", shelfBracket(), steel);
  const pads = batch("shelf_isolators", beveledBox(0.023, 0.003, 0.034, 0.0005), rubber);
  const caps = batch("frame_joint_caps", beveledBox(0.026, 0.044, 0.006, 0.001), finish);
  const fasteners = batch("frame_fasteners", new THREE.CylinderGeometry(0.0045, 0.0038, 0.002, 12), screw);
  const sockets = batch("fastener_sockets", new THREE.CylinderGeometry(0.0017, 0.0017, 0.00035, 6), rubber);
  const beams = batch("desk_rear_beam", beveledBox(1.57, 0.042, 0.044, 0.0018), finish);
  const mounts = batch("desk_mounting_plates", beveledBox(0.11, 0.007, 0.072, 0.0008), finish);
  const arms = batch("desk_column_arm", beveledBox(0.068, 0.044, 0.70, 0.0015), finish);
  const seals = batch("desk_column_seals", new THREE.BoxGeometry(1, 1, 1), rubber);
  const footCaps = batch("desk_foot_caps", beveledBox(0.086, 0.023, 0.012, 0.002), rubber);
  const pose = new THREE.Object3D();
  const parent = new THREE.Matrix4();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion();
  const unit = new THREE.Vector3(1, 1, 1);
  const place = (entry, x, y, z, rotationY = 0, scale = [1, 1, 1], rotationX = 0) => {
    pose.position.set(x, y, z);
    pose.rotation.set(rotationX, rotationY, 0);
    pose.scale.set(...scale);
    pose.updateMatrix();
    entry.matrices.push(parent.clone().multiply(pose.matrix));
  };

  function addCabinet(layout, width, depth, isSide) {
    // Canonical cabinet space: horizontal x, vertical y, front +z. The right
    // cabinet faces -X, so rotate once instead of mirroring instance matrices.
    const yaw = isSide ? -Math.PI / 2 : 0;
    parent.compose(new THREE.Vector3(isSide ? layout.x : 0, 0, layout.z),
      quat.setFromAxisAngle(yAxis, yaw), unit);
    const bayCenters = layout.bays.map(x => isSide ? x - layout.z : x);
    const dividers = bayCenters.slice(1).map((x, i) => (bayCenters[i] + x) / 2);
    const limits = [-width / 2 + 0.04, ...dividers, width / 2 - 0.04];
    layout.rows.forEach((top, row) => {
      // The opaque bottom shelf already rests on the drawer bodies. Adding
      // brackets there would intersect the drawers instead of supporting glass.
      if (row === 2) return;
      const underside = top - 0.014;
      for (let bay = 0; bay < bayCenters.length; bay++) {
        const left = limits[bay] + (bay === 0 ? 0 : 0.007);
        const right = limits[bay + 1] - (bay === bayCenters.length - 1 ? 0 : 0.007);
        for (const [edge, direction] of [[left, 1], [right, -1]]) {
          // Front and rear support points stay behind the shelf's front edge
          // and inside the divider depth. No intrusion ABOVE an exhibit shelf.
          for (const z of [-0.15, 0.15]) {
            place(brackets, edge, underside, z, direction < 0 ? Math.PI : 0);
            place(pads, edge + direction * 0.016, underside - 0.0015, z);
          }
        }
      }
    });
    const addCap = (x, y, front, widthScale = 1) => {
      // Seat the back 2 mm into the existing face; no coplanar overlay or
      // continuous bright shelf rail (the latter caused historical sparkle).
      place(caps, x, y, front + 0.001, 0, [widthScale, 1, 1]);
      place(fasteners, x, y, front + 0.0048, 0, [1, 1, 1], Math.PI / 2);
      place(sockets, x, y, front + 0.00595, 0, [1, 1, 1], Math.PI / 2);
    };
    for (const x of [-width / 2 + 0.02, width / 2 - 0.02]) {
      for (const y of [...layout.rows.map(top => top - 0.001), 2.15]) addCap(x, y, depth / 2);
    }
    for (const x of dividers) {
      for (const top of layout.rows) addCap(x, top - 0.001, (depth - 0.1) / 2, 0.62);
    }
  }
  addCabinet(main, 2.36, 0.54, false);
  addCabinet(side, 1.6, 0.5, true);

  parent.identity();
  // The baked slab is actually y=.715.. .760 (read from transformed GLB
  // positions), as in buildDesk. Keep all additions BELOW its underside.
  // Rear beam clears the drawer body (x=.315.. .835, z=-.35.. .35).
  place(beams, 0, 0.687, -0.392);
  for (const x of [-0.745, 0.745]) place(mounts, x, 0.7115, -0.392);
  // Only the exposed left column needs a mounting arm: the right side already
  // meets the drawer assembly. Extending through that body would create clips.
  place(arms, -0.765, 0.693, 0);
  for (const x of [-0.765, 0.765]) {
    // Four separate strips form a real hollow wiper collar, never a solid cap
    // through the upper lifting column (.070 x .060). Overlap seats it on the
    // lower column's top at .360, as on a telescoping desk leg.
    for (const sign of [-1, 1]) {
      place(seals, x + sign * 0.039, 0.362, 0, 0, [0.006, 0.012, 0.072]);
      place(seals, x, 0.362, sign * 0.0345, 0, [0.072, 0.012, 0.006]);
      place(footCaps, x, 0.020, sign * 0.328);
    }
  }

  const stats = { drawCalls: 0, triangles: 0, instances: 0, geometries: batches.length, materials: 4, features: {} };
  for (const entry of batches) {
    const mesh = new THREE.InstancedMesh(entry.geometry, entry.material, entry.matrices.length);
    mesh.name = `rt_realism_${entry.name}`;
    entry.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.layers.set(0);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
    const triangles = (entry.geometry.index?.count ?? entry.geometry.attributes.position.count) / 3 * mesh.count;
    stats.drawCalls++;
    stats.triangles += triangles;
    stats.instances += mesh.count;
    stats.features[entry.name] = { instances: mesh.count, triangles };
  }
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  stats.bounds = { min: bounds.min.toArray(), max: bounds.max.toArray() };
  group.userData.studioRealism = stats;
  scene.add(group);
  let disposed = false;
  return {
    group, stats,
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      for (const mesh of group.children) mesh.dispose();
      for (const entry of batches) entry.geometry.dispose();
      for (const material of [finish, steel, rubber, screw]) material.dispose();
      group.clear();
    },
  };
}
