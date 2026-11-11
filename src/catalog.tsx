import './catalog-mobile-entry.css';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { Category, ExpertNote, Product, Theme } from './content-types';
import { withProductImages } from './product-images';
import { data, money, shortName, useStore } from './store';
import { applyContent, listed, noteKey, noteStars, readSite, visibleNotes } from './site';
import { VideoGallery } from './information-pages';
import { videoSections } from './information-content.mjs';
import { CustomerReviews } from './reviews';
import { ProductThemes } from './theme-page';
import { ProductImage, BackLink, CardOffer, Empty, Heading, Icon, ProductGrid, RichContent, WaitlistButton, ReviewLine } from './ui';
// Sorting lives in a small menu behind a filter icon at the start of the filter row.
const sortOptions:[string,string][]=[['default','Все'],['popular','Сначала популярные'],['price-asc','Сначала дешевле'],['price-desc','Сначала дороже'],['name','По названию']];
function SortMenu({value,onChange,canReset,onReset}:{value:string;onChange:(v:string)=>void;canReset:boolean;onReset:()=>void}){const [open,setOpen]=useState(false);const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent|KeyboardEvent)=>{if(e instanceof KeyboardEvent?e.key==='Escape':!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};},[open]);
 const current=sortOptions.find(([v])=>v===value)||sortOptions[0];
 return <div className="sort-menu" ref={root}><button type="button" className={`sort-trigger ${value!=='default'?'active':''}`} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><Icon name="sliders" size={18}/><span>{value==='default'?'Сортировка':current[1]}</span></button>
 {open&&<div className="sort-options"><ul role="listbox" aria-label="Сортировка">{sortOptions.map(([v,label])=><li key={v}><button type="button" role="option" aria-selected={v===value} onClick={()=>{onChange(v);setOpen(false);}}>{label}{v===value&&<Icon name="check" size={16}/>}</button></li>)}</ul>{canReset&&<button type="button" className="sort-reset" onClick={()=>{onReset();setOpen(false);}}>Сбросить фильтры</button>}</div>}</div>;}
