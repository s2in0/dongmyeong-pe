export const MAX_AUDIO_BYTES=10*1024*1024;
const formats={mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav'};
export function audioFormat(file){const ext=String(file.name||'').split('.').at(-1).toLowerCase();if(!formats[ext])throw Error('MP3, M4A, WAV 노래 파일을 선택해 주세요.');if(!file.size||file.size>MAX_AUDIO_BYTES)throw Error('노래 파일은 10MB 이하로 선택해 주세요.');return formats[ext];}
export function bytesBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}
function database(){return new Promise((resolve,reject)=>{const r=indexedDB.open('jumpy_music_audio',1);r.onupgradeneeded=()=>r.result.createObjectStore('songs');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function savedSong(key,value,remove=false){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('songs',value===undefined&&!remove?'readonly':'readwrite'),store=tx.objectStore('songs'),r=remove?store.delete(key):value===undefined?store.get(key):store.put(value,key);let result;r.onsuccess=()=>{result=r.result};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}finally{db.close();}}
function metadata(audio){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>done(Error('노래를 읽지 못했어요. 다른 파일을 선택해 주세요.')),15000);function done(error){clearTimeout(timer);audio.removeEventListener('loadedmetadata',ok);audio.removeEventListener('error',bad);error?reject(error):resolve(audio.duration);}function ok(){Number.isFinite(audio.duration)&&audio.duration>0?done():done(Error('노래 길이를 확인할 수 없어요.'));}function bad(){done(Error('이 기기에서 재생할 수 없는 노래예요. MP3 또는 M4A 파일로 다시 선택해 주세요.'));}audio.addEventListener('loadedmetadata',ok);audio.addEventListener('error',bad);audio.load();});}
export function initMusicTrack({key,onStop,onChange}){
 const fileInput=document.getElementById('songFile'),audio=document.getElementById('songPreview'),info=document.getElementById('songInfo'),status=document.getElementById('songStatus'),offset=document.getElementById('songOffset'),remove=document.getElementById('removeSong');
 let track=null,url=null,generation=0,audioContext=null,source=null,playbackGeneration=0;
 function stopPlayback(){playbackGeneration++;if(source){source.onended=null;try{source.stop();}catch{}source.disconnect();source=null;}audio.pause();}
 function render(){audio.classList.toggle('hidden',!track);remove.disabled=!track;offset.disabled=!track;offset.max=track?.duration||0;info.textContent=track?`${track.name} · ${Math.floor(track.duration/60)}분 ${Math.round(track.duration%60)}초 · ${(track.file.size/1024/1024).toFixed(1)}MB`:'아직 선택한 노래가 없어요.';}
 function detach(){generation++;onStop();stopPlayback();audio.removeAttribute('src');audio.load();if(url)URL.revokeObjectURL(url);url=null;track=null;fileInput.value='';offset.value='0';render();onChange();}
 async function persist(){const current=track,studentKey=key();if(!current||!studentKey)return;try{await savedSong(studentKey,{file:current.file,name:current.name,mime:current.mime,offset:Number(offset.value)||0});}catch{if(track===current)status.textContent='노래는 선택됐지만 기기 저장 공간이 부족해요. 새로고침하면 다시 선택해 주세요.';}}
 async function install(file,name,mime,startOffset=0,persistNow=true){const token=++generation,newUrl=URL.createObjectURL(file),probe=document.createElement('audio');probe.preload='metadata';probe.src=newUrl;let duration;try{duration=await metadata(probe);}catch(e){URL.revokeObjectURL(newUrl);throw e;}finally{probe.removeAttribute('src');probe.load();}if(token!==generation){URL.revokeObjectURL(newUrl);return;}onStop();stopPlayback();if(url)URL.revokeObjectURL(url);url=newUrl;track={file,name,mime,duration,checksum:null,decoded:null};audio.src=url;audio.load();offset.value=Number.isFinite(startOffset)&&startOffset>=0&&startOffset<duration?startOffset:0;render();status.textContent='노래를 선택했어요. 제출하면 선생님 화면에서도 들을 수 있어요.';onChange();if(persistNow)await persist();}
 fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];if(!file)return;status.textContent='노래를 준비하는 중…';try{await install(file,file.name,audioFormat(file));}catch(e){status.textContent=e.message;fileInput.value='';}});
 offset.addEventListener('input',()=>{onStop();onChange();persist();});
 remove.onclick=async()=>{const studentKey=key();detach();try{if(studentKey)await savedSong(studentKey,undefined,true);}catch{}status.textContent='선택한 노래를 지웠어요. 이미 제출한 노래는 제출 이력에 남아 있어요.';};
 audio.addEventListener('play',()=>onStop());audio.addEventListener('seeking',()=>onStop());render();
 return {
  audio,detach,pause:stopPlayback,hasSong:()=>!!track,
  startOffset(){const n=Number(offset.value);if(!Number.isFinite(n)||n<0||track&&n>=track.duration)throw Error('안무 시작 시간을 노래 길이 안에서 입력해 주세요.');return n;},
  async restore(){detach();status.textContent='';const studentKey=key(),token=generation;if(!studentKey)return;try{const value=await savedSong(studentKey);if(token!==generation||key()!==studentKey)return;if(value?.file)await install(value.file,value.name,value.mime,Number(value.offset)||0,false);}catch{if(token===generation)status.textContent='기기에 저장된 노래를 읽지 못했어요. 파일을 다시 선택해 주세요.';}},
  startWithCountdown(onEnded){
   if(!track)throw Error('마지막에 노래 파일을 먼저 선택해 주세요.');
   const offset=this.startOffset(),current=track;audioContext??=new (window.AudioContext||window.webkitAudioContext)();
   // Resume synchronously in the play tap, before metadata/decode promises.
   const resumed=audioContext.resume();stopPlayback();const token=playbackGeneration;
   const decoded=current.decoded?Promise.resolve(current.decoded):current.file.arrayBuffer().then(bytes=>audioContext.decodeAudioData(bytes)).then(buffer=>{current.decoded=buffer;return buffer;});
   return Promise.all([resumed,decoded]).then(([,buffer])=>{if(token!==playbackGeneration||track!==current)return null;if(audioContext.state!=='running')throw Error('재생 버튼을 다시 눌러 노래 소리를 켜 주세요.');source=audioContext.createBufferSource();source.buffer=buffer;source.connect(audioContext.destination);const start=audioContext.currentTime+3;source.onended=()=>{if(token===playbackGeneration)onEnded();};source.start(start,offset);return {elapsed:()=>audioContext.currentTime-start};});
  },
  playFromStart(){if(!track)return Promise.resolve();audio.currentTime=this.startOffset();return audio.play();},
  async payload(){if(!track)return null;const current=track,startOffset=this.startOffset(),bytes=new Uint8Array(await current.file.arrayBuffer());current.checksum??=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');return {name:current.name,mime:current.mime,bytes:bytes.length,durationSeconds:current.duration,offsetSeconds:startOffset,checksum:current.checksum,data:bytesBase64(bytes)};}
 };
}
