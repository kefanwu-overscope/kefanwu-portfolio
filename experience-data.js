/* ============================================================
   experience-data.js  (ES module)
   RESUME — condensed resume rendered into the 3D desk's resume sheet.
   Rich case-study content is read from window.projectData
   (shared with the homepage; see project-data.js wiring).
   ============================================================ */

// Condensed resume, composed from on-site information (English only).
export const RESUME = {
  name: "Kefan Wu",
  role: "Mechanical Lead — Olin Electric Motorsports",
  meta: "MechE @ Olin College of Engineering '28 · GPA 3.9",
  summary:
    "Mechanical engineering student leading mechanical systems for Olin Electric Motorsports, building tested hardware across motorsport, robotics, and fabrication — from load cases and CAD to machined, welded, and validated parts.",
  highlights: [
    "Mechanical Lead directing 4 mechanical subteams — suspension & chassis, aerodynamics, drivetrain, accumulator — on an 85 kW FSAE electric racecar.",
    "Cut brake rotor mass 25% at a 3.0 FEA factor of safety; steering on matched 27.5° dual U-joints with bearing cages 0.9 kg lighter.",
    "Summer research at the Olin Vine Robotics Lab: a 5 psi pressure-vessel robot plus 30 ASTM D882 tensile tests feeding a deformation model.",
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
    { label: "kwu@olin.edu",           href: "mailto:kwu@olin.edu" },
    { label: "LinkedIn",               href: "https://www.linkedin.com/in/kefan-wu-olin/" },
    { label: "Download resume (PDF)",  href: "assets/kefan-wu-resume.pdf" },
  ],
};
