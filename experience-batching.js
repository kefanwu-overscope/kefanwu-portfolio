import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// Only opaque, immobile procedural leaves are eligible. Keep small spatial
// buckets so an object behind the camera does not make the entire room draw.
// Materials and every vertex/normal/UV are retained, with transforms baked in.
export async function batchStaticRoom(scene, { exclude = [], yieldTask = () => Promise.resolve() } = {}) {
  const excluded = new Set(exclude.filter(Boolean));
  const buckets = new Map();
  const position = new THREE.Vector3();
  const stats = { sourceMeshes: 0, batches: 0, removedDraws: 0, triangles: 0 };
  scene.updateMatrixWorld(true);
  function visit(object, blocked = false) {
    blocked ||= excluded.has(object) || !object.visible || object.name.startsWith("bk_") ||
      object.name.startsWith("lod:") || !!object.userData.hotspot;
    if (blocked) return;
    const material = object.material;
    const geometry = object.geometry;
    if (object.isMesh && !object.isInstancedMesh && !object.isSkinnedMesh &&
        !object.children.length && material && !Array.isArray(material) &&
        !material.transparent && !material.transmission && !material.emissive?.getHex() &&
        object.onBeforeRender === THREE.Object3D.prototype.onBeforeRender &&
        object.matrixWorld.determinant() > 0 &&
        !geometry.morphAttributes.position && object.layers.mask === 1 &&
        geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity) {
      object.getWorldPosition(position);
      const attributes = Object.entries(geometry.attributes).map(([key, a]) =>
        `${key}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join("|");
      const cell = [position.x, position.y, position.z].map((v) => Math.floor(v / 1.25)).join(",");
      const key = `${material.uuid}:${object.castShadow}:${object.receiveShadow}:${object.renderOrder}:${cell}:${attributes}`;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(object);
    }
    for (const child of object.children) visit(child);
  }
  visit(scene);
  for (const meshes of buckets.values()) {
    if (meshes.length < 3) continue;
    const geometries = meshes.map((mesh) => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      return geometry.applyMatrix4(mesh.matrixWorld);
    });
    const geometry = mergeGeometries(geometries, false);
    geometries.forEach((g) => g.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const first = meshes[0];
    const batch = new THREE.Mesh(geometry, first.material);
    batch.name = "static-room-batch";
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    scene.add(batch);
    meshes.forEach((mesh) => mesh.removeFromParent());
    stats.sourceMeshes += meshes.length;
    stats.batches++;
    stats.removedDraws += meshes.length - 1;
    stats.triangles += geometry.attributes.position.count / 3;
    if (stats.batches % 6 === 0) await yieldTask();
  }
  return stats;
}
