// Provisional counts use a separate channel. They never enter the durable outbox.
export function createProgressSender({send,now=()=>Date.now(),uuid=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`,interval=2000}){
 let attempt=null,pending=null,running=false,lastSent=-Infinity;
 async function drain(){if(running)return;running=true;try{while(pending){const body=pending;pending=null;try{await send(body);}catch{/* Final records have their own durable delivery. */}}}finally{running=false;}}
 return {
  begin(identity,settings){attempt={...identity,lessonId:settings.lessonId,durationSeconds:settings.durationSeconds,id:uuid(),attemptStartedAt:now(),seq:0};lastSent=-Infinity;return attempt.id;},
  sample(count,elapsedSeconds,force=false){if(!attempt||!force&&now()-lastSent<interval)return;lastSent=now();pending={type:'recordProgress',...attempt,seq:++attempt.seq,count,elapsedSeconds};drain();},
  finish(count){if(!attempt)return null;const id=attempt.id;this.sample(count,attempt.durationSeconds,true);attempt=null;return id;},
  cancel(){if(!attempt)return;pending={type:'recordProgress',...attempt,seq:++attempt.seq,cancelled:true,count:0,elapsedSeconds:0};attempt=null;drain();}
 };
}
