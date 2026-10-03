import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFootPlacement, locomotionPace } from './human-locomotion.ts';
import { createRowingHands } from './island-rowing.ts';

/** A clothed, articulated player with feet at the root and a forward axis of -Z. */
export function createIslandAvatar(
  resources: Set<{ dispose: () => void }>,
  mobile: boolean,
  requireHuman = false,
) {
  const own = <T extends { dispose: () => void }>(value: T) => {
    resources.add(value);
    return value;
  };
  const material = (color: number, roughness = 0.8) =>
    own(new THREE.MeshStandardMaterial({ color, roughness }));
  const coat = material(0x263a42),
    coatEdge = material(0x51666b),
    shirt = material(0xb9c0bc),
    trousers = material(0x19222c),
    belt = material(0x4a3326, 0.65);
  const skin = material(0xb88f73, 0.92),
    skinShadow = material(0x8f634e, 0.95),
    hair = material(0x171719, 0.72),
    eyes = material(0x101619, 0.35),
    shoes = material(0x111519, 0.55);
  const sphere = own(new THREE.SphereGeometry(1, 16, 12));
  const capsule = own(new THREE.CapsuleGeometry(1, 1, 4, 10));
  const box = own(new THREE.BoxGeometry(1, 1, 1));
  const root = new THREE.Group();
  // Keep the local articulated avatar usable while the detailed model streams.
  root.visible = !requireHuman;
  let finishLoading!: () => void;
  let appearanceChosen = false;
  let loadTimeout: ReturnType<typeof setTimeout> | undefined;
  const ready = new Promise<void>((resolve) => {
    finishLoading = () => {
      appearanceChosen = true;
      clearTimeout(loadTimeout);
      resolve();
    };
  });
  root.name = 'Rakshith — player';
  const body = new THREE.Group();
  root.add(body);
  function mesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    const part = new THREE.Mesh(geometry, mat);
    part.position.set(x, y, z);
    part.scale.set(sx, sy, sz);
    part.castShadow = !mobile;
    part.receiveShadow = true;
    parent.add(part);
    return part;
  }
  // A layered, anatomically proportioned silhouette reads as a person at a
  // distance: head, neck, torso, pelvis, articulated limbs, hands, and boots.
  mesh(body, capsule, coat, 0, 1.19, 0, 0.3, 0.245, 0.18);
  mesh(body, capsule, shirt, 0, 1.35, -0.18, 0.135, 0.165, 0.035);
  mesh(body, box, coatEdge, -0.105, 1.34, -0.18, 0.018, 0.36, 0.025);
  mesh(body, box, coatEdge, 0.105, 1.34, -0.18, 0.018, 0.36, 0.025);
  mesh(body, box, belt, 0, 0.99, -0.015, 0.25, 0.035, 0.18);
  mesh(body, capsule, skin, 0, 1.59, 0, 0.075, 0.09, 0.075);
  mesh(body, capsule, skin, 0, 1.72, -0.015, 0.18, 0.215, 0.16);
  mesh(body, sphere, skinShadow, 0, 1.67, 0.125, 0.09, 0.08, 0.045);
  mesh(body, sphere, hair, 0, 1.85, 0.017, 0.19, 0.125, 0.17);
  mesh(body, sphere, hair, 0, 1.75, 0.13, 0.17, 0.12, 0.06);
  mesh(body, sphere, skin, 0, 1.695, -0.16, 0.04, 0.047, 0.04);
  for (const side of [-1, 1]) {
    mesh(body, sphere, skin, side * 0.18, 1.72, 0, 0.035, 0.06, 0.04);
    mesh(body, sphere, eyes, side * 0.068, 1.755, -0.155, 0.014, 0.014, 0.01);
  }
  for (const side of [-1, 1]) {
    mesh(body, capsule, hair, side * 0.16, 1.74, 0.015, 0.035, 0.12, 0.08);
  }
  const legs: { hip: THREE.Group; knee: THREE.Group }[] = [];
  const arms: { shoulder: THREE.Group; elbow: THREE.Group }[] = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.145, 0.91, 0);
    body.add(hip);
    mesh(hip, capsule, trousers, 0, -0.18, 0, 0.105, 0.15, 0.115);
    const knee = new THREE.Group();
    knee.position.y = -0.39;
    hip.add(knee);
    mesh(knee, capsule, trousers, 0, -0.2, 0, 0.086, 0.15, 0.09);
    mesh(knee, box, shoes, 0, -0.47, -0.09, 0.19, 0.14, 0.34);
    legs.push({ hip, knee });
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.305, 1.42, 0);
    body.add(shoulder);
    shoulder.rotation.z = side * 0.1;
    mesh(shoulder, capsule, coat, 0, -0.16, 0, 0.09, 0.12, 0.095);
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    shoulder.add(elbow);
    mesh(elbow, capsule, coat, 0, -0.14, 0, 0.072, 0.1, 0.075);
    mesh(elbow, capsule, skin, 0, -0.3, 0, 0.067, 0.095, 0.064);
    arms.push({ shoulder, elbow });
  }
  // Soft contact shadow remains visible when dynamic shadows are disabled on phones.
  const shadow = new THREE.Mesh(
    own(new THREE.CircleGeometry(0.4, 24)),
    own(
      new THREE.MeshBasicMaterial({
        color: 0x070a0c,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      }),
    ),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.007;
  root.add(shadow);
  const mixer = new THREE.AnimationMixer(root);
  let disposed = false;
  const releaseModel = (model: THREE.Object3D) => {
    const owned = new Set<{ dispose: () => void }>();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      owned.add(object.geometry);
      for (const material of Array.isArray(object.material)
        ? object.material
        : [object.material]) {
        owned.add(material);
        for (const value of Object.values(material))
          if (value instanceof THREE.Texture) owned.add(value);
      }
      if (object instanceof THREE.SkinnedMesh) owned.add(object.skeleton);
    });
    owned.forEach((item) => item.dispose());
  };
  resources.add({
    dispose: () => {
      disposed = true;
      finishLoading();
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    },
  });
  let modelReady = false;
  let modelChanged = false;
  let idleAction: THREE.AnimationAction | null = null;
  let walkAction: THREE.AnimationAction | null = null;
  let runAction: THREE.AnimationAction | null = null;
  let placeFeet: ReturnType<typeof createFootPlacement> | null = null;
  let rowingHands: ReturnType<typeof createRowingHands> | null = null;
  let rowingTargets: { left: THREE.Vector3; right: THREE.Vector3 } | null =
    null;
  let waveAction: THREE.AnimationAction | null = null;
  let sitAction: THREE.AnimationAction | null = null;
  let activeAction: THREE.AnimationAction | null = null;
  let importedModel: THREE.Object3D | null = null;
  let importedModelBaseY = 0;
  let captureScale = 1;
  let runningGait = false;
  let lastReduced = false; // tracked so doorGesture() can respect reduce-motion
  const modelLoader = new GLTFLoader();
  if (typeof window !== 'undefined') {
    // Choose the fallback once on a stalled connection; never swap mid-walk.
    loadTimeout = setTimeout(finishLoading, requireHuman ? 45000 : 12000);
    modelLoader.load(
      '/models/human-traveller.glb',
      (gltf) => {
        const model = gltf.scene;
        if (disposed || appearanceChosen) {
          releaseModel(model);
          return;
        }
        importedModel = model;
        model.name = 'Human traveller';
        // Rocketbox faces +Z; the island walker faces -Z.
        model.rotation.y = Math.PI;
        model.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = !mobile;
            object.receiveShadow = true;
            for (const material of Array.isArray(object.material)
              ? object.material
              : [object.material]) {
              if (material instanceof THREE.MeshStandardMaterial) {
                material.metalness = 0;
                if (material.map) material.map.anisotropy = mobile ? 2 : 4;
              }
            }
          }
        });
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const height = Math.max(size.y, 0.001);
        model.scale.setScalar(1.82 / height);
        captureScale = model.scale.x * 100;
        const correctedBounds = new THREE.Box3().setFromObject(model);
        model.position.y -= correctedBounds.min.y;
        importedModelBaseY = model.position.y;
        root.add(model);
        resources.add({
          dispose: () => {
            releaseModel(model);
          },
        });
        body.visible = false;
        shadow.visible = mobile;
        const actions = gltf.animations.map((clip) => mixer.clipAction(clip));
        idleAction =
          actions.find((action) =>
            /idle|stand|breath/i.test(action.getClip().name),
          ) ??
          actions[0] ??
          null;
        walkAction =
          actions.find((action) => /^walk$/i.test(action.getClip().name)) ??
          actions[1] ??
          idleAction;
        waveAction =
          actions.find((action) => action.getClip().name === 'Wave') ?? null;
        sitAction =
          actions.find((action) => action.getClip().name === 'Sit') ?? null;
        runAction =
          actions.find((action) => action.getClip().name === 'Run') ??
          walkAction;
        placeFeet = createFootPlacement(model);
        rowingHands = createRowingHands(model);
        activeAction = idleAction;
        activeAction?.reset().play();
        mixer.update(0);
        modelReady = true;
        modelChanged = true;
        root.visible = true;
        finishLoading();
      },
      undefined,
      () => {
        if (disposed) return;
        modelReady = false;
        root.visible = !requireHuman;
        finishLoading();
      },
    );
  } else finishLoading();
  let blend = 0;
  let gait = 0;
  let previousMoving = false;
  let previousDistance = 0;
  let gesture: 'jump' | 'sit' | 'dance' | 'wave' | null = null;
  let gestureTime = 0;
  let seated = false;
  let poseTransition = 0;
  function perform(action: 'jump' | 'sit' | 'dance' | 'wave') {
    gesture = action;
    gestureTime =
      action === 'dance'
        ? 4
        : action === 'wave' && waveAction
          ? waveAction.getClip().duration
          : 1.8;
  }
  function update(
    distance: number,
    moving: boolean,
    dt: number,
    reducedMotion: boolean,
    automatic = false,
    ground?: (x: number, z: number) => number,
  ) {
    rowingHands?.restore();
    const changed = modelChanged;
    modelChanged = false;
    lastReduced = reducedMotion;
    const speed =
      dt > 0 && moving ? Math.max(0, distance - previousDistance) / dt : 0;
    previousDistance = distance;
    const pace = locomotionPace(speed, captureScale, runningGait);
    runningGait = pace.running;
    if (reducedMotion) {
      gesture = null;
      gestureTime = 0;
    }
    if (gestureTime > 0) gestureTime -= dt;
    else gesture = null;
    blend = THREE.MathUtils.damp(blend, moving ? 1 : 0, moving ? 10 : 7, dt);
    if (moving && !previousMoving) gait = 0;
    previousMoving = moving;
    const gaitRate = moving ? (automatic ? 11.4 : 9.2) : 2.6;
    gait += dt * gaitRate;
    const weightShift = Math.sin(gait * 0.5);
    if (gesture === 'jump') {
      body.position.y =
        Math.sin(Math.PI * (1 - Math.max(0, gestureTime) / 1.8)) * 0.45;
    } else if (gesture === 'sit') {
      body.position.y = -0.18;
      body.rotation.x = -0.18;
    } else if (gesture === 'dance') {
      body.position.y = Math.abs(Math.sin(gait * 1.7)) * 0.09;
      body.rotation.y = Math.sin(gait * 1.7) * 0.35;
    } else if (gesture === 'wave') {
      arms.forEach(({ shoulder, elbow }, index) => {
        if (index === 0) {
          shoulder.rotation.z = -0.7;
          elbow.rotation.x = Math.sin(gait * 3) * 0.45;
        }
      });
    }
    if (modelReady) {
      // Locomotion communicates player movement, including in reduced-motion mode.
      // Freezing the skeleton while the controller travels makes the player slide.
      const nextAction =
        gesture === 'wave' && waveAction
          ? waveAction
          : (seated || gesture === 'sit') && sitAction
            ? sitAction
            : moving
              ? pace.running
                ? runAction
                : walkAction
              : idleAction;
      if (nextAction && nextAction !== activeAction) {
        poseTransition = 0.3;
        const phase =
          activeAction &&
          (activeAction === walkAction || activeAction === runAction)
            ? (activeAction.time / activeAction.getClip().duration) % 1
            : 0;
        activeAction?.fadeOut(0.28);
        nextAction
          .reset()
          .setEffectiveTimeScale(
            nextAction === walkAction || nextAction === runAction
              ? pace.timeScale
              : 1,
          )
          .fadeIn(automatic ? 0.2 : 0.28)
          .play();
        if (nextAction === walkAction || nextAction === runAction)
          nextAction.time = phase * nextAction.getClip().duration;
        activeAction = nextAction;
      }
      walkAction?.setEffectiveTimeScale(pace.timeScale);
      runAction?.setEffectiveTimeScale(pace.timeScale);
      const animate =
        poseTransition > 0 ||
        seated ||
        !reducedMotion ||
        moving ||
        blend > 0.001;
      poseTransition = Math.max(0, poseTransition - dt);
      if (animate) mixer.update(dt);
      if (importedModel) {
        importedModel.position.y = importedModelBaseY;
        if (gesture === 'jump')
          importedModel.position.y +=
            Math.sin(Math.PI * (1 - Math.max(0, gestureTime) / 1.8)) * 0.45;
        importedModel.rotation.y =
          Math.PI + (gesture === 'dance' ? Math.sin(gait * 1.7) * 0.35 : 0);
        importedModel.rotation.z =
          gesture === 'dance' ? Math.sin(gait * 1.7) * 0.16 : 0;
        // Captured pelvis, spine and shoulder motion already supplies weight transfer.
        importedModel.rotation.x = 0;
      }
      if (ground && !seated && !gesture && animate) placeFeet?.(ground);
      if (seated && rowingTargets)
        rowingHands?.apply(rowingTargets.left, rowingTargets.right);
      return changed || animate;
    }
    const phase = distance * (automatic ? 8.8 : 7.2);
    const stride = blend * (automatic ? 1.08 : 1);
    legs.forEach(({ hip, knee }, index) => {
      const swing = Math.sin(phase + index * Math.PI);
      hip.rotation.x = seated ? -Math.PI / 2 : swing * 0.48 * stride;
      knee.rotation.x = seated
        ? Math.PI / 2
        : Math.max(0, -swing) * 0.78 * stride;
    });
    arms.forEach(({ shoulder, elbow }, index) => {
      shoulder.rotation.z =
        gesture === 'wave' && index === 0 ? -0.7 : index === 0 ? -0.1 : 0.1;
      shoulder.rotation.x = -Math.sin(phase + index * Math.PI) * 0.3 * stride;
      elbow.rotation.x =
        -0.1 - Math.max(0, Math.sin(phase + index * Math.PI)) * 0.14 * stride;
    });
    body.rotation.x = gesture === 'sit' ? -0.18 : moving ? -0.045 * stride : 0;
    body.rotation.z = moving ? weightShift * 0.028 * stride : 0;
    body.rotation.y = gesture === 'dance' ? Math.sin(gait * 1.7) * 0.35 : 0;
    body.position.y = gesture
      ? body.position.y
      : reducedMotion
        ? 0
        : Math.abs(Math.sin(phase)) * 0.035 * stride;
    return blend > 0.001 || gesture !== null;
  }
  return {
    root,
    ready,
    get hasHuman() {
      return modelReady;
    },
    update,
    perform,
    /**
     * Drive the right arm into a door interaction pose.
     * Works on both the procedural rig and the loaded GLTF model.
     *
     * IMPORTANT: AnimationMixer sets bone.quaternion directly (not bone.rotation).
     * We use quaternion.premultiply() so the gesture additively composites
     * on top of whatever the idle/walk clip set — euler += would be silently lost.
     *
     * @param mode 'push' = reaching forward to push/open, 'pull' = reaching back to close
     * @param t    0→1 blend weight for the pose
     */
    doorGesture(mode: 'push' | 'pull' | 'none', t: number) {
      if (t <= 0 || lastReduced || mode === 'none') return;
      const peak = Math.sin(t * Math.PI); // 0→1→0 arc over the gesture

      if (importedModel) {
        // ── GLTF model: Rocketbox Biped bone names ─────────────────────────
        const upperArm = importedModel.getObjectByName('Bip01_R_UpperArm');
        const foreArm  = importedModel.getObjectByName('Bip01_R_Forearm');
        if (!upperArm || !foreArm) return;

        // Build delta quaternions and premultiply onto the mixer-set quaternion
        const delta = new THREE.Quaternion();
        if (mode === 'push') {
          // Raise arm forward (pitch forward ~70° at peak, plus slight Z inward)
          delta.setFromEuler(new THREE.Euler(-peak * 1.25 * t, 0, -0.18 * t, 'XYZ'));
          upperArm.quaternion.premultiply(delta);
          delta.setFromEuler(new THREE.Euler(-peak * 0.55 * t, 0, 0, 'XYZ'));
          foreArm.quaternion.premultiply(delta);
        } else {
          // Reach arm backward (pitch back ~50°) to push door closed
          delta.setFromEuler(new THREE.Euler(peak * 0.95 * t, 0, 0.22 * t, 'XYZ'));
          upperArm.quaternion.premultiply(delta);
          delta.setFromEuler(new THREE.Euler(peak * 0.38 * t, 0, 0, 'XYZ'));
          foreArm.quaternion.premultiply(delta);
        }
      } else {
        // ── Procedural rig: arms array (body is visible, no mixer) ─────────
        const arm = arms[1]; // right arm (side === 1, built with side===1 loop)
        if (!arm) return;
        if (mode === 'push') {
          arm.shoulder.rotation.x += -peak * 1.05 * t;
          arm.shoulder.rotation.z  = THREE.MathUtils.lerp(arm.shoulder.rotation.z, 0.06, t);
          arm.elbow.rotation.x    += -peak * 0.48 * t;
        } else {
          arm.shoulder.rotation.x += peak * 0.85 * t;
          arm.shoulder.rotation.z  = THREE.MathUtils.lerp(arm.shoulder.rotation.z, 0.16, t);
          arm.elbow.rotation.x    += peak * 0.36 * t;
        }
      }
    },
    setRowingTargets(left?: THREE.Vector3, right?: THREE.Vector3) {
      rowingTargets = left && right ? { left, right } : null;
    },
    setSeated(value: boolean) {
      seated = value;
      if (!value) rowingTargets = null;
      shadow.visible = !value && mobile;
    },
  };
}
