"""Rigid, staged assembly motion checked against evaluated source triangles.

This module never cuts or rewrites source meshes. It preserves each object's
original transform and modifiers. Exported plans are keyed by a geometry digest.
"""
import hashlib
import json
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from translation_collision import check_translation

HERE = Path(__file__).resolve().parent
PLAN_DIR = HERE.parents[2] / '.codex/exploded-revision-20260913/motion-plans'
VERSION = 15
IMPLEMENTATION_SOURCE = Path(__file__).read_bytes()
KEYS = ('steering', 'vineRobot', 'javelin', 'aura', 'scanner', 'materialTest',
        'ansysCfd', 'pool', 'lineFollower', 'formlabs', 'telecaster', 'education', 'ftc')


def coherent_groups(key, parts):
    """Repair spatial buckets which previously split rigid source components."""
    for p in parts:
        c, s, name = p['center'], p['size'], p['original']
        if key == 'lineFollower':
            if 'printed' in name and s.x > 1.8 and s.y > 1.8:
                p['group'] = 'chassis'
            elif p['group'] == 'chassis_hardware':
                p['group'] = 'chassis'
            elif name == 'mat_steel' and c.y > .95 and abs(c.x) > .65:
                p['group'] = 'drive_right' if c.x > 0 else 'drive_left'
            elif name == 'mat_steel' and p['group'].startswith('drive_'):
                p['group'] = 'chassis'
            elif name == 'mat_steel' and c.y < 0 and c.z < .15:
                p['group'] = 'chassis'
            if p['group'] in ('controller', 'drivers_and_mounts') or (name == 'mat_steel' and s.z > .25 and s.x < .15):
                p['group'] = 'electronics_stack'
        elif key == 'telecaster':
            if 'chrome' in name and s.z > 1.5:
                p['group'] = 'strings'
            elif 'maple' in name or 'fretboard' in name or c.z > 1.25 or ('chrome' in name and c.z > .88):
                p['group'] = 'neck'
            elif p['name'] == 'mat_paint_white_part_0' or 'pickguard' in name:
                p['group'] = 'body'
            else:
                p['group'] = 'bridge_and_controls'
        elif key == 'scanner' and p['group'] != 'base':
            p['group'] = 'gantry_and_sensor_assembly'
        elif key == 'pool':
            if 'glass' in name:
                p['group'] = 'right_side_panel' if c.x > .28 else 'left_side_panel'
            elif 'printed' in name:
                p['group'] = 'trigger_' + p['name'].rsplit('_', 1)[-1]
        elif key == 'materialTest':
            if p['group'] != 'base_and_controls':
                p['group'] = 'test_frame_and_fixtures'
        elif key == 'vineRobot':
            feet = {'mat_printed_part_33': 'far_support',
                    'mat_printed_part_34': 'near_support',
                    'mat_printed_part_37': 'right_support'}
            p['group'] = feet.get(p['name'], 'pressure_vessel_and_drive')
        elif key == 'aura':
            if c.x < -.65 and c.y > .9:
                p['group'] = 'left_motor'
            elif p['name'] in ('mat_plastic_black_part_7', 'mat_paint_gray_part_1', 'mat_steel_part_21', 'mat_steel_part_22'):
                p['group'] = 'right_motor'
            elif p['name'] in ('mat_paint_gray_part_3', 'mat_steel_part_5', 'mat_steel_part_6', 'mat_steel_part_7') or (name == 'mat_steel' and c.z > 1.5):
                p['group'] = 'upper_bearing_stack'
            elif p['name'] in ('mat_plastic_black_part_5', 'mat_plastic_black_part_6') or 'rubber' in name:
                p['group'] = 'wheel_and_hub'
            else:
                p['group'] = 'mounting_structure'
        elif key == 'ftc' and p['group'].startswith('wheel_'):
            # Original reconstruction is centered at y=.48, not y=0. Nearby
            # rollers, axles and screw heads must follow their wheel hub.
            p['group'] = 'wheel_%s_%s' % ('right' if c.x > 0 else 'left',
                                        'rear' if c.y > .48 else 'front')
        p['offset'] = Vector((0, 0, 0))
    if key == 'materialTest':
        from material_test_motion_groups import configure
        configure(parts)
    if key == 'telecaster':
        from telecaster_motion_groups import configure
        configure(parts)
    if key == 'vineRobot':
        from vine_motion_groups import configure
        configure(parts)


