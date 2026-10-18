export function improvementRanking(ranking,records,sessionId,durationSeconds){
 const prior=new Map(),currentTimes=records.filter(r=>(r.sessionId||r.lessonId)===sessionId).map(r=>Date.parse(r.createdAt)).filter(Number.isFinite),cutoff=currentTimes.length?Math.min(...currentTimes):Infinity;
 for(const record of records){if((record.sessionId||record.lessonId)===sessionId||Number(record.durationSeconds)!==Number(durationSeconds)||Date.parse(record.createdAt)>=cutoff)continue;const old=prior.get(record.number);if(!old||record.createdAt>old.createdAt||record.createdAt===old.createdAt&&String(record.id)>String(old.id))prior.set(record.number,record);}
 const rows=ranking.map(row=>{const previous=prior.get(row.number);return {...row,currentCount:row.count,previousCount:previous?previous.count:null,previousAt:previous?.createdAt||null,delta:previous?row.count-previous.count:null};}).sort((a,b)=>(a.delta===null)-(b.delta===null)||(b.delta??0)-(a.delta??0)||a.number-b.number);
 return rows.map(row=>({...row,rank:row.delta===null?null:1+rows.filter(other=>other.delta!==null&&other.delta>row.delta).length,count:row.delta}));
}
export function liveChartRows(ranking,progress=[],maxNumber=0){
 const by=new Map(ranking.map(row=>[row.number,{...row,measuring:false,waiting:false}]));
 for(const row of progress){const completed=by.get(row.number);by.set(row.number,{...completed,...row,finishedCount:completed?.count??null,measuring:true,waiting:false});}
 for(let number=1;number<=maxNumber;number++)if(!by.has(number))by.set(number,{number,count:0,attempts:0,waiting:true,measuring:false});
 const rows=[...by.values()].sort((a,b)=>b.count-a.count||Number(a.waiting)-Number(b.waiting)||a.number-b.number);
 return rows.map(row=>({...row,rank:row.waiting?null:1+rows.filter(other=>!other.waiting&&other.count>row.count).length}));
}
