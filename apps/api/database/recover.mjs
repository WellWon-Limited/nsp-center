import pg from 'pg';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash,randomBytes} from 'node:crypto';
import {databaseFingerprint,runPostgresTool} from './backup.mjs';
import {grantApplicationAccess} from './permissions.mjs';
import {assertDatabaseReady} from './ready.mjs';

/** Restore only into a new database on a clean cluster. Never erase or overwrite a source. */
export async function recoverDatabase({targetUrl,file}) {
 const manifest=JSON.parse(await readFile(file+'.json','utf8'));
 if(!manifest.verification||!/^[a-f0-9]{64}$/.test(manifest.sha256))throw new Error('A verified backup manifest is required.');
 const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
 if(hash.digest('hex')!==manifest.sha256)throw new Error('Backup checksum mismatch; nothing restored.');
 const owner=new pg.Pool({connectionString:targetUrl,max:1});
 try {
  const {rows:[state]}=await owner.query(`select
   (select count(*)::int from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname not in ('pg_catalog','information_schema') and n.nspname not like 'pg_toast%' and c.relkind in ('r','p','v','m','S','f')) objects,
   exists(select 1 from pg_roles where rolname='nsp_app') app_role`);
  if(state.objects!==0||state.app_role)throw new Error('Recovery requires an empty database and a cluster without nsp_app; existing data and roles are never overwritten.');
  await runPostgresTool('pg_restore',['--no-owner','--no-privileges','--exit-on-error','--single-transaction','--dbname',decodeURIComponent(new URL(targetUrl).pathname.slice(1)),file],targetUrl);
  const actual=await databaseFingerprint(owner);
  assert.deepEqual(actual,manifest.fingerprint,'Restored data differs from the backup');
  await owner.query('select check_order_amounts(id) from shop_orders');
  await assertDatabaseReady(owner);
  const password=randomBytes(32).toString('hex');
  await owner.query('begin');
  try{
   await owner.query(`create role nsp_app login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls password '${password}'`);
   await grantApplicationAccess(owner);
   await owner.query('commit');
  }catch(error){await owner.query('rollback');throw error;}
  const appUrl=new URL(targetUrl);appUrl.username='nsp_app';appUrl.password=password;
  const app=new pg.Pool({connectionString:appUrl.href});
  try{await assertDatabaseReady(app);await app.query('select id from order_read limit 1');}
  finally{await app.end();}
  // The URL is returned to a private credential file, never to a console/log.
  return {appUrl:appUrl.href,tables:Object.keys(actual).length,verifiedAt:new Date().toISOString()};
 }finally{await owner.end();}
}
