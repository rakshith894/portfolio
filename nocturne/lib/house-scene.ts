import * as THREE from 'three';
import type { IslandMode } from './island-mode.ts';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { projectSurfaceUV } from './surface-uv.ts';
import { HOUSE_WINDOWS, windowedWall } from './house-windows.ts';
import {
  HOUSE_DOORS,
  HOUSE_FURNITURE,
  HOUSE_ROOMS,
  HOUSE_WALLS,
  HOUSE_FLOORS,
  HOUSE_HALL,
} from './house-layout.ts';
import { HOUSE_STAIRS, STAIR_TREADS, STAIR_WELL, UPPER_HALL } from './house-stairs.ts';
import { DEFAULT_HALL_SETTINGS, HALL_GATE, hallLighting, type HallSettings } from './master-hall.ts';
import { createHallFrames } from './hall-frames.ts';

/** A continuous Gothic hall with four furnished rooms and hinged wooden doors. */
export function createHouseScene(scene: THREE.Scene, mobile: boolean) {
  const resources = new Set<{ dispose: () => void }>();
  let disposed = false;
  let mode: IslandMode = 'night';
  let hallSettings = { ...DEFAULT_HALL_SETTINGS }, inMasterHall = false;
  const own = <T extends { dispose: () => void }>(value: T) => {
    resources.add(value);
    return value;
  };
  const material = (
    color: number,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) =>
    own(new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...extra }));
  const stone = material(0x606968),
    wood = material(0x30231e),
    panel = material(0x44362c);
  const trim = material(0x958266, { metalness: 0.35, roughness: 0.6 }),
    iron = material(0x24272a, { metalness: 0.65 });
  const carpet = material(0x471e26),
    wax = material(0xd7c8a2),
    paper = material(0xb1a58a);
  const flameMaterial = material(0xffc97a, {
    emissive: 0xff932e,
    emissiveIntensity: 2.4,
  });
  const cold = material(0x647c91, {
    emissive: 0x6584ae,
    emissiveIntensity: 0.7,
  });
  const loader = new THREE.TextureLoader();
  const texture = (url: string, srgb: boolean) => {
    const map = own(
      loader.load(
        url,
        () => {
          if (disposed) map.dispose();
        },
        undefined,
        () => {},
      ),
    );
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    if (srgb) map.colorSpace = THREE.SRGBColorSpace;
    return map;
  };
  stone.map = texture('/materials/stone-color.webp', true);
  stone.normalMap = texture('/materials/stone-normal.webp', false);
  stone.normalScale.setScalar(0.5);
  const floorMaterial = material(0x817666);
  floorMaterial.map = texture('/materials/path-color.webp', true);
  const upperFloor = material(0x6e746f, { roughness: .42 });
  const floorTiles = [0x767c76, 0x747b76, 0x717972].map(color => material(color, { roughness: .48 }));
  const libraryBoards = [0x392a20, 0x443025, 0x4a3427, 0x403026].map(color => material(color, { roughness: .66 }));
  const boxGeometry = own(new THREE.BoxGeometry(1, 1, 1));
  const sphereGeometry = own(new THREE.SphereGeometry(1, 12, 8));
  const cylinderGeometry = own(new THREE.CylinderGeometry(1, 1, 1, 12));
  const box = (
    parent: THREE.Object3D,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    width: number,
    height: number,
    depth: number,
  ) => {
    const mesh = new THREE.Mesh(boxGeometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(width, height, depth);
    mesh.castShadow = !mobile;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const sphere = (
    parent: THREE.Object3D,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const mesh = new THREE.Mesh(sphereGeometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  };
  const cylinder = (
    parent: THREE.Object3D,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
  ) => {
    const mesh = new THREE.Mesh(cylinderGeometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, height, radius);
    parent.add(mesh);
    return mesh;
  };
  const flames: THREE.Mesh[] = [];
  const wallBox = (mat: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) => {
    for (const piece of windowedWall({ x, y, z, width, height, depth }))
      box(scene, mat, piece.x, piece.y, piece.z, piece.width, piece.height, piece.depth);
  };
  function candle(x: number, y: number, z: number, height = 0.3) {
    cylinder(scene, trim, x, y + 0.025, z, 0.12, 0.05);
    cylinder(scene, wax, x, y + height / 2, z, 0.055, height);
    flames.push(
      sphere(
        scene,
        flameMaterial,
        x,
        y + height + 0.065,
        z,
        0.035,
        0.095,
        0.035,
      ),
    );
  }
  for (const floor of HOUSE_FLOORS) {
    box(
      scene,
      floorMaterial,
      floor.x,
      -0.15,
      floor.z,
      floor.width,
      0.3,
      floor.depth,
    );
    // The upstairs slab is also the main rooms' ceiling: avoid coincident faces.
    if (Math.abs(floor.x) > 8.6 || (floor !== HOUSE_HALL && floor.z > -1.6))
      box(scene, wood, floor.x, 4.9, floor.z, floor.width, 0.2, floor.depth);
  }
  // Quiet walnut boards make the library a room, rather than an outdoor path.
  const library = HOUSE_ROOMS[0];
  for (let x = library.x - library.width / 2 + .18, row = 0; x < library.x + library.width / 2 - .16; x += .32, row++)
    box(scene, libraryBoards[row % libraryBoards.length], x, .005, library.z, .312, .012, library.depth - .22);
  box(scene, carpet, 0, 0.013, -4, 1.85, 0.025, 8.6);
  for (const x of [-0.88, 0.88])
    box(scene, trim, x, 0.03, -4, 0.045, 0.012, 8.5);
  for (const wall of HOUSE_WALLS) {
    if (wall.y) {
      box(scene, stone, wall.x, wall.y + wall.height / 2, wall.z, wall.width, wall.height, wall.depth);
      box(scene, wood, wall.x, wall.y + .65, wall.z, wall.width + .05, 1.3, wall.depth);
      continue;
    }
    wallBox(stone, wall.x, 2.4, wall.z, wall.width, 4.8, wall.depth);
    wallBox(
      wood,
      wall.x,
      0.6,
      wall.z,
      wall.width + 0.05,
      1.2,
      wall.depth + 0.05,
    );
    wallBox(
      trim,
      wall.x,
      1.25,
      wall.z,
      wall.width + 0.09,
      0.08,
      wall.depth + 0.09,
    );
    wallBox(
      wood,
      wall.x,
      4.55,
      wall.z,
      wall.width + 0.1,
      0.25,
      wall.depth + 0.1,
    );
  }
  for (const z of [-2.1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.35, 3.2, z),
      new THREE.Vector3(-1.8, 4.2, z),
      new THREE.Vector3(0, 4.65, z),
      new THREE.Vector3(1.8, 4.2, z),
      new THREE.Vector3(2.35, 3.2, z),
    ]);
    scene.add(
      new THREE.Mesh(
        own(new THREE.TubeGeometry(curve, 24, 0.09, 6, false)),
        trim,
      ),
    );
    for (const x of [-2.35, 2.35]) {
      cylinder(scene, stone, x, 1.6, z, 0.14, 3.2);
      box(scene, trim, x, 0.14, z, 0.4, 0.28, 0.4);
      candle(x * 0.93, 2.1, z, 0.25);
      box(scene, iron, x * 0.93, 2.06, z, 0.35, 0.07, 0.35);
    }
  }
  const lights: THREE.PointLight[] = [];
  function light(
    x: number,
    z: number,
    color: THREE.ColorRepresentation,
    intensity: number,
    y = 3.2,
  ) {
    const lamp = new THREE.PointLight(color, intensity, 13, 2);
    lamp.position.set(x, y, z);
    scene.add(lamp);
    lamp.userData.baseIntensity = intensity;
    lights.push(lamp);
    return lamp;
  }
  const indoorAmbient = new THREE.HemisphereLight(0x7f96b5, 0x292021, 0.85);
  scene.add(indoorAmbient);
  let hallShadow: THREE.SpotLight | null = null;
  if (!mobile) {
    hallShadow = new THREE.SpotLight(
      0xffc694,
      34,
      20,
      Math.PI / 3,
      0.75,
      2,
    );
    hallShadow.position.set(0, 4.35, -4);
    hallShadow.target.position.set(0, 0, -5);
    hallShadow.castShadow = true;
    own(hallShadow.shadow);
    hallShadow.shadow.mapSize.set(1024, 1024);
    hallShadow.shadow.bias = -0.001;
    hallShadow.shadow.normalBias = 0.03;
    scene.add(hallShadow, hallShadow.target);
  }
  for (const z of [-2.2]) {
    cylinder(scene, iron, 0, 4.2, z, 0.035, 1.2);
    const ring = new THREE.Mesh(
      own(new THREE.TorusGeometry(0.7, 0.045, 6, 24)),
      iron,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 3.65, z);
    scene.add(ring);
    for (let i = 0; i < 6; i++)
      candle(
        Math.cos((i * Math.PI) / 3) * 0.7,
        3.65,
        z + Math.sin((i * Math.PI) / 3) * 0.7,
        0.2,
      );
    light(0, z, 0xffc08b, 26);
  }
  // Keep the stairwell along the west side and leave the master hall open.
  const hall = UPPER_HALL, well = STAIR_WELL;
  const front = hall.z + hall.depth / 2, back = hall.z - hall.depth / 2;
  const wellFront = well.z + well.depth / 2, wellBack = well.z - well.depth / 2;
  for (const [a, b] of [[-hall.width / 2, well.x - well.width / 2], [well.x + well.width / 2, hall.width / 2]]) {
    box(scene, upperFloor, (a + b) / 2, hall.y - .1, hall.z, b - a, .2, hall.depth);
  }
  for (const [a, b] of [[back, wellBack], [wellFront, front]])
    box(scene, upperFloor, well.x, hall.y - .1, (a + b) / 2, well.width, .2, b - a);
  // Large stone tiles and a restrained border leave a calm exhibition floor.
  for (let x = HALL_GATE.x + .16, col = 0; x < hall.width / 2 - .12; x += 1.25, col++) {
    const width = Math.min(1.25, hall.width / 2 - .12 - x);
    for (let z = back + .12, row = 0; z < front - .12; z += 1.25, row++) {
      const depth = Math.min(1.25, front - .12 - z);
      box(scene, floorTiles[(col + row * 2) % floorTiles.length], x + width / 2, hall.y + .003, z + depth / 2, width - .016, .012, depth - .016);
    }
  }
  for (const z of [front - .35, back + .35])
    box(scene, trim, 2.05, hall.y + .012, z, 12.4, .012, .035);
  box(scene, wood, 0, hall.y + hall.height, hall.z, hall.width, .2, hall.depth);
  for (const side of [-1, 1]) {
    wallBox(stone, side * (hall.width / 2), hall.y + hall.height / 2, hall.z, .2, hall.height, hall.depth);
    wallBox(stone, 0, hall.y + hall.height / 2, hall.z + side * hall.depth / 2, hall.width, hall.height, .2);
    box(scene, wood, side * (hall.width / 2 - .12), hall.y + .65, hall.z, .12, 1.3, hall.depth);
  }
  for (const tread of STAIR_TREADS) {
    // Open timber flights, not floor-to-tread blocks that form a five-metre
    // wall in front of the visitor on the returning upper flight.
    box(scene, wood, tread.x, tread.y - .08, tread.z, tread.width, .16, tread.depth);
    box(scene, trim, tread.x, tread.y + .008, tread.z, tread.width, .016, .035);
  }
  box(scene, wood, HOUSE_STAIRS.x, hall.y / 2 - .1, (HOUSE_STAIRS.end + HOUSE_STAIRS.back) / 2, 2.9, .2, HOUSE_STAIRS.end - HOUSE_STAIRS.back);
  for (const x of [HOUSE_STAIRS.x - 1.3, HOUSE_STAIRS.x + 1.3])
    box(scene, wood, x, hall.y / 4, HOUSE_STAIRS.back + .15, .18, hall.y / 2, .18);
  const rail = (a: THREE.Vector3, b: THREE.Vector3) => {
    const length = a.distanceTo(b);
    const mesh = cylinder(scene, iron, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2, .045, length);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  };
  for (const side of [-1, 1]) {
    const flight = STAIR_TREADS.filter(tread => Math.sign(tread.x - HOUSE_STAIRS.x) === side);
    for (const edge of [-1, 1]) {
      const x = flight[0].x + edge * HOUSE_STAIRS.width / 2;
      const start = new THREE.Vector3(x, flight[0].y - .18, flight[0].z);
      const end = new THREE.Vector3(x, flight.at(-1)!.y - .18, flight.at(-1)!.z);
      const stringer = box(scene, wood, (start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2, .12, .22, start.distanceTo(end) + .3);
      stringer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), end.sub(start).normalize());
      for (let i = 0; i < flight.length; i += 3) cylinder(scene, iron, x, flight[i].y + .48, flight[i].z, .025, .96);
      rail(new THREE.Vector3(x, flight[0].y + .96, flight[0].z), new THREE.Vector3(x, flight.at(-1)!.y + .96, flight.at(-1)!.z));
    }
  }
  for (const [ax, az, bx, bz] of [[-1.55, wellFront, -1.55, wellBack], [1.55, wellFront, 1.55, wellBack], [-1.55, wellBack, 1.55, wellBack], [-1.55, wellFront, .14, wellFront]]) {
    rail(new THREE.Vector3(ax + well.x, hall.y + 1, az), new THREE.Vector3(bx + well.x, hall.y + 1, bz));
    const count = Math.ceil(Math.hypot(bx - ax, bz - az) / .55);
    for (let i = 0; i <= count; i++) cylinder(scene, iron, well.x + THREE.MathUtils.lerp(ax, bx, i / count), hall.y + .5, THREE.MathUtils.lerp(az, bz, i / count), .025, 1);
  }
  const glass = material(0x668393, { transparent: true, opacity: .3, roughness: .24, metalness: .15, emissive: 0x355369, emissiveIntensity: .18, depthWrite: false });
  for (const window of HOUSE_WINDOWS) {
    const frame = new THREE.Group();
    frame.name = 'Recessed leaded window';
    frame.position.set(window.x, window.y, window.z);
    frame.rotation.y = window.axis === 'z' ? window.outward * Math.PI / 2 : window.outward === 1 ? 0 : Math.PI;
    scene.add(frame);
    const w = window.width, h = window.height;
    box(frame, glass, 0, 0, .1, w - .06, h - .06, .025);
    for (const side of [-1, 1]) {
      box(frame, stone, side * (w / 2 + .06), 0, .08, .12, h + .24, .72);
      box(frame, stone, 0, side * (h / 2 + .06), .08, w + .24, .12, .72);
      for (const face of [-.27, .45]) {
        box(frame, trim, side * (w / 2 + .035), 0, face, .065, h + .12, .055);
        box(frame, trim, 0, side * (h / 2 + .035), face, w + .12, .065, .055);
      }
      box(frame, iron, side * w / 4, 0, .12, .026, h, .07);
    }
    box(frame, iron, 0, 0, .12, .045, h, .08);
    for (const y of [-h / 6, h / 6]) box(frame, iron, 0, y, .12, w, .032, .08);
    box(frame, trim, 0, -h / 2 - .12, .09, w + .3, .12, .82);
  }
  light(-6.4, -2.3, 0xffd7a5, 16, hall.y + 3.3);
  for (const x of [-1.8, 5.4]) {
    light(x, hall.z, 0xffd7a5, 45, hall.y + 3.5);
    cylinder(scene, iron, x, hall.y + 4.1, hall.z, .04, 1.1);
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(.9, .055, 6, 32)), iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, hall.y + 3.55, hall.z); scene.add(ring);
    for (let i = 0; i < 8; i++) candle(x + Math.cos(i * Math.PI / 4) * .9, hall.y + 3.55, hall.z + Math.sin(i * Math.PI / 4) * .9, .25);
  }
  const doors = new Map<string, THREE.Group>();
  for (const door of HOUSE_DOORS) {
    const width = door.width;
    const pivot = new THREE.Group();
    pivot.name = `Hinged door: ${door.name}`;
    pivot.position.set(door.x, door.y ?? 0, door.z);
    scene.add(pivot);
    doors.set(door.id, pivot);
    const leaf = new THREE.Group();
    if (door.axis === 'z') leaf.rotation.y = -Math.PI / 2;
    pivot.add(leaf);
    leaf.scale.y = door.height / 3.2;
    box(leaf, panel, width / 2, 1.6, 0, width, 3.2, 0.14);
    for (const x of [0.2, width - 0.2])
      box(leaf, wood, x, 1.6, 0, 0.13, 3.05, 0.2);
    for (const y of [0.25, 1.35, 2.9])
      box(leaf, iron, width / 2, y, 0, width, 0.08, 0.18);
    for (const side of [-1, 1]) {
      sphere(leaf, trim, width - 0.3, 1.42, side * 0.14, 0.065, 0.065, 0.065);
      box(leaf, trim, width / 2, 2.36, side * 0.083, 0.48, 0.24, 0.025);
    }
    const frame = new THREE.Group();
    frame.position.copy(pivot.position);
    if (door.axis === 'z') frame.rotation.y = -Math.PI / 2;
    scene.add(frame);
    for (const x of [-0.1, width + 0.1])
      box(frame, trim, x, door.height / 2, 0, 0.15, door.height, 0.3);
    box(frame, trim, width / 2, door.height + 0.08, 0, width + 0.35, 0.16, 0.3);
    box(
      frame,
      stone,
      width / 2,
      (door.height + 4.8) / 2,
      0,
      width + 0.2,
      4.8 - door.height,
      0.3,
    );
    // Legible door plaques are UI labels in world space, not external artwork.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = '#211d19';
      context.fillRect(0, 0, 512, 96);
      context.fillStyle = '#dfceac';
      context.textAlign = 'center';
      context.font = '32px Georgia';
      context.fillText(door.name, 256, 59);
      const plaque = new THREE.Mesh(
        own(new THREE.PlaneGeometry(1.6, 0.3)),
        own(
          new THREE.MeshBasicMaterial({
            map: own(new THREE.CanvasTexture(canvas)),
            side: THREE.DoubleSide,
          }),
        ),
      );
      plaque.position.set(
        width / 2,
        door.height + 0.38,
        door.axis === 'z' && door.x < 0 ? -0.19 : 0.19,
      );
      if (door.axis === 'z' && door.x < 0) plaque.rotation.y = Math.PI;
      frame.add(plaque);
    }
  }
  const bookMaterials = [
    material(0x653b32), material(0x29463f), material(0x343c54),
    material(0x765c38), material(0x51414c), material(0x817568),
  ];
  for (const item of HOUSE_FURNITURE) {
    const { x, z, width: w, depth: d, height: h } = item;
    if (item.kind === 'shelf') {
      box(scene, wood, x - w / 2 + .035, h / 2, z, .07, h, d);
      for (const sign of [-1, 1]) {
        box(scene, panel, x, h / 2, z + sign * (d / 2 - .055), w, h, .11);
        box(scene, trim, x + w / 2 - .018, h / 2, z + sign * (d / 2 - .055), .025, h - .1, .035);
      }
      box(scene, wood, x, h - .04, z, w + .03, .08, d + .06);
      box(scene, panel, x, .12, z, w, .24, d);
      for (let shelf = 0; shelf < 4; shelf++) {
        box(scene, panel, x, 0.35 + shelf * 0.75, z, w, 0.07, d);
        for (let book = 0; book < 12; book++) {
          const height = 0.34 + ((book * 7 + shelf * 3) % 5) * 0.055;
          const bookZ = z - d / 2 + .2 + book * (d - .38) / 12;
          const baseY = .39 + shelf * .75;
          box(
            scene,
            bookMaterials[(book * 3 + shelf) % bookMaterials.length],
            x + .025,
            baseY + height / 2,
            bookZ,
            0.34,
            height,
            0.085 + book % 3 * .012,
          );
          for (const bandY of [baseY + .06, baseY + height - .065])
            box(scene, trim, x + .199, bandY, bookZ, .009, .014, .078);
          if (book % 3 === 0) box(scene, paper, x + .201, baseY + height * .57, bookZ, .012, .1, .034);
        }
      }
    } else if (item.kind === 'chair') {
      box(scene, wood, x, 0.48, z, w, 0.16, d);
      box(scene, wood, x, 0.91, z + d / 2 - 0.05, w, 0.8, 0.1);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(
            scene,
            wood,
            x + sx * (w / 2 - 0.07),
            0.24,
            z + sz * (d / 2 - 0.07),
            0.08,
            0.48,
            0.08,
          );
    } else {
      box(scene, panel, x, h - 0.08, z, w, 0.16, d);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          box(
            scene,
            wood,
            x + sx * (w / 2 - 0.15),
            (h - 0.16) / 2,
            z + sz * (d / 2 - 0.15),
            0.12,
            h - 0.16,
            0.12,
          );
      if (x > 0 && x < 8.6) {
        for (const dz of [-0.35, 0.35]) {
          candle(x, h, z + dz, 0.35);
          for (const side of [-1, 1])
            cylinder(
              scene,
              paper,
              x + side * 0.7,
              h + 0.025,
              z + dz,
              0.23,
              0.035,
            );
        }
      } else if (x > 0) {
        for (let i = 0; i < 7; i++)
          candle(
            x + Math.cos((i * Math.PI * 2) / 7) * 0.36,
            h,
            z + Math.sin((i * Math.PI * 2) / 7) * 0.36,
            0.23 + (i % 3) * 0.08,
          );
        const orb = sphere(scene, cold, x, h + 0.26, z, 0.24, 0.24, 0.24);
        orb.name = 'Spirit glass';
      } else {
        box(scene, wood, x, h + .02, z, .7, .035, .48);
        for (const side of [-1, 1]) {
          const page = box(scene, paper, x + side * .16, h + .047, z, .32, .025, .43);
          page.rotation.z = side * -.06;
        }
        if (item.kind !== 'table') candle(x - 0.7, h, z, 0.23);
      }
    }
  }
  const ghosts: {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    eyes: THREE.MeshBasicMaterial;
    face: THREE.MeshBasicMaterial;
    room: (typeof HOUSE_ROOMS)[number];
  }[] = [];
  const shroud = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.5, 0),
        new THREE.Vector2(0.36, 0.25),
        new THREE.Vector2(0.24, 0.95),
        new THREE.Vector2(0.33, 1.35),
        new THREE.Vector2(0.19, 1.6),
        new THREE.Vector2(0.17, 1.76),
        new THREE.Vector2(0.1, 1.84),
        new THREE.Vector2(0, 1.87),
      ],
      16,
    ),
  );
  const cloth = shroud.getAttribute('position');
  for (let i = 0; i < cloth.count; i++) {
    const x = cloth.getX(i), y = cloth.getY(i), z = cloth.getZ(i);
    const angle = Math.atan2(z, x), fold = 1 + Math.sin(angle * 9 + y * 3) * .12;
    cloth.setXYZ(i, x * fold, y + (y < .3 ? Math.sin(angle * 11) * .12 : 0), z * fold * .7);
  }
  shroud.computeVertexNormals();
  for (const room of HOUSE_ROOMS) {
    light(room.x, room.z, room.accent, 32);
    // The front side rooms are calm, open galleries with no lurking figures.
    if (room.id === 'library' || room.id === 'dining') continue;
    const side = Math.sign(room.x);
    const ghostMaterial = own(
      new THREE.MeshBasicMaterial({
        color: 0x34434b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const mesh = new THREE.Mesh(shroud, ghostMaterial);
    mesh.position.set(room.x + side * .6, 0.2, room.z - room.depth / 2 + 1);
    mesh.scale.set(1.1, 1.35, 1.1);
    const eyes = own(new THREE.MeshBasicMaterial({ color: 0xe0faff, transparent: true, opacity: 0, depthWrite: false }));
    const face = own(new THREE.MeshBasicMaterial({ color: 0x010306, transparent: true, opacity: 0, depthWrite: false }));
    sphere(mesh, face, 0, 1.64, -.135, .135, .18, .07);
    for (const sign of [-1, 1])
      sphere(mesh, eyes, sign * .054, 1.68, -.202, .017, .008, .009);
    scene.add(mesh);
    ghosts.push({ mesh, material: ghostMaterial, eyes, face, room });
    for (const z of [
      room.z - room.depth / 2 + 0.4,
      room.z + room.depth / 2 - 0.4,
    ])
      box(scene, wood, room.x, 4.62, z, room.width - 0.2, 0.24, 0.24);
  }
  const particleZones = [HOUSE_HALL, ...HOUSE_ROOMS, { x: 0, z: -5, width: 12, depth: 7 }];
  const dustGeometry = own(new THREE.BufferGeometry());
  const dust = new Float32Array((mobile ? 360 : 850) * 3);
  const dustColors = new Float32Array(dust.length);
  const dustPalette = [0xffd98e, 0xffc572, 0x9ce7d5, 0xc6b4ff, 0xffb1c1].map(color => new THREE.Color(color));
  for (let i = 0; i < dust.length; i += 3) {
    dust[i] = Math.sin(i * 7.3) * 8.2;
    dust[i + 1] = (i % 41) / 10 + 0.2;
    dust[i + 2] = -5 + Math.cos(i * 4.7) * 3.7;
    dustPalette[(i / 3) % 5 < 3 ? 0 : (i / 3) % dustPalette.length].toArray(dustColors, i);
  }
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  dustGeometry.setAttribute('color', new THREE.BufferAttribute(dustColors, 3));
  const particles = new THREE.Points(
    dustGeometry,
    own(
      new THREE.PointsMaterial({
        color: 0xffffff,
        vertexColors: true,
        size: 0.032,
        transparent: true,
        opacity: 0.85,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  particles.name = 'Living gold throughout the manor';
  particles.frustumCulled = false;
  scene.add(particles);
  // Batch the many static furniture and masonry boxes without merging doors,
  // flames or apparitions. World-scaled UVs keep stone and flooring consistent.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const staticBoxes: THREE.Mesh[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.geometry !== boxGeometry) return;
    let parent: THREE.Object3D | null = object;
    while (parent && parent !== scene) {
      if ([...doors.values()].includes(parent as THREE.Group)) return;
      parent = parent.parent;
    }
    const mat = object.material as THREE.Material;
    if (mat.transparent) return;
    const geometry = boxGeometry.toNonIndexed().applyMatrix4(new THREE.Matrix4().copy(scene.matrixWorld).invert().multiply(object.matrixWorld));
    projectSurfaceUV(geometry, 2);
    const batch = batches.get(mat) ?? [];
    batch.push(geometry); batches.set(mat, batch); staticBoxes.push(object);
  });
  for (const object of staticBoxes) object.removeFromParent();
  for (const [mat, geometries] of batches) {
    const geometry = mergeGeometries(geometries, false)!;
    geometries.forEach(part => part.dispose());
    const mesh = new THREE.Mesh(own(geometry), mat);
    mesh.name = 'House masonry and furnishings';
    mesh.castShadow = !mobile; mesh.receiveShadow = true; scene.add(mesh);
  }
  const projectFrames = createHallFrames(scene);
  return {
    doors,
    projectFrames,
    setMode(this: void, value: IslandMode) { mode = value; },
    setHallSettings(this: void, settings: HallSettings, active: boolean) {
      hallSettings = settings;
      inMasterHall = active;
    },
    update(time: number, camera: THREE.Camera, reduced: boolean) {
      const visitor = scene.worldToLocal(camera.position.clone());
      const lighting = hallLighting(hallSettings);
      indoorAmbient.intensity = inMasterHall ? lighting.ambient : .85;
      if (hallShadow) hallShadow.visible = hallSettings.lights;
      glass.emissiveIntensity = inMasterHall ? lighting.windowGlow : .18;
      lights.forEach((lamp, index) => {
        // A slow, local candle eclipse precedes each apparition. No strobing.
        const dread = reduced || mode !== 'night' ? 0 : Math.pow(Math.max(0, Math.sin(time * .22 + index * 1.6)), 10);
        const proximity = 1 - THREE.MathUtils.smoothstep(visitor.distanceTo(lamp.position), 3, 10);
        lamp.intensity =
          (lamp.userData.baseIntensity as number) *
          (reduced
            ? 1
            : 0.96 +
              Math.sin(time * 2.3 + index) * 0.025 +
              Math.sin(time * 6.1 + index) * 0.015) * (1 - dread * proximity * .62);
        lamp.intensity *= inMasterHall ? lighting.lamps : 1;
      });
      flames.forEach((flame, index) => {
        flame.visible = !inMasterHall || hallSettings.lights;
        flame.scale.y = reduced
          ? 0.095
          : 0.09 + Math.sin(time * 5 + index) * 0.01;
      });
      ghosts.forEach((ghost, index) => {
        const distance = visitor.distanceTo(ghost.mesh.position);
        const pulse = reduced
          ? 0.12
          : Math.pow(Math.max(0, Math.sin(time * 0.22 + index * 1.6)), 6) *
            0.62;
        ghost.material.opacity =
          (mode === 'night' ? pulse : 0) * THREE.MathUtils.smoothstep(distance, 2, 5);
        ghost.eyes.opacity = Math.min(1, ghost.material.opacity * 1.8);
        ghost.face.opacity = Math.min(1, ghost.material.opacity * 1.7);
        ghost.mesh.rotation.y = Math.atan2(ghost.mesh.position.x - visitor.x, ghost.mesh.position.z - visitor.z);
        ghost.mesh.position.y = reduced
          ? 0.2
          : 0.2 + Math.sin(time * 0.6 + index) * 0.12;
      });
      particles.position.y = reduced ? 0 : Math.sin(time * 0.15) * 0.12;
      if (!reduced) {
        for (let i = 0; i < dust.length; i += 3) {
          const n = i / 3;
          const room = particleZones[n % particleZones.length];
          const angle = n * 2.39996 + time * (.22 + (n % 7) * .025);
          const radius = (room.width / 2 - .3) * (.15 + (n % 19) / 19 * .8);
          dust[i] = room.x + Math.cos(angle) * radius;
          dust[i + 2] = room.z + Math.sin(angle * .8 + Math.sin(time * .45 + n) * .3) * (room.depth / 2 - .35);
          dust[i + 1] = (n % 6 === 5 ? 5 : 0) + .25 + (((i % 41) / 10 + time * (.22 + (i % 5) * .035)) % 4);
        }
        dustGeometry.attributes.position.needsUpdate = true;
      }
    },
    dispose() {
      disposed = true;
      projectFrames.dispose();
      resources.forEach((resource) => resource.dispose());
    },
  };
}
