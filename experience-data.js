/* ============================================================
   experience-data.js  (ES module)
   Configuration for the 3D desk experience:
   - HERO_PROJECTS: the curated desk objects (-> projectData keys)
   - RESUME: condensed resume rendered into the folder panel
   Rich case-study content is read from window.projectData
   (shared with the homepage; see project-data.js wiring later).
   ============================================================ */

// Brand accent reused in 3D + overlays.
export const ACCENT = 0x3f8cff;

// The 7 curated hero objects on the desk. `key` matches a projectData key.
// `model` is the in-scene builder/asset id resolved by experience.js.
export const HERO_PROJECTS = [
  { key: "steering",   label: "Mk.8 Steering",  tag: "FSAE / steering",        model: "steering" },
  { key: "javelin",    label: "Javelin VTOL",   tag: "Aerospace / VTOL",       model: "drone" },
  { key: "carbonSeat", label: "Carbon Seat",    tag: "Composites",             model: "seat" },
  { key: "brakeSim",   label: "Brake Sim",      tag: "Thermal model",          model: "brakeDisc" },
  { key: "scanner",    label: "3D Scanner",     tag: "LiDAR / capture",        model: "scanner" },
  { key: "aura",       label: "AURA Swerve",    tag: "Swerve drive",           model: "swerve" },
  { key: "ansysCfd",   label: "Agent-based CFD", tag: "CFD automation",        model: "monitor" },
];

// Condensed resume, composed from on-site information (English only).
export const RESUME = {
  name: "Kefan Wu",
  role: "Mechanical Lead — Olin Electric Motorsports",
  meta: "MechE @ Olin College of Engineering '28",
  summary:
    "Mechanical engineering student leading mechanical systems for Olin Electric Motorsports, building tested hardware across motorsport, robotics, and fabrication — from load cases and CAD to machined, welded, and validated parts.",
  highlights: [
    "Mechanical Lead coordinating 30+ engineers across an FSAE program.",
    "Owns subsystems end to end: requirements, analysis, fabrication planning, and shop execution.",
    "Comfortable from kinematics and FEA/CFD to lathe, waterjet, CNC, TIG, and composites.",
  ],
  skills: [
    { group: "CAD & modeling",          items: ["SolidWorks", "AutoCAD", "Topology study"] },
    { group: "Simulation & analysis",   items: ["FEA", "CFD", "MATLAB"] },
    { group: "CNC & machining",         items: ["CNC mill", "Lathe", "Waterjet"] },
    { group: "Fabrication & composites", items: ["TIG welding", "Carbon fiber", "3D printing"] },
    { group: "Electronics & controls",  items: ["Arduino", "ESP32", "Embedded sensors"] },
    { group: "Software & leadership",   items: ["Team management", "Automation / scripting"] },
  ],
  contact: [
    { label: "kwu@olin.edu",          href: "mailto:kwu@olin.edu" },
    { label: "kefanwu8888@gmail.com", href: "mailto:kefanwu8888@gmail.com" },
    { label: "LinkedIn",              href: "https://www.linkedin.com/in/kefan-wu-olin/" },
  ],
};
