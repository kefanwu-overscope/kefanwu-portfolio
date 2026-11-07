/* Homepage navigation is native; case-study pages own project content. */

/* ============ environment ============ */

const body = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const motionUpdates = new Set();
const canAnimatePage = () => !document.hidden && !reducedMotion.matches;
const updateMotion = () => {
  body.classList.toggle("is-page-hidden", document.hidden);
  motionUpdates.forEach((update) => update());
};
body.classList.toggle("is-page-hidden", document.hidden);
document.addEventListener("visibilitychange", updateMotion);
reducedMotion.addEventListener("change", updateMotion);
finePointer.addEventListener("change", updateMotion);

// Restore the CSS play state when a section returns: hover/focus still owns
// its liquid-glass effects. No polling loop or permanently promoted layers.
function observeAmbientMotion(root, elements) {
  if (!root) return;
  let visible = false;
  const originalStates = new Map(elements.map((el) => [el, el.style.animationPlayState]));
  const update = () => {
    const paused = !visible || !canAnimatePage();
    originalStates.forEach((state, el) => {
      el.style.animationPlayState = paused ? "paused" : state;
    });
    root.classList.toggle("is-motion-paused", paused);
  };
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  });
  observer.observe(root);
  motionUpdates.add(update);
  update();
}
observeAmbientMotion(document.querySelector(".hero"), [
  ...document.querySelectorAll(".hero-media img, .hero-skill-track"),
]);

// Slow first visits: a white veil (CSS) over both hero photo layers lifts once
// they decode, instead of a hard cut. Cached photos and reduced motion skip it;
// the photo pixels and the LCP image paint are untouched.
const heroMedia = document.querySelector(".white-home .hero-media");
const heroPhotos = heroMedia ? [...heroMedia.querySelectorAll("img")] : [];
if (heroPhotos.length && !reducedMotion.matches
  && !heroPhotos.every((img) => img.complete && img.naturalWidth > 0)) {
  heroMedia.classList.add("is-photo-pending");
  let revealed = false;
  const revealHero = () => {
    if (revealed) return;
    revealed = true;
    requestAnimationFrame(() => {
      heroMedia.classList.add("is-photo-ready");
      heroMedia.classList.remove("is-photo-pending");
    });
  };
  Promise.all(heroPhotos.map((img) => img.decode().catch(() => {}))).then(revealHero);
  setTimeout(revealHero, 4000); // never leave the photo hidden on a stalled decode
}

window.addEventListener("load", () => body.classList.add("is-loaded"));
// Fallback in case load already fired or assets stall.
setTimeout(() => body.classList.add("is-loaded"), 900);

/* ============ scroll effects (rAF-gated) ============ */

const progress = document.querySelector(".progress");
const header = document.querySelector(".site-header");
const scrollCue = document.querySelector(".scroll-cue");
const parallaxImgs = [...document.querySelectorAll("[data-parallax]")];
let scrollFrame = 0;
const visibleParallax = new Set();
const parallaxObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target, isIntersecting }) => {
    if (isIntersecting) visibleParallax.add(target);
    else visibleParallax.delete(target);
  });
  scheduleScrollEffects();
}, { rootMargin: "80px" });
parallaxImgs.forEach((img) => parallaxObserver.observe(img));

function updateScrollEffects() {
  if (document.hidden) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? window.scrollY / max : 0;
  // Read all visible geometry before writing transforms/classes.
  const transforms = canAnimatePage() ? [...visibleParallax].map((img) => {
    const rect = img.getBoundingClientRect();
    const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
    return [img, `translateY(${(-offset * 14).toFixed(2)}px) scale(1.06)`];
  }) : [];
  if (progress) progress.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  header?.classList.toggle("is-scrolled", window.scrollY > 24);
  transforms.forEach(([img, transform]) => { img.style.transform = transform; });
}

