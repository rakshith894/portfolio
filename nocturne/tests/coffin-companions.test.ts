import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCoffinCompanions } from '../lib/coffin-companions.ts';
import { createReferenceGraves } from '../lib/reference-graves.ts';
import { walkingHeight } from '../lib/island-walk.ts';
import { setImmediate } from 'node:timers/promises';

function setup() {
  const scene = new THREE.Scene(), resources = new Set<{ dispose: () => void }>();
  const coffins = [0, 1].map(id => {
    const root = new THREE.Group(), hinge = new THREE.Group(); root.position.set(id * 8, walkingHeight(id * 8, 10), 10); root.add(hinge); scene.add(root);
    return { id, root, hinge, open: false };
  });
  const player = new THREE.Vector3(4, walkingHeight(4, 15), 15);
  const controller = createCoffinCompanions(scene, coffins, resources, { routeAsync: async (_start, end) => [end] }, () => true);
  const tick = (count: number, approach = false) => { for (let i = 0; i < count; i++) controller.update(1 / 60, player, approach, false); };
  const dispose = () => { controller.dispose(); resources.forEach(resource => resource.dispose()); };
  return { scene, coffins, player, controller, tick, dispose };
}

void test('each coffin wakes one articulated guardian, toggles independently, and closes after recall', async () => {
  const { coffins, player, controller, tick, dispose } = setup();
  try {
    controller.toggle(0, player); controller.toggle(1, player); tick(190); await setImmediate(); tick(240);
    assert.ok(controller.companions.every(c => c.phase === 'following' && c.body.visible));
    assert.ok(controller.companions[0].body.position.distanceTo(controller.companions[1].body.position) >= .9, 'Simultaneous summons reserve separate standing positions');
    assert.ok(coffins.every(coffin => coffin.open && coffin.hinge.rotation.z > 1.5));
    assert.ok(controller.companions.every(c => c.body.getObjectByName('arm1') && c.body.getObjectByName('leg-1')));
    controller.toggle(0, player); tick(230);
    assert.equal(controller.companions[0].phase, 'sleeping');
    assert.equal(controller.companions[0].body.visible, false);
    assert.equal(coffins[0].open, false);
    assert.ok(coffins[0].hinge.rotation.z < .05);
    assert.equal(controller.companions[1].phase, 'following');
    assert.equal(coffins[1].open, true);
  } finally { dispose(); }
});

void test('multiple guardians stay separate while stopped, following a turn, and after a recall', async () => {
  const { player, controller, tick, dispose } = setup();
  try {
    controller.toggle(0, player); controller.toggle(1, player); tick(190); await setImmediate(); tick(400);
    for (let frame = 0; frame < 1000; frame++) {
      if (frame < 250) player.x += .03;
      else if (frame < 500) player.z -= .03;
      tick(1);
      const [a, b] = controller.companions;
      assert.ok(a.body.position.distanceTo(b.body.position) >= .88, 'Bodies cannot merge at a turn or when the traveller stops');
    }
    controller.toggle(0, player); tick(230);
    assert.equal(controller.companions[1].phase, 'following');
  } finally { dispose(); }
});

void test('guardians retain stair heights, indoor turns and offshore positions without stopping at the island edge', async () => {
  const { player, controller, tick, dispose } = setup();
  try {
    controller.toggle(0, player); tick(190); await setImmediate(); tick(240);
    const guardian = controller.companions[0];
    for (const target of [new THREE.Vector3(4, 35, 15), new THREE.Vector3(8, 35, 15), new THREE.Vector3(8, 40, 11), new THREE.Vector3(120, 0, -130)]) {
      const from = player.clone();
      for (let i = 1; i <= 300; i++) { player.lerpVectors(from, target, i / 300); tick(1); }
      tick(600);
      assert.ok(guardian.body.position.distanceTo(target) < 2.2, `Companion keeps following: ${JSON.stringify(guardian.body.position.toArray())} toward ${JSON.stringify(target.toArray())} (${guardian.phase}, cursor ${guardian.cursor})`);
    }
    controller.toggle(0, player); tick(220);
    assert.equal(guardian.phase, 'sleeping', 'Recall works from far offshore');
  } finally { dispose(); }
});

void test('approaching wakes a coffin once; recall does not immediately reopen it while standing nearby', async () => {
  const { player, controller, tick, dispose } = setup();
  try {
    player.copy(controller.companions[0].home).add(new THREE.Vector3(1, 0, 0));
    tick(190, true); await setImmediate(); tick(30, true);
    assert.equal(controller.companions[0].wanted, true);
    controller.toggle(0, player); tick(350, true);
    assert.equal(controller.companions[0].phase, 'sleeping');
    player.x += 8; tick(1, true); player.x -= 8; tick(1, true);
    assert.equal(controller.companions[0].phase, 'rising');
  } finally { dispose(); }
});

void test('every rendered chest has a unique clickable hinged lid on desktop and mobile', () => {
  for (const mobile of [false, true]) {
    const resources = new Set<{ dispose: () => void }>(), stone = new THREE.MeshStandardMaterial();
    const cemetery = createReferenceGraves(stone, resources, mobile);
    assert.equal(cemetery.coffins.length, cemetery.placements.filter(grave => grave.kind === 'chest').length);
    assert.ok(cemetery.coffins.length > 5);
    assert.equal(new Set(cemetery.coffins.map(coffin => coffin.id)).size, cemetery.coffins.length);
    cemetery.root.updateMatrixWorld(true);
    for (const coffin of cemetery.coffins) {
      assert.ok(coffin.hinge.children.length >= 3);
      const point = coffin.root.localToWorld(new THREE.Vector3(0, 4, 1));
      assert.ok(new THREE.Raycaster(point, new THREE.Vector3(0, -1, 0)).intersectObject(coffin.root, true).length);
    }
    resources.forEach(resource => resource.dispose()); stone.dispose();
  }
});
