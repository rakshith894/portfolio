import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  approach,
  groundHeight,
} from '../lib/reference-layout.ts';
import { cemeteryLayout } from '../lib/reference-graves.ts';
import {
  createIslandWalker,
  walkingDirection,
  walkingHeight,
  WALK_SPEED,
  RUN_SPEED,
  PLAYER_RADIUS,
  gateLeafSegments,
  gateOpening,
} from '../lib/island-walk.ts';
import { createIslandAvatar } from '../lib/island-avatar.ts';
import { parseIslandCommand } from '../lib/island-commands.ts';
import { SHORE_ROUTE, BOAT_DOCK } from '../lib/island-stairs.ts';
import { islandLamps } from '../lib/island-lamps.ts';
import { cemeteryFences } from '../lib/reference-layout.ts';

void test('the player starts standing at the beginning of the path', () => {
  for (const mobile of [false, true]) {
    const walker = createIslandWalker(mobile);
    assert.equal(walker.position.x, 9);
    assert.equal(walker.position.z, 34);
    assert.equal(walker.position.y, walkingHeight(9, 34));
    assert.ok(walker.canStand(9, 34));
    const spawn = walker.position.clone();
    for (let i = 0; i < 100; i++) walker.move(new THREE.Vector3(), 0.05);
    assert.ok(walker.position.equals(spawn));
    assert.equal(walker.nearHouse, false);
  }
});

void test('walking can reach the house through the open gates in both layouts', () => {
  for (const mobile of [false, true]) {
    const walker = createIslandWalker(mobile);
    for (let i = 1; i <= 400; i++) {
      const target = approach.getPointAt(i / 400);
      assert.ok(
        walker.canStand(target.x, target.z),
        `Blocked path at ${i / 400}: ${target.x}, ${target.z}`,
      );
      for (
        let frame = 0;
        frame < 12 &&
        Math.hypot(walker.position.x - target.x, walker.position.z - target.z) >
          0.07;
        frame++
      ) {
        walker.move(target.clone().sub(walker.position).setY(0), 0.05);
      }
      assert.ok(
        Math.hypot(walker.position.x - target.x, walker.position.z - target.z) <
          0.18,
      );
      assert.equal(
        walker.position.y,
        walkingHeight(walker.position.x, walker.position.z),
      );
    }
    assert.ok(walker.nearHouse);
    assert.ok(walker.position.z > -20.85);
  }
});

void test('movement is normalized and a suspended tab cannot cause a large jump', () => {
  const straight = createIslandWalker(false),
    diagonal = createIslandWalker(false);
  straight.position.set(18, groundHeight(18, 14), 14);
  diagonal.position.copy(straight.position);
  const a = straight.move(new THREE.Vector3(0, 0, -1), 0.05);
  const b = diagonal.move(new THREE.Vector3(1, 0, -1), 0.05);
  assert.ok(Math.abs(a - WALK_SPEED * 0.05) < 1e-8);
  assert.ok(Math.abs(a - b) < 1e-8);
  const before = straight.position.clone();
  straight.move(new THREE.Vector3(0, 0, -1), 100);
  assert.ok(
    Math.hypot(
      straight.position.x - before.x,
      straight.position.z - before.z,
    ) <=
      WALK_SPEED * 0.05 + 1e-8,
  );
});

void test('grave footprints, fences, cliffs and house walls block the player', () => {
  for (const mobile of [false, true]) {
    const walker = createIslandWalker(mobile);
    for (const grave of cemeteryLayout(mobile))
      assert.equal(walker.canStand(grave.x, grave.z), false);
    for (const [x, z] of [
      [-4, 20],
      [14, 7],
      [20, 7],
      [29, -9],
      [200, 0],
      [10, -30],
    ]) {
      assert.equal(
        walker.canStand(x, z),
        false,
        `Unexpected walkable obstacle ${x}, ${z}`,
      );
    }
    const fenceSide = new THREE.Vector3(14, walkingHeight(14, 8), 8);
    assert.ok(walker.canStand(fenceSide.x, fenceSide.z));
    walker.position.copy(fenceSide);
    for (let i = 0; i < 100; i++)
      walker.move(new THREE.Vector3(0, 0, -1), 0.05, true);
    assert.ok(walker.position.z > 7, 'Player crossed the gate pillar');
  }
});

void test('walking follows the camera heading and returning from the house keeps the exit nearby', () => {
  const player = new THREE.Vector3(0, 0, 0);
  assert.deepEqual(
    walkingDirection(1, 0, new THREE.Vector3(0, 3, 5), player).toArray(),
    [0, 0, -1],
  );
  assert.deepEqual(
    walkingDirection(0, 1, new THREE.Vector3(0, 3, 5), player).toArray(),
    [1, 0, 0],
  );
  assert.ok(
    walkingDirection(1, 0, new THREE.Vector3(5, 3, 0), player).distanceTo(
      new THREE.Vector3(-1, 0, 0),
    ) < 1e-8,
  );
  assert.ok(
    Math.abs(
      walkingDirection(1, 1, new THREE.Vector3(0, 3, 5), player).length() - 1,
    ) < 1e-8,
  );
  const returning = createIslandWalker(false, true);
  assert.ok(returning.nearHouse);
  assert.ok(returning.canStand(returning.position.x, returning.position.z));
});

