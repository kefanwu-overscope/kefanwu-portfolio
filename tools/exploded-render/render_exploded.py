"""Offline exploded-card static frames. Stages original approved cover scenes."""
import argparse
import ast
import hashlib
import json
import math
import struct
import sys
import time
from pathlib import Path
import bpy
import bmesh
import numpy as np
from mathutils import Vector

sys.dont_write_bytecode=True
TASK_DIR=Path(__file__).resolve().parent
ROOT=TASK_DIR.parents[1] if (TASK_DIR.parents[1]/'project-data.js').exists() else TASK_DIR.parents[1]/'portfolio-site'
HERE=ROOT/'tools/editorial-render'
parser=argparse.ArgumentParser()
parser.add_argument('--projects',nargs='+',default=['steering'])
parser.add_argument('--frames',type=int,default=0,help='Override sequence length; default 121 (145 for vine and tensile test).')
parser.add_argument('--samples',type=int,default=48)
parser.add_argument('--width',type=int,default=640)
parser.add_argument('--only',nargs='*',type=int)
parser.add_argument('--output',type=Path,default=ROOT.parent/'.codex/functional-motion-20260913/generated')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])

MODES={'brakeSim':'heat','carbonSeat':'layup','seat':'unfold','ftc':'reconstruction',
       'steering':'steering','vineRobot':'extension','javelin':'propellers',
       'scanner':'gantry','formlabs':'gantry','materialTest':'tensile',
       'ansysCfd':'flow','education':'assembling'}

def restore_javelin_parts(objects):
    """Recover named, touching CAD parts lost in the merged aero bucket."""
    aero=next(obj for obj in objects if obj.name=='mat_aero')
    materials=list(aero.data.materials)
    bpy.ops.import_scene.gltf(filepath=str(HERE/'sources/javelin.glb'))
    raw=list(bpy.context.selected_objects)
    points=np.array([o.matrix_world@v.co for o in raw if o.type=='MESH' for v in o.data.vertices])
    lo,hi=points.min(0),points.max(0);center=(lo+hi)*.5;factor=2.8/max(hi-lo)
    for obj in raw:bpy.data.objects.remove(obj,do_unlink=True)
    restored=[];triangles=0
    provenance=json.loads((HERE/'sources/javelin.json').read_text())
    for item in provenance['inputs']:
        path=Path(item['path']);lower=path.name.lower()
        if not any(word in lower for word in ('nosecone','tailcone','naca0008_wing')):continue
        blob=path.read_bytes();count=struct.unpack_from('<I',blob,80)[0]
        dtype=np.dtype([('normal','<f4',3),('tri','<f4',(3,3)),('attribute','<u2')])
        rawtri=np.ndarray(count,dtype=dtype,buffer=blob,offset=84)['tri'].copy()
        coords=rawtri.reshape(-1,3)[:,[0,2,1]].copy();coords[:,1]*=-1
        coords=(coords-center)*factor;coords[:,2]+=(hi[2]-lo[2])*factor*.5+.025
        verts,inverse=np.unique(coords,axis=0,return_inverse=True)
        mesh=bpy.data.meshes.new(path.stem)
        mesh.from_pydata(verts.tolist(),[],inverse.reshape(-1,3).tolist())
        for mat in materials:mesh.materials.append(mat)
        mesh.set_sharp_from_angle(angle=math.radians(36))
        for poly in mesh.polygons:poly.use_smooth=True
        mesh.update()
        obj=bpy.data.objects.new('JavelinSTL '+path.stem,mesh);bpy.context.collection.objects.link(obj)
        restored.append(obj);triangles+=count
    assert triangles==len(aero.data.polygons),(triangles,len(aero.data.polygons))
    aero.hide_render=True;aero.hide_set(True)
    return [o for o in objects if o!=aero]+restored

