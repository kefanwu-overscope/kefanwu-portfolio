/* Standalone case pages: ordinary URLs and links preserve native navigation.
   No homepage or studio state is mutated. */
(async () => {
  'use strict';

  const root = document.getElementById('case-main');
  const projects = window.projectData;
  const editorials = window.caseStudyData;
  const key = new URLSearchParams(location.search).get('project') ?? 'steering';
  const has = (value, name) => value && Object.prototype.hasOwnProperty.call(value, name);
  const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const availableKeys = Object.keys(editorials || {}).filter((name) => has(projects, name));

  if (!has(editorials, key) || !has(projects, key)) {
    document.title = 'Choose a case study — Kefan Wu';
    document.getElementById('loading-message').textContent =
      has(editorials, key) ? 'This case study could not load. Please reload or browse selected work.' :
        'Choose a project below.';
    const options = root.querySelector('.case-options');
    if (options && availableKeys.length) options.innerHTML = availableKeys.map((name) =>
      `<a href="case-study.html?project=${encodeURIComponent(name)}">${escape(projects[name].title)} →</a>`).join('');
    return;
  }

  const project = projects[key];
  const editorial = editorials[key];
  const supplement = window.caseStudySupplements?.[key] || {};
  const gallery = [...(project.gallery || []), ...(supplement.gallery || [])];
  const images = gallery;
  const media = window.caseStudyMedia || {};
  const sourceIdentity = (image) => new URL(image.src, document.baseURI).pathname;
  const usedSources = new Set();
  // Keep the original gallery indexes for zoom navigation, but publish each
  // source only once in the story and the remaining-image archive.
  const chapters = editorial.chapters.map((originalChapter) => {
    const replacement = supplement.chapterImages?.[originalChapter.id];
    const addedIndex = replacement ? gallery.findIndex((image) => image.src === replacement.src) : -1;
    const chapter = addedIndex >= 0 ? { ...originalChapter, ...replacement, image: addedIndex } : originalChapter;
    const image = Number.isInteger(chapter.image) && gallery[chapter.image];
    const identity = image && sourceIdentity(image);
    const imageIndex = image && !usedSources.has(identity) ? chapter.image : null;
    if (imageIndex !== null) usedSources.add(identity);
    return { ...chapter, image: imageIndex };
  });
  const archive = gallery.map((image, index) => ({ image, index })).filter(({ image }) => {
    const identity = sourceIdentity(image);
    if (usedSources.has(identity)) return false;
    usedSources.add(identity);
    return true;
  });
  const number = (value) => String(value).padStart(2, '0');
  const imageCount = (count) => `${count} image${count === 1 ? '' : 's'}`;
  const nextKey = has(editorials, editorial.next) && has(projects, editorial.next) ? editorial.next
    : availableKeys[(availableKeys.indexOf(key) + 1) % availableKeys.length];
  const next = editorials[nextKey];
  const studioURL = project.noStudio ? 'experience.html' : `experience.html#${encodeURIComponent(key)}`;
  document.title = `${project.title} — Kefan Wu`;
  document.querySelector('meta[name="description"]').content =
    `${editorial.deck} ${editorial.summary.map((item) => item[1]).join(' ')}`;
  document.body.dataset.project = key;

  async function resolveCover() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch('assets/editorial/animation-covers.json?v=neutral-20260915', { signal: controller.signal, cache: 'force-cache' });
      if (!response.ok) throw new Error('Cover catalog unavailable');
      const catalog = await response.json();
      const cover = catalog.version === 1 && catalog.projects?.[key];
      if (!cover || !cover.src || new URL(cover.src, document.baseURI).origin !== location.origin) throw new Error('Invalid cover');
      return { ...editorial.cover, ...cover };
    } catch { return editorial.cover; }
    finally { clearTimeout(timeout); }
  }
  const cover = await resolveCover();

  function presentation(image) {
    const entry = supplement.media?.[image.src] || media[image.src] || {};
    const kind = ['photo', 'cad', 'plot', 'diagram', 'document'].includes(entry.kind) ? entry.kind : 'photo';
    const width = Number.isInteger(entry.width) && entry.width > 0 ? entry.width : null;
    const height = Number.isInteger(entry.height) && entry.height > 0 ? entry.height : null;
    return { ...entry, kind, width, height, src: entry.src || image.src, alt: entry.alt || image.alt };
  }

  function mediaClass(image) {
    const view = presentation(image);
    return `media-${view.kind}${view.kind === 'photo' && view.width && view.width < view.height ? ' media-portrait' : ''}${view.surface === 'dark' ? ' media-dark' : view.surface === 'light' ? ' media-light' : ''}`;
  }

  function imageButton(image, index) {
    if (!image) return '';
    const view = presentation(image);
    const source = view.src !== image.src ? view.src : image.thumbnail || image.src;
    return `<button type="button" class="image-open ${mediaClass(image)}" data-image="${index}" aria-label="Open image: ${escape(image.caption || image.alt)}">
      <img src="${escape(source)}" alt="${escape(view.alt)}"${view.width && view.height ? ` width="${view.width}" height="${view.height}"` : ''} loading="lazy" decoding="async">
      <span class="image-affordance" aria-hidden="true">+</span>
    </button>`;
  }

  function mediaStyle(image) {
    const { width, height } = presentation(image);
    return width && height ? ` style="--media-ratio:${width / height}"` : '';
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

  function downloadLinks() {
    const downloads = [...(project.downloads || []), ...(editorial.downloads || [])];
    return downloads.length ? `<div class="project-downloads"><h3>Project files</h3>${downloads.map((download) =>
      `<a class="text-link" href="${escape(download.href)}" download>${escape(download.label)} <span aria-hidden="true">↓</span></a>`).join('')}</div>` : '';
  }

  function documentedDetails() {
    return (supplement.sections || []).map((section) => `<details class="documented-detail" id="${escape(section.id)}">
      <summary>${escape(section.title)}</summary>
      <div class="source-detail-body"><dl class="documented-specs">${section.items.map((item) =>
        `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl></div>
    </details>`).join('');
  }

  function billOfMaterials() {
    const bom = supplement.bom;
    if (!bom?.rows?.length) return '';
    return `<section class="bom-section wrap" id="bom" aria-labelledby="bom-title">
      <div class="section-heading"><div><p class="eyebrow">Components & procurement</p><h2 id="bom-title">Bill of materials.</h2></div><p>${escape(bom.dateLabel)}</p></div>
      <p class="record-intro">${escape(bom.description)}</p>
      <details class="bom-details"><summary>View all ${bom.rows.length} line items <span aria-hidden="true">+</span></summary>
        <div class="bom-table-wrap" role="region" aria-label="Javelin bill of materials" tabindex="0"><table class="bom-table">
          <caption>${escape(bom.caption)}</caption><thead><tr><th scope="col">Item</th><th scope="col">Component / specification</th><th scope="col">Qty.</th><th scope="col">Order record</th></tr></thead>
          <tbody>${bom.rows.map((row, index) => `<tr><th scope="row">${number(index + 1)}</th><td><strong>${escape(row.component)}</strong>${row.note ? `<span>${escape(row.note)}</span>` : ''}</td><td>${escape(row.quantity)}</td><td>${escape(row.status)}</td></tr>`).join('')}</tbody>
        </table></div>
      </details>
    </section>`;
  }

  root.innerHTML = `<article>
    <section class="case-hero wrap" aria-labelledby="case-title">
      <p class="hero-kicker eyebrow"><span class="case-number">Case ${escape(editorial.number)} / ${number(availableKeys.length)}</span><span>${escape(editorial.label)}</span></p>
      <div class="hero-heading">
        <h1 id="case-title">${escape(editorial.title)}</h1>
        <div class="hero-deck"><h2>${escape(editorial.deck)}</h2><p>${escape(editorial.description)}</p></div>
      </div>
      <dl class="case-summary" aria-label="Case study in 30 seconds">${editorial.summary.map(([label, text]) => `<div><dt>${escape(label)}</dt><dd>${escape(text)}</dd></div>`).join('')}</dl>
      <div class="case-preview-layout" id="motion">
        <figure class="case-preview-figure">
          <div class="case-animation-host" data-project="${escape(key)}" data-preview-title="${escape(project.title)}" data-preview-instructions="preview-instructions" role="group" aria-labelledby="preview-title">
            <div class="card-media"><img src="${escape(cover.src)}"${cover.srcset ? ` srcset="${escape(cover.srcset)}" sizes="(max-width: 700px) calc(100vw - 44px), (max-width: 1000px) calc(100vw - 112px), 640px"` : ''} alt="${escape(cover.alt || project.title)}" width="${cover.width || 1800}" height="${cover.height || 1200}" loading="eager" decoding="async" fetchpriority="high"></div>
          </div>
          <figcaption class="cover-caption"><span>${escape(cover.caption || 'Explore the project model and its motion.')}</span><span class="eyebrow">Interactive project model</span></figcaption>
        </figure>
        <div class="preview-introduction"><p class="eyebrow">Explore the motion</p><h2 id="preview-title">Take a closer look.</h2><p id="preview-instructions">Scroll over the model to move through the animation. Scroll back to reverse. On a touch screen, drag the slider; with a keyboard, focus it and use the arrow keys.</p><div class="preview-links"><a class="text-link" href="${studioURL}">${project.noStudio ? 'Explore the' : 'View in'} 3D Studio <span aria-hidden="true">↗</span></a><a class="text-link" href="#evidence">Project images <span aria-hidden="true">↓</span></a></div></div>
      </div>
    </section>
    <nav class="chapter-nav" aria-label="Case study sections"><div class="chapter-nav-inner wrap">
      <a href="#motion">Motion</a>${editorial.chapters.map((chapter, index) => `<a href="#${escape(chapter.id)}"><span class="mono">${number(index + 1)}</span>${escape(chapter.label)}</a>`).join('')}
      <a href="#evidence">Image archive</a>${supplement.bom ? '<a href="#bom">BOM</a>' : ''}<a href="#record">Technical record</a>
    </div></nav>
    <div class="wrap">${chapters.map((chapter, index) => `<section class="chapter${chapter.image !== null ? '' : ' chapter-text-only'}" id="${escape(chapter.id)}" aria-labelledby="${escape(chapter.id)}-title">
      <div class="chapter-copy"><p class="eyebrow">${number(index + 1)} / ${escape(chapter.label)}</p><h2 id="${escape(chapter.id)}-title">${escape(chapter.title)}</h2>${chapter.paragraphs.map((text) => `<p>${escape(text)}</p>`).join('')}</div>
      ${chapter.image !== null ? `<figure class="chapter-figure ${mediaClass(gallery[chapter.image])}"${mediaStyle(gallery[chapter.image])}>${imageButton(gallery[chapter.image], chapter.image)}<figcaption><span class="evidence-type">${escape(chapter.evidence)}</span>${escape(chapter.note)}</figcaption></figure>` : ''}
    </section>`).join('')}</div>
    <section class="evidence-section wrap" id="evidence" aria-labelledby="evidence-title">
      <div class="section-heading"><div><p class="eyebrow">The project images</p><h2 id="evidence-title">A closer look.</h2></div><p>${archive.length ? `${archive.length} more image${archive.length === 1 ? '' : 's'}. Open any to browse all ${gallery.length}.` : `${gallery.length === 1 ? 'The project image appears' : `All ${gallery.length} project images appear`} in the chapters above. Open any to browse the complete set.`}</p></div>
      ${archive.length ? `<div class="gallery-grid">${archive.map(({ image, index }) => `<figure class="gallery-item ${mediaClass(image)}"${mediaStyle(image)}>${imageButton(image, index)}<figcaption><span class="mono">${number(index + 1)}</span><span>${escape(image.caption || image.alt)}</span></figcaption></figure>`).join('')}</div>` : gallery.length ? `<button type="button" class="text-link gallery-browse" data-image="0">Browse ${gallery.length === 1 ? 'the image' : `all ${imageCount(gallery.length)}`} <span aria-hidden="true">↗</span></button>` : ''}
    </section>
    ${billOfMaterials()}
    <section class="record-section wrap" id="record" aria-labelledby="record-title">
      <div class="section-heading"><div><p class="eyebrow">For the technical conversation</p><h2 id="record-title">The engineering record.</h2></div></div>
      <p class="record-intro">Original project notes, methods, and results.${editorial.recordNote ? ` ${escape(editorial.recordNote)}` : ''}</p>
      <div class="record-layout"><aside aria-label="Project tools and context"><h3>Tools & methods</h3><ul class="tool-list">${(project.tools || []).map((tool) => `<li>${escape(tool)}</li>`).join('')}</ul>${sourceSpec()}${downloadLinks()}</aside>
        <div class="source-details">${documentedDetails()}<details><summary>Project overview & highlights</summary><div class="source-detail-body"><p>${escape(project.summary)}</p><ul>${(project.highlights || []).map((item) => `<li>${escape(item)}</li>`).join('')}</ul></div></details>${originalDetails()}</div>
      </div>
    </section>
    <section class="next-section" aria-label="Continue exploring"><div class="next-inner wrap">
      <a class="next-link" href="case-study.html?project=${encodeURIComponent(nextKey)}"><span class="eyebrow">Next case / ${escape(next.number)}</span><span class="next-title">${escape(next.title)}<span aria-hidden="true">↗</span></span></a>
      <div class="studio-invitation"><h3>Explore the hardware.</h3><p>${project.noStudio ? 'Browse more projects in the interactive engineering studio.' : 'Find this project in the interactive engineering studio.'}</p><a class="text-link" href="${studioURL}">${project.noStudio ? 'Explore the' : 'View in'} 3D Studio <span aria-hidden="true">↗</span></a></div>
    </div></section>
  </article>`;
  window.dispatchEvent(new Event('project-previews-ready'));

  // Failed assets retain a readable caption and a working original-image link.
  root.addEventListener('error', (event) => {
    if (!(event.target instanceof HTMLImageElement)) return;
    if (event.target.closest('.case-animation-host')) return;
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
    const view = presentation(item);
    const img = new Image();
    img.alt = view.alt;
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
    stage.dataset.mediaKind = view.kind;
    stage.dataset.mediaSurface = view.surface || (view.kind === 'photo' ? 'dark' : 'light');
    stage.replaceChildren(img);
    img.src = view.src;
    document.getElementById('lightbox-title').textContent = item.caption || item.alt;
    document.getElementById('lightbox-counter').textContent = `${number(imageIndex + 1)} / ${number(images.length)}`;
    const original = document.getElementById('lightbox-original');
    original.href = item.src;
    original.innerHTML = `${escape(view.originalLabel || 'Original')} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span>`;
  }

  root.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-image]');
    if (!trigger) return;
    const index = Number(trigger.dataset.image);
    if (!images[index]) return;
    if (typeof dialog.showModal !== 'function') {
      location.href = presentation(images[index]).src;
      return;
    }
    opener = trigger;
    showImage(index);
    document.body.classList.add('lightbox-open');
    window.cardExplosions?.resetAll(true);
    dialog.showModal();
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
