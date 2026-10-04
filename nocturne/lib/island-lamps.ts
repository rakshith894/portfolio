import {
  groundHeight,
  MANOR_ORIGIN,
  pathDistance,
} from './reference-layout.ts';
import { MANOR_SOLIDS, MANOR_TOWERS } from './manor-layout.ts';
import { SHORE_ROUTE, TOWER_ROUTE, stairTreads } from './island-stairs.ts';

/** Shared placement keeps lamp posts solid as well as visible. */
export const islandLamps = [
  ...[
    [-8, 14],
    [-12, -3],
    [24, -12],
    [24, -23],
    [8, -40],
    [-6, -39],
    [-2, 17],
    [7, 7],
    [2, -9],
    [-7, -25],
    [22, -31],
    [15, -40],
    [28, -4],
  ]
    .filter(([x, z]) => {
      const localX = x - MANOR_ORIGIN.x,
        localZ = z - MANOR_ORIGIN.z;
      return (
        !MANOR_SOLIDS.some(
          (solid) =>
            Math.abs(localX - solid.x) < solid.width / 2 + 0.4 &&
            Math.abs(localZ - solid.z) < solid.depth / 2 + 0.4,
        ) &&
        !MANOR_TOWERS.some(
          (tower) =>
            Math.hypot(localX - tower.x, localZ - tower.z) < tower.radius + 0.4,
        )
      );
    })
    .map(([x, z]) => ({
      x,
      y: groundHeight(x, z) + (pathDistance(x, z) < 1.8 ? 0.18 : 0),
      z,
    })),
  ...[-20, -31, -42].map((x) => ({ x, y: 25.4, z: -30.22 })),
  ...[SHORE_ROUTE, TOWER_ROUTE].flatMap((route) =>
    route
      .filter((_, i) => i >= 2 && i % 2 === 0)
      .map(([x, y, z]) => ({
        x: x + 0.7,
        y,
        z: z + 0.7,
      })),
  ),
  ...[SHORE_ROUTE, TOWER_ROUTE].flatMap((route) =>
    route.slice(1).flatMap((b, i) => {
      const a = route[i],
        dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz);
      const midpointX = (a[0] + b[0]) / 2;
      const midpointZ = (a[2] + b[2]) / 2;
      const tread = stairTreads(route).reduce((nearest, step) =>
        Math.hypot(step.x - midpointX, step.z - midpointZ) <
        Math.hypot(nearest.x - midpointX, nearest.z - midpointZ)
          ? step
          : nearest,
      );
      const x = tread.x - (dz / length) * 0.78;
      const z = tread.z + (dx / length) * 0.78;
      return length < 8
        ? []
        : [
            {
              x,
              y: tread.y,
              z,
            },
          ];
    }),
  ),
];
