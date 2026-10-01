import * as THREE from 'three';
import {
  SEA_LEVEL,
  crowPose,
  referenceCrowPose,
  fishPose,
  fishRoutes,
  oceanGLSL,
  oceanSample,
} from './island-motion.ts';

type Disposable = { dispose: () => void };
const noiseGLSL = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float sum=0.;float amplitude=.5;for(int i=0;i<5;i++){sum+=noise(p)*amplitude;p=mat2(1.6,1.2,-1.2,1.6)*p+vec2(7.1,3.7);amplitude*=.5;}return sum;}`;

export function createIslandLife(
  scene: THREE.Scene,
  resources: Set<Disposable>,
  mobile: boolean,
  layout: {
    coastGLSL?: string;
    crowOffset?: THREE.Vector3;
    referenceBirds?: boolean;
  } = {},
) {
  const own = <T extends Disposable>(item: T) => {
    resources.add(item);
    return item;
  };
  const time = { value: 0 };
  const oceanDaylight = { value: 0 };
  const boatMasks = {
    value: Array.from({ length: 5 }, () =>
      new THREE.Matrix4().makeTranslation(1e9, 1e9, 1e9),
    ),
  };
  const waterGeometry = own(
    new THREE.PlaneGeometry(240, 240, mobile ? 100 : 180, mobile ? 100 : 180),
  );
  waterGeometry.rotateX(-Math.PI / 2);
  waterGeometry.computeBoundingBox();
  waterGeometry.boundingBox!.min.y = -2.1;
  waterGeometry.boundingBox!.max.y = 2.1;
  waterGeometry.computeBoundingSphere();
  waterGeometry.boundingSphere!.radius += 2;
  const water = own(
    new THREE.MeshPhysicalMaterial({
      color: 0x233d4a,
      roughness: 0.18,
      metalness: 0,
      ior: 1.333,
      clearcoat: 0,
    }),
  );
  water.onBeforeCompile = (shader) => {
    shader.uniforms.islandTime = time;
    shader.uniforms.oceanDaylight = oceanDaylight;
    shader.uniforms.islandBoats = boatMasks;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform float islandTime; varying vec3 oceanPosition; ${oceanGLSL}`,
      )
      .replace(
        '#include <beginnormal_vertex>',
        `#include <beginnormal_vertex>\nvec3 oceanWave=oceanSample((modelMatrix*vec4(position,1.0)).xz,islandTime);objectNormal=normalize(vec3(-oceanWave.y,1.0,-oceanWave.z));`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\ntransformed.y=oceanWave.x;oceanPosition=(modelMatrix*vec4(transformed,1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform float islandTime;uniform float oceanDaylight;uniform mat4 islandBoats[5];varying vec3 oceanPosition;${noiseGLSL}\n${oceanGLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
for(int i=0;i<5;i++){
 vec3 local=(islandBoats[i]*vec4(oceanPosition,1.)).xyz;
 float along=clamp((local.x+2.6)/5.2,0.,1.);
 float hullWidth=.06+pow(max(0.,sin(along*3.14159265)),.6)*.84;
 float bow=pow(abs(along-.5)*2.,3.)*.3;
 float bottom=.65-sqrt(max(0.,1.-pow(local.z/hullWidth,2.)))*.75+bow;
 if(abs(local.x)<2.55 && abs(local.z)<hullWidth-.025 && local.y>bottom+.015 && local.y<.8+bow)discard;
}
${
  layout.coastGLSL ??
  `vec2 coastPoint=vec2(oceanPosition.x,oceanPosition.z<0.?oceanPosition.z/1.45:oceanPosition.z);
float angle=atan(coastPoint.y,coastPoint.x);
float coast=33.5+sin(angle*3.+.3)*2.5+cos(angle*7.)*1.1+sin(angle*13.)*.55;
float distanceToCliff=length(coastPoint)-coast;`
}
float foamNoise=fbm(oceanPosition.xz*.85-vec2(islandTime*.23,islandTime*.17));
float shore=exp(-abs(distanceToCliff-2.3)*.6)*smoothstep(.43,.75,foamNoise+sin(distanceToCliff*2.1-islandTime*1.7)*.2);
float crest=smoothstep(.68,1.35,oceanPosition.y)*smoothstep(.4,.62,foamNoise);
float oceanFoam=clamp(shore*.75+crest*.25,0.,.72);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.72,.73),oceanFoam);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor=mix(roughnessFactor,.74,oceanFoam);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
vec3 waterSlope=oceanSample(oceanPosition.xz,islandTime);
float rippleFade=1.-smoothstep(35.,160.,length(cameraPosition-oceanPosition));
vec2 ripples=vec2(.08,.035)*cos(dot(oceanPosition.xz,vec2(2.3,1.1))-islandTime*2.1)+vec2(-.035,.07)*cos(dot(oceanPosition.xz,vec2(-1.7,3.2))-islandTime*2.8);
vec3 waterNormal=normalize(vec3(-waterSlope.y-ripples.x*rippleFade,1.,-waterSlope.z-ripples.y*rippleFade));
normal=normalize(mat3(viewMatrix)*waterNormal);nonPerturbedNormal=normal;`,
      )
      .replace(
        '#include <opaque_fragment>',
        `vec3 waterView=normalize(cameraPosition-oceanPosition);
vec3 reflectedRay=reflect(-waterView,waterNormal);
float skyHeight=smoothstep(0.,.85,reflectedRay.y);
vec3 nightSky=mix(vec3(.028,.052,.072),vec3(.012,.025,.047),skyHeight);
vec3 daySky=mix(vec3(.61,.78,.91),vec3(.12,.39,.76),skyHeight);
vec3 reflectedSky=mix(nightSky,daySky,oceanDaylight);
float fresnel=.0204+.9796*pow(1.-max(dot(waterNormal,waterView),0.),5.);
outgoingLight=mix(outgoingLight,reflectedSky,fresnel*.8*(1.-oceanFoam));
#include <opaque_fragment>`,
      );
  };
  water.customProgramCacheKey = () =>
    `nocturne-living-water-3-${layout.coastGLSL ?? 'legacy'}`;
  const sea = new THREE.Mesh(waterGeometry, water);
  sea.position.y = SEA_LEVEL;
  scene.add(sea);
  // Concentric square rings match every inner edge vertex and coarsen toward the horizon.
  const segments = mobile ? 100 : 180,
    rings = 20,
    perimeter = segments * 4;
  const outerVertices: number[] = [],
    outerIndices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const half = 120 + 1080 * (ring / rings) ** 2;
    for (let side = 0; side < 4; side++)
      for (let step = 0; step < segments; step++) {
        const along = -half + (2 * half * step) / segments;
        const [x, z] =
          side === 0
            ? [along, -half]
            : side === 1
              ? [half, along]
              : side === 2
                ? [-along, half]
                : [-half, -along];
        outerVertices.push(x, 0, z);
      }
  }
  for (let ring = 0; ring < rings; ring++)
    for (let point = 0; point < perimeter; point++) {
      const a = ring * perimeter + point,
        b = ring * perimeter + ((point + 1) % perimeter);
      const c = b + perimeter,
        d = a + perimeter;
      outerIndices.push(a, b, d, b, c, d);
    }
  const outerGeometry = own(new THREE.BufferGeometry());
  outerGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(outerVertices, 3),
  );
  outerGeometry.setIndex(outerIndices);
  outerGeometry.computeVertexNormals();
  const horizon = new THREE.Mesh(outerGeometry, water);
  horizon.position.y = SEA_LEVEL;
  horizon.frustumCulled = false;
  scene.add(horizon);

  // A moving cloud volume overlays the static moon and stars, preserving their position.
  const cloudMaterial = own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      uniforms: { islandTime: time },
      vertexShader:
        'varying vec3 skyDirection;void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        `uniform float islandTime;varying vec3 skyDirection;${noiseGLSL}
