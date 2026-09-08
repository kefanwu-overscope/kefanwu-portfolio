"""Independent offline QA: GLB -> numpy/mathutils BVH, never imports/exports through Blender.

All referenced vertices, every triangle centroid and all three edge midpoints in BOTH
directions; nearest surface is restricted to the corresponding primitive/instance.
Finite samples are NOT a certified continuous Hausdorff bound or a rendered scene.
"""
import argparse, hashlib, json, math, struct, sys, time
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform

ROOT = Path(__file__).resolve().parent
LIMITS = {
    'high': {'surfaceRelativeToPrimitiveExtent': 2e-5, 'normalDegrees': 0.5},
    'low': {'surfaceRelativeToPrimitiveExtent': 2e-4, 'normalDegrees': 2.0},
}

class GLB:
    def __init__(self, filename):
        data = Path(filename).read_bytes()
        self.sha = hashlib.sha256(data).hexdigest()
        offset = 12
        while offset < len(data):
            size, kind = struct.unpack_from('<II', data, offset)
            chunk = data[offset+8:offset+8+size]
            if kind == 0x4e4f534a: self.j = json.loads(chunk)
            if kind == 0x004e4942: self.bin = chunk
            offset += size+8

    def accessor(self, index):
        a = self.j['accessors'][index]
        v = self.j['bufferViews'][a['bufferView']]
        dtype = {5121:'u1', 5123:'<u2', 5125:'<u4', 5126:'<f4'}[a['componentType']]
        n = {'SCALAR':1, 'VEC2':2, 'VEC3':3, 'VEC4':4}[a['type']]
        item = np.dtype(dtype).itemsize
        return np.ndarray((a['count'], n), dtype=dtype, buffer=self.bin,
                          offset=v.get('byteOffset',0)+a.get('byteOffset',0),
                          strides=(v.get('byteStride',item*n),item)).copy()

    def primitive(self, mi, pi, matrix=None):
        p = self.j['meshes'][mi]['primitives'][pi]
        pos = self.accessor(p['attributes']['POSITION'])
        idx = self.accessor(p['indices']).reshape(-1,3).astype(np.int32)
        if 'NORMAL' in p['attributes']:
            normals = self.accessor(p['attributes']['NORMAL']).astype(np.float64)
        else:
            # THREE uses double cross products with Float32 accumulation after each face.
            triangles = pos.astype(np.float64)[idx]
            cross = np.cross(triangles[:,1]-triangles[:,0], triangles[:,2]-triangles[:,0])
            normals = np.zeros(pos.shape,dtype=np.float32)
            np.add.at(normals,idx.reshape(-1),np.repeat(cross,3,axis=0))
            normals = normals.astype(np.float64)
        if matrix is not None:
            pos = pos.astype(np.float64)@matrix[:3,:3].T+matrix[:3,3]
            normals = normals@np.linalg.inv(matrix[:3,:3])
        lens = np.linalg.norm(normals,axis=1)
        normals /= np.where(lens>0,lens,1)[:,None]
        return pos.astype(np.float64),idx,normals

    def instances(self):
        result=[]
        def visit(index,parent):
            n=self.j['nodes'][index]
            if 'matrix' in n: local=np.array(n['matrix']).reshape(4,4,order='F')
            else:
                x,y,z,w=n.get('rotation',[0,0,0,1])
                local=np.eye(4)
                local[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*w*z,2*x*z+2*w*y],
                                     [2*x*y+2*w*z,1-2*x*x-2*z*z,2*y*z-2*w*x],
                                     [2*x*z-2*w*y,2*y*z+2*w*x,1-2*x*x-2*y*y]])@np.diag(n.get('scale',[1,1,1]))
                local[:3,3]=n.get('translation',[0,0,0])
            world=parent@local
            if 'mesh' in n: result.append((index,n['mesh'],world))
            for child in n.get('children',[]): visit(child,world)
        for node in self.j['scenes'][self.j.get('scene',0)].get('nodes',[]): visit(node,np.eye(4))
        return result


def components(pos,idx):
    # Geometric connectivity across coincident seam vertices; no tolerance-based welding.
    _,remap=np.unique(pos,axis=0,return_inverse=True)
    tris=remap[idx]
    parents=list(range(int(remap.max())+1))
    def root(x):
        while parents[x]!=x:
            parents[x]=parents[parents[x]];x=parents[x]
        return x
    for a,b,c in tris:
        aa=root(int(a));bb=root(int(b));cc=root(int(c))
        parents[bb]=aa;parents[cc]=aa
    return len({root(int(i)) for i in np.unique(tris)})


