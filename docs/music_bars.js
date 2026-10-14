export const MAX_BARS=512,MAX_SONG_BEATS=4096;
export const emptyBar=()=>Array(8).fill(null);
export const countBeats=bars=>bars.reduce((sum,row)=>sum+row.length,0);
export function loadBars(draft,normalize){
 if(Array.isArray(draft.sequence)&&draft.sequence.length){
  const flat=[];
  for(const s of draft.sequence){const n=Number(s.beats);if(!Number.isInteger(n)||n<1||n>512||flat.length+n>MAX_SONG_BEATS)throw Error('기존 안무의 반복 박자를 확인해 주세요.');for(let i=0;i<n;i++)flat.push(normalize(s.move));}
  return Array.from({length:Math.ceil(flat.length/8)},(_,i)=>flat.slice(i*8,i*8+8));
 }
 const raw=Array.isArray(draft.bars)?draft.bars:Array.isArray(draft.beats)?[draft.beats]:[];
 if(!raw.length)return [emptyBar()];
 if(raw.length>MAX_BARS||raw.some((row,i)=>!Array.isArray(row)||!row.length||row.length>8))throw Error('저장된 안무 줄을 확인해 주세요.');
 // Pair old four-beat rows without adding or losing any beats.
 if(draft.format==='bars-v2')return raw.map(row=>row.map(normalize));
 const flat=raw.flat().map(normalize);
 return Array.from({length:Math.ceil(flat.length/8)},(_,i)=>flat.slice(i*8,i*8+8));
}
export function packBars(bars){
 if(!Array.isArray(bars)||!bars.length||bars.length>MAX_BARS||bars.some((row,i)=>!Array.isArray(row)||!row.length||row.length>8)||countBeats(bars)>MAX_SONG_BEATS)throw Error('안무는 최대 512줄·4096박자까지 만들 수 있어요.');
 const palette=[],by=new Map();
 const packed=bars.map(row=>row.map(move=>{if(!move)throw Error('빈 박자에 동작을 채워 주세요.');const key=JSON.stringify(move);if(!by.has(key)){by.set(key,palette.length);palette.push({...move});}return by.get(key)}));
 if(palette.length>256)throw Error('한 곡에는 최대 256종류의 동작을 사용할 수 있어요.');
 return {palette,bars:packed};
}
export function unpackBars(value){return value.bars.map(row=>row.map(index=>value.palette[index]));}
export function locateBeat(bars,beat){let start=0;for(let i=0;i<bars.length;i++){if(beat<start+bars[i].length)return {bar:i,beat:beat-start};start+=bars[i].length;}return null;}
