/* One ordinary-scroll narrative; no permanent animation loop or WebGL on the homepage. */
(() => {
  const steps = [...document.querySelectorAll('[data-story-step]')];
  const images = [...document.querySelectorAll('[data-story-image]')];
  const caption = document.querySelector('.story-caption');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = window.matchMedia('(min-width: 721px)');
  const titles = ['01 / Design the motion', '02 / Check the load path', '03 / Close the loop'];
  let active = 0;
  let observer;
  const configure = () => {
    observer?.disconnect();
    if (motion.matches || !desktop.matches) return;
    // IO percentages resolve against root WIDTH. Pixel margins keep a real
    // center band even on wide, short displays.
    observer = new IntersectionObserver(entries => {
    const visible = entries.filter(entry => entry.isIntersecting);
    if (!visible.length) return;
    const next = Number(visible[visible.length - 1].target.dataset.storyStep);
    if (next === active) return;
    active = next;
    images.forEach((image, index) => image.classList.toggle('is-active', index === next));
    if (caption) caption.textContent = titles[next];
    }, { rootMargin: `-${Math.round(innerHeight * .4)}px 0px -${Math.round(innerHeight * .45)}px 0px`, threshold: 0 });
    steps.forEach(step => observer.observe(step));
  };
  let resizeFrame = 0;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(configure);
  });
  motion.addEventListener('change', configure);
  desktop.addEventListener('change', configure);
  configure();
})();
