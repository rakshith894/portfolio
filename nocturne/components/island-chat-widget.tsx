'use client';
import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  type Ref,
} from 'react';
import {
  Bot,
  X,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CHAT_LIMIT,
  chatHistory,
  localAssistantReply,
  portfolioReading,
  validateAssistantReply,
  type ChatMessage,
  type AssistantAction,
  type AssistantReply,
  type PortfolioContent,
} from '@/lib/portfolio-assistant';
import {
  createAssistantVoice,
  recognitionConstructor,
  type Recognition,
  type VoiceState,
} from '@/lib/assistant-voice';
import { stopIslandSpeech } from '@/lib/island-commands';

export type AssistantHandle = { startVoice: () => void };
type Props = PortfolioContent & {
  ref?: Ref<AssistantHandle>;
  active?: boolean;
  onAction: (action: AssistantAction) => string | void;
  onVoiceStart: () => void;
};
const languages = [
  ['en-US', 'English'],
  ['en-IN', 'English (India)'],
  ['kn-IN', 'ಕನ್ನಡ'],
  ['hi-IN', 'हिन्दी'],
  ['ta-IN', 'தமிழ்'],
  ['te-IN', 'తెలుగు'],
  ['ml-IN', 'മലയാളം'],
  ['es-ES', 'Español'],
  ['fr-FR', 'Français'],
  ['de-DE', 'Deutsch'],
  ['ja-JP', '日本語'],
  ['ar-SA', 'العربية'],
];
export function IslandChatWidget({
  ref,
  active = true,
  onAction,
  onVoiceStart,
  ...content
}: Props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Welcome! Ask about ' +
        content.name +
        ', show a section, or say “read the portfolio”. I can also guide you around the island. Use the microphone to dictate a longer request.',
    },
  ]);
  const [input, setInput] = useState(''),
    [loading, setLoading] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [listening, setListening] = useState(false),
    [voiceMode, setVoiceMode] = useState(false);
  const [language, setLanguage] = useState('en-US'),
    [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const scrollRef = useRef<HTMLDivElement>(null),
    inputRef = useRef<HTMLTextAreaElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const voice = useRef<ReturnType<typeof createAssistantVoice> | null>(null);
  const request = useRef<AbortController | null>(null),
    version = useRef(0),
    busy = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function detachRecognition() {
    const previous = recognition.current;
    recognition.current = null;
    if (previous) {
      previous.onresult = null;
      previous.onerror = null;
      previous.onend = null;
      previous.abort();
    }
  }
  function cancel() {
    version.current++;
    request.current?.abort();
    request.current = null;
    detachRecognition();
    setListening(false);
    voice.current?.stop();
    busy.current = false;
    setLoading(false);
  }
  function close() {
    cancel();
    setOpen(false);
    trigger.current?.focus();
  }
  function stopAll() {
    cancel();
    stopIslandSpeech();
    onAction({ type: 'control', target: 'stop' });
    setNotice('Stopped.');
  }
  function startListening() {
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    cancel();
    onVoiceStart();
    stopIslandSpeech();
    setError('');
    const Constructor = recognitionConstructor();
    if (!Constructor) {
      setNotice(
        'Voice input is unavailable in this browser. You can type the same requests below.',
      );
      return;
    }
    const recognizer = new Constructor();
    recognition.current = recognizer;
    const prefix = input.trim();
    recognizer.lang = language;
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.onresult = (event) => {
      if (recognition.current !== recognizer) return;
      const words = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ');
      const transcript = [prefix, words].filter(Boolean).join(' ');
      setInput(transcript.slice(0, CHAT_LIMIT));
      if (transcript.length >= CHAT_LIMIT) {
        recognizer.stop();
        setNotice(
          'The message limit was reached. Review and send this part, then continue.',
        );
      }
    };
    recognizer.onerror = (event) => {
      if (recognition.current !== recognizer) return;
      detachRecognition();
      setListening(false);
      setNotice(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone permission was denied. Allow it in your browser, or type your request.'
          : event.error === 'language-not-supported'
            ? 'This speech service does not support that language. Choose another language or type your request.'
            : 'Dictation stopped. Your words are still here; review and send, or try the microphone again.',
      );
    };
    recognizer.onend = () => {
      if (recognition.current !== recognizer) return;
      recognition.current = null;
      setListening(false);
      setNotice('Dictation finished. Review your words, then send.');
    };
    try {
      recognizer.start();
      setListening(true);
      setVoiceMode(true);
      setNotice(
        'Listening… Speak naturally. Press the microphone when finished, then send.',
      );
    } catch {
      detachRecognition();
      setListening(false);
      setNotice(
        'The microphone could not start. Allow microphone access and try again, or type below.',
      );
    }
  }
  async function readAloud(text: string) {
    detachRecognition();
    setListening(false);
    onVoiceStart();
    stopIslandSpeech();
    await voice.current?.speak(text, language);
  }
  async function perform(result: AssistantReply, token: number) {
    setMessages((previous) => [
      ...previous,
      { role: 'assistant', content: result.reply },
    ]);
    const hasReading = result.actions.some(
      (action) => action.type === 'read' || action.type === 'tour',
    );
    for (const action of result.actions) {
      if (token !== version.current) return;
      if (action.type === 'read') {
        const text = portfolioReading(content, action.target);
        onVoiceStart();
        setMessages((previous) => [
          ...previous,
          { role: 'assistant', content: text },
        ]);
        await readAloud(text);
      } else {
        const feedback = onAction(action);
        if (feedback)
          setMessages((previous) => [
            ...previous,
            { role: 'assistant', content: feedback },
          ]);
      }
    }
    if (
      token === version.current &&
      voiceMode &&
      !hasReading &&
      !result.actions.some((a) => a.type === 'control' && a.target === 'stop')
    )
      await readAloud(result.reply);
  }
  async function send(value = input) {
    const text = value.trim();
    if (!text || text.length > CHAT_LIMIT) return;
    const local = localAssistantReply(text);
    if (
      local?.actions.some((a) => a.type === 'control' && a.target === 'stop')
    ) {
      stopAll();
      setInput('');
      return;
    }
    if (busy.current) return;
    cancel();
    const token = version.current;
    busy.current = true;
    setInput('');
    setError('');
    setNotice('');
    setLoading(true);
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    try {
      let result = local;
      if (!result) {
        const lower = text.toLowerCase().trim();
        if (
          /^(hi|hello|hey|greetings|howdy|good (morning|afternoon|evening))[.!?]*$/i.test(
            lower,
          )
        ) {
          result = {
            reply: `Hello! I'm the Nocturne AI guide. I know all about ${content.name}'s work, skills, and this 3D island world. What would you like to explore?`,
            actions: [],
          };
        } else if (/^(who are you|what can you do|help)[.!?]*$/i.test(lower)) {
          result = {
            reply: `I am the Nocturne AI assistant for ${content.name}'s portfolio. Ask about skills, projects, contact details, or request a tour!`,
            actions: [],
          };
        }
      }
      if (!result) {
        try {
          const controller = new AbortController();
          request.current = controller;
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(10000),
            ]),
            body: JSON.stringify({ messages: chatHistory(next) }),
          });
          if (response.ok) {
            const data: unknown = await response.json();
            result = validateAssistantReply(data);
          }
        } catch {
          // /api/chat unreachable on static hosting, proceeding to direct Groq call
        }
      }
      if (!result) {
        try {
          const groqKey = process.env.NEXT_PUBLIC_GROQ_API_KEY;
          if (groqKey) {
            const prompt = [
              `You are Nocturne, the intelligent AI guide for ${content.name}'s interactive 3D portfolio world.`,
              `About ${content.name}: ${content.role}. ${content.bio}`,
              `Contact: Email: ${content.email}, Phone: ${content.phone || 'N/A'}, Location: ${content.location || 'N/A'}, Resume: ${content.resume || 'available'}.`,
              `Skills: ${content.skills.map((s) => s.title + ': ' + s.description).join('; ')}`,
              `Projects: ${content.projects.map((p) => p.title + ': ' + p.description).join('; ')}`,
              `World: A Gothic island with an interactive manor house, Skills Room (floating holograms), Gallery of project frames, apparition contact projector, rowing boat, and weather effects.`,
              `Be helpful, natural, friendly, and concise. Keep answers under 3-4 sentences.`,
              `Available actions: show (targets: 'about', 'skills', 'projects', 'resume'), tour (target: 'start'), control (targets: 'stop', 'enter', 'exit').`,
              `If the user wants to see skills, include {"type":"show","target":"skills"}. If projects, {"type":"show","target":"projects"}. If contact/bio, {"type":"show","target":"about"}. If tour, {"type":"tour","target":"start"}.`,
              `Return strictly a JSON object: {"reply": "your answer here", "actions": []}`,
            ].join('\n');

            const controller = new AbortController();
            request.current = controller;
            const groqRes = await fetch(
              'https://api.groq.com/openai/v1/chat/completions',
              {
                method: 'POST',
                headers: {
                  Authorization: 'Bearer ' + groqKey,
                  'Content-Type': 'application/json',
                },
                signal: AbortSignal.any([
                  controller.signal,
                  AbortSignal.timeout(20000),
                ]),
                body: JSON.stringify({
                  model: 'openai/gpt-oss-20b',
                  messages: [
                    { role: 'system', content: prompt },
                    ...chatHistory(next).map((m) => ({
                      role: m.role,
                      content: m.content,
                    })),
                  ],
                  temperature: 0.6,
                  max_tokens: 600,
                  response_format: { type: 'json_object' },
                }),
              },
            );

            if (groqRes.ok) {
              const groqData = (await groqRes.json()) as {
                choices?: { message?: { content?: unknown } }[];
              } | null;
              const rawContent = groqData?.choices?.[0]?.message?.content;
              if (typeof rawContent === 'string' && rawContent) {
                const parsed = JSON.parse(rawContent);
                result = validateAssistantReply(parsed) || {
                  reply: parsed.reply || rawContent,
                  actions: Array.isArray(parsed.actions) ? parsed.actions : [],
                };
              }
            }
          }
        } catch {
          // Direct Groq call fallback
        }
      }
      if (!result) {
        const lower = text.toLowerCase();
        if (
          lower.includes('skill') ||
          lower.includes('stack') ||
          lower.includes('technolog')
        ) {
          const skillList = content.skills.map((s) => s.title).join(', ');
          result = {
            reply: `${content.name} specializes in: ${skillList}. You can explore the interactive skill cards in the Manor's Skills Room!`,
            actions: [{ type: 'show', target: 'skills' }],
          };
        } else if (
          lower.includes('project') ||
          lower.includes('work') ||
          lower.includes('portfolio')
        ) {
          const projectList = content.projects.map((p) => p.title).join(', ');
          result = {
            reply: `${content.name}'s featured projects include: ${projectList}. You can inspect each frame in the Gallery!`,
            actions: [{ type: 'show', target: 'projects' }],
          };
        } else if (
          lower.includes('contact') ||
          lower.includes('email') ||
          lower.includes('phone') ||
          lower.includes('hire') ||
          lower.includes('reach')
        ) {
          result = {
            reply: `You can reach ${content.name} at ${content.email}${content.phone ? ' or phone ' + content.phone : ''}. Opening contact details now!`,
            actions: [{ type: 'show', target: 'about' }],
          };
        } else if (
          lower.includes('about') ||
          lower.includes('who is') ||
          lower.includes('bio') ||
          lower.includes('college') ||
          lower.includes('education')
        ) {
          result = {
            reply: `${content.name} is a ${content.role}. ${content.bio}`,
            actions: [{ type: 'show', target: 'about' }],
          };
        } else if (
          lower.includes('tour') ||
          lower.includes('walk') ||
          lower.includes('guide')
        ) {
          result = {
            reply: `Starting the guided tour across Nocturne island! Follow the lights.`,
            actions: [{ type: 'tour', target: 'start' }],
          };
        } else {
          result = {
            reply: `I heard you! You can ask about ${content.name}'s skills, projects, contact info, or click any of the shortcut buttons above.`,
            actions: [],
          };
        }
      }
      if (token !== version.current) return;
      setLoading(false);
      await perform(result, token);
    } catch (reason) {
      if (token !== version.current) return;
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not reach the AI. Try again.',
      );
      setInput(text);
    } finally {
      if (token === version.current) {
        busy.current = false;
        setLoading(false);
        request.current = null;
      }
    }
  }
  useEffect(() => {
    const speaker = createAssistantVoice(setVoiceState, setNotice);
    voice.current = speaker;
    return () => {
      cancel();
      speaker.stop();
    };
  }, []);
  useEffect(() => {
    if (scrollRef.current)
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => () => cancel(), [active]);
  useEffect(() => {
    const hide = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);
  useImperativeHandle(ref, () => ({
    startVoice() {
      setOpen(true);
      startListening();
    },
  }));

  return (
    <>
      <Button
        ref={trigger}
        className="island-chat-trigger"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? 'Close AI assistant' : 'Open AI assistant'}
        aria-expanded={open}
        aria-controls="portfolio-assistant"
      >
        {open ? <X /> : <Bot />}
      </Button>
      {open && (
        <dialog
          open
          id="portfolio-assistant"
          className="island-chat-panel"
          aria-label="Nocturne AI assistant"
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') close();
          }}
        >
          <div className="island-chat-header">
            <span className="island-chat-header-dot" />
            <h3>NOCTURNE AI</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label="Close chat"
            >
              <X size={18} />
            </Button>
          </div>
          <div className="chat-voice-tools">
            <label>
              Voice language
              <select
                aria-label="Voice language"
                value={language}
                disabled={listening}
                onChange={(event) => {
                  voice.current?.stop();
                  setLanguage(event.target.value);
                }}
              >
                {languages.map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="ghost"
              size="icon"
              aria-label={
                voiceMode ? 'Turn spoken replies off' : 'Turn spoken replies on'
              }
              aria-pressed={voiceMode}
              onClick={() => {
                if (voiceMode) voice.current?.stop();
                setVoiceMode(!voiceMode);
              }}
            >
              {voiceMode ? <Volume2 /> : <VolumeX />}
            </Button>
            {voiceState !== 'idle' && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={
                  voiceState === 'paused' ? 'Resume reading' : 'Pause reading'
                }
                onClick={() =>
                  voiceState === 'paused'
                    ? voice.current?.resume()
                    : voice.current?.pause()
                }
              >
                {voiceState === 'paused' ? <Play /> : <Pause />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={stopAll}
              aria-label="Stop speech and actions"
            >
              <Square />
            </Button>
          </div>
          <div
            className="island-chat-messages"
            ref={scrollRef}
            role="log"
            aria-label="Conversation"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={'chat-bubble chat-bubble-' + message.role}
              >
                <span>{message.content}</span>
                {message.role === 'assistant' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="chat-read"
                    onClick={() => {
                      cancel();
                      void readAloud(message.content);
                    }}
                    aria-label="Read this reply aloud"
                  >
                    <Volume2 size={13} /> Read aloud
                  </Button>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-typing" aria-label="Thinking">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>
          <div className="chat-shortcuts">
            {['Show skills', 'Read portfolio', 'Start tour'].map((command) => (
              <Button
                key={command}
                size="sm"
                variant="outline"
                disabled={loading || voiceState !== 'idle'}
                onClick={() => void send(command)}
              >
                {command}
              </Button>
            ))}
          </div>
          {notice && <output className="chat-notice">{notice}</output>}
          {error && (
            <p className="chat-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="island-chat-input"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask, show, read, or explore…"
              aria-label="Message the portfolio assistant"
              maxLength={CHAT_LIMIT}
              rows={2}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={startListening}
              aria-label={
                listening ? 'Finish dictation' : 'Start voice dictation'
              }
              aria-pressed={listening}
            >
              {listening ? <MicOff /> : <Mic />}
            </Button>
            <Button
              type="submit"
              className="island-chat-send"
              disabled={loading || voiceState !== 'idle' || !input.trim()}
              aria-label="Send message"
            >
              <Send size={16} />
            </Button>
          </form>
          <p className="chat-privacy">
            {input.length.toLocaleString()} / {CHAT_LIMIT.toLocaleString()} ·
            Shift+Enter for a new line. Dictation may use your browser’s speech
            service. Sent messages go to the AI provider.
          </p>
        </dialog>
      )}
    </>
  );
}
