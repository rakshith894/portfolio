export const galleries = [
  {
    level: 0,
    title: 'The entrance hall',
    room: 'The house remembers',
    accent: '#d4ad79',
    subtitle: 'Every door leads a little deeper.',
    story:
      'The gates settle behind you. A ledger lies open in the hall. Six levels are marked beneath the house, each holding a different part of Nocturne.',
    detail:
      'Choose a basement level in the lift. Walk the corridor, then open the illuminated display to explore the work.',
    tags: ['The mansion', 'Six galleries', 'Your pace'],
  },
  {
    level: 1,
    title: 'The interface archive',
    room: 'A place to begin',
    accent: '#97c9c5',
    subtitle: 'B1 / Interface & composition',
    story:
      'A pale screen hums in an otherwise silent room. The first record is an entrance: enough atmosphere to invite curiosity, enough clarity to find your way.',
    detail:
      'Nocturne combines a cinematic entrance with a quick portfolio that stays within reach. Shared React controls, responsive layouts, and readable content give visitors a direct route to the work.',
    tags: ['React', 'Responsive CSS', 'Composition'],
  },
  {
    level: 2,
    title: 'The motion study',
    room: 'Nothing stays still',
    accent: '#b7a2d1',
    subtitle: 'B2 / Animation & timing',
    story:
      'The pendulum moves. Its shadow arrives a moment later. Above, a traveller follows the lanterns through the graveyard.',
    detail:
      'The traveller walks and runs at the pace of the journey, turns toward destinations, and responds to jump, sit, wave, and dance commands. Calm mode reduces animation in the house.',
    tags: ['Locomotion', 'Character animation', 'Calm mode'],
  },
  {
    level: 3,
    title: 'The world workshop',
    room: 'Built from the ground up',
    accent: '#a7b690',
    subtitle: 'B3 / Environment & materials',
    story:
      'Stone fragments and an old survey table fill the workshop. On the wall, the island looks almost familiar. The coastline never quite repeats.',
    detail:
      'The estate uses an irregular island, continuous cliffs, detailed Gothic architecture, photographic surface maps, and a moonlit sky. Shared geometry and merged masonry keep repeated details efficient.',
    tags: ['Three.js', 'Materials', 'Geometry'],
  },
  {
    level: 4,
    title: 'The listening room',
    room: 'The walls are listening',
    accent: '#c5b78b',
    subtitle: 'B4 / Sound & navigation',
    story:
      'A receiver rests beside a lantern. There is no voice on the line, only the sea, and the faint suggestion that someone is waiting for directions.',
    detail:
      'Ambient audio begins only when you enable it. In supported browsers, optional voice commands use the same destinations as the navigator. Every route also works with a pointer or keyboard.',
    tags: ['Web Audio', 'Optional voice', 'Shared actions'],
  },
  {
    level: 5,
    title: 'The open passage',
    room: 'A way through for everyone',
    accent: '#92b3d0',
    subtitle: 'B5 / Access & resilience',
    story:
      'Unlike the other doors, this one has never been locked. A quiet passage leads back to the surface.',
    detail:
      'The portfolio is available without entering the 3D world. Keyboard controls, focus management, calm mode, and a fallback for unavailable WebGL keep the experience approachable.',
    tags: ['Keyboard access', 'Calm mode', 'Fallbacks'],
  },
  {
    level: 6,
    title: 'The final record',
    room: 'The story continues',
    accent: '#cc9b8e',
    subtitle: 'B6 / Nocturne',
    story:
      'At the lowest level, the last display is still lit. The record carries a single name: Nocturne. All the rooms above belong to the same work.',
    detail:
      'These six galleries explore the design and implementation of Nocturne. Additional projects, live demos, résumé details, and contact links can be added when Rakshith provides them.',
    tags: ['Nocturne', 'Interactive portfolio', 'Creative development'],
  },
] as const;

export type Gallery = (typeof galleries)[number];
export function isGalleryLevel(level: number) {
  return Number.isInteger(level) && level >= 0 && level < galleries.length;
}
