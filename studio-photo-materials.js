// Photo review: tools/studio-tests/photo-material-review.md. Hex colors are
// sRGB; exported source colors remain linear. Geometry and motion are retained.
// Surface detail is a restrained visual finish, not a measured roughness scan.
// Coordinates are source-local, so the finish follows each moving component.
const PRINT_SURFACE = Object.freeze({ scale: 160, bumpStrength: .1, bumpDistance: .0006, roughnessVariation: .045 });
const SATIN_METAL = Object.freeze({ scale: 240, bumpStrength: .06, bumpDistance: .0002, roughnessVariation: .025 });

export const photoFinishes = {
  vineRobot: {
    'Royal blue printed components': { color: '#0b2389', roughness: .49, surface: PRINT_SURFACE },
    'Cream white polymer structure': { surface: PRINT_SURFACE },
    'Satin machined steel': { surface: SATIN_METAL },
    'Translucent pale blue thin polymer film': { color: '#252a30', roughness: .32, transmission: .28, opacity: .88, metalness: 0 },
  },
  materialTest: {
    'Visible warm orange tensile fabric': { color: '#252628', roughness: .65, metalness: 0, grain: ['#202123', '#303133'] },
  },
  scanner: {
    'Royal blue printed components': { color: '#0b2389', roughness: .49, surface: PRINT_SURFACE },
    'Satin machined steel': { surface: SATIN_METAL },
  },
  steering: {
    'Satin machined steel': { surface: SATIN_METAL },
    'Dark carbon steering wheel - supported by original CAD cover': {
      weave: { type: 'steering-weave', coordinateSpace: 'object', scale: 120,
        faceNormal: [0, .9781476, .2079116], faceUp: [0, -.2079116, .9781476], facePlanes: [1.680, 1.722] },
    },
  },
  javelin: { 'aero.001': { color: '#171819', roughness: .43 } },
  telecaster: {
    paint_white: { roughness: .26, clearcoat: .35, clearcoatRoughness: .2,
      surface: { scale: 260, bumpStrength: .025, bumpDistance: .00012, roughnessVariation: .014 } },
    // Pattern lies below a smooth finish in the photograph; its exported
    // source bump is deliberately reduced while the red ramp stays intact.
    pickguard_red: { roughness: .28, clearcoat: .4, clearcoatRoughness: .18,
      surface: { bumpScale: .2, roughnessVariation: .025 } },
  },
  education: { printed_navy: { color: '#10172b', roughness: .56, metalness: 0 } },
  formlabs: {
    steel: { surface: SATIN_METAL },
    amber_resin: { clearcoat: .14, clearcoatRoughness: .22 },
  },
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
  if (finish.weave) procedural = finish.weave;
  if (finish.grain && procedural?.ramp) procedural = { ...procedural, ramp: procedural.ramp.map((stop, index) => ({
    ...stop, color: [...material.color.clone().set(finish.grain[Math.min(index, finish.grain.length - 1)]).toArray(), 1],
  })) };
  return { ...source, procedural, photoFinish: true,
    ...(finish.surface ? { surfaceDetail: finish.surface } : {}),
    ...(finish.opacity !== undefined ? { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite } : {}),
  };
}
