"""Independent dense replay and original-material contact sheets for plans."""
import argparse
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from inspect_motion import renderer_helpers
from assembly_motion import build_motion, Geometry, check_path, KEYS, PLAN_DIR, VERSION

AUDIT_METHOD = ('Continuous translational triangle SAT checks every swept surface-contact interval; '
                'dense triangle-BVH poses and bidirectional ray-parity probes against closed original '
                'components check source-contact withdrawal, sampled containment depth, and floor clearance. '
                'Open finish meshes are checked as surfaces. Containment uses distributed component probes '
                'at sampled poses, so this is not a continuous solid-model collision certificate.')

parser = argparse.ArgumentParser()
parser.add_argument('--projects', nargs='+', default=list(KEYS))
parser.add_argument('--render', action='store_true')
parser.add_argument('--samples', type=int, default=97)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
ns = renderer_helpers()
for key in args.projects:
    objects, _ = ns['stage'](key)
    if key == 'javelin':
        objects = ns['restore_javelin_parts'](objects)
    parts = ns['make_parts'](objects, key)
    ns['movement'](key, parts)
    ns['reunite_finish_surfaces'](key, parts)
    scene = bpy.context.scene
    motion = build_motion(key, parts, scene)
    deps = bpy.context.evaluated_depsgraph_get()
    buckets = {}
    for p in parts:
        buckets.setdefault(p['group'], []).append(p)
    groups = [Geometry(name, ps, deps) for name, ps in buckets.items()]
    names = {g.name: g for g in groups}
    results = []
    for stage in motion.stages:
        g = names[stage['group']]
        delta = np.asarray(stage['translation'])
        passed, details = check_path(g, delta, groups, samples=args.samples)
        results.append({'group': g.name, 'passed': passed, **details})
        g.offset = delta
        g.bvh = g.tree(delta)
    report = {'project': key, 'geometryDigest': motion.report['geometryDigest'],
              'checkerVersion': VERSION,
              'samplesPerStage': args.samples, 'stages': results,
              'passed': bool(results) and all(r['passed'] for r in results),
              'method': AUDIT_METHOD}
    (PLAN_DIR / (key+'-audit.json')).write_text(json.dumps(report, indent=2)+'\n')
    print('DENSE_AUDIT', key, report['passed'], results, flush=True)
    if not args.render:
        continue
    out = PLAN_DIR.parent / 'motion-proofs' / key
    out.mkdir(parents=True, exist_ok=True)
    scene.render.resolution_x = 384
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.cycles.samples = 4
    scene.render.image_settings.file_format = 'PNG'
    cam = scene.camera
    right = cam.rotation_euler.to_quaternion() @ Vector((1, 0, 0))
    up = cam.rotation_euler.to_quaternion() @ Vector((0, 1, 0))
    scale = cam.data.ortho_scale
    # Each object translates monotonically on a straight segment. Projection
    # extrema of these paths occur at the source or destination vertices.
    for progress in (0.0, 1.0):
        motion.apply(progress)
        verts = np.asarray([tuple(p['object'].matrix_world @ v.co) for p in parts for v in p['object'].data.vertices])
        relative = verts - np.asarray(cam.location)
        scale = max(scale, max(abs(relative @ np.asarray(right))) * 2 / .87,
                    max(abs(relative @ np.asarray(up))) * 3 / .87)
    cam.data.ortho_scale = scale
    poses = sorted(set([0., 1.] + [(s['start']+s['end'])*.5 for s in motion.stages]))
    for index, progress in enumerate(poses):
        motion.apply(progress)
        scene.render.filepath = str(out / (str(index).zfill(2)+'.png'))
        bpy.ops.render.render(write_still=True)
    (out/'poses.json').write_text(json.dumps(poses))
    print('MOTION_PROOF', key, len(poses), str(out), flush=True)
