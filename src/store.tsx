import { rollPlan, restorePlans } from './intake-plan';
import { restoreWaitlist, reconcileWaitlist, type WaitEntry } from './waitlist';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { applySite, readSite, type SiteSettings } from './site';
import content from './generated/summary.json';
import type { Content, Product } from './content-types';
import { withProductImages } from './product-images';
const source = content as unknown as Content;
export const data: Content = {...source, products: source.products.map(withProductImages)};
/** Product objects outside `data.products` that a page shows (its own full product, from the page data): the
 *  administrator's prices and stock are applied to them too (src/site.ts). */
const pageProducts=new Set<Product>();
export const trackProducts=(list:(Product|undefined)[])=>{for(const p of list)if(p)pageProducts.add(p);};
export const money = (n: number | null) => new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n ?? 0);
export const shortName = (name:string) => name.replace(/\s*\([^)]*\)/g,'').trim();
// The price a visitor pays: partner price with a discount card when the product has one, otherwise retail.
export const priceOf = (p:Product, card:boolean) => card && p.prices.partner !== null ? p.prices.partner : p.prices.retail;
export const partnerSignupUrl = 'https://nsp25.com/signup?sid=446621';
export type Intake = {id:string; time:string; done:boolean};
/** The visitor's account. `server`: it lives on the accounts server (scripts/accounts.mjs) and `passwordHash` is empty;
 *  otherwise it is the in-browser demo account (no server connected), with the password kept as a salted SHA-256 hash. */
export type Account = {firstName:string; lastName:string; email:string; phone:string; partnerId:string; passwordHash:string; createdAt:string; server?:boolean; admin?:boolean};
/** What the account put in the cart, favourites and waiting list: set aside at sign-out (the shared device then shows an
 *  empty cart and lists) and brought back at the next sign-in to the same account. */
