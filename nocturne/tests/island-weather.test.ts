import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIslandWeather, stormFlash } from '../lib/island-weather.ts';
import { islandMode } from '../lib/island-mode.ts';
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

void test('day mode clears rain and lightning and returns to the same night weather without rebuilding', () => {
  const resources = new Set<{ dispose: () => void }>();
  try {
    const weather = createIslandWeather(new THREE.Scene(), resources, false);
    const sky = weather.sky;
    const count = resources.size;
    weather.update(6.35);
    assert.ok(weather.lightning.intensity > 1.7);
    weather.setDaylight(true);
    assert.equal(weather.sky.material.uniforms.daylight.value, true);
    assert.equal(weather.rain.visible, false);
    assert.equal(weather.bolt.visible, false);
    assert.equal(weather.lightning.intensity, 0);
    weather.update(33.35);
    assert.equal(weather.lightning.intensity, 0);
    weather.setDaylight(false);
    assert.equal(weather.sky, sky);
    assert.equal(resources.size, count);
    assert.equal(weather.rain.visible, true);
    assert.ok(weather.lightning.intensity > 1.7);
  } finally {
    resources.forEach((resource) => resource.dispose());
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

void test('day, night and winter switch distinct effects without new resources and shelter stops precipitation', () => {
  for (const mobile of [false, true]) {
    const resources = new Set<{ dispose: () => void }>();
    const weather = createIslandWeather(new THREE.Scene(), resources, mobile);
    const count = resources.size;
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(500, 35, -400);
    try {
      for (const mode of [
        'winter',
        'day',
        'night',
        'winter',
        'night',
      ] as const) {
        weather.setMode(mode);
        weather.update(33.35, camera);
        assert.equal(weather.rain.visible, mode === 'night');
        assert.equal(weather.particles.visible, mode !== 'night');
        assert.equal(
          weather.sky.material.uniforms.winter.value,
          mode === 'winter',
        );
        assert.equal(
          weather.sky.material.uniforms.daylight.value,
          mode === 'day',
        );
        assert.equal(weather.lightning.intensity > 0, mode === 'night');
        assert.ok(
          weather.particles.material.uniforms.center.value.equals(
            camera.position,
          ),
        );
        weather.setSheltered(true);
        assert.equal(weather.rain.visible, false);
        assert.equal(weather.particles.visible, false);
        weather.setMode(mode); // Switching while indoors must not bring snow inside.
        assert.equal(weather.particles.visible, false);
        weather.setSheltered(false);
        assert.equal(weather.particles.visible, mode !== 'night');
        assert.equal(resources.size, count);
      }
      assert.equal(
        weather.particles.geometry.getAttribute('position').count,
        mobile ? 650 : 1800,
      );
    } finally {
      resources.forEach((resource) => resource.dispose());
    }
  }
});

void test('atmosphere preference accepts winter and falls back safely for old or invalid values', () => {
  assert.equal(islandMode('winter'), 'winter');
  assert.equal(islandMode('day'), 'day');
  assert.equal(islandMode('night'), 'night');
  assert.equal(islandMode(null), 'night');
  assert.equal(islandMode('broken'), 'night');
});
