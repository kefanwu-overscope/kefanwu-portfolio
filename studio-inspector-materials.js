import * as THREE from 'three';

// These shaders read exported source parameters and immutable source-space
// coordinates. Lighting differs between WebGL and Cycles; source geometry,
// linear colors, mapping directions, and absolute material animation survive.
export function installSourceMaterial(material, source) {
  const procedural = source.procedural;
  const carbon = procedural?.type === 'carbon';
  const noise = procedural?.type === 'noise';
  const heat = source.heat;
  if (!carbon && !noise && !heat) return;
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
      declarations.push(`attribute ${type} ${name};`);
      varying.push(`varying ${type} vStudio_${name};`);
      assignments.push(`vStudio_${name} = ${variable};`);
    };
    if (carbon || noise) append('vec3', 'sourceCoordinates');
    if (noise && procedural.coordinateSpace === 'object') append('vec3', 'objectCoordinates');
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
      const ramp = procedural.ramp;
      shader.uniforms.studioNoiseScale = { value: procedural.scale || 1 };
      shader.uniforms.studioMappingScale = { value: new THREE.Vector3().fromArray(procedural.mappingScale || [1, 1, 1]) };
      shader.uniforms.studioMappingRotation = { value: procedural.rotation || 0 };
      fragment.push('uniform float studioNoiseScale; uniform vec3 studioMappingScale; uniform float studioMappingRotation;');
      fragment.push(`float studioHash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x + p.y) * p.z); }
        float studioNoise(vec3 p) {
          vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(studioHash(i), studioHash(i + vec3(1,0,0)), f.x),
                         mix(studioHash(i + vec3(0,1,0)), studioHash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(studioHash(i + vec3(0,0,1)), studioHash(i + vec3(1,0,1)), f.x),
                         mix(studioHash(i + vec3(0,1,1)), studioHash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }`);
      if (ramp?.length >= 2) {
        shader.uniforms.studioNoiseA = { value: new THREE.Color().fromArray(ramp[0].color) };
        shader.uniforms.studioNoiseB = { value: new THREE.Color().fromArray(ramp[ramp.length - 1].color) };
        shader.uniforms.studioRampRange = { value: new THREE.Vector2(ramp[0].position, ramp[ramp.length - 1].position) };
        fragment.push('uniform vec3 studioNoiseA; uniform vec3 studioNoiseB; uniform vec2 studioRampRange;');
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          vec3 studioCoord = vStudio_${procedural.coordinateSpace === 'object' ? 'objectCoordinates' : 'sourceCoordinates'};
          float studioCos = cos(studioMappingRotation), studioSin = sin(studioMappingRotation);
          studioCoord.xy = mat2(studioCos, studioSin, -studioSin, studioCos) * studioCoord.xy;
          studioCoord *= studioMappingScale * studioNoiseScale;
          float studioGrain = (studioNoise(studioCoord) + 0.5 * studioNoise(studioCoord * 2.0) + 0.25 * studioNoise(studioCoord * 4.0)) / 1.75;
          diffuseColor.rgb = mix(studioNoiseA, studioNoiseB, clamp((studioGrain - studioRampRange.x) / max(0.001, studioRampRange.y - studioRampRange.x), 0.0, 1.0));`);
      }
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
  material.customProgramCacheKey = () => `studio-source-v1:${JSON.stringify({ procedural, heat })}`;
}
