/** Shared tread surfaces for the west staircase and the upstairs hall. */
export const UPPER_HALL = {
  id: 'upper-hall',
  name: 'The west landing',
  detail: 'Open the side door to the Projects Room, or follow the stairs down.',
  x: 0,
  z: -5.325,
  width: 17.2,
  depth: 7.45,
  y: 5,
  height: 4.7,
};
export const HOUSE_STAIRS = {
  start: -3.2,
  end: -7.6,
  back: -8.45,
  width: 1.25,
  x: -6.4,
  left: -7.225,
  right: -5.575,
  steps: 16,
  rise: UPPER_HALL.y / 32,
};
export const STAIR_WELL = {
  x: HOUSE_STAIRS.x,
  z: -5.825,
  width: 3.1,
  depth: 5.25,
};
const contains = (
  point: { x: number; z: number },
  rect: { x: number; z: number; width: number; depth: number },
  inset = 0,
) =>
  Math.abs(point.x - rect.x) <= rect.width / 2 - inset &&
  Math.abs(point.z - rect.z) <= rect.depth / 2 - inset;
export function inStairWell(point: { x: number; z: number }) {
  return contains(point, STAIR_WELL);
}
export function stairHeight(point: { x: number; z: number }): number | null {
  const s = HOUSE_STAIRS;
  if (point.z <= s.end && point.z >= s.back && Math.abs(point.x - s.x) <= 1.45)
    return UPPER_HALL.y / 2;
  if (point.z < s.end || point.z > s.start) return null;
  const tread = (s.start - s.end) / s.steps;
  if (Math.abs(point.x - s.left) <= s.width / 2)
    return Math.min(s.steps, Math.ceil((s.start - point.z) / tread)) * s.rise;
  if (Math.abs(point.x - s.right) <= s.width / 2)
    return (
      UPPER_HALL.y / 2 +
      Math.min(s.steps, Math.ceil((point.z - s.end) / tread)) * s.rise
    );
  return null;
}
export function houseSurface(
  point: { x: number; z: number },
  fromHeight: number,
): number | null {
  const stair = stairHeight(point);
  const heights: number[] = [];
  // The timber flights are open underneath. Preserve the ground-floor route
  // to the west wing where the underside has full standing headroom.
  const overhead =
    stair ??
    (inStairWell(point)
      ? stairHeight({
          x: point.x < HOUSE_STAIRS.x ? HOUSE_STAIRS.left : HOUSE_STAIRS.right,
          z: point.z,
        })
      : null);
  if (overhead !== null && overhead - 0.22 >= 1.82) heights.push(0);
  const flight = point.z > HOUSE_STAIRS.end && point.z <= HOUSE_STAIRS.start;
  const clearOfRail = flight
    ? Math.min(
        Math.abs(point.x - HOUSE_STAIRS.left),
        Math.abs(point.x - HOUSE_STAIRS.right),
      ) <=
      HOUSE_STAIRS.width / 2 - 0.28
    : Math.abs(point.x - HOUSE_STAIRS.x) <= 1.17;
  if (stair !== null && clearOfRail) heights.push(stair);
  // The solid flights occupy their footprint on the ground floor.
  else if (!inStairWell(point)) heights.push(0);
  // Keep the thin central gap closed at ground level, too.
  const railMargin = contains(point, STAIR_WELL, -0.28);
  const topOpening =
    point.z > HOUSE_STAIRS.start &&
    Math.abs(point.x - HOUSE_STAIRS.right) <= HOUSE_STAIRS.width / 2 - 0.28;
  if (
    contains(point, UPPER_HALL, 0.36) &&
    !inStairWell(point) &&
    (!railMargin || topOpening)
  )
    heights.push(UPPER_HALL.y);
  return (
    heights.find((height) => Math.abs(height - fromHeight) <= 0.19) ?? null
  );
}
export const STAIR_TREADS = [-1, 1].flatMap((side) =>
  Array.from({ length: HOUSE_STAIRS.steps }, (_, index) => {
    const s = HOUSE_STAIRS,
      going = (s.start - s.end) / s.steps;
    return {
      x: side < 0 ? s.left : s.right,
      z:
        side < 0
          ? s.start - (index + 0.5) * going
          : s.end + (index + 0.5) * going,
      y: (side < 0 ? 0 : UPPER_HALL.y / 2) + (index + 1) * s.rise,
      width: s.width,
      depth: going,
    };
  }),
);
