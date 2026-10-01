import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { projectSurfaceUV } from '../lib/surface-uv.ts';

void test('curved shading normals cannot stretch a texture across a single rock face', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([2, 1, 0, 3, 1, 0, 2, 2, 0], 3),
  );
  // Smooth normals may cross projection-axis boundaries within one triangle.
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3),
  );
  projectSurfaceUV(geometry, 1);
  assert.deepEqual(
    Array.from(geometry.getAttribute('uv').array),
    [2, 1, 3, 1, 2, 2],
  );
  geometry.dispose();
});

void test('surface projections retain physical texture scale on all three axes', () => {
  const geometry = new THREE.BoxGeometry(4, 4, 4).toNonIndexed();
  projectSurfaceUV(geometry, 2);
  const uv = geometry.getAttribute('uv');
  for (const value of uv.array)
    assert.ok(Number.isFinite(value) && Math.abs(value) === 1);
  geometry.dispose();
});