def absorb_embedded_hardware(key, parts, deps):
    """Keep geometrically embedded hardware with its supporting source solid.

    An attachment is inseparable here when its original surface intersection
    survives a small translation in every principal direction. A union of only
    touching faces is not enough to absorb a detachable part.
    """
    if key in ('materialTest', 'telecaster'):
        return []
    geometries = [Geometry(p['name'], [p], deps) for p in parts]
    parents = list(range(len(parts)))
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    directions = [np.eye(3)[i] * s * .00025 for i in range(3) for s in (-1, 1)]
    attached = []
    for i, a in enumerate(geometries):
        for j in range(i+1, len(geometries)):
            b = geometries[j]
            if parts[i]['group'] == parts[j]['group'] or not a.near(b, np.zeros(3)):
                continue
            if key not in ('ftc', 'education', 'materialTest', 'ansysCfd'):
                # Only absorb small fasteners/finish details, never broad panels
                # or the guitar's heel joint into the surrounding solid.
                if min(np.prod(a.hi-a.lo), np.prod(b.hi-b.lo)) > .001:
                    continue
            if not a.bvh.overlap(b.bvh):
                continue
            small, large = (a, b) if len(a.faces) < len(b.faces) else (b, a)
            if all(small.tree(d).overlap(large.bvh) for d in directions):
                parents[find(j)] = find(i)
                attached.append([a.name, b.name])
    components = {}
    for i in range(len(parts)):
        components.setdefault(find(i), []).append(i)
    for indices in components.values():
        if len(indices) < 2:
            continue
        anchor = max(indices, key=lambda i: np.prod(geometries[i].hi-geometries[i].lo))
        group = parts[anchor]['group']
        for i in indices:
            parts[i]['group'] = group
    return attached


def closed_surface(vertices, faces):
    """Weld only for topology inspection; the render mesh stays untouched."""
    if not len(faces):
        return False, 1
    coords = np.asarray(vertices, dtype=np.float64)
    _, welded = np.unique(np.round(coords, 6), axis=0, return_inverse=True)
    triangles = welded[np.asarray(faces)]
    good = (triangles[:,0] != triangles[:,1]) & (triangles[:,1] != triangles[:,2]) & (triangles[:,2] != triangles[:,0])
    triangles = triangles[good]
    edges = np.concatenate((triangles[:,[0,1]], triangles[:,[1,2]], triangles[:,[2,0]]))
    edges.sort(axis=1)
    _, counts = np.unique(edges, axis=0, return_counts=True)
    closed = bool(len(counts) and np.all(counts == 2))
    raw = coords[np.asarray(faces)]
    volume = np.einsum('ij,ij->i', raw[:,0], np.cross(raw[:,1], raw[:,2])).sum()/6
    return closed, 1 if volume >= 0 else -1


