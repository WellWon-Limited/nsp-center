import {visibleCategories} from './catalog-categories.mjs';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { data, useStore } from './store';
import { isHiddenContent, listed } from './site';
import { searchSite, type SearchEntry } from './site-search-match.mjs';

/** The same local search in the desktop header and the phone menu. No account data is indexed. */
export function SiteSearch({menu=false}:{menu?:boolean}){
 const {site}=useStore();const [query,setQuery]=useState('');const [open,setOpen]=useState(false);
 const root=useRef<HTMLFormElement>(null);const input=useRef<HTMLInputElement>(null);const id=useId();
 const entries=useMemo<SearchEntry[]>(()=>[
  ...data.products.filter(listed).map(p=>({title:p.name,path:p.path,kind:'Продукт',keywords:[p.article,p.category,p.description].filter(Boolean).join(' ')})),
  ...data.articles.filter(a=>!isHiddenContent(site,'article',a.id)).map(a=>({title:a.title,path:a.path,kind:'Статья',keywords:a.description??''})),
  ...visibleCategories(data.categories,data.products).map(c=>({title:c.name,path:c.path,kind:'Категория',keywords:c.description??''})),
  ...data.pages.filter(p=>p.path!=='/design-system/').map(p=>({title:p.title,path:p.path,kind:'Информация',keywords:p.description??''})),
  ...(data.themes??[]).map(t=>({title:t.h1,path:t.path,kind:'Статья',keywords:`${t.title} ${t.description}`})),
  {title:'Доставка',path:'/delivery/',kind:'Информация',keywords:'получить заказ курьер самовывоз пункт выдачи'},
  {title:'Оплата',path:'/payments/',kind:'Информация',keywords:'оплатить заказ банковская карта наличные'},
  {title:'Отзывы покупателей',path:'/company/reviews/',kind:'Информация'},
  {title:'Контакты',path:'/contacts/',kind:'Информация',keywords:'телефон адрес часы работы'},
  {title:'Частые вопросы',path:'/company/faq/',kind:'Информация',keywords:(site?.content?.faq??[]).map(f=>`${f.q} ${f.a}`).join(' ')},
  {title:'Личный кабинет',path:'/profile/',kind:'Раздел',keywords:'вход регистрация дисконтная карта избранное'},
  {title:'Марафон заботы',path:'/health-marafon/',kind:'Раздел'},
  {title:'Тест-рекомендации',path:'/diagnostic-test/',kind:'Раздел'},
  {title:'План приёма',path:'/health/',kind:'Раздел'},
  {title:'Консультация',path:'/consultation/',kind:'Раздел'},
  {title:'Журнал о заботе',path:'/blog/',kind:'Раздел'},
 ],[site]);
 const results=useMemo(()=>searchSite(entries,query),[entries,query]);const visible=open&&Boolean(query.trim());
 useEffect(()=>{if(!open)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[open]);
 return <form ref={root} className={`site-search${menu?' site-search--menu':''}`} role="search" aria-label="Поиск по сайту" onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onSubmit={e=>{e.preventDefault();if(results[0])location.assign(results[0].path);}} onKeyDown={e=>{if(e.key==='Escape'){setOpen(false);input.current?.focus();}if(e.key==='ArrowDown'&&e.target===input.current&&results.length){e.preventDefault();root.current?.querySelector<HTMLAnchorElement>('.site-search-results a')?.focus();}}}>
  <input ref={input} type="search" value={query} onChange={e=>{setQuery(e.target.value);setOpen(true);}} onFocus={()=>setOpen(true)} placeholder="Поиск по сайту" aria-label="Поиск по сайту" aria-controls={id} aria-expanded={visible} autoComplete="off" enterKeyHint="search" maxLength={160}/>
  <div id={id} className="site-search-results" hidden={!visible}>
   <span className="sr-only" role="status" aria-live="polite">{visible?(results.length?`Найдено: ${results.length}`:'Ничего не найдено'):''}</span>
   {results.length?<ul>{results.map(result=><li key={result.path}><a href={result.path} onClick={()=>setOpen(false)}><span>{result.title}</span><small>{result.kind}</small></a></li>)}</ul>:<p>Ничего не найдено</p>}
  </div>
 </form>;
}
