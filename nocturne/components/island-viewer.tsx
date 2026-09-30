'use client';

export { preloadIslandAssets } from '@/lib/island-preload';

import { createSailingController, seaRoute, type SeaPoint } from '@/lib/island-sailing';
import { oceanSample } from '@/lib/island-motion';
import { islandMode, ISLAND_MODES, type IslandMode } from '@/lib/island-mode';
import { BOAT_DOCK, BOAT_MOORING } from '@/lib/island-stairs';
import { createHouseExploration, type HouseStatus } from '@/lib/house-exploration';
import { DEFAULT_HALL_SETTINGS, hallLighting, type HallSettings } from '@/lib/master-hall';
import { HALL_PROJECT_KEY, readHallProjects, hallProjectPage, hallPageCount, nextHallProject, HALL_PAGE_SIZE, type HallFrameId, type HallProject } from '@/lib/hall-projects';
import { HallProjectDialog } from '@/components/hall-project-dialog';
import savedProjects from '@/content/hall-projects.json';
import savedProfile from '@/content/profile.json';
import type { ContactProfile } from '@/lib/contact-profile';
import { ContactApparitionDialog } from '@/components/contact-apparition-dialog';
import { createContactApparition } from '@/lib/contact-apparition';
import { createSkillHolograms } from '@/lib/skill-holograms';
import { readSkills, SKILLS_PER_PAGE, type GallerySkill } from '@/lib/skill-gallery';
import { SkillGalleryDialog } from '@/components/skill-gallery-dialog';
import savedSkills from '@/content/skills.json';
import { createCoffinCompanions } from '@/lib/coffin-companions';
import { createTravelDirection, createFollowOrbit, followBehind } from '@/lib/chase-camera';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Square,
  DoorOpen,
  Maximize2,
  Mic,
  MicOff,
  Sun,
  Moon,
  Snowflake,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createReferenceEnvironment } from '@/lib/reference-environment';
import { referenceCameraPose } from '@/lib/reference-layout';
import {
  createIslandWalker,
  gateOpening,
  walkingHeight,
} from '@/lib/island-walk';
import { createIslandNavigator } from '@/lib/island-navigation';
import { createJourneyGuide } from '@/lib/island-journey';
import { createIslandAvatar } from '@/lib/island-avatar';
import type { createAmbience } from '@/lib/ambience';
import { createIslandSoundCues } from '@/lib/island-sound-cues';
import {
  islandPlaces,
  menuPlaces,
  parseIslandCommand,
  speakIsland,
  stopIslandSpeech,
  type PlaceId,
} from '@/lib/island-commands';

type VoiceRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: {
    results: ArrayLike<ArrayLike<{ transcript: string }>>;
  }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const movementKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

