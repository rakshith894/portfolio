import { narrationChunks } from './portfolio-tour.ts';
export type VoiceState = 'idle' | 'speaking' | 'paused';
export type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start: () => void; stop: () => void; abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
export function recognitionConstructor() {
  const browser = window as typeof window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
/** Queue short utterances so a long portfolio never becomes one fragile utterance. */
export function createAssistantVoice(report: (state: VoiceState) => void, unavailable: (message: string) => void) {
  let generation = 0, state: VoiceState = 'idle', timer: ReturnType<typeof setTimeout> | undefined;
  let settle: (() => void) | undefined, current: SpeechSynthesisUtterance | null = null;
  const emit = (value: VoiceState) => { state = value; report(value); };
  const supported = () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  function stop() {
    generation++; clearTimeout(timer);
    if (current) { current.onend = null; current.onerror = null; current = null; }
    if (supported()) window.speechSynthesis.cancel();
    const done = settle; settle = undefined; done?.(); emit('idle');
  }
  function watch() {
    clearTimeout(timer);
    timer = setTimeout(() => { unavailable('Voice playback stalled. The full text is still in the chat; press Read aloud to retry.'); stop(); }, 90000);
  }
  function speak(text: string, lang: string): Promise<void> {
    stop();
    if (!supported()) { unavailable('Read aloud is unavailable in this browser. The full response remains in the chat.'); return Promise.resolve(); }
    const token = generation, chunks = narrationChunks(text, 220); let index = 0;
    return new Promise(resolve => {
      settle = resolve;
      const next = () => {
        if (token !== generation) return;
        const chunk = chunks[index++];
        if (!chunk) { clearTimeout(timer); current = null; settle = undefined; emit('idle'); resolve(); return; }
        const synth = window.speechSynthesis, utterance = new SpeechSynthesisUtterance(chunk);
        current = utterance; utterance.lang = lang; utterance.rate = 1;
        const voices = synth.getVoices();
        const voice = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase()) ?? voices.find(v => v.lang.split('-')[0] === lang.split('-')[0]);
        if (voice) utterance.voice = voice;
        utterance.onend = next;
        utterance.onerror = () => { if (token !== generation) return; unavailable('Voice playback was interrupted. You can read or replay the response.'); stop(); };
        emit('speaking'); watch();
        try { synth.speak(utterance); } catch { unavailable('Voice playback could not start. Try Read aloud again.'); stop(); }
      };
      next();
    });
  }
  return { speak, stop,
    pause: () => { if (state !== 'speaking' || !supported()) return; clearTimeout(timer); window.speechSynthesis.pause(); emit('paused'); },
    resume: () => { if (state !== 'paused' || !supported()) return; window.speechSynthesis.resume(); emit('speaking'); watch(); },
  };
}
