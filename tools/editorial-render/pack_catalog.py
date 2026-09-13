"""Encode complete project catalogue stills at three responsive image sizes."""
import hashlib
import json
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEST = ROOT / 'assets/editorial'
ORDER = ['steering','vineRobot','javelin','scanner','brakeSim','aura','carbonSeat',
         'seat','materialTest','ansysCfd','pool','lineFollower','formlabs',
         'telecaster','education','ftc']
DEST.mkdir(parents=True, exist_ok=True)
records=[]
for key in ORDER:
    source=HERE/'renders'/f'{key}-wide.png'
    metadata=json.loads(source.with_suffix('.json').read_text(encoding='utf-8'))
    with Image.open(source) as original:
        assert original.size==(1800,1200), (key,original.size)
        assert original.mode=='RGB', (key,original.mode)
        variants=[]
        for width in (480,960,1800):
            suffix=f'-{width}' if width!=1800 else ''
            target=DEST/f'{key}-wide{suffix}.webp'
            # Reuse already-approved full-size covers without changing their bytes.
            if width==1800 and key in ('steering','vineRobot','scanner') and target.exists():
                pass
            else:
                output=original if width==1800 else original.resize((width,width*2//3),Image.Resampling.LANCZOS)
                output.save(target,'WEBP',quality=91 if width==1800 else 87,method=6,exact=True)
            variants.append({'src':str(target.relative_to(ROOT)).replace('\\','/'),
                'width':width,'height':width*2//3,'bytes':target.stat().st_size,
                'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
    records.append({'project':key,'renderProvenance':metadata,'variants':variants})
(HERE/'catalog-manifest.json').write_text(json.dumps(records,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'covers':len(records),'total960Bytes':sum(r['variants'][1]['bytes'] for r in records),
                  'total480Bytes':sum(r['variants'][0]['bytes'] for r in records),
                  'fullSizeBytes':sum(r['variants'][2]['bytes'] for r in records)},indent=2))
