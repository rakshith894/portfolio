import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  createReferenceManor,
  type ManorMaterials,
} from '../lib/reference-manor.ts';
import {
  MANOR_ORIGIN,
  REFERENCE_VIEWS,
  coastPoint,
  groundHeight,
  onIsland,
  referenceCameraPose,
} from '../lib/reference-layout.ts';
import { createIslandWalker, walkingHeight, PLAYER_RADIUS } from '../lib/island-walk.ts';

function manorFixture() {
  const material = new THREE.MeshStandardMaterial();
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
    ].map((name) => [name, material]),
  ) as ManorMaterials;
  const resources = new Set<{ dispose: () => void }>([material]);
  const manor = createReferenceManor(materials, resources, false);
  manor.position.copy(MANOR_ORIGIN);
  manor.updateMatrixWorld(true);
  return {
    manor,
    dispose: () => resources.forEach((resource) => resource.dispose()),
  };
}

void test('visible manor foundations and rear terrace block the traveller on both layouts', () => {
  const fixture = manorFixture();
  try {
    for (const mobile of [false, true]) {
      const walker = createIslandWalker(mobile);
      let checked = 0;
      // Cast across the actual rendered foundations, including the backyard.
      for (let z = -38; z < -25; z += .4) {
        for (const side of [-1, 1]) {
          const ray = new THREE.Raycaster(new THREE.Vector3(10 + side * 22, 25.5, z), new THREE.Vector3(-side, 0, 0));
          const hit = ray.intersectObject(fixture.manor, true)[0];
          if (!hit) continue;
          const x = hit.point.x + side * (PLAYER_RADIUS - .06);
          if (walkingHeight(x, z) > 25.5) continue;
          checked++;
          assert.equal(walker.canStand(x, z), false, `Rendered wall overlap at ${x}, ${z}`);
        }
      }
      assert.ok(checked > 30);
      assert.equal(walker.canStand(10, -37.6), false, 'Rear terrace must be solid');
      assert.equal(walker.canStand(10, -26.5), false, 'Stairs must not bypass the front wall');
      assert.equal(walker.canTraverse(10, -40, 10, -34), false);
      walker.position.set(10, walkingHeight(10, -40), -40);
      for (let frame = 0; frame < 100; frame++) walker.move(new THREE.Vector3(0, 0, 1), .05, true);
      assert.ok(walker.position.z <= -37.9 - PLAYER_RADIUS, 'Running from the backyard entered the terrace');
    }
  } finally {
    fixture.dispose();
  }
});

void test('the manor door stops walking while the house approach remains accessible', () => {
  for (const mobile of [false, true]) {
    const walker = createIslandWalker(mobile, true);
    walker.position.set(10, walkingHeight(10, -20.8), -20.8);
    for (let frame = 0; frame < 150; frame++) walker.move(new THREE.Vector3(0, 0, -1), .05, true);
    assert.ok(walker.position.z > -24.25, 'Walked through the closed front door');
    assert.ok(walker.position.z < -23.5, 'Stairway was blocked before reaching the doorway');
    assert.equal(walker.canStand(walker.position.x, walker.position.z), true);
    assert.equal(walker.nearHouse, true, 'Enter the house must remain available at the door');
    assert.equal(walker.canTraverse(10, -23, 10, -26), false);
    assert.equal(walker.canStand(8.5, -23.885), false, 'Front arch jamb must be solid');
    assert.equal(walker.canStand(10, -23.985), false, 'Raised door sill must be solid');
  }
});

void test('the follow camera cannot pass through the manor from the backyard', () => {
  const walker = createIslandWalker(false);
  const target = new THREE.Vector3(10, 27.5, -40);
  const camera = new THREE.Vector3(10, 28, -29);
  walker.constrainCamera(camera, target);
  assert.ok(camera.z < -34.5, 'Camera crossed the rear wall');
});

void test('manor wings and terraces meet their supporting terrain', () => {
  const fixture = manorFixture();
  try {
    for (const [x, z] of [
      [-0.7, -32.2],
      [20.7, -32.2],
      [-2.2, -27],
      [22.2, -27],
      [10, -36],
    ]) {
      const height = groundHeight(x, z);
      const ray = new THREE.Raycaster(
        new THREE.Vector3(x, height - 0.5, z),
        new THREE.Vector3(0, 1, 0),
      );
      const [hit] = ray.intersectObject(fixture.manor, true);
      assert.ok(hit, `No support at ${x}, ${z}`);
      assert.ok(
        Math.abs(hit.point.y - height) < 0.01,
        `Floating support at ${x}, ${z}: ${hit.point.y - height}`,
      );
    }
  } finally {
    fixture.dispose();
  }
});

void test('whole-island camera keeps the headland, manor, and tower in frame across screen shapes', () => {
  const fixture = manorFixture();
  try {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 360; i++) {
      const angle = (i / 360) * Math.PI * 2;
      const p = coastPoint(angle);
      points.push(new THREE.Vector3(p.x, groundHeight(p.x, p.y), p.y));
      points.push(
        new THREE.Vector3(
          p.x + Math.cos(angle) * 5,
          -17.5,
          p.y + Math.sin(angle) * 5,
        ),
      );
    }
    fixture.manor.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++)
        points.push(
          new THREE.Vector3()
            .fromBufferAttribute(positions, i)
            .applyMatrix4(object.matrixWorld),
        );
    });
    for (const x of [-61, -43])
      for (const z of [-42, -20])
        for (const y of [-17.5, 26]) points.push(new THREE.Vector3(x, y, z));
    for (const x of [-55.3, -48.7])
      for (const z of [-34.1, -27.9]) points.push(new THREE.Vector3(x, 41, z));
    for (const aspect of [0.3, 390 / 844, 0.6, 0.8, 1, 1.6, 2]) {
      const camera = new THREE.PerspectiveCamera(41, aspect, 0.2, 1200);
      const pose = referenceCameraPose('aerial', aspect, camera.fov);
      camera.position.copy(pose.position);
      camera.lookAt(pose.target);
      camera.updateMatrixWorld(true);
      for (const point of points) {
        const projected = point.clone().project(camera);
        assert.ok(
          Math.abs(projected.x) < 0.98 &&
            Math.abs(projected.y) < 0.98 &&
            projected.z > -1 &&
            projected.z < 1,
          `Clipped ${point.toArray().join(', ')} at aspect ${aspect}: ${projected.toArray().join(', ')}`,
        );
      }
    }
  } finally {
    fixture.dispose();
  }
});

void test('camera poses preserve presets and stay above the island terrain', () => {
  for (const view of Object.keys(
    REFERENCE_VIEWS,
  ) as (keyof typeof REFERENCE_VIEWS)[]) {
    const original = REFERENCE_VIEWS[view].position.clone();
    const pose = referenceCameraPose(view, 390 / 844);
    if (onIsland(pose.position.x, pose.position.z)) {
      assert.ok(
        pose.position.y >= groundHeight(pose.position.x, pose.position.z) + 1.8,
      );
    }
    pose.position.set(0, 0, 0);
    pose.target.set(0, 0, 0);
    assert.ok(REFERENCE_VIEWS[view].position.equals(original));
    assert.ok(REFERENCE_VIEWS[view].target.length() > 0);
  }
});
