// Replay real-video pose tracks through the SAME helpers used by the classroom app.
// Usage: node tools/evaluate_web_counter.cjs [--baseline /path/to/old/jump_counter.js]
const fs=require('node:fs'),path=require('node:path');
const lib=require('../docs/jump_counter.js');
const baselineIndex=process.argv.indexOf('--baseline');
const old=baselineIndex>=0?require(path.resolve(process.argv[baselineIndex+1])):null;
const directory=path.join(__dirname,'../docs/fixtures/jump-counter');
const rows=[];
for(const name of fs.readdirSync(directory).filter(n=>n.endsWith('.json'))){
 const f=JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));
 const counter=lib.createClassroomCounter('보통'),before=old?new old.JumpCounter({threshold:.05,minInterval:.2,requireFeet:true,rhythmMin:1,missCorrection:false}):null;
 for(const[t,points]of f.frames){
  let p=null;
  if(points){p=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));f.indices.forEach((index,i)=>{p[index]={x:points[i][0],y:points[i][1],visibility:points[i][2]}});}
  counter.update(t,lib.measurementSignal(p,f.width,f.height));
  if(before){const full=p&&[11,12,23,24,27,28].every(i=>p[i].visibility>=.7&&p[i].x>.02&&p[i].x<.98&&p[i].y>.02&&p[i].y<.98);before.update(t,full?old.extractSignal(p,f.width,f.height,{source:'feet',feetVisibility:.7}):null);}
 }
 rows.push({clip:name.replace('.json',''),manual:f.manualCount,before:before?.count??null,after:counter.count,error:counter.count-f.manualCount});
}
console.table(rows);
console.log(JSON.stringify({rows,totals:rows.reduce((sum,r)=>({manual:sum.manual+r.manual,before:sum.before+(r.before||0),after:sum.after+r.after,absoluteError:sum.absoluteError+Math.abs(r.error)}),{manual:0,before:0,after:0,absoluteError:0})}));
