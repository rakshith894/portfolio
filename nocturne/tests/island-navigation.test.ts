import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createIslandNavigator } from '../lib/island-navigation.ts';
import { createIslandWalker } from '../lib/island-walk.ts';
import { islandPlaces, menuPlaces } from '../lib/island-commands.ts';

void test('free ground clicks approach the nearest reachable point without crossing barriers', async () => {
  const navigator = createIslandNavigator(
    (x, z) => Math.abs(x) < 6 && Math.abs(z) < 6 && Math.abs(x) > 1,
  );
  const start = { x: -4, z: 0 },
    target = { x: 4, z: 0 };
  assert.equal(navigator.route(start, target, 0.8), null);
  const route = await navigator.routeAsync(
    start,
    target,
    0.8,
    () => false,
    true,
  );
  assert.ok(route?.length);
  let previous = start;
  for (const next of route) {
    assert.ok(navigator.clear(previous, next));
    previous = next;
  }
  assert.equal(previous.x, -1.5);
  assert.equal(previous.z, 0);
});

void test('Places shows only seven distinct main destinations', () => {
  assert.deepEqual(
    menuPlaces.map((place) => place.id),
    ['landing', 'graves', 'manor', 'backyard', 'boat', 'bridge', 'tower'],
  );
});

void test('asynchronous routes preserve obstacle checks and yield for cancellation', async () => {
  const stand = (x: number, z: number) =>
    Math.abs(x) < 8 && Math.abs(z) < 8 && !(Math.abs(x) < 1 && Math.abs(z) < 3);
  const navigator = createIslandNavigator(stand);
  const a = { x: -4, z: 0 },
    b = { x: 4, z: 0 };
  const route = await navigator.routeAsync(a, b, 0.8);
  assert.deepEqual(route, navigator.route(a, b, 0.8));
  let cancelled = false,
    checks = 0;
  const disconnected = createIslandNavigator((x, z) => {
    if (++checks === 100)
      setTimeout(() => {
        cancelled = true;
      }, 0);
    return Math.abs(x) < 20 && Math.abs(z) < 20 && Math.abs(x) > 1;
  });
  assert.equal(await disconnected.routeAsync(a, b, 0.8, () => cancelled), null);
  assert.ok(cancelled, 'Cancellation must run while the search is in progress');
  let fullChecks = 0;
  createIslandNavigator((x, z) => {
    fullChecks++;
    return Math.abs(x) < 20 && Math.abs(z) < 20 && Math.abs(x) > 1;
  }).route(a, b, 0.8);
  assert.ok(
    checks < fullChecks,
    'Cancelled searches must stop before exhausting the grid',
  );
});

void test('routes go around obstacles and reject disconnected or invalid targets', () => {
  const stand = (x: number, z: number) =>
    Math.abs(x) < 8 && Math.abs(z) < 8 && !(Math.abs(x) < 1 && Math.abs(z) < 3);
  const navigator = createIslandNavigator(stand);
  const start = { x: -4, z: 0 };
  const target = { x: 4, z: 0 };
  assert.equal(navigator.clear(start, target), false);
  const route = navigator.route(start, target, 0.8);
  assert.ok(route && route.length > 1);
  let previous = start;
  for (const next of route) {
    assert.ok(navigator.clear(previous, next));
    previous = next;
  }
  assert.equal(navigator.route(start, { x: NaN, z: 0 }), null);
  assert.equal(navigator.route(start, { x: 50, z: 50 }), null);
  const divided = createIslandNavigator(
    (x, z) => stand(x, z) && Math.abs(x) > 1,
  );
  assert.equal(divided.route(start, target), null);
});

for (const mobile of [false, true]) {
  void test(`eastern graves connect to both backyard passages (${mobile ? 'mobile' : 'desktop'})`, () => {
    const walker = createIslandWalker(mobile);
    const navigator = createIslandNavigator(
      walker.canStand,
      walker.canTraverse,
    );
    let start = { x: 17, z: 5 };
    for (const target of [
      { x: 24, z: 4 },
      { x: 24, z: 0 },
      { x: 24, z: -4 },
      { x: 27.5, z: -13.5 },
      { x: 25, z: -29 },
      { x: 20, z: -39 },
      { x: 10, z: -40 },
      { x: -6, z: -37 },
      { x: -10, z: -25 },
    ]) {
      const route = navigator.route(start, target, 0.55);
      assert.ok(
        route?.length,
        `Unreachable ground at ${JSON.stringify(target)}`,
      );
      for (const next of route) {
        assert.ok(navigator.clear(start, next));
        start = next;
      }
    }
  });
  void test(`all destinations have collision-free routes (${mobile ? 'mobile' : 'desktop'})`, () => {
    const walker = createIslandWalker(mobile);
    const navigator = createIslandNavigator(
      walker.canStand,
      walker.canTraverse,
    );
    for (const place of islandPlaces) {
      const target = place.id === 'tower' ? { x: -52, z: -31 } : place;
      const route = navigator.route(walker.position, target, 0.8);
      assert.ok(route?.length, `No route to ${place.name}`);
      let previous = walker.position;
      for (const next of route) {
        assert.ok(
          navigator.clear(previous, next),
          `Unsafe segment to ${place.name}`,
        );
        previous = next;
      }
      assert.ok(
        Math.hypot(previous.x - target.x, previous.z - target.z) <= 0.8,
      );
    }
  });
  void test(`walking can change destinations and return from the tower (${mobile ? 'mobile' : 'desktop'})`, () => {
    const walker = createIslandWalker(mobile);
    const navigator = createIslandNavigator(
      walker.canStand,
      walker.canTraverse,
    );
    let movementBlend = 0;
    for (const id of [
      'boat',
      'ravenCove',
      'bridgeShore',
      'tower',
      'bridgeView',
      'backyard',
      'manor',
      'willow',
      'landing',
    ] as const) {
      const place = islandPlaces.find((entry) => entry.id === id)!;
      const target = id === 'tower' ? { x: -52, z: -31 } : place;
      const route = navigator.route(walker.position, target, 0.8);
      assert.ok(route, `No return route to ${id}`);
      for (const [index, next] of route.entries()) {
        let remaining = Infinity;
        let reached = false;
        for (let frame = 0; frame < 3000; frame++) {
          const direction = new THREE.Vector3(
            next.x - walker.position.x,
            0,
            next.z - walker.position.z,
          );
          remaining = direction.length();
          if (
            remaining < 0.06 &&
            (!route[index + 1] ||
              navigator.clear(walker.position, route[index + 1]))
          ) {
            reached = true;
            break;
          }
          movementBlend = THREE.MathUtils.damp(movementBlend, 1, 9, 0.05);
          walker.move(direction.clampLength(0, 1), 0.05, true, movementBlend);
        }
        assert.ok(
          reached,
          `Stuck en route to ${id} at ${walker.position.x}, ${walker.position.z}`,
        );
      }
      assert.ok(
        Math.hypot(walker.position.x - target.x, walker.position.z - target.z) <
          0.9,
      );
    }
  });
}
