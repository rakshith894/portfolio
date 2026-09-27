'use client';
import Image from 'next/image';
import { useState } from 'react';
import { ArrowRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntranceAtmosphere } from '@/components/entrance-atmosphere';

type Props = {
  onExplore: () => void;
  onPortfolio: () => void;
  sound: boolean;
  onSound: () => void;
  audioError: boolean;
};

export function Entrance({ onExplore, onPortfolio, sound, onSound, audioError }: Props) {
  const [paused, setPaused] = useState(false);
  const [failedImage, setFailedImage] = useState(false);
  return (
    <main
      className="entrance-scene portfolio-landing"
      aria-label="Rakshith's portfolio"
    >
      <div className="entrance-viewport">
        <div className="entrance-artwork">
          <Image
            unoptimized
            className="entrance-image"
            src="/graveyard.png"
            alt="A moonlit graveyard and a winding stone path leading to a Gothic house by the sea."
            width={1672}
            height={941}
            fetchPriority="high"
            draggable={false}
            onError={() => setFailedImage(true)}
          />
          {!failedImage && (
            <EntranceAtmosphere island={false} paused={paused} />
          )}
        </div>
      </div>
      <header className="entrance-header">
        <div className="entrance-brand">
          <p className="landing-wordmark">NOCTURNE.</p>
          <span>A PORTFOLIO BY RAKSHITH</span>
        </div>
        <div className="entrance-tools">
          <Button
            variant="ghost"
            size="icon"
            className="entrance-motion"
            onClick={() => setPaused((value) => !value)}
            aria-pressed={paused}
            aria-label={paused ? 'Resume candle flames' : 'Pause candle flames'}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="entrance-sound"
            onClick={onSound}
            aria-label={sound ? 'Mute ambience' : 'Enable ambience'}
            aria-pressed={sound}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>
      </header>
      <section className="landing-copy">
        <p className="landing-eyebrow">CREATIVE DEVELOPER</p>
        <h1>
          Every story
          <br />
          has a beginning.
        </h1>
        <p className="landing-intro">
          I’m Rakshith. Welcome to my world.
          <br />
          Follow the path to discover what I create.
        </p>
        <Button
          className="landing-next"
          variant="outline"
          onClick={onExplore}
          aria-label="Next — enter my 3D portfolio"
        >
          <span>
            Next <small>MY PORTFOLIO</small>
          </span>
          <ArrowRight />
        </Button>
        <p className="landing-note">
          An interactive journey through the graveyard.
        </p>
        <Button variant="ghost" onClick={onPortfolio}>
          View portfolio
        </Button>
      </section>
      {audioError && (
        <output className="island-audio-note">
          Sound could not start. You can still explore.
        </output>
      )}
    </main>
  );
}
