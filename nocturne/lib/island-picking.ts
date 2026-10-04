import * as THREE from 'three';
import { onWalkingSurface, walkingHeight } from './island-walk.ts';

/** Pick the floor beneath foliage, lamps and rails, without seeing through the manor. */
export function pickIslandDestination(
  ray: THREE.Raycaster,
  surfaces: THREE.Object3D[],
  manor?: THREE.Object3D | null,
) {
  const wall = manor ? ray.intersectObject(manor, true)[0] : undefined;
  const normal = new THREE.Vector3();
  const hits = ray.intersectObjects(
    manor ? [...surfaces, manor] : surfaces,
    true,
  );
  for (const hit of hits) {
    if (wall && hit.distance > wall.distance + 0.05) break;
    if (!hit.face) continue;
    normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    const { x, y, z } = hit.point;
    if (normal.y < 0.45 || !onWalkingSurface(x, z)) continue;
    if (Math.abs(y - walkingHeight(x, z)) > 0.35) continue;
    return hit.point;
  }
  return null;
}
