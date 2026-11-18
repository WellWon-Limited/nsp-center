import test from 'node:test';
import assert from 'node:assert/strict';
import {activeOrder,completedPurchases,orderStepsFor} from '../apps/web/src/customer-order-status.mjs';
test('only received orders become purchases; active, cancelled and unverified drafts do not',()=>{
 const orders=['new','processing','shipped','completed','cancelled',undefined].map((status,i)=>({id:String(i),status,createdAt:'2026-11-17T12:00:00Z',items:[{id:'aloe',quantity:2}]}));
 assert.deepEqual(orders.filter(activeOrder).map(x=>x.status),['new','processing','shipped']);
 assert.equal(completedPurchases(orders).length,1);
 assert.deepEqual(completedPurchases(orders)[0].products,{aloe:2});
});

test('pickup progresses to receipt without shipping; courier and CDEK retain shipping',()=>{
 assert.deepEqual(orderStepsFor('pickup'),['new','processing','completed']);
 for(const method of ['courier','cdek',undefined])assert.deepEqual(orderStepsFor(method),['new','processing','shipped','completed']);
});
