"""Consistent offline product photography for the complete project catalogue.

Only source transforms and appearance are applied to supplied CAD. Generated
display models are explicitly identified in per-image provenance records.
"""
import argparse
import hashlib
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Euler, Matrix, Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--projects', nargs='+', required=True)
parser.add_argument('--draft', action='store_true')
parser.add_argument('--angle', type=int, default=0)
parser.add_argument('--save-blend', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
CATALOG = json.loads((HERE / 'catalog.json').read_text(encoding='utf-8'))

def linear_hex(value):
    value = value.lstrip('#')
    channels = [int(value[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= .04045 else ((x + .055) / 1.055) ** 2.4 for x in channels)

def material(name, color='AEB6C0', metallic=0, roughness=.4,
             transmission=0, texture=None, coat=0, specular=.5, ior=1.46,
             grainRotation=0, grainAxis='X', **unused):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*linear_hex(color), 1)
    tree = mat.node_tree
    p = tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = mat.diffuse_color
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['IOR'].default_value = ior
    p.inputs['Specular IOR Level'].default_value = specular
    p.inputs['Coat Weight'].default_value = coat
    p.inputs['Coat Roughness'].default_value = .24
    if texture in ('wood', 'carbon', 'printed', 'pearloid'):
        coord = tree.nodes.new('ShaderNodeTexCoord')
        mapping = tree.nodes.new('ShaderNodeVectorMath')
        mapping.operation = 'MULTIPLY'
        mapping.inputs[1].default_value = ((80,80,4) if grainAxis=='Z' else (4,80,80)) if texture == 'wood' else (1,1,1)
        if texture == 'wood' and grainRotation:
            rotate = tree.nodes.new('ShaderNodeVectorRotate')
            rotate.rotation_type = 'AXIS_ANGLE'
            rotate.inputs['Axis'].default_value = (0,0,1)
            rotate.inputs['Angle'].default_value = math.radians(grainRotation)
            tree.links.new(coord.outputs['Object'], rotate.inputs['Vector'])
            tree.links.new(rotate.outputs['Vector'], mapping.inputs[0])
        else:
            tree.links.new(coord.outputs['Generated'], mapping.inputs[0])
        tex = tree.nodes.new('ShaderNodeTexChecker' if texture == 'carbon' else 'ShaderNodeTexNoise')
        tree.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        tex.inputs['Scale'].default_value = 240 if texture == 'carbon' else 3 if texture == 'wood' else 40 if texture == 'pearloid' else 170
        if texture == 'carbon':
            tex.inputs['Color1'].default_value = (*linear_hex('191B1D'),1)
            tex.inputs['Color2'].default_value = (*linear_hex('242628'),1)
            tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])
        elif texture in ('wood', 'pearloid'):
            ramp = tree.nodes.new('ShaderNodeValToRGB')
            base = linear_hex(color)
            ramp.color_ramp.elements[0].position = .2
            ramp.color_ramp.elements[0].color = (*(x*(.42 if texture == 'pearloid' else .66) for x in base),1)
            ramp.color_ramp.elements[1].position = .8
            ramp.color_ramp.elements[1].color = (*(min(x*1.2,1) for x in base),1)
            tree.links.new(tex.outputs['Fac'], ramp.inputs['Fac'])
            tree.links.new(ramp.outputs['Color'], p.inputs['Base Color'])
        bump = tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .05 if texture == 'carbon' else .08
        bump.inputs['Distance'].default_value = .0002 if texture == 'carbon' else .0006
        tree.links.new(tex.outputs['Fac'], bump.inputs['Height'])
        tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return mat

DEFAULTS = {
 'steel': {'color':'BBC1C8','metallic':.9,'roughness':.32},
 'printed': {'color':'30363D','metallic':0,'roughness':.43,'texture':'printed'},
 'dark': {'color':'202328','metallic':.12,'roughness':.4},
 'aero': {'color':'E3E1DB','metallic':0,'roughness':.45},
 'rubber': {'color':'181B1E','metallic':0,'roughness':.62},
 'brass': {'color':'AD8954','metallic':.8,'roughness':.34},
 'glass': {'color':'E7EDF0','metallic':0,'roughness':.1,'transmission':1},
 'wood': {'color':'BE9C68','metallic':0,'roughness':.43,'texture':'wood'},
 'carbon': {'color':'171A20','metallic':.05,'roughness':.3,'texture':'carbon','coat':.3},
 'pcb': {'color':'166C79','metallic':0,'roughness':.44},
}

