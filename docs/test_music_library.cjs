// 반별 수업용 노래(업로드·BPM·삭제), 나뉜 칸(2/4박), 배속 제출을 서버 코드로 확인합니다.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const props={},cache={},locks={script:false,user:false};
const property={getProperty:k=>props[k]||null,getProperties:()=>({...props}),setProperty:(k,v)=>{props[k]=v;return property;},deleteProperty:k=>{delete props[k];return property;}};
class Sheet{constructor(rows){this.rows=rows;this.max=1000;}getLastRow(){return this.rows.length;}getMaxRows(){return this.max;}insertRowsAfter(_,n){this.max+=n;}setFrozenRows(){}appendRow(row){this.rows.push([...row]);}getDataRange(){return {getValues:()=>this.rows.map(r=>r.slice())};}getRange(r,c,n=1,m=1){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>this.rows[r+i-1]?.[c+j-1]??'')),setValues:values=>{values.forEach((row,i)=>this.rows[r+i-1]=[...row]);},setValue:v=>{this.rows[r-1][c-1]=v;}};}}
const map=new Map(),ss={getSheetByName:n=>map.get(n),insertSheet:n=>{const s=new Sheet([]);map.set(n,s);return s;}};
const lock=key=>({tryLock(){if(locks[key])return false;locks[key]=true;return true;},waitLock(){if(locks[key])throw Error('Busy');locks[key]=true;},releaseLock(){locks[key]=false;}});
const files=new Map();let seq=0;
const mkFolder=id=>({getId:()=>id,getUrl:()=>'https://drive/'+id,createFolder:name=>mkFolder(id+'/'+name),getFiles(){const list=[...files.values()].filter(f=>f.parent===id);let i=0;return {hasNext:()=>i<list.length,next:()=>list[i++]};},createFile(blob){const fid='file-'+(++seq)+'-abcdefghij',f={parent:id,trashed:false,getId:()=>fid,getName:()=>blob.name,getBlob:()=>({getBytes:()=>blob.getBytes()}),getSize:()=>blob.getBytes().length,getMimeType:()=>blob.mime,getLastUpdated:()=>new Date(1760000000000),isTrashed(){return this.trashed},setTrashed(v){this.trashed=v},getParents(){let read=false;return {hasNext:()=>!read,next:()=>{read=true;return folders.get(id);}};},makeCopy(){return this}};files.set(fid,f);return f;}});
const folders=new Map();const root=mkFolder('root');folders.set('root',root);
const context=vm.createContext({PropertiesService:{getScriptProperties:()=>property},CacheService:{getScriptCache:()=>({getAll:keys=>Object.fromEntries(keys.filter(k=>cache[k]).map(k=>[k,cache[k]])),putAll:v=>Object.assign(cache,v),removeAll:keys=>keys.forEach(k=>delete cache[k])})},LockService:{getScriptLock:()=>lock('script'),getUserLock:()=>lock('user')},SpreadsheetApp:{getActiveSpreadsheet:()=>ss,flush(){}},
  DriveApp:{createFolder:name=>{const f=mkFolder(name);folders.set(name,f);return f;},getFolderById:id=>folders.get(id)||(()=>{const f=mkFolder(id);folders.set(id,f);return f;})(),getFileById:id=>{const f=files.get(id);if(!f)throw Error('no file');return f;}},
  Utilities:{getUuid:()=>crypto.randomUUID(),formatDate:d=>new Date(d).toLocaleDateString('en-CA',{timeZone:'Asia/Seoul'}),newBlob:(bytes,mime,name)=>({getBytes:()=>bytes,mime,name}),base64Decode:v=>Array.from(Buffer.from(v,'base64')),base64Encode:v=>Buffer.from(v).toString('base64'),DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,b)=>Array.from(crypto.createHash('sha256').update(Buffer.from(b)).digest())}});
