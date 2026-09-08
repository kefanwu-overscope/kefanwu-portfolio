import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'models/lod/manifest.json'),'utf8'));
const paths=new Set();
for(const entry of Object.values(manifest.models))for(const key of ['low','high']){
  const asset=entry[key];if(!asset)continue;
  const hash=asset.match(/\.([a-f0-9]{12})\.glb$/)?.[1];
  if(!hash)throw new Error(`Refusing immutable cache for an unversioned asset: ${asset}`);
  const resolved=path.resolve(root,asset);
  if(!resolved.startsWith(root+path.sep))throw new Error('Asset escapes site root');
  const actual=createHash('sha256').update(fs.readFileSync(resolved)).digest('hex');
  if(!actual.startsWith(hash))throw new Error(`Content fingerprint mismatch: ${asset}`);
  paths.add('/'+asset);
}
const configPath=path.join(root,'vercel.json');
const config=fs.existsSync(configPath)?JSON.parse(fs.readFileSync(configPath,'utf8')):{$schema:'https://openapi.vercel.sh/vercel.json'};
const otherHeaders=(config.headers||[]).filter(h=>!/^\/models\/(lod|optimized)\/.*\.[a-f0-9]{12}\.glb$/.test(h.source));
config.headers=[...otherHeaders,...[...paths].sort().map(source=>({source,headers:[{key:'Cache-Control',value:'public, max-age=31536000, immutable'}]}))];
fs.writeFileSync(configPath,JSON.stringify(config,null,2)+'\n');
console.log(`Verified content hashes and configured immutable cache for ${paths.size} exact GLB URLs. HTML and manifest cache policies are unchanged.`);
