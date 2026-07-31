/* Shared project case-study data.
   Loaded (classic script) before script.js on index.html and before
   experience.js on experience.html. Single source of truth. */
const projectData = {
  steering: {
    kicker: "Formula SAE / steering / fabrication",
    title: "Mk.8 steering system",
    image: "assets/cover-steering-system.webp",
    summary:
      "Mk.8 steering column redesign: matched 27.5-degree dual U-joints cancel rotational speed ripple, the wheel sits 3.5 inches closer and 15 degrees more upright than Mk.7, and every part maps to a shop process — lathe shafts, waterjet mounts, CNC bearing cages, TIG-welded chassis integration.",
    highlights: [
      "Matched dual U-joint bend angles to reduce rotational velocity ripple through the steering column.",
      "Moved the wheel 3.5 inches closer and 15 degrees more vertical than Mk.7 to improve driver posture and cockpit clearance.",
      "Lightweighted the steering bearing cages, saving 0.9 kg against the previous year's design.",
      "Analyzed shaft, rack mount, yoke phasing, bearing cage, and fastener decisions against stiffness and slop targets.",
      "Planned fabrication across lathe shafts, waterjet rack mounts, CNC bearing cages, TIG integration, and lock-wired fasteners."
    ],
    tools: ["SolidWorks", "MATLAB", "FEA", "Lathe", "Waterjet", "CNC mill", "TIG weld planning"],
    details: [
      {
        title: "Role and objective",
        points: [
          "Led the cockpit-side steering design as part of OEM Mk.8 development, then stepped into Mechanical Lead ownership for broader vehicle integration.",
          "Primary requirement was a precise, low-slop steering path that fit inside the cockpit template while preserving dashboard space and driver ingress.",
          "The design had to improve ergonomics without introducing binding, speed ripple, or hard-to-service hardware."
        ]
      },
      {
        title: "Kinematic decisions",
        points: [
          "Used a dual U-joint layout with matched bend angles around 27.5 degrees so input and output speed variation cancel more cleanly.",
          "Compared yoke phasing and shaft angle options with a speed-ratio ripple model before locking the column geometry.",
          "Adjusted the column from the previous Mk.7 60-degree posture toward a 55-degree angle and closer wheel location for better driver reach."
        ]
      },
      {
        title: "Hardware and fabrication",
        points: [
          "Designed rack mounts, shaft interfaces, bearing cages, and sensor packaging around realistic shop processes instead of pure CAD convenience.",
          "Reworked the bearing cages for mass as well as stiffness, taking 0.9 kg out of the previous year's column.",
          "Planned lathe work for splined shafts, waterjet parts for rack mounting, and welded chassis integration for load paths.",
          "Moved critical fasteners toward higher-grade hardware and preload-aware retention where looseness would become steering play."
        ]
      },
      {
        title: "Status and validation",
        points: [
          "Column locked at a 55-degree posture (Mk.7: 60 degrees) with the wheel 3.5 inches closer to the driver.",
          "The matched 27.5-degree U-joint pair cancels speed ripple per the ripple-surface model in the gallery.",
          "Parts released to the lathe, waterjet, and CNC mill; the column integrates into the Mk.8 chassis with TIG-welded mounts."
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
      "A tail-sitter VTOL drone with no moving control surfaces, designed for 300 km/h. It launches vertically, tips onto its belly, and flies like a dart — every maneuver produced by varying the speed of four motors (differential thrust). The whole airframe is shaped around one enemy: drag at 300 km/h.",
    highlights: [
      "Targets 300 km/h with zero control surfaces — yaw, pitch, and roll all come from differential thrust across four motors, moving the entire control burden onto the autopilot and tuning.",
      "Drag-driven airframe: Von Karman ogive nose, swept wing, NACA-0008 stabilizers, and streamlined motor fairings; CG placed ahead of the center of pressure for high-speed stability.",
      "3D-printed structure material-matched per function — PPA-CF chassis (stiffness/heat), ASA antenna fairings (RF-transparent), PC-FR parts (flame-retardant) — with 3x1.5 mm carbon-fiber tube spars bonded through the wing and tail.",
      "Avionics on a Matek H743-WING running ArduPlane: pitot/airspeed sensor for stall prevention, GPS auto-return-home, integrated Remote ID, and EMI-aware HV/LV cable separation.",
      "Drove the design from a ~24-item requirements matrix; custom CAD tooling for a carbon-tube cutting jig and a motor thrust test stand; quick-release body and XT90-S anti-spark throughout.",
      "Built and fully modeled, not airborne yet by design: seeking FAA clearance to fly past the 100 mph UAS limit before a 300 km/h first flight."
    ],
    tools: ["SolidWorks", "ArduPilot / ArduPlane", "CFD", "3D printing (PPA-CF / PC-FR)", "Carbon-rod reinforcement", "Differential thrust", "FPV"],
    details: [
      {
        title: "Concept",
        points: [
          "Four-motor tail-sitter that takes off vertically like a quadcopter, tips over, and flies forward like a dart.",
          "No flaps, ailerons, rudders, or servos anywhere — a deliberate trade of simpler mechanics for harder software (all attitude control through motor mixing).",
          "Target top speed of 300 km/h drives every shape and material decision."
        ]
      },
      {
        title: "Aerodynamics and structure",
        points: [
          "Von Karman ogive nosecone for a minimum-drag profile; swept wing to delay drag rise and house the motor arms.",
          "Thin symmetric NACA-0008 stabilizers and streamlined motor fairings to cut frontal drag.",
          "Center of gravity ahead of the center of pressure for stability at speed; embedded 3x1.5 mm carbon-fiber tubes bonded through wing and stabilizers (a dedicated cutting jig was designed to cut them)."
        ]
      },
      {
        title: "Propulsion and power",
        points: [
          "Four T-Motor F90 2806 motors in a tractor layout — props pull rather than push, keeping clean airflow and aiding cooling.",
          "Two 4S LiPo packs wired in parallel hold 14.8 V while roughly doubling current and burst capacity for sustained high-speed power.",
          "High-pitch APC props in multiple pitches under test; XT90-S anti-spark connectors standardized throughout for safe inrush current."
        ]
      },
      {
        title: "Avionics and electronics",
        points: [
          "Matek H743-WING flight controller running ArduPlane for the VTOL/tail-sitter modes and motor mixing; Matek M10Q-5883 GPS/compass facing the sky.",
          "Matek ASPD-4525 airspeed sensor with a pitot tube extended past the nose and short silicone tubing for low-lag, accurate readings used for stall prevention.",
          "ELRS radio link, FPV camera and 5.8 GHz VTX (antenna placed at the tail for clearance), Holybro Remote ID, and separated HV/LV cabling to minimize EMI."
        ]
      },
      {
        title: "Status and next steps",
        points: [
          "Airframe complete, full CAD model finished, electronics selected and integrated.",
          "Not airborne yet by design: at 300 km/h the failure modes get dangerous fast, so fail-safe behavior is being finalized first.",
          "Researching FAA compliance (the target speed is well past small-UAS limits) and tuning ArduPlane attitude control through pure differential-thrust mixing."
        ]
      }
    ],
    gallery: [
      { src: "assets/javelin-3q.webp", alt: "Javelin VTOL drone three-quarter view showing the ogive nose, swept wings, and four motors", caption: "Printed PPA-CF / PC-FR" },
      { src: "assets/cover-javelin.webp", alt: "Javelin front view with four motors in an X and the camera at the nose", caption: "Front / X-config" },
      { src: "assets/javelin-nose.webp", alt: "Von Karman ogive nose with the extended pitot tube", caption: "Ogive nose and pitot" },
      { src: "assets/javelin-motor.webp", alt: "T-Motor F90 and propeller mounted on the swept wing", caption: "Tractor motor" },
      { src: "assets/javelin-rear.webp", alt: "Javelin rear three-quarter showing the swept wing and stabilizers", caption: "Swept wing and tail" },
      { src: "assets/javelin-outdoor.webp", alt: "Javelin held outdoors showing scale", caption: "Scale in hand" }
    ]
  },
  ansysCfd: {
    kicker: "Ansys Fluent / PyFluent / CFD automation",
    title: "Agent-based CFD",
    image: "assets/cover-ansys-cfd.webp",
    summary:
      "Open teaching package that shows AI agents how to run Ansys Fluent 2024 R1 headlessly through PyFluent, using a real VTOL drone cruise case as the validation path.",
    highlights: [
      "Converted a completed Javelin VTOL cruise CFD run at 300 kph, Mach 0.245, into a reusable agent instruction package.",
      "Packaged a system prompt, workflow SOP, PyFluent playbook, failure recovery catalog, quality gates, templates, and verified reference scripts.",
      "Documented 11 real failure modes, including headless STEP import crashes, wrap-mesh traps, silent far-field key failures, and orphaned MPI processes holding a license seat.",
      "Moved from failed wrap-mesh refinement to a conforming multi-region mesh with a single pressure-far-field boundary while preserving CAD fidelity.",
      "Built anti-fabrication gates: read back critical Fluent settings, label estimated-reference coefficients as process-validation values, and never report unverified results as design-grade."
    ],
    tools: ["Ansys Fluent 2024 R1", "PyFluent 0.17.1", "Python", "PowerShell", "CFD post-processing", "Quality gates"],
    details: [
      {
        title: "Project goal",
        points: [
          "The project asks a practical question: can an AI coding agent drive desktop engineering software well enough to run a reviewable CFD workflow without a GUI?",
          "The result is a teaching package for agents, not just a one-off simulation: the documents explain the operating discipline needed to launch Fluent, manage files, monitor solves, and report credibility.",
          "The source case is a Javelin VTOL drone cruise simulation at 300 kph, Mach 0.245, with the final numbers explicitly marked as process-validation level where reference values are estimated."
        ]
      },
      {
        title: "Workflow package",
        points: [
          "The package includes a system prompt, a step-by-step SOP, a PyFluent playbook with real 2024 R1 API keys, a failure-recovery catalog, quality-gate definitions, report templates, and verified reference scripts.",
          "Reference scripts cover solver setup, conforming far-field solve, post-processing images, audit checks, and result reporting so another agent can follow the workflow instead of rediscovering the same traps.",
          "The workflow forces a gate at each stage: geometry, mesh, solver setup, convergence, y+, force extraction, post-processing, and credibility labeling."
        ]
      },
      {
        title: "Technical breakthrough",
        points: [
          "The early fault-tolerant wrap mesh ran, but it discarded real CAD surface fidelity and could not be refined reliably in a headless environment.",
          "The route that worked was a conforming watertight mesh solved as a multi-region case with one pressure-far-field boundary, avoiding brittle region extraction while keeping the CAD surface smooth.",
          "The final setup used compressible ideal-gas physics, k-omega SST, Mach 0.245, and a verified flow-direction vector for the angle of attack."
        ]
      },
      {
        title: "Failure recovery",
        points: [
          "The catalog records 11 failure modes and fixes, including SpaceClaim headless crashes, interactive TUI report loops, Fluent default convergence stopping too early, hidden moment report defaults, and report-file liveness traps.",
          "One operational lesson was critical: clean up the whole Fluent process family, including mpiexec and cortex, before relaunching, or orphaned MPI processes can hold the license seat.",
          "Silent no-op settings were treated as hard blockers: after setting a far-field Mach number or flow direction, the script reads the state back and aborts if the values do not match."
        ]
      },
      {
        title: "Professional standard",
        points: [
          "The package distinguishes process validation from design-grade CFD and makes the limitation visible instead of burying it.",
          "Coefficients derived from estimated reference area, reference length, or moment center are labeled process-validation values only.",
          "The project demonstrates simulation automation, engineering judgment, and agent instruction design: the agent is not asked to make pretty plots, it is asked to run a disciplined CFD process."
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
      "Cockpit seat and harness package focused on driver fit, lateral support, mount reliability, fast service access, and rules-driven packaging.",
    highlights: [
      "Validated cockpit fit across ~20 drivers of varying heights with CAD body positioning and physical fit studies.",
      "Accommodated the shortest-to-tallest driver range through a booster strategy and flexible mounting points.",
      "Upgraded restraint to a six-point harness with an anti-submarine strap on a dedicated chassis bar.",
      "Mounted the seat on welded chassis tabs and multiple hard points for reliable retention and fast service access.",
      "Packaged the seat inside the cockpit template alongside the steering column, pedal tray, and bodywork."
    ],
    tools: ["SolidWorks", "Cockpit fit study", "Driver measurements", "Harness routing", "Mount design"],
    details: [
      {
        title: "Role and requirements",
        points: [
          "Owned cockpit seat and harness design during the Mk.7/Mk.8 transition, with requirements spanning driver retention, serviceability, comfort, and rules compliance.",
          "The seat had to support drivers during cornering and braking while staying light enough for a Formula SAE electric car.",
          "The design also had to respect the cockpit opening, steering wheel placement, pedal position, and harness geometry."
        ]
      },
      {
        title: "Driver fit strategy",
        points: [
          "Used CAD body models and physical checks to evaluate a range of driver sizes instead of optimizing around only one driver.",
          "Planned booster-seat or cushion options for smaller drivers while keeping taller-driver packaging inside the cockpit envelope.",
          "Balanced comfort with restraint: the design needed lateral support without blocking exit, service, or harness access."
        ]
      },
      {
        title: "Mounting and harness interfaces",
        points: [
          "Developed mounting concepts using chassis-welded tabs, multiple seat hard points, and dedicated harness bars or tabs.",
          "Upgraded the harness to a six-point layout with an anti-submarine strap on a dedicated chassis bar.",
          "Connected the seat package to the surrounding cockpit systems: pedal tray, steering column, frame tubes, and bodywork."
        ]
      },
      {
        title: "Status and validation",
        points: [
          "Cockpit fit validated across roughly 20 drivers through CAD body positioning plus physical fit checks.",
          "Six-point harness with an anti-submarine strap mounted on a dedicated chassis bar; seat retained on welded chassis tabs.",
          "The full package sits inside the FSAE cockpit template alongside the steering column, pedal tray, and bodywork."
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
      "Composite-focused seat and bodywork support work improving shoulder support, driver retention, repairability, and manufacturability.",
    highlights: [
      "Added a carbon shoulder- and hip-support shell above the seat pan for upper-body retention under cornering load.",
      "Chose the carbon-fiber layup for stiffness-to-weight where driver retention mattered more than a metal pan.",
      "Designed the shell and bodywork to remove, repair, and reassemble within a race weekend.",
      "Sized the geometry around real layup and trimming limits rather than CAD-only surfaces.",
      "Used the Mk.7 build to target the Mk.8 cockpit's actual support and service pain points."
    ],
    tools: ["Composite layup planning", "Carbon fiber", "Bodywork DFM", "Driver ergonomics", "Repairability review"],
    details: [
      {
        title: "Design intent",
        points: [
          "The carbon seat support work targets the top half of the cockpit, where shoulder retention and upper-body support become important under lateral load.",
          "Instead of treating the seat as a flat floor insert, the design considers flanges, support layers, and local stiffness around the driver's torso.",
          "The seat support also has to coexist with bodywork, harness routing, chassis tubes, and access for inspection."
        ]
      },
      {
        title: "Composite choices",
        points: [
          "Carbon fiber was evaluated for lightweight support where stiffness and driver retention matter more than decorative appearance.",
          "Layup planning considers epoxy safety, repair access, repeatability, and how the part can be installed or removed without damaging surrounding panels.",
          "The bodywork review emphasized robust panels that are easy to remove, repair, and reassemble during a race weekend."
        ]
      },
      {
        title: "Manufacturing constraints",
        points: [
          "Kept the geometry compatible with realistic layup and trimming work rather than overcomplicated surfaces that look good only in CAD.",
          "Used the Mk.7 car as a build reference for where seat support, bodywork, and cockpit service access become painful in practice.",
          "Prioritized stiffness, driver fit, and repairability so the composite structure earns its weight and manufacturing effort."
        ]
      },
      {
        title: "Status",
        points: [
          "Shell laid up over the seat mold and trimmed (layup and weave shots in the gallery), sized for the Mk.8 cockpit.",
          "Designed to remove, repair, and reassemble within a race weekend, using the Mk.7 build's service pain points as the target list."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-carbon-fiber-seat.webp", alt: "Carbon fiber seat support shell filling the work surface", caption: "Carbon shell cover" },
      { src: "assets/carbon-seat-layup-interior.webp", alt: "Carbon fiber seat layup around a gray mold", caption: "Layup interior" },
      { src: "assets/carbon-seat-shell-front.webp", alt: "Carbon fiber seat shell standing upright with masking tape at the edges", caption: "Shell front" },
      { src: "assets/carbon-seat-weave-close.webp", alt: "Close view of the carbon fiber weave over the seat support surface", caption: "Carbon weave" },
      { src: "assets/carbon-seat-trimmed-shell.webp", alt: "Trimmed carbon fiber seat support shell after curing", caption: "Trimmed shell" },
      { src: "assets/fsae-mk7-cockpit.webp", alt: "Driver seated in Olin Electric Motorsports Formula SAE car", caption: "Driver support context" }
    ]
  },
  brakeSim: {
    kicker: "Formula SAE / MATLAB / brake thermal model",
    title: "FSAE Brake Sim",
    image: "assets/oem-brake-fea.webp",
    summary:
      "Track-based brake rotor and pad temperature model for OEM Mk.8, built to size rotors around endurance heat load, pad operating range, 25 percent mass reduction, and structural safety margin.",
    highlights: [
      "Modeled a 22-lap FSAE endurance cycle as 25 discrete track segments with varying velocity and brake demand.",
      "Included heat input, hub conduction, radiation, and velocity-dependent convection in the rotor temperature prediction.",
      "Used brake-bias assumptions and high-load course zones to identify where temperature peaks matter most.",
      "Selected cast iron ASTM A48 Class 40 rotors for conductivity, cost, and manufacturability against more exotic materials.",
      "Connected simulation output to Wilwood GP200 calipers, BP-28 pads, AN3 service disconnects, 25 percent rotor mass reduction, and a 3.0 factor of safety in structural FEA."
    ],
    tools: ["MATLAB", "Thermal modeling", "Track segmentation", "FEA", "Brake bias", "Wilwood BP-28 data"],
    details: [
      {
        title: "Model objective",
        points: [
          "Built the brake model to answer a practical design question: how much rotor mass can be removed while keeping pad and rotor temperatures in a usable range.",
          "The model treats the endurance event as repeated thermal loading over 22 laps rather than a single braking event, with 25 track segments defining heat input and cooling windows.",
          "This makes the result more useful for real FSAE reliability decisions, where heat soak and repeatability matter."
        ]
      },
      {
        title: "Thermal implementation",
        points: [
          "Segmented the course into braking and cooling zones so velocity, deceleration, and heat transfer could vary through the lap.",
          "Estimated heat input from braking work and distributed it through front/rear bias assumptions.",
          "Included conduction into the hub, radiation, and speed-dependent convection to avoid a one-term temperature estimate."
        ]
      },
      {
        title: "Hardware decisions",
        points: [
          "Evaluated rotor material direction and favored cast iron for thermal conductivity above 52 W/m-K, friction pairing, cost, and manufacturability.",
          "Connected the model to Wilwood GP200 calipers and BP-28 pads, whose 0.46-0.48 high-temperature friction coefficient set the target operating range.",
          "Kept serviceability in the system design through AN3 quick-disconnect thinking for faster brake-line replacement."
        ]
      },
      {
        title: "Validation and tradeoffs",
        points: [
          "Used Mk.7 and peer-team data as sanity checks because brake thermal models are sensitive to assumptions.",
          "The main design tradeoff was surface area and thermal mass versus rotational inertia and unsprung mass.",
          "The output gives the mechanical team a defensible starting point for rotor sizing, including the tradeoff between a 25 percent mass reduction target and a 3.0 structural factor of safety."
        ]
      }
    ],
    gallery: [
      { src: "assets/oem-brake-fea.webp", alt: "Brake rotor finite element analysis result", caption: "Rotor FEA" },
      { src: "assets/fsae-mk8-live-1.webp", alt: "Brake rotor and pad temperature over endurance laps", caption: "Endurance thermal model" },
      { src: "assets/fsae-mk8-live-2.webp", alt: "Brake rotor stress or displacement contour plot", caption: "Structural check" },
      { src: "assets/fsae-mk8-live-3.webp", alt: "Perforated brake rotor CAD pattern", caption: "Rotor geometry" }
    ]
  },
  scanner: {
    kicker: "LiDAR / motion control / data capture",
    title: "3D scanner",
    image: "assets/scanner-live-7.webp",
    summary:
      "Gantry-based scanner that moves a TFmini-S LiDAR through a controlled Cartesian pattern and reconstructs object geometry from 2,206 calibrated distance readings.",
    highlights: [
      "Calibrated 14 known distances and reduced stable-range error to under 3 percent beyond roughly 30 cm.",
      "Captured 2,206 measurements across a 140 mm by 165 mm scan area for a small test object.",
      "Owned LiDAR calibration, electrical architecture, and gantry mechanism design with teammate Jacob Likins.",
      "Built around Arduino Nano ESP32, DRV8825 drivers, NEMA 17 steppers, 12 V supply, and an emergency stop.",
      "Replaced a lower-accuracy servo pan/tilt concept with a gantry for repeatable scan coordinates.",
      "Used shielding, copper foil, and wiring changes to reduce power-supply noise around the sensor."
    ],
    tools: ["Arduino Nano ESP32", "TFmini-S LiDAR", "MATLAB Curve Fitter", "Python", "DRV8825", "NEMA 17"],
    details: [
      {
        title: "Role and system",
        points: [
          "Designed and assembled the gantry mechanism, calibrated the TFmini-S LiDAR, and built the electrical system with an Arduino Nano ESP32 controller.",
          "The scanner moves the sensor through a raster path, pairs each measured distance with carriage position, and plots a digital outline of the object.",
          "Jacob Likins was the project teammate; the final system emphasized repeatable motion and clean sensor data."
        ]
      },
      {
        title: "Calibration",
        points: [
          "Measured 14 known distances with a ruler and used MATLAB Curve Fitter to derive a correction curve for the LiDAR output.",
          "Found that readings below about 30 cm were less stable, then set operating placement around the more reliable range.",
          "After calibration, stable-range percentage error dropped below roughly 3 percent for the intended object distance."
        ]
      },
      {
        title: "Electrical and EMI control",
        points: [
          "Used a 12 V, 12.5 A supply for motor power, DRV8825 stepper drivers, capacitors on motor supply rails, and fan cooling.",
          "Designed the emergency stop to cut motor voltage while keeping Arduino logic alive, making testing safer without losing state.",
          "Lined the PETG electronics enclosure with copper foil and shielded LiDAR wiring to reduce noise from the power supply and motors."
        ]
      },
      {
        title: "Mechanical and motion logic",
        points: [
          "Built the Y axis around dual M8 lead screws and guide rods and used a belt-driven X axis at 1/16 microstepping.",
          "Homed the axes against physical limit switches before scanning so the software knew the carriage coordinate frame.",
          "Sampled 2,206 LiDAR points during raster motion and treated the project as a full electromechanical integration problem: motion, sensing, calibration, and data visualization."
        ]
      }
    ],
    gallery: [
      { src: "assets/scanner-live-7.webp", alt: "Physical gantry-based 3D scanner prototype", caption: "Final gantry prototype" },
      { src: "assets/scanner-live-5.webp", alt: "CAD model of the gantry-based 3D scanner", caption: "Gantry CAD" },
      { src: "assets/scanner-live-1.webp", alt: "LiDAR calibration curve and formula", caption: "Calibration curve" },
      { src: "assets/scanner-live-2.webp", alt: "LiDAR percentage error before and after calibration", caption: "Error reduction" },
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
      "Gantry and actuator hardware for Smelly, a fully automated perfume-mixing vending machine built by Team Scent-A-Tubbies during a Formlabs hackathon.",
    highlights: [
      "Built in a 2.5-day sprint around a digital scent-profile concept and six fragrance bases.",
      "Designed and fabricated the custom gantry plus linear actuator mechanisms.",
      "Compared stepper lead-screw and rack-and-pinion actuator approaches under hackathon time pressure.",
      "Fabricated quickly with Formlabs Form 4 and Bambu Lab P1S printers.",
      "Diagnosed continuous-duty overheating in the lead-screw actuator and folded the lesson into actuator selection."
    ],
    tools: ["Raspberry Pi", "Formlabs Form 4", "Bambu Lab P1S", "Lead screw actuator", "Rack and pinion", "Rapid prototyping"],
    details: [
      {
        title: "Role and product concept",
        points: [
          "Worked on Team Scent-A-Tubbies to build Smelly, an automated perfume-mixing vending machine from a digital scent profile.",
          "Owned the mechanical gantry and linear actuator design/fabrication while the broader team integrated software and dispensing.",
          "The machine had to move between six fragrance bases and physically actuate dispensing within a very short sprint."
        ]
      },
      {
        title: "Motion architecture",
        points: [
          "Designed a compact gantry controlled through the Raspberry Pi system so the dispenser could index between fragrance bottles.",
          "Created two actuator concepts: a stepper lead-screw mechanism and a rack-and-pinion version.",
          "The design had to be printed, assembled, and debugged fast enough to leave time for full-machine integration."
        ]
      },
      {
        title: "Fabrication constraints",
        points: [
          "Used Formlabs Form 4 and Bambu Lab P1S printing to choose between fine-detail resin parts and faster FDM iteration.",
          "Prioritized tolerances that mattered for motion and ignored perfection where it would not affect the demo.",
          "The sprint forced clear tradeoffs between ideal mechanism design and hardware that could actually be built that day."
        ]
      },
      {
        title: "Failure and learning",
        points: [
          "The stepper lead-screw actuator overheated under sustained operation, exposing a duty-cycle and thermal-management issue.",
          "The lesson was concrete: actuator choice must include expected runtime, not only force, stroke, and CAD packaging."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-perfume-dispenser.webp", alt: "Automated perfume dispenser prototype with gantry and fragrance bottles", caption: "Integrated prototype" },
      { src: "assets/formlabs-smelly-build.webp", alt: "Automated perfume dispenser prototype on a workbench", caption: "Workbench build" },
      { src: "assets/formlabs-smelly-front.webp", alt: "Formlabs hackathon perfume dispenser gantry", caption: "Gantry setup" },
      { src: "assets/formlabs-smelly-actuator.webp", alt: "Wiring and actuator system for perfume dispenser", caption: "Actuator wiring" },
      { src: "assets/formlabs-smelly-table.webp", alt: "Perfume dispenser test setup with gantry and fragrance bases", caption: "Dispensing test" },
      { src: "assets/formlabs-smelly.webp", alt: "Smelly automated perfume dispenser close-up", caption: "Final concept" }
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
      { src: "assets/vine-test-closeup.webp", alt: "Close view of a pressurised vine body under the load shape, resting on the marked wood plate between the rig's linear bearings", caption: "Body under load" },
      { src: "assets/vine-robot-built.webp", alt: "The first build of the vine everting robot: transparent polypropylene pressure vessel with a bolted printed lid, bolted outlet flange and a vine body everted through the outlet", caption: "First build" },
      { src: "assets/vine-assembly-cutaway.webp", alt: "CAD cutaway of the robot showing the internal spool, drive shaft and outlet", caption: "Internal spool" },
      { src: "assets/vine-lid-exploded.webp", alt: "Exploded CAD view of the lid assembly: motor, printed lid, TPU gasket and the flange-gripping lid mount with its bolt ring", caption: "Lid assembly" },
      { src: "assets/vine-outlet-exploded.webp", alt: "Exploded CAD view of the vine outlet with its cross-section converter, gasket and bolt ring", caption: "Outlet + converter" },
      { src: "assets/vine-reinforced-cad.webp", alt: "CAD of the reinforced robot with aluminium plates on every face and three C-shaped steel brackets", caption: "Reinforced build" },
      { src: "assets/vine-fea-deformation.webp", alt: "FEA displacement result on the reinforcement structure, peaking at 6.5 mm", caption: "FEA — 6.5 mm peak" },
      { src: "assets/vine-fea-stress.webp", alt: "FEA von Mises stress detail on the reinforcement, peaking at 0.234 GPa", caption: "FEA — 0.234 GPa" },
    ],
    // no 3D exhibit for this one (no model in the studio) — script.js hides the
    // "view in the studio" link when noStudio is set
    noStudio: true,
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
      "A 34 kPa (5 psi) pressure vessel that everts soft vine bodies for a cross-section deformation study at the Olin Vine Robotics Lab: a 19 L polypropylene pail with a bolted PETG lid, printed TPU gaskets, swappable outlet converters, and a motor-driven internal spool. The first build yielded at 1.2 psi, so I reinforced it in aluminum and steel and re-validated it in FEA — then used it to run a 45-test factorial experiment and to measure the material properties the lab's prediction model takes as inputs.",
    highlights: [
      "Bolted the lid against the underside of the pail flange with 39 Grade 12.9 M4x30 bolts so the ~2,304 N (518 lbf) blow-off load is carried in tension instead of by a snap fit.",
      "Printed TPU 85A gaskets (0.5-3 mm) for five distinct seal families — the soft durometer conforms to FDM layer lines under bolt preload, which is what makes a printed vessel sealable at all.",
      "Split the outlet into a fixed port plus swappable cross-section converters, so a new vine geometry is a one-part change instead of a rebuild; the outlet also stiffens the side wall it cuts through.",
      "Added a spool holder that moves vine tension and spool weight off the motor shaft into a bearing, with a flexible coupling absorbing motor-to-spool misalignment.",
      "First pressure test held 1.2 psi against a 0.71 psi thin-wall hand calculation, and exposed the real failure order: coupler, vine-to-spool joint, then leaks.",
      "Reinforced with 6061 plate on all four faces, an aluminum lid and three C-shaped A36 brackets; FEA at 500 lbf per face (5.8 psi) gives 6.5 mm peak deformation and 0.234 GPa peak stress against A36's 0.25 GPa yield.",
      "Ran the resulting 45-test factorial with it: three body types (circular, 3-partition, stick-reinforced) against two load shapes, three pressures and two loads.",
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
          "Full-time summer research assistant at the Olin Vine Robotics Lab (May - Aug 2026), owning the robot that everts the vine bodies for a cross-section deformation experiment.",
          "Design targets came straight from the experiment: hold 34 kPa (5 psi) — a 3.33 factor of safety over the 10.3 kPa top of the test range — accept bodies up to 571 mm (22.5 in) circumference, and swap bodies fast enough for more than 15 trials a day.",
          "The vessel also had to accept three different cross-sections (circular, 3-partition, stick-reinforced) and stay transparent enough to debug eversion faults from outside.",
        ],
      },
      {
        title: "Pressure vessel and sealing",
        points: [
          "Chose a stock 19 L (5 gal) transparent polypropylene pail with a 1.4 mm wall over a fabricated metal vessel: the shop's sheet metal tooling and the budget could not deliver a precise custom vessel, and the pail's flat sides carry component mounts.",
          "The stock snap lid is neither airtight nor able to carry the motor and drive shaft, so the lid and its mount are custom PETG; the mount grips the back of the pail flange and was later welded to it for airtightness.",
          "Sealing is FDM-printed TPU 85A rather than hand-cut gasket, so each seal matches its joint geometry exactly — which also means joint stiffness and bolt count matter more here than they would on a machined face.",
        ],
      },
      {
        title: "Outlet and drivetrain",
        points: [
          "The outlet is the highest-stress region of the robot — a large, hand-cut opening — so it mounts from the inside with wide flanges for both sealing contact area and extra area moment of inertia.",
          "Cross-section converters bolt to that fixed outlet through their own TPU gaskets, which is what lets one vessel serve all three body types.",
          "The un-everted body winds onto an internal spool on two flanged ball bearings, driven by a DC motor through a McMaster 6133N114 flexible coupling on an 8 mm steel shaft.",
        ],
      },
      {
        title: "Test, failure, reinforcement",
        points: [
          "Pressure-tested on the lab's high-pressure air system: the vessel held 1.2 psi versus the 0.71 psi wall-yield hand calculation, deformed significantly, decoupled the TPU coupler, failed the vine-to-spool connection, and showed minor leaks.",
          "Reinforcement: PLA-welded the leak points, 6061 plates on both sides, back and bottom, an aluminum lid in place of the printed one, three C-shaped A36 steel brackets around the shell, PETG connection brackets, and cutout patterns kept open for debugging.",
          "FEA on the reinforcement structure at 500 lbf per face (5.8 psi) returns 6.524 mm maximum deformation and 0.2339 GPa maximum stress against A36 steel's 0.25 GPa yield; the vine outlet remains the weakest point.",
        ],
      },
      {
        title: "The experiment it runs",
        points: [
          "Full factorial: 3 body types x 2 load shapes x 3 pressures x 2 loads = 36 loaded conditions, plus 9 unloaded baselines, for 45 runs.",
          "The rig rides on four 10 mm steel rods and eight linear bearings with a dovetail connector for fast load-shape swaps; a 0.01 kg scale sits directly under the vine because rod-bearing friction makes applied weight a poor proxy for the force actually reaching the body.",
          "Air is regulated in two stages from 862 kPa (125 psi) shop air down to a 34 kPa gauge at the outlet, and a Creality scanner captures the deformed geometry for comparison against the prediction model.",
        ],
      },
      {
        title: "Feeding the model",
        points: [
          "The prediction model takes membrane stiffness and rod bending stiffness as direct inputs, so both were measured on an Instron rather than taken from literature — see the material property testing case study.",
        ],
      },
    ],
  },
  materialTest: {
    kicker: "Olin Vine Robotics Lab / Instron / 2026",
    title: "Material property testing",
    image: "assets/cover-material-test.webp",
    gallery: [
      { src: "assets/cover-material-test.webp", alt: "Polar plot of the measured directional Young's modulus of the TPU-coated fabric, stiffest along the weave axes and minimum near 46 degrees", caption: "Directional modulus" },
      { src: "assets/material-tensile-summary.webp", alt: "Bar chart of engineering tensile modulus with error bars for the fabric in TD, MD and 45 degrees plus LDPE film", caption: "Tensile summary" },
      { src: "assets/material-bending-fits.webp", alt: "Force-deflection curves for all eleven bamboo samples in three-point bending", caption: "Force–deflection, 11 rods" },
      { src: "assets/material-bending-summary.webp", alt: "Per-sample bending stiffness EI and estimated bending modulus for the eleven bamboo rods against their means", caption: "Per-rod EI and E" },
    ],
    noStudio: true,
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
      "The Olin Vine Robotics Lab's cross-section model takes membrane stiffness and rod bending stiffness as direct inputs, so both had to be measured rather than looked up. I ran two campaigns on an Instron 3345: ASTM D882 tension on 30 film and fabric specimens, and three-point bending on 11 bamboo reinforcing rods — then fitted a plane-stress orthotropic model to the fabric results.",
    highlights: [
      "Tested the TPU-coated fabric in three directions because its weave makes it orthotropic: MD 76.30 +/- 3.08 MPa, TD 69.89 +/- 2.47 MPa, 45 deg 41.78 +/- 0.99 MPa, with LDPE film at 100.96 +/- 5.00 MPa.",
      "Scatter stayed under 4.9% of the mean in every group, and the on-axis fabric fits landed at R2 0.99.",
      "The 45 deg modulus is only ~55% of MD — the signature of a shear-governed off-axis response — and the three measurements fully determine the plane-stress compliance model, whose minimum sits near 46 deg.",
      "Three-point bending on 11 rods gave 81.7 +/- 7.7 N/mm stiffness, EI = 0.672 +/- 0.063 N.m2 and E = 0.678 +/- 0.055 GPa, every fit above R2 0.999.",
      "Adapted the standard where the equipment required it: a 100 mm gauge length instead of the 250 mm nominal to fit the available grip separation, with crosshead speeds set by the standard's strain-rate rule.",
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
          "The lab's cross-section prediction model consumes the vine body's membrane stiffness and the bamboo rods' bending stiffness directly, so literature values would have propagated straight into every prediction.",
          "Two materials are in play for vine bodies — single-side TPU-coated fabric and LDPE film — and the reinforced bodies add bamboo rods, so three separate characterisations were needed.",
        ],
      },
      {
        title: "Membrane tension, ASTM D882",
        points: [
          "30 specimens: 7 machine-direction, 7 transverse, 8 at 45 deg for the fabric, plus 8 LDPE, which showed no directional dependence in the pilot.",
          "Specimens ran 23.6-25.4 mm wide inside the standard's 5.0-25.4 mm window; fabric measured 0.19-0.22 mm thick and LDPE 0.10-0.11 mm, all conditioned and tested at 23 +/- 2 C and 50 +/- 10 % RH.",
          "Crosshead speed followed the standard's strain-rate rule: 12.5 mm/min for fabric to 20% strain, 50 mm/min for LDPE to 200 mm; modulus came from a least-squares fit over the initial linear region.",
        ],
      },
      {
        title: "Orthotropic model of the fabric",
        points: [
          "Feeding the three measured moduli into the plane-stress orthotropic compliance relation gives the full directional curve rather than three isolated numbers.",
          "It is stiffest along MD at 76.3 MPa, slightly softer along TD at 69.9 MPa, and bottoms out near 41.8 MPa at about 46 deg — that curve is what the fabric bodies use in the model.",
          "The lower fit quality at 45 deg and for LDPE (R2 0.967 and 0.950) reflects mild curvature inside the fit window, which is worth knowing before trusting either number too far.",
        ],
      },
      {
        title: "Rod bending",
        points: [
          "No bending standard covers a 0.25 in wood rod, so the test was defined to be repeatable instead: 73.37 mm support span, 12.5 mm/min crosshead, and 11 rods selected for straightness out of the supplied batch.",
          "Stiffness came from the initial linear region of each force-deflection curve, roughly the first 1.3-1.8 mm of travel, then converted to EI through the simply-supported central-load relation.",
          "EI is the quantity the model consumes and the primary result; the derived modulus is reported alongside it for comparison only.",
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
      "Front-wheel swerve drive system for Project AURA, an autonomous luggage robot with a 300 lb payload. My mechanical focus was the drive and steering package: independent front-wheel steering, chain-driven steering reduction, DC drive motors, robust shafts, and fabricated steel mounts.",
    highlights: [
      "Owned the mechanical swerve drive direction for a 300 lb-payload luggage robot that still had to steer and drive autonomously under that load.",
      "Used two front drive modules so the robot could combine drive and steering at the front while preserving maneuverability.",
      "Designed around Ackermann-aware independent steering to reduce scrub and improve turning behavior under heavy load.",
      "Packaged MY1016Z6 24 V DC drive motors with a 9:16 sprocket ratio for traction and acceleration under load.",
      "Steered each front wheel with NEMA 23 stepper motors through an 18:80 sprocket reduction to prioritize steering torque.",
      "Fabricated wheel housings and motor mounts from 0.25 in A36 mild steel using OMAX waterjet cutting, TIG welding, and paint for corrosion control."
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
          "My AURA contribution centered on the front-wheel swerve drive system rather than the whole autonomy stack.",
          "The project goal was a smart autonomous luggage robot, but the mechanical requirement I focused on was making it drive, steer, and carry its 300 lb payload reliably.",
          "Putting both drive and steering in the front modules created a compact but demanding packaging problem: motors, sprockets, shafts, chains, bearings, and mounts all had to coexist around the wheel."
        ]
      },
      {
        title: "Steering geometry and actuation",
        points: [
          "The two front wheels steer independently so the robot can approach Ackermann steering behavior instead of dragging the wheels through turns.",
          "Each steering module uses a NEMA 23 stepper motor through an 18:80 sprocket reduction, trading speed for enough torque to steer under load.",
          "Stepper placement became a real design constraint: moving the steering motors toward the center of the robot increased sprocket spacing and helped reduce chain skipping."
        ]
      },
      {
        title: "Drive and load path",
        points: [
          "The drive system uses two MY1016Z6 24 V DC motors with a 9:16 sprocket ratio, sized for roughly 1 m/s^2 acceleration under payload.",
          "Wheel position feedback came from LPD3806 encoders mounted to the 3/8 in front wheel shafts, giving the system speed and displacement information.",
          "The drivetrain relied on heavy-duty solid rubber wheels, eight bearings across the wheel assemblies, and steel shafts with redundancy for expected load cases."
        ]
      },
      {
        title: "Fabrication and iteration",
        points: [
          "Wheel housings and motor mounts were made from 0.25 in A36 mild steel because it is strong, weldable, and practical for shop fabrication.",
          "The parts were waterjetted on an OMAX, TIG welded, and spray painted to prevent rust after fabrication.",
          "The hardest mechanical issue was packaging the chain, sprockets, wheel, mount, and drive hardware tightly enough for steering without interference; the solution involved testing spacers and shortening mounting hardware."
        ]
      }
    ],
    gallery: [
      { src: "assets/aura-swerve.jpeg", alt: "AURA front-wheel swerve drive system showing independent steering wheel modules", caption: "Swerve drive system" },
      { src: "assets/aura-chain-tensioner.jpeg", alt: "AURA steering chain tensioner and sprocket package", caption: "Steering chain package" },
      { src: "assets/aura-swerve-mount.jpeg", alt: "AURA waterjet and welded swerve mount fabrication", caption: "A36 steel mount" },
      { src: "assets/aura-motor.png", alt: "MY1016Z6 24 volt DC motor used for the AURA drive system", caption: "Drive motor" },
      { src: "assets/aura-wheels-bearing-shaft.jpeg", alt: "AURA wheel, bearing, and shaft hardware", caption: "Wheel and shaft" },
      { src: "assets/aura-rotary-encoder.jpeg", alt: "AURA rotary encoder mounted to wheel shaft", caption: "Encoder feedback" },
      { src: "assets/aura-battery.jpeg", alt: "AURA 24 volt LiFePO4 battery", caption: "Power package" },
      { src: "assets/aura-system-diagram.png", alt: "AURA system diagram with Raspberry Pi, sensors, and front wheel drive modules", caption: "System context" }
    ]
  },
  lineFollower: {
    kicker: "Robotics / compact embedded build",
    title: "LineFollower robot",
    image: "assets/line-follower-cover.webp",
    summary:
      "Compact line-following robot packaging an Arduino Mega, drive hardware, sensors, and dense wiring into a small mobile platform.",
    highlights: [
      "Packaged an Arduino Mega, motor drivers, battery, sensors, and drive into a palm-size chassis.",
      "Ran stable low-speed line tracking with front-mounted sensing and a compact two-wheel differential drive.",
      "Kept wire runs short and serviceable so the build stayed debuggable after assembly.",
      "Tuned sensor thresholds, driver wiring, and drive balance into repeatable tracking on the assembled robot.",
      "Demonstrates hands-on electromechanical integration — controls, packaging, power, and build — at small scale."
    ],
    tools: ["Arduino Mega", "Motor drivers", "Sensor packaging", "Embedded wiring", "Mobile robotics"],
    details: [
      {
        title: "System architecture",
        points: [
          "Built the robot around an Arduino Mega with front-mounted sensing, motor driver hardware, a compact battery package, and two-wheel drive.",
          "The project required packaging electronics visibly and cleanly rather than hiding wiring in an oversized chassis.",
          "The physical layout keeps the sensor line, wheelbase, and center of mass close enough for stable low-speed tracking."
        ]
      },
      {
        title: "Mechanical packaging",
        points: [
          "Used a small chassis footprint with visible controller, wiring, and drive modules stacked around the wheelbase.",
          "The main packaging challenge was fitting many electrical interfaces into very limited space.",
          "The build rewards short wire runs, clear connector routing, and accessible components for iteration."
        ]
      },
      {
        title: "Status",
        points: [
          "Built as a complete package: Arduino Mega, dual motor drivers, IR reflectance sensing, and power on one palm-size chassis.",
          "The layout keeps wire runs short and connectors accessible, so sensors and drive modules can be swapped between iterations."
        ]
      }
    ],
    gallery: [
      { src: "assets/line-follower-cover.webp", alt: "Compact line follower robot on a scale", caption: "Full robot package" },
      { src: "assets/line-follower-wiring.webp", alt: "Line follower robot wiring and Arduino Mega", caption: "Controller packaging" },
      { src: "assets/line-follower-front.webp", alt: "Line follower robot front sensing and wiring", caption: "Front sensor layout" },
      { src: "assets/line-follower-built.webp", alt: "Built line follower robot with dense wiring", caption: "Assembled prototype" }
    ]
  },
  pool: {
    kicker: "Assistive mechanism / powertrain",
    title: "Pool Sniper",
    image: "assets/pool-sniper.webp",
    summary:
      "Accessible pool cue launcher for beginners and users with physical or visual limitations, using laser aiming, variable-force release, and a chain-driven powertrain.",
    highlights: [
      "Built a mechanism strong enough to break while still allowing variable shot force.",
      "Used surgical tubing as the energy storage element and a sliding trigger for adjustable release position.",
      "Added laser aiming and a simple switch interface to reduce aiming difficulty.",
      "Used a 2:1 sprocket and gear chain drive with rack-and-pinion cue pullback.",
      "Iterated around wiring, compact packaging, plasma-cut tolerance, and long-part lathe challenges."
    ],
    tools: ["Rack and pinion", "Chain drive", "Surgical tubing", "Laser pointer", "Waterjet", "Lathe", "Tensioner design"],
    details: [
      {
        title: "Objective",
        points: [
          "Designed Pool Sniper to make pool playable for beginners, disabled users, and people who have trouble sighting or striking a cue consistently.",
          "The device needed enough stored energy to break, adjustable shot strength for regular play, and a compact form factor.",
          "The goal was not only to automate the shot, but to preserve user control through aiming and force selection."
        ]
      },
      {
        title: "Launch mechanism",
        points: [
          "Used surgical tubing to store energy and a sliding trigger so the cue can release at different pullback distances.",
          "A rack-and-pinion mechanism pulls the cue back while the trigger position sets the final launch force.",
          "A chain-drive powertrain and sprocket ratio were used to package the motion and generate enough pull force."
        ]
      },
      {
        title: "Aiming and usability",
        points: [
          "Added a laser pointer and two-way switch so the user can line up shots without traditional pool stance or sighting skill.",
          "Kept the device compact and hand-operable rather than building a large table-mounted machine.",
          "The sliding trigger gives a physical, intuitive control for shot power instead of a hidden software parameter."
        ]
      },
      {
        title: "Build challenges",
        points: [
          "Compact packaging made wire routing and component access difficult, so wire length and fit checks became part of the design process.",
          "Tolerance limits from plasma cutting and long cue machining forced manual finishing and process changes.",
          "The final build used waterjet-cut parts and practical shop iteration to reach a functional mechanism."
        ]
      }
    ],
    gallery: [
      { src: "assets/pool-sniper.webp", alt: "Pool Sniper cue launcher CAD render", caption: "Full mechanism" },
      { src: "assets/pool-sniper-exploded.webp", alt: "Exploded Pool Sniper mechanism CAD", caption: "Exploded assembly" },
      { src: "assets/pool-sniper-build.webp", alt: "Machined Pool Sniper component plate", caption: "Fabricated plate" },
      { src: "assets/pool-sniper-release.webp", alt: "Pool Sniper release mechanism CAD frame", caption: "Release geometry" }
    ]
  },
  education: {
    kicker: "Product design / education / user testing",
    title: "Guitar education kit",
    image: "assets/education-kit.webp",
    summary:
      "Affordable STEAM hardware kit designed for middle and high school assembly, tested with students, parents, teachers, and community educators.",
    highlights: [
      "Targeted a roughly $100 kit cost to make hands-on engineering education more accessible.",
      "Used letter-coded screws, color-coded solderless wiring, preassembled shielding, and written instructions.",
      "Tested with younger students, 8th/9th graders, parents, teachers, and community educators.",
      "Observed older students completing assembly in about 45 minutes while still finding the kit engaging.",
      "Used feedback to increase challenge level, reduce wiring intimidation, and improve instruction clarity."
    ],
    tools: ["User testing", "Market research", "3D printing", "Electronics", "Instruction design", "Product iteration"],
    details: [
      {
        title: "Product objective",
        points: [
          "Built the kit around a simple promise: students should be able to assemble a working hardware product while learning engineering concepts.",
          "The team targeted affordability for under-resourced programs, with a roughly $100 cost goal.",
          "The final product needed to be more than a toy; it had to sound good enough and survive classroom handling."
        ]
      },
      {
        title: "Design choices",
        points: [
          "Used a 3D printed body, affordable electronics, preassembled copper shielding, and solderless color-coded wiring.",
          "Letter-coded screws and matching written instructions reduced confusion for first-time builders.",
          "Pre-adjusting the neck, bridge, and pickups improved the chance that the instrument would play correctly after assembly."
        ]
      },
      {
        title: "Customer experiments",
        points: [
          "Parent research tested whether the build experience or final product value mattered more in the buying decision.",
          "Younger children liked customization but found some wiring intimidating and wanted a clearer tool/setup experience.",
          "8th and 9th graders found the kit more appropriately challenging and completed assembly in roughly 45 minutes."
        ]
      },
      {
        title: "Learning",
        points: [
          "The strongest feedback was that the kit should lean into STEAM learning, not just imitate a cheap instrument.",
          "Teachers and community-program feedback pushed the design toward durability, instruction quality, and class-session feasibility."
        ]
      }
    ],
    gallery: [
      { src: "assets/education-kit.webp", alt: "Guitar education kit laid out as components", caption: "Kit layout" },
      { src: "assets/education-kit-render.webp", alt: "Blue guitar kit render", caption: "Guitar concept" },
      { src: "assets/education-kit-experiment.webp", alt: "Guitar kit experiment render", caption: "Assembly design" },
      { src: "assets/education-kit-parts.webp", alt: "STEAM hardware kit market test poster", caption: "Market test poster" },
      { src: "assets/education-kit-user-test.webp", alt: "Guitar kit components during user testing", caption: "User test setup" }
    ]
  },
  telecaster: {
    kicker: "CNC / finishing / electronics integration",
    title: "Telecaster guitar",
    image: "assets/cover-telecaster.webp",
    summary:
      "Walnut and maple Telecaster-style electric guitar built through material prep, ShopBot CNC routing, drilling, sanding, finishing, and electronics installation.",
    highlights: [
      "Glued smaller walnut pieces into a usable blank to control cost while preserving material quality.",
      "CNC-routed body pockets and wiring channels on a ShopBot after planning the toolpath and hold-down strategy.",
      "Used laser-cut templates to validate drilling locations and pocket geometry.",
      "Created a temporary paint setup and applied a multi-layer white finish over more than a week.",
      "Integrated the electronics package after body fabrication and finishing."
    ],
    tools: ["ShopBot CNC", "Woodworking", "Laser-cut templates", "Finishing", "Electronics", "Fixture planning"],
    details: [
      {
        title: "Material strategy",
        points: [
          "Built the body from walnut and maple, using smaller walnut pieces glued into a blank to keep cost under control.",
          "Used Titebond III and overnight clamping so the blank was ready for CNC operations.",
          "The material choice made the project a real fabrication exercise instead of a kit-only assembly."
        ]
      },
      {
        title: "CNC and post-processing",
        points: [
          "Used a ShopBot router to cut the body outline, electronics pocket, and wiring channels.",
          "Pre-drilled wiring paths and checked pocket geometry before moving into sanding and finishing.",
          "Used laser-cut templates for hole placement, reducing the risk of hand-drilling errors after the expensive CNC step."
        ]
      },
      {
        title: "Finish and electronics",
        points: [
          "Sanded the body and edges, then applied a multi-layer white finish in a temporary paint-tent setup.",
          "The finishing process took more than a week because paint quality depended on surface prep, dry time, and repeat coats.",
          "Installed the electronics package after the body was finished, turning the fabricated part into a playable system."
        ]
      },
      {
        title: "Status",
        points: [
          "Finished, strung, and playable — working pickups, controls, and output jack on the walnut/maple body.",
          "Full process record: glued blank, ShopBot CNC routing, laser-cut drilling templates, multi-coat white finish, electronics install."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-telecaster.webp", alt: "Finished Telecaster-style guitar in a case", caption: "Finished guitar" },
      { src: "assets/telecaster-body.webp", alt: "White Telecaster-style guitar body", caption: "Finished body" },
      { src: "assets/telecaster-wood.webp", alt: "Walnut and maple guitar body blank", caption: "Wood blank" },
      { src: "assets/telecaster-cnc.webp", alt: "Guitar body being machined or prepared near a CNC setup", caption: "CNC setup" },
      { src: "assets/telecaster-finish.webp", alt: "Guitar blank clamped during finishing or preparation", caption: "Body preparation" },
      { src: "assets/telecaster-assembly.webp", alt: "Guitar body assembly and routing process", caption: "Post-processing" }
    ]
  },
  ftc: {
    kicker: "Competition robotics / mechanism design",
    title: "FTC robot",
    image: "assets/cover-ftc-robot.webp",
    summary:
      "Senior Mechanical Engineer work on Pioneer Robotics FTC Team 12589 during a Massachusetts championship-winning season with a cone intake and deposit robot.",
    highlights: [
      "Supported the 2022-2023 cone intake and deposit robot as Senior Mechanical Engineer.",
      "Contributed to linkage extension, claw and arm intake, string-driven slide, rotational deposit, and mecanum drivetrain systems.",
      "Robot won the Massachusetts Championship Tournament Winning Alliance.",
      "Team also earned Motivate and Gracious Professionalism awards.",
      "Autonomous performance used odometry and encoders for position tracking and repeatability."
    ],
    tools: ["FTC robotics", "Mecanum drive", "Odometry", "String-driven slides", "Linkage design", "Competition testing"],
    details: [
      {
        title: "Role and season",
        points: [
          "Worked as Senior Mechanical Engineer on Pioneer Robotics FTC Team 12589 at Saint John's.",
          "The robot was built for the 2022-2023 cone game, with intake, transfer, lift, and deposit functions.",
          "The season ended with a Massachusetts Championship Tournament Winning Alliance result and additional team awards."
        ]
      },
      {
        title: "Mechanisms",
        points: [
          "Used a linkage extension to reduce unnecessary movement during autonomous routines.",
          "Built claw and arm intake hardware to collect cones and move them into the scoring path.",
          "Integrated a string-driven slide and rotational deposit mechanism for vertical scoring."
        ]
      },
      {
        title: "Drive and autonomous",
        points: [
          "Used a belt-drive mecanum drivetrain for field maneuverability.",
          "Combined odometry and encoders so autonomous paths had position feedback instead of dead reckoning alone.",
          "The mechanical design had to support repeated competition cycles, quick repair, and driver practice."
        ]
      },
      {
        title: "Result",
        points: [
          "This project adds early competition robotics evidence: fast iteration, subsystem integration, and performance under event pressure.",
          "It also supports the broader portfolio story of moving from FTC mechanisms into FSAE vehicle systems."
        ]
      }
    ],
    gallery: [
      { src: "assets/cover-ftc-robot.webp", alt: "FTC robot competing on a field with cone scoring elements", caption: "Competition robot" },
      { src: "assets/ftc-robot.webp", alt: "FTC robot CAD or mechanism image", caption: "Robot package" },
      { src: "assets/ftc-action.webp", alt: "FTC competition scoreboard or field event", caption: "Competition result" },
      { src: "assets/ftc-cad.webp", alt: "FTC trophies and awards", caption: "Awards context" },
      { src: "assets/ftc-mechanism.webp", alt: "FTC robot mechanism close-up", caption: "Slide mechanism" }
    ]
  }
};

if (typeof window !== 'undefined') window.projectData = projectData;
