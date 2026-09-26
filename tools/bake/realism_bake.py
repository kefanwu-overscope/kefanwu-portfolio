"""Cycles rebake of the approved studio, preserving its geometry and UV atlas.

Run with Blender 4.5 LTS, e.g. blender -b --python realism_bake.py --
  --root PATH/portfolio-site --evidence PATH/.codex/realism-20260925/bake
  --casters PATH/static-casters.glb --resolution 2048 --samples 256

The deployed GLB is copied byte-for-byte. Secondary objects participate only
as static light occluders. No exported vertex, normal or UV is modified.
Raw scene-linear EXR, float arrays, native .blend and path-traced previews stay
in the non-deployed evidence directory. encode_realism.py packs RGBM PNGs.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import sys
import time

import bpy
import numpy as np
from mathutils import Vector


args = argparse.ArgumentParser()
args.add_argument('--root', type=Path, required=True)
args.add_argument('--evidence', type=Path, required=True)
args.add_argument('--casters', type=Path)
args.add_argument('--resolution', type=int, default=2048)
args.add_argument('--samples', type=int, default=256)
args.add_argument('--states', nargs='+', default=['off', 'on'])
args.add_argument('--preview-only', action='store_true')
args.add_argument('--deploy', type=Path)
cfg = args.parse_args(sys.argv[sys.argv.index('--') + 1:])
cfg.root = cfg.root.resolve()
cfg.evidence = cfg.evidence.resolve()
if cfg.casters:
    cfg.casters = cfg.casters.resolve()
if cfg.deploy:
    cfg.deploy = cfg.deploy.resolve()
    cfg.deploy.mkdir(parents=True, exist_ok=True)
cfg.evidence.mkdir(parents=True, exist_ok=True)
started = time.time()
bpy.context.preferences.filepaths.save_version = 0


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def srgb(hex_value):
    channels = [int(hex_value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in channels)


def bounds(obj):
    coords = np.array([obj.matrix_world @ Vector(v) for v in obj.bound_box])
    return coords.min(axis=0), coords.max(axis=0)


def uv_hash(obj):
    uv = obj.data.uv_layers[1]
    vals = np.empty(len(uv.data) * 2, dtype=np.float32)
    uv.data.foreach_get('uv', vals)
    return hashlib.sha256(vals.tobytes()).hexdigest()


def atlas_metrics(objects):
    result = []
    for obj in objects:
        obj.data.calc_loop_triangles()
        uv = obj.data.uv_layers[1]
        total = 0.
        for tri in obj.data.loop_triangles:
            a, b, c = [uv.data[i].uv for i in tri.loops]
            total += abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)) * .5
        result.append({'name': obj.name, 'surfaceRole': obj.get('surfaceRole'), 'uv1Area': total, 'uv1Hash': uv_hash(obj), 'triangles': len(obj.data.loop_triangles)})
    return result


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
source = cfg.root / 'models/baked/room-baked.glb'
bpy.ops.import_scene.gltf(filepath=str(source))
room = next(o for o in scene.objects if o.type == 'MESH')
original_uv = uv_hash(room)
room.data.uv_layers.active_index = 1
room.data.uv_layers[1].active_render = True
# Separate only to recognize the original material partitions exactly as the
# runtime does. These Blender objects are never exported to the runtime.
bpy.context.view_layer.objects.active = room
room.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
architecture = [o for o in scene.objects if o.type == 'MESH']
geometry_report = []
for obj in architecture:
    mn, mx = bounds(obj)
    size, center = mx - mn, (mn + mx) / 2
    # Blender coordinates: Three (x,y,z) => Blender (x,-z,y).
    sx, sy, sz = size[0], size[2], size[1]
    cx, cy, cz = center[0], center[2], -center[1]
    kind = 'architecture'
    color = None
    if sx > 10 and sz > 10 and sy < .5:
        kind, color = 'floor', '64676d'
    elif sy > 3 and max(sx, sz) > 4:
        kind, color = 'wall', 'a4a7ad'
    elif 1.7 < sx < 2 and sy < .06 and .8 < sz < 1:
        kind = 'desk'
    elif cy > 2.1 and abs(cx - .15) < .3 and abs(cz - .35) < .3 and max(sx, sz) < .5:
        kind = 'runtime-hidden-old-pendant'
        obj.hide_render = True
    elif sy < .01 and .35 < sx < .55 and .4 < sz < .6 and abs(cx - .02) < .1 and abs(cy - .763) < .02 and abs(cz - .16) < .1:
        kind = 'runtime-hidden-old-pad'
        obj.hide_render = True
    geometry_report.append({'name': obj.name, 'kind': kind, 'boundsBlender': [mn.tolist(), mx.tolist()], 'uvHash': uv_hash(obj)})
    obj['surfaceRole'] = kind
    obj.name = 'room_' + kind + '_' + str(len(geometry_report)).zfill(2)
    for mat in obj.data.materials:
        if not mat:
            continue
        mat.use_nodes = True
        for node in mat.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                if color:
                    node.inputs['Base Color'].default_value = (*srgb(color), 1)
                if kind in ['floor', 'wall']:
                    node.inputs['Roughness'].default_value = .76 if kind == 'wall' else .64

original_atlas_metrics = atlas_metrics(architecture)
if cfg.deploy:
    (cfg.deploy / 'room-baked.glb').write_bytes(source.read_bytes())
final_atlas_metrics = atlas_metrics([o for o in architecture if not o.hide_render])

# Exported materials retain the original visible fixture emission. Cycles
# receives explicit area sources instead, so fixture emission is camera-only
# in the source scene and cannot double-light the diffuse bake.
for mat in {m for obj in architecture for m in obj.data.materials if m}:
    if not mat.use_nodes:
        continue
    nt = mat.node_tree
    for node in list(nt.nodes):
        if node.type == 'BSDF_PRINCIPLED' and node.inputs['Emission Strength'].default_value > 0:
            strength = node.inputs['Emission Strength'].default_value
            light_path = nt.nodes.new('ShaderNodeLightPath')
            multiply = nt.nodes.new('ShaderNodeMath')
            multiply.operation = 'MULTIPLY'
            multiply.inputs[1].default_value = strength
            nt.links.new(light_path.outputs['Is Camera Ray'], multiply.inputs[0])
            nt.links.new(multiply.outputs[0], node.inputs['Emission Strength'])

# Cycles otherwise rebuilds/synchronizes the complete caster scene for every
# separate selected mesh. Joining only bake targets preserves the shared UVs
# and all material slots, reducing a 35-object bake to one GPU invocation.
bpy.ops.object.select_all(action='DESELECT')
for obj in architecture:
    obj.select_set(not obj.hide_render)
bpy.context.view_layer.objects.active = next(o for o in architecture if not o.hide_render)
bpy.ops.object.join()
joined_room = bpy.context.view_layer.objects.active
joined_room.name = 'approved_room_bake_target'
architecture = [joined_room]

caster_objects = []
if cfg.casters:
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(cfg.casters))
    caster_objects = [o for o in scene.objects if o not in before and o.type == 'MESH']
    for obj in caster_objects:
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:
                continue
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    node.inputs['Emission Strength'].default_value = 0
                    # Alpha decorations do not become unexpectedly opaque
                    # shadow blockers in Cycles. Native alpha links survive.
    print('STATIC_CASTERS', len(caster_objects), flush=True)

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'OPTIX'
prefs.get_devices()
gpu = [d for d in prefs.devices if d.type == 'OPTIX']
for device in prefs.devices:
    device.use = device in gpu
scene.cycles.device = 'GPU' if gpu else 'CPU'
scene.cycles.samples = cfg.samples
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 6
scene.cycles.glossy_bounces = 4
scene.cycles.transparent_max_bounces = 8
scene.cycles.sample_clamp_indirect = 8
scene.cycles.seed = 20260925
scene.world = bpy.data.worlds.new('Neutral indoor ambient')
scene.world.use_nodes = True
scene.world.node_tree.nodes.get('Background').inputs[0].default_value = (.72, .75, .8, 1)
scene.world.node_tree.nodes.get('Background').inputs[1].default_value = .015
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.view_settings.look = 'AgX - Medium High Contrast'
scene.view_settings.exposure = 0


def area(name, pos_three, target_three, size, watts, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.shape = 'RECTANGLE'
    data.size, data.size_y = size
    data.energy, data.color = watts, color
    obj = bpy.data.objects.new(name, data)
    scene.collection.objects.link(obj)
    obj.location = (pos_three[0], -pos_three[2], pos_three[1])
    target = Vector((target_three[0], -target_three[2], target_three[1]))
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
    return obj


cam_data = bpy.data.cameras.new('Approved rest camera')
cam_data.sensor_fit = 'VERTICAL'
cam_data.angle_y = math.radians(42)
cam = bpy.data.objects.new('Approved rest camera', cam_data)
cam.location = (1.55, -2.6, 1.58)
cam.rotation_euler = (Vector((0, .1, 1.08)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.collection.objects.link(cam)
scene.camera = cam

image = bpy.data.images.new('Lighting UV1 atlas', cfg.resolution, cfg.resolution, float_buffer=True)
image.colorspace_settings.name = 'Non-Color'
for obj in architecture:
    obj.data.uv_layers.active_index = 1
    obj.data.uv_layers[1].active_render = True
    for mat in obj.data.materials:
        if not mat:
            continue
        nt = mat.node_tree
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = image
        uv = nt.nodes.new('ShaderNodeUVMap')
        uv.uv_map = obj.data.uv_layers[1].name
        nt.links.new(uv.outputs['UV'], node.inputs['Vector'])
        for n in nt.nodes:
            n.select = n == node
        nt.nodes.active = node

manifest = {
    'version': 'realism-20260925', 'source': str(source), 'sourceSha256': sha(source),
    'sourceUv1Sha256': original_uv, 'visibleGeometryUnchanged': True,
    'repackedUv1': False, 'floorSubdivisionPreservesShapeAndUv0': False,
    'runtimeGlb': str(cfg.deploy / 'room-baked.glb') if cfg.deploy else str(source),
    'originalAtlas': original_atlas_metrics, 'finalAtlas': final_atlas_metrics,
    'atlasPacking': 'Original deployed atlas retained byte-for-byte.',
    'sourceCasters': str(cfg.casters) if cfg.casters else None,
    'casterSha256': sha(cfg.casters) if cfg.casters else None,
    'casterObjects': len(caster_objects), 'geometryPartitions': geometry_report,
    'blender': bpy.app.version_string, 'engine': 'Cycles',
    'device': [d.name for d in gpu], 'nativeResolution': cfg.resolution,
    'samples': cfg.samples, 'bakePasses': ['DIFFUSE_DIRECT', 'DIFFUSE_INDIRECT'],
    'colorPass': False, 'denoiser': 'OpenImageDenoise compositor (color only)',
    'bakeUnits': 'outgoing unit-albedo Lambertian radiance = irradiance/pi',
    'threeR185REIndirectDiffuseInput': 'decoded RGB * PI * lightMapIntensity',
    'diffuseBounces': 6, 'marginPixels': 12, 'seed': 20260925,
    'limitations': ['Only architecture receives a lightmap. Static exported props cast indirect/contact shadows. Dynamic exhibits remain runtime lit.', 'Preview renders document source lighting, not a pixel match of the browser tone mapper.'],
    'states': {},
}
for state in cfg.states:
    state_started = time.time()
    for obj in [o for o in scene.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(obj, do_unlink=True)
    # Broad ceiling panels produce a readable neutral gallery state. The
    # night state retains the original practical-lamp focus with softer fill.
    neutral = (.96, .98, 1)
    if state == 'on':
        area('ceiling central', (0, 3.30, .4), (0, 0, .4), (2.6, .32), 112, neutral)
        area('ceiling left', (-1.6, 3.30, .4), (-1.6, 0, .4), (.32, 2.4), 72, neutral)
        area('ceiling right', (1.6, 3.30, .4), (1.6, 0, .4), (.32, 2.4), 72, neutral)
        area('broad room bounce', (0, 2.9, 2.6), (0, 1, -.6), (2.3, 1.4), 28, neutral)
    else:
        area('broad room bounce', (0, 2.9, 2.6), (0, 1, -.6), (2.3, 1.4), 3.6, (.9, .94, 1))
    # Preserve warm task pools while taking their placement from the actual
    # approved desk/lamp, not a redesigned room or synthetic window.
    area('desk practical', (-.45, 1.20, .12), (.02, .76, .16), (.26, .08), 7.5, (1, .84, .66))
    area('resume broad reflection', (.02, 1.5, .16), (.02, .76, .16), (.34, .44), 4.0 if state == 'off' else 2.0, (1, .9, .77))
    # Genuine cabinet shelf-strip spill; geometry and shelf heights are copied
    # from experience.js CAB and CAB2. No point-light blue circles.
    for row, y in enumerate([1.68, 1.2, .72]):
        area(f'main shelf strip {row}', (0, y + .425, -.97), (0, y - .02, -.97), (2.18, .04), 1.7 if state == 'off' else 2.5, (.9, .95, 1))
        area(f'side shelf strip {row}', (2.11, y + .425, -.1), (2.11, y - .02, -.1), (.04, 1.46), 1.2 if state == 'off' else 1.8, (.9, .95, 1))
    area('workbench practical', (-2.4, 1.30, -1.15), (-2.3, .79, -.55), (.65, .05), 2.1 if state == 'off' else 1.2, (.94, .97, 1))

    scene.cycles.samples = min(cfg.samples, 64)
    scene.use_nodes = False
    scene.render.resolution_x, scene.render.resolution_y = 1280, 854
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.filepath = str(cfg.evidence / f'cycles-preview-{state}.png')
    bpy.ops.render.render(write_still=True)
    if cfg.preview_only:
        continue
    # Probe captures the real static furnishing materials before any texture
    # cleanup. 512x256 is sufficient for the room's rough reflections and is
    # a quarter of the old probe's pixel/decode cost.
    probe_data = bpy.data.cameras.new(f'Probe {state}')
    probe_data.type = 'PANO'
    probe_data.panorama_type = 'EQUIRECTANGULAR'
    probe_cam = bpy.data.objects.new(f'Probe {state}', probe_data)
    scene.collection.objects.link(probe_cam)
    probe_cam.location = (0, -.6, 1.4)
    probe_cam.rotation_euler = (math.pi / 2, 0, 0)
    scene.camera = probe_cam
    scene.render.resolution_x, scene.render.resolution_y = 512, 256
    scene.render.image_settings.file_format = 'HDR'
    scene.render.filepath = str(cfg.evidence / f'probe-{state}.hdr')
    bpy.ops.render.render(write_still=True)
    if cfg.deploy:
        (cfg.deploy / f'probe-{state}.hdr').write_bytes(Path(scene.render.filepath).read_bytes())
    scene.camera = cam
    bpy.data.objects.remove(probe_cam, do_unlink=True)
    scene.cycles.samples = cfg.samples
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 12
    scene.render.bake.use_clear = True
    bpy.ops.object.select_all(action='DESELECT')
    targets = [o for o in architecture if not o.hide_render]
    for obj in targets:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = targets[0]
    bpy.ops.object.bake(type='DIFFUSE')
    raw = cfg.evidence / f'lightmap-{state}-{cfg.resolution}-raw.exr'
    image.filepath_raw = str(raw)
    image.file_format = 'OPEN_EXR'
    image.save()
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    inp = nt.nodes.new('CompositorNodeImage')
    inp.image = image
    denoise = nt.nodes.new('CompositorNodeDenoise')
    out = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(inp.outputs['Image'], denoise.inputs['Image'])
    nt.links.new(denoise.outputs['Image'], out.inputs['Image'])
    scene.cycles.samples = 1
    scene.render.resolution_x = scene.render.resolution_y = cfg.resolution
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '32'
    scene.render.filepath = str(cfg.evidence / f'lightmap-{state}-{cfg.resolution}.exr')
    bpy.ops.render.render(write_still=True)
    denoised = bpy.data.images.load(scene.render.filepath, check_existing=False)
    pixels = np.empty(cfg.resolution * cfg.resolution * 4, dtype=np.float32)
    denoised.pixels.foreach_get(pixels)
    pixels = pixels.reshape((cfg.resolution, cfg.resolution, 4))
    np.save(cfg.evidence / f'lightmap-{state}-{cfg.resolution}.npy', pixels)
    manifest['states'][state] = {
        'seconds': round(time.time() - state_started, 2),
        'maxRgb': float(pixels[:, :, :3].max()),
        'percentilesRgb': np.percentile(pixels[:, :, :3], [50, 90, 99, 99.9, 100]).tolist(),
        'lights': [{'name': o.name, 'watts': o.data.energy, 'color': list(o.data.color), 'locationBlender': list(o.location), 'size': [o.data.size, o.data.size_y]} for o in scene.objects if o.type == 'LIGHT'],
    }
    scene.use_nodes = False
    scene.cycles.samples = cfg.samples
    # Keep the exact practical rig and UV targets reproducible in Blender.
    # File-backed EXR references travel with the evidence directory; imported
    # glTF textures remain packed inside the .blend.
    for source_image in bpy.data.images:
        if source_image.source == 'FILE' and source_image.filepath:
            source_image.filepath = bpy.path.relpath(bpy.path.abspath(source_image.filepath), start=str(cfg.evidence))
    bpy.ops.wm.save_as_mainfile(filepath=str(cfg.evidence / f'studio-{state}-{cfg.resolution}.blend'))
    bpy.data.images.remove(denoised)
    (cfg.evidence / 'bake-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('STATE_COMPLETE', state, manifest['states'][state], flush=True)
manifest['totalSeconds'] = round(time.time() - started, 2)
(cfg.evidence / 'bake-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('REALISM_BAKE_COMPLETE', flush=True)
