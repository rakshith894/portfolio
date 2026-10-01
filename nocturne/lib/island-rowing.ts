import * as THREE from 'three';

/** One stroke drives both wooden oars and the traveller's hand targets. */
export function createRowboatOars(
  boat: THREE.Group,
  material: THREE.Material,
  resources: Set<{ dispose: () => void }>,
) {
  const own = <T extends { dispose: () => void }>(value: T) => {
    resources.add(value);
    return value;
  };
  const shaft = own(new THREE.CylinderGeometry(0.035, 0.028, 2.9, 6));
  shaft.rotateX(Math.PI / 2);
  shaft.translate(0, 0, 0.9);
  const blade = own(new THREE.BoxGeometry(0.22, 0.055, 0.68));
  const ring = own(new THREE.TorusGeometry(0.085, 0.022, 5, 10));
  const iron = own(
    new THREE.MeshStandardMaterial({
      color: 0x292c2c,
      roughness: 0.72,
      metalness: 0.6,
    }),
  );
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.name = `Rowing oar ${side}`;
    pivot.position.set(0.12, 0.9, side * 0.77);
    boat.add(pivot);
    const handle = new THREE.Object3D();
    handle.name = `Oar grip ${side}`;
    handle.position.z = -side * 0.55;
    pivot.add(handle);
    const wood = new THREE.Mesh(shaft, material);
    wood.scale.z = side;
    pivot.add(wood);
    const paddle = new THREE.Mesh(blade, material);
    paddle.position.z = side * 2.25;
    pivot.add(paddle);
    const lock = new THREE.Mesh(ring, iron);
    lock.position.copy(pivot.position);
    lock.rotation.y = Math.PI / 2;
    boat.add(lock);
  }
  return bindRowboatOars(boat);
}

/** Also binds cloned offshore boats without duplicating their geometry. */
export function bindRowboatOars(boat: THREE.Group) {
  const oars = [-1, 1].map((side) => ({
    side,
    pivot: boat.getObjectByName(`Rowing oar ${side}`),
  }));
  const left = boat.getObjectByName('Oar grip 1'),
    right = boat.getObjectByName('Oar grip -1');
  const leftHand = new THREE.Vector3(),
    rightHand = new THREE.Vector3();
  let phase = 0,
    effort = 0;
  return {
    leftHand,
    rightHand,
    get effort() {
      return effort;
    },
    get phase() {
      return phase;
    },
    update(dt: number, active: boolean, fast = false) {
      const elapsed = THREE.MathUtils.clamp(dt, 0, 0.1);
      effort = THREE.MathUtils.damp(effort, active ? 1 : 0, 7, elapsed);
      const previous = phase;
      if (active) phase += elapsed * (fast ? 4.5 : 3.3);
      for (const { side, pivot } of oars)
        if (pivot) {
          pivot.rotation.set(
            side * (0.08 + 0.2 * Math.sin(phase)) * effort,
            side * Math.cos(phase) * 0.5 * effort,
            0,
          );
        }
      boat.updateWorldMatrix(true, true);
      left?.getWorldPosition(leftHand);
      right?.getWorldPosition(rightHand);
      return (
        active &&
        Math.floor((previous + 0.25) / (Math.PI * 2)) !==
          Math.floor((phase + 0.25) / (Math.PI * 2))
      );
    },
    get available() {
      return !!left && !!right;
    },
  };
}

