import * as THREE from 'three';
import { groundHeight } from './reference-layout.ts';
export const HAUNT_SITES = [
  { x: -8, z: -16 }, { x: 23, z: -18 }, { x: 0, z: 0 },
  { x: -5, z: 15 }, { x: 16, z: -40 }, { x: -10, z: -27 },
];

export function apparitionOpacity(
  time: number,
  index: number,
  distance: number,
) {
  const phase = ((time + index * 19) % 53) / 53;
  return (
    Math.pow(Math.max(0, Math.sin(phase * Math.PI * 2)), 4) *
    0.44 *
    THREE.MathUtils.smoothstep(distance, 5, 13)
  );
}

/** Slow silhouettes and cold grave lights, with no full-screen flashes. */
export function createHaunting(
  scene: THREE.Scene,
  resources: Set<{ dispose: () => void }>,
  mobile: boolean,
) {
  const own = <T extends { dispose: () => void }>(item: T) => {
    resources.add(item);
    return item;
  };
  const shroud = own(new THREE.LatheGeometry([
    new THREE.Vector2(.46,0),new THREE.Vector2(.38,.22),
    new THREE.Vector2(.25,.75),new THREE.Vector2(.28,1.22),
    new THREE.Vector2(.34,1.42),new THREE.Vector2(.14,1.65),
  ],24));
  const cloth=shroud.getAttribute('position');
  for(let i=0;i<cloth.count;i++) {
    const x=cloth.getX(i),y=cloth.getY(i),z=cloth.getZ(i),angle=Math.atan2(z,x);
    const fold=1+.07*Math.sin(angle*9+y*3);
    cloth.setXYZ(i,x*fold,y+(y<.3?(Math.sin(angle*9)+Math.cos(angle*13))*.08:0),z*fold*.65);
  }
  shroud.computeVertexNormals();
  const head = own(new THREE.SphereGeometry(0.2, 12, 10));
  const sleeve = own(new THREE.ConeGeometry(.095,.78,10));
  const glow = own(new THREE.SphereGeometry(0.045, 8, 6));
  const spirits = HAUNT_SITES
    .slice(0, mobile ? 4 : 6)
    .map(({x, z}, index) => {
      const root = new THREE.Group();
      root.position.set(x, groundHeight(x, z), z);
      const material = own(
        new THREE.MeshBasicMaterial({
          color: 0x788e96,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      const body = new THREE.Mesh(shroud, material);
      body.position.y = .08;
      root.add(body);
      const hood = new THREE.Mesh(head, material);
      hood.position.y = 1.83;
      hood.scale.set(1,1.25,.85);
      root.add(hood);
      const faceMaterial=own(new THREE.MeshBasicMaterial({color:0x03070a,transparent:true,opacity:0,depthWrite:false}));
      const face=new THREE.Mesh(head,faceMaterial);
      face.position.set(0,1.81,-.1);face.scale.set(.7,.94,.45);root.add(face);
      for(const side of [-1,1]) {
        const arm=new THREE.Mesh(sleeve,material);
        arm.position.set(side*.32,1.07,-.04);arm.rotation.z=side*.12;root.add(arm);
      }
      const lightMaterial = own(
        new THREE.MeshBasicMaterial({
          color: 0x9cccd1,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(glow, lightMaterial);
        eye.scale.set(0.4, 0.4, 0.4);
        eye.position.set(side * 0.065, 1.85, -0.205);
        root.add(eye);
      }
      // An unlit glow avoids rebuilding every scene shader as a ghost appears.
      const wisp = new THREE.Mesh(own(new THREE.SphereGeometry(.1,8,6)), lightMaterial);
      wisp.position.set(0.5, 0.75, 0.2);
      root.add(wisp);
      scene.add(root);
      return { root, material, faceMaterial, lightMaterial, wisp, index, body, x, z };
    });
  return {
    spirits,
    update(time: number, camera?: THREE.Camera) {
      for (const spirit of spirits) {
        const distance = camera
          ? camera.position.distanceTo(spirit.root.position)
          : 30;
        const alpha = apparitionOpacity(time, spirit.index, distance);
        spirit.material.opacity = alpha;
        spirit.lightMaterial.opacity = alpha * 0.6;
        spirit.faceMaterial.opacity = alpha*1.6;
        spirit.root.visible = alpha > 0.002;
        spirit.wisp.scale.setScalar(.8+Math.sin(time*1.3+spirit.index)*.2);
        spirit.root.position.x = spirit.x + Math.sin(time*.17+spirit.index)*.35;
        spirit.root.position.z = spirit.z + Math.cos(time*.13+spirit.index)*.25;
        spirit.body.scale.x = 1 + Math.sin(time*1.4+spirit.index)*.04;
        spirit.body.rotation.z = Math.sin(time*.8+spirit.index)*.045;
        spirit.root.position.y =
          groundHeight(spirit.root.position.x, spirit.root.position.z) +
          .18 + Math.sin(time * 0.5 + spirit.index) * 0.15;
        if (camera)
          spirit.root.rotation.y = Math.atan2(
            spirit.root.position.x - camera.position.x,
            spirit.root.position.z - camera.position.z,
          );
      }
    },
  };
}
