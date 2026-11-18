import {visibleCategories} from './catalog-categories.mjs';
import {catalogPagination} from './catalog-pagination.mjs';
import './catalog-approved.css';
import {ProductOverview} from './product-overview';
import './catalog-mobile-entry.css';
import './expert-notes.css';
import './product-page-layout.css';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Category, ExpertNote, Product, Theme } from './content-types';
import { withProductImages } from './product-images';
import { data, shortName, useStore } from './store';
import { applyContent, listed, noteKey, noteStars, readSite, visibleNotes } from './site';
import { VideoGallery } from './information-pages';
import {videoOf} from './site-content.mjs';
import { videoSections } from './information-content.mjs';
import { CustomerReviews } from './reviews';
import { ProductThemes } from './theme-page';
import { BackLink, Heading, Icon, ProductGrid, RichContent } from './ui';
// Sorting lives in a small menu behind a filter icon at the start of the filter row.
const sortOptions:[string,string][]=[['default','Все'],['popular','Сначала популярные'],['price-asc','Сначала дешевле'],['price-desc','Сначала дороже'],['name','По названию']];
function SortMenu({value,onChange,canReset,onReset}:{value:string;onChange:(v:string)=>void;canReset:boolean;onReset:()=>void}){const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent|KeyboardEvent)=>{if(e instanceof KeyboardEvent?e.key==='Escape':!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};},[open]);
 const current=sortOptions.find(([v])=>v===value)||sortOptions[0];
 return <div className="sort-menu" ref={root}><button type="button" className={`sort-trigger ${value!=='default'?'active':''}`} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="sliders" size={18}/><span>{value==='default'?'Сортировка':current[1]}</span></button>
 {open&&<div className="sort-options"><ul role="listbox" aria-label="Сортировка">{sortOptions.map(([v,label])=><li key={v}><button type="button" role="option" aria-selected={v===value} onClick={()=>{onChange(v);setOpen(false);}}>{label}{v===value&&<Icon name="check" size={16}/>}</button></li>)}</ul>{canReset&&<button type="button" className="sort-reset" onClick={()=>{onReset();setOpen(false);}}>Сбросить фильтры</button>}</div>}</div>;}
