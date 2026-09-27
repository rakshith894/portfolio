import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createReferenceEnvironment } from '../lib/reference-environment.ts';
import {
  SHORE_ROUTE,
  TOWER_ROUTE,
  BRIDGE_ROUTE,
  VIADUCT_ROUTE,
  BOAT_DOCK,
  DOCK_HEIGHT,
  sampleStairRoute,
} from '../lib/island-stairs.ts';

for (const mobile of [false, true]) {
  void test(`rendered stone stays clear of bridge, boat and tower routes (${mobile ? 'mobile' : 'desktop'})`, async (context) => {
    context.mock.method(
      THREE.TextureLoader.prototype,
      'load',
      (_url: string, onLoad?: (texture: THREE.Texture) => void) => {
        const texture = new THREE.Texture();
        queueMicrotask(() => onLoad?.(texture));
        return texture;
      },
    );
    context.mock.method(GLTFLoader.prototype, 'loadAsync', async () => {
      throw new Error('Optional scan omitted in geometry test');
    });
    const resources = new Set<{ dispose: () => void }>();
    const scene = new THREE.Scene();
    const renderer = {
      capabilities: { getMaxAnisotropy: () => 1 },
    } as THREE.WebGLRenderer;
    const environment = createReferenceEnvironment(
      scene,
      renderer,
      resources,
      mobile,
    );
    try {
      await environment.ready;
      scene.updateMatrixWorld(true);
      const solids: THREE.Mesh[] = [];
      scene.traverse((object) => {
        if (
          !(object instanceof THREE.Mesh) ||
          object instanceof THREE.InstancedMesh
        )
          return;
        const material = object.material;
        if (
          !(material instanceof THREE.MeshStandardMaterial) ||
          material.transparent ||
          !material.visible
        )
          return;
        material.side = THREE.DoubleSide;
        solids.push(object);
      });
      const ray = new THREE.Raycaster();
      const failures: string[] = [];
      let checked = 0;
      for (const route of [BRIDGE_ROUTE, SHORE_ROUTE, TOWER_ROUTE, VIADUCT_ROUTE]) {
        for (let i = 1; i < route.length; i++) {
          const a = route[i - 1],
            b = route[i],
            length = Math.hypot(b[0] - a[0], b[2] - a[2]);
          const count = Math.ceil(length / 0.5);
          for (let j = 0; j <= count; j++)
            for (const offset of [-0.42, 0, 0.42]) {
              const x =
                THREE.MathUtils.lerp(a[0], b[0], j / count) -
                ((b[2] - a[2]) / length) * offset;
              const z =
                THREE.MathUtils.lerp(a[2], b[2], j / count) +
                ((b[0] - a[0]) / length) * offset;
              const y = sampleStairRoute(route, x, z)!.height;
              ray.set(
                new THREE.Vector3(x, y + 0.3, z),
                new THREE.Vector3(0, 1, 0),
              );
              ray.far = 1.7;
              const hit = ray.intersectObjects(solids, false)[0];
              checked++;
              if (hit)
                failures.push(
                  `${x.toFixed(2)},${z.toFixed(2)} at height ${hit.point.y.toFixed(2)} (${hit.object.name || hit.object.type})`,
                );
            }
        }
      }
      assert.ok(checked > 400);
      // Regression for the sea-visible strips beside the bridge approach.
      for (let x=-14.3;x<=-8;x+=.3) for (const z of [-32.32,-29.68]) {
        const y=sampleStairRoute(BRIDGE_ROUTE,x,z,1.6)!.height;
        ray.set(new THREE.Vector3(x,y+.2,z),new THREE.Vector3(0,-1,0));
        ray.far=.6;
        assert.ok(ray.intersectObjects(solids,false).length,`Open sea gap beside bridge at ${x},${z}`);
      }
      assert.equal(
        failures.length,
        0,
        `Visible geometry intersects traveller: ${failures.slice(0, 12).join('; ')}`,
      );
      ray.set(
        new THREE.Vector3(BOAT_DOCK.x, DOCK_HEIGHT+.3, BOAT_DOCK.z),
        new THREE.Vector3(0, 1, 0),
      );
      assert.equal(
        ray.intersectObjects(solids, false).length,
        0,
        'Dock is obstructed',
      );
    } finally {
      environment.dispose();
      resources.forEach((resource) => resource.dispose());
    }
  });
}