/** Cards per page: a multiple of six that fits `total` into `pages` pages without an empty last page. */
const evenPage=(total:number,pages:number,fallback:number)=>{if(pages<=1)return Math.max(total,1);const even=Math.ceil(Math.ceil(total/pages)/6)*6;return even*(pages-1)<total?even:Math.max(1,Math.ceil(total/pages))||fallback;};
/** How many products of a section (all when no list is given) customers see: hidden ones are not counted. */
const listedCount=(paths?:string[])=>paths?paths.filter(path=>{const p=data.products.find(x=>x.path===path);return p&&listed(p);}).length:data.products.filter(listed).length;
export function Catalog({category,url}:{category:Category;url:string}) {
 const params=new URL(url,'http://nsp.local').searchParams;const [q,setQ]=useState(params.get('q')||'');const [sort,setSort]=useState(params.get('sort')||'default');const [stock,setStock]=useState(params.get('stock')==='1');const [favoriteOnly,setFavoriteOnly]=useState(params.get('favorites')==='1'); const {state}=useStore();
 const page=Math.max(1,Number(params.get('PAGEN_1'))||1); const hasSearch=Boolean(q.trim()||stock||favoriteOnly||sort!=='default');
 const categoryEntry=category.path==='/catalog/'&&params.get('view')!=='products'&&!hasSearch&&page===1&&!params.has('PAGEN_1');
 // The section's list from the shared catalog data: it also holds cards created in site management (src/custom-product.mjs).
 let products=category.path==='/catalog/'?[...data.products]:(data.categories.find(c=>c.path===category.path)??category).products.map(path=>data.products.find(p=>p.path===path)!).filter(Boolean);
 products=products.filter(p=>listed(p)&&(!stock||p.availability!=='OutOfStock')&&(!favoriteOnly||state.favorites.includes(p.id))&&(`${p.name} ${p.article} ${p.category} ${p.properties['Назначение']||''}`.toLowerCase().includes(q.toLowerCase().trim())));
 if(sort==='price-asc')products.sort((a,b)=>a.prices.retail-b.prices.retail);if(sort==='price-desc')products.sort((a,b)=>b.prices.retail-a.prices.retail);if(sort==='name')products.sort((a,b)=>a.name.localeCompare(b.name,'ru'));if(sort==='popular')products.sort((a,b)=>(b.stars?.count||0)-(a.stars?.count||0)||(b.stars?.value||0)-(a.stars?.value||0));
 // Without a search the number of pages follows the snapshot's page routes (their addresses stay), but the products are
 // spread over them in rows that fill up: a page holds a multiple of six (three cards a row on a computer, two on a phone),
 // so a page does not end with one lonely card. Products added later sit on the first page.
 const routePages=data.routes.filter(r=>r.path===category.path&&r.products?.length).length;
 const size=30,total=products.length,pages=!hasSearch&&routePages?routePages:Math.max(1,Math.ceil(total/size)),pageSize=evenPage(total,pages,size),current=Math.min(q!==(params.get('q')||'')||stock!==(params.get('stock')==='1')||favoriteOnly!==(params.get('favorites')==='1')||sort!==(params.get('sort')||'default')?1:page,pages);const visible=products.slice((current-1)*pageSize,current*pageSize);
 // Filters live in the address, so "Назад" from a product page returns to the same filtered list.
 useEffect(()=>{const next=pageUrl(current);if(location.pathname+location.search!==next)history.replaceState(history.state,'',next);},[q,sort,stock,favoriteOnly]);
 function pageUrl(n:number){const p=new URLSearchParams();if(category.path==='/catalog/'&&params.get('view')==='products')p.set('view','products');if(n>1)p.set('PAGEN_1',String(n));if(q)p.set('q',q);if(sort!=='default')p.set('sort',sort);if(stock)p.set('stock','1');if(favoriteOnly)p.set('favorites','1');return category.path+(p.size?'?'+p.toString():'');}
 return <div className={`catalog-page${categoryEntry?' catalog-page--entry':''}`}>
 {!categoryEntry&&<a className="catalog-mobile-back" href="/catalog/"><Icon name="chevron" size={18}/><span>Категории</span></a>}
 <Heading title={category.path==='/catalog/'?'Каталог продуктов':category.name}/>
 {categoryEntry&&<nav className="catalog-mobile-entry" aria-label="Категории продуктов" data-ds-id="catalog-mobile-categories">
  <a className="catalog-entry-link" href="/catalog/?view=products"><span>Все товары</span><span className="catalog-entry-count">{listedCount()}</span><Icon name="chevron" size={20}/></a>
  {data.categories.filter(c=>c.path!=='/catalog/').map(c=><a className="catalog-entry-link" key={c.path} href={c.path}><span>{c.name}</span><span className="catalog-entry-count">{listedCount(c.products)}</span><Icon name="chevron" size={20}/></a>)}
 </nav>}
 <div className="catalog-layout"><aside className="catalog-sidebar panel" data-ds-id="catalog-navigation"><h2 className="catalog-sidebar-title">Категории</h2><a className={category.path==='/catalog/'?'active':''} href="/catalog/">Все продукты <span>{listedCount()}</span></a>{data.categories.filter(c=>c.path!=='/catalog/').map(c=><a className={category.path===c.path?'active':''} key={c.path} href={c.path}>{c.name}<span>{listedCount(c.products)}</span></a>)}</aside>
 <div><div className="panel catalog-tools" data-ds-id="catalog-filters"><label className="search-field"><Icon name="search"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Название, артикул, назначение" aria-label="Поиск по каталогу"/>{q&&<button className="icon-btn icon-btn--sm" onClick={()=>setQ('')} aria-label="Очистить поиск"><Icon name="close" size={16}/></button>}</label><div className="filter-row"><SortMenu value={sort} onChange={setSort} canReset={hasSearch} onReset={()=>{setQ('');setStock(false);setFavoriteOnly(false);setSort('default');}}/><label><input type="checkbox" checked={stock} onChange={e=>setStock(e.target.checked)}/> В наличии</label><label><input type="checkbox" checked={favoriteOnly} onChange={e=>setFavoriteOnly(e.target.checked)}/> Избранное</label></div></div>
 {visible.length?<ProductGrid products={visible}/>:<div className="catalog-empty" role="status"><p>Продукты не найдены</p></div>}
 {pages>1&&<nav className="pagination" aria-label="Страницы каталога">{Array.from({length:pages},(_,i)=>i+1).map(n=><a key={n} className={`pill ${n===current?'pill--active':''}`} aria-current={n===current?'page':undefined} href={pageUrl(n)}>{n}</a>)}</nav>}
 </div></div></div>;
}
// Product page price: everyone sees the retail price and an offer without amounts (sign in or get a card, up to 30% off);
// a signed-in account with a card number gets the card prices from the server and sees its card price instead.
function PurchasePrices({product:p}:{product:Product}){const {state}=useStore();const {retail,partner}=p.prices;
 if(state.card&&partner!==null)return <div className="purchase-prices purchase-prices--plain" data-ds-id="purchase-prices"><div className="price-row current price-row--partner"><span>Ваша цена по карте</span><strong>{money(partner)}</strong></div><div className="price-row"><span>Розничная цена</span><span className="price-was">{money(retail)}</span></div></div>;
 return <div className="purchase-prices purchase-prices--plain" data-ds-id="purchase-prices"><div className="price-row current"><span>Цена</span><strong>{money(retail)}</strong></div>{p.prices.source==='price-list'&&<CardOffer/>}</div>;}
