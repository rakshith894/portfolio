import { groundHeight } from './reference-layout.ts';
import { SHORE_ROUTE, TOWER_ROUTE, STAIR_WIDTH } from './island-stairs.ts';

/** Shared placement keeps lamp posts solid as well as visible. */
export const islandLamps = [
  ...[
    [-8, 14],
    [-12, -3],
    [24, -12],
    [28, -29],
    [8, -40],
    [-6, -39],
    [-2, 17],
    [7, 7],
    [2, -9],
    [-7, -25],
    [22, -31],
    [15, -40],
    [28, -4],
  ].map(([x, z]) => ({ x, y: groundHeight(x, z), z })),
  ...[-20, -31, -42].map((x) => ({ x, y: 25.44, z: -30.1 })),
  ...[SHORE_ROUTE, TOWER_ROUTE].flatMap((route) =>
    route
      .filter((_, i) => i >= 2 && i % 2 === 0)
      .map(([x, y, z]) => ({
        x: x + STAIR_WIDTH / 2 + 0.18,
        y,
        z: z + STAIR_WIDTH / 2 + 0.18,
      })),
  ),
  ...[SHORE_ROUTE, TOWER_ROUTE].flatMap((route) =>
    route.slice(1).flatMap((b, i) => {
      const a = route[i],
        dx = b[0] - a[0],
        dz = b[2] - a[2],
        length = Math.hypot(dx, dz);
      return length < 8
        ? []
        : [
            {
              x: (a[0] + b[0]) / 2 - (dz / length) * 1.48,
              y: (a[1] + b[1]) / 2,
              z: (a[2] + b[2]) / 2 + (dx / length) * 1.48,
            },
          ];
    }),
  ),
];
