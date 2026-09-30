import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFootPlacement } from '../lib/human-locomotion.ts';
import { createIslandAvatar } from '../lib/island-avatar.ts';
import { createRowboatOars } from '../lib/island-rowing.ts';

async function loadHuman() {
  const bytes = readFileSync(new URL('../public/models/human-traveller.glb', import.meta.url));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binary = bytes.subarray(28 + jsonLength);
  // Exercise real skinning and animation without a GPU or browser image decoder.
  const inspect = structuredClone(json);
  for (const material of inspect.materials) {
    delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture;
  }
  inspect.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString('base64')}`;
  // Node's fetch supports data URLs; the loader's progress event is browser-only.
  if (typeof globalThis.ProgressEvent === 'undefined') {
    Object.assign(globalThis, { ProgressEvent: class { type: string; constructor(type: string) { this.type = type; } } });
  }
  const gltf = await new GLTFLoader().parseAsync(JSON.stringify(inspect), '');
  return { ...gltf, json, bytes };
}

void test('the seated traveller grips both moving oars and releases them on disembark',async context=>{
  const gltf=await loadHuman(),resources=new Set<{dispose:()=>void}>();
  const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  try {
    Object.defineProperty(globalThis,'window',{value:{},configurable:true});
    context.mock.method(GLTFLoader.prototype,'load',(_url:string,onLoad:(value:typeof gltf)=>void)=>onLoad(gltf));
    const avatar=createIslandAvatar(resources,false),boat=new THREE.Group();
    const material=new THREE.MeshBasicMaterial();resources.add(material);
    const rowing=createRowboatOars(boat,material,resources);
    avatar.setSeated(true);avatar.root.position.set(.25,.02,0);avatar.root.rotation.y=Math.PI/2;
    boat.add(avatar.root);
    for(let i=0;i<120;i++)avatar.update(0,false,1/60,false);
    let largestError=0;
    for(let i=0;i<150;i++){
      rowing.update(1/60,true);
      avatar.setRowingTargets(rowing.leftHand,rowing.rightHand);
      avatar.update(0,false,1/60,false);
      for(const [side,grip] of [['L',rowing.leftHand],['R',rowing.rightHand]] as const){
        const hand=avatar.root.getObjectByName(`Bip01_${side}_Hand`)!;
        largestError=Math.max(largestError,hand.getWorldPosition(new THREE.Vector3()).distanceTo(grip));
      }
    }
    assert.ok(largestError<.12,`Hands must stay on the oars, worst error ${largestError}`);
    const phase=rowing.phase;
    for(let i=0;i<120;i++)rowing.update(1/60,false);
    assert.equal(rowing.phase,phase,'Idle boats do not paddle themselves');
    assert.ok(rowing.effort<.001);
    avatar.setSeated(false);
    for(let i=0;i<120;i++)avatar.update(0,false,1/60,true);
    assert.ok(new THREE.Box3().setFromObject(avatar.root,true).max.y>1.65);
  } finally {
    resources.forEach(r=>r.dispose());
    if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');
  }
});

void test('a visible articulated avatar works during a stalled download and is replaced when loading finishes', async context => {
  const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const resources=new Set<{dispose:()=>void}>();
  const gltf=await loadHuman();
  let deliver=()=>{};
  try {
    Object.defineProperty(globalThis,'window',{value:{},configurable:true});
    context.mock.method(GLTFLoader.prototype,'load',(_url: string,onLoad: (value: typeof gltf)=>void)=>{deliver=()=>onLoad(gltf);});
    const avatar=createIslandAvatar(resources,false);
    assert.equal(avatar.root.visible,true);
    avatar.update(1, true, 1 / 60, false);
    assert.equal(avatar.root.children[0].visible,true);
    let ready=false;void avatar.ready.then(()=>{ready=true;});
    await Promise.resolve();assert.equal(ready,false);
    deliver();await avatar.ready;
    assert.equal(avatar.root.visible,true);
    assert.ok(avatar.root.getObjectByName('Human traveller'));
    assert.equal(avatar.root.children[0].visible,false,'Detailed model replaces the provisional body without doubling it');
  } finally {
    resources.forEach(resource=>resource.dispose());
    if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);else Reflect.deleteProperty(globalThis,'window');
  }
});

void test('boarding maintains a seated pose and disembarking restores standing with reduced motion', async () => {
  const gltf=await loadHuman();
  // Save and restore the method; it is never called without its receiver.
  // oxlint-disable-next-line typescript/unbound-method
  const originalLoad=GLTFLoader.prototype.load;
  const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const resources=new Set<{dispose:()=>void}>();
  try {
    Object.defineProperty(globalThis,'window',{value:{},configurable:true});
    GLTFLoader.prototype.load=function(_url,onLoad){onLoad?.(gltf);};
    const avatar=createIslandAvatar(resources,false);
    const height=()=>{avatar.root.updateMatrixWorld(true);return new THREE.Box3().setFromObject(avatar.root.getObjectByName('Human traveller')!,true).max.y;};
    const standing=height();
    avatar.setSeated(true);
    for(let frame=0;frame<300;frame++)avatar.update(0,false,1/60,true);
    assert.ok(height()<standing-.25,'Traveller must remain seated beyond temporary gesture duration');
    avatar.setSeated(false);
    for(let frame=0;frame<120;frame++)avatar.update(0,false,1/60,true);
    assert.ok(Math.abs(height()-standing)<.12,'Standing pose must settle after leaving the boat');
  } finally {
    resources.forEach(resource=>resource.dispose());
    GLTFLoader.prototype.load=originalLoad;
    if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);
    else Reflect.deleteProperty(globalThis,'window');
  }
});

void test('human asset includes embedded skin, clothing, hair and usable animation clips', async () => {
  const { json, bytes, animations, scene } = await loadHuman();
  assert.ok(bytes.length < 8_000_000, 'Human must stay suitable for mobile loading');
  assert.match(json.asset.copyright, /Microsoft/);
  assert.equal(json.images.length, 5);
  assert.ok(json.images.every((image: { bufferView?: number; uri?: string }) => image.bufferView !== undefined && !image.uri));
  assert.ok(json.materials.some((material: { alphaMode?: string }) => material.alphaMode === 'MASK'));
  assert.deepEqual(animations.map(clip => clip.name), ['Idle', 'Walk', 'Run', 'Wave', 'Sit']);
  for (const clip of animations) {
    assert.ok(clip.duration > .5);
    for (const track of clip.tracks) {
      assert.ok(scene.getObjectByName(track.name.slice(0, track.name.lastIndexOf('.'))), `Missing bone: ${track.name}`);
      assert.ok(Array.from(track.values).every(Number.isFinite));
    }
  }
});

void test('human poses keep their scale and walking stays in place', async () => {
  const { scene, animations } = await loadHuman();
  const mixer = new THREE.AnimationMixer(scene);
  const rootBone = scene.getObjectByName('Bip01')!;
  for (const clip of animations) {
    mixer.stopAllAction();
    mixer.clipAction(clip).reset().play();
    for (let step = 0; step < 12; step++) {
      mixer.setTime(clip.duration * step / 12);
      scene.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(scene, true);
      const size = bounds.getSize(new THREE.Vector3());
      assert.ok(size.y > 90 && size.y < (clip.name === 'Wave' ? 230 : 195), `${clip.name} height ${size.y}`);
      assert.ok(size.x < 160 && size.z < 130, `${clip.name} has a distorted pose`);
      assert.ok(Math.abs(rootBone.position.x) < .001 && Math.abs(rootBone.position.z) < .001);
      assert.ok(bounds.min.y > -12 && bounds.min.y < 12, `${clip.name} feet height ${bounds.min.y}`);
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(scene);
});

void test('foot placement bends the leg onto a higher tread without moving the body', async () => {
  const {scene,animations}=await loadHuman();
  scene.scale.setScalar(.01);
  const mixer=new THREE.AnimationMixer(scene);
  mixer.clipAction(animations[0]).play(); mixer.update(.1);
  scene.updateMatrixWorld(true);
  const foot=scene.getObjectByName('Bip01_L_Foot')!;
  const before=foot.getWorldPosition(new THREE.Vector3());
  const place=createFootPlacement(scene);
  place(()=>before.y+.055);
  const after=foot.getWorldPosition(new THREE.Vector3());
  assert.ok(after.y-before.y>.08 && after.y-before.y<.16);
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.025);
  assert.equal(scene.position.y,0);
  mixer.stopAllAction(); mixer.uncacheRoot(scene);
});

void test('foot placement preserves raised swing feet instead of flattening the captured gait', async () => {
  const {scene,animations}=await loadHuman();
  scene.scale.setScalar(.01);
  const mixer=new THREE.AnimationMixer(scene);
  const clip=animations.find(clip=>clip.name==='Walk')!;
  mixer.clipAction(clip).play();
  const foot=scene.getObjectByName('Bip01_L_Foot')!;
  const place=createFootPlacement(scene);
  for(let i=0;i<24;i++) {
    mixer.setTime(i*clip.duration/24);
    const before=foot.getWorldPosition(new THREE.Vector3());
    place(()=>before.y-.18);
    assert.ok(foot.getWorldPosition(new THREE.Vector3()).distanceTo(before)<1e-8);
  }
  mixer.stopAllAction(); mixer.uncacheRoot(scene);
});

void test('the actual player steps while travelling with reduced motion enabled, then settles', async () => {
  const gltf=await loadHuman();
  // Save and restore the method; it is never called without its receiver.
  // oxlint-disable-next-line typescript/unbound-method
  const originalLoad=GLTFLoader.prototype.load;
  const originalWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  const resources=new Set<{dispose:()=>void}>();
  try {
    Object.defineProperty(globalThis,'window',{value:{},configurable:true});
    GLTFLoader.prototype.load=function(_url,onLoad) { onLoad?.(gltf); };
    const avatar=createIslandAvatar(resources,false);
    const left=avatar.root.getObjectByName('Bip01_L_Foot')!;
    const right=avatar.root.getObjectByName('Bip01_R_Foot')!;
    const samples:number[]=[];
    let distance=0;
    for(let frame=0;frame<120;frame++) {
      distance+=2.6/60;
      avatar.update(distance,true,1/60,true,false,()=>0);
      avatar.root.updateMatrixWorld(true);
      if(frame>30) samples.push(left.getWorldPosition(new THREE.Vector3()).z-right.getWorldPosition(new THREE.Vector3()).z);
    }
    assert.ok(Math.max(...samples)>.2 && Math.min(...samples)<-.2,'Both feet must alternate forward/backward instead of sliding in one pose');
    for(let frame=0;frame<120;frame++)avatar.update(distance,false,1/60,true,false,()=>0);
    const resting=left.getWorldPosition(new THREE.Vector3());
    assert.equal(avatar.update(distance,false,1/60,true,false,()=>0),false);
    assert.ok(left.getWorldPosition(new THREE.Vector3()).distanceTo(resting)<1e-6);
  } finally {
    resources.forEach(resource=>resource.dispose());
    GLTFLoader.prototype.load=originalLoad;
    if(originalWindow)Object.defineProperty(globalThis,'window',originalWindow);
    else Reflect.deleteProperty(globalThis,'window');
  }
});