class Geometry:
    def __init__(self, name, parts, deps):
        self.name, self.parts = name, parts
        vertices, faces, probes = [], [], []
        self.closed_components = []
        self.component_bounds = []
        for part in parts:
            obj = part['object'].evaluated_get(deps)
            mesh = obj.to_mesh()
            start = len(vertices)
            points = [tuple(obj.matrix_world @ v.co) for v in mesh.vertices]
            vertices.extend(points)
            probes.extend(points[::max(1, len(points)//64)])
            mesh.calc_loop_triangles()
            local_faces = [tuple(t.vertices) for t in mesh.loop_triangles]
            faces.extend(tuple(start + i for i in t) for t in local_faces)
            point_array = np.asarray(points)
            lo, hi = point_array.min(0), point_array.max(0)
            self.component_bounds.append((lo, hi))
            closed, winding = closed_surface(points, local_faces)
            if closed:
                self.closed_components.append({'name': part['name'], 'lo': lo, 'hi': hi,
                    'bvh': BVHTree.FromPolygons(points, local_faces, all_triangles=True), 'winding': winding})
            obj.to_mesh_clear()
        self.vertices = np.asarray(vertices, dtype=np.float64)
        self.faces = faces
        self.lo, self.hi = self.vertices.min(0), self.vertices.max(0)
        self.offset = np.zeros(3)
        self.bvh = self.tree(self.offset)
        self.probes = np.asarray(probes, dtype=np.float64)

    def tree(self, offset):
        return BVHTree.FromPolygons((self.vertices + offset).tolist(), self.faces,
                                   all_triangles=True, epsilon=0.0)

    def near(self, other, offset):
        return bool(np.all(self.hi + offset >= other.lo + other.offset) and
                    np.all(other.hi + other.offset >= self.lo + offset))


class AssemblyMotion:
    mode = 'assembly'

    def __init__(self, key, parts, plan):
        self.parts = parts
        self.objects = [p['object'] for p in parts]
        self.initial = [o.matrix_world.copy() for o in self.objects]
        self.report = plan
        self.stages = plan['stages']
        self.part_groups = plan['partGroups']
        for part in parts:
            part['group'] = self.part_groups[part['name']]
        endpoints = {s['group']: s['translation'] for s in self.stages}
        for p in parts:
            p['offset'] = Vector(endpoints.get(p['group'], (0, 0, 0)))

    def apply(self, progress):
        progress = min(1.0, max(0.0, float(progress)))
        offsets = {}
        for s in self.stages:
            t = min(1.0, max(0.0, (progress - s['start']) / (s['end'] - s['start'])))
            t = t*t*(3-2*t)
            offsets[s['group']] = Vector(s['translation']) * t
        for part, matrix in zip(self.parts, self.initial):
            transform = matrix.copy()
            transform.translation += offsets.get(part['group'], Vector((0, 0, 0)))
            part['object'].matrix_world = transform
        bpy.context.view_layer.update()


def geometry_digest(key, parts):
    digest = hashlib.sha256((key + str(VERSION)).encode())
    digest.update(IMPLEMENTATION_SOURCE)
    if key == 'materialTest':
        digest.update((HERE/'material_test_motion_groups.py').read_bytes())
    if key == 'telecaster':
        digest.update((HERE/'telecaster_motion_groups.py').read_bytes())
    if key == 'vineRobot':
        digest.update((HERE/'vine_motion_groups.py').read_bytes())
    if (HERE/'translation_collision.py').exists():
        digest.update((HERE/'translation_collision.py').read_bytes())
    deps = bpy.context.evaluated_depsgraph_get()
    for p in parts:
        digest.update((p['name'] + p['group']).encode())
        obj = p['object'].evaluated_get(deps)
        mesh = obj.to_mesh()
        digest.update(np.asarray(obj.matrix_world, dtype=np.float32).tobytes())
        xyz = np.empty(len(mesh.vertices)*3, dtype=np.float32)
        mesh.vertices.foreach_get('co', xyz)
        digest.update(xyz.tobytes())
        mesh.calc_loop_triangles()
        digest.update(np.asarray([t.vertices[:] for t in mesh.loop_triangles], dtype=np.int32).tobytes())
        obj.to_mesh_clear()
    return digest.hexdigest()


def candidates(key, geom, center):
    radial = (geom.lo + geom.hi) * .5 - center
    dirs = []
    # Outer caps and covers withdraw along the geometric attachment axis.
    n = geom.name
    preferred = {
        'steering': {'wheel': (0, 1, .35), 'quick_release': (0, 1, .55),
                     'right_rack_end': (1, 0, 0), 'left_rack_end': (-1, 0, 0)},
        'vineRobot': {'far_support': (0, 1, 0), 'near_support': (0, -1, 0),
                      'right_support': (1, 0, 0)},
        'javelin': {'nose_cover': (0, 0, 1), 'nose': (-1, 0, 0), 'pitot': (-1, 0, 0),
                    'tail': (1, 0, 0)},
        'aura': {'wheel': (-1, 0, 0)},
        'pool': {'cue': (0, -1, 0), 'right_side_panel': (1, 0, 0), 'left_side_panel': (-1, 0, 0)},
        'lineFollower': {'electronics_stack': (0, 0, 1), 'controller': (0, 0, 1),
                         'battery': (0, 0, 1), 'drive_left': (-1, 0, 0), 'drive_right': (1, 0, 0),
                         'sensor_array': (0, -.7, -.005)},
        'telecaster': {'neck_and_hardware': (0, -1, 0), 'strings': (0, -1, 0), 'bridge_and_controls': (0, -1, 0),
                       'neck': (0, 0, 1)},
        'ansysCfd': {'original_solver_result': (0, -1, 0),
                     'presentation_bezel': (0, -1, 0), 'presentation_back': (0, 1, 0)},
        'education': {'pickup': (-1, 0, 0), 'pickguard': (0, -1, 0),
                      'neck': (0, 0, 1), 'teaching_hardware': (0, -1, 0)},
    }.get(key, {}).get(n)
    if key == 'materialTest':
        from material_test_motion_groups import PREFERRED
        preferred = PREFERRED.get(n)
    if key == 'telecaster':
        from telecaster_motion_groups import PREFERRED
        preferred = PREFERRED.get(n)
    if key == 'vineRobot':
        from vine_motion_groups import PREFERRED
        preferred = PREFERRED.get(n)
    if key == 'ftc':
        if n.startswith('wheel_'):
            preferred = (-1, 0, 0) if 'left' in n else (1, 0, 0)
        elif n == 'intake':
            preferred = (0, -1, 0)
    if preferred:
        dirs.append(np.asarray(preferred, float))
        if key == 'javelin' and n == 'pitot':
            yield dirs[0] * .7
            return
    axes = [np.array((0., 0., 1.)), np.array((1., 0., 0.)), np.array((-1., 0., 0.)),
            np.array((0., 1., 0.)), np.array((0., -1., 0.))]
    axes.sort(key=lambda d: -np.dot(radial, d))
    dirs.extend(axes)
    seen = set()
    for d in dirs:
        d = d / np.linalg.norm(d)
        if tuple(d) in seen:
            continue
        seen.add(tuple(d))
        yield d * .7


def check_path(moving, delta, groups, samples=33):
    """Continuous triangle SAT plus sampled bidirectional solid containment.

    Original contacts may withdraw under the explicitly bounded allowance.
    Later-entering triangle contacts are rejected throughout the entire path.
    Volume probes use ray parity only on welded watertight source components;
    open finish meshes remain subject to the continuous surface test.
    """
    ts = sorted(set([.0001, .001, .005, .01] + np.linspace(0, 1, samples)[1:].tolist()))
    tests = 0
    baseline = {}
    depth_baseline = {}
    ray_direction = Vector((.819172513, .371829101, .436291787)).normalized()
    def inside(component, point):
        origin = Vector(point)
        crossings = 0
        previous = -1
        for _ in range(128):
            hit, normal, index, distance = component['bvh'].ray_cast(origin, ray_direction)
            if hit is None:
                return bool(crossings % 2)
            if index != previous:
                crossings += 1
            previous = index
            origin = hit + ray_direction * .000001
        # Fail conservatively if unusually self-overlapping source geometry
        # prevents reliable parity classification within the bounded traversal.
        return True
    def point_depth(points, components):
        deepest = 0.0
        for component in components:
            candidates = points[np.all(points > component['lo']+.000001, axis=1) &
                                np.all(points < component['hi']-.000001, axis=1)]
            for point in candidates:
                nearest, normal, _, distance = component['bvh'].find_nearest(Vector(point))
                if nearest is not None and distance > .00001 and inside(component, point):
                    deepest = max(deepest, distance)
        return deepest
    def depth(other, offset):
        return max(point_depth(moving.probes + offset - other.offset, other.closed_components),
                   point_depth(other.probes + other.offset - offset, moving.closed_components))
    for other in groups:
        if other is not moving and moving.near(other, np.zeros(3)):
            baseline[other.name] = set(moving.bvh.overlap(other.bvh))
            depth_baseline[other.name] = depth(other, np.zeros(3))
    for t in ts:
        offset = delta * t
        if moving.lo[2] + offset[2] < -.00001:
            return False, {'reason': 'floor', 't': t}
        nearby = [g for g in groups if g is not moving and moving.near(g, offset)]
        if not nearby:
            continue
        tree = moving.tree(offset)
        for other in nearby:
            tests += 1
            overlaps = tree.overlap(other.bvh)
            original = baseline.get(other.name, set())
            original_a = {a for a, b in original}
            original_b = {b for a, b in original}
            extra = {(a,b) for a,b in overlaps if a not in original_a or b not in original_b}
            current_depth = depth(other, offset)
            original_depth = depth_baseline.get(other.name, 0.0)
            if current_depth > original_depth + .0002:
                return False, {'reason': 'oriented_surface_penetration', 't': t,
                               'obstacle': other.name, 'orientedDepth': current_depth,
                               'baselineOrientedDepth': original_depth}
            if t > .25 and current_depth > .0002:
                return False, {'reason': 'retained_solid_containment', 't': t,
                               'obstacle': other.name, 'orientedDepth': current_depth}
            if overlaps and (not original or len(overlaps) > len(original) or t > .25 or current_depth > original_depth + .0002):
                return False, {'reason': 'surface_intersection', 't': t,
                               'obstacle': other.name, 'trianglePairs': len(overlaps),
                               'baselinePairs': len(original), 'newPatchPairs': len(extra),
                               'orientedDepth': current_depth, 'baselineOrientedDepth': original_depth}
    continuous_tests = 0
    continuous_candidates = 0
    source_contacts = 0
    swept_lo = np.minimum(moving.lo, moving.lo+delta)
    swept_hi = np.maximum(moving.hi, moving.hi+delta)
    for other in groups:
        if other is moving or np.any(swept_hi < other.lo+other.offset) or np.any(other.hi+other.offset < swept_lo):
            continue
        ccd = check_translation(moving.vertices, moving.faces, other.vertices+other.offset,
                                other.faces, delta, tolerance=1e-8)
        continuous_tests += ccd['testedPairs']
        continuous_candidates += ccd['candidatePairs']
        for hit in ccd['collisions']:
            if hit['tEnter'] <= .000001 and hit['tExit'] <= .25:
                source_contacts += 1
                continue
            return False, {'reason': 'continuous_triangle_contact', 't': hit['tEnter'],
                           'obstacle': other.name, 'contact': hit,
                           'continuousTriangleTests': continuous_tests}
    return True, {'positiveSamples': len(ts), 'triangleBVHPairTests': tests,
                  'newGroupSurfaceIntersections': 0, 'floorCrossings': 0,
                  'continuousTriangleTests': continuous_tests,
                  'continuousCandidatePairs': continuous_candidates,
                  'initialTriangleContactsWithdrawing': source_contacts,
                  'newContinuousTriangleContacts': 0,
                  'sourceContactAllowance': 'Original group contacts may withdraw for at most the first quarter of the path; intersection count cannot exceed baseline and sampled oriented surface depth cannot increase by more than 0.0002 source units.'}


def plan_motion(key, parts, fingerprint):
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    attached = absorb_embedded_hardware(key, parts, deps)
    buckets = {}
    for p in parts:
        buckets.setdefault(p['group'], []).append(p)
    groups = [Geometry(name, ps, deps) for name, ps in buckets.items()]
    center = (np.min([g.lo for g in groups], 0) + np.max([g.hi for g in groups], 0)) * .5
    stationary = {'base', 'chassis', 'teaching_body', 'body', 'rack',
                  'base_and_controls', 'presentation_stand', 'chassis_and_electronics',
                  'pressure_vessel_and_drive'}
    pending = [g for g in groups if g.name not in stationary]
    # Withdraw small outer groups first. Broad housings are considered after
    # their covers and wheels have cleared the mechanism.
    pending.sort(key=lambda g: np.prod(g.hi-g.lo))
    stages, failures = [], {}
    while pending:
        progressed = False
        for g in pending[:]:
            rejected = []
            for delta in candidates(key, g, center):
                passed, result = check_path(g, delta, groups)
                if not passed and result.get('t', 0) > .1:
                    shortened = delta * result['t'] * .7
                    if np.linalg.norm(shortened) >= .075:
                        short_passed, short_result = check_path(g, shortened, groups)
                        if short_passed:
                            delta, passed, result = shortened, short_passed, short_result
                if passed:
                    g.offset = delta
                    g.bvh = g.tree(delta)
                    stages.append({'group': g.name, 'translation': delta.tolist(), 'verification': result})
                    pending.remove(g)
                    failures.pop(g.name, None)
                    progressed = True
                    print('MOTION_STAGE', key, g.name, delta.tolist(), flush=True)
                    break
                rejected.append({'translation': delta.tolist(), **result})
            else:
                failures[g.name] = rejected
        if not progressed:
            break
    for i, stage in enumerate(stages):
        stage['start'] = i / len(stages)
        stage['end'] = (i+1) / len(stages)
    plan = {'version': VERSION, 'project': key, 'geometryDigest': fingerprint,
            'policy': 'Sequential rigid extraction with continuous triangle SAT over swept AABB candidates. Original contacts starting within t=0.000001 may withdraw within the first quarter of a stage, bounded by their baseline triangle-intersection count and sampled solid penetration depth. New later-entering triangle contacts and ground crossings are rejected.',
            'containmentPolicy': 'Bidirectional vertex probes from every original component. Coordinate welding at 0.000001 is used only to identify watertight source components for ray-parity inside tests; nearest-surface distance bounds penetration. Open meshes have no invented solid volume. This complements continuous surface checking; it is not a continuous volumetric manufacturing certificate.',
            'stages': stages, 'retainedGroups': [g.name for g in groups if not np.any(g.offset)],
            'blockedCandidates': failures,
            'embeddedHardwareAttachments': attached,
            'partGroups': {p['name']: p['group'] for p in parts},
            'geometryTriangles': sum(len(g.faces) for g in groups)}
    return plan


def build_motion(key, parts, scene):
    if key not in KEYS:
        raise ValueError('No assembly motion policy for ' + key)
    coherent_groups(key, parts)
    fingerprint = geometry_digest(key, parts)
    path = PLAN_DIR / (key + '.json')
    if path.exists():
        plan = json.loads(path.read_text(encoding='utf-8'))
        if plan.get('version') == VERSION and plan.get('geometryDigest') == fingerprint:
            return AssemblyMotion(key, parts, plan)
    plan = plan_motion(key, parts, fingerprint)
    if not plan['stages']:
        raise RuntimeError(key + ': no collision-checked rigid extraction was found; revise the source grouping before rendering')
    PLAN_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(plan, indent=2) + '\n', encoding='utf-8')
    return AssemblyMotion(key, parts, plan)
