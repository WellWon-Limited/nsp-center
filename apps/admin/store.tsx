import {useEffect,useState,type ReactNode} from 'react';
import {Context,data,initial,type Staff,type Store} from '../../src/store';
import {applySite,type SiteSettings,type CardPrices} from '../../src/site';
import {mergeCustom} from '../../src/custom-product.mjs';
import {mergeArticles} from '../../src/site-content.mjs';
import {applyCatalogConfig} from '../../src/catalog-categories.mjs';

/** Staff state has no customer session, local-storage restoration or account sync. */
export function AdminStoreProvider({children}:{children:ReactNode}){
 const [staff,setStaff]=useState<Staff|null>(null),[site,setSiteState]=useState<SiteSettings|null>(null);
 const [toast,setToast]=useState(''),[revision,setRevision]=useState(0);
 const [cardPrices,setCardPrices]=useState<CardPrices|null>(null);
 const notify=(message:string)=>{setToast(message);setRevision(n=>n+1)};
 const setSite=(next:SiteSettings|null)=>{
  mergeCustom(data.products,data.categories,next?.extraProducts??[]);
  mergeArticles(data.articles,next?.content?.articles??[]);
  applySite(data.products,next,data.pricing.rubPerUnit,cardPrices);
  applyCatalogConfig(data.categories,data.products,next?.catalog);
  setSiteState(next);
 };
 useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer)},[toast,revision]);
 useEffect(()=>{
  if(!staff){setCardPrices(null);return;}
  let off=false;
  fetch('/api/card-prices').then(r=>r.ok?r.json():null).then(prices=>{
   if(off)return;setCardPrices(prices);applySite(data.products,site,data.pricing.rubPerUnit,prices);
  }).catch(()=>{});return()=>{off=true};
 },[staff,site]);
 const noop=()=>{};
 const value:Store={state:initial,setState:noop,add:noop,qty:noop,favorite:noop,waitFor:noop,toast,notify,count:0,ready:true,sessionReady:true,pendingReviews:0,site,setSite,accounts:'local',startSession:noop,logout:async()=>{},staff,setStaff};
 return <Context.Provider value={value}>{children}<div className={`toast ${toast?'visible':''}`} role="status" aria-live="polite">{toast}</div></Context.Provider>;
}
