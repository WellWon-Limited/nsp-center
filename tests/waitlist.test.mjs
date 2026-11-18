import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreWaitlist, reconcileWaitlist } from '../packages/presentation/waitlist.ts';
const product={id:'a',name:'A',path:'/product/a/',availability:'OutOfStock'};
test('Waitlist restoration filters invalid entries and duplicates',()=>{
 assert.deepEqual(restoreWaitlist([null,{id:'a'},{id:'a'},{id:'missing'}],new Set(['a'])),[{id:'a',notified:false}]);
 assert.deepEqual(restoreWaitlist({},new Set(['a'])),[]);
});
test('Arrival is emitted once, survives reload, and rearms only after going out of stock',()=>{
 let list=[{id:'a',notified:false}];
 assert.equal(reconcileWaitlist(list,[product]).entries,list);
 assert.equal(reconcileWaitlist(list,[{...product,availability:'PreOrder'}]).arrivals.length,0);
 const arrival=reconcileWaitlist(list,[{...product,availability:'InStock'}]);
 assert.equal(arrival.arrivals.length,1);
 list=restoreWaitlist(JSON.parse(JSON.stringify(arrival.entries)),new Set(['a']));
 assert.equal(reconcileWaitlist(list,[{...product,availability:'InStock'}]).arrivals.length,0);
 list=reconcileWaitlist(list,[product]).entries;
 assert.equal(reconcileWaitlist(list,[{...product,availability:'InStock'}]).arrivals.length,1);
 assert.equal(reconcileWaitlist([],[{...product,availability:'InStock'}]).arrivals.length,0);
});