/** How many products of a section (all when no list is given) customers see: hidden ones are not counted. */
const listedCount=(paths?:string[])=>paths?paths.filter(path=>{const p=data.products.find(x=>x.path===path);return p&&listed(p);}).length:data.products.filter(listed).length;
export function Catalog({category,url}:{category:Category;url:string}) {

 const params=new URL(url,'http://nsp.local').searchParams;const [q,setQ]=useState(params.get('q')||'');const [sort,setSort]=useState(params.get('sort')||'default');const [stock,setStock]=useState(params.get('stock')==='1');const [favoriteOnly,setFavoriteOnly]=useState(params.get('favorites')==='1'); const {state,site}=useStore();
 category=site?.catalog?(data.categories.find(c=>c.path===category.path)??category):category;
 const page=Math.max(1,Number(params.get('PAGEN_1'))||1); const hasSearch=Boolean(q.trim()||stock||favoriteOnly||sort!=='default');
 const categoryEntry=category.path==='/catalog/'&&params.get('view')!=='products'&&!hasSearch&&page===1&&!params.has('PAGEN_1');
 // The section's list from the shared catalog data: it also holds cards created in site management (packages/presentation/custom-product.mjs).
 let products=category.path==='/catalog/'?[...data.products]:(data.categories.find(c=>c.path===category.path)??category).products.map(path=>data.products.find(p=>p.path===path)!).filter(Boolean);
 products=products.filter(p=>listed(p)&&(!stock||p.availability!=='OutOfStock')&&(!favoriteOnly||state.favorites.includes(p.id))&&(`${p.name} ${p.article} ${p.category} ${p.properties['Назначение']||''}`.toLowerCase().includes(q.toLowerCase().trim())));
 if(sort==='price-asc')products.sort((a,b)=>a.prices.retail-b.prices.retail);if(sort==='price-desc')products.sort((a,b)=>b.prices.retail-a.prices.retail);if(sort==='name')products.sort((a,b)=>a.name.localeCompare(b.name,'ru'));if(sort==='popular')products.sort((a,b)=>(b.stars?.count||0)-(a.stars?.count||0)||(b.stars?.value||0)-(a.stars?.value||0));
 // Full rows at every breakpoint, preserving existing page addresses and leaving any remainder to the last page.
 const routePages=data.routes.filter(r=>r.path===category.path&&r.products?.length).length;
 const total=products.length,slices=catalogPagination(total,hasSearch?0:routePages),pages=slices.length,current=Math.min(q!==(params.get('q')||'')||stock!==(params.get('stock')==='1')||favoriteOnly!==(params.get('favorites')==='1')||sort!==(params.get('sort')||'default')?1:page,pages);
 const visible=products.slice(slices[current-1].start,slices[current-1].end);
 // Filters live in the address, so "Назад" from a product page returns to the same filtered list.
 useEffect(()=>{const next=pageUrl(current);if(location.pathname+location.search!==next)history.replaceState(history.state,'',next);},[q,sort,stock,favoriteOnly]);
 function pageUrl(n:number){const p=new URLSearchParams();if(category.path==='/catalog/'&&params.get('view')==='products')p.set('view','products');if(n>1)p.set('PAGEN_1',String(n));if(q)p.set('q',q);if(sort!=='default')p.set('sort',sort);if(stock)p.set('stock','1');if(favoriteOnly)p.set('favorites','1');return category.path+(p.size?'?'+p.toString():'');}
 return <div className={`catalog-page${categoryEntry?' catalog-page--entry':''}`}>
 {!categoryEntry&&<a className="catalog-mobile-back" data-back-link="page" href="/catalog/"><Icon name="chevron" size={18}/><span>Категории</span></a>}
 <Heading title={category.path==='/catalog/'?'Все продукты':category.name}/>
 {categoryEntry&&<nav className="catalog-mobile-entry" aria-label="Категории продуктов" data-ds-id="catalog-mobile-categories">
  <a className="catalog-entry-link" href="/catalog/?view=products"><span>Все товары</span><span className="catalog-entry-count">{listedCount()}</span><Icon name="chevron" size={20}/></a>
  {visibleCategories(data.categories,data.products).filter(c=>c.path!=='/catalog/').map(c=><a className="catalog-entry-link" key={c.path} href={c.path}><span>{c.name}</span><span className="catalog-entry-count">{listedCount(c.products)}</span><Icon name="chevron" size={20}/></a>)}
 </nav>}
 <div className="catalog-layout"><aside className="catalog-sidebar panel" data-ds-id="catalog-navigation" aria-label="Категории продуктов"><a className={category.path==='/catalog/'?'active':''} href="/catalog/">Все продукты <span>{listedCount()}</span></a>{visibleCategories(data.categories,data.products).filter(c=>c.path!=='/catalog/').map(c=><a className={category.path===c.path?'active':''} key={c.path} href={c.path}>{c.name}<span>{listedCount(c.products)}</span></a>)}</aside>
 <div><div className="panel catalog-tools" data-ds-id="catalog-filters"><label className="catalog-phone-search"><span className="sr-only">Поиск в категории</span><Icon name="search" size={20}/><input type="search" aria-label="Поиск в категории" placeholder="Найти продукт в этой категории" value={q} onChange={e=>setQ(e.target.value)}/>{q&&<button type="button" onClick={()=>setQ('')} aria-label="Очистить поиск">×</button>}</label><div className="filter-row"><SortMenu value={sort} onChange={setSort} canReset={hasSearch} onReset={()=>{setQ('');setStock(false);setFavoriteOnly(false);setSort('default');}}/><label><input type="checkbox" checked={stock} onChange={e=>setStock(e.target.checked)}/> В наличии</label><label><input type="checkbox" checked={favoriteOnly} onChange={e=>setFavoriteOnly(e.target.checked)}/> Избранное</label></div></div>
 {visible.length?<ProductGrid products={visible} compact/>:<div className="catalog-empty" role="status"><p>Продукты не найдены</p></div>}
 {pages>1&&<nav className="pagination" aria-label="Страницы каталога">{Array.from({length:pages},(_,i)=>i+1).map(n=><a key={n} className={`pill ${n===current?'pill--active':''}`} aria-current={n===current?'page':undefined} href={pageUrl(n)}>{n}</a>)}</nav>}
 </div></div></div>;
}
// Product page price: everyone sees the retail price and an offer without amounts (sign in or get a card, up to 30% off);
// a signed-in account with a card number gets the card prices from the server and sees its card price instead.
// The description: the rewritten copy (packages/catalog/source/product-copy) when there is one — paragraphs, then the short highlights —
// otherwise the snapshot description. The snapshot's "Идеальный набор" block (photos of the products to take with it and
// the old site's price lines) is not shown (owner, 2026-11-12); what goes with what is the «С чем сочетают?» block below.
// Video reviews have their own tab.
function ProductDescription({product:p}:{product:Product}){
 const heading=<h2 className="product-about-title">О продукте</h2>;
 if(p.copy)return <div className="product-copy">{heading}{p.copy.about.map((text,i)=><p key={i}>{text}</p>)}{p.copy.highlights.length>0&&<ul className="product-highlights">{p.copy.highlights.map(h=><li key={h}><Icon name="check" size={16}/>{h}</li>)}</ul>}</div>;
 return <div className="product-copy">{heading}{p.descriptionHtml?<RichContent html={p.descriptionHtml}/>:<p>{p.description}</p>}</div>;}
