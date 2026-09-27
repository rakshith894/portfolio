import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIslandWeather, stormFlash } from '../lib/island-weather.ts';
import {
  cemeteryLayout,
  createReferenceGraves,
} from '../lib/reference-graves.ts';
import {
  groundHeight,
  onIsland,
  pathDistance,
} from '../lib/reference-layout.ts';

void test('lightning has one smooth bounded pulse and a long quiet interval', () => {
  for (const start of [6, 33, 60]) {
    assert.equal(stormFlash(start - 0.01), 0);
    assert.equal(stormFlash(start), 0);
    assert.ok(Math.abs(stormFlash(start + 0.35) - 1) < 1e-10);
    assert.equal(stormFlash(start + 0.71), 0);
    assert.equal(stormFlash(start + 14), 0);
    for (let step = 0; step <= 70; step++) {
      const value = stormFlash(start + step / 100);
      assert.ok(value >= 0 && value <= 1);
    }
  }
});

void test('weather follows exploration without advancing a paused storm', () => {
  for (const mobile of [false, true]) {
    const resources = new Set<{ dispose: () => void }>();
    try {
      const weather = createIslandWeather(new THREE.Scene(), resources, mobile);
      const camera = new THREE.PerspectiveCamera();
      camera.position.set(26, 20, 31);
      weather.update(6.35, camera);
      const flash = weather.bolt.material.opacity;
      const intensity = weather.lightning.intensity;
      assert.ok(flash > 0.8 && intensity > 1.7);
      camera.position.set(-50, 40, 80);
      weather.update(6.35, camera);
      assert.ok(weather.sky.position.equals(camera.position));
      assert.ok(weather.rain.position.equals(camera.position));
      assert.equal(weather.time.value, 6.35);
      assert.equal(weather.bolt.material.opacity, flash);
      assert.equal(weather.lightning.intensity, intensity);
      weather.update(7, camera);
      assert.equal(weather.bolt.visible, false);
      assert.equal(weather.lightning.intensity, 0);
    } finally {
      resources.forEach((resource) => resource.dispose());
    }
  }
});

void test('cemetery layouts keep paths clear and reduce density on mobile', () => {
  const desktop = cemeteryLayout(false),
    mobile = cemeteryLayout(true);
  assert.ok(desktop.length > mobile.length && mobile.length > 0);
  assert.deepEqual(cemeteryLayout(false), desktop);
  for (const grave of desktop) {
    assert.ok(onIsland(grave.x, grave.z, 3));
    assert.ok(pathDistance(grave.x, grave.z) >= 4.4);
  }
});

void test('chest tomb foundations reach the downhill terrain beneath their fronts', () => {
  const source = new THREE.MeshStandardMaterial();
  const resources = new Set<{ dispose: () => void }>([source]);
  try {
    const { root, placements } = createReferenceGraves(
      source,
      resources,
      false,
    );
    root.updateMatrixWorld(true);
    for (const grave of placements.filter((grave) => grave.kind === 'chest')) {
      const point = new THREE.Vector3(0, 0, 1.9 * grave.scale)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), grave.turn)
        .add(new THREE.Vector3(grave.x, 0, grave.z));
      const ground = groundHeight(point.x, point.z);
      const ray = new THREE.Raycaster(
        new THREE.Vector3(point.x, ground - 0.5, point.z),
        new THREE.Vector3(0, 1, 0),
      );
      const [hit] = ray.intersectObject(root, true);
      assert.ok(hit, `Missing tomb foundation at ${grave.x}, ${grave.z}`);
      assert.ok(
        Math.abs(hit.point.y - ground) < 0.15,
        `Floating tomb at ${grave.x}, ${grave.z}: ${hit.point.y - ground}`,
      );
    }
  } finally {
    resources.forEach((resource) => resource.dispose());
  }
});
