/* Editorial summaries for all sixteen standalone project pages.
   Full galleries and technical records continue to come from project-data.js.
   Runtime animation covers override these fallback renders when available.
   Photographs and engineering plots remain unchanged in the shared galleries. */
window.caseStudyData = {
  steering: {
    number: '01',
    title: 'Mk.8 steering.',
    label: 'Formula SAE / Design & fabrication',
    deck: 'From kinematics to installed hardware.',
    description: 'A closer wheel. A lighter column. A steering path designed around the driver—and built by hand.',
    "cover": {
      "src": "assets/editorial/animation-start-20260913/steering-wide-1800.webp?v=703f3e188422",
      "alt": "Steering wheel, column, universal joints and rack in their neutral position.",
      "caption": "The steering assembly, from rack to wheel.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/steering-wide-480.webp?v=029d82ebf7ef 480w, assets/editorial/animation-start-20260913/steering-wide-960.webp?v=9309aad28424 960w, assets/editorial/animation-start-20260913/steering-wide-1800.webp?v=703f3e188422 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      ['My role', 'Cockpit-side steering design and fabrication; later Mechanical Lead for vehicle integration.'],
      ['Result', 'Bearing cages 0.9 kg lighter than Mk.7. I cut, turned, and welded every steering part.'],
      ['Evidence', 'Installed hardware, hand sizing, and FEA. U-joint ripple cancellation is supported by the kinematic model.']
    ],
    chapters: [
      {
        id: 'constraint', label: 'Constraint', title: 'Start with the driver.',
        paragraphs: [
          'Fit a precise steering path into a crowded cockpit—without sacrificing dashboard space, driver ingress, or service access.',
          'I brought the wheel 3.5 inches closer than Mk.7 and worked the shaft geometry around driver reach and chassis clearance.'
        ],
        image: 1, evidence: 'Assembly CAD',
        note: 'Wheel reach, joint angles, and chassis interfaces were designed together.'
      },
      {
        id: 'decisions', label: 'Decisions', title: 'Match the joints.\nControl the ripple.',
        paragraphs: [
          'A single bent U-joint varies its output speed through a revolution. I compared shaft angles and yoke phasing before settling on matched bends around 27.5°.',
          'The paired geometry cancels speed variation in the ripple model. That is the modeling result; an instrumented ripple measurement is not documented here.'
        ],
        image: 2, evidence: 'Kinematic model',
        note: 'Speed-ratio modeling informed the final column geometry.'
      },
      {
        id: 'build', label: 'Build', title: 'Own the load path.\nThen make it.',
        paragraphs: [
          'I waterjet-cut rack mounts, lathe-turned shafts, and TIG-welded the chassis integration. Bearing cages shed 0.9 kg relative to the previous design.',
          'Critical fasteners and preload-aware retention addressed looseness at the interfaces—the places where small motion becomes steering play.'
        ],
        image: 0, evidence: 'Fabricated hardware',
        note: 'Actual U-joint hardware and its chassis packaging.'
      },
      {
        id: 'validation', label: 'Validation', title: 'Calculate.\nCross-check. Install.',
        paragraphs: [
          'Peak tire friction and Ackermann geometry gave a calculated worst-case steering torque of 50 N·m. I sized each shaft in torsion by hand, then cross-checked it in FEA.',
          'The system is installed and has run without reported issues. The calculations and simulation support sizing; the photographs document the built system.'
        ],
        image: 3, evidence: 'Shaft sizing model',
        note: 'Hand calculations and FEA informed shaft sizing.'
      }
    ],
    recordNote: 'The original notes include wheel-orientation and column-posture figures without specifying both angle references. The overview emphasizes the documented 3.5-inch reach change.',
    next: 'vineRobot'
  },
  vineRobot: {
    number: '02',
    title: 'Vine robotics.',
    label: 'Olin Vine Robotics Lab / Summer 2026',
    deck: 'Build. Test. Reinforce.',
    description: 'An eversion platform that turns soft-robot geometry into repeatable experiments.',
    "cover": {
      "src": "assets/editorial/animation-start-20260913/vineRobot-wide-1800.webp?v=67b6707786d5",
      "alt": "Vine robot pressure vessel with its translucent tube retracted.",
      "caption": "The eversion platform and its reinforcement.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/vineRobot-wide-480.webp?v=14efea96c9ef 480w, assets/editorial/animation-start-20260913/vineRobot-wide-960.webp?v=c5c0b88ca117 960w, assets/editorial/animation-start-20260913/vineRobot-wide-1800.webp?v=67b6707786d5 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      ['My role', 'Summer research assistant. Owned eversion hardware, reinforcement, and the 45-run experiment.'],
      ['Result', 'Swappable outlets for three body types. Built, tested, and reinforced the research platform.'],
      ['Evidence', '45 experiment runs. 5 psi is the design pressure; reinforcement results cited here are FEA.']
    ],
    chapters: [
      {
        id: 'constraint', label: 'Constraint', title: 'Make geometry\nquick to change.',
        paragraphs: [
          'The lab needed circular, three-partition, and stick-reinforced vine bodies for cross-section deformation research. Frequent swaps and visible eversion mattered as much as pressure containment.',
          'I designed around a transparent 19 L polypropylene pail, targeting 34 kPa (5 psi). A fixed outlet takes interchangeable converters, making a new body geometry a one-part change.'
        ],
        image: 5, evidence: 'Outlet assembly CAD',
        note: 'A fixed outlet, swappable converters, and geometry-matched TPU seals.'
      },
      {
        id: 'decisions', label: 'Decisions', title: 'Give every force\na place to go.',
        paragraphs: [
          'The stock snap lid could not carry the drive hardware or seal under pressure. A bolted lid mount grips behind the pail flange and carries the calculated blow-off load in tension.',
          'Printed TPU 85A gaskets conform to FDM surfaces. Bearings carry spool weight and vine tension; a flexible coupling accommodates motor-shaft misalignment.'
        ],
        image: 4, evidence: 'Lid assembly CAD',
        note: 'The lid, gasket, and flange-gripping mount share the same bolt pattern.'
      },
      {
        id: 'build', label: 'Build', title: 'Let the first build\nshow the weak points.',
        paragraphs: [
          'The first vessel held 1.2 psi with significant deformation. Testing exposed coupling and vine-to-spool failures, followed by leaks.',
          'I added 6061 aluminum plates, an aluminum lid, and three C-shaped A36 steel brackets. Open cutouts retained the visibility needed to debug eversion.'
        ],
        image: 6, evidence: 'Reinforced assembly CAD',
        note: 'Reinforcement adds a load path around the original vessel.'
      },
      {
        id: 'validation', label: 'Validation', title: 'Build the experiment\naround actual force.',
        paragraphs: [
          'I ran 36 loaded conditions and nine unloaded baselines: 45 runs across three body types. A scale beneath the vine measured actual force because guide-bearing friction made applied weight an unreliable proxy.',
          'Reinforcement FEA at 500 lbf per face predicted 6.524 mm peak displacement and 0.2339 GPa peak stress. These are simulation results, not a demonstrated 5 psi operating-pressure rating.'
        ],
        image: 2, evidence: 'Experiment setup',
        note: 'Guide rods constrain the load shape; the scale measures the force reaching the body.'
      }
    ],
    next: 'javelin'
  },
  javelin: {
    "number": "03",
    "title": "Javelin VTOL.",
    "label": "Aerospace / Airframe & integration",
    "deck": "A fast-airframe target. A harder control problem.",
    "description": "A four-motor tail-sitter designed around a 300 km/h target, with attitude control assigned entirely to differential thrust.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/javelin-wide-1800.webp?v=e1d8086f8ff4",
      "alt": "Javelin airframe suspended above the studio floor with four propellers.",
      "caption": "The Javelin airframe, four motors, and high-speed packaging.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/javelin-wide-480.webp?v=db45904bbee0 480w, assets/editorial/animation-start-20260913/javelin-wide-960.webp?v=5b2dcec64850 960w, assets/editorial/animation-start-20260913/javelin-wide-1800.webp?v=e1d8086f8ff4 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Airframe, material selection, propulsion packaging, and avionics integration."
      ],
      [
        "Status",
        "Built and fully modeled. Flight testing remains pending in the project record."
      ],
      [
        "Evidence",
        "CAD and built-airframe documentation. 300 km/h is a design target, not a demonstrated flight speed."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Trade control surfaces\nfor motor mixing.",
        "paragraphs": [
          "Javelin takes off vertically, then tips into forward flight. Four motors provide yaw, pitch, and roll without flaps, ailerons, rudders, or servos.",
          "Removing those mechanisms shifts the control problem into differential-thrust mixing and autopilot tuning. A 26-item requirements matrix guided the design."
        ],
        "image": 1,
        "evidence": "Airframe documentation",
        "note": "The four-motor X configuration and compact nose package."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Let the speed target\nshape the structure.",
        "paragraphs": [
          "The 300 km/h target led to a Von Karman ogive nose, swept wing, thin NACA-0008 stabilizers, and streamlined motor fairings.",
          "PPA-CF, ASA, and PC-FR serve different structural, RF, and heat-related needs. Bonded 3 × 1.5 mm carbon-fiber tubes reinforce the wing and tail."
        ],
        "image": 2,
        "evidence": "Nose and sensor detail",
        "note": "The ogive nose with a pitot tube extending into the incoming flow."
      },
      {
        "id": "integration",
        "label": "Integration",
        "title": "Package power,\nsensing, and control.",
        "paragraphs": [
          "Four T-Motor F90 motors use tractor propellers. Parallel 4S packs retain 14.8 V, while XT90-S connectors manage connection inrush.",
          "A Matek H743-WING runs ArduPlane. The airspeed sensor, GPS/compass, radio, and FPV system share the airframe with separated high- and low-voltage cable routes.",
          "Three propeller types cover low-speed testing, everyday operation and top-speed attempts. A MATLAB study compares 10 candidates against motor RPM, pitch speed and tip-Mach limits."
        ],
        "image": 3,
        "evidence": "Propulsion hardware",
        "note": "A tractor motor and propeller mounted to the swept wing."
      },
      {
        "id": "status",
        "label": "Status",
        "title": "Complete the hardware.\nEarn the flight evidence.",
        "paragraphs": [
          "The airframe and full CAD are complete, with electronics selected and integrated. The project record identifies fail-safe behavior and differential-thrust tuning as remaining work.",
          "Flight testing was held pending that work and regulatory review. The animated flight pose illustrates the design; the gallery does not establish flight performance."
        ],
        "image": 5,
        "evidence": "Built-airframe documentation",
        "note": "Javelin resting outdoors; this image is not a flight-test result."
      }
    ],
    "next": "scanner"
  },
  scanner: {
    number: '04',
    title: 'LiDAR scanner.',
    label: 'Olin PIE / Motion & measurement',
    deck: 'Turn motion into measured geometry.',
    description: 'A one-week build connecting repeatable gantry motion with calibrated distance data.',
    "cover": {
      "src": "assets/editorial/animation-start-20260913/scanner-wide-1800.webp?v=81c8b13c8e74",
      "alt": "LiDAR scanner with blue printed mounts, guide rods and a plywood base.",
      "caption": "A Cartesian gantry for repeatable sensor positioning.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/scanner-wide-480.webp?v=745b117370b1 480w, assets/editorial/animation-start-20260913/scanner-wide-960.webp?v=029010cbc8c0 960w, assets/editorial/animation-start-20260913/scanner-wide-1800.webp?v=81c8b13c8e74 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      ['My role', 'Gantry design, electrical architecture, and TFmini-S calibration with teammate Jacob Likins.'],
      ['Result', '2,206 measurements over a 140 × 165 mm area. Designed and built in one week.'],
      ['Evidence', '<3% error for calibrated distance readings beyond roughly 30 cm—not overall 3D reconstruction accuracy.']
    ],
    chapters: [
      {
        id: 'constraint', label: 'Constraint', title: 'Know where\neach reading belongs.',
        paragraphs: [
          'A distance sensor needs a repeatable position before its readings can describe shape. We replaced a less accurate servo pan/tilt concept with a Cartesian gantry.',
          'The one-week build paired TFmini-S LiDAR with an Arduino Nano ESP32 and controlled raster motion to trace the object’s geometry.'
        ],
        image: 1, evidence: 'Gantry CAD',
        note: 'Dual lead screws drive Y; a belt-driven carriage controls X.'
      },
      {
        id: 'decisions', label: 'Decisions', title: 'Calibrate the sensor.\nRespect its range.',
        paragraphs: [
          'I measured 14 known distances with a ruler and fitted a correction curve in MATLAB. Readings below about 30 cm were less stable, so sensor placement used the more reliable range.',
          'Calibration brought distance-reading error below roughly 3% in that stable range. It does not establish the same accuracy for the reconstructed point cloud.'
        ],
        image: 3, evidence: 'Measured calibration result',
        note: 'Before-and-after distance error; the claim applies beyond roughly 30 cm.'
      },
      {
        id: 'build', label: 'Build', title: 'Separate motion power\nfrom clean data.',
        paragraphs: [
          'NEMA 17 steppers and DRV8825 drivers run from the 12 V motor supply. Homing switches establish coordinates before each scan.',
          'Copper-lined packaging, shielded sensor wiring, and motor-rail capacitors reduced electrical noise. The emergency stop cuts motor voltage while keeping controller logic alive.'
        ],
        image: 4, evidence: 'Electrical architecture',
        note: 'Motion, sensing, and stop behavior are explicit in the wiring architecture.'
      },
      {
        id: 'validation', label: 'Validation', title: '2,206 readings.\nOne integrated system.',
        paragraphs: [
          'The raster scan captured 2,206 measurements across a 140 × 165 mm region of a small test object. Each reading was paired with gantry position for visualization.',
          'The result demonstrates the complete motion–sensing–calibration workflow. The calibration plots quantify distance behavior; the scan plot shows the reconstructed shape.'
        ],
        image: 6, evidence: 'Scan output',
        note: 'The test object and its scan plot, preserved from the project record.'
      }
    ],
    next: 'brakeSim'
  },
  brakeSim: {
    "number": "05",
    "title": "Brake thermal model.",
    "label": "Formula SAE / MATLAB & FEA",
    "deck": "Remove mass without ignoring heat soak.",
    "description": "A track-based sizing study that connects endurance braking, rotor cooling, and structural checks.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/brakeSim-wide-1800.webp?v=3a64d74549f9",
      "alt": "Perforated cast-iron brake rotor before heating.",
      "caption": "The brake rotor represented in the thermal and structural study.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/brakeSim-wide-480.webp?v=7f8140ac58d4 480w, assets/editorial/animation-start-20260913/brakeSim-wide-960.webp?v=6f4f3c1e9704 960w, assets/editorial/animation-start-20260913/brakeSim-wide-1800.webp?v=3a64d74549f9 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Mk.8 rotor and pad temperature modeling, linked to rotor sizing and hardware selection."
      ],
      [
        "Target",
        "25% rotor mass reduction, evaluated against endurance heat loads and structural FEA."
      ],
      [
        "Evidence",
        "A 22-lap, 25-segment thermal model and a reported 3.0 structural FEA safety factor."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Size for repeated laps,\nnot one stop.",
        "paragraphs": [
          "Reducing rotor mass also reduces its thermal capacity. The model asks how much material can be removed while keeping rotor and pad temperatures within usable ranges.",
          "Twenty-five track segments define velocity and braking demand across a 22-lap endurance cycle, including the cooling time between braking events."
        ],
        "image": 2,
        "evidence": "Rotor geometry CAD",
        "note": "Perforated rotor geometry considered alongside thermal mass."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Account for where\nthe heat goes.",
        "paragraphs": [
          "Braking work supplies heat; front/rear bias assumptions divide the load. The model also includes conduction into the hub, radiation, and velocity-dependent convection.",
          "High-load course zones identify the temperature peaks that matter for sizing. The plotted histories are model predictions."
        ],
        "image": 1,
        "evidence": "Thermal simulation",
        "note": "Predicted rotor and pad temperatures over the endurance cycle."
      },
      {
        "id": "hardware",
        "label": "Hardware",
        "title": "Choose a usable\nfriction system.",
        "paragraphs": [
          "ASTM A48 Class 40 cast iron was selected for conductivity, friction pairing, cost, and manufacturability.",
          "The study links rotor temperatures to Wilwood GP200 calipers and BP-28 pads. AN3 service disconnects were considered for faster line replacement."
        ],
        "image": 2,
        "evidence": "Hardware sizing geometry",
        "note": "The rotor pattern is one part of a coupled mass, cooling, and hardware decision."
      },
      {
        "id": "validation",
        "label": "Validation",
        "title": "Cross-check the model\nand its assumptions.",
        "paragraphs": [
          "Mk.7 and peer-team data provided comparison points because brake-temperature predictions depend strongly on their inputs.",
          "The design record balances the 25% mass-reduction target with a 3.0 structural FEA safety factor. It documents a sizing baseline rather than a measured endurance-temperature result."
        ],
        "image": 0,
        "evidence": "Structural FEA",
        "note": "The original rotor analysis; the stated safety factor is a simulation result."
      }
    ],
    "recordNote": "The 25% figure is a design target. The source record does not report a measured final rotor mass reduction or a full instrumented endurance-temperature validation.",
    "next": "aura"
  },
  aura: {
    "number": "06",
    "title": "AURA swerve drive.",
    "label": "Autonomous luggage robot / Mechanical lead",
    "deck": "Drive and steer through the same wheel.",
    "description": "Two front modules that package steering torque, drive reduction, bearings, and fabricated mounts around a heavy payload.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/aura-wide-1800.webp?v=c836c58c0436",
      "alt": "Assembled AURA swerve module with its wheel, motors and metal structure.",
      "caption": "The AURA front-wheel swerve assembly and its drive and steering hardware.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/aura-wide-480.webp?v=f721eee5c5f7 480w, assets/editorial/animation-start-20260913/aura-wide-960.webp?v=14eafcd84535 960w, assets/editorial/animation-start-20260913/aura-wide-1800.webp?v=c836c58c0436 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "My role",
        "Mechanical lead for the front-wheel swerve system; the broader autonomy stack was outside my scope."
      ],
      [
        "Target → tested",
        "200 lb initial payload target → 300 lb carried in testing."
      ],
      [
        "Evidence",
        "Fabricated A36 mounts, chain packaging, wheel hardware, and encoder integration."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Fit both motions\naround the wheel.",
        "paragraphs": [
          "Each front module combines driving and steering. Motors, chains, sprockets, shafts, bearings, and mounts all compete for the same space.",
          "The original payload target was 200 lb. The finished robot carried 300 lb in testing, exceeding that target."
        ],
        "image": 0,
        "evidence": "Built swerve hardware",
        "note": "The two front modules combine traction and steering."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Trade steering speed\nfor torque.",
        "paragraphs": [
          "Independent wheel angles approach Ackermann behavior to reduce scrub. Each NEMA 23 stepper uses an 18:80 sprocket reduction.",
          "Moving the steering motors toward the robot center increased sprocket spacing and helped reduce chain skipping. MY1016Z drive motors use a separate 9:16 ratio."
        ],
        "image": 1,
        "evidence": "Steering-chain hardware",
        "note": "Chain and sprocket spacing was a mechanical packaging decision."
      },
      {
        "id": "build",
        "label": "Build",
        "title": "Make the mounts\nshop-ready.",
        "paragraphs": [
          "Quarter-inch A36 steel provided a weldable material for wheel housings and motor mounts. The parts were OMAX-waterjetted, TIG-welded, and painted.",
          "Testing spacers and shortening mounting hardware resolved interference in the crowded wheel package."
        ],
        "image": 2,
        "evidence": "Fabrication evidence",
        "note": "The waterjet-cut and welded steel mount."
      },
      {
        "id": "integration",
        "label": "Integration",
        "title": "Close the loop\nat the shaft.",
        "paragraphs": [
          "LPD3806 encoders on the 3/8-inch front wheel shafts provide speed and displacement feedback. The assemblies combine solid rubber wheels, steel shafts, and eight bearings.",
          "The robot carried 300 lb in testing against a 200 lb initial target. The acceleration figure in the drivetrain record remains a design target."
        ],
        "image": 5,
        "evidence": "Encoder integration",
        "note": "Shaft-mounted feedback within the finished wheel package."
      }
    ],
    "next": "carbonSeat"
  },
  carbonSeat: {
    "number": "07",
    "title": "Carbon seat shell.",
    "label": "Formula SAE / Composites & serviceability",
    "deck": "Support the driver. Leave room to repair.",
    "description": "A laid-up cockpit shell shaped around lateral support, practical manufacturing, and race-weekend access.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/carbonSeat-wide-1800.webp?v=e55168f5b204",
      "alt": "Carbon-fiber seat layup at the beginning of the fabrication sequence.",
      "caption": "The carbon-fiber shoulder and hip-support shell.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/carbonSeat-wide-480.webp?v=b4d0ed782e04 480w, assets/editorial/animation-start-20260913/carbonSeat-wide-960.webp?v=4ce57e1ee13b 960w, assets/editorial/animation-start-20260913/carbonSeat-wide-1800.webp?v=e55168f5b204 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Composite seat support, layup planning, trimming, and service-access review."
      ],
      [
        "Result",
        "A laid-up and trimmed shell for the Mk.8 cockpit."
      ],
      [
        "Evidence",
        "Mold, cloth layup, demolded shell, and trimming photographs."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Support more\nthan the seat pan.",
        "paragraphs": [
          "The upper cockpit needs shoulder and hip retention under lateral load. The shell adds support above the pan while fitting around harness routing, frame tubes, and bodywork.",
          "Mk.7 build experience identified the support and service-access issues to address in Mk.8."
        ],
        "image": 0,
        "evidence": "Fabricated shell",
        "note": "The demolded carbon support shell."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Design for the mold\nand the hands making it.",
        "paragraphs": [
          "Carbon fiber was chosen for lightweight stiffness where driver retention justified the composite work.",
          "The geometry had to accommodate practical layup and trimming. Mold access, installation, and removal mattered alongside the surface visible in CAD."
        ],
        "image": 1,
        "evidence": "Layup tooling",
        "note": "The male mold used to form the seat support."
      },
      {
        "id": "build",
        "label": "Build",
        "title": "Place the cloth.\nPreserve the finish.",
        "paragraphs": [
          "I used Easy Composites EL2 resin with 3K, 200 g/m² twill carbon cloth. The main shell has 20 plies, with another 5–10 plies of small patches for local reinforcement.",
          "The photographs preserve the original weave and layup process. The shell was cured, demolded, and trimmed for the cockpit package."
        ],
        "image": 2,
        "evidence": "Composite fabrication",
        "note": "Original cloth-layup detail, preserved from the build record."
      },
      {
        "id": "service",
        "label": "Service",
        "title": "Plan for the next\nrace-weekend repair.",
        "paragraphs": [
          "The shell and surrounding bodywork were designed for removal, repair, and reassembly without damaging adjacent panels.",
          "That service requirement shaped the geometry and interfaces. The trimmed shell is the documented manufacturing result."
        ],
        "image": 3,
        "evidence": "Finished fabrication",
        "note": "The trimmed support shell after curing."
      }
    ],
    "recordNote": "The scroll animation illustrates cloth placement; its visible layers do not count the actual laminate. The build uses 20 main plies plus 5–10 plies of local reinforcement patches. The record documents fabrication and design intent, without laminate coupon-test results.",
    "next": "seat"
  },
  seat: {
    "number": "08",
    "title": "Mk.7 driver seat.",
    "label": "Formula SAE / Mk.7 seat fabrication",
    "deck": "From sheet geometry to the cockpit.",
    "description": "Making the aluminum driver seat for the Mk.7 Formula SAE car.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/seat-wide-1800.webp?v=b7141b451e94",
      "alt": "Folded and perforated aluminum driver seat.",
      "caption": "The Mk.7 driver-seat geometry.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/seat-wide-480.webp?v=51a70042cd0e 480w, assets/editorial/animation-start-20260913/seat-wide-960.webp?v=4ad9afc13786 960w, assets/editorial/animation-start-20260913/seat-wide-1800.webp?v=b7141b451e94 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "My role",
        "Responsible for fabrication of the Mk.7 driver seat."
      ],
      [
        "Project",
        "The aluminum seat for the Mk.7 Formula SAE car."
      ],
      [
        "Evidence",
        "Seat CAD, a supporting analysis image, and Mk.7 cockpit and vehicle photographs."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Start with\nthe seat geometry.",
        "paragraphs": [
          "The seat CAD shows the perforated pan, back, and folded side panels. This is the geometry behind the Mk.7 seat fabrication project.",
          "My responsibility was making the seat for the car."
        ],
        "image": 0,
        "evidence": "Seat CAD",
        "note": "The complete seat geometry, shown without cropping its edges."
      },
      {
        "id": "fit",
        "label": "Fabrication",
        "title": "Make the seat\nfor the car.",
        "paragraphs": [
          "The fabrication work turned the seat geometry into a cockpit component for Mk.7.",
          "The cockpit photograph places the seat in its vehicle context, alongside the frame and surrounding controls."
        ],
        "image": 2,
        "evidence": "Mk.7 cockpit",
        "note": "The Mk.7 cockpit surrounding the seat."
      },
      {
        "id": "interfaces",
        "label": "Interfaces",
        "title": "Keep the surrounding\nstructure in view.",
        "paragraphs": [
          "The seat sits within the chassis and shares space with the steering and other cockpit hardware.",
          "The vehicle photographs provide context for those interfaces around the fabricated part."
        ],
        "image": 3,
        "evidence": "Mk.7 vehicle",
        "note": "The car in its broader build context."
      },
      {
        "id": "validation",
        "label": "Record",
        "title": "Keep the supporting\nrecord together.",
        "paragraphs": [
          "The original project gallery includes a seat-support analysis image alongside the CAD and vehicle photographs.",
          "The image is retained as supporting project context; this page attributes the seat fabrication to me."
        ],
        "image": 1,
        "evidence": "Support FEA",
        "note": "Original supporting analysis image; no numerical result is reported."
      }
    ],
    "next": "materialTest"
  },
  materialTest: {
    "number": "09",
    "title": "Material measurements.",
    "label": "Olin Vine Robotics Lab / Instron testing",
    "deck": "Measure the inputs the model depends on.",
    "description": "Tension and bending experiments connecting vine materials to an orthotropic membrane model and rod stiffness.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/materialTest-wide-1800.webp?v=ae3f78031cc9",
      "alt": "Orange tensile specimen held between silver grips before stretching.",
      "caption": "The tensile-testing apparatus used to illustrate specimen loading.",
      "kind": "Display reconstruction",
      "srcset": "assets/editorial/animation-start-20260913/materialTest-wide-480.webp?v=fc175327fb3d 480w, assets/editorial/animation-start-20260913/materialTest-wide-960.webp?v=ddf2eb275716 960w, assets/editorial/animation-start-20260913/materialTest-wide-1800.webp?v=ae3f78031cc9 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "My role",
        "Research assistant measuring membrane and reinforcing-rod properties for the cross-section model."
      ],
      [
        "Tests",
        "30 tensile specimens and 11 bamboo rods on an Instron 3345."
      ],
      [
        "Evidence",
        "Measured force/extension data, fitted moduli, directional response, and bending stiffness."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Replace assumed\nmaterial inputs.",
        "paragraphs": [
          "The cross-section model takes membrane and bamboo-rod stiffness directly. Measuring those inputs avoids carrying literature-value assumptions into every prediction.",
          "The work covers TPU-coated fabric in three directions, LDPE film, and the bamboo reinforcement."
        ],
        "image": 0,
        "evidence": "Measured tensile curves",
        "note": "Individual specimens and group means over the first 25 mm of extension."
      },
      {
        "id": "method",
        "label": "Method",
        "title": "Make the procedure\nfit the hardware.",
        "paragraphs": [
          "Thirty tensile specimens comprise seven MD, seven TD, eight at 45°, and eight LDPE samples. The work follows ASTM D882 methods with a 100 mm gauge length adapted from the nominal 250 mm to the available grips.",
          "Specimen dimensions were measured before testing, and crosshead speeds followed the standard's strain-rate rule. Modulus came from least-squares fits to the initial linear region."
        ],
        "image": 1,
        "evidence": "Test apparatus",
        "note": "The Instron 3345 frame and tensile grips."
      },
      {
        "id": "direction",
        "label": "Direction",
        "title": "The weave changes\nthe answer.",
        "paragraphs": [
          "Measured fabric moduli were 76.30 MPa in MD, 69.89 MPa in TD, and 41.78 MPa at 45°. The lower off-axis stiffness informs the plane-stress orthotropic fit.",
          "The fitted directional curve has a minimum near 46°. Mild curvature lowers fit quality for the 45° fabric and LDPE, limiting confidence in those fitted moduli."
        ],
        "image": 11,
        "evidence": "Measured inputs and fitted model",
        "note": "Directional modulus inferred from the three measured fabric directions."
      },
      {
        "id": "bending",
        "label": "Bending",
        "title": "Use EI as\nthe model input.",
        "paragraphs": [
          "Eleven rods selected for straightness were tested over a 73.37 mm span. Initial force–deflection fits were converted to bending stiffness using the central-load beam relation.",
          "The primary result is EI = 0.672 ± 0.063 N·m². Every rod fit exceeded R² 0.999; the derived material modulus is reported for comparison.",
          "The measured bamboo-rod diameter range is 5.79–6.33 mm."
        ],
        "image": 12,
        "evidence": "Measured bending curves",
        "note": "Force–deflection data for all eleven tested bamboo rods."
      }
    ],
    "recordNote": "The tensile gauge length was adapted to the available grips; the rod tests use a documented repeatable fixture and fitting procedure. The animated deformation is illustrative. The original per-rod EI / E plot is retained as a historical calculation: with 5.79–6.33 mm confirmed as diameter, its E conversion requires review. No corrected modulus is reported; force–deflection stiffness and EI remain the direct bending-test results.",
    "next": "ansysCfd"
  },
  ansysCfd: {
    "number": "10",
    "title": "Agent-based CFD.",
    "label": "Ansys Fluent / PyFluent automation",
    "deck": "Make a simulation workflow reviewable.",
    "description": "A teaching package built from an agent-run cruise case, including the failures, recovery steps, and credibility gates.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/ansysCfd-wide-1800.webp?v=79560302c1eb",
      "alt": "Javelin pressure field and numerical flow paths at the beginning of the flow sequence.",
      "caption": "Qualitative pressure and flow visualization around the Javelin airframe.",
      "kind": "Numerical field visualization",
      "srcset": "assets/editorial/animation-start-20260913/ansysCfd-wide-480.webp?v=c1cb16c29c38 480w, assets/editorial/animation-start-20260913/ansysCfd-wide-960.webp?v=d40a994e3edf 960w, assets/editorial/animation-start-20260913/ansysCfd-wide-1800.webp?v=79560302c1eb 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Headless Fluent workflow, reusable agent instructions, failure recovery, and result auditing."
      ],
      [
        "Deliverable",
        "A teaching package with prompts, SOP, API playbook, templates, and reference scripts."
      ],
      [
        "Evidence",
        "A 300 kph cruise case and 11 documented failures. Estimated-reference coefficients remain process-validation results."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Run the solver.\nShow what it did.",
        "paragraphs": [
          "The project tested whether an AI coding agent could run a reviewable CFD workflow through PyFluent without relying on the desktop GUI.",
          "The teaching case uses Javelin at 300 kph, Mach 0.245. The package covers launch, file handling, solve monitoring, post-processing, and reporting."
        ],
        "image": 4,
        "evidence": "Workflow execution record",
        "note": "Background tasks coordinating a headless Fluent solve."
      },
      {
        "id": "mesh",
        "label": "Mesh",
        "title": "Keep the surface\nrecognizable.",
        "paragraphs": [
          "The initial wrap mesh ran but lost CAD surface fidelity and resisted reliable headless refinement.",
          "A conforming multi-region mesh with one pressure-far-field boundary preserved the smoother surface representation and avoided brittle region extraction."
        ],
        "image": 5,
        "evidence": "Meshing comparison record",
        "note": "The documented conforming-pressure comparison against the earlier wrap approach."
      },
      {
        "id": "setup",
        "label": "Setup",
        "title": "Read the settings\nback from the solver.",
        "paragraphs": [
          "The recorded setup uses compressible ideal-gas physics, k–ω SST, Mach 0.245, and a verified angle-of-attack flow vector.",
          "Silent setting failures are treated as blockers. The workflow reads back far-field Mach and flow direction, then stops when they do not match the intended values."
        ],
        "image": 2,
        "evidence": "Simulation output",
        "note": "The original Mach-plane plot; it accompanies the solver-setting audit."
      },
      {
        "id": "credibility",
        "label": "Credibility",
        "title": "Package the limits\nwith the results.",
        "paragraphs": [
          "The package records 11 real failures, including headless import crashes, report-loop traps, and orphaned MPI processes retaining a license seat.",
          "Quality gates cover geometry, mesh, convergence, y+, force extraction, and reporting. Coefficients using estimated reference dimensions are labeled process-validation values."
        ],
        "image": 0,
        "evidence": "Process-validation CFD",
        "note": "The original conforming Cp result, with credibility limits retained in the technical record."
      }
    ],
    "recordNote": "The animated pressure display is a later qualitative reconstruction, separate from the original gallery and teaching package. Its 400-iteration solve has minimum orthogonal quality around 3.187e-9, no prism boundary layer or grid-independence study, and first-order transport. It does not establish design-grade aerodynamic performance.",
    "next": "pool",
    "downloads": [
      {
        "href": "assets/claude_ansys_cfd.zip",
        "label": "Download CFD package"
      }
    ]
  },
  pool: {
    "number": "11",
    "title": "Pool Sniper.",
    "label": "Assistive mechanism / Powertrain",
    "deck": "Give the user control of aim and force.",
    "description": "A cue launcher combining laser alignment, stored elastic energy, and adjustable mechanical release.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/pool-wide-1800.webp?v=9e21238a7a7a",
      "alt": "Pool Sniper launcher with its cue extended before retraction.",
      "caption": "The Pool Sniper cue launcher and pullback mechanism.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/pool-wide-480.webp?v=21df1f6ee5c4 480w, assets/editorial/animation-start-20260913/pool-wide-960.webp?v=d14d1960a595 960w, assets/editorial/animation-start-20260913/pool-wide-1800.webp?v=9e21238a7a7a 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Cue pullback, adjustable release, aiming, and compact mechanical packaging."
      ],
      [
        "Result",
        "A working mechanism developed through machining, fit checks, and shop iteration."
      ],
      [
        "Evidence",
        "Mechanism CAD, an exploded assembly, and a fabricated plate. User-trial or shot-accuracy data are not reported."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Keep aim and power\nin the user's hands.",
        "paragraphs": [
          "The launcher is intended for beginners and users who find traditional cue stance, sighting, or striking difficult.",
          "Laser aiming supports alignment, while physical trigger position sets shot strength. The mechanism aims to provide break-shot power within a compact package."
        ],
        "image": 0,
        "evidence": "Mechanism CAD",
        "note": "The complete launcher and its aiming and pullback layout."
      },
      {
        "id": "mechanism",
        "label": "Mechanism",
        "title": "Store energy.\nChoose the release.",
        "paragraphs": [
          "Surgical tubing stores energy as the cue is pulled back. A rack and pinion load the cue, and the sliding trigger selects the release position.",
          "A chain-and-sprocket drive packages the pulling motion. The force setting remains a physical adjustment at the mechanism."
        ],
        "image": 1,
        "evidence": "Assembly CAD",
        "note": "The exploded layout separates drive, cue, and release components."
      },
      {
        "id": "build",
        "label": "Build",
        "title": "Let fit problems\nchange the process.",
        "paragraphs": [
          "Early plasma-cut plates had poorly controlled tolerances. The final build moved to waterjet parts to improve fit.",
          "Long cue machining required manual finishing, while wiring lengths and connector routes had to be planned around the compact mechanism."
        ],
        "image": 2,
        "evidence": "Fabrication evidence",
        "note": "An early plasma-cut plate; the source notes describe the later process change."
      },
      {
        "id": "iteration",
        "label": "Iteration",
        "title": "Integrate the small\ninterfaces too.",
        "paragraphs": [
          "Laser aiming and a two-way switch support operation without traditional sighting technique. Wire routing and component access remain part of the mechanical package.",
          "The build record describes shop iteration bringing the mechanism to working condition. The available evidence does not quantify shot repeatability or accessibility outcomes."
        ],
        "image": 0,
        "evidence": "Integrated mechanism design",
        "note": "The CAD package documents layout rather than measured shot performance."
      }
    ],
    "recordNote": "The animation retains the documented source rack/pinion tooth overlap and illustrates pullback and release. It does not establish exact tooth contact, measured launch force, or user-test performance.",
    "next": "lineFollower"
  },
  lineFollower: {
    "number": "12",
    "title": "LineFollower robot.",
    "label": "Olin PIE / Embedded hardware",
    "deck": "Make a small package easy to debug.",
    "description": "A two-week robot build combining sensing, differential drive, and dense but accessible wiring.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/lineFollower-wide-1800.webp?v=a854f61a252d",
      "alt": "Line-following robot with orange wheels and a teal circuit board.",
      "caption": "The compact two-wheel LineFollower with its controller and front sensing.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/lineFollower-wide-480.webp?v=9ecb1d9656e5 480w, assets/editorial/animation-start-20260913/lineFollower-wide-960.webp?v=f3d10acdf1f9 960w, assets/editorial/animation-start-20260913/lineFollower-wide-1800.webp?v=a854f61a252d 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Mechanical packaging, embedded wiring, sensor placement, and drive integration."
      ],
      [
        "Result",
        "A palm-size Arduino Mega robot with documented stable low-speed line tracking."
      ],
      [
        "Evidence",
        "Prototype, wiring, and full-build photographs; no quantified tracking-error data are supplied."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Fit the whole system\naround a small wheelbase.",
        "paragraphs": [
          "The robot combines an Arduino Mega, motor drivers, battery, front-mounted sensors, and two-wheel differential drive.",
          "The two-week build required the sensor line, wheelbase, and center of mass to stay close enough for stable low-speed tracking."
        ],
        "image": 2,
        "evidence": "Prototype hardware",
        "note": "The source gallery identifies this prototype as 428 g."
      },
      {
        "id": "packaging",
        "label": "Packaging",
        "title": "Short wires.\nAccessible connections.",
        "paragraphs": [
          "The controller and drive modules were stacked around the wheelbase. Short wire runs and clear routing kept numerous interfaces manageable.",
          "Accessible connectors support sensor and drive-module swaps during iteration. The gallery records a 284 g lightweighted build."
        ],
        "image": 1,
        "evidence": "Wiring and packaging",
        "note": "Arduino Mega and wiring in the build captioned 284 g."
      },
      {
        "id": "tuning",
        "label": "Tuning",
        "title": "Balance sensing\nwith the drive.",
        "paragraphs": [
          "Front IR reflectance sensing provides the line signal. Sensor thresholds, driver wiring, and left/right drive balance were tuned together.",
          "Keeping the hardware accessible makes those adjustments possible after assembly, rather than forcing a complete teardown."
        ],
        "image": 1,
        "evidence": "Integrated electronics",
        "note": "The wiring photograph documents the interfaces used during tuning."
      },
      {
        "id": "result",
        "label": "Result",
        "title": "Close the loop\nin a working robot.",
        "paragraphs": [
          "The project record reports stable low-speed line tracking from the integrated controls, power, sensing, and drive package.",
          "The photographs document the robot and its packaging. They are not a substitute for a measured tracking-error or endurance dataset."
        ],
        "image": 0,
        "evidence": "Built-system evidence",
        "note": "The complete robot package preserved in the original gallery."
      }
    ],
    "next": "formlabs"
  },
  formlabs: {
    "number": "13",
    "title": "Smelly.",
    "label": "Formlabs hackathon / Mechanical hardware",
    "deck": "Build the motion in two and a half days.",
    "description": "Gantry and dispensing actuators for a perfume-mixing prototype built around six fragrance bases.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/formlabs-wide-1800.webp?v=641ab2c47949",
      "alt": "Smelly perfume mixer with its white structure and steel guide rods.",
      "caption": "The Smelly gantry and dispensing hardware.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/formlabs-wide-480.webp?v=2078d7cb0a6b 480w, assets/editorial/animation-start-20260913/formlabs-wide-960.webp?v=867ce147dd15 960w, assets/editorial/animation-start-20260913/formlabs-wide-1800.webp?v=641ab2c47949 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "My role",
        "Mechanical gantry and linear actuator design and fabrication for Team Scent-A-Tubbies."
      ],
      [
        "Result",
        "An integrated perfume-mixing prototype built during a 2.5-day sprint."
      ],
      [
        "Evidence",
        "Prototype and test photographs, actuator wiring, and a documented overheating failure."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Turn a scent profile\ninto physical motion.",
        "paragraphs": [
          "Smelly mixes perfume from six fragrance bases. The hardware had to position the dispenser and actuate each dose within a short hackathon schedule.",
          "I owned the gantry and linear actuators; teammates integrated software and dispensing."
        ],
        "image": 0,
        "evidence": "Integrated prototype",
        "note": "The gantry and fragrance bottles in the built machine."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Compare the actuator\nbefore time runs out.",
        "paragraphs": [
          "The team considered stepper lead-screw and rack-and-pinion actuator concepts for the dispensing motion.",
          "A compact Raspberry Pi-controlled gantry indexed between bottles. Printing, assembly, and debugging had to leave room for full-machine integration."
        ],
        "image": 1,
        "evidence": "Actuator integration",
        "note": "Original actuator wiring and hardware documentation."
      },
      {
        "id": "build",
        "label": "Build",
        "title": "Print for the next\nuseful test.",
        "paragraphs": [
          "Formlabs Form 4 and Bambu Lab P1S printers balanced detailed resin parts with faster FDM iterations.",
          "Motion-critical tolerances took priority over details that would not change the demonstration. The test setup connected those parts to the fragrance bases."
        ],
        "image": 2,
        "evidence": "Dispensing test setup",
        "note": "The gantry and bottles arranged for testing."
      },
      {
        "id": "learning",
        "label": "Learning",
        "title": "Runtime belongs\nin actuator selection.",
        "paragraphs": [
          "Sustained operation overheated the stepper lead-screw actuator. A mechanism that fit the force, stroke, and package requirements still had a duty-cycle problem.",
          "The build made thermal behavior part of actuator selection. The final presentation documents the prototype; the overheating finding comes from the project notes."
        ],
        "image": 3,
        "evidence": "Final prototype presentation",
        "note": "The integrated machine at the end of the sprint."
      }
    ],
    "next": "telecaster"
  },
  telecaster: {
    "number": "14",
    "title": "Telecaster guitar.",
    "label": "CNC / Woodworking & electronics",
    "deck": "Take the body from blank to playable.",
    "description": "Material preparation, CNC routing, drilling fixtures, finishing, and electronics connected in one instrument build.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/telecaster-wide-1800.webp?v=8070d2fb8672",
      "alt": "Finished Telecaster-style guitar at the start of its full rotation.",
      "caption": "The finished Telecaster-style guitar and its body hardware.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/telecaster-wide-480.webp?v=6387951b4ea8 480w, assets/editorial/animation-start-20260913/telecaster-wide-960.webp?v=06a4a7e77290 960w, assets/editorial/animation-start-20260913/telecaster-wide-1800.webp?v=8070d2fb8672 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Wood-body fabrication, fixture planning, finishing, and electronics installation."
      ],
      [
        "Result",
        "Finished, strung, and playable, with working pickups, controls, and output jack."
      ],
      [
        "Evidence",
        "Glue-up, ShopBot routing, drilling templates, paint work, and the finished instrument."
      ]
    ],
    "chapters": [
      {
        "id": "material",
        "label": "Material",
        "title": "Start with a blank\nyou can afford.",
        "paragraphs": [
          "Smaller walnut pieces were glued into a cost-effective blank for the walnut body.",
          "Titebond III and overnight clamping prepared the material for CNC work. The project began with raw materials rather than a kit."
        ],
        "image": 4,
        "evidence": "Material preparation",
        "note": "Body pieces clamped during glue-up."
      },
      {
        "id": "machining",
        "label": "Machining",
        "title": "Plan the cut\nand the hold-down.",
        "paragraphs": [
          "ShopBot toolpaths routed the body outline, electronics pocket, and wiring channels.",
          "Hold-down planning, pre-drilled wiring paths, and pocket checks connected the machining sequence to the later electronics installation."
        ],
        "image": 5,
        "evidence": "CNC fabrication",
        "note": "The walnut body being routed on the ShopBot."
      },
      {
        "id": "fixtures",
        "label": "Fixtures",
        "title": "Control the holes\nthat come after CNC.",
        "paragraphs": [
          "Laser-cut templates checked drilling locations and reduced hand-drilling errors.",
          "The jig carried the planned geometry into the post-CNC operations before sanding and finishing.",
          "Fender Deluxe Drive pickups complete the electronics in the walnut-body guitar."
        ],
        "image": 6,
        "evidence": "Drilling fixture",
        "note": "The body holes being drilled with a locating jig."
      },
      {
        "id": "finish",
        "label": "Finish",
        "title": "Give the surface\nthe time it needs.",
        "paragraphs": [
          "Sanding, drying, and repeated white coats extended finishing beyond a week in a temporary paint setup.",
          "Electronics were installed after finishing. The result is the strung, playable guitar documented in the case photograph."
        ],
        "image": 0,
        "evidence": "Finished instrument",
        "note": "The completed Telecaster-style guitar in its case."
      }
    ],
    "next": "education"
  },
  education: {
    "number": "15",
    "title": "Guitar education kit.",
    "label": "STEAM hardware / User testing",
    "deck": "Make the build part of the lesson.",
    "description": "A guitar kit shaped by assembly experiments with students, parents, teachers, and community educators.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/education-wide-1800.webp?v=12f75ab07d1d",
      "alt": "Separated guitar education kit before assembly.",
      "caption": "The guitar education kit in its separated starting layout.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/animation-start-20260913/education-wide-480.webp?v=f32330d208b2 480w, assets/editorial/animation-start-20260913/education-wide-960.webp?v=affcd431789c 960w, assets/editorial/animation-start-20260913/education-wide-1800.webp?v=12f75ab07d1d 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "Scope",
        "Kit design, assembly instructions, and customer experiments."
      ],
      [
        "Target",
        "Roughly $100 per kit to broaden access to hands-on engineering education."
      ],
      [
        "Evidence",
        "Two 15-year-old testers assembled the kit in roughly 45 minutes; younger testers identified wiring and setup concerns."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Design for a classroom,\nnot just a workbench.",
        "paragraphs": [
          "The kit is intended to let middle and high school students assemble working hardware while learning engineering concepts.",
          "Affordability, sound, durability, and a feasible class-session build all shape the design. The roughly $100 figure is a cost goal."
        ],
        "image": 0,
        "evidence": "Kit documentation",
        "note": "The component layout supplied to the learner."
      },
      {
        "id": "assembly",
        "label": "Assembly",
        "title": "Make the next step\nrecognizable.",
        "paragraphs": [
          "Letter-coded screws match the instructions. Color-coded solderless wiring and preassembled copper shielding reduce unfamiliar operations.",
          "The neck, bridge, and pickups are pre-adjusted to support playability after assembly."
        ],
        "image": 2,
        "evidence": "Assembly CAD",
        "note": "The exploded view clarifies component relationships; it is not a user-test photograph."
      },
      {
        "id": "testing",
        "label": "Testing",
        "title": "Watch different ages\nmeet the same kit.",
        "paragraphs": [
          "Two 8-year-olds liked customization but found some wiring intimidating and wanted clearer tool and setup guidance.",
          "Two 15-year-olds found the challenge appropriate and assembled the kit in about 45 minutes. Interviews also involved parents, teachers, and community educators."
        ],
        "image": 3,
        "evidence": "Market-test material",
        "note": "The project poster accompanies the customer-experiment notes."
      },
      {
        "id": "iteration",
        "label": "Iteration",
        "title": "Keep the learning\nvisible in the product.",
        "paragraphs": [
          "Feedback favored the STEAM build experience over imitating a low-cost instrument. Teachers and community programs emphasized durability and instruction quality.",
          "That feedback informed clearer instructions, reduced wiring concerns, and an appropriate challenge level. The record documents a small exploratory test group."
        ],
        "image": 1,
        "evidence": "Product CAD",
        "note": "The guitar concept developed alongside the assembly and teaching experience."
      }
    ],
    "recordNote": "The price is a target and the assembly time describes two older testers, not a general classroom benchmark. The animation includes documented display-fit adjustments of about 2.319 mm at the neck and pickup front plate, plus a floor lift; these are illustration clearances, not manufacturing tolerances.",
    "next": "ftc"
  },
  ftc: {
    "number": "16",
    "title": "FTC competition robot.",
    "label": "Pioneer Robotics / Team 12589",
    "deck": "Make the whole scoring cycle repeatable.",
    "description": "Intake, transfer, lift, deposit, and field movement integrated for the 2022–2023 cone game.",
    "cover": {
      "src": "assets/editorial/animation-start-20260913/ftc-wide-1800.webp?v=5871c5896c13",
      "alt": "Assembled FTC robot with an aluminum lift, red panels and mecanum wheels.",
      "caption": "The FTC robot's drivetrain and cone-handling mechanism.",
      "kind": "Display reconstruction",
      "srcset": "assets/editorial/animation-start-20260913/ftc-wide-480.webp?v=8c09a3b5c72e 480w, assets/editorial/animation-start-20260913/ftc-wide-960.webp?v=0fd0dafb6f46 960w, assets/editorial/animation-start-20260913/ftc-wide-1800.webp?v=5871c5896c13 1800w",
      "width": 1800,
      "height": 1200
    },
    "summary": [
      [
        "My role",
        "Senior Mechanical Engineer on Pioneer Robotics FTC Team 12589 at Saint John's."
      ],
      [
        "Team result",
        "Massachusetts Championship Tournament Winning Alliance, plus Motivate and Gracious Professionalism awards."
      ],
      [
        "Evidence",
        "Competition, mechanism-prototype, team, and award photographs."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Constraint",
        "title": "Connect the steps\nbetween cone and score.",
        "paragraphs": [
          "The 2022–2023 robot needed intake, transfer, lift, and deposit functions that worked together through repeated competition cycles.",
          "Mechanical contributions covered linkage extension, claw and arm intake, string-driven slides, rotational deposit, and the mecanum drivetrain."
        ],
        "image": 0,
        "evidence": "Competition evidence",
        "note": "The robot operating among the cone-scoring elements."
      },
      {
        "id": "mechanisms",
        "label": "Mechanisms",
        "title": "Reach and lift\nwith a useful sequence.",
        "paragraphs": [
          "Linkage extension reduced unnecessary autonomous movement. The claw and arm collected cones and transferred them for scoring.",
          "A string-driven slide supplied vertical reach, with rotational deposit hardware completing the placement sequence."
        ],
        "image": 1,
        "evidence": "Mechanism prototype",
        "note": "The slide mechanism documented during development."
      },
      {
        "id": "integration",
        "label": "Integration",
        "title": "Design for drivers\nand autonomous feedback.",
        "paragraphs": [
          "Belt-driven mecanum wheels provided field maneuverability. Odometry and encoders added position feedback beyond dead reckoning alone.",
          "Repeated cycles, driver practice, and quick repairs shaped how the subsystems were integrated. This was a team-built machine."
        ],
        "image": 4,
        "evidence": "Team context",
        "note": "Pioneer Robotics team documentation."
      },
      {
        "id": "result",
        "label": "Result",
        "title": "Test the integration\nunder competition pressure.",
        "paragraphs": [
          "The team earned Massachusetts Championship Tournament Winning Alliance along with Motivate and Gracious Professionalism awards.",
          "The season supplied experience in mechanism iteration and subsystem integration that carried into later Formula SAE work."
        ],
        "image": 3,
        "evidence": "Competition awards",
        "note": "The original trophies-and-awards photograph."
      }
    ],
    "next": "steering"
  }
};
