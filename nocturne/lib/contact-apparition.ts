import * as THREE from 'three';
import { MANOR_ORIGIN } from './reference-layout.ts';
import { MANOR_DOOR } from './manor-layout.ts';
import { createIslandAvatar } from './island-avatar.ts';
import type { ContactProfile } from './contact-profile.ts';

export const CONTACT_PROJECTOR = { x: 0, y: .03, z: -5.5 };

/** A translucent human mesh suspended above a floor projector. */
export function createContactApparition(scene: THREE.Scene, resources: Set<{ dispose: () => void }>, initial: ContactProfile) {
  const own = <T extends { dispose: () => void }>(value: T) => { resources.add(value); return value; };
  const root = new THREE.Group(); root.name = 'Entrance hall contact projector';
  root.position.copy(MANOR_ORIGIN).add(new THREE.Vector3(CONTACT_PROJECTOR.x, MANOR_DOOR.y + CONTACT_PROJECTOR.y, MANOR_DOOR.z + CONTACT_PROJECTOR.z));
  scene.add(root);
  const metal = own(new THREE.MeshStandardMaterial({ color: 0x172d32, metalness: .8, roughness: .35 }));
  const light = own(new THREE.MeshBasicMaterial({ color: 0x97ffdf, transparent: true, opacity: .85, depthWrite: false, toneMapped: false }));
  const base = new THREE.Mesh(own(new THREE.CylinderGeometry(.64, .72, .1, 64)), metal);
  base.position.y = .05; root.add(base);
  const button = new THREE.Mesh(own(new THREE.CylinderGeometry(.4, .43, .08, 48)), light);
  button.name = 'Press to meet Rakshith'; button.position.y = .14; root.add(button);
  for (const radius of [.5, .67, .86]) {
    const ring = new THREE.Mesh(own(new THREE.TorusGeometry(radius, .012, 8, 80)), light);
    ring.rotation.x = -Math.PI / 2; ring.position.y = .12; root.add(ring);
  }
  // The beam has no backing and never writes depth over the scenery.
  const beamMaterial = own(new THREE.ShaderMaterial({
    uniforms: { strength: { value: .28 } }, transparent: true, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 vUv; uniform float strength; void main(){float a=pow(1.-vUv.y,2.)*.15*strength; gl_FragColor=vec4(.28,.95,.82,a);}',
  }));
  const beam = new THREE.Mesh(own(new THREE.CylinderGeometry(.83, .26, 2.9, 64, 1, true)), beamMaterial);
  beam.position.y = 1.61; root.add(beam);
  const scanMaterial = own(new THREE.MeshBasicMaterial({ color: 0xb8ffee, transparent: true, opacity: .3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const scan = new THREE.Mesh(own(new THREE.TorusGeometry(.6, .006, 6, 80)), scanMaterial);
  scan.rotation.x = -Math.PI / 2; root.add(scan);
  const orbit = new THREE.Group(); orbit.position.y = 1.8; root.add(orbit);
  for (let i = 0; i < 3; i++) {
    const arc = new THREE.Mesh(own(new THREE.TorusGeometry(.9 + i * .05, .008, 6, 80, Math.PI * .72)), scanMaterial);
    arc.rotation.set(Math.PI / 2 + .25, i * .42, i * Math.PI * 2 / 3); orbit.add(arc);
  }
  const motePositions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) { const angle = i * 2.39996; motePositions[i * 3] = Math.cos(angle) * (.3 + (i % 7) / 10); motePositions[i * 3 + 1] = (i % 23) / 23 * 3; motePositions[i * 3 + 2] = Math.sin(angle) * (.3 + (i % 7) / 10); }
  const moteGeometry = own(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(motePositions, 3)));
  const motes = new THREE.Points(moteGeometry, own(new THREE.PointsMaterial({ color: 0xa9ffdd, size: .018, transparent: true, opacity: .6, blending: THREE.AdditiveBlending, depthWrite: false })));
  root.add(motes);
  const hologram = own(new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, strength: { value: .28 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vNormalView; varying vec3 vView; varying float vHeight;
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
    fragmentShader: `uniform float time; uniform float strength;
      varying vec3 vNormalView; varying vec3 vView; varying float vHeight;
      void main(){
        float rim=pow(1.-abs(dot(normalize(vNormalView),normalize(vView))),1.5);
        float lines=.7+.3*smoothstep(.15,.8,sin(vHeight*105.-time*2.));
        float scan=pow(max(0.,sin(vHeight*2.3-time*.8)),18.);
        gl_FragColor=vec4(mix(vec3(.18,.75,.7),vec3(.7,1.,.92),rim+scan*.3),(.13+rim*.52+scan*.12)*lines*strength);
      }`,
  }));
  const person = createIslandAvatar(resources, false);
  person.root.name = 'Human hologram suspended in air'; person.root.scale.setScalar(1.12);
  person.root.position.y = .78; root.add(person.root);
  const projectHuman = () => person.root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    if (object.geometry instanceof THREE.CircleGeometry || object.geometry instanceof THREE.PlaneGeometry) { object.visible = false; return; }
    // Keep ownership of imported textures after replacing their materials.
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
    }
    object.material = hologram; object.castShadow = false; object.receiveShadow = false;
  });
  projectHuman();
  let disposed = false;
  void person.ready.then(() => { if (!disposed) projectHuman(); });
  const labelCanvas = document.createElement('canvas'); labelCanvas.width = 768; labelCanvas.height = 160;
  const labelTexture = own(new THREE.CanvasTexture(labelCanvas)); labelTexture.colorSpace = THREE.SRGBColorSpace;
  const label = new THREE.Sprite(own(new THREE.SpriteMaterial({ map: labelTexture, transparent: true, depthWrite: false, toneMapped: false })));
  label.position.y = 3.15; label.scale.set(2.1, .44, 1); root.add(label);
  function setProfile(profile: ContactProfile) {
    const context = labelCanvas.getContext('2d'); if (!context) return;
    context.clearRect(0, 0, 768, 160); context.textAlign = 'center';
    context.fillStyle = '#dbfff1'; context.font = '46px Georgia'; context.fillText(profile.name, 384, 63, 740);
    context.font = '19px Arial'; context.fillStyle = '#9bd6ca'; context.fillText('PRESS THE PROJECTOR  /  ABOUT & CONTACT', 384, 113);
    labelTexture.needsUpdate = true;
  }
  setProfile(initial);
  let active = false, previousTime = 0, strength = .28;
  const target = new THREE.Vector3();
  return {
    root, setProfile,
    activate(open: boolean) { active = open; },
    near(position: THREE.Vector3) { return Math.abs(position.y - root.position.y) < .5 && Math.hypot(position.x - root.position.x, position.z - root.position.z) < 2.2; },
    hit(ray: THREE.Raycaster) { root.updateMatrixWorld(true); return ray.intersectObjects([base, button, person.root, label], true)[0] ?? null; },
    update(time: number, camera: THREE.Camera, reduced: boolean) {
      const dt = Math.min(.1, Math.max(0, time - previousTime)); previousTime = time;
      strength = THREE.MathUtils.damp(strength, active ? 1 : .38, reduced ? 100 : 5, dt);
      hologram.uniforms.time.value = reduced ? 0 : time;
      hologram.uniforms.strength.value = strength;
      beamMaterial.uniforms.strength.value = strength;
      person.update(0, false, dt, reduced);
      person.root.position.y = .78 + (reduced ? 0 : Math.sin(time * 1.2) * .055);
      person.root.rotation.y = Math.atan2(root.position.x - camera.position.x, root.position.z - camera.position.z);
      button.position.y = THREE.MathUtils.damp(button.position.y, active ? .105 : .14, 12, dt);
      light.opacity = reduced ? .85 : .75 + Math.sin(time * 1.8) * .1;
      scan.position.y = reduced ? 1.5 : .6 + (Math.sin(time * .65) * .5 + .5) * 2.2;
      scanMaterial.opacity = .14 + strength * .22;
      orbit.rotation.y = reduced ? 0 : time * .17;
      motes.rotation.y = reduced ? 0 : time * -.07;
      motes.position.y = reduced ? 0 : Math.sin(time * .4) * .12;
      camera.getWorldPosition(target);
      label.visible = target.distanceTo(root.position) < 18;
    },
    dispose() { disposed = true; root.removeFromParent(); },
  };
}
