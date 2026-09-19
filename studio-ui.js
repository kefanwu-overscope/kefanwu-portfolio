import { studioProjects, studioCategories, getStudioProject } from './studio-catalog.js?v=studio-20260919';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const clamp = (value) => Math.max(0, Math.min(1, Number(value) || 0));

export function createStudioUI(callbacks = {}) {
  const root = document.getElementById('studio-app');
  const room = document.getElementById('studio-room');
  const abort = new AbortController();
  const mobile = matchMedia('(max-width: 760px)');
  let mode = 'room';
  let current = null;
  let playing = false;
  let progress = 0;
  let status = 'loading';
  let category = 'all';
  let catalogOpen = true;
  let roomExploring = false;
  let returnFocus = null;
  const call = (name, ...args) => callbacks[name]?.(...args);
  const listen = (node, event, handler, options = {}) => node?.addEventListener(event, handler, { ...options, signal: abort.signal });

  root.innerHTML = `
    <a class="studio-skip" href="#studio-catalog">Skip to projects</a>
    <header class="studio-header">
      <a class="studio-brand" href="index.html#top" aria-label="Kefan Wu — portfolio"><span class="studio-brand__mark" aria-hidden="true">KW</span><span>Kefan Wu<span class="studio-brand__sub">Engineering studio</span></span></a>
      <nav class="studio-header__links" aria-label="Studio navigation">
        <a class="studio-resume" href="assets/kefan-wu-resume.pdf?v=e1902c160b0d" target="_blank" rel="noopener">Resume <span aria-hidden="true">↗</span></a>
        <a class="studio-portfolio" href="index.html#work">Portfolio <span aria-hidden="true">↗</span></a>
        <button type="button" class="studio-button studio-button--accent" id="studio-projects-toggle" aria-expanded="true" aria-controls="studio-catalog">Projects <span class="studio-project-count">${studioProjects.length}</span></button>
      </nav>
    </header>

    <section class="studio-welcome" id="studio-welcome" aria-labelledby="studio-welcome-title">
      <p class="studio-eyebrow">Design · Build · Test</p>
      <h1 id="studio-welcome-title">Step inside.<br>See how it works.</h1>
      <p>Real projects, from the first assembly to the finished build. Pick one to rotate it, explore its motion, and see the engineering behind it.</p>
      <div class="studio-welcome__actions"><button type="button" class="studio-button studio-button--accent" id="studio-featured">Inspect steering <span aria-hidden="true">↗</span></button><button type="button" class="studio-button studio-button--quiet" id="studio-browse-room">Explore the room <span aria-hidden="true">→</span></button></div>
    </section>

    <div class="studio-room-tools" id="studio-room-tools">
      <span class="studio-room-status" id="studio-room-status" role="status">Choose a project to begin.</span>
      <button type="button" class="studio-button studio-button--quiet" id="studio-room-reset">Reset room view</button>
      <details class="studio-settings"><summary aria-label="Room settings">Settings</summary><div class="studio-settings__body"><label for="studio-quality">Quality<select id="studio-quality"><option value="auto">Auto</option><option value="low">Low</option><option value="high">High</option></select></label><button type="button" id="studio-room-lights" aria-pressed="false">Room lights</button></div></details>
    </div>

    <main class="studio-workbench" id="studio-workbench" hidden>
      <section class="studio-viewer" aria-label="Interactive project workbench">
        <div class="studio-viewport" id="studio-viewport" data-status="loading">
          <canvas id="studio-inspector-canvas" tabindex="0" aria-label="Interactive project model. Drag to rotate, scroll to zoom. Use the motion controls below to animate."></canvas>
          <img class="studio-poster" id="studio-poster" alt="" decoding="async">
          <div class="studio-model-heading"><button type="button" class="studio-room-return" id="studio-room-return"><span aria-hidden="true">←</span> Studio</button><p class="studio-eyebrow" id="studio-project-label"></p><h1 id="studio-project-title" tabindex="-1"></h1></div>
          <p class="studio-model-help" id="studio-model-help">Drag to rotate · Scroll to zoom</p>
          <div class="studio-load-status" id="studio-load-status"><span id="studio-status-text" role="status" aria-live="polite">Loading interactive model…</span><button type="button" class="studio-button" id="studio-retry" hidden>Retry model</button></div>
        </div>
        <div class="studio-controls" aria-label="Model controls">
          <div class="studio-control-row"><button type="button" class="studio-button studio-play" id="studio-play" aria-pressed="false" disabled><span data-play-icon aria-hidden="true">▶</span><span data-play-label>Play</span></button><button type="button" class="studio-button studio-reverse" id="studio-reverse" aria-pressed="false" disabled>Reverse</button><button type="button" class="studio-button studio-reset" id="studio-reset" disabled>Reset <span aria-hidden="true">↺</span></button><label class="studio-view-label"><span class="sr-only">Standard model view</span><select id="studio-view" disabled><option value="source">Original view</option><option value="front">Front view</option><option value="side">Side view</option><option value="top">Top view</option><option value="iso">Isometric view</option></select></label></div>
          <div class="studio-timeline" id="studio-timeline"><div class="studio-timeline__labels"><label for="studio-progress" id="studio-motion-label">Motion progress</label><output id="studio-progress-value" for="studio-progress">0%</output></div><input type="range" id="studio-progress" min="0" max="1000" step="1" value="0" aria-valuetext="0 percent" disabled><span class="studio-timeline__hint">Drag or scroll here to move forward and back</span></div>
        </div>
      </section>
      <aside class="studio-info" id="studio-info" aria-label="Project details"><div class="studio-project-nav"><button type="button" id="studio-previous" aria-label="Previous project">← Previous</button><span id="studio-project-number"></span><button type="button" id="studio-next" aria-label="Next project">Next →</button></div><details id="studio-info-details" open><summary>Project details <span aria-hidden="true">+</span></summary><div class="studio-info-content" id="studio-info-content"></div></details><a class="studio-story-link" id="studio-story-link" href="index.html#work">Read full case study <span aria-hidden="true">↗</span></a></aside>
    </main>

    <aside class="studio-catalog" id="studio-catalog" aria-labelledby="studio-catalog-title" tabindex="-1">
      <div class="studio-catalog__heading"><div><p class="studio-eyebrow">The project collection</p><h2 id="studio-catalog-title">Choose your next look.</h2></div><button type="button" class="studio-catalog__close" id="studio-catalog-close" aria-label="Close project directory">×</button></div>
      <label class="studio-search"><svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="m12 12 5 5"/></svg><span class="sr-only">Search projects</span><input id="studio-search" type="search" placeholder="Search projects" autocomplete="off"></label>
      <div class="studio-filters" role="group" aria-label="Filter projects">${studioCategories.map(({ key, label }) => `<button type="button" data-category="${key}" aria-pressed="${key === 'all'}">${label}</button>`).join('')}</div>
      <p class="studio-catalog__count" id="studio-catalog-count" role="status">${studioProjects.length} projects</p>
      <div class="studio-catalog__grid" id="studio-catalog-grid">${studioProjects.map((project) => `<button type="button" class="studio-project-card" data-project="${escape(project.key)}" aria-label="Inspect ${escape(project.name)}"><span class="studio-project-card__image"><img src="${escape(project.cover.src)}" srcset="${escape(project.cover.srcset || '')}" sizes="(max-width: 760px) 45vw, 180px" width="${project.cover.width || 1800}" height="${project.cover.height || 1200}" alt="" loading="lazy" decoding="async"><span class="studio-project-card__arrow" aria-hidden="true">↗</span></span><span class="studio-project-card__meta">${escape(project.number)} / ${escape(project.categories[0] || 'Project')}</span><span class="studio-project-card__name">${escape(project.name)}</span></button>`).join('')}</div>
      <p class="studio-empty" id="studio-empty" hidden>No matching projects. Try another search or category.</p>
    </aside>`;

  const find = (id) => root.querySelector(`#${id}`);
  const canvas = find('studio-inspector-canvas');
  const viewport = find('studio-viewport');
  const catalog = find('studio-catalog');
  const toggle = find('studio-projects-toggle');
  const range = find('studio-progress');
  const infoDetails = find('studio-info-details');
  const poster = find('studio-poster');
  const play = find('studio-play');
  const motionControls = ['studio-play', 'studio-reverse', 'studio-reset', 'studio-view', 'studio-progress'].map(find);

  function setCatalogOpen(open, { focus = false } = {}) {
    catalogOpen = Boolean(open);
    catalog.hidden = !catalogOpen;
    toggle.setAttribute('aria-expanded', String(catalogOpen));
    document.body.classList.toggle('studio-catalog-open', catalogOpen);
    if (catalogOpen && focus) { returnFocus = document.activeElement; find('studio-search').focus(); }
    else if (!catalogOpen && catalog.contains(document.activeElement)) (returnFocus?.isConnected ? returnFocus : toggle).focus();
  }

  function setMode(nextMode) {
    if (nextMode === 'room' && mode === 'inspect') roomExploring = true;
    mode = nextMode === 'inspect' ? 'inspect' : 'room';
    document.body.dataset.studioMode = mode;
    find('studio-workbench').hidden = mode !== 'inspect';
    find('studio-welcome').hidden = mode !== 'room' || roomExploring;
    find('studio-room-tools').hidden = mode !== 'room';
    if (room) { room.hidden = mode !== 'room'; room.inert = mode !== 'room'; }
    if (mode === 'inspect') setCatalogOpen(false);
  }

  function setRoomExploring(value) {
    roomExploring = Boolean(value);
    find('studio-welcome').hidden = mode !== 'room' || roomExploring;
  }

  function setProject(value) {
    const project = typeof value === 'string' ? getStudioProject(value) : value;
    if (!project) return;
    current = project;
    find('studio-project-title').textContent = project.name;
    find('studio-project-label').textContent = project.label;
    find('studio-project-number').textContent = `${project.number} / ${String(studioProjects.length).padStart(2, '0')}`;
    find('studio-motion-label').textContent = project.motionLabel;
    find('studio-story-link').href = project.storyURL;
    canvas.setAttribute('aria-label', `${project.name}. Drag to rotate; scroll or pinch to zoom. Use the controls below to explore ${project.motionLabel.toLowerCase()}.`);
    poster.src = project.cover.src;
    poster.srcset = project.cover.srcset || '';
    poster.sizes = '(max-width: 760px) 100vw, calc(100vw - 380px)';
    poster.alt = project.cover.alt || project.name;
    const record = (label, value) => value ? `<div class="studio-fact"><dt>${escape(label)}</dt><dd>${escape(value)}</dd></div>` : '';
    find('studio-info-content').innerHTML = `
      <p class="studio-eyebrow">Behind the build</p><h2>${escape(project.editorial.deck)}</h2>
      <dl class="studio-summary">${record(project.roleLabel, project.role)}${record(project.resultLabel, project.result)}${record('Evidence', project.evidence)}</dl>
      ${project.facts.length ? `<section class="studio-key-facts" aria-label="Selected project facts"><h3>Selected details</h3><dl>${project.facts.map((fact) => record(fact.label, fact.value)).join('')}</dl></section>` : ''}
      <section class="studio-evidence" aria-label="Project images"><div class="studio-evidence__heading"><h3>From the project</h3><a href="${escape(project.storyURL)}#evidence">All ${project.gallery.length} images ↗</a></div>${project.previewImages.map((image) => `<figure class="studio-media studio-media--${escape(image.kind)}${image.surface ? ` studio-media--${escape(image.surface)}` : ''}"><a href="${escape(project.storyURL)}#evidence" aria-label="View project images: ${escape(image.caption)}"><img src="${escape(image.src)}" alt="${escape(image.alt)}"${image.width && image.height ? ` width="${image.width}" height="${image.height}"` : ''} loading="lazy" decoding="async"></a><figcaption>${escape(image.caption)}${image.src !== image.originalSrc ? ` <a href="${escape(image.originalSrc)}" target="_blank" rel="noopener">${escape(image.originalLabel || 'Original image')} ↗</a>` : ''}</figcaption></figure>`).join('')}</section>
      <div class="studio-detail-links">${project.bomURL ? `<a href="${escape(project.bomURL)}">Bill of materials <span aria-hidden="true">↗</span></a>` : ''}<a href="${escape(project.storyURL)}#record">Technical record & downloads <span aria-hidden="true">↗</span></a></div>`;
    root.querySelectorAll('[data-project]').forEach((button) => {
      if (button.dataset.project === project.key) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    });
    find('studio-info').scrollTop = 0;
    infoDetails.open = !mobile.matches;
    find('studio-view').value = 'source';
    setProgress(0);
    setPlaying(false);
    setStatus('loading');
  }

  function setStatus(nextStatus, message = '') {
    if (typeof nextStatus === 'object') { message = nextStatus.message || ''; nextStatus = nextStatus.state || nextStatus.status; }
    status = nextStatus || 'loading';
    viewport.dataset.status = status;
    viewport.setAttribute('aria-busy', String(status === 'loading'));
    find('studio-status-text').textContent = message || ({ loading: 'Loading interactive model…', ready: 'Ready to explore', error: 'The interactive model could not load. The project images and case study are still available.' })[status] || status;
    find('studio-load-status').hidden = status === 'ready';
    find('studio-retry').hidden = status !== 'error';
    poster.hidden = false;
    poster.setAttribute('aria-hidden', String(status === 'ready'));
    motionControls.forEach((control) => { control.disabled = status !== 'ready'; });
    if (status !== 'ready') setPlaying(false);
  }

  function setProgress(value) {
    progress = clamp(value);
    range.value = String(Math.round(progress * 1000));
    const percent = `${Math.round(progress * 100)}%`;
    find('studio-progress-value').textContent = percent;
    range.setAttribute('aria-valuetext', `${Math.round(progress * 100)} percent`);
    range.style.setProperty('--progress', percent);
  }

  function setPlaying(value, direction = 1) {
    playing = Boolean(value);
    play.setAttribute('aria-pressed', String(playing && direction !== -1));
    find('studio-reverse').setAttribute('aria-pressed', String(playing && direction === -1));
    find('studio-reverse').textContent = playing && direction === -1 ? 'Pause reverse' : 'Reverse';
    play.querySelector('[data-play-label]').textContent = playing ? 'Pause' : 'Play';
    play.querySelector('[data-play-icon]').textContent = playing ? 'Ⅱ' : '▶';
  }

  function setRoomStatus(nextStatus, message = '') {
    if (typeof nextStatus === 'object') { message = nextStatus.message || ''; nextStatus = nextStatus.state || nextStatus.status; }
    find('studio-room-status').textContent = message || ({ ready: 'Drag to orbit · Select a project', loading: 'Preparing the room… Projects are ready to open.', error: 'Room unavailable. Open any project from the directory.' })[nextStatus] || '';
    find('studio-room-reset').disabled = nextStatus !== 'ready';
    const roomPoster = document.getElementById('studio-room-poster');
    if (roomPoster) roomPoster.hidden = nextStatus === 'ready';
  }

  function filterProjects() {
    const query = find('studio-search').value.trim().toLocaleLowerCase();
    let count = 0;
    root.querySelectorAll('[data-project]').forEach((button) => {
      const project = getStudioProject(button.dataset.project);
      const visible = (category === 'all' || project.categories.includes(category)) && (!query || `${project.name} ${project.label} ${project.role} ${project.result} ${project.categories.join(' ')} ${project.source.tools?.join(' ') || ''}`.toLocaleLowerCase().includes(query));
      button.hidden = !visible;
      if (visible) count++;
    });
    find('studio-catalog-count').textContent = `${count} project${count === 1 ? '' : 's'}`;
    find('studio-empty').hidden = count !== 0;
  }

  const chooseProject = (key) => { setCatalogOpen(false); call('onSelect', key); };
  listen(toggle, 'click', () => setCatalogOpen(!catalogOpen, { focus: !catalogOpen }));
  listen(find('studio-catalog-close'), 'click', () => setCatalogOpen(false));
  listen(find('studio-search'), 'input', filterProjects);
  listen(find('studio-catalog-grid'), 'click', (event) => { const card = event.target.closest('[data-project]'); if (card) chooseProject(card.dataset.project); });
  listen(root.querySelector('.studio-filters'), 'click', (event) => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    root.querySelectorAll('[data-category]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
    filterProjects();
  });
  listen(find('studio-featured'), 'click', () => chooseProject('steering'));
  listen(find('studio-browse-room'), 'click', () => { setCatalogOpen(false); setRoomExploring(true); call('onRoom'); });
  listen(find('studio-room-return'), 'click', () => call('onRoom'));
  listen(play, 'click', () => call('onTogglePlay'));
  listen(find('studio-reverse'), 'click', () => call('onReverse'));
  listen(find('studio-reset'), 'click', () => { find('studio-view').value = 'source'; call('onReset'); });
  listen(find('studio-view'), 'change', (event) => call('onView', event.target.value));
  listen(find('studio-retry'), 'click', () => call('onRetry'));
  listen(range, 'input', () => { setProgress(Number(range.value) / 1000); call('onProgress', progress); });
  listen(find('studio-timeline'), 'wheel', (event) => {
    if (status !== 'ready' || event.ctrlKey) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1);
    const next = clamp(progress + delta * .0007);
    if (next === progress) return;
    event.preventDefault();
    setProgress(next);
    call('onProgress', next);
  }, { passive: false });
  listen(find('studio-previous'), 'click', () => { if (current) chooseProject(studioProjects[(current.index + studioProjects.length - 1) % studioProjects.length].key); });
  listen(find('studio-next'), 'click', () => { if (current) chooseProject(studioProjects[(current.index + 1) % studioProjects.length].key); });
  listen(find('studio-room-reset'), 'click', () => { setRoomExploring(true); call('onRoomReset'); });
  listen(find('studio-quality'), 'change', (event) => call('onQuality', event.target.value));
  listen(find('studio-room-lights'), 'click', () => call('onToggleRoomLights'));
  listen(root.querySelector('.studio-skip'), 'click', (event) => { event.preventDefault(); setCatalogOpen(true, { focus: true }); });
  listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && catalogOpen) { setCatalogOpen(false); event.preventDefault(); return; }
    if (event.target !== canvas || mode !== 'inspect' || status !== 'ready') return;
    if (event.key === ' ') { event.preventDefault(); call('onTogglePlay'); }
    else if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : clamp(progress + (event.key === 'ArrowRight' ? .025 : -.025));
      setProgress(next); call('onProgress', next);
    }
  });
  listen(mobile, 'change', () => { infoDetails.open = !mobile.matches; });

  infoDetails.open = !mobile.matches;
  setMode('room');
  setCatalogOpen(true);
  setRoomStatus('loading');
  return {
    canvas, viewport, root, setMode, setProject, setStatus, setProgress, setPlaying, setCatalogOpen, setRoomStatus, setRoomExploring,
    setRoomLights: (enabled) => find('studio-room-lights').setAttribute('aria-pressed', String(Boolean(enabled))),
    setQuality: (quality) => { find('studio-quality').value = quality; },
    focusModel: () => canvas.focus({ preventScroll: true }),
    destroy: () => { abort.abort(); root.replaceChildren(); }
  };
}
