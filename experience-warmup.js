import * as THREE from "three";

// r185 compile() reads object.material, not scene.overrideMaterial. Keep the
// real objects so instancing and geometry attributes match; the originals are
// back in place before this returns, including when submission throws.
function compileWithOverride(renderer, root, camera, targetScene, material) {
  const originals = [];
  root.traverse((object) => {
    if (!object.material) return;
    originals.push([object, object.material]);
    const substitute = (original) => original.allowOverride === true ? material : original;
    object.material = Array.isArray(object.material) ? object.material.map(substitute) : substitute(object.material);
  });
  try { return renderer.compileAsync(root, camera, targetScene); }
  finally { for (const [object, original] of originals) object.material = original; }
}

// 2026-10-26: r185 renderTransmissionPass draws every DoubleSide transmissive
// material a second time, as BackSide, into its transmission target
// (three.module.js ~18050). compile() never builds that variant, so the first
// frame the cabinet's glass, acrylic, resin or HDPE came into view linked it
// on the main thread: a 1.1-1.5 s freeze ~0.7 s after reveal at 1440, ~0.6 s
// on phones. Build it here instead. The caller's target must be a render
// target, as the transmission target is, so the program parameters match
// (linear output, no tone mapping). The restore bumps each material's version
// exactly as that pass does every frame; the next draw finds the cached
// DoubleSide program, so nothing is compiled twice.
function compileTransmissionBackfaces(renderer, root, camera, targetScene) {
  const flipped = new Set();
  root.traverse((object) => {
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (material?.transmission > 0 && material.side === THREE.DoubleSide) flipped.add(material);
    }
  });
  if (flipped.size === 0) return;
  for (const material of flipped) { material.side = THREE.BackSide; material.needsUpdate = true; }
  try { renderer.compile(root, camera, targetScene); }
  finally { for (const material of flipped) { material.side = THREE.DoubleSide; material.needsUpdate = true; } }
}

// Resolves once every program has linked, then reads its uniform table: the
// step three otherwise runs inside a program's first draw (onFirstUse). With
// KHR_parallel_shader_compile, isReady() polls without blocking and that read
// is cheap. Without it isReady() is always true and the read would wait for
// the link right here, so it stays with the first draw, as before. compileAsync
// alone only waits for each material's last program, which misses the BackSide
// variants above and those of transparent DoubleSide materials.
function whenProgramsLinked(renderer, programs) {
  const polled = renderer.extensions.has("KHR_parallel_shader_compile");
  const pending = new Set(programs);
  return new Promise((resolve) => {
    const check = () => {
      if (renderer.getContext().isContextLost()) { resolve(); return; }
      for (const program of pending) {
        if (program.usedTimes === 0) { pending.delete(program); continue; } // released
        if (!program.isReady()) continue;
        if (polled) program.getUniforms();
        pending.delete(program);
      }
      if (pending.size === 0) resolve();
      else setTimeout(check, 10);
    };
    check();
  });
}

const programsSince = (renderer, existing) => renderer.info.programs.filter((program) => !existing.has(program));

// Match the composer's render targets: compiling against the screen creates
// sRGB/tone-mapped scene programs that cannot be reused by its linear passes.
export async function prepareRoomShaders(renderer, scene, camera, composer, { gtao, bokeh } = {}) {
  if (!renderer.compileAsync) return;
  const previousTarget = renderer.getRenderTarget();
  const quad = new THREE.PlaneGeometry(2, 2);
  const existing = new Set(renderer.info.programs);
  try {
    renderer.setRenderTarget(composer.readBuffer);
    const scenePrograms = renderer.compileAsync(scene, camera);
    compileTransmissionBackfaces(renderer, scene, camera, null);
    await scenePrograms;

    const overrides = [gtao?.normalMaterial, bokeh?._materialDepth].filter(Boolean);
    for (const material of overrides) await compileWithOverride(renderer, scene, camera, null, material);

    const postScene = new THREE.Scene();
    const postMaterials = new Set();
    const output = composer.passes.find((pass) => pass.isOutputPass);
    for (const pass of composer.passes) {
      for (const value of Object.values(pass)) {
        if (value?.isMaterial) postMaterials.add(value);
        if (Array.isArray(value)) for (const material of value) if (material?.isMaterial) postMaterials.add(material);
      }
    }
    for (const material of overrides) postMaterials.delete(material);
    if (output) postMaterials.delete(output.material);
    for (const material of postMaterials) postScene.add(new THREE.Mesh(quad, material));
    await renderer.compileAsync(postScene, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1));

    if (output) {
      // Let OutputPass choose its own color/tone defines, without drawing.
      // Duplicating that selection here would drift when the renderer changes.
      const previousScreen = output.renderToScreen;
      let compiled;
      try {
        output.renderToScreen = true;
        output.render({
          outputColorSpace: renderer.outputColorSpace,
          toneMapping: renderer.toneMapping,
          toneMappingExposure: renderer.toneMappingExposure,
          setRenderTarget: (target) => renderer.setRenderTarget(target),
          render: (object, view) => { compiled = renderer.compileAsync(object, view); },
        }, composer.writeBuffer, composer.readBuffer);
      } finally { output.renderToScreen = previousScreen; }
      await compiled;
    }
    await whenProgramsLinked(renderer, programsSince(renderer, existing));
  } finally {
    renderer.setRenderTarget(previousTarget);
    quad.dispose();
  }
}

// 2026-10-24: one loaded root that is not in the room yet (a deferred prop).
// Its own programs and its GTAO/Bokeh override variants are compiled against
// the room's lights/environment and the composer target, then awaited until
// every program reports completion. With KHR_parallel_shader_compile the GPU
// process links them off the main thread, so the first draw after mounting
// never stops the page. The live room keeps rendering in between: the target
// is restored before any awaited continuation can run.
export async function prepareRootShaders(renderer, root, scene, camera, composer, { gtao, bokeh } = {}) {
  if (!renderer.compileAsync) return;
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace?.() ?? 0;
  const previousLevel = renderer.getActiveMipmapLevel?.() ?? 0;
  const pending = [];
  const existing = new Set(renderer.info.programs);
  try {
    renderer.setRenderTarget(composer.readBuffer);
    pending.push(renderer.compileAsync(root, camera, scene));
    compileTransmissionBackfaces(renderer, root, camera, scene);
    for (const material of [gtao?.normalMaterial, bokeh?._materialDepth].filter(Boolean)) {
      pending.push(compileWithOverride(renderer, root, camera, scene, material));
    }
  } finally {
    renderer.setRenderTarget(previousTarget, previousFace, previousLevel);
  }
  // Submission above is synchronous, so these are this root's programs only.
  pending.push(whenProgramsLinked(renderer, programsSince(renderer, existing)));
  await Promise.all(pending);
}
