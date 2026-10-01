import profile from '@/content/profile.json';
import skills from '@/content/skills.json';
import projects from '@/content/hall-projects.json';
import { handleAssistantRequest } from '@/lib/assistant-service';

export async function POST(request: Request) {
  return handleAssistantRequest(request, {
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL,
    context: { profile, skills, projects },
  });
}
