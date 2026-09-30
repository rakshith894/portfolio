import * as THREE from 'three';
import { HOUSE_FLOORS, HOUSE_HALL } from './house-layout.ts';
import { MANOR_DOOR } from './manor-layout.ts';
import { UPPER_HALL } from './house-stairs.ts';
import { HOUSE_WINDOWS } from './house-windows.ts';

// Cut usable interior air out of the exterior masonry, including intruding
// tower faces and trim. The indoor walls/floor/ceiling line these openings.
const volumes = [
  { ...HOUSE_HALL, width: 17.2 },
  ...HOUSE_FLOORS.slice(1).filter(
    (floor) => Math.abs(floor.x) < 1 || Math.abs(floor.x) > 8.6,
  ),
].map(
  (floor) =>
    new THREE.Box3(
      new THREE.Vector3(
        floor.x - floor.width / 2,
        MANOR_DOOR.y - 0.2,
        MANOR_DOOR.z + floor.z - floor.depth / 2,
      ),
      new THREE.Vector3(
        floor.x + floor.width / 2,
        MANOR_DOOR.y + 4.9,
        MANOR_DOOR.z + floor.z + floor.depth / 2 + 0.001,
      ),
    ),
);
volumes.push(new THREE.Box3(
  new THREE.Vector3(-UPPER_HALL.width / 2, MANOR_DOOR.y + 4.8, MANOR_DOOR.z + UPPER_HALL.z - UPPER_HALL.depth / 2),
  new THREE.Vector3(UPPER_HALL.width / 2, MANOR_DOOR.y + UPPER_HALL.y + UPPER_HALL.height, MANOR_DOOR.z + UPPER_HALL.z + UPPER_HALL.depth / 2),
));

type Vertex = { point: THREE.Vector3; normal: THREE.Vector3 };
for (const window of HOUSE_WINDOWS) {
  const center = new THREE.Vector3(window.x, MANOR_DOOR.y + window.y, MANOR_DOOR.z + window.z);
  const size = new THREE.Vector3(window.axis === 'x' ? window.width : 1.5, window.height, window.axis === 'z' ? window.width : 1.5);
  volumes.push(new THREE.Box3().setFromCenterAndSize(center, size));
}
function split(
  polygon: Vertex[],
  axis: 'x' | 'y' | 'z',
  value: number,
  sign: number,
) {
  const inside: Vertex[] = [],
    outside: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const da = sign * (a.point[axis] - value),
      db = sign * (b.point[axis] - value);
    (da >= 0 ? inside : outside).push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      const edge = {
        point: a.point.clone().lerp(b.point, t),
        normal: a.normal.clone().lerp(b.normal, t).normalize(),
      };
      inside.push(edge);
      outside.push(edge);
    }
  }
  return { inside, outside };
}

/** Non-indexed masonry triangles minus the connected room volumes. */
export function cutManorInterior(source: THREE.BufferGeometry) {
  const positions = source.getAttribute('position'),
    normals = source.getAttribute('normal');
  const output: number[] = [],
    shading: number[] = [];
  const bounds = new THREE.Box3();
  for (let i = 0; i < positions.count; i += 3) {
    let polygons: Vertex[][] = [
      [0, 1, 2].map((offset) => ({
        point: new THREE.Vector3().fromBufferAttribute(positions, i + offset),
        normal: new THREE.Vector3().fromBufferAttribute(normals, i + offset),
      })),
    ];
    for (const volume of volumes) {
      const remaining: Vertex[][] = [];
      for (const polygon of polygons) {
        bounds.setFromPoints(polygon.map((vertex) => vertex.point));
        if (!bounds.intersectsBox(volume)) {
          remaining.push(polygon);
          continue;
        }
        let inside = polygon;
        for (const axis of ['x', 'y', 'z'] as const) {
          for (const sign of [1, -1]) {
            if (inside.length < 3) break;
            const result = split(
              inside,
              axis,
              sign === 1 ? volume.min[axis] : volume.max[axis],
              sign,
            );
            if (result.outside.length >= 3) remaining.push(result.outside);
            inside = result.inside;
          }
        }
      }
      polygons = remaining;
      if (!polygons.length) break;
    }
    for (const polygon of polygons) {
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const vertex of [polygon[0], polygon[j], polygon[j + 1]]) {
          output.push(vertex.point.x, vertex.point.y, vertex.point.z);
          shading.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
        }
      }
    }
  }
  return new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(output, 3))
    .setAttribute('normal', new THREE.Float32BufferAttribute(shading, 3));
}
