import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {seedKnowledge} from '../product-knowledge.mjs';

/** One connection, one transaction and a shared lock: concurrent deploys cannot apply a migration twice. */
export async function migrateDatabase(pool,{products=[],productIds=[],pickupAddress='',themes=[],corpusFile}={}) {
  const client=await pool.connect();
  const applied=[];
  try {
    await client.query('begin');
    await client.query("select pg_advisory_xact_lock(hashtextextended('nsp-schema-migrations',0))");
    await client.query('create table if not exists schema_migrations(version text primary key, checksum text not null, applied_at timestamptz not null default now())');
    const directory=new URL('./migrations/',import.meta.url);
    for(const version of (await readdir(directory)).filter(n=>/^\d{3}_[a-z_]+\.sql$/.test(n)).sort()) {
      const sql=await readFile(new URL(version,directory),'utf8');
      const checksum=createHash('sha256').update(sql).digest('hex');
      const {rows:[old]}=await client.query('select checksum from schema_migrations where version=$1',[version]);
      if(old) {if(old.checksum!==checksum)throw new Error(`Applied migration changed: ${version}`);continue;}
      await client.query(sql);
      await client.query('insert into schema_migrations(version,checksum) values($1,$2)',[version,checksum]);
      applied.push(version);
    }
    const built=new Map([...productIds].map(id=>[id,{id,name:id}]));
    for(const p of products)built.set(p.id,{id:p.id,name:p.name||p.id});
    await client.query("update products set archived_at=coalesce(archived_at,now()) where source='built' and not(id=any($1::text[]))",[[...built.keys()]]);
    for(const p of built.values())await client.query(`insert into products(id,source,name) values($1,'built',$2) on conflict(id) do update set source='built',name=excluded.name,archived_at=null`,[p.id,p.name]);
    await client.query(`insert into products(id,source,name) select product_id,'custom',coalesce(data->>'name',product_id) from custom_products on conflict(id) do update set source='custom',name=excluded.name,archived_at=null`);
    if(pickupAddress.trim())await client.query(`update shop_orders set delivery=delivery || jsonb_build_object('pickupAddress',$1::text,'pickupAddressSource','migration','pickupAddressCapturedAt',now()) where delivery->>'method'='pickup' and not(delivery ? 'pickupAddress')`,[pickupAddress.trim()]);
    await seedKnowledge(client,{products,themes,corpusFile});
    await client.query('commit');
    return applied;
  } catch(error) {await client.query('rollback');throw error;} finally {client.release();}
}
