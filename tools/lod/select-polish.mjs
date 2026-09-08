// Rebuild staged assets from QA-passed primitives; no runtime assets are written here.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {readGLB,accessor,stats,Builder} from './glb.mjs';
import {verifyPair} from './verify.mjs';
import {toolRoot,sha,settings} from './polish.mjs';
const candidates=JSON.parse(fs.readFileSync(path.join(toolRoot,'polish-candidates.json')));
const qa=JSON.parse(fs.readFileSync(path.join(toolRoot,'geometry-comparison.json')));
const report={version:1,settings:candidates.settings,limits:qa.limits,models:{},status:'Staged, awaiting silhouette QA and acceptance'};
for(const [url,levels] of Object.entries(candidates.models)) {
  report.models[url]={};
  for(const [level,r] of Object.entries(levels)) {
    const source=readGLB(r.input),candidate=readGLB(r.output),q=qa.models[url][level];
    assert.equal(sha(source.bytes),q.inputSha256);assert.equal(sha(candidate.bytes),q.outputSha256);
    const builder=new Builder(source),decisions=[];
    for(let mi=0;mi<source.json.meshes.length;mi++)for(let pi=0;pi<source.json.meshes[mi].primitives.length;pi++) {
      const checks=q.primitives.filter(x=>x.mesh===mi&&x.primitive===pi);
      assert(checks.length,'Missing instance QA');
      // Fixed-view QA found a 12-pixel normal/shading discrepancy on the bottom view.
      // Keep this model's original connectivity; repacking still saves ~33% bytes.
      const visualRollback=level==='high'&&url==='models/real/lineFollower.glb';
      const passed=checks.every(x=>x.passed)&&!visualRollback,chosen=passed?candidate:source;
      const p=chosen.json.meshes[mi].primitives[pi],out=builder.json.meshes[mi].primitives[pi];
      out.attributes={};
      for(const [semantic,id]of Object.entries(p.attributes)) {
        const a=accessor(chosen,id);out.attributes[semantic]=builder.addAccessor(a.a,a.values,34962);
      }
      const a=accessor(chosen,p.indices);
      // Keep rejected primitives' indices and attributes together; do not decimate them.
      const count=accessor(chosen,p.attributes.POSITION).a.count;
      const Type=count<65536?Uint16Array:Uint32Array;
      out.indices=builder.addAccessor({...a.a,componentType:count<65536?5123:5125},new Type(a.values),34963);
      decisions.push({mesh:mi,primitive:pi,qaPassed:checks.every(x=>x.passed),visualRollback,action:passed?'candidate':'original primitive restored',
        sourceTriangles:r.primitives.find(x=>x.mesh===mi&&x.primitive===pi).beforeTriangles,selectedTriangles:a.values.length/3});
    }
    for(let i=0;i<(source.json.images||[]).length;i++) {
      const v=source.json.bufferViews[source.json.images[i].bufferView];
      builder.json.images[i].bufferView=builder.view(source.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));
    }
    let bytes=builder.binary();
    const sufficient=bytes.length<=source.bytes.length*(1-settings.minimumByteSaving);
    const output=path.join(toolRoot,'selected',level,url.slice(7));
    if(!sufficient)bytes=source.bytes;
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,bytes);
    const final=readGLB(output),after=stats(final);
    const selected={input:r.input,output,inputSha256:sha(source.bytes),outputSha256:sha(final.bytes),
      accepted:sufficient,reason:sufficient?'At least 1% raw-byte saving after per-primitive QA rollback':'Less than 1% raw-byte saving after QA; entire original level retained',
      before:stats(source),after,decisions,checks:sufficient?verifyPair(source,final):{exactByteIdentity:sha(source.bytes)===sha(final.bytes)}};
    report.models[url][level]=selected;
    console.log(JSON.stringify({url,level,accepted:sufficient,triangles:[selected.before.triangles,after.triangles],bytes:[source.bytes.length,bytes.length]}));
  }
}
fs.writeFileSync(path.join(toolRoot,'polish-selection.json'),JSON.stringify(report,null,2)+'\n');
