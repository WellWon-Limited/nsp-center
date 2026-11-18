// Restore a verified dump onto a clean PostgreSQL installation, never over a working database.
import {access,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {recoverDatabase} from '../apps/api/database/recover.mjs';
const file=process.argv[2],targetUrl=process.env.RESTORE_DATABASE_URL;
if(!file||!targetUrl)throw new Error('Usage: RESTORE_DATABASE_URL=<owner connection to an empty database> npm run db:restore -- /path/backup.dump');
const output=resolve(process.env.RESTORE_APP_ENV||'.env.recovered');
try{await access(output);throw new Error('Credential output already exists; choose a new RESTORE_APP_ENV.');}catch(error){if(error.code!=='ENOENT')throw error;}
const result=await recoverDatabase({targetUrl,file:resolve(file)});
await writeFile(output,`DATABASE_URL=${result.appUrl}\n`,{mode:0o600,flag:'wx'});
console.log(`Restored and verified ${result.tables} tables. Restricted application credentials saved to ${output}. Source database was not changed.`);
