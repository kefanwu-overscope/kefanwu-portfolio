"""Validate delivered frames and verify the approved cover catalogue is intact."""
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
manifest=json.loads((ROOT/'assets/exploded/manifest.json').read_text())
expected={'steering','vineRobot','javelin','brakeSim','aura','scanner','carbonSeat','seat','materialTest','ansysCfd','pool','lineFollower','formlabs','education','ftc'}
expected_modes={'steering':'steering','vineRobot':'extension','javelin':'propellers','brakeSim':'heat',
    'aura':'assembly','scanner':'gantry','carbonSeat':'layup','seat':'unfold','materialTest':'tensile',
    'ansysCfd':'flow','pool':'assembly','lineFollower':'assembly','formlabs':'gantry','education':'assembling','ftc':'reconstruction'}
assert manifest['version']==1 and set(manifest['projects'])==expected
records=[]
for key,project in manifest['projects'].items():
    frame_count={'vineRobot':145,'materialTest':145}.get(key,121)
    assert len(project['frames'])==frame_count,(key,len(project['frames']))
    assert project['mode']==expected_modes[key],(key,'wrong functional mode')
    assert project['width']*project['height']*4*frame_count<=160*1024*1024,(key,'decoded memory budget')
    asset_root=ROOT/'assets/exploded/functional-20260913'/key
    assert project['provenance']==(asset_root/'provenance.json').relative_to(ROOT).as_posix()
    provenance=json.loads((asset_root/'provenance.json').read_text())
    hashes=set();size=0
    for index,frame in enumerate(project['frames']):
        url=urlsplit(frame)
        path=ROOT/url.path
        assert path.resolve().is_relative_to(asset_root.resolve())
        raw=path.read_bytes();digest=hashlib.sha256(raw).hexdigest();hashes.add(digest);size+=len(raw)
        assert digest==provenance['encodedFrames'][index]['sha256'],(key,index,'hash')
        assert parse_qs(url.query).get('v')==[digest[:12]],(key,index,'cache revision')
        with Image.open(path) as image:
            image.load()
            assert image.size==(project['width'],project['height']),(key,index,image.size)
            assert image.format=='WEBP' and not getattr(image,'is_animated',False)
    assert len(hashes)>=frame_count*.42,(key,'too few distinct states for a reversible cycle')
    if key not in ('steering','scanner','formlabs','ansysCfd'):
        assert provenance['encodedFrames'][0]['sha256']!=provenance['encodedFrames'][-1]['sha256'],key
    assert size==project['bytes'] and size<5*1024*1024,(key,size)
    assert provenance['samples']==48
    assert provenance['motionRevision']=='functional-motion-20260913'
    assert not any(field in provenance for field in ('parts','groups','geometryComponents')),(key,'obsolete heuristic offsets')
    motion=provenance['motion']
    if key in ('brakeSim','carbonSeat','seat'):
        assert project['mode']=={'brakeSim':'heat','carbonSeat':'layup','seat':'unfold'}[key]
        assert not provenance.get('sectionPolicy')
        if key=='carbonSeat':assert motion['layerCount']==10
    elif key in ('aura','ftc'):
        assert motion['version']>=13 and len(motion['stages'])>0,(key,'missing checked motion')
        for stage in motion['stages']:
            checks=stage['verification']
            assert checks['newContinuousTriangleContacts']==0 and checks['floorCrossings']==0,(key,stage['group'])
            assert checks['continuousTriangleTests']>=0
    elif key in ('pool','lineFollower','education'):
        assert motion['passed'] is True
        assert len(motion['stages'])==({'education':23}.get(key,6))
        for stage in motion['stages']:
            checks=stage['verification']
            if 'newContinuousTriangleContacts' in checks:
                assert checks['newContinuousTriangleContacts']==0 and checks['floorCrossings']==0
                assert not checks.get('initialSeamExtensionUsed',False)
            else:assert checks['passed'] is True
    elif key=='javelin':
        assert motion['rotorCount']==4 and motion['sourceMotorBasesFixed']
    elif key=='vineRobot':
        assert motion['sourceHardwareFixed'] and motion['thinWallThickness']>0
    elif key=='materialTest':
        assert motion['fixedLowerFixture'] and 0<motion['fractureProgress']<1
    elif key in ('steering','scanner','formlabs'):
        audit=json.loads((ROOT.parent/'.codex/functional-motion-20260913'/f'mechanism-{key}-validation.json').read_text())
        assert not audit['newContactPairs'] and audit['exactResetMaxMatrixError']==0
        assert audit['preservedTriangles']==motion['preservedTriangles']
    elif key=='ansysCfd':
        cfd=ROOT.parent/'.codex/functional-motion-20260913/cfd'
        solve=json.loads((cfd/'solution-audit.json').read_text())
        fields=json.loads((cfd/'flow-provenance.json').read_text())
        digest=hashlib.sha256((cfd/'flow-data.npz').read_bytes()).hexdigest()
        assert digest==fields['dataSha256']==motion['dataSha256']==solve['flowDataSha256']
        assert solve['iterations']==400 and solve['sourceHashVerified']
        assert motion['pressureRangePa']==solve['pressureRangePa']
        assert motion['surfaceTriangles']==47450 and motion['sourcePaths']==49
        assert motion['displayedPaths']>0 and motion['displayedPolylineSegmentWallCrossings']==0
        assert motion['pressureClipping'] is False and motion['originalMonitorHidden']
        assert motion['pathTimeMethods']==['particle-time']
    else:
        assert motion,(key,'missing functional motion provenance')
    records.append({'project':key,'frames':frame_count,'bytes':size,'mode':project['mode']})
cover_catalog=json.loads((ROOT/'tools/editorial-render/catalog-manifest.json').read_text())
cover_checks=0
for project in cover_catalog:
    for variant in project['variants']:
        path=ROOT/variant['src']
        assert hashlib.sha256(path.read_bytes()).hexdigest()==variant['sha256'],str(path)
        cover_checks+=1
result={'projects':records,'totalFrames':sum(p['frames'] for p in records),'totalFrameBytes':sum(p['bytes'] for p in records),
    'approvedCoverFilesUnchanged':cover_checks,'result':'pass'}
output=ROOT.parent/'.codex/functional-motion-20260913/asset-validation.json'
output.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
