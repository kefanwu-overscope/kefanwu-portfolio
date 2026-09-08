import assert from 'node:assert/strict';
import {accessor, stats, bounds, instances} from './glb.mjs';

function meshMetadata(mesh) { const out=structuredClone(mesh); delete out.primitives; return out; }
function primitiveMetadata(prim) { const out=structuredClone(prim); delete out.attributes; delete out.indices; return out; }
export function verifyPair(source, low) {
  const s=source.json,l=low.json;
  stats(low);
  // Everything outside rewritten binary geometry must remain structurally identical.
  for (const key of new Set([...Object.keys(s),...Object.keys(l)]))
    if (!['accessors','bufferViews','buffers','meshes','images'].includes(key)) assert.deepEqual(l[key],s[key],key);
  assert.equal(l.meshes.length,s.meshes.length);
  const usedAccessors=new Set(),usedViews=new Set();
  for (let m=0;m<s.meshes.length;m++) {
    assert.deepEqual(meshMetadata(l.meshes[m]),meshMetadata(s.meshes[m]),'Mesh names/metadata');
    assert.equal(l.meshes[m].primitives.length,s.meshes[m].primitives.length);
    for (let p=0;p<s.meshes[m].primitives.length;p++) {
      const a=s.meshes[m].primitives[p],b=l.meshes[m].primitives[p];
      assert.deepEqual(primitiveMetadata(b),primitiveMetadata(a),'Material/mode/primitive metadata');
      assert.deepEqual(Object.keys(b.attributes).sort(),Object.keys(a.attributes).sort(),'Attribute semantics');
      const keys=Object.keys(a.attributes).sort();
      const src=keys.map(k=>accessor(source,a.attributes[k])),dst=keys.map(k=>accessor(low,b.attributes[k]));
      // Compare full vertex tuples so UV/normal values cannot be detached from their original positions.
      const tuples=new Set();
      for (let i=0;i<src[0].a.count;i++) tuples.add(src.map(x=>x.packed.subarray(i*x.size,(i+1)*x.size).toString('hex')).join(':'));
      for (let i=0;i<dst[0].a.count;i++) assert(tuples.has(dst.map(x=>x.packed.subarray(i*x.size,(i+1)*x.size).toString('hex')).join(':')),'Vertex tuple changed');
      const indices=accessor(low,b.indices).values;
      assert.equal(new Set(indices).size,dst[0].a.count,'Unreferenced high-poly vertices');
      for (const id of [...Object.values(b.attributes),b.indices]) usedAccessors.add(id);
    }
  }
  assert.equal(l.images?.length,s.images?.length);
  for (let i=0;i<(s.images||[]).length;i++) {
    const si={...s.images[i]},li={...l.images[i]},sv=s.bufferViews[si.bufferView],lv=l.bufferViews[li.bufferView];
    usedViews.add(li.bufferView); delete si.bufferView; delete li.bufferView;
    assert.deepEqual(li,si,'Image metadata');
    assert(source.bin.subarray(sv.byteOffset||0,(sv.byteOffset||0)+sv.byteLength).equals(low.bin.subarray(lv.byteOffset||0,(lv.byteOffset||0)+lv.byteLength)),'Embedded image bytes');
  }
  assert.equal(usedAccessors.size,l.accessors.length,'Unreferenced accessors');
  for (const id of usedAccessors) usedViews.add(l.accessors[id].bufferView);
  assert.equal(usedViews.size,l.bufferViews.length,'Unreferenced bufferViews');
  let end=0;
  for (const v of l.bufferViews) {
    const start=v.byteOffset||0;
    assert(start>=end && start-end<=3,'Unexplained data in BIN');
    end=start+v.byteLength;
  }
  assert.equal(end,l.buffers[0].byteLength,'Trailing hidden geometry');
  const reachable=new Set(instances(l,true).map(i=>i.mesh));
  assert.equal(reachable.size,l.meshes.length,'Hidden unreferenced meshes');
  const sb=bounds(source),lb=bounds(low);
  const tolerance=Math.max(...sb.max.map((v,i)=>v-sb.min[i]),1)*1e-9;
  let maxDelta=0;
  for (const side of ['min','max']) for (let i=0;i<3;i++) {
    const delta=Math.abs(sb[side][i]-lb[side][i]); maxDelta=Math.max(maxDelta,delta);
    assert(delta<=tolerance,`World bounds changed: ${delta}`);
  }
  return {readable:true,nodesTransformsScenesExact:true,meshNamesExact:true,materialReferencesExact:true,
    originalAttributeTuplesExact:true,uvSemanticsRetained:true,embeddedImageBytesExact:true,
    noUnusedVerticesAccessorsViewsOrMeshes:true,noUnexplainedBinaryPayload:true,worldBoundsMaxDelta:maxDelta};
}
