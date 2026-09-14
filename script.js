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

/* ============ filters (bounded grid fade, latest intent wins) ============ */

const cards = [...document.querySelectorAll(".project-card")];
const filters = [...document.querySelectorAll(".filter")];
const projectGrid = document.querySelector(".project-grid");

let pendingFilter = null;
let filterJob = null;
let activeFilter = filters.find((button) => button.getAttribute("aria-pressed") === "true") || null;
const realProjectCards = cards.filter((card) => !card.classList.contains("project-card--studio"));
const filterStatus = document.getElementById("filter-status");
const projectSearch = document.getElementById("project-search");
const searchEmpty = document.querySelector(".search-empty");

function applyProjectFilter(button) {
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
  if (filterStatus) filterStatus.textContent = `Showing ${shown} of ${realProjectCards.length} projects`;
  if (searchEmpty) searchEmpty.hidden = shown !== 0;
  scheduleScrollEffects();
}

function finishFilterJob(job) {
  if (filterJob !== job) return;
  clearTimeout(job.timer);
  projectGrid?.classList.remove("is-filtering");
  filterJob = null;
  if (pendingFilter === activeFilter) pendingFilter = null;
  runPendingFilter();
}

function applyLatestFilter(job) {
  if (filterJob !== job) return;
  const button = pendingFilter || job.button;
  job.button = button;
  pendingFilter = null;
  applyProjectFilter(button);
}

function runPendingFilter() {
  if (filterJob || !pendingFilter) return;
  const job = { button: pendingFilter, timer: 0 };
  pendingFilter = null;
  filterJob = job;
  if (!canAnimatePage()) {
    applyLatestFilter(job);
    finishFilterJob(job);
  } else {
    // Fade only the grid: a document view-transition overlay can intercept
    // another native filter click. Further clicks share this 150ms deadline.
    projectGrid?.classList.add("is-filtering");
    job.timer = setTimeout(() => {
      applyLatestFilter(job);
      finishFilterJob(job);
    }, 150);
  }
}

function flushPendingFilter() {
  if (!filterJob) return;
  const job = filterJob;
  applyLatestFilter(job);
  finishFilterJob(job);
}
motionUpdates.add(() => {
  if (!canAnimatePage()) flushPendingFilter();
});
filters.forEach((button) => {
  button.addEventListener("click", () => {
    // Retain the latest intent even if that button still appears active
    // before this fade has applied its first filter (Robotics -> All).
    pendingFilter = button;
    runPendingFilter();
  });
});
projectSearch?.addEventListener("input", () => {
  // Flush the latest category before combining it with the current search.
  flushPendingFilter();
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
