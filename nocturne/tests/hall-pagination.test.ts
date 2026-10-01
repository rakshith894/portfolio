import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyHallProjects,
  readHallProjects,
  hallProjectPage,
  hallPageCount,
  nextHallProject,
} from '../lib/hall-projects.ts';
import { validatedProject } from '../tools/local-project-editor.ts';
void test('collections retain 35 projects across reload and expose every project exactly once', () => {
  const projects = emptyHallProjects();
  while (projects.length < 35) projects.push(nextHallProject(projects));
  for (const [index, project] of projects.entries())
    Object.assign(project, {
      title: `Project ${index + 1}`,
      description: 'A live project',
      url: `https://example.test/${index + 1}`,
    });
  const restored = readHallProjects(JSON.stringify(projects));
  assert.deepEqual(restored, projects);
  assert.equal(hallPageCount(restored), 4);
  assert.deepEqual(
    Array.from({ length: 4 }, (_, page) =>
      hallProjectPage(restored, page),
    ).flat(),
    projects,
  );
  assert.deepEqual(hallProjectPage(restored, 99), restored.slice(30));
  assert.deepEqual(hallProjectPage(restored, -1), restored.slice(0, 10));
  assert.deepEqual(validatedProject(projects[34]), projects[34]);
  assert.equal(nextHallProject(restored).id, 'frame-36');
});
void test('large or malformed identifiers cannot allocate giant collections or escape the editor', () => {
  const entry = {
    title: 'Project',
    description: '',
    url: 'https://example.test/',
  };
  for (const id of [
    'frame-0',
    'frame--1',
    'frame-1.5',
    '../file',
    'frame-999999999999999999',
  ])
    assert.equal(validatedProject({ ...entry, id }), null);
  const sparse = readHallProjects(
    JSON.stringify([{ ...entry, id: 'frame-99999999' }]),
  );
  assert.equal(sparse.length, 1);
  assert.equal(hallPageCount(sparse), 1);
});
