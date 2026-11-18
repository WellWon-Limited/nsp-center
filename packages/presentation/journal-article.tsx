import {layoutScale} from './layout-scale.mjs';
import {useLayoutEffect} from 'react';
import type { Article } from './content-types';
import { ImmuneArticle, immuneArticleId } from './immune-article';
import imageSets from '../catalog/source/journal-images.json';
import { prepareJournalArticle } from './journal-article-media.mjs';
import './journal-article.css';
import { BackLink, Icon } from './ui';

export type JournalMedia={cover:string;alt:string;inline:{src:string;alt:string}[]};
export const journalImages=imageSets as Record<string,JournalMedia>;
export const journalCover=(article:Article)=>journalImages[article.id]?.cover||article.image||undefined;
export const journalCoverAlt=(article:Article)=>journalImages[article.id]?.alt||article.title;
export function orderJournalArticles(articles:Article[]){const ordered=articles.slice();const magnesium=ordered.findIndex(a=>a.id==='interesnye-fakty-pro-magniy');const immunity=ordered.findIndex(a=>a.id==='immunitet-tozhe-nuzhdaetsya-v-zashchite');if(magnesium>immunity&&immunity>=0)[ordered[magnesium],ordered[immunity]]=[ordered[immunity],ordered[magnesium]];return ordered;}
export function JournalArticle({article}:{article:Article}){
 useLayoutEffect(()=>{
  const cover=document.querySelector<HTMLImageElement>('.journal-article-page .av-hero-image');if(!cover)return;
  let frame=0,disposed=false;
  const fit=()=>{if(disposed)return;const top=cover.getBoundingClientRect().top+window.scrollY;const bottomSpace=matchMedia('(max-width:959px)').matches?88:24;cover.style.setProperty('--article-cover-height',`${Math.max(80,Math.floor((window.innerHeight-top-bottomSpace)/layoutScale(cover)))}px`)};
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
  const observer=new ResizeObserver(schedule);
  for(const el of document.querySelectorAll('.site-header,.av-hero-copy,.av-lead'))observer.observe(el);
  fit();document.fonts.ready.then(schedule);window.addEventListener('resize',schedule);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',schedule)};
 },[article.id]);
 if(article.id===immuneArticleId)return <ImmuneArticle/>;
 // Added articles share the journal cover, reading paper and typography.
 const media=journalImages[article.id]||(article.custom?{cover:article.image||'',alt:article.title,inline:[]}:undefined);
 if(!media)return <div className="av-document"><h1>{article.title}</h1><div className="av-reading" dangerouslySetInnerHTML={{__html:article.html}}/></div>;
 const {lead,body}=prepareJournalArticle(article,media);
 return <div className="av-document av-document--ivory journal-article" data-ds-id={article.custom?'article-added':`article-${article.id}`}>
  <header className={`av-hero${media.cover?'':' av-hero--text'}`}><div className="av-hero-copy"><span className="av-journal-link"><BackLink fallback="/blog/"/></span><h1>{article.title}</h1>{article.date&&<span className="av-date">{article.date}</span>}</div>{media.cover&&<img className="av-hero-image" src={media.cover} alt={media.alt} width="1536" height="1024" fetchPriority="high"/>}</header>
  <div className="av-reading-layout"><div className="av-reading"><div className="av-lead" dangerouslySetInnerHTML={{__html:lead}}/><div className="av-article-copy" dangerouslySetInnerHTML={{__html:body}}/><div className="av-end"><a href="/consultation/">Задать вопрос <Icon name="chevron" size={20}/></a></div></div></div>
 </div>;
}
