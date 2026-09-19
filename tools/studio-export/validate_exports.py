"""Independent on-disk validation of all 16 studio motion packages."""
import gzip
import hashlib
import json
from pathlib import Path
import numpy as np

ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'assets/studio-motion'
EVIDENCE=ROOT.parent/'.codex/studio-v2-20260919/exports'


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    index=read(ASSETS/'index.json')
    assert len(index['projects'])==16
    rows=[]
    for key,item in index['projects'].items():
        path=ASSETS/item['manifest'];manifest=read(path)
        audit=read(EVIDENCE/(key+'-audit.json'))
        assert manifest['schema']=='studio-motion-v1'
        assert audit['status']=='passed' and not audit['randomSeekErrors']
        assert audit['manifestSha256']==sha(path)
        assert audit['packedFloat32TrackMaximumError']==0
        for relative,digest in audit['sourceFiles'].items():assert sha(ROOT/relative)==digest
        for relative,digest in audit['sourceInputs'].items():assert sha(ROOT/relative)==digest
        buffers={}
        for name,info in manifest['buffers'].items():
            resource=path.parent/info['url']
            assert sha(resource)==info['sha256']
            buffers[name]=gzip.decompress(resource.read_bytes())
            assert len(buffers[name])==info['byteLength']

        def array(desc,buffer):
            assert desc['byteOffset']%4==0
            count=desc['count']*desc['itemSize']
            assert desc['byteOffset']+count*4<=len(buffers[buffer])
            data=np.frombuffer(buffers[buffer],dtype='<f4' if desc['componentType']=='float32' else '<u4',count=count,offset=desc['byteOffset'])
            assert np.isfinite(data).all()
            return data

        def sample(track,index,vertex_count=None):
            values=array(track,'motion').reshape(-1,track['valuesPerFrame'])
            frame_map=array(track['frameMap'],'motion')
            assert len(frame_map)==manifest['sampleCount'] and frame_map.max()<len(values)
            row=values[frame_map[index]]
            if 'elementMap' in track:
                mapping=array(track['elementMap'],'motion')
                assert len(mapping)==vertex_count
                assert mapping.max()<len(row)//track['itemSize']
                row=row.reshape(-1,track['itemSize'])[mapping].ravel()
            return row

        triangles=0;tracks=0
        for node in manifest['nodes']:
            geo=node['geometry'];vertex_count=geo['position']['count']
            assert geo['normal']['count']==vertex_count
            for name,desc in geo.items():
                if name!='groups':array(desc,'geometry')
            indices=array(geo['index'],'geometry')
            assert indices.max()<vertex_count and len(indices)%3==0
            triangles+=len(indices)//3
            for group in geo['groups']:
                assert group['start']+group['count']<=len(indices)
                assert group['materialIndex']<len(node['materialIndices'])
            for name,track in node['tracks'].items():
                for frame in [0,manifest['sampleCount']//2,manifest['sampleCount']-1]:
                    values=sample(track,frame,vertex_count)
                    if name.startswith(('deformation','attribute')):
                        assert len(values)==vertex_count*track['itemSize']
                if name.startswith('deformation'):
                    initial=array(geo['position' if name=='deformationPosition' else 'normal'],'geometry')
                    assert np.array_equal(sample(track,0,vertex_count),initial)
                tracks+=1
        for material in manifest['materials']:
            for track in material.get('tracks',{}).values():
                if track:sample(track,0)
        assert triangles==audit['triangleCount']
        rows.append({'project':key,'nodes':len(manifest['nodes']),'triangles':triangles,
                     'samples':manifest['sampleCount'],'tracks':tracks,
                     'compressedBytes':sum(v['compressedBytes'] for v in manifest['buffers'].values()),
                     'decodedBytes':sum(v['byteLength'] for v in manifest['buffers'].values()),
                     'packedSourceSampleChecks':audit['packedFloat32TrackChecks'],
                     'interpolationAudit':audit.get('interpolationAudit')})
    result={'status':'passed','projects':rows,'projectCount':len(rows),
            'compressedBytes':sum(row['compressedBytes'] for row in rows),
            'packedSourceSampleChecks':sum(row['packedSourceSampleChecks'] for row in rows)}
    (EVIDENCE/'validation-summary.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,indent=2))


if __name__=='__main__':main()
