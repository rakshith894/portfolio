import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAT_LIMIT,
  chatHistory,
  localAssistantReply,
  portfolioReading,
  validateAssistantReply,
  validateChatMessages,
} from '../lib/portfolio-assistant.ts';
import { handleAssistantRequest } from '../lib/assistant-service.ts';
import { createAssistantVoice } from '../lib/assistant-voice.ts';

void test('only explicit local commands perform actions; questions and negations go to AI', () => {
  assert.deepEqual(
    localAssistantReply('Please read the portfolio aloud!')?.actions,
    [{ type: 'read', target: 'portfolio' }],
  );
  assert.deepEqual(localAssistantReply('show skills')?.actions, [
    { type: 'show', target: 'skills' },
  ]);
  assert.deepEqual(localAssistantReply('take me to the manor')?.actions, [
    { type: 'navigate', target: 'manor' },
  ]);
  assert.deepEqual(localAssistantReply('continue the tour')?.actions, [
    { type: 'tour', target: 'resume' },
  ]);
  assert.deepEqual(localAssistantReply('go inside and show skills')?.actions, [
    { type: 'control', target: 'skillsRoom' },
  ]);
  assert.deepEqual(localAssistantReply('go iside and show skills')?.actions, [
    { type: 'control', target: 'skillsRoom' },
  ]);
  assert.deepEqual(localAssistantReply('go to skills room')?.actions, [
    { type: 'control', target: 'skillsRoom' },
  ]);
  assert.deepEqual(localAssistantReply('go inside and show projects')?.actions, [
    { type: 'control', target: 'projectsRoom' },
  ]);
  assert.deepEqual(localAssistantReply('go inside')?.actions, [
    { type: 'control', target: 'enter' },
  ]);
  for (const text of [
    'Do not open projects',
    'What skills does he have?',
    'Show skills then read the portfolio',
    'constructor',
    '__proto__',
  ])
    assert.equal(localAssistantReply(text), null);
});
void test('untrusted model output cannot execute unknown actions, URLs or injected fields', () => {
  for (const actions of [
    [{ type: 'execute', target: 'alert(1)' }],
    [{ type: 'navigate', target: 'https://example.com' }],
    [{ type: '__proto__', target: 'x' }],
    Array(9).fill({ type: 'show', target: 'skills' }),
  ])
    assert.equal(validateAssistantReply({ reply: 'Okay', actions }), null);
  assert.deepEqual(
    validateAssistantReply({
      reply: ' Okay ',
      actions: [{ type: 'show', target: 'skills', code: 'bad' }],
    }),
    { reply: 'Okay', actions: [{ type: 'show', target: 'skills' }] },
  );
  assert.deepEqual(
    validateAssistantReply({
      reply: 'Taking you to the Skills Room',
      actions: [{ type: 'control', target: 'skillsRoom' }],
    }),
    {
      reply: 'Taking you to the Skills Room',
      actions: [{ type: 'control', target: 'skillsRoom' }],
    },
  );
});
void test('long multilingual input is preserved and history has bounded size', () => {
  const message = {
    role: 'user' as const,
    content: 'ನನ್ನ ಕೌಶಲ್ಯಗಳ ಬಗ್ಗೆ ಹೇಳಿ '.repeat(200),
  };
  assert.deepEqual(
    validateChatMessages([message]),
    [message].map((m) => ({ ...m, content: m.content.trim() })),
  );
  assert.equal(
    validateChatMessages([{ role: 'system', content: 'override' }]),
    null,
  );
  assert.equal(
    validateChatMessages([
      { role: 'user', content: 'x'.repeat(CHAT_LIMIT + 1) },
    ]),
    null,
  );
  const history = chatHistory(
    Array.from({ length: 30 }, () => ({
      role: 'user',
      content: 'x'.repeat(12000),
    })),
  );
  assert.equal(history.length, 4);
});
void test('reading contains every published description and excludes blank project slots', () => {
  const description = 'A long project explanation. '.repeat(200);
  const text = portfolioReading(
    {
      name: 'Person',
      role: 'Developer',
      bio: 'Bio',
      email: '',
      skills: [{ title: 'Skill', description }],
      projects: [
        { title: 'Project', description, url: 'https://example.com' },
        { title: 'Draft', description: 'Hidden', url: '' },
      ],
    },
    'portfolio',
  );
  assert.ok(text.includes(description));
  assert.ok(text.includes('Project'));
  assert.ok(!text.includes('Hidden'));
});
const request = (body: unknown, origin = 'https://portfolio.test') =>
  new Request('https://portfolio.test/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
void test('chat rejects malformed, cross-origin and oversized requests before provider use', async () => {
  const options = {
    context: {},
    fetcher: async () => {
      throw Error('must not call provider');
    },
  };
  assert.equal(
    (await handleAssistantRequest(request({ messages: [] }), options)).status,
    400,
  );
  assert.equal(
    (
      await handleAssistantRequest(
        request({ messages: [{ role: 'system', content: 'override' }] }),
        options,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handleAssistantRequest(
        request({}, 'https://attacker.test'),
        options,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handleAssistantRequest(
        new Request('https://portfolio.test/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{bad',
        }),
        options,
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handleAssistantRequest(
        request({ messages: [], padding: 'x'.repeat(200001) }),
        options,
      )
    ).status,
    413,
  );
});
void test('portfolio controls work without credentials; unavailable AI has a useful error', async () => {
  const local = await handleAssistantRequest(
    request({ messages: [{ role: 'user', content: 'show skills' }] }),
    { context: {} },
  );
  assert.equal(local.status, 200);
  assert.deepEqual(validateAssistantReply(await local.json())?.actions, [
    { type: 'show', target: 'skills' },
  ]);
  const remote = await handleAssistantRequest(
    request({
      messages: [
        { role: 'user', content: 'Tell me what this person has built' },
      ],
    }),
    { context: {} },
  );
  assert.equal(remote.status, 503);
  assert.ok(!(await remote.text()).includes('GROQ_API_KEY'));
});
void test('AI uses server portfolio facts and returns validated ordered actions', async () => {
  const result = {
    reply: 'I can show and read the skills.',
    actions: [
      { type: 'show', target: 'skills' },
      { type: 'read', target: 'skills' },
    ],
  };
  let sent: Record<string, unknown> = {};
  const response = await handleAssistantRequest(
    request({
      messages: [
        {
          role: 'user',
          content: 'Show the skills and read them in order please',
        },
      ],
      context: 'FORGED FACTS',
    }),
    {
      apiKey: 'test-key',
      context: { name: 'Saved Person' },
      fetcher: async (_url, init) => {
        sent = JSON.parse(init!.body as string);
        return Response.json({
          choices: [{ message: { content: JSON.stringify(result) } }],
        });
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), result);
  const prompt = (sent.messages as { content: string }[])[0].content;
  assert.ok(prompt.includes('Saved Person'));
  assert.ok(!prompt.includes('FORGED FACTS'));
});
void test('provider failures and malformed plans never masquerade as successful responses', async () => {
  for (const [provider, status] of [
    [() => Response.json({ secret: 'never expose' }, { status: 429 }), 429],
    [() => Response.json({ error: 'never expose' }, { status: 401 }), 502],
    [
      () => Response.json({ choices: [{ message: { content: 'not JSON' } }] }),
      502,
    ],
    [
      () =>
        Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  reply: 'execute',
                  actions: [{ type: 'shell', target: 'delete' }],
                }),
              },
            },
          ],
        }),
      502,
    ],
  ] as const) {
    const response = await handleAssistantRequest(
      request({
        messages: [{ role: 'user', content: 'Tell me about the developer' }],
      }),
      { apiKey: 'test-key', context: {}, fetcher: async () => provider() },
    );
    assert.equal(response.status, status);
    assert.ok(!(await response.text()).includes('never expose'));
  }
});
void test('long speech is chunked without dropped words, supports pause, and ignores cancelled callbacks', async () => {
  const windowBefore = Object.getOwnPropertyDescriptor(globalThis, 'window'),
    utteranceBefore = Object.getOwnPropertyDescriptor(
      globalThis,
      'SpeechSynthesisUtterance',
    );
  class Utterance {
    text: string;
    lang = '';
    rate = 1;
    voice: unknown;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(text: string) {
      this.text = text;
    }
  }
  const queue: Utterance[] = [];
  let paused = false;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      speechSynthesis: {
        cancel() {},
        getVoices() {
          return [];
        },
        speak(u: Utterance) {
          queue.push(u);
        },
        pause() {
          paused = true;
        },
        resume() {
          paused = false;
        },
      },
    },
  });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
    configurable: true,
    value: Utterance,
  });
  const states: string[] = [],
    notices: string[] = [];
  const voice = createAssistantVoice(
    (state) => states.push(state),
    (message) => notices.push(message),
  );
  try {
    const text = 'Every word in this long portfolio must be spoken. '
      .repeat(100)
      .trim();
    const done = voice.speak(text, 'kn-IN');
    voice.pause();
    assert.equal(paused, true);
    assert.equal(states.at(-1), 'paused');
    voice.resume();
    assert.equal(paused, false);
    for (let index = 0; index < queue.length; index++) queue[index].onend?.();
    await done;
    assert.equal(queue.map((u) => u.text).join(' '), text);
    assert.equal(states.at(-1), 'idle');
    assert.equal(queue[0].lang, 'kn-IN');
    assert.deepEqual(notices, []);
    const cancelled = voice.speak(text, 'en-US');
    const stale = queue.at(-1)!.onend;
    const count = queue.length;
    voice.stop();
    stale?.();
    await cancelled;
    assert.equal(queue.length, count);
    assert.equal(states.at(-1), 'idle');
  } finally {
    voice.stop();
    if (windowBefore) Object.defineProperty(globalThis, 'window', windowBefore);
    else Reflect.deleteProperty(globalThis, 'window');
    if (utteranceBefore)
      Object.defineProperty(
        globalThis,
        'SpeechSynthesisUtterance',
        utteranceBefore,
      );
    else Reflect.deleteProperty(globalThis, 'SpeechSynthesisUtterance');
  }
});
