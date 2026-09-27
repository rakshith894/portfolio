import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMaleVoice } from '../lib/island-commands.ts';
import { createIslandSoundCues } from '../lib/island-sound-cues.ts';

void test('narration selects an identified English male voice and never a female default', () => {
  const female={name:'Microsoft Zira Desktop',lang:'en-US'}, male={name:'Microsoft David Desktop',lang:'en-US'};
  assert.equal(chooseMaleVoice([female,male]),male);
  assert.equal(chooseMaleVoice([female,{name:'Google US English',lang:'en-US'}]),undefined);
  assert.equal(chooseMaleVoice([{name:'Female English',lang:'en-US'}]),undefined);
  assert.equal(chooseMaleVoice([{name:'Thomas',lang:'fr-FR'}]),undefined);
});

void test('footsteps follow distance, gates sound on transitions, and nearby ghosts have cooldowns', () => {
  const events:string[]=[];
  const cues=createIslandSoundCues({step:()=>events.push('step'),gate:()=>events.push('gate'),ghost:()=>events.push('ghost')});
  cues.update(1,.4,false,false,0,0,0);
  cues.update(2,.5,false,false,0,0,0);
  assert.deepEqual(events,['step']);
  cues.update(3,2,true,true,0,0,0);
  assert.equal(events.length,1,'Sailing does not produce footsteps');
  cues.update(4,0,false,false,0,0,.5);
  cues.update(5,0,false,false,0,0,.9);
  cues.update(8,0,false,false,0,0,0);
  assert.deepEqual(events,['step','gate','gate']);
  cues.update(13,0,false,false,0,0,0);
  cues.update(14,0,false,false,0,0,0);
  assert.equal(events.filter(e=>e==='ghost').length,1);
  cues.update(70,0,false,false,200,200,0);
  assert.equal(events.filter(e=>e==='ghost').length,1,'No haunting in the distant sea');
});

void test('thunder follows lightning once per storm and bells stay on the island',()=>{
  const events:string[]=[];
  const cues=createIslandSoundCues({step:()=>{},gate:()=>{},ghost:()=>{},thunder:()=>events.push('thunder'),bell:()=>events.push('bell')});
  for(const time of [0,6,7.7])cues.update(time,0,false,false,0,0,0);
  assert.deepEqual(events,[]);
  for(const time of [7.8,7.9,8,9])cues.update(time,0,false,false,0,0,0);
  assert.deepEqual(events,['thunder']);
  cues.update(44,0,false,false,0,0,0);
  assert.deepEqual(events,['thunder','thunder','bell']);
  cues.update(100,0,false,true,200,200,0);
  assert.equal(events.filter(e=>e==='bell').length,1);
});
