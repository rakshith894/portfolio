import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  createHouseWalker,
  HOUSE_ROOMS,
  HOUSE_WALLS,
  HOUSE_FURNITURE,
  HOUSE_FLOORS,
  type HousePoint,
  houseRoute,
} from '../lib/house-layout.ts';
import { MANOR_DOOR, MANOR_SOLIDS } from '../lib/manor-layout.ts';
import { MANOR_ORIGIN } from '../lib/reference-layout.ts';
import {
  createReferenceManor,
  type ManorMaterials,
} from '../lib/reference-manor.ts';
import { createIslandWalker, walkingHeight } from '../lib/island-walk.ts';
import { createHouseExploration } from '../lib/house-exploration.ts';
import type { createIslandAvatar } from '../lib/island-avatar.ts';
import { UPPER_HALL, STAIR_TREADS, STAIR_WELL, HOUSE_STAIRS, houseSurface } from '../lib/house-stairs.ts';
import { MASTER_HALL, HALL_GATE, hallLighting } from '../lib/master-hall.ts';
import { HALL_FRAMES } from '../lib/hall-projects.ts';

const tick = (walker: ReturnType<typeof createHouseWalker>, seconds = 2) => {
  for (let i = 0; i < seconds * 60; i++) walker.update(1 / 60);
};
function follow(
  walker: ReturnType<typeof createHouseWalker>,
  goal: HousePoint,
) {
  const route = houseRoute(walker.position, goal, (point) =>
    walker.canStand(point, true),
  );
  assert.ok(route, 'There is a connected route through the actual floor plan');
  for (let frame = 0; route.length && frame < 6000; frame++) {
    const target = route[0],
      dx = target.x - walker.position.x,
      dz = target.z - walker.position.z;
    const length = Math.hypot(dx, dz);
    if (length < 0.04) {
      route.shift();
      continue;
    }
    const door = walker.nearestDoor();
    const ahead = door && route.find(point => Math.sign(walker.position.x - door.x) !== Math.sign(point.x - door.x));
    if (
      door &&
      ahead &&
      door.id !== 'front' &&
      !door.target &&
      Math.sign(walker.position.x - door.x) !== Math.sign(ahead.x - door.x)
    )
      walker.open(door.id);
    walker.update(1 / 60);
    if (door?.target && door.progress < 1) continue;
    const step = Math.min(length, 2 / 60);
    walker.move((dx / length) * step, (dz / length) * step);
    assert.ok(
      walker.canStand(walker.position),
      'Movement never enters a wall or door',
    );
  }
  assert.equal(
    route.length,
    0,
    `The route is physically traversable: ${JSON.stringify({ position: walker.position, next: route[0], nearby: walker.nearestDoor() })}`,
  );
  tick(walker);
}

void test('rooms and their connecting corridors fit the exterior main building and wings', () => {
  const shell = MANOR_SOLIDS.filter(
    (solid) => solid.name === 'Main walls' || solid.name === 'Wing walls',
  );
  for (const floor of HOUSE_FLOORS) {
    for (let u = 0; u <= 4; u++)
      for (let v = 0; v <= 4; v++) {
        const x = floor.x + (u / 4 - 0.5) * floor.width,
          z = floor.z + (v / 4 - 0.5) * floor.depth + MANOR_DOOR.z;
        const foyer =
          Math.abs(x) <= 1.16 && z >= -16.3 && z <= MANOR_DOOR.z + 0.001;
        assert.ok(
          foyer ||
            shell.some(
              (solid) =>
                Math.abs(x - solid.x) <= solid.width / 2 + 0.001 &&
                Math.abs(z - solid.z) <= solid.depth / 2 + 0.001,
            ),
          `Floor lies outside shell: ${x}, ${z}`,
        );
      }
  }
});

