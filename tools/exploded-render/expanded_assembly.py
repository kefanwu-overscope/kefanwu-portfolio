"""Additional component extraction and source-CAD educational reassembly."""
import hashlib
import json
from pathlib import Path
import bpy
import numpy as np
from mathutils import Matrix,Vector
from assembly_motion import Geometry,check_path,geometry_digest

HERE=Path(__file__).resolve().parent
OUT=HERE.parents[2]/'.codex/functional-motion-20260913'
VERSION=1
IMPLEMENTATION_SOURCE=Path(__file__).read_bytes()

def configure_line(parts):
    for p in parts:
        n=p['name']
        if n in ('mat_plastic_black_part_0','mat_plastic_black_part_1'):g='front_sensor_strips'
        elif n=='mat_rubber_orange_part_0':g='right_tire'
        elif n=='mat_rubber_orange_part_1':g='left_tire'
        elif n in ('mat_steel_part_3','mat_plastic_black_part_10','mat_plastic_black_part_18'):g='usb_connector'
        elif n=='mat_plastic_black_part_9':g='power_connector'
        elif n.startswith('mat_plastic_black') and 11<=int(n.rsplit('_',1)[1])<=17:g='io_headers'
        else:g='robot_chassis_and_electronics'
        p['group']=g

def configure_pool(parts):
    names={'mat_printed_part_5':'left_side_support','mat_printed_part_6':'right_side_support',
        'mat_aero_part_7':'side_metal_bracket','mat_steel_part_16':'rear_cross_shaft',
        'mat_steel_part_17':'middle_cross_shaft','mat_steel_part_18':'front_cross_shaft'}
    for p in parts:p['group']=names.get(p['name'],'cue_housing_and_transmission')

def geometries(parts):
    buckets={}
    for p in parts:buckets.setdefault(p['group'],[]).append(p)
    deps=bpy.context.evaluated_depsgraph_get()
    return [Geometry(n,ps,deps) for n,ps in buckets.items()]

class ExpandedMotion:
    def __init__(self,key,parts,report):
        self.key,self.parts,self.report=key,parts,report
        self.mode='assembling' if key=='education' else 'assembly'
        self.objects=[p['object'] for p in parts]
        self.initial=[o.matrix_world.copy() for o in self.objects]
        self.stages=report['stages']
        for p in parts:p['group']=report['partGroups'][p['name']]

    def apply(self,progress):
        progress=min(1.,max(0.,float(progress)))
        transforms={n:Matrix(m) for n,m in self.report.get('initialTransforms',{}).items()}
        for s in self.stages:
            if progress<s['start']:continue
            t=min(1.,(progress-s['start'])/(s['end']-s['start']))
            t=t*t*(3-2*t)
            pairs=s.get('transforms',{s.get('group',''):s})
            for group,pair in pairs.items():
                a,b=Matrix(pair['fromMatrix']),Matrix(pair['toMatrix'])
                la,qa,sa=a.decompose();lb,qb,sb=b.decompose()
                matrix=Matrix.LocRotScale(la.lerp(lb,t),qa.slerp(qb,t),sa.lerp(sb,t))
                if 'pivot' in s:
                    pivot=Vector(s['pivot']);center=(a@pivot).lerp(b@pivot,t)
                    matrix.translation=center-matrix.to_3x3()@pivot
                transforms[group]=matrix
        for p,base in zip(self.parts,self.initial):p['object'].matrix_world=transforms.get(p['group'],Matrix.Identity(4))@base
        bpy.context.view_layer.update()

def _extract(key,parts):
    recipes={
        'pool':[('left_side_support',(-1.2,0,0)),('right_side_support',(1.2,0,0)),
                ('side_metal_bracket',(-.8,0,0)),('rear_cross_shaft',(.7,0,0)),
                ('middle_cross_shaft',(.7,0,0)),('front_cross_shaft',(.7,0,0))],
        'lineFollower':[('right_tire',(.7,0,0)),('left_tire',(-.7,0,0)),
                ('usb_connector',(0,0,.7)),('power_connector',(0,0,.7)),
                ('io_headers',(0,0,.7)),('front_sensor_strips',(0,-.7,-.005))],
    }[key]
    gs=geometries(parts);byname={g.name:g for g in gs};stages=[]
    for name,delta in recipes:
        g=byname[name];delta=np.array(delta)
        passed,verification=check_path(g,delta,gs,samples=97)
        if not passed:raise RuntimeError((key,name,verification))
        g.offset=delta;g.bvh=g.tree(delta)
        stages.append({'group':name,'fromMatrix':np.eye(4).tolist(),
            'toMatrix':[list(row) for row in Matrix.Translation(Vector(delta))],
            'translation':delta.tolist(),'verification':verification})
        print('EXPANDED_STAGE',key,name,flush=True)
    return stages,{}

def build_expanded(key,parts,scene):
    if key=='lineFollower':configure_line(parts)
    elif key=='pool':configure_pool(parts)
    elif key=='education':
        from education_assembly_fit import configure
        configure(parts)
    else:raise ValueError(key)
    digest=hashlib.sha256((geometry_digest(key,parts)+str(VERSION)).encode()+IMPLEMENTATION_SOURCE)
    dependencies={}
    if key=='education':
        from education_assembly_fit import CAD
        inputs=[HERE/n for n in ['education_assembly_fit.py','education_assembly_path.py','education_contact_check.py']]
        inputs+=sorted(CAD.glob('*.STL'))
        for path in inputs:
            content=path.read_bytes();digest.update(content)
            dependencies[str(path)]=hashlib.sha256(content).hexdigest()
    fingerprint=digest.hexdigest()
    OUT.mkdir(parents=True,exist_ok=True)
    cache=OUT/('assembly-'+key+'-plan.json')
    if cache.exists():
        report=json.loads(cache.read_text())
        if report.get('version')==VERSION and report.get('geometryDigest')==fingerprint:return ExpandedMotion(key,parts,report)
    if key=='education':
        from education_assembly_path import plan_education
        stages,extra=plan_education(parts,scene)
    else:stages,extra=_extract(key,parts)
    for i,s in enumerate(stages):s['start']=i/len(stages);s['end']=(i+1)/len(stages)
    report={'version':VERSION,'project':key,'geometryDigest':fingerprint,'stages':stages,
        'partGroups':{p['name']:p['group'] for p in parts},
        'method':'Source meshes and materials retained. Rigid component transforms with independent full-path geometric verification.',
        'checker':'Original assembly_motion VERSION15 continuous translation SAT plus 97-pose bidirectional closed-component containment checks.',
        'inputDependencies':dependencies,
        'passed':True,**extra}
    cache.write_text(json.dumps(report,indent=2)+'\n')
    return ExpandedMotion(key,parts,report)
