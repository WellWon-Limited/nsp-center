import { useState } from 'react';
import { RichContent } from './ui';
import './home-story.css';

const chapters = [
 {id:'care', title:'Забота о себе каждый день', marker:'', photo:'botanical', alt:'Свежая мята, мелисса и цитрус на светлом зелёном фоне'},
 {id:'service', title:'Покупателям NSP Center', marker:'<p> Акции и скидки для каждого клиента </p>'},
 {id:'catalog', title:'Категории и рубрики', marker:'<p> Популярные категории </p>'},
 {id:'answers', title:'Вопрос — ответ', marker:'<p> Вопрос - ответ </p>'},
 {id:'reading', title:'Статьи', marker:'<p> Акции </p>'},
 {id:'reviews', title:'Отзывы покупателей', marker:'<p> Отзывы </p>'},
 {id:'company', title:'О компании', marker:'<h2>О компании</h2>'},
 {id:'contacts', title:'Пункт выдачи заказов', marker:'<p> Пункт выдачи заказов </p>'},
];
const topicTitles = new Set(['Сильный иммунитет','Очистка организма','Бросающим курить','Похудение','Здоровье ваших глаз','Декоративная косметика','Спортивное питание','Натуральная косметика','Наборы','Популярные категории','Рубрики']);

// Only presentation changes: wording comes from the imported, sanitized source.
export function homeStorySections(source:string){
 let html=source.replace(/\s+/g,' ');
 // Keep the category/article link when its old banner is removed.
 html=html.replace(/<a([^>]+)>\s*(?:<p>\s*)?<img\b[^>]*>\s*(?:<\/p>\s*)?<\/a>\s*<h3>([\s\S]*?)<\/h3>/g,'<h3><a$1>$2</a></h3>');
 html=html.replace(/<a([^>]+)>\s*<img\b[^>]*>\s*<\/a>\s*<p>\s*<span>([\s\S]*?)<\/span>/g,'<p><a$1>$2</a>');
 html=html.replace(/<img\b[^>]*>/g,'');
 for(let i=0;i<3;i++)html=html.replace(/<(p|a)\b[^>]*>\s*<\/\1>/g,'');
 const sections=chapters.map((chapter,index)=>{
  const start=index===0?0:html.indexOf(chapter.marker);
  const next=chapters[index+1];const end=next?html.indexOf(next.marker):html.length;
  if(start<0||end<0)return null;
  let body=html.slice(start,end);
  if(['answers','reviews','company','contacts'].includes(chapter.id))body=body.replace(chapter.marker,'');
  body=body.replace(/<p>\s*([^<>]+)\s*<\/p>/g,(tag,text:string)=>topicTitles.has(text.trim())||text.trim().endsWith('?')?`<h3>${text.trim()}</h3>`:tag);
  if(chapter.id==='service')body=body.replace(/<p>\s*Акции и скидки для каждого клиента\s*<\/p>/,'');
  if(chapter.id==='reading'){
   body=body.replace(/<p>\s*(Акции|Статьи)\s*<\/p>/g,'');
   body=body.replace(/<p>\s*(<a[^>]*>[\s\S]*?<\/a>)\s*([^<]+)<\/p>/g,'<h3>$1</h3><p>$2</p>');
   body=body.replace(/(<a[^>]*>[^<]*<\/a>)\s*(?=<p>)/g,(match,link,offset,full)=>full.slice(0,offset).endsWith('<h3>')?match:`<h3>${link}</h3>`);
  }
  if(chapter.id==='reviews')body=body.replace(/<p>\s*<a[^>]*>\s*Показать все\s*<\/a>\s*<\/p>/,'');
  if(chapter.id==='contacts')body=body.replace(/<p>\s*(Адрес:|Телефон:|Электронная почта:)\s*<\/p>\s*<p>([\s\S]*?)<\/p>/g,'<p><strong>$1</strong> $2</p>');
  return {...chapter,html:body};
 });
 // If the imported source changes structure, retain its text instead of dropping it.
 if(sections.some(s=>!s))return [{...chapters[0],html}];
 return sections.filter((s):s is NonNullable<typeof s>=>s!==null).filter(s=>!['care','catalog'].includes(s.id));
}

export function HomeStory({html,reviewsHtml=''}:{html:string;reviewsHtml?:string}){
 const [allReviews,setAllReviews]=useState(false);
 const fullReviews=reviewsHtml.replace(/<img\b[^>]*>/g,'').replace(/<p>\s*<\/p>/g,'');
 const order=['service','answers','reading','reviews','company','contacts'];
 const sections=homeStorySections(html).sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));
 return <details className="panel source-description home-story" data-ds-id="home-source">
  <summary>Подробнее о NSP Center<span className="home-story-toggle" aria-hidden="true">+</span></summary>
  <article className="home-story-layout">
   <div className="home-story-body">{sections.map(section=><section className={`home-story-chapter home-story-chapter--${section.id}`} id={`about-${section.id}`} key={section.id}>
    <div className="home-story-copy"><header><h2>{section.title}</h2></header>
    {section.id==='reviews'?<div className="home-story-reviews">
     <div id="home-story-review-list"><RichContent html={allReviews&&fullReviews?fullReviews:section.html}/></div>
     {fullReviews&&<button type="button" className="home-story-reviews-toggle" aria-expanded={allReviews} aria-controls="home-story-review-list" onClick={()=>setAllReviews(value=>!value)}>{allReviews?'Свернуть отзывы':'Показать все'}</button>}
    </div>:<RichContent html={section.html}/>}
    </div>
    {section.photo&&<figure><img src={`/images/journal/about-${section.photo}.jpg`} alt={section.alt} width="1440" height="1080" loading="lazy" decoding="async"/></figure>}
    {section.id==='service'&&<figure><img src="/images/journal/about-delivery.jpg" alt="Бережная упаковка заказа в картонную коробку" width="1536" height="1024" loading="lazy"/></figure>}
    {section.id==='company'&&<figure><img src="/images/journal/about-laboratory.jpg" alt="Иллюстрация лаборатории по исследованию растительных ингредиентов" width="1440" height="1080" loading="lazy"/></figure>}
   </section>)}</div>
  </article>
 </details>;
}
