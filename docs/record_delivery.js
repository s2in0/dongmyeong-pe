// One request per ID. A lost response retries the same durable record, never a new ID.
export function createRecordDelivery({send,onAccepted,onError,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))}){
 const running=new Map();
 function deliver(record){
  if(running.has(record.id))return running.get(record.id);
  const task=(async()=>{for(let attempt=0;attempt<3;attempt++){
   try{const result=await send(record);onAccepted(record,result);return true;}
   catch(error){const permanent=/재도전 횟수|중복 기록|측정 시작 당시|활동이 닫|올바르지|반과 수업|설정 크기/.test(error.message||'');if(permanent||attempt===2){onError(record,error);return false;}await wait(500*2**attempt);}
  }return false;})().finally(()=>running.delete(record.id));running.set(record.id,task);return task;
 }
 return {deliver};
}
