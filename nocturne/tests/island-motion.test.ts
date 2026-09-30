import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  advanceAtmosphere,
  oceanSample,
  fishPose,
  fishRoutes,
  crowPose,
  referenceCrowPose,
  SEA_LEVEL,
  waves,
} from '../lib/island-motion.ts';
import { createIslandLife } from '../lib/island-life.ts';
import { DOCK_HEIGHT } from '../lib/island-stairs.ts';

void test('the dock remains above the highest possible wave crest', () => {
  assert.ok(
    DOCK_HEIGHT >
      SEA_LEVEL + waves.reduce((sum, wave) => sum + wave.amplitude, 0) + 0.2,
  );
});

void test('ocean normals agree with the slope of the moving water', () => {
  for (const time of [0, 3.8, 76])
    for (const [x, z] of [
      [-54, 24],
      [47, 35],
      [0, 0],
    ]) {
      const wave = oceanSample(x, z, time),
        step = 0.0001;
      const dx =
        (oceanSample(x + step, z, time).height -
          oceanSample(x - step, z, time).height) /
        (2 * step);
      const dz =
        (oceanSample(x, z + step, time).height -
          oceanSample(x, z - step, time).height) /
        (2 * step);
      const normal = new THREE.Vector3(-dx, 1, -dz).normalize();
      assert.ok(
        normal.distanceTo(
          new THREE.Vector3(wave.normal.x, wave.normal.y, wave.normal.z),
        ) < 1e-8,
      );
      assert.ok(
        Math.abs(wave.height - SEA_LEVEL) <=
          waves.reduce((total, wave) => total + wave.amplitude, 0),
      );
    }
  assert.notEqual(oceanSample(8, 9, 0).height, oceanSample(8, 9, 2).height);
});

void test('fish emerge from below the waves, clear the island, then land with a fixed splash origin', () => {
  fishRoutes.forEach((route, index) => {
    assert.equal(fishPose(route.start - 0.01, index).active, false);
    for (const progress of [0, 1]) {
      const time = route.start + route.duration * progress,
        pose = fishPose(time, index);
      assert.ok(
        Math.abs(pose.y - oceanSample(pose.x, pose.z, time).height + 3.1) <
          1e-8,
      );
    }
    const peakTime = route.start + route.duration / 2,
      peak = fishPose(peakTime, index);
    assert.ok(
      Math.abs(
        peak.y - oceanSample(peak.x, peak.z, peakTime).height - route.height,
      ) < 1e-8,
    );
    let splashOrigin: { x: number; z: number } | null = null;
    for (let step = 0; step <= 300; step++) {
      const time = route.start + (step / 300) * (route.duration + 4),
        pose = fishPose(time, index);
      assert.ok(Math.hypot(pose.x, pose.z < 0 ? pose.z / 1.45 : pose.z) > 46);
      if (pose.splash >= 0) {
        if (splashOrigin)
          assert.deepEqual({ x: pose.splashX, z: pose.splashZ }, splashOrigin);
        splashOrigin = { x: pose.splashX, z: pose.splashZ };
      }
    }
    assert.ok(splashOrigin);
    assert.equal(fishPose(route.start + route.duration + 4, index).splash, -1);
  });
});

void test('crows travel across the island and leave, without visible resets or stationary circling', () => {
  for (const poseAt of [crowPose, referenceCrowPose]) {
    for (let index = 0; index < 11; index++) {
      let minX = Infinity,
        maxX = -Infinity,
        hidden = 0,
        travelled = 0;
      for (let time = 0; time < 240; time += 0.2) {
        const pose = poseAt(time, index),
          after = poseAt(time + 0.001, index);
        assert.ok(pose.y > (index < 6 ? 32 : 67));
        assert.ok(pose.opacity >= 0 && pose.opacity <= 1);
        if (index < 6)
          assert.ok(
            pose.z > 0,
            'Low flights stay in front of the manor and tower',
          );
        if (pose.opacity < 0.001) hidden++;
        const dx = after.x - pose.x,
          dz = after.z - pose.z;
        const step = Math.hypot(dx, dz);
        if (step > 0.02) {
          assert.equal(
            pose.opacity,
            0,
            'Route resets must happen only while invisible',
          );
          assert.ok(after.opacity < 0.001);
        } else if (pose.opacity > 0.1 && after.opacity > 0.1) {
          assert.ok(
            step > 0.006 && step < 0.012,
            'A visible crow must travel forward at flight speed',
          );
          const headingAgreement =
            (Math.cos(pose.yaw) * dx - Math.sin(pose.yaw) * dz) / step;
          assert.ok(
            headingAgreement > 0.99999,
            'The crow faces the direction it travels',
          );
          travelled++;
        }
        if (pose.opacity > 0.1) {
          minX = Math.min(minX, pose.x);
          maxX = Math.max(maxX, pose.x);
        }
      }
      assert.ok(
        maxX - minX > 180,
        'Flight coverage must extend well beyond the old small orbit',
      );
      assert.ok(hidden > 0 && travelled > 100);
      assert.equal(
        poseAt(5 - index * 0.53 + 11.2, index).flap,
        0.08,
        'Flights include gliding between wingbeats',
      );
    }
  }
});

