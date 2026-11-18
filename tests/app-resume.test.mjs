import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {APP_RESUME_TIMEOUT_MS as timeout,RESUME_PAGE_KEY,installAppResume,readResumePage} from '../apps/web/src/app-resume.mjs';
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)}};
function app({standalone=true,phone=true,path='/catalog/'}={}){
 let clock=1000000,id=0;const docListeners=new Map(),winListeners=new Map(),timers=new Map(),redirects=[];
 const doc={visibilityState:'visible',addEventListener:(k,v)=>docListeners.set(k,v),removeEventListener:k=>docListeners.delete(k)};
 const win={navigator:{standalone},matchMedia:q=>({matches:q==='(max-width:959px)'?phone:false}),location:{pathname:path,search:'',replace:url=>redirects.push(url)},scrollY:450,sessionStorage:storage(),localStorage:storage(),addEventListener:(k,v)=>winListeners.set(k,v),removeEventListener:k=>winListeners.delete(k),setTimeout:fn=>{timers.set(++id,fn);return id},clearTimeout:n=>timers.delete(n)};
 win.localStorage.setItem('nsp-center:v1','account, cart and plan');win.sessionStorage.setItem('nsp-center:back-stack','["/product/x/"]');
 const cleanup=installAppResume(win,doc,{now:()=>clock});
 return {win,doc,redirects,cleanup,docListeners,winListeners,timers,advance:n=>clock+=n,hide(){doc.visibilityState='hidden';docListeners.get('visibilitychange')?.()},show(){doc.visibilityState='visible';docListeners.get('visibilitychange')?.()},fire:(k,e={})=>winListeners.get(k)?.(e),event:(k,target)=>docListeners.get(k)?.({target}),flush(){for(const fn of timers.values()){timers.clear();fn()}}};
}
test('short interruptions preserve the exact page; 30 minutes or more starts at home',()=>{
 for(const gap of [1,30000,120000,timeout-1,timeout,timeout+1,86400000]){
  const a=app();a.hide();a.advance(gap);a.show();a.flush();assert.deepEqual(a.redirects,gap>=timeout?['/']:[],String(gap));
  assert.equal(a.win.localStorage.getItem('nsp-center:v1'),'account, cart and plan');
  if(gap>=timeout){assert.equal(a.win.sessionStorage.getItem('nsp-center:back-stack'),null);assert.equal(a.win.sessionStorage.getItem('nsp-scroll:/'),'0');a.fire('pagehide');assert.equal(a.win.localStorage.getItem(RESUME_PAGE_KEY),null,'outgoing page must not reintroduce its route after reset')}
  a.cleanup();
 }
});
test('hidden timers are unnecessary, and pagehide does not extend the original time away',()=>{
 const a=app();a.hide();const initial=readResumePage(a.win.localStorage);assert.equal(a.timers.size,0);a.advance(timeout);a.fire('pagehide');assert.equal(readResumePage(a.win.localStorage).at,initial.at);a.fire('pageshow',{persisted:true});a.show();a.flush();assert.deepEqual(a.redirects,['/']);a.cleanup();
});
test('repeated short interruptions each get their own period',()=>{
 const a=app();for(let i=0;i<3;i++){a.hide();a.advance(timeout-1);a.show();a.flush()}assert.deepEqual(a.redirects,[]);a.hide();a.advance(timeout);a.show();a.flush();assert.deepEqual(a.redirects,['/']);
});
test('browser tabs, desktop apps and administration do not redirect on absence',()=>{
 for(const options of [{standalone:false},{phone:false},{path:'/admin/'}]){const a=app(options);a.hide();a.advance(timeout*2);a.show();a.flush();assert.equal(a.docListeners.size,0);assert.deepEqual(a.redirects,[]);a.cleanup()}
});
test('an unfinished message or form stays open, and reverting its edit allows a later fresh visit',()=>{
 const a=app();const field={type:'text',value:'',defaultValue:'',isConnected:true,matches:()=>true,closest:s=>s==='form'?{}:null};a.event('focusin',field);field.value='Незаконченный вопрос';a.event('input',field);a.hide();a.advance(timeout);a.show();a.flush();assert.deepEqual(a.redirects,[]);field.value='';a.hide();a.advance(timeout);a.show();a.flush();assert.deepEqual(a.redirects,['/']);
});
test('a notification or explicit navigation cancels the pending automatic home return',()=>{
 const a=app();a.hide();a.advance(timeout);a.show();a.fire('beforeunload');a.fire('pagehide');a.flush();assert.deepEqual(a.redirects,[]);a.cleanup();assert.equal(a.docListeners.size,0);assert.equal(a.winListeners.size,0);
});
test('BFCache restoration uses saved absence time',()=>{
 const a=app();a.advance(timeout);a.win.localStorage.setItem(RESUME_PAGE_KEY,JSON.stringify({url:'/catalog/',at:1000000,scroll:200}));a.fire('pageshow',{persisted:true});a.flush();assert.deepEqual(a.redirects,['/']);
});
test('blocked storage does not prevent the home route after a long warm resume',()=>{
 const a=app();Object.defineProperty(a.win,'localStorage',{get(){throw Error('blocked')}});Object.defineProperty(a.win,'sessionStorage',{get(){throw Error('blocked')}});a.hide();a.advance(timeout);a.show();a.flush();assert.deepEqual(a.redirects,['/']);
});
test('unsafe or malformed last-page records cannot become a restore destination',()=>{
 const s=storage();for(const item of [null,{}, {url:'//other.test',at:1},{url:'/admin/?x',at:1},{url:'/admin?x',at:1},{url:'/api/auth/',at:1},{url:'/\\other.test',at:1},{url:'/cart/',at:'1'}]){s.setItem(RESUME_PAGE_KEY,JSON.stringify(item));assert.equal(readResumePage(s),null)}
});
test('new icon launches always start on home, independently of the previous route, duration and account',()=>{
 const script=fs.readFileSync('apps/web/index.html','utf8').match(/<script>try\{var sx[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,'');
 assert.equal(JSON.parse(fs.readFileSync('public/manifest.webmanifest')).start_url,'/');
 for(const signedIn of [false,true])for(const age of [1,timeout-1,timeout,timeout+1]){
  const sx=storage(),lx=storage(),redirects=[];lx.setItem('nsp-center:v1',JSON.stringify({signedIn,cart:{aloe:2}}));lx.setItem(RESUME_PAGE_KEY,JSON.stringify({url:'/catalog/?q=алое',at:10000000-age,scroll:420}));sx.setItem('nsp-footer-home-return','700');
  const ctx={sessionStorage:sx,localStorage:lx,Date:{now:()=>10000000},navigator:{standalone:true},matchMedia:()=>({matches:false}),performance:{getEntriesByType:()=>[{type:'navigate'}]},location:{pathname:'/',search:'',replace:url=>redirects.push(url)},document:{documentElement:{classList:{add(){}}}}};
  vm.runInNewContext(script,ctx);assert.deepEqual(redirects,[]);assert.equal(sx.getItem('nsp-scroll:/'),'0');assert.equal(sx.getItem('nsp-footer-home-return'),null);assert.equal(JSON.parse(lx.getItem('nsp-center:v1')).signedIn,signedIn);assert.deepEqual(JSON.parse(lx.getItem('nsp-center:v1')).cart,{aloe:2});
 }
});