// Certificates and video reviews: a row on wide screens; on a phone one item at a time, switched with round arrows on it.
function PhoneSlider({count,labels,children}:{count:number;labels:[string,string];children:(current:number)=>ReactNode}){const [current,setCurrent]=useState(0);const last=count-1;
 return <div className="phone-slider">{children(current)}{last>0&&<>{current>0&&<button type="button" className="slider-arrow slider-arrow--prev" onClick={()=>setCurrent(i=>i-1)} aria-label={labels[0]}><Icon name="chevron" size={22}/></button>}{current<last&&<button type="button" className="slider-arrow slider-arrow--next" onClick={()=>setCurrent(i=>i+1)} aria-label={labels[1]}><Icon name="chevron" size={22}/></button>}</>}</div>;}
function Certificates({product:p}:{product:Product}){
 return <PhoneSlider count={p.documents.length} labels={["Предыдущий сертификат","Следующий сертификат"]}>{current=><div className="certificate-grid">{p.documents.map((doc,i)=><a className={`certificate slide ${i===current?"active":""}`} key={i} href={doc.url||undefined} target="_blank" rel="noreferrer"><img src={doc.url||undefined} alt={`Сертификат, страница ${i+1}`} width="220" height="300" loading="lazy"/></a>)}</div>}</PhoneSlider>;}
// «Отзывы» tab: expert comments from the lecture base first, each marked «Отзыв эксперта» with the doctor and the lecture.
// The reviews tab: expert comments (minus those the administrator hid) and customer reviews (packages/presentation/reviews.tsx).
// Expert comments and customer reviews; an administrator can set an expert comment's stars (scripts/site-admin.mjs).
function ProductReviews({product:p}:{product:Product}){const {site,setSite,staff,notify}=useStore();const admin=Boolean(staff);const notes=visibleNotes(p.id,p.experts,site);
 const rate=async(key:string,rating:number)=>{const r=await fetch('/api/admin/note-stars',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({productId:p.id,key,rating})}).catch(()=>null);const b=await r?.json().catch(()=>null);if(!r?.ok){notify(b?.error||'Не удалось сохранить.');return;}setSite(readSite(b));notify(`Оценка: ${rating} из 5`);};
 return <>{notes.length>0&&<ExpertNotes notes={notes} stars={n=>noteStars(p.id,noteKey(n),site)} onRate={admin?rate:undefined}/>}<CustomerReviews productId={p.id} empty={!notes.length}/></>;}
