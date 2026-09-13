"""Functional motions of the original steering and Cartesian mechanism CAD.

Only object matrices change.  Connected source components, mesh attributes and
materials stay intact.  Each pose is computed from the saved source matrices,
so rendering, seeking backwards and resetting cannot accumulate transform error.
"""
import math

import numpy as np
from mathutils import Matrix, Vector


def _names(material, indices):
    return {f'mat_{material}_part_{i}' for i in indices}


def _rotation(point, axis, angle):
    return (Matrix.Translation(point) @ Matrix.Rotation(angle, 4, axis)
            @ Matrix.Translation(-point))


def _axis(part):
    """Fit the actual cylindrical shaft axis using its lateral face normals."""
    obj = part['object']
    v = np.array([obj.matrix_world @ p.co for p in obj.data.vertices])
    f = np.array([list(p.vertices) for p in obj.data.polygons])
    t = v[f]
    n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
    area = np.linalg.norm(n, axis=1)
    n /= np.maximum(area[:, None], 1e-15)
    _, axes = np.linalg.eigh(np.cov(v.T))
    axis = axes[:, -1]
    for _ in range(3):
        lateral = np.abs(n @ axis) < .15
        _, axes = np.linalg.eigh((n[lateral] * area[lateral, None]).T @ n[lateral])
        axis = axes[:, 0]
    if axis[np.argmax(np.abs(axis))] < 0:
        axis *= -1
    # These three shafts share the CAD's X datum.  Midplanes perpendicular to
    # the fitted axis locate their circular centerlines independently of mesh
    # tessellation density and of the asymmetric wheel outline.
    first = np.cross(axis, np.eye(3)[np.argmin(np.abs(axis))])
    first /= np.linalg.norm(first)
    second = np.cross(axis, first)
    point = axis * np.mean(v @ axis)
    for direction in (first, second):
        coord = v @ direction
        point += direction * ((coord.min() + coord.max()) * .5)
    return Vector(point), Vector(axis)


def _line_joint(first, second):
    p, a = map(np.array, first)
    q, b = map(np.array, second)
    parameters = np.linalg.lstsq(np.stack([a, -b], axis=1), q-p, rcond=None)[0]
    pa, pb = p+parameters[0]*a, q+parameters[1]*b
    return Vector((pa+pb)*.5), float(np.linalg.norm(pa-pb))


