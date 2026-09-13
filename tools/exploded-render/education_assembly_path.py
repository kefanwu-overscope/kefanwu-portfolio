"""Assembly staging for the matched educational CAD parts."""
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
import numpy as np
from mathutils import Matrix,Vector
from education_contact_check import check_education_path as check_path
from education_assembly_fit import fit

def plan_education(parts,scene):
    from assembly_motion import Geometry
    targets,fit_report=fit(parts)
    targets['pickup_front_plate']=targets['bridge_pickup'].copy()
    targets['pickup_coil']=targets.pop('bridge_pickup')
    for p in parts:
        if p['name']=='mat_plastic_black_part_0':p['group']='pickup_front_plate'
        elif p['name']=='mat_plastic_black_part_1':p['group']='pickup_coil'
    base={p['name']:p['object'].matrix_world.copy() for p in parts}
    names=sorted({p['group'] for p in parts})
    identity=np.eye(4)
    state={n:identity.copy() for n in names}
    pickup_front_clearance=.01
    state['pickup_front_plate'][1,3]-=pickup_front_clearance
    initial={n:m.copy() for n,m in state.items()}
    lift=np.eye(4);lift[2,3]=.035
    final={n:lift@targets[n] for n in names}
    # Preserve a microscopic seating clearance at the independently tessellated
    # neck/body interface rather than broadening collision tolerances.
    final['neck'][1,3]-=.00002
    final['neck'][2,3]+=.01
    final['pickup_front_plate'][1,3]-=pickup_front_clearance
    stages=[]
    def place(maps):
        for p in parts:p['object'].matrix_world=Matrix(maps[p['group']].tolist())@base[p['name']]
        bpy.context.view_layer.update()
    def shifted(matrix,xyz):
        result=matrix.copy();result[:3,3]+=np.array(xyz);return result
    def add(label,new,reverse=False,pivot=None):
        moving=list(new)
        after={**state,**new}
        if pivot is not None:
            # Rotation is kept wholly in a front slab separated from every
            # static part. A sphere centered on its fixed pivot bounds every
            # possible intermediate neck vertex, including ground clearance.
            place(state)
            points=np.array([p['object'].matrix_world@v.co for p in parts if p['group'] in moving for v in p['object'].data.vertices])
            center=(state[moving[0]]@np.r_[pivot,1])[:3]
            radius=float(np.max(np.linalg.norm(points-center,axis=1)))
            static=np.array([p['object'].matrix_world@v.co for p in parts if p['group'] not in moving for v in p['object'].data.vertices])
            relative=Matrix(new[moving[0]][:3,:3].tolist())@Matrix(state[moving[0]][:3,:3].tolist()).inverted()
            axis=relative.to_quaternion().axis
            maximum_y_drift=2*radius*float(np.linalg.norm([axis.x,axis.z]))
            clearance=float(static[:,1].min()-points[:,1].max()-maximum_y_drift)
            assert clearance>.1 and center[2]-radius>0,(clearance,center[2]-radius)
            verification={'passed':True,'method':'The full rotation lies in a disjoint front slab, including drift from its measured axis; a fixed-pivot 3D sphere bounds ground clearance continuously.',
                'continuousSlabClearance':clearance,'minimumRotationSphereZ':float(center[2]-radius),
                'rotationAxis':list(axis),'maximumRotationYDrift':maximum_y_drift}
        elif len(moving)==len(names):
            assert all(np.max(np.abs(new[n][:3,3]-state[n][:3,3]-np.array((0,0,.035))))<1e-9 for n in moving)
            verification={'passed':True,'method':'Common upward rigid translation preserves all inter-part geometry and increases floor clearance.','translation':[0,0,.035]}
        else:
            delta=new[moving[0]][:3,3]-state[moving[0]][:3,3]
            for n in moving:
                assert np.max(np.abs(new[n][:3,:3]-state[n][:3,:3]))<1e-6
                assert np.max(np.abs(new[n][:3,3]-state[n][:3,3]-delta))<1e-6
            place(after if reverse else state)
            buckets={}
            for p in parts:buckets.setdefault('__moving__' if p['group'] in moving else p['group'],[]).append(p)
            deps=bpy.context.evaluated_depsgraph_get()
            gs=[Geometry(n,ps,deps) for n,ps in buckets.items()]
            geom=next(g for g in gs if g.name=='__moving__')
            passed,verification=check_path(geom,-delta if reverse else delta,gs,samples=97)
            if not passed:
                if verification.get('contact'):
                    hit=verification['contact'];obstacle=next(g for g in gs if g.name==verification['obstacle'])
                    verification['movingTriangleVertices']=geom.vertices[np.array(geom.faces[hit['movingTriangle']])].tolist()
                    verification['obstacleTriangleVertices']=obstacle.vertices[np.array(obstacle.faces[hit['otherTriangle']])].tolist()
                raise RuntimeError((label,moving,verification))
            verification['directionVerified']='reverse withdrawal from CAD joint' if reverse else 'forward approach'
        stage={'label':label,'movingGroups':moving,'transforms':{n:{'fromMatrix':state[n].tolist(),'toMatrix':new[n].tolist()} for n in moving},'verification':verification}
        if pivot is not None:stage['pivot']=list(pivot)
        stages.append(stage);state.update(new)
        print('EDUCATION_STAGE',label,verification,flush=True)
    try:
        add('Lift kit above the lowest assembled guard edge',{n:shifted(state[n],(0,0,.035)) for n in names})
        add('Withdraw horizontal neck into clear foreground',{'neck':shifted(state['neck'],(0,-.85,0))})
        neck_parts=[p for p in parts if p['group']=='neck']
        source=np.array([base[p['name']]@v.co for p in neck_parts for v in p['object'].data.vertices])
        pivot=(source.min(0)+source.max(0))*.5
        center=(state['neck']@np.r_[pivot,1])[:3]
        turned=final['neck'].copy();turned[:3,3]=center-turned[:3,:3]@pivot
        add('Turn neck upright in the clear foreground',{'neck':turned},pivot=pivot)
        add('Align neck with original CAD mounting pocket',{'neck':shifted(final['neck'],(0,-.85,0))})
        add('Seat neck into its CAD joint',{'neck':final['neck']},reverse=True)
        for group in ['neck_pickup']:
            add('Bring '+group+' forward', {group:shifted(state[group],(0,-.65,0))})
            add('Align '+group+' with its body cavity',{group:shifted(final[group],(0,-.65,0))})
            add('Seat '+group,{group:final[group]},reverse=True)
        add('Bring bridge to assembly work area',{'bridge':shifted(state['bridge'],(0,-.95,0))})
        add('Align bridge in front of its mounting holes',{'bridge':shifted(final['bridge'],(0,-.95,0))})
        add('Bring pickup pieces to the assembly work area',
            {n:shifted(state[n],(0,-.65,0)) for n in ['pickup_front_plate','pickup_coil']})
        add('Separate the original pickup front plate',{'pickup_front_plate':shifted(state['pickup_front_plate'],(0,-.7,0))})
        add('Align coil with the rear bridge opening',{'pickup_coil':shifted(final['pickup_coil'],(0,-.65,0))})
        add('Insert coil from behind the bridge',{'pickup_coil':shifted(final['pickup_coil'],(0,-.95,0))},reverse=True)
        add('Align pickup front plate ahead of the bridge',{'pickup_front_plate':shifted(final['pickup_front_plate'],(0,-1.35,0))})
        add('Seat pickup front plate from the opposite side',{'pickup_front_plate':shifted(final['pickup_front_plate'],(0,-.95,0))},reverse=True)
        add('Mount complete bridge and pickup unit',{n:final[n] for n in ['bridge','pickup_coil','pickup_front_plate']},reverse=True)
        for group,distance in [('pickguard',.65),('controls',.65)]:
            add('Bring '+group+' forward',{group:shifted(state[group],(0,-distance,0))})
            add('Align '+group+' with final mounting points',{group:shifted(final[group],(0,-distance,0))})
            add('Seat '+group,{group:final[group]},reverse=True)
    finally:
        for p in parts:p['object'].matrix_world=base[p['name']]
        bpy.context.view_layer.update()
    return stages,{'assemblyFit':fit_report,'sourceLayout':'Source separated layout with documented pickup-front seating gap at progress 0; V2-derived assembled pose with documented neck-seat and pickup-front clearances at progress 1.',
        'jointPolicy':'Approach directions are checked as reverse withdrawals from original CAD joints; exact contact at the final joint is intentional.',
        'floorLiftSourceUnits':.035,'initialSeamToleranceSourceUnits':2e-6,
        'neckJointSeatingClearanceSourceUnits':.00002,'neckHeelHeightAdjustmentSourceUnits':.01,
        'pickupFrontPlateClearanceSourceUnits':pickup_front_clearance,
        'initialTransforms':{n:m.tolist() for n,m in initial.items()},
        'pickupConstruction':'The two independently connected source CAD solids enter from opposite sides of the bridge plate; no mesh is cut or substituted.'}

if __name__=='__main__':
    from study_expanded_assembly import setup,geometries,OUT
    _,parts=setup('education')
    targets,report=fit(parts)
    for p in parts:p['object'].matrix_world=Matrix.Translation((0,0,.035))@Matrix(targets[p['group']].tolist())@p['object'].matrix_world
    bpy.context.view_layer.update()
    gs=geometries(parts);results=[]
    for name in ['controls','pickguard','bridge','bridge_pickup','neck_pickup','neck']:
        g=next(g for g in gs if g.name==name)
        delta=np.array([0,-.7,0.])
        passed,result=check_path(g,delta,gs)
        results.append({'group':name,'passed':passed,**result})
        if passed:g.offset=delta;g.bvh=g.tree(delta)
        print('ASSEMBLED_WITHDRAWAL',name,passed,result,flush=True)
    (OUT/'assembly-education-withdrawal-study.json').write_text(json.dumps(results,indent=2))
