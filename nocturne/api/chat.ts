import profile from '../content/profile.json';
import skills from '../content/skills.json';
import projects from '../content/hall-projects.json';
import { handleAssistantRequest } from '../lib/assistant-service';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  return handleAssistantRequest(request, {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
    context: { profile, skills, projects },
  });
}

export async function POST(request: Request) {
  return handleAssistantRequest(request, {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
    context: { profile, skills, projects },
  });
}
