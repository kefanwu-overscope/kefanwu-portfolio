"""Create new white derivatives; never update existing catalog or asset URLs."""
import argparse, hashlib, json
from collections import Counter
from copy import deepcopy
from pathlib import Path
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
FOLDER=ROOT.parent/'.codex/white-studio-20261011'
EXPORTS=FOLDER/'exports'
REV='white-20261011'
BASE='assets/exploded/'+REV
COVERBASE='assets/editorial/'+REV
CATALOGS=['assets/exploded/manifest.json','assets/exploded/manifest-detail.json','assets/editorial/animation-covers.json']
BACKGROUND_CORNERS=Counter()
def read(path):return json.loads(Path(path).read_text(encoding='utf-8'))
def write(path,data):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(data):return hashlib.sha256(data).hexdigest()
def asset(name,data):
    path=ROOT/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
    return name+'?v='+sha(data)[:12]
def sources():
    paths=set(CATALOGS+['assets/studio-motion/index.json','studio-motion-runtime.js','studio-steering-motion.js','studio-photo-materials.js','studio-inspector-materials.js','studio-inspector-camera.js'])
    index=read(ROOT/'assets/studio-motion/index.json')
    for entry in index['projects'].values():
        p=ROOT/'assets/studio-motion'/entry['manifest'];paths.add(p.relative_to(ROOT).as_posix())
        for buffer in read(p)['buffers'].values():paths.add((p.parent/buffer['url']).relative_to(ROOT).as_posix())
    for name in CATALOGS[:2]:
        for project in read(ROOT/name)['projects'].values():
            paths.update(url.split('?')[0] for url in project['frames'])
            paths.update(chunk['url'].split('?')[0] for chunk in project['chunks'])
            paths.add(project['provenance'])
    for cover in read(ROOT/CATALOGS[2])['projects'].values():paths.update(v['src'] for v in cover['variants'])
    return {name:sha((ROOT/name).read_bytes()) for name in sorted(paths)}
def dimensions(path,width,height):
    with Image.open(path) as image:
        assert image.size==(width,height),(str(path),image.size)
        rgb=image.convert('RGB')
        for p in [(0,0),(width-1,0),(0,height-1),(width-1,height-1)]:
            pixel=rgb.getpixel(p);BACKGROUND_CORNERS[','.join(map(str,pixel))]+=1
            # Native scene and composite are #fff; lossy WebP can shift a
            # corner by a few code values. Never filter/replace model pixels.
            assert all(252<=channel<=255 for channel in pixel),(str(path),p,pixel)

