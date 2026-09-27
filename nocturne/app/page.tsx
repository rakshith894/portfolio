'use client';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Entrance } from '@/components/entrance';
import { SceneBoundary } from '@/components/scene-boundary';
import { createAmbience } from '@/lib/ambience';
import type { Destination } from '@/lib/nocturne';

const IslandViewer = lazy(() => import('@/components/island-viewer'));
const Mansion = lazy(() => import('@/components/mansion'));
const Portfolio = lazy(() => import('@/components/portfolio'));

export default function Home() {
  const [scene, setScene] = useState<'entrance' | 'island' | 'house'>(
    'entrance',
  );
  const [startAtHouse, setStartAtHouse] = useState(false);
  const [section, setSection] = useState<Destination | null>(null);
  const [sound, setSound] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const audio = useRef<ReturnType<typeof createAmbience> | null>(null);
  const audioBusy = useRef(false);
  const sceneTitle = useRef<HTMLDivElement>(null);

  useEffect(() => () => audio.current?.close(), []);
  useEffect(() => {
    sceneTitle.current?.focus();
  }, [scene]);

  async function toggleSound() {
    if (audioBusy.current) return;
    audioBusy.current = true;
    try {
      audio.current ??= createAmbience();
      await (sound ? audio.current.suspend() : audio.current.resume());
      setSound(!sound);
      setAudioError(false);
    } catch {
      setAudioError(true);
    } finally {
      audioBusy.current = false;
    }
  }

  function exploreIsland(fromHouse = false) {
    // The 3D viewer owns its ambience; avoid playing both soundscapes.
    if (audio.current) void audio.current.suspend().catch(() => {});
    setSound(false);
    setStartAtHouse(fromHouse);
    setScene('island');
  }
  const back = () => setScene('entrance');
  return (
    <div
      ref={sceneTitle}
      tabIndex={-1}
      className="nocturne-scene"
      aria-label="Nocturne"
    >
      {scene === 'entrance' ? (
        <Entrance
          onExplore={() => exploreIsland()}
          onPortfolio={() => setSection('projects')}
          sound={sound}
          onSound={toggleSound}
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
                <p>
                  {scene === 'house'
                    ? 'Opening the house…'
                    : 'Crossing the island…'}
                </p>
                <Button variant="outline" onClick={back}>
                  Back to the entrance
                </Button>
              </div>
            }
          >
            {scene === 'island' ? (
              <IslandViewer
                onExit={back}
                onHouse={() => setScene('house')}
                startAtHouse={startAtHouse}
              />
            ) : (
              <Mansion
                onExit={() => exploreIsland(true)}
                onPortfolio={setSection}
                sound={sound}
                onSound={toggleSound}
                audioError={audioError}
                quiet={quiet}
                onQuiet={() => setQuiet((value) => !value)}
                exitLabel="The island"
              />
            )}
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
              exploreIsland();
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
