const dayFormatter = new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'});
const timeFormatter = new Intl.DateTimeFormat('ko-KR', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});

export function recordDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = dayFormatter.formatToParts(date);
  return ['year','month','day'].map(key=>parts.find(part=>part.type===key).value).join('-');
}

export function recordTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : timeFormatter.format(date);
}

export function filterRecords(records, {day='',duration='',number=''} = {}) {
  return records.filter(row=>(!day||recordDay(row.createdAt)===day)&&(!duration||Number(row.durationSeconds)===Number(duration))&&(!number||Number(row.number)===Number(number)))
    .sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt)||a.number-b.number);
}

// A student's records with different time limits are always separate groups.
export function summarizeRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.number}-${record.durationSeconds}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.entries()].map(([key,rows])=>{
    const history = filterRecords(rows), latest = history[0], previous = history[1];
    return {key,number:latest.number,durationSeconds:latest.durationSeconds,best:Math.max(...rows.map(row=>row.count)),latest:latest.count,change:previous?latest.count-previous.count:null,attempts:rows.length,createdAt:latest.createdAt,history};
  }).sort((a,b)=>a.number-b.number||a.durationSeconds-b.durationSeconds);
}

export function recordsCsv(records, identity, view='students') {
  const lines = view==='students'
    ? [['학년','반','번호','제한시간(초)','최고기록','최근기록','이전 대비','도전 횟수','최근 측정일'],...summarizeRecords(records).map(row=>[identity.grade,identity.classNo,row.number,row.durationSeconds,row.best,row.latest,row.change??'',row.attempts,recordTime(row.createdAt)])]
    : [['측정일','학년','반','번호','횟수','제한시간(초)'],...filterRecords(records).map(row=>[recordTime(row.createdAt),identity.grade,identity.classNo,row.number,row.count,row.durationSeconds])];
  return '\ufeff'+lines.map(row=>row.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',')).join('\r\n');
}
