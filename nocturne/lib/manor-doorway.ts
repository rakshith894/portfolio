import * as THREE from 'three';
import { MANOR_DOOR } from './manor-layout.ts';
import { projectSurfaceUV } from './surface-uv.ts';

/** The leaf and its masonry opening use the same Gothic arch profile. */
export function pointedShape(width: number, height: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width / 2, height * 0.62);
  shape.quadraticCurveTo(width / 2, height * 0.85, 0, height);
  shape.quadraticCurveTo(-width / 2, height * 0.85, -width / 2, height * 0.62);
  shape.closePath();
  return shape;
}

/** A closed wall around the opening, including returns into the foyer lining. */
export function createManorDoorway(
  stone: THREE.MeshStandardMaterial,
  resources: Set<{ dispose: () => void }>,
) {
  const root = new THREE.Group();
  root.name = 'Sealed stone entrance surround';
  root.position.set(0, MANOR_DOOR.y, MANOR_DOOR.z);
  const back = MANOR_DOOR.hingeOffset + 0.1;
  const front = 0.43;
  const add = (geometry: THREE.BufferGeometry, name: string) => {
    const triangles = geometry.index ? geometry.toNonIndexed() : geometry;
    if (triangles !== geometry) geometry.dispose();
    resources.add(triangles);
    projectSurfaceUV(triangles, 2.4);
    const mesh = new THREE.Mesh(triangles, stone);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  };
  const outline = new THREE.Shape();
  outline.moveTo(-1.25, -0.16);
  outline.lineTo(1.25, -0.16);
  outline.lineTo(1.25, 4.98);
  outline.lineTo(-1.25, 4.98);
  outline.closePath();
  // The door sits behind a shallow stop, overlapping it by 2 cm when closed.
  // All of the stop is outside the hinge, leaving the inward swing unobstructed.
  const opening = pointedShape(
    MANOR_DOOR.width - 0.04,
    MANOR_DOOR.height - 0.02,
  );
  outline.holes.push(new THREE.Path(opening.getPoints(32)));
  const surround = new THREE.ExtrudeGeometry(outline, {
    depth: front - back,
    bevelEnabled: false,
    curveSegments: 32,
  });
  surround.translate(0, 0, back);
  add(surround, 'Continuous arched jambs and lintel');
  const returnDepth = front + 0.04;
  for (const side of [-1, 1]) {
    const jamb = new THREE.BoxGeometry(0.2, 5.14, returnDepth);
    jamb.translate(side * 1.15, 2.41, (front - 0.04) / 2);
    add(jamb, 'Entrance side return');
  }
  const ceiling = new THREE.BoxGeometry(2.5, 0.2, returnDepth);
  ceiling.translate(0, 4.9, (front - 0.04) / 2);
  add(ceiling, 'Entrance ceiling closure');
  const sill = new THREE.BoxGeometry(2.5, 0.16, returnDepth);
  sill.translate(0, -0.08, (front - 0.04) / 2);
  add(sill, 'Entrance stone threshold');
  return root;
}
