const assert=require('node:assert/strict');
const {createClassroomCounter,measurementSignal}=require('./jump_counter.js');
const W=1280,H=720;
function pose(body,feet,options={}){
 const p=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
 const put=(i,x,y)=>{p[i]={x:x+(options.shift||0),y,visibility:options.visibility??.95}};
 for(const [i,x,y] of [[0,.5,.25],[7,.47,.26],[8,.53,.26],[11,.42,.4],[12,.58,.4],[23,.45,.62],[24,.55,.62]])put(i,x,y-(options.shrug&&i===11||options.shrug&&i===12?options.shrug:body));
 put(27,.45,.94-feet[0]);put(28,.55,.94-feet[1]);
 if(options.hidden)p[28].visibility=.1;
 return p;
}
function run(kind,fps=30){
 const c=createClassroomCounter('보통'),n=12,period=.30,duration=n*period+1;
 for(let frame=0;frame<duration*fps;frame++){
  const t=frame/fps,cycle=Math.floor(t/period),phase=t%period;
  const lift=cycle<n?.008*Math.sin(Math.PI*Math.min(phase/.23,1)):0;
  let body=lift,feet=[lift,lift],options={};
  if(kind==='alternate')feet=cycle%2?[lift*2,-lift*.2]:[-lift*.2,lift*2];
  if(kind==='planted')feet=[0,0];
  if(kind==='shrug'){body=0;feet=[0,0];options.shrug=lift;}
  if(kind==='knee'){body=0;feet=[lift*5,0];}
  if(kind==='hidden')options.hidden=true;
  if(kind==='walking')options.shift=.25*t;
  if(kind==='confidence')options.visibility=.6;
  if(kind==='jitter'){body=.0004*Math.sin(frame*2.3);feet=[body,-body];}
  c.update(t,measurementSignal(pose(body,feet,options),W,H));
 }
 return c;
}
for(const fps of [15,24,30,60])for(const kind of ['bounce','alternate','confidence'])assert.equal(run(kind,fps).count,12,`${kind} at ${fps} FPS`);
for(const kind of ['planted','shrug','knee','hidden','walking','jitter'])assert.equal(run(kind).count,0,kind);
const c=createClassroomCounter('보통');c.update(0,measurementSignal(pose(0,[0,0]),W,H));c.update(.1,measurementSignal(pose(.008,[.008,.008]),W,H));c.update(2,measurementSignal(pose(0,[0,0]),W,H));assert.equal(c.count,0);assert.equal(c._state,'falling');
assert.equal(measurementSignal(null,W,H),null);
const croppedHead=pose(.008,[.008,.008]);for(const i of [0,7,8])croppedHead[i].y=-.1;
assert.equal(measurementSignal(croppedHead,W,H),null,'Hidden head must produce a framing prompt, not endless rhythm waiting.');
console.log('Classroom counter passed: low and alternating hops at 15/24/30/60 FPS, moving-foot confidence, no planted-foot/shrug/knee/walking/jitter/hidden-feet counts, camera-gap reset.');

for(const fps of [15,24,30,60])for(const alternating of [false,true]){
 const low=createClassroomCounter('보통'),period=.24;
 for(let i=0;i<4*fps;i++){const t=i/fps,n=Math.floor(t/period),phase=t%period;const lift=n<12?.004*Math.sin(Math.PI*Math.min(phase/.19,1)):0;
 const swing=n<12?.014*Math.sin(Math.PI*Math.min(phase/.19,1)):0;
 const feet=alternating?(n%2?[lift+swing,lift]:[lift,lift+swing]):[lift,lift];
 low.update(t,measurementSignal(pose(lift*.08,feet),W,H));}
 assert.equal(low.count,12,`Almost stationary torso with ${alternating?'alternating':'two-foot'} hops at ${fps} FPS`);
}
console.log('Support-foot regression: 250/min low two-foot and alternating hops with near-stationary torso, 15/24/30/60 FPS.');

for(const fps of [15,24,30,60]){
 const paired=createClassroomCounter('보통'),period=.24;
 for(let i=0;i<4*fps;i++){const t=i/fps,n=Math.floor(t/period),phase=t%period;
 const lift=n<12?.004*Math.sin(Math.PI*Math.min(phase/.19,1)):0;
 const body=n<12&&n%2===0?lift*2:0;
 paired.update(t,measurementSignal(pose(body,[lift,lift]),W,H));}
 assert.equal(paired.count,12,`Body seen on every other hop must not suppress real foot hops at ${fps} FPS`);
}
