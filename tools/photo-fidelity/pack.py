import json,hashlib,re,shutil
from pathlib import Path
from PIL import Image
root=Path(__file__).resolve().parents[2];folder=root.parent/'.codex/photo-fidelity-20260930';exports=folder/'exports'
REV='photo-20260930';base='assets/exploded/'+REV;coverbase='assets/editorial/'+REV
result=json.loads((exports/'result.json').read_text(encoding='utf-8'));assert not result['errors'],result['errors']
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def sha(b):return hashlib.sha256(b).hexdigest()
def asset(path,b):
 p=root/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b);return path+'?v='+sha(b)[:12]
covers=read(root/'assets/editorial/animation-covers.json');oldcovers=json.loads(json.dumps(covers));anchors={};reports={}
for quality,name,width,height in [('sd','manifest.json',640,427),('hd','manifest-detail.json',1280,854)]:
 manifest=read(root/'assets/exploded'/name);before=sum(p['bytes'] for p in manifest['projects'].values())
 for key,project in manifest['projects'].items():
  report=read(exports/key/'report.json');assert report['count']==len(project['frames']);assert all(report['points'])
  if quality=='sd':anchors[key]={'aspect':640/427,'points':report['points']}
  frames=[];chunks=[];records=[];payload=bytearray();total=0
  def flush():
   if not records:return
   data=bytes(payload);url=asset(f'{base}/{quality}/chunks/{key}/{len(chunks):03d}.bin',data)
   chunks.append({'url':url,'bytes':len(data),'frames':records.copy()});payload.clear();records.clear()
  for i in range(report['count']):
   source=exports/key/('detail' if quality=='hd' else '')/f'{i:02d}.webp';data=source.read_bytes()
   with Image.open(source) as image:assert image.size==(width,height);assert image.convert('RGB').getpixel((0,0))==(24,24,24)
   frames.append(asset(f'{base}/{quality}/{key}/{i:02d}.webp',data));total+=len(data)
   limit=4 if not chunks else 16
   if records and (len(records)>=limit or len(payload)+len(data)>256*1024):flush()
   records.append({'index':i,'offset':len(payload),'length':len(data)});payload.extend(data)
  flush()
  provenance={'project':key,'renderer':'Three.js r185 WebGL, source geometry and sampled motion','revision':REV,'palette':'studio-photo-materials.js','background':'#181818','sourceManifest':read(root/'assets/studio-motion/index.json')['projects'][key]['manifest'],'camera':report['state']['camera'],'frameCount':len(frames),'width':width,'height':height,'bytes':total}
  write(root/f'{base}/{quality}/{key}/provenance.json',provenance)
  project.update(frames=frames,poster=frames[0],bytes=total,chunks=chunks,chunkBytes=total,chunkVersion=1,provenance=f'{base}/{quality}/{key}/provenance.json')
  if quality=='sd':
   variants=[]
   for size in [480,960,1800]:
    data=(exports/key/f'cover-{size}.webp').read_bytes();path=f'{coverbase}/{key}-wide-{size}.webp';url=asset(path,data)
    with Image.open(root/path) as image:assert image.size==(size,size*2//3)
    variants.append({'src':path,'width':size,'height':size*2//3,'sha256':sha(data),'bytes':len(data),'url':url})
   cover=covers['projects'][key];cover.update(src=variants[-1]['url'],srcset=', '.join(f'{v["url"]} {v["width"]}w' for v in variants),variants=[{k:v for k,v in row.items() if k!='url'} for row in variants],sourceFrame=frames[0],sourceFrameSha256=sha((root/frames[0].split('?')[0]).read_bytes()),provenance=f'{base}/sd/{key}/provenance.json')
 manifest['revision']=REV
 if 'chunkTransport' in manifest:
  t=manifest['chunkTransport'];t.update(bytes=sum(x['bytes'] for x in manifest['projects'].values()),frameCount=sum(len(x['frames']) for x in manifest['projects'].values()),chunkCount=sum(len(x['chunks']) for x in manifest['projects'].values()))
 write(root/'assets/exploded'/name,manifest);reports[quality]={'before':before,'after':sum(p['bytes'] for p in manifest['projects'].values())}
source_index=read(root/'assets/studio-motion/index.json')
solved=read(root/'assets/studio-motion'/source_index['projects']['ansysCfd']['manifest'])['source']['motionReport']
anchors['ansysCfd']['legend']={k:solved[k] for k in ['pressureRangePa','pressureColorNormalization']}
covers['projects']['materialTest']['alt']='Charcoal fabric specimen held between silver grips before stretching.'
covers['revision']=REV;write(root/'assets/editorial/animation-covers.json',covers);write(root/f'{base}/anchors.json',anchors)
p=root/'index.html';html=p.read_text(encoding='utf-8')
for key,old in oldcovers['projects'].items():
 new=covers['projects'][key];html=html.replace(old['srcset'],new['srcset'])
 for ov,nv in zip(old['variants'],new['variants']):html=html.replace(ov['src']+'?v='+ov['sha256'][:12],nv['src']+'?v='+nv['sha256'][:12])
p.write_text(html,encoding='utf-8')
write(folder/'pack-report.json',reports);print(json.dumps(reports))
