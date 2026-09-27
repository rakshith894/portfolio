'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  DoorOpen,
  Moon,
  Shield,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { galleries, isGalleryLevel } from '@/lib/galleries';
import type { Destination } from '@/lib/nocturne';

type MansionHandle = {
  floor: (level: number) => void;
  inspect: (open: boolean) => void;
};
type Props = {
  onExit: () => void;
  onPortfolio: (section: Destination) => void;
  sound: boolean;
  onSound: () => void;
  audioError?: boolean;
  quiet: boolean;
  onQuiet: () => void;
  initialLevel?: number;
  exitLabel?: string;
};

export default function Mansion({
  onExit,
  onPortfolio,
  sound,
  onSound,
  audioError = false,
  quiet,
  onQuiet,
  initialLevel = 0,
  exitLabel = 'The grounds',
}: Props) {
  const start = isGalleryLevel(initialLevel) ? initialLevel : 0;
  const [level, setLevel] = useState(start);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [travelling, setTravelling] = useState<number | null>(null);
  const [record, setRecord] = useState(false);
  const [visited, setVisited] = useState<Set<number>>(new Set());
  const canvasHost = useRef<HTMLDivElement>(null);
  const api = useRef<MansionHandle | null>(null);
  const calm = useRef(quiet);
  useEffect(() => {
    calm.current = quiet;
  }, [quiet]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const recordTitle = useRef<HTMLHeadingElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const floorRef = useRef(start);
  const transitRef = useRef(false);
  const openRecordRef = useRef<() => void>(() => {});
  const gallery = galleries[level];

  const openRecord = useCallback(() => {
    if (transitRef.current) return;
    setRecord(true);
    api.current?.inspect(true);
    if (level > 0) setVisited((previous) => new Set([...previous, level]));
  }, [level]);
  useEffect(() => {
    openRecordRef.current = openRecord;
  }, [openRecord]);
  function closeRecord() {
    setRecord(false);
    api.current?.inspect(false);
  }
  function travel(next: number) {
    if (!isGalleryLevel(next) || next === level || transitRef.current) return;
    transitRef.current = true;
    setRecord(false);
    setTravelling(next);
    const arrive = () => {
      api.current?.floor(next);
      floorRef.current = next;
      setLevel(next);
      setTravelling(null);
      transitRef.current = false;
      title.current?.focus();
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) arrive();
    else timer.current = setTimeout(arrive, 1600);
  }
  const wasReading = useRef(false);
  useEffect(() => {
    if (record) recordTitle.current?.focus();
    else if (wasReading.current && !transitRef.current)
      openButton.current?.focus();
    wasReading.current = record;
  }, [record]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && record) {
        event.preventDefault();
        closeRecord();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [record]);

  useEffect(() => {
    const host = canvasHost.current;
    if (!host) return;
    let disposed = false;
    let frame = 0;
    const mobile = matchMedia('(max-width: 700px)').matches;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !mobile,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => {
        if (!disposed) setFailed(true);
      });
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.2 : 1.6));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#080e12');
    scene.fog = new THREE.Fog('#080e12', 12, 38);
    const camera = new THREE.PerspectiveCamera(53, 1, 0.1, 80);
    const resources = new Set<{ dispose: () => void }>();
    const own = <T extends { dispose: () => void }>(item: T) => {
      resources.add(item);
      return item;
    };
    const mat = (
      color: number,
      extra: THREE.MeshStandardMaterialParameters = {},
    ) =>
      own(new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra }));
    const masonry = mat(0x656b69),
      wood = mat(0x272c2a),
      iron = mat(0x43494a, { metalness: 0.65 }),
      trim = mat(0x69695d),
      floor = mat(0x68716c, { metalness: 0.015, roughness: 0.72 });
    const loader = new THREE.TextureLoader();
    function load(url: string, color: boolean, repeat: number) {
      const texture = own(
        loader.load(
          url,
          () => {
            if (disposed) texture.dispose();
          },
          undefined,
          () => {},
        ),
      );
      if (color) texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.setScalar(repeat);
      return texture;
    }
    masonry.map = load('/materials/stone-color.webp', true, 2);
    masonry.normalMap = load('/materials/stone-normal.webp', false, 2);
    masonry.normalScale.setScalar(0.4);
    floor.map = load('/materials/path-color.webp', true, 3);
    floor.normalMap = load('/materials/path-normal.webp', false, 3);
    floor.normalScale.setScalar(0.25);
    const boxGeometry = own(new THREE.BoxGeometry(1, 1, 1));
    const cylinder = own(new THREE.CylinderGeometry(1, 1, 1, 12));
    const sphere = own(new THREE.SphereGeometry(1, 12, 8));
    const box = (
      parent: THREE.Object3D,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      d: number,
    ) => {
      const item = new THREE.Mesh(boxGeometry, material);
      item.position.set(x, y, z);
      item.scale.set(w, h, d);
      parent.add(item);
      return item;
    };
    const floors: THREE.Group[] = [];
    const displays: THREE.Mesh[] = [];
    const flames: THREE.Mesh[] = [];
    const accentLights: THREE.PointLight[] = [];
    const artwork = load('/graveyard.webp', true, 1);
    artwork.wrapS = artwork.wrapT = THREE.ClampToEdgeWrapping;
    const picture = own(
      new THREE.MeshBasicMaterial({ map: artwork, color: 0xc9d7d9 }),
    );
    const pictureGeometry = own(new THREE.PlaneGeometry(3.9, 2.25));
    for (const gallery of galleries) {
      const group = new THREE.Group();
      group.position.y = -gallery.level * 10;
      group.visible = gallery.level === floorRef.current;
      scene.add(group);
      floors.push(group);
      const accent = new THREE.Color(gallery.accent);
      const glow = mat(accent.getHex(), {
        emissive: accent,
        emissiveIntensity: 0.8,
      });
      group.add(new THREE.HemisphereLight(0xa6bac8, 0x252017, 1.6));
      // A narrow passage opens into a vaulted exhibition room.
      box(group, floor, 0, -0.2, -4, 12, 0.4, 28);
      box(group, masonry, -6, 3, -4, 0.5, 6, 28);
      box(group, masonry, 6, 3, -4, 0.5, 6, 28);
      box(group, masonry, 0, 3, -18, 12, 6, 0.5);
      box(group, wood, 0, 6.1, -4, 12, 0.35, 28);
      for (const side of [-1, 1]) {
        box(group, wood, side * 5.73, 0.8, -4, 0.1, 1.6, 28);
        box(group, trim, side * 5.65, 1.65, -4, 0.12, 0.08, 28);
        box(group, trim, side * 5.65, 0.12, -4, 0.15, 0.18, 28);
        box(group, masonry, side * 3.6, 2.9, 4, 0.4, 5.8, 11);
        for (let z = 8; z > -17; z -= 4) {
          const column = new THREE.Mesh(cylinder, masonry);
          column.position.set(side * 5.4, 2.75, z);
          column.scale.set(0.2, 5.5, 0.2);
          group.add(column);
          box(group, trim, side * 5.4, 0.15, z, 0.55, 0.3, 0.55);
          box(group, trim, side * 5.4, 5.45, z, 0.55, 0.3, 0.55);
          box(group, iron, side * 5.5, 2.5, z, 0.28, 0.65, 0.35);
          const flame = new THREE.Mesh(sphere, glow);
          flame.position.set(side * 5.3, 2.88, z);
          flame.scale.set(0.065, 0.15, 0.065);
          group.add(flame);
          flames.push(flame);
        }
      }
      for (const z of [7, 0, -8, -16]) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-5.4, 4, z),
          new THREE.Vector3(-3, 5.25, z),
          new THREE.Vector3(0, 5.8, z),
          new THREE.Vector3(3, 5.25, z),
          new THREE.Vector3(5.4, 4, z),
        ]);
        const rib = new THREE.Mesh(
          own(new THREE.TubeGeometry(curve, 20, 0.09, 6, false)),
          trim,
        );
        group.add(rib);
      }
      // Two side alcoves and a central display form one project room on each level.
      for (const side of [-1, 1]) {
        box(group, wood, side * 4.7, 2.5, -10, 1.1, 3.8, 0.45);
        for (let shelf = 0; shelf < 4; shelf++)
          box(
            group,
            trim,
            side * 4.7,
            1.1 + shelf * 0.8,
            -9.72,
            1.15,
            0.055,
            0.65,
          );
        for (let book = 0; book < 7; book++)
          box(
            group,
            book % 2 ? masonry : iron,
            side * 4.7 + ((book % 3) - 1) * 0.27,
            1.44 + Math.floor(book / 3) * 0.8,
            -9.62,
            0.16,
            0.55,
            0.24,
          );
        box(group, masonry, side * 3.8, 0.65, -14, 1.1, 1.3, 1.1);
        const object = new THREE.Mesh(
          own(new THREE.IcosahedronGeometry(0.42, gallery.level % 2)),
          glow,
        );
        object.position.set(side * 3.8, 1.65, -14);
        group.add(object);
      }
      box(group, iron, 0, 2.55, -16.8, 4.25, 2.65, 0.3);
      const screen = new THREE.Mesh(pictureGeometry, picture);
      screen.position.set(0, 2.55, -16.62);
      group.add(screen);
      displays.push(screen);
      box(group, trim, 0, 0.95, -14.4, 3.2, 0.14, 1.3);
      box(group, wood, 0, 0.43, -14.4, 2.8, 0.86, 1.1);
      const light = new THREE.PointLight(accent, 45, 20, 1.7);
      light.position.set(0, 4, -11);
      group.add(light);
      accentLights.push(light);
      const entranceLight = new THREE.PointLight(0xe7bb80, 24, 15, 1.7);
      entranceLight.position.set(0, 3.8, 4);
      group.add(entranceLight);
      // The lift threshold stays visible when returning from the gallery.
      box(group, iron, -1.85, 2, 9.2, 0.25, 4, 0.35);
      box(group, iron, 1.85, 2, 9.2, 0.25, 4, 0.35);
      box(group, trim, 0, 4, 9.2, 3.95, 0.2, 0.4);
    }
    let inspecting = false;
    const targetPosition = new THREE.Vector3(),
      targetLook = new THREE.Vector3(),
      look = new THREE.Vector3();
    function pose(instant = false) {
      const y = -floorRef.current * 10;
      targetPosition.set(
        inspecting ? 0 : 1.1,
        y + (inspecting ? 2.35 : 2.5),
        inspecting ? -10.4 : 6.4,
      );
      targetLook.set(0, y + 2.6, -16.8);
      if (instant || motion.matches) {
        camera.position.copy(targetPosition);
        look.copy(targetLook);
      }
    }
    pose(true);
    api.current = {
      floor: (level) => {
        if (!isGalleryLevel(level)) return;
        floorRef.current = level;
        floors.forEach((group, i) => {
          group.visible = i === level;
        });
        inspecting = false;
        pose(true);
      },
      inspect: (open) => {
        inspecting = open;
        pose();
      },
    };
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const activate = (event: PointerEvent) => {
      if (transitRef.current || event.button !== 0) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      if (raycaster.intersectObject(displays[floorRef.current]).length)
        openRecordRef.current();
    };
    let contextFailed = false;
    const lost = (event: Event) => {
      event.preventDefault();
      contextFailed = true;
      setFailed(true);
    };
    renderer.domElement.addEventListener('pointerup', activate);
    renderer.domElement.addEventListener('webglcontextlost', lost);
    let previous = 0,
      rendered = 0,
      time = 0;
    const loop = (now: number) => {
      if (disposed || contextFailed) return;
      frame = requestAnimationFrame(loop);
      if (document.hidden) {
        previous = now;
        return;
      }
      if (mobile && now - rendered < 32) return;
      rendered = now;
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      time += dt;
      const still = motion.matches || calm.current;
      camera.position.lerp(
        targetPosition,
        motion.matches ? 1 : 1 - Math.exp(-dt * 1.8),
      );
      look.lerp(targetLook, motion.matches ? 1 : 1 - Math.exp(-dt * 2));
      camera.lookAt(look);
      if (!still) {
        const level = floorRef.current;
        accentLights[level].intensity = 43 + Math.sin(time * 0.65 + level) * 2;
      } else accentLights[floorRef.current].intensity = 45;
      for (const flame of flames)
        if (flame.parent?.visible)
          flame.scale.y = still
            ? 0.15
            : 0.15 + Math.sin(time * 2.5 + flame.position.z) * 0.012;
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(loop);
    queueMicrotask(() => {
      if (!disposed) setReady(true);
    });
    return () => {
      disposed = true;
      api.current = null;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerup', activate);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      resources.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <section
      className={`experience mansion-experience ${record ? 'reading-record' : ''}`}
      aria-label="Nocturne mansion and basement galleries"
    >
      <div className="world-canvas" ref={canvasHost} aria-hidden="true" />
      <header className="world-header">
        <Button className="world-back" variant="ghost" onClick={onExit}>
          <ArrowLeft size={17} />
          <span>{exitLabel}</span>
        </Button>
        <div className="world-title">
          <span>{level === 0 ? 'CHAPTER II' : 'CHAPTER III'}</span>
          <strong>{level === 0 ? 'The mansion' : 'The descent'}</strong>
        </div>
        <Button
          className="world-archive"
          variant="outline"
          onClick={() => onPortfolio('projects')}
        >
          Quick portfolio <ArrowRight size={14} />
        </Button>
      </header>
      <div className="world-tools">
        <Button
          variant="outline"
          size="icon"
          aria-label={sound ? 'Mute sound' : 'Enable ambient sound'}
          onClick={onSound}
        >
          {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Calm mode"
          aria-pressed={quiet}
          onClick={onQuiet}
        >
          <Shield size={17} />
        </Button>
      </div>
      <div className="mansion-heading">
        <span className="eyebrow">{gallery.subtitle}</span>
        <h1 ref={title} tabIndex={-1}>
          {gallery.title}
        </h1>
        <p>
          {travelling !== null
            ? `The lift is travelling to ${travelling ? `B${travelling}` : 'the entrance hall'}…`
            : gallery.story}
        </p>
      </div>
      {(!ready || failed) && (
        <output className="mansion-fallback">
          <Moon size={18} />
          {failed
            ? 'The 3D view is unavailable. You can still explore every gallery below.'
            : 'Lighting the halls…'}
        </output>
      )}
      {audioError && (
        <output className="island-audio-note">Sound could not start. You can still explore.</output>
      )}
      <nav className="lift-panel" aria-label="Mansion elevator">
        <div className="lift-heading">
          <ArrowDown size={14} />
          <span>THE LIFT</span>
          <small>{String(visited.size).padStart(2, '0')} / 06 RECORDS</small>
        </div>
        <div className="floor-buttons">
          {galleries.map((item) => (
            <Button
              key={item.level}
              variant="ghost"
              aria-label={
                item.level === 0
                  ? 'Entrance hall'
                  : `B${item.level}: ${item.title}`
              }
              aria-pressed={level === item.level}
              disabled={travelling !== null}
              onClick={() => travel(item.level)}
              className={visited.has(item.level) ? 'visited' : ''}
            >
              {item.level ? `B${item.level}` : 'G'}
            </Button>
          ))}
        </div>
        <p>
          {level === 0
            ? 'The house is open. Choose a level.'
            : 'Six rooms. Six ways to understand the work.'}
        </p>
      </nav>
      {!record && (
        <div className="record-invitation">
          <span>{level ? `RECORD 0${level}` : 'THE HOUSE LEDGER'}</span>
          <h2>{gallery.room}</h2>
          <Button
            ref={openButton}
            className="enter-button"
            disabled={travelling !== null}
            onClick={openRecord}
          >
            <BookOpen size={16} />
            {level ? 'Walk in & open record' : 'Read the ledger'}
            <ArrowRight size={16} />
          </Button>
        </div>
      )}
      {record && (
        <aside className="gallery-record" aria-label={gallery.room}>
          <Button
            className="story-close"
            variant="ghost"
            size="icon"
            aria-label="Close gallery record"
            onClick={closeRecord}
          >
            <X size={16} />
          </Button>
          <span className="eyebrow">
            {level
              ? `NOCTURNE / RECORD 0${level}`
              : 'NOCTURNE / THE HOUSE LEDGER'}
          </span>
          <h2 ref={recordTitle} tabIndex={-1}>
            {gallery.room}
          </h2>
          <p>{gallery.detail}</p>
          <div className="technology-tags">
            {gallery.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <div className="gallery-record-actions">
            <Button
              variant="outline"
              onClick={() => onPortfolio(level === 0 ? 'about' : 'projects')}
            >
              View portfolio <ArrowRight size={14} />
            </Button>
            <Button
              variant="ghost"
              onClick={() => (level < 6 ? travel(level + 1) : onExit())}
            >
              {level < 6
                ? 'Next gallery'
                : `Back to ${exitLabel.toLowerCase()}`}
              <DoorOpen size={15} />
            </Button>
          </div>
        </aside>
      )}
      {travelling !== null && (
        <output className="lift-transition" aria-live="polite">
          <div />
          <div />
          <span>
            <ArrowDown size={20} />
            {travelling === 0 ? 'G' : `B${travelling}`}
            <small>THE HOUSE GOES DEEPER</small>
          </span>
        </output>
      )}
      <div className="world-hint">
        <span>CHOOSE A FLOOR</span>
        <span>OPEN ITS RECORD</span>
        <span>EXPLORE AT YOUR PACE</span>
      </div>
    </section>
  );
}
