import * as THREE from 'three';

/** Keep the camera's near plane in front of indoor masonry and door leaves. */
export function createHouseCamera(obstacles: THREE.Object3D[]) {
  const ray = new THREE.Raycaster();
  const direction = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const bounds = new THREE.Box3();
  const nearby: THREE.Object3D[] = [];
  const smallMeshes: THREE.Object3D[] = [];
  const cells = new Map<string, THREE.Triangle[]>();
  const cellSize = 2;
  const tested = new Set<THREE.Triangle>();
  const end = new THREE.Vector3(), hitPoint = new THREE.Vector3();
  // Large merged masonry batches are static. Index them once so each frame
  // checks nearby faces instead of re-scanning the entire manor five times.
  for (const object of obstacles) {
    if (!(object instanceof THREE.Mesh)) { smallMeshes.push(object); continue; }
    object.geometry.computeBoundingBox();
    const positions = object.geometry.getAttribute('position'), indices = object.geometry.index;
    if (positions.count < 2000) { smallMeshes.push(object); continue; }
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const vertices = [0, 1, 2].map(offset => new THREE.Vector3()
        .fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(object.matrixWorld));
      const triangle = new THREE.Triangle(vertices[0], vertices[1], vertices[2]);
      if (triangle.getArea() < 1e-8) continue;
      bounds.setFromPoints(vertices);
      for (let x = Math.floor(bounds.min.x / cellSize); x <= Math.floor(bounds.max.x / cellSize); x++)
        for (let y = Math.floor(bounds.min.y / cellSize); y <= Math.floor(bounds.max.y / cellSize); y++)
          for (let z = Math.floor(bounds.min.z / cellSize); z <= Math.floor(bounds.max.z / cellSize); z++) {
            const key = `${x},${y},${z}`;
            const triangles = cells.get(key) ?? [];
            triangles.push(triangle);
            cells.set(key, triangles);
          }
    }
  }
  return (camera: THREE.PerspectiveCamera, target: THREE.Vector3, distance: number) => {
    direction.copy(camera.position).sub(target).normalize();
    right.set(direction.z, 0, -direction.x).normalize();
    if (right.lengthSq() < .001) right.set(1, 0, 0);
    up.crossVectors(direction, right).normalize();
    const halfHeight = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const width = Math.max(.16, halfHeight * camera.aspect + .04);
    const height = Math.max(.16, halfHeight + .04);
    nearby.length = 0;
    for (const object of smallMeshes) {
      if (object instanceof THREE.Mesh && object.geometry.boundingBox &&
        bounds.copy(object.geometry.boundingBox).applyMatrix4(object.matrixWorld).distanceToPoint(target) > distance + width + height) continue;
      nearby.push(object);
    }
    let clear = distance;
    // A center ray alone can miss a corner that fills half of the image.
    for (const [x, y] of [[0, 0], [-width, -height], [-width, height], [width, -height], [width, height]]) {
      origin.copy(target).addScaledVector(right, x).addScaledVector(up, y);
      ray.set(origin, direction);
      ray.far = distance + camera.near;
      const hit = ray.intersectObjects(nearby, false)[0];
      if (hit) clear = Math.min(clear, Math.max(.1, hit.distance - camera.near - .08));
      ray.ray.at(distance + camera.near, end);
      bounds.setFromPoints([origin, end]);
      tested.clear();
      for (let cx = Math.floor(bounds.min.x / cellSize); cx <= Math.floor(bounds.max.x / cellSize); cx++)
        for (let cy = Math.floor(bounds.min.y / cellSize); cy <= Math.floor(bounds.max.y / cellSize); cy++)
          for (let cz = Math.floor(bounds.min.z / cellSize); cz <= Math.floor(bounds.max.z / cellSize); cz++)
            for (const triangle of cells.get(`${cx},${cy},${cz}`) ?? []) {
              if (tested.has(triangle)) continue;
              tested.add(triangle);
              if (!ray.ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hitPoint)) continue;
              const length = origin.distanceTo(hitPoint);
              if (length <= distance + camera.near)
                clear = Math.min(clear, Math.max(.1, length - camera.near - .08));
            }
    }
    camera.position.copy(target).addScaledVector(direction, clear);
  };
}
