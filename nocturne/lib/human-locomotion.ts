import * as THREE from 'three';

/** Playback follows distance travelled, so stopping or a wall cannot leave feet sliding. */
// Measured root travel in the original Rocketbox clips before making them in-place.
export const CAPTURED_WALK_SPEED = 1.21404045 / 1.2;
export const CAPTURED_RUN_SPEED = 2.11179794 / (22 / 30);
export function locomotionPace(speed: number, modelScale = 1, wasRunning = false) {
  const running = speed > (wasRunning ? 1.7 : 2.05) * modelScale;
  return { running, timeScale: THREE.MathUtils.clamp(speed / ((running ? CAPTURED_RUN_SPEED : CAPTURED_WALK_SPEED) * modelScale), 0, 2.5) };
}

export function createFootPlacement(model: THREE.Object3D) {
  const legs = ['L','R'].map(side => ({
    hip: model.getObjectByName(`Bip01_${side}_Thigh`),
    knee: model.getObjectByName(`Bip01_${side}_Calf`),
    foot: model.getObjectByName(`Bip01_${side}_Foot`),
  }));
  const hipPosition=new THREE.Vector3(), kneePosition=new THREE.Vector3(), footPosition=new THREE.Vector3();
  const axis=new THREE.Vector3(), bend=new THREE.Vector3(), target=new THREE.Vector3(), desiredKnee=new THREE.Vector3();
  const from=new THREE.Vector3(), to=new THREE.Vector3();
  const originalFoot=new THREE.Quaternion(), rotation=new THREE.Quaternion(), parentRotation=new THREE.Quaternion(), worldRotation=new THREE.Quaternion();
  function aim(bone: THREE.Object3D, oldDirection: THREE.Vector3, newDirection: THREE.Vector3) {
    bone.getWorldQuaternion(worldRotation);
    bone.parent!.getWorldQuaternion(parentRotation);
    rotation.setFromUnitVectors(oldDirection.normalize(),newDirection.normalize());
    bone.quaternion.copy(parentRotation.invert().multiply(rotation).multiply(worldRotation));
    bone.updateWorldMatrix(false,true);
  }
  return (ground: (x: number,z: number)=>number) => {
    model.updateWorldMatrix(true,true);
    for (const {hip,knee,foot} of legs) {
      if (!hip || !knee || !foot) continue;
      hip.getWorldPosition(hipPosition); knee.getWorldPosition(kneePosition); foot.getWorldPosition(footPosition);
      const floor=ground(footPosition.x,footPosition.z)+.085;
      const correction=THREE.MathUtils.clamp(floor-footPosition.y,0,.22);
      // Only resolve ground penetration. Pulling swing feet down destroys toe-off.
      if (correction <= .001) continue;
      target.copy(footPosition); target.y+=correction;
      foot.getWorldQuaternion(originalFoot);
      const upper=hipPosition.distanceTo(kneePosition), lower=kneePosition.distanceTo(footPosition);
      axis.copy(target).sub(hipPosition);
      const reach=THREE.MathUtils.clamp(axis.length(),Math.abs(upper-lower)+.001,upper+lower-.002);
      axis.normalize(); target.copy(hipPosition).addScaledVector(axis,reach);
      const along=(upper*upper-lower*lower+reach*reach)/(2*reach);
      bend.copy(kneePosition).sub(hipPosition).addScaledVector(axis,-from.copy(kneePosition).sub(hipPosition).dot(axis));
      if (bend.lengthSq()<1e-8) continue;
      bend.normalize();
      desiredKnee.copy(hipPosition).addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,upper*upper-along*along)));
      aim(hip,from.copy(kneePosition).sub(hipPosition),to.copy(desiredKnee).sub(hipPosition));
      knee.getWorldPosition(kneePosition); foot.getWorldPosition(footPosition);
      aim(knee,from.copy(footPosition).sub(kneePosition),to.copy(target).sub(kneePosition));
      foot.parent!.getWorldQuaternion(parentRotation);
      foot.quaternion.copy(parentRotation.invert().multiply(originalFoot));
      foot.updateWorldMatrix(false,true);
    }
  };
}
