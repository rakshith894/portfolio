// The shore steps, dock, and walking surface share this sea-level datum.
export const SEA_LEVEL = 0;
export const waves = [
  { amplitude: 0.98, x: 0.94, z: 0.342, wavelength: 27, speed: 1.3, phase: 0 },
  {
    amplitude: 0.61,
    x: -0.35,
    z: 0.937,
    wavelength: 15,
    speed: 1.8,
    phase: 1.8,
  },
  { amplitude: 0.34, x: 0.3, z: 0.954, wavelength: 9, speed: 2.4, phase: 2.4 },
] as const;

export function oceanSample(x: number, z: number, time: number) {
  let height = SEA_LEVEL,
    dx = 0,
    dz = 0;
  for (const wave of waves) {
    const k = (Math.PI * 2) / wave.wavelength;
    const phase =
      k * (wave.x * x + wave.z * z) - wave.speed * time + wave.phase;
    height += wave.amplitude * Math.sin(phase);
    const slope = wave.amplitude * k * Math.cos(phase);
    dx += slope * wave.x;
    dz += slope * wave.z;
  }
  const length = Math.hypot(dx, 1, dz);
  return {
    height,
    normal: { x: -dx / length, y: 1 / length, z: -dz / length },
  };
}

const number = (value: number) =>
  Number.isInteger(value) ? `${value}.0` : String(value);
// Generate the GPU equation from the same parameters used by breaching fish.
export const oceanGLSL = `vec3 oceanSample(vec2 p, float time) { vec3 result=vec3(0.0); ${waves.map((w) => `{float k=${number((Math.PI * 2) / w.wavelength)};vec2 direction=vec2(${number(w.x)},${number(w.z)});float phase=k*dot(direction,p)-${number(w.speed)}*time+${number(w.phase)};result.x+=${number(w.amplitude)}*sin(phase);result.yz+=${number(w.amplitude)}*k*cos(phase)*direction;}`).join('')} return result; }`;

export const fishRoutes = [
  {
    x: -54,
    z: 24,
    heading: 0.35,
    start: 5,
    period: 31,
    duration: 3.6,
    height: 5.3,
    travel: 10,
  },
  {
    x: 47,
    z: 35,
    heading: 2.5,
    start: 17,
    period: 43,
    duration: 3.9,
    height: 4.7,
    travel: 11,
  },
  {
    x: -33,
    z: 55,
    heading: -0.7,
    start: 28,
    period: 53,
    duration: 3.8,
    height: 5.8,
    travel: 10,
  },
] as const;

export function fishPose(time: number, index: number) {
  const route = fishRoutes[index % fishRoutes.length];
  const elapsed = time < route.start ? -1 : (time - route.start) % route.period;
  const progress = Math.max(0, Math.min(1, elapsed / route.duration));
  const dx = Math.cos(route.heading),
    dz = Math.sin(route.heading);
  const x = route.x + (progress - 0.5) * route.travel * dx,
    z = route.z + (progress - 0.5) * route.travel * dz;
  // Begin and end fully below the surface so visibility never pops at a breach.
  const diveDepth = 3.1,
    arcHeight = route.height + diveDepth;
  const landingProgress = 0.5 + 0.5 * Math.sqrt(route.height / arcHeight);
  const landingTime = landingProgress * route.duration;
  return {
    active: elapsed >= 0 && elapsed <= route.duration,
    elapsed,
    progress,
    x,
    z,
    y:
      oceanSample(x, z, time).height +
      4 * arcHeight * progress * (1 - progress) -
      diveDepth,
    yaw: -route.heading,
    pitch: Math.atan2(4 * arcHeight * (1 - 2 * progress), route.travel),
    splash:
      elapsed >= landingTime && elapsed < landingTime + 3.2
        ? (elapsed - landingTime) / 3.2
        : -1,
    splashX: route.x + (landingProgress - 0.5) * route.travel * dx,
    splashZ: route.z + (landingProgress - 0.5) * route.travel * dz,
  };
}

export function crowPose(time: number, index: number) {
  return travellingCrowPose(time, index, false);
}

export function advanceAtmosphere(
  previous: number,
  delta: number,
  paused: boolean,
) {
  return paused ? previous : previous + Math.max(0, Math.min(delta, 0.1));
}

/** Low cemetery crossings and high coastal flyovers, rather than fixed orbits. */
export function referenceCrowPose(time: number, index: number) {
  return travellingCrowPose(time, index, true);
}

function travellingCrowPose(time: number, index: number, reference: boolean) {
  const near = index < 6;
  const duration = (near ? 34 : 42) + (index % 3) * 4;
  const period = duration + 7 + (index % 4) * 2;
  const shifted = Math.max(0, time) + index * 7.7 + duration * 0.32;
  const flight = Math.floor(shifted / period);
  const elapsed = shifted - flight * period;
  const progress = Math.min(1, elapsed / duration);
  const seed = index * 2.399963 + flight * 1.618034;
  // Lower birds cross the front cemetery, keeping clear of the manor and tower.
  // Higher birds change their compass bearing on each visit to the island.
  const bearing = near ? ((index + flight) % 2) * Math.PI : seed;
  const forwardX = Math.cos(bearing),
    forwardZ = Math.sin(bearing);
  const length = near ? 290 : 370;
  const distance = (progress - 0.5) * length;
  const sway = Math.sin(progress * Math.PI * 2 + seed) * (near ? 5 : 13);
  const swayVelocity =
    (Math.cos(progress * Math.PI * 2 + seed) * (near ? 5 : 13) * Math.PI * 2) /
    duration;
  const speed = length / duration;
  const dx = forwardX * speed - forwardZ * swayVelocity;
  const dz = forwardZ * speed + forwardX * swayVelocity;
  const smooth = (value: number) => {
    const t = Math.max(0, Math.min(1, value));
    return t * t * (3 - 2 * t);
  };
  // Every new route begins and ends out at sea while the bird is invisible.
  const opacity =
    elapsed >= duration
      ? 0
      : smooth(progress / 0.09) * smooth((1 - progress) / 0.09);
  const cycle = (Math.max(0, time) + index * 0.53) % 5.6;
  const envelope = cycle < 3.6 ? Math.sin((Math.PI * cycle) / 3.6) : 0;
  const verticalPhase = progress * Math.PI * 2 + seed;
  const lift = near ? 1.2 : 2.5;
  const dy = (Math.cos(verticalPhase) * lift * Math.PI * 2) / duration;
  const swayAcceleration =
    -Math.sin(verticalPhase) *
    (near ? 5 : 13) *
    ((Math.PI * 2) / duration) ** 2;
  return {
    x: (reference ? 9 : -3) + forwardX * distance - forwardZ * sway,
    y: (near ? 34 : 70) + Math.sin(verticalPhase) * lift,
    z:
      (near ? 10 + (index % 3) * 6 + Math.sin(seed) * 3 : -24) +
      forwardZ * distance +
      forwardX * sway,
    yaw: -Math.atan2(dz, dx),
    pitch: Math.atan2(dy, Math.hypot(dx, dz)),
    bank: Math.max(-0.3, Math.min(0.3, -Math.atan2(swayAcceleration, 9.81))),
    flap: 0.08 + Math.sin(time * 10.8 + index * 0.6) * 0.72 * envelope,
    opacity,
  };
}
