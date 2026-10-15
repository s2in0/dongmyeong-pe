// 선생님 화면 · 조별 발표: 제출한 조를 누르면 안무 전체가 펼쳐지고,
// '노래와 함께 발표'를 누르면 노래(제출한 배속)에 맞춰 칸이 박자마다 색칠됩니다.
import {renderBoard,highlightBoard,createSongPlayer} from './choreo_view.js?v=40';
import {musicPosition} from './music_timeline.js?v=40';
import {unpackBars} from './music_bars.js?v=40';

const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
let open=null;

export function rowBars(row){
  if(row.choreography)return unpackBars(row.choreography);
  if(row.sequence?.length)return null;
  const moves=Array.isArray(row.moves?.[0])?row.moves:[row.moves||[]];
  return moves.map(bar=>bar.map(m=>typeof m==='string'?{symbol:m,label:m}:m));
}

export function closePresentation(){open?.close();}

export function openPresentation(row,{loadAudio}){
  closePresentation();
  const bars=rowBars(row),rate=Number(row.playbackRate)||1,bpm=Number(row.bpm)||null;
  const stage=el('div','present-stage'),head=el('header','present-head'),titles=el('div','present-titles');
  titles.append(el('h2','',row.groupName),el('p','',[row.theme,row.audio?.name&&'♫ '+row.audio.name.replace(/\.(mp3|m4a|wav)$/i,''),bpm&&`${bpm} BPM`,rate!==1&&`${rate}배속`].filter(Boolean).join(' · ')));
  const controls=el('div','present-controls'),play=el('button','primary','▶ 노래와 함께 발표'),full=el('button','secondary','⛶ 전체화면'),close=el('button','secondary','✕ 닫기');
  for(const b of [play,full,close])b.type='button';
  controls.append(play,full,close);head.append(titles,controls);
  const status=el('p','present-status'),countdown=el('div','present-countdown hidden'),board=el('div','cv-wrap present-board'),audio=el('audio');
  audio.preload='auto';audio.setAttribute('playsinline','');
  stage.append(head,status,board,countdown,audio);document.body.append(stage);document.body.classList.add('presenting-music');
  if(bars)renderBoard(board,bars);else board.append(el('p','subtle','예전 방식(구간)으로 제출한 안무라 칸 보기를 지원하지 않아요.'));
  const player=createSongPlayer(audio);let url=null,generation=0;
  if(!row.audio||!row.submissionId){play.disabled=true;status.textContent='이 조는 노래 없이 제출했어요.';}
  else if(!bpm){status.textContent='BPM 정보가 없어 노래만 재생돼요.';}
  function stop(){generation++;player.stop();highlightBoard(board,null);countdown.classList.add('hidden');play.textContent='▶ 노래와 함께 발표';}
  // 발표 화면을 여는 순간 노래를 미리 받아 두어, 버튼을 누르면 바로 시작합니다.
  let ready=null;
  const prepare=()=>ready??=(async()=>{status.textContent='노래 불러오는 중…';const data=await loadAudio(row);const bytes=Uint8Array.from(atob(data.data),c=>c.charCodeAt(0));url=URL.createObjectURL(new Blob([bytes],{type:data.mime}));audio.src=url;audio.load();status.textContent=bpm?'준비 완료 · ▶ 노래와 함께 발표를 눌러 주세요.':status.textContent;})().catch(error=>{ready=null;status.textContent='노래를 불러오지 못했어요: '+error.message;throw error;});
  if(row.audio&&row.submissionId)prepare().catch(()=>{});
  play.onclick=async()=>{
    if(player.isPlaying()){stop();status.textContent='';return;}
    const token=++generation;
    if(!url){play.disabled=true;try{await prepare();}catch{return;}finally{play.disabled=false;}if(token!==generation)return;}
    play.textContent='■ 멈춤';status.textContent='';
    player.start({rate,offset:Number(row.audio.offsetSeconds)||0,onEnd:error=>{if(token!==generation)return;stop();status.textContent=error?error.message:'발표 끝! 👏';},onTick:elapsed=>{
      if(token!==generation)return;
      if(elapsed<0){countdown.classList.remove('hidden');countdown.textContent=String(Math.ceil(-elapsed));return;}
      countdown.classList.add('hidden');
      if(!bars||!bpm)return;
      const position=musicPosition(bars,bpm,elapsed);
      if(position.done){highlightBoard(board,null);status.textContent='안무 끝 · 노래는 계속 재생 중';return;}
      highlightBoard(board,position);status.textContent=`${position.bar+1}줄 ${position.slot+1}칸 · ${position.within}/8박 · ${position.move?.label||''}`;
    }});
  };
  full.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await stage.requestFullscreen?.();}catch{}};
  const onKey=e=>{if(e.key==='Escape'&&!document.fullscreenElement)api.close();};
  const api={close(){stop();if(url)URL.revokeObjectURL(url);if(document.fullscreenElement===stage)document.exitFullscreen().catch(()=>{});stage.remove();document.body.classList.remove('presenting-music');document.removeEventListener('keydown',onKey);if(open===api)open=null;}};
  close.onclick=()=>api.close();document.addEventListener('keydown',onKey);
  open=api;return api;
}
