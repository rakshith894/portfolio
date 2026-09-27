import test from 'node:test';
import assert from 'node:assert/strict';
import { createRenderBudget } from '../lib/render-budget.ts';

void test('large high-DPI screens are capped and sustained slow frames reduce resolution',()=>{
  const budget=createRenderBudget(false,2);
  const initial=budget.ratio(1920,1080);
  assert.ok(initial<1,'A full-HD canvas should not be rendered at double resolution');
  for(let i=0;i<160;i++)budget.sample(40);
  const reduced=budget.ratio(1920,1080);
  assert.ok(reduced<initial);
  for(let i=0;i<1000;i++)budget.sample(16);
  assert.ok(budget.ratio(1920,1080)>reduced,'Quality recovers after sustained smooth rendering');
  assert.ok(budget.ratio(1920,1080)<=initial);
});

void test('mobile frame limiting and isolated stalls do not trigger resolution oscillation',()=>{
  const budget=createRenderBudget(true,3),initial=budget.ratio(390,844);
  for(let i=0;i<300;i++)budget.sample(33.4);
  budget.sample(2000);budget.sample(NaN);
  assert.equal(budget.ratio(390,844),initial);
});
