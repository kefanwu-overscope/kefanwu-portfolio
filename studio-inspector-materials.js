import * as THREE from 'three';

// These shaders read exported source parameters and immutable source-space
// coordinates. Lighting differs between WebGL and Cycles; source geometry,
// linear colors, mapping directions, and absolute material animation survive.
export function installSourceMaterial(material, source) {
  const procedural = source.procedural;
  const carbon = procedural?.type === 'carbon';
  const steeringWeave = procedural?.type === 'steering-weave';
  const sourceNoise = procedural?.type === 'noise';
  const surface = source.surfaceDetail;
  const noise = !carbon && (sourceNoise || !!surface);
  const noiseParameters = sourceNoise ? procedural : surface;
  const heat = source.heat;
  if (!carbon && !noise && !steeringWeave && !heat) return;
  const uniforms = material.userData.motionUniforms;
  if (heat) {
    uniforms.warming = { value: 0 };
    uniforms.incandescence = { value: 0 };
  }
  if (carbon) {
    // The moving cloth alpha comes from its exported point attribute. The
    // retained shell has alpha 1 and shares this same source material.
    material.transparent = true;
    material.depthWrite = true;
  }
  material.onBeforeCompile = (shader) => {
    material.userData.sourceShaderCompiled = true;
    const declarations = [];
    const varying = [];
    const assignments = [];
    const fragment = [];
    const append = (type, name, variable = name) => {
      if (name === variable) declarations.push(`attribute ${type} ${name};`);
      varying.push(`varying ${type} vStudio_${name};`);
      assignments.push(`vStudio_${name} = ${variable};`);
    };
    if (carbon || sourceNoise) append('vec3', 'sourceCoordinates');
    if ((sourceNoise && procedural.coordinateSpace === 'object') || steeringWeave) append('vec3', 'objectCoordinates');
    if (noise || steeringWeave) {
      if (noise && !sourceNoise) append('vec3', 'surfaceCoordinates', 'position');
      // Room exhibits reuse the source material at a smaller display scale.
      // Transform height with the object so their grain does not grow there.
      append('float', 'surfaceScale', 'length(modelViewMatrix[0].xyz)');
    }
    if (steeringWeave) {
      shader.uniforms.studioWheelScale = { value: procedural.scale };
      shader.uniforms.studioWheelNormal = { value: new THREE.Vector3().fromArray(procedural.faceNormal) };
      shader.uniforms.studioWheelUp = { value: new THREE.Vector3().fromArray(procedural.faceUp) };
      shader.uniforms.studioWheelPlanes = { value: new THREE.Vector2().fromArray(procedural.facePlanes) };
      fragment.push('uniform float studioWheelScale; uniform vec3 studioWheelNormal; uniform vec3 studioWheelUp; uniform vec2 studioWheelPlanes;');
      fragment.push(`float studioWheelTwill(vec2 p) {
        vec2 cell = floor(p);
        float over = step(2.0, mod(cell.x + cell.y, 4.0));
        float yarn = mix(sin(fract(p.y) * 3.14159265), sin(fract(p.x) * 3.14159265), over);
        return 0.5 + (over - 0.5) * 0.55 + (yarn - 0.63661977) * 0.3;
      }`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 studioWheelDx = dFdx(vStudio_objectCoordinates), studioWheelDy = dFdy(vStudio_objectCoordinates);
        vec3 studioWheelCross = cross(studioWheelDx, studioWheelDy);
        float studioWheelFacing = abs(dot(studioWheelCross, studioWheelNormal)) / max(length(studioWheelCross), 0.000000000001);
        float studioWheelPlane = dot(vStudio_objectCoordinates, studioWheelNormal);
        float studioWheelDistance = min(abs(studioWheelPlane - studioWheelPlanes.x), abs(studioWheelPlane - studioWheelPlanes.y));
        float studioWheelFace = smoothstep(0.995, 0.999, studioWheelFacing) * (1.0 - smoothstep(0.0003, 0.0015, studioWheelDistance));
        vec2 studioWheelUV = vec2(vStudio_objectCoordinates.x, dot(vStudio_objectCoordinates, studioWheelUp)) * studioWheelScale;
        float studioWheelFootprint = max(length(dFdx(studioWheelUV)), length(dFdy(studioWheelUV)));
        float studioWheelGrain = mix(0.5, studioWheelTwill(studioWheelUV), 1.0 - smoothstep(0.45, 1.35, studioWheelFootprint));
        // The confirmed dark source color remains the mean. Only the actual
        // broad plate faces receive weave; hub, bores and cut edges stay plain.
        diffuseColor.rgb *= 1.0 + studioWheelFace * (studioWheelGrain - 0.5) * 0.65;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + studioWheelFace * (studioWheelGrain - 0.5) * 0.1, 0.04, 1.0);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 studioWheelViewDx = dFdx(-vViewPosition), studioWheelViewDy = dFdy(-vViewPosition);
        vec3 studioWheelRx = cross(studioWheelViewDy, normal), studioWheelRy = cross(normal, studioWheelViewDx);
        float studioWheelDet = dot(studioWheelViewDx, studioWheelRx);
        vec3 studioWheelGradient = dFdx(studioWheelGrain) * studioWheelRx + dFdy(studioWheelGrain) * studioWheelRy;
        if (abs(studioWheelDet) > 0.0000000001) {
          vec3 studioWheelSlope = 0.0001 * vStudio_surfaceScale * studioWheelFace * studioWheelGradient / studioWheelDet;
          studioWheelSlope *= min(1.0, 0.035 / max(length(studioWheelSlope), 0.000001));
          normal = normalize(normal - studioWheelSlope);
        }`);
    }
    if (carbon) {
      append('float', 'attributeOpacity');
      append('float', 'attributeRoughness');
      shader.uniforms.studioCarbonScale = { value: procedural.scale || 240 };
      shader.uniforms.studioCarbonA = { value: new THREE.Color().fromArray(procedural.color1) };
      shader.uniforms.studioCarbonB = { value: new THREE.Color().fromArray(procedural.color2) };
      shader.uniforms.studioCarbonBump = { value: (procedural.bumpStrength || 0) * (procedural.bumpDistance || 0) };
      fragment.push('uniform float studioCarbonScale; uniform vec3 studioCarbonA; uniform vec3 studioCarbonB; uniform float studioCarbonBump;');
      fragment.push(`float studioChecker(vec3 p) {
        // Integral of the source's square checker wave, averaged over the
        // pixel footprint. A sine divided by footprint attenuates all three
        // axes excessively and erases weave even when cells are resolvable.
        vec3 footprint = max(fwidth(p), vec3(0.0001));
        vec3 lower = 1.0 - abs(mod(p - footprint * 0.5, 2.0) - 1.0);
        vec3 upper = 1.0 - abs(mod(p + footprint * 0.5, 2.0) - 1.0);
        vec3 filtered = clamp((upper - lower) / footprint, -1.0, 1.0);
        return 0.5 - 0.5 * filtered.x * filtered.y * filtered.z;
      }`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float studioWeave = studioChecker(vStudio_sourceCoordinates * studioCarbonScale);
        diffuseColor.rgb = mix(studioCarbonA, studioCarbonB, studioWeave);
        diffuseColor.a *= clamp(vStudio_attributeOpacity, 0.0, 1.0);
        if (diffuseColor.a < 0.002) discard;`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(vStudio_attributeRoughness, 0.04, 1.0);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 studioDx = dFdx(-vViewPosition), studioDy = dFdy(-vViewPosition);
        vec3 studioRx = cross(studioDy, normal), studioRy = cross(normal, studioDx);
        float studioDet = dot(studioDx, studioRx);
        vec3 studioGradient = dFdx(studioWeave) * studioRx + dFdy(studioWeave) * studioRy;
        if (abs(studioDet) > 0.0000000001) normal = normalize(abs(studioDet) * normal - sign(studioDet) * studioCarbonBump * studioGradient);`);
    }
    if (noise) {
      const ramp = sourceNoise ? procedural.ramp : null;
      const bump = (noiseParameters.bumpStrength ?? 0) * (noiseParameters.bumpDistance ?? 0) * (surface?.bumpScale ?? 1);
      shader.uniforms.studioNoiseScale = { value: noiseParameters.scale ?? 1 };
      shader.uniforms.studioMappingScale = { value: new THREE.Vector3().fromArray(noiseParameters.mappingScale || [1, 1, 1]) };
      shader.uniforms.studioMappingRotation = { value: noiseParameters.rotation ?? 0 };
      shader.uniforms.studioNoiseBump = { value: bump };
      shader.uniforms.studioNoiseRoughness = { value: surface?.roughnessVariation ?? (bump ? .04 : 0) };
      fragment.push('uniform float studioNoiseScale; uniform vec3 studioMappingScale; uniform float studioMappingRotation; uniform float studioNoiseBump; uniform float studioNoiseRoughness;');
      fragment.push(`float studioHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
        float studioNoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(studioHash(i), studioHash(i + vec3(1,0,0)), f.x),
                         mix(studioHash(i + vec3(0,1,0)), studioHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(studioHash(i + vec3(0,0,1)), studioHash(i + vec3(1,0,1)), f.x),
                         mix(studioHash(i + vec3(0,1,1)), studioHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`);
      // Remove unresolved octaves before differentiating height. This keeps
      // moving highlights stable at the SD frame size and on room exhibits.
      fragment.push(`float studioFilteredNoise(vec3 p, float footprint) {
        return mix(0.5, studioNoise(p), 1.0 - smoothstep(0.35, 1.25, footprint));
      }`);
      const coordinate = sourceNoise ? (procedural.coordinateSpace === 'object' ? 'objectCoordinates' : 'sourceCoordinates') : 'surfaceCoordinates';
      const gain = Math.max(0, Math.min(1, noiseParameters.roughness ?? .5));
      const lacunarity = Math.max(1, Math.min(4, noiseParameters.lacunarity ?? 2));
      const detail = Math.max(0, Math.min(4, noiseParameters.detail ?? 2));
      const octaves = [];
      let totalWeight = 0;
      for (let octave = 0; octave <= Math.ceil(detail); octave++) {
        const weight = Math.pow(gain, octave) * Math.min(1, detail + 1 - octave);
        if (weight <= 0) continue;
        totalWeight += weight;
        const frequency = Math.pow(lacunarity, octave).toFixed(8);
        octaves.push(`${weight.toFixed(8)} * studioFilteredNoise(studioCoord * ${frequency}, studioFootprint * ${frequency})`);
      }
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 studioCoord = vStudio_${coordinate};
        float studioCos = cos(studioMappingRotation), studioSin = sin(studioMappingRotation);
        studioCoord.xy = mat2(studioCos, studioSin, -studioSin, studioCos) * studioCoord.xy;
        studioCoord *= studioMappingScale * studioNoiseScale;
        float studioFootprint = max(length(dFdx(studioCoord)), length(dFdy(studioCoord)));
        float studioGrain = (${octaves.join(' + ')}) / ${totalWeight.toFixed(8)};`);
      if (ramp?.length >= 2) {
        shader.uniforms.studioNoiseA = { value: new THREE.Color().fromArray(ramp[0].color) };
        shader.uniforms.studioNoiseB = { value: new THREE.Color().fromArray(ramp[ramp.length - 1].color) };
        shader.uniforms.studioRampRange = { value: new THREE.Vector2(ramp[0].position, ramp[ramp.length - 1].position) };
        fragment.push('uniform vec3 studioNoiseA; uniform vec3 studioNoiseB; uniform vec2 studioRampRange;');
        const color = 'diffuseColor.rgb = mix(studioNoiseA, studioNoiseB, clamp((studioGrain - studioRampRange.x) / max(0.001, studioRampRange.y - studioRampRange.x), 0.0, 1.0));';
        shader.fragmentShader = shader.fragmentShader.replace('#include <alphamap_fragment>', `${color}\n#include <alphamap_fragment>`);
      }
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (studioGrain - 0.5) * studioNoiseRoughness, 0.04, 1.0);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 studioNoiseDx = dFdx(-vViewPosition), studioNoiseDy = dFdy(-vViewPosition);
        vec3 studioNoiseRx = cross(studioNoiseDy, normal), studioNoiseRy = cross(normal, studioNoiseDx);
        float studioNoiseDet = dot(studioNoiseDx, studioNoiseRx);
        vec3 studioNoiseGradient = dFdx(studioGrain) * studioNoiseRx + dFdy(studioGrain) * studioNoiseRy;
        if (abs(studioNoiseDet) > 0.0000000001) {
          vec3 studioSlope = studioNoiseBump * vStudio_surfaceScale * studioNoiseGradient / studioNoiseDet;
          // A cap protects thin/degenerate triangles and exaggerated source
          // coordinates; it never changes vertices, silhouettes or source normals.
          studioSlope *= min(1.0, 0.14 / max(length(studioSlope), 0.000001));
          normal = normalize(normal - studioSlope);
        }`);
    }
    if (heat) {
      append('float', 'heatExposure');
      shader.uniforms.studioWarming = uniforms.warming;
      shader.uniforms.studioIncandescence = uniforms.incandescence;
      shader.uniforms.studioWarmColor = { value: new THREE.Color().fromArray(heat.warmColor) };
      shader.uniforms.studioEmissiveColor = { value: new THREE.Color().fromArray(heat.emissiveColor) };
      fragment.push('uniform float studioWarming; uniform float studioIncandescence; uniform vec3 studioWarmColor; uniform vec3 studioEmissiveColor;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, studioWarmColor, clamp(studioWarming * vStudio_heatExposure, 0.0, 1.0));`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance = studioEmissiveColor * studioIncandescence * vStudio_heatExposure;`);
    }
    shader.vertexShader = `${declarations.join('\n')}\n${varying.join('\n')}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n${assignments.join('\n')}`);
    shader.fragmentShader = `${varying.join('\n')}\n${fragment.join('\n')}\n${shader.fragmentShader}`;
  };
  // source-v1 is also the room ray bridge's vertex-preservation contract.
  // Version the fragment finish inside that contract; positions still match.
  material.customProgramCacheKey = () => `studio-source-v1:${JSON.stringify({ surfaceRevision: 2, procedural, surface, heat })}`;
}
