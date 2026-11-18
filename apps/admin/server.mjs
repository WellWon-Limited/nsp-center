import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {ADMIN_PATH} from '../../packages/domain/admin-path.mjs';
import {createApiClient} from '../../scripts/api-client.mjs';
const dist=resolve(process.env.ADMIN_DIST||'dist-admin');
const api=createApiClient();
const site=new URL(process.env.SITE_ORIGIN||'http://127.0.0.1:5217');
if(!['http:','https:'].includes(site.protocol)||site.username||site.password)throw Error('Invalid SITE_ORIGIN');
const escape=value=>value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const renderHtml=async()=>(await readFile(resolve(dist,'index.html'),'utf8')).replace(/(<meta name="nsp-site-origin" content=")[^"]*(")/,(_,before,after)=>before+escape(site.origin)+after);
const types={'.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf','.mp4':'video/mp4','.ico':'image/x-icon'};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 try{
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(path.startsWith('/api/'))return api.proxy(req,res);
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  if(path==='/robots.txt'){res.setHeader('Content-Type','text/plain');res.end(req.method==='HEAD'?undefined:'User-agent: *\nDisallow: /\n');return;}
  if(path===ADMIN_PATH.slice(0,-1)){res.writeHead(308,{Location:ADMIN_PATH+url.search});res.end();return;}
  if(path==='/'||path===ADMIN_PATH||path===ADMIN_PATH+'index.html'){
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.method==='HEAD'?undefined:await renderHtml());return;
  }
  const target=resolve(dist,'.'+path),type=types[extname(path).toLowerCase()];
  if(!target.startsWith(dist+sep)||!type||!(await stat(target).catch(()=>null))?.isFile()){
   res.writeHead(404);res.end(req.method==='HEAD'?undefined:'Not found');return;
  }
  res.setHeader('Content-Type',type);res.setHeader('Cache-Control',path.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache');
  res.end(req.method==='HEAD'?undefined:await readFile(target));
 }catch(error){res.writeHead(error instanceof URIError?400:503);res.end('Service unavailable');}
});
const host=process.env.ADMIN_HOST||'127.0.0.1';
server.listen(Number(process.env.ADMIN_PORT??5218),host,()=>console.log(`NSP Admin: http://${host}:${server.address().port}`));
const stop=()=>{server.close(()=>process.exit(0));server.closeIdleConnections()};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
