// Browser-side exporter: run in the DevTools console on experience.html
// (or via preview_eval) with a local receiver listening on 127.0.0.1:4199.
// Collects the STATIC bake layer — room shell, cabinets, desk, desk lamp,
// workbench, tool chest — and posts it as static-room.glb. Excludes all
// exhibit pivots (they rotate), the chair + plant (third-party, real-time),
// and lights (rebuilt in Blender).
(async function () {
  const e = window.__exp;
  const mod = await import("https://cdn.jsdelivr.net/npm/three@0.185.0/examples/jsm/exporters/GLTFExporter.js");
  const pivots = new Set(e.hotspots);
  const statics = [];
  e.scene.children.forEach((o) => {
    if (o.isLight || pivots.has(o)) return;
    if (o.name === "Sketchfab_Scene" || o.name === "Scene") return; // chair + plant
    let meshes = 0;
    o.traverse((m) => { if (m.isMesh) meshes++; });
    if (!meshes) return;
    statics.push(o);
  });
  const buf = await new mod.GLTFExporter().parseAsync(statics, { binary: true });
  const u8 = new Uint8Array(buf), CH = 0x8000, parts = [];
  for (let i = 0; i < u8.length; i += CH) parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CH)));
  const r = await fetch("http://127.0.0.1:4199", {
    method: "POST",
    headers: { "X-Name": "static-room.glb" },
    body: "data:model/gltf-binary;base64," + btoa(parts.join("")),
  });
  console.log("exported", statics.length, "objects,", (u8.length / 1048576).toFixed(1), "MB, POST", r.status);
})();
