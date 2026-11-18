import test from 'node:test';
import assert from 'node:assert/strict';
import {fitProductOverview} from '../packages/presentation/product-layout.mjs';

test('Product frame uses CSS pixels under page scaling and keeps its lower edge within the viewport',()=>{
 for(const scale of [1,1.5,2,2.6]){
  let height=0;
  const el={offsetWidth:500,dataset:{},style:{setProperty:(key,value)=>{if(key==='--product-available-height')height=parseFloat(value)}},getBoundingClientRect:()=>({top:100,bottom:100+height*scale,width:500*scale}),querySelectorAll:selector=>selector==='.product-short-section'?[]:[{getBoundingClientRect:()=>({height:100,bottom:700})}]};
  fitProductOverview(el,{innerHeight:1000,innerWidth:1470*scale,scrollY:0});
  assert.ok(Math.abs(el.getBoundingClientRect().bottom-980)<.01,`scale ${scale}: frame ends before viewport bottom`);
  assert.equal(el.dataset.compact,'false');
 }
});
