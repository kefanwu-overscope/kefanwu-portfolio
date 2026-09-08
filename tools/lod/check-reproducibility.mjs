// One end-to-end replay checks that the baseline generator preserves fingerprint paths/high entries.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {site,toolRoot,backup,sha} from './polish.mjs';
const manifestFile=path.join(site,'models/lod/manifest.json');
const before=fs.readFileSync(manifestFile),manifest=JSON.parse(before);
const referenced=Object.values(manifest.models).flatMap(x=>[x.high,x.low]);
const hashes=Object.fromEntries(referenced.map(p=>[p,sha(fs.readFileSync(path.join(site,p)))]));
const run=spawnSync(process.execPath,[path.join(toolRoot,'generate.mjs')],{cwd:site,encoding:'utf8'});
fs.writeFileSync(path.join(toolRoot,'generator-replay.log'),run.stdout+(run.stderr||''));
assert.equal(run.status,0,run.stderr);
assert.equal(sha(fs.readFileSync(manifestFile)),sha(before),'Generator changed current manifest');
for(const [p,hash]of Object.entries(hashes))assert.equal(sha(fs.readFileSync(path.join(site,p))),hash);
const inventory=JSON.parse(fs.readFileSync(path.join(backup,'backup-inventory.json'),'utf8').replace(/^\uFEFF/,''));
for(const r of inventory)assert.equal(sha(fs.readFileSync(path.join(backup,r.path))),r.sha256.toLowerCase(),'Backup changed');
const baseline=JSON.parse(fs.readFileSync(path.join(backup,'models/lod/manifest.json')));
const originalQA=JSON.parse(fs.readFileSync(path.join(backup,'tools/lod/validation.json')));
for(const [url,e]of Object.entries(baseline.models)) {
  assert.equal(sha(fs.readFileSync(path.join(site,url))),originalQA.models[url].sourceSha256);
  assert.equal(sha(fs.readFileSync(path.join(site,e.low))),sha(fs.readFileSync(path.join(backup,e.low))));
}
const result={passed:true,manifestByteIdenticalAfterGeneratorReplay:true,fingerprintedAssetsUnchanged:referenced.length,
  preservedOriginalHighFiles:Object.keys(baseline.models).length,preservedOriginalLowFiles:Object.keys(baseline.models).length,
  backupFilesVerified:inventory.length,manifestSha256:sha(before)};
fs.writeFileSync(path.join(toolRoot,'reproducibility.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
