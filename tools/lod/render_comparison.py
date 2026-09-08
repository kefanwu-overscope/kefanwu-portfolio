"""Fixed-view offline normal/shading/silhouette QA, no browser, server or GLB re-export.

Neutral opaque material isolates geometry and real interpolated normals. This is not
the website's PBR lighting, texture, transparency, shadow, or LOD-transition render.
"""
import json, math, sys, time
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.geometry import barycentric_transform
sys.path.insert(0,str(Path(__file__).resolve().parent))
from compare_geometry import GLB, ROOT

SIZE=768
VIEWS={'front':(0,0,1),'rear':(0,0,-1),'right':(1,0,0),'left':(-1,0,0),
       'top':(0,1,0),'bottom':(0,-1,0),'oblique':(1,.7,1),'opposite':(-1,.6,-1)}
LIMITS={'silhouetteChangedFraction':0.0001,'silhouetteBoundaryPixelDistance':1.0,
        'commonPixelShadeRMSE':0.002,'commonPixelShadeMax':0.01,'commonPixelNormalMaxDegrees':1.0,
        'commonPixelNormalP99Degrees':0.5,'commonPixelNormalP999Degrees':2.0}

def passed(r):
    return r['silhouetteChangedFraction']<=LIMITS['silhouetteChangedFraction'] and r['boundaryWithinOnePixel'] and all(
        r[k]<=LIMITS[k] for k in ('commonPixelShadeRMSE','commonPixelShadeMax','commonPixelNormalMaxDegrees','commonPixelNormalP99Degrees','commonPixelNormalP999Degrees'))

def merged(glb,center,scale):
    positions=[];normals=[];indices=[];offset=0
    for _,mi,matrix in glb.instances():
        for pi,_ in enumerate(glb.j['meshes'][mi]['primitives']):
            p,i,n=glb.primitive(mi,pi,matrix)
            positions.append((p-center)/scale);normals.append(n);indices.append(i+offset);offset+=len(p)
    pos=np.concatenate(positions);idx=np.concatenate(indices);norm=np.concatenate(normals)
    pv=[Vector(v) for v in pos];nv=[Vector(n) for n in norm]
    return pos,idx,pv,nv,BVHTree.FromPolygons(pv,idx.tolist(),all_triangles=True,epsilon=0.0)

def render(mesh,direction,projection=None):
    pos,idx,pv,nv,tree=mesh
    eye=Vector(direction).normalized();up=Vector((0,1,0))
    if abs(eye.dot(up))>.95:up=Vector((0,0,1))
    right=up.cross(eye).normalized();up=eye.cross(right).normalized()
    projected=np.column_stack((pos@np.array(right),pos@np.array(up)))
    if projection is None:
        lo=projected.min(axis=0);hi=projected.max(axis=0)
        mid=(lo+hi)/2;extent=max(hi-lo)*1.08
        projection={'mid':mid.tolist(),'extent':float(extent)}
    mid=np.array(projection['mid']);extent=projection['extent']
    mask=np.zeros((SIZE,SIZE),bool);shade=np.full((SIZE,SIZE),0.035,np.float32)
    normal_map=np.zeros((SIZE,SIZE,3),np.float32)
    # Restrict rays to projected bounds, including two safety pixels.
    pp=(projected-mid)/extent*SIZE+SIZE/2
    lo=np.floor(pp.min(axis=0)).astype(int)-2;hi=np.ceil(pp.max(axis=0)).astype(int)+2
    light=(eye*.6+right*-.5+up*.8).normalized();fill=(eye*.3+right*.8-up*.2).normalized()
    halfway=(light+eye).normalized();ray=-eye
    for yy in range(max(0,lo[1]),min(SIZE,hi[1]+1)):
        y=mid[1]+(yy+.5-SIZE/2)*extent/SIZE
        for xx in range(max(0,lo[0]),min(SIZE,hi[0]+1)):
            x=mid[0]+(xx+.5-SIZE/2)*extent/SIZE
            origin=right*x+up*y+eye*2
            location,face_normal,face,distance=tree.ray_cast(origin,ray,4)
            if location is None:continue
            a,b,c=idx[face]
            n=barycentric_transform(location,pv[a],pv[b],pv[c],nv[a],nv[b],nv[c])
            if n.length<1e-8:n=face_normal.copy()
            n.normalize()
            # Double-sided neutral inspection material; original normal splits stay intact.
            if n.dot(eye)<0:n=-n
            row=SIZE-1-yy
            mask[row,xx]=True;normal_map[row,xx]=n
            shade[row,xx]=min(1,.12+.52*max(0,n.dot(light))+.14*max(0,n.dot(fill))+.22*max(0,n.dot(halfway))**64)
    return mask,shade,normal_map,projection

def metrics(a,b):
    ma,sa,na,_=a;mb,sb,nb,_=b
    union=ma|mb;common=ma&mb;changed=ma^mb
    fraction=int(changed.sum())/max(1,int(union.sum()))
    # Exact 3x3 dilation suffices for the <=1-pixel Euclidean distance gate.
    def near(mask):
        padded=np.pad(mask,1);out=mask.copy()
        for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)):
            out|=padded[1+dy:1+dy+SIZE,1+dx:1+dx+SIZE]
        return out
    within_one=not np.any(ma&~near(mb)) and not np.any(mb&~near(ma))
    d=np.abs(sa[common]-sb[common])
    if common.any():
        n1=na[common].astype(np.float64);n2=nb[common].astype(np.float64)
        # Re-normalize after Float32 storage, avoiding a false ~0.03 degree noise floor.
        cos=(n1*n2).sum(axis=1)/(np.linalg.norm(n1,axis=1)*np.linalg.norm(n2,axis=1))
        angles=np.degrees(np.arccos(np.clip(cos,-1,1)))
    else:angles=np.zeros(1)
    r={'occupiedUnionPixels':int(union.sum()),'silhouetteChangedPixels':int(changed.sum()),
       'silhouetteChangedFraction':fraction,'silhouetteIoU':int(common.sum())/max(1,int(union.sum())),
       'boundaryWithinOnePixel':bool(within_one),'commonPixelShadeRMSE':float(np.sqrt(np.mean(d*d))) if len(d) else 0,
       'commonPixelShadeMax':float(d.max()) if len(d) else 0,
       'commonPixelNormalMaxDegrees':float(angles.max()),'commonPixelNormalP99Degrees':float(np.quantile(angles,.99)),
       'commonPixelNormalP999Degrees':float(np.quantile(angles,.999)),'pixelsNormalOver5Degrees':int((angles>5).sum())}
    r['passed']=passed(r)
    return r

