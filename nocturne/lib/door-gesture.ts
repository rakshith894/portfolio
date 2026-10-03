import * as THREE from 'three';

export const easeDoor = (progress: number) => {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Blend a two-bone reach over the walking/idle pose, in world coordinates. */
export function createDoorReach(
  upper: THREE.Object3D,
  fore: THREE.Object3D,
  hand: THREE.Object3D,
) {
  const saved = new Map<THREE.Object3D, THREE.Quaternion>();
  const shoulder = new THREE.Vector3(),
    elbow = new THREE.Vector3();
  const palm = new THREE.Vector3(),
    target = new THREE.Vector3();
  const axis = new THREE.Vector3(),
    bend = new THREE.Vector3();
  const joint = new THREE.Vector3(),
    from = new THREE.Vector3(),
    to = new THREE.Vector3();
  const rotation = new THREE.Quaternion(),
    parent = new THREE.Quaternion();
  const world = new THREE.Quaternion();
  function aim(
    bone: THREE.Object3D,
    oldDirection: THREE.Vector3,
    direction: THREE.Vector3,
  ) {
    saved.set(bone, bone.quaternion.clone());
    bone.getWorldQuaternion(world);
    bone.parent!.getWorldQuaternion(parent);
    rotation.setFromUnitVectors(
      oldDirection.normalize(),
      direction.normalize(),
    );
    bone.quaternion.copy(parent.invert().multiply(rotation).multiply(world));
    bone.updateWorldMatrix(false, true);
  }
  return {
    restore() {
      for (const [bone, quaternion] of saved) bone.quaternion.copy(quaternion);
      saved.clear();
    },
    apply(handle: THREE.Vector3, weight: number) {
      if (weight <= 0) return;
      upper.updateWorldMatrix(true, true);
      upper.getWorldPosition(shoulder);
      fore.getWorldPosition(elbow);
      hand.getWorldPosition(palm);
      target.copy(palm).lerp(handle, THREE.MathUtils.clamp(weight, 0, 1));
      const a = shoulder.distanceTo(elbow),
        b = elbow.distanceTo(palm);
      if (a < 0.001 || b < 0.001) return;
      axis.copy(target).sub(shoulder);
      if (axis.lengthSq() < 1e-8) return;
      const reach = THREE.MathUtils.clamp(
        axis.length(),
        Math.abs(a - b) + 0.001,
        a + b - 0.001,
      );
      axis.normalize();
      target.copy(shoulder).addScaledVector(axis, reach);
      const along = (a * a - b * b + reach * reach) / (2 * reach);
      bend.set(0, -1, 0).addScaledVector(axis, axis.y);
      if (bend.lengthSq() < 1e-6)
        bend.set(1, 0, 0).addScaledVector(axis, -axis.x);
      bend.normalize();
      joint
        .copy(shoulder)
        .addScaledVector(axis, along)
        .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
      aim(upper, from.copy(elbow).sub(shoulder), to.copy(joint).sub(shoulder));
      fore.getWorldPosition(elbow);
      hand.getWorldPosition(palm);
      aim(fore, from.copy(palm).sub(elbow), to.copy(target).sub(elbow));
    },
  };
}
