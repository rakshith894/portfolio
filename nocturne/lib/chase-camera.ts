import * as THREE from 'three';
import { walkingDirection } from './island-walk.ts';

/** Keep held movement stable while the following camera turns around it. */
export function createTravelDirection() {
  let previousForward = 0,
    previousSide = 0;
  const heading = new THREE.Vector3();
  return (
    forward: number,
    side: number,
    camera: THREE.Vector3,
    player: THREE.Vector3,
    manual = false,
  ) => {
    if (manual || forward !== previousForward || side !== previousSide)
      heading.copy(walkingDirection(forward, side, camera, player));
    previousForward = forward;
    previousSide = side;
    return heading.clone();
  };
}

/** Rotate the existing orbit behind the travel heading, preserving zoom and pitch. */
export function followBehind(
  camera: THREE.Camera,
  target: THREE.Vector3,
  heading: number,
  dt: number,
) {
  const offset = camera.position.clone().sub(target);
  const radius = Math.hypot(offset.x, offset.z);
  if (radius < 0.001) return;
  const current = Math.atan2(offset.x, offset.z);
  const turn = Math.atan2(
    Math.sin(heading - current),
    Math.cos(heading - current),
  );
  const angle = current + turn * (1 - Math.exp(-Math.max(0, dt) * 4));
  camera.position.x = target.x + Math.sin(angle) * radius;
  camera.position.z = target.z + Math.cos(angle) * radius;
}

/** Preserve the requested zoom when a wall temporarily shortens the camera arm. */
export function createFollowOrbit(initialDistance = 10) {
  let desired = initialDistance;
  let smoothed: number | null = null;
  let lastDt = 1 / 60;
  return {
    reset(distance = desired) {
      desired = THREE.MathUtils.clamp(distance, 4.5, 42);
      smoothed = null;
    },
    zoom(factor: number) {
      desired = THREE.MathUtils.clamp(desired * factor, 4.5, 42);
      smoothed = null;
    },
    prepare(
      position: THREE.Vector3,
      target: THREE.Vector3,
      dt: number,
      _manual = false,
    ) {
      lastDt = dt > 0 ? dt : 1 / 60;
      const offset = position.clone().sub(target);
      const current = offset.length();
      if (current > 0.001) {
        position.copy(target).add(offset.setLength(desired));
      }
    },
    commit(position: THREE.Vector3, target: THREE.Vector3) {
      const offset = position.clone().sub(target);
      const raw = offset.length();
      if (raw < 0.001) return;

      if (smoothed === null || raw <= smoothed) {
        smoothed = raw;
      } else {
        smoothed = Math.min(
          desired,
          THREE.MathUtils.damp(smoothed, raw, 6, lastDt),
        );
      }
      position.copy(target).add(offset.setLength(smoothed));
    },
  };
}
