// One request per ID. A lost response retries the same durable record, never a new ID.
export function createRecordDelivery({send,onAccepted,onError,onAttempt=()=>{},random=Math.random,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const running=new Map();
 function deliver(record){
  if(running.has(record.id))return running.get(record.id);
  const task=(async()=>{for(let attempt=0;attempt<3;attempt++){
   let result;onAttempt(record,attempt+1);
   try{result=await send(record);}
   catch(error){const permanent=/재도전 횟수|중복 기록|측정 시작 당시|활동이 닫|올바르지|반과 수업|설정 크기/.test(error.message||'');if(permanent||attempt===2){onError(record,error,{permanent,attempts:attempt+1});return false;}await wait(500*2**attempt+Math.floor(random()*700));continue;}
   onAccepted(record,result);return true;
  }return false;})().finally(()=>running.delete(record.id));running.set(record.id,task);return task;
 }
 return {deliver,get activeCount(){return running.size;}};
}

// A rejected/stalled record must never hold every later student record behind it.
export async function deliverOutbox(records,{deliver,eligible=()=>true}){
 const ordered=[...records].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 for(const record of ordered){if(!eligible(record))continue;try{await deliver(record);}catch{/* Preserve the record; continue with other IDs. */}}
}
