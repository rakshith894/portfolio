import { projectUrl } from './hall-projects.ts';

export type ContactProfile = {
  name: string;
  role: string;
  bio: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  github: string;
  linkedin: string;
  photo: string;
  resume?: string;
};
export const PROFILE_LIMITS = {
  name: 80,
  role: 120,
  bio: 1600,
  email: 160,
  phone: 50,
  location: 100,
  website: 2048,
  github: 2048,
  linkedin: 2048,
  photo: 160,
} as const;
export function validateContactProfile(value: unknown): ContactProfile | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>,
    result = {} as ContactProfile;
  for (const key of Object.keys(
    PROFILE_LIMITS,
  ) as (keyof typeof PROFILE_LIMITS)[]) {
    if (
      typeof source[key] !== 'string' ||
      (source[key] as string).length > PROFILE_LIMITS[key]
    )
      return null;
    result[key] = (source[key] as string).trim();
  }
  if (
    !result.name ||
    (result.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result.email))
  )
    return null;
  if (result.phone && !/^[+\d\s().-]{3,50}$/.test(result.phone)) return null;
  for (const key of ['website', 'github', 'linkedin'] as const) {
    if (!result[key]) continue;
    const url = projectUrl(result[key]);
    if (!url) return null;
    result[key] = url;
  }
  if (
    result.photo &&
    !/^\/profile\/portrait-[a-f0-9]{24}\.(png|jpg|webp)$/.test(result.photo)
  )
    return null;
  if (source.resume !== undefined) {
    if (
      typeof source.resume !== 'string' ||
      (source.resume &&
        !/^\/resumes\/resume-[a-f0-9]{24}\.pdf$/.test(source.resume))
    )
      return null;
    result.resume = source.resume;
  }
  return result;
}