def surface_direction(source,target):
    sp,si,sn=source;tp,ti,tn=target
    tv=[Vector(v) for v in tp];nv=[Vector(n) for n in tn]
    tree=BVHTree.FromPolygons(tv,ti.tolist(),all_triangles=True,epsilon=0.0)
    distances=[];normal_angles=[];worst=None;exact_faces=0
    # Coincident/very thin CAD surfaces can make a nearest query select the wrong
    # overlapping face. Prove identical triangles directly before querying BVH.
    def face_key(points):
        chunks=[p.tobytes() for p in points]
        return min(b''.join(chunks[k:]+chunks[:k]) for k in range(3))
    exact={face_key(tp[f]):f for f in ti}
    referenced_target={tp[i].tobytes() for i in np.unique(ti)}
    # Exact source vertex subset alone would miss the interiors of new bridging faces.
    for p in sp[np.unique(si)]:
        if p.tobytes() in referenced_target:
            distances.append(0.0);continue
        location,normal,index,distance=tree.find_nearest(Vector(p))
        assert location is not None
        distances.append(float(distance))
    for face in si:
        a,b,c=sp[face]
        samples=((a+b+c)/3,(a+b)/2,(b+c)/2,(c+a)/2)
        same=exact.get(face_key(sp[face]))
        if same is not None:
            distances.extend([0.0]*4);exact_faces+=1
            ns=Vector(sn[face].sum(axis=0));nt=Vector(tn[same].sum(axis=0))
            if ns.length>1e-8 and nt.length>1e-8:
                normal_angles.append(math.degrees(ns.angle(nt,0.0)))
            continue
        for k,p in enumerate(samples):
            location,normal,index,distance=tree.find_nearest(Vector(p))
            assert location is not None
            distances.append(float(distance))
            if k==0:
                ia,ib,ic=ti[index]
                ns=Vector(sn[face].sum(axis=0))
                nt=barycentric_transform(location,tv[ia],tv[ib],tv[ic],nv[ia],nv[ib],nv[ic])
                if ns.length>1e-8 and nt.length>1e-8:
                    angle=math.degrees(ns.angle(nt,0.0))
                    normal_angles.append(angle)
        if worst is None or distances[-4]>worst['distance']:
            worst={'distance':distances[-4],'centroid':samples[0].tolist()}
    d=np.asarray(distances);n=np.asarray(normal_angles)
    return {'samples':len(d),'exactMatchedTriangles':exact_faces,'max':float(d.max()),'p99':float(np.quantile(d,.99)),
            'rms':float(np.sqrt(np.mean(d*d))), 'normalSamples':len(n),
            'normalMaxDegrees':float(n.max()) if len(n) else 0,
            'normalP99Degrees':float(np.quantile(n,.99)) if len(n) else 0,
            'worstCentroidNormalized':worst}


def compare(a,b,level):
    records=[]
    for node,mi,mat in a.instances():
        for pi,_ in enumerate(a.j['meshes'][mi]['primitives']):
            source=a.primitive(mi,pi,mat);target=b.primitive(mi,pi,mat)
            sp,si,sn=source;tp,ti,tn=target
            exact_geometry=si.shape==ti.shape and np.array_equal(sp[si],tp[ti])
            exact_normals=exact_geometry and np.array_equal(sn[si],tn[ti])
            record={'node':node,'mesh':mi,'primitive':pi,'trianglesBefore':len(si),'trianglesAfter':len(ti),
                    'orderedTrianglePositionsExact':exact_geometry,'cornerNormalsExact':exact_normals}
            if exact_geometry and exact_normals:
                record.update(passed=True,method='All ordered triangle corners and normalized corner normals equal',sampleMaxRelative=0)
            else:
                lo=sp.min(axis=0);hi=sp.max(axis=0);scale=float((hi-lo).max());center=(lo+hi)/2
                assert scale>0
                fwd=surface_direction(((sp-center)/scale,si,sn),((tp-center)/scale,ti,tn))
                rev=surface_direction(((tp-center)/scale,ti,tn),((sp-center)/scale,si,sn))
                ca=components(sp,si);cb=components(tp,ti)
                distance=max(fwd['max'],rev['max']);normal=max(fwd['normalMaxDegrees'],rev['normalMaxDegrees'])
                record.update(primitiveWorldExtent=scale,forward=fwd,reverse=rev,componentsBefore=ca,componentsAfter=cb,
                              sampleMaxRelative=distance,sampleMaxWorldUnits=distance*scale,
                              passed=distance<=LIMITS[level]['surfaceRelativeToPrimitiveExtent'] and normal<=LIMITS[level]['normalDegrees'] and ca==cb)
            records.append(record)
    return {'passed':all(x['passed'] for x in records),'primitives':records,
            'maxSampleRelative':max(x['sampleMaxRelative'] for x in records)}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--only')
    parser.add_argument('--selection',action='store_true')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    candidates=json.loads((ROOT/('polish-selection.json' if args.selection else 'polish-candidates.json')).read_text())
    report={'version':1,'limits':LIMITS,'comparison':'Original high to candidate high; backed-up old low to candidate low',
            'method':'Independent Blender 4.5.9 mathutils BVH; all referenced vertices, every triangle centroid and all three edge midpoints bidirectionally, per primitive in world space, normalized by primitive extent. Interpolated normals sampled at every centroid. Exact unchanged primitives verified by ordered corner equality.',
            'limitations':'Finite samples, float32 BVH arithmetic; not continuous Hausdorff certification, material rendering, screen pixel error, or browser transition QA.', 'models':{}}
    output=ROOT/('geometry-final.json' if args.selection else ('geometry-comparison-partial.json' if args.only else 'geometry-comparison.json'))
    previous=json.loads(output.read_text()) if output.exists() else {}
    for url,levels in candidates['models'].items():
        if args.only and args.only not in url:continue
        report['models'][url]={}
        for level,r in levels.items():
            start=time.monotonic()
            a=GLB(r['input']);b=GLB(r['output'])
            assert a.sha==r['inputSha256'] and b.sha==r['outputSha256']
            cached=previous.get('models',{}).get(url,{}).get(level,{})
            if previous.get('limits')==LIMITS and cached.get('inputSha256')==a.sha and cached.get('outputSha256')==b.sha:
                result=cached
            else:result=compare(a,b,level)
            result.update(inputSha256=a.sha,outputSha256=b.sha)
            report['models'][url][level]=result
            output.write_text(json.dumps(report,indent=2)+'\n')
            print(json.dumps({'url':url,'level':level,'passed':result['passed'],'maxRelative':result['maxSampleRelative'],
                              'failedPrimitives':sum(not x['passed'] for x in result['primitives']),'seconds':round(time.monotonic()-start,1)}),flush=True)

if __name__=='__main__':main()
