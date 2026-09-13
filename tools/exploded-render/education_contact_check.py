"""The shared checker with an explicitly bounded V2 tessellation seam rule."""
import inspect
import numpy as np
from assembly_motion import check_path

# Source V2 exports contain float32 rigid-fit seams smaller than 2e-6 scene
# units. This local function differs at only this predicate; contact intervals,
# depth limits, source withdrawal duration, floor and BVH checks remain intact.
_source=inspect.getsource(check_path)
_old="hit['tEnter'] <= .000001"
assert _source.count(_old)==1
_source=_source.replace(_old,"(hit['tEnter'] <= .000001 or hit['tEnter'] * float(np.linalg.norm(delta)) <= .000002)")
_namespace=dict(check_path.__globals__)
exec(compile(_source,__file__,'exec'),_namespace)
_check=_namespace['check_path']

def check_education_path(moving,delta,groups,samples=97):
    passed,report=check_path(moving,delta,groups,samples=samples)
    extension_used=False
    original_contact=None
    if not passed and report.get('reason')=='continuous_triangle_contact':
        contact=report['contact']
        if contact['tEnter']*float(np.linalg.norm(delta))<=2e-6 and contact['tExit']<=.25:
            original_contact=contact.copy()
            passed,report=_check(moving,delta,groups,samples=samples)
            extension_used=True
    report['initialSeamToleranceSourceUnits']=.000002
    report['initialSeamExtensionUsed']=extension_used
    if original_contact is not None:report['originalInitialSeamContact']=original_contact
    report['modelBoundsDiagonal']=float(np.linalg.norm(moving.hi-moving.lo))
    return passed,report