def aim(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(name, location, target, energy, size, color, height):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy, data.color, data.shape = energy, color, 'RECTANGLE'
    data.size, data.size_y = size, height
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    aim(obj, target)

def box(name, location, scale, mat, bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new('Manufactured enclosure edge', 'BEVEL')
        modifier.width, modifier.segments = bevel, 3
        obj.modifiers.new('Corner normals', 'WEIGHTED_NORMAL')
    return obj

def cfd_display():
    """Presentation monitor carrying an unchanged, genuine solver result image."""
    dark = material('Graphite anodized display housing','292D32',.6,.34)
    bezel = material('Matte black display bezel','101317',.05,.38)
    objects = [box('Display back enclosure',(0,0,1.3),(2.8,.105,1.64),dark),
               box('Display front bezel',(0,-.059,1.3),(2.76,.022,1.60),bezel),
               box('Stand riser',(0,.035,.36),(.115,.15,.61),dark),
               box('Stand foot',(0,-.06,.037),(.8,.49,.074),dark)]
    screen = material('Verified CFD result — supplied image','FFFFFF',0,.5)
    tree = screen.node_tree
    image = tree.nodes.new('ShaderNodeTexImage')
    image.image = bpy.data.images.load(str(ROOT / 'assets/cover-ansys-cfd.webp'))
    p = tree.nodes.get('Principled BSDF')
    tree.links.new(image.outputs['Color'],p.inputs['Base Color'])
    tree.links.new(image.outputs['Color'],p.inputs['Emission Color'])
    p.inputs['Emission Strength'].default_value = .6
    p.inputs['Specular IOR Level'].default_value = .1
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0,-.072,1.3), rotation=(math.pi/2,0,0))
    plane = bpy.context.object
    plane.name = 'Actual Ansys Fluent Cp result, unmodified texture'
    plane.scale = (2.68,1.508,1)
    plane.data.materials.append(screen)
    objects.append(plane)
    return objects

def normalize(objects, cfg):
    bpy.context.view_layer.update()
    rotation = Euler(tuple(math.radians(x) for x in cfg.get('rotation',[0,0,0])), 'XYZ').to_matrix().to_4x4()
    if 'threeRotation' in cfg:
        x,y,z = [math.radians(a) for a in cfg['threeRotation']]
        conversion = Matrix.Rotation(math.pi/2,4,'X')
        rotation = conversion @ Matrix.Rotation(x,4,'X') @ Matrix.Rotation(y,4,'Y') @ Matrix.Rotation(z,4,'Z') @ conversion.inverted()
    points = [rotation @ o.matrix_world @ v.co for o in objects for v in o.data.vertices]
    lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
    center = (lo+hi)*.5
    factor = 2.8 / max(hi-lo)
    for obj in objects:
        original = rotation @ obj.matrix_world.copy()
        # glTF split normals carry the source pose. Transform them with the
        # vertices; leaving them behind makes rotated surfaces reflect light
        # from the wrong direction, washing out their actual material colors.
        normals = None
        if cfg.get('source') and obj.data.has_custom_normals:
            normal_matrix = original.to_3x3().inverted().transposed()
            normals = [(normal_matrix @ n.vector).normalized() for n in obj.data.corner_normals]
        obj.parent = None
        obj.matrix_world.identity()
        obj.data = obj.data.copy()
        for vertex in obj.data.vertices:
            vertex.co = (original @ vertex.co - center) * factor
            vertex.co.z += (hi.z-lo.z)*factor*.5 + .025
        if cfg.get('source'):
            obj.data.set_sharp_from_angle(angle=math.radians(36))
            for face in obj.data.polygons:
                face.use_smooth = True
        obj.data.update()
        if normals:
            obj.data.normals_split_custom_set(normals)
    return [o.matrix_world @ v.co for o in objects for v in o.data.vertices], list(hi-lo)