def stage(key):
    original=key in ('steering','vineRobot','scanner')
    path=HERE/('render.py' if original else 'render_catalog.py')
    tree=ast.parse(path.read_text(encoding='utf-8'))
    namespace={'__file__':str(path),'__name__':'exploded_scene'}
    saved=sys.argv[:]
    if original:
        sys.argv=['blender','--','--model',key,'--view','wide','--draft']
        cut=next(i for i,n in enumerate(tree.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='out_dir' for t in n.targets))
        tree.body=tree.body[:cut]
    else:
        sys.argv=['blender','--','--projects',key,'--draft']
        tree.body=[n for n in tree.body if not isinstance(n,ast.For)]
        fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='render')
        cut=next(i for i,n in enumerate(fn.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='output' for t in n.targets))
        fn.body=fn.body[:cut]+ast.parse('return objects, ground').body
    ast.fix_missing_locations(tree)
    exec(compile(tree,str(path),'exec'),namespace)
    sys.argv=saved
    if original: return namespace['objects'],namespace['ground']
    return namespace['render'](key)

def components(obj,key=None):
    mesh=obj.data
    parents=list(range(len(mesh.vertices)))
    def find(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]];i=parents[i]
        return i
    for edge in mesh.edges: parents[find(edge.vertices[1])]=find(edge.vertices[0])
    first={}
    for v in mesh.vertices:
        key=tuple(v.co)
        if key in first: parents[find(v.index)]=find(first[key])
        else: first[key]=v.index
    groups={}
    for face in mesh.polygons: groups.setdefault(find(face.vertices[0]),[]).append(face.index)
    return list(groups.values())

def make_parts(objects,key):
    parts=[]
    for original in objects:
        # Reconstruction objects already carry part semantics; keep modifiers.
        if original.name.startswith(('FTC_','MaterialTest_','Display','Stand','Actual Ansys','JavelinSTL')):
            points=[original.matrix_world@v.co for v in original.data.vertices]
            center=(Vector(tuple(min(v[i] for v in points) for i in range(3)))+Vector(tuple(max(v[i] for v in points) for i in range(3))))*.5
            lo=Vector(tuple(min(v[i] for v in points) for i in range(3)))
            hi=Vector(tuple(max(v[i] for v in points) for i in range(3)))
            parts.append({'object':original,'center':center,'size':hi-lo,'name':original.name,'original':original.name})
            continue
        mesh=original.data
        for number,face_indices in enumerate(components(original,key)):
            used=sorted({v for f in face_indices for v in mesh.polygons[f].vertices})
            remap={old:i for i,old in enumerate(used)}
            points=[original.matrix_world@mesh.vertices[i].co for i in used]
            faces=[[remap[i] for i in mesh.polygons[f].vertices] for f in face_indices]
            data=bpy.data.meshes.new(original.name+'_part_'+str(number))
            data.from_pydata(points,[],faces)
            data.use_auto_texspace=False
            data.texspace_location=mesh.texspace_location
            data.texspace_size=mesh.texspace_size
            for mat in mesh.materials: data.materials.append(mat)
            for newface,oldindex in zip(data.polygons,face_indices):
                newface.material_index=mesh.polygons[oldindex].material_index
                newface.use_smooth=mesh.polygons[oldindex].use_smooth
            data.set_sharp_from_angle(angle=math.radians(36))
            data.update()
            for uv in mesh.uv_layers:
                newuv=data.uv_layers.new(name=uv.name)
                oldloops=[loop for f in face_indices for loop in mesh.polygons[f].loop_indices]
                for n,oldloop in enumerate(oldloops):newuv.data[n].uv=uv.data[oldloop].uv
            if mesh.has_custom_normals:
                normals=[mesh.corner_normals[loop].vector.copy() for f in face_indices for loop in mesh.polygons[f].loop_indices]
                data.normals_split_custom_set(normals)
            obj=bpy.data.objects.new(data.name,data)
            bpy.context.collection.objects.link(obj)
            lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
            hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
            parts.append({'object':obj,'center':(lo+hi)*.5,'size':hi-lo,'name':obj.name,'original':original.name})
        original.hide_render=True
        original.hide_set(True)
    return parts

def steering_group(part):
    center=part['center'];obj=part['object']
    if any(f.material_index==1 for f in obj.data.polygons):return 'wheel'
    if center.y>.60:return 'quick_release'
    if center.z>1.30:return 'upper_column'
    if center.z>.65:return 'lower_column'
    if center.x<-.60:return 'left_rack_end'
    if center.x>.60:return 'right_rack_end'
    return 'rack'

