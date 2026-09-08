// Conservative, staged asset pass. Publish only with accept-polish.mjs after independent QA.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {MeshoptSimplifier as opt} from './vendor/meshopt_simplifier.mjs';
import {readGLB,accessor,stats,bounds,instances,identity,transform,Builder} from './glb.mjs';
import {verifyPair} from './verify.mjs';

export const toolRoot=path.dirname(fileURLToPath(import.meta.url));
export const site=path.resolve(toolRoot,'../..');
export const backup=path.resolve(site,'../.codex/perf-polish-20260907/assets-before');
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const settings={
  high:{error:1e-5,normalDegrees:0.25},
  low:{error:1e-4,normalDegrees:0.5},
  minimumTriangles:64,hardEdgeDegrees:20,normalWeight:1,lowNormalWeight:0.1,uvColorWeight:1,
  flags:['LockBorder'],minimumByteSaving:0.01,
};

// Matches indexed THREE.BufferGeometry.computeVertexNormals (Float32 accumulation).
export function computedNormals(pos,indices) {
  const out=new Float32Array(pos.length);
  for(let t=0;t<indices.length;t+=3) {
    const a=indices[t]*3,b=indices[t+1]*3,c=indices[t+2]*3;
    const ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2];
    const vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2];
    const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];
    for(const i of [a,b,c]) for(let k=0;k<3;k++) out[i+k]+=n[k];
  }
  for(let i=0;i<out.length;i+=3) {
    const len=Math.hypot(out[i],out[i+1],out[i+2])||1;
    for(let k=0;k<3;k++) out[i+k]/=len;
  }
  return out;
}

function vertexLocks(pos,idx,transforms) {
  const locks=new Uint8Array(pos.length/3), used=[...new Set(idx)];
  for(const mat of [identity(),...transforms]) {
    const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity],li=[0,0,0],hiIndex=[0,0,0];
    for(const i of used) {
      const p=transform(mat,pos[i*3],pos[i*3+1],pos[i*3+2]);
      for(let k=0;k<3;k++) {if(p[k]<lo[k]){lo[k]=p[k];li[k]=i;}if(p[k]>hi[k]){hi[k]=p[k];hiIndex[k]=i;}}
    }
    for(const i of [...li,...hiIndex]) locks[i]=1;
  }
  // Position remap is for detecting geometric adjacency only; NEVER weld attribute seams.
  const remap=opt.generatePositionRemap(pos,3), edges=new Map(),bad=new Set();
  const cos=Math.cos(settings.hardEdgeDegrees*Math.PI/180);
  for(let t=0;t<idx.length;t+=3) {
    const vv=[idx[t],idx[t+1],idx[t+2]],a=vv[0]*3,b=vv[1]*3,c=vv[2]*3;
    const u=[pos[b]-pos[a],pos[b+1]-pos[a+1],pos[b+2]-pos[a+2]];
    const v=[pos[c]-pos[a],pos[c+1]-pos[a+1],pos[c+2]-pos[a+2]];
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const len=Math.hypot(...n);
    if(!len) {for(const i of vv) bad.add(remap[i]);continue;}
    for(let k=0;k<3;k++) n[k]/=len;
    for(let k=0;k<3;k++) {
      const x=remap[vv[k]],y=remap[vv[(k+1)%3]],key=x<y?`${x},${y}`:`${y},${x}`;
      const e=edges.get(key);
      if(e) {e.count++;if(e.count>2||n[0]*e.n[0]+n[1]*e.n[1]+n[2]*e.n[2]<cos){bad.add(x);bad.add(y);}}
      else edges.set(key,{x,y,n,count:1});
    }
  }
  for(const e of edges.values()) if(e.count!==2){bad.add(e.x);bad.add(e.y);}
  for(let i=0;i<locks.length;i++) if(bad.has(remap[i])) locks[i]=1;
  return locks;
}

function normalDelta(a,b,used,budget) {
  let max=0;const bad=new Set();
  for(const i of used) {
    const aa=[a[i*3],a[i*3+1],a[i*3+2]],bb=[b[i*3],b[i*3+1],b[i*3+2]];
    const la=Math.hypot(...aa),lb=Math.hypot(...bb);
    if(!la&&!lb) continue;
    if(!la||!lb) {max=180;bad.add(i);continue;}
    const cos=aa.reduce((n,v,k)=>n+v*bb[k],0)/(la*lb);
    const angle=Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI;
    max=Math.max(max,angle);if(angle>budget)bad.add(i);
  }
  return {max,bad};
}

