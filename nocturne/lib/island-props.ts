import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** CC0 gate statues; instances share GPU resources. */
export async function loadCoastalProps(
  scene: THREE.Scene,
  resources: Set<{ dispose: () => void }>,
  mobile: boolean,
  disposed: () => boolean,
  ground: (x: number, z: number) => number,
  layout: { gate: THREE.Vector3 },
) {
  const loader = new GLTFLoader();
  async function asset(name: string, place: (template: THREE.Group) => void) {
    try {
      const gltf = await loader.loadAsync(
        `/models/coast/${name}/${name}_1k.gltf`,
      );
      const owned = new Set<{ dispose: () => void }>();
      gltf.scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        owned.add(object.geometry);
        object.receiveShadow = true;
        object.castShadow = !mobile && name === 'gothic_statue';
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          owned.add(material);
          for (const value of Object.values(material))
            if (value instanceof THREE.Texture) {
              value.anisotropy = 4;
              owned.add(value);
            }
        }
      });
      if (disposed()) {
        owned.forEach((item) => item.dispose());
        return;
      }
      owned.forEach((item) => resources.add(item));
      const box = new THREE.Box3().setFromObject(gltf.scene),
        center = box.getCenter(new THREE.Vector3());
      gltf.scene.position.set(-center.x, -box.min.y, -center.z);
      const template = new THREE.Group();
      template.add(gltf.scene);
      place(template);
    } catch {
      /* The complete procedural coastline remains available if an optional scan fails. */
    }
  }
  await asset('gothic_statue', (template) => {
    for (const side of [-1, 1]) {
      const statue = template.clone(true);
      statue.scale.setScalar(1.6);
      const x = layout.gate.x + side * 4.6;
      const z = layout.gate.z + 1;
      statue.position.set(x, ground(x, z) + 0.12, z);
      statue.rotation.y = side * 0.18;
      scene.add(statue);
    }
  });
}