def movement(key,parts):
    offsets={
      'wheel':(0,.48,.40),'quick_release':(0,.18,.06),'upper_column':(.42,0,.13),
      'lower_column':(-.34,0,.05),'rack':(0,0,0),'left_rack_end':(-.55,0,.05),'right_rack_end':(.55,0,.05)}
    if key=='steering':
        for part in parts:
            part['group']=steering_group(part);part['offset']=Vector(offsets[part['group']])
        return
    center=sum((p['center'] for p in parts),Vector())/len(parts)
    for part in parts:
        c=part['center'];s=part['size'];name=part['original'];obj=part['object']
        group='core';delta=Vector((0,0,.05))
        if key=='vineRobot':
            if 'glass' in name:group='vessel';delta=Vector((.55,.12,.20))
            elif c.z>2.25:group='lid_and_drive';delta=Vector((0,0,.65))
            elif c.z<.35:group='base';delta=Vector((0,0,.02))
            elif c.x<-.72:group='outlet';delta=Vector((-.60,0,.10))
            elif c.y<-.45:group='near_reinforcement';delta=Vector((0,-.42,.12))
            elif c.y>.45:group='far_reinforcement';delta=Vector((0,.42,.12))
            else:group='spool_and_inner_frame';delta=Vector((0,0,.25))
        elif key=='javelin':
            lower=name.lower()
            if 'nosecone_cover' in lower:group='nose_cover';delta=Vector((-.50,0,.32))
            elif 'nosecone' in lower:group='nose';delta=Vector((-.40,0,.08))
            elif 'tailcone' in lower:group='tail';delta=Vector((.50,0,.08))
            elif 'naca0008' in lower:
                sy=1 if c.y>0 else -1;sz=1 if c.z>.8 else -1
                group=f'wing_{sy}_{sz}';delta=Vector((0,sy*.18,sz*.18+.25))
            elif any(t in name for t in ('motor','propeller')):
                sy=1 if c.y>0 else -1;sz=1 if c.z>1.0 else -1
                group=f'propulsion_{sy}_{sz}';delta=Vector((-.12,sy*.25,sz*.25+.28))
            elif 'aero' in name:group='airframe';delta=Vector((.25,0,.20))
            elif 'steel' in name:group='pitot';delta=Vector((-.45,0,.20))
            else:group='avionics_and_mounts';delta=Vector((0,0,.60))
        elif key=='scanner':
            if 'wood' in name:group='base';delta=Vector((0,0,0))
            elif c.x<-.78:group='left_tower';delta=Vector((-.45,0,.18))
            elif c.x>.78:group='right_tower';delta=Vector((.45,0,.18))
            elif c.z>1.35 or s.x>1.5:group='gantry';delta=Vector((0,0,.60))
            elif c.y<-.25:group='sensor_carriage';delta=Vector((-.25,-.45,.28))
            else:group='electronics';delta=Vector((.20,.38,.20))
        elif key=='lineFollower':
            if 'battery' in name:group='battery';delta=Vector((0,-.18,.38))
            elif c.y>.72 and c.z<.60:
                sign=1 if c.x>0 else -1;group='drive_right' if sign==1 else 'drive_left';delta=Vector((sign*.50,0,.10))
            elif c.y<-.85:group='sensor_array';delta=Vector((0,-.45,.13))
            elif s.x>1.8 and 'printed' in name:group='chassis';delta=Vector((0,0,.02))
            elif c.z>.52 or 'pcb_teal' in name or 'solder' in name:group='controller';delta=Vector((0,.10,.82))
            elif c.z>.22:group='drivers_and_mounts';delta=Vector((.22,-.20,.48))
            else:group='chassis_hardware';delta=Vector((0,0,.02))
        elif key=='formlabs':
            if 'amber' in name:group='reservoir';delta=Vector((0,-.45,.18))
            elif c.z<.10:group='base';delta=Vector((0,0,0))
            elif c.x<-.70:group='left_tower';delta=Vector((-.48,0,.18))
            elif c.x>.75:group='right_tower';delta=Vector((.48,0,.18))
            elif s.x>1.5:group='gantry_rods';delta=Vector((0,0,.60))
            else:group='actuator_and_carriage';delta=Vector((0,-.12,.52))
        elif key=='telecaster':
            if 'maple' in name or 'fretboard' in name:group='neck';delta=Vector((.18,0,.35))
            elif 'pickguard' in name:group='pickguard_surface';delta=Vector((-.25,-.25,.15))
            elif 'chrome' in name and s.z>1.5:group='strings';delta=Vector((-.25,-.32,.12))
            elif c.z>2.10 or ('chrome' in name and c.z>.86):group='neck';delta=Vector((.18,0,.35))
            elif 'chrome' in name or 'plastic' in name:group='bridge_and_controls';delta=Vector((.27,-.30,.12))
            else:group='body';delta=Vector((0,.06,0))
        elif key=='education':
            if 'maple' in name or 'fretboard' in name:group='neck';delta=Vector((.30,0,.18))
            elif 'pickguard' in name:group='pickguard';delta=Vector((-.22,-.25,.18))
            elif 'printed' in name:group='teaching_body';delta=Vector((0,0,.02))
            elif 'plastic' in name:group='pickup';delta=Vector((-.18,0,.40))
            else:group='teaching_hardware';delta=Vector((.05,-.25,.32))
        elif key=='pool':
            if 'glass' in name:
                sign=1 if c.z>center.z else -1
                group='acrylic_panel_'+str(sign);delta=Vector((0,-.20,sign*.30+.35))
            elif 'wood' in name:group='cue';delta=Vector((.42,0,.16))
            elif 'dark' in name:group='motor';delta=Vector((-.35,0,.25))
            elif 'printed' in name:group='rack_and_trigger';delta=Vector((.15,-.28,.30))
            elif 'steel' in name:group='transmission';delta=Vector((-.12,-.22,.52))
            else:group='housing';delta=Vector((0,.10,.04))
        elif key=='aura':
            if 'rubber' in name:group='wheel';delta=Vector((0,-.46,.15))
            elif 'plastic' in name:
                group='motor_and_controls';delta=Vector((.40,.10,.35))
            elif 'paint' in name:group='mounting_structure';delta=Vector((-.22,0,.08))
            elif s.x>.6 or s.y>.6:group='sprockets_and_bearings';delta=Vector((-.08,-.25,.50))
            else:group='shafts_and_mount_hardware';delta=Vector((-.22,0,.08))
        elif key=='materialTest':
            lower=name.lower()
            if 'specimen' in lower:group='test_specimen';delta=Vector((-.30,-.32,.08))
            elif any(t in lower for t in ('grip','jaw','knurl','coupl','load_cell','cross_pin','lock_pin')):
                sign=1 if c.z>1.10 else -1
                group='upper_fixture' if sign==1 else 'lower_fixture';delta=Vector((sign*.34,-.12,.20 if sign==1 else .05))
            elif any(t in lower for t in ('column','bellows','accordion','crosshead','scale','travel')):group='column_and_crosshead';delta=Vector((.20,.15,.46))
            else:group='base_and_controls';delta=Vector((0,0,0))
        elif key=='ansysCfd':
            if 'Actual' in name:group='original_solver_result';delta=Vector((-.10,-.45,.18))
            elif 'front bezel' in name:group='presentation_bezel';delta=Vector((.05,-.20,.12))
            elif 'back' in name:group='presentation_back';delta=Vector((.15,.22,.08))
            else:group='presentation_stand';delta=Vector((0,.08,0))
        elif key=='ftc':
            lower=name.lower()
            if any(t in lower for t in ('wheel','mecanum','roller_pin','drive_axle','axle_screw')):
                sx=1 if c.x>0 else -1;sy=1 if c.y>0 else -1
                group=f'wheel_{sx}_{sy}';delta=Vector((sx*.40,sy*.12,.05))
            elif any(t in lower for t in ('intake','jaw','gear_tooth')):group='intake';delta=Vector((0,-.40,.17))
            elif any(t in lower for t in ('lift','slide','deposit','spool','string','aframe','link')):group='lift_and_deposit';delta=Vector((0,.15,.55))
            else:group='chassis_and_electronics';delta=Vector((0,0,.02))
        else:raise ValueError('Unknown '+key)
        part['group']=group;part['offset']=delta