for (const [index, room] of HOUSE_ROOMS.entries()) {
  void test(`${room.name} has a working walk from the hall and back through its doors`, () => {
    const walker = createHouseWalker();
    const goal = {
      x: Math.sign(room.x) * (index < 2 ? 5.3 : 10.1),
      z: index < 2 ? -6.8 : -6.2,
    };
    follow(walker, goal);
    assert.equal(walker.room()?.id, room.id);
    const roomDoor = walker.doors.find((door) => door.id === room.id)!;
    assert.equal(roomDoor.progress, 0, 'Room door closes behind the traveller');
    follow(walker, { x: 0, z: -2.8 });
    assert.equal(walker.room(), undefined);
  });
}

void test('door leaves stay open at occupied thresholds and all solid furniture blocks walking', () => {
  const walker = createHouseWalker();
  walker.position.z = -4.8;
  walker.open('library');
  tick(walker);
  walker.position.x = -2.7;
  tick(walker);
  assert.equal(walker.doors[1].progress, 1);
  assert.ok(walker.canStand(walker.position));
  for (const solid of [...HOUSE_WALLS, ...HOUSE_FURNITURE])
    assert.equal(walker.canStand(solid), false);
});

void test('the west stairs and side door reach the master hall and return without floor jumps', () => {
  const walker = createHouseWalker();
  follow(walker, { x: 5, z: -5, y: UPPER_HALL.y });
  assert.equal(walker.position.y, UPPER_HALL.y);
  assert.equal(walker.room()?.id, MASTER_HALL.id);
  assert.equal(walker.nearestDoor(), undefined, 'Ground-floor doors cannot be reached through the ceiling');
  assert.equal(walker.canStand({ x: STAIR_WELL.x, z: -5, y: UPPER_HALL.y }), false, 'The well is not an invisible upper floor');
  assert.ok(walker.canStand({ x: 0, z: -5, y: UPPER_HALL.y }), 'The middle of the master hall is now open floor');
  follow(walker, { x: 0, z: -2.8, y: 0 });
  assert.equal(walker.position.y, 0);
  for (const tread of STAIR_TREADS) {
    assert.equal(houseSurface(tread, tread.y), tread.y, 'Visible tread and walking height agree');
  }
});

void test('indoor routes use direct safe segments and stay connected from exact room destinations', () => {
  const walker = createHouseWalker();
  const goal = { x: 1.5, z: -2.3, y: 0 };
  assert.deepEqual(houseRoute(walker.position, goal, point => walker.canStand(point, true)), [goal]);
  for (const x of [-10.1, 10.1]) {
    Object.assign(walker.position, { x, z: -6.2, y: 0 });
    assert.ok(houseRoute(walker.position, { x: 5, z: -5, y: 5 }, point => walker.canStand(point, true)));
  }
  Object.assign(walker.position, { x: HOUSE_STAIRS.right, z: -5.96, y: 3.4375 });
  const dining = walker.doors.find(door => door.id === 'dining')!;
  dining.swing = -1;
  dining.progress = 1;
  assert.ok(walker.canStand(walker.position), 'An open ground-floor door cannot block stairs above its top');
});

void test('master hall has a solid side entrance and independent room lighting', () => {
  const walker = createHouseWalker();
  Object.assign(walker.position, { x: HALL_GATE.x - .65, z: HALL_GATE.z + .9, y: 5 });
  assert.equal(walker.nearestDoor()?.id, 'master-hall');
  assert.equal(walker.canStand({ x: HALL_GATE.x, z: HALL_GATE.z + .9, y: 5 }), false);
  walker.open('master-hall');
  tick(walker);
  assert.equal(walker.doors.at(-1)!.progress, 1);
  assert.ok(walker.canStand({ x: HALL_GATE.x, z: HALL_GATE.z + .9, y: 5 }));
  assert.equal(walker.canStand({ x: HALL_GATE.x, z: -6, y: 5 }), false, 'Partition blocks walking around the door');
  const daylight = hallLighting({ mode: 'day', lights: false });
  const dark = hallLighting({ mode: 'dark', lights: false });
  assert.ok(daylight.ambient > dark.ambient * 10);
  assert.equal(daylight.lamps, 0);
  assert.equal(dark.lamps, 0);
  assert.equal(hallLighting({ mode: 'dark', lights: true }).lamps, 1);
});

