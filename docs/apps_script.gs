/** 줄넘기 PWA 시트 백엔드. 스프레드시트에 연결된 Apps Script에 붙여넣으세요.
 * 첫 배포 전 프로젝트 설정 > 스크립트 속성에 TEACHER_PIN(6자리 이상)을 직접 설정합니다.
 * 공개 URL과 PIN을 학생에게 함께 배포하지 마세요. PIN은 교사 설정 변경에만 사용됩니다.
 */
var SETTINGS = '설정', RECORDS = '기록', MUSIC = '음악줄넘기';
var HEAD = ['id','createdAt','grade','classNo','number','count','durationSeconds','countdownSeconds','sensitivity','misses','bestStreak'];
var MUSIC_LESSONS='음악수업이력';
var LESSONS='수업이력', LESSON_HEAD=['id','createdAt','grade','classNo','reason','settings','moves'];
var MUSIC_HEAD=['createdAt','grade','classNo','number','groupName','theme','moves','lessonId','settingsSnapshot','movesSnapshot','bpm','beatsPerBar','sequence','choreography'];
HEAD=HEAD.concat(['lessonId','settingsSnapshot','movesSnapshot','sessionId']);
MUSIC_HEAD=MUSIC_HEAD.concat(['submissionId','audioFileId','audioName','audioMime','audioBytes','audioDuration','audioOffset','beatsPerMove','submissionSignature']);
var MUSIC_LESSON_HEAD=LESSON_HEAD.slice();LESSON_HEAD=LESSON_HEAD.concat(['sessionId']);
var DEFAULTS = {durationSeconds:30,countdownSeconds:3,sensitivity:'보통',retryAllowed:true,retryLimit:2,recordMode:'best',rankingVisible:true,activityOpen:true};
var DEFAULT_MEDALS = [
  {id:'first-step',name:'첫 발걸음',type:'count',goal:10,image:'first-step'},
  {id:'silver-rhythm',name:'은빛 리듬',type:'count',goal:30,image:'silver-rhythm'},
  {id:'sky-jump',name:'하늘 점프',type:'count',goal:60,image:'sky-jump'},
  {id:'steady-star',name:'꾸준한 별',type:'attempts',goal:3,image:'steady-star'}
];
var MEDAL_IMAGES=['first-step','silver-rhythm','sky-jump','steady-star','fire-jump','moon-jump','rainbow-jump','crown-jump'];
var DEFAULT_MOVES=[{symbol:'○',label:'모아뛰기'},{symbol:'↔',label:'번갈아뛰기'},{symbol:'✕',label:'엇걸기'},{symbol:'◇',label:'옆뛰기'}];
function doGet() { return out_({ok:true,message:'줄넘기 앱 연결됨'}); }
function doPost(e) {
  try {
    var d = JSON.parse((e.postData || {}).contents || '{}');
    if (d.type === 'ping') return out_({ok:true});
    // Hot settings reads use properties only; no spreadsheet or record lock.
    if(d.type==='studentSettings')return out_(studentSettingsMemo_(d));
    if(d.type==='record')return out_(stageRecord_(d));
    if(d.type==='studentLive')return out_(liveData_(null,d,false));
    if(d.type==='teacherLive'){if(!authorized_(d.pin))return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});return out_(liveData_(null,d,true));}
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (d.type === 'bootstrap') return out_(bootstrap_(ss, d));
    if (d.type === 'teacherData') {
      if (!authorized_(d.pin)) return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});
      return out_(teacherData_(ss,d));
    }
    if (d.type === 'musicSubmit') return out_(musicSubmit_(ss,d));
    if(d.type==='musicAudio')return out_(musicAudio_(ss,d));
    if(d.type==='saveMoves'||d.type==='saveMusicSettings'){if(!authorized_(d.pin))return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});return out_(d.type==='saveMoves'?saveMusicMoves_(d):saveMusicSettings_(d));}
    if (d.type === 'saveMedals') {
      if (!authorized_(d.pin)) return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});
      var medals=validMedals_(d.medals),lockMedals=LockService.getScriptLock();lockMedals.waitLock(20000);
      try { var medalSheet=sheet_(ss,SETTINGS,['key','json']),medalRows=medalSheet.getDataRange().getValues();
        var medalRow=medalRows.findIndex(function(x,i){return i>0&&x[0]==='__medals__';});
        if(medalRow<0) medalSheet.appendRow(['__medals__',JSON.stringify(medals)]); else medalSheet.getRange(medalRow+1,2).setValue(JSON.stringify(medals));
      } finally { lockMedals.releaseLock(); }
      return out_({ok:true,medals:medals});
    }
    if(d.type==='saveSettings'){if(!authorized_(d.pin))return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});return out_(saveClassSettings_(ss,d));}
    if(d.type==='teacherSettings'||d.type==='refreshClassSheets'){if(!authorized_(d.pin))return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});return out_(d.type==='teacherSettings'?readClassSettings_(ss,d):refreshClassSheets_(ss));}
    if(d.type==='studentSettings')return out_(readClassSettings_(ss,d));
    if(d.type==='flushRecords')return out_(flushRecords_(ss));
    return out_({ok:false,error:'알 수 없는 요청'});
  } catch(err) { return out_({ok:false,error:String(err.message || err)}); }
}
function authorized_(pin) { var stored=PropertiesService.getScriptProperties().getProperty('TEACHER_PIN'); return !!stored && stored.length>=6 && String(pin || '')===stored; }
function integer_(v,min,max) { var n=Number(v); if (!Number.isInteger(n)||n<min||n>max) throw Error('학년·반·번호 또는 설정 값이 올바르지 않습니다.'); return n; }
function classKey_(g,c) { return integer_(g,1,6)+'-'+integer_(c,1,30); }
function validSettings_(s) {
  s=s||{}; var x={};
  x.durationSeconds=integer_(s.durationSeconds,5,600); x.countdownSeconds=integer_(s.countdownSeconds,0,15);
  x.sensitivity=['낮음','보통','높음'].indexOf(s.sensitivity)>=0?s.sensitivity:'보통';
  x.retryAllowed=s.retryAllowed===true; x.retryLimit=integer_(s.retryLimit,0,20);
  x.recordMode=s.recordMode==='latest'?'latest':'best'; x.rankingVisible=s.rankingVisible===true; x.activityOpen=s.activityOpen===true;
  return x;
}
function sheet_(ss,name,head) { var sh=ss.getSheetByName(name); if(!sh) sh=ss.insertSheet(name); if(sh.getLastRow()===0){sh.appendRow(head);sh.setFrozenRows(1);} else {var old=sh.getRange(1,1,1,head.length).getValues()[0];for(var i=0;i<head.length;i++){if(old[i]&&old[i]!==head[i])throw Error(name+' 열 구성이 다릅니다.');} if(old.join('|')!==head.join('|'))sh.getRange(1,1,1,head.length).setValues([head]);} return sh; }
function validMove_(value) {
  if(typeof value==='string') { var old=DEFAULT_MOVES.find(function(m){return m.label===value;}); if(!old) throw Error('동작을 확인해 주세요.'); return old; }
  var symbol=String(value&&value.symbol||'').trim(),label=String(value&&value.label||'').trim();
  if(!symbol||symbol.length>8||!label||label.length>20||/[\x00-\x1f\x7f]/.test(symbol+label)) throw Error('동작 기호(8자 이하)와 이름(20자 이하)을 확인해 주세요.');
  return {symbol:symbol,label:label};
}
function validMoveOptions_(items) {
  if(!Array.isArray(items)||items.length>16) throw Error('기본 동작은 최대 16개까지 설정할 수 있어요.');
  var seen={};return items.map(function(item){var move=validMove_(item),key=move.symbol+'\u0000'+move.label;if(seen[key])throw Error('같은 동작이 중복되었어요.');seen[key]=true;return move;});
}
function moves_(ss,key) {var raw=PropertiesService.getScriptProperties().getProperty('JUMPY_MUSIC_MOVES_'+String(key).replace('-','_'));if(raw)return validMoveOptions_(JSON.parse(raw).moves);var sh=sheet_(ss,SETTINGS,['key','json']),rows=sh.getDataRange().getValues();
  for(var i=1;i<rows.length;i++) if(rows[i][0]==='__moves__'+key){try{return validMoveOptions_(JSON.parse(rows[i][1]));}catch(e){break;}}
  return DEFAULT_MOVES;
}
function validMedals_(items) {
  if(!Array.isArray(items)||items.length<1||items.length>8) throw Error('메달은 1~8개로 설정해 주세요.');
  var used={}; return items.map(function(item,i){
    var name=String(item.name||'').trim(),type=String(item.type||''),image=String(item.image||'');
    if(!name||name.length>20||/^[=+\-@\t\r]/.test(name)) throw Error('메달 이름을 확인해 주세요.');
    if(type!=='count'&&type!=='attempts') throw Error('메달 달성 기준을 확인해 주세요.');
    var goal=integer_(item.goal,1,type==='count'?5000:100);
    if(MEDAL_IMAGES.indexOf(image)<0||used[image]) throw Error('메달 이미지는 서로 다르게 선택해 주세요.');
    used[image]=true;
    return {id:image,name:name,type:type,goal:goal,image:image};
  });
}
function medals_(ss) { var sh=sheet_(ss,SETTINGS,['key','json']),rows=sh.getDataRange().getValues();
  for(var i=1;i<rows.length;i++) if(rows[i][0]==='__medals__'){try{return validMedals_(JSON.parse(rows[i][1]));}catch(e){break;}}
  return DEFAULT_MEDALS;
}
function settings_(ss,key) { var parts=String(key).split('-'),saved=classSettingsState_(parts[0],parts[1]);if(saved)return saved.settings;var sh=sheet_(ss,SETTINGS,['key','json']); var rows=sh.getDataRange().getValues();
  for(var i=1;i<rows.length;i++) if(rows[i][0]===key) { try{return validSettings_(JSON.parse(rows[i][1]));}catch(e){break;} }
  return DEFAULTS;
}
function allRecords_(ss,g,c) { var sh=sheet_(ss,RECORDS,HEAD); var rows=sh.getDataRange().getValues(), out=[];
  for(var i=1;i<rows.length;i++) if(Number(rows[i][2])===g && Number(rows[i][3])===c) out.push({id:String(rows[i][0]),createdAt:String(rows[i][1]),grade:g,classNo:c,number:Number(rows[i][4]),count:Number(rows[i][5]),durationSeconds:Number(rows[i][6]),countdownSeconds:Number(rows[i][7]),sensitivity:String(rows[i][8]),misses:Number(rows[i][9]),bestStreak:Number(rows[i][10]),lessonId:String(rows[i][11]||''),sessionId:String(rows[i][14]||rows[i][11]||''),settingsSnapshot:jsonSnapshot_(rows[i][12]),activityType:'rope'});
  return out;
}
function views_(records,settings,number,lessonId) {
  var mine=records.filter(function(r){return r.number===number;});
  // A measuring round stays visible for 24 hours; only a new class resets it early.
  var same=records.filter(function(r){return (r.sessionId||r.lessonId)===lessonId;});
  var by={}; same.forEach(function(r){var old=by[r.number]; if(!old || (settings.recordMode==='latest' ? r.createdAt>old.createdAt : r.count>old.count)) by[r.number]=r;});
  var ranking=Object.keys(by).map(function(k){return {number:Number(k),count:by[k].count};}).sort(function(a,b){return b.count-a.count || a.number-b.number;});
  // 순위 공개 시 번호와 반영 기록만 제공하며 원본 도전 이력은 제공하지 않는다.
  var pos=ranking.findIndex(function(r){return r.number===number;});
  return {records:mine,ranking:settings.rankingVisible ? {
    rank:pos>=0?1+ranking.filter(function(r){return r.count>ranking[pos].count;}).length:null,
    total:ranking.length,
    leaders:ranking.slice(0,10).map(function(r){return {number:r.number,count:r.count,rank:1+ranking.filter(function(x){return x.count>r.count;}).length};})
  }:null};
}
function bootstrap_(ss,d){var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),n=validStudentNumber_(g,c,d.number),lesson=currentFastLesson_(ss,g,c),s=lesson.settings;ensureRecordBase_(ss,g,c,lesson.sessionId||lesson.id);var all=allRecords_(ss,g,c),pending=pendingRecords_(PropertiesService.getScriptProperties().getProperties()).map(function(item){return recordFromRow_(item.row);}).filter(function(r){return r.grade===g&&r.classNo===c;}),by={};all.concat(pending).forEach(function(r){by[r.id]=r;});return Object.assign({ok:true,settings:s,settingsVersion:lesson.settingsVersion||'',lessonId:lesson.id,sessionId:lesson.sessionId||lesson.id,medals:medals_(ss),moveOptions:moves_(ss,classKey_(g,c)),...musicStateView_(g,c)},views_(Object.keys(by).map(function(id){return by[id];}),s,n,lesson.sessionId||lesson.id));}
function safeText_(value,max) {
  var s=String(value||'').trim(); if(!s||s.length>max) throw Error('음악 줄넘기 입력을 확인해 주세요.');
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s;
}
function musicSubmit_(ss,d) {
  var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),n=validStudentNumber_(g,c,d.number);
  var group=safeText_(d.groupName,20),theme=safeText_(d.theme,40);
  var choreography=d.choreography===undefined?null:validChoreography_(d.choreography);
  var sequence=choreography||d.sequence===undefined?null:validSequence_(d.sequence);
  var bars=sequence||choreography?[]:(Array.isArray(d.moves)&&typeof d.moves[0]==='string'?[d.moves]:d.moves);
  var beats=sequence||choreography?8:d.beatsPerBar===undefined?4:integer_(d.beatsPerBar,4,8);if(beats!==4&&beats!==8)throw Error('4박자 또는 8박자 줄을 확인해 주세요.');
  var bpm=d.bpm===undefined?'':integer_(d.bpm,20,300);
  if(beats===8&&bpm==='')throw Error('음악 빠르기 BPM을 입력해 주세요.');
  if(!sequence&&!choreography&&(!Array.isArray(bars)||bars.length<1||bars.length>16||bars.some(function(row){return !Array.isArray(row)||row.length!==beats;}))) throw Error(beats+'박자 동작 줄을 확인해 주세요.');
  bars=bars.map(function(row){return row.map(validMove_);});
  var beatsPerMove=d.beatsPerMove===undefined?1:integer_(d.beatsPerMove,1,8);if(beatsPerMove!==1&&beatsPerMove!==8)throw Error('동작 박자 수를 확인해 주세요.');if(choreography&&choreography.bars.reduce(function(sum,row){return sum+row.length;},0)*beatsPerMove>4096)throw Error('한 곡은 최대 4096박자까지 만들 수 있어요.');
  var submissionId=d.submissionId===undefined?Utilities.getUuid():String(d.submissionId);if(!/^[a-zA-Z0-9-]{12,80}$/.test(submissionId))throw Error('음악 제출 ID를 확인해 주세요.');
  if(d.audio&&!classRoster_(g,c))throw Error('이 반은 노래 제출 대상에 등록되어 있지 않아요.');
  var audio=d.audio?validAudio_(d.audio):null,signature=JSON.stringify({g:g,c:c,n:n,group:group,theme:theme,bpm:bpm,bars:bars,sequence:sequence,choreography:choreography,beatsPerMove:beatsPerMove,audio:audio?{checksum:d.audio.checksum,name:audio.name,mime:audio.mime,bytes:audio.bytes.length,duration:audio.duration,offset:audio.offset}:null});
  var lock=LockService.getUserLock();lock.waitLock(20000);
  try{var sh=sheet_(ss,MUSIC,MUSIC_HEAD),rows=sh.getDataRange().getValues(),old=rows.find(function(row,i){return i>0&&String(row[14])===submissionId;});if(old){if(old[22]!==signature)throw Error('다른 음악 제출에 같은 ID를 사용할 수 없습니다.');return {ok:true,duplicate:true,submissionId:submissionId,songSaved:!!old[15]};}
    if(!musicStateView_(g,c).musicSettings.activityOpen)throw Error('이 반의 음악 활동이 닫혔습니다.');
    var today=Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd'),daily=rows.slice(1).filter(function(row){return Number(row[1])===g&&Number(row[2])===c&&Utilities.formatDate(new Date(row[0]),'Asia/Seoul','yyyy-MM-dd')===today;});if(daily.length>=60||audio&&daily.reduce(function(sum,row){return sum+Number(row[18]||0);},0)+audio.bytes.length>150*1024*1024)throw Error('이 반의 오늘 음악 제출 용량을 확인해야 해요. 노래와 안무는 이 기기에 보관합니다.');
    var lesson=ensureMusicLesson_(ss,g,c,'음악 제출'),songFile=audio?musicFolder_().createFile(Utilities.newBlob(audio.bytes,audio.mime,g+'학년 '+c+'반 '+group+' '+submissionId+' '+audio.name)):null;
    // Preserve the private file if a write response is lost; retry resolves the submission ID.
    sh.appendRow([new Date().toISOString(),g,c,n,group,theme,JSON.stringify(bars),lesson.id,JSON.stringify(lesson.settings),JSON.stringify(lesson.moves),bpm,beats,sequence?JSON.stringify(sequence):'',choreography?JSON.stringify(choreography):'',submissionId,songFile?songFile.getId():'',audio?classSheetText_(audio.name):'',audio?audio.mime:'',audio?audio.bytes.length:'',audio?audio.duration:'',audio?audio.offset:'',beatsPerMove,signature]);
    return {ok:true,submissionId:submissionId,songSaved:!!songFile};
  }finally{lock.releaseLock();}
}

