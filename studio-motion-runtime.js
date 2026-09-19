// Absolute sampled poses: every seek reads source samples; no delta transform
// is applied to the previous pose. Camera controls never enter this module.
export const clampProgress = (value) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));

const COMPONENTS = { float32: Float32Array, uint32: Uint32Array, uint16: Uint16Array, uint8: Uint8Array };

export function readBufferView(buffer, descriptor) {
  if (!descriptor) return null;
  const Type = COMPONENTS[descriptor.componentType || 'float32'];
  if (!Type) throw new Error('Unsupported model buffer component type.');
  const offset = descriptor.byteOffset || 0;
  const count = descriptor.count;
  const itemSize = descriptor.itemSize || 1;
  const length = count * itemSize;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
      offset % Type.BYTES_PER_ELEMENT || offset + length * Type.BYTES_PER_ELEMENT > buffer.byteLength) {
    throw new Error('Invalid model buffer range.');
  }
  return new Type(buffer, offset, length);
}

export function sampleSpan(progress, sampleCount) {
  const sample = clampProgress(progress) * Math.max(0, sampleCount - 1);
  const first = Math.floor(sample);
  return { first, second: Math.min(sampleCount - 1, first + 1), alpha: sample - first };
}

export function sampleLinear(track, size, span, output) {
  const array = track.array || track;
  const stride = track.valuesPerFrame || size;
  const a = (track.frameMap ? track.frameMap[span.first] : span.first) * stride;
  const b = (track.frameMap ? track.frameMap[span.second] : span.second) * stride;
  if (track.elementMap) {
    const components = track.itemSize;
    for (let i = 0; i < size; i++) {
      const index = track.elementMap[Math.floor(i / components)] * components + i % components;
      output[i] = array[a + index] + (array[b + index] - array[a + index]) * span.alpha;
    }
  } else {
    for (let i = 0; i < size; i++) output[i] = array[a + i] + (array[b + i] - array[a + i]) * span.alpha;
  }
  return output;
}

export function sampleQuaternion(track, span, output) {
  const array = track.array || track;
  const a = (track.frameMap ? track.frameMap[span.first] : span.first) * 4;
  const b = (track.frameMap ? track.frameMap[span.second] : span.second) * 4;
  let dot = 0;
  for (let i = 0; i < 4; i++) dot += array[a + i] * array[b + i];
  const sign = dot < 0 ? -1 : 1;
  dot = Math.min(1, Math.abs(dot));
  let left = 1 - span.alpha;
  let right = span.alpha;
  if (dot < 0.9995) {
    const theta = Math.acos(dot);
    const divisor = Math.sin(theta);
    left = Math.sin((1 - span.alpha) * theta) / divisor;
    right = Math.sin(span.alpha * theta) / divisor;
  }
  let length = 0;
  for (let i = 0; i < 4; i++) {
    output[i] = left * array[a + i] + right * sign * array[b + i];
    length += output[i] * output[i];
  }
  length = Math.sqrt(length) || 1;
  for (let i = 0; i < 4; i++) output[i] /= length;
  return output;
}

function bindTracks(specification, buffer) {
  const result = {};
  for (const [name, descriptor] of Object.entries(specification || {})) result[name] = {
    array: readBufferView(buffer, descriptor),
    frameMap: descriptor.frameMap ? readBufferView(buffer, descriptor.frameMap) : null,
    elementMap: descriptor.elementMap ? readBufferView(buffer, descriptor.elementMap) : null,
    itemSize: descriptor.itemSize || 1,
    valuesPerFrame: descriptor.valuesPerFrame,
  };
  return result;
}

export function createSampledMotion({ manifest, buffer, nodes, materials }) {
  const count = manifest.sampleCount;
  if (!Number.isInteger(count) || count < 1) throw new Error('The model has no valid pose samples.');
  const nodeTracks = manifest.nodes.map((source, index) => ({ object: nodes[index], tracks: bindTracks(source.tracks, buffer) }));
  const materialTracks = (manifest.materials || []).map((source, index) => ({ material: materials[index], tracks: bindTracks(source.tracks, buffer) }));
  const values = new Float32Array(4);

  function seek(progress) {
    const span = sampleSpan(progress, count);
    for (const { object, tracks } of nodeTracks) {
      if (!object || object.userData?.presentationHidden) continue;
      if (tracks.position) object.position.fromArray(sampleLinear(tracks.position, 3, span, values));
      if (tracks.quaternion) object.quaternion.fromArray(sampleQuaternion(tracks.quaternion, span, values));
      if (tracks.scale) object.scale.fromArray(sampleLinear(tracks.scale, 3, span, values));
      if (tracks.visible) {
        const frame = Math.round(clampProgress(progress) * (count - 1));
        object.visible = tracks.visible.array[tracks.visible.frameMap ? tracks.visible.frameMap[frame] : frame] >= 0.5;
      }
      if (tracks.deformationPosition && object.visible) {
        const attribute = object.geometry.attributes.position;
        sampleLinear(tracks.deformationPosition, attribute.array.length, span, attribute.array);
        attribute.needsUpdate = true;
      }
      if (tracks.deformationNormal && object.visible) {
        const attribute = object.geometry.attributes.normal;
        sampleLinear(tracks.deformationNormal, attribute.array.length, span, attribute.array);
        attribute.needsUpdate = true;
      } else if (tracks.deformationPosition && object.visible) object.geometry.computeVertexNormals();
      for (const name of ['attributeOpacity', 'attributeRoughness']) {
        if (tracks[name] && object.visible && object.geometry.attributes[name]) {
          const attribute = object.geometry.attributes[name];
          sampleLinear(tracks[name], attribute.array.length, span, attribute.array);
          attribute.needsUpdate = true;
        }
      }
      // Animation envelopes are larger than the original component bounds.
      // Culling is disabled for animated parts; do not scan every vertex to
      // rebuild the bounding sphere during each scrub or playback frame.
      if (tracks.deformationPosition || tracks.position || tracks.scale) object.frustumCulled = false;
      object.updateMatrix();
    }
    for (const { material, tracks } of materialTracks) {
      if (!material) continue;
      if (tracks.baseColor) {
        sampleLinear(tracks.baseColor, 4, span, values);
        material.color.setRGB(values[0], values[1], values[2]);
        material.opacity = values[3];
      }
      if (tracks.color) {
        sampleLinear(tracks.color, 3, span, values);
        material.color.setRGB(values[0], values[1], values[2]);
      }
      if (tracks.emissive) {
        sampleLinear(tracks.emissive, 3, span, values);
        material.emissive.setRGB(values[0], values[1], values[2]);
      }
      for (const name of ['opacity', 'roughness', 'metalness', 'emissiveIntensity']) {
        if (tracks[name]) material[name] = sampleLinear(tracks[name], 1, span, values)[0];
      }
      for (const [name, uniform] of Object.entries(material.userData?.motionUniforms || {})) {
        if (tracks[name]) uniform.value = sampleLinear(tracks[name], 1, span, values)[0];
      }
    }
    return clampProgress(progress);
  }

  return { seek, duration: Math.max(0.1, Number(manifest.duration) || 8) };
}
