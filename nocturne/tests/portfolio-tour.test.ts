import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { portfolioStops, narrationChunks, createPortfolioTour, type TourStatus } from '../lib/portfolio-tour.ts';
import profile from '../content/profile.json' with { type: 'json' };
import { createHouseWalker, houseRoute, HOUSE_FIXTURES } from '../lib/house-layout.ts';

void test('tour follows content order and preserves every word after edits, including later collection pages', () => {
  const skills = Array.from({ length: 8 }, (_, i) => ({ id: `skill-${i}`, title: `Skill ${i}`, description: 'Long detailed explanation. '.repeat(35), color: 'gold' as const }));
  const projects = Array.from({ length: 13 }, (_, i) => ({ id: `frame-${i + 1}` as const, title: `Project ${i}`, description: 'Complete project description.', url: 'https://example.com' }));
  const stops = portfolioStops({ ...profile, bio: 'Updated biography', email: 'hello@example.com' }, skills, projects);
  assert.match(stops[0].text, /Updated biography.*hello@example.com/);
  assert.deepEqual(stops.map(s => s.section), ['About & contact', ...skills.map(() => 'Skills'), ...projects.map(() => 'Projects')]);
  for (const stop of stops) assert.equal(narrationChunks(stop.text).join(' '), stop.text.trim());
  assert.equal(stops[8].page, 1); assert.equal(stops.at(-1)?.page, 1);
  skills[0].title = 'Renamed skill';
  assert.match(portfolioStops(profile, skills, projects)[1].text, /^Renamed skill/);
});

void test('every tour stop has a collision-checked route in sequence including the new projector barrier', () => {
  const walker = createHouseWalker();
  const projects = Array.from({ length: 10 }, (_, i) => ({ id: `frame-${i + 1}` as const, title: 'Project', description: '', url: 'https://example.com' }));
  const stops = portfolioStops(profile, [], projects);
  let start = { ...walker.position };
  for (const stop of stops) {
    assert.ok(walker.canStand(stop.point, true), stop.title);
    const route = houseRoute(start, stop.point, p => walker.canStand(p, true));
    assert.ok(route?.length, `${stop.section}: ${JSON.stringify(stop.point)}`);
    start = stop.point;
  }
  for (const fixture of HOUSE_FIXTURES) assert.equal(walker.canStand(fixture, true), false);
  walker.position.x = 0; walker.position.z = -3.8;
  walker.move(0, -4);
  assert.ok(walker.position.z > -4.6, 'Swept movement stops before the projector');
});

void test('a cancelled travel or stale speech callback cannot restart the tour; replay uses current text', async () => {
  let resolveTravel: (ok: boolean) => void = () => {}, finished: () => void = () => {};
  let status: TourStatus = null, bio = 'First description';
  const spoken: string[] = [];
  const tour = createPortfolioTour({
    stops: () => portfolioStops({ ...profile, bio }, [], []),
    travel: () => new Promise(resolve => { resolveTravel = resolve; }), stopTravel: () => {}, silence: () => {}, present: () => {},
    report: value => { status = value; }, speak: (text, done) => { spoken.push(text); finished = done; return true; },
  });
  tour.start(); tour.stop(); resolveTravel(true); await setImmediate();
  assert.equal(status, null); assert.equal(spoken.length, 0);
  tour.start(); bio = 'Updated while walking'; resolveTravel(true); await setImmediate();
  assert.match(spoken[0], /Updated while walking/);
  tour.pause(); const paused = status; finished(); assert.equal(status, paused);
  tour.stop(); assert.equal(status, null);
});
