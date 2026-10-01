/** One layout drives both the visible treads and the walkable height. Units are metres. */
export type StairPoint = readonly [number, number, number];
export const DOCK_HEIGHT = 2.2;
export const SHORE_ROUTE: readonly StairPoint[] = [
  [-14.3, 25.44, -31],
  [-16, 25.44, -31],
  [-16, 25.44, -34],
  [-29, 19.4175, -34],
  [-29, 19.4175, -37.4],
  [-16, 13.395, -37.4],
  [-16, 13.395, -40.8],
  [-29, 7.3725, -40.8],
  [-29, 7.3725, -44.2],
  [-16, DOCK_HEIGHT, -44.2],
  [-16, DOCK_HEIGHT, -46],
];
export const TOWER_ROUTE: readonly StairPoint[] = [
  [-47.7, 25.44, -31],
  [-46, 25.44, -31],
  [-46, 31.14, -46],
  [-52, 31.14, -46],
  [-52, 36.04, -34.9],
  [-52, 36.04, -31],
];
export const MANOR_ROUTE: readonly StairPoint[] = [
  [10, 25.23, -20.8],
  [10, 27.32, -24.6],
];
export const BRIDGE_ROUTE: readonly StairPoint[] = [
  [-9, 25.04, -31],
  [-14.3, 25.44, -31],
];
export const VIADUCT_ROUTE: readonly StairPoint[] = [
  BRIDGE_ROUTE[1],
  TOWER_ROUTE[0],
];
export const BOAT_DOCK = { x: -16, z: -46 };
export const BOAT_MOORING = { x: -16, z: -48 };
export const STAIR_WIDTH = 2.2;
export const STAIR_ROUTES = [
  SHORE_ROUTE,
  TOWER_ROUTE,
  MANOR_ROUTE,
  BRIDGE_ROUTE,
] as const;

/** The renderer and walker use these exact handrail segments. */
export function stairRails(route: readonly StairPoint[]) {
  const rails: { a: StairPoint; b: StairPoint }[] = [];
  // Branch rails begin outside the bridge deck so the viaduct remains open.
  const points: readonly StairPoint[] =
    route === SHORE_ROUTE
      ? [[-16, 25.44, -32.15], ...route.slice(2)]
      : route === TOWER_ROUTE
        ? [[-46, 25.44, -32.15], ...route.slice(2)]
        : route;
  const directions = points.slice(1).map((b, i) => {
    const a = points[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = Math.hypot(dx, dz);
    return { x: dx / length, z: dz / length };
  });
  for (const side of [-1, 1]) {
    // A shared miter at each turn joins the rails around the landing corners.
    const edge = points.map(([x, y, z], i): StairPoint => {
      const before = directions[Math.max(0, i - 1)],
        after = directions[Math.min(i, directions.length - 1)];
      const scale =
        ((STAIR_WIDTH / 2 - 0.05) * side) /
        (1 + before.x * after.x + before.z * after.z);
      return [
        x - (before.z + after.z) * scale,
        y + 1,
        z + (before.x + after.x) * scale,
      ];
    });
    for (let i = 1; i < edge.length; i++) {
      rails.push({ a: edge[i - 1], b: edge[i] });
    }
  }
  return rails;
}

export function sampleStairRoute(
  route: readonly StairPoint[],
  x: number,
  z: number,
  halfWidth = STAIR_WIDTH / 2,
) {
  // Manor landings are only 24 cm deep. A circular end cap would extend the
  // walkable stair surface metres beyond the doorway and into the house.
  if (
    route === MANOR_ROUTE &&
    (z < route[1][2] - 0.12 || z > route[0][2] + 0.12)
  )
    return null;
  let nearest: { height: number; distance: number } | null = null;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2];
    const t = Math.max(
      0,
      Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)),
    );
    const distance = Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t);
    if (distance > halfWidth || (nearest && distance >= nearest.distance))
      continue;
    const count = Math.max(1, Math.ceil(Math.abs(b[1] - a[1]) / 0.18));
    const length = Math.hypot(dx, dz),
      landing = route === MANOR_ROUTE ? 0.12 : STAIR_WIDTH / 2;
    const progress = Math.max(
      0,
      Math.min(
        1,
        (t * length - landing) / Math.max(0.01, length - 2 * landing),
      ),
    );
    const height =
      a[1] + ((b[1] - a[1]) * Math.floor(progress * count)) / count;
    nearest = { height, distance };
  }
  return nearest;
}

export function stairHeight(x: number, z: number) {
  for (const route of STAIR_ROUTES) {
    const sample = sampleStairRoute(
      route,
      x,
      z,
      route === MANOR_ROUTE ? 2.3 : STAIR_WIDTH / 2,
    );
    if (sample) return sample.height;
  }
  return null;
}

export function stairTreads(route: readonly StairPoint[]) {
  const treads: {
    x: number;
    y: number;
    z: number;
    width: number;
    depth: number;
    angle: number;
  }[] = [];
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1],
      b = route[i],
      dx = b[0] - a[0],
      dz = b[2] - a[2],
      length = Math.hypot(dx, dz);
    const sloped = Math.abs(b[1] - a[1]) >= 0.001;
    const count = sloped ? Math.ceil(Math.abs(b[1] - a[1]) / 0.18) : 1;
    const landing = sloped
      ? route === MANOR_ROUTE
        ? 0.12
        : STAIR_WIDTH / 2
      : 0;
    const run = length - 2 * landing;
    for (let j = 0; j < count; j++)
      treads.push({
        x: a[0] + (dx * (landing + (run * (j + 0.5)) / count)) / length,
        y: a[1] + ((b[1] - a[1]) * j) / count,
        z: a[2] + (dz * (landing + (run * (j + 0.5)) / count)) / length,
        width: route === MANOR_ROUTE ? 5.1 : STAIR_WIDTH,
        depth: run / count + 0.025,
        angle: Math.atan2(dx, dz),
      });
  }
  // Level turn landings close the outside corners of each flight.
  for (const [x, y, z] of route)
    treads.push({
      x,
      y,
      z,
      width: route === MANOR_ROUTE ? 5.1 : STAIR_WIDTH,
      depth: route === MANOR_ROUTE ? 0.24 : STAIR_WIDTH,
      angle: 0,
    });
  return treads;
}
