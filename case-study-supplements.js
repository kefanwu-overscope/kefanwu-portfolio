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
            "value": "18 s on the team’s Spa-Francorchamps-inspired track; the original under-15-second target was not reached."
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
            "value": "The team tested 4 mm sensor spacing, then selected 8 mm spacing to increase the usable line-detection range in sharp turns."
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
            "value": "3.4, 6.9 and 10.3 kPa (0.5, 1.0 and 1.5 psi) define the three experimental pressure settings."
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
    "sections": [
      {
        "id": "brakeSim-documented-model-inputs",
        "title": "Documented thermal-model inputs",
        "items": [
          {
            "id": "brakeSim-vehicle-input",
            "label": "Vehicle input",
            "value": "The report models a 220 kg Mk.8 vehicle with a 50:50 static front/rear weight distribution."
          },
          {
            "id": "brakeSim-energy-partition",
            "label": "Energy partition",
            "value": "The model assumes 72% front brake bias and a fixed heat split of 90% to the rotor and 10% to the pads."
          },
          {
            "id": "brakeSim-time-integration",
            "label": "Time integration",
            "value": "The 28 April MATLAB version uses a nominal 0.01 s integration step and a 296.15 K initial temperature."
          }
        ]
      },
      {
        "id": "brakeSim-hardware-context",
        "title": "Hardware named in the design records",
        "items": [
          {
            "id": "brakeSim-tire-specification",
            "label": "Tire specification",
            "value": "The report identifies Hoosier FSAE 18.0×6.0-10 R20 tires as the vehicle context for brake-bias calculations."
          },
          {
            "id": "brakeSim-hydraulic-selection",
            "label": "Hydraulic hardware selection",
            "value": "The design-lock model lists Tilton 78-Series master cylinders and a 1.25-inch piston diameter for the Wilwood GP200 calipers."
          }
        ]
      },
      {
        "id": "brakeSim-confirmed-build",
        "title": "Final rotor geometry",
        "items": [
          {
            "id": "brakeSim-final-rotor-diameter",
            "label": "Final rotor diameter",
            "value": "7.4 in. This is the final hardware diameter; the historical thermal-model inputs below have not been recomputed."
          }
        ]
      }
    ]
  },
  "seat": {
    "sections": [
      {
        "id": "seat-confirmed-build",
        "title": "Confirmed fabrication scope",
        "items": [
          {
            "id": "seat-vehicle",
            "label": "Vehicle",
            "value": "Mk.7 Formula SAE car."
          },
          {
            "id": "seat-responsibility",
            "label": "My responsibility",
            "value": "Fabrication of the driver seat."
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
