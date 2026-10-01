import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { resolve } from 'node:path';
import { isHallProjectId, nextHallProject, projectUrl, projectCover, readHallProjects, type HallProject } from '../lib/hall-projects.ts';
import { profileImage } from './local-image.ts';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
export function localEditorRequestAllowed(request: IncomingMessage) {
  if (!loopback.has(request.socket.remoteAddress ?? '')) return false;
  try {
    const host = new URL(`http://${request.headers.host}`);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) return false;
    if (request.method === 'GET') return true;
    return request.headers.origin === host.origin
      && request.headers['content-type']?.split(';')[0] === 'application/json'
      && (!request.headers['sec-fetch-site'] || request.headers['sec-fetch-site'] === 'same-origin');
  } catch { return false; }
}

export function validatedProject(value: unknown): HallProject | null {
  if (!value || typeof value !== 'object') return null;
  const project = value as HallProject;
  if (!isHallProjectId(project.id)
    || typeof project.title !== 'string' || typeof project.description !== 'string' || typeof project.url !== 'string'
    || project.title.length > 80 || project.description.length > 600 || project.url.length > 2048) return null;
  if (!project.url && !project.title && !project.description) return { id: project.id, title: '', description: '', url: '' };
  const url = projectUrl(project.url);
  if (!url || !project.title.trim()) return null;
  if (project.cover && !projectCover(project.cover)) return null;
  return { id: project.id, title: project.title.trim(), description: project.description.trim(), url, ...(project.cover ? { cover: project.cover } : {}) };
}

/** Vite development middleware only. No write route is shipped in the Worker. */
export function localProjectEditor(): Plugin {
  let pending = Promise.resolve();
  return {
    name: 'nocturne-local-project-editor',
    apply: 'serve',
    configureServer(server) {
      const file = resolve(server.config.root, 'content/hall-projects.json');
      const temporary = resolve(server.config.root, 'content/.hall-projects.tmp');
      const reply = (response: ServerResponse, status: number, value: unknown) => {
        response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(value));
      };
      server.middlewares.use('/__nocturne/projects', (request, response) => {
        if (!localEditorRequestAllowed(request)) { reply(response, 403, { error: 'Editing is available only on your local computer.' }); return; }
        if (!['GET', 'PUT', 'POST', 'DELETE'].includes(request.method ?? '')) { reply(response, 405, { error: 'Method not allowed.' }); return; }
        void (async () => {
          if (request.method === 'GET') {
            await pending;
            reply(response, 200, { projects: readHallProjects(await readFile(file, 'utf8')) });
            return;
          }
          const chunks: Buffer[] = [];
          let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > (request.method === 'POST' ? 7_000_100 : 16384)) { reply(response, 413, { error: 'Project details are too large. Images must be smaller than 5 MB.' }); return; }
            chunks.push(Buffer.from(chunk));
          }
          let input: unknown;
          try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { reply(response, 400, { error: 'Invalid project details.' }); return; }
          const create = request.method === 'POST' && !!input && typeof input === 'object' && (input as { action?: unknown }).action === 'create';
          if (create || request.method === 'DELETE') {
            const id = input && typeof input === 'object' ? (input as { id?: unknown }).id : undefined;
            if (!create && !isHallProjectId(id)) { reply(response, 400, { error: 'Choose a valid frame to remove.' }); return; }
            const change = pending.then(async () => {
              let projects = readHallProjects(await readFile(file, 'utf8'));
              const project = create ? nextHallProject(projects) : null;
              if (project && !isHallProjectId(project.id)) { reply(response, 409, { error: 'No more frame identifiers are available.' }); return; }
              projects = project ? [...projects, project] : projects.filter(current => current.id !== id);
              await writeFile(temporary, JSON.stringify(projects, null, 2) + '\n', 'utf8');
              await rename(temporary, file);
              reply(response, 200, { projects, ...(project ? { project } : {}) });
            });
            pending = change.catch(() => {});
            await change;
            return;
          }
          if (request.method === 'POST') {
            const image = profileImage((input as { image?: unknown })?.image);
            if (!image) { reply(response, 400, { error: 'Choose a PNG, JPEG or WebP image smaller than 5 MB.' }); return; }
            const name = image.name.replace('portrait-', 'cover-');
            const directory = resolve(server.config.root, 'public/project-covers');
            await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, name), image.bytes);
            reply(response, 200, { cover: `/project-covers/${name}` }); return;
          }
          const project = validatedProject(input);
          if (!project) { reply(response, 400, { error: 'Check the title, description, and website URL.' }); return; }
          // Serialize read-modify-write so edits in separate local tabs cannot erase another frame.
          const save = pending.then(async () => {
            const projects = readHallProjects(await readFile(file, 'utf8'))
              .map(current => current.id === project.id ? project : current);
            if (!projects.some(current => current.id === project.id)) projects.push(project);
            projects.sort((a, b) => Number(a.id.slice(6)) - Number(b.id.slice(6)));
            await writeFile(temporary, JSON.stringify(projects, null, 2) + '\n', 'utf8');
            await rename(temporary, file);
            reply(response, 200, { projects });
          });
          pending = save.catch(() => {});
          await save;
        })().catch(() => { if (!response.headersSent) reply(response, 500, { error: 'Could not save the project file. Please try again.' }); });
      });
    },
  };
}
