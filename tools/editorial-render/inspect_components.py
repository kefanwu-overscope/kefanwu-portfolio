import bpy
from pathlib import Path
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
source = Path(__file__).resolve().parents[2] / 'models/real/steering.glb'
bpy.ops.import_scene.gltf(filepath=str(source))
for ob in list(bpy.context.selected_objects):
    if ob.type != 'MESH':
        continue
    parents = list(range(len(ob.data.vertices)))
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for edge in ob.data.edges:
        parents[find(edge.vertices[0])] = find(edge.vertices[1])
    groups = {}
    for vertex in ob.data.vertices:
        groups.setdefault(find(vertex.index), []).append(ob.matrix_world @ vertex.co)
    parts = []
    for group, points in groups.items():
        lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
        hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
        parts.append({'group': group, 'vertices': len(points), 'size': [round(v,2) for v in hi-lo], 'center':[round(v,2) for v in (hi+lo)*.5]})
    print('COMPONENTS', ob.name, sorted(parts, key=lambda x: x['vertices'], reverse=True)[:40])
