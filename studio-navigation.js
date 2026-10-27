const PROTOCOL = 'kw-studio-project-v1';
const STATE = 'studioNavigation';
const TRANSITION_MS = 200;
const FRAME_REVEAL_MS = 180;
// 2026-10-24 (M3): the panel is the detail page's white (studio-navigation.css).
// Returning hides the page content at once and lifts that plain white curtain
// off the already-painted room, so the page never double-exposes over it.
const RETURN_MS = 240;
const ENTER_EASE = 'cubic-bezier(.22, 1, .36, 1)';
const RETURN_EASE = 'cubic-bezier(.33, 1, .68, 1)'; // ease-out (cubic)
// Opening: the room fades to plain white first; a frame that is ready sooner
// waits (transparent) until the panel's entry fade has finished, then fades
// in on the opaque white panel, so no frame shows the page over the room.

// The loaded room remains the top-level document during project visits. One
// disposable frame hosts the existing full project page; only this controller
// owns history, so chapter/next-project links cannot add hidden frame entries.
export function createStudioNavigation({ onActiveChange = () => {} } = {}) {
  const roomURL = new URL(location.href);
  const projectPath = new URL('project-3d.html', roomURL).pathname;
  const roomTitle = document.title;
  const session = crypto.randomUUID();
  let panel = null, frame = null, frameKey = null, ready = false, pendingReady = false, timer = null;
  let savedFocus = null, hiddenElements = [], lastIndex = 0, disposed = false;
  let active = false, returning = false, panelTransition = null, frameTransition = null, returnPaint = null;
  let frameRevealWaiting = false;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
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
  function setActive(value) {
    if (active === value) return;
    active = value; onActiveChange(value);
  }
  function fade(element, from, to, duration, complete = () => {}, easing = ENTER_EASE) {
    element.style.opacity = String(to);
    if (motion?.matches || document.hidden || !element.animate) { complete(); return null; }
    const animation = element.animate([{ opacity: from }, { opacity: to }], {
      duration, easing, fill: 'both',
    });
    let settled = false;
    const cancel = () => {
      if (settled) return false;
      settled = true; animation.onfinish = null; animation.cancel(); return true;
    };
    const finish = () => { if (cancel()) complete(); };
    animation.onfinish = finish;
    return { cancel, finish };
  }
  const panelOpacity = () => Number.parseFloat(window.getComputedStyle(panel).opacity);
  function cancelReturnPaint() {
    if (returnPaint !== null) window.cancelAnimationFrame(returnPaint);
    returnPaint = null;
  }
  function enterPanel(from = 0) {
    panelTransition?.cancel();
    panelTransition = fade(panel, from, 1, TRANSITION_MS, () => {
      panelTransition = null;
      if (panel && !returning) document.body.classList.add('studio-project-covered');
      if (frameRevealWaiting && panel && !returning) fadeInFrame();
    });
  }
  function fadeInFrame() {
    frameRevealWaiting = false;
    if (!frame) return;
    frameTransition?.cancel();
    frameTransition = fade(frame, 0, 1, FRAME_REVEAL_MS, () => { frameTransition = null; });
  }
  function releaseFrame() {
    clearTimeout(timer); timer = null;
    frameTransition?.cancel(); frameTransition = null; frameRevealWaiting = false;
    // Synchronous cleanup is deliberate: a queued postMessage can be discarded
    // when its browsing context is removed in the same task.
    try { const child = frame?.contentWindow; child?.dispatchEvent(new child.Event('studio-project-dispose')); } catch {}
    frame?.remove(); frame = null; frameKey = null; ready = false; pendingReady = false;
  }
  function finishRoom() {
    if (!panel) return;
    cancelReturnPaint(); panelTransition?.cancel(); panelTransition = null;
    releaseFrame(); panel.remove(); panel = null;
    returning = false;
    document.body.classList.remove('studio-project-open', 'studio-project-covered');
    for (const [element, wasInert, aria] of hiddenElements) {
      element.inert = wasInert;
      if (aria === null) element.removeAttribute('aria-hidden'); else element.setAttribute('aria-hidden', aria);
    }
    hiddenElements = [];
    document.title = roomTitle;
    setActive(false);
    if (savedFocus?.isConnected && !savedFocus.inert) savedFocus.focus({ preventScroll: true });
    else document.getElementById('exp-canvas')?.focus({ preventScroll: true });
  }
  function showRoom(immediate = false) {
    if (!panel) return;
    if (immediate) { finishRoom(); return; }
    if (returning) return;
    returning = true;
    const from = panel.animate ? panelOpacity() : 1;
    panelTransition?.cancel(); panelTransition = null;
    panel.style.opacity = String(from);
    panel.inert = true;
    panel.classList.add('is-returning');
    document.title = roomTitle;
    document.body.classList.remove('studio-project-covered');
    // Resume and paint the retained canvas behind the still-white curtain.
    // Removing the frame first can expose a blank WebGL buffer for one paint.
    setActive(false);
    const reveal = () => {
      returnPaint = null;
      if (!returning || !panel) return;
      panelTransition = fade(panel, from, 0, RETURN_MS, finishRoom, RETURN_EASE);
    };
    if (document.hidden || !panel.animate) { reveal(); return; }
    returnPaint = window.requestAnimationFrame(() => {
      returnPaint = window.requestAnimationFrame(reveal);
    });
  }
  function returnToRoom() {
    const state = current();
    if (owned(state) && state.index > 0) history.go(-state.index);
    else { write({ session, kind: 'room', index: 0 }, roomURL, true); showRoom(); }
  }
  function createPanel() {
    if (panel) {
      if (returning) {
        const from = panel.animate ? panelOpacity() : 1;
        cancelReturnPaint(); returning = false; panel.inert = false;
        panel.classList.remove('is-returning');
        setActive(true); enterPanel(from);
        (ready ? frame : panel.querySelector('button'))?.focus({ preventScroll: true });
      }
      return;
    }
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
    back.focus({ preventScroll: true }); setActive(true); enterPanel();
  }
  function revealFrame(state) {
    ready = true; pendingReady = false; clearTimeout(timer); timer = null;
    panel.classList.add('is-ready'); panel.classList.remove('has-error');
    frame.inert = false;
    if (panelTransition || returning) {
      // is-ready shows the frame at opacity 1; hold it transparent meanwhile.
      frameRevealWaiting = true;
      frame.style.opacity = '0';
    } else fadeInFrame();
    send({ type: 'location', url: state.url, scrollY: state.scrollY });
    frame.focus({ preventScroll: true });
  }
  function showProject(state) {
    const url = route(state.url);
    if (!url) { returnToRoom(); return; }
    createPanel();
    const key = url.searchParams.get('project');
    const title = `${window.projectData[key].title} — 3D Studio — Kefan Wu`;
    document.title = title;
    if (frame && frameKey === key) {
      if (pendingReady) revealFrame(state);
      else if (ready) send({ type: 'location', url: url.href, scrollY: state.scrollY });
      return;
    }
    releaseFrame(); frameKey = key;
    panel.classList.remove('is-ready', 'has-error');
    panel.querySelector('[role="status"]').textContent = 'Opening project…';
    panel.querySelector('button')?.focus({ preventScroll: true });
    frame = document.createElement('iframe');
    frame.inert = true;
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
    if (disposed) return false;
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
    if (!owned(state)) return;
    if (state.kind !== 'project') {
      // Forward may reuse this frame before the return fade has disposed it.
      // Remember its one-shot ready message without changing the fading page.
      if (returning && data.type === 'ready') pendingReady = true;
      return;
    }
    if (['navigate', 'return', 'leave'].includes(data.type) && Number.isFinite(data.scrollY) && data.scrollY >= 0) {
      write({ ...state, scrollY: data.scrollY }, state.url, true);
    }
    if (data.type === 'ready') {
      if (ready) return;
      revealFrame(state);
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
  function settleMotion() {
    if (!motion?.matches && !document.hidden) return;
    if (returning && document.hidden) finishRoom();
    panelTransition?.finish(); frameTransition?.finish();
  }
  window.addEventListener('message', message); window.addEventListener('popstate', pop);
  motion?.addEventListener('change', settleMotion);
  document.addEventListener?.('visibilitychange', settleMotion);
  return {
    openProject: key => navigate(new URL(`project-3d.html?project=${encodeURIComponent(key)}`, roomURL).href),
    snapshot: () => ({ session, open: !!panel, key: frameKey, ready, historyIndex: current()?.index ?? null,
      phase: !panel ? 'room' : returning ? 'returning' : frameTransition ? 'revealing' : panelTransition || frameRevealWaiting ? 'entering' : ready ? 'project' : 'loading',
      reducedMotion: !!motion?.matches, transitionMs: TRANSITION_MS, frameRevealMs: FRAME_REVEAL_MS, returnMs: RETURN_MS }),
    dispose() {
      disposed = true; showRoom(true);
      window.removeEventListener('message', message); window.removeEventListener('popstate', pop);
      motion?.removeEventListener('change', settleMotion);
      document.removeEventListener?.('visibilitychange', settleMotion);
    },
  };
}
