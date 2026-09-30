import test from 'node:test';
import assert from 'node:assert/strict';
import { validateContactProfile } from '../lib/contact-profile.ts';
import { profileImage, localProfileEditor } from '../tools/local-profile-editor.ts';

const profile = { name: 'Rakshith', role: 'Developer', bio: 'Hello', email: '', phone: '', location: '', website: '', github: '', linkedin: '', photo: '' };
void test('profiles accept optional contacts and reject unsafe links, image paths and invalid fields', () => {
  assert.deepEqual(validateContactProfile(profile), profile);
  assert.ok(validateContactProfile({ ...profile, email: 'me@example.test', phone: '+91 12345 67890', website: 'https://example.test' }));
  for (const bad of [{ name: '' }, { email: 'bad\r\nBcc:a@b.test' }, { website: 'javascript:alert(1)' }, { github: 'file:///secret' }, { phone: 'javascript:bad' }, { photo: '/../../private' }, { photo: 'https://tracker.test/photo.jpg' }])
    assert.equal(validateContactProfile({ ...profile, ...bad }), null);
  assert.equal(validateContactProfile({ ...profile, bio: 'x'.repeat(1601) }), null);
  assert.equal(localProfileEditor().apply, 'serve');
});

void test('portrait uploads accept bounded image bytes, never SVG or arbitrary file names', () => {
  const bytes = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,13]);
  const image = profileImage(`data:image/png;base64,${bytes.toString('base64')}`);
  assert.ok(image); assert.match(image.name, /^portrait-[a-f0-9]{24}\.png$/); assert.deepEqual(image.bytes, bytes);
  assert.equal(profileImage('data:image/svg+xml;base64,PHN2Zz4='), null);
  assert.equal(profileImage('data:image/png;base64,' + Buffer.from('Not a PNG image').toString('base64')), null);
  assert.equal(profileImage('data:image/png;base64,' + 'A'.repeat(7_000_000)), null);
});
