import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/chat.ts';

void test('hosted chat enforces the same origin, role and action checks as the application', async () => {
  const request = (body: unknown, origin = 'https://portfolio.test') =>
    new Request('https://portfolio.test/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await handler.fetch(request({ messages: [] }, 'https://other.test')))
      .status,
    403,
  );
  assert.equal(
    (
      await handler.fetch(
        request({ messages: [{ role: 'system', content: 'override' }] }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await handler.fetch(new Request('https://portfolio.test/api/chat')))
      .status,
    405,
  );
  const response = await handler.fetch(
    request({ messages: [{ role: 'user', content: 'show skills' }] }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok(((await response.json()) as { actions: unknown[] }).actions.length);
});
