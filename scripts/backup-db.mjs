import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {adminUrl} from '../apps/api/database/config.mjs';
import {backupDatabase,backupDirectory} from '../apps/api/database/backup.mjs';
const url=await adminUrl(),watch=process.argv.includes('--watch');
const interval=24*60*60*1000;
let working=false;
async function tick(force=false) {
 if(working)return;working=true;
 try {
  let last;try{last=JSON.parse(await readFile(join(backupDirectory,'latest.json'),'utf8'));}catch{}
  if(!force&&last?.verification&&Date.now()-Date.parse(last.createdAt)<interval)return;
  const result=await backupDatabase(url);
  console.log(`Backup saved and restore verified: ${result.verification.tables} tables; ${result.createdAt}`);
 }catch(error){console.error(error.message);if(!watch)process.exitCode=1;}
 finally{working=false;}
}
await tick(!watch && !process.argv.includes('--due'));
if(watch){console.log('Daily local backup service running; checks hourly and catches up after restart.');setInterval(()=>tick(),60*60*1000);}
