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
    if (typeof scrollY === 'number' && Number.isFinite(scrollY)) {
      window.scrollTo({ top: Math.max(0, scrollY), left: 0, behavior: 'instant' });
      return;
    }
    if (!url.hash) {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      return;
    }
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); }
    catch { id = url.hash.slice(1); }
    document.getElementById(id)?.scrollIntoView({ behavior: 'instant', block: 'start' });
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

  window.addEventListener('project-previews-ready', () => {
    send('title', { title: document.title });
    // The case-study markup is fetched asynchronously, so a parent may request
    // its chapter or saved scroll position before those elements exist.
    applyLocation();
  }, { signal: events.signal });

  send('ready', { url: canonicalURL(location.href).href, title: document.title });
})();
