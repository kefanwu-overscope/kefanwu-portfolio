"""P0 feasibility render: import the browser-exported static room GLB and
produce a Cycles path-traced render from the site's rest camera pose, to
compare against the current real-time look before committing to the full
baking pipeline.

Run headless:
  blender.exe --background --python p0_render.py -- <static-room.glb> <out.png>

Lighting strategy: the glTF carries the site's emissive materials (cabinet
shelf strips, cove strips, screens) — Cycles treats emissive surfaces as area
lights, so we mostly boost their strength and add a few ceiling fixtures.
"""
import bpy
import math
import sys

argv = sys.argv[sys.argv.index("--") + 1:]
GLB = argv[0]
OUT = argv[1]

# ---- clean scene ----
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---- import the room ----
bpy.ops.import_scene.gltf(filepath=GLB)
print(f"imported {len(bpy.data.objects)} objects")

# ---- boost the imported emissive strips so they act as real light sources ----
boosted = 0
for mat in bpy.data.materials:
    if not mat.use_nodes:
        continue
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            emis = node.inputs.get("Emission Strength")
            ecol = node.inputs.get("Emission Color")
            if emis and ecol and emis.default_value > 0:
                c = ecol.default_value
                if c[0] + c[1] + c[2] > 0.3:  # skip near-black emissives
                    emis.default_value = max(emis.default_value * 14.0, 8.0)
                    boosted += 1
print(f"boosted {boosted} emissive materials")

# ---- ceiling fixtures: three recessed linear cool-white area lights ----
def area_light(name, x, y, z, sx, sy, watts, temp_rgb):
    ld = bpy.data.lights.new(name, type="AREA")
    ld.shape = "RECTANGLE"
    ld.size = sx
    ld.size_y = sy
    ld.energy = watts
    ld.color = temp_rgb
    ob = bpy.data.objects.new(name, ld)
    ob.location = (x, y, z)  # glTF import is +Z up in Blender coords below
    bpy.context.collection.objects.link(ob)
    return ob

# NOTE: glTF importer converts three.js (y-up) to Blender (z-up):
# three (x, y, z) -> blender (x, -z, y)
COOL = (0.92, 0.96, 1.0)
area_light("key_a", 0.0, -0.4, 3.32, 2.6, 0.18, 110, COOL)   # over desk/cabinet
area_light("key_b", -1.6, -0.4, 3.32, 0.18, 2.4, 70, COOL)   # over workbench (three x=-1.6)
area_light("key_c", 1.6, -0.4, 3.32, 0.18, 2.4, 70, COOL)    # over right cabinet
area_light("fill", 0.0, -2.6, 3.1, 1.6, 1.2, 30, (0.85, 0.9, 1.0))  # soft front fill

# ---- camera at the site's rest pose ----
# three.js: pos (1.55, 1.58, 2.6) target (0, 1.08, -0.1)  [y-up]
# blender:  pos (x, -z, y) = (1.55, -2.6, 1.58), target (0, 0.1, 1.08)
cam_data = bpy.data.cameras.new("cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(42)
cam = bpy.data.objects.new("cam", cam_data)
cam.location = (1.55, -2.6, 1.58)
bpy.context.collection.objects.link(cam)
scene.camera = cam
# aim at the target
import mathutils
direction = mathutils.Vector((0, 0.1, 1.08)) - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

# ---- Cycles settings ----
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons.get("cycles")
if prefs:
    cp = prefs.preferences
    try:
        cp.compute_device_type = "OPTIX"
        cp.get_devices()
        for d in cp.devices:
            d.use = True
        scene.cycles.device = "GPU"
        print("using OPTIX GPU")
    except Exception:
        try:
            cp.compute_device_type = "CUDA"
            cp.get_devices()
            for d in cp.devices:
                d.use = True
            scene.cycles.device = "GPU"
            print("using CUDA GPU")
        except Exception:
            scene.cycles.device = "CPU"
            print("using CPU")
scene.cycles.samples = 384
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "Filmic"
scene.view_settings.look = "Medium Contrast"
scene.render.resolution_x = 900
scene.render.resolution_y = 1230
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = OUT

bpy.ops.render.render(write_still=True)
print("RENDER_DONE", OUT)
