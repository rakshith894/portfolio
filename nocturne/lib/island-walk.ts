import * as THREE from 'three';
import {
  approach,
  cemeteryFences,
  cemeteryTrees,
  cemeteryRocks,
  gatePoint,
  groundHeight,
  onIsland,
  pathDistance,
  perimeterFenceSegments,
  bridgeParapets,
  MANOR_ORIGIN,
} from './reference-layout.ts';
import { stairHeight, stairRails, SHORE_ROUTE, TOWER_ROUTE, BRIDGE_ROUTE, DOCK_HEIGHT } from './island-stairs.ts';
import { MANOR_SOLIDS, MANOR_TOWERS, MANOR_DOOR, MANOR_ENTRY_ARCHES, MANOR_ARCH_DEPTH, MANOR_ARCH_BEVEL } from './manor-layout.ts';
import { islandLamps } from './island-lamps.ts';
import { coastalRocks, stairSupports } from './coastal-layout.ts';
import { clearedSceneryHeight } from './stair-clearance.ts';
import { cemeteryLayout } from './reference-graves.ts';

export const WALK_SPEED = 2.6;
export const RUN_SPEED = 5.2;
export const MAX_STEP_HEIGHT = 0.24;
export const PLAYER_RADIUS = 0.42;
export const HOUSE_APPROACH = approach.getPointAt(1);
export const WATER_ZONE = {
  minX: -18.4 + PLAYER_RADIUS,
  maxX: -13.6 - PLAYER_RADIUS,
  minZ: -47.3 + PLAYER_RADIUS,
  maxZ: -44.7 - PLAYER_RADIUS,
} as const;
const TOWER_TOP = {
  minX: -54.15,
  maxX: -49.85,
  minZ: -33.15,
  maxZ: -28.85,
  height: 36.04,
} as const;
const PERIMETER_FENCES = perimeterFenceSegments();
const HANDRAILS = [SHORE_ROUTE,TOWER_ROUTE,BRIDGE_ROUTE].flatMap(stairRails);
const COASTAL_ROCKS = coastalRocks();
const MANOR_BOUNDS = MANOR_SOLIDS.map(solid => new THREE.Box3(
  new THREE.Vector3(solid.x-solid.width/2,solid.y-solid.height/2,solid.z-solid.depth/2).add(MANOR_ORIGIN),
  new THREE.Vector3(solid.x+solid.width/2,solid.y+solid.height/2,solid.z+solid.depth/2).add(MANOR_ORIGIN),
));
// The closed exterior door is a boundary; entering opens the separate house scene.
MANOR_BOUNDS.push(new THREE.Box3(
  new THREE.Vector3(MANOR_DOOR.x,MANOR_DOOR.y,MANOR_DOOR.z-.04).add(MANOR_ORIGIN),
  new THREE.Vector3(MANOR_DOOR.x+MANOR_DOOR.width,MANOR_DOOR.y+MANOR_DOOR.height,MANOR_DOOR.z+.04).add(MANOR_ORIGIN),
));
// Include the projecting jambs and raised sill of the closed entrance.
for (const frame of MANOR_ENTRY_ARCHES) MANOR_BOUNDS.push(new THREE.Box3(
  new THREE.Vector3(-frame.width/2-MANOR_ARCH_BEVEL,frame.y-MANOR_ARCH_BEVEL,frame.z-MANOR_ARCH_BEVEL).add(MANOR_ORIGIN),
  new THREE.Vector3(frame.width/2+MANOR_ARCH_BEVEL,frame.y+frame.height+MANOR_ARCH_BEVEL,frame.z+MANOR_ARCH_DEPTH+MANOR_ARCH_BEVEL).add(MANOR_ORIGIN),
));
type Segment = [number, number, number, number];

export function gateOpening(x: number, z: number) {
  return THREE.MathUtils.clamp(1-Math.hypot(x-gatePoint.x,z-gatePoint.z)/5,0,1);
}
export function gateLeafSegments(opening: number): Segment[] {
  return [-1,1].map(side => {
    const angle = -side*opening*Math.PI*.42, dx=-side*1.3, dz=-2.12;
    const x=gatePoint.x+side*3, z=gatePoint.z;
    return [x,z,x+dx*Math.cos(angle)+dz*Math.sin(angle),z-dx*Math.sin(angle)+dz*Math.cos(angle)];
  });
}

