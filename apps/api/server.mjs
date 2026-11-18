import {createServer} from 'node:http';
import {readFile,chmod} from 'node:fs/promises';
import {createApi} from './app.mjs';

// Only the API process loads database credentials and integration keys.
if(process.env.NSP_LOAD_ENV!=='0'){
  try{process.loadEnvFile(new URL('../../.env',import.meta.url));}catch(error){if(error.code!=='ENOENT')throw error;}
}
const content=JSON.parse(await readFile(new URL('../../packages/catalog/generated/content.json',import.meta.url),'utf8'));
const app=await createApi({content});
const server=createServer(app.handle);
const port=process.env.API_PORT?.trim()?Number(process.env.API_PORT):8701,host=process.env.API_HOST||'127.0.0.1';
const socket=process.env.API_SOCKET;
if(socket)server.listen(socket,async()=>{await chmod(socket,0o600);console.log(`NSP API: unix:${socket}`);});
else server.listen(port,host,()=>console.log(`NSP API: http://${host}:${server.address().port}`));
const stop=()=>{server.close(async()=>{await app.close();process.exit(0);});server.closeIdleConnections();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
