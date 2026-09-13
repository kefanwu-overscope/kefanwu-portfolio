"""Recover rigid assembly placements from the supplied matching V2 CAD export."""
import hashlib
import json
from pathlib import Path
import numpy as np
from mathutils import Matrix

CAD = Path('C:/Users/oc/Desktop/STL/Guitar Education')

def triangles(path):
    data=path.read_bytes()
    count=int.from_bytes(data[80:84],'little')
    return np.ndarray(count,dtype=np.dtype([('n','<f4',3),('v','<f4',(3,3)),('a','<u2')]),buffer=data,offset=84)['v'].astype(float)

def rigid(a,b,scale=False):
    ca,cb=a.mean(0),b.mean(0)
    aa,bb=a-ca,b-cb
    u,s,v=np.linalg.svd(aa.T@bb)
    correction=np.diag([1.,1.,np.linalg.det(v.T@u.T)])
    rotation=v.T@correction@u.T
    factor=float(np.sum(s*np.diag(correction))/np.sum(aa*aa)) if scale else 1.
    matrix=np.eye(4);matrix[:3,:3]=rotation*factor;matrix[:3,3]=cb-matrix[:3,:3]@ca
    return matrix,float(np.max(np.linalg.norm(a@matrix[:3,:3].T+matrix[:3,3]-b,axis=1)))

def configure(parts):
    for p in parts:
        n=p['name']
        if n.startswith('mat_chrome'):
            i=int(n.rsplit('_',1)[1])
            p['group']='bridge' if i<=11 else ('controls' if i<=18 else 'neck_pickup')
        elif n.startswith('mat_fretboard') or n.startswith('mat_maple'):p['group']='neck'
        elif n.startswith('mat_pickguard'):p['group']='pickguard'
        elif n.startswith('mat_plastic'):p['group']='bridge_pickup'
        else:p['group']='body'

def fit(parts):
    configure(parts)
    raw={p.name.removeprefix('exploded - '):p for p in CAD.glob('exploded - *.STL') if 'Saddle Height' not in p.name}
    body_name=next(n for n in raw if 'HBtelecaster' in n)
    body=next(p for p in parts if p['group']=='body')['object']
    source=np.unique(triangles(raw[body_name]).reshape(-1,3),axis=0)
    world=np.array([body.matrix_world@v.co for v in body.data.vertices])
    assert len(source)==len(world),(len(source),len(world))
    frame,frame_error=rigid(source,world,scale=True)
    assert frame_error<2e-6,frame_error
    cache=Path(__file__).resolve().parents[3]/'.codex/functional-motion-20260913/assembly-education-fit.json'
    if cache.exists():
        saved=json.loads(cache.read_text())
        if np.max(np.abs(np.array(saved['sourceToWorld'])-frame))<1e-9:
            valid=True
            for name,record in saved['partFits'].items():
                for prefix,field in [('exploded - ','explodedSha256'),('V2 - ','assembledSha256')]:
                    valid &= hashlib.sha256((CAD/(prefix+name)).read_bytes()).hexdigest()==record[field]
            if valid:return {g:np.array(m) for g,m in saved['groupTransforms'].items()},saved
    records={}
    for name,path in raw.items():
        target=CAD/('V2 - '+name)
        a,b=triangles(path).reshape(-1,3),triangles(target).reshape(-1,3)
        assert a.shape==b.shape,(path,a.shape,b.shape)
        transform,error=rigid(a[::max(1,len(a)//12000)],b[::max(1,len(b)//12000)])
        error=float(np.max(np.linalg.norm(a@transform[:3,:3].T+transform[:3,3]-b,axis=1)))
        assert error<.002,(name,error)
        records[name]={'matrix':transform.tolist(),'maximumResidualMm':error,
            'explodedSha256':hashlib.sha256(path.read_bytes()).hexdigest(),
            'assembledSha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    align=np.linalg.inv(np.array(records[body_name]['matrix']))
    group_files={
        'body':body_name,
        'neck':next(n for n in raw if 'Tele_Neck' in n),
        'pickguard':next(n for n in raw if 'Finger_Board' in n),
        'bridge_pickup':next(n for n in raw if n.startswith('Bridge_Pick_Up')),
        'neck_pickup':next(n for n in raw if n.startswith('Pick_Up_1')),
        'controls':next(n for n in raw if n.startswith('Control_Panel')),
        'bridge':next(n for n in raw if n.startswith('Bridge_Saddle')),
    }
    transforms={g:frame@align@np.array(records[n]['matrix'])@np.linalg.inv(frame) for g,n in group_files.items()}
    bridge_transforms=[np.array(v['matrix']) for n,v in records.items() if n.startswith('Bridge_Saddle')]
    assert max(np.max(np.abs(m-bridge_transforms[0])) for m in bridge_transforms)<.002
    return transforms,{'method':'Rigid fits between matching exploded and V2 source CAD triangle correspondences; existing approved meshes and material assignments are transformed, never replaced.',
        'sourceFrameFitMaximumError':frame_error,'sourceToWorld':frame.tolist(),'partFits':records,'groupSources':group_files,
        'groupTransforms':{g:m.tolist() for g,m in transforms.items()}}

if __name__=='__main__':
    import sys
    import bpy
    HERE=Path(__file__).resolve().parent
    sys.path.insert(0,str(HERE))
    from study_expanded_assembly import setup,OUT
    _,parts=setup('education')
    transforms,report=fit(parts)
    for p in parts:p['object'].matrix_world=Matrix(transforms[p['group']].tolist())@p['object'].matrix_world
    bpy.context.view_layer.update()
    (OUT/'assembly-education-fit.json').write_text(json.dumps(report,indent=2))
    for g in transforms:
        verts=np.array([p['object'].matrix_world@v.co for p in parts if p['group']==g for v in p['object'].data.vertices])
        print('FITTED',g,verts.min(0).tolist(),verts.max(0).tolist(),flush=True)
    scene=bpy.context.scene
    scene.render.resolution_x=480;scene.render.resolution_y=640;scene.render.resolution_percentage=100;scene.cycles.samples=8
    camera=scene.camera
    camera.location=(4,-8,4)
    from mathutils import Vector
    camera.rotation_euler=(Vector((0,0,1.8))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.ortho_scale=4.5
    scene.render.filepath=str(OUT/'assembly-education-fit.png')
    bpy.ops.render.render(write_still=True)
