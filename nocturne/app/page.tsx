'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Entrance } from '@/components/entrance';
import { SceneBoundary } from '@/components/scene-boundary';
import { createAmbience } from '@/lib/ambience';
import { islandMode } from '@/lib/island-mode';
import type { Destination } from '@/lib/nocturne';

let islandModule:
  | Promise<typeof import('@/components/island-viewer')>
  | undefined;
const loadIsland = () =>
  (islandModule ??= import('@/components/island-viewer'));
function prepareIsland() {
  void loadIsland()
    .then((module) => module.preloadIslandAssets())
    .catch(() => {
      islandModule = undefined;
    });
}
const IslandViewer = lazy(loadIsland);
const Portfolio = lazy(() => import('@/components/portfolio'));

export default function Home() {
  const [scene, setScene] = useState<'entrance' | 'island'>('entrance');
  const [guided, setGuided] = useState(false);
  const [section, setSection] = useState<Destination | null>(null);
  const [audioError, setAudioError] = useState(false);
  const audio = useRef<ReturnType<typeof createAmbience> | null>(null);
  const sceneTitle = useRef<HTMLDivElement>(null);

  useEffect(() => () => audio.current?.close(), []);
  useEffect(() => {
    if (scene !== 'entrance' || section) return;
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      connection?.saveData ||
      /(^|-)2g$/.test(connection?.effectiveType ?? '')
    )
      return;
    let timer = 0,
      idle = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if ('requestIdleCallback' in window)
          idle = window.requestIdleCallback(prepareIsland, { timeout: 4000 });
        else prepareIsland();
      }, 2500);
    };
    // Let the first screen finish before optional 3D assets compete for bandwidth.
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('load', schedule);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, [scene, section]);
  useEffect(() => {
    sceneTitle.current?.focus();
  }, [scene]);

  function startSound() {
    if (audio.current?.running) return;
    try {
      if (!audio.current) {
        audio.current = createAmbience();
        let mode = islandMode(null);
        try {
          mode = islandMode(
            localStorage.getItem('nocturne-mode') ??
              localStorage.getItem('nocturne-daylight'),
          );
        } catch {}
        audio.current.setMode(mode);
      }
      // Resume in the original click/key event, before lazy loading the scene.
      // Further gestures also recover audio interrupted by the browser.
      void audio.current.resume().then(
        () => setAudioError(false),
        () => setAudioError(true),
      );
    } catch {
      setAudioError(true);
    }
  }

  function exploreIsland() {
    setScene('island');
  }
  const back = () => setScene('entrance');
  return (
    <div
      ref={sceneTitle}
      tabIndex={-1}
      className="nocturne-scene"
      aria-label="Nocturne"
      onClickCapture={startSound}
      onKeyDownCapture={startSound}
    >
      {scene === 'entrance' ? (
        <Entrance
          onPrepare={prepareIsland}
          onExplore={() => {
            setGuided(false);
            exploreIsland();
          }}
          onPortfolio={() => setSection('about')}
          audioError={audioError}
        />
      ) : (
        <SceneBoundary
          key={scene}
          fallback={
            <div className="entrance-transition" role="alert">
              <p>This part of the island could not open.</p>
              <Button variant="outline" onClick={back}>
                Back to the entrance
              </Button>
            </div>
          }
        >
          <Suspense
            fallback={
              <div className="entrance-transition" aria-live="polite">
                <span className="arrival-eyebrow">NOCTURNE · THE CROSSING</span>
                <h2>Beyond the gates.</h2>
                <p>Crossing the island...</p>
                <span className="arrival-progress" aria-hidden="true" />
                <Button variant="outline" onClick={back}>
                  Back to the entrance
                </Button>
              </div>
            }
          >
            <IslandViewer
              ambience={audio}
              audioError={audioError}
              onExit={back}
              onPortfolio={() => setSection('about')}
              active={!section}
              guided={guided}
            />
          </Suspense>
        </SceneBoundary>
      )}
      {section && (
        <Suspense fallback={null}>
          <Portfolio
            key={section}
            section={section}
            onClose={() => setSection(null)}
            onEnter={() => {
              setSection(null);
              setGuided(false);
              exploreIsland();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
