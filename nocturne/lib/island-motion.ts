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
  const speed = 0.085,
    angle = time * speed + index * 0.09;
  const rx = 24 + (index % 3) * 1.1,
    rz = 27 + (index % 2) * 1.1;
  const x = -3 + Math.sin(angle) * rx,
    z = -15 + Math.cos(angle) * rz,
    y = 29.5 + Math.sin(angle * 2 + index * 0.25) * 1.8;
  const dx = Math.cos(angle) * rx,
    dz = -Math.sin(angle) * rz;
  const cycle = (time + index * 0.21) % 7.4;
  const envelope = cycle < 4.4 ? Math.sin((Math.PI * cycle) / 4.4) : 0;
  return {
    x,
    y,
    z,
    yaw: -Math.atan2(dz, dx),
    bank: -0.13 * Math.sin(angle),
    flap: 0.08 + Math.sin(time * 9.5 + index * 0.45) * 0.65 * envelope,
  };
}

export function advanceAtmosphere(
  previous: number,
  delta: number,
  paused: boolean,
) {
  return paused ? previous : previous + Math.max(0, Math.min(delta, 0.1));
}

/** Lower, staggered passes across the cemetery, plus a separate high flock. */
export function referenceCrowPose(time: number, index: number) {
  const near = index < 6;
  const angle = time * (near ? 0.265 : 0.145) + index * 2.399963 + 1.4;
  const rx = near ? 22 + index * 0.5 : 48 + (index - 6) * 4;
  const rz = near ? 13 : 29;
  const dx = Math.cos(angle) * rx,
    dz = -Math.sin(angle) * rz;
  const cycle = (time + index * 0.53) % 5.6;
  const flapEnvelope = cycle < 3.6 ? Math.sin((Math.PI * cycle) / 3.6) : 0;
  return {
    x: 9 + Math.sin(angle) * rx,
    y: (near ? 33 : 56) + Math.sin(angle * 2 + index) * (near ? 2 : 4),
    z: (near ? 8 : -24) + Math.cos(angle) * rz,
    yaw: -Math.atan2(dz, dx),
    bank: -0.2 * Math.sin(angle),
    flap: 0.08 + Math.sin(time * 10.8 + index * 0.6) * 0.72 * flapEnvelope,
  };
}
