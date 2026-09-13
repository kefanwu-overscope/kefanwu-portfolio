"""Analytic regressions for the bounded education contact rule."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
import numpy as np
from assembly_motion import Geometry
from education_contact_check import check_education_path

def cube(name,center,size):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=size
    return {'name':name,'object':obj}

cases=[
    ('thin_obstacle_tunneling',(0,4,2),(.002,.002,.002),(.015,4,2),(.002,1,1),(.7,0,0),False),
    ('later_box_collision',(0,0,2),(.2,.2,.2),(.5,0,2),(.2,.2,.2),(.7,0,0),False),
    ('nested_moving_small',(0,0,2),(.4,.4,.4),(0,0,2),(2,2,2),(.1,0,0),False),
    ('nested_moving_large',(0,0,2),(2,2,2),(0,0,2),(.4,.4,.4),(.1,0,0),False),
    ('contact_withdrawal',(2,0,2),(2,2,2),(0,0,2),(2,2,2),(.7,0,0),True),
    ('floor_crossing',(0,0,.5),(.4,.4,.4),(3,0,.5),(.4,.4,.4),(0,0,-.4),False),
]
results=[]
for name,ac,asize,bc,bsize,delta,expected in cases:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    a=cube('moving',ac,asize);b=cube('stationary',bc,bsize)
    bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
    ga,gb=Geometry('moving',[a],deps),Geometry('stationary',[b],deps)
    passed,detail=check_education_path(ga,np.array(delta),[ga,gb],samples=97)
    assert passed==expected,(name,passed,detail)
    results.append({'case':name,'expected':expected,'accepted':passed,'result':detail})
out=Path(__file__).resolve().parents[3]/'.codex/functional-motion-20260913/assembly-contact-regressions.json'
out.write_text(json.dumps({'passed':True,'cases':results},indent=2))
print('CONTACT_REGRESSIONS_PASS',len(results),flush=True)