def render(key):
    cfg = CATALOG[key]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type='OPTIX'
        prefs.get_devices()
        for device in prefs.devices: device.use = device.type=='OPTIX'
        scene.cycles.device='GPU'
    except Exception: scene.cycles.device='CPU'
    scene.cycles.samples = 24 if args.draft else 192
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold=.02 if args.draft else .008
    scene.cycles.max_bounces=10
    scene.cycles.transmission_bounces=8
    scene.render.threads_mode='AUTO'
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    scene.view_settings.exposure=.2
    world=bpy.data.worlds.new('Graphite studio world')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.09,.105,.13,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.35
    scene.world=world
    source = ROOT / cfg['source'] if cfg.get('source') else None
    if source:
        bpy.ops.import_scene.gltf(filepath=str(source))
        objects = [o for o in bpy.context.selected_objects if o.type=='MESH']
        if not cfg.get('preserveMaterials'):
            mat_settings = {name:{**setting,**cfg.get('materials',{}).get(name,{})} for name,setting in DEFAULTS.items()}
            for name,setting in cfg.get('materials',{}).items():
                if name not in mat_settings: mat_settings[name] = setting
            mats = {name:material(name,**setting) for name,setting in mat_settings.items()}
            for obj in objects:
                bucket=obj.name.removeprefix('mat_').split('.')[0]
                obj.data.materials.clear()
                obj.data.materials.append(mats.get(bucket,mats['printed']))
    elif key=='ansysCfd':
        objects=cfd_display()
    elif cfg.get('builder'):
        spec=importlib.util.spec_from_file_location(key+'_build',ROOT/cfg['builder'])
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        objects=module.build()
    else: raise ValueError('No geometry for '+key)
    counts={o.name:len(o.data.polygons) for o in objects}
    points, extents = normalize(objects,cfg)
    zmax=max(p.z for p in points)
    target=Vector((0,0,zmax*.5))
    directions=cfg.get('directions',[[1,-1.7,.86],[-1,-1.7,.86],[1,1.7,.86]])
    direction=Vector(directions[args.angle%len(directions)]).normalized()
    camera_data=bpy.data.cameras.new('Product camera')
    camera=bpy.data.objects.new('Camera',camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location=target+direction*12
    aim(camera,target)
    camera_data.type='ORTHO'
    camera_data.sensor_fit='HORIZONTAL'
    scene.camera=camera
    width,height=(720,480) if args.draft else (1800,1200)
    scene.render.resolution_x,scene.render.resolution_y=width,height
    scene.render.resolution_percentage=100
    right=camera.rotation_euler.to_quaternion()@Vector((1,0,0))
    up=camera.rotation_euler.to_quaternion()@Vector((0,1,0))
    px=[p.dot(right) for p in points]
    py=[p.dot(up) for p in points]
    camera_data.ortho_scale=max(max(px)-min(px),(max(py)-min(py))*width/height)/cfg.get('fill',.82)
    camera.location += right*((max(px)+min(px))*.5-target.dot(right))+up*((max(py)+min(py))*.5-target.dot(up))
    area('Large silver key',target+direction*3.5-right*3+up*3,target,650,4,(1,.97,.94),3)
    area('Long overhead reflection',target+up*4-direction*.5,target,700,4.5,(.92,.96,1),.8)
    area('Neutral front fill',target+direction*4+right*3,target,280,3,(.9,.94,1),4)
    area('Restrained cold rim',target-direction*2+right*2.4+up*1.6,target,180,.5,(.35,.58,1),4)
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.02))
    ground=bpy.context.object
    ground.name='Graphite photographic sweep — staging only'
    ground.data.materials.append(material('Graphite sweep','07090C',0,.8))
    ground.data.materials[0].node_tree.nodes['Principled BSDF'].inputs['Specular IOR Level'].default_value=.16
    output=HERE/('catalog-drafts' if args.draft else 'renders')
    output.mkdir(exist_ok=True)
    stem=f'{key}-wide'+(f'-angle{args.angle}' if args.draft else '')
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGB'
    scene.render.image_settings.color_depth='8'
    scene.render.filepath=str(output/(stem+'.png'))
    if args.save_blend: bpy.ops.wm.save_as_mainfile(filepath=str(output/(stem+'.blend')))
    bpy.ops.render.render(write_still=True)
    builder = ROOT/cfg.get('builder','tools/editorial-render/render_catalog.py')
    record={'project':key,'source':cfg.get('source'),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest() if source else None,
      'renderer':'tools/editorial-render/render_catalog.py','rendererSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
      'builder':cfg.get('builder'),'builderSha256':hashlib.sha256(builder.read_bytes()).hexdigest() if not source else None,
      'sourceMeshFaceCounts':counts,'sourceDimensionsAfterRotation':extents,'dimensions':[width,height],
      'cameraDirectionBlenderZUp':list(direction),'angleIndex':args.angle,'samples':scene.cycles.samples,
      'geometryPolicy':cfg.get('geometryPolicy','Supplied CAD geometry: rotation, uniform scale, translation, and shading only. No replacement or decimation.'),
      'materialDefaults':DEFAULTS,'materialAssignments':cfg.get('materials',{}),'references':cfg.get('references',[]),
      'notes':cfg.get('notes',[])}
    (output/(stem+'.json')).write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
    print('CATALOG_RENDER_COMPLETE',key,scene.render.filepath,flush=True)

for key in args.projects: render(key)
