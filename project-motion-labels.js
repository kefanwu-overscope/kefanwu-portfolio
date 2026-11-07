/**
 * Compact component labels, indexed one-for-one with projectMotionNotes steps.
 * Timing remains owned by project-motion-notes.js; this catalog changes no poses.
 * Targets use exact names/groups from the index-selected studio-motion manifests.
 * Details follow project-data.js, case-study-supplements.js and source motion reports.
 * Unified rotor, seat, carbon-shell and specimen meshes share a component target.
 * The static rotor and carbon shell also name one documented feature per step:
 * point is in the part's source coordinates (live camera) and framePoint is the
 * same point in the landscape detail frames, both from the source export camera.
 * The scanner rail's point names an open span on its axis, because the vertex
 * nearest its centre sits inside the blue end mount; the rail moves, so its
 * frame positions come from the per-frame anchors, not a fixed framePoint.
 * Drawn callouts (2026-10-28): every stage's point was checked by casting a ray
 * at it on 9 frames of its phase; where another part covered the vertex nearest
 * a part's centre (the wheel hub over the steering wheel, the sensor board over
 * the battery, the pickguard over the guitar body, ...), the target names a
 * point on the part's visible surface. The detail frames read the same points,
 * re-baked per frame in assets/detail-callouts-20261028/anchors.<hash>.json
 * (provenance.json there). Two stages have no point visible on every frame:
 * ftc's left rear wheel is behind the chassis until it withdraws, and the
 * guitar starts the bridge pickup stage edge-on.
 */
