"""Read-only geometry inventory for the collision-aware motion revision."""
import ast
import json
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))


def renderer_helpers():
    path = HERE / 'render_exploded.py'
    tree = ast.parse(path.read_text(encoding='utf-8'))
    tree.body = [n for n in tree.body if not isinstance(n, ast.For)]
    ns = {'__file__': str(path), '__name__': 'motion_inspection'}
    saved = sys.argv[:]
    sys.argv = ['blender']
    exec(compile(tree, str(path), 'exec'), ns)
    sys.argv = saved
    return ns


def geometry(parts):
    deps = bpy.context.evaluated_depsgraph_get()
    result = {}
    for p in parts:
        g = result.setdefault(p['group'], {'verts': [], 'faces': [], 'parts': []})
        obj = p['object'].evaluated_get(deps)
        mesh = obj.to_mesh()
        start = len(g['verts'])
        g['verts'].extend([tuple(obj.matrix_world @ v.co) for v in mesh.vertices])
        mesh.calc_loop_triangles()
        g['faces'].extend([tuple(start+i for i in t.vertices) for t in mesh.loop_triangles])
        g['parts'].append(p['name'])
        obj.to_mesh_clear()
    for name, g in result.items():
        a = np.array(g['verts'])
        g['bounds'] = [a.min(0).tolist(), a.max(0).tolist()]
        g['bvh'] = BVHTree.FromPolygons(g['verts'], g['faces'], all_triangles=True, epsilon=0.0)
    return result


if __name__ == '__main__':
    ns = renderer_helpers()
    keys = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['steering']
    out = HERE.parents[2] / '.codex/exploded-revision-20260913'
    out.mkdir(parents=True, exist_ok=True)
    for key in keys:
        objects, _ = ns['stage'](key)
        if key == 'javelin':
            objects = ns['restore_javelin_parts'](objects)
        parts = ns['make_parts'](objects, key)
        ns['movement'](key, parts)
        ns['reunite_finish_surfaces'](key, parts)
        groups = geometry(parts)
        names = list(groups)
        overlaps = []
        for i, a in enumerate(names):
            for b in names[i+1:]:
                pairs = groups[a]['bvh'].overlap(groups[b]['bvh'])
                if pairs:
                    overlaps.append([a, b, len(pairs)])
        report = {'project': key, 'parts': len(parts), 'partDetails': [{'name': p['name'], 'original': p['original'], 'center': list(p['center']), 'size': list(p['size']), 'faces': len(p['object'].data.polygons), 'group': p['group']} for p in parts], 'groups': {
            name: {'bounds': g['bounds'], 'parts': g['parts'], 'triangles': len(g['faces'])}
            for name, g in groups.items()}, 'baselineSurfaceIntersections': overlaps}
        (out / (key+'-inventory.json')).write_text(json.dumps(report, indent=2))
        print('INVENTORY', key, len(parts), json.dumps({k: {'bounds': v['bounds'], 'tris': len(v['faces']), 'n': len(v['parts'])} for k,v in groups.items()}), 'OVERLAPS', overlaps, flush=True)
