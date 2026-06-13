const projectData = {
  steering: {
    kicker: "Formula SAE / steering / fabrication",
    title: "Mk.8 steering system",
    image: "assets/cover-steering-system.webp",
    summary:
      "Cockpit steering package translating driver input to rack motion through a dual U-joint linkage, redesigned bearing cages, chassis mounts, and serviceable sensor packaging.",
    highlights: [
      "Mechanical Lead context with steering work grounded in Mk.8 cockpit ownership and full-vehicle integration.",
      "Matched dual U-joint bend angles to reduce rotational velocity ripple through the steering column.",
      "Moved the wheel 3.5 inches closer and 15 degrees more vertical than Mk.7 to improve driver posture and cockpit clearance.",
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
          "Planned lathe work for splined shafts, waterjet parts for rack mounting, and welded chassis integration for load paths.",
          "Moved critical fasteners toward higher-grade hardware and preload-aware retention where looseness would become steering play."
        ]
      },
      {
        title: "What it proves",
        points: [
          "This project shows vehicle packaging, linkage analysis, fabrication planning, and safety-critical mechanical judgment in one subsystem.",
          "The design review work is not just a render: it connects human factors, kinematics, strength, manufacturability, and service access."
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
  seat: {
    kicker: "Formula SAE / cockpit / ergonomics",
    title: "Driver seat and harness",
    image: "assets/cover-aluminum-seat.webp",
    summary:
      "Cockpit seat and harness package focused on driver fit, lateral support, mount reliability, fast service access, and rules-driven packaging.",
    highlights: [
      "Separated driver fit, support, and harness routing into explicit design requirements.",
      "Used CAD body positioning, physical fit studies, and feedback from roughly 20 drivers of varying heights.",
      "Accounted for both shortest and tallest drivers with booster strategy and mounting-point flexibility.",
      "Designed around welded chassis tabs, multiple seat mounting points, and dedicated harness interfaces.",
      "Treated ergonomics as an engineering input rather than a final comfort pass."
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
          "Upgraded the harness toward six buckles with an anti-submarine belt on a dedicated chassis bar.",
          "Connected the seat package to the surrounding cockpit systems: pedal tray, steering column, frame tubes, and bodywork."
        ]
      },
      {
        title: "Why it matters",
        points: [
          "This project shows human-centered mechanical design under motorsport constraints: real drivers, real rules, real packaging limits.",
          "The work is especially useful for teams that need someone comfortable moving between CAD, physical fit checks, and fabrication details."
        ]
      }
    ],
    gallery: [
      { src: "assets/seat-cad.webp", alt: "CAD model of a Formula SAE driver seat", caption: "Seat CAD" },
      { src: "assets/seat-ergonomics-rig.webp", alt: "Driver ergonomics fit-check rig", caption: "Fit-check rig" },
      { src: "assets/seat-fea.webp", alt: "Seat support finite element analysis result", caption: "Seat analysis" },
      { src: "assets/fsae-mk7-cockpit.webp", alt: "Formula SAE cockpit and driver packaging image", caption: "Cockpit package" },
      { src: "assets/fsae-mk7-shop.webp", alt: "Olin Electric Motorsports car in a paddock setting", caption: "Vehicle context" }
    ]
  },
  carbonSeat: {
    kicker: "Formula SAE / composites / support",
    title: "Carbon fiber seat support",
    image: "assets/cover-carbon-fiber-seat.webp",
    summary:
      "Composite-focused seat and bodywork support work improving shoulder support, driver retention, repairability, and manufacturability.",
    highlights: [
      "Added upper-seat support thinking around shoulders and hip flanges rather than only a simple pan.",
      "Connected carbon fiber layup choices to stiffness, weight, repairability, and driver support.",
      "Kept bodywork service access and removal in the same design conversation as the seat geometry.",
      "Framed the composite work around load paths and fit, not styling.",
      "Used Mk.7 build context to inform Mk.8 cockpit improvements."
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
        title: "Outcome",
        points: [
          "The project turns cockpit support into a system problem: composite structure, driver sizing, bodywork service, and chassis interfaces.",
          "It adds depth to the FSAE work by showing material/process reasoning, not just metallic brackets and CAD assemblies."
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
    title: "Brake temperature simulation",
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
    title: "Automated perfume dispenser",
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
          "The lesson was concrete: actuator choice must include expected runtime, not only force, stroke, and CAD packaging.",
          "The project is a good signal for rapid mechanism design under real integration pressure."
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
  aura: {
    kicker: "Autonomous cart / swerve drive / fabrication",
    title: "AURA swerve drive system",
    image: "assets/aura-swerve.jpeg",
    summary:
      "Front-wheel swerve drive system for Project AURA, a 200-lb-capacity autonomous cart. My mechanical focus was the drive and steering package: independent front-wheel steering, chain-driven steering reduction, DC drive motors, robust shafts, and fabricated steel mounts.",
    highlights: [
      "Owned the mechanical swerve drive direction for a cart designed to carry 200 lb while remaining steerable and autonomous.",
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
          "The project goal was a smart autonomous cart, but the mechanical requirement I focused on was making the cart drive, steer, and carry a 200 lb load reliably.",
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
          "The drive system uses two MY1016Z6 24 V DC motors with a 9:16 sprocket ratio, targeting acceleration around 1 m/s^2 with a 200 lb payload.",
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
      "Packaged controller, sensors, motor drivers, battery, and wheels in a tight chassis footprint.",
      "Used front sensing and a compact two-wheel drive layout for line-following behavior.",
      "Kept wiring short and serviceable so debugging stayed possible after assembly.",
      "Shows electromechanical integration across controls, chassis packaging, power, and physical build.",
      "Updated photos from the project folder are now included in the gallery."
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
          "The updated photos show the main packaging challenge: many electrical interfaces in very limited space.",
          "The build rewards short wire runs, clear connector routing, and accessible components for iteration."
        ]
      },
      {
        title: "Integration signal",
        points: [
          "This is a compact example of system integration: the mechanical layout, wiring, sensing, and controller all affect performance.",
          "It sits well next to the larger hardware projects because it shows hands-on embedded build discipline at small scale."
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
  gearbox: {
    kicker: "Transmission / packaging / fabrication",
    title: "2-speed gearbox",
    image: "assets/gearbox-exploded.webp",
    summary:
      "Functional two-speed gearbox with neutral, belt drive, helical gears, shifting mechanism, and a planned assembly path for a dense 53-part mechanism.",
    highlights: [
      "Designed a selector fork and selector mechanism to switch between first, neutral, and second.",
      "Used helical gears for smoother contact and power transfer in the printed gearbox.",
      "Validated shifting tolerances through three printed iteration bands before the final assembly.",
      "Mapped assembly order in SolidWorks to manage 53 parts inside tight packaging.",
      "Completed the build ahead of the deadline with detachable parts for size constraints."
    ],
    tools: ["SolidWorks", "3D printing", "Helical gears", "Belt drive", "Selector fork", "Tolerance iteration"],
    details: [
      {
        title: "Objective",
        points: [
          "Designed and built a two-speed gearbox with a neutral position, smooth rotation, and a functional shift mechanism.",
          "The project combined a gear system, belt system, and translating selector hardware inside a compact package.",
          "A key constraint was finishing early enough to debug assembly and shift feel rather than only presenting CAD."
        ]
      },
      {
        title: "Shifting mechanism",
        points: [
          "Converted knob rotation into linear selector motion through a selector fork and slider architecture.",
          "The selector engages different gear selectors to choose first, neutral, or second gear.",
          "Helical gears were used to increase contact area and make power transfer feel smoother than a rough spur-gear demonstrator."
        ]
      },
      {
        title: "Tolerance and iteration",
        points: [
          "Printed multiple tolerance variations around the shifting interfaces instead of assuming nominal CAD clearances would work.",
          "Tested loose and tight fits, then selected the tolerance window that shifted reliably without excessive backlash.",
          "This directly addressed the common failure mode for printed transmissions: they look assembled but do not shift cleanly."
        ]
      },
      {
        title: "Integration",
        points: [
          "The final mechanism had more than 50 parts, so assembly order became a design variable, not an afterthought.",
          "Used SolidWorks to reason through how parts could be installed, removed, and serviced inside the available space.",
          "The result was a functioning gearbox that demonstrated packaging, kinematics, and build planning."
        ]
      }
    ],
    gallery: [
      { src: "assets/gearbox-exploded.webp", alt: "Exploded view of two-speed gearbox CAD", caption: "Exploded assembly" },
      { src: "assets/gearbox-assembly.webp", alt: "Two-speed gearbox exploded assembly render", caption: "Part architecture" },
      { src: "assets/gearbox-section.webp", alt: "Section view of gearbox and shifter layout", caption: "Internal layout" },
      { src: "assets/gearbox-render.webp", alt: "Gearbox render with helical gears and shafts", caption: "Gear train" },
      { src: "assets/gearbox-shifter.webp", alt: "Close-up of gearbox helical gear", caption: "Gear detail" }
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
          "Teachers and community-program feedback pushed the design toward durability, instruction quality, and class-session feasibility.",
          "This project shows product iteration driven by actual users instead of only internal team assumptions."
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
  wankel: {
    kicker: "CAD / eccentric motion / 3D printing",
    title: "Wankel engine replica",
    image: "assets/wankel-model.webp",
    summary:
      "Functional automata inspired by the Mazda 13B rotary engine, using printed parts, eccentric gearing, and a motor-driven dual-rotor assembly.",
    highlights: [
      "Modeled complex rotary geometry and a SolidWorks exploded assembly around eccentric motion.",
      "Built a dual-rotor mechanism driven by a motor at roughly 160 rpm.",
      "Integrated a belt-driven centrifugal supercharger concept for the visual and mechanical system.",
      "Designed extra mounting points and spare clearance to handle print tolerance and assembly variation.",
      "Managed large prints and support structures across a roughly multi-pound PLA build."
    ],
    tools: ["SolidWorks", "FDM printing", "Gear trains", "Eccentric mechanisms", "Exploded views", "Assembly iteration"],
    details: [
      {
        title: "Objective",
        points: [
          "Built an automata mechanism inspired by the Mazda 13B rotary engine, including two rotors eccentrically connected to the driveshaft.",
          "The goal was to make the motion legible and smooth, not only to create a static engine model.",
          "The project also required a clear SolidWorks exploded view and assembly logic for many printed parts."
        ]
      },
      {
        title: "Motion architecture",
        points: [
          "Modeled the rotor housing, eccentric path, drive geometry, and gear relationships needed for smooth rotary motion.",
          "Added a belt-driven centrifugal supercharger concept to make the external mechanism more complete.",
          "Used a small motor to drive the assembly and demonstrate the two rotors moving together."
        ]
      },
      {
        title: "Print and assembly challenges",
        points: [
          "Large prints and long print times made early design decisions important because failed geometry would cost too much time and material.",
          "Added extra mounting holes and spare space so tolerance variation would not block final assembly.",
          "Planned support structures and surface finish to get metallic-looking mechanical parts from FDM printing."
        ]
      },
      {
        title: "Skills shown",
        points: [
          "This project is a strong CAD and mechanism signal: complex geometry, eccentric motion, gear relationships, printed tolerances, and assembly planning.",
          "It also shows the ability to turn a real mechanical reference into a functional educational model."
        ]
      }
    ],
    gallery: [
      { src: "assets/wankel-model.webp", alt: "CAD render of Wankel engine replica", caption: "Automata model" },
      { src: "assets/wankel-13b-reference.webp", alt: "Mazda 13B rotary engine reference image", caption: "13B reference" },
      { src: "assets/wankel-exploded.webp", alt: "Wankel replica exploded view", caption: "Exploded view" },
      { src: "assets/wankel-rotor.webp", alt: "Rotor and eccentric gear detail", caption: "Rotor geometry" },
      { src: "assets/wankel-gear.webp", alt: "Wankel gear and housing detail", caption: "Gear detail" }
    ]
  },
  telecaster: {
    kicker: "CNC / finishing / electronics integration",
    title: "Telecaster build",
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
        title: "Why it matters",
        points: [
          "This is a clean manufacturing story: material prep, CNC, templates, finishing, and integration.",
          "The project is presented as precision fabrication and process control on a real, playable instrument."
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
  },
  noise: {
    kicker: "Image processing / parameter search",
    title: "Noise reduction algorithm",
    image: "assets/cover-noise-reduction.webp",
    summary:
      "Image-processing pipeline for extremely noisy images using SVD, PCA, Gaussian smoothing, mean filtering, adaptive thresholding, and parameter sweeps.",
    highlights: [
      "Targeted images degraded by Gaussian, salt-and-pepper, and Poisson-style noise.",
      "Separated RGB channels and used SVD to isolate dominant image structure from noisy variation.",
      "Combined Gaussian smoothing, downscale/upscale blocking, iterative mean filtering, and NaN pixel repair.",
      "Ran a two-parameter sweep over SVD rank and threshold to tune quality.",
      "Used a PSNR-weighted EVD metric to balance denoising strength against detail loss."
    ],
    tools: ["SVD", "PCA", "Gaussian filters", "Mean filters", "Adaptive thresholding", "Parameter sweeps"],
    details: [
      {
        title: "Problem",
        points: [
          "Built the algorithm for images so noisy that both humans and downstream algorithms struggle to identify the content.",
          "The project considered common noise sources such as sensor noise, photon scatter, high ISO, transmission artifacts, and storage corruption.",
          "The team focused on Gaussian noise, salt-and-pepper noise, and Poisson-style noise examples."
        ]
      },
      {
        title: "Pipeline",
        points: [
          "Processed RGB channels separately so the algorithm could apply linear algebra and filtering per channel.",
          "Used SVD to capture dominant structure, then applied Gaussian smoothing and iterative mean filtering to suppress noise.",
          "Computed the difference between original and filtered outputs, used adaptive thresholding to mark noisy pixels, and repaired missing values from valid neighbors."
        ]
      },
      {
        title: "Optimization",
        points: [
          "Ran a two-dimensional sweep over SVD rank and noise threshold to understand the tuning space instead of guessing parameters.",
          "Visualized the metric as a heatmap so the chosen settings were traceable.",
          "Used a PSNR-weighted EVD metric to trade off denoising against oversmoothing."
        ]
      },
      {
        title: "Limitations",
        points: [
          "The SVD plus Gaussian approach removes much of the noise, but aggressive pixel repair can blur fine details.",
          "The project is useful because it explains the tradeoff clearly rather than pretending denoising is lossless.",
          "It rounds out the portfolio with analytical software work alongside hardware projects."
        ]
      }
    ],
    gallery: [
      { src: "assets/noise-comparison.webp", alt: "Noise reduction before and after comparison", caption: "Before/after comparison" },
      { src: "assets/noise-gaussian.webp", alt: "Gaussian noise image example", caption: "Gaussian noise" },
      { src: "assets/noise-salt-pepper.webp", alt: "Salt-and-pepper noise image example", caption: "Salt-and-pepper noise" },
      { src: "assets/noise-poisson.webp", alt: "Poisson noise image example", caption: "Poisson noise" },
      { src: "assets/noise-after.webp", alt: "Denoised output image", caption: "Filtered output" },
      { src: "assets/noise-sweep.webp", alt: "Heatmap of noise reduction metric", caption: "Parameter sweep" }
    ]
  }
};

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
  esp32: {
    title: "ESP32",
    meta: "Compact control nodes",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/ESP32%20Espressif%20ESP-WROOM-32%20Dev%20Board%20%282%29.jpg?width=900",
    alt: "ESP32 development board",
    text:
      "Wireless-capable microcontroller work for compact telemetry, sensor nodes, and mechatronics debugging."
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
    image: "assets/seat-cad.webp",
    alt: "CAD model of a seat structure",
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
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Hepia-cmefe%20Kalex%20CFD.png?width=900",
    alt: "Motorcycle fairing computational fluid dynamics visualization",
    text:
      "Flow and pressure tradeoff thinking for cooling, bodywork, and geometry choices where air becomes a design constraint."
  },
  "cnc mill": {
    title: "CNC Mill",
    meta: "Precision machining",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/CNC%20milling%20machine.jpg?width=900",
    alt: "CNC milling machine",
    text:
      "Machined interfaces, bearing cages, mounts, and tolerance-critical details where fit and repeatability matter."
  },
  lathe: {
    title: "Lathe",
    meta: "Round hardware",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Workshop%20lathe%20machine.jpg?width=900",
    alt: "Workshop lathe machine",
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
  }
};

function initHeroSkillCards() {
  const skillItems = [...document.querySelectorAll(".hero-skill-track span")];
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
const setPiece = document.querySelector(".set-piece");
const scrollCue = document.querySelector(".scroll-cue");
let scrollTicking = false;

function updateScrollEffects() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const ratio = max > 0 ? window.scrollY / max : 0;
  progress.style.width = `${ratio * 100}%`;
  header.classList.toggle("is-scrolled", window.scrollY > 24);

  if (setPiece && !reducedMotion.matches) {
    const rect = setPiece.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    if (rect.top < window.innerHeight && rect.bottom > 0 && total > 0) {
      const p = Math.min(Math.max(-rect.top / total, 0), 1);
      setPiece.style.setProperty("--p", p.toFixed(4));
    }
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

/* ============ stat counters ============ */

document.querySelectorAll("[data-count]").forEach((el) => {
  const target = parseFloat(el.dataset.count);
  const decimals = parseInt(el.dataset.decimals || "0", 10);
  el.textContent = target.toFixed(decimals);
});

/* ============ filters (with view transitions when available) ============ */

const cards = [...document.querySelectorAll(".project-card")];
const filters = [...document.querySelectorAll(".filter")];

filters.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    const apply = () => {
      filters.forEach((item) => item.classList.toggle("active", item === button));
      cards.forEach((card) => {
        const show = filter === "all" || card.dataset.category.includes(filter);
        card.classList.toggle("is-hidden", !show);
      });
    };
    if (document.startViewTransition && !reducedMotion.matches) {
      document.startViewTransition(apply);
    } else {
      apply();
    }
  });
});

/* ============ project cards: keyboard, tilt, specular ============ */

let tiltFrame = null;

cards.forEach((card) => {
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Open ${card.querySelector("h3")?.textContent || "project"} case study`);

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

  card.addEventListener("click", () => openModal(card.dataset.project));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal(card.dataset.project);
    }
  });
});

/* ============ magnetic buttons ============ */

document.querySelectorAll("[data-magnetic]").forEach((el) => {
  el.addEventListener("pointermove", (event) => {
    if (!finePointer.matches || reducedMotion.matches) return;
    const rect = el.getBoundingClientRect();
    const dx = event.clientX - rect.left - rect.width / 2;
    const dy = event.clientY - rect.top - rect.height / 2;
    const clamp = (v, m) => Math.max(-m, Math.min(m, v));
    el.style.transform = `translate(${clamp(dx * 0.18, 6)}px, ${clamp(dy * 0.3, 5)}px)`;
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
  fillList(modalHighlights, project.highlights);
  fillList(modalTools, project.tools);
  renderDetails(project);
  renderGallery(project);
  modalPanel.scrollTop = 0;
  modal.classList.remove("is-closing");
  modal.setAttribute("aria-hidden", "false");
  body.classList.add("modal-open");
  modal.querySelector(".modal-close").focus();
}

function closeModal() {
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