export const projectMotionLabels = {
  steering: [
    { title: 'Carbon steering wheel', body: 'Driver input travels through column to rack.', target: { name: 'mat_printed_part_10', point: [0.211, 1.2429, 2.2308] } },
    { title: 'Upper shaft', body: 'Wheel and upper shaft share rotational input.', target: { name: 'mat_steel_part_13', point: [0.0652, 0.6387, 2.1753] } },
    { title: 'Angled column', body: 'Two 27.5° bends transmit column rotation.', target: { group: 'middle_shaft_and_yokes' } },
    { title: 'Column bearing cage', body: 'Fixed cage locates the rotating lower shaft.', target: { name: 'mat_printed_part_2' } },
    { title: 'Lower shaft', body: 'Column rotation couples to the rack mechanism.', target: { name: 'mat_steel_part_11' } },
    { title: 'Rack and tie rods', body: 'Rack travel transfers input to wheel linkages.', target: { group: 'rack_and_tie_rod_ends' } },
    { title: 'Steering wheel', body: 'Returns to the source neutral pose.', target: { name: 'mat_printed_part_10', point: [0.1411, 1.1798, 2.5273] } }
  ],
  vineRobot: [
    { title: 'Side outlet', body: 'Reinforced flange locates the vine outlet.', target: { name: 'mat_aero_part_5', point: [-1.1896, -0.3398, 1.3899] } },
    { title: 'Everting tube', body: 'Rolling tip turns the membrane outward.', target: { name: 'Functional vine — growing outer wall, rolling tip, inner retu' } },
    // The tube body a third of the way out, not its rolling tip (the stage before).
    { title: 'Inner return', body: 'Translucency reveals the returning membrane.', target: { name: 'Functional vine — growing outer wall, rolling tip, inner retu', point: [-2.0104, -0.2925, 1.3403] } },
    { title: 'Pressure vessel', body: 'Vessel houses stored membrane and internal spool.', target: { name: 'mat_glass_part_0' } }
  ],
  javelin: [
    { title: 'Propeller', body: 'Four propellers; intended differential-thrust control.', target: { name: 'mat_propeller_part_0' } },
    { title: 'NACA 0008 wing', body: 'Thin symmetric sections connect motors and airframe.', target: { name: 'JavelinSTL Javelin_V1 - Wing_Assem-3 NACA0008_Wing-1' } },
    { title: 'Nosecone', body: 'Ogive shell with forward sensor openings.', target: { name: 'JavelinSTL Javelin_V1 - Nosecone-3' } },
    { title: 'Tailcone', body: 'Tapered shell around the aft interfaces.', target: { name: 'JavelinSTL Javelin_V1 - Tailcone-1', point: [1.0966, -0.0106, 0.9659] } }
  ],
  scanner: [
    { title: 'Vertical guide', body: 'Fixed guide defines gantry travel direction.', target: { name: 'mat_steel_part_0' } },
    { title: 'Horizontal rail', body: 'Rising rail supports horizontal carriage travel.', target: { name: 'mat_steel_part_10', point: [0.55, -0.1875, 1.2277] } },
    { title: 'LiDAR carriage', body: 'Two coordinated axes locate each distance reading.', target: { group: 'carriage' } },
    { title: 'Rigid base', body: 'Base supports guides beneath the moving assembly.', target: { name: 'mat_wood_part_0', point: [0.3123, -0.2891, 0.0709] } }
  ],
  brakeSim: [
    {
      "title": "Cast-iron rotor",
      "body": "Cast iron stores braking energy as heat.",
      "target": {
        "name": "mat_steel",
        "point": [0.0373, 0.8973, 1.8734]
      },
      "framePoint": { "x": 0.67656, "y": 0.35129 }
    },
    {
      "title": "Heat input",
      "body": "Braking converts kinetic energy into rotor heat.",
      "target": {
        "name": "mat_steel",
        "point": [0.0373, -1.1356, 1.4193]
      },
      "framePoint": { "x": 0.28125, "y": 0.53279 }
    },
    {
      "title": "Cooling paths",
      "body": "Conduction, convection and radiation cool the rotor.",
      "target": {
        "name": "mat_steel",
        "point": [0.0373, 0.0496, 2.7621]
      },
      "framePoint": { "x": 0.51172, "y": 0.11475 }
    },
    {
      "title": "Thermal illustration",
      "body": "Color is illustrative; temperatures come from plots.",
      "target": {
        "name": "mat_steel",
        "point": [0.0373, -0.2356, 0.3927]
      },
      "framePoint": { "x": 0.45625, "y": 0.80796 }
    }
  ],
  aura: [
    { title: 'Steering motor', body: 'Wheel heading controlled independently from traction.', target: { group: 'steering_motor' } },
    { title: 'Bearing fastener', body: 'Four fasteners retain the upper bearing assembly.', target: { name: 'mat_steel_part_11' } },
    { title: 'Bearing cover', body: 'Closes the compact steering bearing stack.', target: { name: 'mat_paint_gray_part_3' } },
    // The ring's centre-nearest vertex falls in its bore; this point sits on the front of the ring face.
    { title: 'Inner bearing ring', body: 'Concentric rings define the steering axis.', target: { name: 'mat_steel_part_7', point: [0.0266, -0.0097, 1.6557] } },
    { title: 'Lower mount plate', body: 'Module mount below the bearing stack.', target: { name: 'mat_paint_gray_part_4', point: [-0.0803, -0.3979, 1.4095] } }
  ],
  carbonSeat: [
    // Side wall, seat pan, upper-back curve, then the shell's centre anchor.
    { title: 'Carbon shell', body: 'Continuous shell joins pan, back and sides.', target: { name: 'mat_carbon', point: [0.6084, 1.0357, 1.8946] }, framePoint: { x: 0.625, y: 0.38642 } },
    { title: 'Twill reinforcement', body: '20 main plies; 3K 200 g/m² twill.', target: { name: 'mat_carbon', point: [-0.3825, -0.1058, 0.3925] }, framePoint: { x: 0.46094, y: 0.65574 } },
    { title: 'Curved support surface', body: 'Cloth follows curves from pan to back.', target: { name: 'mat_carbon', point: [-0.813, 1.0298, 2.0291] }, framePoint: { x: 0.48438, y: 0.31616 } },
    { title: 'Epoxy laminate', body: 'EL2 resin binds cloth; local patches reinforce.', target: { name: 'mat_carbon', point: [-0.0039, 0.4752, 1.0096] }, framePoint: { x: 0.53203, y: 0.53747 } }
  ],
  seat: [
    { title: 'Perforated seat', body: 'Pan, back and folded sides.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Seat shell', body: 'Connected edges join the sides to pan and back.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Continuous surface', body: 'Curved joins keep panels and perforations connected.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Flat outline', body: 'Illustrative flat view of the connected geometry.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } }
  ],
  materialTest: [
    { title: 'Lower grip', body: 'Fixed grip retains the lower specimen end.', target: { name: 'MaterialTest_grip_top_bridge.001', point: [-0.0377, -0.2561, 1.059] } },
    { title: 'Upper coupling', body: 'Upper fixture rises, increasing grip separation.', target: { name: 'MaterialTest_upper_coupling' } },
    { title: 'Fabric specimen', body: 'Illustrated local narrowing between retained ends.', target: { name: 'Functional tensile specimen — two retained fracture halves' } },
    { title: 'Rupture region', body: 'Illustrated rupture; no measured fracture load.', target: { name: 'Functional tensile specimen — two retained fracture halves' } },
    { title: 'Retained specimen ends', body: 'Outer ends remain gripped after illustrated separation.', target: { name: 'Functional tensile specimen — two retained fracture halves' } }
  ],
  ansysCfd: [
    { title: 'Wall pressure', body: 'Solved pressure field across the airframe surface.', target: { name: 'Actual Fluent wall static pressure' } },
    // A stretch of the path in open air behind the tail, clear of the airframe.
    { title: 'Numerical flow path', body: 'Markers follow solver paths around simplified airframe.', target: { name: 'Fluent path 24', point: [2.1552, 0.1102, 1.0684] } },
    { title: 'Steady pressure field', body: 'Wall pressure stays fixed as markers advance.', target: { name: 'Actual Fluent wall static pressure' } },
    { title: 'Aero-core surface', body: 'Simplified geometry; no rotor wake; qualitative only.', target: { name: 'Actual Fluent wall static pressure' } }
  ],
  pool: [
    { title: 'Drive pinion', body: 'Pinion couples rotation to rack travel.', target: { name: 'mat_printed_part_3', point: [0.3215, 0.796, 0.393] } },
    { title: 'Toothed rack', body: 'Rack retracts with cradle and paired latches.', target: { name: 'mat_printed_part_4', point: [0.3094, 0.8863, 0.227] } },
    { title: 'Cue cradle', body: 'Cradle holds the cue along its guide.', target: { name: 'mat_printed_part_1', point: [0.2971, -0.4828, 0.2413] } },
    { title: 'Cue', body: 'Cue returns forward along the same axis.', target: { name: 'mat_wood_part_0', point: [0.3077, -1.107, 0.1713] } },
    { title: 'Fixed slider support', body: 'Fixed support locates the sliding release assembly.', target: { name: 'mat_aero_part_5', point: [0.4272, 0.1208, 0.07] } }
  ],
  lineFollower: [
    { title: 'Right drive wheel', body: 'Tire and hub rotate about the modeled axle.', target: { name: 'mat_rubber_orange_part_0' } },
    { title: 'Left drive wheel', body: 'Independent drives provide differential steering.', target: { name: 'mat_rubber_orange_part_1', point: [-0.9718, 1.3184, 0.282] } },
    { title: 'Controller board', body: 'Reflectance feedback adjusts wheel drive.', target: { name: 'mat_pcb_teal_part_0', point: [-0.1122, 0.8546, 0.6174] } },
    { title: 'Battery pack', body: 'Onboard power for electronics and drivetrain.', target: { name: 'mat_battery_wrap_part_0', point: [0.4485, 0.1324, 0.469] } }
  ],
  formlabs: [
    { title: 'Vertical guide', body: 'Fixed guide supports vertical gantry travel.', target: { name: 'mat_steel_part_14' } },
    // The threaded screw of the right lead-screw group, below the gantry that hides its top.
    { title: 'Lead screw', body: 'Rotating screw raises the guided gantry.', target: { name: 'mat_steel_part_4', point: [0.8348, 0.136, 1.3914] } },
    { title: 'Dispensing carriage', body: 'Two-axis travel positions the dispensing hardware.', target: { group: 'carriage' } },
    { title: 'Horizontal rail', body: 'Moving rail supports the returning carriage.', target: { name: 'mat_steel_part_25', point: [-0.1104, 0.0377, 1.254] } }
  ],
  telecaster: [
    { title: 'Finished guitar body', body: 'Walnut glue-up prepared for CNC machining.', target: { name: 'mat_paint_white_part_0', point: [-0.3447, -0.0422, 0.2788] } },
    { title: 'Machined body profile', body: 'Outline and pockets locate neck and hardware.', target: { name: 'mat_paint_white_part_0', point: [-0.2013, 0.0853, 0.3241] } },
    { title: 'Maple neck', body: 'Neck joins the body beneath the fingerboard.', target: { name: 'mat_maple_part_0' } },
    { title: 'Bridge pickup', body: 'Fender Deluxe Drive pickups provide instrument output.', target: { name: 'mat_plastic_black_part_1', point: [0.002, -0.0566, 0.5522] } }
  ],
  education: [
    { title: 'Neck', body: 'Neck aligns with pocket before seating.', target: { name: 'mat_maple_part_0' } },
    { title: 'Neck pickup', body: 'Pickup seats in its body cavity.', target: { name: 'mat_chrome_part_19' } },
    { title: 'Bridge assembly', body: 'Opposing pickup pieces seat before bridge installation.', target: { group: 'bridge' } },
    { title: 'Pickguard', body: 'Guard aligns over assembled body components.', target: { name: 'mat_pickguard_white_part_0' } },
    { title: 'Controls', body: 'Control assembly seats at the body mount.', target: { group: 'controls' } }
  ],
  ftc: [
    { title: 'Left front wheel', body: 'Angled mecanum rollers support field movement.', target: { name: 'FTC_mecanum_center' } },
    { title: 'Right front wheel', body: 'Wheel separates at the opposite front corner.', target: { name: 'FTC_mecanum_center.002' } },
    // The hub stays behind the chassis all phase; a roller on the wheel's outer
    // face is the first of it to clear the chassis as the wheel withdraws.
    { title: 'Left rear wheel', body: 'Withdrawal reveals the rear axle interface.', target: { name: 'FTC_mecanum_barrel.014', point: [-0.7311, 0.8626, 0.2894] } },
    { title: 'Right rear wheel', body: 'Fourth wheel completes the retained chassis layout.', target: { name: 'FTC_mecanum_center.003' } },
    { title: 'Intake jaw', body: 'Curved jaws collect cones for lift transfer.', target: { name: 'FTC_white_curved_intake_jaw' } }
  ]
};
