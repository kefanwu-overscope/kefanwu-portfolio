/* projectData lives in project-data.js (shared with experience.html). */

/* ============ environment ============ */

const body = document.body;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

window.addEventListener("load", () => body.classList.add("is-loaded"));
// Fallback in case load already fired or assets stall.
setTimeout(() => body.classList.add("is-loaded"), 900);

/* ============ hero skill glass cards ============ */

const heroSkillDetails = {
  arduino: {
    title: "Arduino",
    meta: "Embedded prototyping",
    image: "assets/skill-arduino-online.jpg",
    alt: "Arduino Uno development board",
    text:
      "Fast control loops for sensors, motors, and bench prototypes when a mechanical idea needs physical feedback quickly."
  },
  "tig welding": {
    title: "TIG Welding",
    meta: "Precision fabrication",
    image: "assets/skill-tig-welding.jpg",
    alt: "TIG welding operation on metal tubing",
    text:
      "Clean welded joints for brackets, fixtures, and motorsport hardware where heat control and fit-up matter."
  },
  autocad: {
    title: "AutoCAD",
    meta: "Fabrication drawings",
    image: "https://paintingvalley.com/drawings/autocad-mechanical-drawings-34.png",
    alt: "Mechanical CAD drawing with dimensions",
    text:
      "2D layouts, DXF cleanup, shop-ready profiles, and fabrication handoff details before parts hit the machine."
  },
  "topology study": {
    title: "Topology Study",
    meta: "Load-path exploration",
    image: "https://www.comsol.com/model/image/69891/big.png",
    alt: "Bracket topology optimization result",
    text:
      "Constraint-first material studies that reveal load paths before committing weight and geometry in final CAD."
  },
  solidworks: {
    title: "SolidWorks",
    meta: "Parametric CAD",
    image: "assets/cover-steering-system-cad.webp",
    alt: "SolidWorks CAD render of the Mk.8 steering column assembly",
    text:
      "Assemblies, packaging studies, drawings, and design reviews that connect concept geometry to buildable hardware."
  },
  matlab: {
    title: "MATLAB",
    meta: "Engineering models",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Matlab%20Logo.png?width=900",
    alt: "MATLAB membrane logo image",
    text:
      "Parameter sweeps, kinematics, thermal models, and plots that turn assumptions into traceable decisions."
  },
  fea: {
    title: "FEA",
    meta: "Structural validation",
    image: "https://efficientengineer.com/wp-content/uploads/equivalent_stress_bracket-1.jpg",
    alt: "Finite element analysis stress result on a cantilever bracket",
    text:
      "Stress and stiffness checks for seats, mounts, brackets, and motorsport hardware under explicit load cases."
  },
  cfd: {
    title: "CFD",
    meta: "Flow-aware design",
    image: "assets/ansys-cfd-pressure.webp",
    alt: "Ansys CFD pressure-field result over a VTOL drone body",
    text:
      "Flow and pressure tradeoff thinking for cooling, bodywork, and geometry choices where air becomes a design constraint."
  },
  "cnc mill": {
    title: "CNC Mill",
    meta: "Precision machining",
    image: "assets/skill-cnc-mill.jpg",
    alt: "CNC milling machine cutting metal with coolant",
    text:
      "Machined interfaces, bearing cages, mounts, and tolerance-critical details where fit and repeatability matter."
  },
  lathe: {
    title: "Lathe",
    meta: "Round hardware",
    image: "assets/skill-lathe.jpg",
    alt: "Metal lathe turning a shiny workpiece in the chuck",
    text:
      "Shafts, spacers, bushings, and clean rotational fits for steering, drivetrain, and assembly hardware."
  },
  waterjet: {
    title: "Waterjet",
    meta: "Flat-pattern fabrication",
    image: "https://www.emachineshop.com/wp-content/uploads/Waterjet-Cutting-1-1.jpg",
    alt: "Waterjet cutting head cutting a metal sheet",
    text:
      "Fast plate and bracket manufacturing for seats, mounts, fixtures, and chassis-adjacent hardware."
  },
  "carbon fiber": {
    title: "Carbon Fiber",
    meta: "Composite structures",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/FibreDeCarbone.jpg?width=900",
    alt: "Close view of woven carbon fiber",
    text:
      "Layup, trimming, support geometry, and lightweight structure decisions for motorsport packaging."
  },
  "team management": {
    title: "Team Management",
    meta: "Engineering leadership",
    image: "assets/skill-team-management.jpg",
    alt: "Olin Electric Motorsports team standing with the race car",
    text:
      "Task breakdown, design reviews, fabrication planning, and cross-team execution from CAD to tested assemblies."
  },
  "ai-assisted eng": {
    title: "AI-Assisted Engineering",
    meta: "PyFluent / headless CFD / automation",
    image: "assets/skill-vibe-coding.jpg",
    alt: "Code on a dark screen with blue and red ambient lighting",
    text:
      "AI-paired engineering automation — working scripts, tools, and pipelines for simulation (headless Ansys via PyFluent), data wrangling, and hardware workflows."
  },
  "3d printing": {
    title: "3D Printing",
    meta: "Rapid prototyping",
    image: "assets/skill-3d-printing.jpg",
    alt: "3D printer in operation under colored ambient lighting",
    text:
      "FDM prints for fixtures, jigs, housings, and functional prototypes — from tolerance-aware design to support strategy and finish."
  },
  "esp32": {
    title: "ESP32",
    meta: "Embedded compute",
    image: "assets/skill-esp32.jpg",
    alt: "ESP32 microcontroller development board on a dark background",
    text:
      "Wi-Fi-capable microcontroller for sensor fusion, motor control, and data logging across robotics and instrumentation builds."
  },
  "embedded sensors": {
    title: "Embedded Sensors",
    meta: "Sensing and feedback",
    image: "assets/line-follower-white.webp",
    alt: "Robot packed with sensors and wiring",
    text:
      "LiDAR, encoders, reflectance arrays, and IMUs integrated with calibration and noise control for closed-loop robotics."
  }
};