def reunite_finish_surfaces(key,parts):
    """Keep contiguous color/finish masks on one physical part together."""
    if key not in ('aura','lineFollower','telecaster','education','javelin'):return
    parents=list(range(len(parts)))
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    seen={}
    for index,part in enumerate(parts):
        if part['original'].startswith('JavelinSTL'):continue
        for vertex in part['object'].data.vertices:
            point=tuple(round(v,6) for v in vertex.co)
            previous=seen.get(point)
            if previous is not None and parts[previous]['original']!=part['original']:
                parents[find(index)]=find(previous)
            else:seen[point]=index
    groups={}
    for index in range(len(parts)):groups.setdefault(find(index),[]).append(parts[index])
    for group in groups.values():
        if len(group)<2:continue
        def score(part):
            base=len(part['object'].data.polygons)
            # The motor's complete black shell anchors its finish-only silver mask.
            if key=='aura' and 'plastic_black' in part['original']:base+=1000000
            if key=='javelin' and 'motor_black' in part['original']:base+=1000000
            if key=='lineFollower' and 'pcb_' in part['original']:base+=1000000
            if key=='telecaster' and 'paint_white' in part['original']:base+=1000000
            return base
        anchor=max(group,key=score)
        for part in group:
            part['group']=anchor['group'];part['offset']=anchor['offset'].copy()

