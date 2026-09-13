/* projectData lives in project-data.js (shared with experience.html). */

/* ============ environment ============ */

const body = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const motionUpdates = new Set();
const canAnimatePage = () => !document.hidden && !reducedMotion.matches
  && !body.classList.contains("modal-open");
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
const isInteractiveCardTarget = (event) =>
  Boolean(event.target.closest("a, button, input, select, textarea"));

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
    const searchText = `${card.textContent} ${card.dataset.category || ""}`.toLowerCase();
    const show = categoryMatch && (!query || searchText.includes(query));
    card.classList.toggle("is-hidden", !show);
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

/* ============ project cards: keyboard, tilt, specular ============ */

cards.forEach((card) => {
  let tiltFrame = 0;
  let pointer = null;
  const resetTilt = () => {
    cancelAnimationFrame(tiltFrame);
    tiltFrame = 0;
    pointer = null;
    card.style.transition = "";
    card.style.transform = "";
    card.style.willChange = "";
  };
  const isStudioTile = card.classList.contains("project-card--studio");
  // stretched-link pattern: the h3's .card-open button is the one real
  // control (its ::after overlay covers the whole card), so the download
  // link is a legal sibling instead of an interactive nested in a role=button

  card.addEventListener("pointerenter", () => {
    if (body.classList.contains("editorial") || !finePointer.matches || !canAnimatePage()) return;
    card.style.transition = "border-color 200ms, box-shadow 200ms";
    card.style.willChange = "transform";
  });

  card.addEventListener("pointermove", (event) => {
    if (body.classList.contains("editorial") || !finePointer.matches || !canAnimatePage()) return;
    pointer = { x: event.clientX, y: event.clientY };
    if (tiltFrame) return;
    tiltFrame = requestAnimationFrame(() => {
      tiltFrame = 0;
      if (!pointer || !canAnimatePage()) return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = Math.max(0, Math.min(1, (pointer.x - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (pointer.y - rect.top) / rect.height));
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${(py - 0.5) * -3}deg) rotateY(${(px - 0.5) * 4}deg) translateY(-2px)`;
    });
  });

  card.addEventListener("pointerleave", resetTilt);
  card.addEventListener("pointercancel", resetTilt);
  motionUpdates.add(() => {
    if (!canAnimatePage() || !finePointer.matches) resetTilt();
  });

  if (!isStudioTile) {
    card.querySelector(".card-open")?.addEventListener("click", () => {
      openModal(card.dataset.project, card);
    });
    // convenience: clicks on the card surface (not on a real control) open too
    card.addEventListener("click", (event) => {
      if (isInteractiveCardTarget(event)) return;
      openModal(card.dataset.project, card);
    });
  }

  card.querySelectorAll(".project-download").forEach((link) => {
    link.addEventListener("click", (event) => event.stopPropagation());
    link.addEventListener("keydown", (event) => event.stopPropagation());
  });
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

/* ============ modal ============ */

const modal = document.querySelector("#project-modal");
const modalPanel = modal.querySelector(".modal-panel");
const modalImage = document.querySelector("#modal-image");
const modalKicker = document.querySelector("#modal-kicker");
const modalTitle = document.querySelector("#modal-title");
const modalSummary = document.querySelector("#modal-summary");
const modalHighlights = document.querySelector("#modal-highlights");
const modalTools = document.querySelector("#modal-tools");
const modalDetails = document.querySelector("#modal-details");
const modalGallery = document.querySelector("#modal-gallery");
let lastFocusedElement = null;
let modalOpenPending = false; // an open sequence (view transition) is in flight
let modalOpenedAt = 0; // when the modal DOM last became visible
let mediaSwapTimer = 0;
let modalCloseCleanup = null;
let galleryButtons = [];
const modalBackground = new Map();
modal.inert = modal.getAttribute("aria-hidden") !== "false";
modalPanel.tabIndex = -1;
modalGallery.setAttribute("role", "group");

function setModalBackgroundInert(inert) {
  if (inert) {
    // Walk the ancestor path so moving the dialog into a layout wrapper is safe.
    let branch = modal;
    while (branch.parentElement) {
      [...branch.parentElement.children].forEach((el) => {
        if (el === branch || modalBackground.has(el)) return;
        modalBackground.set(el, el.inert);
        el.inert = true;
      });
      if (branch.parentElement === body) break;
      branch = branch.parentElement;
    }
  } else {
    modalBackground.forEach((value, el) => { el.inert = value; });
    modalBackground.clear();
  }
}

function cancelMediaSwap() {
  clearTimeout(mediaSwapTimer);
  mediaSwapTimer = 0;
  modalImage.classList.remove("is-swapping");
}

function fillList(node, items = []) {
  node.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    })
  );
}

function renderDetails(project) {
  const sections = project.details || [];
  modalDetails.replaceChildren(
    ...sections.map((section) => {
      const block = document.createElement("section");
      block.className = "detail-block";

      const title = document.createElement("h3");
      title.textContent = section.title;

      const list = document.createElement("ul");
      fillList(list, section.points);

      block.append(title, list);
      return block;
    })
  );
}

function showModalMedia(item, projectTitle, instant = false) {
  cancelMediaSwap();
  modalScrub.pause();
  modalImage.hidden = false;
  const alt = item.alt || `${projectTitle} gallery image`;
  if (instant || reducedMotion.matches) {
    modalImage.src = item.src;
    modalImage.alt = alt;
    return;
  }
  modalImage.classList.add("is-swapping");
  mediaSwapTimer = setTimeout(() => {
    mediaSwapTimer = 0;
    modalImage.src = item.src;
    modalImage.alt = alt;
    modalImage.classList.remove("is-swapping");
  }, 200);
}

function selectGalleryButton(index) {
  galleryButtons.forEach((button, i) => {
    const selected = i === index;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
    if (index >= 0) button.tabIndex = selected ? 0 : -1;
  });
}

modalGallery.addEventListener("keydown", (event) => {
  const current = galleryButtons.indexOf(event.target);
  if (current < 0 || event.altKey || event.ctrlKey || event.metaKey) return;
  let next;
  if (event.key === "ArrowRight") next = (current + 1) % galleryButtons.length;
  else if (event.key === "ArrowLeft") next = (current + galleryButtons.length - 1) % galleryButtons.length;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = galleryButtons.length - 1;
  else return;
  event.preventDefault();
  galleryButtons[next].click();
  galleryButtons[next].focus({ preventScroll: true });
  galleryButtons[next].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
  // Revealing a keyboard-selected thumb may scroll the panel. Keep its photo
  // selected until the user actually scrolls to a different position.
  modalScrub.photoScrollTop = modalPanel.scrollTop;
});

function renderGallery(project) {
  const items = project.gallery?.length
    ? project.gallery
    : [{ src: project.image, alt: `${project.title} image`, caption: project.title }];

  galleryButtons = items.map((item, index) => {
    const button = document.createElement("button");
    button.className = "gallery-item";
    button.type = "button";
    button.setAttribute("aria-label", `Show ${item.caption || project.title} image`);
    button.setAttribute("aria-controls", "modal-image");

    const image = document.createElement("img");
    image.src = item.thumbnail || item.src;
    image.alt = item.alt || item.caption || (project.title ? project.title + " image" : "Project image");
    image.loading = "lazy";
    image.decoding = "async";
    button.append(image);

    const caption = document.createElement("span");
    caption.textContent = item.caption || project.title;
    button.append(caption);

    button.addEventListener("click", () => {
      showModalMedia(item, project.title);
      selectGalleryButton(index);
    });
    return button;
  });
  modalGallery.replaceChildren(...galleryButtons);
  selectGalleryButton(0);
}

function openModal(projectKey, sourceCard = null) {
  const project = projectData[projectKey];
  if (!project) return;
  // Re-entry guard: a second click while the open is still in flight (or the
  // modal is already up) must not restart the sequence — restarting the view
  // transition mid-capture flashes and can leave stale view-transition-names.
  if (modalOpenPending || modal.getAttribute("aria-hidden") === "false") return;
  flushPendingFilter();
  modalOpenPending = true;
  lastFocusedElement = sourceCard?.querySelector(".card-open") || document.activeElement;
  const firstItem = project.gallery?.[0] || { src: project.image, alt: `${project.title} case study image` };
  showModalMedia(firstItem, project.title, true);
  modalKicker.textContent = project.kicker;
  modalTitle.textContent = project.title;
  modalSummary.textContent = project.summary;
  const caseLink = document.querySelector("#modal-case-link");
  if (caseLink) {
    const hasCaseStudy = ["steering", "vineRobot", "scanner"].includes(projectKey);
    caseLink.hidden = !hasCaseStudy;
    if (hasCaseStudy) caseLink.href = `case-study.html?project=${projectKey}`;
    else caseLink.removeAttribute("href");
  }
  const studioLink = document.querySelector("#modal-studio-link");
  if (studioLink) {
    // projects flagged noStudio have no 3D exhibit (no model in the scene) —
    // don't offer a link that lands in the studio with nothing to show
    studioLink.hidden = Boolean(project.noStudio);
    studioLink.href = `experience.html#${projectKey}`;
  }
  fillList(modalHighlights, project.highlights);
  fillList(modalTools, project.tools);
  renderDetails(project);
  renderGallery(project);
  modalPanel.scrollTop = 0;
  modalScrub.setup(project.scrub, project);
  const showDom = () => {
    modalOpenPending = false;
    modalOpenedAt = performance.now();
    modal.classList.remove("is-closing");
    modal.inert = false;
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    setModalBackgroundInert(true);
    updateMotion();
    modal.querySelector(".modal-close").focus({ preventScroll: true });
  };
  // shared-element morph: the clicked card's cover glides into the modal hero
  const cardEl = document.querySelector(`.project-card[data-project="${projectKey}"]`);
  const cardImg = cardEl?.querySelector(".card-media img");
  if (document.startViewTransition && !reducedMotion.matches && cardImg) {
    cardImg.style.viewTransitionName = "case-hero";
    modalImage.style.viewTransitionName = "case-hero";
    const transition = document.startViewTransition(() => {
      showDom();
      // "case-hero" must be unique per state: the card cover carries it in
      // the old capture, the modal hero in the new. Both named at once
      // makes the browser abort the morph (duplicate view-transition-name).
      cardImg.style.viewTransitionName = "";
    });
    transition.ready.catch(() => {}); // skipped transitions reject; keep the console clean
    transition.finished.catch(() => {}).finally(() => {
      cardImg.style.viewTransitionName = "";
      modalImage.style.viewTransitionName = "";
    });
  } else {
    // non-Chrome fallback: grow the modal panel from the clicked card's
    // on-screen center; default to a neutral origin for programmatic opens
    if (sourceCard) {
      const r = sourceCard.getBoundingClientRect();
      modalPanel.style.transformOrigin = `${((r.left + r.width / 2) / window.innerWidth) * 100}% ${((r.top + r.height / 2) / window.innerHeight) * 100}%`;
    } else {
      modalPanel.style.transformOrigin = "50% 40%";
    }
    showDom();
  }
}

function closeModal() {
  if (modal.getAttribute("aria-hidden") !== "false" || modalCloseCleanup) return;
  cancelMediaSwap();
  modalScrub.teardown();
  let timer = 0;
  const finish = () => {
    if (modalCloseCleanup !== finish) return;
    clearTimeout(timer);
    modalPanel.removeEventListener("animationend", onAnimationEnd);
    modalCloseCleanup = null;
    modal.classList.remove("is-closing");
    modal.setAttribute("aria-hidden", "true");
    modal.inert = true;
    setModalBackgroundInert(false);
    body.classList.remove("modal-open");
    updateMotion();
    if (lastFocusedElement?.isConnected && !lastFocusedElement.closest("[inert]")) {
      lastFocusedElement.focus({ preventScroll: true });
    }
  };
  const onAnimationEnd = (event) => {
    if (event.target === modalPanel) finish();
  };
  modalCloseCleanup = finish;
  if (reducedMotion.matches || document.hidden) {
    finish();
    return;
  }
  modal.classList.add("is-closing");
  modalPanel.addEventListener("animationend", onAnimationEnd);
  // Safety net if animationend never fires.
  timer = setTimeout(finish, 400);
}
motionUpdates.add(() => {
  if (document.hidden || reducedMotion.matches) modalCloseCleanup?.();
});

// Backdrop dismissal is stricter than the Close button: the press must both
// start and end on the backdrop, and not land in the first beat after the
// modal opened. Without the grace window, the second click of a double-click
// on a project card hits the freshly-mounted backdrop and instantly closes
// the case study the first click just opened ("flash and gone").
const modalBackdrop = modal.querySelector(".modal-backdrop");
let backdropPressStartedHere = false;
modalBackdrop?.addEventListener("pointerdown", (event) => {
  backdropPressStartedHere = event.target === modalBackdrop;
});
modalBackdrop?.addEventListener("pointercancel", () => { backdropPressStartedHere = false; });
modal.querySelectorAll("[data-close-modal]").forEach((element) => {
  element.addEventListener("click", (event) => {
    if (element === modalBackdrop) {
      const startedHere = backdropPressStartedHere;
      backdropPressStartedHere = false;
      if (!startedHere && event.isTrusted) return; // drag out of the panel, not a dismissal
      if (performance.now() - modalOpenedAt < 400) return;
    } else if (event.detail === 0 && performance.now() - modalOpenedAt < 400) {
      // keyboard: opening focuses Close; a held/repeated Enter from the card
      // would otherwise re-fire on the Close button and shut the modal
      return;
    }
    closeModal();
  });
});

// capability "See: ..." proof links open the matching case study directly
document.querySelectorAll("[data-open-project]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    openModal(link.dataset.openProject);
  });
});

document.addEventListener("keydown", (event) => {
  if (modal.getAttribute("aria-hidden") !== "false") return;

  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }

  if (event.key === "Tab") {
    const focusables = [
      ...modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex]')
    ].filter((el) => el.tabIndex >= 0 && !el.matches(":disabled")
      && !el.closest("[hidden], [inert]") && el.getClientRects().length > 0);
    if (!focusables.length) {
      event.preventDefault();
      modalPanel.focus({ preventScroll: true });
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (!focusables.includes(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});
document.addEventListener("focusin", (event) => {
  if (modal.getAttribute("aria-hidden") === "false" && !modal.contains(event.target)) {
    modal.querySelector(".modal-close").focus({ preventScroll: true });
  }
});

/* ============ Exploded-view scroll scrub (inside the case-study modal) ============ */
/* The left modal media is sticky/pinned while the case-study content scrolls.
   For projects with a `scrub` config, that pinned media becomes a CAD viewer
   that advances assembled -> exploded as the user scrolls the modal. */
const modalMedia = modal.querySelector(".modal-media");
const modalScrubImg = document.getElementById("modal-scrub-img");
const modalSpec = document.getElementById("modal-spec");
const modalScrubBar = document.getElementById("modal-scrub-bar");
const modalScrub = {
  active: false,
  paused: false,
  ready: false,
  count: 0,
  base: "",
  frames: null,
  frame: 0,
  mediaVisible: false,
  photoScrollTop: 0,
  lastIdx: -1,
  url(n) {
    return this.base + String(n).padStart(3, "0") + ".webp";
  },
  setup(cfg, project) {
    this.teardown();
    if (!cfg || !modalScrubImg || !modalMedia) return;
    this.active = true;
    this.paused = false;
    this.count = cfg.count;
    this.base = cfg.base;
    this.lastIdx = -1;
    this.renderSpec(project);
    selectGalleryButton(-1);
    modalMedia.classList.add("modal-media--scrub");
    modalMedia.classList.remove("modal-media--scrubbed");
    modalScrubImg.hidden = false;
    modalPanel.addEventListener("scroll", this.onScroll, { passive: true });
    if (reducedMotion.matches) {
      modalScrubImg.src = this.url(cfg.count); // static fully-exploded view
      if (modalScrubBar) modalScrubBar.style.width = "100%";
      return;
    }
    modalScrubImg.src = this.url(1); // start assembled
    this.lastIdx = 1;
    // frames 2..N used to preload HERE — 60 parallel requests (1.4 MB on
    // AURA) the instant the modal opened; they now load on the first scroll
  },
  preload() {
    if (!this.canRender()) return;
    if (!this.frames) {
      this.frames = { images: [], next: 1, inFlight: 0 };
    }
    const batch = this.frames;
    // Bound network/decode work to three frames. Closing, selecting a photo,
    // hiding the page, or scrolling the viewer offscreen stops new requests.
    while (batch.inFlight < 3 && batch.next <= this.count) {
      const index = batch.next++;
      batch.inFlight++;
      const im = new Image();
      im.decoding = "async";
      im.fetchPriority = "low";
      batch.images.push(im);
      const loaded = new Promise((resolve) => {
        im.onload = resolve;
        im.onerror = resolve;
      });
      im.src = this.url(index);
      loaded.then(() => im.decode ? im.decode().catch(() => {}) : undefined).then(() => {
        im.onload = im.onerror = null;
        batch.inFlight--;
        if (this.frames !== batch) return;
        this.ready = batch.next > this.count && batch.inFlight === 0;
        this.preload();
      });
    }
  },
  canRender() {
    return this.active && !this.paused && this.mediaVisible
      && !document.hidden && !reducedMotion.matches;
  },
  cancelFrame() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  },
  schedule() {
    if (!this.canRender() || this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  },
  teardown() {
    this.cancelFrame();
    this.active = false;
    this.paused = false;
    this.frames = null;
    this.ready = false;
    this.smooth = null;
    modalPanel.removeEventListener("scroll", this.onScroll);
    if (modalScrubImg) {
      modalScrubImg.hidden = true;
      modalScrubImg.removeAttribute("src");
    }
    if (modalScrubBar) modalScrubBar.style.width = "0";
    if (modalSpec) {
      modalSpec.replaceChildren();
      modalSpec.hidden = true;
    }
    if (modalMedia) {
      modalMedia.classList.remove("modal-media--scrub", "modal-media--scrubbed");
    }
    modal.classList.remove("modal--scrub");
  },
  renderSpec(project) {
    if (!modalSpec) return;
    const spec = project && project.spec;
    const frag = document.createDocumentFragment();
    if (spec && Array.isArray(spec.meta) && spec.meta.length) {
      const meta = document.createElement("div");
      meta.className = "spec-meta";
      spec.meta.forEach(([k, v]) => {
        const row = document.createElement("div");
        row.className = "spec-row";
        const ks = document.createElement("span");
        ks.textContent = k;
        const vs = document.createElement("b");
        vs.textContent = v;
        row.append(ks, vs);
        meta.append(row);
      });
      frag.append(meta);
    }
    if (spec && Array.isArray(spec.stats) && spec.stats.length) {
      const stats = document.createElement("div");
      stats.className = "spec-stats";
      spec.stats.forEach(([n, k]) => {
        const tile = document.createElement("div");
        tile.className = "spec-tile";
        const ns = document.createElement("span");
        ns.className = "n";
        ns.textContent = n;
        const ks = document.createElement("span");
        ks.className = "k";
        ks.textContent = k;
        tile.append(ns, ks);
        stats.append(tile);
      });
      frag.append(stats);
    }
    if (project && Array.isArray(project.tools) && project.tools.length) {
      const tools = document.createElement("div");
      tools.className = "spec-tools";
      project.tools.forEach((t) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = t;
        tools.append(chip);
      });
      frag.append(tools);
    }
    modalSpec.replaceChildren(frag);
    modalSpec.hidden = false;
    this.smooth = null;
    this.lastIdx = -1;
    modal.classList.add("modal--scrub");
  },
  pause() {
    // Called when a gallery photo is selected: reveal the static photo.
    if (!this.active || this.paused) return;
    this.paused = true;
    this.photoScrollTop = modalPanel.scrollTop;
    this.cancelFrame();
    if (modalScrubImg) modalScrubImg.hidden = true;
    if (modalMedia) modalMedia.classList.add("modal-media--scrubbed");
  },
  resume() {
    if (!this.active || !this.paused) return;
    this.paused = false;
    cancelMediaSwap();
    selectGalleryButton(-1);
    if (modalScrubImg) modalScrubImg.hidden = false;
    this.lastIdx = -1;
    this.schedule();
  },
  progress() {
    const max = modalPanel.scrollHeight - modalPanel.clientHeight;
    if (max <= 0) return 0;
    const range = Math.min(max, modalPanel.clientHeight * 1.25);
    return Math.max(0, Math.min(1, modalPanel.scrollTop / range));
  },
  render() {
    if (!this.canRender()) return;
    const t = this.progress();
    // damped frame glide: fast wheel ticks ease between frames instead of
    // teleporting 8-10 frames — reads like turning a CAD turntable
    const targetIdx = t * (this.count - 1);
    if (this.smooth == null) this.smooth = targetIdx;
    this.smooth += (targetIdx - this.smooth) * 0.24;
    if (Math.abs(targetIdx - this.smooth) < 0.5) this.smooth = targetIdx;
    const idx = Math.round(this.smooth) + 1;
    if (idx !== this.lastIdx) {
      this.lastIdx = idx;
      modalScrubImg.src = this.url(idx);
    }
    if (modalScrubBar) modalScrubBar.style.width = (t * 100).toFixed(1) + "%";
    if (modalMedia) modalMedia.classList.toggle("modal-media--scrubbed", t > 0.04);
    if (this.smooth !== targetIdx) this.schedule();
  },
};
modalScrub.onScroll = function () {
  if (!modalScrub.active || reducedMotion.matches || document.hidden) return;
  if (modalScrub.paused && modalPanel.scrollTop === modalScrub.photoScrollTop) return;
  if (modalScrub.paused) modalScrub.resume();
  modalScrub.preload(); // lazy frame fetch on first scroll (idempotent)
  modalScrub.schedule();
};
const updateScrubMotion = () => {
  modalScrub.cancelFrame();
  if (!modalScrub.active || modalScrub.paused) return;
  if (reducedMotion.matches) {
    modalScrubImg.src = modalScrub.url(modalScrub.count);
    if (modalScrubBar) modalScrubBar.style.width = "100%";
    modalScrub.lastIdx = -1;
    modalScrub.smooth = null;
  } else {
    if (modalScrub.frames) modalScrub.preload();
    modalScrub.schedule();
  }
};
motionUpdates.add(updateScrubMotion);
if (modalMedia) {
  new IntersectionObserver(([entry]) => {
    modalScrub.mediaVisible = entry.isIntersecting;
    updateScrubMotion();
  }, { root: modalPanel }).observe(modalMedia);
}

/* -----------------------------------------------------------------
   Studio hover drift ("Walk the studio" tile)
   On hover / keyboard focus the tile fades in a single still of the
   real 3D studio (assets/studio-hover.webp) with a slow CSS Ken Burns
   drift (.studio-orbit in styles.css) — transform-only, so it can't
   flicker. Frame-sequence loops were tried twice and flickered; don't
   reintroduce them. JS only lazy-injects the layer on first intent so
   mobile / reduced-motion users never download the image; the fade-in
   and the drift are pure CSS (:hover / :focus-visible).
------------------------------------------------------------------ */
(function initStudioOrbit() {
  const tile = document.querySelector(".project-card--studio");
  if (!tile) return;

  let built = false;
  const build = () => {
    if (built || !canAnimatePage() || !finePointer.matches) return;
    built = true;
    const im = new Image();
    im.decoding = "async";
    im.alt = "";
    const insert = () => {
      const layer = document.createElement("div");
      layer.className = "studio-orbit";
      layer.setAttribute("aria-hidden", "true");
      layer.appendChild(im);
      tile.prepend(layer);
      observeAmbientMotion(tile, [im]);
    };
    // insert once loaded so the layer never fades in over a half-loaded
    // image (NOT img.decode() — it can hang for detached images in
    // backgrounded tabs; onload is reliable and the decode cost of a
    // 47KB webp is negligible on first paint)
    im.onload = insert;
    im.onerror = () => { built = false; };
    im.src = "assets/studio-hover.webp";
  };
  tile.addEventListener("pointerenter", build);
  tile.addEventListener("focusin", build);
})();
