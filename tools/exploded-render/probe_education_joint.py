import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
import numpy as np
from mathutils import Matrix
from study_expanded_assembly import setup,geometries,OUT
from education_assembly_fit import fit
from education_contact_check import check_education_path
ns,parts=setup('education');targets,report=fit(parts)
base={p['name']:p['object'].matrix_world.copy() for p in parts}
for height in [.01,.015,.02,.025,.03,.04]:
    for p in parts:
        transform=targets[p['group']].copy();transform[2,3]+=.035
        if p['group']=='neck':transform[2,3]+=height;transform[1,3]-=.00002
        p['object'].matrix_world=Matrix(transform.tolist())@base[p['name']]
    bpy.context.view_layer.update()
    gs=geometries([p for p in parts if p['group'] in ('neck','body')]);g=next(g for g in gs if g.name=='neck')
    ok,details=check_education_path(g,np.array((0,-.85,0)),gs,samples=33)
    print('JOINT_HEIGHT',height,ok,details,flush=True)
