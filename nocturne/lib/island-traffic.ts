import * as THREE from 'three';
import { createIslandAvatar } from './island-avatar.ts';
import { canSail } from './island-sailing.ts';
import { oceanSample } from './island-motion.ts';
import { bindRowboatOars } from './island-rowing.ts';

/** A bounded pool of occupied rowboats follows the player into the open ocean. */
export function createOceanTraffic(
  scene: THREE.Scene,
  template: THREE.Group,
  resources: Set<{ dispose: () => void }>,
  mobile: boolean,
) {
  const glow = new THREE.MeshBasicMaterial({ color: 0xffbb67 });
  resources.add(glow);
  const lampGeometry = new THREE.SphereGeometry(0.09, 8, 6);
  resources.add(lampGeometry);
  const boats = Array.from({ length: mobile ? 2 : 4 }, (_, index) => {
    const root = template.clone(true);
    root.name = `Offshore travellers ${index + 1}`;
    root.position.set(10000, 0, 10000);
    const passenger = createIslandAvatar(resources, true);
    passenger.setSeated(true);
    passenger.root.position.set(0.25, 0.02, 0);
    passenger.root.rotation.y = Math.PI / 2;
    root.add(passenger.root);
    const lantern = new THREE.Mesh(lampGeometry, glow);
    lantern.position.set(1.8, 0.95, 0);
    root.add(lantern);
    scene.add(root);
    return {
      root,
      passenger,
      rowing: bindRowboatOars(root),
      heading: index * 1.7,
      initialized: false,
    };
  });
  let previous = 0;
  return {
    boats,
    positions() {
      return boats.filter((b) => b.root.visible).map((b) => b.root.position);
    },
    update(time: number, viewer: THREE.Vector3, playerBoat: THREE.Vector3) {
      const dt = Math.min(0.05, Math.max(0, time - previous));
      previous = time;
      boats.forEach((entry, index) => {
        const { root, passenger } = entry;
        if (
          !entry.initialized ||
          Math.hypot(root.position.x - viewer.x, root.position.z - viewer.z) >
            230
        ) {
          let found = false;
          for (let attempt = 0; attempt < 24; attempt++) {
            const angle = index * 1.71 + attempt * 0.43 + time * 0.003,
              radius = (entry.initialized ? 145 : 55) + index * 19;
            const x = viewer.x + Math.cos(angle) * radius,
              z = viewer.z + Math.sin(angle) * radius;
            if (!canSail(x, z)) continue;
            root.position.set(x, 0, z);
            found = true;
            break;
          }
          root.visible = found;
          entry.initialized = found;
        }
        if (!root.visible) return;
        const speed = 1.9 + index * 0.24;
        const x = root.position.x + Math.cos(entry.heading) * speed * dt,
          z = root.position.z + Math.sin(entry.heading) * speed * dt;
        const aheadX = x + Math.cos(entry.heading) * 9,
          aheadZ = z + Math.sin(entry.heading) * 9;
        const clear =
          canSail(aheadX, aheadZ) &&
          (Math.hypot(x - playerBoat.x, z - playerBoat.z) > 7 ||
            Math.hypot(x - playerBoat.x, z - playerBoat.z) >
              Math.hypot(
                root.position.x - playerBoat.x,
                root.position.z - playerBoat.z,
              )) &&
          boats.every(
            (other) =>
              other === entry ||
              !other.root.visible ||
              Math.hypot(x - other.root.position.x, z - other.root.position.z) >
                7,
          );
        if (clear) root.position.set(x, 0, z);
        else entry.heading += dt * 0.9;
        const wave = oceanSample(root.position.x, root.position.z, time);
        root.position.y = wave.height + 0.08;
        root.rotation.set(
          Math.atan2(wave.normal.z, wave.normal.y) * 0.35,
          -entry.heading,
          -Math.atan2(wave.normal.x, wave.normal.y) * 0.35,
        );
        entry.rowing.update(dt, clear);
        if (entry.rowing.available)
          passenger.setRowingTargets(
            entry.rowing.leftHand,
            entry.rowing.rightHand,
          );
        passenger.update(0, false, dt, false);
      });
    },
  };
}
