/** Local dimensions shared by the manor renderer and collision checks. */
export type ManorSolid = {
  name: string;
  material: 'stone' | 'darkStone' | 'edge' | 'voidMat';
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
};

export const MANOR_SOLIDS: ManorSolid[] = [
  {
    name: 'Main walls',
    material: 'stone',
    x: 0,
    y: 7.82,
    z: -20,
    width: 17.8,
    height: 11.2,
    depth: 8,
  },
  {
    name: 'Main foundation',
    material: 'darkStone',
    x: 0,
    y: 1.53,
    z: -20,
    width: 19,
    height: 3.06,
    depth: 9,
  },
  {
    name: 'Rear terrace',
    material: 'stone',
    x: 0,
    y: 2.04,
    z: -26,
    width: 8,
    height: 0.45,
    depth: 3.8,
  },
  {
    name: 'Rear terrace foundation',
    material: 'darkStone',
    x: 0,
    y: 0.91,
    z: -26,
    width: 8,
    height: 1.82,
    depth: 3.8,
  },
  {
    name: 'Portico upper wall',
    material: 'stone',
    x: 0,
    y: 10.02,
    z: -15.42,
    width: 4.25,
    height: 8,
    depth: 1.3,
  },
  {
    name: 'Entrance recess',
    material: 'voidMat',
    x: 0,
    y: 4.12,
    z: -14.83,
    width: 2.35,
    height: 3.8,
    depth: 0.04,
  },
  ...[-1, 1].flatMap((side): ManorSolid[] => [
    {
      name: 'Portico column',
      material: 'stone',
      x: side * 1.66,
      y: 4.12,
      z: -15.42,
      width: 0.93,
      height: 3.8,
      depth: 1.3,
    },
    {
      name: 'Stair side wall',
      material: 'stone',
      x: side * 3.1,
      y: 1.35,
      z: -13.55,
      width: 0.54,
      height: 2.7,
      depth: 3.55,
    },
    {
      name: 'Stair wall cap',
      material: 'edge',
      x: side * 3.1,
      y: 2.75,
      z: -13.55,
      width: 0.74,
      height: 0.17,
      depth: 3.8,
    },
    {
      name: 'Wing terrace foundation',
      material: 'darkStone',
      x: side * 12.2,
      y: 1.11,
      z: -18.9,
      width: 4.7,
      height: 2.22,
      depth: 7.3,
    },
    {
      name: 'Wing terrace',
      material: 'stone',
      x: side * 12.2,
      y: 2.52,
      z: -18.9,
      width: 4.7,
      height: 0.6,
      depth: 7.3,
    },
    {
      name: 'Wing foundation',
      material: 'darkStone',
      x: side * 10.7,
      y: 1.11,
      z: -22.2,
      width: 3.8,
      height: 2.22,
      depth: 4.9,
    },
    {
      name: 'Wing walls',
      material: 'stone',
      x: side * 10.7,
      y: 6.52,
      z: -22.2,
      width: 3.6,
      height: 8.6,
      depth: 4.7,
    },
  ]),
];

export const MANOR_TOWERS = [
  { x: 8.8, z: -18.8, radius: 2.15, height: 13.4 },
  { x: -8.6, z: -18.7, radius: 1.85, height: 10.8 },
  { x: 3.6, z: -22.7, radius: 1.9, height: 15.1 },
] as const;

export const MANOR_DOOR = {
  x: -1.1,
  y: 2.38,
  z: -14.65,
  width: 2.2,
  height: 3.6,
};

export const MANOR_ENTRY_ARCHES = [
  {
    material: 'edge',
    y: 2.34,
    z: -14.55,
    width: 2.55,
    height: 3.95,
    thickness: 0.17,
  },
  {
    material: 'darkStone',
    y: 2.25,
    z: -14.45,
    width: 3.2,
    height: 4.6,
    thickness: 0.2,
  },
] as const;
export const MANOR_ARCH_DEPTH = 0.18;
export const MANOR_ARCH_BEVEL = 0.025;
