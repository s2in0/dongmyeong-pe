/** 줄넘기 PWA 시트 백엔드. 스프레드시트에 연결된 Apps Script에 붙여넣으세요.
 * 첫 배포 전 프로젝트 설정 > 스크립트 속성에 TEACHER_PIN(6자리 이상)을 직접 설정합니다.
 * 공개 URL과 PIN을 학생에게 함께 배포하지 마세요. PIN은 교사 설정 변경에만 사용됩니다.
 */
var SETTINGS = '설정', RECORDS = '기록', MUSIC = '음악줄넘기';
var HEAD = ['id','createdAt','grade','classNo','number','count','durationSeconds','countdownSeconds','sensitivity','misses','bestStreak'];
var LESSONS='수업이력', LESSON_HEAD=['id','createdAt','grade','classNo','reason','settings','moves'];
var MUSIC_HEAD=['createdAt','grade','classNo','number','groupName','theme','moves','lessonId','settingsSnapshot','movesSnapshot'];
HEAD=HEAD.concat(['lessonId','settingsSnapshot','movesSnapshot']);
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
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (d.type === 'bootstrap') return out_(bootstrap_(ss, d));
    if (d.type === 'teacherData') {
      if (!authorized_(d.pin)) return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});
      return out_(teacherData_(ss,d));
    }
    if (d.type === 'musicSubmit') return out_(musicSubmit_(ss,d));
    if (d.type === 'saveMoves') {
      if (!authorized_(d.pin)) return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});
      var moveKey='__moves__'+classKey_(d.grade,d.classNo),options=validMoveOptions_(d.moves),moveLock=LockService.getScriptLock();moveLock.waitLock(20000);
      try { var moveSheet=sheet_(ss,SETTINGS,['key','json']),moveRows=moveSheet.getDataRange().getValues();
        var moveRow=moveRows.findIndex(function(x,i){return i>0&&x[0]===moveKey;});
        if(moveRow<0) moveSheet.appendRow([moveKey,JSON.stringify(options)]); else moveSheet.getRange(moveRow+1,2).setValue(JSON.stringify(options));
        ensureLesson_(ss,Number(d.grade),Number(d.classNo),'동작 변경');
        var moveResult=updateClassSheetsSafe_(ss,{ok:true,moveOptions:options});
      } finally { moveLock.releaseLock(); }
      return out_(moveResult);
    }
    if (d.type === 'saveMedals') {
      if (!authorized_(d.pin)) return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});
      var medals=validMedals_(d.medals),lockMedals=LockService.getScriptLock();lockMedals.waitLock(20000);
      try { var medalSheet=sheet_(ss,SETTINGS,['key','json']),medalRows=medalSheet.getDataRange().getValues();
        var medalRow=medalRows.findIndex(function(x,i){return i>0&&x[0]==='__medals__';});
        if(medalRow<0) medalSheet.appendRow(['__medals__',JSON.stringify(medals)]); else medalSheet.getRange(medalRow+1,2).setValue(JSON.stringify(medals));
      } finally { lockMedals.releaseLock(); }
      return out_({ok:true,medals:medals});
    }
    if (d.type === 'saveSettings') {
      if (!authorized_(d.pin)) return out_({ok:false,error:'교사 PIN이 올바르지 않습니다.'});
      var key = classKey_(d.grade,d.classNo), next = validSettings_(d.settings);
      var lock = LockService.getScriptLock(); lock.waitLock(20000);
      try { var s = sheet_(ss, SETTINGS, ['key','json']); var data=s.getDataRange().getValues();
        var row=data.findIndex(function(x,i){return i>0 && x[0]===key;});
        if(row<0) s.appendRow([key,JSON.stringify(next)]); else s.getRange(row+1,2).setValue(JSON.stringify(next));
        ensureLesson_(ss,Number(d.grade),Number(d.classNo),d.startLesson?'새 수업 시작':'설정 변경',d.startLesson===true);
        var settingsResult=updateClassSheetsSafe_(ss,{ok:true,settings:next});
      } finally { lock.releaseLock(); }
      return out_(settingsResult);
    }
    if (d.type === 'record') return out_(record_(ss,d));
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
function moves_(ss,key) { var sh=sheet_(ss,SETTINGS,['key','json']),rows=sh.getDataRange().getValues();
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
function settings_(ss,key) { var sh=sheet_(ss,SETTINGS,['key','json']); var rows=sh.getDataRange().getValues();
  for(var i=1;i<rows.length;i++) if(rows[i][0]===key) { try{return validSettings_(JSON.parse(rows[i][1]));}catch(e){break;} }
  return DEFAULTS;
}
function allRecords_(ss,g,c) { var sh=sheet_(ss,RECORDS,HEAD); var rows=sh.getDataRange().getValues(), out=[];
  for(var i=1;i<rows.length;i++) if(Number(rows[i][2])===g && Number(rows[i][3])===c) out.push({id:String(rows[i][0]),createdAt:String(rows[i][1]),grade:g,classNo:c,number:Number(rows[i][4]),count:Number(rows[i][5]),durationSeconds:Number(rows[i][6]),countdownSeconds:Number(rows[i][7]),sensitivity:String(rows[i][8]),misses:Number(rows[i][9]),bestStreak:Number(rows[i][10]),lessonId:String(rows[i][11]||''),settingsSnapshot:jsonSnapshot_(rows[i][12]),movesSnapshot:jsonSnapshot_(rows[i][13])});
  return out;
}
function views_(records,settings,number,lessonId) {
  var mine=records.filter(function(r){return r.number===number;});
  // 기록은 같은 제한시간에서만 비교한다. 순위도 학생별 최고/마지막 기록으로 만든다.
  var same=records.filter(function(r){return r.durationSeconds===settings.durationSeconds&&r.lessonId===lessonId;});
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
function bootstrap_(ss,d) { var g=integer_(d.grade,1,6), c=integer_(d.classNo,1,30), n=integer_(d.number,1,99);
  var lock=LockService.getScriptLock();lock.waitLock(20000);try{var lesson=ensureLesson_(ss,g,c,'수업 입장'),key=classKey_(g,c),s=lesson.settings;return Object.assign({ok:true,settings:s,lessonId:lesson.id,medals:medals_(ss),moveOptions:lesson.moves},views_(allRecords_(ss,g,c),s,n,lesson.id));}finally{lock.releaseLock();}
}
function record_(ss,d) { var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),n=integer_(d.number,1,99),key=classKey_(g,c);
  var id=String(d.id||''); if(!/^[a-zA-Z0-9-]{12,80}$/.test(id)) throw Error('기록 ID가 올바르지 않습니다.');
  var lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var s=settings_(ss,key), sh=sheet_(ss,RECORDS,HEAD), rows=sh.getDataRange().getValues();
    var old=rows.findIndex(function(r,i){return i>0 && String(r[0])===id;});
    if(old>=0) { if(Number(rows[old][2])!==g || Number(rows[old][3])!==c || Number(rows[old][4])!==n) throw Error('중복 기록 ID'); return updateClassSheetsSafe_(ss,{ok:true,duplicate:true}); }
    if(!s.activityOpen) throw Error('이 반의 활동이 닫혔습니다.');
    var duration=integer_(d.durationSeconds,5,600); if(duration!==s.durationSeconds) throw Error('제한시간 설정이 바뀌었습니다. 다시 입장해 주세요.');
    var lesson=ensureLesson_(ss,g,c,'수업 기록');if(d.lessonId&&d.lessonId!==lesson.id)throw Error('수업 설정이 변경되었습니다. 다시 입장해 주세요.');var count=integer_(d.count,0,5000), attempts=rows.filter(function(r,i){return i>0 && Number(r[2])===g && Number(r[3])===c && Number(r[4])===n && Number(r[6])===duration && String(r[11])===lesson.id;}).length;
    if(attempts >= 1+(s.retryAllowed?s.retryLimit:0)) throw Error('재도전 횟수를 모두 사용했습니다.');
    var created=new Date().toISOString();
    sh.appendRow([id,created,g,c,n,count,duration,integer_(d.countdownSeconds,0,15),String(s.sensitivity),integer_(d.misses||0,0,5000),integer_(d.bestStreak||0,0,5000),lesson.id,JSON.stringify(lesson.settings),JSON.stringify(lesson.moves)]);
    return updateClassSheetsSafe_(ss,{ok:true,createdAt:created});
  } finally {lock.releaseLock();}
}
function safeText_(value,max) {
  var s=String(value||'').trim(); if(!s||s.length>max) throw Error('음악 줄넘기 입력을 확인해 주세요.');
  return /^[=+\-@\t\r]/.test(s)?"'"+s:s;
}
function musicSubmit_(ss,d) {
  var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),n=integer_(d.number,1,99);
  if(!settings_(ss,classKey_(g,c)).activityOpen) throw Error('이 반의 활동이 닫혔습니다.');
  var group=safeText_(d.groupName,20),theme=safeText_(d.theme,40);
  var bars=Array.isArray(d.moves)&&typeof d.moves[0]==='string'?[d.moves]:d.moves;
  if(!Array.isArray(bars)||bars.length<1||bars.length>16||bars.some(function(row){return !Array.isArray(row)||row.length!==4;})) throw Error('4박자 동작 줄을 확인해 주세요.');
  bars=bars.map(function(row){return row.map(validMove_);});
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try{var sh=sheet_(ss,MUSIC,MUSIC_HEAD);
    var lesson=ensureLesson_(ss,g,c,'음악 제출');sh.appendRow([new Date().toISOString(),g,c,n,group,theme,JSON.stringify(bars),lesson.id,JSON.stringify(lesson.settings),JSON.stringify(lesson.moves)]);
    return updateClassSheetsSafe_(ss,{ok:true});
  }finally{lock.releaseLock();}
}
function teacherData_(ss,d) {
  var g=integer_(d.grade,1,6),c=integer_(d.classNo,1,30),s=settings_(ss,classKey_(g,c));
  var lessonId=currentLessonId_(ss,g,c),all=allRecords_(ss,g,c),same=all.filter(function(r){return r.durationSeconds===s.durationSeconds&&r.lessonId===lessonId;});
  var by={},attempts={};same.forEach(function(r){attempts[r.number]=(attempts[r.number]||0)+1;var old=by[r.number];if(!old||(s.recordMode==='latest'?r.createdAt>old.createdAt:r.count>old.count))by[r.number]=r;});
  var ranking=Object.keys(by).map(function(k){return {number:Number(k),count:by[k].count,attempts:attempts[k]};}).sort(function(a,b){return b.count-a.count||a.number-b.number;});
  ranking.forEach(function(r){r.rank=1+ranking.filter(function(x){return x.count>r.count;}).length;});
  var sh=sheet_(ss,MUSIC,MUSIC_HEAD),rows=sh.getDataRange().getValues(),latest=Object.create(null);
  for(var i=1;i<rows.length;i++) if(Number(rows[i][1])===g&&Number(rows[i][2])===c){
    var key=String(rows[i][7]||'기존')+'|'+String(rows[i][4]),moves=[];try{moves=JSON.parse(rows[i][6]);if(moves.length&&typeof moves[0]==='string')moves=[moves];moves=moves.map(function(bar){return bar.map(validMove_);});}catch(e){}
    latest[key]={groupName:String(rows[i][4]),theme:String(rows[i][5]),number:Number(rows[i][3]),moves:moves,createdAt:String(rows[i][0]),settingsSnapshot:jsonSnapshot_(rows[i][8]),movesSnapshot:jsonSnapshot_(rows[i][9])};
  }
  var result={ok:true,lessonId:lessonId,settings:s,medals:medals_(ss),moveOptions:moves_(ss,classKey_(g,c)),participants:ranking.map(function(r){return r.number;}),ranking:ranking,records:all.map(function(r){return {createdAt:r.createdAt,number:r.number,count:r.count,durationSeconds:r.durationSeconds,countdownSeconds:r.countdownSeconds,sensitivity:r.sensitivity,lessonId:r.lessonId,settingsSnapshot:r.settingsSnapshot,movesSnapshot:r.movesSnapshot};}),music:Object.keys(latest).map(function(k){return latest[k];}).sort(function(a,b){return b.createdAt.localeCompare(a.createdAt);})};
  var viewLock=LockService.getScriptLock();
  if(viewLock.tryLock(1000)){try{updateClassSheetsSafe_(ss,result);}finally{viewLock.releaseLock();}}
  else result.sheetViewWarning='반별 시트 갱신을 기다리고 있습니다. 다음 조회 때 다시 갱신합니다.';
  return result;
}
/** Apps Script 편집기에서 한 번 실행하면 기존 기록도 세 반 요약 탭에 반영됩니다. */
function setupJumpyClassSheets() {
  var ss=SpreadsheetApp.getActiveSpreadsheet(),lock=LockService.getScriptLock();
  if(!ss)throw Error('앱에 연결된 스프레드시트의 Apps Script에서 실행해 주세요.');
  lock.waitLock(20000);
  try{[1,2,3].forEach(function(c){ensureLesson_(ss,1,c,'현재 설정 등록');});updateClassSheets_(ss);return {ok:true,sheets:['1학년 1반','1학년 2반','1학년 3반']};}
  finally{lock.releaseLock();}
}
// 호출자가 보유한 저장/조회 잠금 안에서 실행합니다. 요약 실패로 원본 저장을 실패 처리하지 않습니다.
function updateClassSheetsSafe_(ss,result) {
  try{updateClassSheets_(ss);}catch(error){result.sheetViewWarning='반별 시트 갱신 실패: '+String(error.message||error);}
  return result;
}
function updateClassSheets_(ss) {
  var marker='JUMPY_CLASS_SUMMARY',version='v1',head=['측정 일시','번호','기록(회)','측정시간(초)','준비시간(초)','당시 민감도','당시 수업 설정','당시 기본동작'];
  var plans=[1,2,3].map(function(c){return {classNo:c,name:'1학년 '+c+'반',sheet:ss.getSheetByName('1학년 '+c+'반')};});
  // 기존 동명 탭에 교사가 넣은 자료가 있으면 보존하며 오류를 알립니다.
  plans.forEach(function(plan){if(plan.sheet&&plan.sheet.getLastRow()>0&&!plan.sheet.getDeveloperMetadata().some(function(m){return m.getKey()===marker&&m.getValue()===version;}))throw Error(plan.name+' 탭에 기존 자료가 있습니다. 다른 이름으로 옮긴 뒤 setupJumpyClassSheets를 실행해 주세요.');});
  var raw=sheet_(ss,RECORDS,HEAD),source=raw.getDataRange().getValues();
  if(source[0].slice(0,HEAD.length).join('|')!==HEAD.join('|'))throw Error('기록 탭의 열 구성을 확인해 주세요.');
  var musicSheet=sheet_(ss,MUSIC,MUSIC_HEAD);
  var musicSource=musicSheet.getDataRange().getValues();
  var properties=PropertiesService.getScriptProperties(),saved=properties.getProperties();
  plans.forEach(function(plan){
    var s=settings_(ss,classKey_(1,plan.classNo));
    var records=source.slice(1).filter(function(row){return Number(row[2])===1&&Number(row[3])===plan.classNo;}).map(function(row){return {number:Number(row[4]),count:Number(row[5]),durationSeconds:Number(row[6]),countdownSeconds:Number(row[7]),sensitivity:String(row[8]),misses:Number(row[9]),bestStreak:Number(row[10]),settingsSnapshot:jsonSnapshot_(row[12]),movesSnapshot:jsonSnapshot_(row[13]),createdAt:row[1] instanceof Date?row[1].toISOString():String(row[1])};});
    var history=classHistory_(records),key='jumpy_class_summary_'+ss.getId()+'_'+plan.classNo;
    var moves=moves_(ss,classKey_(1,plan.classNo)),music=classMusicSummary_(musicSource,plan.classNo);
    var lessons=sheet_(ss,LESSONS,LESSON_HEAD).getDataRange().getValues().slice(1).filter(function(r){return Number(r[2])===1&&Number(r[3])===plan.classNo;}).reverse();
    var musicRows=music.map(function(item){return [classSheetText_(item.groupName),classSheetText_(item.theme),item.number,item.createdAt,settingsLabel_(item.settingsSnapshot),classSheetText_(item.moves.map(function(bar,index){return (index+1)+'줄: '+bar.map(function(move){return move.symbol+' '+move.label;}).join(' / ');}).join('\n')),classSheetText_(movesLabel_(item.movesSnapshot)),''];});
    var payload=JSON.stringify({version:'v4',settings:s,history:history,lessons:lessons,music:musicRows});
    var digest=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,payload));
    var sh=plan.sheet,fresh=!sh||sh.getLastRow()===0;
    if(!fresh&&saved[key]===digest&&sh.getRange('A1').getValue()===plan.name+' 수업 기록')return;
    if(!sh)sh=ss.insertSheet(plan.name);
    var requiredRows=history.length+lessons.length+musicRows.length+30;
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
    sh.getRange('A1').setValue(plan.name+' 수업 기록');
    sh.getRange('A2').setValue('현재 설정: '+s.durationSeconds+'초 · 준비 '+s.countdownSeconds+'초 · 민감도 '+s.sensitivity+' · '+(s.recordMode==='latest'?'마지막 기록':'최고기록')+' 반영 / 전체 기록 최신순');
    sh.getRange('A3:H3').setValues([['참여 학생',new Set(records.map(function(record){return record.number;})).size,'측정 기록',history.length,'현재 제한시간(초)',s.durationSeconds,'활동 상태',s.activityOpen?'열림':'닫힘']]);
    sh.getRange('A5:H5').setValues([head]);
    var oldRows=Math.max(0,sh.getLastRow()-5);
    if(oldRows){sh.getRange(6,1,oldRows,8).clearContent();sh.getRange(6,1,oldRows,8).setBackground('#ffffff').setFontColor('#20252d').setFontWeight('normal').setNumberFormat('General').setWrap(false);}
    if(history.length){
      sh.getRange(6,1,history.length,8).setValues(history);
      sh.getRange(6,1,history.length,1).setNumberFormat('yyyy"년" m"월" d"일" hh"시" mm"분"');
      sh.getRange(6,2,history.length,4).setNumberFormat('0');sh.getRange(6,7,history.length,2).setWrap(true);
    }else sh.getRange('A6').setValue('아직 기록이 없습니다.');
    var settingsRow=8+Math.max(1,history.length);
    classSectionHeading_(sh,settingsRow,'수업별 설정·기본동작 이력 · 최신순');
    sh.getRange(settingsRow+1,1,1,8).setValues([['수업 시작 / 변경 일시','구분','당시 수업 설정','당시 기본동작','','','','']]);
    if(lessons.length){sh.getRange(settingsRow+2,1,lessons.length,8).setValues(lessons.map(function(r){return [new Date(r[1]),r[4],classSheetText_(settingsLabel_(jsonSnapshot_(r[5]))),classSheetText_(movesLabel_(jsonSnapshot_(r[6]))),'','','',''];}));sh.getRange(settingsRow+2,1,lessons.length,1).setNumberFormat('yyyy"년" m"월" d"일" hh"시" mm"분"');sh.getRange(settingsRow+2,3,lessons.length,2).setWrap(true);}
    var musicRow=settingsRow+Math.max(1,lessons.length)+5;
    classSectionHeading_(sh,musicRow,'음악 줄넘기 제출 이력 · 전체 수업 최신순');
    sh.getRange(musicRow+1,1,1,8).setValues([['조 이름','주제','제출 번호','제출 일시','당시 수업 설정','안무','당시 기본동작','']]);
    sh.getRange(musicRow+1,1,1,8).setBackground('#eaf3ff').setFontWeight('bold');
    if(musicRows.length){sh.getRange(musicRow+2,1,musicRows.length,8).setValues(musicRows);sh.getRange(musicRow+2,4,musicRows.length,1).setNumberFormat('yyyy"년" m"월" d"일" hh"시" mm"분"');sh.getRange(musicRow+2,6,musicRows.length,1).setWrap(true);}
    else sh.getRange(musicRow+2,1).setValue('아직 제출한 조가 없습니다.');
    if(fresh)sh.addDeveloperMetadata(marker,version);
    properties.setProperty(key,digest);
  });
}
function classHistory_(records){return records.slice().sort(function(a,b){return b.createdAt.localeCompare(a.createdAt)||a.number-b.number;}).map(function(record){var date=new Date(record.createdAt);return [isNaN(date.getTime())?'':date,record.number,record.count,record.durationSeconds,record.countdownSeconds,record.sensitivity,classSheetText_(settingsLabel_(record.settingsSnapshot)),classSheetText_(movesLabel_(record.movesSnapshot))];});}
function classSectionHeading_(sh,row,title){sh.getRange(row,1,1,8).setBackground('#eaf3ff').setFontColor('#2469d4').setFontWeight('bold');sh.getRange(row,1).setValue(title);}
function classSheetText_(value){var text=String(value||'');return /^[=+\-@\t\r]/.test(text)?"'"+text:text;}
function classMusicSummary_(source,classNo){
  var items=[];
  source.slice(1).forEach(function(row){
    if(Number(row[1])!==1||Number(row[2])!==classNo)return;
    var key=String(row[4]),date=row[0] instanceof Date?row[0].toISOString():String(row[0]),bars=[];
    try{bars=JSON.parse(row[6]);if(bars.length&&typeof bars[0]==='string')bars=[bars];bars=bars.map(function(bar){return bar.map(validMove_);});}catch(error){bars=[];}
    items.push({groupName:key,theme:String(row[5]),number:Number(row[3]),createdAt:isNaN(new Date(date).getTime())?'':new Date(date),stamp:date,moves:bars,settingsSnapshot:jsonSnapshot_(row[8]),movesSnapshot:jsonSnapshot_(row[9])});
  });
  return items.sort(function(a,b){return b.stamp.localeCompare(a.stamp);});
}
function out_(v) { return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }

