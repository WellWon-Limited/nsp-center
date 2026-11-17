import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogPagination} from '../packages/presentation/catalog-pagination.mjs';

test('every non-final catalog page has full rows at all grid widths, without duplicates or gaps',()=>{
 for(let total=0;total<=400;total++)for(const requested of [0,1,2,3,4,6,10]){
  const pages=catalogPagination(total,requested),ids=Array.from({length:total},(_,i)=>i),seen=[];
  pages.forEach((p,i)=>{seen.push(...ids.slice(p.start,p.end));assert.ok(p.count>0||total===0);if(i<pages.length-1)for(const cols of [1,2,3,4])assert.equal(p.count%cols,0);});
  assert.deepEqual(seen,ids,`${total}/${requested}: every product is shown exactly once`);
  if(pages.length>1)assert.ok(pages.at(-1).count<=Math.min(...pages.slice(0,-1).map(p=>p.count)));
 }
});
