'use client';
import { Sparkles } from 'lucide-react';
import { useLiveEffects } from '@/lib/live-effects';

export function EffectsToggle() {
  const [enabled, toggle] = useLiveEffects();
  return (
    <button
      type="button"
      className="effects-toggle"
      aria-pressed={enabled}
      onClick={toggle}
    >
      <Sparkles size={13} /> Live effects: {enabled ? 'on' : 'off'}
    </button>
  );
}