function jsonSnapshot_(value){try{return value?JSON.parse(value):null;}catch(e){return null;}}
function settingsLabel_(s){return s?s.durationSeconds+'초 · 준비 '+s.countdownSeconds+'초 · 민감도 '+s.sensitivity+' · '+(s.recordMode==='latest'?'마지막':'최고')+' 기록 · 재도전 '+(s.retryAllowed?s.retryLimit+'회':'불가')+' · 순위 '+(s.rankingVisible?'공개':'비공개')+' · 활동 '+(s.activityOpen?'열림':'닫힘'):'당시 설정 미저장';}
function movesLabel_(moves){return moves?moves.map(function(m){return m.symbol+' '+m.label;}).join(' / ')||'등록 동작 없음':'당시 동작 미저장';}
// 날짜별 탭 대신 하나의 원본에 반별 수업 스냅샷을 누적합니다. 같은 날 같은 설정은 재사용합니다.
function ensureLesson_(ss,g,c,reason,force){
 var sh=sheet_(ss,LESSONS,LESSON_HEAD),rows=sh.getDataRange().getValues(),key=classKey_(g,c),s=settings_(ss,key),moves=moves_(ss,key),now=new Date(),previous=null;
 for(var i=rows.length-1;i>0;i--)if(Number(rows[i][2])===g&&Number(rows[i][3])===c){previous=rows[i];break;}
 if(!force&&previous&&Utilities.formatDate(new Date(previous[1]),'Asia/Seoul','yyyy-MM-dd')===Utilities.formatDate(now,'Asia/Seoul','yyyy-MM-dd')&&previous[5]===JSON.stringify(s)&&previous[6]===JSON.stringify(moves))return {id:String(previous[0]),settings:s,moves:moves};
 var id=Utilities.getUuid();sh.appendRow([id,now.toISOString(),g,c,reason,JSON.stringify(s),JSON.stringify(moves)]);return {id:id,settings:s,moves:moves};
}

function currentLessonId_(ss,g,c){var rows=sheet_(ss,LESSONS,LESSON_HEAD).getDataRange().getValues();for(var i=rows.length-1;i>0;i--)if(Number(rows[i][2])===g&&Number(rows[i][3])===c){return Utilities.formatDate(new Date(rows[i][1]),'Asia/Seoul','yyyy-MM-dd')===Utilities.formatDate(new Date(),'Asia/Seoul','yyyy-MM-dd')?String(rows[i][0]):'';}return '';}
