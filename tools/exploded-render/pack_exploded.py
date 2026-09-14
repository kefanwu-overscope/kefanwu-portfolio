"""Encode static frame sequences and generate visual proof sheets."""
import argparse
import json
import shutil
import hashlib
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont

TASK_DIR=Path(__file__).resolve().parent
ROOT=TASK_DIR.parents[1] if (TASK_DIR.parents[1]/'project-data.js').exists() else TASK_DIR.parents[1]/'portfolio-site'
DEFAULT_GENERATED=ROOT.parent/'.codex/motion-loading-20260913/generated'
ASSET_REVISION='flight-20260913'
ORDER=['steering','vineRobot','javelin','brakeSim','aura','scanner','carbonSeat','seat','materialTest','ansysCfd','pool','lineFollower','formlabs','telecaster','education','ftc']
parser=argparse.ArgumentParser()
parser.add_argument('--proof-only',action='store_true')
parser.add_argument('--projects',nargs='+')
parser.add_argument('--copy-to-site',action='store_true')
parser.add_argument('--input',type=Path,default=DEFAULT_GENERATED)
args=parser.parse_args()
manifest={'version':1,'projects':{}}
for key in (args.projects or ORDER):
    folder=args.input/key
    if not (folder/'provenance.json').exists():continue
    doc=json.loads((folder/'provenance.json').read_text())
    source_catalog=json.loads((ROOT/'tools/editorial-render/catalog-manifest.json').read_text())
    source_record=next(p['renderProvenance'] for p in source_catalog if p['project']==key)
    doc['baseCoverSource']=source_record
    doc['sourceLayout']=('Numerical pressure surface and pathlines from rebuilt Fluent cruise case' if key=='ansysCfd' else
        'Original separated educational layout' if key=='education' else 'Original approved cover source pose')
    doc.pop('sectionPolicy',None)
    # Old heuristic offsets are not motion data. The controller's own report
    # records the actual transforms, joint phases, paths or deformation.
    if 'parts' in doc:
        doc['sourceComponentNames']=[part['name'] for part in doc['parts']]
    for field in ('geometryComponents','parts','groups'):
        doc.pop(field,None)
    if not args.proof_only:
        source_frames=[folder/f'{index:02d}.png' for index in range(doc['frameCount'])]
        assert all(path.exists() for path in source_frames),(key,'render the complete sequence before packing')
        for path in source_frames:
            Image.open(path).save(path.with_suffix('.webp'),quality=85,method=6)
        frames=[path.with_suffix('.webp') for path in source_frames]
        doc['encodedFrames']=[{'file':f.name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()} for f in frames]
        doc['encoding']={'format':'WebP static images','quality':85,'method':6,'rasterRetouching':False}
        (folder/'provenance.json').write_text(json.dumps(doc,indent=2)+'\n')
        mode=doc['mode']
        label={'heat':'Brake heating','unfold':'Sheet metal unfold','layup':'Carbon layup',
          'steering':'Steering linkage','extension':'Vine extension','propellers':'Propeller rotation',
          'gantry':'Gantry motion','tensile':'Tensile test','flow':'Pressure & flow','assembling':'Guitar assembly',
          'reconstruction':'Assembly view','visualization':'Display layers',
          'retract_release':'Retract & release','drive_sway':'Wheel drive & steering',
          'flight':'Flight & propellers','turntable':'360° rotation'}.get(mode,'Exploded assembly')
        urls=[f'assets/exploded/{ASSET_REVISION}/{key}/{f.name}?v={record["sha256"][:12]}' for f,record in zip(frames,doc['encodedFrames'])]
        manifest['projects'][key]={'mode':mode,'label':label,'width':doc['width'],'height':doc['height'],
          'poster':urls[0],'frames':urls,
          'provenance':f'assets/exploded/{ASSET_REVISION}/{key}/provenance.json',
          'bytes':sum(f.stat().st_size for f in frames)}
        print(key,len(frames),manifest['projects'][key]['bytes'])
        if args.copy_to_site:
            assert len(frames)==doc['frameCount'],(key,len(frames),doc['frameCount'])
            target=ROOT/'assets/exploded'/ASSET_REVISION/key
            target.mkdir(parents=True,exist_ok=True)
            for frame in frames:shutil.copy2(frame,target/frame.name)
            shutil.copy2(folder/'provenance.json',target/'provenance.json')
if not args.proof_only:(args.input/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
if args.copy_to_site:
    destination=ROOT/'assets/exploded/manifest.json'
    if destination.exists():
        previous=json.loads(destination.read_text())
        previous['projects'].update(manifest['projects'])
        manifest=previous
    destination.write_text(json.dumps(manifest,indent=2)+'\n')
for page in range(2):
    keys=ORDER[page*8:page*8+8]
    width=1080;tilew=360;tileh=240;labelh=30
    proof=Image.new('RGB',(width,len(keys)*(tileh+labelh)),(9,12,16))
    draw=ImageDraw.Draw(proof)
    try:font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',17)
    except OSError:font=ImageFont.load_default()
    for row,key in enumerate(keys):
        proof_folder=args.input/key
        if not (proof_folder/'provenance.json').exists():
            proof_folder=ROOT.parent/'.codex/motion-refinement-20260913/generated'/key
        if not (proof_folder/'provenance.json').exists():
            proof_folder=ROOT.parent/'.codex/functional-motion-20260913/generated'/key
        provenance=proof_folder/'provenance.json'
        count=json.loads(provenance.read_text())['frameCount'] if provenance.exists() else 49
        for col,frame in enumerate((0,(count-1)//2,count-1)):
            path=proof_folder/f'{frame:02d}.png'
            if path.exists():
                im=Image.open(path).convert('RGB');im.thumbnail((tilew,tileh))
                proof.paste(im,(col*tilew,row*(tileh+labelh)))
        draw.text((12,row*(tileh+labelh)+tileh+5),key+'   /   start → half → complete',font=font,fill=(228,233,238))
    proof.save(args.input.parent/f'contact-{page+1}.jpg',quality=92)