export default function IslandViewer({
  ambience: audio,
  audioError,
  onExit,
  onPortfolio,
  active = true,
  startAtHouse = false,
}: {
  ambience: RefObject<ReturnType<typeof createAmbience> | null>;
  audioError: boolean;
  onExit?: () => void;
  onPortfolio?: () => void;
  active?: boolean;
  startAtHouse?: boolean;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const activeScene = useRef(active);
  const [mode, setMode] = useState<IslandMode>(() => {
    try { return islandMode(localStorage.getItem('nocturne-mode') ?? localStorage.getItem('nocturne-daylight')); }
    catch { return 'night'; }
  });
  const modeRef = useRef(mode);
  const applyMode = useRef<(mode: IslandMode) => void>(() => {});
  function changeMode(value: IslandMode) {
    modeRef.current = value;
    setMode(value);
    applyMode.current(value);
    try { localStorage.setItem('nocturne-mode', value); } catch {}
  }
  const speechBubble = useRef<HTMLOutputElement>(null);
  const welcomeStarted = useRef(false);
  const goToPlace = useRef<(id: PlaceId) => void>(() => {});
  const stopNavigation = useRef<() => void>(() => {});
  const touchMovement = useRef<(key: string, active: boolean) => void>(() => {});
  const performAvatarAction = useRef<
    (action: 'jump' | 'sit' | 'dance' | 'wave') => void
  >(() => {});
  const waterAction = useRef<
    (action: 'board' | 'leaveBoat' | 'swim' | 'return') => void
  >(() => {});
  const cameraCommand = useRef<
    (action: 'overview' | 'zoomIn' | 'zoomOut') => void
  >(() => {});
  const recognition = useRef<VoiceRecognition | null>(null);
  const [houseStatus, setHouseStatus] = useState<HouseStatus>(null);
  const canEditProjects = process.env.NODE_ENV === 'development';
  const [profile, setProfile] = useState<ContactProfile>(savedProfile);
  const profileRef = useRef(profile);
  const [contactOpen, setContactOpen] = useState(false);
  const contactOpenRef = useRef(false);
  const [skills, setSkills] = useState<GallerySkill[]>(() => readSkills(savedSkills));
  const skillsRef = useRef(skills), skillsOpenRef = useRef(false);
  const [skillsOpen, setSkillsOpen] = useState(false), [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [skillsPage, setSkillsPage] = useState(0);
  const skillsPageRef = useRef(0);
  const applySkills = useRef<(skills: GallerySkill[], page: number) => void>(() => {});
  function showSkills(open: boolean, id: string | null = null) {
    skillsOpenRef.current = open; setSkillsOpen(open); setSelectedSkill(id); contactInteraction.current(open);
  }
  function selectSkill(id: string | null) {
    setSelectedSkill(id);
    if (id) changeSkillsPage(Math.floor(skillsRef.current.findIndex(skill => skill.id === id) / SKILLS_PER_PAGE));
  }
  function changeSkillsPage(page: number) {
    const next = Math.max(0, Math.min(Math.max(1, Math.ceil(skillsRef.current.length / SKILLS_PER_PAGE)) - 1, page));
    skillsPageRef.current = next; setSkillsPage(next); applySkills.current(skillsRef.current, next);
  }
  async function saveSkill(skill: GallerySkill, remove = false): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    try {
      const response = await fetch('/__nocturne/skills', { method: remove ? 'DELETE' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(skill) });
      const result = await response.json() as { skills?: unknown; error?: string };
      if (!response.ok) return result.error ?? 'Could not save this skill.';
      const next = readSkills(result.skills); skillsRef.current = next; setSkills(next);
      changeSkillsPage(remove ? skillsPageRef.current : Math.floor(next.findIndex(item => item.id === skill.id) / SKILLS_PER_PAGE));
      setSelectedSkill(remove ? next[0]?.id ?? null : skill.id); return null;
    } catch { return 'Could not reach the local editor. Your entered text is still here.'; }
  }
  const contactInteraction = useRef<(open: boolean) => void>(() => {});
  const applyProfile = useRef<(profile: ContactProfile) => void>(() => {});
  function showContact(open: boolean) { contactOpenRef.current = open; setContactOpen(open); contactInteraction.current(open); }
  function saveProfile(value: ContactProfile) { profileRef.current = value; setProfile(value); applyProfile.current(value); }
  const [projects, setProjects] = useState<HallProject[]>(() => readHallProjects(JSON.stringify(savedProjects)));
  const projectsRef = useRef(projects);
  const [galleryPage, setGalleryPage] = useState(0);
  const galleryPageRef = useRef(0);
  const applyProjects = useRef<(projects: HallProject[]) => void>(() => {});
  function changeGalleryPage(page: number) {
    const next = Math.max(0, Math.min(hallPageCount(projectsRef.current) - 1, page));
    galleryPageRef.current = next; setGalleryPage(next);
    applyProjects.current(hallProjectPage(projectsRef.current, next));
  }
  function addProject() {
    if (!canEditProjects) return;
    const blank = projectsRef.current.find(project => !project.url);
    const project = blank ?? nextHallProject(projectsRef.current);
    if (!blank) { const next = [...projectsRef.current, project]; projectsRef.current = next; setProjects(next); }
    chooseProject(project.id);
  }
  const [selectedProject, setSelectedProject] = useState<HallFrameId | null>(null);
  const selectedProjectRef = useRef<HallFrameId | null>(null);
  const projectSelection = useRef<(id: HallFrameId | null) => void>(() => {});
  function chooseProject(id: HallFrameId | null) {
    if (id) changeGalleryPage(Math.floor(projectsRef.current.findIndex(project => project.id === id) / HALL_PAGE_SIZE));
    selectedProjectRef.current = id;
    setSelectedProject(id);
    projectSelection.current(id);
  }
  async function saveProject(project: HallProject): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    try {
      const response = await fetch('/__nocturne/projects', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project),
      });
      const result = await response.json() as { error?: string; projects?: unknown };
      if (!response.ok) return result.error || 'Could not save the frame. Please try again.';
      const next = readHallProjects(JSON.stringify(result.projects));
      projectsRef.current = next;
      setProjects(next);
      applyProjects.current(hallProjectPage(next, galleryPageRef.current));
      return null;
    } catch { return 'Could not reach the local editor. Keep the development server running and try again.'; }
  }
  async function importProjectDrafts(): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    let drafts: HallProject[];
    try { drafts = readHallProjects(localStorage.getItem(HALL_PROJECT_KEY)); }
    catch { return 'This browser could not read your old drafts.'; }
    const missing = drafts.filter(draft => draft.url && !projectsRef.current.find(project => project.id === draft.id)?.url);
    if (!missing.length) return 'No browser drafts were found for empty frames. Try the browser and local address where you originally saved them.';
    for (const draft of missing) {
      const error = await saveProject(draft);
      if (error) return error;
    }
    return null;
  }
  const houseInteract = useRef<() => void>(() => {});
  const houseReturn = useRef<() => void>(() => {});
  const houseUpstairs = useRef<() => void>(() => {});
  const houseSkills = useRef<() => void>(() => {});
  const [hallSettings, setHallSettings] = useState<HallSettings>(DEFAULT_HALL_SETTINGS);
  const hallSettingsRef = useRef(hallSettings);
  const applyHallSettings = useRef<(settings: HallSettings) => void>(() => {});
  function changeHallSettings(change: Partial<HallSettings>) {
    const settings = { ...hallSettingsRef.current, ...change };
    hallSettingsRef.current = settings;
    setHallSettings(settings);
    applyHallSettings.current(settings);
  }
  const requestHouse = useRef<() => void>(() => {});
  const [enteringHouse, setEnteringHouse] = useState(false);
  const overviewRef = useRef(false);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [boatMode, setBoatMode] = useState(false);
  const [nearBoat, setNearBoat] = useState(false);
  const [atDock, setAtDock] = useState(false);
  const [overview, setOverview] = useState(false);
  const [nearHouse, setNearHouse] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [journey, setJourney] = useState<{ name: string; moving: boolean; planning?: boolean } | null>(null);
  useEffect(() => {
    if (!journey || journey.moving) return;
    const timer = window.setTimeout(() => setJourney(null), 5000);
    return () => window.clearTimeout(timer);
  }, [journey]);
  useEffect(() => {
    if (!voiceNotice || listening) return;
    const timer = window.setTimeout(() => setVoiceNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [voiceNotice, listening]);
  useEffect(() => { activeScene.current = active; if (!active) stopNavigation.current(); }, [active]);
  useEffect(() => {
    if (!ready || welcomeStarted.current) return;
    welcomeStarted.current = true;
    speakIsland('Welcome to the island, traveller. Follow the lanterns to Rakshith Manor.');
  }, [ready]);
  useEffect(
    () => () => {
      stopIslandSpeech();
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
      }
      recognition.current?.abort();
      recognition.current = null;
    },
    [],
  );
  function toggleVoice() {
    if (listening) {
      const previous = recognition.current;
      recognition.current = null;
      if (previous) {
        previous.onresult = null;
        previous.onerror = null;
        previous.onend = null;
        previous.abort();
      }
      setListening(false);
      setVoiceNotice('Voice command cancelled.');
      return;
    }
    const browser = window as typeof window & {
      SpeechRecognition?: new () => VoiceRecognition;
      webkitSpeechRecognition?: new () => VoiceRecognition;
    };
    const Constructor =
      browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) {
      setVoiceNotice(
        'Voice commands are not available in this browser. Use the Places menu instead.',
      );
      return;
    }
    const recognizer = new Constructor();
    stopIslandSpeech();
    setVoiceNotice('Listening… Try “go to the manor” or “stop”.');
    recognition.current = recognizer;
    recognizer.lang = 'en-US';
    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.onresult = (event) => {
      if (recognition.current !== recognizer) return;
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      const command = parseIslandCommand(transcript, 0);
      setVoiceNotice(`Heard: “${transcript}”`);
      if (command?.type === 'place') goToPlace.current(command.id);
      else if (command?.type === 'action') {
        if (command.action === 'stop') stopNavigation.current();
        else if (command.action === 'overview') cameraCommand.current('overview');
        else if (
          command.action === 'board' ||
          command.action === 'leaveBoat' ||
          command.action === 'swim'
        )
          waterAction.current(command.action);
        else performAvatarAction.current(command.action);
      } else if (command?.type === 'stop') stopNavigation.current();
      else if (command?.type === 'welcome') speakIsland('Welcome to the island. Follow the lanterns to Rakshith Manor.');
      else if (command?.type === 'door' && command.open) {
        if (nearHouse) requestHouse.current();
        else goToPlace.current('manor');
      }
      else
        setVoiceNotice(
            'Try saying go to The Last Watch, go to the boat, stop, jump, sit, wave, dance, or look around.',
        );
    };
    recognizer.onerror = (event) => {
      if (recognition.current !== recognizer) return;
      setListening(false);
      setVoiceNotice(event.error === 'not-allowed'
        ? 'Microphone access was denied. You can still use Places and the walking controls.'
        : event.error === 'aborted' ? 'Voice command cancelled.'
        : 'No voice command received. Try again or choose a place.');
    };
    recognizer.onend = () => {
      if (recognition.current !== recognizer) return;
      recognition.current = null;
      setListening(false);
    };
    setListening(true);
    try {
      recognizer.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setVoiceNotice(
        'The microphone could not start. Please allow microphone access, then try again.',
      );
    }
  }
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const mobile = matchMedia('(max-width:700px)').matches;
    const motion = matchMedia('(prefers-reduced-motion:reduce)');
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !mobile,
        powerPreference: 'high-performance',
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }
    let disposed = false,
      frame = 0,
      simulationTime = 0;
    let previous = 0,
      lastRendered = 0,
      interactive = false,
      wasNearHouse = false,
      wasOverview = false,
      contextFailed = false;
    const keys = new Set<string>();
    const destination = new THREE.Vector3(NaN, NaN, NaN);
    const clickRay = new THREE.Raycaster();
    const clickPoint = new THREE.Vector2();
    let clickStart: { x: number; y: number; time: number } | null = null;
    const resources = new Set<{ dispose: () => void }>();
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.7));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = true;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0f16');
    scene.fog = new THREE.FogExp2('#27313b', 0.0028);
    const walker = createIslandWalker(mobile, startAtHouse, false);
    const destinationRoute: THREE.Vector3[] = [];
    let navigationRequest = 0;
    let cameraManualUntil = 0;
    const travelDirection = createTravelDirection();
    const followOrbit = createFollowOrbit();
    const navigator = createIslandNavigator(walker.canStand, walker.canTraverse);
    const touchKeys = new Set<string>();
    const sailing=createSailingController();
    let seaPath: SeaPoint[]=[];
    let inBoat=false, wasNearBoat=false, wasAtDock=false;
    let journeyName = '';
    let narratedJourney = false;
    const guide = createJourneyGuide(
      (text, onEnd) => speakIsland(text, { onEnd, rate: 1.05, onUnavailable: () => setVoiceNotice('No male narration voice is installed. Journey captions are still available.') }),
      stopIslandSpeech,
      setSpeechText,
    );
    const bubblePosition = new THREE.Vector3();
    const navigateTo = async (point: { x: number; z: number }, name: string, narrate = false) => {
      if(inBoat){ setDestinationsOpen(false); setVoiceNotice("Return to the dock before visiting island places."); return; }
      guide.cancel();
      narratedJourney = narrate;
      const request = ++navigationRequest;
      keys.clear();
      touchKeys.clear();
      destinationRoute.length = 0;
      destination.set(NaN, NaN, NaN);
      destinationStuckTime = 0;
      setDestinationsOpen(false);
      setJourney({ name: `Finding a path to ${name}…`, moving: true, planning: true });
      const route = await navigator.routeAsync(walker.position.clone(), point, .8, () => disposed || request !== navigationRequest);
      if (disposed || request !== navigationRequest) return;
      if (!route?.length) {
        setJourney({ name: 'No clear path. Choose a nearby spot.', moving: false });
        return;
      }
      journeyName = name;
      destination.copy(route[0]);
      destinationRoute.push(...route.slice(1));
      setJourney({ name: `Running to ${name}`, moving: true });
      if (narrate) guide.announce('departure', name);
    };
    goToPlace.current = (id) => {
      const place = islandPlaces.find((entry) => entry.id === id);
      if (!place) return;
      // The watchtower destination is its accessible upper platform.
      void navigateTo(id === 'tower' ? { x: -52, z: -31 } : place, place.name, true);
    };
    const player = createIslandAvatar(resources, mobile);
    const soundCues = createIslandSoundCues({
      step: (...args) => audio.current?.step(...args),
      gate: () => audio.current?.gate(),
      ghost: (...args) => { if (modeRef.current === 'night') audio.current?.ghost(...args); },
      bell: (...args) => audio.current?.bell(...args),
      thunder: () => { if (modeRef.current === 'night') audio.current?.thunder(); },
    });
    performAvatarAction.current = player.perform;
    player.root.position.copy(walker.position);
    player.root.rotation.y = walker.heading;
    scene.add(player.root);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.12, 1600);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.enableDamping = !motion.matches;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    // The normal zoom limit is applied below; collisions may shorten the orbit.
    controls.minDistance = .4;
    controls.maxDistance = 42;
    controls.minPolarAngle = Math.PI * 0.06;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.addEventListener('start', () => {
      cameraManualUntil = Infinity;
    });
    controls.addEventListener('end', () => {
      cameraManualUntil = performance.now() + 500;
    });
    cameraCommand.current = (action) => {
      if (action === 'overview') {
        overviewRef.current = !overviewRef.current;
        setOverview(overviewRef.current);
      } else {
        const factor = action === 'zoomIn' ? 0.7 : 1.35;
        followOrbit.zoom(factor);
        const offset = camera.position.clone().sub(controls.target).multiplyScalar(factor);
        camera.position.copy(controls.target).add(offset);
        controls.update();
      }
    };
    waterAction.current = (action) => {
      if(!interactive)return;
      if(action==='return' && inBoat){
        const route=seaRoute(sailing.position);
        if(route){clearInput();seaPath=route;setJourney({name:'Returning to the dock',moving:true});}
        else setVoiceNotice('Steer away from the shore, then try returning again.');
        return;
      }
      if(action==='swim'){goToPlace.current('boat');return;}
      if(action==='board'){
        if(inBoat)return;
        if(Math.hypot(walker.position.x-BOAT_DOCK.x,walker.position.z-BOAT_DOCK.z)>2.4){goToPlace.current('boat');return;}
        clearInput();inBoat=true;setBoatMode(true);player.setSeated(true);
        sailing.position.set(environment.boat.position.x,0,environment.boat.position.z);sailing.stop();
        walker.position.copy(sailing.position);walker.position.y=environment.boat.position.y;
        player.root.position.copy(walker.position);
        overviewRef.current=false;setOverview(false);controls.maxDistance=42;
        controls.target.copy(walker.position).add(new THREE.Vector3(0,1.5,0));
        camera.position.copy(controls.target).add(new THREE.Vector3(5,4,mobile ? -12 : -9));controls.update();
        setVoiceNotice('Use WASD or the arrows to sail. Hold Shift for speed. Return to dock brings you home.');
      }else if(action==='leaveBoat' && inBoat){
        if(Math.hypot(sailing.position.x-BOAT_MOORING.x,sailing.position.z-BOAT_MOORING.z)>2.5){setVoiceNotice('Return to the dock to step ashore.');return;}
        clearInput();inBoat=false;setBoatMode(false);player.setSeated(false);sailing.stop();
        walker.position.set(BOAT_DOCK.x,walkingHeight(BOAT_DOCK.x,BOAT_DOCK.z),BOAT_DOCK.z);
        player.root.position.copy(walker.position);
        environment.boat.position.set(BOAT_MOORING.x,0,BOAT_MOORING.z);environment.boat.rotation.y=0;
        controls.target.copy(walker.position).add(new THREE.Vector3(0,1.8,0));
        camera.position.copy(controls.target).add(new THREE.Vector3(5,4,-9));controls.update();
        setVoiceNotice('Back at the dock. Follow the stairs to the island.');
      }
    };
    controls.target.copy(walker.position).add(new THREE.Vector3(0, 2.8, -2));
    camera.position
      .copy(walker.position)
      .add(
        new THREE.Vector3(
          3.2,
          3.3,
          9.5,
        ),
      );
    const followOffset = camera.position.clone().sub(controls.target);
    controls.update();
    const ambientLight = new THREE.HemisphereLight(0xbac9d5, 0x171b1c, 0.7);
    scene.add(ambientLight);
    const moon = new THREE.DirectionalLight(0xd3deeb, 2.1);
    moon.position.set(-38, 75, 22);
    moon.target.position.set(0, 10, -18);
    scene.add(moon, moon.target);
    moon.castShadow = !mobile;
    resources.add(moon.shadow);
    moon.shadow.mapSize.set(2048, 2048);
    Object.assign(moon.shadow.camera, {
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
      near: 1,
      far: 160,
    });
    moon.shadow.normalBias = 0.06;
    const fill = new THREE.DirectionalLight(0xa7b8cc, 0.8);
    fill.position.set(35, 18, -42);
    scene.add(fill);
    const environment = createReferenceEnvironment(
      scene,
      renderer,
      resources,
      mobile,
    );
    const apparition = createContactApparition(scene, resources, profileRef.current);
    const skillHolograms = createSkillHolograms(scene, resources);
    skillHolograms.setSkills(skillsRef.current, skillsPageRef.current); applySkills.current = skillHolograms.setSkills;
    applyProfile.current = apparition.setProfile;
    const companions = createCoffinCompanions(scene, environment.coffins, resources, navigator, walker.canStand, setVoiceNotice);
    let visualMode = modeRef.current, hallLightingActive = false;
    applyMode.current = (value) => {
      visualMode = value;
      const day = value === 'day', winter = value === 'winter';
      ambientLight.color.setHex(winter ? 0xdcecf4 : day ? 0xc8e5ff : 0xbac9d5);
      ambientLight.groundColor.setHex(winter ? 0x8299ab : day ? 0x81735b : 0x171b1c);
      ambientLight.intensity = winter ? 1.9 : day ? 2.2 : .7;
      moon.color.setHex(winter ? 0xd6e6ef : day ? 0xffefd4 : 0xd3deeb);
      moon.intensity = winter ? 1.8 : day ? 3.2 : 2.1;
      fill.intensity = winter ? .9 : day ? 1.1 : .8;
      const fog = scene.fog as THREE.FogExp2;
      fog.color.setHex(winter ? 0xb5c7d4 : day ? 0xa9cee4 : 0x27313b);
      fog.density = winter ? .006 : day ? .0018 : .0028;
      environment.setMode(value);
      house.setMode(value);
      audio.current?.setMode(value);
    };
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 1.7));
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const clearInput = () => {
      travelDirection(0, 0, camera.position, walker.position);
      navigationRequest++;
      seaPath=[];sailing.stop();
      guide.cancel();
      narratedJourney = false;
      keys.clear();
      touchKeys.clear();
      setJourney(null);
      destinationRoute.length = 0;
      destination.set(NaN, NaN, NaN);
    };
    stopNavigation.current = () => { clearInput(); house.stop(); };
    const house = createHouseExploration(scene, environment.manor, player, walker, camera, controls, mobile, status => { setHouseStatus(status); setEnteringHouse(!!status); }, () => audio.current?.gate(), () => performance.now() <= cameraManualUntil, id => chooseProject(id));
    applyMode.current(modeRef.current);
    houseInteract.current = () => house.interact();
    houseReturn.current = () => { clearInput(); house.returnToDoor(); };
    houseUpstairs.current = () => { clearInput(); house.walkTo({ x: 2, z: -5, y: 5 }); };
    houseSkills.current = () => { clearInput(); house.walkTo({ x: -4.3, z: -3.4, y: 0 }); };
    applyHallSettings.current = settings => house.setHallSettings(settings);
    house.setHallSettings(hallSettingsRef.current);
    house.setProjects(hallProjectPage(projectsRef.current, galleryPageRef.current));
    applyProjects.current = items => house.setProjects(items);
    projectSelection.current = id => {
      clearInput(); house.stop();
      controls.enabled = id === null;
      house.selectProject(id);
    };
    contactInteraction.current = open => { clearInput(); house.stop(); controls.enabled = !open; apparition.activate(open && contactOpenRef.current); };
    requestHouse.current = () => {
      if (!interactive || inBoat || !walker.nearHouse) return;
      clearInput();
      overviewRef.current = false; setOverview(false);
      if (house.enter()) { setEnteringHouse(true); setDestinationsOpen(false); }
    };
    touchMovement.current = (key, active) => {
      if (active && interactive) {
        navigationRequest++;
        seaPath=[];
        guide.cancel();
        narratedJourney = false;
        destinationRoute.length = 0;
        destination.set(NaN, NaN, NaN);
        setJourney(null);
        touchKeys.add(key);
      } else touchKeys.delete(key);
    };
    const visibility = () => {
      if (document.hidden) clearInput();
    };
    const keydown = (event: KeyboardEvent) => {
      if (selectedProjectRef.current || contactOpenRef.current || skillsOpenRef.current) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      if (event.code === 'Escape') {
        house.stop();
        setDestinationsOpen(false);
        clearInput();
        return;
      }
      if (!activeScene.current || !interactive || event.altKey || event.ctrlKey || event.metaKey)
        return;
      if (movementKeys.has(event.code)) {
        navigationRequest++;
        seaPath=[];
        event.preventDefault();
        guide.cancel();
        narratedJourney = false;
        keys.add(event.code);
        setJourney(null);
        destinationRoute.length = 0;
        destination.set(NaN, NaN, NaN);
      }
      if (event.code === 'KeyE' && house.inside && apparition.near(walker.position) && !event.repeat) { event.preventDefault(); showContact(true); return; }
      if (event.code === 'KeyE' && house.active && !event.repeat) { event.preventDefault(); house.interact(); return; }
      if(event.code==='KeyE' && !event.repeat && (inBoat || wasNearBoat)){event.preventDefault();waterAction.current(inBoat?'leaveBoat':'board');return;}
      if (event.code === 'KeyE' && walker.nearHouse && !event.repeat) {
        event.preventDefault();
        requestHouse.current();
      }
    };
    const keyup = (event: KeyboardEvent) => {
      keys.delete(event.code);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      contextFailed = true;
      interactive = false;
      clearInput();
      setFailed(true);
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', visibility);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    const pointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) {
        clickStart = null;
        return;
      }
      clickStart = { x: event.clientX, y: event.clientY, time: performance.now() };
    };
    const pointerUp = (event: PointerEvent) => {
      if (!clickStart || performance.now() - clickStart.time > 450) {
        clickStart = null;
        return;
      }
      const moved = Math.hypot(
        event.clientX - clickStart.x,
        event.clientY - clickStart.y,
      );
      clickStart = null;
      if (moved > 8 || !interactive || !activeScene.current || selectedProjectRef.current || contactOpenRef.current || skillsOpenRef.current) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      clickPoint.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      clickRay.setFromCamera(clickPoint, camera);
      if (house.skillsRoom) {
        const skillHit = skillHolograms.hit(clickRay);
        if (skillHit && skillHit.distance < 12 && house.unoccluded(clickRay, skillHit.distance)) { showSkills(true, skillHit.object.userData.skillId as string | null); return; }
      }
      const contactHit = apparition.hit(clickRay);
      if (house.inside && contactHit && contactHit.distance < 12 && house.unoccluded(clickRay, contactHit.distance)) {
        const obstacle = clickRay.intersectObjects([environment.manor, environment.ground], true)[0];
        if (!obstacle || obstacle.distance >= contactHit.distance - .05) { showContact(true); return; }
      }
      if (!house.active && !inBoat) {
        const coffin = companions.hit(clickRay, [environment.ground, environment.manor]);
        if (coffin !== null) { clearInput(); companions.toggle(coffin, walker.position); return; }
      }
      if (house.active) {
        if (house.inside) {
          if (house.point(clickRay)) setVoiceNotice('');
          else setVoiceNotice('Tap clear floor or a stair tread to walk there. Tap a door to open it.');
        }
        return;
      }
      if (!inBoat && walker.nearHouse && clickRay.intersectObject(environment.manor.userData.door as THREE.Group, true).length) {
        requestHouse.current();
        return;
      }
      if(inBoat){
        const point=clickRay.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
        const route=point?seaRoute(sailing.position,point):null;
        if(route){clearInput();seaPath=route;setJourney({name:'Sailing to the selected spot',moving:true});}
        else setVoiceNotice('Choose open water away from the shore.');
        return;
      }
      const hit = clickRay.intersectObject(environment.ground, false)[0];
      // A terrain hit is authoritative; never project a blocked hit through scenery.
      if (hit) void navigateTo(hit.point, 'the selected spot');
      else {
        const level = new THREE.Plane(new THREE.Vector3(0, 1, 0), -walker.position.y);
        const point = clickRay.ray.intersectPlane(level, new THREE.Vector3());
        if (point) void navigateTo(point, 'the selected spot');
      }
    };
    const pointerCancel = () => { clickStart = null; };
    renderer.domElement.addEventListener('pointercancel', pointerCancel);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    let movementBlend = 0;
    const previousPosition = new THREE.Vector3(),
      change = new THREE.Vector3();
    let destinationStuckTime = 0;
    const loop = (now: number) => {
      if (disposed) return;
      frame = requestAnimationFrame(loop);
      if (document.hidden || contextFailed || !activeScene.current) {
        previous = now;
        return;
      }
      if (mobile && now - lastRendered < 32) return;
      lastRendered = now;
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
      previous = now;
      guide.update(dt);
      simulationTime += dt;
      const forward =
        Number(
          keys.has('KeyW') || touchKeys.has('KeyW') || keys.has('ArrowUp'),
        ) -
        Number(
          keys.has('KeyS') || touchKeys.has('KeyS') || keys.has('ArrowDown'),
        );
      const side =
        Number(
          keys.has('KeyD') || touchKeys.has('KeyD') || keys.has('ArrowRight'),
        ) -
        Number(
          keys.has('KeyA') || touchKeys.has('KeyA') || keys.has('ArrowLeft'),
        );
      if (house.update(dt, simulationTime, forward, side, keys.has('ShiftLeft') || keys.has('ShiftRight'), motion.matches)) {
        if (house.inside) {
          const settings = hallSettingsRef.current;
          const value = settings.mode === 'day' ? 'day' : 'night';
          if (visualMode !== value) applyMode.current(value);
          const lighting = hallLighting(settings);
          ambientLight.intensity = lighting.ambient;
          moon.intensity = lighting.daylight;
          fill.intensity = settings.mode === 'day' ? .7 : .015;
          hallLightingActive = true;
        } else if (hallLightingActive) {
          applyMode.current(modeRef.current);
          hallLightingActive = false;
        }
        followOrbit.reset();
        environment.setSheltered(house.inside);
        environment.update(simulationTime, camera);
        companions.update(dt, player.root.position, false, motion.matches);
        apparition.update(simulationTime, camera, motion.matches);
        skillHolograms.update(simulationTime, camera, motion.matches, hallSettingsRef.current.mode === 'dark');
        renderer.render(scene, camera);
        return;
      }
      house.updateOutside(dt);
      if (hallLightingActive) {
        applyMode.current(modeRef.current);
        hallLightingActive = false;
      }
      environment.setSheltered(false);
      previousPosition.copy(walker.position);
      const direction = travelDirection(
        forward,
        side,
        camera.position,
        walker.position,
        now <= cameraManualUntil,
      );
      const hasDestination =
        Number.isFinite(destination.x) && Number.isFinite(destination.z);
      if (!forward && !side && hasDestination && !guide.holdingDeparture) {
        const remaining = Math.hypot(
          destination.x - walker.position.x,
          destination.z - walker.position.z,
        );
        // Only round a corner if the next segment is safe from our actual
        // position. Stopping short of a waypoint can cut into a nearby stone.
        if (remaining < 0.06 && (!destinationRoute[0] || navigator.clear(walker.position, destinationRoute[0]))) {
          const next = destinationRoute.shift();
          if (next) destination.copy(next);
          else {
            destination.set(NaN, NaN, NaN);
            setJourney(narratedJourney ? null : { name: `Arrived at ${journeyName}`, moving: false });
            if (narratedJourney) guide.announce('arrival', journeyName);
            narratedJourney = false;
          }
        } else {
          direction.set(
            destination.x - walker.position.x,
            0,
            destination.z - walker.position.z,
          );
          direction.clampLength(0, 1);
        }
      }
      movementBlend = THREE.MathUtils.damp(movementBlend, direction.lengthSq() > 0 ? 1 : 0, 9, dt);
      if(inBoat && seaPath.length && !forward && !side){
        const target=seaPath[0];
        direction.set(target.x-sailing.position.x,0,target.z-sailing.position.z);
        if(direction.length()<.3){
          seaPath.shift();sailing.stop();direction.set(0,0,0);
          if(!seaPath.length)setJourney({name:Math.hypot(sailing.position.x-BOAT_MOORING.x,sailing.position.z-BOAT_MOORING.z)<2.5?'At the dock. Step ashore when ready.':'Arrived on the open sea.',moving:false});
        }else direction.multiplyScalar(1/3).clampLength(0,1);
      }
      const moved = interactive
        ? inBoat ? sailing.move(direction,dt,keys.has('ShiftLeft')||keys.has('ShiftRight'),environment.traffic.positions()) : walker.move(
            direction,
            dt,
            hasDestination || keys.has('ShiftLeft') || keys.has('ShiftRight'),
            movementBlend,
          )
        : 0;
      if (hasDestination && !guide.holdingDeparture) {
        if (moved < 0.0001) destinationStuckTime += dt;
        else destinationStuckTime = 0;
        if (destinationStuckTime > 0.9) {
          destinationRoute.length = 0;
          destination.set(NaN, NaN, NaN);
          destinationStuckTime = 0;
          guide.cancel();
          narratedJourney = false;
          setJourney({ name: 'Path blocked. Choose another spot or walk around it.', moving: false });
        }
      }
      if (inBoat) {
        const swell=oceanSample(sailing.position.x,sailing.position.z,simulationTime);
        walker.position.copy(sailing.position);walker.position.y=swell.height+.1;
        environment.boat.position.set(sailing.position.x,swell.height+.08,sailing.position.z);
        environment.boat.rotation.y=sailing.heading+Math.PI/2;
        environment.boat.rotation.x=Math.atan2(swell.normal.z,swell.normal.y)*.35;
        environment.boat.rotation.z=-Math.atan2(swell.normal.x,swell.normal.y)*.35;
      }
      const rowing=environment.rowing;
      const stroke=rowing.update(dt,inBoat && moved>.0001 && direction.lengthSq()>.001,keys.has('ShiftLeft')||keys.has('ShiftRight'));
      if(stroke)audio.current?.row();
      if(inBoat)player.setRowingTargets(rowing.leftHand,rowing.rightHand);
      change.copy(walker.position).sub(previousPosition);
      if(inBoat){
        const wave=oceanSample(sailing.position.x,sailing.position.z,simulationTime);
        player.root.rotation.x=Math.atan2(wave.normal.z,wave.normal.y)*.35;
        player.root.rotation.z=-Math.atan2(wave.normal.x,wave.normal.y)*.35;
      }else{player.root.rotation.x=0;player.root.rotation.z=0;}
      const previousVisualY = player.root.position.y;
      player.root.position.x = walker.position.x;
      player.root.position.z = walker.position.z;
      player.root.position.y = inBoat || motion.matches ? walker.position.y : THREE.MathUtils.damp(previousVisualY, walker.position.y, 22, dt);
      if(inBoat)player.root.position.copy(environment.boat.localToWorld(new THREE.Vector3(.25,.02,0)));
      change.y = player.root.position.y - previousVisualY;
      const facing = guide.facingCamera
        ? Math.atan2(walker.position.x-camera.position.x, walker.position.z-camera.position.z)
        : inBoat ? sailing.heading+Math.PI : walker.heading;
      const turn = Math.atan2(
        Math.sin(facing - player.root.rotation.y),
        Math.cos(facing - player.root.rotation.y),
      );
      player.root.rotation.y += motion.matches || inBoat
        ? turn
        : turn * (1-Math.exp(-dt*9));
      player.update(
        walker.distance,
        !inBoat && moved > 0.0001,
        dt,
        motion.matches,
        hasDestination,
        inBoat ? undefined : walkingHeight,
      );
      const towerDoor = environment.towerDoor;
      const towerDoorDistance = Math.hypot(
        walker.position.x - towerDoor.position.x,
        walker.position.z - towerDoor.position.z,
      );
      const towerDoorTarget = towerDoorDistance < 2.8 ? Math.PI * 0.38 : 0;
      towerDoor.userData.leaf.rotation.y = motion.matches
        ? towerDoorTarget
        : THREE.MathUtils.damp(
            towerDoor.userData.leaf.rotation.y,
            towerDoorTarget,
            7,
            dt,
          );
      const gateOpen = gateOpening(walker.position.x,walker.position.z);
      soundCues.update(simulationTime,moved,hasDestination || keys.has('ShiftLeft') || keys.has('ShiftRight'),inBoat,walker.position.x,walker.position.z,gateOpen);
      (environment.entranceGate.userData.leaves as THREE.Object3D[]).forEach(
          (leaf) => {
            const side = Number(leaf.userData.side) || 1;
            leaf.rotation.y = -side * gateOpen * Math.PI * 0.42;
          },
      );
      if (!overviewRef.current) {
        const desiredTarget = player.root.position.clone().add(new THREE.Vector3(0, 1.7, 0));
        camera.position.add(desiredTarget.clone().sub(controls.target));
        controls.target.copy(desiredTarget);
      }
      controls.enableDamping = !motion.matches;
      controls.update();
      if (!overviewRef.current && moved > 0.0001 && now > cameraManualUntil) {
        followBehind(camera, controls.target, Math.atan2(-change.x, -change.z), dt);
      }
      if (overviewRef.current !== wasOverview) {
        followOrbit.reset();
        if (overviewRef.current) {
          followOffset.copy(camera.position).sub(controls.target);
          controls.maxDistance = 600;
          const pose = referenceCameraPose('aerial', camera.aspect, camera.fov);
          controls.target.copy(pose.target);
          camera.position.copy(pose.position);
        } else {
          controls.maxDistance = 42;
          controls.target.copy(walker.position).add(new THREE.Vector3(0, 1.8, 0));
          camera.position.copy(controls.target).add(followOffset);
        }
        controls.update();
      }
      wasOverview = overviewRef.current;
      if (!overviewRef.current) {
        followOrbit.prepare(camera.position, controls.target, dt, now <= cameraManualUntil);
        walker.constrainCamera(camera.position, controls.target);
        environment.constrainShoreCamera(camera.position, controls.target);
        followOrbit.commit(camera.position, controls.target);
      }
      // Collision resolution is final; damping must not push the camera back
      // through a wall after its position has been constrained.
      camera.lookAt(controls.target);
      if (speechBubble.current) {
        bubblePosition.copy(player.root.position).add(new THREE.Vector3(0, 1.9, 0)).project(camera);
        const visible = bubblePosition.z > -1 && bubblePosition.z < 1 && Math.abs(bubblePosition.x) < 1 && Math.abs(bubblePosition.y) < 1;
        speechBubble.current.style.visibility = visible ? 'visible' : 'hidden';
        const inset = Math.min(150,host.clientWidth/2);
        speechBubble.current.style.left = `${THREE.MathUtils.clamp((bubblePosition.x*.5+.5)*host.clientWidth,inset,host.clientWidth-inset)}px`;
        speechBubble.current.style.top = `${Math.max(160,(-bubblePosition.y*.5+.5)*host.clientHeight-12)}px`;
      }
      if (walker.nearHouse !== wasNearHouse) {
        wasNearHouse = walker.nearHouse;
        setNearHouse(wasNearHouse);
      }
      const closeBoat=!inBoat && Math.hypot(walker.position.x-BOAT_DOCK.x,walker.position.z-BOAT_DOCK.z)<2.4;
      const docked=inBoat && Math.hypot(sailing.position.x-BOAT_MOORING.x,sailing.position.z-BOAT_MOORING.z)<2.5;
      if(closeBoat!==wasNearBoat){wasNearBoat=closeBoat;setNearBoat(closeBoat);}
      if(docked!==wasAtDock){wasAtDock=docked;setAtDock(docked);}
      environment.update(simulationTime, camera);
      companions.update(dt, player.root.position, !inBoat, motion.matches);
      apparition.update(simulationTime, camera, motion.matches);
      skillHolograms.update(simulationTime, camera, motion.matches, hallSettingsRef.current.mode === 'dark');
      renderer.render(scene, camera);
      if (!interactive && !contextFailed) {
        interactive = true;
        setReady(true);
      }
    };
    frame = requestAnimationFrame(loop);
    return () => {
      disposed = true;
      applyMode.current = () => {};
      clearInput();
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('pointercancel', pointerCancel);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      goToPlace.current = () => {};
      stopNavigation.current = () => {};
      touchMovement.current = () => {};
      performAvatarAction.current = () => {};
      waterAction.current = () => {};
      cameraCommand.current = () => {};
      requestHouse.current = () => {};
      house.dispose();
      companions.dispose(); apparition.dispose(); skillHolograms.dispose(); applySkills.current = () => {};
      contactInteraction.current = () => {}; applyProfile.current = () => {};
      houseInteract.current = () => {}; houseReturn.current = () => {};
      houseUpstairs.current = () => {}; applyHallSettings.current = () => {};
      applyProjects.current = () => {}; projectSelection.current = () => {};
      controls.dispose();
      environment.dispose();
      resources.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [startAtHouse, audio]);
  return (
    <main
      className="island-viewer walking-viewer"
      data-daylight={mode === 'day'}
      data-mode={mode}
      aria-label="Walk through Rakshith's 3D graveyard"
    >
      <div className="island-canvas" ref={mount} aria-hidden="true" />
      <header className="island-header">
        <div>
          <span>NOCTURNE.</span>
          <h1>{houseStatus ? houseStatus.room : 'Rakshith · The graveyard'}</h1>
        </div>
        <div className="island-toolbar">
          {houseStatus ? <fieldset className="island-modes" aria-label="House lighting mode">
            {(['day', 'dark'] as const).map(value => <Button key={value} variant="ghost" aria-pressed={hallSettings.mode === value} onClick={() => changeHallSettings({ mode: value })}>
              {value === 'day' ? <Sun /> : <Moon />}<span>{value}</span>
            </Button>)}
          </fieldset> : <fieldset className="island-modes" aria-label="Island atmosphere">
            {ISLAND_MODES.map(value => <Button key={value} variant="ghost" aria-pressed={mode === value} aria-label={`${value[0].toUpperCase() + value.slice(1)} atmosphere`} onClick={() => changeMode(value)}>
              {value === 'day' ? <Sun /> : value === 'winter' ? <Snowflake /> : <Moon />}
              <span>{value}</span>
            </Button>)}
          </fieldset>}
          <div className="island-toolbar-actions">
          {(nearHouse || houseStatus) && <Button className="island-portfolio-link" variant="ghost" onClick={() => showContact(true)}>About & contact</Button>}
          {houseStatus && <Button className="island-portfolio-link" variant="ghost" aria-pressed={hallSettings.lights} aria-label="House lights" onClick={() => changeHallSettings({ lights: !hallSettings.lights })}><Lightbulb />Lights {hallSettings.lights ? 'on' : 'off'}</Button>}
          {houseStatus && onPortfolio && <Button className="island-portfolio-link" variant="ghost" onClick={onPortfolio}>View my work</Button>}
          {onExit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onExit}
              aria-label="Back to the landing page"
            >
              <ArrowLeft />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVoice}
            disabled={!ready || failed || !!houseStatus}
            aria-label={listening ? 'Stop voice command' : 'Start voice command'}
            aria-pressed={listening}
            title="Voice command"
          >
            {listening ? <Mic /> : <MicOff />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              overviewRef.current = !overviewRef.current;
              setOverview(overviewRef.current);
            }}
            disabled={!!houseStatus}
            aria-label={overview ? 'Return to close camera' : 'View the whole island'}
            aria-pressed={overview}
          >
            <Maximize2 />
          </Button>
          </div>
        </div>
      </header>
      {(!ready || failed) && (
        <div className="island-loading">
          <span className="arrival-eyebrow">NOCTURNE · THE CROSSING</span>
          <h2>
            {failed ? 'The graveyard could not open.' : 'Beyond the gates.'}
          </h2>
          <p>
            {failed
              ? 'This browser could not start the 3D scene.'
              : 'Preparing your character, the path, and the storm.'}
          </p>
          {!failed && <span className="arrival-progress" aria-hidden="true" />}
          {failed && (
            <Button variant="outline" onClick={() => window.location.reload()}>
              Try again
            </Button>
          )}
          {onExit && (
            <Button variant="ghost" onClick={onExit}>
              Back to the landing page
            </Button>
          )}
        </div>
      )}
      {audioError && (
        <output className="island-audio-note">
          Sound could not start. You can still walk and explore.
        </output>
      )}
      {speechText && <output className="island-speech-bubble" ref={speechBubble}>{speechText}</output>}
      {!houseStatus && (journey || voiceNotice || nearHouse || nearBoat || boatMode) && <div className="walk-objective" aria-live="polite">
        {journey && (!journey.moving || journey.planning) && <p>{journey.name}</p>}
        {voiceNotice && <output className="voice-feedback">{voiceNotice}</output>}
        {journey?.moving && (
          <Button variant="outline" onClick={() => stopNavigation.current()}>
            <Square /> Stop travelling <kbd>Esc</kbd>
          </Button>
        )}
        {nearBoat && <Button variant="outline" onClick={() => waterAction.current('board')}>Board the boat <kbd>E</kbd></Button>}
        {boatMode && <>
          <Button variant="outline" onClick={() => waterAction.current('return')}>Return to dock</Button>
          {atDock && <Button variant="outline" onClick={() => waterAction.current('leaveBoat')}>Step ashore <kbd>E</kbd></Button>}
        </>}
        {nearHouse && !boatMode && (
          <Button
            variant="outline"
            onClick={() => requestHouse.current()}
            className="island-enter-house"
            disabled={!ready || failed || enteringHouse}
          >
            <DoorOpen /> {enteringHouse ? 'Opening the front door…' : 'Enter the house'} <kbd>E</kbd>
          </Button>
        )}
      </div>}
      {houseStatus && <div className="walk-objective house-exploration-status" aria-live="polite">
        {houseStatus.skillsRoom && <>
          <Button variant="outline" onClick={() => showSkills(true, skills[0]?.id ?? null)}>{canEditProjects ? 'Edit floating skills' : 'Explore skills'}</Button>
          {skills.length > SKILLS_PER_PAGE && <nav className="hall-collection-controls" aria-label="Skill card pages"><Button variant="ghost" disabled={skillsPage === 0} aria-label="Previous skill cards" onClick={() => changeSkillsPage(skillsPage - 1)}><ArrowLeft /></Button><output>Cards {skillsPage + 1} / {Math.ceil(skills.length / SKILLS_PER_PAGE)}</output><Button variant="ghost" disabled={skillsPage >= Math.ceil(skills.length / SKILLS_PER_PAGE) - 1} aria-label="Next skill cards" onClick={() => changeSkillsPage(skillsPage + 1)}><ArrowRight /></Button></nav>}
        </>}
        {!houseStatus.masterHall && <Button className="hall-contact-trigger" variant="outline" onClick={() => showContact(true)}>Activate hologram</Button>}
        <p>{voiceNotice || houseStatus.detail}</p>
        {houseStatus.door && <Button variant="outline" onClick={() => houseInteract.current()} disabled={houseStatus.open && houseStatus.door !== 'Front door'}><DoorOpen />{houseStatus.door === 'Front door' ? 'Walk outside' : houseStatus.open ? 'Door open - walk through' : `Open ${houseStatus.door.toLowerCase()}`}<kbd>E</kbd></Button>}
        {houseStatus.travelling ? <Button variant="ghost" onClick={() => stopNavigation.current()}>Stop walking</Button> : <Button variant="ghost" onClick={() => houseReturn.current()}>Walk to the front door</Button>}
        {!houseStatus.masterHall && !houseStatus.travelling && <Button variant="ghost" onClick={() => houseUpstairs.current()}>Walk to the master hall</Button>}
        {!houseStatus.masterHall && !houseStatus.skillsRoom && !houseStatus.travelling && <Button variant="ghost" onClick={() => houseSkills.current()}>Walk to skills gallery</Button>}
        {houseStatus.masterHall && <>
          <Button variant="outline" onClick={() => chooseProject(hallProjectPage(projects, galleryPage)[0].id)}>{canEditProjects ? 'Edit glass frames' : 'Explore projects'}</Button>
          {hallPageCount(projects) > 1 && <nav className="hall-collection-controls" aria-label="Hall collection pages">
            <Button variant="ghost" aria-label="Previous hall collection" disabled={galleryPage === 0} onClick={() => changeGalleryPage(galleryPage - 1)}><ArrowLeft /></Button>
            <output aria-live="polite">Collection {galleryPage + 1} / {hallPageCount(projects)}</output>
            <Button variant="ghost" aria-label="Next hall collection" disabled={galleryPage >= hallPageCount(projects) - 1} onClick={() => changeGalleryPage(galleryPage + 1)}><ArrowRight /></Button>
          </nav>}
        </>}
      </div>}
      {selectedProject && <HallProjectDialog project={projects.find(project => project.id === selectedProject)!} projects={projects} canEdit={canEditProjects} onAdd={addProject} onSelect={chooseProject} onSave={saveProject} onImportDrafts={importProjectDrafts} onClose={() => chooseProject(null)} />}
      {contactOpen && <ContactApparitionDialog profile={profile} canEdit={canEditProjects} onSave={saveProfile} onClose={() => showContact(false)} />}
      {skillsOpen && <SkillGalleryDialog skills={skills} selected={selectedSkill} canEdit={canEditProjects} onSelect={selectSkill} onSave={saveSkill} onClose={() => showSkills(false)} />}
      {!houseStatus && <nav className="island-destinations" aria-label="Island destinations">
        <Button
          variant="ghost"
          size="sm"
          className="island-destinations-toggle"
          aria-expanded={destinationsOpen}
          aria-controls="island-places"
          disabled={!ready || failed}
          onClick={() => setDestinationsOpen((open) => !open)}
        >
          Places
        </Button>
        {destinationsOpen && (
          <div id="island-places" className="island-destinations-menu">
            {menuPlaces
              .map((place) => (
                <Button
                  key={place.id}
                  variant="ghost"
                  size="sm"
                  disabled={!ready || failed}
                  onClick={() => goToPlace.current(place.id)}
                >
                  {place.name}
                </Button>
              ))}
          </div>
        )}
      </nav>}
      <footer className="walk-controls">
        <div className="walk-help">
          <p>
            <kbd>W A S D</kbd> or <kbd>↑ ← ↓ →</kbd> to {boatMode ? 'sail' : 'walk'}
          </p>
          <span>{houseStatus ? 'Tap the floor or stairs to walk. Tap a door or press E. Drag to look.' : boatMode ? 'Hold arrows or tap open water to row. Shift for stronger strokes.' : 'Tap the ground or choose a place. Drag to look. Shift to run.'}</span>
        </div>
        <fieldset className="walk-pad" aria-label={boatMode ? "Sailing controls" : "Walking controls"}>
          {[
            { key: 'KeyW', label: 'Walk forward', style: 'walk-forward', Icon: ArrowUp },
            { key: 'KeyA', label: 'Walk left', style: 'walk-left', Icon: ArrowLeft },
            { key: 'KeyS', label: 'Walk backward', style: 'walk-back', Icon: ArrowDown },
            { key: 'KeyD', label: 'Walk right', style: 'walk-right', Icon: ArrowRight },
          ].map(({ key, label, style, Icon }) => (
            <Button key={key} variant="ghost" className={style} aria-label={boatMode ? label.replace("Walk", "Sail") : label}
              disabled={!ready || failed}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                touchMovement.current(key, true);
              }}
              onPointerUp={() => touchMovement.current(key, false)}
              onPointerCancel={() => touchMovement.current(key, false)}
              onLostPointerCapture={() => touchMovement.current(key, false)}
              onKeyDown={(event) => {
                if (event.code === 'Space' || event.code === 'Enter') {
                  event.preventDefault();
                  touchMovement.current(key, true);
                }
              }}
              onKeyUp={() => touchMovement.current(key, false)}
              onBlur={() => touchMovement.current(key, false)}
            ><Icon /></Button>
          ))}
        </fieldset>
        <p className="walk-touch-hint">Hold arrows to {boatMode ? "sail" : "walk"}. Drag the scene to look around.</p>
      </footer>
    </main>
  );
}
