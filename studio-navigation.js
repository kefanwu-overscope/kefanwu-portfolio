const PROTOCOL = 'kw-studio-project-v1';
const STATE = 'studioNavigation';

// The loaded room remains the top-level document during project visits. One
// disposable frame hosts the existing full project page; only this controller
// owns history, so chapter/next-project links cannot add hidden frame entries.
export function createStudioNavigation({ onActiveChange = () => {} } = {}) {
  const roomURL = new URL(location.href);
  const projectPath = new URL('project-3d.html', roomURL).pathname;
  const roomTitle = document.title;
  const session = crypto.randomUUID();
  let panel = null, frame = null, frameKey = null, ready = false, timer = null;
  let savedFocus = null, hiddenElements = [], lastIndex = 0, disposed = false;
  const current = () => history.state?.[STATE];
  const owned = state => state?.session === session && Number.isInteger(state.index) && state.index >= 0;
  const route = value => {
    try {
      const url = new URL(value, roomURL);
      if (url.origin !== roomURL.origin || url.pathname !== projectPath) return null;
      let key = url.searchParams.get('project');
      if (!key && url.hash) { key = decodeURIComponent(url.hash.slice(1)); url.hash = ''; }
      if (!Object.hasOwn(window.projectData || {}, key)) return null;
      url.searchParams.set('project', key); url.searchParams.delete('studioFrame');
      return url;
    } catch { return null; }
  };
  const write = (state, url, replace = false) => {
    history[replace ? 'replaceState' : 'pushState']({ ...history.state, [STATE]: state }, '', url);
    lastIndex = state.index;
  };
  write({ session, kind: 'room', index: 0 }, roomURL, true);

  function send(message) {
    frame?.contentWindow?.postMessage({ protocol: PROTOCOL, ...message }, roomURL.origin);
  }
  function releaseFrame() {
    clearTimeout(timer); timer = null;
    // Synchronous cleanup is deliberate: a queued postMessage can be discarded
    // when its browsing context is removed in the same task.
    try { const child = frame?.contentWindow; child?.dispatchEvent(new child.Event('studio-project-dispose')); } catch {}
    frame?.remove(); frame = null; frameKey = null; ready = false;
  }
  function showRoom() {
    if (!panel) return;
    releaseFrame(); panel.remove(); panel = null;
    document.body.classList.remove('studio-project-open');
    for (const [element, wasInert, aria] of hiddenElements) {
      element.inert = wasInert;
      if (aria === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', aria);
    }
    hiddenElements = [];
    document.title = roomTitle;
    onActiveChange(false);
    if (savedFocus?.isConnected && !savedFocus.inert) savedFocus.focus({ preventScroll: true });
    else document.getElementById('exp-canvas')?.focus({ preventScroll: true });
  }
  function returnToRoom() {
    const state = current();
    if (owned(state) && state.index > 0) history.go(-state.index);
    else { write({ session, kind: 'room', index: 0 }, roomURL, true); showRoom(); }
  }
  function createPanel() {
    if (panel) return;
    savedFocus = document.activeElement;
    hiddenElements = [...document.body.children].map(element => [element, element.inert, element.getAttribute('aria-hidden')]);
    for (const [element] of hiddenElements) { element.inert = true; element.setAttribute('aria-hidden', 'true'); }
    document.body.classList.add('studio-project-open');
    panel = document.createElement('section');
    panel.className = 'studio-project-page'; panel.setAttribute('aria-label', 'Project details');
    const loading = document.createElement('div'); loading.className = 'studio-project-loading';
    const back = document.createElement('button'); back.type = 'button'; back.textContent = '← Back to studio';
    back.addEventListener('click', returnToRoom);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'Opening project…';
    loading.append(back, status); panel.append(loading); document.body.append(panel);
    back.focus({ preventScroll: true }); onActiveChange(true);
  }
  function showProject(state) {
    const url = route(state.url);
    if (!url) { returnToRoom(); return; }
    createPanel();
    const key = url.searchParams.get('project');
    const title = `${window.projectData[key].title} — 3D Studio — Kefan Wu`;
    document.title = title;
    if (frame && frameKey === key) {
      if (ready) send({ type: 'location', url: url.href, scrollY: state.scrollY });
      return;
    }
    releaseFrame(); frameKey = key;
    panel.classList.remove('is-ready', 'has-error');
    panel.querySelector('[role="status"]').textContent = 'Opening project…';
    frame = document.createElement('iframe');
    frame.title = title; frame.className = 'studio-project-frame';
    // A new frame's initial URL adds no child-history navigation. Subsequent
    // project changes replace this frame instead of navigating it independently.
    const embedded = new URL(url); embedded.searchParams.set('studioFrame', '1');
    frame.src = embedded.href;
    const expected = frame;
    timer = setTimeout(() => {
      if (frame !== expected || ready || !panel) return;
      panel.classList.add('has-error');
      panel.querySelector('[role="status"]').textContent = 'The project is taking longer to load. You can return to the studio.';
    }, 15000);
    panel.append(frame);
  }
  function navigate(value) {
    const url = route(value); if (!url) return false;
    const state = current();
    if (owned(state) && state.kind === 'project' && state.url === url.href) {
      const next = { ...state, scrollY: undefined };
      write(next, url, true); showProject(next); return true;
    }
    const index = owned(state) ? state.index + 1 : lastIndex + 1;
    const next = { session, kind: 'project', index, url: url.href };
    write(next, url); showProject(next); return true;
  }
  function message(event) {
    if (disposed || !frame || event.origin !== roomURL.origin || event.source !== frame.contentWindow || event.data?.protocol !== PROTOCOL) return;
    const data = event.data, state = current();
    if (!owned(state) || state.kind !== 'project') return;
    if (['navigate', 'return', 'leave'].includes(data.type) && Number.isFinite(data.scrollY) && data.scrollY >= 0) {
      write({ ...state, scrollY: data.scrollY }, state.url, true);
    }
    if (data.type === 'ready') {
      ready = true; clearTimeout(timer); timer = null;
      panel.classList.add('is-ready'); panel.classList.remove('has-error');
      send({ type: 'location', url: state.url, scrollY: state.scrollY });
      frame.focus({ preventScroll: true });
    } else if (data.type === 'title' && typeof data.title === 'string') {
      document.title = data.title; frame.title = data.title;
    } else if (data.type === 'return') returnToRoom();
    else if (data.type === 'navigate') {
      navigate(data.url);
    } else if (data.type === 'scroll' && Number.isFinite(data.scrollY) && data.scrollY >= 0) {
      write({ ...state, scrollY: data.scrollY }, state.url, true);
    } else if (data.type === 'leave') {
      try { const url = new URL(data.url, roomURL); if (['http:', 'https:'].includes(url.protocol)) location.assign(url.href); } catch {}
    }
  }
  function pop() {
    const state = current();
    if (!owned(state)) return;
    lastIndex = state.index;
    if (state.kind === 'project') showProject(state); else showRoom();
  }
  window.addEventListener('message', message); window.addEventListener('popstate', pop);
  return {
    openProject: key => navigate(new URL(`project-3d.html?project=${encodeURIComponent(key)}`, roomURL).href),
    snapshot: () => ({ session, open: !!panel, key: frameKey, ready, historyIndex: current()?.index ?? null }),
    dispose() { disposed = true; showRoom(); window.removeEventListener('message', message); window.removeEventListener('popstate', pop); },
  };
}
