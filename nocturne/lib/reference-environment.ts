import { createOceanTraffic } from './island-traffic.ts';
import { createRowboatOars } from './island-rowing.ts';
import { createHaunting } from './island-haunting.ts';
import {
  SHORE_ROUTE,
  TOWER_ROUTE,
  BRIDGE_ROUTE,
  stairTreads,
  stairRails,
  BOAT_DOCK,
  BOAT_MOORING,
  DOCK_HEIGHT,
} from './island-stairs.ts';
import { islandLamps } from './island-lamps.ts';
import * as THREE from 'three';
import type { IslandMode } from './island-mode.ts';
import { addWinterSurface } from './winter-surface.ts';
import { createSeasonalTrees } from './seasonal-trees.ts';
import { createTreeBark } from './tree-bark.ts';
import { projectSurfaceUV } from './surface-uv.ts';
import { clearStairScenery } from './stair-clearance.ts';
import { createShoreCamera } from './shore-camera.ts';
import { coastalRocks, stairSupports } from './coastal-layout.ts';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/addons/utils/BufferGeometryUtils.js';
import { createReferenceManor } from './reference-manor.ts';
import { createReferenceGraves } from './reference-graves.ts';
import { createIslandWeather } from './island-weather.ts';
import { createIslandLife } from './island-life.ts';
import { oceanSample } from './island-motion.ts';
import { loadCoastalProps } from './island-props.ts';
import {
  MANOR_ORIGIN,
  approach,
  coastPoint,
  groundHeight,
  onIsland,
  pathDistance,
  gatePoint,
  referenceCoastGLSL,
  cemeteryFences,
  cemeteryTrees,
  cemeteryRocks,
  perimeterFenceSegments,
  bridgeParapets,
} from './reference-layout.ts';

type Disposable = { dispose: () => void };

