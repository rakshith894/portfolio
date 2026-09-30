import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundHeight, onIsland, pathDistance, cemeteryFences, distanceToSegment } from './reference-layout.ts';

type Disposable = { dispose: () => void };
export type GraveKind = 'cross' | 'lancet' | 'chest' | 'obelisk' | 'broken';
export type GravePlacement = {
  x: number;
  z: number;
  scale: number;
  turn: number;
  kind: GraveKind;
};

export function cemeteryLayout(mobile: boolean): GravePlacement[] {
  let seed = 8613;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const graves: GravePlacement[] = [];
  const kinds: GraveKind[] = ['cross', 'lancet', 'chest', 'obelisk', 'broken'];
  function place(
    x: number,
    z: number,
    scale: number,
    kind: GraveKind,
    turn: number,
  ) {
    if (
      !onIsland(x, z, 3) ||
      pathDistance(x, z) < 4.4 ||
      graves.some(
        (grave) =>
          Math.hypot(grave.x - x, grave.z - z) <
          2.25 * Math.max(grave.scale, scale),
      )
    )
      return;
    graves.push({ x, z, scale, kind, turn });
  }
  // Large foreground monuments establish the reference's varied, worn silhouettes.
  place(27, 20, 1.28, 'cross', -0.15);
  place(11, 19, 1.12, 'lancet', 0.16);
  place(5, 11, 1.22, 'chest', -0.15);
  place(27, 11, 1.12, 'obelisk', -0.2);
  place(-4, 20, 1.1, 'cross', 0.15);
  place(9, 5, 1.18, 'broken', -0.12);
  for (
    let attempt = 0;
    graves.length < (mobile ? 45 : 66) && attempt < 2400;
    attempt++
  ) {
    place(
      -15 + random() * 44,
      -14 + random() * 42,
      0.8 + random() * 0.35,
      kinds[graves.length % kinds.length],
      (random() - 0.5) * 0.5,
    );
  }
  return graves.filter(({x,z,scale,kind}) =>
    distanceToSegment(x,z,23,-13.5,32,-13.5)>=1.1+2.4*scale &&
    !cemeteryFences.some(points=>points.slice(1).some(([bx,bz],i)=>distanceToSegment(x,z,...points[i],bx,bz)<1+scale*(kind==='chest'?2.4:1))));
}

