// Virtual clock for the hero pen checks (prod/merge/harness/film2.cjs): requestAnimationFrame, performance.now, timers and
// Web Animations advance only when window.__film.step(ms) is called. Injected with addInitScript.
(function VT() {
  const Wn = window, nNow = performance.now.bind(performance);
  let vt = nNow(), rid = 0, tid = 0, rq = new Map();
  const tq = new Map(), born = new WeakMap(), mine = new WeakSet();
  const F = (Wn.__film = { vt0: vt, now: () => vt, steps: 0, errors: [] });
  performance.now = () => vt;
  Wn.requestAnimationFrame = (cb) => { const id = ++rid; rq.set(id, cb); return id; };
  Wn.cancelAnimationFrame = (id) => { rq.delete(id); };
  const mk = (cb, ms, a, every) => {
    const id = ++tid, f = typeof cb === 'function' ? cb : () => (0, eval)(String(cb));
    tq.set(id, { due: vt + Math.max(0, +ms || 0), f, a, every, id });
    return id;
  };
  Wn.setTimeout = (cb, ms, ...a) => mk(cb, ms, a, 0);
  Wn.setInterval = (cb, ms, ...a) => mk(cb, ms, a, Math.max(1, +ms || 0));
  Wn.clearTimeout = Wn.clearInterval = (id) => { tq.delete(id); };
  const anims = () => {
    let list = [];
    try { list = document.getAnimations(); } catch (e) { return; }
    for (const an of list) {
      if (!born.has(an)) {
        if (an.playState === 'paused' && !mine.has(an)) continue;
        born.set(an, vt);
      }
      try {
        if (an.playState !== 'paused') { an.pause(); mine.add(an); }
        if (mine.has(an)) an.currentTime = vt - born.get(an);
      } catch (e) {}
    }
  };
  F.step = (dt) => {
    const target = vt + dt;
    for (let guard = 0; guard < 5000; guard++) {
      let best = null;
      for (const t of tq.values()) if (t.due <= target && (!best || t.due < best.due || (t.due === best.due && t.id < best.id))) best = t;
      if (!best) break;
      vt = Math.max(vt, best.due);
      if (best.every) best.due = vt + best.every; else tq.delete(best.id);
      try { best.f(...best.a); } catch (e) { F.errors.push(String(e)); }
    }
    vt = target;
    anims();
    const cbs = [...rq.values()];
    rq = new Map();
    for (const cb of cbs) { try { cb(vt); } catch (e) { F.errors.push(String(e)); } }
    F.steps++;
    return F.rec();
  };
  F.rec = () => {
    const h = Wn.__heroDraw || {}, R = document.documentElement;
    const cv = [...document.querySelectorAll('.hero-draw-lines canvas')], veil = document.querySelector('.hero-draw-veil');
    const bgc = veil ? veil.style.background : null, m = bgc && (/\/ ([0-9.]+)\)/.exec(bgc) || /rgba\([^)]*,\s*([0-9.]+)\)/.exec(bgc));
    return { vt, state: h.state || null, t0: h.t0 == null ? null : h.t0, penT: h.frame ? h.frame.penT : null, live: h.frame ? h.frame.live : null, dens: h.dens == null ? null : +h.dens.toFixed(4),
      op: cv.map((c) => (c.style.opacity === '' ? 1 : +c.style.opacity)), veilA: m ? +m[1] : veil ? 1 : 0, html: R.className, devStart: h.devStart == null ? null : h.devStart,
      inked: R.classList.contains('hero-draw-inked'), settledBy: h.settledBy || null, doneAt: h.doneAt == null ? null : h.doneAt, skipped: h.skipped || 0 };
  };
  F.anims = anims;
})();
