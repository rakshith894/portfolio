export const HALL_PROJECT_KEY = 'nocturne-hall-projects-v1';
export const HALL_FRAMES = [
  { id: 'frame-1', x: 8.42, y: 6.3, z: -2.95, rotation: -Math.PI / 2, width: 2.05 },
  { id: 'frame-2', x: 8.42, y: 6.3, z: -7.7, rotation: -Math.PI / 2, width: 2.05 },
  { id: 'frame-3', x: -4.34, y: 6.3, z: -5.6, rotation: Math.PI / 2, width: 2.05 },
  { id: 'frame-4', x: -4.34, y: 6.3, z: -7.85, rotation: Math.PI / 2, width: 2.05 },
  { id: 'frame-5', x: 8.42, y: 6.3, z: -5.325, rotation: -Math.PI / 2, width: 2.05 },
  { id: 'frame-6', x: 8.42, y: 8.4, z: -2.95, rotation: -Math.PI / 2, width: 2.05 },
  { id: 'frame-7', x: 8.42, y: 8.4, z: -5.325, rotation: -Math.PI / 2, width: 2.05 },
  { id: 'frame-8', x: 8.42, y: 8.4, z: -7.7, rotation: -Math.PI / 2, width: 2.05 },
  { id: 'frame-9', x: -4.34, y: 8.4, z: -5.6, rotation: Math.PI / 2, width: 2.05 },
  { id: 'frame-10', x: -4.34, y: 8.4, z: -7.85, rotation: Math.PI / 2, width: 2.05 },
] as const;
export type HallFrameId = `frame-${number}`;
export function isHallProjectId(value: unknown): value is HallFrameId {
  return typeof value === 'string' && /^frame-[1-9]\d{0,8}$/.test(value);
}
export const HALL_PAGE_SIZE = HALL_FRAMES.length;
export function hallPageCount(projects: HallProject[]) { return Math.max(1, Math.ceil(projects.length / HALL_PAGE_SIZE)); }
export function hallProjectPage(projects: HallProject[], page: number) {
  const index = Math.max(0, Math.min(hallPageCount(projects) - 1, Math.floor(page) || 0));
  return projects.slice(index * HALL_PAGE_SIZE, (index + 1) * HALL_PAGE_SIZE);
}
export function nextHallProject(projects: HallProject[]): HallProject {
  const next = projects.reduce((max, project) => Math.max(max, Number(project.id.slice(6))), 0) + 1;
  return { id: `frame-${next}`, title: '', description: '', url: '' };
}
export type HallProject = { id: HallFrameId; title: string; description: string; url: string; cover?: string };
export function projectCover(value: unknown): string | null {
  return typeof value === 'string' && /^\/project-covers\/cover-[a-f0-9]{24}\.(png|jpg|webp)$/.test(value) ? value : null;
}
export function emptyHallProjects(): HallProject[] {
  return HALL_FRAMES.map(({ id }) => ({ id, title: '', description: '', url: '' }));
}
export function projectUrl(value: string): string | null {
  if (!value.trim() || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
export function readHallProjects(value: string | null): HallProject[] {
  const empty = emptyHallProjects();
  if (!value) return empty;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return empty;
    const projects = new Map(empty.map(project => [project.id, project]));
    for (const item of parsed) {
      if (!item || !isHallProjectId(item.id) || typeof item.title !== 'string' || typeof item.description !== 'string' || typeof item.url !== 'string') continue;
      if (!item.title && !item.description && !item.url) {
        projects.set(item.id, { id: item.id, title: '', description: '', url: '' });
        continue;
      }
      const url = projectUrl(item.url);
      if (url) projects.set(item.id, { id: item.id, title: item.title.trim().slice(0, 80), description: item.description.trim().slice(0, 600), url, ...(projectCover(item.cover) ? { cover: item.cover } : {}) });
    }
    return [...projects.values()].sort((a, b) => Number(a.id.slice(6)) - Number(b.id.slice(6)));
  } catch { return empty; }
}
