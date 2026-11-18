import {createAccounts} from './database-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {validateCardApplication} from '../scripts/card-applications.mjs';

test('card application validates required contacts and consent, using the signed-in account email',()=>{
 const user={email:'Owner@Example.ru'},body={firstName:' Анна ',lastName:'Иванова',city:'Москва',address:'Москва, ул. Тестовая, д. 1, кв. 2',phone:'89001234567',consent:true,email:'another@example.ru',userId:999};
 const result=validateCardApplication(body,user);assert.equal(result.value.email,'owner@example.ru');assert.equal(result.value.phone,'+7 (900) 123-45-67');assert.equal(result.value.firstName,'Анна');assert.equal(result.value.userId,undefined);assert.equal(result.value.address,body.address);
 for(const patch of [{firstName:''},{lastName:''},{city:''},{address:''},{address:' '},{address:'А'.repeat(301)},{phone:'123'},{consent:false}])assert.ok(validateCardApplication({...body,...patch},user).error);
});

test('card requests: authenticated applicant, admin approval, ownership, duplicate and concurrency guards',{skip:process.getuid?.()===0&&'Postgres does not run as root'},async t=>{
 const {default:EmbeddedPostgres}=await import('embedded-postgres'),dir=mkdtempSync(join(tmpdir(),'nsp-cards-')),port=25000+Math.floor(Math.random()*12000);
 const pg=new EmbeddedPostgres({databaseDir:join(dir,'db'),port,user:'test',password:'test',persistent:false,autoRehydrateSymlinks:true,onLog:()=>{},onError:()=>{}});
 let accounts,server;
 t.after(async()=>{if(server)await new Promise(r=>server.close(r));if(accounts)await accounts.close();await pg.stop();rmSync(dir,{recursive:true,force:true})});
 await pg.initialise();await pg.start();await pg.createDatabase('cards');
 accounts=await createAccounts({databaseUrl:`postgres://test:test@127.0.0.1:${port}/cards`,cbr:false,productIds:new Set(),cardProducts:[]});
 server=createServer((req,res)=>accounts.handle(req,res,new URL(req.url,'http://x')));await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',body,cookie='')=>{const r=await fetch(base+path,{method,headers:{...(cookie?{Cookie:cookie}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:r.status===204?null:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}};
 const register=async(email)=>{const r=await call('/api/auth/register','POST',{email,firstName:'Анна',lastName:'Тест',phone:'',password:'password2026',consent:true});assert.equal(r.status,201);return r.cookie};
 const a=await register('a@example.ru'),b=await register('b@example.ru'),c=await register('c@example.ru');await register('boss@example.ru');await accounts.pool.query("update users set role='admin' where email='boss@example.ru'");const staff=(await call('/api/admin/login','POST',{login:'boss@example.ru',password:'password2026'})).cookie;
 const form={firstName:'Анна',lastName:'Тест',middleName:'',city:'Москва',address:'Москва, ул. Тестовая, д. 1, кв. 2',phone:'+7 (900) 123-45-67',consent:true,userId:999,email:'wrong@example.ru'};
 assert.equal((await call('/api/card-application','POST',form)).status,401);assert.equal((await call('/api/admin/card-applications','GET',null,a)).status,401);
 let r=await call('/api/card-application','POST',form,a);assert.equal(r.status,201);const application=r.body.application;assert.equal(application.data.email,'a@example.ru');assert.equal(application.status,'pending');assert.equal(application.data.address,form.address);assert.equal((await call('/api/card-application','GET',null,a)).body.application.data.address,form.address);
 assert.equal((await call('/api/card-application','GET',null,b)).body.application,null,'another account sees no applicant data');
 const duplicates=await Promise.all([call('/api/card-application','POST',form,a),call('/api/card-application','POST',form,a)]);assert.deepEqual(duplicates.map(r=>r.status),[409,409]);
 await call('/api/account','PUT',{profile:{firstName:'Анна',lastName:'Тест',phone:'',partnerId:'9999999'}},a);assert.equal((await call('/api/auth/me','GET',null,a)).body.account.partnerId,'','pending applicants cannot self-assign a card');
 assert.equal((await call('/api/admin/overview','GET',null,staff)).body.cardApplications,1);
 r=await call('/api/admin/card-applications','PUT',{id:application.id,status:'processing',updatedAt:application.updatedAt},staff);assert.equal(r.status,200);let current=r.body.application;
 assert.equal((await call('/api/card-application','GET',null,a)).body.application.status,'processing','customer reload preserves in-progress status');
 assert.equal((await call('/api/admin/card-applications','GET',null,staff)).body.applications.find(x=>x.id===current.id).status,'processing','admin reload preserves in-progress status');
 assert.equal((await call('/api/admin/card-applications','PUT',{id:application.id,status:'approved',updatedAt:application.updatedAt,partnerId:'1234567'},staff)).status,409,'stale admin cannot approve an old version');
 assert.equal((await call('/api/admin/card-applications','PUT',{id:current.id,status:'approved',updatedAt:current.updatedAt,partnerId:'wrong'},staff)).status,400);
 r=await call('/api/admin/card-applications','PUT',{id:current.id,status:'approved',updatedAt:current.updatedAt,partnerId:'1234567'},staff);assert.equal(r.status,200);
 assert.equal((await call('/api/auth/me','GET',null,a)).body.account.partnerId,'1234567');assert.equal((await call('/api/auth/me','GET',null,b)).body.account.partnerId,'');
 await call('/api/account','PUT',{profile:{firstName:'Анна',lastName:'Тест',phone:'',partnerId:''}},a);assert.equal((await call('/api/auth/me','GET',null,a)).body.account.partnerId,'1234567','an old browser snapshot cannot erase the assigned card');
 assert.equal((await call('/api/card-application','POST',form,a)).status,409);
 const appB=(await call('/api/card-application','POST',form,b)).body.application;
 assert.equal((await call('/api/admin/card-applications','PUT',{id:appB.id,status:'approved',updatedAt:appB.updatedAt,partnerId:'1234567'},staff)).status,409,'same card cannot be assigned to another account');
 const rejected=await call('/api/admin/card-applications','PUT',{id:appB.id,status:'rejected',reason:'Уточните фамилию',updatedAt:appB.updatedAt},staff);assert.equal(rejected.status,200);assert.equal((await call('/api/card-application','GET',null,b)).body.application.reason,'Уточните фамилию');
 const renewed=await call('/api/card-application','POST',{...form,lastName:'Исправлено'},b);assert.equal(renewed.status,201);assert.equal(renewed.body.application.id,appB.id);assert.equal(renewed.body.application.reason,'');
 const appC=(await call('/api/card-application','POST',form,c)).body.application;
 const approvals=await Promise.all([renewed.body.application,appC].map(app=>call('/api/admin/card-applications','PUT',{id:app.id,status:'approved',partnerId:'7654321',updatedAt:app.updatedAt},staff)));assert.deepEqual(approvals.map(r=>r.status).sort(),[200,409]);
 const list=await call('/api/admin/card-applications?q='+encodeURIComponent('a@example.ru'),'GET',null,staff);assert.equal(list.body.total,1);assert.equal(list.body.applications[0].id,application.id);assert.equal(list.body.applications[0].data.address,form.address);
 const claimed=await call('/api/auth/register','POST',{email:'claim@example.ru',firstName:'Ирина',lastName:'Тест',password:'password2026',consent:true,partnerId:'8888888'});assert.equal(claimed.status,201);const claimCookie=claimed.cookie;assert.equal(claimed.body.account.partnerId,'','registration cannot self-verify a card');
 await call('/api/account','PUT',{profile:{firstName:'Ирина',lastName:'Тест',phone:'',partnerId:'8888888'}},claimCookie);assert.equal((await call('/api/auth/me','GET',null,claimCookie)).body.account.partnerId,'');
 const claim=await call('/api/card-application','POST',{mode:'attach',requestedPartnerId:'8888888',firstName:'Forged',email:'wrong@example.ru'},claimCookie);assert.equal(claim.status,201);assert.equal(claim.body.application.data.firstName,'Ирина');assert.equal(claim.body.application.data.email,'claim@example.ru');assert.equal(claim.body.application.data.requestedPartnerId,'8888888');
 assert.equal((await call('/api/card-prices','GET',null,claimCookie)).status,403,'a pending claim enables no discount');
 assert.equal((await call('/api/admin/card-applications','PUT',{id:claim.body.application.id,status:'approved',partnerId:'8888888',updatedAt:claim.body.application.updatedAt},staff)).status,200);
 assert.equal((await call('/api/auth/me','GET',null,claimCookie)).body.account.partnerId,'8888888');assert.equal((await call('/api/card-prices','GET',null,claimCookie)).status,200,'staff approval enables discount');
 const badOrigin=await fetch(base+'/api/card-application',{method:'POST',headers:{Cookie:a,'Content-Type':'application/json',Origin:'https://other.example'},body:JSON.stringify(form)});assert.equal(badOrigin.status,403);
 assert.ok((await accounts.pool.query("select 1 from admin_log where action='card-application'")).rowCount>=4);
});
