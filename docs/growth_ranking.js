const seoulDay=value=>{const time=Date.parse(value);return Number.isFinite(time)?new Date(time+9*3600000).toISOString().slice(0,10):'';};
// Freeze the baseline before this lesson's day; today's retries never lower the PB.
export function improvementRanking(ranking,records,sessionId,durationSeconds){
 const current=records.filter(r=>(r.sessionId||r.lessonId)===sessionId&&Number(r.durationSeconds)===Number(durationSeconds));
 const days=current.map(r=>seoulDay(r.createdAt)).filter(Boolean).sort(),day=days[days.length-1];
 const prior=new Map();
 for(const record of records){
  if(!day||(record.sessionId||record.lessonId)===sessionId||Number(record.durationSeconds)!==Number(durationSeconds)||!seoulDay(record.createdAt)||seoulDay(record.createdAt)>=day||!Number.isFinite(Number(record.count)))continue;
  const key=Number(record.number),old=prior.get(key);
  if(!old||Number(record.count)>Number(old.count)||Number(record.count)===Number(old.count)&&record.createdAt>old.createdAt)prior.set(key,record);
 }
 const rows=ranking.map(row=>{const previous=prior.get(Number(row.number));return {...row,currentCount:row.count,previousCount:previous?Number(previous.count):null,previousAt:previous?.createdAt||null,delta:previous?row.count-Number(previous.count):null};}).sort((a,b)=>(a.delta===null)-(b.delta===null)||(b.delta??0)-(a.delta??0)||a.number-b.number);
 return rows.map(row=>({...row,rank:row.delta===null?null:1+rows.filter(other=>other.delta!==null&&other.delta>row.delta).length,count:row.delta}));
}
export function rankingPhase(rows,progress,settings,roster){
 const submitted=new Set(rows.map(r=>Number(r.number)));
 return settings.activityOpen===false||(roster?.numbers.length&&roster.numbers.every(n=>submitted.has(n))&&!progress.length)?'today':'live';
}
export function liveChartRows(ranking,progress=[],maxNumber=0){
 const by=new Map(ranking.map(row=>[row.number,{...row,measuring:false,waiting:false}]));
 for(const row of progress){const completed=by.get(row.number);by.set(row.number,{...completed,...row,finishedCount:completed?.count??null,measuring:true,waiting:false});}
 for(let number=1;number<=maxNumber;number++)if(!by.has(number))by.set(number,{number,count:0,attempts:0,waiting:true,measuring:false});
 const rows=[...by.values()].sort((a,b)=>b.count-a.count||Number(a.waiting)-Number(b.waiting)||a.number-b.number);
 return rows.map(row=>({...row,rank:row.waiting?null:1+rows.filter(other=>!other.waiting&&other.count>row.count).length}));
}
