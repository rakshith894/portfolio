import { HOUSE_ROOMS } from './house-layout.ts';
import { MANOR_ORIGIN } from './reference-layout.ts';
import { MANOR_DOOR } from './manor-layout.ts';
import { walkingHeight } from './island-walk.ts';

/** Stable slots: additions never replace an existing hologram. */
export function skillPlacement(index: number) {
  const slot = Math.max(0, Math.floor(index));
  if (slot < 18) {
    const room = HOUSE_ROOMS[1]; // always Skills Room
    const col = slot % 3; // 0|1|2 → left / centre / right
    const row = Math.floor(slot / 3) % 2; // 0 = front half, 1 = back half
    const tier = Math.floor(slot / 6); // 0 = eye level, 1 = slightly higher
    const spread = Math.min(1.45, (room.width - 1.3) / 2);
    // Spread depth across the room so all cards are visible without looking up
    const zFront = room.z - room.depth / 4;
    const zBack = room.z + room.depth / 4;
    return {
      x: room.x + (col - 1) * spread,
      y: 1.55 + tier * 1.5,
      z: row === 0 ? zFront : zBack,
      area: room.name,
      indoors: true,
    };
  }
  const outdoor = slot - 18;
  // Three garden aisles; further collections rise in fixed tiers without paging.
  const x = 3 + (outdoor % 8) * 2,
    z = -40 - (Math.floor(outdoor / 8) % 3) * 2;
  return {
    x: x - MANOR_ORIGIN.x,
    y:
      walkingHeight(x, z) -
      MANOR_ORIGIN.y -
      MANOR_DOOR.y +
      1.7 +
      Math.floor(outdoor / 24) * 1.35,
    z: z - MANOR_ORIGIN.z - MANOR_DOOR.z,
    area: 'Backyard skills garden',
    indoors: false,
  };
}
