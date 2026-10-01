import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutAnnotation, maskRegions, leaderPath} from '../../project-annotation-layout.js';

const input={anchor:{x:620,y:310},width:1200,height:640,labelWidth:184,labelHeight:100,
  regions:[{x:600,y:200,width:80,height:250}],reserved:[{x:0,y:0,width:1200,height:62},{x:0,y:560,width:1200,height:80}]};
test('A compact callout uses the free space next to its component, not a page edge',()=>{
  const out=layoutAnnotation(input);
  assert(out.x>250&&out.x<800);assert(out.length<100);assert.equal(out.overlap,0);assert.equal(out.reservedOverlap,0);
  assert.match(out.path,/ Q/);assert(!out.path.includes('NaN'));
});
test('An occupied side and reserved figure key force a non-overlapping alternative',()=>{
  const out=layoutAnnotation({...input,regions:[...input.regions,{x:0,y:120,width:600,height:420}],reserved:[...input.reserved,{x:680,y:200,width:240,height:160}]});
  assert.equal(out.overlap,0);assert.equal(out.reservedOverlap,0);assert(out.x>=680);
});
test('Same-phase part travel updates the leader without sliding or flipping the label',()=>{
  const initial=layoutAnnotation(input);
  for(const x of [625,640,650,630,610]){
    const next=layoutAnnotation({...input,anchor:{x,y:320},previous:initial});
    assert.equal(next.x,initial.x);assert.equal(next.y,initial.y);assert.equal(next.side,initial.side);assert.notEqual(next.path,initial.path);
  }
});
test('A new phase may relocate its label beside the newly selected part',()=>{
  const initial=layoutAnnotation(input);
  const next=layoutAnnotation({...input,anchor:{x:900,y:210},previous:initial,reset:true});
  assert.notEqual(next.x,initial.x);assert(next.length<100);
});
test('Small phone layouts keep long labels clear of the timeline and viewport',()=>{
  for(const width of [320,390,700])for(const height of [470,535,700])for(const anchor of [{x:width*.45,y:170},{x:width*.6,y:height*.62}]){
    const out=layoutAnnotation({width,height,anchor,labelWidth:164,labelHeight:132,regions:[{x:width*.4,y:160,width:width*.2,height:130}],reserved:[{x:0,y:0,width,height:62},{x:0,y:height-80,width,height:80}]});
    assert(out.x>=16&&out.x+out.width<=width-16);assert(out.y>=66&&out.y+out.height<=height-88);assert.equal(out.reservedOverlap,0);assert(Number.isFinite(out.length));
  }
});
test('Sparse unsigned occupancy masks map to fitted image pixels including bit31',()=>{
  const regions=maskRegions([0x80000003,0],{x:100,y:80,width:640,height:480});
  assert.deepEqual(regions,[{x:100,y:80,width:40,height:20},{x:720,y:80,width:20,height:20}]);
});
test('Leader tip remains near the actual part and uses a rounded elbow',()=>{
  const target={x:420,y:260},result=leaderPath({x:200,y:200,width:164,height:94},target);
  assert(Math.abs(Math.hypot(target.x-result.tip.x,target.y-result.tip.y)-4)<1e-8);
  assert.match(result.path,/^M[\d.,-]+ L[\d.,-]+ Q[\d.,-]+ [\d.,-]+ L[\d.,-]+$/);
});