function teacherData_(ss,d) {
  var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),live=liveData_(ss,d,true),s=live.settings,lessonId=live.lessonId,sessionId=live.sessionId,byId={};
  allRecords_(ss,g,c).concat(live.records).forEach(function(r){byId[r.id]=r;});var all=Object.keys(byId).map(function(id){return byId[id];}),ranking=live.ranking;
  var sh=sheet_(ss,MUSIC,MUSIC_HEAD),rows=sh.getDataRange().getValues(),latest=Object.create(null);
  for(var i=1;i<rows.length;i++) if(Number(rows[i][1])===g&&Number(rows[i][2])===c){
    var key=String(rows[i][7]||'기존')+'|'+String(rows[i][4]),moves=[];try{moves=JSON.parse(rows[i][6]);if(moves.length&&typeof moves[0]==='string')moves=[moves];moves=moves.map(function(bar){return bar.map(validMove_);});}catch(e){}
    latest[key]={groupName:String(rows[i][4]),theme:String(rows[i][5]),number:Number(rows[i][3]),moves:moves,createdAt:String(rows[i][0]),settingsSnapshot:jsonSnapshot_(rows[i][8])?.activityType==='music'?jsonSnapshot_(rows[i][8]):null,movesSnapshot:jsonSnapshot_(rows[i][9]),bpm:rows[i][10]?Number(rows[i][10]):null,beatsPerBar:Number(rows[i][11])||(moves[0]||[]).length||4,sequence:jsonSnapshot_(rows[i][12]),choreography:jsonSnapshot_(rows[i][13]),beatsPerMove:Number(rows[i][21])||1,submissionId:String(rows[i][14]||''),audio:rows[i][15]?{name:String(rows[i][16]),mime:String(rows[i][17]),bytes:Number(rows[i][18]),durationSeconds:Number(rows[i][19]),offsetSeconds:Number(rows[i][20]||0)}:null};
  }
  var result={ok:true,lessonId:lessonId,sessionId:sessionId,settings:s,...musicStateView_(g,c),medals:medals_(ss),moveOptions:moves_(ss,classKey_(g,c)),participants:ranking.map(function(r){return r.number;}),ranking:ranking,records:all.map(function(r){return {id:r.id,createdAt:r.createdAt,number:r.number,count:r.count,durationSeconds:r.durationSeconds,countdownSeconds:r.countdownSeconds,sensitivity:r.sensitivity,lessonId:r.lessonId,sessionId:r.sessionId||r.lessonId,settingsSnapshot:r.settingsSnapshot,activityType:'rope'};}),music:Object.keys(latest).map(function(k){return latest[k];}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);})};
  return result;
}
/** Apps Script 편집기에서 한 번 실행하면 기존 기록도 세 반 요약 탭에 반영됩니다. */
function setupJumpyClassSheets() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(),lock=LockService.getScriptLock();
  if(!ss)throw Error('앱에 연결된 스프레드시트의 Apps Script에서 실행해 주세요.');
  lock.waitLock(20000);
  try{[1,2,3].forEach(function(c){restoreRecentRopeRound_(ss,1,c);ensureLesson_(ss,1,c,'현재 설정 등록');});}
  finally{lock.releaseLock();}
  [1,2,3].forEach(function(c){var lesson=currentFastLesson_(ss,1,c);ensureRecordBase_(ss,1,c,lesson.sessionId||lesson.id);});
  return refreshClassSheets_(ss);
}
// 호출자가 보유한 저장/조회 잠금 안에서 실행합니다. 요약 실패로 원본 저장을 실패 처리하지 않습니다.
function updateClassSheetsSafe_(ss,result) {
  try{updateClassSheets_(ss);}catch(error){result.sheetViewWarning='반별 시트 갱신 실패: '+String(error.message||error);}
  return result;
}
function updateClassSheets_(ss) {
  var marker='JUMPY_CLASS_SUMMARY',version='v1',head=['측정 일시','번호','기록(회)','측정시간(초)','준비시간(초)','당시 민감도','줄넘기 설정',''];
  var plans=[1,2,3].map(function(c){var name='1학년 '+c+'반 줄넘기 기록';return {classNo:c,name:name,sheet:ss.getSheetByName(name)||ss.getSheetByName('1학년 '+c+'반'),musicName:'1학년 '+c+'반 음악줄넘기 제출'};});
  // 기존 동명 탭에 교사가 넣은 자료가 있으면 보존하며 오류를 알립니다.
  plans.forEach(function(plan){if(plan.sheet&&plan.sheet.getLastRow()>0&&!plan.sheet.getDeveloperMetadata().some(function(m){return m.getKey()===marker&&m.getValue()===version;}))throw Error(plan.name+' 탭에 기존 자료가 있습니다. 다른 이름으로 옮긴 뒤 setupJumpyClassSheets를 실행해 주세요.');});
  plans.forEach(function(plan){var sh=ss.getSheetByName(plan.musicName);if(sh&&sh.getLastRow()>0&&!sh.getDeveloperMetadata().some(function(m){return m.getKey()==='JUMPY_MUSIC_CLASS_SUMMARY'&&m.getValue()==='v1';}))throw Error(plan.musicName+' 탭에 기존 자료가 있습니다. 원본을 보존합니다.');});
  var raw=sheet_(ss,RECORDS,HEAD),source=raw.getDataRange().getValues();
  if(source[0].slice(0,HEAD.length).join('|')!==HEAD.join('|'))throw Error('기록 탭의 열 구성을 확인해 주세요.');
  var properties=PropertiesService.getScriptProperties(),saved=properties.getProperties();
  plans.forEach(function(plan){
    var s=settings_(ss,classKey_(1,plan.classNo));
    var records=source.slice(1).filter(function(row){return Number(row[2])===1&&Number(row[3])===plan.classNo;}).map(function(row){return {number:Number(row[4]),count:Number(row[5]),durationSeconds:Number(row[6]),countdownSeconds:Number(row[7]),sensitivity:String(row[8]),misses:Number(row[9]),bestStreak:Number(row[10]),settingsSnapshot:jsonSnapshot_(row[12]),movesSnapshot:jsonSnapshot_(row[13]),createdAt:row[1] instanceof Date?row[1].toISOString():String(row[1])};});
    var history=classHistory_(records),key='jumpy_class_summary_'+ss.getId()+'_'+plan.classNo;
    var lessons=sheet_(ss,LESSONS,LESSON_HEAD).getDataRange().getValues().slice(1).filter(function(r){return Number(r[2])===1&&Number(r[3])===plan.classNo;}).reverse();
    var payload=JSON.stringify({version:'v15-rope-only',settings:s,roster:classRoster_(1,plan.classNo),history:history,lessons:lessons});
    var digest=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,payload));
    var sh=plan.sheet,fresh=!sh||sh.getLastRow()===0;
    if(sh&&sh.getName()!==plan.name)sh.setName(plan.name);
    if(!fresh&&saved[key]===digest&&sh.getRange('A1').getValue()===plan.name)return;
    if(!sh)sh=ss.insertSheet(plan.name);else if(sh.getName()!==plan.name)sh.setName(plan.name);
    var requiredRows=history.length+lessons.length+30;
    if(sh.getMaxRows()<requiredRows)sh.insertRowsAfter(sh.getMaxRows(),requiredRows-sh.getMaxRows());
    if(fresh){
      sh.getRange('A1:H1').merge();sh.getRange('A2:H2').merge();
      sh.setFrozenRows(5);sh.setTabColor('#3988f7');
      sh.getRange('A1:H1').setFontSize(18).setFontWeight('bold').setFontColor('#2469d4');
      sh.getRange('A2:H2').setFontColor('#717987');
      sh.getRange('A3:H3').setBackground('#eaf3ff');
      sh.getRange('A5:H5').setBackground('#3988f7').setFontColor('#ffffff').setFontWeight('bold');
    }
    sh.setColumnWidths(1,8,125);sh.setColumnWidth(1,220);sh.setColumnWidth(2,65);sh.setColumnWidth(6,220);sh.setColumnWidth(7,300);sh.setColumnWidth(8,300);
    sh.getRange('A1').setValue(plan.name);
    sh.getRange('A2').setValue('현재 설정: '+s.durationSeconds+'초 · 준비 '+s.countdownSeconds+'초 · 민감도 '+s.sensitivity+' · '+(s.recordMode==='latest'?'마지막 기록':'최고기록')+' 반영 / 전체 기록 최신순');
    sh.getRange('A3:H3').setValues([['재적 학생',classRoster_(1,plan.classNo).total,'기록 학생(누적)',new Set(records.map(function(record){return record.number;})).size,'측정 기록',history.length,'활동 상태',s.activityOpen?'열림':'닫힘']]);
    sh.getRange('A5:H5').setValues([head]);
    var oldRows=Math.max(0,sh.getLastRow()-5);
    if(oldRows){sh.getRange(6,1,oldRows,8).clearContent();sh.getRange(6,1,oldRows,8).setBackground('#ffffff').setFontColor('#20252d').setFontWeight('normal').setNumberFormat('General').setWrap(false);}
    if(history.length){
      sh.getRange(6,1,history.length,8).setValues(history);
      sh.getRange(6,1,history.length,1).setNumberFormat('yyyy"년" m"월" d"일" hh"시" mm"분"');
      sh.getRange(6,2,history.length,4).setNumberFormat('0');sh.getRange(6,7,history.length,2).setWrap(true);
    }else sh.getRange('A6').setValue('아직 기록이 없습니다.');
    var settingsRow=8+Math.max(1,history.length);
    classSectionHeading_(sh,settingsRow,'줄넘기 수업 설정 이력 · 최신순');
    sh.getRange(settingsRow+1,1,1,8).setValues([['수업 시작 / 변경 일시','구분','줄넘기 설정','','','','','']]);
    if(lessons.length){sh.getRange(settingsRow+2,1,lessons.length,8).setValues(lessons.map(function(r){return [new Date(r[1]),r[4],classSheetText_(settingsLabel_(jsonSnapshot_(r[5]))),'','','','',''];}));sh.getRange(settingsRow+2,1,lessons.length,1).setNumberFormat('yyyy"년" m"월" d"일" hh"시" mm"분"');sh.getRange(settingsRow+2,3,lessons.length,2).setWrap(true);}
    if(fresh)sh.addDeveloperMetadata(marker,version);
    properties.setProperty(key,digest);
  });
  updateClassMusicSheets_(ss,plans);
}
function updateClassMusicSheets_(ss,plans){
 var source=sheet_(ss,MUSIC,MUSIC_HEAD).getDataRange().getValues(),props=PropertiesService.getScriptProperties(),saved=props.getProperties();
 plans.forEach(function(plan){
  var music=classMusicSummary_(source,plan.classNo),moves=moves_(ss,classKey_(1,plan.classNo)),settings=musicStateView_(1,plan.classNo).musicSettings;
  var rows=music.map(function(item){return [classSheetText_(item.groupName),classSheetText_(item.theme),item.number,item.createdAt,musicSettingsLabel_(item.settingsSnapshot)+(item.audioName?' · 노래: '+item.audioName:''),classSheetText_((item.choreography?choreographyLabel_(item.choreography):item.sequence?item.sequence.map(function(s,index){return (index+1)+'구간: '+s.move.symbol+' '+s.move.label+' × '+s.beats+'박';}).join('\n'):item.moves.map(function(bar,index){return (index+1)+'줄: '+bar.map(function(move){return move.symbol+' '+move.label;}).join(' / ');}).join('\n'))),classSheetText_(movesLabel_(item.movesSnapshot)),(item.bpm?item.bpm+' BPM':'당시 BPM 미저장')+' · '+(item.choreography?item.choreography.bars.reduce(function(sum,row){return sum+row.length;},0)*(item.beatsPerMove||1)+'박 · '+(item.beatsPerMove===8?'동작당 8박':'박자별 안무'):item.sequence?item.sequence.reduce(function(sum,s){return sum+s.beats;},0)+'박 · 동작별 반복':item.beatsPerBar+'박자/줄')];});
  var payload=JSON.stringify({version:'music-only-v1',settings:settings,moves:moves,rows:rows}),key='jumpy_music_summary_'+ss.getId()+'_'+plan.classNo,digest=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,payload)),sh=ss.getSheetByName(plan.musicName),fresh=!sh||sh.getLastRow()===0;
  if(!fresh&&saved[key]===digest&&sh.getRange('A1').getValue()===plan.musicName)return;
  if(!sh)sh=ss.insertSheet(plan.musicName);var needed=Math.max(7,rows.length+6);if(sh.getMaxRows()<needed)sh.insertRowsAfter(sh.getMaxRows(),needed-sh.getMaxRows());
  if(fresh){sh.getRange('A1:H1').merge();sh.getRange('A2:H2').merge();sh.setFrozenRows(5);sh.setTabColor('#8b6fdf');sh.getRange('A1:H1').setFontSize(18).setFontWeight('bold').setFontColor('#2469d4');sh.getRange('A2:H2').setFontColor('#717987');sh.getRange('A3:H3').setBackground('#eaf3ff');sh.addDeveloperMetadata('JUMPY_MUSIC_CLASS_SUMMARY','v1');}
  sh.setColumnWidths(1,8,140);sh.setColumnWidth(2,230);sh.setColumnWidth(3,90);sh.setColumnWidth(4,210);sh.setColumnWidth(6,400);sh.setColumnWidth(7,260);sh.setColumnWidth(8,230);
  sh.getRange('A1').setValue(plan.musicName);sh.getRange('A2').setValue('모둠 활동 · 음악줄넘기를 한 날의 제출만 최신순으로 누적합니다.');
  sh.getRange('A3:H3').setValues([['제출 모둠',new Set(music.map(function(item){return item.groupName;})).size,'제출 이력',rows.length,'음악 활동',settings.activityOpen?'열림':'닫힘','기본동작',classSheetText_(movesLabel_(moves))]]);sh.getRange('H3').setWrap(true);
  sh.getRange('A5:H5').setValues([['조 이름','주제','제출 번호','제출 일시','음악 활동 설정','안무','당시 기본동작','음악 빠르기 · 박자']]);sh.getRange('A5:H5').setBackground('#3988f7').setFontColor('#ffffff').setFontWeight('bold');
  var oldRows=Math.max(0,sh.getLastRow()-5);if(oldRows)sh.getRange(6,1,oldRows,8).clearContent();
  if(rows.length){sh.getRange(6,1,rows.length,8).setValues(rows);sh.getRange(6,4,rows.length,1).setNumberFormat('yyyy"년" m"월" d"일" hh"시" mm"분"');sh.getRange(6,5,rows.length,4).setWrap(true);}else sh.getRange('A6').setValue('아직 제출한 조가 없습니다.');
  props.setProperty(key,digest);
 });
}
function classHistory_(records){return records.slice().sort(function(a,b){return b.createdAt.localeCompare(a.createdAt)||a.number-b.number;}).map(function(record){var date=new Date(record.createdAt);return [isNaN(date.getTime())?'':date,record.number,record.count,record.durationSeconds,record.countdownSeconds,record.sensitivity,classSheetText_(settingsLabel_(record.settingsSnapshot)),''];});}
function classSectionHeading_(sh,row,title){sh.getRange(row,1,1,8).setBackground('#eaf3ff').setFontColor('#2469d4').setFontWeight('bold');sh.getRange(row,1).setValue(title);}
function classSheetText_(value){var text=String(value||'');return /^[=+\-@\t\r]/.test(text)?"'"+text:text;}
function classMusicSummary_(source,classNo){
  var items=[];
  source.slice(1).forEach(function(row){
    if(Number(row[1])!==1||Number(row[2])!==classNo)return;
    var key=String(row[4]),date=row[0] instanceof Date?row[0].toISOString():String(row[0]),bars=[];
    try{bars=JSON.parse(row[6]);if(bars.length&&typeof bars[0]==='string')bars=[bars];bars=bars.map(function(bar){return bar.map(validMove_);});}catch(error){bars=[];}
    items.push({groupName:key,theme:String(row[5]),number:Number(row[3]),createdAt:isNaN(new Date(date).getTime())?'':new Date(date),stamp:date,moves:bars,settingsSnapshot:jsonSnapshot_(row[8]),movesSnapshot:jsonSnapshot_(row[9]),bpm:row[10]?Number(row[10]):null,beatsPerBar:Number(row[11])||(bars[0]||[]).length||4,sequence:jsonSnapshot_(row[12]),choreography:jsonSnapshot_(row[13]),beatsPerMove:Number(row[21])||1,audioName:String(row[16]||'')});
  });
  return items.sort(function(a,b){return b.stamp.localeCompare(a.stamp);});
}
function out_(v) { return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }

