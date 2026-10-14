import {validBpm} from './music_rhythm.js';
import {countBeats,locateBeat} from './music_bars.js';
export const BEATS_PER_MOVE=8;
export const actionBeats=bars=>countBeats(bars)*BEATS_PER_MOVE;
export function musicPosition(bars,bpm,elapsedSeconds){
 const beat=Math.floor(Math.max(0,elapsedSeconds)*validBpm(bpm)/60+1e-7),total=actionBeats(bars);
 if(beat>=total)return {done:true,total};
 const index=Math.floor(beat/BEATS_PER_MOVE),part=locateBeat(bars,index);
 return {done:false,total,beat,index,bar:part.bar,slot:part.beat,within:beat%BEATS_PER_MOVE+1,move:bars[part.bar][part.beat]};
}
