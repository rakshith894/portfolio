export const islandPlaces = [
  {
    id: 'landing',
    name: 'Frostfall Landing',
    x: 9,
    z: 32,
    aliases: ['landing', 'start', 'entrance'],
    action: 'Listen to the welcome',
    story:
      'Welcome to the graveyard of Rakshith. Follow the lanterns, wander where curiosity leads, and speak your wish. Every stone has a story.',
  },
  {
    id: 'gate',
    name: 'Raven Gate',
    x: 17,
    z: 8.5,
    aliases: ['gate', 'gates', 'raven gate'],
    action: 'Read the inscription',
    story:
      'Raven Gate. Leave the noise of the world behind. The island is yours to explore.',
  },
  {
    id: 'gateThreshold',
    name: 'Gate Threshold',
    x: 17,
    z: 5,
    aliases: ['gate threshold', 'gate entrance', 'entrance gate'],
    action: 'Approach the gate',
    story: 'The Raven Gate waits ahead. Its hinges remember every visitor.',
  },
  {
    id: 'graves',
    name: 'Whispering Graves',
    x: 3.5,
    z: 12,
    aliases: ['graveyard', 'graves', 'cemetery', 'whispering graves'],
    action: 'Hear the whispers',
    story:
      'Here at Whispering Graves, the sea carries the names that time forgot. Follow the paths between the old stones.',
  },
  {
    id: 'willow',
    name: 'Willow Hollow',
    x: -9.5,
    z: 1.5,
    aliases: ['willow', 'hollow', 'willow hollow'],
    action: 'Listen to the hollow',
    story:
      'Willow Hollow. Beneath these old branches, even the storm lowers its voice. Take a breath and stay a while.',
  },
  {
    id: 'lookout',
    name: 'Lantern Lookout',
    x: 22.5,
    z: -7.5,
    aliases: ['lookout', 'lantern lookout'],
    action: 'Light the beacon',
    story:
      'The beacon at Lantern Lookout is lit. A little warmth to guide a traveller home.',
  },
  {
    id: 'manor',
    name: 'Rakshith Manor',
    x: 10,
    z: -20.5,
    aliases: ['house', 'manor', 'mansion', 'rakshith manor', 'rakkshith manor'],
    action: 'Open the door',
    story:
      'Rakshith Manor. The old door opens. The hall awaits; the underground has been cleared for a new beginning.',
  },
  {
    id: 'house',
    name: 'The House',
    x: 10,
    z: -20.5,
    aliases: ['the house', 'house entrance'],
    action: 'Enter the house',
    story: 'The house is waiting. Its lanterns burn for you alone.',
  },
  {
    id: 'backyard',
    name: 'House Backyard',
    x: 10,
    z: -40,
    aliases: ['backyard', 'house backyard', 'back garden', 'rear garden'],
    action: 'Explore the backyard',
    story:
      'The backyard lies beyond the side path. The house keeps its secrets behind the stone.',
  },
  {
    id: 'boat',
    name: 'Boat Landing',
    x: -16,
    z: -46,
    aliases: ['boat', 'boat landing', 'shore', 'ocean', 'water', 'dock'],
    action: 'Reach the boat',
    story:
      'The boat waits below the bridge. The tide is calm enough for a short crossing.',
  },
  {
    id: 'bridgeShore',
    name: 'Bridge Shore',
    x: -16,
    z: -32,
    aliases: ['bridge shore', 'shore path', 'water path'],
    action: 'Follow the shore path',
    story:
      'Stone stair flights and level landings descend from the bridge to the tide.',
  },
  {
    id: 'ravenCove',
    name: 'Raven Cove',
    x: -16,
    z: -46,
    aliases: ['raven cove', 'cove'],
    action: 'Look across the water',
    story:
      'Look over Raven Cove from the dock, or board the boat to explore its open water.',
  },
  {
    id: 'bridge',
    name: 'Moonlit Viaduct',
    x: -13,
    z: -31,
    aliases: ['bridge', 'viaduct', 'moonlit viaduct'],
    action: 'Survey the crossing',
    story:
      'Moonlit Viaduct. Cross the old stone bridge to reach the watchtower. Keep to the lantern-lit deck above the sea.',
  },
  {
    id: 'bridgeView',
    name: 'Bridge View',
    x: -32,
    z: -31,
    aliases: ['bridge view', 'bridge viewpoint', 'viewpoint'],
    action: 'Look over the crossing',
    story:
      'Bridge View. The old viaduct stretches above the black water. No one crosses unseen.',
  },
  {
    id: 'ridge',
    name: 'Northern Lights Ridge',
    x: 8,
    z: -42,
    aliases: ['ridge', 'north', 'northern lights', 'northern lights ridge'],
    action: 'Watch the northern sky',
    story:
      'Northern Lights Ridge. Beyond the manor, the whole northern sea opens before you. This quiet corner belongs to the stars.',
  },
  {
    id: 'tower',
    name: 'The Last Watch',
    x: -47.7,
    z: -31,
    aliases: ['tower', 'watchtower', 'last watch', 'the last watch'],
    action: 'Ring the watch bell',
    story:
      'The bell of the Last Watch rings across the water. Once, its voice brought lost sailors home.',
  },
] as const;
export type PlaceId = (typeof islandPlaces)[number]['id'];
export const menuPlaces = islandPlaces.filter((place) =>
  (
    [
      'landing',
      'graves',
      'manor',
      'backyard',
      'boat',
      'bridge',
      'tower',
    ] as readonly string[]
  ).includes(place.id),
);
export type IslandCommand =
  | {
      type: 'portfolio';
      section: 'About & contact' | 'Skills' | 'Projects' | 'resume' | 'quick';
    }
  | { type: 'place'; id: PlaceId }
  | {
      type: 'action';
      action:
        | 'stop'
        | 'jump'
        | 'sit'
        | 'dance'
        | 'wave'
        | 'overview'
        | 'board'
        | 'leaveBoat'
        | 'swim';
    }
  | { type: 'door'; open: boolean; enter?: boolean }
  | { type: 'coffin'; index?: number; open: boolean }
  | {
      type: 'move';
      direction: 'forward' | 'back' | 'left' | 'right';
      run: boolean;
    }
  | { type: 'stop' | 'welcome' | 'help' | 'interact' };

