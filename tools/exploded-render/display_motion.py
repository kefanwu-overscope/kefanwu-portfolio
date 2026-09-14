"""Rigid display motion for the original Javelin and Telecaster cover scenes.

The flight controller composes a bounded, qualitative airframe motion with the
existing source-hub Propellers controller. The turntable rotates the complete
assembled guitar. No source mesh, material, modifier, or parent is changed.
All poses are evaluated from saved source matrices for deterministic seeking.
"""
import math

import numpy as np
from mathutils import Matrix, Vector

from functional_processes import Propellers


def _clamp(progress):
    return min(1., max(0., float(progress)))


def _world_vertices(obj):
    vertices = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
    obj.data.vertices.foreach_get('co', vertices)
    matrix = np.asarray(obj.matrix_world, dtype=np.float64)
    return vertices.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]


class _RigidDisplay:
    def __init__(self, key, parts, scene):
        self.key, self.parts, self.scene = key, parts, scene
        self.objects = [p['object'] for p in parts]
        self.original = {o.name: o.matrix_world.copy() for o in self.objects}
        vertices = np.concatenate([_world_vertices(o) for o in self.objects])
        self.minimum, self.maximum = vertices.min(0), vertices.max(0)
        self.center = Vector((self.minimum + self.maximum) * .5)
        self.span = float(max(self.maximum - self.minimum))
        self.radius = float(np.linalg.norm(vertices - np.array(self.center), axis=1).max())
        self.report = {
            'project': key, 'mode': self.mode, 'sourcePartCount': len(parts),
            'preservedTriangles': sum(len(o.data.polygons) for o in self.objects),
            'sourceBounds': [self.minimum.tolist(), self.maximum.tolist()],
            'sourceCenter': list(self.center),
            'geometryPolicy': 'Original source meshes, material slots, modifiers and parenting retained; object matrices only.',
            'arbitrarySeek': True,
            'seekPolicy': 'Absolute source matrices at every seek; exact original matrices at progress zero.',
        }

    def _restore(self):
        for obj in self.objects:
            obj.matrix_world = self.original[obj.name].copy()


class JavelinFlight(_RigidDisplay):
    mode = 'flight'
    bank_degrees = 4.
    pitch_degrees = 1.8
    yaw_degrees = 1.2

    def __init__(self, parts, scene):
        super().__init__('javelin', parts, scene)
        self.propellers = Propellers(parts, scene)
        self.bob_maximum = self.span * .02
        rotor_names = {o.name for _, _, _, objects, _ in self.propellers.rotors for o in objects}
        fixed_names = [o.name for o in self.objects if o.name not in rotor_names]
        # Any point's vertical displacement under X/Y rotations is bounded by
        # its pivot distance times the sum of the maximum absolute angles.
        # Z yaw cannot change its height. The bob is always nonnegative.
        # Start with the old controller's full rotor disk envelope, so this
        # bound includes every rotor angle, even between sampled video frames.
        self.rotor_envelope_radius = max(
            (center - self.center).length + radius
            for center, axis, handedness, objects, radius in self.propellers.rotors)
        bounded_radius = max(self.radius, self.rotor_envelope_radius)
        tilt_radians = math.radians(self.bank_degrees + self.pitch_degrees)
        floor = min(float(self.minimum[2]), self.propellers.report['floorMinimum']) - bounded_radius * tilt_radians
        self.report.update(self.propellers.report)
        self.report.update({
            'mode': self.mode, 'periodicAirframe': True,
            'motion': 'Four propellers spin about their existing motor hub axes while the intact airframe gently banks, pitches, yaws and bobs in place.',
            'demonstration': 'Qualitative flight presentation; the source model is not a solved flight trajectory, measured attitude history or measured RPM.',
            'airframeMotion': {
                'pivot': list(self.center), 'bankAxis': [1, 0, 0],
                'pitchAxis': [0, 1, 0], 'yawAxis': [0, 0, 1],
                'bankMaximumDegrees': self.bank_degrees,
                'pitchMaximumDegrees': self.pitch_degrees,
                'yawMaximumDegrees': self.yaw_degrees,
                'bobMinimum': 0., 'bobMaximum': self.bob_maximum,
                'phaseRadians': '2*pi*progress',
                'bank': '4*sin(phase) degrees',
                'pitch': '1.8*sin(2*phase) degrees',
                'yaw': '1.2*sin(phase) degrees',
                'bob': '0.5*bobMaximum*(1-cos(phase))',
                'composition': 'T(pivot + bob*Z) Rz(yaw) Ry(pitch) Rx(bank) T(-pivot)',
                'sourceLongitudinalAxis': 'X', 'sceneVerticalAxis': 'Z',
                'allSourcePartsCarriedTogether': True,
            },
            'sourceMotorBasesFixed': False,
            'sourceMotorBasesFixedInAirframe': True,
            'fixedParts': [], 'airframeFixedParts': fixed_names,
            'floorMinimum': floor,
            'floorMinimumMethod': 'Conservative all-angle rotor disk envelope minus maximum X/Y tilt displacement; bob never lowers the airframe.',
            'presentation': {
                'groundZMaximum': floor - .10 * self.span,
                'groundPolicy': 'Lower the photographic sweep to leave visible air beneath the full motion; source CAD placement is unchanged.',
                'cameraPolicy': 'Keep the source camera position/direction; use one fixed orthographic scale fitted across all 121 poses.',
            },
            'endpointPolicy': 'Progress 0 is exactly the source pose. Progress 1 restores the source airframe attitude with the original rotor controller at 5.375 turns.',
            'originalRotorController': 'functional_processes.Propellers',
        })
        for part in parts:
            part['offset'] = Vector((0, 0, 0))
            part['group'] = 'propeller' if part['name'] in rotor_names else 'airframe'
        self.apply(0.)

    def airframe_matrix(self, progress):
        progress = _clamp(progress)
        if progress == 0. or progress == 1.:
            return Matrix.Identity(4)
        phase = math.tau * progress
        bank = math.radians(self.bank_degrees) * math.sin(phase)
        pitch = math.radians(self.pitch_degrees) * math.sin(2. * phase)
        yaw = math.radians(self.yaw_degrees) * math.sin(phase)
        bob = .5 * self.bob_maximum * (1. - math.cos(phase))
        return (Matrix.Translation(self.center + Vector((0, 0, bob)))
                @ Matrix.Rotation(yaw, 4, 'Z')
                @ Matrix.Rotation(pitch, 4, 'Y')
                @ Matrix.Rotation(bank, 4, 'X')
                @ Matrix.Translation(-self.center))

    def apply(self, progress):
        progress = _clamp(progress)
        self._restore()
        if progress != 0.:
            self.propellers.apply(progress)
            body = self.airframe_matrix(progress)
            for obj in self.objects:
                obj.matrix_world = body @ obj.matrix_world
        self.scene.frame_set(self.scene.frame_current)