function segmentDistance(x: number, z: number, [ax, az, bx, bz]: Segment) {
  const dx = bx - ax,
    dz = bz - az;
  const t = THREE.MathUtils.clamp(
    ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz),
    0,
    1,
  );
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}

export function walkingHeight(x: number, z: number) {
  const stairs = stairHeight(x, z);
  if (stairs !== null) return stairs;
  if (
    x >= WATER_ZONE.minX &&
    x <= WATER_ZONE.maxX &&
    z >= WATER_ZONE.minZ &&
    z <= WATER_ZONE.maxZ
  )
    return DOCK_HEIGHT;
  if (x < -12.3 && x > -49.1 && Math.abs(z + 31) < 1.4) return 25.44;
  if (
    x >= TOWER_TOP.minX &&
    x <= TOWER_TOP.maxX &&
    z >= TOWER_TOP.minZ &&
    z <= TOWER_TOP.maxZ
  )
    return TOWER_TOP.height;
  if (Math.hypot(x + 52, (z + 31) / 1.15) < 8.5) return 25.04;
  return groundHeight(x, z) + (pathDistance(x, z) < 2.2 ? 0.23 : 0.04);
}

export function onWalkingSurface(x: number, z: number) {
  if (stairHeight(x, z) !== null) return true;
  if (
    x >= WATER_ZONE.minX &&
    x <= WATER_ZONE.maxX &&
    z >= WATER_ZONE.minZ &&
    z <= WATER_ZONE.maxZ
  )
    return true;
  if (
    x >= -55.2 &&
    x <= -48.8 &&
    z >= -34.2 &&
    z <= -27.8
  )
    return (
      (x >= TOWER_TOP.minX &&
        x <= TOWER_TOP.maxX &&
        z >= TOWER_TOP.minZ &&
        z <= TOWER_TOP.maxZ)
    );
  if (PERIMETER_FENCES.some((segment) => segmentDistance(x, z, segment) < 0.6))
    return false;
  return onIsland(x, z, PLAYER_RADIUS + 0.35) ||
    (x > -49.1 && x < -12.3 && Math.abs(z + 31) < 1.08) ||
    Math.hypot(x + 52, (z + 31) / 1.15) < 8.2;
}