/** Two-bone arm placement keeps hands on the grips throughout the stroke. */
export function createRowingHands(model: THREE.Object3D) {
  const arms = ['L', 'R'].map((side) => ({
    upper: model.getObjectByName(`Bip01_${side}_UpperArm`),
    fore: model.getObjectByName(`Bip01_${side}_Forearm`),
    hand: model.getObjectByName(`Bip01_${side}_Hand`),
    fingers: Array.from({ length: 5 }, (_, finger) =>
      ['', '1', '2'].map((joint) =>
        model.getObjectByName(`Bip01_${side}_Finger${finger}${joint}`),
      ),
    ).flat(),
  }));
  const saved = new Map<THREE.Object3D, THREE.Quaternion>();
  const shoulder = new THREE.Vector3(),
    elbow = new THREE.Vector3(),
    handPosition = new THREE.Vector3();
  const axis = new THREE.Vector3(),
    bend = new THREE.Vector3(),
    target = new THREE.Vector3(),
    joint = new THREE.Vector3();
  const from = new THREE.Vector3(),
    to = new THREE.Vector3();
  const world = new THREE.Quaternion(),
    parent = new THREE.Quaternion(),
    rotation = new THREE.Quaternion();
  const forward = new THREE.Vector3(),
    down = new THREE.Vector3(),
    across = new THREE.Vector3(),
    handRotation = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  function aim(
    bone: THREE.Object3D,
    oldDirection: THREE.Vector3,
    newDirection: THREE.Vector3,
  ) {
    saved.set(bone, bone.quaternion.clone());
    bone.getWorldQuaternion(world);
    bone.parent!.getWorldQuaternion(parent);
    rotation.setFromUnitVectors(
      oldDirection.normalize(),
      newDirection.normalize(),
    );
    bone.quaternion.copy(parent.invert().multiply(rotation).multiply(world));
    bone.updateWorldMatrix(false, true);
  }
  return {
    restore() {
      for (const [bone, pose] of saved) bone.quaternion.copy(pose);
      saved.clear();
    },
    apply(left: THREE.Vector3, right: THREE.Vector3) {
      model.updateWorldMatrix(true, true);
      forward.set(0, 0, 1).transformDirection(model.matrixWorld);
      down.set(0, -1, 0).transformDirection(model.matrixWorld);
      across.crossVectors(forward, down).normalize();
      handRotation.setFromRotationMatrix(
        basis.makeBasis(forward, down, across),
      );
      arms.forEach(({ upper, fore, hand, fingers }, index) => {
        if (!upper || !fore || !hand) return;
        upper.getWorldPosition(shoulder);
        fore.getWorldPosition(elbow);
        hand.getWorldPosition(handPosition);
        // Place the palm around the shaft, rather than putting the wrist on it.
        target.copy(index === 0 ? left : right).addScaledVector(forward, -0.07);
        const a = shoulder.distanceTo(elbow),
          b = elbow.distanceTo(handPosition);
        axis.copy(target).sub(shoulder);
        const reach = THREE.MathUtils.clamp(
          axis.length(),
          Math.abs(a - b) + 0.001,
          a + b - 0.001,
        );
        axis.normalize();
        target.copy(shoulder).addScaledVector(axis, reach);
        const along = (a * a - b * b + reach * reach) / (2 * reach);
        // Keep elbows below the hands and shoulders, away from the torso.
        bend.set(0, -1, 0).addScaledVector(axis, axis.y).normalize();
        if (bend.lengthSq() < 0.01) bend.set(1, 0, 0);
        joint
          .copy(shoulder)
          .addScaledVector(axis, along)
          .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
        aim(
          upper,
          from.copy(elbow).sub(shoulder),
          to.copy(joint).sub(shoulder),
        );
        fore.getWorldPosition(elbow);
        hand.getWorldPosition(handPosition);
        aim(
          fore,
          from.copy(handPosition).sub(elbow),
          to.copy(target).sub(elbow),
        );
        saved.set(hand, hand.quaternion.clone());
        hand.parent!.getWorldQuaternion(parent);
        hand.quaternion.copy(parent.invert().multiply(handRotation));
        for (const finger of fingers)
          if (finger) {
            saved.set(finger, finger.quaternion.clone());
            finger.rotateZ(/Finger0/.test(finger.name) ? 0.35 : 0.95);
          }
        hand.updateWorldMatrix(false, true);
      });
    },
  };
}
