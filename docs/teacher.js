import {recordDay,recordTime,filterRecords,summarizeRecords,recordsCsv} from './teacher_records.js?v=17';
import {createRankingMotion,showAnimatedCount,podiumGroups,reducedMotion} from './ranking_motion.js?v=19';
const $=id=>document.getElementById(id);
const DEFAULT_URL='https://script.google.com/macros/s/AKfycbzeU4BDW7u8fluc1OT5i-C1wYiMAHuzBT2myOpQbi89GcR6i8rHx5mLBVoWlT0IcRt6zQ/exec';
$('teacherUrl').value=localStorage.getItem('jumpy_teacher_url')||DEFAULT_URL;
let pin='',url='',timer=null,settingsDirty=false,medalsDirty=false,movesDirty=false,presenting=null,classRecords=[],loadedClass=null;
let recordView='students',recordsAvailable=false,recordDetails=new Set(),loadSequence=0,classLoading=false,classWritePending=false;
let latestRanking=[],rankingSettings=null,rankingScope='',rankFinalMode=false,finalSnapshot=null,finalTimers=[],pollTicks=0;
const rememberedClass=Number(localStorage.getItem('jumpy_teacher_class'));
if([1,2,3].includes(rememberedClass))$('tClass').value=rememberedClass;
const defaultMedals=[{id:'first-step',name:'첫 발걸음',type:'count',goal:10,image:'first-step'},{id:'silver-rhythm',name:'은빛 리듬',type:'count',goal:30,image:'silver-rhythm'},{id:'sky-jump',name:'하늘 점프',type:'count',goal:60,image:'sky-jump'},{id:'steady-star',name:'꾸준한 별',type:'attempts',goal:3,image:'steady-star'}];
const medalImages=['first-step','silver-rhythm','sky-jump','steady-star','fire-jump','moon-jump','rainbow-jump','crown-jump'];
let medalsDraft=defaultMedals.map(m=>({...m}));
const moveSymbols={'모아뛰기':'○','번갈아뛰기':'↔','엇걸기':'✕','옆뛰기':'◇'};
const defaultMoves=[{symbol:'○',label:'모아뛰기'},{symbol:'↔',label:'번갈아뛰기'},{symbol:'✕',label:'엇걸기'},{symbol:'◇',label:'옆뛰기'}];
let moveOptionsDraft=defaultMoves.map(m=>({...m}));
function number(id,min,max){const n=Number($(id).value);if(!Number.isInteger(n)||n<min||n>max)throw Error(`${id} 값을 확인해 주세요.`);return n}
async function api(body){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);try{const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:controller.signal,redirect:'follow'});const data=await response.json();if(!data.ok)throw Error(data.error||'요청 실패');return data}finally{clearTimeout(timeout)}}
const chosen=()=>({grade:number('tGrade',1,6),classNo:number('tClass',1,30)});
function fillSettings(s){$('duration').value=s.durationSeconds;$('countdownSetting').value=s.countdownSeconds;$('sensitivity').value=s.sensitivity;$('retryLimit').value=s.retryLimit;$('retryAllowed').checked=s.retryAllowed;$('recordMode').value=s.recordMode;$('rankingVisible').checked=s.rankingVisible;$('activityOpen').checked=s.activityOpen;settingsDirty=false}
function readSettings(){return {durationSeconds:number('duration',5,600),countdownSeconds:number('countdownSetting',0,15),sensitivity:$('sensitivity').value,retryLimit:number('retryLimit',0,20),retryAllowed:$('retryAllowed').checked,recordMode:$('recordMode').value,rankingVisible:$('rankingVisible').checked,activityOpen:$('activityOpen').checked}}
function element(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=String(text);return node}
function renderMoveEditor(){const editor=$('moveEditor');editor.replaceChildren();if(!moveOptionsDraft.length)editor.append(element('p','subtle','기본 동작이 없어요. 학생은 직접 만든 동작을 사용할 수 있어요.'));moveOptionsDraft.forEach((move,index)=>{const row=element('div','move-edit-row'),symbol=element('input'),label=element('input'),remove=element('button','move-remove','삭제');symbol.value=move.symbol;symbol.maxLength=8;symbol.placeholder='기호';symbol.setAttribute('aria-label',`${index+1}번째 동작 기호`);symbol.addEventListener('input',()=>{move.symbol=symbol.value;movesDirty=true});label.value=move.label;label.maxLength=20;label.placeholder='동작 이름';label.setAttribute('aria-label',`${index+1}번째 동작 이름`);label.addEventListener('input',()=>{move.label=label.value;movesDirty=true});remove.type='button';remove.onclick=()=>{moveOptionsDraft.splice(index,1);movesDirty=true;renderMoveEditor()};row.append(symbol,label,remove);editor.append(row)});$('addTeacherMove').disabled=moveOptionsDraft.length>=16}
$('addTeacherMove').onclick=()=>{if(moveOptionsDraft.length>=16)return;moveOptionsDraft.push({symbol:'',label:''});movesDirty=true;renderMoveEditor();$('moveEditor').querySelector('.move-edit-row:last-child input')?.focus()};
$('saveTeacherMoves').onclick=async()=>{if(classWritePending||classLoading)return;try{const options=moveOptionsDraft.map(m=>({symbol:m.symbol.trim(),label:m.label.trim()}));if(options.some(m=>!m.symbol||m.symbol.length>8||!m.label||m.label.length>20))throw Error('기호와 동작 이름을 모두 채워 주세요.');classWritePending=true;updateClassPicker();$('moveEditorStatus').textContent='저장하는 중…';$('saveTeacherMoves').disabled=true;const data=await api({type:'saveMoves',pin,...chosen(),moves:options});moveOptionsDraft=data.moveOptions.map(m=>({...m}));movesDirty=false;renderMoveEditor();$('moveEditorStatus').textContent='저장 완료 · 이 반 학생에게 적용됩니다.'}catch(e){$('moveEditorStatus').textContent=e.message.includes('알 수 없는 요청')?'저장 실패: 새 Apps Script 코드를 배포해 주세요.':`저장 실패: ${e.message}`}finally{classWritePending=false;updateClassPicker();$('saveTeacherMoves').disabled=false}};
function renderMedalEditor(){const editor=$('medalEditor');editor.replaceChildren();medalsDraft.forEach((medal,index)=>{const card=element('div','medal-edit-card'),image=element('img'),fields=element('div','medal-edit-fields'),nameWrap=element('label'),typeWrap=element('label'),goalWrap=element('label'),name=element('input'),type=element('select'),goal=element('input'),remove=element('button','medal-remove','삭제');image.src=`medals/${medal.image}.svg`;image.alt='';nameWrap.textContent='메달 이름';name.value=medal.name;name.maxLength=20;name.addEventListener('input',()=>{medal.name=name.value;medalsDirty=true});nameWrap.append(name);typeWrap.textContent='달성 기준';for(const [value,label] of [['count','최고 점프 횟수'],['attempts','도전 횟수']]){const option=element('option','',label);option.value=value;type.append(option)}type.value=medal.type;type.addEventListener('change',()=>{medal.type=type.value;medalsDirty=true});typeWrap.append(type);goalWrap.textContent='목표';goal.type='number';goal.min='1';goal.max='5000';goal.value=medal.goal;goal.addEventListener('input',()=>{medal.goal=goal.value;medalsDirty=true});goalWrap.append(goal);fields.append(nameWrap,typeWrap,goalWrap);remove.type='button';remove.disabled=medalsDraft.length===1;remove.onclick=()=>{medalsDraft.splice(index,1);medalsDirty=true;renderMedalEditor()};card.append(image,fields,remove);editor.append(card)});$('addMedal').disabled=medalsDraft.length>=8}
$('addMedal').onclick=()=>{const image=medalImages.find(key=>!medalsDraft.some(m=>m.image===key));if(!image)return;medalsDraft.push({id:image,image,name:'새 메달',type:'count',goal:80});medalsDirty=true;renderMedalEditor();$('medalStatus').textContent=''};
$('saveMedals').onclick=async()=>{try{const medals=medalsDraft.map(m=>({id:m.image,image:m.image,name:m.name.trim(),type:m.type,goal:Number(m.goal)}));if(medals.some(m=>!m.name||!Number.isInteger(m.goal)||m.goal<1||m.goal>(m.type==='count'?5000:100)))throw Error('메달 이름과 목표를 확인해 주세요.');$('medalStatus').textContent='저장하는 중…';$('saveMedals').disabled=true;const data=await api({type:'saveMedals',pin,medals});medalsDraft=data.medals.map(m=>({...m}));medalsDirty=false;renderMedalEditor();$('medalStatus').textContent='저장 완료 · 모든 반 학생에게 적용됩니다.'}catch(e){$('medalStatus').textContent=e.message.includes('알 수 없는 요청')?'저장 실패: 새 Apps Script 코드를 배포해 주세요.':`저장 실패: ${e.message}`}finally{$('saveMedals').disabled=false}};
const rankingMotion=createRankingMotion($('classRanking'),{
  build(row){const li=element('li','rank-entry'),place=element('span','rank-position'),student=element('strong','rank-student'),number=element('span','',`${row.number}번`),movement=element('small','rank-movement'),track=element('span','rank-track'),fill=element('span','rank-fill'),score=element('b','rank-score'),tries=element('small','rank-attempts');student.append(number,movement);track.append(fill);li.append(place,student,track,score,tries);li.rankParts={place,movement,fill,score,tries};return li},
  patch(li,row,old,{animate}){const {place,movement,fill,score,tries}=li.rankParts;place.textContent=`${row.rank}위`;tries.textContent=`${row.attempts}번 도전`;fill.style.width=`${Math.max(5,row.count/Math.max(1,latestRanking[0]?.count||1)*100)}%`;showAnimatedCount(score,row.count,{animate});const change=old?old.rank-row.rank:0;movement.textContent=animate&&change?`${change>0?'▲':'▼'} ${Math.abs(change)}`:'';movement.classList.toggle('rank-up',change>0);li.classList.toggle('rank-rising',animate&&change>0);li.setAttribute('aria-label',`${row.rank}위 ${row.number}번 ${row.count}회`)}
});
const livePodiumMotion=createRankingMotion($('rankPodium'),{
  getKey:group=>group.numbers.join('-'),
  build(){const card=element('div','podium-card'),place=element('span','podium-place'),student=element('strong','podium-student'),score=element('b','podium-score');card.append(place,student,score);card.rankParts={place,student,score};return card},
  patch(card,group,old,{animate}){const {place,student,score}=card.rankParts;card.className=`podium-card place-${group.rank}`;card.dataset.rank=group.rank;place.textContent=`${group.numbers.length>1?'공동 ':''}${group.rank}위`;student.textContent=group.numbers.map(number=>`${number}번`).join(' · ');showAnimatedCount(score,group.count,{animate})}
});
function renderLivePodium(rows,scope){livePodiumMotion.render(podiumGroups(rows),{key:scope})}
function renderRanking(rows,settings){
  const scope=`${$('tGrade').value}-${$('tClass').value}-${settings.durationSeconds}-${settings.recordMode}`;
  latestRanking=rows.map(row=>({...row}));rankingSettings={...settings};rankingScope=scope;
  $('rankRule').textContent=`${settings.durationSeconds}초 · ${settings.recordMode==='latest'?'마지막 기록':'최고기록'} 반영`;
  if(!rankFinalMode)$('rankLiveStatus').textContent='실시간 · 5초마다 갱신';
  $('showFinalRanking').disabled=!rows.length;renderLivePodium(rows,scope);
  if(!rows.length){rankingMotion.reset();$('classRanking').append(element('li','board-empty','아직 기록이 없어요.'));return}
  if($('classRanking').querySelector('.board-empty'))$('classRanking').replaceChildren();rankingMotion.render(rows,{key:scope});
}
function cancelFinalTimers(){for(const timer of finalTimers)clearTimeout(timer);finalTimers=[];for(const node of [$('finalRankCountdown'),...$('finalRankPodium').children])for(const animation of node.getAnimations?.()||[])animation.cancel()}
function leaveFinalRanking(){cancelFinalTimers();rankFinalMode=false;finalSnapshot=null;$('finalRankCountdown').classList.add('hidden');$('rankFinalStage').classList.add('hidden');$('rankLiveBoard').classList.remove('hidden');$('showFinalRanking').classList.remove('hidden');$('rankLiveStatus').textContent='실시간 · 5초마다 갱신';$('rankLiveStatus').classList.remove('ranking-paused')}
function playFinalRanking(){
  if(!finalSnapshot)return;cancelFinalTimers();rankFinalMode=true;$('rankLiveBoard').classList.add('hidden');$('rankFinalStage').classList.remove('hidden');$('showFinalRanking').classList.add('hidden');$('rankLiveStatus').textContent='최종 순위 발표';$('rankLiveStatus').classList.add('ranking-paused');
  const still=reducedMotion(),countdown=$('finalRankCountdown');
  $('finalRankTitle').textContent=still?'최종 순위':'곧 최종 순위를 발표합니다';$('finalRankRule').textContent=finalSnapshot.rule;const podium=$('finalRankPodium');podium.replaceChildren();
  countdown.classList.toggle('hidden',still);
  if(!still){
    const tick=value=>{countdown.textContent=String(value);countdown.animate?.([{opacity:0,transform:'scale(.75)'},{opacity:1,transform:'scale(1)',offset:.35},{opacity:0,transform:'scale(1.12)'}],{duration:900,easing:'ease-out'})};
    tick(3);finalTimers.push(setTimeout(()=>tick(2),1000),setTimeout(()=>tick(1),2000),setTimeout(()=>{countdown.classList.add('hidden');$('finalRankTitle').textContent='최종 순위'},3000));
  }
  const groups=podiumGroups(finalSnapshot.rows).sort((a,b)=>b.rank-a.rank);
  for(const [index,group] of groups.entries()){
    const card=element('div',`podium-card place-${group.rank} final-winner-card`),place=element('span','final-place-badge',`${group.rank}`),caption=element('span','podium-place',`${group.numbers.length>1?'공동 ':''}${group.rank}등`),student=element('strong','podium-student',group.numbers.map(number=>`${number}번`).join(' · ')),score=element('b','podium-score','0회');score.dataset.count='0';card.setAttribute('aria-hidden','true');card.append(place,caption,student,score);podium.append(card);
    const reveal=()=>{card.classList.add('winner-revealed');card.setAttribute('aria-hidden','false');showAnimatedCount(score,group.count,{animate:true,duration:650});$('finalRankTitle').textContent=index===groups.length-1?'우리 반 최종 순위':`${group.numbers.length>1?'공동 ':''}${group.rank}등`;if(!reducedMotion()){card.animate?.([{opacity:0,transform:'translateY(80px) scale(.85)'},{opacity:1,transform:'translateY(-8px) scale(1.025)',offset:.8},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:720,easing:'cubic-bezier(.16,1,.3,1)'});if(group.rank===1)winnerBurst(card)}};
    if(still)reveal();else finalTimers.push(setTimeout(reveal,3300+index*1600));
  }
}
function winnerBurst(card){const burst=element('span','winner-burst');burst.setAttribute('aria-hidden','true');for(let index=0;index<16;index++){const piece=element('i');piece.style.setProperty('--burst-angle',`${index*22.5}deg`);piece.style.setProperty('--burst-delay',`${index%4*25}ms`);burst.append(piece)}card.append(burst);finalTimers.push(setTimeout(()=>burst.remove(),1600))}
$('showFinalRanking').onclick=async()=>{if(!latestRanking.length)return;$('showFinalRanking').disabled=true;try{const data=await loadClass(false,true,true);if(!data||$('rankingCard').classList.contains('hidden'))return;if(!latestRanking.length){$('rankLiveStatus').textContent='발표할 기록이 없어요.';return}finalSnapshot={rows:latestRanking.map(row=>({...row})),scope:rankingScope,rule:`${$('classTitle').textContent} · ${$('rankRule').textContent}`};playFinalRanking()}catch(error){$('rankLiveStatus').textContent=`순위 확인 실패: ${error.message}`}finally{$('showFinalRanking').disabled=!latestRanking.length}};
$('replayFinalRanking').onclick=playFinalRanking;$('backToLiveRanking').onclick=()=>{leaveFinalRanking();loadClass(false,true).catch(()=>{})};
function filteredRecords(){return filterRecords(classRecords,{day:$('recordDate').value,duration:$('recordDuration').value,number:$('recordNumber').value})}
function changeText(change){return change===null?'—':`${change>0?'+':''}${change}회`}
function renderRecordHistory(rows,body){for(const row of rows){const tr=element('tr');for(const value of [recordTime(row.createdAt),`${row.number}번`,`${row.count}회`,`${row.durationSeconds}초`])tr.append(element('td','',value));body.append(tr)}}
function renderRecords(){
  const body=$('classRecords'),records=filteredRecords(),head=element('tr');body.replaceChildren();
  const labels=recordView==='students'?['번호','제한시간','최고기록','최근기록','이전 대비','도전','최근 측정일','이력']:['측정일','번호','횟수','제한시간'];
  for(const label of labels){const th=element('th','',label);th.scope='col';head.append(th)}$('recordTableHead').replaceChildren(head);
  $('recordCaption').textContent=`${loadedClass?.grade||1}학년 ${loadedClass?.classNo||$('tClass').value}반 · ${recordView==='students'?'학생별 요약':'전체 도전 이력'}`;
  $('recordBackendStatus').classList.toggle('hidden',recordsAvailable);
  $('recordBackendStatus').textContent=recordsAvailable?'':'반별 기록을 보려면 새 Apps Script 코드를 배포해 주세요.';
  $('downloadRecords').disabled=!recordsAvailable||!records.length;
  $('recordPeople').textContent=recordsAvailable?`${new Set(records.map(r=>r.number)).size}명`:'—';
  $('recordAttempts').textContent=recordsAvailable?`${records.length}회`:'—';
  const durations=new Set(records.map(r=>r.durationSeconds));
  $('recordBestLabel').textContent=durations.size===1?`${[...durations][0]}초 최고기록`:'최고기록';
  $('recordBest').textContent=!recordsAvailable||!records.length?'—':durations.size>1?'시간별 확인':`${Math.max(...records.map(r=>r.count))}회`;
  const scope=$('recordDate').value||'전체 날짜';
  $('recordSummary').textContent=recordsAvailable?`${scope} · ${$('recordDuration').value?$('recordDuration').value+'초':'모든 제한시간'} · 같은 제한시간끼리 비교`:'';
  if(!records.length){const row=element('tr'),cell=element('td','board-empty',recordsAvailable?'선택한 조건의 기록이 없어요.':'기록 연결을 기다리고 있어요.');cell.colSpan=labels.length;row.append(cell);body.append(row);return}
  if(recordView==='history'){renderRecordHistory(records,body);return}
  for(const summary of summarizeRecords(records)){
    const row=element('tr','student-record-row'),change=element('td',summary.change>0?'record-improved':'',changeText(summary.change));
    for(const value of [`${summary.number}번`,`${summary.durationSeconds}초`,`${summary.best}회`,`${summary.latest}회`])row.append(element('td','',value));
    row.append(change,element('td','',`${summary.attempts}회`),element('td','record-date-cell',recordTime(summary.createdAt)));
    const cell=element('td'),button=element('button','record-detail-button',recordDetails.has(summary.key)?'닫기':'보기');button.type='button';button.setAttribute('aria-expanded',String(recordDetails.has(summary.key)));button.setAttribute('aria-label',`${summary.number}번 ${summary.durationSeconds}초 도전 이력`);
    button.onclick=()=>{if(recordDetails.has(summary.key))recordDetails.delete(summary.key);else recordDetails.add(summary.key);renderRecords()};cell.append(button);row.append(cell);body.append(row);
    if(recordDetails.has(summary.key)){const detailRow=element('tr','record-detail-row'),detailCell=element('td'),list=element('ol','record-detail-list');detailCell.colSpan=labels.length;for(const record of summary.history){const item=element('li'),date=element('span','',recordTime(record.createdAt)),count=element('strong','',`${record.count}회`);item.append(date,count);list.append(item)}detailCell.append(list);detailRow.append(detailCell);body.append(detailRow)}
  }
}
function setRecordOptions(id,values,label,selected){const select=$(id),all=element('option','','전체');all.value='';select.replaceChildren(all);for(const value of values){const option=element('option','',label(value));option.value=value;select.append(option)}select.value=[...select.options].some(option=>option.value===String(selected))?selected:''}
function setRecords(records,id,settings,classChanged){
  recordsAvailable=Array.isArray(records);classRecords=recordsAvailable?records:[];loadedClass=id;
  const duration=classChanged?String(settings.durationSeconds):$('recordDuration').value,number=classChanged?'':$('recordNumber').value;
  if(classChanged){$('recordDate').value='';recordDetails.clear()}
  setRecordOptions('recordDuration',[...new Set([settings.durationSeconds,...classRecords.map(row=>row.durationSeconds)])].sort((a,b)=>a-b),value=>`${value}초`,duration);
  setRecordOptions('recordNumber',[...new Set(classRecords.map(row=>row.number))].sort((a,b)=>a-b),value=>`${value}번`,number);renderRecords();
}
for(const id of ['recordDate','recordDuration','recordNumber'])$(id).addEventListener('input',()=>{recordDetails.clear();renderRecords()});
$('clearRecordFilters').onclick=()=>{$('recordDate').value='';$('recordDuration').value='';$('recordNumber').value='';recordDetails.clear();renderRecords()};
$('todayRecords').onclick=()=>{$('recordDate').value=recordDay(new Date());recordDetails.clear();renderRecords()};
function setRecordView(view){recordView=view;for(const [id,mode] of [['recordStudentsView','students'],['recordHistoryView','history']]){$(id).classList.toggle('active',view===mode);$(id).setAttribute('aria-pressed',String(view===mode))}renderRecords()}
$('recordStudentsView').onclick=()=>setRecordView('students');$('recordHistoryView').onclick=()=>setRecordView('history');
$('downloadRecords').onclick=()=>{if(!loadedClass||!recordsAvailable)return;const blob=new Blob([recordsCsv(filteredRecords(),loadedClass,recordView)],{type:'text/csv;charset=utf-8'}),href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download=`JUMPY_${loadedClass.grade}학년_${loadedClass.classNo}반_${$('recordDate').value||'전체'}_${recordView==='students'?'학생요약':'도전이력'}.csv`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1000)};
function renderMusic(rows){const wall=$('musicSubmissions');wall.replaceChildren();if(!rows.length){wall.append(element('p','board-empty','아직 제출한 조가 없어요.'));return}
  rows.forEach((row,index)=>{const card=element('article','music-note'),header=element('div','music-note-head'),icon=element('span','music-note-icon','♫'),name=element('h3','',row.groupName),theme=element('p','music-note-theme',row.theme),bars=element('div','music-note-bars'),foot=element('div','music-note-foot');header.append(icon,name);const moves=Array.isArray(row.moves?.[0])?row.moves:[row.moves||[]];moves.forEach((bar,barIndex)=>{const line=element('div','music-note-line'),title=element('span','music-line-title',`${barIndex+1}줄`),beats=element('div','music-note-beats');for(const [beatIndex,move] of bar.entries()){const symbol=typeof move==='string'?moveSymbols[move]||move:move?.symbol||'',label=typeof move==='string'?move:move?.label||'';const chip=element('span','music-beat'),mark=element('b','',symbol),caption=element('small','music-beat-name',label);chip.title=`${beatIndex+1}박 · ${label}`;chip.setAttribute('aria-label',`${beatIndex+1}박 ${label}`);chip.append(mark,caption);beats.append(chip)}line.append(title,beats);bars.append(line)});foot.textContent=`${row.number}번 제출 · ${moves.length}줄`;card.append(header,theme,bars,foot);wall.append(card)})
}
function updateClassPicker(){for(const button of document.querySelectorAll('[data-class]')){const active=button.dataset.class===$('tClass').value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));button.disabled=classWritePending}}
function setClassLoading(value,quiet=false){classLoading=value;$('teacherMain').inert=value&&!quiet;$('teacherMain').classList.toggle('class-loading',value&&!quiet);$('teacherMain').setAttribute('aria-busy',String(value&&!quiet))}
async function loadClass(resetSettings=false,quiet=false,force=false){
  if(classWritePending||(!resetSettings&&classLoading&&!force))return null;
  const sequence=++loadSequence,id=chosen();setClassLoading(true,quiet);updateClassPicker();
  if(!quiet)$('teacherStatus').textContent=`${id.grade}학년 ${id.classNo}반 불러오는 중…`;
  try{
    const data=await api({type:'teacherData',pin,...id});if(sequence!==loadSequence||!pin)return null;
    const classChanged=!loadedClass||loadedClass.grade!==id.grade||loadedClass.classNo!==id.classNo;
    if(classChanged)leaveFinalRanking();
    $('classTitle').textContent=`${id.grade}학년 ${id.classNo}반`;$('participantCount').textContent=`${data.participants.length}명`;$('classBest').textContent=data.ranking.length?`${data.ranking[0].count}회`:'—';$('musicCount').textContent=`${data.music.length}조`;
    renderRanking(data.ranking,data.settings);renderMusic(data.music);setRecords(data.records,id,data.settings,classChanged);
    if(classChanged||resetSettings||!settingsDirty)fillSettings(data.settings);
    if(classChanged||resetSettings||!movesDirty){moveOptionsDraft=(Array.isArray(data.moveOptions)?data.moveOptions:defaultMoves).map(move=>({...move}));movesDirty=false;renderMoveEditor()}
    if(!medalsDirty){medalsDraft=(Array.isArray(data.medals)&&data.medals.length?data.medals:defaultMedals).map(medal=>({...medal}));renderMedalEditor()}
    if(classChanged){$('saveStatus').textContent='';$('moveEditorStatus').textContent=''}
    localStorage.setItem('jumpy_teacher_class',id.classNo);$('teacherStatus').textContent=data.sheetViewWarning||`${new Date().toLocaleTimeString('ko-KR')} 업데이트`;return data;
  }catch(error){if(sequence!==loadSequence)return null;if(loadedClass){$('tGrade').value=loadedClass.grade;$('tClass').value=loadedClass.classNo;updateClassPicker()}$('teacherStatus').textContent=`조회 실패: ${error.message}`;throw error}
  finally{if(sequence===loadSequence)setClassLoading(false)}
}
for(const button of document.querySelectorAll('[data-class]'))button.onclick=()=>{if(classWritePending)return;exitPresentation();leaveFinalRanking();$('tClass').value=button.dataset.class;loadClass(true).catch(()=>{})};
updateClassPicker();
function showTab(id){exitPresentation();if(id!=='rankingCard')leaveFinalRanking();for(const pane of document.querySelectorAll('.teacher-pane'))pane.classList.toggle('hidden',pane.id!==id);for(const button of document.querySelectorAll('[data-teacher-tab]')){const active=button.dataset.teacherTab===id;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active))}if(id==='rankingCard')loadClass(false,true).catch(()=>{})}
function pollClass(){if(!pin||document.hidden||rankFinalMode)return;pollTicks++;if(!$('rankingCard').classList.contains('hidden')||pollTicks%6===0)loadClass(false,true).catch(()=>{})}
for(const button of document.querySelectorAll('[data-teacher-tab]'))button.onclick=()=>showTab(button.dataset.teacherTab);
function exitPresentation(){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});if(presenting){presenting.classList.remove('presenting');presenting.querySelector('.presentation-button').textContent='⛶ 전체화면';presenting=null}document.body.classList.remove('presenting-board')}
async function togglePresentation(id){const panel=$(id);if(presenting===panel){exitPresentation();return}exitPresentation();presenting=panel;panel.classList.add('presenting');document.body.classList.add('presenting-board');panel.querySelector('.presentation-button').textContent='✕ 전체화면 닫기';try{if(panel.requestFullscreen)await panel.requestFullscreen()}catch{/* CSS presentation remains available when the browser denies fullscreen. */}}
$('rankFullscreen').onclick=()=>togglePresentation('rankingCard');$('musicFullscreen').onclick=()=>togglePresentation('musicCard');
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&presenting)exitPresentation()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&presenting)exitPresentation()});
for(const field of $('settingsCard').querySelectorAll('input,select')){field.addEventListener('input',()=>{settingsDirty=true});field.addEventListener('change',()=>{settingsDirty=true})}
$('teacherEnter').onclick=async()=>{pin=$('teacherPin').value.trim();url=$('teacherUrl').value.trim();if(!pin||!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(url)){$('loginStatus').textContent='PIN과 /exec 주소를 확인해 주세요.';return}try{$('teacherEnter').disabled=true;$('loginStatus').textContent='로그인하는 중…';const data=await loadClass(true);if(!data)return;localStorage.setItem('jumpy_teacher_url',url);$('teacherPin').value='';$('teacherLogin').classList.add('hidden');$('teacherContent').classList.remove('hidden');showTab('settingsCard');clearInterval(timer);pollTicks=0;timer=setInterval(pollClass,5000)}catch(e){$('loginStatus').textContent=e.message.includes('알 수 없는 요청')?'Apps Script 주소에 구버전이 연결되어 있어요. 배포 주소를 확인해 주세요.':e.message;pin=''}finally{$('teacherEnter').disabled=false}};
$('copyStudentLink').onclick=async()=>{const link=new URL('./',location.href);link.searchParams.set('sheet',url);try{await navigator.clipboard.writeText(link.href);$('teacherStatus').textContent='학생용 링크를 복사했습니다.'}catch{$('teacherStatus').textContent='학생용 링크: '+link.href}};
$('refreshClass').onclick=()=>loadClass().catch(()=>{});
$('saveSettings').onclick=async()=>{if(classWritePending||classLoading)return;try{const settings=readSettings();classWritePending=true;updateClassPicker();$('saveSettings').disabled=true;$('saveStatus').textContent='저장하는 중…';await api({type:'saveSettings',pin,...chosen(),settings});settingsDirty=false;$('saveStatus').textContent='설정 저장 완료'}catch(e){$('saveStatus').textContent=`저장 실패: ${e.message}`}finally{classWritePending=false;updateClassPicker();$('saveSettings').disabled=false}if(pin)loadClass().catch(()=>{})};
$('teacherLogout').onclick=()=>{pin='';loadSequence++;setClassLoading(false);clearInterval(timer);exitPresentation();leaveFinalRanking();classRecords=[];loadedClass=null;recordsAvailable=false;recordDetails.clear();renderRecords();renderRanking([],{durationSeconds:30,recordMode:'best'});renderMusic([]);$('teacherContent').classList.add('hidden');$('teacherLogin').classList.remove('hidden');$('loginStatus').textContent=''};
