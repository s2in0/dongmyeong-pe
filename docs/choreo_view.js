// 안무 보드: 학생 '노래와 안무 재생'과 선생님 '발표하기'가 함께 쓰는 화면입니다.
// 줄마다 8칸(한 칸 = 8박)을 보여 주고, 재생 중에는 지금 칸의 박자 칸(8개)이 BPM에 맞춰 하나씩 색칠됩니다.
// 나뉜 칸(4박×2, 2박×4)은 위아래로 쌓아 보여 주고, 지금 박자에 해당하는 부분만 강조합니다.
import {cellParts} from './music_bars.js?v=40';

const BEATS=8;
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};

export function renderBoard(container,bars,{title=''}={}){
  const board=el('div','cv-board'),cells=[];
  if(title)board.append(el('p','cv-title',title));
  bars.forEach((row,barIndex)=>{
    const line=el('div','cv-row'),grid=el('div','cv-cells');line.dataset.bar=barIndex;
    line.append(el('span','cv-row-title',`${barIndex+1}줄`),grid);
    row.forEach((cell,slot)=>{
      const parts=cellParts(cell),box=el('div','cv-cell'),stack=el('div','cv-parts n'+parts.length),ticks=el('div','cv-ticks');
      box.dataset.bar=barIndex;box.dataset.slot=slot;
      parts.forEach((move,piece)=>{const part=el('div','cv-part');part.dataset.piece=piece;part.title=move?.label||'';part.append(el('b','fit-sym fit-2',move?.symbol||'·'));if(parts.length===1&&move&&move.label!==move.symbol)part.append(el('small','cv-label fit-sym',move.label));stack.append(part);});
      for(let i=0;i<BEATS;i++)ticks.append(el('i'));
      box.append(stack,ticks);grid.append(box);cells.push(box);
    });
    board.append(line);
  });
  container.replaceChildren(board);
  container._cv={cells,last:-1};
  return board;
}

// position: musicPosition() 결과(없으면 강조 해제)
export function highlightBoard(container,position){
  const view=container._cv;if(!view)return;
  const index=position&&!position.done?position.index:-1;
  if(index!==view.last){
    view.cells.forEach((cell,i)=>{cell.classList.toggle('done',index>=0&&i<index);cell.classList.toggle('playing',i===index);if(i!==index)cell.querySelectorAll('.on,.active').forEach(n=>n.classList.remove('on','active'));});
    view.last=index;
    const cell=view.cells[index];
    if(cell&&position.slot===0)cell.closest('.cv-row')?.scrollIntoView({block:'center',behavior:'smooth'});
  }
  const cell=view.cells[index];if(!cell)return;
  cell.querySelectorAll('.cv-ticks i').forEach((tick,i)=>tick.classList.toggle('on',i<position.within));
  cell.querySelectorAll('.cv-part').forEach((part,i)=>part.classList.toggle('active',i===position.piece));
}

// 노래 재생: 3·2·1 뒤 시작, 배속(음 높이 유지), 지난 시간(초)을 onTick으로 알려 줍니다.
// iPad는 버튼을 누른 순간에만 소리를 켤 수 있어서, 누를 때 소리 없이 잠깐 재생해 둔 뒤 카운트다운이 끝나면 다시 재생합니다.
export function createSongPlayer(audio){
  let timer=null,generation=0,startAt=0,started=false;
  function stop(){generation++;clearTimeout(timer);timer=null;started=false;try{audio.pause();}catch{}audio.muted=false;}
  function applyRate(rate){audio.defaultPlaybackRate=rate;audio.playbackRate=rate;audio.preservesPitch=true;audio.webkitPreservesPitch=true;audio.mozPreservesPitch=true;}
  function start({offset=0,rate=1,countdown=3,onTick,onEnd}){
    stop();const token=generation;applyRate(rate);
    try{audio.currentTime=offset;}catch{}
    audio.muted=true;
    const unlock=audio.play();
    if(unlock?.then)unlock.then(()=>{if(token===generation&&!started)audio.pause();}).catch(()=>{});
    startAt=performance.now()+countdown*1000;
    const loop=()=>{
      if(token!==generation)return;
      const now=performance.now();
      if(now<startAt){onTick((now-startAt)/1000);}
      else{
        if(!started){started=true;try{audio.pause();audio.currentTime=offset;}catch{}audio.muted=false;applyRate(rate);
          const playing=audio.play();if(playing?.catch)playing.catch(error=>{if(token!==generation)return;stop();onEnd?.(Error('노래를 재생하지 못했어요. 재생 버튼을 다시 눌러 주세요.'));});}
        if(audio.ended){stop();onEnd?.();return;}
        onTick(Math.max(0,(audio.currentTime-offset)/rate));
      }
      timer=setTimeout(loop,40);
    };
    loop();
  }
  return {start,stop,isPlaying:()=>timer!==null};
}
