/* Shared project case-study data.
   Loaded (classic script) before script.js on index.html and before
   experience.js on experience.html. Single source of truth. */
const projectData = {
  steering: {
    kicker: "Formula SAE / steering / fabrication",
    title: "Mk.8 steering system",
    image: "assets/cover-steering-system.webp",
    summary:
      "Mk.8 steering redesign: matched 27.5-degree dual U-joints cancel speed ripple; the wheel sits 3.5 inches closer and 15 degrees more upright than Mk.7. Hand calculations using peak tire friction and Ackermann geometry gave a 50 N·m worst-case torque. I cut, turned, and welded every steering part; the installed system has run without issues.",
    highlights: [
      "Matched dual U-joint bend angles to reduce rotational velocity ripple through the steering column.",
      "Moved the wheel 3.5 inches closer and 15 degrees more vertical than Mk.7, improving driver posture and cockpit clearance.",
      "Lightweighted the steering bearing cages, saving 0.9 kg over the previous year's design.",
      "Hand-calculated a 50 N·m worst-case steering torque from peak tire friction and the car's Ackermann geometry.",
      "Sized every steering shaft in torsion by hand and cross-checked each one in FEA.",
      "Personally fabricated every steering part: waterjet rack mounts, lathe-turned shafts, and TIG-welded chassis integration. The installed system has run without issues."
    ],
    tools: ["SolidWorks", "MATLAB", "FEA", "Lathe", "Waterjet", "CNC mill", "TIG welding"],
    details: [
      {
        title: "Role and objective",
        points: [
          "Led cockpit-side steering design for OEM Mk.8, then stepped into Mechanical Lead ownership for broader vehicle integration.",
          "Required a precise, low-slop steering path within the cockpit template, preserving dashboard space and driver ingress.",
          "Required better ergonomics without binding, speed ripple, or hardware that was difficult to service."
        ]
      },
      {
        title: "Kinematic decisions",
        points: [
          "Matched dual U-joint bend angles around 27.5 degrees to better cancel input and output speed variation.",
          "Compared yoke phasing and shaft angles with a speed-ratio ripple model before finalizing column geometry.",
          "Moved from Mk.7's 60-degree posture toward 55-degree geometry and a closer wheel for better driver reach."
        ]
      },
      {
        title: "Hardware and fabrication",
        points: [
          "Designed rack mounts, shaft interfaces, bearing cages, and sensor packaging around available shop processes.",
          "Balanced bearing-cage mass and stiffness, removing 0.9 kg from the previous year's column.",
          "Personally lathe-turned splined shafts, waterjet-cut rack mounts, and TIG-welded chassis integration along the load paths.",
          "Used higher-grade critical fasteners and preload-aware retention to prevent looseness from becoming steering play."
        ]
      },
      {
        title: "Status and validation",
        points: [
          "Column finalized at 55-degree posture (Mk.7: 60 degrees), with the wheel 3.5 inches closer to the driver.",
          "The matched 27.5-degree U-joint pair cancels speed ripple per the gallery's ripple-surface model.",
          "Personally made every steering part, with TIG-welded mounts joining the column to the Mk.8 chassis. The installed system has run without issues."
        ]
      }
    ],
    gallery: [
      { src: "assets/linkedin-u-joint.webp", alt: "Steering U-joint hardware installed in the chassis", caption: "U-joint package" },
      { src: "assets/fsae-mk8-live-4.webp", alt: "Mk.8 steering CAD assembly", caption: "Steering assembly CAD" },
      { src: "assets/fsae-mk8-live-5.webp", alt: "Steering speed-ratio ripple surface plot", caption: "U-joint ripple model" },
      { src: "assets/fsae-mk8-live-6.webp", alt: "Elastic torsion sizing plot for steering shaft", caption: "Shaft sizing model" },
      { src: "assets/linkedin-steering.webp", alt: "Steering hardware mounted inside a Formula SAE chassis", caption: "Chassis packaging" },
      { src: "assets/fsae-driver-live.webp", alt: "Kefan driving the Formula SAE car", caption: "Driver validation context" }
    ]
  },
  javelin: {
    kicker: "Aerospace / VTOL / differential thrust",
    title: "Javelin high-speed VTOL drone",
    image: "assets/javelin-3q.webp",
    summary:
      "Tail-sitter VTOL drone targeting 300 km/h without moving control surfaces. It launches vertically, tips onto its belly, and flies like a dart, maneuvering through differential thrust across four motors. The airframe is shaped to reduce drag at 300 km/h.",
    highlights: [
      "Targets 300 km/h without control surfaces: four-motor differential thrust provides yaw, pitch, and roll, placing control demands on autopilot tuning.",
      "Drag-driven airframe: Von Karman ogive nose, swept wing, NACA-0008 stabilizers, streamlined motor fairings, and CG ahead of the center of pressure for high-speed stability.",
      "Function-matched 3D-printed materials: PPA-CF chassis (stiffness/heat), ASA antenna fairings (RF-transparent), PC-FR parts (flame-retardant), and bonded 3x1.5 mm carbon-fiber tube spars through wing and tail.",
      "Avionics on a Matek H743-WING running ArduPlane: pitot/airspeed sensor for stall prevention, GPS auto-return-home, integrated Remote ID, and EMI-aware HV/LV cable separation.",
      "Designed from a ~24-item requirements matrix, with custom carbon-tube cutting jig and motor thrust test stand, quick-release body, and XT90-S anti-spark connectors throughout.",
      "Built and fully modeled; awaiting flight while seeking FAA clearance to exceed the 100 mph UAS limit before a 300 km/h first flight."
    ],
    tools: ["SolidWorks", "ArduPilot / ArduPlane", "CFD", "3D printing (PPA-CF / PC-FR)", "Carbon-rod reinforcement", "Differential thrust", "FPV"],
    details: [
      {
        title: "Concept",
        points: [
          "Four-motor tail-sitter: vertical quadcopter takeoff, then a tip-over into forward flight.",
          "No flaps, ailerons, rudders, or servos: simpler mechanics require harder software, with all attitude control through motor mixing.",
          "The 300 km/h target drives every shape and material decision."
        ]
      },
      {
        title: "Aerodynamics and structure",
        points: [
          "Von Karman ogive nosecone minimizes drag; the swept wing delays drag rise and houses motor arms.",
          "Thin symmetric NACA-0008 stabilizers and streamlined motor fairings reduce frontal drag.",
          "CG ahead of the center of pressure supports high-speed stability; embedded 3x1.5 mm carbon-fiber tubes are bonded through wing and stabilizers. Designed a dedicated tube-cutting jig."
        ]
      },
      {
        title: "Propulsion and power",
        points: [
          "Four T-Motor F90 2806 motors use tractor props for clean airflow and cooling.",
          "Two parallel 4S LiPo packs maintain 14.8 V while roughly doubling current and burst capacity for sustained high-speed power.",
          "Testing multiple high-pitch APC props; standardized XT90-S anti-spark connectors manage inrush current."
        ]
      },
      {
        title: "Avionics and electronics",
        points: [
          "Matek H743-WING runs ArduPlane VTOL/tail-sitter modes and motor mixing; the Matek M10Q-5883 GPS/compass faces skyward.",
          "Matek ASPD-4525 airspeed sensor uses a pitot tube beyond the nose and short silicone tubing for accurate, low-lag stall-prevention readings.",
          "ELRS radio, FPV camera, 5.8 GHz VTX with tail-mounted antenna for clearance, Holybro Remote ID, and separated HV/LV cabling to minimize EMI."
        ]
      },
      {
        title: "Status and next steps",
        points: [
          "Airframe and full CAD complete; electronics selected and integrated.",
          "Not airborne yet by design: finalizing fail-safe behavior because failure at 300 km/h carries serious risk.",
          "Researching FAA compliance for speeds beyond small-UAS limits and tuning ArduPlane attitude control through differential-thrust mixing."
        ]
      }
    ],
    gallery: [
      { src: "assets/javelin-3q.webp", alt: "Javelin VTOL drone three-quarter view showing the ogive nose, swept wings, and four motors", caption: "Printed PPA-CF / PC-FR" },
      { src: "assets/cover-javelin.webp", alt: "Javelin front view with four motors in an X and the camera at the nose", caption: "Front / X-config" },
      { src: "assets/javelin-nose.webp", alt: "Von Karman ogive nose with the extended pitot tube", caption: "Ogive nose and pitot" },
      { src: "assets/javelin-motor.webp", alt: "T-Motor F90 and propeller mounted on the swept wing", caption: "Tractor motor" },
      { src: "assets/javelin-rear.webp", alt: "Javelin rear three-quarter showing the swept wing and stabilizers", caption: "Swept wing and tail" },
      { src: "assets/javelin-outdoor.webp", alt: "Javelin resting outdoors" }
    ]
  },
  ansysCfd: {
    kicker: "Ansys Fluent / PyFluent / CFD automation",
    title: "Agent-based CFD",
    image: "assets/cover-ansys-cfd.webp",
    summary:
      "Open teaching package for AI agents running Ansys Fluent 2024 R1 headlessly through PyFluent, using a VTOL drone cruise validation case.",
    highlights: [
      "Turned a completed Javelin VTOL cruise CFD run at 300 kph, Mach 0.245, into reusable agent instructions.",
      "Packaged a system prompt, workflow SOP, PyFluent playbook, failure recovery catalog, quality gates, templates, and verified reference scripts.",
      "Documented 11 real failures, including headless STEP import crashes, wrap-mesh traps, silent far-field key failures, and orphaned MPI processes holding a license seat.",
      "Replaced failed wrap-mesh refinement with a conforming multi-region mesh and one pressure-far-field boundary, preserving CAD fidelity.",
      "Added anti-fabrication gates: read back critical Fluent settings, label coefficients using estimated references as process-validation values, and exclude unverified results from design-grade claims."
    ],
    tools: ["Ansys Fluent 2024 R1", "PyFluent 0.17.1", "Python", "PowerShell", "CFD post-processing", "Quality gates"],
    details: [
      {
        title: "Project goal",
        points: [
          "Tested whether an AI coding agent could run a reviewable CFD workflow in desktop engineering software without a GUI.",
          "The teaching package covers launching Fluent, managing files, monitoring solves, and reporting credibility beyond a single simulation.",
          "The source Javelin VTOL cruise case runs at 300 kph, Mach 0.245; results using estimated references are explicitly labeled process-validation level."
        ]
      },
      {
        title: "Workflow package",
        points: [
          "Includes a system prompt, step-by-step SOP, PyFluent playbook with real 2024 R1 API keys, failure-recovery catalog, quality gates, report templates, and verified reference scripts.",
          "Reference scripts cover solver setup, conforming far-field solve, post-processing images, audit checks, and reporting, helping other agents avoid known failures.",
          "Every stage has a gate: geometry, mesh, solver setup, convergence, y+, force extraction, post-processing, and credibility labeling."
        ]
      },
      {
        title: "Technical breakthrough",
        points: [
          "The initial fault-tolerant wrap mesh ran but lost CAD surface fidelity and resisted reliable headless refinement.",
          "A conforming watertight mesh solved as a multi-region case with one pressure-far-field boundary preserved smooth CAD surfaces and avoided brittle region extraction.",
          "Final setup: compressible ideal-gas physics, k-omega SST, Mach 0.245, and a verified angle-of-attack flow vector."
        ]
      },
      {
        title: "Failure recovery",
        points: [
          "Cataloged 11 failures and fixes: SpaceClaim headless crashes, interactive TUI report loops, premature default convergence, hidden moment report defaults, and report-file liveness traps.",
          "Clean up the entire Fluent process family, including mpiexec and cortex, before relaunching; orphaned MPI processes can hold the license seat.",
          "Treat silent no-op settings as blockers: read back far-field Mach and flow direction, then abort on mismatches."
        ]
      },
      {
        title: "Professional standard",
        points: [
          "Clearly distinguishes process validation from design-grade CFD, making limitations visible in the reported results.",
          "Coefficients using estimated reference area, reference length, or moment center are labeled process-validation values only.",
          "Demonstrates simulation automation, engineering judgment, and agent instruction design through a disciplined CFD process."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-ansys-cfd.webp", alt: "Ansys Fluent pressure coefficient result on a VTOL drone model", caption: "Conforming Cp result" },
      { src: "assets/ansys-cfd-streamlines.webp", alt: "Velocity streamlines around a VTOL drone CFD model", caption: "Velocity streamlines" },
      { src: "assets/ansys-cfd-mach-plane.webp", alt: "Mach number plane plot around the VTOL drone", caption: "Mach plane" },
      { src: "assets/ansys-cfd-wall-shear.webp", alt: "Wall shear stress contour on the VTOL drone CFD model", caption: "Wall shear stress" },
      { src: "assets/ansys-cfd-agent-orchestration.webp", alt: "AI agent background tasks running a headless Ansys Fluent solve", caption: "Agent orchestration" },
      { src: "assets/ansys-cfd-smooth-cp-validation.webp", alt: "AI agent report comparing smooth conforming CFD result to the original wrap mesh", caption: "Conforming Cp validation" }
    ]
  },
  seat: {
    kicker: "Formula SAE / cockpit / ergonomics",
    title: "Driver seat and harness",
    image: "assets/cover-aluminum-seat.webp",
    summary:
      "Cockpit seat and harness package balancing driver fit, lateral support, reliable mounts, fast service access, and rules compliance.",
    highlights: [
      "Validated cockpit fit across ~20 drivers of varying heights using CAD body positioning and physical fit studies.",
      "Covered the shortest-to-tallest driver range with boosters and flexible mounting points.",
      "Upgraded restraint to a six-point harness with an anti-submarine strap on a dedicated chassis bar.",
      "Used welded chassis tabs and multiple seat hard points for reliable retention and fast service.",
      "Fit the seat within the cockpit template alongside steering, pedal tray, and bodywork."
    ],
    tools: ["SolidWorks", "Cockpit fit study", "Driver measurements", "Harness routing", "Mount design"],
    details: [
      {
        title: "Role and requirements",
        points: [
          "Owned seat and harness design during the Mk.7/Mk.8 transition, balancing driver retention, serviceability, comfort, and rules compliance.",
          "Required cornering and braking support at a weight suitable for a Formula SAE electric car.",
          "Respected cockpit opening, steering wheel placement, pedal position, and harness geometry."
        ]
      },
      {
        title: "Driver fit strategy",
        points: [
          "Evaluated multiple driver sizes with CAD body models and physical fit checks.",
          "Planned booster-seat or cushion options for smaller drivers while keeping taller drivers within the cockpit envelope.",
          "Balanced comfort and lateral restraint with exit, service, and harness access."
        ]
      },
      {
        title: "Mounting and harness interfaces",
        points: [
          "Developed mounts using chassis-welded tabs, multiple seat hard points, and dedicated harness bars or tabs.",
          "Upgraded to a six-point harness with an anti-submarine strap on a dedicated chassis bar.",
          "Integrated the seat with pedal tray, steering column, frame tubes, and bodywork."
        ]
      },
      {
        title: "Status and validation",
        points: [
          "Validated fit across roughly 20 drivers using CAD body positioning and physical checks.",
          "Six-point harness and anti-submarine strap on a dedicated chassis bar; seat retained by welded chassis tabs.",
          "Full package fits the FSAE cockpit template alongside steering column, pedal tray, and bodywork."
        ]
      }
    ],
    gallery: [
      { src: "assets/seat-cad.webp", alt: "CAD model of a Formula SAE driver seat", caption: "Seat CAD" },
      { src: "assets/seat-fea.webp", alt: "Seat support finite element analysis result", caption: "Seat analysis" },
      { src: "assets/fsae-mk7-cockpit.webp", alt: "Formula SAE cockpit and driver packaging image", caption: "Cockpit package" },
      { src: "assets/fsae-mk7-shop.webp", alt: "Olin Electric Motorsports car in a paddock setting", caption: "Vehicle context" }
    ]
  },
  carbonSeat: {
    kicker: "Formula SAE / composites / support",
    title: "Carbon fiber seat",
    image: "assets/cover-carbon-fiber-seat.webp",
    summary:
      "Composite seat and bodywork support improving shoulder retention, driver support, repairability, and manufacturability.",
    highlights: [
      "Added a carbon shoulder- and hip-support shell above the seat pan for retention under cornering load.",
      "Chose the carbon-fiber layup for stiffness-to-weight where driver retention mattered more than a metal pan.",
      "Designed shell and bodywork for removal, repair, and reassembly within a race weekend.",
      "Shaped geometry around practical layup and trimming limits.",
      "Used Mk.7 build experience to address Mk.8 cockpit support and service issues."
    ],
    tools: ["Composite layup planning", "Carbon fiber", "Bodywork DFM", "Driver ergonomics", "Repairability review"],
    details: [
      {
        title: "Design intent",
        points: [
          "Targets the upper cockpit, where shoulder retention and upper-body support matter under cornering and other lateral loads.",
          "Uses flanges, support layers, and local stiffness around the driver's torso beyond a flat floor insert.",
          "Accommodates bodywork, harness routing, chassis tubes, and inspection access."
        ]
      },
      {
        title: "Composite choices",
        points: [
          "Evaluated carbon fiber for lightweight stiffness and driver retention.",
          "Layup planning covers epoxy safety, repair access, repeatability, and installation or removal without damaging adjacent panels.",
          "Reviewed bodywork for robust panels that can be removed, repaired, and reassembled during a race weekend."
        ]
      },
      {
        title: "Manufacturing constraints",
        points: [
          "Kept geometry compatible with practical layup and trimming, avoiding overcomplicated surfaces that work only in CAD.",
          "Used the Mk.7 build to identify seat support, bodywork, and cockpit service-access problems.",
          "Prioritized stiffness, driver fit, and repairability to justify composite weight and manufacturing effort."
        ]
      },
      {
        title: "Status",
        points: [
          "Laid up and trimmed the shell over the seat mold for the Mk.8 cockpit; gallery shows layup and weave.",
          "Designed for removal, repair, and reassembly within a race weekend, addressing Mk.7 service issues."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-carbon-fiber-seat.webp", alt: "Carbon fiber seat support shell filling the work surface", caption: "Demolded" },
      { src: "assets/carbon-seat-layup-interior.webp", alt: "Carbon fiber seat layup around a gray mold", caption: "Male mold" },
      { src: "assets/carbon-seat-weave-close.webp", alt: "Close view of the carbon fiber weave over the seat support surface", caption: "Carbon fiber cloth layup" },
      { src: "assets/carbon-seat-trimmed-shell.webp", alt: "Trimmed carbon fiber seat support shell after curing", caption: "Trimmed seat" }
    ]
  },
  brakeSim: {
    kicker: "Formula SAE / MATLAB / brake thermal model",
    title: "FSAE Brake Sim",
    image: "assets/oem-brake-fea.webp",
    summary:
      "Rotor and pad temperature model for Mk.8: a 25 percent rotor mass-reduction target, checked against endurance heat loads and structural FEA.",
    highlights: [
      "Modeled a 22-lap FSAE endurance cycle with 25 track segments of varying velocity and brake demand.",
      "Predicted rotor temperature using heat input, hub conduction, radiation, and velocity-dependent convection.",
      "Used brake-bias assumptions and high-load course zones to locate critical temperature peaks.",
      "Selected cast iron ASTM A48 Class 40 rotors over exotic materials for conductivity, cost, and manufacturability.",
      "Linked results to Wilwood GP200 calipers, BP-28 pads, AN3 service disconnects, a 25 percent rotor mass-reduction target, and a 3.0 structural FEA safety factor."
    ],
    tools: ["MATLAB", "Thermal modeling", "Track segmentation", "FEA", "Brake bias", "Wilwood BP-28 data"],
    details: [
      {
        title: "Model objective",
        points: [
          "Modeled how much rotor mass could be removed while keeping pad and rotor temperatures within usable ranges.",
          "Simulated repeated thermal loading over 22 endurance laps, with 25 track segments defining heat input and cooling windows.",
          "Repeated thermal loading supports FSAE reliability decisions, where heat soak and repeatability matter."
        ]
      },
      {
        title: "Thermal implementation",
        points: [
          "Split the course into braking and cooling zones with varying velocity, deceleration, and heat transfer.",
          "Estimated braking-work heat input and distributed it using front/rear bias assumptions.",
          "Included hub conduction, radiation, and speed-dependent convection."
        ]
      },
      {
        title: "Hardware decisions",
        points: [
          "Favored cast iron for conductivity above 52 W/m-K, friction pairing, cost, and manufacturability.",
          "Linked the model to Wilwood GP200 calipers and BP-28 pads, whose 0.46-0.48 high-temperature friction coefficient set the target operating range.",
          "Considered AN3 quick-disconnects for faster brake-line replacement."
        ]
      },
      {
        title: "Validation and tradeoffs",
        points: [
          "Checked against Mk.7 and peer-team data because brake thermal models are sensitive to assumptions.",
          "Balanced surface area and thermal mass against rotational inertia and unsprung mass.",
          "Provided a defensible rotor-sizing baseline balancing a 25 percent mass reduction target with a 3.0 structural factor of safety."
        ]
      }
    ],
    gallery: [
      { src: "assets/oem-brake-fea.webp", alt: "Brake rotor finite element analysis result", caption: "Rotor FEA" },
      { src: "assets/fsae-mk8-live-1.webp", alt: "Brake rotor and pad temperature over endurance laps", caption: "Track-based thermal model" },
      { src: "assets/fsae-mk8-live-3.webp", alt: "Perforated brake rotor CAD pattern", caption: "Rotor geometry" }
    ]
  },
  scanner: {
    kicker: "LiDAR / motion control / data capture",
    title: "3D scanner",
    image: "assets/scanner-live-7.webp",
    summary:
      "Gantry scanner reconstructing geometry from 2,206 calibrated TFmini-S LiDAR readings along a controlled Cartesian path. Built in one week for Olin's Principles of Integrated Engineering course.",
    highlights: [
      "Calibrated at 14 known distances, reducing stable-range error below 3 percent beyond roughly 30 cm.",
      "Captured 2,206 measurements over a 140 mm by 165 mm area of a small test object.",
      "Owned LiDAR calibration, electrical architecture, and gantry mechanism design with teammate Jacob Likins.",
      "Built around Arduino Nano ESP32, DRV8825 drivers, NEMA 17 steppers, 12 V supply, and an emergency stop.",
      "Replaced a less accurate servo pan/tilt concept with a gantry for repeatable scan coordinates.",
      "Reduced sensor power-supply noise through shielding, copper foil, and wiring changes."
    ],
    tools: ["Arduino Nano ESP32", "TFmini-S LiDAR", "MATLAB Curve Fitter", "Python", "DRV8825", "NEMA 17"],
    details: [
      {
        title: "Role and system",
        points: [
          "Designed and assembled the gantry, calibrated TFmini-S LiDAR, and built the Arduino Nano ESP32 electrical system.",
          "Raster motion pairs each distance reading with carriage position to plot the object's digital outline.",
          "Worked with teammate Jacob Likins on repeatable motion and clean sensor data."
        ]
      },
      {
        title: "Calibration",
        points: [
          "Measured 14 known distances with a ruler and fitted a LiDAR correction curve in MATLAB Curve Fitter.",
          "Readings below about 30 cm were less stable, so sensor placement used the more reliable range.",
          "Calibration reduced stable-range error below roughly 3 percent at the intended object distance."
        ]
      },
      {
        title: "Electrical and EMI control",
        points: [
          "Used a 12 V, 12.5 A motor supply, DRV8825 drivers, motor-rail capacitors, and fan cooling.",
          "Emergency stop cuts motor voltage while keeping Arduino logic alive, preserving state during safer testing.",
          "Copper-lined the PETG enclosure and shielded LiDAR wiring to reduce power-supply and motor noise."
        ]
      },
      {
        title: "Mechanical and motion logic",
        points: [
          "Built Y-axis motion with dual M8 lead screws and guide rods; belt-driven X axis uses 1/16 microstepping.",
          "Homed against physical limit switches to establish carriage coordinates before scanning.",
          "Captured 2,206 raster-scan LiDAR points, integrating motion, sensing, calibration, and data visualization."
        ]
      }
    ],
    gallery: [
      { src: "assets/scanner-live-7.webp", alt: "Physical gantry-based 3D scanner prototype", caption: "3D-Scanner" },
      { src: "assets/scanner-live-5.webp", alt: "CAD model of the gantry-based 3D scanner", caption: "Gantry CAD" },
      { src: "assets/scanner-live-1.webp", alt: "LiDAR calibration curve and formula", caption: "Calibration curve" },
      { src: "assets/scanner-live-2.webp", alt: "LiDAR percentage error before and after calibration", caption: "Calibration result" },
      { src: "assets/scanner-live-3.webp", alt: "3D scanner wiring diagram", caption: "Electrical architecture" },
      { src: "assets/scanner-live-4.webp", alt: "TFmini-S LiDAR sensor and voltage converter", caption: "Sensor package" },
      { src: "assets/scanner-live-6.webp", alt: "Scanned Mercedes-style object and resulting scan plot", caption: "Scan output" }
    ]
  },
  formlabs: {
    kicker: "2.5-day hardware sprint",
    title: "Smelly",
    image: "assets/cover-perfume-dispenser.webp",
    summary:
      "Gantry and actuator hardware for Smelly, Team Scent-A-Tubbies' fully automated perfume-mixing vending machine at a Formlabs hackathon.",
    highlights: [
      "Built in 2.5 days around a digital scent profile and six fragrance bases.",
      "Designed and fabricated the custom gantry plus linear actuator mechanisms.",
      "Compared stepper lead-screw and rack-and-pinion actuators under hackathon time pressure.",
      "Fabricated quickly with Formlabs Form 4 and Bambu Lab P1S printers.",
      "Diagnosed continuous-duty lead-screw actuator overheating to inform actuator selection."
    ],
    tools: ["Raspberry Pi", "Formlabs Form 4", "Bambu Lab P1S", "Lead screw actuator", "Rack and pinion", "Rapid prototyping"],
    details: [
      {
        title: "Role and product concept",
        points: [
          "Worked with Team Scent-A-Tubbies on Smelly, an automated vending machine mixing perfume from digital scent profiles.",
          "Owned mechanical gantry and linear actuator design/fabrication; teammates integrated software and dispensing.",
          "Required motion between six fragrance bases and physical dispensing actuation within the short sprint."
        ]
      },
      {
        title: "Motion architecture",
        points: [
          "Designed a compact Raspberry Pi-controlled gantry to index the dispenser between fragrance bottles.",
          "Created stepper lead-screw and rack-and-pinion actuator concepts.",
          "Planned printing, assembly, and debugging to leave time for full-machine integration."
        ]
      },
      {
        title: "Fabrication constraints",
        points: [
          "Used Formlabs Form 4 and Bambu Lab P1S printing to balance fine-detail resin parts with faster FDM iteration.",
          "Prioritized motion-critical tolerances over details that would not affect the demo.",
          "Balanced ideal mechanisms against hardware that could be built within the day."
        ]
      },
      {
        title: "Failure and learning",
        points: [
          "Sustained operation overheated the stepper lead-screw actuator, exposing duty-cycle and thermal-management issues.",
          "Actuator selection must account for runtime alongside force, stroke, and CAD packaging."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-perfume-dispenser.webp", alt: "Automated perfume dispenser prototype with gantry and fragrance bottles", caption: "Integrated prototype" },
      { src: "assets/formlabs-smelly-actuator.webp", alt: "Wiring and actuator system for perfume dispenser", caption: "Actuator wiring" },
      { src: "assets/formlabs-smelly-table.webp", alt: "Perfume dispenser test setup with gantry and fragrance bases", caption: "Dispensing test" },
      { src: "assets/formlabs-smelly.webp", alt: "Smelly automated perfume dispenser close-up", caption: "Final presentation" }
    ]
  },
  vineRobot: {
    kicker: "Olin Vine Robotics Lab / pressure vessel / 2026",
    title: "Vine everting robot",
    image: "assets/cover-vine-robot.webp",
    gallery: [
      { src: "assets/vine-body-3partition.webp", alt: "The reinforced vine robot in the shop everting a large three-partition vine body across the bench", caption: "3-partition body everted" },
      { src: "assets/vine-body-stick.webp", alt: "The reinforced vine robot everting a stick-reinforced vine body, its bamboo rods visible along the length", caption: "Stick-reinforced body" },
      { src: "assets/vine-test-rig.webp", alt: "The deformation test rig: timber frame on adjustable feet with vertical guide rods, a load shape over the pressurised vine body, and the robot outlet at right", caption: "Deformation test rig" },
      { src: "assets/vine-robot-built.webp", alt: "The first build of the vine everting robot: transparent polypropylene pressure vessel with a bolted printed lid, bolted outlet flange and a vine body everted through the outlet", caption: "First build" },
      { src: "assets/vine-lid-exploded.webp", alt: "Exploded CAD view of the lid assembly: motor, printed lid, TPU gasket and the flange-gripping lid mount with its bolt ring", caption: "Lid assembly" },
      { src: "assets/vine-outlet-exploded.webp", alt: "Exploded CAD view of the vine outlet with its cross-section converter, gasket and bolt ring", caption: "Outlet + converter" },
      { src: "assets/vine-reinforced-cad.webp", alt: "CAD of the reinforced robot with aluminium plates on every face and three C-shaped steel brackets", caption: "Reinforced build" },
      { src: "assets/vine-fea-deformation.webp", alt: "FEA displacement result on the reinforcement structure, peaking at 6.5 mm", caption: "FEA — 6.5 mm peak" },
      { src: "assets/vine-fea-stress.webp", alt: "FEA von Mises stress detail on the reinforcement, peaking at 0.234 GPa", caption: "FEA — 0.234 GPa" },
    ],
    spec: {
      meta: [
        ["Role", "Research assistant"],
        ["Term", "May – Aug 2026"],
      ],
      stats: [
        ["5 psi", "Design pressure"],
        ["45", "Experiment runs"],
      ],
    },
    summary:
      "A 34 kPa (5 psi) vessel for soft-vine cross-section deformation research at the Olin Vine Robotics Lab: 19 L polypropylene pail, bolted PETG lid, printed TPU gaskets, swappable outlets, and motor-driven internal spool. After the first build yielded at 1.2 psi, I added aluminum and steel reinforcement and re-validated it in FEA, then ran a 45-test factorial experiment and measured material inputs for the lab's prediction model.",
    highlights: [
      "Bolted the lid against the underside of the pail flange with 39 Grade 12.9 M4x30 bolts, carrying the ~2,304 N (518 lbf) blow-off load in tension instead of a snap fit.",
      "Printed TPU 85A gaskets (0.5-3 mm) for five seal families; the soft durometer conforms to FDM layer lines under bolt preload, making the printed vessel sealable.",
      "Used a fixed outlet with swappable cross-section converters, making new vine geometry a one-part change instead of a rebuild; the outlet also stiffens the cut side wall.",
      "A spool holder transfers vine tension and spool weight from the motor shaft to a bearing; a flexible coupling absorbs misalignment.",
      "First test held 1.2 psi versus a 0.71 psi thin-wall hand calculation; failures progressed from coupler to vine-to-spool joint, then leaks.",
      "Reinforced all four faces with 6061 plate, an aluminum lid, and three C-shaped A36 brackets. FEA at 500 lbf per face (5.8 psi): 6.5 mm peak deformation, 0.234 GPa peak stress versus A36's 0.25 GPa yield.",
      "Ran a 45-test factorial: three body types (circular, 3-partition, stick-reinforced), two load shapes, three pressures, and two loads.",
    ],
    tools: [
      "SolidWorks",
      "FEA (SolidWorks Simulation)",
      "FDM printing (PETG / TPU 85A)",
      "Instron 3345",
      "ASTM D882",
      "Aluminum + A36 fabrication",
      "Pressure testing",
      "3D scanning",
    ],
    details: [
      {
        title: "Role and requirements",
        points: [
          "Full-time summer research assistant, Olin Vine Robotics Lab (May - Aug 2026); owned the robot everting vine bodies for cross-section deformation experiments.",
          "Targets: hold 34 kPa (5 psi), a 3.33 factor of safety over the 10.3 kPa test maximum; accept up to 571 mm (22.5 in) body circumference; swap bodies for more than 15 daily trials.",
          "Required three cross-sections (circular, 3-partition, stick-reinforced) and enough transparency to debug eversion faults externally.",
        ],
      },
      {
        title: "Pressure vessel and sealing",
        points: [
          "Selected a stock transparent 19 L (5 gal) polypropylene pail with 1.4 mm walls: the shop's sheet metal tooling and budget ruled out a precise custom metal vessel, while flat sides supported component mounts.",
          "The stock snap lid could neither seal nor support the motor and drive shaft. A custom PETG lid and mount grip behind the pail flange; the mount was later welded to the flange for airtightness.",
          "FDM-printed TPU 85A gaskets replace hand-cut seals to match each joint's geometry precisely; compared with machined faces, printed joints demand greater attention to stiffness and bolt count.",
        ],
      },
      {
        title: "Outlet and drivetrain",
        points: [
          "The hand-cut outlet is the robot's highest-stress region. It mounts from inside with wide flanges to increase both sealing contact area and area moment of inertia.",
          "Converters bolt to the fixed outlet through separate TPU gaskets, accommodating all three body types.",
          "Uneverted bodies wind onto an internal spool on two flanged ball bearings, DC-motor-driven through a McMaster 6133N114 flexible coupling and 8 mm steel shaft.",
        ],
      },
      {
        title: "Test, failure, reinforcement",
        points: [
          "Lab high-pressure testing held 1.2 psi versus the 0.71 psi wall-yield hand calculation, with significant deformation, TPU coupler decoupling, vine-to-spool connection failure, and minor leaks.",
          "PLA-welded leaks; added 6061 plates to both sides, back, and bottom, an aluminum replacement lid, three C-shaped A36 steel brackets, and PETG connection brackets. Open cutouts preserved debugging visibility.",
          "Reinforcement FEA at 500 lbf per face (5.8 psi): 6.524 mm maximum deformation and 0.2339 GPa maximum stress versus A36 steel's 0.25 GPa yield. The vine outlet remains weakest.",
        ],
      },
      {
        title: "The experiment it runs",
        points: [
          "Full factorial: 3 body types x 2 load shapes x 3 pressures x 2 loads = 36 loaded conditions, plus 9 unloaded baselines, for 45 runs.",
          "The rig uses four 10 mm steel rods, eight linear bearings, and a dovetail connector for quick load-shape swaps. A 0.01 kg scale directly beneath the vine measures actual force, since rod-bearing friction makes applied weight a poor proxy for the load reaching the body.",
          "Two-stage regulation reduces 862 kPa (125 psi) shop air to a 34 kPa outlet gauge; Creality scans capture deformed geometry for comparison with the prediction model.",
        ],
      },
      {
        title: "Feeding the model",
        points: [
          "Measured membrane and rod bending stiffness on an Instron as direct model inputs, rather than using literature values; see the material property testing case study.",
        ],
      },
    ],
  },
  materialTest: {
    kicker: "Olin Vine Robotics Lab / Instron / 2026",
    title: "Material property testing",
    image: "assets/cover-material-test.webp",
    gallery: [
      { src: "assets/cover-material-test.webp", alt: "Engineering stress against extension over the first 25 mm for TD, MD and 45 degree fabric plus LDPE, each specimen drawn faintly behind its group mean", caption: "Stress vs extension, 0–25 mm" },
      { src: "assets/material-instron-frame.webp", alt: "The Instron 3345 single-column test frame with its tensile grips and control panel", caption: "Instron 3345" },
      { src: "assets/material-specimen-td.webp", alt: "Digital caliper measuring the width of a transverse-direction fabric specimen labelled TD-1 in the grips", caption: "TD specimen" },
      { src: "assets/material-specimen-md.webp", alt: "Digital caliper measuring a machine-direction fabric specimen labelled MD-1", caption: "MD specimen" },
      { src: "assets/material-specimen-45.webp", alt: "Digital caliper measuring a 45 degree fabric specimen labelled 45-1", caption: "45° specimen" },
      { src: "assets/material-specimen-ldpe.webp", alt: "Digital caliper measuring an LDPE film specimen labelled LDPE-1", caption: "LDPE specimen" },
      { src: "assets/material-bending-fixture.webp", alt: "A bamboo rod deflected between the outer supports of the flexure fixture during a bending test", caption: "Bamboo in the fixture" },
      { src: "assets/material-stress-extension-full.webp", alt: "Engineering stress against extension over the full test range for every specimen group", caption: "Full extension range" },
      { src: "assets/material-stress-strain-md.webp", alt: "Engineering stress-strain curves for the machine-direction fabric specimens", caption: "MD stress–strain" },
      { src: "assets/material-stress-strain-ldpe.webp", alt: "Engineering stress-strain curves for the LDPE film specimens", caption: "LDPE stress–strain" },
      { src: "assets/material-tensile-summary.webp", alt: "Bar chart of engineering tensile modulus with error bars for the fabric in TD, MD and 45 degrees plus LDPE film", caption: "Tensile summary" },
      { src: "assets/material-modulus-polar.webp", alt: "Polar plot of the measured directional Young's modulus of the TPU-coated fabric, stiffest along the weave axes and minimum near 46 degrees", caption: "Directional modulus" },
      { src: "assets/material-bending-fits.webp", alt: "Force-deflection curves for all eleven bamboo samples in three-point bending", caption: "Force–deflection, 11 rods" },
      { src: "assets/material-bending-summary.webp", alt: "Per-sample bending stiffness EI and estimated bending modulus for the eleven bamboo rods against their means", caption: "Per-rod EI and E" },
    ],
    spec: {
      meta: [
        ["Role", "Research assistant"],
        ["Standard", "ASTM D882"],
      ],
      stats: [
        ["30", "Tensile specimens"],
        ["11", "Bending tests"],
      ],
    },
    summary:
      "Measured membrane and rod bending stiffness for the Olin Vine Robotics Lab's cross-section model using an Instron 3345: ASTM D882 tension on 30 film and fabric specimens, three-point bending on 11 bamboo reinforcing rods, and a plane-stress orthotropic fit to the fabric results.",
    highlights: [
      "Tested TPU-coated fabric in three directions because its weave is orthotropic: MD 76.30 +/- 3.08 MPa, TD 69.89 +/- 2.47 MPa, 45 deg 41.78 +/- 0.99 MPa; LDPE film measured 100.96 +/- 5.00 MPa.",
      "Every group's scatter stayed under 4.9% of its mean; on-axis fabric fits reached R2 0.99.",
      "The 45 deg modulus is ~55% of MD, indicating shear-governed off-axis response. Three measurements determine the plane-stress compliance model, with a minimum near 46 deg.",
      "Three-point bending on 11 rods: 81.7 +/- 7.7 N/mm stiffness, EI = 0.672 +/- 0.063 N.m2, E = 0.678 +/- 0.055 GPa; every fit exceeded R2 0.999.",
      "Adapted gauge length to available grips: 100 mm versus 250 mm nominal, with crosshead speeds following the standard's strain-rate rule.",
    ],
    tools: [
      "Instron 3345 (5 kN)",
      "ASTM D882",
      "Three-point bending",
      "Orthotropic modelling",
      "Least-squares fitting",
      "Data analysis",
    ],
    details: [
      {
        title: "Why measure it at all",
        points: [
          "The lab's cross-section prediction model takes vine membrane and bamboo rod bending stiffness directly, so using literature values would propagate those assumptions into every prediction.",
          "Vine bodies use single-side TPU-coated fabric or LDPE film; reinforced bodies add bamboo rods, requiring three separate material characterizations.",
        ],
      },
      {
        title: "Membrane tension, ASTM D882",
        points: [
          "30 specimens: 7 machine-direction, 7 transverse, 8 at 45 deg for fabric, plus 8 LDPE, which showed no directional dependence in pilot testing.",
          "Widths: 23.6-25.4 mm within the standard's 5.0-25.4 mm range. Thickness: fabric 0.19-0.22 mm, LDPE 0.10-0.11 mm. Conditioned and tested at 23 +/- 2 C, 50 +/- 10 % RH.",
          "Standard strain-rate rule: 12.5 mm/min for fabric to 20% strain, 50 mm/min for LDPE to 200 mm. Modulus uses least-squares fitting of the initial linear region.",
        ],
      },
      {
        title: "Orthotropic model of the fabric",
        points: [
          "The plane-stress orthotropic compliance relation converts three measured moduli into a full directional curve, rather than three isolated values.",
          "Fabric model inputs: MD maximum 76.3 MPa, TD 69.9 MPa, and minimum near 41.8 MPa at about 46 deg.",
          "Lower fit quality at 45 deg and for LDPE (R2 0.967 and 0.950) reflects mild curvature in the fit window, limiting confidence in those moduli.",
        ],
      },
      {
        title: "Rod bending",
        points: [
          "No bending standard covers a 0.25 in wood rod. The repeatable setup uses a 73.37 mm support span, 12.5 mm/min crosshead, and 11 rods selected for straightness from the supplied batch.",
          "Fitted each force-deflection curve's initial linear region, roughly 1.3-1.8 mm travel, then converted stiffness to EI using the simply-supported central-load relation.",
          "EI is the model input and primary result; derived modulus is reported only for comparison.",
        ],
      },
    ],
  },
  aura: {
    kicker: "Autonomous luggage robot / swerve drive / 2025",
    title: "AURA swerve drive system",
    image: "assets/aura-swerve.jpeg",
    scrub: { base: "assets/aura_explode/frame_", count: 60 },
    spec: {
      meta: [
        ["Role", "Mechanical lead"],
        ["Process", "Waterjet · TIG weld"],
      ],
      stats: [
        ["300 lb", "Payload"],
        ["18:80", "Steer ratio"],
      ],
    },
    summary:
      "Front-wheel swerve drive for Project AURA, an autonomous luggage robot with a 300 lb payload. My mechanical scope covered independent steering, chain reduction, DC drive motors, robust shafts, and fabricated steel mounts.",
    highlights: [
      "Owned mechanical swerve drive design for a 300 lb-payload luggage robot requiring autonomous driving and steering under load.",
      "Combined drive and steering in two front modules to preserve maneuverability.",
      "Used Ackermann-aware independent steering to reduce scrub and improve turning under heavy load.",
      "Packaged MY1016Z6 24 V DC motors with a 9:16 sprocket ratio for loaded traction and acceleration.",
      "Used NEMA 23 steppers and an 18:80 sprocket reduction at each front wheel to prioritize steering torque.",
      "Fabricated 0.25 in A36 mild-steel wheel housings and motor mounts using OMAX waterjet cutting, TIG welding, and corrosion-control paint."
    ],
    tools: [
      "Swerve drive",
      "Ackermann steering",
      "Chain drive",
      "NEMA 23 stepper motors",
      "MY1016Z6 24 V DC motors",
      "A36 steel",
      "Waterjet",
      "TIG welding"
    ],
    details: [
      {
        title: "Swerve-drive responsibility",
        points: [
          "My contribution centered on front-wheel swerve drive mechanics, not the full autonomy stack.",
          "For the autonomous luggage robot, my mechanical focus was reliable driving and steering while carrying the full 300 lb payload.",
          "Combining drive and steering in the front modules created a compact packaging challenge: motors, sprockets, shafts, chains, bearings, and mounts all had to fit around each wheel."
        ]
      },
      {
        title: "Steering geometry and actuation",
        points: [
          "The two front wheels steer independently to approach Ackermann behavior, reducing wheel scrub when turning under load.",
          "Each NEMA 23 stepper drives an 18:80 sprocket reduction, trading steering speed for torque under load.",
          "Steering-motor placement constrained the design: moving motors toward the robot's center increased sprocket spacing and helped reduce chain skipping."
        ]
      },
      {
        title: "Drive and load path",
        points: [
          "Two MY1016Z6 24 V DC motors and a 9:16 sprocket ratio target roughly 1 m/s^2 acceleration under payload.",
          "LPD3806 encoders on 3/8 in front wheel shafts provide speed and displacement feedback.",
          "The drivetrain uses heavy-duty solid rubber wheels, eight bearings across the wheel assemblies, and steel shafts with redundancy for expected load cases."
        ]
      },
      {
        title: "Fabrication and iteration",
        points: [
          "Used 0.25 in A36 mild steel for strong, weldable wheel housings and motor mounts suited to shop fabrication.",
          "OMAX-waterjetted, TIG-welded, and spray-painted the parts for corrosion protection.",
          "The hardest packaging issue was fitting chains, sprockets, wheels, mounts, and drive hardware without steering interference; testing spacers and shortening mounting hardware resolved it."
        ]
      }
    ],
    gallery: [
      { src: "assets/aura-swerve.jpeg", alt: "AURA front-wheel swerve drive system showing independent steering wheel modules", caption: "Swerve drive system" },
      { src: "assets/aura-chain-tensioner.jpeg", thumbnail: "assets/gallery-previews/aura-chain-tensioner-640.webp", alt: "AURA steering chain tensioner and sprocket package", caption: "Steering chain package" },
      { src: "assets/aura-swerve-mount.jpeg", thumbnail: "assets/gallery-previews/aura-swerve-mount-640.webp", alt: "AURA waterjet and welded swerve mount fabrication", caption: "A36 steel mount" },
      { src: "assets/aura-motor.png", alt: "MY1016Z6 24 volt DC motor used for the AURA drive system", caption: "Drive motor" },
      { src: "assets/aura-wheels-bearing-shaft.jpeg", thumbnail: "assets/gallery-previews/aura-wheels-bearing-shaft-640.webp", alt: "AURA wheel, bearing, and shaft hardware", caption: "Wheel and shaft" },
      { src: "assets/aura-rotary-encoder.jpeg", thumbnail: "assets/gallery-previews/aura-rotary-encoder-640.webp", alt: "AURA rotary encoder mounted to wheel shaft", caption: "Encoder feedback" },
      { src: "assets/aura-battery.jpeg", alt: "AURA 24 volt LiFePO4 battery", caption: "Power package" },
      { src: "assets/aura-system-diagram.png", thumbnail: "assets/gallery-previews/aura-system-diagram-640.webp", alt: "AURA system diagram with Raspberry Pi, sensors, and front wheel drive modules", caption: "System context" }
    ]
  },
  lineFollower: {
    kicker: "Robotics / compact embedded build",
    title: "LineFollower robot",
    image: "assets/line-follower-cover.webp",
    summary:
      "Palm-size line-following robot integrating an Arduino Mega, drive hardware, sensors, and dense wiring. Built in two weeks for Olin's Principles of Integrated Engineering course.",
    highlights: [
      "Packaged an Arduino Mega, motor drivers, battery, sensors, and drive into a palm-size chassis.",
      "Ran stable low-speed line tracking with front-mounted sensing and a compact two-wheel differential drive.",
      "Kept wiring short and serviceable for debugging after assembly.",
      "Tuned sensor thresholds, driver wiring, and drive balance for repeatable tracking.",
      "Integrated controls, packaging, power, and fabrication in a small electromechanical platform."
    ],
    tools: ["Arduino Mega", "Motor drivers", "Sensor packaging", "Embedded wiring", "Mobile robotics"],
    details: [
      {
        title: "System architecture",
        points: [
          "Combined Arduino Mega, front-mounted sensing, motor drivers, compact battery, and two-wheel drive.",
          "Kept electronics visible and wiring orderly within a compact chassis.",
          "Placed the sensor line, wheelbase, and center of mass close together for stable low-speed tracking."
        ]
      },
      {
        title: "Mechanical packaging",
        points: [
          "Stacked the visible controller, wiring, and drive modules around a small wheelbase.",
          "Fit numerous electrical interfaces into limited space.",
          "Kept wire runs short, connector routing clear, and components accessible for iteration."
        ]
      },
      {
        title: "Status",
        points: [
          "Built a palm-size package with Arduino Mega, dual motor drivers, IR reflectance sensing, and power.",
          "Short wiring and accessible connectors allow sensor and drive-module swaps between iterations."
        ]
      }
    ],
    gallery: [
      { src: "assets/line-follower-cover.webp", alt: "Compact line follower robot on a scale", caption: "Full robot package" },
      { src: "assets/line-follower-wiring.webp", alt: "Line follower robot wiring and Arduino Mega", caption: "Lightweighted: 284 g" },
      { src: "assets/line-follower-built.webp", alt: "Built line follower robot with dense wiring", caption: "Prototype: 428 g" }
    ]
  },
  pool: {
    kicker: "Assistive mechanism / powertrain",
    title: "Pool Sniper",
    image: "assets/pool-sniper.webp",
    summary:
      "Accessible pool cue launcher for beginners and users with physical or visual limitations, combining laser aiming, variable-force release, and chain drive.",
    highlights: [
      "Built for break-shot power with adjustable shot force.",
      "Used surgical tubing for energy storage and a sliding trigger for adjustable release.",
      "Added laser aiming and a simple switch to ease shot alignment.",
      "Used a 2:1 sprocket and gear chain drive with rack-and-pinion cue pullback.",
      "Iterated on wiring, compact packaging, plasma-cut tolerances, and long-part lathe work."
    ],
    tools: ["Rack and pinion", "Chain drive", "Surgical tubing", "Laser pointer", "Waterjet", "Lathe", "Tensioner design"],
    details: [
      {
        title: "Objective",
        points: [
          "Designed for beginners, disabled users, and people who struggle to sight or strike a cue consistently.",
          "Required enough stored energy to break, adjustable shot strength, and compact packaging.",
          "Preserved user control through aiming and force selection while automating the shot."
        ]
      },
      {
        title: "Launch mechanism",
        points: [
          "Surgical tubing stores energy; a sliding trigger releases the cue at adjustable pullback distances.",
          "Rack-and-pinion pullback loads the cue; trigger position sets launch force.",
          "Chain drive and sprocket ratio package the motion and provide sufficient pull force."
        ]
      },
      {
        title: "Aiming and usability",
        points: [
          "Laser aiming and a two-way switch enable shots without traditional pool stance or sighting skill.",
          "Kept the device compact and hand-operable.",
          "The sliding trigger provides intuitive, physical shot-power control instead of a hidden software parameter."
        ]
      },
      {
        title: "Build challenges",
        points: [
          "Tight packaging required wire-length planning and fit checks to preserve routing and component access.",
          "Switched from plasma-cut plates with uncontrolled tolerances to waterjet parts for the final build.",
          "Long cue machining required manual finishing; shop iteration brought the mechanism to working condition."
        ]
      }
    ],
    gallery: [
      { src: "assets/pool-sniper.webp", alt: "Pool Sniper cue launcher CAD render", caption: "Full mechanism" },
      { src: "assets/pool-sniper-exploded.webp", alt: "Exploded Pool Sniper mechanism CAD", caption: "Exploded assembly" },
      { src: "assets/pool-sniper-build.webp", alt: "Machined Pool Sniper component plate", caption: "Plasma-cut plate" }
    ]
  },
  education: {
    kicker: "Product design / education / user testing",
    title: "Guitar education kit",
    image: "assets/education-kit.webp",
    summary:
      "Affordable STEAM hardware kit for middle and high school assembly, tested with students, parents, teachers, and community educators.",
    highlights: [
      "Targeted roughly $100 per kit to broaden access to hands-on engineering education.",
      "Used letter-coded screws, color-coded solderless wiring, preassembled shielding, and written instructions.",
      "Tested with younger students, 8th/9th graders, parents, teachers, and community educators.",
      "Older students assembled the kit in about 45 minutes and remained engaged.",
      "Used feedback to raise challenge level, ease wiring concerns, and clarify instructions."
    ],
    tools: ["User testing", "Market research", "3D printing", "Electronics", "Instruction design", "Product iteration"],
    details: [
      {
        title: "Product objective",
        points: [
          "Designed for students to assemble working hardware while learning engineering concepts.",
          "Targeted under-resourced programs with a roughly $100 cost goal.",
          "Required good sound and durability for classroom handling."
        ]
      },
      {
        title: "Design choices",
        points: [
          "Used a 3D printed body, affordable electronics, preassembled copper shielding, and solderless color-coded wiring.",
          "Letter-coded screws and matching instructions reduced first-time builder confusion.",
          "Pre-adjusted neck, bridge, and pickups to improve playability after assembly."
        ]
      },
      {
        title: "Customer experiments",
        points: [
          "Interviewed at least five children and parents; parent research compared the importance of the build experience and finished product in purchasing.",
          "Two 8-year-olds liked customization but found some wiring intimidating and wanted clearer tool and setup guidance.",
          "Two 15-year-old high schoolers found the challenge appropriate and assembled the kit in roughly 45 minutes.",
          "All Saints Church in Worcester expressed interest for its Afternoon Tunes charity music program."
        ]
      },
      {
        title: "Learning",
        points: [
          "Feedback favored STEAM learning over imitating a cheap instrument.",
          "Teacher and community-program feedback emphasized durability, instruction quality, and feasibility within class sessions."
        ]
      }
    ],
    gallery: [
      { src: "assets/education-kit.webp", alt: "Guitar education kit laid out as components", caption: "Kit layout" },
      { src: "assets/education-kit-render.webp", alt: "Blue guitar kit render", caption: "Guitar CAD" },
      { src: "assets/education-kit-experiment.webp", alt: "Exploded CAD view of the guitar kit parts on white", caption: "Exploded view" },
      { src: "assets/education-kit-parts.webp", alt: "STEAM hardware kit market test poster", caption: "Market test poster" }
    ],
    // no 3D exhibit anymore -- the kit was retired from the studio scene
    // (its cabinet slot now holds lineFollower); hides the "view in the
    // studio" link the same way materialTest's old flag used to
    noStudio: true,
  },
  telecaster: {
    kicker: "CNC / finishing / electronics integration",
    title: "Telecaster guitar",
    image: "assets/cover-telecaster.webp",
    summary:
      "Walnut and maple Telecaster-style electric guitar built through material prep, ShopBot CNC routing, drilling, sanding, finishing, and electronics installation.",
    highlights: [
      "Glued smaller walnut pieces into a blank, controlling cost while preserving material quality.",
      "ShopBot CNC-routed body pockets and wiring channels after planning toolpaths and hold-downs.",
      "Validated drilling locations and pocket geometry with laser-cut templates.",
      "Applied a multi-layer white finish in a temporary paint setup over more than a week.",
      "Integrated the electronics package after body fabrication and finishing."
    ],
    tools: ["ShopBot CNC", "Woodworking", "Laser-cut templates", "Finishing", "Electronics", "Fixture planning"],
    details: [
      {
        title: "Material strategy",
        points: [
          "Built the walnut and maple body using smaller walnut pieces glued into a cost-effective blank.",
          "Used Titebond III and overnight clamping before CNC operations.",
          "Fabricated from raw materials rather than assembling a kit."
        ]
      },
      {
        title: "CNC and post-processing",
        points: [
          "ShopBot-routed the body outline, electronics pocket, and wiring channels.",
          "Pre-drilled wiring paths and checked pockets before sanding and finishing.",
          "Laser-cut hole templates reduced hand-drilling errors after CNC work."
        ]
      },
      {
        title: "Finish and electronics",
        points: [
          "Sanded body and edges, then applied a multi-layer white finish in a temporary paint tent.",
          "Surface preparation, drying, and repeat coats extended finishing beyond a week.",
          "Installed electronics after finishing to make the guitar playable."
        ]
      },
      {
        title: "Status",
        points: [
          "Finished, strung, and playable, with working pickups, controls, and output jack on the walnut/maple body.",
          "Documented glue-up, ShopBot routing, laser-cut drilling templates, multi-coat white finish, and electronics installation."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-telecaster.webp", alt: "Finished Telecaster-style guitar in a case", caption: "Finished guitar" },
      { src: "assets/telecaster-body.webp", alt: "White Telecaster-style guitar body", caption: "Finished body" },
      { src: "assets/telecaster-wood.webp", alt: "Guitar body with its first layer of primer", caption: "First layer of primer" },
      { src: "assets/telecaster-cnc.webp", alt: "Guitar body in the painting setup", caption: "Painting setup" },
      { src: "assets/telecaster-finish.webp", alt: "Guitar body clamped during glue-up", caption: "Wood-gluing the body" },
      { src: "assets/telecaster-shopbot.webp", alt: "Walnut guitar body being cut on a ShopBot 3-axis CNC router, dust brush over the blank", caption: "ShopBot 3-axis CNC router" },
      { src: "assets/telecaster-assembly.webp", alt: "Drilling the guitar body holes with a jig", caption: "Drilling holes with a jig" }
    ]
  },
  ftc: {
    kicker: "Competition robotics / mechanism design",
    title: "FTC robot",
    image: "assets/cover-ftc-robot.webp",
    summary:
      "Senior Mechanical Engineer, Pioneer Robotics FTC Team 12589: cone intake and deposit robot for a Massachusetts championship-winning season.",
    highlights: [
      "Supported the 2022-2023 cone intake and deposit robot as Senior Mechanical Engineer.",
      "Contributed to linkage extension, claw and arm intake, string-driven slide, rotational deposit, and mecanum drivetrain.",
      "Robot won the Massachusetts Championship Tournament Winning Alliance.",
      "Team also earned Motivate and Gracious Professionalism awards.",
      "Used odometry and encoders for repeatable autonomous position tracking."
    ],
    tools: ["FTC robotics", "Mecanum drive", "Odometry", "String-driven slides", "Linkage design", "Competition testing"],
    details: [
      {
        title: "Role and season",
        points: [
          "Senior Mechanical Engineer on Pioneer Robotics FTC Team 12589 at Saint John's.",
          "Built for the 2022-2023 cone game with intake, transfer, lift, and deposit functions.",
          "Earned Massachusetts Championship Tournament Winning Alliance and additional team awards."
        ]
      },
      {
        title: "Mechanisms",
        points: [
          "Used linkage extension to reduce unnecessary autonomous movement.",
          "Built claw and arm intake hardware to collect cones and transfer them for scoring.",
          "Integrated string-driven slide and rotational deposit mechanisms for vertical scoring."
        ]
      },
      {
        title: "Drive and autonomous",
        points: [
          "Used belt-drive mecanum for field maneuverability.",
          "Combined odometry and encoders for autonomous position feedback beyond dead reckoning alone.",
          "Designed for repeated competition cycles, quick repairs, and driver practice."
        ]
      },
      {
        title: "Result",
        points: [
          "Demonstrates fast iteration, subsystem integration, and performance under competition pressure.",
          "Established mechanism experience that carried into FSAE vehicle systems."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-ftc-robot.webp", alt: "FTC robot competing on a field with cone scoring elements", caption: "Robot in competition" },
      { src: "assets/ftc-mechanism.webp", alt: "FTC robot slide mechanism close-up", caption: "Slide mechanism prototype" },
      { src: "assets/ftc-action.webp", alt: "FTC competition scoreboard", caption: "Massachusetts State Record: 269" },
      { src: "assets/ftc-cad.webp", alt: "FTC trophies and awards", caption: "Awards" },
      { src: "assets/ftc-robot.webp", alt: "FTC team photo", caption: "Team photo" }
    ]
  }
};

if (typeof window !== 'undefined') window.projectData = projectData;
