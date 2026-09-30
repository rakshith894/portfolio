import * as THREE from 'three';
import { MANOR_ORIGIN } from './reference-layout.ts';
import { MANOR_DOOR } from './manor-layout.ts';
import { HOUSE_ROOMS } from './house-layout.ts';
import { SKILL_COLORS, SKILLS_PER_PAGE, type GallerySkill } from './skill-gallery.ts';

export function createSkillHolograms(scene: THREE.Scene, resources: Set<{ dispose: () => void }>) {
  const own = <T extends { dispose: () => void }>(value: T) => { resources.add(value); return value; };
  const room = HOUSE_ROOMS[0], root = new THREE.Group(); root.name = 'Floating skills in the west room';
  root.position.copy(MANOR_ORIGIN).add(new THREE.Vector3(room.x, MANOR_DOOR.y, MANOR_DOOR.z + room.z)); scene.add(root);
  const paperGeometry = own(new THREE.PlaneGeometry(1.05, 1.05, 12, 12));
  const cards = Array.from({ length: SKILLS_PER_PAGE }, (_, index) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 640;
    const texture = own(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
    const material = own(new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    const time = { value: 0 };
    material.onBeforeCompile = shader => {
      shader.uniforms.paperTime = time;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float paperTime;').replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.z+=sin(position.x*3.+paperTime*.6)*.035;');
    };
    const mesh = new THREE.Mesh(paperGeometry, material); mesh.name = 'Floating skill card';
    // Two airy rows in the clear front of the room, away from the stair flights.
    mesh.position.set(-7.1 + (index % 3) * 1.4 - room.x, 1.55 + Math.floor(index / 3) * 1.45, -2.3 - room.z);
    mesh.userData.skillCard = true; root.add(mesh);
    const outline = new THREE.LineSegments(own(new THREE.EdgesGeometry(paperGeometry)), own(new THREE.LineBasicMaterial({ color: 0xf0cb79, transparent: true, opacity: .7, depthWrite: false, blending: THREE.AdditiveBlending })));
    mesh.add(outline);
    return { mesh, canvas, texture, material, outline, base: mesh.position.clone(), time, id: null as string | null };
  });
  function setSkills(skills: GallerySkill[], page = 0) {
    const visible = skills.slice(page * SKILLS_PER_PAGE, (page + 1) * SKILLS_PER_PAGE);
    for (const [index, card] of cards.entries()) {
      const skill = visible[index]; card.mesh.visible = !!skill || (!skills.length && index < 3); card.id = skill?.id ?? null;
      if (!card.mesh.visible) continue;
      const color = skill ? SKILL_COLORS[skill.color] : Object.values(SKILL_COLORS)[index];
      card.outline.material.color.set(color); card.mesh.userData.skillId = card.id;
      const c = card.canvas.getContext('2d'); if (!c) continue;
      c.clearRect(0, 0, 640, 640);
      const glow = c.createLinearGradient(0, 0, 640, 640); glow.addColorStop(0, color + '4a'); glow.addColorStop(1, '#071c2bd9'); c.fillStyle = glow; c.fillRect(0, 0, 640, 640);
      c.strokeStyle = color + '88'; c.lineWidth = 2; c.strokeRect(18, 18, 604, 604);
      c.fillStyle = color; c.font = '17px monospace'; c.fillText('KNOWLEDGE / IN MOTION', 44, 62);
      c.font = '90px Georgia'; c.fillText(String(page * SKILLS_PER_PAGE + index + 1).padStart(2, '0'), 44, 166);
      const writeLines = (text: string, y: number, size: number, limit: number) => {
        c.font = `${size}px ${size > 30 ? 'Georgia' : 'Arial'}`;
        const words = Array.from(text); let row = 0;
        while (words.length && row < limit) { let n = 1; while (n < words.length && c.measureText(words.slice(0, n + 1).join('')).width < 548) n++; let line = words.splice(0, n).join(''); if (row === limit - 1 && words.length) line = line.slice(0, -2) + '…'; c.fillText(line, 44, y + row * size * 1.3); row++; }
      };
      c.fillStyle = '#effff9'; writeLines(skill?.title ?? ['Your skills, in the air.', 'Choose your color.', 'Tell your story.'][index], 255, 42, 3);
      c.fillStyle = color; writeLines(skill?.description || (skill ? 'Tap to explore this skill.' : 'Add a skill with a name and an explanation. Your cards will float here.'), 423, 24, 4);
      c.font = '16px monospace'; c.fillText(skill ? 'TOUCH TO DISCOVER  ↗' : 'YOUR NEXT CHAPTER', 44, 589);
      card.texture.needsUpdate = true;
    }
  }
  setSkills([]);
  const direction = new THREE.Vector3();
  return {
    root, setSkills,
    hit(ray: THREE.Raycaster) { return ray.intersectObjects(cards.filter(card => card.mesh.visible).map(card => card.mesh), false)[0] ?? null; },
    update(time: number, camera: THREE.Camera, reduced: boolean, dark: boolean) {
      camera.getWorldPosition(direction); root.worldToLocal(direction);
      for (const [index, card] of cards.entries()) {
        card.mesh.position.copy(card.base); card.mesh.position.y += reduced ? 0 : Math.sin(time * .55 + index * 1.4) * .13;
        card.mesh.rotation.y = Math.atan2(direction.x - card.mesh.position.x, direction.z - card.mesh.position.z);
        card.mesh.rotation.z = reduced ? 0 : Math.sin(time * .3 + index) * .045;
        card.time.value = reduced ? 0 : time; card.material.opacity = dark ? .95 : .86;
      }
    },
    dispose() { root.removeFromParent(); },
  };
}