function scheduleScrollEffects() {
  if (scrollFrame || document.hidden) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = 0;
    updateScrollEffects();
  });
}
window.addEventListener("scroll", scheduleScrollEffects, { passive: true });
window.addEventListener("resize", scheduleScrollEffects);
if (window.ResizeObserver) {
  new ResizeObserver(scheduleScrollEffects).observe(document.body);
}
motionUpdates.add(() => {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  if (reducedMotion.matches) parallaxImgs.forEach((img) => { img.style.transform = ""; });
  scheduleScrollEffects();
});
updateScrollEffects();

const onCueScroll = () => {
  if (window.scrollY > 80) {
    scrollCue?.classList.add("is-gone");
    window.removeEventListener("scroll", onCueScroll);
  }
};
window.addEventListener("scroll", onCueScroll, { passive: true });

/* ============ mobile nav ============ */

const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");
const mobileNav = window.matchMedia("(max-width: 720px)");

function setNavOpen(open) {
  navToggle?.setAttribute("aria-expanded", String(open));
  nav?.classList.toggle("is-open", open);
  if (nav) nav.inert = mobileNav.matches && !open;
}
setNavOpen(false);
mobileNav.addEventListener("change", () => setNavOpen(false));

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  setNavOpen(!isOpen);
});

nav?.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    setNavOpen(false);
  }
});
function onNavKeydown(event) {
  if (event.key !== "Escape" || navToggle?.getAttribute("aria-expanded") !== "true") return;
  event.preventDefault();
  setNavOpen(false);
  navToggle.focus({ preventScroll: true });
}
nav?.addEventListener("keydown", onNavKeydown);
navToggle?.addEventListener("keydown", onNavKeydown);
header?.addEventListener("focusout", (event) => {
  if (mobileNav.matches && !header.contains(event.relatedTarget)) setNavOpen(false);
});

/* ============ scrollspy (current section in nav) ============ */

const spyLinks = new Map(
  [...document.querySelectorAll('#site-nav a[href^="#"]')].map((a) => [
    a.getAttribute("href").slice(1),
    a,
  ])
);

let spyObserver;
function configureScrollSpy() {
  spyObserver?.disconnect();
  spyObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      spyLinks.forEach((link, id) => {
        const current = id === entry.target.id;
        link.classList.toggle("is-current", current);
        if (current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    });
  },
  { rootMargin: `-${Math.round(innerHeight * .35)}px 0px -${Math.round(innerHeight * .60)}px 0px` }
);

spyLinks.forEach((link, id) => {
  const section = document.getElementById(id);
  if (section) spyObserver.observe(section);
});
}
configureScrollSpy();
let spyResizeFrame = 0;
window.addEventListener("resize", () => {
  cancelAnimationFrame(spyResizeFrame);
  spyResizeFrame = requestAnimationFrame(configureScrollSpy);
});

/* ============ reveal system with stagger ============ */

document.querySelectorAll("[data-reveal-group]").forEach((group) => {
  [...group.querySelectorAll("[data-reveal], .project-card")].forEach((el, index) => {
    el.style.setProperty("--i", index);
  });
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const el = entry.target;
        el.classList.add("is-visible");
        // Clear the stagger delay once revealed so hover states stay snappy.
        el.addEventListener(
          "transitionend",
          () => el.classList.add("is-settled"),
          { once: true }
        );
        revealObserver.unobserve(el);
      }
    });
  },
  { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
);

document
  .querySelectorAll("[data-reveal], .project-grid .project-card")
  .forEach((element) => revealObserver.observe(element));

/* ============ stat counters (count up on first view) ============ */

