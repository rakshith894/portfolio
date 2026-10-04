import test from 'node:test';
import assert from 'node:assert/strict';
import { islandLamps } from '../lib/island-lamps.ts';
import {
  MANOR_ORIGIN,
  groundHeight,
  onIsland,
} from '../lib/reference-layout.ts';
import { MANOR_SOLIDS } from '../lib/manor-layout.ts';
import { SHORE_ROUTE, TOWER_ROUTE, stairTreads } from '../lib/island-stairs.ts';

void test('every outdoor lamp sits on terrain, a bridge deck or a stair tread', () => {
  const treads = [SHORE_ROUTE, TOWER_ROUTE].flatMap(stairTreads);
  for (const lamp of islandLamps) {
    const onTread = treads.some((step) => {
      const dx = lamp.x - step.x,
        dz = lamp.z - step.z;
      const x = dx * Math.cos(step.angle) - dz * Math.sin(step.angle);
      const z = dx * Math.sin(step.angle) + dz * Math.cos(step.angle);
      return (
        Math.abs(x) + 0.14 <= step.width / 2 + 0.001 &&
        Math.abs(z) + 0.14 <= step.depth / 2 + 0.001 &&
        Math.abs(lamp.y - step.y) < 0.02
      );
    });
    const onBridge =
      lamp.x < -14.3 &&
      lamp.x > -47.7 &&
      Math.abs(lamp.z + 31) < 1.1 &&
      Math.abs(lamp.y - 25.4) < 0.01;
    const onGround =
      onIsland(lamp.x, lamp.z, 0.2) &&
      Math.abs(lamp.y - groundHeight(lamp.x, lamp.z)) <= 0.2;
    assert.ok(
      onTread || onBridge || onGround,
      `Unsupported lamp: ${JSON.stringify(lamp)}`,
    );
    assert.ok(
      !MANOR_SOLIDS.some(
        (solid) =>
          Math.abs(lamp.x - MANOR_ORIGIN.x - solid.x) < solid.width / 2 &&
          Math.abs(lamp.z - MANOR_ORIGIN.z - solid.z) < solid.depth / 2,
      ),
      `Lamp clips into manor: ${JSON.stringify(lamp)}`,
    );
  }
});
