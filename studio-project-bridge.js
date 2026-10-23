/* The retained studio owns browser history while this complete project page
   occupies its frame. Standalone project pages keep their normal navigation. */
(() => {
  'use strict';

  const initialURL = new URL(location.href);
  if (window.parent === window || initialURL.searchParams.get('studioFrame') !== '1') return;

  const protocol = 'kw-studio-project-v1';
  const origin = location.origin;
  const projectPath = initialURL.pathname;
  const roomPath = new URL('experience.html', initialURL).pathname;
  const events = new AbortController();
  let disposed = false;
  let pendingLocation = null;
  let scrollTimer = null;
  // A restored position awaiting the motion story's final layout (see below).
  let settleRestore = null;

  function canonicalURL(value) {
    const url = new URL(value, location.href);
    url.searchParams.delete('studioFrame');
    return url;
  }

  function send(type, detail = {}) {
    if (!disposed) window.parent.postMessage({ protocol, type, ...detail }, origin);
  }

  function applyLocation() {
    if (!pendingLocation || disposed) return;
    const { url, scrollY } = pendingLocation;
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); }
    catch { id = url.hash.slice(1); }
    // replaceState does not emit hashchange. Restore disclosures before either
    // an anchor jump or a saved scroll offset in the recreated project frame.
    if (id) window.dispatchEvent(new CustomEvent('case-reveal-anchor', { detail: { id } }));
    if (typeof scrollY === 'number' && Number.isFinite(scrollY)) {
      window.scrollTo({ top: Math.max(0, scrollY), left: 0, behavior: 'instant' });
    } else if (!url.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    armSettle();
  }

  document.addEventListener('click', (event) => {
    if (disposed || event.defaultPrevented || event.button !== 0 ||
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const link = event.target?.closest?.('a[href]') || event.target?.parentElement?.closest?.('a[href]');
    if (!link || link.hasAttribute('download')) return;
    const target = (link.getAttribute('target') || '').toLowerCase();
    if (target && target !== '_self') return;
    let url;
    try { url = canonicalURL(link.href); }
    catch { return; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    event.preventDefault();
    const scrollY = window.scrollY;
    if (url.origin === origin && url.pathname === projectPath) {
      send('navigate', { url: url.href, scrollY });
    } else if (url.origin === origin && url.pathname === roomPath && url.searchParams.get('return') === 'project') {
      send('return', { scrollY });
    } else {
      send('leave', { url: url.href, scrollY });
    }
  }, { capture: true, signal: events.signal });

  window.addEventListener('message', (event) => {
    if (disposed || event.origin !== origin || event.source !== window.parent ||
        event.data?.protocol !== protocol) return;
    if (event.data.type === 'dispose') {
      // Removing a frame need not provide its controller a pagehide callback.
      window.dispatchEvent(new Event('studio-project-dispose'));
      disposed = true;
      clearTimeout(scrollTimer);
      events.abort();
      return;
    }
    if (event.data.type !== 'location' || typeof event.data.url !== 'string') return;
    let url;
    try { url = canonicalURL(event.data.url); }
    catch { return; }
    const current = canonicalURL(location.href);
    if (url.origin !== origin || url.pathname !== projectPath ||
        url.searchParams.get('project') !== current.searchParams.get('project')) return;
    pendingLocation = { url, scrollY: event.data.scrollY };
    const frameURL = new URL(url);
    frameURL.searchParams.set('studioFrame', '1');
    history.replaceState(history.state, '', frameURL);
    applyLocation();
  }, { signal: events.signal });

  window.addEventListener('scroll', () => {
    if (scrollTimer !== null) return;
    scrollTimer = setTimeout(() => {
      scrollTimer = null;
      send('scroll', { scrollY: window.scrollY });
    }, 150);
  }, { passive: true, signal: events.signal });

  // The pinned motion story lengthens the page once its model is ready, after
  // the first restore; scroll anchoring then carried the reader ~2,000px past
  // the saved offset. Re-apply the same location once, after that final layout
  // (the event does not bubble, so listen in the capture phase). The restore
  // only corrects layout shift: any position the reader chose wins. Input
  // events cancel it, and so does any scroll the page height does not explain
  // (scrollbar drag, find-in-page, screen-reader navigation). That check runs
  // on scroll events only: an anchoring adjustment happens in the layout that
  // changed the height, so its scroll event already sees the new height. No
  // per-frame polling runs while the reader waits.
  const SETTLE_MS = 10000, SETTLE_SLOP = 4;
  const pageHeight = () => document.documentElement?.scrollHeight ?? 0;
  function cancelSettle() { settleRestore = null; }
  function armSettle() {
    settleRestore = { until: Date.now() + SETTLE_MS, height: pageHeight(), y: window.scrollY };
  }
  function checkSettle() {
    const settle = settleRestore;
    if (!settle || disposed) return;
    if (Date.now() > settle.until) { settleRestore = null; return; }
    const height = pageHeight(), y = window.scrollY;
    if (height !== settle.height) { settle.height = height; settle.y = y; }
    else if (Math.abs(y - settle.y) > SETTLE_SLOP) settleRestore = null;
  }
  window.addEventListener('scroll', checkSettle, { passive: true, signal: events.signal });
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    window.addEventListener(type, cancelSettle, { capture: true, passive: true, signal: events.signal });
  }
  window.addEventListener('case-motion-ready', () => {
    if (!settleRestore || disposed || typeof requestAnimationFrame !== 'function') return;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!settleRestore || disposed || Date.now() > settleRestore.until) return;
      cancelSettle();
      applyLocation();
      cancelSettle(); // once per restore: later layout never moves the reader again
    }));
  }, { capture: true, signal: events.signal });

  window.addEventListener('project-previews-ready', () => {
    send('title', { title: document.title });
    // The case-study markup is fetched asynchronously, so a parent may request
    // its chapter or saved scroll position before those elements exist.
    applyLocation();
  }, { signal: events.signal });

  send('ready', { url: canonicalURL(location.href).href, title: document.title });
})();
