// Absolute sampled poses: every seek reads source samples; no delta transform
// is applied to the previous pose. Camera controls never enter this module.
export const clampProgress = (value) => Math.min(1, Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0));

const COMPONENTS = { float32: Float32Array, uint32: Uint32Array, uint16: Uint16Array, uint8: Uint8Array };
const bufferViews = new WeakMap();
const elementOffsets = new WeakMap();

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
  let views = bufferViews.get(buffer);
  if (!views) bufferViews.set(buffer, views = new Map());
  const key = `${Type.name}:${offset}:${length}:${itemSize}:${descriptor.predictor || ''}:${descriptor.byteOrder || ''}:${JSON.stringify(descriptor.decode || null)}`;
  if (views.has(key)) return views.get(key);
  let raw = new Type(buffer, offset, length);
  if (descriptor.byteOrder) {
    if (descriptor.byteOrder !== 'planar' || Type === Float32Array) throw new Error('Unsupported model buffer byte order.');
    const bytes = new Uint8Array(buffer, offset, length * Type.BYTES_PER_ELEMENT);
    raw = new Type(length);
    if (Type.BYTES_PER_ELEMENT === 2) {
      for (let i = 0; i < length; i++) raw[i] = bytes[i] | bytes[length + i] << 8;
    } else if (Type.BYTES_PER_ELEMENT === 4) {
      for (let i = 0; i < length; i++) raw[i] = bytes[i] | bytes[length + i] << 8 | bytes[2 * length + i] << 16 | bytes[3 * length + i] << 24;
    } else raw.set(bytes);
  }
  if (descriptor.predictor) {
    if (descriptor.predictor !== 'delta-component' || Type === Float32Array) throw new Error('Unsupported model buffer predictor.');
    if (!descriptor.byteOrder) raw = raw.slice();
    // Unsigned typed-array assignment restores wraparound exactly for 8/16/32
    // bit integer streams, including index buffers with decreasing values.
    for (let i = itemSize; i < length; i++) raw[i] += raw[i - itemSize];
  }
  let array = raw;
  if (descriptor.decode) {
    const { offset: base, scale } = descriptor.decode;
    if (base?.length !== itemSize || scale?.length !== itemSize || ![...base, ...scale].every(Number.isFinite)) {
      throw new Error('Invalid model quantization range.');
    }
    array = new Float32Array(length);
    for (let i = 0; i < length; i += itemSize) {
      for (let component = 0; component < itemSize; component++) array[i + component] = base[component] + raw[i + component] * scale[component];
    }
  }
  views.set(key, array);
  return array;
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
    let offsets = track.elementOffsets;
    if (!offsets) {
      let maps = elementOffsets.get(track.elementMap);
      if (!maps) elementOffsets.set(track.elementMap, maps = new Map());
      offsets = maps.get(components);
      if (!offsets) {
        offsets = Uint32Array.from(track.elementMap, (value) => value * components);
        maps.set(components, offsets);
      }
      track.elementOffsets = offsets;
    }
    const alpha = a === b ? 0 : span.alpha;
    if (components === 3) {
      for (let vertex = 0, i = 0; i < size; vertex++, i += 3) {
        const left = a + offsets[vertex], right = b + offsets[vertex];
        output[i] = array[left] + (array[right] - array[left]) * alpha;
        output[i + 1] = array[left + 1] + (array[right + 1] - array[left + 1]) * alpha;
        output[i + 2] = array[left + 2] + (array[right + 2] - array[left + 2]) * alpha;
      }
    } else {
      for (let vertex = 0, i = 0; i < size; vertex++) {
        const left = a + offsets[vertex], right = b + offsets[vertex];
        for (let component = 0; component < components; component++, i++) {
          output[i] = array[left + component] + (array[right + component] - array[left + component]) * alpha;
        }
      }
    }
  } else {
    if (a === b || span.alpha === 0) output.set(array.subarray(a, a + size));
    else for (let i = 0; i < size; i++) output[i] = array[a + i] + (array[b + i] - array[a + i]) * span.alpha;
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

export function createSampledMotion({ manifest, buffer, nodes, materials, initial = false }) {
  const count = initial ? 1 : manifest.sampleCount;
  if (!Number.isInteger(count) || count < 1) throw new Error('The model has no valid pose samples.');
  const seen = new Set();
  const trackField = initial ? 'initialTracks' : 'tracks';
  const nodeTracks = manifest.nodes.flatMap((source, index) => {
    const object = nodes[index];
    if (!object || seen.has(object) || object.userData?.presentationHidden || !Object.keys(source[trackField] || {}).length) return [];
    seen.add(object);
    const tracks = bindTracks(source[trackField], buffer);
    if (tracks.deformationPosition || tracks.position || tracks.scale) object.frustumCulled = false;
    return [{ object, tracks }];
  });
  const materialTracks = (manifest.materials || []).flatMap((source, index) => Object.keys(source[trackField] || {}).length ? [{ material: materials[index], tracks: bindTracks(source[trackField], buffer) }] : []);
  const values = new Float32Array(4);
  let lastProgress = null;

  function seek(progress) {
    progress = clampProgress(progress);
    if (progress === lastProgress) return progress;
    lastProgress = progress;
    const span = sampleSpan(progress, count);
    const visibleFrame = Math.round(progress * (count - 1));
    for (const { object, tracks } of nodeTracks) {
      if (!object || object.userData?.presentationHidden) continue;
      if (tracks.position) object.position.fromArray(sampleLinear(tracks.position, 3, span, values));
      if (tracks.quaternion) object.quaternion.fromArray(sampleQuaternion(tracks.quaternion, span, values));
      if (tracks.scale) object.scale.fromArray(sampleLinear(tracks.scale, 3, span, values));
      if (tracks.visible) {
        const frame = visibleFrame;
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
      if (tracks.position || tracks.quaternion || tracks.scale) object.updateMatrix();
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

  const buffers = new Set();
  for (const { tracks } of [...nodeTracks, ...materialTracks]) for (const track of Object.values(tracks)) {
    for (const array of [track.array, track.frameMap, track.elementMap]) if (array) buffers.add(array.buffer);
  }
  return { seek, buffers, duration: Math.max(0.1, Number(manifest.duration) || 8) };
}
