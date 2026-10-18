// Separate record keys survive stale whole-app snapshots written by another tab.
export function createPendingRecords(storage){
 const prefix='jumpy_record_pending_',ackPrefix='jumpy_record_received_';let healthy=true;
 const get=key=>{try{return storage.getItem(key);}catch{healthy=false;return null;}};
 return {
  get healthy(){return healthy;},
  restore(legacy=[]){
   const records=new Map();for(const record of legacy){if(!record?.id||get(ackPrefix+record.id))continue;records.set(record.id,record);try{const raw=JSON.stringify(record);if(get(prefix+record.id)!==raw)storage.setItem(prefix+record.id,raw);}catch{healthy=false;}}
   try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key?.startsWith(prefix))continue;try{const record=JSON.parse(storage.getItem(key));if(record?.id&&!get(ackPrefix+record.id))records.set(record.id,record);}catch{}}}catch{healthy=false;}
   return [...records.values()].filter(record=>!get(ackPrefix+record.id));
  },
  acknowledge(id){try{storage.setItem(ackPrefix+id,String(Date.now()));}catch{healthy=false;}try{storage.removeItem(prefix+id);}catch{healthy=false;}}
 };
}