const activeCounters = new Map();
const finishCounter = (el) => {
  const animation = activeCounters.get(el);
  if (!animation) return;
  clearTimeout(animation.timer);
  cancelAnimationFrame(animation.frame);
  el.textContent = animation.finalText;
  activeCounters.delete(el);
  counterObserver.unobserve(el);
};
motionUpdates.add(() => {
  if (!canAnimatePage()) [...activeCounters.keys()].forEach(finishCounter);
});
const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      const el = entry.target;
      if (!entry.isIntersecting) {
        finishCounter(el);
        return;
      }
      if (activeCounters.has(el)) return;
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      if (!canAnimatePage()) {
        el.textContent = target.toFixed(decimals);
        counterObserver.unobserve(el);
        return;
      }
      // hero stats sit behind a staged reveal — hold the count until the bar
      // is actually visible, then roll statelier than the in-page counters
      const inHero = Boolean(el.closest(".hero-stats"));
      const duration = inHero ? 1200 : 900;
      const delay = inHero ? 1000 : 0;
      const ease = inHero
        ? (t) => 1 - Math.pow(1 - t, 4)
        : (t) => 1 - Math.pow(1 - t, 3);
      const animation = { timer: 0, frame: 0, finalText: target.toFixed(decimals) };
      activeCounters.set(el, animation);
      animation.timer = setTimeout(() => {
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          el.textContent = (target * ease(p)).toFixed(decimals);
          if (p < 1) animation.frame = requestAnimationFrame(tick);
          else finishCounter(el);
        };
        animation.frame = requestAnimationFrame(tick);
      }, delay);
    });
  },
  { threshold: 0.5 }
);

document.querySelectorAll("[data-count]").forEach((el) => {
  el.textContent = (0).toFixed(parseInt(el.dataset.decimals || "0", 10));
  counterObserver.observe(el);
});

/* ============ filters (applied on the click itself) ============ */

const cards = [...document.querySelectorAll(".project-card")];
const filters = [...document.querySelectorAll(".filter")];

let activeFilter = filters.find((button) => button.getAttribute("aria-pressed") === "true") || null;
const realProjectCards = cards.filter((card) => !card.classList.contains("project-card--studio"));
const filterStatus = document.getElementById("filter-status");
const projectSearch = document.getElementById("project-search");
const searchEmpty = document.querySelector(".search-empty");

// Filter motion (FLIP): cards that stay glide from where they were to their new places (a card
// that would travel more than 0.8 of a screen fades in at its new place instead of whooshing
// across the page), leaving cards fade out where they stood, entering cards fade in (never
// re-drawn: the first filter or search use ends the card drawing, card-drawing-20261027.js).
// The glide animates the individual `translate` property because editorial.css pins
// `transform: none !important` on cards, which would override an animation. Every inline style
// it sets is removed again when it ends, and a click mid-motion starts from where every card is
// on screen. Reduced motion, a hidden page,
// ?cards=static and browsers without `translate` keep the instant change.
const projectGrid = document.getElementById("project-cards");
const FLIP_EASE = "cubic-bezier(.65, 0, .35, 1)";
const FLIP_MS = 320;
const LEAVE_MS = 160;
const ENTER_MS = 240;
const ENTER_DELAY = 80;
const JUMP_FADE_MS = 200;   // a long jump (> 0.8 screens) fades in at its new place
const JUMP_SCREENS = 0.8;
const LEAVE_STYLE = ["position", "left", "top", "width", "height", "margin", "display", "box-sizing", "pointer-events"];
const flipSupported = Boolean(projectGrid && Element.prototype.animate && window.CSS?.supports?.("translate", "1px 1px"))
  && !/[?&]cards=static(&|$)/.test(location.search);
const flipping = new Map(); // card -> { anims, leaving }

