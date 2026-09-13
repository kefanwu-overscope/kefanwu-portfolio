"""Audit source triangles, including coincident faces removed by Blender import."""
import json
import struct
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]

def inspect(name):
    b = (ROOT / 'models/real' / (name + '.glb')).read_bytes()
    json_length = struct.unpack_from('<I', b, 12)[0]
    j = json.loads(b[20:20+json_length])
    binary_start = 28 + json_length
    def accessor(index, dimensions, dtype):
        a = j['accessors'][index]
        v = j['bufferViews'][a['bufferView']]
        assert not v.get('byteStride')
        return np.frombuffer(b, dtype=dtype, count=a['count']*dimensions,
            offset=binary_start+v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,dimensions)
    tris, degenerate, repeated, duplicate = 0, 0, 0, 0
    for mesh in j['meshes']:
        for p in mesh['primitives']:
            index_type = j['accessors'][p['indices']]['componentType']
            idx = accessor(p['indices'], 1, {5125:'<u4',5123:'<u2',5121:'u1'}[index_type]).reshape(-1,3)
            pos = accessor(p['attributes']['POSITION'], 3, '<f4').astype(np.float64)
            cross = np.cross(pos[idx[:,1]]-pos[idx[:,0]], pos[idx[:,2]]-pos[idx[:,0]])
            tris += len(idx)
            degenerate += int((np.sum(cross*cross,axis=1)==0).sum())
            repeated += int(((idx[:,0]==idx[:,1])|(idx[:,0]==idx[:,2])|(idx[:,1]==idx[:,2])).sum())
            duplicate += len(idx) - len(np.unique(np.sort(idx, axis=1),axis=0))
    return {'sourceTriangles':tris,'zeroAreaSourceTriangles':degenerate,'repeatedIndexSourceTriangles':repeated,'duplicateSourceTriangles':duplicate}

if __name__ == '__main__':
    results = {name:inspect(name) for name in ['steering','vineRobot','scanner']}
    print(json.dumps(results, indent=2))
    (Path(__file__).resolve().parent / 'source-audit.json').write_text(json.dumps(results, indent=2)+'\n')
