import * as THREE from 'three';

/** Use one projection per triangle, avoiding UV jumps inside curved rock faces. */
export function projectSurfaceUV(geometry: THREE.BufferGeometry, metres = 2.5) {
  if (geometry.index)
    throw new Error('Surface projection requires non-indexed triangles');
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, i + 1).sub(a);
    c.fromBufferAttribute(position, i + 2).sub(a);
    const normal = b.cross(c);
    const x = Math.abs(normal.x),
      y = Math.abs(normal.y),
      z = Math.abs(normal.z);
    for (let j = i; j < i + 3; j++) {
      uv[j * 2] =
        (x > y && x > z ? position.getZ(j) : position.getX(j)) / metres;
      uv[j * 2 + 1] =
        (y >= x && y > z ? position.getZ(j) : position.getY(j)) / metres;
    }
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
