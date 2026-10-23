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
        "Result",
        "Wheel 3.5 in closer to the driver; bearing cages 0.9 kg lighter than Mk.7."
      ],
      [
        "Status",
        "Installed and operating without reported issues; joint ripple and shaft loads remain model predictions."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Driver reach and cockpit clearance",
        "paragraphs": [
          "The Mk.8 revision moved the wheel 3.5 inches closer to the driver and reduced bearing-cage mass by 0.9 kg relative to Mk.7.",
          "Cockpit-template clearance, dashboard space, ingress, and hardware access set the shaft path before sizing. The reach change had to work within all four interfaces."
        ],
        "detailParagraphs": [
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
        "title": "U-joint angles and phasing",
        "paragraphs": [
          "Matched bends around 27.5° cancel rotational speed variation in the ideal paired U-joint model. I used shaft-angle and yoke-phasing comparisons to choose the column geometry.",
          "The sensitivity case predicts a 1.032 maximum speed ratio with 3° misalignment and 3° phase error. Clearance alone therefore could not determine the layout."
        ],
        "detailParagraphs": [
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
        "title": "Fabricated column and rack interfaces",
        "paragraphs": [
          "I fabricated every steering part, waterjet-cutting rack mounts, lathe-turning shafts, and TIG-welding the chassis integration. Lighter bearing cages balanced mass against stiffness, with retention addressing interface play.",
          "The built assembly uses M4 fasteners and a NARRco rack: 17.4 inches between heim-joint attachment bolts and 4.0 inches of travel per pinion revolution."
        ],
        "detailParagraphs": [
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
        "title": "Shaft sizing and operation",
        "paragraphs": [
          "The installed steering system has run without reported issues. Before fabrication, a calculated 50 N·m worst-case torque from tire friction and Ackermann geometry guided hand torsion sizing and FEA.",
          "Operation supports the installation result; joint ripple and shaft-load predictions remain model outputs, without instrumented verification."
        ],
        "detailParagraphs": [
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
        "34 kPa (5 psi) design pressure, about 3.3× the 1.5 psi (10.3 kPa) maximum working pressure; bodies up to 571 mm circumference; more than 15 daily swaps targeted.",
        "Limited sheet-metal tooling and budget, visible eversion, and sealing against printed surfaces."
      ],
      "checks": [
        [
          "Pressure containment",
          "Initial physical test and subsequent reinforcement FEA",
          "First vessel held 1.2 psi with substantial deformation. Reinforcement at 500 lbf per face predicts 6.524 mm displacement and 0.2339 GPa peak stress; this FEA, not a pressure test, backs the 5 psi design pressure.",
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
      "iteration": "Observed wall deformation, coupling release, spool-joint failure, and leaks determined the reinforcement work. The reinforced vessel is designed for 5 psi on the strength of FEA; it has not been pressure-tested at 5 psi, and the research runs stay at or below the 1.5 psi maximum working pressure."
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
        "Result",
        "45 runs across three body types. The first vessel held 1.2 psi but deformed substantially, so it was reinforced."
      ],
      [
        "Status",
        "Reinforced vessel designed for 5 psi with FEA, about 3.3× the 1.5 psi max working pressure; not pressure-tested at 5 psi."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Interchangeable vine bodies",
        "paragraphs": [
          "A transparent 19 L polypropylene pail provided visible eversion and flat mounting faces within the available tooling and budget. The platform accepted bodies up to 571 mm circumference, with frequent swaps between three cross-sections.",
          "The vessel is designed for 34 kPa (5 psi), about 3.3× the 1.5 psi maximum working pressure. Choosing the pail also introduced a stiffness problem exposed by the first pressure test."
        ],
        "detailParagraphs": [
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
        "title": "Lid, seals, and drive supports",
        "paragraphs": [
          "A flange-gripping bolted mount replaced the stock lid’s inadequate support, carrying the calculated blow-off load in tension. TPU 85A gaskets conform to the printed surfaces.",
          "A fixed outlet stiffens the cut wall while interchangeable converters change body geometry. Separate spool bearings carry weight and vine tension; a flexible coupling accommodates motor alignment."
        ],
        "detailParagraphs": [
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
        "title": "Pressure failures and reinforcement",
        "paragraphs": [
          "The first vessel held 1.2 psi but deformed substantially; the coupling released, the spool connection failed, and leaks appeared. These failures drove reinforcement beyond the initial 0.71 psi hand estimate.",
          "I added 6061 plates, an aluminum lid, and three A36 brackets while retaining viewing cutouts. FEA assessed the revised load path, with the outlet still weakest."
        ],
        "detailParagraphs": [
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
        "title": "Force measurement and 45-run study",
        "paragraphs": [
          "The experiment completed 36 loaded conditions and nine unloaded baselines. A scale beneath the vine set transmitted force within ±0.05 kg of target, accounting for friction that made applied weight unreliable.",
          "Scans captured deformation for the prediction model. Separately, reinforcement FEA predicted 6.524 mm displacement and 0.2339 GPa peak stress at 500 lbf per face; it does not establish physical 5 psi containment."
        ],
        "detailParagraphs": [
          "I ran 36 loaded conditions plus nine unloaded baselines. A scale directly below the body measured the transmitted force because friction in the guide bearings made applied weight an unreliable proxy; the procedure set load within ±0.05 kg of target.",
          "Scans captured the deformed geometry for the prediction model. At 500 lbf per face, reinforcement FEA predicted 6.524 mm displacement and 0.2339 GPa peak stress. The 45 research runs and the containment analysis answer different verification questions."
        ],
        "image": 2,
        "evidence": "Experiment setup",
        "note": "Guide rods constrain the load shape; the scale measures the force reaching the body."
      }
    ],
    next: 'brakeSim'
  },
  javelin: {
    "number": "05",
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
          "In progress. Speed remains a design target, not flight-validated.",
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
        "My role",
        "Individual project — designed and built the airframe and propulsion packaging and integrated the avionics, from a 26-item requirements matrix."
      ],
      [
        "Result",
        "Airframe and CAD complete, electronics integrated; 23 of 26 requirements met in the April 2026 review."
      ],
      [
        "Status",
        "In progress. 300 km/h is a design target, not flight-validated; fail-safe behavior, differential-thrust tuning, and flight testing are the recorded next steps."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Differential-thrust flight control",
        "paragraphs": [
          "Four-motor differential thrust replaces flaps, ailerons, rudders, and servos in Javelin’s intended vertical-takeoff and forward-flight sequence. Fewer mechanical control surfaces make motor mixing responsible for attitude control.",
          "A 26-item requirements matrix guided packaging and system decisions. The 300 km/h speed remains a design target, separate from demonstrated flight performance."
        ],
        "detailParagraphs": [
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
        "title": "Airframe geometry and materials",
        "paragraphs": [
          "The airframe combines a Von Karman ogive nose, swept wing, NACA-0008 stabilizers, and motor fairings to pursue low drag. Its center-of-gravity and center-of-pressure relationship supports the intended stability strategy.",
          "PPA-CF serves stiff, heat-exposed structure; ASA permits RF transmission; PC-FR serves flame-retardant parts. Carbon tubes reinforce the wing and tail, with a dedicated cutting jig."
        ],
        "detailParagraphs": [
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
        "title": "Powertrain and electronics integration",
        "paragraphs": [
          "Four T-Motor F90 motors and parallel 4S packs define the integrated 14.8 V powertrain. XT90-S connectors manage inrush; separate high- and low-voltage routes accommodate the flight controller, sensors, radio, and FPV system.",
          "Three propeller types support testing, routine use, and speed attempts. MATLAB screened 10 candidates using an 8S / 10% slip assumption, a separate configuration from the built power system."
        ],
        "detailParagraphs": [
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
        "title": "Airframe and planned flight tests",
        "paragraphs": [
          "The airframe and CAD are complete, with electronics integrated. The April 2026 matrix marks 23 of 26 requirements met; cooling ducts, ArduPlane ecosystem control, and a stressed-skin composite wing remained unchecked.",
          "Fail-safe behavior, thrust-mixing tuning, and flight testing following regulatory review remain next work. The animation illustrates intended flight; measured speed is still a separate milestone."
        ],
        "detailParagraphs": [
          "The April 2026 matrix marks 23 of 26 requirements met, including pitot extension and thermal separation. Cooling ducts, ArduPlane ecosystem control, and a stressed-skin composite wing remained unchecked in that review.",
          "The airframe and full CAD are complete and electronics are integrated. The recorded next work is fail-safe behavior, differential-thrust tuning, and flight testing following regulatory review. The animated flight pose shows the intended behavior; measured flight speed is still a separate milestone."
        ],
        "image": 5,
        "evidence": "Built-airframe documentation",
        "note": "Javelin resting outdoors; this image is not a flight-test result."
      }
    ],
    "next": "materialTest"
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
        "Result",
        "2,206 readings over 140 × 165 mm. Below roughly 3% calibrated distance error in the stable sensor range."
      ],
      [
        "Status",
        "Built and demonstrated end to end in one week; full point-cloud accuracy has not been independently checked."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Cartesian scan coordinates",
        "paragraphs": [
          "The one-week build replaced a less accurate servo pan/tilt concept with a Cartesian gantry, giving each distance reading a controlled raster coordinate.",
          "The added mechanism traded structural complexity for repeatability. Pan/tilt remained an option for wider coverage at lower precision, so the two layouts served different scanning needs."
        ],
        "detailParagraphs": [
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
        "title": "Distance calibration and working range",
        "paragraphs": [
          "A correction curve fitted to 14 ruler-measured distances reduced TFmini-S error below roughly 3% in its working range. Less stable readings below about 30 cm determined sensor placement.",
          "This calibration checks the sensor. Gantry positioning, sampling, and later surface processing still contribute to the accuracy of the reconstructed shape."
        ],
        "detailParagraphs": [
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
        "title": "Gantry drive and electrical noise",
        "paragraphs": [
          "Homing switches establish the raster origin; dual M8 lead screws control Y and a belt drives X. NEMA 17 motors and DRV8825 drivers move the carriage.",
          "Motor-rail capacitors, copper-lined packaging, and shielded sensor wiring reduced noise. The emergency stop cuts motor voltage while retaining controller logic and test state."
        ],
        "detailParagraphs": [
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
        "title": "Measured samples and reconstruction",
        "paragraphs": [
          "The scanner captured 2,206 readings across 140 × 165 mm, pairing each distance with carriage position. This demonstrated the complete motion, acquisition, calibration, and reconstruction chain.",
          "Interpolation to a 300 × 300 grid and Gaussian filtering improve visualization. They add no measured samples, and sensor calibration alone does not establish full point-cloud accuracy."
        ],
        "detailParagraphs": [
          "The scanner captured 2,206 distance readings across a 140 × 165 mm region. Each reading was paired with carriage position, demonstrating the complete motion, acquisition, calibration, and reconstruction chain.",
          "The archived processing script interpolates onto a 300 × 300 grid and applies a Gaussian filter. Those steps improve visualization; the measured sample count remains 2,206, and sensor calibration alone does not establish full point-cloud accuracy."
        ],
        "image": 6,
        "evidence": "Scan output",
        "note": "The test object and its scan plot, preserved from the project record."
      }
    ],
    next: 'javelin'
  },
  brakeSim: {
    "number": "03",
    "title": "FSAE Racecar Brake",
    "label": "Formula SAE / Thermal & structural design",
    "deck": "Reduce rotor mass while keeping the brakes in their working temperature range.",
    "description": "A Mk.7-to-Mk.8 rotor redesign connects an endurance thermal model to lighter geometry, structural analysis, reference fatigue life and brake-system integration.",
    "engineering": {
      "goal": "Reduce rotor mass and rotational inertia while keeping the front rotor at 350–450°C for at least 80% of endurance after warm-up.",
      "constraints": [
        "Two independent hydraulic circuits, simultaneous wheel lock, chassis clearance and reuse of serviceable Mk.6 hardware.",
        "Simple rotor geometry, ASTM A48 Class 40 cast iron, Wilwood GP200 calipers and BP28 pads.",
        "Repeated braking across the endurance cycle, limited convection validation, and a rear rotor that remains colder than desired."
      ],
      "checks": [
        [
          "Rotor mass and inertia",
          "Mk.7-to-Mk.8 design comparison",
          "Mass: 1.39 → 1.07 lb (−23%). Inertia: 11.55 → 9.35 lb·in² (−19%).",
          "DR design comparison"
        ],
        [
          "Front-rotor working range",
          "22-lap thermal prediction; evaluate after the first three laps",
          "90.75% of the remaining time at 350–450°C, against an 80% target.",
          "Simulated"
        ],
        [
          "Cooling-model plausibility",
          "Reproduce the component and cooling-curve conditions of the cited MIT study",
          "Radiation and conduction compared with the reference; convection remained outside the validation.",
          "Reference comparison"
        ],
        [
          "Structural response",
          "14.93 kN pad force, 1,517.96 N·m torque and 450°C load case",
          "The design review reports a factor of safety of 2.455 and maximum deformation of 0.52 mm.",
          "DR-reported FEA"
        ],
        [
          "Repeated-load life",
          "Thermal histories and calculated brake forces used for fatigue analysis",
          "DR-reported reference life: 5.561 equivalent 22 km endurances; damage: 53.95%. The separate target is more than three endurances (66 laps); physical life is not demonstrated.",
          "Reference prediction"
        ]
      ],
      "iteration": "The review advances the lighter rotor to planned waterjet cutting and surface grinding, with caliper rebuilding and brake-line inspection still ahead. The cold rear rotor keeps airflow integration open; measured vehicle temperatures would complete the model-to-hardware comparison."
    },
    "cover": {
      "src": "assets/editorial/brake-dr-20261005/brakeSim-wide-1800.webp?v=8aba11208295",
      "alt": "Mk.8 scalloped cast-iron brake rotor with 72 through holes before illustrative heating.",
      "caption": "Rotor geometry connects braking heat storage with mass and inertia.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/brake-dr-20261005/brakeSim-wide-480.webp?v=1ff94cc7ef6c 480w, assets/editorial/brake-dr-20261005/brakeSim-wide-960.webp?v=52a14279cd8a 960w, assets/editorial/brake-dr-20261005/brakeSim-wide-1800.webp?v=8aba11208295 1800w",
      "width": 1800,
      "height": 1200
},
    "summary": [
      [
        "My role",
        "Individual project — rotor design, endurance thermal modeling, structural FEA, and reference fatigue analysis."
      ],
      [
        "Result",
        "23% less mass and 19% less inertia than Mk.7; front rotor predicted at 350–450°C for 90.75% of the time after three warm-up laps (target 80%)."
      ],
      [
        "Status",
        "Design review complete. Temperature, strength, and fatigue figures are predictions, not vehicle data."
      ]
    ],
    "chapters": [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Rotor thermal requirements",
        "paragraphs": [
          "Rotor mass and inertia could fall only while meeting a thermal target: 350–450°C for at least 80% of endurance after warm-up. That band supports the BP28 pad’s target friction coefficient of 0.47–0.48.",
          "Manufacturable geometry, two independent hydraulic circuits, simultaneous wheel lock, chassis clearance, and reuse of serviceable Mk.6 parts constrain the redesign."
        ],
        "detailParagraphs": [
          "The design starts with a temperature requirement: keep the front rotor at 350–450°C for at least 80% of endurance after warm-up. That range supports the BP28 pad’s target friction coefficient of 0.47–0.48. Mass and rotational inertia should fall while the geometry stays practical to make.",
          "The brake system also needs two independent hydraulic circuits, simultaneous wheel lock and clearance above the lower chassis surface. Reusing serviceable Mk.6 parts keeps the rotor redesign connected to the existing car."
        ],
        "image": 0,
        "evidence": "Mk.8 rotor geometry · DR 32",
        "note": "A perforated, scalloped cast-iron rotor developed around the thermal and manufacturing requirements."
      },
      {
        "id": "decisions",
        "label": "Thermal model",
        "title": "Thermal model and validation limits",
        "paragraphs": [
          "The 22-lap simulation tracks braking heat through lumped rotor, pad, hub, and caliper nodes. Michigan 2024 track segments set heat input; convection, radiation, and conduction provide cooling.",
          "On/off braking excludes trail braking, aerodynamic drag, and regeneration. Comparison with published MIT cooling curves covers radiation and conduction only; convection remains outside that validation, and endurance performance is not measured."
        ],
        "detailParagraphs": [
          "Track segments from Michigan 2024 turn speed changes and braking demand into heat input. Separate lumped rotor, pad, hub and caliper nodes store heat; speed-dependent convection, radiation and conduction to adjacent components remove it. The design-review plot spans 22 simulated laps.",
          "The scenario uses on/off braking, no trail braking, no aerodynamic drag and no regenerative braking. Radiation uses absolute temperature, while finite conduction links let the neighboring hardware warm with the rotor.",
          "Cooling curves from a published MIT FSAE brake study provide the comparison for radiation and conduction. The review explicitly leaves convection outside that validation, so this comparison does not establish measured endurance performance."
        ],
        "image": 1,
        "evidence": "Rotor energy balance · DR 29",
        "note": "The original equation relates net heat flow to thermal storage; convection, radiation and conduction provide the cooling terms."
      },
      {
        "id": "hardware",
        "label": "Design result",
        "title": "Rotor mass and predicted temperature",
        "paragraphs": [
          "The design review reports 23% less mass and 19% less inertia than Mk.7. It predicts 90.75% front-rotor time at 350–450°C after three warm-up laps, above the 80% target.",
          "The colder rear rotor leaves airflow integration open. Current display CAD is 5.08 mm thick; the saved thermal-study geometry is 4.7498 mm. The DR results have not been recomputed from the display CAD."
        ],
        "detailParagraphs": [
          "The Mk.8 design moves from 1.39 to 1.07 lb and from 11.55 to 9.35 lb·in² of rotational inertia: reductions of 23% and 19% relative to Mk.7. The review pairs ASTM A48 Class 40 cast iron with Wilwood GP200 calipers and BP28 pads.",
          "The front rotor is predicted to spend 90.75% of the time after three warm-up laps in the 350–450°C band, exceeding the 80% target. That gives the lighter geometry a specific thermal criterion rather than a mass result alone.",
          "The rear rotor remains much colder in the same plot. Rear airflow and brake-system integration remain open design work."
        ],
        "image": 2,
        "evidence": "Thermal result · DR 32",
        "note": "The review reports 90.75%; the plot title displays 90.7%. Both refer to the front rotor after lap three."
      },
      {
        "id": "validation",
        "label": "Checks & next steps",
        "title": "Strength and reference fatigue",
        "paragraphs": [
          "The DR reports a 2.455 factor of safety and 0.52 mm maximum deformation for its structural case. Fatigue outputs—5.561 equivalent 22 km endurances and 53.95% reference damage—remain reference predictions, not physical life or a demonstrated 66-lap pass.",
          "Waterjet cutting, surface grinding, caliper rebuilding, line inspection, rear-cooling work, and vehicle-temperature comparison remain next steps."
        ],
        "detailParagraphs": [
          "The structural case uses 14.93 kN pad force from a 2 kN pedal load, 1,517.96 N·m torque and 450°C. The design review reports a 2.455 factor of safety and 0.52 mm maximum deformation.",
          "Thermal histories and calculated brake forces feed the reference fatigue analysis. The DR reports 5.561 equivalent 22 km endurances and 53.95% maximum reference damage. These reference outputs do not establish physical fatigue life or a demonstrated pass of the separate three-endurance / 66-lap target.",
          "The next steps are waterjet cutting, surface grinding, caliper rebuilding and inspection of the brake lines for reuse. Resolving rear-rotor cooling and comparing vehicle temperatures with the model would complete the remaining design loop."
        ],
        "image": 3,
        "evidence": "Reference fatigue damage · DR 34",
        "note": "The original damage map reports a 53.95% maximum. The separate equivalent-life map is available in the image archive; both are reference predictions."
      }
    ],
    "recordNote": "Results follow the current brake design review. Mass and inertia are design comparisons; temperature, strength and fatigue figures are analytical predictions. Model-version and verification limits are recorded below.",
    "next": "scanner"
  },
  aura: {
    "number": "07",
    "title": "AURA swerve drive.",
    "label": "Autonomous luggage robot / Mechanical Engineer",
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
        "Mechanical Engineer — front-wheel swerve mechanics: steering, drive reduction, shafts, bearings, and fabricated mounts."
      ],
      [
        "Result",
        "Carried 300 lb in testing, against a 200 lb initial payload target."
      ],
      [
        "Status",
        "Built and load-tested. Chain-skipping fixes slowed steering; DC steering with absolute encoders is the identified redesign."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Front-wheel swerve packaging",
        "paragraphs": [
          "The front-wheel swerve layout combines traction and steering around a 200 lb payload target. My scope covered the motors, chains, sprockets, shafts, bearings, and mounts needed for those two motions.",
          "Independent front-wheel angles approach Ackermann behavior to reduce loaded scrub. Clearance and steering torque therefore matter alongside carrying capacity."
        ],
        "detailParagraphs": [
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
        "title": "Chain reduction and steering response",
        "paragraphs": [
          "Moving steering motors inward and increasing the step setting from 200 to 1600 reduced chain skipping, at the cost of slower steering.",
          "NEMA 23 steering motors use an 18:80 sprocket reduction for torque. Separate MY1016Z 24 V traction motors use a 9:16 ratio, keeping drive and steering reductions distinct."
        ],
        "detailParagraphs": [
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
        "title": "Fabricated mounts and clearance",
        "paragraphs": [
          "Spacers and shortened fasteners resolved interference discovered during assembly, making the tightly packed wheel mechanism operable.",
          "Quarter-inch A36 steel provided strong, weldable housings and motor mounts suited to the available waterjet, TIG-welding, and painting processes. Final clearance depended on fitting the assembled hardware."
        ],
        "detailParagraphs": [
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
        "title": "Payload test and steering limits",
        "paragraphs": [
          "The robot carried 300 lb in testing, exceeding its 200 lb target. Shaft-mounted LPD3806 encoders provide speed and displacement feedback; roughly 1 m/s² acceleration remains a design target.",
          "Slower steering persisted after the chain-skipping improvements. The team identified DC steering motors with absolute encoders as a future architecture to evaluate."
        ],
        "detailParagraphs": [
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
    "number": "08",
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
          "Complete"
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
      "iteration": "Mk.7 fabrication experience drove the Mk.8 support and service requirements. The completed seat establishes manufacturability; driver-fit, load-response, and removal results are not reported here, so those functional objectives are stated as design intent."
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
        "My role",
        "Individual project — support geometry, layup planning, fabrication, trimming, and service access."
      ],
      [
        "Result",
        "Cured, demolded, and trimmed Mk.8 shell: EL2 resin, 20 main plies of 3K twill, plus 5–10 local patch plies."
      ],
      [
        "Status",
        "Complete. Load and driver-fit results are not reported."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Torso support and cockpit access",
        "paragraphs": [
          "The Mk.8 shell adds shoulder and hip support above the seat pan while fitting around harness routing, frame tubes, and bodywork.",
          "Mk.7 build experience made cockpit access and serviceability design requirements alongside lateral support. The geometry had to accommodate both the driver and the work of installing or repairing the shell."
        ],
        "detailParagraphs": [
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
        "title": "Full-shell plies and local patches",
        "paragraphs": [
          "Full-shell carbon plies provide the main support, with small patches adding material only in selected regions. This avoids increasing thickness across the entire shell.",
          "The stiffness-to-weight benefit comes with mold preparation, layup, and trimming work. Practical cloth access constrained which surfaces and edges could be manufactured."
        ],
        "detailParagraphs": [
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
        "title": "Carbon layup and fabrication",
        "paragraphs": [
          "The fabricated shell uses EL2 resin and 3K, 200 g/m² twill: 20 main plies plus 5–10 local reinforcing plies.",
          "Layup, cure, demolding, and trimming produced the cockpit component shown in the photographs. The animation’s 10 visual layers illustrate the process; they do not represent the physical ply count."
        ],
        "detailParagraphs": [
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
        "title": "Completed shell and functional evidence",
        "paragraphs": [
          "The completed, trimmed shell demonstrates that the geometry and layup could be manufactured. Race-weekend removal, repair, and reassembly informed its surrounding interfaces.",
          "The seat is complete. Driver-fit, load-response, and removal-access results are not reported, so those cockpit requirements stand as design intent rather than test evidence."
        ],
        "detailParagraphs": [
          "The completed, trimmed shell establishes that the geometry and layup could be manufactured. Removal, repair, and reassembly within a race weekend informed the surrounding interfaces.",
          "Driver fit, support under load, and access during removal are not reported as test results. Keeping those checks distinct from successful fabrication preserves the connection between the original cockpit needs and the evidence required to verify them."
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
    "number": "09",
    "title": "Mk.7 driver seat.",
    "label": "Formula SAE / Mk.7 seat design & fabrication",
    deck: "Design the Mk.7 seat geometry and make it a cockpit component.",
    description: "A design-and-fabrication project connecting the Mk.7 seat’s folded-panel geometry to the surrounding vehicle package.",
    engineering: {
      "goal": "Design and produce the Mk.7 driver seat for the vehicle build.",
      "constraints": [
        "5052-H32 aluminum; perforated pan and back with folded side panels.",
        "The surrounding chassis and cockpit hardware define the installation space."
      ],
      "checks": [
        [
          "Seat design and fabrication",
          "Confirmed personal responsibility for the Mk.7 seat",
          "The seat was designed and fabricated for Mk.7.",
          "Design + fabrication scope"
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
      "iteration": "This case covers both designing the seat and making it. The useful review compares the finished geometry and cockpit interfaces with the design intent, with process choices, inspection, and any rework attributed only when confirmed."
    },
    "cover": {
      "src": "assets/editorial/neutral-20260915/seat-wide-1800.webp?v=ad9330bcc20e",
      "alt": "Folded and perforated 5052-H32 aluminum Mk.7 driver seat.",
      "caption": "The Mk.7 driver seat in 5052-H32 aluminum.",
      "kind": "Project CAD render",
      "srcset": "assets/editorial/neutral-20260915/seat-wide-480.webp?v=d59c63530faf 480w, assets/editorial/neutral-20260915/seat-wide-960.webp?v=808ba2b7e914 960w, assets/editorial/neutral-20260915/seat-wide-1800.webp?v=ad9330bcc20e 1800w",
      "width": 1800,
      "height": 1200
    },
    summary: [
      [
        "My role",
        "Designed and fabricated the Mk.7 driver seat."
      ],
      [
        "Result",
        "Perforated 5052-H32 aluminum pan and back with folded side panels, made as the Mk.7 car’s seat."
      ],
      [
        "Status",
        "Built for Mk.7. No numerical structural result or driver-fit trial is claimed."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Mk.7 seat design and fabrication",
        "paragraphs": [
          "I designed and made the Mk.7 driver seat for the Formula SAE car in 5052-H32 aluminum: a perforated pan and back with folded side panels.",
          "The contribution covers the seat design and its fabrication. Numerical structural validation would require evidence separate from the build."
        ],
        "detailParagraphs": [
          "My responsibility was designing and making the 5052-H32 aluminum driver seat for the Mk.7 Formula SAE car. The seat geometry includes a perforated pan and back with folded side panels.",
          "That defines a design-and-fabrication task: develop the seat form and carry it into a physical component for the cockpit. Numerical validation of the seat is separate from the scope presented here."
        ],
        "image": 0,
        "evidence": "Seat CAD",
        "note": "The complete seat geometry, shown without cropping its edges."
      },
      {
        "id": "fit",
        "label": "Fabrication",
        "title": "The seat in the cockpit",
        "paragraphs": [
          "The Mk.7 seat design became a physical cockpit component, retaining the folded sides and perforated surfaces visible in the design record.",
          "The cockpit photograph places the finished seat beside the surrounding frame and controls, showing its installation context."
        ],
        "detailParagraphs": [
          "The work translated the Mk.7 seat geometry into the physical cockpit component. The folded sides and perforated surfaces are the principal features visible in the design record.",
          "The cockpit photograph shows the surrounding frame and controls, giving the fabrication a vehicle context rather than presenting it as an isolated part."
        ],
        "image": 2,
        "evidence": "Mk.7 cockpit",
        "note": "The Mk.7 cockpit surrounding the seat."
      },
      {
        "id": "interfaces",
        "label": "Interfaces",
        "title": "Seat and vehicle interfaces",
        "paragraphs": [
          "Chassis tubes, steering hardware, and neighboring cockpit components define the seat’s installation space. Reviewing them together makes the geometry and access relationships visible.",
          "Vehicle photographs preserve those interfaces for inspection. They support that discussion without importing driver-fit trials or dimensions from a different car."
        ],
        "detailParagraphs": [
          "The seat occupies space shared with chassis tubes, steering hardware, and other cockpit components. Those neighboring parts explain why the seat shape and its installation context belong in the same review.",
          "The vehicle photographs retain that relationship for inspection. They support discussion of geometry and access without assigning driver-fit trials or dimensions from a different car."
        ],
        "image": 3,
        "evidence": "Mk.7 vehicle",
        "note": "The car in its broader build context."
      },
      {
        "id": "validation",
        "label": "Review",
        "title": "Design, fabrication, and supporting evidence",
        "paragraphs": [
          "The documented contribution is the Mk.7 seat’s design and fabrication, supported by CAD, cockpit context, and vehicle photographs. The original seat-support analysis image records related engineering work.",
          "The build record establishes design and manufacturing responsibility. Numerical structural results and a detailed rework history still require their own confirmed evidence."
        ],
        "detailParagraphs": [
          "The delivered contribution is Mk.7 seat design and fabrication. The gallery combines the CAD, cockpit context, vehicle photographs, and the original seat-support analysis image.",
          "The analysis image helps explain the surrounding engineering work, while the build record establishes my manufacturing responsibility. Numerical structural results and a detailed rework history require their own confirmed evidence."
        ],
        "image": 1,
        "evidence": "Support FEA",
        "note": "Original supporting analysis image; no numerical result is reported."
      }
    ],
    "next": "ansysCfd"
  },
  materialTest: {
    "number": "06",
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
      "alt": "Charcoal fabric specimen held between silver grips before stretching.",
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
        "Result",
        "30 membrane specimens and 11 bamboo rods: directional fabric stiffness and rod EI = 0.672 ± 0.063 N·m²."
      ],
      [
        "Status",
        "Stiffness inputs measured; the historical rod modulus awaits a diameter-convention recheck."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Material inputs for deformation modeling",
        "paragraphs": [
          "Separate tensile and bending tests supplied the membrane and bamboo stiffness inputs used directly by the vine cross-section model, reducing reliance on generic material assumptions.",
          "TPU-coated woven fabric required MD, TD, and 45° specimens. Pilot tests supported treating LDPE film as direction-independent; bamboo reinforcement needed a separate bending measurement."
        ],
        "detailParagraphs": [
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
        "title": "Tensile procedure and modulus fitting",
        "paragraphs": [
          "Thirty specimens compared fabric direction and LDPE: seven MD, seven TD, eight 45°, and eight film samples. The ASTM D882-based procedure adapted the nominal 250 mm gauge length to 100 mm for the available grips.",
          "Strain-rate-based speeds, measured dimensions, and controlled conditions supported comparison. Least-squares modulus fits used explicit strain windows."
        ],
        "detailParagraphs": [
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
        "title": "Directional stiffness and fit limits",
        "paragraphs": [
          "Fabric stiffness measured 76.30 MPa in MD, 69.89 MPa in TD, and 41.78 MPa at 45°, supporting an orthotropic description. The fitted directional minimum lies near 46°.",
          "Group scatter was about 5% or less. Curvature reduced R² to 0.967 for 45° fabric and 0.950 for LDPE, limiting confidence in a single fitted modulus."
        ],
        "detailParagraphs": [
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
        "title": "Bamboo bending stiffness",
        "paragraphs": [
          "Eleven rods tested over a 73.37 mm span gave 81.7 ± 7.7 N/mm stiffness and EI = 0.672 ± 0.063 N·m². Every linear fit had R² above 0.999.",
          "The measured 5.79–6.33 mm dimensions are diameters. The historical modulus conversion needs that convention rechecked, so bending stiffness EI remains the primary model input."
        ],
        "detailParagraphs": [
          "Eleven rods selected for straightness were tested over a 73.37 mm span. Linear force–deflection fits gave 81.7 ± 7.7 N/mm stiffness, with R² above 0.999 for every rod; the central-load beam relation gives EI = 0.672 ± 0.063 N·m².",
          "The measured 5.79–6.33 mm dimensions are diameters. The historical material-modulus conversion needs that convention rechecked, so EI remains the primary model input. This preserves the useful bending result while keeping the geometry-dependent calculation open."
        ],
        "image": 12,
        "evidence": "Measured bending curves",
        "note": "Force–deflection data for all eleven tested bamboo rods."
      }
    ],
    "recordNote": "The tensile gauge length was adapted to the available grips; the rod tests use a documented repeatable fixture and fitting procedure. The animated deformation is illustrative. The original per-rod EI / E plot is retained as a historical calculation: with 5.79–6.33 mm confirmed as diameter, its E conversion requires review. No corrected modulus is reported; force–deflection stiffness and EI remain the direct bending-test results.",
    "next": "aura"
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
        "My role",
        "Individual project — PyFluent workflow, reference scripts, solver checks, failure recovery, and credibility reporting."
      ],
      [
        "Result",
        "Reusable teaching package covering 11 observed failures and a conforming-mesh fix for lost surface fidelity."
      ],
      [
        "Status",
        "Process demonstration complete; results are process-validation level, not design-grade aerodynamics."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Inspectable solver automation",
        "paragraphs": [
          "The workflow makes headless Fluent operation inspectable through saved geometry, settings, outputs, and failure context. An AI coding agent uses PyFluent for solver launch, file handling, monitoring, post-processing, and reporting.",
          "The teaching case prescribes Javelin at 300 km/h and Mach 0.245. These are simulation conditions, without a corresponding flight-performance claim."
        ],
        "detailParagraphs": [
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
        "title": "Conforming mesh after wrap failure",
        "paragraphs": [
          "A conforming multi-region mesh replaced the first wrap mesh after it lost CAD surface fidelity and resisted reliable headless refinement.",
          "One pressure-far-field boundary preserved smoother surface representation and avoided brittle region extraction. This revision addressed geometry and automation failures; successful execution still leaves mesh accuracy to be checked separately."
        ],
        "detailParagraphs": [
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
        "title": "Physics readback and failure recovery",
        "paragraphs": [
          "Mach number and flow direction are read back from Fluent, with mismatches stopping the run. The recorded setup uses compressible ideal-gas physics, k–ω SST, Mach 0.245, and a defined angle-of-attack vector.",
          "A recovery catalog converts 11 observed failures into reusable checks, covering import crashes, report loops, premature convergence, and orphaned MPI processes."
        ],
        "detailParagraphs": [
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
        "title": "Qualitative flow and evidence limits",
        "paragraphs": [
          "The deliverable is a reusable solver workflow with instructions, scripts, recovery checks, and quality gates. Estimated reference dimensions keep derived coefficients at process-validation level.",
          "The interactive flow display is a separate 400-iteration reconstruction. Poor minimum cell quality, missing prism layers, first-order numerics, and no mesh-independence study limit it to qualitative interpretation. It neither recovers the missing original solution nor validates aircraft performance."
        ],
        "detailParagraphs": [
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
        "My role",
        "Pool cue and cue-base fabrication within the team launcher project."
      ],
      [
        "Result",
        "Working cue-loading and release mechanism with laser aiming and adjustable shot strength."
      ],
      [
        "Status",
        "Working prototype. Shot repeatability and use by the intended users remain separate checks."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Adjustable cue power and aiming",
        "paragraphs": [
          "Laser alignment and a physical release setting let the player choose shot direction and strength. The compact launcher targets beginners and users who find conventional cue stance, sighting, or striking difficult.",
          "The team mechanism aims to provide break-shot power. My documented contribution was the cue and cue base."
        ],
        "detailParagraphs": [
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
        "title": "Tubing storage and trigger position",
        "paragraphs": [
          "Surgical tubing stores energy as a chain-driven rack and pinion pull back the cue. A sliding trigger selects the release position and therefore the shot setting.",
          "The bottom slider supports the rack against tubing tension. Laser aiming and switch actuation connect that adjustable mechanism to the player’s controls."
        ],
        "detailParagraphs": [
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
        "title": "Waterjet fit and cue machining",
        "paragraphs": [
          "Waterjet parts replaced poorly toleranced plasma-cut plates after assembly problems. The process change improved fit in the compact mechanism.",
          "The long cue needed manual finishing to maintain diameter, while a conversational mill handled the intricate cue base. Wire lengths and routing also had to clear the moving assembly."
        ],
        "detailParagraphs": [
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
        "title": "Working prototype and user tests",
        "paragraphs": [
          "Shop iteration produced a working cue-loading and release prototype with laser aiming and adjustable shot strength.",
          "Repeatable shot behavior and operation by the intended users remain the next checks. Those tests would assess the original accessibility and aiming objectives beyond the demonstrated fabrication and integration."
        ],
        "detailParagraphs": [
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
      "goal": "Complete a Spa-Francorchamps-inspired line course in under 15 seconds.",
      "constraints": [
        "Two-week build, palm-size packaging, sharp turns, and accessible wiring for repeated tuning.",
        "Sensor coverage, mass, available battery power, and the balance between forward speed and steering correction."
      ],
      "checks": [
        [
          "Lap-time target",
          "Recorded run on the course",
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
        "My role",
        "Individual project — compact packaging, power, reflectance sensing, motor integration, and controller tuning."
      ],
      [
        "Result",
        "Best recorded lap: 18 s, after widening sensor pitch from 4 to 8 mm and cutting mass from 428 g to 284 g."
      ],
      [
        "Status",
        "Built and run on the course; the original under-15-second target was not reached."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Lap target and corner detection",
        "paragraphs": [
          "The two-week project targeted a lap below 15 seconds on a Spa-Francorchamps-inspired course. Sharp-turn detection had to support that whole-course goal alongside straight-line speed.",
          "An Arduino Mega, motor drivers, battery, and two-wheel drivetrain fit within a small chassis, with access retained for sensor and controller tuning."
        ],
        "detailParagraphs": [
          "The two-week build targeted a lap below 15 seconds on a Spa-Francorchamps-inspired course. An Arduino Mega, motor drivers, battery, and two-wheel drive had to fit within a small chassis and remain accessible for tuning.",
          "Straight-line speed alone could not satisfy the goal. The sensor layout and controller had to detect sharp turns soon enough for the drivetrain to follow them."
        ],
        "image": 2,
        "evidence": "Prototype hardware",
        "note": "The source gallery identifies this prototype as 428 g."
      },
      {
        "id": "packaging",
        "label": "Iteration",
        "title": "Battery mass and service access",
        "paragraphs": [
          "Battery and chassis changes reduced total mass from 428 g to 284 g, a documented 33.6% reduction. The battery alone changed from 157 g to 37.85 g.",
          "The smaller LiHV pack traded battery capacity for lower mass on a short course. Short wires and accessible connectors retained sensor and drivetrain service access."
        ],
        "detailParagraphs": [
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
        "title": "Sensor coverage and feedback tuning",
        "paragraphs": [
          "8 mm sensor spacing replaced 4 mm for wider sharp-turn coverage. Fourteen channels form two arrays mounted 6 mm above the floor.",
          "Off-center feedback separates base and steering speeds: the outermost sensors detect sharp turns, while the inner 12 follow ordinary curves. Serial Kp adjustment shortened controller tuning."
        ],
        "detailParagraphs": [
          "I compared 4 mm and 8 mm sensor spacing, choosing 8 mm to expand line-detection coverage in sharp turns. Fourteen channels form two seven-sensor arrays, mounted 6 mm above the floor.",
          "The successful controller used off-center feedback with separate base and steering speeds. The two outermost sensors identify sharp turns, while the inner 12 handle ordinary line following; serial Kp adjustment shortened the tuning loop."
        ],
        "image": 1,
        "evidence": "Integrated electronics",
        "note": "The wiring photograph documents the interfaces used during tuning."
      },
      {
        "id": "result",
        "label": "Validation",
        "title": "18-second lap and remaining gap",
        "paragraphs": [
          "The best recorded lap was 18 seconds, demonstrating an integrated robot while missing the under-15-second goal.",
          "The next iteration needs more course speed while retaining reliable corner detection. Separately, 100 N chassis FEA predicts 1.29 mm deformation; that structural result does not establish track performance."
        ],
        "detailParagraphs": [
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
        "Result",
        "Gantry and actuators built in 2.5 days; continuous operation overheated the stepper lead-screw actuator."
      ],
      [
        "Status",
        "Hackathon prototype; continuous dispensing is not claimed without a revised actuator and a repeat run."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Six-base fragrance dispensing",
        "paragraphs": [
          "Smelly combines a gantry and pipette to dispense mixtures from intensity settings for six fragrance bases. The 2.5-day hackathon required time for printing, assembly, and complete-machine testing.",
          "I owned the gantry and linear actuators; teammates integrated software and dispensing. Mechanical packaging and actuator motion had to support their integration."
        ],
        "detailParagraphs": [
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
        "title": "Actuator choice and print schedule",
        "paragraphs": [
          "Motion-critical fits took priority when comparing stepper lead-screw and rack-and-pinion concepts. The actuator had to meet motion and packaging needs within the sprint’s printing, assembly, and debugging time.",
          "Formlabs Form 4 resin printing supported detailed parts; Bambu Lab P1S FDM printing enabled quick iterations before integration."
        ],
        "detailParagraphs": [
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
        "title": "Pipette positioning and motor current",
        "paragraphs": [
          "The printed gantry indexed the pipette between fragrance bases. A Raspberry Pi and touch screen provided the interface, with USB serial linking the Pi and Arduino.",
          "Debugging DRV8824 current control and tuning its limit connected the electrical settings to the actuator’s actual force and heat during operation."
        ],
        "detailParagraphs": [
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
        "title": "Actuator overheating and duty cycle",
        "paragraphs": [
          "Sustained operation overheated the stepper lead-screw actuator, exposing a duty-cycle limit after the mechanism met its immediate motion and packaging needs.",
          "Runtime, current setting, and heat removal must therefore join force and stroke in the next selection. Continuous dispensing needs repeat testing of a revised configuration before overheating is resolved."
        ],
        "detailParagraphs": [
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
        "Individual project — solo build covering walnut-body preparation, ShopBot machining, drilling fixtures, finishing, and electronics installation."
      ],
      [
        "Result",
        "Raw walnut to instrument: glued blank, ShopBot-routed pockets, and template-checked drilling after CNC."
      ],
      [
        "Status",
        "Complete: strung and playable, with working Fender Deluxe Drive pickups, controls, and output jack."
      ]
    ],
    chapters: [
      {
        "id": "material",
        "label": "Requirements",
        "title": "Walnut glue-up and stock cost",
        "paragraphs": [
          "Smaller walnut pieces made the guitar body more economical than a single large blank. Titebond III and overnight clamping prepared the glue-up for machining.",
          "That material route traded lower stock cost for preparation and waiting time, while keeping the objective of a playable instrument built from raw materials."
        ],
        "detailParagraphs": [
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
        "title": "Body routing and wiring access",
        "paragraphs": [
          "ShopBot toolpaths cut the body outline, electronics pocket, and wiring channels. Hold-down planning kept the blank controlled while preserving access for those cuts.",
          "Pre-drilled wiring paths and pocket checks came before sanding and finishing, establishing the interfaces needed for later electronics installation while the body remained accessible."
        ],
        "detailParagraphs": [
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
        "title": "Templates for drilling and fit",
        "paragraphs": [
          "Laser-cut templates transferred planned hole locations into hand-drilling operations and checked pocket geometry after CNC machining.",
          "Templates reduced dependence on hand measurements. Checking interfaces before the finish kept fit problems accessible during fabrication and connected assembly features to the body geometry."
        ],
        "detailParagraphs": [
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
        "title": "Finish and playable instrument",
        "paragraphs": [
          "The completed guitar is strung and playable, with Fender Deluxe Drive pickups, working controls, and an output jack.",
          "Surface preparation, drying, and repeated white coats took more than a week in a temporary paint setup. Electronics installation followed finishing, completing the sequence from walnut glue-up to a functioning instrument."
        ],
        "detailParagraphs": [
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
        "My role",
        "Individual project — kit hardware, instructions, cost exploration, and student/parent/educator research."
      ],
      [
        "Result",
        "About $80 prototype build cost against a roughly $100 goal; two 15-year-olds assembled the body in about 45 minutes."
      ],
      [
        "Status",
        "Prototype tested in small user trials; broader classroom trials are needed for repeatable timing."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Kit cost and preparation time",
        "paragraphs": [
          "The documented prototype cost about $80 against a roughly $100 goal, with 3–5 hours of preparation. This established an early affordability check while exposing the labor needed to deliver each kit.",
          "The intended students are in middle and high school. Sound, durability, engineering learning, and classroom feasibility shape the assembly experience."
        ],
        "detailParagraphs": [
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
        "title": "Coded assembly and preadjustment",
        "paragraphs": [
          "Letter-coded screws, color-coded solderless wiring, and preassembled shielding reduce unfamiliar operations. Preadjusted neck, bridge, and pickups support playability after assembly.",
          "Those choices make the first build more approachable but move work into preparation. The remaining design question is which student tasks provide useful learning and which mainly add frustration or setup risk."
        ],
        "detailParagraphs": [
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
        "title": "Age-group trials and classroom timing",
        "paragraphs": [
          "Two 15-year-olds assembled the body in about 45 minutes and found the challenge appropriate. A later school test required roughly 30 more minutes for guided stringing.",
          "Two 8-year-olds enjoyed customization but wanted clearer tool and setup guidance and found some wiring intimidating. Body assembly time alone therefore does not describe the full classroom activity."
        ],
        "detailParagraphs": [
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
        "title": "Feedback and next classroom trials",
        "paragraphs": [
          "Feedback favored a STEAM building experience, prioritizing clearer instructions, less intimidating wiring, appropriate challenge, and durability.",
          "Interest interviews were positive for 10 of 14 parents and 7 of 8 children. These small exploratory groups guide the next design questions; broader classroom trials are needed to assess repeatable timing and usability."
        ],
        "detailParagraphs": [
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
        "Senior Mechanical Engineer, Pioneer Robotics FTC Team 12589 (2022–2023); contributed to intake, extension, lift, deposit, and drive."
      ],
      [
        "Result",
        "Team result: Massachusetts Championship Tournament Winning Alliance, plus Motivate and Gracious Professionalism awards."
      ],
      [
        "Status",
        "Built and competed through the 2022–2023 season."
      ]
    ],
    chapters: [
      {
        "id": "constraint",
        "label": "Requirements",
        "title": "Cone handoffs and subsystem scope",
        "paragraphs": [
          "Intake, transfer, lift, and deposit had to hand cones between mechanisms repeatedly while remaining serviceable during the 2022–2023 season.",
          "As Senior Mechanical Engineer on Pioneer Robotics FTC Team 12589, I contributed to the linkage extension, claw and arm intake, string-driven slide, rotational deposit, and mecanum drivetrain."
        ],
        "detailParagraphs": [
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
        "title": "Linkage reach and scoring sequence",
        "paragraphs": [
          "Linkage extension reduced unnecessary autonomous chassis travel. The claw and arm collect and transfer the cone, a string-driven slide provides height, and rotational deposit completes placement.",
          "Moving positioning work into these mechanisms makes handoff geometry and timing part of the complete scoring sequence, alongside drivetrain motion."
        ],
        "detailParagraphs": [
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
        "title": "Mecanum drive and position feedback",
        "paragraphs": [
          "Belt-driven mecanum wheels provide field maneuverability, while odometry and encoders add autonomous position feedback beyond dead reckoning.",
          "Driver practice and repeated competition cycles shaped the assembly alongside access for quick repairs. Integration had to support robot movement and maintenance of the mechanisms used throughout the scoring sequence."
        ],
        "detailParagraphs": [
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
        "title": "Team season results",
        "paragraphs": [
          "The team earned Massachusetts Championship Tournament Winning Alliance, plus Motivate and Gracious Professionalism awards. These outcomes reflect the combined robot, controls, drivers, and team effort.",
          "The season developed mechanism iteration and integration skills later used in Formula SAE. Mechanism-specific reliability or cycle-time claims would require measurements separate from the championship result."
        ],
        "detailParagraphs": [
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
