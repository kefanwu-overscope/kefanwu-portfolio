import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {MeshoptSimplifier as simplifier} from './vendor/meshopt_simplifier.mjs';
import {readGLB, accessor, stats, bounds, instances, identity, transform, Builder} from './glb.mjs';
import {verifyPair} from './verify.mjs';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(toolRoot, '../..');
const lodRoot = path.join(site, 'models/lod');
const sha = data => createHash('sha256').update(data).digest('hex');
const models = [
  'models/ergonomic_mesh_office_chair/ergonomic_mesh_office_chair.glb',
  'models/tire-hoosier-step.glb',
  ...['steering','scanner','telecaster','javelin','smelly','vineRobot','lineFollower','pool','aura','brakeSim','materialTest','seat','driverseat'].map(n => `models/real/${n}.glb`),
  'models/helmet-gt3.glb', 'models/helmet-weld.glb',
];
const flags = ['LockBorder'];
const targetRatio = 0.35;
// The tire's detail primitive is seam-limited. A 32% body target keeps the whole tire below 40%.
const ratioOverrides = {'models/tire-hoosier-step.glb': 0.32};
const maximumError = 0.01;
const risks = {
  'ergonomic_mesh_office_chair': 'Thin chair mesh, cushion outlines and small hardware require distant-view comparison.',
  'tire-hoosier-step': 'Molded sidewall lettering, bead detail and circular silhouette need visual comparison; original PNG bytes and UV samples are retained.',
  'steering': 'Fine steering hardware and curved grips may lose detail.',
  'scanner': 'Thin trusses, brackets and small hardware may lose detail.',
  'telecaster': 'Strings, bridge/tuners and narrow guitar details may lose detail.',
  'javelin': 'Thin airframe surfaces and small hardware may lose detail.',
  'smelly': 'Fine gantry/rod/lead-screw details may lose detail.',
  'vineRobot': 'Transparent shell, ribs and folded-vine details need visual comparison.',
  'lineFollower': 'Small electronics and wheel profiles may lose detail.',
  'pool': 'Rack/pinion teeth, cue and small launcher hardware may lose detail.',
  'aura': 'Gear/roller/drive detail may lose detail; source is the existing hand-trimmed single module.',
  'brakeSim': 'Rotor holes, thin sections and circular rim need close visual comparison.',
  'materialTest': 'Lead screws and small grips may lose detail.',
  'seat': 'Source has a documented non-manifold center seam. No position smoothing or remeshing is used; runtime carbon UV generation remains necessary.',
  'driverseat': 'Thin folded-sheet edges and mounting holes may lose detail.',
  'helmet-gt3': 'Visor trim, vents and curved highlights may lose detail.',
  'helmet-weld': 'Thin shell/visor trim and curved highlights may lose detail.',
};

// Lock local extrema and transformed extrema for every instance, without changing any position.
function locksFor(pos, indices, transforms) {
  const locks = new Uint8Array(pos.length / 3);
  const used = [...new Set(indices)];
  for (const mat of [identity(), ...transforms]) {
    const min = [Infinity,Infinity,Infinity], max = [-Infinity,-Infinity,-Infinity];
    const minIndex = [0,0,0], maxIndex = [0,0,0];
    for (const i of used) {
      const point = transform(mat, pos[i*3], pos[i*3+1], pos[i*3+2]);
      for (let a = 0; a < 3; a++) {
        if (point[a] < min[a]) { min[a] = point[a]; minIndex[a] = i; }
        if (point[a] > max[a]) { max[a] = point[a]; maxIndex[a] = i; }
      }
    }
    for (const i of [...minIndex, ...maxIndex]) locks[i] = 1;
  }
  return locks;
}

function simplifyModel(source, ratio) {
  const j = source.json;
  assert(!j.animations && !j.skins && !j.extensions, 'Static meshes only');
  assert((j.extensionsUsed || []).every(e => e.startsWith('KHR_materials_')), 'Unsupported extension');
  assert(!(j.images || []).some(i => i.uri), 'External images need explicit relocation');
  const builder = new Builder(source), report = [];
  const allInstances = instances(j, true);
  for (let mi = 0; mi < j.meshes.length; mi++) {
    const mesh = j.meshes[mi];
    assert(!mesh.weights && !mesh.extensions, 'Unsupported mesh metadata');
    for (let pi = 0; pi < mesh.primitives.length; pi++) {
      const prim = mesh.primitives[pi], output = builder.json.meshes[mi].primitives[pi];
      assert(!prim.targets && !prim.extensions && (prim.mode ?? 4) === 4);
      const streams = Object.fromEntries(Object.entries(prim.attributes).map(([k,id]) => [k, accessor(source,id)]));
      const pos = streams.POSITION.values;
      assert(pos instanceof Float32Array && streams.POSITION.n === 3);
      const original = Uint32Array.from(accessor(source,prim.indices).values);
      const lock = locksFor(pos, original, allInstances.filter(i=>i.mesh===mi).map(i=>i.matrix));
      const attrs = Object.entries(streams).filter(([k]) => k === 'NORMAL' || k.startsWith('TEXCOORD_') || k.startsWith('COLOR_'));
      const weights = attrs.flatMap(([k,s]) => Array(s.n).fill(k === 'NORMAL' ? 0.1 : 0.25));
      const attr = new Float32Array((pos.length/3) * weights.length);
      for (let i = 0; i < pos.length/3; i++) {
        let c = 0;
        for (const [,s] of attrs) {
          assert.equal(s.a.componentType, 5126, 'Attribute weighting expects Float32');
          for (let k=0;k<s.n;k++) attr[i*weights.length+c++] = s.values[i*s.n+k];
        }
      }
      // Keep tiny individual primitives intact, preserving small material regions.
      const target = original.length < 192 ? original.length : Math.max(12,Math.floor(original.length/3*ratio)*3);
      let reduced = original, error = 0;
      if (target < original.length) [reduced,error] = simplifier.simplifyWithAttributes(
        original, pos, 3, attr, weights.length, weights, lock, target, maximumError, flags);
      assert(reduced.length > 0 && reduced.length % 3 === 0);
      // compactMesh rewrites indices; every retained vertex stream follows exactly the same remap.
      const [remap, count] = simplifier.compactMesh(reduced);
      output.attributes = {};
      for (const [semantic,s] of Object.entries(streams)) {
        const values = new s.values.constructor(count * s.n);
        for (let i=0;i<remap.length;i++) if (remap[i] !== 0xffffffff)
          values.set(s.values.subarray(i*s.n, (i+1)*s.n), remap[i]*s.n);
        output.attributes[semantic] = builder.addAccessor(s.a, values, 34962);
      }
      const IndexType = count < 65536 ? Uint16Array : Uint32Array;
      const indices = new IndexType(reduced);
      output.indices = builder.addAccessor({componentType:count<65536?5123:5125,type:'SCALAR'},indices,34963);
      report.push({mesh:mi,primitive:pi,name:mesh.name ?? null,sourceTriangles:original.length/3,
        lowTriangles:reduced.length/3,sourceVertices:pos.length/3,lowVertices:count,
        ratio:reduced.length/original.length,appearanceError:error,lockedVertices:lock.reduce((a,b)=>a+b,0)});
    }
  }
  for (let i=0;i<(j.images||[]).length;i++) {
    const view = j.bufferViews[j.images[i].bufferView];
    assert(view && view.buffer===0);
    builder.json.images[i].bufferView = builder.view(source.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));
  }
  return {binary:builder.binary(),primitives:report};
}

