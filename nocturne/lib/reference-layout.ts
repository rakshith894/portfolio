import * as THREE from 'three';
import { SHORE_ROUTE, sampleStairRoute } from './island-stairs.ts';

export const MANOR_ORIGIN = new THREE.Vector3(10, 25, -10);
export const REFERENCE_VIEWS = {
  aerial: {
    position: new THREE.Vector3(50, 29, 90),
    target: new THREE.Vector3(-6, 10, -6),
  },
  front: {
    position: new THREE.Vector3(26, 18.5, 31),
    target: new THREE.Vector3(10, 29, -23),
  },
  gate: {
    position: new THREE.Vector3(25, 23, 17),
    target: new THREE.Vector3(11, 33, -27),
  },
  house: {
    position: new THREE.Vector3(25, 32, -8),
    target: new THREE.Vector3(10, 36, -30),
  },
  rear: {
    position: new THREE.Vector3(48, 42, -64),
    target: new THREE.Vector3(7, 34, -29),
  },
} as const;
export type ReferenceView = keyof typeof REFERENCE_VIEWS;

export function referenceCameraPose(
  view: ReferenceView,
  aspect: number,
  fov = 41,
) {
  const preset = REFERENCE_VIEWS[view];
  const position = preset.position.clone();
  if (view === 'aerial') {
    const halfFov = Math.atan(
      Math.tan(THREE.MathUtils.degToRad(fov / 2)) * Math.min(1, aspect),
    );
    position
      .sub(preset.target)
      .setLength(58 / Math.sin(halfFov))
      .add(preset.target);
  }
  if (onIsland(position.x, position.z)) {
    position.y = Math.max(
      position.y,
      groundHeight(position.x, position.z) + 1.8,
    );
  }
  return { position, target: preset.target.clone() };
}

export function coastRadius(angle: number) {
  return (
    31.5 +
    Math.sin(angle * 3 + 0.6) * 4.1 +
    Math.cos(angle * 5 - 0.4) * 2.4 +
    Math.sin(angle * 9) * 1.25 +
    Math.cos(angle * 17) * 0.48
  );
}
export function coastPoint(angle: number, fraction = 1) {
  const radius = coastRadius(angle) * fraction;
  return new THREE.Vector2(
    7 + Math.cos(angle) * radius,
    -6 + Math.sin(angle) * radius * 1.38,
  );
}
export function onIsland(x: number, z: number, margin = 0) {
  const px = x - 7,
    pz = (z + 6) / 1.38;
  return Math.hypot(px, pz) < coastRadius(Math.atan2(pz, px)) - margin;
}
export function groundHeight(x: number, z: number) {
  const climb = THREE.MathUtils.smoothstep(34 - z, 0, 55);
  const ridge = Math.sin(x * 0.18 + z * 0.07) * 0.5 + Math.sin(z * 0.26) * 0.22;
  const plateau = 1 - THREE.MathUtils.smoothstep(z, -23, -17);
  let h =
    (12 + 13 * climb + ridge * Math.sin(climb * Math.PI)) * (1 - plateau) +
    25 * plateau;
  const shore = sampleStairRoute(SHORE_ROUTE, x, z, 2.1);
  if (shore) {
    const blend = 1-THREE.MathUtils.smoothstep(shore.distance, 1.1, 2.1);
    h = THREE.MathUtils.lerp(h, Math.min(h, shore.height-.3), blend);
  }
  return h;
}
export const approach = new THREE.CatmullRomCurve3(
  [
    [9, 34],
    [15, 27],
    [21, 19],
    [20, 12],
    [17, 7],
    [12, -1],
    [14, -10],
    [10, -20.8],
  ].map(([x, z]) => new THREE.Vector3(x, groundHeight(x, z) + 0.1, z)),
  false,
  'centripetal',
);
export const gatePoint = new THREE.Vector3(17, groundHeight(17, 7), 7);
export const cemeteryFences: [number, number][][] = [
  [
    [-13, 20],
    [-4, 20],
    [5, 16],
    [14, 7],
  ],
  [
    [20, 7],
    [28, 5],
    [29, -9],
    [28, -12],
  ],
  // A three-metre opening leads around the right side of the manor.
  [[27, -15], [26, -18], [26, -25.3], [24.6, -25.3]],
  [
    [-13, 20],
    [-17, 6],
    [-17, -9],
    [-17, -23],
    [-12, -23.92],
  ],
  // Leave a three-metre passage to the backyard and the bridge approach.
  [
    [-9, -24.48],
    [-4.55, -25.3],
  ],
];
export const HOUSE_SIDE_PASSAGE = { x: 27.5, z: -13.5 };
export const bridgeParapets = [-1,1].map(side => ({
  ax: side < 0 ? -44.8 : -47.1, az: -31+side*1.48, bx: side < 0 ? -17.2 : -16.1, bz: -31+side*1.48,
  floor: 25.4, thickness: .34,
}));
export function distanceToSegment(x:number,z:number,ax:number,az:number,bx:number,bz:number) {
  const dx=bx-ax,dz=bz-az;
  const t=THREE.MathUtils.clamp(((x-ax)*dx+(z-az)*dz)/Math.max(1e-12,dx*dx+dz*dz),0,1);
  return Math.hypot(x-ax-dx*t,z-az-dz*t);
}
export const cemeteryTrees: [number, number, number][] = [
  [-10, 10, 12],
  [29, 14, 13],
  [-13, -10, 11],
  [29, -19, 15],
  [-4, -23, 12],
  [23, -40, 13],
  [4, 26, 8],
  [-10.8, -34, 10],
];
export const routeSamples = approach.getSpacedPoints(180);
export function pathDistance(x: number, z: number) {
  let nearest = Infinity;
  for (const point of routeSamples)
    nearest = Math.min(nearest, Math.hypot(point.x - x, point.z - z));
  return nearest;
}

