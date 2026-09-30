import { readFile, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { localEditorRequestAllowed } from './local-project-editor.ts';
import { readSkills, validateSkill } from '../lib/skill-gallery.ts';
export function localSkillEditor(): Plugin {
  let pending = Promise.resolve();
  return { name: 'nocturne-local-skills', apply: 'serve', configureServer(server) {
    const file = resolve(server.config.root, 'content/skills.json');
    server.middlewares.use('/__nocturne/skills', (request, response) => {
      const reply = (status: number, value: unknown) => { response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
      if (!localEditorRequestAllowed(request)) { reply(403, { error: 'Skills can be edited on your local computer.' }); return; }
      void (async () => {
        const load = async () => readSkills(JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, '')));
        if (request.method === 'GET') { await pending; reply(200, { skills: await load() }); return; }
        if (!['PUT', 'DELETE'].includes(request.method ?? '')) { reply(405, { error: 'Method not allowed.' }); return; }
        const chunks: Buffer[] = []; let size = 0;
        for await (const chunk of request) { size += chunk.length; if (size > 8192) { reply(413, { error: 'Skill details are too long.' }); return; } chunks.push(Buffer.from(chunk)); }
        let input: unknown; try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { reply(400, { error: 'Invalid skill details.' }); return; }
        const skill = validateSkill(input);
        if (!skill) { reply(400, { error: 'Add a skill name, explanation and one of the available colors.' }); return; }
        const save = pending.then(async () => {
          const current = await load();
          const skills = request.method === 'DELETE' ? current.filter(item => item.id !== skill.id) : current.map(item => item.id === skill.id ? skill : item);
          if (request.method === 'PUT' && !skills.some(item => item.id === skill.id)) skills.push(skill);
          const temporary = resolve(server.config.root, 'content/.skills.tmp');
          await writeFile(temporary, JSON.stringify(skills, null, 2) + '\n'); await rename(temporary, file);
          reply(200, { skills });
        }); pending = save.catch(() => {}); await save;
      })().catch(() => { if (!response.headersSent) reply(500, { error: 'Could not save your skills. Please try again.' }); });
    });
  } };
}