// The description: the rewritten copy (src/product-copy) when there is one — paragraphs, then the short highlights —
// otherwise the snapshot description and its "Идеальный набор" block. Video reviews have their own tab.
function ProductDescription({product:p}:{product:Product}){
 if(p.copy)return <div className="product-copy">{p.copy.about.map((text,i)=><p key={i}>{text}</p>)}{p.copy.highlights.length>0&&<ul className="product-highlights">{p.copy.highlights.map(h=><li key={h}><Icon name="check" size={16}/>{h}</li>)}</ul>}</div>;
 const set=p.sectionsHtml['Идеальный набор'];
 return <div className="product-copy">{p.descriptionHtml?<RichContent html={p.descriptionHtml}/>:<p>{p.description}</p>}{set&&<section><h2>Идеальный набор</h2><RichContent html={set}/></section>}</div>;}
// Certificates and video reviews: a row on wide screens; on a phone one item at a time, switched with round arrows on it.
function PhoneSlider({count,labels,children}:{count:number;labels:[string,string];children:(current:number)=>ReactNode}){const [current,setCurrent]=useState(0);const last=count-1;
 return <div className="phone-slider">{children(current)}{last>0&&<>{current>0&&<button type="button" className="slider-arrow slider-arrow--prev" onClick={()=>setCurrent(i=>i-1)} aria-label={labels[0]}><Icon name="chevron" size={22}/></button>}{current<last&&<button type="button" className="slider-arrow slider-arrow--next" onClick={()=>setCurrent(i=>i+1)} aria-label={labels[1]}><Icon name="chevron" size={22}/></button>}</>}</div>;}
function Certificates({product:p}:{product:Product}){
 return <PhoneSlider count={p.documents.length} labels={["Предыдущий сертификат","Следующий сертификат"]}>{current=><div className="certificate-grid">{p.documents.map((doc,i)=><a className={`certificate slide ${i===current?"active":""}`} key={i} href={doc.url||undefined} target="_blank" rel="noreferrer"><img src={doc.url||undefined} alt={`Сертификат, страница ${i+1}`} width="220" height="300" loading="lazy"/></a>)}</div>}</PhoneSlider>;}