function initHeroSkillCards() {
  const skillItems = [
    ...document.querySelectorAll(".hero-skill-track span"),
    ...document.querySelectorAll(".matrix-cell li"),
  ];
  if (!skillItems.length) return;

  const card = document.createElement("aside");
  card.className = "skill-glass-card";
  card.setAttribute("aria-hidden", "true");
  card.innerHTML = `
    <div class="skill-card-inner">
      <div class="skill-card-media"><img alt="" decoding="async" /></div>
      <div class="skill-card-content">
        <p class="skill-card-kicker"></p>
        <h2></h2>
        <p class="skill-card-text"></p>
      </div>
    </div>
  `;
  document.body.append(card);

  const cardImage = card.querySelector("img");
  const cardKicker = card.querySelector(".skill-card-kicker");
  const cardTitle = card.querySelector("h2");
  const cardText = card.querySelector(".skill-card-text");
  let activeItem = null;

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const skillKey = (item) => item.textContent.trim().toLowerCase();

  function positionCard(item) {
    const rect = item.getBoundingClientRect();
    const margin = 16;
    const gap = 14;
    const cardWidth = card.offsetWidth || 304;
    const cardHeight = card.offsetHeight || 178;
    const titleRect = document.querySelector(".hero h1")?.getBoundingClientRect();
    const cueRect = document.querySelector(".scroll-cue:not(.is-gone)")?.getBoundingClientRect();
    const maxX = window.innerWidth - cardWidth - margin;
    let x = clamp(rect.left + rect.width / 2 - cardWidth / 2, margin, maxX);
    let y = rect.bottom + gap;

    if (y + cardHeight > window.innerHeight - margin) {
      y = Math.max(margin, rect.top - cardHeight - gap);
    }

    const titleGuardRight = titleRect
      ? Math.min(titleRect.right, titleRect.left + Math.min(440, window.innerWidth * 0.38))
      : 0;

    if (
      titleRect &&
      y < titleRect.bottom + gap &&
      y + cardHeight > titleRect.top - gap &&
      x < titleGuardRight + gap &&
      x + cardWidth > titleRect.left - gap
    ) {
      x = clamp(titleGuardRight + gap, margin, maxX);
    }

    if (
      cueRect &&
      y < cueRect.bottom + gap &&
      y + cardHeight > cueRect.top - gap &&
      x < cueRect.right + gap &&
      x + cardWidth > cueRect.left - gap
    ) {
      x = clamp(cueRect.left - cardWidth - gap, margin, maxX);
    }

    card.style.setProperty("--skill-card-x", `${Math.round(x)}px`);
    card.style.setProperty("--skill-card-y", `${Math.round(y)}px`);
  }

  function showSkillCard(item) {
    const detail = heroSkillDetails[skillKey(item)];
    if (!detail) return;

    activeItem = item;
    cardKicker.textContent = detail.meta;
    cardTitle.textContent = detail.title;
    cardText.textContent = detail.text;
    cardImage.src = detail.image;
    cardImage.alt = detail.alt;
    positionCard(item);
    card.setAttribute("aria-hidden", "false");
    card.classList.add("is-visible");
  }

  function hideSkillCard(item) {
    if (item && activeItem !== item) return;
    activeItem = null;
    card.classList.remove("is-visible");
    card.setAttribute("aria-hidden", "true");
  }

  skillItems.forEach((item) => {
    const isDuplicateTrack = item.closest(".hero-skill-track")?.getAttribute("aria-hidden") === "true";

    item.addEventListener("pointerenter", () => showSkillCard(item));
    item.addEventListener("pointermove", () => {
      if (activeItem !== item) showSkillCard(item);
      if (activeItem === item) positionCard(item);
    });
    item.addEventListener("mouseenter", () => showSkillCard(item));
    item.addEventListener("mousemove", () => {
      if (activeItem !== item) showSkillCard(item);
      if (activeItem === item) positionCard(item);
    });
    item.addEventListener("pointerleave", () => hideSkillCard(item));
    item.addEventListener("mouseleave", () => hideSkillCard(item));

    if (!isDuplicateTrack) {
      item.tabIndex = 0;
      item.setAttribute("aria-label", `Show ${item.textContent.trim()} skill detail`);
      item.addEventListener("focus", () => showSkillCard(item));
      item.addEventListener("blur", () => hideSkillCard(item));
    }
  });

  window.addEventListener("resize", () => {
    if (activeItem) positionCard(activeItem);
  });
  window.addEventListener(
    "scroll",
    () => {
      if (activeItem) positionCard(activeItem);
    },
    { passive: true }
  );
}

