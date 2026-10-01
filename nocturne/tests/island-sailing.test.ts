import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  canSail,
  clearSea,
  createSailingController,
  seaRoute,
} from '../lib/island-sailing.ts';
import { BOAT_MOORING } from '../lib/island-stairs.ts';
import { createIslandWalker, walkingHeight } from '../lib/island-walk.ts';
import { bridgeParapets, HOUSE_SIDE_PASSAGE } from '../lib/reference-layout.ts';
import { createIslandLife } from '../lib/island-life.ts';
import { createOceanTraffic } from '../lib/island-traffic.ts';
import { apparitionOpacity } from '../lib/island-haunting.ts';
import { SEA_OBSTACLES } from '../lib/coastal-layout.ts';

void test('the moored boat waits for input and settles after rowing stops', () => {
  const boat = createSailingController(),
    start = boat.position.clone(),
    idle = new THREE.Vector3();
  for (let i = 0; i < 120; i++) boat.move(idle, 1 / 60);
  assert.ok(boat.position.equals(start));
  for (let i = 0; i < 120; i++) boat.move(new THREE.Vector3(0, 0, -1), 1 / 60);
  assert.ok(boat.position.distanceTo(start) > 5);
  for (let i = 0; i < 300; i++) boat.move(idle, 1 / 60);
  assert.equal(boat.velocity.lengthSq(), 0);
  const settled = boat.position.clone();
  boat.move(idle, 0.05);
  assert.ok(boat.position.equals(settled));
});

void test('visible offshore rocks and stair supports stop hulls while the dock stays reachable', () => {
  assert.ok(canSail(BOAT_MOORING.x, BOAT_MOORING.z));
  assert.ok(clearSea(BOAT_MOORING, { x: -16, z: -85 }));
  for (const obstacle of SEA_OBSTACLES) {
    assert.equal(canSail(obstacle.x, obstacle.z), false);
    assert.equal(canSail(obstacle.x + obstacle.radius + 3, obstacle.z), false);
  }
  const boat = createSailingController();
  for (let frame = 0; frame < 500; frame++)
    boat.move(new THREE.Vector3(-1, 0, 1), 0.05, true);
  for (const obstacle of SEA_OBSTACLES)
    assert.ok(
      Math.hypot(boat.position.x - obstacle.x, boat.position.z - obstacle.z) >=
        obstacle.radius + 3.2,
    );
  assert.ok(
    seaRoute(boat.position),
    'A blocked hull can still return to its mooring',
  );
});

void test('boats travel kilometres beyond the old water edge and stay clear of shore', () => {
  const boat = createSailingController();
  for (let i = 0; i < 12000; i++)
    boat.move(new THREE.Vector3(0, 0, -1), 0.05, true);
  assert.ok(boat.position.z < -8000);
  assert.ok(canSail(boat.position.x, boat.position.z));
  const shore = createSailingController();
  for (let i = 0; i < 500; i++)
    shore.move(new THREE.Vector3(1, 0, 1), 0.05, true);
  assert.ok(canSail(shore.position.x, shore.position.z));
  assert.ok(
    shore.position.distanceTo(
      new THREE.Vector3(BOAT_MOORING.x, 0, BOAT_MOORING.z),
    ) < 30,
  );
  const old = shore.position.clone();
  shore.move(new THREE.Vector3(NaN, 0, 1), 0.05);
  assert.ok(shore.position.equals(old));
});