void test('the boat landing route and disembark point are walkable', () => {
  const walker = createIslandWalker(false);
  const route = [...SHORE_ROUTE.map(([x,,z]) => [x,z]), [BOAT_DOCK.x,BOAT_DOCK.z]];
  for (const [x, z] of route)
    assert.equal(walker.canStand(x, z), true, `Blocked boat route point ${x}, ${z}`);
});

void test('voice welcome is distinct from waving', () => {
  assert.deepEqual(parseIslandCommand('greet me', 0), { type: 'welcome' });
  assert.deepEqual(parseIslandCommand('wave hello', 0), {
    type: 'action',
    action: 'wave',
  });
});

void test('the visible player has grounded geometry and settles after walking stops', () => {
  const resources = new Set<{ dispose: () => void }>();
  try {
    const avatar = createIslandAvatar(resources, false);
    avatar.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(avatar.root);
    assert.ok(Math.abs(bounds.min.y) < 0.02);
    assert.ok(bounds.max.y > 1.8 && bounds.max.y < 2.1);
    for (let i = 0; i < 20; i++) avatar.update(i / 10, true, 0.05, false);
    let settling = true;
    for (let i = 0; i < 30; i++)
      settling = avatar.update(2, false, 0.05, false);
    assert.equal(settling, false);
    avatar.update(3, true, 0.05, true);
    assert.equal(avatar.root.children[0].position.y, 0);
  } finally {
    resources.forEach((resource) => resource.dispose());
  }
});

void test('the following camera shortens its orbit when a monument blocks the player', () => {
  const walker = createIslandWalker(false);
  const grave = cemeteryLayout(false)[0];
  const ground = groundHeight(grave.x, grave.z);
  const target = new THREE.Vector3(grave.x, ground + 1.3, grave.z + 3);
  const camera = new THREE.Vector3(grave.x, ground + 2.7, grave.z - 3);
  const originalDistance = camera.distanceTo(target);
  walker.constrainCamera(camera, target);
  assert.ok(camera.distanceTo(target) < originalDistance - 1);
  assert.ok(camera.distanceTo(target) >= 1);
});

void test('sprinting cannot cross any cemetery fence segment, even after a long frame', () => {
  for (const mobile of [false,true]) {
    const walker=createIslandWalker(mobile);
    let checked=0;
    for (const fence of cemeteryFences) for(let i=1;i<fence.length;i++) {
      const [ax,az]=fence[i-1], [bx,bz]=fence[i];
      const length=Math.hypot(bx-ax,bz-az), nx=-(bz-az)/length, nz=(bx-ax)/length;
      for(const side of [-1,1]) {
        const x=(ax+bx)/2,z=(az+bz)/2,sx=x+nx*side,sz=z+nz*side;
        if(!walker.canStand(sx,sz))continue;
        checked++;
        walker.position.set(sx,walkingHeight(sx,sz),sz);
        for(let frame=0;frame<40;frame++)walker.move(new THREE.Vector3(-nx*side,0,-nz*side),1,true);
        assert.ok((walker.position.x-x)*nx*side+(walker.position.z-z)*nz*side>=PLAYER_RADIUS);
        assert.equal(walker.canTraverse(sx,sz,x-nx*side,z-nz*side),false);
      }
    }
    assert.ok(checked>=8);
  }
});

void test('handrails stop sideways travel and additional lamps have solid posts', () => {
  const walker=createIslandWalker(false);
  walker.position.set(-22,walkingHeight(-22,-34),-34);
  for(let frame=0;frame<60;frame++)walker.move(new THREE.Vector3(0,0,1),.05,true);
  assert.ok(walker.position.z<=-34+1.05-PLAYER_RADIUS);
  for(const lamp of islandLamps) {
    if(Math.abs(walkingHeight(lamp.x,lamp.z)-lamp.y)<2)
      assert.equal(walker.canStand(lamp.x,lamp.z),false,`Walked through lamp ${lamp.x},${lamp.z}`);
  }
  const closed=gateLeafSegments(0),opened=gateLeafSegments(1);
  assert.ok(opened[0][2]<closed[0][2] && opened[1][2]>closed[1][2],'Gates must swing away from the path');
  assert.equal(gateOpening(17,7),1);
});

void test('faster traversal remains frame-rate independent and rejects invalid input', () => {
  assert.ok(WALK_SPEED>=2.5 && RUN_SPEED>=5);
  const walker=createIslandWalker(false);
  walker.position.set(18,walkingHeight(18,14),14);
  const start=walker.position.clone();
  assert.equal(walker.move(new THREE.Vector3(NaN,0,0),.05),0);
  assert.equal(walker.move(new THREE.Vector3(1,0,0),.05,false,-1),0);
  assert.ok(walker.position.equals(start));
  assert.equal(walker.canTraverse(0,0,Infinity,0),false);
  const moved=walker.move(new THREE.Vector3(0,0,-1),1/60,true);
  assert.ok(Math.abs(moved-RUN_SPEED/60)<1e-8);
});
