type JourneySpeech = (text: string, finished: () => void) => boolean;

/** Keeps speech, camera-facing pauses and captions together, including cancellation. */
export function createJourneyGuide(
  speak: JourneySpeech,
  stop: () => void,
  caption: (text: string) => void,
) {
  let generation = 0,
    elapsed = 0,
    finished = false,
    available = false;
  let phase: 'departure' | 'arrival' | null = null;
  function cancel() {
    generation++;
    phase = null;
    stop();
    caption('');
  }
  function announce(kind: 'departure' | 'arrival', place: string) {
    cancel();
    const token = generation;
    phase = kind;
    elapsed = 0;
    finished = false;
    const text =
      kind === 'departure'
        ? `We're heading to ${place}.`
        : `We've arrived at ${place}.`;
    caption(text);
    available = speak(text, () => {
      if (generation === token) finished = true;
    });
  }
  return {
    announce,
    cancel,
    get facingCamera() {
      return phase === 'arrival' || (phase === 'departure' && elapsed < 0.25);
    },
    get holdingDeparture() {
      return phase === 'departure' && elapsed < 0.25;
    },
    update(dt: number) {
      if (!phase) return;
      elapsed += Math.max(0, Math.min(dt, 0.1));
      // Speech engines can be missing, blocked, or fail to emit an end event.
      if (
        (available && finished && elapsed >= 1.8) ||
        (!available && elapsed >= 3) ||
        elapsed >= 7
      ) {
        cancel();
      }
    },
  };
}