export function parseIslandCommand(
  input: string,
  coffinCount: number,
): IslandCommand | null {
  const text = input
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[.!?,]+$/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text || /\b(dont|do not|never)\b/.test(text)) return null;
  if (
    /^(please )?(stop|stop walking|stop moving|halt|cancel|stay here)( please)?$/.test(
      text,
    )
  )
    return { type: 'stop' };
  if (/\b(resume|cv)\b/.test(text))
    return { type: 'portfolio', section: 'resume' };
  if (/\bprojects?\b/.test(text))
    return { type: 'portfolio', section: 'Projects' };
  if (/\bskills?\b/.test(text)) return { type: 'portfolio', section: 'Skills' };
  if (/\b(about|contact)\b/.test(text))
    return { type: 'portfolio', section: 'About & contact' };
  if (/\b(quick portfolio|view portfolio|show portfolio)\b/.test(text))
    return { type: 'portfolio', section: 'quick' };
  if (/\b(leave|exit|get off|disembark)\b.*\b(boat|water)\b/.test(text))
    return { type: 'action', action: 'leaveBoat' };
  if (/\b(board|enter|get in|ride|take)\b.*\b(boat|ship)\b/.test(text))
    return { type: 'action', action: 'board' };
  if (/\b(swim|go swimming|enter the water)\b/.test(text))
    return { type: 'action', action: 'swim' };
  if (/\b(jump|hop)\b/.test(text)) return { type: 'action', action: 'jump' };
  if (/\b(sit|sit down)\b/.test(text)) return { type: 'action', action: 'sit' };
  if (/\b(dance|dancing)\b/.test(text))
    return { type: 'action', action: 'dance' };
  if (/\b(look around|show surroundings|overview|whole island)\b/.test(text))
    return { type: 'action', action: 'overview' };
  if (/\b(welcome|introduce yourself|greet me)\b/.test(text))
    return { type: 'welcome' };
  if (/\b(wave|hello|greet)\b/.test(text))
    return { type: 'action', action: 'wave' };
  if (/^(help|commands|what can i say)$/.test(text)) return { type: 'help' };
  if (/^(interact|do it|use this|perform action)$/.test(text))
    return { type: 'interact' };
  const close = /\b(close|shut)\b/.test(text);
  if (/\b(coffin|coffins|tomb|casket)\b/.test(text)) {
    const match = text.match(
      /\b(?:coffin|coffins|tomb|casket)(?: number)?(?:\s+(-?\d+(?:\.\d+)?\w*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen))?\b/,
    );
    const words = [
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
      'nine',
      'ten',
      'eleven',
      'twelve',
      'thirteen',
      'fourteen',
    ];
    const value = match?.[1];
    const number = value
      ? words.includes(value)
        ? words.indexOf(value) + 1
        : Number(value)
      : undefined;
    if (
      number !== undefined &&
      (!Number.isInteger(number) || number < 1 || number > coffinCount)
    )
      return null;
    return {
      type: 'coffin',
      index: number === undefined ? undefined : number - 1,
      open: !close,
    };
  }
  if (
    /\bdoor\b/.test(text) ||
    /\benter (?:the )?(house|manor|mansion)\b/.test(text)
  )
    return { type: 'door', open: !close, enter: /\benter\b/.test(text) };
  const movement = text.match(
    /^(?:please )?(?:walk|move|go|run)(?: to the)? (forward|forwards|back|backward|backwards|left|right)(?: please)?$/,
  );
  if (movement)
    return {
      type: 'move',
      direction: movement[1].startsWith('back')
        ? 'back'
        : movement[1].startsWith('forward')
          ? 'forward'
          : (movement[1] as 'left' | 'right'),
      run: /\brun\b/.test(text),
    };
  for (const place of [...islandPlaces].sort(
    (a, b) => b.name.length - a.name.length,
  )) {
    if (
      [place.name.toLowerCase(), ...place.aliases].some((alias) =>
        new RegExp(`\\b${alias}\\b`).test(text),
      )
    )
      return { type: 'place', id: place.id };
  }
  if (/\b(light|beacon)\b/.test(text)) return { type: 'place', id: 'lookout' };
  if (/\b(ring|bell)\b/.test(text)) return { type: 'place', id: 'tower' };
  return null;
}

