import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createTravelDirection, createFollowOrbit, followBehind } from '../lib/chase-camera.ts';
import { createIslandWalker, walkingHeight } from '../lib/island-walk.ts';

void test('the following camera settles behind travel while preserving zoom and height', () => {
  for (const fps of [30, 60, 120]) {
    const camera = new THREE.PerspectiveCamera();
    const target = new THREE.Vector3(7, 2, -3);
    camera.position.copy(target).add(new THREE.Vector3(0, 3, 8));
    for (let i = 0; i < fps * 3; i++) followBehind(camera, target, Math.PI / 2, 1 / fps);
    assert.ok(Math.abs(camera.position.x - target.x - 8) < 0.001);
    assert.ok(Math.abs(camera.position.z - target.z) < 0.001);
    assert.equal(camera.position.y, 5);
    assert.ok(Math.abs(camera.position.distanceTo(target) - Math.sqrt(73)) < 1e-10);
  }
});

void test('camera ignores rocks removed for the shore stairs and shortens at the landing instead of jumping upward', () => {
  const walker = createIslandWalker(false);
  const target = new THREE.Vector3(-22.5, walkingHeight(-22.5, -34) + 1.7, -34);
  const camera = target.clone().add(new THREE.Vector3(9, 4, 0));
  const desired = camera.clone();
  walker.constrainCamera(camera, target);
  assert.ok(camera.distanceTo(desired) < 1e-8, 'The carved stair corridor remains clear');
  target.set(-16, walkingHeight(-16, -39.1) + 1.7, -39.1);
  camera.copy(target).add(new THREE.Vector3(9, 4, 0));
  const line = camera.clone().sub(target).normalize();
  walker.constrainCamera(camera, target);
  assert.ok(camera.clone().sub(target).normalize().distanceTo(line) < 1e-8);
  assert.ok(camera.y <= target.y + 4, 'Do not lift onto the cliff above the stairs');
});

void test('the camera recovers its chosen zoom after leaving a wall at both 30 and 60 fps', () => {
  for (const fps of [30, 60]) {
    const orbit = createFollowOrbit(10), target = new THREE.Vector3(0, 3, 0);
    const camera = target.clone().add(new THREE.Vector3(0, 0, 2));
    for (let i = 0; i < fps; i++) {
      orbit.prepare(camera, target, 1 / fps, false);
      camera.copy(target).add(new THREE.Vector3(0, 0, 2));
      orbit.commit(camera, target);
    }
    for (let i = 0; i < fps * 3; i++) {
      orbit.prepare(camera, target, 1 / fps, false);
      orbit.commit(camera, target);
    }
    assert.ok(Math.abs(camera.distanceTo(target) - 10) < .001);
  }
});

void test('holding a direction does not spiral as the camera turns; new input and dragging reorient travel', () => {
  const direction = createTravelDirection();
  const player = new THREE.Vector3();
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 3, 8);
  const start = direction(0, 1, camera.position, player);
  assert.ok(start.distanceTo(new THREE.Vector3(1, 0, 0)) < 1e-10);
  for (let i = 0; i < 180; i++) {
    followBehind(camera, player, -Math.PI / 2, 1 / 60);
    assert.ok(direction(0, 1, camera.position, player).distanceTo(start) < 1e-10);
  }
  direction(0, 0, camera.position, player);
  assert.ok(direction(1, 0, camera.position, player).x > 0.99);
  camera.position.set(0, 3, 8);
  assert.ok(direction(1, 0, camera.position, player, true).z < -0.99);
});