const dropEmptyStyle = (el) => { if (!el.getAttribute("style")) el.removeAttribute("style"); };
function endLeave(card) {
  LEAVE_STYLE.forEach((prop) => card.style.removeProperty(prop));
  card.inert = false;
  dropEmptyStyle(card);
}
function stopFlip() {
  flipping.forEach((motion, card) => {
    motion.anims.forEach((animation) => animation.cancel());
    if (motion.leaving) endLeave(card);
  });
  flipping.clear();
  if (projectGrid) {
    projectGrid.style.removeProperty("position");
    dropEmptyStyle(projectGrid);
  }
}
function trackFlip(card, animation, leaving = false) {
  const motion = flipping.get(card) || { anims: [], leaving };
  motion.anims.push(animation);
  flipping.set(card, motion);
  animation.finished.then(() => {
    if (flipping.get(card) !== motion) return;
    motion.anims = motion.anims.filter((item) => item !== animation);
    if (motion.anims.length) return;
    flipping.delete(card);
    if (motion.leaving) {
      animation.cancel();
      endLeave(card);
    }
    if (![...flipping.values()].some((item) => item.leaving) && projectGrid) {
      projectGrid.style.removeProperty("position");
      dropEmptyStyle(projectGrid);
    }
  }, () => {});
}
// First: where every shown card (or card still fading out) is on screen right now.
function flipFirst() {
  const first = new Map();
  cards.forEach((card) => {
    const motion = flipping.get(card);
    if (card.classList.contains("is-hidden") && !motion?.leaving) return;
    first.set(card, {
      rect: card.getBoundingClientRect(),
      opacity: motion ? Number(getComputedStyle(card).opacity) : 1,
      leaving: Boolean(motion?.leaving),
    });
  });
  return first;
}
function flipPlay(first) {
  const leaving = [];
  const staying = [];   // shown before and after (including a card that was still fading out)
  const entering = [];  // newly shown: fades in where it lands
  cards.forEach((card) => {
    const shown = !card.classList.contains("is-hidden");
    const before = first.get(card);
    if (shown && before) staying.push([card, before]);
    else if (shown) entering.push(card);
    else if (before) leaving.push([card, before]);
  });
  // Leaving cards stay where they stood, out of the flow, while they fade.
  if (leaving.length) {
    projectGrid.style.position = "relative";
    const box = projectGrid.getBoundingClientRect();
    const left = box.left + projectGrid.clientLeft;
    const top = box.top + projectGrid.clientTop;
    leaving.forEach(([card, { rect }]) => {
      Object.assign(card.style, {
        position: "absolute", left: `${rect.left - left}px`, top: `${rect.top - top}px`,
        width: `${rect.width}px`, height: `${rect.height}px`, margin: "0",
        display: "grid", boxSizing: "border-box", pointerEvents: "none",
      });
      card.inert = true;
    });
  }
  // Last: read every new position before starting any animation.
  const moves = staying.map(([card, before]) => {
    const after = card.getBoundingClientRect();
    return [card, before.rect.left - after.left, before.rect.top - after.top, before.opacity];
  });
  leaving.forEach(([card, { opacity }]) => {
    trackFlip(card, card.animate([{ opacity }, { opacity: 0 }],
      { duration: Math.max(1, LEAVE_MS * opacity), easing: FLIP_EASE, fill: "forwards" }), true);
  });
  // A card caught mid-fade (still entering, or fading out and now shown again) glides from where
  // it is on screen and continues its fade from its current opacity: no jump, no snap. A card
  // that would glide more than 0.8 of a screen fades in where it lands instead.
  const far = JUMP_SCREENS * window.innerHeight;
  moves.forEach(([card, dx, dy, opacity]) => {
    if (Math.hypot(dx, dy) > far) {
      trackFlip(card, card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: JUMP_FADE_MS, easing: FLIP_EASE }));
      return;
    }
    if (Math.abs(dx) >= 0.5 || Math.abs(dy) >= 0.5) {
      trackFlip(card, card.animate([{ translate: `${dx}px ${dy}px` }, { translate: "0px 0px" }],
        { duration: FLIP_MS, easing: FLIP_EASE }));
    }
    if (opacity < 0.999) {
      trackFlip(card, card.animate([{ opacity }, { opacity: 1 }],
        { duration: Math.max(1, ENTER_MS * (1 - opacity)), easing: FLIP_EASE }));
    }
  });
  entering.forEach((card) => {
    trackFlip(card, card.animate([{ opacity: 0 }, { opacity: 1 }],
      { duration: ENTER_MS, delay: ENTER_DELAY, easing: FLIP_EASE, fill: "backwards" }));
  });
}
motionUpdates.add(() => { if (!canAnimatePage()) stopFlip(); });

