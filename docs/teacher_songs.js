// 선생님 화면 · 수업용 노래: 반별로 노래를 올리면 BPM을 이 컴퓨터에서 계산해 함께 저장합니다.
// 학생 화면의 '우리 조 노래' 드롭다운에는 그 반 노래(와 반을 정하지 않은 드라이브 노래)만 보입니다.
import {detectBpmFromFile} from './bpm_detect.js?v=40';

const AUDIO_TYPES={mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav'},MAX_BYTES=10*1024*1024;
function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}
async function sha256(bytes){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
const minutes=s=>s?`${Math.floor(s/60)}분 ${Math.round(s%60)}초`:'';

export function initTeacherSongs({api,pin,chosen}){
  const $=id=>document.getElementById(id),list=$('songLibraryList'),status=$('songLibraryStatus'),input=$('songLibraryFile'),upload=$('uploadLibrarySongs');
  let songs=[],busy=false,loadedFor='';
  const scope=()=>{const c=chosen();return `${c.grade}-${c.classNo}`;};
  function render(){
    list.replaceChildren();
    if(!songs.length){list.append(el('li','song-library-empty','아직 이 반 노래가 없어요. 위에서 노래 파일을 올려 주세요.'));return;}
    for(const song of songs){
      const item=el('li','song-library-item'),info=el('div','song-library-info'),name=el('strong','',song.name),meta=el('small','',[minutes(song.durationSeconds),song.assigned?'':'반 미지정 · 모든 반에 보임'].filter(Boolean).join(' · ')||'');
      info.append(name,meta);
      const bpmBox=el('label','song-bpm'),bpmInput=el('input');bpmInput.type='number';bpmInput.min='20';bpmInput.max='300';bpmInput.step='0.01';bpmInput.value=song.bpm??'';bpmInput.placeholder='BPM';bpmInput.setAttribute('aria-label',`${song.name} BPM`);
      bpmBox.append(el('span','', 'BPM'),bpmInput);
      const save=el('button','secondary','저장'),again=el('button','secondary',song.bpm?'다시 계산':'BPM 계산'),remove=el('button','song-remove','삭제');
      for(const b of [save,again,remove])b.type='button';
      save.onclick=()=>run(`${song.name} BPM 저장`,async()=>{const value=bpmInput.value===''?null:Number(bpmInput.value);if(value!==null&&!(value>=20&&value<=300))throw Error('BPM은 20~300 사이로 입력해 주세요.');return api({type:'musicLibraryUpdate',pin:pin(),...chosen(),id:song.id,bpm:value});});
      again.onclick=()=>run(`${song.name} BPM 계산`,async()=>{const data=await api({type:'musicLibraryAudioAdmin',pin:pin(),...chosen(),id:song.id});const bytes=Uint8Array.from(atob(data.data),c=>c.charCodeAt(0)),result=await detectBpmFromFile(bytes.buffer);return api({type:'musicLibraryUpdate',pin:pin(),...chosen(),id:song.id,bpm:result.bpm,durationSeconds:result.durationSeconds});});
      remove.onclick=()=>{if(!confirm(`'${song.name}'을(를) 목록에서 지울까요?\n드라이브 휴지통으로 옮겨져 30일 안에는 되살릴 수 있어요.`))return;run(`${song.name} 삭제`,()=>api({type:'musicLibraryUpdate',pin:pin(),...chosen(),id:song.id,remove:true}));};
      const actions=el('div','song-library-actions');actions.append(bpmBox,save,again,remove);
      item.append(info,actions);list.append(item);
    }
  }
  function setBusy(value){busy=value;upload.disabled=value;input.disabled=value;list.querySelectorAll('button,input').forEach(n=>n.disabled=value);}
  async function run(label,task){
    if(busy)return;const at=scope();setBusy(true);status.textContent=`${label} 중…`;
    try{const data=await task();if(at===scope()&&data?.songs){songs=data.songs;render();}status.textContent=`${label} 완료`;}
    catch(error){status.textContent=`${label} 실패: ${error.message}`;}
    finally{setBusy(false);}
  }
  async function load(force=false){
    const at=scope();if(!pin()||busy||(!force&&loadedFor===at))return;
    status.textContent='노래 목록 불러오는 중…';
    try{const data=await api({type:'musicLibraryAdmin',pin:pin(),...chosen()});if(at!==scope())return;songs=data.songs||[];loadedFor=at;if(data.folderUrl)$('songFolderLink').href=data.folderUrl;render();status.textContent='';}
    catch(error){if(at===scope())status.textContent='노래 목록을 불러오지 못했어요: '+error.message;}
  }
  upload.onclick=async()=>{
    const files=[...(input.files||[])];if(!files.length){status.textContent='올릴 노래 파일을 먼저 선택해 주세요.';return;}
    if(busy)return;const at=scope(),target=chosen();setBusy(true);let done=0;
    try{
      for(const [i,file] of files.entries()){
        const prefix=`${i+1}/${files.length} ${file.name}`,ext=file.name.split('.').pop().toLowerCase(),mime=AUDIO_TYPES[ext];
        if(!mime){status.textContent=`${prefix}: MP3·M4A·WAV만 올릴 수 있어요.`;continue;}
        if(file.size>MAX_BYTES){status.textContent=`${prefix}: 10MB 이하만 올릴 수 있어요.`;continue;}
        status.textContent=`${prefix} · BPM 계산 중…`;
        const bytes=new Uint8Array(await file.arrayBuffer());let result;
        try{result=await detectBpmFromFile(bytes.slice().buffer);}catch{result={bpm:null,durationSeconds:null};}
        if(!result.durationSeconds){status.textContent=`${prefix}: 이 컴퓨터에서 재생할 수 없는 파일이에요.`;continue;}
        status.textContent=`${prefix} · 올리는 중…${result.bpm?` (${result.bpm} BPM)`:''}`;
        const data=await api({type:'musicLibraryUpload',pin:pin(),...target,bpm:result.bpm,audio:{name:file.name,mime,bytes:bytes.length,durationSeconds:result.durationSeconds,offsetSeconds:0,checksum:await sha256(bytes),data:base64(bytes)}});
        done++;if(at===scope()&&data.songs){songs=data.songs;render();}
      }
      input.value='';status.textContent=`${done}곡 올림 · 학생 화면 노래 목록에 바로 나타나요.`;
    }catch(error){status.textContent='노래를 올리지 못했어요: '+error.message;}
    finally{setBusy(false);}
  };
  return {load};
}
