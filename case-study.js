/* Standalone case pages: ordinary URLs and links preserve native navigation.
   No homepage or studio state is mutated. */
(async () => {
  'use strict';

  const root = document.getElementById('case-main');
  const projects = window.projectData;
  const editorials = window.caseStudyData;
  const studioMode = document.body.dataset.caseMode === 'studio';
  const casePage = studioMode ? 'project-3d.html' : 'case-study.html';
  const queryKey = new URLSearchParams(location.search).get('project');
  let legacyKey = null;
  if (studioMode && queryKey === null && location.hash) {
    try { legacyKey = decodeURIComponent(location.hash.slice(1)); }
    catch { legacyKey = location.hash.slice(1); }
  }
  const key = queryKey ?? legacyKey ?? 'steering';
  // Only a page opened by the retained room carries its frame flag.
  const inStudioFrame = studioMode && window.parent !== window && new URLSearchParams(location.search).get('studioFrame') === '1';
  const has = (value, name) => value && Object.prototype.hasOwnProperty.call(value, name);
  const escape = (text) => String(text ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const availableKeys = Object.keys(editorials || {}).filter((name) => has(projects, name));

  // Deferred listeners (the studio bridge, the frame loader) register after
  // this script runs, so announce the rendered page once they all exist.
  function announceReady() {
    const announce = () => window.dispatchEvent(new Event('project-previews-ready'));
    const navigation = typeof performance === 'undefined' ? null : performance.getEntriesByType?.('navigation')[0];
    if (navigation && navigation.domContentLoadedEventStart === 0) document.addEventListener('DOMContentLoaded', announce, { once: true });
    else announce();
  }

  // Header and footer exits name where the reader came from: the retained
  // studio inside its frame, otherwise this project's card on the homepage.
  const homeURL = (name) => name ? `index.html#project-${encodeURIComponent(name)}` : 'index.html#work';
  function configureExits(name) {
    const back = document.querySelector('.site-header .nav-back');
    const footerBack = document.querySelector('.site-footer a');
    if (inStudioFrame) {
      if (back) {
        back.setAttribute('href', 'experience.html?return=project');
        back.innerHTML = '<span aria-hidden="true">←</span> <span class="nav-label"><span class="nav-label-prefix">Back to </span>studio</span>';
      }
      document.querySelectorAll('.site-header .nav-studio').forEach((link) => { link.hidden = true; });
      document.querySelectorAll('.site-header [data-studio-frame-only]').forEach((link) => { link.hidden = false; });
    } else if (!studioMode && back) back.setAttribute('href', homeURL(name));
    // A standalone 3D page was never opened from a homepage card.
    if (footerBack && !(studioMode && !inStudioFrame)) footerBack.setAttribute('href', homeURL(name));
  }

  // Preserve old studio bookmarks, then free the hash for native chapter links.
  if (legacyKey !== null && has(editorials, key) && has(projects, key)) {
    const url = new URL(location.href);
    url.searchParams.set('project', key);
    url.hash = '';
    history.replaceState(history.state, '', url);
  }

  if (!has(editorials, key) || !has(projects, key)) {
    configureExits(null);
    document.title = 'Choose a case study — Kefan Wu';
    const ordered = [...availableKeys].sort((a, b) => String(editorials[a].number).localeCompare(String(editorials[b].number)));
    root.innerHTML = `<div class="case-loading wrap">
      <p class="eyebrow">Kefan Wu / Engineering</p>
      <h1>Selected work.</h1>
      <p id="loading-message" role="status">${has(editorials, key) ? 'This case study could not load. Please reload or browse selected work.' : 'Choose a project below.'}</p>
      <div class="case-options" aria-label="Choose a case study">${ordered.map((name) =>
        `<a href="${casePage}?project=${encodeURIComponent(name)}">${escape(projects[name].title)} →</a>`).join('')}</div>
    </div>`;
    announceReady();
    return;
  }
  configureExits(key);

  const project = projects[key];
  const liveModel = studioMode || key === 'steering';
  const editorial = editorials[key];
  const engineering = editorial.engineering;
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
  const studioURL = inStudioFrame ? 'experience.html?return=project'
    : studioMode || project.noStudio ? 'experience.html' : `project-3d.html#${encodeURIComponent(key)}`;
  const studioLabel = inStudioFrame ? 'Return to' : studioMode ? 'Enter the' : project.noStudio ? 'Explore the' : 'View in';
  const previewInstructions = 'Scroll down to explore the mechanism; scroll back to reverse. The notes follow each stage. You can also choose a numbered step or use the progress slider.';
  const resumeHref = document.querySelector('.site-header a[href*="kefan-wu-resume"]')?.getAttribute('href') || 'assets/kefan-wu-resume.pdf';
  document.title = `${project.title}${studioMode ? ' — 3D Studio' : ''} — Kefan Wu`;
  document.querySelector('meta[name="description"]').content =
    `${editorial.deck} ${editorial.summary.map((item) => item[1]).join(' ')}`;
  document.body.dataset.project = key;

  // Both detail pages describe one project URL. Link unfurlers read the static
  // defaults; renderers that run scripts receive the project's own record.
  function describePage() {
    const url = `https://www.kefanwu.com/case-study.html?project=${encodeURIComponent(key)}`;
    const head = document.querySelector('head');
    const tag = (selector, name, attributes) => {
      let node = document.querySelector(selector);
      if (!node && head) {
        node = document.createElement(name);
        Object.entries(attributes).forEach(([attribute, value]) => node.setAttribute(attribute, value));
        head.append(node);
      }
      return node;
    };
    tag('link[rel="canonical"]', 'link', { rel: 'canonical' })?.setAttribute('href', url);
    tag('meta[property="og:url"]', 'meta', { property: 'og:url' })?.setAttribute('content', url);
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${project.title} — Kefan Wu`);
    document.querySelector('meta[property="og:description"]')?.setAttribute('content', editorial.deck);
  }
  describePage();

  // Render at once with the same white initial pose as the live viewer and
  // streamed animation. The catalog may refine the poster afterwards.
  // AURA uses its re-framed derivative set, which carries all four widths.
  const coverDirectory = key === 'aura' ? 'assets/editorial/aura-reframe-20261022/' : 'assets/editorial/white-20261011/';
  const cover = { ...editorial.cover,
    src: `${coverDirectory}${key}-wide-1800.webp`,
    // The 1200w step was added later under its own dated directory.
    srcset: [480, 960, 1200, 1800].map(width => `${width === 1200 && key !== 'aura' ? 'assets/editorial/white-20261022/' : coverDirectory}${key}-wide-${width}.webp ${width}w`).join(', '),
  };
  async function resolveCover() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch('assets/editorial/aura-reframe-20261022/animation-covers.json', { signal: controller.signal, cache: 'force-cache' });
      if (!response.ok) throw new Error('Cover catalog unavailable');
      const catalog = await response.json();
      const entry = catalog.version === 1 && catalog.projects?.[key];
      if (!entry || !entry.src || new URL(entry.src, document.baseURI).origin !== location.origin) throw new Error('Invalid cover');
      return { ...editorial.cover, ...entry };
    } catch {
      return null; // The rendered fallback already shows the published pose.
    }
    finally { clearTimeout(timeout); }
  }
  function refineCover(resolved) {
    const poster = root.querySelector('.case-animation-host .card-media > img');
    if (!resolved || !poster) return;
    const path = (value) => new URL(value, document.baseURI).pathname;
    // A dated cover path never changes content, so an identical file keeps
    // the request already in flight instead of downloading it twice.
    if (path(resolved.src) !== path(cover.src)) {
      if (resolved.srcset) poster.setAttribute('srcset', resolved.srcset);
      else poster.removeAttribute('srcset');
      poster.setAttribute('src', resolved.src);
    }
    if (resolved.alt && poster.getAttribute('alt') !== resolved.alt) poster.setAttribute('alt', resolved.alt);
  }

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

  function chapterLayout(chapter) {
    if (chapter.image === null) return ' chapter-text-only';
    const view = presentation(gallery[chapter.image]);
    if (view.kind === 'diagram' && view.width / view.height > 3) return ' chapter-equation';
    return ['plot', 'document'].includes(view.kind) ? ' chapter-wide' : '';
  }

  function chapterRecords() {
    return editorial.chapters.filter(chapter => chapter.detailParagraphs?.length).map(chapter =>
      `<details class="chapter-record" id="record-chapter-${escape(chapter.id)}">
        <summary>${escape(chapter.title.replace(/\s+/g, ' ').trim())} — full account</summary>
        <div class="source-detail-body">${chapter.detailParagraphs.map(text => `<p>${escape(text)}</p>`).join('')}<a class="chapter-detail-link chapter-return" href="#${escape(chapter.id)}">Back to chapter <span aria-hidden="true">↑</span><span class="sr-only">: ${escape(chapter.title)}</span></a></div>
      </details>`).join('');
  }

  // A short phone label keeps the three reading shortcuts on one row.
  const jumpLabel = (full, short) => `<span class="jump-label-full">${full}</span><span class="jump-label-short">${short}</span>`;

  // Native chapter links and retained-room history use the same disclosure.
  // Open ancestors before scrolling, including a freshly recreated iframe.
  function revealAnchor(value) {
    let id = String(value || '').replace(/^#/, '');
    try { id = decodeURIComponent(id); } catch {}
    const target = document.getElementById(id);
    if (!target || !root.contains(target)) return null;
    for (let node = target; node && node !== root; node = node.parentElement) {
      if (node.tagName === 'DETAILS') node.open = true;
    }
    return target;
  }
  window.addEventListener('case-reveal-anchor', event => revealAnchor(event.detail?.id));
  window.addEventListener('hashchange', () => {
    const target = revealAnchor(location.hash);
    if (target?.tagName === 'DETAILS') target.scrollIntoView({ behavior: 'instant', block: 'start' });
  });
  root.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target.closest?.('a[href^="#"]');
    if (link) revealAnchor(link.getAttribute('href'));
  });

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

  function sourceLinks() {
    const sources = project.sources || [];
    return sources.length ? `<div class="project-downloads"><h3>Project sources</h3>${sources.map(source =>
      `<a class="text-link" href="${escape(source.href)}" target="_blank" rel="noopener">${escape(source.label)} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a>`).join('')}</div>` : '';
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

  function designBrief() {
    if (!engineering) return '';
    return `<section class="design-brief wrap" id="brief" aria-labelledby="brief-title">
      <div><p class="eyebrow">The engineering problem</p><h2 id="brief-title">Design brief.</h2><p class="brief-goal">${escape(engineering.goal)}</p></div>
      <div class="brief-constraints"><h3>Working constraints</h3><ul>${engineering.constraints.map((constraint) => `<li>${escape(constraint)}</li>`).join('')}</ul></div>
    </section>`;
  }

  function requirementsReview() {
    if (!engineering?.checks?.length) return '';
    return `<section class="requirements-review wrap" id="verification" aria-labelledby="verification-title">
      <div class="section-heading"><div><p class="eyebrow">Close the design loop</p><h2 id="verification-title">Requirements &amp; evidence.</h2></div></div>
      <div class="verification-table-wrap" role="region" aria-labelledby="verification-title"><table class="verification-table" role="table">
        <caption class="sr-only">Each project criterion, how it was checked, and the resulting evidence.</caption>
        <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Criterion</th><th scope="col" role="columnheader">Method / evidence</th><th scope="col" role="columnheader">Finding</th></tr></thead>
        <tbody role="rowgroup">${engineering.checks.map(([criterion, method, result, basis]) => `<tr role="row"><th scope="row" role="rowheader"><span class="verification-cell-label" aria-hidden="true">Criterion</span>${escape(criterion)}</th><td role="cell"><span class="verification-cell-label" aria-hidden="true">Method / evidence</span>${escape(method)}</td><td role="cell"><span class="verification-cell-label" aria-hidden="true">Finding</span><span class="evidence-basis">${escape(basis)}</span>${escape(result)}</td></tr>`).join('')}</tbody>
      </table></div>
      <div class="iteration-takeaway"><h3>What the review changes</h3><p>${escape(engineering.iteration)}</p></div>
    </section>`;
  }

  root.innerHTML = `<article>
    <section class="case-hero wrap" aria-labelledby="case-title">
      <p class="hero-kicker eyebrow"><span class="case-number">Case ${escape(editorial.number)} / ${number(availableKeys.length)}</span><span>${escape(editorial.label)}</span></p>
      <div class="hero-heading">
        <h1 id="case-title">${escape(editorial.title)}</h1>
        <div class="hero-deck"><h2>${escape(editorial.deck)}</h2><p>${escape(editorial.description)}</p></div>
      </div>
      <nav class="case-reading-actions" aria-label="Choose how to explore this project">
        <a class="reading-primary" href="${engineering ? '#brief' : `#${escape(chapters[0].id)}`}">${jumpLabel('Read case study', 'Case study')} <span aria-hidden="true">↓</span></a>
        ${engineering?.checks?.length ? `<a href="#verification">${jumpLabel('View results', 'Results')} <span aria-hidden="true">↓</span></a>` : ''}
        <a href="#motion">${jumpLabel('Explore model', 'Model')} <span aria-hidden="true">↓</span></a>
      </nav>
      <dl class="case-summary" aria-label="Case study in 30 seconds">${editorial.summary.map(([label, text]) => `<div><dt>${escape(label)}</dt><dd>${escape(text)}</dd></div>`).join('')}</dl>
    </section>
      <section class="case-motion-story" id="motion" aria-labelledby="preview-title" data-motion-project="${escape(key)}">
      <div class="case-motion-pin"><svg class="motion-leader" aria-hidden="true"><defs><marker id="motion-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M1 1 L6 4 L1 7"/></marker></defs><path class="motion-leader-line" pathLength="1" marker-end="url(#motion-arrow)"/><circle class="motion-leader-target" r="2.5"/></svg>
      <div class="motion-story-heading"><p class="eyebrow">${escape(project.title)} <span aria-hidden="true"> / </span> In motion</p><a class="motion-skip" href="#brief">The design story <span aria-hidden="true">↓</span></a></div>
      <div class="case-preview-layout">
        <figure class="case-preview-figure">
          <div class="case-animation-host" data-motion-live="${liveModel}" data-scroll-driven="true" data-project="${escape(key)}" data-preview-title="${escape(project.title)}" data-preview-instructions="preview-instructions" role="group" aria-labelledby="preview-title">
            <div class="card-media"><img src="${escape(cover.src)}"${cover.srcset ? ` srcset="${escape(cover.srcset)}" sizes="(max-width: 700px) 100vw, min(100vw, 1440px)"` : ''} alt="${escape(cover.alt || project.title)}" width="${cover.width || 1800}" height="${cover.height || 1200}" loading="eager" decoding="async" fetchpriority="high"></div>
          </div>
          <figcaption class="cover-caption"><span>${escape(cover.caption || 'Explore the project model and its motion.')}</span><span class="eyebrow">Interactive project model</span></figcaption>
        </figure>
        <aside class="preview-introduction motion-notes" aria-label="Animation notes"><p class="eyebrow motion-step-count">01 / 04</p><h2 id="preview-title">Take a closer look.</h2><p class="motion-note-body">${escape(cover.caption || editorial.deck)}</p><p class="motion-evidence-note"></p></aside>
      </div>
      <p class="motion-scroll-cue" aria-hidden="true">Scroll to explore <span>↓</span></p>
      <div class="motion-story-footer"><p id="preview-instructions" class="sr-only">${previewInstructions}</p><div class="motion-step-buttons" role="group" aria-label="Animation stages"></div><div class="motion-story-timeline"><label class="sr-only" for="motion-story-progress">Animation progress</label><input type="range" id="motion-story-progress" min="0" max="1000" step="1" value="0" aria-describedby="preview-instructions"><output for="motion-story-progress">0%</output></div><div class="preview-links">${liveModel ? '<button type="button" class="text-link motion-explore" aria-pressed="false">Explore freely</button>' : `<a class="text-link" href="${studioURL}">Explore in 3D <span aria-hidden="true">↗</span></a>`}</div></div>
      </div></section>
    <nav class="chapter-nav" aria-label="Case study sections"><div class="chapter-nav-inner wrap">
      <a href="#motion">Motion</a>${engineering ? '<a href="#brief">Brief</a>' : ''}${editorial.chapters.map((chapter, index) => `<a href="#${escape(chapter.id)}"><span class="mono">${number(index + 1)}</span>${escape(chapter.label)}</a>`).join('')}
      ${engineering?.checks?.length ? '<a href="#verification">Evidence review</a>' : ''}
      <a href="#evidence">Image archive</a>${supplement.bom ? '<a href="#bom">BOM</a>' : ''}<a href="#record">Technical record</a>
    </div></nav>
    ${designBrief()}
    <div class="wrap">${chapters.map((chapter, index) => `<section class="chapter${chapterLayout(chapter)}" id="${escape(chapter.id)}" aria-labelledby="${escape(chapter.id)}-title">
      <div class="chapter-copy"><p class="eyebrow">${number(index + 1)} / ${escape(chapter.label)}</p><h2 id="${escape(chapter.id)}-title">${escape(chapter.title)}</h2>${chapter.paragraphs.map((text, paragraphIndex) => `<p${paragraphIndex === 0 ? ' class="chapter-lead"' : ''}>${escape(text)}</p>`).join('')}${chapter.detailParagraphs?.length ? `<a class="chapter-detail-link" href="#record-chapter-${escape(chapter.id)}">Full engineering detail <span aria-hidden="true">↓</span><span class="sr-only">: ${escape(chapter.title)}</span></a>` : ''}</div>
      ${chapter.image !== null ? `<figure class="chapter-figure ${mediaClass(gallery[chapter.image])}"${mediaStyle(gallery[chapter.image])}>${imageButton(gallery[chapter.image], chapter.image)}<figcaption><span class="evidence-type">${escape(chapter.evidence)}</span>${escape(chapter.note)}</figcaption></figure>` : ''}
    </section>`).join('')}</div>
    ${requirementsReview()}
    <section class="evidence-section wrap" id="evidence" aria-labelledby="evidence-title">
      <div class="section-heading"><div><p class="eyebrow">The project images</p><h2 id="evidence-title">A closer look.</h2></div><p>${archive.length ? `${archive.length} more image${archive.length === 1 ? '' : 's'}. Open any to browse all ${gallery.length}.` : `${gallery.length === 1 ? 'The project image appears' : `All ${gallery.length} project images appear`} in the chapters above. Open any to browse the complete set.`}</p></div>
      ${archive.length ? `<div class="gallery-grid">${archive.map(({ image, index }) => `<figure class="gallery-item ${mediaClass(image)}"${mediaStyle(image)}>${imageButton(image, index)}<figcaption><span class="mono">${number(index + 1)}</span><span>${escape(image.caption || image.alt)}</span></figcaption></figure>`).join('')}</div>` : gallery.length ? `<button type="button" class="text-link gallery-browse" data-image="0">Browse ${gallery.length === 1 ? 'the image' : `all ${imageCount(gallery.length)}`} <span aria-hidden="true">↗</span></button>` : ''}
    </section>
    ${billOfMaterials()}
    <section class="record-section wrap" id="record" aria-labelledby="record-title">
      <div class="section-heading"><div><p class="eyebrow">For the technical conversation</p><h2 id="record-title">The engineering record.</h2></div></div>
      <p class="record-intro">Original project notes, methods, and results.${editorial.recordNote ? ` ${escape(editorial.recordNote)}` : ''}</p>
      <div class="record-layout"><aside aria-label="Project tools and context"><h3>Tools & methods</h3><ul class="tool-list">${(project.tools || []).map((tool) => `<li>${escape(tool)}</li>`).join('')}</ul>${sourceSpec()}${downloadLinks()}${sourceLinks()}</aside>
        <div class="source-details">${chapterRecords()}${documentedDetails()}<details><summary>Project overview & highlights</summary><div class="source-detail-body"><p>${escape(project.summary)}</p><ul>${(project.highlights || []).map((item) => `<li>${escape(item)}</li>`).join('')}</ul></div></details>${originalDetails()}</div>
      </div>
    </section>
    <section class="next-section" aria-label="Continue exploring"><div class="next-inner wrap">
      <div class="next-primary">
        <a class="next-link" href="${casePage}?project=${encodeURIComponent(nextKey)}"><span class="eyebrow">Next case / ${escape(next.number)}</span><span class="next-title"><span class="next-name">${escape(next.title)}</span><span class="next-arrow" aria-hidden="true">↗</span></span></a>
        <p class="case-contact"><a href="mailto:kwu@olin.edu">kwu@olin.edu</a><span aria-hidden="true">·</span><a href="https://www.linkedin.com/in/kefan-wu-olin/" target="_blank" rel="noreferrer">LinkedIn <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a><span aria-hidden="true">·</span><a href="${escape(resumeHref)}" target="_blank" rel="noopener">Resume (PDF) <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span></a></p>
      </div>
      <div class="studio-invitation"><h3>${studioMode ? 'Explore the studio.' : 'Explore the hardware.'}</h3><p>${inStudioFrame ? 'Return to the room to explore more engineering projects.' : studioMode || project.noStudio ? 'Browse more projects in the interactive engineering studio.' : 'Rotate the model and control its motion in the interactive studio.'}</p><a class="text-link" href="${studioURL}">${studioLabel} 3D Studio <span aria-hidden="true">↗</span></a></div>
    </div></section>
  </article>`;
  resolveCover().then(refineCover);
  announceReady();

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
  const panHint = document.getElementById('lightbox-pan-hint');
  const panLayout = window.matchMedia?.('(max-width: 700px) and (orientation: portrait)');
  const coarsePointer = window.matchMedia?.('(pointer: coarse)');
  let imageIndex = 0;
  let opener = null;

  // Portrait phones draw wide figures at stage height in a sideways-scrolling
  // stage instead of shrinking them to a strip. Image pixels stay untouched.
  function updatePan() {
    const image = stage.querySelector('img');
    const pannable = !!(image && panLayout?.matches && ['plot', 'document', 'diagram'].includes(stage.dataset.mediaKind) &&
      stage.scrollWidth > stage.clientWidth + 1);
    stage.dataset.pan = String(pannable);
    if (panHint) {
      panHint.hidden = !pannable;
      if (pannable) panHint.innerHTML = `${coarsePointer?.matches ? 'Swipe' : 'Scroll sideways'} to pan <span aria-hidden="true">↔</span>`;
    }
    if (pannable) {
      stage.tabIndex = 0;
      stage.setAttribute('role', 'region');
      stage.setAttribute('aria-label', 'Enlarged image. Scroll sideways to pan.');
    } else {
      stage.removeAttribute('tabindex');
      stage.removeAttribute('role');
      stage.removeAttribute('aria-label');
    }
  }

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
    img.addEventListener('load', () => {
      if (!img.isConnected) return;
      // Never draw a panned figure beyond its own pixel height.
      stage.style.setProperty('--pan-height', `${img.naturalHeight}px`);
      updatePan();
      stage.scrollLeft = 0;
    });
    stage.dataset.mediaKind = view.kind;
    stage.dataset.mediaSurface = view.surface || (view.kind === 'photo' ? 'dark' : 'light');
    stage.replaceChildren(img);
    updatePan();
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
    window.dispatchEvent(new CustomEvent('case-lightbox-state', { detail: { open: true } }));
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
    // A focused panning stage keeps its native sideways keyboard scrolling.
    if (event.target === stage && stage.dataset.pan === 'true' && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
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
  window.addEventListener('resize', () => { if (dialog.open) updatePan(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('lightbox-open');
    stage.replaceChildren();
    updatePan();
    window.dispatchEvent(new CustomEvent('case-lightbox-state', { detail: { open: false } }));
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });

  // No continuous animation loop. The observer only updates section navigation.
  if ('IntersectionObserver' in window) {
    const nav = document.querySelector('.chapter-nav-inner');
    const sectionLinks = [...document.querySelectorAll('.chapter-nav a')];
    const visibleSections = new Set();
    const sections = sectionLinks.map((link) => document.getElementById(link.hash.slice(1)));
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let observer;
    let currentLink = null;
    // The phone navigation scrolls sideways: fade only the edges that hide
    // links, and keep the current section's link centred in view.
    const markOverflow = () => {
      const max = nav.scrollWidth - nav.clientWidth;
      const edges = max > 1 ? [nav.scrollLeft > 1 ? 'start' : '', nav.scrollLeft < max - 1 ? 'end' : ''].filter(Boolean).join(' ') : '';
      if (edges) nav.dataset.overflow = edges;
      else delete nav.dataset.overflow;
    };
    const centreLink = (link) => {
      const max = nav.scrollWidth - nav.clientWidth;
      if (max <= 1) return;
      const navBox = nav.getBoundingClientRect();
      const linkBox = link.getBoundingClientRect();
      const left = nav.scrollLeft + linkBox.left - navBox.left - (navBox.width - linkBox.width) / 2;
      nav.scrollTo({ left: Math.max(0, Math.min(max, left)), behavior: reducedMotion?.matches ? 'auto' : 'smooth' });
    };
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
      const active = current ? sectionLinks.find((link) => link.hash === `#${current.id}`) : null;
      if (nav && active && active !== currentLink) centreLink(active);
      currentLink = active || currentLink;
      }, { rootMargin: `-${marker}px 0px -${Math.max(0, innerHeight - marker - 2)}px 0px`, threshold: 0 });
      sections.forEach((section) => observer.observe(section));
      if (nav) markOverflow();
    };
    nav?.addEventListener('scroll', markOverflow, { passive: true });
    if (nav) document.fonts?.ready.then(markOverflow);
    let resizeFrame = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(configure);
    });
    configure();
  }

  // Dynamic content must honor a shared chapter URL after the sections exist.
  const hashTarget = revealAnchor(location.hash);
  if (hashTarget && root.contains(hashTarget)) {
    const requestedHash = location.hash;
    requestAnimationFrame(() => {
      if (location.hash === requestedHash && !root.querySelector('.case-motion-story[data-user-seeking="true"]')) {
        hashTarget.scrollIntoView({ behavior: 'instant' });
      }
    });
  }
})();