export type Saved = {email:string; cart:Record<string,number>; favorites:string[]; waitlist:WaitEntry[]};
function restoreSaved(v:unknown):Saved|null{if(!v||typeof v!=='object')return null;const x=v as Record<string,unknown>;if(typeof x.email!=='string')return null;return {email:x.email.slice(0,120),cart:Object.fromEntries(Object.entries((x.cart as Record<string,unknown>)||{}).filter(([id,q])=>validIds.has(id)&&Number.isInteger(q)&&Number(q)>0&&Number(q)<=99)) as Record<string,number>,favorites:Array.isArray(x.favorites)?x.favorites.filter((id:unknown):id is string=>typeof id==='string'&&validIds.has(id)):[],waitlist:restoreWaitlist(x.waitlist,validIds)};}
/** Sign-out: keep the account's cart, favourites and waiting list aside and clear them on the device. */
export const signOut=(s:LocalState):LocalState=>({...s,signedIn:false,card:false,saved:s.account?{email:s.account.email,cart:s.cart,favorites:s.favorites,waitlist:s.waitlist}:s.saved,cart:{},favorites:[],waitlist:[]});
/** Sign-in: bring back what this account had set aside (adding anything picked as a guest). */
export const restoreAccountLists=(s:LocalState,email:string):Partial<LocalState>=>{const k=s.saved;if(!k||k.email.toLowerCase()!==email.toLowerCase())return {};const cart={...k.cart};for(const [id,q] of Object.entries(s.cart))cart[id]=Math.min(99,(cart[id]||0)+q);return {cart,favorites:[...new Set([...k.favorites,...s.favorites])],waitlist:[...k.waitlist,...s.waitlist.filter(w=>!k.waitlist.some(x=>x.id===w.id))],saved:null};};
export type LocalState = {cart:Record<string,number>; favorites:string[]; waitlist:WaitEntry[]; intake:Intake[]; intakeDate:string; intakePlans:Record<string,Intake[]>; intakeLog:Record<string,string[]>; day:number; habits:Habit[]; notices:Notice[]; reminded:string[]; tasks:Record<string,string[]>; name:string; orders:{id:string;total:number;date:string;items:number}[]; card:boolean; account:Account|null; signedIn:boolean; saved:Saved|null};
// Habit marathon: the visitor's own habits; a day's ticks are the ids of the habits done. Older saves kept a boolean per
// default habit (by position) and are read into ids.
export type Habit = {id:string; label:string};
const defaultHabits:Habit[] = [{id:'walk',label:'Прогулка на свежем воздухе'},{id:'meal',label:'Время для спокойного приёма пищи'},{id:'screen',label:'Перерыв от экрана'},{id:'sleep',label:'Подготовка ко сну'}];
function restoreHabits(v:unknown):Habit[]{if(!Array.isArray(v))return defaultHabits;return v.filter((h):h is Habit=>Boolean(h)&&typeof h.id==='string'&&typeof h.label==='string'&&h.label.trim()!=='').map(h=>({id:h.id.slice(0,40),label:h.label.slice(0,80)}));}
function restoreTasks(v:unknown):Record<string,string[]>{if(!v||typeof v!=='object')return {};return Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([,list])=>Array.isArray(list)).map(([day,list])=>[day,(list as unknown[]).flatMap((x,i)=>x===true&&defaultHabits[i]?[defaultHabits[i].id]:typeof x==='string'?[x.slice(0,40)]:[])]));}
/** Local calendar date (YYYY-MM-DD): plan ticks belong to one day. */
const SITE_CACHE='nsp-center:site';
export const today=()=>new Date().toLocaleDateString('sv-SE');
const initial: LocalState = {cart:{},favorites:[],waitlist:[],intake:[],intakeDate:'',intakePlans:{},intakeLog:{},day:1,habits:defaultHabits,notices:[],reminded:[],tasks:{},name:'',orders:[],card:false,account:null,signedIn:false,saved:null};
const text = (v:unknown, max:number) => typeof v==='string'?v.slice(0,max):'';
function restoreAccount(v:unknown):Account|null{if(!v||typeof v!=='object')return null;const a=v as Record<string,unknown>;if(typeof a.email!=='string'||typeof a.passwordHash!=='string')return null;return {firstName:text(a.firstName,60),lastName:text(a.lastName,60),email:text(a.email,120),phone:text(a.phone,30),partnerId:text(a.partnerId,20),passwordHash:text(a.passwordHash,128),createdAt:text(a.createdAt,30),...(a.server===true?{server:true}:{}),...(a.server===true&&a.admin===true?{admin:true}:{})};}
const validIds = new Set(data.products.map(p=>p.id));
// In-app notifications (the bell): plan reminders and similar; the newest 50 are kept. `reminded` holds today's
// reminder keys (date:product:time) so a reminder fires once.
export type Notice = {id:string; title:string; text:string; date:string; url:string; read:boolean};
function restoreNotices(v:unknown):Notice[]{if(!Array.isArray(v))return [];return v.filter((n):n is Notice=>Boolean(n)&&typeof n.id==='string'&&typeof n.title==='string').slice(0,50).map(n=>({id:n.id.slice(0,60),title:n.title.slice(0,120),text:typeof n.text==='string'?n.text.slice(0,300):'',date:typeof n.date==='string'?n.date.slice(0,40):'',url:typeof n.url==='string'&&n.url.startsWith('/')?n.url.slice(0,200):'/',read:n.read===true}));}
// Day log of the intake plan: date (YYYY-MM-DD) -> ids of the products ticked that day.
function restoreLog(v:unknown):Record<string,string[]>{if(!v||typeof v!=='object')return {};return Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([date,ids])=>/^\d{4}-\d\d-\d\d$/.test(date)&&Array.isArray(ids)).map(([date,ids])=>[date,[...new Set((ids as unknown[]).filter((id):id is string=>typeof id==='string'&&validIds.has(id)))]]));}
function restore():LocalState {try{return restoreFrom(JSON.parse(localStorage.getItem('nsp-center:v1')||'null'));}catch{return initial;}}
/** Checks a saved state (this browser's copy, or account data from the server) field by field. */
function restoreFrom(parsed:any):LocalState {
  try { if(!parsed || typeof parsed!=='object')return initial;
    return {...initial,waitlist:restoreWaitlist(parsed.waitlist,validIds),saved:restoreSaved(parsed.saved),name:typeof parsed.name==='string'?parsed.name.slice(0,60):'',card:parsed.card===true,account:restoreAccount(parsed.account),signedIn:parsed.signedIn===true&&Boolean(restoreAccount(parsed.account)),cart:Object.fromEntries(Object.entries(parsed.cart||{}).filter(([id,q])=>validIds.has(id)&&Number.isInteger(q)&&Number(q)>0&&Number(q)<=99)) as Record<string,number>,favorites:Array.isArray(parsed.favorites)?parsed.favorites.filter((id:unknown)=>typeof id==='string'&&validIds.has(id)):[],...rollPlan({intake:restorePlans({[parsed.intakeDate||today()]:parsed.intake},validIds)[parsed.intakeDate||today()]||[],intakeDate:parsed.intakeDate||today(),intakePlans:restorePlans(parsed.intakePlans,validIds)},today()),intakeLog:restoreLog(parsed.intakeLog),day:Math.max(1,Math.min(21,Number(parsed.day)||1)),habits:restoreHabits(parsed.habits),notices:restoreNotices(parsed.notices),reminded:Array.isArray(parsed.reminded)?parsed.reminded.filter((k:unknown):k is string=>typeof k==='string'&&k.startsWith(today())).slice(-100):[],tasks:restoreTasks(parsed.tasks),orders:Array.isArray(parsed.orders)?parsed.orders.filter((x:{id:unknown;total:unknown})=>typeof x.id==='string'&&typeof x.total==='number'):[]};
  } catch {return initial;}
}
// Accounts server (scripts/accounts.mjs). The site asks /api/auth/me once per page: an answer from the server switches
// sign-in and registration to it ('server'); no server (503, a static host, offline) keeps the in-browser demo ('local').
// While signed in to a server account, every change of its data (SYNC_KEYS) and profile is sent to the server after a
// short pause. Until the server confirms it, 'nsp-center:sync-dirty' is set: the next page then keeps this browser's copy
// and sends it; otherwise the server's copy (possibly changed on another device) replaces it.
/** The parts of the state that belong to the account (scripts/accounts.mjs DATA_KEYS). */
export const SYNC_KEYS=['cart','favorites','waitlist','intake','intakeDate','intakePlans','intakeLog','habits','tasks','day'] as const;
type Synced=Pick<LocalState,typeof SYNC_KEYS[number]>;
export type ServerSession={account:Omit<Account,'passwordHash'|'server'>;data:Record<string,unknown>};
const DIRTY='nsp-center:sync-dirty';
const pickSynced=(s:LocalState)=>Object.fromEntries(SYNC_KEYS.map(k=>[k,s[k]])) as Synced;
const syncPayload=(s:LocalState)=>JSON.stringify({profile:{firstName:s.account?.firstName,lastName:s.account?.lastName,phone:s.account?.phone,partnerId:s.account?.partnerId},data:pickSynced(s)});
/** Signed in to a server account: on page load ('load') the server's data replaces this browser's copy; at sign-in
 *  ('signin') it is joined with what was picked as a guest (cart summed, lists united, the plan kept if the account has none). */
