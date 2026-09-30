const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(__dirname+'/apps_script.gs','utf8'),context);
const settings={durationSeconds:30,recordMode:'best'};
const rows=[
 {number:2,count:70,durationSeconds:30,createdAt:'2026-09-30T00:00:00.000Z'},
 {number:2,count:50,durationSeconds:30,createdAt:'2026-09-30T00:01:00.000Z'},
 {number:1,count:70,durationSeconds:30,createdAt:'2026-09-30T00:02:00.000Z'},
 {number:1,count:999,durationSeconds:60,createdAt:'2026-09-30T00:03:00.000Z'},
 {number:3,count:0,durationSeconds:30,createdAt:'2026-09-30T00:04:00.000Z'},
 {number:4,count:10,durationSeconds:60,createdAt:'2026-09-30T00:04:00.000Z'}
];
const summary=JSON.parse(JSON.stringify(context.classSummary_(rows,settings)));
assert.equal(summary.participants,3);assert.equal(summary.best,70);
assert.deepEqual(summary.rows[0].slice(0,5),[1,70,70,'—',1]);
assert.deepEqual(summary.rows[1].slice(0,5),[2,70,50,-20,2]);
assert.equal(summary.rows[0][6],1);assert.equal(summary.rows[1][6],1);
assert.equal(summary.rows[2][1],0);assert.equal(summary.rows[2][6],3);
assert.equal(summary.rows[3][4],0);assert.equal(summary.rows[3][6],'—');
assert.equal(summary.rows[1][5],'2026-09-30T00:01:00.000Z');
const latest=JSON.parse(JSON.stringify(context.classSummary_(rows,{...settings,recordMode:'latest'})));
assert.equal(latest.rows[1][6],2);assert.equal(latest.rows[1][7],50);
assert.equal(latest.best,70);
assert.equal(context.classSummary_([],settings).participants,0);
let writes=0;
context.HEAD=['id','createdAt','grade','classNo','number','count','durationSeconds','countdownSeconds','sensitivity','misses','bestStreak'];
const occupied={getLastRow:()=>1,getDeveloperMetadata:()=>[]};
assert.throws(()=>context.updateClassSheets_({getSheetByName:name=>name==='1학년 2반'?occupied:null,insertSheet(){writes++}}),/기존 자료/);
assert.equal(writes,0,'All existing class tabs are checked before writing any sheet.');
context.updateClassSheets_=()=>{throw Error('view failed')};
const saved=context.updateClassSheetsSafe_({}, {ok:true,createdAt:'saved'});
assert.equal(saved.ok,true);assert.match(saved.sheetViewWarning,/view failed/);
console.log('Class summaries passed: class scope inputs, duration separation, best/latest ranking, ties, zero scores, prior attempt changes, dates, empty records and original-data preservation.');
