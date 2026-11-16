import test from 'node:test';
import assert from 'node:assert/strict';
import { CART_NOTICE_MS, nextCartNotice } from '../src/cart-notice.mjs';

test('quick clicks accumulate additions only while the same product notification is visible',()=>{
 let n=nextCartNotice(null,'aloe',1,0);
 assert.equal(n.quantity,1);
 n=nextCartNotice(n,'aloe',1,200);
 assert.equal(n.quantity,2);
 n=nextCartNotice(n,'aloe',1,300);
 assert.equal(n.quantity,3);
 n=nextCartNotice(n,'aloe',1,300+CART_NOTICE_MS);
 assert.equal(n.quantity,1,'a new visible notification starts at one after the last one expired');
 assert.equal(nextCartNotice(n,'magnesium',1,400+CART_NOTICE_MS).quantity,1,'another product starts its own count');
 assert.equal(nextCartNotice(null,'aloe',3,0).quantity,3,'a bulk addition counts actual pieces');
});
