import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HOUSE_WINDOWS, windowedWall } from '../lib/house-windows.ts';
import { cutManorInterior } from '../lib/manor-interior-cut.ts';
import { MANOR_DOOR } from '../lib/manor-layout.ts';

void test('every window has an open sightline, solid sill and lintel, and full reveal faces', () => {
  for (const opening of HOUSE_WINDOWS) {
    const source = { x: opening.x, y: opening.y, z: opening.z, width: opening.axis === 'x' ? 3 : .2, height: 4, depth: opening.axis === 'z' ? 3 : .2 };
    const pieces = windowedWall(source);
    assert.equal(pieces.length, 4);
    const material = new THREE.MeshBasicMaterial();
    const root = new THREE.Group();
    for (const piece of pieces) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(piece.width, piece.height, piece.depth), material);
      mesh.position.set(piece.x, piece.y, piece.z); root.add(mesh);
    }
    root.updateMatrixWorld(true);
    const direction = new THREE.Vector3(opening.axis === 'z' ? 1 : 0, 0, opening.axis === 'x' ? 1 : 0);
    const center = new THREE.Vector3(opening.x, opening.y, opening.z);
    const cast = (origin: THREE.Vector3, dir: THREE.Vector3) => new THREE.Raycaster(origin, dir, 0, 2).intersectObject(root, true);
    assert.equal(cast(center.clone().addScaledVector(direction, -1), direction).length, 0);
    for (const side of [-1, 1]) {
      assert.ok(cast(center, new THREE.Vector3(0, side, 0)).length, 'Reveal faces are visible inside the recess');
      assert.ok(cast(center.clone().add(new THREE.Vector3(0, side * (opening.height / 2 + .1), 0)).addScaledVector(direction, -1), direction).length);
    }
    root.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); }); material.dispose();
  }
});

void test('the exterior masonry cannot cover the shared indoor window openings', () => {
  for (const opening of HOUSE_WINDOWS) {
    const center = new THREE.Vector3(opening.x, MANOR_DOOR.y + opening.y, MANOR_DOOR.z + opening.z);
    const source = new THREE.BoxGeometry(opening.axis === 'x' ? 3 : 1, 4, opening.axis === 'z' ? 3 : 1).toNonIndexed().translate(center.x, center.y, center.z);
    const cut = cutManorInterior(source);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(cut, material); mesh.updateMatrixWorld();
    const direction = new THREE.Vector3(opening.axis === 'z' ? 1 : 0, 0, opening.axis === 'x' ? 1 : 0);
    assert.equal(new THREE.Raycaster(center.clone().addScaledVector(direction, -1), direction, 0, 2).intersectObject(mesh).length, 0);
    source.dispose(); cut.dispose(); material.dispose();
  }
});
