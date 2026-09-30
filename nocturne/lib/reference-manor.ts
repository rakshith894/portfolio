import { MANOR_ROUTE, stairTreads } from './island-stairs.ts';
import { MANOR_SOLIDS, MANOR_TOWERS, MANOR_DOOR, MANOR_ENTRY_ARCHES, MANOR_ARCH_DEPTH, MANOR_ARCH_BEVEL } from './manor-layout.ts';
import * as THREE from 'three';
import { projectSurfaceUV } from './surface-uv.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cutManorInterior } from './manor-interior-cut.ts';

export type ManorMaterials = Record<
  | 'stone'
  | 'darkStone'
  | 'edge'
  | 'wood'
  | 'iron'
  | 'amber'
  | 'roof'
  | 'voidMat',
  THREE.MeshStandardMaterial
>;
export function createReferenceManor(
  materials: ManorMaterials,
  resources: Set<{ dispose: () => void }>,
  mobile: boolean,
) {
  const root = new THREE.Group();
  root.name = 'Gothic manor: masonry, tracery, roofs and entrance staircase';
  const { stone, darkStone, edge, wood, iron, amber, roof, voidMat } =
    materials;
  const own = <T extends { dispose: () => void }>(item: T): T => {
    resources.add(item);
    return item;
  };
  const windowGlow = own(amber.clone());
  windowGlow.name = 'Warm light behind aged window glass';
  windowGlow.color.set(0x40301e);
  windowGlow.emissive.set(0xf0a64c);
  windowGlow.emissiveIntensity = 0.55;
  windowGlow.roughness = 0.65;
  let seed = 7301;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const boxGeometry = own(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeometry = own(new THREE.SphereGeometry(1, 12, 10));
  const matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    rotation = new THREE.Euler(),
    position = new THREE.Vector3(),
    scale = new THREE.Vector3();
  function add(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    const c = g.clone();
    quaternion.setFromEuler(rotation.set(rx, ry, rz));
    matrix.compose(position.set(x, y, z), quaternion, scale.set(sx, sy, sz));
    c.applyMatrix4(matrix);
    const list = groups.get(m) || [];
    list.push(c);
    groups.set(m, list);
  }
  const box = (
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry = 0,
  ) => add(boxGeometry, m, x, y, z, w, h, d, 0, ry);
  const ball = (
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    r: number,
  ) => add(sphereGeometry, m, x, y, z, r, r, r);
  function tapered(
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    top: number,
    bottom: number,
    height: number,
    sides = 12,
  ) {
    const g = new THREE.CylinderGeometry(top, bottom, height, sides);
    add(g, m, x, y, z);
    g.dispose();
  }
  function beam(
    a: THREE.Vector3,
    b: THREE.Vector3,
    r1: number,
    r2: number,
    m: THREE.Material,
  ) {
    const delta = b.clone().sub(a);
    const geometry = new THREE.CylinderGeometry(r2, r1, delta.length(), 7);
    const mesh = new THREE.Mesh(geometry);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    mesh.updateMatrix();
    geometry.applyMatrix4(mesh.matrix);
    const list = groups.get(m) || [];
    list.push(geometry);
    groups.set(m, list);
  }
  function pointedShape(w: number, h: number) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h * 0.62);
    s.quadraticCurveTo(w / 2, h * 0.85, 0, h);
    s.quadraticCurveTo(-w / 2, h * 0.85, -w / 2, h * 0.62);
    s.closePath();
    return s;
  }
  function arch(
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    thickness = 0.1,
  ) {
    const outer = pointedShape(w, h);
    const inner = pointedShape(w - thickness * 2, h - thickness * 2);
    const hole = new THREE.Path(
      inner.getPoints().map((p) => p.add(new THREE.Vector2(0, thickness))),
    );
    outer.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: MANOR_ARCH_DEPTH,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: MANOR_ARCH_BEVEL,
      bevelSegments: 1,
      curveSegments: 12,
    });
    add(g, m, x, y, z);
    g.dispose();
  }
  function pane(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    lit: boolean,
  ) {
    const shape = new THREE.ShapeGeometry(pointedShape(w, h), 12);
    add(shape, lit ? windowGlow : voidMat, x, y, z);
    shape.dispose();
    arch(edge, x, y - 0.07, z + 0.025, w + 0.23, h + 0.14, 0.11);
    box(iron, x, y + h * 0.45, z + 0.045, 0.035, h * 0.9, 0.04);
    box(iron, x, y + h * 0.42, z + 0.06, w, 0.035, 0.04);
    box(iron, x, y + h * 0.66, z + 0.06, w * 0.87, 0.035, 0.04);
    box(edge, x, y - 0.14, z + 0.04, w + 0.4, 0.16, 0.38);
    box(darkStone, x, y + h + 0.12, z, w + 0.25, 0.12, 0.27);
  }
  // A full Gothic manor with asymmetric wings, bays, towers, dormers and tracery.
  const MZ = -20,
    base = 2.22;
  const front = MZ + 4;
  for (const solid of MANOR_SOLIDS) {
    if (solid.name === 'Entrance recess') continue;
    if (solid.name === 'Main walls' || solid.name === 'Main foundation') {
      // A real opening continues through the facade and its foundation.
      const halfOpening = 1.2;
      const sideWidth = solid.width / 2 - halfOpening;
      for (const side of [-1, 1]) box(materials[solid.material], side * (halfOpening + sideWidth / 2), solid.y, solid.z, sideWidth, solid.height, solid.depth);
      if (solid.name === 'Main walls') {
        const top = solid.y + solid.height / 2, lintel = MANOR_DOOR.y + MANOR_DOOR.height;
        box(materials[solid.material], 0, (top + lintel) / 2, solid.z, halfOpening * 2, top - lintel, solid.depth);
      }
    } else box(materials[solid.material], solid.x, solid.y, solid.z, solid.width, solid.height, solid.depth);
  }
  for (const y of [base + 0.9, base + 4.4, base + 8.05, base + 11.25]) {
    if (y < MANOR_DOOR.y + MANOR_DOOR.height) {
      for (const side of [-1, 1]) {
        box(edge, side * 5.225, y, MZ, 8.05, .2, 8.5);
        box(darkStone, side * 5.1625, y - .15, front + .13, 7.925, .15, .4);
      }
    } else {
      box(edge, 0, y, MZ, 18.5, 0.2, 8.5);
      box(darkStone, 0, y - 0.15, front + 0.13, 18.25, 0.15, 0.4);
    }
  }
  // Quoin stones and buttresses break up every vertical façade.
  for (const x of [-8.7, -5.6, -2.4, 2.4, 5.6, 8.7]) {
    box(darkStone, x, base + 5.4, front + 0.13, 0.38, 10.8, 0.55);
    for (let y = 0.6; y < 11; y += 0.62)
      box(edge, x, base + y, front + 0.43, 0.5, 0.23, 0.19);
    tapered(edge, x, base + 12, front + 0.1, 0.025, 0.32, 1.4, 4);
  }
  // Habitable floors use the shared HOUSE_WINDOWS glazing and reveals.
  const roofGeometry = own(new THREE.CylinderGeometry(0, 1, 1, 4, 1));
  const mainRoofShape = new THREE.Shape();
  mainRoofShape.moveTo(-5.1, 0);
  mainRoofShape.lineTo(5.1, 0);
  mainRoofShape.lineTo(0, 4.1);
  mainRoofShape.closePath();
  const mainRoof = new THREE.ExtrudeGeometry(mainRoofShape, {
    depth: 18.6,
    bevelEnabled: false,
  });
  mainRoof.rotateY(Math.PI / 2);
  mainRoof.translate(-9.3, 0, 0);
  add(mainRoof, roof, 0, base + 11.2, MZ);
  mainRoof.dispose();
  box(iron, 0, base + 15.35, MZ, 15.4, 0.08, 0.07);
  for (const x of [-6.3, -3.2, 0, 3.2, 6.3]) {
    box(stone, x, base + 12.1, front - 0.65, 1.45, 2, 1.3);
    add(
      roofGeometry,
      roof,
      x,
      base + 13.7,
      front - 0.65,
      1.18,
      1.5,
      1.15,
      0,
      Math.PI / 4,
    );
    pane(x, base + 11.55, front + 0.015, 0.66, 1.33, rand() > 0.45);
    tapered(iron, x, base + 14.64, front - 0.65, 0, 0.055, 0.7, 6);
  }
  function tower(x: number, z: number, r: number, height: number, sides = 8) {
    tapered(darkStone, x, base / 2, z, r * 1.04, r * 1.08, base, sides);
    tapered(stone, x, base + height / 2, z, r, r, height, sides);
    tapered(edge, x, base + height, z, r * 1.06, r * 1.06, 0.3, sides);
    tapered(
      darkStone,
      x,
      base + height - 1,
      z,
      r * 1.025,
      r * 1.025,
      0.15,
      sides,
    );
    tapered(roof, x, base + height + 3.1, z, 0, r * 1.22, 6.2, sides);
    tapered(iron, x, base + height + 6.6, z, 0.018, 0.08, 0.9, 8);
    for (let l = 0; l < 3; l++) {
      pane(x, base + 1.8 + l * 3.25, z + r + 0.04, 0.8, 2.1, l !== 1);
      for (const dx of [-r * 0.73, r * 0.73]) {
        box(edge, x + dx, base + 2.9 + l * 3.25, z + r * 0.71, 0.14, 2.4, 0.25);
      }
    }
    for (let j = 0; j < 8; j++) {
      const a = (j / 8) * Math.PI * 2;
      tapered(
        edge,
        x + Math.cos(a) * r * 0.95,
        base + height + 0.7,
        z + Math.sin(a) * r * 0.95,
        0.035,
        0.16,
        1.15,
        4,
      );
    }
  }
  for (const item of MANOR_TOWERS) tower(item.x, item.z, item.radius, item.height);
  // Tall front-facing gables define the reference's silhouette above the lancets.
  function gable(
    x: number,
    z: number,
    width: number,
    bottom: number,
    height: number,
  ) {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, 0);
    shape.lineTo(width / 2, 0);
    shape.lineTo(0, height);
    shape.closePath();
    const face = new THREE.ExtrudeGeometry(shape, {
      depth: 0.5,
      bevelEnabled: false,
    });
    add(face, stone, x, bottom, z);
    face.dispose();
    for (const side of [-1, 1]) {
      beam(
        new THREE.Vector3(x + (side * width) / 2, bottom, z + 0.54),
        new THREE.Vector3(x, bottom + height, z + 0.54),
        0.09,
        0.075,
        edge,
      );
      for (let i = 1; i <= 6; i++) {
        const t = i / 7;
        tapered(
          edge,
          x + ((side * width) / 2) * (1 - t),
          bottom + height * t + 0.15,
          z + 0.5,
          0.01,
          0.095,
          0.33,
          4,
        );
      }
    }
    tapered(iron, x, bottom + height + 0.5, z + 0.4, 0, 0.065, 1.2, 6);
    pane(x, bottom + 0.2, z + 0.52, width * 0.23, height * 0.5, true);
  }
  gable(-3.8, front + 0.22, 5.1, base + 10.7, 6.2);
  gable(3.6, front + 0.18, 4.2, base + 10.8, 5.1);
  gable(0, front + 1.35, 4.6, base + 10.4, 6.1);
  // Every facade is built: rear lancets, side bays, stone banding and a back entrance.
  function facingPane(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    lit: boolean,
    angle: number,
  ) {
    const counts = new Map(
      [...groups].map(([material, list]) => [material, list.length]),
    );
    pane(0, y, 0, w, h, lit);
    for (const [material, list] of groups)
      for (let i = counts.get(material) || 0; i < list.length; i++) {
        list[i].rotateY(angle);
        list[i].translate(x, 0, z);
      }
  }
  for (const side of [-1, 1]) {
    for (const z of [-21, -23])
      for (const y of [4.8])
        facingPane(
          side * 12.53,
          base + y,
          z,
          0.72,
          2.1,
          rand() > 0.5,
          (side * Math.PI) / 2,
        );
    for (const z of [MZ - 2.8, MZ, MZ + 2.5])
      for (const y of [1.2, 4.9, 8.5])
        facingPane(
          side * 8.93,
          base + y,
          z,
          0.85,
          2.1,
          rand() > 0.48,
          (side * Math.PI) / 2,
        );
    for (const x of [-0.8, 0.8])
      for (const y of [1.2, 4.8])
        facingPane(
          side * 10.7 + x,
          base + y,
          MZ - 4.57,
          0.72,
          2.15,
          rand() > 0.5,
          Math.PI,
        );
  }
  for (const x of [-8.7, -5.6, -2.4, 2.4, 5.6, 8.7]) {
    box(darkStone, x, base + 5.4, MZ - 4.1, 0.4, 10.8, 0.45);
    for (let y = 0.6; y < 11; y += 0.62)
      box(edge, x, base + y, MZ - 4.38, 0.5, 0.23, 0.18);
    tapered(edge, x, base + 12, MZ - 4.1, 0.025, 0.32, 1.4, 4);
  }
  for (const x of [-6.3, -3.2, 0, 3.2, 6.3]) {
    box(stone, x, base + 12.1, MZ - 3.35, 1.45, 2, 1.3);
    add(
      roofGeometry,
      roof,
      x,
      base + 13.7,
      MZ - 3.35,
      1.18,
      1.5,
      1.15,
      0,
      Math.PI / 4,
    );
    facingPane(x, base + 11.55, MZ - 4.035, 0.66, 1.33, rand() > 0.45, Math.PI);
  }
  box(wood, 0, base + 1.45, MZ - 4.12, 1.7, 2.9, 0.16);
  box(edge, 0, base + 3, MZ - 4.18, 2.2, 0.18, 0.4);
  for (const side of [-1, 1])
    box(edge, side * 1.03, base + 1.5, MZ - 4.2, 0.22, 3, 0.4);
  for (const side of [-1, 1])
    for (let i = 0; i < 8; i++) {
      tapered(
        edge,
        side * 3.7,
        base + 0.55,
        -24.5 - i * 0.4,
        0.06,
        0.08,
        1.05,
        8,
      );
    }
  box(edge, -3.7, base + 1.13, -26, 0.25, 0.15, 3.8);
  box(edge, 3.7, base + 1.13, -26, 0.25, 0.15, 3.8);
  // Central entrance projects forward, with a vaulted stone portico.
  const portalZ = front + 1.32;
  const portalShape = new THREE.ShapeGeometry(pointedShape(MANOR_DOOR.width, MANOR_DOOR.height), 16);
  const door = new THREE.Group();
  door.name = 'Manor door'; door.userData.door = true;
  door.position.set(MANOR_DOOR.x, MANOR_DOOR.y, MANOR_DOOR.z);
  const doorMaterial = own(wood.clone()); doorMaterial.side = THREE.DoubleSide;
  const leaf = new THREE.Mesh(own(portalShape), doorMaterial);
  leaf.position.x = MANOR_DOOR.width / 2; leaf.castShadow = !mobile; leaf.userData.door = true;
  door.add(leaf); root.add(door);
  root.userData.door = door;
  // A dark recess behind the swinging door gives the portal visible depth.
  const latch = new THREE.Mesh(own(new THREE.SphereGeometry(0.065, 8, 6)), amber);
  latch.position.set(1.88, 1.4, 0.1); door.add(latch);
  for (const frame of MANOR_ENTRY_ARCHES)
    arch(materials[frame.material], 0, frame.y, frame.z, frame.width, frame.height, frame.thickness);
  for (const y of [0.45, 2.1]) {
    const strap = new THREE.Mesh(own(new THREE.BoxGeometry(2, 0.07, 0.055)), iron);
    strap.position.set(1.1, y, 0.06); door.add(strap);
  }
  pane(0, base + 5.2, portalZ + 0.025, 1.3, 3, true);
  tapered(edge, 0, base + 13.2, front + 0.6, 0.04, 1.1, 3, 4);
  const roseGeo = own(new THREE.TorusGeometry(0.7, 0.065, 6, 40));
  add(roseGeo, edge, 0, base + 10.4, portalZ + 0.1);
  const rosePane = own(new THREE.CircleGeometry(0.68, 40));
  add(rosePane, amber, 0, base + 10.4, portalZ + 0.04);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    beam(
      new THREE.Vector3(0, base + 10.4, portalZ + 0.15),
      new THREE.Vector3(
        Math.cos(a) * 0.7,
        base + 10.4 + Math.sin(a) * 0.7,
        portalZ + 0.15,
      ),
      0.025,
      0.025,
      iron,
    );
  }
  // Broad staircase and a terrace with balustrades.
  for (const step of stairTreads(MANOR_ROUTE)) {
    const height=step.y-25;
    box(stone,step.x-10,height/2,step.z+10,step.width,height,step.depth,step.angle);
    box(edge,step.x-10,height-.035,step.z+10,step.width-.08,.07,Math.min(step.depth,.08),step.angle);
  }
  for (const x of [-12.2, 12.2]) {
    box(edge, x, base + 0.63, MZ + 4.7, 4.8, 0.12, 0.36);
    for (let j = 0; j < 9; j++) {
      tapered(
        edge,
        x - 2 + j * 0.5,
        base + 1.25,
        MZ + 4.7,
        0.055,
        0.095,
        1.15,
        8,
      );
      ball(edge, x - 2 + j * 0.5, base + 1.31, MZ + 4.7, 0.1);
    }
    box(edge, x, base + 1.85, MZ + 4.7, 4.8, 0.16, 0.28);
  }
  for (const x of [-10.7, 10.7]) {
    for (const xx of [-0.85, 0.85])
      for (const yy of [1.2, 4.8])
        pane(x + xx, base + yy, MZ + 0.18, 0.7, 2.2, rand() > 0.5);
    add(
      roofGeometry,
      roof,
      x,
      base + 10,
      MZ - 2.2,
      3.1,
      3.3,
      4.2,
      0,
      Math.PI / 4,
    );
  }
  // Chimneys, roof finials, and narrow cast-iron cresting.
  for (const x of [-5, 5]) {
    box(darkStone, x, base + 14.5, MZ - 1, 1, 3.1, 0.8);
    box(edge, x, base + 16.1, MZ - 1, 1.25, 0.2, 1.05);
    for (const dx of [-0.25, 0.25])
      tapered(roof, x + dx, base + 16.5, MZ - 1, 0.14, 0.17, 0.7, 8);
  }
  for (let i = 0; i < 30; i++) {
    const x = -7.5 + i * 0.5;
    tapered(iron, x, base + 15.75, MZ, 0.005, 0.035, 0.7, 6);
  }
  // Merge architecture by material: thousands of details, a handful of draw calls.
  for (const [m, geometries] of groups) {
    const normalized = geometries.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (n !== g) g.dispose();
      if (!n.getAttribute('normal')) n.computeVertexNormals();
      if (!n.getAttribute('uv'))
        n.setAttribute(
          'uv',
          new THREE.Float32BufferAttribute(
            new Float32Array(n.getAttribute('position').count * 2),
            2,
          ),
        );
      projectSurfaceUV(n, 2.4);
      return n;
    });
    const merged = mergeGeometries(normalized, false);
    normalized.forEach((g) => g.dispose());
    if (!merged) continue;
    const hollow = own(cutManorInterior(merged));
    merged.dispose();
    projectSurfaceUV(hollow, 2.4);
    const mesh = new THREE.Mesh(hollow, m);
    mesh.castShadow = !mobile;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return root;
}
