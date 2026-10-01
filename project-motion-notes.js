/**
 * Reading points on the existing 0–1 motion timeline, shared by both case pages.
 * Engineering context: case-study-data.js, project-data.js and supplements.
 * Motion source: assets/studio-motion/index.json -> source.motionReport.
 *
 * Steering uses the bilateral runtime's neutral/extreme reading holds; gantries peak at .5.
 * Pool holds .64–.72 and releases .72–.84; tensile rupture starts at .74.
 * AURA/FTC/Education use their manifest stage order. Continuous growth, heat,
 * cloth placement, flow and turntable notes are inspection points, not tests.
 */
export const projectMotionNotes = {
  steering: {
    title: 'Both directions, one linkage',
    summary: 'Turn through both directions and follow the same input, joints and rack back to centre.',
    note: 'Illustrative ±90° steering cycle. Rack travel is not a calibrated displacement test.',
    steps: [
      { at: 0, title: 'Start at the wheel', body: 'The column starts at neutral. Fixed bearing supports locate the rotating shafts and keep the steering path anchored to the chassis.', side:'right' },
      { at: .08, title: 'One input starts the motion', body: 'The steering wheel turns with the upper shaft. Watch that rotation pass into the first universal joint, while its support stays in place.', side:'right' },
      { at: .22, title: 'Follow the angled shafts', body: 'At the first 90° turn, the motion pauses. The two joints carry rotation through the angled column; the lower shaft drives the rack in one direction.', side:'left' },
      { at: .32, title: 'Back through the centre', body: 'The wheel and rack return to neutral. The fixed bearing cages make it easier to see which components rotate and which provide support.', side:'right' },
      { at: .54, title: 'Now turn the other way', body: 'Reversing the wheel reverses the coupled shafts and rack. The linkage follows the same path through the two joints without rotating the mounting structure.', side:'left' },
      { at: .68, title: 'A second 90° turn', body: 'The opposite steering extreme holds for a closer look. Follow the lower shaft and tie-rod ends to see how a rotary input becomes rack travel.', side:'right' },
      { at: .78, title: 'Return to neutral', body: 'All moving parts return to their starting pose. Scroll back to retrace either direction, or explore the assembly freely from another angle.', side:'left' }
    ]
  },
  vineRobot: {
    title: 'Growth at the tip',
    summary: 'Watch the soft tube emerge from the vessel while the outlet hardware stays in place.',
    note: 'Qualitative eversion illustration. Tube shape, sag and travel do not represent a measured pressure or growth experiment.',
    steps: [
      { at: 0, title: 'A fixed outlet', body: 'The side outlet locates the vine where it leaves the pressure vessel. Its wide flange reinforces the cut wall, while interchangeable converters accommodate different vine bodies.' },
      { at: 0.2, title: 'Material turns outward', body: 'The rounded tip rolls outward as the tube lengthens. This illustrates eversion: new outer surface appears at the advancing end while the vessel and outlet remain stationary.' },
      { at: 0.5, title: 'Follow the inner return', body: 'The translucent wall reveals an inner return running back toward the vessel. Together, the inner tube and rolling tip make the material path through eversion visible.' },
      { at: 0.82, title: 'Reach beyond the vessel', body: 'The extended tube shows how a compact base can deploy a soft body. The slight sag makes its flexible form readable; the project’s force and shape measurements are documented below.' }
    ]
  },
  javelin: {
    title: 'Four rotors, one airframe',
    summary: 'Inspect the propulsion layout as the complete airframe moves through an illustrative flight pose.',
    note: 'Presentation motion only. Rotor speed, attitude changes and floating position are not measured flight data or a solved trajectory.',
    steps: [
      { at: 0, title: 'Propulsion around the body', body: 'Four motor and propeller groups surround the central airframe. Their placement supports the intended differential-thrust control concept, with no moving control surfaces.' },
      { at: 0.22, title: 'The airframe banks', body: 'The propellers spin on their hub axes while the entire aircraft gently banks. Motor mounts, wings, and fairings move together, preserving the assembled propulsion layout.' },
      { at: 0.5, title: 'Structure stays connected', body: 'As the bank passes through level, follow the continuous relationship between the motor mounts and airframe. The display illustrates packaging rather than a transition maneuver.' },
      { at: 0.8, title: 'Returning to the start pose', body: 'The airframe rolls back toward its initial attitude while the rotors keep turning. Flight tuning and measured performance remain separate milestones from this completed CAD package.' }
    ]
  },
  scanner: {
    title: 'Position before measurement',
    summary: 'Trace the two coordinated motions that place the LiDAR carriage within the scanning frame.',
    note: 'The displayed out-and-back stroke illustrates the mechanism. It is not the recorded raster scan, programmed travel or scan speed.',
    steps: [
      { at: 0, title: 'A stable coordinate frame', body: 'The base and vertical guides establish a fixed reference for the moving gantry. Each distance reading needs a known sensor position before it can become part of a surface reconstruction.' },
      { at: 0.2, title: 'The gantry carries the rails', body: 'The horizontal rail pair rises along the vertical guides. The complete carriage moves with it, so vertical motion changes the height of the sensor’s whole traverse path.' },
      { at: 0.5, title: 'The carriage crosses the span', body: 'At the farthest displayed position, the carriage has moved both across the horizontal rails and upward with the gantry. Together, these motions locate the sensor in two coordinates.' },
      { at: 0.8, title: 'Retrace the same coordinates', body: 'The carriage and gantry return along their guides. The project pairs carriage position with calibrated LiDAR readings; the resulting measured scan and reconstruction appear below.' }
    ]
  },
  brakeSim: {
    title: 'Seeing the heat-storage tradeoff',
    summary: 'Use the warming rotor to connect material, geometry and the thermal sizing study.',
    note: 'The red glow is qualitative. It is not a temperature map, calibrated color scale or playback of the MATLAB thermal solution.',
    steps: [
      { at: 0, title: 'The intact rotor', body: 'Start with the complete metal geometry. Rotor mass stores braking energy as heat, while exposed surfaces provide paths for cooling; removing material changes both sides of that balance.' },
      { at: 0.25, title: 'Heat enters the system', body: 'The surface begins to warm visually. In the documented model, braking work supplies the heat input, divided between the rotor and pad according to the study’s stated assumptions.' },
      { at: 0.55, title: 'Cooling competes with heating', body: 'As the glow grows, inspect the rotor’s exposed area. The thermal study accounts for hub conduction, radiation, and speed-dependent convection between braking events.' },
      { at: 0.84, title: 'A visual cue, a separate calculation', body: 'The brightest pose emphasizes heat buildup while the rotor remains intact. Use the archived plots for predicted temperatures; the final 7.4 in hardware needs its own thermal validation.' }
    ]
  },
  aura: {
    title: 'Inside a swerve module',
    summary: 'Separate the motors, bearing stack and mount to understand how drive and steering share one wheel.',
    note: 'Exploded assembly inspection. The wheel, axle and fork remain together; this sequence does not simulate a loaded steering maneuver.',
    steps: [
      { at: 0, title: 'Separate drive and steering', body: 'The steering motor moves away first, followed by the drive motor. Their separate roles let the module turn the wheel’s heading independently from producing traction.' },
      { at: 5 / 24, title: 'Release the bearing fasteners', body: 'Four fasteners lift out in sequence to expose the bearing stack. Their positions show how the upper assembly is retained around the central steering axis.' },
      { at: 0.375, title: 'Lift the cover', body: 'The bearing cover rises after its fasteners are clear. Watch the circular interface beneath it: this compact stack connects the steering assembly to the supported wheel module.' },
      { at: 0.5, title: 'Unpack the concentric rings', body: 'The inner, outer, and support rings separate in order. Their shared center makes the steering axis visible while the wheel, axle, and fork remain together below.' },
      { at: 0.875, title: 'Expose the mounting interface', body: 'The lower mount plate lifts with its attached fasteners. The final spread separates motor access, bearing support, and mounting hardware without pulling apart the retained wheel assembly.' }
    ]
  },
  carbonSeat: {
    title: 'Cloth follows the shell',
    summary: 'Follow illustrative cloth placements as they conform to the seat pan and upper support surfaces.',
    note: 'Ten visual placements illustrate the process. The built shell uses 20 main plies of 3K 200 g/m² twill, 5–10 local patch plies and EL2 epoxy.',
    steps: [
      { at: 0, title: 'The form beneath the cloth', body: 'The finished shell establishes the pan, back, and side-support geometry. Those connected surfaces must support the driver while fitting around the surrounding cockpit hardware.' },
      { at: 0.22, title: 'One placement at a time', body: 'A cloth surface approaches the shell and starts seating from the pan. Watch the contact region advance instead of reading the hovering surface as added laminate thickness.' },
      { at: 0.52, title: 'Conform through the curves', body: 'Each placement settles toward the upper back and follows the shell’s changes in direction. The sequence highlights access for cloth placement across the support geometry.' },
      { at: 0.82, title: 'Return to the finished surface', body: 'The remaining illustrative placements merge into the same fixed shell. The final outline stays unchanged; fabrication photographs document the actual layup, cure, and trimming.' }
    ]
  },
  seat: {
    title: 'From folded seat to sheet',
    summary: 'Unfold the connected seat to see how its perforated panels relate to one sheet-metal form.',
    note: 'Visual development of the Mk.7 CAD, with two small display-only corner reliefs. The flattened pose is not a manufacturing blank or bend-allowance specification.',
    steps: [
      { at: 0, title: 'Start with the formed seat', body: 'The perforated pan, back, and folded sides form one connected seat. The opening motion begins at the back sidewalls, revealing how the support surfaces meet along bends.' },
      { at: 0.24, title: 'Open the pan sides', body: 'The pan sidewalls open after the back sidewalls begin clearing them. Following the connected edges makes the folding relationships easier to see than an exploded set of panels.' },
      { at: 0.5, title: 'Develop the remaining bends', body: 'The broader form opens as curved bend regions straighten between rigid panels. The perforations stay with their original panels, linking the flat outline to the formed seat.' },
      { at: 0.85, title: 'Read the connected blank', body: 'The sheet approaches its flat pose and levels out. This view explains the fabrication geometry; material-specific bend allowances and production tooling require a separate manufacturing layout.' }
    ]
  },
  materialTest: {
    title: 'From grip to rupture',
    summary: 'Follow a fabric strip through extension, local narrowing and separation between the test grips.',
    note: 'Qualitative tensile illustration based on the test setup. Its deformation and rupture are not a measured stress–strain curve or fracture load.',
    steps: [
      { at: 0, title: 'Hold the specimen ends', body: 'The strip sits between coaxial grips, with the lower fixture fixed. Keeping both ends located establishes the span that is extended as the upper fixture moves.' },
      { at: 0.2, title: 'Increase the grip separation', body: 'The upper crosshead rises while the lower grip remains still. The displayed strip lengthens between them, making the imposed motion and the specimen’s response visible together.' },
      { at: 0.48, title: 'Deformation concentrates', body: 'The center of the strip narrows and an irregular separation line develops. This local shape change illustrates failure progression without assigning a measured strain or stress.' },
      { at: 0.74, title: 'The strip begins to separate', body: 'The illustrated rupture starts here. The two halves begin moving apart while their outer ends stay inside the jaws, preserving the relationship between the specimen and fixtures.' },
      { at: 0.88, title: 'Both halves remain gripped', body: 'The separated halves recoil while the upper fixture continues upward. The measured material results below come from the test records and fitted curves, separately from this display.' }
    ]
  },
  ansysCfd: {
    title: 'Read pressure and flow together',
    summary: 'Inspect the steady wall-pressure field while markers move along exported numerical flow paths.',
    note: 'A separate 400-iteration Fluent reconstruction for qualitative interpretation. Mesh quality and solver limitations prevent validated aerodynamic performance claims.',
    steps: [
      { at: 0, title: 'Pressure on the airframe', body: 'The surface colors come from the solved wall-pressure field. Blue indicates negative values and orange-red positive values on the labeled, nonlinear scale; the full pressure range is retained.' },
      { at: 0.22, title: 'Follow the moving markers', body: 'Markers travel along exported numerical paths around the simplified airframe. Their positions follow the path data, letting you connect the visible flow direction with the body geometry.' },
      { at: 0.52, title: 'A steady field, moving particles', body: 'The pressure colors stay fixed while the markers advance. These are two views of the same steady solution: a surface field and motion along the numerical flow paths.' },
      { at: 0.82, title: 'Keep the model’s scope visible', body: 'Read the patterns as qualitative airframe flow. The reconstruction omits rotor wake, and its mesh and numerical limits leave force accuracy and flight performance unresolved.' }
    ]
  },
  pool: {
    title: 'Load, hold, release',
    summary: 'Follow the cue and rack through the launcher’s illustrated pullback and forward return.',
    note: 'The chain and elastic tubing are omitted from this CAD. The motion illustrates drive coupling, not latch disengagement, stored energy or impact speed.',
    steps: [
      { at: 0, title: 'The loading path', body: 'The cue, cradle, latches, and rack begin moving together along their guide axis. The rotating pinion and sprockets show the mechanical path used to pull the cue back.' },
      { at: 0.32, title: 'Pull the cue back', body: 'The rack continues its slow retraction while the guide hardware stays fixed. In the physical launcher, surgical tubing stores energy during pullback; it is absent from this model.' },
      { at: 0.64, title: 'Hold the retracted position', body: 'The cue pauses at the end of the illustrated pullback. This brief hold separates loading from release and makes the position of the rack and supporting slider easier to inspect.' },
      { at: 0.72, title: 'Release forward', body: 'The moving cue assembly returns rapidly along the same axis. The coupled parts retrace their path; the display does not model the trigger disengaging or a ball impact.' },
      { at: 0.84, title: 'Settle at the starting position', body: 'The mechanism rests at its initial pose after the return. The fixed supports and guide axis give the loading cycle a repeatable visual reference for the next inspection.' }
    ]
  },
  lineFollower: {
    title: 'Two wheels steer the chassis',
    summary: 'Watch wheel rotation and left–right heading changes together in the assembled robot.',
    note: 'Anchored operating illustration. The display suppresses forward translation and does not replay a measured track, controller response or speed.',
    steps: [
      { at: 0, title: 'A shared drive axle', body: 'The two orange wheels rotate about their common axle while the electronics and sensor hardware stay assembled. Each wheel contributes to both forward motion and steering.' },
      { at: 0.22, title: 'Turn through wheel motion', body: 'The chassis turns toward one side as the wheel rotations differ. The display relates that difference to the heading change, making the two-wheel steering mechanism visible.' },
      { at: 0.5, title: 'Pass through straight ahead', body: 'The chassis crosses its central heading while the wheels continue rolling. On the physical robot, the reflectance arrays supply the line-position feedback used to adjust steering.' },
      { at: 0.8, title: 'Correct toward the other side', body: 'The chassis completes the opposite sway and returns toward its starting heading. The motion explains drivetrain behavior; the documented 18 s lap is a separate measured result.' }
    ]
  },
  formlabs: {
    title: 'Position the dispensing hardware',
    summary: 'Follow the Smelly gantry’s vertical lift and horizontal carriage through an out-and-back stroke.',
    note: 'Illustrative gantry motion. The stroke does not show a calibrated dispensing recipe, measured actuator speed or pipette operation.',
    steps: [
      { at: 0, title: 'The gantry defines the workspace', body: 'The fixed frame supports the guides and moving rail pair. This structure positions the dispensing hardware within the machine so recipe choices can become mechanical movements.' },
      { at: 0.2, title: 'Lead screws lift the gantry', body: 'The vertical lead screws rotate as the horizontal gantry rises. Their coupled motion shows how a turning actuator can move the rail assembly along its guides.' },
      { at: 0.5, title: 'The carriage reaches outward', body: 'At the farthest displayed position, the complete carriage has traversed the horizontal rails while rising with the gantry. Both motions contribute to locating the dispensing hardware.' },
      { at: 0.8, title: 'Return along the guides', body: 'The screws and carriage reverse as the assembly returns. In the physical build, sustained actuator operation exposed overheating, making duty cycle part of the next design decision.' }
    ]
  },
  telecaster: {
    title: 'Inspect the finished instrument',
    summary: 'Turn the complete guitar through one revolution and follow the interfaces between body, neck and hardware.',
    note: 'The guitar rotates as one rigid assembly. This view presents the completed geometry; it does not animate fabrication or string vibration.',
    steps: [
      { at: 0, title: 'The assembled guitar', body: 'The body, neck, bridge, pickups, and controls are shown in their completed relationship. The physical build began with a walnut glue-up that was prepared for CNC machining.' },
      { at: 0.25, title: 'Follow the body’s depth', body: 'A quarter-turn reveals another view of the body profile and its hardware. The machined outline and pockets established the interfaces checked before sanding and finishing.' },
      { at: 0.5, title: 'Inspect the opposite face', body: 'Halfway around, examine the body and neck from the opposite side. The rigid rotation keeps every joint together, helping relate the full instrument to its machined body geometry.' },
      { at: 0.82, title: 'Return to the playing face', body: 'As the front comes back into view, follow the bridge, pickups, and controls. The completed guitar was strung and playable, with working Fender Deluxe Drive pickups and output.' }
    ]
  },
  education: {
    title: 'Build the guitar from its parts',
    summary: 'Follow the kit’s component approach paths from the separated layout to the assembled instrument.',
    note: 'Assembly illustration with documented display clearances at the neck and pickup. These are not manufacturing tolerances or the kit’s classroom instructions.',
    steps: [
      { at: 0, title: 'Align and seat the neck', body: 'The separated kit lifts clear, then the neck turns upright and approaches its body pocket. Watch the alignment before contact to understand how the large parts establish the instrument.' },
      { at: 5 / 23, title: 'Locate the neck pickup', body: 'The neck pickup moves into alignment with its body cavity and seats. Breaking the assembly into visible approaches shows which opening each component belongs to.' },
      { at: 8 / 23, title: 'Assemble the bridge and pickup', body: 'The bridge moves into position while its pickup pieces approach from opposite sides. The coil and front plate seat before the complete bridge unit joins the body.' },
      { at: 17 / 23, title: 'Fit the pickguard', body: 'The pickguard approaches, aligns with its mounting points, and seats over the body. Its fit ties the visible surface to the components and openings already assembled beneath it.' },
      { at: 20 / 23, title: 'Seat the controls', body: 'The controls move into their final mounting position to complete the displayed assembly. In the actual kit, coded fasteners and solderless wiring help make these interfaces approachable.' }
    ]
  },
  ftc: {
    title: 'Unpack the competition robot',
    summary: 'Separate the wheel assemblies and intake to inspect their relationship to the retained chassis and lift.',
    note: 'Exploded subsystem inspection. The lift and deposit remain attached; the animation does not replay the robot’s cone-scoring cycle.',
    steps: [
      { at: 0, title: 'The first front wheel', body: 'The first front wheel assembly withdraws from the chassis. Its angled rollers identify the mecanum drivetrain used to maneuver the robot around the competition field.' },
      { at: 0.2, title: 'Open the other front corner', body: 'The opposite front wheel separates next. Keeping each wheel and its hardware together makes the drivetrain’s corner interfaces visible around the central chassis.' },
      { at: 0.4, title: 'Expose the rear drive interface', body: 'The first rear wheel moves outward while the frame and electronics remain in place. The spreading assemblies help distinguish wheel hardware from the robot’s central support structure.' },
      { at: 0.6, title: 'Complete the wheel layout', body: 'The remaining rear wheel withdraws to reveal all four drive corners. The tall lift and deposit stay attached, preserving their relationship to the supported chassis.' },
      { at: 0.8, title: 'Separate the intake', body: 'The intake assembly moves away last. Its position relative to the retained lift shows the subsystem handoff that mattered in the physical collection, transfer, and scoring sequence.' }
    ]
  }
};
