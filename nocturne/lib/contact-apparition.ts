import * as THREE from 'three';
import { MANOR_ORIGIN } from './reference-layout.ts';
import { MANOR_DOOR } from './manor-layout.ts';
import { createIslandAvatar } from './island-avatar.ts';
import type { ContactProfile } from './contact-profile.ts';

export const CONTACT_PROJECTOR = { x: 0, y: 0.03, z: -5.5 };

/** A translucent human mesh suspended above a floor projector. */
export function createContactApparition(
  scene: THREE.Scene,
  resources: Set<{ dispose: () => void }>,
  initial: ContactProfile,
) {
  const own = <T extends { dispose: () => void }>(value: T) => {
    resources.add(value);
    return value;
  };
  const root = new THREE.Group();
  root.name = 'Entrance hall contact projector';
  root.position
    .copy(MANOR_ORIGIN)
    .add(
      new THREE.Vector3(
        CONTACT_PROJECTOR.x,
        MANOR_DOOR.y + CONTACT_PROJECTOR.y,
        MANOR_DOOR.z + CONTACT_PROJECTOR.z,
      ),
    );
  scene.add(root);

  const metal = own(
    new THREE.MeshStandardMaterial({
      color: 0x172d32,
      metalness: 0.85,
      roughness: 0.3,
    }),
  );
  const light = own(
    new THREE.MeshBasicMaterial({
      color: 0x97ffdf,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  const base = new THREE.Mesh(
    own(new THREE.CylinderGeometry(0.68, 0.76, 0.1, 72)),
    metal,
  );
  base.position.y = 0.05;
  root.add(base);
  const button = new THREE.Mesh(
    own(new THREE.CylinderGeometry(0.4, 0.43, 0.08, 48)),
    light,
  );
  button.name = 'Press to meet Rakshith';
  button.position.y = 0.14;
  root.add(button);

  // Floor projector rings
  for (const radius of [0.5, 0.67, 0.86]) {
    const ring = new THREE.Mesh(
      own(new THREE.TorusGeometry(radius, 0.012, 8, 80)),
      light,
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.12;
    root.add(ring);
  }

  // --- Colour-cycle uniforms shared across effects ---
  const colorUniforms = {
    time: { value: 0 },
    strength: { value: 0.28 },
    hue: { value: 0.0 }, // 0-1, drives hue rotation across all shaders
  };

  // Beam (conical projection) — colour-shifted each frame
  const beamMaterial = own(
    new THREE.ShaderMaterial({
      uniforms: colorUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
      varying vec2 vUv; uniform float strength; uniform float hue;
      vec3 hsl2rgb(float h,float s,float l){
        vec3 rgb=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);
        return l+s*(rgb-.5)*(1.-abs(2.*l-1.));
      }
      void main(){
        float a=pow(1.-vUv.y,2.)*.14*strength;
        vec3 col=hsl2rgb(hue,0.85,0.65);
        gl_FragColor=vec4(col,a);
      }`,
    }),
  );
  const beam = new THREE.Mesh(
    own(new THREE.CylinderGeometry(0.83, 0.26, 2.9, 64, 1, true)),
    beamMaterial,
  );
  beam.position.y = 1.61;
  root.add(beam);

  // Scan ring (rises and falls through the figure)
  const scanMaterial = own(
    new THREE.ShaderMaterial({
      uniforms: colorUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `
      uniform float strength; uniform float hue;
      vec3 hsl2rgb(float h,float s,float l){
        vec3 rgb=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);
        return l+s*(rgb-.5)*(1.-abs(2.*l-1.));
      }
      void main(){
        vec3 col=hsl2rgb(hue,0.9,0.75);
        gl_FragColor=vec4(col,(.14+strength*.22));
      }`,
    }),
  );
  const scan = new THREE.Mesh(
    own(new THREE.TorusGeometry(0.6, 0.006, 6, 80)),
    scanMaterial,
  );
  scan.rotation.x = -Math.PI / 2;
  root.add(scan);

  // Orbiting arcs
  const orbit = new THREE.Group();
  orbit.position.y = 1.8;
  root.add(orbit);
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(
      own(
        new THREE.TorusGeometry(0.9 + i * 0.05, 0.008, 6, 80, Math.PI * 0.72),
      ),
      scanMaterial,
    );
    arc.rotation.set(Math.PI / 2 + 0.25, i * 0.42, (i * Math.PI * 2) / 3);
    orbit.add(arc);
  }

  // Extra energy rings at different heights that spin on different axes
  const energyRings: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const energyMat = own(
      new THREE.ShaderMaterial({
        uniforms: { ...colorUniforms, offset: { value: i * 0.25 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
        fragmentShader: `
        uniform float strength; uniform float hue; uniform float offset;
        vec3 hsl2rgb(float h,float s,float l){
          vec3 rgb=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);
          return l+s*(rgb-.5)*(1.-abs(2.*l-1.));
        }
        void main(){
          vec3 col=hsl2rgb(fract(hue+offset),0.9,0.7);
          gl_FragColor=vec4(col, 0.35*strength);
        }`,
      }),
    );
    const er = new THREE.Mesh(
      own(new THREE.TorusGeometry(0.55 + i * 0.08, 0.007, 6, 64)),
      energyMat,
    );
    er.position.y = 1.2 + i * 0.4;
    root.add(er);
    energyRings.push(er);
  }

  // DNA-helix style motes (200 particles in a double helix)
  const moteCount = 200;
  const motePositions = new Float32Array(moteCount * 3);
  const moteColors = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    const t = i / moteCount;
    const angle = i * 2.39996;
    const helix = i % 2 === 0 ? angle : angle + Math.PI;
    motePositions[i * 3] = Math.cos(helix) * (0.22 + t * 0.18);
    motePositions[i * 3 + 1] = t * 3.2;
    motePositions[i * 3 + 2] = Math.sin(helix) * (0.22 + t * 0.18);
    moteColors[i * 3] = 0.6 + 0.4 * Math.sin(i * 0.4);
    moteColors[i * 3 + 1] = 1.0;
    moteColors[i * 3 + 2] = 0.88;
  }
  const moteGeometry = own(
    new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(motePositions, 3))
      .setAttribute('color', new THREE.BufferAttribute(moteColors, 3)),
  );
  const motes = new THREE.Points(
    moteGeometry,
    own(
      new THREE.PointsMaterial({
        size: 0.03,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        vertexColors: true,
      }),
    ),
  );
  root.add(motes);

  // Lightning arc sprites between two points
  const lightningMat = own(
    new THREE.LineBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const lightningGeo = own(
    new THREE.BufferGeometry().setFromPoints(
      Array.from(
        { length: 12 },
        (_, i) =>
          new THREE.Vector3(
            Math.sin((i / 11) * Math.PI) * 0.5,
            0.5 + (i / 11) * 2.4,
            Math.cos((i / 11) * Math.PI) * 0.3,
          ),
      ),
    ),
  );
  const lightning = new THREE.Line(lightningGeo, lightningMat);
  root.add(lightning);

  // Hologram body shader — colour-shifting rim + scanlines
  const hologram = own(
    new THREE.ShaderMaterial({
      uniforms: colorUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
      varying vec3 vNormalView; varying vec3 vView; varying float vHeight;
      #include <common>
      #include <skinning_pars_vertex>
      void main(){
        #include <beginnormal_vertex>
        #include <skinbase_vertex>
        #include <skinnormal_vertex>
        #include <defaultnormal_vertex>
        #include <begin_vertex>
        #include <skinning_vertex>
        vec4 mv=modelViewMatrix*vec4(transformed,1.);
        vNormalView=normalize(transformedNormal); vView=-mv.xyz;
        vHeight=(modelMatrix*vec4(transformed,1.)).y;
        gl_Position=projectionMatrix*mv;
      }`,
      fragmentShader: `
      uniform float time; uniform float strength; uniform float hue;
      varying vec3 vNormalView; varying vec3 vView; varying float vHeight;
      vec3 hsl2rgb(float h,float s,float l){
        vec3 rgb=clamp(abs(mod(h*6.+vec3(0,4,2),6.)-3.)-1.,0.,1.);
        return l+s*(rgb-.5)*(1.-abs(2.*l-1.));
      }
      void main(){
        float rim=pow(1.-abs(dot(normalize(vNormalView),normalize(vView))),1.4);
        float lines=.65+.35*smoothstep(.1,.9,sin(vHeight*110.-time*2.5));
        float scan=pow(max(0.,sin(vHeight*2.5-time*.9)),16.);
        float glitch=step(.97,fract(sin(vHeight*43.+time*.3)*417.))*step(.5,sin(time*7.));
        // Colour shifts across the body height
        vec3 baseCol=hsl2rgb(hue+vHeight*.08,0.85,0.65);
        vec3 rimCol =hsl2rgb(fract(hue+.33),0.9,0.8);
        vec3 col=mix(baseCol,rimCol,rim+scan*.25);
        col=mix(col,vec3(1.),glitch*.35);
        gl_FragColor=vec4(col,(.1+rim*.55+scan*.1)*lines*strength+glitch*.08);
      }`,
    }),
  );

  const person = createIslandAvatar(resources, false, true);
  person.root.name = 'Human hologram suspended in air';
  person.root.scale.setScalar(1.12);
  person.root.position.y = 0.78;
  root.add(person.root);
  const projectHuman = () =>
    person.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (
        object.geometry instanceof THREE.CircleGeometry ||
        object.geometry instanceof THREE.PlaneGeometry
      ) {
        object.visible = false;
        return;
      }
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        resources.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) resources.add(value);
      }
      object.material = hologram;
      object.castShadow = false;
      object.receiveShadow = false;
    });
  projectHuman();
  let disposed = false;
  void person.ready.then(() => {
    if (!disposed) projectHuman();
  });

  // Floating name label
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 768;
  labelCanvas.height = 160;
  const labelTexture = own(new THREE.CanvasTexture(labelCanvas));
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(
    own(
      new THREE.SpriteMaterial({
        map: labelTexture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  label.position.y = 3.3;
  label.scale.set(2.2, 0.46, 1);
  root.add(label);

  function setProfile(profile: ContactProfile) {
    const ctx = labelCanvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 768, 160);
    ctx.textAlign = 'center';
    // Gradient name text
    const grad = ctx.createLinearGradient(0, 0, 768, 0);
    grad.addColorStop(0, '#a4ffe0');
    grad.addColorStop(0.5, '#c4b5fd');
    grad.addColorStop(1, '#67e8f9');
    ctx.fillStyle = grad;
    ctx.font = '48px Georgia';
    ctx.fillText(profile.name, 384, 65, 740);
    ctx.font = '17px Arial';
    ctx.fillStyle = '#9bd6ca88';
    ctx.fillText('PRESS THE PROJECTOR  /  ABOUT & CONTACT', 384, 115);
    labelTexture.needsUpdate = true;
  }
  setProfile(initial);

  let active = false,
    previousTime = 0,
    strength = 0.85;
  const target = new THREE.Vector3();
  const lightningPts: THREE.Vector3[] = [];

  return {
    root,
    setProfile,
    activate(open: boolean) {
      active = open;
    },
    near(position: THREE.Vector3) {
      return (
        Math.abs(position.y - root.position.y) < 0.5 &&
        Math.hypot(position.x - root.position.x, position.z - root.position.z) <
          2.2
      );
    },
    hit(ray: THREE.Raycaster) {
      root.updateMatrixWorld(true);
      return (
        ray.intersectObjects([base, button, person.root, label], true)[0] ??
        null
      );
    },
    update(time: number, camera: THREE.Camera, reduced: boolean) {
      const dt = Math.min(0.1, Math.max(0, time - previousTime));
      previousTime = time;
      strength = THREE.MathUtils.damp(
        strength,
        active ? 1 : 0.85,
        reduced ? 100 : 5,
        dt,
      );

      // Cycle hue 0→1 every 8 seconds — drives all colour-shifting effects
      const hue = reduced ? 0.48 : (time * 0.125) % 1.0;

      colorUniforms.time.value = reduced ? 0 : time;
      colorUniforms.strength.value = strength;
      colorUniforms.hue.value = hue;

      // Sync energy ring materials with same uniforms
      for (const [i, er] of energyRings.entries()) {
        (er.material as THREE.ShaderMaterial).uniforms.hue.value = hue;
        (er.material as THREE.ShaderMaterial).uniforms.strength.value =
          strength;
        er.rotation.x = time * (0.6 + i * 0.15);
        er.rotation.z = time * (0.4 + i * 0.1);
      }

      // Body float and billboard
      person.update(0, false, dt, reduced);
      person.root.position.y =
        0.78 + (reduced ? 0 : Math.sin(time * 1.2) * 0.06);
      person.root.rotation.y = Math.atan2(
        root.position.x - camera.position.x,
        root.position.z - camera.position.z,
      );

      // Projector button
      button.position.y = THREE.MathUtils.damp(
        button.position.y,
        active ? 0.105 : 0.14,
        12,
        dt,
      );

      // Light ring colour sync
      const rgb = new THREE.Color().setHSL(hue, 0.85, 0.65);
      light.color.lerp(rgb, 0.05);

      // Scan ring sweeping
      scan.position.y = reduced
        ? 1.5
        : 0.6 + (Math.sin(time * 0.65) * 0.5 + 0.5) * 2.4;
      orbit.rotation.y = reduced ? 0 : time * 0.5;

      // Double-helix motes animate + colour-shift
      for (let i = 0; i < moteCount; i++) {
        const t = reduced ? 0 : time;
        const helix =
          i % 2 === 0 ? i * 2.39996 + t * 0.3 : i * 2.39996 + Math.PI + t * 0.3;
        const h = ((i / moteCount) * 3.2 + t * 0.22) % 3.2;
        const r = 0.22 + (h / 3.2) * 0.18 + Math.sin(t * 0.8 + i) * 0.05;
        motePositions[i * 3] = Math.cos(helix) * r;
        motePositions[i * 3 + 1] = h;
        motePositions[i * 3 + 2] = Math.sin(helix) * r;
        // Colour each mote by hue offset
        const c = new THREE.Color().setHSL(
          fract(hue + (i / moteCount) * 0.4),
          1.0,
          0.75,
        );
        moteColors[i * 3] = c.r;
        moteColors[i * 3 + 1] = c.g;
        moteColors[i * 3 + 2] = c.b;
      }
      moteGeometry.attributes.position.needsUpdate = true;
      moteGeometry.attributes.color.needsUpdate = true;
      motes.position.y = reduced ? 0 : Math.sin(time * 0.38) * 0.1;

      // Lightning arc jitter
      if (!reduced) {
        lightningPts.length = 0;
        for (let i = 0; i < 12; i++) {
          const frac = i / 11;
          lightningPts.push(
            new THREE.Vector3(
              Math.sin(frac * Math.PI + time * 2) * 0.45 +
                (Math.random() - 0.5) * 0.12,
              0.5 + frac * 2.4,
              Math.cos(frac * Math.PI + time * 1.5) * 0.3 +
                (Math.random() - 0.5) * 0.08,
            ),
          );
        }
        lightningGeo.setFromPoints(lightningPts);
        lightningMat.color.setHSL(hue, 1, 0.75);
        lightningMat.opacity = 0.25 + Math.sin(time * 8) * 0.2;
      } else {
        lightningMat.opacity = 0;
      }

      camera.getWorldPosition(target);
      label.visible = target.distanceTo(root.position) < 18;
    },
    dispose() {
      disposed = true;
      root.removeFromParent();
    },
  };
}

function fract(v: number) {
  return v - Math.floor(v);
}
