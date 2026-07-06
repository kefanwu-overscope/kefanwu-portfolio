"""P1 lightmap bake: import the tagged bake layer (bake-layer.glb), light it
with the approved P0-A rig, atlas a second UV set, bake lighting-only
(DIFFUSE DIRECT+INDIRECT) on GPU, denoise with OIDN via the compositor, and
emit:  room-baked.glb  lightmap.hdr  probe.hdr (360 env for real-time props).

Run:
  blender.exe --background --python bake.py -- <bake-layer.glb> <outdir>
"""
import bpy, math, sys, os
import mathutils

argv = sys.argv[sys.argv.index("--") + 1:]
GLB, OUTDIR = argv[0], argv[1]
STATE = argv[2] if len(argv) > 2 else "on"   # "on" | "off"
LM_RES = int(argv[3]) if len(argv) > 3 else 4096
os.makedirs(OUTDIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=GLB)

def area(name, x, y, z, sx, sy, w, col):
    ld = bpy.data.lights.new(name, "AREA"); ld.shape = "RECTANGLE"
    ld.size, ld.size_y, ld.energy, ld.color = sx, sy, w, col
    ob = bpy.data.objects.new(name, ld); ob.location = (x, y, z)
    bpy.context.collection.objects.link(ob); return ob
COOL = (0.92, 0.96, 1.0)
if STATE == "on":
    # approved P0-A rig (bright workshop)
    area("key_a", 0.0, -0.4, 3.32, 2.6, 0.18, 110, COOL)
    area("key_b", -1.6, -0.4, 3.32, 0.18, 2.4, 70, COOL)
    area("key_c", 1.6, -0.4, 3.32, 0.18, 2.4, 70, COOL)
    area("fill", 0.0, -2.6, 3.1, 1.6, 1.2, 30, (0.85, 0.9, 1.0))
    area("cab_glow", 0.0, 1.05, 1.7, 2.2, 0.4, 12, (0.78, 0.86, 1.0))
else:
    # lights-off mood: the desk lamp is the only warm source, plus faint
    # cabinet-strip spill so the room stays navigable
    area("lamp_pool", -0.78, -0.18, 1.16, 0.16, 0.16, 9, (1.0, 0.82, 0.6))
    # warm pool centered on the RESUME so the primary CTA stays inviting at
    # night (paired with a real-time spot on the paper itself)
    area("resume_pool", 0.02, -0.16, 1.5, 0.34, 0.44, 7, (1.0, 0.87, 0.68))
    area("cab_glow", 0.0, 1.05, 1.7, 2.2, 0.4, 5, (0.78, 0.86, 1.0))
    area("fill", 0.0, -2.6, 3.1, 1.6, 1.2, 1.2, (0.7, 0.8, 1.0))

# ---- Cycles GPU ----
scene.render.engine = "CYCLES"
cp = bpy.context.preferences.addons["cycles"].preferences
try:
    cp.compute_device_type = "OPTIX"; cp.get_devices()
    for d in cp.devices: d.use = True
    scene.cycles.device = "GPU"
except Exception:
    scene.cycles.device = "CPU"
scene.cycles.samples = 512

# ---- join all imported meshes into one bake target ----
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
bpy.ops.object.join()
room = bpy.context.view_layer.objects.active
room.name = "baked_room"

# ---- second UV layer + atlas ----
lm = room.data.uv_layers.new(name="lm")
room.data.uv_layers.active = lm
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
bpy.ops.object.mode_set(mode="OBJECT")

# ---- bake image + hook it into every material as the active target ----
img = bpy.data.images.new("LM", LM_RES, LM_RES, float_buffer=True)
for mat in room.data.materials:
    if not mat: continue
    mat.use_nodes = True
    nt = mat.node_tree
    node = nt.nodes.new("ShaderNodeTexImage")
    node.image = img
    uvn = nt.nodes.new("ShaderNodeUVMap"); uvn.uv_map = "lm"
    nt.links.new(uvn.outputs["UV"], node.inputs["Vector"])
    nt.nodes.active = node
    node.select = True

# ---- bake lighting only ----
scene.cycles.bake_type = "DIFFUSE"
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = False
scene.render.bake.margin = 8
bpy.ops.object.select_all(action="DESELECT")
room.select_set(True); bpy.context.view_layer.objects.active = room
bpy.ops.object.bake(type="DIFFUSE")
raw_path = os.path.join(OUTDIR, f"lightmap-{STATE}_raw.hdr")
img.filepath_raw = raw_path; img.file_format = "HDR"; img.save()
print("BAKED", raw_path)

# ---- OIDN denoise via compositor (DIFFUSE bakes aren't auto-denoised) ----
scene.use_nodes = True
nt = scene.node_tree
for n in list(nt.nodes): nt.nodes.remove(n)
inp = nt.nodes.new("CompositorNodeImage"); inp.image = img
dn = nt.nodes.new("CompositorNodeDenoise")
out = nt.nodes.new("CompositorNodeComposite")
nt.links.new(inp.outputs["Image"], dn.inputs["Image"])
nt.links.new(dn.outputs["Image"], out.inputs["Image"])
scene.render.resolution_x = LM_RES
scene.render.resolution_y = LM_RES
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "HDR"
scene.render.filepath = os.path.join(OUTDIR, f"lightmap-{STATE}-4k.hdr")
scene.camera = None
bpy.ops.render.render(write_still=True, use_viewport=False)
print("DENOISED", scene.render.filepath)
# 2K downscale for the fast initial load / mobile tier
dn_img = bpy.data.images.load(scene.render.filepath, check_existing=False)
dn_img.scale(LM_RES // 2, LM_RES // 2)
dn_img.filepath_raw = os.path.join(OUTDIR, f"lightmap-{STATE}-2k.hdr")
dn_img.file_format = "HDR"
dn_img.save()
print("DOWNSCALED", dn_img.filepath_raw)

# ---- strip embedded textures (runtime re-attaches its own), export GLB ----
for mat in room.data.materials:
    if not mat or not mat.use_nodes: continue
    for n in list(mat.node_tree.nodes):
        if n.type == "TEX_IMAGE":
            mat.node_tree.nodes.remove(n)
bpy.ops.object.select_all(action="DESELECT")
room.select_set(True)
if STATE == "on":  # geometry identical for both states — export once
    glb_out = os.path.join(OUTDIR, "room-baked.glb")
    bpy.ops.export_scene.gltf(filepath=glb_out, use_selection=True, export_format="GLB")
    print("GLB", glb_out)

# ---- 360 equirect env probe from room center (for real-time props) ----
cam_d = bpy.data.cameras.new("probe"); cam_d.type = "PANO"
try: cam_d.panorama_type = "EQUIRECTANGULAR"
except Exception: cam_d.cycles.panorama_type = "EQUIRECTANGULAR"
cam = bpy.data.objects.new("probe", cam_d)
cam.location = (0.0, -0.6, 1.4)  # three (0, 1.4, 0.6)
cam.rotation_euler = (math.radians(90), 0, 0)
bpy.context.collection.objects.link(cam)
scene.camera = cam
scene.cycles.samples = 128
scene.render.resolution_x = 1024
scene.render.resolution_y = 512
scene.render.filepath = os.path.join(OUTDIR, f"probe-{STATE}.hdr")
scene.use_nodes = False
bpy.ops.render.render(write_still=True)
print("PROBE", scene.render.filepath)
print("ALL_DONE")