export function openSession(s:LocalState,{account,data}:ServerSession,mode:'load'|'signin'):LocalState{
  const acc={...restoreAccount({...account,passwordHash:'',server:true})!};
  const base:LocalState={...s,account:acc,signedIn:true,name:acc.firstName,card:acc.partnerId?true:s.card,saved:null};
  if(!data||!SYNC_KEYS.some(k=>k in data))return base;
  const remote=pickSynced(restoreFrom({...s,...data}));
  if(mode==='load')return {...base,...remote};
  const cart={...remote.cart};for(const [id,q] of Object.entries(s.cart))cart[id]=Math.min(99,(cart[id]||0)+q);
  const hasPlan=remote.intake.length>0||Object.values(remote.intakePlans).some(list=>list.length>0);
  return {...base,...remote,cart,favorites:[...new Set([...remote.favorites,...s.favorites])],waitlist:[...remote.waitlist,...s.waitlist.filter(w=>!remote.waitlist.some(x=>x.id===w.id))],...(hasPlan?{}:{intake:s.intake,intakeDate:s.intakeDate,intakePlans:s.intakePlans})};
}
/** Sign-out of a server account: the device keeps nothing of it (the server has it all). */
export const closeSession=(s:LocalState):LocalState=>({...s,...pickSynced(initial),intakeDate:today(),account:null,signedIn:false,card:false,saved:null,name:''});
type Store = {state:LocalState;setState:React.Dispatch<React.SetStateAction<LocalState>>;add:(p:Product,quantity?:number)=>void;qty:(id:string,quantity:number)=>void;favorite:(id:string)=>void;waitFor:(p:Product)=>void;toast:string;notify:(s:string)=>void;count:number;ready:boolean;pendingReviews:number;site:SiteSettings|null;setSite:(site:SiteSettings|null)=>void;accounts:'server'|'local'|null;startSession:(session:ServerSession)=>void;logout:()=>Promise<void>};
const Context = createContext<Store|null>(null);
export function StoreProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState(initial); const [toast,setToast]=useState(''); const [ready,setReady]=useState(false);
  // Site settings from the administrator (src/site.ts): the cached ones before the first paint after start, then the
  // server's. No accounts server (503, offline, a static host) leaves the built prices.
  const [site,setSiteState]=useState<SiteSettings|null>(null);
  const setSite=(next:SiteSettings|null)=>{applySite([...data.products,...pageProducts],next,data.pricing.rubPerUnit);setSiteState(next);try{if(next)localStorage.setItem(SITE_CACHE,JSON.stringify(next));else localStorage.removeItem(SITE_CACHE);}catch{/* ignore */}};
  useLayoutEffect(()=>{let cached:SiteSettings|null=null;try{cached=readSite(JSON.parse(localStorage.getItem(SITE_CACHE)||'null'));}catch{/* none */}if(cached)setSite(cached);
    fetch('/api/site',{headers:{Accept:'application/json'}}).then(async r=>{if(r.status===503)return setSite(null);if(!r.ok||!(r.headers.get('content-type')||'').includes('json'))return;setSite(readSite(await r.json()));}).catch(()=>{/* offline: keep the cached settings */});
  },[]);
  useEffect(()=>{setState(restore());setReady(true);document.getElementById('root')?.setAttribute('data-hydrated','true');},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem('nsp-center:v1',JSON.stringify(state));}catch{/* in-memory remains usable */}},[state,ready]);
  // The intake plan belongs to one calendar day in the visitor's own time zone: at local midnight (and whenever the tab
  // comes back after the date changed) the scheduled day becomes active and the previous plan is archived.
  useEffect(()=>{if(!ready)return;const roll=()=>setState(s=>rollPlan(s,today()));let timer=0;
    const schedule=()=>{const now=new Date();const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);timer=window.setTimeout(()=>{roll();schedule();},next.getTime()-now.getTime());};
    const wake=()=>{if(document.visibilityState==='visible')roll();};schedule();document.addEventListener('visibilitychange',wake);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',wake);};},[ready]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t);}},[toast]);
  const [accounts,setAccounts]=useState<'server'|'local'|null>(null);
  const synced=useRef<string|null>(null);const pending=useRef<string|null>(null);
  useEffect(()=>{if(!ready)return;let off=false;
    fetch('/api/auth/me',{headers:{Accept:'application/json'}}).then(async r=>{
      if(off)return;
      if(!(r.headers.get('content-type')||'').includes('json')||r.status===503||r.status===404){setAccounts('local');return;}
      const body=await r.json().catch(()=>null) as ServerSession|null;
      if(r.ok&&body?.account){const dirty=localStorage.getItem(DIRTY)==='1';
        setState(s=>{const same=s.account?.server&&s.account.email.toLowerCase()===body.account.email.toLowerCase();
          if(dirty&&same&&s.signedIn){synced.current=null;return s;}
          const next=openSession(s,body,'load');synced.current=syncPayload(next);return next;});}
      // Not signed in on the server (or the session ended): a server account here is closed; a demo account is dropped.
      else setState(s=>s.signedIn?closeSession(s):s.account?{...s,account:null,saved:null}:s);
      setAccounts('server');
    }).catch(()=>{if(!off)setAccounts('local');});
    return()=>{off=true;};},[ready]);
  const push=async(payload:string,keepalive=false)=>{
    const r=await fetch('/api/account',{method:'PUT',headers:{'Content-Type':'application/json'},body:payload,keepalive}).catch(()=>null);
    if(!r)return; // offline: stays marked and goes with the next change or page
    if(r.status===401){synced.current=null;pending.current=null;try{localStorage.removeItem(DIRTY);}catch{/* ignore */}setState(closeSession);setToast('Сеанс закончился. Войдите в аккаунт снова.');return;}
    if(r.status>=500)return;
    if(pending.current===payload)pending.current=null;
    synced.current=payload;try{localStorage.removeItem(DIRTY);}catch{/* ignore */}
    if(!r.ok){const body=await r.json().catch(()=>null) as {error?:string}|null;setToast(body?.error||'Не удалось сохранить изменения.');}
  };
  useEffect(()=>{if(accounts!=='server'||!state.signedIn||!state.account?.server)return;
    const payload=syncPayload(state);if(payload===synced.current)return;
    pending.current=payload;try{localStorage.setItem(DIRTY,'1');}catch{/* ignore */}
    const t=window.setTimeout(()=>{void push(payload);},600);return()=>clearTimeout(t);
  },[state,accounts]);
  useEffect(()=>{const flush=()=>{if(pending.current)void push(pending.current,true);};addEventListener('pagehide',flush);return()=>removeEventListener('pagehide',flush);
  },[]);
  // An administrator learns of new customer reviews: the count shows on «Управление сайтом» in the profile, and a
  // review that arrived since the last look adds a notice to the bell.
  const [pendingReviews,setPendingReviews]=useState(0);
  const isAdmin=accounts==='server'&&state.signedIn&&Boolean(state.account?.admin);
  useEffect(()=>{if(!isAdmin){setPendingReviews(0);return;}let off=false;
    fetch('/api/admin/pending',{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(b=>{if(off||typeof b?.reviews!=='number')return;const count=b.reviews as number;setPendingReviews(count);
      let seen=0;try{seen=Number(localStorage.getItem('nsp-center:admin-pending'))||0;localStorage.setItem('nsp-center:admin-pending',String(count));}catch{/* ignore */}
      if(count>seen)setState(s=>({...s,notices:[{id:`reviews-${Date.now()}`,title:'Новый отзыв на проверку',text:`Ждут проверки: ${count}`,date:new Date().toLocaleString('ru-RU'),url:'/profile/?admin=1&tab=reviews',read:false},...s.notices].slice(0,50)}));
    }).catch(()=>{/* none */});return()=>{off=true;};},[isAdmin]);
  const startSession=(session:ServerSession)=>{synced.current=null;setState(s=>openSession(s,session,'signin'));};
  const logout=async()=>{
    if(accounts!=='server'||!state.account?.server){setState(signOut);return;}
    if(pending.current)await push(pending.current);
    await fetch('/api/auth/logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}).catch(()=>null);
    synced.current=null;pending.current=null;try{localStorage.removeItem(DIRTY);}catch{/* ignore */}
    setState(closeSession);
  };
  useEffect(()=>{if(!ready)return;setState(s=>{
    const result=reconcileWaitlist(s.waitlist,data.products);
    if(result.entries===s.waitlist)return s;
    const date=new Date().toLocaleString('ru-RU');
    const arrivals=result.arrivals.map(p=>({id:`stock-${p.id}-${Date.now()}`,title:'Товар снова в наличии',text:shortName(p.name),date,url:p.path,read:false}));
    return {...s,waitlist:result.entries,notices:[...arrivals,...s.notices].slice(0,50)};
  });},[ready,state.waitlist,site]);
  const waitFor=(p:Product)=>{setState(s=>{
    const included=s.waitlist.some(x=>x.id===p.id);
    if(!included&&p.availability!=='OutOfStock')return s;
    return {...s,waitlist:included?s.waitlist.filter(x=>x.id!==p.id):[...s.waitlist,{id:p.id,notified:false}]};
  });};
  const add=(p:Product,q=1)=>{if(p.availability==='OutOfStock')return;setState(s=>({...s,cart:{...s.cart,[p.id]:Math.min(99,(s.cart[p.id]||0)+q)}}));setToast(`${shortName(p.name)} — в корзине`);};
  const qty=(id:string,q:number)=>setState(s=>{const cart={...s.cart};if(q<=0)delete cart[id];else cart[id]=Math.min(99,q);return {...s,cart};});
  const favorite=(id:string)=>setState(s=>({...s,favorites:s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id]}));
  return <Context.Provider value={{state,setState,add,qty,favorite,waitFor,toast,notify:setToast,count:Object.values(state.cart).reduce((a,b)=>a+b,0),ready,pendingReviews,site,setSite,accounts,startSession,logout}}>{children}<div className={`toast ${toast?'visible':''}`} role="status" aria-live="polite">{toast}</div></Context.Provider>;
}
export function useStore(){const v=useContext(Context);if(!v)throw new Error('Missing StoreProvider');return v;}