/** Collision bounds use the same cemetery placements as the rendered scene. */
export function createIslandWalker(
  mobile: boolean,
  startAtHouse = false,
  freeRoam = false,
) {
  const graves = cemeteryLayout(mobile);
  const fences: Segment[] = cemeteryFences.flatMap((points) =>
    points
      .slice(1)
      .map(([x, z], i) => [points[i][0], points[i][1], x, z] as Segment),
  );
  const obstacles = cemeteryTrees.map(([x, z, height]) => ({
    x,
    z,
    radius: height * 0.043,
  }));
  for (const [ax, az, bx, bz] of fences) {
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.32);
    for (let i = 0; i <= steps; i++)
      if(i % 16 === 0 || i === steps) obstacles.push({
        x: THREE.MathUtils.lerp(ax, bx, i / steps),
        z: THREE.MathUtils.lerp(az, bz, i / steps),
        radius: 0.44,
      });
  }
  for (const side of [-1, 1]) {
    const x = gatePoint.x + side * 3,
      z = gatePoint.z;
    // The leaves animate open in the viewer; the pillars still protect the
    // perimeter while the central approach remains usable.
    obstacles.push({ x, z, radius: 0.45 });
    obstacles.push({ x: gatePoint.x + side * 4.6, z: z + 1, radius: 0.8 });
  }
  for (const t of [0.08, 0.24, 0.45, 0.64, 0.82, 0.96]) {
    const point = approach.getPointAt(t),
      tangent = approach.getTangentAt(t);
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    for (const side of [-1, 1])
      obstacles.push({
        x: point.x + normal.x * side * 2.65,
        z: point.z + normal.z * side * 2.65,
        radius: 0.3,
      });
  }
  // Query only nearby obstacles during walking and route searches.
  for (const rock of cemeteryRocks())
    obstacles.push({ x: rock.x, z: rock.z, radius: rock.radius });
  function indexNearby<T extends { x: number; z: number }>(items: T[], radius: (item: T) => number) {
    const cells = new Map<string, T[]>();
    for (const item of items) {
      const r = radius(item) + PLAYER_RADIUS;
      for (let x = Math.floor((item.x - r) / 4); x <= Math.floor((item.x + r) / 4); x++)
        for (let z = Math.floor((item.z - r) / 4); z <= Math.floor((item.z + r) / 4); z++) {
          const key = `${x},${z}`;
          const cell = cells.get(key) ?? [];
          cell.push(item); cells.set(key, cell);
        }
    }
    return (x: number, z: number) => cells.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? [];
  }
  const nearbyObstacles = indexNearby(obstacles, obstacle => obstacle.radius);
  const nearbyGraves = indexNearby(graves, grave => Math.hypot(.95, grave.kind === 'chest' ? 2.4 : .65) * grave.scale);
  const cameraBounds: THREE.Box3[] = [];
  cameraBounds.push(...MANOR_BOUNDS);
  for (const tower of MANOR_TOWERS) {
    const radius=tower.radius*1.08;
    cameraBounds.push(new THREE.Box3(
      new THREE.Vector3(tower.x-radius,0,tower.z-radius).add(MANOR_ORIGIN),
      new THREE.Vector3(tower.x+radius,tower.height+2.22,tower.z+radius).add(MANOR_ORIGIN),
    ));
  }
  const cameraBox = (
    x: number,
    z: number,
    width: number,
    depth: number,
    height: number,
  ) => {
    const y = groundHeight(x, z);
    cameraBounds.push(
      new THREE.Box3(
        new THREE.Vector3(x - width, y, z - depth),
        new THREE.Vector3(x + width, y + height, z + depth),
      ),
    );
  };
  for (const grave of graves) {
    const chest = grave.kind === 'chest';
    const center = chest ? 1 * grave.scale : 0;
    const width = (chest ? 1.2 : 1) * grave.scale;
    cameraBox(
      grave.x + Math.sin(grave.turn) * center,
      grave.z + Math.cos(grave.turn) * center,
      width,
      (chest ? 1.6 : 0.8) * grave.scale,
      (chest ? 1.95 : 3.2) * grave.scale,
    );
  }
  for (const [x, z, height] of cemeteryTrees)
    cameraBox(x, z, height * 0.055, height * 0.055, height);
  for (const rock of cemeteryRocks())
    cameraBox(rock.x, rock.z, rock.radius, rock.radius, rock.sy * 1.28);
  cameraBox(-52, -31, 3.3, 3.15, 16);
  for (const rock of COASTAL_ROCKS) cameraBounds.push(new THREE.Box3(
    new THREE.Vector3(rock.x-rock.radius,rock.y-rock.sy*1.28,rock.z-rock.radius),
    new THREE.Vector3(rock.x+rock.radius,rock.y+rock.sy*1.28,rock.z+rock.radius),
  ));
  for (const support of [SHORE_ROUTE,TOWER_ROUTE,BRIDGE_ROUTE].flatMap(stairSupports)) cameraBounds.push(new THREE.Box3(
    new THREE.Vector3(support.x-.17,-1,support.z-.17),
    new THREE.Vector3(support.x+.17,support.y,support.z+.17),
  ));
  const cameraRay = new THREE.Ray(),
    intersection = new THREE.Vector3();
  function constrainCamera(position: THREE.Vector3, target: THREE.Vector3) {
    const length = position.distanceTo(target);
    cameraRay.origin.copy(target);
    cameraRay.direction.copy(position).sub(target).normalize();
    let visibleDistance = length;
    for (const box of cameraBounds) {
      if (box.containsPoint(target)) continue;
      if (cameraRay.intersectBox(box, intersection))
        visibleDistance = Math.min(
          visibleDistance,
          Math.max(1, target.distanceTo(intersection) - 0.22),
        );
    }
    if (visibleDistance < length)
      position
        .copy(target)
        .addScaledVector(cameraRay.direction, visibleDistance);
  }
  const standCache = new Map<string,boolean>();
  function canStand(x: number, z: number) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    const key=`${x.toFixed(5)},${z.toFixed(5)}`;
    const cached=standCache.get(key);
    if (cached !== undefined) return cached;
    const result=canStandUncached(x,z);
    if (standCache.size > 200000) standCache.clear();
    standCache.set(key,result);
    return result;
  }
  function canStandUncached(x: number, z: number) {
    // The house is entered at the steps; the raised interior has its own scene.
    if (!onWalkingSurface(x, z)) return false;
    const y = walkingHeight(x,z);
    if (y < clearedSceneryHeight(x,z,Infinity) && COASTAL_ROCKS.some(rock =>
      y < rock.y+rock.sy*1.28 && y+1.8 > rock.y-rock.sy*1.28 &&
      Math.hypot(x-rock.x,z-rock.z) < rock.radius+PLAYER_RADIUS)) return false;
    if (bridgeParapets.some(rail => Math.abs(y-rail.floor)<1.5 && segmentDistance(x,z,[rail.ax,rail.az,rail.bx,rail.bz])<PLAYER_RADIUS+rail.thickness/2)) return false;
    for (const {a,b} of HANDRAILS) {
      const dx=b[0]-a[0], dz=b[2]-a[2];
      const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[2])*dz)/(dx*dx+dz*dz),0,1);
      const railY=THREE.MathUtils.lerp(a[1],b[1],t);
      if (y < railY+.1 && y+1.8 > railY-1 && segmentDistance(x,z,[a[0],a[2],b[0],b[2]]) < PLAYER_RADIUS+.065) return false;
    }
    if (islandLamps.some(lamp => Math.abs(y-lamp.y)<2 && Math.hypot(x-lamp.x,z-lamp.z)<PLAYER_RADIUS+.13)) return false;
    for (const bounds of MANOR_BOUNDS) {
      if (y >= bounds.max.y || y+1.8 <= bounds.min.y) continue;
      const dx=Math.max(bounds.min.x-x,0,x-bounds.max.x);
      const dz=Math.max(bounds.min.z-z,0,z-bounds.max.z);
      if (dx*dx+dz*dz < PLAYER_RADIUS*PLAYER_RADIUS) return false;
    }
    for (const tower of MANOR_TOWERS) {
      if (y < MANOR_ORIGIN.y+tower.height+2.22 && y+1.8 > MANOR_ORIGIN.y &&
        Math.hypot(x-MANOR_ORIGIN.x-tower.x,z-MANOR_ORIGIN.z-tower.z) < tower.radius*1.08+PLAYER_RADIUS) return false;
    }
    if (gateLeafSegments(gateOpening(x,z)).some(segment => segmentDistance(x,z,segment)<PLAYER_RADIUS+.055)) return false;
    if (
      fences.some(
        (segment) => Math.abs(y-groundHeight(x,z))<2.8 && segmentDistance(x, z, segment) < PLAYER_RADIUS + 0.09,
      )
    )
      return false;
    if (
      nearbyObstacles(x, z).some(
        (obstacle) =>
          Math.abs(y-groundHeight(obstacle.x,obstacle.z))<3 && Math.hypot(x - obstacle.x, z - obstacle.z) <
          obstacle.radius + PLAYER_RADIUS,
      )
    )
      return false;
    for (const grave of nearbyGraves(x, z)) {
      if (Math.abs(y-groundHeight(grave.x,grave.z))>3.5) continue;
      const dx = x - grave.x,
        dz = z - grave.z;
      const localX = dx * Math.cos(grave.turn) - dz * Math.sin(grave.turn);
      const localZ = dx * Math.sin(grave.turn) + dz * Math.cos(grave.turn);
      const halfWidth = (grave.kind === 'cross' ? 0.95 : 0.8) * grave.scale;
      const minZ = -0.65 * grave.scale;
      const maxZ = (grave.kind === 'chest' ? 2.4 : 0.65) * grave.scale;
      const outsideX = Math.max(Math.abs(localX) - halfWidth, 0);
      const outsideZ = Math.max(minZ - localZ, localZ - maxZ, 0);
      if (Math.hypot(outsideX, outsideZ) < PLAYER_RADIUS) return false;
    }
    return true;
  }
  const heightCache = new Map<string,number>();
  function cachedHeight(x: number,z: number) {
    const key=`${x.toFixed(5)},${z.toFixed(5)}`;
    let height=heightCache.get(key);
    if(height===undefined) {
      height=walkingHeight(x,z);
      if(heightCache.size>80000)heightCache.clear();
      heightCache.set(key,height);
    }
    return height;
  }
  function canTraverse(ax: number, az: number, bx: number, bz: number) {
    if (![ax,az,bx,bz].every(Number.isFinite)) return false;
    // Sweep long queries too: route shortcuts must never jump through thin barriers.
    const steps=Math.max(1,Math.ceil(Math.hypot(bx-ax,bz-az)/.08));
    let previousHeight=cachedHeight(ax,az);
    for(let i=1;i<=steps;i++) {
      const x=THREE.MathUtils.lerp(ax,bx,i/steps), z=THREE.MathUtils.lerp(az,bz,i/steps);
      if (!(freeRoam ? onWalkingSurface(x,z) : canStand(x,z))) return false;
      const height=cachedHeight(x,z);
      if(Math.abs(height-previousHeight)>MAX_STEP_HEIGHT) return false;
      previousHeight=height;
    }
    return true;
  }
  const position = approach.getPointAt(startAtHouse ? 0.96 : 0);
  position.y = walkingHeight(position.x, position.z);
  const tangent = approach.getTangentAt(startAtHouse ? 0.96 : 0);
  let heading =
    Math.atan2(-tangent.x, -tangent.z) + (startAtHouse ? Math.PI : 0);
  let distance = 0;
  function move(
    direction: THREE.Vector3,
    delta: number,
    running = false,
    speedMultiplier = 1,
  ) {
    const length = Math.hypot(direction.x, direction.z);
    if (![length,delta,speedMultiplier].every(Number.isFinite) || length < 1e-5 || delta <= 0 || speedMultiplier <= 0) return 0;
    const travel =
      Math.min(delta, 0.05) *
      (running ? RUN_SPEED : WALK_SPEED) *
      speedMultiplier *
      Math.min(length, 1);
    const dx = (direction.x / length) * travel,
      dz = (direction.z / length) * travel;
    const steps = Math.max(1, Math.ceil(travel / 0.08));
    const from = position.clone();
    for (let step = 0; step < steps; step++) {
      const x = position.x + dx / steps,
        z = position.z + dz / steps;
      const canMove = canTraverse(position.x, position.z, x, z);
      if (canMove) position.set(x, position.y, z);
      else if (canTraverse(position.x, position.z, x, position.z))
        position.x = x;
      else if (canTraverse(position.x, position.z, position.x, z))
        position.z = z;
    }
    const moved = Math.hypot(position.x - from.x, position.z - from.z);
    if (moved > 1e-5)
      heading = Math.atan2(from.x - position.x, from.z - position.z);
    position.y = walkingHeight(position.x, position.z);
    distance += moved;
    return moved;
  }
  return {
    position,
    move,
    canStand,
    canTraverse,
    constrainCamera,
    get heading() {
      return heading;
    },
    get distance() {
      return distance;
    },
    get nearHouse() {
      return (
        Math.hypot(
          position.x - HOUSE_APPROACH.x,
          position.z - HOUSE_APPROACH.z,
        ) < 3.9
      );
    },
  };
}

export function walkingDirection(
  forward: number,
  side: number,
  camera: THREE.Vector3,
  player: THREE.Vector3,
) {
  const ahead = new THREE.Vector3(
    player.x - camera.x,
    0,
    player.z - camera.z,
  ).normalize();
  const right = new THREE.Vector3(-ahead.z, 0, ahead.x);
  return ahead
    .multiplyScalar(forward)
    .addScaledVector(right, side)
    .clampLength(0, 1);
}