class TelecasterTurntable(_RigidDisplay):
    mode = 'turntable'

    def __init__(self, parts, scene):
        super().__init__('telecaster', parts, scene)
        self.report.update({
            'motion': 'The complete assembled Telecaster makes one constant-speed 360-degree rotation about its own vertical centerline.',
            'source': 'Original approved cover scene from tools/editorial-render/sources/telecaster.glb.',
            'periodic': True, 'axis': [0, 0, 1], 'center': list(self.center),
            'turns': 1., 'angleDegrees': '360*progress',
            'assembledRigidBody': True, 'partRelativeTransformsPreserved': True,
            'floorMinimum': float(self.minimum[2]),
            'floorMinimumMethod': 'A rotation about scene Z preserves every source vertex height.',
            'fixedParts': [],
            'motionGroups': [{'name': 'assembled_guitar', 'axis': [0, 0, 1],
                              'center': list(self.center), 'parts': [o.name for o in self.objects]}],
            'endpointPolicy': 'Progress 0 and 1 both assign the exact saved source matrices; no numerical sin(2*pi) residual.',
            'presentation': {'cameraPolicy': 'Keep the source camera position/direction; use one fixed orthographic scale fitted across all 121 poses.'},
        })
        for part in parts:
            part['offset'] = Vector((0, 0, 0))
            part['group'] = 'assembled_guitar'
        self.apply(0.)

    def body_matrix(self, progress):
        progress = _clamp(progress)
        if progress == 0. or progress == 1.:
            return Matrix.Identity(4)
        return (Matrix.Translation(self.center)
                @ Matrix.Rotation(math.tau * progress, 4, 'Z')
                @ Matrix.Translation(-self.center))

    def apply(self, progress):
        progress = _clamp(progress)
        if progress == 0. or progress == 1.:
            self._restore()
        else:
            transform = self.body_matrix(progress)
            for obj in self.objects:
                obj.matrix_world = transform @ self.original[obj.name]
        self.scene.frame_set(self.scene.frame_current)


def build_display_motion(key, parts, scene):
    cls = {'javelin': JavelinFlight, 'telecaster': TelecasterTurntable}.get(key)
    if cls is None:
        raise ValueError(f'Unsupported display motion: {key}')
    return cls(parts, scene)
