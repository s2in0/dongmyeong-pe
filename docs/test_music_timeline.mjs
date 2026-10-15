import assert from 'node:assert/strict';
import {actionBeats,musicPosition} from './music_timeline.js';
const moves=Array.from({length:8},(_,i)=>({symbol:String(i),label:'move '+i})),bars=[moves,moves];
assert.equal(actionBeats(bars),128);
for(const bpm of [120,125,128]){const beat=60/bpm;assert.equal(musicPosition(bars,bpm,0).slot,0);assert.equal(musicPosition(bars,bpm,7.99*beat).slot,0);assert.equal(musicPosition(bars,bpm,8*beat).slot,1);assert.equal(musicPosition(bars,bpm,64*beat).bar,1);assert.equal(musicPosition(bars,bpm,128*beat).done,true);assert.equal(musicPosition(bars,bpm,2.1*beat).within,3);assert.equal(musicPosition(bars,bpm,97*beat).beat,97,'Delayed frames use the song clock, not accumulated timer callbacks.');}
console.log('Music timeline passed: 8 beats per movement, 8 movements per line, 120–128 BPM timing, exact boundaries and delayed-frame synchronization.');
// 나뉜 칸: 4박씩 2동작 / 2박씩 4동작 — 박자에 맞는 부분과 동작을 돌려줍니다.
{const a={symbol:'o',label:'a'},b={symbol:'sc',label:'b'},c={symbol:'ox',label:'c'},d={symbol:'O',label:'d'};
 const split=[[{split:2,parts:[a,b]},{split:4,parts:[a,b,c,d]},a,a,a,a,a,a]],beat=60/120;
 let p=musicPosition(split,120,3.5*beat);assert.equal(p.piece,0);assert.equal(p.move,a);assert.equal(p.pieces,2);
 p=musicPosition(split,120,4*beat);assert.equal(p.piece,1);assert.equal(p.move,b);
 p=musicPosition(split,120,(8+5)*beat);assert.equal(p.slot,1);assert.equal(p.piece,2);assert.equal(p.move,c);assert.equal(p.within,6);
 p=musicPosition(split,120,16*beat);assert.equal(p.pieces,1);assert.equal(p.move,a);
 // 0.5배속: 추천 128 BPM 곡 → 64 BPM으로 같은 박자 위치
 assert.equal(musicPosition(split,64,8*60/64).slot,1);
 console.log('Split cells passed: 4박×2, 2박×4 parts follow the beat.');}
