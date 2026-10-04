import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { createIslandAvatar } from './island-avatar.ts';
import type { createIslandWalker } from './island-walk.ts';
import { walkingHeight } from './island-walk.ts';
import { createTravelDirection, followBehind } from './chase-camera.ts';
import { MANOR_ORIGIN } from './reference-layout.ts';
import { MANOR_DOOR } from './manor-layout.ts';
import {
  createHouseWalker,
  houseRoute,
  HOUSE_RADIUS,
  doorSegment,
  type HousePoint,
} from './house-layout.ts';
import { createHouseScene } from './house-scene.ts';
import { houseSurface } from './house-stairs.ts';
import { createHouseCamera } from './house-camera.ts';
import { DEFAULT_HALL_SETTINGS, type HallSettings } from './master-hall.ts';
import type { HallFrameId, HallProject } from './hall-projects.ts';
import { easeDoor } from './door-gesture.ts';

export type HouseStatus = {
  inside: boolean;
  room: string;
  detail: string;
  door: string | null;
  open: boolean;
  travelling: boolean;
  masterHall: boolean;
  skillsRoom: boolean;
} | null;

/** One avatar, camera and renderer cross the real threshold in both directions. */
export function createHouseExploration(
  scene: THREE.Scene,
  manor: THREE.Group,
  player: ReturnType<typeof createIslandAvatar>,
  walker: ReturnType<typeof createIslandWalker>,
  camera: THREE.PerspectiveCamera,
  controls: OrbitControls,
  mobile: boolean,
  report: (status: HouseStatus) => void,
  creak: () => void,
  manualCamera: () => boolean = () => false,
  openProject: (id: HallFrameId) => void = () => {},
  followers: () => THREE.Vector3[] = () => [],
) {
  const origin = MANOR_ORIGIN.clone().add(
    new THREE.Vector3(0, MANOR_DOOR.y, MANOR_DOOR.z),
  );
  const root = new THREE.Scene();
  root.name = 'Rooms inside the manor shell';
  root.position.copy(origin);
  const world = createHouseScene(root, mobile);
  scene.add(root);
  world.doors.get('front')!.visible = false;
  const exteriorDoor = manor.userData.door as THREE.Group;
  scene.updateMatrixWorld(true);
  scene.attach(exteriorDoor);
  const indoor = createHouseWalker();
  const travelDirection = createTravelDirection();
  let phase:
    | 'outside'
    | 'approach'
    | 'opening'
    | 'crossing'
    | 'inside'
    | 'leaving' = 'outside';
  let doorProgress = 0,
    elapsed = 0,
    distance = 0,
    lastStatus = '',
    blocked = 0;
  let route: HousePoint[] = [];
  let exitAfterRoute = false,
    arrivalDoor: string | null = null,
    routeBlocked = 0;
  const velocity = new THREE.Vector3();
  const handleTarget = new THREE.Vector3();
  let reachDoor: string | null = null;
  let reachTime = 0;
  let leaveStage: 'opening' | 'crossing' = 'opening';
  function openFrontDoor(dt: number) {
    const next = Math.min(1, doorProgress + dt / 1.3);
    const steps = Math.max(1, Math.ceil((next - doorProgress) / 0.02));
    const initial = doorProgress;
    for (let sample = 1; sample <= steps; sample++) {
      const progress = initial + ((next - initial) * sample) / steps;
      const { a, b } = doorSegment(indoor.doors[0], progress);
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const occupied = [walker.position, ...followers()].some((point) => {
        if (point.y + 1.82 < origin.y || point.y > origin.y + MANOR_DOOR.height)
          return false;
        const x = point.x - origin.x - a.x,
          z = point.z - origin.z - a.z;
        const along = THREE.MathUtils.clamp(
          (x * dx + z * dz) / (dx * dx + dz * dz),
          0,
          1,
        );
        return (
          Math.hypot(x - dx * along, z - dz * along) <
          HOUSE_RADIUS + 0.16
        );
      });
      if (occupied) break;
      doorProgress = progress;
    }
  }
  function frontDoorCanClose(next: number) {
    const steps = Math.max(1, Math.ceil(Math.abs(next - doorProgress) / 0.02));
    const initial = doorProgress;
    for (let sample = 1; sample <= steps; sample++) {
      const progress = initial + ((next - initial) * sample) / steps;
      const { a, b } = doorSegment(indoor.doors[0], progress);
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (
        [walker.position, ...followers()].some((point) => {
          if (
            point.y + 1.82 < origin.y ||
            point.y > origin.y + MANOR_DOOR.height
          )
            return false;
          const x = point.x - origin.x - a.x;
          const z = point.z - origin.z - a.z;
          const along = THREE.MathUtils.clamp(
            (x * dx + z * dz) / (dx * dx + dz * dz),
            0,
            1,
          );
          return Math.hypot(x - dx * along, z - dz * along) < HOUSE_RADIUS + 0.16;
        })
      )
        return false;
    }
    return true;
  }
  function openRoomDoor(id: string) {
    const door = indoor.doors.find((entry) => entry.id === id);
    if (!door || door.target) return;
    indoor.open(id);
    door.hold = 0.35;
    reachDoor = id;
    reachTime = 0;
    creak();
  }
  const walkSpeed = 1.45;
  let hallSettings = { ...DEFAULT_HALL_SETTINGS };
  const markerGeometry = new THREE.RingGeometry(0.16, 0.23, 32);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: 0xe6d7a1,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.name = 'Indoor walk destination';
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  root.add(marker);
  let viewDistance = 2.65,
    smoothedConstrainDist: number | null = null;
  const target = new THREE.Vector3(),
    old = new THREE.Vector3(),
    change = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const collisions: THREE.Object3D[] = [];
  root.traverse((object) => {
    let parent: THREE.Object3D | null = object;
    while (parent) {
      if (parent === world.doors.get('front')) return;
      parent = parent.parent;
    }
    if (
      object instanceof THREE.Mesh &&
      object.material instanceof THREE.MeshStandardMaterial
    )
      collisions.push(object);
  });
  exteriorDoor.traverse((object) => {
    if (object instanceof THREE.Mesh) collisions.push(object);
  });
  const cameraObstacles = [...collisions];
  manor.traverse((object) => {
    if (object instanceof THREE.Mesh) cameraObstacles.push(object);
  });
  const constrainCamera = createHouseCamera(cameraObstacles);
  const emit = () => {
    if (phase === 'outside') {
      if (lastStatus) report(null);
      lastStatus = '';
      return;
    }
    const room = indoor.room();
    const nearby = indoor.nearestDoor();
    const status = {
      inside: phase === 'inside',
      room:
        phase === 'inside'
          ? (room?.name ?? 'The entrance hall')
          : 'The manor doorway',
      detail:
        phase === 'approach'
          ? 'Walking up to the front door.'
          : phase === 'opening'
            ? 'Opening the door.'
            : phase === 'crossing'
              ? 'Walking through the doorway.'
              : phase === 'leaving'
                ? 'Walking back outside.'
                : (room?.detail ??
                  'Meet the hologram in the center. The right door opens the Skills Room; the west staircase leads to the Projects Room. Tap the floor or a stair tread to walk there.'),
      door: phase === 'inside' ? (nearby?.name ?? null) : null,
      open: !!nearby?.target,
      travelling: phase !== 'inside' || route.length > 0,
      masterHall: phase === 'inside' && room?.id === 'master-hall',
      skillsRoom:
        phase === 'inside' &&
        ['dining', 'west-gallery', 'seance'].includes(room?.id ?? ''),
    };
    const key = JSON.stringify(status);
    if (key !== lastStatus) {
      lastStatus = key;
      report(status);
    }
  };
  function startLeaving() {
    phase = 'leaving';
    leaveStage = 'opening';
    elapsed = 0;
    route = [];
    creak();
  }
  function returnToDoor() {
    if (phase !== 'inside') return;
    const projectsDoor = indoor.doors.find(
      (door) => door.id === 'master-hall',
    );
    if (projectsDoor) {
      if (!projectsDoor.target) indoor.open(projectsDoor.id);
      projectsDoor.hold = Math.max(projectsDoor.hold, 1);
    }
    route =
      houseRoute(
        indoor.position,
        { x: 0, z: -(MANOR_DOOR.width + HOUSE_RADIUS + 0.25) },
        (point) => indoor.canStand(point, true),
      ) ?? [];
    exitAfterRoute = route.length > 0;
    arrivalDoor = null;
    marker.visible = false;
    routeBlocked = 0;
    emit();
  }
  function stop() {
    velocity.set(0, 0, 0);
    route = [];
    exitAfterRoute = false;
    arrivalDoor = null;
    marker.visible = false;
    routeBlocked = 0;
    travelDirection(0, 0, camera.position, walker.position);
    emit();
  }
  function walkTo(point: HousePoint) {
    if (phase !== 'inside') return false;
    const candidates = [point];
    // A click on an edge can choose the adjacent safe floor, never another level.
    for (const radius of [0.2, 0.4, 0.6, 0.85, 1.2, 1.6])
      for (let i = 0; i < 8; i++)
        candidates.push({
          x: point.x + Math.cos((i * Math.PI) / 4) * radius,
          z: point.z + Math.sin((i * Math.PI) / 4) * radius,
          y: point.y,
        });
    const goal = candidates.find((candidate) =>
      indoor.canStand(candidate, true),
    );
    if (!goal) return false;
    const planned = houseRoute(indoor.position, goal, (candidate) =>
      indoor.canStand(candidate, true),
    );
    if (!planned?.length) return false;
    route = planned;
    exitAfterRoute = false;
    arrivalDoor = null;
    routeBlocked = 0;
    marker.position.set(goal.x, (goal.y ?? 0) + 0.025, goal.z);
    marker.visible = true;
    emit();
    return true;
  }
  function passageHeight(x: number, z: number) {
    const outside = z - origin.z;
    if (outside <= 0) return origin.y;
    if (outside >= 0.96) return walkingHeight(x, z);
    return THREE.MathUtils.lerp(
      origin.y,
      walkingHeight(x, origin.z + 0.96),
      outside / 0.96,
    );
  }

  function animateAvatar(
    dt: number,
    reduced: boolean,
    previous: THREE.Vector3,
  ) {
    change.copy(walker.position).sub(previous);
    const travelled = Math.hypot(change.x, change.z);
    distance += travelled;
    const visualY = player.root.position.y;
    player.root.position.copy(walker.position);
    if (phase === 'inside') {
      player.root.position.y = THREE.MathUtils.damp(
        visualY,
        walker.position.y,
        22,
        dt,
      );
      change.y = player.root.position.y - visualY;
    }
    if (travelled > 0.00001 && phase !== 'opening') {
      const heading = Math.atan2(-change.x, -change.z);
      const turn = Math.atan2(
        Math.sin(heading - player.root.rotation.y),
        Math.cos(heading - player.root.rotation.y),
      );
      player.root.rotation.y += turn * (1 - Math.exp(-dt * 12));
    }
    player.root.rotation.x = player.root.rotation.z = 0;
    player.update(distance, travelled > 0.00001, dt, reduced, false, (x, z) =>
      phase === 'approach'
        ? walkingHeight(x, z)
        : phase === 'inside'
          ? origin.y +
            (houseSurface(
              { x: x - origin.x, z: z - origin.z },
              indoor.position.y,
            ) ?? indoor.position.y)
          : passageHeight(x, z),
    );
  }
  function moveTo(
    point: THREE.Vector3,
    speed: number,
    dt: number,
    exterior: boolean,
  ) {
    const direction = point.clone().sub(walker.position);
    direction.y = 0;
    const remaining = direction.length();
    if (remaining < 0.08) return true;
    direction.normalize();
    if (exterior) walker.move(direction, dt, false, 0.75);
    else {
      walker.position.addScaledVector(
        direction,
        Math.min(remaining, speed * dt),
      );
      walker.position.y = passageHeight(walker.position.x, walker.position.z);
    }
    return false;
  }
  return {
    get active() {
      return phase !== 'outside';
    },
    get inside() {
      return phase === 'inside';
    },
    get masterHall() {
      return phase === 'inside' && indoor.room()?.id === 'master-hall';
    },
    get travelling() {
      return phase !== 'inside' || route.length > 0;
    },
    get position() {
      return { ...indoor.position };
    },
    setHallSettings(settings: HallSettings) {
      hallSettings = { ...settings };
    },
    get skillsRoom() {
      return (
        phase === 'inside' &&
        ['dining', 'west-gallery', 'seance'].includes(indoor.room()?.id ?? '')
      );
    },
    unoccluded(ray: THREE.Raycaster, distance: number) {
      root.updateMatrixWorld(true);
      exteriorDoor.updateMatrixWorld(true);
      const hit = ray.intersectObjects(cameraObstacles, false)[0];
      return !hit || hit.distance >= distance - 0.04;
    },
    setProjects(projects: HallProject[]) {
      world.projectFrames.setProjects(projects);
    },
    selectProject(id: HallFrameId | null) {
      world.projectFrames.select(id);
    },
    enter() {
      if (phase !== 'outside' || !walker.nearHouse) return false;
      root.visible = true;
      phase = 'approach';
      elapsed = 0;
      blocked = 0;
      route = [];
      distance = walker.distance;
      // Keep controls.enabled = true so the player can still rotate the camera
      // while the door approach/crossing animation plays. The camera position is
      // driven by the constraint system anyway, so only rotation matters here.
      emit();
      return true;
    },
    interact() {
      if (phase !== 'inside') return;
      const door = indoor.nearestDoor();
      if (!door) return;
      if (door.id === 'front') returnToDoor();
      else {
        openRoomDoor(door.id);
      }
    },
    returnToDoor,
    stop,
    zoom(factor: number) {
      viewDistance = THREE.MathUtils.clamp(viewDistance * factor, 0.8, 4.3);
    },
    setMode: world.setMode,
    walkTo,
    point(ray: THREE.Raycaster) {
      if (phase !== 'inside') return false;
      root.updateMatrixWorld(true);
      const hit = ray.intersectObjects(collisions, false)[0];
      if (indoor.room()?.id === 'master-hall') {
        const frameHit = world.projectFrames.hit(ray);
        if (frameHit && (!hit || frameHit.distance <= hit.distance + 0.02)) {
          let object: THREE.Object3D | null = frameHit.object;
          while (object && !object.userData.projectFrame)
            object = object.parent;
          if (object) {
            stop();
            openProject(object.userData.projectFrame as HallFrameId);
            return true;
          }
        }
      }
      if (!hit) return false;
      let object: THREE.Object3D | null = hit.object;
      while (object && object !== scene) {
        const id = [...world.doors].find(([, door]) => door === object)?.[0];
        if (id || object === exteriorDoor) {
          const door = indoor.doors.find(
            (door) => door.id === (id ?? 'front'),
          )!;
          if (door.id === 'front') {
            returnToDoor();
            return true;
          }
          if (indoor.nearestDoor()?.id === door.id) {
            stop();
            openRoomDoor(door.id);
            return true;
          }
          const nearSide = Math.sign(indoor.position.x - door.x) || 1;
          if (
            !walkTo({
              x: door.x + nearSide * 0.85,
              z: door.z + door.width / 2,
              y: door.y ?? 0,
            })
          )
            return false;
          arrivalDoor = door.id;
          return true;
        }
        object = object.parent;
      }
      if (
        !hit.face ||
        hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y <
          0.65
      )
        return false;
      const point = root.worldToLocal(hit.point.clone());
      const height = houseSurface(point, point.y);
      if (height === null || Math.abs(height - point.y) > 0.22) return false;
      return walkTo({ x: point.x, z: point.z, y: height });
    },
    update(
      dt: number,
      time: number,
      forward: number,
      side: number,
      running: boolean,
      reduced: boolean,
    ) {
      if (phase === 'outside') return false;
      old.copy(walker.position);
      player.setDoorReach();
      elapsed += dt;
      if (phase === 'approach') {
        // Approach the latch and push the leaf into the foyer.
        target
          .copy(origin)
          .add(new THREE.Vector3(0.35, 0, 0.98));
        if (moveTo(target, 2, dt, true)) {
          phase = 'opening';
          elapsed = 0;
          creak();
        }
        blocked =
          old.distanceToSquared(walker.position) < 0.000001 ? blocked + dt : 0;
        if (blocked > 1.5) {
          phase = 'outside';
          controls.enabled = true;
          emit();
          return false;
        }
      } else if (phase === 'opening') {
        if (elapsed > 0.4) openFrontDoor(dt);
        player.root.rotation.y = THREE.MathUtils.damp(
          player.root.rotation.y,
          0,
          12,
          dt,
        );
        if (doorProgress === 1) {
          phase = 'crossing';
          elapsed = 0;
        }
      } else if (phase === 'crossing') {
        target.copy(origin).add(new THREE.Vector3(0, 0, -3));
        if (moveTo(target, 1.65, dt, false)) {
          phase = 'inside';
          controls.enabled = true;
          controls.minDistance = 0.8;
          controls.maxDistance = 4.3;
          smoothedConstrainDist = null;
          viewDistance = 2.65;
          indoor.position.x = walker.position.x - origin.x;
          indoor.position.z = walker.position.z - origin.z;
          indoor.position.y = 0;
          const front = indoor.doors[0];
          front.progress = 1;
          front.target = 0;
          front.crossed = true;
          front.hold = 0.5;
        }
      } else if (phase === 'leaving') {
        // Do NOT disable controls.enabled here — the player should be able to
        // rotate the camera while the exit animation plays.
        if (leaveStage === 'opening') {
          // The return route stops clear of the complete inward swing. Open
          // here, then walk straight out without approaching and backing away.
          if (elapsed > 0.2) openFrontDoor(dt);
          if (doorProgress === 1) leaveStage = 'crossing';
        } else {
          target
            .copy(origin)
            .add(
              new THREE.Vector3(
                0,
                0,
                MANOR_DOOR.hingeOffset + MANOR_DOOR.width + 0.75,
              ),
            );
          if (moveTo(target, 1.65, dt, false)) {
            phase = 'outside';
            manor.visible = true;
            walker.position.y = walkingHeight(
              walker.position.x,
              walker.position.z,
            );
            controls.enabled = true;
            controls.minDistance = 0.4;
            controls.maxDistance = 42;
            emit();
            return false;
          }
        }
      } else {
        const direction = travelDirection(
          forward,
          side,
          camera.position,
          walker.position,
          manualCamera(),
        );
        if ((forward || side) && route.length) {
          route = [];
          exitAfterRoute = false;
          arrivalDoor = null;
          marker.visible = false;
          routeBlocked = 0;
        }
        const following = route.length > 0;
        const speed = following ? walkSpeed : running ? 3.1 : walkSpeed;
        const desiredVelocity = direction.clone().multiplyScalar(speed);
        if (following) desiredVelocity.set(speed, 0, 0);
        velocity.lerp(desiredVelocity, 1 - Math.exp(-dt * 10));
        // Carry the frame's remaining distance through each waypoint. Reaching
        // a route point must not insert an idle frame or restart the gait.
        let remainingStep = velocity.length() * dt;
        while (route.length) {
          const point = route[0];
          const dx = point.x - indoor.position.x,
            dz = point.z - indoor.position.z;
          const remaining = Math.hypot(dx, dz);
          if (
            remaining < 0.001 &&
            Math.abs((point.y ?? 0) - indoor.position.y) < 0.19
          ) {
            route.shift();
            if (!route.length) {
              velocity.set(0, 0, 0);
              marker.visible = false;
              if (exitAfterRoute) startLeaving();
              else if (arrivalDoor) {
                openRoomDoor(arrivalDoor);
                arrivalDoor = null;
              }
            }
            continue;
          }
          if (remaining < 0.001) break;
          const door = indoor.nearestDoor();
          const ahead =
            door &&
            route.find(
              (next) =>
                Math.sign(indoor.position.x - door.x) !==
                Math.sign(next.x - door.x),
            );
          if (
            door &&
            door.id !== 'front' &&
            ahead &&
            !door.target &&
            Math.sign(indoor.position.x - door.x) !==
              Math.sign(ahead.x - door.x)
          ) {
            openRoomDoor(door.id);
          }
          if (door?.target && door.progress < 1) break;
          if (remainingStep <= 0.000001) break;
          const step = Math.min(remaining, remainingStep);
          const previousX = indoor.position.x,
            previousZ = indoor.position.z;
          indoor.move((dx / remaining) * step, (dz / remaining) * step);
          const moved = Math.hypot(
            indoor.position.x - previousX,
            indoor.position.z - previousZ,
          );
          remainingStep -= step;
          if (moved < 0.000001 || moved < step * 0.99) break;
        }
        if (!following && !(reachDoor && reachTime < 0.95)) {
          // Releasing the controls stops precisely, without drifting into walls.
          if (!forward && !side) velocity.set(0, 0, 0);
          indoor.move(velocity.x * dt, velocity.z * dt);
        }
        walker.position.set(
          origin.x + indoor.position.x,
          origin.y + indoor.position.y,
          origin.z + indoor.position.z,
        );
        const companions = followers().map((point) => ({
          x: point.x - origin.x,
          y: point.y - origin.y,
          z: point.z - origin.z,
        }));
        if (exitAfterRoute) {
          const projectsDoor = indoor.doors.find(
            (door) => door.id === 'master-hall',
          );
          if (projectsDoor) {
            if (!projectsDoor.target) indoor.open(projectsDoor.id);
            if (projectsDoor.progress >= 1)
              projectsDoor.hold = Math.max(projectsDoor.hold, dt + 0.1);
          }
        }
        for (const door of indoor.doors) {
          if (
            !door.target &&
            companions.some(
              (point) =>
                Math.abs(point.y - (door.y ?? 0)) < 0.45 &&
                Math.hypot(point.x - door.x, point.z - door.z) <
                  door.width + 0.7,
            )
          )
            indoor.open(door.id);
        }
        indoor.update(dt, companions);
        if (following && route.length) {
          routeBlocked =
            old.distanceToSquared(walker.position) < 1e-8
              ? routeBlocked + dt
              : 0;
          // Let an opening door finish; cancel a genuinely unreachable route.
          if (routeBlocked > 3) stop();
        }
        doorProgress = indoor.doors[0].progress;
      }
      exteriorDoor.rotation.y =
        (easeDoor(doorProgress) * MANOR_DOOR.swing * Math.PI) / 2 || 0;
      for (const door of indoor.doors)
        world.doors.get(door.id)!.rotation.y =
          (easeDoor(door.progress) * door.swing * Math.PI) / 2;
      if (
        phase === 'opening' ||
        (phase === 'leaving' && leaveStage === 'opening')
      ) {
        handleTarget.set(
          MANOR_DOOR.width - 0.3,
          1.05,
          phase === 'opening' ? 0.1 : -0.1,
        );
        exteriorDoor.localToWorld(handleTarget);
        player.setDoorReach(
          handleTarget,
          easeDoor(elapsed / 0.35) * (1 - easeDoor((elapsed - 0.6) / 0.4)),
        );
      } else if (reachDoor) {
        reachTime += dt;
        const door = indoor.doors.find((entry) => entry.id === reachDoor)!;
        const leaf = world.doors.get(reachDoor)!.children[0];
        const side =
          Math.sign(leaf.worldToLocal(walker.position.clone()).z) || 1;
        handleTarget.set(door.width - 0.3, 1.42, side * 0.14);
        leaf.localToWorld(handleTarget);
        const heading = Math.atan2(
          walker.position.x - handleTarget.x,
          walker.position.z - handleTarget.z,
        );
        const turn = Math.atan2(
          Math.sin(heading - player.root.rotation.y),
          Math.cos(heading - player.root.rotation.y),
        );
        player.root.rotation.y += turn * (1 - Math.exp(-dt * 12));
        player.setDoorReach(
          handleTarget,
          easeDoor(reachTime / 0.35) * (1 - easeDoor((reachTime - 0.6) / 0.4)),
        );
        if (reachTime >= 1) reachDoor = null;
      }
      animateAvatar(dt, reduced, old);
      if (phase === 'opening') player.root.rotation.y = 0;
      if (phase === 'leaving' && leaveStage === 'opening')
        player.root.rotation.y = Math.PI;
      if (phase === 'inside') {
        target.copy(player.root.position).add(new THREE.Vector3(0, 1.35, 0));
        camera.position.add(target.clone().sub(controls.target));
        controls.target.copy(target);
        controls.update();
        if (Math.hypot(change.x, change.z) > 0.00001 && !manualCamera())
          followBehind(camera, controls.target, player.root.rotation.y, dt);
        cameraDirection.copy(camera.position).sub(controls.target);
        const desiredDistance = viewDistance;
        cameraDirection.normalize();
        root.updateMatrixWorld(true);
        exteriorDoor.updateMatrixWorld(true);
        constrainCamera(camera, controls.target, desiredDistance);
        const rawConstrained = camera.position.distanceTo(controls.target);
        // Asymmetric smoothing: snap IN immediately when hitting geometry,
        // expand OUT slowly to kill wall-edge flicker.
        if (
          smoothedConstrainDist === null ||
          rawConstrained <= smoothedConstrainDist
        ) {
          smoothedConstrainDist = rawConstrained;
        } else {
          smoothedConstrainDist = Math.min(
            desiredDistance,
            THREE.MathUtils.damp(smoothedConstrainDist, rawConstrained, 8, dt),
          );
        }
        if (rawConstrained > 0.001) {
          cameraDirection
            .copy(camera.position)
            .sub(controls.target)
            .normalize();
          camera.position
            .copy(controls.target)
            .addScaledVector(cameraDirection, smoothedConstrainDist);
        }
        camera.lookAt(controls.target);
      } else {
        // Cinematic camera for approach, crossing, and leaving:
        // – entering: low close angle behind the player, easing in
        // – leaving: wider pull-back with higher vantage
        const entering = phase !== 'leaving';
        const offset = entering
          ? new THREE.Vector3(0.15, 1.55, 2.0)
          : new THREE.Vector3(0.4, 2.2, 3.8);
        const lerpRate = entering ? 2.8 : 3.5;
        camera.position.lerp(
          walker.position.clone().add(offset),
          1 - Math.exp(-dt * lerpRate),
        );
        controls.target
          .copy(walker.position)
          .add(new THREE.Vector3(0, 1.1, -0.2));
        camera.lookAt(controls.target);
      }
      // The hollow exterior and its furnished rooms stay in the same world.
      world.setHallSettings(hallSettings, phase === 'inside');
      world.projectFrames.update(dt, hallSettings, reduced);
      world.update(time, camera, reduced);
      emit();
      return true;
    },
    updateOutside(dt: number) {
      if (phase === 'outside') {
        const front = indoor.doors[0];
        const { a, b } = doorSegment(front, doorProgress);
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const occupied = [walker.position, ...followers()].some((point) => {
          const x = point.x - origin.x - a.x;
          const z = point.z - origin.z - a.z;
          const along = THREE.MathUtils.clamp(
            (x * dx + z * dz) / (dx * dx + dz * dz),
            0,
            1,
          );
          return (
            Math.hypot(x - dx * along, z - dz * along) <
            HOUSE_RADIUS + 0.16
          );
        });
        if (occupied) return;
        const next = Math.max(0, doorProgress - dt / 1.1);
        if (!frontDoorCanClose(next)) return;
        doorProgress = next;
        exteriorDoor.rotation.y =
          (easeDoor(doorProgress) * MANOR_DOOR.swing * Math.PI) / 2 || 0;
      }
    },
    dispose() {
      markerGeometry.dispose();
      markerMaterial.dispose();
      world.dispose();
      root.removeFromParent();
    },
  };
}
