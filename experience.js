/* ============================================================
   experience.js — 3D desk experience bootstrap
   Phase 0: scaffold only. The Three.js scene is added in later
   phases. This module currently just marks JS availability and
   confirms the data module is wired.
   ============================================================ */

import { HERO_PROJECTS, RESUME } from "./experience-data.js";

document.documentElement.classList.add("exp-js");

// Sanity: data module resolved via the import map / relative import.
console.info(
  `[experience] ready — ${HERO_PROJECTS.length} hero objects, resume for ${RESUME.name}`
);
