/* Standalone case pages: ordinary URLs and links preserve native navigation.
   No homepage or studio state is mutated. */
(() => {
  'use strict';

  const root = document.getElementById('case-main');
  const projects = window.projectData;
  const editorials = window.caseStudyData;
  const key = new URLSearchParams(location.search).get('project') ?? 'steering';
  const has = (value, name) => value && Object.prototype.hasOwnProperty.call(value, name);
  const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  if (!has(editorials, key) || !has(projects, key)) {
    document.title = 'Choose a case study — Kefan Wu';
    document.getElementById('loading-message').textContent =
      has(editorials, key) ? 'This case study could not load. Please reload or browse selected work.' :
        'Choose a flagship case study below.';
    return;
  }

  const project = projects[key];
  const editorial = editorials[key];
  const gallery = project.gallery || [];
  const images = [editorial.cover, ...gallery];
  const number = (value) => String(value).padStart(2, '0');
  const next = editorials[editorial.next];
  document.title = `${project.title} — Kefan Wu`;
  document.querySelector('meta[name="description"]').content =
    `${editorial.deck} ${editorial.summary.map((item) => item[1]).join(' ')}`;
  document.body.dataset.project = key;

  function imageButton(image, index, { cover = false } = {}) {
    // Existing WebP originals are already small (14–117 KB for these galleries).
    // Honor shared thumbnails when provided; full sources only enter the lightbox.
    const source = cover ? image.src : (image.thumbnail || image.src);
    const img = `<img src="${escape(source)}" alt="${escape(image.alt)}" loading="${cover ? 'eager' : 'lazy'}" decoding="async"${cover ? ' fetchpriority="high"' : ''}>`;
    return `<button type="button" class="image-open${cover ? ' cover-button' : ''}${image.surface === 'light' ? ' surface-light' : ''}" data-image="${index}" aria-label="Open image: ${escape(image.caption || image.alt)}">
      ${cover && image.portrait ? `<picture><source media="(max-width: 700px)" srcset="${escape(image.portrait)}">${img}</picture>` : img}
      <span class="image-affordance" aria-hidden="true">+</span>
    </button>`;
  }

  function originalDetails() {
    return (project.details || []).map((detail) => `<details>
      <summary>${escape(detail.title)}</summary>
      <div class="source-detail-body"><ul>${(detail.points || []).map((point) => `<li>${escape(point)}</li>`).join('')}</ul></div>
    </details>`).join('');
  }

  function sourceSpec() {
    if (!project.spec) return '';
    const meta = (project.spec.meta || []).map(([label, value]) => [label, value]);
    const stats = (project.spec.stats || []).map(([value, label]) => [label, value]);
    return `<dl class="source-spec">${[...meta, ...stats].map(([label, value]) => `<div><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>`).join('')}</dl>`;
  }

  root.innerHTML = `<article>
    <section class="case-hero wrap" aria-labelledby="case-title">
      <p class="hero-kicker eyebrow"><span class="case-number">Case ${editorial.number} / 03</span><span>${escape(editorial.label)}</span></p>
      <div class="hero-heading">
        <h1 id="case-title">${escape(editorial.title)}</h1>
        <div class="hero-deck"><h2>${escape(editorial.deck)}</h2><p>${escape(editorial.description)}</p></div>
      </div>
      <dl class="case-summary" aria-label="Case study in 30 seconds">${editorial.summary.map(([label, text]) => `<div><dt>${escape(label)}</dt><dd>${escape(text)}</dd></div>`).join('')}</dl>
      <figure>${imageButton(editorial.cover, 0, { cover: true })}
        <figcaption class="cover-caption"><span>${escape(editorial.cover.caption)}</span><span class="eyebrow">${escape(editorial.cover.kind)}</span></figcaption>
      </figure>
    </section>
    <nav class="chapter-nav" aria-label="Case study sections"><div class="chapter-nav-inner wrap">
      ${editorial.chapters.map((chapter, index) => `<a href="#${chapter.id}"><span class="mono">${number(index + 1)}</span>${escape(chapter.label)}</a>`).join('')}
      <a href="#evidence">Image archive</a><a href="#record">Technical record</a>
    </div></nav>
    <div class="wrap">${editorial.chapters.map((chapter, index) => `<section class="chapter" id="${chapter.id}" aria-labelledby="${chapter.id}-title">
      <div class="chapter-copy"><p class="eyebrow">${number(index + 1)} / ${escape(chapter.label)}</p><h2 id="${chapter.id}-title">${escape(chapter.title)}</h2>${chapter.paragraphs.map((text) => `<p>${escape(text)}</p>`).join('')}</div>
      <figure class="chapter-figure">${imageButton(gallery[chapter.image], chapter.image + 1)}<figcaption><span class="evidence-type">${escape(chapter.evidence)}</span>${escape(chapter.note)}</figcaption></figure>
    </section>`).join('')}</div>
    <section class="evidence-section wrap" id="evidence" aria-labelledby="evidence-title">
      <div class="section-heading"><div><p class="eyebrow">The original project images</p><h2 id="evidence-title">A closer look.</h2></div><p>${gallery.length} images. Open any image to inspect the original.</p></div>
      <div class="gallery-grid">${gallery.map((image, index) => `<figure class="gallery-item">${imageButton(image, index + 1)}<figcaption><span class="mono">${number(index + 1)}</span><span>${escape(image.caption || image.alt)}</span></figcaption></figure>`).join('')}</div>
    </section>
    <section class="record-section wrap" id="record" aria-labelledby="record-title">
      <div class="section-heading"><div><p class="eyebrow">For the technical conversation</p><h2 id="record-title">The engineering record.</h2></div></div>
      <p class="record-intro">Original project notes, methods, and results.${editorial.recordNote ? ` ${escape(editorial.recordNote)}` : ''}</p>
      <div class="record-layout"><aside aria-label="Project tools and context"><h3>Tools & methods</h3><ul class="tool-list">${(project.tools || []).map((tool) => `<li>${escape(tool)}</li>`).join('')}</ul>${sourceSpec()}</aside>
        <div class="source-details"><details><summary>Project overview & highlights</summary><div class="source-detail-body"><p>${escape(project.summary)}</p><ul>${(project.highlights || []).map((item) => `<li>${escape(item)}</li>`).join('')}</ul></div></details>${originalDetails()}</div>
      </div>
    </section>
    <section class="next-section" aria-label="Continue exploring"><div class="next-inner wrap">
      <a class="next-link" href="case-study.html?project=${editorial.next}"><span class="eyebrow">Next case / ${next.number}</span><span class="next-title">${escape(next.title)}<span aria-hidden="true">↗</span></span></a>
      <div class="studio-invitation"><h3>Explore the hardware.</h3><p>Find this project in the interactive engineering studio.</p><a class="text-link" href="experience.html#${key}">View in 3D Studio <span aria-hidden="true">↗</span></a></div>
    </div></section>
  </article>`;

  // Failed assets retain a readable caption and a working original-image link.
  root.addEventListener('error', (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    const fallback = document.createElement('span');
    fallback.className = 'image-unavailable';
    fallback.textContent = 'Image preview unavailable. Open original.';
    event.target.replaceWith(fallback);
  }, true);

  const dialog = document.getElementById('case-lightbox');
  const stage = document.getElementById('lightbox-stage');
  const closeButton = document.getElementById('lightbox-close');
  let imageIndex = 0;
  let opener = null;

  function showImage(index) {
    imageIndex = (index + images.length) % images.length;
    const item = images[imageIndex];
    const img = new Image();
    img.alt = item.alt;
    img.decoding = 'async';
    // Replacing the element prevents a late load from a previous selection
    // painting the wrong source under the new caption during rapid navigation.
    img.addEventListener('error', () => {
      if (!img.isConnected) return;
      const text = document.createElement('p');
      text.className = 'image-unavailable';
      text.textContent = 'This image could not load. Try the original link below.';
      img.replaceWith(text);
    });
    stage.replaceChildren(img);
    img.src = item.src;
    document.getElementById('lightbox-title').textContent = item.caption || item.alt;
    document.getElementById('lightbox-counter').textContent = `${number(imageIndex + 1)} / ${number(images.length)}`;
    document.getElementById('lightbox-original').href = item.src;
  }

  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-image]');
    if (!trigger) return;
    const index = Number(trigger.dataset.image);
    if (!images[index]) return;
    if (typeof dialog.showModal !== 'function') {
      location.href = images[index].src;
      return;
    }
    opener = trigger;
    showImage(index);
    dialog.showModal();
    document.body.classList.add('lightbox-open');
    closeButton.focus({ preventScroll: true });
  });

  closeButton.addEventListener('click', () => dialog.close());
  document.getElementById('lightbox-prev').addEventListener('click', () => showImage(imageIndex - 1));
  document.getElementById('lightbox-next').addEventListener('click', () => showImage(imageIndex + 1));
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      const controls = [...dialog.querySelectorAll('button:not([disabled]), a[href]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = { ArrowLeft: imageIndex - 1, ArrowRight: imageIndex + 1, Home: 0, End: images.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    showImage(target);
  });
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('lightbox-open');
    stage.replaceChildren();
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });

  // No continuous animation loop. The observer only updates section navigation.
  if ('IntersectionObserver' in window) {
    const sectionLinks = [...document.querySelectorAll('.chapter-nav a')];
    const visibleSections = new Set();
    const sections = sectionLinks.map((link) => document.getElementById(link.hash.slice(1)));
    let observer;
    const configure = () => {
      observer?.disconnect();
      visibleSections.clear();
      const marker = Math.round(innerHeight * .4);
      observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.isIntersecting ? visibleSections.add(entry.target) : visibleSections.delete(entry.target));
      const current = sections.find((section) => visibleSections.has(section));
      sectionLinks.forEach((link) => {
        if (current && link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
      }, { rootMargin: `-${marker}px 0px -${Math.max(0, innerHeight - marker - 2)}px 0px`, threshold: 0 });
      sections.forEach((section) => observer.observe(section));
    };
    let resizeFrame = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(configure);
    });
    configure();
  }

  // Dynamic content must honor a shared chapter URL after the sections exist.
  const hashTarget = document.getElementById(location.hash.slice(1));
  if (hashTarget && root.contains(hashTarget)) {
    requestAnimationFrame(() => hashTarget.scrollIntoView({ behavior: 'instant' }));
  }
})();
