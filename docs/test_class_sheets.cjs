const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const properties={};
const context=vm.createContext({PropertiesService:{getScriptProperties:()=>({getProperties:()=>({...properties}),setProperty:(key,value)=>{properties[key]=value}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,text)=>crypto.createHash('sha256').update(text).digest(),base64Encode:bytes=>Buffer.from(bytes).toString('base64')}});
vm.runInContext(fs.readFileSync(__dirname+'/apps_script.gs','utf8'),context);
class Range {
 constructor(sheet,row,col,rows=1,cols=1){Object.assign(this,{sheet,row,col,rows,cols})}
 getValues(){return Array.from({length:this.rows},(_,r)=>Array.from({length:this.cols},(_,c)=>this.sheet.data[this.row+r-1]?.[this.col+c-1]??''))}
 getValue(){return this.getValues()[0][0]}
 setValues(values){values.forEach((row,r)=>row.forEach((value,c)=>{this.sheet.data[this.row+r-1]??=[];this.sheet.data[this.row+r-1][this.col+c-1]=value}));this.sheet.writes++;return this}
 setValue(value){return this.setValues([[value]])}
 clearContent(){return this.setValues(Array.from({length:this.rows},()=>Array(this.cols).fill('')))}
}
for(const method of ['merge','setBackground','setFontColor','setFontWeight','setFontSize','setNumberFormat','setWrap'])Range.prototype[method]=function(){return this};
class Sheet {
 constructor(name,data=[]){this.name=name;this.data=data;this.meta=[];this.writes=0;this.maxRows=1000}
 getLastRow(){let end=this.data.length;while(end&&!this.data[end-1]?.some(value=>value!==''&&value!==undefined))end--;return end}
 getDataRange(){return new Range(this,1,1,Math.max(1,this.getLastRow()),Math.max(1,...this.data.map(row=>row.length)))}
 getRange(row,col,rows,cols){if(typeof row==='string'){const match=row.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);const num=letters=>[...letters].reduce((sum,c)=>sum*26+c.charCodeAt(0)-64,0);return new Range(this,+match[2],num(match[1]),match[4]?+match[4]-+match[2]+1:1,match[3]?num(match[3])-num(match[1])+1:1)}return new Range(this,row,col,rows,cols)}
 getDeveloperMetadata(){return this.meta}
 addDeveloperMetadata(key,value){this.meta.push({getKey:()=>key,getValue:()=>value});return this}
 appendRow(row){this.data.push(row);return this}
 getMaxRows(){return this.maxRows}
 insertRowsAfter(_,count){this.maxRows+=count}
}
for(const method of ['setFrozenRows','setTabColor','setColumnWidths','setColumnWidth'])Sheet.prototype[method]=function(){return this};
const raw=new Sheet('기록',[Array.from(context.HEAD),['a','2026-09-30T00:00:00Z',1,1,2,70,30,3,'보통',0,70],['b','2026-09-30T00:01:00Z',1,1,2,50,60,2,'높음',1,30],['c','2026-09-30T00:02:00Z',1,2,3,0,45,3,'낮음',0,0]]);
const settings=new Sheet('설정',[['key','json'],['1-1',JSON.stringify({...context.DEFAULTS,durationSeconds:60})],['1-2',JSON.stringify({...context.DEFAULTS,durationSeconds:45})],['__moves__1-2',JSON.stringify([{symbol:'☆',label:'반2 동작'}])]]);
const music=new Sheet('음악줄넘기',[['createdAt','grade','classNo','number','groupName','theme','moves'],['2026-09-30T00:00:00Z',1,1,2,'같은 조명','반1 주제',JSON.stringify(['모아뛰기','모아뛰기','모아뛰기','모아뛰기'])],['2026-09-30T00:00:00Z',1,2,3,'같은 조명','반2 주제',JSON.stringify(['엇걸기','엇걸기','엇걸기','엇걸기'])]]);
const sheets=new Map([['기록',raw],['설정',settings],['음악줄넘기',music]]),ss={getId:()=> 'test-sheet',getSheetByName:name=>sheets.get(name),insertSheet(name){const sh=new Sheet(name);sheets.set(name,sh);return sh}};
context.updateClassSheets_(ss);
const first=sheets.get('1학년 1반'),second=sheets.get('1학년 2반'),third=sheets.get('1학년 3반');
assert.deepEqual(first.data[5].slice(1,6),[2,50,60,2,'높음']);
assert.equal(first.data[6][3],30,'All time limits are preserved together.');
assert.equal(second.data[5][2],0,'Zero is a saved attempt.');
assert(first.data[1][0].includes('60초'));assert(second.data[1][0].includes('45초'));
assert(first.data.flat().includes('반1 주제'));assert(!first.data.flat().includes('반2 주제'));
assert(second.data.flat().includes('반2 동작'));assert(!first.data.flat().includes('반2 동작'));
assert.equal(third.data[5][0],'아직 기록이 없습니다.');
const priorWrites=first.writes,priorRaw=JSON.stringify(raw.data);
context.updateClassSheets_(ss);assert.equal(first.writes,priorWrites,'Unchanged polling does not rewrite the class sheet.');
raw.appendRow(['d','2026-09-30T00:03:00Z',1,1,5,99,90,5,'보통',0,99]);
context.updateClassSheets_(ss);assert.equal(first.data[5][1],5);assert.equal(first.data[5][3],90);
music.appendRow(['2026-09-30T00:04:00Z',1,1,2,'같은 조명','=새 주제',JSON.stringify(['모아뛰기','모아뛰기','모아뛰기','모아뛰기'])]);
context.updateClassSheets_(ss);assert(first.data.flat().includes("'=새 주제"));assert(!first.data.flat().includes('반1 주제'));
assert.equal(JSON.stringify(raw.data.slice(0,-1)),priorRaw,'Source records remain unchanged.');
const occupied=new Sheet('1학년 2반',[['교사가 적은 자료']]);
assert.throws(()=>context.updateClassSheets_({getSheetByName:name=>name==='1학년 2반'?occupied:null}),/기존 자료/);
context.updateClassSheets_=()=>{throw Error('view failed')};assert.equal(context.updateClassSheetsSafe_({}, {ok:true}).ok,true);
console.log('Class sheets passed: all-duration chronology, zero scores, class-specific settings/moves/music, automatic updates, idempotent polling, safe text and source preservation.');
