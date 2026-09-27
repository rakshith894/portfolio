'use client';
import { useEffect, useRef } from 'react';

// Coordinates belong to the unmodified 1672 × 941 artwork, not the viewport.
type Light = { x: number; y: number; size: number; candle?: boolean };
const ENTRANCE_LIGHTS: Light[] = [
  { x: 1334, y: 874, size: 16, candle: true },
  { x: 1320, y: 883, size: 3, candle: true },
  { x: 1347, y: 892, size: 3, candle: true },
  { x: 1354, y: 893, size: 2.5, candle: true },
  { x: 1097, y: 696, size: 7, candle: true },
  { x: 1087, y: 703, size: 3, candle: true },
  { x: 1107, y: 709, size: 3, candle: true },
  { x: 1332, y: 582, size: 3, candle: true },
  { x: 1339, y: 577, size: 4, candle: true },
  { x: 1540, y: 479, size: 4, candle: true },
  { x: 1547, y: 486, size: 3, candle: true },
  { x: 1394, y: 496, size: 9 },
  { x: 1208, y: 349, size: 6 },
  { x: 1302, y: 343, size: 6 },
];
const ISLAND_LIGHTS: Light[] = [
  { x: 1188, y: 438, size: 4 },
  { x: 1207, y: 439, size: 4 },
  { x: 1150, y: 370, size: 3 },
  { x: 1080, y: 301, size: 3 },
  { x: 1105, y: 301, size: 3 },
];

export function EntranceAtmosphere({
  island,
  paused,
}: {
  island: boolean;
  paused: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const surface = canvas.current;
    const context = surface?.getContext('2d');
    if (!surface || !context) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const lights = island ? ISLAND_LIGHTS : ENTRANCE_LIGHTS;
    let frame = 0,
      previous = 0,
      lastDraw = 0,
      elapsed = 0;

    function resize() {
      if (!surface || !context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      surface.width = Math.max(1, Math.round(surface.clientWidth * ratio));
      surface.height = Math.max(1, Math.round(surface.clientHeight * ratio));
      context.setTransform(
        surface.width / 1672,
        0,
        0,
        surface.height / 941,
        0,
        0,
      );
    }
    const observer = new ResizeObserver(resize);
    observer.observe(surface);
    resize();

    function glow(x: number, y: number, radius: number, strength: number) {
      if (!context) return;
      const light = context.createRadialGradient(x, y, 0, x, y, radius);
      light.addColorStop(0, `rgba(255, 183, 79, ${strength})`);
      light.addColorStop(0.24, `rgba(245, 127, 40, ${strength * 0.45})`);
      light.addColorStop(1, 'rgba(236, 100, 25, 0)');
      context.fillStyle = light;
      context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }

    function draw(now: number) {
      frame = requestAnimationFrame(draw);
      const delta = previous ? Math.min((now - previous) / 1000, 0.06) : 0;
      previous = now;
      if (document.hidden) return;
      const still = pausedRef.current || motion.matches;
      if (!still) elapsed += delta;
      if (now - lastDraw < 1000 / 30) return;
      lastDraw = now;
      context!.clearRect(0, 0, 1672, 941);
      // Reduced motion and pause show the untouched, already illuminated image.
      if (still) return;
      context!.globalCompositeOperation = 'screen';
      for (const [index, light] of lights.entries()) {
        const t = elapsed + index * 2.31;
        const flicker =
          0.72 + Math.sin(t * 8.3) * 0.13 + Math.sin(t * 17.1) * 0.09;
        const sway = Math.sin(t * 5.1) * light.size * 0.16;
        glow(
          light.x,
          light.y - light.size * 0.3,
          light.size * 5.5,
          0.22 * flicker,
        );
        if (!light.candle) {
          glow(light.x, light.y, light.size, 0.33 * flicker);
          continue;
        }
        const height = light.size * (1.15 + flicker * 0.5);
        const width = light.size * 0.32;
        const flame = context!.createLinearGradient(
          light.x,
          light.y,
          light.x,
          light.y - height,
        );
        flame.addColorStop(0, 'rgba(255, 174, 58, .4)');
        flame.addColorStop(0.4, 'rgba(255, 219, 146, .9)');
        flame.addColorStop(1, 'rgba(255, 151, 50, 0)');
        context!.fillStyle = flame;
        context!.beginPath();
        context!.moveTo(light.x, light.y);
        context!.bezierCurveTo(
          light.x - width,
          light.y - height * 0.2,
          light.x - width + sway,
          light.y - height * 0.55,
          light.x + sway,
          light.y - height,
        );
        context!.bezierCurveTo(
          light.x + width + sway,
          light.y - height * 0.45,
          light.x + width,
          light.y - height * 0.12,
          light.x,
          light.y,
        );
        context!.fill();
        // A small, soft reflected pool follows the wet stones below each candle.
        context!.save();
        context!.translate(light.x, light.y + light.size * 1.8);
        context!.scale(1, 0.22);
        glow(0, 0, light.size * 3, flicker * 0.055);
        context!.restore();
      }
    }
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [island]);

  return <canvas ref={canvas} className="entrance-fire" aria-hidden="true" />;
}
