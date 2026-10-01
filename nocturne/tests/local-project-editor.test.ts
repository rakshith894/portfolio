import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { localEditorRequestAllowed, localProjectEditor, validatedProject } from '../tools/local-project-editor.ts';

function request(body: unknown, headers: Record<string, string> = {}, remoteAddress = '127.0.0.1') {
  return Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]), {
    method: 'PUT', socket: { remoteAddress },
    headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'content-type': 'application/json', ...headers },
  }) as unknown as IncomingMessage;
}
const project = { id: 'frame-10', title: 'My project', description: 'A description', url: 'https://example.test/' };

void test('local editing rejects remote visitors, cross-origin writes, invalid schemes, and forged IDs', () => {
  assert.equal(localEditorRequestAllowed(request(project)), true);
  assert.equal(localEditorRequestAllowed(request(project, {}, '192.168.1.3')), false);
  assert.equal(localEditorRequestAllowed(request(project, { origin: 'https://attacker.test' })), false);
  assert.equal(localEditorRequestAllowed(request(project, { origin: 'null' })), false);
  assert.equal(localEditorRequestAllowed(request(project, { host: 'attacker.test' })), false);
  assert.equal(localEditorRequestAllowed(request(project, { 'content-type': 'text/plain' })), false);
  assert.equal(localEditorRequestAllowed(request(project, { 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(validatedProject({ ...project, url: 'javascript:alert(1)' }), null);
  assert.equal(validatedProject({ ...project, id: '../file' }), null);
  assert.equal(validatedProject({ ...project, title: 'x'.repeat(81) }), null);
  assert.equal(validatedProject({ ...project, title: '' }), null);
  assert.deepEqual(validatedProject(project), project);
});

void test('local saves survive reload, serialize concurrent edits, and preserve other frames', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nocturne-editor-'));
  try {
    await mkdir(join(root, 'content'));
    const file = join(root, 'content/hall-projects.json');
    await writeFile(file, '[]');
    let handler: (request: IncomingMessage, response: ServerResponse) => void = () => {};
    const plugin = localProjectEditor();
    assert.equal(plugin.apply, 'serve', 'Write middleware is never registered for production builds');
    const configure = plugin.configureServer as (server: ViteDevServer) => void;
    configure({ config: { root }, middlewares: { use(_path: string, callback: typeof handler) { handler = callback; } } } as unknown as ViteDevServer);
    const send = (req: IncomingMessage) => new Promise<{ status: number; body: string }>(resolve => {
      let status = 0;
      handler(req, { writeHead(code: number) { status = code; }, end(body: string) { resolve({ status, body }); } } as unknown as ServerResponse);
    });
    const responses = await Promise.all([send(request(project)), send(request({ ...project, id: 'frame-1', title: 'First' }))]);
    assert.ok(responses.every(response => response.status === 200));
    const stored = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(stored.length, 2);
    assert.equal(stored[0].title, 'First');
    assert.equal(stored[1].title, 'My project');
    const reload = request(null); reload.method = 'GET';
    assert.deepEqual(JSON.parse((await send(reload)).body).projects, stored);
    const before = await readFile(file, 'utf8');
    assert.equal((await send(request({ ...project, title: 'Hacked' }, { origin: 'https://elsewhere.test' }))).status, 403);
    assert.equal(await readFile(file, 'utf8'), before);
    assert.equal((await send(request({ id: 'frame-10', title: '', url: '', description: '' }))).status, 200);
    assert.equal(JSON.parse(await readFile(file, 'utf8'))[1].url, '');
    const extra = { ...project, id: 'frame-11', title: 'Beyond ten' };
    assert.equal((await send(request(extra))).status, 200);
    const expanded = JSON.parse((await send(reload)).body).projects;
    assert.equal(expanded.length, 3);
    assert.deepEqual(expanded[2], extra);
    assert.equal(expanded[0].title, 'First');
    const mutate = (method: string, body: unknown, headers: Record<string,string> = {}) => { const req = request(body, headers); req.method = method; return send(req); };
    assert.equal((await mutate('DELETE', { id: 'frame-11' }, { origin: 'https://attacker.test' })).status, 403);
    assert.equal((await mutate('DELETE', { id: '../file' })).status, 400);
    assert.equal((await mutate('DELETE', { id: 'frame-11' })).status, 200);
    assert.deepEqual(JSON.parse((await send(reload)).body).projects.map((p: {id:string}) => p.id), ['frame-1','frame-10']);
    const created = await Promise.all([mutate('POST', { action: 'create' }), mutate('POST', { action: 'create' })]);
    assert.ok(created.every(result => result.status === 200));
    const identifiers = created.map(result => JSON.parse(result.body).project.id);
    assert.equal(new Set(identifiers).size, 2, 'Concurrent Add frame requests allocate distinct IDs');
    const populated = JSON.parse((await send(reload)).body).projects;
    assert.equal(populated.length, 4);
    for (const frame of populated) assert.equal((await mutate('DELETE', { id: frame.id })).status, 200);
    assert.deepEqual(JSON.parse((await send(reload)).body).projects, [], 'Deleting the last frame stays empty on reload');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), []);
    const first = await mutate('POST', { action: 'create' });
    assert.equal(first.status, 200);
    assert.equal(JSON.parse(first.body).projects.length, 1, 'A new collection starts with exactly one frame');
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.startsWith(join(tmpdir(), 'nocturne-editor-')));
    await rm(root, { recursive: true, force: true });
  }
});
