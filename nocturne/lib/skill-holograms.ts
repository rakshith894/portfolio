import * as THREE from 'three';
import { MANOR_ORIGIN } from './reference-layout.ts';
import { MANOR_DOOR } from './manor-layout.ts';
import { skillPlacement } from './skill-placement.ts';
import { SKILL_COLORS, type GallerySkill } from './skill-gallery.ts';
import { wrapSkillText } from './skill-card-layout.ts';

export function createSkillHolograms(
  scene: THREE.Scene,
  resources: Set<{ dispose: () => void }>,
) {
  const own = <T extends { dispose: () => void }>(value: T) => {
    resources.add(value);
    return value;
  };
  const root = new THREE.Group();
  root.name = 'Permanent skills throughout the manor and backyard';
  root.position
    .copy(MANOR_ORIGIN)
    .add(new THREE.Vector3(0, MANOR_DOOR.y, MANOR_DOOR.z));
  scene.add(root);
  // Keep the writing on a flat surface; motion belongs to the card and its light.
  const panelGeometry = own(new THREE.PlaneGeometry(1.12, 1.12));
  const edgeGeometry = own(new THREE.EdgesGeometry(panelGeometry));
  const haloGeometry = own(new THREE.PlaneGeometry(1.26, 1.26));
  const haloEdges = own(new THREE.EdgesGeometry(haloGeometry));
  const createCard = (index: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const texture = own(new THREE.CanvasTexture(canvas));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const material = own(
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      }),
    );
    const mesh = new THREE.Mesh(panelGeometry, material);
    mesh.name = 'Floating skill card';
    const placement = skillPlacement(index);
    mesh.position.set(placement.x, placement.y, placement.z);
    mesh.userData.area = placement.area;
    mesh.userData.skillCard = true;
    root.add(mesh);
    const edgeMaterial = own(
      new THREE.LineBasicMaterial({
        color: 0xf0cb79,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    mesh.add(edge);
    const haloMaterial = own(
      new THREE.LineBasicMaterial({
        color: 0xf0cb79,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const halo = new THREE.LineSegments(haloEdges, haloMaterial);
    halo.position.z = -0.025;
    mesh.add(halo);
    return {
      mesh,
      canvas,
      texture,
      material,
      edgeMaterial,
      haloMaterial,
      halo,
      base: mesh.position.clone(),
      id: null as string | null,
    };
  };
  const cards: ReturnType<typeof createCard>[] = [];
  function drawCard(
    card: ReturnType<typeof createCard>,
    index: number,
    skill: GallerySkill | undefined,
  ) {
    const color = skill
      ? SKILL_COLORS[skill.color]
      : Object.values(SKILL_COLORS)[index % 6];
    card.edgeMaterial.color.set(color);
    card.haloMaterial.color.set(color);
    card.mesh.userData.skillId = card.id;
    const c = card.canvas.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, 1024, 1024);
    const surface = c.createLinearGradient(0, 0, 1024, 1024);
    surface.addColorStop(0, '#132732');
    surface.addColorStop(0.5, '#0b1822');
    surface.addColorStop(1, '#060e18');
    c.fillStyle = surface;
    c.fillRect(0, 0, 1024, 1024);
    // Light remains at the edge, clear of the text column.
    const glow = c.createRadialGradient(980, 40, 0, 980, 40, 660);
    glow.addColorStop(0, color + '42');
    glow.addColorStop(1, color + '00');
    c.fillStyle = glow;
    c.fillRect(0, 0, 1024, 1024);
    c.fillStyle = color;
    c.fillRect(76, 64, 70, 5);
    c.strokeStyle = color + '35';
    c.lineWidth = 1;
    c.strokeRect(26, 26, 972, 972);
    c.strokeStyle = color + 'bb';
    c.lineWidth = 3;
    for (const [x, y, sx, sy] of [
      [26, 26, 1, 1],
      [998, 26, -1, 1],
      [26, 998, 1, -1],
      [998, 998, -1, -1],
    ]) {
      c.beginPath();
      c.moveTo(x + sx * 28, y);
      c.lineTo(x, y);
      c.lineTo(x, y + sy * 28);
      c.stroke();
    }
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.font = '500 25px Arial, sans-serif';
    c.fillStyle = '#d7e6eb';
    c.fillText('NOCTURNE', 76, 122);
    c.font = '22px Arial, sans-serif';
    c.fillStyle = color;
    c.fillText('SKILL  /  ' + String(index + 1).padStart(2, '0'), 76, 167);
    const title =
      skill?.title ||
      ['Your next skill.', 'Make it yours.', 'Share your craft.'][index % 3];
    let titleSize = 86;
    let titleLines: ReturnType<typeof wrapSkillText>;
    do {
      c.font = '600 ' + titleSize + 'px Arial, sans-serif';
      titleLines = wrapSkillText(
        title,
        (text) => c.measureText(text).width,
        872,
        3,
      );
      if (!titleLines.truncated || titleSize <= 54) break;
      titleSize -= 4;
    } while (titleSize >= 54);
    c.fillStyle = '#f5fbff';
    titleLines.lines.forEach((line, row) =>
      c.fillText(line, 76, 325 + row * (titleSize * 1.15)),
    );
    c.fillStyle = color;
    c.fillRect(76, 585, 54, 3);
    c.font = '36px Arial, sans-serif';
    c.fillStyle = '#bdd0da';
    const description =
      skill?.description ||
      (skill
        ? 'Open this card to explore the skill.'
        : 'Add a skill and a short story about how you use it.');
    wrapSkillText(
      description,
      (text) => c.measureText(text).width,
      852,
      3,
    ).lines.forEach((line, row) => c.fillText(line, 76, 660 + row * 51));
    c.strokeStyle = '#ffffff16';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(76, 865);
    c.lineTo(948, 865);
    c.stroke();
    c.font = '500 24px Arial, sans-serif';
    c.fillStyle = '#e5f0f4';
    c.fillText(skill ? 'EXPLORE SKILL' : 'CREATE A SKILL', 76, 929);
    c.font = '40px Arial, sans-serif';
    c.fillStyle = color;
    c.fillText('↗', 905, 934);
    card.texture.needsUpdate = true;
  }
  function setSkills(skills: GallerySkill[]) {
    const required = skills.length || 3;
    while (cards.length < required) cards.push(createCard(cards.length));
    while (cards.length > required) {
      const card = cards.pop()!;
      card.mesh.removeFromParent();
      for (const resource of [
        card.texture,
        card.material,
        card.edgeMaterial,
        card.haloMaterial,
      ]) {
        resource.dispose();
        resources.delete(resource);
      }
    }
    for (const [index, card] of cards.entries()) {
      const skill = skills[index];
      card.id = skill?.id ?? null;
      drawCard(card, index, skill);
    }
  }
  setSkills([]);
  const direction = new THREE.Vector3();
  return {
    root,
    setSkills,
    hit(ray: THREE.Raycaster) {
      root.updateMatrixWorld(true);
      return (
        ray.intersectObjects(
          cards.map((card) => card.mesh),
          false,
        )[0] ?? null
      );
    },
    update(
      time: number,
      camera: THREE.Camera,
      reduced: boolean,
      dark: boolean,
    ) {
      camera.getWorldPosition(direction);
      root.worldToLocal(direction);
      for (const [index, card] of cards.entries()) {
        card.mesh.position.copy(card.base);
        card.mesh.position.y += reduced
          ? 0
          : Math.sin(time * 0.65 + index * 1.4) * 0.045;
        card.mesh.rotation.y = Math.atan2(
          direction.x - card.mesh.position.x,
          direction.z - card.mesh.position.z,
        );
        card.mesh.rotation.z = reduced
          ? 0
          : Math.sin(time * 0.25 + index) * 0.008;
        card.edgeMaterial.opacity = reduced
          ? 0.5
          : 0.5 + Math.sin(time * 1.15 + index) * 0.12;
        card.haloMaterial.opacity = reduced
          ? 0.1
          : 0.1 + Math.sin(time * 1.15 + index + 1) * 0.045;
        card.halo.scale.setScalar(
          reduced ? 1 : 1 + Math.sin(time * 0.6 + index) * 0.008,
        );
        card.material.opacity = dark ? 0.98 : 1;
      }
    },
    dispose() {
      root.removeFromParent();
    },
  };
}