function jsonSnapshot_(value){try{return value?JSON.parse(value):null;}catch(e){return null;}}
function settingsLabel_(s){return s?s.durationSeconds+'초 · 준비 '+s.countdownSeconds+'초 · 민감도 '+s.sensitivity+' · '+(s.recordMode==='latest'?'마지막':'최고')+' 기록 · 재도전 '+(s.retryAllowed?s.retryLimit+'회':'불가')+' · 순위 '+(s.rankingVisible?'공개':'비공개')+' · 활동 '+(s.activityOpen?'열림':'닫힘'):'당시 설정 미저장';}
function movesLabel_(moves){return moves?moves.map(function(m){return m.symbol+' '+m.label;}).join(' / ')||'등록 동작 없음':'당시 동작 미저장';}
// 날짜별 탭 대신 하나의 원본에 반별 수업 스냅샷을 누적합니다. 같은 날 같은 설정은 재사용합니다.
function ensureLesson_(ss,g,c,reason,force){
 var props=PropertiesService.getScriptProperties(),state=classSettingsState_(g,c),appliedKey='JUMPY_SETTINGS_APPLIED_'+g+'_'+c,sh=sheet_(ss,LESSONS,LESSON_HEAD),rows=sh.getDataRange().getValues(),key=classKey_(g,c),s=state?state.settings:settings_(ss,key),moves=[],now=new Date(),previous=null;
 if(state&&state.forceLesson&&props.getProperty(appliedKey)!==state.revision)force=true;
 for(var i=rows.length-1;i>0;i--)if(Number(rows[i][2])===g&&Number(rows[i][3])===c){previous=rows[i];break;}
 var live=jsonSnapshot_(props.getProperty('JUMPY_LIVE_LESSON_'+g+'_'+c)),sameRound=!force&&previous&&(live?roundAlive_(live,props.getProperties()):now.getTime()-Date.parse(previous[1])<86400000);
 var reuse=sameRound&&previous[5]===JSON.stringify(s),id=reuse?String(previous[0]):Utilities.getUuid(),sessionId=sameRound?String(previous[7]||previous[0]):id,expiresAt=sameRound&&live?roundExpiresAt_(live,props.getProperties()):now.getTime()+86400000;
 if(!reuse)sh.appendRow([id,now.toISOString(),g,c,force?'새 수업 시작':reason,JSON.stringify(s),'',sessionId]);
 if(state)props.setProperty(appliedKey,state.revision);
 props.setProperty('JUMPY_FAST_LESSON_'+id,JSON.stringify({id:id,createdAt:reuse?String(previous[1]):now.toISOString(),grade:g,classNo:c,sessionId:sessionId,settings:s,settingsVersion:state?state.revision:'',moves:moves}));
 props.setProperty('JUMPY_LIVE_LESSON_'+g+'_'+c,JSON.stringify({id:id,day:Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd'),revision:state?state.revision:'',settings:s,sessionId:sessionId,expiresAt:expiresAt}));
 invalidateLiveClass_(g,c);return {id:id,sessionId:sessionId,settings:s,settingsVersion:state?state.revision:'',moves:moves};
}
function currentLessonId_(ss,g,c){var data=readClassSettings_(ss,{grade:g,classNo:c});return data.lessonId||'';}
function roundExpiresAt_(live,values){var snapshot=jsonSnapshot_(values['JUMPY_FAST_LESSON_'+live.id]);return Number(live.expiresAt)||(snapshot?Date.parse(snapshot.createdAt)+86400000:0);}
function roundAlive_(live,values){return !!live&&roundExpiresAt_(live,values)>Date.now();}

function validSequence_(items){
 if(!Array.isArray(items)||items.length<1||items.length>256)throw Error('동작 구간은 1~256개로 구성해 주세요.');
 var total=0,out=items.map(function(s){var beats=integer_(s&&s.beats,1,512);total+=beats;return {move:validMove_(s&&s.move),beats:beats};});
 if(total>4096)throw Error('한 곡은 최대 4096박자까지 만들 수 있어요.');return out;
}

function validChoreography_(value){
 if(!value||!Array.isArray(value.palette)||!value.palette.length||value.palette.length>256||!Array.isArray(value.bars)||!value.bars.length||value.bars.length>512)throw Error('안무 줄과 동작 목록을 확인해 주세요.');
 var palette=value.palette.map(validMove_),total=0,bars=value.bars.map(function(row){if(!Array.isArray(row)||!row.length||row.length>8)throw Error('한 줄은 최대 8박자입니다.');total+=row.length;return row.map(function(i){return integer_(i,0,palette.length-1);});});
 if(total>4096)throw Error('한 곡은 최대 4096박자까지 만들 수 있어요.');return {palette:palette,bars:bars};
}
function choreographyLabel_(value){
 var legend=value.palette.map(function(m){return m.symbol+' '+m.label;}).join(' / '),lines=value.bars.map(function(row,i){return (i+1)+'줄: '+row.map(function(n){return value.palette[n].symbol;}).join(' ');}).join('\n');
 var text=legend+'\n'+lines;return text.length>47000?text.slice(0,47000)+'\n… 전체 안무는 음악줄넘기 원본과 선생님 화면에서 확인':text;
}

// Settings use one atomic property write, independent of student-record and report locks.
function classSettingsKey_(g,c){return 'JUMPY_SETTINGS_'+integer_(g,1,6)+'_'+integer_(c,1,30);}
function classSettingsState_(g,c){var raw=PropertiesService.getScriptProperties().getProperty(classSettingsKey_(g,c));if(!raw)return null;var state=JSON.parse(raw);state.settings=validSettings_(state.settings);return state;}
function saveClassSettings_(ss,d){
 var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),next=validSettings_(d.settings),props=PropertiesService.getScriptProperties(),key=classSettingsKey_(g,c),previous=classSettingsState_(g,c),requestId=String(d.requestId||'');
 if(requestId&&!/^[a-zA-Z0-9-]{12,80}$/.test(requestId))throw Error('설정 저장 요청을 확인해 주세요.');
 if(previous&&requestId&&previous.requestId===requestId){if(JSON.stringify(previous.settings)!==JSON.stringify(next)||previous.forceLesson!==(d.startLesson===true))throw Error('다른 설정에 같은 요청 ID를 사용할 수 없습니다.');}
 else props.setProperty(key,JSON.stringify({settings:next,revision:Utilities.getUuid(),requestId:requestId,updatedAt:new Date().toISOString(),forceLesson:d.startLesson===true}));
 invalidateLiveClass_(g,c);var saved=classSettingsState_(g,c);return {ok:true,saved:true,grade:g,classNo:c,settings:saved.settings,requestId:saved.requestId,settingsVersion:saved.revision};
}
function readClassSettings_(ss,d){
 var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),props=PropertiesService.getScriptProperties(),values=props.getProperties(),state=values[classSettingsKey_(g,c)]?JSON.parse(values[classSettingsKey_(g,c)]):null,raw=values['JUMPY_LIVE_LESSON_'+g+'_'+c],live=raw?JSON.parse(raw):null;
 var matching=roundAlive_(live,values)&&live.revision===(state?state.revision:'');
 // Legacy classes are initialized once by bootstrap/setup, never cached over a teacher save.
 if(!state&&!live){ss=ss||SpreadsheetApp.getActiveSpreadsheet();return {ok:true,settings:settings_(ss,classKey_(g,c)),settingsVersion:'',lessonId:'',requestId:'',...musicStateView_(g,c,values)};}
 return {ok:true,grade:g,classNo:c,settings:state?state.settings:live.settings,requestId:state?state.requestId:'',settingsVersion:state?state.revision:'',lessonId:matching?live.id:'',sessionId:matching?live.sessionId||live.id:'',...musicStateView_(g,c,values)};
}
// The existing settings sheet remains a readable mirror. Report work never holds up settings saves.
function mirrorClassSettings_(ss){
 var lock=LockService.getScriptLock();if(!lock.tryLock(0))return false;
 try{var props=PropertiesService.getScriptProperties(),values=props.getProperties(),sheet=sheet_(ss,SETTINGS,['key','json']),rows=sheet.getDataRange().getValues();Object.keys(values).forEach(function(key){var match=key.match(/^JUMPY_SETTINGS_(\d+)_(\d+)$/);if(!match)return;var state=JSON.parse(values[key]),marker='JUMPY_SETTINGS_MIRRORED_'+match[1]+'_'+match[2];if(values[marker]===state.revision)return;var classKey=classKey_(match[1],match[2]),json=JSON.stringify(validSettings_(state.settings)),index=rows.findIndex(function(row,i){return i>0&&row[0]===classKey;});if(index<0){sheet.appendRow([classKey,json]);rows.push([classKey,json]);}else sheet.getRange(index+1,2).setValue(json);ensureLesson_(ss,Number(match[1]),Number(match[2]),'설정 변경');props.setProperty(marker,state.revision);});return true;
 }finally{lock.releaseLock();}
}
function refreshClassSheets_(ss){pruneFastRecordMetadata_();var lock=LockService.getUserLock();if(!lock.tryLock(0))return {ok:true,busy:true};try{var mirrored=mirrorClassSettings_(ss);mirrorMusicSettings_(ss);return updateClassSheetsSafe_(ss,{ok:true,settingsMirrored:mirrored});}finally{lock.releaseLock();}}

// Records are acknowledged only after durable staging. Cache is never the only copy.
function byteLength_(s){return unescape(encodeURIComponent(String(s))).length;}
function pendingRecords_(values){return Object.keys(values).filter(function(k){return k.indexOf('JUMPY_PENDING_RECORD_')===0;}).map(function(k){return {key:k,row:JSON.parse(values[k])};});}
function recordFromRow_(r){return {id:String(r[0]),createdAt:r[1] instanceof Date?r[1].toISOString():String(r[1]),grade:Number(r[2]),classNo:Number(r[3]),number:Number(r[4]),count:Number(r[5]),durationSeconds:Number(r[6]),countdownSeconds:Number(r[7]),sensitivity:String(r[8]),misses:Number(r[9]),bestStreak:Number(r[10]),lessonId:String(r[11]||''),sessionId:String(r[14]||r[11]||''),settingsSnapshot:jsonSnapshot_(r[12]),activityType:'rope'};}
function cachedRecordBase_(values,lessonId){
 var raw=values['JUMPY_RECORD_BASE_'+lessonId];if(!raw)return null;var meta=JSON.parse(raw),keys=[];
 for(var i=0;i<meta.parts;i++)keys.push('jumpy_records_'+meta.version+'_'+i);
 var cached=CacheService.getScriptCache().getAll(keys),rows=[];
 for(var i=0;i<keys.length;i++){if(!cached[keys[i]])return null;rows=rows.concat(JSON.parse(cached[keys[i]]));}return rows;
}
function publishRecordBase_(lessonId,records,expectedPointer){
 var props=PropertiesService.getScriptProperties(),lock=LockService.getScriptLock(),guarded=arguments.length>2;if(!lock.tryLock(2500))throw Error('기록 조회를 준비 중입니다. 자동으로 다시 확인합니다.');try{if(guarded&&props.getProperty('JUMPY_RECORD_BASE_'+lessonId)!==expectedPointer)return false;
 var version=Utilities.getUuid(),values={},parts=[],chunk=[],size=2;
 records.forEach(function(r){var bytes=byteLength_(JSON.stringify(r))+1;if(size+bytes>40000&&chunk.length){parts.push(chunk);chunk=[];size=2;}chunk.push(r);size+=bytes;});parts.push(chunk);
 parts.forEach(function(part,i){values['jumpy_records_'+version+'_'+i]=JSON.stringify(part);});
 CacheService.getScriptCache().putAll(values,3600);
 // Publish the pointer before deleting staged rows; IDs make overlapping copies harmless.
 props.setProperty('JUMPY_RECORD_BASE_'+lessonId,JSON.stringify({version:version,parts:parts.length,at:new Date().toISOString()}));return true;}finally{lock.releaseLock();}
}
function ensureRecordBase_(ss,g,c,lessonId){
 var props=PropertiesService.getScriptProperties(),values=props.getProperties(),rows=cachedRecordBase_(values,lessonId);if(rows)return rows;
 var expected=values['JUMPY_RECORD_BASE_'+lessonId]||null,eventExpected=values['JUMPY_RECORD_BASE_events_'+g+'_'+c]||null;ss=ss||SpreadsheetApp.getActiveSpreadsheet();var history=allRecords_(ss,g,c);rows=history.filter(function(r){return (r.sessionId||r.lessonId)===lessonId;});
 // Warm from a read-only Sheet snapshot; report formatting cannot hold this read hostage.
 // A newer flush pointer wins if the source changed while the read was in flight.
 if(!publishRecordBase_(lessonId,rows,expected)){rows=cachedRecordBase_(props.getProperties(),lessonId);if(!rows)throw Error('기록 연결을 다시 준비 중입니다.');}
 publishRecordBase_('events_'+g+'_'+c,history.sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}).slice(0,100),eventExpected);return rows;
}
function fastLesson_(ss,g,c,lessonId){
 var props=PropertiesService.getScriptProperties(),raw=props.getProperty('JUMPY_FAST_LESSON_'+lessonId),lesson=raw?JSON.parse(raw):null;
 if(!lesson){ss=ss||SpreadsheetApp.getActiveSpreadsheet();var rows=sheet_(ss,LESSONS,LESSON_HEAD).getDataRange().getValues(),row=rows.find(function(r,i){return i>0&&String(r[0])===lessonId;});if(!row)throw Error('측정을 시작한 수업을 확인할 수 없습니다.');lesson={id:String(row[0]),createdAt:String(row[1]),grade:Number(row[2]),classNo:Number(row[3]),sessionId:String(row[7]||row[0]),settings:validSettings_(jsonSnapshot_(row[5])),moves:jsonSnapshot_(row[6])||[]};props.setProperty('JUMPY_FAST_LESSON_'+lessonId,JSON.stringify(lesson));}
 if(lesson.grade!==g||lesson.classNo!==c)throw Error('기록의 반과 수업이 다릅니다.');return lesson;
}
function currentFastLesson_(ss,g,c){
 var data=readClassSettings_(ss,{grade:g,classNo:c});if(data.lessonId)return fastLesson_(ss,g,c,data.lessonId);
 ss=ss||SpreadsheetApp.getActiveSpreadsheet();var lock=LockService.getScriptLock();lock.waitLock(20000);try{return ensureLesson_(ss,g,c,'수업 입장');}finally{lock.releaseLock();}
}
function liveRecordRows_(ss,g,c,lessonId){
 ensureRecordBase_(ss,g,c,lessonId);var values=PropertiesService.getScriptProperties().getProperties(),base=cachedRecordBase_(values,lessonId);
 if(!base)throw Error('기록 조회를 다시 준비하고 있습니다.');var by={};base.forEach(function(r){by[r.id]=r;});
 pendingRecords_(values).forEach(function(item){var r=recordFromRow_(item.row);if(r.grade===g&&r.classNo===c&&(r.sessionId||r.lessonId)===lessonId)by[r.id]=r;});return Object.keys(by).map(function(id){return by[id];});
}
function stageRecord_(d){
 var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),n=validStudentNumber_(g,c,d.number),id=String(d.id||'');if(!/^[a-zA-Z0-9-]{12,80}$/.test(id))throw Error('기록 ID가 올바르지 않습니다.');
 var lesson=d.lessonId?fastLesson_(null,g,c,String(d.lessonId)):currentFastLesson_(null,g,c),s=lesson.settings,duration=integer_(d.durationSeconds,5,600);
 if(duration!==s.durationSeconds||integer_(d.countdownSeconds,0,15)!==s.countdownSeconds)throw Error('측정 시작 당시 시간 설정과 기록이 다릅니다.');
 var count=integer_(d.count,0,5000),misses=integer_(d.misses||0,0,5000),streak=integer_(d.bestStreak||0,0,5000);var sessionId=lesson.sessionId||lesson.id;ensureRecordBase_(null,g,c,sessionId);
 var lock=LockService.getScriptLock();if(!lock.tryLock(2500))throw Error('기록 접수가 몰리고 있습니다. 자동으로 다시 전송합니다.');
 try{
  var props=PropertiesService.getScriptProperties(),values=props.getProperties(),pending=pendingRecords_(values),base=cachedRecordBase_(values,sessionId);if(!base)throw Error('기록 연결을 다시 준비 중입니다.');
  var all=base.concat(pending.map(function(item){return recordFromRow_(item.row);})),old=all.find(function(r){return r.id===id;});
  if(old){if(old.grade!==g||old.classNo!==c||old.number!==n||old.count!==count||old.lessonId!==lesson.id)throw Error('중복 기록 ID');return {ok:true,duplicate:true,queued:!!values['JUMPY_PENDING_RECORD_'+id],createdAt:old.createdAt,lessonId:lesson.id};}
  if(!s.activityOpen)throw Error('측정을 시작한 수업의 활동이 닫혔습니다.');
  var seen={},attempts=0;all.forEach(function(r){if(r.grade===g&&r.classNo===c&&r.number===n&&(r.sessionId||r.lessonId)===sessionId&&!seen[r.id]){seen[r.id]=true;attempts++;}});
  if(attempts>=1+(s.retryAllowed?s.retryLimit:0))throw Error('재도전 횟수를 모두 사용했습니다.');
  var created=new Date(),measured=new Date(d.createdAt);if(!isNaN(measured.getTime())&&measured.getFullYear()>=2000&&measured.getTime()<=created.getTime()+300000)created=measured;
  var row=[id,created.toISOString(),g,c,n,count,duration,s.countdownSeconds,s.sensitivity,misses,streak,lesson.id,JSON.stringify(s),'',sessionId],json=JSON.stringify(row);
  var total=Object.keys(values).reduce(function(sum,key){return sum+byteLength_(key)+byteLength_(values[key]);},0);if(total+byteLength_(json)>440000||pending.length>=120)throw Error('기록 저장을 정리 중입니다. 이 기기의 기록은 보관하고 자동으로 다시 전송합니다.');
  if(byteLength_(json)>8000)throw Error('기록 설정 크기를 확인해 주세요.');props.setProperty('JUMPY_PENDING_RECORD_'+id,json);var liveKey='JUMPY_LIVE_LESSON_'+g+'_'+c,live=jsonSnapshot_(props.getProperty(liveKey));if(live&&(live.sessionId||live.id)===sessionId){live.expiresAt=Date.now()+86400000;props.setProperty(liveKey,JSON.stringify(live));}invalidateLiveClass_(g,c);
  return {ok:true,queued:true,createdAt:row[1],lessonId:lesson.id,sessionId:sessionId};
 }finally{lock.releaseLock();}
}
function flushRecords_(ss){
 var lock=LockService.getUserLock();if(!lock.tryLock(0))return {ok:true,busy:true};
 try{
  var props=PropertiesService.getScriptProperties(),pending=pendingRecords_(props.getProperties()).slice(0,60);if(!pending.length)return {ok:true,written:0,pending:0};
  var sh=sheet_(ss,RECORDS,HEAD),source=sh.getDataRange().getValues(),ids={},lessons={},accepted=[];source.slice(1).forEach(function(r){ids[String(r[0])]=r;});
  pending.forEach(function(item){var row=item.row,old=ids[row[0]];if(old&&(Number(old[2])!==row[2]||Number(old[3])!==row[3]||Number(old[4])!==row[4]))throw Error('기록 ID 충돌: 원본을 보존합니다.');if(!old){accepted.push(row);ids[row[0]]=row;}lessons[row[14]||row[11]]={grade:row[2],classNo:row[3]};});
  accepted.sort(function(a,b){return String(a[1]).localeCompare(String(b[1]));});
  if(accepted.length){var start=sh.getLastRow()+1,end=start+accepted.length-1;if(sh.getMaxRows()<end)sh.insertRowsAfter(sh.getMaxRows(),end-sh.getMaxRows());sh.getRange(start,1,accepted.length,HEAD.length).setValues(accepted);SpreadsheetApp.flush();}
  var all=source.slice(1).concat(accepted).map(recordFromRow_),classes={};pending.forEach(function(item){classes[item.row[2]+'_'+item.row[3]]={g:item.row[2],c:item.row[3]};});Object.keys(classes).forEach(function(key){var id=classes[key];publishRecordBase_('events_'+key,all.filter(function(r){return r.grade===id.g&&r.classNo===id.c;}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);}).slice(0,100));});Object.keys(lessons).forEach(function(id){publishRecordBase_(id,all.filter(function(r){return (r.sessionId||r.lessonId)===id;}));});
  // A failure before the cache pointer is published retains the durable queue for retry.
  pending.forEach(function(item){props.deleteProperty(item.key);});Object.keys(classes).forEach(function(key){invalidateLiveClass_(classes[key].g,classes[key].c);});return {ok:true,written:accepted.length,pending:pendingRecords_(props.getProperties()).length};
 }finally{lock.releaseLock();}
}
function invalidateLiveClass_(g,c){if(typeof CacheService==='undefined')return;var cache=CacheService.getScriptCache();if(cache.removeAll)cache.removeAll(['jumpy_live_'+g+'_'+c,'jumpy_settings_'+g+'_'+c]);}
function studentSettingsMemo_(d){var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),key='jumpy_settings_'+g+'_'+c,cache=CacheService.getScriptCache(),saved=cache.getAll([key])[key];if(saved)return JSON.parse(saved);var data=readClassSettings_(null,d),put={};put[key]=JSON.stringify(data);cache.putAll(put,1);return data;}
function liveData_(ss,d,teacher){
 var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),n=teacher?0:validStudentNumber_(g,c,d.number),key='jumpy_live_'+g+'_'+c,cache=CacheService.getScriptCache(),memo=cache.getAll([key])[key],data=memo?JSON.parse(memo):null;
 if(!data){
  var props=PropertiesService.getScriptProperties(),values=props.getProperties(),state=values[classSettingsKey_(g,c)]?JSON.parse(values[classSettingsKey_(g,c)]):null,live=values['JUMPY_LIVE_LESSON_'+g+'_'+c]?JSON.parse(values['JUMPY_LIVE_LESSON_'+g+'_'+c]):null;
  var matches=roundAlive_(live,values)&&live.revision===(state?state.revision:''),lesson=matches&&values['JUMPY_FAST_LESSON_'+live.id]?JSON.parse(values['JUMPY_FAST_LESSON_'+live.id]):currentFastLesson_(ss,g,c),sessionId=lesson.sessionId||lesson.id,base=cachedRecordBase_(values,sessionId);
  if(!base){ensureRecordBase_(ss,g,c,sessionId);values=props.getProperties();base=cachedRecordBase_(values,sessionId);if(!base)throw Error('기록 연결을 다시 준비 중입니다.');}
  var pending=pendingRecords_(values).map(function(item){return recordFromRow_(item.row);}).filter(function(r){return r.grade===g&&r.classNo===c;}),byId={};base.concat(pending.filter(function(r){return (r.sessionId||r.lessonId)===sessionId;})).forEach(function(r){byId[r.id]=r;});var rows=Object.keys(byId).map(function(id){return byId[id];}),by={};
  rows.forEach(function(r){var old=by[r.number];if(!old)old=by[r.number]={number:r.number,count:r.count,createdAt:r.createdAt,attempts:0};old.attempts++;if(lesson.settings.recordMode==='latest'?r.createdAt>=old.createdAt:r.count>old.count){old.count=r.count;old.createdAt=r.createdAt;}});
  var ranking=Object.keys(by).map(function(k){return by[k];}).sort(function(a,b){return b.count-a.count||a.number-b.number;});ranking.forEach(function(r){r.rank=1+ranking.filter(function(x){return x.count>r.count;}).length;delete r.createdAt;});
  var events=cachedRecordBase_(values,'events_'+g+'_'+c)||[],recordEvents={};rows.concat(events,pending).forEach(function(r){recordEvents[r.id]=r;});data={...musicStateView_(g,c,values),lessonId:lesson.id,sessionId:sessionId,settings:lesson.settings,settingsVersion:lesson.settingsVersion||'',ranking:ranking,rows:rows,records:Object.keys(recordEvents).filter(function(id){return !byId[id];}).map(function(id){return recordEvents[id];}),pending:pending.length};
  var json=JSON.stringify(data);if(byteLength_(json)<90000){var put={};put[key]=json;cache.putAll(put,1);}
 }
 var result={ok:true,lessonId:data.lessonId,sessionId:data.sessionId,settings:data.settings,settingsVersion:data.settingsVersion,pending:data.pending,musicSettings:data.musicSettings,moveOptions:data.moveOptions,musicMovesVersion:data.musicMovesVersion,musicSettingsVersion:data.musicSettingsVersion};
 if(teacher){result.ranking=data.ranking;result.participants=data.ranking.map(function(r){return r.number;});result.records=data.rows.concat(data.records);}else{var view=views_(data.rows,data.settings,n,data.sessionId||data.lessonId);result.ranking=view.ranking;result.records=view.records;}return result;
}
function pruneFastRecordMetadata_(){var props=PropertiesService.getScriptProperties(),values=props.getProperties(),keep={};pendingRecords_(values).forEach(function(item){keep[item.row[11]]=true;keep[item.row[14]||item.row[11]]=true;});Object.keys(values).filter(function(key){return key.indexOf('JUMPY_FAST_LESSON_')===0;}).forEach(function(key){var lesson=JSON.parse(values[key]);if(!keep[lesson.id]&&Date.now()-Date.parse(lesson.createdAt)>7*86400000){props.deleteProperty(key);if(!keep[lesson.sessionId||lesson.id])props.deleteProperty('JUMPY_RECORD_BASE_'+(lesson.sessionId||lesson.id));}});}

