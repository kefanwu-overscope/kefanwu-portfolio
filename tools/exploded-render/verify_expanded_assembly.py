"""Build final plans, verify seek determinism, and render selected proof poses."""
import argparse
import json
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from study_expanded_assembly import setup,OUT
from expanded_assembly import build_expanded

parser=argparse.ArgumentParser();parser.add_argument('projects',nargs='+');parser.add_argument('--render',action='store_true')
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
for key in args.projects:
    ns,parts=setup(key)
    motion=build_expanded(key,parts,bpy.context.scene)
    motion.apply(0);before=[np.array(o.matrix_world) for o in motion.objects]
    poses=np.linspace(0,1,121)
    expected=[]
    for t in poses:
        motion.apply(t);expected.append(np.array([o.matrix_world for o in motion.objects]))
    seek_error=0.
    for index in list(range(120,-1,-1))+np.random.default_rng(9013).permutation(121).tolist():
        motion.apply(poses[index])
        seek_error=max(seek_error,float(np.max(np.abs(np.array([o.matrix_world for o in motion.objects])-expected[index]))))
    motion.apply(0)
    error=max(np.max(np.abs(a-np.array(o.matrix_world))) for a,o in zip(before,motion.objects))
    assert error<1e-6,error
    assert seek_error<1e-6,seek_error
    report={'project':key,'stageCount':len(motion.stages),'seekRoundTripMatrixError':float(error),
            'forwardReverseRandomSeekPoses':363,'maximumSeekOrderMatrixDifference':seek_error,'passed':True}
    (OUT/('assembly-'+key+'-seek.json')).write_text(json.dumps(report,indent=2))
    print('EXPANDED_VERIFIED',report,flush=True)
    if not args.render:continue
    scene=bpy.context.scene;camera=scene.camera
    scene.render.resolution_x=480;scene.render.resolution_y=320;scene.render.resolution_percentage=100;scene.cycles.samples=8
    right=camera.rotation_euler.to_quaternion()@Vector((1,0,0));up=camera.rotation_euler.to_quaternion()@Vector((0,1,0))
    bounds=[]
    for t in np.linspace(0,1,121):
        motion.apply(t)
        xyz=np.array([o.matrix_world@Vector(v) for o in motion.objects for v in o.bound_box])
        bounds.append(xyz)
    xyz=np.concatenate(bounds);lo,hi=xyz.min(0),xyz.max(0);center=(lo+hi)*.5
    direction=camera.rotation_euler.to_quaternion()@Vector((0,0,1))
    camera.location=Vector(center)+direction*8
    rel=xyz-np.array(camera.location)
    camera.data.ortho_scale=max(max(abs(rel@np.array(right)))*2/.88,max(abs(rel@np.array(up)))*3/.88)
    for t in [0.,.25,.5,.75,1.]:
        motion.apply(t);scene.render.filepath=str(OUT/('assembly-'+key+'-'+str(round(t*100)).zfill(3)+'.png'))
        bpy.ops.render.render(write_still=True)
