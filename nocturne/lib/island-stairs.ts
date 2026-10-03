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
    route === SHORE_ROUTE || route === TOWER_ROUTE ? route.slice(1) : route;
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
      const a = points[i - 1],
        b = points[i];
      if (Math.abs(b[1] - a[1]) < 0.001) {
        rails.push({ a: edge[i - 1], b: edge[i] });
        continue;
      }
      const direction = directions[i - 1];
      const landing = route === MANOR_ROUTE ? 0.12 : STAIR_WIDTH / 2;
      const offset = (STAIR_WIDTH / 2 - 0.05) * side;
      const start: StairPoint = [
        a[0] + direction.x * landing - direction.z * offset,
        a[1] + 1,
        a[2] + direction.z * landing + direction.x * offset,
      ];
      const end: StairPoint = [
        b[0] - direction.x * landing - direction.z * offset,
        b[1] + 1,
        b[2] - direction.z * landing + direction.x * offset,
      ];
      rails.push(
        { a: edge[i - 1], b: start },
        { a: start, b: end },
        { a: end, b: edge[i] },
      );
    }
  }
  if (route === SHORE_ROUTE || route === TOWER_ROUTE) {
    const openingZ = -32.05;
    return rails.flatMap(({ a, b }) => {
      if (Math.abs(a[1] - 26.44) > 1e-6 || Math.abs(b[1] - 26.44) > 1e-6)
        return [{ a, b }];
      if (a[2] > openingZ && b[2] > openingZ) return [];
      const clip = (from: StairPoint, to: StairPoint): StairPoint => {
        const t = (openingZ - from[2]) / (to[2] - from[2]);
        return [from[0] + (to[0] - from[0]) * t, from[1], openingZ];
      };
      return [
        {
          a: a[2] > openingZ ? clip(a, b) : a,
          b: b[2] > openingZ ? clip(b, a) : b,
        },
      ];
    });
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
        depth: run / count,
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
  // Partition coplanar landing/connector rectangles instead of stacking their
  // top faces. Short switchback connectors are already covered by the landings.
  const disjoint: typeof treads = [];
  for (const tread of treads.reverse()) {
    const alongX = Math.abs(Math.sin(tread.angle)) > 0.5;
    const width = alongX ? tread.depth : tread.width;
    const depth = alongX ? tread.width : tread.depth;
    let pieces = [
      {
        left: tread.x - width / 2,
        right: tread.x + width / 2,
        back: tread.z - depth / 2,
        front: tread.z + depth / 2,
      },
    ];
    for (const placed of disjoint) {
      if (Math.abs(placed.y - tread.y) > 1e-6) continue;
      const rotated = Math.abs(Math.sin(placed.angle)) > 0.5;
      const w = rotated ? placed.depth : placed.width;
      const d = rotated ? placed.width : placed.depth;
      const left = placed.x - w / 2,
        right = placed.x + w / 2;
      const back = placed.z - d / 2,
        front = placed.z + d / 2;
      pieces = pieces.flatMap((p) => {
        const l = Math.max(p.left, left),
          r = Math.min(p.right, right);
        const b = Math.max(p.back, back),
          f = Math.min(p.front, front);
        if (r - l < 1e-7 || f - b < 1e-7) return [p];
        return [
          { ...p, right: l },
          { ...p, left: r },
          { left: l, right: r, back: p.back, front: b },
          { left: l, right: r, back: f, front: p.front },
        ].filter(
          (part) =>
            part.right - part.left > 1e-7 && part.front - part.back > 1e-7,
        );
      });
    }
    for (const p of pieces)
      disjoint.push({
        ...tread,
        x: (p.left + p.right) / 2,
        z: (p.back + p.front) / 2,
        width: alongX ? p.front - p.back : p.right - p.left,
        depth: alongX ? p.right - p.left : p.front - p.back,
      });
  }
  return disjoint.reverse();
}
