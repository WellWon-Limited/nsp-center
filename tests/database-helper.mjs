import pg from 'pg';
import {createAccounts as createUnpreparedAccounts} from '../apps/api/accounts.mjs';
import {migrateDatabase} from '../apps/api/database/migrate.mjs';
export async function createAccounts(options={}) {
 if(options.pool||options.databaseUrl){
  const pool=options.pool??new pg.Pool({connectionString:options.databaseUrl});
  try{await migrateDatabase(pool,{products:options.cardProducts,productIds:options.productIds??[],pickupAddress:options.pickupAddress,themes:options.knowledgeThemes,corpusFile:options.lectureCorpusFile});}
  finally{if(!options.pool)await pool.end();}
 }
 return createUnpreparedAccounts(options);
}

/** A separate process owns PostgreSQL and its shutdown hooks; test failures stay visible. */
export async function startTestPostgres(databaseDir,port,name){
 const {spawn}=await import('node:child_process');
 const {fileURLToPath}=await import('node:url');
 const child=spawn(process.execPath,[fileURLToPath(new URL('./fixtures/postgres.mjs',import.meta.url)),databaseDir,String(port),name],{stdio:['ignore','ignore','pipe','ipc']});
 let errors='';child.stderr.on('data',chunk=>{errors+=chunk});
 const closed=new Promise(resolve=>child.once('close',(code,signal)=>resolve({code,signal})));
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill('SIGTERM');reject(new Error('Test database startup timed out'));},15000);
  child.once('message',message=>{if(message.ready){clearTimeout(timer);resolve();}});
  child.once('error',error=>{clearTimeout(timer);reject(error);});
  child.once('close',code=>{clearTimeout(timer);reject(new Error(`Test database exited during startup (${code}): ${errors}`));});
 });
 return {async stop(){
  if(child.connected)child.send('stop');
  const timer=setTimeout(()=>child.kill('SIGKILL'),10000);
  const result=await closed;clearTimeout(timer);
  if(result.code!==0)throw new Error(`Test database shutdown failed (${result.code??result.signal}): ${errors}`);
 }};
}
