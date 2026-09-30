export const SKILL_COLORS = { gold: '#f0cb79', mint: '#89ebcf', blue: '#93c8ff', violet: '#c6acff', rose: '#ffacc8', amber: '#ffb378' } as const;
export type SkillColor = keyof typeof SKILL_COLORS;
export type GallerySkill = { id: string; title: string; description: string; color: SkillColor };
export const SKILLS_PER_PAGE = 6;
export function validateSkill(value: unknown): GallerySkill | null {
  if (!value || typeof value !== 'object') return null;
  const s = value as GallerySkill;
  if (typeof s.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(s.id) || typeof s.title !== 'string' || !s.title.trim() || s.title.length > 60 || typeof s.description !== 'string' || s.description.length > 1000 || !Object.hasOwn(SKILL_COLORS, s.color)) return null;
  return { id: s.id, title: s.title.trim(), description: s.description.trim(), color: s.color };
}
export function readSkills(value: unknown): GallerySkill[] {
  if (!Array.isArray(value)) return [];
  const skills = new Map<string, GallerySkill>();
  for (const input of value) { const skill = validateSkill(input); if (skill) skills.set(skill.id, skill); }
  return [...skills.values()];
}
