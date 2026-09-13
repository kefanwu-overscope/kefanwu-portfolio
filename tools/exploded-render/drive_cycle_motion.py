"""Source-CAD Pool Sniper and line follower operating-cycle illustrations.

Absolute matrices make every pose independent of render/scroll history. Source
meshes, materials, guides and mounting interfaces are retained unmodified.
"""
import math

import numpy as np
from mathutils import Matrix, Vector

from mechanism_motion import _axis, _rotation


def _smooth(t):
    t = min(1., max(0., t))
    return t*t*(3.-2.*t)


class DriveCycleMotion:
    def __init__(self, key, parts, scene):
        self.key, self.parts = key, parts
        self.objects = [p['object'] for p in parts]
        self.lookup = {p['name']: p for p in parts}
        self.base = {p['name']: p['object'].matrix_world.copy() for p in parts}
        self.groups = {p['name']: 'fixed_frame' for p in parts}
        self.mode = {'pool': 'retract_release', 'lineFollower': 'drive_sway'}[key]
        self.report = {
            'project': key, 'mode': self.mode, 'periodic': True,
            'sourcePartCount': len(parts),
            'preservedTriangles': sum(len(o.data.polygons) for o in self.objects),
            'geometryPolicy': 'Original connected CAD meshes and material slots; object matrices only. No hidden moving components or altered guide bores.',
            'seekPolicy': 'Absolute matrices from the source assembly; exact source matrices at both endpoints.',
        }
        if key == 'pool':
            self._pool_setup()
        elif key == 'lineFollower':
            self._line_setup()
        for p in parts:
            p['offset'] = Vector((0, 0, 0))
            p['group'] = self.groups[p['name']]
        self.report['groups'] = {g: sorted(n for n in self.groups if self.groups[n] == g)
                                 for g in sorted(set(self.groups.values()))}
        self.apply(0.)

    def _assign(self, group, names):
        missing = set(names)-self.lookup.keys()
        if missing:
            raise ValueError(f'{self.key} CAD inventory changed: {sorted(missing)}')
        for name in names:
            self.groups[name] = group

    def _pool_setup(self):
        self._assign('cue_rack_and_latches', ['mat_wood_part_0', 'mat_printed_part_1',
            'mat_printed_part_4', 'mat_aero_part_1', 'mat_aero_part_2', 'mat_steel_part_11'])
        self._assign('pinion_and_driven_sprocket', ['mat_printed_part_3', 'mat_steel_part_8', 'mat_aero_part_6'])
        self._assign('motor_sprocket_and_coupling', [f'mat_steel_part_{i}' for i in [4, 5, 6, 7]])
        self.cue_axis = _axis(self.lookup['mat_wood_part_0'])
        self.retract_axis = self.cue_axis[1]
        # The 20 pinion teeth and repeated 0.0379682 rack pitch are measured
        # directly from PinionPart-1 and RackPart-1 in the staged source.
        self.pinion_teeth = 20
        rack = self.lookup['mat_printed_part_4']['object']
        verts = np.array([rack.matrix_world@v.co for v in rack.data.vertices])
        levels, counts = np.unique(np.round(verts[:, 2], 6), return_counts=True)
        tooth_top = float(max(levels[counts >= 32]))
        teeth = verts[(np.abs(verts[:, 2]-tooth_top) < 1e-6) & (verts[:, 1] > 0)]
        tips = np.unique(np.round(teeth[:, 1], 6))
        # A tooth top has finite width; start-to-start gives its pitch.
        self.rack_pitch = float(np.median(np.diff(tips[::2])))
        self.pitch_radius = self.rack_pitch*self.pinion_teeth/(2*math.pi)
        self.pinion_axis = (self.lookup['mat_printed_part_3']['center'].copy(), Vector((1, 0, 0)))
        self.motor_axis = (self.lookup['mat_steel_part_7']['center'].copy(), Vector((1, 0, 0)))
        self.stroke = .14
        self.report.update({
            'motion': 'The front silver cue, cue cradle, paired latches and toothed rack retract together along their actual guide axis, hold briefly, then rapidly release forward to the source pose.',
            'source': 'models/real/pool.glb; matching CAD parts in C:/Users/oc/Desktop/STL/Pool Sniper.',
            'sourcePartRoles': {'mat_wood_part_0': 'ReleaseMechanism - Cue-1.STL (silver cylinder; legacy wood bucket)',
                'mat_printed_part_1': 'ReleaseMechanism - Cue_Base-1.STL',
                'mat_printed_part_4': 'ReleaseMechanism - RackPart-1.STL',
                'mat_printed_part_3': 'ReleaseMechanism - PinionPart-1.STL',
                'mat_aero_part_1': 'ReleaseMechanism - Latch-1.STL / LatchR-1.STL',
                'mat_aero_part_2': 'ReleaseMechanism - LatchR-1.STL / Latch-1.STL',
                'mat_steel_part_11': 'ReleaseMechanism - LatchPin-1.STL'},
            'retractionAxis': list(self.retract_axis), 'stroke': self.stroke,
            'cueCenterline': {'point': list(self.cue_axis[0]), 'direction': list(self.cue_axis[1])},
            'pinionAxis': {'point': list(self.pinion_axis[0]), 'direction': list(self.pinion_axis[1])},
            'pinionTeeth': self.pinion_teeth, 'rackPitch': self.rack_pitch,
            'pinionPitchRadius': self.pitch_radius,
            'sprocketTeeth': {'motor': 14, 'driven': 28},
            'phases': [{'name': 'slow_retraction', 'start': 0., 'end': .64},
                {'name': 'charged_hold', 'start': .64, 'end': .72},
                {'name': 'rapid_forward_release', 'start': .72, 'end': .84},
                {'name': 'settled', 'start': .84, 'end': 1.}],
            'strokeClearance': {'firstNewSolidContactTravel': .14841720951961518,
                'obstacle': 'Slide_Place_holder: mat_aero_part_5',
                'movingPartsAtLimit': ['mat_aero_part_1', 'mat_aero_part_2'],
                'margin': .14841720951961518-self.stroke,
                'method': 'Continuous triangle intervals for the full source carriage translation against every fixed-frame part.'},
            'sourceFitLimitations': {
                'rackPinionSourceSampledOverlap': .0017342978389933705,
                'rackPinionMaximumSampledOverlap': .0022826483473181725,
                'motorCouplingSourceSampledOverlap': .0030599304009228945,
                'motorCouplingMaximumSampledOverlap': .0030810281168669462,
                'rackSupportSourceSampledOverlap': .00011713956337189302,
                'rackSupportMaximumSampledOverlap': .00011714147694874555,
                'sampling': 'All 145 final output poses; triangle BVH contacts and vertex/triangle-centroid three-ray solid depth probes. Zero newly intersecting component pairs.',
                'interpretation': 'The source gear teeth are already interfering at the fixed source axle spacing. Their changing meshing overlap is explicitly retained and is not described as collision-free gearing. No meshes, source mating surfaces, shaft centers or collision thresholds were changed to conceal it.',
            },
            'limitations': 'A conservative 0.14 scene-unit (~23.17 mm source-CAD) stroke retains the original fixed Slide_Place_holder. Both latch bodies would first enter that solid at 0.1484172, so a 0.0084172 scene-unit clearance is retained. Source simplified gear-tooth engagement and axial mating contacts remain modeled contacts. The omitted chain and elastic tubing are not synthesized. Rack/pinion and 14:28 sprocket coupling illustrate a reversible drive cycle; this is not a simulation of latch disengagement, stored energy, impact speed or motor control.',
        })

    def _line_setup(self):
        self.groups = {p['name']: 'complete_chassis' for p in self.parts}
        self._assign('right_wheel_and_hub', ['mat_rubber_orange_part_0', 'mat_steel_part_6'])
        self._assign('left_wheel_and_hub', ['mat_rubber_orange_part_1', 'mat_steel_part_7'])
        self.wheel_axes = []
        self.wheel_radii = []
        for i in (0, 1):
            p = self.lookup[f'mat_rubber_orange_part_{i}']
            point = p['center'].copy()
            # Wheel side planes and both hub centerlines are CAD X datums.
            axis = Vector((1, 0, 0))
            self.wheel_axes.append((point, axis))
            v = np.array([p['object'].matrix_world@q.co for q in p['object'].data.vertices])
            self.wheel_radii.append(float(np.max(np.linalg.norm(v[:, 1:]-np.array(point)[1:], axis=1))))
        self.axle_midpoint = (self.wheel_axes[0][0]+self.wheel_axes[1][0])*.5
        self.yaw_amplitude = math.radians(10)
        self.report.update({
            'motion': 'Both orange wheels and their metal hubs roll about their actual common X axle while the entire assembled chassis sways left and right about its axle midpoint.',
            'source': 'tools/editorial-render/sources/lineFollower.glb; original included CAD parts with separately shaded finish surfaces.',
            'wheelAxes': [{'point': list(p), 'direction': list(a), 'radius': r}
                          for (p, a), r in zip(self.wheel_axes, self.wheel_radii)],
            'yawPivot': list(self.axle_midpoint), 'yawRangeDegrees': [-10, 10],
            'nominalWheelRevolutions': 2,
            'differentialRelation': 'theta_i = -4*pi*smoothstep(progress) - (x_i-x_axle_midpoint)*yaw/wheel_radius_i.',
            'limitations': 'An anchored operating illustration: common forward wheel rotation represents travel while the display suppresses chassis translation. The differential contribution matches the signed wheel-center motion induced by the left/right yaw. No measured line trajectory, controller response, tire slip or vehicle speed is claimed.',
        })

    def apply(self, progress):
        progress = min(1., max(0., float(progress)))
        if progress in (0., 1.):
            for p in self.parts:
                p['object'].matrix_world = self.base[p['name']].copy()
            self.pose = {'progress': progress, 'stroke': 0., 'pinionRadians': 0., 'yawRadians': 0., 'wheelRadians': [0., 0.]}
            return
        if self.key == 'pool':
            if progress < .64:
                fraction = _smooth(progress/.64)
            elif progress < .72:
                fraction = 1.
            elif progress < .84:
                fraction = 1.-_smooth((progress-.72)/.12)
            else:
                fraction = 0.
            travel = self.stroke*fraction
            angle = travel/self.pitch_radius
            transforms = {
                'cue_rack_and_latches': Matrix.Translation(self.retract_axis*travel),
                'pinion_and_driven_sprocket': _rotation(*self.pinion_axis, angle),
                'motor_sprocket_and_coupling': _rotation(*self.motor_axis, angle*2.),
            }
            self.pose = {'progress': progress, 'stroke': travel, 'pinionRadians': angle, 'motorSprocketRadians': angle*2.}
        else:
            yaw = self.yaw_amplitude*math.sin(2.*math.pi*progress)**3
            body = _rotation(self.axle_midpoint, Vector((0, 0, 1)), yaw)
            transforms = {'complete_chassis': body}
            angles = []
            for name, (point, axis), radius in zip(('right_wheel_and_hub', 'left_wheel_and_hub'), self.wheel_axes, self.wheel_radii):
                angle = -4.*math.pi*_smooth(progress)-(point.x-self.axle_midpoint.x)*yaw/radius
                angles.append(angle)
                transforms[name] = body@_rotation(point, axis, angle)
            self.pose = {'progress': progress, 'yawRadians': yaw, 'wheelRadians': angles}
        for p in self.parts:
            transform = transforms.get(self.groups[p['name']])
            p['object'].matrix_world = transform@self.base[p['name']] if transform is not None else self.base[p['name']].copy()


def build_drive_cycle(key, parts, scene):
    return DriveCycleMotion(key, parts, scene)