initHeroSkillCards();

/* ============ scroll effects (rAF-gated) ============ */

const progress = document.querySelector(".progress");
const header = document.querySelector(".site-header");
const scrollCue = document.querySelector(".scroll-cue");
const parallaxImgs = [...document.querySelectorAll("[data-parallax]")];
let scrollTicking = false;

function updateScrollEffects() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? window.scrollY / max : 0;
  progress.style.transform = `scaleX(${ratio})`; // compositor-only
  header.classList.toggle("is-scrolled", window.scrollY > 24);

  // gentle parallax on flagged media (slight overscale hides the travel)
  if (!reducedMotion.matches) {
    parallaxImgs.forEach((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight;
      img.style.transform = `translateY(${(-offset * 14).toFixed(2)}px) scale(1.06)`;
    });
  }
}

window.addEventListener(
  "scroll",
  () => {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(() => {
        updateScrollEffects();
        scrollTicking = false;
      });
    }
  },
  { passive: true }
);
updateScrollEffects();

window.addEventListener(
  "scroll",
  () => scrollCue?.classList.add("is-gone"),
  { passive: true, once: true }
);

/* ============ mobile nav ============ */

const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

navToggle?.addEventListener("click", () => {
  const isOpen = navToggle.getAttribute("aria-expanded") === "true";
  navToggle.setAttribute("aria-expanded", String(!isOpen));
  nav.classList.toggle("is-open", !isOpen);
});

