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
    assert.equal(stored.length, 10);
    assert.equal(stored[0].title, 'First');
    assert.equal(stored[9].title, 'My project');
    const reload = request(null); reload.method = 'GET';
    assert.deepEqual(JSON.parse((await send(reload)).body).projects, stored);
    const before = await readFile(file, 'utf8');
    assert.equal((await send(request({ ...project, title: 'Hacked' }, { origin: 'https://elsewhere.test' }))).status, 403);
    assert.equal(await readFile(file, 'utf8'), before);
    assert.equal((await send(request({ id: 'frame-10', title: '', url: '', description: '' }))).status, 200);
    assert.equal(JSON.parse(await readFile(file, 'utf8'))[9].url, '');
    const extra = { ...project, id: 'frame-11', title: 'Beyond ten' };
    assert.equal((await send(request(extra))).status, 200);
    const expanded = JSON.parse((await send(reload)).body).projects;
    assert.equal(expanded.length, 11);
    assert.deepEqual(expanded[10], extra);
    assert.equal(expanded[0].title, 'First');
  } finally {
    assert.equal(dirname(resolve(root)), resolve(tmpdir()));
    assert.ok(root.startsWith(join(tmpdir(), 'nocturne-editor-')));
    await rm(root, { recursive: true, force: true });
  }
});
