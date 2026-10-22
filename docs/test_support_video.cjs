const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createClassroomCounter,measurementSignal}=require('./jump_counter.js');
for(const file of fs.readdirSync(path.join(__dirname,'fixtures/rope-v43'))){
 const f=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/rope-v43',file))),c=createClassroomCounter('보통');
 for(const[t,points]of f.frames){let p=null;if(points){p=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));f.indices.forEach((i,j)=>p[i]={x:points[j][0],y:points[j][1],visibility:points[j][2]});}c.update(t,measurementSignal(p,f.width,f.height));}
 assert.equal(c.count,f.manualCount,`${file}: on-screen verified 200 BPM eight-count sequence`);
 console.log(`${file}: ${c.count}/${f.manualCount}`);
}
