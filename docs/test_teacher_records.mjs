import assert from 'node:assert/strict';
import {recordDay,recordTime,filterRecords,summarizeRecords,recordsCsv} from './teacher_records.js';

const records=[
  {number:1,count:20,durationSeconds:30,createdAt:'2026-09-28T01:00:00Z'},
  {number:1,count:50,durationSeconds:30,createdAt:'2026-09-29T15:05:00Z'},
  {number:1,count:80,durationSeconds:60,createdAt:'2026-09-30T01:00:00Z'},
  {number:2,count:40,durationSeconds:30,createdAt:'2026-09-30T01:01:00Z'}
];
assert.equal(recordDay('2026-09-29T15:05:00Z'),'2026-09-30','Dates use the Korean school day, including midnight boundaries.');
assert.equal(recordTime('2026-09-30T01:00:00Z'),'2026년 9월 30일 10시 00분');
assert.equal(filterRecords(records,{day:'2026-09-30',duration:'30',number:'1'}).length,1);
const summary=summarizeRecords(records);
assert.equal(summary.length,3,'Different time limits produce separate student summaries.');
const first=summary.find(row=>row.number===1&&row.durationSeconds===30);
assert.deepEqual([first.best,first.latest,first.change,first.attempts],[50,50,30,2]);
const longer=summary.find(row=>row.number===1&&row.durationSeconds===60);
assert.equal(longer.change,null,'An isolated record must not compare against a different time limit.');
assert.equal(summarizeRecords([...records].reverse()).find(row=>row.key===first.key).latest,50,'Latest records do not depend on sheet row order.');
assert.equal(summarizeRecords([{...records[0],count:0}])[0].best,0,'Zero is a saved measurement.');
assert.deepEqual(summarizeRecords([]),[]);
const csv=recordsCsv(filterRecords(records,{duration:60}),{grade:1,classNo:3});
assert.ok(csv.startsWith('\ufeff'), 'Excel receives a UTF-8 BOM for Korean text.');
assert.ok(csv.includes('"1","3","1","60","80"'));
assert.ok(!csv.includes('"30"'),'Export only contains the filtered time limit.');
console.log('Teacher records: Korean dates, filters, separate durations, chronology, zero counts and CSV passed.');
