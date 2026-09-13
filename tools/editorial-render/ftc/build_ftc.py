"""Photo-based FTC 12589 display reconstruction, NOT original manufacturing CAD.

Blender 4.5: import this module and call build() -> list[bpy.types.Object].
Meshes have assigned evidence-based materials, baked world coordinates, Z-up,
XY bounding-box center at zero and minimum Z = 0; unit is nominal metres.
No scene reset, camera, lights, or floor are introduced by build().

Standalone: blender -b --factory-startup -t 4 --python build_ftc.py -- --preview
Saves ftc.blend (model only), ftc.glb and an optional CPU-only proof render.
All writes remain beside this script. See provenance.json for limitations.
"""
import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
COLLECTION = 'FTC_Photo_Reconstruction'
_objects = []
_collection = None


def srgb(hexcolor):
    c = [int(hexcolor[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in c)


def material(label, color, metal=0, rough=.4):
    name = 'FTC_' + label
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*srgb(color), 1)
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = mat.diffuse_color
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    return mat


def adopt(obj, name, mat, smooth=False):
    obj.name = 'FTC_' + name
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    _collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj['source_type'] = 'photo-based display reconstruction'
    if smooth:
        for face in obj.data.polygons:
            face.use_smooth = True
    _objects.append(obj)
    return obj


def mesh(name, verts, faces, mat, smooth=False):
    data = bpy.data.meshes.new('FTC_' + name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new('FTC_' + name, data)
    _collection.objects.link(obj)
    data.materials.append(mat)
    obj['source_type'] = 'photo-based display reconstruction'
    for face in data.polygons:
        face.use_smooth = smooth
    _objects.append(obj)
    return obj


def box(name, loc, size, mat, bevel=.0007):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = adopt(bpy.context.object, name, mat)
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Small physical edge radius', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod = obj.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return obj


def beam(name, a, b, width, depth, mat):
    a, b = Vector(a), Vector(b)
    obj = box(name, (a + b) / 2, (width, depth, (b-a).length), mat)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (b-a).to_track_quat('Z', 'Y')
    return obj


def cylinder(name, a, b, radius, mat, sides=32):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius,
                                       depth=(b-a).length, location=(a+b)/2)
    obj = adopt(bpy.context.object, name, mat, True)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = (b-a).to_track_quat('Z', 'Y')
    # End caps stay flat; only the cylindrical wall is smooth.
    for p in obj.data.polygons:
        p.use_smooth = len(p.vertices) == 4
    return obj


def wire(name, points, radius, mat):
    data = bpy.data.curves.new('FTC_' + name, 'CURVE')
    data.dimensions = '3D'
    data.bevel_depth = radius
    data.bevel_resolution = 2
    data.resolution_u = 10
    spline = data.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new('FTC_' + name, data)
    _collection.objects.link(obj)
    data.materials.append(mat)
    _objects.append(obj)
    return obj


def perforated(name, center, u, v, length, width, mat, pitch=.016, thick=.002):
    """Actual through-holes in a thin plate; tiled rings avoid costly booleans.

    Alternating large center holes / small bolt holes reflect the photographed
    multi-hole channel, but are NOT a certified vendor drilling specification.
    """
    u, v, center = Vector(u).normalized(), Vector(v).normalized(), Vector(center)
    n = u.cross(v).normalized()
    nx, ny = max(1, round(length/pitch)), max(1, round(width/pitch))
    dx, dy = length/nx, width/ny
    verts, faces = [], []
    for ix in range(nx):
        for iy in range(ny):
            mid = center + u*((ix+.5)*dx-length/2) + v*((iy+.5)*dy-width/2)
            radius = .0057 if iy == ny//2 and ix % 2 == 0 and ny > 1 else .0021
            radius = min(radius, dx*.36, dy*.36)
            corners = [math.atan2(sy*dy, sx*dx) % (2*math.pi) for sx, sy in [(1,1),(-1,1),(-1,-1),(1,-1)]]
            angles = sorted(set([round(i*math.tau/16, 8) for i in range(16)] + [round(a,8) for a in corners]))
            start, count = len(verts), len(angles)
            for z in [-thick/2, thick/2]:
                for outer in [False, True]:
                    for angle in angles:
                        ca, sa = math.cos(angle), math.sin(angle)
                        r = min(dx/2/max(abs(ca),1e-9), dy/2/max(abs(sa),1e-9)) if outer else radius
                        verts.append(mid + u*(ca*r) + v*(sa*r) + n*z)
            for k in range(count):
                j = (k+1) % count
                # bottom, top, hole wall; outermost walls only at the sheet perimeter
                faces.extend([(start+k,start+count+k,start+count+j,start+j),
                              (start+2*count+k,start+2*count+j,start+3*count+j,start+3*count+k),
                              (start+k,start+j,start+2*count+j,start+2*count+k)])
                if ix in (0,nx-1) or iy in (0,ny-1):
                    faces.append((start+count+k,start+3*count+k,start+3*count+j,start+count+j))
    return mesh(name, verts, faces, mat)


def channel(name, a, b, width, depth, mat, across=(1,0,0)):
    a, b, u = Vector(a), Vector(b), Vector(across).normalized()
    v = (b-a).normalized()
    n = u.cross(v).normalized()
    mid, length = (a+b)/2, (b-a).length
    perforated(name+'_web', mid, v, u, length, width, mat)
    for side in [-1, 1]:
        perforated(name+'_flange', mid + u*side*(width/2-.001) + n*depth/2,
                   v, n, length, depth, mat)


def bolt(name, p, axis, mat, radius=.003):
    p, axis = Vector(p), Vector(axis).normalized()
    cylinder(name+'_washer', p-axis*.0005, p+axis*.0005, radius*1.35, mat, 20)
    cylinder(name+'_head', p, p+axis*.0022, radius, mat, 6)


def annular_arc(name, origin, u, v, inner, outer, a0, a1, depth, mat, steps=40):
    origin, u, v = Vector(origin), Vector(u), Vector(v)
    n = u.cross(v).normalized()
    verts, faces = [], []
    for k in range(steps+1):
        a = a0+(a1-a0)*k/steps
        d = u*math.cos(a)+v*math.sin(a)
        verts.extend([origin+d*inner-n*depth/2,origin+d*outer-n*depth/2,
                      origin+d*inner+n*depth/2,origin+d*outer+n*depth/2])
    for k in range(steps):
        i=k*4
        faces.extend([(i,i+4,i+5,i+1),(i+2,i+3,i+7,i+6),
                      (i,i+2,i+6,i+4),(i+1,i+5,i+7,i+3)])
    faces.extend([(0,1,3,2),(steps*4,steps*4+2,steps*4+3,steps*4+1)])
    return mesh(name,verts,faces,mat)


def roller(name, center, axis, mat):
    """Rounded barrel roller, major axis at 45 degrees to wheel spin axis."""
    center, axis = Vector(center), Vector(axis).normalized()
    u = axis.cross(Vector((0,0,1))).normalized()
    v = axis.cross(u).normalized()
    rings=[(-.022,.003),(-.020,.0055),(-.015,.0082),(-.007,.0095),
           (.007,.0095),(.015,.0082),(.020,.0055),(.022,.003)]
    verts,faces=[],[]
    for pos,r in rings:
        for i in range(20):
            a=i*math.tau/20
            verts.append(center+axis*pos+(u*math.cos(a)+v*math.sin(a))*r)
    for k in range(len(rings)-1):
        for i in range(20):
            j=(i+1)%20
            faces.append((k*20+i,k*20+j,(k+1)*20+j,(k+1)*20+i))
    faces.extend([tuple(range(19,-1,-1)),tuple((len(rings)-1)*20+i for i in range(20))])
    return mesh(name,verts,faces,mat,True)


def build():
    global _objects, _collection
    _objects=[]
    if COLLECTION in bpy.data.collections:
        old=bpy.data.collections[COLLECTION]
        for obj in list(old.objects):
            bpy.data.objects.remove(obj,do_unlink=True)
        bpy.data.collections.remove(old)
    _collection=bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(_collection)
    m={
        'alu':material('Silver_aluminum_channels','C6C8CA',.88,.29),
        'rail':material('Satin_extruded_slide','AAAEB2',.86,.30),
        'steel':material('Steel_fasteners_shafts','B9BDC2',.92,.25),
        'frame':material('Black_structural_links','20242A',.25,.38),
        'black':material('Black_polymer_electronics','181B20',0,.44),
        'rubber':material('Graphite_elastomer_rollers','45484D',0,.62),
        'red':material('Red_polymer_panels','BF2825',0,.34),
        'tape':material('Red_grip_tape','DC3027',0,.40),
        'blue':material('Blue_printed_deposit_support','244AA5',0,.43),
        'white':material('Offwhite_claw_and_spool','E9E3D7',0,.40),
        'cable':material('Black_belts_wire_sleeves','101317',0,.60),
        'yellow':material('Yellow_signal_wire','D7B849',0,.45),
    }
    # Nominal 0.40 x 0.42m chassis: dimensions inferred, not measured CAD.
    # Open, perforated structure is deliberately preserved at card-view distance.
    for x in [-.155,.155]:
        channel('longitudinal_chassis_channel',(x,-.18,.078),(x,.18,.078),.048,.032,m['alu'])
    for y in [-.177,.17]:
        channel('cross_chassis_channel',(-.15,y,.09),(.15,y,.09),.048,.032,m['alu'],(0,1,0))
    box('electronics_tray',(0,.07,.099),(.232,.195,.003),m['frame'])
    # Four mecanum wheel assemblies; exact rim detail is inferred from the
    # project's stated drivetrain and existing buildFtcBot(), not visible CAD.
    for sx in [-1,1]:
        for sy in [-1,1]:
            x,y,z=sx*.207,sy*.146,.047
            cylinder('drive_axle',(sx*.155,y,z),(sx*.229,y,z),.005,m['steel'])
            cylinder('mecanum_center',(x-.014,y,z),(x+.014,y,z),.023,m['black'])
            for side in [-1,1]:
                xx=x+side*.012
                cylinder('wheel_center_disc',(xx-.001,y,z),(xx+.001,y,z),.026,m['frame'])
                for i in range(5):
                    a=i*math.tau/5
                    end=(xx,y+.037*math.cos(a),z+.037*math.sin(a))
                    beam('wheel_spoke',(xx,y,z),end,.006,.003,m['frame'])
            for i in range(10):
                a=(i+.25)*math.tau/10
                p=Vector((x,y+.039*math.cos(a),z+.039*math.sin(a)))
                axis=Vector((1,-sx*sy*math.sin(a),sx*sy*math.cos(a))).normalized()
                roller('mecanum_barrel',p,axis,m['rubber'])
                cylinder('roller_pin',p-axis*.024,p+axis*.024,.0016,m['steel'],12)
            bolt('axle_screw',(x+sx*.023,y,z),(sx,0,0),m['steel'],.004)
    # Exposed silver DC cans with black gearboxes, as in the mechanism photos.
    for i,y in enumerate([-.12,-.045,.036,.116]):
        cylinder('silver_DC_motor',(-.069,y,.124),(.045,y,.124),.020,m['alu'])
        cylinder('black_gearhead',(.046,y,.124),(.075,y,.124),.021,m['black'])
        cylinder('motor_rear_cap',(-.078,y,.124),(-.066,y,.124),.020,m['black'])
        cylinder('motor_output',(.074,y,.124),(.102,y,.124),.004,m['steel'])
        wire('red_motor_lead',[(-.078,y,.137),(-.113,y,.175),(-.087,.04,.193),(.03,.095,.16)],.0015,m['tape'])
        wire('black_motor_lead',[(-.078,y+.007,.137),(-.12,y+.006,.17),(-.096,.04,.189),(.039,.095,.16)],.0015,m['cable'])
    for sx in [-1,1]:
        x=sx*.179
        for y in [-.146,.146]:
            cylinder('belt_pulley',(x-.005,y,.08),(x+.005,y,.08),.024,m['frame'])
            cylinder('pulley_boss',(x-.007,y,.08),(x+.007,y,.08),.008,m['steel'])
        for z in [.104,.056]:
            beam('belt_straight_run',(x,-.146,z),(x,.146,z),.010,.003,m['cable'])
        for y,a0,a1 in [(-.146,math.pi/2,3*math.pi/2),(.146,-math.pi/2,math.pi/2)]:
            annular_arc('belt_end',(x,y,.08),(0,1,0),(0,0,1),.023,.026,a0,a1,.010,m['cable'])
    # Thin red competition panels. No invented logos, sponsor marks or labels.
    box('rear_red_guard',(0,.202,.12),(.384,.0025,.081),m['red'])
    box('front_red_guard',(0,-.202,.12),(.384,.0025,.062),m['red'])
    for sx in [-1,1]:
        box('red_side_guard',(sx*.185,0,.126),(.0025,.216,.068),m['red'])
        for y in [-.088,.088]:
            for z in [.109,.148]:
                bolt('panel_rivet',(sx*.187,y,z),(sx,0,0),m['steel'],.0022)
    # Black A-frame seen in the full competition image and pit close-ups.
    for x in [-.135,.135]:
        apex=Vector((x,.006,.465))
        for y in [-.176,.174]:
            foot=Vector((x,y,.11))
            beam('black_Aframe_link',foot,apex,.019,.025,m['frame'])
            for t,mat in [(.24,m['tape']),(.34,m['white'])]:
                pos=foot.lerp(apex,t)
                patch=box('link_identification_tape',pos,(.0197,.026,.037),mat,.0003)
                patch.rotation_mode='QUATERNION'
                patch.rotation_quaternion=(apex-foot).to_track_quat('Z','Y')
            for p in [foot,apex]:
                bolt('link_pivot',p+Vector((.012,0,0)),(1,0,0),m['steel'],.0034)
        wire('routed_black_sleeve',[(x,-.17,.12),(x-.013,-.13,.20),(x-.014,-.07,.34),(x-.012,.006,.465)],.003,m['cable'])
    beam('Aframe_top_tie',(-.135,.006,.465),(.135,.006,.465),.018,.016,m['frame'])
    # Perforated stationary columns and their cross plates.
    for x in [-.090,.090]:
        channel('fixed_lift_support',(x,.103,.11),(x,.103,.42),.032,.024,m['alu'])
    channel('lift_support_bridge',(-.1,.103,.39),(.1,.103,.39),.032,.02,m['alu'],(0,0,1))
    # Three visually separated slotted slide stages in an inclined bank.
    # Angle and extension are chosen within the photographed positions.
    origin=Vector((0,.118,.123))
    direction=Vector((0,-.33,.944)).normalized()
    normal=Vector((0,-direction.z,direction.y))
    for i in range(3):
        offset=Vector(((i-1)*.030,0,0))
        a=origin+offset+direction*(i*.112)
        b=a+direction*.447
        beam('slide_stage_body',a,b,.027,.014,m['rail'])
        for side in [-1,1]:
            aa=a+Vector((side*.010,0,0))+normal*.008
            bb=b+Vector((side*.010,0,0))+normal*.008
            beam('slide_running_lip',aa,bb,.004,.003,m['alu'])
        beam('slide_longitudinal_slot',a+normal*.0076,b+normal*.0076,.005,.001,m['frame'])
        for t in [.015,.41]:
            p=a+direction*t
            perforated('slide_end_plate',p+normal*.012,(1,0,0),direction,.027,.032,m['alu'])
            cylinder('slide_guide_roller',p+Vector((-.021,0,0)),p+Vector((.021,0,0)),.006,m['black'],20)
    # Visible string winch and return pulleys.
    cylinder('spool_core',(-.04,.062,.195),(.034,.062,.195),.016,m['white'])
    for x in [-.040,.034]:
        cylinder('spool_flange',(x-.002,.062,.195),(x+.002,.062,.195),.028,m['white'])
    wire('lift_string',[(-.018,.043,.205),(-.020,.042,.29),(-.02,-.048,.56),(.032,-.083,.66),(.032,.002,.40)],.00065,m['cable'])
    for z,y in [(.395,.024),(.659,-.066)]:
        cylinder('string_idler',(-.007,y,z),(.008,y,z),.007,m['black'],24)
    # Elevated deposit carriage: red bracket, blue shaped support, white forks.
    pos=origin+direction*.62+normal*.035
    box('deposit_red_carriage',pos,(.083,.035,.047),m['red'])
    box('deposit_blue_backplate',pos+Vector((0,.023,.025)),(.103,.009,.094),m['blue'])
    annular_arc('blue_concave_deposit_support',pos+Vector((0,-.015,.034)),(1,0,0),(0,1,0),.044,.049,0,math.pi,.039,m['blue'])
    for sx in [-1,1]:
        p=pos+Vector((sx*.044,-.039,-.005))
        box('white_deposit_fork',p,(.017,.100,.008),m['white'])
        box('red_deposit_tip',p+Vector((0,-.043,.003)),(.018,.022,.013),m['tape'])
        bolt('deposit_mount',pos+Vector((sx*.028,-.019,0)),(0,-1,0),m['steel'])
    # A partially extended low intake exposes its actual characteristic curved
    # white jaws and red grip tape, instead of generic two rectangular fingers.
    for sx in [-1,1]:
        x=sx*.106
        beam('intake_horizontal_slide',(x,.04,.177),(x,-.251,.177),.019,.014,m['rail'])
        beam('intake_white_link',(x,-.11,.19),(x,-.281,.19),.018,.006,m['white'])
    channel('intake_swing_arm',(0,-.223,.187),(0,-.322,.187),.032,.018,m['alu'])
    box('intake_servo_body',(0,-.326,.195),(.043,.025,.026),m['black'])
    jaw_center=Vector((0,-.405,.206))
    for sx in [-1,1]:
        # Two split semicircular plates, open at the front and at the geared roots.
        a0,a1=(.12,math.pi-.12) if sx>0 else (math.pi+.12,math.tau-.12)
        annular_arc('white_curved_intake_jaw',jaw_center,(0,-1,0),(1,0,0),.048,.065,a0,a1,.011,m['white'])
        for f in [.14,.43,.74]:
            a=a0+(a1-a0)*f
            annular_arc('red_jaw_grip_wrap',jaw_center,(0,-1,0),(1,0,0),.0475,.0655,a-.065,a+.065,.0118,m['tape'],5)
        root=Vector((sx*.032,-.351,.206))
        cylinder('jaw_drive_gear',root-Vector((0,0,.012)),root-Vector((0,0,.005)),.027,m['black'],48)
        beam('white_jaw_root',root, (sx*.043,-.363,.206),.023,.011,m['white'])
        bolt('jaw_root_bolt',root+Vector((0,0,.005)),(0,0,1),m['steel'])
        for i in range(24):
            a=i*math.tau/24
            tooth=box('gear_tooth',root+Vector((.027*math.cos(a),.027*math.sin(a),-.008)),(.002,.0035,.006),m['black'],.0002)
            tooth.rotation_euler.z=a
    # Electronics remain black; real wiring supplies small red/yellow accents.
    box('black_control_hub',(.043,.113,.178),(.082,.057,.031),m['black'])
    for i in range(6):
        box('hub_connector',(.014+i*.012,.080,.177),(.008,.005,.007),m['frame'],.0003)
    box('blue_cable_bracket',(-.095,.054,.218),(.011,.064,.060),m['blue'])
    wire('intake_signal_black',[(0,-.326,.20),(.076,-.27,.216),(.108,-.10,.219),(.092,.07,.207)],.0014,m['cable'])
    wire('intake_signal_red',[(.004,-.326,.20),(.080,-.27,.216),(.112,-.10,.219),(.096,.07,.207)],.0012,m['tape'])
    wire('intake_signal_yellow',[(.008,-.326,.20),(.084,-.27,.216),(.116,-.10,.219),(.100,.07,.207)],.0011,m['yellow'])
    # Bake modifiers/curves/transforms into returned meshes. No unbaked hierarchy
    # dependency, materials assigned before export, no parent scene modifications.
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
    points=[v.co for obj in _objects for v in obj.data.vertices]
    lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
    hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
    delta=Vector((-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z))
    for obj in _objects:
        obj.data.transform(Matrix.Translation(delta))
        obj['geometry_accuracy']='photo reconstruction; dimensions and hidden mechanics inferred'
    return list(_objects)


def proof(objects, width=720, height=480):
    """CPU Cycles proof only. Main pipeline owns final lighting and photography."""
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
    world=bpy.data.worlds.new('FTC proof world')
    world.use_nodes=True
    world.node_tree.nodes['Background'].inputs['Color'].default_value=(.10,.11,.13,1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value=.4
    scene.world=world
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor=bpy.context.object
    floor.name='FTC proof floor (not in GLB or model blend)'
    floor.location.z=-.001
    floor.data.materials.append(material('Proof_floor','202329',.10,.38))
    def aim(ob,target):
        ob.rotation_euler=(Vector(target)-ob.location).to_track_quat('-Z','Y').to_euler()
    for name,loc,power,size,color in [
        ('key',(1,-.8,1.5),40,1.2,(1,.97,.93)),
        ('fill',(-.8,-.5,.9),22,1.0,(.90,.95,1)),
        ('rim',(.4,.8,1.25),55,.7,(.94,.97,1))]:
        data=bpy.data.lights.new('FTC proof '+name,'AREA')
        data.energy=power
        data.shape='DISK'
        data.size=size
        data.color=color
        ob=bpy.data.objects.new(data.name,data)
        scene.collection.objects.link(ob)
        ob.location=loc
        aim(ob,(0,0,.3))
    data=bpy.data.cameras.new('FTC proof camera')
    cam=bpy.data.objects.new(data.name,data)
    scene.collection.objects.link(cam)
    cam.location=(1.1,-1.55,1.0)
    aim(cam,(0,-.012,.35))
    data.type='ORTHO'
    # Fit all projected vertices, not only height, so neither the long intake
    # nor the top deposit mechanism can be clipped in the 3:2 proof.
    bpy.context.view_layer.update()
    inverse=cam.matrix_world.inverted()
    projected=[inverse @ v.co for obj in objects for v in obj.data.vertices]
    xmin,xmax=min(v.x for v in projected),max(v.x for v in projected)
    ymin,ymax=min(v.y for v in projected),max(v.y for v in projected)
    cam.location += cam.matrix_world.to_quaternion() @ Vector(((xmin+xmax)/2,(ymin+ymax)/2,0))
    data.ortho_scale=max(xmax-xmin,(ymax-ymin)*width/height)*1.20
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
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC'
    scene.unit_settings.scale_length=1.0
    scene['FTC_provenance']='Photo-based display reconstruction, not manufacturing CAD. See provenance.json.'
    scene.render.engine='CYCLES'
    scene.cycles.device='CPU'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'ftc.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    bpy.ops.export_scene.gltf(filepath=str(HERE/'ftc.glb'),export_format='GLB',use_selection=True,
                             export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
    points=[v.co for obj in objects for v in obj.data.vertices]
    lo=[min(p[i] for p in points) for i in range(3)]
    hi=[max(p[i] for p in points) for i in range(3)]
    stats={'meshes':len(objects),'vertices':sum(len(o.data.vertices) for o in objects),
           'polygons':sum(len(o.data.polygons) for o in objects),'bounds_min':lo,'bounds_max':hi,
           'materials':sorted({m.name for o in objects for m in o.data.materials}),
           'build_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
           'glb_sha256':hashlib.sha256((HERE/'ftc.glb').read_bytes()).hexdigest()}
    print('FTC_BUILD_RESULT '+json.dumps(stats),flush=True)
    provenance_path=HERE/'provenance.json'
    if provenance_path.exists():
        doc=json.loads(provenance_path.read_text(encoding='utf-8'))
        doc['build_result']=stats
        provenance_path.write_text(json.dumps(doc,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    if args.preview:
        proof(objects,1600 if args.large else 720,1067 if args.large else 480)


if __name__=='__main__':
    main()
