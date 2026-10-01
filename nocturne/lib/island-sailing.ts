import * as THREE from 'three';
import { onIsland } from './reference-layout.ts';
import { BOAT_MOORING } from './island-stairs.ts';
import { SEA_OBSTACLES } from './coastal-layout.ts';

export const SAIL_SPEED = 9;
export const FAST_SAIL_SPEED = 14;
export type SeaPoint = { x: number; z: number };

/** Hull clearance includes the bow at any heading; there is no outer sea boundary. */
export function canSail(x: number, z: number) {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    !onIsland(x, z, -3) &&
    Math.hypot(x + 52, (z + 31) / 1.12) > 12 &&
    !(x > -48 && x < -14 && Math.abs(z + 31) < 4) &&
    !SEA_OBSTACLES.some(
      (obstacle) =>
        Math.hypot(x - obstacle.x, z - obstacle.z) < obstacle.radius + 3.2,
    )
  );
}
export function clearSea(a: SeaPoint, b: SeaPoint) {
  if (!canSail(a.x, a.z) || !canSail(b.x, b.z)) return false;
  const dx = b.x - a.x,
    dz = b.z - a.z,
    length = Math.hypot(dx, dz);
  if (length < 0.001) return true;
  // All shore obstacles are inside this circle. Distant horizon clicks should
  // cost the same as local routes, rather than sampling kilometres of empty sea.
  const ux = dx / length,
    uz = dz / length;
  const centerDistance = (-5 - a.x) * ux + (-6 - a.z) * uz;
  const closestX = a.x + centerDistance * ux + 5,
    closestZ = a.z + centerDistance * uz + 6;
  const perpendicularSquared = closestX * closestX + closestZ * closestZ;
  if (perpendicularSquared > 95 * 95) return true;
  const half = Math.sqrt(95 * 95 - perpendicularSquared);
  const from = Math.max(0, centerDistance - half),
    to = Math.min(length, centerDistance + half);
  if (from > to) return true;
  const steps = Math.max(1, Math.ceil((to - from) / 1.2));
  for (let i = 0; i <= steps; i++)
    if (
      !canSail(
        a.x + ux * (from + ((to - from) * i) / steps),
        a.z + uz * (from + ((to - from) * i) / steps),
      )
    )
      return false;
  return true;
}

/** Visibility graph routes around both islands instead of teleporting home. */
export function seaRoute(
  start: SeaPoint,
  target: SeaPoint = BOAT_MOORING,
): SeaPoint[] | null {
  if (!canSail(start.x, start.z) || !canSail(target.x, target.z)) return null;
  if (clearSea(start, target)) return [{ ...target }];
  const nodes = [
    start,
    target,
    ...Array.from({ length: 32 }, (_, i) => ({
      x: 110 * Math.cos((i * Math.PI) / 16),
      z: -6 + 125 * Math.sin((i * Math.PI) / 16),
    })),
  ];
  const distance = nodes.map(() => Infinity),
    previous = nodes.map(() => -1),
    visited = new Set<number>();
  distance[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (current < 0 || distance[i] < distance[current]))
        current = i;
    if (current < 0 || !Number.isFinite(distance[current])) break;
    if (current === 1) {
      const path: SeaPoint[] = [];
      for (let n = 1; n !== 0; n = previous[n]) path.unshift({ ...nodes[n] });
      return path;
    }
    visited.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const cost =
        distance[current] +
        Math.hypot(
          nodes[i].x - nodes[current].x,
          nodes[i].z - nodes[current].z,
        );
      if (cost < distance[i] && clearSea(nodes[current], nodes[i])) {
        distance[i] = cost;
        previous[i] = current;
      }
    }
  }
  return null;
}

export function createSailingController(start: SeaPoint = BOAT_MOORING) {
  const position = new THREE.Vector3(start.x, 0, start.z);
  const velocity = new THREE.Vector3();
  let heading = Math.PI / 2;
  return {
    position,
    velocity,
    get heading() {
      return heading;
    },
    stop() {
      velocity.set(0, 0, 0);
    },
    move(
      direction: THREE.Vector3,
      delta: number,
      fast = false,
      traffic: SeaPoint[] = [],
    ) {
      if (
        !Number.isFinite(delta) ||
        !Number.isFinite(direction.x) ||
        !Number.isFinite(direction.z)
      )
        return 0;
      const dt = THREE.MathUtils.clamp(delta, 0, 0.05);
      const desired = direction
        .clone()
        .setY(0)
        .clampLength(0, 1)
        .multiplyScalar(fast ? FAST_SAIL_SPEED : SAIL_SPEED);
      velocity.lerp(desired, 1 - Math.exp(-dt * 3));
      if (desired.lengthSq() === 0 && velocity.lengthSq() < 0.0025)
        velocity.set(0, 0, 0);
      const displacement = velocity.clone().multiplyScalar(dt),
        steps = Math.max(1, Math.ceil(displacement.length() / 0.15));
      const before = position.clone();
      for (let i = 0; i < steps; i++) {
        const x = position.x + displacement.x / steps,
          z = position.z + displacement.z / steps;
        if (
          !canSail(x, z) ||
          traffic.some((other) => Math.hypot(x - other.x, z - other.z) < 5.6)
        ) {
          velocity.set(0, 0, 0);
          break;
        }
        position.set(x, 0, z);
      }
      if (velocity.lengthSq() > 0.01) {
        const target = Math.atan2(-velocity.x, -velocity.z);
        heading +=
          Math.atan2(Math.sin(target - heading), Math.cos(target - heading)) *
          (1 - Math.exp(-dt * 5));
      }
      return position.distanceTo(before);
    },
  };
}
