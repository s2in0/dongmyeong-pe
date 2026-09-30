import assert from 'node:assert/strict';
import {podiumGroups,createRankingMotion,showAnimatedCount} from './ranking_motion.js';

let reduced=false;
globalThis.matchMedia=()=>({matches:reduced});
const frameQueue=new Map();let frameId=0;
globalThis.requestAnimationFrame=callback=>{frameQueue.set(++frameId,callback);return frameId};
globalThis.cancelAnimationFrame=id=>frameQueue.delete(id);
class Node {
  children=[];dataset={};animations=[];parent=null;visible=true;textContent='';
  get isConnected(){return !!this.parent}
  append(node){node.remove();this.children.push(node);node.parent=this}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null}}
  replaceChildren(){for(const child of [...this.children])child.remove()}
  getClientRects(){return this.visible?[{}]:[]}
  getBoundingClientRect(){return {top:this.parent?this.parent.children.indexOf(this)*100:0}}
  animate(frames,options){const animation={frames,options,cancel(){this.cancelled=true}};this.animations.push(animation);return animation}
}
const list=new Node(),changes=[];
const motion=createRankingMotion(list,{build(){return new Node()},patch(node,row,old){node.row={...row};changes.push(old?old.rank-row.rank:null)}});
motion.render([{number:1,count:50,rank:1},{number:2,count:40,rank:2}],{key:'1-1-30'});
const first=list.children[0],second=list.children[1];
assert.equal(first.animations.length,0,'An initial snapshot has no invented previous positions.');
motion.render([{number:2,count:60,rank:1},{number:1,count:50,rank:2}],{key:'1-1-30'});
assert.equal(list.children[0],second,'A student keeps the same element while changing position.');
assert.equal(list.children[1],first);
assert.equal(second.animations[0].frames[0].transform,'translateY(100px)');
assert.equal(first.animations[0].frames[0].transform,'translateY(-100px)');
assert.deepEqual(changes.slice(-2),[1,-1]);
motion.render([{number:2,count:60,rank:1},{number:1,count:50,rank:2},{number:3,count:20,rank:3}],{key:'1-1-30'});
assert.equal(list.children[2].animations[0].frames[0].opacity,0,'A newly saved student enters the list.');
reduced=true;const before=second.animations.length;
motion.render([{number:1,count:80,rank:1},{number:2,count:60,rank:2}],{key:'1-1-30'});
assert.equal(second.animations.length,before,'Reduced motion suppresses movement.');
const counter=new Node();counter.dataset.count='10';counter.textContent='10회';showAnimatedCount(counter,0);assert.equal(counter.textContent,'0회');
reduced=false;
motion.render([{number:1,count:5,rank:1}],{key:'1-2-30'});
assert.notEqual(list.children[0],first,'A different class cannot inherit the old class position.');
assert.equal(list.children[0].animations.length,0);
assert.deepEqual(podiumGroups([{number:3,count:80},{number:2,count:100},{number:1,count:100},{number:4,count:70}]),[{rank:1,count:100,numbers:[1,2]},{rank:3,count:80,numbers:[3]}],'Tied winners share the podium without inventing a second place.');
assert.deepEqual(podiumGroups([]),[]);
// Podium cards retain the winning students while moving between horizontal slots.
const podium=new Node();
const podiumMotion=createRankingMotion(podium,{getKey:group=>group.numbers.join('-'),build(){const card=new Node();card.getBoundingClientRect=()=>({top:0,left:(card.row.rank===2?0:card.row.rank===1?1:2)*200});return card},patch(card,group){card.row=group}});
podiumMotion.render([{numbers:[1],rank:1},{numbers:[2],rank:2}],{key:'class-1'});
const champion=podium.children[0];
podiumMotion.render([{numbers:[2],rank:1},{numbers:[1],rank:2}],{key:'class-1'});
assert.equal(podium.children[1],champion);
assert.equal(champion.animations[0].frames[0].transform,'translate(200px, 0px)');
podiumMotion.render([{numbers:[1,2],rank:1}],{key:'class-1'});
assert.equal(podium.children.length,1,'A newly tied group replaces the individual podium cards.');
motion.reset();assert.equal(list.children.length,0);
console.log('Ranking motion: keyed moves, new entries, reduced motion, scope resets, zero scores and tied podiums passed.');
