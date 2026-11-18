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
