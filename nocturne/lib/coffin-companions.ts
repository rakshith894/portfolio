import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { walkingHeight } from './island-walk.ts';

type Coffin = { id: number; root: THREE.Group; hinge: THREE.Group; open: boolean };
type Navigator = { routeAsync: (start: THREE.Vector3, end: THREE.Vector3, snap: number, cancelled: () => boolean) => Promise<THREE.Vector3[] | null> };
type Phase = 'sleeping' | 'rising' | 'joining' | 'phasing' | 'following' | 'recalling' | 'resting';

function skeletonTemplate(resources: Set<{ dispose: () => void }>) {
  const own = <T extends { dispose: () => void }>(value: T) => { resources.add(value); return value; };
  const sphere = own(new THREE.SphereGeometry(1, 12, 8));
  const cylinder = own(new THREE.CylinderGeometry(1, 1, 1, 8));
  const root = new THREE.Group();
  const bone = own(new THREE.MeshStandardMaterial({ color: 0xd9d2b4, roughness: .8 }));
  const dark = own(new THREE.MeshStandardMaterial({ color: 0x151d1d, roughness: .9 }));
  const eye = own(new THREE.MeshBasicMaterial({ color: 0x8affe0, toneMapped: false }));
  function ball(parent: THREE.Group, x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material = bone) {
    const mesh = new THREE.Mesh(sphere, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh);
  }
  function link(parent: THREE.Group, a: number[], b: number[], radius: number) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const mesh = new THREE.Mesh(cylinder, bone);
    mesh.position.copy(start).add(end).multiplyScalar(.5);
    mesh.scale.set(radius, delta.length(), radius);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); parent.add(mesh);
    for (const p of [start, end]) ball(parent, p.x, p.y, p.z, radius * 1.35, radius * 1.3, radius * 1.35);
  }
  const torso = new THREE.Group(); root.add(torso);
  link(torso, [0, .83, 0], [0, 1.44, 0], .035);
  for (let i = 0; i < 7; i++) ball(torso, 0, .94 + i * .07, -.025, .052, .028, .04);
  for (let i = 0; i < 6; i++) for (const side of [-1, 1]) {
    const radius = .16 + Math.sin(i / 5 * Math.PI) * .055;
    const points = Array.from({ length: 13 }, (_, n) => {
      const angle = n / 12 * Math.PI;
      return new THREE.Vector3(side * Math.sin(angle) * radius, 1.4 - i * .065 - Math.sin(angle) * .018, -Math.cos(angle) * .1);
    });
    const geometry = own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, .014, 5, false));
    torso.add(new THREE.Mesh(geometry, bone));
  }
  link(torso, [-.25, 1.44, 0], [.25, 1.44, 0], .032);
  for (const side of [-1, 1]) {
    const pelvis = new THREE.Mesh(own(new THREE.TorusGeometry(.095, .036, 6, 16)), bone);
    pelvis.position.set(side * .105, .87, 0); pelvis.scale.set(1, .75, .65); torso.add(pelvis);
  }
  ball(torso, 0, 1.69, 0, .145, .18, .125);
  ball(torso, 0, 1.56, .037, .105, .052, .09);
  for (const side of [-1, 1]) {
    ball(torso, side * .062, 1.7, .108, .045, .048, .028, dark);
    ball(torso, side * .062, 1.7, .13, .014, .017, .012, eye);
  }
  ball(torso, 0, 1.636, .12, .024, .029, .012, dark);
  for (let i = -3; i <= 3; i++) ball(torso, i * .023, 1.587, .115, .009, .019, .013);
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.name = `arm${side}`; arm.position.set(side * .26, 1.43, 0); root.add(arm);
    link(arm, [0, 0, 0], [side * .06, -.28, .015], .029);
    link(arm, [side * .06, -.28, .015], [side * .08, -.56, .07], .022);
    for (let finger = 0; finger < 4; finger++) link(arm, [side * .08 + (finger - 1.5) * .025, -.57, .07], [side * .08 + (finger - 1.5) * .027, -.68, .085], .009);
    const leg = new THREE.Group(); leg.name = `leg${side}`; leg.position.set(side * .11, .85, 0); root.add(leg);
    link(leg, [0, 0, 0], [side * .015, -.39, .025], .042);
    link(leg, [side * .015, -.39, .025], [side * .015, -.77, 0], .032);
    ball(leg, side * .015, -.81, .06, .065, .045, .13);
  }
  // Batch rigid bones per limb/material; clones share all geometry.
  for (const group of [...root.children] as THREE.Group[]) {
    group.updateMatrixWorld(true);
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const mesh of [...group.children] as THREE.Mesh[]) {
      mesh.updateMatrix();
      const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
      const parts = batches.get(mesh.material as THREE.Material) ?? [];
      parts.push(geometry); batches.set(mesh.material as THREE.Material, parts); group.remove(mesh);
    }
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
      if (geometry) group.add(new THREE.Mesh(own(geometry), material));
    }
  }
  return root;
}

