/* Presentation is derived from the same records as the portfolio and case pages.
   Only browse taxonomy, motion labels and selected source IDs live here. */
const presentation = {
  steering: ['motorsport analysis fabrication', 'Steering motion', ['steering-final-fastener', 'steering-rack-length', 'steering-rack-speed']],
  vineRobot: ['robotics analysis fabrication', 'Vine eversion', ['vineRobot-pressure-levels', 'vineRobot-load-levels']],
  javelin: ['robotics analysis fabrication', 'Flight motion', ['javelin-prop-use-cases', 'javelin-prop-study-assumptions']],
  scanner: ['robotics product fabrication', 'Gantry scan', ['SC-01', 'SC-06']],
  brakeSim: ['motorsport analysis', 'Illustrative heat cycle', ['brakeSim-final-rotor-diameter', 'brakeSim-time-integration']],
  aura: ['robotics product fabrication', 'Assembly sequence', ['aura-initial-payload', 'aura-tested-payload', 'aura-drive-model']],
  carbonSeat: ['motorsport product fabrication', 'Illustrative layup stages', ['carbonSeat-resin', 'carbonSeat-main-layup', 'carbonSeat-local-reinforcement']],
  seat: ['motorsport product fabrication', 'Sheet-metal folding', ['seat-vehicle', 'seat-responsibility']],
  materialTest: ['analysis', 'Illustrative tensile test', ['materialTest-load-transducer', 'materialTest-bamboo-diameter']],
  ansysCfd: ['analysis software', 'Computed flow paths', []],
  pool: ['robotics product fabrication', 'Load and release', ['pool-contribution', 'pool-rack-support']],
  lineFollower: ['robotics product fabrication', 'Drive and steer', ['lineFollower-best-recorded-lap', 'lineFollower-pitch-comparison', 'lineFollower-whole-robot-mass']],
  formlabs: ['robotics product', 'Gantry motion', ['formlabs-dispensing-architecture', 'formlabs-controller-link']],
  telecaster: ['fabrication product', 'Turntable rotation', ['telecaster-body-material', 'telecaster-pickups']],
  education: ['product fabrication', 'Guitar assembly', ['education-pickup-selection', 'education-reported-build-cost']],
  ftc: ['robotics fabrication', 'Assembly sequence', []]
};

export const studioCategories = [
  ['all', 'All'], ['motorsport', 'Motorsport'], ['robotics', 'Robotics'],
  ['product', 'Product'], ['analysis', 'Analysis'], ['fabrication', 'Fabrication']
].map(([key, label]) => ({ key, label }));

function makeProject(key, editorial, index) {
  const source = window.projectData[key];
  const supplement = window.caseStudySupplements?.[key] || {};
  const [categories = '', motionLabel = 'Motion progress', selectedIDs = []] = presentation[key] || [];
  const allFacts = (supplement.sections || []).flatMap((section) => section.items || []);
  const facts = selectedIDs.map((id) => allFacts.find((item) => item.id === id)).filter(Boolean);
  const summary = editorial.summary || [];
  const summaryValue = (label) => summary.find(([name]) => name.toLowerCase() === label)?.[1] || '';
  const gallery = [...(source.gallery || []), ...(supplement.gallery || [])].map((original, imageIndex) => {
    const media = supplement.media?.[original.src] || window.caseStudyMedia?.[original.src] || {};
    return {
      ...original, ...media, index: imageIndex, originalSrc: original.src,
      src: media.src || original.src, alt: media.alt || original.alt,
      kind: media.kind || 'photo', caption: original.caption || original.alt
    };
  });
  // Preserve the full source index, including supplemental images. Previews use
  // source identity so repeated chapter references never duplicate an image.
  const previewImages = [];
  const addImage = (image) => {
    if (image && previewImages.length < 3 && !previewImages.some((item) => item.originalSrc === image.originalSrc)) previewImages.push(image);
  };
  for (const image of supplement.gallery || []) addImage(gallery.find((item) => item.originalSrc === image.src));
  addImage(gallery.find((image) => image.kind === 'photo'));
  for (const chapter of editorial.chapters || []) {
    const replacement = supplement.chapterImages?.[chapter.id];
    addImage(replacement ? gallery.find((image) => image.originalSrc === replacement.src) : gallery[chapter.image]);
  }
  gallery.forEach(addImage);
  const storyURL = `case-study.html?project=${encodeURIComponent(key)}`;
  return {
    key, index, number: editorial.number || String(index + 1).padStart(2, '0'),
    name: source.title, title: source.title, label: editorial.label || source.kicker,
    categories: categories.split(' ').filter(Boolean), cover: editorial.cover,
    role: summary[0]?.[1] || '', roleLabel: summary[0]?.[0] || 'My role',
    result: summary[1]?.[1] || '', resultLabel: summary[1]?.[0] || 'Result',
    evidence: summaryValue('evidence'), description: editorial.description || source.summary,
    facts, summary, gallery, previewImages, storyURL,
    bomURL: supplement.bom ? `${storyURL}#bom` : null,
    motionLabel, source, editorial, supplement
  };
}

export const studioProjects = Object.entries(window.caseStudyData || {})
  .filter(([key]) => Object.prototype.hasOwnProperty.call(window.projectData || {}, key))
  .map(([key, editorial], index) => makeProject(key, editorial, index));
export const studioProjectMap = new Map(studioProjects.map((project) => [project.key, project]));
export const getStudioProject = (key) => studioProjectMap.get(key) || null;
