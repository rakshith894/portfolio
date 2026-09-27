'use client';

import { createSailingController, seaRoute, type SeaPoint } from '@/lib/island-sailing';
import { oceanSample } from '@/lib/island-motion';
import { BOAT_DOCK, BOAT_MOORING } from '@/lib/island-stairs';
import { clearedSceneryHeight } from '@/lib/stair-clearance';
import { createRenderBudget } from '@/lib/render-budget';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Square,
  Volume2,
  VolumeX,
  DoorOpen,
  Maximize2,
  Mic,
  MicOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createReferenceEnvironment } from '@/lib/reference-environment';
import { groundHeight, onIsland, referenceCameraPose } from '@/lib/reference-layout';
import {
  createIslandWalker,
  gateOpening,
  walkingDirection,
  walkingHeight,
} from '@/lib/island-walk';
import { createIslandNavigator } from '@/lib/island-navigation';
import { createJourneyGuide } from '@/lib/island-journey';
import { createIslandAvatar } from '@/lib/island-avatar';
import { createAmbience } from '@/lib/ambience';
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
  onExit,
  onHouse,
  startAtHouse = false,
}: {
  onExit?: () => void;
  onHouse?: () => void;
  startAtHouse?: boolean;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const speechBubble = useRef<HTMLOutputElement>(null);
  const audio = useRef<ReturnType<typeof createAmbience> | null>(null);
  const audioBusy = useRef(false);
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
  const houseAction = useRef(onHouse);
  const overviewRef = useRef(false);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  const [boatMode, setBoatMode] = useState(false);
  const [nearBoat, setNearBoat] = useState(false);
  const [atDock, setAtDock] = useState(false);
  const [sound, setSound] = useState(false),
    [overview, setOverview] = useState(false);
  const [audioError, setAudioError] = useState(false),
    [nearHouse, setNearHouse] = useState(false);
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
  useEffect(() => {
    houseAction.current = onHouse;
  }, [onHouse]);
  useEffect(() => () => audio.current?.close(), []);
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
        if (nearHouse && command.enter) houseAction.current?.();
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
  async function toggleSound() {
    if (audioBusy.current) return;
    audioBusy.current = true;
    try {
      audio.current ??= createAmbience();
      await (sound ? audio.current.suspend() : audio.current.resume());
      setSound(!sound);
      if (sound) stopIslandSpeech();
      else if (!welcomeStarted.current) {
        welcomeStarted.current = true;
        speakIsland('Welcome to the island, traveller. Follow the lanterns to Rakshith Manor.');
      }
      setAudioError(false);
    } catch {
      setAudioError(true);
    } finally {
      audioBusy.current = false;
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
    const renderBudget=createRenderBudget(mobile,devicePixelRatio);
    renderer.setPixelRatio(renderBudget.ratio(host.clientWidth,host.clientHeight));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !mobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    let lastShadowUpdate = -Infinity;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0f16');
    scene.fog = new THREE.FogExp2('#27313b', 0.0028);
    const walker = createIslandWalker(mobile, startAtHouse, false);
    const destinationRoute: THREE.Vector3[] = [];
    let navigationRequest = 0;
    let cameraManualUntil = 0;
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
      ghost: (...args) => audio.current?.ghost(...args),
      bell: (...args) => audio.current?.bell(...args),
      thunder: () => audio.current?.thunder(),
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
      cameraManualUntil = performance.now() + 900;
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
    scene.add(new THREE.HemisphereLight(0xbac9d5, 0x171b1c, 0.7));
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
    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      renderer.setPixelRatio(renderBudget.ratio(host.clientWidth,host.clientHeight));
      renderer.setSize(host.clientWidth, host.clientHeight);
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    const clearInput = () => {
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
    stopNavigation.current = clearInput;
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
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      )
        return;
      if (event.code === 'Escape') {
        setDestinationsOpen(false);
        clearInput();
        return;
      }
      if (!interactive || event.altKey || event.ctrlKey || event.metaKey)
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
      if(event.code==='KeyE' && !event.repeat && (inBoat || wasNearBoat)){event.preventDefault();waterAction.current(inBoat?'leaveBoat':'board');return;}
      if (event.code === 'KeyE' && walker.nearHouse && !event.repeat) {
        event.preventDefault();
        clearInput();
        houseAction.current?.();
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
      window.clearTimeout(loadFallback);
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
      if (moved > 8 || !interactive) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      clickPoint.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      clickRay.setFromCamera(clickPoint, camera);
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
      if (document.hidden || contextFailed) {
        previous = now;
        return;
      }
      if (mobile && now - lastRendered < 32) return;
      if(interactive && lastRendered && renderBudget.sample(now-lastRendered))resize();
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
      previousPosition.copy(walker.position);
      const direction = walkingDirection(
        forward,
        side,
        camera.position,
        walker.position,
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
        camera.position.add(change);
        controls.target.add(change);
      }
      controls.enableDamping = !motion.matches;
      controls.update();
      if (!overviewRef.current && moved > 0.0001 && now > cameraManualUntil) {
        const movementDirection = direction.clone().normalize();
        const desiredTarget = new THREE.Vector3(
          walker.position.x + movementDirection.x * 1.6,
          walker.position.y + 2.4,
          walker.position.z + movementDirection.z * 1.6,
        );
        controls.target.lerp(desiredTarget, 1 - Math.exp(-dt * 1.35));
      }
      if (overviewRef.current !== wasOverview) {
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
      const floor = onIsland(camera.position.x, camera.position.z)
        ? clearedSceneryHeight(camera.position.x, camera.position.z, groundHeight(camera.position.x, camera.position.z)) + 0.65
        : inBoat ? 1.2 : -9;
      camera.position.y = Math.max(camera.position.y, floor);
      const cameraOffset = camera.position.clone().sub(controls.target);
      const cameraDistance = cameraOffset.length();
      if (cameraDistance > 0.001) {
        const mediumDistance = THREE.MathUtils.clamp(
          cameraDistance,
          4.5,
          overviewRef.current ? 600 : 42,
        );
        camera.position
          .copy(controls.target)
          .add(cameraOffset.setLength(mediumDistance));
      }
      if (!overviewRef.current) walker.constrainCamera(camera.position, controls.target);
      // OrbitControls owns the camera orientation so manual rotation remains
      // available while the camera follows the character.
      controls.update();
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
      // Static masonry keeps its shadow between updates; animate the nearby
      // traveller/gates at 15 Hz instead of redrawing the whole island at 60 Hz.
      if(now-lastShadowUpdate>=1000/15){renderer.shadowMap.needsUpdate=true;lastShadowUpdate=now;}
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(loop);
    const enableWalking = () => {
      if (!disposed && !contextFailed) {
        interactive = true;
        setReady(true);
      }
    };
    const loadFallback = window.setTimeout(() => { void player.ready.then(enableWalking); }, 12000);
    void Promise.all([environment.ready, player.ready]).then(() => {
      window.clearTimeout(loadFallback);
      enableWalking();
    });
    return () => {
      disposed = true;
      clearInput();
      window.clearTimeout(loadFallback);
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
      controls.dispose();
      environment.dispose();
      resources.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [startAtHouse]);
  return (
    <main
      className="island-viewer walking-viewer"
      aria-label="Walk through Rakshith's 3D graveyard"
    >
      <div className="island-canvas" ref={mount} aria-hidden="true" />
      <header className="island-header">
        <div>
          <span>NOCTURNE.</span>
          <h1>Rakshith · The graveyard</h1>
        </div>
        <div className="island-toolbar">
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
            onClick={toggleSound}
            aria-label={sound ? 'Mute ambience' : 'Enable ambience'}
            aria-pressed={sound}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleVoice}
            disabled={!ready || failed}
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
            aria-label={overview ? 'Return to close camera' : 'View the whole island'}
            aria-pressed={overview}
          >
            <Maximize2 />
          </Button>
        </div>
      </header>
      {(!ready || failed) && (
        <div className="island-loading">
          <h2>
            {failed ? 'The graveyard could not open.' : 'Your journey begins…'}
          </h2>
          <p>
            {failed
              ? 'This browser could not start the 3D scene.'
              : 'Preparing your character, the path, and the storm.'}
          </p>
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
      {(journey || voiceNotice || nearHouse || nearBoat || boatMode) && <div className="walk-objective" aria-live="polite">
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
        {nearHouse && !boatMode && onHouse && (
          <Button
            variant="outline"
            onClick={onHouse}
            className="island-enter-house"
            disabled={!ready || failed}
          >
            <DoorOpen /> Enter the house <kbd>E</kbd>
          </Button>
        )}
      </div>}
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
      </nav>
      <footer className="walk-controls">
        <div className="walk-help">
          <p>
            <kbd>W A S D</kbd> or <kbd>↑ ← ↓ →</kbd> to {boatMode ? 'sail' : 'walk'}
          </p>
          <span>{boatMode ? 'Hold arrows or tap open water to row. Shift for stronger strokes.' : 'Tap the ground or choose a place. Drag to look. Shift to run.'}</span>
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
