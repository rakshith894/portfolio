import { MANOR_DOOR, MANOR_SOLIDS } from './manor-layout.ts';
import { houseSurface, UPPER_HALL } from './house-stairs.ts';
import { MASTER_HALL, HALL_GATE } from './master-hall.ts';
export type HousePoint = { x: number; z: number; y?: number };
export type HouseSolid = HousePoint & {
  width: number;
  depth: number;
  height: number;
  kind: 'wall' | 'shelf' | 'table' | 'chair' | 'desk';
};
// Local origin is the exterior door threshold. All rooms fit the rendered shell.
const main = MANOR_SOLIDS.find((solid) => solid.name === 'Main walls')!;
const mainHalf = main.width / 2 - 0.3;
const front = main.z + main.depth / 2 - MANOR_DOOR.z - 0.25;
const back = main.z - main.depth / 2 - MANOR_DOOR.z + 0.3;
export const HOUSE_HALL = {
  x: 0,
  z: (back + front) / 2,
  width: 5,
  depth: front - back,
};
export const HOUSE_FOYER = { x: 0, z: front / 2, width: 2.3, depth: -front };
export const HOUSE_ROOMS = [
  {
    id: 'library',
    name: 'The west staircase',
    x: -(mainHalf + 2.5) / 2,
    z: (front + back) / 2,
    width: mainHalf - 2.5,
    depth: front - back,
    accent: '#c69965',
    detail: 'Follow the timber staircase to the project collection upstairs.',
  },
  {
    id: 'dining',
    name: 'Skills Room',
    x: (mainHalf + 2.5) / 2,
    z: (front + back) / 2,
    width: mainHalf - 2.5,
    depth: front - back,
    accent: '#c48b72',
    detail:
      'Floating skills and experience in a current of golden light. Tap a card to read, or tap the floor to walk.',
  },
  ...[-1, 1].map((side) => {
    const wing = MANOR_SOLIDS.find(
      (solid) => solid.name === 'Wing walls' && Math.sign(solid.x) === side,
    )!;
    const outer = Math.abs(wing.x) + wing.width / 2 - 0.25;
    const inner = Math.abs(wing.x) - wing.width / 2 + 0.05;
    return {
      id: side < 0 ? 'west-gallery' : 'seance',
      name: side < 0 ? 'West skills gallery' : 'East skills gallery',
      x: (side * (outer + inner)) / 2,
      z: wing.z - MANOR_DOOR.z,
      width: outer - inner,
      depth: wing.depth - 0.5,
      accent: side < 0 ? '#9facc7' : '#9ab4a2',
      detail:
        side < 0
          ? 'More floating skills, surrounded by golden light.'
          : 'Explore the collection in the east wing.',
    };
  }),
];
export const HOUSE_FLOORS = [
  HOUSE_HALL,
  HOUSE_FOYER,
  ...HOUSE_ROOMS,
  ...HOUSE_ROOMS.slice(2).map((room) => ({
    x: Math.sign(room.x) * (mainHalf + 0.2),
    z: room.z,
    width: 0.6,
    depth: 1.6,
  })),
];
export const HOUSE_RADIUS = 0.26;
export const DOOR_WIDTH = 1.6;
export type HouseDoor = HousePoint & {
  id: string;
  name: string;
  axis: 'x' | 'z';
  swing: number;
  width: number;
  height: number;
};
export const HOUSE_DOORS: HouseDoor[] = [
  {
    id: 'front',
    name: 'Front door',
    x: MANOR_DOOR.x,
    z: 0,
    axis: 'x',
    swing: 1,
    width: MANOR_DOOR.width,
    height: MANOR_DOOR.height,
  },
  ...HOUSE_ROOMS.map((room, index) => ({
    id: room.id,
    name: room.name,
    x: Math.sign(room.x) * (index < 2 ? 2.5 : mainHalf),
    z: (index < 2 ? -4.8 : room.z) - DOOR_WIDTH / 2,
    axis: 'z' as const,
    swing: Math.sign(room.x),
    width: DOOR_WIDTH,
    height: 2.8,
  })),
  {
    ...HALL_GATE,
    id: 'master-hall',
    name: 'Projects Room door',
    axis: 'z',
    swing: 1,
  },
];
const wall = (
  x: number,
  z: number,
  width: number,
  depth: number,
): HouseSolid => ({ x, z, width, depth, height: 4.8, kind: 'wall' });
function splitWall(x: number, start: number, end: number, doorZ: number) {
  const a = doorZ - DOOR_WIDTH / 2,
    b = doorZ + DOOR_WIDTH / 2;
  return [
    wall(x, (start + a) / 2, 0.2, a - start),
    wall(x, (b + end) / 2, 0.2, end - b),
  ];
}
export const HOUSE_WALLS: HouseSolid[] = [
  ...[
    [-9.05, HALL_GATE.z],
    [HALL_GATE.z + HALL_GATE.width, -1.6],
  ].map(([a, b]) => ({
    ...wall(HALL_GATE.x, (a + b) / 2, 0.18, b - a),
    y: 5,
    height: 4.7,
  })),
  wall(0, back, mainHalf * 2, 0.2),
  ...[-1, 1].flatMap((side) => [
    wall((side * (mainHalf + 1.15)) / 2, front, mainHalf - 1.15, 0.2),
    wall(side * 1.15, front / 2, 0.2, -front),
    ...splitWall(side * 2.5, back, front, -4.8),
    ...splitWall(side * mainHalf, back, front, HOUSE_ROOMS[2].z),
  ]),
  ...HOUSE_ROOMS.slice(2).flatMap((room) => [
    wall(room.x, room.z - room.depth / 2, room.width, 0.2),
    wall(room.x, room.z + room.depth / 2, room.width, 0.2),
    wall(
      room.x + (Math.sign(room.x) * room.width) / 2,
      room.z,
      0.2,
      room.depth,
    ),
  ]),
];
export const HOUSE_FURNITURE: HouseSolid[] = [];
// Low projector, arch plinths, stair supports and door jambs are rendered solids too.
export const HOUSE_FIXTURES: HouseSolid[] = [
  { x: 0, z: -5.5, width: 1.44, depth: 1.44, height: 0.22, kind: 'table' },
  ...[-2.35, 2.35].map((x) => ({
    x,
    z: -2.1,
    width: 0.4,
    depth: 0.4,
    height: 3.2,
    kind: 'wall' as const,
  })),
  ...[-7.7, -5.1].map((x) => ({
    x,
    z: -8.3,
    width: 0.18,
    depth: 0.18,
    height: 2.5,
    kind: 'wall' as const,
  })),
  ...HOUSE_DOORS.filter((door) => door.axis === 'z').flatMap((door) =>
    [0, door.width].map((offset) => ({
      x: door.x,
      z: door.z + offset,
      y: door.y,
      width: 0.3,
      depth: 0.15,
      height: door.height,
      kind: 'wall' as const,
    })),
  ),
];
export function doorSegment(door: HouseDoor, progress: number) {
  const angle =
    ((Math.max(0, Math.min(1, progress)) * Math.PI) / 2) * door.swing;
  const dx = door.axis === 'x' ? door.width : 0;
  const dz = door.axis === 'z' ? door.width : 0;
  return {
    a: { x: door.x, z: door.z },
    b: {
      x: door.x + dx * Math.cos(angle) + dz * Math.sin(angle),
      z: door.z - dx * Math.sin(angle) + dz * Math.cos(angle),
    },
  };
}
function segmentDistance(point: HousePoint, a: HousePoint, b: HousePoint) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz),
    ),
  );
  return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
}
export function createHouseWalker() {
  const position = { x: 0, z: -2.8, y: 0 };
  const doors = HOUSE_DOORS.map((door) => ({
    ...door,
    progress: door.id === 'front' ? 1 : 0,
    target: 0,
    crossed: door.id === 'front',
    side: 0,
    hold: door.id === 'front' ? 0.8 : 0,
  }));
  const side = (door: HouseDoor) =>
    Math.sign(door.axis === 'z' ? position.x - door.x : position.z - door.z);
  let occupants: HousePoint[] = [];
  const overlapsHeight = (point: HousePoint, door: HouseDoor) =>
    (point.y ?? 0) + 1.82 > (door.y ?? 0) &&
    (point.y ?? 0) < (door.y ?? 0) + door.height;
  const safeToClose = (door: HouseDoor) =>
    [position, ...occupants].every(
      (point) =>
        !overlapsHeight(point, door) ||
        Math.hypot(point.x - door.x, point.z - door.z) >
          door.width + HOUSE_RADIUS + 0.45,
    );
  const canStand = (point: HousePoint, ignoreDoors = false) => {
    const height = houseSurface(point, point.y ?? position.y);
    if (height === null) return false;
    const upstairs = height >= UPPER_HALL.y - 0.01;
    if (
      !upstairs &&
      !HOUSE_FLOORS.some(
        (floor) =>
          Math.abs(point.x - floor.x) <= floor.width / 2 &&
          Math.abs(point.z - floor.z) <= floor.depth / 2,
      )
    )
      return false;
    if (
      [...HOUSE_WALLS, ...HOUSE_FURNITURE, ...HOUSE_FIXTURES].some(
        (solid) =>
          height + 1.82 > (solid.y ?? 0) &&
          height < (solid.y ?? 0) + solid.height &&
          Math.abs(point.x - solid.x) < solid.width / 2 + HOUSE_RADIUS &&
          Math.abs(point.z - solid.z) < solid.depth / 2 + HOUSE_RADIUS,
      )
    )
      return false;
    return !doors.some((door) => {
      if (
        height + 1.82 <= (door.y ?? 0) ||
        height >= (door.y ?? 0) + door.height
      )
        return false;
      if (ignoreDoors) {
        if (door.id === 'front') return false;
        // A hypothetical open hall door must not disconnect the staircase.
        // Actual door leaves still block movement until they close behind us.
        if (height > 0.2 && height < UPPER_HALL.y - 0.01) return false;
        return (door.id === 'master-hall' ? [1] : [-1, 1]).some((swing) => {
          const { a, b } = doorSegment({ ...door, swing }, 1);
          return segmentDistance(point, a, b) < HOUSE_RADIUS + 0.12;
        });
      }
      const { a, b } = doorSegment(door, door.progress);
      return segmentDistance(point, a, b) < HOUSE_RADIUS + 0.08;
    });
  };
  return {
    position,
    doors,
    canStand,
    open(id: string) {
      const door = doors.find((door) => door.id === id);
      if (!door) return;
      // Swing away from the visitor on either side of a room's threshold.
      if (door.axis === 'z' && door.progress === 0)
        door.swing = door.id === 'master-hall' ? 1 : -side(door) || door.swing;
      door.target = 1;
      door.crossed = false;
      door.side = side(door);
      door.hold = 0;
    },
    nearestDoor() {
      return doors
        .filter((door) => Math.abs(position.y - (door.y ?? 0)) < 0.2)
        .map((door) => ({
          door,
          distance: Math.hypot(
            position.x - door.x - (door.axis === 'x' ? door.width / 2 : 0),
            position.z - door.z - (door.axis === 'z' ? door.width / 2 : 0),
          ),
        }))
        .filter((item) => item.distance < 2.6)
        .sort((a, b) => a.distance - b.distance)[0]?.door;
    },
    update(dt: number, followers: HousePoint[] = []) {
      occupants = followers;
      for (const door of doors) {
        door.hold = Math.max(0, door.hold - dt);
        if (door.target && side(door) !== door.side && side(door) !== 0)
          door.crossed = true;
        if (door.crossed && !door.hold && safeToClose(door)) door.target = 0;
        // Do not sweep a closing leaf through the traveller.
        if (!door.target && !safeToClose(door)) continue;
        if (door.hold) continue;
        const next =
          door.progress +
          Math.sign(door.target - door.progress) *
            Math.min(
              Math.abs(door.target - door.progress),
              Math.max(0, dt) / 0.85,
            );
        // Check the entire swing, including followers, on this floor only.
        // A slow frame must not let the leaf jump through an occupant.
        const steps = Math.max(
          1,
          Math.ceil(Math.abs(next - door.progress) / 0.02),
        );
        for (let step = 1; step <= steps; step++) {
          const progress =
            door.progress + (next - door.progress) / (steps - step + 1);
          const { a, b } = doorSegment(door, progress);
          if (
            [position, ...occupants].some(
              (point) =>
                overlapsHeight(point, door) &&
                segmentDistance(point, a, b) < HOUSE_RADIUS + 0.08,
            )
          )
            break;
          door.progress = progress;
        }
      }
    },
    move(dx: number, dz: number) {
      if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
      const length = Math.hypot(dx, dz);
      if (length > 10) return;
      const steps = Math.max(1, Math.ceil(length / 0.06));
      for (let i = 0; i < steps; i++) {
        if (canStand({ x: position.x + dx / steps, z: position.z })) {
          position.x += dx / steps;
          position.y = houseSurface(position, position.y)!;
        }
        if (canStand({ x: position.x, z: position.z + dz / steps })) {
          position.z += dz / steps;
          position.y = houseSurface(position, position.y)!;
        }
      }
    },
    room() {
      if (position.y >= UPPER_HALL.y - 0.01)
        return position.x > HALL_GATE.x ? MASTER_HALL : UPPER_HALL;
      if (position.y > 0.2)
        return {
          ...UPPER_HALL,
          id: 'stairs',
          name: 'The west staircase',
          detail: 'Follow the stairs to the Projects Room’s side entrance.',
        };
      return HOUSE_ROOMS.find(
        (room) =>
          Math.abs(position.x - room.x) < room.width / 2 &&
          Math.abs(position.z - room.z) < room.depth / 2,
      );
    },
  };
}

