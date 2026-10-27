/* Restored from e5ea5c6846949c83a60e9777091da1582b32d818:script.js.
 * The 14 original labels and images are retained. Analysis copy follows the
 * current project-data.js record, including its CFD validation limits. */
(() => {
  "use strict";

  const strip = document.querySelector(".hero-skill-strip");
  if (!strip || document.getElementById("skill-detail-card")) return;

  const details = {
    arduino: {
      title: "Arduino", meta: "Embedded prototyping",
      image: "assets/skill-arduino-online.jpg", alt: "Arduino Uno development board",
      text: "Control loops for sensors, motors, and bench prototypes when a mechanical idea needs physical feedback."
    },
    "tig welding": {
      title: "TIG Welding", meta: "Precision fabrication",
      image: "assets/skill-tig-welding.jpg", alt: "TIG welding operation on metal tubing",
      text: "Welded mounts and motorsport hardware where heat control, fit-up, and load paths matter."
    },
    autocad: {
      title: "AutoCAD", meta: "Fabrication drawings",
      image: "assets/cover-steering-system-cad.webp", alt: "CAD assembly of the Mk.8 steering system",
      text: "2D layouts, DXF cleanup, shop-ready profiles, and fabrication handoff details before parts hit the machine."
    },
    "topology study": {
      title: "Topology Study", meta: "Load-path exploration",
      image: "assets/skill-topology.webp", alt: "Finite element load-path study on a seat support structure",
      text: "Constraint-first material studies that reveal load paths before committing weight and geometry in final CAD."
    },
    solidworks: {
      title: "SolidWorks", meta: "Parametric CAD",
      image: "assets/cover-steering-system-cad.webp", alt: "SolidWorks CAD render of the Mk.8 steering column assembly",
      text: "Assemblies, packaging studies, drawings, and design reviews that connect concept geometry to buildable hardware."
    },
    matlab: {
      title: "MATLAB", meta: "Engineering models",
      image: "assets/skill-matlab.webp", alt: "MATLAB surface plot of steering U-joint speed ripple",
      text: "Parameter sweeps, kinematics, thermal models, and plots that turn assumptions into traceable decisions."
    },
    fea: {
      title: "FEA", meta: "Structural analysis",
      image: "assets/brake-figures-20261005/stress-von-mises.png", alt: "Original von Mises stress figure and complete scale from the brake design review",
      text: "Stress and stiffness studies under explicit load cases, cross-checked with hand calculations and clear model assumptions."
    },
    cfd: {
      title: "CFD", meta: "Flow simulation workflow",
      image: "assets/ansys-cfd-pressure.webp", alt: "Ansys CFD pressure-field result over a VTOL drone body",
      text: "Headless Fluent setup, meshing, setting readback, and quality gates. The recorded cases demonstrate process, not validated aerodynamic performance."
    },
    "cnc mill": {
      title: "CNC Mill", meta: "Precision machining",
      image: "assets/skill-cnc-mill.jpg", alt: "CNC milling machine cutting metal with coolant",
      text: "Machined interfaces, bearing cages, mounts, and tolerance-critical details where fit and repeatability matter."
    },
    lathe: {
      title: "Lathe", meta: "Round hardware",
      image: "assets/skill-lathe.jpg", alt: "Metal lathe turning a shiny workpiece in the chuck",
      text: "Shafts and rotational interfaces that connect steering and mechanism geometry to physical hardware."
    },
    waterjet: {
      title: "Waterjet", meta: "Flat-pattern fabrication",
      image: "assets/skill-waterjet.webp", alt: "Waterjet-cut, TIG-welded A36 steel swerve mount",
      text: "Plate and bracket fabrication for steering mounts, swerve modules, and mechanism hardware."
    },
    "carbon fiber": {
      title: "Carbon Fiber", meta: "Composite structures",
      image: "assets/skill-carbon.webp", alt: "Close view of the carbon fiber weave on the FSAE seat shell",
      text: "Layup, trimming, support geometry, and lightweight structure decisions for motorsport packaging."
    },
    "team management": {
      title: "Team Management", meta: "Engineering leadership",
      image: "assets/skill-team-management.jpg", alt: "Olin Electric Motorsports team standing with the race car",
      text: "Leading 30 mechanical engineers across four subteams, from design reviews and fabrication to vehicle integration."
    },
    "ai-assisted eng": {
      title: "AI-Assisted Engineering", meta: "PyFluent / engineering automation",
      image: "assets/skill-vibe-coding.jpg", alt: "Code on a dark screen with blue and red ambient lighting",
      text: "Reviewable scripts and workflows for headless Ansys via PyFluent, with critical-setting readback and documented failure recovery."
    }
  };
  const items = [...strip.querySelectorAll(".hero-skill-track span")]
    .filter((item) => details[item.textContent.trim().toLowerCase()]);
  if (!items.length) return;

  const card = document.createElement("aside");
  card.className = "skill-glass-card";
  card.id = "skill-detail-card";
  card.setAttribute("role", "tooltip");
  card.setAttribute("aria-hidden", "true");
  card.innerHTML = `<div class="skill-card-inner">
    <div class="skill-card-media"></div>
    <div class="skill-card-content"><p class="skill-card-kicker"></p>
      <h2></h2><p class="skill-card-text"></p></div>
  </div>`;
  document.body.append(card);

  const media = card.querySelector(".skill-card-media");
  const kicker = card.querySelector(".skill-card-kicker");
  const title = card.querySelector("h2");
  const text = card.querySelector(".skill-card-text");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let activeItem = null;
  let hoveredItem = null;
  let overCard = false;
  let pinned = false;
  let dismissedItem = null;
  let modality = "keyboard";
  let positionFrame = 0;
  let closeTimer = 0;
  let shownKey = null;
  let showTicket = 0;
  let preloaded = false;
  let preloadWanted = false;
  let preloadTimer = 0;
  const images = new Map();
  const ready = new Map();
  const decoded = new Set();
  // A first show waits this long at most for its picture; a chip-to-chip swap
  // waits a little longer so text and picture usually change together.
  const FIRST_SHOW_WAIT = 180;
  const SWAP_WAIT = 450;
  const technical = new Set(["fea", "cfd", "matlab", "topology study", "autocad", "solidworks"]);
  const keyOf = (item) => item.textContent.trim().toLowerCase();

  // One image element per skill, so a swap never shows a picture still decoding.
  // The hovered picture is requested first, at high priority.
  function imageFor(key, urgent = false) {
    let image = images.get(key);
    if (!image) {
      image = new Image();
      image.decoding = "async";
      if (urgent) image.fetchPriority = "high";
      image.alt = details[key].alt;
      image.src = details[key].image;
      images.set(key, image);
    }
    return image;
  }

  // Settles once the picture is decoded (or failed); a picture that arrives
  // after its card opened fades in over the neutral media box.
  function readyFor(key) {
    let promise = ready.get(key);
    if (!promise) {
      const image = imageFor(key);
      promise = image.decode().catch(() => {}).then(() => {
        decoded.add(key);
        image.classList.remove("is-pending");
      });
      ready.set(key, promise);
    }
    return promise;
  }

  function preloadRest() {
    clearTimeout(preloadTimer);
    preloadTimer = 0;
    if (preloaded || !preloadWanted) return;
    preloaded = true;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
    idle(() => Object.keys(details).forEach((key) => imageFor(key)), { timeout: 1000 });
  }

  // Fetch the other pictures once the pointer (or focus) reaches the strip,
  // but only after the hovered one has arrived, so they never compete with it.
  function preload() {
    if (preloaded || preloadWanted) return;
    preloadWanted = true;
    preloadTimer = setTimeout(() => { if (!activeItem) preloadRest(); else preloadTimer = 0; }, 400);
  }

  function clearClose() {
    clearTimeout(closeTimer);
    closeTimer = 0;
  }

  function hide() {
    clearClose();
    cancelAnimationFrame(positionFrame);
    positionFrame = 0;
    activeItem?.removeAttribute("aria-describedby");
    activeItem?.setAttribute("aria-expanded", "false");
    activeItem = null;
    pinned = false;
    overCard = false;
    card.classList.remove("is-visible", "is-following");
    card.setAttribute("aria-hidden", "true");
    strip.classList.remove("is-skill-active");
  }

  function position() {
    if (!activeItem || document.hidden) return;
    const rect = activeItem.getBoundingClientRect();
    const clip = strip.getBoundingClientRect();
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const margin = 12;
    const gap = 12;
    if (rect.bottom <= top || rect.top >= top + height || rect.right <= clip.left || rect.left >= clip.right) {
      hide();
      return;
    }
    card.style.maxWidth = `${Math.max(1, width - margin * 2)}px`;
    card.style.maxHeight = `${Math.max(1, height - margin * 2)}px`;
    const cardWidth = card.offsetWidth;
    const cardHeight = card.offsetHeight;
    const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
    const x = clamp(rect.left + rect.width / 2 - cardWidth / 2, left + margin, left + width - cardWidth - margin);
    const below = rect.bottom + gap;
    const above = rect.top - cardHeight - gap;
    const y = clamp(below + cardHeight <= top + height - margin ? below : above, top + margin, top + height - cardHeight - margin);
    card.style.setProperty("--skill-card-x", `${Math.round(x)}px`);
    card.style.setProperty("--skill-card-y", `${Math.round(y)}px`);
  }

  function schedulePosition() {
    if (!activeItem || positionFrame || document.hidden) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = 0;
      position();
    });
  }

  function reveal(key) {
    if (shownKey !== key) {
      const detail = details[key];
      kicker.textContent = detail.meta;
      title.textContent = detail.title;
      text.textContent = detail.text;
      const image = imageFor(key);
      image.classList.toggle("is-pending", !decoded.has(key));
      media.replaceChildren(image);
      media.classList.toggle("is-technical", technical.has(key));
      shownKey = key;
    }
    // A closed card is placed at its chip before it fades in, never flown in
    // from its previous position; an open card follows to the next chip.
    const entering = !card.classList.contains("is-visible");
    if (entering) card.style.transition = "none";
    card.classList.toggle("is-following", !entering);
    position();
    if (entering) {
      void card.offsetWidth;
      card.style.removeProperty("transition");
    }
    if (!activeItem) return;
    card.setAttribute("aria-hidden", "false");
    card.classList.add("is-visible");
  }

  function show(item, pin = false) {
    if (document.hidden || dismissedItem === item) return;
    clearClose();
    if (activeItem !== item) {
      activeItem?.removeAttribute("aria-describedby");
      activeItem?.setAttribute("aria-expanded", "false");
      activeItem = item;
      pinned = false;
    }
    pinned = pinned || pin;
    item.setAttribute("aria-describedby", card.id);
    item.setAttribute("aria-expanded", "true");
    strip.classList.add("is-skill-active");
    const key = keyOf(item);
    const ticket = ++showTicket;
    if (shownKey === key) {
      reveal(key);
      return;
    }
    // Text and picture change together once the new picture is decoded, or
    // after a short cap so a slow link never holds the card back; the picture
    // then fades in when it arrives.
    imageFor(key, true);
    const picture = readyFor(key);
    picture.then(preloadRest);
    const cap = new Promise((resolve) => {
      setTimeout(resolve, card.classList.contains("is-visible") ? SWAP_WAIT : FIRST_SHOW_WAIT);
    });
    Promise.race([picture, cap]).then(() => {
      if (ticket === showTicket && activeItem === item && !document.hidden) reveal(key);
    });
  }

  function scheduleClose() {
    clearClose();
    closeTimer = setTimeout(() => {
      closeTimer = 0;
      if (!pinned && !overCard && hoveredItem !== activeItem && document.activeElement !== activeItem) hide();
    }, 150);
  }

  function revealKeyboardItem(item) {
    strip.classList.add("is-skill-keyboard");
    const rect = item.getBoundingClientRect();
    const bounds = strip.getBoundingClientRect();
    if (rect.left < bounds.left || rect.right > bounds.right) {
      strip.scrollLeft += rect.left - bounds.left - (bounds.width - rect.width) / 2;
    }
  }

  // One tab stop for the whole strip (roving tabindex): Left/Right/Home/End move
  // between chips, Enter/Space pins the card, Escape closes it.
  const focusable = items.filter((item) => item.closest(".hero-skill-track").getAttribute("aria-hidden") !== "true");
  strip.setAttribute("role", "toolbar");
  function setTabStop(item) {
    focusable.forEach((chip) => { chip.tabIndex = chip === item ? 0 : -1; });
  }
  setTabStop(focusable[0]);

  items.forEach((item) => {
    if (focusable.includes(item)) {
      item.setAttribute("role", "button");
      item.setAttribute("aria-controls", card.id);
      item.setAttribute("aria-expanded", "false");
    }
    item.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "touch") return;
      hoveredItem = item;
      dismissedItem = null;
      show(item);
    });
    item.addEventListener("pointerleave", () => {
      if (hoveredItem === item) hoveredItem = null;
      if (dismissedItem === item) dismissedItem = null;
      scheduleClose();
    });
    item.addEventListener("focus", () => {
      dismissedItem = null;
      if (focusable.includes(item)) setTabStop(item);
      if (modality === "touch") return;
      if (modality === "keyboard") revealKeyboardItem(item);
      show(item);
    });
    item.addEventListener("blur", (event) => {
      if (!strip.contains(event.relatedTarget)) {
        strip.classList.remove("is-skill-keyboard");
        strip.scrollLeft = 0;
        pinned = false;
      }
      scheduleClose();
    });
    item.addEventListener("click", () => {
      if (activeItem === item && pinned) {
        dismissedItem = item;
        hide();
      } else {
        dismissedItem = null;
        show(item, true);
      }
    });
    item.addEventListener("keydown", (event) => {
      const index = focusable.indexOf(item);
      const target = {
        ArrowRight: focusable[(index + 1) % focusable.length],
        ArrowLeft: focusable[(index - 1 + focusable.length) % focusable.length],
        Home: focusable[0],
        End: focusable[focusable.length - 1]
      }[event.key];
      if (index !== -1 && target) {
        event.preventDefault();
        target.focus();
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      item.click();
    });
  });

  card.addEventListener("pointerenter", () => { overCard = true; clearClose(); });
  card.addEventListener("pointerleave", () => { overCard = false; scheduleClose(); });
  strip.addEventListener("pointerenter", (event) => { if (event.pointerType !== "touch") preload(); });
  strip.addEventListener("focusin", () => { if (modality === "keyboard") preload(); });
  document.addEventListener("pointerdown", (event) => {
    modality = event.pointerType;
    if (!strip.contains(event.target) && !card.contains(event.target)) hide();
  }, { capture: true });
  document.addEventListener("keydown", (event) => {
    modality = "keyboard";
    if (event.key === "Escape") {
      dismissedItem = activeItem;
      hide();
    }
  }, { capture: true });
  window.addEventListener("scroll", () => {
    if (activeItem === document.activeElement && strip.classList.contains("is-skill-keyboard")) schedulePosition();
    else hide();
  }, { passive: true });
  strip.addEventListener("scroll", schedulePosition, { passive: true });
  window.addEventListener("resize", schedulePosition);
  window.visualViewport?.addEventListener("resize", schedulePosition);
  window.visualViewport?.addEventListener("scroll", schedulePosition);
  document.addEventListener("visibilitychange", () => { if (document.hidden) hide(); });
  window.addEventListener("pagehide", hide);
  motion.addEventListener("change", hide);
})();
