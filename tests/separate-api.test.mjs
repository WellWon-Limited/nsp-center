import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createServer} from 'node:net';
import pg from 'pg';
import {hashPassword} from '../apps/api/accounts.mjs';
import {ADMIN_PATH} from '../src/admin-path.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const exec=promisify(execFile);
const cleanEnv={PATH:process.env.PATH,HOME:process.env.HOME,NSP_LOAD_ENV:'0',CBR_ENABLED:'0',API_HOST:'127.0.0.1',API_PORT:'0',HOST:'127.0.0.1',PORT:'0'};
async function launch(entry,cwd,env){
  const child=spawn(process.execPath,[entry],{cwd,env:{...cleanEnv,...env},stdio:['ignore','pipe','pipe']});
  let log='';
  const origin=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{child.kill();reject(new Error('Server startup timed out'));},15000);
    child.once('error',error=>{clearTimeout(timer);reject(error);});
    child.once('exit',code=>{clearTimeout(timer);reject(new Error(`Server exited during startup (${code}): ${log.slice(-1500)}`));});
    child.stderr.on('data',b=>{log+=b;});
    child.stdout.on('data',b=>{log+=b;const url=log.match(/http:\/\/127\.0\.0\.1:\d+|unix:[^\n]+/)?.[0];if(url){clearTimeout(timer);resolve(url);}});
  });
  return {origin,async stop(){if(child.exitCode!==null||child.signalCode)return;const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');const timer=setTimeout(()=>child.kill('SIGKILL'),5000);await exited;clearTimeout(timer);}};
}
async function fixture(t){
  const dir=await mkdtemp(join(tmpdir(),'nsp-separated-api-'));
  await cp(join(root,'apps/api'),join(dir,'apps/api'),{recursive:true});
  await cp(join(root,'packages/domain'),join(dir,'packages/domain'),{recursive:true});
  await mkdir(join(dir,'packages/catalog/generated'),{recursive:true});
  await cp(join(root,'packages/catalog/generated/content.json'),join(dir,'packages/catalog/generated/content.json'));
  await symlink(join(root,'node_modules'),join(dir,'node_modules'),'dir');
  return dir;
}
async function unusedPort(){const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;await new Promise(r=>server.close(r));return port;}

test('API starts without src, dist, frontend tools or .env; disabled integrations remain explicit',async t=>{
  const dir=await fixture(t);
  const socket='/tmp/nsp-api-test-'+process.pid+'.sock';
  const api=await launch('apps/api/server.mjs',dir,{API_SOCKET:socket,AI_CORPUS_FILE:join(dir,'no-corpus')});
  const web=await launch('scripts/serve.mjs',root,{API_SOCKET:socket});
  t.after(async()=>{await web.stop();await api.stop();await rm(dir,{recursive:true,force:true});});
  const get=path=>fetch(web.origin+path);
  assert.deepEqual(await(await get('/api/health')).json(),{service:'nsp-api',databaseConfigured:false});
  assert.equal((await get('/api/auth/me')).status,503);
  assert.deepEqual(await(await get('/api/storefront/page?path=/sitemap.xml')).json(),{enabled:false});
  assert.equal((await get('/')).status,200);
  assert.equal((await get('/sitemap.xml')).status,200);
  assert.equal((await get('/api/cdek?action=config')).status,200);
  assert.equal((await get('/api/ai/status')).status,200);
});

test('independent web and API preserve sessions, uploads, catalog pages and operation after API restart',
  {skip:process.getuid?.()===0&&'Postgres does not run as root',timeout:90000},async t=>{
  const dir=await fixture(t);
  const {default:EmbeddedPostgres}=await import('embedded-postgres');
  const port=await unusedPort();
  const database=new EmbeddedPostgres({databaseDir:join(dir,'db'),port,user:'test',password:'test',persistent:false,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});
  await database.initialise();await database.start();await database.createDatabase('separation');
  let api,web,admin,pool;
  t.after(async()=>{await admin?.stop();await web?.stop();await api?.stop();await pool?.end();await database.stop();await rm(dir,{recursive:true,force:true});});
  const url=`postgres://test:test@127.0.0.1:${port}/separation`;
  pool=new pg.Pool({connectionString:url});
  api=await launch('apps/api/server.mjs',dir,{DATABASE_URL:url,AI_CORPUS_FILE:join(dir,'no-corpus')});
  const apiPort=new URL(api.origin).port;
  web=await launch('scripts/serve.mjs',root,{API_ORIGIN:api.origin});
  const request=(path,{method='GET',body,cookie='',headers={}}={})=>fetch(web.origin+path,{method,headers:{Origin:web.origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,redirect:'manual'});
  assert.equal((await request('/api/admin/me')).status,401);
  const response=await request('/api/auth/register',{method:'POST',body:{firstName:'Анна',lastName:'Тест',email:'split@example.ru',phone:'',password:'test-password-2026',consent:true}});
  assert.equal(response.status,201);const customer=response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
  assert.equal((await request('/api/account',{method:'PUT',cookie:customer,body:{data:{cart:{alfalfa:2}}}})).status,200);
  assert.equal((await request('/api/admin/overview',{cookie:customer})).status,401);
  assert.equal((await request('/api/account',{method:'PUT',cookie:customer,body:{data:{}},headers:{Origin:'https://unrelated.example'}})).status,403);
  assert.equal((await request('/api/account',{method:'PUT',cookie:customer,body:{data:{}},headers:{Origin:'https://unrelated.example','X-Forwarded-Host':'unrelated.example'}})).status,403);
  await pool.query("insert into users(email,first_name,last_name,password_hash,consent_at,role) values($1,'Сотрудник','Тест',$2,now(),'admin')",['staff@example.ru',await hashPassword('staff-password-2026')]);
  const login=await request('/api/admin/login',{method:'POST',body:{login:'staff@example.ru',password:'staff-password-2026'}});
  assert.equal(login.status,200);const staff=login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'),/SameSite=Strict/);
  const png=Buffer.from('89504e470d0a1a0a','hex');
  const upload=await fetch(web.origin+'/api/admin/upload?product=content&kind=image&name=test.png',{method:'POST',headers:{Origin:web.origin,Cookie:staff,'Content-Type':'image/png'},body:png});
  assert.equal(upload.status,201);const image=(await upload.json()).url;
  assert.deepEqual(Buffer.from(await(await request(image)).arrayBuffer()),png);
  const content=JSON.parse(await readFile(join(root,'packages/catalog/generated/content.json'),'utf8'));
  const category=content.categories.find(c=>c.path!=='/catalog/');
  const created=await request('/api/admin/new-product',{method:'PUT',cookie:staff,body:{product:{name:'Тест разделения',article:'SPLIT-TEST-1',categoryPath:category.path,retailRub:1000,partnerRub:700,availability:'InStock'},content:{image,photos:[image]},publish:true}});
  assert.equal(created.status,200,await created.clone().text());
  const productResult=await created.json();
  const product=productResult.extraProducts.find(p=>p.id===productResult.id);assert.ok(product);
  const page=await request(product.path);assert.equal(page.status,200);assert.match(await page.text(),/Тест разделения/);
  const publicPage=await(await request('/api/storefront/page?path='+encodeURIComponent(product.path))).json();
  assert.equal(publicPage.product.prices.partner,null);
  assert.equal((await request('/api/card-prices')).status,401);
  await t.test('all saved URLs, indexing, staff route and prototype work through the separated web server',async()=>{
    const result=await exec(process.execPath,['--test','tests/build.test.mjs','tests/indexing.test.mjs','tests/prototype.test.mjs','tests/admin-path.test.mjs'],{cwd:root,env:{...cleanEnv,NSP_TEST_URL:web.origin},maxBuffer:2_000_000});
    assert.match(result.stdout,/fail 0/);assert.match(result.stdout,/skipped 0/);
  });
  const state=await(await request('/api/site',{cookie:staff})).json();
  const categoryResult=await request('/api/admin/categories',{method:'PUT',cookie:staff,body:{action:'create',name:'Проверка разделения',parent:'/catalog/',revision:state.catalog.revision}});
  assert.equal(categoryResult.status,200,await categoryResult.clone().text());
  const changed=await(await request('/api/site',{cookie:staff})).json();
  const newCategory=changed.catalog.categories.find(c=>c.name==='Проверка разделения');assert.ok(newCategory);
  const html=await request(newCategory.path);assert.equal(html.status,200);assert.match(await html.text(),/Проверка разделения/);
  const sitemap=await(await request('/sitemap.xml')).text();assert.ok(sitemap.includes(product.path));
  assert.equal((await request(ADMIN_PATH)).status,302);
  // The admin artifact runs in a directory with no storefront dist, source or .env.
  const adminDir=join(dir,'standalone-admin');
  await cp(join(root,'dist-admin'),join(adminDir,'dist-admin'),{recursive:true});
  await mkdir(join(adminDir,'apps/admin'),{recursive:true});
  await mkdir(join(adminDir,'scripts'),{recursive:true});
  await cp(join(root,'apps/admin/server.mjs'),join(adminDir,'apps/admin/server.mjs'));
  await cp(join(root,'scripts/api-client.mjs'),join(adminDir,'scripts/api-client.mjs'));
  await cp(join(root,'packages/domain'),join(adminDir,'packages/domain'),{recursive:true});
  admin=await launch('apps/admin/server.mjs',adminDir,{API_ORIGIN:api.origin,ADMIN_PORT:'0',SITE_ORIGIN:web.origin});
  const adminRequest=(path,{method='GET',body,cookie='',headers={}}={})=>fetch(admin.origin+path,{method,headers:{Origin:admin.origin,...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},body:body?JSON.stringify(body):undefined,redirect:'manual'});
  assert.equal((await adminRequest('/api/admin/preview-data?product=alfalfa')).status,401);
  assert.equal((await adminRequest('/api/admin/preview-data?product=alfalfa',{cookie:customer})).status,401);
  const adminLogin=await adminRequest('/api/admin/login',{method:'POST',body:{login:'staff@example.ru',password:'staff-password-2026'}});
  assert.equal(adminLogin.status,200);const adminCookie=adminLogin.headers.get('set-cookie').split(';')[0];
  await web.stop();
  await assert.rejects(fetch(web.origin));
  const adminHtml=await adminRequest(ADMIN_PATH);assert.equal(adminHtml.status,200);assert.equal(adminHtml.headers.get('x-robots-tag'),'noindex, nofollow');
  const markup=await adminHtml.text();assert.match(markup,/admin-app--loading/);assert.ok(markup.includes(web.origin));
  for(const [,asset] of markup.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g))assert.equal((await adminRequest(asset)).status,200,asset);
  const preview=await adminRequest('/api/admin/preview-data?product=alfalfa',{cookie:adminCookie});assert.equal(preview.status,200);
  const full=(await preview.json()).product;assert.equal(full.id,'alfalfa');assert.ok(full.description);
  for(const path of ['/video/','/company/faq/']){
    const page=await adminRequest('/api/admin/preview-data?page='+encodeURIComponent(path),{cookie:adminCookie});assert.equal(page.status,200);assert.ok((await page.json()).page.html);
  }
  assert.equal((await adminRequest('/api/admin/preview-data?product=missing',{cookie:adminCookie})).status,404);
  assert.equal((await adminRequest('/api/admin/overview',{cookie:adminCookie})).status,200);
  assert.equal((await adminRequest('/api/admin/product',{method:'PUT',cookie:adminCookie,body:{productId:'alfalfa',retailRub:1234},headers:{Origin:'https://unrelated.example'}})).status,403);
  const saved=await adminRequest('/api/admin/product',{method:'PUT',cookie:adminCookie,body:{productId:'alfalfa',retailRub:1234}});assert.equal(saved.status,200,await saved.clone().text());
  assert.equal((await adminRequest(image)).status,200,'uploaded image is served by API with website stopped');
  assert.equal((await adminRequest('/icons/icon.svg')).status,200,'preview assets belong to admin artifact');
  for(const path of ['/product/alfalfa/','/admin/','/.env','/.vite/manifest.json'])assert.equal((await adminRequest(path)).status,404,path);
  await api.stop();
  assert.equal((await adminRequest('/')).status,200);
  assert.equal((await adminRequest('/api/admin/overview',{cookie:adminCookie})).status,503);
  web=await launch('scripts/serve.mjs',root,{API_ORIGIN:api.origin});
  await api.stop();
  assert.equal((await request('/')).status,200,'static pages survive API downtime');
  assert.equal((await request('/api/auth/me',{cookie:customer})).status,503);
  api=await launch('apps/api/server.mjs',dir,{DATABASE_URL:url,API_PORT:apiPort,AI_CORPUS_FILE:join(dir,'no-corpus')});
  const account=await(await request('/api/auth/me',{cookie:customer})).json();assert.equal(account.data.cart.alfalfa,2);
  assert.equal((await request('/api/admin/me',{cookie:staff})).status,200);
});
