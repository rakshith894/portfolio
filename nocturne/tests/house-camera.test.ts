import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createHouseCamera } from '../lib/house-camera.ts';

void test('indoor camera keeps its near plane clear even when only a corner meets masonry', () => {
  const geometry = new THREE.BoxGeometry(.2, 5, .3);
  const material = new THREE.MeshStandardMaterial();
  const wall = new THREE.Mesh(geometry, material);
  wall.position.set(.2, 1.5, 1.8);
  wall.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(50, 1.8, .12, 100);
  const target = new THREE.Vector3(0, 1.35, 0);
  camera.position.copy(target).add(new THREE.Vector3(0, 0, 2.65));
  assert.equal(new THREE.Raycaster(target, new THREE.Vector3(0, 0, 1), 0, 3).intersectObject(wall).length, 0);
  const constrain = createHouseCamera([wall]);
  constrain(camera, target, 2.65);
  assert.ok(camera.position.z < 1.5, 'The edge ray prevents the camera entering the wall');
  wall.position.x = 10;
  wall.updateMatrixWorld(true);
  constrain(camera, target, 2.65);
  assert.ok(Math.abs(camera.position.z - 2.65) < 1e-8, 'Clear space restores the requested distance');
  geometry.dispose();
  material.dispose();
});
