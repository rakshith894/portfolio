import * as THREE from 'three';
type Point = { x: number; z: number };
type Walkable = (x: number, z: number) => boolean;

/** A cached half-metre grid; every edge and shortcut is checked against real collisions. */
export function createIslandNavigator(canStand: Walkable, canTraverse?: (ax: number, az: number, bx: number, bz: number) => boolean) {
  const step = 0.5, minX = -61, minZ = -63, width = 213, height = 217;
  const valid = new Int8Array(width * height);
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
  const edges = new Int8Array(width * height * directions.length);
  const point = (i: number): Point => ({ x: minX + (i % width) * step, z: minZ + Math.floor(i / width) * step });
  const clear = (a: Point, b: Point) => {
    // The walker already sweeps every 8 cm, including height and solid checks.
    if (canTraverse) return canStand(a.x,a.z) && canTraverse(a.x,a.z,b.x,b.z);
    const count = Math.max(1, Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/0.1));
    for (let j=0;j<=count;j++) {
      const next={x:a.x+(b.x-a.x)*j/count,z:a.z+(b.z-a.z)*j/count};
      if (!canStand(next.x,next.z)) return false;
    }
    return true;
  };
  const open = (i: number) => {
    if (!valid[i]) { const p = point(i); valid[i] = canStand(p.x,p.z) ? 1 : -1; }
    return valid[i] === 1;
  };
  const nearby = (p: Point, radius: number) => {
    const cx=Math.round((p.x-minX)/step), cz=Math.round((p.z-minZ)/step), cells: number[]=[];
    const n = Math.ceil(radius / step);
    for(let z=Math.max(0,cz-n);z<=Math.min(height-1,cz+n);z++) for(let x=Math.max(0,cx-n);x<=Math.min(width-1,cx+n);x++) {
      const i=z*width+x, q=point(i);
      if(Math.hypot(q.x-p.x,q.z-p.z)<=radius && open(i)) cells.push(i);
    }
    return cells.sort((a,b)=> {const p1=point(a),p2=point(b);return Math.hypot(p1.x-p.x,p1.z-p.z)-Math.hypot(p2.x-p.x,p2.z-p.z);});
  };
  function* search(start: Point, target: Point, snap: number): Generator<void, THREE.Vector3[] | null> {
    yield;
    if (![start.x,start.z,target.x,target.z].every(Number.isFinite)) return null;
    if (clear(start,target)) return [new THREE.Vector3(target.x,0,target.z)];

    // Adaptive starting cells
    let startCells = nearby(start, 0.9).filter(i=>clear(start,point(i)));
    if (!startCells.length) startCells = nearby(start, 1.8).filter(i=>clear(start,point(i)));
    if (!startCells.length) startCells = nearby(start, 3.2);
    if (!startCells.length) startCells = nearby(start, 6.0);
    if (!startCells.length) return null;

    // Adaptive goal cells - expands outward if clicking near stones/fences/objects
    let goalCells = nearby(target, Math.max(snap, 1.8));
    if (!goalCells.length) goalCells = nearby(target, 3.6);
    if (!goalCells.length) goalCells = nearby(target, 7.5);
    if (!goalCells.length) goalCells = nearby(target, 14.0);
    if (!goalCells.length) return null;

    const starts = startCells;
    const goals = new Set(goalCells);
    const costs = new Float64Array(width*height).fill(Infinity), parent=new Int32Array(width*height).fill(-1);
    const heap: { i:number; cost:number }[]=[];
    const push=(i:number,cost:number)=> {heap.push({i,cost}); let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(heap[p].cost<=cost)break;[heap[k],heap[p]]=[heap[p],heap[k]];k=p;}};
    const pop=()=>{const first=heap[0], last=heap.pop()!;if(heap.length){heap[0]=last;let k=0;while(true){let c=k*2+1;if(c>=heap.length)break;if(c+1<heap.length&&heap[c+1].cost<heap[c].cost)c++;if(heap[k].cost<=heap[c].cost)break;[heap[k],heap[c]]=[heap[c],heap[k]];k=c;}}return first;};
    const estimate=(i:number)=>{const p=point(i);return Math.max(0,Math.hypot(p.x-target.x,p.z-target.z)-snap);};
    for(const i of starts){const p=point(i);costs[i]=Math.hypot(p.x-start.x,p.z-start.z);push(i,costs[i]+estimate(i));}
    let found=-1;
    let closest=-1;
    let closestDist=Infinity;
    let iterations = 0;
    const maxIterations = 8000;

    while(heap.length && iterations < maxIterations){
      iterations++;
      const {i,cost}=pop();
      if(cost>costs[i]+estimate(i)+1e-7)continue;
      yield;
      const p=point(i);
      const d = Math.hypot(p.x - target.x, p.z - target.z);
      if (d < closestDist) {
        closestDist = d;
        closest = i;
      }
      if(goals.has(i)){found=i;break;}
      const x=i%width,z=Math.floor(i/width);
      for(const [direction,[dx,dz]] of directions.entries()){
        const nx=x+dx,nz=z+dz;if(nx<0||nx>=width||nz<0||nz>=height)continue;
        const ni=nz*width+nx;if(!open(ni))continue;
        if(dx&&dz&&(!open(z*width+nx)||!open(nz*width+x)))continue;
        const next=costs[i]+Math.hypot(dx,dz)*step;
        if(next>=costs[ni])continue;
        const edge=i*directions.length+direction;
        if(!edges[edge])edges[edge]=clear(p,point(ni))?1:-1;
        if(edges[edge]<0)continue;
        costs[ni]=next;parent[ni]=i;push(ni,next+estimate(ni));
      }
    }

    const targetNode = found >= 0 ? found : closest;
    if(targetNode < 0) return null;

    const chain: Point[]=[];for(let i=targetNode;i>=0;i=parent[i])chain.push(point(i));chain.reverse();
    if(found >= 0 && clear(chain[chain.length-1],target))chain.push(target);
    const result: THREE.Vector3[]=[];let anchor:Point=start;
    for(let i=0;i<chain.length;){let end=i;while(end+1<chain.length&&clear(anchor,chain[end+1])){end++;yield;}anchor=chain[end];result.push(new THREE.Vector3(anchor.x,0,anchor.z));i=end+1;yield;}
    if(!result.length && chain.length) {
      result.push(new THREE.Vector3(chain[chain.length-1].x, 0, chain[chain.length-1].z));
    }
    return result;
  }
  function route(start: Point, target: Point, snap = 1.8) {
    const job=search(start,target,snap);
    let result=job.next();while(!result.done)result=job.next();return result.value;
  }
  async function routeAsync(start: Point, target: Point, snap=1.8, cancelled=()=>false) {
    // Let React paint the closed menu and progress message before searching.
    await new Promise<void>(resolve=>setTimeout(resolve,0));
    const job=search({...start},{...target},snap);
    let slice=performance.now();
    while(!cancelled()) {
      const result=job.next();if(result.done)return result.value;
      if(performance.now()-slice>=6){await new Promise<void>(resolve=>setTimeout(resolve,0));slice=performance.now();}
    }
    job.return(null);return null;
  }
  return { route, routeAsync, clear };
}