void main(){vec3 direction=normalize(skyDirection);vec2 p=direction.xz/(max(direction.y,0.)+.36)*3.5;vec2 wind=vec2(islandTime*.013,islandTime*.006);float shape=fbm(p+wind);float detail=fbm(p*2.4+wind*1.2);float density=smoothstep(.37,.76,shape*.76+detail*.24);float rim=smoothstep(.03,.22,direction.y);vec3 color=mix(vec3(.055,.083,.12),vec3(.23,.29,.34),detail*.8+shape*.2);gl_FragColor=vec4(color,density*rim*.74);#include <tonemapping_fragment>
#include <colorspace_fragment>
}`.replace(';#include', ';\n#include'),
    }),
  );
  const cloudGeometry = own(
    new THREE.SphereGeometry(450, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
  );
  const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  clouds.renderOrder = -1;
  scene.add(clouds);

  // Smooth, tapered fish with dorsal, pectoral and forked tail fins.
  const fishMaterial = own(
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.29,
      metalness: 0.42,
      clearcoat: 0.7,
      clearcoatRoughness: 0.16,
    }),
  );
  const finMaterial = own(
    new THREE.MeshStandardMaterial({
      color: 0x243d47,
      roughness: 0.43,
      metalness: 0.25,
      side: THREE.DoubleSide,
    }),
  );
  const eyeMaterial = own(
    new THREE.MeshStandardMaterial({ color: 0x02070b, roughness: 0.1 }),
  );
  const bodyGeometry = own(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.02, -2.65),
        new THREE.Vector2(0.2, -2.2),
        new THREE.Vector2(0.46, -1.4),
        new THREE.Vector2(0.64, -0.5),
        new THREE.Vector2(0.61, 0.4),
        new THREE.Vector2(0.49, 1.25),
        new THREE.Vector2(0.29, 1.95),
        new THREE.Vector2(0.08, 2.45),
        new THREE.Vector2(0, 2.55),
      ],
      32,
    ),
  );
  bodyGeometry.rotateZ(-Math.PI / 2);
  const positions = bodyGeometry.getAttribute('position'),
    colors = new Float32Array(positions.count * 3),
    top = new THREE.Color(0x152e38),
    belly = new THREE.Color(0x99aab0),
    color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    color
      .copy(belly)
      .lerp(top, THREE.MathUtils.smoothstep(positions.getY(i), -0.4, 0.45));
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  bodyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  function fin(points: [number, number][], depth = 0.04) {
    const shape = new THREE.Shape(
      points.map(([x, y]) => new THREE.Vector2(x, y)),
    );
    const geometry = own(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.025,
        bevelSegments: 1,
        steps: 1,
      }),
    );
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }
  const tailGeometry = fin([
      [0, 0],
      [-1.4, 1.15],
      [-0.9, 0],
      [-1.4, -1.15],
    ]),
    dorsalGeometry = fin([
      [-1.1, 0],
      [-0.65, 1.1],
      [0.15, 0.55],
      [0.75, 0],
    ]),
    pectoralGeometry = fin([
      [0.4, 0],
      [-0.9, 0.9],
      [-0.55, 0.08],
    ]);
  const eyeGeometry = own(new THREE.SphereGeometry(0.065, 8, 6));
  const splashRingGeometry = own(new THREE.RingGeometry(0.74, 1, 64));
  splashRingGeometry.rotateX(-Math.PI / 2);
  const splashCount = mobile ? 32 : 64;
  const fishes = fishRoutes.map((_, index) => {
    const root = new THREE.Group();
    root.visible = false;
    scene.add(root);
    const body = new THREE.Mesh(bodyGeometry, fishMaterial);
    body.scale.y = 0.8;
    root.add(body);
    const tail = new THREE.Mesh(tailGeometry, finMaterial);
    tail.position.x = -2.5;
    root.add(tail);
    const dorsal = new THREE.Mesh(dorsalGeometry, finMaterial);
    dorsal.position.set(-0.2, 0.44, 0);
    root.add(dorsal);
    for (const side of [-1, 1]) {
      const pectoral = new THREE.Mesh(pectoralGeometry, finMaterial);
      pectoral.rotation.x = side * Math.PI * 0.46;
      pectoral.position.set(0.9, -0.12, side * 0.4);
      root.add(pectoral);
      const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      eye.position.set(1.85, 0.08, side * 0.24);
      root.add(eye);
    }
    root.scale.setScalar(index === 2 ? 1.15 : 1);
    const ringMaterial = own(
      new THREE.MeshBasicMaterial({
        color: 0xc3dce0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    const ring = new THREE.Mesh(splashRingGeometry, ringMaterial);
    ring.visible = false;
    scene.add(ring);
    const droplets = own(new THREE.BufferGeometry());
    droplets.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(splashCount * 3), 3),
    );
    const sprayMaterial = own(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { opacity: { value: 0 } },
        vertexShader:
          'void main(){vec4 viewPosition=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(120.*.15/-viewPosition.z,1.,5.);gl_Position=projectionMatrix*viewPosition;}',
        fragmentShader:
          'uniform float opacity;void main(){float radius=length(gl_PointCoord-.5);if(radius>.5)discard;gl_FragColor=vec4(.65,.8,.85,(1.-smoothstep(.1,.5,radius))*opacity);}',
      }),
    );
    const spray = new THREE.Points(droplets, sprayMaterial);
    spray.frustumCulled = false;
    spray.visible = false;
    scene.add(spray);
    return { root, tail, ring, ringMaterial, spray, sprayMaterial, droplets };
  });

  // Feathered silhouettes cross the island, alternating wingbeats and gliding.
  const crowMaterial = own(
    new THREE.MeshStandardMaterial({
      color: 0x080e14,
      roughness: 0.86,
      side: THREE.DoubleSide,
    }),
  );
  const crowBody = own(new THREE.SphereGeometry(1, 12, 8));
  const beakGeometry = own(new THREE.ConeGeometry(0.065, 0.26, 6));
  beakGeometry.rotateZ(-Math.PI / 2);
  const wingShape = new THREE.Shape([
    new THREE.Vector2(0.25, 0),
    new THREE.Vector2(0.15, 0.4),
    new THREE.Vector2(-0.25, 1),
    new THREE.Vector2(-0.7, 1.55),
    new THREE.Vector2(-0.82, 1.1),
    new THREE.Vector2(-1.08, 1.25),
    new THREE.Vector2(-0.92, 0.8),
    new THREE.Vector2(-1.19, 0.89),
    new THREE.Vector2(-0.94, 0.43),
    new THREE.Vector2(-0.4, 0),
  ]);
  const wingGeometry = own(new THREE.ShapeGeometry(wingShape));
  wingGeometry.rotateX(Math.PI / 2);
  const crowTail = fin(
    [
      [0, -0.14],
      [-0.5, -0.23],
      [-0.43, 0],
      [-0.5, 0.23],
      [0, 0.14],
    ],
    0.01,
  );
  crowTail.rotateX(Math.PI / 2);
  const crows = Array.from(
    { length: layout.referenceBirds ? (mobile ? 8 : 11) : mobile ? 5 : 8 },
    (_, index) => {
      const root = new THREE.Group();
      scene.add(root);
      const birdMaterial = own(crowMaterial.clone());
      birdMaterial.transparent = true;
      birdMaterial.depthWrite = false;
      const body = new THREE.Mesh(crowBody, birdMaterial);
      body.scale.set(0.43, 0.18, 0.2);
      root.add(body);
      const head = new THREE.Mesh(crowBody, birdMaterial);
      head.scale.set(0.17, 0.16, 0.15);
      head.position.set(0.36, 0.12, 0);
      root.add(head);
      const beak = new THREE.Mesh(beakGeometry, birdMaterial);
      beak.position.set(0.57, 0.1, 0);
      root.add(beak);
      const tail = new THREE.Mesh(crowTail, birdMaterial);
      tail.position.x = -0.3;
      root.add(tail);
      const wings = [-1, 1].map((side) => {
        const pivot = new THREE.Group();
        root.add(pivot);
        const wing = new THREE.Mesh(wingGeometry, birdMaterial);
        wing.scale.z = side;
        wing.position.z = side * 0.1;
        pivot.add(wing);
        return pivot;
      });
      root.scale.setScalar(
        (layout.referenceBirds && index < 6 ? 1.35 : 1) + (index % 3) * 0.08,
      );
      return { root, wings, material: birdMaterial };
    },
  );
  function update(seconds: number, camera?: THREE.Camera) {
    if (camera) {
      sea.position.x = horizon.position.x =
        Math.round(camera.position.x / 14) * 14;
      sea.position.z = horizon.position.z =
        Math.round(camera.position.z / 14) * 14;
    }
    time.value = seconds;
    for (let index = 0; index < fishes.length; index++) {
      const fish = fishes[index],
        pose = fishPose(seconds, index);
      fish.root.visible = pose.active;
      fish.root.position.set(pose.x, pose.y, pose.z);
      fish.root.rotation.set(0, pose.yaw, pose.pitch, 'YXZ');
      fish.tail.rotation.y = Math.sin(seconds * 7 + index) * 0.21;
      const splash = pose.splash;
      fish.ring.visible = splash >= 0;
      fish.spray.visible = splash >= 0 && splash < 0.8;
      if (splash >= 0) {
        const y = oceanSample(pose.splashX, pose.splashZ, seconds).height;
        fish.ring.position.set(pose.splashX, y + 0.1, pose.splashZ);
        fish.ring.scale.setScalar(1.4 + splash * 7);
        fish.ringMaterial.opacity = (1 - splash) * 0.48;
        fish.spray.position.set(pose.splashX, y + 0.12, pose.splashZ);
        fish.sprayMaterial.uniforms.opacity.value = (1 - splash) * 0.8;
        const attribute = fish.droplets.getAttribute('position');
        const age = splash * 3.2;
        for (let n = 0; n < splashCount; n++) {
          const angle = n * 2.399963 + index * 0.7;
          const speed = 0.7 + (n % 9) * 0.31;
          const lift = 2.6 + (n % 7) * 0.42;
          attribute.setXYZ(
            n,
            Math.cos(angle) * speed * age,
            Math.max(-0.2, lift * age - 3.5 * age * age),
            Math.sin(angle) * speed * age,
          );
        }
        attribute.needsUpdate = true;
      }
    }
    crows.forEach((crow, index) => {
      const pose = layout.referenceBirds
        ? referenceCrowPose(seconds, index)
        : crowPose(seconds, index);
      crow.root.position.set(pose.x, pose.y, pose.z);
      if (layout.crowOffset) crow.root.position.add(layout.crowOffset);
      crow.root.visible = pose.opacity > 0.001;
      crow.material.opacity = pose.opacity;
      crow.root.rotation.set(pose.bank, pose.yaw, pose.pitch, 'YXZ');
      crow.wings[0].rotation.x = pose.flap;
      crow.wings[1].rotation.x = -pose.flap;
    });
  }
  update(0);
  return {
    update,
    water,
    sea,
    horizon,
    clouds,
    fishes,
    crows,
    setDaylight(enabled: boolean) {
      oceanDaylight.value = enabled ? 1 : 0;
    },
    setBoats(boats: THREE.Object3D[]) {
      boatMasks.value.forEach((mask, i) => {
        const boat = boats[i];
        if (!boat) {
          mask.makeTranslation(1e9, 1e9, 1e9);
          return;
        }
        boat.updateWorldMatrix(true, false);
        mask.copy(boat.matrixWorld).invert();
      });
    },
  };
}
