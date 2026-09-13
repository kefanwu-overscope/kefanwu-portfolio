import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
import numpy as np
from mathutils import Matrix
from study_expanded_assembly import setup,geometries
from education_assembly_fit import fit
from education_contact_check import check_education_path
ns,parts=setup('education');targets,report=fit(parts)
base={p['name']:p['object'].matrix_world.copy() for p in parts}
for key in ['pickguard','neck_pickup','bridge_pickup']:
    for p in parts:
        transform=targets[p['group']].copy();transform[2,3]+=.035
        if p['group']=='controls':transform[0,3]+=1.;transform[1,3]-=.9
        if key=='neck_pickup' and p['group']=='pickguard':transform[0,3]+=1.;transform[1,3]-=.9
        if key=='bridge_pickup' and p['group'] not in ('bridge','bridge_pickup'):transform[0,3]+=4.
        p['object'].matrix_world=Matrix(transform.tolist())@base[p['name']]
    bpy.context.view_layer.update()
    gs=geometries(parts);g=next(g for g in gs if g.name==key)
    dirs=[(0,-.65,0)] if key!='bridge_pickup' else [(0,.5,0),(0,-.5,0),(.5,0,0),(-.5,0,0),(0,0,.5)]
    for delta in dirs:
        ok,detail=check_education_path(g,np.array(delta),gs,samples=33)
        print('COMPONENT_PATH',key,delta,ok,detail,flush=True)