nav?.addEventListener("click", (event) => {
  if (event.target.matches("a")) {
    nav.classList.remove("is-open");
    navToggle?.setAttribute("aria-expanded", "false");
  }
});

/* ============ scrollspy (current section in nav) ============ */

const spyLinks = new Map(
  [...document.querySelectorAll('#site-nav a[href^="#"]')].map((a) => [
    a.getAttribute("href").slice(1),
    a,
  ])
);

const spyObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      spyLinks.forEach((link) => link.classList.remove("is-current"));
      spyLinks.get(entry.target.id)?.classList.add("is-current");
    });
  },
  { rootMargin: "-35% 0px -60% 0px" }
);

spyLinks.forEach((link, id) => {
  const section = document.getElementById(id);
  if (section) spyObserver.observe(section);
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

const counterObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      counterObserver.unobserve(el);
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      if (reducedMotion.matches) {
        el.textContent = target.toFixed(decimals);
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
      setTimeout(() => {
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          el.textContent = (target * ease(p)).toFixed(decimals);
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }, delay);
    });
  },
  { threshold: 0.5 }
);

document.querySelectorAll("[data-count]").forEach((el) => {
  el.textContent = (0).toFixed(parseInt(el.dataset.decimals || "0", 10));
  counterObserver.observe(el);
});

/* ============ filters (with view transitions when available) ============ */

const cards = [...document.querySelectorAll(".project-card")];
const filters = [...document.querySelectorAll(".filter")];
const projectGrid = document.querySelector(".project-grid");
const isInteractiveCardTarget = (event) =>
  Boolean(event.target.closest("a, button, input, select, textarea"));

// unique view-transition-name per card => cards glide (FLIP) between
// filter states in browsers with the View Transitions API
cards.forEach((card) => {
  card.style.viewTransitionName = `card-${card.dataset.project || "studio"}`;
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    const apply = () => {
      filters.forEach((item) => item.classList.toggle("active", item === button));
      cards.forEach((card) => {
        // the studio tile stays visible under every filter (it links to all 14)
        const show = filter === "all"
          || card.classList.contains("project-card--studio")
          || (card.dataset.category || "").includes(filter);
        card.classList.toggle("is-hidden", !show);
      });
    };
    if (reducedMotion.matches) {
      apply();
    } else if (document.startViewTransition) {
      document.startViewTransition(apply);
    } else {
      // graceful fade fallback (Firefox / older Safari)
      projectGrid?.classList.add("is-filtering");
      setTimeout(() => {
        apply();
        requestAnimationFrame(() =>
          requestAnimationFrame(() => projectGrid?.classList.remove("is-filtering"))
        );
      }, 150);
    }
  });
});

/* ============ project cards: keyboard, tilt, specular ============ */

let tiltFrame = null;

