import test from 'node:test';
import assert from 'node:assert/strict';
import { createJourneyGuide } from '../lib/island-journey.ts';

void test('departure starts promptly while narration continues, and arrival uses the selected place', () => {
  let caption='',finish=()=>{};
  const said:string[]=[];
  const guide=createJourneyGuide((text,done)=>{said.push(text);finish=done;return true;},()=>{},text=>{caption=text;});
  guide.announce('departure','Raven Gate');
  assert.equal(caption,"We're heading to Raven Gate.");
  assert.equal(guide.holdingDeparture,true);
  for(let i=0;i<3;i++)guide.update(.1);
  assert.equal(guide.holdingDeparture,false);
  assert.equal(guide.facingCamera,false);
  assert.equal(caption,"We're heading to Raven Gate.");
  for(let i=0;i<22;i++)guide.update(.1);
  finish();guide.update(.1);
  assert.equal(guide.holdingDeparture,false);
  assert.equal(caption,'');
  guide.announce('arrival','Raven Gate');
  assert.equal(caption,"We've arrived at Raven Gate.");
  assert.equal(guide.holdingDeparture,false);
  assert.equal(guide.facingCamera,true);
  assert.deepEqual(said,["We're heading to Raven Gate.","We've arrived at Raven Gate."]);
});

void test('a missing or stalled speech engine cannot prevent travel or leave captions stuck', () => {
  for(const available of [false,true]) {
    let caption='';
    const guide=createJourneyGuide(()=>available,()=>{},text=>{caption=text;});
    guide.announce('departure','Boat Landing');
    for(let i=0;i<72;i++)guide.update(.1);
    assert.equal(guide.holdingDeparture,false);
    assert.equal(guide.facingCamera,false);
    assert.equal(caption,'');
  }
});

void test('changing destinations and cancelling ignore old speech completion callbacks', () => {
  const callbacks:(()=>void)[]=[];
  let caption='',stops=0;
  const guide=createJourneyGuide((_text,done)=>{callbacks.push(done);return true;},()=>{stops++;},text=>{caption=text;});
  guide.announce('departure','Raven Gate');
  guide.announce('departure','Rakshith Manor');
  callbacks[0]();
  for(let i=0;i<25;i++)guide.update(.1);
  assert.equal(guide.holdingDeparture,false);
  assert.equal(caption,"We're heading to Rakshith Manor.");
  guide.cancel();callbacks[1]();guide.update(.1);
  assert.equal(caption,'');
  assert.equal(guide.facingCamera,false);
  assert.ok(stops>=3);
});
