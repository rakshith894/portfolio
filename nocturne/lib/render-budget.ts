/** Reduce GPU fill work on large/high-DPI screens, with slow recovery to avoid oscillation. */
export function createRenderBudget(mobile:boolean,deviceRatio:number) {
  let quality=1,elapsed=0,samples=0,total=0,cooldown=2;
  return {
    ratio(width:number,height:number){
      const cap=Math.min(deviceRatio,mobile?1.15:1.5,Math.sqrt((mobile?750000:1500000)/Math.max(1,width*height)));
      return Math.max(.5,cap*quality);
    },
    sample(milliseconds:number){
      if(!Number.isFinite(milliseconds)||milliseconds<=0||milliseconds>250)return false;
      elapsed+=milliseconds/1000;total+=milliseconds;samples++;
      if(elapsed<cooldown)return false;
      const average=total/samples;elapsed=0;total=0;samples=0;cooldown=3;
      const before=quality;
      if(average>(mobile?42:27))quality=Math.max(.6,quality-.12);
      else if(average<(mobile?34:18))quality=Math.min(1,quality+.04);
      return quality!==before;
    },
  };
}
