import {validBpm} from './music_rhythm.js';
import {countBeats,locateBeat,cellParts} from './music_bars.js';
export const BEATS_PER_MOVE=8;
export const actionBeats=bars=>countBeats(bars)*BEATS_PER_MOVE;
export function musicPosition(bars,bpm,elapsedSeconds){
 const beat=Math.floor(Math.max(0,elapsedSeconds)*validBpm(bpm)/60+1e-7),total=actionBeats(bars);
 if(beat>=total)return {done:true,total};
 const index=Math.floor(beat/BEATS_PER_MOVE),part=locateBeat(bars,index);
 const cell=bars[part.bar][part.beat],parts=cellParts(cell),within=beat%BEATS_PER_MOVE+1,piece=Math.floor((within-1)/(BEATS_PER_MOVE/parts.length));
 // 나뉜 칸이면 지금 박자가 속한 부분(piece)과 그 동작을 함께 돌려줍니다.
 return {done:false,total,beat,index,bar:part.bar,slot:part.beat,within,piece,pieces:parts.length,move:parts[piece],cell};
}
