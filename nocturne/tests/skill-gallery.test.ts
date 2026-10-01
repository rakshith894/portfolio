import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { localSkillEditor } from '../tools/local-skill-editor.ts';
import { validateSkill, readSkills, SKILL_COLORS } from '../lib/skill-gallery.ts';
import { HOUSE_FURNITURE, createHouseWalker } from '../lib/house-layout.ts';
import { CONTACT_PROJECTOR } from '../lib/contact-apparition.ts';
import { validatedProject } from '../tools/local-project-editor.ts';
const skill = { id: 'skill-1', title: 'Animation', description: 'Motion that explains an interaction.', color: 'gold' };
void test('skills preserve explanations and palette choices and reject forged values', () => {
  assert.deepEqual(validateSkill(skill), skill);
  for (const color of Object.keys(SKILL_COLORS)) assert.ok(validateSkill({ ...skill, color }));
  for (const change of [{ id: '../profile' }, { title: '' }, { title: 'x'.repeat(61) }, { description: 'x'.repeat(1001) }, { color: 'red; background:url(x)' }]) assert.equal(validateSkill({ ...skill, ...change }), null);
  assert.equal(readSkills([skill, skill]).length, 1);
  assert.deepEqual(readSkills(null), []);
});
void test('the entry projector is on the ground floor and both front side rooms have open floors', () => {
  assert.equal(CONTACT_PROJECTOR.y, .03); assert.equal(CONTACT_PROJECTOR.x, 0); assert.ok(CONTACT_PROJECTOR.z < -3);
  assert.ok(HOUSE_FURNITURE.every(item => Math.abs(item.x) > 8.6));
  const walker=createHouseWalker();
  for(const point of [{x:-4.8,z:-2.8},{x:6.1,z:-3.5},{x:5.5,z:-2.35}])assert.ok(walker.canStand(point));
});
void test('project covers allow only local validated image paths', () => {
  const project={id:'frame-11',title:'A project',description:'',url:'https://example.test/',cover:'/project-covers/cover-0123456789abcdef01234567.webp'};
  assert.deepEqual(validatedProject(project),project);
  for(const cover of ['https://tracking.test/image.png','/project-covers/../../file','javascript:alert(1)'])assert.equal(validatedProject({...project,cover}),null);
});
void test('skills save, reload, update and delete locally while rejecting cross-origin writes', async () => {
  const root=await mkdtemp(join(tmpdir(),'nocturne-skills-'));
  try {
    await mkdir(join(root,'content'));const file=join(root,'content/skills.json');await writeFile(file,'[]');
    let handler:(request:IncomingMessage,response:ServerResponse)=>void=()=>{};
    const plugin=localSkillEditor();assert.equal(plugin.apply,'serve');
    (plugin.configureServer as (server:ViteDevServer)=>void)({config:{root},middlewares:{use(_path:string,callback:typeof handler){handler=callback;}}} as unknown as ViteDevServer);
    const send=(method:string,body:unknown,origin='http://localhost:3000')=>new Promise<{status:number;body:string}>(resolve=>{
      const request=Object.assign(Readable.from([Buffer.from(JSON.stringify(body))]),{method,socket:{remoteAddress:'127.0.0.1'},headers:{host:'localhost:3000',origin,'content-type':'application/json'}}) as unknown as IncomingMessage;
      let status=0;handler(request,{writeHead(code:number){status=code;},end(body:string){resolve({status,body});}} as unknown as ServerResponse);
    });
    const saves=await Promise.all([send('PUT',skill),send('PUT',{...skill,id:'skill-2',color:'mint'})]);assert.ok(saves.every(response=>response.status===200));
    assert.equal(JSON.parse((await send('GET',null)).body).skills.length,2);
    await send('PUT',{...skill,description:'Updated explanation'});
    const stored=JSON.parse(await readFile(file,'utf8'));assert.equal(stored.find((s:typeof skill)=>s.id===skill.id).description,'Updated explanation');
    assert.equal((await send('PUT',skill,'https://other.test')).status,403);
    assert.equal((await send('DELETE',skill)).status,200);
    const remaining=JSON.parse((await send('GET',null)).body).skills;assert.equal(remaining.length,1);assert.equal(remaining[0].id,'skill-2');
  } finally {assert.equal(dirname(resolve(root)),resolve(tmpdir()));assert.ok(root.startsWith(join(tmpdir(),'nocturne-skills-')));await rm(root,{recursive:true,force:true});}
});

void test('all skill holograms remain visible when the collection grows past six', async () => {
  const THREE = await import('three');
  const { createSkillHolograms } = await import('../lib/skill-holograms.ts');
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement() { return { width: 0, height: 0, getContext: () => new Proxy({ measureText(text:string) { return { width:text.length*20 }; }, createLinearGradient() { return { addColorStop() {} }; }, createRadialGradient() { return { addColorStop() {} }; } }, { get(target,key) { return Reflect.get(target,key) ?? (()=>{}); } }) }; } } });
  const scene = new THREE.Scene(), resources = new Set<{dispose:()=>void}>();
  try {
    const gallery=createSkillHolograms(scene,resources);
    assert.equal(gallery.root.children.filter(card=>card.visible).length,3);
    const skills=Array.from({length:8},(_,i)=>validateSkill({...skill,id:'skill-'+i})!);
    gallery.setSkills(skills);
    assert.equal(gallery.root.children.filter(card=>card.visible).length,8);
    assert.equal(gallery.root.children[0].userData.skillId,'skill-0');
    assert.equal(gallery.root.children[7].userData.skillId, 'skill-7');
    const firstPosition = gallery.root.children[0].position.clone();
    gallery.setSkills(Array.from({ length: 90 }, (_, i) => validateSkill({ ...skill, id: 'skill-' + i })!));
    assert.equal(gallery.root.children.length, 90);
    assert.ok(gallery.root.children[0].position.equals(firstPosition));
    assert.equal(gallery.root.children[18].userData.area, 'Backyard skills garden');
    gallery.update(10,new THREE.PerspectiveCamera(),false,true);
    gallery.root.children.forEach(card=>assert.ok(card.position.toArray().every(Number.isFinite)));
    gallery.setSkills([]);assert.equal(gallery.root.children.filter(card=>card.visible).length,3);
    gallery.dispose();assert.equal(scene.children.length,0);
  } finally {resources.forEach(resource=>resource.dispose());if(previous)Object.defineProperty(globalThis,'document',previous);else Reflect.deleteProperty(globalThis,'document');}
});