function applyProjectFilter(button) {
  const animateFilter = flipSupported && canAnimatePage();
  const first = animateFilter ? flipFirst() : null;
  stopFlip();
  activeFilter = button;
  const filter = button.dataset.filter;
  const query = (projectSearch?.value || "").trim().toLowerCase();
  filters.forEach((item) => {
    const isActive = item === button;
    item.classList.toggle("active", isActive);
    item.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
  cards.forEach((card) => {
    // The studio tile stays visible under every filter.
    const categoryMatch = filter === "all"
      || card.classList.contains("project-card--studio")
      || (card.dataset.category || "").split(/\s+/).includes(filter);
    const searchText = `${card.querySelector(".project-body")?.textContent || card.textContent} ${card.dataset.category || ""}`.toLowerCase();
    const show = categoryMatch && (!query || searchText.includes(query));
    card.classList.toggle("is-hidden", !show);
    if (!show) window.cardExplosions?.reset(card, true);
  });
  const shown = realProjectCards.filter((card) => !card.classList.contains("is-hidden")).length;
  if (filterStatus) {
    filterStatus.textContent = `Showing ${shown} of ${realProjectCards.length} projects`;
    // Visible only while a category or search narrows the grid; always announced.
    filterStatus.classList.toggle("is-idle", filter === "all" && !query);
  }
  if (searchEmpty) searchEmpty.hidden = shown !== 0;
  if (first) flipPlay(first);
  scheduleScrollEffects();
}

// The former 150 ms grid fade never ran (editorial.css keeps cards opaque), so
// it only delayed the change. Apply each click at once; the latest click wins
// (the FLIP above animates from wherever the previous change left every card).
filters.forEach((button) => {
  button.addEventListener("click", () => applyProjectFilter(button));
});
projectSearch?.addEventListener("input", () => {
  if (activeFilter) applyProjectFilter(activeFilter);
});

/* ============ magnetic buttons ============ */

document.querySelectorAll("[data-magnetic]").forEach((el) => {
  let frame = 0;
  let timer = 0;
  let pointer = null;
  const reset = () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    frame = 0;
    pointer = null;
    el.style.transform = "";
    el.style.transition = "";
  };
  el.addEventListener("pointerenter", () => {
    if (!finePointer.matches || !canAnimatePage()) return;
    clearTimeout(timer);
    // soften the first movement so the pull eases in instead of stepping
    el.style.transition = "transform 160ms cubic-bezier(0.33, 1, 0.68, 1)";
    timer = setTimeout(() => { el.style.transition = ""; }, 180);
  });
  el.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || !canAnimatePage()) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!pointer || !canAnimatePage()) return;
      const rect = el.getBoundingClientRect();
      const dx = pointer.x - rect.left - rect.width / 2;
      const dy = pointer.y - rect.top - rect.height / 2;
      const clamp = (v, m) => Math.max(-m, Math.min(m, v));
      el.style.transform = `translate(${clamp(dx * 0.08, rect.width * 0.06)}px, ${clamp(dy * 0.12, rect.height * 0.12)}px)`;
    });
  });
  el.addEventListener("pointerleave", () => {
    reset();
    if (!finePointer.matches || !canAnimatePage()) return;
    el.style.transition = "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)";
    timer = setTimeout(() => { el.style.transition = ""; }, 320);
  });
  el.addEventListener("pointercancel", reset);
  motionUpdates.add(() => {
    if (!canAnimatePage() || !finePointer.matches) reset();
  });
});
