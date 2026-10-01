import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as THREE from '../../vendor/three/0.185.0/build/three.module.js';
import { ROOM_LIGHT_GRADE } from '../../experience-light-grade.js';

const url = new URL('../../vendor/three/0.185.0/build/three.module.js', import.meta.url).href;
const source = (await readFile(new URL('../../experience-ambient.js', import.meta.url), 'utf8')).replace("from 'three'", `from '${url}'`);
const { AmbientClock, ambientScreenRect } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('Printer and scope continue with a settled camera at their own bounded cadence on 30/60/120 Hz callbacks', () => {
  for (const callbackRate of [30, 60, 120]) for (const fps of [10, 30]) {
    const clock = new AmbientClock(fps);
    for (let i = 0; i < callbackRate * 10; i++) clock.sample(i * 1000 / callbackRate, true);
    assert.equal(clock.frames, fps * 10);
    assert(Math.abs(clock.time - (10000 - 1000 / fps)) < 1e-6);
    assert.equal(clock.snapshot().active, true);
  }
});

test('Offscreen, hidden, project, résumé and reduced-motion pauses preserve phase and resume without catch-up jumps', () => {
  for (const reason of ['offscreen', 'hidden', 'project', 'resume', 'reduced-motion', 'context-lost']) {
    const clock = new AmbientClock(30);
    clock.sample(0, true); clock.sample(1000 / 30, true);
    const before = clock.snapshot(); clock.suspend(reason);
    for (let now = 2000; now < 10000; now += 100) clock.sample(now, false, reason);
    assert.equal(clock.time, before.time); assert.equal(clock.frames, before.frames);
    assert.equal(clock.snapshot().reason, reason); assert.equal(clock.active, false);
    const resumed = clock.sample(10000, true);
    assert.equal(resumed.delta, 0); assert.equal(resumed.time, before.time);
    assert(clock.sample(10000 + 1000 / 30, true).delta > 0);
  }
});

test('A foreground stall cannot jump a mechanism past its travel bounds by accumulating hidden wall time', () => {
  const clock = new AmbientClock(30);
  clock.sample(0, true); assert.equal(clock.sample(30000, true).delta, 100);
  assert.equal(clock.sample(30001, true), null);
});

test('Screen eligibility rejects offscreen, hidden-parent, subpixel and back-facing instrument screens', () => {
  const camera = new THREE.PerspectiveCamera(60, 1, .1, 100);
  const group = new THREE.Group();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(.2, .12), new THREE.MeshBasicMaterial());
  group.add(screen); group.position.z = -3;
  const options = { frontFace: true, width: 1000, height: 1000, minPixels: 2 };
  const rect = ambientScreenRect(screen, camera, options);
  assert(rect && rect[2] > rect[0] && rect[3] > rect[1]);
  group.visible = false; assert.equal(ambientScreenRect(screen, camera, options), null);
  group.visible = true; group.position.x = 30; assert.equal(ambientScreenRect(screen, camera, options), null);
  group.position.x = 0; screen.rotation.y = Math.PI; assert.equal(ambientScreenRect(screen, camera, options), null);
  screen.rotation.y = 0; screen.scale.setScalar(.001); assert.equal(ambientScreenRect(screen, camera, options), null);
  screen.scale.setScalar(1); group.position.z = 3; assert.equal(ambientScreenRect(screen, camera, options), null);
});

test('Daylight reduces additive light energy and desk radiance while night retains the accepted rig', () => {
  assert.deepEqual(ROOM_LIGHT_GRADE.night, { key: .22, hemi: .16, fill: .05, env: .35, bench: .95, resume: 1.5, moon: 11, pendant: .3, cabinet: 1, deskBake: .7 });
  for (const [channel, old] of Object.entries({ key: 1.15, hemi: .75, fill: .25, env: .5, pendant: 2.6, cabinet: 1, deskBake: .7 })) {
    assert(ROOM_LIGHT_GRADE.day[channel] > 0 && ROOM_LIGHT_GRADE.day[channel] < old, channel);
  }
});
