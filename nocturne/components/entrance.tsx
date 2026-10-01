'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EntranceAtmosphere } from '@/components/entrance-atmosphere';

type Props = {
  onExplore: () => void;
  onPrepare: () => void;
  onPortfolio: () => void;
  onTour: () => void;
  audioError: boolean;
};

export function Entrance({
  onExplore,
  onPrepare,
  onPortfolio,
  onTour,
  audioError,
}: Props) {
  const [paused, setPaused] = useState(false);
  const [failedImage, setFailedImage] = useState(false);
  const [entering, setEntering] = useState(false);
  const departure = useRef({ frame: 0, timer: 0, active: false });
  useEffect(
    () => () => {
      cancelAnimationFrame(departure.current.frame);
      window.clearTimeout(departure.current.timer);
    },
    [],
  );
  const enter = () => {
    if (departure.current.active) return;
    departure.current.active = true;
    setEntering(true);
    onPrepare();
    // Paint the button feedback before the island builds its geometry.
    departure.current.frame = requestAnimationFrame(() => {
      departure.current.timer = window.setTimeout(onExplore, 0);
    });
  };
  return (
    <main
      className="entrance-scene portfolio-landing"
      data-paused={paused}
      aria-busy={entering}
      aria-label="Rakshith's portfolio"
    >
      <div className="entrance-viewport">
        <div className="entrance-artwork">
          <Image
            unoptimized
            className="entrance-image"
            src="/graveyard.webp"
            alt="A moonlit graveyard and a winding stone path leading to a Gothic house by the sea."
            width={1672}
            height={941}
            fetchPriority="high"
            loading="eager"
            draggable={false}
            onError={() => setFailedImage(true)}
          />
          {!failedImage && (
            <EntranceAtmosphere island={false} paused={paused} />
          )}
        </div>
      </div>
      <div className="landing-haze" aria-hidden="true" />
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
            aria-label={paused ? 'Resume atmosphere' : 'Pause atmosphere'}
          >
            {paused ? <Play /> : <Pause />}
          </Button>
        </div>
      </header>
      <section className="landing-copy">
        <p className="landing-eyebrow">
          <span /> CREATIVE DEVELOPER · A WORLD BUILDER
        </p>
        <h1>
          Some stories
          <br />
          refuse to stay
          <br />
          <em>buried.</em>
        </h1>
        <p className="landing-intro">
          I’m Rakshith. I build things for the web.
          <br />
          Follow the lights. Discover what lies beyond.
        </p>
        <div className="landing-actions">
          <Button
            className="landing-next"
            variant="outline"
            onPointerEnter={onPrepare}
            onFocus={onPrepare}
            onPointerDown={onPrepare}
            onClick={enter}
            disabled={entering}
            aria-label="Enter the island — explore my 3D portfolio"
          >
            <span>
              {entering ? 'Opening the gates…' : 'Enter the island'}{' '}
              <small>BEGIN THE JOURNEY</small>
            </span>
            <ArrowRight />
          </Button>
          <Button
            className="landing-work"
            variant="ghost"
            onClick={onPortfolio}
          >
            Quick portfolio <ArrowUpRight />
          </Button>
        </div>
        <Button
          className="landing-tour"
          variant="ghost"
          onPointerEnter={onPrepare}
          onFocus={onPrepare}
          onClick={onTour}
        >
          Take the narrated tour →
        </Button>
        <p className="landing-note">
          Explore freely, follow the guide, or go straight to the work.
        </p>
      </section>
      <footer className="landing-colophon">
        <span>
          <b>01</b> THE ARRIVAL
        </span>
        <p>A little curiosity goes a long way.</p>
      </footer>
      {audioError && (
        <output className="island-audio-note">
          Sound could not start. You can still explore.
        </output>
      )}
    </main>
  );
}
