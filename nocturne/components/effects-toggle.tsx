'use client';
import { Sparkles } from 'lucide-react';
import { useLiveEffects } from '@/lib/live-effects';

export function EffectsToggle() {
  const [enabled] = useLiveEffects();
  return (
    <button
      type="button"
      className="effects-toggle"
      aria-pressed={enabled}
      aria-disabled="true"
    >
      <Sparkles size={13} /> Live effects: {enabled ? 'on' : 'off'}
    </button>
  );
}
