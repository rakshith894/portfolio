import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createReferenceEnvironment } from '../lib/reference-environment.ts';
import { createIslandWalker, walkingHeight } from '../lib/island-walk.ts';
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
      for (const route of [
        BRIDGE_ROUTE,
        SHORE_ROUTE,
        TOWER_ROUTE,
        VIADUCT_ROUTE,
      ]) {
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
      // Several separately sealed rock meshes used to occupy these exact cut
      // planes, making the wall texture shimmer as the camera moved.
      for (const z of [-34, -37.4, -40.8, -44.2])
        for (let x = -27.73; x < -17; x += 0.79)
          for (const lift of [2.1, 4.7, 7.3])
            for (const side of [-1, 1]) {
              ray.set(
                new THREE.Vector3(x, walkingHeight(x, z) + lift, z),
                new THREE.Vector3(0, 0, side),
              );
              ray.far = 1.56;
              const faces = ray
                .intersectObjects(solids, false)
                .filter((hit) => Math.abs(hit.distance - 1.55) < 0.0001);
              assert.ok(
                faces.length <= 1,
                `Overlapping retaining faces at ${x},${z}, lift ${lift}, side ${side}: ${faces.length}`,
              );
            }
      // Regression for the sea-visible strips beside the bridge approach.
      for (let x = -14.3; x <= -8; x += 0.3)
        for (const z of [-32.32, -29.68]) {
          const y = sampleStairRoute(BRIDGE_ROUTE, x, z, 1.6)!.height;
          ray.set(
            new THREE.Vector3(x, y + 0.2, z),
            new THREE.Vector3(0, -1, 0),
          );
          ray.far = 0.6;
          assert.ok(
            ray.intersectObjects(solids, false).length,
            `Open sea gap beside bridge at ${x},${z}`,
          );
        }
      assert.equal(
        failures.length,
        0,
        `Visible geometry intersects traveller: ${failures.slice(0, 12).join('; ')}`,
      );
      ray.set(
        new THREE.Vector3(BOAT_DOCK.x, DOCK_HEIGHT + 0.3, BOAT_DOCK.z),
        new THREE.Vector3(0, 1, 0),
      );
      assert.equal(
        ray.intersectObjects(solids, false).length,
        0,
        'Dock is obstructed',
      );
      // Check the actual rendered retaining faces, shoulders and rocks from
      // both travel directions and while orbiting through each stair turn.
      const walker = createIslandWalker(mobile);
      const obstructionFailures: string[] = [];
      for (let i = 1; i < SHORE_ROUTE.length; i++) {
        const a = SHORE_ROUTE[i - 1],
          b = SHORE_ROUTE[i];
        for (const progress of [0.1, 0.5, 0.9])
          for (let heading = 0; heading < 8; heading++) {
            const x = THREE.MathUtils.lerp(a[0], b[0], progress);
            const z = THREE.MathUtils.lerp(a[2], b[2], progress);
            const target = new THREE.Vector3(x, walkingHeight(x, z) + 1.65, z);
            const camera = target
              .clone()
              .add(
                new THREE.Vector3(
                  Math.sin((heading * Math.PI) / 4) * 9,
                  4,
                  Math.cos((heading * Math.PI) / 4) * 9,
                ),
              );
            walker.constrainCamera(camera, target);
            const originalDirection = camera.clone().sub(target).normalize();
            environment.constrainShoreCamera(camera, target);
            assert.ok(
              camera
                .clone()
                .sub(target)
                .normalize()
                .distanceTo(originalDirection) < 1e-8,
              'Wall avoidance must not lift or swing the camera away from the traveller',
            );
            ray.set(target, originalDirection);
            ray.near = 0.001;
            ray.far = camera.distanceTo(target) - 0.05;
            if (ray.intersectObjects(solids, false).length)
              obstructionFailures.push(
                `segment ${i}, progress ${progress}, heading ${heading}`,
              );
          }
      }
      assert.deepEqual(
        obstructionFailures,
        [],
        'Boat stair walls must never stand between camera and traveller',
      );
    } finally {
      environment.dispose();
      resources.forEach((resource) => resource.dispose());
    }
  });
}
