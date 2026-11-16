import type {Product} from './content-types';
import {useLayoutEffect,useRef} from 'react';
import {data,money,priceOf,shortName,useStore} from './store';
import {CardOffer,ReviewLine,WaitlistButton} from './ui';
import {CartButton} from './cart-button';
import {ProductGallery,packageInfo} from './product-gallery';
import {compositionSummary,overviewFacts} from './product-overview-data.mjs';
import {fitProductOverview} from './product-layout.mjs';
import './product-detail.css';

function ShortFact({title,text,onDetails}:{title:string;text:string;onDetails:()=>void}){
 const truncated=text.length>180,long=truncated||text.endsWith('…');
 const excerpt=truncated?text.slice(0,175).replace(/\s+\S*$/u,'').replace(/[,;:.\s]+$/u,'')+'…':text;
 return <section className={`product-short-section${title==='Состав'?' product-short-section--composition':''}${long?' product-short-section--long':''}`}><h2>{title}</h2><p>{excerpt}</p>{text.length>0&&<button type="button" className="text-button product-fact-details" onClick={onDetails} aria-label={`Подробнее: ${title.toLowerCase()}`}>Подробнее</button>}</section>;
}

export function ProductOverview({product:p,notes,onDetails}:{product:Product;notes:number;onDetails:(tab:'description'|'properties')=>void}){
 const root=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const el=root.current;if(!el)return;let disposed=false,frame=0;
  const fit=()=>{if(!disposed)fitProductOverview(el,window)};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  fit();document.fonts.ready.then(schedule);window.addEventListener('resize',schedule);
  const observer=new ResizeObserver(schedule);
  for(const child of el.querySelectorAll('.product-title-row,.purchase-box,.product-key-facts'))observer.observe(child);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule)};
 },[p.id]);
 const {state,setState,notify}=useStore(),available=p.availability!=='OutOfStock';
 const card=p.card||data.products.find(x=>x.id===p.id)?.card;
 const composition=compositionSummary(p),facts=overviewFacts(p,packageInfo(p));
 const contents=p.setProducts?.map(id=>data.products.find(x=>x.id===id)).filter((x):x is Product=>Boolean(x));
 const current=priceOf(p,state.card),hasCardPrice=state.card&&p.prices.partner!==null;
 return <div ref={root} className="product-detail product-detail--v2 product-detail--nature" data-ds-id="product-detail">
  <ProductGallery product={p}/>
  <div className="product-purchase">
   <div className="product-title-row"><h1>{shortName(p.name)}</h1><div className="product-heading-meta"><div className="rating product-rating"><ReviewLine product={p} notes={notes} separator={false}/></div>{p.article&&<><span className="product-meta-divider" aria-hidden="true">|</span><span className="product-article">Арт. {p.article}</span></>}</div></div>
   <span className={`product-stock product-stock--standalone${available?'':' product-stock--unavailable'}`}><span aria-hidden="true"/>{available?'В наличии':'Нет в наличии'}</span>
   <div className="purchase-box panel"><div className="purchase-prices purchase-prices--plain" data-ds-id="purchase-prices"><div className={`price-row current${hasCardPrice?' price-row--partner':''}`}><strong aria-label={hasCardPrice?'Цена по дисконтной карте':undefined}>{money(current)}</strong>{hasCardPrice&&current<p.prices.retail&&<s className="price-was">{money(p.prices.retail)}</s>}</div>{!hasCardPrice&&p.prices.source==='price-list'&&<CardOffer/>}</div><div className="purchase-actions">{available?<CartButton product={p} buyNow/>:<WaitlistButton product={p}/>}</div></div>
   {card?.sub&&<p className="product-purpose">{card.sub.replace(/\n/g,' ')}</p>}
   {facts.length>0&&<dl className="product-key-facts">{facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
   {composition&&<ShortFact title="Состав" text={composition} onDetails={()=>onDetails('properties')}/>}
   {!composition&&(contents?.length||0)>0&&<ShortFact title="В наборе" text={contents!.map(x=>shortName(x.name)).join(', ')+'.'} onDetails={()=>onDetails('description')}/>}
   <button type="button" className="text-button product-plan-action" onClick={()=>{setState(s=>({...s,intake:s.intake.some(x=>x.id===p.id)?s.intake:[...s.intake,{id:p.id,time:'',done:false}]}));notify('Добавлено в ваш план приёма')}}>+ Добавить в план приёма</button>
   {/^(Биологические добавки|Наборы продуктов)/.test(p.properties['Тип']||p.category||'')&&<p className="fine-print">Схему приёма согласуйте со специалистом. БАД не является лекарственным средством.</p>}
  </div>
 </div>;
}