// «Отзывы» tab: expert comments from the lecture base first, each marked «Отзыв эксперта» with the doctor and the lecture.
// The reviews tab: expert comments (minus those the administrator hid) and customer reviews (src/reviews.tsx).
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
const isSupplement=(p:Product)=>/^(Биологические добавки|Наборы продуктов)/.test(p.category||'');
// A product hidden from customers (no longer supplied, or hidden in site management) keeps its address, so an old link or
// bookmark still opens: the page says it is not on sale and leads to its section. Search engines are told to drop it.
export function ProductDetail(props:{product:Product;themes?:Theme[]}){useStore();return props.product.hidden?<ProductGone product={props.product}/>:<ProductPage {...props}/>;}
function ProductGone({product:p}:{product:Product}){
 useEffect(()=>{if(document.querySelector('meta[name="robots"]'))return;const m=document.createElement('meta');m.name='robots';m.content='noindex, nofollow';document.head.append(m);return()=>m.remove();},[]);
 return <section className="not-found empty-screen product-gone" data-ds-id="product-gone"><h1>«{shortName(p.name)}» сейчас нет в продаже</h1><a className="btn btn--primary" href={p.categoryPath||'/catalog/'}>Перейти в каталог</a></section>;
}
function ProductPage({product,themes=[]}:{product:Product;themes?:Theme[]}) {
 const p=withProductImages(product);
 const videos=videoSections(p.sectionsHtml['Видеообзоры']||'');
// «Отзывы · 5»: expert comments shown plus published customer reviews.
 const {site:siteForCount}=useStore();const reviewCount=visibleNotes(p.id,p.experts,siteForCount).length+(siteForCount?.ratings?.[p.id]?.count??0);const reviewsLabel=reviewCount?`Отзывы · ${reviewCount}`:'Отзывы';
 const tabs=[...(hasDescription(p)?[['description','Описание']]:[]),['properties','Состав и применение'],...(videos.length?[['videos','Видеообзоры']]:[]),...(p.documents.length?[['documents','Сертификаты']]:[]),['reviews',reviewsLabel]];
 const {state,add,favorite,setState,notify,accounts}=useStore();const [quantity,setQuantity]=useState(1);
 // The administrator's own content of this card (name, description, composition, certificates, photo; src/site.ts).
 const [,setContentVersion]=useState(0);
 useEffect(()=>{if(accounts!=='server')return;let off=false;fetch(`/api/product-content?id=${encodeURIComponent(product.id)}`,{headers:{Accept:'application/json'}}).then(r=>r.ok?r.json():null).then(b=>{if(off||!b)return;applyContent(product,b.content);setContentVersion(v=>v+1);}).catch(()=>{/* the built card stays */});return()=>{off=true;};},[accounts,product]);const [tab,setTab]=useState(tabs[0][0]); const available=p.availability!=='OutOfStock';
 const related=data.products.filter(x=>x.id!==p.id&&listed(x)&&(p.related.includes(x.path)||x.category===p.category)).slice(0,4);
 return <><BackLink fallback={p.categoryPath||'/catalog/'}/><div className="product-detail product-detail--v2" data-ds-id="product-detail"><div className="product-gallery panel"><div className="main-product-image"><ProductImage product={p} detail/><button className={`icon-btn favorite ${state.favorites.includes(p.id)?'selected':''}`} aria-label={`${state.favorites.includes(p.id)?'Убрать из':'Добавить в'} избранное: ${shortName(p.name)}`} aria-pressed={state.favorites.includes(p.id)} onClick={()=>favorite(p.id)}><Icon name="heart" size={20}/></button>{!available&&<span className="pill stock-pill">Нет в наличии</span>}</div></div><div className="product-purchase"><div className="product-title-row"><h1>{p.name}</h1><span className="product-article">Арт. {p.article}</span></div>{p.category&&<span className="product-title-category">{p.category}</span>}<div className="rating product-rating"><ReviewLine product={p} notes={p.experts?.length??0}/></div><div className="purchase-box panel"><PurchasePrices product={p}/><div className="purchase-actions"><div className="quantity"><button disabled={quantity===1} onClick={()=>setQuantity(q=>q-1)} aria-label="Уменьшить количество"><Icon name="minus" size={16}/></button><output aria-label="Количество">{quantity}</output><button disabled={quantity===99} onClick={()=>setQuantity(q=>q+1)} aria-label="Увеличить количество"><Icon name="plus" size={16}/></button></div>{available?<button type="button" className="btn card-cart-button" onClick={()=>add(p,quantity)}><Icon name="bag" size={18}/>В корзину</button>:<WaitlistButton product={p}/>}</div></div><button className="text-button" onClick={()=>{setState(s=>({...s,intake:s.intake.some(x=>x.id===p.id)?s.intake:[...s.intake,{id:p.id,time:'08:00',done:false}]}));notify('Добавлено в ваш план приёма');}}>+ Добавить в план приёма</button>{isSupplement(p)&&<p className="fine-print">Схему приёма согласуйте со специалистом. БАД не является лекарственным средством.</p>}</div></div>
 <section className="product-content product-content--plain" data-ds-id="product-information"><div className="tabs" role="tablist" aria-label="Информация о продукте">{tabs.map(([id,label])=><button key={id} role="tab" id={`tab-${id}`} aria-selected={tab===id} aria-controls={`panel-${id}`} tabIndex={tab===id?0:-1} className={tab===id?'active':''} onClick={()=>setTab(id)} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const index=tabs.findIndex(x=>x[0]===id);const next=tabs[(index+(e.key==='ArrowRight'?1:tabs.length-1))%tabs.length][0];setTab(next);document.getElementById(`tab-${next}`)?.focus();}}}>{label}</button>)}</div>
 {hasDescription(p)&&<div id="panel-description" role="tabpanel" aria-labelledby="tab-description" hidden={tab!=='description'}><ProductDescription product={p}/></div>}
 <div id="panel-properties" role="tabpanel" aria-labelledby="tab-properties" hidden={tab!=='properties'}><dl className="properties properties--v2">{productFacts(p).map(([key,value])=><div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl></div>
 {p.documents.length>0&&<div id="panel-documents" role="tabpanel" aria-labelledby="tab-documents" hidden={tab!=='documents'}><Certificates product={p}/></div>}
 {videos.length>0&&<div id="panel-videos" role="tabpanel" aria-labelledby="tab-videos" hidden={tab!=='videos'}><div className="product-video-gallery"><VideoGallery videos={videos}/></div></div>}<div id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" hidden={tab!=='reviews'}><ProductReviews product={p}/></div></section><ProductThemes themes={themes}/><section className="section"><div className="related-heading"><h2>В том же разделе</h2><a href={p.categoryPath||'/catalog/'}>Все продукты <Icon name="chevron" size={16}/></a></div><ProductGrid products={related}/></section></>;
}
