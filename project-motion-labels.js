/**
 * Compact component labels, indexed one-for-one with projectMotionNotes steps.
 * Timing remains owned by project-motion-notes.js; this catalog changes no poses.
 * Targets use exact names/groups from the index-selected studio-motion manifests.
 * Details follow project-data.js, case-study-supplements.js and source motion reports.
 * Unified rotor, seat, carbon-shell and specimen meshes share a component target.
 */
export const projectMotionLabels = {
  steering: [
    { title: 'Carbon steering wheel', body: 'Driver input passes through the column to the rack.', target: { name: 'mat_printed_part_10' } },
    { title: 'Upper shaft', body: 'The wheel and upper shaft transmit the same rotational input.', target: { group: 'wheel_and_upper_shaft' } },
    { title: 'Angled column', body: 'Two 27.5° joint bends carry rotation through the column.', target: { group: 'middle_shaft_and_yokes' } },
    { title: 'Column bearing cage', body: 'The fixed cage locates the rotating lower shaft.', target: { name: 'mat_printed_part_2' } },
    { title: 'Lower shaft', body: 'The lower shaft couples column rotation to the rack mechanism.', target: { group: 'lower_shaft_and_yoke' } },
    { title: 'Rack and tie rods', body: 'Rack translation transfers steering input toward the wheel linkages.', target: { group: 'rack_and_tie_rod_ends' } },
    { title: 'Steering wheel', body: 'The wheel returns to the source neutral position.', target: { name: 'mat_printed_part_10' } }
  ],
  vineRobot: [
    { title: 'Side outlet', body: 'The reinforced flange locates the vine at the vessel wall.', target: { name: 'mat_aero_part_5' } },
    { title: 'Everting tube', body: 'The rolling tip turns membrane outward as the tube extends.', target: { name: 'Functional vine — growing outer wall, rolling tip, inner retu' } },
    { title: 'Inner return', body: 'The translucent tube reveals the membrane returning toward the vessel.', target: { name: 'Functional vine — growing outer wall, rolling tip, inner retu' } },
    { title: 'Pressure vessel', body: 'The fixed vessel houses the stored membrane and internal spool.', target: { name: 'mat_glass_part_0' } }
  ],
  javelin: [
    { title: 'Propeller', body: 'Four propellers support the intended differential-thrust control layout.', target: { name: 'mat_propeller_part_0' } },
    { title: 'NACA 0008 wing', body: 'Thin symmetric sections connect the motor layout to the airframe.', target: { name: 'JavelinSTL Javelin_V1 - Wing_Assem-3 NACA0008_Wing-1' } },
    { title: 'Nosecone', body: 'The ogive nose packages the forward airframe and sensor openings.', target: { name: 'JavelinSTL Javelin_V1 - Nosecone-3' } },
    { title: 'Tailcone', body: 'The tapered rear shell closes the airframe around its aft interfaces.', target: { name: 'JavelinSTL Javelin_V1 - Tailcone-1' } }
  ],
  scanner: [
    { title: 'Vertical guide', body: 'A fixed guide establishes the gantry travel direction.', target: { name: 'mat_steel_part_0' } },
    { title: 'Horizontal rail', body: 'The rail rises with the gantry and supports carriage travel.', target: { name: 'mat_steel_part_10' } },
    { title: 'LiDAR carriage', body: 'Two coordinated axes locate each distance reading within the scanning frame.', target: { group: 'carriage' } },
    { title: 'Rigid base', body: 'The base supports the fixed guides beneath the moving assembly.', target: { name: 'mat_wood_part_0' } }
  ],
  brakeSim: [
    { title: 'Brake rotor', body: 'Rotor mass stores braking energy as heat.', target: { name: 'mat_steel' } },
    { title: 'Rotor surface', body: 'Braking work supplies heat; the displayed color change is qualitative.', target: { name: 'mat_steel' } },
    { title: 'Perforated geometry', body: 'Material removal changes rotor mass and exposed cooling area.', target: { name: 'mat_steel' } },
    { title: 'Thermal response', body: 'Conduction, convection and radiation enter the separate thermal calculation.', target: { name: 'mat_steel' } }
  ],
  aura: [
    { title: 'Steering motor', body: 'Steering changes wheel heading independently from the traction motor.', target: { group: 'steering_motor' } },
    { title: 'Bearing fastener', body: 'Four fasteners retain the upper bearing assembly.', target: { name: 'mat_steel_part_11' } },
    { title: 'Bearing cover', body: 'The cover closes the compact steering bearing stack.', target: { name: 'mat_paint_gray_part_3' } },
    { title: 'Inner bearing ring', body: 'Concentric rings define the module steering axis.', target: { name: 'mat_steel_part_7' } },
    { title: 'Lower mount plate', body: 'The plate provides the module mounting interface below the bearing stack.', target: { name: 'mat_paint_gray_part_4' } }
  ],
  carbonSeat: [
    { title: 'Carbon shell', body: 'The continuous shell connects the seat pan, back and side supports.', target: { name: 'mat_carbon' } },
    { title: 'Twill reinforcement', body: 'The build uses 20 main plies of 3K 200 g/m² twill.', target: { name: 'mat_carbon' } },
    { title: 'Curved support surface', body: 'Cloth follows the shell curves from the pan toward the upper back.', target: { name: 'mat_carbon' } },
    { title: 'Epoxy laminate', body: 'EL2 resin binds the cloth; local patches reinforce selected areas.', target: { name: 'mat_carbon' } }
  ],
  seat: [
    { title: 'Perforated aluminum seat', body: 'The Mk.7 seat combines a formed pan, back and folded sides.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Folded seat shell', body: 'Connected edges reveal how the sidewalls fold from the sheet.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Continuous sheet', body: 'Curved transitions connect the rigid panels while their perforations remain attached.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } },
    { title: 'Developed sheet', body: 'The flattened display explains geometry without specifying production bend allowances.', target: { name: 'Driver seat continuous unfolding surface with two corner relief' } }
  ],
  materialTest: [
    { title: 'Lower grip', body: 'The fixed lower fixture holds one end of the tensile span.', target: { name: 'MaterialTest_grip_top_bridge.001' } },
    { title: 'Upper coupling', body: 'The upper fixture rises to increase separation between the grips.', target: { name: 'MaterialTest_upper_coupling' } },
    { title: 'Fabric specimen', body: 'The illustrated strip narrows locally between the retained ends.', target: { name: 'Functional tensile specimen — two retained fracture halves' } },
    { title: 'Rupture region', body: 'Two retained halves illustrate separation without assigning a measured fracture load.', target: { name: 'Functional tensile specimen — two retained fracture halves' } },
    { title: 'Retained specimen ends', body: 'Both outer ends stay inside the grips after the illustrated separation.', target: { name: 'Functional tensile specimen — two retained fracture halves' } }
  ],
  ansysCfd: [
    { title: 'Wall pressure', body: 'Surface colors encode the solved pressure field across the airframe.', target: { name: 'Actual Fluent wall static pressure' } },
    { title: 'Numerical flow path', body: 'Exported solver paths carry moving markers around the simplified airframe.', target: { name: 'Fluent path 24' } },
    { title: 'Steady pressure field', body: 'Wall pressure remains fixed while numerical markers advance.', target: { name: 'Actual Fluent wall static pressure' } },
    { title: 'Aero-core surface', body: 'The simplified reconstruction excludes rotor wake and supports qualitative interpretation.', target: { name: 'Actual Fluent wall static pressure' } }
  ],
  pool: [
    { title: 'Drive pinion', body: 'The pinion couples rotary motion to the sliding rack.', target: { name: 'mat_printed_part_3' } },
    { title: 'Toothed rack', body: 'The rack retracts with the cue cradle and paired latches.', target: { name: 'mat_printed_part_4' } },
    { title: 'Cue cradle', body: 'The cradle holds the cue along its guide axis.', target: { name: 'mat_printed_part_1' } },
    { title: 'Cue', body: 'The cue returns forward along the same axis after pullback.', target: { name: 'mat_wood_part_0' } },
    { title: 'Fixed slider support', body: 'The stationary support locates the sliding release assembly.', target: { name: 'mat_aero_part_5' } }
  ],
  lineFollower: [
    { title: 'Right drive wheel', body: 'The tire and hub rotate about the modeled axle.', target: { name: 'mat_rubber_orange_part_0' } },
    { title: 'Left drive wheel', body: 'Independent wheel drive provides differential steering.', target: { name: 'mat_rubber_orange_part_1' } },
    { title: 'Controller board', body: 'The controller uses reflectance feedback to adjust wheel drive.', target: { name: 'mat_pcb_teal_part_0' } },
    { title: 'Battery pack', body: 'The onboard pack supplies the assembled robot electronics and drivetrain.', target: { name: 'mat_battery_wrap_part_0' } }
  ],
  formlabs: [
    { title: 'Vertical guide', body: 'The fixed guide supports the gantry travel direction.', target: { name: 'mat_steel_part_14' } },
    { title: 'Lead screw', body: 'Screw rotation raises the horizontal gantry along its guides.', target: { group: 'right_leadscrew_and_coupling' } },
    { title: 'Dispensing carriage', body: 'Horizontal and vertical travel position the dispensing hardware.', target: { group: 'carriage' } },
    { title: 'Horizontal rail', body: 'The rail carries the returning carriage with the moving gantry.', target: { name: 'mat_steel_part_25' } }
  ],
  telecaster: [
    { title: 'Finished guitar body', body: 'The physical body began as a walnut glue-up prepared for CNC machining.', target: { name: 'mat_paint_white_part_0' } },
    { title: 'Machined body profile', body: 'The outline and pockets establish the neck and hardware interfaces.', target: { name: 'mat_paint_white_part_0' } },
    { title: 'Maple neck', body: 'The neck joins the body beneath the fingerboard.', target: { name: 'mat_maple_part_0' } },
    { title: 'Bridge pickup', body: 'Fender Deluxe Drive pickups provide the completed instrument output.', target: { name: 'mat_plastic_black_part_1' } }
  ],
  education: [
    { title: 'Neck', body: 'The neck aligns with the body pocket before seating.', target: { name: 'mat_maple_part_0' } },
    { title: 'Neck pickup', body: 'The pickup seats in its body cavity.', target: { name: 'mat_chrome_part_19' } },
    { title: 'Bridge assembly', body: 'Pickup pieces seat from opposite sides before the bridge joins the body.', target: { group: 'bridge' } },
    { title: 'Pickguard', body: 'The guard aligns with mounting points over the assembled body components.', target: { name: 'mat_pickguard_white_part_0' } },
    { title: 'Controls', body: 'The control assembly seats at its final body mounting interface.', target: { group: 'controls' } }
  ],
  ftc: [
    { title: 'Left front wheel', body: 'Angled mecanum rollers support movement across the competition field.', target: { name: 'FTC_mecanum_center' } },
    { title: 'Right front wheel', body: 'The wheel assembly separates at the opposite front drivetrain corner.', target: { name: 'FTC_mecanum_center.002' } },
    { title: 'Left rear wheel', body: 'The rear axle interface stays visible as the wheel withdraws.', target: { name: 'FTC_mecanum_center.001' } },
    { title: 'Right rear wheel', body: 'The fourth wheel completes the drivetrain layout around the retained chassis.', target: { name: 'FTC_mecanum_center.003' } },
    { title: 'Intake jaw', body: 'The curved intake jaws collect cones before transfer toward the lift.', target: { name: 'FTC_white_curved_intake_jaw' } }
  ]
};
