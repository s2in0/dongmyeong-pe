// 합성 음원(킥·스네어·하이햇·베이스·잡음)으로 BPM 추정 정확도를 확인합니다.
import assert from 'node:assert/strict';
import {detectBpm} from './bpm_detect.js';
const SR=Number(process.env.SR||22050);
function song(bpm,seconds,{swing=0,noise=0.05,seed=1}={}){
  const n=SR*seconds,x=new Float32Array(n),beat=60/bpm;let s=seed;
  const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647-0.5;};
  for(let t=0;t<seconds;t+=beat/2){
    const i0=Math.floor(t*SR),half=Math.round(t/beat*2)%2,beatNo=Math.round(t/beat);
    for(let k=0;k<SR*0.12&&i0+k<n;k++){const tt=k/SR;
      if(!half)x[i0+k]+=Math.sin(2*Math.PI*(60+90*Math.exp(-tt*30))*tt)*Math.exp(-tt*18)*0.8; // 킥
      if(!half&&beatNo%2)x[i0+k]+=rnd()*Math.exp(-tt*25)*0.5; // 스네어
      x[i0+k]+=rnd()*Math.exp(-tt*80)*0.15; // 하이햇(8분)
    }
  }
  for(let i=0;i<n;i++)x[i]+=Math.sin(2*Math.PI*55*i/SR)*0.1+rnd()*noise;
  return x;
}
for(const bpm of [95,110,120,125,128,132,140,150]){
  const r=detectBpm(song(bpm,60,{seed:bpm}),SR);
  console.log(bpm,'→',r.bpm,r.confidence);
  assert.ok(Math.abs(r.bpm-bpm)<=1,`${bpm} BPM을 ${r.bpm}로 추정`);
}
console.log('bpm detect ok');
