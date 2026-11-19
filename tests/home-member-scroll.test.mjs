import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source=readFileSync(new URL('../apps/web/src/home-member.tsx',import.meta.url),'utf8');
const handler=source.match(/function scrollToHomeSection\(event:MouseEvent<HTMLAnchorElement>\)\{([\s\S]*?)\n\}/)[1];
function click({id='home-showcase',height=119,reduced=false,meta=false}={}){
 const calls=[];
 const event={button:0,metaKey:meta,currentTarget:{hash:`#${id}`},preventDefault(){calls.push('prevented');}};
 const target={id,getBoundingClientRect:()=>({top:884})};
 runInNewContext(`(function(event){${handler}})(event)`,{
  event,document:{getElementById:()=>target,querySelector:()=>({getBoundingClientRect:()=>({height})})},
  window:{scrollY:200,scrollTo:options=>calls.push({...options}),dispatchEvent:()=>calls.push('replay')},
  matchMedia:()=>({matches:reduced}),HOME_PRODUCTS_REPLAY:'products',Event:class{},
 });
 return calls;
}
test('all member shortcuts scroll smoothly below the actual fixed header',()=>{
 for(const id of ['home-showcase','home-journal','home-about'])for(const height of [99,119,143]){
  const calls=click({id,height});
  assert.deepEqual(calls.at(-1),{top:1084-height-16,behavior:'smooth'});
  assert.equal(calls.includes('replay'),id==='home-showcase');
 }
});
test('reduced motion jumps directly and modified clicks retain native navigation',()=>{
 assert.equal(click({reduced:true}).at(-1).behavior,'instant');
 assert.deepEqual(click({meta:true}),[]);
});