class MechanismMotion:
    def __init__(self, key, parts, scene):
        self.key = key
        self.parts = parts
        self.objects = [p['object'] for p in parts]
        self.base = {p['name']: p['object'].matrix_world.copy() for p in parts}
        self.lookup = {p['name']: p for p in parts}
        self.groups = {}
        self.report = {
            'project': key, 'mode': 'mechanism', 'periodic': True,
            'sourcePartCount': len(parts),
            'preservedTriangles': sum(len(o.data.polygons) for o in self.objects),
            'geometryPolicy': 'Original connected CAD meshes and material slots; object transforms only.',
            'seekPolicy': 'Absolute transforms from saved source matrices; source pose at progress 0 and 1.',
        }
        for p in parts:
            p['offset'] = Vector((0, 0, 0))
            self.groups[p['name']] = 'fixed_frame'
        if key == 'steering':
            self._steering_setup()
        elif key in ('scanner', 'formlabs'):
            self._cartesian_setup()
        else:
            raise ValueError(f'Unsupported mechanism: {key}')
        for p in parts:
            p['group'] = self.groups[p['name']]
        self.report['groups'] = {
            g: sorted(n for n, group in self.groups.items() if group == g)
            for g in sorted(set(self.groups.values()))
        }
        self.apply(0)

    def _assign(self, group, names):
        missing = names - self.lookup.keys()
        if missing:
            raise ValueError(f'{self.key} CAD component inventory changed: {sorted(missing)}')
        for name in names:
            self.groups[name] = group

    def _steering_setup(self):
        self.axes = [_axis(self.lookup[f'mat_steel_part_{i}']) for i in (13, 12, 11)]
        self.joints = [_line_joint(self.axes[0], self.axes[1]),
                       _line_joint(self.axes[1], self.axes[2])]
        self.cos_bends = [self.axes[i][1].dot(self.axes[i+1][1]) for i in (0, 1)]
        self._assign('wheel_and_upper_shaft', _names('steel', [0, 1, 2, 6, 9, 13]) | _names('printed', [10]))
        self._assign('middle_shaft_and_yokes', _names('steel', [3, 4, 7, 10, 12]))
        self._assign('lower_shaft_and_yoke', _names('steel', [5, 8, 11]))
        self._assign('rack_and_tie_rod_ends', _names('steel', [23, 24, 25, 26, 27]))
        self.wheel_amplitude = math.radians(32)
        self.rack_amplitude = .10
        self.report.update({
            'motion': 'Steering wheel, three individually coaxial shaft segments and both pairs of universal-joint yokes drive the horizontal rack.',
            'shaftAxes': [{'point': list(p), 'direction': list(a)} for p, a in self.axes],
            'universalJoints': [{'center': list(p), 'axisLineResidual': error,
                                 'bendDegrees': math.degrees(math.acos(c))}
                                for (p, error), c in zip(self.joints, self.cos_bends)],
            'wheelRangeDegrees': [-32, 0], 'rackRange': [-.10, 0],
            'directionChoice': 'The clockwise-and-return stroke releases the source upper-yoke overlap. The opposite stroke was rejected because it deepened that pre-existing CAD interference.',
            'limitations': 'The supplied CAD omits separate universal-joint cross pins and internal rack teeth. The source yokes remain intact; Cardan phase coupling and rack travel illustrate their function, without claiming a calibrated steering ratio.',
        })

    def _cartesian_setup(self):
        if self.key == 'scanner':
            gantry = (_names('steel', [2, 3, 4, 5, 8, 10, 11, 13, 14, 15, 16, 17])
                      | _names('brass', [0, 1]) | _names('dark', [3]))
            carriage = (_names('printed', [6, 7, 10]) | _names('steel', [6, 7])
                        | _names('dark', [4, 5, 6, 7, 8, *range(11, 27)]))
            self.z_stroke = .22
            self.x_stroke = .68
            self.guide_names = _names('steel', [0, 1, 9, 12])
            self.carriage_rails = _names('steel', [10, 11])
        else:
            gantry = (_names('printed_white', [3, 5, 6]) | _names('plastic_black', [0])
                      | _names('steel', [0, 1, 7, 8, 10, 11, 25, 26, 27, 28, 29, 30]))
            carriage = (_names('printed_white', [2, 4, 9]) | _names('plastic_black', [3, 4])
                        | _names('steel', [2, 3]))
            self.z_stroke = .18
            self.x_stroke = -.50
            self.guide_names = _names('steel', [6, 14])
            self.carriage_rails = _names('steel', [25, 26])
            self._assign('right_leadscrew_and_coupling', _names('steel', [4, 15, 16, 17, 18, 19]))
            self._assign('left_leadscrew_and_coupling', _names('steel', [5, 20, 21, 22, 23, 24]))
            self.screw_axes = [self.lookup[f'mat_steel_part_{i}']['center'].copy() for i in (15, 20)]
            # Four-start periodicity and axial pitch measured directly from
            # the staged source helix; these are normalized scene distances.
            self.screw_lead = 4 * .010566037735849
            self.report['leadscrew'] = {
                'sourceHelixStarts': 4, 'stagedAxialPitch': self.screw_lead / 4,
                'stagedLeadPerTurn': self.screw_lead,
                'calibration': 'Four-start helical periodicity and axial pitch recovered from the staged source screw surface; normalized scene distances.',
            }
        self._assign('gantry', gantry)
        self._assign('carriage', carriage)
        horizontal = [_axis(self.lookup[n])[1] for n in sorted(self.carriage_rails)]
        vertical = [_axis(self.lookup[n])[1] for n in sorted(self.guide_names)]
        self.horizontal = sum(horizontal, Vector()).normalized()
        self.vertical = sum(vertical, Vector()).normalized()
        self.report.update({
            'motion': 'Horizontal gantry rises on its vertical guide rods while the complete tool carriage travels along the two horizontal rails, then both return.',
            'gantryAxis': list(self.vertical), 'carriageAxis': list(self.horizontal),
            'gantryTravel': [0, self.z_stroke], 'carriageTravel': [0, self.x_stroke],
            'fixedVerticalGuides': sorted(self.guide_names),
            'movingHorizontalRails': sorted(self.carriage_rails),
            'limitations': 'A conservative demonstration stroke within the modeled rail travel; it does not specify programmed machine travel, speed or tool operation.',
        })

    def apply(self, progress):
        progress = min(1., max(0., float(progress)))
        # Explicit endpoints also make reverse/reset bit-identical.
        if progress == 0 or progress == 1:
            for p in self.parts:
                p['object'].matrix_world = self.base[p['name']].copy()
            self.pose = {'progress': progress, 'wheelRadians': 0., 'rack': 0., 'x': 0., 'z': 0.}
            return
        if self.key == 'steering':
            wheel = -self.wheel_amplitude * math.sin(math.pi * progress) ** 2
            middle = math.atan2(math.sin(wheel), self.cos_bends[0] * math.cos(wheel))
            lower = math.atan2(math.sin(middle), self.cos_bends[1] * math.cos(middle))
            lower_limit = math.atan2(math.sin(self.wheel_amplitude),
                                    self.cos_bends[0] * self.cos_bends[1] * math.cos(self.wheel_amplitude))
            rack = self.rack_amplitude * lower / lower_limit
            transforms = {name: _rotation(*axis, angle) for name, axis, angle in zip(
                ('wheel_and_upper_shaft', 'middle_shaft_and_yokes', 'lower_shaft_and_yoke'),
                self.axes, (wheel, middle, lower))}
            transforms['rack_and_tie_rod_ends'] = Matrix.Translation((rack, 0, 0))
            self.pose = {'progress': progress, 'wheelRadians': wheel,
                         'middleRadians': middle, 'lowerRadians': lower, 'rack': rack}
        else:
            excursion = math.sin(math.pi * progress) ** 2
            z, x = self.z_stroke * excursion, self.x_stroke * excursion
            transforms = {'gantry': Matrix.Translation(self.vertical * z),
                          'carriage': Matrix.Translation(self.horizontal * x + self.vertical * z)}
            if self.key == 'formlabs':
                angle = -2 * math.pi * z / self.screw_lead
                for name, point in zip(('right_leadscrew_and_coupling', 'left_leadscrew_and_coupling'), self.screw_axes):
                    transforms[name] = _rotation(point, Vector((0, 0, 1)), angle)
            self.pose = {'progress': progress, 'x': x, 'z': z}
        for p in self.parts:
            transform = transforms.get(self.groups[p['name']])
            p['object'].matrix_world = (transform @ self.base[p['name']] if transform is not None
                                       else self.base[p['name']].copy())


def build_mechanism(key, parts, scene):
    return MechanismMotion(key, parts, scene)
