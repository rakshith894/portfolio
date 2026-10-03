'use client';

export { preloadIslandAssets } from '@/lib/island-preload';

import {
  createSailingController,
  seaRoute,
  type SeaPoint,
} from '@/lib/island-sailing';
import { oceanSample } from '@/lib/island-motion';
import { islandMode, ISLAND_MODES, type IslandMode } from '@/lib/island-mode';
import { BOAT_DOCK, BOAT_MOORING } from '@/lib/island-stairs';
import {
  createHouseExploration,
  type HouseStatus,
} from '@/lib/house-exploration';
import {
  DEFAULT_HALL_SETTINGS,
  hallLighting,
  type HallSettings,
} from '@/lib/master-hall';
import {
  HALL_PROJECT_KEY,
  readHallProjects,
  hallProjectPage,
  hallPageCount,
  HALL_PAGE_SIZE,
  type HallFrameId,
  type HallProject,
} from '@/lib/hall-projects';
import { HallProjectDialog } from '@/components/hall-project-dialog';
import savedProjects from '@/content/hall-projects.json';
import savedProfile from '@/content/profile.json';
import { type ContactProfile } from '@/lib/contact-profile';
import { ContactApparitionDialog } from '@/components/contact-apparition-dialog';
import { createContactApparition } from '@/lib/contact-apparition';
import { createSkillHolograms } from '@/lib/skill-holograms';
import { readSkills, type GallerySkill } from '@/lib/skill-gallery';
import { SkillGalleryDialog } from '@/components/skill-gallery-dialog';
import {
  IslandChatWidget,
  type AssistantHandle,
} from '@/components/island-chat-widget';
import type { AssistantAction } from '@/lib/portfolio-assistant';

