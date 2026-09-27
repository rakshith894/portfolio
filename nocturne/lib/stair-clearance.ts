import * as THREE from 'three';
import {
  SHORE_ROUTE,
  TOWER_ROUTE,
  BRIDGE_ROUTE,
  VIADUCT_ROUTE,
  BOAT_DOCK,
  DOCK_HEIGHT,
  STAIR_WIDTH,
} from './island-stairs.ts';

// Carve scenery away from the full stair width and square turn landings.
// These are rendering clearances: stairs, rails and their supports stay intact.
const halfWidth = STAIR_WIDTH / 2 + 0.45;
const corridors = [SHORE_ROUTE, TOWER_ROUTE, BRIDGE_ROUTE, VIADUCT_ROUTE].flatMap((route) =>
  route.slice(1).map((b, i) => {
    const a = route[i];
    return new THREE.Box3(
      new THREE.Vector3(
        Math.min(a[0], b[0]) - halfWidth,
        Math.min(a[1], b[1]) - 0.4,
        Math.min(a[2], b[2]) - halfWidth,
      ),
      new THREE.Vector3(
        Math.max(a[0], b[0]) + halfWidth,
        200,
        Math.max(a[2], b[2]) + halfWidth,
      ),
    );
  }),
);
corridors.push(
  new THREE.Box3(
    new THREE.Vector3(BOAT_DOCK.x - 2.8, DOCK_HEIGHT-.4, BOAT_DOCK.z - 1.7),
    new THREE.Vector3(BOAT_DOCK.x + 2.8, 200, BOAT_DOCK.z + 1.7),
  ),
);

/** Camera floor follows the terrain removed for the stair corridors. */
export function clearedSceneryHeight(x: number, z: number, height: number) {
  for (const box of corridors) {
    if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z)
      height = Math.min(height, box.min.y);
  }
  return height;
}

type Vertex = number[];
function halfSpace(
  polygon: Vertex[],
  axis: number,
  boundary: number,
  greater: boolean,
) {
  const result: Vertex[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i],
      b = polygon[(i + 1) % polygon.length];
    const da = (a[axis] - boundary) * (greater ? 1 : -1);
    const db = (b[axis] - boundary) * (greater ? 1 : -1);
    if (da >= 0) result.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      result.push(a.map((value, index) => value + (b[index] - value) * t));
    }
  }
  return result;
}

/** Remove corridor intersections, including triangles whose vertices lie outside.
 * Geometry is already in world coordinates; normals and UVs interpolate at cuts.
 */
export function clearStairScenery(geometry: THREE.BufferGeometry, sealTerrain = false) {
  geometry.computeBoundingBox();
  const relevant = corridors.filter((box) =>
    box.intersectsBox(geometry.boundingBox!),
  );
  if (!relevant.length) return;
  const attributes = [
    'position',
    ...Object.keys(geometry.attributes).filter((name) => name !== 'position'),
  ];
  const layouts = attributes.map((name) => ({
    name,
    attribute: geometry.getAttribute(name),
    values: [] as number[],
  }));
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const count = index ? index.count : position.count;
  const vertex = (i: number): Vertex => {
    const id = index ? index.getX(i) : i;
    return layouts.flatMap(({ attribute }) =>
      Array.from({ length: attribute.itemSize }, (_, axis) =>
        attribute.getComponent(id, axis),
      ),
    );
  };
  const polygonBounds = new THREE.Box3();
  for (let i = 0; i < count; i += 3) {
    let pieces: Vertex[][] = [[vertex(i), vertex(i + 1), vertex(i + 2)]];
    for (const box of relevant) {
      const next: Vertex[][] = [];
      for (const polygon of pieces) {
        polygonBounds.makeEmpty();
        for (const point of polygon)
          polygonBounds.expandByPoint(
            new THREE.Vector3(point[0], point[1], point[2]),
          );
        if (!box.intersectsBox(polygonBounds)) {
          next.push(polygon);
          continue;
        }
        let inside = polygon;
        for (let axis = 0; axis < 3 && inside.length >= 3; axis++) {
          for (const greater of [true, false]) {
            const boundary = (greater ? box.min : box.max).getComponent(axis);
            const outside = halfSpace(inside, axis, boundary, !greater);
            if (outside.length >= 3) next.push(outside);
            inside = halfSpace(inside, axis, boundary, greater);
          }
        }
        // Terrain is a shell: deleting its top exposes the ocean below it.
        // Retain a recessed floor and close each cut edge with a retaining face.
        if (sealTerrain && inside.length >= 3) {
          const floor = inside.map(point => { const copy = [...point]; copy[1] = box.min.y; return copy; });
          next.push(floor);
          for (let edge = 0; edge < inside.length; edge++) {
            const j = (edge + 1) % inside.length;
            const a = inside[edge], b = inside[j];
            const boundary = [0, 2].some(axis => [box.min, box.max].some(side =>
              Math.abs(a[axis]-side.getComponent(axis))<1e-5 && Math.abs(b[axis]-side.getComponent(axis))<1e-5));
            if (boundary) next.push([a, floor[edge], floor[j], b]);
          }
        }
      }
      pieces = next;
      if (!pieces.length) break;
    }
    for (const polygon of pieces)
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const point of [polygon[0], polygon[j], polygon[j + 1]]) {
          let offset = 0;
          for (const layout of layouts) {
            for (let axis = 0; axis < layout.attribute.itemSize; axis++)
              layout.values.push(point[offset++]);
          }
        }
      }
  }
  geometry.setIndex(null);
  for (const { name, attribute, values } of layouts)
    geometry.setAttribute(
      name,
      new THREE.Float32BufferAttribute(values, attribute.itemSize),
    );
  if (geometry.getAttribute('normal')) geometry.normalizeNormals();
  if (sealTerrain) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
