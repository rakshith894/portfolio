import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { IslandMode } from './island-mode.ts';
import { groundHeight } from './reference-layout.ts';
type Tip = { x: number; y: number; z: number };

/** Pointed, cupped blades with raised midribs and soft curved edges. */
function botanicalBlade(petal = false) {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const segments = 6;
  for (let row = 0; row <= segments; row++) {
    const t = row / segments;
    const width =
      Math.pow(Math.sin(Math.PI * t), petal ? 0.45 : 0.85) *
      (petal ? 0.42 : 0.28);
    for (const side of [-1, 0, 1]) {
      positions.push(
        side * width,
        Math.sin(t * Math.PI) * (side === 0 ? 0.09 : -0.045) + t * t * 0.13,
        t - 0.5,
      );
      uv.push((side + 1) / 2, t);
    }
  }
  for (let row = 0; row < segments; row++)
    for (let col = 0; col < 2; col++) {
      const a = row * 3 + col;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function blossomGeometry() {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const petal = botanicalBlade(true);
    petal.scale(0.72, 0.8, 0.67);
    petal.translate(0, 0, 0.3);
    petal.rotateY((i * Math.PI * 2) / 5);
    return petal;
  });
  const geometry = mergeGeometries(petals)!;
  petals.forEach((petal) => petal.dispose());
  return geometry;
}

