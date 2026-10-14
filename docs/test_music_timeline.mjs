import assert from 'node:assert/strict';
import {actionBeats,musicPosition} from './music_timeline.js';
const moves=Array.from({length:8},(_,i)=>({symbol:String(i),label:'move '+i})),bars=[moves,moves];
assert.equal(actionBeats(bars),128);
for(const bpm of [120,125,128]){const beat=60/bpm;assert.equal(musicPosition(bars,bpm,0).slot,0);assert.equal(musicPosition(bars,bpm,7.99*beat).slot,0);assert.equal(musicPosition(bars,bpm,8*beat).slot,1);assert.equal(musicPosition(bars,bpm,64*beat).bar,1);assert.equal(musicPosition(bars,bpm,128*beat).done,true);assert.equal(musicPosition(bars,bpm,2.1*beat).within,3);assert.equal(musicPosition(bars,bpm,97*beat).beat,97,'Delayed frames use the song clock, not accumulated timer callbacks.');}
console.log('Music timeline passed: 8 beats per movement, 8 movements per line, 120–128 BPM timing, exact boundaries and delayed-frame synchronization.');
