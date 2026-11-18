import test from 'node:test';
import {startTestPostgres} from './database-helper.mjs';
import assert from 'node:assert/strict';
import {mkdtemp, rm, stat, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID, randomBytes} from 'node:crypto';
import pg from 'pg';
import {migrateDatabase} from '../apps/api/database/migrate.mjs';
import {grantApplicationAccess} from '../apps/api/database/permissions.mjs';
import {deleteCustomProduct} from '../apps/api/database/products.mjs';
import {backupDatabase, databaseFingerprint} from '../apps/api/database/backup.mjs';
import {saveCheckout} from '../apps/api/order-checkout.mjs';
import {assertDatabaseReady} from '../apps/api/database/ready.mjs';

test('database migrations, constraints and restricted application preserve orders', {skip:process.getuid?.()===0&&'Postgres does not run as root'}, async t=>{
 const dir=await mkdtemp(join(tmpdir(),'nsp-integrity-'));
 const port=20000+Math.floor(Math.random()*20000);
 const database=await startTestPostgres(join(dir,'db'),port,'integrity');
 let owner,app;
 t.after(async()=>{await app?.end();await owner?.end();await database.stop();await rm(dir,{recursive:true,force:true});});
 const url=`postgres://test:test@127.0.0.1:${port}/integrity`;
 owner=new pg.Pool({connectionString:url});
 const products=[{id:'built-test',name:'Built product'}];
 await t.test('unprepared requests cannot create schema; migrations are serialized and repeatable',async()=>{
  await assert.rejects(assertDatabaseReady(owner),{code:'42P01'});
  const applied=await Promise.all([migrateDatabase(owner,{products}),migrateDatabase(owner,{products})]);
  assert.equal(applied.flat().length,4);
  assert.equal((await owner.query('select count(*)::int n from schema_migrations')).rows[0].n,4);
  await owner.query("update schema_migrations set checksum='changed' where version='002_integrity.sql'");
  await assert.rejects(migrateDatabase(owner,{products}),/Applied migration changed/);
  const {createHash}=await import('node:crypto');
  const hash=createHash('sha256').update(await readFile(new URL('../apps/api/database/migrations/002_integrity.sql',import.meta.url))).digest('hex');
  await owner.query("update schema_migrations set checksum=$1 where version='002_integrity.sql'",[hash]);
 });
 await owner.query("create role nsp_app login password 'test' nosuperuser nocreatedb nocreaterole");
 await grantApplicationAccess(owner);
 app=new pg.Pool({connectionString:url.replace('test:test@','nsp_app:test@')});
 await assertDatabaseReady(app);
 const {rows:[user]}=await app.query("insert into users(email,first_name,last_name,password_hash,consent_at) values('first@example.ru','First','Test','fixture',now()) returning id");
 const {rows:[other]}=await app.query("insert into users(email,first_name,last_name,password_hash,consent_at) values('second@example.ru','Second','Test','fixture',now()) returning id");
 await t.test('the database rejects duplicate cards, invalid values and orphan products',async()=>{
  await app.query("update users set partner_id='123456' where id=$1",[user.id]);
  await assert.rejects(app.query("update users set partner_id='123456' where id=$1",[other.id]),{code:'23505'});
  for(const sql of ["update users set role='owner'", "update users set partner_id='wrong'", "insert into product_overrides(product_id,retail_rub) values('built-test',-1)","insert into product_overrides(product_id,retail_units) values('built-test','NaN')","insert into product_overrides(product_id,availability) values('built-test','wrong')"]){await assert.rejects(app.query(sql),{code:'23514'});}
  await assert.rejects(app.query("insert into product_visibility values('missing',false)"),{code:'23503'});
 });
 await t.test('API can serve data but cannot alter schema, migrations or historical rows through tables or views',async()=>{
  for(const sql of ['create table public.forbidden(id int)','alter table users add column forbidden text',"update schema_migrations set checksum='x'",'delete from order_items','delete from order_events','delete from admin_log','delete from shop_orders','delete from products','delete from order_read',"update order_read set note='tampered'"]){await assert.rejects(app.query(sql),{code:'42501'},sql);}
  const {rows:[role]}=await app.query('select rolsuper,rolcreatedb,rolcreaterole from pg_roles where rolname=current_user');
  assert.deepEqual(role,{rolsuper:false,rolcreatedb:false,rolcreaterole:false});
 });
 await app.query("insert into products(id,source,name) values('custom-test','custom','Custom product')");
 await app.query("insert into custom_products(product_id,data) values('custom-test',$1)",[{retailRub:1000,partnerRub:null}]);
 await app.query("insert into product_visibility values('custom-test',false)");
 const body={key:randomUUID(),guestToken:randomBytes(32).toString('hex'),items:[{id:'custom-test',quantity:2}],expectedSubtotalKopecks:200000,form:{firstName:'Тест',lastName:'Заказ',email:'order@example.ru',phone:'+7 900 111-22-33',method:'pickup',comment:'',offer:true,consent:true}};
 const ctx={pool:app,buildRate:100,pickupAddress:'Test pickup',loadCatalog:async()=>({products:[{id:'custom-test',name:'Historical name',prices:{retail:1000,partner:null}}],settings:{products:{},cards:{}}})};
 const saved=await saveCheckout(ctx,null,body);
 await t.test('restricted checkout commits, replays and rejects inconsistent totals',async()=>{
  assert.equal(saved.order.total,2000);
  assert.equal((await saveCheckout(ctx,null,body)).repeated,true);
  await assert.rejects(app.query('update shop_orders set total_kopecks=1 where id=$1',[saved.order.id]),{code:'42501'});
  await assert.rejects(app.query("update shop_orders set status='processing' where id=$1",[saved.order.id]),{code:'42501'});
  await assert.rejects(app.query("update shop_orders set updated_at=now() where id=$1",[saved.order.id]),{code:'42501'});
  await assert.rejects(app.query("update shop_orders set customer='{}' where id=$1",[saved.order.id]),{code:'42501'});
  await assert.rejects(app.query("insert into order_events(order_id,event_type,to_status,actor_role) values($1,'status_changed','completed','admin')",[saved.order.id]),{code:'42501'});
  await assert.rejects(app.query("insert into order_items(order_id,product_id,name,quantity,unit_price_kopecks,retail_price_kopecks,line_total_kopecks) values($1,'built-test','Extra',1,0,0,0)",[saved.order.id]),{code:'42501'});
 });
 await t.test('custom prices reject missing, string, fractional, negative and inconsistent values',async()=>{
  for(const data of [{},{retailRub:null},{retailRub:'100'},{retailRub:-1},{retailRub:1.5},{retailRub:10000001},{retailRub:100,partnerRub:100},{retailRub:100,partnerRub:-1},{retailRub:100,partnerRub:'50'}]){
   await assert.rejects(app.query("update custom_products set data=$1 where product_id='custom-test'",[data]),{code:'23514'});
  }
  await app.query("update custom_products set data=$1 where product_id='custom-test'",[{retailRub:1000,partnerRub:800}]);
 });
 await t.test('database status operation validates staff, transitions, reasons and writes history atomically',async()=>{
  const {rows:[staff]}=await owner.query("insert into users(email,first_name,last_name,password_hash,consent_at,role) values('staff@example.ru','Staff','Test','fixture',now(),'admin') returning id");
  const version=async()=> (await app.query('select updated_at from shop_orders where id=$1',[saved.order.id])).rows[0].updated_at.toISOString();
  const change=async(status,actor,correction=false,reason='')=>app.query('select change_order($1,$2,$3,$4,$5,$6,$7)',[saved.order.id,await version(),status,'',actor,correction,reason]);
  await assert.rejects(change('processing',user.id),{code:'42501'});
  await assert.rejects(change('completed',staff.id),{code:'23514'});
  await assert.rejects(change('cancelled',staff.id),{code:'23514'});
  const oldVersion=await version();
  await change('processing',staff.id);
  await assert.rejects(app.query('select change_order($1,$2,$3,$4,$5,$6,$7)',[saved.order.id,oldVersion,'completed','',staff.id,false,'']),{code:'40001'});
  await assert.rejects(change('shipped',staff.id),{code:'23514'});
  await change('completed',staff.id);
  await assert.rejects(change('new',staff.id,true,'x'),{code:'23514'});
  await change('new',staff.id,true,'Ошибочное завершение');
  const events=(await app.query('select * from order_events where order_id=$1 order by id',[saved.order.id])).rows;
  assert.deepEqual(events.map(e=>e.to_status),['new','processing','completed','new']);
  assert.equal(events.at(-1).correction,true);
  // Failure writing the audit must roll back the changed status as well.
  await owner.query("create function reject_order_log() returns trigger language plpgsql as $$ begin if new.action='order' then raise exception 'test audit failure'; end if; return new; end $$; create trigger reject_order_log before insert on admin_log for each row execute function reject_order_log()");
  await assert.rejects(change('processing',staff.id),/test audit failure/);
  assert.equal((await app.query('select status from shop_orders where id=$1',[saved.order.id])).rows[0].status,'new');
  assert.equal((await app.query('select count(*)::int n from order_events where order_id=$1',[saved.order.id])).rows[0].n,4);
  await owner.query('drop trigger reject_order_log on admin_log');
 });
 await t.test('failed removal rolls back everything; successful removal retains historical order',async()=>{
  await owner.query("create function reject_archive() returns trigger language plpgsql as $$ begin raise exception 'test archive failure'; end $$; create trigger reject_archive before update on products for each row execute function reject_archive()");
  await assert.rejects(deleteCustomProduct(app,'custom-test',user.id),/test archive failure/);
  assert.equal((await app.query("select count(*)::int n from custom_products where product_id='custom-test'")).rows[0].n,1);
  assert.equal((await app.query("select count(*)::int n from product_visibility where product_id='custom-test'")).rows[0].n,1);
  await owner.query('drop trigger reject_archive on products');
  assert.equal(await deleteCustomProduct(app,'custom-test',user.id),true);
  assert.ok((await app.query("select archived_at from products where id='custom-test'")).rows[0].archived_at);
  assert.equal((await app.query('select name from order_items where order_id=$1',[saved.order.id])).rows[0].name,'Historical name');
  assert.equal((await app.query("select count(*)::int n from admin_log where action='product-delete'")).rows[0].n,1);
 });
 await t.test('backup restores every table and validates order totals', {skip:!process.env.NSP_TEST_BACKUP&&'Run with NSP_TEST_BACKUP=1 and PostgreSQL 18 client tools'},async()=>{
  const before=await databaseFingerprint(owner);
  const result=await backupDatabase(url,{directory:join(dir,'backups')});
  assert.deepEqual(result.fingerprint,before);
  assert.equal(result.verification.tables,Object.keys(before).length);
  assert.equal((await stat(result.file)).mode&0o777,0o600);
  assert.equal(JSON.parse(await readFile(join(dir,'backups/latest.json'),'utf8')).sha256,result.sha256);
  assert.deepEqual(await databaseFingerprint(owner),before);
  assert.equal((await owner.query("select count(*)::int n from pg_database where datname like 'nsp_restore_check_%'")).rows[0].n,0);
 });
});
