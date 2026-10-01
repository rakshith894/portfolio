import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HALL_FRAMES,
  emptyHallProjects,
  projectUrl,
  readHallProjects,
} from '../lib/hall-projects.ts';
import { HALL_GATE, MASTER_HALL } from '../lib/master-hall.ts';

void test('no frames are created implicitly and saved frames restore without deleted placeholders', () => {
  const empty = emptyHallProjects();
  assert.equal(empty.length, 0);
  assert.ok(
    empty.every(
      (project) => !project.title && !project.description && !project.url,
    ),
  );
  assert.deepEqual(readHallProjects(null), empty);
  assert.deepEqual(readHallProjects('not json'), empty);
  assert.deepEqual(readHallProjects('{}'), empty);
  const saved = [
    {
      id: 'frame-3',
      title: 'A live project',
      url: 'https://example.test/demo',
      description: 'Project details',
    },
  ];
  assert.deepEqual(readHallProjects(JSON.stringify(saved)), saved);
  assert.deepEqual(readHallProjects('[]'), []);
  const blank = { id: 'frame-4', title: '', description: '', url: '' };
  assert.deepEqual(
    readHallProjects(JSON.stringify([blank])),
    [blank],
    'Only explicitly created blank frames persist',
  );
  assert.deepEqual(
    readHallProjects(
      JSON.stringify([
        {
          id: 'frame-1',
          title: 'Bad',
          url: 'javascript:alert(1)',
          description: '',
        },
      ]),
    ),
    empty,
  );
  assert.deepEqual(
    readHallProjects(
      JSON.stringify([
        {
          id: 'frame-1',
          title: 42,
          url: 'https://example.test',
          description: '',
        },
      ]),
    ),
    empty,
  );
});

void test('live demo links accept web URLs and reject executable schemes and credentials', () => {
  for (const input of [
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///private/file',
    'https://name:secret@example.test',
    'not a url',
  ])
    assert.equal(projectUrl(input), null);
  assert.equal(
    projectUrl(' https://example.test/demo?q=one '),
    'https://example.test/demo?q=one',
  );
  assert.equal(
    projectUrl('http://localhost:3000/demo'),
    'http://localhost:3000/demo',
  );
});

void test('project frames occupy solid side walls and leave the side entrance and windows clear', () => {
  for (const frame of HALL_FRAMES) {
    assert.ok(
      frame.z - frame.width / 2 > MASTER_HALL.z - MASTER_HALL.depth / 2,
    );
    assert.ok(
      frame.z + frame.width / 2 < MASTER_HALL.z + MASTER_HALL.depth / 2,
    );
    if (frame.x < 0)
      assert.ok(
        frame.z + frame.width / 2 + 0.07 < HALL_GATE.z - HALL_GATE.width / 2,
      );
    assert.ok(frame.y - 0.85 > MASTER_HALL.y + 0.3);
    assert.ok(frame.y + 0.85 < MASTER_HALL.y + MASTER_HALL.height);
  }
  assert.equal(
    new Set(HALL_FRAMES.map((frame) => frame.width)).size,
    1,
    'All ten frames have the same size',
  );
  for (let a = 0; a < HALL_FRAMES.length; a++)
    for (let b = a + 1; b < HALL_FRAMES.length; b++) {
      const first = HALL_FRAMES[a],
        second = HALL_FRAMES[b];
      if (first.x !== second.x) continue;
      assert.ok(
        Math.abs(first.y - second.y) >= 2 ||
          Math.abs(first.z - second.z) > first.width + 0.14,
        'Frames have breathing room and never overlap',
      );
    }
});
