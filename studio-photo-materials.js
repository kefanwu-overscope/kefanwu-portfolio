// Photo review: tools/studio-tests/photo-material-review.md. Hex colors are
// sRGB; exported source colors remain linear. Geometry and motion are retained.
export const photoFinishes = {
  vineRobot: {
    'Royal blue printed components': { color: '#0b2389', roughness: .49 },
    'Translucent pale blue thin polymer film': { color: '#252a30', roughness: .32, transmission: .28, opacity: .88, metalness: 0 },
  },
  materialTest: {
    'Visible warm orange tensile fabric': { color: '#252628', roughness: .65, metalness: 0, grain: ['#202123', '#303133'] },
  },
  scanner: { 'Royal blue printed components': { color: '#0b2389', roughness: .49 } },
  javelin: { 'aero.001': { color: '#171819', roughness: .43 } },
  telecaster: {
    paint_white: { roughness: .26, clearcoat: .35, clearcoatRoughness: .2 },
    pickguard_red: { roughness: .28, clearcoat: .4, clearcoatRoughness: .18 },
  },
  education: { printed_navy: { color: '#10172b', roughness: .56, metalness: 0 } },
};

// The scanner's ventilated power-supply enclosure was grouped with its blue
// print material in CAD. Keep the brackets blue and restore only that housing.
export function applyPhotoPart(key, name, material) {
  if (key !== 'scanner' || name !== 'mat_printed_part_4') return material;
  const copy = material.clone();
  copy.name = 'Scanner satin metal power-supply enclosure';
  copy.color.set('#777b7e'); copy.metalness = .85; copy.roughness = .38;
  copy.userData.motionUniforms = {};
  return copy;
}

export function applyPhotoFinish(key, material, source) {
  const finish = photoFinishes[key]?.[source.name];
  if (!finish) return source;
  if (finish.color) material.color.set(finish.color);
  for (const property of ['roughness', 'metalness', 'transmission', 'opacity', 'clearcoat', 'clearcoatRoughness']) {
    if (finish[property] !== undefined) material[property] = finish[property];
  }
  if (finish.opacity !== undefined) { material.transparent = finish.opacity < 1; material.depthWrite = finish.opacity >= 1; }
  let procedural = source.procedural;
  if (finish.grain && procedural?.ramp) procedural = { ...procedural, ramp: procedural.ramp.map((stop, index) => ({
    ...stop, color: [...material.color.clone().set(finish.grain[Math.min(index, finish.grain.length - 1)]).toArray(), 1],
  })) };
  return { ...source, procedural, photoFinish: true,
    ...(finish.opacity !== undefined ? { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite } : {}),
  };
}
