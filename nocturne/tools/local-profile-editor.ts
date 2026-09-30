import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { profileImage } from './local-image.ts';
export { profileImage } from './local-image.ts';
import type { Plugin } from 'vite';
import { localEditorRequestAllowed } from './local-project-editor.ts';
import { validateContactProfile } from '../lib/contact-profile.ts';

export function localProfileEditor(): Plugin {
  let pending = Promise.resolve();
  return {
    name: 'nocturne-local-profile-editor', apply: 'serve',
    configureServer(server) {
      const file = resolve(server.config.root, 'content/profile.json');
      server.middlewares.use('/__nocturne/profile', (request, response) => {
        const reply = (status: number, data: unknown) => {
          response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(data));
        };
        if (!localEditorRequestAllowed(request)) { reply(403, { error: 'Profile editing is local-only.' }); return; }
        void (async () => {
          if (request.method === 'GET') { await pending; reply(200, { profile: JSON.parse(await readFile(file, 'utf8')) }); return; }
          if (request.method !== 'PUT' && request.method !== 'POST') { reply(405, { error: 'Method not allowed.' }); return; }
          const chunks: Buffer[] = []; let size = 0;
          for await (const chunk of request) {
            size += chunk.length;
            if (size > (request.method === 'POST' ? 7_000_100 : 16384)) { reply(413, { error: 'Choose a photo smaller than 5 MB.' }); return; }
            chunks.push(Buffer.from(chunk));
          }
          let value: unknown;
          try { value = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reply(400, { error: 'Invalid profile details.' }); return; }
          if (request.method === 'POST') {
            const image = profileImage((value as { image?: unknown })?.image);
            if (!image) { reply(400, { error: 'Choose a PNG, JPEG, or WebP photo smaller than 5 MB.' }); return; }
            const directory = resolve(server.config.root, 'public/profile');
            await mkdir(directory, { recursive: true }); await writeFile(resolve(directory, image.name), image.bytes);
            reply(200, { photo: `/profile/${image.name}` }); return;
          }
          const profile = validateContactProfile(value);
          if (!profile) { reply(400, { error: 'Check your name, email, phone, and website links.' }); return; }
          const save = pending.then(async () => {
            const temporary = resolve(server.config.root, 'content/.profile.tmp');
            await writeFile(temporary, JSON.stringify(profile, null, 2) + '\n'); await rename(temporary, file);
            reply(200, { profile });
          });
          pending = save.catch(() => {}); await save;
        })().catch(() => { if (!response.headersSent) reply(500, { error: 'Could not save your profile. Please try again.' }); });
      });
    },
  };
}
