"""Detailed AURA disassembly of the existing, unmodified source components.

All moving groups use the original assembly_motion.check_path. The fork,
wheel/axle, side drive and embedded hardware stay together where the source
triangles do not admit a checked independent translation. No mesh is cut,
retessellated, stretched, or repositioned in the assembled pose.
"""
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

from assembly_motion import AssemblyMotion, Geometry, check_path, geometry_digest

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[2] / '.codex/motion-refinement-20260913/aura'
VERSION = 1
FRAME_COUNT = 145
SOURCE = Path(__file__).read_bytes()

# The four top fasteners are real disconnected source components. Their
# separate timings expose the fastening sequence before the bearing layers.
RECIPES = [
    ('steering_motor', ['mat_plastic_black_part_' + str(i) for i in range(5)] +
     ['mat_steel_part_0'], (0, .7, 0), 15),
    ('drive_motor_and_finish', ['mat_paint_gray_part_1', 'mat_plastic_black_part_7',
     'mat_steel_part_21', 'mat_steel_part_22'], (0, -.7, 0), 15),
    *[('bearing_fastener_' + str(i-10), ['mat_steel_part_' + str(i)],
       (0, 0, 1.35), 6) for i in range(11, 15)],
    ('bearing_top_cover', ['mat_paint_gray_part_3'], (0, 0, 1.4), 18),
    ('bearing_inner_ring', ['mat_steel_part_7'], (0, 0, 1.1), 18),
    ('bearing_outer_ring', ['mat_steel_part_6'], (0, 0, .85), 18),
    ('bearing_support_ring', ['mat_steel_part_5'], (0, 0, .62), 18),
    ('lower_mount_plate_and_embedded_fasteners', ['mat_paint_gray_part_4'] +
     ['mat_steel_part_' + str(i) for i in (4, 15, 16, 17)], (0, 0, .33), 18),
]


def configure(parts):
    mapping = {name: group for group, names, _, _ in RECIPES for name in names}
    expected = {'mat_paint_gray_part_' + str(i) for i in range(5)}
    expected |= {'mat_plastic_black_part_' + str(i) for i in range(8)}
    expected |= {'mat_steel_part_' + str(i) for i in range(23)}
    expected.add('mat_rubber_black_part_0')
    actual = {p['name'] for p in parts}
    if actual != expected:
        raise RuntimeError('AURA source topology changed: ' + repr(actual ^ expected))
    for p in parts:
        p['group'] = mapping.get(p['name'], 'wheel_axle_fork_and_side_drive')
        p['offset'] = Vector((0, 0, 0))


def _geometries(parts):
    buckets = {}
    for p in parts:
        buckets.setdefault(p['group'], []).append(p)
    deps = bpy.context.evaluated_depsgraph_get()
    return [Geometry(n, ps, deps) for n, ps in buckets.items()]


def _source_contacts(parts):
    deps = bpy.context.evaluated_depsgraph_get()
    geometries = [Geometry(p['name'], [p], deps) for p in parts]
    contacts = []
    for i, g in enumerate(geometries):
        for h in geometries[i+1:]:
            if not g.near(h, np.zeros(3)):
                continue
            count = len(g.bvh.overlap(h.bvh))
            if count:
                contacts.append({'parts': [g.name, h.name], 'trianglePairs': count,
                                 'type': 'original source surface contact/intersection'})
    return contacts


def _plan(parts, fingerprint):
    gs = _geometries(parts)
    byname = {g.name: g for g in gs}
    stages = []
    tick = 0
    for name, _, delta, duration in RECIPES:
        moving = byname[name]
        delta = np.asarray(delta, dtype=float)
        passed, verification = check_path(moving, delta, gs, samples=97)
        if not passed:
            raise RuntimeError(('AURA strict extraction rejected', name, verification))
        moving.offset = delta
        moving.bvh = moving.tree(delta)
        stages.append({'group': name, 'translation': delta.tolist(),
                       'start': tick / 144, 'end': (tick + duration) / 144,
                       'verification': verification})
        tick += duration
        print('AURA_DETAILED_STAGE', name, flush=True)
    assert tick == 144
    return {
        'version': VERSION, 'project': 'aura', 'mode': 'assembly',
        'frameCount': FRAME_COUNT, 'geometryDigest': fingerprint,
        'geometryTriangles': sum(len(g.faces) for g in gs),
        'sourceComponentCount': len(parts), 'movingStageCount': len(stages),
        'floorMinimum': float(min(g.lo[2] for g in gs)),
        'policy': 'Sequential rigid extraction using the unchanged assembly_motion.check_path '
                  'checker: continuous triangle SAT and 100 positive sampled poses per stage. '
                  'No added seam relaxation, sliding allowance, or source geometry edit.',
        'sourceContactPolicy': 'Original contacts must begin by normalized path time 0.000001 '
                  'and withdraw within the first quarter of their stage. Baseline contact counts '
                  'and sampled solid penetration depth are bounded by the original checker. '
                  'Later-entering contacts, increasing source interference and floor crossings '
                  'are rejected.',
        'containmentPolicy': 'Bidirectional distributed vertex probes against welded watertight '
                  'source components at sampled poses complement continuous surface checking. '
                  'Open finish meshes remain surfaces; this is not a continuous volumetric '
                  'manufacturing certificate.',
        'stages': stages,
        'partGroups': {p['name']: p['group'] for p in parts},
        'retainedGroups': ['wheel_axle_fork_and_side_drive'],
        'retainedComponentReason': 'The source wheel/axle/fork, side-drive geometry and '
                  'embedded side fasteners are mechanically interlocked or intersect in the '
                  'source. Tested independent translations introduce new contacts. The lower '
                  'mount plate retains its three embedded source screws; the motor retains '
                  'its shaft fitting and contiguous finish masks.',
        'sourceGeometryChanges': [],
        'sourceSurfaceContacts': _source_contacts(parts),
        'newContinuousTriangleContacts': 0, 'floorCrossings': 0,
    }


def build_motion(parts, scene=None, *, force_rebuild=False):
    """Return an AssemblyMotion with objects/report/apply(progress) interfaces."""
    configure(parts)
    fingerprint = hashlib.sha256(geometry_digest('aura', parts).encode() + SOURCE).hexdigest()
    cache = OUT / 'motion-plan.json'
    if cache.exists() and not force_rebuild:
        report = json.loads(cache.read_text(encoding='utf-8'))
        if report.get('version') == VERSION and report.get('geometryDigest') == fingerprint:
            return AssemblyMotion('aura', parts, report)
    report = _plan(parts, fingerprint)
    OUT.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return AssemblyMotion('aura', parts, report)
