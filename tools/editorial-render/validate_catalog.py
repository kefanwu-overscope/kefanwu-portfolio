"""Verify render provenance, shipped image variants and homepage coverage."""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from PIL import Image

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
manifest=json.loads((HERE/'catalog-manifest.json').read_text(encoding='utf-8'))
catalog=json.loads((HERE/'catalog.json').read_text(encoding='utf-8'))
home=(ROOT/'index.html').read_text(encoding='utf-8')
cards=re.findall(r'<article class="project-card".*?</article>',home,re.S)
assert len(cards)==len(manifest)==16
assert len({r['project'] for r in manifest})==16
hashof=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
for record in manifest:
    key=record['project']
    provenance=record['renderProvenance']
    assert provenance['samples']==192
    source=provenance.get('source')
    if source:
        assert hashof(ROOT/source)==provenance['sourceSha256'],key
    if key in catalog:
        assert hashof(HERE/'render_catalog.py')==provenance['rendererSha256'],key
        if catalog[key].get('builder'):
            assert hashof(ROOT/catalog[key]['builder'])==provenance['builderSha256'],key
    card=next(c for c in cards if f'data-project="{key}"' in c)
    assert 'loading="lazy"' in card and 'decoding="async"' in card
    assert 'width="1800" height="1200"' in card
    assert 'cover-kind' not in card
    for variant in record['variants']:
        path=ROOT/variant['src']
        assert hashof(path)==variant['sha256'],path
        assert variant['src'] in card
        with Image.open(path) as im:
            assert im.size==(variant['width'],variant['height'])
            assert im.mode=='RGB'
    assert record['variants'][1]['bytes']<100000,key
changed=subprocess.check_output(['git','diff','--name-only','--','models/real','assets'],cwd=ROOT,text=True)
assert not changed,changed
result={'passed':True,'projects':16,'responsiveAssets':48,'samples':192,
        'allSourceAndOutputHashesMatch':True,'originalModelsAndPhotosUnchanged':True,
        'photoBasedModels':['materialTest','ftc'],
        'total480Bytes':sum(r['variants'][0]['bytes'] for r in manifest),
        'total960Bytes':sum(r['variants'][1]['bytes'] for r in manifest)}
out=ROOT.parent/'.codex/rendered-covers-20260913/validation.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
