import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pickIslandDestination } from '../lib/island-picking.ts';
import { groundHeight } from '../lib/reference-layout.ts';

void test('backyard floor clicks ignore overhead scenery and vertical fixtures', () => {
  const y = groundHeight(10, -40);
  const geometry = new THREE.PlaneGeometry(8, 8);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const floor = new THREE.Mesh(geometry, material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(10, y, -40);
  floor.updateMatrixWorld(true);
  const canopy = floor.clone();
  canopy.position.y += 3;
  canopy.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(
    new THREE.Vector3(10, y + 10, -40),
    new THREE.Vector3(0, -1, 0),
  );
  try {
    const point = pickIslandDestination(ray, [canopy, floor]);
    assert.ok(point);
    assert.equal(point.y, y);
    assert.equal(
      pickIslandDestination(ray, [canopy]),
      null,
      'No floating destinations',
    );
    assert.equal(
      pickIslandDestination(ray, [floor], canopy),
      null,
      'Solid manor geometry still occludes ground',
    );
  } finally {
    geometry.dispose();
    material.dispose();
  }
});
