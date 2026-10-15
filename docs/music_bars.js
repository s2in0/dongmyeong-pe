export const MAX_BARS=512,MAX_SONG_BEATS=4096;
export const emptyBar=()=>Array(8).fill(null);
export const countBeats=bars=>bars.reduce((sum,row)=>sum+row.length,0);
// 한 칸(8박)은 동작 하나이거나, 위아래로 나뉜 {split:2|4, parts:[동작…]}(4박씩 2동작 / 2박씩 4동작)입니다.
export const SPLITS=[1,2,4];
export const isSplit=cell=>!!cell&&Array.isArray(cell.parts);
export const cellParts=cell=>isSplit(cell)?cell.parts:[cell??null];
export const cellFilled=cell=>cellParts(cell).every(Boolean);
export function splitCell(cell,count){
 const parts=cellParts(cell);
 if(count===1)return parts.find(Boolean)??null;
 if(count!==2&&count!==4)throw Error('칸은 2박·4박·8박으로만 나눌 수 있어요.');
 return {split:count,parts:Array.from({length:count},(_,i)=>parts[i]??null)};
}
export function normalizeCell(cell,normalize){
 if(isSplit(cell)){const n=cell.parts.length;if(n!==2&&n!==4)return null;return {split:n,parts:cell.parts.map(m=>m?normalize(m):null)};}
 return cell?normalize(cell):null;
}
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
 const index=move=>{if(!move)throw Error('빈 칸에 동작을 채워 주세요.');const key=JSON.stringify(move);if(!by.has(key)){by.set(key,palette.length);palette.push({...move});}return by.get(key)};
 const packed=bars.map(row=>row.map(cell=>isSplit(cell)?cell.parts.map(index):index(cell)));
 if(palette.length>256)throw Error('한 곡에는 최대 256종류의 동작을 사용할 수 있어요.');
 return {palette,bars:packed};
}
export function unpackBars(value){return value.bars.map(row=>row.map(index=>Array.isArray(index)?{split:index.length,parts:index.map(i=>value.palette[i])}:value.palette[index]));}
export function locateBeat(bars,beat){let start=0;for(let i=0;i<bars.length;i++){if(beat<start+bars[i].length)return {bar:i,beat:beat-start};start+=bars[i].length;}return null;}
