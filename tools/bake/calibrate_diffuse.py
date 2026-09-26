"""Measure Cycles colorless diffuse-bake units in a uniform unit-radiance world."""
import bpy
import json
import math
from pathlib import Path
import sys

out = Path(sys.argv[sys.argv.index('--') + 1]).resolve()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.world = bpy.data.worlds.new('Unit radiance world')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (1, 1, 1, 1)
bg.inputs['Strength'].default_value = 1
bpy.ops.mesh.primitive_plane_add(size=2)
plane = bpy.context.object
mat = bpy.data.materials.new('Ideal white Lambertian')
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
diffuse = nt.nodes.new('ShaderNodeBsdfDiffuse')
diffuse.inputs['Color'].default_value = (1, 1, 1, 1)
surface = nt.nodes.new('ShaderNodeOutputMaterial')
nt.links.new(diffuse.outputs[0], surface.inputs['Surface'])
img = bpy.data.images.new('Calibration', 32, 32, float_buffer=True)
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
nt.nodes.active = tex
plane.data.materials.append(mat)
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = False
bpy.ops.object.bake(type='DIFFUSE')
values = list(img.pixels)
mean = [sum(values[c::4]) / (32 * 32) for c in range(3)]
result = {
    'blender': bpy.app.version_string,
    'method': 'Ideal white Diffuse BSDF plane; uniform world RGB=(1,1,1), strength=1; DIFFUSE DIRECT+INDIRECT with COLOR disabled; 32x32, 64 samples.',
    'expectedOutgoingRadiance': 1,
    'expectedIncidentIrradiance': math.pi,
    'measuredMeanBakeRgb': mean,
    'bakeUnits': 'outgoing unit-albedo Lambertian radiance = irradiance/pi',
    'threeR185REIndirectDiffuseInput': 'decoded lightmap RGB * PI * lightMapIntensity',
    'passed': all(abs(c - 1) < .002 for c in mean),
}
out.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result), flush=True)
