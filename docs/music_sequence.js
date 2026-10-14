export const MAX_SECTIONS = 256, MAX_BEATS = 4096;
export const emptySection = () => ({move:null,beats:8});
export function beatCount(value) {
  const n=Number(value);
  if(!Number.isInteger(n)||n<1||n>512)throw Error('반복 박자는 1~512 사이의 정수로 입력해 주세요.');
  return n;
}
export function totalBeats(sequence) { return sequence.reduce((sum,s)=>sum+beatCount(s.beats),0); }
export function validateSequence(sequence) {
  if(!Array.isArray(sequence)||!sequence.length||sequence.length>MAX_SECTIONS)throw Error('동작 구간은 1~256개로 구성해 주세요.');
  const beats=totalBeats(sequence);
  if(beats>MAX_BEATS)throw Error('한 곡은 최대 4096박자까지 만들 수 있어요.');
  if(sequence.some(s=>!s.move))throw Error('모든 구간에 동작을 선택해 주세요.');
  return beats;
}
export function fromBars(bars,normalize) {
  if(!Array.isArray(bars)||!bars.length)return [emptySection()];
  const result=[];
  for(const value of bars.flat()){
    const move=normalize(value),last=result.at(-1);
    if(last&&JSON.stringify(last.move)===JSON.stringify(move)&&last.beats<512)last.beats++;
    else result.push({move,beats:1});
  }
  return result.length?result:[emptySection()];
}
export function sectionAtBeat(sequence,beat) {
  let start=0;
  for(let i=0;i<sequence.length;i++){const end=start+beatCount(sequence[i].beats);if(beat>=start&&beat<end)return {index:i,localBeat:beat-start+1};start=end;}
  return null;
}
export function estimatedTime(beats,bpm) {
  const seconds=Math.round(beats*60/bpm);
  return `${Math.floor(seconds/60)}분 ${String(seconds%60).padStart(2,'0')}초`;
}
