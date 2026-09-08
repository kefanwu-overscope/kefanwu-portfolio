import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import validator from './vendor/gltf-validator/index.cjs';
import {readGLB,bounds,stats} from './glb.mjs';
import {verifyPair} from './verify.mjs';

const dir=path.dirname(fileURLToPath(import.meta.url)),site=path.resolve(dir,'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(site,'models/lod/manifest.json'),'utf8'));
const generation=JSON.parse(fs.readFileSync(path.join(dir,'validation.json'),'utf8'));
const hasPolished=Object.values(manifest.models).some(e=>e.high);
const polished=hasPolished?JSON.parse(fs.readFileSync(path.join(dir,'polish-validation.json'),'utf8')):null;
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
assert.equal(manifest.version,1);
const report={version:1,validator:validator.version(),models:{}};
let errors=0,warnings=0,validatedFiles=0;
for(const [sourcePath,entry] of Object.entries(manifest.models)) {
  const source=readGLB(path.join(site,sourcePath)),low=readGLB(path.join(site,entry.low));
  verifyPair(source,low);
  assert.equal(sha(source.bytes),generation.models[sourcePath].sourceSha256,'High model modified');
  assert.equal(sha(low.bytes),generation.models[sourcePath].lowSha256,'Low differs from generation');
  const before=stats(source),after=stats(low);
  assert.equal(before.triangles,entry.sourceTriangles);assert.equal(after.triangles,entry.lowTriangles);
  assert.equal(before.bytes,entry.sourceBytes);assert.equal(after.bytes,entry.lowBytes);
  assert.deepEqual(bounds(source),entry.sourceBounds);
  const levels=[['source',source],['low',low]];
  if(entry.high) {
    const high=readGLB(path.join(site,entry.high)),record=polished.models[sourcePath];
    if(!high.bytes.equals(source.bytes))verifyPair(source,high);
    const highStats=stats(high);
    assert.equal(highStats.triangles,entry.highTriangles);assert.equal(highStats.bytes,entry.highBytes);
    assert.equal(sha(high.bytes),record.high.sha256);assert.equal(sha(low.bytes),record.low.sha256);
    assert.deepEqual(bounds(high),entry.sourceBounds);
    for(const [key,glb]of [['high',high],['low',low]]) {
      const match=entry[key].match(/\.([a-f0-9]{12})\.glb$/);
      assert(match,'Polished manifest must request content-fingerprinted GLBs');
      assert.equal(match[1],sha(glb.bytes).slice(0,12),'Filename hash disagrees with content');
      assert.equal(entry[key],record[key].file);
    }
    levels.push(['high',high]);
  }
  const results={};
  for(const [key,glb] of levels) {
    const r=await validator.validateBytes(new Uint8Array(glb.bytes),{uri:key==='source'?sourcePath:entry[key],format:'glb',writeTimestamp:false,maxIssues:0});
    const codes={};
    for(const m of r.issues.messages) codes[m.code]=(codes[m.code]||0)+1;
    results[key]={numErrors:r.issues.numErrors,numWarnings:r.issues.numWarnings,numInfos:r.issues.numInfos,numHints:r.issues.numHints,codes,messages:r.issues.messages};
    errors+=r.issues.numErrors;warnings+=r.issues.numWarnings;validatedFiles++;
  }
  report.models[sourcePath]=results;
  console.log(JSON.stringify({sourcePath,sourceErrors:results.source.numErrors,lowErrors:results.low.numErrors,highErrors:results.high?.numErrors,sourceWarnings:results.source.numWarnings,lowWarnings:results.low.numWarnings,highWarnings:results.high?.numWarnings}));
}
report.totals={validatedFiles,errors,warnings};
fs.writeFileSync(path.join(dir,'gltf-validation.json'),JSON.stringify(report,null,2)+'\n');
assert.equal(errors,0,'Assets have glTF validation errors; inspect gltf-validation.json');
assert.equal(warnings,0,'Assets have glTF validation warnings; inspect gltf-validation.json');
console.log('All manifest statistics, content fingerprints, source hashes, preservation checks and independent Khronos validations passed.');
