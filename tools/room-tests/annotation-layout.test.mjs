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


const drawnInput = { mode: 'drawn', anchor: { x: 620, y: 330 }, width: 1440, height: 823, labelWidth: 220, labelHeight: 92,
  reserved: [{ x: 0, y: 0, width: 1440, height: 62 }, { x: 0, y: 743, width: 1440, height: 80 }] };
const hex = rows => rows.map(row => row.match(/.{4}/g).map(bits => parseInt(bits, 2).toString(16)).join(''));
test('Drawn: labels stay on the gutter grid and under the 24% diagonal cap', () => {
  for (const anchor of [{ x: 120, y: 200 }, { x: 1300, y: 600 }, { x: 720, y: 420 }]) {
    const out = layoutAnnotation({ ...drawnInput, anchor });
    assert(out.x >= 56 && out.x + out.width <= 1440 - 56, 'Gutter');
    assert(out.longest <= .24 * Math.hypot(1440, 823), 'Cap');
    assert(out.length >= 30, 'A leader, not a tick');
    assert.match(out.path, / Q/);
  }
});
test('Drawn: a leader prefers open paper to running over hardware', () => {
  // Hardware fills the right of the anchor; the left is open.
  const rows = Array.from({ length: 8 }, () => '00000000' + '11111111');
  const occupancy = { mask: hex(rows), columns: 16, rows: 8, box: { x: 0, y: 0, width: 1440, height: 823 } };
  const out = layoutAnnotation({ ...drawnInput, anchor: { x: 730, y: 400 }, occupancy });
  assert(out.x + out.width <= 730, 'The note sits on the open side');
  assert(out.run < 20, 'Little or no run over hardware');
});
test('Drawn: a note never covers its part anywhere along the phase', () => {
  const trajectory = Array.from({ length: 6 }, (_, i) => ({ x: 500 + i * 60, y: 330 }));
  const out = layoutAnnotation({ ...drawnInput, anchor: trajectory[0], trajectory });
  for (const p of trajectory) assert(!(p.x >= out.x - 14 && p.x <= out.x + out.width + 14 && p.y >= out.y - 14 && p.y <= out.y + out.height + 14));
});
test('Drawn: a held note keeps its place while its part travels', () => {
  const first = layoutAnnotation(drawnInput);
  const next = layoutAnnotation({ ...drawnInput, anchor: { x: 640, y: 340 }, previous: first });
  assert.equal(next.x, first.x); assert.equal(next.y, first.y); assert.notEqual(next.path, first.path);
});
test('Hex occupancy rows map like the 32-bit masks', () => {
  const regions = maskRegions(['8003'], { x: 0, y: 0, width: 160, height: 10 }, 16, 1);
  assert.deepEqual(regions, [{ x: 0, y: 0, width: 10, height: 10 }, { x: 140, y: 0, width: 20, height: 10 }]);
});