/** Botanical geometry is instanced; season changes reuse all GPU resources. */
export function createSeasonalTrees(
  scene: THREE.Scene,
  resources: Set<{ dispose(): void }>,
  tips: Tip[],
  mobile: boolean,
) {
  const own = <T extends { dispose(): void }>(value: T): T => {
    resources.add(value);
    return value;
  };
  const leafGeometry = own(botanicalBlade()),
    petalGeometry = own(botanicalBlade(true)),
    flowerGeometry = own(blossomGeometry());
  const timeUniform = { value: 0 },
    windUniform = { value: 1 },
    winterUniform = { value: 0 };
  const canopyMaterial = own(
    new THREE.MeshStandardMaterial({
      color: '#759949',
      roughness: 0.8,
      side: THREE.DoubleSide,
      emissive: '#183527',
      emissiveIntensity: 0.025,
    }),
  );
  canopyMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.foliageTime = timeUniform;
    shader.uniforms.foliageWind = windUniform;
    shader.uniforms.foliageWinter = winterUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float foliageTime; uniform float foliageWind; varying vec2 bladeUv;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nbladeUv=uv; transformed.y+=sin(foliageTime*1.9+position.z*5.0)*position.z*0.08*foliageWind;',
      )
      .replace(
        '#include <project_vertex>',
        THREE.ShaderChunk.project_vertex.replace(
          'mvPosition = modelViewMatrix * mvPosition;',
          'mvPosition.x+=sin(foliageTime*.65+mvPosition.x*.38+mvPosition.z*.22)*.12*foliageWind; mvPosition.z+=cos(foliageTime*.48+mvPosition.x*.23)*.07*foliageWind; mvPosition = modelViewMatrix * mvPosition;',
        ),
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float foliageWinter; varying vec2 bladeUv;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float midrib=1.-smoothstep(.009,.027,abs(bladeUv.x-.5));
        float veins=pow(max(0.,cos((bladeUv.y-abs(bladeUv.x-.5)*.65)*68.)),18.);
        float edge=smoothstep(.42,.5,abs(bladeUv.x-.5));
        float variation=.85+.15*sin(bladeUv.y*12.);
        diffuseColor.rgb*=mix(variation,1.,foliageWinter);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.32,(midrib*.55+veins*.16)*(1.-foliageWinter));
        diffuseColor.rgb*=1.-edge*.13*(1.-foliageWinter);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.,.72,.8),foliageWinter*pow(1.-bladeUv.y,3.)*.6);
      `,
      );
  };
  canopyMaterial.customProgramCacheKey = () => 'botanical-foliage-v2';
  const fallingMaterial = own(
    new THREE.MeshStandardMaterial({
      color: '#92b757',
      roughness: 0.8,
      side: THREE.DoubleSide,
      emissive: '#334b20',
      emissiveIntensity: 0.03,
    }),
  );
  const perTip = mobile ? 32 : 64;
  const canopy = own(
    new THREE.InstancedMesh(leafGeometry, canopyMaterial, tips.length * perTip),
  );
  canopy.name = 'Seasonal tree canopy';
  canopy.receiveShadow = true;
  const count = Math.min(mobile ? 100 : 220, tips.length * 2);
  const falling = own(
    new THREE.InstancedMesh(leafGeometry, fallingMaterial, count),
  );
  falling.name = 'Windborne leaves and winter petals';
  falling.frustumCulled = false;
  falling.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  let seed = 1907;
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  const placements = tips.flatMap((tip) =>
    Array.from({ length: perTip }, () => {
      const angle = random() * Math.PI * 2,
        radius = Math.sqrt(random()) * (0.48 + random() * 0.5);
      return {
        x: tip.x + Math.cos(angle) * radius,
        y: tip.y + (random() - 0.45) * 1.2,
        z: tip.z + Math.sin(angle) * radius,
        turn: random() * Math.PI * 2,
        tilt: (random() - 0.5) * 2.6,
        roll: (random() - 0.5) * 1.2,
        size: 0.2 + random() * 0.19,
        tone: random(),
      };
    }),
  );
  const particles = Array.from({ length: count }, (_, i) => ({
    tip: tips[Math.floor((i / count) * tips.length)],
    phase: random(),
    speed: 0.032 + random() * 0.025,
    sway: random() * Math.PI * 2,
    size: 0.11 + random() * 0.1,
  }));
  const dummy = new THREE.Object3D(),
    color = new THREE.Color();
  let mode: IslandMode = 'night';
  function setMode(value: IslandMode) {
    mode = value;
    const winter = mode === 'winter';
    winterUniform.value = winter ? 1 : 0;
    canopy.geometry = winter ? flowerGeometry : leafGeometry;
    canopyMaterial.color.set(winter ? '#ffe1e9' : '#759949');
    canopyMaterial.emissive.set(winter ? '#503038' : '#183527');
    canopyMaterial.emissiveIntensity = mode === 'night' ? 0.16 : 0.025;
    falling.geometry = winter ? petalGeometry : leafGeometry;
    fallingMaterial.color.set(winter ? '#ffd9e5' : '#92b757');
    fallingMaterial.emissiveIntensity = mode === 'night' ? 0.22 : 0.03;
    canopy.count = winter
      ? Math.floor(placements.length * 0.48)
      : placements.length;
    for (let i = 0; i < canopy.count; i++) {
      const p = placements[winter ? Math.floor(i / 0.48) : i];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.tilt, p.turn, p.roll);
      dummy.scale.setScalar(p.size * (winter ? 0.83 : 1));
      dummy.updateMatrix();
      canopy.setMatrixAt(i, dummy.matrix);
      if (winter)
        color.setHSL(
          0.94 + p.tone * 0.035,
          0.18 + p.tone * 0.12,
          0.78 + p.tone * 0.18,
        );
      else
        color.setHSL(
          0.21 + p.tone * 0.075,
          0.25 + p.tone * 0.22,
          0.36 + p.tone * 0.3,
        );
      canopy.setColorAt(i, color);
    }
    canopy.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
    canopy.computeBoundingSphere();
    if (canopy.boundingSphere) canopy.boundingSphere.radius += 0.3;
  }
  scene.add(canopy, falling);
  setMode(mode);
  return {
    setMode,
    update(time: number, reduced = false) {
      timeUniform.value = time;
      windUniform.value = reduced ? 0 : 1;
      falling.visible = !reduced;
      if (reduced) return;
      particles.forEach((p, i) => {
        const progress = (time * p.speed + p.phase) % 1,
          travel = Math.min(progress / 0.9, 1);
        const x =
            p.tip.x + travel * 2.6 + Math.sin(time * 0.55 + p.sway) * 0.55,
          z = p.tip.z + Math.sin(travel * 5 + p.sway) * 0.9;
        dummy.position.set(
          x,
          THREE.MathUtils.lerp(p.tip.y, groundHeight(x, z) + 0.06, travel),
          z,
        );
        dummy.rotation.set(
          travel < 1 ? Math.sin(time * 1.7 + p.sway) * 1.1 : 0,
          p.sway + time * 0.35,
          travel < 1 ? Math.sin(time + p.sway) * 0.55 : 0,
        );
        dummy.scale.setScalar(
          p.size * Math.min(1, progress * 20, (1 - progress) * 12),
        );
        dummy.updateMatrix();
        falling.setMatrixAt(i, dummy.matrix);
      });
      falling.instanceMatrix.needsUpdate = true;
    },
  };
}
