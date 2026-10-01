/**
 * Compact component labels, indexed one-for-one with projectMotionNotes steps.
 * Timing remains owned by project-motion-notes.js; this catalog changes no poses.
 * Targets use exact names/groups from the index-selected studio-motion manifests.
 * Details follow project-data.js, case-study-supplements.js and source motion reports.
 * Unified rotor, seat, carbon-shell and specimen meshes share a component target.
 */
export const projectMotionLabels = {
  steering: [
    { title: 'Carbon steering wheel', body: 'Driver input travels through column to rack.', target: { name: 'mat_printed_part_10' } },
    { title: 'Upper shaft', body: 'Wheel and upper shaft share rotational input.', target: { name: 'mat_steel_part_13' } },
    { title: 'Angled column', body: 'Two 27.5° bends transmit column rotation.', target: { group: 'middle_shaft_and_yokes' } },
    { title: 'Column bearing cage', body: 'Fixed cage locates the rotating lower shaft.', target: { name: 'mat_printed_part_2' } },
    { title: 'Lower shaft', body: 'Column rotation couples to the rack mechanism.', target: { name: 'mat_steel_part_11' } },
    { title: 'Rack and tie rods', body: 'Rack travel transfers input to wheel linkages.', target: { group: 'rack_and_tie_rod_ends' } },
    { title: 'Steering wheel', body: 'Returns to the source neutral pose.', target: { name: 'mat_printed_part_10' } }
  ],
  vineRobot: [
    { title: 'Side outlet', body: 'Reinforced flange locates the vine outlet.', target: { name: 'mat_aero_part_5' } },
    { title: 'Everting tube', body: 'Rolling tip turns the membrane outward.', target: { name: 'Functional vine — growing outer wall, rolling tip, inner retu' } },
    { title: 'Inner return', body: 'Translucency reveals the returning membrane.', target: { name: 'Functional vine — growing outer wall, rolling tip, inner retu' } },
    { title: 'Pressure vessel', body: 'Vessel houses stored membrane and internal spool.', target: { name: 'mat_glass_part_0' } }
  ],
  javelin: [
    { title: 'Propeller', body: 'Four propellers; intended differential-thrust control.', target: { name: 'mat_propeller_part_0' } },
    { title: 'NACA 0008 wing', body: 'Thin symmetric sections connect motors and airframe.', target: { name: 'JavelinSTL Javelin_V1 - Wing_Assem-3 NACA0008_Wing-1' } },
    { title: 'Nosecone', body: 'Ogive shell with forward sensor openings.', target: { name: 'JavelinSTL Javelin_V1 - Nosecone-3' } },
    { title: 'Tailcone', body: 'Tapered shell around the aft interfaces.', target: { name: 'JavelinSTL Javelin_V1 - Tailcone-1' } }
  ],
  scanner: [
    { title: 'Vertical guide', body: 'Fixed guide defines gantry travel direction.', target: { name: 'mat_steel_part_0' } },
    { title: 'Horizontal rail', body: 'Rising rail supports horizontal carriage travel.', target: { name: 'mat_steel_part_10' } },
    { title: 'LiDAR carriage', body: 'Two coordinated axes locate each distance reading.', target: { group: 'carriage' } },
    { title: 'Rigid base', body: 'Base supports guides beneath the moving assembly.', target: { name: 'mat_wood_part_0' } }
  ],
  brakeSim: [
    { title: 'Brake rotor', body: 'Braking energy stored as rotor heat.', target: { name: 'mat_steel' } },
    { title: 'Rotor surface', body: 'Braking heat; displayed color change is qualitative.', target: { name: 'mat_steel' } },
    { title: 'Perforated geometry', body: 'Perforations change rotor mass and cooling area.', target: { name: 'mat_steel' } },
    { title: 'Thermal response', body: 'Separate model: conduction, convection and radiation.', target: { name: 'mat_steel' } }
  ],
  aura: [
    { title: 'Steering motor', body: 'Wheel heading controlled independently from traction.', target: { group: 'steering_motor' } },
    { title: 'Bearing fastener', body: 'Four fasteners retain the upper bearing assembly.', target: { name: 'mat_steel_part_11' } },
    { title: 'Bearing cover', body: 'Closes the compact steering bearing stack.', target: { name: 'mat_paint_gray_part_3' } },
    { title: 'Inner bearing ring', body: 'Concentric rings define the steering axis.', target: { name: 'mat_steel_part_7' } },
    { title: 'Lower mount plate', body: 'Module mount below the bearing stack.', target: { name: 'mat_paint_gray_part_4' } }
  ],
  carbonSeat: [
    { title: 'Carbon shell', body: 'Continuous shell joins pan, back and sides.', target: { name: 'mat_carbon' } },
    { title: 'Twill reinforcement', body: '20 main plies; 3K 200 g/m² twill.', target: { name: 'mat_carbon' } },
    { title: 'Curved support surface', body: 'Cloth follows curves from pan to back.', target: { name: 'mat_carbon' } },
    { title: 'Epoxy laminate', body: 'EL2 resin binds cloth; local patches reinforce.', target: { name: 'mat_carbon' } }
  ],
  seat: [
    { title: 'Perforated aluminum seat', body: 'Formed pan, back and folded sides.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Folded seat shell', body: 'Connected edges show the sidewall folds.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Continuous sheet', body: 'Curved joins keep panels and perforations connected.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Developed sheet', body: 'Illustrative flat view; bend allowances unspecified.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } }
  ],
  materialTest: [
    { title: 'Lower grip', body: 'Fixed grip retains the lower specimen end.', target: { name: 'MaterialTest_grip_top_bridge.001' } },
    { title: 'Upper coupling', body: 'Upper fixture rises, increasing grip separation.', target: { name: 'MaterialTest_upper_coupling' } },
    { title: 'Fabric specimen', body: 'Illustrated local narrowing between retained ends.', target: { name: 'Functional tensile specimen — two retained fracture halves' } },
    { title: 'Rupture region', body: 'Illustrated rupture; no measured fracture load.', target: { name: 'Functional tensile specimen — two retained fracture halves' } },
    { title: 'Retained specimen ends', body: 'Outer ends remain gripped after illustrated separation.', target: { name: 'Functional tensile specimen — two retained fracture halves' } }
  ],
  ansysCfd: [
    { title: 'Wall pressure', body: 'Solved pressure field across the airframe surface.', target: { name: 'Actual Fluent wall static pressure' } },
    { title: 'Numerical flow path', body: 'Markers follow solver paths around simplified airframe.', target: { name: 'Fluent path 24' } },
    { title: 'Steady pressure field', body: 'Wall pressure stays fixed as markers advance.', target: { name: 'Actual Fluent wall static pressure' } },
    { title: 'Aero-core surface', body: 'Simplified geometry; no rotor wake; qualitative only.', target: { name: 'Actual Fluent wall static pressure' } }
  ],
  pool: [
    { title: 'Drive pinion', body: 'Pinion couples rotation to rack travel.', target: { name: 'mat_printed_part_3' } },
    { title: 'Toothed rack', body: 'Rack retracts with cradle and paired latches.', target: { name: 'mat_printed_part_4' } },
    { title: 'Cue cradle', body: 'Cradle holds the cue along its guide.', target: { name: 'mat_printed_part_1' } },
    { title: 'Cue', body: 'Cue returns forward along the same axis.', target: { name: 'mat_wood_part_0' } },
    { title: 'Fixed slider support', body: 'Fixed support locates the sliding release assembly.', target: { name: 'mat_aero_part_5' } }
  ],
  lineFollower: [
    { title: 'Right drive wheel', body: 'Tire and hub rotate about the modeled axle.', target: { name: 'mat_rubber_orange_part_0' } },
    { title: 'Left drive wheel', body: 'Independent drives provide differential steering.', target: { name: 'mat_rubber_orange_part_1' } },
    { title: 'Controller board', body: 'Reflectance feedback adjusts wheel drive.', target: { name: 'mat_pcb_teal_part_0' } },
    { title: 'Battery pack', body: 'Onboard power for electronics and drivetrain.', target: { name: 'mat_battery_wrap_part_0' } }
  ],
  formlabs: [
    { title: 'Vertical guide', body: 'Fixed guide supports vertical gantry travel.', target: { name: 'mat_steel_part_14' } },
    { title: 'Lead screw', body: 'Rotating screw raises the guided gantry.', target: { group: 'right_leadscrew_and_coupling' } },
    { title: 'Dispensing carriage', body: 'Two-axis travel positions the dispensing hardware.', target: { group: 'carriage' } },
    { title: 'Horizontal rail', body: 'Moving rail supports the returning carriage.', target: { name: 'mat_steel_part_25' } }
  ],
  telecaster: [
    { title: 'Finished guitar body', body: 'Walnut glue-up prepared for CNC machining.', target: { name: 'mat_paint_white_part_0' } },
    { title: 'Machined body profile', body: 'Outline and pockets locate neck and hardware.', target: { name: 'mat_paint_white_part_0' } },
    { title: 'Maple neck', body: 'Neck joins the body beneath the fingerboard.', target: { name: 'mat_maple_part_0' } },
    { title: 'Bridge pickup', body: 'Fender Deluxe Drive pickups provide instrument output.', target: { name: 'mat_plastic_black_part_1' } }
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
    { title: 'Left rear wheel', body: 'Withdrawal reveals the rear axle interface.', target: { name: 'FTC_mecanum_center.001' } },
    { title: 'Right rear wheel', body: 'Fourth wheel completes the retained chassis layout.', target: { name: 'FTC_mecanum_center.003' } },
    { title: 'Intake jaw', body: 'Curved jaws collect cones for lift transfer.', target: { name: 'FTC_white_curved_intake_jaw' } }
  ]
};
