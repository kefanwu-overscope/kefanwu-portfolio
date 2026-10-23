/* Additional component and test records; source references are kept in the local review package. */
window.caseStudySupplements = {
  "lineFollower": {
    "gallery": [
      {
        "src": "assets/editorial/line-follower-sensor-8mm.png",
        "alt": "Front and back of the wider-pitch QTRX reflectance sensor array pictured in the project's sensor comparison",
        "caption": "8 mm sensor pitch"
      }
    ],
    "media": {
      "assets/editorial/line-follower-sensor-8mm.png": {
        "kind": "photo",
        "width": 600,
        "height": 480
      }
    },
    "chapterImages": {
      "tuning": {
        "src": "assets/editorial/line-follower-sensor-8mm.png",
        "evidence": "8 mm sensor pitch",
        "note": "The wider-pitch reflectance array shown in the project's sensor comparison. Front and back views."
      }
    },
    "sections": [
      {
        "id": "lineFollower-documented-run",
        "title": "Recorded track performance",
        "items": [
          {
            "id": "lineFollower-best-recorded-lap",
            "label": "Best recorded lap",
            "value": "18 s on the Spa-Francorchamps-inspired track; the original under-15-second target was not reached."
          }
        ]
      },
      {
        "id": "lineFollower-sensor-development",
        "title": "Sensor development",
        "items": [
          {
            "id": "lineFollower-sensing-arrangement",
            "label": "Sensing arrangement",
            "value": "14 reflectance channels, arranged as two seven-sensor arrays."
          },
          {
            "id": "lineFollower-mounting-height",
            "label": "Mounting height",
            "value": "Sensors set 6 mm above the floor during development."
          },
          {
            "id": "lineFollower-pitch-comparison",
            "label": "Pitch comparison",
            "value": "4 mm sensor spacing was tested first; 8 mm spacing was then selected to increase the usable line-detection range in sharp turns."
          }
        ]
      },
      {
        "id": "lineFollower-power-revision",
        "title": "Power and mass revision",
        "items": [
          {
            "id": "lineFollower-motor-drivers",
            "label": "Motor drivers",
            "value": "Two TB9051FTG DC PWM motor drivers."
          },
          {
            "id": "lineFollower-battery-change",
            "label": "Battery change",
            "value": "Replaced a 12 V, 3000 mAh Li-ion battery (157 g) with an 11.4 V, 450 mAh LiHV battery (37.85 g)."
          },
          {
            "id": "lineFollower-whole-robot-mass",
            "label": "Whole-robot mass",
            "value": "428 g → 284 g, a documented 33.6% reduction after the battery and chassis redesign."
          }
        ]
      },
      {
        "id": "lineFollower-fabrication-record",
        "title": "Fabrication and analysis",
        "items": [
          {
            "id": "lineFollower-printed-materials",
            "label": "Printed materials",
            "value": "PETG-HF chassis and TPU-85A wheels."
          },
          {
            "id": "lineFollower-chassis-fea",
            "label": "Chassis FEA",
            "value": "The report gives 1.29 mm deformation under a 100 N load on one side of the chassis. This is a simulation result, not a physical crash qualification."
          }
        ]
      },
      {
        "id": "lineFollower-controller-revision",
        "title": "Controller and logging",
        "items": [
          {
            "id": "lineFollower-successful-control-strategy",
            "label": "Successful control strategy",
            "value": "The successful run used an off-center feedback controller with separate base and steering speed settings. A serial command adjusted Kp without uploading the program again."
          },
          {
            "id": "lineFollower-sharp-turn-detection",
            "label": "Sharp-turn detection",
            "value": "The two outermost sensors detect sharp turns; the other 12 support normal line following and help reject false triggers."
          }
        ]
      }
    ]
  },
  "scanner": {
    "sections": [
      {
        "id": "scanner-hardware",
        "title": "Hardware specifications",
        "items": [
          {
            "id": "SC-01",
            "label": "Gantry transmission",
            "value": "Two 235 mm M8 lead screws on Y; a NEMA 17 24B motor and 2GT belt on X."
          },
          {
            "id": "SC-02",
            "label": "Retained pan / tilt",
            "value": "Two MG996R servos retained for wide-range, lower-precision scanning."
          },
          {
            "id": "SC-03",
            "label": "Power and cooling",
            "value": "LRS-150-12 supply and two TL-9015 PWM cooling fans."
          },
          {
            "id": "SC-04",
            "label": "Driver protection",
            "value": "Three DRV8825 drivers, each with a 100 µF VMOT capacitor; one 15 A fuse before the E-stop and three 2 A branch fuses."
          }
        ]
      },
      {
        "id": "scanner-acquisition",
        "title": "Acquisition and reconstruction",
        "items": [
          {
            "id": "SC-05",
            "label": "Data timing",
            "value": "115,200-baud sensor UART; coordinate packets sent at 100 ms intervals."
          },
          {
            "id": "SC-06",
            "label": "Surface reconstruction",
            "value": "Cubic interpolation onto a 300 × 300 grid, followed by a Gaussian filter with σ = 2.0 grid samples in the archived Python script."
          }
        ]
      }
    ]
  },
  "javelin": {
    "bom": {
      "dateLabel": "Project procurement record · April 2026",
      "description": "35 procurement line items covering the airframe, electronics, consumables and ground equipment. The three propeller types serve low-speed testing, everyday operation and top-speed attempts. Quantities reproduce the original BOM; pack sizes and fitted quantities are not recorded.",
      "caption": "33 entries marked ordered; two have no order status. Propellers for different operating conditions and ground equipment are included.",
      "rows": [
        {
          "id": "javelin-bom-02",
          "component": "Skyzone Cobra SD",
          "note": "FPV Goggles · Ground equipment",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-03",
          "component": "5.2x6.0E B4",
          "note": "Propellers · Propulsion",
          "quantity": "3",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-04",
          "component": "B5x5E B4",
          "note": "Propellers · Propulsion",
          "quantity": "3",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-05",
          "component": "RadioMaster Boxer ELRS",
          "note": "Controller · Ground equipment",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-06",
          "component": "Rush Tank Max Solo 1.6w",
          "note": "Video Transmitter · Onboard video and antennas",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-07",
          "component": "T-Motor F90 KV1300",
          "note": "Motors · Propulsion",
          "quantity": "4",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-08",
          "component": "Mateksys M10Q-5883",
          "note": "GPS Module · Flight control and navigation",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-09",
          "component": "Holybro Remote ID",
          "note": "Compliance · Flight control and navigation",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-10",
          "component": "Foxeer Reaper 80A F4 128k",
          "note": "ESC · Propulsion",
          "quantity": "4",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-11",
          "component": "Mateksys ASPD-4525",
          "note": "Airspeed Sensor · Flight control and navigation",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-12",
          "component": "CADDX Ant",
          "note": "Camera · Onboard video and antennas",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-13",
          "component": "Mateksys H743-WING V3",
          "note": "Flight Controller · Flight control and navigation",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-14",
          "component": "RadioMaster RP3",
          "note": "Receiver · Flight control and navigation",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-15",
          "component": "CNHL 4S 14.8v LiPO 130c",
          "note": "Battery · Power and wiring",
          "quantity": "2",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-16",
          "component": "3*1.5*240mm CF Tube",
          "note": "Structure · Structure, hardware and consumables",
          "quantity": "8",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-17",
          "component": "1000uF 50V Rubycon Low ESR",
          "note": "Capacitor · Power and wiring",
          "quantity": "6",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-18",
          "component": "XT90S Connector",
          "note": "Connector · Power and wiring",
          "quantity": "5",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-19",
          "component": "Ruthex M3x5.7 Heat Insert",
          "note": "Heat insert · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-20",
          "component": "Grade 12.9 M3 Bolts",
          "note": "M3 Bolt · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-21",
          "component": "10 AWG Gauge Silicone Wire",
          "note": "HV Wire · Power and wiring",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-22",
          "component": "Loctite Epoxy Instant Mix",
          "note": "Epoxy · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-23",
          "component": "M3 Vibration Damper",
          "note": "Damper · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-24",
          "component": "M3 Nylon Lock nut",
          "note": "Nut · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-25",
          "component": "Permatex 82180 Ultra Black Maximum",
          "note": "Camera Sealant · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-26",
          "component": "ISDT 608PD Lipo Battery Charger",
          "note": "Charger · Ground equipment",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-27",
          "component": "M5 Motor Propeller Cup Nut",
          "note": "Motor cup nut · Propulsion",
          "quantity": "4",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-28",
          "component": "5.25*8e B4",
          "note": "Propellers · Propulsion",
          "quantity": "2",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-29",
          "component": "FOXEER Lollipop 4",
          "note": "Antenna · Onboard video and antennas",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-30",
          "component": "FOXEER Echo 2",
          "note": "Antenna · Onboard video and antennas",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-31",
          "component": "Heat Tape",
          "note": "Heat Tape · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-32",
          "component": "4inch MMCX to SMA",
          "note": "MMCX to SMA · Onboard video and antennas",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-33",
          "component": "22 Gauge Shielded Wire",
          "note": "Shield Wire · Power and wiring",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-34",
          "component": "Bambulab PC-FR",
          "note": "PC-FR · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Ordered"
        },
        {
          "id": "javelin-bom-35",
          "component": "JB Weld 50139",
          "note": "Nylon Bonder · Structure, hardware and consumables",
          "quantity": "1",
          "status": "Not recorded"
        },
        {
          "id": "javelin-bom-36",
          "component": "18650 7.2v 2600mah",
          "note": "Controller battery · Ground equipment",
          "quantity": "1",
          "status": "Not recorded"
        }
      ]
    },
    "sections": [
      {
        "id": "javelin-packaging-requirements",
        "title": "Packaging record · April 2026",
        "items": [
          {
            "id": "javelin-pitot-extension",
            "label": "Pitot clearance",
            "value": "The requirement matrix marks a 30 mm pitot extension beyond the airframe as met."
          },
          {
            "id": "javelin-thermal-separation",
            "label": "Thermal packaging",
            "value": "Motor thermal barriers and separate ESC / VTX placement are marked as met in the matrix."
          },
          {
            "id": "javelin-receiver-layout",
            "label": "Receiver arrangement",
            "value": "A perpendicular receiver arrangement is marked as met in the matrix."
          }
        ]
      },
      {
        "id": "javelin-requirement-status",
        "title": "Requirements review · April 2026",
        "items": [
          {
            "id": "javelin-requirement-count",
            "label": "Matrix coverage",
            "value": "26 populated requirements: 23 marked met and three left unmet in the April 2026 record."
          },
          {
            "id": "javelin-unmet-requirements",
            "label": "Open items in that record",
            "value": "NACA ducts for ESC / VTX cooling, ArduPlane ecosystem control, and a stressed-skin composite wing remain unchecked."
          }
        ]
      },
      {
        "id": "javelin-propeller-study",
        "title": "Propellers by operating condition",
        "items": [
          {
            "id": "javelin-prop-use-cases",
            "label": "Three operating conditions",
            "value": "Low-speed testing, everyday operation and top-speed attempts use different propellers."
          },
          {
            "id": "javelin-prop-matlab",
            "label": "MATLAB selection study",
            "value": "Prop_Analysis.mlx screens 10 candidate propellers using estimated motor RPM, geometric pitch speed with 10% assumed slip, RPM limits and helical tip Mach."
          },
          {
            "id": "javelin-prop-study-assumptions",
            "label": "Study configuration",
            "value": "The script assumes 1300 KV, 8S voltage (29.6 V nominal / 33.6 V full) and a 0.85 loaded-RPM factor. It is a preliminary selection study, distinct from the parallel-4S configuration in the build record; its estimates are not measured flight performance."
          }
        ]
      }
    ]
  },
  "steering": {
    "sections": [
      {
        "id": "steering-documented-components",
        "title": "Components specified in the Mk.8 draft BOM",
        "items": [
          {
            "id": "steering-quick-release",
            "label": "Quick release",
            "value": "Strange Q1000, as listed in the Mk.8 draft BOM."
          },
          {
            "id": "steering-u-joint-interface",
            "label": "Universal-joint interface",
            "value": "Two universal joints, each with 3/4-inch–20 spline connections at both ends, specified in the draft BOM."
          },
          {
            "id": "steering-bearing-model",
            "label": "Column bearing specification",
            "value": "Shielded R12 ball bearings for a 3/4-inch shaft are listed in the draft BOM."
          }
        ]
      },
      {
        "id": "steering-column-dimensions-and-model",
        "title": "Documented column dimensions and model assumptions",
        "items": [
          {
            "id": "steering-shaft-dimensions",
            "label": "Shaft geometry",
            "value": "The Mk.8 design presentation retains a 0.53-inch bore and 0.75-inch outside diameter, with shaft lengths of 5.5 and 6.75 inches."
          },
          {
            "id": "steering-misalignment-study",
            "label": "Misalignment sensitivity",
            "value": "With 3° of misalignment and 3° of yoke phasing assumed, the presentation reports a maximum speed ratio of 1.032 and elastic torsion of 0.065°."
          }
        ]
      },
      {
        "id": "steering-confirmed-build",
        "title": "Final steering hardware",
        "items": [
          {
            "id": "steering-final-fastener",
            "label": "Final fastener size",
            "value": "M4."
          },
          {
            "id": "steering-rack-length",
            "label": "NARRco eye-to-eye distance",
            "value": "17.4 in, measured between the heim-joint attachment bolts."
          },
          {
            "id": "steering-rack-speed",
            "label": "NARRco rack speed",
            "value": "4.0 in of rack travel per pinion revolution (4.0 in/rev)."
          }
        ]
      }
    ]
  },
  "vineRobot": {
    "sections": [
      {
        "id": "vineRobot-experiment-levels",
        "title": "Deformation experiment settings",
        "items": [
          {
            "id": "vineRobot-pressure-levels",
            "label": "Pressure levels",
            "value": "3.4, 6.9 and 10.3 kPa (0.5, 1.0 and 1.5 psi) define the three experimental pressure settings; 1.5 psi is the maximum working pressure."
          },
          {
            "id": "vineRobot-load-levels",
            "label": "Load levels",
            "value": "The loaded conditions target scale readings corresponding to 98.1 and 196.2 N (10 and 20 kg)."
          },
          {
            "id": "vineRobot-load-control",
            "label": "Load-setting tolerance",
            "value": "The procedure adjusts the applied weight until the scale reading is within ±0.05 kg of the target."
          }
        ]
      },
      {
        "id": "vineRobot-contact-and-regulation",
        "title": "Contact fixtures and pressure regulation",
        "items": [
          {
            "id": "vineRobot-contact-fixtures",
            "label": "Contact geometry",
            "value": "Flat contact uses an 86.4 × 86.4 × 325 mm pine block; curved contact uses a PVC pipe with 114.3 mm outside diameter."
          },
          {
            "id": "vineRobot-second-regulator",
            "label": "Fine pressure regulation",
            "value": "The second stage is a NITRA precision regulator with a documented 0–207 kPa range."
          }
        ]
      }
    ]
  },
  "brakeSim": {
    "media": {
      "assets/brake-dr-20261005/slide32-image1.png": {
        "kind": "cad",
        "width": 545,
        "height": 540
      },
      "assets/brake-figures-20261005/energy-balance.png": {
        "kind": "diagram",
        "width": 1003,
        "height": 133
      },
      "assets/brake-dr-20261005/slide32-image3.png": {
        "kind": "plot",
        "width": 1600,
        "height": 762
      },
      "assets/brake-figures-20261005/fatigue-damage.png": {
        "kind": "plot",
        "width": 1600,
        "height": 810
      },
      "assets/brake-dr-20261005/slide32-image2.png": {
        "kind": "cad",
        "width": 527,
        "height": 506
      },
      "assets/brake-dr-20261005/slide31-image1.png": {
        "kind": "plot",
        "width": 952,
        "height": 671
      },
      "assets/brake-figures-20261005/stress-von-mises.png": {
        "kind": "plot",
        "width": 764,
        "height": 521
      },
      "assets/brake-figures-20261005/displacement.png": {
        "kind": "plot",
        "width": 705,
        "height": 512
      },
      "assets/brake-figures-20261005/fatigue-life.png": {
        "kind": "plot",
        "width": 1600,
        "height": 789
      }
    },
    "sections": [
      {
        "id": "brakeSim-documented-model-inputs",
        "title": "Thermal-model scope in the design review",
        "items": [
          {
            "id": "brakeSim-duty-cycle",
            "label": "Duty cycle",
            "value": "The design-review result covers 22 simulated laps, with the first three laps excluded from the working-temperature assessment."
          },
          {
            "id": "brakeSim-energy-partition",
            "label": "Heat input and losses",
            "value": "Separate rotor, paired-pad, hub and caliper nodes store heat. Braking power enters the network; speed-dependent convection, radiation evaluated in kelvin and finite conductive links between components remove or redistribute it."
          },
          {
            "id": "brakeSim-model-assumptions",
            "label": "Simplifications",
            "value": "On/off braking with no trail braking, no aerodynamic drag and no regenerative braking. The driving model uses a point-mass cornering calculation with an assumed downforce contribution."
          },
          {
            "id": "brakeSim-result-configuration",
            "label": "Published plot inputs",
            "value": "The DR 32 chart identifies 295 kg including driver and aero, no regenerative braking, 72/28 front/rear brake heat, rotor emissivity 0.32, 72 holes of 0.400 in and a 2.99 mm shallow wave. These are the labels of the published result."
          },
          {
            "id": "brakeSim-validation-scope",
            "label": "Cooling comparison",
            "value": "The review cites Luis Alberto Mora, Design of a FSAE Braking System (MIT, June 2018). It compares radiation and conduction against cooling-curve behavior and explicitly excludes convection from that validation."
          },
          {
            "id": "brakeSim-model-version",
            "label": "Track and geometry versions",
            "value": "The DR method slide states 25 track segments; the saved MATLAB implementation contains 26. The published thermal history uses a 4.7498 mm rotor thickness; the displayed native CAD uses 5.08 mm, matching the DR’s 0.2 in specification. The review’s temperature and mass results have not been recalculated from the displayed CAD. The DR text omits linear-speed effects; the saved implementation combines vehicle and rotor-edge speed for effective airflow. These version-dependent boundary assumptions are not experimentally calibrated."
          }
        ]
      },
      {
        "id": "brakeSim-hardware-context",
        "title": "Hardware selected in the design review",
        "items": [
          {
            "id": "brakeSim-calipers-pads",
            "label": "Calipers and pads",
            "value": "Wilwood GP200 calipers: two new and two planned for rebuilding. Wilwood BP28 pads."
          },
          {
            "id": "brakeSim-hydraulic-selection",
            "label": "Hydraulic hardware",
            "value": "Tilton 78-625 master cylinder with a ⅝ in bore, Tilton 77-262 bias bar and Autobahn 88 AN3 quick-disconnect coupler."
          },
          {
            "id": "brakeSim-rotor-material",
            "label": "Rotor material",
            "value": "ASTM A48 Class 40 cast iron. The design review specifies a 3.75 in radius and 0.2 in thickness; the displayed native CAD has a 190.5 mm outer diameter and 5.08 mm thickness."
          },
          {
            "id": "brakeSim-sensing-retention",
            "label": "Sensing and retention",
            "value": "GS1005 wheel-speed sensor with a stated 3 mm minimum gap; RCV FSAE brake-rotor pins and snap rings."
          }
        ]
      },
      {
        "id": "brakeSim-design-results",
        "title": "Design comparison and thermal prediction",
        "items": [
          {
            "id": "brakeSim-design-comparison",
            "label": "Mk.7 → Mk.8",
            "value": "DR design comparison: mass 1.39 → 1.07 lb (−23%); rotational inertia 11.55 → 9.35 lb·in² (−19%)."
          },
          {
            "id": "brakeSim-temperature-result",
            "label": "Front-rotor working range",
            "value": "DR prediction: 90.75% of time at 350–450°C after three warm-up laps, against an 80% target."
          }
        ]
      },
      {
        "id": "brakeSim-analysis-results",
        "title": "Reported structural and fatigue results",
        "items": [
          {
            "id": "brakeSim-structural-loads",
            "label": "Structural load case",
            "value": "14.93 kN pad force calculated from a 2 kN pedal force; 1,517.96 N·m brake torque; 450°C; stated minimum tensile strength 276 MPa."
          },
          {
            "id": "brakeSim-fea-results",
            "label": "Reported FEA result",
            "value": "Factor of safety 2.455 and maximum deformation 0.52 mm. The displayed stress plot has a 1.124 × 10⁹ Pa von Mises maximum. The review does not establish the failure criterion needed to reconcile that plot with the stated factor of safety; independent verification remains open."
          },
          {
            "id": "brakeSim-fatigue-results",
            "label": "Reference fatigue result",
            "value": "Maximum reference damage: 53.95%. Minimum reference equivalent life: 5.561 × 22 km endurances. The review separately sets a goal above three endurances (66 laps); its 22-lap thermal history spans 27.72 km. These block definitions must not be treated as an independently verified fatigue pass or measured service life."
          }
        ]
      },
      {
        "id": "brakeSim-fabrication-next-steps",
        "title": "Fabrication and integration next steps",
        "items": [
          {
            "id": "brakeSim-fabrication",
            "label": "Rotor and calipers",
            "value": "Waterjet the rotor, surface-grind the friction faces and rebuild the retained calipers."
          },
          {
            "id": "brakeSim-brake-lines",
            "label": "Brake-line reuse",
            "value": "Inspect Mk.6 components for reuse and consider CAD routing of the brake lines."
          },
          {
            "id": "brakeSim-rear-cooling",
            "label": "Rear thermal behavior",
            "value": "The design review identifies cold rear rotors and asks the aerodynamics team to consider reducing rear airflow. This remains an integration question."
          }
        ]
      }
    ]
  },
  "seat": {
    "sections": [
      {
        "id": "seat-confirmed-build",
        "title": "Confirmed design and fabrication scope",
        "items": [
          {
            "id": "seat-vehicle",
            "label": "Vehicle",
            "value": "Mk.7 Formula SAE car."
          },
          {
            "id": "seat-responsibility",
            "label": "My responsibility",
            "value": "Design and fabrication of the driver seat."
          }
        ]
      }
    ]
  },
  "materialTest": {
    "sections": [
      {
        "id": "materialTest-instrument-and-fitting",
        "title": "Load measurement and fitting windows",
        "items": [
          {
            "id": "materialTest-load-transducer",
            "label": "Load transducer",
            "value": "The Instron 3345 setup used an Instron 2519-17 force transducer."
          },
          {
            "id": "materialTest-fabric-fit-window",
            "label": "Fabric fit window",
            "value": "Fabric modulus was fitted over the documented 0–20% engineering-strain interval."
          },
          {
            "id": "materialTest-ldpe-fit-window",
            "label": "LDPE fit window",
            "value": "LDPE modulus was fitted over the documented 0–7% engineering-strain interval."
          }
        ]
      },
      {
        "id": "materialTest-confirmed-build",
        "title": "Bamboo specimen geometry",
        "items": [
          {
            "id": "materialTest-bamboo-diameter",
            "label": "Measured bamboo diameter",
            "value": "5.79–6.33 mm diameter."
          }
        ]
      }
    ]
  },
  "ansysCfd": {
    "sections": [
      {
        "id": "ansysCfd-original-teaching-case",
        "title": "Original teaching-case configuration",
        "items": [
          {
            "id": "ansysCfd-flow-configuration",
            "label": "Flow configuration",
            "value": "The original teaching script sets α = 3°, zero sideslip, a freestream temperature of 288.16 K and an operating pressure of 101,325 Pa."
          },
          {
            "id": "ansysCfd-geometry-scope",
            "label": "Geometry scope",
            "value": "The source case represents an eight-body aero-core subset of the 54-body model and excludes the propeller."
          },
          {
            "id": "ansysCfd-solver-execution",
            "label": "Solver execution",
            "value": "The reference launcher uses double precision and a four-processor configuration, with the GUI disabled."
          }
        ]
      }
    ]
  },
  "aura": {
    "sections": [
      {
        "id": "aura-power-hardware",
        "title": "Documented power hardware",
        "items": [
          {
            "id": "aura-motor-driver",
            "label": "Motor driver",
            "value": "The project report identifies the drive controller as PN00218-CYT14, rated there at 30 A continuous and 80 A peak."
          },
          {
            "id": "aura-battery-capacity",
            "label": "Battery capacity",
            "value": "24 V, 25 Ah LiFePO4 battery."
          }
        ]
      },
      {
        "id": "aura-steering-tradeoff",
        "title": "Steering tradeoff",
        "items": [
          {
            "id": "aura-stepper-torque",
            "label": "Stepper torque",
            "value": "NEMA 23 steering steppers specified at 2.4 N·m."
          },
          {
            "id": "aura-documented-limitation",
            "label": "Documented limitation",
            "value": "Increasing the step setting from 200 to 1600 reduced chain skipping but slowed steering. The team identified DC steering motors with absolute encoders as a future redesign."
          }
        ]
      },
      {
        "id": "aura-team-system-context",
        "title": "Team system context",
        "items": [
          {
            "id": "aura-compute-and-vision",
            "label": "Compute and vision",
            "value": "Raspberry Pi 4B (8 GB) running ROS 2 and OpenCV, with an Intel RealSense depth camera. The exact camera model is not specified."
          },
          {
            "id": "aura-manual-input",
            "label": "Manual input",
            "value": "Logitech F310 controller with bumper-held command interlocks."
          }
        ]
      },
      {
        "id": "aura-confirmed-build",
        "title": "Target and tested build",
        "items": [
          {
            "id": "aura-initial-payload",
            "label": "Initial payload target",
            "value": "200 lb."
          },
          {
            "id": "aura-tested-payload",
            "label": "Tested payload",
            "value": "300 lb, exceeding the initial target."
          },
          {
            "id": "aura-drive-model",
            "label": "Drive motor",
            "value": "MY1016Z."
          }
        ]
      }
    ]
  },
  "pool": {
    "sections": [
      {
        "id": "pool-cue-fabrication",
        "title": "Cue and cue-base fabrication",
        "items": [
          {
            "id": "pool-contribution",
            "label": "Contribution",
            "value": "The final presentation attributes the pool cue and cue-base work to Kefan."
          },
          {
            "id": "pool-machining-process",
            "label": "Machining process",
            "value": "The cue-base used a conversational mill to make its intricate geometry; maintaining a consistent cue diameter was a fabrication challenge."
          }
        ]
      },
      {
        "id": "pool-loading-detail",
        "title": "Loading mechanism detail",
        "items": [
          {
            "id": "pool-rack-support",
            "label": "Rack support",
            "value": "The rack connects to a bottom slider for stability while pulling the cue against surgical-tubing tension."
          }
        ]
      }
    ]
  },
  "formlabs": {
    "sections": [
      {
        "id": "formlabs-scent-interface",
        "title": "Fragrance interface",
        "items": [
          {
            "id": "formlabs-input-levels",
            "label": "Input levels",
            "value": "Six fragrance choices, each presented with an intensity setting from 0 to 5."
          },
          {
            "id": "formlabs-dispensing-architecture",
            "label": "Dispensing architecture",
            "value": "Gantry plus pipette, with a Raspberry Pi and touch screen for the interface."
          }
        ]
      },
      {
        "id": "formlabs-electrical-integration",
        "title": "Electrical integration",
        "items": [
          {
            "id": "formlabs-stepper-driver-tuning",
            "label": "Stepper-driver tuning",
            "value": "The team’s final presentation records current-control debugging on a DRV8824 and tuning its current limit."
          },
          {
            "id": "formlabs-controller-link",
            "label": "Controller link",
            "value": "USB serial connected the Raspberry Pi and Arduino."
          }
        ]
      }
    ]
  },
  "education": {
    "sections": [
      {
        "id": "education-kit-hardware",
        "title": "Kit hardware",
        "items": [
          {
            "id": "education-pickup-selection",
            "label": "Pickup selection",
            "value": "Two pickups and a three-way pickup-selector switch."
          }
        ]
      },
      {
        "id": "education-prototype-cost",
        "title": "Prototype cost and preparation",
        "items": [
          {
            "id": "education-reported-build-cost",
            "label": "Reported build cost",
            "value": "Approximately $80 and 3–5 hours to prepare a functional guitar assembly kit in the documented cost test."
          }
        ]
      },
      {
        "id": "education-interest-research",
        "title": "Early interest research",
        "items": [
          {
            "id": "education-parent-interviews",
            "label": "Parent interviews",
            "value": "10 of 14 interviewed Olin parents expressed interest in the guitar-building offering."
          },
          {
            "id": "education-children-s-concept-response",
            "label": "Children’s concept response",
            "value": "7 of 8 children shown the CAD model and activity poster expressed interest in building a guitar."
          }
        ]
      },
      {
        "id": "education-assembly-scope",
        "title": "Assembly and setup",
        "items": [
          {
            "id": "education-stringing-time",
            "label": "Stringing time",
            "value": "A later school test reported approximately 30 additional minutes to string the guitar with guidance, after body assembly."
          }
        ]
      }
    ]
  },
  "carbonSeat": {
    "sections": [
      {
        "id": "carbonSeat-confirmed-build",
        "title": "Materials and layup",
        "items": [
          {
            "id": "carbonSeat-resin",
            "label": "Resin",
            "value": "Easy Composites EL2 epoxy laminating resin."
          },
          {
            "id": "carbonSeat-main-layup",
            "label": "Main layup",
            "value": "20 plies of 3K, 200 g/m² twill carbon cloth."
          },
          {
            "id": "carbonSeat-local-reinforcement",
            "label": "Local reinforcement",
            "value": "Another 5–10 plies of small carbon-cloth patches in local areas, rather than across the entire shell."
          }
        ]
      }
    ]
  },
  "telecaster": {
    "sections": [
      {
        "id": "telecaster-confirmed-build",
        "title": "Body and electronics",
        "items": [
          {
            "id": "telecaster-body-material",
            "label": "Body material",
            "value": "Walnut."
          },
          {
            "id": "telecaster-pickups",
            "label": "Pickups",
            "value": "Fender Deluxe Drive."
          }
        ]
      }
    ]
  }
};