function musicStateView_(g,c,values){values=values||PropertiesService.getScriptProperties().getProperties();var raw=values['JUMPY_MUSIC_SETTINGS_'+g+'_'+c],state=raw?JSON.parse(raw):null,moves=values['JUMPY_MUSIC_MOVES_'+g+'_'+c]?JSON.parse(values['JUMPY_MUSIC_MOVES_'+g+'_'+c]):null;return {musicSettings:{activityType:'music',activityOpen:state?state.settings.activityOpen:true},musicSettingsVersion:state?state.revision:'',musicSettingsRequestId:state?state.requestId:'',moveOptions:moves?moves.moves:DEFAULT_MOVES,musicMovesVersion:moves?moves.revision:''};}
function saveMusicSettings_(d){var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30);if(!d.settings||typeof d.settings.activityOpen!=='boolean')throw Error('음악 활동 설정을 확인해 주세요.');var props=PropertiesService.getScriptProperties(),key='JUMPY_MUSIC_SETTINGS_'+g+'_'+c,old=jsonSnapshot_(props.getProperty(key)),id=String(d.requestId||'');if(id&&!/^[a-zA-Z0-9-]{12,80}$/.test(id))throw Error('음악 설정 저장 요청을 확인해 주세요.');if(old&&id&&old.requestId===id&&(old.settings.activityOpen!==d.settings.activityOpen||old.forceLesson!==(d.startLesson===true)))throw Error('다른 음악 설정에 같은 요청 ID를 사용할 수 없습니다.');if(!old||old.requestId!==id||!id)props.setProperty(key,JSON.stringify({settings:{activityType:'music',activityOpen:d.settings.activityOpen},revision:Utilities.getUuid(),requestId:id,forceLesson:d.startLesson===true,updatedAt:new Date().toISOString()}));invalidateLiveClass_(g,c);return Object.assign({ok:true,requestId:id},musicStateView_(g,c));}
function saveMusicMoves_(d){var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),moves=validMoveOptions_(d.moves),lock=LockService.getScriptLock();if(!lock.tryLock(2500))throw Error('동작 저장을 다시 확인해 주세요.');try{PropertiesService.getScriptProperties().setProperty('JUMPY_MUSIC_MOVES_'+g+'_'+c,JSON.stringify({moves:moves,revision:Utilities.getUuid()}));}finally{lock.releaseLock();}invalidateLiveClass_(g,c);return Object.assign({ok:true},musicStateView_(g,c));}
function ensureMusicLesson_(ss,g,c,reason,force){
 var props=PropertiesService.getScriptProperties(),values=props.getProperties(),view=musicStateView_(g,c,values),moveKey='JUMPY_MUSIC_MOVES_'+g+'_'+c;
 if(!values[moveKey]){var initLock=LockService.getScriptLock();initLock.waitLock(20000);try{if(!props.getProperty(moveKey)){var options=moves_(ss,classKey_(g,c));props.setProperty(moveKey,JSON.stringify({moves:options,revision:Utilities.getUuid()}));}}finally{initLock.releaseLock();}values=props.getProperties();view=musicStateView_(g,c,values);}
 var settings=view.musicSettings,sh=sheet_(ss,MUSIC_LESSONS,MUSIC_LESSON_HEAD),rows=sh.getDataRange().getValues(),previous=null,now=new Date(),state=jsonSnapshot_(values['JUMPY_MUSIC_SETTINGS_'+g+'_'+c]),appliedKey='JUMPY_MUSIC_APPLIED_'+g+'_'+c;
 if(state&&state.forceLesson&&values[appliedKey]!==state.revision)force=true;
 for(var i=rows.length-1;i>0;i--)if(Number(rows[i][2])===g&&Number(rows[i][3])===c){previous=rows[i];break;}
 var reuse=!force&&previous&&Utilities.formatDate(new Date(previous[1]),'Asia/Seoul','yyyy-MM-dd')===Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd')&&previous[5]===JSON.stringify(settings)&&previous[6]===JSON.stringify(view.moveOptions),id=reuse?String(previous[0]):Utilities.getUuid();
 if(!reuse)sh.appendRow([id,now.toISOString(),g,c,force?'새 음악 수업 시작':reason,JSON.stringify(settings),JSON.stringify(view.moveOptions)]);if(state)props.setProperty(appliedKey,state.revision);return {id:id,settings:settings,moves:view.moveOptions};
}
function mirrorMusicSettings_(ss){
 var props=PropertiesService.getScriptProperties(),values=props.getProperties(),sh=sheet_(ss,SETTINGS,['key','json']),rows=sh.getDataRange().getValues();
 [1,2,3].forEach(function(c){ensureMusicLesson_(ss,1,c,'음악 설정 확인');var view=musicStateView_(1,c);[['__music__1-'+c,JSON.stringify(view.musicSettings)],['__moves__1-'+c,JSON.stringify(view.moveOptions)]].forEach(function(pair){var index=rows.findIndex(function(row,i){return i>0&&row[0]===pair[0];});if(index<0){sh.appendRow(pair);rows.push(pair);}else if(rows[index][1]!==pair[1])sh.getRange(index+1,2).setValue(pair[1]);});});
}
function musicSettingsLabel_(settings){return settings&&settings.activityType==='music'?'음악 활동 '+(settings.activityOpen?'열림':'닫힘'):'당시 음악 설정 미저장';}

