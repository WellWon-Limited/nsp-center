import pg from 'pg';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {access,mkdir,writeFile,chmod,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
const exec=promisify(execFile);
export const backupDirectory=process.env.NSP_BACKUP_DIR||join(homedir(),'.local/state/nsp-center/backups');
const identifier=x=>'"'+x.replaceAll('"','""')+'"';
async function binary(name) {
 const candidates=[...(process.env.PG_BIN_DIR?[join(process.env.PG_BIN_DIR,name)]:[]),join(homedir(),'Applications/pgAdmin 4.app/Contents/SharedSupport',name)];
 for(const file of candidates)try{await access(file);return file;}catch{}
 return name;
}
function pgEnvironment(url) {
 const u=new URL(url);
 return {...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGDATABASE:decodeURIComponent(u.pathname.slice(1)),PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGCONNECT_TIMEOUT:'15'};
}
export async function runPostgresTool(name,args,url) {
 try{await exec(await binary(name),args,{env:pgEnvironment(url),maxBuffer:4*1024*1024});}
 catch(error){throw new Error(`${name} failed (exit ${error.code??'unknown'}); backup not marked successful.`);}
}
/** Fingerprints contain no row values. The same snapshot is used by pg_dump and this manifest. */
export async function databaseFingerprint(client) {
 const {rows}=await client.query(`select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') and schemaname not like 'pg_toast%' order by schemaname,tablename`);
 const result={};
 for(const {schemaname,tablename} of rows) {
  const name=identifier(schemaname)+'.'+identifier(tablename);
  const {rows:[stats]}=await client.query(`select count(*)::text as count,md5(coalesce(string_agg(value,E'\n' order by value),'')) as digest from (select to_jsonb(t)::text as value from ${name} t) snapshot`);
  result[schemaname+'.'+tablename]=stats;
 }
 return result;
}
export async function restoreAndVerify(url,file,expected) {
 const name='nsp_restore_check_'+randomUUID().replaceAll('-','');
 const owner=new pg.Client({connectionString:url});await owner.connect();
 let created=false,restored;
 try {
  await owner.query(`create database ${identifier(name)} template template0`);created=true;
  const target=new URL(url);target.pathname='/'+name;
  await runPostgresTool('pg_restore',['--no-owner','--no-privileges','--exit-on-error','--single-transaction','--dbname',name,file],target.href);
  restored=new pg.Client({connectionString:target.href});await restored.connect();
  const actual=await databaseFingerprint(restored);
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Restored database differs from backup snapshot.');
  if(expected['public.shop_orders'])await restored.query('select check_order_amounts(id) from shop_orders');
  return {tables:Object.keys(actual).length,verifiedAt:new Date().toISOString()};
 } finally {
  await restored?.end();
  // Only the new, randomly named verification database is removed; never the source database.
  if(created)await owner.query(`drop database ${identifier(name)}`);
  await owner.end();
 }
}
export async function backupDatabase(url,{directory=backupDirectory,verify=true}={}) {
 await mkdir(directory,{recursive:true,mode:0o700});await chmod(directory,0o700);
 const client=new pg.Client({connectionString:url});await client.connect();
 let locked=false;
 try {
  const {rows:[lock]}=await client.query("select pg_try_advisory_lock(hashtextextended('nsp-backup',0)) as acquired");
  if(!lock.acquired)throw new Error('Another backup is already running.');locked=true;
  await client.query('begin isolation level repeatable read read only');
  const {rows:[snapshot]}=await client.query('select pg_export_snapshot() as id');
  const fingerprint=await databaseFingerprint(client);
  const file=join(directory,'nsp-'+new Date().toISOString().replaceAll(':','-')+'-'+randomUUID().slice(0,8)+'.dump');
  const partial=file+'.partial';
  // Reserve a private file before pg_dump opens it (not after sensitive data has been written).
  await writeFile(partial,'',{mode:0o600,flag:'wx'});
  await runPostgresTool('pg_dump',['--format=custom','--no-owner','--no-privileges','--snapshot',snapshot.id,'--file',partial],url);
  await client.query('commit');await rename(partial,file);
  const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);
  const verification=verify?await restoreAndVerify(url,file,fingerprint):null;
  const manifest={file,createdAt:new Date().toISOString(),sha256:hash.digest('hex'),fingerprint,verification};
  await writeFile(file+'.json',JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
  await writeFile(join(directory,'latest.json.tmp'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  await rename(join(directory,'latest.json.tmp'),join(directory,'latest.json'));
  return manifest;
 } finally {
  await client.query('rollback').catch(()=>{});
  if(locked)await client.query("select pg_advisory_unlock(hashtextextended('nsp-backup',0))").catch(()=>{});
  await client.end();
 }
}
