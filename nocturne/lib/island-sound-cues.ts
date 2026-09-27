import { HAUNT_SITES } from './island-haunting.ts';

type Sounds = { step: (running: boolean, wood: boolean, side: number) => void; gate: () => void; ghost: (pan: number, strength: number) => void; bell?: (pan:number)=>void; thunder?:()=>void };
/** Distance-driven footsteps and proximity events do not accumulate in paused tabs. */
export function createIslandSoundCues(sounds: Sounds) {
  let stride=0, foot=1, gateWasOpen=false, lastGate=-10, lastGhost=0, lastBell=0;
  const visits=new Map<number,number>();
  let storm=-1;
  return { update(time: number, moved: number, running: boolean, inBoat: boolean, x: number, z: number, gateOpening: number) {
    const thunderCycle=Math.floor((time-7.8)/27);
    if(thunderCycle>=0 && thunderCycle!==storm){sounds.thunder?.();storm=thunderCycle;}
    if (!inBoat && moved>0) {
      stride+=moved;
      if (stride >= (running?1.35:.8)) { stride=0; foot=-foot; sounds.step(running,z < -44 && x < -12,foot*.12); }
    } else stride=0;
    const open=gateOpening>.18;
    if(!inBoat && z<8 && time-lastBell>43){sounds.bell?.(-.55);lastBell=time;}
    if(open!==gateWasOpen && time-lastGate>2.5) { sounds.gate(); lastGate=time; gateWasOpen=open; }
    if(inBoat || time-lastGhost<12)return;
    let nearest=-1, distance=14;
    HAUNT_SITES.forEach((site,index)=>{const d=Math.hypot(x-site.x,z-site.z);if(d<distance && time-(visits.get(index)??-60)>38){distance=d;nearest=index;}});
    if(nearest<0)return;
    sounds.ghost((HAUNT_SITES[nearest].x-x)/Math.max(distance,1),.45+.55*(1-distance/14));
    visits.set(nearest,time);lastGhost=time;
  }};
}
