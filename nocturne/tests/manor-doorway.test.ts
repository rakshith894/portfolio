import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createReferenceManor,
  type ManorMaterials,
} from '../lib/reference-manor.ts';
import { MANOR_DOOR } from '../lib/manor-layout.ts';

function fixture() {
  const material = new THREE.MeshStandardMaterial();
  const resources = new Set<{ dispose: () => void }>([material]);
  const materials = Object.fromEntries(
    [
      'stone',
      'darkStone',
      'edge',
      'wood',
      'iron',
      'amber',
      'roof',
      'voidMat',
    ].map((key) => [key, material]),
  ) as ManorMaterials;
  const manor = createReferenceManor(materials, resources, false);
  const door = manor.userData.door as THREE.Group;
  const surround = manor.getObjectByName('Sealed stone entrance surround')!;
  manor.updateMatrixWorld(true);
  const point = (x: number, y: number, z: number) =>
    new THREE.Vector3(x, y + MANOR_DOOR.y, z + MANOR_DOOR.z);
  return {
    manor,
    door,
    surround,
    point,
    dispose: () => resources.forEach((r) => r.dispose()),
  };
}

void test('the closed entrance has no sky gaps around its sides or above the pointed leaf', () => {
  const f = fixture();
  try {
    for (const side of [-1, 1]) {
      for (let x = -1.02; x <= 1.02; x += 0.04) {
        for (let y = 0.025; y <= 4.78; y += 0.04) {
          const ray = new THREE.Raycaster(
            f.point(x, y, side),
            new THREE.Vector3(0, 0, -side),
            0,
            2,
          );
          assert.ok(
            ray.intersectObjects([f.door, f.surround], true).length,
            `Unsealed entrance at x=${x}, y=${y}, side=${side}`,
          );
        }
      }
    }
  } finally {
    f.dispose();
  }
});

void test('entrance side returns and ceiling close the seam to the indoor lining', () => {
  const f = fixture();
  try {
    for (let z = -0.02; z <= 0.4; z += 0.02) {
      for (const side of [-1, 1]) {
        const ray = new THREE.Raycaster(
          f.point(0, 2, z),
          new THREE.Vector3(side, 0, 0),
          0,
          1.3,
        );
        assert.ok(
          ray.intersectObject(f.surround, true).length,
          `Open side seam at z=${z}`,
        );
      }
      const upward = new THREE.Raycaster(
        f.point(0, 4, z),
        new THREE.Vector3(0, 1, 0),
        0,
        1.1,
      );
      assert.ok(
        upward.intersectObject(f.surround, true).length,
        `Open ceiling seam at z=${z}`,
      );
    }
  } finally {
    f.dispose();
  }
});

void test('the fitted surround leaves the entrance open and clears the inward door sweep', () => {
  const f = fixture();
  try {
    for (let angle = 0; angle <= Math.PI / 2; angle += Math.PI / 90) {
      f.door.rotation.y = angle;
      f.manor.updateMatrixWorld(true);
      for (const height of [0.2, 1.2, 2.1]) {
        const start = f.door.localToWorld(new THREE.Vector3(0, height, 0));
        const end = f.door.localToWorld(
          new THREE.Vector3(MANOR_DOOR.width, height, 0),
        );
        const ray = new THREE.Raycaster(
          start,
          end.sub(start).normalize(),
          0,
          MANOR_DOOR.width,
        );
        assert.equal(
          ray.intersectObject(f.surround, true).length,
          0,
          'Frame intersects inward leaf',
        );
      }
    }
    f.door.rotation.y = Math.PI / 2;
    f.manor.updateMatrixWorld(true);
    for (const x of [-0.4, 0, 0.4]) {
      const ray = new THREE.Raycaster(
        f.point(x, 1.6, 1),
        new THREE.Vector3(0, 0, -1),
        0,
        2,
      );
      assert.equal(
        ray.intersectObject(f.manor, true).length,
        0,
        'Open doorway must stay usable',
      );
    }
  } finally {
    f.dispose();
  }
});
