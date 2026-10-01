import {
  coastPoint,
  distanceToSegment,
  groundHeight,
  pathDistance,
} from './reference-layout.ts';
import {
  BOAT_MOORING,
  SHORE_ROUTE,
  TOWER_ROUTE,
  BRIDGE_ROUTE,
  stairTreads,
} from './island-stairs.ts';

export type CoastalRock = {
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  turn: number;
  tilt: number;
  radius: number;
};

// A separate seed keeps rendered rocks and sailing obstacles identical, even
// when mobile omits some of the decorative coastline stones.
export function coastalRocks(mobile = false) {
  let seed = 1942;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const rocks: CoastalRock[] = [];
  for (let i = 0; i < 144; i++) {
    const offshore = i >= 110;
    const angle = random() * Math.PI * 2;
    const point = coastPoint(
      angle,
      offshore ? 1.18 + random() * 0.6 : 0.97 + random() * 0.08,
    );
    const sy = offshore ? 2 + random() * 7 : 4 + random() * 10;
    const sx = offshore ? 0.8 + random() * 2.5 : 2 + random() * 3;
    const sz = offshore ? 0.8 + random() * 2.1 : 1.5 + random() * 2.4;
    const turn = random() * 6,
      tilt = offshore ? 0.1 : (random() - 0.5) * 0.15;
    const radius = (Math.max(sx, sz) + sy * Math.abs(Math.sin(tilt))) * 1.28;
    if (mobile && !offshore && i >= 65) continue;
    if (offshore && Math.hypot(point.x + 52, point.y + 31) < 13) continue;
    if (
      !offshore &&
      (pathDistance(point.x, point.y) < radius + 3 ||
        distanceToSegment(point.x, point.y, 23, -13.5, 32, -13.5) <
          radius + 1.1)
    )
      continue;
    // Keep an unobstructed departure channel beyond the landing.
    if (
      distanceToSegment(
        point.x,
        point.y,
        BOAT_MOORING.x,
        BOAT_MOORING.z,
        -16,
        -85,
      ) <
      radius + 3.2
    )
      continue;
    rocks.push({
      x: point.x,
      y: offshore ? -2.5 : groundHeight(point.x, point.y) - sy * 1.08,
      z: point.y,
      sx,
      sy,
      sz,
      turn,
      tilt,
      radius,
    });
  }
  return rocks;
}

export function stairSupports(route: typeof SHORE_ROUTE) {
  return stairTreads(route).filter(
    (step, index) =>
      index % 9 === 0 &&
      Math.hypot(step.x - BOAT_MOORING.x, step.z - BOAT_MOORING.z) > 4,
  );
}

export const SEA_OBSTACLES = [
  ...coastalRocks().map(({ x, z, radius }) => ({ x, z, radius })),
  ...[SHORE_ROUTE, TOWER_ROUTE, BRIDGE_ROUTE]
    .flatMap(stairSupports)
    .map(({ x, z }) => ({ x, z, radius: 0.25 })),
];
