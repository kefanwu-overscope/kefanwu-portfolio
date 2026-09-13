"""Publish selected responsive covers from their exact motion-controller scenes."""
import hashlib,json,re
from html import escape
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
EVIDENCE=ROOT.parent/'.codex/motion-refinement-20260913'
CATALOG=ROOT/'tools/editorial-render/catalog-manifest.json'
DESCRIPTIONS={
 'vineRobot':'Vine robot pressure vessel with the translucent everting tube extended from its outlet.',
 'ansysCfd':'Rebuilt Fluent pressure field and numerical flow paths, with blue low-pressure and orange-red high-pressure regions.',
 'education':'Assembled blue guitar education kit, with upright neck, pickguard, bridge and controls in the animation layout.',
 'materialTest':'Tensile tester with silver grips holding a clearly visible orange fabric specimen.'}
PROGRESS={'vineRobot':.75,'ansysCfd':.5,'education':1.,'materialTest':0.}
catalog=json.loads(CATALOG.read_text())
baseline={r['project']:r for r in json.loads((EVIDENCE/'baseline-catalog.json').read_text(encoding='utf-8-sig'))}
html=(ROOT/'index.html').read_text()
destination=ROOT/'assets/editorial/motion-20260913';destination.mkdir(parents=True,exist_ok=True)
checks=[]
for key,description in DESCRIPTIONS.items():
    folder=EVIDENCE/'covers'/key;source=folder/'cover.png'
    provenance=json.loads((folder/'cover-provenance.json').read_text())
    assert provenance['coverProgress']==PROGRESS[key] and provenance['samples']==192
    assert [provenance['width'],provenance['height']]==[1800,1200]
    record=next(r for r in catalog if r['project']==key)
    with Image.open(source) as image:
        assert image.size==(1800,1200) and image.mode=='RGB'
        variants=[]
        for width in (480,960,1800):
            output=image if width==1800 else image.resize((width,width*2//3),Image.Resampling.LANCZOS)
            path=destination/f'{key}-wide-{width}.webp'
            output.save(path,'WEBP',quality=91 if width==1800 else 87,method=6,exact=True)
            variants.append({'src':path.relative_to(ROOT).as_posix(),'width':width,'height':width*2//3,
                'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    record['variants']=variants
    record['renderProvenance']={'coverFromAnimation':True,'renderer':'tools/exploded-render/render_exploded.py',
        'rendererSha256':provenance['rendererSha256'],'samples':192,'dimensions':[1800,1200],
        'sourceAnimationKey':key,'coverProgress':PROGRESS[key],'motion':provenance['motion'],
        'motionRevision':provenance['motionRevision'],'cameraLocation':provenance['cameraLocation'],
        'cameraRotation':provenance['cameraRotation'],'cameraOrthoScale':provenance['cameraOrthoScale'],
        'originalCoverProvenance':baseline[key]['renderProvenance'],
        'masterSha256':hashlib.sha256(source.read_bytes()).hexdigest()}
    def replace(match):
        card=match.group()
        if f'data-project="{key}"' not in card:return card
        def update_image(m):
            tag=m.group();primary=variants[1]
            tag=re.sub(r'\bsrc="[^"]*"',f'src="{primary["src"]}?v={primary["sha256"][:12]}"',tag,count=1)
            srcset=', '.join(f'{v["src"]}?v={v["sha256"][:12]} {v["width"]}w' for v in variants)
            tag=re.sub(r'\bsrcset="[^"]*"',f'srcset="{srcset}"',tag,count=1)
            tag=re.sub(r'\balt="[^"]*"',f'alt="{escape(description,quote=True)}"',tag,count=1)
            return tag
        return re.sub(r'<img\b[^>]*>',update_image,card,count=1)
    html=re.sub(r'<article class="project-card".*?</article>',replace,html,flags=re.S)
    checks.append({'project':key,'progress':PROGRESS[key],'variants':variants})
CATALOG.write_text(json.dumps(catalog,indent=2)+'\n')
(ROOT/'index.html').write_text(html,encoding='utf-8',newline='\n')
(EVIDENCE/'cover-pack.json').write_text(json.dumps({'projects':checks,'updatedCovers':4,'responsiveAssets':12},indent=2)+'\n')
print(json.dumps({'updatedCovers':4,'responsiveAssets':12,'coverBytes':sum(v['bytes'] for c in checks for v in c['variants'])}))
