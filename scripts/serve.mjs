import {homedir} from 'node:os';
import {managedCatalogPage} from './catalog-pages.mjs';
import {managedCategoryList,catalogAdminState} from './catalog-admin.mjs';
import {visibleCategories} from '../src/catalog-categories.mjs';
import {join} from 'node:path';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { adaptPrototype, ORIGINAL_PROTOTYPE } from './prototype-adapter.mjs';
import { isIndexableHost, BLOCKED_ROBOTS, NOINDEX_HEADER } from './indexing.mjs';
import { createAccounts } from './accounts.mjs';
import { productBase, findCustomProduct, customRows, findContentArticle, contentArticlePaths } from './site-admin.mjs';
import { customProduct } from '../src/custom-product.mjs';
import { createAi } from './ai-agent.mjs';
// Local settings (DATABASE_URL of the local Postgres, scripts/local-db.mjs) live in .env, which git ignores; the dev stand
// gets them from its environment instead.
try{process.loadEnvFile('.env');}catch{/* no .env */}
const dist=resolve('dist');
const manifest=JSON.parse(await readFile(resolve(dist,'prerender-manifest.json'),'utf8'));
const routes=new Map(manifest.routes.map(r=>[r.url,r.file]));
const content=JSON.parse(await readFile('src/generated/content.json','utf8'));
const accounts=await createAccounts({databaseUrl:process.env.DATABASE_URL,productIds:new Set(content.products.map(p=>p.id)),productBase:id=>productBase(content.products.find(p=>p.id===id)),cardProducts:content.products,buildRate:content.pricing.rubPerUnit,categories:content.categories,knowledgeThemes:content.themes,lectureCorpusFile:process.env.AI_CORPUS_FILE||join(homedir(),'.local/state/nsp-center/lecture-corpus.jsonl'),articlePaths:content.articles.map(a=>a.path)});
const productPaths=new Map(content.products.map(p=>[p.id,p.path]));
// The consultation agent (off until YANDEX_API_KEY and YANDEX_FOLDER_ID are set; scripts/ai-agent.mjs).
const ai=createAi({content,pool:accounts.enabled?accounts.pool:null});
// Local-only design reference, never copied into dist: the app prototype adapted for device frames,
// and the untouched original for comparison.
const originalPrototype=await readFile(resolve(ORIGINAL_PROTOTYPE));
const prototypes=new Map([['/app-prototype/',Buffer.from(adaptPrototype(originalPrototype.toString('utf8')))],['/app-prototype/original/',originalPrototype]]);
const mime={'.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.pdf':'application/pdf','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');let path=decodeURIComponent(url.pathname);
 // Only the production domain is indexable; every other host (dev stand, local) is blocked.
 const indexable=isIndexableHost(req.headers.host);if(!indexable||/^\/admin(\/|$)/.test(new URL(req.url,'http://x').pathname))res.setHeader('X-Robots-Tag',NOINDEX_HEADER);
 if(path.startsWith('/api/ai/')){await ai.handle(req,res,url);return;}
 if(path.startsWith('/api/')){await accounts.handle(req,res,url);return;}
 if(!indexable&&path==='/robots.txt'){res.writeHead(200,{'Content-Type':mime['.txt'],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:BLOCKED_ROBOTS);return;}
if(content.redirects[path]){res.writeHead(308,{Location:content.redirects[path]});res.end();return;}if(!path.endsWith('/')&&!extname(path)){res.writeHead(308,{Location:path+'/'+url.search});res.end();return;}
 if(prototypes.has(path)){const bytes=prototypes.get(path);res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});if(req.method==='HEAD')res.end();else res.end(bytes);return;}
 if(accounts.enabled&&path.startsWith('/catalog/')&&path!=='/catalog/'){
  const managed=await managedCatalogPage(accounts.pool,content,manifest,dist,path,url);
  if(managed?.redirect){res.writeHead(301,{Location:managed.redirect});res.end();return;}
  if(managed?.html){res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:managed.html);return;}
 }
 const page=url.searchParams.get('PAGEN_1');const key=path+(page?'?PAGEN_1='+page:'');const file=routes.get(key)||routes.get(path)||(path==='/'?'index.html':path.replace(/^\//,''));let target=resolve(dist,file);if(target!==dist&&!target.startsWith(dist+sep)){res.writeHead(403);res.end();return;}
 let status=200,modified=null;try{const info=await stat(target);if(!info.isFile())throw new Error('not file');modified=info.mtime;}catch{target=resolve(dist,'404/index.html');status=404;}
 // A card created in site management has no built page: the not-found page's shell carries it, and the browser renders it.
 const created=status===404&&accounts.enabled&&/^\/product\/[a-z0-9-]+\/$/.test(path)?await findCustomProduct(accounts.pool,path.split('/')[2],await managedCategoryList(accounts.pool,content.categories)).catch(()=>null):null;
 // An article added in site management: the same shell, with the article's text right in the page for search engines.
 const added=status===404&&!created&&accounts.enabled&&/^\/blog\/[a-z0-9-]+\/$/.test(path)?await findContentArticle(accounts.pool,path.split('/')[2],productPaths).catch(()=>null):null;
 if(added){const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const shell=(await readFile(target,'utf8')).replace(/<title>.*?<\/title>/s,`<title>${esc(added.title)} | NSP Center</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc((added.description||added.title).slice(0,200))}"/>`).replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="https://nsp-center.ru${added.path}"/>`).replace(/(<div id="root"[^>]*>)[\s\S]*?(<\/div><script type="application\/json" id="nsp-page-data">)/,`$1<main class="site-main"><article class="article-detail"><h1>${esc(added.title)}</h1>${added.html}</article></main>$2`).replace(/(<script type="application\/json" id="nsp-page-data">).*?(<\/script>)/s,`$1${JSON.stringify({article:added}).replace(/</g,'\\u003c')}$2`);
  res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:shell);return;}
 if(created){const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const shell=(await readFile(target,'utf8')).replace(/<title>.*?<\/title>/s,`<title>${esc(created.name)} | NSP Center</title>`).replace(/<meta name="description"[^>]*>/,`<meta name="description" content="${esc(created.name)} — купить в NSP Center."/>`).replace(/<link rel="canonical"[^>]*>/,`<link rel="canonical" href="https://nsp-center.ru${created.path}"/>`).replace(/(<script type="application\/json" id="nsp-page-data">).*?(<\/script>)/s,`$1${JSON.stringify({product:created}).replace(/</g,'\\u003c')}$2`);
  res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:shell);return;}
 // The sitemap also lists the created cards that customers can see.
 if(path==='/sitemap.xml'&&accounts.enabled){const settings=await accounts.pool.query('select product_id, hidden from product_visibility').catch(()=>({rows:[]}));const hidden=new Set(settings.rows.filter(r=>r.hidden).map(r=>r.product_id));const extra=(await customRows(accounts.pool).catch(()=>[])).filter(r=>!hidden.has(r.product_id)).map(r=>`<url><loc>https://nsp-center.ru${customProduct(r.product_id,r.data,content.categories).path}</loc></url>`).join('')+(await contentArticlePaths(accounts.pool).catch(()=>[])).map(p=>`<url><loc>https://nsp-center.ru${p}</loc></url>`).join('');
  const managed=await catalogAdminState(accounts.pool,content.categories,content.products);
  const categoryUrls=visibleCategories(managed.categories,managed.products).filter(c=>!content.categories.some(x=>x.path===c.path)).map(c=>`<url><loc>https://nsp-center.ru${c.path}</loc></url>`).join('');
  const xml=(await readFile(target,'utf8')).replace('</urlset>',extra+categoryUrls+'</urlset>');res.writeHead(200,{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:xml);return;}
 // Fonts and hashed bundles never change under the same address: kept by the browser, so the header text does not
 // flash between pages while a font is re-checked.
 const forever=/^\/(assets|prototype\/fonts|fonts)\//.test(path);
 // Photos and icons are kept by the browser for a week (a changed photo gets a new file name, -v2), so a page seen before
 // shows them at once without the network. Every other file says when it changed, so a re-check costs no download.
 const kept=/^\/(images|icons)\//.test(path);
 const type=mime[extname(target)]||'application/octet-stream',html=type===mime['.html'];
 const stamp=status===200&&modified&&!html?new Date(Math.floor(modified.getTime()/1000)*1000).toUTCString():null;
 const cache=status!==200?'no-cache':forever?'public, max-age=31536000, immutable':kept?'public, max-age=604800, stale-while-revalidate=86400':'no-cache';
 const headers={'Content-Type':type,'Cache-Control':cache,'X-Content-Type-Options':'nosniff',...(stamp?{'Last-Modified':stamp}:{})};
 const since=Date.parse(req.headers['if-modified-since']||'');
 if(stamp&&!Number.isNaN(since)&&since>=Date.parse(stamp)){res.writeHead(304,headers);res.end();return;}
 const bytes=await readFile(target);res.writeHead(status,headers);if(req.method==='HEAD')res.end();else res.end(bytes);
}catch{res.writeHead(400);res.end('Bad request');}});
const port=Number(process.env.PORT)||5217;const host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`NSP Center: http://${host}:${port}${accounts.enabled?" · accounts: Postgres":""}${ai.enabled?` · AI: ${ai.provider}`:""} ${process.env.WW_TEST==='1'?`(isolated ${process.env.WW_TEST_ID||''})`:''}`));
