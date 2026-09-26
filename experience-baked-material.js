import * as THREE from 'three';

// RGBM stores linear radiance in RGB and a multiplier in alpha. Preserve all
// four channels through browser decoding; alpha is data, not transparency.
export async function loadRGBMLightmap(url, { range = 16, timeout = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Baked lighting unavailable (${response.status})`);
    const bitmap = await createImageBitmap(await response.blob(), {
      imageOrientation: 'none', premultiplyAlpha: 'none', colorSpaceConversion: 'none',
    });
    if (controller.signal.aborted) { bitmap.close(); throw new DOMException('Lighting load aborted', 'AbortError'); }
    const texture = new THREE.Texture(bitmap);
    texture.channel = 1;
    texture.flipY = false;
    texture.premultiplyAlpha = false;
    texture.colorSpace = THREE.NoColorSpace;
    // Encoded RGBM mip averaging is not radiometrically correct. The bake is
    // already filtered; bilinear sampling keeps atlas seams and range intact.
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.userData.rgbmRange = range;
    texture.needsUpdate = true;
    texture.addEventListener('dispose', () => bitmap.close());
    return texture;
  } finally { clearTimeout(timer); }
}

export function installBakedDiffuse(material, { secondMap, blend, range = 16, detail = null } = {}) {
  if (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial) return;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.studioLightMapB = secondMap;
    shader.uniforms.studioLightMix = blend;
    shader.uniforms.studioRGBMRange = { value: range };
    if (detail) {
      shader.uniforms.studioDeskMapA = detail.firstMap;
      shader.uniforms.studioDeskMapB = detail.secondMap;
      shader.uniforms.studioDeskBounds = { value: new THREE.Vector4(...detail.bounds) };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 studioBakeWorldPosition;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nstudioBakeWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    }
    const token = 'vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );';
    const maps = THREE.ShaderChunk.lights_fragment_maps;
    if (!maps.includes(token) || !shader.fragmentShader.includes('#include <lights_fragment_end>')) {
      throw new Error('Baked lighting needs the verified Three.js r185 shader layout.');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D studioLightMapB;\nuniform float studioLightMix;\nuniform float studioRGBMRange;' + (detail ? '\nvarying vec3 studioBakeWorldPosition;\nuniform sampler2D studioDeskMapA;\nuniform sampler2D studioDeskMapB;\nuniform vec4 studioDeskBounds;' : ''))
      .replace('#include <lights_fragment_maps>', maps.replace(token, `
        vec4 studioLightA = texture2D( lightMap, vLightMapUv );
        vec4 studioLightB = texture2D( studioLightMapB, vLightMapUv );
        vec3 studioBakedRadiance = mix(studioLightA.rgb * studioLightA.a,
          studioLightB.rgb * studioLightB.a, studioLightMix) * studioRGBMRange;
        ${detail ? `
        vec2 studioDeskUV = (studioBakeWorldPosition.xz - studioDeskBounds.xy) / studioDeskBounds.zw;
        vec4 studioDeskA = texture2D(studioDeskMapA, studioDeskUV);
        vec4 studioDeskB = texture2D(studioDeskMapB, studioDeskUV);
        vec3 studioDeskRadiance = mix(studioDeskA.rgb * studioDeskA.a,
          studioDeskB.rgb * studioDeskB.a, studioLightMix) * studioRGBMRange;
        float studioDeskWeight = smoothstep(0.8, 0.98, inverseTransformDirection(geometryNormal, viewMatrix).y);
        studioBakedRadiance = mix(studioBakedRadiance, studioDeskRadiance, studioDeskWeight);
        ` : ''}
        vec4 lightMapTexel = vec4(studioBakedRadiance * PI, 1.0);
      `))
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        #if defined(USE_LIGHTMAP) && defined(RE_IndirectDiffuse)
          // Cycles' colorless DIFFUSE bake is irradiance / PI (unit-world
          // calibration is recorded with the bake). Replace diffuse exactly
          // once, retaining all direct/IBL specular and multiple scattering.
          reflectedLight.directDiffuse = vec3(0.0);
          reflectedLight.indirectDiffuse = vec3(0.0);
          RE_IndirectDiffuse(studioBakedRadiance * PI * lightMapIntensity,
            geometryPosition, geometryNormal, geometryViewDir,
            geometryClearcoatNormal, material, reflectedLight);
        #endif
      `);
  };
  material.customProgramCacheKey = () => 'studio-cycles-rgbm-diffuse-r185-v1' + (detail ? '-desk' : '');
  material.needsUpdate = true;
}
