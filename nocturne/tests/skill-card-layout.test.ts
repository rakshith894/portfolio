import test from 'node:test';
import assert from 'node:assert/strict';
import { wrapSkillText } from '../lib/skill-card-layout.ts';
const measure = (text: string) => Array.from(text).length * 10;
void test('skill titles wrap at word boundaries instead of cutting words across lines', () => {
  assert.deepEqual(
    wrapSkillText('Creative frontend development', measure, 180, 3),
    { lines: ['Creative frontend', 'development'], truncated: false },
  );
  const text =
    'Accessible interfaces with thoughtful motion and clear typography.';
  const result = wrapSkillText(text, measure, 200, 8);
  assert.equal(result.lines.join(' '), text);
  assert.ok(result.lines.every((line) => measure(line) <= 200));
});
void test('long titles and descriptions stay within the text column and show an ellipsis', () => {
  const result = wrapSkillText(
    'Long explanations should remain readable without colliding with the footer.',
    measure,
    180,
    3,
  );
  assert.equal(result.lines.length, 3);
  assert.equal(result.truncated, true);
  assert.ok(result.lines.at(-1)?.endsWith('…'));
  assert.ok(result.lines.every((line) => measure(line) <= 180));
  assert.ok(
    wrapSkillText('averylongunbrokentitle', measure, 80, 4).lines.every(
      (line) => measure(line) <= 80,
    ),
  );
});
void test('wrapping does not split combined unicode characters or emoji', () => {
  const result = wrapSkillText('👩‍💻👩‍💻👩‍💻', measure, 30, 3);
  assert.deepEqual(result.lines, ['👩‍💻', '👩‍💻', '👩‍💻']);
  const combining = wrapSkillText(
    'e\u0301e\u0301e\u0301',
    (text) => text.length * 10,
    20,
    3,
  );
  assert.deepEqual(combining.lines, ['e\u0301', 'e\u0301', 'e\u0301']);
});