void test('return routes from all sides avoid both islands and are actually sailable', () => {
  for (const start of [
    { x: 150, z: 100 },
    { x: -200, z: 80 },
    { x: 0, z: -400 },
    { x: 300, z: -30 },
  ]) {
    const route = seaRoute(start);
    assert.ok(route?.length);
    const boat = createSailingController(start);
    let previous = start;
    for (const point of route) {
      assert.ok(clearSea(previous, point));
      previous = point;
      let remaining = Infinity;
      for (let i = 0; i < 20000; i++) {
        const direction = new THREE.Vector3(
          point.x - boat.position.x,
          0,
          point.z - boat.position.z,
        );
        remaining = direction.length();
        if (remaining < 0.3) {
          boat.stop();
          break;
        }
        boat.move(direction.multiplyScalar(1 / 3).clampLength(0, 1), 0.05);
      }
      assert.ok(
        remaining < 0.3,
        `Return stuck at ${boat.position.toArray().join(', ')}`,
      );
    }
    assert.ok(
      Math.hypot(
        boat.position.x - BOAT_MOORING.x,
        boat.position.z - BOAT_MOORING.z,
      ) < 0.3,
    );
  }
  assert.equal(seaRoute({ x: 0, z: 0 }), null);
  assert.equal(clearSea({ x: NaN, z: 0 }, { x: 200, z: 200 }), false);
  assert.equal(
    clearSea({ x: -10_000_000, z: 0 }, { x: 10_000_000, z: 0 }),
    false,
  );
  assert.equal(
    clearSea({ x: -10_000_000, z: 200 }, { x: 10_000_000, z: 200 }),
    true,
  );
});

void test('moving water follows faraway cameras while waves retain world coordinates', () => {
  const resources = new Set<{ dispose: () => void }>();
  const life = createIslandLife(new THREE.Scene(), resources, true);
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(8200, 5, -13000);
  life.update(50, camera);
  assert.ok(
    Math.hypot(
      life.sea.position.x - camera.position.x,
      life.sea.position.z - camera.position.z,
    ) < 10,
  );
  assert.ok(life.horizon.position.equals(life.sea.position));
  const shader = {
    uniforms: {},
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  };
  life.water.onBeforeCompile(shader as never, {} as THREE.WebGLRenderer);
  assert.ok(
    shader.vertexShader.includes(
      'oceanSample((modelMatrix*vec4(position,1.0)).xz',
    ),
  );
  resources.forEach((r) => r.dispose());
});

void test('occupied traffic remains near distant travellers without sailing onto land', () => {
  const resources = new Set<{ dispose: () => void }>(),
    scene = new THREE.Scene();
  const traffic = createOceanTraffic(
    scene,
    new THREE.Group(),
    resources,
    false,
  );
  for (const viewer of [
    new THREE.Vector3(-16, 3, -48),
    new THREE.Vector3(5000, 3, -5000),
  ]) {
    for (let i = 0; i < 120; i++) traffic.update(i * 0.05, viewer, viewer);
    assert.equal(traffic.boats.length, 4);
    for (const boat of traffic.boats) {
      assert.ok(boat.root.visible);
      assert.ok(canSail(boat.root.position.x, boat.root.position.z));
      assert.ok(boat.root.position.distanceTo(viewer) < 230);
      assert.ok(boat.root.children.includes(boat.passenger.root));
    }
  }
  resources.forEach((r) => r.dispose());
});

void test('the house-side opening is passable and visible bridge walls stop sprinting', () => {
  for (const mobile of [false, true]) {
    const walker = createIslandWalker(mobile);
    assert.ok(walker.canStand(HOUSE_SIDE_PASSAGE.x, HOUSE_SIDE_PASSAGE.z));
    assert.ok(walker.canTraverse(25.5, -13.5, 30, -13.5));
    for (const rail of bridgeParapets) {
      const x = (rail.ax + rail.bx) / 2;
      assert.equal(walker.canStand(x, rail.az), false);
      walker.position.set(x, walkingHeight(x, -31), -31);
      for (let i = 0; i < 100; i++)
        walker.move(
          new THREE.Vector3(0, 0, Math.sign(rail.az + 31)),
          0.05,
          true,
        );
      assert.ok(Math.abs(walker.position.z + 31) < 1);
    }
  }
});

void test('apparitions fade slowly and disappear at close range', () => {
  for (let t = 0; t < 110; t += 0.05) {
    const opacity = apparitionOpacity(t, 0, 20);
    assert.ok(opacity >= 0 && opacity <= 0.64);
    assert.ok(Math.abs(opacity - apparitionOpacity(t + 0.05, 0, 20)) < 0.01);
    assert.equal(apparitionOpacity(t, 0, 3), 0);
  }
});
