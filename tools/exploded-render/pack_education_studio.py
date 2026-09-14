"""Pack new education home frames and covers; emit candidate records only.

The new 640x427 home sequence is downsampled from freshly rendered 1280x854
masters. Existing assets and shared manifests/catalogs are never overwritten.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from PIL import Image
import pack_frame_chunks as chunker

ROOT=Path(__file__).resolve().parents[2]
REVISION='education-studio-20260914'

def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def save(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
def relative(path):return path.relative_to(ROOT).as_posix()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,required=True,help='Folder containing education/00.png etc.')
    parser.add_argument('--evidence',type=Path,required=True)
    opts=parser.parse_args()
    folder=opts.input.resolve()/'education'
    evidence=opts.evidence.resolve()
    source=read(folder/'provenance.json')
    cover=read(evidence/'cover-provenance.json')
    assert source['motionRevision']=='detail-resolution-20260914'
    assert (source['width'],source['height'],source['frameCount'])==(1280,854,121)
    assert source['sourcePreservation']['status']=='passed'
    assert cover['coverProgress']==0 and cover['samples']==192
    assert cover['cameraFrameMaximumError']<2e-6
    frame_dir=ROOT/'assets/exploded'/REVISION/'education'
    frame_dir.mkdir(parents=True,exist_ok=True)
    encoded=[];masters=[]
    for i in range(121):
        master=folder/f'{i:02d}.png'
        with Image.open(master) as im:
            assert im.mode=='RGB' and im.size==(1280,854),(master,im.mode,im.size)
            resized=im.resize((640,427),Image.Resampling.LANCZOS)
            path=frame_dir/f'{i:02d}.webp'
            resized.save(path,'WEBP',quality=85,method=6,exact=True)
        encoded.append({'file':path.name,'bytes':path.stat().st_size,'sha256':sha(path)})
        masters.append({'file':master.name,'bytes':master.stat().st_size,'sha256':sha(master)})
    provenance=copy.deepcopy(source)
    provenance.update(width=640,height=427,encodedFrames=encoded,sourceMasterDimensions=[1280,854],sourceMasterPNGs=masters,encoding={'format':'WebP static images','quality':85,'method':6,'resize':'Lanczos downsample from new 1280x854 rendered master to 640x427','rasterRetouching':False})
    save(frame_dir/'provenance.json',provenance)
    urls=[f'{relative(frame_dir)}/{r["file"]}?v={r["sha256"][:12]}' for r in encoded]
    home={'mode':'assembling','label':'Guitar assembly','width':640,'height':427,'poster':urls[0],'frames':urls,'provenance':relative(frame_dir/'provenance.json'),'bytes':sum(r['bytes'] for r in encoded)}
    original=copy.deepcopy(home)
    chunker.CHUNK_DIRECTORY=f'assets/exploded/{REVISION}/chunks'
    chunker.pack_project('education',home,ROOT,ROOT/'assets/exploded/manifest.json',ROOT,16,16*1024*1024,4)
    chunk_audit=chunker.verify_project('education',original,home,ROOT,ROOT/'assets/exploded/manifest.json',ROOT)
    save(evidence/'candidate-home.json',home)
    destination=ROOT/'assets/editorial'/REVISION
    destination.mkdir(parents=True,exist_ok=True)
    variants=[]
    master=evidence/'cover.png'
    assert sha(master)==cover['masterSha256']
    with Image.open(master) as im:
        assert im.mode=='RGB' and im.size==(1800,1200)
        for width in (480,960,1800):
            image=im if width==1800 else im.resize((width,width*2//3),Image.Resampling.LANCZOS)
            path=destination/f'education-wide-{width}.webp'
            image.save(path,'WEBP',quality=91 if width==1800 else 87,method=6,exact=True)
            variants.append({'src':relative(path),'width':width,'height':width*2//3,'bytes':path.stat().st_size,'sha256':sha(path)})
    public={k:v for k,v in cover.items() if k not in ('masterPNG','sourceHDFramePNG')}
    public.update(variants=variants,sourceFrame=urls[0],sourceFrameSha256=encoded[0]['sha256'],sourceAnimationProvenance=home['provenance'],sourceAnimationProvenanceSha256=sha(frame_dir/'provenance.json'),sourceAnimationRevision='detail-resolution-20260914',sourceFrameCount=121,sourceDimensions=[640,427],sourceMasterDimensions=[1280,854],coverProgress=0.,encoding={'qualityMaster':91,'qualityResponsive':87,'method':6,'rasterRetouching':False})
    public_path=destination/'education-provenance.json'
    save(public_path,public)
    url=lambda item:item['src']+'?v='+item['sha256'][:12]
    candidate={'src':url(variants[-1]),'srcset':', '.join(url(v)+f' {v["width"]}w' for v in variants),'alt':'Separated guitar education kit before assembly.','width':1800,'height':1200,'variants':variants,'coverProgress':0.,'sourceFrame':urls[0],'sourceFrameSha256':encoded[0]['sha256'],'provenance':relative(public_path)+'?v='+sha(public_path)[:12]}
    save(evidence/'candidate-cover.json',candidate)
    checks={'status':'passed','frames':121,'homeDimensions':[640,427],'homeBytes':home['bytes'],'chunkCount':len(home['chunks']),'chunkBytes':home['chunkBytes'],'chunkVerification':chunk_audit,'coverVariants':len(variants),'coverBytes':sum(v['bytes'] for v in variants),'coverDimensions':[1800,1200],'sourcePreservation':'source-preservation.json','homeSourceIsNewHDMasters':True,'existingSharedManifestsModified':False}
    save(evidence/'pack-validation.json',checks)
    print(json.dumps({k:v for k,v in checks.items() if k!='chunkVerification'}))

if __name__=='__main__':main()
