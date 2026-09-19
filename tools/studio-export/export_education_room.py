"""Export a flat, lightweight room derivative of the approved education p0."""
import json
import math
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix,Vector

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from export_studio_motion import ROOT,EVIDENCE,load_source,sha,save

namespace=load_source()
motion,parts,objects,ground=namespace['render']('education')
motion.apply(0);bpy.context.view_layer.update()
depsgraph=bpy.context.evaluated_depsgraph_get()
rotation=Matrix.Rotation(-math.pi/2,4,'X')
copies=[]
bpy.ops.object.select_all(action='DESELECT')
for obj in motion.objects:
    if obj.hide_render:continue
    evaluated=obj.evaluated_get(depsgraph)
    data=bpy.data.meshes.new_from_object(evaluated,depsgraph=depsgraph)
    copy=bpy.data.objects.new('Education room '+obj.name,data)
    bpy.context.scene.collection.objects.link(copy)
    copy.matrix_world=rotation@obj.matrix_world
    copy.select_set(True);copies.append(copy)
bpy.context.view_layer.objects.active=copies[0]
bpy.ops.object.join()
joined=bpy.context.object;joined.name='Guitar education kit — original separated parts, desk layout'
bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
points=np.asarray([joined.matrix_world@v.co for v in joined.data.vertices])
low,high=points.min(0),points.max(0)
joined.location.x-=(low[0]+high[0])*.5
joined.location.y-=(low[1]+high[1])*.5
joined.location.z-=low[2]
bpy.ops.object.transform_apply(location=True,rotation=False,scale=False)
modifier=joined.modifiers.new('Room-only preview reduction','DECIMATE')
modifier.ratio=.10;modifier.use_collapse_triangulate=True
bpy.ops.object.modifier_apply(modifier=modifier.name)
unique=[];ids={};remap=[]
for mat in joined.data.materials:
    ident=mat.as_pointer()
    if ident not in ids:ids[ident]=len(unique);unique.append(mat)
    remap.append(ids[ident])
polymats=[remap[p.material_index] for p in joined.data.polygons]
joined.data.materials.clear()
for mat in unique:joined.data.materials.append(mat)
for poly,index in zip(joined.data.polygons,polymats):poly.material_index=index
path=ROOT/'assets/studio-motion/education/room.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
                          export_yup=True,export_animations=False,export_apply=True,
                          export_cameras=False,export_lights=False)
points=np.asarray([joined.matrix_world@v.co for v in joined.data.vertices])
low,high=points.min(0),points.max(0)
record={'source':'Approved education motion at progress zero; source parts stay in their original separated layout.',
        'wholeModelRotationBlenderXDegrees':-90,'sourceGeometryUnchanged':True,
        'roomOnlyDecimationRatio':.10,'triangles':len(joined.data.polygons),
        'materials':len(unique),'bytes':path.stat().st_size,'sha256':sha(path),'gltfUpAxis':'Y',
        'gltfSizeXYZ':(high-low)[[0,2,1]].tolist(),
        'gltfMinXYZ':[float(low[0]),float(low[2]),float(-high[1])],
        'gltfMaxXYZ':[float(high[0]),float(high[2]),float(-low[1])],
        'recommendedPlacement':'targetSize .4, axis x, rotX 0, rotZ 0; optional room rotY for desk composition.'}
save(EVIDENCE/'education-room-audit.json',record)
print('EDUCATION_ROOM',json.dumps(record),flush=True)