/** Full, freely orbitable geometry laid out from the two reference views. */
export function createReferenceEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  resources: Set<Disposable>,
  mobile: boolean,
) {
  let disposed = false,
    seed = 1942;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const own = <T extends Disposable>(value: T): T => {
    resources.add(value);
    return value;
  };
  const pending: Promise<unknown>[] = [];
  const shoreCamera = own(createShoreCamera());
  const loader = new THREE.TextureLoader();
  const textures = new Map<
    string,
    { texture: THREE.Texture; ready: Promise<void> }
  >();
  const load = (url: string, srgb = false) => {
    const key = `${url}:${srgb}`;
    const cached = textures.get(key);
    if (cached) return cached;
    let finish!: () => void;
    const ready = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const texture = own(
      loader.load(
        url,
        () => {
          if (disposed) texture.dispose();
          finish();
        },
        undefined,
        finish,
      ),
    );
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    pending.push(ready);
    const loaded = { texture, ready };
    textures.set(key, loaded);
    return loaded;
  };
  const material = (
    color: number,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) =>
    own(new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
  const stone = material(0x839092),
    darkStone = material(0x586369),
    edge = material(0x929b9c);
  const wood = material(0x28282b),
    perimeterWood = material(0x4a3024, { roughness: 0.95 }),
    iron = material(0x303c40, { metalness: 0.75, roughness: 0.38 });
  const bark = createTreeBark(resources);
  const amber = material(0xc49b61, {
    emissive: 0xffaf62,
    emissiveIntensity: 1.45,
  });
  const roof = material(0x28313a, { metalness: 0.25, roughness: 0.48 }),
    voidMat = material(0x080e13);
  const rock = material(0x737b7c, { side: THREE.DoubleSide }),
    soil = material(0x6a7166, { side: THREE.DoubleSide }),
    graveStone = material(0x7e8b90);
  rock.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),diffuseColor.rgb,.18);',
    );
  };
  const path = own(
    new THREE.MeshPhysicalMaterial({
      color: 0x747e7c,
      roughness: 0.72,
      metalness: 0.015,
      clearcoat: 0.2,
      clearcoatRoughness: 0.38,
    }),
  );
  function surface(
    mat: THREE.MeshStandardMaterial,
    name: string,
    normal: number,
  ) {
    mat.map = load(`/materials/${name}-color.webp`, true).texture;
    mat.normalMap = load(`/materials/${name}-normal.webp`).texture;
    mat.roughnessMap = load(`/materials/${name}-roughness.webp`).texture;
    mat.normalScale.setScalar(normal);
  }
  surface(stone, 'stone', 0.85);
  surface(darkStone, 'stone', 0.9);
  surface(edge, 'stone', 0.65);
  surface(rock, 'rock', 0.55);
  surface(soil, 'ground', 0.95);
  surface(path, 'path', 0.55);
  path.roughnessMap = null;
  path.roughness = 0.78;
  path.clearcoat = 0.08;
  surface(roof, 'stone', 0.45);
  surface(graveStone, 'rock', 0.3);
  graveStone.onBeforeCompile = rock.onBeforeCompile.bind(rock);
  soil.onBeforeCompile = (shader) => {
    shader.uniforms.groundRock = { value: rock.map };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 terrainPosition;varying vec3 terrainNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nterrainPosition=position;terrainNormal=normal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 terrainPosition;varying vec3 terrainNormal;uniform sampler2D groundRock;',
      )
      .replace(
        '#include <map_fragment>',
        // Excavating the stairs adds vertical retaining faces. Sampling only XZ
        // collapses their texture to a single row, producing the dark streaked
        // panels beside the lanterns. Blend physical-scale projections instead.
        '#include <map_fragment>\nvec3 rockWeights=pow(abs(normalize(terrainNormal)),vec3(6.));rockWeights/=max(dot(rockWeights,vec3(1.)),.001);float rockBlend=smoothstep(.22,.8,sin(terrainPosition.x*.24+sin(terrainPosition.z*.18))*sin(terrainPosition.z*.3)*.5+.5);vec3 crag=texture2D(groundRock,terrainPosition.yz/3.).rgb*rockWeights.x+texture2D(groundRock,terrainPosition.xz/3.).rgb*rockWeights.y+texture2D(groundRock,terrainPosition.xy/3.).rgb*rockWeights.z;crag=vec3(dot(crag,vec3(.2126,.7152,.0722)))*vec3(.13,.15,.14);diffuseColor.rgb=mix(diffuseColor.rgb,crag,rockBlend*.55);',
      );
  };
  const winterCover = { value: 0 };
  for (const mat of [
    stone,
    darkStone,
    edge,
    rock,
    soil,
    path,
    roof,
    graveStone,
    perimeterWood,
  ])
    addWinterSurface(mat, winterCover);
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const boxGeo = own(new THREE.BoxGeometry(1, 1, 1));
  const orbGeo = own(new THREE.SphereGeometry(1, 10, 8));
  const matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion(),
    rotation = new THREE.Euler();
  function add(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
    ry = 0,
    rz = 0,
  ) {
    const copy = geometry.clone();
    quaternion.setFromEuler(rotation.set(0, ry, rz));
    matrix.compose(
      new THREE.Vector3(x, y, z),
      quaternion,
      new THREE.Vector3(sx, sy, sz),
    );
    copy.applyMatrix4(matrix);
    // The headland supplies one continuous retaining shell. Sealing every rock
    // as well creates overlapping walls on the same cut plane (visible flicker).
    if (mat === rock) clearStairScenery(copy);
    const list = groups.get(mat) ?? [];
    list.push(copy);
    groups.set(mat, list);
  }
  const box = (
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    ry = 0,
    rz = 0,
  ) => add(boxGeo, mat, x, y, z, w, h, d, ry, rz);
  function taper(
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    top: number,
    bottom: number,
    h: number,
    sides = 8,
  ) {
    const g = new THREE.CylinderGeometry(top, bottom, h, sides);
    add(g, mat, x, y, z);
    g.dispose();
  }
  function beam(
    a: THREE.Vector3,
    b: THREE.Vector3,
    radius: number,
    end: number,
    mat: THREE.Material,
  ) {
    const delta = b.clone().sub(a),
      g = new THREE.CylinderGeometry(
        end,
        radius,
        delta.length(),
        mat === bark ? (radius > 0.15 ? 12 : 8) : 6,
      );
    quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      delta.normalize(),
    );
    matrix.compose(
      a.clone().add(b).multiplyScalar(0.5),
      quaternion,
      new THREE.Vector3(1, 1, 1),
    );
    g.applyMatrix4(matrix);
    const list = groups.get(mat) ?? [];
    list.push(g);
    groups.set(mat, list);
  }
  const navigationSurfaces: THREE.Object3D[] = [];
  function meshGeometry(
    positions: number[],
    uv: number[],
    indices: number[],
    mat: THREE.Material,
    name: string,
  ) {
    const geo = own(new THREE.BufferGeometry());
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    // Sampled terrain and cliff triangles must leave the same corridor as rocks.
    clearStairScenery(geo, name === 'Sloping cemetery headland');
    shoreCamera.add(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.receiveShadow = true;
    scene.add(mesh);
    navigationSurfaces.push(mesh);
    return mesh;
  }

  const segments = 160,
    rings = 40,
    vertices: number[] = [],
    uv: number[] = [],
    triangles: number[] = [];
  for (let r = 0; r <= rings; r++)
    for (let s = 0; s <= segments; s++) {
      const p = coastPoint((s / segments) * Math.PI * 2, r / rings);
      vertices.push(p.x, groundHeight(p.x, p.y), p.y);
      uv.push(p.x / 4, p.y / 4);
    }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s,
        b = a + segments + 1;
      triangles.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const ground = meshGeometry(
    vertices,
    uv,
    triangles,
    soil,
    'Sloping cemetery headland',
  );
  const cliffVertices: number[] = [],
    cliffUvs: number[] = [],
    cliffIndices: number[] = [];
  for (let r = 0; r <= 8; r++)
    for (let s = 0; s <= segments; s++) {
      const a = (s / segments) * Math.PI * 2,
        f = r / 8,
        p = coastPoint(a);
      const ridge =
        f * (Math.sin(a * 39 + r * 0.7) * 1.15 + Math.cos(a * 23) * 0.9 + 1.5);
      cliffVertices.push(
        p.x + Math.cos(a) * ridge,
        THREE.MathUtils.lerp(groundHeight(p.x, p.y), -17.5, f),
        p.y + Math.sin(a) * ridge,
      );
      cliffUvs.push((s / segments) * 55, r * 0.8);
    }
  for (let r = 0; r < 8; r++)
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s,
        b = a + segments + 1;
      cliffIndices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const cliffs = meshGeometry(
    cliffVertices,
    cliffUvs,
    cliffIndices,
    rock,
    'Continuous cliffs to below the sea',
  );
  cliffs.castShadow = !mobile;
  function createCrag(detail: number) {
    const rawCrag = new THREE.IcosahedronGeometry(1, detail);
    rawCrag.deleteAttribute('normal');
    rawCrag.deleteAttribute('uv');
    const geometry = own(mergeVertices(rawCrag));
    rawCrag.dispose();
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i);
      p.multiplyScalar(
        1 + Math.sin(p.x * 11 + p.z * 5) * 0.17 + Math.cos(p.y * 15) * 0.1,
      );
      positions.setXYZ(i, p.x, p.y, p.z);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  const crag = createCrag(5),
    scatterCrag = createCrag(2);
  for (const boulder of coastalRocks(mobile)) {
    add(
      crag,
      rock,
      boulder.x,
      boulder.y,
      boulder.z,
      boulder.sx,
      boulder.sy,
      boulder.sz,
      boulder.turn,
      boulder.tilt,
    );
  }

  // A continuous wet ribbon, with individual raised cobbles and irregular curbs.
  const pavingVertices: number[] = [],
    pavingUvs: number[] = [],
    pavingIndices: number[] = [];
  const rows = 190,
    across = 8;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows,
      p = approach.getPointAt(t),
      tangent = approach.getTangentAt(t),
      normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    for (let c = 0; c <= across; c++) {
      const q = p.clone().addScaledVector(normal, (c / across - 0.5) * 4.4);
      pavingVertices.push(q.x, groundHeight(q.x, q.z) + 0.12, q.z);
      pavingUvs.push((c / across) * 1.8, t * 25);
    }
    if (i < rows)
      for (let c = 0; c < across; c++) {
        const a = i * (across + 1) + c,
          b = a + across + 1;
        pavingIndices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    if (i % 2 === 0)
      for (const side of [-1, 1]) {
        const q = p.clone().addScaledVector(normal, side * 2.38);
        box(
          darkStone,
          q.x,
          groundHeight(q.x, q.z) + 0.18,
          q.z,
          0.28,
          0.3,
          0.51,
          Math.atan2(tangent.x, tangent.z),
        );
      }
  }
  meshGeometry(
    pavingVertices,
    pavingUvs,
    pavingIndices,
    path,
    'Winding wet cobblestone approach',
  );
  // Close-range cobbles share a single draw call.
  const cobbleShape = new THREE.Shape([
    new THREE.Vector2(-0.5, -0.5),
    new THREE.Vector2(0.5, -0.5),
    new THREE.Vector2(0.5, 0.5),
    new THREE.Vector2(-0.5, 0.5),
  ]);
  const cobbleGeo = own(
    new THREE.ExtrudeGeometry(cobbleShape, {
      depth: 0.13,
      bevelEnabled: true,
      bevelSize: 0.055,
      bevelThickness: 0.045,
      bevelSegments: 1,
      steps: 1,
    }),
  );
  cobbleGeo.rotateX(-Math.PI / 2);
  const cobbles = own(new THREE.InstancedMesh(cobbleGeo, path, 170 * 7)),
    dummy = new THREE.Object3D();
  let cobbleIndex = 0;
  for (let i = 0; i < 170; i++) {
    const t = (i + 0.5) / 170,
      p = approach.getPointAt(t),
      tangent = approach.getTangentAt(t),
      normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    for (let c = 0; c < 7; c++) {
      const q = p
        .clone()
        .addScaledVector(normal, (c - 3) * 0.59 + (i % 2 ? 0.08 : -0.08));
      dummy.position.set(
        q.x,
        groundHeight(q.x, q.z) + 0.09 + rand() * 0.03,
        q.z,
      );
      dummy.rotation.set(
        0,
        Math.atan2(tangent.x, tangent.z) + (rand() - 0.5) * 0.15,
        0,
      );
      dummy.scale.set(
        0.44 + rand() * 0.1,
        0.28 + rand() * 0.24,
        0.27 + rand() * 0.06,
      );
      dummy.updateMatrix();
      cobbles.setMatrixAt(cobbleIndex++, dummy.matrix);
    }
  }
  cobbles.receiveShadow = true;
  scene.add(cobbles);
  const manor = createReferenceManor(
    { stone, darkStone, edge, wood, iron, amber, roof, voidMat },
    resources,
    mobile,
  );
  manor.position.copy(MANOR_ORIGIN);
  scene.add(manor);

  const fires: THREE.Mesh[] = [];
  const lampSources: THREE.Vector3[] = [];
  const localLights = Array.from({ length: mobile ? 5 : 10 }, () => {
    const light = new THREE.PointLight(0xffbc80, 0, 17, 2);
    scene.add(light);
    return light;
  });
  const glowMat = own(
    new THREE.SpriteMaterial({
      color: 0xffa95f,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  // Radial glow texture is an effect, not a replacement for the modeled scenery.
  const glowPixels = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4,
        d = Math.hypot(x - 31.5, y - 31.5) / 31.5;
      glowPixels[i] = glowPixels[i + 1] = glowPixels[i + 2] = 255;
      glowPixels[i + 3] = Math.round(Math.max(0, 1 - d) ** 3 * 255);
    }
  const glowMap = own(new THREE.DataTexture(glowPixels, 64, 64));
  glowMap.needsUpdate = true;
  glowMat.map = glowMap;
  function lantern(
    x: number,
    y: number,
    z: number,
    tall = false,
    light = false,
  ) {
    if (tall) {
      taper(iron, x, y + 0.85, z, 0.05, 0.11, 1.7);
      y += 1.7;
    }
    box(iron, x, y, z, 0.38, 0.08, 0.38);
    box(iron, x, y + 0.56, z, 0.46, 0.08, 0.46);
    taper(iron, x, y + 0.69, z, 0, 0.29, 0.24, 4);
    for (const dx of [-0.16, 0.16])
      for (const dz of [-0.16, 0.16])
        box(iron, x + dx, y + 0.28, z + dz, 0.027, 0.56, 0.027);
    const fire = new THREE.Mesh(orbGeo, amber);
    fire.position.set(x, y + 0.26, z);
    fire.scale.set(0.075, 0.2, 0.075);
    scene.add(fire);
    fires.push(fire);
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(fire.position);
    glow.scale.set(2, 2, 1);
    scene.add(glow);
    if (light) {
      lampSources.push(fire.position.clone());
    }
  }
  const fencePosts = new Set<string>();
  const fenceBars = new Set<string>();
  function pillar(x: number, z: number, height = 2.6) {
    const key = `${x.toFixed(3)},${z.toFixed(3)}`;
    if (fencePosts.has(key)) return;
    fencePosts.add(key);
    const y = groundHeight(x, z);
    box(darkStone, x, y + height / 2, z, 0.62, height, 0.62);
    box(edge, x, y + height, z, 0.87, 0.18, 0.87);
    taper(stone, x, y + height + 0.3, z, 0.06, 0.35, 0.5, 4);
  }
  function fence(points: [number, number][]) {
    for (let part = 0; part < points.length - 1; part++) {
      const [ax, az] = points[part],
        [bx, bz] = points[part + 1],
        distance = Math.hypot(bx - ax, bz - az),
        steps = Math.ceil(distance / 0.32);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps,
          x = THREE.MathUtils.lerp(ax, bx, t),
          z = THREE.MathUtils.lerp(az, bz, t),
          y = groundHeight(x, z);
        const key = `${x.toFixed(3)},${z.toFixed(3)}`;
        const atGate =
          Math.abs(z - gatePoint.z) < 0.01 &&
          Math.abs(Math.abs(x - gatePoint.x) - 3) < 0.01;
        if (!fenceBars.has(key) && !atGate) {
          fenceBars.add(key);
          box(iron, x, y + 1.04, z, 0.029, 2, 0.029);
          taper(iron, x, y + 2.16, z, 0, 0.07, 0.25, 4);
        }
        if ((i % 16 === 0 || i === steps) && !atGate) pillar(x, z);
        if (i < steps)
          for (const h of [0.65, 1.58]) {
            const nx = THREE.MathUtils.lerp(ax, bx, (i + 1) / steps),
              nz = THREE.MathUtils.lerp(az, bz, (i + 1) / steps);
            beam(
              new THREE.Vector3(x, y + h, z),
              new THREE.Vector3(nx, groundHeight(nx, nz) + h, nz),
              0.026,
              0.026,
              iron,
            );
          }
      }
    }
  }
  cemeteryFences.forEach(fence);
  const perimeterSegments = perimeterFenceSegments();
  for (const [ax, az, bx, bz] of perimeterSegments) {
    const a = new THREE.Vector3(ax, groundHeight(ax, az), az);
    const b = new THREE.Vector3(bx, groundHeight(bx, bz), bz);
    for (const height of [0.62, 1.4]) {
      beam(
        new THREE.Vector3(a.x, a.y + height, a.z),
        new THREE.Vector3(b.x, b.y + height, b.z),
        0.1,
        0.1,
        perimeterWood,
      );
    }
    if (Math.round(ax * 10) % 3 === 0) {
      box(perimeterWood, a.x, a.y + 1.05, a.z, 0.24, 2.1, 0.24);
      box(perimeterWood, a.x, a.y + 2.13, a.z, 0.38, 0.18, 0.38, 0.35);
    }
  }
  const entranceGate = new THREE.Group();
  entranceGate.name = 'Raven Gate';
  for (const side of [-1, 1]) {
    const x = gatePoint.x + side * 3,
      z = gatePoint.z,
      y = groundHeight(x, z);
    pillar(x, z, 3.65);
    lantern(x, y + 3.9, z, false, true);
    const leaf = new THREE.Group();
    leaf.position.set(x, y, z);
    leaf.userData.side = side;
    for (let i = 0; i < 9; i++) {
      const d = i * 0.3,
        bx = -side * d * 0.52,
        bz = -d * 0.85,
        h = 2.5 + Math.sin((i / 9) * Math.PI) * 0.7;
      const bar = new THREE.Mesh(
        own(new THREE.BoxGeometry(0.04, h, 0.04)),
        iron,
      );
      bar.position.set(bx, h / 2, bz);
      leaf.add(bar);
      const tip = new THREE.Mesh(
        own(new THREE.ConeGeometry(0.075, 0.24, 4)),
        iron,
      );
      tip.position.set(bx, h + 0.12, bz);
      leaf.add(tip);
    }
    // Rails belong to each moving leaf, rather than the world origin.
    for (const h of [0.4, 1.25, 2.4]) {
      const end = new THREE.Vector3(-side * 1.3, 0, -2.12);
      const rail = new THREE.Mesh(
        own(new THREE.CylinderGeometry(0.035, 0.035, end.length(), 6)),
        iron,
      );
      rail.position.copy(end).multiplyScalar(0.5);
      rail.position.y = h;
      rail.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        end.normalize(),
      );
      leaf.add(rail);
    }
    entranceGate.add(leaf);
  }
  entranceGate.userData.leaves = entranceGate.children;
  scene.add(entranceGate);
  for (const t of [0.08, 0.24, 0.45, 0.64, 0.82, 0.96]) {
    const p = approach.getPointAt(t),
      tangent = approach.getTangentAt(t);
    for (const side of [-1, 1]) {
      const q = p
        .clone()
        .add(
          new THREE.Vector3(tangent.z, 0, -tangent.x)
            .normalize()
            .multiplyScalar(side * 2.65),
        );
      lantern(q.x, groundHeight(q.x, q.z) + 0.2, q.z, t > 0.4, true);
    }
  }
  for (const x of [8.1, 11.9])
    lantern(x, MANOR_ORIGIN.y + 3.9, -24.1, false, true);
  for (const { x, y, z } of islandLamps) lantern(x, y + 0.1, z, true, true);

  const cemetery = createReferenceGraves(graveStone, resources, mobile);
  scene.add(cemetery.root);
  const wax = material(0xcbbfa5, { roughness: 0.74 });
  cemetery.placements.forEach((grave, index) => {
    if (index % 3 !== 0) return;
    for (let candle = 0; candle < 3; candle++) {
      const x = grave.x + 0.65 + candle * 0.14,
        z = grave.z + 0.5 + (candle % 2) * 0.12;
      const height = 0.19 + ((index + candle * 3) % 5) * 0.065,
        y = groundHeight(x, z);
      taper(wax, x, y + height / 2, z, 0.065, 0.072, height, 10);
      const flame = new THREE.Mesh(orbGeo, amber);
      flame.position.set(x, y + height + 0.085, z);
      flame.scale.set(0.026, 0.105, 0.026);
      scene.add(flame);
      fires.push(flame);
      const glow = new THREE.Sprite(glowMat);
      glow.position.copy(flame.position);
      glow.scale.set(0.85, 0.85, 1);
      scene.add(glow);
    }
  });
  const branchTips: THREE.Vector3[] = [];
  function tree(x: number, z: number, height: number) {
    function branch(
      start: THREE.Vector3,
      direction: THREE.Vector3,
      length: number,
      radius: number,
      depth: number,
    ) {
      const end = start.clone().addScaledVector(direction, length);
      // Gently crooked limbs, with forks at different heights, avoid repeated umbrellas.
      const bend = new THREE.Vector3(
        -direction.z,
        0.16,
        direction.x,
      ).multiplyScalar(length * (0.03 + rand() * 0.045));
      const middle = start.clone().lerp(end, 0.52).add(bend);
      beam(start, middle, radius, radius * 0.72, bark);
      beam(middle, end, radius * 0.72, radius * 0.4, bark);
      if (!depth) {
        branchTips.push(end);
        return;
      }
      for (let j = 0; j < (depth > 2 ? 3 : 2); j++) {
        const a = rand() * Math.PI * 2;
        branch(
          start
            .clone()
            .lerp(end, depth > 2 ? 0.68 + rand() * 0.32 : 0.88 + rand() * 0.12),
          direction
            .clone()
            .multiplyScalar(0.5 + rand() * 0.45)
            .add(
              new THREE.Vector3(
                Math.cos(a) * (0.55 + rand() * 0.45),
                0.08 + rand() * 0.45,
                Math.sin(a) * (0.55 + rand() * 0.45),
              ),
            )
            .normalize(),
          length * (0.58 + rand() * 0.23),
          radius * 0.52,
          depth - 1,
        );
      }
    }
    branch(
      new THREE.Vector3(x, groundHeight(x, z), z),
      new THREE.Vector3(0.04, 1, 0.03),
      height * 0.4,
      height * 0.043,
      mobile ? 4 : 5,
    );
  }
  for (const [x, z, h] of cemeteryTrees) if (onIsland(x, z, 2)) tree(x, z, h);
  const seasonalTrees = createSeasonalTrees(
    scene,
    resources,
    branchTips,
    mobile,
  );
  const grassGeo = own(new THREE.BufferGeometry());
  const blades: number[] = [];
  for (let blade = 0; blade < 5; blade++) {
    const angle = blade * 2.4,
      bend = 0.09 + blade * 0.018;
    const x = Math.cos(angle),
      z = Math.sin(angle),
      h = 0.22 + blade * 0.034;
    blades.push(
      -z * 0.013,
      0,
      x * 0.013,
      z * 0.013,
      0,
      -x * 0.013,
      x * bend,
      h,
      z * bend,
    );
  }
  grassGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(blades, 3),
  );
  grassGeo.computeVertexNormals();
  const grassTime = { value: 0 };
  const grassMat = own(
    new THREE.MeshStandardMaterial({
      color: 0x3e4234,
      roughness: 0.92,
      side: THREE.DoubleSide,
    }),
  );
  // Animate grass blades with layered wind turbulence: the tip bends more than
  // the base (height-scaled), producing a convincing organic sway.
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.grassTime = grassTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float grassTime;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
float tipHeight = clamp(position.y / 0.36, 0.0, 1.0);
float tipFactor = tipHeight * tipHeight;
// World-space XZ for per-blade variation
vec4 worldPos = instanceMatrix * vec4(position, 1.0);
float wx = worldPos.x, wz = worldPos.z;
float phase = wx * 0.23 + wz * 0.19;
float wind1 = sin(grassTime * 1.7 + phase) * 0.11;
float wind2 = sin(grassTime * 2.9 + phase * 1.4 + 0.8) * 0.048;
float gust  = smoothstep(0.6, 1.0, sin(grassTime * 0.55 + phase * 0.7)) * 0.14;
float sway = (wind1 + wind2 + gust) * tipFactor;
transformed.x += sway;
transformed.z += sway * 0.38;`,
      );
    // Per-instance colors already handle blade variety — no fragment changes needed.
  };
  grassMat.customProgramCacheKey = () => 'nocturne-grass-wind-1';
  const grassCount = mobile ? 1100 : 3200,
    grass = own(new THREE.InstancedMesh(grassGeo, grassMat, grassCount));
  let planted = 0;
  for (let tries = 0; planted < grassCount && tries < grassCount * 5; tries++) {
    const x = -22 + rand() * 58,
      z = -20 + rand() * 54;
    if (!onIsland(x, z, 2) || pathDistance(x, z) < 2.8) continue;
    dummy.position.set(x, groundHeight(x, z), z);
    dummy.rotation.set(0, rand() * 6, rand() * 0.4);
    dummy.scale.setScalar(0.6 + rand() * 1.4);
    dummy.updateMatrix();
    grass.setColorAt(
      planted,
      new THREE.Color().setHSL(
        0.26 + rand() * 0.07,
        0.18 + rand() * 0.08,
        0.28 + rand() * 0.18,
      ),
    );
    grass.setMatrixAt(planted++, dummy.matrix);
  }
  grass.count = planted;
  scene.add(grass);
  for (const { x, z, sx, sy, sz, turn } of cemeteryRocks()) {
    add(scatterCrag, rock, x, groundHeight(x, z) - 0.15, z, sx, sy, sz, turn);
  }

  // Separate jagged sea stack and a viaduct with open masonry arches.
  add(crag, rock, -52, 3, -31, 9, 23, 10, 0.3);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    add(
      crag,
      rock,
      -52 + Math.cos(a) * 7,
      -3,
      -31 + Math.sin(a) * 8,
      2,
      12 + rand() * 4,
      2.5,
      a,
    );
  }
  const towerBase = 25;
  box(darkStone, -54.55, towerBase + 5, -31, 1.3, 10, 6.1);
  box(darkStone, -51.65, towerBase + 5, -33.65, 4.5, 10, 0.8);
  box(darkStone, -51.65, towerBase + 5, -28.35, 4.5, 10, 0.8);
  box(darkStone, -49.55, towerBase + 5, -33.25, 0.9, 10, 1.6);
  box(darkStone, -49.55, towerBase + 5, -29.05, 0.9, 10, 1.6);
  box(stone, -52, towerBase + 10.5, -31, 5.7, 1, 5.5);
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      const h = 1 + rand() * 3.2;
      // Leave the full stair entrance open through the northern battlements.
      if (side === -1 && i >= 1 && i <= 3) continue;
      box(
        stone,
        -54.6 + i * 1.3,
        towerBase + 11 + h / 2,
        -31 + side * 2.7,
        0.65,
        h,
        0.65,
      );
    }
  for (let floor = 0; floor < 3; floor++)
    for (const dx of [-1.35, 1.35]) {
      box(
        voidMat,
        -52 + dx,
        towerBase + 2 + floor * 3,
        -27.92,
        0.55,
        1.5,
        0.04,
      );
      if (floor === 1)
        box(
          amber,
          -52 + dx,
          towerBase + 2 + floor * 3,
          -27.88,
          0.27,
          0.8,
          0.03,
        );
    }
  for (let i = 0; i < 5; i++) {
    const x = -44 + i * 6.2,
      z = -31,
      w = 6.2,
      spring = 21.3,
      deck = 25.4;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, spring);
    shape.lineTo(-w / 2, deck);
    shape.lineTo(w / 2, deck);
    shape.lineTo(w / 2, spring);
    shape.absarc(0, spring, w / 2, 0, Math.PI, false);
    shape.closePath();
    const archGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 2.8,
      bevelEnabled: false,
      curveSegments: 18,
    });
    add(archGeo, stone, x, 0, z - 1.4);
    archGeo.dispose();
    box(darkStone, x - w / 2, 3.3, z, 0.85, 36, 2.9);
  }
  for (const rail of bridgeParapets) {
    const x = (rail.ax + rail.bx) / 2,
      width = rail.bx - rail.ax;
    box(darkStone, x, rail.floor + 0.43, rail.az, width, 0.75, 0.22);
    box(edge, x, rail.floor + 0.87, rail.az, width, 0.16, rail.thickness);
  }
  // End landings overlap both cliffs so the bridge has no floating ends.
  box(stone, -47.6, 25.05, -31, 3, 0.7, 2.8);
  box(stone, -14.3, 25.05, -31, 4, 0.7, 2.8);
  function buildStairRoute(route: typeof SHORE_ROUTE) {
    const treads = stairTreads(route);
    for (const [index, step] of treads.entries()) {
      // A closed masonry shoulder bridges the clearance margin to the terrain.
      const approachLanding =
        route === BRIDGE_ROUTE && index >= treads.length - route.length;
      box(
        darkStone,
        step.x,
        step.y - 0.48,
        step.z,
        step.width + 1,
        0.9,
        step.depth + (approachLanding ? 1 : 0.12),
        step.angle,
      );
      box(
        stone,
        step.x,
        step.y - 0.15,
        step.z,
        step.width,
        0.3,
        step.depth,
        step.angle,
      );
      // Raised nosing stays clear of the tread's top face.
      box(
        edge,
        step.x,
        step.y + 0.008,
        step.z,
        step.width - 0.08,
        0.016,
        Math.min(step.depth, 0.08),
        step.angle,
      );
    }
    for (const step of stairSupports(route))
      box(darkStone, step.x, (step.y - 1) / 2, step.z, 0.34, step.y + 1, 0.34);
    for (const { a, b } of stairRails(route)) {
      const start = new THREE.Vector3(...a),
        end = new THREE.Vector3(...b);
      beam(start, end, 0.065, 0.065, iron);
      const posts = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.8);
      for (let i = 0; i <= posts; i++) {
        const point = start.clone().lerp(end, i / posts);
        box(iron, point.x, point.y - 0.5, point.z, 0.055, 1, 0.055);
      }
    }
  }
  buildStairRoute(SHORE_ROUTE);
  buildStairRoute(BRIDGE_ROUTE);
  // A level dock meets the final landing at the water.
  box(wood, BOAT_DOCK.x, DOCK_HEIGHT - 0.15, BOAT_DOCK.z, 4.8, 0.3, 2.6);
  lantern(BOAT_DOCK.x + 2, DOCK_HEIGHT, BOAT_DOCK.z + 0.7, true, true);
  const boat = new THREE.Group();
  boat.name = 'Small rowboat';
  const boatHull = material(0x8b4f2a, {
    roughness: 0.62,
    metalness: 0.08,
  });
  const boatTrim = material(0xd4b36b, {
    roughness: 0.48,
    emissive: 0x24180b,
    emissiveIntensity: 0.25,
  });
  // Fine timber grain and dark plank seams use the existing hull/oar UVs.
  for (const timber of [boatHull, boatTrim])
    timber.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec2 timberUv;',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\ntimberUv=uv;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\nvarying vec2 timberUv;',
        )
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\nfloat grain=sin(timberUv.y*240.+sin(timberUv.x*15.)*2.+sin(timberUv.x*53.)*.5);float seam=smoothstep(.015,.055,abs(fract(timberUv.y*8.)-.5));diffuseColor.rgb*= (.86+grain*.12)*mix(.62,1.,seam);',
        );
    };
  /* The continuous ocean already covers the landing; avoid a second flat water sheet. */
  // Curved open hull, raised bow and stern, benches, and oars.
  const hullVertices: number[] = [],
    hullUvs: number[] = [],
    hullIndices: number[] = [];
  for (let row = 0; row <= 24; row++) {
    const t = row / 24,
      x = (t - 0.5) * 5.2;
    const width = 0.06 + Math.pow(Math.sin(t * Math.PI), 0.6) * 0.84;
    for (let side = 0; side <= 12; side++) {
      const angle = (side / 12) * Math.PI;
      hullVertices.push(
        x,
        0.65 -
          Math.sin(angle) * 0.75 +
          Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.3,
        Math.cos(angle) * width,
      );
      hullUvs.push(t * 4, side / 12);
      if (row < 24 && side < 12) {
        const a = row * 13 + side,
          b = a + 13;
        hullIndices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const hullGeometry = own(new THREE.BufferGeometry());
  hullGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(hullVertices, 3),
  );
  hullGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(hullUvs, 2));
  hullGeometry.setIndex(hullIndices);
  hullGeometry.computeVertexNormals();
  boatHull.side = THREE.DoubleSide;
  boatHull.color.set(0x48392e);
  boatTrim.color.set(0x706251);
  const hull = new THREE.Mesh(hullGeometry, boatHull);
  hull.castShadow = !mobile;
  hull.receiveShadow = true;
  boat.add(hull);
  const boards = [];
  for (let i = -2; i <= 2; i++)
    boards.push(
      new THREE.BoxGeometry(3.65, 0.07, 0.19).translate(0, 0.13, i * 0.2),
    );
  const deck = own(mergeGeometries(boards)!);
  boards.forEach((g) => g.dispose());
  boat.add(new THREE.Mesh(deck, boatTrim));
  for (const x of [-1.1, 0.25, 1.25]) {
    const bench = new THREE.Mesh(
      own(new THREE.BoxGeometry(0.3, 0.12, 1.4)),
      boatTrim,
    );
    bench.position.set(x, 0.48, 0);
    boat.add(bench);
  }
  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      points.push(
        new THREE.Vector3(
          (t - 0.5) * 5.2,
          0.65 + Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.3,
          side * (0.06 + Math.pow(Math.sin(t * Math.PI), 0.6) * 0.84),
        ),
      );
    }
    const rail = new THREE.Mesh(
      own(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          32,
          0.055,
          6,
          false,
        ),
      ),
      boatTrim,
    );
    boat.add(rail);
  }
  const rowing = createRowboatOars(boat, boatTrim, resources);
  boat.position.set(BOAT_MOORING.x, 0, BOAT_MOORING.z);
  scene.add(boat);
  const traffic = createOceanTraffic(scene, boat, resources, mobile);
  const haunting = createHaunting(scene, resources, mobile);

  // Tower entrance from the viaduct and a visible stair run to its roof lookout.
  const towerDoor = new THREE.Group();
  towerDoor.position.set(-48.55, 27.05, -32.38);
  const towerDoorLeaf = new THREE.Group();
  towerDoorLeaf.position.z = 1.08;
  const towerDoorPanel = new THREE.Mesh(
    own(new THREE.BoxGeometry(0.16, 3.1, 2.16)),
    wood,
  );
  towerDoorPanel.castShadow = !mobile;
  towerDoorLeaf.add(towerDoorPanel);
  towerDoor.add(towerDoorLeaf);
  const towerDoorFrame = new THREE.Group();
  const frameParts = [
    [-0.27, 0, 0.24, 3.55, 0.28],
    [2.43, 0, 0.24, 3.55, 0.28],
    [1.08, 1.64, 0.24, 0.28, 3],
  ] as const;
  for (const [z, y, width, height, depth] of frameParts) {
    const part = new THREE.Mesh(
      own(new THREE.BoxGeometry(width, height, depth)),
      edge,
    );
    part.position.set(-0.12, y, z);
    towerDoorFrame.add(part);
  }
  towerDoor.add(towerDoorFrame);
  towerDoor.userData.leaf = towerDoorLeaf;
  scene.add(towerDoor);
  // Human-scale exterior flights replace the old near-vertical tower steps.
  buildStairRoute(TOWER_ROUTE);
  box(stone, -52, 35.15, -31, 5.7, 0.35, 5.5);
  const lookoutRailY = 36.75;
  for (const [x, z] of [
    [-54.55, -33.55],
    [-54.55, -28.45],
    [-49.45, -33.55],
    [-49.45, -28.45],
  ] as const)
    box(darkStone, x, 36.35, z, 0.28, 2.05, 0.28);
  box(edge, -54, lookoutRailY, -33.55, 1.3, 0.22, 0.2);
  box(edge, -50, lookoutRailY, -33.55, 1.3, 0.22, 0.2);
  box(edge, -52, lookoutRailY, -28.45, 5.3, 0.22, 0.2);
  box(edge, -54.55, lookoutRailY, -31, 0.2, 0.22, 5.3);
  box(edge, -49.45, lookoutRailY, -31, 0.2, 0.22, 5.3);

  for (const [mat, list] of groups) {
    const normalized = list.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      if (n !== g) g.dispose();
      if (!n.getAttribute('normal')) n.computeVertexNormals();
      projectSurfaceUV(n, mat === rock ? 3.2 : 2.5);
      return n;
    });
    const merged = mergeGeometries(normalized, false);
    normalized.forEach((g) => g.dispose());
    if (merged) {
      shoreCamera.add(merged);
      const mesh = new THREE.Mesh(own(merged), mat);
      mesh.castShadow = !mobile;
      mesh.receiveShadow = true;
      scene.add(mesh);
      navigationSurfaces.push(mesh);
    }
  }
  const life = createIslandLife(scene, resources, mobile, {
    coastGLSL: referenceCoastGLSL,
    referenceBirds: true,
  });
  // Optional scanned statues can finish after entry; keep the full-quality
  // terrain, sky and real traveller as the entry requirements.
  const detailsReady = loadCoastalProps(
    scene,
    resources,
    mobile,
    () => disposed,
    groundHeight,
    {
      gate: gatePoint,
    },
  );
  life.clouds.visible = false;
  const weather = createIslandWeather(scene, resources, mobile);
  let daylight = false;
  let mode: IslandMode = 'night';
  const sky = load('/environment/reference-sky.webp', true);
  sky.texture.mapping = THREE.EquirectangularReflectionMapping;
  pending.push(
    sky.ready.then(() => {
      if (disposed || !sky.texture.image) return;
      weather.setSkyTexture(sky.texture);
      // Use the same photographic sky for the visible atmosphere and reflections.
      scene.background = new THREE.Color(0x09121c);
      scene.backgroundIntensity = 0.85;
      scene.backgroundRotation.set(-0.58, 1.4, 0);
      const pmrem = new THREE.PMREMGenerator(renderer);
      try {
        const target = own(pmrem.fromEquirectangular(sky.texture));
        scene.environment = target.texture;
        scene.environmentIntensity = daylight ? 0.15 : 0.42;
      } catch {
        /* Direct lighting remains available on limited GPUs. */
      } finally {
        pmrem.dispose();
      }
    }),
  );
  const mistTime = { value: 0 };
  const mistMat = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { time: mistTime, density: { value: 1 } },
      vertexShader:
        'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 vUv;uniform float time;uniform float density;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}void main(){vec2 p=vUv*8.+vec2(time*.045,time*.012);float n=noise(p)*.6+noise(p*2.1)*.28;float edge=smoothstep(0.,.22,vUv.x)*smoothstep(0.,.22,1.-vUv.x)*smoothstep(0.,.22,vUv.y)*smoothstep(0.,.22,1.-vUv.y);gl_FragColor=vec4(.44,.51,.56,edge*n*.19*density);}',
    }),
  );
  const mistGeo = own(new THREE.PlaneGeometry(100, 100));
  for (let i = 0; i < (mobile ? 4 : 8); i++) {
    const mist = new THREE.Mesh(mistGeo, mistMat);
    mist.rotation.set(-Math.PI / 2, 0, i * 0.7);
    mist.position.set(i % 2 ? -23 : 15, -5 + i * 3.3, -10);
    scene.add(mist);
  }
  for (const [x, z] of [
    [-4, 4],
    [21, -12],
    [-7, -20],
    [-5, 15],
    [16, -40],
    [-10, -27],
  ]) {
    const mist = new THREE.Mesh(mistGeo, mistMat);
    mist.scale.set(0.19, 0.13, 1);
    mist.rotation.x = -Math.PI / 2;
    mist.position.set(x, groundHeight(x, z) + 0.32, z);
    scene.add(mist);
  }
  function setMode(value: IslandMode) {
    mode = value;
    daylight = value !== 'night';
    winterCover.value = value === 'winter' ? 1 : 0;
    weather.setMode(value);
    seasonalTrees.setMode(value);
    life.setDaylight(daylight);
    haunting.setEnabled(value === 'night');
    life.water.color.setHex(
      value === 'winter' ? 0x527783 : daylight ? 0x3d879d : 0x233d4a,
    );
    mistMat.uniforms.density.value =
      value === 'day' ? 0.15 : value === 'winter' ? 0.75 : 1;
    scene.environmentIntensity = daylight ? 0.15 : 0.42;
  }
  return {
    constrainShoreCamera: shoreCamera.constrain,
    ground,
    navigationSurfaces,
    manor,
    boat,
    rowing,
    traffic,
    entranceGate,
    towerDoor,
    coffins: cemetery.coffins,
    ready: Promise.all(pending),
    detailsReady,
    setMode,
    setSheltered: weather.setSheltered,
    setDaylight(enabled: boolean) {
      setMode(enabled ? 'day' : 'night');
    },
    update(time: number, camera?: THREE.Camera) {
      seasonalTrees.update(
        time,
        document.documentElement.dataset.liveEffects === 'off',
      );
      life.update(time, camera);
      traffic.update(time, camera?.position ?? boat.position, boat.position);
      haunting.update(time, camera);
      const swell = oceanSample(boat.position.x, boat.position.z, time);
      boat.position.y = swell.height + 0.08;
      boat.rotation.x = Math.atan2(swell.normal.z, swell.normal.y) * 0.35;
      boat.rotation.z = -Math.atan2(swell.normal.x, swell.normal.y) * 0.35;
      life.setBoats([
        boat,
        ...traffic.boats.filter((b) => b.root.visible).map((b) => b.root),
      ]);
      weather.update(time, camera);
      if (camera) {
        const nearest = lampSources
          .map((position, index) => ({
            position,
            index,
            distance: position.distanceToSquared(camera.position),
          }))
          .sort((a, b) => a.distance - b.distance);
        localLights.forEach((lamp, i) => {
          const source = nearest[i];
          if (!source) {
            lamp.intensity = 0;
            return;
          }
          lamp.position.copy(source.position);
          lamp.intensity =
            (mode === 'day' ? 5 : mode === 'winter' ? 22 : 30) *
            (1 + 0.05 * Math.sin(time * 4.1 + source.index * 2.1));
        });
      }
      mistTime.value = time;
      grassTime.value = time;
      fires.forEach((fire, i) => {
        fire.scale.y =
          (fire.scale.x < 0.04 ? 0.1 : 0.17) +
          Math.sin(time * 5.3 + i * 2.1) * 0.025;
      });
    },
    dispose() {
      disposed = true;
      scene.environment = null;
      scene.background = null;
    },
  };
}
