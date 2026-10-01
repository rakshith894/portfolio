import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  STAIR_ROUTES,
  stairTreads,
  stairHeight,
  SHORE_ROUTE,
  TOWER_ROUTE,
  MANOR_ROUTE,
} from '../lib/island-stairs.ts';
import { createIslandWalker, MAX_STEP_HEIGHT } from '../lib/island-walk.ts';
import {
  locomotionPace,
  CAPTURED_WALK_SPEED,
  CAPTURED_RUN_SPEED,
} from '../lib/human-locomotion.ts';

void test('rendered treads match collision heights and have human-scale risers', () => {
  for (const route of STAIR_ROUTES) {
    for (const tread of stairTreads(route)) {
      assert.ok(
        Math.abs(stairHeight(tread.x, tread.z)! - tread.y) < 0.001,
        `Tread mismatch at ${tread.x},${tread.z}`,
      );
    }
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i],
        rise = Math.abs(b[1] - a[1]);
      if (rise < 0.001) continue;
      const count = Math.ceil(rise / 0.18);
      assert.ok(rise / count <= 0.18);
      const landing = route === STAIR_ROUTES[2] ? 0.24 : 2.2;
      assert.ok(
        (Math.hypot(b[0] - a[0], b[2] - a[2]) - landing) / count >= 0.28,
        'Stair tread too short',
      );
    }
  }
});

void test('every stair flight is walkable in both directions without height jumps', () => {
  const walker = createIslandWalker(false);
  for (const route of STAIR_ROUTES) {
    // The closed door stops the player's radius before the final tread centre.
    const accessible =
      route === MANOR_ROUTE
        ? [route[0], [10, stairHeight(10, -23.75)!, -23.75] as const]
        : route;
    for (const sequence of [accessible, [...accessible].reverse()]) {
      const first = sequence[0];
      walker.position.set(first[0], first[1], first[2]);
      for (const target of sequence.slice(1)) {
        for (let frame = 0; frame < 1800; frame++) {
          const direction = new THREE.Vector3(
            target[0] - walker.position.x,
            0,
            target[2] - walker.position.z,
          );
          if (direction.length() < 0.035) break;
          const before = walker.position.y;
          walker.move(direction.clampLength(0, 1), 0.05);
          assert.ok(
            Math.abs(walker.position.y - before) <= MAX_STEP_HEIGHT + 0.001,
          );
        }
        assert.ok(
          Math.hypot(
            walker.position.x - target[0],
            walker.position.z - target[2],
          ) < 0.04,
          `Stopped before ${target.join(',')}`,
        );
      }
    }
  }
  assert.equal(walker.canTraverse(-22, -34, -22, -37.4), false);
});

void test('walk and run playback follow actual travel speed', () => {
  assert.equal(locomotionPace(CAPTURED_WALK_SPEED).running, false);
  assert.equal(locomotionPace(CAPTURED_WALK_SPEED).timeScale, 1);
  assert.equal(locomotionPace(CAPTURED_RUN_SPEED).running, true);
  assert.equal(locomotionPace(CAPTURED_RUN_SPEED).timeScale, 1);
  assert.equal(locomotionPace(0).timeScale, 0);
  assert.equal(locomotionPace(1.9, 1, true).running, true);
  assert.equal(locomotionPace(1.9, 1, false).running, false);
  assert.ok(locomotionPace(0.3).timeScale < locomotionPace(1.55).timeScale);
  assert.ok(SHORE_ROUTE.length > 8 && TOWER_ROUTE.length > 4);
});
