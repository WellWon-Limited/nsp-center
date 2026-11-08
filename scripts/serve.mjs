import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { adaptPrototype, ORIGINAL_PROTOTYPE } from './prototype-adapter.mjs';
import { isIndexableHost, BLOCKED_ROBOTS, NOINDEX_HEADER } from './indexing.mjs';
import { createAccounts } from './accounts.mjs';
// Local settings (DATABASE_URL of the local Postgres, scripts/local-db.mjs) live in .env, which git ignores; the dev stand
// gets them from its environment instead.
try{process.loadEnvFile('.env');}catch{/* no .env */}
const dist=resolve('dist');
const manifest=JSON.parse(await readFile(resolve(dist,'prerender-manifest.json'),'utf8'));
const routes=new Map(manifest.routes.map(r=>[r.url,r.file]));
const content=JSON.parse(await readFile('src/generated/content.json','utf8'));
const accounts=await createAccounts({databaseUrl:process.env.DATABASE_URL,productIds:new Set(content.products.map(p=>p.id)),adminEmails:(process.env.ADMIN_EMAILS||'').split(',')});
// Local-only design reference, never copied into dist: the app prototype adapted for device frames,
// and the untouched original for comparison.
const originalPrototype=await readFile(resolve(ORIGINAL_PROTOTYPE));
const prototypes=new Map([['/app-prototype/',Buffer.from(adaptPrototype(originalPrototype.toString('utf8')))],['/app-prototype/original/',originalPrototype]]);
const mime={'.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let path=decodeURIComponent(url.pathname);
 // Only the production domain is indexable; every other host (dev stand, local) is blocked.
 const indexable=isIndexableHost(req.headers.host);if(!indexable)res.setHeader('X-Robots-Tag',NOINDEX_HEADER);
 if(path.startsWith('/api/')){await accounts.handle(req,res,url);return;}
 if(!indexable&&path==='/robots.txt'){res.writeHead(200,{'Content-Type':mime['.txt'],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:BLOCKED_ROBOTS);return;}
if(content.redirects[path]){res.writeHead(308,{Location:content.redirects[path]});res.end();return;}if(!path.endsWith('/')&&!extname(path)){res.writeHead(308,{Location:path+'/'+url.search});res.end();return;}
 if(prototypes.has(path)){const bytes=prototypes.get(path);res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else res.end(bytes);return;}
 const page=url.searchParams.get('PAGEN_1');const key=path+(page?'?PAGEN_1='+page:'');const file=routes.get(key)||routes.get(path)||(path==='/'?'index.html':path.replace(/^\//,''));let target=resolve(dist,file);if(target!==dist&&!target.startsWith(dist+sep)){res.writeHead(403);res.end();return;}
 let status=200;try{const info=await stat(target);if(!info.isFile())throw new Error('not file');}catch{target=resolve(dist,'404/index.html');status=404;}
 const bytes=await readFile(target);res.writeHead(status,{'Content-Type':mime[extname(target)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else res.end(bytes);
}catch{res.writeHead(400);res.end('Bad request');}});
const port=Number(process.env.PORT)||5217;const host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`NSP Center: http://${host}:${port}${accounts.enabled?" · accounts: Postgres":""} ${process.env.WW_TEST==='1'?`(isolated ${process.env.WW_TEST_ID||''})`:''}`));