def render(key):
    if key=='telecaster':
        raise ValueError('Telecaster uses its original static cover; no animation is rendered.')
    start=time.monotonic()
    out=args.output/key
    out.mkdir(parents=True,exist_ok=True)
    objects,ground=stage(key)
    scene=bpy.context.scene
    sys.path.insert(0,str(TASK_DIR))
    parts=[]
    if key=='seat':
        from seat_unfold import build_unfold
        motion=build_unfold(objects,scene)
    elif key in ('brakeSim','carbonSeat'):
        from material_processes import build_process
        motion=build_process(key,objects,scene)
    elif key=='ansysCfd':
        from cfd_flow import build_flow
        motion=build_flow(objects,scene)
    else:
        from assembly_motion import build_motion
        if key=='javelin':objects=restore_javelin_parts(objects)
        parts=make_parts(objects,key)
        movement(key,parts)
        reunite_finish_surfaces(key,parts)
        if key in ('steering','scanner','formlabs'):
            from mechanism_motion import build_mechanism
            motion=build_mechanism(key,parts,scene)
        elif key in ('vineRobot','javelin','materialTest'):
            from functional_processes import build_functional
            motion=build_functional(key,parts,scene)
        elif key in ('pool','lineFollower','education'):
            from expanded_assembly import build_expanded
            motion=build_expanded(key,parts,scene)
        else:
            motion=build_motion(key,parts,scene)
    if motion.report.get('floorMinimum') is not None:
        ground.location.z=min(ground.location.z,float(motion.report['floorMinimum'])-.02)
    frame_count=args.frames or {'vineRobot':145,'materialTest':145}.get(key,121)
    assert 2<=frame_count<=181,frame_count
    scene.render.resolution_x=args.width
    scene.render.resolution_y=round(args.width*2/3)
    scene.cycles.samples=args.samples
    scene.cycles.adaptive_threshold=.03
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGB'
    scene.render.image_settings.color_depth='8'
    # Fit the complete motion, including every intermediate extraction/unfold.
    # Evaluated bounds include modifiers and deforming cloth/panels.
    camera=scene.camera
    if key=='education':
        # The V2 assembly faces -Y; the separated cover's camera sees its edge.
        # Fixed framing exposes the front hardware throughout the full assembly.
        camera.location=(1.9235137701,-10.0798053741,3.3648588657)
        camera.rotation_euler=(1.42475652695,0.,.197395607829)
        camera.data.ortho_scale=6.382242733661077
    camera_origin=camera.location.copy()
    base_scale=camera.data.ortho_scale
    right=camera.rotation_euler.to_quaternion()@Vector((1,0,0))
    up=camera.rotation_euler.to_quaternion()@Vector((0,1,0))
    ratio=scene.render.resolution_x/scene.render.resolution_y
    projection=np.array([tuple(right),tuple(up)],dtype=np.float64).T
    camera_position=np.array(tuple(camera.location))
    scales=[];camera_offsets=[]
    for index in range(121):
        motion.apply(index/120)
        bpy.context.view_layer.update()
        depsgraph=bpy.context.evaluated_depsgraph_get()
        minimum=np.full(2,np.inf);maximum=np.full(2,-np.inf)
        for obj in motion.objects:
            if obj.hide_render:continue
            evaluated=obj.evaluated_get(depsgraph)
            matrix=np.asarray(evaluated.matrix_world)
            mesh=evaluated.to_mesh() if evaluated.type!='MESH' else evaluated.data
            vertices=np.empty(len(mesh.vertices)*3,dtype=np.float32)
            mesh.vertices.foreach_get('co',vertices)
            if evaluated.type!='MESH':evaluated.to_mesh_clear()
            if not len(vertices):continue
            world=vertices.reshape(-1,3)@matrix[:3,:3].T+matrix[:3,3]
            projected=(world-camera_position)@projection
            minimum=np.minimum(minimum,projected.min(0));maximum=np.maximum(maximum,projected.max(0))
        offset=np.zeros(2)
        if key=='seat':
            # Follow the connected sheet as its upright back lowers to the floor.
            # Keep the source viewing direction and exact first-frame camera.
            blend=min(1,index/40);blend=blend*blend*(3-2*blend)
            offset=(minimum+maximum)*.5*blend
        extents=np.maximum(np.abs(minimum-offset),np.abs(maximum-offset))
        camera_offsets.append(offset)
        fit=max(base_scale,extents[0]*2/.88,extents[1]*2*ratio/.88)
        scales.append(max(fit,scales[-1] if scales else base_scale))
    full_scale=max(scales)
    def framing(progress):
        if MODES.get(key) in ('steering','gantry','propellers','flow','assembling'):
            return full_scale
        # A gentle lead-in leaves room before a panel/part begins moving.
        position=min(120,progress*120+3)
        low=int(position);high=min(120,low+1)
        fitted=scales[low]+(scales[high]-scales[low])*(position-low)
        intro=min(1,progress*10)
        return max(scales[round(progress*120)],base_scale+(fitted-base_scale)*intro)
    records=[]
    frames=args.only if args.only is not None else range(frame_count)
    for index in frames:
        assert 0<=index<frame_count,index
        progress=index/(frame_count-1)
        motion.apply(progress)
        camera.data.ortho_scale=framing(progress)
        position=progress*120;low=int(position);high=min(120,low+1)
        offset=camera_offsets[low]+(camera_offsets[high]-camera_offsets[low])*(position-low)
        camera.location=camera_origin+right*offset[0]+up*offset[1]
        scene.render.filepath=str(out/(f'{index:02d}.png'))
        before=time.monotonic()
        bpy.ops.render.render(write_still=True)
        elapsed=time.monotonic()-before
        records.append({'index':index,'seconds':round(elapsed,3),'bytes':Path(scene.render.filepath).stat().st_size})
        print('EXPLODED_FRAME',key,index,round(elapsed,3),flush=True)
    report={'project':key,'width':scene.render.resolution_x,'height':scene.render.resolution_y,
        'frameCount':frame_count,'samples':args.samples,'cameraOrthoScale':scene.camera.data.ortho_scale,
        'cameraBaseScale':base_scale,'mode':MODES.get(key,'assembly'),
        'sourceLayout':('Numerical pressure surface and pathlines from rebuilt Fluent cruise case' if key=='ansysCfd' else
            'Original separated educational layout' if key=='education' else 'Original approved cover source pose'),
        'motionRevision':'functional-motion-20260913','motion':motion.report,
        'cameraBoundsSamples':121,'cameraMaximumScale':full_scale,
        'cameraTracking':('Fixed front three-quarter view of the V2 guitar assembly' if key=='education' else
            'Fixed three-quarter numerical flow view' if key=='ansysCfd' else
            'Projected sheet center during unfolding; fixed source view direction' if key=='seat' else 'Original source camera position and direction'),
        'cameraLocation':list(scene.camera.location),'cameraRotation':list(scene.camera.rotation_euler),
        'sourceComponentNames':[p['name'] for p in parts],
        'timings':records,'totalSeconds':round(time.monotonic()-start,3)}
    (out/'provenance.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print('EXPLODED_COMPLETE',key,report['totalSeconds'],flush=True)

for project in args.projects:render(project)