def panel(a,b,title,path):
    ma,sa,na,_=a;mb,sb,nb,_=b
    def gray(s):return np.repeat((np.clip(s,0,1)**(1/2.2)*255).astype(np.uint8)[...,None],3,axis=2)
    aa=gray(sa);bb=gray(sb)
    dd=gray(np.minimum(1,np.abs(sa-sb)*25));dd[ma^mb]=[255,30,100]
    canvas=Image.new('RGB',(SIZE*3,SIZE+60),(240,240,240));draw=ImageDraw.Draw(canvas)
    draw.text((12,6),title,fill=(20,20,20))
    for i,(arr,label) in enumerate(((aa,'Reference'),(bb,'Selected'),(dd,'Absolute linear shade difference x25; silhouette difference pink'))):
        canvas.paste(Image.fromarray(arr),(SIZE*i,60));draw.text((SIZE*i+12,32),label,fill=(20,20,20))
    canvas.save(path)

def main():
    selection=json.loads((ROOT/'polish-selection.json').read_text())
    output=ROOT/'visual-comparison.json';folder=ROOT/'visual-comparison';folder.mkdir(exist_ok=True)
    previous=json.loads(output.read_text()) if output.exists() else {}
    report={'version':1,'resolution':[SIZE,SIZE],'views':VIEWS,'limits':LIMITS,
            'method':'Orthographic double-sided neutral opaque ray render of original world-space geometry, with original stored normals or THREE-equivalent indexed Float32 accumulated normals, barycentric interpolation and fixed diffuse/specular lighting. No remeshing or normal smoothing.',
            'limitations':'No antialiasing; finite views and resolution. Not website PBR textures, transmission, lighting, shadow, postprocessing or switching. Exact-byte-identical pairs reuse a render, backed by SHA256 identity.', 'models':{}}
    for url,levels in selection['models'].items():
        report['models'][url]={}
        for level,r in levels.items():
            a=GLB(r['input']);b=GLB(r['output']);assert a.sha==r['inputSha256'] and b.sha==r['outputSha256']
            cached=previous.get('models',{}).get(url,{}).get(level,{})
            if cached.get('inputSha256')==a.sha and cached.get('outputSha256')==b.sha and len(cached.get('views',{}))==len(VIEWS) and all((ROOT.parent.parent/v['image']).exists() for v in cached['views'].values()):
                for v in cached['views'].values():v['passed']=passed(v)
                cached['passed']=all(v['passed'] for v in cached['views'].values())
                report['models'][url][level]=cached
                output.write_text(json.dumps(report,indent=2)+'\n')
                print(json.dumps({'model':Path(url).stem,'level':level,'reusedUnchangedHashes':True,'passed':cached['passed']}),flush=True)
                continue
            raw=[]
            for _,mi,mat in a.instances():
                for pi,_ in enumerate(a.j['meshes'][mi]['primitives']):raw.append(a.primitive(mi,pi,mat)[0])
            points=np.concatenate(raw);lo=points.min(axis=0);hi=points.max(axis=0);center=(hi+lo)/2;scale=float((hi-lo).max())
            source=merged(a,center,scale);selected=source if a.sha==b.sha else merged(b,center,scale)
            record={'inputSha256':a.sha,'outputSha256':b.sha,'byteIdentical':a.sha==b.sha,'views':{}}
            report['models'][url][level]=record
            stem=Path(url).stem
            for name,direction in VIEWS.items():
                start=time.monotonic();first=render(source,direction);second=first if a.sha==b.sha else render(selected,direction,first[3])
                m=metrics(first,second);m['projection']=first[3]
                filename=f'{stem}-{level}-{name}.png';m['image']='tools/lod/visual-comparison/'+filename
                panel(first,second,f'{stem} | {level} | {name} | 768 px | real interpolated vertex normals',folder/filename)
                record['views'][name]=m
                output.write_text(json.dumps(report,indent=2)+'\n')
                print(json.dumps({'model':stem,'level':level,'view':name,'passed':m['passed'],'maskChanged':m['silhouetteChangedPixels'],
                                  'shadeRMSE':m['commonPixelShadeRMSE'],'seconds':round(time.monotonic()-start,1)}),flush=True)
            record['passed']=all(m['passed'] for m in record['views'].values())
            # Compact contact sheet; full-resolution evidence remains in each individual PNG.
            sheet=Image.new('RGB',(1152,207*4),(240,240,240))
            for i,name in enumerate(VIEWS):
                im=Image.open(folder/f'{stem}-{level}-{name}.png');im.thumbnail((576,414))
                sheet.paste(im,((i%2)*576,(i//2)*207))
            sheet.save(folder/f'{stem}-{level}-contact.png')
            output.write_text(json.dumps(report,indent=2)+'\n')

if __name__=='__main__':main()