void test('pause and resume preserve atmosphere phase without a hidden-tab catch-up', () => {
  let time = 3;
  for (let frame = 0; frame < 600; frame++)
    time = advanceAtmosphere(time, 1 / 60, true);
  assert.equal(time, 3);
  assert.equal(advanceAtmosphere(time, 1 / 60, false), 3 + 1 / 60);
  assert.equal(advanceAtmosphere(time, 120, false), 3.1);
  assert.equal(advanceAtmosphere(time, -5, false), 3);
});

void test('the scene wires motion to live shader uniforms, fish, crows, and pause-stable objects', () => {
  const scene = new THREE.Scene(),
    resources = new Set<{ dispose: () => void }>();
  const life = createIslandLife(scene, resources, false);
  const shader = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib.physical.uniforms),
    vertexShader: THREE.ShaderLib.physical.vertexShader,
    fragmentShader: THREE.ShaderLib.physical.fragmentShader,
  };
  life.water.onBeforeCompile(
    shader as Parameters<typeof life.water.onBeforeCompile>[0],
    {} as THREE.WebGLRenderer,
  );
  assert.ok(shader.vertexShader.includes('transformed.y=oceanWave.x'));
  assert.ok(shader.fragmentShader.includes('float distanceToCliff='));
  life.update(6.5);
  assert.equal(shader.uniforms.islandTime.value, 6.5);
  assert.equal(life.clouds.material.uniforms.islandTime.value, 6.5);
  assert.ok(life.fishes[0].root.visible);
  const birds = life.crows.map((c) => c.root.position.clone());
  const positions = life.fishes.map((f) => f.root.position.clone());
  life.update(6.5);
  positions.forEach((position, index) =>
    assert.ok(position.equals(life.fishes[index].root.position)),
  );
  life.crows.forEach((crow, index) => {
    const pose = crowPose(6.5, index);
    assert.equal(crow.root.rotation.x, pose.bank);
    assert.equal(crow.root.rotation.z, pose.pitch);
    assert.equal(crow.root.visible, pose.opacity > 0.001);
    assert.equal(crow.material.opacity, pose.opacity);
    assert.ok(birds[index].equals(crow.root.position));
  });
  assert.ok(life.sea.geometry.boundingBox!.max.y >= 1.38);
  resources.forEach((resource) => resource.dispose());
});

void test('the live graveyard flock translates during flight and hides between coastal passes', () => {
  for (const mobile of [false, true]) {
    const resources = new Set<{ dispose: () => void }>();
    const life = createIslandLife(new THREE.Scene(), resources, mobile, {
      referenceBirds: true,
    });
    assert.equal(life.crows.length, mobile ? 8 : 11);
    for (const time of [0, 12, 35, 43, 85, 160]) {
      life.update(time);
      life.crows.forEach((crow, index) => {
        const pose = referenceCrowPose(time, index);
        assert.ok(
          crow.root.position.distanceTo(
            new THREE.Vector3(pose.x, pose.y, pose.z),
          ) < 1e-9,
        );
        assert.equal(crow.material.opacity, pose.opacity);
        assert.equal(crow.root.visible, pose.opacity > 0.001);
        assert.equal(crow.root.rotation.z, pose.pitch);
      });
    }
    assert.notEqual(
      life.crows[0].material,
      life.crows[1].material,
      'One departing bird must not fade the whole flock',
    );
    resources.forEach((resource) => resource.dispose());
  }
});
