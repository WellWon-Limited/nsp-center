// Local provisioning only. The API never loads this owner credential file.
import pg from 'pg';
import {readFile,writeFile,mkdir,chmod} from 'node:fs/promises';
import {dirname} from 'node:path';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {adminEnvFile} from '../apps/api/database/config.mjs';
import {grantApplicationAccess,APP_ROLE} from '../apps/api/database/permissions.mjs';
const file=new URL('../.env',import.meta.url);
const env=await readFile(file,'utf8');
let owner;
try {owner=parseEnv(await readFile(adminEnvFile,'utf8')).DATABASE_ADMIN_URL;}catch(error){if(error.code!=='ENOENT')throw error;}
owner ||= parseEnv(env).DATABASE_URL;
const url=new URL(owner);
if(!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Provisioning is local only.');
const pool=new pg.Pool({connectionString:owner,max:1});
try {
 const {rows:[role]}=await pool.query('select rolsuper from pg_roles where rolname=current_user');
 if(!role.rolsuper)throw new Error('Owner connection required for local provisioning.');
 await mkdir(dirname(adminEnvFile),{recursive:true,mode:0o700});
 await writeFile(adminEnvFile,`DATABASE_ADMIN_URL=${owner}\n`,{mode:0o600});await chmod(adminEnvFile,0o600);
 const password=randomBytes(32).toString('hex');
 const exists=await pool.query('select 1 from pg_roles where rolname=$1',[APP_ROLE]);
 // Password contains only generated hexadecimal characters; PostgreSQL role DDL has no bind parameters.
 await pool.query(`${exists.rowCount?'alter':'create'} role nsp_app login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls password '${password}'`);
 if((await pool.query("select to_regclass('public.schema_migrations') as table_name")).rows[0].table_name)await grantApplicationAccess(pool);
 url.username=APP_ROLE;url.password=password;
 await writeFile(file,env.replace(/^DATABASE_URL=.*$/m,`DATABASE_URL=${url.href}`),{mode:0o600});await chmod(file,0o600);
 console.log('Local API role configured. Owner credentials are stored separately outside the repository. Restart the API after db:migrate.');
} finally{await pool.end();}
