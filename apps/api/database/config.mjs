import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {homedir} from 'node:os';
import {join} from 'node:path';
export const adminEnvFile=process.env.NSP_DB_ADMIN_ENV||join(homedir(),'.config/nsp-center/database-admin.env');
export async function adminUrl() {
 if(process.env.DATABASE_ADMIN_URL)return process.env.DATABASE_ADMIN_URL;
 try{return parseEnv(await readFile(adminEnvFile,'utf8')).DATABASE_ADMIN_URL;}catch(error){if(error.code!=='ENOENT')throw error;}
 throw new Error('Management credentials missing. Run npm run db:secure locally first, or set DATABASE_ADMIN_URL for migration tooling only.');
}
export async function migrationOptions() {
 const content=JSON.parse(await readFile(new URL('../../../packages/catalog/generated/content.json',import.meta.url),'utf8'));
 return {products:content.products,themes:content.themes,pickupAddress:content.site.address,corpusFile:process.env.AI_CORPUS_FILE||join(homedir(),'.local/state/nsp-center/lecture-corpus.jsonl')};
}
