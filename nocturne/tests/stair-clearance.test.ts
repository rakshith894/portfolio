import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clearStairScenery } from '../lib/stair-clearance.ts';

void test('carved scenery has a floor and closed cut faces behind the shore stairs', () => {
  const geometry=new THREE.BoxGeometry(4,8,4).translate(-22,23,-34);
  clearStairScenery(geometry,true);
  const material=new THREE.MeshBasicMaterial();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.updateMatrixWorld(true);
  try {
    const origin=new THREE.Vector3(-22,23,-34);
    for (const direction of [new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]) {
      const hits=new THREE.Raycaster(origin,direction,0,2).intersectObject(mesh);
      assert.ok(hits.length,'The cut rock wall must hide its hollow interior');
      assert.ok(Math.abs(hits[0].distance-1.55)<.001);
    }
    const floor=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,5).intersectObject(mesh);
    assert.ok(floor.length,'The recessed floor must cover the water below');
    assert.ok(Math.abs(floor[0].point.y-(19.4175-.4))<.001);
  } finally { geometry.dispose();material.dispose(); }
});
