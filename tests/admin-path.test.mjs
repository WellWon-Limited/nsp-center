import test from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_PATH,isStaffPage} from '../src/admin-path.mjs';
import {pageOf} from '../src/page-warmup.mjs';
import {readResumePage,RESUME_PAGE_KEY} from '../src/app-resume.mjs';

test('the current staff address stays outside customer offline navigation and resume memory',()=>{
 assert.notEqual(ADMIN_PATH,'/admin/');
 for(const path of [ADMIN_PATH,ADMIN_PATH.slice(0,-1),ADMIN_PATH+'?section=products',ADMIN_PATH+'index.html','/admin','/admin/']){
  assert.equal(isStaffPage(path),true,path);
  assert.equal(pageOf(path,'https://nsp-center.ru/'),null,path);
  assert.equal(readResumePage({getItem:key=>key===RESUME_PAGE_KEY?JSON.stringify({url:path,at:1}):null}),null,path);
 }
 for(const path of ['/','/catalog/','/product/aloe/'])assert.equal(isStaffPage(path),false,path);
});

test('the current staff entry works and the retired address reveals no replacement',{skip:!process.env.NSP_TEST_URL},async()=>{
 const get=path=>fetch(new URL(path,process.env.NSP_TEST_URL),{redirect:'manual'});
 const response=await get(ADMIN_PATH);assert.equal(response.status,200);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.match(await response.text(),/admin-app--loading/);
 for(const path of ['/admin','/admin/','/admin/index.html','/admin/?section=products']){const r=await get(path);assert.equal(r.status,404,path);assert.equal(r.headers.get('location'),null,path);assert.doesNotMatch(await r.text(),/class="admin-app/)}
 const sitemap=await(await get('/sitemap.xml')).text();assert.ok(!sitemap.includes(ADMIN_PATH));
 for(const path of ['/api/admin/me','/api/admin/overview','/api/admin/card-applications'])assert.equal((await get(path)).status,401,path);
});
