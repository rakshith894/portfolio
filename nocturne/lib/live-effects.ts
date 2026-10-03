'use client';
import { useEffect } from 'react';

export function useLiveEffects() {
  useEffect(() => {
    document.documentElement.dataset.liveEffects = 'on';
  }, []);
  return [true] as const;
}
