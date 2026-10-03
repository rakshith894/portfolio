import profile from '../content/profile.json' with { type: 'json' };
import skills from '../content/skills.json' with { type: 'json' };
import projects from '../content/hall-projects.json' with { type: 'json' };
import { handleAssistantRequest } from '../lib/assistant-service.ts';

/** Vercel's Web Request handler shares validation and timeouts with the app API. */
const handler = {
  async fetch(request: Request) {
    if (request.method !== 'POST')
      return Response.json(
        { error: 'Method not allowed' },
        { status: 405, headers: { Allow: 'POST' } },
      );
    return handleAssistantRequest(request, {
      apiKey: process.env.GROQ_API_KEY,
      model: process.env.GROQ_MODEL,
      context: { profile, skills, projects },
    });
  },
};
export default handler;
