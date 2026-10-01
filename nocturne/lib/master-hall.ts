export type HallMode = 'day' | 'dark';
export type HallSettings = { mode: HallMode; lights: boolean };

export const MASTER_HALL = {
  id: 'master-hall',
  name: 'Projects Room',
  detail:
    'Tap a frame to explore a project. Switch collections to see more work. The contact hologram waits in the entrance hall.',
  x: 2.05,
  z: -5.325,
  width: 13.1,
  depth: 7.45,
  y: 5,
  height: 4.7,
};
export const HALL_GATE = { x: -4.5, z: -3.55, width: 1.8, height: 3.1, y: 5 };
export const DEFAULT_HALL_SETTINGS: HallSettings = {
  mode: 'day',
  lights: true,
};
export function hallLighting(settings: HallSettings) {
  return {
    ambient: settings.mode === 'day' ? 1.1 : 0.035,
    daylight: settings.mode === 'day' ? 2.4 : 0.06,
    lamps: settings.lights ? 1 : 0,
    windowGlow: settings.mode === 'day' ? 0.5 : 0.015,
  };
}