function candidate(source,url,level) {
  const j=source.json,builder=new Builder(source),primitives=[],inst=instances(j,true);
  assert(!j.animations&&!j.skins&&!j.extensions,'Static only');
  assert((j.extensionsUsed||[]).every(x=>x.startsWith('KHR_materials_')));
  assert(!(j.images||[]).some(x=>x.uri));
  for(let mi=0;mi<j.meshes.length;mi++) for(let pi=0;pi<j.meshes[mi].primitives.length;pi++) {
    const p=j.meshes[mi].primitives[pi],out=builder.json.meshes[mi].primitives[pi];
    assert(!p.extensions&&!p.targets&&(p.mode??4)===4);
    const streams=Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,accessor(source,v)]));
    const pos=streams.POSITION.values,original=Uint32Array.from(accessor(source,p.indices).values);
    const locks=vertexLocks(pos,original,inst.filter(x=>x.mesh===mi).map(x=>x.matrix));
    const normals=streams.NORMAL?.values??computedNormals(pos,original);
    const attrs=[['NORMAL',{values:normals,n:3}],...Object.entries(streams).filter(([k])=>k.startsWith('TEXCOORD_')||k.startsWith('COLOR_'))];
    const weights=attrs.flatMap(([k,s])=>Array(s.n).fill(k==='NORMAL'?(level==='low'?settings.lowNormalWeight:settings.normalWeight):settings.uvColorWeight));
    const attr=new Float32Array(pos.length/3*weights.length);
    for(let i=0;i<pos.length/3;i++) {let k=0;for(const [,s] of attrs)for(let c=0;c<s.n;c++)attr[i*weights.length+k++]=s.values[i*s.n+c];}
    let reason=null;
    if(url.endsWith('/seat.glb')) reason='Known non-manifold carbon-seat seam: repack only';
    if(url.includes('tire-hoosier')&&pi===1) reason='Tire detail/lettering primitive: connectivity protected';
    if(j.meshes[mi].name==='mat_glass') reason='Transparent surfaces: connectivity protected';
    if(original.length/3<settings.minimumTriangles) reason='Tiny primitive protected';
    let idx=original,error=0,attemptTriangles=original.length/3,maxNormalDelta=0,normalRetries=0;
    if(!reason) {
      // Zero is only a search target. Error, seam, feature locks and later QA decide the result.
      for(let retry=0;retry<4;retry++) {
        [idx,error]=opt.simplifyWithAttributes(original,pos,3,attr,weights.length,weights,locks,0,settings[level].error,settings.flags);
        attemptTriangles=idx.length/3;
        if(!idx.length){idx=original;reason='Empty candidate rejected';break;}
        if(streams.NORMAL)break;
        const delta=normalDelta(normals,computedNormals(pos,idx),new Set(idx),settings[level].normalDegrees);
        maxNormalDelta=delta.max;
        if(maxNormalDelta<=settings[level].normalDegrees)break;
        if(retry===3){idx=original;reason='Recomputed retained-vertex normals exceed shading budget';break;}
        // Protect the complete incident triangle stars, then rerun from the original.
        const protect=new Set(delta.bad);
        for(let t=0;t<original.length;t+=3) if(delta.bad.has(original[t])||delta.bad.has(original[t+1])||delta.bad.has(original[t+2]))
          for(let k=0;k<3;k++)protect.add(original[t+k]);
        for(const i of protect)locks[i]=1;
        normalRetries++;
      }
    }
    idx=idx.slice();
    const [remap,count]=opt.compactMesh(idx);
    out.attributes={};
    for(const [semantic,s] of Object.entries(streams)) {
      const values=new s.values.constructor(count*s.n);
      for(let i=0;i<remap.length;i++) if(remap[i]!==0xffffffff)values.set(s.values.subarray(i*s.n,(i+1)*s.n),remap[i]*s.n);
      out.attributes[semantic]=builder.addAccessor(s.a,values,34962);
    }
    const Type=count<65536?Uint16Array:Uint32Array;
    out.indices=builder.addAccessor({componentType:count<65536?5123:5125,type:'SCALAR'},new Type(idx),34963);
    primitives.push({mesh:mi,primitive:pi,name:j.meshes[mi].name,beforeTriangles:original.length/3,
      afterTriangles:idx.length/3,attemptTriangles,attemptAppearanceError:error,
      attemptRetainedNormalMaxDegrees:maxNormalDelta,normalRetries,lockedVertices:locks.reduce((a,b)=>a+b,0),reason});
  }
  for(let i=0;i<(j.images||[]).length;i++) {
    const v=j.bufferViews[j.images[i].bufferView];
    builder.json.images[i].bufferView=builder.view(source.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));
  }
  return {bytes:builder.binary(),primitives};
}

async function main() {
  await opt.ready;
  const manifest=JSON.parse(fs.readFileSync(path.join(backup,'models/lod/manifest.json')));
  const filter=process.argv.find(x=>x.startsWith('--only='))?.slice(7);
  const report={version:1,settings,backup,models:{},status:'Candidates only. Independent QA required.'};
  for(const [url,entry] of Object.entries(manifest.models).filter(([url])=>!filter||url.includes(filter))) {
    const record={};
    for(const level of ['high','low']) {
      const input=level==='high'?path.join(site,url):path.join(backup,entry.low);
      const source=readGLB(input),generated=candidate(source,url,level);
      const output=path.join(toolRoot,'candidates',level,url.slice(7));
      fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,generated.bytes);
      const after=readGLB(output),checks=verifyPair(source,after);
      record[level]={input,output,inputSha256:sha(source.bytes),outputSha256:sha(after.bytes),
        before:stats(source),after:stats(after),bounds:bounds(source),checks,primitives:generated.primitives};
      console.log(JSON.stringify({url,level,triangles:[record[level].before.triangles,record[level].after.triangles],bytes:[source.bytes.length,after.bytes.length],rejectedPrimitives:generated.primitives.filter(x=>x.reason).length}));
    }
    report.models[url]=record;
  }
  fs.writeFileSync(path.join(toolRoot,filter?'polish-candidates-partial.json':'polish-candidates.json'),JSON.stringify(report,null,2)+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