// Upgrade legacy snapshot IDs into a measuring round without rewriting source fields.
// Explicit new-class boundaries are respected; only an unexpired recorded class is restored.
function restoreRecentRopeRound_(ss,g,c){
 var props=PropertiesService.getScriptProperties(),marker='JUMPY_ROUND_MIGRATED_'+g+'_'+c;if(props.getProperty(marker))return;
 var values=props.getProperties();if(pendingRecords_(values).some(function(item){return Number(item.row[2])===g&&Number(item.row[3])===c;}))return;
 var recordSheet=sheet_(ss,RECORDS,HEAD),records=recordSheet.getDataRange().getValues(),lessonSheet=sheet_(ss,LESSONS,LESSON_HEAD),lessons=lessonSheet.getDataRange().getValues(),recent=records.slice(1).filter(function(r){return Number(r[2])===g&&Number(r[3])===c;}).sort(function(a,b){return Date.parse(b[1])-Date.parse(a[1]);})[0];
 if(!recent||Date.now()-Date.parse(recent[1])>=86400000){props.setProperty(marker,'no-recent-class');return;}
 var end=lessons.findIndex(function(r){return String(r[0])===String(recent[11]);});if(end<1)return;var anchor=end;
 for(var i=end;i>0;i--)if(Number(lessons[i][2])===g&&Number(lessons[i][3])===c&&lessons[i][4]==='새 수업 시작'){anchor=i;break;}
 var selected=lessons.map(function(r,i){return {row:r,index:i};}).filter(function(item){return item.index>=anchor&&Number(item.row[2])===g&&Number(item.row[3])===c;});
 if(selected.some(function(item){return item.row[7]||item.index>end&&item.row[4]==='새 수업 시작';})){props.setProperty(marker,'existing-round');return;}
 var root=String(lessons[anchor][0]),ids={};selected.forEach(function(item){ids[String(item.row[0])]=true;lessonSheet.getRange(item.index+1,8).setValue(root);props.deleteProperty('JUMPY_FAST_LESSON_'+item.row[0]);props.deleteProperty('JUMPY_RECORD_BASE_'+item.row[0]);});
 records.forEach(function(r,i){if(i>0&&Number(r[2])===g&&Number(r[3])===c&&ids[String(r[11])]&&!r[14])recordSheet.getRange(i+1,15).setValue(root);});
 var last=selected[selected.length-1].row,live=jsonSnapshot_(props.getProperty('JUMPY_LIVE_LESSON_'+g+'_'+c))||{id:String(last[0]),revision:'',settings:jsonSnapshot_(last[5])};live.sessionId=root;live.expiresAt=Date.parse(recent[1])+86400000;props.setProperty('JUMPY_LIVE_LESSON_'+g+'_'+c,JSON.stringify(live));props.setProperty(marker,'restored');invalidateLiveClass_(g,c);
}

