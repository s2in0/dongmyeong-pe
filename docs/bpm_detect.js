// 노래의 BPM(1분당 박자 수)을 브라우저에서 추정합니다.
// 방법: 저음·전체 대역의 소리 세기 변화(박자 시작점)를 구한 뒤, 일정 간격으로 반복되는 주기를 자기상관으로 찾습니다.
// 줄넘기 음악에 흔한 빠르기(약 120 BPM)를 약하게 우선해 절반·두 배로 잘못 잡히는 일을 줄입니다.
const MIN_BPM=60,MAX_BPM=200,COMB=8;
// 프레임 간격은 약 5.8ms(샘플레이트와 무관하게 비슷한 정밀도)
const hopFor=sampleRate=>Math.max(64,Math.round(sampleRate/172));

function onsetEnvelope(samples,sampleRate,HOP){
  // 저음(킥 드럼)과 전체 대역의 프레임별 에너지 → 로그 세기의 증가분만 남깁니다.
  const frames=Math.floor(samples.length/HOP),low=new Float32Array(frames),full=new Float32Array(frames);
  const a=Math.exp(-2*Math.PI*150/sampleRate);let lp=0;
  for(let f=0;f<frames;f++){
    let el=0,ef=0;const start=f*HOP;
    for(let i=start;i<start+HOP;i++){const x=samples[i];lp=(1-a)*x+a*lp;el+=lp*lp;ef+=x*x;}
    low[f]=Math.log1p(1000*el/HOP);full[f]=Math.log1p(1000*ef/HOP);
  }
  const env=new Float32Array(frames);
  for(let f=1;f<frames;f++)env[f]=Math.max(0,low[f]-low[f-1])*1.5+Math.max(0,full[f]-full[f-1]);
  // 느린 변화(곡 전체 볼륨)를 빼서 박자 시작점만 남깁니다.
  const w=Math.round(sampleRate/HOP),out=new Float32Array(frames);let sum=0;
  for(let f=0;f<frames;f++){sum+=env[f];if(f>=w)sum-=env[f-w];out[f]=Math.max(0,env[f]-sum/Math.min(f+1,w));}
  return out;
}

function autocorrelation(env,maxLag){
  const n=env.length,r=new Float64Array(maxLag+1);let mean=0;
  for(let i=0;i<n;i++)mean+=env[i];mean/=n;
  const x=Float64Array.from(env,v=>v-mean);
  for(let lag=1;lag<=maxLag;lag++){let s=0;for(let i=lag;i<n;i++)s+=x[i]*x[i-lag];r[lag]=s/(n-lag);}
  return r;
}

const at=(r,lag)=>{const i=Math.floor(lag),t=lag-i;return i+1<r.length?r[i]*(1-t)+r[i+1]*t:0;};

export function detectBpm(samples,sampleRate){
  if(!samples||samples.length<sampleRate*8)throw Error('노래가 너무 짧아 BPM을 계산할 수 없어요.');
  // 곡 앞부분(인트로)을 피하려고 15% 지점부터 최대 90초를 분석합니다.
  const start=Math.floor(samples.length*0.15),len=Math.min(samples.length-start,sampleRate*90);
  const part=samples.length-start>=sampleRate*20?samples.subarray(start,start+len):samples;
  const HOP=hopFor(sampleRate),env=onsetEnvelope(part,sampleRate,HOP),fps=sampleRate/HOP;
  const maxLag=Math.ceil(fps*60/MIN_BPM*COMB)+2,r=autocorrelation(env,Math.min(maxLag,env.length-2));
  const score=bpm=>{const lag=fps*60/bpm;let s=0;for(let k=1;k<=COMB;k++)s+=at(r,lag*k)/Math.sqrt(k);
    // 120 BPM 근처를 약하게 우선(한 옥타브 차이에서 약 30% 감점)
    const octave=Math.log2(bpm/120);return s*Math.exp(-0.5*(octave/0.9)**2);};
  let best=MIN_BPM,bestScore=-Infinity;
  for(let bpm=MIN_BPM;bpm<=MAX_BPM;bpm+=0.5){const s=score(bpm);if(s>bestScore){bestScore=s;best=bpm;}}
  for(let bpm=best-0.6;bpm<=best+0.6;bpm+=0.02){const s=score(bpm);if(s>bestScore){bestScore=s;best=bpm;}}
  const rounded=Math.round(best),bpm=Math.abs(best-rounded)<=0.35?rounded:Math.round(best*10)/10;
  const peak=Math.max(...Array.from(r).slice(1)),confidence=peak>0?Math.max(0,Math.min(1,at(r,fps*60/best)/peak)):0;
  return {bpm,confidence:Math.round(confidence*100)/100};
}

// 브라우저: 오디오 파일(Blob/ArrayBuffer)을 읽어 BPM을 계산합니다.
export async function detectBpmFromFile(fileOrBuffer){
  const bytes=fileOrBuffer instanceof ArrayBuffer?fileOrBuffer:await fileOrBuffer.arrayBuffer();
  const Ctx=window.AudioContext||window.webkitAudioContext,ctx=new Ctx();
  try{
    const buffer=await new Promise((resolve,reject)=>{const p=ctx.decodeAudioData(bytes.slice(0),resolve,reject);if(p?.then)p.then(resolve,reject);});
    const ch=buffer.numberOfChannels,mono=new Float32Array(buffer.length);
    for(let c=0;c<ch;c++){const d=buffer.getChannelData(c);for(let i=0;i<d.length;i++)mono[i]+=d[i]/ch;}
    return {...detectBpm(mono,buffer.sampleRate),durationSeconds:buffer.duration};
  }finally{ctx.close?.();}
}
