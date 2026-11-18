import pg from 'pg';
import {adminUrl,migrationOptions} from './config.mjs';
import {migrateDatabase} from './migrate.mjs';
import {grantApplicationAccess} from './permissions.mjs';
const pool=new pg.Pool({connectionString:await adminUrl(),max:2});
try {
 const applied=await migrateDatabase(pool,await migrationOptions());
 await grantApplicationAccess(pool);
 console.log(`Database ready. Applied migrations: ${applied.join(', ')||'none (already current)'}. Catalog synchronized.`);
} finally {await pool.end();}
