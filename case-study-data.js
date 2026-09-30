/* Editorial summaries for all sixteen standalone project pages.
   Full galleries and technical records continue to come from project-data.js.
   Runtime animation covers override these fallback renders when available.
   Photographs and engineering plots remain unchanged in the shared galleries. */
window.caseStudyData = {
  steering: {
    number: '01',
    title: 'Mk.8 steering.',
    label: 'Formula SAE / Design & fabrication',
    deck: "Improve driver reach without compromising the steering path.",
    description: "A Mk.7-to-Mk.8 redesign connecting cockpit packaging, U-joint kinematics, shaft sizing, and personally fabricated hardware.",
    engineering: {
      "goal": "Improve steering reach and reduce column mass while keeping a precise, serviceable path from wheel to rack.",
      "constraints": [
        "Cockpit template, dashboard space, driver ingress, and chassis clearance.",
        "Joint angles, shaft torsion, bearing stiffness, and available shop processes."
      ],
      "checks": [
        [
          "Driver reach and mass",
          "Mk.7-to-Mk.8 geometry and component comparison",
          "Wheel 3.5 in closer; bearing cages 0.9 kg lighter.",
          "Built revision"
        ],
        [
          "Smooth torque transmission",
          "U-joint angle and yoke-phasing model",
          "Matched 27.5° bends cancel ideal speed variation; the 3° misalignment / 3° phasing case reaches a 1.032 maximum speed ratio.",
          "Calculated"
        ],
        [
          "Shaft load capacity",
          "Peak tire-friction load, hand torsion sizing, and FEA",
          "50 N·m calculated design load used to size and cross-check each shaft.",
          "Calculated + simulated"
        ],
        [
          "Vehicle integration",
          "Fabrication, installation, and use",
          "Installed system has run without reported issues.",
          "Observed operation"
        ]
      ],
      "iteration": "Mk.7 packaging informed the closer wheel and lighter cages. The model also exposes the remaining sensitivity: joint alignment and phasing matter as much as nominal shaft strength."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/steering-wide-1800.webp?v=1dc33b0efc43",
      "alt": "Steering wheel, column, universal joints and rack in their neutral position.",
      "caption": "The steering assembly, from rack to wheel.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/steering-wide-480.webp?v=6db6807f9bf0 480w, assets/editorial/neutral-20260915/steering-wide-960.webp?v=14b1d151b82a 960w, assets/editorial/neutral-20260915/steering-wide-1800.webp?v=1dc33b0efc43 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Cockpit-side design, shaft sizing, and fabrication of every steering part; later vehicle integration as Mechanical Lead."
      ],
      [
        "Design change",
        "Wheel 3.5 in closer to the driver; bearing cages 0.9 kg lighter than Mk.7."
      ],
      [
        "Result",
        "Installed and operating without reported issues. Kinematic and structural predictions remain distinct from operating observations."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Translate driver reach\ninto shaft geometry.",
        "paragraphs": [
          "The Mk.8 column had to improve driver reach while preserving the cockpit template, dashboard space, ingress, and access to the hardware. Those interfaces constrained the steering path before shaft sizes were chosen.",
          "I used Mk.7 as the baseline, moving the wheel 3.5 inches closer and reducing bearing-cage mass by 0.9 kg. The task joined ergonomics, kinematics, and fabrication in one assembly."
        ],
        "image": 1,
        "evidence": "Assembly CAD",
        "note": "Wheel reach, joint angles, and chassis interfaces were designed together."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Balance packaging\nagainst joint ripple.",
        "paragraphs": [
          "A bent U-joint introduces rotational speed variation. I compared shaft angles and yoke phasing, choosing matched bends around 27.5° to cancel that variation in the ideal paired-joint model.",
          "Packaging could not be judged by clearance alone: misalignment and phase error degrade the cancellation. The sensitivity case with 3° of each predicts a 1.032 maximum speed ratio, giving the geometry review a concrete consequence."
        ],
        "image": 2,
        "evidence": "Kinematic model",
        "note": "Speed-ratio modeling informed the final column geometry."
      },
      {
        "id": "build",
        "label": "Build",
        "title": "Turn the load path\ninto installed hardware.",
        "paragraphs": [
          "I waterjet-cut rack mounts, lathe-turned shafts, and TIG-welded the chassis integration. Removing bearing-cage material traded mass against stiffness; critical fasteners and preload-aware retention addressed play at the interfaces.",
          "The final hardware uses M4 fasteners and a NARRco rack with 17.4 inches between heim-joint attachment bolts and 4.0 inches of travel per pinion revolution. These interfaces tied the column design to the built car."
        ],
        "image": 0,
        "evidence": "Fabricated hardware",
        "note": "Actual U-joint hardware and its chassis packaging."
      },
      {
        "id": "validation",
        "label": "Validation",
        "title": "Size the shafts.\nCheck the installation.",
        "paragraphs": [
          "Peak tire friction and Ackermann geometry produced a calculated worst-case torque of 50 N·m. I sized each shaft in torsion by hand and cross-checked it in FEA before fabricating the assembly.",
          "The installed system has run without reported issues. That operating result closes the build-and-integration loop; the ripple and torsion values remain model predictions rather than instrumented measurements."
        ],
        "image": 3,
        "evidence": "Shaft sizing model",
        "note": "Hand calculations and FEA informed shaft sizing."
      }
    ],
    recordNote: 'The original notes include wheel-orientation and column-posture figures without specifying both angle references. The overview emphasizes the documented 3.5-inch reach change.',
    next: 'vineRobot'
  },
  vineRobot: {
    number: '02',
    title: 'Vine robotics.',
    label: 'Olin Vine Robotics Lab / Summer 2026',
    deck: "Make a test platform that can change with the experiment.",
    description: "A soft-robot pressure vessel revised after deformation and drivetrain failures, then used for a 45-run cross-section study.",
    engineering: {
      "goal": "Evert interchangeable vine bodies and measure how cross-section, pressure, and contact load change their shape.",
      "constraints": [
        "34 kPa (5 psi) containment target; bodies up to 571 mm circumference; more than 15 daily swaps targeted.",
        "Limited sheet-metal tooling and budget, visible eversion, and sealing against printed surfaces."
      ],
      "checks": [
        [
          "Pressure containment",
          "Initial physical test and subsequent reinforcement FEA",
          "First vessel held 1.2 psi with substantial deformation. Reinforcement at 500 lbf per face predicts 6.524 mm displacement and 0.2339 GPa peak stress.",
          "Tested, then simulated"
        ],
        [
          "Interchangeable body geometry",
          "Fixed outlet with replaceable converters",
          "Circular, three-partition, and stick-reinforced bodies used in the experiment.",
          "Built + used"
        ],
        [
          "Controlled contact force",
          "Scale beneath the vine; adjust within ±0.05 kg of target",
          "Actual transmitted force sets the load despite guide-bearing friction.",
          "Measured"
        ],
        [
          "Experimental coverage",
          "36 loaded combinations and nine unloaded baselines",
          "45 runs across three body types and three pressure settings.",
          "Completed experiment"
        ]
      ],
      "iteration": "Observed wall deformation, coupling release, spool-joint failure, and leaks determined the reinforcement work. A physical proof of the reinforced 5 psi target is a separate verification from its FEA and the lower-pressure research runs."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/vineRobot-wide-1800.webp?v=883f0f7423bf",
      "alt": "Vine robot pressure vessel with its translucent tube retracted.",
      "caption": "The eversion platform and its reinforcement.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/vineRobot-wide-480.webp?v=6e95ec264865 480w, assets/editorial/neutral-20260915/vineRobot-wide-960.webp?v=ad5c38b9ce84 960w, assets/editorial/neutral-20260915/vineRobot-wide-1800.webp?v=883f0f7423bf 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Summer research assistant owning eversion hardware, reinforcement, and the 45-run experiment."
      ],
      [
        "Key revision",
        "Initial deformation and connection failures led to a reinforced vessel, revised lid, and retained viewing cutouts."
      ],
      [
        "Result",
        "Three body types tested across 45 conditions. The 5 psi value is a design target; reinforcement evidence includes FEA."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Design around the\nexperiment’s changeovers.",
        "paragraphs": [
          "The lab needed circular, three-partition, and stick-reinforced vine bodies for deformation research. The platform targeted 34 kPa (5 psi), accepted body circumferences up to 571 mm, and needed frequent swaps without hiding eversion faults.",
          "A custom metal vessel was constrained by tooling and budget. A transparent 19 L polypropylene pail gave visibility and flat mounting faces, accepting a stiffness problem that the first pressure test would expose."
        ],
        "image": 5,
        "evidence": "Outlet assembly CAD",
        "note": "A fixed outlet, swappable converters, and geometry-matched TPU seals."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Separate the seal,\nthe drive, and the changeover.",
        "paragraphs": [
          "The stock snap lid could not support the drive hardware or pressure load. A bolted mount grips behind the pail flange, carrying the calculated blow-off load in tension; printed TPU 85A gaskets conform to the FDM surfaces.",
          "A fixed, wide-flanged outlet stiffens the cut wall while interchangeable converters change the vine geometry. Spool bearings carry weight and vine tension, and a flexible coupling accommodates motor alignment. Each interface has a distinct structural or sealing job."
        ],
        "image": 4,
        "evidence": "Lid assembly CAD",
        "note": "The lid, gasket, and flange-gripping mount share the same bolt pattern."
      },
      {
        "id": "build",
        "label": "Iteration",
        "title": "Use the failure sequence\nto choose the revision.",
        "paragraphs": [
          "The first vessel held 1.2 psi with substantial deformation, compared with a 0.71 psi thin-wall hand estimate. The coupling released, the vine-to-spool connection failed, and leaks appeared: pressure retention alone did not describe the complete system.",
          "I added 6061 plates, an aluminum lid, and three C-shaped A36 brackets. Open cutouts retained debugging visibility. Reinforcement FEA then evaluated the revised load path, with the outlet still the weakest region."
        ],
        "image": 6,
        "evidence": "Reinforced assembly CAD",
        "note": "Reinforcement adds a load path around the original vessel."
      },
      {
        "id": "validation",
        "label": "Validation",
        "title": "Measure the force\nthat reaches the vine.",
        "paragraphs": [
          "I ran 36 loaded conditions plus nine unloaded baselines. A scale directly below the body measured the transmitted force because friction in the guide bearings made applied weight an unreliable proxy; the procedure set load within ±0.05 kg of target.",
          "Scans captured the deformed geometry for the prediction model. At 500 lbf per face, reinforcement FEA predicted 6.524 mm displacement and 0.2339 GPa peak stress. The 45 research runs and the containment analysis answer different verification questions."
        ],
        "image": 2,
        "evidence": "Experiment setup",
        "note": "Guide rods constrain the load shape; the scale measures the force reaching the body."
      }
    ],
    next: 'javelin'
  },
  javelin: {
    "number": "03",
    "title": "Javelin VTOL.",
    "label": "Aerospace / Airframe & integration",
    deck: "Translate a speed target into an integrated airframe.",
    description: "A built tail-sitter concept whose 26-item requirements review separates packaging progress from flight performance still to be demonstrated.",
    engineering: {
      "goal": "Combine vertical takeoff with a low-drag forward-flight airframe, targeting 300 km/h.",
      "constraints": [
        "Four-motor differential thrust must provide control without conventional control surfaces.",
        "Structure, RF transmission, heat separation, pitot exposure, and access share a compact printed airframe."
      ],
      "checks": [
        [
          "Packaging requirements",
          "April 2026 review of the 26-item matrix",
          "23 items marked met; cooling ducts, ArduPlane ecosystem control, and a stressed-skin composite wing remained unchecked.",
          "Dated design review"
        ],
        [
          "Propeller suitability",
          "MATLAB screening of 10 candidates for RPM, pitch speed, and tip Mach",
          "Three propeller types serve low-speed tests, routine operation, and top-speed attempts; screening assumes 8S and 10% slip.",
          "Calculated selection"
        ],
        [
          "Integrated hardware",
          "Completed CAD and airframe with selected electronics",
          "Parallel 4S build retains 14.8 V; this differs from the 8S propeller study.",
          "Built configuration"
        ],
        [
          "300 km/h and flight control",
          "Flight tests after control and fail-safe work",
          "Speed remains a target. The recorded project status is pre-flight.",
          "Open verification"
        ]
      ],
      "iteration": "The next design gate is controlled flight and fail-safe evidence. Propeller analysis must use the tested battery configuration before calculated pitch speeds can inform a flight-performance claim."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/javelin-wide-1800.webp?v=0a01908c1725",
      "alt": "Javelin airframe suspended above the studio floor with four propellers.",
      "caption": "The Javelin airframe, four motors, and high-speed packaging.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/javelin-wide-480.webp?v=115fac6ef051 480w, assets/editorial/neutral-20260915/javelin-wide-960.webp?v=5e4ed14637b7 960w, assets/editorial/neutral-20260915/javelin-wide-1800.webp?v=0a01908c1725 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "Scope",
        "Airframe, structure, propulsion packaging, avionics integration, and design requirements."
      ],
      [
        "Design target",
        "300 km/h forward flight and vertical takeoff using four motors without moving control surfaces."
      ],
      [
        "Result",
        "Airframe and CAD complete, electronics integrated. Flight performance remains to be demonstrated."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Make the control tradeoff\nexplicit from the start.",
        "paragraphs": [
          "Javelin is designed to take off vertically and transition into forward flight. Removing flaps, ailerons, rudders, and servos reduces mechanical complexity but makes four-motor differential-thrust mixing responsible for attitude control.",
          "The 300 km/h target and a 26-item requirements matrix guided the design. Speed is an intended operating condition, while the matrix tracks whether individual packaging and system requirements have been addressed."
        ],
        "image": 1,
        "evidence": "Airframe documentation",
        "note": "The four-motor X configuration and compact nose package."
      },
      {
        "id": "decisions",
        "label": "Decisions",
        "title": "Assign each shape\nand material a job.",
        "paragraphs": [
          "The low-drag design uses a Von Karman ogive nose, swept wing, thin NACA-0008 stabilizers, and streamlined motor fairings. The center-of-gravity / center-of-pressure relationship is part of the intended stability strategy.",
          "PPA-CF supports stiff, heat-exposed structure; ASA permits RF-transparent antenna fairings; PC-FR serves flame-retardant parts. Bonded 3 × 1.5 mm carbon-fiber tubes reinforce the wing and tail, with a dedicated jig for repeatable tube cutting."
        ],
        "image": 2,
        "evidence": "Nose and sensor detail",
        "note": "The ogive nose with a pitot tube extending into the incoming flow."
      },
      {
        "id": "integration",
        "label": "Integration",
        "title": "Keep the power study\nconnected to the build.",
        "paragraphs": [
          "Four T-Motor F90 motors use tractor propellers. Parallel 4S packs retain 14.8 V, and XT90-S connectors manage connection inrush. The Matek H743-WING, airspeed sensor, GPS/compass, radio, and FPV system share the airframe with separated high- and low-voltage routes.",
          "Three propeller types serve low-speed testing, routine operation, and top-speed attempts. MATLAB screened 10 candidates using motor RPM, pitch speed, RPM limits, and tip Mach, but its 8S / 10% slip assumptions are a separate configuration from the parallel-4S build."
        ],
        "image": 3,
        "evidence": "Propulsion hardware",
        "note": "A tractor motor and propeller mounted to the swept wing."
      },
      {
        "id": "status",
        "label": "Review",
        "title": "Close packaging tasks.\nKeep flight claims open.",
        "paragraphs": [
          "The April 2026 matrix marks 23 of 26 requirements met, including pitot extension and thermal separation. Cooling ducts, ArduPlane ecosystem control, and a stressed-skin composite wing remained unchecked in that review.",
          "The airframe and full CAD are complete and electronics are integrated. The recorded next work is fail-safe behavior, differential-thrust tuning, and flight testing following regulatory review. The animated flight pose shows the intended behavior; measured flight speed is still a separate milestone."
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
    deck: "Make sensor readings correspond to repeatable coordinates.",
    description: "A one-week scanner build revised from servo scanning to a Cartesian gantry, then checked through calibration and a 2,206-point scan.",
    engineering: {
      "goal": "Reconstruct an object’s geometry by pairing each LiDAR distance reading with a known scanner position.",
      "constraints": [
        "One-week build using TFmini-S LiDAR, available motors, and an Arduino Nano ESP32.",
        "Sensor instability below about 30 cm, motor noise, and mechanical coordinate repeatability."
      ],
      "checks": [
        [
          "Reliable distance data",
          "14 ruler-referenced distances and a MATLAB correction curve",
          "Below roughly 3% distance error in the stable range beyond about 30 cm.",
          "Measured calibration"
        ],
        [
          "Repeatable scan coordinates",
          "Homing switches and Cartesian raster motion",
          "2,206 paired readings captured over a 140 × 165 mm region.",
          "Integrated scan"
        ],
        [
          "Usable reconstruction",
          "Coordinate mapping, cubic interpolation, and Gaussian filtering",
          "The scan reconstructs the test object’s outline; the interpolated 300 × 300 grid does not increase the number of measurements.",
          "Processed measurement"
        ]
      ],
      "iteration": "The project changed both the motion architecture and the operating range in response to observed errors. Independent geometry checks would be the next step for quantifying full point-cloud accuracy."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/scanner-wide-1800.webp?v=ffd3ab3e99cd",
      "alt": "LiDAR scanner with blue printed mounts, guide rods and a plywood base.",
      "caption": "A Cartesian gantry for repeatable sensor positioning.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/scanner-wide-480.webp?v=0ac2fcfffca5 480w, assets/editorial/neutral-20260915/scanner-wide-960.webp?v=d6ba17ad1cb8 960w, assets/editorial/neutral-20260915/scanner-wide-1800.webp?v=ffd3ab3e99cd 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Gantry design and assembly, LiDAR calibration, and electrical architecture with Jacob Likins."
      ],
      [
        "Key decision",
        "Use a Cartesian gantry for repeatable coordinates after the servo pan/tilt concept proved less accurate."
      ],
      [
        "Result",
        "2,206 readings over 140 × 165 mm. Below roughly 3% calibrated distance error in the stable sensor range."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Resolve position\nbefore reconstructing shape.",
        "paragraphs": [
          "The scanner needed a known location for every distance reading. During the one-week build, we replaced a less accurate servo pan/tilt concept with a Cartesian gantry for controlled raster coordinates.",
          "The gantry added mechanical structure in exchange for repeatability. Servo pan/tilt remained available for wider-range, lower-precision scanning, making the accuracy-versus-coverage tradeoff explicit."
        ],
        "image": 1,
        "evidence": "Gantry CAD",
        "note": "Dual lead screws drive Y; a belt-driven carriage controls X."
      },
      {
        "id": "decisions",
        "label": "Calibration",
        "title": "Let measured error\nset the working range.",
        "paragraphs": [
          "I measured 14 known distances with a ruler and fitted a TFmini-S correction curve in MATLAB. Readings below about 30 cm were less stable, so sensor placement kept the intended scan within the more reliable range.",
          "Calibration reduced distance error below roughly 3% in that range. This check evaluates the sensor; gantry positioning, sampling, and surface processing also affect the final reconstruction."
        ],
        "image": 3,
        "evidence": "Measured calibration result",
        "note": "Before-and-after distance error; the claim applies beyond roughly 30 cm."
      },
      {
        "id": "build",
        "label": "Integration",
        "title": "Debug motion and\nsensing as one system.",
        "paragraphs": [
          "Dual M8 lead screws and guide rods control Y travel; a belt drives X. NEMA 17 motors, DRV8825 drivers, and physical homing switches establish the raster path and its coordinate origin.",
          "Motor-rail capacitors, copper-lined packaging, and shielded sensor wiring reduced electrical noise. The emergency stop cuts motor voltage while retaining controller logic, preserving state during testing."
        ],
        "image": 4,
        "evidence": "Electrical architecture",
        "note": "Motion, sensing, and stop behavior are explicit in the wiring architecture."
      },
      {
        "id": "validation",
        "label": "Validation",
        "title": "Trace the final image\nback to its measurements.",
        "paragraphs": [
          "The scanner captured 2,206 distance readings across a 140 × 165 mm region. Each reading was paired with carriage position, demonstrating the complete motion, acquisition, calibration, and reconstruction chain.",
          "The archived processing script interpolates onto a 300 × 300 grid and applies a Gaussian filter. Those steps improve visualization; the measured sample count remains 2,206, and sensor calibration alone does not establish full point-cloud accuracy."
        ],
        "image": 6,
        "evidence": "Scan output",
        "note": "The test object and its scan plot, preserved from the project record."
      }
    ],
    next: 'brakeSim'
  },
  brakeSim: {
    "number": "05",
    "title": "Brake thermal model.",
    "label": "Formula SAE / MATLAB & FEA",
    deck: "Evaluate the thermal cost of a lighter brake rotor.",
    description: "An endurance-cycle model connects a 25% mass-reduction target to heat input, cooling, friction hardware, and structural analysis.",
    engineering: {
      "goal": "Identify how rotor mass can be reduced without losing the thermal capacity required for repeated braking.",
      "constraints": [
        "22 endurance laps, 25 track segments, brake-bias assumptions, and speed-dependent cooling.",
        "Friction pairing, cost, manufacturability, and the distinction between historical model geometry and the final 7.4 in rotor."
      ],
      "checks": [
        [
          "Endurance temperature behavior",
          "Transient model of braking input, hub conduction, convection, and radiation",
          "Temperature histories identify repeated-load peaks under the stated model assumptions.",
          "Simulated"
        ],
        [
          "Structural margin",
          "Rotor structural FEA",
          "Design record reports a 3.0 safety factor alongside the 25% mass-reduction target.",
          "Simulated"
        ],
        [
          "Model plausibility",
          "Comparison with Mk.7 and peer-team data",
          "Supports a sizing baseline; physical endurance temperatures remain a separate validation.",
          "Engineering comparison"
        ],
        [
          "Final geometry consistency",
          "Compare final hardware with archived model inputs",
          "Final diameter is 7.4 in; the historical thermal model has not been rerun for that update.",
          "Configuration check"
        ]
      ],
      "iteration": "The analysis supports the mass-versus-heat tradeoff. Updating the thermal inputs to final geometry and comparing against instrumented endurance temperatures would close the remaining model-to-hardware loop."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/brakeSim-wide-1800.webp?v=261a7772793d",
      "alt": "Perforated cast-iron brake rotor before heating.",
      "caption": "The brake rotor represented in the thermal and structural study.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/brakeSim-wide-480.webp?v=e231b920e798 480w, assets/editorial/neutral-20260915/brakeSim-wide-960.webp?v=ea2678e77ff1 960w, assets/editorial/neutral-20260915/brakeSim-wide-1800.webp?v=261a7772793d 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "Scope",
        "MATLAB rotor/pad thermal modeling, hardware selection, and comparison with structural FEA."
      ],
      [
        "Design target",
        "Reduce rotor mass by 25% while retaining usable pad/rotor temperatures through endurance."
      ],
      [
        "Result",
        "A sizing model and 3.0 structural FEA safety factor; final hardware diameter is 7.4 in."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Reduce inertia\nwithout losing heat capacity.",
        "paragraphs": [
          "The rotor study targets a 25% mass reduction. Removing material lowers rotational and unsprung mass, but also reduces the energy the rotor can absorb before its temperature rises.",
          "I modeled 22 endurance laps using 25 track segments with varying velocity and brake demand. Cooling between braking zones matters because the design has to tolerate cumulative heating across the event."
        ],
        "image": 2,
        "evidence": "Rotor geometry CAD",
        "note": "Perforated rotor geometry considered alongside thermal mass."
      },
      {
        "id": "decisions",
        "label": "Model",
        "title": "Expose the assumptions\nbehind each temperature.",
        "paragraphs": [
          "Braking work provides the heat input. The model uses front/rear brake bias and a rotor/pad heat split, then removes energy through hub conduction, radiation, and velocity-dependent convection.",
          "The documented inputs include a 220 kg vehicle, 72% front bias, and 90% of brake heat entering the rotor. These assumptions make the plots useful for comparing design choices while defining the conditions under which the predictions apply."
        ],
        "image": 1,
        "evidence": "Thermal simulation",
        "note": "Predicted rotor and pad temperatures over the endurance cycle."
      },
      {
        "id": "hardware",
        "label": "Tradeoffs",
        "title": "Choose material and\nfriction hardware together.",
        "paragraphs": [
          "ASTM A48 Class 40 cast iron was favored over exotic materials for conductivity, friction pairing, cost, and manufacturability. Rotor mass and exposed area have to be balanced together because they influence heat storage and cooling differently.",
          "The study connects that choice to Wilwood GP200 calipers and BP-28 pads. AN3 quick-disconnects were considered for service access, extending the design review beyond the rotor alone."
        ],
        "image": 2,
        "evidence": "Hardware sizing geometry",
        "note": "The rotor pattern is one part of a coupled mass, cooling, and hardware decision."
      },
      {
        "id": "validation",
        "label": "Validation",
        "title": "Separate the sizing study\nfrom the final hardware.",
        "paragraphs": [
          "Mk.7 and peer-team data provided comparison points for the thermal assumptions. Structural FEA reported a 3.0 safety factor; the mass reduction remained a 25% design target.",
          "The final rotor diameter is 7.4 inches. The archived thermal calculations retain their original dimensions, so a rerun for final geometry and measured endurance temperatures are the remaining steps for validating that hardware against the thermal model."
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
    deck: "Carry the payload and preserve steering authority.",
    description: "Front-wheel swerve modules developed through chain, clearance, and steering revisions; the robot carried 300 lb against a 200 lb target.",
    engineering: {
      "goal": "Drive and steer a luggage robot under a 200 lb payload using two compact front modules.",
      "constraints": [
        "Drive and steering chains, shafts, bearings, and mounts must clear one another throughout wheel motion.",
        "Loaded steering torque, chain engagement, fabrication access, and controller feedback."
      ],
      "checks": [
        [
          "Payload capacity",
          "Loaded robot test",
          "300 lb carried, exceeding the initial 200 lb target.",
          "Tested"
        ],
        [
          "Steering engagement",
          "Motor placement and step-setting revisions",
          "Moving motors inward improved spacing; changing 200 to 1600 steps reduced skipping but slowed steering.",
          "Observed tradeoff"
        ],
        [
          "Mechanical clearance",
          "Assembly checks with spacers and shortened fasteners",
          "Revisions resolved interference within the wheel package.",
          "Build iteration"
        ],
        [
          "Drive response",
          "MY1016Z motors, 9:16 reduction, and shaft encoders",
          "Roughly 1 m/s² remains the drivetrain design target; encoders supply speed/displacement feedback.",
          "Intended performance"
        ]
      ],
      "iteration": "Payload testing met the original carrying objective. Steering speed and chain engagement remained coupled, leading the team to identify DC steering motors with absolute encoders as the next architecture to evaluate."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/aura-wide-1800.webp?v=6033855dcc5f",
      "alt": "Assembled AURA swerve module with its wheel, motors and metal structure.",
      "caption": "The AURA front-wheel swerve assembly and its drive and steering hardware.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/aura-wide-480.webp?v=e0be22136f68 480w, assets/editorial/neutral-20260915/aura-wide-960.webp?v=18b57246c239 960w, assets/editorial/neutral-20260915/aura-wide-1800.webp?v=6033855dcc5f 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Front-wheel swerve mechanics: steering, drive reduction, shafts, bearings, and fabricated mounts."
      ],
      [
        "Target → test",
        "200 lb initial payload target → 300 lb carried in testing."
      ],
      [
        "Key tradeoff",
        "Chain-skipping improvements reduced steering speed; DC steering with absolute feedback was identified for a future redesign."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Fit two motions\naround a loaded wheel.",
        "paragraphs": [
          "Project AURA began with a 200 lb payload target. My scope was the front-wheel swerve mechanics: combining traction and steering while accommodating motors, sprockets, chains, shafts, bearings, and mounts.",
          "Independent front-wheel angles approach Ackermann behavior to reduce scrub under load. That makes clearance and steering torque system requirements, alongside the ability to carry weight."
        ],
        "image": 0,
        "evidence": "Built swerve hardware",
        "note": "The two front modules combine traction and steering."
      },
      {
        "id": "decisions",
        "label": "Tradeoffs",
        "title": "Use reduction\nwhere torque is needed.",
        "paragraphs": [
          "Each NEMA 23 steering stepper uses an 18:80 sprocket reduction, exchanging steering speed for torque. MY1016Z 24 V drive motors use a separate 9:16 ratio, keeping the traction and steering choices distinct.",
          "Moving steering motors toward the center increased sprocket spacing and helped reduce chain skipping. Increasing the step setting from 200 to 1600 reduced skipping further, but slowed steering: the revised setting improved one behavior at the expense of another."
        ],
        "image": 1,
        "evidence": "Steering-chain hardware",
        "note": "Chain and sprocket spacing was a mechanical packaging decision."
      },
      {
        "id": "build",
        "label": "Iteration",
        "title": "Solve clearance\nin the assembled module.",
        "paragraphs": [
          "Quarter-inch A36 steel provided strong, weldable wheel housings and motor mounts that could be OMAX-waterjetted, TIG-welded, and painted using available shop processes.",
          "Assembly exposed interference in the tightly packed wheel hardware. Testing spacers and shortening fasteners resolved the contact, turning the CAD package into an operable mechanism."
        ],
        "image": 2,
        "evidence": "Fabrication evidence",
        "note": "The waterjet-cut and welded steel mount."
      },
      {
        "id": "integration",
        "label": "Validation",
        "title": "Compare the load test\nwith the original target.",
        "paragraphs": [
          "The robot carried 300 lb in testing, exceeding the initial 200 lb target. LPD3806 encoders on the 3/8-inch front shafts provide speed and displacement feedback; the roughly 1 m/s² acceleration figure remains a design target.",
          "The carrying result did not remove the steering-speed tradeoff. The team identified DC steering motors with absolute encoders as a future redesign, using the chain-skipping and response behavior to define the next decision."
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
    deck: "Turn cockpit support needs into a manufacturable composite shell.",
    description: "Mk.7 build lessons informed a Mk.8 shell with local reinforcement, practical layup geometry, and planned access for repairs.",
    engineering: {
      "goal": "Add shoulder and hip support above the seat pan while preserving cockpit access and practical composite fabrication.",
      "constraints": [
        "Harness routing, chassis tubes, surrounding bodywork, and access for removal and repair.",
        "Cloth placement, mold access, trimming, and the labor and mass of the layup."
      ],
      "checks": [
        [
          "Manufacturable shell geometry",
          "Male mold, cloth placement, cure, demolding, and trimming",
          "A physical trimmed shell was produced for the Mk.8 cockpit.",
          "Fabricated"
        ],
        [
          "Specified reinforcement",
          "Confirmed material and layup record",
          "EL2 resin; 20 main plies of 3K 200 g/m² twill; 5–10 local patch plies.",
          "Build record"
        ],
        [
          "Support and service access",
          "Geometry developed around Mk.7 support and access lessons",
          "Shoulder/hip support and race-weekend removal are design objectives.",
          "Design intent"
        ]
      ],
      "iteration": "Mk.7 fabrication experience drove the Mk.8 support and service requirements. The completed shell establishes manufacturability; driver-fit, load-response, and removal checks are the next evidence needed to evaluate those functional objectives."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/carbonSeat-wide-1800.webp?v=9947d45e1ef7",
      "alt": "Carbon-fiber seat layup at the beginning of the fabrication sequence.",
      "caption": "The carbon-fiber shoulder and hip-support shell.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/carbonSeat-wide-480.webp?v=79b769fb52aa 480w, assets/editorial/neutral-20260915/carbonSeat-wide-960.webp?v=0326964b222e 960w, assets/editorial/neutral-20260915/carbonSeat-wide-1800.webp?v=9947d45e1ef7 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "Scope",
        "Composite support geometry, layup planning, fabrication, trimming, and service access."
      ],
      [
        "Design decision",
        "20 main carbon-cloth plies with 5–10 additional local patch plies where reinforcement was needed."
      ],
      [
        "Result",
        "Cured, demolded, and trimmed Mk.8 shell, documented through tooling and fabrication photographs."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Support the torso\nwithin the cockpit package.",
        "paragraphs": [
          "The shell adds shoulder and hip support above the seat pan, where lateral loads act on the driver. It also has to coexist with harness routing, frame tubes, and bodywork.",
          "Mk.7 build experience supplied the starting problems: support, cockpit access, and serviceability. The Mk.8 geometry therefore had to work both around the driver and for the person installing or repairing it."
        ],
        "image": 0,
        "evidence": "Fabricated shell",
        "note": "The demolded carbon support shell."
      },
      {
        "id": "decisions",
        "label": "Tradeoffs",
        "title": "Balance local stiffness\nwith fabrication effort.",
        "paragraphs": [
          "Carbon fiber offered stiffness-to-weight benefits for the upper support shell, at the cost of mold preparation, layup labor, and trimming. Practical cloth access constrained the surfaces and edges that could be manufactured.",
          "The layup combines full-shell plies with small local patches. Those patches concentrate additional material in selected regions instead of increasing thickness across the entire shell."
        ],
        "image": 1,
        "evidence": "Layup tooling",
        "note": "The male mold used to form the seat support."
      },
      {
        "id": "build",
        "label": "Build",
        "title": "Carry the layup plan\nthrough cure and trimming.",
        "paragraphs": [
          "I used Easy Composites EL2 resin and 3K, 200 g/m² twill cloth. The main layup has 20 plies, plus another 5–10 plies of small patches for local reinforcement.",
          "The shell was laid over the mold, cured, demolded, and trimmed for the cockpit package. The photographs trace that manufacturing sequence; the interactive layup animation illustrates the process rather than counting the physical plies."
        ],
        "image": 2,
        "evidence": "Composite fabrication",
        "note": "Original cloth-layup detail, preserved from the build record."
      },
      {
        "id": "service",
        "label": "Review",
        "title": "Evaluate the shell\nagainst its intended use.",
        "paragraphs": [
          "The completed, trimmed shell establishes that the geometry and layup could be manufactured. Removal, repair, and reassembly within a race weekend informed the surrounding interfaces.",
          "The next functional questions concern driver fit, support under load, and access during removal. Keeping those checks distinct from successful fabrication preserves the connection between the original cockpit needs and the evidence required to close them."
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
    deck: "Translate the Mk.7 seat geometry into a cockpit component.",
    description: "A fabrication-focused project connecting the supplied aluminum seat design, folded-panel geometry, and the surrounding vehicle package.",
    engineering: {
      "goal": "Produce the Mk.7 aluminum driver seat from the supplied geometry for the vehicle build.",
      "constraints": [
        "Perforated pan and back with folded side panels.",
        "The surrounding chassis and cockpit hardware define the installation space."
      ],
      "checks": [
        [
          "Seat fabrication",
          "Confirmed personal responsibility for the Mk.7 build",
          "The seat was fabricated for Mk.7.",
          "Fabrication scope"
        ],
        [
          "Geometry and interfaces",
          "Seat CAD viewed with cockpit and vehicle photographs",
          "Pan, back, folded sides, and surrounding chassis are available for inspection.",
          "Project evidence"
        ],
        [
          "Structural context",
          "Retained seat-support analysis image",
          "Supports discussion of the seat structure without attributing an unconfirmed numerical result.",
          "Supporting analysis"
        ]
      ],
      "iteration": "This case centers on making an existing seat design. The useful fabrication review compares the finished geometry and cockpit interfaces with that input, with process choices and any rework attributed only when confirmed."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/seat-wide-1800.webp?v=ad9330bcc20e",
      "alt": "Folded and perforated aluminum driver seat.",
      "caption": "The Mk.7 driver-seat geometry.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/seat-wide-480.webp?v=d59c63530faf 480w, assets/editorial/neutral-20260915/seat-wide-960.webp?v=808ba2b7e914 960w, assets/editorial/neutral-20260915/seat-wide-1800.webp?v=ad9330bcc20e 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Fabrication of the Mk.7 aluminum driver seat."
      ],
      [
        "Task",
        "Make the perforated pan, back, and folded-side geometry into the car’s seat component."
      ],
      [
        "Evidence",
        "Seat CAD, supporting analysis, and Mk.7 cockpit and vehicle photographs."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Start from the geometry\nthe build needs.",
        "paragraphs": [
          "My responsibility was making the aluminum driver seat for the Mk.7 Formula SAE car. The input geometry includes a perforated pan and back with folded side panels.",
          "That defines a fabrication task: carry the seat form into a physical component for the cockpit. Design authorship and numerical validation of the seat are separate from the fabrication scope presented here."
        ],
        "image": 0,
        "evidence": "Seat CAD",
        "note": "The complete seat geometry, shown without cropping its edges."
      },
      {
        "id": "fit",
        "label": "Fabrication",
        "title": "Connect the formed part\nto its installation space.",
        "paragraphs": [
          "The work translated the Mk.7 seat geometry into the physical cockpit component. The folded sides and perforated surfaces are the principal features visible in the design record.",
          "The cockpit photograph shows the surrounding frame and controls, giving the fabrication a vehicle context rather than presenting it as an isolated sheet-metal part."
        ],
        "image": 2,
        "evidence": "Mk.7 cockpit",
        "note": "The Mk.7 cockpit surrounding the seat."
      },
      {
        "id": "interfaces",
        "label": "Interfaces",
        "title": "Review the seat\nas part of the cockpit.",
        "paragraphs": [
          "The seat occupies space shared with chassis tubes, steering hardware, and other cockpit components. Those neighboring parts explain why the supplied seat shape and its installation context belong in the same review.",
          "The vehicle photographs retain that relationship for inspection. They support discussion of geometry and access without assigning driver-fit trials or dimensions from a different car."
        ],
        "image": 3,
        "evidence": "Mk.7 vehicle",
        "note": "The car in its broader build context."
      },
      {
        "id": "validation",
        "label": "Review",
        "title": "Keep contribution\nand supporting analysis clear.",
        "paragraphs": [
          "The delivered contribution is Mk.7 seat fabrication. The gallery combines the CAD, cockpit context, vehicle photographs, and the original seat-support analysis image.",
          "The analysis image helps explain the surrounding engineering work, while the build record establishes my manufacturing responsibility. Numerical structural results and a detailed rework history require their own confirmed evidence."
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
    deck: "Replace assumed stiffness with measured model inputs.",
    description: "Membrane tension and rod bending tests connect specimen preparation, fixture limits, data fitting, and uncertainty to the vine model.",
    engineering: {
      "goal": "Measure the membrane and rod stiffness used by the cross-section model instead of assuming literature values.",
      "constraints": [
        "Available grips require an adapted 100 mm gauge length for membrane tests.",
        "Fabric directionality, sample scatter, fitting-window curvature, and irregular bamboo geometry."
      ],
      "checks": [
        [
          "Membrane directional response",
          "30 tensile specimens: MD, TD, 45° fabric, and LDPE",
          "Fabric moduli: 76.30, 69.89, and 41.78 MPa; LDPE: 100.96 MPa.",
          "Measured + fitted"
        ],
        [
          "Repeatability and fit quality",
          "Group scatter and least-squares fit review",
          "Group scatter about 5% of the mean or less; on-axis fabric R² ≈ 0.99, with lower 45° and LDPE fits.",
          "Statistical check"
        ],
        [
          "Rod bending input",
          "11 rods in three-point bending over a 73.37 mm span",
          "81.7 ± 7.7 N/mm stiffness; EI = 0.672 ± 0.063 N·m²; all rod fits R² > 0.999.",
          "Measured + derived"
        ],
        [
          "Rod geometry interpretation",
          "Confirmed 5.79–6.33 mm diameter range",
          "Historical E conversion requires rechecking; measured stiffness and EI remain usable independently of that convention.",
          "Review finding"
        ]
      ],
      "iteration": "Pilot tests supported treating LDPE as direction-independent, while fabric required three directions. The diameter review keeps the rod result at the measured stiffness / derived EI level until the historical E conversion is corrected."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/materialTest-wide-1800.webp?v=068925b08a8d",
      "alt": "Orange tensile specimen held between silver grips before stretching.",
      "caption": "The tensile-testing apparatus used to illustrate specimen loading.",
      "kind": "Display reconstruction",
      "srcset": "assets/editorial/neutral-20260915/materialTest-wide-480.webp?v=4f1b6bd5723c 480w, assets/editorial/neutral-20260915/materialTest-wide-960.webp?v=19302d4e4b56 960w, assets/editorial/neutral-20260915/materialTest-wide-1800.webp?v=068925b08a8d 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Specimen preparation, Instron testing, stiffness fitting, and material inputs for the cross-section model."
      ],
      [
        "Test coverage",
        "30 membrane tensile specimens across four groups; three-point bending on 11 bamboo rods."
      ],
      [
        "Result",
        "Directional fabric stiffness and rod EI = 0.672 ± 0.063 N·m², with fit quality and geometry limits retained."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Measure what the\nprediction model actually uses.",
        "paragraphs": [
          "The vine cross-section model takes membrane stiffness and bamboo bending stiffness directly. Using generic material values would carry those assumptions into every predicted deformation.",
          "The test plan therefore separated TPU-coated fabric by direction, LDPE film, and bamboo reinforcement. Pilot tests supported treating LDPE as direction-independent; the woven fabric required MD, TD, and 45° specimens."
        ],
        "image": 0,
        "evidence": "Measured tensile curves",
        "note": "Individual specimens and group means over the first 25 mm of extension."
      },
      {
        "id": "method",
        "label": "Method",
        "title": "Adapt the setup\nand retain the limits.",
        "paragraphs": [
          "The 30 tensile specimens included seven MD, seven TD, eight 45° fabric, and eight LDPE samples. The ASTM D882-based procedure used a 100 mm gauge length adapted from the nominal 250 mm to fit the available grips, with speeds following the strain-rate rule.",
          "Measured dimensions and controlled conditions supported comparison between groups. Least-squares fits used the documented strain windows; this made the fitting choice explicit rather than treating modulus as a direct machine readout."
        ],
        "image": 1,
        "evidence": "Test apparatus",
        "note": "The Instron 3345 frame and tensile grips."
      },
      {
        "id": "direction",
        "label": "Validation",
        "title": "Use the directional data\nto assess the model.",
        "paragraphs": [
          "The fabric measured 76.30 MPa in MD, 69.89 MPa in TD, and 41.78 MPa at 45°. The much softer off-axis response supports an orthotropic description; the fitted directional curve has a minimum near 46°.",
          "Group scatter was about 5% of the mean or less. The 45° and LDPE fits had lower R² values, 0.967 and 0.950, due to curvature in the fit windows. Those differences limit the confidence appropriate for a single fitted modulus."
        ],
        "image": 11,
        "evidence": "Measured inputs and fitted model",
        "note": "Directional modulus inferred from the three measured fabric directions."
      },
      {
        "id": "bending",
        "label": "Result & review",
        "title": "Keep the rod result\nat the defensible level.",
        "paragraphs": [
          "Eleven rods selected for straightness were tested over a 73.37 mm span. Linear force–deflection fits gave 81.7 ± 7.7 N/mm stiffness, with R² above 0.999 for every rod; the central-load beam relation gives EI = 0.672 ± 0.063 N·m².",
          "The measured 5.79–6.33 mm dimensions are diameters. The historical material-modulus conversion needs that convention rechecked, so EI remains the primary model input. This preserves the useful bending result while keeping the geometry-dependent calculation open."
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
    deck: "Make an automated CFD run inspectable and repeatable.",
    description: "An agent workflow built around solver readback, mesh recovery, and explicit limits on what the aerodynamic results can support.",
    engineering: {
      "goal": "Enable an AI coding agent to run a headless CFD process whose settings, artifacts, and limitations can be independently inspected.",
      "constraints": [
        "Fluent 2024 R1 API behavior, geometry fidelity, unattended execution, and license/process cleanup.",
        "Mesh quality, boundary-layer resolution, reference dimensions, and convergence limit the strength of aerodynamic conclusions."
      ],
      "checks": [
        [
          "Correct solver setup",
          "Read back Mach number and flow direction; stop on mismatch",
          "Silent setting failures become detectable failures rather than plausible-looking outputs.",
          "Workflow verification"
        ],
        [
          "Recoverable automation",
          "Record observed faults and verified recovery procedures",
          "11 failures documented, including import crashes, report loops, and orphaned MPI processes.",
          "Observed failures"
        ],
        [
          "Traceable visual output",
          "Separate 400-iteration reconstruction linked to saved solution data",
          "Surface pressure and streamlines come from the reconstructed solver output.",
          "Solver-derived"
        ],
        [
          "Aerodynamic credibility",
          "Review mesh, numerics, and reference assumptions",
          "Display reconstruction is qualitative: no prism layers or mesh-independence study, and very poor minimum cell quality.",
          "Limited validation"
        ]
      ],
      "iteration": "The mesh failure changed the automation path; silent setting failures changed the verification gates. Aerodynamic design use would require improved mesh quality, boundary-layer resolution, and a convergence / validation study beyond the completed process demonstration."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/ansysCfd-wide-1800.webp?v=4939c9fb3c04",
      "alt": "Javelin pressure field and numerical flow paths at the beginning of the flow sequence.",
      "caption": "Qualitative pressure and flow visualization around the Javelin airframe.",
      "kind": "Numerical field visualization",
      "srcset": "assets/editorial/neutral-20260915/ansysCfd-wide-480.webp?v=f4355c0a3fd6 480w, assets/editorial/neutral-20260915/ansysCfd-wide-960.webp?v=d8e7f9aab982 960w, assets/editorial/neutral-20260915/ansysCfd-wide-1800.webp?v=4939c9fb3c04 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "Scope",
        "PyFluent workflow, reference scripts, solver checks, failure recovery, and credibility reporting."
      ],
      [
        "Key revision",
        "Replace a wrap-mesh approach that lost surface fidelity with a conforming multi-region workflow."
      ],
      [
        "Result",
        "Reusable teaching package covering 11 observed failures. CFD evidence is labeled by its actual verification level."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Make each automated\nstep reviewable.",
        "paragraphs": [
          "The question was whether an AI coding agent could operate Fluent through PyFluent without the desktop GUI and still produce an inspectable engineering record. Successful execution alone was insufficient: the workflow had to preserve geometry, settings, outputs, and failure context.",
          "The original teaching case prescribes Javelin at 300 km/h, Mach 0.245. That is a simulation condition, not a flight result. The package covers launching the solver, file handling, monitoring, post-processing, and reporting."
        ],
        "image": 4,
        "evidence": "Workflow execution record",
        "note": "Background tasks coordinating a headless Fluent solve."
      },
      {
        "id": "mesh",
        "label": "Iteration",
        "title": "Change the mesh path\nwhen fidelity fails.",
        "paragraphs": [
          "The first wrap mesh ran, but lost CAD surface fidelity and resisted reliable headless refinement. That failure made a superficially successful solve an unsuitable basis for continuing the workflow.",
          "A conforming multi-region mesh with one pressure-far-field boundary preserved a smoother surface representation and avoided brittle region extraction. The change addressed the automation and geometry problem; mesh accuracy still requires its own checks."
        ],
        "image": 5,
        "evidence": "Meshing comparison record",
        "note": "The documented conforming-pressure comparison against the earlier wrap approach."
      },
      {
        "id": "setup",
        "label": "Verification",
        "title": "Read back the physics\nbefore trusting the solve.",
        "paragraphs": [
          "The recorded setup uses compressible ideal-gas physics, k–ω SST, Mach 0.245, and a defined angle-of-attack flow vector. Critical Mach and direction settings are read back from Fluent, with mismatches stopping the run.",
          "The recovery catalog covers 11 real failures, including import crashes, interactive report loops, premature convergence, and orphaned MPI processes. Turning those failures into checks made the instructions reusable beyond one successful session."
        ],
        "image": 2,
        "evidence": "Simulation output",
        "note": "The original Mach-plane plot; it accompanies the solver-setting audit."
      },
      {
        "id": "credibility",
        "label": "Results & limits",
        "title": "Match the claim\nto the evidence.",
        "paragraphs": [
          "The deliverable combines a system prompt, SOP, PyFluent playbook, recovery catalog, quality gates, templates, and reference scripts. Estimated reference dimensions keep derived coefficients at process-validation level.",
          "The interactive pressure and streamline display uses a separate 400-iteration reconstruction. Its minimum cell quality, missing prism layers, first-order numerics, and lack of mesh-independence testing limit it to qualitative interpretation; it is not a recovered copy of the missing original solution or evidence of validated aircraft performance."
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
    deck: "Let the user choose the aim and the shot strength.",
    description: "A compact cue launcher whose working mechanism required changes to plate fabrication, cue machining, and crowded interfaces.",
    engineering: {
      "goal": "Reduce the need for a traditional pool stance and striking motion while keeping aim and shot strength under user control.",
      "constraints": [
        "Compact packaging, adequate pullback force, cue alignment, and accessible physical controls.",
        "Plate tolerances, long-part machining, wire routing, and component access."
      ],
      "checks": [
        [
          "Adjustable cue launch",
          "Surgical tubing, rack pullback, and sliding release",
          "Mechanism brought to working condition through shop iteration.",
          "Working build"
        ],
        [
          "Mechanical fit",
          "Review early plasma-cut plates during assembly",
          "Final plates changed to waterjet parts after tolerance problems.",
          "Process revision"
        ],
        [
          "Cue and base geometry",
          "Long cue machining, manual finishing, and conversational milling",
          "Fabricated cue/base integrated with the loading mechanism.",
          "Fabricated"
        ],
        [
          "Accessible, repeatable shots",
          "Laser aim and physical power adjustment in the prototype",
          "These features implement the intended interaction; quantified shot and user outcomes remain open.",
          "Intended use"
        ]
      ],
      "iteration": "Poor plate fit led to a manufacturing-process change. Once the launcher worked, the next evaluation would compare shot repeatability and user operation with the original aiming and accessibility goals."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/pool-wide-1800.webp?v=0e639426ec12",
      "alt": "Pool Sniper launcher with its cue extended before retraction.",
      "caption": "The Pool Sniper cue launcher and pullback mechanism.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/pool-wide-480.webp?v=600b76931736 480w, assets/editorial/neutral-20260915/pool-wide-960.webp?v=59971dff9b28 960w, assets/editorial/neutral-20260915/pool-wide-1800.webp?v=0e639426ec12 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My contribution",
        "Pool cue and cue-base fabrication within the team launcher project."
      ],
      [
        "Design objective",
        "Adjustable shot strength, break-shot capability, and accessible aiming in a compact package."
      ],
      [
        "Result",
        "Working mechanism after machining and fit revisions. Accessibility and shot repeatability remain separate user/performance checks."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Preserve the decisions\nthe player wants to make.",
        "paragraphs": [
          "The launcher is intended for beginners and users who find traditional cue stance, sighting, or striking difficult. It aims to provide break-shot power and adjustable strength within a compact package.",
          "Laser alignment and a physical release setting let the user choose where and how hard to shoot. My documented contribution was the cue and cue base within the team’s complete mechanism."
        ],
        "image": 0,
        "evidence": "Mechanism CAD",
        "note": "The complete launcher and its aiming and pullback layout."
      },
      {
        "id": "mechanism",
        "label": "Decisions",
        "title": "Separate energy storage\nfrom shot selection.",
        "paragraphs": [
          "Surgical tubing stores energy during cue pullback. A rack and pinion load the cue through a chain-and-sprocket drive, while a sliding trigger selects the release position.",
          "The bottom slider supports the rack against tubing tension. This arrangement puts power adjustment at the mechanism, while the laser and switch provide an aiming and actuation interface."
        ],
        "image": 1,
        "evidence": "Assembly CAD",
        "note": "The exploded layout separates drive, cue, and release components."
      },
      {
        "id": "build",
        "label": "Iteration",
        "title": "Change the process\nwhen the fit is wrong.",
        "paragraphs": [
          "Early plasma-cut plates had poorly controlled tolerances. The final build used waterjet parts to improve fit, changing the manufacturing route in response to assembly problems.",
          "Long cue machining required manual finishing to maintain diameter, and the cue base used a conversational mill for its intricate geometry. Wire lengths and routing also had to fit around the compact moving assembly."
        ],
        "image": 2,
        "evidence": "Fabrication evidence",
        "note": "An early plasma-cut plate; the source notes describe the later process change."
      },
      {
        "id": "iteration",
        "label": "Review",
        "title": "Use the working build\nto define the next tests.",
        "paragraphs": [
          "Shop iteration brought the launcher to working condition. That result establishes the cue-loading and release mechanism as a physical prototype, with laser aiming and adjustable shot strength built into the interaction.",
          "The next checks are repeatable shot behavior and operation by the intended users. Those would evaluate the original accessibility and aiming objectives beyond the fabrication and integration evidence shown here."
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
    deck: "Use track behavior to revise sensing, mass, and control.",
    description: "A two-week robot build that widened its sensor spacing, reduced mass by 33.6%, and recorded an 18-second lap against an under-15-second target.",
    engineering: {
      "goal": "Complete the team’s Spa-Francorchamps-inspired line course in under 15 seconds.",
      "constraints": [
        "Two-week build, palm-size packaging, sharp turns, and accessible wiring for repeated tuning.",
        "Sensor coverage, mass, available battery power, and the balance between forward speed and steering correction."
      ],
      "checks": [
        [
          "Lap-time target",
          "Recorded run on the team’s course",
          "18 s best recorded lap; under-15-second target not reached.",
          "Measured"
        ],
        [
          "Sharp-turn detection",
          "Compare 4 mm and 8 mm sensor pitch at 6 mm mounting height",
          "Selected 8 mm spacing for wider line-detection coverage.",
          "Test-driven revision"
        ],
        [
          "Lower moving mass",
          "Battery and chassis redesign",
          "428 g → 284 g whole-robot mass, a 33.6% reduction.",
          "Measured comparison"
        ],
        [
          "Usable feedback control",
          "Separate base/steering speeds with serial Kp adjustment",
          "Successful run used off-center feedback and dedicated outer-sensor turn detection.",
          "Tested configuration"
        ]
      ],
      "iteration": "Track problems drove wider sensing, lighter hardware, and a tunable controller. The 18 s result gives a clear remaining gap: improve speed through the course while retaining reliable sharp-turn detection."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/lineFollower-wide-1800.webp?v=245156d8b639",
      "alt": "Line-following robot with orange wheels and a teal circuit board.",
      "caption": "The compact two-wheel LineFollower with its controller and front sensing.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/lineFollower-wide-480.webp?v=e22c538f6809 480w, assets/editorial/neutral-20260915/lineFollower-wide-960.webp?v=ca5b7d605a88 960w, assets/editorial/neutral-20260915/lineFollower-wide-1800.webp?v=245156d8b639 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "Scope",
        "Compact mechanical packaging, power, reflectance sensing, motor integration, and controller tuning."
      ],
      [
        "Key revisions",
        "4 → 8 mm sensor pitch; battery/chassis changes reduced mass from 428 g to 284 g."
      ],
      [
        "Result",
        "Best recorded lap: 18 s. The original under-15-second target was not reached."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Set a track target\nfor the complete system.",
        "paragraphs": [
          "The two-week build targeted a lap below 15 seconds on the team’s Spa-Francorchamps-inspired course. An Arduino Mega, motor drivers, battery, and two-wheel drive had to fit within a small chassis and remain accessible for tuning.",
          "Straight-line speed alone could not satisfy the goal. The sensor layout and controller had to detect sharp turns soon enough for the drivetrain to follow them."
        ],
        "image": 2,
        "evidence": "Prototype hardware",
        "note": "The source gallery identifies this prototype as 428 g."
      },
      {
        "id": "packaging",
        "label": "Iteration",
        "title": "Remove mass\nwithout losing service access.",
        "paragraphs": [
          "The battery changed from a 157 g, 12 V / 3000 mAh Li-ion unit to a 37.85 g, 11.4 V / 450 mAh LiHV unit. With the chassis redesign, total mass fell from 428 g to 284 g, a documented 33.6% reduction.",
          "That choice traded battery capacity for lower mass in a short-course task. Short wires and accessible connectors preserved the ability to swap sensors and drive hardware after assembly."
        ],
        "image": 1,
        "evidence": "Wiring and packaging",
        "note": "Arduino Mega and wiring in the build captioned 284 g."
      },
      {
        "id": "tuning",
        "label": "Sensing & control",
        "title": "Widen the sensing range\nfor the turns that matter.",
        "paragraphs": [
          "The team compared 4 mm and 8 mm sensor spacing, choosing 8 mm to expand line-detection coverage in sharp turns. Fourteen channels form two seven-sensor arrays, mounted 6 mm above the floor.",
          "The successful controller used off-center feedback with separate base and steering speeds. The two outermost sensors identify sharp turns, while the inner 12 handle ordinary line following; serial Kp adjustment shortened the tuning loop."
        ],
        "image": 1,
        "evidence": "Integrated electronics",
        "note": "The wiring photograph documents the interfaces used during tuning."
      },
      {
        "id": "result",
        "label": "Validation",
        "title": "Report the lap\nagainst the original requirement.",
        "paragraphs": [
          "The best recorded lap was 18 seconds. This demonstrated a working integrated robot and a successful controller configuration, but it did not meet the original under-15-second goal.",
          "The result connects the next iteration to an observable gap: retain reliable corner detection while increasing course speed. The separate 100 N chassis FEA, predicting 1.29 mm deformation, evaluates a structural case rather than proving track performance."
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
    deck: "Build the dispensing motion, then test its duty cycle.",
    description: "Gantry and actuator development for a 2.5-day perfume-machine sprint, where sustained operation exposed a thermal constraint.",
    engineering: {
      "goal": "Move a pipette between six fragrance bases and actuate dispensing from a digital scent profile.",
      "constraints": [
        "2.5-day hackathon, available printers/components, motion-critical fits, and integration time.",
        "Actuator force, stroke, packaging, driver current, and sustained runtime."
      ],
      "checks": [
        [
          "Mechanical integration",
          "Printed gantry and actuator assembly",
          "Custom mechanisms built for the six-fragrance prototype.",
          "Fabricated prototype"
        ],
        [
          "Actuation architecture",
          "Lead-screw and rack-and-pinion concepts",
          "Compared under the sprint’s fabrication and packaging constraints.",
          "Design comparison"
        ],
        [
          "Continuous-duty behavior",
          "Sustained operation of the stepper lead-screw actuator",
          "Overheating exposed a thermal limit; the team also debugged DRV8824 current control.",
          "Observed failure"
        ]
      ],
      "iteration": "The prototype shifted actuator selection from force/stroke/fit to include duty cycle and driver current. A revised actuator or current/cooling strategy needs a repeat run before continuous dispensing can be claimed."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/formlabs-wide-1800.webp?v=8ee38bc86fde",
      "alt": "Smelly perfume mixer with its white structure and steel guide rods.",
      "caption": "The Smelly gantry and dispensing hardware.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/formlabs-wide-480.webp?v=1e2e276204d5 480w, assets/editorial/neutral-20260915/formlabs-wide-960.webp?v=e0b45afb0739 960w, assets/editorial/neutral-20260915/formlabs-wide-1800.webp?v=8ee38bc86fde 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Mechanical gantry and linear-actuator design/fabrication for Team Scent-A-Tubbies."
      ],
      [
        "Constraints",
        "Six fragrance bases, dispensing actuation, and full-machine integration within 2.5 days."
      ],
      [
        "Test finding",
        "Continuous operation overheated the stepper lead-screw actuator, exposing a duty-cycle limitation."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Translate the recipe\ninto mechanical operations.",
        "paragraphs": [
          "Smelly accepts intensity settings for six fragrance bases, then uses a gantry and pipette to carry out the requested mixture. The mechanical task was to position the dispensing hardware and actuate it within a 2.5-day hackathon.",
          "I owned the gantry and linear actuators; teammates integrated software and dispensing. Printing and assembly had to leave enough time to test the complete machine."
        ],
        "image": 0,
        "evidence": "Integrated prototype",
        "note": "The gantry and fragrance bottles in the built machine."
      },
      {
        "id": "decisions",
        "label": "Tradeoffs",
        "title": "Compare actuators\nagainst the available time.",
        "paragraphs": [
          "The mechanical concepts included a stepper lead screw and a rack-and-pinion actuator. Selection had to consider required motion and packaging alongside what could be printed, assembled, and debugged during the sprint.",
          "Formlabs Form 4 resin printing supported detailed parts, while Bambu Lab P1S FDM printing enabled quick iteration. Motion-critical fits received priority because they determined whether integration could proceed."
        ],
        "image": 1,
        "evidence": "Actuator integration",
        "note": "Original actuator wiring and hardware documentation."
      },
      {
        "id": "build",
        "label": "Integration",
        "title": "Connect the mechanism\nto its controller and load.",
        "paragraphs": [
          "The printed gantry indexed the pipette between fragrance bases. A Raspberry Pi and touch screen formed the interface, with USB serial connecting the Pi and Arduino.",
          "The team debugged the DRV8824 current control and tuned its current limit. This linked the electrical drive setting to the real actuator, where force and heat could be observed together."
        ],
        "image": 2,
        "evidence": "Dispensing test setup",
        "note": "The gantry and bottles arranged for testing."
      },
      {
        "id": "learning",
        "label": "Test & revision",
        "title": "Treat overheating\nas a design requirement.",
        "paragraphs": [
          "Sustained operation overheated the stepper lead-screw actuator. A mechanism that met the immediate motion and packaging needs therefore still had a duty-cycle limitation.",
          "The result changes the next selection criteria: runtime, current setting, and heat removal belong alongside force and stroke. Continuous dispensing needs a repeat test of the revised configuration before that issue can be considered closed."
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
    deck: "Carry a raw walnut blank through a playable instrument.",
    description: "Material cost, CNC setup, drilling templates, and finish sequencing connected the body geometry to working guitar hardware.",
    engineering: {
      "goal": "Make a playable electric guitar by fabricating the body and integrating the purchased hardware and electronics.",
      "constraints": [
        "Material cost, glued-blank preparation, CNC hold-downs, and alignment of pockets and drilled holes.",
        "Wiring access before finishing and drying time between successive finish coats."
      ],
      "checks": [
        [
          "Usable raw body stock",
          "Walnut glue-up with Titebond III and overnight clamping",
          "Smaller pieces formed the blank used for machining.",
          "Fabricated"
        ],
        [
          "Hardware and wiring fit",
          "Pocket checks and laser-cut drilling templates",
          "Routing and drilling completed before sanding and finishing.",
          "In-process checks"
        ],
        [
          "Playable assembly",
          "Stringing and operation of pickups, controls, and output",
          "Completed guitar is playable with Fender Deluxe Drive pickups.",
          "Functional result"
        ]
      ],
      "iteration": "Pocket and drilling checks occurred before the finish made rework more costly. Repeated preparation, drying, and coats extended finishing beyond a week, showing how process sequence shaped the final build."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/telecaster-wide-1800.webp?v=878b56f5406b",
      "alt": "Finished Telecaster-style guitar at the start of its full rotation.",
      "caption": "The finished Telecaster-style guitar and its body hardware.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/telecaster-wide-480.webp?v=f3f6071661ee 480w, assets/editorial/neutral-20260915/telecaster-wide-960.webp?v=9b8c76bead9c 960w, assets/editorial/neutral-20260915/telecaster-wide-1800.webp?v=878b56f5406b 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Walnut-body preparation, ShopBot machining, drilling fixtures, finishing, and electronics installation."
      ],
      [
        "Key decision",
        "Glue smaller walnut pieces into a blank and use templates to control drilling after CNC."
      ],
      [
        "Result",
        "Finished, strung, playable guitar with working Fender Deluxe Drive pickups, controls, and output jack."
      ]
    ],
    chapters: [
      {
        "id": "material",
        "label": "Requirements",
        "title": "Choose a material route\nthat fits the project.",
        "paragraphs": [
          "The objective was a playable guitar with a body made from raw materials. Smaller walnut pieces provided a cost-effective alternative to sourcing a single large blank.",
          "Titebond III and overnight clamping prepared the glue-up for machining. This reduced the stock cost while adding preparation and waiting time before the CNC stage."
        ],
        "image": 4,
        "evidence": "Material preparation",
        "note": "Body pieces clamped during glue-up."
      },
      {
        "id": "machining",
        "label": "Manufacturing",
        "title": "Sequence the cuts\naround later assembly.",
        "paragraphs": [
          "ShopBot toolpaths routed the body outline, electronics pocket, and wiring channels. Hold-down planning had to preserve access for machining while controlling the blank.",
          "Pre-drilled wiring paths and pocket checks preceded sanding and finishing. Verifying those interfaces early kept the later electronics installation connected to the original body geometry."
        ],
        "image": 5,
        "evidence": "CNC fabrication",
        "note": "The walnut body being routed on the ShopBot."
      },
      {
        "id": "fixtures",
        "label": "Verification",
        "title": "Transfer the geometry\nto the hand-drilled features.",
        "paragraphs": [
          "Laser-cut templates checked drilling locations and pocket geometry after CNC. They carried the planned hole positions into operations that otherwise depended on individual hand measurements.",
          "Those checks occurred before the surface finish. The sequence made fit problems easier to address while the body was still in its fabrication stage."
        ],
        "image": 6,
        "evidence": "Drilling fixture",
        "note": "The body holes being drilled with a locating jig."
      },
      {
        "id": "finish",
        "label": "Result",
        "title": "Complete the finish\nand verify the instrument.",
        "paragraphs": [
          "Sanding, drying, and repeated white coats took more than a week in a temporary paint setup. The time was driven by surface preparation and successive coats, not just the machining stage.",
          "I installed Fender Deluxe Drive pickups and the controls after finishing. The final guitar is strung and playable, with working pickups, controls, and output jack: the functional result of the full manufacturing sequence."
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
    deck: "Use student assembly to test the product requirements.",
    description: "An affordable guitar kit revised through cost checks, age-specific build trials, and feedback on wiring, instructions, and classroom use.",
    engineering: {
      "goal": "Offer a roughly $100 hands-on guitar kit that students can assemble into a working instrument while learning engineering concepts.",
      "constraints": [
        "Class-session feasibility, first-time builders, sound and playability, durability, and affordable preparation.",
        "Age-dependent confidence, unfamiliar wiring, and the work intentionally completed before students receive the kit."
      ],
      "checks": [
        [
          "Prototype affordability",
          "Documented preparation and cost test",
          "Approximately $80 and 3–5 hours to prepare a functional kit against the roughly $100 goal.",
          "Prototype estimate"
        ],
        [
          "Student assembly time",
          "Two 15-year-old participants",
          "Body assembly took about 45 minutes; a later school test added about 30 minutes for guided stringing.",
          "Small user trials"
        ],
        [
          "Clarity and challenge",
          "Younger users plus parent/teacher/community feedback",
          "Wiring and setup guidance needed clarification; older students found the challenge appropriate.",
          "Observed feedback"
        ],
        [
          "Early interest",
          "Exploratory parent and child interviews",
          "10 of 14 parents and 7 of 8 children expressed interest in the offering.",
          "Exploratory research"
        ]
      ],
      "iteration": "Feedback favored the STEAM experience and a clearer age fit. Wiring guidance, instructions, and challenge level became design inputs; preparation and guided stringing must remain visible when evaluating classroom time and cost."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/education-wide-1800.webp?v=b73dd2720c2e",
      "alt": "Separated guitar education kit before assembly.",
      "caption": "The guitar education kit in its separated starting layout.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/education-wide-480.webp?v=da4195e24743 480w, assets/editorial/neutral-20260915/education-wide-960.webp?v=750b95301d9b 960w, assets/editorial/neutral-20260915/education-wide-1800.webp?v=b73dd2720c2e 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "Scope",
        "Kit hardware, assembly instructions, cost exploration, and student/parent/educator research."
      ],
      [
        "Measured examples",
        "About $80 prototype build cost; roughly 45-minute body assembly by two 15-year-old participants."
      ],
      [
        "Key revision",
        "Clarify wiring and setup guidance while retaining a meaningful challenge for middle and high school students."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Define the experience\nas well as the instrument.",
        "paragraphs": [
          "The kit targets middle and high school students assembling working hardware while learning engineering concepts. A roughly $100 cost goal was intended to broaden access, with sound, durability, and class-session feasibility shaping the product.",
          "The documented prototype cost about $80 and took 3–5 hours to prepare. That result supports an early affordability check while making preparation labor an explicit part of the delivery model."
        ],
        "image": 0,
        "evidence": "Kit documentation",
        "note": "The component layout supplied to the learner."
      },
      {
        "id": "assembly",
        "label": "Tradeoffs",
        "title": "Preassemble the barriers\nand preserve useful learning.",
        "paragraphs": [
          "Letter-coded screws match the instructions. Color-coded solderless wiring and preassembled copper shielding reduce unfamiliar operations, while the neck, bridge, and pickups are pre-adjusted for playability.",
          "Preassembly makes the first build more approachable but transfers work to kit preparation. The design question is which tasks teach something useful and which mainly create frustration or setup risk for beginners."
        ],
        "image": 2,
        "evidence": "Assembly CAD",
        "note": "The exploded view clarifies component relationships; it is not a user-test photograph."
      },
      {
        "id": "testing",
        "label": "Testing",
        "title": "Observe where different\nage groups need support.",
        "paragraphs": [
          "Two 8-year-olds enjoyed customization but found some wiring intimidating and wanted clearer tool and setup guidance. Two 15-year-olds found the challenge appropriate and assembled the body in about 45 minutes.",
          "A later school test needed approximately 30 additional minutes for guided stringing. Separating body assembly from final setup gives a more useful classroom-time estimate than treating the first 45 minutes as the complete experience."
        ],
        "image": 3,
        "evidence": "Market-test material",
        "note": "The project poster accompanies the customer-experiment notes."
      },
      {
        "id": "iteration",
        "label": "Iteration",
        "title": "Feed the observations\nback into the kit.",
        "paragraphs": [
          "The feedback favored a STEAM building experience over a cheap-instrument proposition. Clearer instructions, reduced wiring concerns, and an appropriate challenge level became the priorities; teachers and community educators also emphasized durability.",
          "Interest interviews were encouraging: 10 of 14 parents and 7 of 8 children responded positively. These small exploratory groups help choose the next product questions; broader classroom trials would assess repeatable timing and usability."
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
    deck: "Make the scoring sequence work as one mechanism system.",
    description: "Competition robotics connecting intake, transfer, lift, deposit, and autonomous feedback through a championship-winning team season.",
    engineering: {
      "goal": "Collect, transfer, lift, and deposit cones reliably through repeated driver-controlled and autonomous scoring cycles.",
      "constraints": [
        "Mechanism handoffs, field maneuverability, quick repairs, and practice time during a competition season.",
        "Subsystem reach must work with drivetrain motion and autonomous position feedback."
      ],
      "checks": [
        [
          "Complete scoring sequence",
          "Integrated intake, extension, slide, and rotational deposit",
          "Team robot combined the mechanical stages into a competition machine.",
          "Built + competed"
        ],
        [
          "Autonomous positioning",
          "Odometry and encoders with belt-driven mecanum drive",
          "Position feedback supported motion beyond dead reckoning alone.",
          "System architecture"
        ],
        [
          "Competition outcome",
          "2022–2023 season result",
          "Massachusetts Championship Tournament Winning Alliance; Motivate and Gracious Professionalism awards.",
          "Team result"
        ]
      ],
      "iteration": "Driver practice, repeated scoring, and repair needs shaped integration through the season. Competition establishes a team outcome; subsystem cycle time and reliability would require separate measurements to isolate each mechanism’s performance."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/ftc-wide-1800.webp?v=131cc1ffd5e2",
      "alt": "Assembled FTC robot with an aluminum lift, red panels and mecanum wheels.",
      "caption": "The FTC robot's drivetrain and cone-handling mechanism.",
      "kind": "Display reconstruction",
      "srcset": "assets/editorial/neutral-20260915/ftc-wide-480.webp?v=b9fae292b6aa 480w, assets/editorial/neutral-20260915/ftc-wide-960.webp?v=e864f3f2bbd7 960w, assets/editorial/neutral-20260915/ftc-wide-1800.webp?v=131cc1ffd5e2 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Senior Mechanical Engineer, Pioneer Robotics FTC Team 12589, during the 2022–2023 season."
      ],
      [
        "Engineering scope",
        "Contributions across intake, extension, lift, deposit, and drivetrain integration."
      ],
      [
        "Team result",
        "Massachusetts Championship Tournament Winning Alliance, plus Motivate and Gracious Professionalism awards."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Treat the cone handoffs\nas system requirements.",
        "paragraphs": [
          "The 2022–2023 game required intake, transfer, lift, and deposit to work repeatedly. A successful subsystem had to deliver the cone in a position the next mechanism could use, while remaining serviceable during competition.",
          "As Senior Mechanical Engineer on Pioneer Robotics FTC Team 12589, I contributed across the linkage extension, claw and arm intake, string-driven slide, rotational deposit, and mecanum drivetrain."
        ],
        "image": 0,
        "evidence": "Competition evidence",
        "note": "The robot operating among the cone-scoring elements."
      },
      {
        "id": "mechanisms",
        "label": "Decisions",
        "title": "Use mechanism reach\nto reduce robot travel.",
        "paragraphs": [
          "Linkage extension reduced unnecessary autonomous chassis movement. The claw and arm handled collection and transfer, and a string-driven slide supplied the vertical reach for scoring.",
          "Rotational deposit completed the placement sequence. This architecture puts some positioning work into the mechanisms, making their handoffs and timing part of the drivetrain’s task as well."
        ],
        "image": 1,
        "evidence": "Mechanism prototype",
        "note": "The slide mechanism documented during development."
      },
      {
        "id": "integration",
        "label": "Integration",
        "title": "Connect mechanical reach\nto position feedback.",
        "paragraphs": [
          "Belt-driven mecanum wheels provided field maneuverability, while odometry and encoders supplied autonomous position feedback beyond dead reckoning alone.",
          "Driver practice, repeated competition cycles, and access for quick repairs shaped the assembly. The integration problem included both moving the robot and maintaining the mechanisms that completed a scoring sequence."
        ],
        "image": 4,
        "evidence": "Team context",
        "note": "Pioneer Robotics team documentation."
      },
      {
        "id": "result",
        "label": "Result",
        "title": "Evaluate the season\nat the team level.",
        "paragraphs": [
          "The team earned Massachusetts Championship Tournament Winning Alliance, along with Motivate and Gracious Professionalism awards. Those are the documented season outcomes of the combined robot, controls, drivers, and team effort.",
          "The experience developed mechanism iteration and subsystem integration skills used later in Formula SAE. A mechanism-specific reliability or cycle-time claim would require measurements separate from the championship result."
        ],
        "image": 3,
        "evidence": "Competition awards",
        "note": "The original trophies-and-awards photograph."
      }
    ],
    "next": "steering"
  }
};
