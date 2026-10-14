const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createClassroomCounter,measurementSignal}=require('./jump_counter.js');
const dir=path.join(__dirname,'fixtures/jump-counter');
for(const file of fs.readdirSync(dir)){
 const f=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
 const c=createClassroomCounter('보통');
 for(const[t,points]of f.frames){let p=null;if(points){p=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));f.indices.forEach((i,j)=>p[i]={x:points[j][0],y:points[j][1],visibility:points[j][2]});}c.update(t,measurementSignal(p,f.width,f.height));}
 const maxMisses=file==='fast-one-foot.json'?4:0;
 assert(c.count<=f.manualCount,`${file}: overcount ${c.count}/${f.manualCount}`);
 assert(f.manualCount-c.count<=maxMisses,`${file}: regression ${c.count}/${f.manualCount}`);
 console.log(`${file}: ${c.count}/${f.manualCount} (manual count; remaining allowed misses ${maxMisses})`);
}
