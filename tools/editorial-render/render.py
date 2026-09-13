"""Photographic stills of the repository's unmodified, full-resolution CAD GLBs.

Run with Blender 4.5+: blender --background --factory-startup --python render.py --
  --model steering --view wide [--draft] [--angle 0]
Geometry is only uniformly scaled and translated after import. Blender removes
coincident duplicate triangles, verified against source topology. No invented
hardware, decimation, component rearrangement, or bevel modifiers.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))
from inspect_source import inspect as inspect_source
PARSER = argparse.ArgumentParser()
PARSER.add_argument('--model', choices=['steering', 'vineRobot', 'scanner'], default='steering')
PARSER.add_argument('--view', choices=['wide', 'portrait'], default='wide')
PARSER.add_argument('--draft', action='store_true')
PARSER.add_argument('--angle', type=int, default=0)
ARGS = PARSER.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])

def linear_hex(value):
    c = tuple(int(value[i:i+2], 16) / 255 for i in (0, 2, 4))
    return tuple(x / 12.92 if x <= 0.04045 else ((x + .055) / 1.055) ** 2.4 for x in c)

def material(name, color, metallic=0, roughness=.4, transmission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*linear_hex(color), 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = m.diffuse_color
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['IOR'].default_value = 1.46
    return m

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(name, location, target, energy, size, color=(1, 1, 1), height=None):
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.color = color
    ld.shape = 'RECTANGLE'
    ld.size = size
    ld.size_y = height or size
    ob = bpy.data.objects.new(name, ld)
    bpy.context.collection.objects.link(ob)
    ob.location = location
    aim(ob, target)
    return ob

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == 'OPTIX'
    scene.cycles.device = 'GPU'
except Exception:
    scene.cycles.device = 'CPU'
scene.cycles.samples = 32 if ARGS.draft else 192
scene.cycles.use_denoising = True
scene.cycles.adaptive_threshold = .02 if ARGS.draft else .008
scene.cycles.max_bounces = 10
scene.cycles.transmission_bounces = 8
scene.cycles.transparent_max_bounces = 8
scene.render.threads_mode = 'AUTO'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = .2

world = bpy.data.worlds.new('Graphite studio world')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (.09, .105, .13, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .35
scene.world = world

source = ROOT / 'models' / 'real' / (ARGS.model + '.glb')
source_audit = inspect_source(ARGS.model)
bpy.ops.import_scene.gltf(filepath=str(source))
objects = [o for o in bpy.context.selected_objects if o.type == 'MESH']
imported_triangles = sum(len(o.data.polygons) for o in objects)
assert source_audit['sourceTriangles'] - imported_triangles == source_audit['duplicateSourceTriangles']
points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (hi + lo) * .5
factor = 2.8 / max(hi - lo)

mats = {
    'steel': material('Satin machined steel', 'AEB6C0', .92, .32),
    'printed': material('Graphite nonmetal structural parts', '30353C', .04, .36),
    'dark': material('Motor and electronics housings', '272A2F', .12, .37),
    'aero': material('Pale engineering polymer', 'DFE0DF', 0, .43),
    'rubber': material('Elastomer', 'C15F2F', 0, .66),
    'brass': material('Brass fittings', 'B49A63', .7, .31),
    'glass': material('Translucent HDPE vessel', 'C9C6C9', 0, .26, .6),
    'wood': material('Pale plywood base', 'CEC4AB', 0, .56),
}
if ARGS.model in ('vineRobot', 'scanner'):
    mats['printed'] = material('Royal blue printed components', '2A5FC4', .01, .4)
if ARGS.model == 'vineRobot':
    mats['aero'] = material('Cream white polymer structure', 'E6E3DA', 0, .46)
    mats['brass'] = material('CAD yellow outlet clamp', 'C9A83A', .35, .4)

carbon = material('Dark carbon steering wheel - supported by original CAD cover', '13171C', .12, .35)

for ob in objects:
    # Bake only the import transform, unit normalization, and a shared translation.
    original = ob.matrix_world.copy()
    ob.parent = None
    ob.matrix_world.identity()
    for vertex in ob.data.vertices:
        vertex.co = (original @ vertex.co - center) * factor
        vertex.co.z += (hi.z - lo.z) * factor * .5 + .035
    key = ob.name.removeprefix('mat_').split('.')[0]
    ob.data.materials.clear()
    ob.data.materials.append(mats.get(key, mats['printed']))
    if ARGS.model == 'steering' and key == 'printed':
        ob.data.materials.append(carbon)
        # The wheel is the isolated, broad plate high above the column in this
        # merged bucket. A source-space region selects only its existing faces.
        # No vertex is moved or recreated by this appearance assignment.
        for poly in ob.data.polygons:
            if all(ob.data.vertices[i].co.y > .9 for i in poly.vertices):
                poly.material_index = 1
    # Original STL geometry stays intact; smooth only within existing shallow edges.
    ob.data.set_sharp_from_angle(angle=math.radians(36))
    for poly in ob.data.polygons:
        poly.use_smooth = True
    ob.data.update()

points = [o.matrix_world @ v.co for o in objects for v in o.data.vertices]
target = Vector((0, 0, (hi.z - lo.z) * factor * .5 + .035))
directions = {
    'steering': [(1.05, -1.65, .9), (-1.05, -1.65, .9), (1.05, 1.65, .9), (-1.05, 1.65, .9)],
    'vineRobot': [(-1.8, -1.15, .82), (-1.8, 1.15, .82)],
    'scanner': [(1.0, -1.7, .86), (-1.0, -1.7, .86), (1.0, 1.7, .86)],
}
direction = Vector(directions[ARGS.model][ARGS.angle % len(directions[ARGS.model])]).normalized()
cam_data = bpy.data.cameras.new('Product orthographic camera')
cam = bpy.data.objects.new('Camera', cam_data)
bpy.context.collection.objects.link(cam)
cam.location = target + direction * 12
aim(cam, target)
cam_data.type = 'ORTHO'
cam_data.sensor_fit = 'HORIZONTAL'
scene.camera = cam
width, height = (1800, 1200) if ARGS.view == 'wide' else (1200, 1500)
if ARGS.draft:
    width, height = (720, 480) if ARGS.view == 'wide' else (480, 600)
scene.render.resolution_x, scene.render.resolution_y = width, height
scene.render.resolution_percentage = 100
right = cam.rotation_euler.to_quaternion() @ Vector((1, 0, 0))
up = cam.rotation_euler.to_quaternion() @ Vector((0, 1, 0))
px = [p.dot(right) for p in points]
py = [p.dot(up) for p in points]
cam_data.ortho_scale = max(max(px) - min(px), (max(py) - min(py)) * width / height) / .82
framing = right * ((max(px)+min(px))*.5 - target.dot(right)) + up * ((max(py)+min(py))*.5 - target.dot(up))
cam.location += framing

# Photographic sweep: broad white softboxes define silver; a narrow blue edge is secondary.
area('Large silver key', target + direction*3.5 - right*3 + up*3, target, 650, 4, (1, .97, .94), 3)
area('Long overhead reflection', target + up*4 - direction*.5, target, 700, 4.5, (.92, .96, 1), .8)
area('Neutral front fill', target + direction*4 + right*3, target, 280, 3, (.9, .94, 1), 4)
area('Restrained cold rim', target - direction*2.0 + right*2.4 + up*1.6, target, 180, .5, (.35, .58, 1), 4)

bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.02))
ground = bpy.context.object
ground.name = 'Graphite photographic sweep - staging only'
ground.data.materials.append(material('Graphite sweep', '07090C', 0, .8))
ground.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value = .16

out_dir = HERE / ('drafts' if ARGS.draft else 'renders')
out_dir.mkdir(parents=True, exist_ok=True)
stem = f'{ARGS.model}-{ARGS.view}' + (f'-angle{ARGS.angle}' if ARGS.draft else '')
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'
scene.render.filepath = str(out_dir / (stem + '.png'))
bpy.ops.render.render(write_still=True)
record = {
    'source': str(source.relative_to(ROOT)), 'sourceBytes': source.stat().st_size,
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    **source_audit,
    'importedTriangles': imported_triangles,
    'sourceMeshNames': [o.name for o in objects],
    'cameraDirectionBlenderZUp': list(direction), 'cameraAngleIndex': ARGS.angle,
    'dimensions': [width, height], 'samples': scene.cycles.samples,
    'geometryChanges': 'Blender import removes exactly the coincident duplicate source triangles counted by the independent source audit. Unique surface geometry stays intact. Uniform scale/translation and shading normals only after import.',
    'sourceDimensionsBlender': list(hi - lo),
}
(out_dir / (stem + '.json')).write_text(json.dumps(record, indent=2) + '\n')
print('EDITORIAL_RENDER_COMPLETE', scene.render.filepath)
