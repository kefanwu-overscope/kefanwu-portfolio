import * as THREE from "three";

const declarations = `
varying vec3 vStudioRTWorldPosition;
uniform sampler2D studioRTVisibility;
uniform sampler2D studioRTNormalDepth;
uniform mat4 studioRTView;
uniform mat4 studioRTViewProjection;
uniform mat4 studioRTInverseProjection;
uniform vec2 studioRTSize;
uniform float studioRTEnabled;
uniform float studioRTConfidence;
uniform float studioRTAOStrength;
uniform float studioRTShadowStrength;
uniform int studioRTLightType;
uniform int studioRTLightIndex;

// Four-tap joint bilateral upsampling: a different surface or a missing capture
// yields zero confidence, so the existing PBR/raster result remains available.
vec4 studioRTLookup(vec3 worldPosition, vec3 worldNormal) {
  vec3 planeCross = cross(dFdx(worldPosition), dFdy(worldPosition));
  if (studioRTEnabled < 0.5) return vec4(1.0, 1.0, 0.0, 0.0);
  float planeArea = dot(planeCross, planeCross);
  if (planeArea < 0.00000000000000000001) return vec4(1.0, 1.0, 0.0, 0.0);
  vec4 projected = studioRTViewProjection * vec4(worldPosition, 1.0);
  if (projected.w <= 0.0) return vec4(1.0, 1.0, 0.0, 0.0);
  vec2 uv = projected.xy / projected.w * 0.5 + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec4(1.0, 1.0, 0.0, 0.0);
  vec3 viewPosition = (studioRTView * vec4(worldPosition, 1.0)).xyz;
  float depth = -viewPosition.z;
  // Raster derivatives recover the actual geometric face plane, independently
  // of normal-map detail. A tap on this same tilted plane legitimately has a
  // different depth; testing it against the center depth produces texel bands.
  vec3 planeNormal = mat3(studioRTView) * (planeCross * inversesqrt(planeArea));
  vec2 pixel = uv * studioRTSize - 0.5;
  vec2 base = floor(pixel), fraction = fract(pixel);
  vec2 visibility = vec2(0.0);
  float weightSum = 0.0;
  for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
    vec2 offset = vec2(float(x), float(y));
    vec2 sampleUV = (clamp(base + offset, vec2(0.0), studioRTSize - 1.0) + 0.5) / studioRTSize;
    vec4 guide = texture2D(studioRTNormalDepth, sampleUV);
    vec4 result = texture2D(studioRTVisibility, sampleUV);
    // Unproject a near/far pair, which works for both perspective and ortho.
    vec4 nearH = studioRTInverseProjection * vec4(sampleUV * 2.0 - 1.0, -1.0, 1.0);
    vec4 farH = studioRTInverseProjection * vec4(sampleUV * 2.0 - 1.0, 1.0, 1.0);
    vec3 rayOrigin = nearH.xyz / nearH.w;
    vec3 rayDirection = farH.xyz / farH.w - rayOrigin;
    float denominator = dot(planeNormal, rayDirection);
    if (abs(denominator) < 0.000001) continue;
    float planeDistance = dot(planeNormal, viewPosition - rayOrigin) / denominator;
    float expectedDepth = -(rayOrigin + rayDirection * planeDistance).z;
    float tolerance = max(0.0015, expectedDepth * 0.0015);
    float delta = abs(guide.a - expectedDepth);
    if (expectedDepth <= 0.0 || guide.a <= 0.0 || result.a < 0.5 || delta > tolerance * 3.0 ||
        abs(result.b - guide.a) > tolerance * 3.0 || dot(guide.xyz, guide.xyz) < 0.1) continue;
    float alignment = dot(normalize(guide.xyz), worldNormal);
    if (alignment < 0.8) continue;
    vec2 bilinear = mix(1.0 - fraction, fraction, offset);
    float weight = bilinear.x * bilinear.y * exp(-delta / tolerance) * pow(max(alignment, 0.0), 8.0);
    visibility += clamp(result.rg, 0.0, 1.0) * weight;
    weightSum += weight;
  }
  if (weightSum < 0.0001) return vec4(1.0, 1.0, 0.0, 0.0);
  // Normalize the accepted taps. Their footprint sum must not modulate effect
  // strength: that sum changes with subtexel position even on a uniform plane.
  return vec4(visibility / weightSum, studioRTConfidence, depth);
}
float studioRTShadow(float raster, int lightType, int lightIndex, float intensity, vec4 sampleValue) {
  if (lightType != studioRTLightType || lightIndex != studioRTLightIndex) return raster;
  float visibility = mix(1.0, sampleValue.g, intensity);
  return mix(raster, visibility, sampleValue.b * studioRTShadowStrength);
}
`;

