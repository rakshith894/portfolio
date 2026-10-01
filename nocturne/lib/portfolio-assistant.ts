import { islandPlaces, type PlaceId } from './island-commands.ts';

export const CHAT_LIMIT = 12000;
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type AssistantAction =
  | { type: 'show' | 'read'; target: 'about' | 'skills' | 'projects' | 'resume' | 'portfolio' }
  | { type: 'tour'; target: 'start' | 'pause' | 'resume' | 'next' | 'stop' }
  | { type: 'navigate'; target: PlaceId }
  | { type: 'animate'; target: 'jump' | 'sit' | 'dance' | 'wave' }
  | { type: 'mode'; target: 'day' | 'night' | 'winter' }
  | { type: 'control'; target: 'stop' | 'overview' | 'board' | 'leaveBoat' | 'swim' | 'enter' | 'exit' };
export type AssistantReply = { reply: string; actions: AssistantAction[] };
const targets: Record<AssistantAction['type'], readonly string[]> = {
  show: ['about', 'skills', 'projects', 'resume', 'portfolio'],
  read: ['about', 'skills', 'projects', 'resume', 'portfolio'],
  tour: ['start', 'pause', 'resume', 'next', 'stop'],
  navigate: islandPlaces.map(place => place.id),
  animate: ['jump', 'sit', 'dance', 'wave'],
  mode: ['day', 'night', 'winter'],
  control: ['stop', 'overview', 'board', 'leaveBoat', 'swim', 'enter', 'exit'],
};
export const assistantActionHelp = Object.entries(targets).map(([type, values]) => type + ': ' + values.join(', ')).join('\n');
export function validateAssistantReply(value: unknown): AssistantReply | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (typeof data.reply !== 'string' || !data.reply.trim() || data.reply.length > CHAT_LIMIT || !Array.isArray(data.actions) || data.actions.length > 8) return null;
  const actions: AssistantAction[] = [];
  for (const action of data.actions) {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string' || typeof action.target !== 'string' || !Object.hasOwn(targets, action.type) || !targets[action.type as AssistantAction['type']].includes(action.target)) return null;
    // Copy only the two supported fields. Model output is never executable code.
    actions.push({ type: action.type, target: action.target } as AssistantAction);
  }
  return { reply: data.reply.trim(), actions };
}
export function validateChatMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 20) return null;
  let length = 0;
  const messages: ChatMessage[] = [];
  for (const item of value) {
    if (!item || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string' || !item.content.trim() || item.content.length > CHAT_LIMIT) return null;
    length += item.content.length;
    if (length > 48000) return null;
    messages.push({ role: item.role, content: item.content.trim() });
  }
  return messages.at(-1)?.role === 'user' ? messages : null;
}
export function chatHistory(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = []; let size = 0;
  for (const message of messages.slice(-20).reverse()) {
    const bounded = { ...message, content: message.content.slice(0, CHAT_LIMIT) };
    if (size + bounded.content.length > 48000) break;
    result.unshift(bounded); size += bounded.content.length;
  }
  return result;
}
/** Exact short commands keep core controls working without a model or network.
 * Longer requests and questions go to the AI; keywords alone never cause actions. */
export function localAssistantReply(input: string): AssistantReply | null {
  const text = input.toLowerCase().replace(/[.!?]+$/g, '').replace(/^please\s+/, '').trim();
  const answer = (action: AssistantAction, reply: string): AssistantReply => ({ reply, actions: [action] });
  if (/^(stop|cancel|stop everything|stop reading|stop talking|stop moving)$/.test(text)) return answer({ type: 'control', target: 'stop' }, 'Stopped.');
  if (/^(help|what can you do|commands)$/.test(text)) return { reply: 'Ask me to show or read the portfolio, skills, projects, contact details or résumé; start, pause or continue the guided tour; go to a place; change the weather; or jump, sit, dance and wave. You can type a longer request or choose a language and dictate it. I can only perform actions available in this portfolio.', actions: [] };
  const section = text.match(/^(show|open|read|read aloud|read out|tell me about) (?:me )?(?:the |your |my |his )?(about|bio|contact|skills|projects|resume|résumé|cv|portfolio)(?: aloud| out loud)?$/);
  if (section) {
    const target = ({ bio: 'about', contact: 'about', cv: 'resume', 'résumé': 'resume' } as Record<string, string>)[section[2]] ?? section[2];
    return answer({ type: section[1].startsWith('read') ? 'read' : 'show', target } as AssistantAction, section[1].startsWith('read') ? 'Here is the requested portfolio content.' : 'Opening ' + section[2] + '.');
  }
  const tour = text.match(/^(start|pause|resume|continue|next|stop) (?:the )?(?:guided |portfolio )?tour$/);
  if (tour || /^(give me a tour|take me on a tour|next stop)$/.test(text)) return answer({ type: 'tour', target: (tour?.[1] === 'continue' ? 'resume' : tour?.[1] ?? (text === 'next stop' ? 'next' : 'start')) as 'start' }, 'Updating the guided tour.');
  if (/^(jump|sit|dance|wave)$/.test(text)) return answer({ type: 'animate', target: text as 'jump' }, 'Requested: ' + text + '.');
  const mode = text.match(/^(?:switch to |change to |set )?(day|night|winter)(?: mode)?$/);
  if (mode) return answer({ type: 'mode', target: mode[1] as 'day' }, 'Changing the atmosphere to ' + mode[1] + '.');
  const place = text.match(/^(?:go to|take me to|walk to|visit) (?:the )?(.+)$/);
  if (place) {
    const destination = islandPlaces.find(p => [p.name.toLowerCase(), ...p.aliases].includes(place[1]));
    if (destination) return answer({ type: 'navigate', target: destination.id }, 'Requesting a route to ' + destination.name + '.');
  }
  const control: Record<string, AssistantAction & { type: 'control' }> = {
    'look around': { type: 'control', target: 'overview' },
    'ride the boat': { type: 'control', target: 'board' },
    'board the boat': { type: 'control', target: 'board' },
    'leave the boat': { type: 'control', target: 'leaveBoat' },
    swim: { type: 'control', target: 'swim' },
    'enter the house': { type: 'control', target: 'enter' },
    'leave the house': { type: 'control', target: 'exit' },
  };
  return Object.hasOwn(control, text) ? answer(control[text], 'Requested: ' + text + '.') : null;
}

export type PortfolioContent = {
  name: string; role: string; bio: string; email: string; phone?: string; location?: string; resume?: string;
  skills: { title: string; description: string }[];
  projects: { title: string; description: string; url: string }[];
};
export function portfolioReading(content: PortfolioContent, target: 'about' | 'skills' | 'projects' | 'resume' | 'portfolio') {
  const about = [content.name, content.role, content.bio, content.email && 'Email: ' + content.email, content.phone && 'Phone: ' + content.phone, content.location && 'Location: ' + content.location].filter(Boolean).join('. ');
  const skills = 'Skills. ' + (content.skills.map(s => s.title + '. ' + (s.description || 'No description has been added.')).join('\n\n') || 'No skills have been published yet.');
  const projects = 'Projects. ' + (content.projects.filter(p => p.url).map(p => p.title + '. ' + (p.description || 'No description has been added.')).join('\n\n') || 'No projects have been published yet.');
  if (target === 'portfolio') return [about, skills, projects].join('\n\n');
  if (target === 'resume') return content.resume ? 'The résumé is available in About and contact. Use View résumé to open the PDF. I can read the published profile, skills and projects; PDF text is not available to this assistant.' : 'No résumé has been published yet.';
  return { about, skills, projects }[target];
}
