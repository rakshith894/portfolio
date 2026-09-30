import * as THREE from 'three';
import { SHORE_ROUTE } from './island-stairs.ts';

/** The retaining faces and stair shoulders cannot be inferred from terrain height. */
export function createShoreCamera() {
  const routeBounds = new THREE.Box3().setFromPoints(
    SHORE_ROUTE.map(point => new THREE.Vector3(...point)),
  ).expandByScalar(3);
  const sceneryBounds = routeBounds.clone().expandByScalar(42);
  const cells = new Map<string, { bounds: THREE.Box3; triangles: THREE.Triangle[] }>();
  const cellSize = 4;
  const bounds = new THREE.Box3(), end = new THREE.Vector3();
  const tested = new Set<THREE.Triangle>();
  const ray = new THREE.Ray(), hit = new THREE.Vector3();
  const direction = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  return {
    // All supplied scenery geometry is already in world coordinates.
    add(geometry: THREE.BufferGeometry) {
      const positions = geometry.getAttribute('position'), indices = geometry.index;
      const count = indices?.count ?? positions.count;
      for (let i = 0; i < count; i += 3) {
        const triangle = new THREE.Triangle(...[0, 1, 2].map(offset =>
          new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset),
        ) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
        if (!sceneryBounds.intersectsTriangle(triangle) || triangle.getArea() < 1e-8) continue;
        bounds.setFromPoints([triangle.a, triangle.b, triangle.c]).intersect(sceneryBounds);
        for (let x = Math.floor(bounds.min.x / cellSize); x <= Math.floor(bounds.max.x / cellSize); x++)
          for (let y = Math.floor(bounds.min.y / cellSize); y <= Math.floor(bounds.max.y / cellSize); y++)
            for (let z = Math.floor(bounds.min.z / cellSize); z <= Math.floor(bounds.max.z / cellSize); z++) {
              const key = `${x},${y},${z}`;
              const cell = cells.get(key) ?? {
                bounds: new THREE.Box3(new THREE.Vector3(x, y, z).multiplyScalar(cellSize), new THREE.Vector3(x + 1, y + 1, z + 1).multiplyScalar(cellSize)),
                triangles: [],
              };
              if (!cell.bounds.intersectsTriangle(triangle)) continue;
              cell.triangles.push(triangle);
              cells.set(key, cell);
            }
      }
    },
    constrain(this: void, position: THREE.Vector3, target: THREE.Vector3) {
      if (!routeBounds.containsPoint(target)) return;
      const length = position.distanceTo(target);
      if (length < .001) return;
      direction.copy(position).sub(target).divideScalar(length);
      right.set(direction.z, 0, -direction.x).normalize();
      if (right.lengthSq() < .001) right.set(1, 0, 0);
      up.crossVectors(direction, right).normalize();
      ray.direction.copy(direction);
      let visible = length;
      // A small cross-section keeps the near plane clear at landing corners.
      for (const [x, y] of [[0, 0], [-.18, -.18], [-.18, .18], [.18, -.18], [.18, .18]]) {
        ray.origin.copy(target).addScaledVector(right, x).addScaledVector(up, y);
        ray.at(visible, end);
        bounds.setFromPoints([ray.origin, end]);
        tested.clear();
        for (let cx = Math.floor(bounds.min.x / cellSize); cx <= Math.floor(bounds.max.x / cellSize); cx++)
          for (let cy = Math.floor(bounds.min.y / cellSize); cy <= Math.floor(bounds.max.y / cellSize); cy++)
            for (let cz = Math.floor(bounds.min.z / cellSize); cz <= Math.floor(bounds.max.z / cellSize); cz++) {
              const cell = cells.get(`${cx},${cy},${cz}`);
              if (!cell || !ray.intersectsBox(cell.bounds)) continue;
              for (const triangle of cell.triangles) {
                if (tested.has(triangle)) continue;
                tested.add(triangle);
                if (!ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) continue;
                const distance = hit.distanceTo(ray.origin);
                if (distance > .001) visible = Math.min(visible, Math.max(.15, distance - .22));
              }
            }
      }
      if (visible < length) position.copy(target).addScaledVector(direction, visible);
    },
    dispose() { cells.clear(); tested.clear(); },
  };
}
