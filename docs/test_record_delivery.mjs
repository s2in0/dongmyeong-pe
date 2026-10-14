import assert from 'node:assert/strict';
import {createRecordDelivery} from './record_delivery.js';
let calls=0,accepted=[],errors=[],release,first=true;
const delivery=createRecordDelivery({send:async record=>{calls++;if(record.id==='slow')await new Promise(resolve=>release=resolve);if(record.id==='lost'&&first){first=false;throw Error('Network response lost');}return {ok:true,id:record.id};},onAccepted:r=>accepted.push(r.id),onError:r=>errors.push(r.id),wait:async()=>{}});
const old=delivery.deliver({id:'slow'});assert.equal(delivery.deliver({id:'slow'}),old);
await delivery.deliver({id:'new'});assert.deepEqual(accepted,['new'],'The newest finish does not wait for older uploads.');release();await old;
await delivery.deliver({id:'lost'});assert.equal(calls,4,'Lost responses retry the same ID.');assert.deepEqual(errors,[]);
let retries=0;const rejected=createRecordDelivery({send:async()=>{retries++;throw Error('재도전 횟수를 모두 사용했습니다.');},onAccepted:()=>assert.fail(),onError:()=>{},wait:async()=>{}});assert.equal(await rejected.deliver({id:'invalid'}),false);assert.equal(retries,1);
console.log('Record delivery passed: same-ID single flight, priority finish, lost-response retry and permanent rejection without retry loops.');
