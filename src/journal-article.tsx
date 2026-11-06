import type { Article } from './content-types';
import { ImmuneArticle, immuneArticleId } from './immune-article';
import imageSets from './journal-images.json';
import { prepareJournalArticle } from './journal-article-media.mjs';
import './journal-article.css';
import { BackLink } from './ui';

export type JournalMedia={cover:string;alt:string;inline:{src:string;alt:string}[]};
export const journalImages=imageSets as Record<string,JournalMedia>;
export const journalCover=(article:Article)=>journalImages[article.id]?.cover||article.image||undefined;
export const journalCoverAlt=(article:Article)=>journalImages[article.id]?.alt||article.title;
export function orderJournalArticles(articles:Article[]){const ordered=articles.slice();const magnesium=ordered.findIndex(a=>a.id==='interesnye-fakty-pro-magniy');const immunity=ordered.findIndex(a=>a.id==='immunitet-tozhe-nuzhdaetsya-v-zashchite');if(magnesium>immunity&&immunity>=0)[ordered[magnesium],ordered[immunity]]=[ordered[immunity],ordered[magnesium]];return ordered;}
export function JournalArticle({article}:{article:Article}){
 if(article.id===immuneArticleId)return <ImmuneArticle/>;
 const media=journalImages[article.id];
 if(!media)return <div className="av-document"><h1>{article.title}</h1><div className="av-reading" dangerouslySetInnerHTML={{__html:article.html}}/></div>;
 const {lead,body}=prepareJournalArticle(article,media);
 return <div className="av-document av-document--ivory journal-article" data-ds-id={`article-${article.id}`}>
  <header className="av-hero"><div className="av-hero-copy"><span className="av-journal-link"><BackLink fallback="/blog/"/></span><h1>{article.title}</h1><span className="av-date">{article.date}</span></div><img className="av-hero-image" src={media.cover} alt={media.alt} width="1536" height="1024" fetchPriority="high"/></header>
  <div className="av-reading-layout"><div className="av-reading"><div className="av-lead" dangerouslySetInnerHTML={{__html:lead}}/><div className="av-article-copy" dangerouslySetInnerHTML={{__html:body}}/><div className="av-end"><a href="/consultation/">Задать вопрос ↗</a></div></div></div>
 </div>;
}
