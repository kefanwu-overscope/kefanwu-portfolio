"""Single-column tensile tester reconstructed from actual local experiment photos.

Not manufacturer CAD; machine dimensions are unmeasured display proportions.
Import in Blender and call build() -> mesh objects, materials assigned, Z-up,
XY bbox centered, bottom z=0. No camera/lights/floor created by build().
Standalone: blender -b --factory-startup -t 4 --python build_material_test.py -- --preview
All generated files stay beside this script. Preview uses Cycles CPU, 4 threads.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

HERE=Path(__file__).resolve().parent
COLLECTION='MaterialTest_Photo_Reconstruction'
_objects=[]
_collection=None


def material(name,hexcolor,metal=0,rough=.5,grain=False):
    mat=bpy.data.materials.get('MaterialTest_'+name) or bpy.data.materials.new('MaterialTest_'+name)
    col=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    mat.diffuse_color=(*[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in col],1)
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=mat.diffuse_color
    bsdf.inputs['Metallic'].default_value=metal
    bsdf.inputs['Roughness'].default_value=rough
    if grain:
        noise=mat.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value=450
        noise.inputs['Detail'].default_value=2
        bump=mat.node_tree.nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value=.13
        bump.inputs['Distance'].default_value=.00015
        mat.node_tree.links.new(noise.outputs['Fac'],bump.inputs['Height'])
        mat.node_tree.links.new(bump.outputs['Normal'],bsdf.inputs['Normal'])
    return mat


def adopt(obj,name,mat):
    obj.name='MaterialTest_'+name
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    _collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj['source_type']='photo-based display reconstruction, not manufacturer CAD'
    _objects.append(obj)
    return obj


def mesh(name,verts,faces,mat,bevel=0):
    data=bpy.data.meshes.new('MaterialTest_'+name)
    data.from_pydata(verts,[],faces)
    data.update()
    obj=bpy.data.objects.new('MaterialTest_'+name,data)
    _collection.objects.link(obj)
    data.materials.append(mat)
    obj['source_type']='photo-based display reconstruction, not manufacturer CAD'
    _objects.append(obj)
    if bevel:
        mod=obj.modifiers.new('Subtle physical edges','BEVEL')
        mod.width=bevel
        mod.segments=3
        obj.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return obj


def box(name,center,size,mat,bevel=.001):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=adopt(bpy.context.object,name,mat)
    obj.scale=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Molded edge radius','BEVEL')
        mod.width=bevel
        mod.segments=3
        obj.modifiers.new('Weighted face normals','WEIGHTED_NORMAL')
    return obj


def cylinder(name,a,b,r,mat,n=48):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r,depth=(b-a).length,location=(a+b)/2)
    obj=adopt(bpy.context.object,name,mat)
    obj.rotation_mode='QUATERNION'
    obj.rotation_quaternion=(b-a).to_track_quat('Z','Y')
    for p in obj.data.polygons:
        p.use_smooth=len(p.vertices)==4
    mod=obj.modifiers.new('Turned part edge radius','BEVEL')
    mod.width=min(.0005,r*.05)
    mod.segments=2
    return obj


def path(name,points,r,mat,bezier=False):
    data=bpy.data.curves.new('MaterialTest_'+name,'CURVE')
    data.dimensions='3D'
    data.bevel_depth=r
    data.bevel_resolution=2
    data.resolution_u=8
    sp=data.splines.new('BEZIER' if bezier else 'POLY')
    if bezier:
        sp.bezier_points.add(len(points)-1)
        for p,co in zip(sp.bezier_points,points):
            p.co=co
            p.handle_left_type=p.handle_right_type='AUTO'
    else:
        sp.points.add(len(points)-1)
        for p,co in zip(sp.points,points):
            p.co=(*co,1)
    obj=bpy.data.objects.new('MaterialTest_'+name,data)
    _collection.objects.link(obj)
    data.materials.append(mat)
    _objects.append(obj)
    return obj


def spring(name,a,b,r,mat):
    a,b=Vector(a),Vector(b)
    axis=(b-a).normalized()
    u=axis.cross(Vector((0,1,0))).normalized()
    v=axis.cross(u).normalized()
    pts=[a]
    for i in range(181):
        t=i/180
        angle=t*math.tau*18
        pts.append(a.lerp(b,.08+.84*t)+(u*math.cos(angle)+v*math.sin(angle))*r)
    pts.append(b)
    return path(name,pts,.0006,mat)


def prism_xz(name,outline,y,thick,mat):
    verts=[(x,y+side*thick/2,z) for side in [-1,1] for x,z in outline]
    n=len(outline)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    for i in range(n):
        j=(i+1)%n
        faces.append((i,j,n+j,n+i))
    return mesh(name,verts,faces,mat,.0007)


def build():
    global _objects,_collection
    _objects=[]
    if COLLECTION in bpy.data.collections:
        old=bpy.data.collections[COLLECTION]
        for obj in list(old.objects):
            bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(old)
    _collection=bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(_collection)
    m={
        'white':material('Offwhite_column_shell','DFDED5',0,.5),
        'base':material('Textured_dark_gray_base','626461',0,.63,True),
        'bellows':material('Black_flexible_bellows','191B1A',0,.7),
        'load':material('Dark_load_transducer','292B29',0,.52),
        'steel':material('Satin_silver_grips_couplings','B4B4AA',1,.42),
        'chrome':material('Polished_silver_spring_wire','BEC1BC',1,.28),
        'black':material('Black_controller_bezel','242624',0,.5),
        'red':material('Red_mushroom_stop','C84846',0,.46),
        'yellow':material('Yellow_emergency_stop_field','E2CB32',0,.48),
        'fabric':material('Charcoal_coated_fabric','282A2D',0,.58,True),
    }
    # Sloping dark base (photo's blue lab table and loose tools are excluded).
    yz=[(-.18,.012),(.16,.012),(.16,.135),(-.095,.135),(-.164,.092)]
    verts=[(x,y,z) for x in [-.175,.175] for y,z in yz]
    faces=[(4,3,2,1,0),(5,6,7,8,9)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
    mesh('sloped_base_shell',verts,faces,m['base'],.005)
    for x in [-.131,.131]:
        for y in [-.133,.12]:
            cylinder('base_foot',(x,y,0),(x,y,.014),.020,m['black'])
    # Single continuous off-white column behind the working axis; its front is
    # black accordion bellows, NOT a second column or exposed invented lead screw.
    box('single_column_back_shell',(0,.093,.487),(.115,.092,.704),m['white'],.003)
    for x in [-.054,.054]:
        box('column_face_border',(x,.042,.481),(.009,.014,.686),m['white'],.001)
    box('column_top_cap',(0,.092,.844),(.118,.095,.018),m['white'],.003)
    box('bellows_shadow_face',(0,.041,.48),(.095,.009,.684),m['bellows'],.001)
    # An actual folded surface: repeated shallow zigzag ribs, not painted stripes.
    verts,faces=[],[]
    for i in range(111):
        z=.149+i*(.672/110)
        y=.029 if i%2 else .038
        verts.extend([(-.047,y,z),(.047,y,z)])
    for i in range(110):
        j=2*i
        faces.append((j,j+1,j+3,j+2))
    bellows=mesh('accordion_folded_front',verts,faces,m['bellows'])
    solid=bellows.modifiers.new('Bellows wall','SOLIDIFY')
    solid.thickness=.0006
    # Short side scale channel and two visible stop clips, without invented text.
    box('side_scale_recess',(.060,.067,.48),(.001,.012,.67),m['steel'],0)
    for z in [.164,.632]:
        box('yellow_travel_marker',(.061,.040,z),(.004,.020,.017),m['yellow'],.0005)
        cylinder('travel_marker_knob',(.061,.038,z),(.075,.038,z),.005,m['black'])
    # Crosshead projects from the same column. Uppermost internal drive remains
    # enclosed because the photographed machine does not reveal its mechanism.
    box('black_crosshead',(0,-.007,.690),(.116,.093,.050),m['load'],.005)
    for sx in [-1,1]:
        cylinder('crosshead_fastener',(sx*.047,-.055,.69),(sx*.047,-.058,.69),.003,m['steel'])
    ax,ay=-.008,-.087
    # Dark load cell and cylindrical silver coupling above the top spring grip.
    cylinder('upper_load_cell',(ax,ay,.586),(ax,ay,.665),.027,m['load'])
    cylinder('upper_load_cell_top',(ax,ay,.665),(ax,ay,.682),.015,m['steel'])
    cylinder('load_cell_socket',(ax+.020,ay-.004,.625),(ax+.032,ay-.004,.625),.005,m['steel'])
    cylinder('upper_coupling',(ax,ay,.546),(ax,ay,.586),.020,m['steel'])
    cylinder('upper_knurled_ring',(ax,ay,.583),(ax,ay,.590),.024,m['steel'])
    cylinder('upper_cross_pin',(ax-.062,ay,.56),(ax+.062,ay,.56),.004,m['steel'])
    # Silver mounting plate and lower coaxial coupling.
    box('lower_mount_gasket',(ax,-.011,.143),(.145,.144,.010),m['black'],.002)
    box('lower_machined_plate',(ax,-.011,.150),(.137,.137,.007),m['steel'],.001)
    for x in [ax-.055,ax+.055]:
        for y in [-.065,.043]:
            cylinder('mount_plate_bolt',(x,y,.153),(x,y,.156),.0037,m['chrome'],24)
    cylinder('lower_fixed_coupler',(ax,ay,.156),(ax,ay,.227),.023,m['steel'])
    cylinder('lower_coupler_lock_ring',(ax,ay,.211),(ax,ay,.222),.026,m['steel'])
    cylinder('lower_lock_pin',(ax-.050,ay,.229),(ax+.050,ay,.229),.004,m['steel'])
    cylinder('lower_grip_stem',(ax,ay,.221),(ax,ay,.306),.018,m['steel'])
    # Fine real geometric knurling on visible silver collars.
    for z,r in [(.216,.026),(.586,.024)]:
        for i in range(50):
            a=i*math.tau/50
            cylinder('collar_knurl',(ax+r*math.cos(a),ay+r*math.sin(a),z-.003),
                     (ax+r*math.cos(a),ay+r*math.sin(a),z+.003),.00035,m['chrome'],6)
    # Spring-loaded grips. Two curved side cheeks, separated sliding wedges,
    # visible diagonal tension springs, pivots, and a center fabric path.
    def grip(z,flip):
        def P(x,zz,y=ay-.021):
            return (ax+x,y,z+flip*zz)
        outline=[(.012,.030),(.037,.033),(.047,.022),(.051,.006),(.050,-.011),
                 (.044,-.027),(.030,-.037),(.015,-.037),(.010,-.027),(.012,-.009)]
        for sx in [-1,1]:
            profile=[(ax+sx*x,z+flip*zz) for x,zz in outline]
            prism_xz('curved_spring_grip_cheek',profile,ay,.031,m['steel'])
            # Inward wedges meet around the specimen; bevels convey machined mass.
            wedge=[(ax+sx*.001,z+flip*-.040),(ax+sx*.014,z+flip*-.040),
                   (ax+sx*.019,z+flip*.004),(ax+sx*.001,z+flip*.004)]
            prism_xz('sliding_jaw_wedge',wedge,ay-.005,.027,m['steel'])
            a=P(sx*.035,.023)
            b=P(sx*.021,-.021)
            spring('diagonal_jaw_return_spring',a,b,.0024,m['chrome'])
            for p in [a,b,P(sx*.014,-.031)]:
                cylinder('jaw_spring_anchor',p,(p[0],p[1]-.004,p[2]),.0025,m['chrome'],24)
        box('grip_top_bridge',P(0,.025,ay),(.052,.030,.012),m['steel'],.001)
        for sx in [-1,1]:
            cylinder('grip_bridge_fastener',P(sx*.019,.026),P(sx*.019,.026,ay-.025),.0024,m['chrome'],24)
    # The actual material record describes a 100mm clear gauge length, roughly
    # 25mm width. Only this specimen scale is evidence based; machine scale is not.
    grip(.514,1)
    grip(.334,-1)
    # Upper jaw ends at .474; lower jaw ends at .374 -> 0.100 clear gauge.
    # Tiny out-of-plane undulation retains the fabric character without faking
    # buckling or a measured tensile-deformation result.
    verts,faces=[],[]
    for i in range(25):
        t=i/24
        z=.369+t*.11
        for j in range(5):
            s=j/4
            verts.append((ax+(s-.5)*.025,ay-.012-.0001*math.sin(t*math.pi)*math.sin(s*math.tau),z))
    for i in range(24):
        for j in range(4):
            a=i*5+j
            faces.append((a,a+1,a+6,a+5))
    strip=mesh('black_fabric_tensile_specimen',verts,faces,m['fabric'])
    solid=strip.modifiers.new('Thin specimen sheet','SOLIDIFY')
    solid.thickness=.0002
    # Right-hand control panel inset in sloped face: red mushroom, yellow field,
    # and black rocker. No branded lettering, model numbers or invented readout.
    panel=box('sloped_operator_bezel',(.111,-.143,.110),(.085,.007,.067),m['black'],.002)
    panel.rotation_euler.x=math.radians(-58)
    plate=box('yellow_emergency_stop_field',(.092,-.147,.115),(.036,.003,.044),m['yellow'],.001)
    plate.rotation_euler.x=math.radians(-58)
    n=Vector((0,-.530,.848))
    p=Vector((.092,-.150,.120))
    cylinder('emergency_stop_shank',p,p+n*.007,.009,m['black'])
    cylinder('red_emergency_stop_mushroom',p+n*.006,p+n*.015,.016,m['red'])
    rocker=box('black_jog_rocker',(.136,-.151,.116),(.015,.010,.033),m['black'],.006)
    rocker.rotation_euler.x=math.radians(-58)
    # Cable from transducer to rear shell; photographic route simplified.
    path('load_cell_signal_cable',[(ax-.022,ay,.642),(-.070,-.08,.68),(-.082,.005,.75),(-.06,.095,.77)],.0014,m['black'],True)
    # Bake only this collection, leaving the caller's studio untouched.
    bpy.ops.object.select_all(action='DESELECT')
    for obj in _objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=_objects[0]
    bpy.ops.object.convert(target='MESH')
    _objects=list(_collection.objects)
    bpy.context.view_layer.update()
    for obj in _objects:
        obj.data.transform(obj.matrix_world)
        obj.matrix_world=Matrix.Identity(4)
    pts=[v.co for obj in _objects for v in obj.data.vertices]
    lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)))
    hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
    shift=Matrix.Translation(Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z)))
    for obj in _objects:
        obj.data.transform(shift)
        obj['geometry_accuracy']='Photo-derived visible structure; machine dimensions inferred, not fabrication CAD'
    return list(_objects)


def proof(objects,width=720,height=480):
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    scene.cycles.samples=24
    scene.cycles.use_denoising=True
    scene.cycles.max_bounces=6
    scene.render.threads_mode='FIXED'
    scene.render.threads=4
    scene.render.resolution_x=width
    scene.render.resolution_y=height
    scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    scene.view_settings.look='AgX - Medium High Contrast'
    world=bpy.data.worlds.new('Material test proof world')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.10,.11,.13,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.2
    scene.world=world
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.001))
    floor=bpy.context.object
    floor.name='Proof floor only (not model)'
    floor.data.materials.append(material('Proof_floor','202329',.08,.42))
    def aim(obj,target):
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    for name,loc,power,size in [('key',(.8,-.7,1.5),25,1.2),('fill',(-.8,-.5,.9),12,1),('rim',(.5,.9,1.1),35,.7)]:
        data=bpy.data.lights.new('Proof_'+name,'AREA')
        data.energy=power
        data.size=size
        obj=bpy.data.objects.new(data.name,data)
        scene.collection.objects.link(obj)
        obj.location=loc
        aim(obj,(0,0,.4))
    data=bpy.data.cameras.new('Material test proof camera')
    cam=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(cam)
    cam.location=(.65,-2.1,.95)
    aim(cam,(0,0,.43))
    data.type='ORTHO'
    bpy.context.view_layer.update()
    inv=cam.matrix_world.inverted()
    pts=[inv@v.co for o in objects for v in o.data.vertices]
    xmin,xmax=min(v.x for v in pts),max(v.x for v in pts)
    ymin,ymax=min(v.y for v in pts),max(v.y for v in pts)
    cam.location+=cam.matrix_world.to_quaternion()@Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
    data.ortho_scale=max(xmax-xmin,(ymax-ymin)*width/height)*1.15
    scene.camera=cam
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(HERE/('proof-%dx%d.png'%(width,height)))
    bpy.ops.render.render(write_still=True)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--preview',action='store_true')
    parser.add_argument('--large',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objects=build()
    bpy.context.preferences.filepaths.save_version=0
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC'
    scene['provenance']='Photo reconstruction, not manufacturer CAD; see provenance.json.'
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'material-test.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(HERE/'material-test.glb'),export_format='GLB',use_selection=True,
                             export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    pts=[v.co for o in objects for v in o.data.vertices]
    result={'meshes':len(objects),'vertices':sum(len(o.data.vertices) for o in objects),
            'bounds_min':[min(p[i] for p in pts) for i in range(3)],
            'bounds_max':[max(p[i] for p in pts) for i in range(3)],
            'materials':sorted({m.name for o in objects for m in o.data.materials}),
            'build_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            'glb_sha256':hashlib.sha256((HERE/'material-test.glb').read_bytes()).hexdigest()}
    print('MATERIAL_TEST_BUILD_RESULT '+json.dumps(result),flush=True)
    prov=HERE/'provenance.json'
    if prov.exists():
        doc=json.loads(prov.read_text(encoding='utf-8-sig'))
        doc['build_result']=result
        prov.write_text(json.dumps(doc,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    if args.preview:
        proof(objects,1600 if args.large else 720,1067 if args.large else 480)


if __name__=='__main__':
    main()