vm.runInContext(fs.readFileSync(__dirname+'/apps_script.gs','utf8'),context);
map.set('설정',new Sheet([['key','json']]));
const wav=Buffer.alloc(64);wav.write('RIFF',0);wav.write('WAVE',8);
const audio=name=>({name,mime:'audio/wav',bytes:wav.length,durationSeconds:180,offsetSeconds:0,checksum:crypto.createHash('sha256').update(wav).digest('hex'),data:wav.toString('base64')});
// 업로드: 반 지정 + BPM 저장, 다른 반에는 보이지 않음
let r=context.musicLibraryUpload_({audio:audio('신나는 노래.wav'),bpm:128},1,2);
assert.equal(r.songs.length,1);assert.equal(r.songs[0].bpm,128);assert.equal(r.songs[0].assigned,true);
assert.equal(context.musicLibrary_(1,2).songs.length,1);assert.equal(context.musicLibrary_(1,1).songs.length,0,'다른 반 노래는 숨김');
// 드라이브에 직접 넣은 노래(반 미지정)는 모든 반에 보이고, 선생님이 반·BPM을 지정할 수 있음
const loose=context.musicLibraryFolder_().createFile({getBytes:()=>Array.from(wav),mime:'audio/wav',name:'직접 올린 곡.wav'});
assert.equal(context.musicLibrary_(1,1).songs.length,1);assert.equal(context.musicLibrary_(1,1).songs[0].bpm,null);
r=context.musicLibraryUpdate_({id:loose.getId(),bpm:95.5,durationSeconds:200},1,3);assert.equal(r.songs.find(s=>s.id===loose.getId()).bpm,95.5);
assert.equal(context.musicLibrary_(1,1).songs.length,0,'반을 지정하면 그 반에만 보임');
assert.throws(()=>context.musicLibraryUpdate_({id:loose.getId(),bpm:100},1,1),/다른 반/);
assert.throws(()=>context.musicLibraryAudio_({id:loose.getId(),version:'1760000000000-64'},1,1,false),/우리 반/);
assert.equal(context.musicLibraryAudio_({id:loose.getId(),version:'1760000000000-64'},1,3,false).ok,true);
// 삭제는 휴지통으로
r=context.musicLibraryUpdate_({id:loose.getId(),remove:true},1,3);assert.equal(r.songs.length,0);assert.equal(files.get(loose.getId()).trashed,true);
// 나뉜 칸 + 배속 + 소수 BPM 제출
context.saveMusicSettings_({grade:1,classNo:2,settings:{activityOpen:true},requestId:'library-test-open-0001'});
const song=context.musicLibrary_(1,2).songs[0];
const body={grade:1,classNo:2,number:3,groupName:'점프스타',theme:'여행',submissionId:crypto.randomUUID(),bpm:64,playbackRate:0.5,beatsPerMove:8,
  choreography:{palette:[{symbol:'o',label:'발모아뛰기 1박'},{symbol:'sc',label:'사이드크로스'}],bars:[[0,[0,1],[1,0,1,0],1,0,0,0,0]]},
  librarySong:{id:song.id,version:song.version,durationSeconds:180,offsetSeconds:0}};
const saved=context.musicSubmit_(ss,body);assert.equal(saved.songSaved,true);
const row=map.get('음악줄넘기').rows.at(-1);assert.equal(row[23],0.5);assert.equal(row[10],64);
assert.deepEqual(JSON.parse(row[13]).bars[0][2],[1,0,1,0]);
assert.match(context.choreographyLabel_(JSON.parse(row[13])),/\[o·sc\]/);
assert.throws(()=>context.validChoreography_({palette:[{symbol:'o',label:'a'}],bars:[[[0,0,0]]]}),/2박·4박·8박/);
assert.throws(()=>context.musicSubmit_(ss,{...body,submissionId:crypto.randomUUID(),playbackRate:3}),/배속/);
assert.equal(context.validBpm_(31.25),31.25);
const teacherRow=context.classMusicSummary_([Array.from(context.MUSIC_HEAD),row],2)[0];assert.equal(teacherRow.playbackRate,0.5);
console.log('music library ok');
// 이름이 곧 기호인 동작은 시트에 한 번만 적힘
assert.equal(context.movesLabel_([{symbol:'십자뛰기',label:'십자뛰기'},{symbol:'o',label:'발모아뛰기 1박'}]),'십자뛰기 / o 발모아뛰기 1박');
assert.match(context.choreographyLabel_({palette:[{symbol:'십자뛰기',label:'십자뛰기'}],bars:[[0]]}),/^십자뛰기\n/);
console.log('sheet labels ok');