void test('the same avatar walks through an actual open portal, explores, and walks back outside', (context) => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    },
  });
  context.mock.method(
    THREE.TextureLoader.prototype,
    'load',
    () => new THREE.Texture(),
  );
  context.after(() => {
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  const resources = new Set<{ dispose: () => void }>();
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
    ].map((key) => {
      const material = new THREE.MeshStandardMaterial();
      resources.add(material);
      return [key, material];
    }),
  ) as ManorMaterials;
  const scene = new THREE.Scene();
  const manor = createReferenceManor(materials, resources, false);
  manor.position.copy(MANOR_ORIGIN);
  scene.add(manor);
  scene.updateMatrixWorld(true);
  for (const floor of HOUSE_FLOORS) {
    // A human-height line of sight must stay clear through the actual rendered
    // room, even with all exterior towers, foundation and stone trim visible.
    const center = new THREE.Vector3(
      floor.x,
      MANOR_DOOR.y + 1.5,
      MANOR_DOOR.z + floor.z,
    ).add(MANOR_ORIGIN);
    for (const [dx, dz, length] of [
      [1, 0, floor.width / 2 - 0.2],
      [-1, 0, floor.width / 2 - 0.2],
      [0, 1, floor.depth / 2 - 0.2],
      [0, -1, floor.depth / 2 - 0.2],
    ]) {
      if (length <= 0) continue;
      const sight = new THREE.Raycaster(
        center,
        new THREE.Vector3(dx, 0, dz),
        0.001,
        length,
      );
      assert.equal(
        sight.intersectObject(manor, true).length,
        0,
        `Exterior masonry must not fill the room at ${floor.x}, ${floor.z}`,
      );
    }
  }
  const door = manor.userData.door as THREE.Group;
  const portal = new THREE.Vector3(0, MANOR_DOOR.y + 1.6, MANOR_DOOR.z).add(
    MANOR_ORIGIN,
  );
  const ray = new THREE.Raycaster(
    portal.clone().add(new THREE.Vector3(0, 0, 1)),
    new THREE.Vector3(0, 0, -1),
    0,
    3,
  );
  scene.updateMatrixWorld(true);
  assert.ok(
    ray.intersectObject(door, true).length,
    'Closed door visibly covers the portal',
  );
  door.rotation.y = Math.PI / 2;
  scene.updateMatrixWorld(true);
  assert.equal(
    ray.intersectObject(manor, true).length,
    0,
    'Open portal is not blocked by a solid facade or black panel',
  );
  door.rotation.y = 0;
  const walker = createIslandWalker(false, true, false);
  walker.position.set(10, walkingHeight(10, -20.8), -20.8);
  const avatar = new THREE.Group();
  avatar.position.copy(walker.position);
  scene.add(avatar);
  const walkingFrames: number[] = [];
  const player = {
    root: avatar,
    update: (_distance: number, moving: boolean) => {
      if (moving) walkingFrames.push(avatar.position.z);
    },
  } as unknown as ReturnType<typeof createIslandAvatar>;
  const camera = new THREE.PerspectiveCamera(50, 1.6, 0.12, 1600);
  camera.position.set(11, 29, -15);
  const controls = {
    enabled: true,
    target: new THREE.Vector3(10, 27, -21),
    maxDistance: 42,
    update: () => {},
  } as unknown as OrbitControls;
  const openedProjects: string[] = [];
  const exploration = createHouseExploration(
    scene,
    manor,
    player,
    walker,
    camera,
    controls,
    false,
    () => {},
    () => {},
    () => false,
    id => openedProjects.push(id),
  );
  try {
    assert.ok(exploration.enter());
    assert.equal(exploration.enter(), false);
    for (let frame = 0; frame < 1200 && !exploration.inside; frame++) {
      const previous = avatar.position.clone();
      exploration.update(1 / 60, frame / 60, 0, 0, false, false);
      assert.equal(
        manor.visible,
        true,
        'Crossing the doorway never hides or replaces the house',
      );
      assert.ok(
        Math.hypot(
          avatar.position.x - previous.x,
          avatar.position.z - previous.z,
        ) < 0.06,
        'Entry never teleports the character',
      );
      if (avatar.position.z < portal.z)
        assert.ok(
          door.rotation.y > 1.4,
          'The door opens before the character crosses it',
        );
    }
    assert.ok(exploration.inside, 'The walk reaches the interior');
    assert.equal(avatar.parent, scene, 'Entry keeps the same player and scene');
    assert.ok(
      walkingFrames.some((z) => z > portal.z) &&
        walkingFrames.some((z) => z < portal.z),
    );
    for (let frame = 0; frame < 180; frame++) {
      exploration.update(1 / 60, 20 + frame / 60, 0, 0, false, false);
      assert.equal(manor.visible, true, 'The exterior remains present inside');
    }
    assert.equal(door.rotation.y, 0, 'The front door closes after entry');
    const origin = MANOR_ORIGIN.clone().add(new THREE.Vector3(0, MANOR_DOOR.y, MANOR_DOOR.z));
    assert.ok(exploration.walkTo({ x: 1.5, z: -2.3, y: 0 }));
    const clearGoal = origin.clone().add(new THREE.Vector3(1.5, 0, -2.3));
    for (let frame = 0; frame < 180 && walker.position.distanceTo(clearGoal) > .03; frame++) {
      const before = walker.position.clone();
      exploration.update(1 / 60, 25 + frame / 60, 0, 0, false, false);
      const step = before.distanceTo(walker.position);
      assert.ok(step > .0001, 'An unobstructed route never inserts an idle frame');
      assert.ok(step <= 1.45 / 60 + 1e-8, 'Indoor navigation stays at walking pace');
      if (frame > 30 && before.distanceTo(clearGoal) > .05)
        assert.ok(step > 1.43 / 60, 'Walking stays continuous after accelerating');
    }
    assert.ok(walker.position.distanceTo(clearGoal) < .03);
    for (let frame = 0; frame < 30; frame++) exploration.update(1 / 60, 29 + frame / 60, 0, 0, false, false);
    // Exercise the live scene controller, not only the floor-plan search.
    for (const goal of [{ x: -5.3, z: -6.8, y: 0 }, { x: -10.1, z: -6.2, y: 0 }, { x: 5.3, z: -6.8, y: 0 }, { x: 10.1, z: -6.2, y: 0 }, { x: 5, z: -5, y: 5 }, { x: 0, z: -2.8, y: 0 }]) {
      const destination = new THREE.Vector3(goal.x, goal.y, goal.z).add(origin);
      const ray = new THREE.Raycaster(destination.clone().add(new THREE.Vector3(0, .3, 0)), new THREE.Vector3(0, -1, 0), 0, 1);
      assert.ok(exploration.point(ray), `Floor tap finds a route to ${JSON.stringify(goal)}`);
      let arrived = false;
      for (let frame = 0; frame < 6000; frame++) {
        exploration.update(1 / 60, 40 + frame / 60, 0, 0, false, false);
        assert.equal(exploration.inside, true, 'Arriving at a tapped floor does not trigger an exit');
        if (walker.position.distanceTo(destination) < .04) { arrived = true; break; }
      }
      assert.ok(arrived, `Tap-to-walk reaches ${JSON.stringify(goal)}: ${JSON.stringify(walker.position.toArray())}`);
      for (let frame = 0; frame < 30; frame++) exploration.update(1 / 60, 140 + frame / 60, 0, 0, false, false);
      if (goal.y === 5) {
        assert.ok(exploration.masterHall);
        const lamps: THREE.PointLight[] = [];
        scene.getObjectByName('Rooms inside the manor shell')!.traverse(object => {
          if (object instanceof THREE.PointLight && object.position.y > 5 && object.position.x > HALL_GATE.x) lamps.push(object);
        });
        assert.equal(lamps.length, 2);
        exploration.setHallSettings({ mode: 'dark', lights: false });
        exploration.update(1 / 60, 141, 0, 0, false, false);
        assert.ok(lamps.every(lamp => lamp.intensity === 0), 'Lights off extinguishes both master-hall chandeliers');
        exploration.setHallSettings({ mode: 'dark', lights: true });
        exploration.update(1 / 60, 142, 0, 0, false, false);
        assert.ok(lamps.every(lamp => lamp.intensity > 0), 'Lamps can be switched on independently of dark mode');
        exploration.setProjects(HALL_FRAMES.map(frame => ({ id: frame.id, title: '', description: '', url: '' })));
        for (const frame of HALL_FRAMES) {
          const center = new THREE.Vector3(frame.x, frame.y, frame.z).add(origin);
          const normal = new THREE.Vector3(Math.sin(frame.rotation), 0, Math.cos(frame.rotation));
          assert.ok(exploration.point(new THREE.Raycaster(center.clone().addScaledVector(normal, .8), normal.clone().negate(), 0, 2)));
          assert.equal(openedProjects.at(-1), frame.id, 'Tapping the glass opens that frame rather than starting a floor route');
        }
        exploration.selectProject('frame-1');
        for (let frame = 0; frame < 30; frame++) exploration.update(1 / 60, 143 + frame / 60, 0, 0, false, false);
        const frameRoot = scene.getObjectByName('Project glass frame 1')!;
        assert.ok(frameRoot.getObjectByName('Project glass hinge')!.rotation.y < -.9, 'The selected glass swings open');
        const frameGlow = frameRoot.getObjectByName('Concealed frame glow') as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
        assert.ok(frameGlow.material.opacity > 0, 'Concealed lighting softly outlines the frame in dark mode');
        exploration.selectProject(null);
      }
    }
    assert.ok(exploration.walkTo({ x: -5.3, z: -6.8, y: 0 }));
    exploration.stop();
    const stopped = walker.position.clone();
    for (let frame = 0; frame < 30; frame++) exploration.update(1 / 60, 150 + frame / 60, 0, 0, false, false);
    assert.ok(walker.position.distanceTo(stopped) < .001, 'Stop cancels a floor route immediately');
    assert.equal(exploration.walkTo({ x: 100, z: 100, y: 0 }), false);
    exploration.returnToDoor();
    for (let frame = 0; frame < 2400 && exploration.active; frame++)
      exploration.update(1 / 60, 30 + frame / 60, 0, 0, false, false);
    assert.equal(
      exploration.active,
      false,
      `The return walk reaches the island: ${JSON.stringify({ position: avatar.position.toArray(), inside: exploration.inside, angle: door.rotation.y })}`,
    );
    assert.ok(avatar.position.z > portal.z);
    assert.equal(manor.visible, true);
  } finally {
    exploration.dispose();
    resources.forEach((resource) => resource.dispose());
  }
});

void test('guardian occupancy holds a room door open until the last follower clears it', () => {
  const walker = createHouseWalker(); walker.position.z = -4.8;
  walker.open('dining'); tick(walker);
  const door = walker.doors.find(door => door.id === 'dining')!;
  walker.position.x = 5.3;
  for (let i = 0; i < 180; i++) walker.update(1 / 60, [{ x: 2.6, z: -4.8, y: 0 }]);
  assert.equal(door.progress, 1);
  tick(walker); assert.equal(door.progress, 0);
});

void test('the study is replaced by an empty skills gallery and long moves cannot tunnel through fixtures', () => {
  assert.ok(HOUSE_ROOMS.every(room => room.id !== 'study' && !room.name.toLowerCase().includes('study')));
  assert.ok(HOUSE_FURNITURE.every(item => item.kind !== 'desk' && item.kind !== 'chair'));
  const walker = createHouseWalker();
  walker.move(0, -8);
  assert.ok(walker.position.z > -4.6, 'Projector blocks a long frame');
  walker.position.x = 0; walker.position.z = -2.8; walker.move(8, 0);
  assert.ok(walker.position.x < 2.2, 'Room partition blocks a long frame');
});
