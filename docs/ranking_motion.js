export const reducedMotion = () => typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function podiumGroups(rows) {
  const sorted=[...rows].sort((a,b)=>b.count-a.count||a.number-b.number);
  const groups=[];
  for (const row of sorted) {
    const rank=1+sorted.filter(other=>other.count>row.count).length;
    if(rank>3)continue;
    let group=groups.find(item=>item.rank===rank);
    if(!group){group={rank,count:row.count,numbers:[]};groups.push(group)}
    group.numbers.push(row.number);
  }
  return groups;
}

const numberFrames=new WeakMap();
export function showAnimatedCount(node,count,{animate=true,duration=450}={}) {
  const pending=numberFrames.get(node);if(pending)cancelAnimationFrame(pending);
  const start=Number(node.dataset.count??count);node.dataset.count=String(count);
  if(!animate||reducedMotion()||start===count){node.textContent=`${count}회`;return}
  const from=Number.parseInt(node.textContent,10);const initial=Number.isFinite(from)?from:start;
  let began;
  const tick=now=>{
    if(!node.isConnected){numberFrames.delete(node);return}
    began??=now;const progress=Math.min(1,(now-began)/duration),ease=1-(1-progress)**3;
    node.textContent=`${Math.round(initial+(count-initial)*ease)}회`;
    if(progress<1)numberFrames.set(node,requestAnimationFrame(tick));else numberFrames.delete(node);
  };
  numberFrames.set(node,requestAnimationFrame(tick));
}

// Keep each student node across updates, then animate its old-to-new position.
export function createRankingMotion(container,{build,patch,getKey=row=>String(row.number)}) {
  let scope=null,nodes=new Map(),previous=new Map();
  const animations=new Map();
  const cancel=()=>{for(const animation of animations.values())animation.cancel();animations.clear()};
  return {
    reset(){cancel();scope=null;nodes.clear();previous.clear();container.replaceChildren()},
    render(rows,{key='',animate=true}={}) {
      const freshScope=scope!==key;scope=key;
      const visible=container.getClientRects().length>0;
      const motion=animate&&!freshScope&&visible&&!reducedMotion();
      const positions=new Map();
      if(motion)for(const [id,node] of nodes)positions.set(id,node.getBoundingClientRect());
      cancel();
      if(freshScope){nodes.clear();previous.clear();container.replaceChildren()}
      const incoming=new Set(rows.map(getKey));
      for(const [id,node] of nodes)if(!incoming.has(id)){node.remove();nodes.delete(id)}
      for(const row of rows){
        const id=getKey(row),old=previous.get(id);let node=nodes.get(id);
        if(!node){node=build(row);node.dataset.student=id;nodes.set(id,node)}
        patch(node,row,old,{animate:motion});container.append(node);
      }
      if(motion)for(const [id,node] of nodes){
        let animation;
        if(positions.has(id)){const before=positions.get(id),after=node.getBoundingClientRect(),offset=before.top-after.top,offsetX=(before.left||0)-(after.left||0);
          if(Math.abs(offset)>1||Math.abs(offsetX)>1)animation=node.animate?.([{transform:offsetX?`translate(${offsetX}px, ${offset}px)`:`translateY(${offset}px)`},{transform:'translate(0, 0)'}],{duration:680,easing:'cubic-bezier(.22,1,.36,1)'});
        }else animation=node.animate?.([{opacity:0,transform:'translateY(18px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,easing:'ease-out'});
        if(animation)animations.set(id,animation);
      }
      previous=new Map(rows.map(row=>[getKey(row),{...row}]));
    }
  };
}
