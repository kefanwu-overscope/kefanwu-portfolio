"""Probe small assembly-normal clearance directions without changing geometry."""
import itertools
import json
from pathlib import Path
import sys
import bpy
import numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent))
from inspect_motion import renderer_helpers
from assembly_motion import coherent_groups, absorb_embedded_hardware, Geometry, check_path
if '--contact-tolerance' in sys.argv:
    tolerance = float(sys.argv[sys.argv.index('--contact-tolerance')+1])
    original_ccd = check_path.__globals__['check_translation']
    def ccd_with_source_precision(*a, **kw):
        kw['tolerance'] = tolerance
        return original_ccd(*a, **kw)
    check_path.__globals__['check_translation'] = ccd_with_source_precision
ns=renderer_helpers()
objects,_=ns['stage']('lineFollower')
parts=ns['make_parts'](objects,'lineFollower')
ns['movement']('lineFollower',parts)
ns['reunite_finish_surfaces']('lineFollower',parts)
coherent_groups('lineFollower',parts)
deps=bpy.context.evaluated_depsgraph_get()
absorb_embedded_hardware('lineFollower',parts,deps)
buckets={}
for p in parts:buckets.setdefault(p['group'],[]).append(p)
groups=[Geometry(n,ps,deps) for n,ps in buckets.items()]
g=next(g for g in groups if g.name==('sensor_array' if '--sensor' in sys.argv else 'electronics_stack'))
trials = [(0,-.7,z) for z in (-.005,-.02,-.05)] if '--sensor' in sys.argv else [(x,y,.7) for x,y in itertools.product((0,-.005,.005,-.02,.02), repeat=2)]
for x,y,z in trials:
    if x==0 and y==0:continue
    delta=np.array((x,y,z))
    passed,report=check_path(g,delta,groups)
    print('LINE_PROBE',delta.tolist(),passed,json.dumps(report),flush=True)
    if passed:break
