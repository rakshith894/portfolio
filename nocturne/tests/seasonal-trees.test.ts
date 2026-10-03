import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSeasonalTrees } from '../lib/seasonal-trees.ts';

void test('winter alone has pink blossoms; day and night retain green foliage without reallocating', () => {
  const scene = new THREE.Scene();
  const resources = new Set<{ dispose(): void }>();
  const trees = createSeasonalTrees(
    scene,
    resources,
    [{ x: 4, y: 40, z: 26 }],
    false,
  );
  const canopy = scene.getObjectByName(
    'Seasonal tree canopy',
  ) as THREE.InstancedMesh;
  const falling = scene.getObjectByName(
    'Windborne leaves and winter petals',
  ) as THREE.InstancedMesh;
  const material = canopy.material as THREE.MeshStandardMaterial;
  const count = resources.size;
  trees.setMode('day');
  const green = material.color.getHex();
  trees.update(1);
  const initial = [...falling.instanceMatrix.array];
  trees.update(3);
  assert.notDeepEqual([...falling.instanceMatrix.array], initial);
  trees.setMode('winter');
  assert.notEqual(material.color.getHex(), green);
  trees.setMode('night');
  assert.equal(material.color.getHex(), green);
  assert.ok(material.emissiveIntensity > 0.1);
  trees.update(4, true);
  assert.equal(falling.visible, false);
  trees.update(4, false);
  assert.equal(falling.visible, true);
  assert.equal(resources.size, count);
  for (const value of falling.instanceMatrix.array)
    assert.ok(Number.isFinite(value));
  resources.forEach((resource) => resource.dispose());
});
