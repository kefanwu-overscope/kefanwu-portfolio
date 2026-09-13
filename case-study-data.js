/* Editorial summaries for the standalone flagship pages only.
   Full galleries and technical records continue to come from project-data.js.
   Covers are renders of the actual project models. Photographs and engineering
   plots remain untouched in the full shared project galleries. */
window.caseStudyData = {
  steering: {
    number: '01',
    title: 'Mk.8 steering.',
    label: 'Formula SAE / Design & fabrication',
    deck: 'From kinematics to installed hardware.',
    description: 'A closer wheel. A lighter column. A steering path designed around the driver—and built by hand.',
    cover: {
      src: 'assets/editorial/steering-wide.webp',
      portrait: 'assets/editorial/steering-portrait.webp',
      alt: 'Render of the Mk.8 steering assembly, with matched U-joints, bearing cages, and rack mounts',
      caption: 'The steering assembly, from rack to wheel.',
      kind: 'Project CAD render'
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
    cover: {
      src: 'assets/editorial/vineRobot-wide.webp',
      alt: 'Render of the vine robot pressure vessel with bolted lid, outlet, and reinforcement',
      caption: 'The eversion platform and its reinforcement.',
      kind: 'Project CAD render'
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
    next: 'scanner'
  },
  scanner: {
    number: '03',
    title: 'LiDAR scanner.',
    label: 'Olin PIE / Motion & measurement',
    deck: 'Turn motion into measured geometry.',
    description: 'A one-week build connecting repeatable gantry motion with calibrated distance data.',
    cover: {
      src: 'assets/editorial/scanner-wide.webp',
      alt: 'Render of the LiDAR scanner gantry, stepper motors, sensor carriage, and electronics enclosure',
      caption: 'A Cartesian gantry for repeatable sensor positioning.',
      kind: 'Project CAD render'
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
    next: 'steering'
  }
};