function classRoster_(g,c){var total=Number(g)===1?({1:15,2:15,3:14}[Number(c)]||0):0;if(!total)return null;var numbers=[];for(var i=1;i<=total;i++)numbers.push(i);return {numbers:numbers,total:total,maxNumber:total};}
function validStudentNumber_(g,c,value){var n=integer_(value,1,99),roster=classRoster_(g,c);if(roster&&roster.numbers.indexOf(n)<0)throw Error(g+'학년 '+c+'반 번호는 1~'+roster.maxNumber+'번이에요.');return n;}

function setupJumpyMusicStorage(){var folder=musicFolder_();return {ok:true,folderId:folder.getId()};}
function musicFolder_(){var props=PropertiesService.getScriptProperties(),id=props.getProperty('JUMPY_MUSIC_FOLDER_ID');if(id)return DriveApp.getFolderById(id);var folder=DriveApp.createFolder('JUMPY_음악줄넘기_제출곡');props.setProperty('JUMPY_MUSIC_FOLDER_ID',folder.getId());return folder;}
function validAudio_(value){
 if(!value||typeof value.data!=='string'||value.data.length>13981016||value.data.length%4||!value.data||!/^[A-Za-z0-9+/]*={0,2}$/.test(value.data))throw Error('노래 파일 데이터를 확인해 주세요.');
 var mime=String(value.mime),name=String(value.name||'').trim();if(!name||name.length>180||/[\x00-\x1f\x7f]/.test(name)||['audio/mpeg','audio/mp4','audio/wav'].indexOf(mime)<0)throw Error('MP3, M4A, WAV 노래 파일을 선택해 주세요.');
 var bytes=Utilities.base64Decode(value.data);if(!bytes.length||bytes.length>10485760||Number(value.bytes)!==bytes.length)throw Error('노래 파일은 10MB 이하로 선택해 주세요.');
 var at=function(i){return (bytes[i]||0)&255;},text=function(i,n){var s='';for(var j=i;j<i+n;j++)s+=String.fromCharCode(at(j));return s;};
 var signature=mime==='audio/mpeg'?(text(0,3)==='ID3'||at(0)===255&&(at(1)&224)===224):mime==='audio/mp4'?text(4,4)==='ftyp':text(0,4)==='RIFF'&&text(8,4)==='WAVE';if(!signature)throw Error('노래 파일 형식을 확인해 주세요.');
 var duration=Number(value.durationSeconds),offset=Number(value.offsetSeconds||0);if(!isFinite(duration)||duration<=0||duration>3600||!isFinite(offset)||offset<0||offset>=duration)throw Error('노래 길이와 안무 시작 시간을 확인해 주세요.');
 var hash=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');if(hash!==value.checksum)throw Error('노래 파일 전송이 온전하지 않습니다. 다시 제출해 주세요.');
 return {bytes:bytes,mime:mime,name:name,duration:duration,offset:offset};
}
function musicAudio_(ss,d){
 if(!authorized_(d.pin))throw Error('교사 PIN이 올바르지 않습니다.');var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),id=String(d.submissionId||''),rows=sheet_(ss,MUSIC,MUSIC_HEAD).getDataRange().getValues();
 var row=rows.find(function(r,i){return i>0&&Number(r[1])===g&&Number(r[2])===c&&String(r[14])===id;});if(!row||!row[15])throw Error('이 반의 제출 노래를 찾지 못했어요.');
 var folder=musicFolder_(),file=DriveApp.getFileById(String(row[15])),parents=file.getParents(),inside=false;while(parents.hasNext())if(parents.next().getId()===folder.getId())inside=true;if(!inside||file.isTrashed())throw Error('제출곡 폴더에서 노래를 찾지 못했어요.');
 var blob=file.getBlob(),bytes=blob.getBytes();if(bytes.length>10485760)throw Error('노래 파일 크기를 확인해 주세요.');return {ok:true,name:String(row[16]),mime:String(row[17]),data:Utilities.base64Encode(bytes)};
}
