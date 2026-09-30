export type IslandMode = 'day' | 'night' | 'winter';
export const ISLAND_MODES = ['day', 'night', 'winter'] as const;
export function islandMode(value: string | null): IslandMode {
  return value === 'day' || value === 'winter' ? value : 'night';
}