/** Five stars; with `onPick` (an administrator) each star sets the rating. */
function StarRow({value,onPick}:{value:number;onPick?:(n:number)=>void}){return <span className="star-row" aria-label={`Оценка ${value} из 5`}>{[1,2,3,4,5].map(i=>onPick?<button type="button" key={i} className={i<=value?'on':''} aria-label={`${i} из 5`} onClick={()=>onPick(i)}>★</button>:<span key={i} aria-hidden="true" className={i<=value?'on':''}>★</span>)}</span>;}
function ExpertNotes({notes,stars,onRate}:{notes:ExpertNote[];stars:(n:ExpertNote)=>number;onRate?:(key:string,rating:number)=>void}){return <div className="expert-notes" data-ds-id="expert-notes">{notes.map((n,i)=>{return <article className="expert-note" key={i}><span className="expert-badge"><Icon name="shield" size={15}/>Отзыв эксперта</span><StarRow value={stars(n)} onPick={onRate?r=>onRate(noteKey(n),r):undefined}/>{n.about&&<span className="expert-about">о продукте «{n.about}» из набора</span>}<p className="expert-text">{n.text}</p><footer><strong>{n.speaker}</strong>{n.role&&<span>{n.role}</span>}<small>Лекция «{n.lecture}»{n.course?`, ${n.course}`:''}</small></footer></article>;})}</div>;}
const hasDescription=(p:Product)=>Boolean(p.copy||p.descriptionHtml||p.description);
// "Состав и применение" in a fixed, readable order. Not shown: the snapshot's disease list ("Назначение"), audience tags
// ("Здоровье всей семьи") and the type, which is already the category under the title.
export const factOrder:[string,string][]=[['Состав 1 ед. (таблетки, пакетика, порции)','Состав (1 порция)'],['Вспомогательные вещества','Вспомогательные вещества'],['Применение','Как принимать'],['Нанесение','Как наносить'],['Противопоказания (предосторожности)','Противопоказания'],['Системы организма','Системы организма'],['Группы фитопродуктов','Группы фитопродуктов'],['Группы косметики','Группы косметики'],['Коллекция','Коллекция'],['Здоровое питание','Здоровое питание'],['Производитель','Производитель'],['pv','Баллы PV']];
const productFacts=(p:Product)=>factOrder.filter(([key])=>p.properties[key]).map(([key,label])=>[label,p.properties[key]] as [string,string]);
// Supplements and supplement sets carry the BAD notice; cosmetics do not.
const isSupplement=(p:Product)=>/^(Биологические добавки|Наборы продуктов)/.test(p.properties['Тип']||p.category||'');
// A product hidden from customers (no longer supplied, or hidden in site management) keeps its address, so an old link or
// bookmark still opens: the page says it is not on sale and leads to its section. Search engines are told to drop it.
export function ProductDetail(props:{product:Product;themes?:Theme[]}){useStore();return props.product.hidden?<ProductGone product={props.product}/>:<ProductPage {...props}/>;}
function ProductGone({product:p}:{product:Product}){
 useEffect(()=>{if(document.querySelector('meta[name="robots"]'))return;const m=document.createElement('meta');m.name='robots';m.content='noindex, nofollow';document.head.append(m);return()=>m.remove();},[]);
 return <section className="not-found empty-screen product-gone" data-ds-id="product-gone"><h1>«{shortName(p.name)}» сейчас нет в продаже</h1><a className="btn btn--primary" href={p.categoryPath||'/catalog/'}>Перейти в каталог</a></section>;
}
function ProductPage({product,themes=[]}:{product:Product;themes?:Theme[]}) {
 const information=useRef<HTMLElement>(null);
 const p=withProductImages(product);
 const videos=p.adminVideos!==undefined?p.adminVideos.flatMap(v=>{const info=videoOf(v.url);return info?[{...info,title:v.title}]:[]}):videoSections(p.sectionsHtml['Видеообзоры']||'');
// «Отзывы · 5»: expert comments shown plus published customer reviews.
 const {site:siteForCount}=useStore();const reviewCount=visibleNotes(p.id,p.experts,siteForCount).length+(siteForCount?.ratings?.[p.id]?.count??0);const reviewsLabel=reviewCount?`Отзывы · ${reviewCount}`:'Отзывы';
 const tabs=[...((hasDescription(p)||p.custom)?[['description','Описание']]:[]),['properties','Состав и применение'],...(videos.length?[['videos','Видеообзоры']]:[]),...(p.documents.length?[['documents','Сертификаты']]:[]),['reviews',reviewsLabel]];
 const {state,favorite,setState,notify,accounts}=useStore();
 // The administrator's own content of this card (name, description, composition, certificates, photo; packages/presentation/site.ts).
 const [,setContentVersion]=useState(0);
 useEffect(()=>{if(accounts!=='server')return;let off=false;fetch(`/api/product-content?id=${encodeURIComponent(product.id)}`,{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(b=>{if(off||!b)return;applyContent(product,b.content);setContentVersion(v=>v+1);}).catch(()=>{/* the built card stays */});return()=>{off=true;};},[accounts,product]);const [tab,setTab]=useState(tabs[0][0]); const available=p.availability!=='OutOfStock';
 useLayoutEffect(()=>{
  const requested=new URLSearchParams(window.location.search).get('tab');
  if(!requested||!tabs.some(([id])=>id===requested))return;
  setTab(requested);
  const frame=requestAnimationFrame(()=>document.getElementById('product-information')?.scrollIntoView({block:'start',behavior:'instant'}));
  return()=>cancelAnimationFrame(frame);
 },[p.id]);
 const related=data.products.filter(x=>x.id!==p.id&&listed(x)&&(p.related.includes(x.path)||x.category===p.category)).slice(0,4);
 return <><BackLink fallback={p.categoryPath||'/catalog/'}/><ProductOverview product={p} notes={visibleNotes(p.id,p.experts,siteForCount).length} onDetails={next=>{setTab(next);requestAnimationFrame(()=>information.current?.scrollIntoView({behavior:'smooth',block:'start'}));}}/>
 <section ref={information} id="product-information" className="product-content product-content--plain" data-ds-id="product-information"><div className="tabs" role="tablist" aria-label="Информация о продукте">{tabs.map(([id,label])=><button key={id} role="tab" id={`tab-${id}`} aria-selected={tab===id} aria-controls={`panel-${id}`} tabIndex={tab===id?0:-1} className={tab===id?'active':''} onClick={()=>setTab(id)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const index=tabs.findIndex(x=>x[0]===id);const next=tabs[(index+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length][0];setTab(next);document.getElementById(`tab-${next}`)?.focus();}}}>{label}</button>)}</div>
 {hasDescription(p)&&<div id="panel-description" role="tabpanel" aria-labelledby="tab-description" hidden={tab!=='description'}><ProductDescription product={p}/></div>}
 <div id="panel-properties" role="tabpanel" aria-labelledby="tab-properties" hidden={tab!=='properties'}><dl className="properties properties--v2">{productFacts(p).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>
 {p.documents.length>0&&<div id="panel-documents" role="tabpanel" aria-labelledby="tab-documents" hidden={tab!=='documents'}><Certificates product={p}/></div>}
 {videos.length>0&&<div id="panel-videos" role="tabpanel" aria-labelledby="tab-videos" hidden={tab!=='videos'}><div className="product-video-gallery"><VideoGallery videos={videos}/></div></div>}<div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" hidden={tab!=='reviews'}><ProductReviews product={p}/></div></section><ProductThemes themes={themes} product={p}/><section className="section"><div className="related-heading"><h2>В том же разделе</h2><a href={p.categoryPath||'/catalog/'}>Все продукты <Icon name="chevron" size={16}/></a></div><ProductGrid products={related}/></section></>;
}
