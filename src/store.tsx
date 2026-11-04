import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import content from './generated/summary.json';
import type { Content, Product } from './content-types';
export const data = content as unknown as Content;
export const money = (n: number | null) => new Intl.NumberFormat('ru-RU', {style:'currency',currency:'RUB',maximumFractionDigits:0}).format(n ?? 0);
export const shortName = (name:string) => name.replace(/\s*\([^)]*\)/g,'').trim();
// The price a visitor pays: partner price with a discount card when the product has one, otherwise retail.
export const priceOf = (p:Product, card:boolean) => card && p.prices.partner !== null ? p.prices.partner : p.prices.retail;
export const partnerSignupUrl = 'https://nsp25.com/signup?sid=446621';
export type Intake = {id:string; time:string; done:boolean};
export type LocalState = {cart:Record<string,number>; favorites:string[]; intake:Intake[]; day:number; tasks:Record<string,boolean[]>; name:string; orders:{id:string;total:number;date:string;items:number}[]; card:boolean};
const initial: LocalState = {cart:{},favorites:[],intake:[],day:1,tasks:{},name:'',orders:[],card:false};
const validIds = new Set(data.products.map(p=>p.id));
function restore():LocalState {
  try { const parsed=JSON.parse(localStorage.getItem('nsp-center:v1') || 'null'); if(!parsed || typeof parsed!=='object')return initial;
    return {...initial,name:typeof parsed.name==='string'?parsed.name.slice(0,60):'',card:parsed.card===true,cart:Object.fromEntries(Object.entries(parsed.cart||{}).filter(([id,q])=>validIds.has(id)&&Number.isInteger(q)&&Number(q)>0&&Number(q)<=99)) as Record<string,number>,favorites:Array.isArray(parsed.favorites)?parsed.favorites.filter((id:unknown)=>typeof id==='string'&&validIds.has(id)):[],intake:Array.isArray(parsed.intake)?parsed.intake.filter((x:Intake)=>x&&validIds.has(x.id)&&/^\d\d:\d\d$/.test(x.time)):[],day:Math.max(1,Math.min(21,Number(parsed.day)||1)),tasks:parsed.tasks&&typeof parsed.tasks==='object'?parsed.tasks:{},orders:Array.isArray(parsed.orders)?parsed.orders.filter((x:{id:unknown;total:unknown})=>typeof x.id==='string'&&typeof x.total==='number'):[]};
  } catch {return initial;}
}
type Store = {state:LocalState;setState:React.Dispatch<React.SetStateAction<LocalState>>;add:(p:Product,quantity?:number)=>void;qty:(id:string,quantity:number)=>void;favorite:(id:string)=>void;toast:string;notify:(s:string)=>void;count:number};
const Context = createContext<Store|null>(null);
export function StoreProvider({children}:{children:ReactNode}) {
  const [state,setState]=useState(initial); const [toast,setToast]=useState(''); const [ready,setReady]=useState(false);
  useEffect(()=>{setState(restore());setReady(true);document.getElementById('root')?.setAttribute('data-hydrated','true');},[]);
  useEffect(()=>{if(ready)try{localStorage.setItem('nsp-center:v1',JSON.stringify(state));}catch{/* in-memory remains usable */}},[state,ready]);
  useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),3200);return()=>clearTimeout(t);}},[toast]);
  const add=(p:Product,q=1)=>{if(p.availability==='OutOfStock')return;setState(s=>({...s,cart:{...s.cart,[p.id]:Math.min(99,(s.cart[p.id]||0)+q)}}));setToast(`${shortName(p.name)} — в корзине`);};
  const qty=(id:string,q:number)=>setState(s=>{const cart={...s.cart};if(q<=0)delete cart[id];else cart[id]=Math.min(99,q);return {...s,cart};});
  const favorite=(id:string)=>setState(s=>({...s,favorites:s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id]}));
  return <Context.Provider value={{state,setState,add,qty,favorite,toast,notify:setToast,count:Object.values(state.cart).reduce((a,b)=>a+b,0)}}>{children}<div className={`toast ${toast?'visible':''}`} role="status" aria-live="polite">{toast}</div></Context.Provider>;
}
export function useStore(){const v=useContext(Context);if(!v)throw new Error('Missing StoreProvider');return v;}
