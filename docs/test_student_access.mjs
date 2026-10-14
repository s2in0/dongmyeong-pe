import assert from 'node:assert/strict';
import {studentLink,studentClass} from './student_access.js';

const endpoint='https://script.google.com/macros/s/EXAMPLE-public/exec';
for(const classNo of [1,2,3]){
  const link=new URL(studentLink('https://example.org/jumpy/teacher.html?pin=secret#teacher',endpoint,{grade:1,classNo}));
  assert.equal(link.pathname,'/jumpy/');
  assert.equal(link.searchParams.get('sheet'),endpoint);
  assert.deepEqual(studentClass(link.search),{grade:1,classNo});
  assert.equal(link.searchParams.has('pin'),false);
  assert.equal(link.hash,'');
  assert.equal(link.searchParams.has('number'),false);
}
for(const search of ['','?grade=0&classNo=1','?grade=1&classNo=31','?grade=1&classNo=1.5','?grade=foo&classNo=2'])assert.equal(studentClass(search),null);
assert.throws(()=>studentLink('https://example.org/teacher.html','javascript:alert(1)',{grade:1,classNo:1}));
console.log('Student access: class-specific URLs, valid prefill, no PIN or student number, safe endpoints.');
