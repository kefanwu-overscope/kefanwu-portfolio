"""Bake a planar desktop lighting detail from the accepted studio .blend files.

The receiver is 0.2 mm above the original desktop. It is invisible to camera,
shadow, diffuse and glossy rays so all original geometry/materials still
provide occlusion and bounce. No new runtime geometry is exported.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np

p = argparse.ArgumentParser()
p.add_argument('--source', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
p.add_argument('--resolution', type=int, default=512)
p.add_argument('--samples', type=int, default=256)
p.add_argument('--source-resolution', type=int, default=4096)
cfg = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
cfg.source, cfg.output = cfg.source.resolve(), cfg.output.resolve()
cfg.output.mkdir(parents=True, exist_ok=True)
manifest = {
    'resolution': cfg.resolution, 'samples': cfg.samples,
    'sourceResolution': cfg.source_resolution,
    'bakeScriptSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
    'units': 'irradiance/pi', 'geometryExported': False,
    'receiverY': .7602, 'desktopY': .76000005,
    'boundsThree': {'xMin': -.925, 'xMax': .925, 'zMin': -.45, 'zMax': .45},
    'runtimeUv': 'vec2((worldX + 0.925) / 1.85, (worldZ + 0.45) / 0.9)',
    'textureOrigin': 'PNG top row = Three Z -0.45; left column = Three X -0.925',
    'flipY': False, 'colorSpace': 'NoColorSpace', 'mipmaps': False,
    'restriction': 'Use on upward-facing desktop only; retain original atlas on sides/bevels.',
    'states': {},
}
source_manifest = json.loads((cfg.source / 'bake-manifest.json').read_text(encoding='utf-8'))
manifest['version'] = source_manifest['version']
manifest['sourceCasterSha256'] = source_manifest['casterSha256']
if source_manifest['nativeResolution'] != cfg.source_resolution:
    raise ValueError('Desktop source resolution differs from the accepted room bake.')
for state in ['off', 'on']:
    source = cfg.source / f'studio-{state}-{cfg.source_resolution}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source))
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = cfg.samples
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    scene.render.bake.margin = 4
    scene.render.bake.use_clear = True
    scene.use_nodes = False
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, .7602))
    receiver = bpy.context.object
    receiver.name = 'desktop_detail_receiver'
    receiver.scale = (.925, .45, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    receiver.visible_camera = False
    receiver.visible_shadow = False
    receiver.visible_diffuse = False
    receiver.visible_glossy = False
    receiver.visible_transmission = False
    source_material = bpy.data.materials.get('Material_21')
    if source_material is None:
        raise ValueError('Accepted scene desktop Material_21 is missing.')
    material = source_material.copy()
    material.name = 'desktop_detail_bake_target'
    receiver.data.materials.append(material)
    image = bpy.data.images.new(f'desk_{state}', cfg.resolution, cfg.resolution, float_buffer=True)
    image.colorspace_settings.name = 'Non-Color'
    nt = material.node_tree
    for node in list(nt.nodes):
        if node.type in ['TEX_IMAGE', 'UVMAP']:
            nt.nodes.remove(node)
    target = nt.nodes.new('ShaderNodeTexImage')
    target.image = image
    nt.nodes.active = target
    bpy.ops.object.bake(type='DIFFUSE')
    image.filepath_raw = str(cfg.output / f'desk-{state}-raw.exr')
    image.file_format = 'OPEN_EXR'
    image.save()
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    image_node = nt.nodes.new('CompositorNodeImage')
    image_node.image = image
    denoise = nt.nodes.new('CompositorNodeDenoise')
    composite = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(image_node.outputs['Image'], denoise.inputs['Image'])
    nt.links.new(denoise.outputs['Image'], composite.inputs['Image'])
    scene.cycles.samples = 1
    scene.render.resolution_x = scene.render.resolution_y = cfg.resolution
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'OPEN_EXR'
    scene.render.image_settings.color_depth = '32'
    scene.render.filepath = str(cfg.output / f'desk-{state}.exr')
    bpy.ops.render.render(write_still=True)
    result = bpy.data.images.load(scene.render.filepath, check_existing=False)
    pixels = np.empty(cfg.resolution * cfg.resolution * 4, dtype=np.float32)
    result.pixels.foreach_get(pixels)
    pixels = pixels.reshape(cfg.resolution, cfg.resolution, 4)
    np.save(cfg.output / f'desk-{state}.npy', pixels)
    if np.percentile(pixels[:, :, :3], 90) < .01:
        raise ValueError('Desktop bake unexpectedly dark; receiver visibility may be wrong.')
    manifest['states'][state] = {
        'sourceBlend': str(source),
        'sourceBlendSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'maxRgb': float(pixels[:, :, :3].max()),
        'percentilesRgb': np.percentile(pixels[:, :, :3], [0, 10, 50, 90, 100]).tolist(),
    }
    # Keep the receiver and exact source rig reproducible without duplicating
    # the runtime GLB; the blend and floats stay outside the deployed tree.
    scene.use_nodes = False
    scene.cycles.samples = cfg.samples
    for img in bpy.data.images:
        if img.source == 'FILE' and img.filepath:
            img.filepath = bpy.path.relpath(bpy.path.abspath(img.filepath), start=str(cfg.output))
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(cfg.output / f'desk-{state}.blend'))
    print('DESK_STATE_COMPLETE', state, manifest['states'][state], flush=True)
(cfg.output / 'desk-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
