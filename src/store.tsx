import { rollPlan, restorePlans } from './intake-plan';
import { restoreWaitlist, reconcileWaitlist, type WaitEntry } from './waitlist';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import content from './generated/summary.json';
import type { Content, Product } from './content-types';
import { withProductImages } from './product-images';
const source = content as unknown as Content;
export const data: Content = {...source, products: source.products.map(withProductImages)};
export const money = (n: number | null) => new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n ?? 0);
export const shortName = (name:string) => name.replace(/\s*\([^)]*\)/g,'').trim();
// The price a visitor pays: partner price with a discount card when the product has one, otherwise retail.
export const priceOf = (p:Product, card:boolean) => card && p.prices.partner !== null ? p.prices.partner : p.prices.retail;
export const partnerSignupUrl = 'https://nsp25.com/signup?sid=446621';
export type Intake = {id:string; time:string; done:boolean};
/** Demo account kept in this browser until the account server exists; the password is stored only as a salted SHA-256 hash. */
export type Account = {firstName:string; lastName:string; email:string; phone:string; partnerId:string; passwordHash:string; createdAt:string};
export type LocalState = {cart:Record<string,number>; favorites:string[]; waitlist:WaitEntry[]; intake:Intake[]; intakeDate:string; intakePlans:Record<string,Intake[]>; intakeLog:Record<string,string[]>; day:number; habits:Habit[]; notices:Notice[]; reminded:string[]; tasks:Record<string,string[]>; name:string; orders:{id:string;total:number;date:string;items:number}[]; card:boolean; account:Account|null; signedIn:boolean};
// Habit marathon: the visitor's own habits; a day's ticks are the ids of the habits done. Older saves kept a boolean per
// default habit (by position) and are read into ids.
export type Habit = {id:string; label:string};
const defaultHabits:Habit[] = [{id:'walk',label:'Прогулка на свежем воздухе'},{id:'meal',label:'Время для спокойного приёма пищи'},{id:'screen',label:'Перерыв от экрана'},{id:'sleep',label:'Подготовка ко сну'}];
function restoreHabits(v:unknown):Habit[]{if(!Array.isArray(v))return defaultHabits;return v.filter((h):h is Habit=>Boolean(h)&&typeof h.id==='string'&&typeof h.label==='string'&&h.label.trim()!=='').map(h=>({id:h.id.slice(0,40),label:h.label.slice(0,80)}));}
function restoreTasks(v:unknown):Record<string,string[]>{if(!v||typeof v!=='object')return {};return Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([,list])=>Array.isArray(list)).map(([day,list])=>[day,(list as unknown[]).flatMap((x,i)=>x===true&&defaultHabits[i]?[defaultHabits[i].id]:typeof x==='string'?[x.slice(0,40)]:[])]));}
/** Local calendar date (YYYY-MM-DD): plan ticks belong to one day. */
export const today=()=>new Date().toLocaleDateString('sv-SE');
const initial: LocalState = {cart:{},favorites:[],waitlist:[],intake:[],intakeDate:'',intakePlans:{},intakeLog:{},day:1,habits:defaultHabits,notices:[],reminded:[],tasks:{},name:'',orders:[],card:false,account:null,signedIn:false};
const text = (v:unknown, max:number) => typeof v==='string'?v.slice(0,max):'';
function restoreAccount(v:unknown):Account|null{if(!v||typeof v!=='object')return null;const a=v as Record<string,unknown>;if(typeof a.email!=='string'||typeof a.passwordHash!=='string')return null;return {firstName:text(a.firstName,60),lastName:text(a.lastName,60),email:text(a.email,120),phone:text(a.phone,30),partnerId:text(a.partnerId,20),passwordHash:text(a.passwordHash,128),createdAt:text(a.createdAt,30)};}
const validIds = new Set(data.products.map(p=>p.id));
// In-app notifications (the bell): plan reminders and similar; the newest 50 are kept. `reminded` holds today's
// reminder keys (date:product:time) so a reminder fires once.
export type Notice = {id:string; title:string; text:string; date:string; url:string; read:boolean};
function restoreNotices(v:unknown):Notice[]{if(!Array.isArray(v))return [];return v.filter((n):n is Notice=>Boolean(n)&&typeof n.id==='string'&&typeof n.title==='string').slice(0,50).map(n=>({id:n.id.slice(0,60),title:n.title.slice(0,120),text:typeof n.text==='string'?n.text.slice(0,300):'',date:typeof n.date==='string'?n.date.slice(0,40):'',url:typeof n.url==='string'&&n.url.startsWith('/')?n.url.slice(0,200):'/',read:n.read===true}));}
// Day log of the intake plan: date (YYYY-MM-DD) -> ids of the products ticked that day.
function restoreLog(v:unknown):Record<string,string[]>{if(!v||typeof v!=='object')return {};return Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([date,ids])=>/^\d{4}-\d\d-\d\d$/.test(date)&&Array.isArray(ids)).map(([date,ids])=>[date,[...new Set((ids as unknown[]).filter((id):id is string=>typeof id==='string'&&validIds.has(id)))]]));}
function restore():LocalState {
  try { const parsed=JSON.parse(localStorage.getItem('nsp-center:v1') || 'null'); if(!parsed || typeof parsed!=='object')return initial;
    return {...initial,waitlist:restoreWaitlist(parsed.waitlist,validIds),name:typeof parsed.name==='string'?parsed.name.slice(0,60):'',card:parsed.card===true,account:restoreAccount(parsed.account),signedIn:parsed.signedIn===true&&Boolean(restoreAccount(parsed.account)),cart:Object.fromEntries(Object.entries(parsed.cart||{}).filter(([id,q])=>validIds.has(id)&&Number.isInteger(q)&&Number(q)>0&&Number(q)<=99)) as Record<string,number>,favorites:Array.isArray(parsed.favorites)?parsed.favorites.filter((id:unknown)=>typeof id==='string'&&validIds.has(id)):[],...rollPlan({intake:restorePlans({[parsed.intakeDate||today()]:parsed.intake},validIds)[parsed.intakeDate||today()]||[],intakeDate:parsed.intakeDate||today(),intakePlans:restorePlans(parsed.intakePlans,validIds)},today()),intakeLog:restoreLog(parsed.intakeLog),day:Math.max(1,Math.min(21,Number(parsed.day)||1)),habits:restoreHabits(parsed.habits),notices:restoreNotices(parsed.notices),reminded:Array.isArray(parsed.reminded)?parsed.reminded.filter((k:unknown):k is string=>typeof k==='string'&&k.startsWith(today())).slice(-100):[],tasks:restoreTasks(parsed.tasks),orders:Array.isArray(parsed.orders)?parsed.orders.filter((x:{id:unknown;total:unknown})=>typeof x.id==='string'&&typeof x.total==='number'):[]};
  } catch {return initial;}
}
type Store = {state:LocalState;setState:React.Dispatch<React.SetStateAction<LocalState>>;add:(p:Product,quantity?:number)=>void;qty:(id:string,quantity:number)=>void;favorite:(id:string)=>void;waitFor:(p:Product)=>void;toast:string;notify:(s:string)=>void;count:number;ready:boolean};
const Context = createContext<Store|null>(null);
export function StoreProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState(initial); const [toast,setToast]=useState(''); const [ready,setReady]=useState(false);
  useEffect(()=>{setState(restore());setReady(true);document.getElementById('root')?.setAttribute('data-hydrated','true');},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem('nsp-center:v1',JSON.stringify(state));}catch{/* in-memory remains usable */}},[state,ready]);
  // The intake plan belongs to one calendar day in the visitor's own time zone: at local midnight (and whenever the tab
  // comes back after the date changed) the scheduled day becomes active and the previous plan is archived.
  useEffect(()=>{if(!ready)return;const roll=()=>setState(s=>rollPlan(s,today()));let timer=0;
    const schedule=()=>{const now=new Date();const next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1,0,0,1);timer=window.setTimeout(()=>{roll();schedule();},next.getTime()-now.getTime());};
    const wake=()=>{if(document.visibilityState==='visible')roll();};schedule();document.addEventListener('visibilitychange',wake);return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',wake);};},[ready]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t);}},[toast]);
  useEffect(()=>{if(!ready)return;setState(s=>{
    const result=reconcileWaitlist(s.waitlist,data.products);
    if(result.entries===s.waitlist)return s;
    const date=new Date().toLocaleString('ru-RU');
    const arrivals=result.arrivals.map(p=>({id:`stock-${p.id}-${Date.now()}`,title:'Товар снова в наличии',text:shortName(p.name),date,url:p.path,read:false}));
    return {...s,waitlist:result.entries,notices:[...arrivals,...s.notices].slice(0,50)};
  });},[ready,state.waitlist]);
  const waitFor=(p:Product)=>{setState(s=>{
    const included=s.waitlist.some(x=>x.id===p.id);
    if(!included&&p.availability!=='OutOfStock')return s;
    return {...s,waitlist:included?s.waitlist.filter(x=>x.id!==p.id):[...s.waitlist,{id:p.id,notified:false}]};
  });};
  const add=(p:Product,q=1)=>{if(p.availability==='OutOfStock')return;setState(s=>({...s,cart:{...s.cart,[p.id]:Math.min(99,(s.cart[p.id]||0)+q)}}));setToast(`${shortName(p.name)} — в корзине`);};
  const qty=(id:string,q:number)=>setState(s=>{const cart={...s.cart};if(q<=0)delete cart[id];else cart[id]=Math.min(99,q);return {...s,cart};});
  const favorite=(id:string)=>setState(s=>({...s,favorites:s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id]}));
  return <Context.Provider value={{state,setState,add,qty,favorite,waitFor,toast,notify:setToast,count:Object.values(state.cart).reduce((a,b)=>a+b,0),ready}}>{children}<div className={`toast ${toast?'visible':''}`} role="status" aria-live="polite">{toast}</div></Context.Provider>;
}
export function useStore(){const v=useContext(Context);if(!v)throw new Error('Missing StoreProvider');return v;}
