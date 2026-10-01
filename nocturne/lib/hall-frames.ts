import * as THREE from 'three';
import {
  HALL_FRAMES,
  type HallFrameId,
  type HallProject,
} from './hall-projects.ts';
import type { HallSettings } from './master-hall.ts';
import { drawHallProjectCover } from './hall-project-cover.ts';

/** Matching exhibition cases with recessed light, without protruding fixtures. */
export function createHallFrames(scene: THREE.Scene) {
  let disposed = false;
  const resources = new Set<{ dispose: () => void }>();
  const own = <T extends { dispose: () => void }>(value: T) => {
    resources.add(value);
    return value;
  };
  const box = own(new THREE.BoxGeometry(1, 1, 1));
  const metal = own(
    new THREE.MeshStandardMaterial({
      color: 0xb5a078,
      roughness: 0.42,
      metalness: 0.65,
    }),
  );
  const walnut = own(
    new THREE.MeshStandardMaterial({ color: 0x251e1a, roughness: 0.58 }),
  );
  const backing = own(
    new THREE.MeshStandardMaterial({ color: 0x121c23, roughness: 0.75 }),
  );
  // A shared soft rectangular falloff gives a restrained wall wash without ten spotlights.
  const pixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const edge = Math.max(
        Math.abs(x - 63.5) / 63.5,
        Math.abs(y - 63.5) / 63.5,
      );
      const offset = (y * 128 + x) * 4;
      pixels[offset] = 255;
      pixels[offset + 1] = 211;
      pixels[offset + 2] = 150;
      pixels[offset + 3] = Math.round(
        100 * Math.exp(-(((edge - 0.78) / 0.12) ** 2)),
      );
    }
  const haloTexture = own(new THREE.DataTexture(pixels, 128, 128));
  haloTexture.colorSpace = THREE.SRGBColorSpace;
  haloTexture.magFilter = THREE.LinearFilter;
  haloTexture.minFilter = THREE.LinearFilter;
  haloTexture.needsUpdate = true;
  const roots: THREE.Group[] = [];
  const frames = HALL_FRAMES.map((definition, index) => {
    const root = new THREE.Group();
    root.name = `Project glass frame ${index + 1}`;
    root.userData.projectFrame = definition.id;
    root.position.set(definition.x, definition.y, definition.z);
    root.rotation.y = definition.rotation;
    root.visible = false;
    scene.add(root);
    roots.push(root);
    const w = definition.width,
      h = 1.7;
    const part = (
      parent: THREE.Object3D,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      width: number,
      height: number,
      depth: number,
    ) => {
      const mesh = new THREE.Mesh(box, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(width, height, depth);
      parent.add(mesh);
      return mesh;
    };
    const haloMaterial = own(
      new THREE.MeshBasicMaterial({
        map: haloTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    const halo = new THREE.Mesh(
      own(new THREE.PlaneGeometry(w + 0.5, h + 0.45)),
      haloMaterial,
    );
    halo.name = 'Concealed frame glow';
    halo.position.z = 0.018;
    halo.raycast = () => {};
    root.add(halo);
    part(root, walnut, 0, 0, 0.005, w + 0.14, h + 0.14, 0.09);
    part(root, backing, 0, 0, 0.043, w - 0.06, h - 0.06, 0.015);
    const pivot = new THREE.Group();
    pivot.name = 'Project glass hinge';
    pivot.position.x = -w / 2;
    root.add(pivot);
    const glass = own(
      new THREE.MeshPhysicalMaterial({
        color: 0xd2e5e7,
        transparent: true,
        opacity: 0.075,
        roughness: 0.13,
        metalness: 0.15,
        clearcoat: 1,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    part(pivot, glass, w / 2, 0, 0.085, w, h, 0.028);
    for (const sign of [-1, 1]) {
      part(
        pivot,
        walnut,
        w / 2 + (sign * w) / 2,
        0,
        0.08,
        0.075,
        h + 0.09,
        0.09,
      );
      part(pivot, walnut, w / 2, (sign * h) / 2, 0.08, w + 0.055, 0.075, 0.09);
      part(
        pivot,
        metal,
        w / 2 + sign * (w / 2 - 0.03),
        0,
        0.129,
        0.013,
        h - 0.025,
        0.008,
      );
      part(
        pivot,
        metal,
        w / 2,
        sign * (h / 2 - 0.03),
        0.129,
        w - 0.05,
        0.013,
        0.008,
      );
    }
    part(pivot, metal, w - 0.07, -0.1, 0.145, 0.025, 0.16, 0.03);
    // Match each physical opening so text retains its proportions on both wall sizes.
    const canvas = document.createElement('canvas');
    canvas.height = 768;
    canvas.width = Math.round((canvas.height * (w - 0.18)) / (h - 0.16));
    const texture = own(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const labelMaterial = own(
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        toneMapped: false,
      }),
    );
    const label = new THREE.Mesh(
      own(new THREE.PlaneGeometry(w - 0.18, h - 0.16)),
      labelMaterial,
    );
    label.name = 'Project exhibition cover';
    label.position.z = 0.054;
    root.add(label);
    const glow = own(
      new THREE.MeshBasicMaterial({
        color: 0xc1a476,
        transparent: true,
        opacity: 0,
        toneMapped: false,
      }),
    );
    const inset = part(
      root,
      glow,
      0,
      h / 2 - 0.075,
      0.057,
      w - 0.24,
      0.008,
      0.008,
    );
    inset.name = 'Recessed picture light';
    drawHallProjectCover(canvas, undefined, index);
    return {
      id: definition.id as HallFrameId | null,
      index,
      root,
      pivot,
      canvas,
      texture,
      haloMaterial,
      glow,
      coverKey: '',
      selected: false,
    };
  });
  return {
    roots,
    setProjects(projects: HallProject[]) {
      for (const frame of frames) {
        const project = projects[frame.index];
        frame.root.visible = !!project;
        frame.id = project?.id ?? null;
        if (!project) frame.selected = false;
        frame.root.userData.projectFrame = frame.id;
        const coverKey = JSON.stringify(project ?? null);
        if (coverKey === frame.coverKey) continue;
        frame.coverKey = coverKey;
        drawHallProjectCover(
          frame.canvas,
          project,
          project ? Number(project.id.slice(6)) - 1 : frame.index,
        );
        frame.texture.needsUpdate = true;
        if (project?.cover) {
          const image = new Image();
          image.onload = () => {
            if (disposed || frame.coverKey !== coverKey) return;
            drawHallProjectCover(
              frame.canvas,
              project,
              Number(project.id.slice(6)) - 1,
              image,
            );
            frame.texture.needsUpdate = true;
          };
          image.src = project.cover;
        }
      }
    },
    select(id: HallFrameId | null) {
      for (const frame of frames)
        frame.selected = id !== null && frame.id === id;
    },
    hit(ray: THREE.Raycaster) {
      return (
        ray.intersectObjects(
          roots.filter((root) => root.visible),
          true,
        )[0] ?? null
      );
    },
    update(dt: number, settings: HallSettings, reduced: boolean) {
      for (const frame of frames) {
        frame.pivot.rotation.y = THREE.MathUtils.damp(
          frame.pivot.rotation.y,
          frame.selected ? -1.05 : 0,
          reduced ? 30 : 7,
          dt,
        );
        const strength = settings.lights
          ? settings.mode === 'dark'
            ? 0.55
            : 0.12
          : 0;
        frame.haloMaterial.opacity = THREE.MathUtils.damp(
          frame.haloMaterial.opacity,
          strength,
          reduced ? 30 : 7,
          dt,
        );
        frame.glow.opacity = frame.haloMaterial.opacity * 0.65;
      }
    },
    dispose() {
      disposed = true;
      resources.forEach((resource) => resource.dispose());
      roots.forEach((root) => root.removeFromParent());
    },
  };
}
