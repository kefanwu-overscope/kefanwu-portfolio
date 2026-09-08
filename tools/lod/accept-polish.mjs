// Local-only installation of independently verified assets with immutable content filenames.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {toolRoot,site,backup,sha} from './polish.mjs';
import {readGLB,stats,bounds} from './glb.mjs';
import {verifyPair} from './verify.mjs';

const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const selection=read(path.join(toolRoot,'polish-selection.json'));
const geometry=read(path.join(toolRoot,'geometry-final.json'));
const visual=read(path.join(toolRoot,'visual-comparison.json'));
const original=read(path.join(backup,'models/lod/manifest.json'));
const originalQA=read(path.join(backup,'tools/lod/validation.json'));
const manifestFile=path.join(site,'models/lod/manifest.json'),manifestBytes=fs.readFileSync(manifestFile),manifest=JSON.parse(manifestBytes);
assert.equal(manifest.version,1);
assert.deepEqual(Object.keys(manifest.models).sort(),Object.keys(original.models).sort());
assert.equal(Object.keys(selection.models).length,17);assert.equal(Object.keys(geometry.models).length,17);
assert.equal(Object.keys(visual.models).length,17,'Every model must have fixed-view QA');
const writes=[],report={version:1,backup,settings:selection.settings,geometryLimits:geometry.limits,visualLimits:visual.limits,
  visualComparison:'17 models x 2 levels x 8 views at 768x768; neutral opaque shading with actual vertex-normal interpolation',
  limitations:visual.limitations+' '+geometry.limitations,models:{}};

function fingerprint(url,level,data) {
  const root=level==='high'?'models/optimized/':'models/lod/';
  const relative=url.slice('models/'.length).replace(/\.glb$/,`.${sha(data).slice(0,12)}.glb`);
  const file=root+relative,dest=path.resolve(site,file),allowed=path.resolve(site,root)+path.sep;
  assert(dest.startsWith(allowed));assert.notEqual(dest,path.resolve(site,url));
  if(fs.existsSync(dest))assert.equal(sha(fs.readFileSync(dest)),sha(data),'Immutable filename collision');
  writes.push({file,dest,data});return file;
}

// Validate the complete selection before writing any runtime artifact.
for(const [url,levels] of Object.entries(selection.models)) {
  const source=readGLB(path.join(site,url)),sourceStats=stats(source),base=original.models[url];
  assert.equal(sha(source.bytes),originalQA.models[url].sourceSha256,'Original high changed');
  assert.equal(sourceStats.triangles,base.sourceTriangles);assert.equal(sourceStats.bytes,base.sourceBytes);
  assert.deepEqual(bounds(source),base.sourceBounds);
  const entry=manifest.models[url];
  for(const key of ['sourceTriangles','sourceBytes','sourceBounds'])assert.deepEqual(entry[key],base[key]);
  const record={source:sourceStats,sourceSha256:sha(source.bytes),sourceBounds:base.sourceBounds};
  for(const [level,r]of Object.entries(levels)) {
    const input=readGLB(r.input),selected=readGLB(r.output),actual=stats(selected),g=geometry.models[url][level],v=visual.models[url][level];
    assert.equal(sha(input.bytes),r.inputSha256);assert.equal(sha(selected.bytes),r.outputSha256);
    assert.deepEqual(actual,r.after);
    assert(g.passed&&v.passed,'Geometry/visual QA rejected this variant');
    assert.equal(Object.keys(v.views).length,8,'Incomplete visual review');
    for(const test of [g,v]){assert.equal(test.inputSha256,r.inputSha256);assert.equal(test.outputSha256,r.outputSha256);}
    for(const view of Object.values(v.views))assert(view.passed&&fs.existsSync(path.join(site,view.image)));
    const byteIdentical=r.inputSha256===r.outputSha256;
    const checks=byteIdentical?{exactByteIdentity:true,worldBoundsMaxDelta:0}:verifyPair(input,selected);
    if(level==='low') {
      assert.equal(sha(input.bytes),sha(fs.readFileSync(path.join(backup,base.low))));
      assert.equal(sha(fs.readFileSync(path.join(site,base.low))),r.inputSha256,'Old low comparison file changed');
    }
    const file=fingerprint(url,level,selected.bytes);
    entry[level]=file;entry[level+'Triangles']=actual.triangles;entry[level+'Bytes']=actual.bytes;
    record[level]={file,sha256:r.outputSha256,before:r.before,after:actual,optimized:r.accepted,byteIdentical,
      reason:r.reason,checks,decisions:r.decisions,geometryMaxRelative:g.maxSampleRelative};
  }
  report.models[url]=record;
}
for(const {dest,data}of writes) {
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  if(!fs.existsSync(dest))fs.writeFileSync(dest,data,{flag:'wx'});
  assert.equal(sha(fs.readFileSync(dest)),sha(data));
}
report.totals={};
for(const level of ['high','low']) {
  const all=Object.values(report.models).map(r=>r[level]);
  report.totals[level]={optimized:all.filter(r=>r.optimized).length,
    beforeTriangles:all.reduce((n,r)=>n+r.before.triangles,0),afterTriangles:all.reduce((n,r)=>n+r.after.triangles,0),
    beforeBytes:all.reduce((n,r)=>n+r.before.bytes,0),afterBytes:all.reduce((n,r)=>n+r.after.bytes,0)};
}
fs.writeFileSync(path.join(toolRoot,'polish-validation.json'),JSON.stringify(report,null,2)+'\n');
assert.equal(sha(fs.readFileSync(manifestFile)),sha(manifestBytes),'Manifest changed concurrently');
// Same-directory atomic replacement: every referenced fingerprint file already exists.
const temporary=manifestFile+'.polish.tmp';fs.writeFileSync(temporary,JSON.stringify(manifest,null,2)+'\n');fs.renameSync(temporary,manifestFile);
console.log(JSON.stringify({fingerprintedAssets:writes.length,manifest:'models/lod/manifest.json',totals:report.totals},null,2));
