import test from 'node:test';
import assert from 'node:assert/strict';
import {
  chooseMaleVoice,
  chooseNarrationVoice,
  speakIsland,
  stopIslandSpeech,
} from '../lib/island-commands.ts';
import { createIslandSoundCues } from '../lib/island-sound-cues.ts';

void test('narration selects an identified English male voice and never a female default', () => {
  const female = { name: 'Microsoft Zira Desktop', lang: 'en-US' },
    male = { name: 'Microsoft David Desktop', lang: 'en-US' };
  assert.equal(chooseMaleVoice([female, male]), male);
  assert.equal(
    chooseMaleVoice([female, { name: 'Google US English', lang: 'en-US' }]),
    undefined,
  );
  assert.equal(
    chooseMaleVoice([{ name: 'Female English', lang: 'en-US' }]),
    undefined,
  );
  assert.equal(chooseMaleVoice([{ name: 'Thomas', lang: 'fr-FR' }]), undefined);
});

void test('journey narration prefers the male voice and falls back to available English voices', () => {
  const phone = { name: 'Google US English', lang: 'en-US' };
  const male = { name: 'Microsoft David Desktop', lang: 'en-US' };
  assert.equal(chooseNarrationVoice([phone, male]), male);
  assert.equal(chooseNarrationVoice([phone]), phone);
  assert.equal(chooseNarrationVoice([]), undefined);
});

void test('cold voice lists speak immediately and cancelled utterances cannot finish a new journey', (context) => {
  const played: {
    text: string;
    onend: (() => void) | null;
    onerror: (() => void) | null;
  }[] = [];
  let resumed = 0,
    finished = 0,
    unavailable = 0;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalUtterance = Object.getOwnPropertyDescriptor(
    globalThis,
    'SpeechSynthesisUtterance',
  );
  context.after(() => {
    stopIslandSpeech();
    for (const [key, descriptor] of [
      ['window', originalWindow],
      ['SpeechSynthesisUtterance', originalUtterance],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      speechSynthesis: {
        getVoices: () => [],
        cancel: () => {},
        resume: () => resumed++,
        speak: (voice: (typeof played)[number]) => played.push(voice),
      },
    },
  });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    },
  });
  assert.equal(speakIsland('First place', { onEnd: () => finished++ }), true);
  assert.equal(
    played.length,
    1,
    'Speech queues in the user gesture without waiting for voiceschanged',
  );
  const stale = played[0].onend;
  speakIsland('Second place', {
    onEnd: () => finished++,
    onUnavailable: () => unavailable++,
  });
  stale?.();
  assert.equal(finished, 0);
  assert.equal(played[0].onend, null);
  played[1].onerror?.();
  assert.equal(finished, 1);
  assert.equal(unavailable, 1);
  assert.equal(resumed, 2);
  stopIslandSpeech();
});

void test('footsteps follow distance, gates sound on transitions, and nearby ghosts have cooldowns', () => {
  const events: string[] = [];
  const cues = createIslandSoundCues({
    step: () => events.push('step'),
    gate: () => events.push('gate'),
    ghost: () => events.push('ghost'),
  });
  cues.update(1, 0.4, false, false, 0, 0, 0);
  cues.update(2, 0.5, false, false, 0, 0, 0);
  assert.deepEqual(events, ['step']);
  cues.update(3, 2, true, true, 0, 0, 0);
  assert.equal(events.length, 1, 'Sailing does not produce footsteps');
  cues.update(4, 0, false, false, 0, 0, 0.5);
  cues.update(5, 0, false, false, 0, 0, 0.9);
  cues.update(8, 0, false, false, 0, 0, 0);
  assert.deepEqual(events, ['step', 'gate', 'gate']);
  cues.update(13, 0, false, false, 0, 0, 0);
  cues.update(14, 0, false, false, 0, 0, 0);
  assert.equal(events.filter((e) => e === 'ghost').length, 1);
  cues.update(70, 0, false, false, 200, 200, 0);
  assert.equal(
    events.filter((e) => e === 'ghost').length,
    1,
    'No haunting in the distant sea',
  );
});

void test('thunder follows lightning once per storm and bells stay on the island', () => {
  const events: string[] = [];
  const cues = createIslandSoundCues({
    step: () => {},
    gate: () => {},
    ghost: () => {},
    thunder: () => events.push('thunder'),
    bell: () => events.push('bell'),
  });
  for (const time of [0, 6, 7.7]) cues.update(time, 0, false, false, 0, 0, 0);
  assert.deepEqual(events, []);
  for (const time of [7.8, 7.9, 8, 9])
    cues.update(time, 0, false, false, 0, 0, 0);
  assert.deepEqual(events, ['thunder']);
  cues.update(44, 0, false, false, 0, 0, 0);
  assert.deepEqual(events, ['thunder', 'thunder', 'bell']);
  cues.update(100, 0, false, true, 200, 200, 0);
  assert.equal(events.filter((e) => e === 'bell').length, 1);
});

void test('narration can be muted independently of the ambient audio engine', async () => {
  const { setNarrationEnabled, isNarrationEnabled, speakIsland } =
    await import('../lib/island-commands.ts');
  try {
    setNarrationEnabled(false);
    assert.equal(isNarrationEnabled(), false);
    assert.equal(speakIsland('Muted explanation'), false);
    setNarrationEnabled(true);
    assert.equal(isNarrationEnabled(), true);
  } finally {
    setNarrationEnabled(true);
  }
});
