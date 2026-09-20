import * as THREE from "three";

// Match the composer's render targets: compiling against the screen creates
// sRGB/tone-mapped scene programs that cannot be reused by its linear passes.
export async function prepareRoomShaders(renderer, scene, camera, composer, { gtao, bokeh } = {}) {
  if (!renderer.compileAsync) return;
  const previousTarget = renderer.getRenderTarget();
  const quad = new THREE.PlaneGeometry(2, 2);
  try {
    renderer.setRenderTarget(composer.readBuffer);
    await renderer.compileAsync(scene, camera);

    const overrides = [gtao?.normalMaterial, bokeh?._materialDepth].filter(Boolean);
    for (const material of overrides) {
      // r185 compile() reads object.material, not scene.overrideMaterial.
      // Keep the real objects so instancing and geometry attributes match.
      const originals = [];
      scene.traverse((object) => {
        if (!object.material) return;
        originals.push([object, object.material]);
        const substitute = (original) => original.allowOverride === true ? material : original;
        object.material = Array.isArray(object.material) ? object.material.map(substitute) : substitute(object.material);
      });
      let compiled;
      try { compiled = renderer.compileAsync(scene, camera); }
      finally { for (const [object, original] of originals) object.material = original; }
      await compiled;
    }

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
  } finally {
    renderer.setRenderTarget(previousTarget);
    quad.dispose();
  }
}
