import test from 'node:test';
import assert from 'node:assert/strict';
import {nextOrderStatuses,orderChangeError} from '../packages/domain/order-status.mjs';
test('normal order transitions distinguish pickup from delivery and terminal states',()=>{
 assert.deepEqual(nextOrderStatuses('new','pickup'),['processing','cancelled']);
 assert.deepEqual(nextOrderStatuses('processing','pickup'),['completed','cancelled']);
 assert.deepEqual(nextOrderStatuses('processing','courier'),['shipped','cancelled']);
 assert.deepEqual(nextOrderStatuses('completed','pickup'),[]);
 assert.deepEqual(nextOrderStatuses('cancelled','courier'),[]);
 assert.ok(orderChangeError('new','completed','pickup',false,''));
 assert.ok(orderChangeError('processing','shipped','pickup',false,''));
 assert.equal(orderChangeError('processing','completed','pickup',false,''),null);
 assert.equal(orderChangeError('shipped','completed','courier',false,''),null);
});
test('cancellation and staff corrections need a meaningful reason',()=>{
 assert.ok(orderChangeError('new','cancelled','pickup',false,''));
 assert.equal(orderChangeError('new','cancelled','pickup',false,'Покупатель отменил заказ'),null);
 assert.ok(orderChangeError('completed','new','pickup',true,''));
 assert.equal(orderChangeError('completed','new','pickup',true,'Исправляем ошибочно выбранный заказ'),null);
 assert.ok(orderChangeError('new','new','pickup',true,'Без изменения статуса'));
});