/** Small floor-plan search used by the physical walk back to the front door. */
export function houseRoute(
  start: HousePoint,
  goal: HousePoint,
  canStand: (point: HousePoint) => boolean,
) {
  const step = 0.25;
  const traverse = (a: HousePoint, b: HousePoint) => {
    const count = Math.max(
      1,
      Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.08),
    );
    let height = a.y ?? 0;
    for (let i = 1; i <= count; i++) {
      const point = {
        x: a.x + ((b.x - a.x) * i) / count,
        z: a.z + ((b.z - a.z) * i) / count,
      };
      const next = houseSurface(point, height);
      if (next === null || !canStand({ ...point, y: next })) return null;
      height = next;
    }
    return height;
  };
  const queue = [{ ...start, y: start.y ?? 0, parent: -1 }],
    visited = new Set(['0,0']);
  for (let current = 0; current < queue.length && current < 12000; current++) {
    const point = queue[current];
    if (
      Math.hypot(point.x - goal.x, point.z - goal.z) < 0.4 &&
      Math.abs((traverse(point, goal) ?? Infinity) - (goal.y ?? 0)) < 0.01
    ) {
      const route: HousePoint[] = [goal];
      for (let index = current; index > 0; index = queue[index].parent)
        route.push({ x: queue[index].x, z: queue[index].z, y: queue[index].y });
      route.reverse();
      // Remove grid-shaped detours only when the whole shortcut has safe floor
      // and reaches the same level. Keep actual door and stair clearances.
      const smooth: HousePoint[] = [];
      let anchor = start;
      for (let index = 0; index < route.length;) {
        let next = index;
        for (let candidate = route.length - 1; candidate > index; candidate--) {
          const height = traverse(anchor, route[candidate]);
          if (
            height !== null &&
            Math.abs(height - (route[candidate].y ?? 0)) < 0.01
          ) {
            next = candidate;
            break;
          }
        }
        anchor = route[next];
        smooth.push(anchor);
        index = next + 1;
      }
      return smooth;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = point.x + dx * step,
        z = point.z + dz * step;
      const height = traverse(point, { x, z });
      if (height === null) continue;
      const key = `${Math.round((x - start.x) / step)},${Math.round((z - start.z) / step)},${height.toFixed(3)}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ x, z, y: height, parent: current });
    }
  }
  return null;
}
