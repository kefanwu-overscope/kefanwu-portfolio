import json,hashlib,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
folder=root.parent/'.codex/refined-annotations-20260930'
def read(p):return json.loads(p.read_text(encoding='utf-8'))
def sha(b):return hashlib.sha256(b).hexdigest()
reports={};total=0
for name in ['manifest.json','manifest-detail.json']:
 manifest=read(root/'assets/exploded'/name)
 previous=json.loads(subprocess.check_output(['git','-C',str(root),'show','465eb59e:assets/exploded/'+name]))
 for key,project in manifest['projects'].items():
  frames=[]
  for url in project['frames']:
   path,version=url.split('?v=');data=(root/path).read_bytes();assert sha(data).startswith(version);frames.append(data)
  assert len(frames)==len(previous['projects'][key]['frames']);assert sum(map(len,frames))==project['bytes'];seen=[]
  for chunk in project['chunks']:
   path,version=chunk['url'].split('?v=');data=(root/path).read_bytes();assert sha(data).startswith(version);assert len(data)==chunk['bytes']
   for record in chunk['frames']:
    index=record['index'];assert data[record['offset']:record['offset']+record['length']]==frames[index];seen.append(index)
  assert seen==list(range(len(frames)));total+=len(frames)
 reports[name]={'before':sum(x['bytes'] for x in previous['projects'].values()),'after':sum(x['bytes'] for x in manifest['projects'].values())}
covers=read(root/'assets/editorial/animation-covers.json')['projects'];anchors=read(root/'assets/exploded/refined-20260930/anchors.json');home=(root/'index.html').read_text(encoding='utf-8')
for key,cover in covers.items():
 assert sha((root/cover['sourceFrame'].split('?')[0]).read_bytes())==cover['sourceFrameSha256'];assert cover['coverProgress']==0
 for variant in cover['variants']:
  assert sha((root/variant['src']).read_bytes())==variant['sha256']
  assert variant['src']+'?v='+variant['sha256'][:12] in home
 assert all(p and 0<=p['x']<=1 and 0<=p['y']<=1 for p in anchors[key]['points'])
 assert all(len(mask)==24 and any(mask) and all(0<=row<=4294967295 for row in mask) for mask in anchors[key]['masks'])
reports.update(status='passed',frames=total,coverVariants=48,annotationSamples=sum(len(x['points']) for x in anchors.values()),phaseMasks=sum(len(x['masks']) for x in anchors.values()))
(folder/'asset-verification.json').write_text(json.dumps(reports,indent=2),encoding='utf-8');print(json.dumps(reports))
