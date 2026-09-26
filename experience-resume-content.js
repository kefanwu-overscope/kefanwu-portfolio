/* Accessible text equivalent of the canonical printed résumé.
 * Source: assets/kefan-wu-resume.pdf, visually transcribed from its page render.
 * PDF SHA-256: E1902C160B0DFE3358074803BFA5017F16D6B26B717D790EC2F28C6977AA7FDF
 * Keep this text synchronized with the PDF-derived page image. Dates, targets,
 * measurements, and wording are preserved from that source, not inferred.
 * The caller supplies screen-reader-only styling; this contains no controls.
 */

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const list = (items) => `<ul>${items.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`;
const paragraph = (text) => `<p>${escapeHTML(text)}</p>`;
const heading = (level, text) => `<h${level}>${escapeHTML(text)}</h${level}>`;

const motorsportsRoles = [
  {
    title: "Mechanical Lead",
    dates: "May 2026 – Present",
    points: [
      "Direct mechanical design, integration, and fabrication of the Mk.8 FSAE electric racecar",
      "Manage 4 mechanical subteams: suspension & chassis, aerodynamics, drivetrain, accumulator",
      "Set milestones and build schedules toward a 22 km, sub-30-minute endurance design target",
    ],
  },
  {
    title: "Cockpit Lead",
    dates: "Jun 2025 – May 2026",
    points: [
      "Developed a track-based brake thermal model; cut brake rotor mass 25% at a 3.0 FEA factor of safety",
      "Engineered the steering column around matched 27.5° dual U-joints providing linear steering; lightweighted steering bearing cages, saving 0.9 kg against last year's design",
      "Led the cockpit subteam: machined parts on lathe, mill, and waterjet; TIG-welded chassis tabs; laid up a carbon fiber seat",
    ],
  },
  {
    title: "Drivetrain & Cockpit Engineer",
    dates: "Sep 2024 – Jun 2025",
    points: [
      "Designed and built the Mk.7 driver seat and FEA-validated motor-controller mounts",
    ],
  },
];

const researchPoints = [
  "Built a vine-everting robot capable of holding 5 psi with reinforced structure",
  "Determined material properties with 30 Instron tests across TPU-coated fabric and LDPE (ASTM D882 standard)",
  "Designed a testing rig with minimized buckling to validate a cross-section strain model against the data",
];

const auraPoints = [
  "Designed front swerve-drive modules for an autonomous luggage robot: 200 lb target, 300 lb tested. NEMA 23 steppers via 18:80 chain steering reduction, 24 V MY1016Z DC drive motors via a 9:16 sprocket ratio.",
  "Diagnosed and fixed chain skip, backlash, and shaft misalignment in durability, impact, and load tests",
  "Waterjet-cut 0.25 in A36 steel wheel housings and motor mounts on an OMAX; TIG-welded the assemblies",
];

const selectedProjects = [
  "Javelin VTOL drone — tail-sitter, no control surfaces, 300 km/h design target; differential-thrust attitude control, avionics integrated; seeking FAA clearance to fly past the 100 mph UAS limit",
  "Agent-based CFD — automated Ansys Fluent via PyFluent with AI agents; drove Javelin VTOL aerodynamics design inspiration; documented 11 failure modes with recovery procedures",
  "LiDAR 3D scanner — two-axis ESP32 gantry (NEMA 17, DRV8825) captured 2,206 points; a 14-point calibration cut range error below 3%, plus copper-foil EMI shielding",
];

const skills = [
  ["CAD", "SolidWorks (topology studies), AutoCAD, design for manufacturing"],
  ["Analysis & Simulation", "MATLAB, FEA (SolidWorks Simulation), CFD (Ansys Fluent, PyFluent), analytical hand calculations"],
  ["Manufacturing & Test", "CNC mill, lathe, CNC waterjet, plasma cutter, TIG welding, carbon fiber layup, sheet metal, SLA/FDM 3D printing, laser cutting, rapid prototyping, Instron testing"],
  ["Software & Electronics", "Arduino, ArduPilot, stepper control, PID control, agent-based simulation"],
];

export function resumeAccessibleHTML() {
  return [
    heading(2, "Kefan Wu"),
    paragraph("kefanwu.com · kwu@olin.edu"),
    paragraph("508-509-2707"),

    heading(3, "Education"),
    heading(4, "Olin College of Engineering"),
    paragraph("Needham, MA · Expected May 2028"),
    paragraph("B.S. Mechanical Engineering — GPA 3.9/4.0"),
    paragraph("Coursework: Mechanics of Solids & Structures, Systems Analysis: Dynamics, Thermal-Fluid Systems, Probabilistic Modeling"),

    heading(3, "Experience"),
    heading(4, "Olin Electric Motorsports (Formula SAE Electric)"),
    paragraph("Needham, MA"),
    paragraph("Student team: built an 85 kW electric racecar from scratch; 0–60 mph in 3.5 s."),
    ...motorsportsRoles.map((role) => [
      heading(5, role.title), paragraph(role.dates), list(role.points),
    ].join("")),

    heading(4, "Research Assistant, Olin Vine Robotics Lab (full-time summer research)"),
    paragraph("May 2026 – Aug 2026"),
    list(researchPoints),

    heading(4, "Mechanical Engineer, Project AURA (class project)"),
    paragraph("Oct 2025 – Dec 2025"),
    list(auraPoints),

    heading(3, "Selected Projects"),
    list(selectedProjects),

    heading(3, "Skills"),
    ...skills.map(([label, description]) =>
      `<p><strong>${escapeHTML(label)}</strong>: ${escapeHTML(description)}</p>`),
  ].join("\n");
}