export function perimeterFenceSegments() {
  const segments: [number, number, number, number][] = [];
  const count = 72;
  const points = Array.from({ length: count }, (_, i) => {
    const point = coastPoint((i / count) * Math.PI * 2, 0.965);
    return [point.x, point.y] as const;
  });
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    const [ax, az] = points[i],
      [bx, bz] = points[next],
      midpointX = (ax + bx) / 2,
      midpointZ = (az + bz) / 2;
    if (
      cemeteryFences.some(points => points.slice(1).some(([x,z],j) => distanceToSegment(midpointX,midpointZ,points[j][0],points[j][1],x,z)<1.8)) ||
      Math.hypot(midpointX - gatePoint.x, midpointZ - gatePoint.z) < 4.8 ||
      pathDistance(midpointX, midpointZ) < 14 ||
      (midpointX < -10 &&
        midpointX > -50 &&
        Math.abs(midpointZ + 31) < 8) ||
      ([az, bz].some((z) => Math.abs(z + 31) < 8) &&
        [ax, bx].some((x) => x < -10 && x > -50))
    )
      continue;
    segments.push([ax, az, bx, bz]);
  }
  return segments;
}

/** Shared scatter keeps visible boulders and walking collisions in agreement. */
export function cemeteryRocks() {
  let seed = 7814;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const rocks: {
    x: number;
    z: number;
    sx: number;
    sy: number;
    sz: number;
    turn: number;
    radius: number;
  }[] = [];
  for (let i = 0; i < 230; i++) {
    const x = -20 + random() * 57,
      z = -18 + random() * 52;
    const sx = 0.25 + random() * 1.3,
      sy = 0.12 + random() * 0.6,
      sz = 0.3 + random() * 1.1;
    const turn = random() * 6,
      radius = Math.max(sx, sz) * 1.28;
    if (!onIsland(x, z, 1) || pathDistance(x, z) < 2.6 + radius) continue;
    if(distanceToSegment(x,z,23,-13.5,32,-13.5)<radius+1.1)continue;
    if(cemeteryFences.some(points=>points.slice(1).some(([bx,bz],j)=>distanceToSegment(x,z,...points[j],bx,bz)<radius+.5)))continue;
    rocks.push({ x, z, sx, sy, sz, turn, radius });
  }
  return rocks;
}

/** Coastline shared by terrain, scans and the water's foam shader. */
export const referenceCoastGLSL = `
vec2 coastPoint=vec2(oceanPosition.x-7.,(oceanPosition.z+6.)/1.38);
float angle=atan(coastPoint.y,coastPoint.x);
float coast=31.5+sin(angle*3.+.6)*4.1+cos(angle*5.-.4)*2.4+sin(angle*9.)*1.25+cos(angle*17.)*.48;
float mainDistance=length(coastPoint)-coast;
float towerDistance=length((oceanPosition.xz-vec2(-52.,-31.))/vec2(1.,1.15))-9.;
float distanceToCliff=min(mainDistance,towerDistance);`;