/** Followers use the player's actual 3D trail, including stairs, rooms and sea travel. */
export function createCoffinCompanions(scene: THREE.Scene, coffins: Coffin[], resources: Set<{ dispose: () => void }>, navigator: Navigator, canStand: (x: number, z: number) => boolean, announce: (text: string) => void = () => {}) {
  const template = skeletonTemplate(resources);
  const trail: THREE.Vector3[] = [];
  let disposed = false;
  scene.updateMatrixWorld(true);
  const companions = coffins.map(coffin => {
    const body = template.clone(true); body.name = `Coffin guardian ${coffin.id + 1}`; body.visible = false; body.scale.setScalar(coffin.root.scale.x * .94); scene.add(body);
    const home = coffin.root.localToWorld(new THREE.Vector3(0, .32, 2.04));
    const exits: THREE.Vector3[] = [];
    for (let radius = 1.5; radius <= 4; radius += .5) for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
      const point = home.clone().add(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
      if (canStand(point.x, point.z)) { point.y = walkingHeight(point.x, point.z); exits.push(point); }
    }
    exits.sort((a, b) => a.distanceToSquared(home) - b.distanceToSquared(home));
    const exitCandidates: THREE.Vector3[] = [];
    for (const point of exits) if (exitCandidates.every(other => other.distanceTo(point) > 1)) exitCandidates.push(point);
    const exit = exits[0] ?? home.clone();
    // Individual opacity allows one guardian to dissolve without affecting the others.
    const materials = new Map<THREE.Material, THREE.Material>();
    body.traverse(object => { if (object instanceof THREE.Mesh) {
      const source = object.material as THREE.Material;
      if (!materials.has(source)) { const copy = source.clone(); copy.transparent = true; resources.add(copy); materials.set(source, copy); }
      object.material = materials.get(source)!;
    } });
    return { coffin, body, home, exit, exitCandidates, summonTarget: home.clone(), phase: 'sleeping' as Phase, elapsed: 0, wanted: false, near: false, cursor: 0, route: [] as THREE.Vector3[], joining: false, request: 0, stride: 0, materials };
  });
  const opacity = (companion: typeof companions[number], value: number) => companion.materials.forEach(material => { material.opacity = value; });
  function toggle(id: number, player: THREE.Vector3) {
    const c = companions.find(entry => entry.coffin.id === id);
    if (!c) return false;
    c.wanted = !c.wanted; c.elapsed = 0; c.request++;
    if (c.wanted) {
      if (!trail.length) trail.push(player.clone());
      c.phase = 'rising'; c.body.visible = true; c.body.position.copy(c.home); c.body.rotation.set(-Math.PI / 2, c.coffin.root.rotation.y, 0);
      c.cursor = trail.length - 1; c.route = []; c.joining = false; c.coffin.open = true; opacity(c, 1);
      announce(`Guardian ${id + 1} is waking. Click its coffin again to send it home.`);
    } else {
      c.phase = 'recalling'; c.joining = false;
      announce(`Guardian ${id + 1} is returning to its coffin.`);
    }
    return true;
  }
  function step(c: typeof companions[number], target: THREE.Vector3, distance: number) {
    const delta = target.clone().sub(c.body.position), remaining = delta.length();
    if (remaining < .025) { c.body.position.copy(target); return true; }
    const moved = Math.min(distance, remaining);
    c.body.position.addScaledVector(delta, moved / remaining); c.stride += moved;
    if (Math.hypot(delta.x, delta.z) > .001) c.body.rotation.y = Math.atan2(delta.x, delta.z);
    return remaining <= distance;
  }
  return {
    companions,
    toggle,
    hit(ray: THREE.Raycaster, blockers: THREE.Object3D[]) {
      const hit = ray.intersectObjects(coffins.map(coffin => coffin.root), true)[0];
      if (!hit || hit.distance > 45) return null;
      const blocked = ray.intersectObjects(blockers, true)[0];
      if (blocked && blocked.distance < hit.distance - .12) return null;
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData.coffin === undefined) object = object.parent;
      return typeof object?.userData.coffin === 'number' ? object.userData.coffin as number : null;
    },
    update(dt: number, player: THREE.Vector3, canApproach: boolean, reduced: boolean) {
      dt = Math.min(Math.max(dt, 0), .1);
      if (!trail.length || trail.at(-1)!.distanceTo(player) > .16) trail.push(player.clone());
      for (const c of companions) {
        const nearby = canApproach && Math.hypot(player.x - c.home.x, player.z - c.home.z) < 2.65 && Math.abs(player.y - c.home.y) < 2;
        if (nearby && !c.near && c.phase === 'sleeping') toggle(c.coffin.id, player);
        c.near = nearby;
        c.coffin.hinge.rotation.z = THREE.MathUtils.damp(c.coffin.hinge.rotation.z, c.coffin.open ? 1.65 : 0, reduced ? 18 : 5, dt);
        if (c.phase === 'sleeping') continue;
        c.elapsed += dt;
        const previous = c.body.position.clone();
        if (c.phase === 'rising') {
          const t = THREE.MathUtils.smoothstep(c.elapsed, .5, 2.1);
          c.body.rotation.x = -Math.PI / 2 * (1 - t);
          c.body.position.copy(c.home); c.body.position.y += .28 * t;
          if (c.elapsed >= 2.8) { c.phase = 'joining'; c.elapsed = 0; }
        } else if (c.phase === 'joining') {
          if (!c.joining) {
            c.joining = true;
            const request = ++c.request, index = c.cursor, target = trail[index]?.clone() ?? player.clone();
            const cancelled = () => disposed || c.request !== request;
            const findRoute = async () => {
              for (const exit of c.exitCandidates) {
                const route = await navigator.routeAsync(exit.clone(), target, .9, cancelled);
                if (cancelled()) return null;
                if (route) { c.exit.copy(exit); return route; }
              }
              return null;
            };
            void findRoute().then(route => {
              if (disposed || c.request !== request) return;
              if (!route) { c.phase = 'phasing'; c.elapsed = 0; c.summonTarget.copy(target); announce('The guardian passes through the veil to reach your trail.'); return; }
              const rim = c.exit.clone(); rim.y = Math.max(c.home.y + .28, c.exit.y);
              c.route = [rim, c.exit.clone(), ...route.map(point => new THREE.Vector3(point.x, walkingHeight(point.x, point.z), point.z))];
              if (!c.route.length) c.phase = 'following';
            }).catch(() => {
              if (disposed || c.request !== request) return;
              c.wanted = false; c.phase = 'recalling'; c.elapsed = 0;
              announce('The guardian is resting. Approach its coffin to try again.');
            });
          }
          if (c.route.length && step(c, c.route[0], dt * 6)) { c.route.shift(); if (!c.route.length) c.phase = 'following'; }
        } else if (c.phase === 'phasing') {
          if (c.elapsed < .5) opacity(c, 1 - c.elapsed * 2);
          else { c.body.position.copy(c.summonTarget); opacity(c, Math.min(1, (c.elapsed - .5) * 2)); }
          if (c.elapsed >= 1) c.phase = 'following';
        } else if (c.phase === 'following') {
          opacity(c, c.body.position.distanceTo(player) < .9 ? .25 : 1);
          const lag = 1.8 + (c.coffin.id % 12) * .5;
          let remaining = dt * Math.min(17, 4 + c.body.position.distanceTo(player) * .65);
          while (remaining > 0 && c.cursor < trail.length) {
            const target = trail[c.cursor];
            if (c.cursor >= trail.length - 2 && c.body.position.distanceTo(player) < lag) break;
            const length = c.body.position.distanceTo(target);
            if (!step(c, target, remaining)) break;
            c.cursor++; remaining -= length;
          }
        } else if (c.phase === 'recalling') {
          const t = Math.min(1, c.elapsed / .65); opacity(c, 1 - t);
          if (t === 1) { c.phase = 'resting'; c.elapsed = 0; c.body.position.copy(c.home); c.body.rotation.set(0, c.coffin.root.rotation.y, 0); }
        } else if (c.phase === 'resting') {
          opacity(c, Math.min(1, c.elapsed * 3));
          c.body.rotation.x = -Math.PI / 2 * THREE.MathUtils.smoothstep(c.elapsed, .4, 1.5);
          if (c.elapsed > 1.6) c.coffin.open = false;
          if (c.elapsed > 2.3) { c.phase = 'sleeping'; c.body.visible = false; }
        }
        const moving = c.body.position.distanceToSquared(previous) > .00001;
        for (const side of [-1, 1]) {
          const swing = moving ? Math.sin(c.stride * 7) * .48 * side : 0;
          const arm = c.body.getObjectByName(`arm${side}`)!, leg = c.body.getObjectByName(`leg${side}`)!;
          arm.rotation.x = THREE.MathUtils.damp(arm.rotation.x, -swing * .7, 12, dt);
          leg.rotation.x = THREE.MathUtils.damp(leg.rotation.x, swing, 12, dt);
        }
      }
      // Only consumed trail points can be discarded; preserve every stair and doorway turn.
      const active = companions.filter(c => ['rising', 'joining', 'phasing', 'following'].includes(c.phase));
      if (!active.length) { trail.splice(0, Math.max(0, trail.length - 1)); }
      else {
        const consumed = Math.min(...active.map(c => c.cursor));
        if (consumed > 256) { trail.splice(0, consumed); for (const c of active) c.cursor -= consumed; }
      }
    },
    dispose() { disposed = true; companions.forEach(c => { c.request++; c.body.removeFromParent(); }); },
  };
}
