import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';

const root = new URL('../../', import.meta.url);
const util = await fs.readFile(new URL('vendor/three/0.185.0/examples/jsm/utils/BufferGeometryUtils.js', root), 'utf8');
const source = await fs.readFile(new URL('experience-workbench-details.js', root), 'utf8');
const context = vm.createContext({ ...THREE, THREE, console, performance });
vm.runInContext(util.replace(/^import\s*\{[\s\S]*?\}\s*from 'three';/, '').replace(/export\s*\{[\s\S]*?\};\s*$/, ''), context);
vm.runInContext(source.replace(/^import .*?;\r?\n/gm, '').replace(/^export /gm, ''), context);
const { buildDetailedPrinter, buildDetailedPegboardTools, refineWorkbenchInstruments, workbenchDetailStats } = context;
const models = {};
const printer = buildDetailedPrinter({ models });
const tools = buildDetailedPegboardTools();
const instruments = Object.fromEntries(['psu', 'solder', 'drivers', 'meter', 'scope', 'benchLamp'].map(name => [name, new THREE.Group()]));
const liveMap = new THREE.DataTexture(new Uint8Array([32,64,100,255]),1,1);
const screen = new THREE.Mesh(new THREE.PlaneGeometry(.1,.062), new THREE.MeshStandardMaterial({ map:liveMap, emissiveMap:liveMap }));
screen.position.set(-.028,.062,.0435);
instruments.scope.add(screen);
// Verify the refiner keeps the actual parent transforms and animation texture.
for (const [index, group] of Object.values(instruments).entries()) {
  group.position.set(index*.1, .78, -.1); group.rotation.y=index*.07;
}
const transforms = Object.values(instruments).map(group=>[...group.position.toArray(),...group.rotation.toArray()]);
refineWorkbenchInstruments(instruments);
Object.values(instruments).forEach((group,index)=>assert.deepEqual([...group.position.toArray(),...group.rotation.toArray()],transforms[index]));
assert.equal(screen.parent,instruments.scope); assert.equal(screen.material.emissiveMap,liveMap);

const results={printer:workbenchDetailStats(printer),pegboard:workbenchDetailStats(tools),instruments:{}};
const all = [printer,tools,...Object.values(instruments)];
let meshCount=0,triangles=0,geometryBytes=0;
for (const group of all) {
  group.traverse(object=>{
    if (!object.isMesh) return;
    for (const [name, attr] of Object.entries(object.geometry.attributes))
      for (const value of attr.array) assert(Number.isFinite(value),`${group.name}: nonfinite ${name}`);
    const position=object.geometry.attributes.position;
    assert(position?.count>0,`${group.name}: empty mesh`);
    assert(object.geometry.index?.count%3===0 || position.count%3===0,`${group.name}: incomplete triangle`);
    assert(object.matrixWorld.determinant()>0,`${group.name}: reflected or zero-area transform`);
  });
  const stats=workbenchDetailStats(group);meshCount+=stats.meshes;triangles+=stats.triangles;geometryBytes+=stats.geometryBytes;
}
for(const [name,group] of Object.entries(instruments)) {
  results.instruments[name]=workbenchDetailStats(group);
  assert(results.instruments[name].bounds.min[1]>=.78-.00001,`${name}: geometry sinks through tabletop`);
}
assert(results.printer.bounds.min[0]>=-.25 && results.printer.bounds.max[0]<=.25,'Printer exceeded original enclosure width');
assert(results.printer.bounds.min[1]>=-.00001 && results.printer.bounds.max[1]<.825,'Printer support/feeder height');
assert(results.printer.bounds.min[2]>=-.255 && results.printer.bounds.max[2]<.295,'Printer enclosure depth');
assert(results.pegboard.bounds.min[0]>-.95 && results.pegboard.bounds.max[0]<.95,'Tools exceeded pegboard width');
assert(results.pegboard.bounds.min[1]>.95 && results.pegboard.bounds.max[1]<1.75,'Tools exceeded board rows');
assert(results.pegboard.bounds.min[2]>=-.296,'Tools penetrated board rear');
assert(models.printerHead?.isGroup && models.chamberFan?.isGroup && models.activeSpool?.isGroup && models.printerStatusLed?.isMesh,'Missing animation handles');
assert(models.printerStatusLed.material.emissive,'Status light no longer emissive');
for(const x of [-.044,0,.044]) {
  models.printerHead.position.x=x;
  const bounds=new THREE.Box3().setFromObject(models.printerHead);
  assert(bounds.min.x>-.21 && bounds.max.x<.21,'Toolhead leaves chamber during printing');
  assert(bounds.min.y>=.174,'Nozzle intersects build plate');
}
models.printerHead.position.x=0;
assert(meshCount<=115,`Geometry caused draw explosion: ${meshCount}`);
assert(triangles<=95000,`Geometry triangle budget exceeded: ${triangles}`);
assert(geometryBytes<=10_000_000,`Geometry memory budget exceeded: ${geometryBytes}`);
results.total={meshCount,triangles,geometryBytes};
results.checks=['finite positions/normals/UVs','enclosure and board envelopes','no reflected transforms','preserved instrument placement','scope texture identity','four animation handles','toolhead travel envelope','draw/triangle/memory budgets'];
console.log(JSON.stringify(results,null,2));