export const WELCOME = islandPlaces[0].story;
export function chooseMaleVoice<T extends { name: string; lang: string }>(
  voices: readonly T[],
): T | undefined {
  return voices.find(
    (voice) =>
      /^en(?:-|$)/i.test(voice.lang) &&
      !/female/i.test(voice.name) &&
      /\b(David|Mark|James|George|Daniel|Guy|Ryan|Christopher|Eric|Roger|Thomas|Arthur|Oliver|Ravi|Rishi|Prabhat|Male)\b/i.test(
        voice.name,
      ),
  );
}
let narrationEnabled = true;
export function setNarrationEnabled(enabled: boolean) {
  narrationEnabled = enabled;
  if (!enabled) stopIslandSpeech();
}
export function isNarrationEnabled() {
  return narrationEnabled;
}
let cancelPendingNarration: (() => void) | undefined;
export function speakIsland(
  text: string,
  options: {
    onEnd?: () => void;
    onUnavailable?: () => void;
    rate?: number;
  } = {},
) {
  if (!narrationEnabled) return false;
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  )
    return false;
  stopIslandSpeech();
  const voice = new SpeechSynthesisUtterance(text);
  voice.lang = 'en-US';
  voice.rate = options.rate ?? 0.78;
  voice.pitch = 0.72;
  voice.volume = 0.96;
  voice.onend = () => options.onEnd?.();
  voice.onerror = () => options.onEnd?.();
  const synth = window.speechSynthesis;
  const play = () => {
    const selected = chooseMaleVoice(synth.getVoices());
    if (!selected) return false;
    voice.voice = selected;
    voice.lang = selected.lang;
    synth.speak(voice);
    return true;
  };
  try {
    if (play()) return true;
  } catch {
    return false;
  }
  // Voice lists often arrive after page load. Never fall back to an unknown or
  // female default voice; captions remain available if no male voice is installed.
  const finish = () => {
    clearTimeout(timer);
    synth.removeEventListener('voiceschanged', changed);
    cancelPendingNarration = undefined;
  };
  const changed = () => {
    try {
      if (chooseMaleVoice(synth.getVoices())) {
        finish();
        play();
      }
    } catch {
      finish();
      options.onEnd?.();
    }
  };
  const timer = setTimeout(() => {
    finish();
    options.onUnavailable?.();
    options.onEnd?.();
  }, 1200);
  cancelPendingNarration = finish;
  synth.addEventListener('voiceschanged', changed);
  return true;
}

export function stopIslandSpeech() {
  cancelPendingNarration?.();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window)
    window.speechSynthesis.cancel();
}
