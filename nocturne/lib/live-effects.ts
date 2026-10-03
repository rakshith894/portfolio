'use client';
import { useEffect, useState } from 'react';

export function useLiveEffects() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const update = (event?: Event) => {
      let preference: string | null = null;
      try {
        preference = localStorage.getItem('nocturne-effects');
      } catch {}
      if (event instanceof CustomEvent)
        preference = event.detail ? 'on' : 'off';
      const next = preference ? preference === 'on' : !query.matches;
      document.documentElement.dataset.liveEffects = next ? 'on' : 'off';
      setEnabled(next);
    };
    update();
    query.addEventListener('change', update);
    window.addEventListener('nocturne-effects-change', update);
    return () => {
      query.removeEventListener('change', update);
      window.removeEventListener('nocturne-effects-change', update);
    };
  }, []);
  return [
    enabled,
    () => {
      const next = !enabled;
      try {
        localStorage.setItem('nocturne-effects', next ? 'on' : 'off');
      } catch {}
      document.documentElement.dataset.liveEffects = next ? 'on' : 'off';
      setEnabled(next);
      window.dispatchEvent(
        new CustomEvent('nocturne-effects-change', { detail: next }),
      );
    },
  ] as const;
}