import savedSkills from '@/content/skills.json';
import {
  createPortfolioTour,
  portfolioStops,
  type TourStatus,
  type TourStop,
} from '@/lib/portfolio-tour';
import { createCoffinCompanions } from '@/lib/coffin-companions';
import {
  createTravelDirection,
  createFollowOrbit,
  followBehind,
} from '@/lib/chase-camera';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  DoorOpen,
  Mic,
  Sun,
  Moon,
  Snowflake,
  Lightbulb,
  FolderGit2,
  Sparkles,
  Compass,
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
  speakIsland,
  setNarrationEnabled,
  chooseMaleVoice,
  stopIslandSpeech,
  type PlaceId,
} from '@/lib/island-commands';

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
  guided = false,
}: {
  ambience: RefObject<ReturnType<typeof createAmbience> | null>;
  audioError: boolean;
  onExit?: () => void;
  onPortfolio?: () => void;
  active?: boolean;
  startAtHouse?: boolean;
  guided?: boolean;
}) {
  const [tourStatus, setTourStatus] = useState<TourStatus>(null);
  const tourControl = useRef<ReturnType<typeof createPortfolioTour> | null>(
    null,
  );
  const guidedRef = useRef(guided);
  const mount = useRef<HTMLDivElement>(null);
  const activeScene = useRef(active);
  const [mode, setMode] = useState<IslandMode>(() => {
    try {
      return islandMode(
        localStorage.getItem('nocturne-mode') ??
          localStorage.getItem('nocturne-daylight'),
      );
    } catch {
      return 'night';
    }
  });
  const modeRef = useRef(mode);
  const applyMode = useRef<(mode: IslandMode) => void>(() => {});
  function changeMode(value: IslandMode) {
    modeRef.current = value;
    setMode(value);
    applyMode.current(value);
    try {
      localStorage.setItem('nocturne-mode', value);
    } catch {}
  }
  const speechBubble = useRef<HTMLOutputElement>(null);
  const welcomeStarted = useRef(false);
  const goToPlace = useRef<(id: PlaceId) => void>(() => {});
  const stopNavigation = useRef<() => void>(() => {});
  const touchMovement = useRef<(key: string, active: boolean) => void>(
    () => {},
  );
  const performAvatarAction = useRef<
    (action: 'jump' | 'sit' | 'dance' | 'wave') => void
  >(() => {});
  const waterAction = useRef<
    (action: 'board' | 'leaveBoat' | 'swim' | 'return') => void
  >(() => {});
  const cameraCommand = useRef<
    (action: 'overview' | 'zoomIn' | 'zoomOut') => void
  >(() => {});
  const assistant = useRef<AssistantHandle | null>(null);
  const [houseStatus, setHouseStatus] = useState<HouseStatus>(null);
  const localEditor = process.env.NODE_ENV === 'development';
  const [adminMode, setAdminMode] = useState(localEditor);
  const canEditProjects = localEditor && adminMode;
  function toggleAdminMode() {
    if (localEditor) setAdminMode((value) => !value);
  }
  // Ctrl+Shift+A — toggle admin / guest-preview mode (local editor only)
  useEffect(() => {
    if (!localEditor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyA' && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setAdminMode((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [localEditor]);
  const [profile, setProfile] = useState<ContactProfile>(savedProfile);
  const profileRef = useRef(profile);
  const [contactOpen, setContactOpen] = useState(false);
  const contactOpenRef = useRef(false);
  const [skills, setSkills] = useState<GallerySkill[]>(() =>
    readSkills(savedSkills),
  );
  const skillsRef = useRef(skills),
    skillsOpenRef = useRef(false);
  const [skillsOpen, setSkillsOpen] = useState(false),
    [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const applySkills = useRef<(skills: GallerySkill[]) => void>(() => {});
  function showSkills(open: boolean, id: string | null = null) {
    if (open) tourControl.current?.stop();
    skillsOpenRef.current = open;
    setSkillsOpen(open);
    setSelectedSkill(id);
    contactInteraction.current(open);
  }
  function selectSkill(id: string | null) {
    setSelectedSkill(id);
  }
  async function saveSkill(
    skill: GallerySkill,
    remove = false,
  ): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    let next: GallerySkill[];
    if (remove) {
      next = skillsRef.current.filter((s) => s.id !== skill.id);
    } else {
      const exists = skillsRef.current.some((s) => s.id === skill.id);
      if (exists) {
        next = skillsRef.current.map((s) => (s.id === skill.id ? skill : s));
      } else {
        next = [...skillsRef.current, skill];
      }
    }

    try {
      const response = await fetch('/__nocturne/skills', {
        method: remove ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skill),
      });
      const result = (await response.json()) as {
        skills?: unknown;
        error?: string;
      };
      if (!response.ok || !result.skills)
        return result.error || 'Could not save skills to the project.';
      next = readSkills(result.skills);
    } catch {
      return 'Local editor unavailable. Start the development server to save skills.';
    }
    skillsRef.current = next;
    setSkills(next);
    applySkills.current(next);
    setSelectedSkill(remove ? (next[0]?.id ?? null) : skill.id);
    return null;
  }
  const contactInteraction = useRef<(open: boolean) => void>(() => {});
  const applyProfile = useRef<(profile: ContactProfile) => void>(() => {});
  function showContact(open: boolean) {
    if (open) tourControl.current?.stop();
    contactOpenRef.current = open;
    setContactOpen(open);
    contactInteraction.current(open);
  }
  function saveProfile(value: ContactProfile) {
    profileRef.current = value;
    setProfile(value);
    applyProfile.current(value);
  }
  const [projects, setProjects] = useState<HallProject[]>(() =>
    readHallProjects(JSON.stringify(savedProjects)),
  );
  const projectsRef = useRef(projects);
  const [galleryPage, setGalleryPage] = useState(0);
  const galleryPageRef = useRef(0);
  const applyProjects = useRef<(projects: HallProject[]) => void>(() => {});
  function changeGalleryPage(page: number) {
    const next = Math.max(
      0,
      Math.min(hallPageCount(projectsRef.current) - 1, page),
    );
    galleryPageRef.current = next;
    setGalleryPage(next);
    applyProjects.current(hallProjectPage(projectsRef.current, next));
  }
  const [frameBusy, setFrameBusy] = useState(false);
  const frameMutation = useRef(false);
  const [_frameNotice, setFrameNotice] = useState('');
  function updateProjectCollection(next: HallProject[]) {
    projectsRef.current = next;
    setProjects(next);
    changeGalleryPage(galleryPageRef.current);
  }
  async function addProject(): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    if (frameMutation.current)
      return 'Wait for the current frame change to finish.';
    frameMutation.current = true;
    setFrameBusy(true);
    setFrameNotice('');
    try {
      let created: HallProject | null = null;
      let nextProjects: HallProject[] = [];
      try {
        const response = await fetch('/__nocturne/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create' }),
        });
        const result = (await response.json()) as {
          projects?: unknown;
          project?: HallProject;
          error?: string;
        };
        if (response.ok && result.project) {
          created = result.project;
          nextProjects = readHallProjects(JSON.stringify(result.projects));
        }
      } catch {}

      if (!created) {
        throw new Error(
          'Could not save the frame. Check the local development server.',
        );
      }

      updateProjectCollection(nextProjects);
      chooseProject(created.id);
      return null;
    } catch (problem) {
      const message =
        problem instanceof Error ? problem.message : 'Could not add a frame.';
      setFrameNotice(message);
      return message;
    } finally {
      frameMutation.current = false;
      setFrameBusy(false);
    }
  }
  async function removeProject(project: HallProject): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    if (frameMutation.current)
      return 'Wait for the current frame change to finish.';
    frameMutation.current = true;
    setFrameBusy(true);
    setFrameNotice('');
    try {
      const index = projectsRef.current.findIndex(
        (current) => current.id === project.id,
      );
      let next: HallProject[] = projectsRef.current.filter(
        (current) => current.id !== project.id,
      );

      try {
        const response = await fetch('/__nocturne/projects', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: project.id }),
        });
        const result = (await response.json()) as {
          projects?: unknown;
          error?: string;
        };
        if (!response.ok || !result.projects)
          return result.error || 'Could not remove the frame.';
        next = readHallProjects(JSON.stringify(result.projects));
      } catch {
        return 'Local editor unavailable. Frame was not removed.';
      }

      updateProjectCollection(next);
      chooseProject(
        next[Math.min(Math.max(index, 0), next.length - 1)]?.id ?? null,
      );
      return null;
    } finally {
      frameMutation.current = false;
      setFrameBusy(false);
    }
  }
  const [selectedProject, setSelectedProject] = useState<HallFrameId | null>(
    null,
  );
  const selectedProjectRef = useRef<HallFrameId | null>(null);
  const projectSelection = useRef<(id: HallFrameId | null) => void>(() => {});
  function chooseProject(id: HallFrameId | null) {
    if (id) tourControl.current?.stop();
    if (id)
      changeGalleryPage(
        Math.floor(
          projectsRef.current.findIndex((project) => project.id === id) /
            HALL_PAGE_SIZE,
        ),
      );
    selectedProjectRef.current = id;
    setSelectedProject(id);
    projectSelection.current(id);
  }
  async function saveProject(project: HallProject): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    let next: HallProject[] = projectsRef.current.map((current) =>
      current.id === project.id ? project : current,
    );
    try {
      const response = await fetch('/__nocturne/projects', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      const result = (await response.json()) as {
        error?: string;
        projects?: unknown;
      };
      if (!response.ok || !result.projects)
        return result.error || 'Could not save the project.';
      next = readHallProjects(JSON.stringify(result.projects));
    } catch {
      return 'Local editor unavailable. Project was not saved.';
    }

    updateProjectCollection(next);
    return null;
  }
  async function importProjectDrafts(): Promise<string | null> {
    if (!canEditProjects) return 'This portfolio is view-only.';
    let drafts: HallProject[];
    try {
      drafts = readHallProjects(localStorage.getItem(HALL_PROJECT_KEY));
    } catch {
      return 'This browser could not read your old drafts.';
    }
    const missing = drafts.filter(
      (draft) =>
        draft.url &&
        !projectsRef.current.find((project) => project.id === draft.id)?.url,
    );
    if (!missing.length)
      return 'No browser drafts were found for empty frames. Try the browser and local address where you originally saved them.';
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
  const houseEnterRoom = useRef<
    (room: 'skills' | 'projects' | 'entrance') => void
  >(() => {});
  const assistantTargetRef = useRef<'skills' | 'projects' | 'entrance' | null>(
    null,
  );
  const [hallSettings, setHallSettings] = useState<HallSettings>(
    DEFAULT_HALL_SETTINGS,
  );
  const hallSettingsRef = useRef(hallSettings);
  const applyHallSettings = useRef<(settings: HallSettings) => void>(() => {});
  function changeHallSettings(change: Partial<HallSettings>) {
    const settings = { ...hallSettingsRef.current, ...change };
    hallSettingsRef.current = settings;
    setHallSettings(settings);
    applyHallSettings.current(settings);
  }
  const requestHouse = useRef<() => void>(() => {});
  const [_enteringHouse, setEnteringHouse] = useState(false);
  const overviewRef = useRef(false);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [boatMode, setBoatMode] = useState(false);
  const [nearBoat, setNearBoat] = useState(false);
  const [atDock, setAtDock] = useState(false);
  const [_overview, setOverview] = useState(false);
  const [_nearHouse, setNearHouse] = useState(false);
  const [destinationsOpen, setDestinationsOpen] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState('');
  const [speechText, setSpeechText] = useState('');
  const [narration, setNarration] = useState(() => {
    try {
      return localStorage.getItem('nocturne-narration') !== 'off';
    } catch {
      return true;
    }
  });
  useEffect(() => {
    setNarrationEnabled(narration);
  }, [narration]);
  function _toggleNarration() {
    const enabled = !narration;
    setNarration(enabled);
    setNarrationEnabled(enabled);
    try {
      localStorage.setItem('nocturne-narration', enabled ? 'on' : 'off');
    } catch {}
  }
  const [journey, setJourney] = useState<{
    name: string;
    moving: boolean;
    planning?: boolean;
  } | null>(null);
  useEffect(() => {
    if (!journey || journey.moving) return;
    const timer = window.setTimeout(() => setJourney(null), 2000);
    return () => window.clearTimeout(timer);
  }, [journey]);
  useEffect(() => {
    if (!voiceNotice) return;
    const timer = window.setTimeout(() => setVoiceNotice(''), 6000);
    return () => window.clearTimeout(timer);
  }, [voiceNotice]);
  useEffect(() => {
    activeScene.current = active;
    if (!active) stopNavigation.current();
  }, [active]);
  useEffect(() => {
    if (!ready || welcomeStarted.current) return;
    welcomeStarted.current = true;
    if (guidedRef.current) {
      tourControl.current?.start();
      return;
    }
    speakIsland(
      'Welcome to the island, traveller. Follow the lanterns to Rakshith Manor.',
    );
  }, [ready]);
  useEffect(() => () => stopIslandSpeech(), []);
  function toggleVoice() {
    assistant.current?.startVoice();
  }
  function assistantAction(action: AssistantAction): string | void {
    if (!ready)
      return 'The island is still loading. Please try again when it is ready.';
    if (action.type === 'show') {
      showContact(false);
      showSkills(false);
      chooseProject(null);
      tourControl.current?.stop();
      if (action.target === 'skills') {
        if (!houseStatus?.inside) {
          houseEnterRoom.current('skills');
          return 'Walking inside to the Skills Room.';
        }
        if (houseStatus.inside && !houseStatus.skillsRoom) {
          houseSkills.current();
          return 'Walking into the Skills Room.';
        }
        showSkills(true);
        return 'Skills opened.';
      }
      if (action.target === 'projects') {
        if (!houseStatus?.inside) {
          houseEnterRoom.current('projects');
          return 'Walking inside to the Projects Gallery.';
        }
        if (houseStatus.inside && !houseStatus.masterHall) {
          houseUpstairs.current();
          return 'Walking upstairs to the Projects Gallery.';
        }
        const first = projectsRef.current.find((project) => project.url);
        if (first) {
          chooseProject(first.id);
          return 'Projects opened. Use the gallery controls to browse the collection.';
        }
        return 'No projects have been published yet.';
      }
      if (action.target === 'portfolio') {
        onPortfolio?.();
        return 'Quick portfolio opened.';
      }
      showContact(true);
      return action.target === 'resume'
        ? profileRef.current.resume
          ? 'About and contact opened. Select View résumé to open the PDF.'
          : 'No résumé has been published yet.'
        : 'About and contact opened.';
    }
    if (action.type === 'tour') {
      assistantTargetRef.current = null;
      if (action.target === 'start') {
        showContact(false);
        showSkills(false);
        chooseProject(null);
        tourControl.current?.start();
      } else if (action.target === 'pause') tourControl.current?.pause();
      else if (action.target === 'stop') tourControl.current?.stop();
      else if (!tourControl.current?.active)
        return 'Start a guided tour first.';
      else if (action.target === 'next') tourControl.current?.next();
      else tourControl.current?.replay();
      return;
    }
    if (action.type === 'mode') {
      changeMode(action.target);
      return;
    }
    if (action.type === 'navigate') {
      assistantTargetRef.current = null;
      tourControl.current?.stop();
      goToPlace.current(action.target);
      return;
    }
    if (action.type === 'animate') {
      tourControl.current?.stop();
      performAvatarAction.current(action.target);
      return;
    }
    if (action.type === 'control') {
      if (action.target === 'stop') {
        assistantTargetRef.current = null;
        stopIslandSpeech();
        stopNavigation.current();
        return;
      }
      tourControl.current?.stop();
      if (action.target === 'overview') cameraCommand.current('overview');
      else if (action.target === 'skillsRoom') {
        if (houseStatus?.skillsRoom) return 'You are in the Skills Room.';
        houseEnterRoom.current('skills');
        return houseStatus?.inside
          ? 'Walking into the Skills Room.'
          : 'Walking to the manor and heading inside to the Skills Room.';
      } else if (action.target === 'projectsRoom') {
        if (houseStatus?.masterHall) return 'You are in the Projects Gallery.';
        houseEnterRoom.current('projects');
        return houseStatus?.inside
          ? 'Walking upstairs to the Projects Gallery.'
          : 'Walking to the manor and heading upstairs to the Projects Gallery.';
      } else if (action.target === 'enter') {
        if (houseStatus?.inside) return 'You are already inside the manor.';
        houseEnterRoom.current('entrance');
        return 'Heading inside the manor.';
      } else if (action.target === 'exit') {
        assistantTargetRef.current = null;
        if (!houseStatus) return 'You are already outside the manor.';
        houseReturn.current();
      } else {
        if (action.target === 'board' && !nearBoat)
          return 'Go to the boat landing before boarding.';
        if (action.target === 'leaveBoat' && !boatMode)
          return 'You are not in the boat.';
        waterAction.current(action.target);
      }
    }
  }
  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    // Scene recreation (including live edits) must not retain prompts from the
    // previous avatar position or keep touch input enabled during loading.
    setReady(false);
    setFailed(false);
    setNearHouse(false);
    setNearBoat(false);
    setAtDock(false);
    setBoatMode(false);
    setHouseStatus(null);
    setEnteringHouse(false);
    setJourney(null);
    setDestinationsOpen(false);
    overviewRef.current = false;
    setOverview(false);
    const mobile = matchMedia('(max-width:700px), (pointer:coarse)').matches;
    const motion = {
      get matches() {
        return document.documentElement.dataset.liveEffects === 'off';
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    } as unknown as MediaQueryList; // Follow the visitor's live-effects preference.
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
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 2.0));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = true;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0f16');
    scene.fog = new THREE.FogExp2('#1e2830', 0.0025);
    const walker = createIslandWalker(mobile, startAtHouse, false);
    const destinationRoute: THREE.Vector3[] = [];
    let navigationRequest = 0;
    let cameraManualUntil = 0;
    const travelDirection = createTravelDirection();
    const followOrbit = createFollowOrbit();
    const navigator = createIslandNavigator(
      walker.canStand,
      walker.canTraverse,
    );
    const touchKeys = new Set<string>();
    const sailing = createSailingController();
    let seaPath: SeaPoint[] = [];
    let inBoat = false,
      wasNearBoat = false,
      wasAtDock = false;
    let journeyName = '';
    let narratedJourney = false;
    const guide = createJourneyGuide(
      (text, onEnd) =>
        speakIsland(text, {
          onEnd,
          rate: 1.05,
          onUnavailable: () =>
            setVoiceNotice(
              'No male narration voice is installed. Journey captions are still available.',
            ),
        }),
      stopIslandSpeech,
      setSpeechText,
    );
    const bubblePosition = new THREE.Vector3();
    const navigateTo = async (
      point: { x: number; z: number },
      name: string,
      narrate = false,
    ) => {
      if (inBoat) {
        setDestinationsOpen(false);
        setVoiceNotice('Return to the dock before visiting island places.');
        return;
      }
      guide.cancel();
      narratedJourney = narrate;
      const request = ++navigationRequest;
      keys.clear();
      touchKeys.clear();
      destinationRoute.length = 0;
      destination.set(NaN, NaN, NaN);
      destinationStuckTime = 0;
      setDestinationsOpen(false);
      const route = await navigator.routeAsync(
        walker.position.clone(),
        point,
        2.5,
        () => disposed || request !== navigationRequest,
        name === 'the selected spot',
      );
      if (disposed || request !== navigationRequest) return;
      if (!route?.length) {
        setJourney(null);
        setVoiceNotice(
          'That spot is blocked. Try clicking on open ground nearby, or use Places.',
        );
        return;
      }
      journeyName = name;
      destination.copy(route[0]);
      destinationRoute.push(...route.slice(1));
      setJourney(null);
      if (narrate) guide.announce('departure', name);
    };
    goToPlace.current = (id) => {
      tourControl.current?.stop();
      const place = islandPlaces.find((entry) => entry.id === id);
      if (!place) return;
      // The watchtower destination is its accessible upper platform.
      void navigateTo(
        id === 'tower' ? { x: -52, z: -31 } : place,
        place.name,
        true,
      );
    };
    const player = createIslandAvatar(resources, mobile);
    let avatarReady = false;
    void player.ready.then(() => {
      if (disposed) return;
      // The articulated fallback keeps slow or failed model downloads from blocking entry.
      avatarReady = true;
    });
    const soundCues = createIslandSoundCues({
      step: (...args) => audio.current?.step(...args),
      gate: () => audio.current?.gate(),
      ghost: (...args) => {
        if (modeRef.current === 'night') audio.current?.ghost(...args);
      },
      bell: (...args) => audio.current?.bell(...args),
      thunder: () => {
        if (modeRef.current === 'night') audio.current?.thunder();
      },
    });
    performAvatarAction.current = player.perform;
    player.root.position.copy(walker.position);
    player.root.rotation.y = walker.heading;
    scene.add(player.root);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.12, 1600);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = true;
    controls.enableRotate = true;
    controls.enableDamping = false;
    controls.dampingFactor = 0.09;
    controls.enablePan = false;
    // Keep all zoom input in the collision-aware orbit, including touch pinch.
    controls.enableZoom = false;
    // The normal zoom limit is applied below; collisions may shorten the orbit.
    controls.minDistance = 0.4;
    controls.maxDistance = 42;
    controls.minPolarAngle = Math.PI * 0.04;
    controls.maxPolarAngle = Math.PI * 0.60;
    controls.addEventListener('start', () => {
      cameraManualUntil = Infinity;
    });
    controls.addEventListener('end', () => {
      cameraManualUntil = performance.now() + 500;
    });
    // OrbitControls fires 'start'/'end' only for mouse-drag orbits — scroll-wheel
    // zoom never triggers those events, so manualCamera() stays false and the
    // viewDistance update inside house-exploration is never reached, making
    // constrainCamera reset the camera distance every frame (zoom is invisible).
    const wheelZoom = (event: WheelEvent) => {
      event.preventDefault();
      cameraManualUntil = Math.max(cameraManualUntil, performance.now() + 600);
      const factor = event.deltaY < 0 ? 0.88 : 1.14;
      if (overviewRef.current) {
        camera.position
          .sub(controls.target)
          .multiplyScalar(factor)
          .add(controls.target);
      } else if (house.inside) {
        house.zoom(factor);
      } else {
        followOrbit.zoom(factor);
      }
    };
    renderer.domElement.addEventListener('wheel', wheelZoom, {
      passive: false,
    });
    cameraCommand.current = (action) => {
      if (action === 'overview') {
        overviewRef.current = !overviewRef.current;
        setOverview(overviewRef.current);
      } else {
        const factor = action === 'zoomIn' ? 0.75 : 1.3;
        if (house.inside) {
          house.zoom(factor);
        } else {
          followOrbit.zoom(factor);
          const offset = camera.position
            .clone()
            .sub(controls.target)
            .multiplyScalar(factor);
          camera.position.copy(controls.target).add(offset);
          controls.update();
        }
      }
    };
    waterAction.current = (action) => {
      if (!interactive) return;
      if (action === 'return' && inBoat) {
        const route = seaRoute(sailing.position);
        if (route) {
          clearInput();
          seaPath = route;
          setJourney({ name: 'Returning to the dock', moving: true });
        } else
          setVoiceNotice(
            'Steer away from the shore, then try returning again.',
          );
        return;
      }
      if (action === 'swim') {
        goToPlace.current('boat');
        return;
      }
      if (action === 'board') {
        if (inBoat) return;
        if (
          Math.hypot(
            walker.position.x - BOAT_DOCK.x,
            walker.position.z - BOAT_DOCK.z,
          ) > 2.4
        ) {
          goToPlace.current('boat');
          return;
        }
        clearInput();
        inBoat = true;
        setBoatMode(true);
        player.setSeated(true);
        sailing.position.set(
          environment.boat.position.x,
          0,
          environment.boat.position.z,
        );
        sailing.stop();
        walker.position.copy(sailing.position);
        walker.position.y = environment.boat.position.y;
        player.root.position.copy(walker.position);
        overviewRef.current = false;
        setOverview(false);
        controls.maxDistance = 42;
        controls.target.copy(walker.position).add(new THREE.Vector3(0, 1.5, 0));
        camera.position
          .copy(controls.target)
          .add(new THREE.Vector3(5, 4, mobile ? -12 : -9));
        controls.update();
        setVoiceNotice(
          'Use WASD or the arrows to sail. Hold Shift for speed. Return to dock brings you home.',
        );
      } else if (action === 'leaveBoat' && inBoat) {
        if (
          Math.hypot(
            sailing.position.x - BOAT_MOORING.x,
            sailing.position.z - BOAT_MOORING.z,
          ) > 2.5
        ) {
          setVoiceNotice('Return to the dock to step ashore.');
          return;
        }
        clearInput();
        inBoat = false;
        setBoatMode(false);
        player.setSeated(false);
        sailing.stop();
        walker.position.set(
          BOAT_DOCK.x,
          walkingHeight(BOAT_DOCK.x, BOAT_DOCK.z),
          BOAT_DOCK.z,
        );
        player.root.position.copy(walker.position);
        environment.boat.position.set(BOAT_MOORING.x, 0, BOAT_MOORING.z);
        environment.boat.rotation.y = 0;
        controls.target.copy(walker.position).add(new THREE.Vector3(0, 1.8, 0));
        camera.position.copy(controls.target).add(new THREE.Vector3(5, 4, -9));
        controls.update();
        setVoiceNotice('Back at the dock. Follow the stairs to the island.');
      }
    };
    controls.target.copy(walker.position).add(new THREE.Vector3(0, 2.8, -2));
    camera.position.copy(walker.position).add(new THREE.Vector3(3.2, 3.3, 9.5));
    const followOffset = camera.position.clone().sub(controls.target);
    controls.update();
    const ambientLight = new THREE.HemisphereLight(0xb8cad8, 0x22201a, 0.75);
    scene.add(ambientLight);
    const moon = new THREE.DirectionalLight(0xcdd9ea, 2.1);
    moon.position.set(-38, 75, 22);
    moon.target.position.set(0, 10, -18);
    scene.add(moon, moon.target);
    moon.castShadow = !mobile;
    resources.add(moon.shadow);
    moon.shadow.mapSize.set(mobile ? 2048 : 4096, mobile ? 2048 : 4096);
    Object.assign(moon.shadow.camera, {
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
      near: 1,
      far: 160,
    });
    moon.shadow.normalBias = 0.03;
    const fill = new THREE.DirectionalLight(0x8faac2, 0.9);
    fill.position.set(35, 18, -42);
    scene.add(fill);
    const environment = createReferenceEnvironment(
      scene,
      renderer,
      resources,
      mobile,
    );
    const apparition = createContactApparition(
      scene,
      resources,
      profileRef.current,
    );
    const skillHolograms = createSkillHolograms(scene, resources);
    skillHolograms.setSkills(skillsRef.current);
    applySkills.current = skillHolograms.setSkills;
    applyProfile.current = apparition.setProfile;
    const companions = createCoffinCompanions(
      scene,
      environment.coffins,
      resources,
      navigator,
      walker.canStand,
      setVoiceNotice,
    );
    let hallLightingActive = false;
    applyMode.current = (value) => {
      const day = value === 'day',
        winter = value === 'winter';
      // Sky hemisphere — top: cool daytime azure / cold overcast / cool moonlit
      ambientLight.color.setHex(winter ? 0xd8ecf5 : day ? 0xcce8ff : 0xb8cad8);
      // Ground hemisphere — earthy warm bounce for day/winter, dark cool night
      ambientLight.groundColor.setHex(
        winter ? 0x9aadba : day ? 0x9a8a6e : 0x22201a,
      );
      ambientLight.intensity = winter ? 1.85 : day ? 2.1 : 0.75;
      // Moon / sun directional light
      moon.color.setHex(winter ? 0xd6e8f4 : day ? 0xffe9c5 : 0xcdd9ea);
      moon.intensity = winter ? 1.7 : day ? 3.4 : 2.1;
      // Rim / fill light
      fill.color.setHex(winter ? 0xaec8d8 : day ? 0xc4d8f0 : 0x8faac2);
      fill.intensity = winter ? 0.85 : day ? 1.05 : 0.9;
      const fog = scene.fog as THREE.FogExp2;
      fog.color.setHex(winter ? 0xb5c7d4 : day ? 0xa9cee4 : 0x1e2830);
      fog.density = winter ? 0.0055 : day ? 0.0016 : 0.0025;
      environment.setMode(value);
      house.setMode(value);
      audio.current?.setMode(value);
    };
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.25 : 2.0));
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
      seaPath = [];
      sailing.stop();
      guide.cancel();
      narratedJourney = false;
      keys.clear();
      touchKeys.clear();
      setJourney(null);
      destinationRoute.length = 0;
      destination.set(NaN, NaN, NaN);
    };
    stopNavigation.current = () => {
      assistantTargetRef.current = null;
      tourControl.current?.stop();
      clearInput();
      house.stop();
    };
    const house = createHouseExploration(
      scene,
      environment.manor,
      player,
      walker,
      camera,
      controls,
      mobile,
      (status) => {
        setHouseStatus(status);
        setEnteringHouse(!!status);
      },
      () => audio.current?.gate(),
      () => performance.now() <= cameraManualUntil,
      (id) => chooseProject(id),
      () =>
        companions.companions
          .filter((c) => c.wanted && c.body.visible)
          .map((c) => c.body.position),
    );
    type TourTravel = {
      stop: TourStop;
      stage: 'island' | 'entering' | 'room';
      elapsed: number;
      resolve: (value: boolean) => void;
    };
    let tourTravel: TourTravel | null = null;
    const tourPathGeometry = new THREE.BufferGeometry();
    resources.add(tourPathGeometry);
    const tourPathMaterial = new THREE.LineDashedMaterial({
      color: 0xffdf98,
      dashSize: 0.45,
      gapSize: 0.25,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    resources.add(tourPathMaterial);
    const tourPath = new THREE.Line(tourPathGeometry, tourPathMaterial);
    tourPath.visible = false;
    scene.add(tourPath);
    const stopTourTravel = () => {
      const pending = tourTravel;
      tourTravel = null;
      pending?.resolve(false);
      tourPath.visible = false;
      clearInput();
      house.stop();
    };
    const tour = createPortfolioTour({
      stops: () =>
        portfolioStops(
          profileRef.current,
          skillsRef.current,
          projectsRef.current,
        ),
      travel: (stop) =>
        new Promise<boolean>((resolve) => {
          if (inBoat) {
            resolve(false);
            return;
          }
          overviewRef.current = false;
          setOverview(false);
          const task: TourTravel = {
            stop,
            stage: house.inside ? 'room' : house.active ? 'entering' : 'island',
            elapsed: 0,
            resolve,
          };
          tourTravel = task;
          if (house.inside) {
            if (!house.walkTo(stop.point)) {
              tourTravel = null;
              resolve(false);
            }
          } else if (!house.active) {
            const place = islandPlaces.find((place) => place.id === 'manor')!;
            void navigateTo(place, 'About & contact').then(() => {
              if (tourTravel !== task) return;
              if (!Number.isFinite(destination.x)) {
                tourTravel = null;
                resolve(false);
                return;
              }
              tourPathGeometry.dispose();
              tourPathGeometry.deleteAttribute('position');
              tourPathGeometry.setFromPoints(
                [walker.position, destination, ...destinationRoute].map(
                  (p) =>
                    new THREE.Vector3(p.x, walkingHeight(p.x, p.z) + 0.08, p.z),
                ),
              );
              tourPath.computeLineDistances();
              tourPath.visible = true;
            });
          }
        }),
      stopTravel: stopTourTravel,
      speak: (text, done) => {
        if (
          !('speechSynthesis' in window) ||
          !chooseMaleVoice(window.speechSynthesis.getVoices())
        )
          return false;
        return speakIsland(text, { rate: 1, onEnd: done });
      },
      silence: stopIslandSpeech,
      report: setTourStatus,
      present: (stop) => {
        apparition.activate(stop?.section === 'About & contact');
        if (stop?.section === 'Projects') {
          changeGalleryPage(stop.page ?? 0);
          house.selectProject(
            stop.id.startsWith('frame-') ? (stop.id as HallFrameId) : null,
          );
        } else house.selectProject(null);
      },
    });
    tourControl.current = tour;
    const updateTourTravel = (dt: number) => {
      const task = tourTravel;
      if (!task) return;
      task.elapsed += dt;
      if (task.elapsed > 150) {
        tourTravel = null;
        clearInput();
        house.stop();
        task.resolve(false);
        return;
      }
      if (task.stage === 'island' && walker.nearHouse) {
        clearInput();
        tourPath.visible = false;
        if (house.enter()) task.stage = 'entering';
      }
      if (task.stage === 'entering' && house.inside) {
        task.stage = 'room';
        if (!house.walkTo(task.stop.point)) {
          tourTravel = null;
          task.resolve(false);
          return;
        }
      }
      if (task.stage === 'room' && house.inside && !house.travelling) {
        tourTravel = null;
        const p = house.position,
          goal = task.stop.point;
        task.resolve(
          Math.hypot(p.x - goal.x, p.z - goal.z) < 0.7 &&
            Math.abs(p.y - goal.y) < 0.2,
        );
      }
    };
    applyMode.current(modeRef.current);
    houseInteract.current = () => house.interact();
    houseReturn.current = () => {
      tour.stop();
      clearInput();
      house.returnToDoor();
    };
    houseUpstairs.current = () => {
      tour.stop();
      clearInput();
      house.walkTo({ x: 2, z: -5, y: 5 });
    };
    houseSkills.current = () => {
      tour.stop();
      clearInput();
      house.walkTo({ x: 5.5, z: -4.4, y: 0 });
    };
    houseEnterRoom.current = (room) => {
      assistantTargetRef.current = room;
      tour.stop();
      if (house.inside) {
        assistantTargetRef.current = null;
        if (room === 'skills') houseSkills.current();
        else if (room === 'projects') houseUpstairs.current();
        return;
      }
      if (house.active) return;
      if (walker.nearHouse && !inBoat) {
        if (house.enter()) {
          clearInput();
          setEnteringHouse(true);
          setDestinationsOpen(false);
          return;
        }
      }
      const place = islandPlaces.find((p) => p.id === 'manor')!;
      void navigateTo(place, 'the Manor');
    };
    applyHallSettings.current = (settings) => house.setHallSettings(settings);
    house.setHallSettings(hallSettingsRef.current);
    house.setProjects(
      hallProjectPage(projectsRef.current, galleryPageRef.current),
    );
    applyProjects.current = (items) => house.setProjects(items);
    projectSelection.current = (id) => {
      clearInput();
      house.stop();
      controls.enabled = id === null;
      house.selectProject(id);
    };
    contactInteraction.current = (open) => {
      clearInput();
      house.stop();
      controls.enabled = !open;
      apparition.activate(open && contactOpenRef.current);
    };
    requestHouse.current = () => {
      if (!interactive || inBoat || !walker.nearHouse) return;
      clearInput();
      overviewRef.current = false;
      setOverview(false);
      if (house.enter()) {
        setEnteringHouse(true);
        setDestinationsOpen(false);
      }
    };
    touchMovement.current = (key, active) => {
      if (active && interactive) {
        tour.stop();
        navigationRequest++;
        seaPath = [];
        guide.cancel();
        narratedJourney = false;
        destinationRoute.length = 0;
        destination.set(NaN, NaN, NaN);
        setJourney(null);
        touchKeys.add(key);
      } else touchKeys.delete(key);
    };
    const visibility = () => {
      if (document.hidden) {
        if (tour.active) tour.pause();
        clearInput();
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if (
        selectedProjectRef.current ||
        contactOpenRef.current ||
        skillsOpenRef.current
      )
        return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      if (event.code === 'Escape') {
        tour.stop();
        house.stop();
        setDestinationsOpen(false);
        clearInput();
        return;
      }

      if (
        !activeScene.current ||
        !interactive ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;
      if (movementKeys.has(event.code)) {
        tour.stop();
        navigationRequest++;
        seaPath = [];
        event.preventDefault();
        guide.cancel();
        narratedJourney = false;
        keys.add(event.code);
        setJourney(null);
        destinationRoute.length = 0;
        destination.set(NaN, NaN, NaN);
      }
      if (event.code === 'KeyE' && house.active && !event.repeat) {
        event.preventDefault();
        house.interact();
        return;
      }
      if (event.code === 'KeyE' && !event.repeat && (inBoat || wasNearBoat)) {
        event.preventDefault();
        waterAction.current(inBoat ? 'leaveBoat' : 'board');
        return;
      }
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
    const blur = () => {
      if (tour.active) tour.pause();
      clearInput();
    };
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    const touchPointers = new Map<number, { x: number; y: number }>();
    let pinchDistance = 0;
    const touchDistance = () => {
      const [a, b] = [...touchPointers.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    const pointerMove = (event: PointerEvent) => {
      if (!touchPointers.has(event.pointerId)) return;
      touchPointers.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      const distance = touchDistance();
      if (distance > 0 && pinchDistance > 0) {
        const factor = pinchDistance / distance;
        if (overviewRef.current) {
          camera.position
            .sub(controls.target)
            .multiplyScalar(factor)
            .add(controls.target);
        } else if (house.inside) house.zoom(factor);
        else followOrbit.zoom(factor);
        clickStart = null;
      }
      pinchDistance = distance;
    };
    const releaseTouch = (event: PointerEvent) => {
      touchPointers.delete(event.pointerId);
      pinchDistance = touchDistance();
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        touchPointers.set(event.pointerId, {
          x: event.clientX,
          y: event.clientY,
        });
        pinchDistance = touchDistance();
      }
      if (!event.isPrimary || event.button !== 0) {
        clickStart = null;
        return;
      }
      clickStart = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
      };
    };
    const pointerUp = (event: PointerEvent) => {
      releaseTouch(event);
      if (!clickStart || performance.now() - clickStart.time > 650) {
        clickStart = null;
        return;
      }
      const moved = Math.hypot(
        event.clientX - clickStart.x,
        event.clientY - clickStart.y,
      );
      clickStart = null;
      if (
        moved > 14 ||
        !interactive ||
        !activeScene.current ||
        selectedProjectRef.current ||
        contactOpenRef.current ||
        skillsOpenRef.current
      )
        return;
      const bounds = renderer.domElement.getBoundingClientRect();
      clickPoint.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      tour.stop();
      clickRay.setFromCamera(clickPoint, camera);
      if (house.inside && !inBoat) {
        const skillHit = skillHolograms.hit(clickRay);
        if (skillHit && house.unoccluded(clickRay, skillHit.distance)) {
          showSkills(true, skillHit.object.userData.skillId as string | null);
          return;
        }
      }
      const contactHit = house.inside ? apparition.hit(clickRay) : null;
      if (contactHit && house.unoccluded(clickRay, contactHit.distance)) {
        showContact(true);
        return;
      }
      if (!house.active && !inBoat) {
        const coffin = companions.hit(clickRay, [
          environment.ground,
          environment.manor,
        ]);
        if (coffin !== null) {
          clearInput();
          companions.toggle(coffin, walker.position);
          return;
        }
      }
      if (house.active) {
        if (house.inside) {
          house.point(clickRay);
        }
        return;
      }
      if (!inBoat) {
        const doorGroup = environment.manor?.userData?.door as
          | THREE.Group
          | undefined;
        if (doorGroup && clickRay.intersectObject(doorGroup, true).length > 0) {
          if (walker.nearHouse) {
            requestHouse.current();
          } else {
            void navigateTo({ x: 10, z: -23.8 }, 'the front door');
          }
          return;
        }
      }
      if (inBoat) {
        const point = clickRay.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
          new THREE.Vector3(),
        );
        const route = point ? seaRoute(sailing.position, point) : null;
        if (route) {
          clearInput();
          seaPath = route;
          setJourney({ name: 'Sailing to the selected spot', moving: true });
        } else setVoiceNotice('Choose open water away from the shore.');
        return;
      }
      const clickTargets: THREE.Object3D[] = [environment.ground];
      if (environment.manor) clickTargets.push(environment.manor);
      const hit = clickRay.intersectObjects(clickTargets, true)[0];
      // A terrain or scenery hit is authoritative; never project a blocked hit through scenery.
      if (hit) {
        let targetX = hit.point.x;
        let targetZ = hit.point.z;
        // If clicking on the manor stairs or door landing, snap to the walkable stair corridor
        if (
          Math.abs(targetX - 10) < 2.6 &&
          targetZ < -20.5 &&
          targetZ > -25.5
        ) {
          targetX = 10;
          targetZ = Math.max(-23.9, Math.min(-20.8, targetZ));
        }
        void navigateTo({ x: targetX, z: targetZ }, 'the selected spot');
      } else {
        const level = new THREE.Plane(
          new THREE.Vector3(0, 1, 0),
          -walker.position.y,
        );
        const point = clickRay.ray.intersectPlane(level, new THREE.Vector3());
        if (point) void navigateTo(point, 'the selected spot');
      }
    };
    const pointerCancel = (event: PointerEvent) => {
      releaseTouch(event);
      clickStart = null;
    };
    renderer.domElement.addEventListener('pointercancel', pointerCancel);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointermove', pointerMove);
    renderer.domElement.addEventListener('lostpointercapture', pointerCancel);
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
      updateTourTravel(dt);
      guide.update(dt);
      if (assistantTargetRef.current) {
        if (!house.inside && !house.active) {
          if (walker.nearHouse && !inBoat) {
            if (house.enter()) {
              clearInput();
              setEnteringHouse(true);
              setDestinationsOpen(false);
            }
          }
        } else if (house.inside) {
          const room = assistantTargetRef.current;
          assistantTargetRef.current = null;
          if (room === 'skills') {
            houseSkills.current();
          } else if (room === 'projects') {
            houseUpstairs.current();
          }
        }
      }
      simulationTime += dt;
      if (!interactive) {
        environment.update(simulationTime, camera);
        renderer.render(scene, camera);
        if (avatarReady && !contextFailed) {
          interactive = true;
          setReady(true);
        }
        return;
      }
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
      previousPosition.copy(walker.position);
      if (
        house.update(
          dt,
          simulationTime,
          forward,
          side,
          keys.has('ShiftLeft') || keys.has('ShiftRight'),
          motion.matches,
        )
      ) {
        if (house.inside) {
          const settings = hallSettingsRef.current;
          // Apply indoor lighting values directly — never call applyMode() here.
          // applyMode triggers a full scene rebuild (weather, water, fog, haunting)
          // which freezes the frame whenever lights are toggled inside the house.
          const lighting = hallLighting(settings);
          ambientLight.intensity = lighting.ambient;
          moon.intensity = lighting.daylight;
          fill.intensity = settings.mode === 'day' ? 0.7 : 0.015;
          hallLightingActive = true;
          // Disable OrbitControls damping inside the house — the collision
          // constraint system (constrainCamera) is the sole authority on
          // camera position indoors. Damping fights it every frame and causes
          // visible shake when the user rotates the view.
          controls.enableDamping = false;
        } else if (hallLightingActive) {
          applyMode.current(modeRef.current);
          hallLightingActive = false;
        }
        soundCues.update(
          simulationTime,
          previousPosition.distanceTo(walker.position),
          keys.has('ShiftLeft') || keys.has('ShiftRight'),
          false,
          walker.position.x,
          walker.position.z,
          gateOpening(walker.position.x, walker.position.z),
        );
        followOrbit.reset();
        environment.setSheltered(house.inside);
        environment.update(simulationTime, camera);
        companions.update(dt, walker.position, false, motion.matches);
        apparition.update(simulationTime, camera, motion.matches);
        skillHolograms.update(
          simulationTime,
          camera,
          motion.matches,
          hallSettingsRef.current.mode === 'dark',
        );
        renderer.render(scene, camera);
        return;
      }
      controls.enableDamping = overviewRef.current && !motion.matches;
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
        if (
          remaining < 0.28 &&
          (!destinationRoute[0] ||
            navigator.clear(walker.position, destinationRoute[0]))
        ) {
          const next = destinationRoute.shift();
          if (next) destination.copy(next);
          else {
            destination.set(NaN, NaN, NaN);
            setJourney(null);
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
      movementBlend = THREE.MathUtils.damp(
        movementBlend,
        direction.lengthSq() > 0 ? 1 : 0,
        9,
        dt,
      );
      if (inBoat && seaPath.length && !forward && !side) {
        const target = seaPath[0];
        direction.set(
          target.x - sailing.position.x,
          0,
          target.z - sailing.position.z,
        );
        if (direction.length() < 0.3) {
          seaPath.shift();
          sailing.stop();
          direction.set(0, 0, 0);
          if (!seaPath.length)
            setJourney({
              name:
                Math.hypot(
                  sailing.position.x - BOAT_MOORING.x,
                  sailing.position.z - BOAT_MOORING.z,
                ) < 2.5
                  ? 'At the dock. Step ashore when ready.'
                  : 'Arrived on the open sea.',
              moving: false,
            });
        } else direction.multiplyScalar(1 / 3).clampLength(0, 1);
      }
      const moved = interactive
        ? inBoat
          ? sailing.move(
              direction,
              dt,
              keys.has('ShiftLeft') || keys.has('ShiftRight'),
              environment.traffic.positions(),
            )
          : walker.move(
              direction,
              dt,
              hasDestination || keys.has('ShiftLeft') || keys.has('ShiftRight'),
              movementBlend,
            )
        : 0;
      if (hasDestination && !guide.holdingDeparture) {
        if (moved < 0.0001) destinationStuckTime += dt;
        else destinationStuckTime = 0;
        if (destinationStuckTime > 0.6 && destinationRoute.length > 0) {
          destination.copy(destinationRoute.shift()!);
          destinationStuckTime = 0;
        } else if (destinationStuckTime > 1.4) {
          destinationRoute.length = 0;
          destination.set(NaN, NaN, NaN);
          destinationStuckTime = 0;
          guide.cancel();
          narratedJourney = false;
          setJourney(null);
        }
      }
      if (inBoat) {
        const swell = oceanSample(
          sailing.position.x,
          sailing.position.z,
          simulationTime,
        );
        walker.position.copy(sailing.position);
        walker.position.y = swell.height + 0.1;
        environment.boat.position.set(
          sailing.position.x,
          swell.height + 0.08,
          sailing.position.z,
        );
        environment.boat.rotation.y = sailing.heading + Math.PI / 2;
        environment.boat.rotation.x =
          Math.atan2(swell.normal.z, swell.normal.y) * 0.35;
        environment.boat.rotation.z =
          -Math.atan2(swell.normal.x, swell.normal.y) * 0.35;
      }
      const rowing = environment.rowing;
      const stroke = rowing.update(
        dt,
        inBoat && moved > 0.0001 && direction.lengthSq() > 0.001,
        keys.has('ShiftLeft') || keys.has('ShiftRight'),
      );
      if (stroke) audio.current?.row();
      if (inBoat) player.setRowingTargets(rowing.leftHand, rowing.rightHand);
      change.copy(walker.position).sub(previousPosition);
      if (inBoat) {
        const wave = oceanSample(
          sailing.position.x,
          sailing.position.z,
          simulationTime,
        );
        player.root.rotation.x =
          Math.atan2(wave.normal.z, wave.normal.y) * 0.35;
        player.root.rotation.z =
          -Math.atan2(wave.normal.x, wave.normal.y) * 0.35;
      } else {
        player.root.rotation.x = 0;
        player.root.rotation.z = 0;
      }
      const previousVisualY = player.root.position.y;
      player.root.position.x = walker.position.x;
      player.root.position.z = walker.position.z;
      player.root.position.y =
        inBoat || motion.matches
          ? walker.position.y
          : THREE.MathUtils.damp(previousVisualY, walker.position.y, 22, dt);
      if (inBoat)
        player.root.position.copy(
          environment.boat.localToWorld(new THREE.Vector3(0.25, 0.02, 0)),
        );
      change.y = player.root.position.y - previousVisualY;
      const facing = guide.facingCamera
        ? Math.atan2(
            walker.position.x - camera.position.x,
            walker.position.z - camera.position.z,
          )
        : inBoat
          ? sailing.heading + Math.PI
          : walker.heading;
      const turn = Math.atan2(
        Math.sin(facing - player.root.rotation.y),
        Math.cos(facing - player.root.rotation.y),
      );
      player.root.rotation.y +=
        motion.matches || inBoat ? turn : turn * (1 - Math.exp(-dt * 9));
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
      const gateOpen = gateOpening(walker.position.x, walker.position.z);
      soundCues.update(
        simulationTime,
        moved,
        hasDestination || keys.has('ShiftLeft') || keys.has('ShiftRight'),
        inBoat,
        walker.position.x,
        walker.position.z,
        gateOpen,
      );
      (environment.entranceGate.userData.leaves as THREE.Object3D[]).forEach(
        (leaf) => {
          const side = Number(leaf.userData.side) || 1;
          leaf.rotation.y = -side * gateOpen * Math.PI * 0.42;
        },
      );
      if (!overviewRef.current) {
        const desiredTarget = player.root.position
          .clone()
          .add(new THREE.Vector3(0, 1.7, 0));
        camera.position.add(desiredTarget.clone().sub(controls.target));
        controls.target.copy(desiredTarget);
      }
      controls.enableDamping = overviewRef.current && !motion.matches;
      controls.update();
      if (!overviewRef.current && moved > 0.0001 && now > cameraManualUntil) {
        followBehind(camera, controls.target, player.root.rotation.y, dt);
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
          controls.target
            .copy(walker.position)
            .add(new THREE.Vector3(0, 1.8, 0));
          camera.position.copy(controls.target).add(followOffset);
        }
        controls.update();
      }
      wasOverview = overviewRef.current;
      if (!overviewRef.current) {
        followOrbit.prepare(
          camera.position,
          controls.target,
          dt,
          now <= cameraManualUntil,
        );
        walker.constrainCamera(camera.position, controls.target);
        environment.constrainShoreCamera(camera.position, controls.target);
        followOrbit.commit(camera.position, controls.target);
      }
      // Collision resolution is final; damping must not push the camera back
      // through a wall after its position has been constrained.
      camera.lookAt(controls.target);
      if (speechBubble.current) {
        bubblePosition
          .copy(player.root.position)
          .add(new THREE.Vector3(0, 1.9, 0))
          .project(camera);
        const visible =
          bubblePosition.z > -1 &&
          bubblePosition.z < 1 &&
          Math.abs(bubblePosition.x) < 1 &&
          Math.abs(bubblePosition.y) < 1;
        speechBubble.current.style.visibility = visible ? 'visible' : 'hidden';
        const inset = Math.min(150, host.clientWidth / 2);
        speechBubble.current.style.left = `${THREE.MathUtils.clamp((bubblePosition.x * 0.5 + 0.5) * host.clientWidth, inset, host.clientWidth - inset)}px`;
        speechBubble.current.style.top = `${Math.max(160, (-bubblePosition.y * 0.5 + 0.5) * host.clientHeight - 12)}px`;
      }
      if (walker.nearHouse !== wasNearHouse) {
        wasNearHouse = walker.nearHouse;
        setNearHouse(wasNearHouse);
      }
      const closeBoat =
        !inBoat &&
        Math.hypot(
          walker.position.x - BOAT_DOCK.x,
          walker.position.z - BOAT_DOCK.z,
        ) < 2.4;
      const docked =
        inBoat &&
        Math.hypot(
          sailing.position.x - BOAT_MOORING.x,
          sailing.position.z - BOAT_MOORING.z,
        ) < 2.5;
      if (closeBoat !== wasNearBoat) {
        wasNearBoat = closeBoat;
        setNearBoat(closeBoat);
      }
      if (docked !== wasAtDock) {
        wasAtDock = docked;
        setAtDock(docked);
      }
      environment.update(simulationTime, camera);
      companions.update(dt, walker.position, !inBoat, motion.matches);
      apparition.update(simulationTime, camera, motion.matches);
      skillHolograms.update(
        simulationTime,
        camera,
        motion.matches,
        hallSettingsRef.current.mode === 'dark',
      );
      renderer.render(scene, camera);
      if (!interactive && !contextFailed && avatarReady) {
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
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('pointercancel', pointerCancel);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointermove', pointerMove);
      renderer.domElement.removeEventListener(
        'lostpointercapture',
        pointerCancel,
      );
      renderer.domElement.removeEventListener('wheel', wheelZoom);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      goToPlace.current = () => {};
      stopNavigation.current = () => {};
      touchMovement.current = () => {};
      performAvatarAction.current = () => {};
      waterAction.current = () => {};
      cameraCommand.current = () => {};
      requestHouse.current = () => {};
      house.dispose();
      tour.stop();
      tourControl.current = null;
      companions.dispose();
      apparition.dispose();
      skillHolograms.dispose();
      applySkills.current = () => {};
      contactInteraction.current = () => {};
      applyProfile.current = () => {};
      houseInteract.current = () => {};
      houseReturn.current = () => {};
      houseUpstairs.current = () => {};
      houseEnterRoom.current = () => {};
      assistantTargetRef.current = null;
      applyHallSettings.current = () => {};
      applyProjects.current = () => {};
      projectSelection.current = () => {};
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
          {houseStatus && <h1>{houseStatus.room}</h1>}
        </div>
        <div className="island-toolbar">
          {houseStatus ? (
            <fieldset className="island-modes" aria-label="House lighting mode">
              {(['day', 'dark'] as const).map((value) => (
                <Button
                  key={value}
                  variant="ghost"
                  aria-pressed={hallSettings.mode === value}
                  onClick={() => changeHallSettings({ mode: value })}
                >
                  {value === 'day' ? <Sun /> : <Moon />}
                  <span>{value}</span>
                </Button>
              ))}
            </fieldset>
          ) : (
            <fieldset className="island-modes" aria-label="Island atmosphere">
              {ISLAND_MODES.map((value) => (
                <Button
                  key={value}
                  variant="ghost"
                  aria-pressed={mode === value}
                  aria-label={`${value[0].toUpperCase() + value.slice(1)} atmosphere`}
                  onClick={() => changeMode(value)}
                >
                  {value === 'day' ? (
                    <Sun />
                  ) : value === 'winter' ? (
                    <Snowflake />
                  ) : (
                    <Moon />
                  )}
                  <span>{value}</span>
                </Button>
              ))}
            </fieldset>
          )}
          <div className="island-toolbar-actions">
            {houseStatus?.inside && (
              <Button
                className="island-portfolio-link"
                variant="ghost"
                onClick={() => showSkills(true)}
              >
                All skills ({skills.length})
              </Button>
            )}
            {houseStatus && (
              <Button
                className="island-portfolio-link"
                variant="ghost"
                aria-pressed={hallSettings.lights}
                aria-label="House lights"
                onClick={() =>
                  changeHallSettings({ lights: !hallSettings.lights })
                }
              >
                <Lightbulb />
              </Button>
            )}
            {houseStatus && onPortfolio && (
              <Button
                className="island-portfolio-link"
                variant="ghost"
                onClick={onPortfolio}
              >
                Portfolio
              </Button>
            )}
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
              disabled={!ready || failed}
              aria-label="Open AI voice mode"
              title="Voice command"
            >
              <Mic />
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
              ? 'The 3D scene could not load. Please try again.'
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
      {speechText && (
        <output className="island-speech-bubble" ref={speechBubble}>
          {speechText}
        </output>
      )}
      {!houseStatus &&
        (voiceNotice || nearBoat || boatMode) && (
          <div className="walk-objective" aria-live="polite">
            {voiceNotice && (
              <output className="voice-feedback">{voiceNotice}</output>
            )}
            {nearBoat && (
              <Button
                variant="outline"
                onClick={() => waterAction.current('board')}
              >
                Board the boat <kbd>E</kbd>
              </Button>
            )}
            {boatMode && (
              <>
                <Button
                  variant="outline"
                  onClick={() => waterAction.current('return')}
                >
                  Return to dock
                </Button>
                {atDock && (
                  <Button
                    variant="outline"
                    onClick={() => waterAction.current('leaveBoat')}
                  >
                    Step ashore <kbd>E</kbd>
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      {houseStatus && (
        <div className="house-sidebar-nav" aria-label="Manor navigation">
          <span className="house-sidebar-title">Manor Sections</span>
          <div className="house-sidebar-buttons">
            <Button
              variant={houseStatus.masterHall ? 'secondary' : 'outline'}
              className={`house-sidebar-btn ${houseStatus.masterHall ? 'is-active' : ''}`}
              onClick={() => {
                if (houseStatus.masterHall) {
                  chooseProject(
                    hallProjectPage(projects, galleryPage)[0]?.id ?? null,
                  );
                } else {
                  houseUpstairs.current();
                }
              }}
            >
              <FolderGit2 size={15} />
              <span>
                {houseStatus.masterHall ? 'Open Projects' : 'Projects Section'}
              </span>
            </Button>

            <Button
              variant={houseStatus.skillsRoom ? 'secondary' : 'outline'}
              className={`house-sidebar-btn ${houseStatus.skillsRoom ? 'is-active' : ''}`}
              onClick={() => {
                if (houseStatus.skillsRoom) {
                  showSkills(true, skills[0]?.id ?? null);
                } else {
                  houseSkills.current();
                }
              }}
            >
              <Sparkles size={15} />
              <span>
                {houseStatus.skillsRoom ? 'Open Skills' : 'Skills Room'}
              </span>
            </Button>

            {houseStatus.room !== 'The entrance hall' && (
              <Button
                variant="outline"
                className="house-sidebar-btn"
                onClick={() => houseReturn.current()}
              >
                <Compass size={15} />
                <span>Entrance Hall</span>
              </Button>
            )}

            {houseStatus.door && (
              <Button
                variant="outline"
                className="house-sidebar-btn"
                onClick={() => houseInteract.current()}
                disabled={houseStatus.open && houseStatus.door !== 'Front door'}
              >
                <DoorOpen size={15} />
                <span>
                  {houseStatus.door === 'Front door'
                    ? 'Exit Manor'
                    : houseStatus.open
                      ? 'Walk Through'
                      : `Open Door`}
                </span>
                <kbd>E</kbd>
              </Button>
            )}

          </div>

          {houseStatus.masterHall && canEditProjects && (
            <Button
              variant="outline"
              className="house-sidebar-btn"
              disabled={frameBusy}
              onClick={() => void addProject()}
            >
              <span>{frameBusy ? 'Adding…' : '+ Add Frame'}</span>
            </Button>
          )}

          {houseStatus.masterHall && hallPageCount(projects) > 1 && (
            <nav
              className="hall-collection-controls"
              aria-label="Hall collection pages"
            >
              <Button
                variant="ghost"
                aria-label="Previous"
                disabled={galleryPage === 0}
                onClick={() => changeGalleryPage(galleryPage - 1)}
              >
                <ArrowLeft />
              </Button>
              <output>
                {galleryPage + 1}/{hallPageCount(projects)}
              </output>
              <Button
                variant="ghost"
                aria-label="Next"
                disabled={galleryPage >= hallPageCount(projects) - 1}
                onClick={() => changeGalleryPage(galleryPage + 1)}
              >
                <ArrowRight />
              </Button>
            </nav>
          )}
        </div>
      )}
      {selectedProject &&
        projects.some((project) => project.id === selectedProject) && (
          <HallProjectDialog
            project={projects.find(
              (project) => project.id === selectedProject,
            )!}
            projects={projects}
            canEdit={canEditProjects}
            busy={frameBusy}
            onAdd={addProject}
            onRemove={removeProject}
            onSelect={chooseProject}
            onSave={saveProject}
            onImportDrafts={importProjectDrafts}
            onClose={() => chooseProject(null)}
          />
        )}
      {tourStatus && (
        <section className="portfolio-tour" aria-label="Guided portfolio tour">
          <div className="tour-heading">
            <span className="tour-orbit" aria-hidden="true">
              ✧
            </span>
            <div>
              <span className="tour-kicker">YOUR ISLAND COMPANION</span>
              <div className="tour-path-label">
                A guided journey through my work
              </div>
            </div>
          </div>
          <div
            className="tour-progress"
            aria-label={`Stop ${tourStatus.index + 1} of ${tourStatus.total}`}
          >
            {Array.from({ length: tourStatus.total }, (_, i) => (
              <span key={i} data-reached={i <= tourStatus.index} />
            ))}
          </div>
          <div className="eyebrow">
            {tourStatus.phase === 'travelling'
              ? 'ON THE WAY'
              : tourStatus.phase.toUpperCase()}{' '}
            · {tourStatus.index + 1} / {tourStatus.total}
          </div>
          <h2>{tourStatus.stop.title}</h2>
          <p aria-live="polite">{tourStatus.caption}</p>
          <div className="tour-actions">
            {tourStatus.phase !== 'complete' && (
              <>
                <Button
                  variant="ghost"
                  onClick={() => tourControl.current?.replay()}
                >
                  {['paused', 'error'].includes(tourStatus.phase)
                    ? 'Resume / retry'
                    : 'Read again'}
                </Button>
                {!['paused', 'error'].includes(tourStatus.phase) && (
                  <Button
                    variant="ghost"
                    onClick={() => tourControl.current?.pause()}
                  >
                    Pause
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => tourControl.current?.next()}
                >
                  Next →
                </Button>
              </>
            )}
            {onPortfolio && (
              <Button
                variant="ghost"
                onClick={() => {
                  tourControl.current?.stop();
                  onPortfolio();
                }}
              >
                Quick portfolio
              </Button>
            )}
            <Button variant="ghost" onClick={() => tourControl.current?.stop()}>
              Explore freely
            </Button>
          </div>
        </section>
      )}
      {contactOpen && (
        <ContactApparitionDialog
          profile={profile}
          canEdit={canEditProjects}
          onSave={saveProfile}
          onClose={() => showContact(false)}
        />
      )}
      {skillsOpen && (
        <SkillGalleryDialog
          skills={skills}
          selected={selectedSkill}
          canEdit={canEditProjects}
          onSelect={selectSkill}
          onSave={saveSkill}
          onClose={() => showSkills(false)}
        />
      )}
      {!houseStatus && (
        <nav className="island-destinations" aria-label="Island destinations">
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
              {menuPlaces.map((place) => (
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
        </nav>
      )}
      <footer className="walk-controls">
        <fieldset
          className="walk-pad"
          aria-label={boatMode ? 'Sailing controls' : 'Walking controls'}
        >
          {[
            {
              key: 'KeyW',
              label: 'Walk forward',
              style: 'walk-forward',
              Icon: ArrowUp,
            },
            {
              key: 'KeyA',
              label: 'Walk left',
              style: 'walk-left',
              Icon: ArrowLeft,
            },
            {
              key: 'KeyS',
              label: 'Walk backward',
              style: 'walk-back',
              Icon: ArrowDown,
            },
            {
              key: 'KeyD',
              label: 'Walk right',
              style: 'walk-right',
              Icon: ArrowRight,
            },
          ].map(({ key, label, style, Icon }) => (
            <Button
              key={key}
              variant="ghost"
              className={style}
              aria-label={boatMode ? label.replace('Walk', 'Sail') : label}
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
            >
              <Icon />
            </Button>
          ))}
        </fieldset>
      </footer>
      {localEditor && (
        <aside
          className="admin-status-bar"
          aria-label="Local development editor"
        >
          <span className="admin-status-badge">
            {adminMode ? 'Local editor' : 'Guest preview'}
          </span>
          <button
            type="button"
            className="admin-switch-btn"
            onClick={toggleAdminMode}
          >
            {adminMode ? 'Preview as guest' : 'Return to local editor'}
          </button>
        </aside>
      )}
      <IslandChatWidget
        ref={assistant}
        active={active}
        onAction={assistantAction}
        onVoiceStart={() => {
          tourControl.current?.pause();
          stopIslandSpeech();
        }}
        phone={profile.phone}
        location={profile.location}
        resume={profile.resume}
        name={profile.name}
        role={profile.role}
        bio={profile.bio}
        email={profile.email}
        skills={skills.map((s) => ({
          title: s.title,
          description: s.description,
        }))}
        projects={projects
          .filter((p) => p.title)
          .map((p) => ({
            title: p.title,
            description: p.description || '',
            url: p.url || '',
          }))}
      />
    </main>
  );
}
