import {packBars} from './music_bars.js?v=40';
export const TEST_MODE=new URLSearchParams(globalThis.location?.search||'').get('test')==='1';
export const TEST_CLASS_NO=30;
export const TEST_ROSTER={numbers:Array.from({length:15},(_,i)=>i+1),total:15,maxNumber:15};
const STORE='jumpy_test_class_v1';
const moves=[{symbol:'o',label:'발모아뛰기 1박'},{symbol:'↔',label:'번갈아뛰기'},{symbol:'✕',label:'엇걸기'},{symbol:'◇',label:'옆뛰기'},{symbol:'★',label:'자유 동작'}];
const medals=[{id:'first-step',name:'첫 발걸음',type:'count',goal:30,image:'first-step'},{id:'silver-rhythm',name:'은빛 리듬',type:'count',goal:60,image:'silver-rhythm'},{id:'sky-jump',name:'하늘 점프',type:'count',goal:100,image:'sky-jump'},{id:'steady-star',name:'꾸준한 별',type:'attempts',goal:8,image:'steady-star'}];
const clone=value=>JSON.parse(JSON.stringify(value));
function dayOf(now){const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function seed(now){
 const day=dayOf(now),lessonId='test-lesson-'+day,settings={durationSeconds:60,countdownSeconds:3,sensitivity:'보통',retryAllowed:true,retryLimit:20,recordMode:'best',rankingVisible:true,activityOpen:true};
 const songs=[['점프 리듬',125],['함께 점프',128],['별빛 스텝',123]].map(([name,bpm],i)=>({id:'test-song-'+(i+1),name:name+'.wav',bpm,version:'original-v1',mime:'audio/wav',durationSeconds:128*60/bpm,assigned:true}));
 const today=[91,104,121,88,102,76,115,97,133,108,83,119,95,126,110],gains=[18,24,29,17,22,12,25,16,31,20,15,27,19,28,21],records=[];
 const at=(offset,minute)=>{const d=new Date(day+'T09:00:00+09:00');d.setUTCDate(d.getUTCDate()-offset);d.setUTCMinutes(minute);return d.toISOString();};
 for(let number=1;number<=15;number++){
  if(number!==15)for(const [i,offset]of [28,24,21,17,14,10,7,3].entries()){
   const count=Math.max(12,today[number-1]-gains[number-1]-(7-i)*5+(i===3?-2:0));
   records.push({id:`test-history-${number}-${offset}`,createdAt:at(offset,number),grade:1,classNo:TEST_CLASS_NO,number,count,durationSeconds:60,countdownSeconds:3,sensitivity:'보통',misses:0,bestStreak:count,lessonId:'test-history-'+offset,sessionId:'test-history-'+offset,activityType:'rope',settingsSnapshot:{...settings,activityOpen:true}});
  }
  for(let attempt=0;attempt<2;attempt++)records.push({id:`test-today-${number}-${attempt}`,createdAt:at(0,number+attempt*20),grade:1,classNo:TEST_CLASS_NO,number,count:today[number-1]-(attempt?0:6),durationSeconds:60,countdownSeconds:3,sensitivity:'보통',misses:0,bestStreak:today[number-1]-(attempt?0:6),lessonId,sessionId:lessonId,activityType:'rope',settingsSnapshot:{...settings,activityOpen:true}});
 }
 const music=songs.map((song,i)=>{
  const bars=Array.from({length:2},(_,b)=>Array.from({length:8},(_,n)=>clone(moves[(Math.floor(n/2)+b+i)%moves.length])));
  if(i===1)bars[0][3]={split:2,parts:[clone(moves[0]),clone(moves[1])]};
  if(i===2)bars[1][5]={split:4,parts:moves.slice(0,4).map(clone)};
  return {submissionId:'test-group-'+(i+1),createdAt:at(0,40+i),grade:1,classNo:TEST_CLASS_NO,number:i*5+1,groupName:['점프스타','리듬메이커','하늘점프'][i],theme:['함께 뛰는 즐거움','우리만의 리듬','별빛을 따라 점프'][i],bpm:song.bpm,playbackRate:1,beatsPerMove:8,choreography:packBars(bars),lessonId:'test-music-'+day,settingsSnapshot:{activityType:'music',activityOpen:true},librarySongId:song.id,audio:{name:song.name,mime:'audio/wav',durationSeconds:song.durationSeconds,offsetSeconds:0},draftBars:bars};
 });
 return {version:1,day,lessonId,settings,musicSettings:{activityOpen:true},records,songs,music,moveOptions:moves,medals,live:false,liveStart:0,progress:[],uploads:{}};
}
// All demo state uses this namespace. It must never enumerate or resend real outboxes.
export function testStorage(storage){const prefix='jumpy_test_';const keys=()=>Array.from({length:storage.length},(_,i)=>storage.key(i)).filter(k=>k?.startsWith(prefix));return {getItem:k=>storage.getItem(prefix+k),setItem:(k,v)=>storage.setItem(prefix+k,v),removeItem:k=>storage.removeItem(prefix+k),key:i=>keys()[i]?.slice(prefix.length),get length(){return keys().length;}};}
export function createTestClassApi({storage=globalThis.localStorage,now=()=>Date.now()}={}){
 let memory=null;const audioCache=new Map();
 function read(){let value;try{value=JSON.parse(storage.getItem(STORE)||'null');}catch{}if(value?.version===1&&value.day===dayOf(now()))return value;if(memory?.day===dayOf(now()))return memory;return seed(now());}
 function save(value){memory=value;storage.setItem(STORE,JSON.stringify(value));}
 function rows(state){const by=new Map();for(const r of state.records){if(r.sessionId!==state.lessonId||r.durationSeconds!==state.settings.durationSeconds)continue;const old=by.get(r.number);if(!old)by.set(r.number,{number:r.number,count:r.count,attempts:1,createdAt:r.createdAt});else {old.attempts++;if(state.settings.recordMode==='latest'?r.createdAt>old.createdAt:r.count>old.count){old.count=r.count;old.createdAt=r.createdAt;}}}const ranking=[...by.values()].sort((a,b)=>b.count-a.count||a.number-b.number);return ranking.map(r=>({...r,rank:1+ranking.filter(other=>other.count>r.count).length}));}
 function progress(state){if(!state.live)return state.progress;const seconds=Math.min(60,Math.max(0,(now()-state.liveStart)/1000));if(seconds>=60){state.live=false;state.settings.activityOpen=false;save(state);return [];}return TEST_ROSTER.numbers.slice(0,8).map(number=>({id:'test-live-'+number,number,count:Math.floor(seconds*(1.5+(number%4)*.22)),elapsedSeconds:seconds,durationSeconds:60,deliveryState:'measuring',stale:false,sessionId:state.lessonId}));}
 function common(state){return {ok:true,lessonId:state.lessonId,sessionId:state.lessonId,settingsVersion:'test-'+state.day,settings:clone(state.settings),musicSettings:clone(state.musicSettings),musicLessonId:'test-music-'+state.day,moveOptions:clone(state.moveOptions),medals:clone(state.medals),pending:0};}
 function view(state,body,teacher){const ranking=rows(state),base=common(state);return teacher?{...base,ranking,records:clone(state.records),music:clone(state.music),participants:ranking.map(r=>r.number),progress:clone(progress(state))}:{...base,ranking:{rank:ranking.find(r=>r.number===body.number)?.rank||null,total:ranking.length,leaders:ranking},records:clone(state.records.filter(r=>r.number===body.number))};}
 async function audio(state,id){if(state.uploads[id])return clone(state.uploads[id]);const song=state.songs.find(s=>s.id===id);if(!song)throw Error('테스트 노래를 찾을 수 없어요.');if(!audioCache.has(id)){const bytes=composeTestSong(song.bpm,state.songs.indexOf(song));let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));audioCache.set(id,{ok:true,name:song.name,mime:'audio/wav',data:btoa(text)});}return audioCache.get(id);}
 async function api(body){
  if((body.grade!==undefined&&Number(body.grade)!==1)||(body.classNo!==undefined&&Number(body.classNo)!==TEST_CLASS_NO))throw Error('테스트 반만 사용할 수 있어요.');
  if(body.number!==undefined&&(!Number.isInteger(body.number)||!TEST_ROSTER.numbers.includes(body.number)))throw Error('테스트 번호는 1~15번이에요.');
  const state=read();
  switch(body.type){
   case 'ping':case 'flushRecords':case 'refreshClassSheets':return {ok:true,pending:0,busy:false};
   case 'teacherData':case 'teacherLive':return view(state,body,true);
   case 'bootstrap':case 'studentLive':return view(state,body,false);
   case 'studentSettings':case 'teacherSettings':return {...common(state),requestId:state.requestId,musicSettingsRequestId:state.musicRequestId};
   case 'saveSettings':state.settings=clone(body.settings);state.requestId=body.requestId;if(body.startLesson){state.lessonId='test-lesson-'+now();state.settings.activityOpen=true;state.progress=[];state.live=false;}if(!body.settings.activityOpen){state.live=false;state.progress=[];}save(state);return {...common(state),requestId:body.requestId};
   case 'saveMusicSettings':state.musicSettings=clone(body.settings);state.musicRequestId=body.requestId;save(state);return {...common(state),musicSettingsRequestId:body.requestId};
   case 'saveMoves':state.moveOptions=clone(body.moves);save(state);return common(state);
   case 'saveMedals':state.medals=clone(body.medals);save(state);return common(state);
   case 'record':if(!Number.isInteger(body.count)||body.count<0||!body.id||body.lessonId!==state.lessonId)throw Error('테스트 기록을 확인해 주세요.');if(!state.records.some(r=>r.id===body.id)){state.records.push({...clone(body),sessionId:state.lessonId,settingsSnapshot:clone(state.settings),activityType:'rope'});state.progress=state.progress.filter(r=>r.id!==body.id);save(state);}return {...view(state,body,false),createdAt:body.createdAt,queued:false};
   case 'recordProgress':state.progress=state.progress.filter(r=>r.id!==body.id);if(!body.cancelled)state.progress.push(clone(body));save(state);return {ok:true};
   case 'musicLibrary':case 'musicLibraryAdmin':return {ok:true,songs:clone(state.songs),folderUrl:''};
   case 'musicLibraryAudio':case 'musicLibraryAudioAdmin':return audio(state,body.id);
   case 'musicAudio':{const group=state.music.find(r=>r.submissionId===body.submissionId);if(!group)throw Error('테스트 제출을 찾을 수 없어요.');return audio(state,group.librarySongId);}
   case 'musicLibraryUpdate':{const song=state.songs.find(r=>r.id===body.id);if(!song)throw Error('테스트 노래를 찾을 수 없어요.');if(body.remove)state.songs=state.songs.filter(r=>r.id!==body.id);else {if(body.bpm!==undefined)song.bpm=body.bpm;if(body.durationSeconds)song.durationSeconds=body.durationSeconds;}save(state);return {ok:true,songs:clone(state.songs)};}
   case 'musicLibraryUpload':{const id='test-upload-'+now(),a=body.audio;state.songs.push({id,name:a.name,mime:a.mime,version:String(now()),assigned:true,bpm:body.bpm,durationSeconds:a.durationSeconds});state.uploads[id]={ok:true,name:a.name,mime:a.mime,data:a.data};save(state);return {ok:true,songs:clone(state.songs)};}
   case 'musicSubmit':{const song=state.songs.find(r=>r.id===body.librarySong?.id);if(!song)throw Error('테스트 노래를 골라 주세요.');const row={...clone(body),createdAt:new Date(now()).toISOString(),lessonId:'test-music-'+state.day,librarySongId:song.id,audio:{name:song.name,mime:song.mime,durationSeconds:song.durationSeconds,offsetSeconds:0},settingsSnapshot:{activityType:'music',...state.musicSettings}};state.music=state.music.filter(r=>r.groupName!==row.groupName);state.music.push(row);save(state);return {ok:true,songSaved:true};}
   default:throw Error('이 동작은 테스트 반에서 지원하지 않아요.');
  }
 }
 return {api,seedDraft(number=3){const state=read(),group=state.music[Math.floor((number-1)/5)%state.music.length];return group?{groupName:group.groupName,theme:group.theme,bars:group.draftBars||group.choreography.bars.map(row=>row.map(i=>Array.isArray(i)?{split:i.length,parts:i.map(n=>group.choreography.palette[n])}:group.choreography.palette[i])),bpm:group.bpm,rate:1,song:{id:group.librarySongId,version:state.songs.find(s=>s.id===group.librarySongId)?.version},format:'bars-v2',beatsPerMove:8}:null;},setLive(value){const state=read();state.live=value;state.liveStart=now();state.settings.activityOpen=value;save(state);},get live(){return read().live;}};
}
// Original instrumental loops, synthesized locally as mono PCM WAV. No external song or Drive file.
export function composeTestSong(bpm=125,variant=0){
 const rate=16000,beat=60/bpm,seconds=128*beat,length=Math.ceil(seconds*rate),buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);
 const text=(at,value)=>[...value].forEach((c,i)=>view.setUint8(at+i,c.charCodeAt(0)));text(0,'RIFF');view.setUint32(4,36+length*2,true);text(8,'WAVEfmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,length*2,true);
 const melodies=[[72,76,79,76,74,77,81,79,72,76,79,83,81,79,76,74],[69,72,76,72,71,74,77,74,69,72,76,79,77,76,72,71],[67,71,74,79,76,74,71,69,67,71,74,76,79,76,74,71]],notes=melodies[variant%3];let random=1234567+variant;
 for(let i=0;i<length;i++){const t=i/rate,b=Math.floor(t/beat),p=t-b*beat,half=t%(beat/2),note=notes[b%notes.length],freq=440*2**((note-69)/12);random=(Math.imul(random,1664525)+1013904223)|0;const noise=random/2147483648;
  const kick=.32*Math.sin(2*Math.PI*(55*p+85*.025*(1-Math.exp(-p/.025))))*Math.exp(-p*27);
  const hat=.055*noise*Math.exp(-half*95),snare=b%4===1||b%4===3?.10*noise*Math.exp(-p*35):0;
  const melody=.17*(Math.sin(2*Math.PI*freq*p)+.2*Math.sin(4*Math.PI*freq*p))*Math.min(1,p/.012)*Math.exp(-p*5);
  const bass=.13*Math.sin(2*Math.PI*freq/4*p)*Math.exp(-p*5),fade=Math.min(1,t/.03,(seconds-t)/.08);
  view.setInt16(44+i*2,Math.round(Math.max(-.95,Math.min(.95,(kick+hat+snare+melody+bass)*fade))*32767),true);
 }
 return new Uint8Array(buffer);
}
export function mountTestTools({teacher=false,live=false,onLive=()=>{}}={}){
 const bar=document.createElement('nav');bar.className='test-tools';bar.setAttribute('aria-label','테스트');
 const title=document.createElement('strong');title.textContent='테스트';bar.append(title);const note=document.createElement('span');note.className='subtle test-note';note.textContent='가상 데이터';bar.append(note);
 for(const [label,path]of [['학생 기록','./?test=1&view=history'],['음악 줄넘기','./?test=1&view=music'],['선생님 화면','teacher.html?test=1&view=ranking']]){const a=document.createElement('a');a.href=path;a.className='text-button';a.textContent=label;bar.append(a);}
 if(teacher){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=live?'오늘 기록 보기':'실시간 보기';b.onclick=()=>{const active=b.textContent==='실시간 보기';onLive(active);b.textContent=active?'오늘 기록 보기':'실시간 보기';};bar.append(b);}
 const reset=document.createElement('button');reset.type='button';reset.className='text-button';reset.textContent='예시 초기화';reset.onclick=()=>{const keys=Array.from({length:localStorage.length},(_,i)=>localStorage.key(i)).filter(k=>k?.startsWith('jumpy_test_'));keys.forEach(k=>localStorage.removeItem(k));location.reload();};bar.append(reset);
 const back=document.createElement('a');back.href=teacher?'teacher.html':'./';back.className='text-button';back.textContent='실제 수업';bar.append(back);document.querySelector('.app-header').after(bar);
}
