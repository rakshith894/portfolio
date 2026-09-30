import { HOUSE_HALL, HOUSE_ROOMS } from './house-layout.ts';
import { UPPER_HALL } from './house-stairs.ts';

export type WindowOpening = {
  x: number; y: number; z: number;
  width: number; height: number; axis: 'x' | 'z';
  outward: 1 | -1;
};
// Shared by the indoor lining and exterior shell. Never put a window across
// the side-room doorway, as the old decorative panels did.
export const HOUSE_WINDOWS: WindowOpening[] = [
  ...[-7.1, -4, 4, 7.1].flatMap(x => [-1, 1].map(side => ({
    x, y: 2.8, z: HOUSE_HALL.z + side * HOUSE_HALL.depth / 2,
    width: 1.4, height: 2.6, axis: 'x' as const, outward: side as 1 | -1,
  }))),
  ...HOUSE_ROOMS.slice(2).map(room => ({
    x: room.x + Math.sign(room.x) * room.width / 2, y: 2.8, z: room.z,
    width: 1.8, height: 2.6, axis: 'z' as const, outward: Math.sign(room.x) as 1 | -1,
  })),
  ...[-7.1, -4, 4, 7.1].flatMap(x => [-1, 1].map(side => ({
    x, y: UPPER_HALL.y + 2.7,
    z: UPPER_HALL.z + side * UPPER_HALL.depth / 2,
    width: 1.4, height: 2.6, axis: 'x' as const, outward: side as 1 | -1,
  }))),
];

export type WallPiece = { x: number; y: number; z: number; width: number; height: number; depth: number };
/** Split boxes into solid piers, sill and lintel, including the reveal faces. */
export function windowedWall(source: WallPiece): WallPiece[] {
  let pieces = [source];
  for (const opening of HOUSE_WINDOWS) {
    const along = opening.axis, across = along === 'x' ? 'z' : 'x';
    const size = along === 'x' ? 'width' : 'depth';
    const thickness = along === 'x' ? 'depth' : 'width';
    pieces = pieces.flatMap(piece => {
      if (Math.abs(piece[across] - opening[across]) > piece[thickness] / 2 + .15) return [piece];
      const left = piece[along] - piece[size] / 2, right = piece[along] + piece[size] / 2;
      const bottom = piece.y - piece.height / 2, top = piece.y + piece.height / 2;
      const a = Math.max(left, opening[along] - opening.width / 2);
      const b = Math.min(right, opening[along] + opening.width / 2);
      const low = Math.max(bottom, opening.y - opening.height / 2);
      const high = Math.min(top, opening.y + opening.height / 2);
      if (a >= b || low >= high) return [piece];
      const result: WallPiece[] = [];
      for (const [start, end] of [[left, a], [b, right]])
        if (end - start > .0001) result.push({ ...piece, [along]: (start + end) / 2, [size]: end - start });
      for (const [start, end] of [[bottom, low], [high, top]])
        if (end - start > .0001) result.push({ ...piece, [along]: (a + b) / 2, [size]: b - a, y: (start + end) / 2, height: end - start });
      return result;
    });
  }
  return pieces;
}