function lightingChunk() {
  let chunk = THREE.ShaderChunk.lights_fragment_begin;
  for (const [name, type] of [["directional", 1], ["spot", 2]]) {
    const coordinate = name === "directional" ? "vDirectionalShadowCoord" : "vSpotLightCoord";
    const expression = new RegExp(`getShadow\\( ${name}ShadowMap\\[ i \\], [^;?]+?${coordinate}\\[ i \\] \\)`);
    if (!expression.test(chunk)) throw new Error(`Ray-traced shadows need the verified Three.js r185 ${name} shader layout.`);
    chunk = chunk.replace(expression, (call) => `studioRTShadow(${call}, ${type}, UNROLLED_LOOP_INDEX, ${name}LightShadow.shadowIntensity, studioRTSample)`);
  }
  return chunk;
}

export function createRaytraceMaterialBridge({ aoStrength = 0.22, shadowStrength = 1 } = {}) {
  const records = new Map();
  let disposed = false, visibility = null, normalDepth = null;
  const uniforms = {
    studioRTVisibility: { value: null }, studioRTNormalDepth: { value: null },
    studioRTView: { value: new THREE.Matrix4() }, studioRTViewProjection: { value: new THREE.Matrix4() },
    studioRTInverseProjection: { value: new THREE.Matrix4() },
    studioRTSize: { value: new THREE.Vector2(1, 1) }, studioRTEnabled: { value: 0 }, studioRTConfidence: { value: 0 },
    studioRTAOStrength: { value: Math.max(0, Math.min(0.5, aoStrength)) },
    studioRTShadowStrength: { value: Math.max(0, Math.min(1, shadowStrength)) },
    studioRTLightType: { value: 1 }, studioRTLightIndex: { value: 0 },
  };
  const stats = { materials: 0, compilations: 0, publications: 0, samples: 0, enabled: false, resets: 0, reason: null, failures: [] };
  const texture = (data, width, height, name) => {
    const result = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
    result.name = name; result.colorSpace = THREE.NoColorSpace; result.flipY = false;
    result.minFilter = result.magFilter = THREE.NearestFilter; result.generateMipmaps = false;
    result.needsUpdate = true; return result;
  };
  visibility = texture(new Float32Array([1, 1, 0, 0]), 1, 1, "Ray-traced AO and primary-light visibility");
  normalDepth = texture(new Float32Array(4), 1, 1, "Raytrace bilateral normal and depth guide");
  uniforms.studioRTVisibility.value = visibility; uniforms.studioRTNormalDepth.value = normalDepth;
  const modifiedLights = lightingChunk();
  function installMaterial(material) {
    if (disposed || !material || (!material.isMeshStandardMaterial && !material.isMeshPhysicalMaterial) || material.transmission > 0) return;
    const installed = records.get(material);
    if (installed && material.onBeforeCompile === installed.hook) return;
    const previousHook = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
    // Cache the old default key before replacing its referenced hook. Custom
    // procedural/bake cache functions retain their original material receiver.
    const priorKey = previousKey === THREE.Material.prototype.customProgramCacheKey ? previousKey.call(material) : null;
    const originalKey = priorKey ?? previousKey.call(material);
    if (previousHook === THREE.Material.prototype.onBeforeCompile || /^studio-(cycles-rgbm-diffuse-r185|source-v1)/.test(originalKey)) {
      material.userData.clusterVertexPositionsPreserved = true;
    }
    const hook = function (shader, renderer) {
      previousHook.call(this, shader, renderer);
      const vertex = shader.vertexShader, fragment = shader.fragmentShader;
      if (!vertex.includes("#include <common>") || !fragment.includes("#include <common>") ||
          !vertex.includes("#include <project_vertex>") || !fragment.includes("#include <lights_fragment_begin>") ||
          !fragment.includes("vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;")) {
        stats.failures.push(`Unsupported source shader: ${material.name || material.uuid}`);
        return;
      }
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = vertex.replace("#include <common>", "#include <common>\nvarying vec3 vStudioRTWorldPosition;")
        .replace("#include <project_vertex>", `#include <project_vertex>
          vec4 studioRTWorld = vec4(transformed, 1.0);
          #ifdef USE_BATCHING
            studioRTWorld = batchingMatrix * studioRTWorld;
          #endif
          #ifdef USE_INSTANCING
            studioRTWorld = instanceMatrix * studioRTWorld;
          #endif
          vStudioRTWorldPosition = (modelMatrix * studioRTWorld).xyz;
        `);
      shader.fragmentShader = fragment.replace("#include <common>", `#include <common>\n${declarations}`)
        .replace("#include <lights_fragment_begin>", `
          vec4 studioRTSample = studioRTLookup(vStudioRTWorldPosition, inverseTransformDirection(normal, viewMatrix));
          if (diffuseColor.a < 0.98) studioRTSample.b = 0.0;
          ${modifiedLights}
        `)
        .replace("vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;", `
          reflectedLight.indirectDiffuse *= mix(1.0, studioRTSample.r, studioRTSample.b * studioRTAOStrength);
          vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
        `);
      stats.compilations++;
    };
    const key = function () { return `${priorKey ?? previousKey.call(this)}|studio-raytrace-pbr-r185-v2-plane`; };
    records.set(material, { hook, key, previousHook, previousKey });
    material.onBeforeCompile = hook; material.customProgramCacheKey = key; material.needsUpdate = true;
    stats.materials = records.size;
  }
  function install(root) {
    if (root?.isMaterial) installMaterial(root);
    else root?.traverse((object) => {
      if (!object.isMesh || object.userData?.raytraceExcluded) return;
      (Array.isArray(object.material) ? object.material : [object.material]).forEach(installMaterial);
    });
    return stats.materials;
  }
  function publish(update, snapshot) {
    if (disposed || !update?.data || update.samples < 1 || !snapshot) return false;
    const { width, height, data } = update;
    const guide = update.normalDepth || snapshot.normalDepth;
    const cameraWorld = snapshot.cameraWorld?.elements || snapshot.cameraWorld;
    const inverseProjection = snapshot.inverseProjection?.elements || snapshot.inverseProjection;
    if (!(width > 0 && height > 0) || data.length !== width * height * 4 || guide?.length !== data.length || cameraWorld?.length !== 16 || inverseProjection?.length !== 16) return false;
    if (visibility.image.width !== width || visibility.image.height !== height) {
      visibility.dispose(); normalDepth.dispose();
      visibility = texture(data, width, height, "Ray-traced AO and primary-light visibility");
      normalDepth = texture(guide, width, height, "Raytrace bilateral normal and depth guide");
      uniforms.studioRTVisibility.value = visibility; uniforms.studioRTNormalDepth.value = normalDepth;
    } else {
      visibility.image.data = data; visibility.needsUpdate = true;
      if (normalDepth.image.data !== guide) { normalDepth.image.data = guide; normalDepth.needsUpdate = true; }
    }
    uniforms.studioRTSize.value.set(width, height);
    uniforms.studioRTView.value.fromArray(cameraWorld).invert();
    uniforms.studioRTInverseProjection.value.fromArray(inverseProjection);
    uniforms.studioRTViewProjection.value.fromArray(inverseProjection).invert().multiply(uniforms.studioRTView.value);
    uniforms.studioRTConfidence.value = Math.min(1, Math.sqrt(update.samples / 32));
    uniforms.studioRTLightType.value = snapshot.lightType === "spot" || snapshot.lightType === 2 ? 2 : snapshot.lightType === "none" || snapshot.lightType === 0 ? 0 : 1;
    uniforms.studioRTLightIndex.value = Math.max(0, snapshot.lightIndex ?? 0);
    uniforms.studioRTEnabled.value = 1;
    stats.enabled = true; stats.samples = update.samples; stats.publications++; stats.reason = null;
    return true;
  }
  function invalidate(reason = "changed") {
    uniforms.studioRTEnabled.value = 0; uniforms.studioRTConfidence.value = 0;
    stats.enabled = false; stats.samples = 0; stats.resets++; stats.reason = reason;
  }
  function dispose() {
    if (disposed) return;
    invalidate("disposed"); disposed = true;
    for (const [material, record] of records) {
      if (material.onBeforeCompile === record.hook) material.onBeforeCompile = record.previousHook;
      if (material.customProgramCacheKey === record.key) material.customProgramCacheKey = record.previousKey;
      material.needsUpdate = true;
    }
    records.clear(); visibility.dispose(); normalDepth.dispose(); stats.materials = 0;
  }
  return { install, publish, invalidate, dispose, uniforms, get stats() { return { ...stats, failures: [...stats.failures] }; } };
}