def pack():
    contract=read(FOLDER/'preservation-before.json')
    assert sources()==contract,'Existing source or immutable asset bytes changed'
    result=read(EXPORTS/'result.json');assert not result['proof'] and not result['errors'],result.get('errors')
    original=read(ROOT/CATALOGS[0]);keys=list(original['projects'])
    assert set(result['results'])==set(keys)
    covers=deepcopy(read(ROOT/CATALOGS[2]));anchors={};summary={}
    index=read(ROOT/'assets/studio-motion/index.json')
    for quality,oldname,newname,width,height in [
        ('sd',CATALOGS[0],'assets/exploded/manifest-white-20261011.json',640,427),
        ('hd',CATALOGS[1],'assets/exploded/manifest-detail-white-20261011.json',1280,854)]:
        manifest=deepcopy(read(ROOT/oldname))
        for key,project in manifest['projects'].items():
            report=read(EXPORTS/key/'report.json');assert report['count']==len(project['frames'])
            assert report['indices']==list(range(report['count']))
            assert report['coverState']['progress']==0 and report['coverState']['motionReady']
            assert all(report['points']) and len(report['points'])==report['count']
            if quality=='sd':anchors[key]={'aspect':640/427,'points':report['points'],'masks':report['masks']}
            frames=[];chunks=[];records=[];payload=bytearray();total=0
            def flush():
                if not records:return
                data=bytes(payload);url=asset(f'{BASE}/{quality}/chunks/{key}/{len(chunks):03d}.bin',data)
                chunks.append({'url':url,'bytes':len(data),'frames':records.copy()});payload.clear();records.clear()
            for i in range(report['count']):
                source=EXPORTS/key/('detail' if quality=='hd' else '')/f'{i:02d}.webp'
                dimensions(source,width,height);data=source.read_bytes()
                frames.append(asset(f'{BASE}/{quality}/{key}/{i:02d}.webp',data));total+=len(data)
                limit=4 if not chunks else 16
                if records and (len(records)>=limit or len(payload)+len(data)>256*1024):flush()
                records.append({'index':i,'offset':len(payload),'length':len(data)});payload.extend(data)
            flush()
            provenance={'project':key,'renderer':'Three.js r185 WebGL, source geometry and sampled motion','revision':REV,
                'palette':'studio-photo-materials.js','background':'#ffffff','backgroundComposition':'Opaque white scene background participates in physical transmission; native WebGL antialiasing; no pixel filtering.',
                'sourceManifest':index['projects'][key]['manifest'],'sourceManifestSha256':index['projects'][key]['sha256'],
                'camera':report['state']['camera'],'coverCamera':report['coverState']['camera'],'coverProgress':0,
                'frameCount':len(frames),'width':width,'height':height,'bytes':total}
            write(ROOT/f'{BASE}/{quality}/{key}/provenance.json',provenance)
            project.update(frames=frames,poster=frames[0],bytes=total,chunks=chunks,chunkBytes=total,chunkVersion=1,provenance=f'{BASE}/{quality}/{key}/provenance.json')
            if quality=='sd':
                variants=[]
                for size in [480,960,1800]:
                    source=EXPORTS/key/f'cover-{size}.webp';dimensions(source,size,size*2//3);data=source.read_bytes()
                    path=f'{COVERBASE}/{key}-wide-{size}.webp';url=asset(path,data)
                    variants.append({'src':path,'width':size,'height':size*2//3,'sha256':sha(data),'bytes':len(data),'url':url})
                covers['projects'][key].update(src=variants[-1]['url'],srcset=', '.join(f'{v["url"]} {v["width"]}w' for v in variants),
                    variants=[{k:v for k,v in row.items() if k!='url'} for row in variants],sourceFrame=frames[0],
                    sourceFrameSha256=sha((ROOT/frames[0].split('?')[0]).read_bytes()),provenance=f'{BASE}/sd/{key}/provenance.json')
        manifest['revision']=REV
        if 'chunkTransport' in manifest:manifest['chunkTransport'].update(bytes=sum(p['bytes'] for p in manifest['projects'].values()),frameCount=sum(len(p['frames']) for p in manifest['projects'].values()),chunkCount=sum(len(p['chunks']) for p in manifest['projects'].values()))
        write(ROOT/newname,manifest)
        summary[quality]={'manifest':newname,'frames':sum(len(p['frames']) for p in manifest['projects'].values()),'bytes':sum(p['bytes'] for p in manifest['projects'].values()),'chunks':sum(len(p['chunks']) for p in manifest['projects'].values())}
    solved=read(ROOT/'assets/studio-motion'/index['projects']['ansysCfd']['manifest'])['source']['motionReport']
    anchors['ansysCfd']['legend']={k:solved[k] for k in ['pressureRangePa','pressureColorNormalization']}
    covers['revision']=REV
    write(ROOT/f'{BASE}/anchors.json',anchors);write(ROOT/f'{COVERBASE}/animation-covers.json',covers)
    summary.update(revision=REV,status='packed',renderMilliseconds=result['elapsedMilliseconds'],preservedFileCount=len(contract),covers=f'{COVERBASE}/animation-covers.json',anchors=f'{BASE}/anchors.json',nativeBackground='#ffffff',encodedBackgroundTolerance=3,encodedCornerCounts=dict(BACKGROUND_CORNERS))
    assert sources()==contract,'Existing source or immutable asset bytes changed'
    write(FOLDER/'pack-report.json',summary);print(json.dumps(summary))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--snapshot',action='store_true');args=parser.parse_args()
    if args.snapshot:
        file=FOLDER/'preservation-before.json';assert not file.exists(),'Preservation snapshot already exists'
        data=sources();write(file,data);print(json.dumps({'preservedFiles':len(data),'path':str(file)}))
    else:pack()