/** Sculpted tombs, not image billboards; silhouettes and carvings survive a full orbit. */
export function createReferenceGraves(
  source: THREE.MeshStandardMaterial,
  resources: Set<Disposable>,
  mobile: boolean,
) {
  const own = <T extends Disposable>(resource: T) => {
    resources.add(resource);
    return resource;
  };
  const stone = own(source.clone());
  stone.name = 'Rain-darkened limestone with lichen';
  stone.color.set(0x9ea7a1);
  stone.roughness = 0.68;
  stone.normalScale.setScalar(0.7);
  stone.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 gravePosition;varying vec3 graveNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\ngravePosition=position;graveNormal=normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 gravePosition;varying vec3 graveNormal;
float graveNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec4 h=fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1.,0.),vec2(127.1,311.7)),dot(i+vec2(0.,1.),vec2(127.1,311.7)),dot(i+1.,vec2(127.1,311.7))))*43758.5453);return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
vec2 mossCoord=gravePosition.xz*2.7+gravePosition.y*vec2(.72,.53);
float mossField=graveNoise(mossCoord)*.62+graveNoise(mossCoord*3.7)*.25+graveNoise(mossCoord*11.)*.13;
float mossCover=smoothstep(.50,.71,mossField+max(graveNormal.y,0.)*.1);
float limestone=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
diffuseColor.rgb=mix(vec3(limestone)*vec3(.85,.92,.94),vec3(.048,.064,.035),mossCover*.55);
diffuseColor.rgb*=.73+graveNoise(mossCoord*.6)*.38;`,
      );
  };
  stone.customProgramCacheKey = () => 'nocturne-weathered-graves-1';
  const carving = own(stone.clone());
  carving.color.set(0x444e49);
  carving.onBeforeCompile = stone.onBeforeCompile.bind(stone);
  carving.customProgramCacheKey = stone.customProgramCacheKey.bind(stone);
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const root = new THREE.Group();
  root.name = 'Weathered Gothic cemetery';
  const templates = new Map<
    GraveKind,
    { geometry: THREE.BufferGeometry; material: THREE.Material }[]
  >();
  let current: { geometry: THREE.BufferGeometry; material: THREE.Material }[] =
    [];
  function part(
    g: THREE.BufferGeometry,
    x = 0,
    y = 0,
    z = 0,
    material: THREE.Material = stone,
  ) {
    g.translate(x, y, z);
    current.push({ geometry: g, material });
  }
  function slab(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material = stone,
  ) {
    const shape = new THREE.Shape([
      new THREE.Vector2(-w / 2, -h / 2),
      new THREE.Vector2(w / 2, -h / 2),
      new THREE.Vector2(w / 2, h / 2),
      new THREE.Vector2(-w / 2, h / 2),
    ]);
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: d,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.025,
      bevelSegments: 2,
      steps: 1,
    });
    g.translate(0, 0, -d / 2);
    part(g, x, y, z, material);
  }
  function plinth(width = 1.25, depth = 0.9) {
    slab(width + 0.2, 0.2, depth + 0.15, 0, 0.09, 0);
    slab(width, 0.24, depth, 0, 0.28, 0);
    slab(width + 0.09, 0.1, depth + 0.07, 0, 0.46, 0);
  }
  function lancet(w: number, h: number, broken = false) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h * 0.7);
    if (broken) {
      s.lineTo(w * 0.3, h * 0.91);
      s.lineTo(w * 0.12, h * 0.8);
      s.lineTo(-w * 0.13, h);
      s.lineTo(-w * 0.36, h * 0.94);
    } else {
      s.quadraticCurveTo(w * 0.46, h * 0.84, w * 0.23, h * 0.86);
      s.quadraticCurveTo(w * 0.13, h * 0.97, 0, h);
      s.quadraticCurveTo(-w * 0.13, h * 0.97, -w * 0.23, h * 0.86);
      s.quadraticCurveTo(-w * 0.46, h * 0.84, -w / 2, h * 0.7);
    }
    s.lineTo(-w / 2, h * 0.7);
    s.closePath();
    return s;
  }
  function raisedShape(
    shape: THREE.Shape,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material = stone,
  ) {
    part(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelSize: 0.035,
        bevelThickness: 0.025,
        bevelSegments: 2,
        curveSegments: 12,
      }),
      x,
      y,
      z,
      material,
    );
  }
  function smallCross(y: number, z: number, scale: number) {
    slab(0.13 * scale, 0.76 * scale, 0.04, 0, y, z, carving);
    slab(0.5 * scale, 0.12 * scale, 0.04, 0, y + 0.12 * scale, z, carving);
  }
  for (const kind of [
    'cross',
    'lancet',
    'chest',
    'obelisk',
    'broken',
  ] as GraveKind[]) {
    current = [];
    if (kind === 'chest') slab(1.2, .18, .35, 0, .09, -.38);
    else plinth(kind === 'cross' ? 1.42 : 1.2);
    if (kind === 'cross') {
      const cross = new THREE.Shape([
        new THREE.Vector2(-0.25, 0),
        new THREE.Vector2(0.25, 0),
        new THREE.Vector2(0.21, 1.42),
        new THREE.Vector2(0.86, 1.42),
        new THREE.Vector2(0.86, 1.76),
        new THREE.Vector2(0.21, 1.76),
        new THREE.Vector2(0.21, 2.34),
        new THREE.Vector2(-0.21, 2.34),
        new THREE.Vector2(-0.21, 1.76),
        new THREE.Vector2(-0.86, 1.76),
        new THREE.Vector2(-0.86, 1.42),
        new THREE.Vector2(-0.21, 1.42),
      ]);
      raisedShape(cross, 0.32, 0, 0.48, -0.16);
      part(new THREE.TorusGeometry(0.56, 0.125, 8, 40), 0, 2.07, 0);
      for (const side of [-1, 1]) {
        part(
          new THREE.TorusGeometry(0.45, 0.027, 6, 40),
          0,
          2.07,
          side * 0.185,
          carving,
        );
        slab(0.095, 2.04, 0.028, 0, 1.68, side * 0.2, carving);
        slab(1.4, 0.075, 0.028, 0, 2.08, side * 0.2, carving);
        part(new THREE.TorusGeometry(0.12, 0.031, 6, 16), 0, 2.08, side * 0.23);
      }
    } else if (kind === 'lancet' || kind === 'broken') {
      raisedShape(
        lancet(1.1, kind === 'broken' ? 1.82 : 2.12, kind === 'broken'),
        0.28,
        0,
        0.47,
        -0.14,
      );
      if (kind === 'lancet') {
        raisedShape(lancet(0.83, 1.75), 0.018, 0, 0.59, 0.17, carving);
        raisedShape(lancet(0.68, 1.58), 0.022, 0, 0.67, 0.192);
      }
      smallCross(1.58, 0.24, 0.75);
      for (let line = 0; line < 4; line++)
        slab(
          0.42 - line * 0.045,
          0.018,
          0.016,
          0,
          0.91 + line * 0.09,
          0.242,
          carving,
        );
    } else if (kind === 'obelisk') {
      slab(0.79, 1.74, 0.7, 0, 1.34, 0);
      slab(1.04, 0.13, 0.93, 0, 2.22, 0);
      slab(0.95, 0.19, 0.84, 0, 2.4, 0);
      part(new THREE.CylinderGeometry(0.05, 0.62, 0.47, 4), 0, 2.75, 0);
      part(new THREE.SphereGeometry(0.12, 10, 8), 0, 3.03, 0);
      smallCross(1.5, 0.39, 0.8);
    } else {
      raisedShape(lancet(0.98, 1.44), 0.27, 0, 0.47, -0.14);
      const coffin = new THREE.Shape([
        new THREE.Vector2(-0.37, -0.23),
        new THREE.Vector2(0.37, -0.23),
        new THREE.Vector2(0.55, 0.35),
        new THREE.Vector2(0.45, 1.76),
        new THREE.Vector2(0.27, 2.13),
        new THREE.Vector2(-0.27, 2.13),
        new THREE.Vector2(-0.45, 1.76),
        new THREE.Vector2(-0.55, 0.35),
      ]);
      for (const [y, depth, enlargement] of [
        [0.04, 0.37, 1],
        [0.43, 0.13, 1.08],
      ] as const) {
        const outline = coffin.clone();
        if (y === .04) outline.holes.push(new THREE.Path(coffin.getPoints().map(point => new THREE.Vector2(point.x * .78, .95 + (point.y - .95) * .85)).reverse()));
        const g = new THREE.ExtrudeGeometry(outline, {
          depth,
          bevelEnabled: true,
          bevelSize: 0.045,
          bevelThickness: 0.035,
          bevelSegments: 2,
        });
        g.rotateX(Math.PI / 2);
        g.translate(0, depth, 0);
        g.scale(enlargement, 1, enlargement);
        part(g, 0, y, 0);
        g.userData.terrainFoundation = y === 0.04;
        g.userData.coffinLid = y === 0.43;
      }
      const floor = new THREE.ExtrudeGeometry(coffin, { depth: .12, bevelEnabled: false });
      floor.rotateX(Math.PI / 2); floor.translate(0, .16, -.95); floor.scale(.99, 1, .99); floor.translate(0, 0, .95);
      floor.userData.terrainFoundation = true;
      part(floor, 0, 0, 0, carving);
      slab(0.11, 0.035, 1.2, 0, 0.625, 1.05, carving);
      current[current.length - 1].geometry.userData.coffinLid = true;
      slab(0.57, 0.035, 0.11, 0, 0.625, 0.7, carving);
      current[current.length - 1].geometry.userData.coffinLid = true;
    }
    templates.set(kind, current);
  }
  const placements = cemeteryLayout(mobile);
  const coffins: { id: number; hinge: THREE.Group; root: THREE.Group; grave: GravePlacement; open: boolean }[] = [];
  const transform = new THREE.Matrix4(),
    rotation = new THREE.Quaternion();
  placements.forEach((grave, index) => {
    let animated: (typeof coffins)[number] | undefined;
    if (grave.kind === 'chest') {
      const tomb = new THREE.Group(), hinge = new THREE.Group();
      tomb.position.set(grave.x, groundHeight(grave.x, grave.z), grave.z);
      tomb.rotation.y = grave.turn;
      tomb.scale.setScalar(grave.scale);
      hinge.position.set(-0.57, 0.43, 0);
      tomb.add(hinge); root.add(tomb);
      animated = { id: coffins.length, root: tomb, hinge, grave, open: false };
      tomb.userData.coffin = animated.id;
      coffins.push(animated);
      const hit = new THREE.Mesh(own(new THREE.BoxGeometry(1.3, 1.2, 2.8)), own(new THREE.MeshBasicMaterial({ visible: false })));
      hit.position.set(0, 0.6, 1); hit.userData.coffin = animated.id; tomb.add(hit);
    }
    rotation.setFromEuler(
      new THREE.Euler(
        0,
        grave.turn,
        grave.kind === 'chest' ? 0 : grave.kind === 'broken' ? -0.065 : Math.sin(index * 7.3) * 0.015,
      ),
    );
    transform.compose(
      new THREE.Vector3(grave.x, groundHeight(grave.x, grave.z), grave.z),
      rotation,
      new THREE.Vector3().setScalar(grave.scale),
    );
    for (const { geometry, material } of templates.get(grave.kind)!) {
      const g = geometry.clone();
      const p = g.getAttribute('position'),
        n = g.getAttribute('normal'),
        uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i),
          z = p.getZ(i);
        const wear =
          Math.sin(x * 31 + y * 19 + z * 23) *
          Math.sin(y * 29 - z * 17) *
          0.009;
        p.setXYZ(i, x + wear, y + wear * 0.7, z + wear * 0.65);
        uv[i * 2] = Math.abs(n.getX(i)) > 0.5 ? z : x;
        uv[i * 2 + 1] = Math.abs(n.getY(i)) > 0.5 ? z : y;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      if (animated && geometry.userData.coffinLid) {
        g.translate(0.57, -0.43, 0);
        const lid = new THREE.Mesh(own(g), material);
        lid.castShadow = !mobile; lid.receiveShadow = true;
        lid.userData.coffin = animated.id; animated.hinge.add(lid);
        continue;
      }
      g.applyMatrix4(transform);
      if (geometry.userData.terrainFoundation) {
        // Extend the lower course into the hillside while keeping the lid level.
        const original = geometry.getAttribute('position');
        for (let i = 0; i < p.count; i++) {
          if (original.getY(i) < 0.12) {
            p.setY(
              i,
              Math.min(p.getY(i), groundHeight(p.getX(i), p.getZ(i)) - 0.06),
            );
          }
        }
        g.computeVertexNormals();
      }
      const list = groups.get(material) ?? [];
      list.push(g);
      groups.set(material, list);
    }
  });
  for (const [material, parts] of groups) {
    const normalized = parts.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (n !== g) g.dispose();
      return n;
    });
    const merged = mergeGeometries(normalized, false);
    normalized.forEach((g) => g.dispose());
    if (!merged) throw new Error('Cemetery geometry could not be assembled');
    const mesh = new THREE.Mesh(own(merged), material);
    mesh.castShadow = !mobile;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  for (const template of templates.values())
    for (const part of template) part.geometry.dispose();
  return { root, placements, coffins };
}