await simplifier.ready;
fs.mkdirSync(lodRoot,{recursive:true});
const manifest = {version:1,models:{}};
const priorManifestPath=path.join(lodRoot,'manifest.json');
const priorManifest=fs.existsSync(priorManifestPath)?JSON.parse(fs.readFileSync(priorManifestPath,'utf8')):null;
const validation = {version:1,generator:'meshoptimizer 1.2.0 / simplifyWithAttributes',
  settings:{targetRatio,ratioOverrides,maximumError,flags,normalWeight:0.1,uvColorWeight:0.25,minimumPrimitiveTriangles:64},
  sourceSelection:'17 currently used prop/engineering GLBs, confirmed against 2026-09-07 asset audit and experience.js. Baked room and unused education excluded.',
  visualReview:'Not performed. Offline checks do not establish visual equivalence or a safe runtime LOD switching distance.',models:{}};
const filter = process.argv.find(a=>a.startsWith('--only='))?.slice(7);
for (const model of models.filter(p=>!filter||p.includes(filter))) {
  const start=performance.now(), sourceFile=path.join(site,model), source=readGLB(sourceFile), before=stats(source);
  const generated=simplifyModel(source,ratioOverrides[model]??targetRatio);
  const low='models/lod/'+model.slice('models/'.length).replace(/\.glb$/,`.${sha(generated.binary).slice(0,12)}.glb`), dest=path.join(site,low);
  assert(dest.startsWith(lodRoot+path.sep) && dest!==sourceFile);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(fs.existsSync(dest))assert.equal(sha(fs.readFileSync(dest)),sha(generated.binary),'Immutable filename collision');
  else fs.writeFileSync(dest,generated.binary,{flag:'wx'});
  const output=readGLB(dest), after=stats(output), verified=verifyPair(source,output);
  assert.equal(sha(fs.readFileSync(sourceFile)),sha(source.bytes),'Source changed during generation');
  assert(after.bytes < before.bytes*0.9,'No material byte reduction');
  const warnings = [risks[path.basename(model,'.glb')]];
  if (after.triangles/before.triangles>0.4) warnings.push('Above 40% target: topology/seam/border/error constraints were preserved rather than forcing extra loss.');
  if (model.startsWith('models/real/')) warnings.push('Source has POSITION only; existing runtime normal/material/UV setup must also run on the low model.');
  manifest.models[model]={low,sourceTriangles:before.triangles,lowTriangles:after.triangles,
    sourceBytes:before.bytes,lowBytes:after.bytes,sourceBounds:bounds(source)};
  const prior=priorManifest?.models[model];
  if(prior?.high) {
    const high=readGLB(path.join(site,prior.high));
    if(!high.bytes.equals(source.bytes))verifyPair(source,high);
    const hs=stats(high);
    assert.equal(hs.triangles,prior.highTriangles);assert.equal(hs.bytes,prior.highBytes);
    assert(prior.high.endsWith(`.${sha(high.bytes).slice(0,12)}.glb`));
    Object.assign(manifest.models[model],{high:prior.high,highTriangles:hs.triangles,highBytes:hs.bytes});
  }
  validation.models[model]={low,sourceSha256:sha(source.bytes),lowSha256:sha(output.bytes),source:before,lowStats:after,
    sourceBounds:bounds(source),lowBounds:bounds(output),checks:verified,warnings,primitives:generated.primitives};
  console.log(JSON.stringify({model,triangles:`${before.triangles} -> ${after.triangles}`,ratio:(after.triangles/before.triangles).toFixed(3),bytes:`${before.bytes} -> ${after.bytes}`,seconds:((performance.now()-start)/1000).toFixed(1)}));
}
// Partial experiments never replace the full runtime manifest.
if (!filter) {
  fs.writeFileSync(path.join(toolRoot,'validation.json'),JSON.stringify(validation,null,2)+'\n');
  fs.writeFileSync(path.join(lodRoot,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Wrote models/lod/manifest.json and tools/lod/validation.json');
}