cards.forEach((card) => {
  const isStudioTile = card.classList.contains("project-card--studio");
  if (!isStudioTile) {
    // the studio tile is a real <a>: natively focusable, no modal role
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Open ${card.querySelector("h3")?.textContent || "project"} case study`);
  }

  card.addEventListener("pointerenter", () => {
    if (!finePointer.matches || reducedMotion.matches) return;
    card.style.transition = "border-color 200ms, box-shadow 200ms";
  });

  card.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reducedMotion.matches) return;
    if (tiltFrame) return;
    tiltFrame = requestAnimationFrame(() => {
      tiltFrame = null;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      card.style.setProperty("--mx", `${px * 100}%`);
      card.style.setProperty("--my", `${py * 100}%`);
      card.style.transform = `perspective(900px) rotateX(${(py - 0.5) * -3}deg) rotateY(${(px - 0.5) * 4}deg) translateY(-2px)`;
    });
  });

  card.addEventListener("pointerleave", () => {
    card.style.transition = "";
    card.style.transform = "";
  });

  if (!isStudioTile) {
    card.addEventListener("click", (event) => {
      if (isInteractiveCardTarget(event)) return;
      openModal(card.dataset.project);
    });
    card.addEventListener("keydown", (event) => {
      if (isInteractiveCardTarget(event)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openModal(card.dataset.project);
      }
    });
  }

  card.querySelectorAll(".project-download").forEach((link) => {
    link.addEventListener("click", (event) => event.stopPropagation());
    link.addEventListener("keydown", (event) => event.stopPropagation());
  });
});

/* ============ magnetic buttons ============ */

document.querySelectorAll("[data-magnetic]").forEach((el) => {
  el.addEventListener("pointerenter", () => {
    if (!finePointer.matches || reducedMotion.matches) return;
    // soften the first movement so the pull eases in instead of stepping
    el.style.transition = "transform 160ms cubic-bezier(0.33, 1, 0.68, 1)";
    setTimeout(() => { el.style.transition = ""; }, 180);
  });
  el.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reducedMotion.matches) return;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    el.style.transform = `translate(${clamp(dx * 0.08, 10)}px, ${clamp(dy * 0.12, 7)}px)`;
  });
  el.addEventListener("pointerleave", () => {
    el.style.transition = "transform 500ms cubic-bezier(0.16, 1, 0.3, 1)";
    el.style.transform = "";
    setTimeout(() => {
      el.style.transition = "";
    }, 500);
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
  modalScrub.pause();
  modalImage.hidden = false;
  const alt = item.alt || `${projectTitle} gallery image`;
  if (instant || reducedMotion.matches) {
    modalImage.src = item.src;
    modalImage.alt = alt;
    return;
  }
  modalImage.classList.add("is-swapping");
  setTimeout(() => {
    modalImage.src = item.src;
    modalImage.alt = alt;
    modalImage.classList.remove("is-swapping");
  }, 200);
}

function renderGallery(project) {
  const items = project.gallery?.length
    ? project.gallery
    : [{ src: project.image, alt: `${project.title} image`, caption: project.title }];

  modalGallery.replaceChildren(
    ...items.map((item, index) => {
      const button = document.createElement("button");
      button.className = "gallery-item";
      button.type = "button";
      button.setAttribute("aria-label", `Show ${item.caption || project.title} image`);
      button.classList.toggle("is-active", index === 0);

      const image = document.createElement("img");
      image.src = item.src;
      image.alt = item.alt || "";
      image.loading = "lazy";
      button.append(image);

      const caption = document.createElement("span");
      caption.textContent = item.caption || project.title;
      button.append(caption);

      button.addEventListener("click", () => {
        showModalMedia(item, project.title);
        modalGallery.querySelectorAll(".gallery-item").forEach((node) => node.classList.remove("is-active"));
        button.classList.add("is-active");
      });
      return button;
    })
  );
}

function openModal(projectKey) {
  const project = projectData[projectKey];
  if (!project) return;
  lastFocusedElement = document.activeElement;
  const firstItem = project.gallery?.[0] || { src: project.image, alt: `${project.title} case study image` };
  showModalMedia(firstItem, project.title, true);
  modalKicker.textContent = project.kicker;
  modalTitle.textContent = project.title;
  modalSummary.textContent = project.summary;
  const studioLink = document.querySelector("#modal-studio-link");
  if (studioLink) studioLink.href = `experience.html#${projectKey}`;
  fillList(modalHighlights, project.highlights);
  fillList(modalTools, project.tools);
  renderDetails(project);
  renderGallery(project);
  modalPanel.scrollTop = 0;
  modalScrub.setup(project.scrub, project);
  const showDom = () => {
    modal.classList.remove("is-closing");
    modal.setAttribute("aria-hidden", "false");
    body.classList.add("modal-open");
    modal.querySelector(".modal-close").focus();
  };
  // shared-element morph: the clicked card's cover glides into the modal hero
  const cardEl = document.querySelector(`.project-card[data-project="${projectKey}"]`);
  const cardImg = cardEl?.querySelector(".card-media img");
  if (document.startViewTransition && !reducedMotion.matches && cardImg) {
    const prevCardName = cardEl.style.viewTransitionName;
    cardEl.style.viewTransitionName = "none"; // only the image pair morphs
    cardImg.style.viewTransitionName = "case-hero";
    modalImage.style.viewTransitionName = "case-hero";
    document
      .startViewTransition(showDom)
      .finished.finally(() => {
        cardImg.style.viewTransitionName = "";
        modalImage.style.viewTransitionName = "";
        cardEl.style.viewTransitionName = prevCardName;
      });
  } else {
    showDom();
  }
}

function closeModal() {
  modalScrub.teardown();
  const finish = () => {
    modal.classList.remove("is-closing");
    modal.setAttribute("aria-hidden", "true");
    body.classList.remove("modal-open");
    lastFocusedElement?.focus();
  };
  if (reducedMotion.matches) {
    finish();
    return;
  }
  modal.classList.add("is-closing");
  modalPanel.addEventListener("animationend", finish, { once: true });
  // Safety net if animationend never fires.
  setTimeout(() => {
    if (modal.classList.contains("is-closing")) finish();
  }, 400);
}

modal.querySelectorAll("[data-close-modal]").forEach((element) => {
  element.addEventListener("click", closeModal);
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
    closeModal();
    return;
  }

  if (event.key === "Tab") {
    const focusables = [
      ...modal.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])')
    ].filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
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
const scrubReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

const modalScrub = {
  active: false,
  paused: false,
  ready: false,
  count: 0,
  base: "",
  frames: null,
  rafPending: false,
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
    modalMedia.classList.add("modal-media--scrub");
    modalMedia.classList.remove("modal-media--scrubbed");
    modalScrubImg.hidden = false;
    if (!this.frames || this.frames.base !== cfg.base) {
      const arr = [];
      for (let i = 1; i <= cfg.count; i++) {
        const im = new Image();
        im.decoding = "async";
        im.src = this.url(i);
        arr.push(im);
      }
      arr.base = cfg.base;
      this.frames = arr;
    }
    if (scrubReduce.matches) {
      modalScrubImg.src = this.url(cfg.count); // static fully-exploded view
      if (modalScrubBar) modalScrubBar.style.width = "100%";
      return;
    }
    modalScrubImg.src = this.url(1); // start assembled
    this.lastIdx = 1;
    modalPanel.addEventListener("scroll", this.onScroll, { passive: true });
    Promise.all(
      this.frames.map((im) => (im.decode ? im.decode().catch(() => {}) : Promise.resolve()))
    ).then(() => {
      this.ready = true;
      this.render();
    });
  },
  teardown() {
    this.active = false;
    this.paused = false;
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
    if (modalScrubImg) modalScrubImg.hidden = true;
    if (modalMedia) modalMedia.classList.add("modal-media--scrubbed");
  },
  resume() {
    if (!this.active || !this.paused) return;
    this.paused = false;
    if (modalScrubImg) modalScrubImg.hidden = false;
    this.lastIdx = -1;
    this.render();
  },
  progress() {
    const max = modalPanel.scrollHeight - modalPanel.clientHeight;
    if (max <= 0) return 0;
    const range = Math.min(max, modalPanel.clientHeight * 1.25);
    return Math.max(0, Math.min(1, modalPanel.scrollTop / range));
  },
  render() {
    if (!this.active || this.paused || scrubReduce.matches) return;
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
    if (this.smooth !== targetIdx && !this.rafPending) {
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        this.render();
      });
    }
  },
};
modalScrub.onScroll = function () {
  if (!modalScrub.active || scrubReduce.matches) return;
  if (modalScrub.paused) modalScrub.resume();
  if (!modalScrub.rafPending) {
    modalScrub.rafPending = true;
    requestAnimationFrame(() => {
      modalScrub.rafPending = false;
      modalScrub.render();
    });
  }
};
