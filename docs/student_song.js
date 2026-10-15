// 학생 노래 선택: 선생님이 올린 우리 반 노래 목록(드롭다운)에서 고르고, 노래 파일은 기기에 보관해 다시 받지 않습니다.
// 선생님이 BPM을 계산해 두지 않은 노래는 이 기기에서 직접 계산합니다.
import {detectBpmFromFile} from './bpm_detect.js?v=40';

function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('jumpy_library_songs',1);r.onupgradeneeded=()=>r.result.createObjectStore('songs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function cache(key,value){
  const db=await database();
  try{return await new Promise((resolve,reject)=>{const tx=db.transaction('songs',value===undefined?'readonly':'readwrite'),store=tx.objectStore('songs'),r=value===undefined?store.get(key):store.put(value,key);let out;r.onsuccess=()=>{out=r.result};tx.oncomplete=()=>resolve(out);tx.onerror=()=>reject(tx.error);});}
  finally{db.close();}
}
function duration(audio){return new Promise((resolve,reject)=>{if(Number.isFinite(audio.duration)&&audio.duration>0)return resolve(audio.duration);const done=()=>{clear();Number.isFinite(audio.duration)&&audio.duration>0?resolve(audio.duration):reject(Error('노래 길이를 확인할 수 없어요.'));},bad=()=>{clear();reject(Error('이 기기에서 재생할 수 없는 노래예요.'));},timer=setTimeout(bad,20000),clear=()=>{clearTimeout(timer);audio.removeEventListener('loadedmetadata',done);audio.removeEventListener('error',bad);};audio.addEventListener('loadedmetadata',done);audio.addEventListener('error',bad);});}

export function initStudentSong({api,identity,select,info,status,audio,onSelected,onStop}){
  let songs=[],current=null,url=null,generation=0,listLoaded='';
  const label=song=>`${song.name.replace(/\.(mp3|m4a|wav)$/i,'')}${song.bpm?` · ${song.bpm} BPM`:''}`;
  function renderOptions(){
    const value=current?.id||'';
    select.replaceChildren();
    const first=document.createElement('option');first.value='';first.textContent=songs.length?'노래를 골라 주세요':'선생님이 아직 노래를 올리지 않았어요';select.append(first);
    for(const song of songs){const o=document.createElement('option');o.value=song.id;o.textContent=label(song);select.append(o);}
    select.value=songs.some(s=>s.id===value)?value:'';select.disabled=!songs.length;
  }
  function renderInfo(){info.textContent=current?`♫ ${current.name} · ${Math.floor(current.durationSeconds/60)}분 ${Math.round(current.durationSeconds%60)}초${current.bpm?` · 추천 ${current.bpm} BPM`:''}`:'';}
  async function refresh(){
    const id=identity();if(!id)return;
    try{const data=await api({type:'musicLibrary',grade:id.grade,classNo:id.classNo,number:id.number});songs=data.songs||[];listLoaded=`${id.grade}-${id.classNo}`;renderOptions();
      if(current){const fresh=songs.find(s=>s.id===current.id);if(!fresh){status.textContent='선생님이 이 노래를 목록에서 뺐어요. 다른 노래를 골라 주세요.';}else if(fresh.bpm&&fresh.bpm!==current.bpm){current.bpm=fresh.bpm;renderInfo();}}
    }catch(error){status.textContent='노래 목록을 불러오지 못했어요: '+error.message;}
  }
  function clear(){generation++;onStop();try{audio.pause();}catch{}audio.removeAttribute('src');audio.load();if(url)URL.revokeObjectURL(url);url=null;current=null;renderInfo();}
  async function choose(id,{quiet=false}={}){
    const song=songs.find(s=>s.id===id);clear();select.value=song?id:'';
    if(!song){onSelected(null);return;}
    const token=generation,me=identity();status.textContent='노래를 불러오는 중…';
    try{
      const key=`${song.id}_${song.version}`;let saved=null;try{saved=await cache(key);}catch{}
      if(!saved){const data=await api({type:'musicLibraryAudio',grade:me.grade,classNo:me.classNo,number:me.number,id:song.id,version:song.version});const bytes=Uint8Array.from(atob(data.data),c=>c.charCodeAt(0));saved={blob:new Blob([bytes],{type:data.mime}),name:data.name};try{await cache(key,saved);}catch{}}
      if(token!==generation)return;
      url=URL.createObjectURL(saved.blob);audio.src=url;audio.load();
      const seconds=await duration(audio);if(token!==generation)return;
      current={...song,durationSeconds:seconds};
      if(!current.bpm){status.textContent='추천 BPM을 계산하는 중…';try{current.bpm=(await detectBpmFromFile(saved.blob)).bpm;current.bpmComputedHere=true;}catch{status.textContent='BPM을 계산하지 못했어요. 직접 입력해 주세요.';}}
      if(token!==generation)return;
      renderInfo();if(!quiet||status.textContent.startsWith('노래를')||status.textContent.startsWith('추천'))status.textContent='';
      onSelected(current,{restored:quiet});
    }catch(error){if(token===generation){status.textContent='노래를 불러오지 못했어요: '+error.message;select.value='';onSelected(null);}}
  }
  select.addEventListener('change',()=>choose(select.value));
  return {
    refresh,choose,clear,
    current:()=>current,
    loadedFor:id=>listLoaded===`${id.grade}-${id.classNo}`,
    async restore(saved){clear();status.textContent='';await refresh();if(saved?.id&&songs.some(s=>s.id===saved.id))await choose(saved.id,{quiet:true});},
    reference(){if(!current)throw Error('먼저 우리 조 노래를 골라 주세요.');return {id:current.id,version:current.version,durationSeconds:current.durationSeconds,offsetSeconds:0};}
  };
}
