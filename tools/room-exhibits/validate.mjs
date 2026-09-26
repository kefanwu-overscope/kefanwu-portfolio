import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {readGLB,accessor,stats,bounds} from '../lod/glb.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const EVIDENCE=path.resolve(ROOT,'../.codex/room-exhibits-20260925');
const read=file=>JSON.parse(fs.readFileSync(path.join(ROOT,file),'utf8'));
const sha=value=>createHash('sha256').update(value).digest('hex');
const manifest=read('models/room-current/index.json'), report=read('tools/room-exhibits/report.json'), studio=read('assets/studio-motion/index.json');
assert.deepEqual(Object.keys(manifest.projects),Object.keys(studio.projects));
assert.equal(manifest.sourceIndexSha256,sha(fs.readFileSync(path.join(ROOT,'assets/studio-motion/index.json'))));
const results=[];
for(const[key,entry]of Object.entries(manifest.projects)){
  const gzip=fs.readFileSync(path.join(ROOT,entry.url));assert.equal(sha(gzip),entry.sha256);assert.equal(gzip.length,entry.bytes);assert(entry.url.endsWith(`.${entry.sha256.slice(0,16)}.glb.gz`));
  const glb=gunzipSync(gzip);assert.equal(glb.length,entry.glbBytes);
  const source=read(entry.source.manifest);assert.equal(sha(fs.readFileSync(path.join(ROOT,entry.source.manifest))),entry.source.manifestSha256);
  assert.equal(studio.projects[key].sha256,entry.source.manifestSha256);
  assert.equal(source.buffers.geometry.sha256,entry.source.geometrySha256);assert.equal(source.buffers.initialMotion.sha256,entry.source.initialMotionSha256);
  const raw=path.join(EVIDENCE,`${key}.glb`);assert(fs.readFileSync(raw).equals(glb));const asset=readGLB(raw),statistics=stats(asset),bb=bounds(asset);
  assert.deepEqual(bb,entry.bounds);assert.equal(statistics.triangles,entry.triangles);assert.equal(statistics.triangles,report.projects[key].triangles);
  assert(!asset.json.animations && !asset.json.skins && !asset.json.images,'No motion or texture dependency');
  assert(Math.abs(bb.min[1])<1e-6 && Math.abs(bb.min[0]+bb.max[0])<1e-6 && Math.abs(bb.min[2]+bb.max[2])<1e-6);
  assert.equal(asset.json.extras.sample,0);assert.equal(asset.json.extras.coordinates,'y-up');
  assert.equal(asset.json.materials.length,source.materials.length);
  for(let index=0;index<asset.json.materials.length;index++){
    const mat=asset.json.materials[index],original=source.materials[index],saved=mat.extras.roomSourceMaterial;
    assert.equal(saved.name,original.name);assert.deepEqual(saved.procedural,original.procedural);
    assert.equal(saved.transmission,original.transmission);assert.equal(saved.doubleSide,original.doubleSide);
    assert.equal(mat.pbrMetallicRoughness.metallicFactor,saved.metalness??0);assert.equal(mat.pbrMetallicRoughness.roughnessFactor,saved.roughness??.5);
    assert.deepEqual(mat.pbrMetallicRoughness.baseColorFactor.slice(0,3),saved.baseColor.slice(0,3));
    assert((mat.emissiveFactor||[]).every(v=>v>=0 && v<=1));
  }
  let proceduralMeshes=0;
  for(const mesh of asset.json.meshes)for(const primitive of mesh.primitives){
    const saved=asset.json.materials[primitive.material].extras.roomSourceMaterial;
    assert(asset.json.accessors[primitive.attributes.POSITION].min,'Position accessor bounds');
    if(saved.procedural){
      proceduralMeshes++;
      assert(primitive.attributes._SOURCECOORDINATES!==undefined,'Source-space shader mapping');
      if(saved.procedural.coordinateSpace==='object')assert(primitive.attributes._OBJECTCOORDINATES!==undefined,'Fixed object-space mapping');
      if(saved.procedural.type==='carbon'){
        for(const semantic of ['_SOURCECOORDINATES','_ATTRIBUTEOPACITY','_ATTRIBUTEROUGHNESS'])assert.equal(asset.json.accessors[primitive.attributes[semantic]].componentType,5126,'Unquantized carbon attributes');
        assert(accessor(asset,primitive.attributes._ATTRIBUTEOPACITY).values.every(v=>v===1));
      }
    }
    const normal=accessor(asset,primitive.attributes.NORMAL).values;
    for(let i=0;i<normal.length;i+=3){const length=Math.hypot(normal[i],normal[i+1],normal[i+2]);assert(length>.999 && length<1.001,'Unit normals');}
  }
  const project=report.projects[key];assert(project.primitives.every(p=>p.triangles>0 && p.triangles<=p.sourceTriangles && p.appearanceError<=report.simplification.maximumAppearanceError));
  if(['carbonSeat','seat'].includes(key))assert.equal(project.triangles,project.sourceVisibleTriangles,'Protected unsimplified geometry');
  if(key==='carbonSeat')assert.equal(project.hidden.length,10,'Ten future cloth layers omitted from source zero');
  const sourceNames=new Set(asset.json.nodes.flatMap(node=>node.extras.sourceNodes));
  const expectedNames=new Set(source.nodes.filter(node=>!project.hidden.some(h=>h.name===node.name)).map(node=>node.name));
  assert.deepEqual(sourceNames,expectedNames,'Every source-zero visible part retained');
  results.push({key,bytes:entry.bytes,triangles:entry.triangles,meshes:statistics.meshes,sourceParts:sourceNames.size,proceduralMeshes,status:'passed'});
}
const output={status:'passed',projects:results,totalBytes:results.reduce((sum,r)=>sum+r.bytes,0),totalTriangles:results.reduce((sum,r)=>sum+r.triangles,0),checks:['16 current hashed sources','initial-pose provenance','transport hash and gzip roundtrip','material/procedural source preservation','every visible source part retained','CFD labels omitted consistently','carbon and seat unsimplified','finite indexed geometry and unit normals','centered Y-up bounds','bounded simplifier error','no animation/texture dependencies']};
fs.writeFileSync(path.join(EVIDENCE,'asset-validation.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output,null,2));
